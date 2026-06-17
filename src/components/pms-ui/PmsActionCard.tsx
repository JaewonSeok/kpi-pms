import type { ReactNode } from 'react'

const TONE_CLASS = {
  neutral: 'border-blue-100 bg-white text-blue-900 ring-1 ring-blue-50',
  warning: 'border-amber-200 bg-white text-amber-900 ring-1 ring-amber-100',
  danger: 'border-rose-200 bg-white text-rose-900 ring-1 ring-rose-100',
}

export function PmsActionCard({
  icon,
  title,
  label,
  description,
  statusLabel,
  done,
  actionLabel,
  disabledReason,
  onClick,
  tone = 'neutral',
}: {
  icon: ReactNode
  title?: string
  label?: string
  description: string
  statusLabel?: string
  done?: boolean
  actionLabel?: string
  disabledReason?: string
  onClick?: () => void
  tone?: keyof typeof TONE_CLASS
}) {
  const resolvedTitle = title ?? label ?? ''
  const resolvedStatus = statusLabel ?? (done ? '완료' : '확인 필요')
  const resolvedAction = actionLabel ?? (done ? '상태 보기' : '바로 이동')
  const content = (
    <>
      <span className="mt-0.5 rounded-xl bg-slate-50 p-2 text-current shadow-sm">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">{resolvedTitle}</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              done ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'
            }`}
          >
            {resolvedStatus}
          </span>
        </span>
        <span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span>
        {disabledReason ? <span className="mt-1 block text-[11px] leading-4 text-slate-500">{disabledReason}</span> : null}
        {onClick ? (
          <span className="mt-2 inline-flex items-center rounded-full bg-slate-900 px-2.5 py-0.5 text-[11px] font-semibold text-white transition group-hover:bg-blue-700">
            {resolvedAction}
          </span>
        ) : null}
      </span>
    </>
  )

  if (!onClick) {
    return (
      <div className={`flex min-h-[76px] items-start gap-3 rounded-2xl border p-3 text-left shadow-sm ${TONE_CLASS[tone]}`}>
        {content}
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex min-h-[76px] items-start gap-3 rounded-2xl border p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${TONE_CLASS[tone]}`}
    >
      {content}
    </button>
  )
}
