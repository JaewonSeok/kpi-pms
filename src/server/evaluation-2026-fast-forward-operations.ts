import type { Evaluation2026IntegratedReadinessSnapshot } from '@/server/evaluation-2026-integrated-readiness-snapshot'
import type { Evaluation2026ReadinessActionPlan } from '@/server/evaluation-2026-readiness-action-plan'
import type { Evaluation2026ReadinessExecutionBoard } from '@/server/evaluation-2026-readiness-execution-board'
import type { Evaluation2026ReadinessScenarioSimulator } from '@/server/evaluation-2026-readiness-scenario-simulator'
import type { Evaluation2026ReadinessPopulationDryRun } from '@/server/evaluation-2026-readiness-population'
import type { Evaluation2026EvaluatorRoutingReadinessResult } from '@/server/evaluation-2026-evaluator-routing-readiness'
import type { Evaluation2026FeedbackLeadershipReadinessResult } from '@/server/evaluation-2026-feedback-leadership-readiness'
import type {
  Evaluation2026OfficialActivationGate,
  Evaluation2026OfficialActivationRunbook,
} from '@/server/evaluation-2026-activation-readiness'

export type Evaluation2026FastForwardOwner =
  | 'HR'
  | 'LEADER'
  | 'EMPLOYEE'
  | 'DEV'
  | 'ORG_ADMIN'
  | 'AI_REVIEWER'
  | 'CEO_OFFICE'

export type Evaluation2026FastForwardStatus =
  | 'READY_TO_START'
  | 'READY_TO_REVIEW'
  | 'READY_TO_PLAN'
  | 'READY_LATER'
  | 'WATCH_ONLY'
  | 'BLOCKED_BY_DATA'
  | 'BLOCKED_UNTIL_MBO'
  | 'BLOCKED_UNTIL_SCORE_AND_GRADE'

export type Evaluation2026FastForwardPriority = 'P0' | 'P1' | 'P2'

export type Evaluation2026FastForwardWorkstreamId =
  | 'MBO_COVERAGE'
  | 'TEAM_KPI_POLICY_CATEGORY'
  | 'EVALUATOR_ROUTING'
  | 'FEEDBACK_LEADERSHIP'
  | 'AI_PASS_FAIL'
  | 'RESULT_WRITING_LEADER_REVIEW'
  | 'FINALIZATION_CEO'
  | 'DEVELOPER_WATCH'

export type Evaluation2026FastForwardInput = {
  label: string
  value: number | string | null
  note: string
}

export type Evaluation2026FastForwardWorkstream = {
  id: Evaluation2026FastForwardWorkstreamId
  title: string
  owners: Evaluation2026FastForwardOwner[]
  status: Evaluation2026FastForwardStatus
  inputs: Evaluation2026FastForwardInput[]
  actions: string[]
  expectedOutput: string
  relatedRoutes: string[]
  canRunInParallel: boolean
  blockedReason: string | null
}

export type Evaluation2026FastForwardDependency = {
  from: string
  to: string
  reason: string
}

export type Evaluation2026FastForwardPathItem = {
  order: number
  title: string
  status: Evaluation2026FastForwardStatus
  owner: Evaluation2026FastForwardOwner
  nextAction: string
}

export type Evaluation2026FastForwardQuickWin = {
  id: string
  title: string
  owner: Evaluation2026FastForwardOwner
  blockerCount: number | null
  route: string
  reason: string
  expectedOutput: string
}

export type Evaluation2026FastForwardQueueItem = {
  priority: Evaluation2026FastForwardPriority
  title: string
  reason: string
  blockerCount: number | null
  route: string
  expectedOutput: string
  dependency: string
  copyText?: string
}

export type Evaluation2026FastForwardOperationsCockpit = {
  mode: 'READ_ONLY'
  generatedAt: string
  metadataTracking: {
    enabled: false
    saveAvailable: false
    reason: string
  }
  fastForwardSummary: {
    currentStage: Evaluation2026IntegratedReadinessSnapshot['currentStage']
    overallReadinessStatus: Evaluation2026IntegratedReadinessSnapshot['overallStatus']
    officialActivationStatus: 'BLOCKED' | 'READY_FOR_REVIEW' | 'READY_LATER'
    currentBottleneck: string
    fastestSafeNextProcess: string
    parallelWorkstreamCount: number
    blockedWorkstreamCount: number
    quickWinCount: number
    criticalPathItemCount: number
    nextCheckpointCondition: string
  }
  parallelWorkstreams: Evaluation2026FastForwardWorkstream[]
  blockedWorkstreams: Evaluation2026FastForwardWorkstream[]
  workstreams: Evaluation2026FastForwardWorkstream[]
  dependencyMap: Evaluation2026FastForwardDependency[]
  criticalPath: Evaluation2026FastForwardPathItem[]
  quickWins: Evaluation2026FastForwardQuickWin[]
  minimumSafePathToBackfillDryRunReview: Array<{
    id: string
    label: string
    status: 'OPEN' | 'READY_FOR_REVIEW' | 'DONE'
    blockerCount: number | null
    nextAction: string
  }>
  ownerActionQueues: Record<'hr' | 'leader' | 'employee' | 'developer', Evaluation2026FastForwardQueueItem[]>
  routeActionMap: Array<{
    route: string
    actions: string[]
  }>
  operationsPlanText: string
  prohibitedActions: string[]
  copyPayloads: {
    fastForwardSummary: string
    criticalPath: string
    quickWins: string
    ownerActionQueues: string
    minimumSafePath: string
    prohibitedActions: string
    fullOperationsPlan: string
    markdown: string
    tsv: string
  }
  safety: {
    writesPerformed: false
    metadataSaved: false
    notificationsSent: false
    emailsSent: false
    backfillExecuted: false
    migrationsRun: false
    featureFlagsChanged: false
    totalScoreChanged: false
    gradeIdChanged: false
    evaluationsCreated: 0
    evaluationItemsCreated: 0
    noActivationButtons: true
    noMetadataSaveButtons: true
    noBackfillExecutionButtons: true
    noScoreGradeWriteButtons: true
    noAssignmentSync: true
    noPolicyCategoryAutoSave: true
    noTeamKpiAutoSave: true
  }
}

