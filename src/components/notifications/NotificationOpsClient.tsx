'use client'

import Link from 'next/link'
import { useMemo, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

type Tab = 'templates' | 'executions' | 'failures' | 'tools' | 'ai' | 'manual'
type Period = 'TODAY' | 'LAST_7_DAYS' | 'LAST_30_DAYS'
type Channel = 'ALL' | 'IN_APP' | 'EMAIL'
type RunMode = 'all' | 'schedule' | 'dispatch'
type ReminderType = 'goal' | 'checkpoint'
type Banner = { tone: 'success' | 'error' | 'info'; message: string }
type AiAction = 'summarize-ops' | 'summarize-dead-letters' | 'validate-template-variables' | 'generate-ops-report'

type ManualEmployee = {
  id: string
  empId: string
  empName: string
  department: { deptName: string }
}

type ManualStage = 'goal' | 'checkpoint' | 'self' | 'first' | 'second' | 'final' | 'ceo' | 'result'

const STAGE_LABELS: { value: ManualStage; label: string }[] = [
  { value: 'goal',       label: '1. 목표 수립' },
  { value: 'checkpoint', label: '2. 중간 점검' },
  { value: 'self',       label: '3. 자기평가' },
  { value: 'first',      label: '4. 1차 평가' },
  { value: 'second',     label: '5. 2차 평가' },
  { value: 'final',      label: '6. 최종 평가' },
  { value: 'ceo',        label: '7. 대표이사 확정' },
  { value: 'result',     label: '8. 결과 확인' },
]

const STAGE_DEFAULTS: Record<ManualStage, { subject: string; body: string }> = {
  goal:       { subject: '[성과관리] 목표 수립 안내',   body: '{{employeeName}}님,\n\n목표/KPI 수립이 필요합니다.\n기한 내 입력해 주세요.\n\n{{link}}' },
  checkpoint: { subject: '[성과관리] 월간 점검 안내',   body: '{{employeeName}}님,\n\n월간 점검/실적 입력이 필요합니다.\n\n{{link}}' },
  self:       { subject: '[성과관리] 자기평가 안내',     body: '{{employeeName}}님,\n\n자기평가 작성이 필요합니다.\n\n{{link}}' },
  first:      { subject: '[성과관리] 1차 평가 안내',     body: '{{employeeName}}님,\n\n담당 팀원에 대한 1차 평가가 필요합니다.\n\n{{link}}' },
  second:     { subject: '[성과관리] 2차 평가 안내',     body: '{{employeeName}}님,\n\n담당 팀원에 대한 2차 평가가 필요합니다.\n\n{{link}}' },
  final:      { subject: '[성과관리] 최종 평가 안내',     body: '{{employeeName}}님,\n\n최종 평가가 필요합니다.\n\n{{link}}' },
  ceo:        { subject: '[성과관리] 평가 확정 안내',     body: '{{employeeName}}님,\n\n평가 확정 절차가 필요합니다.\n\n{{link}}' },
  result:     { subject: '[성과관리] 평가 결과 확인 안내', body: '{{employeeName}}님,\n\n평가 결과가 확정되었습니다.\n아래에서 확인해 주세요.\n\n{{link}}' },
}

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
  defaultLink: string
  isActive: boolean
  isDigestCompatible: boolean
}

type JobExecution = {
  id: string
  jobName: string
  status: string
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

const EMPTY_TEMPLATES: Template[] = []
const EMPTY_EXECUTIONS: JobExecution[] = []
const EMPTY_QUEUE: QueueSummary = { queued: 0, retryPending: 0, deadLetter: 0, suppressed: 0 }

type DeadLetter = {
  id: string
  type: string
  channel: 'IN_APP' | 'EMAIL'
  reason: string
  createdAt: string
  payload?: Record<string, unknown> | null
  recipient: { empName: string; gwsEmail: string }
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

const EMPTY_FAILURES: DeadLetter[] = []

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
  fallbackReason?: string | null
  result: Record<string, unknown>
}

const cls = (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(' ')
const formatDateTime = (value?: string | null) => (value ? new Date(value).toLocaleString('ko-KR', { hour12: false }) : '-')
const channelLabel = (channel: Channel | 'IN_APP' | 'EMAIL') => (channel === 'IN_APP' ? '인앱' : channel === 'EMAIL' ? '이메일' : '전체')
const parseJson = <T,>(json: unknown) => {
  const payload = json as { success?: boolean; data?: T; error?: { message?: string } }
  if (!payload.success) throw new Error(payload.error?.message || '요청을 처리하지 못했습니다.')
  return payload.data as T
}

function matchesPeriod(value: string, period: Period) {
  const target = new Date(value)
  const now = new Date()
  if (period === 'TODAY') return target.toDateString() === now.toDateString()
  const diffDays = Math.floor((now.getTime() - target.getTime()) / 86_400_000)
  return diffDays <= (period === 'LAST_7_DAYS' ? 7 : 30)
}

function extractVariables(template: string) {
  return Array.from(new Set((template.match(/\{\{(\w+)\}\}/g) ?? []).map((item) => item.replace(/[{}]/g, ''))))
}

function renderTemplate(template: string, payload: Record<string, unknown>) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => payload[key] == null || payload[key] === '' ? `{{${key}}}` : String(payload[key]))
}

