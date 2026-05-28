import type { Evaluation2026IntegratedReadinessSnapshot } from '@/server/evaluation-2026-integrated-readiness-snapshot'
import type { Evaluation2026ReadinessExecutionBoard } from '@/server/evaluation-2026-readiness-execution-board'
import type { Evaluation2026FastForwardOperationsCockpit } from '@/server/evaluation-2026-fast-forward-operations'
import type { Evaluation2026ReadinessPopulationDryRun } from '@/server/evaluation-2026-readiness-population'
import type {
  Evaluation2026OfficialActivationGate,
  Evaluation2026OfficialActivationRunbook,
} from '@/server/evaluation-2026-activation-readiness'

export type Evaluation2026BackfillDryRunReviewStatus = 'BLOCKED' | 'READY_FOR_REVIEW' | 'READY_LATER'
export type Evaluation2026BackfillApplyStatus = 'BLOCKED' | 'NOT_ALLOWED' | 'READY_LATER'
export type Evaluation2026BackfillPreflightChecklistStatus =
  | 'OPEN'
  | 'READY_FOR_REVIEW'
  | 'READY_LATER'
  | 'BLOCKED'
export type Evaluation2026BackfillBackupStatus =
  | 'REQUIRED_NOT_CONFIRMED'
  | 'CONFIRMED_EXTERNALLY'
  | 'NOT_APPLICABLE'
export type Evaluation2026BackfillHrApprovalStatus =
  | 'REQUIRED_NOT_COLLECTED'
  | 'COLLECTED_EXTERNALLY'
  | 'NOT_APPLICABLE'
export type Evaluation2026BackfillOfficialFlagsStatus = 'MUST_REMAIN_FALSE'

export type Evaluation2026BackfillDryRunPreflightChecklistItem = {
  id: string
  label: string
  status: Evaluation2026BackfillPreflightChecklistStatus
  sourceBlockerCount: number | null
  relatedRoute: string
  nextAction: string
}

export type Evaluation2026BackfillDryRunCommandTemplate = {
  id: 'DRY_RUN_REFERENCE' | 'APPLY_HIDDEN'
  label: string
  commandText: string
  mode: 'TEXT_ONLY'
  executeAvailable: false
  warning: string
}

export type Evaluation2026BackfillExpectedOutputItem = {
  id: string
  label: string
  expectedReview: string
  requiredValue: string
}

export type Evaluation2026BackfillSurface = {
  existingDryRunScripts: string[]
  existingApplyScripts: string[]
  existingApiRoutes: string[]
  existingUiExecutionButtons: string[]
  existingSafetyGates: string[]
  dryRunOnlyWithoutWritesAvailable: boolean
  applySeparatedFromDryRun: boolean
  writesEvaluationOrEvaluationItem: string
  writesTotalScore: false
  writesGradeId: false
}