const PROHIBITED_ACTIONS = [
  'backfill --apply',
  'official scoring activation',
  'official grade activation',
  'AI score exclusion activation',
  'Evaluation.totalScore write',
  'Evaluation.gradeId write',
  'feature flag changes',
  'production data mutation',
  'backfill execution from UI',
  'score/grade write from UI',
  'assignment sync without HR approval',
  'automatic emails/notifications',
]

function valueOrZero(value: number | null | undefined) {
  return typeof value === 'number' ? value : 0
}

function confirmedKpiShortage(snapshot: Evaluation2026IntegratedReadinessSnapshot) {
  const active = snapshot.summary.activeEmployeeCount
  const confirmed = snapshot.summary.confirmedPersonalKpiCount
  if (active == null || confirmed == null) return null
  return Math.max(active - confirmed, 0)
}

function formatValue(value: number | string | null) {
  if (value == null) return '미확인'
  if (typeof value === 'number') return `${value.toLocaleString()}건`
  return value
}

function officialStatus(params: {
  snapshot: Evaluation2026IntegratedReadinessSnapshot
  executionBoard: Evaluation2026ReadinessExecutionBoard
  gates: Evaluation2026OfficialActivationGate[]
  runbook: Evaluation2026OfficialActivationRunbook
}): Evaluation2026FastForwardOperationsCockpit['fastForwardSummary']['officialActivationStatus'] {
  if (valueOrZero(params.snapshot.summary.officialActivationGateBlockerCount) > 0) return 'BLOCKED'
  if (params.gates.some((gate) => gate.status === 'BLOCKED')) return 'BLOCKED'
  if (params.executionBoard.summary.officialActivationStatus === 'BLOCKED') return 'BLOCKED'
  if (params.runbook.summary.readyForReviewSectionCount > 0) return 'READY_FOR_REVIEW'
  return 'READY_LATER'
}

