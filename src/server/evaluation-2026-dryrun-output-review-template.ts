import type { Evaluation2026BackfillDryRunPreflightPack } from '@/server/evaluation-2026-backfill-dryrun-preflight'
import type { Evaluation2026IntegratedReadinessSnapshot } from '@/server/evaluation-2026-integrated-readiness-snapshot'
import type { Evaluation2026OfficialActivationRunbook } from '@/server/evaluation-2026-activation-readiness'

export type Evaluation2026DryRunOutputReviewField = {
  id: string
  label: string
  expectedReview: string
  requiredValue: string
}

export type Evaluation2026DryRunOutputReviewCriterion = {
  id: string
  label: string
  severity: 'MUST_PASS' | 'RED_FLAG'
  reviewAction: string
}

export type Evaluation2026DryRunOutputReviewDecisionOutcome =
  | 'ACCEPT_FOR_REVIEW'
  | 'NEEDS_HR_FIX'
  | 'NEEDS_DEVELOPER_FIX'
  | 'REJECT_DRY_RUN_OUTPUT'
  | 'READY_FOR_BACKUP_CONFIRMATION'
  | 'NOT_READY_FOR_APPLY'

export type Evaluation2026DryRunOutputReviewTemplate = {
  mode: 'READ_ONLY'
  templateStatus: 'AVAILABLE'
  generatedAt: string
  templateSummary: {
    currentStage: Evaluation2026IntegratedReadinessSnapshot['currentStage']
    overallReadinessStatus: Evaluation2026IntegratedReadinessSnapshot['overallStatus']
    officialActivationStatus: 'BLOCKED' | 'READY_FOR_REVIEW' | 'READY_LATER'
    preflightStatus: Evaluation2026BackfillDryRunPreflightPack['preflightSummary']['backfillDryRunReviewStatus']
    applyStatus: Evaluation2026BackfillDryRunPreflightPack['preflightSummary']['backfillApplyStatus']
    localOnlyPasteHelperStatus: 'LOCAL_ONLY'
    nextReviewAction: string
  }
  reviewTemplateSections: Array<{
    id: string
    title: string
    description: string
  }>
  dryRunIdentityFields: Evaluation2026DryRunOutputReviewField[]
  expectedOutputFields: Evaluation2026DryRunOutputReviewField[]
  mustPassCriteria: Evaluation2026DryRunOutputReviewCriterion[]
  redFlagConditions: Evaluation2026DryRunOutputReviewCriterion[]
  hrReviewChecklist: string[]
  developerReviewChecklist: string[]
  postDryRunLogWatchChecklist: string[]
  decisionOutcomes: Array<{
    code: Evaluation2026DryRunOutputReviewDecisionOutcome
    label: string
    meaning: string
    nextAction: string
  }>
  nextActionMapping: Array<{
    condition: string
    route: string
    nextAction: string
  }>
  localOnlyPasteHelper: {
    enabled: true
    serverSubmitAvailable: false
    saveAvailable: false
    uploadAvailable: false
    apiCallAvailable: false
    persistenceAvailable: false
    guidance: string
    invalidJsonMessage: string
    knownFields: string[]
  }
  prohibitedActions: string[]
  copyPayloads: {
    reviewTemplate: string
    mustPassCriteria: string
    redFlags: string
    hrReviewChecklist: string
    developerReviewChecklist: string
    decisionOutcomeGuide: string
    nextActionMapping: string
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
    noDryRunExecutionButtons: true
    noBackfillExecutionButtons: true
    noApplyButtons: true
    noScoreGradeWriteButtons: true
    noServerSubmit: true
    noUpload: true
    noPersistence: true
  }
}