export type Evaluation2026BackfillDryRunPreflightPack = {
  mode: 'READ_ONLY'
  generatedAt: string
  existingSurface: Evaluation2026BackfillSurface
  preflightSummary: {
    currentStage: Evaluation2026IntegratedReadinessSnapshot['currentStage']
    overallReadinessStatus: Evaluation2026IntegratedReadinessSnapshot['overallStatus']
    officialActivationStatus: 'BLOCKED' | 'READY_FOR_REVIEW' | 'READY_LATER'
    backfillDryRunReviewStatus: Evaluation2026BackfillDryRunReviewStatus
    backfillApplyStatus: Evaluation2026BackfillApplyStatus
    blockerCount: number
    missingPreconditionsCount: number
    dbBackupStatus: Evaluation2026BackfillBackupStatus
    hrApprovalStatus: Evaluation2026BackfillHrApprovalStatus
    officialFlagsStatus: Evaluation2026BackfillOfficialFlagsStatus
    nextPreflightAction: string
    applyRemainsBlocked: true
  }
  preconditionsChecklist: Evaluation2026BackfillDryRunPreflightChecklistItem[]
  commandTemplates: Evaluation2026BackfillDryRunCommandTemplate[]
  expectedOutputChecklist: Evaluation2026BackfillExpectedOutputItem[]
  backupChecklist: string[]
  hrApprovalChecklist: string[]
  developerExecutionChecklist: string[]
  postCheckChecklist: string[]
  prohibitedActions: string[]
  copyPayloads: {
    preflightSummary: string
    preconditionsChecklist: string
    dryRunCommandReference: string
    expectedOutputChecklist: string
    dbBackupChecklist: string
    hrApprovalChecklist: string
    developerExecutionChecklist: string
    prohibitedActions: string
    markdown: string
    tsv: string
  }
  safety: {
    writesPerformed: false
    dryRunExecuted: false
    backfillExecuted: false
    backfillApplyExecuted: false
    migrationsRun: false
    featureFlagsChanged: false
    totalScoreChanged: false
    gradeIdChanged: false
    evaluationsCreated: 0
    evaluationItemsCreated: 0
    officialScoringEnabled: false
    officialGradeEnabled: false
    officialAiScoreExclusionEnabled: false
    notificationsSent: false
    emailsSent: false
    noActivationButtons: true
    noMetadataSaveButtons: true
    noDryRunExecutionButtons: true
    noBackfillExecutionButtons: true
    noApplyButtons: true
    noScoreGradeWriteButtons: true
    noAssignmentSync: true
    noPolicyCategoryAutoSave: true
    noTeamKpiAutoSave: true
  }
}

const PROHIBITED_ACTIONS = [
  'backfill --apply',
  'apply command execution',
  'official scoring activation',
  'official grade activation',
  'AI score exclusion activation',
  'Evaluation.totalScore write',
  'Evaluation.gradeId write',
  'feature flag changes',
  'production data mutation',
  'UI-triggered backfill',
  'UI-triggered score/grade write',
]

const BACKUP_CHECKLIST = [
  'DB backup owner',
  'backup timestamp',
  'restore test owner',
  'backup location',
  'retention confirmation',
  'rollback contact',
  'approval evidence',
]

const HR_APPROVAL_CHECKLIST = [
  'HR confirms target cycle',
  'HR confirms target population',
  'HR confirms MBO/policy readiness',
  'HR confirms evaluator readiness',
  'HR confirms score/grade policies',
  'HR confirms AI exclusion policy',
  'HR confirms no official activation yet',
  'HR approves dry-run review only',
  'HR does not approve apply yet',
]

const DEVELOPER_EXECUTION_CHECKLIST = [
  'confirm production branch/commit',
  'confirm env flags',
  'confirm DB backup',
  'run dry-run only after HR approval',
  'archive dry-run output',
  'compare expected vs actual dry-run output',
  'do not run apply',
  'do not toggle feature flags',
  'report anomalies',
  'watch logs',
]

const POST_CHECK_CHECKLIST = [
  'no writes performed',
  'no Evaluation.totalScore changes',
  'no Evaluation.gradeId changes',
  'no feature flag changes',
  'no official scoring/grade activation',
  'logs clean',
  'HR review complete',
  'apply still blocked unless separately approved',
]

function valueOrZero(value: number | null | undefined) {
  return typeof value === 'number' ? value : 0
}

function statusForBlocker(count: number | null | undefined): Evaluation2026BackfillPreflightChecklistStatus {
  if (count == null) return 'READY_LATER'
  return count > 0 ? 'BLOCKED' : 'READY_FOR_REVIEW'
}

function formatValue(value: number | null | undefined) {
  return typeof value === 'number' ? value.toLocaleString() : '미확인'
}