function buildWorkstreams(params: {
  snapshot: Evaluation2026IntegratedReadinessSnapshot
  populationDryRun: Evaluation2026ReadinessPopulationDryRun | null
  evaluatorRoutingReadiness: Evaluation2026EvaluatorRoutingReadinessResult | null
  feedbackLeadershipReadiness: Evaluation2026FeedbackLeadershipReadinessResult | null
}): Evaluation2026FastForwardWorkstream[] {
  const { snapshot, populationDryRun, evaluatorRoutingReadiness, feedbackLeadershipReadiness } = params
  const missingMbo = snapshot.summary.missingMboCount
  const confirmedShortage = confirmedKpiShortage(snapshot)
  const teamKpiPending = snapshot.summary.teamKpiPendingCount
  const policyCategoryMissing = snapshot.summary.policyCategoryMissingCount
  const evaluatorBlockers = snapshot.summary.evaluatorRoutingBlockerCount
  const feedbackLeadershipBlockers = snapshot.summary.feedbackLeadershipBlockerCount
  const aiBlockers = snapshot.summary.aiReadinessBlockerCount
  const resultWarnings = snapshot.summary.resultWritingBlockerCount
  const leaderBlockers = snapshot.summary.leaderEvaluationBlockerCount
  const finalizationBlockers = snapshot.summary.finalizationCeoBlockerCount

  return [
    {
      id: 'MBO_COVERAGE',
      title: 'MBO Coverage Workstream',
      owners: ['HR', 'EMPLOYEE', 'LEADER'],
      status: valueOrZero(missingMbo) > 0 || valueOrZero(confirmedShortage) > 0 ? 'READY_TO_START' : 'READY_LATER',
      inputs: [
        { label: 'MBO missing', value: missingMbo, note: 'MBO setup readiness' },
        { label: 'confirmed KPI shortage', value: confirmedShortage, note: 'active employees - confirmed KPI' },
        { label: 'draft KPI employees', value: populationDryRun?.mboSetupCoverage?.employeesWithDraftPersonalKpiCount ?? null, note: 'draft holder export source' },
        { label: 'submitted KPI employees', value: populationDryRun?.mboSetupCoverage?.employeesWithSubmittedPersonalKpiCount ?? null, note: 'leader review source' },
      ],
      actions: ['export missing list', 'export draft holder list', 'send manual HR communication', 'leader follow-up'],
      expectedOutput: 'confirmed KPI coverage improved',
      relatedRoutes: ['/evaluation/performance', '/kpi/personal'],
      canRunInParallel: true,
      blockedReason: null,
    },
    {
      id: 'TEAM_KPI_POLICY_CATEGORY',
      title: 'Team KPI / policyCategory Workstream',
      owners: ['HR'],
      status: valueOrZero(teamKpiPending) > 0 || valueOrZero(policyCategoryMissing) > 0 ? 'READY_TO_START' : 'READY_LATER',
      inputs: [
        { label: 'Team KPI pending/discussion', value: teamKpiPending, note: '2026 팀 KPI 검토' },
        { label: 'policyCategory missing', value: policyCategoryMissing, note: '2026 정책 매핑 관리' },
      ],
      actions: ['review Team KPI', 'save readiness decision only if HR confirms', 'confirm policyCategory'],
      expectedOutput: 'ORG_GOAL / PROJECT_T / PROJECT_K / DAILY_WORK readiness improved',
      relatedRoutes: ['/evaluation/performance'],
      canRunInParallel: true,
      blockedReason: null,
    },
    {
      id: 'EVALUATOR_ROUTING',
      title: 'Evaluator Routing Workstream',
      owners: ['HR', 'ORG_ADMIN'],
      status: 'READY_TO_REVIEW',
      inputs: [
        { label: 'evaluator routing blockers', value: evaluatorBlockers, note: '2026 평가자 배정 readiness QA' },
        { label: 'missing FIRST', value: evaluatorRoutingReadiness?.summary.missingFirstEvaluatorCount ?? null, note: 'FIRST evaluator missing' },
        { label: 'missing SECOND', value: evaluatorRoutingReadiness?.summary.missingSecondEvaluatorCount ?? null, note: 'SECOND evaluator missing' },
        { label: 'missing FINAL', value: evaluatorRoutingReadiness?.summary.missingFinalApproverCount ?? null, note: 'FINAL approver missing' },
        { label: 'inactive evaluator warnings', value: evaluatorRoutingReadiness?.summary.inactiveEvaluatorWarningCount ?? null, note: 'inactive evaluator' },
        { label: 'manual review', value: evaluatorRoutingReadiness?.summary.manualReviewCount ?? null, note: 'manual review' },
      ],
      actions: ['inspect readiness QA', 'fix org/manager mapping', 'assignment sync only after explicit HR approval'],
      expectedOutput: 'evaluator chain readiness improved',
      relatedRoutes: ['/admin/performance-assignments', '/evaluation/performance'],
      canRunInParallel: true,
      blockedReason: null,
    },
    {
      id: 'FEEDBACK_LEADERSHIP',
      title: '360 / Leadership Workstream',
      owners: ['HR'],
      status: 'READY_TO_PLAN',
      inputs: [
        { label: '360/leadership blockers', value: feedbackLeadershipBlockers, note: '2026 360/리더십 readiness' },
        { label: 'missing reviewer assignments', value: feedbackLeadershipReadiness?.summary.missingReviewerAssignmentCount ?? null, note: 'reviewer assignment readiness' },
        { label: 'response missing', value: feedbackLeadershipReadiness?.summary.responseMissingCount ?? null, note: 'response readiness' },
      ],
      actions: ['confirm target groups', 'reviewer assignment plan', 'response readiness plan'],
      expectedOutput: 'leadership/feedback readiness planned',
      relatedRoutes: ['/admin/performance-calendar', '/evaluation/360/admin'],
      canRunInParallel: true,
      blockedReason: null,
    },
    {
      id: 'AI_PASS_FAIL',
      title: 'AI Pass/Fail Workstream',
      owners: ['HR', 'AI_REVIEWER'],
      status: 'READY_TO_PLAN',
      inputs: [
        { label: 'AI readiness blockers', value: aiBlockers, note: 'AI Pass/Fail readiness' },
      ],
      actions: ['confirm evidence path', 'target list', 'reviewer readiness'],
      expectedOutput: 'AI Pass/Fail readiness separated from annual score',
      relatedRoutes: ['/evaluation/ai-competency/admin'],
      canRunInParallel: true,
      blockedReason: null,
    },
    {
      id: 'RESULT_WRITING_LEADER_REVIEW',
      title: 'Result Writing / Leader Review Workstream',
      owners: ['HR', 'LEADER', 'EMPLOYEE'],
      status: valueOrZero(missingMbo) > 0 || valueOrZero(confirmedShortage) > 0 ? 'BLOCKED_UNTIL_MBO' : 'READY_LATER',
      inputs: [
        { label: 'result-writing warnings', value: resultWarnings, note: '2026 수행결과 작성 readiness' },
        { label: 'leader evaluation blockers', value: leaderBlockers, note: '2026 리더 평가 readiness' },
      ],
      actions: ['prepare guidance', 'do not start official evaluation'],
      expectedOutput: 'later-stage readiness prepared',
      relatedRoutes: ['/evaluation/performance', '/kpi/monthly'],
      canRunInParallel: false,
      blockedReason: 'MBO confirmed coverage and evaluator chain are prerequisites.',
    },
    {
      id: 'FINALIZATION_CEO',
      title: 'Finalization / CEO Workstream',
      owners: ['HR', 'CEO_OFFICE'],
      status: 'BLOCKED_UNTIL_SCORE_AND_GRADE',
      inputs: [
        { label: 'finalization/CEO blockers', value: finalizationBlockers, note: '2026 최종 확정 readiness' },
      ],
      actions: ['keep read-only', 'prepare later checklist'],
      expectedOutput: 'final stage dependencies known',
      relatedRoutes: ['/evaluation/performance'],
      canRunInParallel: false,
      blockedReason: 'Finalization depends on leader evaluation, score policy, grade policy, 360/AI readiness, and official scoring/grade sequencing.',
    },
    {
      id: 'DEVELOPER_WATCH',
      title: 'Developer / Watch Workstream',
      owners: ['DEV'],
      status: 'WATCH_ONLY',
      inputs: [
        { label: 'Vercel logs', value: 'watch-only', note: '500/P2021/P2022/JWT/schema/runtime' },
        { label: 'official gate blockers', value: snapshot.summary.officialActivationGateBlockerCount, note: 'activation gate consistency' },
      ],
      actions: ['watch logs', 'no writes', 'hotfix only on runtime/schema/auth error'],
      expectedOutput: 'production stability monitored',
      relatedRoutes: ['/evaluation/performance', '/admin/performance-calendar'],
      canRunInParallel: true,
      blockedReason: null,
    },
  ]
}

