'use client'

import type { Feedback360AvatarPerson } from './Feedback360Avatar'

export type Feedback360PptShellSection = 'dashboard' | 'response' | 'results' | 'operations' | 'mapping' | 'settings'

export type Feedback360PptUser = Feedback360AvatarPerson & {
  id?: string | null
  name: string
  department?: string | null
  position?: string | null
}

export type Feedback360PptControl = {
  label: string
  value: string
  onChange?: (value: string) => void
  options?: Array<{ value: string; label: string }>
}

type Feedback360PptAppShellProps = {
  user: Feedback360PptUser
  activeSection: Feedback360PptShellSection
  title: string
  subtitle?: string
  breadcrumb?: string[]
  statusLabel?: string
  dueLabel?: string
  controls?: Feedback360PptControl[]
  reportHref?: string
  sectionHrefs?: Partial<Record<Feedback360PptShellSection, string>>
  children: React.ReactNode
  rightRail?: React.ReactNode
}

type Feedback360PptHeaderProps = Pick<
  Feedback360PptAppShellProps,
  'title' | 'subtitle' | 'breadcrumb' | 'statusLabel' | 'dueLabel' | 'controls'
>

export function Feedback360PptAppShell(props: Feedback360PptAppShellProps) {
  return (
    <main className="min-w-0 w-full max-w-none bg-white px-5 py-8 sm:px-6 lg:px-6 xl:px-6">
      <Feedback360PptHeader
        title={props.title}
        subtitle={props.subtitle}
        breadcrumb={props.breadcrumb}
        statusLabel={props.statusLabel}
        dueLabel={props.dueLabel}
        controls={props.controls}
      />
      <div className="min-w-0 pt-7">
        <div className="min-w-0 w-full">{props.children}</div>
        {props.rightRail ? (
          <aside className="mt-6 min-w-0 w-full border-t border-slate-100 bg-slate-50 p-5 lg:p-6">
            {props.rightRail}
          </aside>
        ) : null}
      </div>
    </main>
  )
}

export function Feedback360PptHeader(props: Feedback360PptHeaderProps) {
  const [dueRemainingLabel, dueDateLabel] = props.dueLabel?.split(' · ') ?? []

  return (
    <header className="bg-white">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          {props.breadcrumb?.length ? (
            <div className="mb-2 flex flex-wrap gap-1 text-xs font-bold text-slate-400">
              {props.breadcrumb.map((item, index) => (
                <span key={`${item}:${index}`}>
                  {index ? <span className="mx-1 text-slate-300">&gt;</span> : null}
                  {item}
                </span>
              ))}
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[28px] font-extrabold leading-tight tracking-tight text-slate-950 sm:text-[32px]">
              {props.title}
            </h1>
            {props.statusLabel ? (
              <span className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                {props.statusLabel}
              </span>
            ) : null}
          </div>
          {props.subtitle ? <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-500">{props.subtitle}</p> : null}
        </div>

        <div className="flex flex-wrap items-stretch gap-3 2xl:flex-nowrap 2xl:justify-end">
          {props.controls?.map((control) => (
            <label
              key={control.label}
              className={`min-w-0 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm ${
                control.label === '평가 주기' ? 'w-full sm:w-[320px]' : 'w-full sm:w-[190px]'
              }`}
            >
              <span className="text-xs font-bold text-slate-500">{control.label}</span>
              {control.options?.length ? (
                <select
                  value={control.value}
                  onChange={(event) => control.onChange?.(event.target.value)}
                  className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none"
                >
                  {control.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="mt-2 text-sm font-bold text-slate-900">{control.value}</div>
              )}
            </label>
          ))}
          {props.dueLabel ? (
            <div className="w-full min-w-0 rounded-xl border border-rose-100 bg-white px-4 py-3 shadow-sm sm:w-[150px]">
              <div className="text-xs font-bold text-slate-700">종료일</div>
              <div className="mt-2 text-sm font-extrabold text-rose-600">{dueRemainingLabel}</div>
              {dueDateLabel ? <div className="mt-1 text-xs font-bold text-slate-500">{dueDateLabel}</div> : null}
            </div>
          ) : null}
        </div>
      </div>
    </header>
  )
}