function officialActivationStatus(params: {
  snapshot: Evaluation2026IntegratedReadinessSnapshot
  executionBoard: Evaluation2026ReadinessExecutionBoard
  runbook: Evaluation2026OfficialActivationRunbook
  gates: Evaluation2026OfficialActivationGate[]
}): Evaluation2026BackfillDryRunPreflightPack['preflightSummary']['officialActivationStatus'] {
  if (valueOrZero(params.snapshot.summary.officialActivationGateBlockerCount) > 0) return 'BLOCKED'
  if (params.gates.some((gate) => gate.status === 'BLOCKED')) return 'BLOCKED'
  if (params.executionBoard.summary.officialActivationStatus === 'BLOCKED') return 'BLOCKED'
  if (params.runbook.summary.readyForReviewSectionCount > 0) return 'READY_FOR_REVIEW'
  return 'READY_LATER'
}

function buildExistingSurface(): Evaluation2026BackfillSurface {
  return {
    existingDryRunScripts: [
      'scripts/dry-run-backfill-2026-policy-metadata.ts',
      'scripts/dry-run-classify-2026-evaluation-items.ts',
      'scripts/dry-run-2026-score-impact.ts',
      'src/server/evaluation-2026-readiness-population.ts',
    ],
    existingApplyScripts: [
      'scripts/backfill-2026-policy-metadata.ts defaults to dry-run and requires explicit --apply',
    ],
    existingApiRoutes: [
      'GET /api/evaluation/preview-2026/readiness-population',
      'GET /api/evaluation/preview-2026/activation-readiness',
    ],
    existingUiExecutionButtons: [
      'No backfill apply button in readiness panels',
      '2026 readiness population dry-run is GET-only/read-only',
    ],
    existingSafetyGates: [
      'officialActivationRunbook BACKFILL_DRY_RUN',
      'officialActivationRunbook BACKFILL_APPLY',
      'assertPolicyBackfillCanApply requires explicit --apply and manual-review handling',
      'writePolicyBackfillBackup creates backup before apply',
    ],
    dryRunOnlyWithoutWritesAvailable: true,
    applySeparatedFromDryRun: true,
    writesEvaluationOrEvaluationItem:
      'Only the explicit --apply script can update additive PersonalKpi/EvaluationItem/AI metadata; it does not create Evaluation/EvaluationItem records.',
    writesTotalScore: false,
    writesGradeId: false,
  }
}