function buildDependencies(): Evaluation2026FastForwardDependency[] {
  return [
    { from: 'MBO confirmed', to: 'Result writing', reason: 'Result writing depends on MBO confirmed.' },
    { from: 'SELF/result readiness + evaluator chain', to: 'Leader evaluation', reason: 'Leader evaluation depends on SELF/result readiness and evaluator chain.' },
    { from: 'Leader evaluation + score/grade + 360/AI', to: 'Finalization', reason: 'Finalization depends on leader evaluation, score policy, grade policy, 360/AI readiness.' },
    { from: 'MBO/policy/evaluator readiness + DB backup + HR approval', to: 'Backfill dry-run review', reason: 'Backfill dry-run review depends on readiness blockers, DB backup, and HR approval.' },
    { from: 'Backfill/dry-run approval + AI exclusion policy', to: 'Official scoring', reason: 'Official scoring depends on backfill/dry-run approval and AI exclusion policy.' },
    { from: 'Score stability + grade policy + finalization readiness', to: 'Official grade', reason: 'Official grade depends on score stability, grade policy, calibration/finalization readiness.' },
    { from: 'Official grade + CEO/final confirmation', to: 'gradeId write', reason: 'gradeId write is last.' },
  ]
}

function statusForCount(count: number | null | undefined) {
  if (count == null) return 'OPEN' as const
  return count > 0 ? 'OPEN' as const : 'DONE' as const
}

function buildCriticalPath(snapshot: Evaluation2026IntegratedReadinessSnapshot): Evaluation2026FastForwardPathItem[] {
  const confirmedShortage = confirmedKpiShortage(snapshot)
  return [
    {
      order: 1,
      title: 'MBO coverage',
      status: valueOrZero(snapshot.summary.missingMboCount) > 0 || valueOrZero(confirmedShortage) > 0 ? 'READY_TO_START' : 'READY_LATER',
      owner: 'HR',
      nextAction: 'MBO 미작성자와 초안 보유자 follow-up을 먼저 진행하세요.',
    },
    {
      order: 2,
      title: 'Team KPI / policyCategory',
      status: valueOrZero(snapshot.summary.teamKpiPendingCount) > 0 || valueOrZero(snapshot.summary.policyCategoryMissingCount) > 0 ? 'READY_TO_START' : 'READY_LATER',
      owner: 'HR',
      nextAction: 'Team KPI pending과 policyCategory 미분류를 정리하세요.',
    },
    {
      order: 3,
      title: 'Evaluator routing',
      status: 'READY_TO_REVIEW',
      owner: 'HR',
      nextAction: 'FIRST/SECOND/FINAL evaluator chain blocker를 확인하세요.',
    },
    {
      order: 4,
      title: 'Result writing readiness',
      status: valueOrZero(snapshot.summary.missingMboCount) > 0 || valueOrZero(confirmedShortage) > 0 ? 'BLOCKED_UNTIL_MBO' : 'READY_LATER',
      owner: 'LEADER',
      nextAction: '공식 평가는 시작하지 말고 guidance와 evidence 기준만 준비하세요.',
    },
    {
      order: 5,
      title: 'Leader evaluation readiness',
      status: valueOrZero(snapshot.summary.leaderEvaluationBlockerCount) > 0 ? 'BLOCKED_UNTIL_MBO' : 'READY_LATER',
      owner: 'LEADER',
      nextAction: 'SELF/result readiness와 evaluator chain이 준비된 뒤 다시 확인하세요.',
    },
    {
      order: 6,
      title: 'Finalization/CEO readiness',
      status: 'BLOCKED_UNTIL_SCORE_AND_GRADE',
      owner: 'HR',
      nextAction: '최종 확정은 score/grade 이후 단계로 유지하세요.',
    },
    {
      order: 7,
      title: 'Backfill dry-run review',
      status: valueOrZero(snapshot.summary.officialActivationGateBlockerCount) > 0 ? 'BLOCKED_BY_DATA' : 'READY_TO_REVIEW',
      owner: 'DEV',
      nextAction: 'readiness blocker 해소 후 dry-run review만 준비하세요.',
    },
    {
      order: 8,
      title: 'DB backup / HR approval',
      status: 'READY_LATER',
      owner: 'HR',
      nextAction: 'apply가 아니라 dry-run review 승인 조건으로만 관리하세요.',
    },
    {
      order: 9,
      title: 'Official scoring/grade later',
      status: 'READY_LATER',
      owner: 'DEV',
      nextAction: 'official scoring/grade는 별도 승인 전까지 금지 상태로 유지하세요.',
    },
  ]
}

