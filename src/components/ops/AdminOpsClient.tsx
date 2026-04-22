'use client'

import Link from 'next/link'
import { useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

type Tab = 'health' | 'risks' | 'events' | 'runbooks' | 'ai'
type Period = '1H' | '24H' | '7D'
type SeverityFilter = 'ALL' | 'OK' | 'WARN' | 'ERROR'
type Banner = { tone: 'success' | 'error' | 'info'; message: string }
type AiAction =
  | 'summarize-ops-status'
  | 'summarize-incident-patterns'
  | 'generate-daily-report'
  | 'prioritize-risks'

type OpsSummary = {
  environment: {
    appEnv: string
    nodeEnv: string
    appVersion: string
    deploymentTarget: string
    errorTrackingConfigured: boolean
    allowedDomain?: string | null
  }
  featureFlags: Array<{ key: string; envKey: string; description: string; enabled: boolean }>
  healthChecks: Array<{
    key: string
    name: string
    status: 'ok' | 'warn' | 'error'
    detail: string
    impact?: string
    checkedAt: string
  }>
  secretChecks: Array<{
    name: string
    requiredIn: Array<'dev' | 'stage' | 'prod'>
    configured: boolean
    isRequired: boolean
  }>
  metrics: {
    failedJobs24h: number
    notificationDeadLetters: number
    aiFallback24h: number
    overBudgetScenarios: number
    loginUnavailableAccounts: number
    activeEvalCycles: number
    delayedEvalCycles: number
    unreviewedMonthlyRecords: number
    unresolvedCalibrationCount: number
    queueBacklog: number
    inactiveTemplates: number
  }
  status: { label: string; tone: 'ok' | 'warn' | 'error' }
  risks: Array<{
    id: string
    label: string
    count: number
    severity: 'LOW' | 'MEDIUM' | 'HIGH'
    relatedUrl?: string
    description: string
  }>
  runbooks: Array<{
    id: string
    title: string
    description: string
    severity?: string
    relatedUrl?: string
    docUrl?: string
  }>
  recentEvents: Array<{
    id: string
    level: string
    component: string
    eventType: string
    message: string
    createdAt: string
    relatedUrl?: string
  }>
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

function parseResponse<T>(json: unknown) {
  const payload = json as { success?: boolean; data?: T; error?: { message?: string } }
  if (!payload.success) {
    throw new Error(payload.error?.message || '요청 처리 중 오류가 발생했습니다.')
  }
  return payload.data as T
}

function formatDateTime(value?: string | null) {
  if (!value) return '-'
  return new Date(value).toLocaleString('ko-KR', { hour12: false })
}

function matchesPeriod(value: string, period: Period) {
  const diffHours = (Date.now() - new Date(value).getTime()) / 3_600_000
  if (period === '1H') return diffHours <= 1
  if (period === '24H') return diffHours <= 24
  return diffHours <= 24 * 7
}

function toneClass(tone: 'ok' | 'warn' | 'error') {
  return tone === 'ok'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : tone === 'warn'
      ? 'border-amber-200 bg-amber-50 text-amber-800'
      : 'border-rose-200 bg-rose-50 text-rose-700'
}

function severityClass(level: 'LOW' | 'MEDIUM' | 'HIGH') {
  return level === 'LOW'
    ? 'border-slate-200 bg-slate-100 text-slate-700'
    : level === 'MEDIUM'
      ? 'border-amber-200 bg-amber-50 text-amber-800'
      : 'border-rose-200 bg-rose-50 text-rose-700'
}

function eventTone(level: string): 'ok' | 'warn' | 'error' {
  if (level === 'ERROR') return 'error'
  if (level === 'WARN') return 'warn'
  return 'ok'
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

function Panel({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  )
}

function Empty({ message }: { message: string }) {
  return <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">{message}</div>
}

export function AdminOpsClient() {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<Tab>('health')
  const [period, setPeriod] = useState<Period>('24H')
  const [severity, setSeverity] = useState<SeverityFilter>('ALL')
  const [banner, setBanner] = useState<Banner | null>(null)
  const [selectedRiskId, setSelectedRiskId] = useState<string | null>(null)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [selectedRunbookId, setSelectedRunbookId] = useState<string | null>(null)
  const [aiPreview, setAiPreview] = useState<AiPreview | null>(null)

  const summaryQuery = useQuery<OpsSummary>({
    queryKey: ['admin-ops-summary'],
    queryFn: async () => parseResponse<OpsSummary>(await (await fetch('/api/admin/ops/summary')).json()),
    staleTime: 5 * 60_000,
    refetchInterval: 60_000,
  })

  const aiLogsQuery = useQuery<AiLog[]>({
    queryKey: ['admin-ops-ai-logs'],
    queryFn: async () => parseResponse<AiLog[]>(await (await fetch('/api/admin/ops/ai')).json()),
    enabled: tab === 'ai',
  })

  const aiMutation = useMutation({
    mutationFn: async (params: { action: AiAction; payload: Record<string, unknown> }) => {
      const res = await fetch('/api/admin/ops/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })
      return parseResponse<AiPreview>(await res.json())
    },
    onSuccess: (data) => {
      setAiPreview(data)
      setBanner({
        tone: data.source === 'ai' ? 'success' : 'info',
        message: data.source === 'ai' ? 'AI 분석 결과를 불러왔습니다.' : 'AI 응답이 불안정해 기본 분석 결과를 표시했습니다.',
      })
      queryClient.invalidateQueries({ queryKey: ['admin-ops-ai-logs'] })
    },
    onError: (error: Error) => setBanner({ tone: 'error', message: error.message }),
  })

  const aiDecisionMutation = useMutation({
    mutationFn: async (params: { action: 'approve' | 'reject' }) => {
      if (!aiPreview) throw new Error('AI 결과가 없습니다.')
      const res = await fetch(`/api/ai/request-logs/${encodeURIComponent(aiPreview.requestLogId)}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          params.action === 'approve'
            ? { action: 'approve', approvedPayload: aiPreview.result }
            : { action: 'reject', rejectionReason: '운영 검토 후 반려했습니다.' }
        ),
      })
      return parseResponse(await res.json())
    },
    onSuccess: (_, params) => {
      setBanner({ tone: params.action === 'approve' ? 'success' : 'info', message: params.action === 'approve' ? 'AI 결과를 승인했습니다.' : 'AI 결과를 반려했습니다.' })
      queryClient.invalidateQueries({ queryKey: ['admin-ops-ai-logs'] })
    },
    onError: (error: Error) => setBanner({ tone: 'error', message: error.message }),
  })

  if (summaryQuery.isLoading) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-sm">운영 요약을 불러오는 중입니다.</div>
  }

  if (summaryQuery.isError || !summaryQuery.data) {
    return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-sm text-rose-700 shadow-sm">{summaryQuery.error instanceof Error ? summaryQuery.error.message : '운영 요약을 불러오지 못했습니다.'}</div>
  }

  const summary = summaryQuery.data
  const filteredHealth = summary.healthChecks.filter((item) => severity === 'ALL' || (severity === 'OK' && item.status === 'ok') || (severity === 'WARN' && item.status === 'warn') || (severity === 'ERROR' && item.status === 'error'))
  const filteredRisks = summary.risks.filter((risk) => severity === 'ALL' || (severity === 'OK' && risk.count === 0) || (severity === 'WARN' && risk.severity === 'MEDIUM') || (severity === 'ERROR' && risk.severity === 'HIGH'))
  const filteredEvents = summary.recentEvents.filter((item) => matchesPeriod(item.createdAt, period) && (severity === 'ALL' || (severity === 'OK' && eventTone(item.level) === 'ok') || (severity === 'WARN' && eventTone(item.level) === 'warn') || (severity === 'ERROR' && eventTone(item.level) === 'error')))
  const currentRisk = filteredRisks.find((item) => item.id === selectedRiskId) ?? filteredRisks[0] ?? null
  const currentEvent = filteredEvents.find((item) => item.id === selectedEventId) ?? filteredEvents[0] ?? null
  const currentRunbook = summary.runbooks.find((item) => item.id === selectedRunbookId) ?? summary.runbooks[0] ?? null
  const staleData = summaryQuery.isStale

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-600">Admin Ops</p>
              <h1 className="mt-2 text-2xl font-semibold text-slate-900 sm:text-3xl">운영 / 관제</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">지금 무엇이 위험한지, 어떤 조치가 필요한지, 어느 화면으로 이동해야 하는지를 한 화면에서 확인하는 운영 허브입니다.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className={cls('rounded-full border px-3 py-1 text-xs font-semibold', toneClass(summary.status.tone))}>{summary.status.label}</span>
              <select value={period} onChange={(e) => setPeriod(e.target.value as Period)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                <option value="1H">최근 1시간</option>
                <option value="24H">최근 24시간</option>
                <option value="7D">최근 7일</option>
              </select>
              <select value={severity} onChange={(e) => setSeverity(e.target.value as SeverityFilter)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                <option value="ALL">전체</option>
                <option value="OK">정상</option>
                <option value="WARN">주의</option>
                <option value="ERROR">오류</option>
              </select>
              {staleData ? <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">데이터 갱신 지연</span> : null}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="24시간 실패 작업" value={`${summary.metrics.failedJobs24h.toLocaleString('ko-KR')}건`} />
              <MetricCard label="실패함 알림" value={`${summary.metrics.notificationDeadLetters.toLocaleString('ko-KR')}건`} />
              <MetricCard label="AI 대체 응답" value={`${summary.metrics.aiFallback24h.toLocaleString('ko-KR')}건`} />
              <MetricCard label="예산 초과 시나리오" value={`${summary.metrics.overBudgetScenarios.toLocaleString('ko-KR')}건`} />
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:w-[22rem]">
            <button onClick={() => setTab('runbooks')} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50">운영 가이드 열기</button>
            <button onClick={() => setTab('events')} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50">운영 이력 보기</button>
            <Link href="/admin/notifications" className="rounded-xl bg-slate-900 px-4 py-3 text-center text-sm font-medium text-white">알림 운영으로 이동</Link>
            <Link href="/admin/google-access" className="rounded-xl border border-slate-200 px-4 py-3 text-center text-sm font-medium text-slate-700 hover:bg-slate-50">Google 계정 등록으로 이동</Link>
          </div>
        </div>
      </section>

      {banner ? <div className={cls('rounded-2xl border px-4 py-3 text-sm', banner.tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : banner.tone === 'error' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-blue-200 bg-blue-50 text-blue-700')}>{banner.message}</div> : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="24시간 실패 작업" value={`${summary.metrics.failedJobs24h.toLocaleString('ko-KR')}건`} helper="최근 24시간 기준" />
        <MetricCard label="실패함 알림" value={`${summary.metrics.notificationDeadLetters.toLocaleString('ko-KR')}건`} helper="복구가 필요한 알림" />
        <MetricCard label="AI 대체 응답" value={`${summary.metrics.aiFallback24h.toLocaleString('ko-KR')}건`} helper="품질 또는 안정성 지표" />
        <MetricCard label="예산 초과 시나리오" value={`${summary.metrics.overBudgetScenarios.toLocaleString('ko-KR')}건`} helper="보상 운영 리스크" />
        <MetricCard label="로그인 준비 불가 계정" value={`${summary.metrics.loginUnavailableAccounts.toLocaleString('ko-KR')}개`} helper="Google 계정 점검 필요" />
        <MetricCard label="진행 중 평가 주기" value={`${summary.metrics.activeEvalCycles.toLocaleString('ko-KR')}개`} helper={`지연 ${summary.metrics.delayedEvalCycles}개`} />
        <div className="sm:col-span-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm font-medium text-slate-500">다음 행동</div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Link href="/admin/notifications" className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 hover:bg-slate-100">실패 작업 확인</Link>
            <Link href="/admin/notifications" className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 hover:bg-slate-100">실패함 재처리</Link>
            <Link href="/admin/google-access" className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 hover:bg-slate-100">로그인 이슈 계정 점검</Link>
            <Link href="/compensation/manage" className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 hover:bg-slate-100">예산 초과 시나리오 확인</Link>
          </div>
        </div>
      </section>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {[
          ['health', '서비스 상태'],
          ['risks', '업무 리스크'],
          ['events', '이벤트 로그'],
          ['runbooks', '운영 가이드'],
          ['ai', 'AI 보조'],
        ].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key as Tab)} className={cls('whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition', tab === key ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50')}>{label}</button>
        ))}
      </div>

      {tab === 'health' ? (
        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <Panel title="서비스 상태">
            {filteredHealth.length ? <div className="grid gap-4 md:grid-cols-2">{filteredHealth.map((item) => (
              <div key={item.key} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3"><div className="font-medium text-slate-900">{item.name}</div><span className={cls('rounded-full border px-3 py-1 text-xs font-semibold', toneClass(item.status))}>{item.status.toUpperCase()}</span></div>
                <p className="mt-3 text-sm text-slate-600">{item.detail}</p>
                {item.impact ? <p className="mt-2 text-xs text-slate-500">영향: {item.impact}</p> : null}
                <p className="mt-3 text-xs text-slate-400">확인 시각 {formatDateTime(item.checkedAt)}</p>
              </div>
            ))}</div> : <Empty message="선택한 조건에 맞는 상태 항목이 없습니다." />}
          </Panel>
          <Panel title="환경 / 플래그 / 비밀값">
            <div className="grid gap-3 sm:grid-cols-2">
              <MetricCard label="APP_ENV" value={summary.environment.appEnv} />
              <MetricCard label="NODE_ENV" value={summary.environment.nodeEnv} />
              <MetricCard label="배포 대상" value={summary.environment.deploymentTarget} />
              <MetricCard label="앱 버전" value={summary.environment.appVersion} />
              <MetricCard label="허용 도메인" value={summary.environment.allowedDomain || '미설정'} />
              <MetricCard label="에러 추적" value={summary.environment.errorTrackingConfigured ? '설정됨' : '미설정'} />
            </div>
            <div className="mt-5 space-y-3">{summary.featureFlags.map((flag) => (
              <div key={flag.key} className="rounded-xl border border-slate-200 px-4 py-3">
                <div className="flex items-center justify-between gap-3"><div><div className="font-medium text-slate-900">{flag.key}</div><div className="mt-1 text-xs text-slate-500">{flag.description}</div></div><span className={cls('rounded-full border px-3 py-1 text-xs font-semibold', toneClass(flag.enabled ? 'ok' : 'warn'))}>{flag.enabled ? '활성' : '비활성'}</span></div>
              </div>
            ))}</div>
            <div className="mt-5 space-y-3">{summary.secretChecks.map((item) => (
              <div key={item.name} className="rounded-xl border border-slate-200 px-4 py-3">
                <div className="flex items-center justify-between gap-3"><div className="font-medium text-slate-900">{item.name}</div><span className={cls('rounded-full border px-3 py-1 text-xs font-semibold', toneClass(item.configured ? 'ok' : item.isRequired ? 'error' : 'warn'))}>{item.configured ? '설정됨' : item.isRequired ? '필수' : '선택'}</span></div>
                <div className="mt-1 text-xs text-slate-500">필수 환경: {item.requiredIn.join(', ') || '없음'}</div>
              </div>
            ))}</div>
          </Panel>
        </div>
      ) : null}

      {tab === 'risks' ? (
        <div className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
          <Panel title="업무 리스크">
            {filteredRisks.length ? <div className="space-y-3">{filteredRisks.map((risk) => (
              <button key={risk.id} onClick={() => setSelectedRiskId(risk.id)} className={cls('w-full rounded-2xl border px-4 py-4 text-left transition', currentRisk?.id === risk.id ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50')}>
                <div className="flex items-center justify-between gap-3"><div className="font-medium">{risk.label}</div><span className={cls('rounded-full border px-3 py-1 text-xs font-semibold', currentRisk?.id === risk.id ? 'border-white/20 bg-white/10 text-white' : severityClass(risk.severity))}>{risk.severity}</span></div>
                <div className={cls('mt-2 text-sm', currentRisk?.id === risk.id ? 'text-slate-200' : 'text-slate-500')}>{risk.description}</div>
                <div className={cls('mt-3 text-2xl font-semibold', currentRisk?.id === risk.id ? 'text-white' : 'text-slate-900')}>{risk.count.toLocaleString('ko-KR')}</div>
              </button>
            ))}</div> : <Empty message="선택한 조건에 맞는 업무 리스크가 없습니다." />}
          </Panel>
          <Panel title="리스크 상세" action={currentRisk?.relatedUrl ? <Link href={currentRisk.relatedUrl} className="text-sm font-medium text-blue-600 hover:text-blue-700">관련 화면 이동</Link> : null}>
            {currentRisk ? <div className="space-y-4">
              <div className="flex items-center gap-3"><span className={cls('rounded-full border px-3 py-1 text-xs font-semibold', severityClass(currentRisk.severity))}>{currentRisk.severity}</span><div className="text-sm text-slate-500">발견 건수 {currentRisk.count.toLocaleString('ko-KR')}</div></div>
              <div><div className="text-lg font-semibold text-slate-900">{currentRisk.label}</div><p className="mt-2 text-sm leading-6 text-slate-600">{currentRisk.description}</p></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Link href="/admin/google-access" className="rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50">Google 계정 등록</Link>
                <Link href="/admin/notifications" className="rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50">알림 운영</Link>
                <Link href="/evaluation/ceo-adjust" className="rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50">등급 조정</Link>
                <Link href="/compensation/manage" className="rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50">시뮬레이션 관리</Link>
                <Link href="/kpi/monthly" className="rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50">월간 실적</Link>
                <Link href="/notifications" className="rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50">알림 센터</Link>
              </div>
            </div> : <Empty message="리스크를 선택하면 상세 정보와 조치 경로를 볼 수 있습니다." />}
          </Panel>
        </div>
      ) : null}

      {tab === 'events' ? (
        <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
          <Panel title="이벤트 로그">
            {filteredEvents.length ? <div className="space-y-3">{filteredEvents.map((event) => (
              <button key={event.id} onClick={() => setSelectedEventId(event.id)} className={cls('w-full rounded-2xl border px-4 py-4 text-left transition', currentEvent?.id === event.id ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50')}>
                <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><span className={cls('rounded-full border px-3 py-1 text-xs font-semibold', currentEvent?.id === event.id ? 'border-white/20 bg-white/10 text-white' : toneClass(eventTone(event.level)))}>{event.level}</span><span className={cls('text-xs', currentEvent?.id === event.id ? 'text-slate-200' : 'text-slate-500')}>{event.component}</span></div><span className={cls('text-xs', currentEvent?.id === event.id ? 'text-slate-200' : 'text-slate-400')}>{formatDateTime(event.createdAt)}</span></div>
                <div className={cls('mt-3 font-medium', currentEvent?.id === event.id ? 'text-white' : 'text-slate-900')}>{event.eventType}</div>
                <div className={cls('mt-2 text-sm', currentEvent?.id === event.id ? 'text-slate-200' : 'text-slate-500')}>{event.message}</div>
              </button>
            ))}</div> : <Empty message="선택한 조건에 맞는 이벤트가 없습니다." />}
          </Panel>
          <Panel title="이벤트 상세" action={currentEvent?.relatedUrl ? <Link href={currentEvent.relatedUrl} className="text-sm font-medium text-blue-600 hover:text-blue-700">관련 페이지 이동</Link> : null}>
            {currentEvent ? <div className="space-y-4">
              <div className="flex items-center gap-3"><span className={cls('rounded-full border px-3 py-1 text-xs font-semibold', toneClass(eventTone(currentEvent.level)))}>{currentEvent.level}</span><div className="text-sm text-slate-500">{currentEvent.component}</div></div>
              <div><div className="text-lg font-semibold text-slate-900">{currentEvent.eventType}</div><p className="mt-2 text-sm leading-6 text-slate-600">{currentEvent.message}</p></div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">관련 화면과 최근 이벤트를 함께 확인해 영향 범위와 복구 상태를 판단하세요.</div>
            </div> : <Empty message="이벤트를 선택하면 상세 정보가 표시됩니다." />}
          </Panel>
        </div>
      ) : null}

      {tab === 'runbooks' ? (
        <div className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
          <Panel title="운영 가이드">
            <div className="space-y-3">{summary.runbooks.map((item) => (
              <button key={item.id} onClick={() => setSelectedRunbookId(item.id)} className={cls('w-full rounded-2xl border px-4 py-4 text-left transition', currentRunbook?.id === item.id ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50')}>
                <div className="flex items-center justify-between gap-3"><div className="font-medium">{item.title}</div>{item.severity ? <span className={cls('rounded-full border px-3 py-1 text-xs font-semibold', currentRunbook?.id === item.id ? 'border-white/20 bg-white/10 text-white' : severityClass(item.severity === 'HIGH' ? 'HIGH' : item.severity === 'MEDIUM' ? 'MEDIUM' : 'LOW'))}>{item.severity}</span> : null}</div>
                <div className={cls('mt-2 text-sm', currentRunbook?.id === item.id ? 'text-slate-200' : 'text-slate-500')}>{item.description}</div>
              </button>
            ))}</div>
          </Panel>
          <Panel title="운영 가이드 상세" action={currentRunbook?.relatedUrl ? <Link href={currentRunbook.relatedUrl} className="text-sm font-medium text-blue-600 hover:text-blue-700">관련 화면 이동</Link> : null}>
            {currentRunbook ? <div className="space-y-4">
              <div className="text-lg font-semibold text-slate-900">{currentRunbook.title}</div>
              <p className="text-sm leading-6 text-slate-600">{currentRunbook.description}</p>
              {currentRunbook.docUrl ? <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="text-sm font-medium text-slate-900">문서 경로</div><div className="mt-2 break-all font-mono text-xs text-slate-600">{currentRunbook.docUrl}</div></div> : null}
            </div> : <Empty message="운영 가이드를 선택하면 조치 경로를 볼 수 있습니다." />}
          </Panel>
        </div>
      ) : null}

      {tab === 'ai' ? (
        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-6">
            <Panel title="AI 보조">
              <div className="grid gap-3">
                <button onClick={() => aiMutation.mutate({ action: 'summarize-ops-status', payload: { metrics: summary.metrics, healthChecks: summary.healthChecks, risks: summary.risks } })} className="rounded-xl border border-slate-200 px-4 py-3 text-left text-sm text-slate-700 hover:bg-slate-50"><div className="font-medium text-slate-900">운영 상태 요약</div><div className="mt-1 text-slate-500">최근 운영 상태를 짧게 요약합니다.</div></button>
                <button onClick={() => aiMutation.mutate({ action: 'summarize-incident-patterns', payload: { events: filteredEvents, risks: filteredRisks } })} className="rounded-xl border border-slate-200 px-4 py-3 text-left text-sm text-slate-700 hover:bg-slate-50"><div className="font-medium text-slate-900">이벤트 패턴 요약</div><div className="mt-1 text-slate-500">이벤트와 실패함 패턴을 설명합니다.</div></button>
                <button onClick={() => aiMutation.mutate({ action: 'generate-daily-report', payload: { metrics: summary.metrics, status: summary.status, events: filteredEvents.slice(0, 8), risks: filteredRisks.slice(0, 6) } })} className="rounded-xl border border-slate-200 px-4 py-3 text-left text-sm text-slate-700 hover:bg-slate-50"><div className="font-medium text-slate-900">운영 보고 초안</div><div className="mt-1 text-slate-500">관리자/임원 공유용 보고 문장을 생성합니다.</div></button>
                <button onClick={() => aiMutation.mutate({ action: 'prioritize-risks', payload: { risks: filteredRisks, metrics: summary.metrics } })} className="rounded-xl border border-slate-200 px-4 py-3 text-left text-sm text-slate-700 hover:bg-slate-50"><div className="font-medium text-slate-900">리스크 우선순위 정리</div><div className="mt-1 text-slate-500">지금 먼저 봐야 할 항목 Top 3를 제안합니다.</div></button>
              </div>
              {aiMutation.isPending ? <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">AI 결과를 생성하고 있습니다.</div> : null}
            </Panel>
            <Panel title="AI 사용 로그">
              {aiLogsQuery.isLoading ? <div className="text-sm text-slate-500">AI 요청 로그를 불러오는 중입니다.</div> : aiLogsQuery.data?.length ? <div className="space-y-3">{aiLogsQuery.data.map((log) => (
                <div key={log.id} className="rounded-xl border border-slate-200 px-4 py-3">
                  <div className="font-medium text-slate-900">{log.sourceType ?? 'AdminOpsAI'}</div>
                  <div className="mt-1 text-xs text-slate-500">{formatDateTime(log.createdAt)} · {log.requestStatus} · 승인 {log.approvalStatus}</div>
                  {log.errorMessage ? <div className="mt-2 text-xs text-rose-600">{log.errorMessage}</div> : null}
                </div>
              ))}</div> : <Empty message="AI 사용 로그가 없습니다." />}
            </Panel>
          </div>
          <Panel title="AI 미리보기">
            {aiPreview ? <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3"><span className={cls('rounded-full border px-3 py-1 text-xs font-semibold', aiPreview.source === 'ai' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-800')}>{aiPreview.source === 'ai' ? 'AI 응답' : aiPreview.source === 'fallback' ? '대체 응답' : '대체 응답 비활성'}</span>{aiPreview.fallbackReason ? <span className="text-xs text-slate-500">{aiPreview.fallbackReason}</span> : null}</div>
              <pre className="overflow-x-auto rounded-2xl border border-slate-200 bg-slate-950 p-4 text-xs leading-6 text-slate-100">{JSON.stringify(aiPreview.result, null, 2)}</pre>
              <div className="flex flex-wrap gap-3">
                <button onClick={() => aiDecisionMutation.mutate({ action: 'approve' })} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60" disabled={aiDecisionMutation.isPending}>승인</button>
                <button onClick={() => aiDecisionMutation.mutate({ action: 'reject' })} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-60" disabled={aiDecisionMutation.isPending}>반려</button>
              </div>
            </div> : <Empty message="왼쪽에서 AI 보조 작업을 실행하면 미리보기 결과가 표시됩니다." />}
          </Panel>
        </div>
      ) : null}
    </div>
  )
}
