import type { ReactNode } from 'react'

export function PmsEmptyIllustration({
  message,
  description,
  action,
  className = '',
}: {
  message?: string
  description?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={`text-center ${className}`}>
      <svg aria-hidden="true" viewBox="0 0 160 104" className="mx-auto h-24 w-40 text-blue-200" role="img">
        <defs>
          <linearGradient id="pms-empty-gradient" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#DBEAFE" />
            <stop offset="100%" stopColor="#ECFDF5" />
          </linearGradient>
        </defs>
        <rect x="18" y="18" width="124" height="72" rx="18" fill="url(#pms-empty-gradient)" />
        <rect x="38" y="36" width="84" height="8" rx="4" fill="currentColor" opacity="0.7" />
        <rect x="38" y="52" width="56" height="8" rx="4" fill="currentColor" opacity="0.45" />
        <circle cx="112" cy="60" r="14" fill="#FFFFFF" opacity="0.85" />
        <path d="M106 60l4 4 8-10" fill="none" stroke="#2563EB" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {message ? <p className="mt-4 text-sm font-semibold text-slate-900">{message}</p> : null}
      {description ? <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}
