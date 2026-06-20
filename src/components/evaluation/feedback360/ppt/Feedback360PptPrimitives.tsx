'use client'

import { AlertCircle, CheckCircle2, CircleDotDashed, Clock3, X } from 'lucide-react'

export type Feedback360PptSummaryCard = {
  label: string
  value: string
  helper?: string
  tone?: 'blue' | 'green' | 'amber' | 'rose' | 'slate'
  icon?: 'users' | 'done' | 'progress' | 'pending' | 'clock'
}

const TONE_CLASS_NAMES = {
  blue: 'border-blue-100 bg-blue-50 text-blue-700',
  green: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  amber: 'border-amber-100 bg-amber-50 text-amber-700',
  rose: 'border-rose-100 bg-rose-50 text-rose-700',
  slate: 'border-slate-200 bg-slate-50 text-slate-700',
} as const

function SummaryIcon(props: { icon?: Feedback360PptSummaryCard['icon']; tone: NonNullable<Feedback360PptSummaryCard['tone']> }) {
  const className = 'h-5 w-5'
  switch (props.icon) {
    case 'done':
      return <CheckCircle2 className={className} />
    case 'progress':
      return <CircleDotDashed className={className} />
    case 'pending':
      return <AlertCircle className={className} />
    case 'clock':
      return <Clock3 className={className} />
    default:
      return <CircleDotDashed className={className} />
  }
}

export function Feedback360PptSummaryCards(props: { cards: Feedback360PptSummaryCard[] }) {
  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {props.cards.map((card) => {
        const tone = card.tone ?? 'slate'
        return (
          <article key={card.label} className="rounded-[18px] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-slate-500">{card.label}</div>
                <div className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{card.value}</div>
              </div>
              <span className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl border ${TONE_CLASS_NAMES[tone]}`}>
                <SummaryIcon icon={card.icon} tone={tone} />
              </span>
            </div>
            {card.helper ? <div className="mt-3 text-xs font-semibold text-slate-400">{card.helper}</div> : null}
          </article>
        )
      })}
    </section>
  )
}

export function Feedback360PptEmptyState(props: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <section className="rounded-[20px] border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm">
        <AlertCircle className="h-5 w-5" />
      </div>
      <h2 className="mt-4 text-base font-bold text-slate-900">{props.title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">{props.description}</p>
      {props.action ? <div className="mt-4 flex justify-center">{props.action}</div> : null}
    </section>
  )
}

export function Feedback360PptToastDialog(props: {
  tone?: 'success' | 'error' | 'info'
  title: string
  message?: string
  onClose?: () => void
  action?: React.ReactNode
}) {
  const toneClassName =
    props.tone === 'error'
      ? 'border-rose-200 bg-rose-50 text-rose-800'
      : props.tone === 'success'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
        : 'border-blue-200 bg-blue-50 text-blue-800'

  return (
    <div className={`rounded-2xl border px-4 py-3 text-sm shadow-sm ${toneClassName}`} data-min-duration-ms={8000}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-bold">{props.title}</div>
          {props.message ? <div className="mt-1 leading-6">{props.message}</div> : null}
          {props.action ? <div className="mt-3">{props.action}</div> : null}
        </div>
        {props.onClose ? (
          <button type="button" onClick={props.onClose} className="rounded-full p-1 hover:bg-white/60" aria-label="메시지 닫기">
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </div>
  )
}
