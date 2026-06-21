import Link from 'next/link'
import type { ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, ChevronRight } from 'lucide-react'
export function Panel(props: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-slate-900">{props.title}</h3>
        <p className="mt-1 text-sm text-slate-500">{props.description}</p>
      </div>
      {props.children}
    </section>
  )
}


export function QuickLink(props: { href: string; label: string }) {
  return (
    <Link href={props.href} className="inline-flex items-center rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
      {props.label}
      <ChevronRight className="ml-1 h-4 w-4" />
    </Link>
  )
}

export function MetricCard(props: {
  label: string
  value: string
  help: string
  compact?: boolean
  variant?: 'default' | 'muted' | 'warning'
  emphasized?: boolean
}) {
  const variant = props.variant ?? 'default'
  const palette =
    variant === 'warning'
      ? 'border-amber-200 bg-amber-50'
      : variant === 'muted'
        ? 'border-slate-200 bg-slate-50/60'
        : 'border-slate-200 bg-slate-50'
  const valueTone =
    variant === 'warning'
      ? 'text-amber-900'
      : variant === 'muted'
        ? 'text-slate-400'
        : props.emphasized
          ? 'text-slate-900'
          : 'text-slate-900'
  const labelTone =
    variant === 'warning'
      ? 'text-amber-700'
      : variant === 'muted'
        ? 'text-slate-400'
        : 'text-slate-400'
  const helpTone =
    variant === 'warning'
      ? 'text-amber-700'
      : variant === 'muted'
        ? 'text-slate-400'
        : 'text-slate-500'
  return (
    <div className={`rounded-2xl border ${palette} ${props.compact ? 'px-4 py-3' : 'p-4'}`}>
      <div className={`text-xs uppercase tracking-[0.16em] ${labelTone}`}>{props.label}</div>
      <div className={`mt-2 text-xl font-semibold ${valueTone}`}>{props.value}</div>
      <div className={`mt-1 text-xs ${helpTone}`}>{props.help}</div>
    </div>
  )
}

export function SummaryStat(props: {
  label: string
  value: string
  help: string
  emphasized: boolean
  variant?: 'default' | 'warning'
}) {
  const isWarning = props.variant === 'warning'
  const muted = !props.emphasized
  const containerClass = isWarning
    ? 'border-amber-200 bg-amber-50'
    : muted
      ? 'border-slate-200 bg-white'
      : 'border-slate-200 bg-white'
  const valueClass = isWarning
    ? 'text-amber-900'
    : muted
      ? 'text-slate-400'
      : 'text-slate-900'
  const labelClass = isWarning ? 'text-amber-700' : muted ? 'text-slate-400' : 'text-slate-500'
  const helpClass = isWarning ? 'text-amber-700/80' : muted ? 'text-slate-400' : 'text-slate-500'
  return (
    <div
      className={`flex flex-col gap-0.5 rounded-xl border px-3 py-2 ${containerClass}`}
    >
      <span className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${labelClass}`}>
        {props.label}
      </span>
      <span className={`text-lg font-semibold leading-tight ${valueClass}`}>{props.value}</span>
      <span className={`text-[11px] leading-tight ${helpClass}`}>{props.help}</span>
    </div>
  )
}

export function Banner(props: { tone: 'success' | 'error' | 'warn'; message: string }) {
  const palette =
    props.tone === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : props.tone === 'warn'
        ? 'border-amber-200 bg-amber-50 text-amber-800'
        : 'border-rose-200 bg-rose-50 text-rose-800'

  return (
    <div className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm ${palette}`}>
      {props.tone === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
      <span>{props.message}</span>
    </div>
  )
}

export function Badge(props: { tone: 'success' | 'warn' | 'error' | 'neutral'; children: ReactNode }) {
  const palette =
    props.tone === 'success'
      ? 'bg-emerald-100 text-emerald-700'
      : props.tone === 'warn'
        ? 'bg-amber-100 text-amber-700'
        : props.tone === 'error'
          ? 'bg-rose-100 text-rose-700'
          : 'bg-slate-100 text-slate-600'

  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${palette}`}>{props.children}</span>
}

export function EmptyBlock(props: { message: string }) {
  return <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">{props.message}</div>
}

export function SectionTitle(props: { title: string }) {
  return <h4 className="mb-3 mt-6 text-sm font-semibold text-slate-900 first:mt-0">{props.title}</h4>
}


