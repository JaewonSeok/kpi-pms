'use client'

import { useState, type ReactNode } from 'react'
import { Bot, Lightbulb, MessageSquareQuote, Sparkles } from 'lucide-react'

type GrowthCopilotPanelProps = {
  sourceId: string
  disclaimer: string
  recommendedCompetencies: string[]
  recentGoals: string[]
  recentCheckins: string[]
  feedbackSignals: string[]
  aiPayload?: Record<string, unknown>
}

type GrowthCopilotPreview = {
  source: 'ai' | 'fallback' | 'disabled'
  fallbackReason?: string | null
  result: {
    summary?: string
    growthAreas?: string[]
    recommendedCompetencies?: string[]
    oneOnOneQuestions?: string[]
    coachingDraft?: string
    promotionReadinessHint?: string
  }
}

export function GrowthCopilotPanel(props: GrowthCopilotPanelProps) {
  const [preview, setPreview] = useState<GrowthCopilotPreview | null>(null)
  const [busy, setBusy] = useState(false)
  const [errorNotice, setErrorNotice] = useState('')

  async function handleGenerate() {
    if (!props.aiPayload) return
    setBusy(true)
    setErrorNotice('')

    try {
      const response = await fetch('/api/feedback/360/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'suggest-growth-copilot',
          sourceId: props.sourceId,
          payload: props.aiPayload,
        }),
      })
      const json = await response.json()
      if (!json.success) {
        throw new Error(json.error?.message || '성장 코파일럿 제안을 불러오지 못했습니다.')
      }
      setPreview(json.data)
    } catch (error) {
      setErrorNotice(error instanceof Error ? error.message : '성장 코파일럿 제안 생성에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">AI 성장 코파일럿</h3>
          <p className="mt-1 text-sm text-slate-500">
            최근 리뷰, 목표, 1:1 기록을 바탕으로 성장 포인트와 다음 코칭 질문 초안을 제안합니다.
          </p>
        </div>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={busy || !props.aiPayload}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
        >
          <Bot className="h-4 w-4" />
          {busy ? 'AI 제안 생성 중..' : 'AI 성장 제안 생성'}
        </button>
      </div>

      <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        {props.disclaimer}
      </div>

      {errorNotice ? (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {errorNotice}
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        <CopilotContextCard
          title="추천 역량"
          icon={<Sparkles className="h-4 w-4 text-blue-500" />}
          items={props.recommendedCompetencies}
          emptyMessage="추천 역량이 아직 없습니다."
        />
        <CopilotContextCard
          title="최근 목표 흐름"
          icon={<Lightbulb className="h-4 w-4 text-emerald-500" />}
          items={props.recentGoals}
          emptyMessage="최근 목표 기록이 없습니다."
        />
        <CopilotContextCard
          title="최근 1:1 / 피드백 신호"
          icon={<MessageSquareQuote className="h-4 w-4 text-violet-500" />}
          items={[...props.recentCheckins, ...props.feedbackSignals].slice(0, 6)}
          emptyMessage="최근 코칭 근거가 아직 충분하지 않습니다."
        />
      </div>

      {preview ? (
        <div className="mt-5 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="rounded-full bg-white px-3 py-1 font-medium text-slate-700">
              {preview.source === 'ai' ? 'AI 초안' : 'Fallback 초안'}
            </span>
            {preview.fallbackReason ? <span>{preview.fallbackReason}</span> : null}
          </div>

          {preview.result.summary ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-900">요약</div>
              <p className="mt-2 text-sm leading-6 text-slate-700">{preview.result.summary}</p>
            </div>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-2">
            <CopilotResultList
              title="성장 포인트"
              items={preview.result.growthAreas ?? []}
              emptyMessage="성장 포인트가 아직 없습니다."
            />
            <CopilotResultList
              title="1:1 질문 제안"
              items={preview.result.oneOnOneQuestions ?? []}
              emptyMessage="1:1 질문 제안이 아직 없습니다."
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <CopilotResultList
              title="추천 역량"
              items={preview.result.recommendedCompetencies ?? []}
              emptyMessage="추천 역량이 아직 없습니다."
            />
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-900">승진 준비도 힌트</div>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                {preview.result.promotionReadinessHint || '승진 준비도 힌트가 아직 없습니다.'}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-sm font-semibold text-slate-900">코칭 메시지 초안</div>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
              {preview.result.coachingDraft || '코칭 메시지 초안이 아직 없습니다.'}
            </p>
          </div>
        </div>
      ) : null}
    </section>
  )
}

function CopilotContextCard(props: {
  title: string
  icon: ReactNode
  items: string[]
  emptyMessage: string
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        {props.icon}
        {props.title}
      </div>
      <div className="mt-3 space-y-2">
        {props.items.length ? (
          props.items.map((item) => (
            <div key={item} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
              {item}
            </div>
          ))
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white px-3 py-4 text-sm text-slate-500">
            {props.emptyMessage}
          </div>
        )}
      </div>
    </div>
  )
}

function CopilotResultList(props: { title: string; items: string[]; emptyMessage: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="text-sm font-semibold text-slate-900">{props.title}</div>
      <div className="mt-3 space-y-2">
        {props.items.length ? (
          props.items.map((item) => (
            <div key={item} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {item}
            </div>
          ))
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
            {props.emptyMessage}
          </div>
        )}
      </div>
    </div>
  )
}
