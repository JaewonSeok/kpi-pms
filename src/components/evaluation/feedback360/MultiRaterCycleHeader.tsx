'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BarChart3, ClipboardList, MessageSquareMore, Settings2, Users } from 'lucide-react'
import type { Feedback360PageData, Feedback360RouteMode } from '@/server/feedback-360'

type MultiRaterCycleHeaderProps = {
  data: Feedback360PageData
}

const MODE_LABELS: Record<Feedback360RouteMode, string> = {
  overview: '360 개요',
  nomination: '리뷰어 nomination',
  results: '360 결과',
  admin: '운영 관리',
  respond: '응답 작성',
}

export function MultiRaterCycleHeader(props: MultiRaterCycleHeaderProps) {
  const router = useRouter()
  const selectedCycleId = props.data.selectedCycleId ?? props.data.availableCycles[0]?.id ?? ''
  const selectedRoundId = props.data.selectedRoundId ?? props.data.availableRounds[0]?.id ?? ''

  function buildHref(mode: Exclude<Feedback360RouteMode, 'respond'>) {
    const params = new URLSearchParams()
    if (selectedCycleId) params.set('cycleId', selectedCycleId)
    if (selectedRoundId) params.set('roundId', selectedRoundId)

    if (mode === 'overview') return `/evaluation/360${params.toString() ? `?${params.toString()}` : ''}`
    return `/evaluation/360/${mode}${params.toString() ? `?${params.toString()}` : ''}`
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-[linear-gradient(135deg,#f8fbff_0%,#ffffff_48%,#f9fafb_100%)] p-6 shadow-sm">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
              360 Feedback
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
              {MODE_LABELS[props.data.mode]}
            </span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">360 다면평가</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-500">
              리뷰어 nomination, 응답 진행률, 익명 기준, 강점/개선 테마, 성장 계획까지 하나의 운영 흐름으로 연결합니다.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <SummaryMetric icon={<Users className="h-4 w-4" />} label="진행 중 라운드" value={String(props.data.summary.activeRounds)} />
            <SummaryMetric icon={<MessageSquareMore className="h-4 w-4" />} label="내 미응답" value={String(props.data.summary.pendingResponses)} />
            <SummaryMetric icon={<ClipboardList className="h-4 w-4" />} label="내 제출 완료 응답" value={String(props.data.summary.submittedResponses)} />
            <SummaryMetric icon={<BarChart3 className="h-4 w-4" />} label="평균 응답률" value={`${props.data.summary.averageResponseRate}%`} />
            <SummaryMetric icon={<Settings2 className="h-4 w-4" />} label="익명 기준 충족" value={String(props.data.summary.anonymityReadyCount)} />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:w-[440px]">
          <label className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Cycle</div>
            <select
              value={selectedCycleId}
              onChange={(event) => router.push(`/evaluation/360?cycleId=${encodeURIComponent(event.target.value)}`)}
              className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900"
            >
              {props.data.availableCycles.map((cycle) => (
                <option key={cycle.id} value={cycle.id}>
                  {cycle.year}년 · {cycle.name}
                </option>
              ))}
            </select>
          </label>
          <label className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Round</div>
            <select
              value={selectedRoundId}
              onChange={(event) => {
                const params = new URLSearchParams()
                if (selectedCycleId) params.set('cycleId', selectedCycleId)
                params.set('roundId', event.target.value)
                router.push(
                  props.data.mode === 'overview'
                    ? `/evaluation/360?${params.toString()}`
                    : `/evaluation/360/${props.data.mode}?${params.toString()}`
                )
              }}
              className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900"
            >
              {props.data.availableRounds.map((round) => (
                <option key={round.id} value={round.id}>
                  {round.roundName} · {round.roundType}
                </option>
              ))}
            </select>
          </label>
          <div className="md:col-span-2 flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <HeaderTab href={buildHref('overview')} label="개요" active={props.data.mode === 'overview'} />
            <HeaderTab href={buildHref('nomination')} label="nomination" active={props.data.mode === 'nomination'} />
            <HeaderTab href={buildHref('results')} label="결과" active={props.data.mode === 'results'} />
            <HeaderTab href={buildHref('admin')} label="운영" active={props.data.mode === 'admin'} />
          </div>
        </div>
      </div>
    </section>
  )
}

function HeaderTab(props: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={props.href}
      className={`inline-flex min-h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold transition ${
        props.active ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
      }`}
    >
      {props.label}
    </Link>
  )
}

function SummaryMetric(props: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center gap-2 text-slate-500">
        {props.icon}
        <span className="text-xs font-semibold uppercase tracking-[0.16em]">{props.label}</span>
      </div>
      <div className="mt-2 text-xl font-bold text-slate-900">{props.value}</div>
    </div>
  )
}
