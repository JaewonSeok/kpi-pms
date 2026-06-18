import assert from 'node:assert/strict'
import {
  createEmptyNotificationsUnreadQueryData,
  fetchNotificationsUnreadQueryData,
  normalizeNotificationsUnreadPayload,
} from '../src/lib/notifications-query'

async function run(name: string, fn: () => Promise<void> | void) {
  try {
    await fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

function jsonResponse(payload: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
}

async function main() {
  await run('empty unread notification query data keeps the expected UI shape', () => {
    assert.deepEqual(createEmptyNotificationsUnreadQueryData(), {
      notifications: [],
      unreadCount: 0,
    })
  })

  await run('unread notification payload normalizer returns empty shape when API data is missing', () => {
    assert.deepEqual(normalizeNotificationsUnreadPayload({ success: true }), {
      notifications: [],
      unreadCount: 0,
    })
  })

  await run('unread notification query returns empty shape for 204 and auth failures', async () => {
    const noContent = await fetchNotificationsUnreadQueryData(async () => new Response(null, { status: 204 }))
    const unauthorized = await fetchNotificationsUnreadQueryData(async () => jsonResponse({ success: false }, { status: 401 }))
    const forbidden = await fetchNotificationsUnreadQueryData(async () => jsonResponse({ success: false }, { status: 403 }))

    assert.deepEqual(noContent, { notifications: [], unreadCount: 0 })
    assert.deepEqual(unauthorized, { notifications: [], unreadCount: 0 })
    assert.deepEqual(forbidden, { notifications: [], unreadCount: 0 })
  })

  await run('unread notification query returns empty shape when response json parsing fails', async () => {
    const data = await fetchNotificationsUnreadQueryData(async () => new Response('not-json', { status: 200 }))

    assert.deepEqual(data, { notifications: [], unreadCount: 0 })
  })

  await run('unread notification query preserves the existing successful data shape', async () => {
    const data = await fetchNotificationsUnreadQueryData(async () =>
      jsonResponse({
        success: true,
        data: {
          notifications: [{ id: 'notification-1' }],
          unreadCount: 1,
        },
      })
    )

    assert.deepEqual(data, {
      notifications: [{ id: 'notification-1' }],
      unreadCount: 1,
    })
  })
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
