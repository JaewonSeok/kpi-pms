'use client'

import { useEffect, useMemo, useState } from 'react'
import { Bot, CheckCircle2, Save } from 'lucide-react'
import {
  calculateDevelopmentPlanProgress,
  normalizeDevelopmentPlanActionItems,
  normalizeDevelopmentPlanLinkedEvidence,
  normalizeDevelopmentPlanStringArray,
  type DevelopmentPlanActionItem,
  type DevelopmentPlanLinkedEvidence,
} from '@/lib/development-plan'

type ExistingDevelopmentPlan = {
  id: string
  title: string
  status: string
  updatedAt: string
  actions?: DevelopmentPlanActionItem[]
  recommendedCompetencies?: string[]
  managerSupport?: string[]
  nextCheckinTopics?: string[]
  linkedEvidence?: DevelopmentPlanLinkedEvidence[]
  note?: string | null
  dueDate?: string | null
  progressRate?: number
}

type DevelopmentPlanPreviewProps = {
  employeeId: string
  sourceId: string
  focusArea: string
  actions: string[]
  managerSupport: string[]
  nextCheckinTopics: string[]
  recommendedCompetencies?: string[]
  linkedEvidence?: DevelopmentPlanLinkedEvidence[]
  existingPlan?: ExistingDevelopmentPlan
  aiPayload?: Record<string, unknown>
}

type AiPreview = {
  source: 'ai' | 'fallback' | 'disabled'
  fallbackReason?: string | null
  result: {
    focusArea?: string
    actions?: Array<string | DevelopmentPlanActionItem>
    managerSupport?: string[]
    nextCheckinTopics?: string[]
    recommendedCompetencies?: string[]
  }
}

function buildInitialDraft(props: DevelopmentPlanPreviewProps) {
  return {
    title: props.existingPlan?.title || `360 성장 계획 · ${props.focusArea}`,
    focusArea: props.focusArea,
    actions: normalizeDevelopmentPlanActionItems(props.existingPlan?.actions ?? props.actions),
    recommendedCompetencies: normalizeDevelopmentPlanStringArray(
      props.existingPlan?.recommendedCompetencies ?? props.recommendedCompetencies
    ),
    managerSupport: normalizeDevelopmentPlanStringArray(props.existingPlan?.managerSupport ?? props.managerSupport),
    nextCheckinTopics: normalizeDevelopmentPlanStringArray(
      props.existingPlan?.nextCheckinTopics ?? props.nextCheckinTopics
    ),
    linkedEvidence: normalizeDevelopmentPlanLinkedEvidence(props.existingPlan?.linkedEvidence ?? props.linkedEvidence),
    note: props.existingPlan?.note ?? '',
    dueDate: props.existingPlan?.dueDate ?? '',
    status: props.existingPlan?.status ?? 'ACTIVE',
  }
}