function toDraft(template: Template): TemplateDraft {
  return {
    subjectTemplate: template.subjectTemplate,
    bodyTemplate: template.bodyTemplate,
    defaultLink: template.defaultLink ?? '',
    isActive: template.isActive,
    isDigestCompatible: template.isDigestCompatible,
  }
}
export function NotificationOpsClient() {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<Tab>('templates')
  const [period, setPeriod] = useState<Period>('LAST_7_DAYS')
  const [channel, setChannel] = useState<Channel>('ALL')
  const [runMode, setRunMode] = useState<RunMode>('all')
  const [banner, setBanner] = useState<Banner | null>(null)
  const [selectedTemplateCode, setSelectedTemplateCode] = useState<string | null>(null)
  const [selectedExecutionId, setSelectedExecutionId] = useState<string | null>(null)
  const [selectedFailureId, setSelectedFailureId] = useState<string | null>(null)
  const [templateDrafts, setTemplateDrafts] = useState<Record<string, TemplateDraft>>({})
  const [previewPayloadText, setPreviewPayloadText] = useState(`{\n  "employeeName": "홍길동",\n  "cycleName": "2026 상반기",\n  "dueDate": "2026-03-31",\n  "link": "/evaluation/results"\n}`)
  const [aiPreview, setAiPreview] = useState<AiPreview | null>(null)
  const [lastAiAction, setLastAiAction] = useState<AiAction>('summarize-ops')
  const [manualDeptFilter, setManualDeptFilter] = useState<string>('ALL')
  const [manualNameSearch, setManualNameSearch] = useState<string>('')
  const [manualSelectedIds, setManualSelectedIds] = useState<Set<string>>(new Set())
  const [manualStage, setManualStage] = useState<ManualStage>('checkpoint')
  const [manualSubject, setManualSubject] = useState<string>(STAGE_DEFAULTS.checkpoint.subject)
  const [manualBody, setManualBody] = useState<string>(STAGE_DEFAULTS.checkpoint.body)
  const [manualResult, setManualResult] = useState<{ queuedCount: number; suppressedCount: number; duplicateCount: number } | null>(null)

  const templatesQuery = useQuery({
    queryKey: ['admin-notification-templates'],
    queryFn: async () => parseJson<Template[]>(await (await fetch('/api/admin/notification-templates', { cache: 'no-store' })).json()),
  })

  const executionsQuery = useQuery({
    queryKey: ['admin-job-executions'],
    queryFn: async () => parseJson<{ executions: JobExecution[]; queue: QueueSummary }>(await (await fetch('/api/admin/job-executions?take=40', { cache: 'no-store' })).json()),
    refetchInterval: 30000,
  })

  const failuresQuery = useQuery({
    queryKey: ['admin-notification-dead-letters'],
    queryFn: async () => parseJson<DeadLetter[]>(await (await fetch('/api/admin/notification-dead-letters', { cache: 'no-store' })).json()),
    refetchInterval: 30000,
  })

  const aiLogsQuery = useQuery({
    queryKey: ['admin-notification-ai-logs'],
    queryFn: async () => parseJson<AiLog[]>(await (await fetch('/api/admin/notifications/ai', { cache: 'no-store' })).json()),
  })

  const manualEmployeesQuery = useQuery({
    queryKey: ['admin-manual-notification-employees'],
    queryFn: async () => parseJson<ManualEmployee[]>(await (await fetch('/api/admin/notifications/manual-send', { cache: 'no-store' })).json()),
    enabled: tab === 'manual',
  })

  const templates = templatesQuery.data ?? EMPTY_TEMPLATES
  const executions = executionsQuery.data?.executions ?? EMPTY_EXECUTIONS
  const queue = executionsQuery.data?.queue ?? EMPTY_QUEUE
  const failures = failuresQuery.data ?? EMPTY_FAILURES

  const manualFilteredEmployees = useMemo(() => {
    const all = manualEmployeesQuery.data ?? []
    return all.filter((e) =>
      (manualDeptFilter === 'ALL' || e.department.deptName === manualDeptFilter) &&
      (!manualNameSearch.trim() || e.empName.includes(manualNameSearch.trim()))
    )
  }, [manualDeptFilter, manualNameSearch, manualEmployeesQuery.data])

  const manualAllDepts = useMemo(() => {
    const all = manualEmployeesQuery.data ?? []
    return Array.from(new Set(all.map((e) => e.department.deptName))).sort()
  }, [manualEmployeesQuery.data])

  const filteredTemplates = useMemo(() => templates.filter((item) => channel === 'ALL' || item.channel === channel), [channel, templates])
  const filteredExecutions = useMemo(() => executions.filter((item) => matchesPeriod(item.startedAt, period)), [executions, period])
  const filteredFailures = useMemo(() => failures.filter((item) => matchesPeriod(item.createdAt, period) && (channel === 'ALL' || item.channel === channel)), [channel, failures, period])
  const defaultTemplateDrafts = useMemo(
    () => Object.fromEntries(templates.map((template) => [template.code, toDraft(template)])),
    [templates]
  )

  const effectiveTemplateCode = selectedTemplateCode ?? filteredTemplates[0]?.code ?? null
  const effectiveExecutionId = selectedExecutionId ?? filteredExecutions[0]?.id ?? null
  const effectiveFailureId = selectedFailureId ?? filteredFailures[0]?.id ?? null
  const currentTemplate = filteredTemplates.find((item) => item.code === effectiveTemplateCode) ?? filteredTemplates[0] ?? null
  const currentDraft = currentTemplate ? templateDrafts[currentTemplate.code] ?? defaultTemplateDrafts[currentTemplate.code] : null
  const currentExecution = filteredExecutions.find((item) => item.id === effectiveExecutionId) ?? filteredExecutions[0] ?? null
  const currentFailure = filteredFailures.find((item) => item.id === effectiveFailureId) ?? filteredFailures[0] ?? null

  const previewJsonValid = useMemo(() => {
    try {
      JSON.parse(previewPayloadText)
      return true
    } catch {
      return false
    }
  }, [previewPayloadText])

  const previewVariables = useMemo(() => {
    try {
      return JSON.parse(previewPayloadText) as Record<string, unknown>
    } catch {
      return {}
    }
  }, [previewPayloadText])

  const missingPreviewVariables = useMemo(() => {
    if (!currentDraft) return []
    const variables = Array.from(new Set([...extractVariables(currentDraft.subjectTemplate), ...extractVariables(currentDraft.bodyTemplate)]))
    return variables.filter((key) => previewVariables[key] == null || previewVariables[key] === '')
  }, [currentDraft, previewVariables])

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

  const saveMutation = useMutation({
    mutationFn: async () => parseJson<Template[]>(await (await fetch('/api/admin/notification-templates', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ templates: templates.map((template) => ({ code: template.code, name: template.name, type: template.type, channel: template.channel, ...(templateDrafts[template.code] ?? defaultTemplateDrafts[template.code] ?? toDraft(template)) })) }) })).json()),
    onSuccess: (data) => {
      setTemplateDrafts(Object.fromEntries(data.map((template) => [template.code, toDraft(template)])))
      setBanner({ tone: 'success', message: '템플릿을 저장했습니다.' })
      void queryClient.invalidateQueries({ queryKey: ['admin-notification-templates'] })
    },
    onError: (error: Error) => setBanner({ tone: 'error', message: error.message }),
  })

  const runMutation = useMutation({
    mutationFn: async (input: { mode: RunMode; reminderTypes?: ReminderType[]; successMessage: string }) =>
      parseJson(
        await (
          await fetch('/api/cron/notifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              mode: input.mode,
              reminderTypes: input.reminderTypes,
            }),
          })
        ).json()
      ),
    onSuccess: (_data, input) => {
      setBanner({ tone: 'success', message: input.successMessage })
      void queryClient.invalidateQueries({ queryKey: ['admin-job-executions'] })
      void queryClient.invalidateQueries({ queryKey: ['admin-notification-dead-letters'] })
    },
    onError: (error: Error) => setBanner({ tone: 'error', message: error.message }),
  })

  const failureMutation = useMutation({
    mutationFn: async (params: { action: 'retry' | 'archive'; ids: string[] }) => parseJson<{ action: 'retry' | 'archive'; count: number }>(await (await fetch('/api/admin/notification-dead-letters', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params) })).json()),
    onSuccess: (data) => {
      setBanner({ tone: 'success', message: data.action === 'retry' ? `${data.count}건을 재처리 큐로 이동했습니다.` : `${data.count}건을 보관 처리했습니다.` })
      void queryClient.invalidateQueries({ queryKey: ['admin-notification-dead-letters'] })
      void queryClient.invalidateQueries({ queryKey: ['admin-job-executions'] })
    },
    onError: (error: Error) => setBanner({ tone: 'error', message: error.message }),
  })

  const testSendMutation = useMutation({
    mutationFn: async () => {
      if (!currentTemplate || !currentDraft) throw new Error('테스트 발송할 템플릿을 먼저 선택해 주세요.')
      return parseJson<{ jobId: string; channel: 'IN_APP' | 'EMAIL'; recipientName: string; recipientEmail: string }>(await (await fetch('/api/admin/notification-templates/test-send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: currentTemplate.code, name: currentTemplate.name, type: currentTemplate.type, channel: currentTemplate.channel, subjectTemplate: currentDraft.subjectTemplate, bodyTemplate: currentDraft.bodyTemplate, defaultLink: currentDraft.defaultLink || undefined, previewPayload: previewVariables }) })).json())
    },
    onSuccess: (data) => {
      setBanner({ tone: 'success', message: data.channel === 'EMAIL' ? `${data.recipientName}(${data.recipientEmail || '이메일 미등록'})에게 테스트 이메일을 발송하고 이력을 남겼습니다.` : `${data.recipientName}에게 인앱 테스트 알림을 발송하고 이력을 남겼습니다.` })
      void queryClient.invalidateQueries({ queryKey: ['admin-job-executions'] })
      void queryClient.invalidateQueries({ queryKey: ['admin-notification-dead-letters'] })
    },
    onError: (error: Error) => setBanner({ tone: 'error', message: error.message }),
  })

  const aiMutation = useMutation({
    mutationFn: async (action: AiAction) => {
      setLastAiAction(action)
      return parseJson<AiPreview>(await (await fetch('/api/admin/notifications/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, sourceId: currentTemplate?.id ?? currentFailure?.id ?? 'notification-ops', payload: { summary, queue, template: currentTemplate ? { code: currentTemplate.code, subjectTemplate: currentDraft?.subjectTemplate ?? currentTemplate.subjectTemplate, bodyTemplate: currentDraft?.bodyTemplate ?? currentTemplate.bodyTemplate, defaultLink: currentDraft?.defaultLink ?? currentTemplate.defaultLink } : null, deadLetter: currentFailure ? { reason: currentFailure.reason, templateCode: currentFailure.notificationJob.templateCode, payload: currentFailure.payload ?? currentFailure.notificationJob.payload } : null, executions: filteredExecutions.slice(0, 10), previewVariables } }) })).json())
    },
    onSuccess: (data) => {
      setAiPreview(data)
      setTab('ai')
      void queryClient.invalidateQueries({ queryKey: ['admin-notification-ai-logs'] })
    },
    onError: (error: Error) => setBanner({ tone: 'error', message: error.message }),
  })

  const manualSendMutation = useMutation({
    mutationFn: async (input: { employeeIds: string[]; stage: ManualStage; subject: string; body: string }) => {
      const label = STAGE_LABELS.find((s) => s.value === input.stage)?.label ?? input.stage
      if (!window.confirm(`선택한 ${input.employeeIds.length}명에게 [${label}] 알림을 발송합니다. 되돌릴 수 없습니다. 계속할까요?`)) {
        throw new Error('CANCELLED')
      }
      return parseJson<{ queuedCount: number; suppressedCount: number; duplicateCount: number }>(
        await (
          await fetch('/api/admin/notifications/manual-send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
          })
        ).json()
      )
    },
    onSuccess: (data) => {
      setManualResult(data)
      setManualSelectedIds(new Set())
      setBanner({ tone: 'success', message: `${data.queuedCount}건 큐 등록, ${data.suppressedCount}건 억제, ${data.duplicateCount}건 중복 스킵` })
    },
    onError: (error: Error) => {
      if (error.message !== 'CANCELLED') setBanner({ tone: 'error', message: error.message })
    },
  })

  const aiDecisionMutation = useMutation({
    mutationFn: async (action: 'approve' | 'reject') => {
      if (!aiPreview) throw new Error('AI 미리보기가 없습니다.')
      return parseJson(await (await fetch(`/api/ai/request-logs/${aiPreview.requestLogId}/decision`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, approvedPayload: action === 'approve' ? aiPreview.result : undefined, rejectionReason: action === 'reject' ? 'User rejected notification ops AI result.' : undefined }) })).json())
    },
    onSuccess: (_data, action) => {
      setBanner({ tone: 'success', message: action === 'approve' ? 'AI preview를 승인했습니다.' : 'AI preview를 반려했습니다.' })
      setAiPreview(null)
      void queryClient.invalidateQueries({ queryKey: ['admin-notification-ai-logs'] })
    },
    onError: (error: Error) => setBanner({ tone: 'error', message: error.message }),
  })

  function updateDraft<K extends keyof TemplateDraft>(key: K, value: TemplateDraft[K]) {
    if (!currentTemplate) return
    setTemplateDrafts((current) => ({ ...current, [currentTemplate.code]: { ...(current[currentTemplate.code] ?? toDraft(currentTemplate)), [key]: value } }))
  }

  function handleTestSend() {
    if (!previewJsonValid) {
      setBanner({ tone: 'error', message: '미리보기 변수 JSON 형식을 확인해 주세요.' })
      return
    }
    if (missingPreviewVariables.length) {
      setBanner({ tone: 'error', message: `누락된 변수: ${missingPreviewVariables.join(', ')}` })
      return
    }
    testSendMutation.mutate()
  }

  function handleRunJob(input: { mode: RunMode; reminderTypes?: ReminderType[]; successMessage: string }) {
    runMutation.mutate(input)
  }

  const loading = templatesQuery.isLoading || executionsQuery.isLoading || failuresQuery.isLoading
  const statusTone = summary.deadLetterCount > 0 || summary.successRate < 90 ? 'error' : summary.failureCount > 0 || summary.successRate < 98 ? 'warn' : 'ok'

  if (loading && !templates.length && !executions.length && !failures.length) {
    return <StatePanel title="알림 운영을 불러오는 중입니다" description="템플릿, 실행 이력, 실패함 데이터를 준비하고 있습니다." tone="slate" />
  }

  if (templatesQuery.isError || executionsQuery.isError || failuresQuery.isError) {
    return <StatePanel title="알림 운영 화면을 불러오지 못했습니다" description="잠시 후 다시 시도하거나 관리자 권한과 서버 상태를 확인해 주세요." tone="error" />
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className={cls('rounded-full border px-3 py-1 text-xs font-semibold', statusTone === 'ok' ? 'border-emerald-200 bg-emerald-100 text-emerald-700' : statusTone === 'warn' ? 'border-amber-200 bg-amber-100 text-amber-800' : 'border-red-200 bg-red-100 text-red-700')}>
                {statusTone === 'ok' ? '정상' : statusTone === 'warn' ? '주의' : '장애'}
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">알림 운영 콘솔</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">알림 운영</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">템플릿 관리, 실행 이력, 실패 원인 분석, 실패함 복구까지 한 화면에서 운영합니다.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="총 발송 알림" value={`${summary.totalSent.toLocaleString('ko-KR')}건`} />
              <MetricCard label="발송 성공 비율" value={`${Math.round(summary.successRate * 10) / 10}%`} helper="전체 처리 알림 기준" />
              <MetricCard label="실패 알림" value={`${summary.failureCount.toLocaleString('ko-KR')}건`} />
              <MetricCard label="실패함 알림" value={`${summary.deadLetterCount.toLocaleString('ko-KR')}건`} />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="기간"><select value={period} onChange={(event) => setPeriod(event.target.value as Period)} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"><option value="TODAY">오늘</option><option value="LAST_7_DAYS">최근 7일</option><option value="LAST_30_DAYS">최근 30일</option></select></Field>
              <Field label="채널"><select value={channel} onChange={(event) => setChannel(event.target.value as Channel)} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"><option value="ALL">전체</option><option value="IN_APP">인앱</option><option value="EMAIL">이메일</option></select></Field>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:w-[360px]">
            <ActionButton
              label="즉시 실행"
              onClick={() =>
                handleRunJob({
                  mode: runMode,
                  successMessage: '알림 작업을 즉시 실행했습니다.',
                })
              }
              disabled={runMutation.isPending}
              primary
            />
            <ActionButton label="템플릿 저장" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !templates.length} />
            <ActionButton label={testSendMutation.isPending ? '테스트 발송 실행 중...' : '테스트 발송'} onClick={handleTestSend} disabled={testSendMutation.isPending || !currentTemplate} />
            <ActionButton label="실패함 재처리" onClick={() => failureMutation.mutate({ action: 'retry', ids: filteredFailures.map((item) => item.id) })} disabled={failureMutation.isPending || !filteredFailures.length} />
            <ActionButton label="실행 이력 보기" onClick={() => setTab('executions')} disabled={false} />
            <ActionButton
              label="목표 수립 리마인드"
              onClick={() =>
                handleRunJob({
                  mode: 'schedule',
                  reminderTypes: ['goal'],
                  successMessage: '목표 수립 리마인드를 전체 대상자 기준으로 큐에 등록했습니다.',
                })
              }
              disabled={runMutation.isPending}
            />
            <ActionButton
              label="체크인 현황 리마인드"
              onClick={() =>
                handleRunJob({
                  mode: 'schedule',
                  reminderTypes: ['checkpoint'],
                  successMessage: '체크인 현황 리마인드를 전체 대상자 기준으로 큐에 등록했습니다.',
                })
              }
              disabled={runMutation.isPending}
            />
          </div>
        </div>
      </section>

      {banner ? <BannerBox tone={banner.tone} message={banner.message} /> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="24시간 재시도 알림" value={`${summary.retryCount24h.toLocaleString('ko-KR')}건`} helper="실패 후 다시 큐에 등록된 알림 수" />
        <MetricCard label="큐 적체 알림" value={`${summary.queueBacklog.toLocaleString('ko-KR')}건`} helper="대기 + 재시도 대기 알림 합계" />
        <MetricCard label="발송 제외 알림" value={`${queue.suppressed.toLocaleString('ko-KR')}건`} helper="중복 또는 제외 규칙으로 발송되지 않은 알림 수" />
        <MetricCard label="다음 행동" value={filteredFailures.length ? '실패함 점검' : '템플릿 검토'} helper={filteredFailures.length ? '실패함 탭에서 원인을 확인하고 재처리하세요.' : '템플릿과 테스트 발송으로 운영 품질을 점검하세요.'} />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm"><div className="flex flex-wrap gap-2">{(['templates', 'executions', 'failures', 'tools', 'ai', 'manual'] as Tab[]).map((key) => <button key={key} type="button" onClick={() => setTab(key)} className={cls('rounded-xl px-4 py-2.5 text-sm font-semibold transition', tab === key ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100')}>{key === 'templates' ? '템플릿' : key === 'executions' ? '실행 이력' : key === 'failures' ? '실패함' : key === 'tools' ? '설정 / 도구' : key === 'ai' ? 'AI 보조' : '수동 발송'}</button>)}</div></div>

      {tab === 'templates' ? (
        <Split left={<Panel title="템플릿 목록">{filteredTemplates.length ? filteredTemplates.map((item) => <button key={item.code} onClick={() => setSelectedTemplateCode(item.code)} className={cls('mb-3 w-full rounded-2xl border px-4 py-4 text-left transition last:mb-0', currentTemplate?.code === item.code ? 'border-blue-300 bg-blue-50' : 'border-slate-200 hover:bg-slate-50')}><div className="flex items-center justify-between gap-3"><div><div className="font-semibold text-slate-900">{item.name}</div><div className="mt-1 text-xs text-slate-500">{item.code} · {item.type} · {channelLabel(item.channel)}</div></div><span className={cls('rounded-full border px-2.5 py-1 text-xs font-semibold', item.isActive ? 'border-emerald-200 bg-emerald-100 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-600')}>{item.isActive ? '활성' : '비활성'}</span></div></button>) : <Empty message="표시할 템플릿이 없습니다." />}</Panel>} right={<Panel title={currentTemplate?.name ?? '템플릿 상세'}>{currentTemplate && currentDraft ? <div className="space-y-4"><Field label="제목 템플릿"><input value={currentDraft.subjectTemplate} onChange={(event) => updateDraft('subjectTemplate', event.target.value)} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm" /></Field><Field label="본문 템플릿"><textarea value={currentDraft.bodyTemplate} onChange={(event) => updateDraft('bodyTemplate', event.target.value)} rows={8} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm" /></Field><div className="grid gap-3 sm:grid-cols-2"><Field label="기본 링크"><input value={currentDraft.defaultLink} onChange={(event) => updateDraft('defaultLink', event.target.value)} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm" placeholder="/notifications" /></Field><div className="grid gap-3"><label className="flex items-center gap-2 rounded-2xl border border-slate-200 px-3 py-3 text-sm"><input type="checkbox" checked={currentDraft.isActive} onChange={(event) => updateDraft('isActive', event.target.checked)} />활성 상태</label><label className="flex items-center gap-2 rounded-2xl border border-slate-200 px-3 py-3 text-sm"><input type="checkbox" checked={currentDraft.isDigestCompatible} onChange={(event) => updateDraft('isDigestCompatible', event.target.checked)} />묶음 알림 가능</label></div></div><Field label="미리보기 변수(JSON)"><textarea value={previewPayloadText} onChange={(event) => setPreviewPayloadText(event.target.value)} rows={6} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 font-mono text-xs" /></Field>{!previewJsonValid ? <BannerBox tone="error" message="미리보기 변수 JSON 형식을 확인해 주세요." /> : null}{missingPreviewVariables.length ? <BannerBox tone="info" message={`누락된 변수: ${missingPreviewVariables.join(', ')}`} /> : null}<div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">미리보기</div><div className="mt-3 text-sm font-semibold text-slate-900">{renderTemplate(currentDraft.subjectTemplate, previewVariables)}</div><div className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{renderTemplate(currentDraft.bodyTemplate, previewVariables)}</div></div><div className="flex flex-wrap gap-2"><ActionButton label="템플릿 저장" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} primary /><ActionButton label={testSendMutation.isPending ? '테스트 발송 실행 중...' : '테스트 발송'} onClick={handleTestSend} disabled={testSendMutation.isPending} /><ActionButton label="AI 변수 점검" onClick={() => aiMutation.mutate('validate-template-variables')} disabled={aiMutation.isPending} /></div></div> : <Empty message="왼쪽에서 템플릿을 선택해 주세요." />}</Panel>} />
      ) : null}

      {tab === 'executions' ? (
        <Split left={<Panel title="실행 이력">{filteredExecutions.length ? filteredExecutions.map((item) => <button key={item.id} onClick={() => setSelectedExecutionId(item.id)} className={cls('mb-3 w-full rounded-2xl border px-4 py-4 text-left transition last:mb-0', currentExecution?.id === item.id ? 'border-blue-300 bg-blue-50' : 'border-slate-200 hover:bg-slate-50')}><div className="flex items-center justify-between gap-3"><div><div className="font-semibold text-slate-900">{item.jobName}</div><div className="mt-1 text-xs text-slate-500">{formatDateTime(item.startedAt)} · {channelLabel((item.metadata?.channel as Channel) ?? 'ALL')}</div></div><span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{item.status}</span></div><div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-4"><span>처리 {item.processedCount}건</span><span>성공 {item.successCount}건</span><span>실패 {item.failedCount}건</span><span>실패함 {item.deadLetterCount}건</span></div></button>) : <Empty message="실행 이력이 없습니다." />}</Panel>} right={<Panel title={currentExecution?.jobName ?? '실행 상세'}>{currentExecution ? <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-2"><MetricCard label="처리 알림" value={`${currentExecution.processedCount}건`} /><MetricCard label="성공 알림" value={`${currentExecution.successCount}건`} /><MetricCard label="실패 알림" value={`${currentExecution.failedCount}건`} /><MetricCard label="실패함 알림" value={`${currentExecution.deadLetterCount}건`} /></div><div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700"><div>실행 시각: {formatDateTime(currentExecution.startedAt)}</div><div className="mt-1">종료 시각: {formatDateTime(currentExecution.finishedAt)}</div><div className="mt-1">상태: {currentExecution.status}</div></div>{currentExecution.errorMessage ? <BannerBox tone="error" message={currentExecution.errorMessage} /> : null}<pre className="overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700">{JSON.stringify(currentExecution.metadata ?? {}, null, 2)}</pre></div> : <Empty message="실행 이력을 선택해 주세요." />}</Panel>} />
      ) : null}

      {tab === 'failures' ? (
        <Split left={<Panel title="실패함">{filteredFailures.length ? filteredFailures.map((item) => <button key={item.id} onClick={() => setSelectedFailureId(item.id)} className={cls('mb-3 w-full rounded-2xl border px-4 py-4 text-left transition last:mb-0', currentFailure?.id === item.id ? 'border-blue-300 bg-blue-50' : 'border-slate-200 hover:bg-slate-50')}><div className="flex items-start justify-between gap-3"><div><div className="font-semibold text-slate-900">{item.notificationJob.templateCode ?? item.type}</div><div className="mt-1 text-xs text-slate-500">{item.recipient.empName} · {channelLabel(item.channel)} · {formatDateTime(item.createdAt)}</div></div><span className="rounded-full border border-red-200 bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">실패</span></div><div className="mt-2 line-clamp-2 text-sm text-slate-600">{item.reason}</div></button>) : <Empty message="실패 항목이 없습니다." />}</Panel>} right={<Panel title={currentFailure?.notificationJob.templateCode ?? '실패 상세'}>{currentFailure ? <div className="space-y-4"><div className="flex flex-wrap gap-2"><ActionButton label="재처리" onClick={() => failureMutation.mutate({ action: 'retry', ids: [currentFailure.id] })} disabled={failureMutation.isPending} primary /><ActionButton label="무시 / 보관" onClick={() => failureMutation.mutate({ action: 'archive', ids: [currentFailure.id] })} disabled={failureMutation.isPending} /><ActionButton label="AI 원인 요약" onClick={() => aiMutation.mutate('summarize-dead-letters')} disabled={aiMutation.isPending} /></div><BannerBox tone="error" message={currentFailure.reason} /><div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700"><div>수신 대상: {currentFailure.recipient.empName}</div><div className="mt-1">이메일: {currentFailure.recipient.gwsEmail || '-'}</div><div className="mt-1">템플릿: {currentFailure.notificationJob.templateCode ?? currentFailure.type}</div><div className="mt-1">재시도 횟수: {currentFailure.notificationJob.retryCount}</div></div><pre className="overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700">{JSON.stringify(currentFailure.payload ?? currentFailure.notificationJob.payload ?? {}, null, 2)}</pre></div> : <Empty message="실패 항목을 선택해 주세요." />}</Panel>} />
      ) : null}

      {tab === 'tools' ? (
        <Split left={<Panel title="설정 / 도구"><div className="space-y-4"><Field label="실행 모드"><select value={runMode} onChange={(event) => setRunMode(event.target.value as RunMode)} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"><option value="all">전체 실행</option><option value="schedule">예약 등록만</option><option value="dispatch">발송 처리만</option></select></Field><div className="grid gap-3 sm:grid-cols-2"><MetricCard label="대기 알림" value={`${queue.queued.toLocaleString('ko-KR')}건`} /><MetricCard label="재시도 대기" value={`${queue.retryPending.toLocaleString('ko-KR')}건`} /><MetricCard label="실패함 알림" value={`${queue.deadLetter.toLocaleString('ko-KR')}건`} /><MetricCard label="발송 제외 알림" value={`${queue.suppressed.toLocaleString('ko-KR')}건`} /></div><div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700"><div className="font-semibold text-slate-900">운영 참고</div><ul className="mt-3 space-y-2"><li>재시도 정책은 실패함 재처리 버튼으로 즉시 복구할 수 있습니다.</li><li>테스트 발송은 실제 작업 이력과 함께 기록됩니다.</li><li>템플릿 저장 후에는 미리보기와 테스트 발송으로 변수 누락을 다시 점검해 주세요.</li></ul></div><div className="grid gap-3 md:grid-cols-2"><ActionButton label="목표 수립 리마인드 전체 발송" onClick={() => handleRunJob({ mode: 'schedule', reminderTypes: ['goal'], successMessage: '목표 수립 리마인드를 전체 대상자 기준으로 큐에 등록했습니다.' })} disabled={runMutation.isPending} /><ActionButton label="체크인 현황 리마인드 전체 발송" onClick={() => handleRunJob({ mode: 'schedule', reminderTypes: ['checkpoint'], successMessage: '체크인 현황 리마인드를 전체 대상자 기준으로 큐에 등록했습니다.' })} disabled={runMutation.isPending} /></div></div></Panel>} right={<Panel title="템플릿 미리보기 / 테스트 발송">{currentDraft ? <div className="space-y-4"><textarea value={previewPayloadText} onChange={(event) => setPreviewPayloadText(event.target.value)} rows={8} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 font-mono text-xs" /><div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="text-sm font-semibold text-slate-900">{renderTemplate(currentDraft.subjectTemplate, previewVariables)}</div><div className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{renderTemplate(currentDraft.bodyTemplate, previewVariables)}</div></div><div className="flex flex-wrap gap-2"><ActionButton label={testSendMutation.isPending ? '테스트 발송 실행 중...' : '테스트 발송'} onClick={handleTestSend} disabled={testSendMutation.isPending} /><ActionButton label="AI 운영 보고 초안" onClick={() => aiMutation.mutate('generate-ops-report')} disabled={aiMutation.isPending} /></div></div> : <Empty message="템플릿을 선택하면 미리보기와 테스트 발송을 실행할 수 있습니다." />}</Panel>} />
      ) : null}

      {tab === 'ai' ? (
        <Split left={<Panel title="AI 보조"><div className="space-y-3">{[['summarize-ops', '실행 이력 요약'], ['summarize-dead-letters', '실패함 패턴 요약'], ['validate-template-variables', '템플릿 변수 점검'], ['generate-ops-report', '운영 보고 초안']] .map(([action, label]) => <button key={action} type="button" onClick={() => aiMutation.mutate(action as AiAction)} className="w-full rounded-2xl border border-slate-200 px-4 py-4 text-left transition hover:bg-slate-50"><div className="font-semibold text-slate-900">{label}</div><p className="mt-2 text-sm text-slate-500">결과는 미리보기만 제공되며 자동 저장되지 않습니다.</p></button>)}</div><div className="mt-6 space-y-3">{(aiLogsQuery.data ?? []).length ? (aiLogsQuery.data ?? []).map((log) => <div key={log.id} className="rounded-2xl border border-slate-200 px-4 py-3"><div className="font-medium text-slate-900">{log.sourceType ?? 'AI 요청'}</div><div className="mt-1 text-xs text-slate-500">{formatDateTime(log.createdAt)} · {log.requestStatus} · 승인 {log.approvalStatus}</div>{log.errorMessage ? <div className="mt-2 text-xs text-red-600">{log.errorMessage}</div> : null}</div>) : <Empty message="AI 요청 로그가 없습니다." />}</div></Panel>} right={<Panel title={lastAiAction}>{aiPreview ? <div className="space-y-4">{aiPreview.fallbackReason ? <BannerBox tone="info" message={`대체 응답 사유: ${aiPreview.fallbackReason}`} /> : null}<pre className="overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">{JSON.stringify(aiPreview.result, null, 2)}</pre><div className="flex gap-2"><ActionButton label="반려" onClick={() => aiDecisionMutation.mutate('reject')} disabled={aiDecisionMutation.isPending} /><ActionButton label="승인" onClick={() => aiDecisionMutation.mutate('approve')} disabled={aiDecisionMutation.isPending} primary /></div></div> : <Empty message="AI 도구를 실행하면 미리보기 결과가 여기에 표시됩니다." />}</Panel>} />
      ) : null}

      {tab === 'manual' ? (() => {
        const filteredIds = manualFilteredEmployees.map((e) => e.id)
        const allFilteredSelected = filteredIds.length > 0 && filteredIds.every((id) => manualSelectedIds.has(id))
        const selectedIds = Array.from(manualSelectedIds)
        const overLimit = selectedIds.length > 100
        const canSend = selectedIds.length > 0 && !overLimit && manualSubject.trim().length > 0 && manualBody.trim().length > 0 && !manualSendMutation.isPending
        return (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="부서">
                    <select value={manualDeptFilter} onChange={(e) => setManualDeptFilter(e.target.value)} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm">
                      <option value="ALL">전체 부서</option>
                      {manualAllDepts.map((dept) => <option key={dept} value={dept}>{dept}</option>)}
                    </select>
                  </Field>
                  <Field label="이름 검색">
                    <input value={manualNameSearch} onChange={(e) => setManualNameSearch(e.target.value)} placeholder="이름 입력" className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm" />
                  </Field>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">검색 결과 {manualFilteredEmployees.length}명 · 선택 {selectedIds.length}명</span>
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={allFilteredSelected} onChange={(e) => {
                      setManualSelectedIds((prev) => {
                        const next = new Set(prev)
                        if (e.target.checked) { filteredIds.forEach((id) => next.add(id)) } else { filteredIds.forEach((id) => next.delete(id)) }
                        return next
                      })
                    }} />
                    전체 선택 / 해제
                  </label>
                </div>
                <div className="max-h-80 overflow-y-auto rounded-2xl border border-slate-200">
                  {manualEmployeesQuery.isLoading
                    ? <div className="p-6 text-center text-sm text-slate-500">직원 목록을 불러오는 중입니다.</div>
                    : manualFilteredEmployees.length === 0
                      ? <div className="p-6 text-center text-sm text-slate-500">검색 결과가 없습니다.</div>
                      : manualFilteredEmployees.map((emp) => (
                        <label key={emp.id} className="flex cursor-pointer items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0 hover:bg-slate-50">
                          <input type="checkbox" checked={manualSelectedIds.has(emp.id)} onChange={(e) => {
                            setManualSelectedIds((prev) => {
                              const next = new Set(prev)
                              if (e.target.checked) next.add(emp.id)
                              else next.delete(emp.id)
                              return next
                            })
                          }} />
                          <span className="w-24 shrink-0 text-xs text-slate-400">{emp.department.deptName}</span>
                          <span className="text-sm text-slate-900">{emp.empName}</span>
                        </label>
                      ))
                  }
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="space-y-4">
                <Field label="발송 단계">
                  <select value={manualStage} onChange={(e) => {
                    const s = e.target.value as ManualStage
                    setManualStage(s)
                    setManualSubject(STAGE_DEFAULTS[s].subject)
                    setManualBody(STAGE_DEFAULTS[s].body)
                  }} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm">
                    {STAGE_LABELS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </Field>
                <Field label="제목">
                  <input value={manualSubject} onChange={(e) => setManualSubject(e.target.value)} maxLength={200} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm" />
                </Field>
                <Field label="본문">
                  <textarea value={manualBody} onChange={(e) => setManualBody(e.target.value)} rows={7} maxLength={5000} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm" />
                  <p className="mt-1 text-xs text-slate-400">{'{{employeeName}}'} · {'{{link}}'} 는 발송 시 자동으로 치환됩니다.</p>
                </Field>
                {overLimit ? <BannerBox tone="error" message="한 번에 최대 100명까지 발송할 수 있습니다." /> : null}
                <ActionButton
                  label={manualSendMutation.isPending ? '발송 중...' : `선택 ${selectedIds.length}명에게 발송`}
                  onClick={() => manualSendMutation.mutate({ employeeIds: selectedIds, stage: manualStage, subject: manualSubject, body: manualBody })}
                  disabled={!canSend}
                  primary
                />
                {manualResult ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                    <div>큐 등록: {manualResult.queuedCount}건</div>
                    <div className="mt-1">억제: {manualResult.suppressedCount}건</div>
                    <div className="mt-1">중복 스킵: {manualResult.duplicateCount}건</div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )
      })() : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Link href="/notifications" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:bg-slate-50"><div className="font-semibold text-slate-900">사용자 알림 센터</div><p className="mt-2 text-sm text-slate-500">실제 수신자의 인앱 알림 상태를 확인합니다.</p></Link>
        <Link href="/admin/ops" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:bg-slate-50"><div className="font-semibold text-slate-900">운영 / 관제</div><p className="mt-2 text-sm text-slate-500">운영 이벤트와 리스크를 함께 확인합니다.</p></Link>
        <Link href="/admin/google-access" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:bg-slate-50"><div className="font-semibold text-slate-900">Google 계정 등록</div><p className="mt-2 text-sm text-slate-500">수신 대상 이메일과 로그인 준비 상태를 점검합니다.</p></Link>
      </div>
    </div>
  )
}

function StatePanel({ title, description, tone = 'slate' }: { title: string; description: string; tone?: 'slate' | 'error' }) {
  return <div className={cls('rounded-2xl border p-8 shadow-sm', tone === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-slate-200 bg-white text-slate-700')}><div className="text-lg font-semibold">{title}</div><p className="mt-2 text-sm">{description}</p></div>
}

function MetricCard({ label, value, helper }: { label: string; value: string; helper?: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="text-sm font-medium text-slate-500">{label}</div><div className="mt-3 text-2xl font-semibold text-slate-900">{value}</div>{helper ? <div className="mt-2 text-xs text-slate-500">{helper}</div> : null}</div>
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return <section className="rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 px-5 py-4 text-base font-semibold text-slate-900">{title}</div><div className="p-5">{children}</div></section>
}

function Split({ left, right }: { left: ReactNode; right: ReactNode }) {
  return <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">{left}{right}</div>
}

function Empty({ message }: { message: string }) {
  return <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">{message}</div>
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="space-y-2 text-sm text-slate-700"><span className="font-medium">{label}</span>{children}</label>
}

function ActionButton({ label, onClick, disabled, primary = false }: { label: string; onClick: () => void; disabled: boolean; primary?: boolean }) {
  return <button type="button" onClick={onClick} disabled={disabled} className={cls('inline-flex min-h-11 items-center justify-center rounded-2xl px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60', primary ? 'bg-slate-900 text-white hover:bg-slate-800' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50')}>{label}</button>
}

function BannerBox({ tone, message }: Banner) {
  return <div className={cls('rounded-2xl border px-4 py-3 text-sm', tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : tone === 'error' ? 'border-red-200 bg-red-50 text-red-800' : 'border-blue-200 bg-blue-50 text-blue-800')}>{message}</div>
}
