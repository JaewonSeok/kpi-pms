import './register-path-aliases'
import assert from 'node:assert/strict'
import Module from 'node:module'

process.env.DATABASE_URL ||= 'postgresql://postgres:password@localhost:5432/kpi_pms'

// 한 건이 실패해도 나머지 케이스 결과를 함께 보도록 끝까지 돌고, 실패가 있으면 exit 1 로 끝낸다.
async function run(name: string, fn: () => Promise<void> | void) {
  try {
    await fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}

function stubModule(request: string, exports: Record<string, unknown>) {
  const filename = require.resolve(request)
  const stub = new Module(filename)
  stub.filename = filename
  stub.loaded = true
  stub.exports = exports
  require.cache[filename] = stub
}

type Category = 'ORG_GOAL' | 'PROJECT_T' | 'PROJECT_K' | 'DAILY_WORK' | null

function makeEvaluation(params: { itemCategory: Category; kpiCategory: Category; evalStage?: string }) {
  return {
    id: 'eval-1',
    evalCycleId: 'cycle-1',
    targetId: 'emp-target',
    evaluatorId: 'emp-evaluator',
    evalStage: params.evalStage ?? 'FIRST',
    status: 'IN_PROGRESS',
    evalCycle: { id: 'cycle-1', evalYear: 2026, status: 'FIRST_EVAL' },
    items: [
      {
        id: 'item-1',
        evaluationId: 'eval-1',
        personalKpiId: 'kpi-1',
        policyCategory: params.itemCategory,
        targetAchievementLevel: null,
        basePolicyScore: null,
        personalKpi: {
          id: 'kpi-1',
          kpiName: '테스트 KPI',
          goalType: 'GENERAL',
          kpiType: 'QUANTITATIVE',
          weight: 100,
          targetAmount: null,
          linkedOrgKpi: null,
          policyCategory: params.kpiCategory,
        },
      },
    ],
  }
}

const SUBMIT_BODY = {
  comment: '종합 의견입니다. '.repeat(6),
  strengthComment: '강점 요약을 충분히 적었습니다.',
  improvementComment: '보완 포인트를 충분히 적었습니다.',
}

async function main() {
  stubModule('next-auth', { getServerSession: async () => ({ user: { id: 'emp-evaluator', role: 'ROLE_TEAM_LEADER' } }) })
  stubModule('../src/lib/auth', { authOptions: {} })
  stubModule('../src/lib/audit', { createAuditLog: async () => undefined, getClientInfo: () => ({}), resolveAuditActor: () => ({ userId: 'emp-evaluator' }) })
  stubModule('../src/server/impersonation', {
    validateImpersonationRiskRequest: async () => null,
    logImpersonationRiskExecution: async () => undefined,
  })

  // 실제 Prisma 로 나가지 않게 prisma 모듈 자체를 스텁으로 바꾼다. 스텁하지 않은 모델 · 메서드에 접근하면
  // UNSTUBBED_DB_CALL 을 기록하고 즉시 던진다.
  const unstubbedCalls: Array<{ via: string; call: string }> = []
  function guardedDb(via: string, models: Record<string, unknown>): Record<string, unknown> {
    return new Proxy({} as Record<string, unknown>, {
      has: (_target, key) => typeof key === 'string' && key in models,
      get: (_target, key) => {
        if (typeof key !== 'string' || key === 'then') return undefined
        const entry = models[key]
        if (typeof entry === 'function') return entry
        const methods = (entry ?? {}) as Record<string, unknown>
        return new Proxy({} as Record<string, unknown>, {
          get: (_inner, method) => {
            if (typeof method !== 'string' || method === 'then') return undefined
            if (methods[method]) return methods[method]
            return () => {
              unstubbedCalls.push({ via, call: `${key}.${method}` })
              throw new Error(`UNSTUBBED_DB_CALL:${key}.${method}`)
            }
          },
        })
      },
    })
  }

  let currentEvaluation: ReturnType<typeof makeEvaluation> | null = null
  const fakePrisma = guardedDb('prisma', {
    evaluation: { findUnique: async () => currentEvaluation },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
      fn(guardedDb('tx', { evaluationItem: { update: async () => ({}) } })),
  })
  stubModule('../src/lib/prisma', { prisma: fakePrisma })

  const submitRoute = await import('../src/app/api/evaluation/[id]/submit/route')
  const { EVALUATION_POLICY_2026 } = await import('../src/lib/evaluation-policy-2026')

  // 제출 라우트를 실제로 실행한다. 항목 검증(일상업무 상한 · 가감점)을 통과하면 트랜잭션 안의 단계 체인 조회에 닿고,
  // 그 첫 DB 호출(employee.findUnique)이 UNSTUBBED_DB_CALL 로 멈춘다.
  async function submit(evaluation: ReturnType<typeof makeEvaluation>, item: Record<string, unknown>) {
    currentEvaluation = evaluation
    unstubbedCalls.length = 0
    const response = await submitRoute.PATCH(
      new Request('http://localhost/api/evaluation/eval-1/submit', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...SUBMIT_BODY, items: [{ personalKpiId: 'kpi-1', ...item }] }),
      }),
      { params: Promise.resolve({ id: 'eval-1' }) }
    )
    const json = (await response.json().catch(() => ({}))) as { error?: { code?: string } }
    return { status: response.status, code: json.error?.code ?? null, unstubbed: [...unstubbedCalls] }
  }
  // 검증을 통과해 다음 단계(단계 체인 조회)에 닿았다는 표시.
  const REACHED_STAGE_CHAIN = [{ via: 'tx', call: 'employee.findUnique' }]

  await run('ⓐ 항목 카테고리가 비고 KPI 가 DAILY_WORK 면 제출 시 일상업무 상한이 걸린다', async () => {
    const result = await submit(makeEvaluation({ itemCategory: null, kpiCategory: 'DAILY_WORK' }), { quantScore: 90 })
    assert.equal(result.status, 400)
    assert.equal(result.code, 'DAILY_WORK_SCORE_CAP_EXCEEDED')
    assert.deepEqual(result.unstubbed, [])
  })

  await run('ⓑ 항목 카테고리가 있으면 KPI 값보다 우선한다', async () => {
    // 항목 ORG_GOAL · KPI DAILY_WORK: 상한 없이 검증을 통과해 단계 체인 조회에 닿는다.
    const result = await submit(makeEvaluation({ itemCategory: 'ORG_GOAL', kpiCategory: 'DAILY_WORK' }), { quantScore: 90 })
    assert.deepEqual(result.unstubbed, REACHED_STAGE_CHAIN)
    // 항목 DAILY_WORK · KPI ORG_GOAL: 항목 값으로 상한이 걸린다.
    const daily = await submit(makeEvaluation({ itemCategory: 'DAILY_WORK', kpiCategory: 'ORG_GOAL' }), { quantScore: 90 })
    assert.equal(daily.code, 'DAILY_WORK_SCORE_CAP_EXCEEDED')
    assert.deepEqual(daily.unstubbed, [])
  })

  await run('ⓒ 둘 다 비면 지금과 같다', async () => {
    const result = await submit(makeEvaluation({ itemCategory: null, kpiCategory: null }), { quantScore: 90 })
    assert.deepEqual(result.unstubbed, REACHED_STAGE_CHAIN)
  })

  await run('ⓔ 가감점 규칙을 켠 상태에서, 항목이 비고 KPI 에 값이 있으면 CATEGORY_REQUIRED 가 나지 않는다', async () => {
    const rule = EVALUATION_POLICY_2026.adjustmentRule as unknown as { active: boolean }
    const previous = rule.active
    rule.active = true
    try {
      const result = await submit(makeEvaluation({ itemCategory: null, kpiCategory: 'ORG_GOAL' }), {
        quantScore: 85,
        adjustmentScore: 3,
        adjustmentReason: '가감점 사유를 적었습니다.',
      })
      assert.notEqual(result.code, 'CATEGORY_REQUIRED')
      // 대조: 둘 다 비면 지금처럼 CATEGORY_REQUIRED 다.
      const empty = await submit(makeEvaluation({ itemCategory: null, kpiCategory: null }), {
        quantScore: 85,
        adjustmentScore: 3,
        adjustmentReason: '가감점 사유를 적었습니다.',
      })
      assert.equal(empty.code, 'CATEGORY_REQUIRED')
    } finally {
      rule.active = previous
    }
  })

  await run('실제 Prisma 로 나간 호출이 없다(prisma 모듈이 끝까지 스텁이다)', () => {
    const prismaPath = require.resolve('../src/lib/prisma')
    assert.equal((require.cache[prismaPath]?.exports as { prisma?: unknown } | undefined)?.prisma, fakePrisma)
  })

  console.log('Evaluation item policy category tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
