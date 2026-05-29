export type Evaluation2026DryRunUnlockPriority = 'P0' | 'P1' | 'P2'
export type Evaluation2026DryRunUnlockActionStatus = 'BLOCKED' | 'OPEN' | 'READY' | 'READY_LATER'
export type Evaluation2026DryRunUnlockOwner = 'HR' | 'LEADER' | 'EMPLOYEE' | 'DEVELOPER_WATCH' | 'CEO_OFFICE'
export type Evaluation2026DryRunUnlockDecision = 'NO_GO' | 'READY_LATER' | 'READY_FOR_REVIEW'

type UnlockSnapshotInput = {
  currentStage: string
  overallStatus: string
  summary: {
    activeEmployeeCount?: number | null
    confirmedPersonalKpiCount?: number | null
    officialActivationGateBlockerCount?: number | null
    missingMboCount?: number | null
    evaluatorRoutingBlockerCount?: number | null
    teamKpiPendingCount?: number | null
    policyCategoryMissingCount?: number | null
    aiReadinessBlockerCount?: number | null
    feedbackLeadershipBlockerCount?: number | null
    scorePolicyBlockerCount?: number | null
    gradePolicyBlockerCount?: number | null
    resultWritingBlockerCount?: number | null
    leaderEvaluationBlockerCount?: number | null
    finalizationCeoBlockerCount?: number | null
  }
}

type UnlockPopulationDryRunInput = {
  employeesMissingConfirmedPersonalKpiCount?: number | null
}

type UnlockPreflightInput = {
  preflightSummary: {
    dbBackupStatus: string
    hrApprovalStatus: string
  }
}

type UnlockOutputTemplateInput = {
  templateStatus: string
}

type UnlockCommandRunbookInput = {
  status: string
  dryRunOnlyCommandReference: {
    executeAvailable: boolean
  }
}

type UnlockRehearsalInput = {
  safety: {
    officialScoringEnabled: boolean
    officialGradeEnabled: boolean
    officialAiScoreExclusionEnabled: boolean
  }
}

type UnlockFastForwardInput = {
  ownerActionQueues: {
    developer: unknown[]
  }
}

type UnlockGoNoGoInput = {
  decision: {
    currentDecision: Evaluation2026DryRunUnlockDecision
  }
}

export type Evaluation2026DryRunUnlockAction = {
  id: string
  priority: Evaluation2026DryRunUnlockPriority
  category: string
  title: string
  condition: string
  currentCount: number | null
  currentStatus: Evaluation2026DryRunUnlockActionStatus
  requiredState: string
  owner: Evaluation2026DryRunUnlockOwner
  route: string
  nextAction: string
  evidenceRequired: string[]
  blocksReadyLater: boolean
  blocksReadyForReview: boolean
}

export type Evaluation2026DryRunUnlockCondition = {
  id: string
  label: string
  status: Evaluation2026DryRunUnlockActionStatus
  currentCount: number | null
  requiredState: string
  source: string
  nextAction: string
}

export type Evaluation2026DryRunUnlockPlan = {
  mode: 'READ_ONLY'
  status: 'AVAILABLE'
  generatedAt: string
  summary: {
    currentDecision: Evaluation2026DryRunUnlockDecision
    dryRunReviewStatus: Evaluation2026DryRunUnlockDecision
    applyStatus: 'NOT_ALLOWED'
    missingGoConditionsCount: number
    currentStage: string
    overallReadinessStatus: string
    nextUnlockMilestone: string
    nextCheckpoint: string
    p0ActionCount: number
    p1ActionCount: number
    p2ActionCount: number
    readyLaterStatus: Evaluation2026DryRunUnlockDecision
    readyForReviewStatus: Evaluation2026DryRunUnlockDecision
  }
  noGoReasonsGrouped: Array<{
    category: string
    reasons: Evaluation2026DryRunUnlockAction[]
  }>
  p0UnlockActions: Evaluation2026DryRunUnlockAction[]
  p1UnlockActions: Evaluation2026DryRunUnlockAction[]
  p2EvidenceActions: Evaluation2026DryRunUnlockAction[]
  readyLaterConditions: Evaluation2026DryRunUnlockCondition[]
  readyForReviewConditions: Evaluation2026DryRunUnlockCondition[]
  evidencePack: string[]
  hrActionPlan: string[]
  developerWatchActionPlan: string[]
  ownerActionTable: Evaluation2026DryRunUnlockAction[]
  checkpointPlan: {
    name: string
    requiredExport: string[]
    expectedBeforeAfterDeltaTable: string[]
    decisionOwner: string
    statusExpectedAfterCheckpoint: Evaluation2026DryRunUnlockDecision
  }
  prohibitedActions: string[]
  copyPayloads: {
    unlockSummary: string
    p0Actions: string
    p1Actions: string
    evidencePack: string
    ownerActionTable: string
    readyLaterConditions: string
    readyForReviewConditions: string
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
    metadataSaved: false
    noDryRunExecutionButtons: true
    noBackfillExecutionButtons: true
    noApplyButtons: true
    noScoreGradeWriteButtons: true
  }
}

