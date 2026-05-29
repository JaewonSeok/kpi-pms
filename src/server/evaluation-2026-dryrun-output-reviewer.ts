export type Evaluation2026DryRunOutputReviewClassification =
  | 'PASS_FOR_REVIEW'
  | 'NEEDS_HR_FIX'
  | 'NEEDS_DEVELOPER_FIX'
  | 'REJECT_DRY_RUN_OUTPUT'

export type Evaluation2026DryRunOutputRedFlag = {
  id: string
  label: string
  severity: 'HR_FIX' | 'DEVELOPER_FIX' | 'REJECT'
  nextAction: string
}

export type Evaluation2026DryRunOutputReviewResult = {
  classification: Evaluation2026DryRunOutputReviewClassification
  extractedFields: Record<string, string | number | boolean | null>
  missingRequiredFields: string[]
  redFlags: Evaluation2026DryRunOutputRedFlag[]
  nextActions: string[]
  safety: {
    writesPerformed: false
    serverPersistence: false
    prismaUsed: false
    fetchUsed: false
    fileWrites: false
    totalScoreChanged: false
    gradeIdChanged: false
  }
}

const REQUIRED_FIELDS = [
  'writesPerformed',
  'totalScoreChangesExpected',
  'gradeIdChangesExpected',
  'policyCategoryMissingCount',
  'evaluatorAssignmentMissingCount',
  'targetPopulationCount',
  'errors',
]

const FIELD_ALIASES: Record<string, string[]> = {
  writesPerformed: ['writesPerformed', 'writePerformed', 'writes_performed'],
  totalScoreChangesExpected: [
    'totalScoreChangesExpected',
    'totalScoreChanged',
    'totalScoreChangeCount',
    'evaluationTotalScoreChanged',
  ],
  gradeIdChangesExpected: [
    'gradeIdChangesExpected',
    'gradeIdChanged',
    'gradeIdChangeCount',
    'evaluationGradeIdChanged',
  ],
  officialScoringEnabled: ['officialScoringEnabled', 'officialScoringFlagEnabled'],
  officialGradeEnabled: ['officialGradeEnabled', 'officialGradeFlagEnabled'],
  aiScoreExclusionEnabled: ['aiScoreExclusionEnabled', 'aiExclusionActivationEnabled'],
  featureFlagsChanged: ['featureFlagsChanged', 'featureFlagChanged'],
  unexpectedEvaluationCreateCount: ['unexpectedEvaluationCreateCount', 'evaluationsCreated'],
  unexpectedEvaluationItemCreateCount: ['unexpectedEvaluationItemCreateCount', 'evaluationItemsCreated'],
  targetPopulationCount: ['targetPopulationCount', 'populationCount'],
  expectedTargetPopulationCount: ['expectedTargetPopulationCount', 'hrApprovedPopulationCount'],
  policyCategoryMissingCount: ['policyCategoryMissingCount', 'missingPolicyCategoryCount'],
  evaluatorAssignmentMissingCount: ['evaluatorAssignmentMissingCount', 'evaluatorMissingCount'],
  mboMissingCount: ['mboMissingCount', 'missingMboCount'],
  teamKpiPendingCount: ['teamKpiPendingCount', 'teamKpiPendingDiscussionCount'],
  scorePolicyBlockerCount: ['scorePolicyBlockerCount', 'scorePolicyBlockers'],
  gradePolicyBlockerCount: ['gradePolicyBlockerCount', 'gradePolicyBlockers'],
  approvedEvaluatorExceptions: ['approvedEvaluatorExceptions', 'evaluatorExceptionsApproved'],
  errors: ['errors', 'errorMessages'],
  warnings: ['warnings', 'warningMessages'],
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

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function getField(record: Record<string, unknown>, canonicalName: string) {
  const aliases = FIELD_ALIASES[canonicalName] ?? [canonicalName]
  for (const alias of aliases) {
    if (Object.prototype.hasOwnProperty.call(record, alias)) return record[alias]
  }
  return undefined
}

function asBoolean(value: unknown) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value > 0
  if (typeof value === 'string') return ['1', 'true', 'yes', 'changed', 'enabled'].includes(value.trim().toLowerCase())
  return false
}

function asNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const number = Number(value)
    return Number.isFinite(number) ? number : 0
  }
  return 0
}

function asTextArray(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => String(item))
  if (typeof value === 'string' && value.trim()) return [value]
  return []
}

function displayValue(value: unknown): string | number | boolean | null {
  if (value == null) return null
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value
  return JSON.stringify(value)
}