export function DevelopmentPlanPreview(props: DevelopmentPlanPreviewProps) {
  const [preview, setPreview] = useState<AiPreview | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [errorNotice, setErrorNotice] = useState('')
  const [draft, setDraft] = useState(() => buildInitialDraft(props))

  useEffect(() => {
    setDraft(buildInitialDraft(props))
  }, [
    props.existingPlan,
    props.focusArea,
    props.actions,
    props.managerSupport,
    props.nextCheckinTopics,
    props.recommendedCompetencies,
    props.linkedEvidence,
  ])

  const progress = useMemo(() => calculateDevelopmentPlanProgress(draft.actions), [draft.actions])

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
        throw new Error(json.error?.message || '성장 계획 초안을 생성하지 못했습니다.')
      }
      setPreview(json.data)
    } catch (error) {
      setErrorNotice(error instanceof Error ? error.message : '성장 계획 초안 생성에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  function handleApplyPreview() {
    if (!preview) return
    setDraft((current) => ({
      ...current,
      focusArea: preview.result.focusArea || current.focusArea,
      actions: preview.result.actions
        ? normalizeDevelopmentPlanActionItems(preview.result.actions)
        : current.actions,
      managerSupport: preview.result.managerSupport
        ? normalizeDevelopmentPlanStringArray(preview.result.managerSupport)
        : current.managerSupport,
      nextCheckinTopics: preview.result.nextCheckinTopics
        ? normalizeDevelopmentPlanStringArray(preview.result.nextCheckinTopics)
        : current.nextCheckinTopics,
      recommendedCompetencies: preview.result.recommendedCompetencies
        ? normalizeDevelopmentPlanStringArray(preview.result.recommendedCompetencies)
        : current.recommendedCompetencies,
    }))
    setPreview(null)
    setNotice('AI 초안을 현재 계획에 반영했습니다. 저장 전에 세부 내용을 한 번 더 확인해 주세요.')
  }

  function updateAction(index: number, patch: Partial<DevelopmentPlanActionItem>) {
    setDraft((current) => ({
      ...current,
      actions: current.actions.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    }))
  }

  async function handleSavePlan() {
    setBusy(true)
    setNotice('')
    setErrorNotice('')

    try {
      const payload = {
        employeeId: props.employeeId,
        sourceType: 'FEEDBACK_360',
        sourceId: props.sourceId,
        title: draft.title,
        focusArea: draft.focusArea,
        actions: draft.actions,
        recommendedCompetencies: draft.recommendedCompetencies,
        managerSupport: draft.managerSupport,
        nextCheckinTopics: draft.nextCheckinTopics,
        linkedEvidence: draft.linkedEvidence,
        note: draft.note || undefined,
        dueDate: draft.dueDate || undefined,
        status: draft.status,
      }

      const response = await fetch('/api/development-plans', {
        method: props.existingPlan?.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          props.existingPlan?.id
            ? {
                id: props.existingPlan.id,
                title: payload.title,
                focusArea: payload.focusArea,
                actions: payload.actions,
                recommendedCompetencies: payload.recommendedCompetencies,
                managerSupport: payload.managerSupport,
                nextCheckinTopics: payload.nextCheckinTopics,
                linkedEvidence: payload.linkedEvidence,
                note: payload.note,
                dueDate: payload.dueDate ?? null,
                status: payload.status,
              }
            : payload
        ),
      })
      const json = await response.json()
      if (!json.success) {
        throw new Error(json.error?.message || '성장 계획 저장에 실패했습니다.')
      }
      setNotice(
        props.existingPlan?.id
          ? '성장 계획을 업데이트했습니다. 다음 체크인과 1:1에서 이어서 확인할 수 있습니다.'
          : '성장 계획을 저장했습니다. 다음 체크인과 1:1에서 이어서 확인할 수 있습니다.'
      )
    } catch (error) {
      setErrorNotice(error instanceof Error ? error.message : '성장 계획 저장에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">성장 계획(IDP)</h3>
          <p className="mt-1 text-sm text-slate-500">
            리뷰 결과를 성장 목표, 실행 액션, 1:1 체크포인트로 연결합니다.
          </p>
          {props.existingPlan ? (
            <div className="mt-2 text-xs text-slate-500">
              최근 저장: {props.existingPlan.updatedAt} · 진행률 {props.existingPlan.progressRate ?? progress.progressRate}%
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
            {busy ? 'AI 초안 생성 중..' : 'AI 성장 계획 초안'}
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
                  ? 'AI가 만든 초안입니다.'
                  : `Fallback preview${preview.fallbackReason ? ` · ${preview.fallbackReason}` : ''}`}
              </div>
            </div>
            <button
              type="button"
              onClick={handleApplyPreview}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              <CheckCircle2 className="h-4 w-4" />
              초안 반영
            </button>
          </div>
          <pre className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-700">
            {JSON.stringify(preview.result, null, 2)}
          </pre>
        </div>
      ) : null}

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <label className="block">
            <span className="text-sm font-semibold text-slate-900">성장 목표</span>
            <input
              value={draft.title}
              onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
              className="mt-2 min-h-11 w-full rounded-2xl border border-slate-200 px-4 text-sm text-slate-900 outline-none transition focus:border-blue-400"
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-slate-900">핵심 성장 영역</span>
            <textarea
              value={draft.focusArea}
              onChange={(event) => setDraft((current) => ({ ...current, focusArea: event.target.value }))}
              className="mt-2 min-h-24 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400"
            />
          </label>

          <div>
            <div className="text-sm font-semibold text-slate-900">액션 아이템</div>
            <div className="mt-3 space-y-3">
              {draft.actions.map((action, index) => (
                <div key={`${action.title}:${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
                    <input
                      value={action.title}
                      onChange={(event) => updateAction(index, { title: event.target.value })}
                      className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-blue-400"
                    />
                    <select
                      value={action.status}
                      onChange={(event) =>
                        updateAction(index, {
                          status: event.target.value as DevelopmentPlanActionItem['status'],
                        })
                      }
                      className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900"
                    >
                      <option value="NOT_STARTED">시작 전</option>
                      <option value="IN_PROGRESS">진행 중</option>
                      <option value="DONE">완료</option>
                    </select>
                  </div>
                  <textarea
                    value={action.note ?? ''}
                    onChange={(event) => updateAction(index, { note: event.target.value })}
                    className="mt-3 min-h-20 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400"
                    placeholder="실행 메모 또는 체크포인트를 적어 주세요."
                  />
                </div>
              ))}
            </div>
          </div>

          <StringListEditor
            title="추천 역량"
            values={draft.recommendedCompetencies}
            onChange={(values) => setDraft((current) => ({ ...current, recommendedCompetencies: values }))}
            placeholder="쉼표로 구분해 입력해 주세요."
          />
          <StringListEditor
            title="리더 지원 방식"
            values={draft.managerSupport}
            onChange={(values) => setDraft((current) => ({ ...current, managerSupport: values }))}
            placeholder="쉼표로 구분해 입력해 주세요."
          />
          <StringListEditor
            title="다음 체크인 주제"
            values={draft.nextCheckinTopics}
            onChange={(values) => setDraft((current) => ({ ...current, nextCheckinTopics: values }))}
            placeholder="쉼표로 구분해 입력해 주세요."
          />
        </div>

        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-900">진행 상태</div>
            <div className="mt-3 text-3xl font-semibold text-slate-900">{progress.progressRate}%</div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-blue-500" style={{ width: `${progress.progressRate}%` }} />
            </div>
            <label className="mt-4 block">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">기한</span>
              <input
                type="date"
                value={draft.dueDate}
                onChange={(event) => setDraft((current) => ({ ...current, dueDate: event.target.value }))}
                className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900"
              />
            </label>
            <label className="mt-4 block">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">상태</span>
              <select
                value={draft.status}
                onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value }))}
                className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900"
              >
                <option value="ACTIVE">진행 중</option>
                <option value="COMPLETED">완료</option>
                <option value="ARCHIVED">보류</option>
              </select>
            </label>
          </div>

          <label className="block">
            <span className="text-sm font-semibold text-slate-900">HR / 리더 메모</span>
            <textarea
              value={draft.note}
              onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))}
              className="mt-2 min-h-32 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400"
              placeholder="코칭 메모, 주의점, 다음 점검 관점을 적어 주세요."
            />
          </label>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-sm font-semibold text-slate-900">연결 근거</div>
            <div className="mt-3 space-y-2">
              {draft.linkedEvidence.length ? (
                draft.linkedEvidence.map((item) => (
                  <div key={`${item.type}:${item.label}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{item.type}</div>
                    <div className="mt-1 text-sm font-medium text-slate-900">{item.label}</div>
                    {item.note ? <div className="mt-1 text-sm text-slate-600">{item.note}</div> : null}
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                  연결된 근거가 아직 없습니다.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function StringListEditor(props: {
  title: string
  values: string[]
  onChange: (values: string[]) => void
  placeholder: string
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-900">{props.title}</span>
      <textarea
        value={props.values.join(', ')}
        onChange={(event) =>
          props.onChange(
            event.target.value
              .split(',')
              .map((item) => item.trim())
              .filter(Boolean)
          )
        }
        className="mt-2 min-h-24 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400"
        placeholder={props.placeholder}
      />
    </label>
  )
}
