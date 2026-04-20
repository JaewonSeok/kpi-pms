'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export const inputClassName =
  'w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200'

export const textareaClassName = `${inputClassName} min-h-[120px] resize-y`

export const primaryButtonClassName =
  'inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300'

export const secondaryButtonClassName =
  'inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300'

export const dangerButtonClassName =
  'inline-flex items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:text-rose-300'

export function formatDateTime(value?: string) {
  if (!value) return '-'
  return new Date(value).toLocaleString('ko-KR')
}

export function formatDateOnly(value?: string) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('ko-KR')
}

export function formatFileSize(sizeBytes?: number) {
  if (!sizeBytes || sizeBytes <= 0) return '-'
  if (sizeBytes < 1024) return `${sizeBytes}B`
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)}KB`
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)}MB`
}

export function toLocalDateTimeInput(value?: string) {
  if (!value) return ''
  const date = new Date(value)
  const offset = date.getTimezoneOffset()
  const local = new Date(date.getTime() - offset * 60 * 1000)
  return local.toISOString().slice(0, 16)
}

export function toIsoFromLocal(value: string) {
  return value ? new Date(value).toISOString() : undefined
}

export function PageShell(props: { title: string; description: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-slate-950">{props.title}</h1>
          <p className="max-w-3xl text-sm leading-6 text-slate-600">{props.description}</p>
        </div>
        {props.actions ? <div className="flex flex-wrap gap-3">{props.actions}</div> : null}
      </div>
      {props.children}
    </div>
  )
}

export function SectionCard(props: { title: string; description?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-slate-950">{props.title}</h2>
          {props.description ? <p className="text-sm leading-6 text-slate-500">{props.description}</p> : null}
        </div>
        {props.action}
      </div>
      {props.children}
    </section>
  )
}

export function Field(props: { label: string; hint?: string; children: ReactNode; required?: boolean }) {
  return (
    <label className="grid gap-2 text-sm font-medium text-slate-700">
      <span className="flex items-center gap-2">
        {props.label}
        {props.required ? <span className="text-rose-500">*</span> : null}
      </span>
      {props.children}
      {props.hint ? <span className="text-xs font-normal text-slate-500">{props.hint}</span> : null}
    </label>
  )
}

export function StatusPill(props: {
  value: string
  tone?: 'neutral' | 'success' | 'warning' | 'danger'
}) {
  const toneClass =
    props.tone === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : props.tone === 'warning'
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : props.tone === 'danger'
          ? 'border-rose-200 bg-rose-50 text-rose-700'
          : 'border-slate-200 bg-slate-50 text-slate-600'

  return <span className={cn('rounded-full border px-3 py-1 text-xs font-medium', toneClass)}>{props.value}</span>
}

export function EmptyBox(props: {
  title: string
  description: string
  action?: ReactNode
  tone?: 'info' | 'warning'
}) {
  return (
    <div
      className={cn(
        'rounded-3xl border px-6 py-8 shadow-sm',
        props.tone === 'warning' ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50'
      )}
    >
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-slate-950">{props.title}</h3>
        <p className="max-w-3xl text-sm leading-6 text-slate-600">{props.description}</p>
      </div>
      {props.action ? <div className="mt-5 flex flex-wrap gap-3">{props.action}</div> : null}
    </div>
  )
}

export function MetricCard(props: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
      <p className="text-xs font-medium text-slate-500">{props.label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-950">{props.value}</p>
      {props.hint ? <p className="mt-1 text-xs text-slate-500">{props.hint}</p> : null}
    </div>
  )
}

export function InfoRow(props: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs font-medium text-slate-500">{props.label}</p>
      <div className="mt-1 text-sm font-semibold text-slate-900">{props.value}</div>
    </div>
  )
}

export function StateScreen(props: {
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
      <h1 className="text-2xl font-semibold text-slate-950">{props.title}</h1>
      <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-600">{props.description}</p>
      {props.action ? <div className="mt-6 flex justify-center gap-3">{props.action}</div> : null}
    </div>
  )
}

export function NoticeBanner(props: {
  tone: 'success' | 'error' | 'warning' | 'info'
  title: string
  description?: string
}) {
  const toneClass =
    props.tone === 'success'
      ? 'border-emerald-200 bg-emerald-50'
      : props.tone === 'error'
        ? 'border-rose-200 bg-rose-50'
        : props.tone === 'warning'
          ? 'border-amber-200 bg-amber-50'
          : 'border-sky-200 bg-sky-50'

  return (
    <div className={cn('rounded-2xl border px-4 py-3', toneClass)}>
      <p className="text-sm font-semibold text-slate-900">{props.title}</p>
      {props.description ? <p className="mt-1 text-sm text-slate-700">{props.description}</p> : null}
    </div>
  )
}

export function DefinitionList(props: { items: Array<{ label: string; value: ReactNode }> }) {
  return (
    <dl className="grid gap-3 md:grid-cols-2">
      {props.items.map((item) => (
        <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <dt className="text-xs font-medium text-slate-500">{item.label}</dt>
          <dd className="mt-1 text-sm font-semibold text-slate-900">{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}
