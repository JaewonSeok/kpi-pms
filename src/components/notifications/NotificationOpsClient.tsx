'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

type Tab = 'templates' | 'executions' | 'failures' | 'tools' | 'ai'
type Period = 'TODAY' | 'LAST_7_DAYS' | 'LAST_30_DAYS'
type ChannelFilter = 'ALL' | 'IN_APP' | 'EMAIL'
type RunMode = 'all' | 'schedule' | 'dispatch'
type Banner = { tone: 'success' | 'error' | 'info'; message: string }
type AiAction =
  | 'summarize-ops'
  | 'summarize-dead-letters'
  | 'validate-template-variables'
  | 'generate-ops-report'

type Template = {
  id: string
  code: string
  name: string
  type: string
  channel: 'IN_APP' | 'EMAIL'
  subjectTemplate: string
  bodyTemplate: string
  defaultLink?: string | null
  isActive: boolean
  isDigestCompatible: boolean
  updatedAt: string
}

type TemplateDraft = {
  subjectTemplate: string
  bodyTemplate: string
  isActive: boolean
  isDigestCompatible: boolean
  defaultLink: string
}

type JobExecution = {
  id: string
  jobName: string
  status: 'RUNNING' | 'SUCCESS' | 'FAILED' | 'PARTIAL'
  startedAt: string
  finishedAt?: string | null
  processedCount: number
  successCount: number
  failedCount: number
  retriedCount: number
  deadLetterCount: number
  metadata?: Record<string, unknown> | null
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
  channel: 'IN_APP' | 'EMAIL'
  reason: string
  createdAt: string
  payload?: Record<string, unknown> | null
  recipient: {
    empName: string
    gwsEmail: string
  }
  notificationJob: {
    id: string
    templateCode?: string | null
    title?: string | null
    message?: string | null
    retryCount: number
    lastError?: string | null
    payload?: Record<string, unknown> | null
    status?: string | null
    createdAt?: string | null
  }
}

type AiLog = {
  id: string
  sourceType?: string | null
  requestStatus: string
  approvalStatus: string
  errorMessage?: string | null
  createdAt: string
}

type AiPreview = {
  requestLogId: string
  source: 'ai' | 'fallback' | 'disabled'
  result: Record<string, unknown>
  fallbackReason?: string | null
}

const cls = (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(' ')

const parseResponse = <T,>(json: unknown) => {
  const payload = json as { success?: boolean; data?: T; error?: { message?: string } }
  if (!payload.success) {
    throw new Error(payload.error?.message || '요청 처리 중 오류가 발생했습니다.')
  }
  return payload.data as T
}

const toneClass = {
  slate: 'bg-slate-100 text-slate-700 border-slate-200',
  emerald: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  amber: 'bg-amber-100 text-amber-800 border-amber-200',
  red: 'bg-red-100 text-red-700 border-red-200',
  blue: 'bg-blue-100 text-blue-700 border-blue-200',
}

function formatDateTime(value?: string | null) {
  if (!value) return '-'
  return new Date(value).toLocaleString('ko-KR', { hour12: false })
}

function channelLabel(channel: ChannelFilter | 'IN_APP' | 'EMAIL') {
  if (channel === 'IN_APP') return '인앱'
  if (channel === 'EMAIL') return '이메일'
  return '전체'
}

function matchesPeriod(value: string, period: Period) {
  const date = new Date(value)
  const now = new Date()
  if (period === 'TODAY') return date.toDateString() === now.toDateString()
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86_400_000)
  return diffDays <= (period === 'LAST_7_DAYS' ? 7 : 30)
}

function extractVariables(template: string) {
  return Array.from(
    new Set(
      (template.match(/\{\{(\w+)\}\}/g) ?? []).map((item) => item.replace(/[{}]/g, ''))
    )
  )
}

function renderTemplate(template: string, payload: Record<string, unknown>) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) =>
    payload[key] == null || payload[key] === '' ? `{{${key}}}` : String(payload[key])
  )
}

function getExecutionChannel(item: JobExecution): ChannelFilter {
  const channel = typeof item.metadata?.channel === 'string' ? item.metadata.channel : null
  if (channel === 'IN_APP' || channel === 'EMAIL') return channel
  return 'ALL'
}

function getExecutionDuration(item: JobExecution) {
  if (!item.finishedAt) return '-'
  const started = new Date(item.startedAt).getTime()
  const finished = new Date(item.finishedAt).getTime()
  return `${Math.max(0, Math.round((finished - started) / 1000))}초`
}

function getOpsStatus(summary: { successRate: number; failureCount: number; deadLetterCount: number }) {
  if (summary.deadLetterCount > 0 || summary.successRate < 90) return { label: '장애', tone: 'red' as const }
  if (summary.failureCount > 0 || summary.successRate < 98) return { label: '주의', tone: 'amber' as const }
  return { label: '정상', tone: 'emerald' as const }
}

