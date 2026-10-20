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

type Stage = 'FIRST' | 'SECOND' | 'FINAL' | 'CEO_ADJUST'

const base = (targetId: string, evalStage: Stage) => ({ targetId, targetName: `${targetId}-name`, evalStage })

function buildPlan(overrides: Record<string, unknown> = {}) {
  return {
    evalCycleId: 'cycle-1',
    fingerprint: 'fp-1',
    create: [{ id: 'emp-a:FINAL', ...base('emp-a', 'FINAL'), evaluatorId: 'emp-div', evaluatorName: '본부장' }],
    update: [
      {
        id: 'row-2',
        ...base('emp-a', 'SECOND'),
        beforeEvaluatorId: 'emp-old',
        beforeEvaluatorName: '예전 평가자',
        afterEvaluatorId: 'emp-sec',
        afterEvaluatorName: '실장',
      },
    ],
    delete: [
      { id: 'row-3', ...base('emp-tl', 'FIRST'), beforeEvaluatorId: 'emp-old', beforeEvaluatorName: '예전 평가자', hasInProgressEvaluation: true },
      { id: 'row-4', ...base('emp-c', 'FIRST'), beforeEvaluatorId: 'emp-old', beforeEvaluatorName: '예전 평가자', hasInProgressEvaluation: false },
    ],
    transfer: [
      {
        id: 'eval-1',
        ...base('emp-a', 'FIRST'),
        beforeEvaluatorId: 'emp-old',
        beforeEvaluatorName: '예전 평가자',
        afterEvaluatorId: 'emp-tl',
        afterEvaluatorName: '팀장',
      },
    ],
    unchangedCount: 7,
    preservedManualCount: 2,
    lockedSkipped: [
      { targetId: 'emp-a', evalStage: 'CEO_ADJUST', storedEvaluatorId: 'emp-old', defaultEvaluatorId: 'emp-ceo' },
      { targetId: 'emp-x', evalStage: 'FIRST', storedEvaluatorId: 'emp-unknown', defaultEvaluatorId: null },
    ],
    manualInactive: [{ targetId: 'emp-b', evalStage: 'FIRST', evaluatorId: 'emp-gone' }],
    employeeNames: {
      'emp-a': '김대상',
      'emp-b': '이대상',
      'emp-tl': '팀장',
      'emp-c': '박대상',
      'emp-old': '예전 평가자',
      'emp-ceo': '대표',
      'emp-gone': '퇴사자',
      'emp-div': '본부장',
      'emp-sec': '실장',
    },
    ...overrides,
  }
}

const EMPTY_WRITES = { create: [], update: [], delete: [], transfer: [] }