const REVIEW_TEMPLATE_SECTIONS = [
  {
    id: 'DRY_RUN_IDENTITY',
    title: 'A. Dry-run identity',
    description: 'dry-run timestamp, branch/commit, environment, target cycle, operator, reviewer를 기록합니다.',
  },
  {
    id: 'EXPECTED_OUTPUT_FIELDS',
    title: 'B. Expected output fields',
    description: 'dry-run 결과에 반드시 포함되어야 하는 population, blocker, write-safety 필드를 확인합니다.',
  },
  {
    id: 'MUST_PASS_CRITERIA',
    title: 'C. Must-pass criteria',
    description: 'apply 논의 전 반드시 통과해야 하는 read-only safety 기준입니다.',
  },
  {
    id: 'RED_FLAGS',
    title: 'D. Red flags',
    description: '즉시 중단하고 조사해야 하는 dry-run output / log 위험 신호입니다.',
  },
  {
    id: 'HR_REVIEW_CHECKLIST',
    title: 'E. HR review checklist',
    description: 'HR이 target cycle, population, readiness scope를 확인하는 체크리스트입니다.',
  },
  {
    id: 'DEVELOPER_REVIEW_CHECKLIST',
    title: 'F. Developer review checklist',
    description: '개발자가 branch, env, backup, output archive, log watch를 확인하는 체크리스트입니다.',
  },
  {
    id: 'DECISION_OUTCOMES',
    title: 'G. Decision outcomes',
    description: 'dry-run output 검토 결과를 표준 상태로 분류합니다.',
  },
  {
    id: 'NEXT_ACTION_MAPPING',
    title: 'H. Next action mapping',
    description: '결과 조건별로 HR/개발이 이동해야 할 다음 route와 조치를 연결합니다.',
  },
]

const DRY_RUN_IDENTITY_FIELDS: Evaluation2026DryRunOutputReviewField[] = [
  { id: 'DRY_RUN_TIMESTAMP', label: 'dry-run timestamp', expectedReview: 'dry-run 결과 생성 시각을 기록', requiredValue: '화면 값 확인 필요' },
  { id: 'BRANCH_COMMIT', label: 'branch/commit', expectedReview: 'production branch와 commit 일치 여부 확인', requiredValue: 'main / approved commit' },
  { id: 'ENVIRONMENT', label: 'environment', expectedReview: 'production/staging/local 등 실행 환경 구분', requiredValue: 'HR 승인 환경' },
  { id: 'TARGET_CYCLE', label: 'target cycle', expectedReview: 'HR 승인 cycle과 dry-run 대상 cycle 일치 확인', requiredValue: 'HR-approved cycle' },
  { id: 'TARGET_ORG', label: 'target org', expectedReview: '대상 조직 범위 확인', requiredValue: 'HR-approved org scope' },
  { id: 'RUN_MODE', label: 'run mode', expectedReview: 'dry-run 모드인지 확인', requiredValue: 'dry-run only' },
  { id: 'OPERATOR', label: 'operator', expectedReview: 'dry-run 실행자 기록', requiredValue: 'named developer/operator' },
  { id: 'REVIEWER', label: 'reviewer', expectedReview: 'HR/개발 검토자 기록', requiredValue: 'named HR/developer reviewer' },
]

