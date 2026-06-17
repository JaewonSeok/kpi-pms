import type { ReactNode } from 'react'

export function PmsDetailPanel({
  eyebrow,
  title,
  description,
  status,
  metrics,
  children,
  footer,
  sticky = false,
  className = '',
}: {
  eyebrow?: ReactNode
  title: ReactNode
  description?: ReactNode
  status?: ReactNode
  metrics?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  sticky?: boolean
  className?: string
}) {
  return (
    <aside
      className={`overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm ${
        sticky ? 'xl:sticky xl:top-4' : ''
      } ${className}`}
    >
      <div className="border-b border-slate-100 bg-gradient-to-br from-white via-slate-50 to-blue-50/50 p-5">
        {eyebrow}
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-slate-950">{title}</h2>
            {description ? <div className="mt-1 text-sm leading-6 text-slate-500">{description}</div> : null}
          </div>
          {status}
        </div>
        {metrics ? <div className="mt-4">{metrics}</div> : null}
      </div>
      {children ? <div className="p-5">{children}</div> : null}
      {footer ? <div className="border-t border-slate-100 bg-white/95 p-3">{footer}</div> : null}
    </aside>
  )
}