function buildPreconditions(params: {
  snapshot: Evaluation2026IntegratedReadinessSnapshot
  populationDryRun: Evaluation2026ReadinessPopulationDryRun | null
}): Evaluation2026BackfillDryRunPreflightChecklistItem[] {
  const snapshot = params.snapshot
  const confirmedKpiShortage =
    snapshot.summary.activeEmployeeCount == null || snapshot.summary.confirmedPersonalKpiCount == null
      ? params.populationDryRun?.employeesMissingConfirmedPersonalKpiCount ?? null
      : Math.max(snapshot.summary.activeEmployeeCount - snapshot.summary.confirmedPersonalKpiCount, 0)
  return [
    {
      id: 'MBO_COVERAGE_SUFFICIENT',
      label: 'MBO coverage sufficient',
      status: statusForBlocker(Math.max(valueOrZero(snapshot.summary.missingMboCount), valueOrZero(confirmedKpiShortage))),
      sourceBlockerCount: Math.max(valueOrZero(snapshot.summary.missingMboCount), valueOrZero(confirmedKpiShortage)),
      relatedRoute: '/kpi/personal',
      nextAction: 'MBO missing과 confirmed KPI shortage를 먼저 해소하세요.',
    },
    {
      id: 'CONFIRMED_KPI_SHORTAGE_RESOLVED',
      label: 'confirmed KPI shortage resolved or approved exclusions documented',
      status: statusForBlocker(confirmedKpiShortage),
      sourceBlockerCount: confirmedKpiShortage,
      relatedRoute: '/evaluation/performance',
      nextAction: '확정 PersonalKpi coverage 부족분 또는 제외 승인 근거를 준비하세요.',
    },
    {
      id: 'TEAM_KPI_PENDING_RESOLVED',
      label: 'Team KPI pending resolved',
      status: statusForBlocker(snapshot.summary.teamKpiPendingCount),
      sourceBlockerCount: snapshot.summary.teamKpiPendingCount,
      relatedRoute: '/evaluation/performance',
      nextAction: 'Team KPI pending/discussion 결정을 HR이 확인하세요.',
    },
    {
      id: 'POLICY_CATEGORY_ZERO',
      label: 'policyCategory missing 0',
      status: statusForBlocker(snapshot.summary.policyCategoryMissingCount),
      sourceBlockerCount: snapshot.summary.policyCategoryMissingCount,
      relatedRoute: '/evaluation/performance',
      nextAction: 'policyCategory 미분류를 0건으로 정리하세요.',
    },
    {
      id: 'EVALUATOR_ROUTING_READY',
      label: 'evaluator routing blockers 0 or approved exceptions',
      status: statusForBlocker(snapshot.summary.evaluatorRoutingBlockerCount),
      sourceBlockerCount: snapshot.summary.evaluatorRoutingBlockerCount,
      relatedRoute: '/admin/performance-assignments',
      nextAction: '평가자 배정 blocker를 해소하거나 예외 승인 근거를 준비하세요.',
    },
    {
      id: 'RESULT_WRITING_REVIEWED',
      label: 'result-writing readiness reviewed',
      status: statusForBlocker(snapshot.summary.resultWritingBlockerCount),
      sourceBlockerCount: snapshot.summary.resultWritingBlockerCount,
      relatedRoute: '/evaluation/performance',
      nextAction: '수행결과 작성 warnings를 HR/leader가 검토하세요.',
    },
    {
      id: 'LEADER_EVALUATION_REVIEWED',
      label: 'leader evaluation readiness reviewed',
      status: statusForBlocker(snapshot.summary.leaderEvaluationBlockerCount),
      sourceBlockerCount: snapshot.summary.leaderEvaluationBlockerCount,
      relatedRoute: '/evaluation/performance',
      nextAction: '리더 평가 readiness blocker와 evaluator chain을 확인하세요.',
    },
    {
      id: 'FINALIZATION_CEO_REVIEWED',
      label: 'finalization/CEO readiness reviewed',
      status: statusForBlocker(snapshot.summary.finalizationCeoBlockerCount),
      sourceBlockerCount: snapshot.summary.finalizationCeoBlockerCount,
      relatedRoute: '/evaluation/performance',
      nextAction: '최종 확정/CEO readiness blocker를 dry-run 전 review 항목으로 남기세요.',
    },
    {
      id: 'SCORE_POLICY_READY',
      label: 'score policy blockers 0',
      status: statusForBlocker(snapshot.summary.scorePolicyBlockerCount),
      sourceBlockerCount: snapshot.summary.scorePolicyBlockerCount,
      relatedRoute: '/evaluation/performance',
      nextAction: 'score policy readiness blocker를 0건으로 정리하세요.',
    },
    {
      id: 'GRADE_POLICY_READY',
      label: 'grade policy blockers 0',
      status: statusForBlocker(snapshot.summary.gradePolicyBlockerCount),
      sourceBlockerCount: snapshot.summary.gradePolicyBlockerCount,
      relatedRoute: '/evaluation/performance',
      nextAction: 'grade policy readiness blocker를 0건으로 정리하세요.',
    },
    {
      id: 'AI_EXCLUSION_POLICY_CONFIRMED',
      label: 'AI Pass/Fail exclusion policy confirmed',
      status: statusForBlocker(snapshot.summary.aiReadinessBlockerCount),
      sourceBlockerCount: snapshot.summary.aiReadinessBlockerCount,
      relatedRoute: '/evaluation/ai-competency/admin',
      nextAction: 'AI Pass/Fail exclusion policy를 공식 점수와 분리해서 확인하세요.',
    },
    {
      id: 'FEEDBACK_360_REVIEWED',
      label: '360/leadership readiness reviewed',
      status: statusForBlocker(snapshot.summary.feedbackLeadershipBlockerCount),
      sourceBlockerCount: snapshot.summary.feedbackLeadershipBlockerCount,
      relatedRoute: '/evaluation/360/admin',
      nextAction: '360/리더십 readiness를 dry-run 전 review 항목으로 확인하세요.',
    },
    {
      id: 'DRY_RUN_REVIEW_OWNER_ASSIGNED',
      label: 'dry-run output review owner assigned',
      status: 'OPEN',
      sourceBlockerCount: null,
      relatedRoute: '/evaluation/performance',
      nextAction: 'dry-run 출력 검토 owner를 HR/개발에서 지정하세요.',
    },
    {
      id: 'DB_BACKUP_PLAN_CONFIRMED',
      label: 'production DB backup plan confirmed',
      status: 'OPEN',
      sourceBlockerCount: null,
      relatedRoute: '/evaluation/performance',
      nextAction: 'production DB backup owner, 위치, 복구 담당자를 외부 승인으로 확인하세요.',
    },
    {
      id: 'HR_APPROVAL_PREPARED',
      label: 'HR approval checklist prepared',
      status: 'OPEN',
      sourceBlockerCount: null,
      relatedRoute: '/evaluation/performance',
      nextAction: 'HR approval checklist를 dry-run review only 범위로 준비하세요.',
    },
    {
      id: 'OFFICIAL_FLAGS_FALSE',
      label: 'official flags still false',
      status: 'READY_FOR_REVIEW',
      sourceBlockerCount: null,
      relatedRoute: '/evaluation/performance',
      nextAction: 'official scoring/grade/AI exclusion flags는 dry-run review 전후 모두 false를 유지하세요.',
    },
  ]
}