function buildQuickWins(snapshot: Evaluation2026IntegratedReadinessSnapshot): Evaluation2026FastForwardQuickWin[] {
  const candidates: Evaluation2026FastForwardQuickWin[] = [
    {
      id: 'POLICY_CATEGORY_QUICK_WIN',
      title: 'policyCategory 미분류 정리',
      owner: 'HR',
      blockerCount: snapshot.summary.policyCategoryMissingCount,
      route: '/evaluation/performance',
      reason: '작은 건수이며 공식 활성화 없이 HR 기준 확인으로 진행 가능합니다.',
      expectedOutput: 'policyCategory readiness improved',
    },
    {
      id: 'TEAM_KPI_QUICK_WIN',
      title: 'Team KPI pending/discussion 검토',
      owner: 'HR',
      blockerCount: snapshot.summary.teamKpiPendingCount,
      route: '/evaluation/performance',
      reason: 'owner가 명확하고 MBO 완료 전에도 HR 검토가 가능합니다.',
      expectedOutput: 'Team KPI HR review readiness improved',
    },
    {
      id: 'SCORE_POLICY_QUICK_WIN',
      title: 'score policy blocker 확인',
      owner: 'HR',
      blockerCount: snapshot.summary.scorePolicyBlockerCount,
      route: '/evaluation/performance',
      reason: '공식 scoring 없이 simulator blocker를 정리할 수 있습니다.',
      expectedOutput: 'score policy readiness improved',
    },
    {
      id: 'RESULT_GUIDANCE_QUICK_WIN',
      title: 'result-writing warning guidance 준비',
      owner: 'HR',
      blockerCount: snapshot.summary.resultWritingBlockerCount,
      route: '/evaluation/performance',
      reason: '공식 평가 시작 없이 evidence/comment guidance를 준비할 수 있습니다.',
      expectedOutput: 'later result-writing readiness prepared',
    },
    {
      id: 'BASELINE_EXPORT_QUICK_WIN',
      title: 'report baseline/export',
      owner: 'HR',
      blockerCount: null,
      route: '/evaluation/performance',
      reason: '저장 없이 Markdown/TSV export로 운영 baseline을 남길 수 있습니다.',
      expectedOutput: 'baseline evidence ready',
    },
    {
      id: 'LOG_WATCH_QUICK_WIN',
      title: 'production log watch',
      owner: 'DEV',
      blockerCount: null,
      route: '/evaluation/performance',
      reason: '운영 안정성 watch는 모든 workstream과 병렬 진행 가능합니다.',
      expectedOutput: 'runtime/schema/auth risk monitored',
    },
  ]
  return candidates.filter((item) => item.blockerCount == null || item.blockerCount > 0)
}

function buildMinimumSafePath(snapshot: Evaluation2026IntegratedReadinessSnapshot) {
  return [
    {
      id: 'MBO_COVERAGE_SUFFICIENT',
      label: 'MBO coverage sufficient',
      status: statusForCount(Math.max(valueOrZero(snapshot.summary.missingMboCount), valueOrZero(confirmedKpiShortage(snapshot)))),
      blockerCount: Math.max(valueOrZero(snapshot.summary.missingMboCount), valueOrZero(confirmedKpiShortage(snapshot))),
      nextAction: 'MBO missing과 confirmed KPI shortage를 해소하세요.',
    },
    {
      id: 'TEAM_KPI_PENDING_RESOLVED',
      label: 'Team KPI pending resolved',
      status: statusForCount(snapshot.summary.teamKpiPendingCount),
      blockerCount: snapshot.summary.teamKpiPendingCount,
      nextAction: 'Team KPI pending/discussion 결정을 HR이 확인하세요.',
    },
    {
      id: 'POLICY_CATEGORY_ZERO',
      label: 'policyCategory missing 0',
      status: statusForCount(snapshot.summary.policyCategoryMissingCount),
      blockerCount: snapshot.summary.policyCategoryMissingCount,
      nextAction: 'policyCategory 미분류를 0건으로 정리하세요.',
    },
    {
      id: 'EVALUATOR_ROUTING_READY',
      label: 'evaluator routing blockers 0 or approved exceptions',
      status: statusForCount(snapshot.summary.evaluatorRoutingBlockerCount),
      blockerCount: snapshot.summary.evaluatorRoutingBlockerCount,
      nextAction: 'evaluator routing blocker를 해소하거나 예외 승인 근거를 준비하세요.',
    },
    {
      id: 'SCORE_GRADE_POLICY_READY',
      label: 'score/grade policy blockers 0',
      status: statusForCount(Math.max(valueOrZero(snapshot.summary.scorePolicyBlockerCount), valueOrZero(snapshot.summary.gradePolicyBlockerCount))),
      blockerCount: Math.max(valueOrZero(snapshot.summary.scorePolicyBlockerCount), valueOrZero(snapshot.summary.gradePolicyBlockerCount)),
      nextAction: 'score policy와 grade policy readiness blocker를 해소하세요.',
    },
    {
      id: 'AI_360_REVIEWED',
      label: 'AI/360 readiness reviewed',
      status: statusForCount(Math.max(valueOrZero(snapshot.summary.aiReadinessBlockerCount), valueOrZero(snapshot.summary.feedbackLeadershipBlockerCount))),
      blockerCount: Math.max(valueOrZero(snapshot.summary.aiReadinessBlockerCount), valueOrZero(snapshot.summary.feedbackLeadershipBlockerCount)),
      nextAction: 'AI Pass/Fail과 360/리더십 readiness를 공식 점수와 분리해서 확인하세요.',
    },
    {
      id: 'DB_BACKUP_PLAN',
      label: 'DB backup plan confirmed',
      status: 'OPEN' as const,
      blockerCount: null,
      nextAction: 'dry-run review 전 DB backup 계획을 확인하세요.',
    },
    {
      id: 'HR_APPROVAL',
      label: 'HR approval collected',
      status: 'OPEN' as const,
      blockerCount: null,
      nextAction: 'dry-run review 전 HR approval checklist를 확인하세요.',
    },
    {
      id: 'OFFICIAL_FLAGS_FALSE',
      label: 'official flags still false',
      status: 'READY_FOR_REVIEW' as const,
      blockerCount: null,
      nextAction: 'official scoring/grade/AI exclusion flags는 승인 전 false를 유지하세요.',
    },
    {
      id: 'DRY_RUN_ONLY',
      label: 'dry-run only, no apply',
      status: 'READY_FOR_REVIEW' as const,
      blockerCount: null,
      nextAction: 'dry-run 검토만 준비하고 apply는 실행하지 마세요.',
    },
  ]
}