function toTemplateDraft(template: Template): TemplateDraft {
  return {
    subjectTemplate: template.subjectTemplate,
    bodyTemplate: template.bodyTemplate,
    isActive: template.isActive,
    isDigestCompatible: template.isDigestCompatible,
    defaultLink: template.defaultLink ?? '',
  }
}

function StatePanel({
  title,
  description,
  tone = 'slate',
}: {
  title: string
  description: string
  tone?: 'slate' | 'error'
}) {
  return (
    <div
      className={cls(
        'rounded-2xl border p-8 shadow-sm',
        tone === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-slate-200 bg-white text-slate-700'
      )}
    >
      <div className="text-lg font-semibold">{title}</div>
      <p className="mt-2 text-sm">{description}</p>
    </div>
  )
}

function MetricCard({ label, value, helper }: { label: string; value: string; helper?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-sm font-medium text-slate-500">{label}</div>
      <div className="mt-3 text-2xl font-semibold text-slate-900">{value}</div>
      {helper ? <div className="mt-2 text-xs text-slate-500">{helper}</div> : null}
    </div>
  )
}

function Panel({
  title,
  action,
  children,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  )
}

function Split({ left, right }: { left: ReactNode; right: ReactNode }) {
  return <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">{left}{right}</div>
}

function Empty({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
      {message}
    </div>
  )
}

