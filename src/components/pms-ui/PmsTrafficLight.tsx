import type { PmsSignal } from './types'

const SIGNAL_CLASS: Record<PmsSignal, string> = {
  green: 'bg-emerald-500 shadow-emerald-200',
  amber: 'bg-amber-500 shadow-amber-200',
  red: 'bg-rose-500 shadow-rose-200',
  gray: 'bg-slate-300 shadow-slate-200',
}

export function PmsTrafficLight({
  signal,
  label,
  description,
}: {
  signal: PmsSignal
  label: string
  description?: string
}) {
  return (
    <div className="inline-flex items-start gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-left shadow-sm">
      <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full shadow-md ${SIGNAL_CLASS[signal]}`} />
      <span className="min-w-0">
        <span className="block text-xs font-bold text-slate-900">{label}</span>
        {description ? <span className="mt-0.5 block text-[11px] leading-4 text-slate-500">{description}</span> : null}
      </span>
    </div>
  )
}
