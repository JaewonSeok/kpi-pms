'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  MessageSquareMore,
  Send,
  ShieldAlert,
  Sparkles,
  Undo2,
} from 'lucide-react'
import {
  applyEvaluationAssistResult,
  buildEvaluationAssistEvidenceView,
  formatEvaluationAssistPreviewForClipboard,
  getEvaluationAssistActionLabel,
  getEvaluationAssistDisabledReason,
  getEvaluationAssistEvidenceLevelLabel,
  getEvaluationAssistModeLabel,
  getEvaluationAssistModeDescription,
  getEvaluationAssistRequestErrorMessage,
  normalizeEvaluationAssistEvidenceView,
  normalizeEvaluationAssistResult,
  type EvaluationAssistMode,
  type EvaluationAssistEvidenceView,
  type EvaluationAssistPreview,
  type EvaluationAssistResult,
} from '@/lib/evaluation-ai-assist'
import { useImpersonationRiskAction } from '@/components/security/useImpersonationRiskAction'
import {
  buildEvaluationQualityWarnings,
  EVALUATION_GUIDE_EXAMPLES,
  EVALUATION_GUIDE_SECTIONS,
  type EvaluationGuideExample,
  type EvaluationGuideSection,
  type EvaluationQualityWarning,
} from '@/lib/evaluation-writing-guide'
import type { EvaluationWorkbenchPageData } from '@/server/evaluation-workbench'

type WorkbenchTab = 'workbench' | 'guide' | 'evidence' | 'feedback' | 'ai' | 'history'

type DraftItemState = {
  personalKpiId: string
  quantScore?: number | null
  planScore?: number | null
  doScore?: number | null
  checkScore?: number | null
  actScore?: number | null
  itemComment?: string
}

type EvidenceSectionKey = 'highlights' | 'kpi' | 'notes' | 'warnings'
type EditableWorkbenchItem = NonNullable<EvaluationWorkbenchPageData['selected']>['items'][number] & {
  draft: DraftItemState
}

const TAB_LABELS: Record<WorkbenchTab, string> = {
  workbench: '평가 실행',
  guide: '평가 가이드',
  evidence: '근거 자료',
  feedback: '다면 피드백',
  ai: 'AI 보조',
  history: '제출 이력',
}

