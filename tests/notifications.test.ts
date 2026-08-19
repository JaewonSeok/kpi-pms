import './setup-test-env'
import './register-path-aliases'
import assert from 'node:assert/strict'
import { NotificationDeliveryChannel, NotificationType, PrismaClient } from '@prisma/client'

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
    getCachedNotificationTemplate,
    invalidateNotificationTemplateCache,
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

  // test ②: allowlist 안 EMAIL → SENT 경로는 sendEmail() 호출 →
  // getEmailTransport()가 실 SMTP 트랜스포트를 반환(FEATURE_EMAIL_DELIVERY 미설정 → defaultValue:true,
  // SMTP_HOST/USER/PASS 모두 .env 설정)하므로 ts-node 직접 실행 환경에서 구조상 불가.

  await run('dispatchDueNotificationJobs — allowlist 밖 EMAIL 잡 1건 → suppressedCount 1 / successCount 0', async () => {
    const prev = process.env.NOTIFICATION_EMAIL_ALLOWLIST
    process.env.NOTIFICATION_EMAIL_ALLOWLIST = 'allowed@example.com'
    try {
      let updateCalled = false
      const mockJob = {
        id: 'j-email-blocked',
        channel: NotificationDeliveryChannel.EMAIL,
        isDigestMember: false,
        digestKey: null,
        recipientId: 'emp-1',
        type: NotificationType.GOAL_REMINDER,
        title: 'Test',
        message: 'Test message',
        link: null,
        templateCode: null,
        payload: null,
        priority: 0,
        retryCount: 0,
        recipient: { id: 'emp-1', empName: '테스트', gwsEmail: 'blocked@test.com' },
      }
      const stubDb = {
        notificationJob: {
          findMany: async () => [mockJob],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          update: async () => { updateCalled = true; return mockJob as any },
        },
      }
      const summary = await dispatchDueNotificationJobs(stubDb as any)
      assert.equal(summary.suppressedCount, 1, 'suppressedCount 는 1 이어야 한다')
      assert.equal(summary.successCount, 0, 'successCount 는 0 이어야 한다')
      assert.equal(summary.processedCount, 1, 'processedCount 는 1 이어야 한다')
      assert.equal(updateCalled, true, 'notificationJob.update 가 SUPPRESSED 처리로 호출돼야 한다')
    } finally {
      process.env.NOTIFICATION_EMAIL_ALLOWLIST = prev
    }
  })

  await run('dispatchDueNotificationJobs — IN_APP 잡 1건 → successCount 1 / suppressedCount 0', async () => {
    const mockJob = {
      id: 'j-inapp-1',
      channel: NotificationDeliveryChannel.IN_APP,
      isDigestMember: false,
      digestKey: null,
      recipientId: 'emp-1',
      type: NotificationType.GOAL_REMINDER,
      title: 'Test',
      message: 'Test message',
      link: null,
      templateCode: null,
      payload: null,
      priority: 0,
      retryCount: 0,
      recipient: { id: 'emp-1', empName: '테스트', gwsEmail: null },
    }
    const txStub = {
      notification: { create: async () => ({}) },
      notificationAttempt: { create: async () => ({}) },
      notificationJob: { update: async () => ({}) },
    }
    const stubDb = {
      notificationJob: { findMany: async () => [mockJob] },
      $transaction: async (fn: (tx: typeof txStub) => Promise<void>) => fn(txStub),
    }
    const summary = await dispatchDueNotificationJobs(stubDb as any)
    assert.equal(summary.successCount, 1, 'successCount 는 1 이어야 한다')
    assert.equal(summary.suppressedCount, 0, 'suppressedCount 는 0 이어야 한다')
    assert.equal(summary.processedCount, 1, 'processedCount 는 1 이어야 한다')
  })

  await run('dispatchDueNotificationJobs — allowlist 밖 digest 그룹 2건 → suppressedCount 2 / successCount 0', async () => {
    const prev = process.env.NOTIFICATION_EMAIL_ALLOWLIST
    process.env.NOTIFICATION_EMAIL_ALLOWLIST = 'allowed@example.com'
    try {
      let updateCallCount = 0
      const makeDigestJob = (id: string) => ({
        id,
        channel: NotificationDeliveryChannel.EMAIL,
        isDigestMember: true,
        digestKey: 'emp-1:2026-08-18',
        recipientId: 'emp-1',
        type: NotificationType.GOAL_REMINDER,
        title: 'Digest test',
        message: 'Test message',
        link: null,
        templateCode: null,
        payload: null,
        priority: 0,
        retryCount: 0,
        recipient: { id: 'emp-1', empName: '테스트', gwsEmail: 'blocked@test.com' },
      })
      const txStub = {
        notificationJob: { update: async () => { updateCallCount += 1; return {} } },
      }
      const stubDb = {
        notificationJob: { findMany: async () => [makeDigestJob('j-d1'), makeDigestJob('j-d2')] },
        $transaction: async (fn: (tx: typeof txStub) => Promise<void>) => fn(txStub),
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const summary = await dispatchDueNotificationJobs(stubDb as any)
      assert.equal(summary.suppressedCount, 2, 'suppressedCount 는 2 이어야 한다')
      assert.equal(summary.successCount, 0, 'successCount 는 0 이어야 한다')
      assert.equal(summary.processedCount, 2, 'processedCount 는 2 이어야 한다')
      assert.equal(updateCallCount, 2, 'notificationJob.update 가 잡 2건 각각 호출돼야 한다')
    } finally {
      process.env.NOTIFICATION_EMAIL_ALLOWLIST = prev
    }
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

  const runAsync = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn()
      console.log(`PASS ${name}`)
    } catch (error) {
      console.error(`FAIL ${name}`)
      throw error
    }
  }

  await runAsync('getCachedNotificationTemplate — 같은 code 2회 호출 → findMany 1회만 실행', async () => {
    invalidateNotificationTemplateCache()
    let findManyCount = 0
    const stubDb = {
      notificationTemplate: {
        findMany: async () => {
          findManyCount++
          return [{ code: 'goal-reminder-email', isActive: true }]
        },
      },
    } as unknown as PrismaClient
    await getCachedNotificationTemplate(stubDb, 'goal-reminder-email')
    await getCachedNotificationTemplate(stubDb, 'goal-reminder-email')
    assert.equal(findManyCount, 1, 'findMany 가 1회를 초과해서 호출됨')
  })

  await runAsync('getCachedNotificationTemplate — 다른 code 연속 호출 → findMany 여전히 1회 (전량 로드)', async () => {
    invalidateNotificationTemplateCache()
    let findManyCount = 0
    const stubDb = {
      notificationTemplate: {
        findMany: async () => {
          findManyCount++
          return [
            { code: 'goal-reminder-email', isActive: true },
            { code: 'goal-reminder-in-app', isActive: true },
          ]
        },
      },
    } as unknown as PrismaClient
    await getCachedNotificationTemplate(stubDb, 'goal-reminder-email')
    await getCachedNotificationTemplate(stubDb, 'goal-reminder-in-app')
    assert.equal(findManyCount, 1, 'findMany 가 1회를 초과해서 호출됨')
  })

  await runAsync('getCachedNotificationTemplate — 존재하지 않는 code → null 반환, throw 없음', async () => {
    invalidateNotificationTemplateCache()
    const stubDb = {
      notificationTemplate: {
        findMany: async () => [{ code: 'other-code', isActive: true }],
      },
    } as unknown as PrismaClient
    const result = await getCachedNotificationTemplate(stubDb, 'non-existent-code')
    assert.equal(result, null)
  })

  await runAsync('getCachedNotificationTemplate — invalidate 후 재호출 → findMany 다시 실행', async () => {
    invalidateNotificationTemplateCache()
    let findManyCount = 0
    const stubDb = {
      notificationTemplate: {
        findMany: async () => {
          findManyCount++
          return [{ code: 'goal-reminder-email', isActive: true }]
        },
      },
    } as unknown as PrismaClient
    await getCachedNotificationTemplate(stubDb, 'goal-reminder-email')
    assert.equal(findManyCount, 1)
    invalidateNotificationTemplateCache()
    await getCachedNotificationTemplate(stubDb, 'goal-reminder-email')
    assert.equal(findManyCount, 2, 'invalidate 후 findMany 가 재실행되지 않음')
  })

  await runAsync('getCachedNotificationTemplate — 갱신 실패 시 stale 캐시 폴백 (null 아님)', async () => {
    invalidateNotificationTemplateCache()
    let shouldThrow = false
    const stubDb = {
      notificationTemplate: {
        findMany: async () => {
          if (shouldThrow) throw new Error('DB unavailable')
          return [{ code: 'goal-reminder-email', isActive: true }]
        },
      },
    } as unknown as PrismaClient
    // 정상 로드로 캐시 채움
    const first = await getCachedNotificationTemplate(stubDb, 'goal-reminder-email')
    assert.notEqual(first, null, '정상 로드 실패')
    // TTL 만료 시뮬레이션: Date.now 가 61초 후 값을 반환하도록 임시 교체
    shouldThrow = true
    const origDateNow = Date.now
    try {
      Date.now = () => origDateNow() + 61_000
      const stale = await getCachedNotificationTemplate(stubDb, 'goal-reminder-email')
      assert.notEqual(stale, null, '갱신 실패 시 stale 캐시를 반환해야 한다 (null 이면 안 됨)')
    } finally {
      Date.now = origDateNow
    }
  })

  console.log('Notification tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