const EXPECTED_OUTPUT_FIELDS: Evaluation2026DryRunOutputReviewField[] = [
  { id: 'TARGET_POPULATION_COUNT', label: 'target population count', expectedReview: 'readiness snapshot의 active employee / 대상 population과 대조', requiredValue: 'HR scope와 일치' },
  { id: 'EVALUATION_CREATE_UPDATE_COUNT', label: 'expected Evaluation create/update count', expectedReview: 'dry-run mode에서 실제 쓰기 없이 예상 범위만 확인', requiredValue: 'writesPerformed false' },
  { id: 'EVALUATION_ITEM_CREATE_UPDATE_COUNT', label: 'expected EvaluationItem create/update count', expectedReview: 'dry-run mode에서 실제 쓰기 없이 예상 범위만 확인', requiredValue: 'writesPerformed false' },
  { id: 'POLICY_CATEGORY_MISSING_COUNT', label: 'policyCategory missing count', expectedReview: 'policyCategory 미분류가 apply 논의 전 0건인지 확인', requiredValue: '0 before apply discussion' },
  { id: 'EVALUATOR_ASSIGNMENT_MISSING_COUNT', label: 'evaluator assignment missing count', expectedReview: '평가자 배정 누락이 0건 또는 승인 예외인지 확인', requiredValue: '0 or approved exceptions' },
  { id: 'MBO_MISSING_COUNT', label: 'MBO missing count', expectedReview: 'MBO coverage blocker가 남아 있는지 확인', requiredValue: '0 or approved exclusions' },
  { id: 'TEAM_KPI_PENDING_COUNT', label: 'Team KPI pending count', expectedReview: 'Team KPI pending/discussion 잔여 여부 확인', requiredValue: '0 before apply discussion' },
  { id: 'SCORE_POLICY_BLOCKER_COUNT', label: 'score policy blocker count', expectedReview: 'score policy blocker가 0건인지 확인', requiredValue: '0 before scoring discussion' },
  { id: 'GRADE_POLICY_BLOCKER_COUNT', label: 'grade policy blocker count', expectedReview: 'grade policy blocker가 0건인지 확인', requiredValue: '0 before grade discussion' },
  { id: 'AI_EXCLUSION_STATUS', label: 'AI exclusion status', expectedReview: 'AI Pass/Fail 분리 정책과 activation 상태 확인', requiredValue: 'not activated unless separately approved later' },
  { id: 'TOTAL_SCORE_CHANGES_EXPECTED', label: 'totalScore changes expected', expectedReview: 'dry-run output에서 Evaluation.totalScore 변경 예상이 없는지 확인', requiredValue: '0/false' },
  { id: 'GRADE_ID_CHANGES_EXPECTED', label: 'gradeId changes expected', expectedReview: 'dry-run output에서 Evaluation.gradeId 변경 예상이 없는지 확인', requiredValue: '0/false' },
  { id: 'WRITES_PERFORMED', label: 'writesPerformed', expectedReview: 'dry-run 결과가 실제 DB write를 하지 않았는지 확인', requiredValue: 'false' },
  { id: 'ERRORS_WARNINGS_SKIPS', label: 'errors / warnings / skipped records', expectedReview: 'schema/auth/runtime error와 skipped sample을 검토', requiredValue: 'no critical error' },
  { id: 'SAMPLE_EMPLOYEE_CHECKS', label: 'sample employee checks', expectedReview: '대표 샘플 직원의 expected vs actual output 비교', requiredValue: 'HR/developer reviewed' },
]

const MUST_PASS_CRITERIA: Evaluation2026DryRunOutputReviewCriterion[] = [
  { id: 'WRITES_PERFORMED_FALSE', label: 'writesPerformed must be false', severity: 'MUST_PASS', reviewAction: 'true이면 즉시 중단하고 dry-run 실행 경로를 조사합니다.' },
  { id: 'TOTAL_SCORE_UNCHANGED', label: 'Evaluation.totalScore changes must be 0/false', severity: 'MUST_PASS', reviewAction: 'totalScore 변경이 보이면 stop and investigate 처리합니다.' },
  { id: 'GRADE_ID_UNCHANGED', label: 'Evaluation.gradeId changes must be 0/false', severity: 'MUST_PASS', reviewAction: 'gradeId 변경이 보이면 stop and investigate 처리합니다.' },
  { id: 'OFFICIAL_SCORING_FALSE', label: 'official scoring flag must remain false', severity: 'MUST_PASS', reviewAction: 'feature flag 상태를 read-only로 확인하고 변경하지 않습니다.' },
  { id: 'OFFICIAL_GRADE_FALSE', label: 'official grade flag must remain false', severity: 'MUST_PASS', reviewAction: 'grade activation은 별도 승인 전까지 금지입니다.' },
  { id: 'AI_EXCLUSION_FALSE', label: 'AI exclusion activation flag must remain false unless separately approved later', severity: 'MUST_PASS', reviewAction: 'AI Pass/Fail 분리 정책만 검토하고 activation은 하지 않습니다.' },
  { id: 'TARGET_CYCLE_MATCHES', label: 'target cycle must match HR-approved cycle', severity: 'MUST_PASS', reviewAction: '대상 cycle 불일치 시 dry-run output을 reject합니다.' },
  { id: 'TARGET_POPULATION_MATCHES', label: 'target population must match HR scope', severity: 'MUST_PASS', reviewAction: '대상 population 불일치 시 HR scope를 재확인합니다.' },
  { id: 'POLICY_CATEGORY_ZERO', label: 'missing policyCategory must be 0 before apply discussion', severity: 'MUST_PASS', reviewAction: 'policyCategory workbench에서 HR 확인이 필요합니다.' },
  { id: 'EVALUATOR_READY_OR_EXCEPTION', label: 'evaluator blockers must be 0 or explicitly approved exceptions', severity: 'MUST_PASS', reviewAction: 'performance assignments에서 blocker 또는 승인 예외를 확인합니다.' },
  { id: 'NO_SCHEMA_ERRORS', label: 'no schema errors', severity: 'MUST_PASS', reviewAction: 'P2021/P2022, column/relation missing 로그가 있으면 reject합니다.' },
  { id: 'NO_UNEXPECTED_CREATION', label: 'no unexpected Evaluation/EvaluationItem creation in dry-run mode', severity: 'MUST_PASS', reviewAction: 'dry-run mode에서 실제 생성이 보이면 즉시 중단합니다.' },
]

