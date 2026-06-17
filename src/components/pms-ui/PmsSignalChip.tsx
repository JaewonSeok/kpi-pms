import type { ReactNode } from 'react'
import type { PmsTone } from './types'

const TONE_CLASS: Record<PmsTone, string> = {
  neutral: 'border-slate-200 bg-slate-100 text-slate-700',
  info: 'border-blue-200 bg-blue-50 text-blue-700',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  danger: 'border-rose-200 bg-rose-50 text-rose-700',
  locked: 'border-violet-200 bg-violet-50 text-violet-700',
  ai: 'border-indigo-200 bg-indigo-50 text-indigo-700',
}

export function PmsSignalChip({
  children,
  tone = 'neutral',
  icon,
  className = '',
}: {
  children: ReactNode
  tone?: PmsTone
  icon?: ReactNode
  className?: string
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${TONE_CLASS[tone]} ${className}`}
    >
      {icon}
      {children}
    </span>
  )
}
