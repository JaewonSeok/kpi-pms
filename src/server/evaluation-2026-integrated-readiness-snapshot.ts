import type { Evaluation2026FeatureFlags } from '@/lib/feature-flags'
import type { EvaluationPreviewReadinessSummary2026 } from '@/server/evaluation-preview-2026-readiness'
import type { Evaluation2026GradePolicyReadinessResult } from '@/server/evaluation-2026-grade-policy-readiness'
import type { Evaluation2026EvaluatorRoutingReadinessResult } from '@/server/evaluation-2026-evaluator-routing-readiness'
import type { Evaluation2026FeedbackLeadershipReadinessResult } from '@/server/evaluation-2026-feedback-leadership-readiness'
import type { Evaluation2026ReadinessPopulationDryRun } from '@/server/evaluation-2026-readiness-population'
import type {
  Evaluation2026OfficialActivationGate,
  Evaluation2026OfficialActivationRunbook,
} from '@/server/evaluation-2026-activation-readiness'

export type Evaluation2026IntegratedReadinessStage =
  | 'MBO_SETUP_IN_PROGRESS'
  | 'POLICY_MAPPING_IN_PROGRESS'
  | 'REVIEWER_ASSIGNMENT_IN_PROGRESS'
  | 'RESULT_WRITING_NOT_READY'
  | 'OFFICIAL_ACTIVATION_BLOCKED'
  | 'READY_FOR_HR_REVIEW'
  | 'READY_FOR_BACKFILL_DRY_RUN_REVIEW'

export type Evaluation2026IntegratedReadinessStatus =
  | 'BLOCKED'
  | 'NEEDS_HR_ACTION'
  | 'NEEDS_DATA'
  | 'READY_FOR_REVIEW'
  | 'READY_LATER'
  | 'NOT_APPLICABLE'

export type Evaluation2026IntegratedReadinessBlocker = {
  code: string
  name: string
  count: number
  sourcePanel: string
  nextHrAction: string
  relatedRoute: string
}

export type Evaluation2026IntegratedReadinessAction = {
  label: string
  detail: string
  route: string
}

export type Evaluation2026IntegratedReadinessDecision = {
  id:
    | 'HR_READINESS_REVIEW'
    | 'BACKFILL_DRY_RUN_REVIEW'
    | 'BACKFILL_APPLY_APPROVAL'
    | 'OFFICIAL_SCORING_APPROVAL'
    | 'OFFICIAL_GRADE_APPROVAL'
    | 'CEO_FINAL_CONFIRMATION'
  label: string
  status: Evaluation2026IntegratedReadinessStatus
  blockerCount: number
  nextAction: string
}

export type Evaluation2026IntegratedReadinessActivationState = {
  id:
    | 'BACKFILL_APPLY'
    | 'OFFICIAL_SCORING'
    | 'AI_SCORE_EXCLUSION'
    | 'OFFICIAL_GRADE'
    | 'EVALUATION_TOTAL_SCORE_WRITE'
    | 'EVALUATION_GRADE_ID_WRITE'
  label: string
  status: Evaluation2026IntegratedReadinessStatus
  blockerCount: number
  nextAction: string
}

