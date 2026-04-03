'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bot, CheckCircle2 } from 'lucide-react'
import type { Feedback360PageData } from '@/server/feedback-360'

type NominationData = NonNullable<Feedback360PageData['nomination']>

type ReviewerDraft = {
  employeeId: string
  name: string
  relationship: string
}

type AiPreview = {
  source: 'ai' | 'fallback' | 'disabled'
  fallbackReason?: string | null
  result: {
    recommendations?: ReviewerDraft[]
    rationale?: string
    watchouts?: string[]
  }
}

type ReviewerNominationPanelProps = {
  roundId: string
  nomination: NominationData
}

export function ReviewerNominationPanel(props: ReviewerNominationPanelProps) {
  const router = useRouter()
  const initialSelection = useMemo(
    () =>
      props.nomination.savedDraft?.reviewers.map((reviewer) => reviewer.employeeId) ??
      props.nomination.reviewerGroups.flatMap((group) =>
        group.key === 'self' ? group.reviewers.map((reviewer) => reviewer.employeeId) : []
      ),
    [props.nomination]
  )

  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelection)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [errorNotice, setErrorNotice] = useState('')
  const [preview, setPreview] = useState<AiPreview | null>(null)

  useEffect(() => {
    setSelectedIds(initialSelection)
    setNotice('')
    setErrorNotice('')
    setPreview(null)
  }, [initialSelection, props.nomination.targetEmployee.id, props.roundId])

  const reviewerDirectory = useMemo(() => {
    const directory = new Map<
      string,
      {
        employeeId: string
        name: string
        relationship: string
        department: string
      }
    >()

    for (const group of props.nomination.reviewerGroups) {
      for (const reviewer of group.reviewers) {
        if (directory.has(reviewer.employeeId)) continue

        directory.set(reviewer.employeeId, {
          employeeId: reviewer.employeeId,
          name: reviewer.name,
          relationship: reviewer.relationship,
          department: reviewer.department,
        })
      }
    }

    return directory
  }, [props.nomination.reviewerGroups])

  const selectedReviewers = selectedIds
    .map((id) => reviewerDirectory.get(id))
    .filter((reviewer): reviewer is NonNullable<typeof reviewer> => Boolean(reviewer))
    .map((reviewer) => ({
      employeeId: reviewer.employeeId,
      name: reviewer.name,
      relationship: reviewer.relationship,
    }))

  const selectableReviewerIds = useMemo(
    () =>
      new Set(
        props.nomination.reviewerGroups.flatMap((group) =>
          group.reviewers
            .filter((reviewer) => reviewer.selectable !== false)
            .map((reviewer) => reviewer.employeeId)
        )
      ),
    [props.nomination.reviewerGroups]
  )

  function toggleReviewer(employeeId: string, selectable = true) {
    if (!selectable) return

    setSelectedIds((current) =>
      current.includes(employeeId)
        ? current.filter((id) => id !== employeeId)
        : [...current, employeeId]
    )
  }

  async function handleSave() {
    setBusy(true)
    setNotice('')
    setErrorNotice('')

    try {
      const response = await fetch(`/api/feedback/rounds/${encodeURIComponent(props.roundId)}/nominations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roundId: props.roundId,
          targetId: props.nomination.targetEmployee.id,
          reviewers: selectedReviewers,
        }),
      })
      const json = await response.json()
      if (!json.success) {
        throw new Error(json.error?.message || '리뷰어 nomination draft 저장에 실패했습니다.')
      }
      setNotice('리뷰어 nomination draft를 저장했습니다. 승인 요청 전 구성을 다시 확인해 주세요.')
      router.refresh()
    } catch (error) {
      setErrorNotice(error instanceof Error ? error.message : '리뷰어 nomination draft 저장에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  async function handleWorkflow(action: 'submit' | 'approve' | 'reject' | 'publish') {
    setBusy(true)
    setNotice('')
    setErrorNotice('')

    try {
      const response = await fetch(`/api/feedback/rounds/${encodeURIComponent(props.roundId)}/workflow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          targetId: props.nomination.targetEmployee.id,
        }),
      })
      const json = await response.json()
      if (!json.success) {
        throw new Error(json.error?.message || '360 nomination workflow 처리에 실패했습니다.')
      }

      const messages: Record<typeof action, string> = {
        submit: 'nomination을 승인 요청 상태로 제출했습니다.',
        approve: 'nomination을 승인했습니다.',
        reject: 'nomination을 반려했습니다.',
        publish: '승인된 nomination을 발행하고 리뷰 요청을 생성했습니다.',
      }

      setNotice(messages[action])
      router.refresh()
    } catch (error) {
      setErrorNotice(error instanceof Error ? error.message : '360 nomination workflow 처리에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  async function handleRecommend() {
    setBusy(true)
    setNotice('')
    setErrorNotice('')

    try {
      const response = await fetch('/api/feedback/360/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'recommend-reviewers',
          payload: {
            targetEmployee: props.nomination.targetEmployee,
            reviewerGroups: props.nomination.reviewerGroups,
            savedDraftCount: props.nomination.savedDraftCount,
            anonymityThreshold: 3,
          },
        }),
      })
      const json = await response.json()
      if (!json.success) {
        throw new Error(json.error?.message || 'AI 추천 후보를 생성하지 못했습니다.')
      }
      setPreview(json.data)
    } catch (error) {
      setErrorNotice(error instanceof Error ? error.message : 'AI 추천 후보 생성에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  function applyAiPreview() {
    if (!preview?.result.recommendations?.length) return

    const nextIds = preview.result.recommendations
      .map((reviewer) => reviewer.employeeId)
      .filter((id) => reviewerDirectory.has(id) && selectableReviewerIds.has(id))

    setSelectedIds(Array.from(new Set(nextIds)))
    setPreview(null)
    setNotice('AI 추천 리뷰어를 현재 nomination draft에 반영했습니다. 저장 전 한 번 더 검토해 주세요.')
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">리뷰어 nomination</h3>
          <p className="mt-1 text-sm text-slate-500">
            대상자 {props.nomination.targetEmployee.name} · {props.nomination.targetEmployee.department} ·{' '}
            {props.nomination.targetEmployee.position}
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">
              상태: {props.nomination.workflowStatus ?? 'DRAFT'}
            </span>
            {props.nomination.counts ? (
              <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">
                승인 {props.nomination.counts.approved}/{props.nomination.counts.total}
              </span>
            ) : null}
            {props.nomination.counts?.published ? (
              <span className="rounded-full bg-emerald-100 px-3 py-1 font-medium text-emerald-700">
                발행 {props.nomination.counts.published}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleRecommend}
            disabled={busy}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            <Bot className="h-4 w-4" />
            {busy ? 'AI 추천 생성 중..' : 'AI 리뷰어 추천'}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={busy}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
          >
            <CheckCircle2 className="h-4 w-4" />
            nomination draft 저장
          </button>
          <button
            type="button"
            onClick={() => handleWorkflow('submit')}
            disabled={busy || !selectedReviewers.length}
            className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            승인 요청
          </button>
          {props.nomination.canApprove ? (
            <>
              <button
                type="button"
                onClick={() => handleWorkflow('approve')}
                disabled={busy || !props.nomination.counts?.total}
                className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-emerald-300 px-4 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-60"
              >
                승인
              </button>
              <button
                type="button"
                onClick={() => handleWorkflow('reject')}
                disabled={busy || !props.nomination.counts?.total}
                className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-rose-300 px-4 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-60"
              >
                반려
              </button>
            </>
          ) : null}
          {props.nomination.canPublish ? (
            <button
              type="button"
              onClick={() => handleWorkflow('publish')}
              disabled={busy || !props.nomination.counts?.approved}
              className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-blue-300 px-4 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 disabled:opacity-60"
            >
              발행
            </button>
          ) : null}
        </div>
      </div>

      {notice ? (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {notice}
        </div>
      ) : null}
      {errorNotice ? (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {errorNotice}
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-sm font-semibold text-slate-900">현재 동료 선택 규칙</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <RuleChip active={props.nomination.selectionSettings.requireLeaderApproval} label="리더 승인 필요" />
            <RuleChip active={props.nomination.selectionSettings.allowPreferredPeers} label="선호 동료 선택 가능" />
            <RuleChip active={props.nomination.selectionSettings.excludeLeaderFromPeerSelection} label="리더 제외" />
            <RuleChip active={props.nomination.selectionSettings.excludeDirectReportsFromPeerSelection} label="팀원 제외" />
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-sm font-semibold text-slate-900">공개 범위 요약</div>
          <div className="mt-3 space-y-2 text-sm text-slate-600">
            {Object.entries(props.nomination.visibilitySettings).map(([relationship, visibility]) => (
              <div key={relationship} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
                <span>{relationship}</span>
                <span className="font-medium text-slate-900">{visibility}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {preview ? (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-900">AI reviewer recommendation preview</div>
              <div className="mt-1 text-xs text-slate-500">
                {preview.source === 'ai'
                  ? 'OpenAI 추천 미리보기'
                  : `Fallback preview${preview.fallbackReason ? ` · ${preview.fallbackReason}` : ''}`}
              </div>
            </div>
            <button
              type="button"
              onClick={applyAiPreview}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              <CheckCircle2 className="h-4 w-4" />
              추천 반영
            </button>
          </div>
          {preview.result.rationale ? (
            <div className="mt-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
              {preview.result.rationale}
            </div>
          ) : null}
          {preview.result.watchouts?.length ? (
            <div className="mt-3 space-y-2">
              {preview.result.watchouts.map((item) => (
                <div key={item} className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  {item}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        {props.nomination.reviewerGroups.map((group) => (
          <div key={group.key} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-900">{group.label}</div>
            <div className="mt-1 text-xs text-slate-500">{group.description}</div>
            {group.helpMessage ? (
              <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 px-3 py-3 text-xs leading-5 text-blue-800">
                {group.helpMessage}
              </div>
            ) : null}
            <div className="mt-4 space-y-2">
              {group.reviewers.length ? (
                group.reviewers.map((reviewer) => {
                  const selectable = reviewer.selectable !== false
                  const checked = selectable && selectedIds.includes(reviewer.employeeId)

                  return (
                    <label
                      key={reviewer.employeeId}
                      className={`flex items-start gap-3 rounded-xl border px-3 py-3 text-sm ${
                        selectable
                          ? 'cursor-pointer border-slate-200 bg-white text-slate-700'
                          : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-500'
                      }`}
                      title={reviewer.disabledReason ?? undefined}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={!selectable}
                        onChange={() => toggleReviewer(reviewer.employeeId, selectable)}
                        className="mt-1 h-4 w-4 rounded border-slate-300"
                      />
                      <span>
                        <span className={`font-medium ${selectable ? 'text-slate-900' : 'text-slate-500'}`}>
                          {reviewer.name}
                        </span>
                        <span className="mt-1 block text-xs text-slate-500">
                          {reviewer.department} · {reviewer.relationship}
                        </span>
                        {reviewer.disabledReason ? (
                          <span className="mt-2 block text-xs leading-5 text-amber-700">
                            {reviewer.disabledReason}
                          </span>
                        ) : null}
                      </span>
                    </label>
                  )
                })
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 bg-white px-3 py-3 text-sm text-slate-500">
                  추천 가능한 후보가 아직 없습니다.
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="text-sm font-semibold text-slate-900">현재 선택된 리뷰어</div>
        <div className="mt-3 flex flex-wrap gap-2">
          {selectedReviewers.length ? (
            selectedReviewers.map((reviewer) => (
              <span
                key={`${reviewer.employeeId}-${reviewer.relationship}`}
                className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
              >
                {reviewer.name} · {reviewer.relationship}
              </span>
            ))
          ) : (
            <span className="text-sm text-slate-500">아직 선택된 리뷰어가 없습니다.</span>
          )}
        </div>
      </div>

      <div className="mt-5 space-y-2">
        {props.nomination.guidance.map((item) => (
          <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            {item}
          </div>
        ))}
      </div>
    </section>
  )
}

function RuleChip(props: { active: boolean; label: string }) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${
        props.active
          ? 'bg-slate-900 text-white'
          : 'bg-slate-200 text-slate-500'
      }`}
    >
      {props.label}
    </span>
  )
}