const RED_FLAG_CONDITIONS: Evaluation2026DryRunOutputReviewCriterion[] = [
  { id: 'WRITES_PERFORMED_TRUE', label: 'writesPerformed true', severity: 'RED_FLAG', reviewAction: 'dry-run output reject 및 execution path 조사' },
  { id: 'TOTAL_SCORE_CHANGED', label: 'Evaluation.totalScore changed', severity: 'RED_FLAG', reviewAction: 'score write 차단 상태 확인' },
  { id: 'GRADE_ID_CHANGED', label: 'Evaluation.gradeId changed', severity: 'RED_FLAG', reviewAction: 'grade write 차단 상태 확인' },
  { id: 'OFFICIAL_SCORING_ENABLED', label: 'official scoring enabled', severity: 'RED_FLAG', reviewAction: 'feature flag 변경 여부 조사' },
  { id: 'OFFICIAL_GRADE_ENABLED', label: 'official grade enabled', severity: 'RED_FLAG', reviewAction: 'grade activation 경로 조사' },
  { id: 'FEATURE_FLAG_CHANGED', label: 'feature flag changed', severity: 'RED_FLAG', reviewAction: 'production feature flag mutation 여부 확인' },
  { id: 'UNEXPECTED_EVALUATION_WRITE', label: 'unexpected Evaluation/EvaluationItem creation', severity: 'RED_FLAG', reviewAction: 'dry-run mode 보장 실패로 reject' },
  { id: 'TARGET_POPULATION_MISMATCH', label: 'target population mismatch', severity: 'RED_FLAG', reviewAction: 'HR scope 재승인 전까지 보류' },
  { id: 'POLICY_CATEGORY_MISSING_REMAINS', label: 'policyCategory missing > 0', severity: 'RED_FLAG', reviewAction: '/evaluation/performance policyCategory workbench 확인' },
  { id: 'EVALUATOR_MISSING_REMAINS', label: 'evaluator missing > 0 without approved exception', severity: 'RED_FLAG', reviewAction: '/admin/performance-assignments 확인' },
  { id: 'PRISMA_SCHEMA_ERROR', label: 'Prisma/schema error', severity: 'RED_FLAG', reviewAction: 'P2021 / P2022 / column does not exist / relation does not exist 로그 조사' },
  { id: 'P2021_P2022', label: 'P2021 / P2022', severity: 'RED_FLAG', reviewAction: 'schema/runtime compatibility hotfix 필요 여부 판단' },
  { id: 'COLUMN_RELATION_MISSING', label: 'column/relation missing', severity: 'RED_FLAG', reviewAction: 'migration 실행 금지, schema design만 보고' },
  { id: 'JWT_SESSION_ERROR', label: 'JWT_SESSION_ERROR', severity: 'RED_FLAG', reviewAction: 'auth/session runtime 상태 확인' },
  { id: 'MISSING_KEY_FIELDS', label: 'dry-run output missing key fields', severity: 'RED_FLAG', reviewAction: 'review template 기준으로 수동 보완 요청' },
]