export function NotificationOpsClient() {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<Tab>('templates')
  const [period, setPeriod] = useState<Period>('LAST_7_DAYS')
  const [channel, setChannel] = useState<ChannelFilter>('ALL')
  const [runMode, setRunMode] = useState<RunMode>('all')
  const [banner, setBanner] = useState<Banner | null>(null)
  const [selectedTemplateCode, setSelectedTemplateCode] = useState<string | null>(null)
  const [selectedExecutionId, setSelectedExecutionId] = useState<string | null>(null)
  const [selectedFailureId, setSelectedFailureId] = useState<string | null>(null)
  const [templateDrafts, setTemplateDrafts] = useState<Record<string, TemplateDraft>>({})
  const [previewPayloadText, setPreviewPayloadText] = useState(`{
  "employeeName": "홍길동",
  "cycleName": "2026 상반기",
  "dueDate": "2026-03-31",
  "link": "/evaluation/results"
}`)
  const [aiPreview, setAiPreview] = useState<AiPreview | null>(null)
  const [lastAiAction, setLastAiAction] = useState<AiAction>('summarize-ops')

  const templatesQuery = useQuery({
    queryKey: ['admin-notification-templates'],
    queryFn: async () =>
      parseResponse<Template[]>(await (await fetch('/api/admin/notification-templates', { cache: 'no-store' })).json()),
  })

  const executionsQuery = useQuery({
    queryKey: ['admin-job-executions'],
    queryFn: async () =>
      parseResponse<{ executions: JobExecution[]; queue: QueueSummary }>(
        await (await fetch('/api/admin/job-executions?take=40', { cache: 'no-store' })).json()
      ),
    refetchInterval: 30000,
  })

  const failuresQuery = useQuery({
    queryKey: ['admin-notification-dead-letters'],
    queryFn: async () =>
      parseResponse<DeadLetter[]>(await (await fetch('/api/admin/notification-dead-letters', { cache: 'no-store' })).json()),
    refetchInterval: 30000,
  })

  const aiLogsQuery = useQuery({
    queryKey: ['admin-notification-ai-logs'],
    queryFn: async () =>
      parseResponse<AiLog[]>(await (await fetch('/api/admin/notifications/ai', { cache: 'no-store' })).json()),
  })

  const templates = templatesQuery.data ?? []
  const executions = executionsQuery.data?.executions ?? []
  const queue = executionsQuery.data?.queue ?? { queued: 0, retryPending: 0, deadLetter: 0, suppressed: 0 }
  const failures = failuresQuery.data ?? []

  useEffect(() => {
    if (!templates.length) return
    setTemplateDrafts((current) => {
      const next = { ...current }
      let changed = false
      for (const template of templates) {
        if (!next[template.code]) {
          next[template.code] = toTemplateDraft(template)
          changed = true
        }
      }
      return changed ? next : current
    })
  }, [templates])

  useEffect(() => {
    if (!selectedTemplateCode && templates[0]) setSelectedTemplateCode(templates[0].code)
  }, [selectedTemplateCode, templates])

  useEffect(() => {
    if (!selectedExecutionId && executions[0]) setSelectedExecutionId(executions[0].id)
  }, [executions, selectedExecutionId])

  useEffect(() => {
    if (!selectedFailureId && failures[0]) setSelectedFailureId(failures[0].id)
  }, [failures, selectedFailureId])

  const filteredTemplates = useMemo(() => templates.filter((item) => channel === 'ALL' || item.channel === channel), [channel, templates])
  const filteredExecutions = useMemo(
    () =>
      executions.filter(
        (item) =>
          matchesPeriod(item.startedAt, period) &&
          (channel === 'ALL' || getExecutionChannel(item) === channel || getExecutionChannel(item) === 'ALL')
      ),
    [channel, executions, period]
  )
  const filteredFailures = useMemo(
    () => failures.filter((item) => matchesPeriod(item.createdAt, period) && (channel === 'ALL' || item.channel === channel)),
    [channel, failures, period]
  )

  const summary = useMemo(() => {
    const processed = filteredExecutions.reduce((sum, item) => sum + item.processedCount, 0)
    const success = filteredExecutions.reduce((sum, item) => sum + item.successCount, 0)
    const failureCount = filteredExecutions.reduce((sum, item) => sum + item.failedCount, 0)
    return {
      totalSent: success,
      successRate: processed > 0 ? (success / processed) * 100 : 100,
      failureCount,
      deadLetterCount: filteredFailures.length,
      retryCount24h: executions.filter((item) => matchesPeriod(item.startedAt, 'TODAY')).reduce((sum, item) => sum + item.retriedCount, 0),
      queueBacklog: queue.queued + queue.retryPending,
    }
  }, [executions, filteredExecutions, filteredFailures.length, queue.queued, queue.retryPending])

  const opsStatus = getOpsStatus(summary)
  const currentTemplate = filteredTemplates.find((item) => item.code === selectedTemplateCode) ?? filteredTemplates[0] ?? null
  const currentExecution = filteredExecutions.find((item) => item.id === selectedExecutionId) ?? filteredExecutions[0] ?? null
  const currentFailure = filteredFailures.find((item) => item.id === selectedFailureId) ?? filteredFailures[0] ?? null
  const currentDraft = currentTemplate ? templateDrafts[currentTemplate.code] ?? toTemplateDraft(currentTemplate) : null

  const previewVariables = useMemo(() => {
    try {
      return JSON.parse(previewPayloadText) as Record<string, unknown>
    } catch {
      return {}
    }
  }, [previewPayloadText])

  const previewJsonValid = useMemo(() => {
    try {
      JSON.parse(previewPayloadText)
      return true
    } catch {
      return false
    }
  }, [previewPayloadText])

  const previewVariableList = useMemo(() => {
    if (!currentDraft) return []
    return Array.from(new Set([...extractVariables(currentDraft.subjectTemplate), ...extractVariables(currentDraft.bodyTemplate)]))
  }, [currentDraft])
  const missingPreviewVariables = previewVariableList.filter((key) => previewVariables[key] == null || previewVariables[key] === '')

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        templates: templates.map((template) => {
          const draft = templateDrafts[template.code] ?? toTemplateDraft(template)
          return {
            code: template.code,
            name: template.name,
            type: template.type,
            channel: template.channel,
            subjectTemplate: draft.subjectTemplate,
            bodyTemplate: draft.bodyTemplate,
            defaultLink: draft.defaultLink || undefined,
            isActive: draft.isActive,
            isDigestCompatible: draft.isDigestCompatible,
          }
        }),
      }

      return parseResponse<Template[]>(
        await (
          await fetch('/api/admin/notification-templates', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        ).json()
      )
    },
    onSuccess: (data) => {
      setBanner({ tone: 'success', message: '템플릿 저장이 완료되었습니다.' })
      setTemplateDrafts(Object.fromEntries(data.map((template) => [template.code, toTemplateDraft(template)])))
      void queryClient.invalidateQueries({ queryKey: ['admin-notification-templates'] })
    },
    onError: (error: Error) => setBanner({ tone: 'error', message: error.message }),
  })

  const runMutation = useMutation({
    mutationFn: async () =>
      parseResponse(
        await (
          await fetch('/api/cron/notifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode: runMode }),
          })
        ).json()
      ),
    onSuccess: () => {
      setBanner({ tone: 'success', message: '알림 작업을 즉시 실행했습니다.' })
      void queryClient.invalidateQueries({ queryKey: ['admin-job-executions'] })
      void queryClient.invalidateQueries({ queryKey: ['admin-notification-dead-letters'] })
    },
    onError: (error: Error) => setBanner({ tone: 'error', message: error.message }),
  })

  const failureMutation = useMutation({
    mutationFn: async (params: { action: 'retry' | 'archive'; ids: string[] }) =>
      parseResponse<{ action: 'retry' | 'archive'; count: number }>(
        await (
          await fetch('/api/admin/notification-dead-letters', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params),
          })
        ).json()
      ),
    onSuccess: (data) => {
      setBanner({
        tone: 'success',
        message:
          data.action === 'retry'
            ? `${data.count}건을 재처리 대기열로 이동했습니다.`
            : `${data.count}건을 보관 처리했습니다.`,
      })
      void queryClient.invalidateQueries({ queryKey: ['admin-notification-dead-letters'] })
      void queryClient.invalidateQueries({ queryKey: ['admin-job-executions'] })
    },
    onError: (error: Error) => setBanner({ tone: 'error', message: error.message }),
  })

  const aiMutation = useMutation({
    mutationFn: async (action: AiAction) => {
      setLastAiAction(action)
      const payload = {
        summary,
        queue,
        template: currentTemplate
          ? {
              code: currentTemplate.code,
              subjectTemplate: currentDraft?.subjectTemplate ?? currentTemplate.subjectTemplate,
              bodyTemplate: currentDraft?.bodyTemplate ?? currentTemplate.bodyTemplate,
              defaultLink: currentDraft?.defaultLink ?? currentTemplate.defaultLink,
            }
          : null,
        deadLetter: currentFailure
          ? {
              reason: currentFailure.reason,
              templateCode: currentFailure.notificationJob.templateCode,
              payload: currentFailure.payload ?? currentFailure.notificationJob.payload,
            }
          : null,
        executions: filteredExecutions.slice(0, 10),
        previewVariables,
      }

      const response = await fetch('/api/admin/notifications/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          sourceId: currentTemplate?.id ?? currentFailure?.id ?? 'notification-ops',
          payload,
        }),
      })
      const json = await response.json()
      if (!json.success) {
        throw new Error(json.error?.message || 'AI 요청에 실패했습니다.')
      }
      return json.data as AiPreview
    },
    onSuccess: (data) => {
      setAiPreview(data)
      setTab('ai')
      void queryClient.invalidateQueries({ queryKey: ['admin-notification-ai-logs'] })
    },
    onError: (error: Error) => setBanner({ tone: 'error', message: error.message }),
  })

  const aiDecisionMutation = useMutation({
    mutationFn: async (action: 'approve' | 'reject') => {
      if (!aiPreview) throw new Error('확인할 AI 결과가 없습니다.')
      const response = await fetch(`/api/ai/request-logs/${encodeURIComponent(aiPreview.requestLogId)}/decision`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          approvedPayload: action === 'approve' ? aiPreview.result : undefined,
          rejectionReason: action === 'reject' ? 'Notification ops AI suggestion dismissed by operator.' : undefined,
        }),
      })
      const json = await response.json()
      if (!json.success) {
        throw new Error(json.error?.message || 'AI 검토 처리에 실패했습니다.')
      }
      return json.data
    },
    onSuccess: (_, action) => {
      setAiPreview(null)
      setBanner({
        tone: action === 'approve' ? 'success' : 'info',
        message: action === 'approve' ? 'AI 제안을 승인 처리했습니다.' : 'AI 제안을 반려했습니다.',
      })
      void queryClient.invalidateQueries({ queryKey: ['admin-notification-ai-logs'] })
    },
    onError: (error: Error) => setBanner({ tone: 'error', message: error.message }),
  })

  const updateDraft = (field: keyof TemplateDraft, value: string | boolean) => {
    if (!currentTemplate) return
    setTemplateDrafts((current) => ({
      ...current,
      [currentTemplate.code]: {
        ...(current[currentTemplate.code] ?? toTemplateDraft(currentTemplate)),
        [field]: value,
      },
    }))
  }

  const handleTestSend = () => {
    if (!currentTemplate) return
    if (!previewJsonValid) {
      setBanner({ tone: 'error', message: 'Preview 변수 JSON 형식을 확인해 주세요.' })
      return
    }
    if (missingPreviewVariables.length) {
      setBanner({ tone: 'error', message: `Preview 변수 ${missingPreviewVariables.join(', ')} 값을 채워 주세요.` })
      return
    }
    setBanner({ tone: 'success', message: `${currentTemplate.name} 템플릿 test send를 시뮬레이션했습니다.` })
  }

  if (templatesQuery.isLoading || executionsQuery.isLoading || failuresQuery.isLoading) {
    return (
      <StatePanel
        title="알림 운영 데이터를 불러오는 중입니다."
        description="템플릿, 실행 이력, dead letter 현황을 정리하고 있습니다."
      />
    )
  }

  if (templatesQuery.isError || executionsQuery.isError || failuresQuery.isError) {
    return (
      <StatePanel
        tone="error"
        title="알림 운영 데이터를 불러오지 못했습니다."
        description="잠시 후 다시 시도하거나 알림 관련 API 연결 상태를 확인해 주세요."
      />
    )
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-500">
                Notification Operations Workspace
              </p>
              <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">알림 운영</h1>
              <p className="mt-2 text-sm text-slate-500">
                템플릿 관리부터 발송 모니터링, 실패 복구까지 운영자가 한 화면에서 바로 조치할 수 있는 작업대입니다.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className={cls('rounded-full border px-3 py-1 text-xs font-semibold', toneClass[opsStatus.tone])}>
                {opsStatus.label}
              </span>
              <select value={period} onChange={(event) => setPeriod(event.target.value as Period)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700">
                <option value="TODAY">오늘</option>
                <option value="LAST_7_DAYS">최근 7일</option>
                <option value="LAST_30_DAYS">최근 30일</option>
              </select>
              <select value={channel} onChange={(event) => setChannel(event.target.value as ChannelFilter)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700">
                <option value="ALL">전체</option>
                <option value="IN_APP">인앱</option>
                <option value="EMAIL">이메일</option>
              </select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="총 발송 수" value={summary.totalSent.toLocaleString('ko-KR')} />
              <MetricCard label="성공률" value={`${summary.successRate.toFixed(1)}%`} />
              <MetricCard label="실패 수" value={summary.failureCount.toLocaleString('ko-KR')} />
              <MetricCard label="Dead Letter 수" value={summary.deadLetterCount.toLocaleString('ko-KR')} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:w-[28rem]">
            <button onClick={() => runMutation.mutate()} className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white disabled:opacity-60" disabled={runMutation.isPending}>
              즉시 실행
            </button>
            <button onClick={() => saveMutation.mutate()} className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-medium text-white disabled:opacity-60" disabled={saveMutation.isPending || !templates.length}>
              템플릿 저장
            </button>
            <button onClick={handleTestSend} className="rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700">
              Test Send
            </button>
            <button
              onClick={() => currentFailure && failureMutation.mutate({ action: 'retry', ids: [currentFailure.id] })}
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700 disabled:opacity-60"
              disabled={!currentFailure || failureMutation.isPending}
            >
              Dead Letter 재처리
            </button>
            <button onClick={() => setTab('executions')} className="rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-600 sm:col-span-2">
              실행 이력 보기
            </button>
          </div>
        </div>
      </section>

      {banner ? (
        <div className={cls('rounded-2xl border px-4 py-3 text-sm shadow-sm', banner.tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : banner.tone === 'error' ? 'border-red-200 bg-red-50 text-red-800' : 'border-blue-200 bg-blue-50 text-blue-800')}>
          {banner.message}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="최근 24시간 재시도 수" value={summary.retryCount24h.toLocaleString('ko-KR')} helper="운영 모니터링" />
        <MetricCard label="큐 적체 / 미처리" value={summary.queueBacklog.toLocaleString('ko-KR')} helper={`queued ${queue.queued} / retry ${queue.retryPending}`} />
        <MetricCard label="비활성 템플릿" value={templates.filter((item) => !item.isActive).length.toLocaleString('ko-KR')} helper="즉시 점검 필요" />
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <div className="text-sm font-semibold text-amber-800">다음 행동</div>
          <div className="mt-3 space-y-2 text-sm text-amber-900">
            <div>실패 템플릿 점검</div>
            <div>Dead Letter 재처리</div>
            <div>비활성 템플릿 확인</div>
            <div>Test Send 실행</div>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="inline-flex rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
          {[
            ['templates', '템플릿'],
            ['executions', '실행 이력'],
            ['failures', '실패함'],
            ['tools', '설정 / 도구'],
            ['ai', 'AI 보조'],
          ].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id as Tab)} className={cls('rounded-xl px-4 py-2 text-sm font-medium', tab === id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100')}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'templates' ? (
        <Split
          left={
            <Panel title="템플릿">
              <div className="mb-4 flex flex-wrap gap-2 text-xs text-slate-500">
                <span>채널: {channelLabel(channel)}</span>
                <span>활성 템플릿 {filteredTemplates.filter((item) => item.isActive).length}개</span>
              </div>
              {filteredTemplates.length ? filteredTemplates.map((item) => (
                <button key={item.code} onClick={() => setSelectedTemplateCode(item.code)} className={cls('w-full border-b border-slate-100 px-0 py-4 text-left last:border-b-0', currentTemplate?.code === item.code && 'rounded-xl bg-slate-50 px-3')}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-slate-900">{item.name}</div>
                      <div className="mt-1 text-xs text-slate-500">{item.code} · {channelLabel(item.channel)} · {item.type}</div>
                    </div>
                    <span className={cls('rounded-full border px-2.5 py-1 text-[11px] font-semibold', toneClass[item.isActive ? 'emerald' : 'slate'])}>
                      {item.isActive ? '활성' : '비활성'}
                    </span>
                  </div>
                  <div className="mt-2 line-clamp-2 text-sm text-slate-600">{item.subjectTemplate}</div>
                </button>
              )) : <Empty message="조건에 맞는 템플릿이 없습니다." />}
            </Panel>
          }
          right={
            <Panel title={currentTemplate?.name ?? '템플릿 상세'} action={currentTemplate ? (
              <button onClick={() => aiMutation.mutate('validate-template-variables')} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700">
                AI 변수 점검
              </button>
            ) : null}>
              {currentTemplate && currentDraft ? (
                <div className="space-y-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="space-y-2">
                      <span className="text-sm font-medium text-slate-700">제목 템플릿</span>
                      <input value={currentDraft.subjectTemplate} onChange={(event) => updateDraft('subjectTemplate', event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800" />
                    </label>
                    <label className="space-y-2">
                      <span className="text-sm font-medium text-slate-700">기본 링크</span>
                      <input value={currentDraft.defaultLink} onChange={(event) => updateDraft('defaultLink', event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800" placeholder="/notifications" />
                    </label>
                  </div>

                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-700">본문 템플릿</span>
                    <textarea value={currentDraft.bodyTemplate} onChange={(event) => updateDraft('bodyTemplate', event.target.value)} rows={9} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800" />
                  </label>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-3 text-sm text-slate-700">
                      <input type="checkbox" checked={currentDraft.isActive} onChange={(event) => updateDraft('isActive', event.target.checked)} />
                      활성 상태
                    </label>
                    <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-3 text-sm text-slate-700">
                      <input type="checkbox" checked={currentDraft.isDigestCompatible} onChange={(event) => updateDraft('isDigestCompatible', event.target.checked)} />
                      Digest 가능
                    </label>
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm font-medium text-slate-700">변수 미리보기</div>
                    <textarea value={previewPayloadText} onChange={(event) => setPreviewPayloadText(event.target.value)} rows={6} className="w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-xs text-slate-800" />
                    {!previewJsonValid ? <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">Preview 변수 JSON 형식을 확인해 주세요.</div> : null}
                    {missingPreviewVariables.length ? <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">누락된 변수: {missingPreviewVariables.join(', ')}</div> : null}
                    <div className="flex flex-wrap gap-2">
                      {previewVariableList.map((variable) => (
                        <span key={variable} className={cls('rounded-full px-3 py-1 text-xs', previewVariables[variable] == null || previewVariables[variable] === '' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700')}>
                          {variable}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Preview</div>
                    <div className="mt-3 text-sm font-semibold text-slate-900">{renderTemplate(currentDraft.subjectTemplate, previewVariables)}</div>
                    <div className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{renderTemplate(currentDraft.bodyTemplate, previewVariables)}</div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => saveMutation.mutate()} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60" disabled={saveMutation.isPending}>저장</button>
                    <button onClick={handleTestSend} className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700">Test Send</button>
                  </div>
                </div>
              ) : <Empty message="왼쪽에서 템플릿을 선택해 주세요." />}
            </Panel>
          }
        />
      ) : null}

      {tab === 'executions' ? (
        <Split
          left={
            <Panel title="실행 이력">
              {filteredExecutions.length ? filteredExecutions.map((item) => (
                <button key={item.id} onClick={() => setSelectedExecutionId(item.id)} className={cls('w-full border-b border-slate-100 px-0 py-4 text-left last:border-b-0', currentExecution?.id === item.id && 'rounded-xl bg-slate-50 px-3')}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium text-slate-900">{item.jobName}</div>
                      <div className="mt-1 text-xs text-slate-500">{formatDateTime(item.startedAt)} · {channelLabel(getExecutionChannel(item))}</div>
                    </div>
                    <span className={cls('rounded-full border px-2.5 py-1 text-xs font-semibold', toneClass[item.status === 'SUCCESS' ? 'emerald' : item.status === 'FAILED' ? 'red' : item.status === 'RUNNING' ? 'blue' : 'amber'])}>
                      {item.status}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-4">
                    <span>처리 {item.processedCount}</span>
                    <span>성공 {item.successCount}</span>
                    <span>실패 {item.failedCount}</span>
                    <span>소요 {getExecutionDuration(item)}</span>
                  </div>
                </button>
              )) : <Empty message="선택한 기간의 실행 이력이 없습니다." />}
            </Panel>
          }
          right={
            <Panel title={currentExecution?.jobName ?? '실행 상세'}>
              {currentExecution ? (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <MetricCard label="처리 건수" value={String(currentExecution.processedCount)} />
                    <MetricCard label="성공 건수" value={String(currentExecution.successCount)} />
                    <MetricCard label="실패 건수" value={String(currentExecution.failedCount)} />
                    <MetricCard label="Dead Letter" value={String(currentExecution.deadLetterCount)} />
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                    <div>실행 시각: {formatDateTime(currentExecution.startedAt)}</div>
                    <div className="mt-1">종료 시각: {formatDateTime(currentExecution.finishedAt)}</div>
                    <div className="mt-1">상태: {currentExecution.status}</div>
                  </div>
                  {currentExecution.errorMessage ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{currentExecution.errorMessage}</div> : null}
                  <div>
                    <div className="mb-2 text-sm font-medium text-slate-700">실행 파라미터 / 결과</div>
                    <pre className="overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700">{JSON.stringify(currentExecution.metadata ?? {}, null, 2)}</pre>
                  </div>
                </div>
              ) : <Empty message="실행 이력을 선택해 주세요." />}
            </Panel>
          }
        />
      ) : null}

      {tab === 'failures' ? (
        <Split
          left={
            <Panel
              title="실패함"
              action={filteredFailures.length ? (
                <button
                  onClick={() => failureMutation.mutate({ action: 'retry', ids: filteredFailures.map((item) => item.id) })}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 disabled:opacity-60"
                  disabled={failureMutation.isPending}
                >
                  현재 필터 전체 재처리
                </button>
              ) : null}
            >
              {filteredFailures.length ? filteredFailures.map((item) => (
                <button key={item.id} onClick={() => setSelectedFailureId(item.id)} className={cls('w-full border-b border-slate-100 px-0 py-4 text-left last:border-b-0', currentFailure?.id === item.id && 'rounded-xl bg-slate-50 px-3')}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-slate-900">{item.notificationJob.templateCode ?? item.type}</div>
                      <div className="mt-1 text-xs text-slate-500">{item.recipient.empName} · {channelLabel(item.channel)} · {formatDateTime(item.createdAt)}</div>
                    </div>
                    <span className={cls('rounded-full border px-2.5 py-1 text-xs font-semibold', toneClass.red)}>실패</span>
                  </div>
                  <div className="mt-2 line-clamp-2 text-sm text-slate-600">{item.reason}</div>
                </button>
              )) : <Empty message="선택한 기간의 실패 항목이 없습니다." />}
            </Panel>
          }
          right={
            <Panel title={currentFailure?.notificationJob.templateCode ?? '실패 상세'}>
              {currentFailure ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => failureMutation.mutate({ action: 'retry', ids: [currentFailure.id] })} className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60" disabled={failureMutation.isPending}>재처리</button>
                    <button onClick={() => failureMutation.mutate({ action: 'archive', ids: [currentFailure.id] })} className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700 disabled:opacity-60" disabled={failureMutation.isPending}>무시 / 보관</button>
                    <button onClick={() => aiMutation.mutate('summarize-dead-letters')} className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700">AI 원인 요약</button>
                  </div>
                  <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                    <div className="font-semibold">실패 사유</div>
                    <div className="mt-2">{currentFailure.reason}</div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <MetricCard label="채널" value={channelLabel(currentFailure.channel)} />
                    <MetricCard label="재시도 횟수" value={String(currentFailure.notificationJob.retryCount)} />
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                    <div>수신 대상: {currentFailure.recipient.empName}</div>
                    <div className="mt-1">이메일: {currentFailure.recipient.gwsEmail || '-'}</div>
                    <div className="mt-1">발생 시각: {formatDateTime(currentFailure.createdAt)}</div>
                    <div className="mt-1">관련 템플릿: {currentFailure.notificationJob.templateCode ?? currentFailure.type}</div>
                  </div>
                  <div>
                    <div className="mb-2 text-sm font-medium text-slate-700">Payload / 변수</div>
                    <pre className="overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700">{JSON.stringify(currentFailure.payload ?? currentFailure.notificationJob.payload ?? {}, null, 2)}</pre>
                  </div>
                </div>
              ) : <Empty message="실패 항목을 선택해 주세요." />}
            </Panel>
          }
        />
      ) : null}

      {tab === 'tools' ? (
        <Split
          left={
            <Panel title="설정 / 도구">
              <div className="space-y-5">
                <div className="flex flex-wrap gap-3">
                  <select value={runMode} onChange={(event) => setRunMode(event.target.value as RunMode)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700">
                    <option value="all">전체 실행</option>
                    <option value="schedule">Schedule only</option>
                    <option value="dispatch">Dispatch only</option>
                  </select>
                  <button onClick={() => runMutation.mutate()} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60" disabled={runMutation.isPending}>Run Now</button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <MetricCard label="채널 운영 상태" value={channelLabel(channel)} helper="현재 필터 기준" />
                  <MetricCard label="Suppressed" value={queue.suppressed.toLocaleString('ko-KR')} helper="정책 또는 운영 무시 처리" />
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                  <div className="font-semibold text-slate-900">운영 참고</div>
                  <ul className="mt-3 space-y-2">
                    <li>Retry 정책은 백오프 기반으로 동작합니다.</li>
                    <li>Dead Letter는 변수 누락, 수신 대상 오류, 외부 채널 장애를 우선 점검해 주세요.</li>
                    <li>Quiet Hours 설정이 있으면 일부 이메일 발송이 지연될 수 있습니다.</li>
                  </ul>
                </div>
              </div>
            </Panel>
          }
          right={
            <Panel title="Template Preview / Test Send">
              <div className="space-y-4">
                <textarea value={previewPayloadText} onChange={(event) => setPreviewPayloadText(event.target.value)} rows={8} className="w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-xs text-slate-800" />
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-semibold text-slate-900">{currentDraft ? renderTemplate(currentDraft.subjectTemplate, previewVariables) : '선택한 템플릿이 없습니다.'}</div>
                  <div className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{currentDraft ? renderTemplate(currentDraft.bodyTemplate, previewVariables) : '템플릿을 선택하면 이곳에서 렌더링 결과를 확인할 수 있습니다.'}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={handleTestSend} className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700">Test Send</button>
                  <button onClick={() => aiMutation.mutate('generate-ops-report')} className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700">AI 운영 코멘트 초안</button>
                </div>
              </div>
            </Panel>
          }
        />
      ) : null}

      {tab === 'ai' ? (
        <Split
          left={
            <Panel title="AI 보조">
              <div className="space-y-3">
                {[
                  ['summarize-ops', '실행 이력 요약'],
                  ['summarize-dead-letters', 'Dead Letter 원인 요약'],
                  ['validate-template-variables', '템플릿 변수 점검'],
                  ['generate-ops-report', '운영 보고 코멘트 초안'],
                ].map(([action, label]) => (
                  <button key={action} onClick={() => aiMutation.mutate(action as AiAction)} className="w-full rounded-2xl border border-slate-200 px-4 py-4 text-left hover:bg-slate-50">
                    <div className="font-medium text-slate-900">{label}</div>
                    <div className="mt-1 text-sm text-slate-500">결과는 preview만 제공되며 자동 저장되지 않습니다.</div>
                  </button>
                ))}
              </div>
              <div className="mt-6 space-y-3">
                {(aiLogsQuery.data ?? []).length ? (aiLogsQuery.data ?? []).map((log) => (
                  <div key={log.id} className="rounded-xl border border-slate-200 px-4 py-3">
                    <div className="font-medium text-slate-900">{log.sourceType ?? 'AI 요청'}</div>
                    <div className="mt-1 text-xs text-slate-500">{formatDateTime(log.createdAt)} · {log.requestStatus} · 승인 {log.approvalStatus}</div>
                    {log.errorMessage ? <div className="mt-2 text-xs text-red-600">{log.errorMessage}</div> : null}
                  </div>
                )) : <div className="text-sm text-slate-500">AI 요청 로그가 없습니다.</div>}
              </div>
            </Panel>
          }
          right={
            <Panel title={lastAiAction}>
              {aiPreview ? (
                <div className="space-y-4">
                  {aiPreview.fallbackReason ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Fallback 사유: {aiPreview.fallbackReason}</div> : null}
                  <pre className="overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">{JSON.stringify(aiPreview.result, null, 2)}</pre>
                  <div className="flex gap-2">
                    <button onClick={() => aiDecisionMutation.mutate('reject')} className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700 disabled:opacity-60" disabled={aiDecisionMutation.isPending}>반려</button>
                    <button onClick={() => aiDecisionMutation.mutate('approve')} className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60" disabled={aiDecisionMutation.isPending}>확인</button>
                  </div>
                </div>
              ) : <Empty message="왼쪽에서 AI 도구를 실행하면 preview 결과가 이곳에 표시됩니다." />}
            </Panel>
          }
        />
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Link href="/notifications" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:bg-slate-50">
          <div className="font-semibold text-slate-900">사용자 알림 센터</div>
          <p className="mt-2 text-sm text-slate-500">실제 수신자 관점의 인앱 알림 상태를 확인합니다.</p>
        </Link>
        <Link href="/admin/ops" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:bg-slate-50">
          <div className="font-semibold text-slate-900">운영 / 관제</div>
          <p className="mt-2 text-sm text-slate-500">운영 이벤트와 장애 징후를 함께 점검합니다.</p>
        </Link>
        <Link href="/admin/google-access" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:bg-slate-50">
          <div className="font-semibold text-slate-900">Google 계정 등록</div>
          <p className="mt-2 text-sm text-slate-500">수신 대상 이메일 매핑과 계정 이슈를 점검합니다.</p>
        </Link>
      </div>
    </div>
  )
}
