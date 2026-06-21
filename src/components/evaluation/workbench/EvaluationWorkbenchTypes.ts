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
export type WorkbenchTab =
  | 'workbench'
  | 'guide'
  | 'evidence'
  | 'previous'
  | 'feedback'
  | 'briefing'
  | 'ai'
  | 'history'

export type DraftItemState = {
  personalKpiId: string
  quantScore?: number | null
  planScore?: number | null
  doScore?: number | null
  checkScore?: number | null
  actScore?: number | null
  itemComment?: string
  adjustmentScore?: number | null
  adjustmentReason?: string
}

export type EvidenceSectionKey = 'highlights' | 'kpi' | 'notes' | 'warnings'
export type EditableWorkbenchItem = NonNullable<EvaluationWorkbenchPageData['selected']>['items'][number] & {
  draft: DraftItemState
}
export type EvaluationListEntry = NonNullable<EvaluationWorkbenchPageData['evaluations']>[number]
export type EvaluationPreview2026ApiData = {
  evaluation: {
    id: string
    evalYear: number
    targetName: string
    targetDepartment: string
    evalStage: string
  }
  preview: EvaluationPreviewResult2026
}
export type EvaluationPreviewReadiness2026ApiData = EvaluationPreviewReadinessSummary2026
export type EvaluationActivationReadiness2026ApiData = Evaluation2026ActivationReadinessResult
export type EvaluationGradePolicyReadiness2026ApiData = Evaluation2026GradePolicyReadinessResult
export type EvaluationGradePolicySave2026ApiData = Evaluation2026GradePolicyMetadataSaveResult
export type EvaluationReadinessPopulation2026ApiData = Evaluation2026ReadinessPopulationDryRun
export type ReadinessScenarioSimulator2026 = NonNullable<EvaluationActivationReadiness2026ApiData['readinessScenarioSimulator']>
export type ReadinessScenarioInput2026 = ReadinessScenarioSimulator2026['scenarioInputModel']
export type ReadinessScenarioProjectedCounts2026 = ReadinessScenarioSimulator2026['baselineCounts']
export type ReadinessScenarioPreview2026 = {
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
export type DryRunOutputPasteReview2026 = {
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
export type OfficialDataReadinessBaselineRow2026 = {
  item: string
  currentCountStatus: string
  requiredState: string
  owner: string
  route: string
  canBeSolvedNow: 'yes' | 'no' | 'partial'
  officialWriteNeeded: 'yes' | 'no'
  nextAction: string
}
export type OfficialDataReadinessBaselineCounts2026 = {
  activeEmployees: number | null
  targetPopulationCount: number | null
  confirmedKpiCount: number | null
  confirmedKpiCoverageRate: number | null
  mboMissing: number | null
  confirmedKpiShortage: number | null
  draftKpiHolders: number | null
  submittedKpiCount: number | null
  teamKpiPending: number | null
  policyCategoryMissing: number | null
  orgGoalCount: number | null
  projectTCount: number | null
  projectKCount: number | null
  dailyWorkCount: number | null
  evaluatorRoutingBlockers: number | null
  missingFirstEvaluator: number | null
  missingSecondEvaluator: number | null
  missingFinalEvaluator: number | null
  manualReviewCount: number | null
  inactiveEvaluatorCount: number | null
  managerMissingCount: number | null
  scorePolicyBlockers: number | null
  gradePolicyBlockers: number | null
  weightCapWarnings: number | null
  categorySourceWarnings: number | null
  gradeThresholdBlockers: number | null
  resultWritingWarnings: number | null
  leaderEvaluationBlockers: number | null
  finalizationCeoBlockers: number | null
  calibrationBlockers: number | null
  ceoConfirmationBlockers: number | null
  leadership360Blockers: number | null
  missingReviewerAssignments: number | null
  missingResponses: number | null
  aiPassFailBlockers: number | null
  officialGateBlockers: number | null
}
export type OfficialDataReadinessBaselineExport2026 = {
  snapshotTimestamp: string
  targetCycleName: string
  targetYear: number | null
  officialPopulationReadiness: 'READY' | 'NOT_READY' | 'READY_WITH_APPROVED_EXCEPTIONS'
  counts: OfficialDataReadinessBaselineCounts2026
  blockers: string[]
  nextHrActions: string[]
  nextDeveloperWatchActions: string[]
  prohibitedActions: string[]
  baselineRows: OfficialDataReadinessBaselineRow2026[]
  copyPayloads: {
    summary: string
    markdown: string
    tsv: string
  }
  safety: {
    productionDataMutation: false
    migration: false
    backfillApply: false
    officialScoring: false
    officialGrade: false
    aiScoreExclusion: false
    totalScoreWrite: false
    gradeIdWrite: false
    evaluationCreation: false
    evaluationItemCreation: false
    featureFlagChange: false
  }
}
export type OfficialWriteGuardDisplayRow2026 = {
  key: string
  label: string
  status: string
  reasons: string[]
  nextAction: string
}
export type GradePolicyTeamMemberSalesResolutionPayload2026 =
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
export type MboSetupMonitoringStatus2026 =
  EvaluationReadinessPopulation2026ApiData['mboSetupCoverage']['monitoring']['employeeRows'][number]['status']
export type TeamKpiHrReviewStatus2026 =
  EvaluationReadinessPopulation2026ApiData['teamKpiHrReviewCoverage']['candidates'][number]['reviewStatus']
export type TeamKpiHrReviewReason2026 =
  NonNullable<EvaluationReadinessPopulation2026ApiData['teamKpiHrReviewCoverage']['candidates'][number]['reason']>
export type TeamKpiHrReviewRow2026 =
  EvaluationReadinessPopulation2026ApiData['teamKpiHrReviewCoverage']['candidates'][number]
export type ScorePolicyCategory2026 =
  EvaluationReadinessPopulation2026ApiData['scorePolicyReadiness']['categoryRules'][number]['category']
export type TeamKpiHrReviewDecision2026 = Exclude<TeamKpiHrReviewStatus2026, 'PENDING_REVIEW'>
export type TeamKpiHrReviewDecisionDraft2026 = {
  decision: TeamKpiHrReviewDecision2026 | ''
  reason: TeamKpiHrReviewReason2026 | ''
  note: string
}
export type MboFollowUpType2026 =
  | 'MISSING_MBO'
  | 'DRAFT_MBO'
  | 'LEADER_REVIEW'
  | 'POLICY_CATEGORY'
  | 'TEAM_KPI_REVIEW'
export type MboFollowUpStatusFilter2026 =
  | MboSetupMonitoringStatus2026
  | 'POLICY_CATEGORY'
  | 'TEAM_KPI_REVIEW'
export type MboFollowUpRecipientRow2026 = {
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
export type MboFollowUpGroup2026 = {
  type: MboFollowUpType2026
  label: string
  actionLabel: string
  description: string
  template: string
  href: string
  rows: MboFollowUpRecipientRow2026[]
}
export type ResultWritingReadiness2026 = EvaluationReadinessPopulation2026ApiData['resultWritingReadiness']
export type ResultWritingReadinessRow2026 = ResultWritingReadiness2026['rows'][number]
export type ResultWritingWarningCode2026 = ResultWritingReadinessRow2026['warnings'][number]['code']
export type ResultWritingStatus2026 = ResultWritingReadinessRow2026['resultWritingStatus']
export type LeaderEvaluationReadiness2026 = EvaluationReadinessPopulation2026ApiData['leaderEvaluationReadiness']
export type LeaderEvaluationReadinessRow2026 = LeaderEvaluationReadiness2026['rows'][number]
export type LeaderEvaluationReadinessStatus2026 = LeaderEvaluationReadinessRow2026['readinessStatus']
export type LeaderEvaluationMissingPrerequisite2026 = LeaderEvaluationReadinessRow2026['missingPrerequisites'][number]
export type FinalizationCeoReadiness2026 = EvaluationReadinessPopulation2026ApiData['finalizationCeoReadiness']
export type FinalizationCeoReadinessRow2026 = FinalizationCeoReadiness2026['rows'][number]
export type FinalizationCeoReadinessStatus2026 = FinalizationCeoReadinessRow2026['finalizationReadinessStatus']
export type FinalizationCeoBlockerType2026 = FinalizationCeoReadinessRow2026['blockerTypes'][number]
export type ResultWritingCategoryFilter2026 = NonNullable<ResultWritingReadinessRow2026['category']> | 'UNMAPPED'
export type EvaluationPolicyMapping2026ApiData = EvaluationPolicy2026MappingCandidates
export type EvaluationPolicyMetadataPatch2026ApiData = EvaluationPolicy2026MetadataPatchResult
export type EvaluationPolicyOfficialReadinessCycle2026ApiData = {
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
export type PolicyCategoryDraft2026 = 'ORG_GOAL' | 'PROJECT_T' | 'PROJECT_K' | 'DAILY_WORK' | 'KEEP_UNCLASSIFIED' | ''
export type PolicyCategoryConfidenceFilter2026 = 'HIGH' | 'MEDIUM' | 'LOW' | 'MANUAL_REVIEW' | 'ALL'
export type ScoreContributionDraft2026 = 'ORGANIZATION' | 'PERSONAL' | ''
export type PolicyCategoryWorkbenchDraft2026 = {
  category: PolicyCategoryDraft2026
  scoreContributionType: ScoreContributionDraft2026
  note: string
}
export type PolicyMappingTab2026 = 'CATEGORY' | 'DIVISION' | 'DEPARTMENT' | 'EMPLOYEE' | 'HR_CONFIRM'
export type DepartmentOverrideFilter2026 = 'IMPORTANT' | 'MAPPED' | 'DRAFT_CHANGED' | 'SALES_DIVISION' | 'ALL'
export type SalesGroupDraft2026 = 'SALES' | 'NON_SALES' | 'UNRESOLVED' | ''
export type ThresholdDecisionDraft2026 = 'UNRESOLVED' | 'SUPER_PRIORITY' | 'OUTSTANDING_PRIORITY' | ''
export type ReadinessExportPreviewFormat = 'plain' | 'markdown' | 'tsv' | 'json'
export type ReadinessExportPreview = {
  key: string
  title: string
  description: string
  content: string
  format: ReadinessExportPreviewFormat
  fileName: string
}
export type EndToEndPilot2026 = NonNullable<EvaluationActivationReadiness2026ApiData['endToEndPilot2026']>
export type InteractivePilotStepId2026 =
  | 'TARGET'
  | 'KPI'
  | 'SELF'
  | 'FIRST'
  | 'SECOND_FINAL'
  | 'SCORE'
  | 'GRADE'
  | 'CEO'
  | 'SAFETY'
export type WorkbenchPilotAlignmentStage2026 =
  | 'TARGET'
  | 'KPI'
  | 'SELF'
  | 'FIRST'
  | 'SECOND'
  | 'FINAL'
  | 'CEO_ADJUST'
  | 'SCORE_PREVIEW'
  | 'GRADE_PREVIEW'
  | 'SAFETY'
export type EvaluationWorkbenchClientProps = EvaluationWorkbenchPageData & {
  presentationMode?: 'performance' | 'performance-dashboard' | 'readiness-admin' | 'workbench-pilot'
}
export type InteractivePilotLocalInputs2026 = {
  selectedKpiId: string
  localAchievementLevel: 'BELOW_TARGET' | 'TARGET' | 'EXCELLENT' | 'CUSTOM'
  localBaseScore: string
  selfResultSummary: string
  selfEvidenceLink: string
  selfContributionComment: string
  selfRiskComment: string
  firstReviewerComment: string
  firstReviewerScore: string
  firstAdjustmentAmount: string
  firstAdjustmentReason: string
  firstFeedbackToEmployee: string
  finalReviewerComment: string
  finalReviewerScore: string
  finalAdjustmentAmount: string
  finalAdjustmentReason: string
  finalRecommendation: string
  ceoAdjustmentAmount: string
  ceoAdjustmentReason: string
  ceoFinalNote: string
  ceoChecklistEvidence: boolean
  ceoChecklistCalibration: boolean
  ceoChecklistNoWrite: boolean
}
export type WorkbenchPilotItemDraft2026 = {
  selfResultSummary: string
  selfEvidenceLink: string
  selfContribution: string
  selfScorePreview: string
  firstReviewerScore: string
  firstReviewerComment: string
  firstAdjustmentAmount: string
  firstAdjustmentReason: string
  firstFeedbackToEmployee: string
  finalReviewerScore: string
  finalReviewerComment: string
  finalAdjustmentAmount: string
  finalAdjustmentReason: string
  finalRecommendation: string
  ceoAdjustmentAmount: string
  ceoAdjustmentReason: string
  ceoFinalNote: string
  ceoEvidenceConfirmed: boolean
  ceoCalibrationReviewed: boolean
  ceoNoWriteConfirmed: boolean
}
export type WorkbenchPilotItemRow2026 = {
  kpi: EndToEndPilot2026['pilotKpis'][number]
  draft: WorkbenchPilotItemDraft2026
  policyCategoryWarning: string | null
  evidenceStatus: 'READY' | 'WARNING'
  selfStatus: 'READY' | 'NEEDS_INPUT'
  firstStatus: 'READY' | 'NEEDS_INPUT' | 'BLOCKED_BY_REASON'
  finalStatus: 'READY' | 'NEEDS_INPUT' | 'BLOCKED_BY_REASON'
  ceoStatus: 'READY' | 'NEEDS_INPUT' | 'BLOCKED_BY_REASON'
  localScorePreview: number
  warnings: string[]
}

export const TAB_LABELS: Record<WorkbenchTab, string> = {
  workbench: '종합',
  guide: '평가 가이드',
  evidence: '근거 기록',
  previous: '이전 단계 의견',
  feedback: '다면 피드백',
  briefing: 'AI 성과 브리핑',
  ai: 'AI 보조',
  history: '이력',
}