export function EvaluationWorkbenchClient(props: EvaluationWorkbenchPageData) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const { requestRiskConfirmation, riskDialog } = useImpersonationRiskAction()
  const [activeTab, setActiveTab] = useState<WorkbenchTab>('workbench')
  const [assistMode, setAssistMode] = useState<EvaluationAssistMode>('draft')
  const [notice, setNotice] = useState('')
  const [errorNotice, setErrorNotice] = useState('')
  const [decisionBusy, setDecisionBusy] = useState(false)
  const [assistLoadingMode, setAssistLoadingMode] = useState<EvaluationAssistMode | null>(null)
  const [preview, setPreview] = useState<EvaluationAssistPreview | null>(null)
  const [copiedPreviewMode, setCopiedPreviewMode] = useState<EvaluationAssistMode | null>(null)
  const [selectedEvidenceSection, setSelectedEvidenceSection] = useState<EvidenceSectionKey>('highlights')
  const [expandedGoalContextId, setExpandedGoalContextId] = useState<string | null>(null)
  const [guideBusy, setGuideBusy] = useState(false)
  const [guideStatus, setGuideStatus] = useState({ viewed: false, confirmed: false })
  const [draftComment, setDraftComment] = useState('')
  const [draftGradeId, setDraftGradeId] = useState<string>('')
  const [growthMemo, setGrowthMemo] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [draftItems, setDraftItems] = useState<Record<string, DraftItemState>>({})
  const workbenchContextKey = `${props.selectedCycleId ?? ''}:${props.selectedEvaluationId ?? ''}`
  const previousWorkbenchContextKey = useRef(workbenchContextKey)
  const previousCycleId = useRef(props.selectedCycleId ?? '')
  const guideViewRequestRef = useRef<string | null>(null)

  const selected = props.selected
  const displaySettings = props.displaySettings ?? {
    showQuestionWeight: true,
    showScoreSummary: true,
  }

  useEffect(() => {
    if (previousWorkbenchContextKey.current === workbenchContextKey) {
      return
    }

    const cycleChanged = previousCycleId.current !== (props.selectedCycleId ?? '')
    previousWorkbenchContextKey.current = workbenchContextKey
    previousCycleId.current = props.selectedCycleId ?? ''

    setNotice('')
    setErrorNotice('')
    setDecisionBusy(false)
    setGuideBusy(false)
    setPreview(null)
    setAssistLoadingMode(null)
    setCopiedPreviewMode(null)
    setSelectedEvidenceSection('highlights')
    setExpandedGoalContextId(null)
    setAssistMode('draft')
    setGuideStatus({ viewed: false, confirmed: false })
    guideViewRequestRef.current = null

    if (cycleChanged) {
      setActiveTab('workbench')
    }
  }, [props.selectedCycleId, workbenchContextKey])

  useEffect(() => {
    if (!selected) {
      setDraftComment('')
      setDraftGradeId('')
      setGrowthMemo('')
      setRejectReason('')
      setPreview(null)
      setAssistLoadingMode(null)
      setCopiedPreviewMode(null)
      setSelectedEvidenceSection('highlights')
      setExpandedGoalContextId(null)
      setAssistMode('draft')
      setGuideBusy(false)
      setGuideStatus({ viewed: false, confirmed: false })
      setDraftItems({})
      return
    }

    setGuideStatus(selected.guideStatus)
    setDraftComment(selected.comment ?? '')
    setDraftGradeId(selected.gradeId ?? '')
    setGrowthMemo('')
    setRejectReason('')
    setPreview(null)
    setAssistLoadingMode(null)
    setCopiedPreviewMode(null)
    setSelectedEvidenceSection('highlights')
    setExpandedGoalContextId(null)
    setAssistMode('draft')
    setGuideBusy(false)
    guideViewRequestRef.current = null
    setDraftItems(
      Object.fromEntries(
        selected.items.map((item) => [
          item.personalKpiId,
          {
            personalKpiId: item.personalKpiId,
            quantScore: item.quantScore ?? null,
            planScore: item.planScore ?? null,
            doScore: item.doScore ?? null,
            checkScore: item.checkScore ?? null,
            actScore: item.actScore ?? null,
            itemComment: item.itemComment ?? '',
          },
        ])
      )
    )
  }, [selected])

  const editableItems = useMemo(() => {
    if (!selected) return []
    return selected.items.map((item) => ({
      ...item,
      draft: draftItems[item.personalKpiId] ?? {
        personalKpiId: item.personalKpiId,
        quantScore: item.quantScore ?? null,
        planScore: item.planScore ?? null,
        doScore: item.doScore ?? null,
        checkScore: item.checkScore ?? null,
        actScore: item.actScore ?? null,
        itemComment: item.itemComment ?? '',
      },
    }))
  }, [draftItems, selected])

  const computedTotal = useMemo(
    () =>
      editableItems.reduce((sum, item) => {
        if (item.type === 'QUANTITATIVE') {
          return sum + ((item.draft.quantScore ?? 0) * item.weight) / 100
        }

        const pdca =
          Number(item.draft.planScore ?? 0) * 0.3 +
          Number(item.draft.doScore ?? 0) * 0.4 +
          Number(item.draft.checkScore ?? 0) * 0.2 +
          Number(item.draft.actScore ?? 0) * 0.1
        return sum + (pdca * item.weight) / 100
      }, 0),
    [editableItems]
  )

  const workspaceEvidence = useMemo<EvaluationAssistEvidenceView>(() => {
    if (!selected) {
      return normalizeEvaluationAssistEvidenceView(null)
    }

    return buildEvaluationAssistEvidenceView({
      kpiSummaries: selected.items.map((item) => {
        const parts = [
          item.title,
          `가중치 ${item.weight}%`,
          typeof item.recentAchievementRate === 'number' ? `최근 달성률 ${item.recentAchievementRate}%` : '달성률 미집계',
        ]

        if (item.linkedOrgKpiTitle) {
          parts.push(`연결 목표 ${item.linkedOrgKpiTitle}`)
        }

        if (item.latestMonthlyComment) {
          parts.push(item.latestMonthlyComment)
        }

        return parts.join(' / ')
      }),
      monthlySummaries: selected.evidence.monthlyRecords.map((record) =>
        [
          `${record.title} / ${record.yearMonth}`,
          typeof record.achievementRate === 'number' ? `달성률 ${record.achievementRate}%` : '달성률 미집계',
          record.activities || record.obstacles || '상세 메모 없음',
        ].join(' / ')
      ),
      noteSummaries: [
        ...selected.evidence.checkins.map((checkin) => `체크인 / ${checkin.scheduledDate} / ${checkin.summary}`),
        ...selected.evidence.feedbackRounds.map(
          (round) =>
            `${round.roundName} / ${round.roundType} / 제출 ${round.submittedCount}건 / ${
              round.summary || '요약 없음'
            }`
        ),
      ],
      keyPoints: selected.evidence.highlights,
      alerts: props.alerts ?? [],
    })
  }, [props.alerts, selected])

  const previewEvidence = preview?.evidence ?? workspaceEvidence
  const draftQualityWarnings = useMemo(
    () =>
      buildEvaluationQualityWarnings({
        comment: draftComment,
        evidence: workspaceEvidence,
        mode: 'draft',
      }),
    [draftComment, workspaceEvidence]
  )
  const previewQualityWarnings = useMemo(
    () =>
      preview
        ? buildEvaluationQualityWarnings({
            comment: preview.result.draftText,
            evidence: preview.evidence,
            mode: preview.mode,
          })
        : [],
    [preview]
  )

  const persistGuideAction = useCallback(async (action: 'view' | 'confirm', options?: { silent?: boolean }) => {
    if (!selected) return

    if (action === 'confirm') {
      setGuideBusy(true)
    }

    try {
      const response = await fetch(`/api/evaluation/${selected.id}/guide`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const json = await response.json().catch(() => null)

      if (!response.ok || !json?.success) {
        throw new Error(json?.error?.message ?? '평가 가이드 상태를 저장하지 못했습니다.')
      }

      setGuideStatus((current) => ({
        viewed: current.viewed || action === 'view' || action === 'confirm',
        confirmed: current.confirmed || action === 'confirm',
      }))

      if (!options?.silent) {
        setNotice(
          action === 'confirm'
            ? '평가 가이드 확인 상태를 기록했습니다.'
            : '평가 가이드 열람 이력을 기록했습니다.'
        )
      }
    } catch (error) {
      console.error('[evaluation-workbench-guide]', error)
      if (!options?.silent) {
        setErrorNotice('평가 가이드 상태를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.')
      }
      throw error
    } finally {
      if (action === 'confirm') {
        setGuideBusy(false)
      }
    }
  }, [selected])

  useEffect(() => {
    if (
      activeTab !== 'guide' ||
      !selected?.id ||
      !selected.permissions.canEdit ||
      guideStatus.viewed
    ) {
      return
    }

    if (guideViewRequestRef.current === selected.id) {
      return
    }

    guideViewRequestRef.current = selected.id
    void persistGuideAction('view', { silent: true }).catch(() => {
      guideViewRequestRef.current = null
    })
  }, [activeTab, guideStatus.viewed, persistGuideAction, selected?.id, selected?.permissions.canEdit])

  async function runMutation(
    action: 'createSelf' | 'saveDraft' | 'submit' | 'reject',
    payload?: Record<string, unknown>
  ) {
    setNotice('')
    setErrorNotice('')

    try {
      if (action === 'createSelf') {
        const response = await fetch('/api/evaluation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ evalCycleId: props.selectedCycleId }),
        })
        const json = await response.json()
        if (!json.success) throw new Error(json.error?.message ?? '자기평가를 시작하지 못했습니다.')
        const nextId = json.data?.id as string | undefined
        const nextUrl = nextId
          ? `/evaluation/workbench?cycleId=${encodeURIComponent(props.selectedCycleId ?? '')}&evaluationId=${encodeURIComponent(nextId)}`
          : `/evaluation/workbench?cycleId=${encodeURIComponent(props.selectedCycleId ?? '')}`
        startTransition(() => router.push(nextUrl))
        setNotice('자기평가 초안을 생성했습니다.')
        return
      }

      if (!selected) return
      const url =
        action === 'saveDraft'
          ? `/api/evaluation/${selected.id}`
          : action === 'submit'
            ? `/api/evaluation/${selected.id}/submit`
            : `/api/evaluation/${selected.id}/review`

      let riskHeaders: Record<string, string> = {}
      if (action === 'submit') {
        const confirmed = await requestRiskConfirmation({
          actionName: 'FINAL_SUBMIT',
          actionLabel: '평가 최종 제출',
          targetLabel: selected.target.name,
          detail: '현재 마스터 로그인 상태에서 평가를 최종 제출합니다.',
          confirmationText: '제출',
        })
        if (confirmed === null) return
        riskHeaders = confirmed
      } else if (action === 'reject') {
        const confirmed = await requestRiskConfirmation({
          actionName: 'REJECT_RECORD',
          actionLabel: '평가 반려',
          targetLabel: selected.target.name,
          detail: '현재 마스터 로그인 상태에서 평가를 반려하고 보완을 요청합니다.',
          confirmationText: '반려',
        })
        if (confirmed === null) return
        riskHeaders = confirmed
      }

      const response = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...riskHeaders },
        body: JSON.stringify(payload ?? {}),
      })
      const json = await response.json().catch(() => null)
      if (!json.success) throw new Error(json.error?.message ?? '작업을 처리하지 못했습니다.')
      setNotice(action === 'saveDraft' ? '평가 초안을 저장했습니다.' : action === 'submit' ? '평가를 제출했습니다.' : '평가를 반려하고 보완을 요청했습니다.')
      startTransition(() => router.refresh())
    } catch (error) {
      setErrorNotice(error instanceof Error ? error.message : '작업을 처리하지 못했습니다.')
    }
  }

  async function runAssist(mode: EvaluationAssistMode) {
    if (!selected) return
    setNotice('')
    setErrorNotice('')
    setPreview(null)
    setCopiedPreviewMode(null)
    setSelectedEvidenceSection('highlights')
    setAssistLoadingMode(mode)

    try {
      const response = await fetch('/api/ai/evaluation-assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          evaluationId: selected.id,
          draftComment,
          growthMemo,
          draftGradeId: draftGradeId || null,
          items: editableItems.map((item) => ({
            personalKpiId: item.personalKpiId,
            title: item.title,
            weight: item.weight,
            quantScore: item.draft.quantScore ?? null,
            planScore: item.draft.planScore ?? null,
            doScore: item.draft.doScore ?? null,
            checkScore: item.draft.checkScore ?? null,
            actScore: item.draft.actScore ?? null,
            itemComment: item.draft.itemComment ?? '',
          })),
        }),
      })
      const json = await response.json().catch(() => null)
      if (!response.ok || !json?.success) {
        throw new Error(json?.error?.message ?? getEvaluationAssistRequestErrorMessage())
      }
      setPreview({
        requestLogId: String(json.data.requestLogId),
        source: json.data.source === 'disabled' ? 'disabled' : 'ai',
        fallbackReason: json.data.fallbackReason ?? null,
        mode,
        result: normalizeEvaluationAssistResult(json.data.result),
        evidence: normalizeEvaluationAssistEvidenceView(json.data.evidence),
      })
      setActiveTab('ai')
    } catch (error) {
      console.error('[evaluation-workbench-ai]', error)
      setErrorNotice(getEvaluationAssistRequestErrorMessage())
    } finally {
      setAssistLoadingMode(null)
    }
  }

  async function handleAssistMode(mode: EvaluationAssistMode) {
    const changed = assistMode !== mode
    setAssistMode(mode)

    if (changed) {
      setNotice('')
      setErrorNotice('')
      setPreview(null)
      setCopiedPreviewMode(null)
      setSelectedEvidenceSection('highlights')
    }

    await runAssist(mode)
  }

  async function handlePreviewDecision(action: 'approve' | 'reject') {
    if (!preview?.requestLogId) return
    setDecisionBusy(true)

    try {
      const response = await fetch(`/api/ai/request-logs/${preview.requestLogId}/decision`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          approvedPayload: action === 'approve' ? preview.result : undefined,
          rejectionReason: action === 'reject' ? 'Dismissed from review workbench.' : undefined,
        }),
      })
      const json = await response.json().catch(() => null)
      if (!response.ok || !json?.success) {
        throw new Error(json?.error?.message ?? 'AI 결과 상태를 변경하지 못했습니다.')
      }

      if (action === 'approve') {
        const applied = applyEvaluationAssistResult(preview.mode, preview.result)

        if (typeof applied.draftComment === 'string') {
          setDraftComment(applied.draftComment)
        }

        if (typeof applied.growthMemo === 'string') {
          setGrowthMemo(applied.growthMemo)
        }
        setNotice('AI 제안을 검토 후 반영했습니다. 저장 후 제출 전에 다시 확인하세요.')
      } else {
        setNotice('AI 제안을 반려했습니다.')
      }

      setCopiedPreviewMode(null)
      setPreview(null)
      startTransition(() => router.refresh())
    } catch (error) {
      setErrorNotice(error instanceof Error ? error.message : 'AI 결과 상태를 변경하지 못했습니다.')
    } finally {
      setDecisionBusy(false)
    }
  }

  async function handleCopyPreview() {
    if (!preview || typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      setErrorNotice('현재 환경에서는 미리보기 복사를 지원하지 않습니다.')
      return
    }

    try {
      await navigator.clipboard.writeText(
        formatEvaluationAssistPreviewForClipboard(preview.mode, preview.result, preview.evidence)
      )
      setCopiedPreviewMode(preview.mode)
      setNotice('AI 미리보기를 복사했습니다. 필요한 영역에 붙여넣어 검토하세요.')
    } catch {
      setErrorNotice('AI 미리보기를 복사하지 못했습니다. 다시 시도해 주세요.')
    }
  }

  function updateItemField(personalKpiId: string, field: keyof DraftItemState, value: string | number | null) {
    setDraftItems((current) => ({
      ...current,
      [personalKpiId]: {
        ...(current[personalKpiId] ?? { personalKpiId }),
        [field]: value,
      },
    }))
  }

  function moveToCycle(cycleId: string) {
    startTransition(() => router.push(`/evaluation/workbench?cycleId=${encodeURIComponent(cycleId)}`))
  }

  function moveToEvaluation(evaluationId: string) {
    const params = new URLSearchParams()
    if (props.selectedCycleId) params.set('cycleId', props.selectedCycleId)
    params.set('evaluationId', evaluationId)
    startTransition(() => router.push(`/evaluation/workbench?${params.toString()}`))
  }

  if (props.state !== 'ready') {
    return (
      <div className="space-y-6">
        <PageHeader />
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-500">
            <ClipboardList className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-slate-900">
            {props.state === 'permission-denied' ? '접근 권한이 없습니다' : props.state === 'empty' ? '평가 항목이 아직 없습니다' : '데이터를 불러오지 못했습니다'}
          </h2>
          <p className="mt-2 text-sm text-slate-500">{props.message ?? '평가 주기와 권한을 확인해 주세요.'}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <QuickLink href="/evaluation/results" label="평가 결과 보기" />
            <QuickLink href="/kpi/monthly" label="월간 실적 보기" />
            <QuickLink href="/checkin" label="체크인 보기" />
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader />

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Badge tone={toneFromCount(props.summary?.actionRequiredCount ?? 0)}>
                {labelFromCount(props.summary?.actionRequiredCount ?? 0)}
              </Badge>
              {selected ? <Badge tone={statusTone(selected.status)}>{`${selected.stageLabel} · ${selected.statusLabel}`}</Badge> : null}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">평가 실행 워크벤치</h1>
              <p className="mt-2 text-sm text-slate-500">
                목표, 월간 실적, 체크인, 다면 피드백을 한 화면에서 검토하고 평가 초안과 AI 보조를 함께 운영합니다.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="작성/검토 필요" value={String(props.summary?.actionRequiredCount ?? 0)} help="지금 처리해야 하는 평가" />
              <MetricCard label="제출 완료" value={String(props.summary?.submittedCount ?? 0)} help="현재 주기 제출 건수" />
              <MetricCard label="반려 건수" value={String(props.summary?.rejectedCount ?? 0)} help="보완이 필요한 평가" />
              <MetricCard label="다면 피드백" value={String(props.summary?.feedbackRoundCount ?? 0)} help={props.summary?.evidenceFreshnessLabel ?? '근거 데이터 상태'} />
            </div>
            {props.currentUser?.role === 'ROLE_ADMIN' && props.adminSummary ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  평가 품질 운영 요약
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
                  <MetricCard label="가이드 열람" value={String(props.adminSummary.guideViewedCount)} help="가이드를 연 평가 건수" compact />
                  <MetricCard label="가이드 확인" value={String(props.adminSummary.guideConfirmedCount)} help="확인 완료 처리된 평가" compact />
                  <MetricCard label="AI 사용" value={String(props.adminSummary.aiUsedCount)} help="AI 보조를 실행한 평가" compact />
                  <MetricCard label="근거 부족" value={String(props.adminSummary.insufficientEvidenceWarningCount)} help="근거 보강이 필요한 평가" compact />
                  <MetricCard label="편향 주의" value={String(props.adminSummary.biasWarningCount)} help="표현 점검이 필요한 평가" compact />
                  <MetricCard label="코칭 보완" value={String(props.adminSummary.coachingGapCount)} help="다음 행동 제안이 약한 평가" compact />
                </div>
              </div>
            ) : null}
          </div>

          <div className="grid w-full gap-3 sm:grid-cols-2 xl:w-[440px]">
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Cycle</span>
              <select
                value={props.selectedCycleId}
                onChange={(event) => moveToCycle(event.target.value)}
                className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-blue-400"
              >
                {props.availableCycles.map((cycle) => (
                  <option key={cycle.id} value={cycle.id}>
                    {cycle.year} · {cycle.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => runMutation('createSelf')}
                disabled={!props.permissions?.canCreateSelfEvaluation || isPending}
                className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                <Sparkles className="mr-2 h-4 w-4" />
                자기평가 시작
              </button>
              <Link
                href="/evaluation/results"
                className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                결과 보기
              </Link>
            </div>
            <div className="grid gap-3 sm:col-span-2 sm:grid-cols-3">
              <button
                type="button"
                onClick={() =>
                  runMutation('saveDraft', {
                    comment: draftComment,
                    gradeId: draftGradeId || null,
                    items: editableItems.map((item) => ({
                      personalKpiId: item.personalKpiId,
                      quantScore: item.draft.quantScore ?? null,
                      planScore: item.draft.planScore ?? null,
                      doScore: item.draft.doScore ?? null,
                      checkScore: item.draft.checkScore ?? null,
                      actScore: item.draft.actScore ?? null,
                      itemComment: item.draft.itemComment ?? '',
                    })),
                  })
                }
                disabled={!selected?.permissions.canEdit || isPending}
                className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-blue-200 bg-blue-50 px-4 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 disabled:opacity-50"
              >
                임시저장
              </button>
              <button
                type="button"
                onClick={() =>
                  runMutation('submit', {
                    comment: draftComment,
                    gradeId: draftGradeId || undefined,
                    items: editableItems.map((item) => ({
                      personalKpiId: item.personalKpiId,
                      quantScore: item.draft.quantScore ?? undefined,
                      planScore: item.draft.planScore ?? undefined,
                      doScore: item.draft.doScore ?? undefined,
                      checkScore: item.draft.checkScore ?? undefined,
                      actScore: item.draft.actScore ?? undefined,
                      itemComment: item.draft.itemComment ?? undefined,
                    })),
                  })
                }
                disabled={!selected?.permissions.canSubmit || isPending}
                className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
              >
                <Send className="mr-2 h-4 w-4" />
                제출
              </button>
              <button
                type="button"
                onClick={() => runMutation('reject', { rejectionReason: rejectReason })}
                disabled={!selected?.permissions.canReject || !rejectReason.trim() || isPending}
                className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 px-4 text-sm font-semibold text-amber-700 transition hover:bg-amber-100 disabled:opacity-50"
              >
                <Undo2 className="mr-2 h-4 w-4" />
                반려
              </button>
            </div>
          </div>
        </div>
      </section>

      {notice ? <Banner tone="success" message={notice} /> : null}
      {errorNotice ? <Banner tone="error" message={errorNotice} /> : null}
      {props.alerts?.map((alert) => <Banner key={alert} tone="warn" message={alert} />)}

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">평가 목록</h2>
              <p className="mt-1 text-sm text-slate-500">내가 작성하거나 검토해야 하는 평가입니다.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{props.summary?.totalCount ?? 0}건</span>
          </div>
          <div className="mt-4 space-y-3">
            {props.evaluations?.length ? (
              props.evaluations.map((evaluation) => (
                <button
                  key={evaluation.id}
                  type="button"
                  onClick={() => moveToEvaluation(evaluation.id)}
                  className={`w-full rounded-2xl border p-4 text-left transition ${
                    evaluation.id === props.selectedEvaluationId
                      ? 'border-blue-300 bg-blue-50 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{evaluation.targetName}</p>
                      <p className="mt-1 text-xs text-slate-500">{evaluation.targetDepartment} · {evaluation.stageLabel}</p>
                    </div>
                    <Badge tone={statusTone(evaluation.status)}>{evaluation.statusLabel}</Badge>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                    <span>{evaluation.isEvaluator ? '검토자 관점' : '내 평가'}</span>
                    <span>{evaluation.updatedAt}</span>
                  </div>
                </button>
              ))
            ) : (
              <EmptyBlock message="현재 선택한 주기에는 평가가 없습니다." />
            )}
          </div>
        </section>

        <section className="space-y-6">
          {selected ? (
            <>
              <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-500">Selected evaluation</p>
                    <h2 className="mt-2 text-xl font-semibold text-slate-900">{selected.target.name} · {selected.stageLabel}</h2>
                    <p className="mt-2 text-sm text-slate-500">
                      {selected.cycle.year} / {selected.cycle.name} · 평가자 {selected.evaluator.name}
                    </p>
                  </div>
                  {displaySettings.showScoreSummary ? (
                    <div className="grid gap-3 sm:grid-cols-3">
                      <MetricCard label="초안 총점" value={computedTotal.toFixed(1)} help="입력 중 계산값" compact />
                      <MetricCard label="저장 점수" value={selected.totalScore?.toFixed(1) ?? '-'} help="마지막 저장 기준" compact />
                      <MetricCard label="근거 하이라이트" value={String(selected.evidence.highlights.length)} help="빠르게 읽을 핵심 근거" compact />
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                      현재 주기 설정에 따라 점수 요약 카드는 평가권자 화면에서 숨겨집니다.
                    </div>
                  )}
                </div>
              </section>

              <div className="overflow-x-auto">
                <div className="inline-flex min-w-full gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
                  {(Object.keys(TAB_LABELS) as WorkbenchTab[]).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setActiveTab(tab)}
                      className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                        activeTab === tab ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      {TAB_LABELS[tab]}
                    </button>
                  ))}
                </div>
              </div>

              {activeTab === 'workbench' ? (
                <div className="space-y-6">
                  <Panel title="검토 포인트" description="평가 단계별로 먼저 봐야 할 핵심 포인트입니다.">
                    <div className="grid gap-3 md:grid-cols-3">
                      {selected.reviewGuidance.map((item) => (
                        <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                          {item}
                        </div>
                      ))}
                    </div>
                  </Panel>

                  <Panel title="종합 의견 및 등급" description="제출 후에는 다음 평가 단계로 자동 연결됩니다.">
                    <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
                      <label className="space-y-2">
                        <span className="text-sm font-semibold text-slate-700">제안 등급</span>
                        <select
                          value={draftGradeId}
                          onChange={(event) => setDraftGradeId(event.target.value)}
                          disabled={selected.permissions.readOnly}
                          className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-blue-400 disabled:bg-slate-100"
                        >
                          <option value="">등급 선택 안 함</option>
                          {selected.gradeOptions.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.gradeName} ({option.scoreRange})
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-2">
                        <span className="text-sm font-semibold text-slate-700">종합 의견</span>
                        <textarea
                          value={draftComment}
                          onChange={(event) => setDraftComment(event.target.value)}
                          disabled={selected.permissions.readOnly}
                          className="min-h-32 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 disabled:bg-slate-100"
                          placeholder="강점, 보완점, 근거를 포함해 작성하세요."
                        />
                      </label>
                    </div>
                    <div className="mt-4">
                      <QualityWarningPanel
                        title="평가 품질 점검"
                        description="현재 입력한 종합 의견을 기준으로 근거, 편향, 코칭 요소를 함께 점검합니다."
                        warnings={draftQualityWarnings}
                      />
                    </div>
                  </Panel>

                  <Panel title="KPI별 점수 입력" description="정량은 점수 입력, 정성은 PDCA와 코멘트를 함께 남깁니다.">
                    <div className="space-y-4">
                      {editableItems.map((item) => (
                        <article key={item.personalKpiId} className="rounded-2xl border border-slate-200 p-4">
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="text-sm font-semibold text-slate-900">{item.title}</h4>
                                <Badge tone="neutral">{item.type === 'QUANTITATIVE' ? '정량' : '정성'}</Badge>
                                {displaySettings.showQuestionWeight ? (
                                  <Badge tone="neutral">가중치 {item.weight}%</Badge>
                                ) : null}
                                {typeof item.recentAchievementRate === 'number' ? (
                                  <Badge tone={item.recentAchievementRate < 80 ? 'warn' : 'success'}>최근 달성률 {item.recentAchievementRate}%</Badge>
                                ) : null}
                              </div>
                              <p className="mt-2 text-sm text-slate-500">{item.definition ?? '정의가 등록되지 않았습니다.'}</p>
                              <p className="mt-2 text-xs text-slate-500">
                                연결 조직 KPI: {item.linkedOrgKpiTitle ?? '연결 없음'} · 목표값 {item.targetValue ?? '-'} {item.unit ?? ''}
                              </p>
                              <GoalContextBlock
                                item={item}
                                expanded={expandedGoalContextId === item.personalKpiId}
                                onToggle={() =>
                                  setExpandedGoalContextId((current) =>
                                    current === item.personalKpiId ? null : item.personalKpiId
                                  )
                                }
                              />
                            </div>
                            {displaySettings.showScoreSummary ? (
                              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-right">
                                <div className="text-xs text-slate-400">가중 반영 점수</div>
                                <div className="mt-1 text-lg font-semibold text-slate-900">{formatWeighted(item).toFixed(1)}</div>
                              </div>
                            ) : null}
                          </div>

                          {item.type === 'QUANTITATIVE' ? (
                            <div className="mt-4 grid gap-4 md:grid-cols-[140px_minmax(0,1fr)]">
                              <label className="space-y-2">
                                <span className="text-sm font-semibold text-slate-700">점수</span>
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  value={item.draft.quantScore ?? ''}
                                  onChange={(event) => updateItemField(item.personalKpiId, 'quantScore', event.target.value === '' ? null : Number(event.target.value))}
                                  disabled={selected.permissions.readOnly}
                                  className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm text-slate-900 outline-none transition focus:border-blue-400 disabled:bg-slate-100"
                                />
                              </label>
                              <label className="space-y-2">
                                <span className="text-sm font-semibold text-slate-700">항목 코멘트</span>
                                <textarea
                                  value={item.draft.itemComment ?? ''}
                                  onChange={(event) => updateItemField(item.personalKpiId, 'itemComment', event.target.value)}
                                  disabled={selected.permissions.readOnly}
                                  className="min-h-24 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 disabled:bg-slate-100"
                                />
                              </label>
                            </div>
                          ) : (
                            <div className="mt-4 grid gap-4 lg:grid-cols-4">
                              {([
                                ['planScore', 'Plan'],
                                ['doScore', 'Do'],
                                ['checkScore', 'Check'],
                                ['actScore', 'Act'],
                              ] as const).map(([field, label]) => (
                                <label key={field} className="space-y-2">
                                  <span className="text-sm font-semibold text-slate-700">{label}</span>
                                  <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    value={item.draft[field] ?? ''}
                                    onChange={(event) => updateItemField(item.personalKpiId, field, event.target.value === '' ? null : Number(event.target.value))}
                                    disabled={selected.permissions.readOnly}
                                    className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm text-slate-900 outline-none transition focus:border-blue-400 disabled:bg-slate-100"
                                  />
                                </label>
                              ))}
                              <label className="space-y-2 lg:col-span-4">
                                <span className="text-sm font-semibold text-slate-700">항목 코멘트</span>
                                <textarea
                                  value={item.draft.itemComment ?? ''}
                                  onChange={(event) => updateItemField(item.personalKpiId, 'itemComment', event.target.value)}
                                  disabled={selected.permissions.readOnly}
                                  className="min-h-24 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 disabled:bg-slate-100"
                                />
                              </label>
                            </div>
                          )}
                        </article>
                      ))}
                    </div>
                  </Panel>

                  <Panel title="반려 사유" description="반려 시 대상자는 같은 평가를 수정해 재제출할 수 있습니다.">
                    <textarea
                      value={rejectReason}
                      onChange={(event) => setRejectReason(event.target.value)}
                      disabled={!selected.permissions.canReject}
                      className="min-h-24 w-full rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-400 disabled:bg-amber-100"
                      placeholder="반려 사유와 보완 요청 포인트를 구체적으로 남기세요."
                    />
                  </Panel>
                </div>
              ) : null}

              {activeTab === 'guide' ? (
                <div className="space-y-6">
                  <Panel
                    title="평가 가이드"
                    description="평가 화면을 벗어나지 않고 목표 정렬, 근거 확인, 편향 점검, 코칭형 문장 원칙을 함께 확인합니다."
                  >
                    <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                      AI는 초안과 보조를 제공할 뿐이며, 최종 판단과 제출 책임은 평가자에게 있습니다. 평가 코멘트를 작성하기 전에 목표와 근거, 편향 가능성을 먼저 확인해 주세요.
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <Badge tone={guideStatus.viewed ? 'success' : 'neutral'}>
                        {guideStatus.viewed ? '가이드 열람 완료' : '가이드 열람 전'}
                      </Badge>
                      <Badge tone={guideStatus.confirmed ? 'success' : 'warn'}>
                        {guideStatus.confirmed ? '가이드 확인 완료' : '확인 체크 필요'}
                      </Badge>
                      <button
                        type="button"
                        onClick={() => void persistGuideAction('confirm')}
                        disabled={!selected.permissions.canEdit || guideBusy || guideStatus.confirmed}
                        className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                      >
                        {guideStatus.confirmed ? '확인 완료됨' : guideBusy ? '기록 중...' : '가이드 확인 완료'}
                      </button>
                    </div>
                  </Panel>

                  <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                    <Panel
                      title="좋은 평가 작성 원칙"
                      description="목표와 역할, 지속 피드백, 편향 주의, 좋은 예시를 현재 평가 건에 바로 적용해 보세요."
                    >
                      <div className="space-y-4">
                        {EVALUATION_GUIDE_SECTIONS.map((section) => (
                          <GuideSectionCard key={section.id} section={section} />
                        ))}
                      </div>
                    </Panel>

                    <div className="space-y-6">
                      <Panel
                        title="좋은 코멘트 / 주의할 코멘트"
                        description="모호한 일반론이나 비난형 표현보다, 근거와 다음 행동이 함께 드러나는 문장이 좋습니다."
                      >
                        <div className="space-y-4">
                          {EVALUATION_GUIDE_EXAMPLES.map((example) => (
                            <GuideExampleCard key={example.id} example={example} />
                          ))}
                        </div>
                      </Panel>

                      <QualityWarningPanel
                        title="현재 평가 코멘트 품질 경고"
                        description="지금 작성 중인 종합 의견을 기준으로 편향, 근거, 코칭 요소를 점검합니다."
                        warnings={draftQualityWarnings}
                      />
                    </div>
                  </div>
                </div>
              ) : null}

              {activeTab === 'evidence' ? (
                <Panel title="근거 자료" description="월간 실적, 체크인, 연결 조직 KPI를 함께 검토합니다.">
                  <SectionTitle title="하이라이트" />
                  <div className="grid gap-3 md:grid-cols-3">
                    {selected.evidence.highlights.map((item) => (
                      <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">{item}</div>
                    ))}
                  </div>
                  <SectionTitle title="월간 실적" />
                  <div className="space-y-3">
                    {selected.evidence.monthlyRecords.length ? selected.evidence.monthlyRecords.map((record) => (
                      <div key={`${record.title}-${record.yearMonth}`} className="rounded-2xl border border-slate-200 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{record.title}</p>
                            <p className="mt-1 text-xs text-slate-500">{record.yearMonth}</p>
                          </div>
                          <Badge tone={typeof record.achievementRate === 'number' && record.achievementRate < 80 ? 'warn' : 'success'}>
                            달성률 {record.achievementRate ?? 0}%
                          </Badge>
                        </div>
                        <p className="mt-3 text-sm text-slate-700">{record.activities ?? record.obstacles ?? '상세 메모 없음'}</p>
                      </div>
                    )) : <EmptyBlock message="연결된 월간 실적이 없습니다." />}
                  </div>
                  <SectionTitle title="체크인 요약" />
                  <div className="space-y-3">
                    {selected.evidence.checkins.length ? selected.evidence.checkins.map((checkin) => (
                      <div key={checkin.id} className="rounded-2xl border border-slate-200 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-slate-900">{checkin.scheduledDate}</p>
                          <Link href="/checkin" className="inline-flex items-center text-sm font-semibold text-blue-600">체크인 보기<ChevronRight className="ml-1 h-4 w-4" /></Link>
                        </div>
                        <p className="mt-3 text-sm text-slate-700">{checkin.summary}</p>
                      </div>
                    )) : <EmptyBlock message="연결된 체크인 기록이 없습니다." />}
                  </div>
                  <div className="mt-4">
                    <QuickLink href={`/evaluation/360/results${props.selectedCycleId ? `?cycleId=${encodeURIComponent(props.selectedCycleId)}` : ''}`} label="360 다면평가 결과 보기" />
                  </div>
                </Panel>
              ) : null}

              {activeTab === 'feedback' ? (
                <Panel title="다면 피드백" description="최소 응답 수를 충족한 라운드는 평가 근거로 활용할 수 있습니다.">
                  <div className="space-y-3">
                    {selected.evidence.feedbackRounds.length ? selected.evidence.feedbackRounds.map((round) => (
                      <div key={round.id} className="rounded-2xl border border-slate-200 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{round.roundName}</p>
                            <p className="mt-1 text-xs text-slate-500">{round.roundType} · 제출 {round.submittedCount}건</p>
                          </div>
                          <Badge tone={round.averageRating && round.averageRating < 3.5 ? 'warn' : 'neutral'}>
                            평균 {round.averageRating?.toFixed(1) ?? '-'}
                          </Badge>
                        </div>
                        <p className="mt-3 text-sm text-slate-700">{round.summary}</p>
                      </div>
                    )) : <EmptyBlock message="연결된 다면 피드백 라운드가 없습니다." />}
                  </div>
                </Panel>
              ) : null}

              {activeTab === 'ai' ? (
                <div className="space-y-6">
                  <Panel title="근거 기반 평가 AI 워크벤치" description="AI는 초안 보조 도구이며, 최종 판단과 제출 책임은 평가자에게 있습니다.">
                    <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                      AI는 근거를 요약해 초안을 제안하지만, 최종 판단과 제출 책임은 사람에게 있습니다. 근거 부족 경고와 편향 가능성 경고를 함께 확인해 주세요.
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <AiCard
                        icon={<MessageSquareMore className="h-5 w-5" />}
                        title={getEvaluationAssistModeLabel('draft')}
                        description={getEvaluationAssistModeDescription('draft')}
                        onClick={() => handleAssistMode('draft')}
                        disabled={Boolean(assistLoadingMode)}
                        loading={assistLoadingMode === 'draft'}
                        active={assistMode === 'draft'}
                      />
                      <AiCard
                        icon={<ShieldAlert className="h-5 w-5" />}
                        title={getEvaluationAssistModeLabel('bias')}
                        description={getEvaluationAssistModeDescription('bias')}
                        onClick={() => handleAssistMode('bias')}
                        disabled={Boolean(assistLoadingMode)}
                        loading={assistLoadingMode === 'bias'}
                        active={assistMode === 'bias'}
                      />
                      <AiCard
                        icon={<Bot className="h-5 w-5" />}
                        title={getEvaluationAssistModeLabel('growth')}
                        description={getEvaluationAssistModeDescription('growth')}
                        onClick={() => handleAssistMode('growth')}
                        disabled={Boolean(assistLoadingMode)}
                        loading={assistLoadingMode === 'growth'}
                        active={assistMode === 'growth'}
                      />
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-500">
                      <Badge tone={previewEvidence.sufficiency === 'strong' ? 'success' : previewEvidence.sufficiency === 'partial' ? 'warn' : 'error'}>
                        {getEvaluationAssistEvidenceLevelLabel(previewEvidence.sufficiency)}
                      </Badge>
                      <span>{getEvaluationAssistModeDescription(assistMode)}</span>
                    </div>
                  </Panel>
                  <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_360px]">
                    <Panel
                      title={`${getEvaluationAssistModeLabel(preview?.mode ?? assistMode)} 미리보기`}
                      description={
                        preview
                          ? preview.source === 'ai'
                            ? '생성된 AI 초안을 검토하고 필요한 경우만 반영하세요.'
                            : getEvaluationAssistDisabledReason(preview.fallbackReason)
                          : '모드를 선택해 AI 초안을 생성하면 평가 코멘트, 코칭 포인트, 개선 과제를 함께 검토할 수 있습니다.'
                      }
                    >
                      {preview?.source === 'disabled' ? (
                        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                          {getEvaluationAssistDisabledReason(preview.fallbackReason)}
                        </div>
                      ) : null}
                      {preview ? (
                        <>
                          <AssistPreviewDetails mode={preview.mode} result={preview.result} />
                          <div className="mt-4">
                            <QualityWarningPanel
                              title="AI 초안 품질 경고"
                              description="AI 결과도 그대로 제출하지 말고 근거, 편향, 코칭 요소를 먼저 점검하세요."
                              warnings={previewQualityWarnings}
                            />
                          </div>
                          <div className="mt-4 flex flex-wrap gap-3">
                            <button type="button" onClick={() => handlePreviewDecision('approve')} disabled={decisionBusy} className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60">
                              <CheckCircle2 className="mr-2 h-4 w-4" />
                              적용
                            </button>
                            <button type="button" onClick={() => handlePreviewDecision('reject')} disabled={decisionBusy} className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-slate-300 px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60">
                              반려
                            </button>
                            <button type="button" onClick={handleCopyPreview} disabled={decisionBusy} className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-slate-300 px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60">
                              {copiedPreviewMode === preview.mode ? '복사됨' : '복사'}
                            </button>
                          </div>
                        </>
                      ) : (
                        <EmptyBlock message="모드를 선택하면 근거 기반 초안이 이 영역에 표시됩니다." />
                      )}
                    </Panel>
                    <EvidencePanel
                      selected={selected}
                      evidence={previewEvidence}
                      selectedSection={selectedEvidenceSection}
                      onSelectSection={setSelectedEvidenceSection}
                    />
                  </div>
                  <Panel title="코칭 / 성장 메모" description="코칭 대화 초안과 성장 과제를 저장 전 메모 형태로 다듬을 수 있습니다.">
                    <textarea
                      value={growthMemo}
                      onChange={(event) => setGrowthMemo(event.target.value)}
                      className="min-h-32 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400"
                      placeholder="성장 메모를 정리하세요."
                    />
                  </Panel>
                </div>
              ) : null}

              {activeTab === 'history' ? (
                <Panel title="제출 이력" description="초안 저장, 제출, 반려, AI 승인 여부까지 감사 가능한 이력으로 남깁니다.">
                  <div className="space-y-3">
                    {selected.auditLogs.length ? selected.auditLogs.map((log) => (
                      <div key={log.id} className="rounded-2xl border border-slate-200 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{log.action}</p>
                            <p className="mt-1 text-xs text-slate-500">{log.actor} · {log.timestamp}</p>
                          </div>
                          <Badge tone="neutral">{log.timestamp}</Badge>
                        </div>
                        <p className="mt-3 text-sm text-slate-700">{log.detail}</p>
                      </div>
                    )) : <EmptyBlock message="감사 이력이 아직 없습니다." />}
                  </div>
                </Panel>
              ) : null}
            </>
          ) : (
            <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                <ClipboardList className="h-6 w-6" />
              </div>
              <h2 className="mt-4 text-lg font-semibold text-slate-900">선택된 평가가 없습니다</h2>
              <p className="mt-2 text-sm text-slate-500">현재 주기에서 작성하거나 검토할 평가를 선택하거나 자기평가를 새로 시작하세요.</p>
            </section>
          )}
        </section>
        {riskDialog}
      </div>
    </div>
  )
}

function PageHeader() {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-500">Evaluation Operations</p>
      <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">평가 실행 워크벤치</h1>
      <p className="mt-2 max-w-3xl text-sm text-slate-500">
        목표, 월간 실적, 체크인, 다면 피드백을 한 화면에서 검토하고 평가 초안과 AI 보조를 함께 운영합니다.
      </p>
    </section>
  )
}

function Panel(props: { title: string; description: string; children: React.ReactNode }) {
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

function QuickLink(props: { href: string; label: string }) {
  return (
    <Link href={props.href} className="inline-flex items-center rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
      {props.label}
      <ChevronRight className="ml-1 h-4 w-4" />
    </Link>
  )
}

function MetricCard(props: { label: string; value: string; help: string; compact?: boolean }) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-slate-50 ${props.compact ? 'px-4 py-3' : 'p-4'}`}>
      <div className="text-xs uppercase tracking-[0.16em] text-slate-400">{props.label}</div>
      <div className="mt-2 text-xl font-semibold text-slate-900">{props.value}</div>
      <div className="mt-1 text-xs text-slate-500">{props.help}</div>
    </div>
  )
}

function Banner(props: { tone: 'success' | 'error' | 'warn'; message: string }) {
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

function Badge(props: { tone: 'success' | 'warn' | 'error' | 'neutral'; children: React.ReactNode }) {
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

function EmptyBlock(props: { message: string }) {
  return <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">{props.message}</div>
}

function SectionTitle(props: { title: string }) {
  return <h4 className="mb-3 mt-6 text-sm font-semibold text-slate-900 first:mt-0">{props.title}</h4>
}

function GoalContextBlock(props: {
  item: EditableWorkbenchItem
  expanded: boolean
  onToggle: () => void
}) {
  const { goalContext } = props.item
  const progressTone =
    typeof goalContext.progressRate === 'number'
      ? goalContext.progressRate < 70
        ? 'error'
        : goalContext.progressRate < 90
          ? 'warn'
          : 'success'
      : 'neutral'
  const approvalTone =
    goalContext.approvalStatusKey === 'CONFIRMED'
      ? 'success'
      : goalContext.approvalStatusKey === 'ARCHIVED'
        ? 'warn'
        : goalContext.approvalStatusKey === 'DRAFT'
          ? 'neutral'
          : 'error'

  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">연결 목표 맥락</div>
          <p className="mt-1 text-sm font-semibold text-slate-900">
            {goalContext.linkedGoalLabel ?? props.item.linkedOrgKpiTitle ?? '연결 목표 맥락'}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            {goalContext.achievementSummary ?? '주요 성과 기술이 아직 등록되지 않았습니다.'}
          </p>
        </div>
        <button
          type="button"
          onClick={props.onToggle}
          className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
        >
          {props.expanded ? '접기' : '상세 보기'}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Badge tone={progressTone}>{goalContext.progressLabel}</Badge>
        <Badge tone={approvalTone}>{goalContext.approvalStatusLabel}</Badge>
        <Badge tone="neutral">{goalContext.weightLabel}</Badge>
      </div>

      {props.expanded ? (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <GoalContextField label="기간" value={goalContext.periodLabel} />
          <GoalContextField
            label="협업한 동료"
            value={
              goalContext.collaborators.length
                ? goalContext.collaborators.join(', ')
                : '협업 정보 없음'
            }
          />
          <GoalContextField
            label="진행률"
            value={
              typeof goalContext.progressRate === 'number'
                ? `${goalContext.progressRate}%`
                : '진행률 미집계'
            }
          />
          <GoalContextField label="승인 상태" value={goalContext.approvalStatusLabel.replace('승인 상태: ', '')} />
          <GoalContextField label="성과 가중치" value={goalContext.weightLabel.replace('성과 가중치 ', '')} />
          <GoalContextField
            label="연결 목표"
            value={goalContext.linkedGoalLabel ?? props.item.linkedOrgKpiTitle ?? '연결 없음'}
          />
          <div className="md:col-span-2">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">주요 성과 기술</div>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              {goalContext.achievementSummary ?? '등록된 성과 기술이 없습니다.'}
            </p>
          </div>
          <div className="md:col-span-2">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">관련 링크</div>
            {goalContext.links.length ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {goalContext.links.map((link) => (
                  <a
                    key={link.id}
                    href={link.href}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                  >
                    {link.label}
                    {link.uploadedBy ? <span className="ml-1 text-slate-400">· {link.uploadedBy}</span> : null}
                  </a>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-500">연결된 링크가 없습니다.</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function GoalContextField(props: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{props.label}</div>
      <p className="mt-2 text-sm text-slate-700">{props.value}</p>
    </div>
  )
}

function AiCard(props: {
  icon: React.ReactNode
  title: string
  description: string
  onClick: () => void
  disabled?: boolean
  loading?: boolean
  active?: boolean
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      className={`rounded-2xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
        props.active
          ? 'border-blue-300 bg-blue-50 shadow-sm'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
      }`}
    >
      <div className="flex items-center gap-2 text-slate-900">
        {props.icon}
        <span className="text-sm font-semibold">{props.title}</span>
      </div>
      <p className="mt-3 text-sm text-slate-500">{props.description}</p>
      {props.loading ? <p className="mt-3 text-xs font-semibold text-blue-600">AI 제안을 생성하고 있습니다...</p> : null}
    </button>
  )
}

function AssistPreviewDetails(props: {
  mode: EvaluationAssistMode
  result: EvaluationAssistResult
}) {
  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
          {getEvaluationAssistActionLabel(props.mode)}
        </div>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-800">{props.result.draftText}</p>
      </div>
      <PreviewList title="강점 포인트" items={props.result.strengths} />
      <PreviewList title="우려 포인트" items={props.result.concerns} />
      <PreviewList title="코칭 포인트" items={props.result.coachingPoints} />
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">다음 단계</div>
        <p className="mt-2 text-sm text-slate-800">{props.result.nextStep}</p>
      </div>
    </div>
  )
}

function EvidencePanel(props: {
  selected: NonNullable<EvaluationWorkbenchPageData['selected']>
  evidence: EvaluationAssistEvidenceView
  selectedSection: EvidenceSectionKey
  onSelectSection: (section: EvidenceSectionKey) => void
}) {
  const sections: Array<{ key: EvidenceSectionKey; label: string }> = [
    { key: 'highlights', label: '핵심 근거' },
    { key: 'kpi', label: 'KPI / 월간 실적' },
    { key: 'notes', label: '피드백 / 메모' },
    { key: 'warnings', label: '품질 경고' },
  ]

  return (
    <Panel
      title="근거 패널"
      description="KPI, 월간 실적, 피드백, 체크인 메모 중 현재 확인 가능한 자료를 기반으로 초안을 검토합니다."
    >
      <div className="mb-4 flex flex-wrap gap-2">
        {sections.map((section) => (
          <button
            key={section.key}
            type="button"
            onClick={() => props.onSelectSection(section.key)}
            className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
              props.selectedSection === section.key
                ? 'bg-slate-900 text-white'
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {section.label}
          </button>
        ))}
      </div>

      <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={props.evidence.sufficiency === 'strong' ? 'success' : props.evidence.sufficiency === 'partial' ? 'warn' : 'error'}>
            {getEvaluationAssistEvidenceLevelLabel(props.evidence.sufficiency)}
          </Badge>
          <span className="text-sm text-slate-600">
            {props.selected.target.name}님의 현재 평가 근거와 코멘트 초안 품질을 함께 검토합니다.
          </span>
        </div>
        {props.evidence.alerts.length ? (
          <div className="mt-3 space-y-2">
            {props.evidence.alerts.map((alert) => (
              <div key={alert} className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                {alert}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {props.selectedSection === 'highlights' ? (
        <PreviewList
          title="AI 작성에 사용한 핵심 포인트"
          items={props.evidence.keyPoints.length ? props.evidence.keyPoints : ['확인 가능한 핵심 포인트가 아직 없습니다.']}
        />
      ) : null}

      {props.selectedSection === 'kpi' ? (
        <div className="space-y-3">
          {props.evidence.kpiSummaries.length ? (
            props.evidence.kpiSummaries.map((item) => (
              <div key={item} className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                {item}
              </div>
            ))
          ) : (
            <EmptyBlock message="연결된 KPI 근거가 부족합니다." />
          )}
          {props.evidence.monthlySummaries.length ? (
            <details className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <summary className="cursor-pointer text-sm font-semibold text-slate-900">월간 실적 상세 펼치기</summary>
              <div className="mt-3 space-y-3">
                {props.evidence.monthlySummaries.map((item) => (
                  <div key={item} className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                    {item}
                  </div>
                ))}
              </div>
            </details>
          ) : null}
        </div>
      ) : null}

      {props.selectedSection === 'notes' ? (
        <div className="space-y-3">
          {props.evidence.noteSummaries.length ? (
            props.evidence.noteSummaries.map((item) => (
              <div key={item} className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                {item}
              </div>
            ))
          ) : (
            <EmptyBlock message="최근 피드백과 메모가 부족합니다." />
          )}
        </div>
      ) : null}

      {props.selectedSection === 'warnings' ? (
        <PreviewList
          title="품질 경고"
          items={
            props.evidence.warnings.length
              ? props.evidence.warnings
              : ['현재 확인된 근거 범위에서는 별도 품질 경고가 없습니다.']
          }
        />
      ) : null}
    </Panel>
  )
}

function PreviewList(props: { title: string; items: string[] }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{props.title}</div>
      <ul className="mt-2 space-y-2">
        {props.items.map((item) => (
          <li key={`${props.title}-${item}`} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}

function QualityWarningPanel(props: {
  title: string
  description: string
  warnings: EvaluationQualityWarning[]
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="mb-3">
        <h4 className="text-sm font-semibold text-slate-900">{props.title}</h4>
        <p className="mt-1 text-sm text-slate-500">{props.description}</p>
      </div>
      {props.warnings.length ? (
        <div className="space-y-3">
          {props.warnings.map((warning) => (
            <div key={warning.key} className="rounded-2xl border border-amber-200 bg-white px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-amber-800">
                <AlertTriangle className="h-4 w-4" />
                <span>{warning.title}</span>
              </div>
              <p className="mt-2 text-sm text-slate-700">{warning.message}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm text-emerald-800">
          현재 입력과 근거 기준으로는 추가 품질 경고가 없습니다.
        </div>
      )}
    </div>
  )
}

function GuideSectionCard(props: { section: EvaluationGuideSection }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <h4 className="text-sm font-semibold text-slate-900">{props.section.title}</h4>
      <p className="mt-1 text-sm text-slate-500">{props.section.description}</p>
      <ul className="mt-3 space-y-2">
        {props.section.items.map((item) => (
          <li key={`${props.section.id}-${item}`} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}

function GuideExampleCard(props: { example: EvaluationGuideExample }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-sm font-semibold text-slate-900">{props.example.title}</div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-rose-200 bg-white px-4 py-3">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-500">주의 문장</div>
          <p className="mt-2 text-sm text-slate-700">{props.example.bad}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-white px-4 py-3">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-500">권장 문장</div>
          <p className="mt-2 text-sm text-slate-700">{props.example.good}</p>
        </div>
      </div>
      <p className="mt-3 text-sm text-slate-600">{props.example.takeaway}</p>
    </div>
  )
}

function toneFromCount(count: number): 'success' | 'warn' | 'error' | 'neutral' {
  if (count >= 5) return 'error'
  if (count > 0) return 'warn'
  return 'success'
}

function labelFromCount(count: number) {
  if (count >= 5) return '검토 집중'
  if (count > 0) return '주의 필요'
  return '정상'
}

function statusTone(status: string): 'success' | 'warn' | 'error' | 'neutral' {
  if (status === 'CONFIRMED') return 'success'
  if (status === 'REJECTED') return 'error'
  if (status === 'SUBMITTED' || status === 'PENDING') return 'warn'
  return 'neutral'
}

function formatWeighted(item: {
  type: 'QUANTITATIVE' | 'QUALITATIVE'
  weight: number
  draft: DraftItemState
}) {
  if (item.type === 'QUANTITATIVE') {
    return ((item.draft.quantScore ?? 0) * item.weight) / 100
  }

  const pdca =
    Number(item.draft.planScore ?? 0) * 0.3 +
    Number(item.draft.doScore ?? 0) * 0.4 +
    Number(item.draft.checkScore ?? 0) * 0.2 +
    Number(item.draft.actScore ?? 0) * 0.1
  return (pdca * item.weight) / 100
}