export type Evaluation2026IntegratedReadinessSnapshot = {
  mode: 'READ_ONLY'
  generatedAt: string
  currentStage: Evaluation2026IntegratedReadinessStage
  overallStatus: Evaluation2026IntegratedReadinessStatus
  summary: {
    activeEmployeeCount: number | null
    confirmedPersonalKpiCount: number | null
    missingMboCount: number | null
    policyCategoryMissingCount: number | null
    teamKpiPendingCount: number | null
    evaluatorRoutingBlockerCount: number | null
    resultWritingBlockerCount: number | null
    leaderEvaluationBlockerCount: number | null
    finalizationCeoBlockerCount: number | null
    gradePolicyBlockerCount: number | null
    scorePolicyBlockerCount: number | null
    aiReadinessBlockerCount: number | null
    feedbackLeadershipBlockerCount: number | null
    officialActivationGateBlockerCount: number | null
  }
  completionRates: {
    mboConfirmedRate: number | null
    evaluatorRoutingReadyRate: number | null
    feedbackLeadershipCompletionRate: number | null
    leaderEvaluationReadyRate: number | null
    finalizationReadyLaterRate: number | null
  }
  topBlockers: Evaluation2026IntegratedReadinessBlocker[]
  nextActions: {
    hr: Evaluation2026IntegratedReadinessAction[]
    leader: Evaluation2026IntegratedReadinessAction[]
    employee: Evaluation2026IntegratedReadinessAction[]
    developer: Evaluation2026IntegratedReadinessAction[]
  }
  activationState: Evaluation2026IntegratedReadinessActivationState[]
  decisionReadiness: Evaluation2026IntegratedReadinessDecision[]
  prohibitedActions: string[]
  executiveReportText: string
  copyPayloads: {
    executiveSummary: string
    hrActionList: string
    developerActionList: string
    blockerSummary: string
    prohibitedActions: string
    markdown: string
    tsv: string
  }
  safety: {
    writesPerformed: false
    notificationsSent: false
    emailsSent: false
    backfillExecuted: false
    migrationsRun: false
    featureFlagsChanged: false
    totalScoreChanged: false
    gradeIdChanged: false
    evaluationsCreated: 0
    evaluationItemsCreated: 0
    officialScoringEnabled: boolean
    officialGradeEnabled: boolean
    officialAiScoreExclusionEnabled: boolean
    noActivationButtons: true
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
]

function ratio(numerator: number | null, denominator: number | null) {
  if (numerator == null || denominator == null || denominator <= 0) return null
  return Math.round((numerator / denominator) * 1000) / 10
}

function valueOrZero(value: number | null | undefined) {
  return typeof value === 'number' ? value : 0
}

function gradePolicyBlockerCount(readiness: Evaluation2026GradePolicyReadinessResult | null) {
  if (!readiness) return null
  if (readiness.persistence.compatibilityIssue) return 1
  if (!readiness.persistence.available) return 1
  let count = 0
  if (!readiness.gradePolicyExists) count += 1
  if (!readiness.gradePolicyGroupsComplete) count += Math.max(1, readiness.missingRowsCount)
  count += readiness.differsFromPptCount
  count += readiness.overlapCount
  count += readiness.gapCount
  count += readiness.missingHrDecisionCount
  if (readiness.teamMemberSalesAmbiguity.requiresDecision) count += 1
  return count
}

function gateStatusToSnapshotStatus(
  status: Evaluation2026OfficialActivationGate['status']
): Evaluation2026IntegratedReadinessStatus {
  if (status === 'READY') return 'READY_LATER'
  return status
}

function runbookStatusToSnapshotStatus(
  status: Evaluation2026OfficialActivationRunbook['sections'][number]['status']
): Evaluation2026IntegratedReadinessStatus {
  if (status === 'READY_FOR_REVIEW') return 'READY_FOR_REVIEW'
  return status
}

function findRunbookSection(
  runbook: Evaluation2026OfficialActivationRunbook,
  id: Evaluation2026OfficialActivationRunbook['sections'][number]['id']
) {
  return runbook.sections.find((section) => section.id === id)
}

function addBlocker(
  target: Evaluation2026IntegratedReadinessBlocker[],
  blocker: Evaluation2026IntegratedReadinessBlocker
) {
  if (blocker.count > 0) target.push(blocker)
}

function buildActionList(items: Evaluation2026IntegratedReadinessAction[]) {
  return items.map((item) => `- ${item.label}: ${item.detail} (${item.route})`).join('\n')
}

function buildBlockerSummary(items: Evaluation2026IntegratedReadinessBlocker[]) {
  if (!items.length) return '현재 통합 snapshot 기준 주요 blocker가 없습니다.'
  return items.map((item) =>
    `- ${item.name}: ${item.count}건 · ${item.sourcePanel} · ${item.nextHrAction} (${item.relatedRoute})`
  ).join('\n')
}

function buildSnapshotTsv(items: Evaluation2026IntegratedReadinessBlocker[]) {
  const header = ['blocker', 'count', 'sourcePanel', 'nextHrAction', 'relatedRoute'].join('\t')
  const rows = items.map((item) => [
    item.name,
    String(item.count),
    item.sourcePanel,
    item.nextHrAction,
    item.relatedRoute,
  ].join('\t'))
  return [header, ...rows].join('\n')
}

function buildExecutiveReportText(params: {
  currentStage: Evaluation2026IntegratedReadinessStage
  overallStatus: Evaluation2026IntegratedReadinessStatus
  topBlockers: Evaluation2026IntegratedReadinessBlocker[]
  hrActions: Evaluation2026IntegratedReadinessAction[]
  developerActions: Evaluation2026IntegratedReadinessAction[]
}) {
  const blockerText = params.topBlockers.length
    ? params.topBlockers.slice(0, 5).map((item) => `${item.name} ${item.count}건`).join(', ')
    : '현재 통합 snapshot 기준 주요 차단 조건 없음'
  const hrText = params.hrActions.slice(0, 4).map((item) => item.label).join(', ')
  const developerText = params.developerActions.slice(0, 4).map((item) => item.label).join(', ')
  return [
    `현재 공식 전환 단계는 ${params.currentStage}이며, 전체 상태는 ${params.overallStatus}입니다.`,
    `주요 차단 조건은 ${blockerText}입니다.`,
    `HR 우선 조치는 ${hrText || 'readiness 결과 재확인'}입니다.`,
    `개발/운영 우선 조치는 ${developerText || 'read-only 검증 유지'}입니다.`,
    '공식 점수/등급 금지 상태는 유지되며 backfill --apply, official scoring, official grade, totalScore, gradeId write는 실행하지 않습니다.',
    '다음 의사결정 조건은 blocker 해소, dry-run 검토, DB backup 확인, HR 승인입니다.',
  ].join('\n')
}

function determineCurrentStage(params: {
  missingMboCount: number | null
  missingConfirmedKpiCount: number | null
  policyCategoryMissingCount: number | null
  teamKpiPendingCount: number | null
  scorePolicyBlockerCount: number | null
  evaluatorRoutingBlockerCount: number | null
  resultWritingBlockerCount: number | null
  officialActivationGateBlockerCount: number | null
  runbook: Evaluation2026OfficialActivationRunbook
}): Evaluation2026IntegratedReadinessStage {
  if (valueOrZero(params.missingMboCount) > 0 || valueOrZero(params.missingConfirmedKpiCount) > 0) {
    return 'MBO_SETUP_IN_PROGRESS'
  }
  if (
    valueOrZero(params.policyCategoryMissingCount) > 0 ||
    valueOrZero(params.teamKpiPendingCount) > 0 ||
    valueOrZero(params.scorePolicyBlockerCount) > 0
  ) {
    return 'POLICY_MAPPING_IN_PROGRESS'
  }
  if (valueOrZero(params.evaluatorRoutingBlockerCount) > 0) return 'REVIEWER_ASSIGNMENT_IN_PROGRESS'
  if (valueOrZero(params.resultWritingBlockerCount) > 0) return 'RESULT_WRITING_NOT_READY'
  if (valueOrZero(params.officialActivationGateBlockerCount) > 0) {
    const dryRunSection = findRunbookSection(params.runbook, 'BACKFILL_DRY_RUN')
    return dryRunSection?.status === 'READY_FOR_REVIEW'
      ? 'READY_FOR_BACKFILL_DRY_RUN_REVIEW'
      : 'OFFICIAL_ACTIVATION_BLOCKED'
  }
  return 'READY_FOR_HR_REVIEW'
}

function determineOverallStatus(params: {
  populationAvailable: boolean
  topBlockers: Evaluation2026IntegratedReadinessBlocker[]
  currentStage: Evaluation2026IntegratedReadinessStage
}) {
  if (!params.populationAvailable) return 'NEEDS_DATA'
  if (params.currentStage === 'READY_FOR_BACKFILL_DRY_RUN_REVIEW') return 'READY_FOR_REVIEW'
  if (params.currentStage === 'READY_FOR_HR_REVIEW') return 'READY_LATER'
  if (params.topBlockers.length > 0) return 'NEEDS_HR_ACTION'
  return 'BLOCKED'
}

export function buildEvaluation2026IntegratedReadinessSnapshot(params: {
  flags: Evaluation2026FeatureFlags
  readiness: EvaluationPreviewReadinessSummary2026
  gradePolicyReadiness: Evaluation2026GradePolicyReadinessResult | null
  evaluatorRoutingReadiness: Evaluation2026EvaluatorRoutingReadinessResult | null
  feedbackLeadershipReadiness: Evaluation2026FeedbackLeadershipReadinessResult | null
  populationDryRun: Evaluation2026ReadinessPopulationDryRun | null
  populationDryRunError: string | null
  officialActivationGates: Evaluation2026OfficialActivationGate[]
  officialActivationRunbook: Evaluation2026OfficialActivationRunbook
}): Evaluation2026IntegratedReadinessSnapshot {
  const population = params.populationDryRun
  const missingMboCount = population?.mboSetupCoverage?.employeesMissingAnyPersonalKpiCount ?? null
  const missingConfirmedKpiCount = population?.employeesMissingConfirmedPersonalKpiCount ?? null
  const policyCategoryMissingCount = population?.policyCategoryMissingCount ?? params.readiness.missingPolicyCategoryCount
  const teamKpiPendingCount = population
    ? (population.teamKpiHrReviewCoverage?.pendingReviewCount ?? 0) + (population.teamKpiHrReviewCoverage?.needsDiscussionCount ?? 0)
    : null
  const evaluatorRoutingBlockerCount = params.evaluatorRoutingReadiness?.summary.blockerCount ?? null
  const resultWritingBlockerCount = population?.resultWritingReadiness?.summary.warningItemCount ?? null
  const leaderEvaluationBlockerCount = population?.leaderEvaluationReadiness?.summary.blockerCount ?? null
  const finalizationCeoBlockerCount = population?.finalizationCeoReadiness?.summary.finalizationBlockerCount ?? null
  const gradePolicyCount = gradePolicyBlockerCount(params.gradePolicyReadiness)
  const scorePolicyBlockerCount = population?.scorePolicyReadiness?.summary.violationsCount ?? null
  const aiReadinessBlockerCount = params.readiness.aiInsufficientDataCount
  const feedbackLeadershipBlockerCount = params.feedbackLeadershipReadiness?.summary.blockedOrNeedsSetupCount ?? null
  const officialActivationGateBlockerCount = params.officialActivationGates.reduce(
    (sum, gate) => sum + (gate.status === 'BLOCKED' ? gate.currentBlockerCount : 0),
    0
  )
  const activeEmployeeCount =
    population?.activeEmployeeCount ??
    params.evaluatorRoutingReadiness?.summary.activeEmployeeCount ??
    params.feedbackLeadershipReadiness?.summary.targetEmployeeCount ??
    null
  const confirmedPersonalKpiCount = population?.employeesWithConfirmedPersonalKpiCount ?? null

  const topBlockers: Evaluation2026IntegratedReadinessBlocker[] = []
  if (!population && params.populationDryRunError) {
    addBlocker(topBlockers, {
      code: 'READINESS_POPULATION_DRY_RUN_UNAVAILABLE',
      name: 'readiness population dry-run 미확인',
      count: 1,
      sourcePanel: '2026 readiness population dry-run',
      nextHrAction: '/evaluation/performance에서 readiness population dry-run을 먼저 확인하세요.',
      relatedRoute: '/evaluation/performance',
    })
  }
  addBlocker(topBlockers, {
    code: 'MISSING_MBO',
    name: 'MBO 없음',
    count: valueOrZero(missingMboCount),
    sourcePanel: 'MBO setup readiness',
    nextHrAction: '미작성자에게 /kpi/personal 작성 요청을 안내하세요.',
    relatedRoute: '/kpi/personal',
  })
  addBlocker(topBlockers, {
    code: 'CONFIRMED_PERSONAL_KPI_COVERAGE_LOW',
    name: '확정 PersonalKpi coverage 부족',
    count: valueOrZero(missingConfirmedKpiCount),
    sourcePanel: 'MBO setup readiness',
    nextHrAction: 'MBO 제출/리더 검토/확정 또는 명시적 제외 대상을 정리하세요.',
    relatedRoute: '/evaluation/performance',
  })
  addBlocker(topBlockers, {
    code: 'POLICY_CATEGORY_MISSING',
    name: 'policyCategory 미분류',
    count: valueOrZero(policyCategoryMissingCount),
    sourcePanel: '2026 정책 매핑 관리',
    nextHrAction: 'ORG_GOAL / PROJECT_T / PROJECT_K / DAILY_WORK 분류를 HR이 확정하세요.',
    relatedRoute: '/evaluation/performance',
  })
  addBlocker(topBlockers, {
    code: 'TEAM_KPI_REVIEW_PENDING',
    name: 'Team KPI HR review pending/discussion',
    count: valueOrZero(teamKpiPendingCount),
    sourcePanel: '2026 팀 KPI 검토',
    nextHrAction: '팀 KPI별 조직목표 반영/일상업무/예외/논의 필요 결정을 완료하세요.',
    relatedRoute: '/evaluation/performance',
  })
  addBlocker(topBlockers, {
    code: 'EVALUATOR_ROUTING_BLOCKERS',
    name: '평가자 배정 blocker',
    count: valueOrZero(evaluatorRoutingBlockerCount),
    sourcePanel: '2026 평가자 배정 readiness QA',
    nextHrAction: 'missing FIRST/SECOND/FINAL 및 manual review 항목을 해소하세요.',
    relatedRoute: '/admin/performance-assignments',
  })
  addBlocker(topBlockers, {
    code: 'RESULT_WRITING_WARNINGS',
    name: '수행결과 작성 warning',
    count: valueOrZero(resultWritingBlockerCount),
    sourcePanel: '2026 수행결과 작성 readiness',
    nextHrAction: 'missing result/evidence/contribution/measurable result 항목을 정리하세요.',
    relatedRoute: '/evaluation/performance',
  })
  addBlocker(topBlockers, {
    code: 'LEADER_EVALUATION_BLOCKERS',
    name: '리더 평가 readiness blocker',
    count: valueOrZero(leaderEvaluationBlockerCount),
    sourcePanel: '2026 리더 평가 readiness',
    nextHrAction: 'FIRST/SECOND review prerequisite blocker를 해소하세요.',
    relatedRoute: '/evaluation/performance',
  })
  addBlocker(topBlockers, {
    code: 'FINALIZATION_CEO_BLOCKERS',
    name: '최종/CEO readiness blocker',
    count: valueOrZero(finalizationCeoBlockerCount),
    sourcePanel: '2026 최종 확정 readiness',
    nextHrAction: 'finalization, CEO confirmation, calibration blocker를 확인하세요.',
    relatedRoute: '/evaluation/performance',
  })
  addBlocker(topBlockers, {
    code: 'GRADE_POLICY_BLOCKERS',
    name: 'grade policy blocker',
    count: valueOrZero(gradePolicyCount),
    sourcePanel: '2026 등급 기준 readiness',
    nextHrAction: '등급 기준 누락/차이/중첩/HR decision blocker를 해소하세요.',
    relatedRoute: '/evaluation/performance',
  })
  addBlocker(topBlockers, {
    code: 'SCORE_POLICY_BLOCKERS',
    name: 'score policy blocker',
    count: valueOrZero(scorePolicyBlockerCount),
    sourcePanel: '2026 성과점수 정책 readiness',
    nextHrAction: 'weight cap, category, ORG_GOAL source, adjustment readiness warning을 정리하세요.',
    relatedRoute: '/evaluation/performance',
  })
  addBlocker(topBlockers, {
    code: 'AI_READINESS_BLOCKERS',
    name: 'AI readiness blocker',
    count: valueOrZero(aiReadinessBlockerCount),
    sourcePanel: 'AI Pass/Fail readiness',
    nextHrAction: 'AI 활용평가 대상/증빙/Pass-Fail summary를 확인하세요.',
    relatedRoute: '/evaluation/ai-competency/admin',
  })
  addBlocker(topBlockers, {
    code: 'FEEDBACK_LEADERSHIP_BLOCKERS',
    name: '360/리더십 readiness blocker',
    count: valueOrZero(feedbackLeadershipBlockerCount),
    sourcePanel: '2026 360/리더십 readiness',
    nextHrAction: 'missing reviewer, missing response, setup blocker를 확인하세요.',
    relatedRoute: '/admin/performance-calendar',
  })
  addBlocker(topBlockers, {
    code: 'OFFICIAL_ACTIVATION_GATE_BLOCKERS',
    name: '공식 전환 gate blocker',
    count: officialActivationGateBlockerCount,
    sourcePanel: '2026 공식 전환 Gate',
    nextHrAction: 'gate별 blocker와 Runbook next action을 확인하세요.',
    relatedRoute: '/evaluation/performance',
  })
  topBlockers.sort((a, b) => b.count - a.count)

  const currentStage = determineCurrentStage({
    missingMboCount,
    missingConfirmedKpiCount,
    policyCategoryMissingCount,
    teamKpiPendingCount,
    scorePolicyBlockerCount,
    evaluatorRoutingBlockerCount,
    resultWritingBlockerCount,
    officialActivationGateBlockerCount,
    runbook: params.officialActivationRunbook,
  })
  const overallStatus = determineOverallStatus({
    populationAvailable: Boolean(population),
    topBlockers,
    currentStage,
  })
  const hrActions = topBlockers.slice(0, 6).map((blocker) => ({
    label: blocker.name,
    detail: blocker.nextHrAction,
    route: blocker.relatedRoute,
  }))
  if (!hrActions.length) {
    hrActions.push({
      label: 'HR readiness review',
      detail: '통합 snapshot과 공식 전환 Runbook을 대조해 dry-run review 가능 여부를 확인하세요.',
      route: '/evaluation/performance',
    })
  }
  const leaderActions: Evaluation2026IntegratedReadinessAction[] = [
    {
      label: '리더 MBO 검토',
      detail: '제출/검토 중 MBO의 category, 비중, 수행계획, 측정 기준을 확인하세요.',
      route: '/kpi/personal',
    },
    {
      label: '리더 평가 readiness 확인',
      detail: 'FIRST/SECOND review prerequisite과 evidence sufficiency를 확인하세요.',
      route: '/evaluation/performance',
    },
  ]
  const employeeActions: Evaluation2026IntegratedReadinessAction[] = [
    {
      label: 'MBO 작성/제출',
      detail: '개인 KPI를 작성하고 조직목표/프로젝트/일상업무 구분과 수행계획을 보완하세요.',
      route: '/kpi/personal',
    },
    {
      label: '수행결과 증빙 준비',
      detail: '결과, 산출물, 본인 기여, 증빙 링크/월간 기록을 준비하세요.',
      route: '/kpi/monthly',
    },
  ]
  const developerActions: Evaluation2026IntegratedReadinessAction[] = [
    {
      label: 'production branch/commit 확인',
      detail: '공식 전환 논의 전 운영 배포 commit과 readiness panel 버전을 확인하세요.',
      route: '/evaluation/performance',
    },
    {
      label: 'dry-run output 보관',
      detail: 'HR 승인 전에는 dry-run/preview 출력만 보관하고 apply를 실행하지 마세요.',
      route: '/evaluation/performance',
    },
    {
      label: 'feature flag 유지',
      detail: 'official scoring, official grade, AI exclusion flag는 승인 전 false 상태를 유지하세요.',
      route: '/evaluation/performance',
    },
  ]

  const runbook = params.officialActivationRunbook
  const activationState: Evaluation2026IntegratedReadinessActivationState[] = [
    {
      id: 'BACKFILL_APPLY',
      label: 'backfill apply',
      status: runbookStatusToSnapshotStatus(findRunbookSection(runbook, 'BACKFILL_APPLY')?.status ?? 'BLOCKED'),
      blockerCount: findRunbookSection(runbook, 'BACKFILL_APPLY')?.currentBlockerCount ?? 1,
      nextAction: findRunbookSection(runbook, 'BACKFILL_APPLY')?.nextHrAction ?? 'Runbook blocker를 확인하세요.',
    },
    {
      id: 'OFFICIAL_SCORING',
      label: 'official scoring',
      status: runbookStatusToSnapshotStatus(findRunbookSection(runbook, 'OFFICIAL_SCORING_ACTIVATION')?.status ?? 'BLOCKED'),
      blockerCount: findRunbookSection(runbook, 'OFFICIAL_SCORING_ACTIVATION')?.currentBlockerCount ?? 1,
      nextAction: findRunbookSection(runbook, 'OFFICIAL_SCORING_ACTIVATION')?.nextHrAction ?? 'scoring gate blocker를 확인하세요.',
    },
    ...params.officialActivationGates
      .filter((gate) => gate.id === 'AI_SCORE_EXCLUSION')
      .map((gate) => ({
        id: gate.id,
        label: 'AI score exclusion',
        status: gateStatusToSnapshotStatus(gate.status),
        blockerCount: gate.currentBlockerCount,
        nextAction: gate.nextHrAction,
      })),
    {
      id: 'OFFICIAL_GRADE',
      label: 'official grade',
      status: runbookStatusToSnapshotStatus(findRunbookSection(runbook, 'OFFICIAL_GRADE_ACTIVATION')?.status ?? 'BLOCKED'),
      blockerCount: findRunbookSection(runbook, 'OFFICIAL_GRADE_ACTIVATION')?.currentBlockerCount ?? 1,
      nextAction: findRunbookSection(runbook, 'OFFICIAL_GRADE_ACTIVATION')?.nextHrAction ?? 'grade gate blocker를 확인하세요.',
    },
    {
      id: 'EVALUATION_TOTAL_SCORE_WRITE',
      label: 'Evaluation.totalScore write',
      status: runbookStatusToSnapshotStatus(findRunbookSection(runbook, 'EVALUATION_TOTAL_SCORE_WRITE')?.status ?? 'BLOCKED'),
      blockerCount: findRunbookSection(runbook, 'EVALUATION_TOTAL_SCORE_WRITE')?.currentBlockerCount ?? 1,
      nextAction: findRunbookSection(runbook, 'EVALUATION_TOTAL_SCORE_WRITE')?.nextHrAction ?? 'totalScore write gate를 확인하세요.',
    },
    {
      id: 'EVALUATION_GRADE_ID_WRITE',
      label: 'Evaluation.gradeId write',
      status: runbookStatusToSnapshotStatus(findRunbookSection(runbook, 'EVALUATION_GRADE_ID_WRITE')?.status ?? 'BLOCKED'),
      blockerCount: findRunbookSection(runbook, 'EVALUATION_GRADE_ID_WRITE')?.currentBlockerCount ?? 1,
      nextAction: findRunbookSection(runbook, 'EVALUATION_GRADE_ID_WRITE')?.nextHrAction ?? 'gradeId write gate를 확인하세요.',
    },
  ]

  const dryRunSection = findRunbookSection(runbook, 'BACKFILL_DRY_RUN')
  const backfillSection = findRunbookSection(runbook, 'BACKFILL_APPLY')
  const scoringSection = findRunbookSection(runbook, 'OFFICIAL_SCORING_ACTIVATION')
  const gradeSection = findRunbookSection(runbook, 'OFFICIAL_GRADE_ACTIVATION')
  const decisionReadiness: Evaluation2026IntegratedReadinessDecision[] = [
    {
      id: 'HR_READINESS_REVIEW',
      label: 'HR readiness review',
      status: population ? 'READY_FOR_REVIEW' : 'NEEDS_DATA',
      blockerCount: topBlockers.length,
      nextAction: population ? '상위 blocker와 Runbook checklist를 검토하세요.' : 'readiness dry-run 데이터를 먼저 불러오세요.',
    },
    {
      id: 'BACKFILL_DRY_RUN_REVIEW',
      label: 'backfill dry-run review',
      status: runbookStatusToSnapshotStatus(dryRunSection?.status ?? 'BLOCKED'),
      blockerCount: dryRunSection?.currentBlockerCount ?? 1,
      nextAction: dryRunSection?.nextHrAction ?? 'dry-run review 조건을 확인하세요.',
    },
    {
      id: 'BACKFILL_APPLY_APPROVAL',
      label: 'backfill apply approval',
      status: runbookStatusToSnapshotStatus(backfillSection?.status ?? 'BLOCKED'),
      blockerCount: backfillSection?.currentBlockerCount ?? 1,
      nextAction: backfillSection?.nextHrAction ?? 'DB backup과 HR approval 조건을 확인하세요.',
    },
    {
      id: 'OFFICIAL_SCORING_APPROVAL',
      label: 'official scoring approval',
      status: runbookStatusToSnapshotStatus(scoringSection?.status ?? 'BLOCKED'),
      blockerCount: scoringSection?.currentBlockerCount ?? 1,
      nextAction: scoringSection?.nextHrAction ?? 'scoring activation 조건을 확인하세요.',
    },
    {
      id: 'OFFICIAL_GRADE_APPROVAL',
      label: 'official grade approval',
      status: runbookStatusToSnapshotStatus(gradeSection?.status ?? 'BLOCKED'),
      blockerCount: gradeSection?.currentBlockerCount ?? 1,
      nextAction: gradeSection?.nextHrAction ?? 'grade activation 조건을 확인하세요.',
    },
    {
      id: 'CEO_FINAL_CONFIRMATION',
      label: 'CEO/final confirmation',
      status: valueOrZero(finalizationCeoBlockerCount) > 0 ? 'BLOCKED' : 'READY_LATER',
      blockerCount: valueOrZero(finalizationCeoBlockerCount),
      nextAction: valueOrZero(finalizationCeoBlockerCount) > 0
        ? '최종/CEO readiness blocker를 먼저 해소하세요.'
        : 'CEO/final confirmation은 공식 점수/등급 이후 별도 단계에서만 검토하세요.',
    },
  ]
  const executiveReportText = buildExecutiveReportText({
    currentStage,
    overallStatus,
    topBlockers,
    hrActions,
    developerActions,
  })
  const blockerSummary = buildBlockerSummary(topBlockers)
  const markdown = [
    '# 2026 통합 readiness snapshot',
    '',
    executiveReportText,
    '',
    '## Top blockers',
    blockerSummary,
    '',
    '## HR next actions',
    buildActionList(hrActions),
    '',
    '## Developer next actions',
    buildActionList(developerActions),
    '',
    '## Prohibited actions',
    PROHIBITED_ACTIONS.map((item) => `- ${item}`).join('\n'),
  ].join('\n')

  return {
    mode: 'READ_ONLY',
    generatedAt: new Date().toISOString(),
    currentStage,
    overallStatus,
    summary: {
      activeEmployeeCount,
      confirmedPersonalKpiCount,
      missingMboCount,
      policyCategoryMissingCount,
      teamKpiPendingCount,
      evaluatorRoutingBlockerCount,
      resultWritingBlockerCount,
      leaderEvaluationBlockerCount,
      finalizationCeoBlockerCount,
      gradePolicyBlockerCount: gradePolicyCount,
      scorePolicyBlockerCount,
      aiReadinessBlockerCount,
      feedbackLeadershipBlockerCount,
      officialActivationGateBlockerCount,
    },
    completionRates: {
      mboConfirmedRate: ratio(confirmedPersonalKpiCount, activeEmployeeCount),
      evaluatorRoutingReadyRate: ratio(
        params.evaluatorRoutingReadiness?.summary.completeEvaluatorChainCount ?? null,
        params.evaluatorRoutingReadiness?.summary.activeEmployeeCount ?? null
      ),
      feedbackLeadershipCompletionRate: params.feedbackLeadershipReadiness?.summary.completionRate ?? null,
      leaderEvaluationReadyRate: ratio(
        population?.leaderEvaluationReadiness?.summary.readyForLeaderReviewCount ?? null,
        population?.leaderEvaluationReadiness?.summary.targetEmployeeCount ?? null
      ),
      finalizationReadyLaterRate: ratio(
        population?.finalizationCeoReadiness?.summary.readyLaterCount ?? null,
        population?.finalizationCeoReadiness?.summary.finalReviewCandidateCount ?? null
      ),
    },
    topBlockers: topBlockers.slice(0, 10),
    nextActions: {
      hr: hrActions,
      leader: leaderActions,
      employee: employeeActions,
      developer: developerActions,
    },
    activationState,
    decisionReadiness,
    prohibitedActions: PROHIBITED_ACTIONS,
    executiveReportText,
    copyPayloads: {
      executiveSummary: executiveReportText,
      hrActionList: buildActionList(hrActions),
      developerActionList: buildActionList(developerActions),
      blockerSummary,
      prohibitedActions: PROHIBITED_ACTIONS.map((item) => `- ${item}`).join('\n'),
      markdown,
      tsv: buildSnapshotTsv(topBlockers),
    },
    safety: {
      writesPerformed: false,
      notificationsSent: false,
      emailsSent: false,
      backfillExecuted: false,
      migrationsRun: false,
      featureFlagsChanged: false,
      totalScoreChanged: false,
      gradeIdChanged: false,
      evaluationsCreated: 0,
      evaluationItemsCreated: 0,
      officialScoringEnabled: params.flags.officialScoringEnabled,
      officialGradeEnabled: params.flags.officialGradeEnabled,
      officialAiScoreExclusionEnabled: params.flags.aiScoreExclusionEnabled,
      noActivationButtons: true,
    },
  }
}
