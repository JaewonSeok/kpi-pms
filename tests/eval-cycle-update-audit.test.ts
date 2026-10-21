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

const d = (iso: string) => new Date(iso)

// 기존 주기. 공개 전 readiness 를 통과하는 일정과 평가 1건을 가진다.
function makeCycle(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cycle-1',
    orgId: 'org-1',
    evalYear: 2026,
    cycleName: '2026 평가',
    showQuestionWeight: true,
    showScoreSummary: true,
    goalEditMode: 'FULL',
    status: 'SELF_EVAL',
    kpiSetupStart: d('2026-01-01T00:00:00.000Z'),
    kpiSetupEnd: d('2026-01-31T00:00:00.000Z'),
    selfEvalStart: d('2026-10-01T00:00:00.000Z'),
    selfEvalEnd: d('2026-10-31T00:00:00.000Z'),
    firstEvalStart: d('2026-11-01T00:00:00.000Z'),
    firstEvalEnd: d('2026-11-15T00:00:00.000Z'),
    secondEvalStart: null,
    secondEvalEnd: null,
    finalEvalStart: d('2026-11-16T00:00:00.000Z'),
    finalEvalEnd: d('2026-11-30T00:00:00.000Z'),
    ceoAdjustStart: null,
    ceoAdjustEnd: null,
    resultOpenStart: d('2026-12-10T00:00:00.000Z'),
    resultOpenEnd: null,
    appealDeadline: d('2026-12-20T00:00:00.000Z'),
    _count: { evaluations: 1 },
    ...overrides,
  }
}

