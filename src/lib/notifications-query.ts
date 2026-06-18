export type NotificationsUnreadQueryData = {
  notifications: unknown[]
  unreadCount: number
}

type NotificationsApiPayload = {
  success?: boolean
  data?: {
    notifications?: unknown
    unreadCount?: unknown
  }
}

const UNREAD_NOTIFICATIONS_URL = '/api/notifications?unreadOnly=true&pageSize=5'

export function createEmptyNotificationsUnreadQueryData(): NotificationsUnreadQueryData {
  return {
    notifications: [],
    unreadCount: 0,
  }
}

export function normalizeNotificationsUnreadPayload(json: unknown): NotificationsUnreadQueryData {
  const payload = json as NotificationsApiPayload
  if (!payload || payload.success !== true || !payload.data) {
    return createEmptyNotificationsUnreadQueryData()
  }

  return {
    notifications: Array.isArray(payload.data.notifications) ? payload.data.notifications : [],
    unreadCount:
      typeof payload.data.unreadCount === 'number' && Number.isFinite(payload.data.unreadCount)
        ? payload.data.unreadCount
        : 0,
  }
}

export async function fetchNotificationsUnreadQueryData(
  fetcher: typeof fetch = fetch
): Promise<NotificationsUnreadQueryData> {
  try {
    const response = await fetcher(UNREAD_NOTIFICATIONS_URL)

    if (response.status === 204 || response.status === 401 || response.status === 403 || !response.ok) {
      return createEmptyNotificationsUnreadQueryData()
    }

    try {
      return normalizeNotificationsUnreadPayload(await response.json())
    } catch {
      return createEmptyNotificationsUnreadQueryData()
    }
  } catch {
    return createEmptyNotificationsUnreadQueryData()
  }
}