function buildCommandTemplates(): Evaluation2026BackfillDryRunCommandTemplate[] {
  return [
    {
      id: 'DRY_RUN_REFERENCE',
      label: 'Dry-run command template: reference only',
      commandText:
        'pnpm.cmd exec ts-node -P tsconfig.seed.json scripts/dry-run-backfill-2026-policy-metadata.ts --year=2026 --json=reports/backfill-2026-policy-metadata/dry-run.json --csv=reports/backfill-2026-policy-metadata/dry-run.csv',
      mode: 'TEXT_ONLY',
      executeAvailable: false,
      warning: '복사 전용이며 UI에서 실행하지 않습니다. HR 승인, DB backup 확인, production branch 확인 후 별도 runbook에서만 검토하세요.',
    },
    {
      id: 'APPLY_HIDDEN',
      label: 'Apply command template: 숨김 / 실행 금지',
      commandText: 'Production apply command must not be placed in UI.',
      mode: 'TEXT_ONLY',
      executeAvailable: false,
      warning: 'apply command execution과 backfill --apply는 이 화면과 이 PR 범위에서 금지입니다.',
    },
  ]
}

function buildExpectedOutputChecklist(): Evaluation2026BackfillExpectedOutputItem[] {
  return [
    { id: 'TARGET_CYCLE', label: 'target cycle', expectedReview: '공식 readiness cycle과 일치하는지 확인', requiredValue: 'HR 확인 필요' },
    { id: 'TARGET_POPULATION_COUNT', label: 'target population count', expectedReview: 'active employee scope와 dry-run 대상 수 비교', requiredValue: 'snapshot과 대조' },
    { id: 'EVALUATION_RECORDS', label: 'expected Evaluation records created/updated', expectedReview: 'dry-run 결과의 예상 변경 범위 확인', requiredValue: 'preflight에서는 writes false' },
    { id: 'EVALUATION_ITEM_RECORDS', label: 'expected EvaluationItem records created/updated', expectedReview: 'policy metadata 후보와 manual review 분리 확인', requiredValue: 'preflight에서는 writes false' },
    { id: 'POLICY_CATEGORY_MISSING', label: 'policyCategory missing count', expectedReview: '0건 또는 승인 예외인지 확인', requiredValue: '0 or approved exception' },
    { id: 'EVALUATOR_ASSIGNMENT_MISSING', label: 'evaluator assignment missing count', expectedReview: 'FIRST/SECOND/FINAL chain blocker 확인', requiredValue: '0 or approved exception' },
    { id: 'SCORE_POLICY_VIOLATIONS', label: 'score policy violations', expectedReview: 'weight/category/source warnings 확인', requiredValue: '0 before apply discussion' },
    { id: 'GRADE_POLICY_BLOCKERS', label: 'grade policy blockers', expectedReview: 'grade policy persistence/threshold blocker 확인', requiredValue: '0 before grade discussion' },
    { id: 'AI_EXCLUSION_STATUS', label: 'AI exclusion status', expectedReview: 'AI Pass/Fail이 annual score와 분리되어 있는지 확인', requiredValue: 'confirmed by HR' },
    { id: 'TOTAL_SCORE_CHANGES', label: 'totalScore changes expected', expectedReview: 'dry-run/preflight에서는 totalScore 변경이 없어야 함', requiredValue: 'false' },
    { id: 'GRADE_ID_CHANGES', label: 'gradeId changes expected', expectedReview: 'dry-run/preflight에서는 gradeId 변경이 없어야 함', requiredValue: 'false' },
    { id: 'WRITES_PERFORMED', label: 'writes performed', expectedReview: 'dry-run 결과가 쓰기를 수행하지 않았는지 확인', requiredValue: 'false for dry-run' },
  ]
}

