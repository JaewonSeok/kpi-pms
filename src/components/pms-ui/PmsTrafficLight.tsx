import { ChevronDown } from 'lucide-react'
import type { PmsSignal } from './types'

const SIGNAL_CLASS: Record<PmsSignal, string> = {
  green: 'bg-emerald-500 shadow-emerald-200',
  amber: 'bg-amber-500 shadow-amber-200',
  red: 'bg-rose-500 shadow-rose-200',
  gray: 'bg-slate-300 shadow-slate-200',
}

const BASE_CLASS =
  'inline-flex items-start gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-left shadow-sm'

export function PmsTrafficLight({
  signal,
  label,
  description,
  onClick,
  expanded,
}: {
  signal: PmsSignal
  label: string
  description?: string
  onClick?: () => void
  expanded?: boolean
}) {
  const inner = (
    <>
      <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full shadow-md ${SIGNAL_CLASS[signal]}`} />
      <span className="min-w-0">
        <span className="block text-xs font-bold text-slate-900">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-[11px] leading-4 text-slate-500">{description}</span>
        ) : null}
      </span>
      {onClick ? (
        <ChevronDown
          className={`ml-0.5 mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform${expanded ? ' rotate-180' : ''}`}
        />
      ) : null}
    </>
  )

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${BASE_CLASS} cursor-pointer transition hover:ring-1 hover:ring-blue-200`}
      >
        {inner}
      </button>
    )
  }

  return <div className={BASE_CLASS}>{inner}</div>
}