function queueItem(params: Evaluation2026FastForwardQueueItem) {
  return params
}

function buildOwnerQueues(snapshot: Evaluation2026IntegratedReadinessSnapshot): Evaluation2026FastForwardOperationsCockpit['ownerActionQueues'] {
  const confirmedShortage = confirmedKpiShortage(snapshot)
  return {
    hr: [
      queueItem({
        priority: 'P0',
        title: 'MBO missing / draft holder follow-up',
        reason: 'MBO setup이 current bottleneck입니다.',
        blockerCount: Math.max(valueOrZero(snapshot.summary.missingMboCount), valueOrZero(confirmedShortage)),
        route: '/evaluation/performance',
        expectedOutput: 'confirmed KPI coverage improved',
        dependency: 'none',
        copyText: '2026 MBO 작성 또는 초안 제출을 완료해 주세요. 공식 점수/등급은 아직 실행되지 않습니다.',
      }),
      queueItem({
        priority: 'P1',
        title: 'Team KPI / policyCategory 정리',
        reason: 'policy mapping은 MBO 완료 전에도 병렬로 진행 가능합니다.',
        blockerCount: Math.max(valueOrZero(snapshot.summary.teamKpiPendingCount), valueOrZero(snapshot.summary.policyCategoryMissingCount)),
        route: '/evaluation/performance',
        expectedOutput: 'policy readiness improved',
        dependency: 'HR decision only',
      }),
      queueItem({
        priority: 'P0',
        title: 'Evaluator routing blocker review',
        reason: '평가자 chain은 leader review 준비의 선행 조건입니다.',
        blockerCount: snapshot.summary.evaluatorRoutingBlockerCount,
        route: '/admin/performance-assignments',
        expectedOutput: 'evaluator chain readiness improved',
        dependency: 'assignment sync requires explicit HR approval',
      }),
    ],
    leader: [
      queueItem({
        priority: 'P1',
        title: 'MBO 보완/제출 follow-up 준비',
        reason: '리더는 팀원 MBO 품질과 제출 상태를 준비할 수 있습니다.',
        blockerCount: confirmedShortage,
        route: '/kpi/personal',
        expectedOutput: 'leader follow-up ready',
        dependency: 'employee draft/submission',
      }),
      queueItem({
        priority: 'P2',
        title: 'result evidence guidance 준비',
        reason: '공식 평가는 시작하지 않고 증빙 기준만 준비합니다.',
        blockerCount: snapshot.summary.resultWritingBlockerCount,
        route: '/kpi/monthly',
        expectedOutput: 'result-writing readiness prepared',
        dependency: 'MBO confirmed before official result writing',
      }),
    ],
    employee: [
      queueItem({
        priority: 'P0',
        title: '2026 MBO 작성/초안 제출',
        reason: 'MBO missing과 confirmed KPI shortage를 줄이는 핵심 실행입니다.',
        blockerCount: snapshot.summary.missingMboCount,
        route: '/kpi/personal',
        expectedOutput: 'MBO draft/submission created',
        dependency: 'manual HR communication',
      }),
      queueItem({
        priority: 'P2',
        title: '월간 증빙/코멘트 정리',
        reason: 'result-writing readiness를 나중에 빠르게 진행하기 위한 준비입니다.',
        blockerCount: snapshot.summary.resultWritingBlockerCount,
        route: '/kpi/monthly',
        expectedOutput: 'evidence readiness prepared',
        dependency: 'no official evaluation start',
      }),
    ],
    developer: [
      queueItem({
        priority: 'P0',
        title: 'activation gate consistency watch',
        reason: '공식 gate blocker가 남아 있어 실행 버튼 없이 일관성만 감시합니다.',
        blockerCount: snapshot.summary.officialActivationGateBlockerCount,
        route: '/evaluation/performance',
        expectedOutput: 'readiness data stable',
        dependency: 'watch-only',
      }),
      queueItem({
        priority: 'P2',
        title: 'Vercel logs/schema/runtime watch',
        reason: 'HR 운영 중 runtime/schema/auth 오류만 hotfix 대상으로 봅니다.',
        blockerCount: null,
        route: '/evaluation/performance',
        expectedOutput: 'production stability monitored',
        dependency: 'no writes',
      }),
    ],
  }
}

function buildRouteActionMap(workstreams: Evaluation2026FastForwardWorkstream[]) {
  const routeMap = new Map<string, string[]>()
  for (const workstream of workstreams) {
    for (const route of workstream.relatedRoutes) {
      routeMap.set(route, [...(routeMap.get(route) ?? []), workstream.title])
    }
  }
  return Array.from(routeMap.entries()).map(([route, actions]) => ({ route, actions }))
}

function buildOperationsPlanText(params: {
  snapshot: Evaluation2026IntegratedReadinessSnapshot
  parallelWorkstreams: Evaluation2026FastForwardWorkstream[]
  blockedWorkstreams: Evaluation2026FastForwardWorkstream[]
  quickWins: Evaluation2026FastForwardQuickWin[]
  officialActivationStatus: Evaluation2026FastForwardOperationsCockpit['fastForwardSummary']['officialActivationStatus']
}) {
  const parallel = params.parallelWorkstreams.map((item) => item.title).join(', ')
  const blocked = params.blockedWorkstreams.map((item) => item.title).join(', ')
  const quick = params.quickWins.slice(0, 5).map((item) => item.title).join(', ')
  return [
    `현재 2026 readiness는 ${params.snapshot.currentStage} / ${params.snapshot.overallStatus} 상태입니다.`,
    `가장 빠르게 앞당길 수 있는 프로세스는 ${quick || 'readiness baseline export'}입니다.`,
    `병렬 진행 가능한 workstream은 ${parallel || '없음'}입니다.`,
    `MBO 또는 score/grade 전까지 막히는 workstream은 ${blocked || '없음'}입니다.`,
    'HR은 MBO coverage, Team KPI/policyCategory, evaluator routing을 우선 진행하고, 개발/운영은 production log와 gate consistency를 watch-only로 확인합니다.',
    `공식 활성화 상태는 ${params.officialActivationStatus}이며 backfill, 공식 점수, 공식 등급, feature flag, totalScore, gradeId는 계속 금지입니다.`,
  ].join(' ')
}