function buildTextList(items: string[]) {
  return items.map((item) => `- ${item}`).join('\n')
}

function buildChecklistText(items: Evaluation2026BackfillDryRunPreflightChecklistItem[]) {
  return items.map((item) =>
    `- [${item.status}] ${item.label}: blocker=${formatValue(item.sourceBlockerCount)} · route=${item.relatedRoute} · next=${item.nextAction}`
  ).join('\n')
}

function buildExpectedOutputText(items: Evaluation2026BackfillExpectedOutputItem[]) {
  return items.map((item) =>
    `- ${item.label}: ${item.expectedReview} · required=${item.requiredValue}`
  ).join('\n')
}

function buildCommandText(items: Evaluation2026BackfillDryRunCommandTemplate[]) {
  return items.map((item) =>
    `## ${item.label}\nmode: ${item.mode}\nexecuteAvailable: ${String(item.executeAvailable)}\n${item.commandText}\nwarning: ${item.warning}`
  ).join('\n\n')
}

function buildMarkdown(params: {
  summary: Evaluation2026BackfillDryRunPreflightPack['preflightSummary']
  preconditions: Evaluation2026BackfillDryRunPreflightChecklistItem[]
  commands: Evaluation2026BackfillDryRunCommandTemplate[]
  expectedOutput: Evaluation2026BackfillExpectedOutputItem[]
  prohibitedActions: string[]
}) {
  return [
    '# 2026 Backfill Dry-run Preflight Pack',
    '',
    '## Summary',
    `- current stage: ${params.summary.currentStage}`,
    `- overall readiness status: ${params.summary.overallReadinessStatus}`,
    `- official activation status: ${params.summary.officialActivationStatus}`,
    `- backfill dry-run review status: ${params.summary.backfillDryRunReviewStatus}`,
    `- backfill apply status: ${params.summary.backfillApplyStatus}`,
    `- blocker count: ${params.summary.blockerCount.toLocaleString()}`,
    `- missing preconditions: ${params.summary.missingPreconditionsCount.toLocaleString()}`,
    `- DB backup status: ${params.summary.dbBackupStatus}`,
    `- HR approval status: ${params.summary.hrApprovalStatus}`,
    `- official flags status: ${params.summary.officialFlagsStatus}`,
    '',
    '## Preconditions checklist',
    buildChecklistText(params.preconditions),
    '',
    '## Dry-run command reference',
    buildCommandText(params.commands),
    '',
    '## Expected dry-run output checklist',
    buildExpectedOutputText(params.expectedOutput),
    '',
    '## DB backup checklist',
    buildTextList(BACKUP_CHECKLIST),
    '',
    '## HR approval checklist',
    buildTextList(HR_APPROVAL_CHECKLIST),
    '',
    '## Developer execution checklist',
    buildTextList(DEVELOPER_EXECUTION_CHECKLIST),
    '',
    '## Post-check checklist',
    buildTextList(POST_CHECK_CHECKLIST),
    '',
    '## Prohibited actions',
    params.prohibitedActions.map((item) => `- ${item}`).join('\n'),
  ].join('\n')
}

