'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDate } from '@/lib/utils'

type Template = {
  code: string
  name: string
  type: string
  channel: string
  subjectTemplate: string
  bodyTemplate: string
  isActive: boolean
  isDigestCompatible: boolean
}

type JobExecution = {
  id: string
  jobName: string
  status: string
  startedAt: string
  processedCount: number
  successCount: number
  failedCount: number
  retriedCount: number
  deadLetterCount: number
  suppressedCount: number
  errorMessage?: string | null
}

type QueueSummary = {
  queued: number
  retryPending: number
  deadLetter: number
  suppressed: number
}

type DeadLetter = {
  id: string
  type: string
  channel: string
  reason: string
  createdAt: string
  recipient: {
    empName: string
  }
  notificationJob: {
    retryCount: number
  }
}

function parseResponse<T>(json: unknown): T {
  const payload = json as { success?: boolean; data?: T; error?: { message?: string } }
  if (!payload.success) throw new Error(payload.error?.message || '요청 처리에 실패했습니다.')
  return payload.data as T
}

export function NotificationOpsClient() {
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<'all' | 'schedule' | 'dispatch'>('all')
  const [draftTemplates, setDraftTemplates] = useState<Template[]>([])

  const templatesQuery = useQuery({
    queryKey: ['notification-templates'],
    queryFn: async () => {
      const res = await fetch('/api/admin/notification-templates')
      return parseResponse<Template[]>(await res.json())
    },
  })

  const executionsQuery = useQuery({
    queryKey: ['job-executions'],
    queryFn: async () => {
      const res = await fetch('/api/admin/job-executions')
      return parseResponse<{ executions: JobExecution[]; queue: QueueSummary }>(await res.json())
    },
    refetchInterval: 30000,
  })

  const deadLettersQuery = useQuery({
    queryKey: ['notification-dead-letters'],
    queryFn: async () => {
      const res = await fetch('/api/admin/notification-dead-letters')
      return parseResponse<DeadLetter[]>(await res.json())
    },
  })

  const runMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/cron/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      })
      return parseResponse<{ executionId: string }>(await res.json())
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-executions'] })
      queryClient.invalidateQueries({ queryKey: ['notification-dead-letters'] })
      alert('알림 잡을 실행했습니다.')
    },
    onError: (error: Error) => alert(error.message),
  })

  const saveTemplatesMutation = useMutation({
    mutationFn: async (templates: Template[]) => {
      const res = await fetch('/api/admin/notification-templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templates }),
      })
      return parseResponse<Template[]>(await res.json())
    },
    onSuccess: (templates) => {
      queryClient.setQueryData(['notification-templates'], templates)
      setDraftTemplates([])
      alert('템플릿이 저장되었습니다.')
    },
    onError: (error: Error) => alert(error.message),
  })

  const templates = draftTemplates.length ? draftTemplates : templatesQuery.data ?? []
  const executions = executionsQuery.data?.executions ?? []
  const queue = executionsQuery.data?.queue

  const updateTemplate = (index: number, field: keyof Template, value: string | boolean) => {
    const next = [...templates]
    next[index] = { ...next[index], [field]: value }
    setDraftTemplates(next)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">알림 운영 / JobExecution</h1>
          <p className="mt-1 text-sm text-gray-500">
            템플릿, scheduler/cron 실행, retry/dead-letter 상태를 모니터링합니다.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={mode}
            onChange={(event) => setMode(event.target.value as 'all' | 'schedule' | 'dispatch')}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="all">schedule + dispatch</option>
            <option value="schedule">schedule only</option>
            <option value="dispatch">dispatch only</option>
          </select>
          <button
            onClick={() => runMutation.mutate()}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white"
          >
            지금 실행
          </button>
        </div>
      </div>

      {queue && (
        <div className="grid gap-4 md:grid-cols-4">
          <Metric label="Queued" value={String(queue.queued)} />
          <Metric label="Retry Pending" value={String(queue.retryPending)} />
          <Metric label="Dead Letter" value={String(queue.deadLetter)} />
          <Metric label="Suppressed" value={String(queue.suppressed)} />
        </div>
      )}

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Template 관리</h2>
            <p className="text-sm text-gray-500">in-app + email 채널별 제목/본문 템플릿을 수정할 수 있습니다.</p>
          </div>
          <button
            onClick={() => saveTemplatesMutation.mutate(templates)}
            className="rounded-lg border border-blue-300 px-4 py-2 text-sm text-blue-700"
          >
            템플릿 저장
          </button>
        </div>
        <div className="space-y-4">
          {templates.map((template, index) => (
            <div key={template.code} className="rounded-xl border border-gray-200 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-900">{template.name}</div>
                  <div className="text-xs text-gray-500">
                    {template.code} / {template.type} / {template.channel}
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  active
                  <input
                    type="checkbox"
                    checked={template.isActive}
                    onChange={(event) => updateTemplate(index, 'isActive', event.target.checked)}
                  />
                </label>
              </div>
              <div className="grid gap-3">
                <input
                  value={template.subjectTemplate}
                  onChange={(event) => updateTemplate(index, 'subjectTemplate', event.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
                <textarea
                  value={template.bodyTemplate}
                  onChange={(event) => updateTemplate(index, 'bodyTemplate', event.target.value)}
                  rows={4}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.3fr,1fr]">
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-lg font-semibold text-gray-900">JobExecution 모니터링</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {executions.map((execution) => (
              <div key={execution.id} className="px-5 py-4 text-sm">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-gray-900">
                    {execution.jobName} / {execution.status}
                  </div>
                  <div className="text-xs text-gray-500">{formatDate(execution.startedAt)}</div>
                </div>
                <div className="mt-2 grid gap-2 text-gray-600 md:grid-cols-3">
                  <span>processed {execution.processedCount}</span>
                  <span>success {execution.successCount}</span>
                  <span>failed {execution.failedCount}</span>
                  <span>retried {execution.retriedCount}</span>
                  <span>dead-letter {execution.deadLetterCount}</span>
                  <span>suppressed {execution.suppressedCount}</span>
                </div>
                {execution.errorMessage && <div className="mt-2 text-red-600">{execution.errorMessage}</div>}
              </div>
            ))}
            {!executions.length && <div className="px-5 py-10 text-center text-sm text-gray-500">실행 이력이 없습니다.</div>}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-lg font-semibold text-gray-900">Dead Letter</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {deadLettersQuery.data?.map((item) => (
              <div key={item.id} className="px-5 py-4 text-sm">
                <div className="font-medium text-gray-900">
                  {item.recipient.empName} / {item.type} / {item.channel}
                </div>
                <div className="mt-1 text-gray-600">{item.reason}</div>
                <div className="mt-2 text-xs text-gray-400">
                  retry {item.notificationJob.retryCount} / {formatDate(item.createdAt)}
                </div>
              </div>
            ))}
            {!deadLettersQuery.data?.length && (
              <div className="px-5 py-10 text-center text-sm text-gray-500">현재 dead-letter 항목이 없습니다.</div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-gray-400">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-gray-900">{value}</div>
    </div>
  )
}
