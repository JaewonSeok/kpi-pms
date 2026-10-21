import './setup-test-env'
import './register-path-aliases'
import assert from 'node:assert/strict'
import { Prisma } from '@prisma/client'

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

// enqueueLifecycleReminders 는 실행 시각을 new Date() 로 읽는다. 인자 없는 생성과 Date.now 만 고정 시각을 돌려준다.
const RealDate = Date
let fakeNowMs = RealDate.now()
class FakeDate extends RealDate {
  constructor(...args: unknown[]) {
    if (args.length === 0) {
      super(fakeNowMs)
    } else {
      super(...(args as [number, number, number, number, number, number, number]))
    }
  }

  static now() {
    return fakeNowMs
  }
}
globalThis.Date = FakeDate as unknown as DateConstructor

// KST 벽시계 시각을 UTC 로 바꾼다(KST = UTC+9, 서머타임 없음).
function kst(isoLocal: string) {
  return RealDate.parse(`${isoLocal}+09:00`)
}

type PendingEvaluation = { evaluatorId: string; evalStage: string }

// 잡 저장소는 실행 사이에 유지된다. idempotencyKey 가 겹치면 실제 DB 의 unique 제약처럼 P2002 를 던진다.
function createStore() {
  const jobs: Array<{ type: string; recipientId: string; idempotencyKey: string }> = []
  const keys = new Set<string>()
  let pending: PendingEvaluation[] = []

  const db = {
    notificationTemplate: { upsert: async () => ({}) },
    notificationPreference: {
      // EVALUATION_REMINDER 를 mute 해 템플릿 렌더링 없이 SUPPRESSED 잡으로 남긴다. 잡이 생겼는지만 본다.
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
      create: async (args: { data: { type: string; recipientId: string; idempotencyKey: string } }) => {
        if (keys.has(args.data.idempotencyKey)) {
          throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed on idempotencyKey', {
            code: 'P2002',
            clientVersion: 'test',
          })
        }
        keys.add(args.data.idempotencyKey)
        jobs.push({ type: args.data.type, recipientId: args.data.recipientId, idempotencyKey: args.data.idempotencyKey })
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
          evalCycle: { id: 'cycle-1', status: 'FIRST_EVAL' },
        })),
    },
    personalKpi: { findMany: async () => [] },
  }

  const countFor = (evaluatorId: string) =>
    jobs.filter((job) => job.type === 'EVALUATION_REMINDER' && job.recipientId === evaluatorId).length

  return {
    db: db as never,
    countFor,
    setPending: (next: PendingEvaluation[]) => {
      pending = next
    },
  }
}

async function main() {
  const { enqueueLifecycleReminders } = await import('../src/lib/notification-service')

  // 지정한 시각에 한 번 실행하고, 평가자별로 이번 실행에서 새로 생긴 리마인더 수를 돌려준다.
  const runAt = async (store: ReturnType<typeof createStore>, atMs: number, evaluatorIds: string[]) => {
    const before = new Map(evaluatorIds.map((id) => [id, store.countFor(id)]))
    fakeNowMs = atMs
    await enqueueLifecycleReminders(store.db)
    return Object.fromEntries(evaluatorIds.map((id) => [id, store.countFor(id) - (before.get(id) ?? 0)]))
  }

  const PENDING: PendingEvaluation[] = [
    { evaluatorId: 'emp-a', evalStage: 'FIRST' },
    { evaluatorId: 'emp-a', evalStage: 'FIRST' },
    { evaluatorId: 'emp-b', evalStage: 'SECOND' },
  ]
  const EVALUATORS = ['emp-a', 'emp-b']

  await run('ⓐ 같은 주에 여러 번 실행해도 평가자당 1건', async () => {
    const store = createStore()
    store.setPending(PENDING)
    // 2026-10-19(월) ~ 10-23(금), cron 시각(09:00 KST)과 같은 날 재실행
    for (const at of ['2026-10-19T09:00:00', '2026-10-19T09:00:00', '2026-10-19T15:00:00', '2026-10-21T09:00:00', '2026-10-23T09:00:00']) {
      await runAt(store, kst(at), EVALUATORS)
    }
    assert.deepEqual(
      EVALUATORS.map((id) => [id, store.countFor(id)]),
      EVALUATORS.map((id) => [id, 1])
    )
  })

  await run('ⓑ 다음 주 첫 실행에서 다시 1건', async () => {
    const store = createStore()
    store.setPending(PENDING)
    await runAt(store, kst('2026-10-19T09:00:00'), EVALUATORS)
    const nextWeekFirst = await runAt(store, kst('2026-10-26T09:00:00'), EVALUATORS)
    assert.deepEqual(nextWeekFirst, { 'emp-a': 1, 'emp-b': 1 })
  })

  await run('ⓒ 단계명이 바뀌어도 같은 주에는 다시 나가지 않는다', async () => {
    const store = createStore()
    store.setPending([{ evaluatorId: 'emp-a', evalStage: 'SELF' }])
    await runAt(store, kst('2026-10-19T09:00:00'), ['emp-a'])
    // 같은 날 · 같은 주 다른 날에 단계(따라서 단계명)가 바뀐 평가로 실행
    store.setPending([{ evaluatorId: 'emp-a', evalStage: 'FIRST' }])
    const sameDay = await runAt(store, kst('2026-10-19T15:00:00'), ['emp-a'])
    store.setPending([{ evaluatorId: 'emp-a', evalStage: 'CEO_ADJUST' }])
    const laterDay = await runAt(store, kst('2026-10-22T09:00:00'), ['emp-a'])
    assert.deepEqual({ sameDay, laterDay }, { sameDay: { 'emp-a': 0 }, laterDay: { 'emp-a': 0 } })
  })

  await run('ⓓ 주 경계는 KST 기준이다(월요일 09:00 KST 실행은 새 주)', async () => {
    // 시각 확인: 2026-10-26 09:00 KST 는 월요일이고 UTC 로는 같은 날 00:00 이다.
    assert.equal(new RealDate(kst('2026-10-26T09:00:00')).toISOString(), '2026-10-26T00:00:00.000Z')
    assert.equal(new RealDate(kst('2026-10-26T09:00:00') + 9 * 3600 * 1000).getUTCDay(), 1)

    // 금 09:00 KST → 다음 월 09:00 KST: 새 주
    const weekly = createStore()
    weekly.setPending(PENDING)
    await runAt(weekly, kst('2026-10-23T09:00:00'), EVALUATORS)
    const monday0900 = await runAt(weekly, kst('2026-10-26T09:00:00'), EVALUATORS)

    // 일 08:00 KST(UTC 토 23:00) → 월 01:00 KST(UTC 일 16:00): UTC 로는 같은 ISO 주지만 KST 로는 새 주
    const boundary = createStore()
    boundary.setPending(PENDING)
    await runAt(boundary, kst('2026-10-25T08:00:00'), EVALUATORS)
    const mondayEarlyKst = await runAt(boundary, kst('2026-10-26T01:00:00'), EVALUATORS)

    assert.deepEqual(
      { monday0900, mondayEarlyKst },
      { monday0900: { 'emp-a': 1, 'emp-b': 1 }, mondayEarlyKst: { 'emp-a': 1, 'emp-b': 1 } }
    )
  })

  globalThis.Date = RealDate
  console.log('Notification evaluation reminder weekly tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