function buildTsv(params: {
  summary: Evaluation2026BackfillDryRunPreflightPack['preflightSummary']
  preconditions: Evaluation2026BackfillDryRunPreflightChecklistItem[]
  expectedOutput: Evaluation2026BackfillExpectedOutputItem[]
}) {
  return [
    ['section', 'id', 'label', 'status_or_required_value', 'count_or_route', 'next_action_or_review'].join('\t'),
    ['summary', 'BACKFILL_DRY_RUN_REVIEW', 'backfill dry-run review status', params.summary.backfillDryRunReviewStatus, String(params.summary.blockerCount), params.summary.nextPreflightAction].join('\t'),
    ['summary', 'BACKFILL_APPLY', 'backfill apply status', params.summary.backfillApplyStatus, 'apply remains blocked', 'do not run apply'].join('\t'),
    ...params.preconditions.map((item) => [
      'precondition',
      item.id,
      item.label,
      item.status,
      `${formatValue(item.sourceBlockerCount)} · ${item.relatedRoute}`,
      item.nextAction,
    ].join('\t')),
    ...params.expectedOutput.map((item) => [
      'expected_output',
      item.id,
      item.label,
      item.requiredValue,
      '',
      item.expectedReview,
    ].join('\t')),
  ].join('\n')
}

