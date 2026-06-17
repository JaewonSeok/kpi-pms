import type { ReactNode } from 'react'
import type { PmsTone } from './types'
import { PmsSignalChip } from './PmsSignalChip'

const CARD_TONE_CLASS: Record<PmsTone, string> = {
  neutral: 'border-slate-200 bg-white text-slate-900',
  info: 'border-blue-200 bg-blue-50/80 text-blue-900',
  success: 'border-emerald-200 bg-emerald-50/80 text-emerald-900',
  warning: 'border-amber-200 bg-amber-50/80 text-amber-900',
  danger: 'border-rose-200 bg-rose-50/80 text-rose-900',
  locked: 'border-violet-200 bg-violet-50/80 text-violet-900',
  ai: 'border-indigo-200 bg-indigo-50/80 text-indigo-900',
}

export function PmsSummaryCard({
  icon,
  label,
  value,
  helper,
  chip,
  tone = 'neutral',
  trend,
  compact = true,
}: {
  icon?: ReactNode
  label: string
  value: string
  helper?: string
  chip?: string
  tone?: PmsTone | 'good'
  trend?: ReactNode
  compact?: boolean
}) {
  const normalizedTone: PmsTone = tone === 'good' ? 'success' : tone

  if (compact) {
    return (
      <div className={`flex min-h-[52px] items-center gap-2 rounded-2xl border px-3 py-2 shadow-sm ${CARD_TONE_CLASS[normalizedTone]}`}>
        {icon ? <span className="rounded-xl bg-white/85 p-1.5 shadow-sm">{icon}</span> : null}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <span className="text-base font-bold tracking-tight">{value}</span>
            <span className="truncate text-xs font-semibold text-current/75">{label}</span>
          </div>
          {helper ? <p className="sr-only">{helper}</p> : null}
        </div>
        {trend}
        {chip ? <PmsSignalChip tone={normalizedTone} className="shrink-0 px-2 py-0.5 text-[10px]">{chip}</PmsSignalChip> : null}
      </div>
    )
  }

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${CARD_TONE_CLASS[normalizedTone]}`}>
      <div className="flex items-start justify-between gap-3">
        {icon ? <span className="rounded-xl bg-white/85 p-2 shadow-sm">{icon}</span> : null}
        {chip ? <PmsSignalChip tone={normalizedTone}>{chip}</PmsSignalChip> : null}
      </div>
      <div className="mt-3 text-2xl font-bold tracking-tight">{value}</div>
      <div className="mt-1 text-sm font-semibold text-current/80">{label}</div>
      {helper ? <p className="mt-2 text-xs leading-5 text-current/65">{helper}</p> : null}
      {trend ? <div className="mt-3">{trend}</div> : null}
    </div>
  )
}