async function main() {
  const preview = await import('../src/lib/performance-assignment-sync-preview')
  type Plan = Parameters<typeof preview.summarizeSyncPlan>[0]
  const plan = buildPlan() as unknown as Plan

  await run('ⓐ 요약 수치 = 계획 목록 길이', () => {
    assert.deepEqual(preview.summarizeSyncPlan(plan), {
      createCount: 1,
      updateCount: 1,
      deleteCount: 2,
      deleteWithInProgressCount: 1,
      transferCount: 1,
      unchangedCount: 7,
      preservedManualCount: 2,
      lockedSkippedCount: 2,
      manualInactiveCount: 1,
    })
  })

  await run('ⓑ 쓸 것이 없으면 적용할 수 없다', () => {
    assert.equal(preview.canApplySyncPlan(plan), true)
    assert.equal(preview.canApplySyncPlan(buildPlan(EMPTY_WRITES) as unknown as Plan), false)
    // 잠김 · 퇴사자 수동 배정만 있어도 쓸 것은 없다.
    assert.equal(preview.canApplySyncPlan(buildPlan({ ...EMPTY_WRITES, unchangedCount: 9 }) as unknown as Plan), false)
    assert.equal(preview.canApplySyncPlan(null), false)
    // 이관만 있어도 적용할 수 있다.
    assert.equal(preview.canApplySyncPlan(buildPlan({ ...EMPTY_WRITES, transfer: plan.transfer }) as unknown as Plan), true)
  })

  await run('ⓒ 적용 요청의 fingerprint = 미리보기의 fingerprint', async () => {
    const sent: Array<Record<string, unknown>> = []
    const outcome = await preview.applySyncPlan({
      plan,
      evalCycleId: 'cycle-1',
      post: async (body) => {
        sent.push(body)
        return { ok: true, status: 200, data: { result: { syncedCount: 4, transferCount: 1, lockedSkipped: [] }, page: { state: 'ready' } } }
      },
    })
    assert.equal(sent.length, 1)
    assert.deepEqual(sent[0], { action: 'sync', evalCycleId: 'cycle-1', fingerprint: 'fp-1' })
    assert.equal(outcome.kind, 'applied')
  })

  await run('ⓓ 409 를 받으면 미리보기를 다시 부르고, 이전 계획으로 다시 적용하지 않는다', async () => {
    const sent: Array<Record<string, unknown>> = []
    const nextPlan = buildPlan({ fingerprint: 'fp-2' })
    const outcome = await preview.applySyncPlan({
      plan,
      evalCycleId: 'cycle-1',
      post: async (body) => {
        sent.push(body)
        if (body.action === 'sync') {
          return { ok: false, status: 409, error: { code: 'ASSIGNMENT_SYNC_PLAN_CHANGED', message: '바뀜' } }
        }
        return { ok: true, status: 200, data: { plan: nextPlan } }
      },
    })
    assert.deepEqual(
      sent.map((body) => body.action),
      ['sync', 'syncPreview']
    )
    assert.equal(sent.filter((body) => body.action === 'sync').length, 1)
    assert.equal(outcome.kind, 'plan-changed')
    assert.equal(outcome.kind === 'plan-changed' ? outcome.plan?.fingerprint : null, 'fp-2')
  })

  await run('ⓔ 잠김 · 퇴사자 수동 배정 목록이 이름으로 나온다(이름 맵에 없으면 id)', () => {
    const rows = preview.buildSyncPreviewRows(plan, {
      departmentByTargetId: { 'emp-a': '영업팀', 'emp-b': '영업팀' },
      stageLabelByStage: { FIRST: '1차 평가', CEO_ADJUST: '대표 확정' },
    })
    assert.deepEqual(
      rows.locked.map((row) => [row.targetName, row.department, row.stageLabel, row.beforeName, row.afterName]),
      [
        ['김대상', '영업팀', '대표 확정', '예전 평가자', '대표'],
        ['emp-x', '-', '1차 평가', 'emp-unknown', '-'],
      ]
    )
    assert.deepEqual(
      rows.manualInactive.map((row) => [row.targetName, row.department, row.stageLabel, row.beforeName]),
      [['이대상', '영업팀', '1차 평가', '퇴사자']]
    )
    assert.deepEqual(
      rows.writes.find((row) => row.kind === 'update' && row.targetName === '김대상')?.afterName,
      '실장'
    )
  })

  await run('흐름: 미리보기 패널이 요약 · 이름 목록을 그리고, 쓸 것이 없으면 적용 버튼을 막는다', async () => {
    const { PerformanceAssignmentSyncPreviewPanel } = await import('../src/components/admin/PerformanceAssignmentAdminClient')
    const context = { departmentByTargetId: { 'emp-a': '영업팀' }, stageLabelByStage: { FIRST: '1차 평가' } }

    const html = renderToStaticMarkup(
      React.createElement(PerformanceAssignmentSyncPreviewPanel, {
        plan,
        context,
        busy: false,
        onApply: () => undefined,
        onClose: () => undefined,
      })
    )
    // 적용 버튼 태그만 떼어 disabled 속성을 본다(class 의 disabled:opacity-50 과 구분).
    const applyButtonTag = (markup: string) => markup.match(/<button[^>]*data-sync-apply="true"[^>]*>/)?.[0] ?? ''
    assert.equal(html.includes('김대상'), true)
    assert.equal(html.includes('퇴사자'), true)
    assert.equal(html.includes('바뀔 것이 없습니다'), false)
    assert.notEqual(applyButtonTag(html), '')
    assert.equal(/\sdisabled=""/.test(applyButtonTag(html)), false)

    const emptyHtml = renderToStaticMarkup(
      React.createElement(PerformanceAssignmentSyncPreviewPanel, {
        plan: buildPlan(EMPTY_WRITES) as unknown as Plan,
        context,
        busy: false,
        onApply: () => undefined,
        onClose: () => undefined,
      })
    )
    assert.equal(emptyHtml.includes('바뀔 것이 없습니다'), true)
    assert.equal(/\sdisabled=""/.test(applyButtonTag(emptyHtml)), true)
  })

  await run('ⓕ 계획에만 있는 대상(배정 행 없음)도 부서와 단계 라벨이 나온다', async () => {
    const onlyInPlan = buildPlan({
      create: [{ id: 'emp-new:FINAL', ...base('emp-new', 'FINAL'), evaluatorId: 'emp-div', evaluatorName: '본부장' }],
      update: [],
      delete: [],
      transfer: [],
      lockedSkipped: [{ targetId: 'emp-new', evalStage: 'SECOND', storedEvaluatorId: 'emp-old', defaultEvaluatorId: 'emp-sec' }],
      manualInactive: [{ targetId: 'emp-new', evalStage: 'CEO_ADJUST', evaluatorId: 'emp-gone' }],
      employeeNames: { 'emp-new': '신입대상', 'emp-div': '본부장', 'emp-old': '예전 평가자', 'emp-sec': '실장', 'emp-gone': '퇴사자' },
      employeeDepartments: { 'emp-new': '신설팀' },
    }) as unknown as Plan

    // 화면이 쓰는 경로: 계획만으로 맥락을 만든다(배정 행 표에는 emp-new 가 없다).
    const buildContext = (preview as unknown as { buildSyncPreviewContext?: (plan: Plan) => unknown }).buildSyncPreviewContext
    assert.equal(typeof buildContext, 'function')
    const rows = preview.buildSyncPreviewRows(onlyInPlan, buildContext!(onlyInPlan) as never)
    const all = [...rows.writes, ...rows.locked, ...rows.manualInactive]
    assert.deepEqual(
      all.map((row) => [row.kind, row.department, row.stageLabel]),
      [
        ['create', '신설팀', '최종 평가'],
        ['locked', '신설팀', '2차 평가'],
        ['manualInactive', '신설팀', '대표이사 확정'],
      ]
    )

    const { PerformanceAssignmentSyncPreviewPanel } = await import('../src/components/admin/PerformanceAssignmentAdminClient')
    const html = renderToStaticMarkup(
      React.createElement(PerformanceAssignmentSyncPreviewPanel as unknown as React.FC<Record<string, unknown>>, {
        plan: onlyInPlan,
        busy: false,
        onApply: () => undefined,
        onClose: () => undefined,
      })
    )
    assert.equal(html.includes('신설팀'), true)
    assert.equal(html.includes('최종 평가'), true)
    for (const code of ['FIRST', 'SECOND', 'FINAL', 'CEO_ADJUST']) {
      assert.equal(html.includes(`>${code}<`), false, `원래 코드 ${code} 가 그대로 나왔다`)
    }
  })

  console.log('Performance assignment sync preview UI tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