async function main() {
  const auditLogs: Array<{ action: string; entityType: string; entityId: string; oldValue?: Record<string, unknown>; newValue?: Record<string, unknown> }> = []
  stubModule('next-auth', { getServerSession: async () => ({ user: { id: 'emp-admin', role: 'ROLE_ADMIN' } }) })
  stubModule('../src/lib/auth', { authOptions: {} })
  stubModule('../src/lib/audit', {
    createAuditLog: async (entry: (typeof auditLogs)[number]) => {
      auditLogs.push(entry)
    },
    getClientInfo: () => ({}),
    resolveAuditActor: () => ({ userId: 'emp-admin' }),
  })

  const { prisma } = await import('../src/lib/prisma')
  const evalCycle = (prisma as unknown as { evalCycle: Record<string, unknown> }).evalCycle
  const route = await import('../src/app/api/admin/eval-cycles/[id]/route')

  // 실제 prisma 클라이언트의 evalCycle 메서드를 바꿔 끼우고 PATCH 를 실행한다.
  async function patch(body: Record<string, unknown>, cycle = makeCycle()) {
    auditLogs.length = 0
    const updates: Array<Record<string, unknown>> = []
    const saved = { findUnique: evalCycle.findUnique, update: evalCycle.update }
    evalCycle.findUnique = async () => cycle
    evalCycle.update = async (args: { data: Record<string, unknown> }) => {
      updates.push(args.data)
      return { ...cycle, ...args.data, organization: { name: '회사' } }
    }
    try {
      const response = await route.PATCH(
        new Request('http://localhost/api/admin/eval-cycles/cycle-1', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
        { params: Promise.resolve({ id: 'cycle-1' }) }
      )
      const json = (await response.json()) as { success: boolean; data?: Record<string, unknown>; error?: { code?: string } }
      return { status: response.status, json, updates, logs: [...auditLogs] }
    } finally {
      evalCycle.findUnique = saved.findUnique
      evalCycle.update = saved.update
    }
  }

  await run('ⓐ status 를 바꾸면 감사 로그 1건이 남고, 이전 · 이후 status 가 들어간다', async () => {
    const result = await patch({ status: 'FIRST_EVAL' })
    assert.equal(result.status, 200)
    assert.equal(result.logs.length, 1)
    assert.equal(result.logs[0].entityType, 'EvalCycle')
    assert.equal(result.logs[0].entityId, 'cycle-1')
    assert.equal(result.logs[0].oldValue?.status, 'SELF_EVAL')
    assert.equal(result.logs[0].newValue?.status, 'FIRST_EVAL')
  })

  await run('ⓑ 아무 값도 바뀌지 않으면 감사 로그가 없다', async () => {
    const same = await patch({ status: 'SELF_EVAL', cycleName: '2026 평가', selfEvalEnd: '2026-10-31T00:00:00.000Z' })
    assert.equal(same.status, 200)
    assert.equal(same.logs.length, 0)
    const empty = await patch({})
    assert.equal(empty.status, 200)
    assert.equal(empty.logs.length, 0)
  })

  await run('ⓒ 날짜만 바꿔도 그 필드의 이전 · 이후가 남는다', async () => {
    const result = await patch({ selfEvalEnd: '2026-11-05T00:00:00.000Z' })
    assert.equal(result.logs.length, 1)
    assert.equal(result.logs[0].oldValue?.selfEvalEnd, '2026-10-31T00:00:00.000Z')
    assert.equal(result.logs[0].newValue?.selfEvalEnd, '2026-11-05T00:00:00.000Z')
    assert.equal('status' in (result.logs[0].newValue ?? {}), false)
  })

  await run('ⓓ 기존 PATCH 동작(검증 · getReadinessFailures · 응답)은 그대로다', async () => {
    const invalid = await patch({ status: 'NOT_A_STATUS' })
    assert.equal(invalid.status, 400)
    assert.equal(invalid.json.error?.code, 'VALIDATION_ERROR')
    assert.equal(invalid.updates.length, 0)

    const notReady = await patch({ status: 'RESULT_OPEN' }, makeCycle({ appealDeadline: null }))
    assert.equal(notReady.status, 400)
    assert.equal(notReady.json.error?.code, 'CYCLE_NOT_READY')
    assert.equal(notReady.updates.length, 0)
    assert.equal(notReady.logs.length, 0)

    const ok = await patch({ status: 'RESULT_OPEN', cycleName: '이름 변경' })
    assert.equal(ok.status, 200)
    assert.equal(ok.json.success, true)
    assert.deepEqual(ok.updates, [{ cycleName: '이름 변경', status: 'RESULT_OPEN' }])
    assert.equal(ok.json.data?.status, 'RESULT_OPEN')
    assert.equal(ok.json.data?.cycleName, '이름 변경')
  })

  const at = new Date('2026-10-21T00:00:00.000Z')
  const updateLog = { id: 'log-update', action: 'EVAL_CYCLE_UPDATE', entityType: 'EvalCycle', entityId: 'cycle-1', userId: 'emp-admin', oldValue: { status: 'SELF_EVAL' }, newValue: { status: 'FIRST_EVAL' }, timestamp: at }
  const otherLog = { id: 'log-other', action: 'CALIBRATION_LOCKED', entityType: 'EvalCycle', entityId: 'cycle-1', userId: 'emp-admin', oldValue: null, newValue: {}, timestamp: at }

  await run('ⓔ calibration 타임라인에 EVAL_CYCLE_UPDATE 가 나오지 않는다', async () => {
    const calibration = (await import('../src/server/evaluation-calibration')) as unknown as Record<string, unknown>
    const buildTimeline = calibration.buildCalibrationTimeline as undefined | ((params: unknown) => Array<{ id: string }>)
    assert.equal(typeof buildTimeline, 'function', 'buildCalibrationTimeline 을 불러올 수 없다')
    const timeline = buildTimeline!({
      cycle: { id: 'cycle-1', cycleName: '2026 평가', ceoAdjustStart: null, ceoAdjustEnd: null, resultOpenStart: null, status: 'CEO_ADJUST' },
      auditLogs: [updateLog, otherLog],
      groups: [],
      gradeSettings: [],
    })
    assert.deepEqual(timeline.map((item) => item.id), ['log-other'])
  })

  await run('ⓕ 결과 이력에도 나오지 않는다', async () => {
    const results = (await import('../src/server/evaluation-results')) as unknown as Record<string, unknown>
    const buildLogs = results.buildCalibrationLogs as undefined | ((params: unknown) => Array<{ action: string }>)
    assert.equal(typeof buildLogs, 'function', 'buildCalibrationLogs 를 불러올 수 없다')
    const logs = buildLogs!({
      employeeName: '대상자',
      finalStage: 'FINAL',
      draftGrade: null,
      finalGrade: null,
      finalEvaluation: null,
      cycle: { cycleName: '2026 평가', resultOpenStart: null },
      publicationStatus: 'NOT_PUBLISHED',
      calibrationAdjusted: false,
      appealLogs: [],
      auditLogs: [
        { action: 'EVAL_CYCLE_UPDATE', userId: 'emp-admin', timestamp: at },
        { action: 'EVALUATION_RESULT_ACKNOWLEDGED', userId: 'emp-a', timestamp: at },
      ],
    })
    const actions = logs.map((item) => item.action)
    assert.equal(actions.includes('EVAL_CYCLE_UPDATE'), false)
    assert.equal(actions.includes('EVALUATION_RESULT_ACKNOWLEDGED'), true)
  })

  console.log('Eval cycle update audit tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
