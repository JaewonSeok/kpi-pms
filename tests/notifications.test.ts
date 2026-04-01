import assert from 'node:assert/strict'
import { NotificationDeliveryChannel, NotificationType } from '@prisma/client'

process.env.DATABASE_URL ||= 'postgresql://postgres:password@localhost:5432/kpi_pms'

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
  } = await import('../src/lib/notification-service')
  const { NotificationCronSchema } = await import('../src/lib/validations')

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

  console.log('Notification tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