const PROHIBITED_ACTIONS = [
  'dry-run execution from UI',
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

const EVIDENCE_PACK = [
  'integrated readiness snapshot export',
  'execution board export',
  'Fast-Forward cockpit export',
  'Go/No-Go Freeze Pack export',
  'Backfill Dry-run Preflight Pack export',
  'Command Runbook export',
  'DB backup proof',
  'HR approval note',
  'dry-run output archive location',
  'Vercel log watch plan',
]

const HR_ACTION_PLAN = [
  'clear MBO coverage',
  'clear confirmed PersonalKpi coverage shortage',
  'clear Team KPI pending',
  'clear policyCategory missing',
  'clear evaluator routing blockers',
  'collect HR approval for dry-run review only',
  'confirm DB backup owner',
]

const DEVELOPER_WATCH_ACTION_PLAN = [
  'verify main commit',
  'verify environment flags',
  'verify dry-run command reference',
  'prepare output archive',
  'prepare Vercel log watch',
  'do not run dry-run until HR approval',
  'do not run apply',
  'do not toggle feature flags',
]

function valueOrZero(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function valueOrNull(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function confirmedKpiShortage(params: {
  snapshot: UnlockSnapshotInput
  populationDryRun: UnlockPopulationDryRunInput | null
}) {
  if (typeof params.populationDryRun?.employeesMissingConfirmedPersonalKpiCount === 'number') {
    return params.populationDryRun.employeesMissingConfirmedPersonalKpiCount
  }
  const active = params.snapshot.summary.activeEmployeeCount
  const confirmed = params.snapshot.summary.confirmedPersonalKpiCount
  if (active == null || confirmed == null) return null
  return Math.max(active - confirmed, 0)
}

function statusFromCount(count: number | null | undefined): Evaluation2026DryRunUnlockActionStatus {
  return valueOrZero(count) > 0 ? 'BLOCKED' : 'READY'
}

function action(params: Omit<Evaluation2026DryRunUnlockAction, 'currentStatus'> & {
  currentStatus?: Evaluation2026DryRunUnlockActionStatus
}): Evaluation2026DryRunUnlockAction {
  return {
    ...params,
    currentStatus: params.currentStatus ?? statusFromCount(params.currentCount),
  }
}

function conditionFromAction(actionItem: Evaluation2026DryRunUnlockAction): Evaluation2026DryRunUnlockCondition {
  return {
    id: actionItem.id,
    label: actionItem.condition,
    status: actionItem.currentStatus,
    currentCount: actionItem.currentCount,
    requiredState: actionItem.requiredState,
    source: actionItem.route,
    nextAction: actionItem.nextAction,
  }
}

function buildP0Actions(params: {
  snapshot: UnlockSnapshotInput
  populationDryRun: UnlockPopulationDryRunInput | null
}) {
  const shortage = confirmedKpiShortage(params)
  return [
    action({
      id: 'OFFICIAL_GATE_BLOCKERS',
      priority: 'P0',
      category: 'gate',
      title: 'official activation gate blockers',
      condition: 'official activation gate blockers = 0',
      currentCount: valueOrNull(params.snapshot.summary.officialActivationGateBlockerCount),
      requiredState: '0 blockers',
      owner: 'HR',
      route: '/evaluation/performance',
      nextAction: 'Gate별 blocker와 runbook next action을 확인하고 HR blocker 해소 순서를 확정하세요.',
      evidenceRequired: ['official activation gate export', 'updated blocker delta table'],
      blocksReadyLater: true,
      blocksReadyForReview: true,
    }),
    action({
      id: 'MBO_MISSING',
      priority: 'P0',
      category: 'mbo',
      title: 'MBO missing',
      condition: 'MBO missing resolved or approved exclusions documented',
      currentCount: valueOrNull(params.snapshot.summary.missingMboCount),
      requiredState: '0 missing or approved exclusions',
      owner: 'HR',
      route: '/kpi/personal',
      nextAction: '미작성자와 초안 보유자에게 수동 안내 후 updated snapshot을 다시 확인하세요.',
      evidenceRequired: ['MBO missing list export', 'draft holder list export'],
      blocksReadyLater: true,
      blocksReadyForReview: true,
    }),
    action({
      id: 'CONFIRMED_KPI_COVERAGE',
      priority: 'P0',
      category: 'mbo',
      title: 'confirmed PersonalKpi coverage',
      condition: 'confirmed KPI coverage sufficient',
      currentCount: shortage,
      requiredState: 'coverage sufficient / shortage 0',
      owner: 'HR',
      route: '/kpi/personal',
      nextAction: 'confirmed PersonalKpi coverage shortage를 해소하거나 승인 제외를 문서화하세요.',
      evidenceRequired: ['confirmed KPI coverage export', 'approved exclusion note if any'],
      blocksReadyLater: true,
      blocksReadyForReview: true,
    }),
    action({
      id: 'EVALUATOR_ROUTING',
      priority: 'P0',
      category: 'routing',
      title: 'evaluator routing blockers',
      condition: 'evaluator blockers 0 or approved exceptions',
      currentCount: valueOrNull(params.snapshot.summary.evaluatorRoutingBlockerCount),
      requiredState: '0 blockers or approved exceptions',
      owner: 'HR',
      route: '/admin/performance-assignments',
      nextAction: 'FIRST/SECOND/FINAL 평가자 chain blocker를 정리하고 assignment sync는 HR 승인 후에만 검토하세요.',
      evidenceRequired: ['evaluator routing export', 'approved exception list if any'],
      blocksReadyLater: true,
      blocksReadyForReview: true,
    }),
    action({
      id: 'TEAM_KPI_PENDING',
      priority: 'P0',
      category: 'policy',
      title: 'Team KPI pending',
      condition: 'Team KPI pending 0',
      currentCount: valueOrNull(params.snapshot.summary.teamKpiPendingCount),
      requiredState: '0 pending/discussion',
      owner: 'HR',
      route: '/evaluation/performance',
      nextAction: '명확한 Team KPI만 readiness decision으로 정리하고 자동 저장은 하지 마세요.',
      evidenceRequired: ['Team KPI HR review export'],
      blocksReadyLater: true,
      blocksReadyForReview: true,
    }),
    action({
      id: 'POLICY_CATEGORY_MISSING',
      priority: 'P0',
      category: 'policy',
      title: 'policyCategory missing',
      condition: 'policyCategory missing 0',
      currentCount: valueOrNull(params.snapshot.summary.policyCategoryMissingCount),
      requiredState: '0 missing',
      owner: 'HR',
      route: '/evaluation/performance',
      nextAction: 'policyCategory 미분류 항목을 확인하고 HR 확정 가능한 경우에만 readiness metadata로 정리하세요.',
      evidenceRequired: ['policyCategory workbench export'],
      blocksReadyLater: true,
      blocksReadyForReview: true,
    }),
  ]
}

function buildP1Actions(snapshot: UnlockSnapshotInput) {
  const ai360Count = Math.max(valueOrZero(snapshot.summary.aiReadinessBlockerCount), valueOrZero(snapshot.summary.feedbackLeadershipBlockerCount))
  return [
    action({
      id: 'SCORE_POLICY_BLOCKERS',
      priority: 'P1',
      category: 'policy',
      title: 'score policy blockers',
      condition: 'score policy blockers 0',
      currentCount: valueOrNull(snapshot.summary.scorePolicyBlockerCount),
      requiredState: '0 blockers',
      owner: 'HR',
      route: '/evaluation/performance',
      nextAction: 'weight cap, source warning, AI exclusion policy를 검토하세요.',
      evidenceRequired: ['score policy readiness export'],
      blocksReadyLater: true,
      blocksReadyForReview: true,
    }),
    action({
      id: 'RESULT_WRITING_READINESS',
      priority: 'P1',
      category: 'result-writing',
      title: 'result-writing readiness',
      condition: 'result-writing readiness reviewed',
      currentCount: valueOrNull(snapshot.summary.resultWritingBlockerCount),
      requiredState: 'reviewed / blockers cleared or documented',
      owner: 'HR',
      route: '/kpi/monthly',
      nextAction: '공식 평가 시작 없이 result/evidence/contribution readiness 경고를 정리하세요.',
      evidenceRequired: ['result-writing readiness export'],
      blocksReadyLater: true,
      blocksReadyForReview: true,
    }),
    action({
      id: 'LEADER_EVALUATION_READINESS',
      priority: 'P1',
      category: 'leader-review',
      title: 'leader evaluation readiness',
      condition: 'leader evaluation readiness reviewed',
      currentCount: valueOrNull(snapshot.summary.leaderEvaluationBlockerCount),
      requiredState: 'reviewed / blockers cleared or documented',
      owner: 'LEADER',
      route: '/evaluation/performance',
      nextAction: 'SELF/result readiness와 evaluator chain 의존성을 확인하세요.',
      evidenceRequired: ['leader evaluation readiness export'],
      blocksReadyLater: true,
      blocksReadyForReview: true,
    }),
    action({
      id: 'FINALIZATION_CEO_READINESS',
      priority: 'P1',
      category: 'finalization',
      title: 'finalization/CEO readiness',
      condition: 'finalization/CEO readiness reviewed',
      currentCount: valueOrNull(snapshot.summary.finalizationCeoBlockerCount),
      requiredState: 'reviewed / blockers cleared or documented',
      owner: 'CEO_OFFICE',
      route: '/evaluation/performance',
      nextAction: 'score/grade 전 단계로 유지하면서 finalization dependency만 확인하세요.',
      evidenceRequired: ['finalization/CEO readiness export'],
      blocksReadyLater: true,
      blocksReadyForReview: true,
    }),
    action({
      id: 'AI_360_READINESS',
      priority: 'P1',
      category: 'ai-360',
      title: 'AI/360 readiness',
      condition: 'AI/360 readiness reviewed',
      currentCount: ai360Count,
      requiredState: 'reviewed / blockers cleared or documented',
      owner: 'HR',
      route: '/evaluation/360/admin',
      nextAction: 'AI Pass/Fail과 360/leadership readiness를 annual score와 분리해서 검토하세요.',
      evidenceRequired: ['AI Pass/Fail readiness export', '360/leadership readiness export'],
      blocksReadyLater: true,
      blocksReadyForReview: true,
    }),
  ]
}

function buildP2Actions(params: {
  preflight: UnlockPreflightInput
  outputTemplate: UnlockOutputTemplateInput
  commandRunbook: UnlockCommandRunbookInput
  rehearsal: UnlockRehearsalInput
  fastForward: UnlockFastForwardInput
}) {
  return [
    action({
      id: 'DB_BACKUP_EVIDENCE',
      priority: 'P2',
      category: 'evidence',
      title: 'DB backup evidence',
      condition: 'DB backup confirmed',
      currentCount: null,
      currentStatus: params.preflight.preflightSummary.dbBackupStatus === 'CONFIRMED_EXTERNALLY' ? 'READY' : 'READY_LATER',
      requiredState: 'backup owner/timestamp/restore contact confirmed',
      owner: 'DEVELOPER_WATCH',
      route: '/evaluation/performance',
      nextAction: 'DB backup proof와 rollback contact를 evidence pack에 첨부하세요.',
      evidenceRequired: ['DB backup proof', 'rollback contact'],
      blocksReadyLater: false,
      blocksReadyForReview: true,
    }),
    action({
      id: 'HR_APPROVAL_NOTE',
      priority: 'P2',
      category: 'evidence',
      title: 'HR approval note',
      condition: 'HR approval collected',
      currentCount: null,
      currentStatus: params.preflight.preflightSummary.hrApprovalStatus === 'COLLECTED_EXTERNALLY' ? 'READY' : 'READY_LATER',
      requiredState: 'dry-run review only approval collected',
      owner: 'HR',
      route: '/evaluation/performance',
      nextAction: 'apply 승인이 아닌 dry-run review only 승인 문구를 수집하세요.',
      evidenceRequired: ['HR approval note'],
      blocksReadyLater: false,
      blocksReadyForReview: true,
    }),
    action({
      id: 'COMMAND_RUNBOOK_REFERENCE',
      priority: 'P2',
      category: 'evidence',
      title: 'dry-run command runbook reference',
      condition: 'dry-run command runbook reviewed',
      currentCount: null,
      currentStatus: params.commandRunbook.status === 'AVAILABLE' && params.commandRunbook.dryRunOnlyCommandReference.executeAvailable === false ? 'READY' : 'READY_LATER',
      requiredState: 'text-only command reference reviewed',
      owner: 'DEVELOPER_WATCH',
      route: '/evaluation/performance',
      nextAction: 'command reference가 text-only이고 apply command가 노출되지 않는지 확인하세요.',
      evidenceRequired: ['Command Runbook export'],
      blocksReadyLater: false,
      blocksReadyForReview: true,
    }),
    action({
      id: 'OUTPUT_REVIEW_TEMPLATE',
      priority: 'P2',
      category: 'evidence',
      title: 'output review template reference',
      condition: 'dry-run output review template ready',
      currentCount: null,
      currentStatus: params.outputTemplate.templateStatus === 'AVAILABLE' ? 'READY' : 'READY_LATER',
      requiredState: 'template available and local-only',
      owner: 'HR',
      route: '/evaluation/performance',
      nextAction: 'dry-run output review template와 red flag criteria를 검토하세요.',
      evidenceRequired: ['Dry-run Output Review Template export'],
      blocksReadyLater: false,
      blocksReadyForReview: true,
    }),
    action({
      id: 'LOG_WATCH_PLAN',
      priority: 'P2',
      category: 'evidence',
      title: 'Vercel log watch plan',
      condition: 'Vercel log watch owner assigned',
      currentCount: null,
      currentStatus: params.fastForward.ownerActionQueues.developer.length > 0 ? 'READY_LATER' : 'OPEN',
      requiredState: 'watch owner and keywords assigned',
      owner: 'DEVELOPER_WATCH',
      route: '/evaluation/performance',
      nextAction: '500/P2021/P2022/schema/JWT/totalScore/gradeId/backfill/apply keyword watch owner를 지정하세요.',
      evidenceRequired: ['Vercel log watch plan'],
      blocksReadyLater: false,
      blocksReadyForReview: true,
    }),
    action({
      id: 'OFFICIAL_FLAGS_FALSE',
      priority: 'P2',
      category: 'evidence',
      title: 'official flags false confirmation',
      condition: 'official flags remain false',
      currentCount: null,
      currentStatus:
        params.rehearsal.safety.officialScoringEnabled === false &&
        params.rehearsal.safety.officialGradeEnabled === false &&
        params.rehearsal.safety.officialAiScoreExclusionEnabled === false
          ? 'READY'
          : 'BLOCKED',
      requiredState: 'official scoring/grade/AI exclusion flags false',
      owner: 'DEVELOPER_WATCH',
      route: '/evaluation/performance',
      nextAction: 'official scoring, official grade, AI exclusion activation은 계속 false로 유지하세요.',
      evidenceRequired: ['official flags false confirmation'],
      blocksReadyLater: false,
      blocksReadyForReview: true,
    }),
  ]
}

function buildDecision(params: {
  p0: Evaluation2026DryRunUnlockAction[]
  p1: Evaluation2026DryRunUnlockAction[]
  p2: Evaluation2026DryRunUnlockAction[]
}): Evaluation2026DryRunUnlockDecision {
  const dataBlockerExists = [...params.p0, ...params.p1].some((item) => item.currentStatus === 'BLOCKED' || item.currentStatus === 'OPEN')
  if (dataBlockerExists) return 'NO_GO'
  const evidenceMissing = params.p2.some((item) => item.currentStatus !== 'READY')
  if (evidenceMissing) return 'READY_LATER'
  return 'READY_FOR_REVIEW'
}

function groupReasons(actions: Evaluation2026DryRunUnlockAction[]) {
  const groups = new Map<string, Evaluation2026DryRunUnlockAction[]>()
  for (const item of actions.filter((actionItem) => actionItem.currentStatus !== 'READY')) {
    groups.set(item.category, [...(groups.get(item.category) ?? []), item])
  }
  return Array.from(groups.entries()).map(([category, reasons]) => ({ category, reasons }))
}

function firstOpenMilestone(actions: Evaluation2026DryRunUnlockAction[]) {
  return actions.find((item) => item.currentStatus !== 'READY')?.nextAction ?? 'Dry-run review evidence pack을 최종 확인하세요.'
}

function buildActionText(items: Evaluation2026DryRunUnlockAction[]) {
  return items.map((item) => [
    `- [${item.priority}] ${item.title}`,
    `  condition: ${item.condition}`,
    `  current: ${item.currentStatus}${item.currentCount == null ? '' : ` (${item.currentCount.toLocaleString()})`}`,
    `  required: ${item.requiredState}`,
    `  owner: ${item.owner}`,
    `  route: ${item.route}`,
    `  next: ${item.nextAction}`,
    `  evidence: ${item.evidenceRequired.join(', ')}`,
  ].join('\n')).join('\n')
}

function buildConditionText(items: Evaluation2026DryRunUnlockCondition[]) {
  return items.map((item) => [
    `- ${item.label}`,
    `  status: ${item.status}`,
    `  current: ${item.currentCount == null ? 'status-only' : item.currentCount.toLocaleString()}`,
    `  required: ${item.requiredState}`,
    `  source: ${item.source}`,
    `  next: ${item.nextAction}`,
  ].join('\n')).join('\n')
}

function buildEvidenceText(items: string[]) {
  return items.map((item) => `- ${item}`).join('\n')
}

function buildSummaryText(summary: Evaluation2026DryRunUnlockPlan['summary']) {
  return [
    `current decision: ${summary.currentDecision}`,
    `dry-run review status: ${summary.dryRunReviewStatus}`,
    `apply status: ${summary.applyStatus}`,
    `missing go conditions: ${summary.missingGoConditionsCount}`,
    `current stage: ${summary.currentStage}`,
    `overall readiness status: ${summary.overallReadinessStatus}`,
    `next unlock milestone: ${summary.nextUnlockMilestone}`,
    `next checkpoint: ${summary.nextCheckpoint}`,
    `P0/P1/P2 actions: ${summary.p0ActionCount}/${summary.p1ActionCount}/${summary.p2ActionCount}`,
  ].join('\n')
}

function buildMarkdown(params: {
  summary: Evaluation2026DryRunUnlockPlan['summary']
  p0: Evaluation2026DryRunUnlockAction[]
  p1: Evaluation2026DryRunUnlockAction[]
  p2: Evaluation2026DryRunUnlockAction[]
  readyLaterConditions: Evaluation2026DryRunUnlockCondition[]
  readyForReviewConditions: Evaluation2026DryRunUnlockCondition[]
  checkpointPlan: Evaluation2026DryRunUnlockPlan['checkpointPlan']
}) {
  return [
    '# 2026 Dry-run Unlock Plan',
    '',
    '## Unlock summary',
    buildSummaryText(params.summary),
    '',
    '## P0 unlock actions',
    buildActionText(params.p0),
    '',
    '## P1 unlock actions',
    buildActionText(params.p1),
    '',
    '## P2 / evidence actions',
    buildActionText(params.p2),
    '',
    '## READY_LATER conditions',
    buildConditionText(params.readyLaterConditions),
    '',
    '## READY_FOR_REVIEW conditions',
    buildConditionText(params.readyForReviewConditions),
    '',
    '## Evidence pack',
    buildEvidenceText(EVIDENCE_PACK),
    '',
    '## HR action plan',
    buildEvidenceText(HR_ACTION_PLAN),
    '',
    '## Developer / watch action plan',
    buildEvidenceText(DEVELOPER_WATCH_ACTION_PLAN),
    '',
    '## Next checkpoint',
    `- name: ${params.checkpointPlan.name}`,
    `- decision owner: ${params.checkpointPlan.decisionOwner}`,
    `- expected status after checkpoint: ${params.checkpointPlan.statusExpectedAfterCheckpoint}`,
    `- required export: ${params.checkpointPlan.requiredExport.join(', ')}`,
    `- delta table: ${params.checkpointPlan.expectedBeforeAfterDeltaTable.join(', ')}`,
    '',
    '## Prohibited actions',
    buildEvidenceText(PROHIBITED_ACTIONS),
    '',
    '## Safety note',
    '이 화면은 NO_GO 상태를 해제하기 위한 실행 순서를 읽기 전용으로 정리합니다. dry-run, apply, backfill, 공식 점수/등급, feature flag, Evaluation.totalScore, Evaluation.gradeId는 실행하지 않습니다.',
  ].join('\n')
}

function buildTsv(params: {
  actions: Evaluation2026DryRunUnlockAction[]
  conditions: Evaluation2026DryRunUnlockCondition[]
}) {
  return [
    ['section', 'priority', 'condition', 'current_status', 'current_count', 'required_state', 'owner', 'route', 'next_action'].join('\t'),
    ...params.actions.map((item) => [
      'owner_action',
      item.priority,
      item.condition,
      item.currentStatus,
      item.currentCount ?? '',
      item.requiredState,
      item.owner,
      item.route,
      item.nextAction,
    ].join('\t')),
    ...params.conditions.map((item) => [
      'condition',
      '',
      item.label,
      item.status,
      item.currentCount ?? '',
      item.requiredState,
      '',
      item.source,
      item.nextAction,
    ].join('\t')),
    ...PROHIBITED_ACTIONS.map((item) => ['prohibited', '', item, 'FORBIDDEN', '', 'do not execute', '', '', 'not allowed'].join('\t')),
  ].join('\n')
}

export function buildEvaluation2026DryRunUnlockPlan(params: {
  dryRunGoNoGoFreezePack: unknown
  integratedReadinessSnapshot: unknown
  fastForwardOperationsCockpit: unknown
  backfillDryRunPreflightPack: unknown
  backfillDryRunCommandRunbook: unknown
  dryRunOutputReviewTemplate: unknown
  dryRunRehearsalGuardrails: unknown
  populationDryRun: unknown
}): Evaluation2026DryRunUnlockPlan {
  const dryRunGoNoGoFreezePack = params.dryRunGoNoGoFreezePack as UnlockGoNoGoInput
  const integratedReadinessSnapshot = params.integratedReadinessSnapshot as UnlockSnapshotInput
  const fastForwardOperationsCockpit = params.fastForwardOperationsCockpit as UnlockFastForwardInput
  const backfillDryRunPreflightPack = params.backfillDryRunPreflightPack as UnlockPreflightInput
  const backfillDryRunCommandRunbook = params.backfillDryRunCommandRunbook as UnlockCommandRunbookInput
  const dryRunOutputReviewTemplate = params.dryRunOutputReviewTemplate as UnlockOutputTemplateInput
  const dryRunRehearsalGuardrails = params.dryRunRehearsalGuardrails as UnlockRehearsalInput
  const populationDryRun = params.populationDryRun as UnlockPopulationDryRunInput | null
  const p0UnlockActions = buildP0Actions({
    snapshot: integratedReadinessSnapshot,
    populationDryRun,
  })
  const p1UnlockActions = buildP1Actions(integratedReadinessSnapshot)
  const p2EvidenceActions = buildP2Actions({
    preflight: backfillDryRunPreflightPack,
    outputTemplate: dryRunOutputReviewTemplate,
    commandRunbook: backfillDryRunCommandRunbook,
    rehearsal: dryRunRehearsalGuardrails,
    fastForward: fastForwardOperationsCockpit,
  })
  const computedDecision = buildDecision({
    p0: p0UnlockActions,
    p1: p1UnlockActions,
    p2: p2EvidenceActions,
  })
  const currentDecision = dryRunGoNoGoFreezePack.decision.currentDecision === 'NO_GO'
    ? 'NO_GO'
    : computedDecision
  const ownerActionTable = [...p0UnlockActions, ...p1UnlockActions, ...p2EvidenceActions]
  const readyLaterConditions = [
    ...p0UnlockActions.map(conditionFromAction),
    ...p1UnlockActions.map(conditionFromAction),
    {
      id: 'GRADE_POLICY_BLOCKERS',
      label: 'grade policy blockers 0',
    status: statusFromCount(integratedReadinessSnapshot.summary.gradePolicyBlockerCount),
    currentCount: valueOrNull(integratedReadinessSnapshot.summary.gradePolicyBlockerCount),
      requiredState: '0 blockers',
      source: '/evaluation/performance',
      nextAction: 'grade policy blockers가 있으면 먼저 해소하고, 0건이면 evidence pack에 ready 상태를 포함하세요.',
    },
  ]
  const readyForReviewConditions = [
    ...readyLaterConditions,
    ...p2EvidenceActions.map(conditionFromAction),
  ]
  const notReadyConditions = readyForReviewConditions.filter((item) => item.status !== 'READY')
  const checkpointPlan: Evaluation2026DryRunUnlockPlan['checkpointPlan'] = {
    name: 'Dry-run Unlock Checkpoint',
    requiredExport: [
      'Go/No-Go Freeze Pack Markdown',
      'Dry-run Unlock Plan Markdown',
      'updated integrated readiness snapshot',
      'Readiness Execution Board export',
    ],
    expectedBeforeAfterDeltaTable: [
      'official gate blockers',
      'MBO missing',
      'confirmed KPI shortage',
      'Team KPI pending',
      'policyCategory missing',
      'evaluator blockers',
      'score policy blockers',
      'result-writing warnings',
      'leader evaluation blockers',
      'finalization/CEO blockers',
      'AI/360 readiness blockers',
    ],
    decisionOwner: 'HR admin + developer watch owner',
    statusExpectedAfterCheckpoint: currentDecision === 'NO_GO' ? 'READY_LATER' : 'READY_FOR_REVIEW',
  }
  const summary: Evaluation2026DryRunUnlockPlan['summary'] = {
    currentDecision,
    dryRunReviewStatus: currentDecision,
    applyStatus: 'NOT_ALLOWED',
    missingGoConditionsCount: notReadyConditions.length,
    currentStage: integratedReadinessSnapshot.currentStage,
    overallReadinessStatus: integratedReadinessSnapshot.overallStatus,
    nextUnlockMilestone: firstOpenMilestone(ownerActionTable),
    nextCheckpoint: checkpointPlan.name,
    p0ActionCount: p0UnlockActions.length,
    p1ActionCount: p1UnlockActions.length,
    p2ActionCount: p2EvidenceActions.length,
    readyLaterStatus: readyLaterConditions.some((item) => item.status !== 'READY') ? 'NO_GO' : 'READY_LATER',
    readyForReviewStatus: readyForReviewConditions.some((item) => item.status !== 'READY') ? 'READY_LATER' : 'READY_FOR_REVIEW',
  }
  const markdown = buildMarkdown({
    summary,
    p0: p0UnlockActions,
    p1: p1UnlockActions,
    p2: p2EvidenceActions,
    readyLaterConditions,
    readyForReviewConditions,
    checkpointPlan,
  })
  const tsv = buildTsv({
    actions: ownerActionTable,
    conditions: readyForReviewConditions,
  })

  return {
    mode: 'READ_ONLY',
    status: 'AVAILABLE',
    generatedAt: new Date().toISOString(),
    summary,
    noGoReasonsGrouped: groupReasons([...p0UnlockActions, ...p1UnlockActions]),
    p0UnlockActions,
    p1UnlockActions,
    p2EvidenceActions,
    readyLaterConditions,
    readyForReviewConditions,
    evidencePack: EVIDENCE_PACK,
    hrActionPlan: HR_ACTION_PLAN,
    developerWatchActionPlan: DEVELOPER_WATCH_ACTION_PLAN,
    ownerActionTable,
    checkpointPlan,
    prohibitedActions: PROHIBITED_ACTIONS,
    copyPayloads: {
      unlockSummary: buildSummaryText(summary),
      p0Actions: buildActionText(p0UnlockActions),
      p1Actions: buildActionText(p1UnlockActions),
      evidencePack: buildEvidenceText(EVIDENCE_PACK),
      ownerActionTable: buildActionText(ownerActionTable),
      readyLaterConditions: buildConditionText(readyLaterConditions),
      readyForReviewConditions: buildConditionText(readyForReviewConditions),
      prohibitedActions: buildEvidenceText(PROHIBITED_ACTIONS),
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
      metadataSaved: false,
      noDryRunExecutionButtons: true,
      noBackfillExecutionButtons: true,
      noApplyButtons: true,
      noScoreGradeWriteButtons: true,
    },
  }
}