const HR_REVIEW_CHECKLIST = [
  'HR confirms target cycle',
  'HR confirms target population',
  'HR confirms MBO readiness',
  'HR confirms policyCategory readiness',
  'HR confirms evaluator readiness',
  'HR confirms score/grade policy readiness',
  'HR confirms AI Pass/Fail separate policy',
  'HR confirms this is dry-run review only',
  'HR does not approve apply yet',
]

const DEVELOPER_REVIEW_CHECKLIST = [
  'verify production branch/commit',
  'verify env and flags',
  'verify DB backup plan',
  'verify dry-run mode',
  'archive dry-run output',
  'compare output with expected checklist',
  'watch logs after dry-run',
  'do not run apply',
  'do not toggle feature flags',
]

const POST_DRY_RUN_LOG_WATCH_CHECKLIST = [
  '500',
  'P2021',
  'P2022',
  'PrismaClientKnownRequestError',
  'column does not exist',
  'relation does not exist',
  'JWT_SESSION_ERROR',
  'Evaluation.totalScore',
  'Evaluation.gradeId',
  'backfill --apply',
  'official scoring',
  'official grade',
  'AI score exclusion',
  'feature flag changes',
  'Evaluation/EvaluationItem creation',
]

const DECISION_OUTCOMES: Evaluation2026DryRunOutputReviewTemplate['decisionOutcomes'] = [
  { code: 'ACCEPT_FOR_REVIEW', label: 'ACCEPT_FOR_REVIEW', meaning: '템플릿 필드가 충분해 HR/개발 검토 대상으로 접수', nextAction: 'must-pass criteria와 red flag 조건을 대조합니다.' },
  { code: 'NEEDS_HR_FIX', label: 'NEEDS_HR_FIX', meaning: 'MBO, policyCategory, evaluator, HR scope 쪽 보완 필요', nextAction: 'HR owner action으로 되돌립니다.' },
  { code: 'NEEDS_DEVELOPER_FIX', label: 'NEEDS_DEVELOPER_FIX', meaning: '출력 스키마, 로그, 실행 모드, archive 쪽 보완 필요', nextAction: '개발/운영 owner가 dry-run output format을 보완합니다.' },
  { code: 'REJECT_DRY_RUN_OUTPUT', label: 'REJECT_DRY_RUN_OUTPUT', meaning: 'write, schema/auth/runtime red flag가 있어 결과를 폐기', nextAction: '원인 조사 전까지 다음 단계로 진행하지 않습니다.' },
  { code: 'READY_FOR_BACKUP_CONFIRMATION', label: 'READY_FOR_BACKUP_CONFIRMATION', meaning: '검토 기준은 통과했으나 apply가 아니라 backup/HR 승인 논의 단계', nextAction: 'DB backup plan과 HR dry-run review evidence를 확인합니다.' },
  { code: 'NOT_READY_FOR_APPLY', label: 'NOT_READY_FOR_APPLY', meaning: 'dry-run 검토가 끝나도 apply는 별도 승인 전까지 불가', nextAction: 'apply command execution 금지를 유지합니다.' },
]

const NEXT_ACTION_MAPPING = [
  { condition: 'If policyCategory missing > 0', route: '/evaluation/performance', nextAction: 'go to policyCategory workbench' },
  { condition: 'If evaluator blockers > 0', route: '/admin/performance-assignments', nextAction: 'go to performance assignments' },
  { condition: 'If MBO missing > 0', route: '/kpi/personal', nextAction: 'go to MBO readiness' },
  { condition: 'If score policy blockers > 0', route: '/evaluation/performance', nextAction: 'go to score policy readiness' },
  { condition: 'If grade blockers > 0', route: '/evaluation/performance', nextAction: 'go to grade policy readiness' },
  { condition: 'If dry-run writesPerformed true', route: '/evaluation/performance', nextAction: 'stop and investigate' },
  { condition: 'If totalScore/gradeId changed', route: '/evaluation/performance', nextAction: 'stop and investigate' },
  { condition: 'If all must-pass criteria pass', route: '/evaluation/performance', nextAction: 'proceed to backup/HR approval discussion only' },
]

