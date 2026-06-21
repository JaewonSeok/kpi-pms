'use client'

import type { ReactNode } from 'react'
import { Bell, Mail, RotateCcw, Send, X } from 'lucide-react'
import type { Feedback360MailReadinessViewModel } from './feedback360MailReadiness'

type Feedback360MailReadinessPanelProps = {
  model: Feedback360MailReadinessViewModel
  previewOpen: boolean
  resultOpen: boolean
  onOpenPreview: () => void
  onClosePreview: () => void
  onOpenResult: () => void
  onCloseResult: () => void
  compact?: boolean
}

function toneClass(tone?: 'emerald' | 'amber' | 'rose' | 'slate') {
  switch (tone) {
    case 'emerald':
      return 'border-emerald-100 bg-emerald-50 text-emerald-800'
    case 'amber':
      return 'border-amber-100 bg-amber-50 text-amber-900'
    case 'rose':
      return 'border-rose-100 bg-rose-50 text-rose-800'
    default:
      return 'border-slate-200 bg-white text-slate-700'
  }
}

function ActionButton(props: {
  children: ReactNode
  disabled?: boolean
  onClick?: () => void
  tone?: 'primary' | 'secondary'
}) {
  const tone = props.tone ?? 'secondary'
  const className =
    tone === 'primary'
      ? 'bg-blue-600 text-white shadow-sm hover:bg-blue-700 disabled:bg-blue-200 disabled:text-blue-50'
      : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:text-slate-300'

  return (
    <button
      type="button"
      disabled={props.disabled}
      onClick={props.onClick}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition disabled:cursor-not-allowed ${className}`}
    >
      {props.children}
    </button>
  )
}

export function Feedback360MailReadinessPanel(props: Feedback360MailReadinessPanelProps) {
  const { model } = props
  const gridClass = props.compact ? 'sm:grid-cols-2 xl:grid-cols-3' : 'sm:grid-cols-2 xl:grid-cols-4'
  const isResultShare = model.alertType.includes('결과 공유')
  const previewActionLabel = isResultShare ? '공유 미리보기' : '발송 미리보기'
  const resultActionLabel = isResultShare ? '공유 대상 확인' : '발송 결과'

  return (
    <section className="rounded-[22px] border border-blue-100 bg-blue-50 p-5 shadow-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-blue-600">
              <Bell className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-base font-extrabold text-slate-950">메일/알림 준비 상태</h2>
              <p className="mt-1 text-sm font-semibold text-slate-600">
                {model.contextLabel} · {model.alertType}
              </p>
            </div>
            <span className={`rounded-full border px-3 py-1 text-xs font-bold ${toneClass(model.statusTone)}`}>
              {model.statusLabel}
            </span>
          </div>

          <div className="mt-4 text-xs font-extrabold uppercase tracking-[0.14em] text-blue-700">대상자 진단</div>
          <div className={`mt-2 grid gap-2 ${gridClass}`}>
            {model.summaryRows.map((row) => (
              <div key={row.label} className={`rounded-xl border px-3 py-2 ${toneClass(row.tone)}`}>
                <div className="text-[11px] font-bold text-slate-500">{row.label}</div>
                <div className="mt-1 text-sm font-extrabold">{row.value}</div>
              </div>
            ))}
          </div>

          <div className="mt-4 text-xs font-extrabold uppercase tracking-[0.14em] text-blue-700">채널 상태</div>
          <div className="mt-2 grid gap-3 md:grid-cols-3">
            {model.channelCards.map((card) => (
              <div
                key={card.id}
                className={`rounded-2xl border px-4 py-3 ${
                  card.available ? 'border-emerald-100 bg-white' : 'border-slate-200 bg-white/70'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-extrabold text-slate-950">
                    <Mail className="h-4 w-4 text-blue-600" />
                    {card.label}
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                      card.available ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'
                    }`}
                  >
                    {card.statusLabel}
                  </span>
                </div>
                <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">{card.description}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-2 text-xs font-bold text-blue-950 md:grid-cols-2">
            {model.guidance.map((message) => (
              <div key={message} className="rounded-xl border border-blue-100 bg-white px-3 py-2">
                {message}
              </div>
            ))}
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2 xl:w-48">
          <ActionButton disabled>
            <Send className="h-4 w-4" />
            리마인드 알림 준비
          </ActionButton>
          <ActionButton disabled>
            <Send className="h-4 w-4" />
            결과 공유 준비
          </ActionButton>
          <ActionButton disabled={!model.canPreview} onClick={props.onOpenPreview} tone="primary">
            {previewActionLabel}
          </ActionButton>
          <ActionButton onClick={props.onOpenResult}>
            {resultActionLabel}
          </ActionButton>
        </div>
      </div>

      {props.previewOpen ? (
        <div className="mt-4 rounded-2xl border border-blue-200 bg-white p-4" role="dialog" aria-label="발송 미리보기">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-extrabold text-slate-950">발송 미리보기</div>
              <p className="mt-1 text-xs font-semibold text-slate-500">{model.preview.recipientsLabel}</p>
            </div>
            <button
              type="button"
              onClick={props.onClosePreview}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50"
              aria-label="발송 미리보기 닫기"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
            <div className="font-bold text-slate-950">{model.preview.subject}</div>
            <p className="mt-2">{model.preview.body}</p>
            <p className="mt-2 text-xs font-bold text-blue-700">{model.preview.channelLabel}</p>
          </div>
          <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs font-bold leading-5 text-amber-900">
            {model.preview.safetyCopy}
          </div>
        </div>
      ) : null}

      {props.resultOpen ? (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4" role="status" aria-label="발송 결과">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-sm font-extrabold text-slate-950">{model.result.title}</div>
              <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">{model.result.message}</p>
            </div>
            <div className="flex gap-2">
              <ActionButton disabled>
                <RotateCcw className="h-4 w-4" />
                다시 시도
              </ActionButton>
              <ActionButton onClick={props.onCloseResult}>닫기</ActionButton>
            </div>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['완료', model.result.successCount],
              ['실패', model.result.failureCount],
              ['스킵', model.result.skippedCount],
              ['이메일 완료', model.result.emailSuccessCount],
              ['이메일 실패', model.result.emailFailureCount],
              ['앱 알림 완료', model.result.appSuccessCount],
              ['앱 알림 실패', model.result.appFailureCount],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                <div className="text-[11px] font-bold text-slate-500">{label}</div>
                <div className="mt-1 text-sm font-extrabold text-slate-950">{value}건</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  )
}