function buildActionText(items: Evaluation2026FastForwardQueueItem[]) {
  if (!items.length) return '현재 queue item이 없습니다.'
  return items.map((item) => [
    `- [${item.priority}] ${item.title}`,
    `  blocker: ${formatValue(item.blockerCount)}`,
    `  route: ${item.route}`,
    `  dependency: ${item.dependency}`,
    `  expected: ${item.expectedOutput}`,
  ].join('\n')).join('\n')
}

function buildWorkstreamText(items: Evaluation2026FastForwardWorkstream[]) {
  if (!items.length) return '현재 workstream이 없습니다.'
  return items.map((item) => [
    `- ${item.title}`,
    `  owners: ${item.owners.join(', ')}`,
    `  status: ${item.status}`,
    `  routes: ${item.relatedRoutes.join(', ')}`,
    `  output: ${item.expectedOutput}`,
  ].join('\n')).join('\n')
}

function buildPathText(items: Evaluation2026FastForwardPathItem[]) {
  return items.map((item) =>
    `${item.order}. ${item.title} · ${item.status} · ${item.owner} · ${item.nextAction}`
  ).join('\n')
}

function buildQuickWinText(items: Evaluation2026FastForwardQuickWin[]) {
  return items.map((item) =>
    `- ${item.title}: ${formatValue(item.blockerCount)} · ${item.owner} · ${item.reason} (${item.route})`
  ).join('\n')
}

function buildMinimumSafePathText(items: Evaluation2026FastForwardOperationsCockpit['minimumSafePathToBackfillDryRunReview']) {
  return items.map((item) =>
    `- [${item.status}] ${item.label}: ${formatValue(item.blockerCount)} · ${item.nextAction}`
  ).join('\n')
}

function buildMarkdown(params: {
  summary: Evaluation2026FastForwardOperationsCockpit['fastForwardSummary']
  workstreams: Evaluation2026FastForwardWorkstream[]
  criticalPath: Evaluation2026FastForwardPathItem[]
  quickWins: Evaluation2026FastForwardQuickWin[]
  minimumSafePath: Evaluation2026FastForwardOperationsCockpit['minimumSafePathToBackfillDryRunReview']
  queues: Evaluation2026FastForwardOperationsCockpit['ownerActionQueues']
  operationsPlanText: string
  prohibitedActions: string[]
}) {
  return [
    '# 2026 Fast-Forward Operations Cockpit',
    '',
    params.operationsPlanText,
    '',
    '## Fast-forward summary',
    `- current stage: ${params.summary.currentStage}`,
    `- overall readiness status: ${params.summary.overallReadinessStatus}`,
    `- official activation status: ${params.summary.officialActivationStatus}`,
    `- current bottleneck: ${params.summary.currentBottleneck}`,
    `- fastest safe next process: ${params.summary.fastestSafeNextProcess}`,
    '',
    '## Parallel workstreams',
    buildWorkstreamText(params.workstreams.filter((item) => item.canRunInParallel)),
    '',
    '## Critical path',
    buildPathText(params.criticalPath),
    '',
    '## Quick wins',
    buildQuickWinText(params.quickWins),
    '',
    '## Minimum safe path to backfill dry-run review',
    buildMinimumSafePathText(params.minimumSafePath),
    '',
    '## Owner queues',
    '### HR',
    buildActionText(params.queues.hr),
    '',
    '### Leader',
    buildActionText(params.queues.leader),
    '',
    '### Employee',
    buildActionText(params.queues.employee),
    '',
    '### Developer / Watch',
    buildActionText(params.queues.developer),
    '',
    '## Prohibited actions',
    params.prohibitedActions.map((item) => `- ${item}`).join('\n'),
  ].join('\n')
}

function buildTsv(params: {
  workstreams: Evaluation2026FastForwardWorkstream[]
  criticalPath: Evaluation2026FastForwardPathItem[]
  quickWins: Evaluation2026FastForwardQuickWin[]
}) {
  const rows = [
    ['section', 'name', 'status_or_owner', 'count_or_order', 'route_or_next_action'].join('\t'),
    ...params.workstreams.map((item) => [
      'workstream',
      item.title,
      item.status,
      item.inputs.map((input) => `${input.label}:${formatValue(input.value)}`).join('; '),
      item.relatedRoutes.join(', '),
    ].join('\t')),
    ...params.criticalPath.map((item) => [
      'critical_path',
      item.title,
      item.status,
      String(item.order),
      item.nextAction,
    ].join('\t')),
    ...params.quickWins.map((item) => [
      'quick_win',
      item.title,
      item.owner,
      formatValue(item.blockerCount),
      item.route,
    ].join('\t')),
  ]
  return rows.join('\n')
}

