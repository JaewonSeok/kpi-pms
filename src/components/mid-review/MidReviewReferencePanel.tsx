'use client'

import { useEffect, useState } from 'react'
import { LoaderCircle } from 'lucide-react'

type MidReviewSummary = {
  reviewTypeLabel: string
  goalValidityLabel?: string
  decisionReason?: string
  expectedState?: string
  criteriaMeets?: string
  nextPeriodPlan?: string
  updatedAt?: string
  revisionRequested: boolean
} | null

function formatDateTime(value?: string) {
  if (!value) return '-'
  return new Date(value).toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

export function MidReviewReferencePanel({
  kind,
  targetId,
  title = '중간 점검',
  helper = '최근 중간 점검에서 합의된 목표 방향과 기대 상태를 확인합니다.',
  compact = false,
}: {
  kind: 'org-kpi' | 'personal-kpi' | 'employee'
  targetId?: string | null
  title?: string
  helper?: string
  compact?: boolean
}) {
  const [summary, setSummary] = useState<MidReviewSummary>(null)
  const [loading, setLoading] = useState(false)
  const [errorNotice, setErrorNotice] = useState('')

  useEffect(() => {
    if (!targetId) {
      setSummary(null)
      return
    }

    let active = true
    setLoading(true)
    setErrorNotice('')

    fetch(`/api/mid-review/summary?kind=${encodeURIComponent(kind)}&id=${encodeURIComponent(targetId)}`)
      .then(async (response) => {
        const json = await response.json()
        if (!response.ok || !json.success) {
          throw new Error(json?.error?.message ?? '중간 점검 요약을 불러오지 못했습니다.')
        }
        if (!active) return
        setSummary(json.data ?? null)
      })
      .catch((error) => {
        if (!active) return
        setErrorNotice(error instanceof Error ? error.message : '중간 점검 요약을 불러오지 못했습니다.')
      })
      .finally(() => {
        if (active) {
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [kind, targetId])

  return (
    <div className={`rounded-2xl border border-slate-200 bg-white ${compact ? 'p-4' : 'p-5'} shadow-sm`}>
      <div>
        <div className="text-sm font-semibold text-slate-900">{title}</div>
        <p className="mt-1 text-sm text-slate-500">{helper}</p>
      </div>

      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          중간 점검 요약을 불러오는 중입니다.
        </div>
      ) : errorNotice ? (
        <p className="mt-4 rounded-2xl bg-rose-50 px-3 py-3 text-sm text-rose-700">{errorNotice}</p>
      ) : summary ? (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              {summary.reviewTypeLabel}
            </span>
            {summary.goalValidityLabel ? (
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  summary.revisionRequested
                    ? 'bg-amber-50 text-amber-700'
                    : 'bg-emerald-50 text-emerald-700'
                }`}
              >
                {summary.goalValidityLabel}
              </span>
            ) : null}
          </div>
          {summary.decisionReason ? (
            <DetailBlock label="판단 사유" value={summary.decisionReason} />
          ) : null}
          {summary.expectedState ? (
            <DetailBlock label="기대 상태" value={summary.expectedState} />
          ) : null}
          {summary.criteriaMeets ? (
            <DetailBlock label="판단 기준" value={summary.criteriaMeets} />
          ) : null}
          {summary.nextPeriodPlan ? (
            <DetailBlock label="다음 기간 계획" value={summary.nextPeriodPlan} />
          ) : null}
          <div className="text-xs text-slate-400">최근 반영일 {formatDateTime(summary.updatedAt)}</div>
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-500">
          아직 반영된 중간 점검 요약이 없습니다.
        </div>
      )}
    </div>
  )
}

function DetailBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</div>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{value}</p>
    </div>
  )
}
