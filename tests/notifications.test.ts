import './setup-test-env'
import './register-path-aliases'
import assert from 'node:assert/strict'
import { NotificationDeliveryChannel, NotificationType } from '@prisma/client'

function run(name: string, fn: () => void) {
  try {
    fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

async function main() {
  const {
    buildNotificationIdempotencyKey,
    getNextAllowedNotificationTime,
    getNextDigestDispatchTime,
    getRetryDelayMinutes,
    isWithinQuietHours,
    toAbsoluteNotificationLink,
    dispatchDueNotificationJobs,
    groupMonthlyKpisByEmployee,
  } = await import('../src/lib/notification-service')
  const { NotificationCronSchema, ManualNotificationSendSchema } = await import('../src/lib/validations')

  run('idempotency key prevents duplicate reminder identity drift', () => {
    const first = buildNotificationIdempotencyKey({
      recipientId: 'emp-1',
      type: NotificationType.GOAL_REMINDER,
      channel: NotificationDeliveryChannel.EMAIL,
      sourceType: 'EvalCycle',
      sourceId: 'cycle-2026',
      dedupeToken: 'goal:2026-12-31',
    })
    const second = buildNotificationIdempotencyKey({
      recipientId: 'emp-1',
      type: NotificationType.GOAL_REMINDER,
      channel: NotificationDeliveryChannel.EMAIL,
      sourceType: 'EvalCycle',
      sourceId: 'cycle-2026',
      dedupeToken: 'goal:2026-12-31',
    })

    assert.equal(first, second)
  })

  run('quiet hours delay delivery to the next allowed time', () => {
    const base = new Date('2026-03-17T14:30:00.000Z')
    const preference = {
      quietHoursEnabled: true,
      quietHoursStart: '22:00',
      quietHoursEnd: '07:00',
      timezone: 'Asia/Seoul',
    }

    assert.equal(isWithinQuietHours(base, preference), true)
    const delayed = getNextAllowedNotificationTime(base, preference)
    assert.equal(delayed.toISOString(), '2026-03-17T22:00:00.000Z')
  })

  run('digest dispatch is scheduled for next 08:00 local time', () => {
    const base = new Date('2026-03-17T02:10:00.000Z')
    const digestAt = getNextDigestDispatchTime(base, 'Asia/Seoul')
    assert.equal(digestAt.toISOString(), '2026-03-17T23:00:00.000Z')
  })

  run('retry policy uses escalating backoff windows', () => {
    assert.equal(getRetryDelayMinutes(0), 5)
    assert.equal(getRetryDelayMinutes(1), 15)
    assert.equal(getRetryDelayMinutes(2), 60)
    assert.equal(getRetryDelayMinutes(5), 60)
  })

  run('notification cron schema accepts targeted goal and checkpoint reminder runs', () => {
    const goalOnly = NotificationCronSchema.parse({
      mode: 'schedule',
      reminderTypes: ['goal'],
    })
    const checkpointOnly = NotificationCronSchema.parse({
      mode: 'schedule',
      reminderTypes: ['checkpoint'],
    })

    assert.deepEqual(goalOnly.reminderTypes, ['goal'])
    assert.deepEqual(checkpointOnly.reminderTypes, ['checkpoint'])
  })

  run('toAbsoluteNotificationLink — 빈 문자열은 빈 문자열 반환', () => {
    assert.equal(toAbsoluteNotificationLink('', 'https://example.com'), '')
    assert.equal(toAbsoluteNotificationLink('   ', 'https://example.com'), '')
  })

  run('toAbsoluteNotificationLink — 상대 경로를 절대 URL로 변환', () => {
    assert.equal(
      toAbsoluteNotificationLink('/kpi/monthly', 'https://kpi-pms.vercel.app'),
      'https://kpi-pms.vercel.app/kpi/monthly'
    )
  })

  run('toAbsoluteNotificationLink — 이미 절대 URL이면 원문 반환 (멱등성)', () => {
    const url = 'https://kpi-pms.vercel.app/evaluation/results'
    assert.equal(toAbsoluteNotificationLink(url, 'https://other.example.com'), url)
  })

  run('toAbsoluteNotificationLink — // 로 시작하면 원문 반환', () => {
    const url = '//cdn.example.com/image.png'
    assert.equal(toAbsoluteNotificationLink(url, 'https://kpi-pms.vercel.app'), url)
  })

  run('toAbsoluteNotificationLink — 잘못된 base URL 로 new URL 이 throw 하면 원문 반환', () => {
    // new URL(link, base) 는 base 가 유효한 절대 URL 이 아니면 throw 한다
    assert.equal(toAbsoluteNotificationLink('/kpi/monthly', 'not-a-valid-base'), '/kpi/monthly')
  })

  await run('dispatchDueNotificationJobs — jobIds 미지정 시 where 에 id 키 없음', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let capturedWhere: any = null
    const stubDb = {
      notificationJob: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        findMany: async (args: any) => { capturedWhere = args.where; return [] },
      },
    }
    await dispatchDueNotificationJobs(stubDb as any)
    assert.notEqual(capturedWhere, null, 'findMany should have been called')
    assert.equal('id' in capturedWhere, false, 'where should not contain id key when jobIds is undefined')
  })

  await run('dispatchDueNotificationJobs — jobIds: [a,b] 시 where.id.in 이 [a,b]', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let capturedWhere: any = null
    const stubDb = {
      notificationJob: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        findMany: async (args: any) => { capturedWhere = args.where; return [] },
      },
    }
    await dispatchDueNotificationJobs(stubDb as any, ['a', 'b'])
    assert.notEqual(capturedWhere, null, 'findMany should have been called')
    assert.deepEqual(capturedWhere.id.in, ['a', 'b'])
  })

  await run('dispatchDueNotificationJobs — jobIds: [] 시 where.id.in 이 []', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let capturedWhere: any = null
    const stubDb = {
      notificationJob: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        findMany: async (args: any) => { capturedWhere = args.where; return [] },
      },
    }
    await dispatchDueNotificationJobs(stubDb as any, [])
    assert.notEqual(capturedWhere, null, 'findMany should have been called')
    assert.deepEqual(capturedWhere.id.in, [])
  })

  run('groupMonthlyKpisByEmployee — KPI 3건 보유 직원 1명 → 대상 1건', () => {
    const input = [
      { employeeId: 'emp-1', employee: { empName: '홍길동' } },
      { employeeId: 'emp-1', employee: { empName: '홍길동' } },
      { employeeId: 'emp-1', employee: { empName: '홍길동' } },
    ]
    const result = groupMonthlyKpisByEmployee(input)
    assert.equal(result.size, 1)
    assert.equal(result.get('emp-1')?.count, 3)
    assert.equal(result.get('emp-1')?.empName, '홍길동')
  })

  run('groupMonthlyKpisByEmployee — 서로 다른 직원 2명 × 각 2건 → 대상 2건', () => {
    const input = [
      { employeeId: 'emp-1', employee: { empName: '홍길동' } },
      { employeeId: 'emp-1', employee: { empName: '홍길동' } },
      { employeeId: 'emp-2', employee: { empName: '김철수' } },
      { employeeId: 'emp-2', employee: { empName: '김철수' } },
    ]
    const result = groupMonthlyKpisByEmployee(input)
    assert.equal(result.size, 2)
    assert.equal(result.get('emp-1')?.count, 2)
    assert.equal(result.get('emp-2')?.count, 2)
  })

  run('groupMonthlyKpisByEmployee — 빈 배열 → 대상 0건', () => {
    const result = groupMonthlyKpisByEmployee([])
    assert.equal(result.size, 0)
  })

  run('ManualNotificationSendSchema — employeeIds 빈 배열 → 실패', () => {
    const result = ManualNotificationSendSchema.safeParse({ employeeIds: [], stage: 'checkpoint', subject: '제목', body: '본문' })
    assert.equal(result.success, false)
  })

  run('ManualNotificationSendSchema — employeeIds 101개 → 실패', () => {
    const ids = Array.from({ length: 101 }, (_, i) => `emp-${i}`)
    const result = ManualNotificationSendSchema.safeParse({ employeeIds: ids, stage: 'checkpoint', subject: '제목', body: '본문' })
    assert.equal(result.success, false)
  })

  run('ManualNotificationSendSchema — employeeIds 100개 → 통과', () => {
    const ids = Array.from({ length: 100 }, (_, i) => `emp-${i}`)
    const result = ManualNotificationSendSchema.safeParse({ employeeIds: ids, stage: 'goal', subject: '제목', body: '본문' })
    assert.equal(result.success, true)
  })

  run('ManualNotificationSendSchema — stage 미지원 값 → 실패', () => {
    const result = ManualNotificationSendSchema.safeParse({ employeeIds: ['emp-1'], stage: 'calibration', subject: '제목', body: '본문' })
    assert.equal(result.success, false)
  })

  run('ManualNotificationSendSchema — subject 빈 문자열 → 실패', () => {
    const result = ManualNotificationSendSchema.safeParse({ employeeIds: ['emp-1'], stage: 'self', subject: '', body: '본문' })
    assert.equal(result.success, false)
  })

  run('ManualNotificationSendSchema — body 빈 문자열 → 실패', () => {
    const result = ManualNotificationSendSchema.safeParse({ employeeIds: ['emp-1'], stage: 'first', subject: '제목', body: '' })
    assert.equal(result.success, false)
  })

  run('ManualNotificationSendSchema — stage 미지원 값(calibration) → 실패', () => {
    const result = ManualNotificationSendSchema.safeParse({ employeeIds: ['emp-1'], stage: 'calibration', subject: '제목', body: '본문' })
    assert.equal(result.success, false)
  })

  run('ManualNotificationSendSchema — 8개 stage 값 전부 통과', () => {
    const stages = ['goal', 'checkpoint', 'self', 'first', 'second', 'final', 'ceo', 'result'] as const
    for (const stage of stages) {
      const result = ManualNotificationSendSchema.safeParse({ employeeIds: ['emp-1'], stage, subject: '제목', body: '본문' })
      assert.equal(result.success, true, `stage=${stage} 통과 실패`)
    }
  })

  run('ManualNotificationSendSchema — stage result 단독 통과', () => {
    const result = ManualNotificationSendSchema.safeParse({ employeeIds: ['emp-1'], stage: 'result', subject: '[성과관리] 평가 결과 확인 안내', body: '본문' })
    assert.equal(result.success, true)
  })

  console.log('Notification tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
