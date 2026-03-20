'use client'

import { useState } from 'react'
import { Bot, CheckCircle2, Save } from 'lucide-react'

type DevelopmentPlanPreviewProps = {
  employeeId: string
  sourceId: string
  focusArea: string
  actions: string[]
  managerSupport: string[]
  nextCheckinTopics: string[]
  existingPlan?: {
    id: string
    title: string
    status: string
    updatedAt: string
  }
  aiPayload?: Record<string, unknown>
}

type AiPreview = {
  source: 'ai' | 'fallback' | 'disabled'
  fallbackReason?: string | null
  result: {
    focusArea?: string
    actions?: string[]
    managerSupport?: string[]
    nextCheckinTopics?: string[]
  }
}

export function DevelopmentPlanPreview(props: DevelopmentPlanPreviewProps) {
  const [preview, setPreview] = useState<AiPreview | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [errorNotice, setErrorNotice] = useState('')
  const [applied, setApplied] = useState({
    focusArea: props.focusArea,
    actions: props.actions,
    managerSupport: props.managerSupport,
    nextCheckinTopics: props.nextCheckinTopics,
  })

  async function handleGenerate() {
    if (!props.aiPayload) return
    setBusy(true)
    setNotice('')
    setErrorNotice('')

    try {
      const response = await fetch('/api/feedback/360/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'suggest-development-plan',
          sourceId: props.sourceId,
          payload: props.aiPayload,
        }),
      })
      const json = await response.json()
      if (!json.success) {
        throw new Error(json.error?.message || '개발 계획 초안을 생성하지 못했습니다.')
      }
      setPreview(json.data)
    } catch (error) {
      setErrorNotice(error instanceof Error ? error.message : '개발 계획 초안 생성에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  function handleApplyPreview() {
    if (!preview) return
    setApplied({
      focusArea: preview.result.focusArea || applied.focusArea,
      actions: Array.isArray(preview.result.actions) ? preview.result.actions : applied.actions,
      managerSupport: Array.isArray(preview.result.managerSupport)
        ? preview.result.managerSupport
        : applied.managerSupport,
      nextCheckinTopics: Array.isArray(preview.result.nextCheckinTopics)
        ? preview.result.nextCheckinTopics
        : applied.nextCheckinTopics,
    })
    setNotice('AI 초안을 현재 화면에 반영했습니다. 저장 전 문구를 한 번 더 검토해 주세요.')
    setPreview(null)
  }

  async function handleSavePlan() {
    setBusy(true)
    setNotice('')
    setErrorNotice('')

    try {
      const response = await fetch('/api/development-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: props.employeeId,
          sourceType: 'FEEDBACK_360',
          sourceId: props.sourceId,
          title: `360 개발 계획 · ${applied.focusArea}`,
          focusArea: applied.focusArea,
          actions: applied.actions,
          managerSupport: applied.managerSupport,
          nextCheckinTopics: applied.nextCheckinTopics,
        }),
      })
      const json = await response.json()
      if (!json.success) {
        throw new Error(json.error?.message || '개발 계획 저장에 실패했습니다.')
      }
      setNotice('개발 계획을 저장했습니다. 이후 체크인과 평가 결과에서 다시 이어볼 수 있습니다.')
    } catch (error) {
      setErrorNotice(error instanceof Error ? error.message : '개발 계획 저장에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">개발 계획 미리보기</h3>
          <p className="mt-1 text-sm text-slate-500">다면평가 결과를 체크인과 성장 계획으로 연결하는 실행 초안입니다.</p>
          {props.existingPlan ? (
            <div className="mt-2 text-xs text-slate-500">
              저장된 계획: {props.existingPlan.title} · {props.existingPlan.status} · {props.existingPlan.updatedAt}
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={busy || !props.aiPayload}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            <Bot className="h-4 w-4" />
            {busy ? 'AI 초안 생성 중..' : 'AI 개발 계획 초안'}
          </button>
          <button
            type="button"
            onClick={handleSavePlan}
            disabled={busy}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            계획 저장
          </button>
        </div>
      </div>

      {notice ? (
        <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          {notice}
        </div>
      ) : null}
      {errorNotice ? (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {errorNotice}
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

      <div className="mt-5 space-y-5">
        <InfoBlock title="집중 개발 포인트" items={[applied.focusArea]} />
        <InfoBlock title="실행 액션" items={applied.actions} />
        <InfoBlock title="리더 지원 포인트" items={applied.managerSupport} />
        <InfoBlock title="다음 체크인 아젠다" items={applied.nextCheckinTopics} />
      </div>
    </section>
  )
}

function InfoBlock(props: { title: string; items: string[] }) {
  return (
    <div>
      <div className="text-sm font-semibold text-slate-900">{props.title}</div>
      <div className="mt-3 space-y-2">
        {props.items.map((item) => (
          <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            {item}
          </div>
        ))}
      </div>
    </div>
  )
}