export function buildEvaluation2026FastForwardOperationsCockpit(params: {
  integratedReadinessSnapshot: Evaluation2026IntegratedReadinessSnapshot
  readinessActionPlan: Evaluation2026ReadinessActionPlan
  readinessExecutionBoard: Evaluation2026ReadinessExecutionBoard
  readinessScenarioSimulator: Evaluation2026ReadinessScenarioSimulator
  officialActivationRunbook: Evaluation2026OfficialActivationRunbook
  officialActivationGates: Evaluation2026OfficialActivationGate[]
  populationDryRun: Evaluation2026ReadinessPopulationDryRun | null
  evaluatorRoutingReadiness: Evaluation2026EvaluatorRoutingReadinessResult | null
  feedbackLeadershipReadiness: Evaluation2026FeedbackLeadershipReadinessResult | null
}): Evaluation2026FastForwardOperationsCockpit {
  const snapshot = params.integratedReadinessSnapshot
  const workstreams = buildWorkstreams({
    snapshot,
    populationDryRun: params.populationDryRun,
    evaluatorRoutingReadiness: params.evaluatorRoutingReadiness,
    feedbackLeadershipReadiness: params.feedbackLeadershipReadiness,
  })
  const parallelWorkstreams = workstreams.filter((item) => item.canRunInParallel)
  const blockedWorkstreams = workstreams.filter((item) => item.status.startsWith('BLOCKED'))
  const criticalPath = buildCriticalPath(snapshot)
  const quickWins = buildQuickWins(snapshot)
  const minimumSafePathToBackfillDryRunReview = buildMinimumSafePath(snapshot)
  const ownerActionQueues = buildOwnerQueues(snapshot)
  const routeActionMap = buildRouteActionMap(workstreams)
  const officialActivationStatus = officialStatus({
    snapshot,
    executionBoard: params.readinessExecutionBoard,
    gates: params.officialActivationGates,
    runbook: params.officialActivationRunbook,
  })
  const currentBottleneck = snapshot.topBlockers[0]?.name ?? 'readiness blocker 재확인'
  const fastestSafeNextProcess = quickWins[0]?.title ?? params.readinessScenarioSimulator.defaultScenario.nextRecommendedHrAction
  const nextCheckpointCondition = 'MBO coverage, Team KPI/policyCategory, evaluator routing 1차 정리 후 updated snapshot을 다시 export합니다.'
  const fastForwardSummary = {
    currentStage: snapshot.currentStage,
    overallReadinessStatus: snapshot.overallStatus,
    officialActivationStatus,
    currentBottleneck,
    fastestSafeNextProcess,
    parallelWorkstreamCount: parallelWorkstreams.length,
    blockedWorkstreamCount: blockedWorkstreams.length,
    quickWinCount: quickWins.length,
    criticalPathItemCount: criticalPath.length,
    nextCheckpointCondition,
  }
  const operationsPlanText = buildOperationsPlanText({
    snapshot,
    parallelWorkstreams,
    blockedWorkstreams,
    quickWins,
    officialActivationStatus,
  })
  const markdown = buildMarkdown({
    summary: fastForwardSummary,
    workstreams,
    criticalPath,
    quickWins,
    minimumSafePath: minimumSafePathToBackfillDryRunReview,
    queues: ownerActionQueues,
    operationsPlanText,
    prohibitedActions: PROHIBITED_ACTIONS,
  })
  const tsv = buildTsv({
    workstreams,
    criticalPath,
    quickWins,
  })

  return {
    mode: 'READ_ONLY',
    generatedAt: new Date().toISOString(),
    metadataTracking: {
      enabled: false,
      saveAvailable: false,
      reason: 'readiness acceleration cockpit 전용 안전 metadata route가 없어 copy/export only로 제공합니다.',
    },
    fastForwardSummary,
    parallelWorkstreams,
    blockedWorkstreams,
    workstreams,
    dependencyMap: buildDependencies(),
    criticalPath,
    quickWins,
    minimumSafePathToBackfillDryRunReview,
    ownerActionQueues,
    routeActionMap,
    operationsPlanText,
    prohibitedActions: PROHIBITED_ACTIONS,
    copyPayloads: {
      fastForwardSummary: [
        `current stage: ${fastForwardSummary.currentStage}`,
        `overall readiness status: ${fastForwardSummary.overallReadinessStatus}`,
        `official activation status: ${fastForwardSummary.officialActivationStatus}`,
        `current bottleneck: ${fastForwardSummary.currentBottleneck}`,
        `fastest safe next process: ${fastForwardSummary.fastestSafeNextProcess}`,
        `next checkpoint: ${fastForwardSummary.nextCheckpointCondition}`,
      ].join('\n'),
      criticalPath: buildPathText(criticalPath),
      quickWins: buildQuickWinText(quickWins),
      ownerActionQueues: [
        '## HR',
        buildActionText(ownerActionQueues.hr),
        '## Leader',
        buildActionText(ownerActionQueues.leader),
        '## Employee',
        buildActionText(ownerActionQueues.employee),
        '## Developer / Watch',
        buildActionText(ownerActionQueues.developer),
      ].join('\n'),
      minimumSafePath: buildMinimumSafePathText(minimumSafePathToBackfillDryRunReview),
      prohibitedActions: PROHIBITED_ACTIONS.map((item) => `- ${item}`).join('\n'),
      fullOperationsPlan: markdown,
      markdown,
      tsv,
    },
    safety: {
      writesPerformed: false,
      metadataSaved: false,
      notificationsSent: false,
      emailsSent: false,
      backfillExecuted: false,
      migrationsRun: false,
      featureFlagsChanged: false,
      totalScoreChanged: false,
      gradeIdChanged: false,
      evaluationsCreated: 0,
      evaluationItemsCreated: 0,
      noActivationButtons: true,
      noMetadataSaveButtons: true,
      noBackfillExecutionButtons: true,
      noScoreGradeWriteButtons: true,
      noAssignmentSync: true,
      noPolicyCategoryAutoSave: true,
      noTeamKpiAutoSave: true,
    },
  }
}
