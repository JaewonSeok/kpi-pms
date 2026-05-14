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
  ShieldCheck,
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
import {
  normalizeEvaluationPerformanceBriefingSnapshot,
  type EvaluationPerformanceBriefingSnapshot,
} from '@/lib/evaluation-performance-briefing'
import { EvaluationPerformanceBriefingPanel } from '@/components/evaluation/EvaluationPerformanceBriefingPanel'
import { MidReviewReferencePanel } from '@/components/mid-review/MidReviewReferencePanel'
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
import type { Evaluation2026ActivationReadinessResult } from '@/server/evaluation-2026-activation-readiness'
import type { EvaluationPreviewResult2026 } from '@/server/evaluation-preview-2026'
import type { EvaluationPreviewReadinessSummary2026 } from '@/server/evaluation-preview-2026-readiness'
import type {
  EvaluationPolicy2026MappingCandidates,
  EvaluationPolicy2026MetadataPatchResult,
} from '@/server/evaluation-preview-2026-mapping'

type WorkbenchTab =
  | 'workbench'
  | 'guide'
  | 'evidence'
  | 'previous'
  | 'feedback'
  | 'briefing'
  | 'ai'
  | 'history'

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
type EvaluationListEntry = NonNullable<EvaluationWorkbenchPageData['evaluations']>[number]
type EvaluationPreview2026ApiData = {
  evaluation: {
    id: string
    evalYear: number
    targetName: string
    targetDepartment: string
    evalStage: string
  }
  preview: EvaluationPreviewResult2026
}
type EvaluationPreviewReadiness2026ApiData = EvaluationPreviewReadinessSummary2026
type EvaluationActivationReadiness2026ApiData = Evaluation2026ActivationReadinessResult
type EvaluationPolicyMapping2026ApiData = EvaluationPolicy2026MappingCandidates
type EvaluationPolicyMetadataPatch2026ApiData = EvaluationPolicy2026MetadataPatchResult
type PolicyCategoryDraft2026 = 'ORG_GOAL' | 'PROJECT_T' | 'PROJECT_K' | 'DAILY_WORK' | 'KEEP_UNCLASSIFIED' | ''
type SalesGroupDraft2026 = 'SALES' | 'NON_SALES' | 'UNRESOLVED' | ''
type ThresholdDecisionDraft2026 = 'UNRESOLVED' | 'SUPER_PRIORITY' | 'OUTSTANDING_PRIORITY' | ''