const KNOWN_PASTE_FIELDS = [
  'dryRunTimestamp',
  'timestamp',
  'generatedAt',
  'branch',
  'commit',
  'environment',
  'targetCycle',
  'targetOrg',
  'runMode',
  'operator',
  'reviewer',
  'targetPopulationCount',
  'expectedEvaluationCreateCount',
  'expectedEvaluationUpdateCount',
  'expectedEvaluationItemCreateCount',
  'expectedEvaluationItemUpdateCount',
  'policyCategoryMissingCount',
  'evaluatorAssignmentMissingCount',
  'mboMissingCount',
  'teamKpiPendingCount',
  'scorePolicyBlockerCount',
  'gradePolicyBlockerCount',
  'aiExclusionStatus',
  'totalScoreChangesExpected',
  'gradeIdChangesExpected',
  'writesPerformed',
  'errors',
  'warnings',
  'skippedRecords',
  'sampleEmployeeChecks',
  'officialScoringEnabled',
  'officialGradeEnabled',
  'featureFlagsChanged',
]

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

function buildTextList(items: string[]) {
  return items.map((item) => `- ${item}`).join('\n')
}

function buildFieldText(items: Evaluation2026DryRunOutputReviewField[]) {
  return items.map((item) => `- ${item.label}: ${item.expectedReview} · required=${item.requiredValue}`).join('\n')
}

function buildCriteriaText(items: Evaluation2026DryRunOutputReviewCriterion[]) {
  return items.map((item) => `- [${item.severity}] ${item.label}: ${item.reviewAction}`).join('\n')
}

function buildDecisionText(items: Evaluation2026DryRunOutputReviewTemplate['decisionOutcomes']) {
  return items.map((item) => `- ${item.label}: ${item.meaning} · next=${item.nextAction}`).join('\n')
}

function buildNextActionText(items: Evaluation2026DryRunOutputReviewTemplate['nextActionMapping']) {
  return items.map((item) => `- ${item.condition} -> ${item.route}: ${item.nextAction}`).join('\n')
}

function buildReviewTemplateText(params: {
  templateSummary: Evaluation2026DryRunOutputReviewTemplate['templateSummary']
  dryRunIdentityFields: Evaluation2026DryRunOutputReviewField[]
  expectedOutputFields: Evaluation2026DryRunOutputReviewField[]
  mustPassCriteria: Evaluation2026DryRunOutputReviewCriterion[]
  redFlagConditions: Evaluation2026DryRunOutputReviewCriterion[]
}) {
  return [
    '2026 Dry-run Output Review Template',
    `current stage: ${params.templateSummary.currentStage}`,
    `overall readiness status: ${params.templateSummary.overallReadinessStatus}`,
    `official activation status: ${params.templateSummary.officialActivationStatus}`,
    `preflight status: ${params.templateSummary.preflightStatus}`,
    `apply status: ${params.templateSummary.applyStatus}`,
    '',
    'Dry-run identity',
    buildFieldText(params.dryRunIdentityFields),
    '',
    'Expected output fields',
    buildFieldText(params.expectedOutputFields),
    '',
    'Must-pass criteria',
    buildCriteriaText(params.mustPassCriteria),
    '',
    'Red flags',
    buildCriteriaText(params.redFlagConditions),
  ].join('\n')
}

