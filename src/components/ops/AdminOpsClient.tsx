'use client'

import { useQuery } from '@tanstack/react-query'

type OpsSummary = {
  environment: {
    appEnv: string
    nodeEnv: string
    appVersion: string
    deploymentTarget: string
    errorTrackingConfigured: boolean
  }
  featureFlags: Array<{
    key: string
    envKey: string
    description: string
    enabled: boolean
  }>
  healthChecks: Array<{
    name: string
    status: 'ok' | 'warn' | 'error'
    detail: string
  }>
  secretChecks: Array<{
    name: string
    requiredIn: string[]
    configured: boolean
    isRequired: boolean
  }>
  metrics: {
    employeeCount: number
    notificationDeadLetters: number
    failedJobs24h: number
    aiFallback24h: number
    aiDisabled24h: number
    aiSuccess24h: number
    overBudgetScenarios: number
    operationalErrors24h: number
  }
  recentEvents: Array<{
    id: string
    level: string
    component: string
    eventType: string
    message: string
    createdAt: string
  }>
}

const RUNBOOKS = [
  'docs/operations/admin-runbook.md',
  'docs/operations/data-migration-and-launch-plan.md',
  'docs/operations/data-mapping-matrix.csv',
  'docs/operations/admin-training-outline.md',
  'docs/operations/faq-draft.md',
  'docs/operations/deployment-and-env.md',
  'docs/operations/backup-restore-drill.md',
  'docs/operations/incident-runbook.md',
  'docs/operations/release-readiness.md',
  'docs/operations/performance-observability.md',
]

export function AdminOpsClient() {
  const { data, isLoading, error } = useQuery<OpsSummary>({
    queryKey: ['admin-ops-summary'],
    queryFn: async () => {
      const res = await fetch('/api/admin/ops/summary')
      const json = await res.json()
      if (!json.success) {
        throw new Error(json.error?.message || 'Failed to load operations summary.')
      }
      return json.data
    },
    refetchInterval: 60000,
  })

  if (isLoading) {
    return <div className="touch-card p-8 text-sm text-slate-500">운영 요약을 불러오는 중입니다.</div>
  }

  if (error || !data) {
    return (
      <div className="touch-card border border-rose-200 bg-rose-50 p-8 text-sm text-rose-700">
        운영 요약을 불러오지 못했습니다.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="touch-card p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-500">Operations</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">운영 / 관제 대시보드</h1>
        <p className="mt-2 text-sm text-slate-600">
          배포 상태, 핵심 지표, 플래그, 최근 운영 이벤트를 한 곳에서 확인합니다.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="24h 실패 Job" value={data.metrics.failedJobs24h} />
        <MetricCard label="24h AI Fallback" value={data.metrics.aiFallback24h} />
        <MetricCard label="알림 Dead Letter" value={data.metrics.notificationDeadLetters} />
        <MetricCard label="24h 운영 Error" value={data.metrics.operationalErrors24h} />
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="touch-card p-6">
          <h2 className="text-lg font-semibold text-slate-900">환경 상태</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <InfoBox label="APP_ENV" value={data.environment.appEnv} />
            <InfoBox label="NODE_ENV" value={data.environment.nodeEnv} />
            <InfoBox label="배포 타깃" value={data.environment.deploymentTarget} />
            <InfoBox label="앱 버전" value={data.environment.appVersion} />
            <InfoBox
              label="에러 트래킹"
              value={data.environment.errorTrackingConfigured ? 'configured' : 'not configured'}
            />
            <InfoBox label="직원 수" value={String(data.metrics.employeeCount)} />
          </div>
        </section>

        <section className="touch-card p-6">
          <h2 className="text-lg font-semibold text-slate-900">헬스 체크</h2>
          <div className="mt-4 space-y-3">
            {data.healthChecks.map((check) => (
              <div key={check.name} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-slate-900">{check.name}</p>
                  <StatusBadge status={check.status} />
                </div>
                <p className="mt-2 text-sm text-slate-500">{check.detail}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <section className="touch-card p-6">
          <h2 className="text-lg font-semibold text-slate-900">Feature Flags</h2>
          <div className="mt-4 overflow-hidden rounded-[1.5rem] border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">Flag</th>
                  <th className="px-4 py-3">State</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {data.featureFlags.map((flag) => (
                  <tr key={flag.key}>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">{flag.key}</p>
                      <p className="mt-1 text-xs text-slate-500">{flag.envKey}</p>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={flag.enabled ? 'ok' : 'warn'} text={flag.enabled ? 'enabled' : 'disabled'} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="touch-card p-6">
          <h2 className="text-lg font-semibold text-slate-900">Secret Readiness</h2>
          <div className="mt-4 space-y-3">
            {data.secretChecks.map((secret) => (
              <div key={secret.name} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-slate-900">{secret.name}</p>
                  <StatusBadge
                    status={secret.configured ? 'ok' : secret.isRequired ? 'error' : 'warn'}
                    text={secret.configured ? 'configured' : secret.isRequired ? 'required' : 'optional'}
                  />
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Required in: {secret.requiredIn.join(', ') || 'none'}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="touch-card p-6">
          <h2 className="text-lg font-semibold text-slate-900">Recent Operational Events</h2>
          <div className="mt-4 space-y-3">
            {data.recentEvents.length ? (
              data.recentEvents.map((event) => (
                <div key={event.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-slate-900">
                      {event.level} · {event.component}
                    </p>
                    <p className="text-xs text-slate-400">
                      {new Date(event.createdAt).toLocaleString('ko-KR', { hour12: false })}
                    </p>
                  </div>
                  <p className="mt-2 text-sm font-medium text-slate-700">{event.eventType}</p>
                  <p className="mt-1 text-sm text-slate-500">{event.message}</p>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                최근 운영 이벤트가 없습니다.
              </div>
            )}
          </div>
        </section>

        <section className="touch-card p-6">
          <h2 className="text-lg font-semibold text-slate-900">Runbook Index</h2>
          <div className="mt-4 space-y-3">
            {RUNBOOKS.map((item) => (
              <div key={item} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                {item}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="touch-card p-5">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
    </div>
  )
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.5rem] border border-slate-200 bg-white px-4 py-4">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-2 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  )
}

function StatusBadge({
  status,
  text,
}: {
  status: 'ok' | 'warn' | 'error'
  text?: string
}) {
  const styles =
    status === 'ok'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : status === 'warn'
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : 'bg-rose-50 text-rose-700 border-rose-200'

  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${styles}`}>
      {text || status}
    </span>
  )
}
