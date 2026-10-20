import './setup-test-env'
import './register-path-aliases'
import assert from 'node:assert/strict'

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

type PendingEvaluation = { evaluatorId: string; evalStage: string; cycleStatus: string }

// 진행 중 평가만 주는 스텁. EVALUATION_REMINDER 를 mute 해 템플릿 렌더링 없이 SUPPRESSED 잡의 payload 를 본다.
function createDb(pending: PendingEvaluation[]) {
  const jobs: Array<{ type: string; recipientId: string; payload: Record<string, unknown> }> = []
  const db = {
    notificationTemplate: { upsert: async () => ({}) },
    notificationPreference: {
      upsert: async (args: { where: { employeeId: string } }) => ({
        employeeId: args.where.employeeId,
        inAppEnabled: true,
        emailEnabled: false,
        digestEnabled: false,
        quietHoursEnabled: false,
        timezone: 'Asia/Seoul',
        mutedTypes: ['EVALUATION_REMINDER'],
      }),
    },
    notificationJob: {
      create: async (args: { data: { type: string; recipientId: string; payload: Record<string, unknown> } }) => {
        jobs.push({ type: args.data.type, recipientId: args.data.recipientId, payload: args.data.payload })
        return { id: `job-${jobs.length}` }
      },
      findMany: async () => [],
    },
    employee: {
      findMany: async () => [],
      findUnique: async (args: { where: { id: string } }) => ({ id: args.where.id, empName: args.where.id, gwsEmail: null }),
    },
    evalCycle: { findMany: async () => [] },
    checkIn: { findMany: async () => [] },
    evaluation: {
      findMany: async () =>
        pending.map((item, index) => ({
          id: `eval-${index + 1}`,
          evaluatorId: item.evaluatorId,
          evalCycleId: 'cycle-1',
          evalStage: item.evalStage,
          status: 'IN_PROGRESS',
          evaluator: { id: item.evaluatorId, empName: item.evaluatorId },
          evalCycle: { id: 'cycle-1', status: item.cycleStatus },
        })),
    },
    personalKpi: { findMany: async () => [] },
  }
  return { db: db as never, jobs }
}

async function main() {
  const { enqueueLifecycleReminders } = await import('../src/lib/notification-service')
  const { EVAL_STAGE_LABELS } = await import('../src/lib/utils')

  const stageLabelsByEvaluator = async (pending: PendingEvaluation[]) => {
    const { db, jobs } = createDb(pending)
    await enqueueLifecycleReminders(db)
    return new Map(
      jobs.filter((job) => job.type === 'EVALUATION_REMINDER').map((job) => [job.recipientId, job.payload.stageLabel])
    )
  }

  await run('ⓐ 리마인더의 단계명은 사이클 상태와 관계없이 그 평가의 단계명이다(SELF_EVAL 사이클의 SECOND 평가)', async () => {
    const labels = await stageLabelsByEvaluator([{ evaluatorId: 'emp-second', evalStage: 'SECOND', cycleStatus: 'SELF_EVAL' }])
    assert.equal(labels.get('emp-second'), EVAL_STAGE_LABELS.SECOND)
  })

  await run('ⓑ 리마인더의 단계명 = EVAL_STAGE_LABELS 의 같은 단계 값', async () => {
    const cases: PendingEvaluation[] = [
      { evaluatorId: 'emp-self', evalStage: 'SELF', cycleStatus: 'SELF_EVAL' },
      { evaluatorId: 'emp-first', evalStage: 'FIRST', cycleStatus: 'FIRST_EVAL' },
      { evaluatorId: 'emp-second', evalStage: 'SECOND', cycleStatus: 'SECOND_EVAL' },
      { evaluatorId: 'emp-final', evalStage: 'FINAL', cycleStatus: 'FINAL_EVAL' },
      { evaluatorId: 'emp-ceo', evalStage: 'CEO_ADJUST', cycleStatus: 'FINAL_EVAL' },
    ]
    const labels = await stageLabelsByEvaluator(cases)
    assert.deepEqual(
      cases.map((item) => [item.evalStage, labels.get(item.evaluatorId)]),
      cases.map((item) => [item.evalStage, EVAL_STAGE_LABELS[item.evalStage]])
    )
  })

  console.log('Notification evaluation reminder stage label tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