function buildMarkdown(params: {
  templateSummary: Evaluation2026DryRunOutputReviewTemplate['templateSummary']
  dryRunIdentityFields: Evaluation2026DryRunOutputReviewField[]
  expectedOutputFields: Evaluation2026DryRunOutputReviewField[]
  mustPassCriteria: Evaluation2026DryRunOutputReviewCriterion[]
  redFlagConditions: Evaluation2026DryRunOutputReviewCriterion[]
  prohibitedActions: string[]
}) {
  return [
    '# 2026 Dry-run Output Review Template',
    '',
    '## Summary',
    `- current stage: ${params.templateSummary.currentStage}`,
    `- overall readiness status: ${params.templateSummary.overallReadinessStatus}`,
    `- official activation status: ${params.templateSummary.officialActivationStatus}`,
    `- preflight status: ${params.templateSummary.preflightStatus}`,
    `- apply status: ${params.templateSummary.applyStatus}`,
    `- local-only paste helper: ${params.templateSummary.localOnlyPasteHelperStatus}`,
    `- next review action: ${params.templateSummary.nextReviewAction}`,
    '',
    '## Dry-run identity',
    buildFieldText(params.dryRunIdentityFields),
    '',
    '## Expected output fields',
    buildFieldText(params.expectedOutputFields),
    '',
    '## Must-pass criteria',
    buildCriteriaText(params.mustPassCriteria),
    '',
    '## Red flags',
    buildCriteriaText(params.redFlagConditions),
    '',
    '## HR review checklist',
    buildTextList(HR_REVIEW_CHECKLIST),
    '',
    '## Developer review checklist',
    buildTextList(DEVELOPER_REVIEW_CHECKLIST),
    '',
    '## Post-dry-run log watch checklist',
    buildTextList(POST_DRY_RUN_LOG_WATCH_CHECKLIST),
    '',
    '## Decision outcomes',
    buildDecisionText(DECISION_OUTCOMES),
    '',
    '## Next action mapping',
    buildNextActionText(NEXT_ACTION_MAPPING),
    '',
    '## Prohibited actions',
    buildTextList(params.prohibitedActions),
  ].join('\n')
}

function buildTsv(params: {
  dryRunIdentityFields: Evaluation2026DryRunOutputReviewField[]
  expectedOutputFields: Evaluation2026DryRunOutputReviewField[]
  mustPassCriteria: Evaluation2026DryRunOutputReviewCriterion[]
  redFlagConditions: Evaluation2026DryRunOutputReviewCriterion[]
}) {
  return [
    ['section', 'id', 'label', 'required_or_severity', 'review_action'].join('\t'),
    ...params.dryRunIdentityFields.map((item) =>
      ['dry_run_identity', item.id, item.label, item.requiredValue, item.expectedReview].join('\t')
    ),
    ...params.expectedOutputFields.map((item) =>
      ['expected_output', item.id, item.label, item.requiredValue, item.expectedReview].join('\t')
    ),
    ...params.mustPassCriteria.map((item) =>
      ['must_pass', item.id, item.label, item.severity, item.reviewAction].join('\t')
    ),
    ...params.redFlagConditions.map((item) =>
      ['red_flag', item.id, item.label, item.severity, item.reviewAction].join('\t')
    ),
    ...DECISION_OUTCOMES.map((item) =>
      ['decision_outcome', item.code, item.label, 'review status', `${item.meaning} · ${item.nextAction}`].join('\t')
    ),
    ...NEXT_ACTION_MAPPING.map((item) =>
      ['next_action', item.condition, item.route, 'route', item.nextAction].join('\t')
    ),
  ].join('\n')
}

function officialActivationStatus(params: {
  snapshot: Evaluation2026IntegratedReadinessSnapshot
  preflight: Evaluation2026BackfillDryRunPreflightPack
  runbook: Evaluation2026OfficialActivationRunbook
}): Evaluation2026DryRunOutputReviewTemplate['templateSummary']['officialActivationStatus'] {
  if (
    params.preflight.preflightSummary.officialActivationStatus === 'BLOCKED' ||
    (params.snapshot.summary.officialActivationGateBlockerCount ?? 0) > 0
  ) {
    return 'BLOCKED'
  }
  if (params.runbook.summary.readyForReviewSectionCount > 0) return 'READY_FOR_REVIEW'
  return 'READY_LATER'
}