export function buildEvaluation2026BackfillDryRunPreflightPack(params: {
  integratedReadinessSnapshot: Evaluation2026IntegratedReadinessSnapshot
  readinessExecutionBoard: Evaluation2026ReadinessExecutionBoard
  fastForwardOperationsCockpit: Evaluation2026FastForwardOperationsCockpit
  officialActivationRunbook: Evaluation2026OfficialActivationRunbook
  officialActivationGates: Evaluation2026OfficialActivationGate[]
  populationDryRun: Evaluation2026ReadinessPopulationDryRun | null
}): Evaluation2026BackfillDryRunPreflightPack {
  const snapshot = params.integratedReadinessSnapshot
  const preconditionsChecklist = buildPreconditions({
    snapshot,
    populationDryRun: params.populationDryRun,
  })
  const blockerCount = snapshot.summary.officialActivationGateBlockerCount
    ?? params.officialActivationRunbook.summary.totalBlockerCount
    ?? 0
  const missingPreconditionsCount = preconditionsChecklist.filter((item) =>
    item.status === 'BLOCKED' || item.status === 'OPEN'
  ).length
  const backfillDryRunReviewStatus: Evaluation2026BackfillDryRunReviewStatus =
    missingPreconditionsCount > 0 || valueOrZero(blockerCount) > 0
      ? 'BLOCKED'
      : params.fastForwardOperationsCockpit.minimumSafePathToBackfillDryRunReview.some((item) => item.status === 'OPEN')
        ? 'READY_LATER'
        : 'READY_FOR_REVIEW'
  const officialStatus = officialActivationStatus({
    snapshot,
    executionBoard: params.readinessExecutionBoard,
    runbook: params.officialActivationRunbook,
    gates: params.officialActivationGates,
  })
  const nextOpenPrecondition = preconditionsChecklist.find((item) => item.status === 'BLOCKED' || item.status === 'OPEN')
  const preflightSummary: Evaluation2026BackfillDryRunPreflightPack['preflightSummary'] = {
    currentStage: snapshot.currentStage,
    overallReadinessStatus: snapshot.overallStatus,
    officialActivationStatus: officialStatus,
    backfillDryRunReviewStatus,
    backfillApplyStatus: 'NOT_ALLOWED',
    blockerCount: valueOrZero(blockerCount),
    missingPreconditionsCount,
    dbBackupStatus: 'REQUIRED_NOT_CONFIRMED',
    hrApprovalStatus: 'REQUIRED_NOT_COLLECTED',
    officialFlagsStatus: 'MUST_REMAIN_FALSE',
    nextPreflightAction: nextOpenPrecondition?.nextAction ?? 'dry-run output review owner와 HR approval evidence를 확인하세요.',
    applyRemainsBlocked: true,
  }
  const commandTemplates = buildCommandTemplates()
  const expectedOutputChecklist = buildExpectedOutputChecklist()
  const markdown = buildMarkdown({
    summary: preflightSummary,
    preconditions: preconditionsChecklist,
    commands: commandTemplates,
    expectedOutput: expectedOutputChecklist,
    prohibitedActions: PROHIBITED_ACTIONS,
  })
  const tsv = buildTsv({
    summary: preflightSummary,
    preconditions: preconditionsChecklist,
    expectedOutput: expectedOutputChecklist,
  })

  return {
    mode: 'READ_ONLY',
    generatedAt: new Date().toISOString(),
    existingSurface: buildExistingSurface(),
    preflightSummary,
    preconditionsChecklist,
    commandTemplates,
    expectedOutputChecklist,
    backupChecklist: BACKUP_CHECKLIST,
    hrApprovalChecklist: HR_APPROVAL_CHECKLIST,
    developerExecutionChecklist: DEVELOPER_EXECUTION_CHECKLIST,
    postCheckChecklist: POST_CHECK_CHECKLIST,
    prohibitedActions: PROHIBITED_ACTIONS,
    copyPayloads: {
      preflightSummary: [
        `current stage: ${preflightSummary.currentStage}`,
        `overall readiness status: ${preflightSummary.overallReadinessStatus}`,
        `official activation status: ${preflightSummary.officialActivationStatus}`,
        `backfill dry-run review status: ${preflightSummary.backfillDryRunReviewStatus}`,
        `backfill apply status: ${preflightSummary.backfillApplyStatus}`,
        `missing preconditions: ${preflightSummary.missingPreconditionsCount.toLocaleString()}`,
        `next preflight action: ${preflightSummary.nextPreflightAction}`,
        'apply remains blocked: true',
      ].join('\n'),
      preconditionsChecklist: buildChecklistText(preconditionsChecklist),
      dryRunCommandReference: buildCommandText(commandTemplates),
      expectedOutputChecklist: buildExpectedOutputText(expectedOutputChecklist),
      dbBackupChecklist: buildTextList(BACKUP_CHECKLIST),
      hrApprovalChecklist: buildTextList(HR_APPROVAL_CHECKLIST),
      developerExecutionChecklist: buildTextList(DEVELOPER_EXECUTION_CHECKLIST),
      prohibitedActions: PROHIBITED_ACTIONS.map((item) => `- ${item}`).join('\n'),
      markdown,
      tsv,
    },
    safety: {
      writesPerformed: false,
      dryRunExecuted: false,
      backfillExecuted: false,
      backfillApplyExecuted: false,
      migrationsRun: false,
      featureFlagsChanged: false,
      totalScoreChanged: false,
      gradeIdChanged: false,
      evaluationsCreated: 0,
      evaluationItemsCreated: 0,
      officialScoringEnabled: false,
      officialGradeEnabled: false,
      officialAiScoreExclusionEnabled: false,
      notificationsSent: false,
      emailsSent: false,
      noActivationButtons: true,
      noMetadataSaveButtons: true,
      noDryRunExecutionButtons: true,
      noBackfillExecutionButtons: true,
      noApplyButtons: true,
      noScoreGradeWriteButtons: true,
      noAssignmentSync: true,
      noPolicyCategoryAutoSave: true,
      noTeamKpiAutoSave: true,
    },
  }
}
