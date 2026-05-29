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
import { getResultWritingScheduleGuidance } from '@/lib/evaluation-2026-schedule-readiness'
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
import type {
  Evaluation2026GradePolicyMetadataSaveResult,
  Evaluation2026GradePolicyReadinessResult,
} from '@/server/evaluation-2026-grade-policy-readiness'
import type { Evaluation2026ReadinessPopulationDryRun } from '@/server/evaluation-2026-readiness-population'
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
type EvaluationGradePolicyReadiness2026ApiData = Evaluation2026GradePolicyReadinessResult
type EvaluationGradePolicySave2026ApiData = Evaluation2026GradePolicyMetadataSaveResult
type EvaluationReadinessPopulation2026ApiData = Evaluation2026ReadinessPopulationDryRun
type ReadinessScenarioSimulator2026 = NonNullable<EvaluationActivationReadiness2026ApiData['readinessScenarioSimulator']>
type ReadinessScenarioInput2026 = ReadinessScenarioSimulator2026['scenarioInputModel']
type ReadinessScenarioProjectedCounts2026 = ReadinessScenarioSimulator2026['baselineCounts']
type ReadinessScenarioPreview2026 = {
  scenarioName: string
  projectedCounts: ReadinessScenarioProjectedCounts2026
  deltaRows: Array<{
    key: string
    label: string
    baseline: number | null
    projected: number | null
    delta: number | null
    note: string
  }>
  remainingBlockers: Array<{
    label: string
    count: number
    nextAction: string
  }>
  projectedStage: EvaluationActivationReadiness2026ApiData['integratedReadinessSnapshot']['currentStage']
  projectedStatus: EvaluationActivationReadiness2026ApiData['integratedReadinessSnapshot']['overallStatus']
  nextHrAction: string
  reportText: string
  markdown: string
  tsv: string
}
type DryRunOutputPasteReview2026 = {
  ok: boolean
  message: string
  classification?: string
  redFlags?: string[]
  nextActions?: string[]
  fields: Array<{
    field: string
    value: string
  }>
}
type GradePolicyTeamMemberSalesResolutionPayload2026 =
  | {
      decision: 'APPLY_PPT_BASELINE'
      note?: string
    }
  | {
      decision: 'CUSTOM_THRESHOLDS'
      superMinScore?: number | null
      superMaxScore?: number | null
      outstandingMinScore?: number | null
      outstandingMaxScore?: number | null
      note?: string
    }
  | {
      decision: 'DEFER'
      note?: string
    }
type MboSetupMonitoringStatus2026 =
  EvaluationReadinessPopulation2026ApiData['mboSetupCoverage']['monitoring']['employeeRows'][number]['status']
type TeamKpiHrReviewStatus2026 =
  EvaluationReadinessPopulation2026ApiData['teamKpiHrReviewCoverage']['candidates'][number]['reviewStatus']
type TeamKpiHrReviewReason2026 =
  NonNullable<EvaluationReadinessPopulation2026ApiData['teamKpiHrReviewCoverage']['candidates'][number]['reason']>
type TeamKpiHrReviewRow2026 =
  EvaluationReadinessPopulation2026ApiData['teamKpiHrReviewCoverage']['candidates'][number]
type ScorePolicyCategory2026 =
  EvaluationReadinessPopulation2026ApiData['scorePolicyReadiness']['categoryRules'][number]['category']
type TeamKpiHrReviewDecision2026 = Exclude<TeamKpiHrReviewStatus2026, 'PENDING_REVIEW'>
type TeamKpiHrReviewDecisionDraft2026 = {
  decision: TeamKpiHrReviewDecision2026 | ''
  reason: TeamKpiHrReviewReason2026 | ''
  note: string
}
type MboFollowUpType2026 =
  | 'MISSING_MBO'
  | 'DRAFT_MBO'
  | 'LEADER_REVIEW'
  | 'POLICY_CATEGORY'
  | 'TEAM_KPI_REVIEW'
type MboFollowUpStatusFilter2026 =
  | MboSetupMonitoringStatus2026
  | 'POLICY_CATEGORY'
  | 'TEAM_KPI_REVIEW'
type MboFollowUpRecipientRow2026 = {
  id: string
  type: MboFollowUpType2026
  typeLabel: string
  status: MboFollowUpStatusFilter2026
  employeeNo: string | null
  name: string
  email: string | null
  divisionId: string | null
  divisionName: string
  departmentId: string | null
  departmentPath: string
  leaderId: string | null
  leaderName: string
  actionLabel: string
  detail: string
}
type MboFollowUpGroup2026 = {
  type: MboFollowUpType2026
  label: string
  actionLabel: string
  description: string
  template: string
  href: string
  rows: MboFollowUpRecipientRow2026[]
}
type ResultWritingReadiness2026 = EvaluationReadinessPopulation2026ApiData['resultWritingReadiness']
type ResultWritingReadinessRow2026 = ResultWritingReadiness2026['rows'][number]
type ResultWritingWarningCode2026 = ResultWritingReadinessRow2026['warnings'][number]['code']
type ResultWritingStatus2026 = ResultWritingReadinessRow2026['resultWritingStatus']
type LeaderEvaluationReadiness2026 = EvaluationReadinessPopulation2026ApiData['leaderEvaluationReadiness']
type LeaderEvaluationReadinessRow2026 = LeaderEvaluationReadiness2026['rows'][number]
type LeaderEvaluationReadinessStatus2026 = LeaderEvaluationReadinessRow2026['readinessStatus']
type LeaderEvaluationMissingPrerequisite2026 = LeaderEvaluationReadinessRow2026['missingPrerequisites'][number]
type FinalizationCeoReadiness2026 = EvaluationReadinessPopulation2026ApiData['finalizationCeoReadiness']
type FinalizationCeoReadinessRow2026 = FinalizationCeoReadiness2026['rows'][number]
type FinalizationCeoReadinessStatus2026 = FinalizationCeoReadinessRow2026['finalizationReadinessStatus']
type FinalizationCeoBlockerType2026 = FinalizationCeoReadinessRow2026['blockerTypes'][number]
type ResultWritingCategoryFilter2026 = NonNullable<ResultWritingReadinessRow2026['category']> | 'UNMAPPED'
type EvaluationPolicyMapping2026ApiData = EvaluationPolicy2026MappingCandidates
type EvaluationPolicyMetadataPatch2026ApiData = EvaluationPolicy2026MetadataPatchResult
type EvaluationPolicyOfficialReadinessCycle2026ApiData = {
  policyVersion: string
  evalCycleId: string
  evalYear: number
  cycleName: string
  enabled: boolean
  disabledOtherCycleIds: string[]
  officialScoresChanged: false
  officialGradesChanged: false
  aiScoreExclusionChanged: false
  backfillApplied: false
  notes: string[]
}
type PolicyCategoryDraft2026 = 'ORG_GOAL' | 'PROJECT_T' | 'PROJECT_K' | 'DAILY_WORK' | 'KEEP_UNCLASSIFIED' | ''
type PolicyCategoryConfidenceFilter2026 = 'HIGH' | 'MEDIUM' | 'LOW' | 'MANUAL_REVIEW' | 'ALL'
type ScoreContributionDraft2026 = 'ORGANIZATION' | 'PERSONAL' | ''
type PolicyCategoryWorkbenchDraft2026 = {
  category: PolicyCategoryDraft2026
  scoreContributionType: ScoreContributionDraft2026
  note: string
}
type PolicyMappingTab2026 = 'CATEGORY' | 'DIVISION' | 'DEPARTMENT' | 'EMPLOYEE' | 'HR_CONFIRM'
type DepartmentOverrideFilter2026 = 'IMPORTANT' | 'MAPPED' | 'DRAFT_CHANGED' | 'SALES_DIVISION' | 'ALL'
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
  const [policyGradeReadiness2026, setPolicyGradeReadiness2026] =
    useState<EvaluationGradePolicyReadiness2026ApiData | null>(null)
  const [policyGradeReadiness2026Loading, setPolicyGradeReadiness2026Loading] = useState(false)
  const [policyGradeReadiness2026Saving, setPolicyGradeReadiness2026Saving] = useState(false)
  const [policyGradeReadiness2026Error, setPolicyGradeReadiness2026Error] = useState('')
  const [policyGradeReadiness2026Notice, setPolicyGradeReadiness2026Notice] = useState('')
  const [policyPopulationDryRun2026, setPolicyPopulationDryRun2026] =
    useState<EvaluationReadinessPopulation2026ApiData | null>(null)
  const [policyPopulationDryRun2026Loading, setPolicyPopulationDryRun2026Loading] = useState(false)
  const [policyPopulationDryRun2026Error, setPolicyPopulationDryRun2026Error] = useState('')
  const [policyMapping2026, setPolicyMapping2026] = useState<EvaluationPolicyMapping2026ApiData | null>(null)
  const [policyMapping2026Loading, setPolicyMapping2026Loading] = useState(false)
  const [policyMapping2026Saving, setPolicyMapping2026Saving] = useState(false)
  const [policyMapping2026Error, setPolicyMapping2026Error] = useState('')
  const [policyMapping2026Notice, setPolicyMapping2026Notice] = useState('')
  const [policyOfficialCycle2026Saving, setPolicyOfficialCycle2026Saving] = useState(false)
  const [policyOfficialCycle2026Error, setPolicyOfficialCycle2026Error] = useState('')
  const [policyOfficialCycle2026Notice, setPolicyOfficialCycle2026Notice] = useState('')
  const [policyCategoryWorkbenchDrafts2026, setPolicyCategoryWorkbenchDrafts2026] =
    useState<Record<string, PolicyCategoryWorkbenchDraft2026>>({})
  const [divisionSalesGroupDrafts2026, setDivisionSalesGroupDrafts2026] = useState<Record<string, SalesGroupDraft2026>>({})
  const [departmentSalesGroupDrafts2026, setDepartmentSalesGroupDrafts2026] = useState<Record<string, SalesGroupDraft2026>>({})
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
    setPolicyGradeReadiness2026(null)
    setPolicyGradeReadiness2026Error('')
    setPolicyGradeReadiness2026Notice('')
    setPolicyGradeReadiness2026Loading(false)
    setPolicyGradeReadiness2026Saving(false)
    setPolicyPopulationDryRun2026(null)
    setPolicyPopulationDryRun2026Error('')
    setPolicyPopulationDryRun2026Loading(false)
    setPolicyMapping2026(null)
    setPolicyMapping2026Error('')
    setPolicyMapping2026Notice('')
    setPolicyMapping2026Loading(false)
    setPolicyMapping2026Saving(false)
    setPolicyOfficialCycle2026Error('')
    setPolicyOfficialCycle2026Notice('')
    setPolicyOfficialCycle2026Saving(false)
    setPolicyCategoryWorkbenchDrafts2026({})
    setDivisionSalesGroupDrafts2026({})
    setDepartmentSalesGroupDrafts2026({})
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
      setPolicyGradeReadiness2026(null)
      setPolicyGradeReadiness2026Error('')
      setPolicyGradeReadiness2026Notice('')
      setPolicyGradeReadiness2026Loading(false)
      setPolicyGradeReadiness2026Saving(false)
      setPolicyPopulationDryRun2026(null)
      setPolicyPopulationDryRun2026Error('')
      setPolicyPopulationDryRun2026Loading(false)
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

  async function loadPolicyGradeReadiness2026() {
    if (!canViewPolicyPreview2026) return
    setPolicyGradeReadiness2026Loading(true)
    setPolicyGradeReadiness2026Error('')

    try {
      const params = new URLSearchParams()
      if (props.selectedCycleId) {
        params.set('evalCycleId', props.selectedCycleId)
      } else {
        params.set('year', '2026')
      }
      const query = params.toString()
      const response = await fetch(`/api/evaluation/preview-2026/grade-policy${query ? `?${query}` : ''}`, {
        method: 'GET',
      })
      const json = await response.json().catch(() => null)
      if (!response.ok || !json?.success) {
        throw new Error(json?.error?.message ?? '2026 등급 기준 readiness를 불러오지 못했습니다.')
      }

      setPolicyGradeReadiness2026(json.data as EvaluationGradePolicyReadiness2026ApiData)
    } catch (error) {
      setPolicyGradeReadiness2026(null)
      setPolicyGradeReadiness2026Error(
        error instanceof Error ? error.message : '2026 등급 기준 readiness를 불러오지 못했습니다.'
      )
    } finally {
      setPolicyGradeReadiness2026Loading(false)
    }
  }

  async function savePolicyGradeReadiness2026() {
    if (!canViewPolicyPreview2026 || !props.selectedCycleId) return
    setPolicyGradeReadiness2026Saving(true)
    setPolicyGradeReadiness2026Error('')
    setPolicyGradeReadiness2026Notice('')

    try {
      const response = await fetch('/api/evaluation/preview-2026/grade-policy', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          evalCycleId: props.selectedCycleId,
          source: 'PPT_BASELINE',
        }),
      })
      const json = await response.json().catch(() => null)
      if (!response.ok || !json?.success) {
        throw new Error(json?.error?.message ?? '2026 등급 기준 metadata를 저장하지 못했습니다.')
      }

      const result = json.data as EvaluationGradePolicySave2026ApiData
      setPolicyGradeReadiness2026Notice(
        `PPT 기준 등급 metadata ${result.upsertedRows}건을 저장했습니다. 공식 점수/등급은 변경되지 않았습니다.`
      )
      await loadPolicyGradeReadiness2026()
      if (policyActivationReadiness2026) {
        await loadPolicyActivationReadiness2026()
      }
      if (policyPopulationDryRun2026) {
        await loadPolicyPopulationDryRun2026()
      }
    } catch (error) {
      setPolicyGradeReadiness2026Error(
        error instanceof Error ? error.message : '2026 등급 기준 metadata를 저장하지 못했습니다.'
      )
    } finally {
      setPolicyGradeReadiness2026Saving(false)
    }
  }

  async function savePolicyGradeTeamMemberSalesResolution2026(
    ambiguityResolution: GradePolicyTeamMemberSalesResolutionPayload2026
  ) {
    if (!canViewPolicyPreview2026 || !props.selectedCycleId) return
    setPolicyGradeReadiness2026Saving(true)
    setPolicyGradeReadiness2026Error('')
    setPolicyGradeReadiness2026Notice('')

    try {
      const response = await fetch('/api/evaluation/preview-2026/grade-policy', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          evalCycleId: props.selectedCycleId,
          source: 'PPT_BASELINE',
          ambiguityResolution,
        }),
      })
      const json = await response.json().catch(() => null)
      if (!response.ok || !json?.success) {
        throw new Error(json?.error?.message ?? 'TEAM_MEMBER_SALES 기준 확인 metadata를 저장하지 못했습니다.')
      }

      const result = json.data as EvaluationGradePolicySave2026ApiData
      const savedMessage =
        ambiguityResolution.decision === 'APPLY_PPT_BASELINE'
          ? 'TEAM_MEMBER_SALES 기준을 PPT 해석으로 저장했습니다. Super는 미운영, Outstanding은 110점 이상입니다.'
          : ambiguityResolution.decision === 'CUSTOM_THRESHOLDS'
            ? 'TEAM_MEMBER_SALES HR 별도 기준을 저장했습니다.'
            : 'TEAM_MEMBER_SALES 기준 확인을 보류했습니다. blocker는 유지됩니다.'
      setPolicyGradeReadiness2026Notice(
        `${savedMessage} 저장 ${result.upsertedRows}건. 공식 점수/등급은 변경되지 않았습니다.`
      )
      await loadPolicyGradeReadiness2026()
      if (policyActivationReadiness2026) {
        await loadPolicyActivationReadiness2026()
      }
      if (policyPopulationDryRun2026) {
        await loadPolicyPopulationDryRun2026()
      }
    } catch (error) {
      setPolicyGradeReadiness2026Error(
        error instanceof Error ? error.message : 'TEAM_MEMBER_SALES 기준 확인 metadata를 저장하지 못했습니다.'
      )
    } finally {
      setPolicyGradeReadiness2026Saving(false)
    }
  }

  async function loadPolicyPopulationDryRun2026() {
    if (!canViewPolicyPreview2026) return
    if (!props.selectedCycleId) {
      setPolicyPopulationDryRun2026Error('먼저 평가 주기를 선택해 주세요.')
      return
    }

    setPolicyPopulationDryRun2026Loading(true)
    setPolicyPopulationDryRun2026Error('')

    try {
      const params = new URLSearchParams({
        evalCycleId: props.selectedCycleId,
        limit: '300',
      })
      const response = await fetch(`/api/evaluation/preview-2026/readiness-population?${params.toString()}`, {
        method: 'GET',
      })
      const json = await response.json().catch(() => null)
      if (!response.ok || !json?.success) {
        throw new Error(json?.error?.message ?? '2026 readiness population dry-run을 불러오지 못했습니다.')
      }

      setPolicyPopulationDryRun2026(json.data as EvaluationReadinessPopulation2026ApiData)
    } catch (error) {
      setPolicyPopulationDryRun2026(null)
      setPolicyPopulationDryRun2026Error(
        error instanceof Error ? error.message : '2026 readiness population dry-run을 불러오지 못했습니다.'
      )
    } finally {
      setPolicyPopulationDryRun2026Loading(false)
    }
  }

  async function setPolicyOfficialReadinessCycle2026(enabled: boolean) {
    if (!canViewPolicyPreview2026) return
    if (!props.selectedCycleId) {
      setPolicyOfficialCycle2026Error('먼저 평가 주기를 선택해 주세요.')
      return
    }

    setPolicyOfficialCycle2026Saving(true)
    setPolicyOfficialCycle2026Error('')
    setPolicyOfficialCycle2026Notice('')

    try {
      const response = await fetch('/api/evaluation/preview-2026/official-readiness-cycle', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          evalCycleId: props.selectedCycleId,
          enabled,
        }),
      })
      const json = await response.json().catch(() => null)
      if (!response.ok || !json?.success) {
        throw new Error(json?.error?.message ?? '2026 readiness 대상 주기를 저장하지 못했습니다.')
      }

      const result = json.data as EvaluationPolicyOfficialReadinessCycle2026ApiData
      setPolicyOfficialCycle2026Notice(
        result.enabled
          ? `${result.cycleName}을(를) 공식 readiness 대상 주기로 지정했습니다. 공식 점수 전환은 활성화되지 않았습니다.`
          : `${result.cycleName}의 공식 readiness 대상 지정을 해제했습니다.`
      )
      await loadPolicyReadiness2026()
      if (policyActivationReadiness2026) {
        await loadPolicyActivationReadiness2026()
      }
      if (policyMapping2026) {
        await loadPolicyMappingCandidates2026()
      }
    } catch (error) {
      setPolicyOfficialCycle2026Error(
        error instanceof Error ? error.message : '2026 readiness 대상 주기를 저장하지 못했습니다.'
      )
    } finally {
      setPolicyOfficialCycle2026Saving(false)
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
      setPolicyCategoryWorkbenchDrafts2026({})
      setDivisionSalesGroupDrafts2026({})
      setDepartmentSalesGroupDrafts2026({})
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
    const itemMappings: Array<never> = []
    const policyCategoryMappings = policyMapping2026.policyCategoryWorkbenchItems.flatMap((candidate) => {
      const draft = policyCategoryWorkbenchDrafts2026[candidate.mappingId]
      const category = draft?.category
      if (!category) return []
      return [{
        personalKpiId: candidate.personalKpiId,
        ...(candidate.evaluationItemId ? { evaluationItemId: candidate.evaluationItemId } : {}),
        category,
        ...(draft.scoreContributionType ? { scoreContributionType: draft.scoreContributionType } : {}),
        note: draft.note || 'HR manual policyCategory mapping from 2026 policyCategory workbench',
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
    const divisionSalesGroupMappings = policyMapping2026.divisionSalesGroupCandidates.flatMap((candidate) => {
      const salesGroup = divisionSalesGroupDrafts2026[`${candidate.evalCycleId}:${candidate.divisionId}`]
      if (!salesGroup) return []
      return [{
        evalCycleId: candidate.evalCycleId,
        divisionId: candidate.divisionId,
        salesGroup,
        note: 'HR division-level sales/non-sales mapping from 2026 preview readiness panel',
      }]
    })
    const departmentSalesGroupMappings = policyMapping2026.departmentSalesGroupCandidates.flatMap((candidate) => {
      const salesGroup = departmentSalesGroupDrafts2026[`${candidate.evalCycleId}:${candidate.departmentId}`]
      if (!salesGroup) return []
      return [{
        evalCycleId: candidate.evalCycleId,
        departmentId: candidate.departmentId,
        salesGroup,
        note: 'HR department/team-level sales/non-sales override from 2026 preview readiness panel',
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

    if (
      !itemMappings.length &&
      !policyCategoryMappings.length &&
      !divisionSalesGroupMappings.length &&
      !departmentSalesGroupMappings.length &&
      !salesGroupMappings.length &&
      !thresholdDecisions.length
    ) {
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
          policyCategoryMappings,
          divisionSalesGroupMappings,
          departmentSalesGroupMappings,
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
        `저장 완료: policyCategory ${result.updatedPolicyCategoryMappings ?? result.updatedItemMappings}건, division 영업/비영업 ${result.updatedDivisionSalesGroupMappings}건, 부서/팀 override ${result.updatedDepartmentSalesGroupMappings}건, 직원 override ${result.updatedSalesGroupMappings}건, 기준 결정 ${result.updatedThresholdDecisions}건`
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
  const resultWritingScheduleGuidance2026 = getResultWritingScheduleGuidance()

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
      {resultWritingScheduleGuidance2026.isActive ? (
        <Banner tone="warn" message={`${resultWritingScheduleGuidance2026.message} 이 안내는 preview guidance이며 Evaluation/EvaluationItem을 생성하지 않습니다.`} />
      ) : null}

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
                    selectedCycleId={props.selectedCycleId ?? null}
                    readinessData={policyReadiness2026}
                    loading={policyReadiness2026Loading}
                    error={policyReadiness2026Error}
                    officialCycleSaving={policyOfficialCycle2026Saving}
                    officialCycleError={policyOfficialCycle2026Error}
                    officialCycleNotice={policyOfficialCycle2026Notice}
                    onLoad={loadPolicyReadiness2026}
                    onSetOfficialCycle={setPolicyOfficialReadinessCycle2026}
                  />
                  <PolicyActivationReadiness2026Panel
                    activationData={policyActivationReadiness2026}
                    loading={policyActivationReadiness2026Loading}
                    error={policyActivationReadiness2026Error}
                    autoLoadKey={`${props.selectedCycleId ?? '2026'}:${props.selectedEvaluationId ?? 'none'}`}
                    onLoad={loadPolicyActivationReadiness2026}
                  />
                  <PolicyGradeReadiness2026Panel
                    gradePolicyData={policyGradeReadiness2026}
                    loading={policyGradeReadiness2026Loading}
                    saving={policyGradeReadiness2026Saving}
                    error={policyGradeReadiness2026Error}
                    notice={policyGradeReadiness2026Notice}
                    selectedCycleId={props.selectedCycleId ?? null}
                    canSave={props.currentUser?.role === 'ROLE_ADMIN'}
                    onLoad={loadPolicyGradeReadiness2026}
                    onSave={savePolicyGradeReadiness2026}
                    onResolveTeamMemberSalesAmbiguity={savePolicyGradeTeamMemberSalesResolution2026}
                  />
                  <PolicyReadinessPopulation2026Panel
                    dryRunData={policyPopulationDryRun2026}
                    loading={policyPopulationDryRun2026Loading}
                    error={policyPopulationDryRun2026Error}
                    selectedCycleId={props.selectedCycleId ?? null}
                    canManageTeamKpiReview={props.currentUser?.role === 'ROLE_ADMIN'}
                    onLoad={loadPolicyPopulationDryRun2026}
                  />
                  <PolicyMapping2026Panel
                    mappingData={policyMapping2026}
                    loading={policyMapping2026Loading}
                    saving={policyMapping2026Saving}
                    error={policyMapping2026Error}
                    notice={policyMapping2026Notice}
                    categoryDrafts={policyCategoryWorkbenchDrafts2026}
                    divisionSalesGroupDrafts={divisionSalesGroupDrafts2026}
                    departmentSalesGroupDrafts={departmentSalesGroupDrafts2026}
                    salesGroupDrafts={salesGroupDrafts2026}
                    thresholdDecisionDrafts={thresholdDecisionDrafts2026}
                    onLoad={loadPolicyMappingCandidates2026}
                    onSave={savePolicyMetadata2026}
                    onCategoryDraftChange={(id, patch) =>
                      setPolicyCategoryWorkbenchDrafts2026((current) => ({
                        ...current,
                        [id]: {
                          category: current[id]?.category ?? '',
                          scoreContributionType: current[id]?.scoreContributionType ?? '',
                          note: current[id]?.note ?? '',
                          ...patch,
                        },
                      }))
                    }
                    onCategoryBulkDraftChange={(ids, patch) =>
                      setPolicyCategoryWorkbenchDrafts2026((current) => {
                        const next = { ...current }
                        for (const id of ids) {
                          next[id] = {
                            category: current[id]?.category ?? '',
                            scoreContributionType: current[id]?.scoreContributionType ?? '',
                            note: current[id]?.note ?? '',
                            ...patch,
                          }
                        }
                        return next
                      })
                    }
                    onDivisionSalesGroupChange={(key, value) =>
                      setDivisionSalesGroupDrafts2026((current) => ({ ...current, [key]: value }))
                    }
                    onDepartmentSalesGroupChange={(key, value) =>
                      setDepartmentSalesGroupDrafts2026((current) => ({ ...current, [key]: value }))
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
  selectedCycleId: string | null
  readinessData: EvaluationPreviewReadiness2026ApiData | null
  loading: boolean
  error: string
  officialCycleSaving: boolean
  officialCycleError: string
  officialCycleNotice: string
  onLoad: () => void
  onSetOfficialCycle: (enabled: boolean) => void
}) {
  const readiness = props.readinessData
  const blockers = readiness?.activationBlockers ?? []
  const samples = readiness?.samples ?? []
  const selectedCycleIsOfficial =
    Boolean(props.selectedCycleId) &&
    readiness?.cycleScope.selectedCycleId === props.selectedCycleId &&
    readiness.cycleScope.isOfficialReadinessTarget

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
      {props.officialCycleError ? (
        <div className="mt-4"><Banner tone="error" message={props.officialCycleError} /></div>
      ) : null}
      {props.officialCycleNotice ? (
        <div className="mt-4"><Banner tone="success" message={props.officialCycleNotice} /></div>
      ) : null}

      <div className="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-900">공식 readiness 대상 주기 지정</div>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              공식 점수 전환이 아니라 readiness 대상 주기 지정입니다. 이 설정은 EvalCycle.performanceDesignConfig metadata만 변경하며,
              공식 scoring/grade/AI 제외 flag와 저장 점수는 변경하지 않습니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => props.onSetOfficialCycle(true)}
              disabled={!props.selectedCycleId || props.officialCycleSaving || selectedCycleIsOfficial}
              className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {props.officialCycleSaving ? '저장 중...' : selectedCycleIsOfficial ? '지정됨' : '이 주기를 readiness 대상으로 지정'}
            </button>
            <button
              type="button"
              onClick={() => props.onSetOfficialCycle(false)}
              disabled={!props.selectedCycleId || props.officialCycleSaving || !selectedCycleIsOfficial}
              className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
            >
              readiness 대상 해제
            </button>
          </div>
        </div>
        {!props.selectedCycleId ? (
          <p className="mt-3 text-xs text-amber-700">평가 주기를 선택한 뒤 readiness 대상 여부를 지정할 수 있습니다.</p>
        ) : null}
      </div>

      {readiness ? (
        <div className="mt-5 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={readiness.cycleScope.isOfficialReadinessTarget ? 'success' : 'warn'}>
                {readiness.cycleScope.isOfficialReadinessTarget ? '공식 readiness cycle' : '공식 cycle 미확정'}
              </Badge>
              <span className="text-sm font-semibold text-slate-900">
                {readiness.cycleScope.selectedCycleName ?? '선택된 공식 평가 주기 없음'}
              </span>
              {readiness.cycleScope.selectedCycleYear ? (
                <span className="text-xs text-slate-400">{readiness.cycleScope.selectedCycleYear}</span>
              ) : null}
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              cycleId {readiness.cycleScope.selectedCycleId ?? '미지정'} · mode {readiness.cycleScope.selectionMode}
            </p>
            {readiness.cycleScope.warning ? (
              <div className="mt-3">
                <Banner tone="warn" message={readiness.cycleScope.warning} />
              </div>
            ) : null}
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
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
              label="Division 매핑 필요"
              value={readiness.missingOrgMasterDivisionSalesMappingCount.toLocaleString()}
              help="조직 master 기준"
              compact
              variant={readiness.missingOrgMasterDivisionSalesMappingCount > 0 ? 'warning' : 'default'}
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

function formatIntegratedSnapshotCount2026(value: number | null | undefined) {
  return typeof value === 'number' ? value.toLocaleString() : '미확인'
}

function getIntegratedReadinessStatusTone2026(status: string): 'success' | 'warn' | 'error' | 'neutral' {
  if (status === 'READY_FOR_REVIEW' || status === 'READY_LATER') return 'success'
  if (status === 'NEEDS_DATA' || status === 'NEEDS_HR_ACTION') return 'warn'
  if (status === 'BLOCKED') return 'error'
  return 'neutral'
}

function getReadinessActionPriorityTone2026(priority: string): 'success' | 'warn' | 'error' | 'neutral' {
  if (priority === 'P0') return 'error'
  if (priority === 'P1') return 'warn'
  return 'neutral'
}

function getReadinessActionStatusTone2026(status: string): 'success' | 'warn' | 'error' | 'neutral' {
  if (status === 'READY_TO_START') return 'success'
  if (status === 'DONE') return 'success'
  if (status === 'WATCH_ONLY') return 'neutral'
  if (status === 'NOT_STARTED') return 'neutral'
  if (status === 'WAITING_FOR_DATA') return 'warn'
  if (status === 'IN_PROGRESS') return 'warn'
  if (status === 'BLOCKED') return 'error'
  return 'neutral'
}

const SCENARIO_INPUT_FIELDS_2026: Array<{
  key: keyof ReadinessScenarioInput2026
  label: string
  help: string
}> = [
  { key: 'mboMissingReduction', label: 'MBO missing 감소', help: '미작성 MBO가 줄어드는 가정' },
  { key: 'confirmedKpiIncrease', label: 'confirmed KPI 증가', help: '확정 KPI가 늘어나는 가정' },
  { key: 'teamKpiPendingReduction', label: 'Team KPI pending 감소', help: 'pending/discussion 정리' },
  { key: 'policyCategoryMissingReduction', label: 'policyCategory 감소', help: '미분류 확정' },
  { key: 'evaluatorRoutingBlockerReduction', label: '평가자 blocker 감소', help: 'FIRST/SECOND/FINAL 누락 정리' },
  { key: 'leaderEvaluationBlockerReduction', label: '리더 평가 blocker 감소', help: '리더 평가 선행조건 정리' },
  { key: 'resultWritingWarningReduction', label: '수행결과 warning 감소', help: '결과/증빙/기여 보완' },
  { key: 'scorePolicyBlockerReduction', label: 'score policy 감소', help: '점수 정책 warning 정리' },
  { key: 'gradePolicyBlockerReduction', label: 'grade policy 감소', help: '등급 기준 blocker 정리' },
  { key: 'feedbackLeadershipBlockerReduction', label: '360/리더십 감소', help: '다면/진단 setup 및 응답 정리' },
  { key: 'finalizationCeoBlockerReduction', label: '최종/CEO 감소', help: '최종 확정 readiness 정리' },
]

function numericScenarioValue2026(value: number | null | undefined) {
  return typeof value === 'number' ? value : 0
}

function scenarioSub2026(value: number | null, reduction: number) {
  if (value == null) return null
  return Math.max(value - Math.max(reduction, 0), 0)
}

function scenarioConfirmedShortage2026(active: number | null, confirmed: number | null) {
  if (active == null || confirmed == null) return null
  return Math.max(active - confirmed, 0)
}

function determineScenarioStage2026(
  counts: ReadinessScenarioProjectedCounts2026
): EvaluationActivationReadiness2026ApiData['integratedReadinessSnapshot']['currentStage'] {
  if (numericScenarioValue2026(counts.missingMboCount) > 0 || numericScenarioValue2026(counts.confirmedPersonalKpiShortageCount) > 0) {
    return 'MBO_SETUP_IN_PROGRESS'
  }
  if (
    numericScenarioValue2026(counts.policyCategoryMissingCount) > 0 ||
    numericScenarioValue2026(counts.teamKpiPendingCount) > 0 ||
    numericScenarioValue2026(counts.scorePolicyBlockerCount) > 0
  ) {
    return 'POLICY_MAPPING_IN_PROGRESS'
  }
  if (numericScenarioValue2026(counts.evaluatorRoutingBlockerCount) > 0) return 'REVIEWER_ASSIGNMENT_IN_PROGRESS'
  if (numericScenarioValue2026(counts.resultWritingWarningCount) > 0) return 'RESULT_WRITING_NOT_READY'
  if (numericScenarioValue2026(counts.officialActivationGateBlockerCount) > 0) return 'OFFICIAL_ACTIVATION_BLOCKED'
  return 'READY_FOR_HR_REVIEW'
}

function buildScenarioPreview2026(
  simulator: ReadinessScenarioSimulator2026,
  input: ReadinessScenarioInput2026,
  scenarioName: string
): ReadinessScenarioPreview2026 {
  const base = simulator.baselineCounts
  const confirmedPersonalKpiCount = base.confirmedPersonalKpiCount == null
    ? null
    : Math.min(
        base.confirmedPersonalKpiCount + Math.max(input.confirmedKpiIncrease, 0),
        base.activeEmployeeCount ?? base.confirmedPersonalKpiCount + Math.max(input.confirmedKpiIncrease, 0)
      )
  const estimatedImpact = Object.values(input).reduce((sum, value) => sum + Math.max(value, 0), 0)
  const projectedCounts: ReadinessScenarioProjectedCounts2026 = {
    activeEmployeeCount: base.activeEmployeeCount,
    confirmedPersonalKpiCount,
    confirmedPersonalKpiShortageCount: scenarioConfirmedShortage2026(base.activeEmployeeCount, confirmedPersonalKpiCount),
    missingMboCount: scenarioSub2026(base.missingMboCount, input.mboMissingReduction),
    teamKpiPendingCount: scenarioSub2026(base.teamKpiPendingCount, input.teamKpiPendingReduction),
    policyCategoryMissingCount: scenarioSub2026(base.policyCategoryMissingCount, input.policyCategoryMissingReduction),
    evaluatorRoutingBlockerCount: scenarioSub2026(base.evaluatorRoutingBlockerCount, input.evaluatorRoutingBlockerReduction),
    leaderEvaluationBlockerCount: scenarioSub2026(base.leaderEvaluationBlockerCount, input.leaderEvaluationBlockerReduction),
    resultWritingWarningCount: scenarioSub2026(base.resultWritingWarningCount, input.resultWritingWarningReduction),
    scorePolicyBlockerCount: scenarioSub2026(base.scorePolicyBlockerCount, input.scorePolicyBlockerReduction),
    gradePolicyBlockerCount: scenarioSub2026(base.gradePolicyBlockerCount, input.gradePolicyBlockerReduction),
    feedbackLeadershipBlockerCount: scenarioSub2026(base.feedbackLeadershipBlockerCount, input.feedbackLeadershipBlockerReduction),
    finalizationCeoBlockerCount: scenarioSub2026(base.finalizationCeoBlockerCount, input.finalizationCeoBlockerReduction),
    officialActivationGateBlockerCount: base.officialActivationGateBlockerCount,
    estimatedOfficialGateBlockerCount: base.officialActivationGateBlockerCount == null
      ? null
      : Math.max(base.officialActivationGateBlockerCount - estimatedImpact, 0),
    estimatedOfficialGateImpact: estimatedImpact,
  }
  const deltaRows = [
    ['MBO_MISSING', 'MBO missing', base.missingMboCount, projectedCounts.missingMboCount, 'MBO 미작성 감소만 반영'],
    ['CONFIRMED_KPI_SHORTAGE', 'confirmed KPI shortage', base.confirmedPersonalKpiShortageCount, projectedCounts.confirmedPersonalKpiShortageCount, 'confirmed KPI 증가만 반영'],
    ['TEAM_KPI_PENDING', 'Team KPI pending', base.teamKpiPendingCount, projectedCounts.teamKpiPendingCount, 'Team KPI pending 감소만 반영'],
    ['POLICY_CATEGORY_MISSING', 'policyCategory missing', base.policyCategoryMissingCount, projectedCounts.policyCategoryMissingCount, 'policyCategory 미분류 감소만 반영'],
    ['EVALUATOR_ROUTING', 'evaluator routing blockers', base.evaluatorRoutingBlockerCount, projectedCounts.evaluatorRoutingBlockerCount, '평가자 배정 blocker 감소만 반영'],
    ['LEADER_EVALUATION', 'leader evaluation blockers', base.leaderEvaluationBlockerCount, projectedCounts.leaderEvaluationBlockerCount, '리더 평가 blocker 감소만 반영'],
    ['OFFICIAL_GATE', 'official gate blockers', base.officialActivationGateBlockerCount, projectedCounts.officialActivationGateBlockerCount, `gate count는 실제 재산출 전까지 고정, 잠재 영향 -${estimatedImpact}건`],
  ].map(([key, label, baseline, projected, note]) => ({
    key: String(key),
    label: String(label),
    baseline: baseline as number | null,
    projected: projected as number | null,
    delta: baseline == null || projected == null ? null : (projected as number) - (baseline as number),
    note: String(note),
  }))
  const remainingBlockers = [
    ['MBO missing', projectedCounts.missingMboCount, '미작성자 작성 요청을 계속 진행하세요.'],
    ['confirmed KPI shortage', projectedCounts.confirmedPersonalKpiShortageCount, '초안 제출과 리더 검토/확정을 요청하세요.'],
    ['evaluator routing blockers', projectedCounts.evaluatorRoutingBlockerCount, '평가자 배정 누락/조직 경로를 확인하세요.'],
    ['Team KPI pending', projectedCounts.teamKpiPendingCount, 'Team KPI pending/discussion 항목을 검토하세요.'],
    ['policyCategory missing', projectedCounts.policyCategoryMissingCount, '미분류 항목을 HR 기준으로 확정하세요.'],
    ['official gate blockers', projectedCounts.officialActivationGateBlockerCount, 'dry-run, DB backup, HR approval, Runbook 단계를 확인하세요.'],
  ]
    .map(([label, count, nextAction]) => ({ label: String(label), count: numericScenarioValue2026(count as number | null), nextAction: String(nextAction) }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count)
  const projectedStage = determineScenarioStage2026(projectedCounts)
  const projectedStatus = projectedStage === 'READY_FOR_HR_REVIEW' ? 'READY_LATER' : 'NEEDS_HR_ACTION'
  const nextHrAction = remainingBlockers[0]?.nextAction ?? 'dry-run, DB backup, HR approval, Runbook 검토를 준비하세요.'
  const reportText = [
    `이 시나리오는 ${scenarioName}를 가정합니다.`,
    `projected stage는 ${projectedStage}, overall status는 ${projectedStatus}입니다.`,
    `남는 주요 blocker는 ${remainingBlockers.slice(0, 5).map((item) => `${item.label} ${item.count}건`).join(', ') || '직접 blocker 없음'}입니다.`,
    '공식 전환은 여전히 dry-run, DB backup, HR 승인 전까지 차단됩니다.',
    simulator.disclaimer,
  ].join(' ')
  const markdown = [
    `# 2026 Readiness Scenario Simulator - ${scenarioName}`,
    '',
    reportText,
    '',
    '## Delta',
    deltaRows.map((row) => `- ${row.label}: ${row.delta ?? '미확인'} (${row.note})`).join('\n'),
    '',
    '## Prohibited actions',
    simulator.prohibitedActions.map((item) => `- ${item}`).join('\n'),
  ].join('\n')
  const tsv = [
    'blocker\tbaseline\tprojected\tdelta\tnote',
    ...deltaRows.map((row) => [
      row.label,
      row.baseline == null ? '미확인' : String(row.baseline),
      row.projected == null ? '미확인' : String(row.projected),
      row.delta == null ? '미확인' : String(row.delta),
      row.note,
    ].join('\t')),
  ].join('\n')
  return {
    scenarioName,
    projectedCounts,
    deltaRows,
    remainingBlockers,
    projectedStage,
    projectedStatus,
    nextHrAction,
    reportText,
    markdown,
    tsv,
  }
}

function formatDryRunOutputPasteValue2026(value: unknown) {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function getDryRunOutputNumber2026(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) return parsed
    }
  }
  return 0
}

function getDryRunOutputBoolean2026(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'boolean') return value
    if (typeof value === 'number') return value > 0
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase()
      if (['1', 'true', 'yes', 'changed', 'enabled'].includes(normalized)) return true
      if (['0', 'false', 'no', 'unchanged', 'disabled'].includes(normalized)) return false
    }
  }
  return false
}

function getDryRunOutputMessages2026(record: Record<string, unknown>, ...keys: string[]) {
  return keys.flatMap((key) => {
    const value = record[key]
    if (Array.isArray(value)) return value.map((item) => String(item))
    if (typeof value === 'string' && value.trim()) return [value]
    return []
  })
}

function reviewDryRunOutputPasteLocally2026(record: Record<string, unknown>) {
  const redFlags: string[] = []
  const nextActions: string[] = []
  const add = (flag: string, action: string) => {
    redFlags.push(flag)
    nextActions.push(action)
  }
  if (getDryRunOutputBoolean2026(record, 'writesPerformed', 'writes_performed')) {
    add('WRITES_PERFORMED_TRUE', '즉시 중단하고 dry-run 실행 경로를 조사하세요.')
  }
  if (getDryRunOutputBoolean2026(record, 'totalScoreChangesExpected', 'totalScoreChanged')) {
    add('TOTAL_SCORE_CHANGED', 'Evaluation.totalScore write 경로를 조사하세요.')
  }
  if (getDryRunOutputBoolean2026(record, 'gradeIdChangesExpected', 'gradeIdChanged')) {
    add('GRADE_ID_CHANGED', 'Evaluation.gradeId write 경로를 조사하세요.')
  }
  if (getDryRunOutputBoolean2026(record, 'officialScoringEnabled', 'officialGradeEnabled', 'featureFlagsChanged')) {
    add('FEATURE_FLAG_OR_OFFICIAL_ACTIVATION', 'official scoring/grade/feature flag 상태를 조사하세요.')
  }
  if (getDryRunOutputNumber2026(record, 'policyCategoryMissingCount', 'missingPolicyCategoryCount') > 0) {
    add('POLICY_CATEGORY_MISSING', 'policyCategory workbench에서 미분류를 정리하세요.')
  }
  if (
    getDryRunOutputNumber2026(record, 'evaluatorAssignmentMissingCount', 'evaluatorMissingCount') > 0 &&
    !getDryRunOutputBoolean2026(record, 'approvedEvaluatorExceptions', 'evaluatorExceptionsApproved')
  ) {
    add('EVALUATOR_MISSING', '/admin/performance-assignments에서 blocker 또는 승인 예외를 확인하세요.')
  }
  if (getDryRunOutputNumber2026(record, 'mboMissingCount', 'missingMboCount') > 0) {
    add('MBO_MISSING', '/kpi/personal에서 MBO coverage를 확인하세요.')
  }
  const errors = getDryRunOutputMessages2026(record, 'errors', 'warnings').join(' ')
  if (/(P2021|P2022|PrismaClientKnownRequestError|column does not exist|relation does not exist|schema error)/i.test(errors)) {
    add('PRISMA_SCHEMA_ERROR', 'migration 실행 없이 schema/runtime issue를 조사하세요.')
  }
  if (/JWT_SESSION_ERROR/i.test(errors)) {
    add('JWT_SESSION_ERROR', 'auth/session runtime 상태를 확인하세요.')
  }

  return {
    classification: redFlags.some((flag) =>
      ['WRITES_PERFORMED_TRUE', 'TOTAL_SCORE_CHANGED', 'GRADE_ID_CHANGED', 'FEATURE_FLAG_OR_OFFICIAL_ACTIVATION', 'PRISMA_SCHEMA_ERROR'].includes(flag)
    )
      ? 'REJECT_DRY_RUN_OUTPUT'
      : redFlags.some((flag) => flag === 'JWT_SESSION_ERROR')
        ? 'NEEDS_DEVELOPER_FIX'
        : redFlags.length
          ? 'NEEDS_HR_FIX'
          : 'PASS_FOR_REVIEW',
    redFlags,
    nextActions: nextActions.length
      ? nextActions
      : ['must-pass criteria를 확인하고 backup/HR approval 논의로만 이동하세요. apply는 여전히 금지입니다.'],
  }
}

function PolicyActivationReadiness2026Panel(props: {
  activationData: EvaluationActivationReadiness2026ApiData | null
  loading: boolean
  error: string
  autoLoadKey: string
  onLoad: () => void
}) {
  const { activationData: activation, loading, error, autoLoadKey, onLoad } = props
  const blockers = activation?.blockers ?? []
  const warnings = activation?.warnings ?? []
  const gates = activation?.officialActivationGates ?? []
  const runbook = activation?.officialActivationRunbook ?? null
  const snapshot = activation?.integratedReadinessSnapshot ?? null
  const actionPlan = activation?.readinessActionPlan ?? null
  const executionBoard = activation?.readinessExecutionBoard ?? null
  const scenarioSimulator = activation?.readinessScenarioSimulator ?? null
  const ceoReportPack = activation?.ceoReportPack ?? null
  const fastForwardOperationsCockpit = activation?.fastForwardOperationsCockpit ?? null
  const backfillDryRunPreflightPack = activation?.backfillDryRunPreflightPack ?? null
  const dryRunOutputReviewTemplate = activation?.dryRunOutputReviewTemplate ?? null
  const dryRunRehearsalGuardrails = activation?.dryRunRehearsalGuardrails ?? null
  const backfillDryRunCommandRunbook = activation?.backfillDryRunCommandRunbook ?? null
  const dryRunGoNoGoFreezePack = activation?.dryRunGoNoGoFreezePack ?? null
  const gatesReady = gates.length > 0 && gates.every((gate) => gate.status === 'READY' || gate.status === 'NOT_APPLICABLE')
  const [copiedRunbookKey, setCopiedRunbookKey] = useState<string | null>(null)
  const [executionBoardTab, setExecutionBoardTab] = useState<'ALL' | 'THIS_WEEK' | 'HR' | 'LEADER' | 'EMPLOYEE' | 'DEV' | 'DONE_HOLD'>('THIS_WEEK')
  const [dryRunOutputPasteText, setDryRunOutputPasteText] = useState('')
  const [scenarioState, setScenarioState] = useState<{
    presetId: string
    inputs: ReadinessScenarioInput2026 | null
    sourceKey: string
  }>({
    presetId: 'MBO_FIRST_REMINDER',
    inputs: null,
    sourceKey: '',
  })
  const copyActivationRunbookPayload = useCallback(async (key: string, text: string) => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return
    await navigator.clipboard.writeText(text)
    setCopiedRunbookKey(key)
    window.setTimeout(() => setCopiedRunbookKey((current) => (current === key ? null : current)), 1800)
  }, [])
  const autoLoadRequestedKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (activation || loading || error) return
    if (autoLoadRequestedKeyRef.current === autoLoadKey) return

    autoLoadRequestedKeyRef.current = autoLoadKey
    void onLoad()
  }, [activation, autoLoadKey, error, loading, onLoad])
  const selectedScenarioPreset = useMemo(() => {
    if (!scenarioSimulator) return null
    return scenarioSimulator.presets.find((preset) => preset.id === scenarioState.presetId) ?? scenarioSimulator.presets[0] ?? null
  }, [scenarioSimulator, scenarioState.presetId])

  const scenarioInputValues =
    scenarioState.sourceKey === autoLoadKey && scenarioState.inputs
      ? scenarioState.inputs
      : selectedScenarioPreset?.input ?? scenarioSimulator?.scenarioInputModel ?? null
  const scenarioPreview = useMemo(() => {
    if (!scenarioSimulator || !scenarioInputValues) return null
    return buildScenarioPreview2026(
      scenarioSimulator,
      scenarioInputValues,
      selectedScenarioPreset?.name ?? 'Manual scenario'
    )
  }, [scenarioInputValues, scenarioSimulator, selectedScenarioPreset])
  const dryRunOutputPasteReview = useMemo<DryRunOutputPasteReview2026 | null>(() => {
    if (!dryRunOutputReviewTemplate || !dryRunOutputPasteText.trim()) return null
    try {
      const parsed = JSON.parse(dryRunOutputPasteText) as unknown
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return {
          ok: false,
          message: dryRunOutputReviewTemplate.localOnlyPasteHelper.invalidJsonMessage,
          fields: [],
        }
      }
      const record = parsed as Record<string, unknown>
      const fields = dryRunOutputReviewTemplate.localOnlyPasteHelper.knownFields
        .filter((field) => Object.prototype.hasOwnProperty.call(record, field))
        .map((field) => ({
          field,
          value: formatDryRunOutputPasteValue2026(record[field]),
        }))
      const localReview = reviewDryRunOutputPasteLocally2026(record)
      return {
        ok: true,
        message: fields.length
          ? '붙여넣은 결과에서 알려진 필드를 확인했습니다. 서버 제출 없이 브라우저 local state에서만 표시합니다.'
          : '알려진 필드가 없어 수동 검토 템플릿을 사용하세요. 서버 제출, 저장, 업로드는 수행하지 않습니다.',
        classification: localReview.classification,
        redFlags: localReview.redFlags,
        nextActions: localReview.nextActions,
        fields,
      }
    } catch {
      return {
        ok: false,
        message: dryRunOutputReviewTemplate.localOnlyPasteHelper.invalidJsonMessage,
        fields: [],
      }
    }
  }, [dryRunOutputPasteText, dryRunOutputReviewTemplate])
  const executionBoardActions = useMemo(() => {
    if (!executionBoard) return []
    if (executionBoardTab === 'ALL') return executionBoard.workstreams.all
    if (executionBoardTab === 'THIS_WEEK') return executionBoard.workstreams.thisWeekFocus
    if (executionBoardTab === 'HR') return executionBoard.workstreams.hr
    if (executionBoardTab === 'LEADER') return executionBoard.workstreams.leader
    if (executionBoardTab === 'EMPLOYEE') return executionBoard.workstreams.employee
    if (executionBoardTab === 'DEV') return executionBoard.workstreams.developer
    return executionBoard.workstreams.completedOrDeferred
  }, [executionBoard, executionBoardTab])

  return (
    <Panel
      title="2026 공식 전환 Gate"
      description="이 화면은 공식 전환 가능 여부를 읽기 전용으로 점검합니다. 여기서는 backfill, 점수, 등급, feature flag를 실행하지 않습니다."
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-1 rounded-2xl bg-amber-50 p-2 text-amber-700">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="neutral">Status only</Badge>
              <Badge tone={gatesReady ? 'success' : activation ? 'warn' : 'neutral'}>
                {gatesReady ? 'Gate ready' : activation ? 'Gate blocked' : '미확인'}
              </Badge>
              <Badge tone="neutral">활성화 버튼 없음</Badge>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              backfill --apply, official scoring, official grade, AI score exclusion,
              Evaluation.totalScore, Evaluation.gradeId write를 켜기 전 차단 조건만 확인합니다.
              저장 점수, 저장 등급, 제출, 확정, 보정 흐름은 변경하지 않습니다.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onLoad}
          disabled={loading}
          className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
        >
          {loading ? '확인 중...' : activation ? '공식 전환 상태 다시 확인' : '공식 전환 상태 확인'}
        </button>
      </div>

      {error ? <div className="mt-4"><Banner tone="error" message={error} /></div> : null}

      {activation ? (
        <div className="mt-5 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={activation.readiness.cycleScope.isOfficialReadinessTarget ? 'success' : 'warn'}>
                {activation.readiness.cycleScope.isOfficialReadinessTarget ? '공식 readiness cycle' : '공식 cycle 미확정'}
              </Badge>
              <span className="text-sm font-semibold text-slate-900">
                {activation.readiness.cycleScope.selectedCycleName ?? '선택된 공식 평가 주기 없음'}
              </span>
              {activation.readiness.cycleScope.selectedCycleYear ? (
                <span className="text-xs text-slate-400">{activation.readiness.cycleScope.selectedCycleYear}</span>
              ) : null}
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              cycleId {activation.readiness.cycleScope.selectedCycleId ?? '미지정'} · mode {activation.readiness.cycleScope.selectionMode}
            </p>
            {activation.readiness.cycleScope.warning ? (
              <div className="mt-3">
                <Banner tone="warn" message={activation.readiness.cycleScope.warning} />
              </div>
            ) : null}
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <MetricCard
              label="Gate blocked"
              value={gates.filter((gate) => gate.status === 'BLOCKED').length.toLocaleString()}
              help="공식 실행 전 해소"
              compact
              variant={gates.some((gate) => gate.status === 'BLOCKED') ? 'warning' : 'default'}
            />
            <MetricCard
              label="Runbook"
              value={runbook ? runbook.summary.blockedSectionCount.toLocaleString() : '미확인'}
              help={runbook ? `next ${runbook.summary.nextExecutableStep}` : 'read-only'}
              compact
              variant={(runbook?.summary.blockedSectionCount ?? 1) > 0 ? 'warning' : 'default'}
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
            <MetricCard
              label="360/리더십"
              value={activation.feedbackLeadershipReadiness?.summary.blockedOrNeedsSetupCount.toLocaleString() ?? '미확인'}
              help="readiness blocker"
              compact
              variant={
                (activation.feedbackLeadershipReadiness?.summary.blockedOrNeedsSetupCount ?? 1) > 0
                  ? 'warning'
                  : 'default'
              }
            />
            <MetricCard
              label="리더 평가"
              value={activation.leaderEvaluationReadiness?.summary.blockerCount.toLocaleString() ?? '미확인'}
              help="readiness blocker"
              compact
              variant={(activation.leaderEvaluationReadiness?.summary.blockerCount ?? 1) > 0 ? 'warning' : 'default'}
            />
            <MetricCard
              label="최종/CEO"
              value={activation.finalizationCeoReadiness?.summary.finalizationBlockerCount.toLocaleString() ?? '미확인'}
              help={`CEO ${activation.finalizationCeoReadiness?.summary.ceoConfirmationBlockerCount.toLocaleString() ?? '미확인'} · calibration ${activation.finalizationCeoReadiness?.summary.calibrationReadinessBlockerCount.toLocaleString() ?? '미확인'}`}
              compact
              variant={(activation.finalizationCeoReadiness?.summary.finalizationBlockerCount ?? 1) > 0 ? 'warning' : 'default'}
            />
            {executionBoard ? (
              <>
                <MetricCard
                  label="Action board open"
                  value={executionBoard.summary.totalOpenActionCount.toLocaleString()}
                  help={`P0 ${executionBoard.summary.p0Count.toLocaleString()} · no execution buttons`}
                  compact
                  variant={executionBoard.summary.p0Count > 0 ? 'warning' : 'default'}
                />
                <MetricCard
                  label="Next HR action"
                  value={executionBoard.summary.nextHrAction}
                  help="read-only tracking"
                  compact
                  variant="warning"
                />
                <MetricCard
                  label="Next dev/watch"
                  value={executionBoard.summary.nextDeveloperWatchAction}
                  help={executionBoard.summary.lastBaselineTimestamp ?? 'baseline export-only'}
                  compact
                  variant="muted"
                />
              </>
            ) : null}
            {ceoReportPack ? (
              <>
                <MetricCard
                  label="CEO report pack"
                  value={ceoReportPack.reportStatus}
                  help="read-only report"
                  compact
                  variant="default"
                />
                <MetricCard
                  label="CEO objective"
                  value="HR blocker order"
                  help={ceoReportPack.summary.officialActivationStatus}
                  compact
                  variant={ceoReportPack.summary.officialActivationStatus === 'BLOCKED' ? 'warning' : 'default'}
                />
              </>
            ) : null}
            {fastForwardOperationsCockpit ? (
              <>
                <MetricCard
                  label="Fast-forward"
                  value={fastForwardOperationsCockpit.fastForwardSummary.parallelWorkstreamCount.toLocaleString()}
                  help="parallel workstreams"
                  compact
                  variant="default"
                />
                <MetricCard
                  label="Critical path"
                  value={fastForwardOperationsCockpit.fastForwardSummary.criticalPathItemCount.toLocaleString()}
                  help={fastForwardOperationsCockpit.fastForwardSummary.nextCheckpointCondition}
                  compact
                  variant={fastForwardOperationsCockpit.fastForwardSummary.officialActivationStatus === 'BLOCKED' ? 'warning' : 'default'}
                />
              </>
            ) : null}
            {backfillDryRunPreflightPack ? (
              <>
                <MetricCard
                  label="Backfill preflight"
                  value={backfillDryRunPreflightPack.preflightSummary.backfillDryRunReviewStatus}
                  help={`apply ${backfillDryRunPreflightPack.preflightSummary.backfillApplyStatus}`}
                  compact
                  variant={backfillDryRunPreflightPack.preflightSummary.backfillDryRunReviewStatus === 'BLOCKED' ? 'warning' : 'default'}
                />
                <MetricCard
                  label="Missing preconditions"
                  value={backfillDryRunPreflightPack.preflightSummary.missingPreconditionsCount.toLocaleString()}
                  help={backfillDryRunPreflightPack.preflightSummary.nextPreflightAction}
                  compact
                  variant={backfillDryRunPreflightPack.preflightSummary.missingPreconditionsCount > 0 ? 'warning' : 'default'}
                />
              </>
            ) : null}
            {dryRunOutputReviewTemplate ? (
              <MetricCard
                label="Dry-run review template"
                value={dryRunOutputReviewTemplate.templateStatus}
                help={dryRunOutputReviewTemplate.templateSummary.localOnlyPasteHelperStatus}
                compact
                variant="default"
              />
            ) : null}
            {dryRunRehearsalGuardrails ? (
              <MetricCard
                label="Dry-run rehearsal"
                value={dryRunRehearsalGuardrails.status}
                help={dryRunRehearsalGuardrails.summary.applyStatus}
                compact
                variant="default"
              />
            ) : null}
            {backfillDryRunCommandRunbook ? (
              <MetricCard
                label="Dry-run command runbook"
                value={backfillDryRunCommandRunbook.summary.commandReferenceStatus}
                help={backfillDryRunCommandRunbook.summary.applyStatus}
                compact
                variant="warning"
              />
            ) : null}
            {dryRunGoNoGoFreezePack ? (
              <MetricCard
                label="Dry-run Go/No-Go"
                value={dryRunGoNoGoFreezePack.decision.currentDecision}
                help={`apply ${dryRunGoNoGoFreezePack.decision.applyStatus}`}
                compact
                variant={dryRunGoNoGoFreezePack.decision.currentDecision === 'READY_FOR_REVIEW' ? 'default' : 'warning'}
              />
            ) : null}
          </div>

          {snapshot ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-semibold text-slate-900">2026 통합 readiness snapshot</h4>
                    <Badge tone={getIntegratedReadinessStatusTone2026(snapshot.overallStatus)}>
                      {snapshot.overallStatus}
                    </Badge>
                    <Badge tone="neutral">{snapshot.currentStage}</Badge>
                    <Badge tone="neutral">read-only report</Badge>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    이 화면은 2026 공식 전환 준비 상태를 읽기 전용으로 요약합니다. backfill, 공식 점수, 공식 등급, feature flag는 실행하지 않습니다.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    ['snapshot-executive', '경영요약', snapshot.copyPayloads.executiveSummary],
                    ['snapshot-hr', 'HR action', snapshot.copyPayloads.hrActionList],
                    ['snapshot-dev', 'Dev action', snapshot.copyPayloads.developerActionList],
                    ['snapshot-blockers', 'blocker 요약', snapshot.copyPayloads.blockerSummary],
                    ['snapshot-prohibited', '금지 목록', snapshot.copyPayloads.prohibitedActions],
                    ['snapshot-markdown', 'Markdown', snapshot.copyPayloads.markdown],
                    ['snapshot-tsv', 'TSV', snapshot.copyPayloads.tsv],
                  ].map(([key, label, text]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => void copyActivationRunbookPayload(key, text)}
                      className="inline-flex min-h-9 items-center justify-center rounded-xl border border-slate-300 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      {copiedRunbookKey === key ? '복사됨' : label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                <MetricCard
                  label="active employees"
                  value={formatIntegratedSnapshotCount2026(snapshot.summary.activeEmployeeCount)}
                  help="target scope"
                  compact
                />
                <MetricCard
                  label="confirmed KPI"
                  value={formatIntegratedSnapshotCount2026(snapshot.summary.confirmedPersonalKpiCount)}
                  help={snapshot.completionRates.mboConfirmedRate == null ? 'rate 미확인' : `${snapshot.completionRates.mboConfirmedRate}%`}
                  compact
                />
                <MetricCard
                  label="missing MBO"
                  value={formatIntegratedSnapshotCount2026(snapshot.summary.missingMboCount)}
                  help="작성 필요"
                  compact
                  variant={(snapshot.summary.missingMboCount ?? 1) > 0 ? 'warning' : 'default'}
                />
                <MetricCard
                  label="policyCategory"
                  value={formatIntegratedSnapshotCount2026(snapshot.summary.policyCategoryMissingCount)}
                  help="missing"
                  compact
                  variant={(snapshot.summary.policyCategoryMissingCount ?? 1) > 0 ? 'warning' : 'default'}
                />
                <MetricCard
                  label="routing blocker"
                  value={formatIntegratedSnapshotCount2026(snapshot.summary.evaluatorRoutingBlockerCount)}
                  help="평가자 배정"
                  compact
                  variant={(snapshot.summary.evaluatorRoutingBlockerCount ?? 1) > 0 ? 'warning' : 'default'}
                />
                <MetricCard
                  label="official gate"
                  value={formatIntegratedSnapshotCount2026(snapshot.summary.officialActivationGateBlockerCount)}
                  help="공식 전환"
                  compact
                  variant={(snapshot.summary.officialActivationGateBlockerCount ?? 1) > 0 ? 'warning' : 'default'}
                />
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-3">
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <h5 className="text-sm font-semibold text-amber-950">Top blockers</h5>
                  {snapshot.topBlockers.length ? (
                    <ul className="mt-3 space-y-2">
                      {snapshot.topBlockers.slice(0, 8).map((blocker) => (
                        <li key={blocker.code} className="text-sm leading-6 text-amber-950">
                          <span className="font-semibold">{blocker.name}</span> · {blocker.count.toLocaleString()}건
                          <div className="text-xs text-amber-800">{blocker.sourcePanel} · {blocker.relatedRoute}</div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm leading-6 text-emerald-800">현재 통합 snapshot 기준 주요 blocker가 없습니다.</p>
                  )}
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h5 className="text-sm font-semibold text-slate-900">Next actions</h5>
                  <div className="mt-3 space-y-3 text-sm leading-6 text-slate-600">
                    <div>
                      <p className="text-xs font-semibold text-slate-500">HR</p>
                      <ul className="mt-1 space-y-1">
                        {snapshot.nextActions.hr.slice(0, 4).map((action) => (
                          <li key={`${action.label}-${action.route}`}>- {action.label}: {action.detail}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-500">Developer</p>
                      <ul className="mt-1 space-y-1">
                        {snapshot.nextActions.developer.map((action) => (
                          <li key={`${action.label}-${action.route}`}>- {action.label}: {action.detail}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h5 className="text-sm font-semibold text-slate-900">Executive report</h5>
                  <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-600">{snapshot.executiveReportText}</p>
                </div>
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <h5 className="text-sm font-semibold text-slate-900">Decision readiness</h5>
                  <div className="mt-3 overflow-x-auto">
                    <table className="min-w-full text-left text-xs">
                      <thead className="text-slate-400">
                        <tr>
                          <th className="whitespace-nowrap px-2 py-2 font-semibold">decision</th>
                          <th className="whitespace-nowrap px-2 py-2 font-semibold">status</th>
                          <th className="whitespace-nowrap px-2 py-2 font-semibold">blocker</th>
                          <th className="whitespace-nowrap px-2 py-2 font-semibold">next action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {snapshot.decisionReadiness.map((decision) => (
                          <tr key={decision.id}>
                            <td className="min-w-44 px-2 py-2 font-semibold text-slate-900">{decision.label}</td>
                            <td className="px-2 py-2">
                              <Badge tone={getIntegratedReadinessStatusTone2026(decision.status)}>{decision.status}</Badge>
                            </td>
                            <td className="px-2 py-2">{decision.blockerCount.toLocaleString()}건</td>
                            <td className="min-w-72 px-2 py-2">{decision.nextAction}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <h5 className="text-sm font-semibold text-slate-900">Official activation state</h5>
                  <div className="mt-3 grid gap-2">
                    {snapshot.activationState.map((item) => (
                      <div key={item.id} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-slate-900">{item.label}</span>
                          <Badge tone={getIntegratedReadinessStatusTone2026(item.status)}>{item.status}</Badge>
                        </div>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          blocker {item.blockerCount.toLocaleString()}건 · {item.nextAction}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4">
                <h5 className="text-sm font-semibold text-rose-950">Prohibited actions</h5>
                <p className="mt-2 text-sm leading-6 text-rose-900">{snapshot.prohibitedActions.join(', ')}</p>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-semibold text-slate-900">2026 통합 readiness snapshot</h4>
                    <Badge tone="neutral">{loading ? 'loading' : '미확인'}</Badge>
                    <Badge tone="neutral">read-only report</Badge>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    공식 전환 Gate 데이터를 불러오면 현재 단계, overall readiness status, top blockers,
                    official activation state, decision readiness, prohibited actions와 copy/export 버튼이 표시됩니다.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onLoad}
                  disabled={loading}
                  className="inline-flex min-h-9 items-center justify-center rounded-xl border border-slate-300 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
                >
                  {loading ? 'snapshot 불러오는 중...' : 'snapshot 다시 불러오기'}
                </button>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard label="현재 단계" value="미확인" help="activation readiness load 필요" compact variant="muted" />
                <MetricCard label="overall readiness status" value="미확인" help="activation readiness load 필요" compact variant="muted" />
                <MetricCard label="top blockers" value="미확인" help="blocker summary 대기" compact variant="muted" />
                <MetricCard label="official activation state" value="미확인" help="read-only gate 대기" compact variant="muted" />
              </div>
            </div>
          )}

          {actionPlan ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-semibold text-slate-900">2026 Readiness Action Plan</h4>
                    <Badge tone="neutral">{actionPlan.currentStage}</Badge>
                    <Badge tone={getIntegratedReadinessStatusTone2026(actionPlan.overallStatus)}>
                      {actionPlan.overallStatus}
                    </Badge>
                    <Badge tone="neutral">read-only board</Badge>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    이 화면은 readiness blocker를 실행 항목으로 정리하는 읽기 전용 보드입니다.
                    알림 발송, 저장, backfill, 공식 점수/등급 변경은 수행하지 않습니다.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    ['action-hr', 'HR plan', actionPlan.copyPayloads.hrActionPlan],
                    ['action-leader', 'Leader plan', actionPlan.copyPayloads.leaderActionPlan],
                    ['action-employee', 'Employee plan', actionPlan.copyPayloads.employeeActionPlan],
                    ['action-dev', 'Dev watch', actionPlan.copyPayloads.developerWatchPlan],
                    ['action-full', 'Full board', actionPlan.copyPayloads.fullActionBoard],
                    ['action-markdown', 'Markdown', actionPlan.copyPayloads.markdown],
                    ['action-tsv', 'TSV', actionPlan.copyPayloads.tsv],
                  ].map(([key, label, text]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => void copyActivationRunbookPayload(key, text)}
                      className="inline-flex min-h-9 items-center justify-center rounded-xl border border-slate-300 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      {copiedRunbookKey === key ? '복사됨' : label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4">
                <h5 className="text-sm font-semibold text-blue-950">This week focus</h5>
                <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-5">
                  {actionPlan.thisWeekFocus.map((item) => (
                    <div key={item.id} className="rounded-xl border border-blue-100 bg-white px-3 py-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={getReadinessActionPriorityTone2026(item.priority)}>{item.priority}</Badge>
                        <Badge tone="neutral">{item.ownerGroup}</Badge>
                      </div>
                      <p className="mt-2 text-sm font-semibold leading-5 text-slate-900">{item.title}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        {item.relatedBlockerCount == null ? 'blocker 미확인' : `${item.relatedBlockerCount.toLocaleString()}건`}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-4">
                {[
                  ['HR', actionPlan.actionGroups.hr],
                  ['Leaders', actionPlan.actionGroups.leader],
                  ['Employees', actionPlan.actionGroups.employee],
                  ['Developers / ops', actionPlan.actionGroups.developer],
                ].map(([label, items]) => (
                  <div key={label as string} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <h5 className="text-sm font-semibold text-slate-900">{label as string}</h5>
                    <div className="mt-3 space-y-2">
                      {(items as typeof actionPlan.actionGroups.hr).slice(0, 5).map((item) => (
                        <div key={item.id} className="rounded-xl border border-slate-100 bg-white px-3 py-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge tone={getReadinessActionPriorityTone2026(item.priority)}>{item.priority}</Badge>
                            <Badge tone={getReadinessActionStatusTone2026(item.status)}>{item.status}</Badge>
                          </div>
                          <p className="mt-2 text-sm font-semibold leading-5 text-slate-900">{item.title}</p>
                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            {item.relatedBlockerCount == null ? 'blocker 미확인' : `${item.relatedBlockerCount.toLocaleString()}건`} · {item.relatedRoute}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h5 className="text-sm font-semibold text-slate-900">Action report</h5>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{actionPlan.reportText}</p>
                </div>
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                  <h5 className="text-sm font-semibold text-rose-950">Prohibited actions</h5>
                  <p className="mt-2 text-sm leading-6 text-rose-900">{actionPlan.prohibitedActions.join(', ')}</p>
                </div>
              </div>
            </div>
          ) : null}

          {executionBoard ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-semibold text-slate-900">2026 Readiness Execution Board</h4>
                    <Badge tone={getIntegratedReadinessStatusTone2026(executionBoard.summary.overallReadinessStatus)}>
                      {executionBoard.summary.overallReadinessStatus}
                    </Badge>
                    <Badge tone={executionBoard.summary.officialActivationStatus === 'BLOCKED' ? 'warn' : 'neutral'}>
                      {executionBoard.summary.officialActivationStatus}
                    </Badge>
                    <Badge tone="neutral">export-only</Badge>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    이 화면은 readiness 실행 항목을 운영 관리하기 위한 보드입니다.
                    공식 점수, 등급, backfill, feature flag, Evaluation.totalScore, Evaluation.gradeId는 변경하지 않습니다.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    ['execution-full', 'Full board', executionBoard.copyPayloads.fullBoard],
                    ['execution-week', 'This week', executionBoard.copyPayloads.thisWeekFocus],
                    ['execution-hr', 'HR list', executionBoard.copyPayloads.hrActionList],
                    ['execution-leader', 'Leader list', executionBoard.copyPayloads.leaderActionList],
                    ['execution-employee', 'Employee list', executionBoard.copyPayloads.employeeActionList],
                    ['execution-dev', 'Dev watch', executionBoard.copyPayloads.developerWatchList],
                    ['execution-report', 'Executive report', executionBoard.copyPayloads.executiveWeeklyReport],
                    ['execution-prohibited', 'Prohibited', executionBoard.copyPayloads.prohibitedActions],
                    ['execution-markdown', 'Markdown', executionBoard.copyPayloads.markdown],
                    ['execution-tsv', 'TSV', executionBoard.copyPayloads.tsv],
                  ].map(([key, label, text]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => void copyActivationRunbookPayload(key, text)}
                      className="inline-flex min-h-9 items-center justify-center rounded-xl border border-slate-300 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      {copiedRunbookKey === key ? '복사됨' : label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                <MetricCard label="현재 단계" value={executionBoard.summary.currentStage} help="snapshot stage" compact />
                <MetricCard label="open actions" value={executionBoard.summary.totalOpenActionCount.toLocaleString()} help="DONE 제외" compact />
                <MetricCard label="P0 / P1 / P2" value={`${executionBoard.summary.p0Count}/${executionBoard.summary.p1Count}/${executionBoard.summary.p2Count}`} help="priority" compact variant={executionBoard.summary.p0Count > 0 ? 'warning' : 'default'} />
                <MetricCard label="HR / 리더 / 직원 / DEV" value={`${executionBoard.summary.hrActionCount}/${executionBoard.summary.leaderActionCount}/${executionBoard.summary.employeeActionCount}/${executionBoard.summary.developerWatchActionCount}`} help="owner group" compact />
                <MetricCard label="blocked / ready / watch" value={`${executionBoard.summary.blockedActionCount}/${executionBoard.summary.readyToStartActionCount}/${executionBoard.summary.watchOnlyActionCount}`} help="status" compact variant={executionBoard.summary.blockedActionCount > 0 ? 'warning' : 'default'} />
                <MetricCard label="baseline" value={executionBoard.summary.lastBaselineTimestamp ?? 'export-only'} help={executionBoard.summary.lastReviewedTimestamp ?? 'last reviewed 없음'} compact variant="muted" />
              </div>

              <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h5 className="text-sm font-semibold text-blue-950">Baseline snapshot support</h5>
                    <p className="mt-1 text-sm leading-6 text-blue-900">{executionBoard.baselineSnapshot.guidance}</p>
                  </div>
                  <Badge tone="neutral">save button 없음</Badge>
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-3">
                  <div className="rounded-xl border border-blue-100 bg-white px-3 py-2">
                    <p className="text-xs font-semibold text-slate-500">snapshot timestamp</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{executionBoard.baselineSnapshot.timestamp}</p>
                  </div>
                  <div className="rounded-xl border border-blue-100 bg-white px-3 py-2">
                    <p className="text-xs font-semibold text-slate-500">metadata tracking</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {executionBoard.metadataTracking.enabled ? 'enabled' : 'export-only'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-blue-100 bg-white px-3 py-2">
                    <p className="text-xs font-semibold text-slate-500">delta</p>
                    <p className="mt-1 text-sm leading-5 text-slate-700">{executionBoard.baselineSnapshot.deltaFromPreviousBaseline[0]}</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {[
                  ['ALL', '전체'],
                  ['THIS_WEEK', '이번 주 집중'],
                  ['HR', 'HR'],
                  ['LEADER', '리더'],
                  ['EMPLOYEE', '직원'],
                  ['DEV', '개발/모니터링'],
                  ['DONE_HOLD', '완료/보류'],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setExecutionBoardTab(key as typeof executionBoardTab)}
                    className={`inline-flex min-h-9 items-center justify-center rounded-xl border px-3 text-xs font-semibold transition ${
                      executionBoardTab === key
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
                {executionBoardActions.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={getReadinessActionPriorityTone2026(item.priority)}>{item.priority}</Badge>
                      <Badge tone="neutral">{item.ownerGroup}</Badge>
                      <Badge tone={getReadinessActionStatusTone2026(item.status)}>{item.status}</Badge>
                    </div>
                    <p className="mt-3 text-sm font-semibold leading-5 text-slate-900">{item.title}</p>
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      {item.sourcePanel} · {item.relatedRoute}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{item.reason}</p>
                    <div className="mt-3 rounded-xl border border-slate-100 bg-white px-3 py-2">
                      <p className="text-xs font-semibold text-slate-500">blocker</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {item.relatedBlockerCount == null ? '미확인' : `${item.relatedBlockerCount.toLocaleString()}건`}
                      </p>
                    </div>
                    <p className="mt-3 text-xs leading-5 text-slate-500">{item.suggestedNextStep}</p>
                    {item.suggestedCommunicationCopy ? (
                      <button
                        type="button"
                        onClick={() => void copyActivationRunbookPayload(`execution-copy-${item.id}`, item.suggestedCommunicationCopy ?? '')}
                        className="mt-3 inline-flex min-h-8 items-center justify-center rounded-xl border border-slate-300 px-3 text-xs font-semibold text-slate-700 transition hover:bg-white"
                      >
                        {copiedRunbookKey === `execution-copy-${item.id}` ? '복사됨' : 'communication copy'}
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h5 className="text-sm font-semibold text-slate-900">Filters available</h5>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[
                      ...executionBoard.filters.ownerGroups,
                      ...executionBoard.filters.priorities,
                      ...executionBoard.filters.statuses,
                      ...executionBoard.filters.actionTypes.slice(0, 8),
                    ].map((filter) => (
                      <Badge key={filter} tone="neutral">{filter}</Badge>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h5 className="text-sm font-semibold text-slate-900">HR communication package</h5>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {executionBoard.communicationTemplates.map((template) => (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => void copyActivationRunbookPayload(`comm-${template.id}`, template.copy)}
                        className="inline-flex min-h-8 items-center justify-center rounded-xl border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        {copiedRunbookKey === `comm-${template.id}` ? '복사됨' : template.title}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h5 className="text-sm font-semibold text-slate-900">Metadata design note</h5>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{executionBoard.metadataTracking.reason}</p>
                </div>
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <h5 className="text-sm font-semibold text-slate-900">Executive weekly report</h5>
                  <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-600">{executionBoard.executiveWeeklyReportText}</p>
                </div>
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                  <h5 className="text-sm font-semibold text-rose-950">Prohibited actions</h5>
                  <p className="mt-2 text-sm leading-6 text-rose-900">{executionBoard.prohibitedActions.join(', ')}</p>
                </div>
              </div>
            </div>
          ) : null}

          {fastForwardOperationsCockpit ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-semibold text-slate-900">2026 Fast-Forward Operations Cockpit</h4>
                    <Badge tone="neutral">{fastForwardOperationsCockpit.mode}</Badge>
                    <Badge tone={fastForwardOperationsCockpit.fastForwardSummary.officialActivationStatus === 'BLOCKED' ? 'warn' : 'neutral'}>
                      {fastForwardOperationsCockpit.fastForwardSummary.officialActivationStatus}
                    </Badge>
                    <Badge tone="neutral">copy/export only</Badge>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    이 화면은 2026 평가 운영을 병렬로 앞당기기 위한 read-only 실행 지도입니다.
                    backfill, 공식 점수, 공식 등급, feature flag, Evaluation.totalScore, Evaluation.gradeId는 실행하지 않습니다.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    ['fast-forward-summary', 'Fast-forward summary', fastForwardOperationsCockpit.copyPayloads.fastForwardSummary],
                    ['fast-forward-critical-path', 'Critical path', fastForwardOperationsCockpit.copyPayloads.criticalPath],
                    ['fast-forward-quick-wins', 'Quick wins', fastForwardOperationsCockpit.copyPayloads.quickWins],
                    ['fast-forward-owner-queues', 'Owner action queues', fastForwardOperationsCockpit.copyPayloads.ownerActionQueues],
                    ['fast-forward-safe-path', 'Minimum safe path', fastForwardOperationsCockpit.copyPayloads.minimumSafePath],
                    ['fast-forward-prohibited', 'Prohibited actions', fastForwardOperationsCockpit.copyPayloads.prohibitedActions],
                    ['fast-forward-full', 'Full operations plan', fastForwardOperationsCockpit.copyPayloads.fullOperationsPlan],
                    ['fast-forward-markdown', 'Markdown', fastForwardOperationsCockpit.copyPayloads.markdown],
                    ['fast-forward-tsv', 'TSV', fastForwardOperationsCockpit.copyPayloads.tsv],
                  ].map(([key, label, text]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => void copyActivationRunbookPayload(key, text)}
                      className="inline-flex min-h-9 items-center justify-center rounded-xl border border-slate-300 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      {copiedRunbookKey === key ? '복사됨' : label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                <MetricCard label="current stage" value={fastForwardOperationsCockpit.fastForwardSummary.currentStage} help="readiness stage" compact />
                <MetricCard label="overall status" value={fastForwardOperationsCockpit.fastForwardSummary.overallReadinessStatus} help="snapshot status" compact />
                <MetricCard label="official activation" value={fastForwardOperationsCockpit.fastForwardSummary.officialActivationStatus} help="activation gate" compact variant={fastForwardOperationsCockpit.fastForwardSummary.officialActivationStatus === 'BLOCKED' ? 'warning' : 'default'} />
                <MetricCard label="parallel / blocked" value={`${fastForwardOperationsCockpit.fastForwardSummary.parallelWorkstreamCount}/${fastForwardOperationsCockpit.fastForwardSummary.blockedWorkstreamCount}`} help="workstreams" compact />
                <MetricCard label="quick wins" value={fastForwardOperationsCockpit.fastForwardSummary.quickWinCount.toLocaleString()} help={fastForwardOperationsCockpit.fastForwardSummary.fastestSafeNextProcess} compact />
                <MetricCard label="critical path" value={fastForwardOperationsCockpit.fastForwardSummary.criticalPathItemCount.toLocaleString()} help={fastForwardOperationsCockpit.fastForwardSummary.nextCheckpointCondition} compact variant="warning" />
              </div>

              <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4">
                <h5 className="text-sm font-semibold text-blue-950">Korean operations plan</h5>
                <p className="mt-3 text-sm leading-6 text-blue-900">{fastForwardOperationsCockpit.operationsPlanText}</p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-blue-100 bg-white px-3 py-2">
                    <p className="text-xs font-semibold text-slate-500">current bottleneck</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{fastForwardOperationsCockpit.fastForwardSummary.currentBottleneck}</p>
                  </div>
                  <div className="rounded-xl border border-blue-100 bg-white px-3 py-2">
                    <p className="text-xs font-semibold text-slate-500">fastest safe next process</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{fastForwardOperationsCockpit.fastForwardSummary.fastestSafeNextProcess}</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h5 className="text-sm font-semibold text-slate-900">Parallel workstreams</h5>
                  <div className="mt-3 grid gap-3">
                    {fastForwardOperationsCockpit.parallelWorkstreams.map((workstream) => (
                      <div key={workstream.id} className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone="neutral">{workstream.status}</Badge>
                          {workstream.owners.map((owner) => <Badge key={owner} tone="neutral">{owner}</Badge>)}
                        </div>
                        <p className="mt-2 text-sm font-semibold text-slate-900">{workstream.title}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">{workstream.relatedRoutes.join(', ')}</p>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{workstream.expectedOutput}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {workstream.inputs.slice(0, 3).map((input) => (
                            <span key={`${workstream.id}-${input.label}`} className="rounded-lg border border-slate-100 bg-slate-50 px-2 py-1 text-xs text-slate-600">
                              {input.label}: {typeof input.value === 'number' ? input.value.toLocaleString() : input.value ?? '미확인'}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <h5 className="text-sm font-semibold text-amber-950">Blocked / later workstreams</h5>
                  <div className="mt-3 grid gap-3">
                    {fastForwardOperationsCockpit.blockedWorkstreams.map((workstream) => (
                      <div key={workstream.id} className="rounded-xl border border-amber-100 bg-white px-3 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone="warn">{workstream.status}</Badge>
                          {workstream.owners.map((owner) => <Badge key={owner} tone="neutral">{owner}</Badge>)}
                        </div>
                        <p className="mt-2 text-sm font-semibold text-slate-900">{workstream.title}</p>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{workstream.blockedReason ?? workstream.expectedOutput}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                <h5 className="text-sm font-semibold text-slate-900">Critical path</h5>
                <div className="mt-3 overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                      <tr>
                        <th className="px-3 py-2">order</th>
                        <th className="px-3 py-2">item</th>
                        <th className="px-3 py-2">status</th>
                        <th className="px-3 py-2">owner</th>
                        <th className="px-3 py-2">next action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {fastForwardOperationsCockpit.criticalPath.map((item) => (
                        <tr key={item.order}>
                          <td className="px-3 py-2 font-semibold text-slate-700">{item.order}</td>
                          <td className="px-3 py-2 font-semibold text-slate-900">{item.title}</td>
                          <td className="px-3 py-2 text-slate-600">{item.status}</td>
                          <td className="px-3 py-2 text-slate-600">{item.owner}</td>
                          <td className="px-3 py-2 text-slate-600">{item.nextAction}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h5 className="text-sm font-semibold text-slate-900">Quick wins</h5>
                  <div className="mt-3 grid gap-3">
                    {fastForwardOperationsCockpit.quickWins.map((item) => (
                      <div key={item.id} className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                          <Badge tone="neutral">{item.owner}</Badge>
                        </div>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          blocker {formatIntegratedSnapshotCount2026(item.blockerCount)} · {item.route}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{item.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <h5 className="text-sm font-semibold text-slate-900">Minimum safe path to backfill dry-run review</h5>
                  <div className="mt-3 grid gap-2">
                    {fastForwardOperationsCockpit.minimumSafePathToBackfillDryRunReview.map((item) => (
                      <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                          <Badge tone={item.status === 'DONE' ? 'success' : item.status === 'READY_FOR_REVIEW' ? 'neutral' : 'warn'}>{item.status}</Badge>
                        </div>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          blocker {formatIntegratedSnapshotCount2026(item.blockerCount)} · {item.nextAction}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-4">
                {[
                  ['HR', fastForwardOperationsCockpit.ownerActionQueues.hr],
                  ['Leader', fastForwardOperationsCockpit.ownerActionQueues.leader],
                  ['Employee', fastForwardOperationsCockpit.ownerActionQueues.employee],
                  ['Developer / Watch', fastForwardOperationsCockpit.ownerActionQueues.developer],
                ].map(([label, items]) => (
                  <div key={label as string} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <h5 className="text-sm font-semibold text-slate-900">{label as string} action queue</h5>
                    <div className="mt-3 space-y-2">
                      {(items as typeof fastForwardOperationsCockpit.ownerActionQueues.hr).map((item) => (
                        <div key={`${label}-${item.title}`} className="rounded-xl border border-slate-100 bg-white px-3 py-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge tone={getReadinessActionPriorityTone2026(item.priority)}>{item.priority}</Badge>
                            <span className="text-xs text-slate-400">{formatIntegratedSnapshotCount2026(item.blockerCount)}건</span>
                          </div>
                          <p className="mt-2 text-sm font-semibold leading-5 text-slate-900">{item.title}</p>
                          <p className="mt-1 text-xs leading-5 text-slate-500">{item.route} · {item.dependency}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h5 className="text-sm font-semibold text-slate-900">Dependency map</h5>
                  <div className="mt-3 space-y-2">
                    {fastForwardOperationsCockpit.dependencyMap.map((item) => (
                      <div key={`${item.from}-${item.to}`} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                        <p className="text-sm font-semibold text-slate-900">{item.from} → {item.to}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">{item.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h5 className="text-sm font-semibold text-slate-900">Route action map</h5>
                  <div className="mt-3 space-y-2">
                    {fastForwardOperationsCockpit.routeActionMap.map((item) => (
                      <div key={item.route} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                        <p className="text-sm font-semibold text-slate-900">{item.route}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">{item.actions.join(', ')}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                  <h5 className="text-sm font-semibold text-rose-950">Prohibited actions</h5>
                  <p className="mt-2 text-sm leading-6 text-rose-900">{fastForwardOperationsCockpit.prohibitedActions.join(', ')}</p>
                  <p className="mt-3 text-xs leading-5 text-rose-800">{fastForwardOperationsCockpit.metadataTracking.reason}</p>
                </div>
              </div>
            </div>
          ) : null}

          {backfillDryRunPreflightPack ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-semibold text-slate-900">2026 Backfill Dry-run Preflight Pack</h4>
                    <Badge tone="neutral">{backfillDryRunPreflightPack.mode}</Badge>
                    <Badge tone={backfillDryRunPreflightPack.preflightSummary.backfillDryRunReviewStatus === 'BLOCKED' ? 'warn' : 'neutral'}>
                      dry-run {backfillDryRunPreflightPack.preflightSummary.backfillDryRunReviewStatus}
                    </Badge>
                    <Badge tone="warn">apply {backfillDryRunPreflightPack.preflightSummary.backfillApplyStatus}</Badge>
                    <Badge tone="neutral">text-only command reference</Badge>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    이 화면은 backfill dry-run 검토를 준비하기 위한 읽기 전용 preflight입니다.
                    dry-run, apply, 공식 점수, 공식 등급, feature flag, Evaluation.totalScore, Evaluation.gradeId는 실행하지 않습니다.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    ['backfill-preflight-summary', 'Preflight summary', backfillDryRunPreflightPack.copyPayloads.preflightSummary],
                    ['backfill-preflight-preconditions', 'Preconditions', backfillDryRunPreflightPack.copyPayloads.preconditionsChecklist],
                    ['backfill-preflight-command', 'Dry-run command reference', backfillDryRunPreflightPack.copyPayloads.dryRunCommandReference],
                    ['backfill-preflight-output', 'Expected output', backfillDryRunPreflightPack.copyPayloads.expectedOutputChecklist],
                    ['backfill-preflight-backup', 'DB backup', backfillDryRunPreflightPack.copyPayloads.dbBackupChecklist],
                    ['backfill-preflight-hr', 'HR approval', backfillDryRunPreflightPack.copyPayloads.hrApprovalChecklist],
                    ['backfill-preflight-dev', 'Developer checklist', backfillDryRunPreflightPack.copyPayloads.developerExecutionChecklist],
                    ['backfill-preflight-prohibited', 'Prohibited actions', backfillDryRunPreflightPack.copyPayloads.prohibitedActions],
                    ['backfill-preflight-markdown', 'Markdown', backfillDryRunPreflightPack.copyPayloads.markdown],
                    ['backfill-preflight-tsv', 'TSV', backfillDryRunPreflightPack.copyPayloads.tsv],
                  ].map(([key, label, text]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => void copyActivationRunbookPayload(key, text)}
                      className="inline-flex min-h-9 items-center justify-center rounded-xl border border-slate-300 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      {copiedRunbookKey === key ? '복사됨' : label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                <MetricCard label="current stage" value={backfillDryRunPreflightPack.preflightSummary.currentStage} help="readiness stage" compact />
                <MetricCard label="overall status" value={backfillDryRunPreflightPack.preflightSummary.overallReadinessStatus} help="snapshot status" compact />
                <MetricCard label="official activation" value={backfillDryRunPreflightPack.preflightSummary.officialActivationStatus} help="gate status" compact variant={backfillDryRunPreflightPack.preflightSummary.officialActivationStatus === 'BLOCKED' ? 'warning' : 'default'} />
                <MetricCard label="dry-run review" value={backfillDryRunPreflightPack.preflightSummary.backfillDryRunReviewStatus} help="preflight status" compact variant={backfillDryRunPreflightPack.preflightSummary.backfillDryRunReviewStatus === 'BLOCKED' ? 'warning' : 'default'} />
                <MetricCard label="apply status" value={backfillDryRunPreflightPack.preflightSummary.backfillApplyStatus} help="apply remains blocked" compact variant="warning" />
                <MetricCard label="blockers / missing" value={`${backfillDryRunPreflightPack.preflightSummary.blockerCount.toLocaleString()}/${backfillDryRunPreflightPack.preflightSummary.missingPreconditionsCount.toLocaleString()}`} help="preconditions" compact variant={backfillDryRunPreflightPack.preflightSummary.missingPreconditionsCount > 0 ? 'warning' : 'default'} />
                <MetricCard label="DB backup" value={backfillDryRunPreflightPack.preflightSummary.dbBackupStatus} help="external confirmation only" compact variant="warning" />
                <MetricCard label="HR approval" value={backfillDryRunPreflightPack.preflightSummary.hrApprovalStatus} help="dry-run review only" compact variant="warning" />
                <MetricCard label="official flags" value={backfillDryRunPreflightPack.preflightSummary.officialFlagsStatus} help="must remain false" compact variant="warning" />
                {dryRunOutputReviewTemplate ? (
                  <MetricCard label="review template" value={dryRunOutputReviewTemplate.templateStatus} help="local-only output review" compact />
                ) : null}
                <MetricCard label="next preflight action" value={backfillDryRunPreflightPack.preflightSummary.nextPreflightAction} help="no UI execution" compact variant="muted" />
              </div>

              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <h5 className="text-sm font-semibold text-amber-950">Command templates are text only</h5>
                <p className="mt-2 text-xs leading-5 text-amber-800">
                  복사 전용 참고문이며 UI에서 dry-run, apply, backfill --apply를 실행하지 않습니다.
                  Production apply command must not be placed in UI.
                </p>
                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  {backfillDryRunPreflightPack.commandTemplates.map((command) => (
                    <div key={command.id} className="rounded-xl border border-amber-200 bg-white p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900">{command.label}</p>
                        <Badge tone="neutral">{command.mode}</Badge>
                        <Badge tone={command.executeAvailable ? 'error' : 'neutral'}>
                          executeAvailable {String(command.executeAvailable)}
                        </Badge>
                      </div>
                      <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-950 p-3 text-xs leading-5 text-slate-50">{command.commandText}</pre>
                      <p className="mt-2 text-xs leading-5 text-amber-800">{command.warning}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h5 className="text-sm font-semibold text-slate-900">Preconditions checklist</h5>
                  <div className="mt-3 grid gap-2 lg:grid-cols-2">
                    {backfillDryRunPreflightPack.preconditionsChecklist.map((item) => (
                      <div key={item.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={item.status === 'READY_FOR_REVIEW' ? 'success' : item.status === 'READY_LATER' ? 'neutral' : 'warn'}>{item.status}</Badge>
                          <span className="text-sm font-semibold text-slate-900">{item.label}</span>
                        </div>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          blocker {item.sourceBlockerCount == null ? '미확인' : item.sourceBlockerCount.toLocaleString()} · {item.relatedRoute}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-slate-600">{item.nextAction}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <h5 className="text-sm font-semibold text-slate-900">Expected dry-run output checklist</h5>
                    <div className="mt-3 space-y-2">
                      {backfillDryRunPreflightPack.expectedOutputChecklist.map((item) => (
                        <div key={item.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                          <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                          <p className="mt-1 text-xs leading-5 text-slate-500">{item.expectedReview}</p>
                          <p className="mt-1 text-xs font-semibold text-slate-700">required: {item.requiredValue}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                    <h5 className="text-sm font-semibold text-rose-950">Prohibited actions</h5>
                    <p className="mt-2 text-sm leading-6 text-rose-900">{backfillDryRunPreflightPack.prohibitedActions.join(', ')}</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-4">
                {[
                  ['DB backup checklist', backfillDryRunPreflightPack.backupChecklist],
                  ['HR approval checklist', backfillDryRunPreflightPack.hrApprovalChecklist],
                  ['Developer execution checklist', backfillDryRunPreflightPack.developerExecutionChecklist],
                  ['Post-check checklist', backfillDryRunPreflightPack.postCheckChecklist],
                ].map(([title, items]) => (
                  <div key={title as string} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <h5 className="text-sm font-semibold text-slate-900">{title as string}</h5>
                    <ul className="mt-3 space-y-2 text-xs leading-5 text-slate-600">
                      {(items as string[]).map((item) => <li key={item}>- {item}</li>)}
                    </ul>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <h5 className="text-sm font-semibold text-slate-900">Existing dry-run/apply surface found</h5>
                <div className="mt-3 grid gap-3 lg:grid-cols-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">dry-run scripts</p>
                    <ul className="mt-2 space-y-1 text-xs leading-5 text-slate-600">
                      {backfillDryRunPreflightPack.existingSurface.existingDryRunScripts.map((item) => <li key={item}>- {item}</li>)}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">apply surface</p>
                    <ul className="mt-2 space-y-1 text-xs leading-5 text-slate-600">
                      {backfillDryRunPreflightPack.existingSurface.existingApplyScripts.map((item) => <li key={item}>- {item}</li>)}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">safe separation</p>
                    <p className="mt-2 text-xs leading-5 text-slate-600">
                      dry-run only without writes: {String(backfillDryRunPreflightPack.existingSurface.dryRunOnlyWithoutWritesAvailable)}
                      <br />
                      apply separated from dry-run: {String(backfillDryRunPreflightPack.existingSurface.applySeparatedFromDryRun)}
                      <br />
                      totalScore write: {String(backfillDryRunPreflightPack.existingSurface.writesTotalScore)}
                      <br />
                      gradeId write: {String(backfillDryRunPreflightPack.existingSurface.writesGradeId)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {dryRunOutputReviewTemplate ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-semibold text-slate-900">2026 Dry-run Output Review Template</h4>
                    <Badge tone="neutral">{dryRunOutputReviewTemplate.mode}</Badge>
                    <Badge tone="neutral">{dryRunOutputReviewTemplate.templateStatus}</Badge>
                    <Badge tone="neutral">local-only paste helper</Badge>
                    <Badge tone="warn">apply {dryRunOutputReviewTemplate.templateSummary.applyStatus}</Badge>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    이 화면은 향후 dry-run 결과를 검토하기 위한 읽기 전용 템플릿입니다.
                    dry-run, apply, backfill, 공식 점수, 공식 등급, feature flag, Evaluation.totalScore, Evaluation.gradeId는 실행하지 않습니다.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    ['dryrun-output-template', 'Dry-run review template', dryRunOutputReviewTemplate.copyPayloads.reviewTemplate],
                    ['dryrun-output-must-pass', 'Must-pass criteria', dryRunOutputReviewTemplate.copyPayloads.mustPassCriteria],
                    ['dryrun-output-red-flags', 'Red flags', dryRunOutputReviewTemplate.copyPayloads.redFlags],
                    ['dryrun-output-hr', 'HR review checklist', dryRunOutputReviewTemplate.copyPayloads.hrReviewChecklist],
                    ['dryrun-output-dev', 'Developer review checklist', dryRunOutputReviewTemplate.copyPayloads.developerReviewChecklist],
                    ['dryrun-output-decision', 'Decision outcome guide', dryRunOutputReviewTemplate.copyPayloads.decisionOutcomeGuide],
                    ['dryrun-output-next-action', 'Next action mapping', dryRunOutputReviewTemplate.copyPayloads.nextActionMapping],
                    ['dryrun-output-markdown', 'Markdown', dryRunOutputReviewTemplate.copyPayloads.markdown],
                    ['dryrun-output-tsv', 'TSV', dryRunOutputReviewTemplate.copyPayloads.tsv],
                  ].map(([key, label, text]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => void copyActivationRunbookPayload(key, text)}
                      className="inline-flex min-h-9 items-center justify-center rounded-xl border border-slate-300 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      {copiedRunbookKey === key ? '복사됨' : label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                <MetricCard label="current stage" value={dryRunOutputReviewTemplate.templateSummary.currentStage} help="readiness stage" compact />
                <MetricCard label="overall status" value={dryRunOutputReviewTemplate.templateSummary.overallReadinessStatus} help="snapshot status" compact />
                <MetricCard label="official activation" value={dryRunOutputReviewTemplate.templateSummary.officialActivationStatus} help="gate status" compact variant={dryRunOutputReviewTemplate.templateSummary.officialActivationStatus === 'BLOCKED' ? 'warning' : 'default'} />
                <MetricCard label="preflight status" value={dryRunOutputReviewTemplate.templateSummary.preflightStatus} help="dry-run output is future input" compact variant={dryRunOutputReviewTemplate.templateSummary.preflightStatus === 'BLOCKED' ? 'warning' : 'default'} />
                <MetricCard label="paste helper" value={dryRunOutputReviewTemplate.templateSummary.localOnlyPasteHelperStatus} help="no server submit/upload" compact />
                <MetricCard label="next review action" value={dryRunOutputReviewTemplate.templateSummary.nextReviewAction} help="review only" compact variant="muted" />
              </div>

              <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4">
                <h5 className="text-sm font-semibold text-blue-950">Local-only paste helper</h5>
                <p className="mt-2 text-xs leading-5 text-blue-900">
                  {dryRunOutputReviewTemplate.localOnlyPasteHelper.guidance}
                  {' '}serverSubmitAvailable {String(dryRunOutputReviewTemplate.localOnlyPasteHelper.serverSubmitAvailable)} ·
                  saveAvailable {String(dryRunOutputReviewTemplate.localOnlyPasteHelper.saveAvailable)} ·
                  uploadAvailable {String(dryRunOutputReviewTemplate.localOnlyPasteHelper.uploadAvailable)} ·
                  apiCallAvailable {String(dryRunOutputReviewTemplate.localOnlyPasteHelper.apiCallAvailable)} ·
                  persistenceAvailable {String(dryRunOutputReviewTemplate.localOnlyPasteHelper.persistenceAvailable)}
                </p>
                <textarea
                  value={dryRunOutputPasteText}
                  onChange={(event) => setDryRunOutputPasteText(event.target.value)}
                  rows={7}
                  placeholder='{"writesPerformed":false,"totalScoreChangesExpected":false,"gradeIdChangesExpected":false}'
                  className="mt-3 min-h-32 w-full rounded-xl border border-blue-200 bg-white p-3 text-xs leading-5 text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
                {dryRunOutputPasteReview ? (
                  <div className={`mt-3 rounded-xl border p-3 ${dryRunOutputPasteReview.ok ? 'border-blue-200 bg-white' : 'border-amber-200 bg-amber-50'}`}>
                    <p className={`text-xs font-semibold ${dryRunOutputPasteReview.ok ? 'text-blue-900' : 'text-amber-900'}`}>
                      {dryRunOutputPasteReview.message}
                    </p>
                    {dryRunOutputPasteReview.classification ? (
                      <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                        <p className="text-[11px] font-semibold text-slate-500">local-only classification</p>
                        <p className="mt-1 text-xs font-semibold text-slate-900">{dryRunOutputPasteReview.classification}</p>
                        {dryRunOutputPasteReview.redFlags?.length ? (
                          <p className="mt-1 text-xs leading-5 text-rose-700">
                            red flags: {dryRunOutputPasteReview.redFlags.join(', ')}
                          </p>
                        ) : (
                          <p className="mt-1 text-xs leading-5 text-emerald-700">red flags: none detected locally</p>
                        )}
                        {dryRunOutputPasteReview.nextActions?.length ? (
                          <p className="mt-1 text-xs leading-5 text-slate-600">
                            next: {dryRunOutputPasteReview.nextActions.join(' / ')}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                    {dryRunOutputPasteReview.fields.length ? (
                      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                        {dryRunOutputPasteReview.fields.map((field) => (
                          <div key={field.field} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                            <p className="text-[11px] font-semibold text-slate-500">{field.field}</p>
                            <p className="mt-1 break-words text-xs text-slate-700">{field.value}</p>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-2 text-xs leading-5 text-blue-800">
                    JSON 형식 dry-run output을 나중에 붙여넣으면 알려진 필드만 브라우저 local state에서 표시합니다.
                    붙여넣은 결과는 서버로 전송하지 않습니다.
                  </p>
                )}
              </div>

              {dryRunRehearsalGuardrails ? (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h5 className="text-sm font-semibold text-slate-900">2026 Dry-run Rehearsal &amp; Guardrails</h5>
                        <Badge tone="neutral">{dryRunRehearsalGuardrails.mode}</Badge>
                        <Badge tone="neutral">{dryRunRehearsalGuardrails.status}</Badge>
                        <Badge tone="warn">{dryRunRehearsalGuardrails.summary.applyStatus}</Badge>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-slate-600">
                        이 화면은 dry-run 결과 판독과 apply 가드레일을 사전 리허설하기 위한 읽기 전용 화면입니다.
                        dry-run, apply, backfill, 공식 점수/등급, feature flag 변경은 실행하지 않습니다.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {[
                        ['dryrun-rehearsal-inventory', 'Script inventory', dryRunRehearsalGuardrails.copyPayloads.scriptInventory],
                        ['dryrun-rehearsal-guardrails', 'Guardrail checklist', dryRunRehearsalGuardrails.copyPayloads.guardrailChecklist],
                        ['dryrun-rehearsal-fixtures', 'Fixture guide', dryRunRehearsalGuardrails.copyPayloads.fixtureRehearsalGuide],
                        ['dryrun-rehearsal-red-flags', 'Red flag matrix', dryRunRehearsalGuardrails.copyPayloads.redFlagMatrix],
                        ['dryrun-rehearsal-decisions', 'Decision guide', dryRunRehearsalGuardrails.copyPayloads.reviewerDecisionGuide],
                        ['dryrun-rehearsal-markdown', 'Markdown', dryRunRehearsalGuardrails.copyPayloads.markdown],
                        ['dryrun-rehearsal-tsv', 'TSV', dryRunRehearsalGuardrails.copyPayloads.tsv],
                      ].map(([key, label, text]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => void copyActivationRunbookPayload(key, text)}
                          className="inline-flex min-h-9 items-center justify-center rounded-xl border border-slate-300 px-3 text-xs font-semibold text-slate-700 transition hover:bg-white"
                        >
                          {copiedRunbookKey === key ? '복사됨' : label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                    <MetricCard label="scripts" value={dryRunRehearsalGuardrails.summary.scriptInventoryCount.toLocaleString()} help="surface inventory" compact />
                    <MetricCard label="apply capable" value={dryRunRehearsalGuardrails.summary.applyCapableScriptCount.toLocaleString()} help="guarded CLI only" compact variant="warning" />
                    <MetricCard label="fixtures" value={dryRunRehearsalGuardrails.summary.fixtureExampleCount.toLocaleString()} help="safe examples" compact />
                    <MetricCard label="reviewer" value={dryRunRehearsalGuardrails.summary.reviewerStatus} help="pure parser" compact />
                    <MetricCard label="paste validator" value={dryRunRehearsalGuardrails.summary.localOnlyPasteValidatorStatus} help="no server submit" compact />
                    <MetricCard label="official activation" value={dryRunRehearsalGuardrails.summary.officialActivationStatus} help="still blocked" compact variant="warning" />
                  </div>

                  <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <h6 className="text-sm font-semibold text-slate-900">Script surface inventory</h6>
                      <div className="mt-3 overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200 text-sm">
                          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                            <tr>
                              <th className="px-3 py-2">script</th>
                              <th className="px-3 py-2">dry-run</th>
                              <th className="px-3 py-2">apply</th>
                              <th className="px-3 py-2">writes</th>
                              <th className="px-3 py-2">safe use</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {dryRunRehearsalGuardrails.scriptSurfaceInventory.map((item) => (
                              <tr key={item.scriptName}>
                                <td className="px-3 py-2 font-semibold text-slate-900">{item.scriptName}</td>
                                <td className="px-3 py-2 text-slate-600">{item.dryRunAvailable ? 'yes' : 'no'}</td>
                                <td className="px-3 py-2 text-slate-600">{item.applyCapable ? item.applyTrigger : 'no'}</td>
                                <td className="px-3 py-2 text-slate-600">
                                  Evaluation {item.writesEvaluation} · Item {item.writesEvaluationItem} · totalScore {item.writesEvaluationTotalScore} · gradeId {item.writesEvaluationGradeId}
                                </td>
                                <td className="px-3 py-2 text-slate-600">{item.recommendedSafeUse}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                        <h6 className="text-sm font-semibold text-amber-950">Apply guardrail status</h6>
                        <div className="mt-3 grid gap-2">
                          {dryRunRehearsalGuardrails.applyGuardrailStatus.map((item) => (
                            <div key={item.id} className="rounded-xl border border-amber-100 bg-white px-3 py-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge tone={item.status === 'CONFIRMED_IN_CODE' ? 'success' : 'warn'}>{item.status}</Badge>
                                <span className="text-sm font-semibold text-slate-900">{item.label}</span>
                              </div>
                              <p className="mt-1 text-xs leading-5 text-slate-600">{item.evidence}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                        <h6 className="text-sm font-semibold text-blue-950">Local-only paste validator</h6>
                        <p className="mt-2 text-xs leading-5 text-blue-900">
                          {dryRunRehearsalGuardrails.localOnlyPasteValidator.guidance}
                          {' '}serverSubmitAvailable {String(dryRunRehearsalGuardrails.localOnlyPasteValidator.serverSubmitAvailable)} ·
                          saveAvailable {String(dryRunRehearsalGuardrails.localOnlyPasteValidator.saveAvailable)} ·
                          apiCallAvailable {String(dryRunRehearsalGuardrails.localOnlyPasteValidator.apiCallAvailable)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 xl:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <h6 className="text-sm font-semibold text-slate-900">Fixture rehearsal</h6>
                      <div className="mt-3 grid gap-2">
                        {dryRunRehearsalGuardrails.fixtureRehearsalExamples.map((item) => (
                          <div key={item.fileName} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                            <p className="text-sm font-semibold text-slate-900">{item.fileName}</p>
                            <p className="mt-1 text-xs leading-5 text-slate-500">{item.label}</p>
                            <p className="mt-1 text-xs font-semibold text-slate-700">{item.expectedClassification}</p>
                            <p className="mt-1 text-xs leading-5 text-rose-700">red flags: {item.expectedRedFlags.join(', ') || 'none'}</p>
                            <p className="mt-1 text-xs leading-5 text-slate-600">{item.nextAction}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                      <h6 className="text-sm font-semibold text-rose-950">Red flag matrix</h6>
                      <div className="mt-3 grid gap-2">
                        {dryRunRehearsalGuardrails.redFlagMatrix.map((item) => (
                          <div key={item.id} className="rounded-xl border border-rose-100 bg-white px-3 py-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge tone={item.severity === 'REJECT' ? 'error' : 'warn'}>{item.severity}</Badge>
                              <span className="text-sm font-semibold text-slate-900">{item.label}</span>
                            </div>
                            <p className="mt-1 text-xs leading-5 text-rose-800">{item.nextAction}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <h6 className="text-sm font-semibold text-slate-900">Reviewer decision guide</h6>
                      <div className="mt-3 grid gap-2">
                        {dryRunRehearsalGuardrails.reviewerDecisionGuide.map((item) => (
                          <div key={item.classification} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                            <p className="text-sm font-semibold text-slate-900">{item.classification}</p>
                            <p className="mt-1 text-xs leading-5 text-slate-500">{item.meaning}</p>
                            <p className="mt-1 text-xs leading-5 text-slate-600">{item.nextAction}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-rose-200 bg-white p-4">
                    <h6 className="text-sm font-semibold text-rose-950">Prohibited actions</h6>
                    <p className="mt-2 text-sm leading-6 text-rose-900">{dryRunRehearsalGuardrails.prohibitedActions.join(', ')}</p>
                  </div>
                </div>
              ) : null}

              {backfillDryRunCommandRunbook ? (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h5 className="text-sm font-semibold text-slate-900">2026 Backfill Dry-run Command Runbook</h5>
                        <Badge tone="neutral">{backfillDryRunCommandRunbook.mode}</Badge>
                        <Badge tone="neutral">{backfillDryRunCommandRunbook.status}</Badge>
                        <Badge tone="neutral">{backfillDryRunCommandRunbook.summary.commandReferenceStatus}</Badge>
                        <Badge tone="warn">apply {backfillDryRunCommandRunbook.summary.applyStatus}</Badge>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-slate-600">
                        이 화면은 향후 dry-run-only 실행 절차를 문서화합니다. 이 화면에서는 dry-run, apply, backfill,
                        공식 점수/등급, feature flag 변경을 실행하지 않습니다.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {[
                        ['dryrun-command-summary', 'Operator summary', backfillDryRunCommandRunbook.copyPayloads.operatorSummary],
                        ['dryrun-command-prerun', 'Pre-run checklist', backfillDryRunCommandRunbook.copyPayloads.preRunChecklist],
                        ['dryrun-command-reference', 'Dry-run command reference', backfillDryRunCommandRunbook.copyPayloads.dryRunCommandReference],
                        ['dryrun-command-logs', 'Log watch checklist', backfillDryRunCommandRunbook.copyPayloads.logWatchChecklist],
                        ['dryrun-command-abort', 'Abort conditions', backfillDryRunCommandRunbook.copyPayloads.abortConditions],
                        ['dryrun-command-handoff', 'Handoff checklist', backfillDryRunCommandRunbook.copyPayloads.handoffChecklist],
                        ['dryrun-command-markdown', 'Markdown', backfillDryRunCommandRunbook.copyPayloads.markdown],
                        ['dryrun-command-tsv', 'TSV', backfillDryRunCommandRunbook.copyPayloads.tsv],
                      ].map(([key, label, text]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => void copyActivationRunbookPayload(key, text)}
                          className="inline-flex min-h-9 items-center justify-center rounded-xl border border-slate-300 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          {copiedRunbookKey === key ? '복사됨' : label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                    <MetricCard label="current stage" value={backfillDryRunCommandRunbook.summary.currentStage} help="readiness stage" compact />
                    <MetricCard label="overall status" value={backfillDryRunCommandRunbook.summary.overallReadinessStatus} help="snapshot status" compact />
                    <MetricCard label="official activation" value={backfillDryRunCommandRunbook.summary.officialActivationStatus} help="gate status" compact variant="warning" />
                    <MetricCard label="dry-run command" value={backfillDryRunCommandRunbook.summary.commandReferenceStatus} help="text only" compact />
                    <MetricCard label="dry-run execution" value={backfillDryRunCommandRunbook.summary.dryRunExecutionStatus} help="not run" compact variant="warning" />
                    <MetricCard label="apply" value={backfillDryRunCommandRunbook.summary.applyStatus} help="hidden / prohibited" compact variant="warning" />
                  </div>

                  <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4">
                    <h6 className="text-sm font-semibold text-blue-950">Operator summary</h6>
                    <dl className="mt-3 grid gap-3 md:grid-cols-2">
                      {[
                        ['purpose', backfillDryRunCommandRunbook.operatorSummary.purpose],
                        ['current status', backfillDryRunCommandRunbook.operatorSummary.currentStatus],
                        ['when usable', backfillDryRunCommandRunbook.operatorSummary.whenThisRunbookCanBeUsed],
                        ['why apply prohibited', backfillDryRunCommandRunbook.operatorSummary.whyApplyRemainsProhibited],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-xl border border-blue-100 bg-white px-3 py-2">
                          <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-blue-500">{label}</dt>
                          <dd className="mt-1 text-xs leading-5 text-blue-950">{value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>

                  <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <h6 className="text-sm font-semibold text-slate-900">Pre-run checklist</h6>
                      <div className="mt-3 grid gap-2">
                        {backfillDryRunCommandRunbook.preRunChecklist.map((item) => (
                          <div key={item} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">{item}</div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                      <h6 className="text-sm font-semibold text-amber-950">Dry-run-only command reference</h6>
                      <p className="mt-2 text-xs leading-5 text-amber-900">
                        {backfillDryRunCommandRunbook.dryRunOnlyCommandReference.warning}
                      </p>
                      <pre className="mt-3 overflow-x-auto rounded-xl border border-amber-100 bg-white p-3 text-xs leading-5 text-slate-700">
                        {backfillDryRunCommandRunbook.dryRunOnlyCommandReference.commandText}
                      </pre>
                      <p className="mt-2 text-xs leading-5 text-amber-900">
                        mode {backfillDryRunCommandRunbook.dryRunOnlyCommandReference.mode} · copyOnly {String(backfillDryRunCommandRunbook.dryRunOnlyCommandReference.copyOnly)} ·
                        executeAvailable {String(backfillDryRunCommandRunbook.dryRunOnlyCommandReference.executeAvailable)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4">
                    <h6 className="text-sm font-semibold text-rose-950">Apply command warning</h6>
                    <p className="mt-2 text-xs leading-5 text-rose-900">
                      {backfillDryRunCommandRunbook.applyCommandWarning.warning}
                      {' '}applyCommandExposed {String(backfillDryRunCommandRunbook.applyCommandWarning.applyCommandExposed)} ·
                      applyIsPartOfThisRunbook {String(backfillDryRunCommandRunbook.applyCommandWarning.applyIsPartOfThisRunbook)}
                    </p>
                    <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                      {backfillDryRunCommandRunbook.applyCommandWarning.guardrailReminder.map((item) => (
                        <div key={item} className="rounded-xl border border-rose-100 bg-white px-3 py-2 text-xs text-rose-800">{item}</div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 xl:grid-cols-4">
                    {[
                      ['Output archive checklist', backfillDryRunCommandRunbook.outputArchiveChecklist],
                      ['Log watch checklist', backfillDryRunCommandRunbook.logWatchChecklist],
                      ['Abort conditions', backfillDryRunCommandRunbook.abortConditions],
                      ['Handoff checklist', backfillDryRunCommandRunbook.handoffChecklist],
                    ].map(([title, items]) => (
                      <div key={title as string} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <h6 className="text-sm font-semibold text-slate-900">{title as string}</h6>
                        <ul className="mt-3 space-y-2 text-xs leading-5 text-slate-700">
                          {(items as string[]).map((item) => <li key={item}>- {item}</li>)}
                        </ul>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 grid gap-4 xl:grid-cols-2">
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                      <h6 className="text-sm font-semibold text-emerald-950">Allowed commands</h6>
                      <ul className="mt-3 space-y-2 text-xs leading-5 text-emerald-900">
                        {backfillDryRunCommandRunbook.allowedCommands.map((item) => <li key={item}>- {item}</li>)}
                      </ul>
                    </div>
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                      <h6 className="text-sm font-semibold text-rose-950">Explicitly forbidden commands</h6>
                      <ul className="mt-3 space-y-2 text-xs leading-5 text-rose-900">
                        {backfillDryRunCommandRunbook.explicitlyForbiddenCommands.map((item) => <li key={item}>- {item}</li>)}
                      </ul>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-rose-200 bg-white p-4">
                    <h6 className="text-sm font-semibold text-rose-950">Prohibited actions</h6>
                    <p className="mt-2 text-sm leading-6 text-rose-900">{backfillDryRunCommandRunbook.prohibitedActions.join(', ')}</p>
                  </div>
                </div>
              ) : null}

              {dryRunGoNoGoFreezePack ? (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h5 className="text-sm font-semibold text-slate-900">2026 Dry-run Go/No-Go Freeze Pack</h5>
                        <Badge tone="neutral">{dryRunGoNoGoFreezePack.mode}</Badge>
                        <Badge tone={dryRunGoNoGoFreezePack.decision.currentDecision === 'READY_FOR_REVIEW' ? 'success' : 'warn'}>
                          {dryRunGoNoGoFreezePack.decision.currentDecision}
                        </Badge>
                        <Badge tone="warn">apply {dryRunGoNoGoFreezePack.decision.applyStatus}</Badge>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-slate-600">
                        이 화면은 future dry-run 검토 가능 여부를 읽기 전용으로 판정합니다. dry-run, apply, backfill,
                        공식 점수/등급, feature flag, Evaluation.totalScore, Evaluation.gradeId는 실행하지 않습니다.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {[
                        ['dryrun-freeze-summary', 'Go/No-Go summary', dryRunGoNoGoFreezePack.copyPayloads.goNoGoSummary],
                        ['dryrun-freeze-no-go', 'No-go reasons', dryRunGoNoGoFreezePack.copyPayloads.noGoReasons],
                        ['dryrun-freeze-go', 'Go conditions', dryRunGoNoGoFreezePack.copyPayloads.goConditions],
                        ['dryrun-freeze-evidence', 'Evidence pack', dryRunGoNoGoFreezePack.copyPayloads.requiredEvidencePack],
                        ['dryrun-freeze-hr', 'HR unlock actions', dryRunGoNoGoFreezePack.copyPayloads.hrUnlockActions],
                        ['dryrun-freeze-dev', 'Developer unlock actions', dryRunGoNoGoFreezePack.copyPayloads.developerUnlockActions],
                        ['dryrun-freeze-signoff', 'Sign-off checklist', dryRunGoNoGoFreezePack.copyPayloads.signOffChecklist],
                        ['dryrun-freeze-checkpoint', 'Next checkpoint', dryRunGoNoGoFreezePack.copyPayloads.nextCheckpoint],
                        ['dryrun-freeze-prohibited', 'Prohibited actions', dryRunGoNoGoFreezePack.copyPayloads.prohibitedActions],
                        ['dryrun-freeze-markdown', 'Markdown', dryRunGoNoGoFreezePack.copyPayloads.markdown],
                        ['dryrun-freeze-tsv', 'TSV', dryRunGoNoGoFreezePack.copyPayloads.tsv],
                      ].map(([key, label, text]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => void copyActivationRunbookPayload(key, text)}
                          className="inline-flex min-h-9 items-center justify-center rounded-xl border border-slate-300 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          {copiedRunbookKey === key ? '복사됨' : label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={dryRunGoNoGoFreezePack.decision.currentDecision === 'READY_FOR_REVIEW' ? 'success' : 'warn'}>
                        {dryRunGoNoGoFreezePack.decision.currentDecision}
                      </Badge>
                      <Badge tone="warn">apply {dryRunGoNoGoFreezePack.decision.applyStatus}</Badge>
                      <Badge tone="neutral">missing {dryRunGoNoGoFreezePack.decision.missingGoConditionsCount}</Badge>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-amber-950">{dryRunGoNoGoFreezePack.decision.explanationKo}</p>
                  </div>

                  <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                      <h6 className="text-sm font-semibold text-rose-950">No-go reasons</h6>
                      <div className="mt-3 grid gap-2">
                        {dryRunGoNoGoFreezePack.noGoReasons.map((item) => (
                          <div key={item.id} className="rounded-xl border border-rose-100 bg-white px-3 py-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-xs font-semibold text-rose-950">{item.label}</p>
                              <Badge tone={item.status === 'READY' ? 'success' : 'warn'}>{item.status}</Badge>
                            </div>
                            <p className="mt-1 text-xs leading-5 text-rose-700">
                              count {item.blockerCount ?? 'n/a'} · {item.source}
                            </p>
                            <p className="mt-1 text-xs leading-5 text-rose-800">{item.nextAction}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <h6 className="text-sm font-semibold text-slate-900">Go conditions</h6>
                      <div className="mt-3 grid gap-2">
                        {dryRunGoNoGoFreezePack.goConditions.map((item) => (
                          <div key={item.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-xs font-semibold text-slate-900">{item.label}</p>
                              <Badge tone={item.status === 'READY' ? 'success' : item.status === 'READY_LATER' ? 'neutral' : 'warn'}>{item.status}</Badge>
                            </div>
                            <p className="mt-1 text-xs leading-5 text-slate-500">
                              count {item.blockerCount ?? 'n/a'} · {item.source}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 xl:grid-cols-4">
                    {[
                      ['Required evidence pack', dryRunGoNoGoFreezePack.requiredEvidencePack],
                      ['HR unlock actions', dryRunGoNoGoFreezePack.hrUnlockActions],
                      ['Developer unlock actions', dryRunGoNoGoFreezePack.developerUnlockActions],
                      ['Sign-off checklist', dryRunGoNoGoFreezePack.signOffChecklist],
                    ].map(([title, items]) => (
                      <div key={title as string} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <h6 className="text-sm font-semibold text-slate-900">{title as string}</h6>
                        <ul className="mt-3 space-y-2 text-xs leading-5 text-slate-700">
                          {(items as string[]).map((item) => <li key={item}>- {item}</li>)}
                        </ul>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                      <h6 className="text-sm font-semibold text-blue-950">Next checkpoint</h6>
                      <p className="mt-2 text-xs leading-5 text-blue-900">{dryRunGoNoGoFreezePack.nextCheckpoint.name}</p>
                      <p className="mt-1 text-xs leading-5 text-blue-900">{dryRunGoNoGoFreezePack.nextCheckpoint.requiredBeforeAfterSnapshot}</p>
                      <p className="mt-1 text-xs leading-5 text-blue-900">owner: {dryRunGoNoGoFreezePack.nextCheckpoint.decisionOwner}</p>
                      <p className="mt-2 text-xs leading-5 text-blue-900">
                        delta: {dryRunGoNoGoFreezePack.nextCheckpoint.deltaTableRequired.join(', ')}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-rose-200 bg-white p-4">
                      <h6 className="text-sm font-semibold text-rose-950">Prohibited actions</h6>
                      <p className="mt-2 text-sm leading-6 text-rose-900">{dryRunGoNoGoFreezePack.prohibitedActions.join(', ')}</p>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h5 className="text-sm font-semibold text-slate-900">Review template sections</h5>
                  <div className="mt-3 grid gap-2">
                    {dryRunOutputReviewTemplate.reviewTemplateSections.map((section) => (
                      <div key={section.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                        <p className="text-sm font-semibold text-slate-900">{section.title}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">{section.description}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <h5 className="text-sm font-semibold text-slate-900">Expected output fields</h5>
                  <div className="mt-3 overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                      <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                        <tr>
                          <th className="px-3 py-2">field</th>
                          <th className="px-3 py-2">required</th>
                          <th className="px-3 py-2">review</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {[...dryRunOutputReviewTemplate.dryRunIdentityFields, ...dryRunOutputReviewTemplate.expectedOutputFields].map((item) => (
                          <tr key={item.id}>
                            <td className="px-3 py-2 font-semibold text-slate-900">{item.label}</td>
                            <td className="px-3 py-2 text-slate-600">{item.requiredValue}</td>
                            <td className="px-3 py-2 text-slate-600">{item.expectedReview}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <h5 className="text-sm font-semibold text-emerald-950">Must-pass criteria</h5>
                  <div className="mt-3 grid gap-2">
                    {dryRunOutputReviewTemplate.mustPassCriteria.map((item) => (
                      <div key={item.id} className="rounded-xl border border-emerald-100 bg-white px-3 py-2">
                        <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                        <p className="mt-1 text-xs leading-5 text-emerald-800">{item.reviewAction}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                  <h5 className="text-sm font-semibold text-rose-950">Red flags</h5>
                  <div className="mt-3 grid gap-2">
                    {dryRunOutputReviewTemplate.redFlagConditions.map((item) => (
                      <div key={item.id} className="rounded-xl border border-rose-100 bg-white px-3 py-2">
                        <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                        <p className="mt-1 text-xs leading-5 text-rose-800">{item.reviewAction}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-3">
                {[
                  ['HR review checklist', dryRunOutputReviewTemplate.hrReviewChecklist],
                  ['Developer review checklist', dryRunOutputReviewTemplate.developerReviewChecklist],
                  ['Post-dry-run log watch checklist', dryRunOutputReviewTemplate.postDryRunLogWatchChecklist],
                ].map(([title, items]) => (
                  <div key={title as string} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <h5 className="text-sm font-semibold text-slate-900">{title as string}</h5>
                    <ul className="mt-3 space-y-2 text-xs leading-5 text-slate-600">
                      {(items as string[]).map((item) => <li key={item}>- {item}</li>)}
                    </ul>
                  </div>
                ))}
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h5 className="text-sm font-semibold text-slate-900">Decision outcomes</h5>
                  <div className="mt-3 grid gap-2">
                    {dryRunOutputReviewTemplate.decisionOutcomes.map((item) => (
                      <div key={item.code} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                        <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">{item.meaning}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-600">{item.nextAction}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <h5 className="text-sm font-semibold text-slate-900">Next action mapping</h5>
                  <div className="mt-3 grid gap-2">
                    {dryRunOutputReviewTemplate.nextActionMapping.map((item) => (
                      <div key={`${item.condition}-${item.route}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                        <p className="text-sm font-semibold text-slate-900">{item.condition}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">{item.route}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-600">{item.nextAction}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4">
                <h5 className="text-sm font-semibold text-rose-950">Prohibited actions</h5>
                <p className="mt-2 text-sm leading-6 text-rose-900">{dryRunOutputReviewTemplate.prohibitedActions.join(', ')}</p>
              </div>
            </div>
          ) : null}

          {scenarioSimulator && scenarioPreview && scenarioInputValues ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-semibold text-slate-900">2026 Readiness Scenario Simulator</h4>
                    <Badge tone="neutral">read-only</Badge>
                    <Badge tone="warn">official activation BLOCKED</Badge>
                    <Badge tone="neutral">local UI state only</Badge>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    이 화면은 blocker 감소 효과를 가정해 보는 read-only 시뮬레이터입니다.
                    실제 데이터 저장, backfill, 공식 점수/등급, feature flag 변경은 수행하지 않습니다.
                  </p>
                  <p className="mt-2 text-xs leading-5 text-amber-700">{scenarioSimulator.disclaimer}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    ['scenario-summary', 'Scenario summary', scenarioPreview.reportText],
                    ['scenario-action', 'Projected action plan', `next HR action: ${scenarioPreview.nextHrAction}\nprojected stage: ${scenarioPreview.projectedStage}\nprojected status: ${scenarioPreview.projectedStatus}\nofficial activation: BLOCKED`],
                    ['scenario-markdown', 'Markdown', scenarioPreview.markdown],
                    ['scenario-tsv', 'TSV', scenarioPreview.tsv],
                    ['scenario-prohibited', 'Prohibited', scenarioSimulator.copyPayloads.prohibitedActions],
                  ].map(([key, label, text]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => void copyActivationRunbookPayload(key, text)}
                      className="inline-flex min-h-9 items-center justify-center rounded-xl border border-slate-300 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      {copiedRunbookKey === key ? '복사됨' : label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                <MetricCard label="baseline MBO missing" value={formatIntegratedSnapshotCount2026(scenarioSimulator.baselineCounts.missingMboCount)} help="현재 snapshot" compact />
                <MetricCard label="projected MBO missing" value={formatIntegratedSnapshotCount2026(scenarioPreview.projectedCounts.missingMboCount)} help="시나리오 반영" compact variant={numericScenarioValue2026(scenarioPreview.projectedCounts.missingMboCount) > 0 ? 'warning' : 'default'} />
                <MetricCard label="baseline Team KPI" value={formatIntegratedSnapshotCount2026(scenarioSimulator.baselineCounts.teamKpiPendingCount)} help="pending/discussion" compact />
                <MetricCard label="projected Team KPI" value={formatIntegratedSnapshotCount2026(scenarioPreview.projectedCounts.teamKpiPendingCount)} help="시나리오 반영" compact />
                <MetricCard label="official gate" value={formatIntegratedSnapshotCount2026(scenarioPreview.projectedCounts.officialActivationGateBlockerCount)} help={`estimated potential ${formatIntegratedSnapshotCount2026(scenarioPreview.projectedCounts.estimatedOfficialGateBlockerCount)}`} compact variant="warning" />
                <MetricCard label="projected stage" value={scenarioPreview.projectedStage} help={scenarioPreview.projectedStatus} compact />
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h5 className="text-sm font-semibold text-slate-900">Scenario presets</h5>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {scenarioSimulator.presets.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setScenarioState({
                          presetId: preset.id,
                          inputs: preset.input,
                          sourceKey: autoLoadKey,
                        })}
                        className={`inline-flex min-h-9 items-center justify-center rounded-xl border px-3 text-xs font-semibold transition ${
                          scenarioState.presetId === preset.id
                            ? 'border-slate-900 bg-slate-900 text-white'
                            : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {preset.name}
                      </button>
                    ))}
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {selectedScenarioPreset?.description ?? 'Manual scenario'}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h5 className="text-sm font-semibold text-slate-900">Manual scenario inputs</h5>
                  <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {SCENARIO_INPUT_FIELDS_2026.map((field) => (
                      <label key={field.key} className="block rounded-xl border border-slate-200 bg-white p-3">
                        <span className="text-xs font-semibold text-slate-600">{field.label}</span>
                        <input
                          type="number"
                          min={0}
                          value={scenarioInputValues[field.key]}
                          onChange={(event) => {
                            const nextValue = Number.isFinite(event.currentTarget.valueAsNumber)
                              ? Math.max(event.currentTarget.valueAsNumber, 0)
                              : 0
                            setScenarioState((current) => ({
                              presetId: current.presetId,
                              sourceKey: autoLoadKey,
                              inputs: {
                                ...((current.sourceKey === autoLoadKey && current.inputs) ? current.inputs : scenarioInputValues),
                                [field.key]: nextValue,
                              },
                            }))
                          }}
                          className="mt-2 h-9 w-full rounded-xl border border-slate-300 px-3 text-sm font-semibold text-slate-900"
                        />
                        <span className="mt-1 block text-xs text-slate-400">{field.help}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <h5 className="text-sm font-semibold text-slate-900">Projected delta</h5>
                  <div className="mt-3 overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                      <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                        <tr>
                          <th className="px-3 py-2">blocker</th>
                          <th className="px-3 py-2">baseline</th>
                          <th className="px-3 py-2">projected</th>
                          <th className="px-3 py-2">delta</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {scenarioPreview.deltaRows.map((row) => (
                          <tr key={row.key}>
                            <td className="px-3 py-2 font-semibold text-slate-800">{row.label}</td>
                            <td className="px-3 py-2 text-slate-600">{formatIntegratedSnapshotCount2026(row.baseline)}</td>
                            <td className="px-3 py-2 text-slate-600">{formatIntegratedSnapshotCount2026(row.projected)}</td>
                            <td className={`px-3 py-2 font-semibold ${numericScenarioValue2026(row.delta) < 0 ? 'text-emerald-700' : 'text-slate-500'}`}>
                              {row.delta == null ? '미확인' : row.delta.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    공식 gate blocker는 실제 운영 데이터 저장 후 재산출되어야 하며, 이 화면에서는 잠재 영향만 참고값으로 표시합니다.
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h5 className="text-sm font-semibold text-slate-900">Remaining blockers / next HR action</h5>
                  <div className="mt-3 space-y-2">
                    {scenarioPreview.remainingBlockers.slice(0, 6).map((item) => (
                      <div key={item.label} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-slate-900">{item.label}</span>
                          <Badge tone={item.count > 0 ? 'warn' : 'success'}>{item.count.toLocaleString()}건</Badge>
                        </div>
                        <p className="mt-1 text-xs leading-5 text-slate-500">{item.nextAction}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
                    <p className="text-xs font-semibold text-amber-700">projected next HR action</p>
                    <p className="mt-1 text-sm leading-6 text-amber-900">{scenarioPreview.nextHrAction}</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <h5 className="text-sm font-semibold text-slate-900">Deterministic scenario report</h5>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{scenarioPreview.reportText}</p>
                </div>
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                  <h5 className="text-sm font-semibold text-rose-950">Prohibited actions</h5>
                  <p className="mt-2 text-sm leading-6 text-rose-900">{scenarioSimulator.prohibitedActions.join(', ')}</p>
                </div>
              </div>
            </div>
          ) : null}

          {ceoReportPack ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-semibold text-slate-900">2026 대표이사 보고 Pack</h4>
                    <Badge tone="success">{ceoReportPack.reportStatus}</Badge>
                    <Badge tone={ceoReportPack.summary.officialActivationStatus === 'BLOCKED' ? 'warn' : 'neutral'}>
                      {ceoReportPack.summary.officialActivationStatus}
                    </Badge>
                    <Badge tone="neutral">read-only export</Badge>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    이 화면은 대표이사 보고용 readiness 요약을 읽기 전용으로 제공합니다.
                    backfill, 공식 점수, 공식 등급, feature flag, Evaluation.totalScore, Evaluation.gradeId는 실행하지 않습니다.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    ['ceo-summary', '경영요약 복사', ceoReportPack.copyPayloads.executiveSummary],
                    ['ceo-markdown', '대표이사 보고서 Markdown 복사', ceoReportPack.copyPayloads.markdownReport],
                    ['ceo-blockers', 'Top blockers 복사', ceoReportPack.copyPayloads.topBlockers],
                    ['ceo-agenda', 'CEO decision agenda 복사', ceoReportPack.copyPayloads.decisionAgenda],
                    ['ceo-scenarios', 'Scenario comparison 복사', ceoReportPack.copyPayloads.scenarioComparison],
                    ['ceo-prohibited', 'Prohibited actions 복사', ceoReportPack.copyPayloads.prohibitedActions],
                    ['ceo-tsv', 'TSV export', ceoReportPack.copyPayloads.tsvSummary],
                  ].map(([key, label, text]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => void copyActivationRunbookPayload(key, text)}
                      className="inline-flex min-h-9 items-center justify-center rounded-xl border border-slate-300 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      {copiedRunbookKey === key ? '복사됨' : label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                <MetricCard label="current stage" value={ceoReportPack.summary.currentStage} help="readiness stage" compact />
                <MetricCard label="overall status" value={ceoReportPack.summary.overallReadinessStatus} help="snapshot status" compact />
                <MetricCard label="official activation" value={ceoReportPack.summary.officialActivationStatus} help="CEO report status" compact variant={ceoReportPack.summary.officialActivationStatus === 'BLOCKED' ? 'warning' : 'default'} />
                {ceoReportPack.keyNumbers.slice(0, 3).map((item) => (
                  <MetricCard
                    key={item.id}
                    label={item.label}
                    value={item.value == null ? '확인 필요' : String(item.value)}
                    help={item.note}
                    compact
                    variant={item.id === 'MBO_MISSING' || item.id === 'OFFICIAL_GATE_BLOCKERS' ? 'warning' : 'default'}
                  />
                ))}
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <h5 className="text-sm font-semibold text-slate-900">Executive summary</h5>
                <p className="mt-3 text-sm leading-6 text-slate-600">{ceoReportPack.summary.executiveSummaryText}</p>
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <h5 className="text-sm font-semibold text-slate-900">Key numbers</h5>
                  <div className="mt-3 overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                      <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                        <tr>
                          <th className="px-3 py-2">metric</th>
                          <th className="px-3 py-2">value</th>
                          <th className="px-3 py-2">source</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {ceoReportPack.keyNumbers.map((item) => (
                          <tr key={item.id}>
                            <td className="px-3 py-2 font-semibold text-slate-800">{item.label}</td>
                            <td className="px-3 py-2 text-slate-600">{item.value == null ? '화면 값 확인 필요' : String(item.value)}</td>
                            <td className="px-3 py-2 text-slate-500">{item.note}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <h5 className="text-sm font-semibold text-amber-950">CEO decision agenda</h5>
                  <div className="mt-3 space-y-3 text-sm leading-6 text-amber-950">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-700">Decisions needed now</p>
                      <ul className="mt-1 space-y-1">
                        {ceoReportPack.decisionAgenda.decisionsNeededNow.map((item) => <li key={item}>- {item}</li>)}
                      </ul>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-700">Not yet appropriate</p>
                      <ul className="mt-1 space-y-1">
                        {ceoReportPack.decisionAgenda.decisionsNotYetAppropriate.map((item) => <li key={item}>- {item}</li>)}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                <h5 className="text-sm font-semibold text-slate-900">Top blockers</h5>
                <div className="mt-3 overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                      <tr>
                        <th className="px-3 py-2">blocker</th>
                        <th className="px-3 py-2">count</th>
                        <th className="px-3 py-2">impact</th>
                        <th className="px-3 py-2">next HR action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {ceoReportPack.topBlockers.map((blocker) => (
                        <tr key={blocker.code}>
                          <td className="px-3 py-2">
                            <p className="font-semibold text-slate-800">{blocker.name}</p>
                            <p className="text-xs text-slate-400">{blocker.sourcePanel} · {blocker.route}</p>
                          </td>
                          <td className="px-3 py-2 font-semibold text-slate-700">{blocker.count.toLocaleString()}건</td>
                          <td className="px-3 py-2 text-slate-600">{blocker.impact}</td>
                          <td className="px-3 py-2 text-slate-600">{blocker.nextHrAction}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h5 className="text-sm font-semibold text-slate-900">Scenario comparison</h5>
                  <div className="mt-3 grid gap-3">
                    {ceoReportPack.scenarioComparison.map((scenario) => (
                      <div key={scenario.scenarioName} className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                        <p className="text-sm font-semibold text-slate-900">{scenario.scenarioName}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">improvement: {scenario.expectedImprovement}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">remaining: {scenario.remainingBlocker}</p>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{scenario.recommendedInterpretation}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <h5 className="text-sm font-semibold text-slate-900">Recommended execution order</h5>
                    <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-600">
                      {ceoReportPack.recommendedExecutionOrder.map((item) => <li key={item}>{item}</li>)}
                    </ol>
                  </div>
                  <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                    <h5 className="text-sm font-semibold text-blue-950">Next checkpoint</h5>
                    <p className="mt-2 text-sm font-semibold text-blue-900">{ceoReportPack.nextCheckpoint.name}</p>
                    <p className="mt-2 text-sm leading-6 text-blue-900">{ceoReportPack.nextCheckpoint.nextReviewCondition}</p>
                    <p className="mt-2 text-xs leading-5 text-blue-800">
                      required: {ceoReportPack.nextCheckpoint.requiredExportedData.join(', ')}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                    <h5 className="text-sm font-semibold text-rose-950">Prohibited actions</h5>
                    <p className="mt-2 text-sm leading-6 text-rose-900">{ceoReportPack.prohibitedActions.join(', ')}</p>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {runbook ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-semibold text-slate-900">2026 공식 전환 Runbook</h4>
                    <Badge tone="neutral">{runbook.mode}</Badge>
                    <Badge tone={runbook.summary.blockedSectionCount > 0 ? 'warn' : 'success'}>
                      blocker {runbook.summary.totalBlockerCount.toLocaleString()}건
                    </Badge>
                    <Badge tone="neutral">No execution buttons in UI</Badge>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    이 화면은 공식 전환 실행 순서를 읽기 전용으로 안내합니다. backfill, feature flag, 공식 점수, 공식 등급은 실행하지 않습니다.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    ['runbook-full', '전체 runbook', runbook.copyPayloads.markdown],
                    ['runbook-blockers', 'blocker 요약', runbook.copyPayloads.blockerSummary],
                    ['runbook-hr', 'HR checklist', runbook.copyPayloads.hrApprovalChecklist],
                    ['runbook-dev', 'Dev checklist', runbook.copyPayloads.developerExecutionChecklist],
                    ['runbook-prohibited', '금지 목록', runbook.copyPayloads.prohibitedActions],
                    ['runbook-tsv', 'TSV', runbook.copyPayloads.tsv],
                  ].map(([key, label, text]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => void copyActivationRunbookPayload(key, text)}
                      className="inline-flex min-h-9 items-center justify-center rounded-xl border border-slate-300 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      {copiedRunbookKey === key ? '복사됨' : label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
                  <p className="text-xs font-semibold text-amber-900">현재 단계</p>
                  <p className="mt-1 text-sm font-semibold text-amber-950">{runbook.currentPosition.currentStage}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-xs font-semibold text-slate-500">다음 필요 단계</p>
                  <p className="mt-1 text-sm leading-5 text-slate-700">{runbook.currentPosition.nextRequiredStep}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-xs font-semibold text-slate-500">아직 금지</p>
                  <p className="mt-1 text-sm leading-5 text-slate-700">
                    {runbook.currentPosition.prohibitedActions.slice(0, 5).join(', ')}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 xl:grid-cols-2">
                {runbook.sections.map((section) => (
                  <details
                    key={section.id}
                    open={section.status === 'BLOCKED'}
                    className={`rounded-2xl border ${
                      section.status === 'BLOCKED'
                        ? 'border-amber-200 bg-amber-50/60'
                        : section.status === 'READY_FOR_REVIEW'
                          ? 'border-emerald-200 bg-emerald-50/50'
                          : 'border-slate-200 bg-slate-50'
                    }`}
                  >
                    <summary className="cursor-pointer list-none px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={section.status === 'BLOCKED' ? 'warn' : section.status === 'READY_FOR_REVIEW' ? 'success' : 'neutral'}>
                            {section.status}
                          </Badge>
                          <span className="text-sm font-semibold text-slate-900">{section.title}</span>
                        </div>
                        <span className="text-xs text-slate-500">blocker {section.currentBlockerCount.toLocaleString()}건</span>
                      </div>
                    </summary>
                    <div className="border-t border-white/70 px-4 pb-4 pt-3 text-sm leading-6 text-slate-600">
                      <div className="grid gap-3 md:grid-cols-2">
                        <div>
                          <p className="text-xs font-semibold text-slate-500">Required checks</p>
                          <ul className="mt-2 space-y-1">
                            {section.requiredChecks.slice(0, 6).map((check) => (
                              <li key={check}>- {check}</li>
                            ))}
                          </ul>
                          {section.requiredChecks.length > 6 ? (
                            <p className="mt-1 text-xs text-slate-400">+{section.requiredChecks.length - 6}개 check</p>
                          ) : null}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-500">Source readiness panels</p>
                          <p className="mt-2">{section.sourceReadinessPanels.join(', ')}</p>
                          <p className="mt-3 text-xs font-semibold text-slate-500">Next HR action</p>
                          <p>{section.nextHrAction}</p>
                          <p className="mt-3 text-xs font-semibold text-slate-500">Next developer action</p>
                          <p>{section.nextDeveloperAction}</p>
                          <p className="mt-3 text-xs font-semibold text-slate-500">Prohibited actions</p>
                          <p>{section.prohibitedActions.slice(0, 5).join(', ')}</p>
                        </div>
                      </div>
                    </div>
                  </details>
                ))}
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h5 className="text-sm font-semibold text-slate-900">HR approval checklist</h5>
                  <ul className="mt-3 space-y-1 text-sm leading-6 text-slate-600">
                    {runbook.hrApprovalChecklist.map((item) => (
                      <li key={item}>- {item}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h5 className="text-sm font-semibold text-slate-900">Developer execution checklist</h5>
                  <ul className="mt-3 space-y-1 text-sm leading-6 text-slate-600">
                    {runbook.developerExecutionChecklist.map((item) => (
                      <li key={item}>- {item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : null}

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h4 className="text-sm font-semibold text-slate-900">2026 공식 전환 Gate checklist</h4>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  각 gate는 필요한 조건, 현재 blocker 수, 차단 이유, 다음 HR action을 표시합니다. 실행 버튼은 제공하지 않습니다.
                </p>
              </div>
              <Badge tone="neutral">read-only checklist</Badge>
            </div>

            {activation.populationDryRunError ? (
              <div className="mt-3">
                <Banner tone="warn" message={activation.populationDryRunError} />
              </div>
            ) : null}

            <div className="mt-4 space-y-3">
              {gates.map((gate) => (
                <details
                  key={gate.id}
                  open={gate.status === 'BLOCKED'}
                  className={`rounded-2xl border ${
                    gate.status === 'READY'
                      ? 'border-emerald-200 bg-emerald-50/40'
                      : gate.status === 'NOT_APPLICABLE'
                        ? 'border-slate-200 bg-slate-50'
                        : 'border-amber-200 bg-amber-50/50'
                  }`}
                >
                  <summary className="cursor-pointer list-none px-4 py-3">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={gate.status === 'READY' ? 'success' : gate.status === 'BLOCKED' ? 'warn' : 'neutral'}>
                            {gate.status}
                          </Badge>
                          <span className="text-sm font-semibold text-slate-900">{gate.title}</span>
                          <span className="text-xs text-slate-500">blocker {gate.currentBlockerCount.toLocaleString()}건</span>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{gate.nextHrAction}</p>
                      </div>
                      <div className="rounded-xl border border-white/70 bg-white/80 px-3 py-2 text-xs leading-5 text-slate-600">
                        {gate.safetyWarning}
                      </div>
                    </div>
                  </summary>
                  <div className="border-t border-white/70 px-4 pb-4 pt-3">
                    {gate.blockedReasons.length ? (
                      <div className="mb-3 rounded-xl border border-amber-200 bg-white px-3 py-2">
                        <p className="text-xs font-semibold text-amber-800">차단 이유</p>
                        <ul className="mt-2 space-y-1">
                          {gate.blockedReasons.slice(0, 6).map((reason) => (
                            <li key={reason} className="text-xs leading-5 text-amber-900">{reason}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-left text-xs">
                        <thead className="text-slate-400">
                          <tr>
                            <th className="whitespace-nowrap px-2 py-2 font-semibold">조건</th>
                            <th className="whitespace-nowrap px-2 py-2 font-semibold">상태</th>
                            <th className="whitespace-nowrap px-2 py-2 font-semibold">현재값</th>
                            <th className="whitespace-nowrap px-2 py-2 font-semibold">다음 HR action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white/80 text-slate-700">
                          {gate.requiredConditions.map((item) => (
                            <tr key={`${gate.id}-${item.code}`}>
                              <td className="min-w-48 px-2 py-2 align-top font-semibold text-slate-900">{item.label}</td>
                              <td className="px-2 py-2 align-top">
                                <Badge tone={item.status === 'READY' ? 'success' : item.status === 'BLOCKED' ? 'warn' : 'neutral'}>
                                  {item.status}
                                </Badge>
                              </td>
                              <td className="min-w-36 px-2 py-2 align-top">{item.currentValue}</td>
                              <td className="min-w-72 px-2 py-2 align-top">{item.nextHrAction}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </details>
              ))}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-700" />
                <h4 className="text-sm font-semibold text-amber-900">Legacy activation blockers</h4>
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
          HR 관리자가 공식 전환 전에 backfill, scoring, AI exclusion, grade, totalScore/gradeId write gate를 읽기 전용으로 점검할 수 있습니다.
          확인 대상: Backfill apply gate, Official scoring gate, AI score exclusion gate, Official grade gate,
          Evaluation.totalScore write gate, Evaluation.gradeId write gate.
        </div>
      )}
    </Panel>
  )
}

function getGradePolicyRowTone2026(status: EvaluationGradePolicyReadiness2026ApiData['groups'][number]['rows'][number]['status']) {
  if (status === 'MATCHES_PPT') return 'success'
  if (status === 'DIFFERS_FROM_PPT') return 'warn'
  return 'error'
}

function getGradePolicyRowLabel2026(status: EvaluationGradePolicyReadiness2026ApiData['groups'][number]['rows'][number]['status']) {
  if (status === 'MATCHES_PPT') return '저장 정책 일치'
  if (status === 'DIFFERS_FROM_PPT') return '차이 있음'
  return 'HR 확인 필요'
}

function getGradePolicyGroupDisplayCode2026(group: EvaluationGradePolicyReadiness2026ApiData['groups'][number]['group']) {
  if (group === 'TEAM_SECTION_LEADER_NON_SALES') return 'LEADER_NON_SALES'
  if (group === 'TEAM_SECTION_LEADER_SALES') return 'LEADER_SALES'
  return group
}

function PolicyGradeReadiness2026Panel(props: {
  gradePolicyData: EvaluationGradePolicyReadiness2026ApiData | null
  loading: boolean
  saving: boolean
  error: string
  notice: string
  selectedCycleId: string | null
  canSave: boolean
  onLoad: () => void
  onSave: () => void
  onResolveTeamMemberSalesAmbiguity: (payload: GradePolicyTeamMemberSalesResolutionPayload2026) => void
}) {
  const data = props.gradePolicyData
  const topBlockers = data?.blockers.slice(0, 5) ?? []
  const [ambiguityMode, setAmbiguityMode] =
    useState<GradePolicyTeamMemberSalesResolutionPayload2026['decision']>('APPLY_PPT_BASELINE')
  const [customSuperMinScore, setCustomSuperMinScore] = useState('')
  const [customSuperMaxScore, setCustomSuperMaxScore] = useState('')
  const [customOutstandingMinScore, setCustomOutstandingMinScore] = useState('110')
  const [customOutstandingMaxScore, setCustomOutstandingMaxScore] = useState('')
  const [ambiguityNote, setAmbiguityNote] = useState('')
  const [ambiguityLocalError, setAmbiguityLocalError] = useState('')

  function readOptionalScore(value: string) {
    const trimmed = value.trim()
    if (!trimmed) return null
    const parsed = Number(trimmed)
    return Number.isFinite(parsed) ? parsed : Number.NaN
  }

  function saveTeamMemberSalesAmbiguity() {
    setAmbiguityLocalError('')
    const note = ambiguityNote.trim() || undefined
    if (ambiguityMode === 'APPLY_PPT_BASELINE') {
      props.onResolveTeamMemberSalesAmbiguity({
        decision: 'APPLY_PPT_BASELINE',
        note,
      })
      return
    }
    if (ambiguityMode === 'DEFER') {
      props.onResolveTeamMemberSalesAmbiguity({
        decision: 'DEFER',
        note,
      })
      return
    }

    const superMinScore = readOptionalScore(customSuperMinScore)
    const superMaxScore = readOptionalScore(customSuperMaxScore)
    const outstandingMinScore = readOptionalScore(customOutstandingMinScore)
    const outstandingMaxScore = readOptionalScore(customOutstandingMaxScore)
    const hasInvalidScore = [superMinScore, superMaxScore, outstandingMinScore, outstandingMaxScore].some(
      (value) => typeof value === 'number' && Number.isNaN(value)
    )
    if (hasInvalidScore) {
      setAmbiguityLocalError('HR 별도 기준은 숫자 또는 빈 값만 입력할 수 있습니다.')
      return
    }
    if (outstandingMinScore === null && outstandingMaxScore === null) {
      setAmbiguityLocalError('Outstanding 별도 기준에는 minScore 또는 maxScore가 필요합니다.')
      return
    }

    props.onResolveTeamMemberSalesAmbiguity({
      decision: 'CUSTOM_THRESHOLDS',
      superMinScore,
      superMaxScore,
      outstandingMinScore,
      outstandingMaxScore,
      note,
    })
  }

  return (
    <Panel
      title="2026 등급 기준 readiness"
      description="PPT 기준 등급 threshold와 현재 저장 정책을 비교합니다. 저장해도 공식 점수/등급은 변경되지 않습니다."
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-1 rounded-2xl bg-violet-50 p-2 text-violet-700">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="neutral">Grade metadata only</Badge>
              <Badge tone={data && data.blockers.length === 0 ? 'success' : data ? 'warn' : 'neutral'}>
                {data
                  ? data.blockers.length === 0
                    ? 'HR 확인 완료'
                    : `${data.blockers.length}개 확인 필요`
                  : '미확인'}
              </Badge>
              <Badge tone="neutral">공식 등급 미적용</Badge>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              이 화면은 2026 등급 기준 readiness 확인용입니다. 저장해도 공식 점수/등급은 변경되지 않습니다.
              TEAM_MEMBER_SALES Super/Outstanding 중첩은 HR 결정 전까지 blocker로 남습니다.
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
            {props.loading ? '확인 중...' : data ? '등급 기준 다시 확인' : '등급 기준 확인'}
          </button>
          <button
            type="button"
            onClick={props.onSave}
            disabled={!props.selectedCycleId || !props.canSave || props.loading || props.saving}
            className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-violet-600 px-4 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {props.saving ? '저장 중...' : 'PPT 기준 metadata 저장'}
          </button>
        </div>
      </div>

      {props.error ? <div className="mt-4"><Banner tone="error" message={props.error} /></div> : null}
      {props.notice ? <div className="mt-4"><Banner tone="success" message={props.notice} /></div> : null}
      {!props.selectedCycleId ? (
        <div className="mt-4">
          <Banner tone="warn" message="평가 주기를 선택해야 등급 기준 metadata 저장을 할 수 있습니다." />
        </div>
      ) : null}
      {data?.persistence.compatibilityIssue ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="flex flex-wrap items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4" />
            DB compatibility 확인 필요
          </div>
          <p className="mt-2 leading-6">{data.persistence.compatibilityIssue.message}</p>
          <p className="mt-1 text-xs text-amber-800">
            code: {data.persistence.compatibilityIssue.code}
            {data.persistence.compatibilityIssue.prismaCode ? ` / prisma: ${data.persistence.compatibilityIssue.prismaCode}` : ''}
            {data.persistence.compatibilityIssue.objectName ? ` / object: ${data.persistence.compatibilityIssue.objectName}` : ''}
          </p>
        </div>
      ) : null}

      {data ? (
        <div className="mt-5 space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <MetricCard
              label="저장 정책"
              value={data.gradePolicyExists ? '있음' : '없음'}
              help="evaluation_grade_policies"
              compact
              variant={data.gradePolicyExists ? 'default' : 'warning'}
            />
            <MetricCard
              label="완료 그룹"
              value={`${data.completeGroupCount}/${data.requiredGroupCount}`}
              help="직군별 기준"
              compact
              variant={data.gradePolicyGroupsComplete ? 'default' : 'warning'}
            />
            <MetricCard
              label="누락 행"
              value={data.missingRowsCount.toLocaleString()}
              help={`${data.expectedRowsCount}개 필요`}
              compact
              variant={data.missingRowsCount > 0 ? 'warning' : 'default'}
            />
            <MetricCard
              label="PPT 차이"
              value={data.differsFromPptCount.toLocaleString()}
              help="HR 확인 필요"
              compact
              variant={data.differsFromPptCount > 0 ? 'warning' : 'default'}
            />
            <MetricCard
              label="중첩/공백"
              value={`${data.overlapCount}/${data.gapCount}`}
              help="overlap/gap"
              compact
              variant={data.overlapCount + data.gapCount > 0 ? 'warning' : 'default'}
            />
            <MetricCard
              label="TEAM_MEMBER_SALES"
              value={data.teamMemberSalesAmbiguity.requiresDecision ? 'HR 확인 필요' : '결정됨'}
              help={data.teamMemberSalesAmbiguity.currentDecision}
              compact
              variant={data.teamMemberSalesAmbiguity.requiresDecision ? 'warning' : 'default'}
            />
          </div>

          {topBlockers.length ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-700" />
                <h4 className="text-sm font-semibold text-amber-900">등급 기준 blocker</h4>
              </div>
              <ul className="mt-3 space-y-1">
                {topBlockers.map((blocker, index) => (
                  <li key={`${blocker.code}-${index}`} className="text-xs leading-5 text-amber-900">
                    <span className="font-semibold">{blocker.code}</span> · {blocker.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {data.teamMemberSalesAmbiguity.requiresDecision ? (
            <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-violet-700" />
                    <h4 className="text-sm font-semibold text-violet-950">TEAM_MEMBER_SALES 기준 HR 확인</h4>
                    <Badge tone="warn">blocker 해소 필요</Badge>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-violet-900">
                    PPT 해석상 팀원 영업 Super는 별도 구간을 운영하지 않고, Outstanding은 110점 이상으로 둡니다.
                    이 저장은 등급 기준 readiness metadata만 변경하며 공식 점수/등급은 변경하지 않습니다.
                  </p>
                </div>
              </div>

              <div className="mt-3 grid gap-3 lg:grid-cols-3">
                <label className="rounded-2xl border border-white bg-white/80 p-3 text-xs text-slate-700 shadow-sm">
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="team-member-sales-grade-resolution"
                      checked={ambiguityMode === 'APPLY_PPT_BASELINE'}
                      onChange={() => setAmbiguityMode('APPLY_PPT_BASELINE')}
                    />
                    <span className="font-semibold text-slate-900">PPT 기준 적용</span>
                  </div>
                  <p className="mt-2 leading-5">Super 미운영 / Outstanding 110점 이상</p>
                </label>
                <label className="rounded-2xl border border-white bg-white/80 p-3 text-xs text-slate-700 shadow-sm">
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="team-member-sales-grade-resolution"
                      checked={ambiguityMode === 'CUSTOM_THRESHOLDS'}
                      onChange={() => setAmbiguityMode('CUSTOM_THRESHOLDS')}
                    />
                    <span className="font-semibold text-slate-900">HR 별도 기준 입력</span>
                  </div>
                  <p className="mt-2 leading-5">Super / Outstanding 점수 구간을 HR이 직접 확정합니다.</p>
                </label>
                <label className="rounded-2xl border border-white bg-white/80 p-3 text-xs text-slate-700 shadow-sm">
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="team-member-sales-grade-resolution"
                      checked={ambiguityMode === 'DEFER'}
                      onChange={() => setAmbiguityMode('DEFER')}
                    />
                    <span className="font-semibold text-slate-900">보류</span>
                  </div>
                  <p className="mt-2 leading-5">blocker를 유지하고 추후 HR 결정으로 남깁니다.</p>
                </label>
              </div>

              {ambiguityMode === 'CUSTOM_THRESHOLDS' ? (
                <div className="mt-3 grid gap-3 rounded-2xl border border-violet-100 bg-white/80 p-3 sm:grid-cols-2 lg:grid-cols-4">
                  <label className="space-y-1 text-xs font-semibold text-slate-600">
                    Super minScore
                    <input
                      type="number"
                      value={customSuperMinScore}
                      onChange={(event) => setCustomSuperMinScore(event.target.value)}
                      className="h-9 w-full rounded-xl border border-slate-200 px-3 text-sm font-normal text-slate-900 outline-none focus:border-violet-400"
                      placeholder="예: 120"
                    />
                  </label>
                  <label className="space-y-1 text-xs font-semibold text-slate-600">
                    Super maxScore
                    <input
                      type="number"
                      value={customSuperMaxScore}
                      onChange={(event) => setCustomSuperMaxScore(event.target.value)}
                      className="h-9 w-full rounded-xl border border-slate-200 px-3 text-sm font-normal text-slate-900 outline-none focus:border-violet-400"
                      placeholder="미입력 가능"
                    />
                  </label>
                  <label className="space-y-1 text-xs font-semibold text-slate-600">
                    Outstanding minScore
                    <input
                      type="number"
                      value={customOutstandingMinScore}
                      onChange={(event) => setCustomOutstandingMinScore(event.target.value)}
                      className="h-9 w-full rounded-xl border border-slate-200 px-3 text-sm font-normal text-slate-900 outline-none focus:border-violet-400"
                      placeholder="예: 110"
                    />
                  </label>
                  <label className="space-y-1 text-xs font-semibold text-slate-600">
                    Outstanding maxScore
                    <input
                      type="number"
                      value={customOutstandingMaxScore}
                      onChange={(event) => setCustomOutstandingMaxScore(event.target.value)}
                      className="h-9 w-full rounded-xl border border-slate-200 px-3 text-sm font-normal text-slate-900 outline-none focus:border-violet-400"
                      placeholder="미입력 가능"
                    />
                  </label>
                </div>
              ) : null}

              <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
                <label className="space-y-1 text-xs font-semibold text-slate-600">
                  HR 확인 메모
                  <textarea
                    value={ambiguityNote}
                    onChange={(event) => setAmbiguityNote(event.target.value)}
                    className="min-h-[72px] w-full rounded-2xl border border-violet-100 bg-white px-3 py-2 text-sm font-normal text-slate-900 outline-none focus:border-violet-400"
                    placeholder="예: 2026 PPT 기준 해석 확정"
                  />
                </label>
                <button
                  type="button"
                  onClick={saveTeamMemberSalesAmbiguity}
                  disabled={!props.selectedCycleId || !props.canSave || props.loading || props.saving}
                  className="inline-flex min-h-10 items-center justify-center rounded-2xl bg-violet-600 px-4 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {props.saving ? '저장 중...' : 'TEAM_MEMBER_SALES 기준 저장'}
                </button>
              </div>
              {ambiguityLocalError ? (
                <p className="mt-2 text-xs font-semibold text-rose-700">{ambiguityLocalError}</p>
              ) : null}
              {!props.canSave ? (
                <p className="mt-2 text-xs text-violet-800">ROLE_ADMIN만 HR 확인 metadata를 저장할 수 있습니다.</p>
              ) : null}
            </div>
          ) : data.teamMemberSalesAmbiguity.currentDecision === 'PPT_SUPER_NOT_APPLICABLE' ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              TEAM_MEMBER_SALES 기준이 HR 확인되었습니다. Super는 미운영, Outstanding은 110점 이상으로 저장되어 있습니다.
            </div>
          ) : null}

          <div className="space-y-4">
            {data.groups.map((group) => (
              <div key={group.group} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-semibold text-slate-900">{group.label}</h4>
                      <Badge tone="neutral">{getGradePolicyGroupDisplayCode2026(group.group)}</Badge>
                      {getGradePolicyGroupDisplayCode2026(group.group) !== group.group ? (
                        <span className="text-xs text-slate-400">저장 enum: {group.group}</span>
                      ) : null}
                      <Badge tone={group.complete && !group.requiresHrConfirmation ? 'success' : 'warn'}>
                        {group.complete && !group.requiresHrConfirmation ? '완료' : 'HR 확인 필요'}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      {group.roleGroup} · {group.salesGroup} · 누락 {group.missingRowsCount} · 차이 {group.differsFromPptCount}
                    </p>
                  </div>
                  {group.requiresHrConfirmation ? (
                    <Badge tone="warn">TEAM_MEMBER_SALES 기준 확인 필요</Badge>
                  ) : null}
                </div>

                <div className="mt-3 overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-100 text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        <th className="px-3 py-2 font-semibold">등급</th>
                        <th className="px-3 py-2 font-semibold">PPT 기준</th>
                        <th className="px-3 py-2 font-semibold">현재 저장 정책</th>
                        <th className="px-3 py-2 font-semibold">상태</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {group.rows.map((row) => (
                        <tr key={`${group.group}:${row.gradeLabel}`}>
                          <td className="px-3 py-2 font-semibold text-slate-900">{row.gradeDisplayName}</td>
                          <td className="px-3 py-2 text-slate-600">
                            <span className="font-semibold text-slate-700">PPT 기준</span> · {row.pptLabel}
                            {row.pptNotes ? <span className="block text-slate-400">{row.pptNotes}</span> : null}
                          </td>
                          <td className="px-3 py-2 text-slate-600">
                            <span className="font-semibold text-slate-700">현재 저장 정책</span> · {row.storedLabel}
                          </td>
                          <td className="px-3 py-2">
                            <Badge tone={getGradePolicyRowTone2026(row.status)}>
                              {getGradePolicyRowLabel2026(row.status)}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
          HR 관리자가 PPT 기준 등급 threshold와 현재 저장 정책의 차이를 확인하고, 명시적으로 metadata를 저장할 수 있습니다.
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
    MANUAL_REVIEW: '수동 검토',
  }

  return value ? labels[value] ?? value : '미분류'
}

function getPolicyCategoryConfidenceLabel2026(value: string | null | undefined) {
  if (value === 'HIGH') return 'HIGH'
  if (value === 'MEDIUM') return 'MEDIUM'
  if (value === 'LOW') return 'LOW'
  if (value === 'MANUAL_REVIEW') return 'MANUAL_REVIEW'
  return '전체'
}

function getPolicyCategoryConfidenceTone2026(value: string | null | undefined): 'success' | 'warn' | 'error' | 'neutral' {
  if (value === 'HIGH') return 'success'
  if (value === 'MEDIUM' || value === 'LOW') return 'warn'
  if (value === 'MANUAL_REVIEW') return 'error'
  return 'neutral'
}

function getScoreContributionLabel2026(value: string | null | undefined) {
  if (value === 'ORGANIZATION') return '조직성과'
  if (value === 'PERSONAL') return '개인성과'
  return '미지정'
}

function getMboOperationalStatusLabel2026(value: string | null | undefined) {
  if (value === 'SUBMITTED') return '제출'
  if (value === 'MANAGER_REVIEW') return '리더 검토'
  if (value === 'CONFIRMED') return '확정'
  if (value === 'ARCHIVED') return '보관'
  return '초안'
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

const TEAM_KPI_HR_REVIEW_DECISIONS_2026: TeamKpiHrReviewDecision2026[] = [
  'APPROVED_FOR_ORG_GOAL',
  'EXCLUDED_DAILY_WORK',
  'EXCEPTION_APPROVED',
  'NEEDS_DISCUSSION',
]

const TEAM_KPI_HR_REVIEW_STATUS_FILTERS_2026: Array<TeamKpiHrReviewStatus2026 | 'ALL'> = [
  'ALL',
  'PENDING_REVIEW',
  'APPROVED_FOR_ORG_GOAL',
  'EXCLUDED_DAILY_WORK',
  'EXCEPTION_APPROVED',
  'NEEDS_DISCUSSION',
]

const TEAM_KPI_HR_REVIEW_REASONS_2026: TeamKpiHrReviewReason2026[] = [
  '전년 대비 상향 KPI',
  '핵심 과제',
  '매출/수익/고객 확보 직접 연계',
  '본부 KPI 직접 포함',
  '단순 운영/유지 업무',
  '중복 목표',
  '기타 HR 사유',
]

const MBO_FOLLOW_UP_TYPES_2026: Array<MboFollowUpType2026 | 'ALL'> = [
  'ALL',
  'MISSING_MBO',
  'DRAFT_MBO',
  'LEADER_REVIEW',
  'POLICY_CATEGORY',
  'TEAM_KPI_REVIEW',
]

const MBO_FOLLOW_UP_STATUS_FILTERS_2026: Array<MboFollowUpStatusFilter2026 | 'ALL'> = [
  'ALL',
  'MISSING',
  'DRAFT',
  'SUBMITTED_REVIEWING',
  'CONFIRMED',
  'POLICY_CATEGORY',
  'TEAM_KPI_REVIEW',
]

const RESULT_WRITING_STATUS_FILTERS_2026: Array<ResultWritingStatus2026 | 'ALL'> = [
  'ALL',
  'READY_FOR_REVIEW',
  'NEEDS_RESULT',
  'NEEDS_EVIDENCE',
  'NEEDS_CONTRIBUTION',
  'NEEDS_CATEGORY',
  'MANUAL_REVIEW',
]

const RESULT_WRITING_CATEGORY_FILTERS_2026: Array<ResultWritingCategoryFilter2026 | 'ALL'> = [
  'ALL',
  'ORG_GOAL',
  'PROJECT_T',
  'PROJECT_K',
  'DAILY_WORK',
  'UNMAPPED',
]

const RESULT_WRITING_WARNING_FILTERS_2026: Array<ResultWritingWarningCode2026 | 'ALL'> = [
  'ALL',
  'MISSING_ACTUAL_RESULT',
  'MISSING_MEASURABLE_RESULT',
  'MISSING_EVIDENCE',
  'MISSING_PERSONAL_CONTRIBUTION',
  'MISSING_TARGET_ACTUAL_COMPARISON',
  'MISSING_OUTPUT_IMPACT',
  'MISSING_CATEGORY',
  'ORG_GOAL_WITHOUT_APPROVED_SOURCE',
  'DAILY_WORK_DUPLICATE_RISK',
  'PROJECT_TK_MISSING_DELIVERABLE',
  'AI_EVIDENCE_MIXED_IN_ANNUAL_SCORE',
]

const MBO_FOLLOW_UP_TEMPLATES_2026: Record<MboFollowUpType2026, string> = {
  MISSING_MBO: [
    '2026 MBO 수립을 위해 /kpi/personal에서 개인 KPI를 작성해 주세요.',
    '조직목표 / 프로젝트 T / 프로젝트 K / 일상업무를 구분해 주세요.',
    '수행계획, 측정 가능한 목표, 본인 기여 내용을 작성해 주세요.',
    '제출 기한은 HR 안내 기준을 따릅니다.',
  ].join('\n'),
  DRAFT_MBO: [
    '작성 중인 2026 MBO 초안을 보완 후 제출해 주세요.',
    '작성 품질 체크 항목을 확인해 주세요.',
    '제출 후 리더 검토가 진행됩니다.',
  ].join('\n'),
  LEADER_REVIEW: [
    '제출된 팀원 MBO를 검토해 주세요.',
    '조직목표 / 프로젝트 / 일상업무 분류가 적절한지 확인해 주세요.',
    '보완 필요 시 초안으로 되돌리기를 사용해 주세요.',
    '승인 전 비중, 수행계획, 측정 기준을 확인해 주세요.',
  ].join('\n'),
  POLICY_CATEGORY: [
    'policyCategory 미분류 항목을 ORG_GOAL / PROJECT_T / PROJECT_K / DAILY_WORK 중 하나로 확정해 주세요.',
    'ORG_GOAL은 본부 KPI 또는 HR 승인 팀 KPI와 연결되어야 합니다.',
    '조직목표/프로젝트에 포함된 업무는 DAILY_WORK로 중복 기재하지 않도록 확인해 주세요.',
  ].join('\n'),
  TEAM_KPI_REVIEW: [
    '팀 KPI별로 조직목표 반영 / 일상업무 처리 / 예외 승인 / 논의 필요를 결정해 주세요.',
    '결정 사유를 남겨 주세요.',
    '이 결정은 공식 점수/등급이 아니라 MBO readiness metadata입니다.',
  ].join('\n'),
}

function getMboSetupStatusLabel2026(value: MboSetupMonitoringStatus2026 | 'ALL') {
  if (value === 'MISSING') return 'MBO 없음'
  if (value === 'DRAFT') return '초안'
  if (value === 'SUBMITTED_REVIEWING') return '제출/검토 중'
  if (value === 'CONFIRMED') return '확정'
  return '전체'
}

function getMboSetupStatusTone2026(value: MboSetupMonitoringStatus2026): 'success' | 'warn' | 'error' | 'neutral' {
  if (value === 'CONFIRMED') return 'success'
  if (value === 'SUBMITTED_REVIEWING') return 'warn'
  if (value === 'MISSING') return 'error'
  return 'neutral'
}

function getMboFollowUpTypeLabel2026(value: MboFollowUpType2026 | 'ALL') {
  if (value === 'MISSING_MBO') return 'MBO 없음'
  if (value === 'DRAFT_MBO') return '초안 보유'
  if (value === 'LEADER_REVIEW') return '제출/검토 중'
  if (value === 'POLICY_CATEGORY') return 'policyCategory 미분류'
  if (value === 'TEAM_KPI_REVIEW') return '팀 KPI 검토'
  return '전체'
}

function getMboFollowUpStatusLabel2026(value: MboFollowUpStatusFilter2026 | 'ALL') {
  if (value === 'POLICY_CATEGORY') return 'policyCategory 미분류'
  if (value === 'TEAM_KPI_REVIEW') return '팀 KPI 검토 필요'
  return getMboSetupStatusLabel2026(value)
}

function getResultWritingStatusLabel2026(value: ResultWritingStatus2026 | 'ALL') {
  if (value === 'READY_FOR_REVIEW') return '리더 검토 준비'
  if (value === 'NEEDS_RESULT') return '수행결과 필요'
  if (value === 'NEEDS_EVIDENCE') return '증빙 필요'
  if (value === 'NEEDS_CONTRIBUTION') return '기여 보완'
  if (value === 'NEEDS_CATEGORY') return '카테고리 확정'
  if (value === 'MANUAL_REVIEW') return '수동 검토'
  return '전체'
}

function getResultWritingStatusTone2026(value: ResultWritingStatus2026): 'success' | 'warn' | 'error' | 'neutral' {
  if (value === 'READY_FOR_REVIEW') return 'success'
  if (value === 'NEEDS_RESULT' || value === 'NEEDS_CATEGORY') return 'error'
  if (value === 'NEEDS_EVIDENCE' || value === 'NEEDS_CONTRIBUTION') return 'warn'
  return 'neutral'
}

function getResultWritingCategoryLabel2026(value: ResultWritingCategoryFilter2026 | 'ALL') {
  if (value === 'ORG_GOAL') return 'ORG_GOAL 조직목표'
  if (value === 'PROJECT_T') return 'PROJECT_T 프로젝트 T'
  if (value === 'PROJECT_K') return 'PROJECT_K 프로젝트 K'
  if (value === 'DAILY_WORK') return 'DAILY_WORK 일상업무'
  if (value === 'UNMAPPED') return '미분류'
  return '전체'
}

function getResultWritingWarningLabel2026(value: ResultWritingWarningCode2026 | 'ALL') {
  const labels: Record<ResultWritingWarningCode2026, string> = {
    MISSING_ACTUAL_RESULT: '수행결과 누락',
    MISSING_MEASURABLE_RESULT: '정량 결과 부족',
    MISSING_EVIDENCE: '증빙 부족',
    MISSING_PERSONAL_CONTRIBUTION: '본인 기여 부족',
    MISSING_TARGET_ACTUAL_COMPARISON: '목표/실제 비교 부족',
    MISSING_OUTPUT_IMPACT: '산출물/영향 부족',
    MISSING_CATEGORY: 'policyCategory 미분류',
    ORG_GOAL_WITHOUT_APPROVED_SOURCE: 'ORG_GOAL 승인 소스 없음',
    DAILY_WORK_DUPLICATE_RISK: 'DAILY_WORK 중복 위험',
    PROJECT_TK_MISSING_DELIVERABLE: '프로젝트 deliverable 부족',
    AI_EVIDENCE_MIXED_IN_ANNUAL_SCORE: 'AI 증빙 혼재 위험',
  }
  if (value === 'ALL') return '전체'
  return labels[value]
}

function getLeaderEvaluationReadinessStatusLabel2026(value: LeaderEvaluationReadinessStatus2026 | 'ALL') {
  const labels: Record<LeaderEvaluationReadinessStatus2026, string> = {
    READY_FOR_FIRST_REVIEW: 'FIRST review 준비',
    BLOCKED_SELF_NOT_SUBMITTED: 'SELF 미제출',
    BLOCKED_RESULT_MISSING: '수행결과 누락',
    BLOCKED_EVIDENCE_MISSING: '증빙 부족',
    BLOCKED_POLICY_CATEGORY_MISSING: 'policyCategory 미분류',
    BLOCKED_EVALUATOR_MISSING: '평가자 누락',
    READY_FOR_SECOND_REVIEW: 'SECOND review 준비',
    BLOCKED_FIRST_NOT_COMPLETE: 'FIRST 미완료',
    READY_FOR_FINAL_REVIEW: 'FINAL/CEO 준비',
    MANUAL_REVIEW: '수동 검토',
  }
  if (value === 'ALL') return '전체'
  return labels[value]
}

function getLeaderEvaluationReadinessTone2026(value: LeaderEvaluationReadinessStatus2026): 'success' | 'warn' | 'error' | 'neutral' {
  if (value === 'READY_FOR_FIRST_REVIEW' || value === 'READY_FOR_SECOND_REVIEW' || value === 'READY_FOR_FINAL_REVIEW') {
    return 'success'
  }
  if (value === 'MANUAL_REVIEW' || value === 'BLOCKED_FIRST_NOT_COMPLETE') return 'warn'
  return 'error'
}

function getLeaderEvaluationPrerequisiteLabel2026(value: LeaderEvaluationMissingPrerequisite2026 | 'ALL') {
  const labels: Record<LeaderEvaluationMissingPrerequisite2026, string> = {
    SELF_NOT_SUBMITTED: 'SELF 미제출',
    RESULT_MISSING: '수행결과 누락',
    EVIDENCE_MISSING: '증빙 부족',
    POLICY_CATEGORY_MISSING: 'policyCategory 미분류',
    EVALUATOR_MISSING: '평가자 누락',
    FIRST_NOT_COMPLETE: 'FIRST 미완료',
    ORG_GOAL_SOURCE_MISSING: 'ORG_GOAL source 없음',
    MEASURABLE_RESULT_MISSING: '정량 결과 부족',
    PERSONAL_CONTRIBUTION_MISSING: '본인 기여 부족',
    SCORE_POLICY_WARNING: 'score policy warning',
    ADJUSTMENT_READINESS_WARNING: 'adjustment readiness',
  }
  if (value === 'ALL') return '전체'
  return labels[value]
}

function getFinalizationCeoStatusLabel2026(value: FinalizationCeoReadinessStatus2026 | 'ALL') {
  const labels: Record<FinalizationCeoReadinessStatus2026, string> = {
    BLOCKED_SELF_NOT_READY: 'SELF 미준비',
    BLOCKED_FIRST_NOT_READY: 'FIRST 미준비',
    BLOCKED_SECOND_NOT_READY: 'SECOND 미준비',
    BLOCKED_RESULT_MISSING: '수행결과/증빙 부족',
    BLOCKED_POLICY_CATEGORY_MISSING: 'policyCategory 미분류',
    BLOCKED_EVALUATOR_CHAIN: '평가자 chain blocker',
    BLOCKED_SCORE_POLICY: 'score policy blocker',
    BLOCKED_GRADE_POLICY: 'grade policy blocker',
    BLOCKED_FEEDBACK_LEADERSHIP: '360/리더십 blocker',
    BLOCKED_AI_READINESS: 'AI readiness blocker',
    READY_FOR_FINAL_REVIEW: 'FINAL review 준비',
    READY_FOR_CEO_CONFIRMATION_LATER: 'CEO 확인 later-ready',
    MANUAL_REVIEW: '수동 검토',
  }
  if (value === 'ALL') return '전체'
  return labels[value]
}

function getFinalizationCeoStatusTone2026(value: FinalizationCeoReadinessStatus2026): 'success' | 'warn' | 'error' | 'neutral' {
  if (value === 'READY_FOR_FINAL_REVIEW' || value === 'READY_FOR_CEO_CONFIRMATION_LATER') return 'success'
  if (value === 'MANUAL_REVIEW') return 'warn'
  return 'error'
}

function getFinalizationCeoBlockerLabel2026(value: FinalizationCeoBlockerType2026 | 'ALL') {
  const labels: Record<FinalizationCeoBlockerType2026, string> = {
    SELF_NOT_READY: 'SELF 미준비',
    FIRST_NOT_READY: 'FIRST 미완료',
    SECOND_NOT_READY: 'SECOND 미완료',
    RESULT_MISSING: '수행결과 누락',
    EVIDENCE_MISSING: '증빙 부족',
    POLICY_CATEGORY_MISSING: 'policyCategory 미분류',
    EVALUATOR_CHAIN: '평가자 chain',
    SCORE_POLICY: 'score policy',
    GRADE_POLICY: 'grade policy',
    FEEDBACK_LEADERSHIP: '360/리더십',
    AI_READINESS: 'AI readiness',
    MANUAL_REVIEW: '수동 검토',
  }
  if (value === 'ALL') return '전체'
  return labels[value]
}

function getMboFollowUpTypeTone2026(value: MboFollowUpType2026): 'success' | 'warn' | 'error' | 'neutral' {
  if (value === 'MISSING_MBO') return 'error'
  if (value === 'DRAFT_MBO' || value === 'LEADER_REVIEW' || value === 'TEAM_KPI_REVIEW') return 'warn'
  return 'neutral'
}

function getTeamKpiHrReviewStatusLabel2026(value: TeamKpiHrReviewStatus2026 | 'ALL') {
  if (value === 'APPROVED_FOR_ORG_GOAL') return '조직목표 반영 가능'
  if (value === 'EXCLUDED_DAILY_WORK') return '일상업무 처리'
  if (value === 'EXCEPTION_APPROVED') return '예외 승인'
  if (value === 'NEEDS_DISCUSSION') return '검토 필요'
  if (value === 'PENDING_REVIEW') return '검토 대기'
  return '전체'
}

function getTeamKpiHrReviewStatusTone2026(value: TeamKpiHrReviewStatus2026): 'success' | 'warn' | 'error' | 'neutral' {
  if (value === 'APPROVED_FOR_ORG_GOAL' || value === 'EXCEPTION_APPROVED') return 'success'
  if (value === 'EXCLUDED_DAILY_WORK') return 'neutral'
  if (value === 'NEEDS_DISCUSSION') return 'warn'
  return 'error'
}

function getCompletionRateLabel2026(confirmed: number, total: number) {
  if (!total) return '0%'
  return `${Math.round((confirmed / total) * 100)}%`
}

function sanitizeTsvCell(value: unknown) {
  return String(value ?? '').replace(/\t|\r?\n/g, ' ').trim()
}

function buildTsv2026(headers: string[], rows: Array<Array<unknown>>) {
  return [headers, ...rows].map((row) => row.map(sanitizeTsvCell).join('\t')).join('\n')
}

function formatTopFollowUpValues2026(values: Array<string | null | undefined>, emptyLabel = '대상 없음') {
  const counts = new Map<string, number>()
  for (const value of values) {
    const label = value?.trim()
    if (!label) continue
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }
  const top = Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], 'ko'))
    .slice(0, 3)
  if (!top.length) return emptyLabel
  return top.map(([label, count]) => `${label} ${count.toLocaleString()}건`).join(' · ')
}

function buildMboFollowUpRecipientList2026(rows: MboFollowUpRecipientRow2026[]) {
  return rows
    .map((row) =>
      [
        row.employeeNo,
        row.name,
        row.email,
        row.divisionName,
        row.departmentPath,
        row.leaderName,
        row.actionLabel,
      ].filter(Boolean).join(' / ')
    )
    .join('\n')
}

function buildResultWritingTsv2026(rows: ResultWritingReadinessRow2026[], headers?: string[]) {
  return buildTsv2026(
    headers ?? [
      'employeeNo',
      'employeeName',
      'email',
      'division',
      'departmentPath',
      'leader',
      'category',
      'mboStatus',
      'resultWritingStatus',
      'kpiName',
      'warnings',
      'nextAction',
    ],
    rows.map((row) => [
      row.employeeNo,
      row.employeeName,
      row.email ?? '',
      row.divisionName,
      row.departmentPath,
      row.leaderName,
      row.categoryLabel,
      row.mboStatus,
      getResultWritingStatusLabel2026(row.resultWritingStatus),
      row.kpiName,
      row.warnings.map((warning) => warning.label).join(', '),
      row.nextAction,
    ])
  )
}

function buildLeaderEvaluationTsv2026(rows: LeaderEvaluationReadinessRow2026[], headers?: string[]) {
  return buildTsv2026(
    headers ?? [
      'employeeNo',
      'employeeName',
      'email',
      'division',
      'departmentPath',
      'firstEvaluator',
      'secondEvaluator',
      'finalEvaluator',
      'currentStage',
      'readinessStatus',
      'blockerReason',
      'nextAction',
    ],
    rows.map((row) => [
      row.employeeNo,
      row.employeeName,
      row.email ?? '',
      row.divisionName,
      row.departmentPath,
      row.firstEvaluatorName,
      row.secondEvaluatorName,
      row.finalEvaluatorName,
      row.currentStage,
      getLeaderEvaluationReadinessStatusLabel2026(row.readinessStatus),
      row.blockerReasons.join(', '),
      row.suggestedNextAction,
    ])
  )
}

function buildFinalizationCeoTsv2026(rows: FinalizationCeoReadinessRow2026[], headers?: string[]) {
  return buildTsv2026(
    headers ?? [
      'employeeNo',
      'employeeName',
      'email',
      'division',
      'section',
      'departmentPath',
      'currentStage',
      'finalizationStatus',
      'blockerReason',
      'nextHrAction',
    ],
    rows.map((row) => [
      row.employeeNo,
      row.employeeName,
      row.email ?? '',
      row.divisionName,
      row.sectionName,
      row.departmentPath,
      row.currentEvaluationStage,
      getFinalizationCeoStatusLabel2026(row.finalizationReadinessStatus),
      row.blockerReasons.join(', '),
      row.nextHrAction,
    ])
  )
}

function PolicyReadinessPopulation2026Panel(props: {
  dryRunData: EvaluationReadinessPopulation2026ApiData | null
  loading: boolean
  error: string
  selectedCycleId: string | null
  canManageTeamKpiReview: boolean
  onLoad: () => void
}) {
  const dryRun = props.dryRunData
  const blockers = dryRun?.blockers ?? []
  const warnings = dryRun?.warnings ?? []
  const missingEmployees = dryRun?.employeesMissingConfirmedPersonalKpi.slice(0, 8) ?? []
  const wouldCreate = dryRun?.wouldCreateSelfEvaluations.slice(0, 6) ?? []
  const mboCoverage = dryRun?.mboSetupCoverage
  const monitoring = mboCoverage?.monitoring
  const teamKpiHrReviewCoverage = dryRun?.teamKpiHrReviewCoverage
  const scorePolicyReadiness = dryRun?.scorePolicyReadiness
  const [monitorDivisionFilter, setMonitorDivisionFilter] = useState('ALL')
  const [monitorTeamFilter, setMonitorTeamFilter] = useState('ALL')
  const [monitorStatusFilter, setMonitorStatusFilter] = useState<MboSetupMonitoringStatus2026 | 'ALL'>('ALL')
  const [monitorManagerFilter, setMonitorManagerFilter] = useState('ALL')
  const [scorePolicyDivisionFilter, setScorePolicyDivisionFilter] = useState('ALL')
  const [scorePolicyTeamFilter, setScorePolicyTeamFilter] = useState('ALL')
  const [scorePolicyEmployeeFilter, setScorePolicyEmployeeFilter] = useState('ALL')
  const [scorePolicyCategoryFilter, setScorePolicyCategoryFilter] =
    useState<ScorePolicyCategory2026 | 'UNMAPPED' | 'ALL'>('ALL')
  const [scorePolicyViolationFilter, setScorePolicyViolationFilter] = useState('ALL')
  const [simulatorCategory, setSimulatorCategory] = useState<ScorePolicyCategory2026>('ORG_GOAL')
  const [simulatorWeight, setSimulatorWeight] = useState('10')
  const [simulatorAchievement, setSimulatorAchievement] = useState<'BELOW_TARGET' | 'TARGET' | 'EXCELLENT'>('TARGET')
  const [simulatorBaseScore, setSimulatorBaseScore] = useState('')
  const [simulatorAdjustment, setSimulatorAdjustment] = useState('0')
  const [simulatorAdjustmentReason, setSimulatorAdjustmentReason] = useState('')
  const [teamReviewDivisionFilter, setTeamReviewDivisionFilter] = useState('ALL')
  const [teamReviewTeamFilter, setTeamReviewTeamFilter] = useState('ALL')
  const [teamReviewStatusFilter, setTeamReviewStatusFilter] = useState<TeamKpiHrReviewStatus2026 | 'ALL'>('ALL')
  const [teamReviewReasonFilter, setTeamReviewReasonFilter] = useState<TeamKpiHrReviewReason2026 | 'ALL'>('ALL')
  const [teamReviewDrafts, setTeamReviewDrafts] = useState<Record<string, TeamKpiHrReviewDecisionDraft2026>>({})
  const [selectedTeamReviewIds, setSelectedTeamReviewIds] = useState<string[]>([])
  const [teamReviewBulkDraft, setTeamReviewBulkDraft] = useState<TeamKpiHrReviewDecisionDraft2026>({
    decision: '',
    reason: '',
    note: '',
  })
  const [teamReviewSavingId, setTeamReviewSavingId] = useState<string | null>(null)
  const [teamReviewBulkSaving, setTeamReviewBulkSaving] = useState(false)
  const [teamReviewSaveNotice, setTeamReviewSaveNotice] = useState('')
  const [teamReviewSaveError, setTeamReviewSaveError] = useState('')
  const [followUpDivisionFilter, setFollowUpDivisionFilter] = useState('ALL')
  const [followUpTeamFilter, setFollowUpTeamFilter] = useState('ALL')
  const [followUpLeaderFilter, setFollowUpLeaderFilter] = useState('ALL')
  const [followUpTypeFilter, setFollowUpTypeFilter] = useState<MboFollowUpType2026 | 'ALL'>('ALL')
  const [followUpStatusFilter, setFollowUpStatusFilter] = useState<MboFollowUpStatusFilter2026 | 'ALL'>('ALL')
  const [resultWritingDivisionFilter, setResultWritingDivisionFilter] = useState('ALL')
  const [resultWritingTeamFilter, setResultWritingTeamFilter] = useState('ALL')
  const [resultWritingLeaderFilter, setResultWritingLeaderFilter] = useState('ALL')
  const [resultWritingEmployeeFilter, setResultWritingEmployeeFilter] = useState('ALL')
  const [resultWritingCategoryFilter, setResultWritingCategoryFilter] =
    useState<ResultWritingCategoryFilter2026 | 'ALL'>('ALL')
  const [resultWritingStatusFilter, setResultWritingStatusFilter] = useState<ResultWritingStatus2026 | 'ALL'>('ALL')
  const [resultWritingWarningFilter, setResultWritingWarningFilter] =
    useState<ResultWritingWarningCode2026 | 'ALL'>('ALL')
  const [leaderEvalDivisionFilter, setLeaderEvalDivisionFilter] = useState('ALL')
  const [leaderEvalTeamFilter, setLeaderEvalTeamFilter] = useState('ALL')
  const [leaderEvalEvaluatorFilter, setLeaderEvalEvaluatorFilter] = useState('ALL')
  const [leaderEvalStageFilter, setLeaderEvalStageFilter] = useState('ALL')
  const [leaderEvalStatusFilter, setLeaderEvalStatusFilter] =
    useState<LeaderEvaluationReadinessStatus2026 | 'ALL'>('ALL')
  const [leaderEvalPrerequisiteFilter, setLeaderEvalPrerequisiteFilter] =
    useState<LeaderEvaluationMissingPrerequisite2026 | 'ALL'>('ALL')
  const [leaderEvalPolicyCategoryFilter, setLeaderEvalPolicyCategoryFilter] = useState<'ALL' | 'READY' | 'MISSING'>('ALL')
  const [leaderEvalEvidenceFilter, setLeaderEvalEvidenceFilter] = useState<'ALL' | 'READY' | 'MISSING' | 'NO_ITEMS'>('ALL')
  const [finalizationDivisionFilter, setFinalizationDivisionFilter] = useState('ALL')
  const [finalizationSectionFilter, setFinalizationSectionFilter] = useState('ALL')
  const [finalizationTeamFilter, setFinalizationTeamFilter] = useState('ALL')
  const [finalizationStageFilter, setFinalizationStageFilter] = useState('ALL')
  const [finalizationStatusFilter, setFinalizationStatusFilter] =
    useState<FinalizationCeoReadinessStatus2026 | 'ALL'>('ALL')
  const [finalizationBlockerFilter, setFinalizationBlockerFilter] =
    useState<FinalizationCeoBlockerType2026 | 'ALL'>('ALL')
  const [finalizationEvaluatorFilter, setFinalizationEvaluatorFilter] = useState('ALL')
  const [finalizationPolicyFilter, setFinalizationPolicyFilter] = useState<'ALL' | 'READY' | 'MISSING'>('ALL')
  const [finalizationEvidenceFilter, setFinalizationEvidenceFilter] =
    useState<'ALL' | 'READY' | 'MISSING' | 'NO_ITEMS'>('ALL')
  const [finalizationGradePolicyFilter, setFinalizationGradePolicyFilter] =
    useState<'ALL' | 'READY' | 'BLOCKED'>('ALL')
  const [finalizationFeedbackFilter, setFinalizationFeedbackFilter] =
    useState<'ALL' | 'READY' | 'BLOCKED' | 'NOT_CHECKED'>('ALL')
  const [finalizationManualOnly, setFinalizationManualOnly] = useState(false)
  const [copiedMonitoringTable, setCopiedMonitoringTable] = useState<string | null>(null)
  const employeeRows = useMemo(() => monitoring?.employeeRows ?? [], [monitoring])
  const policyCategoryMissingRows = useMemo(() => monitoring?.policyCategoryMissingItems ?? [], [monitoring])
  const teamReviewRows = useMemo(() => teamKpiHrReviewCoverage?.candidates ?? [], [teamKpiHrReviewCoverage])
  const scorePolicyViolationRows = useMemo(
    () => scorePolicyReadiness?.violations ?? [],
    [scorePolicyReadiness?.violations]
  )
  const resultWritingReadiness = dryRun?.resultWritingReadiness
  const resultWritingRows = useMemo(() => resultWritingReadiness?.rows ?? [], [resultWritingReadiness])
  const leaderEvaluationReadiness = dryRun?.leaderEvaluationReadiness
  const leaderEvaluationRows = useMemo(() => leaderEvaluationReadiness?.rows ?? [], [leaderEvaluationReadiness])
  const finalizationCeoReadiness = dryRun?.finalizationCeoReadiness
  const finalizationCeoRows = useMemo(() => finalizationCeoReadiness?.rows ?? [], [finalizationCeoReadiness])
  const topDivisionCoverage = mboCoverage?.divisionCoverage ?? []
  const topTeamCoverage = mboCoverage?.teamCoverage ?? []
  const divisionOptions = useMemo(
    () =>
      Array.from(
        new Map(
          employeeRows
            .filter((row) => row.divisionId)
            .map((row) => [row.divisionId as string, row.divisionName])
        ).entries()
      ).sort((left, right) => left[1].localeCompare(right[1], 'ko')),
    [employeeRows]
  )
  const teamOptions = useMemo(
    () =>
      Array.from(
        new Map(
          employeeRows
            .filter((row) => row.departmentId && (monitorDivisionFilter === 'ALL' || row.divisionId === monitorDivisionFilter))
            .map((row) => [row.departmentId as string, row.departmentPath])
        ).entries()
      ).sort((left, right) => left[1].localeCompare(right[1], 'ko')),
    [employeeRows, monitorDivisionFilter]
  )
  const managerOptions = useMemo(
    () =>
      Array.from(
        new Map(
          employeeRows
            .filter((row) => row.managerId)
            .map((row) => [row.managerId as string, row.managerName])
        ).entries()
      ).sort((left, right) => left[1].localeCompare(right[1], 'ko')),
    [employeeRows]
  )
  const scorePolicyDivisionOptions = useMemo(
    () =>
      Array.from(
        new Map(
          scorePolicyViolationRows
            .filter((row) => row.divisionId)
            .map((row) => [row.divisionId as string, row.divisionName])
        ).entries()
      ).sort((left, right) => left[1].localeCompare(right[1], 'ko')),
    [scorePolicyViolationRows]
  )
  const scorePolicyTeamOptions = useMemo(
    () =>
      Array.from(
        new Map(
          scorePolicyViolationRows
            .filter((row) => row.departmentId && (scorePolicyDivisionFilter === 'ALL' || row.divisionId === scorePolicyDivisionFilter))
            .map((row) => [row.departmentId as string, row.departmentPath])
        ).entries()
      ).sort((left, right) => left[1].localeCompare(right[1], 'ko')),
    [scorePolicyDivisionFilter, scorePolicyViolationRows]
  )
  const scorePolicyEmployeeOptions = useMemo(
    () =>
      Array.from(
        new Map(
          scorePolicyViolationRows
            .filter((row) => row.employeeId)
            .map((row) => [row.employeeId as string, row.employeeName])
        ).entries()
      ).sort((left, right) => left[1].localeCompare(right[1], 'ko')),
    [scorePolicyViolationRows]
  )
  const scorePolicyViolationOptions = useMemo(
    () => Array.from(new Set(scorePolicyViolationRows.map((row) => row.code))).sort(),
    [scorePolicyViolationRows]
  )
  const filteredScorePolicyViolationRows = useMemo(
    () =>
      scorePolicyViolationRows.filter((row) => {
        const matchesDivision = scorePolicyDivisionFilter === 'ALL' || row.divisionId === scorePolicyDivisionFilter
        const matchesTeam = scorePolicyTeamFilter === 'ALL' || row.departmentId === scorePolicyTeamFilter
        const matchesEmployee = scorePolicyEmployeeFilter === 'ALL' || row.employeeId === scorePolicyEmployeeFilter
        const matchesCategory = scorePolicyCategoryFilter === 'ALL' || row.category === scorePolicyCategoryFilter
        const matchesViolation = scorePolicyViolationFilter === 'ALL' || row.code === scorePolicyViolationFilter
        return matchesDivision && matchesTeam && matchesEmployee && matchesCategory && matchesViolation
      }),
    [
      scorePolicyCategoryFilter,
      scorePolicyDivisionFilter,
      scorePolicyEmployeeFilter,
      scorePolicyTeamFilter,
      scorePolicyViolationFilter,
      scorePolicyViolationRows,
    ]
  )
  const filteredEmployeeRows = useMemo(
    () =>
      employeeRows.filter((row) => {
        const matchesDivision = monitorDivisionFilter === 'ALL' || row.divisionId === monitorDivisionFilter
        const matchesTeam = monitorTeamFilter === 'ALL' || row.departmentId === monitorTeamFilter
        const matchesStatus = monitorStatusFilter === 'ALL' || row.status === monitorStatusFilter
        const matchesManager = monitorManagerFilter === 'ALL' || row.managerId === monitorManagerFilter
        return matchesDivision && matchesTeam && matchesStatus && matchesManager
      }),
    [employeeRows, monitorDivisionFilter, monitorManagerFilter, monitorStatusFilter, monitorTeamFilter]
  )
  const filteredPolicyCategoryMissingRows = useMemo(
    () =>
      policyCategoryMissingRows.filter((row) => {
        const matchesDivision = monitorDivisionFilter === 'ALL' || row.divisionId === monitorDivisionFilter
        const matchesTeam = monitorTeamFilter === 'ALL' || row.departmentId === monitorTeamFilter
        const matchesManager = monitorManagerFilter === 'ALL' || row.managerId === monitorManagerFilter
        return matchesDivision && matchesTeam && matchesManager
      }),
    [monitorDivisionFilter, monitorManagerFilter, monitorTeamFilter, policyCategoryMissingRows]
  )
  const teamReviewDivisionOptions = useMemo(
    () =>
      Array.from(
        new Map(
          teamReviewRows
            .filter((row) => row.divisionId)
            .map((row) => [row.divisionId as string, row.divisionName])
        ).entries()
      ).sort((left, right) => left[1].localeCompare(right[1], 'ko')),
    [teamReviewRows]
  )
  const teamReviewTeamOptions = useMemo(
    () =>
      Array.from(
        new Map(
          teamReviewRows
            .filter((row) => teamReviewDivisionFilter === 'ALL' || row.divisionId === teamReviewDivisionFilter)
            .map((row) => [row.departmentId, row.departmentPath])
        ).entries()
      ).sort((left, right) => left[1].localeCompare(right[1], 'ko')),
    [teamReviewDivisionFilter, teamReviewRows]
  )
  const teamReviewReasonOptions = useMemo(
    () =>
      Array.from(new Set(teamReviewRows.map((row) => row.reason).filter(Boolean))) as TeamKpiHrReviewReason2026[],
    [teamReviewRows]
  )
  const filteredTeamReviewRows = useMemo(
    () =>
      teamReviewRows.filter((row) => {
        const matchesDivision = teamReviewDivisionFilter === 'ALL' || row.divisionId === teamReviewDivisionFilter
        const matchesTeam = teamReviewTeamFilter === 'ALL' || row.departmentId === teamReviewTeamFilter
        const matchesStatus = teamReviewStatusFilter === 'ALL' || row.reviewStatus === teamReviewStatusFilter
        const matchesReason = teamReviewReasonFilter === 'ALL' || row.reason === teamReviewReasonFilter
        return matchesDivision && matchesTeam && matchesStatus && matchesReason
      }),
    [teamReviewDivisionFilter, teamReviewReasonFilter, teamReviewRows, teamReviewStatusFilter, teamReviewTeamFilter]
  )
  const visibleTeamReviewRows = useMemo(() => filteredTeamReviewRows.slice(0, 120), [filteredTeamReviewRows])
  const selectedTeamReviewIdSet = useMemo(() => new Set(selectedTeamReviewIds), [selectedTeamReviewIds])
  const selectedTeamReviewRows = useMemo(
    () => teamReviewRows.filter((row) => selectedTeamReviewIdSet.has(row.orgKpiId)),
    [selectedTeamReviewIdSet, teamReviewRows]
  )
  const selectedVisibleTeamReviewCount = useMemo(
    () => visibleTeamReviewRows.filter((row) => selectedTeamReviewIdSet.has(row.orgKpiId)).length,
    [selectedTeamReviewIdSet, visibleTeamReviewRows]
  )
  const allVisibleTeamReviewSelected =
    visibleTeamReviewRows.length > 0 && selectedVisibleTeamReviewCount === visibleTeamReviewRows.length
  const followUpGroups = useMemo<MboFollowUpGroup2026[]>(() => {
    const toEmployeeFollowUpRow = (
      row: NonNullable<typeof monitoring>['employeeRows'][number],
      type: MboFollowUpType2026,
      actionLabel: string
    ): MboFollowUpRecipientRow2026 => ({
      id: `${type}:${row.employeeId}`,
      type,
      typeLabel: getMboFollowUpTypeLabel2026(type),
      status: row.status,
      employeeNo: row.employeeNo,
      name: row.employeeName,
      email: row.email ?? null,
      divisionId: row.divisionId,
      divisionName: row.divisionName,
      departmentId: row.departmentId,
      departmentPath: row.departmentPath,
      leaderId: row.managerId,
      leaderName: row.managerName,
      actionLabel,
      detail: `KPI 전체 ${row.totalPersonalKpiCount} · 초안 ${row.draftPersonalKpiCount} · 제출/검토 ${
        row.submittedPersonalKpiCount + row.managerReviewPersonalKpiCount
      } · 확정 ${row.confirmedPersonalKpiCount}`,
    })

    const missingRows = (monitoring?.missingMboEmployees ?? []).map((row) =>
      toEmployeeFollowUpRow(row, 'MISSING_MBO', '작성 요청 필요')
    )
    const draftRows = (monitoring?.draftMboEmployees ?? []).map((row) =>
      toEmployeeFollowUpRow(row, 'DRAFT_MBO', '제출 요청 필요')
    )
    const submittedRows = (monitoring?.submittedReviewingMboEmployees ?? []).map((row) =>
      toEmployeeFollowUpRow(row, 'LEADER_REVIEW', '리더 검토 필요')
    )
    const policyRows = (monitoring?.policyCategoryMissingItems ?? []).map((row): MboFollowUpRecipientRow2026 => ({
      id: `POLICY_CATEGORY:${row.personalKpiId}`,
      type: 'POLICY_CATEGORY',
      typeLabel: getMboFollowUpTypeLabel2026('POLICY_CATEGORY'),
      status: 'POLICY_CATEGORY',
      employeeNo: row.employeeNo,
      name: row.employeeName,
      email: row.email ?? null,
      divisionId: row.divisionId,
      divisionName: row.divisionName,
      departmentId: row.departmentId,
      departmentPath: row.departmentPath,
      leaderId: row.managerId,
      leaderName: row.managerName,
      actionLabel: '카테고리 확정 필요',
      detail: `${row.personalKpiName}${row.linkedOrgKpiTitle ? ` · 연결 KPI ${row.linkedOrgKpiTitle}` : ''}`,
    }))
    const teamKpiRows = teamReviewRows
      .filter((row) => row.reviewStatus === 'PENDING_REVIEW' || row.reviewStatus === 'NEEDS_DISCUSSION')
      .map((row): MboFollowUpRecipientRow2026 => ({
        id: `TEAM_KPI_REVIEW:${row.orgKpiId}`,
        type: 'TEAM_KPI_REVIEW',
        typeLabel: getMboFollowUpTypeLabel2026('TEAM_KPI_REVIEW'),
        status: 'TEAM_KPI_REVIEW',
        employeeNo: null,
        name: row.teamKpiName,
        email: null,
        divisionId: row.divisionId,
        divisionName: row.divisionName,
        departmentId: row.departmentId,
        departmentPath: row.departmentPath,
        leaderId: row.ownerId,
        leaderName: row.ownerName,
        actionLabel: 'HR 팀 KPI 검토 필요',
        detail: `${row.reviewStatusLabel} · 영향 ${row.affectedActiveEmployeeCount.toLocaleString()}명 · ${row.guidance}`,
      }))

    return [
      {
        type: 'MISSING_MBO',
        label: 'MBO 없음',
        actionLabel: '작성 요청 필요',
        description: '2026 Personal KPI를 아직 시작하지 않은 직원에게 작성을 요청합니다.',
        template: MBO_FOLLOW_UP_TEMPLATES_2026.MISSING_MBO,
        href: '/kpi/personal',
        rows: missingRows,
      },
      {
        type: 'DRAFT_MBO',
        label: '초안 보유',
        actionLabel: '제출 요청 필요',
        description: '작성 중인 초안을 보완한 뒤 리더 검토로 제출하도록 안내합니다.',
        template: MBO_FOLLOW_UP_TEMPLATES_2026.DRAFT_MBO,
        href: '/kpi/personal',
        rows: draftRows,
      },
      {
        type: 'LEADER_REVIEW',
        label: '제출/검토 중',
        actionLabel: '리더 검토 필요',
        description: '팀원이 제출한 MBO를 리더가 검토하고 보완 요청 또는 확정하도록 안내합니다.',
        template: MBO_FOLLOW_UP_TEMPLATES_2026.LEADER_REVIEW,
        href: '/kpi/personal',
        rows: submittedRows,
      },
      {
        type: 'POLICY_CATEGORY',
        label: 'policyCategory 미분류',
        actionLabel: '카테고리 확정 필요',
        description: 'HR이 MBO 항목을 ORG_GOAL / PROJECT_T / PROJECT_K / DAILY_WORK 중 하나로 확정해야 합니다.',
        template: MBO_FOLLOW_UP_TEMPLATES_2026.POLICY_CATEGORY,
        href: '/evaluation/performance',
        rows: policyRows,
      },
      {
        type: 'TEAM_KPI_REVIEW',
        label: '팀 KPI 검토',
        actionLabel: 'HR 팀 KPI 검토 필요',
        description: 'PENDING_REVIEW 또는 NEEDS_DISCUSSION 팀 KPI에 대해 HR 결정을 남겨야 합니다.',
        template: MBO_FOLLOW_UP_TEMPLATES_2026.TEAM_KPI_REVIEW,
        href: '/evaluation/performance',
        rows: teamKpiRows,
      },
    ]
  }, [monitoring, teamReviewRows])
  const followUpRows = useMemo(() => followUpGroups.flatMap((group) => group.rows), [followUpGroups])
  const followUpDivisionOptions = useMemo(
    () =>
      Array.from(
        new Map(
          followUpRows
            .filter((row) => row.divisionId)
            .map((row) => [row.divisionId as string, row.divisionName])
        ).entries()
      ).sort((left, right) => left[1].localeCompare(right[1], 'ko')),
    [followUpRows]
  )
  const followUpTeamOptions = useMemo(
    () =>
      Array.from(
        new Map(
          followUpRows
            .filter((row) => row.departmentId && (followUpDivisionFilter === 'ALL' || row.divisionId === followUpDivisionFilter))
            .map((row) => [row.departmentId as string, row.departmentPath])
        ).entries()
      ).sort((left, right) => left[1].localeCompare(right[1], 'ko')),
    [followUpDivisionFilter, followUpRows]
  )
  const followUpLeaderOptions = useMemo(
    () =>
      Array.from(
        new Map(
          followUpRows
            .filter((row) => row.leaderId)
            .map((row) => [row.leaderId as string, row.leaderName])
        ).entries()
      ).sort((left, right) => left[1].localeCompare(right[1], 'ko')),
    [followUpRows]
  )
  const filteredFollowUpGroups = useMemo(
    () =>
      followUpGroups
        .filter((group) => followUpTypeFilter === 'ALL' || group.type === followUpTypeFilter)
        .map((group) => ({
          ...group,
          rows: group.rows.filter((row) => {
            const matchesDivision = followUpDivisionFilter === 'ALL' || row.divisionId === followUpDivisionFilter
            const matchesTeam = followUpTeamFilter === 'ALL' || row.departmentId === followUpTeamFilter
            const matchesLeader = followUpLeaderFilter === 'ALL' || row.leaderId === followUpLeaderFilter
            const matchesStatus = followUpStatusFilter === 'ALL' || row.status === followUpStatusFilter
            return matchesDivision && matchesTeam && matchesLeader && matchesStatus
          }),
        })),
    [
      followUpDivisionFilter,
      followUpGroups,
      followUpLeaderFilter,
      followUpStatusFilter,
      followUpTeamFilter,
      followUpTypeFilter,
    ]
  )
  const filteredFollowUpRows = useMemo(
    () => filteredFollowUpGroups.flatMap((group) => group.rows),
    [filteredFollowUpGroups]
  )
  const selectedFollowUpTemplate = useMemo(() => {
    if (followUpTypeFilter === 'ALL') {
      return filteredFollowUpGroups
        .filter((group) => group.rows.length > 0)
        .map((group) => `[${group.label}]\n${group.template}`)
        .join('\n\n')
    }
    return MBO_FOLLOW_UP_TEMPLATES_2026[followUpTypeFilter]
  }, [filteredFollowUpGroups, followUpTypeFilter])
  const copyMonitoringTable = useCallback(async (key: string, text: string) => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return
    await navigator.clipboard.writeText(text)
    setCopiedMonitoringTable(key)
    window.setTimeout(() => setCopiedMonitoringTable((current) => (current === key ? null : current)), 1800)
  }, [])
  const missingMboTsv = useMemo(
    () =>
      buildTsv2026(
        ['employeeNo', 'employeeName', 'email', 'division', 'departmentPath', 'manager', 'action'],
        (monitoring?.missingMboEmployees ?? []).map((row) => [
          row.employeeNo,
          row.employeeName,
          row.email ?? '',
          row.divisionName,
          row.departmentPath,
          row.managerName,
          row.actionLabel,
        ])
      ),
    [monitoring?.missingMboEmployees]
  )
  const submittedReviewingTsv = useMemo(
    () =>
      buildTsv2026(
        ['employeeNo', 'employeeName', 'email', 'division', 'departmentPath', 'manager', 'submittedKpi', 'managerReviewKpi', 'action'],
        (monitoring?.submittedReviewingMboEmployees ?? []).map((row) => [
          row.employeeNo,
          row.employeeName,
          row.email ?? '',
          row.divisionName,
          row.departmentPath,
          row.managerName,
          row.submittedPersonalKpiCount,
          row.managerReviewPersonalKpiCount,
          row.actionLabel,
        ])
      ),
    [monitoring?.submittedReviewingMboEmployees]
  )
  const policyCategoryMissingTsv = useMemo(
    () =>
      buildTsv2026(
        ['employeeNo', 'employeeName', 'email', 'division', 'departmentPath', 'manager', 'personalKpiName', 'linkedOrgKpi', 'action'],
        policyCategoryMissingRows.map((row) => [
          row.employeeNo,
          row.employeeName,
          row.email ?? '',
          row.divisionName,
          row.departmentPath,
          row.managerName,
          row.personalKpiName,
          row.linkedOrgKpiTitle ?? '',
          row.actionLabel,
        ])
      ),
    [policyCategoryMissingRows]
  )
  const scorePolicyViolationTsv = useMemo(
    () =>
      buildTsv2026(
        ['employeeNo', 'employeeName', 'division', 'departmentPath', 'personalKpiName', 'category', 'violationCode', 'current', 'limit', 'action'],
        filteredScorePolicyViolationRows.map((row) => [
          row.employeeNo,
          row.employeeName,
          row.divisionName,
          row.departmentPath,
          row.personalKpiName ?? '',
          row.category ?? '',
          row.code,
          row.currentValue ?? '',
          row.limitValue ?? '',
          row.actionLabel,
        ])
      ),
    [filteredScorePolicyViolationRows]
  )
  const followUpRecipientList = useMemo(
    () => buildMboFollowUpRecipientList2026(filteredFollowUpRows),
    [filteredFollowUpRows]
  )
  const followUpCombinedTsv = useMemo(
    () =>
      buildTsv2026(
        ['employeeNo', 'name', 'email', 'division', 'team', 'leader', 'action', 'followUpType', 'detail'],
        filteredFollowUpRows.map((row) => [
          row.employeeNo,
          row.name,
          row.email ?? '',
          row.divisionName,
          row.departmentPath,
          row.leaderName,
          row.actionLabel,
          row.typeLabel,
          row.detail,
        ])
      ),
    [filteredFollowUpRows]
  )
  const simulatorRule = useMemo(
    () => scorePolicyReadiness?.categoryRules.find((rule) => rule.category === simulatorCategory) ?? null,
    [scorePolicyReadiness?.categoryRules, simulatorCategory]
  )
  const simulatorBaseScoreValue = useMemo(() => {
    const explicit = Number(simulatorBaseScore)
    if (simulatorBaseScore.trim() && !Number.isNaN(explicit)) return explicit
    if (simulatorAchievement === 'EXCELLENT') {
      return simulatorRule?.excellentScore ?? simulatorRule?.maxScore ?? simulatorRule?.targetScore ?? 0
    }
    if (simulatorAchievement === 'TARGET') {
      return simulatorRule?.targetScore ?? simulatorRule?.maxScore ?? 0
    }
    return Math.max(0, (simulatorRule?.targetScore ?? simulatorRule?.maxScore ?? 80) - 10)
  }, [simulatorAchievement, simulatorBaseScore, simulatorRule])
  const simulatorWeightValue = Number(simulatorWeight)
  const simulatorAdjustmentValue = Number(simulatorAdjustment)
  const simulatorAdjustedScore = Math.max(
    0,
    Math.min(120, simulatorBaseScoreValue + (Number.isNaN(simulatorAdjustmentValue) ? 0 : simulatorAdjustmentValue))
  )
  const simulatorWeightedContribution =
    Number.isNaN(simulatorWeightValue) ? 0 : Math.round(((simulatorAdjustedScore * simulatorWeightValue) / 100) * 10) / 10
  const simulatorWarnings = useMemo(() => {
    const warnings: string[] = []
    const adjustment = Number(simulatorAdjustment)
    const weight = Number(simulatorWeight)
    if (Number.isNaN(weight) || weight < 0 || weight > 100) warnings.push('가중치는 0~100 사이 숫자로 입력해야 합니다.')
    if (Number.isNaN(adjustment)) warnings.push('조정점은 숫자로 입력해야 합니다.')
    if (!Number.isNaN(adjustment) && Math.abs(adjustment) > 5) warnings.push('조정점은 ±5 범위를 벗어날 수 없습니다.')
    if (!Number.isNaN(adjustment) && adjustment !== 0 && !simulatorAdjustmentReason.trim()) {
      warnings.push('조정점을 사용하려면 개인 기여 차이 근거를 입력해야 합니다.')
    }
    if (!Number.isNaN(adjustment) && adjustment !== 0 && simulatorAchievement === 'BELOW_TARGET') {
      warnings.push('Target 미만 달성 시 조정점을 적용하지 않습니다.')
    }
    if (!simulatorRule?.adjustmentAllowed && !Number.isNaN(adjustment) && adjustment !== 0) {
      warnings.push('이 category는 PPT 기준 조정점 적용 대상이 아닙니다.')
    }
    if (simulatorRule?.itemWeightCap != null && !Number.isNaN(weight) && weight > simulatorRule.itemWeightCap) {
      warnings.push(`${simulatorRule.label} 개별 항목 가중치 cap(${simulatorRule.itemWeightCap}%)을 초과했습니다.`)
    }
    if (simulatorCategory === 'ORG_GOAL' && !Number.isNaN(weight) && weight > 50) {
      warnings.push('ORG_GOAL 총 가중치 cap 50%를 초과할 수 없습니다.')
    }
    warnings.push('AI 활용평가는 연간 업적평가 점수에서 제외됩니다.')
    return warnings
  }, [
    simulatorAchievement,
    simulatorAdjustment,
    simulatorAdjustmentReason,
    simulatorCategory,
    simulatorRule?.adjustmentAllowed,
    simulatorRule?.itemWeightCap,
    simulatorRule?.label,
    simulatorWeight,
  ])
  const resultWritingDivisionOptions = useMemo(
    () =>
      Array.from(
        new Map(
          resultWritingRows
            .filter((row) => row.divisionId)
            .map((row) => [row.divisionId as string, row.divisionName])
        ).entries()
      ).sort((left, right) => left[1].localeCompare(right[1], 'ko')),
    [resultWritingRows]
  )
  const resultWritingTeamOptions = useMemo(
    () =>
      Array.from(
        new Map(
          resultWritingRows
            .filter((row) => row.departmentId && (resultWritingDivisionFilter === 'ALL' || row.divisionId === resultWritingDivisionFilter))
            .map((row) => [row.departmentId as string, row.departmentPath])
        ).entries()
      ).sort((left, right) => left[1].localeCompare(right[1], 'ko')),
    [resultWritingDivisionFilter, resultWritingRows]
  )
  const resultWritingLeaderOptions = useMemo(
    () =>
      Array.from(
        new Map(
          resultWritingRows
            .filter((row) => row.leaderId)
            .map((row) => [row.leaderId as string, row.leaderName])
        ).entries()
      ).sort((left, right) => left[1].localeCompare(right[1], 'ko')),
    [resultWritingRows]
  )
  const resultWritingEmployeeOptions = useMemo(
    () =>
      Array.from(
        new Map(
          resultWritingRows.map((row) => [row.employeeId, `${row.employeeName}${row.employeeNo ? ` (${row.employeeNo})` : ''}`])
        ).entries()
      ).sort((left, right) => left[1].localeCompare(right[1], 'ko')),
    [resultWritingRows]
  )
  const filteredResultWritingRows = useMemo(
    () =>
      resultWritingRows.filter((row) => {
        const matchesDivision = resultWritingDivisionFilter === 'ALL' || row.divisionId === resultWritingDivisionFilter
        const matchesTeam = resultWritingTeamFilter === 'ALL' || row.departmentId === resultWritingTeamFilter
        const matchesLeader = resultWritingLeaderFilter === 'ALL' || row.leaderId === resultWritingLeaderFilter
        const matchesEmployee = resultWritingEmployeeFilter === 'ALL' || row.employeeId === resultWritingEmployeeFilter
        const matchesCategory =
          resultWritingCategoryFilter === 'ALL' ||
          (row.category ?? 'UNMAPPED') === resultWritingCategoryFilter
        const matchesStatus = resultWritingStatusFilter === 'ALL' || row.resultWritingStatus === resultWritingStatusFilter
        const matchesWarning =
          resultWritingWarningFilter === 'ALL' ||
          row.warnings.some((warning) => warning.code === resultWritingWarningFilter)
        return (
          matchesDivision &&
          matchesTeam &&
          matchesLeader &&
          matchesEmployee &&
          matchesCategory &&
          matchesStatus &&
          matchesWarning
        )
      }),
    [
      resultWritingCategoryFilter,
      resultWritingDivisionFilter,
      resultWritingEmployeeFilter,
      resultWritingLeaderFilter,
      resultWritingRows,
      resultWritingStatusFilter,
      resultWritingTeamFilter,
      resultWritingWarningFilter,
    ]
  )
  const resultWritingCombinedTsv = useMemo(
    () => buildResultWritingTsv2026(filteredResultWritingRows, resultWritingReadiness?.exportColumns),
    [filteredResultWritingRows, resultWritingReadiness?.exportColumns]
  )
  const resultWritingMissingResultTsv = useMemo(
    () => buildResultWritingTsv2026(resultWritingRows.filter((row) => row.warnings.some((warning) => warning.code === 'MISSING_ACTUAL_RESULT'))),
    [resultWritingRows]
  )
  const resultWritingMissingEvidenceTsv = useMemo(
    () => buildResultWritingTsv2026(resultWritingRows.filter((row) => row.warnings.some((warning) => warning.code === 'MISSING_EVIDENCE'))),
    [resultWritingRows]
  )
  const resultWritingMissingContributionTsv = useMemo(
    () =>
      buildResultWritingTsv2026(
        resultWritingRows.filter((row) => row.warnings.some((warning) => warning.code === 'MISSING_PERSONAL_CONTRIBUTION'))
      ),
    [resultWritingRows]
  )
  const resultWritingOrgGoalSourceTsv = useMemo(
    () =>
      buildResultWritingTsv2026(
        resultWritingRows.filter((row) => row.warnings.some((warning) => warning.code === 'ORG_GOAL_WITHOUT_APPROVED_SOURCE'))
      ),
    [resultWritingRows]
  )
  const resultWritingDailyWorkDuplicateTsv = useMemo(
    () =>
      buildResultWritingTsv2026(
        resultWritingRows.filter((row) => row.warnings.some((warning) => warning.code === 'DAILY_WORK_DUPLICATE_RISK'))
      ),
    [resultWritingRows]
  )
  const leaderEvalDivisionOptions = useMemo(
    () =>
      Array.from(
        new Map(
          leaderEvaluationRows
            .filter((row) => row.divisionId)
            .map((row) => [row.divisionId as string, row.divisionName])
        ).entries()
      ).sort((left, right) => left[1].localeCompare(right[1], 'ko')),
    [leaderEvaluationRows]
  )
  const leaderEvalTeamOptions = useMemo(
    () =>
      Array.from(
        new Map(
          leaderEvaluationRows
            .filter((row) => row.departmentId && (leaderEvalDivisionFilter === 'ALL' || row.divisionId === leaderEvalDivisionFilter))
            .map((row) => [row.departmentId as string, row.departmentPath])
        ).entries()
      ).sort((left, right) => left[1].localeCompare(right[1], 'ko')),
    [leaderEvalDivisionFilter, leaderEvaluationRows]
  )
  const leaderEvalEvaluatorOptions = useMemo(
    () =>
      Array.from(
        new Map(
          leaderEvaluationRows
            .flatMap((row) => [
              row.firstEvaluatorId ? [row.firstEvaluatorId, row.firstEvaluatorName] as const : null,
              row.secondEvaluatorId ? [row.secondEvaluatorId, row.secondEvaluatorName] as const : null,
              row.finalEvaluatorId ? [row.finalEvaluatorId, row.finalEvaluatorName] as const : null,
            ])
            .filter((entry): entry is readonly [string, string] => Boolean(entry))
        ).entries()
      ).sort((left, right) => left[1].localeCompare(right[1], 'ko')),
    [leaderEvaluationRows]
  )
  const leaderEvalStageOptions = useMemo(
    () => Array.from(new Set(leaderEvaluationRows.map((row) => row.currentStage))).sort(),
    [leaderEvaluationRows]
  )
  const filteredLeaderEvaluationRows = useMemo(
    () =>
      leaderEvaluationRows.filter((row) => {
        const matchesDivision = leaderEvalDivisionFilter === 'ALL' || row.divisionId === leaderEvalDivisionFilter
        const matchesTeam = leaderEvalTeamFilter === 'ALL' || row.departmentId === leaderEvalTeamFilter
        const matchesEvaluator =
          leaderEvalEvaluatorFilter === 'ALL' ||
          row.firstEvaluatorId === leaderEvalEvaluatorFilter ||
          row.secondEvaluatorId === leaderEvalEvaluatorFilter ||
          row.finalEvaluatorId === leaderEvalEvaluatorFilter
        const matchesStage = leaderEvalStageFilter === 'ALL' || row.currentStage === leaderEvalStageFilter
        const matchesStatus = leaderEvalStatusFilter === 'ALL' || row.readinessStatus === leaderEvalStatusFilter
        const matchesPrerequisite =
          leaderEvalPrerequisiteFilter === 'ALL' || row.missingPrerequisites.includes(leaderEvalPrerequisiteFilter)
        const matchesPolicy =
          leaderEvalPolicyCategoryFilter === 'ALL' || row.policyCategoryStatus === leaderEvalPolicyCategoryFilter
        const matchesEvidence = leaderEvalEvidenceFilter === 'ALL' || row.evidenceStatus === leaderEvalEvidenceFilter
        return (
          matchesDivision &&
          matchesTeam &&
          matchesEvaluator &&
          matchesStage &&
          matchesStatus &&
          matchesPrerequisite &&
          matchesPolicy &&
          matchesEvidence
        )
      }),
    [
      leaderEvalDivisionFilter,
      leaderEvalEvaluatorFilter,
      leaderEvalEvidenceFilter,
      leaderEvalPolicyCategoryFilter,
      leaderEvalPrerequisiteFilter,
      leaderEvalStageFilter,
      leaderEvalStatusFilter,
      leaderEvalTeamFilter,
      leaderEvaluationRows,
    ]
  )
  const leaderEvaluationCombinedTsv = useMemo(
    () => buildLeaderEvaluationTsv2026(filteredLeaderEvaluationRows, leaderEvaluationReadiness?.exportColumns),
    [filteredLeaderEvaluationRows, leaderEvaluationReadiness?.exportColumns]
  )
  const leaderEvaluationFirstBlockedTsv = useMemo(
    () =>
      buildLeaderEvaluationTsv2026(
        leaderEvaluationRows.filter((row) =>
          ['BLOCKED_SELF_NOT_SUBMITTED', 'BLOCKED_RESULT_MISSING', 'BLOCKED_EVIDENCE_MISSING', 'BLOCKED_POLICY_CATEGORY_MISSING', 'BLOCKED_EVALUATOR_MISSING'].includes(row.readinessStatus)
        )
      ),
    [leaderEvaluationRows]
  )
  const leaderEvaluationSecondBlockedTsv = useMemo(
    () => buildLeaderEvaluationTsv2026(leaderEvaluationRows.filter((row) => row.readinessStatus === 'BLOCKED_FIRST_NOT_COMPLETE')),
    [leaderEvaluationRows]
  )
  const leaderEvaluationMissingEvidenceTsv = useMemo(
    () => buildLeaderEvaluationTsv2026(leaderEvaluationRows.filter((row) => row.missingEvidenceCount > 0)),
    [leaderEvaluationRows]
  )
  const leaderEvaluationMissingPolicyTsv = useMemo(
    () => buildLeaderEvaluationTsv2026(leaderEvaluationRows.filter((row) => row.missingPolicyCategoryCount > 0)),
    [leaderEvaluationRows]
  )
  const leaderEvaluationMissingEvaluatorTsv = useMemo(
    () => buildLeaderEvaluationTsv2026(leaderEvaluationRows.filter((row) => row.missingPrerequisites.includes('EVALUATOR_MISSING'))),
    [leaderEvaluationRows]
  )
  const leaderEvaluationReadyTsv = useMemo(
    () => buildLeaderEvaluationTsv2026(leaderEvaluationRows.filter((row) => row.readinessStatus.startsWith('READY_'))),
    [leaderEvaluationRows]
  )
  const finalizationDivisionOptions = useMemo(
    () =>
      Array.from(
        new Map(
          finalizationCeoRows
            .filter((row) => row.divisionId)
            .map((row) => [row.divisionId as string, row.divisionName])
        ).entries()
      ).sort((left, right) => left[1].localeCompare(right[1], 'ko')),
    [finalizationCeoRows]
  )
  const finalizationSectionOptions = useMemo(
    () =>
      Array.from(
        new Map(
          finalizationCeoRows
            .filter((row) =>
              row.sectionId &&
              (finalizationDivisionFilter === 'ALL' || row.divisionId === finalizationDivisionFilter)
            )
            .map((row) => [row.sectionId as string, row.sectionName])
        ).entries()
      ).sort((left, right) => left[1].localeCompare(right[1], 'ko')),
    [finalizationCeoRows, finalizationDivisionFilter]
  )
  const finalizationTeamOptions = useMemo(
    () =>
      Array.from(
        new Map(
          finalizationCeoRows
            .filter((row) =>
              row.departmentId &&
              (finalizationDivisionFilter === 'ALL' || row.divisionId === finalizationDivisionFilter) &&
              (finalizationSectionFilter === 'ALL' || row.sectionId === finalizationSectionFilter)
            )
            .map((row) => [row.departmentId as string, row.departmentPath])
        ).entries()
      ).sort((left, right) => left[1].localeCompare(right[1], 'ko')),
    [finalizationCeoRows, finalizationDivisionFilter, finalizationSectionFilter]
  )
  const finalizationEvaluatorOptions = useMemo(
    () =>
      Array.from(
        new Map(
          finalizationCeoRows
            .flatMap((row) => [
              row.firstEvaluatorId ? [row.firstEvaluatorId, row.firstEvaluatorName] as const : null,
              row.secondEvaluatorId ? [row.secondEvaluatorId, row.secondEvaluatorName] as const : null,
              row.finalEvaluatorId ? [row.finalEvaluatorId, row.finalEvaluatorName] as const : null,
            ])
            .filter((entry): entry is readonly [string, string] => Boolean(entry))
        ).entries()
      ).sort((left, right) => left[1].localeCompare(right[1], 'ko')),
    [finalizationCeoRows]
  )
  const finalizationStageOptions = useMemo(
    () => Array.from(new Set(finalizationCeoRows.map((row) => row.currentEvaluationStage))).sort(),
    [finalizationCeoRows]
  )
  const filteredFinalizationCeoRows = useMemo(
    () =>
      finalizationCeoRows.filter((row) => {
        const matchesDivision = finalizationDivisionFilter === 'ALL' || row.divisionId === finalizationDivisionFilter
        const matchesSection = finalizationSectionFilter === 'ALL' || row.sectionId === finalizationSectionFilter
        const matchesTeam = finalizationTeamFilter === 'ALL' || row.departmentId === finalizationTeamFilter
        const matchesStage = finalizationStageFilter === 'ALL' || row.currentEvaluationStage === finalizationStageFilter
        const matchesStatus =
          finalizationStatusFilter === 'ALL' || row.finalizationReadinessStatus === finalizationStatusFilter
        const matchesBlocker =
          finalizationBlockerFilter === 'ALL' || row.blockerTypes.includes(finalizationBlockerFilter)
        const matchesEvaluator =
          finalizationEvaluatorFilter === 'ALL' ||
          row.firstEvaluatorId === finalizationEvaluatorFilter ||
          row.secondEvaluatorId === finalizationEvaluatorFilter ||
          row.finalEvaluatorId === finalizationEvaluatorFilter
        const matchesPolicy = finalizationPolicyFilter === 'ALL' || row.policyCategoryStatus === finalizationPolicyFilter
        const matchesEvidence = finalizationEvidenceFilter === 'ALL' || row.resultEvidenceStatus === finalizationEvidenceFilter
        const matchesGradePolicy = finalizationGradePolicyFilter === 'ALL' || row.gradePolicyStatus === finalizationGradePolicyFilter
        const matchesFeedback = finalizationFeedbackFilter === 'ALL' || row.feedbackLeadershipStatus === finalizationFeedbackFilter
        const matchesManual = !finalizationManualOnly || row.manualReviewRequired
        return (
          matchesDivision &&
          matchesSection &&
          matchesTeam &&
          matchesStage &&
          matchesStatus &&
          matchesBlocker &&
          matchesEvaluator &&
          matchesPolicy &&
          matchesEvidence &&
          matchesGradePolicy &&
          matchesFeedback &&
          matchesManual
        )
      }),
    [
      finalizationBlockerFilter,
      finalizationCeoRows,
      finalizationDivisionFilter,
      finalizationEvaluatorFilter,
      finalizationEvidenceFilter,
      finalizationFeedbackFilter,
      finalizationGradePolicyFilter,
      finalizationManualOnly,
      finalizationPolicyFilter,
      finalizationSectionFilter,
      finalizationStageFilter,
      finalizationStatusFilter,
      finalizationTeamFilter,
    ]
  )
  const finalizationCombinedTsv = useMemo(
    () => buildFinalizationCeoTsv2026(filteredFinalizationCeoRows, finalizationCeoReadiness?.exportColumns),
    [filteredFinalizationCeoRows, finalizationCeoReadiness?.exportColumns]
  )
  const finalizationBlockedBeforeFirstTsv = useMemo(
    () =>
      buildFinalizationCeoTsv2026(
        finalizationCeoRows.filter((row) =>
          [
            'BLOCKED_SELF_NOT_READY',
            'BLOCKED_RESULT_MISSING',
            'BLOCKED_POLICY_CATEGORY_MISSING',
            'BLOCKED_EVALUATOR_CHAIN',
            'BLOCKED_SCORE_POLICY',
            'BLOCKED_GRADE_POLICY',
            'BLOCKED_FEEDBACK_LEADERSHIP',
            'BLOCKED_AI_READINESS',
          ].includes(row.finalizationReadinessStatus)
        )
      ),
    [finalizationCeoRows]
  )
  const finalizationBlockedBeforeSecondTsv = useMemo(
    () => buildFinalizationCeoTsv2026(finalizationCeoRows.filter((row) => row.finalizationReadinessStatus === 'BLOCKED_FIRST_NOT_READY')),
    [finalizationCeoRows]
  )
  const finalizationBlockedBeforeFinalTsv = useMemo(
    () => buildFinalizationCeoTsv2026(finalizationCeoRows.filter((row) => row.finalizationReadinessStatus === 'BLOCKED_SECOND_NOT_READY')),
    [finalizationCeoRows]
  )
  const finalizationReadyTsv = useMemo(
    () => buildFinalizationCeoTsv2026(finalizationCeoRows.filter((row) => row.finalizationReadinessStatus === 'READY_FOR_FINAL_REVIEW')),
    [finalizationCeoRows]
  )
  const finalizationCeoLaterReadyTsv = useMemo(
    () => buildFinalizationCeoTsv2026(finalizationCeoRows.filter((row) => row.finalizationReadinessStatus === 'READY_FOR_CEO_CONFIRMATION_LATER')),
    [finalizationCeoRows]
  )
  const finalizationManualReviewTsv = useMemo(
    () => buildFinalizationCeoTsv2026(finalizationCeoRows.filter((row) => row.manualReviewRequired)),
    [finalizationCeoRows]
  )
  const teamKpiReviewTsv = useMemo(
    () =>
      buildTsv2026(
        ['teamKpiName', 'division', 'departmentPath', 'owner', 'status', 'decision', 'reason', 'linkedDivisionKpi', 'affectedEmployees', 'suggestedMboCategory', 'notes'],
        filteredTeamReviewRows.map((row) => [
          row.teamKpiName,
          row.divisionName,
          row.departmentPath,
          row.ownerName,
          row.reviewStatusLabel,
          row.hrDecisionLabel,
          row.reason ?? '',
          row.linkedDivisionKpiName ?? '',
          row.affectedActiveEmployeeCount,
          row.suggestedMboCategory,
          row.notes ?? '',
        ])
      ),
    [filteredTeamReviewRows]
  )
  const getTeamReviewDraft = useCallback(
    (row: TeamKpiHrReviewRow2026): TeamKpiHrReviewDecisionDraft2026 => {
      const existing = teamReviewDrafts[row.orgKpiId]
      if (existing) return existing
      return {
        decision: row.reviewStatus === 'PENDING_REVIEW' ? '' : row.reviewStatus,
        reason: row.reason ?? '',
        note: row.notes ?? '',
      }
    },
    [teamReviewDrafts]
  )
  const updateTeamReviewDraft = useCallback(
    (orgKpiId: string, patch: Partial<TeamKpiHrReviewDecisionDraft2026>) => {
      setTeamReviewDrafts((current) => ({
        ...current,
        [orgKpiId]: {
          decision: current[orgKpiId]?.decision ?? '',
          reason: current[orgKpiId]?.reason ?? '',
          note: current[orgKpiId]?.note ?? '',
          ...patch,
        },
      }))
    },
    []
  )
  const toggleTeamReviewSelection = useCallback((orgKpiId: string, checked: boolean) => {
    setSelectedTeamReviewIds((current) => {
      if (checked) return current.includes(orgKpiId) ? current : [...current, orgKpiId]
      return current.filter((id) => id !== orgKpiId)
    })
  }, [])
  const toggleAllVisibleTeamReviews = useCallback(() => {
    const visibleIds = visibleTeamReviewRows.map((row) => row.orgKpiId)
    if (!visibleIds.length) return
    setSelectedTeamReviewIds((current) => {
      const currentSet = new Set(current)
      const allSelected = visibleIds.every((id) => currentSet.has(id))
      if (allSelected) return current.filter((id) => !visibleIds.includes(id))
      for (const id of visibleIds) currentSet.add(id)
      return Array.from(currentSet)
    })
  }, [visibleTeamReviewRows])
  const saveTeamKpiReviewDecision = useCallback(
    async (row: TeamKpiHrReviewRow2026) => {
      if (!props.canManageTeamKpiReview) return
      if (!props.selectedCycleId) {
        setTeamReviewSaveError('먼저 평가 주기를 선택해 주세요.')
        return
      }

      const draft = getTeamReviewDraft(row)
      if (!draft.decision) {
        setTeamReviewSaveError('HR 결정을 선택해 주세요.')
        return
      }
      if (!draft.reason) {
        setTeamReviewSaveError('HR 사유를 선택해 주세요.')
        return
      }

      setTeamReviewSavingId(row.orgKpiId)
      setTeamReviewSaveError('')
      setTeamReviewSaveNotice('')

      try {
        const response = await fetch('/api/evaluation/preview-2026/team-kpi-review-decision', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orgKpiId: row.orgKpiId,
            evalCycleId: props.selectedCycleId,
            decision: draft.decision,
            reason: draft.reason,
            note: draft.note,
          }),
        })
        const json = await response.json().catch(() => null)
        if (!response.ok || !json?.success) {
          throw new Error(json?.error?.message ?? '팀 KPI HR 검토 결정을 저장하지 못했습니다.')
        }

        setTeamReviewSaveNotice(`${row.teamKpiName} 검토 결정을 저장했습니다. 공식 점수/등급은 변경되지 않았습니다.`)
        await props.onLoad()
      } catch (error) {
        setTeamReviewSaveError(error instanceof Error ? error.message : '팀 KPI HR 검토 결정을 저장하지 못했습니다.')
      } finally {
        setTeamReviewSavingId(null)
      }
    },
    [getTeamReviewDraft, props]
  )
  const saveBulkTeamKpiReviewDecision = useCallback(async () => {
    if (!props.canManageTeamKpiReview) return
    if (!props.selectedCycleId) {
      setTeamReviewSaveError('먼저 평가 주기를 선택해 주세요.')
      return
    }
    if (!selectedTeamReviewIds.length) {
      setTeamReviewSaveError('일괄 저장할 팀 KPI를 선택해 주세요.')
      return
    }
    if (!teamReviewBulkDraft.decision) {
      setTeamReviewSaveError('일괄 적용할 HR 결정을 선택해 주세요.')
      return
    }
    if (!teamReviewBulkDraft.reason) {
      setTeamReviewSaveError('일괄 적용할 HR 사유를 선택해 주세요.')
      return
    }

    setTeamReviewBulkSaving(true)
    setTeamReviewSaveError('')
    setTeamReviewSaveNotice('')

    try {
      const response = await fetch('/api/evaluation/preview-2026/team-kpi-review-decision', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgKpiIds: selectedTeamReviewIds,
          evalCycleId: props.selectedCycleId,
          decision: teamReviewBulkDraft.decision,
          reason: teamReviewBulkDraft.reason,
          note: teamReviewBulkDraft.note,
        }),
      })
      const json = await response.json().catch(() => null)
      if (!response.ok || !json?.success) {
        throw new Error(json?.error?.message ?? '팀 KPI HR 검토 결정을 일괄 저장하지 못했습니다.')
      }

      const savedCount = Number(json?.data?.count ?? selectedTeamReviewIds.length)
      setTeamReviewSaveNotice(`${savedCount.toLocaleString()}건의 팀 KPI 검토 결정을 일괄 저장했습니다. 공식 점수/등급은 변경되지 않았습니다.`)
      setSelectedTeamReviewIds([])
      await props.onLoad()
    } catch (error) {
      setTeamReviewSaveError(error instanceof Error ? error.message : '팀 KPI HR 검토 결정을 일괄 저장하지 못했습니다.')
    } finally {
      setTeamReviewBulkSaving(false)
    }
  }, [props, selectedTeamReviewIds, teamReviewBulkDraft])

  return (
    <Panel
      title="2026 readiness population dry-run"
      description="선택한 평가 주기에 대해 SELF 평가와 평가항목을 만들 경우의 범위를 읽기 전용으로 점검합니다."
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-1 rounded-2xl bg-cyan-50 p-2 text-cyan-700">
            <ClipboardList className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="neutral">Dry-run only</Badge>
              <Badge tone={dryRun && blockers.length === 0 ? 'success' : dryRun ? 'warn' : 'neutral'}>
                {dryRun
                  ? blockers.length === 0
                    ? '적용 전 점검 양호'
                    : `${blockers.length}개 차단 조건`
                  : '미확인'}
              </Badge>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              이 기능은 dry-run이며 공식 점수/등급을 변경하지 않습니다. Evaluation, EvaluationItem, Assignment는 생성하거나 수정하지 않습니다.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={props.onLoad}
          disabled={!props.selectedCycleId || props.loading}
          className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
        >
          {props.loading ? '점검 중...' : dryRun ? 'dry-run 다시 실행' : '2026 readiness population dry-run'}
        </button>
      </div>

      {!props.selectedCycleId ? (
        <div className="mt-4">
          <Banner tone="warn" message="평가 주기를 선택한 뒤 population dry-run을 실행할 수 있습니다." />
        </div>
      ) : null}
      {props.error ? <div className="mt-4"><Banner tone="error" message={props.error} /></div> : null}

      {dryRun ? (
        <div className="mt-5 space-y-4">
          <div className="rounded-2xl border border-cyan-100 bg-cyan-50/70 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={dryRun.selectedEvalCycle.isOfficialReadinessTarget ? 'success' : 'warn'}>
                {dryRun.selectedEvalCycle.isOfficialReadinessTarget ? '공식 readiness cycle' : '공식 cycle 미확정'}
              </Badge>
              <span className="text-sm font-semibold text-slate-900">
                {dryRun.selectedEvalCycle.name}
              </span>
              <span className="text-xs text-slate-500">
                {dryRun.selectedEvalCycle.year} · {dryRun.selectedEvalCycle.status}
              </span>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-600">
              cycleId {dryRun.selectedEvalCycle.id} · writesPerformed {String(dryRun.safety.writesPerformed)}
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <MetricCard
              label="재직자"
              value={dryRun.activeEmployeeCount.toLocaleString()}
              help="조직 master 기준"
              compact
            />
            <MetricCard
              label="확정 KPI 보유"
              value={dryRun.employeesWithConfirmedPersonalKpiCount.toLocaleString()}
              help="2026 Personal KPI"
              compact
            />
            <MetricCard
              label="확정 KPI 없음"
              value={dryRun.employeesMissingConfirmedPersonalKpiCount.toLocaleString()}
              help="보완 필요"
              compact
              variant={dryRun.employeesMissingConfirmedPersonalKpiCount > 0 ? 'warning' : 'default'}
            />
            <MetricCard
              label="기존 SELF"
              value={dryRun.existingSelfEvaluationCount.toLocaleString()}
              help="skip 대상"
              compact
            />
            <MetricCard
              label="생성 예상 SELF"
              value={dryRun.wouldCreateSelfEvaluationCount.toLocaleString()}
              help="dry-run preview"
              compact
              emphasized
            />
            <MetricCard
              label="생성 예상 항목"
              value={dryRun.wouldCreateEvaluationItemCount.toLocaleString()}
              help="confirmed KPI 기준"
              compact
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="기존 항목 skip"
              value={dryRun.existingEvaluationItemsSkippedCount.toLocaleString()}
              help="기존 SELF 보존"
              compact
            />
            <MetricCard
              label="policyCategory 누락"
              value={dryRun.policyCategoryMissingCount.toLocaleString()}
              help="mapping 필요"
              compact
              variant={dryRun.policyCategoryMissingCount > 0 ? 'warning' : 'default'}
            />
            <MetricCard
              label="Division 매핑"
              value={`${dryRun.divisionSalesMappingCoverage.mappedDivisions}/${dryRun.divisionSalesMappingCoverage.totalDivisions}`}
              help="SALES/NON_SALES"
              compact
              variant={dryRun.divisionSalesMappingCoverage.unmappedDivisions > 0 ? 'warning' : 'default'}
            />
            <MetricCard
              label="팀 override"
              value={dryRun.departmentOverrideCoverage.savedOverrideCount.toLocaleString()}
              help={`${dryRun.departmentOverrideCoverage.affectedActiveEmployeeCount}명 영향`}
              compact
            />
            <MetricCard
              label="policyCategory mapped"
              value={dryRun.policyCategoryMappingReadiness.mappedPolicyCategoryCount.toLocaleString()}
              help={`manual-review ${dryRun.policyCategoryMappingReadiness.manualReviewCount.toLocaleString()}건`}
              compact
              variant={dryRun.policyCategoryMappingReadiness.manualReviewCount > 0 ? 'warning' : 'default'}
            />
            <MetricCard
              label="ORG_GOAL source warning"
              value={dryRun.policyCategoryMappingReadiness.orgGoalWithoutApprovedSourceCount.toLocaleString()}
              help="본부/HR 승인 팀 KPI 필요"
              compact
              variant={dryRun.policyCategoryMappingReadiness.orgGoalWithoutApprovedSourceCount > 0 ? 'warning' : 'default'}
            />
            <MetricCard
              label="bulk mapping saved"
              value={dryRun.policyCategoryMappingReadiness.bulkMappingSavedCount.toLocaleString()}
              help="HR metadata audit"
              compact
            />
          </div>

          {mboCoverage ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">2026 MBO setup coverage</h4>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    직원들이 2026 Personal KPI를 작성·제출·확정하는 준비 현황입니다. 이 요약은 read-only이며 Evaluation/EvaluationItem을 만들지 않습니다.
                  </p>
                </div>
                <Badge tone="neutral">MBO setup only</Badge>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                <MetricCard
                  label="초안 보유"
                  value={mboCoverage.employeesWithDraftPersonalKpiCount.toLocaleString()}
                  help="작성 중 직원"
                  compact
                />
                <MetricCard
                  label="제출/검토 중"
                  value={mboCoverage.employeesWithSubmittedPersonalKpiCount.toLocaleString()}
                  help="리더 확인 필요"
                  compact
                />
                <MetricCard
                  label="확정 보유"
                  value={mboCoverage.employeesWithConfirmedPersonalKpiCount.toLocaleString()}
                  help="population 후보"
                  compact
                />
                <MetricCard
                  label="MBO 없음"
                  value={mboCoverage.employeesMissingAnyPersonalKpiCount.toLocaleString()}
                  help="작성 시작 필요"
                  compact
                  variant={mboCoverage.employeesMissingAnyPersonalKpiCount > 0 ? 'warning' : 'default'}
                />
                <MetricCard
                  label="카테고리 미분류"
                  value={mboCoverage.categoryDistribution.UNMAPPED.toLocaleString()}
                  help="HR mapping 필요"
                  compact
                  variant={mboCoverage.categoryDistribution.UNMAPPED > 0 ? 'warning' : 'default'}
                />
                <MetricCard
                  label="조직 KPI 연결"
                  value={mboCoverage.linkedOrgKpiPersonalKpiCount.toLocaleString()}
                  help="alignment coverage"
                  compact
                />
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {(['ORG_GOAL', 'PROJECT_T', 'PROJECT_K', 'DAILY_WORK'] as const).map((category) => (
                  <MetricCard
                    key={category}
                    label={category}
                    value={mboCoverage.categoryDistribution[category].toLocaleString()}
                    help="2026 policyCategory"
                    compact
                  />
                ))}
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h5 className="text-sm font-semibold text-slate-900">작성 품질 경고</h5>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {[
                      ['ORG_GOAL without eligible KPI', mboCoverage.warningCounts.orgGoalWithoutEligibleOrgKpi],
                      ['DAILY_WORK duplicate risk', mboCoverage.warningCounts.dailyWorkDuplicateRisk],
                      ['missing weight', mboCoverage.warningCounts.missingWeight],
                      ['missing plan/how', mboCoverage.warningCounts.missingPlan],
                      ['missing measurable target', mboCoverage.warningCounts.missingMeasurableTarget],
                      ['missing owner contribution', mboCoverage.warningCounts.missingOwnerContribution],
                    ].map(([label, value]) => (
                      <div key={label} className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 text-xs">
                        <span className="text-slate-600">{label}</span>
                        <span className={Number(value) > 0 ? 'font-semibold text-amber-700' : 'font-semibold text-emerald-700'}>
                          {Number(value).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h5 className="text-sm font-semibold text-slate-900">본부별 coverage summary</h5>
                  <ul className="mt-3 divide-y divide-slate-200">
                    {topDivisionCoverage.length ? topDivisionCoverage.map((division) => (
                      <li key={division.divisionId} className="py-2 text-xs">
                        <div className="font-semibold text-slate-800">{division.divisionName}</div>
                        <div className="mt-1 text-slate-500">
                          재직 {division.activeEmployeeCount}명 · 미작성 {division.missingAnyPersonalKpiEmployeeCount}명 · 초안 {division.draftPersonalKpiEmployeeCount}명 · 제출 {division.submittedPersonalKpiEmployeeCount}명 · 확정 {division.confirmedPersonalKpiEmployeeCount}명 · 완료율 {getCompletionRateLabel2026(division.confirmedPersonalKpiEmployeeCount, division.activeEmployeeCount)}
                        </div>
                      </li>
                    )) : <li className="py-2 text-xs text-slate-500">division coverage가 없습니다.</li>}
                  </ul>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <h5 className="text-sm font-semibold text-slate-900">팀별 미작성/확정 현황</h5>
                <ul className="mt-3 grid gap-2 md:grid-cols-2">
                  {topTeamCoverage.length ? topTeamCoverage.map((team) => (
                    <li key={team.departmentId} className="rounded-xl bg-white px-3 py-2 text-xs">
                      <div className="font-semibold text-slate-800">{team.departmentPath}</div>
                      <div className="mt-1 text-slate-500">
                        재직 {team.activeEmployeeCount}명 · 미작성 {team.missingAnyPersonalKpiEmployeeCount}명 · 초안 {team.draftPersonalKpiEmployeeCount}명 · 제출 {team.submittedPersonalKpiEmployeeCount}명 · 확정 {team.confirmedPersonalKpiEmployeeCount}명 · 완료율 {getCompletionRateLabel2026(team.confirmedPersonalKpiEmployeeCount, team.activeEmployeeCount)}
                      </div>
                    </li>
                  )) : <li className="rounded-xl bg-white px-3 py-2 text-xs text-slate-500">팀 coverage가 없습니다.</li>}
                </ul>
              </div>

              {monitoring ? (
                <div className="mt-4 rounded-2xl border border-cyan-100 bg-cyan-50/60 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h5 className="text-sm font-semibold text-slate-900">HR MBO setup monitoring</h5>
                      <p className="mt-1 text-xs leading-5 text-slate-600">
                        누가 작성 요청, 제출 요청, 리더 검토, 카테고리 확정이 필요한지 확인하는 read-only 목록입니다. 알림 발송이나 데이터 수정은 하지 않습니다.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void copyMonitoringTable('missing', missingMboTsv)}
                        className="rounded-full border border-cyan-200 bg-white px-3 py-1.5 text-xs font-semibold text-cyan-700 transition hover:bg-cyan-50"
                      >
                        {copiedMonitoringTable === 'missing' ? 'MBO 없음 복사됨' : 'MBO 없음 복사'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void copyMonitoringTable('submitted', submittedReviewingTsv)}
                        className="rounded-full border border-cyan-200 bg-white px-3 py-1.5 text-xs font-semibold text-cyan-700 transition hover:bg-cyan-50"
                      >
                        {copiedMonitoringTable === 'submitted' ? '제출/검토 복사됨' : '제출/검토 복사'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void copyMonitoringTable('policy-category', policyCategoryMissingTsv)}
                        className="rounded-full border border-cyan-200 bg-white px-3 py-1.5 text-xs font-semibold text-cyan-700 transition hover:bg-cyan-50"
                      >
                        {copiedMonitoringTable === 'policy-category' ? '카테고리 누락 복사됨' : '카테고리 누락 복사'}
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <label className="text-xs font-semibold text-slate-600">
                      본부
                      <select
                        value={monitorDivisionFilter}
                        onChange={(event) => {
                          setMonitorDivisionFilter(event.target.value)
                          setMonitorTeamFilter('ALL')
                        }}
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700"
                      >
                        <option value="ALL">전체 본부</option>
                        {divisionOptions.map(([divisionId, divisionName]) => (
                          <option key={divisionId} value={divisionId}>{divisionName}</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs font-semibold text-slate-600">
                      팀
                      <select
                        value={monitorTeamFilter}
                        onChange={(event) => setMonitorTeamFilter(event.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700"
                      >
                        <option value="ALL">전체 팀</option>
                        {teamOptions.map(([departmentId, departmentPath]) => (
                          <option key={departmentId} value={departmentId}>{departmentPath}</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs font-semibold text-slate-600">
                      상태
                      <select
                        value={monitorStatusFilter}
                        onChange={(event) => setMonitorStatusFilter(event.target.value as MboSetupMonitoringStatus2026 | 'ALL')}
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700"
                      >
                        {(['ALL', 'MISSING', 'DRAFT', 'SUBMITTED_REVIEWING', 'CONFIRMED'] as const).map((status) => (
                          <option key={status} value={status}>{getMboSetupStatusLabel2026(status)}</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs font-semibold text-slate-600">
                      리더/관리자
                      <select
                        value={monitorManagerFilter}
                        onChange={(event) => setMonitorManagerFilter(event.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700"
                      >
                        <option value="ALL">전체 리더</option>
                        {managerOptions.map(([managerId, managerName]) => (
                          <option key={managerId} value={managerId}>{managerName}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="mt-4 rounded-2xl border border-slate-200 bg-white">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
                      <h6 className="text-sm font-semibold text-slate-900">직원별 MBO 작성 상태</h6>
                      <span className="text-xs text-slate-500">
                        {filteredEmployeeRows.length.toLocaleString()}명 표시 · 전체 {employeeRows.length.toLocaleString()}명
                      </span>
                    </div>
                    <div className="max-h-96 overflow-auto">
                      <table className="min-w-full divide-y divide-slate-100 text-left text-xs">
                        <thead className="sticky top-0 bg-slate-50 text-slate-500">
                          <tr>
                            <th className="px-4 py-2 font-semibold">직원</th>
                            <th className="px-4 py-2 font-semibold">조직</th>
                            <th className="px-4 py-2 font-semibold">리더</th>
                            <th className="px-4 py-2 font-semibold">상태</th>
                            <th className="px-4 py-2 font-semibold">KPI</th>
                            <th className="px-4 py-2 font-semibold">HR action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {filteredEmployeeRows.slice(0, 120).map((row) => (
                            <tr key={row.employeeId}>
                              <td className="px-4 py-3">
                                <div className="font-semibold text-slate-900">{row.employeeName}</div>
                                <div className="text-slate-400">{row.employeeNo ?? '사번 없음'}</div>
                              </td>
                              <td className="px-4 py-3 text-slate-600">{row.departmentPath}</td>
                              <td className="px-4 py-3 text-slate-600">{row.managerName}</td>
                              <td className="px-4 py-3">
                                <Badge tone={getMboSetupStatusTone2026(row.status)}>{getMboSetupStatusLabel2026(row.status)}</Badge>
                              </td>
                              <td className="px-4 py-3 text-slate-600">
                                전체 {row.totalPersonalKpiCount} · 초안 {row.draftPersonalKpiCount} · 제출 {row.submittedPersonalKpiCount + row.managerReviewPersonalKpiCount} · 확정 {row.confirmedPersonalKpiCount}
                              </td>
                              <td className="px-4 py-3 font-semibold text-slate-700">{row.actionLabel}</td>
                            </tr>
                          ))}
                          {filteredEmployeeRows.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="px-4 py-6 text-center text-slate-500">필터 조건에 맞는 직원이 없습니다.</td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>
                    {filteredEmployeeRows.length > 120 ? (
                      <div className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
                        화면에는 120명까지만 표시합니다. 전체 목록은 복사 버튼으로 추출해 주세요.
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-4 rounded-2xl border border-amber-200 bg-white">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-100 px-4 py-3">
                      <h6 className="text-sm font-semibold text-amber-900">policyCategory missing items</h6>
                      <span className="text-xs text-amber-700">
                        {filteredPolicyCategoryMissingRows.length.toLocaleString()}건 표시 · 전체 {policyCategoryMissingRows.length.toLocaleString()}건
                      </span>
                    </div>
                    <div className="max-h-72 overflow-auto">
                      <table className="min-w-full divide-y divide-slate-100 text-left text-xs">
                        <thead className="sticky top-0 bg-amber-50 text-amber-700">
                          <tr>
                            <th className="px-4 py-2 font-semibold">직원</th>
                            <th className="px-4 py-2 font-semibold">조직</th>
                            <th className="px-4 py-2 font-semibold">KPI</th>
                            <th className="px-4 py-2 font-semibold">연결 조직 KPI</th>
                            <th className="px-4 py-2 font-semibold">HR action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {filteredPolicyCategoryMissingRows.slice(0, 120).map((row) => (
                            <tr key={row.personalKpiId}>
                              <td className="px-4 py-3">
                                <div className="font-semibold text-slate-900">{row.employeeName}</div>
                                <div className="text-slate-400">{row.employeeNo ?? '사번 없음'} · {row.managerName}</div>
                              </td>
                              <td className="px-4 py-3 text-slate-600">{row.departmentPath}</td>
                              <td className="px-4 py-3 font-semibold text-slate-800">{row.personalKpiName}</td>
                              <td className="px-4 py-3 text-slate-600">{row.linkedOrgKpiTitle ?? '연결 없음'}</td>
                              <td className="px-4 py-3 font-semibold text-amber-800">{row.actionLabel}</td>
                            </tr>
                          ))}
                          {filteredPolicyCategoryMissingRows.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="px-4 py-6 text-center text-slate-500">카테고리 누락 항목이 없습니다.</td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : null}

              {followUpGroups.length ? (
                <div className="mt-4 rounded-2xl border border-violet-100 bg-violet-50/60 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h5 className="text-sm font-semibold text-slate-900">2026 MBO 후속조치 안내</h5>
                        <Badge tone="neutral">Copy-only</Badge>
                        <Badge tone="neutral">알림 발송 없음</Badge>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-slate-600">
                        HR이 MBO 미작성자, 초안 보유자, 리더 검토 대상, policyCategory 미분류, 팀 KPI 검토 대상을 나누어 안내문과 수신자 목록을 복사하는 read-only 도구입니다.
                      </p>
                      <p className="mt-1 text-xs leading-5 text-violet-700">
                        이 화면은 HR 후속조치용 안내/복사 도구입니다. 알림 발송, 평가 생성, 점수/등급 변경은 수행하지 않습니다.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void copyMonitoringTable('follow-up-recipients', followUpRecipientList)}
                        disabled={!filteredFollowUpRows.length}
                        className="rounded-full border border-violet-200 bg-white px-3 py-1.5 text-xs font-semibold text-violet-700 transition hover:bg-violet-50 disabled:opacity-50"
                      >
                        {copiedMonitoringTable === 'follow-up-recipients' ? '대상 목록 복사됨' : '선택 조건 대상 목록 복사'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void copyMonitoringTable('follow-up-template', selectedFollowUpTemplate)}
                        disabled={!selectedFollowUpTemplate}
                        className="rounded-full border border-violet-200 bg-white px-3 py-1.5 text-xs font-semibold text-violet-700 transition hover:bg-violet-50 disabled:opacity-50"
                      >
                        {copiedMonitoringTable === 'follow-up-template' ? '메시지 복사됨' : '선택 조건 메시지 복사'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void copyMonitoringTable('follow-up-table', followUpCombinedTsv)}
                        disabled={!filteredFollowUpRows.length}
                        className="rounded-full border border-violet-200 bg-white px-3 py-1.5 text-xs font-semibold text-violet-700 transition hover:bg-violet-50 disabled:opacity-50"
                      >
                        {copiedMonitoringTable === 'follow-up-table' ? '후속조치 테이블 복사됨' : '후속조치 테이블 복사'}
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    <label className="text-xs font-semibold text-slate-600">
                      본부
                      <select
                        value={followUpDivisionFilter}
                        onChange={(event) => {
                          setFollowUpDivisionFilter(event.target.value)
                          setFollowUpTeamFilter('ALL')
                        }}
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700"
                      >
                        <option value="ALL">전체 본부</option>
                        {followUpDivisionOptions.map(([divisionId, divisionName]) => (
                          <option key={divisionId} value={divisionId}>{divisionName}</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs font-semibold text-slate-600">
                      팀
                      <select
                        value={followUpTeamFilter}
                        onChange={(event) => setFollowUpTeamFilter(event.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700"
                      >
                        <option value="ALL">전체 팀</option>
                        {followUpTeamOptions.map(([departmentId, departmentPath]) => (
                          <option key={departmentId} value={departmentId}>{departmentPath}</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs font-semibold text-slate-600">
                      리더
                      <select
                        value={followUpLeaderFilter}
                        onChange={(event) => setFollowUpLeaderFilter(event.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700"
                      >
                        <option value="ALL">전체 리더</option>
                        {followUpLeaderOptions.map(([leaderId, leaderName]) => (
                          <option key={leaderId} value={leaderId}>{leaderName}</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs font-semibold text-slate-600">
                      후속조치 유형
                      <select
                        value={followUpTypeFilter}
                        onChange={(event) => setFollowUpTypeFilter(event.target.value as MboFollowUpType2026 | 'ALL')}
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700"
                      >
                        {MBO_FOLLOW_UP_TYPES_2026.map((type) => (
                          <option key={type} value={type}>{getMboFollowUpTypeLabel2026(type)}</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs font-semibold text-slate-600">
                      MBO status
                      <select
                        value={followUpStatusFilter}
                        onChange={(event) => setFollowUpStatusFilter(event.target.value as MboFollowUpStatusFilter2026 | 'ALL')}
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700"
                      >
                        {MBO_FOLLOW_UP_STATUS_FILTERS_2026.map((status) => (
                          <option key={status} value={status}>{getMboFollowUpStatusLabel2026(status)}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="mt-4 grid gap-3 lg:grid-cols-2 xl:grid-cols-5">
                    {filteredFollowUpGroups.map((group) => (
                      <div key={group.type} className="rounded-2xl border border-violet-100 bg-white p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h6 className="text-sm font-semibold text-slate-900">{group.label}</h6>
                              <Badge tone={getMboFollowUpTypeTone2026(group.type)}>{group.actionLabel}</Badge>
                            </div>
                            <p className="mt-1 text-xs leading-5 text-slate-500">{group.description}</p>
                          </div>
                          <div className="text-right text-lg font-bold text-violet-800">{group.rows.length.toLocaleString()}</div>
                        </div>
                        <div className="mt-3 space-y-1 text-xs leading-5 text-slate-600">
                          <div>상위 본부: {formatTopFollowUpValues2026(group.rows.map((row) => row.divisionName))}</div>
                          <div>상위 팀: {formatTopFollowUpValues2026(group.rows.map((row) => row.departmentPath))}</div>
                          <div>담당 리더: {formatTopFollowUpValues2026(group.rows.map((row) => row.leaderName), '리더 미지정')}</div>
                          <div>후속 기한: HR 안내 기준 (저장된 기한 없음)</div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => void copyMonitoringTable(`follow-up-recipients-${group.type}`, buildMboFollowUpRecipientList2026(group.rows))}
                            disabled={!group.rows.length}
                            className="rounded-full border border-violet-200 px-3 py-1.5 text-xs font-semibold text-violet-700 transition hover:bg-violet-50 disabled:opacity-50"
                          >
                            {copiedMonitoringTable === `follow-up-recipients-${group.type}` ? '수신자 복사됨' : '수신자 목록 복사'}
                          </button>
                          <button
                            type="button"
                            onClick={() => void copyMonitoringTable(`follow-up-template-${group.type}`, group.template)}
                            className="rounded-full border border-violet-200 px-3 py-1.5 text-xs font-semibold text-violet-700 transition hover:bg-violet-50"
                          >
                            {copiedMonitoringTable === `follow-up-template-${group.type}` ? '템플릿 복사됨' : '메시지 템플릿 복사'}
                          </button>
                          <Link href={group.href} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50">
                            관련 화면
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 rounded-2xl border border-slate-200 bg-white">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
                      <h6 className="text-sm font-semibold text-slate-900">후속조치 대상 preview</h6>
                      <span className="text-xs text-slate-500">
                        {filteredFollowUpRows.length.toLocaleString()}건 표시 · 전체 {followUpRows.length.toLocaleString()}건
                      </span>
                    </div>
                    <div className="max-h-72 overflow-auto">
                      <table className="min-w-full divide-y divide-slate-100 text-left text-xs">
                        <thead className="sticky top-0 bg-violet-50 text-violet-700">
                          <tr>
                            <th className="px-4 py-2 font-semibold">대상</th>
                            <th className="px-4 py-2 font-semibold">조직</th>
                            <th className="px-4 py-2 font-semibold">리더</th>
                            <th className="px-4 py-2 font-semibold">후속조치</th>
                            <th className="px-4 py-2 font-semibold">상세</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {filteredFollowUpRows.slice(0, 100).map((row) => (
                            <tr key={row.id}>
                              <td className="px-4 py-3">
                                <div className="font-semibold text-slate-900">{row.name}</div>
                                <div className="text-slate-400">{row.employeeNo ?? '사번 없음'}{row.email ? ` · ${row.email}` : ''}</div>
                              </td>
                              <td className="px-4 py-3 text-slate-600">{row.departmentPath}</td>
                              <td className="px-4 py-3 text-slate-600">{row.leaderName}</td>
                              <td className="px-4 py-3">
                                <Badge tone={getMboFollowUpTypeTone2026(row.type)}>{row.actionLabel}</Badge>
                                <div className="mt-1 text-slate-400">{row.typeLabel}</div>
                              </td>
                              <td className="px-4 py-3 text-slate-600">{row.detail}</td>
                            </tr>
                          ))}
                          {filteredFollowUpRows.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="px-4 py-6 text-center text-slate-500">후속조치 필터 조건에 맞는 대상이 없습니다.</td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>
                    {filteredFollowUpRows.length > 100 ? (
                      <div className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
                        화면에는 100건까지만 표시합니다. 전체 대상은 후속조치 테이블 복사로 추출해 주세요.
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-violet-700">
                    <Link href="/kpi/personal" className="font-semibold underline-offset-2 hover:underline">/kpi/personal</Link>
                    <Link href="/evaluation/performance" className="font-semibold underline-offset-2 hover:underline">/evaluation/performance</Link>
                    <Link href="/admin/performance-calendar" className="font-semibold underline-offset-2 hover:underline">/admin/performance-calendar</Link>
                  </div>
                </div>
              ) : null}

              {scorePolicyReadiness ? (
                <div className="mt-4 rounded-2xl border border-sky-100 bg-sky-50/60 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h5 className="text-sm font-semibold text-slate-900">2026 성과점수 정책 readiness</h5>
                        <Badge tone="neutral">PPT 기준</Badge>
                        <Badge tone="neutral">Read-only simulator</Badge>
                        <Badge tone="neutral">공식 점수 미적용</Badge>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-slate-600">
                        조직성과 30% + 개인성과 70%, MBO category별 기준점·가중치 cap·±5 조정 원칙을 읽기 전용으로 점검합니다.
                      </p>
                      <p className="mt-1 text-xs leading-5 text-sky-700">
                        이 계산은 preview/simulation이며 공식 점수 또는 등급에 반영되지 않습니다. AI 활용평가는 연간 업적평가 점수에서 제외됩니다.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void copyMonitoringTable('score-policy-violations', scorePolicyViolationTsv)}
                      disabled={!filteredScorePolicyViolationRows.length}
                      className="rounded-full border border-sky-200 bg-white px-3 py-1.5 text-xs font-semibold text-sky-700 transition hover:bg-sky-50 disabled:opacity-50"
                    >
                      {copiedMonitoringTable === 'score-policy-violations' ? '위반사항 복사됨' : '위반사항 복사'}
                    </button>
                  </div>

                  {scorePolicyReadiness.emptyStateMessage ? (
                    <div className="mt-3">
                      <Banner tone="warn" message={scorePolicyReadiness.emptyStateMessage} />
                    </div>
                  ) : null}

                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                    <MetricCard
                      label="조직성과"
                      value={`${scorePolicyReadiness.scoreSplit.organizationPerformanceWeight}%`}
                      help="본부/실/팀 combined"
                      compact
                    />
                    <MetricCard
                      label="개인성과"
                      value={`${scorePolicyReadiness.scoreSplit.personalPerformanceWeight}%`}
                      help="MBO personal"
                      compact
                    />
                    <MetricCard
                      label="MBO 점검"
                      value={scorePolicyReadiness.summary.checkedPersonalKpiCount.toLocaleString()}
                      help="작성 중 포함"
                      compact
                    />
                    <MetricCard
                      label="위반사항"
                      value={scorePolicyReadiness.summary.violationsCount.toLocaleString()}
                      help="현재 MBO 점검"
                      compact
                      variant={scorePolicyReadiness.summary.violationsCount > 0 ? 'warning' : 'default'}
                    />
                    <MetricCard
                      label="가중치 cap"
                      value={scorePolicyReadiness.summary.weightCapViolationCount.toLocaleString()}
                      help="초과/합계"
                      compact
                      variant={scorePolicyReadiness.summary.weightCapViolationCount > 0 ? 'warning' : 'default'}
                    />
                    <MetricCard
                      label="AI 점수"
                      value={scorePolicyReadiness.aiExcludedFromAnnualScore ? '제외' : '확인 필요'}
                      help="연간 업적평가"
                      compact
                    />
                  </div>

                  <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                    <div className="rounded-2xl border border-slate-200 bg-white">
                      <div className="border-b border-slate-100 px-4 py-3">
                        <h6 className="text-sm font-semibold text-slate-900">category score table</h6>
                        <p className="mt-1 text-xs text-slate-500">Target / Excellent 점수와 category·item 가중치 cap입니다.</p>
                      </div>
                      <div className="overflow-auto">
                        <table className="min-w-full divide-y divide-slate-100 text-left text-xs">
                          <thead className="bg-slate-50 text-slate-500">
                            <tr>
                              <th className="px-4 py-2 font-semibold">category</th>
                              <th className="px-4 py-2 font-semibold">Target</th>
                              <th className="px-4 py-2 font-semibold">Excellent</th>
                              <th className="px-4 py-2 font-semibold">가중치 cap</th>
                              <th className="px-4 py-2 font-semibold">조정</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {scorePolicyReadiness.categoryRules.map((rule) => (
                              <tr key={rule.category}>
                                <td className="px-4 py-3">
                                  <div className="font-semibold text-slate-900">{rule.label}</div>
                                  <div className="text-slate-400">{rule.category}</div>
                                </td>
                                <td className="px-4 py-3 text-slate-600">{rule.targetScore ?? '-'}</td>
                                <td className="px-4 py-3 text-slate-600">
                                  {rule.excellentScore ?? (rule.maxScore ? `max ${rule.maxScore}` : '-')}
                                </td>
                                <td className="px-4 py-3 text-slate-600">
                                  {rule.categoryWeightCap ? `category ${rule.categoryWeightCap}% · ` : ''}
                                  {rule.itemWeightCap ? `item ${rule.itemWeightCap}%` : 'remaining weight'}
                                </td>
                                <td className="px-4 py-3 text-slate-600">
                                  {rule.adjustmentAllowed ? `${rule.adjustmentRange?.min}~+${rule.adjustmentRange?.max}` : '미적용'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <h6 className="text-sm font-semibold text-slate-900">score simulator</h6>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        저장하지 않는 로컬 preview입니다. 가중 기여도는 adjusted score × weight로만 계산합니다.
                      </p>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <label className="text-xs font-semibold text-slate-600">
                          category
                          <select
                            value={simulatorCategory}
                            onChange={(event) => setSimulatorCategory(event.target.value as ScorePolicyCategory2026)}
                            className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700"
                          >
                            {scorePolicyReadiness.categoryRules.map((rule) => (
                              <option key={rule.category} value={rule.category}>{rule.label}</option>
                            ))}
                          </select>
                        </label>
                        <label className="text-xs font-semibold text-slate-600">
                          achievement
                          <select
                            value={simulatorAchievement}
                            onChange={(event) => setSimulatorAchievement(event.target.value as 'BELOW_TARGET' | 'TARGET' | 'EXCELLENT')}
                            className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700"
                          >
                            <option value="BELOW_TARGET">below target</option>
                            <option value="TARGET">target</option>
                            <option value="EXCELLENT">excellent</option>
                          </select>
                        </label>
                        <label className="text-xs font-semibold text-slate-600">
                          weight %
                          <input
                            type="number"
                            value={simulatorWeight}
                            onChange={(event) => setSimulatorWeight(event.target.value)}
                            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal text-slate-700"
                          />
                        </label>
                        <label className="text-xs font-semibold text-slate-600">
                          base score
                          <input
                            type="number"
                            value={simulatorBaseScore}
                            onChange={(event) => setSimulatorBaseScore(event.target.value)}
                            placeholder="정책 기준 자동"
                            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal text-slate-700"
                          />
                        </label>
                        <label className="text-xs font-semibold text-slate-600">
                          adjustment
                          <input
                            type="number"
                            value={simulatorAdjustment}
                            onChange={(event) => setSimulatorAdjustment(event.target.value)}
                            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal text-slate-700"
                          />
                        </label>
                        <label className="text-xs font-semibold text-slate-600">
                          adjustment reason
                          <input
                            value={simulatorAdjustmentReason}
                            onChange={(event) => setSimulatorAdjustmentReason(event.target.value)}
                            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal text-slate-700"
                            placeholder="개인 기여 차이 근거"
                          />
                        </label>
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-3">
                        <MetricCard label="base" value={simulatorBaseScoreValue.toFixed(1)} help="preview" compact />
                        <MetricCard label="adjusted" value={simulatorAdjustedScore.toFixed(1)} help="±5 check" compact />
                        <MetricCard label="weighted" value={simulatorWeightedContribution.toFixed(1)} help="기여도" compact />
                      </div>
                      <ul className="mt-3 space-y-1 text-xs text-amber-800">
                        {simulatorWarnings.map((warning) => (
                          <li key={warning}>- {warning}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h6 className="text-sm font-semibold text-slate-900">현재 MBO 점검 위반사항</h6>
                        <p className="mt-1 text-xs text-slate-500">
                          category missing, 가중치 cap, ORG_GOAL 승인 소스, Target/Excellent 기준, DAILY_WORK 중복 신호를 확인합니다.
                        </p>
                      </div>
                      <span className="text-xs text-slate-500">
                        {filteredScorePolicyViolationRows.length.toLocaleString()}건 표시 · 전체 {scorePolicyViolationRows.length.toLocaleString()}건
                      </span>
                    </div>

                    <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                      <label className="text-xs font-semibold text-slate-600">
                        본부
                        <select
                          value={scorePolicyDivisionFilter}
                          onChange={(event) => {
                            setScorePolicyDivisionFilter(event.target.value)
                            setScorePolicyTeamFilter('ALL')
                          }}
                          className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700"
                        >
                          <option value="ALL">전체 본부</option>
                          {scorePolicyDivisionOptions.map(([divisionId, divisionName]) => (
                            <option key={divisionId} value={divisionId}>{divisionName}</option>
                          ))}
                        </select>
                      </label>
                      <label className="text-xs font-semibold text-slate-600">
                        팀
                        <select
                          value={scorePolicyTeamFilter}
                          onChange={(event) => setScorePolicyTeamFilter(event.target.value)}
                          className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700"
                        >
                          <option value="ALL">전체 팀</option>
                          {scorePolicyTeamOptions.map(([departmentId, departmentPath]) => (
                            <option key={departmentId} value={departmentId}>{departmentPath}</option>
                          ))}
                        </select>
                      </label>
                      <label className="text-xs font-semibold text-slate-600">
                        직원
                        <select
                          value={scorePolicyEmployeeFilter}
                          onChange={(event) => setScorePolicyEmployeeFilter(event.target.value)}
                          className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700"
                        >
                          <option value="ALL">전체 직원</option>
                          {scorePolicyEmployeeOptions.map(([employeeId, employeeName]) => (
                            <option key={employeeId} value={employeeId}>{employeeName}</option>
                          ))}
                        </select>
                      </label>
                      <label className="text-xs font-semibold text-slate-600">
                        category
                        <select
                          value={scorePolicyCategoryFilter}
                          onChange={(event) => setScorePolicyCategoryFilter(event.target.value as ScorePolicyCategory2026 | 'UNMAPPED' | 'ALL')}
                          className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700"
                        >
                          <option value="ALL">전체 category</option>
                          <option value="UNMAPPED">미분류</option>
                          {scorePolicyReadiness.categoryRules.map((rule) => (
                            <option key={rule.category} value={rule.category}>{rule.label}</option>
                          ))}
                        </select>
                      </label>
                      <label className="text-xs font-semibold text-slate-600">
                        violation type
                        <select
                          value={scorePolicyViolationFilter}
                          onChange={(event) => setScorePolicyViolationFilter(event.target.value)}
                          className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700"
                        >
                          <option value="ALL">전체 위반</option>
                          {scorePolicyViolationOptions.map((code) => (
                            <option key={code} value={code}>{code}</option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <div className="mt-4 max-h-96 overflow-auto rounded-xl border border-slate-100">
                      <table className="min-w-full divide-y divide-slate-100 text-left text-xs">
                        <thead className="sticky top-0 bg-slate-50 text-slate-500">
                          <tr>
                            <th className="px-4 py-2 font-semibold">직원</th>
                            <th className="px-4 py-2 font-semibold">조직</th>
                            <th className="px-4 py-2 font-semibold">MBO</th>
                            <th className="px-4 py-2 font-semibold">위반사항</th>
                            <th className="px-4 py-2 font-semibold">현재/기준</th>
                            <th className="px-4 py-2 font-semibold">HR action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {filteredScorePolicyViolationRows.slice(0, 120).map((row, index) => (
                            <tr key={`${row.code}-${row.personalKpiId ?? row.employeeId ?? index}-${index}`}>
                              <td className="px-4 py-3">
                                <div className="font-semibold text-slate-900">{row.employeeName}</div>
                                <div className="text-slate-400">{row.employeeNo ?? '사번 없음'}</div>
                              </td>
                              <td className="px-4 py-3 text-slate-600">{row.departmentPath}</td>
                              <td className="px-4 py-3">
                                <div className="font-semibold text-slate-800">{row.personalKpiName ?? '-'}</div>
                                <div className="text-slate-400">{row.category ?? 'UNMAPPED'} · weight {row.weight ?? '-'}</div>
                              </td>
                              <td className="px-4 py-3">
                                <Badge tone={row.severity === 'BLOCKER' ? 'warn' : 'neutral'}>{row.code}</Badge>
                                <div className="mt-1 text-slate-500">{row.message}</div>
                              </td>
                              <td className="px-4 py-3 text-slate-600">{row.currentValue ?? '-'} / {row.limitValue ?? '-'}</td>
                              <td className="px-4 py-3 font-semibold text-sky-800">{row.actionLabel}</td>
                            </tr>
                          ))}
                          {filteredScorePolicyViolationRows.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="px-4 py-6 text-center text-slate-500">필터 조건에 맞는 위반사항이 없습니다.</td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
                      {scorePolicyReadiness.adjustmentReadinessWarnings.join(' · ')}
                    </div>
                  </div>
                </div>
              ) : null}

              {resultWritingReadiness ? (
                <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h5 className="text-sm font-semibold text-slate-900">2026 수행결과 작성 readiness</h5>
                        <Badge tone="neutral">Read-only</Badge>
                        <Badge tone="neutral">저장 없음</Badge>
                        <Badge tone="neutral">공식 점수 미적용</Badge>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-slate-600">
                        이 화면은 2026 수행결과 작성 readiness를 점검합니다. 공식 점수/등급은 변경되지 않습니다.
                      </p>
                      <p className="mt-1 text-xs leading-5 text-emerald-700">
                        수행결과는 달성 여부만이 아니라 본인 기여, 산출물, 증빙 중심으로 작성해야 합니다. AI 활용평가 증빙은 연간 업적점수와 별도로 관리됩니다.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void copyMonitoringTable('result-writing-missing-result', resultWritingMissingResultTsv)}
                        disabled={resultWritingReadiness.summary.missingResultCount === 0}
                        className="rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-50"
                      >
                        {copiedMonitoringTable === 'result-writing-missing-result' ? '결과 누락 복사됨' : 'missing result 복사'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void copyMonitoringTable('result-writing-missing-evidence', resultWritingMissingEvidenceTsv)}
                        disabled={resultWritingReadiness.summary.missingEvidenceCount === 0}
                        className="rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-50"
                      >
                        {copiedMonitoringTable === 'result-writing-missing-evidence' ? '증빙 누락 복사됨' : 'missing evidence 복사'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void copyMonitoringTable('result-writing-missing-contribution', resultWritingMissingContributionTsv)}
                        disabled={resultWritingReadiness.summary.missingContributionCount === 0}
                        className="rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-50"
                      >
                        {copiedMonitoringTable === 'result-writing-missing-contribution' ? '기여 누락 복사됨' : 'missing contribution 복사'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void copyMonitoringTable('result-writing-combined', resultWritingCombinedTsv)}
                        disabled={!filteredResultWritingRows.length}
                        className="rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-50"
                      >
                        {copiedMonitoringTable === 'result-writing-combined' ? 'readiness TSV 복사됨' : 'filtered TSV 복사'}
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                    <MetricCard
                      label="점검 항목"
                      value={resultWritingReadiness.summary.totalItemCount.toLocaleString()}
                      help="Personal KPI / 기존 item"
                      compact
                    />
                    <MetricCard
                      label="결과 초안"
                      value={resultWritingReadiness.summary.resultDraftPresentCount.toLocaleString()}
                      help="itemComment 기준"
                      compact
                    />
                    <MetricCard
                      label="수행결과 누락"
                      value={resultWritingReadiness.summary.missingResultCount.toLocaleString()}
                      help="작성 필요"
                      compact
                      variant={resultWritingReadiness.summary.missingResultCount > 0 ? 'warning' : 'default'}
                    />
                    <MetricCard
                      label="증빙 부족"
                      value={resultWritingReadiness.summary.missingEvidenceCount.toLocaleString()}
                      help="링크/첨부/코멘트"
                      compact
                      variant={resultWritingReadiness.summary.missingEvidenceCount > 0 ? 'warning' : 'default'}
                    />
                    <MetricCard
                      label="본인 기여 부족"
                      value={resultWritingReadiness.summary.missingContributionCount.toLocaleString()}
                      help="역할/기여"
                      compact
                      variant={resultWritingReadiness.summary.missingContributionCount > 0 ? 'warning' : 'default'}
                    />
                    <MetricCard
                      label="리더 검토 warning"
                      value={resultWritingReadiness.summary.leaderReviewWarningCount.toLocaleString()}
                      help="non-blocking"
                      compact
                      variant={resultWritingReadiness.summary.leaderReviewWarningCount > 0 ? 'warning' : 'default'}
                    />
                  </div>

                  <div className="mt-4 grid gap-3 lg:grid-cols-2">
                    <div className="rounded-2xl border border-emerald-100 bg-white p-4">
                      <h6 className="text-sm font-semibold text-slate-900">카테고리별 작성 기준</h6>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        {resultWritingReadiness.guidance.map((guide) => (
                          <div key={guide.category} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <div className="text-xs font-semibold text-slate-900">{guide.label}</div>
                            <ul className="mt-2 space-y-1 text-xs leading-5 text-slate-600">
                              {guide.expectations.map((item) => (
                                <li key={item}>- {item}</li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-emerald-100 bg-white p-4">
                      <h6 className="text-sm font-semibold text-slate-900">증빙/리더 검토 checklist</h6>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <div className="text-xs font-semibold text-slate-900">Evidence guidance</div>
                          <ul className="mt-2 space-y-1 text-xs leading-5 text-slate-600">
                            {resultWritingReadiness.evidenceGuidance.map((item) => (
                              <li key={item}>- {item}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <div className="text-xs font-semibold text-slate-900">Leader review checklist</div>
                          <ul className="mt-2 space-y-1 text-xs leading-5 text-slate-600">
                            {resultWritingReadiness.leaderReviewChecklist.map((item) => (
                              <li key={item}>- {item}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-7">
                    <label className="text-xs font-semibold text-slate-600">
                      본부
                      <select
                        value={resultWritingDivisionFilter}
                        onChange={(event) => {
                          setResultWritingDivisionFilter(event.target.value)
                          setResultWritingTeamFilter('ALL')
                        }}
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700"
                      >
                        <option value="ALL">전체 본부</option>
                        {resultWritingDivisionOptions.map(([divisionId, divisionName]) => (
                          <option key={divisionId} value={divisionId}>{divisionName}</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs font-semibold text-slate-600">
                      팀
                      <select
                        value={resultWritingTeamFilter}
                        onChange={(event) => setResultWritingTeamFilter(event.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700"
                      >
                        <option value="ALL">전체 팀</option>
                        {resultWritingTeamOptions.map(([departmentId, departmentPath]) => (
                          <option key={departmentId} value={departmentId}>{departmentPath}</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs font-semibold text-slate-600">
                      직원
                      <select
                        value={resultWritingEmployeeFilter}
                        onChange={(event) => setResultWritingEmployeeFilter(event.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700"
                      >
                        <option value="ALL">전체 직원</option>
                        {resultWritingEmployeeOptions.map(([employeeId, employeeLabel]) => (
                          <option key={employeeId} value={employeeId}>{employeeLabel}</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs font-semibold text-slate-600">
                      리더
                      <select
                        value={resultWritingLeaderFilter}
                        onChange={(event) => setResultWritingLeaderFilter(event.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700"
                      >
                        <option value="ALL">전체 리더</option>
                        {resultWritingLeaderOptions.map(([leaderId, leaderName]) => (
                          <option key={leaderId} value={leaderId}>{leaderName}</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs font-semibold text-slate-600">
                      category
                      <select
                        value={resultWritingCategoryFilter}
                        onChange={(event) => setResultWritingCategoryFilter(event.target.value as ResultWritingCategoryFilter2026 | 'ALL')}
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700"
                      >
                        {RESULT_WRITING_CATEGORY_FILTERS_2026.map((category) => (
                          <option key={category} value={category}>{getResultWritingCategoryLabel2026(category)}</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs font-semibold text-slate-600">
                      result status
                      <select
                        value={resultWritingStatusFilter}
                        onChange={(event) => setResultWritingStatusFilter(event.target.value as ResultWritingStatus2026 | 'ALL')}
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700"
                      >
                        {RESULT_WRITING_STATUS_FILTERS_2026.map((status) => (
                          <option key={status} value={status}>{getResultWritingStatusLabel2026(status)}</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs font-semibold text-slate-600">
                      warning
                      <select
                        value={resultWritingWarningFilter}
                        onChange={(event) => setResultWritingWarningFilter(event.target.value as ResultWritingWarningCode2026 | 'ALL')}
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700"
                      >
                        {RESULT_WRITING_WARNING_FILTERS_2026.map((warning) => (
                          <option key={warning} value={warning}>{getResultWritingWarningLabel2026(warning)}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void copyMonitoringTable('result-writing-org-goal-source', resultWritingOrgGoalSourceTsv)}
                      disabled={resultWritingReadiness.summary.orgGoalSourceWarningCount === 0}
                      className="rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-50"
                    >
                      {copiedMonitoringTable === 'result-writing-org-goal-source' ? 'ORG_GOAL 경고 복사됨' : 'ORG_GOAL source warning 복사'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void copyMonitoringTable('result-writing-daily-work-duplicate', resultWritingDailyWorkDuplicateTsv)}
                      disabled={resultWritingReadiness.summary.dailyWorkDuplicateRiskCount === 0}
                      className="rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-50"
                    >
                      {copiedMonitoringTable === 'result-writing-daily-work-duplicate' ? 'DAILY_WORK 위험 복사됨' : 'DAILY_WORK duplicate risk 복사'}
                    </button>
                  </div>

                  <div className="mt-4 rounded-2xl border border-slate-200 bg-white">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
                      <h6 className="text-sm font-semibold text-slate-900">수행결과 readiness 대상</h6>
                      <span className="text-xs text-slate-500">
                        {filteredResultWritingRows.length.toLocaleString()}건 표시 · 전체 {resultWritingRows.length.toLocaleString()}건
                      </span>
                    </div>
                    <div className="max-h-96 overflow-auto">
                      <table className="min-w-full divide-y divide-slate-100 text-left text-xs">
                        <thead className="sticky top-0 bg-emerald-50 text-emerald-700">
                          <tr>
                            <th className="px-4 py-2 font-semibold">직원</th>
                            <th className="px-4 py-2 font-semibold">조직/리더</th>
                            <th className="px-4 py-2 font-semibold">KPI/category</th>
                            <th className="px-4 py-2 font-semibold">readiness</th>
                            <th className="px-4 py-2 font-semibold">결과/증빙</th>
                            <th className="px-4 py-2 font-semibold">warning / next action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {filteredResultWritingRows.slice(0, 120).map((row) => (
                            <tr key={`${row.employeeId}:${row.personalKpiId}`}>
                              <td className="px-4 py-3">
                                <div className="font-semibold text-slate-900">{row.employeeName}</div>
                                <div className="text-slate-400">{row.employeeNo ?? '사번 없음'}{row.email ? ` · ${row.email}` : ''}</div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="text-slate-600">{row.departmentPath}</div>
                                <div className="mt-1 text-slate-400">{row.leaderName}</div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="font-semibold text-slate-900">{row.kpiName}</div>
                                <div className="mt-1 flex flex-wrap gap-1">
                                  <Badge tone={row.category ? 'neutral' : 'error'}>{row.categoryLabel}</Badge>
                                  <Badge tone="neutral">{row.mboStatus}</Badge>
                                  {row.linkedOrgKpiTitle ? <Badge tone={row.approvedOrgGoalSource ? 'success' : 'warn'}>{row.linkedOrgKpiTitle}</Badge> : null}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <Badge tone={getResultWritingStatusTone2026(row.resultWritingStatus)}>
                                  {getResultWritingStatusLabel2026(row.resultWritingStatus)}
                                </Badge>
                                <div className="mt-1 text-slate-400">{row.latestMonthlyRecordLabel ?? '월간 근거 없음'}</div>
                              </td>
                              <td className="px-4 py-3 text-slate-600">
                                결과 {row.resultDraftPresent ? '있음' : '없음'} · 증빙 {row.evidencePresent ? `${row.evidenceSourceCount}건` : '없음'} · 기여 {row.personalContributionPresent ? '있음' : '부족'}
                                <div className="mt-1 text-slate-400">
                                  정량 {row.measurableResultPresent ? '있음' : '부족'} · 목표/실제 {row.targetActualComparisonPresent ? '있음' : '부족'} · 산출/영향 {row.outputImpactPresent ? '있음' : '부족'}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex max-w-lg flex-wrap gap-1">
                                  {row.warnings.slice(0, 4).map((warning) => (
                                    <Badge key={`${row.personalKpiId}:${warning.code}`} tone="warn">{warning.label}</Badge>
                                  ))}
                                  {row.warnings.length > 4 ? <Badge tone="neutral">+{row.warnings.length - 4}</Badge> : null}
                                  {!row.warnings.length ? <Badge tone="success">warning 없음</Badge> : null}
                                </div>
                                <div className="mt-2 text-slate-600">{row.nextAction}</div>
                              </td>
                            </tr>
                          ))}
                          {filteredResultWritingRows.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="px-4 py-6 text-center text-slate-500">수행결과 readiness 필터 조건에 맞는 항목이 없습니다.</td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>
                    {filteredResultWritingRows.length > 120 ? (
                      <div className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
                        화면에는 120건까지만 표시합니다. 전체 목록은 filtered TSV 복사로 추출해 주세요.
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {leaderEvaluationReadiness ? (
                <div className="mt-4 rounded-2xl border border-cyan-100 bg-cyan-50/60 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h5 className="text-sm font-semibold text-slate-900">2026 리더 평가 readiness</h5>
                        <Badge tone="neutral">Read-only</Badge>
                        <Badge tone="neutral">제출/확정 없음</Badge>
                        <Badge tone="neutral">공식 점수 미적용</Badge>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-slate-600">
                        이 화면은 2026 리더 평가 readiness를 읽기 전용으로 점검합니다. 공식 점수, 등급, 제출, 확정 상태는 변경하지 않습니다.
                      </p>
                      <p className="mt-1 text-xs leading-5 text-cyan-700">
                        리더 평가 입력 전 결과 작성, 증빙, 정책 카테고리, 평가자 배정 상태를 확인합니다.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void copyMonitoringTable('leader-eval-first-blocked', leaderEvaluationFirstBlockedTsv)}
                        disabled={leaderEvaluationReadiness.summary.firstReviewMissingPrerequisitesCount === 0}
                        className="rounded-full border border-cyan-200 bg-white px-3 py-1.5 text-xs font-semibold text-cyan-700 transition hover:bg-cyan-50 disabled:opacity-50"
                      >
                        {copiedMonitoringTable === 'leader-eval-first-blocked' ? 'FIRST blocked 복사됨' : 'FIRST blocked 복사'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void copyMonitoringTable('leader-eval-second-blocked', leaderEvaluationSecondBlockedTsv)}
                        disabled={leaderEvaluationReadiness.summary.secondReviewMissingPrerequisitesCount === 0}
                        className="rounded-full border border-cyan-200 bg-white px-3 py-1.5 text-xs font-semibold text-cyan-700 transition hover:bg-cyan-50 disabled:opacity-50"
                      >
                        {copiedMonitoringTable === 'leader-eval-second-blocked' ? 'SECOND blocked 복사됨' : 'SECOND blocked 복사'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void copyMonitoringTable('leader-eval-missing-evidence', leaderEvaluationMissingEvidenceTsv)}
                        disabled={leaderEvaluationReadiness.summary.itemsMissingResultWritingEvidence === 0}
                        className="rounded-full border border-cyan-200 bg-white px-3 py-1.5 text-xs font-semibold text-cyan-700 transition hover:bg-cyan-50 disabled:opacity-50"
                      >
                        {copiedMonitoringTable === 'leader-eval-missing-evidence' ? '증빙 누락 복사됨' : 'missing evidence 복사'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void copyMonitoringTable('leader-eval-missing-policy', leaderEvaluationMissingPolicyTsv)}
                        disabled={leaderEvaluationReadiness.summary.itemsMissingPolicyCategory === 0}
                        className="rounded-full border border-cyan-200 bg-white px-3 py-1.5 text-xs font-semibold text-cyan-700 transition hover:bg-cyan-50 disabled:opacity-50"
                      >
                        {copiedMonitoringTable === 'leader-eval-missing-policy' ? '카테고리 누락 복사됨' : 'missing policyCategory 복사'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void copyMonitoringTable('leader-eval-missing-evaluator', leaderEvaluationMissingEvaluatorTsv)}
                        disabled={leaderEvaluationReadiness.summary.missingEvaluatorCount === 0}
                        className="rounded-full border border-cyan-200 bg-white px-3 py-1.5 text-xs font-semibold text-cyan-700 transition hover:bg-cyan-50 disabled:opacity-50"
                      >
                        {copiedMonitoringTable === 'leader-eval-missing-evaluator' ? '평가자 누락 복사됨' : 'missing evaluator 복사'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void copyMonitoringTable('leader-eval-ready', leaderEvaluationReadyTsv)}
                        disabled={leaderEvaluationReadiness.summary.readyForLeaderReviewCount === 0}
                        className="rounded-full border border-cyan-200 bg-white px-3 py-1.5 text-xs font-semibold text-cyan-700 transition hover:bg-cyan-50 disabled:opacity-50"
                      >
                        {copiedMonitoringTable === 'leader-eval-ready' ? 'ready list 복사됨' : 'ready list 복사'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void copyMonitoringTable('leader-eval-combined', leaderEvaluationCombinedTsv)}
                        disabled={!filteredLeaderEvaluationRows.length}
                        className="rounded-full border border-cyan-200 bg-white px-3 py-1.5 text-xs font-semibold text-cyan-700 transition hover:bg-cyan-50 disabled:opacity-50"
                      >
                        {copiedMonitoringTable === 'leader-eval-combined' ? 'combined TSV 복사됨' : 'combined TSV 복사'}
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                    <MetricCard label="SELF 제출" value={leaderEvaluationReadiness.summary.selfSubmittedCount.toLocaleString()} help="submitted/confirmed" compact />
                    <MetricCard label="FIRST 준비" value={leaderEvaluationReadiness.summary.firstReviewReadyCount.toLocaleString()} help="리더 평가 입력 전" compact />
                    <MetricCard
                      label="FIRST blocker"
                      value={leaderEvaluationReadiness.summary.firstReviewMissingPrerequisitesCount.toLocaleString()}
                      help="선행 조건 누락"
                      compact
                      variant={leaderEvaluationReadiness.summary.firstReviewMissingPrerequisitesCount > 0 ? 'warning' : 'default'}
                    />
                    <MetricCard label="SECOND 준비" value={leaderEvaluationReadiness.summary.secondReviewReadyCount.toLocaleString()} help="FIRST 완료 후" compact />
                    <MetricCard
                      label="평가자 누락"
                      value={leaderEvaluationReadiness.summary.missingEvaluatorCount.toLocaleString()}
                      help="FIRST/SECOND/FINAL"
                      compact
                      variant={leaderEvaluationReadiness.summary.missingEvaluatorCount > 0 ? 'warning' : 'default'}
                    />
                    <MetricCard
                      label="전체 blocker"
                      value={leaderEvaluationReadiness.summary.blockerCount.toLocaleString()}
                      help="read-only"
                      compact
                      variant={leaderEvaluationReadiness.summary.blockerCount > 0 ? 'warning' : 'default'}
                    />
                  </div>

                  <div className="mt-4 grid gap-3 lg:grid-cols-2">
                    <div className="rounded-2xl border border-cyan-100 bg-white p-4">
                      <h6 className="text-sm font-semibold text-slate-900">FIRST evaluator checklist</h6>
                      <ul className="mt-2 space-y-1 text-xs leading-5 text-slate-600">
                        {leaderEvaluationReadiness.firstEvaluatorChecklist.map((item) => (
                          <li key={item}>- {item}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-2xl border border-cyan-100 bg-white p-4">
                      <h6 className="text-sm font-semibold text-slate-900">SECOND evaluator checklist</h6>
                      <ul className="mt-2 space-y-1 text-xs leading-5 text-slate-600">
                        {leaderEvaluationReadiness.secondEvaluatorChecklist.map((item) => (
                          <li key={item}>- {item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                    <select value={leaderEvalDivisionFilter} onChange={(event) => setLeaderEvalDivisionFilter(event.target.value)} className="rounded-xl border border-cyan-100 bg-white px-3 py-2 text-xs text-slate-700">
                      <option value="ALL">division 전체</option>
                      {leaderEvalDivisionOptions.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                    </select>
                    <select value={leaderEvalTeamFilter} onChange={(event) => setLeaderEvalTeamFilter(event.target.value)} className="rounded-xl border border-cyan-100 bg-white px-3 py-2 text-xs text-slate-700">
                      <option value="ALL">team 전체</option>
                      {leaderEvalTeamOptions.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                    </select>
                    <select value={leaderEvalEvaluatorFilter} onChange={(event) => setLeaderEvalEvaluatorFilter(event.target.value)} className="rounded-xl border border-cyan-100 bg-white px-3 py-2 text-xs text-slate-700">
                      <option value="ALL">evaluator 전체</option>
                      {leaderEvalEvaluatorOptions.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                    </select>
                    <select value={leaderEvalStageFilter} onChange={(event) => setLeaderEvalStageFilter(event.target.value)} className="rounded-xl border border-cyan-100 bg-white px-3 py-2 text-xs text-slate-700">
                      <option value="ALL">stage 전체</option>
                      {leaderEvalStageOptions.map((stage) => <option key={stage} value={stage}>{stage}</option>)}
                    </select>
                    <select value={leaderEvalStatusFilter} onChange={(event) => setLeaderEvalStatusFilter(event.target.value as LeaderEvaluationReadinessStatus2026 | 'ALL')} className="rounded-xl border border-cyan-100 bg-white px-3 py-2 text-xs text-slate-700">
                      {(['ALL', 'READY_FOR_FIRST_REVIEW', 'BLOCKED_SELF_NOT_SUBMITTED', 'BLOCKED_RESULT_MISSING', 'BLOCKED_EVIDENCE_MISSING', 'BLOCKED_POLICY_CATEGORY_MISSING', 'BLOCKED_EVALUATOR_MISSING', 'READY_FOR_SECOND_REVIEW', 'BLOCKED_FIRST_NOT_COMPLETE', 'READY_FOR_FINAL_REVIEW', 'MANUAL_REVIEW'] as const).map((status) => (
                        <option key={status} value={status}>{getLeaderEvaluationReadinessStatusLabel2026(status)}</option>
                      ))}
                    </select>
                    <select value={leaderEvalPrerequisiteFilter} onChange={(event) => setLeaderEvalPrerequisiteFilter(event.target.value as LeaderEvaluationMissingPrerequisite2026 | 'ALL')} className="rounded-xl border border-cyan-100 bg-white px-3 py-2 text-xs text-slate-700">
                      {(['ALL', 'SELF_NOT_SUBMITTED', 'RESULT_MISSING', 'EVIDENCE_MISSING', 'POLICY_CATEGORY_MISSING', 'EVALUATOR_MISSING', 'FIRST_NOT_COMPLETE', 'ORG_GOAL_SOURCE_MISSING', 'MEASURABLE_RESULT_MISSING', 'PERSONAL_CONTRIBUTION_MISSING', 'SCORE_POLICY_WARNING', 'ADJUSTMENT_READINESS_WARNING'] as const).map((item) => (
                        <option key={item} value={item}>{getLeaderEvaluationPrerequisiteLabel2026(item)}</option>
                      ))}
                    </select>
                    <select value={leaderEvalPolicyCategoryFilter} onChange={(event) => setLeaderEvalPolicyCategoryFilter(event.target.value as 'ALL' | 'READY' | 'MISSING')} className="rounded-xl border border-cyan-100 bg-white px-3 py-2 text-xs text-slate-700">
                      <option value="ALL">policyCategory 전체</option>
                      <option value="READY">policyCategory ready</option>
                      <option value="MISSING">policyCategory missing</option>
                    </select>
                    <select value={leaderEvalEvidenceFilter} onChange={(event) => setLeaderEvalEvidenceFilter(event.target.value as 'ALL' | 'READY' | 'MISSING' | 'NO_ITEMS')} className="rounded-xl border border-cyan-100 bg-white px-3 py-2 text-xs text-slate-700">
                      <option value="ALL">evidence 전체</option>
                      <option value="READY">evidence ready</option>
                      <option value="MISSING">evidence missing</option>
                      <option value="NO_ITEMS">result item 없음</option>
                    </select>
                  </div>

                  <div className="mt-4 rounded-2xl border border-slate-200 bg-white">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
                      <h6 className="text-sm font-semibold text-slate-900">리더 평가 readiness 대상</h6>
                      <span className="text-xs text-slate-500">
                        {filteredLeaderEvaluationRows.length.toLocaleString()}건 표시 · 전체 {leaderEvaluationRows.length.toLocaleString()}건
                      </span>
                    </div>
                    <div className="max-h-96 overflow-auto">
                      <table className="min-w-full divide-y divide-slate-100 text-left text-xs">
                        <thead className="sticky top-0 bg-cyan-50 text-cyan-700">
                          <tr>
                            <th className="px-4 py-2 font-semibold">직원</th>
                            <th className="px-4 py-2 font-semibold">평가자 chain</th>
                            <th className="px-4 py-2 font-semibold">stage/status</th>
                            <th className="px-4 py-2 font-semibold">result/category/evidence</th>
                            <th className="px-4 py-2 font-semibold">warning</th>
                            <th className="px-4 py-2 font-semibold">next action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {filteredLeaderEvaluationRows.slice(0, 120).map((row) => (
                            <tr key={row.employeeId}>
                              <td className="px-4 py-3">
                                <div className="font-semibold text-slate-900">{row.employeeName}</div>
                                <div className="text-slate-400">{row.employeeNo ?? '사번 없음'}{row.email ? ` · ${row.email}` : ''}</div>
                                <div className="mt-1 text-slate-500">{row.departmentPath}</div>
                              </td>
                              <td className="px-4 py-3 text-slate-600">
                                <div>FIRST: {row.firstEvaluatorName}</div>
                                <div>SECOND: {row.secondEvaluatorName}</div>
                                <div>FINAL: {row.finalEvaluatorName}</div>
                                <div className="mt-1 text-slate-400">{row.currentAssignmentRows.length ? row.currentAssignmentRows.join(' · ') : 'assignment row 없음'}</div>
                              </td>
                              <td className="px-4 py-3">
                                <Badge tone={getLeaderEvaluationReadinessTone2026(row.readinessStatus)}>
                                  {getLeaderEvaluationReadinessStatusLabel2026(row.readinessStatus)}
                                </Badge>
                                <div className="mt-1 text-slate-500">{row.currentStage}</div>
                                <div className="mt-1 text-slate-400">SELF {row.selfStatus} · FIRST {row.firstStatus} · SECOND {row.secondStatus}</div>
                              </td>
                              <td className="px-4 py-3 text-slate-600">
                                <div>결과 {row.resultWritingStatus} · category {row.policyCategoryStatus} · evidence {row.evidenceStatus}</div>
                                <div className="mt-1 text-slate-400">
                                  item {row.resultItemCount} · result missing {row.missingResultCount} · evidence missing {row.missingEvidenceCount}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex max-w-md flex-wrap gap-1">
                                  {row.missingPrerequisites.slice(0, 4).map((item) => (
                                    <Badge key={`${row.employeeId}:${item}`} tone="warn">{getLeaderEvaluationPrerequisiteLabel2026(item)}</Badge>
                                  ))}
                                  {row.missingPrerequisites.length > 4 ? <Badge tone="neutral">+{row.missingPrerequisites.length - 4}</Badge> : null}
                                  {!row.missingPrerequisites.length ? <Badge tone="success">warning 없음</Badge> : null}
                                </div>
                                <div className="mt-1 text-slate-400">score warning {row.scorePolicyWarningCount} · adjustment reminder {row.adjustmentReadinessWarningCount}</div>
                              </td>
                              <td className="px-4 py-3 text-slate-600">
                                <div>{row.suggestedNextAction}</div>
                                {row.blockerReasons.length ? <div className="mt-1 text-slate-400">{row.blockerReasons.slice(0, 2).join(' · ')}</div> : null}
                              </td>
                            </tr>
                          ))}
                          {filteredLeaderEvaluationRows.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="px-4 py-6 text-center text-slate-500">리더 평가 readiness 필터 조건에 맞는 대상이 없습니다.</td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>
                    {filteredLeaderEvaluationRows.length > 120 ? (
                      <div className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
                        화면에는 120건까지만 표시합니다. 전체 목록은 combined TSV 복사로 추출해 주세요.
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {finalizationCeoReadiness ? (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h5 className="text-sm font-semibold text-slate-900">2026 최종 확정 readiness</h5>
                        <Badge tone="neutral">Read-only</Badge>
                        <Badge tone="neutral">보정/CEO 확정 없음</Badge>
                        <Badge tone="neutral">gradeId 미변경</Badge>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-slate-600">
                        이 화면은 최종 확정 가능 여부를 읽기 전용으로 점검합니다. 공식 점수, 등급, 보정, 대표이사 확정은 수행하지 않습니다.
                      </p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        대표이사 확정은 공식 점수와 등급 산정, 보정 기준 확인 이후 별도 단계에서 진행합니다. 최종 등급 조정이 필요한 경우 조정 사유는 필수입니다. 이 화면에서는 Evaluation.totalScore 또는 Evaluation.gradeId를 변경하지 않습니다.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void copyMonitoringTable('finalization-first-blocked', finalizationBlockedBeforeFirstTsv)}
                        disabled={finalizationCeoReadiness.summary.blockedBeforeFirstCount === 0}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                      >
                        {copiedMonitoringTable === 'finalization-first-blocked' ? 'FIRST 전 blocker 복사됨' : 'FIRST 전 blocker 복사'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void copyMonitoringTable('finalization-second-blocked', finalizationBlockedBeforeSecondTsv)}
                        disabled={finalizationCeoReadiness.summary.blockedBeforeSecondCount === 0}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                      >
                        {copiedMonitoringTable === 'finalization-second-blocked' ? 'SECOND 전 blocker 복사됨' : 'SECOND 전 blocker 복사'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void copyMonitoringTable('finalization-final-blocked', finalizationBlockedBeforeFinalTsv)}
                        disabled={finalizationCeoReadiness.summary.blockedBeforeFinalCount === 0}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                      >
                        {copiedMonitoringTable === 'finalization-final-blocked' ? 'FINAL 전 blocker 복사됨' : 'FINAL 전 blocker 복사'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void copyMonitoringTable('finalization-ready', finalizationReadyTsv)}
                        disabled={finalizationCeoReadiness.summary.readyLaterCount === 0}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                      >
                        {copiedMonitoringTable === 'finalization-ready' ? 'final ready 복사됨' : 'final ready 복사'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void copyMonitoringTable('finalization-ceo-ready', finalizationCeoLaterReadyTsv)}
                        disabled={finalizationCeoRows.every((row) => row.finalizationReadinessStatus !== 'READY_FOR_CEO_CONFIRMATION_LATER')}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                      >
                        {copiedMonitoringTable === 'finalization-ceo-ready' ? 'CEO later-ready 복사됨' : 'CEO later-ready 복사'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void copyMonitoringTable('finalization-manual', finalizationManualReviewTsv)}
                        disabled={finalizationCeoReadiness.summary.manualReviewCount === 0}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                      >
                        {copiedMonitoringTable === 'finalization-manual' ? 'manual review 복사됨' : 'manual review 복사'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void copyMonitoringTable('finalization-combined', finalizationCombinedTsv)}
                        disabled={!filteredFinalizationCeoRows.length}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                      >
                        {copiedMonitoringTable === 'finalization-combined' ? 'combined TSV 복사됨' : 'combined TSV 복사'}
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                    <MetricCard label="최종 후보" value={finalizationCeoReadiness.summary.finalReviewCandidateCount.toLocaleString()} help="대상자" compact />
                    <MetricCard label="ready later" value={finalizationCeoReadiness.summary.readyLaterCount.toLocaleString()} help="final/CEO 후보" compact />
                    <MetricCard
                      label="FIRST 전 blocker"
                      value={finalizationCeoReadiness.summary.blockedBeforeFirstCount.toLocaleString()}
                      help="SELF/result/category/evaluator"
                      compact
                      variant={finalizationCeoReadiness.summary.blockedBeforeFirstCount > 0 ? 'warning' : 'default'}
                    />
                    <MetricCard
                      label="FINAL 전 blocker"
                      value={finalizationCeoReadiness.summary.blockedBeforeFinalCount.toLocaleString()}
                      help="SECOND 미완료"
                      compact
                      variant={finalizationCeoReadiness.summary.blockedBeforeFinalCount > 0 ? 'warning' : 'default'}
                    />
                    <MetricCard
                      label="CEO blocker"
                      value={finalizationCeoReadiness.summary.ceoConfirmationBlockerCount.toLocaleString()}
                      help="CEO later-ready 전"
                      compact
                      variant={finalizationCeoReadiness.summary.ceoConfirmationBlockerCount > 0 ? 'warning' : 'default'}
                    />
                    <MetricCard
                      label="calibration blocker"
                      value={finalizationCeoReadiness.summary.calibrationReadinessBlockerCount.toLocaleString()}
                      help="score/grade policy"
                      compact
                      variant={finalizationCeoReadiness.summary.calibrationReadinessBlockerCount > 0 ? 'warning' : 'default'}
                    />
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    <MetricCard
                      label="증빙 누락"
                      value={finalizationCeoReadiness.summary.missingEvidenceCount.toLocaleString()}
                      help="result evidence"
                      compact
                      variant={finalizationCeoReadiness.summary.missingEvidenceCount > 0 ? 'warning' : 'default'}
                    />
                    <MetricCard
                      label="policyCategory 누락"
                      value={finalizationCeoReadiness.summary.missingPolicyCategoryCount.toLocaleString()}
                      help="category missing"
                      compact
                      variant={finalizationCeoReadiness.summary.missingPolicyCategoryCount > 0 ? 'warning' : 'default'}
                    />
                    <MetricCard
                      label="평가자 chain"
                      value={finalizationCeoReadiness.summary.missingEvaluatorChainCount.toLocaleString()}
                      help="FIRST/SECOND/FINAL"
                      compact
                      variant={finalizationCeoReadiness.summary.missingEvaluatorChainCount > 0 ? 'warning' : 'default'}
                    />
                    <MetricCard
                      label="grade policy"
                      value={finalizationCeoReadiness.summary.gradePolicyBlockerCount.toLocaleString()}
                      help="grade blocker"
                      compact
                      variant={finalizationCeoReadiness.summary.gradePolicyBlockerCount > 0 ? 'warning' : 'default'}
                    />
                    <MetricCard
                      label="manual review"
                      value={finalizationCeoReadiness.summary.manualReviewCount.toLocaleString()}
                      help="HR 확인"
                      compact
                      variant={finalizationCeoReadiness.summary.manualReviewCount > 0 ? 'warning' : 'default'}
                    />
                  </div>

                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <h6 className="text-sm font-semibold text-slate-900">Final/CEO review checklist</h6>
                    <ul className="mt-2 grid gap-1 text-xs leading-5 text-slate-600 md:grid-cols-2">
                      {finalizationCeoReadiness.finalCeoChecklist.map((item) => (
                        <li key={item}>- {item}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                    <select value={finalizationDivisionFilter} onChange={(event) => setFinalizationDivisionFilter(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
                      <option value="ALL">division 전체</option>
                      {finalizationDivisionOptions.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                    </select>
                    <select value={finalizationSectionFilter} onChange={(event) => setFinalizationSectionFilter(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
                      <option value="ALL">section 전체</option>
                      {finalizationSectionOptions.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                    </select>
                    <select value={finalizationTeamFilter} onChange={(event) => setFinalizationTeamFilter(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
                      <option value="ALL">team 전체</option>
                      {finalizationTeamOptions.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                    </select>
                    <select value={finalizationEvaluatorFilter} onChange={(event) => setFinalizationEvaluatorFilter(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
                      <option value="ALL">evaluator 전체</option>
                      {finalizationEvaluatorOptions.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                    </select>
                    <select value={finalizationStageFilter} onChange={(event) => setFinalizationStageFilter(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
                      <option value="ALL">stage 전체</option>
                      {finalizationStageOptions.map((stage) => <option key={stage} value={stage}>{stage}</option>)}
                    </select>
                    <select value={finalizationStatusFilter} onChange={(event) => setFinalizationStatusFilter(event.target.value as FinalizationCeoReadinessStatus2026 | 'ALL')} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
                      {(['ALL', 'BLOCKED_SELF_NOT_READY', 'BLOCKED_FIRST_NOT_READY', 'BLOCKED_SECOND_NOT_READY', 'BLOCKED_RESULT_MISSING', 'BLOCKED_POLICY_CATEGORY_MISSING', 'BLOCKED_EVALUATOR_CHAIN', 'BLOCKED_SCORE_POLICY', 'BLOCKED_GRADE_POLICY', 'BLOCKED_FEEDBACK_LEADERSHIP', 'BLOCKED_AI_READINESS', 'READY_FOR_FINAL_REVIEW', 'READY_FOR_CEO_CONFIRMATION_LATER', 'MANUAL_REVIEW'] as const).map((status) => (
                        <option key={status} value={status}>{getFinalizationCeoStatusLabel2026(status)}</option>
                      ))}
                    </select>
                    <select value={finalizationBlockerFilter} onChange={(event) => setFinalizationBlockerFilter(event.target.value as FinalizationCeoBlockerType2026 | 'ALL')} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
                      {(['ALL', 'SELF_NOT_READY', 'FIRST_NOT_READY', 'SECOND_NOT_READY', 'RESULT_MISSING', 'EVIDENCE_MISSING', 'POLICY_CATEGORY_MISSING', 'EVALUATOR_CHAIN', 'SCORE_POLICY', 'GRADE_POLICY', 'FEEDBACK_LEADERSHIP', 'AI_READINESS', 'MANUAL_REVIEW'] as const).map((blocker) => (
                        <option key={blocker} value={blocker}>{getFinalizationCeoBlockerLabel2026(blocker)}</option>
                      ))}
                    </select>
                    <select value={finalizationPolicyFilter} onChange={(event) => setFinalizationPolicyFilter(event.target.value as 'ALL' | 'READY' | 'MISSING')} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
                      <option value="ALL">policyCategory 전체</option>
                      <option value="READY">policyCategory ready</option>
                      <option value="MISSING">policyCategory missing</option>
                    </select>
                    <select value={finalizationEvidenceFilter} onChange={(event) => setFinalizationEvidenceFilter(event.target.value as 'ALL' | 'READY' | 'MISSING' | 'NO_ITEMS')} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
                      <option value="ALL">evidence 전체</option>
                      <option value="READY">evidence ready</option>
                      <option value="MISSING">evidence missing</option>
                      <option value="NO_ITEMS">result item 없음</option>
                    </select>
                    <select value={finalizationGradePolicyFilter} onChange={(event) => setFinalizationGradePolicyFilter(event.target.value as 'ALL' | 'READY' | 'BLOCKED')} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
                      <option value="ALL">grade policy 전체</option>
                      <option value="READY">grade policy ready</option>
                      <option value="BLOCKED">grade policy blocked</option>
                    </select>
                    <select value={finalizationFeedbackFilter} onChange={(event) => setFinalizationFeedbackFilter(event.target.value as 'ALL' | 'READY' | 'BLOCKED' | 'NOT_CHECKED')} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
                      <option value="ALL">360/리더십 전체</option>
                      <option value="READY">ready</option>
                      <option value="BLOCKED">blocked</option>
                      <option value="NOT_CHECKED">not checked</option>
                    </select>
                    <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
                      <input
                        type="checkbox"
                        checked={finalizationManualOnly}
                        onChange={(event) => setFinalizationManualOnly(event.target.checked)}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      manual review only
                    </label>
                  </div>

                  <div className="mt-4 rounded-2xl border border-slate-200 bg-white">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
                      <h6 className="text-sm font-semibold text-slate-900">최종 확정 readiness 대상</h6>
                      <span className="text-xs text-slate-500">
                        {filteredFinalizationCeoRows.length.toLocaleString()}건 표시 · 전체 {finalizationCeoRows.length.toLocaleString()}건
                      </span>
                    </div>
                    <div className="max-h-96 overflow-auto">
                      <table className="min-w-full divide-y divide-slate-100 text-left text-xs">
                        <thead className="sticky top-0 bg-slate-50 text-slate-700">
                          <tr>
                            <th className="px-4 py-2 font-semibold">직원</th>
                            <th className="px-4 py-2 font-semibold">평가 stage</th>
                            <th className="px-4 py-2 font-semibold">final/CEO readiness</th>
                            <th className="px-4 py-2 font-semibold">chain/status</th>
                            <th className="px-4 py-2 font-semibold">blocker</th>
                            <th className="px-4 py-2 font-semibold">next HR action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {filteredFinalizationCeoRows.slice(0, 120).map((row) => (
                            <tr key={row.employeeId}>
                              <td className="px-4 py-3">
                                <div className="font-semibold text-slate-900">{row.employeeName}</div>
                                <div className="text-slate-400">{row.employeeNo ?? '사번 없음'}{row.email ? ` · ${row.email}` : ''}</div>
                                <div className="mt-1 text-slate-500">{row.departmentPath}</div>
                              </td>
                              <td className="px-4 py-3 text-slate-600">
                                <div>{row.currentEvaluationStage}</div>
                                <div className="mt-1 text-slate-400">FIRST {row.firstReadiness} · SECOND {row.secondReadiness} · FINAL {row.finalReadiness}</div>
                              </td>
                              <td className="px-4 py-3">
                                <Badge tone={getFinalizationCeoStatusTone2026(row.finalizationReadinessStatus)}>
                                  {getFinalizationCeoStatusLabel2026(row.finalizationReadinessStatus)}
                                </Badge>
                                <div className="mt-1 text-slate-500">CEO {row.ceoConfirmationReadiness}</div>
                              </td>
                              <td className="px-4 py-3 text-slate-600">
                                <div>{row.evaluatorChainSummary}</div>
                                <div className="mt-1 text-slate-400">
                                  category {row.policyCategoryStatus} · evidence {row.resultEvidenceStatus} · score {row.scorePolicyStatus} · grade {row.gradePolicyStatus}
                                </div>
                                <div className="mt-1 text-slate-400">360/리더십 {row.feedbackLeadershipStatus} · AI {row.aiReadinessStatus}</div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex max-w-md flex-wrap gap-1">
                                  {row.blockerTypes.slice(0, 4).map((blocker) => (
                                    <Badge key={`${row.employeeId}:${blocker}`} tone="warn">{getFinalizationCeoBlockerLabel2026(blocker)}</Badge>
                                  ))}
                                  {row.blockerTypes.length > 4 ? <Badge tone="neutral">+{row.blockerTypes.length - 4}</Badge> : null}
                                  {!row.blockerTypes.length ? <Badge tone="success">blocker 없음</Badge> : null}
                                </div>
                                {row.blockerReasons.length ? <div className="mt-1 text-slate-400">{row.blockerReasons.slice(0, 2).join(' · ')}</div> : null}
                              </td>
                              <td className="px-4 py-3 text-slate-600">{row.nextHrAction}</td>
                            </tr>
                          ))}
                          {filteredFinalizationCeoRows.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="px-4 py-6 text-center text-slate-500">최종 확정 readiness 필터 조건에 맞는 대상이 없습니다.</td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>
                    {filteredFinalizationCeoRows.length > 120 ? (
                      <div className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
                        화면에는 120건까지만 표시합니다. 전체 목록은 combined TSV 복사로 추출해 주세요.
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {teamKpiHrReviewCoverage ? (
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-semibold text-slate-900">2026 팀 KPI 검토</h4>
                    <Badge tone="neutral">{props.canManageTeamKpiReview ? 'HR metadata' : 'Read-only'}</Badge>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-600">
                    본부 KPI에 포함되거나 HR이 승인한 팀 KPI만 개인 MBO의 조직목표 후보가 됩니다. 이 목록은 기존 Team KPI review와 예외 승인 메타데이터를 읽어 readiness 판단을 돕습니다.
                  </p>
                  <p className="mt-1 text-xs leading-5 text-indigo-700">
                    HR 결정 저장은 readiness 메타데이터만 변경하며 공식 점수/등급, 평가 항목, 최종화/조정에는 반영되지 않습니다.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void copyMonitoringTable('team-kpi-review', teamKpiReviewTsv)}
                  className="rounded-full border border-indigo-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-50"
                >
                  {copiedMonitoringTable === 'team-kpi-review' ? '팀 KPI 검토 복사됨' : '팀 KPI 검토 복사'}
                </button>
              </div>

              {teamReviewSaveNotice ? (
                <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                  {teamReviewSaveNotice}
                </div>
              ) : null}
              {teamReviewSaveError ? (
                <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                  {teamReviewSaveError}
                </div>
              ) : null}

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                <MetricCard
                  label="검토 대상"
                  value={teamKpiHrReviewCoverage.totalCandidates.toLocaleString()}
                  help="팀/실 KPI"
                  compact
                />
                <MetricCard
                  label="조직목표 반영"
                  value={teamKpiHrReviewCoverage.approvedForOrgGoalCount.toLocaleString()}
                  help="APPROVED"
                  compact
                />
                <MetricCard
                  label="일상업무 처리"
                  value={teamKpiHrReviewCoverage.excludedDailyWorkCount.toLocaleString()}
                  help="EXCLUDED"
                  compact
                />
                <MetricCard
                  label="예외 승인"
                  value={teamKpiHrReviewCoverage.exceptionApprovedCount.toLocaleString()}
                  help="HR 승인"
                  compact
                />
                <MetricCard
                  label="검토 필요"
                  value={(teamKpiHrReviewCoverage.pendingReviewCount + teamKpiHrReviewCoverage.needsDiscussionCount).toLocaleString()}
                  help="대기/논의"
                  compact
                  variant={teamKpiHrReviewCoverage.pendingReviewCount + teamKpiHrReviewCoverage.needsDiscussionCount > 0 ? 'warning' : 'default'}
                />
                <MetricCard
                  label="ORG_GOAL 소스 경고"
                  value={teamKpiHrReviewCoverage.personalKpiOrgGoalWithoutApprovedSourceCount.toLocaleString()}
                  help="개인 MBO"
                  compact
                  variant={teamKpiHrReviewCoverage.personalKpiOrgGoalWithoutApprovedSourceCount > 0 ? 'warning' : 'default'}
                />
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-slate-600">Quick filters</span>
                {TEAM_KPI_HR_REVIEW_STATUS_FILTERS_2026.map((status) => {
                  const count =
                    status === 'ALL'
                      ? teamKpiHrReviewCoverage.totalCandidates
                      : status === 'PENDING_REVIEW'
                        ? teamKpiHrReviewCoverage.pendingReviewCount
                        : status === 'APPROVED_FOR_ORG_GOAL'
                          ? teamKpiHrReviewCoverage.approvedForOrgGoalCount
                          : status === 'EXCLUDED_DAILY_WORK'
                            ? teamKpiHrReviewCoverage.excludedDailyWorkCount
                            : status === 'EXCEPTION_APPROVED'
                              ? teamKpiHrReviewCoverage.exceptionApprovedCount
                              : teamKpiHrReviewCoverage.needsDiscussionCount
                  const isActive = teamReviewStatusFilter === status
                  return (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setTeamReviewStatusFilter(status)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                        isActive
                          ? 'border-indigo-500 bg-indigo-600 text-white'
                          : 'border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50'
                      }`}
                    >
                      {status === 'PENDING_REVIEW' ? '미지정/PENDING only' : getTeamKpiHrReviewStatusLabel2026(status)}
                      <span className="ml-1 opacity-80">{count.toLocaleString()}</span>
                    </button>
                  )
                })}
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <label className="text-xs font-semibold text-slate-600">
                  본부
                  <select
                    value={teamReviewDivisionFilter}
                    onChange={(event) => {
                      setTeamReviewDivisionFilter(event.target.value)
                      setTeamReviewTeamFilter('ALL')
                    }}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700"
                  >
                    <option value="ALL">전체 본부</option>
                    {teamReviewDivisionOptions.map(([divisionId, divisionName]) => (
                      <option key={divisionId} value={divisionId}>{divisionName}</option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-semibold text-slate-600">
                  팀
                  <select
                    value={teamReviewTeamFilter}
                    onChange={(event) => setTeamReviewTeamFilter(event.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700"
                  >
                    <option value="ALL">전체 팀</option>
                    {teamReviewTeamOptions.map(([departmentId, departmentPath]) => (
                      <option key={departmentId} value={departmentId}>{departmentPath}</option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-semibold text-slate-600">
                  검토 상태
                  <select
                    value={teamReviewStatusFilter}
                    onChange={(event) => setTeamReviewStatusFilter(event.target.value as TeamKpiHrReviewStatus2026 | 'ALL')}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700"
                  >
                    {(['ALL', 'PENDING_REVIEW', 'APPROVED_FOR_ORG_GOAL', 'EXCLUDED_DAILY_WORK', 'EXCEPTION_APPROVED', 'NEEDS_DISCUSSION'] as const).map((status) => (
                      <option key={status} value={status}>{getTeamKpiHrReviewStatusLabel2026(status)}</option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-semibold text-slate-600">
                  HR 사유
                  <select
                    value={teamReviewReasonFilter}
                    onChange={(event) => setTeamReviewReasonFilter(event.target.value as TeamKpiHrReviewReason2026 | 'ALL')}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700"
                  >
                    <option value="ALL">전체 사유</option>
                    {teamReviewReasonOptions.map((reason) => (
                      <option key={reason} value={reason}>{reason}</option>
                    ))}
                  </select>
                </label>
              </div>

              {props.canManageTeamKpiReview ? (
                <div className="mt-4 rounded-2xl border border-indigo-200 bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h5 className="text-sm font-semibold text-slate-900">선택 항목 일괄 HR 결정</h5>
                      <p className="mt-1 text-xs leading-5 text-slate-600">
                        선택한 팀 KPI {selectedTeamReviewRows.length.toLocaleString()}건에 동일한 결정/사유/메모를 저장합니다. readiness 메타데이터만 변경됩니다.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={toggleAllVisibleTeamReviews}
                      disabled={!visibleTeamReviewRows.length || teamReviewBulkSaving}
                      className="rounded-full border border-indigo-200 px-3 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-50 disabled:opacity-50"
                    >
                      {allVisibleTeamReviewSelected ? '보이는 항목 선택 해제' : '보이는 항목 전체 선택'}
                    </button>
                  </div>
                  <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_1fr_1.5fr_auto]">
                    <label className="text-xs font-semibold text-slate-600">
                      일괄 결정
                      <select
                        value={teamReviewBulkDraft.decision}
                        onChange={(event) =>
                          setTeamReviewBulkDraft((current) => ({
                            ...current,
                            decision: event.target.value as TeamKpiHrReviewDecision2026 | '',
                          }))
                        }
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700"
                      >
                        <option value="">결정 선택</option>
                        {TEAM_KPI_HR_REVIEW_DECISIONS_2026.map((decision) => (
                          <option key={decision} value={decision}>{getTeamKpiHrReviewStatusLabel2026(decision)}</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs font-semibold text-slate-600">
                      일괄 사유
                      <select
                        value={teamReviewBulkDraft.reason}
                        onChange={(event) =>
                          setTeamReviewBulkDraft((current) => ({
                            ...current,
                            reason: event.target.value as TeamKpiHrReviewReason2026 | '',
                          }))
                        }
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700"
                      >
                        <option value="">사유 선택</option>
                        {TEAM_KPI_HR_REVIEW_REASONS_2026.map((reason) => (
                          <option key={reason} value={reason}>{reason}</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs font-semibold text-slate-600">
                      일괄 메모
                      <textarea
                        value={teamReviewBulkDraft.note}
                        onChange={(event) =>
                          setTeamReviewBulkDraft((current) => ({
                            ...current,
                            note: event.target.value,
                          }))
                        }
                        rows={2}
                        placeholder="선택 항목에 공통으로 남길 HR 검토 메모"
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700"
                      />
                    </label>
                    <div className="flex flex-col justify-end gap-2">
                      <div className="text-xs font-semibold text-slate-600">
                        선택 {selectedTeamReviewRows.length.toLocaleString()}건
                        {selectedVisibleTeamReviewCount ? ` · 현재 화면 ${selectedVisibleTeamReviewCount.toLocaleString()}건` : ''}
                      </div>
                      <button
                        type="button"
                        onClick={() => void saveBulkTeamKpiReviewDecision()}
                        disabled={
                          teamReviewBulkSaving ||
                          !selectedTeamReviewRows.length ||
                          !teamReviewBulkDraft.decision ||
                          !teamReviewBulkDraft.reason
                        }
                        className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
                      >
                        {teamReviewBulkSaving ? '일괄 저장 중...' : '선택 항목 일괄 저장'}
                      </button>
                    </div>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-indigo-700">
                    일괄 저장은 공식 점수/등급, PersonalKpi/EvaluationItem category, 평가 생성 상태를 변경하지 않습니다.
                  </p>
                </div>
              ) : null}

              <div className="mt-4 rounded-2xl border border-slate-200 bg-white">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
                  <h5 className="text-sm font-semibold text-slate-900">팀 KPI 검토 후보</h5>
                  <span className="text-xs text-slate-500">
                    {filteredTeamReviewRows.length.toLocaleString()}건 표시 · 전체 {teamReviewRows.length.toLocaleString()}건
                  </span>
                </div>
                <div className="max-h-96 overflow-auto">
                  <table className="min-w-full divide-y divide-slate-100 text-left text-xs">
                    <thead className="sticky top-0 bg-slate-50 text-slate-500">
                      <tr>
                        {props.canManageTeamKpiReview ? (
                          <th className="px-4 py-2 font-semibold">
                            <label className="inline-flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={allVisibleTeamReviewSelected}
                                onChange={toggleAllVisibleTeamReviews}
                                disabled={!visibleTeamReviewRows.length || teamReviewBulkSaving}
                                className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                              />
                              선택
                            </label>
                          </th>
                        ) : null}
                        <th className="px-4 py-2 font-semibold">팀 KPI</th>
                        <th className="px-4 py-2 font-semibold">조직/리더</th>
                        <th className="px-4 py-2 font-semibold">연결 본부 KPI</th>
                        <th className="px-4 py-2 font-semibold">검토 상태</th>
                        <th className="px-4 py-2 font-semibold">HR 사유</th>
                        <th className="px-4 py-2 font-semibold">MBO 제안</th>
                        {props.canManageTeamKpiReview ? (
                          <th className="px-4 py-2 font-semibold">HR 결정 저장</th>
                        ) : null}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {visibleTeamReviewRows.map((row) => {
                        const draft = getTeamReviewDraft(row)
                        return (
                          <tr key={row.orgKpiId}>
                            {props.canManageTeamKpiReview ? (
                              <td className="px-4 py-3 align-top">
                                <input
                                  type="checkbox"
                                  checked={selectedTeamReviewIdSet.has(row.orgKpiId)}
                                  onChange={(event) => toggleTeamReviewSelection(row.orgKpiId, event.target.checked)}
                                  disabled={teamReviewBulkSaving}
                                  aria-label={`${row.teamKpiName} 선택`}
                                  className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                                />
                              </td>
                            ) : null}
                            <td className="px-4 py-3">
                              <div className="font-semibold text-slate-900">{row.teamKpiName}</div>
                              <div className="mt-1 text-slate-400">
                                영향 {row.affectedActiveEmployeeCount.toLocaleString()}명 · 개인 연결 {row.linkedPersonalKpiCount.toLocaleString()}건 · {row.hrDecisionLabel}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-slate-600">{row.departmentPath}</div>
                              <div className="mt-1 text-slate-400">{row.ownerName}</div>
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              {row.linkedDivisionKpiName ?? '연결 없음'}
                              {row.linkedDivisionKpiDepartmentName ? (
                                <span className="block text-slate-400">{row.linkedDivisionKpiDepartmentName}</span>
                              ) : null}
                            </td>
                            <td className="px-4 py-3">
                              <Badge tone={getTeamKpiHrReviewStatusTone2026(row.reviewStatus)}>
                                {row.reviewStatusLabel}
                              </Badge>
                              {row.latestReviewVerdict ? (
                                <div className="mt-1 text-slate-400">verdict {row.latestReviewVerdict}</div>
                              ) : null}
                              {row.reviewedAt ? (
                                <div className="mt-1 text-slate-400">저장 {new Date(row.reviewedAt).toLocaleDateString('ko-KR')}</div>
                              ) : null}
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              <div className="font-semibold text-slate-700">{row.reason ?? '미지정'}</div>
                              {row.notes ? <div className="mt-1 max-w-xs truncate text-slate-400">{row.notes}</div> : null}
                            </td>
                            <td className="px-4 py-3">
                              <Badge tone={row.canSuggestAsOrgGoal ? 'success' : 'neutral'}>
                                {row.suggestedMboCategory === 'ORG_GOAL' ? 'ORG_GOAL 후보' : 'DAILY_WORK 기본'}
                              </Badge>
                              <div className="mt-1 max-w-xs text-slate-500">{row.guidance}</div>
                            </td>
                            {props.canManageTeamKpiReview ? (
                              <td className="min-w-72 px-4 py-3">
                                <div className="grid gap-2">
                                  <select
                                    value={draft.decision}
                                    onChange={(event) =>
                                      updateTeamReviewDraft(row.orgKpiId, {
                                        decision: event.target.value as TeamKpiHrReviewDecision2026 | '',
                                      })
                                    }
                                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700"
                                  >
                                    <option value="">결정 선택</option>
                                    {TEAM_KPI_HR_REVIEW_DECISIONS_2026.map((decision) => (
                                      <option key={decision} value={decision}>{getTeamKpiHrReviewStatusLabel2026(decision)}</option>
                                    ))}
                                  </select>
                                  <select
                                    value={draft.reason}
                                    onChange={(event) =>
                                      updateTeamReviewDraft(row.orgKpiId, {
                                        reason: event.target.value as TeamKpiHrReviewReason2026 | '',
                                      })
                                    }
                                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700"
                                  >
                                    <option value="">사유 선택</option>
                                    {TEAM_KPI_HR_REVIEW_REASONS_2026.map((reason) => (
                                      <option key={reason} value={reason}>{reason}</option>
                                    ))}
                                  </select>
                                  <textarea
                                    value={draft.note}
                                    onChange={(event) => updateTeamReviewDraft(row.orgKpiId, { note: event.target.value })}
                                    rows={2}
                                    placeholder="검토 메모"
                                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700"
                                  />
                                  <button
                                    type="button"
                                    disabled={teamReviewSavingId === row.orgKpiId}
                                    onClick={() => void saveTeamKpiReviewDecision(row)}
                                    className="rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
                                  >
                                    {teamReviewSavingId === row.orgKpiId ? '저장 중...' : 'HR 결정 저장'}
                                  </button>
                                </div>
                              </td>
                            ) : null}
                          </tr>
                        )
                      })}
                      {filteredTeamReviewRows.length === 0 ? (
                        <tr>
                          <td colSpan={props.canManageTeamKpiReview ? 8 : 6} className="px-4 py-6 text-center text-slate-500">필터 조건에 맞는 팀 KPI가 없습니다.</td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
                {filteredTeamReviewRows.length > 120 ? (
                  <div className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
                    화면에는 120건까지만 표시합니다. 전체 목록은 복사 버튼으로 추출해 주세요.
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {blockers.length || warnings.length ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-700" />
                  <h4 className="text-sm font-semibold text-amber-900">safe apply 차단 조건</h4>
                </div>
                <ul className="mt-3 space-y-2">
                  {blockers.length ? blockers.map((blocker) => (
                    <li key={blocker.code} className="text-sm leading-6 text-amber-900">
                      {blocker.message}{blocker.count != null ? ` (${blocker.count.toLocaleString()}건)` : ''}
                    </li>
                  )) : (
                    <li className="text-sm text-amber-800">현재 dry-run 기준 차단 조건은 없습니다.</li>
                  )}
                </ul>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-slate-600" />
                  <h4 className="text-sm font-semibold text-slate-900">범위 확인 경고</h4>
                </div>
                <ul className="mt-3 space-y-2">
                  {warnings.length ? warnings.map((warning) => (
                    <li key={warning.code} className="text-sm leading-6 text-slate-600">
                      {warning.message}{warning.count != null ? ` (${warning.count.toLocaleString()}건)` : ''}
                    </li>
                  )) : (
                    <li className="text-sm text-slate-500">추가 경고가 없습니다.</li>
                  )}
                </ul>
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-semibold text-slate-900">확정 Personal KPI 누락 직원</h4>
                <span className="text-xs text-slate-400">
                  {dryRun.employeesMissingConfirmedPersonalKpiCount.toLocaleString()}명 중 {missingEmployees.length}명 표시
                </span>
              </div>
              <ul className="mt-3 divide-y divide-slate-100">
                {missingEmployees.length ? missingEmployees.map((employee) => (
                  <li key={employee.employeeId} className="py-3">
                    <div className="text-sm font-semibold text-slate-900">{employee.employeeName}</div>
                    <div className="mt-1 text-xs text-slate-500">{employee.departmentPath}</div>
                  </li>
                )) : (
                  <li className="py-3 text-sm text-slate-500">누락 직원이 없습니다.</li>
                )}
              </ul>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-semibold text-slate-900">생성 예상 SELF 평가</h4>
                <span className="text-xs text-slate-400">
                  {dryRun.wouldCreateSelfEvaluationCount.toLocaleString()}건 중 {wouldCreate.length}건 표시
                </span>
              </div>
              <ul className="mt-3 divide-y divide-slate-100">
                {wouldCreate.length ? wouldCreate.map((item) => (
                  <li key={item.employeeId} className="py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900">{item.employeeName}</span>
                      <Badge tone="neutral">{item.departmentName}</Badge>
                      <Badge tone={item.missingPolicyCategoryCount > 0 ? 'warn' : 'success'}>
                        policy 누락 {item.missingPolicyCategoryCount}건
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      생성 예상 항목 {item.wouldCreateItemCount}건
                      {item.itemTitles.length ? ` · ${item.itemTitles.join(', ')}` : ''}
                    </p>
                  </li>
                )) : (
                  <li className="py-3 text-sm text-slate-500">새로 생성될 SELF 평가가 없습니다.</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
          HR 관리자가 선택한 평가 주기에 대해 population dry-run을 실행할 수 있습니다. 이 단계는 읽기 전용입니다.
        </div>
      )}
    </Panel>
  )
}

function PolicyMapping2026Panel(props: {
  mappingData: EvaluationPolicyMapping2026ApiData | null
  loading: boolean
  saving: boolean
  error: string
  notice: string
  categoryDrafts: Record<string, PolicyCategoryWorkbenchDraft2026>
  divisionSalesGroupDrafts: Record<string, SalesGroupDraft2026>
  departmentSalesGroupDrafts: Record<string, SalesGroupDraft2026>
  salesGroupDrafts: Record<string, SalesGroupDraft2026>
  thresholdDecisionDrafts: Record<string, ThresholdDecisionDraft2026>
  onLoad: () => void
  onSave: () => void
  onCategoryDraftChange: (mappingId: string, patch: Partial<PolicyCategoryWorkbenchDraft2026>) => void
  onCategoryBulkDraftChange: (mappingIds: string[], patch: Partial<PolicyCategoryWorkbenchDraft2026>) => void
  onDivisionSalesGroupChange: (key: string, value: SalesGroupDraft2026) => void
  onDepartmentSalesGroupChange: (key: string, value: SalesGroupDraft2026) => void
  onSalesGroupChange: (key: string, value: SalesGroupDraft2026) => void
  onThresholdDecisionChange: (evalCycleId: string, value: ThresholdDecisionDraft2026) => void
}) {
  const data = props.mappingData
  const [activeTab, setActiveTab] = useState<PolicyMappingTab2026>('CATEGORY')
  const [categoryDivisionFilter, setCategoryDivisionFilter] = useState('ALL')
  const [categoryTeamFilter, setCategoryTeamFilter] = useState('ALL')
  const [categoryLeaderFilter, setCategoryLeaderFilter] = useState('ALL')
  const [categoryCurrentFilter, setCategoryCurrentFilter] = useState<PolicyCategoryDraft2026 | 'ALL'>('ALL')
  const [categorySuggestedFilter, setCategorySuggestedFilter] = useState<PolicyCategoryDraft2026 | 'MANUAL_REVIEW' | 'ALL'>('ALL')
  const [categoryConfidenceFilter, setCategoryConfidenceFilter] = useState<PolicyCategoryConfidenceFilter2026>('ALL')
  const [categoryOrgLinkFilter, setCategoryOrgLinkFilter] = useState<'ALL' | 'PRESENT' | 'ABSENT'>('ALL')
  const [categoryTeamLinkFilter, setCategoryTeamLinkFilter] = useState<'ALL' | 'PRESENT' | 'ABSENT'>('ALL')
  const [categoryHrSourceFilter, setCategoryHrSourceFilter] = useState<'ALL' | 'PRESENT' | 'ABSENT'>('ALL')
  const [categoryMboStatusFilter, setCategoryMboStatusFilter] = useState<'ALL' | string>('ALL')
  const [categorySourceFilter, setCategorySourceFilter] = useState<'ALL' | 'PersonalKpi' | 'EvaluationItem'>('ALL')
  const [selectedCategoryMappingIds, setSelectedCategoryMappingIds] = useState<Set<string>>(new Set())
  const [bulkPolicyCategory, setBulkPolicyCategory] = useState<PolicyCategoryDraft2026>('')
  const [bulkScoreContributionType, setBulkScoreContributionType] = useState<ScoreContributionDraft2026>('')
  const [bulkPolicyCategoryNote, setBulkPolicyCategoryNote] = useState('')
  const [departmentOverrideFilter, setDepartmentOverrideFilter] = useState<DepartmentOverrideFilter2026>('IMPORTANT')
  const [departmentOverrideSearch, setDepartmentOverrideSearch] = useState('')
  const policyWorkbenchItems = useMemo(
    () => data?.policyCategoryWorkbenchItems ?? [],
    [data?.policyCategoryWorkbenchItems]
  )
  const policyCandidates = data?.policyCategoryCandidates.slice(0, 6) ?? []
  const divisionSalesCandidates = data?.divisionSalesGroupCandidates ?? []
  const departmentSalesCandidates = useMemo(
    () => data?.departmentSalesGroupCandidates ?? [],
    [data?.departmentSalesGroupCandidates]
  )
  const salesCandidates = data?.salesGroupCandidates.slice(0, 6) ?? []
  const thresholdCandidates = data?.thresholdDecisions.slice(0, 3) ?? []
  const configuredDepartmentOverrideCount = departmentSalesCandidates.filter((candidate) => Boolean(candidate.currentSalesGroup)).length
  const changedDepartmentOverrideCount = departmentSalesCandidates.filter((candidate) =>
    Boolean(props.departmentSalesGroupDrafts[`${candidate.evalCycleId}:${candidate.departmentId}`])
  ).length
  const departmentOverrideImportantCount = departmentSalesCandidates.filter((candidate) =>
    Boolean(candidate.currentSalesGroup) ||
    Boolean(props.departmentSalesGroupDrafts[`${candidate.evalCycleId}:${candidate.departmentId}`]) ||
    Boolean(candidate.divisionName?.includes('영업')) ||
    candidate.departmentPath.includes('세일즈마케팅팀')
  ).length
  const hrBlockerCount = thresholdCandidates.filter((candidate) => candidate.requiresDecision).length
  const unsavedDraftCount =
    Object.values(props.categoryDrafts).filter((draft) => Boolean(draft.category)).length +
    Object.values(props.divisionSalesGroupDrafts).filter(Boolean).length +
    Object.values(props.departmentSalesGroupDrafts).filter(Boolean).length +
    Object.values(props.salesGroupDrafts).filter(Boolean).length +
    Object.values(props.thresholdDecisionDrafts).filter(Boolean).length
  const categoryDivisionOptions = useMemo(
    () =>
      Array.from(
        new Map(
          policyWorkbenchItems
            .filter((item) => item.divisionId)
            .map((item) => [item.divisionId as string, item.divisionName])
        ).entries()
      ).sort((left, right) => left[1].localeCompare(right[1], 'ko')),
    [policyWorkbenchItems]
  )
  const categoryTeamOptions = useMemo(
    () =>
      Array.from(
        new Map(
          policyWorkbenchItems
            .filter((item) => item.departmentId && (categoryDivisionFilter === 'ALL' || item.divisionId === categoryDivisionFilter))
            .map((item) => [item.departmentId as string, item.departmentPath])
        ).entries()
      ).sort((left, right) => left[1].localeCompare(right[1], 'ko')),
    [categoryDivisionFilter, policyWorkbenchItems]
  )
  const categoryLeaderOptions = useMemo(
    () =>
      Array.from(
        new Map(
          policyWorkbenchItems
            .filter((item) => item.managerId)
            .map((item) => [item.managerId as string, item.managerName])
        ).entries()
      ).sort((left, right) => left[1].localeCompare(right[1], 'ko')),
    [policyWorkbenchItems]
  )
  const filteredPolicyWorkbenchItems = useMemo(
    () =>
      policyWorkbenchItems.filter((item) => {
        const matchesDivision = categoryDivisionFilter === 'ALL' || item.divisionId === categoryDivisionFilter
        const matchesTeam = categoryTeamFilter === 'ALL' || item.departmentId === categoryTeamFilter
        const matchesLeader = categoryLeaderFilter === 'ALL' || item.managerId === categoryLeaderFilter
        const matchesCurrent =
          categoryCurrentFilter === 'ALL' ||
          (categoryCurrentFilter === '' ? !item.currentPolicyCategory : item.currentPolicyCategory === categoryCurrentFilter)
        const matchesSuggested =
          categorySuggestedFilter === 'ALL' ||
          (categorySuggestedFilter === '' ? item.suggestedPolicyCategory === 'MANUAL_REVIEW' : item.suggestedPolicyCategory === categorySuggestedFilter)
        const matchesConfidence =
          categoryConfidenceFilter === 'ALL' || item.sourceConfidence === categoryConfidenceFilter
        const matchesOrgLink =
          categoryOrgLinkFilter === 'ALL' ||
          (categoryOrgLinkFilter === 'PRESENT' ? Boolean(item.linkedOrgKpi) : !item.linkedOrgKpi)
        const matchesTeamLink =
          categoryTeamLinkFilter === 'ALL' ||
          (categoryTeamLinkFilter === 'PRESENT' ? Boolean(item.linkedTeamKpi) : !item.linkedTeamKpi)
        const matchesHrSource =
          categoryHrSourceFilter === 'ALL' ||
          (categoryHrSourceFilter === 'PRESENT' ? item.hasHrApprovedSource : !item.hasHrApprovedSource)
        const matchesMboStatus = categoryMboStatusFilter === 'ALL' || item.mboStatus === categoryMboStatusFilter
        const matchesSource = categorySourceFilter === 'ALL' || item.itemSource === categorySourceFilter
        return (
          matchesDivision &&
          matchesTeam &&
          matchesLeader &&
          matchesCurrent &&
          matchesSuggested &&
          matchesConfidence &&
          matchesOrgLink &&
          matchesTeamLink &&
          matchesHrSource &&
          matchesMboStatus &&
          matchesSource
        )
      }),
    [
      categoryConfidenceFilter,
      categoryCurrentFilter,
      categoryDivisionFilter,
      categoryHrSourceFilter,
      categoryLeaderFilter,
      categoryMboStatusFilter,
      categoryOrgLinkFilter,
      categorySourceFilter,
      categorySuggestedFilter,
      categoryTeamFilter,
      categoryTeamLinkFilter,
      policyWorkbenchItems,
    ]
  )
  const visiblePolicyWorkbenchItems = filteredPolicyWorkbenchItems.slice(0, 100)
  const filteredDepartmentSalesCandidates = useMemo(
    () =>
      departmentSalesCandidates.filter((candidate) => {
        const key = `${candidate.evalCycleId}:${candidate.departmentId}`
        const draftChanged = Boolean(props.departmentSalesGroupDrafts[key])
        const mapped = Boolean(candidate.currentSalesGroup)
        const salesDivision = Boolean(candidate.divisionName?.includes('영업'))
        const highlighted = candidate.departmentPath.includes('세일즈마케팅팀')
        const matchesFilter =
          departmentOverrideFilter === 'ALL' ||
          (departmentOverrideFilter === 'MAPPED' && mapped) ||
          (departmentOverrideFilter === 'DRAFT_CHANGED' && draftChanged) ||
          (departmentOverrideFilter === 'SALES_DIVISION' && salesDivision) ||
          (departmentOverrideFilter === 'IMPORTANT' && (mapped || draftChanged || salesDivision || highlighted))
        const search = departmentOverrideSearch.trim().toLocaleLowerCase('ko')
        const matchesSearch =
          !search ||
          candidate.departmentPath.toLocaleLowerCase('ko').includes(search) ||
          candidate.departmentName.toLocaleLowerCase('ko').includes(search) ||
          (candidate.divisionName ?? '').toLocaleLowerCase('ko').includes(search)
        return matchesFilter && matchesSearch
      }),
    [departmentOverrideFilter, departmentOverrideSearch, departmentSalesCandidates, props.departmentSalesGroupDrafts]
  )
  const visibleDepartmentSalesCandidates = filteredDepartmentSalesCandidates.slice(0, departmentOverrideFilter === 'ALL' ? 120 : 30)
  const selectedVisibleCategoryCount = visiblePolicyWorkbenchItems.filter((item) =>
    selectedCategoryMappingIds.has(item.mappingId)
  ).length
  const allVisibleCategorySelected =
    visiblePolicyWorkbenchItems.length > 0 && selectedVisibleCategoryCount === visiblePolicyWorkbenchItems.length
  const hasChanges =
    Object.values(props.categoryDrafts).some((draft) => Boolean(draft.category)) ||
    Object.values(props.divisionSalesGroupDrafts).some(Boolean) ||
    Object.values(props.departmentSalesGroupDrafts).some(Boolean) ||
    Object.values(props.salesGroupDrafts).some(Boolean) ||
    Object.values(props.thresholdDecisionDrafts).some(Boolean)
  const selectedPolicyWorkbenchIds = useMemo(
    () =>
      filteredPolicyWorkbenchItems
        .filter((item) => selectedCategoryMappingIds.has(item.mappingId))
        .map((item) => item.mappingId),
    [filteredPolicyWorkbenchItems, selectedCategoryMappingIds]
  )
  const applyBulkPolicyCategoryDraft = () => {
    if (!selectedPolicyWorkbenchIds.length || !bulkPolicyCategory) return
    props.onCategoryBulkDraftChange(selectedPolicyWorkbenchIds, {
      category: bulkPolicyCategory,
      scoreContributionType: bulkScoreContributionType,
      note: bulkPolicyCategoryNote,
    })
  }
  const toggleVisiblePolicyWorkbenchSelection = () => {
    setSelectedCategoryMappingIds((current) => {
      const next = new Set(current)
      if (allVisibleCategorySelected) {
        for (const item of visiblePolicyWorkbenchItems) next.delete(item.mappingId)
      } else {
        for (const item of visiblePolicyWorkbenchItems) next.add(item.mappingId)
      }
      return next
    })
  }
  const tabs: Array<{ id: PolicyMappingTab2026; label: string; count: number; tone?: 'warn' | 'success' | 'neutral' }> = [
    { id: 'CATEGORY', label: '카테고리 매핑', count: data?.policyCategoryCandidates.length ?? 0, tone: (data?.policyCategoryCandidates.length ?? 0) > 0 ? 'warn' : 'neutral' },
    { id: 'DIVISION', label: '본부 영업/비영업', count: data?.divisionMappingSummary.unmappedDivisions ?? 0, tone: (data?.divisionMappingSummary.unmappedDivisions ?? 0) > 0 ? 'warn' : 'success' },
    { id: 'DEPARTMENT', label: '부서/팀 예외', count: configuredDepartmentOverrideCount + changedDepartmentOverrideCount, tone: configuredDepartmentOverrideCount + changedDepartmentOverrideCount > 0 ? 'warn' : 'neutral' },
    { id: 'EMPLOYEE', label: '직원별 예외', count: data?.salesGroupCandidates.length ?? 0, tone: (data?.salesGroupCandidates.length ?? 0) > 0 ? 'warn' : 'neutral' },
    { id: 'HR_CONFIRM', label: 'HR 확인 필요', count: hrBlockerCount, tone: hrBlockerCount > 0 ? 'warn' : 'success' },
  ]

  return (
    <Panel
      title="2026 정책 매핑 관리"
      description="정책 카테고리, 본부/팀/직원 영업 구분, HR 확인 기준을 탭별로 관리합니다. 공식 평가 결과에는 반영되지 않습니다."
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-slate-100 p-2 text-slate-600">
            <ClipboardList className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="neutral">Metadata only</Badge>
              <Badge tone={data ? 'warn' : 'neutral'}>
                {data
                  ? `카테고리 ${data.policyCategoryCandidates.length}건 · division 미지정 ${data.divisionMappingSummary.unmappedDivisions}건 · 팀 override ${configuredDepartmentOverrideCount}건 · HR 확인 ${hrBlockerCount}건`
                  : '미확인'}
              </Badge>
              {unsavedDraftCount > 0 ? <Badge tone="warn">미저장 draft {unsavedDraftCount}건</Badge> : null}
            </div>
            <p className="mt-1 text-xs leading-5 text-slate-600">
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
        <>
          <div className="mt-4 flex flex-wrap gap-2 border-b border-slate-200 pb-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold transition ${
                  activeTab === tab.id
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
                aria-pressed={activeTab === tab.id}
              >
                <span>{tab.label}</span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] ${
                  activeTab === tab.id
                    ? 'bg-white/15 text-white'
                    : tab.tone === 'warn'
                      ? 'bg-amber-50 text-amber-700'
                      : tab.tone === 'success'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-slate-100 text-slate-500'
                }`}>
                  {tab.count.toLocaleString()}
                </span>
              </button>
            ))}
          </div>
          {unsavedDraftCount > 0 ? (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
              미저장 draft {unsavedDraftCount.toLocaleString()}건이 있습니다. 탭을 이동해도 draft는 유지되며, 상단의 선택 metadata 저장을 눌러야 저장됩니다.
            </div>
          ) : null}

          <div className="mt-4 space-y-4">
            <div className="grid gap-4">
              {activeTab === 'CATEGORY' ? (
                <>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-semibold text-slate-900">수동 검토 필요 항목</h4>
                <span className="text-xs text-slate-400">{data.policyCategoryCandidates.length}건</span>
              </div>
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      중복 입력을 줄이기 위해 실제 매핑은 아래 bulk workbench에서 처리합니다.
                    </p>
                    {policyCandidates.length ? (
                      <details className="mt-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                        <summary className="cursor-pointer font-semibold text-slate-700">상위 {policyCandidates.length}건 간단히 보기</summary>
                        <div className="mt-2 grid gap-2 md:grid-cols-2">
                          {policyCandidates.map((candidate) => (
                            <div key={candidate.evaluationItemId} className="rounded-lg bg-white p-2">
                              <div className="font-semibold text-slate-800">{candidate.title}</div>
                              <div className="mt-1 text-slate-500">
                                {candidate.employeeName} · 현재 {getPolicyCategoryLabel2026(candidate.currentEffectiveCategory)} · 제안 {getPolicyCategoryLabel2026(candidate.suggestedCategory)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </details>
                    ) : <EmptyBlock message="현재 조회 범위에서 정책 카테고리 수동 매핑 후보가 없습니다." />}
                  </div>

            <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4 lg:col-span-2">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-semibold text-slate-900">2026 policyCategory bulk mapping workbench</h4>
                    <Badge tone="neutral">Metadata only</Badge>
                    <Badge tone="warn">{filteredPolicyWorkbenchItems.length.toLocaleString()}건 표시</Badge>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-blue-900">
                    이 저장은 2026 readiness metadata만 변경합니다. 공식 점수/등급은 변경되지 않습니다. 추천값은 자동 확정이 아니며 HR이 저장해야 반영됩니다.
                  </p>
                </div>
                <div className="text-xs text-slate-500">
                  전체 후보 {policyWorkbenchItems.length.toLocaleString()}건 · 표시 {visiblePolicyWorkbenchItems.length.toLocaleString()}건
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                <label className="text-xs font-semibold text-slate-600">
                  본부
                  <select
                    value={categoryDivisionFilter}
                    onChange={(event) => {
                      setCategoryDivisionFilter(event.target.value)
                      setCategoryTeamFilter('ALL')
                    }}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700"
                  >
                    <option value="ALL">전체 본부</option>
                    {categoryDivisionOptions.map(([divisionId, divisionName]) => (
                      <option key={divisionId} value={divisionId}>{divisionName}</option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-semibold text-slate-600">
                  팀
                  <select
                    value={categoryTeamFilter}
                    onChange={(event) => setCategoryTeamFilter(event.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700"
                  >
                    <option value="ALL">전체 팀</option>
                    {categoryTeamOptions.map(([departmentId, departmentPath]) => (
                      <option key={departmentId} value={departmentId}>{departmentPath}</option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-semibold text-slate-600">
                  리더
                  <select
                    value={categoryLeaderFilter}
                    onChange={(event) => setCategoryLeaderFilter(event.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700"
                  >
                    <option value="ALL">전체 리더</option>
                    {categoryLeaderOptions.map(([leaderId, leaderName]) => (
                      <option key={leaderId} value={leaderId}>{leaderName}</option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-semibold text-slate-600">
                  현재 category
                  <select
                    value={categoryCurrentFilter}
                    onChange={(event) => setCategoryCurrentFilter(event.target.value as PolicyCategoryDraft2026 | 'ALL')}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700"
                  >
                    <option value="ALL">전체</option>
                    <option value="">미분류</option>
                    <option value="ORG_GOAL">조직목표</option>
                    <option value="PROJECT_T">프로젝트 T</option>
                    <option value="PROJECT_K">프로젝트 K</option>
                    <option value="DAILY_WORK">일상업무</option>
                  </select>
                </label>
                <label className="text-xs font-semibold text-slate-600">
                  제안 category
                  <select
                    value={categorySuggestedFilter}
                    onChange={(event) => setCategorySuggestedFilter(event.target.value as PolicyCategoryDraft2026 | 'MANUAL_REVIEW' | 'ALL')}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700"
                  >
                    <option value="ALL">전체</option>
                    <option value="ORG_GOAL">조직목표</option>
                    <option value="PROJECT_T">프로젝트 T</option>
                    <option value="PROJECT_K">프로젝트 K</option>
                    <option value="DAILY_WORK">일상업무</option>
                    <option value="MANUAL_REVIEW">수동 검토</option>
                  </select>
                </label>
                <label className="text-xs font-semibold text-slate-600">
                  confidence
                  <select
                    value={categoryConfidenceFilter}
                    onChange={(event) => setCategoryConfidenceFilter(event.target.value as PolicyCategoryConfidenceFilter2026)}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700"
                  >
                    <option value="ALL">전체</option>
                    <option value="HIGH">HIGH</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="LOW">LOW</option>
                    <option value="MANUAL_REVIEW">MANUAL_REVIEW</option>
                  </select>
                </label>
                <label className="text-xs font-semibold text-slate-600">
                  조직 KPI
                  <select value={categoryOrgLinkFilter} onChange={(event) => setCategoryOrgLinkFilter(event.target.value as 'ALL' | 'PRESENT' | 'ABSENT')} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700">
                    <option value="ALL">전체</option>
                    <option value="PRESENT">연결 있음</option>
                    <option value="ABSENT">연결 없음</option>
                  </select>
                </label>
                <label className="text-xs font-semibold text-slate-600">
                  팀 KPI
                  <select value={categoryTeamLinkFilter} onChange={(event) => setCategoryTeamLinkFilter(event.target.value as 'ALL' | 'PRESENT' | 'ABSENT')} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700">
                    <option value="ALL">전체</option>
                    <option value="PRESENT">연결 있음</option>
                    <option value="ABSENT">연결 없음</option>
                  </select>
                </label>
                <label className="text-xs font-semibold text-slate-600">
                  HR 승인 source
                  <select value={categoryHrSourceFilter} onChange={(event) => setCategoryHrSourceFilter(event.target.value as 'ALL' | 'PRESENT' | 'ABSENT')} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700">
                    <option value="ALL">전체</option>
                    <option value="PRESENT">있음</option>
                    <option value="ABSENT">없음</option>
                  </select>
                </label>
                <label className="text-xs font-semibold text-slate-600">
                  MBO status
                  <select value={categoryMboStatusFilter} onChange={(event) => setCategoryMboStatusFilter(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700">
                    <option value="ALL">전체</option>
                    <option value="DRAFT">초안</option>
                    <option value="SUBMITTED">제출</option>
                    <option value="MANAGER_REVIEW">리더 검토</option>
                    <option value="CONFIRMED">확정</option>
                  </select>
                </label>
                <label className="text-xs font-semibold text-slate-600">
                  source
                  <select value={categorySourceFilter} onChange={(event) => setCategorySourceFilter(event.target.value as 'ALL' | 'PersonalKpi' | 'EvaluationItem')} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700">
                    <option value="ALL">전체</option>
                    <option value="PersonalKpi">PersonalKpi</option>
                    <option value="EvaluationItem">EvaluationItem</option>
                  </select>
                </label>
              </div>

              <div className="mt-4 rounded-2xl border border-blue-100 bg-white p-3">
                <div className="flex flex-wrap items-end gap-3">
                  <button type="button" onClick={toggleVisiblePolicyWorkbenchSelection} disabled={!visiblePolicyWorkbenchItems.length} className="rounded-full border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-50 disabled:opacity-50">
                    {allVisibleCategorySelected ? '표시 항목 선택 해제' : '표시 항목 전체 선택'}
                  </button>
                  <label className="min-w-40 flex-1 text-xs font-semibold text-slate-600">
                    bulk category
                    <select value={bulkPolicyCategory} onChange={(event) => setBulkPolicyCategory(event.target.value as PolicyCategoryDraft2026)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700">
                      <option value="">선택 안 함</option>
                      <option value="ORG_GOAL">조직목표</option>
                      <option value="PROJECT_T">프로젝트 T</option>
                      <option value="PROJECT_K">프로젝트 K</option>
                      <option value="DAILY_WORK">일상업무</option>
                      <option value="KEEP_UNCLASSIFIED">제외/미분류 유지</option>
                    </select>
                  </label>
                  <label className="min-w-40 flex-1 text-xs font-semibold text-slate-600">
                    bulk scoreContributionType
                    <select value={bulkScoreContributionType} onChange={(event) => setBulkScoreContributionType(event.target.value as ScoreContributionDraft2026)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700">
                      <option value="">category 기준 자동</option>
                      <option value="ORGANIZATION">조직성과</option>
                      <option value="PERSONAL">개인성과</option>
                    </select>
                  </label>
                  <label className="min-w-64 flex-[2] text-xs font-semibold text-slate-600">
                    bulk review note
                    <input value={bulkPolicyCategoryNote} onChange={(event) => setBulkPolicyCategoryNote(event.target.value)} maxLength={1000} placeholder="예: HR 일괄 검토 기준으로 확정" className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700" />
                  </label>
                  <button type="button" onClick={applyBulkPolicyCategoryDraft} disabled={!selectedPolicyWorkbenchIds.length || !bulkPolicyCategory} className="rounded-full bg-blue-700 px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-800 disabled:bg-slate-300">
                    {selectedPolicyWorkbenchIds.length.toLocaleString()}건 bulk 적용
                  </button>
                </div>
                <p className="mt-2 text-xs text-slate-500">bulk 적용은 화면 draft만 바꿉니다. 실제 저장은 상단의 선택 metadata 저장 버튼을 눌러야 수행됩니다.</p>
              </div>

              <div className="mt-4 overflow-auto rounded-2xl border border-blue-100 bg-white">
                <table className="min-w-[1500px] divide-y divide-slate-100 text-left text-xs">
                  <thead className="bg-blue-50 text-blue-800">
                    <tr>
                      <th className="px-3 py-2 font-semibold">선택</th>
                      <th className="px-3 py-2 font-semibold">대상/KPI</th>
                      <th className="px-3 py-2 font-semibold">조직/리더</th>
                      <th className="px-3 py-2 font-semibold">연결 KPI</th>
                      <th className="px-3 py-2 font-semibold">현재/제안</th>
                      <th className="px-3 py-2 font-semibold">저장 draft</th>
                      <th className="px-3 py-2 font-semibold">사유/메모</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {visiblePolicyWorkbenchItems.length ? visiblePolicyWorkbenchItems.map((candidate) => {
                      const draft = props.categoryDrafts[candidate.mappingId] ?? { category: '', scoreContributionType: '', note: '' }
                      return (
                        <tr key={candidate.mappingId}>
                          <td className="px-3 py-3 align-top">
                            <input
                              type="checkbox"
                              checked={selectedCategoryMappingIds.has(candidate.mappingId)}
                              onChange={(event) => {
                                setSelectedCategoryMappingIds((current) => {
                                  const next = new Set(current)
                                  if (event.target.checked) next.add(candidate.mappingId)
                                  else next.delete(candidate.mappingId)
                                  return next
                                })
                              }}
                              className="h-4 w-4 rounded border-slate-300"
                            />
                          </td>
                          <td className="px-3 py-3 align-top">
                            <div className="font-semibold text-slate-900">{candidate.kpiTitle}</div>
                            <div className="mt-1 text-slate-500">{candidate.employeeName} · {candidate.employeeNo ?? '사번 없음'}</div>
                            <div className="mt-1 flex flex-wrap gap-1">
                              <Badge tone="neutral">{candidate.itemSource}</Badge>
                              <Badge tone="neutral">{getMboOperationalStatusLabel2026(candidate.mboStatus)}</Badge>
                              {candidate.evalStage ? <Badge tone="neutral">{candidate.evalStage}</Badge> : null}
                            </div>
                            {candidate.kpiDescription ? <p className="mt-2 line-clamp-2 text-slate-500">{candidate.kpiDescription}</p> : null}
                          </td>
                          <td className="px-3 py-3 align-top text-slate-600">
                            <div>{candidate.departmentPath}</div>
                            <div className="mt-1 text-slate-400">리더 {candidate.managerName}</div>
                          </td>
                          <td className="px-3 py-3 align-top">
                            {candidate.linkedOrgKpi ? (
                              <div>
                                <div className="font-semibold text-slate-800">{candidate.linkedOrgKpi.title}</div>
                                <div className="mt-1 text-slate-500">{candidate.linkedOrgKpi.departmentPath ?? candidate.linkedOrgKpi.departmentName ?? '조직 미지정'}</div>
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {candidate.linkedOrgKpi.isDivisionKpi ? <Badge tone="success">본부 KPI</Badge> : null}
                                  {candidate.linkedTeamKpi ? <Badge tone={candidate.hasHrApprovedSource ? 'success' : 'warn'}>{candidate.linkedTeamKpi.reviewStatus}</Badge> : null}
                                </div>
                              </div>
                            ) : <span className="text-slate-400">연결 없음</span>}
                          </td>
                          <td className="px-3 py-3 align-top">
                            <div className="flex flex-wrap gap-1">
                              <Badge tone={candidate.currentPolicyCategory ? 'neutral' : 'warn'}>현재 {getPolicyCategoryLabel2026(candidate.currentPolicyCategory)}</Badge>
                              <Badge tone={getPolicyCategoryConfidenceTone2026(candidate.sourceConfidence)}>제안 {getPolicyCategoryLabel2026(candidate.suggestedPolicyCategory)}</Badge>
                            </div>
                            <div className="mt-2 text-slate-500">confidence {getPolicyCategoryConfidenceLabel2026(candidate.sourceConfidence)}</div>
                            <div className="mt-1 text-slate-500">score {getScoreContributionLabel2026(candidate.currentScoreContributionType)} → {getScoreContributionLabel2026(candidate.suggestedScoreContributionType)}</div>
                          </td>
                          <td className="px-3 py-3 align-top">
                            <select value={draft.category} onChange={(event) => props.onCategoryDraftChange(candidate.mappingId, { category: event.target.value as PolicyCategoryDraft2026 })} className="w-full min-w-40 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700">
                              <option value="">선택 안 함</option>
                              <option value="ORG_GOAL">조직목표</option>
                              <option value="PROJECT_T">프로젝트 T</option>
                              <option value="PROJECT_K">프로젝트 K</option>
                              <option value="DAILY_WORK">일상업무</option>
                              <option value="KEEP_UNCLASSIFIED">제외/미분류 유지</option>
                            </select>
                            <select value={draft.scoreContributionType} onChange={(event) => props.onCategoryDraftChange(candidate.mappingId, { scoreContributionType: event.target.value as ScoreContributionDraft2026 })} className="mt-2 w-full min-w-40 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700">
                              <option value="">category 기준 자동</option>
                              <option value="ORGANIZATION">조직성과</option>
                              <option value="PERSONAL">개인성과</option>
                            </select>
                          </td>
                          <td className="px-3 py-3 align-top">
                            <div className="max-w-sm text-slate-600">{candidate.suggestionReason}</div>
                            <textarea value={draft.note} onChange={(event) => props.onCategoryDraftChange(candidate.mappingId, { note: event.target.value })} rows={2} maxLength={1000} placeholder={candidate.reviewNote ?? 'HR 검토 메모'} className="mt-2 w-full min-w-56 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700" />
                          </td>
                        </tr>
                      )
                    }) : (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">현재 필터 조건에서 policyCategory 매핑 후보가 없습니다.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

                </>
              ) : null}

              {activeTab === 'DIVISION' ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-sm font-semibold text-slate-900">Division 영업/비영업 구분</h4>
                    <span className="text-xs text-slate-400">
                      전체 {data.divisionMappingSummary.totalDivisions}개 · 미지정 {data.divisionMappingSummary.unmappedDivisions}개
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    조직 master의 division 기준으로 preview readiness metadata만 저장합니다.
                  </p>
                  {data.divisionMappingSummary.warning ? (
                    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
                      {data.divisionMappingSummary.warning}
                    </div>
                  ) : null}
                  <div className="mt-3 overflow-x-auto rounded-xl border border-slate-100">
                    <table className="min-w-full divide-y divide-slate-100 text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500">
                        <tr>
                          <th className="px-3 py-2 font-semibold">Division</th>
                          <th className="px-3 py-2 font-semibold">인원</th>
                          <th className="px-3 py-2 font-semibold">현재/제안</th>
                          <th className="px-3 py-2 font-semibold">근거</th>
                          <th className="px-3 py-2 font-semibold">Draft</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {divisionSalesCandidates.length ? divisionSalesCandidates.map((candidate) => {
                          const key = `${candidate.evalCycleId}:${candidate.divisionId}`
                          return (
                            <tr key={key} className="align-top">
                              <td className="px-3 py-3 font-semibold text-slate-900">{candidate.divisionName}</td>
                              <td className="px-3 py-3 text-slate-600">
                                재직 {candidate.activeEmployeeCount}명
                                <div className="mt-1 text-slate-400">현재 주기 {candidate.currentCycleTargetCount}명</div>
                              </td>
                              <td className="px-3 py-3 text-slate-600">
                                현재 {getSalesGroupLabel2026(candidate.currentSalesGroup)}
                                <div className="mt-1">
                                  {candidate.suggestedSalesGroup ? (
                                    <Badge tone="neutral">제안 {getSalesGroupLabel2026(candidate.suggestedSalesGroup)}</Badge>
                                  ) : (
                                    <span className="text-slate-400">제안 없음</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-3 py-3 text-slate-500">
                                <div className="max-w-sm">{candidate.reason}</div>
                                {candidate.sampleEmployees.length ? (
                                  <div className="mt-1 text-slate-400">샘플 {candidate.sampleEmployees.join(', ')}</div>
                                ) : null}
                              </td>
                              <td className="px-3 py-3">
                                <select
                                  value={props.divisionSalesGroupDrafts[key] ?? ''}
                                  onChange={(event) => props.onDivisionSalesGroupChange(key, event.target.value as SalesGroupDraft2026)}
                                  className="h-9 min-w-36 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none focus:border-blue-400"
                                >
                                  <option value="">선택 안 함</option>
                                  <option value="SALES">영업</option>
                                  <option value="NON_SALES">비영업</option>
                                  <option value="UNRESOLVED">미해결로 유지</option>
                                </select>
                              </td>
                            </tr>
                          )
                        }) : (
                          <tr>
                            <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">현재 조회 범위에서 division 영업/비영업 매핑 후보가 없습니다.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              {activeTab === 'DEPARTMENT' ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-sm font-semibold text-slate-900">부서/팀 예외</h4>
                    <span className="text-xs text-slate-400">
                      표시 {visibleDepartmentSalesCandidates.length}건 · 전체 {departmentSalesCandidates.length}건 · 중요 {departmentOverrideImportantCount}건
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    본부 기본값과 다른 팀만 예외로 지정합니다. 기본 필터는 설정됨, 변경 draft, 영업 본부, 세일즈마케팅팀을 우선 보여줍니다.
                  </p>
                  <div className="mt-3 flex flex-wrap items-end gap-2">
                    <label className="min-w-60 flex-1 text-xs font-semibold text-slate-600">
                      경로 검색
                      <input
                        value={departmentOverrideSearch}
                        onChange={(event) => setDepartmentOverrideSearch(event.target.value)}
                        placeholder="부서/팀 경로 검색"
                        className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal text-slate-800 outline-none focus:border-blue-400"
                      />
                    </label>
                    {([
                      ['IMPORTANT', '기본 표시'],
                      ['MAPPED', '설정됨'],
                      ['DRAFT_CHANGED', 'draft 변경'],
                      ['SALES_DIVISION', '영업 본부'],
                      ['ALL', '전체'],
                    ] as Array<[DepartmentOverrideFilter2026, string]>).map(([filter, label]) => (
                      <button
                        key={filter}
                        type="button"
                        onClick={() => setDepartmentOverrideFilter(filter)}
                        className={`h-9 rounded-full px-3 text-xs font-semibold ${
                          departmentOverrideFilter === filter
                            ? 'bg-slate-900 text-white'
                            : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 overflow-x-auto rounded-xl border border-slate-100">
                    <table className="min-w-full divide-y divide-slate-100 text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500">
                        <tr>
                          <th className="px-3 py-2 font-semibold">부서/팀 경로</th>
                          <th className="px-3 py-2 font-semibold">인원</th>
                          <th className="px-3 py-2 font-semibold">현재/제안</th>
                          <th className="px-3 py-2 font-semibold">근거</th>
                          <th className="px-3 py-2 font-semibold">Draft</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {visibleDepartmentSalesCandidates.length ? visibleDepartmentSalesCandidates.map((candidate) => {
                          const key = `${candidate.evalCycleId}:${candidate.departmentId}`
                          return (
                            <tr key={key} className="align-top">
                              <td className="px-3 py-3 font-semibold text-slate-900">
                                {candidate.departmentPath}
                                {candidate.departmentPath.includes('세일즈마케팅팀') ? (
                                  <div className="mt-1"><Badge tone="warn">세일즈마케팅팀</Badge></div>
                                ) : null}
                              </td>
                              <td className="px-3 py-3 text-slate-600">
                                영향 {candidate.activeEmployeeCount}명
                                <div className="mt-1 text-slate-400">현재 주기 {candidate.currentCycleTargetCount}명</div>
                              </td>
                              <td className="px-3 py-3 text-slate-600">
                                현재 {getSalesGroupLabel2026(candidate.currentSalesGroup)}
                                <div className="mt-1">
                                  {candidate.suggestedSalesGroup ? (
                                    <Badge tone="neutral">제안 {getSalesGroupLabel2026(candidate.suggestedSalesGroup)}</Badge>
                                  ) : (
                                    <span className="text-slate-400">제안 없음</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-3 py-3 text-slate-500">
                                <div className="max-w-sm">{candidate.reason}</div>
                                {candidate.sampleEmployees.length ? (
                                  <div className="mt-1 text-slate-400">샘플 {candidate.sampleEmployees.join(', ')}</div>
                                ) : null}
                              </td>
                              <td className="px-3 py-3">
                                <select
                                  value={props.departmentSalesGroupDrafts[key] ?? ''}
                                  onChange={(event) => props.onDepartmentSalesGroupChange(key, event.target.value as SalesGroupDraft2026)}
                                  className="h-9 min-w-36 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none focus:border-blue-400"
                                >
                                  <option value="">선택 안 함</option>
                                  <option value="SALES">영업</option>
                                  <option value="NON_SALES">비영업</option>
                                  <option value="UNRESOLVED">미해결로 유지</option>
                                </select>
                              </td>
                            </tr>
                          )
                        }) : (
                          <tr>
                            <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">현재 필터 조건에서 부서/팀 override 후보가 없습니다.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              {activeTab === 'EMPLOYEE' ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-sm font-semibold text-slate-900">직원별 예외</h4>
                    <span className="text-xs text-slate-400">{data.salesGroupCandidates.length}건</span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    division/부서 매핑으로 해결할 수 없는 대상만 직원별 override로 보완합니다.
                  </p>
                  <div className="mt-3 overflow-x-auto rounded-xl border border-slate-100">
                    <table className="min-w-full divide-y divide-slate-100 text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500">
                        <tr>
                          <th className="px-3 py-2 font-semibold">직원</th>
                          <th className="px-3 py-2 font-semibold">부서</th>
                          <th className="px-3 py-2 font-semibold">현재/근거</th>
                          <th className="px-3 py-2 font-semibold">Draft</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {salesCandidates.length ? salesCandidates.map((candidate) => {
                          const key = `${candidate.evalCycleId}:${candidate.employeeId}`
                          return (
                            <tr key={key} className="align-top">
                              <td className="px-3 py-3 font-semibold text-slate-900">{candidate.employeeName}</td>
                              <td className="px-3 py-3 text-slate-600">{candidate.departmentName}</td>
                              <td className="px-3 py-3 text-slate-500">
                                현재 {getSalesGroupLabel2026(candidate.currentSalesGroup)} · {candidate.reason}
                              </td>
                              <td className="px-3 py-3">
                                <select
                                  value={props.salesGroupDrafts[key] ?? ''}
                                  onChange={(event) => props.onSalesGroupChange(key, event.target.value as SalesGroupDraft2026)}
                                  className="h-9 min-w-36 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none focus:border-blue-400"
                                >
                                  <option value="">선택 안 함</option>
                                  <option value="SALES">영업</option>
                                  <option value="NON_SALES">비영업</option>
                                  <option value="UNRESOLVED">미해결로 유지</option>
                                </select>
                              </td>
                            </tr>
                          )
                        }) : (
                          <tr>
                            <td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-500">현재 조회 범위에서 직원별 override 후보가 없습니다.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              {activeTab === 'HR_CONFIRM' ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-sm font-semibold text-slate-900">HR 확인 필요 기준</h4>
                    <span className="text-xs text-slate-400">TEAM_MEMBER_SALES</span>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
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
                          className="mt-3 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-blue-400"
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
              ) : null}
            </div>
          </div>
        </>
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
