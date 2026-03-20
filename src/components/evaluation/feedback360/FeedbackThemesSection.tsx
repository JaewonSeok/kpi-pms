'use client'

import { useState } from 'react'
import { Bot, CheckCircle2 } from 'lucide-react'
import { AnonymityStatusBadge } from './AnonymityStatusBadge'

type FeedbackThemesSectionProps = {
  threshold: number
  feedbackCount: number
  thresholdMet: boolean
  anonymousSummary: string
  strengths: string[]
  improvements: string[]
  textHighlights: string[]
  aiPayload?: Record<string, unknown>
}

type AiPreview = {
  source: 'ai' | 'fallback' | 'disabled'
  fallbackReason?: string | null
  result: {
    anonymousSummary?: string
    strengths?: string[]
    blindSpots?: string[]
    textHighlights?: string[]
  }
}

export function FeedbackThemesSection(props: FeedbackThemesSectionProps) {
  const [preview, setPreview] = useState<AiPreview | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [applied, setApplied] = useState({
    anonymousSummary: props.anonymousSummary,
    strengths: props.strengths,
    improvements: props.improvements,
    textHighlights: props.textHighlights,
  })

  async function handleGenerate() {
    if (!props.aiPayload) return
    setBusy(true)
    setNotice('')

    try {
      const response = await fetch('/api/feedback/360/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'summarize-themes',
          payload: props.aiPayload,
        }),
      })
      const json = await response.json()
      if (!json.success) {
        throw new Error(json.error?.message || '익명 테마 요약을 생성하지 못했습니다.')
      }
      setPreview(json.data)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '익명 테마 요약 생성에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  function handleApplyPreview() {
    if (!preview) return
    setApplied({
      anonymousSummary: preview.result.anonymousSummary || applied.anonymousSummary,
      strengths: Array.isArray(preview.result.strengths) ? preview.result.strengths : applied.strengths,
      improvements: Array.isArray(preview.result.blindSpots)
        ? preview.result.blindSpots
        : applied.improvements,
      textHighlights: Array.isArray(preview.result.textHighlights)
        ? preview.result.textHighlights
        : applied.textHighlights,
    })
    setNotice('AI 테마 미리보기를 현재 화면에 반영했습니다. 자동 저장되지는 않습니다.')
    setPreview(null)
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">익명 테마 요약</h3>
          <p className="mt-1 text-sm text-slate-500">강점, 개선 포인트, 대표 코멘트를 익명 기준 안에서 요약합니다.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AnonymityStatusBadge
            threshold={props.threshold}
            feedbackCount={props.feedbackCount}
            thresholdMet={props.thresholdMet}
          />
          <button
            type="button"
            onClick={handleGenerate}
            disabled={busy || !props.aiPayload}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            <Bot className="h-4 w-4" />
            {busy ? 'AI 요약 생성 중...' : 'AI 테마 요약'}
          </button>
        </div>
      </div>

      {notice ? (
        <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          {notice}
        </div>
      ) : null}

      {preview ? (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-900">AI preview</div>
              <div className="mt-1 text-xs text-slate-500">
                {preview.source === 'ai'
                  ? 'OpenAI 응답 미리보기'
                  : `Fallback preview${preview.fallbackReason ? ` · ${preview.fallbackReason}` : ''}`}
              </div>
            </div>
            <button
              type="button"
              onClick={handleApplyPreview}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              <CheckCircle2 className="h-4 w-4" />
              미리보기 반영
            </button>
          </div>
          <pre className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-700">
            {JSON.stringify(preview.result, null, 2)}
          </pre>
        </div>
      ) : null}

      <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
        {applied.anonymousSummary}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <ThemeList title="강점 테마" items={applied.strengths} tone="positive" />
        <ThemeList title="개선 테마" items={applied.improvements} tone="attention" />
      </div>

      <div className="mt-5">
        <div className="text-sm font-semibold text-slate-900">대표 코멘트 하이라이트</div>
        <div className="mt-3 space-y-2">
          {applied.textHighlights.length ? (
            applied.textHighlights.map((item) => (
              <div key={item} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                {item}
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
              익명 기준을 충족하면 대표 코멘트 하이라이트를 보여줍니다.
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function ThemeList(props: { title: string; items: string[]; tone: 'positive' | 'attention' }) {
  const toneClass =
    props.tone === 'positive'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
      : 'border-amber-200 bg-amber-50 text-amber-900'

  return (
    <div className={`rounded-2xl border p-4 ${toneClass}`}>
      <div className="text-sm font-semibold">{props.title}</div>
      <div className="mt-3 space-y-2 text-sm">
        {props.items.map((item) => (
          <div key={item}>{item}</div>
        ))}
      </div>
    </div>
  )
}
