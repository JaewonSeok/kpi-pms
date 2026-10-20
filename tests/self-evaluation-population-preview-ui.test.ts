import './register-path-aliases'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

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

const kpis = (count: number, prefix: string) =>
  Array.from({ length: count }, (_, index) => ({ id: `${prefix}-k${index + 1}`, kpiName: `${prefix} KPI ${index + 1}`, policyCategory: null }))

function buildPlan(overrides: Record<string, unknown> = {}) {
  return {
    evalCycleId: 'cycle-1',
    cycleStatus: 'SELF_EVAL',
    fingerprint: 'fp-1',
    targetCount: 5,
    create: [
      { employeeId: 'emp-a', employeeName: '김생성', departmentName: '영업팀', personalKpiIds: ['a-k1', 'a-k2'], kpis: kpis(2, 'a') },
      { employeeId: 'emp-d', employeeName: '최생성', departmentName: '지원팀', personalKpiIds: ['d-k1', 'd-k2', 'd-k3'], kpis: kpis(3, 'd') },
    ],
    skippedExisting: [{ employeeId: 'emp-b', employeeName: '이기존', departmentName: '지원팀', evaluationId: 'eval-b', confirmedKpiCount: 1 }],
    noConfirmedKpi: [
      { employeeId: 'emp-c', employeeName: '박미확정', departmentName: '영업팀' },
      { employeeId: 'emp-e', employeeName: '정미확정', departmentName: '기획팀' },
    ],
    ...overrides,
  }
}

async function main() {
  // 모듈이 없을 때도(수정 전) 각 케이스가 FAIL 로 끝나도록 경로 변수로 불러온다.
  const modulePath = '../src/lib/self-evaluation-population-preview'
  const preview = (await import(modulePath).catch(() => null)) as null | {
    summarizePopulationPlan: (plan: unknown) => Record<string, number>
    canRunPopulation: (params: { plan: unknown; cycleStatus: string | null }) => boolean
    runPopulationPlan: (params: {
      plan: unknown
      evalCycleId: string
      post: (body: Record<string, unknown>) => Promise<{ ok: boolean; status: number; data?: unknown; error?: { code?: string; message?: string } }>
    }) => Promise<{ kind: string; plan?: { fingerprint: string } | null }>
    buildPopulationPreviewRows: (plan: unknown) => {
      create: Array<{ name: string; department: string; kpiCount: number }>
      noConfirmedKpi: Array<{ name: string; department: string }>
    }
  }
  const lib = () => {
    assert.ok(preview, 'src/lib/self-evaluation-population-preview 모듈이 없다')
    return preview!
  }
  const plan = buildPlan()

  await run('ⓐ 요약 수치 = 계획 목록 길이 · 항목 합', () => {
    assert.deepEqual(lib().summarizePopulationPlan(plan), {
      createCount: 2,
      createItemCount: 5,
      skippedExistingCount: 1,
      noConfirmedKpiCount: 2,
    })
  })

  await run('ⓑ 사이클이 SELF_EVAL 이 아니거나 생성할 것이 없으면 실행할 수 없다', () => {
    assert.equal(lib().canRunPopulation({ plan, cycleStatus: 'SELF_EVAL' }), true)
    assert.equal(lib().canRunPopulation({ plan, cycleStatus: 'FIRST_EVAL' }), false)
    assert.equal(lib().canRunPopulation({ plan, cycleStatus: null }), false)
    assert.equal(lib().canRunPopulation({ plan: buildPlan({ create: [] }), cycleStatus: 'SELF_EVAL' }), false)
    assert.equal(lib().canRunPopulation({ plan: null, cycleStatus: 'SELF_EVAL' }), false)
  })

  await run('ⓒ 실행 요청의 지문 = 미리보기의 지문', async () => {
    const sent: Array<Record<string, unknown>> = []
    const outcome = await lib().runPopulationPlan({
      plan,
      evalCycleId: 'cycle-1',
      post: async (body) => {
        sent.push(body)
        return { ok: true, status: 200, data: { result: { createdCount: 2, skippedExistingCount: 1, noConfirmedKpiCount: 2 }, page: {} } }
      },
    })
    assert.deepEqual(sent, [{ action: 'population', evalCycleId: 'cycle-1', fingerprint: 'fp-1' }])
    assert.equal(outcome.kind, 'applied')
  })

  await run('ⓓ 409 를 받으면 미리보기를 다시 부르고, 이전 계획으로 다시 실행하지 않는다', async () => {
    const sent: Array<Record<string, unknown>> = []
    const outcome = await lib().runPopulationPlan({
      plan,
      evalCycleId: 'cycle-1',
      post: async (body) => {
        sent.push(body)
        if (body.action === 'population') {
          return { ok: false, status: 409, error: { code: 'SELF_EVALUATION_POPULATION_PLAN_CHANGED', message: '바뀜' } }
        }
        return { ok: true, status: 200, data: { plan: buildPlan({ fingerprint: 'fp-2' }) } }
      },
    })
    assert.deepEqual(sent.map((body) => body.action), ['population', 'populationPreview'])
    assert.equal(outcome.kind, 'plan-changed')
    assert.equal(outcome.plan?.fingerprint, 'fp-2')
  })

  await run('ⓔ 확정 KPI 없음 목록이 이름 · 부서로 나온다', () => {
    const rows = lib().buildPopulationPreviewRows(plan)
    assert.deepEqual(
      rows.noConfirmedKpi.map((row) => [row.name, row.department]),
      [
        ['박미확정', '영업팀'],
        ['정미확정', '기획팀'],
      ]
    )
    assert.deepEqual(
      rows.create.map((row) => [row.name, row.department, row.kpiCount]),
      [
        ['김생성', '영업팀', 2],
        ['최생성', '지원팀', 3],
      ]
    )
  })

  await run('흐름: 패널이 요약 · 목록을 그리고, SELF_EVAL 이 아니면 안내와 함께 실행 버튼을 막는다', async () => {
    const client = (await import('../src/components/admin/PerformanceAssignmentAdminClient')) as unknown as Record<string, unknown>
    const Panel = client.PerformanceAssignmentPopulationPreviewPanel as React.FC<Record<string, unknown>> | undefined
    assert.equal(typeof Panel, 'function', 'PerformanceAssignmentPopulationPreviewPanel 이 없다')
    const runButtonTag = (markup: string) => markup.match(/<button[^>]*data-population-run="true"[^>]*>/)?.[0] ?? ''
    const render = (props: Record<string, unknown>) =>
      renderToStaticMarkup(React.createElement(Panel!, { plan, cycleStatus: 'SELF_EVAL', busy: false, onRun: () => undefined, onClose: () => undefined, ...props }))

    const html = render({})
    for (const text of ['김생성', '최생성', '박미확정', '기획팀']) assert.equal(html.includes(text), true, `${text} 가 없다`)
    assert.equal(/\sdisabled=""/.test(runButtonTag(html)), false)

    const notSelf = render({ cycleStatus: 'FIRST_EVAL' })
    assert.equal(notSelf.includes('자기평가 단계에서만 실행할 수 있습니다'), true)
    assert.equal(/\sdisabled=""/.test(runButtonTag(notSelf)), true)

    const nothing = render({ plan: buildPlan({ create: [] }) })
    assert.equal(/\sdisabled=""/.test(runButtonTag(nothing)), true)
  })

  console.log('Self evaluation population preview UI tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