function addFlag(
  target: Evaluation2026DryRunOutputRedFlag[],
  id: string,
  label: string,
  severity: Evaluation2026DryRunOutputRedFlag['severity'],
  nextAction: string
) {
  target.push({ id, label, severity, nextAction })
}

function classify(redFlags: Evaluation2026DryRunOutputRedFlag[], missingRequiredFields: string[]) {
  if (redFlags.some((flag) => flag.severity === 'REJECT')) return 'REJECT_DRY_RUN_OUTPUT' as const
  if (redFlags.some((flag) => flag.severity === 'DEVELOPER_FIX') || missingRequiredFields.length) {
    return 'NEEDS_DEVELOPER_FIX' as const
  }
  if (redFlags.some((flag) => flag.severity === 'HR_FIX')) return 'NEEDS_HR_FIX' as const
  return 'PASS_FOR_REVIEW' as const
}

export function reviewEvaluation2026DryRunOutput(output: unknown): Evaluation2026DryRunOutputReviewResult {
  const redFlags: Evaluation2026DryRunOutputRedFlag[] = []
  const extractedFields: Evaluation2026DryRunOutputReviewResult['extractedFields'] = {}

  if (!isPlainRecord(output)) {
    addFlag(redFlags, 'INVALID_OUTPUT_SHAPE', 'dry-run output is not a JSON object', 'DEVELOPER_FIX', '구조화된 JSON output을 다시 확보하세요.')
    return {
      classification: 'NEEDS_DEVELOPER_FIX',
      extractedFields,
      missingRequiredFields: REQUIRED_FIELDS,
      redFlags,
      nextActions: ['수동 검토 템플릿으로 fallback하고 output schema를 보완하세요.'],
      safety: {
        writesPerformed: false,
        serverPersistence: false,
        prismaUsed: false,
        fetchUsed: false,
        fileWrites: false,
        totalScoreChanged: false,
        gradeIdChanged: false,
      },
    }
  }

  for (const field of [...REQUIRED_FIELDS, ...Object.keys(FIELD_ALIASES)]) {
    const value = getField(output, field)
    if (value !== undefined) extractedFields[field] = displayValue(value)
  }

  const missingRequiredFields = REQUIRED_FIELDS.filter((field) => getField(output, field) === undefined)
  if (missingRequiredFields.length) {
    addFlag(redFlags, 'MISSING_REQUIRED_FIELDS', 'dry-run output missing key fields', 'DEVELOPER_FIX', 'review template 기준 필드를 포함해 output format을 보완하세요.')
  }

  if (asBoolean(getField(output, 'writesPerformed'))) {
    addFlag(redFlags, 'WRITES_PERFORMED_TRUE', 'writesPerformed true', 'REJECT', '즉시 중단하고 dry-run 실행 경로를 조사하세요.')
  }
  if (asBoolean(getField(output, 'totalScoreChangesExpected'))) {
    addFlag(redFlags, 'TOTAL_SCORE_CHANGED', 'Evaluation.totalScore changed', 'REJECT', 'score write 경로를 차단하고 조사하세요.')
  }
  if (asBoolean(getField(output, 'gradeIdChangesExpected'))) {
    addFlag(redFlags, 'GRADE_ID_CHANGED', 'Evaluation.gradeId changed', 'REJECT', 'grade write 경로를 차단하고 조사하세요.')
  }
  if (asBoolean(getField(output, 'officialScoringEnabled'))) {
    addFlag(redFlags, 'OFFICIAL_SCORING_ENABLED', 'official scoring enabled', 'REJECT', 'feature flag 변경 여부를 조사하세요.')
  }
  if (asBoolean(getField(output, 'officialGradeEnabled'))) {
    addFlag(redFlags, 'OFFICIAL_GRADE_ENABLED', 'official grade enabled', 'REJECT', 'grade activation 경로를 조사하세요.')
  }
  if (asBoolean(getField(output, 'aiScoreExclusionEnabled'))) {
    addFlag(redFlags, 'AI_SCORE_EXCLUSION_ENABLED', 'AI score exclusion activation enabled', 'REJECT', 'AI exclusion activation은 별도 승인 전까지 차단하세요.')
  }
  if (asBoolean(getField(output, 'featureFlagsChanged'))) {
    addFlag(redFlags, 'FEATURE_FLAG_CHANGED', 'feature flag changed', 'REJECT', 'production feature flag mutation 여부를 확인하세요.')
  }
  if (asNumber(getField(output, 'unexpectedEvaluationCreateCount')) > 0) {
    addFlag(redFlags, 'UNEXPECTED_EVALUATION_CREATE', 'unexpected Evaluation creation', 'REJECT', 'dry-run mode에서 Evaluation 생성이 발생했는지 조사하세요.')
  }
  if (asNumber(getField(output, 'unexpectedEvaluationItemCreateCount')) > 0) {
    addFlag(redFlags, 'UNEXPECTED_EVALUATION_ITEM_CREATE', 'unexpected EvaluationItem creation', 'REJECT', 'dry-run mode에서 EvaluationItem 생성이 발생했는지 조사하세요.')
  }

  const targetPopulation = asNumber(getField(output, 'targetPopulationCount'))
  const expectedPopulation = asNumber(getField(output, 'expectedTargetPopulationCount'))
  if (expectedPopulation > 0 && targetPopulation !== expectedPopulation) {
    addFlag(redFlags, 'TARGET_POPULATION_MISMATCH', 'target population mismatch', 'REJECT', 'HR 승인 population scope를 재확인하세요.')
  }
  if (asNumber(getField(output, 'policyCategoryMissingCount')) > 0) {
    addFlag(redFlags, 'POLICY_CATEGORY_MISSING', 'policyCategory missing > 0', 'HR_FIX', 'policyCategory workbench에서 미분류를 먼저 정리하세요.')
  }
  if (
    asNumber(getField(output, 'evaluatorAssignmentMissingCount')) > 0 &&
    !asBoolean(getField(output, 'approvedEvaluatorExceptions'))
  ) {
    addFlag(redFlags, 'EVALUATOR_MISSING', 'evaluator missing > 0 without approved exception', 'HR_FIX', '/admin/performance-assignments에서 blocker 또는 승인 예외를 확인하세요.')
  }
  if (asNumber(getField(output, 'mboMissingCount')) > 0) {
    addFlag(redFlags, 'MBO_MISSING', 'MBO missing > 0', 'HR_FIX', '/kpi/personal에서 MBO coverage를 먼저 확인하세요.')
  }
  if (asNumber(getField(output, 'teamKpiPendingCount')) > 0) {
    addFlag(redFlags, 'TEAM_KPI_PENDING', 'Team KPI pending > 0', 'HR_FIX', 'Team KPI HR review 대기/논의 건을 정리하세요.')
  }
  if (asNumber(getField(output, 'scorePolicyBlockerCount')) > 0) {
    addFlag(redFlags, 'SCORE_POLICY_BLOCKERS', 'score policy blockers > 0', 'HR_FIX', 'score policy readiness blocker를 먼저 정리하세요.')
  }
  if (asNumber(getField(output, 'gradePolicyBlockerCount')) > 0) {
    addFlag(redFlags, 'GRADE_POLICY_BLOCKERS', 'grade policy blockers > 0', 'HR_FIX', 'grade policy readiness blocker를 먼저 정리하세요.')
  }

  const errorText = [
    ...asTextArray(getField(output, 'errors')),
    ...asTextArray(getField(output, 'warnings')),
  ].join(' ')
  if (/(P2021|P2022|PrismaClientKnownRequestError|column does not exist|relation does not exist|schema error)/i.test(errorText)) {
    addFlag(redFlags, 'PRISMA_SCHEMA_ERROR', 'schema/P2021/P2022 error', 'REJECT', 'migration 실행 금지, schema/runtime hotfix 필요 여부만 조사하세요.')
  }
  if (/JWT_SESSION_ERROR/i.test(errorText)) {
    addFlag(redFlags, 'JWT_SESSION_ERROR', 'JWT_SESSION_ERROR', 'DEVELOPER_FIX', 'auth/session runtime 상태를 확인하세요.')
  }

  const classification = classify(redFlags, missingRequiredFields)
  const nextActions = redFlags.length
    ? redFlags.map((flag) => flag.nextAction)
    : ['must-pass criteria를 HR/개발이 함께 확인하고 backup/HR approval 논의로만 진행하세요. apply는 여전히 금지입니다.']

  return {
    classification,
    extractedFields,
    missingRequiredFields,
    redFlags,
    nextActions,
    safety: {
      writesPerformed: false,
      serverPersistence: false,
      prismaUsed: false,
      fetchUsed: false,
      fileWrites: false,
      totalScoreChanged: false,
      gradeIdChanged: false,
    },
  }
}

export function getEvaluation2026DryRunOutputReviewProhibitedActions() {
  return [...PROHIBITED_ACTIONS]
}
