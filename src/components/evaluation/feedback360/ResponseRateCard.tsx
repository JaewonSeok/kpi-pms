'use client'

import { AlertTriangle, CheckCircle2, Clock3 } from 'lucide-react'

type ResponseRateCardProps = {
  title: string
  responseRate: number
  submittedCount: number
  pendingCount?: number
  thresholdMet?: boolean
  description?: string
}

export function ResponseRateCard(props: ResponseRateCardProps) {
  const tone =
    props.responseRate >= 80 ? 'success' : props.responseRate >= 50 ? 'warn' : 'error'

  const icon =
    tone === 'success' ? (
      <CheckCircle2 className="h-5 w-5" />
    ) : tone === 'warn' ? (
      <Clock3 className="h-5 w-5" />
    ) : (
      <AlertTriangle className="h-5 w-5" />
    )

  const iconClass =
    tone === 'success'
      ? 'text-emerald-600'
      : tone === 'warn'
        ? 'text-amber-600'
        : 'text-rose-600'

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className={`flex items-center gap-2 ${iconClass}`}>
        {icon}
        <span className="text-sm font-semibold text-slate-900">{props.title}</span>
      </div>
      <div className="mt-3 text-2xl font-bold text-slate-900">{props.responseRate}%</div>
      <div className="mt-2 text-sm text-slate-500">
        제출 {props.submittedCount}건
        {typeof props.pendingCount === 'number' ? ` · 미응답 ${props.pendingCount}건` : ''}
      </div>
      {props.description ? <div className="mt-2 text-xs text-slate-500">{props.description}</div> : null}
      {typeof props.thresholdMet === 'boolean' ? (
        <div className="mt-3 text-xs font-medium text-slate-600">
          {props.thresholdMet ? '익명 기준을 충족했습니다.' : '익명 기준을 아직 충족하지 못했습니다.'}
        </div>
      ) : null}
    </div>
  )
}