const TAB_LABELS: Record<WorkbenchTab, string> = {
  workbench: '종합',
  guide: '평가 가이드',
  evidence: '근거 기록',
  previous: '이전 단계 의견',
  feedback: '다면 피드백',
  briefing: 'AI 성과 브리핑',
  ai: 'AI 보조',
  history: '이력',
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
  const [briefingBusy, setBriefingBusy] = useState(false)
  const [briefing, setBriefing] = useState<EvaluationPerformanceBriefingSnapshot | null>(null)
  const [policyPreview2026, setPolicyPreview2026] = useState<EvaluationPreview2026ApiData | null>(null)
  const [policyPreview2026Loading, setPolicyPreview2026Loading] = useState(false)
  const [policyPreview2026Error, setPolicyPreview2026Error] = useState('')
  const [guideStatus, setGuideStatus] = useState({ viewed: false, confirmed: false })
  const [adminSummaryOpen, setAdminSummaryOpen] = useState(false)
  const [draftComment, setDraftComment] = useState('')
  const [draftStrengthComment, setDraftStrengthComment] = useState('')
  const [draftImprovementComment, setDraftImprovementComment] = useState('')
  const [draftNextStepGuidance, setDraftNextStepGuidance] = useState('')
  const [draftGradeId, setDraftGradeId] = useState<string>('')
  const [growthMemo, setGrowthMemo] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [draftItems, setDraftItems] = useState<Record<string, DraftItemState>>({})
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState<'ALL' | EvaluationListEntry['evalStage']>('ALL')
  const [statusFilter, setStatusFilter] = useState<'ALL' | EvaluationListEntry['status']>('ALL')
  const [scopeFilter, setScopeFilter] = useState<'ALL' | 'MY_SELF' | 'MY_REVIEWS' | 'PENDING_REVIEW'>('ALL')
  const [departmentFilter, setDepartmentFilter] = useState<'ALL' | string>('ALL')
  const [policyReadiness2026, setPolicyReadiness2026] = useState<EvaluationPreviewReadiness2026ApiData | null>(null)
  const [policyReadiness2026Loading, setPolicyReadiness2026Loading] = useState(false)
  const [policyReadiness2026Error, setPolicyReadiness2026Error] = useState('')
  const [policyActivationReadiness2026, setPolicyActivationReadiness2026] =
    useState<EvaluationActivationReadiness2026ApiData | null>(null)
  const [policyActivationReadiness2026Loading, setPolicyActivationReadiness2026Loading] = useState(false)
  const [policyActivationReadiness2026Error, setPolicyActivationReadiness2026Error] = useState('')
  const [policyMapping2026, setPolicyMapping2026] = useState<EvaluationPolicyMapping2026ApiData | null>(null)
  const [policyMapping2026Loading, setPolicyMapping2026Loading] = useState(false)
  const [policyMapping2026Saving, setPolicyMapping2026Saving] = useState(false)
  const [policyMapping2026Error, setPolicyMapping2026Error] = useState('')
  const [policyMapping2026Notice, setPolicyMapping2026Notice] = useState('')
  const [policyCategoryDrafts2026, setPolicyCategoryDrafts2026] = useState<Record<string, PolicyCategoryDraft2026>>({})
  const [salesGroupDrafts2026, setSalesGroupDrafts2026] = useState<Record<string, SalesGroupDraft2026>>({})
  const [thresholdDecisionDrafts2026, setThresholdDecisionDrafts2026] = useState<Record<string, ThresholdDecisionDraft2026>>({})
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
    setBriefingBusy(false)
    setPreview(null)
    setPolicyPreview2026(null)
    setPolicyPreview2026Error('')
    setPolicyPreview2026Loading(false)
    setPolicyReadiness2026(null)
    setPolicyReadiness2026Error('')
    setPolicyReadiness2026Loading(false)
    setPolicyActivationReadiness2026(null)
    setPolicyActivationReadiness2026Error('')
    setPolicyActivationReadiness2026Loading(false)
    setPolicyMapping2026(null)
    setPolicyMapping2026Error('')
    setPolicyMapping2026Notice('')
    setPolicyMapping2026Loading(false)
    setPolicyMapping2026Saving(false)
    setPolicyCategoryDrafts2026({})
    setSalesGroupDrafts2026({})
    setThresholdDecisionDrafts2026({})
    setBriefing(null)
    setAssistLoadingMode(null)
    setCopiedPreviewMode(null)
    setSelectedEvidenceSection('highlights')
    setExpandedGoalContextId(null)
    setAssistMode('draft')
    setGuideStatus({ viewed: false, confirmed: false })
    guideViewRequestRef.current = null

    if (cycleChanged) {
      setActiveTab('workbench')
      setSearch('')
      setStageFilter('ALL')
      setStatusFilter('ALL')
      setScopeFilter('ALL')
      setDepartmentFilter('ALL')
    }
  }, [props.selectedCycleId, workbenchContextKey])

  useEffect(() => {
    if (!selected) {
      setDraftComment('')
      setDraftStrengthComment('')
      setDraftImprovementComment('')
      setDraftNextStepGuidance('')
      setDraftGradeId('')
      setGrowthMemo('')
      setRejectReason('')
      setPreview(null)
      setPolicyPreview2026(null)
      setPolicyPreview2026Error('')
      setPolicyPreview2026Loading(false)
      setAssistLoadingMode(null)
      setCopiedPreviewMode(null)
      setSelectedEvidenceSection('highlights')
      setExpandedGoalContextId(null)
      setAssistMode('draft')
      setGuideBusy(false)
      setBriefingBusy(false)
      setBriefing(null)
      setGuideStatus({ viewed: false, confirmed: false })
      setDraftItems({})
      return
    }

    setGuideStatus(selected.guideStatus)
    setDraftComment(selected.comment ?? '')
    setDraftStrengthComment(selected.strengthComment ?? '')
    setDraftImprovementComment(selected.improvementComment ?? '')
    setDraftNextStepGuidance(selected.nextStepGuidance ?? '')
    setDraftGradeId(selected.gradeId ?? '')
    setGrowthMemo('')
    setRejectReason('')
    setPreview(null)
    setPolicyPreview2026(null)
    setPolicyPreview2026Error('')
    setPolicyPreview2026Loading(false)
    setAssistLoadingMode(null)
    setCopiedPreviewMode(null)
    setSelectedEvidenceSection('highlights')
    setExpandedGoalContextId(null)
    setAssistMode('draft')
    setGuideBusy(false)
    setBriefingBusy(false)
    setBriefing(selected.briefing?.latestSnapshot ?? null)
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

  const visibleTabs = useMemo(
    () =>
      (Object.keys(TAB_LABELS) as WorkbenchTab[]).filter(
        (tab) => tab !== 'briefing' || Boolean(selected?.briefing?.canView)
      ),
    [selected?.briefing?.canView]
  )

  useEffect(() => {
    if (!visibleTabs.includes(activeTab)) {
      setActiveTab('workbench')
    }
  }, [activeTab, visibleTabs])

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

  const filteredEvaluations = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    return (props.evaluations ?? []).filter((evaluation) => {
      const matchesKeyword =
        !keyword ||
        evaluation.targetName.toLowerCase().includes(keyword) ||
        evaluation.targetDepartment.toLowerCase().includes(keyword) ||
        evaluation.evaluatorName.toLowerCase().includes(keyword)

      const matchesStage = stageFilter === 'ALL' || evaluation.evalStage === stageFilter
      const matchesStatus = statusFilter === 'ALL' || evaluation.status === statusFilter
      const matchesScope =
        scopeFilter === 'ALL'
          ? true
          : scopeFilter === 'MY_SELF'
            ? evaluation.isMine && evaluation.evalStage === 'SELF'
            : scopeFilter === 'MY_REVIEWS'
              ? evaluation.isEvaluator
              : evaluation.isEvaluator && ['PENDING', 'IN_PROGRESS', 'REJECTED'].includes(evaluation.status)
      const matchesDepartment =
        departmentFilter === 'ALL' || evaluation.targetDepartment === departmentFilter
      return matchesKeyword && matchesStage && matchesStatus && matchesScope && matchesDepartment
    })
  }, [departmentFilter, props.evaluations, scopeFilter, search, stageFilter, statusFilter])

  const submitActionLabel = selected?.permissions.canFinalize ? '최종 확정' : '제출'
  const departmentOptions = useMemo(
    () => ['ALL', ...new Set((props.evaluations ?? []).map((evaluation) => evaluation.targetDepartment))],
    [props.evaluations]
  )

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
  const canViewPolicyPreview2026 = Boolean(
    props.currentUser?.role === 'ROLE_ADMIN' && props.permissions?.canSeeAllInCycle && selected
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

  async function loadPolicyPreview2026() {
    if (!selected || !canViewPolicyPreview2026) return
    setPolicyPreview2026Loading(true)
    setPolicyPreview2026Error('')

    try {
      const response = await fetch(`/api/evaluation/${selected.id}/preview-2026`, {
        method: 'GET',
      })
      const json = await response.json().catch(() => null)
      if (!response.ok || !json?.success) {
        throw new Error(json?.error?.message ?? '2026 평가 미리보기를 불러오지 못했습니다.')
      }

      setPolicyPreview2026(json.data as EvaluationPreview2026ApiData)
    } catch (error) {
      setPolicyPreview2026(null)
      setPolicyPreview2026Error(
        error instanceof Error ? error.message : '2026 평가 미리보기를 불러오지 못했습니다.'
      )
    } finally {
      setPolicyPreview2026Loading(false)
    }
  }

  async function loadPolicyReadiness2026() {
    if (!canViewPolicyPreview2026) return
    setPolicyReadiness2026Loading(true)
    setPolicyReadiness2026Error('')

    try {
      const params = new URLSearchParams()
      if (props.selectedCycleId) {
        params.set('cycleId', props.selectedCycleId)
      } else {
        params.set('year', '2026')
      }
      const query = params.toString()
      const response = await fetch(`/api/evaluation/preview-2026/readiness${query ? `?${query}` : ''}`, {
        method: 'GET',
      })
      const json = await response.json().catch(() => null)
      if (!response.ok || !json?.success) {
        throw new Error(json?.error?.message ?? '2026 평가 전환 준비 상태를 불러오지 못했습니다.')
      }

      setPolicyReadiness2026(json.data as EvaluationPreviewReadiness2026ApiData)
    } catch (error) {
      setPolicyReadiness2026(null)
      setPolicyReadiness2026Error(
        error instanceof Error ? error.message : '2026 평가 전환 준비 상태를 불러오지 못했습니다.'
      )
    } finally {
      setPolicyReadiness2026Loading(false)
    }
  }

  async function loadPolicyActivationReadiness2026() {
    if (!canViewPolicyPreview2026) return
    setPolicyActivationReadiness2026Loading(true)
    setPolicyActivationReadiness2026Error('')

    try {
      const params = new URLSearchParams()
      if (props.selectedCycleId) {
        params.set('cycleId', props.selectedCycleId)
      } else {
        params.set('year', '2026')
      }
      const query = params.toString()
      const response = await fetch(`/api/evaluation/preview-2026/activation-readiness${query ? `?${query}` : ''}`, {
        method: 'GET',
      })
      const json = await response.json().catch(() => null)
      if (!response.ok || !json?.success) {
        throw new Error(json?.error?.message ?? '2026 공식 전환 준비 상태를 불러오지 못했습니다.')
      }

      setPolicyActivationReadiness2026(json.data as EvaluationActivationReadiness2026ApiData)
    } catch (error) {
      setPolicyActivationReadiness2026(null)
      setPolicyActivationReadiness2026Error(
        error instanceof Error ? error.message : '2026 공식 전환 준비 상태를 불러오지 못했습니다.'
      )
    } finally {
      setPolicyActivationReadiness2026Loading(false)
    }
  }

  async function loadPolicyMappingCandidates2026() {
    if (!canViewPolicyPreview2026) return
    setPolicyMapping2026Loading(true)
    setPolicyMapping2026Error('')
    setPolicyMapping2026Notice('')

    try {
      const params = new URLSearchParams()
      if (props.selectedCycleId) {
        params.set('cycleId', props.selectedCycleId)
      } else {
        params.set('year', '2026')
      }
      const query = params.toString()
      const response = await fetch(`/api/evaluation/preview-2026/mapping-candidates${query ? `?${query}` : ''}`, {
        method: 'GET',
      })
      const json = await response.json().catch(() => null)
      if (!response.ok || !json?.success) {
        throw new Error(json?.error?.message ?? '2026 정책 매핑 후보를 불러오지 못했습니다.')
      }

      const data = json.data as EvaluationPolicyMapping2026ApiData
      setPolicyMapping2026(data)
      setPolicyCategoryDrafts2026({})
      setSalesGroupDrafts2026({})
      setThresholdDecisionDrafts2026({})
    } catch (error) {
      setPolicyMapping2026(null)
      setPolicyMapping2026Error(error instanceof Error ? error.message : '2026 정책 매핑 후보를 불러오지 못했습니다.')
    } finally {
      setPolicyMapping2026Loading(false)
    }
  }

  async function savePolicyMetadata2026() {
    if (!canViewPolicyPreview2026 || !policyMapping2026) return
    const itemMappings = policyMapping2026.policyCategoryCandidates.flatMap((candidate) => {
      const category = policyCategoryDrafts2026[candidate.evaluationItemId]
      if (!category) return []
      return [{
        evaluationItemId: candidate.evaluationItemId,
        personalKpiId: candidate.personalKpiId,
        category,
        note: 'HR manual mapping from 2026 preview readiness panel',
      }]
    })
    const salesGroupMappings = policyMapping2026.salesGroupCandidates.flatMap((candidate) => {
      const salesGroup = salesGroupDrafts2026[`${candidate.evalCycleId}:${candidate.employeeId}`]
      if (!salesGroup) return []
      return [{
        evalCycleId: candidate.evalCycleId,
        employeeId: candidate.employeeId,
        salesGroup,
        note: 'HR manual sales/non-sales mapping from 2026 preview readiness panel',
      }]
    })
    const thresholdDecisions = policyMapping2026.thresholdDecisions.flatMap((candidate) => {
      const decision = thresholdDecisionDrafts2026[candidate.evalCycleId]
      if (!decision) return []
      return [{
        evalCycleId: candidate.evalCycleId,
        decision,
        note: 'HR decision for TEAM_MEMBER_SALES Super/Outstanding overlap from 2026 preview readiness panel',
      }]
    })

    if (!itemMappings.length && !salesGroupMappings.length && !thresholdDecisions.length) {
      setPolicyMapping2026Notice('저장할 2026 정책 metadata 변경 사항이 없습니다.')
      return
    }

    setPolicyMapping2026Saving(true)
    setPolicyMapping2026Error('')
    setPolicyMapping2026Notice('')

    try {
      const response = await fetch('/api/evaluation/preview-2026/policy-metadata', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemMappings,
          salesGroupMappings,
          thresholdDecisions,
        }),
      })
      const json = await response.json().catch(() => null)
      if (!response.ok || !json?.success) {
        throw new Error(json?.error?.message ?? '2026 정책 metadata를 저장하지 못했습니다.')
      }

      const result = json.data as EvaluationPolicyMetadataPatch2026ApiData
      setPolicyMapping2026Notice(
        `저장 완료: 항목 ${result.updatedItemMappings}건, 영업/비영업 ${result.updatedSalesGroupMappings}건, 기준 결정 ${result.updatedThresholdDecisions}건`
      )
      await loadPolicyMappingCandidates2026()
      await loadPolicyReadiness2026()
      if (policyActivationReadiness2026) {
        await loadPolicyActivationReadiness2026()
      }
      if (policyPreview2026) {
        await loadPolicyPreview2026()
      }
    } catch (error) {
      setPolicyMapping2026Error(error instanceof Error ? error.message : '2026 정책 metadata를 저장하지 못했습니다.')
    } finally {
      setPolicyMapping2026Saving(false)
    }
  }

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
          ? `/evaluation/performance/${encodeURIComponent(nextId)}?cycleId=${encodeURIComponent(props.selectedCycleId ?? '')}`
          : `/evaluation/performance?cycleId=${encodeURIComponent(props.selectedCycleId ?? '')}`
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
        const isFinalConfirmation = Boolean(selected.permissions.canFinalize)
        const confirmationText = isFinalConfirmation ? '확정' : '제출'
        const confirmed = await requestRiskConfirmation({
          actionName: 'FINAL_SUBMIT',
          actionLabel: isFinalConfirmation ? '평가 최종 확정' : '평가 최종 제출',
          targetLabel: selected.target.name,
          detail: isFinalConfirmation
            ? '현재 마스터 로그인 상태에서 평가를 최종 확정합니다.'
            : '현재 마스터 로그인 상태에서 평가를 최종 제출합니다.',
          confirmationText,
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
      const successMessage =
        typeof json?.data?.message === 'string'
          ? json.data.message
          : action === 'saveDraft'
            ? '평가 초안을 저장했습니다.'
            : action === 'submit'
              ? `${submitActionLabel}을 완료했습니다.`
              : '평가를 반려하고 보완을 요청했습니다.'
      setNotice(successMessage)
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
          strengthComment: draftStrengthComment,
          improvementComment: draftImprovementComment,
          nextStepGuidance: draftNextStepGuidance,
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

  async function handleGenerateBriefing() {
    if (!selected || !selected.briefing?.canView) return
    setNotice('')
    setErrorNotice('')
    setBriefingBusy(true)

    try {
      const response = await fetch('/api/ai/evaluation-briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          evaluationId: selected.id,
        }),
      })
      const json = await response.json().catch(() => null)
      if (!response.ok || !json?.success) {
        throw new Error(json?.error?.message ?? 'AI 성과 브리핑을 생성하지 못했습니다.')
      }

      const nextBriefing = normalizeEvaluationPerformanceBriefingSnapshot(json.data)
      if (!nextBriefing) {
        throw new Error('AI 성과 브리핑 결과 형식을 확인하지 못했습니다.')
      }

      setBriefing(nextBriefing)
      setActiveTab('briefing')
      setNotice(
        nextBriefing.source === 'ai'
          ? 'AI 성과 브리핑을 생성했습니다.'
          : '근거 기반 요약으로 AI 성과 브리핑을 준비했습니다.'
      )
    } catch (error) {
      setErrorNotice(error instanceof Error ? error.message : 'AI 성과 브리핑을 생성하지 못했습니다.')
    } finally {
      setBriefingBusy(false)
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

        if (typeof applied.strengthComment === 'string') {
          setDraftStrengthComment(applied.strengthComment)
        }

        if (typeof applied.improvementComment === 'string') {
          setDraftImprovementComment(applied.improvementComment)
        }

        if (typeof applied.nextStepGuidance === 'string') {
          setDraftNextStepGuidance(applied.nextStepGuidance)
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
    startTransition(() => router.push(`/evaluation/performance?cycleId=${encodeURIComponent(cycleId)}`))
  }

  function moveToEvaluation(evaluationId: string) {
    const params = new URLSearchParams()
    if (props.selectedCycleId) params.set('cycleId', props.selectedCycleId)
    const query = params.toString()
    startTransition(() =>
      router.push(
        query
          ? `/evaluation/performance/${encodeURIComponent(evaluationId)}?${query}`
          : `/evaluation/performance/${encodeURIComponent(evaluationId)}`
      )
    )
  }

  if (props.state !== 'ready') {
    return (
      <div className="space-y-6">
        <section className="rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-sm sm:px-6 sm:py-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-500">성과평가 운영</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">성과평가</h1>
          <p className="mt-1 text-sm text-slate-500">
            이번 주기 평가 진행 상황과 처리해야 할 항목을 한 화면에서 확인하세요.
          </p>
        </section>
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

  const actionItems = (props.evaluations ?? []).filter(
    (evaluation) =>
      (evaluation.isEvaluator &&
        ['PENDING', 'IN_PROGRESS', 'REJECTED'].includes(evaluation.status)) ||
      (evaluation.isMine &&
        evaluation.evalStage === 'SELF' &&
        ['PENDING', 'IN_PROGRESS', 'REJECTED'].includes(evaluation.status))
  )
  const actionItemPreview = actionItems.slice(0, 5)
  const actionRequiredCount = props.summary?.actionRequiredCount ?? 0
  const submittedCount = props.summary?.submittedCount ?? 0
  const rejectedCount = props.summary?.rejectedCount ?? 0
  const feedbackRoundCount = props.summary?.feedbackRoundCount ?? 0
  const adminSummary = props.adminSummary
  const adminQualityHasWarning = Boolean(
    adminSummary &&
      (adminSummary.insufficientEvidenceWarningCount > 0 ||
        adminSummary.biasWarningCount > 0 ||
        adminSummary.coachingGapCount > 0)
  )

  return (
    <div className="space-y-5">
      {/* Unified header — replaces the previous duplicate PageHeader + giant summary card. */}
      <section className="rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-sm sm:px-6 sm:py-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-500">
              성과평가 운영
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">성과평가</h1>
              <Badge tone={toneFromCount(actionRequiredCount)}>
                {labelFromCount(actionRequiredCount)}
              </Badge>
              {selected ? (
                <Badge tone={statusTone(selected.status)}>
                  {`${selected.stageLabel} · ${selected.statusLabel}`}
                </Badge>
              ) : null}
            </div>
            <p className="text-sm text-slate-500">
              이번 주기 평가 진행 상황과 처리해야 할 항목을 한 화면에서 확인하세요.
            </p>
          </div>

          <div className="grid w-full gap-3 sm:grid-cols-2 xl:w-[440px]">
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">평가 주기</span>
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
            <div className="grid gap-3 sm:grid-cols-3">
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
              {props.currentUser?.role === 'ROLE_ADMIN' ? (
                <Link
                  href={`/admin/performance-assignments${props.selectedCycleId ? `?cycleId=${encodeURIComponent(props.selectedCycleId)}` : ''}`}
                  className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  배정 관리
                </Link>
              ) : null}
            </div>
            <div className="grid gap-3 sm:col-span-2 sm:grid-cols-3">
              <button
                type="button"
                onClick={() =>
                  runMutation('saveDraft', {
                    comment: draftComment,
                    strengthComment: draftStrengthComment,
                    improvementComment: draftImprovementComment,
                    nextStepGuidance: draftNextStepGuidance,
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
                    strengthComment: draftStrengthComment,
                    improvementComment: draftImprovementComment,
                    nextStepGuidance: draftNextStepGuidance || undefined,
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
                {submitActionLabel}
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
            {selected?.permissions.submitDisabledReason ? (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {selected.permissions.submitDisabledReason}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {notice ? <Banner tone="success" message={notice} /> : null}
      {errorNotice ? <Banner tone="error" message={errorNotice} /> : null}
      {props.alerts?.map((alert) => <Banner key={alert} tone="warn" message={alert} />)}

      {/* A. My Action Items — actionable evaluations surfaced from props.evaluations. */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-slate-900">지금 처리해야 할 평가</h2>
            <p className="mt-1 text-xs text-slate-500">
              평가자/피평가자 관점에서 작성 또는 검토가 필요한 항목입니다.
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {actionItems.length}건
          </span>
        </div>
        {actionItems.length ? (
          <ul className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
            {actionItemPreview.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate text-sm font-semibold text-slate-900">
                      {item.targetName}
                    </span>
                    <span className="text-xs text-slate-400">·</span>
                    <span className="text-xs text-slate-500">{item.targetDepartment}</span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                      {item.stageLabel}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        item.status === 'REJECTED'
                          ? 'bg-rose-100 text-rose-700'
                          : item.status === 'IN_PROGRESS'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {item.statusLabel}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {item.isEvaluator ? '검토 필요' : '내 작성'}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => moveToEvaluation(item.id)}
                  className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                >
                  이동
                  <ChevronRight className="ml-1 h-3.5 w-3.5" />
                </button>
              </li>
            ))}
            {actionItems.length > actionItemPreview.length ? (
              <li className="bg-slate-50 px-3 py-2 text-center text-[11px] text-slate-500">
                외 {actionItems.length - actionItemPreview.length}건 — 아래 평가 목록에서 확인
              </li>
            ) : null}
          </ul>
        ) : (
          <div className="mt-3 rounded-xl border border-dashed border-emerald-200 bg-emerald-50/60 px-4 py-5 text-center">
            <div className="text-sm font-semibold text-emerald-800">✓ 모든 평가를 완료했습니다</div>
            <p className="mt-1 text-xs text-emerald-700">
              이번 주기 처리해야 할 평가가 없습니다.
            </p>
          </div>
        )}
      </section>

      {/* B. 처리 현황 요약 — compact 4-stat strip. 0건은 muted, 반려는 amber. */}
      <section aria-label="처리 현황 요약" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <SummaryStat
          label="작성/검토 필요 평가"
          value={`${actionRequiredCount}건`}
          help="지금 처리해야 하는 평가"
          emphasized={actionRequiredCount > 0}
        />
        <SummaryStat
          label="제출 완료 평가"
          value={`${submittedCount}건`}
          help="현재 주기 기준 제출 완료"
          emphasized={submittedCount > 0}
        />
        <SummaryStat
          label="반려 평가"
          value={`${rejectedCount}건`}
          help="보완이 필요한 평가"
          emphasized={rejectedCount > 0}
          variant={rejectedCount > 0 ? 'warning' : 'default'}
        />
        <SummaryStat
          label="다면 피드백 라운드"
          value={`${feedbackRoundCount}개`}
          help={props.summary?.evidenceFreshnessLabel ?? '근거 데이터 상태'}
          emphasized={feedbackRoundCount > 0}
        />
      </section>

      {/* C. 평가 품질 운영 요약 — admin only, collapsible. 경고성은 amber. */}
      {props.currentUser?.role === 'ROLE_ADMIN' && props.adminSummary ? (
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <button
            type="button"
            onClick={() => setAdminSummaryOpen((value) => !value)}
            aria-expanded={adminSummaryOpen}
            className="flex w-full items-center justify-between px-5 py-3 text-left"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                평가 품질 운영 요약
              </span>
              {adminQualityHasWarning ? (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                  확인 필요
                </span>
              ) : null}
            </div>
            <ChevronRight
              className={`h-4 w-4 text-slate-400 transition ${adminSummaryOpen ? 'rotate-90' : ''}`}
            />
          </button>
          {adminSummaryOpen ? (
            <div className="grid gap-3 border-t border-slate-100 px-5 py-4 sm:grid-cols-2 xl:grid-cols-6">
              <MetricCard
                label="가이드 열람 평가"
                value={`${props.adminSummary.guideViewedCount}건`}
                help="가이드를 열람한 평가 건수"
                compact
                variant={props.adminSummary.guideViewedCount === 0 ? 'muted' : 'default'}
              />
              <MetricCard
                label="가이드 확인 평가"
                value={`${props.adminSummary.guideConfirmedCount}건`}
                help="확인 완료 처리된 평가 건수"
                compact
                variant={props.adminSummary.guideConfirmedCount === 0 ? 'muted' : 'default'}
              />
              <MetricCard
                label="AI 보조 사용 평가"
                value={`${props.adminSummary.aiUsedCount}건`}
                help="AI 보조를 실행한 평가 건수"
                compact
                variant={props.adminSummary.aiUsedCount === 0 ? 'muted' : 'default'}
              />
              <MetricCard
                label="근거 부족 경고"
                value={`${props.adminSummary.insufficientEvidenceWarningCount}건`}
                help="근거 보강이 필요한 평가 건수"
                compact
                variant={props.adminSummary.insufficientEvidenceWarningCount > 0 ? 'warning' : 'muted'}
              />
              <MetricCard
                label="편향 주의 경고"
                value={`${props.adminSummary.biasWarningCount}건`}
                help="표현 점검이 필요한 평가 건수"
                compact
                variant={props.adminSummary.biasWarningCount > 0 ? 'warning' : 'muted'}
              />
              <MetricCard
                label="코칭 보완 경고"
                value={`${props.adminSummary.coachingGapCount}건`}
                help="다음 행동 제안이 약한 평가 건수"
                compact
                variant={props.adminSummary.coachingGapCount > 0 ? 'warning' : 'muted'}
              />
            </div>
          ) : null}
        </section>
      ) : null}

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
            <div className="grid gap-3 md:grid-cols-5">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="이름, 부서, 평가자로 검색"
                className="h-11 rounded-2xl border border-slate-200 px-4 text-sm text-slate-900 outline-none transition focus:border-blue-400"
              />
              <select
                value={scopeFilter}
                onChange={(event) => setScopeFilter(event.target.value as typeof scopeFilter)}
                className="h-11 rounded-2xl border border-slate-200 px-4 text-sm text-slate-900 outline-none transition focus:border-blue-400"
              >
                <option value="ALL">전체 범위</option>
                <option value="MY_SELF">내 자기평가</option>
                <option value="MY_REVIEWS">내 검토 건</option>
                <option value="PENDING_REVIEW">검토 대기</option>
              </select>
              <select
                value={stageFilter}
                onChange={(event) => setStageFilter(event.target.value as typeof stageFilter)}
                className="h-11 rounded-2xl border border-slate-200 px-4 text-sm text-slate-900 outline-none transition focus:border-blue-400"
              >
                <option value="ALL">전체 단계</option>
                {[...new Set((props.evaluations ?? []).map((evaluation) => evaluation.evalStage))].map((stage) => (
                  <option key={stage} value={stage}>
                    {(props.evaluations ?? []).find((evaluation) => evaluation.evalStage === stage)?.stageLabel ?? stage}
                  </option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
                className="h-11 rounded-2xl border border-slate-200 px-4 text-sm text-slate-900 outline-none transition focus:border-blue-400"
              >
                <option value="ALL">전체 상태</option>
                {[...new Set((props.evaluations ?? []).map((evaluation) => evaluation.status))].map((status) => (
                  <option key={status} value={status}>
                    {(props.evaluations ?? []).find((evaluation) => evaluation.status === status)?.statusLabel ?? status}
                  </option>
                ))}
              </select>
              <select
                value={departmentFilter}
                onChange={(event) => setDepartmentFilter(event.target.value)}
                className="h-11 rounded-2xl border border-slate-200 px-4 text-sm text-slate-900 outline-none transition focus:border-blue-400"
              >
                <option value="ALL">전체 부서</option>
                {departmentOptions
                  .filter((department) => department !== 'ALL')
                  .map((department) => (
                    <option key={department} value={department}>
                      {department}
                    </option>
                  ))}
              </select>
            </div>
            {filteredEvaluations.length ? (
              filteredEvaluations.map((evaluation) => (
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
                    <span>{evaluation.isEvaluator ? '검토 대기 또는 진행 중' : '내 평가 작성 건'}</span>
                    <span>{evaluation.updatedAt}</span>
                  </div>
                </button>
              ))
            ) : (
              <EmptyBlock message="조건에 맞는 평가가 없습니다." />
            )}
          </div>
        </section>

        <section className="space-y-6">
          {selected ? (
            <>
              <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-500">선택한 평가</p>
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

              <MidReviewReferencePanel
                kind="employee"
                targetId={selected.target.id}
                title="중간 점검 참고"
                helper="최근 중간 점검에서 정리한 목표 유효성, 기대 기준, 다음 액션을 평가 전에 참고합니다."
              />

              {canViewPolicyPreview2026 ? (
                <>
                  <PolicyReadiness2026Panel
                    readinessData={policyReadiness2026}
                    loading={policyReadiness2026Loading}
                    error={policyReadiness2026Error}
                    onLoad={loadPolicyReadiness2026}
                  />
                  <PolicyActivationReadiness2026Panel
                    activationData={policyActivationReadiness2026}
                    loading={policyActivationReadiness2026Loading}
                    error={policyActivationReadiness2026Error}
                    onLoad={loadPolicyActivationReadiness2026}
                  />
                  <PolicyMapping2026Panel
                    mappingData={policyMapping2026}
                    loading={policyMapping2026Loading}
                    saving={policyMapping2026Saving}
                    error={policyMapping2026Error}
                    notice={policyMapping2026Notice}
                    categoryDrafts={policyCategoryDrafts2026}
                    salesGroupDrafts={salesGroupDrafts2026}
                    thresholdDecisionDrafts={thresholdDecisionDrafts2026}
                    onLoad={loadPolicyMappingCandidates2026}
                    onSave={savePolicyMetadata2026}
                    onCategoryChange={(id, value) =>
                      setPolicyCategoryDrafts2026((current) => ({ ...current, [id]: value }))
                    }
                    onSalesGroupChange={(key, value) =>
                      setSalesGroupDrafts2026((current) => ({ ...current, [key]: value }))
                    }
                    onThresholdDecisionChange={(cycleId, value) =>
                      setThresholdDecisionDrafts2026((current) => ({ ...current, [cycleId]: value }))
                    }
                  />
                  <PolicyPreview2026Panel
                    previewData={policyPreview2026}
                    loading={policyPreview2026Loading}
                    error={policyPreview2026Error}
                    onLoad={loadPolicyPreview2026}
                  />
                </>
              ) : null}

              <div className="overflow-x-auto">
                <div className="inline-flex min-w-full gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
                  {visibleTabs.map((tab) => (
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
                  <Panel
                    title="승인 단계"
                    description="조직 체인과 수동 배정 설정을 반영한 실제 평가 단계를 순서대로 보여줍니다."
                  >
                    <div className="grid gap-3 xl:grid-cols-4">
                      {selected.stageChain.map((entry) => (
                        <div
                          key={`${entry.stage}-${entry.reviewOrder}`}
                          className={`rounded-2xl border p-4 ${
                            entry.isCurrent
                              ? 'border-blue-300 bg-blue-50'
                              : 'border-slate-200 bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                                {entry.stage === 'SELF' ? '본인 단계' : `${entry.reviewOrder}차 승인`}
                              </div>
                              <div className="mt-1 text-sm font-semibold text-slate-900">
                                {entry.stageLabel}
                              </div>
                            </div>
                            <Badge tone={entry.isCurrent ? 'success' : statusTone(entry.status ?? '')}>
                              {entry.isCurrent ? '현재 단계' : entry.statusLabel}
                            </Badge>
                          </div>
                          <div className="mt-3 space-y-2 text-sm text-slate-700">
                            <div className="font-semibold text-slate-900">{entry.evaluatorName}</div>
                            <div>{entry.evaluatorPosition}</div>
                            <div className="text-slate-500">{entry.evaluatorDepartment}</div>
                            <div className="text-xs text-slate-500">
                              {entry.submittedAt
                                ? `최근 제출 ${entry.submittedAt}`
                                : entry.updatedAt
                                  ? `최근 수정 ${entry.updatedAt}`
                                  : '아직 진행 전'}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Panel>

                  <Panel title="검토 포인트" description="평가 단계별로 먼저 봐야 할 핵심 포인트입니다.">
                    <div className="grid gap-3 md:grid-cols-3">
                      {selected.reviewGuidance.map((item) => (
                        <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                          {item}
                        </div>
                      ))}
                    </div>
                  </Panel>

                  {selected.previousStageEvaluation ? (
                    <Panel
                      title="이전 단계 평가 요약"
                      description="상위 검토 시에는 바로 이전 단계에서 제출된 의견과 점수를 함께 확인하세요."
                    >
                      <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
                        <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                              평가 단계
                            </div>
                            <div className="mt-1 text-sm font-semibold text-slate-900">
                              {selected.previousStageEvaluation.stageLabel}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                              작성자
                            </div>
                            <div className="mt-1 text-sm text-slate-700">
                              {selected.previousStageEvaluation.evaluatorName}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                              제출 시각
                            </div>
                            <div className="mt-1 text-sm text-slate-700">
                              {selected.previousStageEvaluation.submittedAt ?? selected.previousStageEvaluation.updatedAt}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                              저장 점수
                            </div>
                            <div className="mt-1 text-lg font-semibold text-slate-900">
                              {selected.previousStageEvaluation.totalScore?.toFixed(1) ?? '-'}
                            </div>
                          </div>
                        </div>
                        <div className="rounded-2xl border border-slate-200 p-4">
                          <div className="text-sm font-semibold text-slate-900">이전 단계 종합 의견</div>
                          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                            {selected.previousStageEvaluation.comment ?? '이전 단계 종합 의견이 아직 등록되지 않았습니다.'}
                          </p>
                          <div className="mt-4 grid gap-3 md:grid-cols-3">
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">강점 요약</div>
                              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                                {selected.previousStageEvaluation.strengthComment ?? '등록된 강점 요약이 없습니다.'}
                              </p>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">보완 포인트</div>
                              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                                {selected.previousStageEvaluation.improvementComment ?? '등록된 보완 포인트가 없습니다.'}
                              </p>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">다음 단계 가이드</div>
                              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                                {selected.previousStageEvaluation.nextStepGuidance ?? '등록된 다음 단계 가이드가 없습니다.'}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Panel>
                  ) : null}

                  <Panel title="단계별 의견 및 등급" description="종합 의견, 강점, 보완 포인트, 다음 단계 가이드를 함께 기록합니다.">
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
                    <div className="mt-4 grid gap-4 lg:grid-cols-3">
                      <label className="space-y-2">
                        <span className="text-sm font-semibold text-slate-700">강점 요약</span>
                        <textarea
                          value={draftStrengthComment}
                          onChange={(event) => setDraftStrengthComment(event.target.value)}
                          disabled={selected.permissions.readOnly}
                          className="min-h-28 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 disabled:bg-slate-100"
                          placeholder="이번 단계에서 확인한 강점과 핵심 성과를 정리하세요."
                        />
                      </label>
                      <label className="space-y-2">
                        <span className="text-sm font-semibold text-slate-700">보완 포인트</span>
                        <textarea
                          value={draftImprovementComment}
                          onChange={(event) => setDraftImprovementComment(event.target.value)}
                          disabled={selected.permissions.readOnly}
                          className="min-h-28 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 disabled:bg-slate-100"
                          placeholder="추가 확인이 필요한 점이나 보완 포인트를 정리하세요."
                        />
                      </label>
                      <label className="space-y-2">
                        <span className="text-sm font-semibold text-slate-700">다음 단계 가이드</span>
                        <textarea
                          value={draftNextStepGuidance}
                          onChange={(event) => setDraftNextStepGuidance(event.target.value)}
                          disabled={selected.permissions.readOnly}
                          className="min-h-28 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 disabled:bg-slate-100"
                          placeholder="다음 리뷰 단계나 코칭 대화에서 확인할 포인트를 남기세요."
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

              {activeTab === 'previous' ? (
                <Panel
                  title="이전 단계 의견"
                  description="완료된 이전 단계의 점수와 의견은 읽기 전용으로 유지되며, 상위 검토 단계에서 비교 기준으로 활용됩니다."
                >
                  <div className="space-y-4">
                    {selected.priorStageEvaluations.length ? (
                      selected.priorStageEvaluations.map((history) => (
                        <div key={history.id} className="rounded-2xl border border-slate-200 p-4">
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                              <div className="text-sm font-semibold text-slate-900">{history.stageLabel}</div>
                              <div className="mt-1 text-xs text-slate-500">
                                {history.evaluatorName} · {history.evaluatorPosition}
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Badge tone="neutral">
                                {history.submittedAt ?? history.updatedAt}
                              </Badge>
                              <Badge tone="success">
                                {history.totalScore?.toFixed(1) ?? '-'}
                              </Badge>
                            </div>
                          </div>
                          <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                            {history.comment ?? '등록된 종합 의견이 없습니다.'}
                          </p>
                          <div className="mt-4 grid gap-3 md:grid-cols-3">
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">강점 요약</div>
                              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                                {history.strengthComment ?? '등록된 강점 요약이 없습니다.'}
                              </p>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">보완 포인트</div>
                              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                                {history.improvementComment ?? '등록된 보완 포인트가 없습니다.'}
                              </p>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">다음 단계 가이드</div>
                              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                                {history.nextStepGuidance ?? '등록된 다음 단계 가이드가 없습니다.'}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <EmptyBlock message="현재 단계보다 앞선 완료 의견이 아직 없습니다." />
                    )}
                  </div>
                </Panel>
              ) : null}

              {activeTab === 'briefing' ? (
                <EvaluationPerformanceBriefingPanel
                  targetName={selected.target.name}
                  snapshot={briefing}
                  busy={briefingBusy}
                  canGenerate={selected.briefing?.canView ?? false}
                  onGenerate={() => void handleGenerateBriefing()}
                />
              ) : null}

              {activeTab === 'ai' ? (
                <div className="space-y-6">
                  <Panel title="근거 기반 AI 보조" description="AI는 초안 보조 도구이며, 최종 판단과 제출 책임은 평가자에게 있습니다.">
                    <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                      AI 보조는 최종 평가를 대체하지 않으며, 등록된 근거를 요약해 검토를 지원합니다. 근거 부족 경고와 편향 가능성 경고를 함께 확인해 주세요.
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

function formatPreviewScore2026(value: number | null | undefined) {
  return typeof value === 'number' ? value.toFixed(1) : '-'
}

function getAiRequirementStatusLabel2026(status: EvaluationPreviewResult2026['ai']['levelUpRequirementStatus']) {
  if (status === 'passed') return 'Pass'
  if (status === 'failed') return 'Fail'
  if (status === 'pending') return 'Pending'
  if (status === 'insufficient_data') return '증빙 부족'
  return '대상 아님'
}

function getPreviewIssueLabel2026(code: string) {
  const labels: Record<string, string> = {
    POLICY_CATEGORY_REQUIRED: '정책 카테고리 미분류',
    POLICY_CATEGORY_MANUAL_REVIEW_REQUIRED: '수동 검토 항목',
    MISSING_ORGANIZATION_SCORE: '조직성과 split 부족',
    MISSING_PERSONAL_SCORE: '개인성과 split 부족',
    GRADE_THRESHOLD_GROUP_REQUIRED: '등급 기준 그룹 부족',
    SALES_GROUP_REQUIRED: '영업/비영업 구분 부족',
    POLICY_CONFIRMATION_REQUIRED: '등급 threshold 정책 확인 필요',
    AMBIGUOUS_THRESHOLD_MATCH: '등급 threshold 정책 확인 필요',
    NO_RECOGNITION_ROUTE_PASSED: 'AI 증빙 부족',
    AI_TARGET_ROLE_REQUIRED: 'AI 대상 직책 정보 부족',
  }

  return labels[code] ?? code
}

function PolicyReadiness2026Panel(props: {
  readinessData: EvaluationPreviewReadiness2026ApiData | null
  loading: boolean
  error: string
  onLoad: () => void
}) {
  const readiness = props.readinessData
  const blockers = readiness?.activationBlockers ?? []
  const samples = readiness?.samples ?? []

  return (
    <Panel
      title="2026 평가 전환 준비 상태"
      description="공식 결과에는 반영되지 않습니다. HR/admin이 2026 정책 활성화 전에 보완할 메타데이터와 정책 확인 항목을 점검합니다."
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-1 rounded-2xl bg-indigo-50 p-2 text-indigo-600">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="neutral">Readiness only</Badge>
              <Badge tone={readiness && readiness.blockedCount === 0 ? 'success' : readiness ? 'warn' : 'neutral'}>
                {readiness
                  ? readiness.blockedCount === 0
                    ? '전환 준비 양호'
                    : `${readiness.blockedCount}건 검토 필요`
                  : '미확인'}
              </Badge>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              정책 카테고리, 영업/비영업 구분, 등급 기준 HR 확인, AI 증빙 부족 여부를 cycle 단위로 읽기 전용 집계합니다.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={props.onLoad}
          disabled={props.loading}
          className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
        >
          {props.loading ? '확인 중...' : readiness ? '다시 확인' : '준비 상태 확인'}
        </button>
      </div>

      {props.error ? <div className="mt-4"><Banner tone="error" message={props.error} /></div> : null}

      {readiness ? (
        <div className="mt-5 space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <MetricCard
              label="평가 확인"
              value={readiness.totalEvaluationsChecked.toLocaleString()}
              help="read-only scan"
              compact
            />
            <MetricCard
              label="산출 가능"
              value={readiness.canCalculateCount.toLocaleString()}
              help="preview 가능"
              compact
              variant={readiness.canCalculateCount > 0 ? 'default' : 'muted'}
            />
            <MetricCard
              label="정책 카테고리 미분류"
              value={(readiness.missingPolicyCategoryCount + readiness.manualReviewCount).toLocaleString()}
              help="UNKNOWN/manual-review 포함"
              compact
              variant={readiness.missingPolicyCategoryCount + readiness.manualReviewCount > 0 ? 'warning' : 'default'}
            />
            <MetricCard
              label="영업/비영업 구분 필요"
              value={readiness.missingSalesClassificationCount.toLocaleString()}
              help="자동 기본값 없음"
              compact
              variant={readiness.missingSalesClassificationCount > 0 ? 'warning' : 'default'}
            />
            <MetricCard
              label="등급 기준 HR 확인 필요"
              value={readiness.ambiguousThresholdCount.toLocaleString()}
              help="threshold ambiguity"
              compact
              variant={readiness.ambiguousThresholdCount > 0 ? 'warning' : 'default'}
            />
            <MetricCard
              label="AI 증빙 부족"
              value={readiness.aiInsufficientDataCount.toLocaleString()}
              help="점수와 별도"
              compact
              variant={readiness.aiInsufficientDataCount > 0 ? 'warning' : 'default'}
            />
          </div>

          {blockers.length ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-700" />
                <h4 className="text-sm font-semibold text-amber-900">Phase 1-G 전 확인할 항목</h4>
              </div>
              <ul className="mt-3 space-y-2">
                {blockers.map((blocker) => (
                  <li key={blocker} className="text-sm leading-6 text-amber-900">
                    {blocker}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              현재 확인 범위에서는 전환 차단 항목이 집계되지 않았습니다.
            </div>
          )}

          {samples.length ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h4 className="text-sm font-semibold text-slate-900">검토 샘플</h4>
                <span className="text-xs text-slate-400">최대 30건 중 상위 {samples.slice(0, 6).length}건 표시</span>
              </div>
              <ul className="mt-3 divide-y divide-slate-100">
                {samples.slice(0, 6).map((sample, index) => (
                  <li key={`${sample.evaluationId}-${sample.issueCode}-${sample.itemId ?? index}`} className="py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={sample.severity === 'error' ? 'warn' : 'neutral'}>{sample.issueLabel}</Badge>
                      <span className="text-sm font-semibold text-slate-900">{sample.targetName}</span>
                      <span className="text-xs text-slate-400">{sample.targetDepartment}</span>
                    </div>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      {sample.itemTitle ? `${sample.itemTitle} · ` : ''}{sample.message}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
          HR 관리자가 현재 평가 주기의 2026 정책 전환 준비 상태를 수동으로 확인할 수 있습니다.
        </div>
      )}
    </Panel>
  )
}

function PolicyActivationReadiness2026Panel(props: {
  activationData: EvaluationActivationReadiness2026ApiData | null
  loading: boolean
  error: string
  onLoad: () => void
}) {
  const activation = props.activationData
  const blockers = activation?.blockers ?? []
  const warnings = activation?.warnings ?? []

  return (
    <Panel
      title="2026 공식 전환 준비 상태"
      description="공식 점수에는 아직 반영되지 않습니다. 활성화하려면 migration, backfill, HR 확인, feature flag 승인이 필요합니다."
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-1 rounded-2xl bg-amber-50 p-2 text-amber-700">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="neutral">Status only</Badge>
              <Badge tone={activation?.canActivate ? 'success' : activation ? 'warn' : 'neutral'}>
                {activation?.canActivate ? '공식 전환 가능' : activation ? '공식 전환 불가' : '미확인'}
              </Badge>
              <Badge tone="neutral">활성화 버튼 없음</Badge>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              이 패널은 official scoring/grade/AI exclusion을 켜기 전 차단 조건만 읽기 전용으로 확인합니다.
              저장 점수, 저장 등급, 제출, 확정, 보정 흐름은 변경하지 않습니다.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={props.onLoad}
          disabled={props.loading}
          className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
        >
          {props.loading ? '확인 중...' : activation ? '공식 전환 상태 다시 확인' : '공식 전환 상태 확인'}
        </button>
      </div>

      {props.error ? <div className="mt-4"><Banner tone="error" message={props.error} /></div> : null}

      {activation ? (
        <div className="mt-5 space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <MetricCard
              label="남은 차단 항목"
              value={blockers.length.toLocaleString()}
              help="0이어야 전환 가능"
              compact
              variant={blockers.length > 0 ? 'warning' : 'default'}
            />
            <MetricCard
              label="Migration"
              value={activation.migration.migrationApplied ? '확인' : '미확인'}
              help={activation.migration.requiredSchemaPresent ? 'schema present' : 'schema missing'}
              compact
              variant={activation.migration.migrationApplied ? 'default' : 'warning'}
            />
            <MetricCard
              label="Backfill"
              value={
                activation.flags.backfillApplied
                  ? '적용'
                  : activation.flags.backfillExcluded
                    ? '제외 승인'
                    : '미확인'
              }
              help="명시 flag 필요"
              compact
              variant={activation.flags.backfillApplied || activation.flags.backfillExcluded ? 'default' : 'warning'}
            />
            <MetricCard
              label="Official flags"
              value={
                activation.flags.officialScoringEnabled &&
                activation.flags.officialGradeEnabled &&
                activation.flags.aiScoreExclusionEnabled
                  ? '승인'
                  : '대기'
              }
              help="scoring/grade/AI"
              compact
              variant={
                activation.flags.officialScoringEnabled &&
                activation.flags.officialGradeEnabled &&
                activation.flags.aiScoreExclusionEnabled
                  ? 'default'
                  : 'warning'
              }
            />
            <MetricCard
              label="HR 승인"
              value={activation.flags.hrApprovalConfirmed ? '확인' : '대기'}
              help="명시 승인 flag"
              compact
              variant={activation.flags.hrApprovalConfirmed ? 'default' : 'warning'}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-700" />
                <h4 className="text-sm font-semibold text-amber-900">남은 차단 항목</h4>
              </div>
              {blockers.length ? (
                <ul className="mt-3 space-y-2">
                  {blockers.slice(0, 8).map((blocker, index) => (
                    <li key={`${blocker.code}-${index}`} className="text-sm leading-6 text-amber-900">
                      <span className="font-semibold">{blocker.code}</span> · {blocker.message}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm leading-6 text-emerald-800">
                  현재 확인 범위에서는 공식 전환 차단 항목이 없습니다. 이 상태도 전환 실행이 아니라 사전 검증 결과입니다.
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-slate-600" />
                <h4 className="text-sm font-semibold text-slate-900">Feature flag 상태</h4>
              </div>
              <div className="mt-3 grid gap-2 text-sm text-slate-600">
                <div className="flex justify-between gap-3">
                  <span>Preview</span>
                  <span className="font-semibold text-slate-900">{activation.flags.previewEnabled ? 'enabled' : 'disabled'}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span>Official scoring</span>
                  <span className="font-semibold text-slate-900">
                    {activation.flags.officialScoringEnabled ? 'enabled' : 'disabled'}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span>Official grade</span>
                  <span className="font-semibold text-slate-900">
                    {activation.flags.officialGradeEnabled ? 'enabled' : 'disabled'}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span>AI score exclusion</span>
                  <span className="font-semibold text-slate-900">
                    {activation.flags.aiScoreExclusionEnabled ? 'enabled' : 'disabled'}
                  </span>
                </div>
              </div>
              {warnings.length ? (
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold text-slate-500">Warnings</p>
                  <ul className="mt-2 space-y-1">
                    {warnings.slice(0, 4).map((warning, index) => (
                      <li key={`${warning.code}-${index}`} className="text-xs leading-5 text-slate-600">
                        {warning.message}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
          HR 관리자가 공식 전환 전에 migration, backfill, HR 확인, feature flag 상태를 읽기 전용으로 점검할 수 있습니다.
        </div>
      )}
    </Panel>
  )
}

function getPolicyCategoryLabel2026(value: string | null | undefined) {
  const labels: Record<string, string> = {
    ORG_GOAL: '조직목표',
    PROJECT_T: '프로젝트 T',
    PROJECT_K: '프로젝트 K',
    DAILY_WORK: '일상업무',
    KEEP_UNCLASSIFIED: '제외/미분류 유지',
    UNKNOWN: 'UNKNOWN',
  }

  return value ? labels[value] ?? value : '미분류'
}

function getSalesGroupLabel2026(value: string | null | undefined) {
  if (value === 'SALES') return '영업'
  if (value === 'NON_SALES') return '비영업'
  if (value === 'UNRESOLVED') return '미해결'
  return '미지정'
}

function getThresholdDecisionLabel2026(value: string | null | undefined) {
  if (value === 'SUPER_PRIORITY') return '110점 이상 Super 우선'
  if (value === 'OUTSTANDING_PRIORITY') return '110점 이상 Outstanding 우선'
  if (value === 'UNRESOLVED') return 'HR 확인 필요 유지'
  return '미지정'
}

function PolicyMapping2026Panel(props: {
  mappingData: EvaluationPolicyMapping2026ApiData | null
  loading: boolean
  saving: boolean
  error: string
  notice: string
  categoryDrafts: Record<string, PolicyCategoryDraft2026>
  salesGroupDrafts: Record<string, SalesGroupDraft2026>
  thresholdDecisionDrafts: Record<string, ThresholdDecisionDraft2026>
  onLoad: () => void
  onSave: () => void
  onCategoryChange: (evaluationItemId: string, value: PolicyCategoryDraft2026) => void
  onSalesGroupChange: (key: string, value: SalesGroupDraft2026) => void
  onThresholdDecisionChange: (evalCycleId: string, value: ThresholdDecisionDraft2026) => void
}) {
  const data = props.mappingData
  const policyCandidates = data?.policyCategoryCandidates.slice(0, 6) ?? []
  const salesCandidates = data?.salesGroupCandidates.slice(0, 6) ?? []
  const thresholdCandidates = data?.thresholdDecisions.slice(0, 3) ?? []
  const hasChanges =
    Object.values(props.categoryDrafts).some(Boolean) ||
    Object.values(props.salesGroupDrafts).some(Boolean) ||
    Object.values(props.thresholdDecisionDrafts).some(Boolean)

  return (
    <Panel
      title="2026 정책 매핑 관리"
      description="수동 검토 항목의 정책 카테고리와 preview 전용 영업/비영업 구분을 저장합니다. 공식 평가 결과에는 반영되지 않습니다."
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-1 rounded-2xl bg-slate-100 p-2 text-slate-600">
            <ClipboardList className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="neutral">Metadata only</Badge>
              <Badge tone={data ? 'warn' : 'neutral'}>
                {data
                  ? `카테고리 ${data.policyCategoryCandidates.length}건 · 영업구분 ${data.salesGroupCandidates.length}건`
                  : '미확인'}
              </Badge>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              저장 대상은 2026 preview readiness metadata입니다. 저장 점수, 저장 등급, 확정/보정 흐름은 바뀌지 않습니다.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={props.onLoad}
            disabled={props.loading || props.saving}
            className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
          >
            {props.loading ? '불러오는 중...' : data ? '후보 다시 조회' : '매핑 후보 조회'}
          </button>
          <button
            type="button"
            onClick={props.onSave}
            disabled={!data || !hasChanges || props.loading || props.saving}
            className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {props.saving ? '저장 중...' : '선택 metadata 저장'}
          </button>
        </div>
      </div>

      {props.error ? <div className="mt-4"><Banner tone="error" message={props.error} /></div> : null}
      {props.notice ? <div className="mt-4"><Banner tone="success" message={props.notice} /></div> : null}

      {data ? (
        <div className="mt-5 space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-semibold text-slate-900">수동 검토 필요 항목</h4>
                <span className="text-xs text-slate-400">{data.policyCategoryCandidates.length}건</span>
              </div>
              <div className="mt-3 space-y-3">
                {policyCandidates.length ? policyCandidates.map((candidate) => (
                  <div key={candidate.evaluationItemId} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900">{candidate.title}</span>
                      <Badge tone="neutral">{candidate.employeeName}</Badge>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      현재 {getPolicyCategoryLabel2026(candidate.currentEffectiveCategory)} · 제안 {getPolicyCategoryLabel2026(candidate.suggestedCategory)} · {candidate.reason}
                    </p>
                    <select
                      value={props.categoryDrafts[candidate.evaluationItemId] ?? ''}
                      onChange={(event) =>
                        props.onCategoryChange(candidate.evaluationItemId, event.target.value as PolicyCategoryDraft2026)
                      }
                      className="mt-3 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-blue-400"
                    >
                      <option value="">선택 안 함</option>
                      <option value="ORG_GOAL">조직목표</option>
                      <option value="PROJECT_T">프로젝트 T</option>
                      <option value="PROJECT_K">프로젝트 K</option>
                      <option value="DAILY_WORK">일상업무</option>
                      <option value="KEEP_UNCLASSIFIED">제외/미분류 유지</option>
                    </select>
                  </div>
                )) : <EmptyBlock message="현재 조회 범위에서 정책 카테고리 수동 매핑 후보가 없습니다." />}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold text-slate-900">영업/비영업 구분</h4>
                  <span className="text-xs text-slate-400">{data.salesGroupCandidates.length}건</span>
                </div>
                <div className="mt-3 space-y-3">
                  {salesCandidates.length ? salesCandidates.map((candidate) => {
                    const key = `${candidate.evalCycleId}:${candidate.employeeId}`
                    return (
                      <div key={key} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-slate-900">{candidate.employeeName}</span>
                          <Badge tone="neutral">{candidate.departmentName}</Badge>
                        </div>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          현재 {getSalesGroupLabel2026(candidate.currentSalesGroup)} · {candidate.reason}
                        </p>
                        <select
                          value={props.salesGroupDrafts[key] ?? ''}
                          onChange={(event) => props.onSalesGroupChange(key, event.target.value as SalesGroupDraft2026)}
                          className="mt-3 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-blue-400"
                        >
                          <option value="">선택 안 함</option>
                          <option value="SALES">영업</option>
                          <option value="NON_SALES">비영업</option>
                          <option value="UNRESOLVED">미해결로 유지</option>
                        </select>
                      </div>
                    )
                  }) : <EmptyBlock message="현재 조회 범위에서 영업/비영업 수동 매핑 후보가 없습니다." />}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold text-slate-900">HR 확인 필요 기준</h4>
                  <span className="text-xs text-slate-400">TEAM_MEMBER_SALES</span>
                </div>
                <div className="mt-3 space-y-3">
                  {thresholdCandidates.length ? thresholdCandidates.map((candidate) => (
                    <div key={candidate.evalCycleId} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900">{candidate.evalYear} 평가 주기</span>
                        <Badge tone={candidate.requiresDecision ? 'warn' : 'success'}>
                          {candidate.requiresDecision ? 'HR 확인 필요' : '결정 기록됨'}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        현재 {getThresholdDecisionLabel2026(candidate.currentDecision)} · 영업 팀원 {candidate.affectedSalesMemberCount}명
                      </p>
                      <select
                        value={props.thresholdDecisionDrafts[candidate.evalCycleId] ?? ''}
                        onChange={(event) =>
                          props.onThresholdDecisionChange(candidate.evalCycleId, event.target.value as ThresholdDecisionDraft2026)
                        }
                        className="mt-3 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-blue-400"
                      >
                        <option value="">선택 안 함</option>
                        <option value="UNRESOLVED">HR 확인 필요 유지</option>
                        <option value="SUPER_PRIORITY">110점 이상 Super 우선</option>
                        <option value="OUTSTANDING_PRIORITY">110점 이상 Outstanding 우선</option>
                      </select>
                    </div>
                  )) : <EmptyBlock message="현재 조회 범위에서 영업 팀원 Super/Outstanding 기준 후보가 없습니다." />}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
          HR 관리자가 preview blocker를 풀기 위한 정책 매핑 후보를 조회하고, 명시적으로 선택한 metadata만 저장할 수 있습니다.
        </div>
      )}
    </Panel>
  )
}

function PolicyPreview2026Panel(props: {
  previewData: EvaluationPreview2026ApiData | null
  loading: boolean
  error: string
  onLoad: () => void
}) {
  const preview = props.previewData?.preview ?? null
  const issues = preview?.issues ?? []
  const blockingIssues = issues.filter((issue) => issue.severity === 'error')

  return (
    <Panel
      title="2026 평가 미리보기"
      description="공식 평가 결과가 아닙니다. 정책 카테고리, 조직성과/개인성과 데이터가 부족하면 산출되지 않을 수 있습니다."
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-1 rounded-2xl bg-blue-50 p-2 text-blue-600">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="neutral">Preview only</Badge>
              <Badge tone={preview?.canCalculate ? 'success' : preview ? 'warn' : 'neutral'}>
                {preview?.canCalculate ? '산출 가능' : preview ? '검토 필요' : '미생성'}
              </Badge>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              이 값은 2026 정책 적용 전 HR 검토용 미리보기이며, 저장 점수/등급/제출/확정에는 반영되지 않습니다.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={props.onLoad}
          disabled={props.loading}
          className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {props.loading ? '계산 중...' : preview ? '다시 계산' : '2026 미리보기 계산'}
        </button>
      </div>

      {props.error ? <div className="mt-4"><Banner tone="error" message={props.error} /></div> : null}

      {preview ? (
        <div className="mt-5 space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <MetricCard
              label="최종 점수"
              value={formatPreviewScore2026(preview.score.finalScore)}
              help="조직 30% + 개인 70%"
              compact
              emphasized
            />
            <MetricCard
              label="조직성과"
              value={formatPreviewScore2026(preview.score.organizationScore)}
              help="30% 반영 preview"
              compact
            />
            <MetricCard
              label="개인성과"
              value={formatPreviewScore2026(preview.score.personalScore)}
              help="70% 반영 preview"
              compact
            />
            <MetricCard
              label="등급"
              value={preview.grade.calculatedGrade ?? '-'}
              help={preview.grade.requiresPolicyConfirmation ? '정책 확인 필요' : '절대등급 preview'}
              compact
              variant={preview.grade.requiresPolicyConfirmation ? 'warning' : 'default'}
            />
            <MetricCard
              label="AI"
              value={getAiRequirementStatusLabel2026(preview.ai.levelUpRequirementStatus)}
              help="연간 점수 제외"
              compact
            />
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">AI 점수 반영</div>
              <p className="mt-2 text-sm font-semibold text-slate-900">제외</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">AI 활용 평가는 annual performance score에서 분리됩니다.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Threshold group</div>
              <p className="mt-2 text-sm font-semibold text-slate-900">
                {preview.grade.thresholdGroupLabel ?? preview.grade.thresholdGroup ?? '-'}
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500">영업/비영업 및 직책 기준이 없으면 계산이 제한됩니다.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">AI 인정 경로</div>
              <p className="mt-2 text-sm font-semibold text-slate-900">{preview.ai.recognitionRoute ?? '-'}</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">Pass/Fail 요건은 점수와 별도로 표시됩니다.</p>
            </div>
          </div>

          {issues.length ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-700" />
                <h4 className="text-sm font-semibold text-amber-900">
                  {blockingIssues.length ? '산출 전 확인할 항목' : '미리보기 참고 경고'}
                </h4>
              </div>
              <ul className="mt-3 space-y-2">
                {issues.slice(0, 8).map((issue, index) => (
                  <li
                    key={`${issue.source}-${issue.code}-${issue.itemId ?? index}`}
                    className="rounded-2xl border border-amber-200 bg-white px-4 py-3 text-sm text-slate-700"
                  >
                    <span className="font-semibold text-amber-900">{getPreviewIssueLabel2026(issue.code)}</span>
                    <span className="ml-2 text-slate-500">{issue.itemTitle ? `${issue.itemTitle} · ` : ''}{issue.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              현재 preview 계산에 필요한 필수 데이터가 확인되었습니다.
            </div>
          )}
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
          HR 관리자가 선택한 평가에 대해 2026 정책 기준 preview를 수동으로 계산할 수 있습니다.
        </div>
      )}
    </Panel>
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

function MetricCard(props: {
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

function SummaryStat(props: {
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
                  <div key={link.id} className="inline-flex flex-col rounded-2xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700">
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="font-semibold transition hover:text-slate-900"
                    >
                      {link.label}
                      {link.uploadedBy ? <span className="ml-1 text-slate-400">· {link.uploadedBy}</span> : null}
                    </a>
                    {link.comment ? <span className="mt-1 text-[11px] text-slate-500">{link.comment}</span> : null}
                  </div>
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
