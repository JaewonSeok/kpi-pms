import type { ReactNode } from 'react'

export function PmsWorkspaceSection({
  eyebrow,
  title,
  description,
  actions,
  children,
  className = '',
}: {
  eyebrow?: ReactNode
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-sm ${className}`}>
      <div className="bg-gradient-to-br from-white via-blue-50/60 to-slate-50 px-5 py-5 lg:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            {eyebrow}
            <h2 className="mt-3 text-xl font-bold tracking-tight text-slate-950">{title}</h2>
            {description ? <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">{description}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </div>
        {children}
      </div>
    </section>
  )
}