export function buildEvaluation2026DryRunOutputReviewTemplate(params: {
  integratedReadinessSnapshot: Evaluation2026IntegratedReadinessSnapshot
  backfillDryRunPreflightPack: Evaluation2026BackfillDryRunPreflightPack
  officialActivationRunbook: Evaluation2026OfficialActivationRunbook
}): Evaluation2026DryRunOutputReviewTemplate {
  const officialStatus = officialActivationStatus({
    snapshot: params.integratedReadinessSnapshot,
    preflight: params.backfillDryRunPreflightPack,
    runbook: params.officialActivationRunbook,
  })
  const templateSummary: Evaluation2026DryRunOutputReviewTemplate['templateSummary'] = {
    currentStage: params.integratedReadinessSnapshot.currentStage,
    overallReadinessStatus: params.integratedReadinessSnapshot.overallStatus,
    officialActivationStatus: officialStatus,
    preflightStatus: params.backfillDryRunPreflightPack.preflightSummary.backfillDryRunReviewStatus,
    applyStatus: params.backfillDryRunPreflightPack.preflightSummary.backfillApplyStatus,
    localOnlyPasteHelperStatus: 'LOCAL_ONLY',
    nextReviewAction: 'future dry-run output을 이 템플릿에 붙여넣고 writesPerformed/totalScore/gradeId/red flag를 먼저 검토하세요.',
  }
  const reviewTemplate = buildReviewTemplateText({
    templateSummary,
    dryRunIdentityFields: DRY_RUN_IDENTITY_FIELDS,
    expectedOutputFields: EXPECTED_OUTPUT_FIELDS,
    mustPassCriteria: MUST_PASS_CRITERIA,
    redFlagConditions: RED_FLAG_CONDITIONS,
  })
  const markdown = buildMarkdown({
    templateSummary,
    dryRunIdentityFields: DRY_RUN_IDENTITY_FIELDS,
    expectedOutputFields: EXPECTED_OUTPUT_FIELDS,
    mustPassCriteria: MUST_PASS_CRITERIA,
    redFlagConditions: RED_FLAG_CONDITIONS,
    prohibitedActions: PROHIBITED_ACTIONS,
  })
  const tsv = buildTsv({
    dryRunIdentityFields: DRY_RUN_IDENTITY_FIELDS,
    expectedOutputFields: EXPECTED_OUTPUT_FIELDS,
    mustPassCriteria: MUST_PASS_CRITERIA,
    redFlagConditions: RED_FLAG_CONDITIONS,
  })

  return {
    mode: 'READ_ONLY',
    templateStatus: 'AVAILABLE',
    generatedAt: new Date().toISOString(),
    templateSummary,
    reviewTemplateSections: REVIEW_TEMPLATE_SECTIONS,
    dryRunIdentityFields: DRY_RUN_IDENTITY_FIELDS,
    expectedOutputFields: EXPECTED_OUTPUT_FIELDS,
    mustPassCriteria: MUST_PASS_CRITERIA,
    redFlagConditions: RED_FLAG_CONDITIONS,
    hrReviewChecklist: HR_REVIEW_CHECKLIST,
    developerReviewChecklist: DEVELOPER_REVIEW_CHECKLIST,
    postDryRunLogWatchChecklist: POST_DRY_RUN_LOG_WATCH_CHECKLIST,
    decisionOutcomes: DECISION_OUTCOMES,
    nextActionMapping: NEXT_ACTION_MAPPING,
    localOnlyPasteHelper: {
      enabled: true,
      serverSubmitAvailable: false,
      saveAvailable: false,
      uploadAvailable: false,
      apiCallAvailable: false,
      persistenceAvailable: false,
      guidance: '붙여넣은 dry-run output은 브라우저 local state에서만 구조화합니다. 서버 제출, 저장, 업로드, API 호출, persistence는 제공하지 않습니다.',
      invalidJsonMessage: '붙여넣은 결과를 구조화하지 못했습니다. 수동 검토 템플릿을 사용하세요.',
      knownFields: KNOWN_PASTE_FIELDS,
    },
    prohibitedActions: PROHIBITED_ACTIONS,
    copyPayloads: {
      reviewTemplate,
      mustPassCriteria: buildCriteriaText(MUST_PASS_CRITERIA),
      redFlags: buildCriteriaText(RED_FLAG_CONDITIONS),
      hrReviewChecklist: buildTextList(HR_REVIEW_CHECKLIST),
      developerReviewChecklist: buildTextList(DEVELOPER_REVIEW_CHECKLIST),
      decisionOutcomeGuide: buildDecisionText(DECISION_OUTCOMES),
      nextActionMapping: buildNextActionText(NEXT_ACTION_MAPPING),
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
      noDryRunExecutionButtons: true,
      noBackfillExecutionButtons: true,
      noApplyButtons: true,
      noScoreGradeWriteButtons: true,
      noServerSubmit: true,
      noUpload: true,
      noPersistence: true,
    },
  }
}
