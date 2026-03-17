'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDate } from '@/lib/utils'

type NotificationFeed = {
  id: string
  title: string
  message: string
  type: string
  channel: string
  sentAt: string
  isRead: boolean
}

type NotificationPreference = {
  inAppEnabled: boolean
  emailEnabled: boolean
  digestEnabled: boolean
  quietHoursEnabled: boolean
  quietHoursStart?: string
  quietHoursEnd?: string
  timezone: string
  mutedTypes: string[]
}

function parseResponse<T>(json: unknown): T {
  const payload = json as { success?: boolean; data?: T; error?: { message?: string } }
  if (!payload.success) throw new Error(payload.error?.message || '요청 처리에 실패했습니다.')
  return payload.data as T
}

export function NotificationsCenterClient() {
  const queryClient = useQueryClient()
  const [unreadOnly, setUnreadOnly] = useState(false)

  const notificationsQuery = useQuery({
    queryKey: ['notifications', unreadOnly],
    queryFn: async () => {
      const res = await fetch(`/api/notifications?unreadOnly=${unreadOnly}&pageSize=50`)
      return parseResponse<{ notifications: NotificationFeed[]; unreadCount: number }>(await res.json())
    },
  })

  const preferenceQuery = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: async () => {
      const res = await fetch('/api/notifications/preferences')
      return parseResponse<NotificationPreference>(await res.json())
    },
  })

  const preferenceMutation = useMutation({
    mutationFn: async (nextPreference: NotificationPreference) => {
      const res = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nextPreference),
      })
      return parseResponse<NotificationPreference>(await res.json())
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences'] })
      alert('알림 설정이 저장되었습니다.')
    },
    onError: (error: Error) => alert(error.message),
  })

  const readAllMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/notifications/read-all/read', { method: 'PATCH' })
      return parseResponse<{ message: string }>(await res.json())
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const notifications = notificationsQuery.data?.notifications ?? []
  const preference = preferenceQuery.data

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">알림 센터</h1>
          <p className="mt-1 text-sm text-gray-500">in-app 알림 확인, 이메일/소화시간/digest 선호를 관리합니다.</p>
        </div>
        <button
          onClick={() => readAllMutation.mutate()}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm"
        >
          모두 읽음 처리
        </button>
      </div>

      {preference && (
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">내 알림 설정</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Toggle
              label="In-app"
              checked={preference.inAppEnabled}
              onChange={(checked) => preferenceMutation.mutate({ ...preference, inAppEnabled: checked })}
            />
            <Toggle
              label="Email"
              checked={preference.emailEnabled}
              onChange={(checked) => preferenceMutation.mutate({ ...preference, emailEnabled: checked })}
            />
            <Toggle
              label="Digest"
              checked={preference.digestEnabled}
              onChange={(checked) => preferenceMutation.mutate({ ...preference, digestEnabled: checked })}
            />
            <Toggle
              label="Quiet Hours"
              checked={preference.quietHoursEnabled}
              onChange={(checked) => preferenceMutation.mutate({ ...preference, quietHoursEnabled: checked })}
            />
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <input
              value={preference.quietHoursStart ?? ''}
              onChange={(event) =>
                preferenceMutation.mutate({ ...preference, quietHoursStart: event.target.value || undefined })
              }
              placeholder="Quiet start 22:00"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <input
              value={preference.quietHoursEnd ?? ''}
              onChange={(event) =>
                preferenceMutation.mutate({ ...preference, quietHoursEnd: event.target.value || undefined })
              }
              placeholder="Quiet end 07:00"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <input
              value={preference.timezone}
              onChange={(event) =>
                preferenceMutation.mutate({ ...preference, timezone: event.target.value || 'Asia/Seoul' })
              }
              placeholder="Timezone"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">수신 알림</h2>
            <p className="text-sm text-gray-500">미열람 {notificationsQuery.data?.unreadCount ?? 0}건</p>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" checked={unreadOnly} onChange={() => setUnreadOnly((prev) => !prev)} />
            미열람만 보기
          </label>
        </div>
        <div className="divide-y divide-gray-100">
          {notifications.map((notification) => (
            <div key={notification.id} className="px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-medium text-gray-900">{notification.title}</div>
                  <div className="mt-1 text-sm text-gray-600">{notification.message}</div>
                  <div className="mt-2 text-xs text-gray-400">
                    {notification.type} / {notification.channel} / {formatDate(notification.sentAt)}
                  </div>
                </div>
                {!notification.isRead && <span className="rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-700">NEW</span>}
              </div>
            </div>
          ))}
          {!notifications.length && (
            <div className="px-5 py-10 text-center text-sm text-gray-500">표시할 알림이 없습니다.</div>
          )}
        </div>
      </section>
    </div>
  )
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <label className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
      <span className="font-medium text-gray-700">{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  )
}
