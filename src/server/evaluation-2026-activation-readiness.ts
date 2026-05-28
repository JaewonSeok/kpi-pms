import type { Session } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { EVALUATION_POLICY_2026 } from '@/lib/evaluation-policy-2026'
import {
  get2026EvaluationFeatureFlags,
  is2026OfficialActivationAllowed,
  type Evaluation2026FeatureFlags,
} from '@/lib/feature-flags'
import { AppError } from '@/lib/utils'
import { canAccessEvaluationPreview2026 } from '@/server/evaluation-preview-2026-loader'
import {
  getEvaluationPreviewReadinessSummary2026,
  type EvaluationPreviewReadinessSummary2026,
} from '@/server/evaluation-preview-2026-readiness'
import {
  getEvaluation2026GradePolicyReadiness,
  type Evaluation2026GradePolicyReadinessResult,
} from '@/server/evaluation-2026-grade-policy-readiness'
import {
  getEvaluation2026ReadinessPopulationDryRun,
  type Evaluation2026ReadinessPopulationDryRun,
} from '@/server/evaluation-2026-readiness-population'
import {
  getEvaluation2026EvaluatorRoutingReadiness,
  type Evaluation2026EvaluatorRoutingReadinessResult,
} from '@/server/evaluation-2026-evaluator-routing-readiness'
import {
  getEvaluation2026FeedbackLeadershipReadiness,
  type Evaluation2026FeedbackLeadershipReadinessResult,
} from '@/server/evaluation-2026-feedback-leadership-readiness'
import {
  buildEvaluation2026IntegratedReadinessSnapshot,
  type Evaluation2026IntegratedReadinessSnapshot,
} from '@/server/evaluation-2026-integrated-readiness-snapshot'
import {
  buildEvaluation2026ReadinessActionPlan,
  type Evaluation2026ReadinessActionPlan,
} from '@/server/evaluation-2026-readiness-action-plan'
import {
  buildEvaluation2026ReadinessExecutionBoard,
  type Evaluation2026ReadinessExecutionBoard,
} from '@/server/evaluation-2026-readiness-execution-board'

type Evaluation2026ActivationDb = Pick<typeof prisma, 'evaluation' | 'aiCompetencyGateAssignment'> & Partial<Pick<typeof prisma, 'evalCycle' | 'department' | 'employee' | 'evaluationAssignment' | 'multiFeedbackRound' | 'wordCloud360Cycle'>> & {
  $queryRawUnsafe?: typeof prisma.$queryRawUnsafe
}

type Evaluation2026ActivationPopulationDb = Evaluation2026ActivationDb & Partial<Pick<
  typeof prisma,
  'employee' | 'personalKpi' | 'orgKpi' | 'auditLog' | 'evaluationGradePolicy'
>>

export type Evaluation2026PolicySchemaField = {
  tableName: string
  columnName: string
}

export type Evaluation2026MigrationReadiness = {
  requiredSchemaPresent: boolean
  migrationApplied: boolean
  migrationHistoryTableExists: boolean | null
  migrationName: string
  missingFields: Evaluation2026PolicySchemaField[]
  checkedVia: 'information_schema' | 'provided' | 'unavailable'
  note?: string
}

export type Evaluation2026ActivationReadinessItem = {
  code: string
  message: string
  severity: 'blocker' | 'warning'
}

export type Evaluation2026OfficialActivationGateStatus = 'BLOCKED' | 'READY' | 'NOT_APPLICABLE'

export type Evaluation2026OfficialActivationGateCondition = {
  code: string
  label: string
  status: Evaluation2026OfficialActivationGateStatus
  currentValue: string
  blockerCount: number
  reason: string
  nextHrAction: string
}

export type Evaluation2026OfficialActivationGate = {
  id:
    | 'BACKFILL_APPLY'
    | 'OFFICIAL_SCORING'
    | 'AI_SCORE_EXCLUSION'
    | 'OFFICIAL_GRADE'
    | 'EVALUATION_TOTAL_SCORE_WRITE'
    | 'EVALUATION_GRADE_ID_WRITE'
  title: string
  status: Evaluation2026OfficialActivationGateStatus
  requiredConditions: Evaluation2026OfficialActivationGateCondition[]
  currentBlockerCount: number
  blockedReasons: string[]
  nextHrAction: string
  safetyWarning: string
}

export type Evaluation2026OfficialActivationRunbookStatus =
  | 'BLOCKED'
  | 'READY_FOR_REVIEW'
  | 'READY_LATER'
  | 'NOT_APPLICABLE'

export type Evaluation2026OfficialActivationRunbookSection = {
  id:
    | 'PRECONDITIONS'
    | 'BACKFILL_DRY_RUN'
    | 'BACKFILL_APPLY'
    | 'OFFICIAL_SCORING_ACTIVATION'
    | 'EVALUATION_TOTAL_SCORE_WRITE'
    | 'OFFICIAL_GRADE_ACTIVATION'
    | 'EVALUATION_GRADE_ID_WRITE'
  title: string
  status: Evaluation2026OfficialActivationRunbookStatus
  requiredChecks: string[]
  currentBlockerCount: number
  sourceReadinessPanels: string[]
  nextHrAction: string
  nextDeveloperAction: string
  prohibitedActions: string[]
}

export type Evaluation2026OfficialActivationRunbook = {
  mode: 'READ_ONLY'
  currentPosition: {
    currentStage: string
    nextRequiredStep: string
    nextExecutableStep: string
    blockerCount: number
    prohibitedActions: string[]
    noExecutionButtonsInUi: true
  }
  sections: Evaluation2026OfficialActivationRunbookSection[]
  hrApprovalChecklist: string[]
  developerExecutionChecklist: string[]
  copyPayloads: {
    markdown: string
    blockerSummary: string
    hrApprovalChecklist: string
    developerExecutionChecklist: string
    prohibitedActions: string
    tsv: string
  }
  summary: {
    sectionCount: number
    blockedSectionCount: number
    readyForReviewSectionCount: number
    readyLaterSectionCount: number
    notApplicableSectionCount: number
    totalBlockerCount: number
    nextExecutableStep: string
    noExecutionButtonsInUi: true
    officialScoringEnabled: boolean
    officialGradeEnabled: boolean
    officialAiScoreExclusionEnabled: boolean
  }
  safety: {
    writesPerformed: false
    backfillExecuted: false
    migrationsRun: false
    featureFlagsChanged: false
    totalScoreChanged: false
    gradeIdChanged: false
    evaluationsCreated: 0
    evaluationItemsCreated: 0
  }
}

export type Evaluation2026ActivationReadinessResult = {
  policyVersion: string
  checkedAt: string
  canActivate: boolean
  flags: Evaluation2026FeatureFlags
  migration: Evaluation2026MigrationReadiness
  readiness: EvaluationPreviewReadinessSummary2026
  gradePolicyReadiness: Evaluation2026GradePolicyReadinessResult | null
  evaluatorRoutingReadiness: Evaluation2026EvaluatorRoutingReadinessResult | null
  feedbackLeadershipReadiness: Evaluation2026FeedbackLeadershipReadinessResult | null
  leaderEvaluationReadiness: Evaluation2026ReadinessPopulationDryRun['leaderEvaluationReadiness'] | null
  finalizationCeoReadiness: Evaluation2026ReadinessPopulationDryRun['finalizationCeoReadiness'] | null
  officialActivationGates: Evaluation2026OfficialActivationGate[]
  officialActivationRunbook: Evaluation2026OfficialActivationRunbook
  integratedReadinessSnapshot: Evaluation2026IntegratedReadinessSnapshot
  readinessActionPlan: Evaluation2026ReadinessActionPlan
  readinessExecutionBoard: Evaluation2026ReadinessExecutionBoard
  populationDryRunAvailable: boolean
  populationDryRunError: string | null
  blockers: Evaluation2026ActivationReadinessItem[]
  warnings: Evaluation2026ActivationReadinessItem[]
}

const PHASE0_MIGRATION_NAME = '20260514_phase0_2026_policy_prep'

const OFFICIAL_ACTIVATION_PROHIBITED_ACTIONS_2026 = [
  'backfill --apply',
  'prisma migrate deploy',
  'official 2026 scoring activation',
  'official grade calculation activation',
  'AI score exclusion activation',
  'Evaluation.totalScore write',
  'Evaluation.gradeId write',
  'Evaluation/EvaluationItem creation',
  'production feature flag change',
]

const HR_APPROVAL_CHECKLIST_2026 = [
  'HR confirms official readiness cycle',
  'HR confirms target population',
  'HR confirms MBO category readiness',
  'HR confirms Team KPI decisions',
  'HR confirms score policy',
  'HR confirms grade policy',
  'HR confirms AI exclusion policy',
  'HR confirms evaluator routing',
  'HR confirms 360/leadership readiness',
  'HR confirms finalization/CEO readiness',
  'HR confirms DB backup before apply',
]

const DEVELOPER_EXECUTION_CHECKLIST_2026 = [
  'verify production branch/commit',
  'verify environment flags',
  'verify DB backup',
  'run dry-run',
  'archive dry-run output',
  'obtain HR approval',
  'run apply only from controlled CLI/runbook',
  'verify postcheck',
  'keep feature flags off until approved',
  'activate scoring separately',
  'activate grade separately',
  'write totalScore separately',
  'write gradeId last',
]

const REQUIRED_SCHEMA_FIELDS: Evaluation2026PolicySchemaField[] = [
  { tableName: 'evaluation_grade_policies', columnName: 'policyVersion' },
  { tableName: 'evaluation_grade_policies', columnName: 'thresholdGroup' },
  { tableName: 'evaluation_grade_policies', columnName: 'gradeLabel' },
  { tableName: 'evaluation_grade_policies', columnName: 'minScore' },
  { tableName: 'evaluation_grade_policies', columnName: 'maxScore' },
  { tableName: 'personal_kpis', columnName: 'policyCategory' },
  { tableName: 'personal_kpis', columnName: 'policyCategoryConfidence' },
  { tableName: 'personal_kpis', columnName: 'policyCategorySource' },
  { tableName: 'personal_kpis', columnName: 'policyCategoryReviewedAt' },
  { tableName: 'personal_kpis', columnName: 'policyCategoryReviewNote' },
  { tableName: 'eval_cycles', columnName: 'performanceDesignConfig' },
  { tableName: 'evaluations', columnName: 'policyFormulaVersion' },
  { tableName: 'evaluations', columnName: 'organizationPerformanceScore' },
  { tableName: 'evaluations', columnName: 'personalPerformanceScore' },
  { tableName: 'evaluations', columnName: 'aiScoreIncludedInTotal' },
  { tableName: 'evaluations', columnName: 'scorePolicySnapshot' },
  { tableName: 'evaluation_items', columnName: 'policyCategory' },
  { tableName: 'evaluation_items', columnName: 'scoreContributionType' },
  { tableName: 'evaluation_items', columnName: 'policyFormulaVersion' },
  { tableName: 'evaluation_items', columnName: 'basePolicyScore' },
  { tableName: 'evaluation_items', columnName: 'adjustmentScore' },
  { tableName: 'evaluation_items', columnName: 'adjustmentGroupKey' },
  { tableName: 'evaluation_items', columnName: 'adjustmentReason' },
  { tableName: 'evaluation_items', columnName: 'targetAchievementLevel' },
  { tableName: 'evaluation_items', columnName: 'policyScoreSnapshot' },
  { tableName: 'ai_competency_gate_cases', columnName: 'policyVersion' },
  { tableName: 'ai_competency_gate_cases', columnName: 'policyRecognitionRoute' },
]

function addItem(
  target: Evaluation2026ActivationReadinessItem[],
  code: string,
  message: string,
  severity: Evaluation2026ActivationReadinessItem['severity'] = 'blocker'
) {
  target.push({ code, message, severity })
}

export function getRequiredEvaluation2026PolicySchemaFields() {
  return [...REQUIRED_SCHEMA_FIELDS]
}

export async function verifyEvaluation2026PolicyMigrationReadiness(
  db: Evaluation2026ActivationDb = prisma
): Promise<Evaluation2026MigrationReadiness> {
  if (typeof db.$queryRawUnsafe !== 'function') {
    return {
      requiredSchemaPresent: false,
      migrationApplied: false,
      migrationHistoryTableExists: null,
      migrationName: PHASE0_MIGRATION_NAME,
      missingFields: REQUIRED_SCHEMA_FIELDS,
      checkedVia: 'unavailable',
      note: 'DB metadata query is unavailable in this execution context.',
    }
  }

  const knownColumns = await db.$queryRawUnsafe<Array<{ table_name: string; column_name: string }>>(`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN (
        'evaluation_grade_policies',
        'personal_kpis',
        'eval_cycles',
        'evaluations',
        'evaluation_items',
        'ai_competency_gate_cases'
      )
  `)
  const columnKeys = new Set(knownColumns.map((row) => `${row.table_name}.${row.column_name}`))
  const missingFields = REQUIRED_SCHEMA_FIELDS.filter(
    (field) => !columnKeys.has(`${field.tableName}.${field.columnName}`)
  )

  const migrationTableRows = await db.$queryRawUnsafe<Array<{ regclass: string | null }>>(`
    SELECT to_regclass('public._prisma_migrations')::text AS regclass
  `)
  const migrationHistoryTableExists = Boolean(migrationTableRows[0]?.regclass)
  let migrationApplied = false

  if (migrationHistoryTableExists) {
    const migrationRows = await db.$queryRawUnsafe<Array<{ migration_name: string }>>(`
      SELECT migration_name
      FROM "_prisma_migrations"
      WHERE migration_name = '${PHASE0_MIGRATION_NAME}'
        AND finished_at IS NOT NULL
        AND rolled_back_at IS NULL
      LIMIT 1
    `)
    migrationApplied = migrationRows.length > 0
  }

  return {
    requiredSchemaPresent: missingFields.length === 0,
    migrationApplied,
    migrationHistoryTableExists,
    migrationName: PHASE0_MIGRATION_NAME,
    missingFields,
    checkedVia: 'information_schema',
    note: migrationHistoryTableExists
      ? undefined
      : 'Required columns may exist via db push, but Prisma migration history is not present.',
  }
}

function collectFlagReadiness(
  flags: Evaluation2026FeatureFlags,
  blockers: Evaluation2026ActivationReadinessItem[],
  warnings: Evaluation2026ActivationReadinessItem[]
) {
  if (!flags.previewEnabled) {
    addItem(blockers, 'PREVIEW_FLAG_DISABLED', '2026 preview flag가 꺼져 있어 활성화 전 검증을 볼 수 없습니다.')
  }
  if (!flags.officialScoringEnabled) {
    addItem(blockers, 'OFFICIAL_SCORING_FLAG_DISABLED', '공식 2026 scoring flag가 명시적으로 켜져 있지 않습니다.')
  }
  if (!flags.officialGradeEnabled) {
    addItem(blockers, 'OFFICIAL_GRADE_FLAG_DISABLED', '공식 2026 grade flag가 명시적으로 켜져 있지 않습니다.')
  }
  if (!flags.aiScoreExclusionEnabled) {
    addItem(blockers, 'AI_SCORE_EXCLUSION_FLAG_DISABLED', '공식 AI 점수 제외 flag가 명시적으로 켜져 있지 않습니다.')
  }
  if (!flags.backfillApplied && !flags.backfillExcluded) {
    addItem(blockers, 'BACKFILL_NOT_CONFIRMED', '2026 metadata backfill 적용 또는 명시적 제외 승인이 필요합니다.')
  }
  if (flags.backfillApplied && flags.backfillExcluded) {
    addItem(blockers, 'BACKFILL_FLAGS_CONFLICT', 'backfill applied와 excluded flag를 동시에 켤 수 없습니다.')
  }
  if (!flags.hrApprovalConfirmed) {
    addItem(blockers, 'HR_APPROVAL_REQUIRED', '공식 전환을 위한 HR/admin 승인 flag가 필요합니다.')
  }
  if (flags.officialGradeEnabled && !flags.officialScoringEnabled) {
    addItem(blockers, 'FEATURE_FLAG_INCONSISTENT', '공식 grade flag는 scoring flag 없이 단독 활성화할 수 없습니다.')
  }
  if (flags.aiScoreExclusionEnabled && !flags.officialScoringEnabled) {
    addItem(blockers, 'FEATURE_FLAG_INCONSISTENT', '공식 AI 점수 제외 flag는 scoring flag 없이 단독 활성화할 수 없습니다.')
  }
  if (flags.previewEnabled && !is2026OfficialActivationAllowed(flags)) {
    addItem(warnings, 'PREVIEW_ONLY_MODE', '현재 설정은 2026 preview-only 상태입니다.', 'warning')
  }
}

function collectMigrationReadiness(
  migration: Evaluation2026MigrationReadiness,
  blockers: Evaluation2026ActivationReadinessItem[],
  warnings: Evaluation2026ActivationReadinessItem[]
) {
  if (!migration.requiredSchemaPresent) {
    const missing = migration.missingFields.slice(0, 5).map((field) => `${field.tableName}.${field.columnName}`)
    addItem(
      blockers,
      'POLICY_SCHEMA_MISSING',
      `2026 정책 metadata schema가 준비되지 않았습니다.${missing.length ? ` 누락: ${missing.join(', ')}` : ''}`
    )
  }
  if (!migration.migrationApplied) {
    addItem(blockers, 'PHASE0_MIGRATION_NOT_APPLIED', 'Phase 0 2026 policy prep migration 적용 이력이 확인되지 않았습니다.')
  }
  if (migration.requiredSchemaPresent && !migration.migrationHistoryTableExists) {
    addItem(
      warnings,
      'MIGRATION_HISTORY_MISSING',
      'schema는 준비되어 있을 수 있으나 _prisma_migrations 이력이 없어 공식 전환 전 DB bootstrap 방식을 확인해야 합니다.',
      'warning'
    )
  }
}

function collectPreviewReadiness(
  readiness: EvaluationPreviewReadinessSummary2026,
  blockers: Evaluation2026ActivationReadinessItem[],
  warnings: Evaluation2026ActivationReadinessItem[]
) {
  if (!readiness.cycleScope.isOfficialReadinessTarget) {
    addItem(
      blockers,
      'OFFICIAL_READINESS_CYCLE_NOT_CONFIRMED',
      readiness.cycleScope.warning ?? '공식 2026 readiness 대상 평가 주기가 확정되지 않았습니다.'
    )
  }
  if (readiness.totalEvaluationsChecked <= 0) {
    addItem(warnings, 'NO_EVALUATIONS_CHECKED', '현재 필터 범위에서 검증한 평가가 없습니다.', 'warning')
  }
  if (readiness.missingPolicyCategoryCount > 0) {
    addItem(blockers, 'POLICY_CATEGORY_UNRESOLVED', '정책 카테고리 미분류 항목이 남아 있습니다.')
  }
  if (readiness.manualReviewCount > 0) {
    addItem(blockers, 'MANUAL_REVIEW_UNRESOLVED', 'UNKNOWN/manual-review 항목이 남아 있습니다.')
  }
  if (readiness.missingSalesClassificationCount > 0) {
    addItem(blockers, 'SALES_GROUP_UNRESOLVED', '영업/비영업 구분이 누락된 대상자가 남아 있습니다.')
  }
  if (readiness.missingOrgMasterDivisionSalesMappingCount > 0) {
    addItem(blockers, 'DIVISION_SALES_GROUP_UNRESOLVED', '조직 master 기준 division 영업/비영업 매핑이 남아 있습니다.')
  }
  if (readiness.ambiguousThresholdCount > 0) {
    addItem(blockers, 'THRESHOLD_AMBIGUITY_UNRESOLVED', '영업 팀원 Super/Outstanding 기준 HR 확인이 남아 있습니다.')
  }
  if (readiness.blockedCount > 0) {
    addItem(blockers, 'PREVIEW_NOT_CALCULABLE', '2026 preview를 계산할 수 없는 평가가 남아 있습니다.')
  }
  if (readiness.aiInsufficientDataCount > 0) {
    addItem(warnings, 'AI_EVIDENCE_INSUFFICIENT', 'AI 레벨업 요건 증빙 부족 건이 남아 있습니다.', 'warning')
  }
}

function collectGradePolicyReadiness(
  gradePolicyReadiness: Evaluation2026GradePolicyReadinessResult | null,
  blockers: Evaluation2026ActivationReadinessItem[],
  warnings: Evaluation2026ActivationReadinessItem[]
) {
  if (!gradePolicyReadiness) {
    addItem(warnings, 'GRADE_POLICY_NOT_CHECKED', '2026 등급 기준 readiness를 현재 실행 컨텍스트에서 확인하지 못했습니다.', 'warning')
    return
  }

  if (gradePolicyReadiness.persistence.compatibilityIssue) {
    addItem(blockers, 'GRADE_POLICY_DB_COMPATIBILITY_REQUIRED', '2026 등급 기준 정책을 불러오지 못했습니다. DB compatibility 확인이 필요합니다.')
    return
  }
  if (!gradePolicyReadiness.persistence.available) {
    addItem(warnings, 'GRADE_POLICY_PERSISTENCE_UNAVAILABLE', 'evaluation_grade_policies 조회가 불가능해 저장 정책을 확인하지 못했습니다.', 'warning')
    return
  }
  if (!gradePolicyReadiness.gradePolicyExists) {
    addItem(blockers, 'GRADE_POLICY_MISSING', '2026 등급 기준 저장 정책이 없습니다.')
  }
  if (!gradePolicyReadiness.gradePolicyGroupsComplete) {
    addItem(blockers, 'GRADE_POLICY_INCOMPLETE', '2026 등급 기준 그룹 또는 등급 행이 누락되어 있습니다.')
  }
  if (gradePolicyReadiness.differsFromPptCount > 0) {
    addItem(blockers, 'GRADE_POLICY_DIFFERS_FROM_PPT', '저장된 2026 등급 기준이 PPT 기준과 달라 HR 확인이 필요합니다.')
  }
  if (gradePolicyReadiness.overlapCount > 0) {
    addItem(blockers, 'GRADE_POLICY_THRESHOLD_OVERLAP', '저장된 2026 등급 기준에 중첩 구간이 있습니다.')
  }
  if (gradePolicyReadiness.gapCount > 0) {
    addItem(blockers, 'GRADE_POLICY_THRESHOLD_GAP', '저장된 2026 등급 기준에 공백 구간이 있습니다.')
  }
  if (gradePolicyReadiness.teamMemberSalesAmbiguity.requiresDecision) {
    addItem(blockers, 'TEAM_MEMBER_SALES_GRADE_POLICY_CONFIRMATION_REQUIRED', 'TEAM_MEMBER_SALES 등급 기준에 HR 확인이 필요합니다.')
  }
}

function collectEvaluatorRoutingReadiness(
  evaluatorRoutingReadiness: Evaluation2026EvaluatorRoutingReadinessResult | null,
  blockers: Evaluation2026ActivationReadinessItem[],
  warnings: Evaluation2026ActivationReadinessItem[]
) {
  if (!evaluatorRoutingReadiness) {
    addItem(warnings, 'EVALUATOR_ROUTING_NOT_CHECKED', '2026 평가자 배정 readiness를 현재 실행 컨텍스트에서 확인하지 못했습니다.', 'warning')
    return
  }

  if (evaluatorRoutingReadiness.summary.blockerCount > 0) {
    addItem(
      blockers,
      'EVALUATOR_ROUTING_UNRESOLVED',
      `평가자 배정 chain blocker가 ${evaluatorRoutingReadiness.summary.blockerCount}건 남아 있습니다.`
    )
  }
}

function collectFeedbackLeadershipReadiness(
  feedbackLeadershipReadiness: Evaluation2026FeedbackLeadershipReadinessResult | null,
  blockers: Evaluation2026ActivationReadinessItem[],
  warnings: Evaluation2026ActivationReadinessItem[]
) {
  if (!feedbackLeadershipReadiness) {
    addItem(warnings, 'FEEDBACK_LEADERSHIP_NOT_CHECKED', '2026 360/리더십 진단 readiness를 현재 실행 컨텍스트에서 확인하지 못했습니다.', 'warning')
    return
  }

  if (feedbackLeadershipReadiness.summary.blockedOrNeedsSetupCount > 0) {
    addItem(
      blockers,
      'FEEDBACK_LEADERSHIP_READINESS_UNRESOLVED',
      `2차 다면평가/리더십 진단 readiness blocker가 ${feedbackLeadershipReadiness.summary.blockedOrNeedsSetupCount}건 남아 있습니다.`
    )
  }
}

function collectLeaderEvaluationReadiness(
  populationDryRun: Evaluation2026ReadinessPopulationDryRun | null,
  warnings: Evaluation2026ActivationReadinessItem[]
) {
  const leaderReadiness = populationDryRun?.leaderEvaluationReadiness
  if (!leaderReadiness) {
    addItem(warnings, 'LEADER_EVALUATION_READINESS_NOT_CHECKED', '2026 리더 평가 readiness를 현재 실행 컨텍스트에서 확인하지 못했습니다.', 'warning')
    return
  }
  if (leaderReadiness.summary.blockerCount > 0) {
    addItem(
      warnings,
      'LEADER_EVALUATION_READINESS_UNRESOLVED',
      `리더 평가 readiness blocker가 ${leaderReadiness.summary.blockerCount}건 남아 있습니다.`,
      'warning'
    )
  }
}

function collectFinalizationCeoReadiness(
  populationDryRun: Evaluation2026ReadinessPopulationDryRun | null,
  warnings: Evaluation2026ActivationReadinessItem[]
) {
  const finalizationReadiness = populationDryRun?.finalizationCeoReadiness
  if (!finalizationReadiness) {
    addItem(warnings, 'FINALIZATION_CEO_READINESS_NOT_CHECKED', '2026 최종 확정 readiness를 현재 실행 컨텍스트에서 확인하지 못했습니다.', 'warning')
    return
  }
  if (finalizationReadiness.summary.finalizationBlockerCount > 0) {
    addItem(
      warnings,
      'FINALIZATION_CEO_READINESS_UNRESOLVED',
      `최종 확정 readiness blocker가 ${finalizationReadiness.summary.finalizationBlockerCount}건 남아 있습니다.`,
      'warning'
    )
  }
}

function canRunPopulationDryRun(db: Evaluation2026ActivationDb): db is Evaluation2026ActivationPopulationDb {
  const candidate = db as Evaluation2026ActivationPopulationDb
  return Boolean(
    typeof candidate.evalCycle?.findUnique === 'function' &&
    typeof candidate.employee?.findMany === 'function' &&
    typeof candidate.personalKpi?.findMany === 'function' &&
    typeof candidate.evaluation?.findMany === 'function' &&
    typeof candidate.department?.findMany === 'function'
  )
}

function canRunEvaluatorRoutingReadiness(db: Evaluation2026ActivationDb) {
  const candidate = db as Evaluation2026ActivationDb
  return Boolean(
    typeof candidate.employee?.findMany === 'function' &&
    typeof candidate.department?.findMany === 'function' &&
    typeof candidate.evaluationAssignment?.findMany === 'function'
  )
}

function canRunFeedbackLeadershipReadiness(db: Evaluation2026ActivationDb) {
  const candidate = db as Evaluation2026ActivationDb
  return Boolean(
    typeof candidate.employee?.findMany === 'function' &&
    typeof candidate.department?.findMany === 'function' &&
    typeof candidate.multiFeedbackRound?.findMany === 'function' &&
    typeof candidate.wordCloud360Cycle?.findMany === 'function'
  )
}

function toSafePopulationDryRunError(error: unknown) {
  if (error instanceof AppError) {
    return `${error.code}: ${error.message}`
  }
  return 'READINESS_POPULATION_DRY_RUN_FAILED: readiness population dry-run을 불러오지 못했습니다.'
}

function condition(params: {
  code: string
  label: string
  ok: boolean
  currentValue: string
  blockerCount?: number
  reason: string
  nextHrAction: string
  notApplicable?: boolean
}): Evaluation2026OfficialActivationGateCondition {
  const status = params.notApplicable
    ? 'NOT_APPLICABLE'
    : params.ok
      ? 'READY'
      : 'BLOCKED'
  const blockerCount = status === 'BLOCKED' ? Math.max(1, params.blockerCount ?? 1) : 0
  return {
    code: params.code,
    label: params.label,
    status,
    currentValue: params.currentValue,
    blockerCount,
    reason: status === 'BLOCKED' ? params.reason : '조건 충족',
    nextHrAction: status === 'BLOCKED' ? params.nextHrAction : '추가 조치 없음',
  }
}

function createGate(params: {
  id: Evaluation2026OfficialActivationGate['id']
  title: string
  requiredConditions: Evaluation2026OfficialActivationGateCondition[]
  nextHrAction: string
  safetyWarning: string
  notApplicable?: boolean
}): Evaluation2026OfficialActivationGate {
  const blockedConditions = params.requiredConditions.filter((item) => item.status === 'BLOCKED')
  const allNotApplicable = params.requiredConditions.every((item) => item.status === 'NOT_APPLICABLE')
  const status: Evaluation2026OfficialActivationGateStatus = params.notApplicable || allNotApplicable
    ? 'NOT_APPLICABLE'
    : blockedConditions.length
      ? 'BLOCKED'
      : 'READY'

  return {
    id: params.id,
    title: params.title,
    status,
    requiredConditions: params.requiredConditions,
    currentBlockerCount: blockedConditions.reduce((sum, item) => sum + item.blockerCount, 0),
    blockedReasons: blockedConditions.map((item) => `${item.label}: ${item.reason}`),
    nextHrAction: blockedConditions.length ? params.nextHrAction : '현재 gate 조건은 충족되었습니다. 공식 실행은 별도 승인 절차에서만 진행하세요.',
    safetyWarning: params.safetyWarning,
  }
}

function gradePolicyBlockerCount(gradePolicyReadiness: Evaluation2026GradePolicyReadinessResult | null) {
  if (!gradePolicyReadiness) return 1
  if (gradePolicyReadiness.persistence.compatibilityIssue) return 1
  if (!gradePolicyReadiness.persistence.available) return 1
  let count = 0
  if (!gradePolicyReadiness.gradePolicyExists) count += 1
  if (!gradePolicyReadiness.gradePolicyGroupsComplete) count += Math.max(1, gradePolicyReadiness.missingRowsCount)
  count += gradePolicyReadiness.differsFromPptCount
  count += gradePolicyReadiness.overlapCount
  count += gradePolicyReadiness.gapCount
  if (gradePolicyReadiness.teamMemberSalesAmbiguity.requiresDecision) count += 1
  return count
}

function scorePolicyViolationCount(populationDryRun: Evaluation2026ReadinessPopulationDryRun | null) {
  const scorePolicy = (populationDryRun as (Evaluation2026ReadinessPopulationDryRun & {
    scorePolicyReadiness?: {
      summary?: {
        violationsCount?: number
        aiExcludedConfirmation?: boolean
      }
    }
  }) | null)?.scorePolicyReadiness
  if (!scorePolicy?.summary) return null
  return Number(scorePolicy.summary.violationsCount ?? 0)
}

function teamKpiBlockerCount(populationDryRun: Evaluation2026ReadinessPopulationDryRun | null) {
  if (!populationDryRun) return null
  const coverage = populationDryRun.teamKpiHrReviewCoverage
  return (
    coverage.pendingReviewCount +
    coverage.needsDiscussionCount +
    coverage.personalKpiOrgGoalWithoutApprovedSourceCount
  )
}

function feedbackLeadershipBlockerCount(
  feedbackLeadershipReadiness: Evaluation2026FeedbackLeadershipReadinessResult | null
) {
  return feedbackLeadershipReadiness?.summary.blockedOrNeedsSetupCount ?? null
}

function leaderEvaluationBlockerCount(populationDryRun: Evaluation2026ReadinessPopulationDryRun | null) {
  return populationDryRun?.leaderEvaluationReadiness?.summary.blockerCount ?? null
}

function finalizationCeoBlockerCount(populationDryRun: Evaluation2026ReadinessPopulationDryRun | null) {
  return populationDryRun?.finalizationCeoReadiness?.summary.finalizationBlockerCount ?? null
}

function salesClassificationMissingCount(params: {
  readiness: EvaluationPreviewReadinessSummary2026
  populationDryRun: Evaluation2026ReadinessPopulationDryRun | null
}) {
  return (
    params.readiness.missingSalesClassificationCount +
    params.readiness.missingOrgMasterDivisionSalesMappingCount +
    (params.populationDryRun?.divisionSalesMappingCoverage.unmappedDivisions ?? 0)
  )
}

function buildEvaluation2026OfficialActivationGates(params: {
  flags: Evaluation2026FeatureFlags
  readiness: EvaluationPreviewReadinessSummary2026
  gradePolicyReadiness: Evaluation2026GradePolicyReadinessResult | null
  evaluatorRoutingReadiness: Evaluation2026EvaluatorRoutingReadinessResult | null
  feedbackLeadershipReadiness: Evaluation2026FeedbackLeadershipReadinessResult | null
  populationDryRun: Evaluation2026ReadinessPopulationDryRun | null
  populationDryRunError: string | null
}): Evaluation2026OfficialActivationGate[] {
  const {
    flags,
    readiness,
    gradePolicyReadiness,
    evaluatorRoutingReadiness,
    feedbackLeadershipReadiness,
    populationDryRun,
    populationDryRunError,
  } = params
  const populationUnavailableReason = populationDryRunError ?? 'readiness population dry-run 결과가 없어 현재 수치를 확인하지 못했습니다.'
  const populationAvailable = Boolean(populationDryRun)
  const populationBlocker = condition({
    code: 'READINESS_POPULATION_DRY_RUN_AVAILABLE',
    label: 'readiness population dry-run 확인',
    ok: populationAvailable,
    currentValue: populationAvailable ? 'available' : 'unavailable',
    reason: populationUnavailableReason,
    nextHrAction: '/evaluation/performance에서 2026 readiness population dry-run을 먼저 확인하세요.',
  })

  const scorePolicyViolations = scorePolicyViolationCount(populationDryRun)
  const scorePolicyResolved = scorePolicyViolations != null && scorePolicyViolations === 0
  const scorePolicyCondition = condition({
    code: 'SCORE_POLICY_READINESS_RESOLVED',
    label: 'score policy readiness blocker 0건',
    ok: scorePolicyResolved,
    currentValue: scorePolicyViolations == null ? 'not checked' : `${scorePolicyViolations}건`,
    blockerCount: scorePolicyViolations ?? 1,
    reason: scorePolicyViolations == null
      ? '성과점수 정책 readiness 결과를 확인할 수 없습니다.'
      : '성과점수 정책 기준 위반이 남아 있습니다.',
    nextHrAction: '성과점수 정책 readiness에서 가중치, category, ORG_GOAL source blocker를 먼저 정리하세요.',
  })

  const gradePolicyCount = gradePolicyBlockerCount(gradePolicyReadiness)
  const gradePolicyResolved = gradePolicyCount === 0
  const gradePolicyCondition = condition({
    code: 'GRADE_POLICY_BLOCKERS_RESOLVED',
    label: 'grade policy blocker 0건',
    ok: gradePolicyResolved,
    currentValue: `${gradePolicyCount}건`,
    blockerCount: gradePolicyCount,
    reason: '등급 기준 저장 정책, PPT 차이, threshold 중첩/공백, TEAM_MEMBER_SALES HR 확인이 남아 있습니다.',
    nextHrAction: '2026 등급 기준 readiness에서 누락/차이/중첩/HR 확인 blocker를 해소하세요.',
  })

  const teamKpiCount = teamKpiBlockerCount(populationDryRun)
  const teamKpiResolved = teamKpiCount != null && teamKpiCount === 0
  const teamKpiCondition = condition({
    code: 'TEAM_KPI_REVIEW_BLOCKERS_RESOLVED',
    label: 'team KPI review blocker 0건',
    ok: teamKpiResolved,
    currentValue: teamKpiCount == null ? 'not checked' : `${teamKpiCount}건`,
    blockerCount: teamKpiCount ?? 1,
    reason: teamKpiCount == null
      ? '팀 KPI HR review coverage를 확인할 수 없습니다.'
      : 'PENDING_REVIEW, NEEDS_DISCUSSION 또는 ORG_GOAL source warning이 남아 있습니다.',
    nextHrAction: '2026 팀 KPI 검토에서 pending/discussion 항목과 ORG_GOAL source warning을 해소하세요.',
  })

  const salesMissingCount = salesClassificationMissingCount({ readiness, populationDryRun })
  const policyCategoryMissingCount = populationDryRun?.policyCategoryMissingCount ?? readiness.missingPolicyCategoryCount
  const confirmedCoverageMissingCount = populationDryRun?.employeesMissingConfirmedPersonalKpiCount ?? null
  const evaluatorRoutingBlockerCount = evaluatorRoutingReadiness?.summary.blockerCount ?? null
  const evaluatorRoutingCondition = condition({
    code: 'EVALUATOR_ASSIGNMENT_CHAIN_READY',
    label: 'evaluator assignment chain complete',
    ok: evaluatorRoutingBlockerCount === 0,
    currentValue: evaluatorRoutingReadiness
      ? `${evaluatorRoutingReadiness.summary.completeEvaluatorChainCount}/${evaluatorRoutingReadiness.summary.activeEmployeeCount} ready · blocker ${evaluatorRoutingBlockerCount}건`
      : 'not checked',
    blockerCount: evaluatorRoutingBlockerCount ?? 1,
    reason: evaluatorRoutingReadiness
      ? 'FIRST/SECOND/FINAL 평가자 chain blocker가 남아 있습니다.'
      : '평가자 배정 readiness를 확인하지 못했습니다.',
    nextHrAction: '/admin/performance-assignments에서 missing FIRST/SECOND/FINAL 및 manual review 항목을 해소하세요.',
  })
  const feedbackLeadershipCount = feedbackLeadershipBlockerCount(feedbackLeadershipReadiness)
  const feedbackLeadershipCondition = condition({
    code: 'FEEDBACK_360_LEADERSHIP_READINESS_READY',
    label: '360 feedback / leadership diagnosis readiness',
    ok: feedbackLeadershipCount === 0,
    currentValue: feedbackLeadershipReadiness
      ? `360 ${feedbackLeadershipReadiness.second360Feedback.status} · leadership ${feedbackLeadershipReadiness.leadershipDiagnosis.status} · blocker ${feedbackLeadershipCount}건`
      : 'not checked',
    blockerCount: feedbackLeadershipCount ?? 1,
    reason: feedbackLeadershipReadiness
      ? '2차 다면평가 또는 리더십 진단의 setup/reviewer/response blocker가 남아 있습니다.'
      : '2차 다면평가/리더십 진단 readiness를 확인하지 못했습니다.',
    nextHrAction: '/admin/performance-calendar에서 360/리더십 readiness의 missing reviewer, missing response, setup blocker를 확인하세요.',
  })
  const leaderEvaluationCount = leaderEvaluationBlockerCount(populationDryRun)
  const leaderEvaluationCondition = condition({
    code: 'LEADER_EVALUATION_READINESS_READY',
    label: 'leader evaluation readiness prerequisites',
    ok: leaderEvaluationCount === 0,
    currentValue: populationDryRun?.leaderEvaluationReadiness
      ? `${populationDryRun.leaderEvaluationReadiness.summary.readyForLeaderReviewCount}/${populationDryRun.leaderEvaluationReadiness.summary.targetEmployeeCount} ready · blocker ${leaderEvaluationCount}건`
      : 'not checked',
    blockerCount: leaderEvaluationCount ?? 1,
    reason: populationDryRun?.leaderEvaluationReadiness
      ? 'SELF 제출, 수행결과/증빙, policyCategory, 평가자 배정 blocker가 남아 있습니다.'
      : '리더 평가 readiness 결과가 없어 현재 상태를 확인하지 못했습니다.',
    nextHrAction: '/evaluation/performance의 2026 리더 평가 readiness에서 blocked row와 missing prerequisite을 확인하세요.',
  })
  const finalizationCeoCount = finalizationCeoBlockerCount(populationDryRun)
  const finalizationSummary = populationDryRun?.finalizationCeoReadiness?.summary
  const finalizationCeoCondition = condition({
    code: 'FINALIZATION_CEO_READINESS_READY',
    label: 'finalization / CEO confirmation readiness',
    ok: finalizationCeoCount === 0,
    currentValue: finalizationSummary
      ? `ready later ${finalizationSummary.readyLaterCount}/${finalizationSummary.finalReviewCandidateCount} · final ${finalizationSummary.finalizationBlockerCount}건 · CEO ${finalizationSummary.ceoConfirmationBlockerCount}건 · calibration ${finalizationSummary.calibrationReadinessBlockerCount}건`
      : 'not checked',
    blockerCount: finalizationCeoCount ?? 1,
    reason: finalizationSummary
      ? '최종 확정, CEO confirmation, calibration readiness blocker가 남아 있습니다.'
      : '최종 확정 readiness 결과가 없어 현재 상태를 확인하지 못했습니다.',
    nextHrAction: '/evaluation/performance의 2026 최종 확정 readiness에서 blocked row와 CEO/calibration blocker를 확인하세요.',
  })
  const sampleWarningCount = populationDryRun?.warnings.filter((warning) =>
    warning.code === 'SAMPLE_DATA_SIGNAL' || warning.code === 'CURRENT_CYCLE_SCOPE_LOOKS_PARTIAL'
  ).reduce((sum, warning) => sum + (warning.count ?? 1), 0) ?? null

  const backfillConditions = [
    condition({
      code: 'OFFICIAL_READINESS_CYCLE_CONFIRMED',
      label: 'official readiness cycle confirmed',
      ok: readiness.cycleScope.isOfficialReadinessTarget,
      currentValue: readiness.cycleScope.isOfficialReadinessTarget ? 'confirmed' : 'not confirmed',
      reason: readiness.cycleScope.warning ?? '공식 readiness cycle이 확정되지 않았습니다.',
      nextHrAction: 'HR/admin이 공식 readiness 대상 cycle을 지정하세요.',
    }),
    condition({
      code: 'NO_TEST_SAMPLE_CYCLE_SIGNAL',
      label: 'test/sample cycle signal 없음',
      ok: sampleWarningCount === 0,
      currentValue: sampleWarningCount == null ? 'not checked' : `${sampleWarningCount}건`,
      blockerCount: sampleWarningCount ?? 1,
      reason: sampleWarningCount == null ? populationUnavailableReason : '테스트/샘플 또는 부분 cycle 의심 신호가 있습니다.',
      nextHrAction: '공식 cycle 범위와 SELF 평가 대상이 실제 운영 대상인지 확인하세요.',
    }),
    populationBlocker,
    condition({
      code: 'CONFIRMED_PERSONAL_KPI_COVERAGE',
      label: 'confirmed PersonalKpi coverage 충분',
      ok: confirmedCoverageMissingCount === 0,
      currentValue: confirmedCoverageMissingCount == null ? 'not checked' : `${confirmedCoverageMissingCount}명 미확정`,
      blockerCount: confirmedCoverageMissingCount ?? 1,
      reason: confirmedCoverageMissingCount == null ? populationUnavailableReason : '확정된 2026 PersonalKpi가 없는 대상자가 남아 있습니다.',
      nextHrAction: 'MBO 작성/제출/리더 검토를 완료하거나 명시적 제외 대상을 정리하세요.',
    }),
    evaluatorRoutingCondition,
    condition({
      code: 'POLICY_CATEGORY_MISSING_ZERO',
      label: 'policyCategory missing 0건',
      ok: policyCategoryMissingCount === 0,
      currentValue: `${policyCategoryMissingCount}건`,
      blockerCount: policyCategoryMissingCount,
      reason: 'ORG_GOAL / PROJECT_T / PROJECT_K / DAILY_WORK 미분류 항목이 남아 있습니다.',
      nextHrAction: '2026 정책 매핑 관리에서 미분류 항목을 HR이 확정하세요.',
    }),
    condition({
      code: 'SALES_NON_SALES_MISSING_ZERO',
      label: 'SALES/NON_SALES missing 0건',
      ok: salesMissingCount === 0,
      currentValue: `${salesMissingCount}건`,
      blockerCount: salesMissingCount,
      reason: 'division 또는 대상자 영업/비영업 분류가 남아 있습니다.',
      nextHrAction: 'Division 영업/비영업 및 부서/직원 override를 확정하세요.',
    }),
    teamKpiCondition,
    gradePolicyCondition,
    scorePolicyCondition,
    condition({
      code: 'DRY_RUN_REVIEWED_HR_APPROVED',
      label: 'dry-run reviewed and HR approved',
      ok: flags.hrApprovalConfirmed,
      currentValue: flags.hrApprovalConfirmed ? 'confirmed' : 'not confirmed',
      reason: '공식 전환 전 HR 승인 flag가 확인되지 않았습니다.',
      nextHrAction: 'HR이 dry-run 결과를 검토하고 별도 승인 절차를 완료하세요.',
    }),
    condition({
      code: 'DB_BACKUP_CONFIRMED',
      label: 'DB backup confirmed',
      ok: false,
      currentValue: 'not tracked',
      reason: 'DB backup 확인 metadata가 아직 시스템에 없습니다.',
      nextHrAction: '운영 DB 백업 완료 여부를 수동으로 확인하고 실행 runbook에 기록하세요.',
    }),
  ]

  const aiGateConditions = [
    condition({
      code: 'AI_COMPETENCY_PASS_FAIL_POLICY_CONFIRMED',
      label: 'AI 활용평가 Pass/Fail 별도 운영 정책 확인',
      ok: true,
      currentValue: 'Pass/Fail separate from annual score',
      reason: 'AI 활용평가 별도 운영 정책을 확인할 수 없습니다.',
      nextHrAction: 'AI 활용평가가 연간 업적평가 점수에서 제외되는지 HR 정책 문서와 맞춰 확인하세요.',
    }),
    condition({
      code: 'AI_READINESS_SUMMARY_AVAILABLE',
      label: 'AI readiness summary available',
      ok: readiness.aiInsufficientDataCount >= 0,
      currentValue: `AI 증빙 부족 ${readiness.aiInsufficientDataCount}건`,
      reason: 'AI readiness summary를 확인할 수 없습니다.',
      nextHrAction: '/evaluation/ai-competency/admin에서 대상자/제출/Pass/Fail summary를 확인하세요.',
    }),
    condition({
      code: 'NO_TOTAL_SCORE_DEPENDENCY',
      label: 'Evaluation.totalScore 의존 없음',
      ok: true,
      currentValue: 'separate readiness',
      reason: 'AI Pass/Fail이 totalScore와 분리되어야 합니다.',
      nextHrAction: 'AI 활용평가 결과를 annual score 계산에 연결하지 마세요.',
    }),
    condition({
      code: 'AI_EXCLUSION_FLAG_STILL_FALSE',
      label: 'AI score exclusion feature flag still false',
      ok: !flags.aiScoreExclusionEnabled,
      currentValue: flags.aiScoreExclusionEnabled ? 'enabled' : 'disabled',
      reason: '공식 AI score exclusion flag가 이미 켜져 있습니다.',
      nextHrAction: '최종 activation 전에는 flag를 false로 유지하고 runbook 승인 후 별도 전환하세요.',
    }),
  ]
  const aiGate = createGate({
    id: 'AI_SCORE_EXCLUSION',
    title: 'AI score exclusion gate',
    requiredConditions: aiGateConditions,
    nextHrAction: 'AI 활용평가 Pass/Fail 정책과 readiness summary를 확인하고, 공식 flag는 최종 전환 전까지 false로 유지하세요.',
    safetyWarning: '이 gate는 AI 활용평가를 연간 업적평가 점수에서 제외할 준비 상태만 확인하며 공식 totalScore를 계산하지 않습니다.',
  })

  const scoringConditions = [
    condition({
      code: 'BACKFILL_APPLIED_OR_NOT_REQUIRED',
      label: 'backfill applied or explicitly not required',
      ok: flags.backfillApplied || flags.backfillExcluded,
      currentValue: flags.backfillApplied ? 'applied' : flags.backfillExcluded ? 'explicitly excluded' : 'not confirmed',
      reason: 'backfill 적용 또는 명시적 제외 승인이 없습니다.',
      nextHrAction: 'backfill dry-run 결과를 확정하고 apply 또는 제외 승인 상태를 기록하세요.',
    }),
    scorePolicyCondition,
    leaderEvaluationCondition,
    condition({
      code: 'AI_EXCLUSION_DECISION_READY',
      label: 'AI exclusion decision confirmed',
      ok: aiGate.status === 'READY',
      currentValue: aiGate.status,
      blockerCount: aiGate.currentBlockerCount || 1,
      reason: 'AI 활용평가 Pass/Fail 분리 운영 또는 flag 상태 확인이 끝나지 않았습니다.',
      nextHrAction: 'AI score exclusion gate의 blocker를 먼저 해소하세요.',
    }),
    condition({
      code: 'HR_APPROVAL_CONFIRMED',
      label: 'HR approval confirmed',
      ok: flags.hrApprovalConfirmed,
      currentValue: flags.hrApprovalConfirmed ? 'confirmed' : 'not confirmed',
      reason: '공식 scoring 전환 HR 승인이 없습니다.',
      nextHrAction: 'HR 승인 절차를 완료하고 승인 근거를 남기세요.',
    }),
    condition({
      code: 'OFFICIAL_SCORING_FLAG_STILL_FALSE',
      label: 'official scoring feature flag still false',
      ok: !flags.officialScoringEnabled,
      currentValue: flags.officialScoringEnabled ? 'enabled' : 'disabled',
      reason: '공식 scoring flag가 이미 켜져 있습니다.',
      nextHrAction: '최종 activation 전에는 official scoring flag를 false로 유지하세요.',
    }),
  ]
  const scoringGate = createGate({
    id: 'OFFICIAL_SCORING',
    title: 'Official scoring gate',
    requiredConditions: scoringConditions,
    nextHrAction: 'backfill 상태, score policy readiness, AI 제외 방침, HR 승인을 모두 확인하세요.',
    safetyWarning: '이 gate는 official scoring 활성화 여부만 점검하며 Evaluation.totalScore를 쓰지 않습니다.',
  })

  const gradeConditions = [
    condition({
      code: 'OFFICIAL_SCORING_READY',
      label: 'official scoring ready',
      ok: scoringGate.status === 'READY',
      currentValue: scoringGate.status,
      blockerCount: scoringGate.currentBlockerCount || 1,
      reason: 'official scoring gate가 아직 READY가 아닙니다.',
      nextHrAction: 'official scoring gate blocker를 먼저 해소하세요.',
    }),
    gradePolicyCondition,
    condition({
      code: 'TEAM_MEMBER_SALES_AMBIGUITY_RESOLVED',
      label: 'TEAM_MEMBER_SALES ambiguity resolved',
      ok: Boolean(gradePolicyReadiness && !gradePolicyReadiness.teamMemberSalesAmbiguity.requiresDecision),
      currentValue: gradePolicyReadiness?.teamMemberSalesAmbiguity.requiresDecision ? 'unresolved' : gradePolicyReadiness ? 'resolved' : 'not checked',
      reason: 'TEAM_MEMBER_SALES Super/Outstanding 기준 HR 확인이 남아 있습니다.',
      nextHrAction: '2026 등급 기준 readiness에서 TEAM_MEMBER_SALES 기준을 HR이 확정하세요.',
    }),
    condition({
      code: 'GRADE_THRESHOLDS_VERIFIED',
      label: 'grade thresholds verified',
      ok: gradePolicyResolved,
      currentValue: gradePolicyResolved ? 'verified' : `${gradePolicyCount}건 blocker`,
      blockerCount: gradePolicyCount,
      reason: '등급 threshold 누락/차이/중첩/공백이 남아 있습니다.',
      nextHrAction: '저장 정책과 PPT 기준 차이를 확인하고 HR 확정 metadata를 저장하세요.',
    }),
    feedbackLeadershipCondition,
    finalizationCeoCondition,
    condition({
      code: 'CALIBRATION_FINALIZATION_READY',
      label: 'calibration/finalization process ready',
      ok: false,
      currentValue: 'not tracked',
      reason: '보정/최종화 운영 절차 readiness metadata가 아직 없습니다.',
      nextHrAction: '보정/CEO finalization runbook과 승인 책임자를 확정하세요.',
    }),
    condition({
      code: 'OFFICIAL_GRADE_FLAG_STILL_FALSE',
      label: 'official grade feature flag still false',
      ok: !flags.officialGradeEnabled,
      currentValue: flags.officialGradeEnabled ? 'enabled' : 'disabled',
      reason: '공식 grade flag가 이미 켜져 있습니다.',
      nextHrAction: '최종 activation 전에는 official grade flag를 false로 유지하세요.',
    }),
  ]
  const gradeGate = createGate({
    id: 'OFFICIAL_GRADE',
    title: 'Official grade gate',
    requiredConditions: gradeConditions,
    nextHrAction: 'official scoring readiness, 등급 기준, TEAM_MEMBER_SALES 기준, 보정/최종화 절차를 모두 확인하세요.',
    safetyWarning: '이 gate는 grade 계산 준비만 확인하며 Evaluation.gradeId를 쓰지 않습니다.',
  })

  const totalScoreGate = createGate({
    id: 'EVALUATION_TOTAL_SCORE_WRITE',
    title: 'Evaluation.totalScore write gate',
    requiredConditions: [
      condition({
        code: 'OFFICIAL_SCORING_ACTIVE',
        label: 'official scoring active',
        ok: flags.officialScoringEnabled,
        currentValue: flags.officialScoringEnabled ? 'enabled' : 'disabled',
        reason: 'official scoring flag가 아직 비활성화되어 있습니다.',
        nextHrAction: '모든 scoring gate가 READY인 뒤 별도 activation 절차에서만 flag를 켜세요.',
      }),
      condition({
        code: 'EVALUATION_INPUTS_FINALIZED',
        label: 'evaluation inputs finalized',
        ok: readiness.blockedCount === 0 && (populationDryRun?.employeesMissingConfirmedPersonalKpiCount ?? 1) === 0,
        currentValue: `preview blocked ${readiness.blockedCount}건`,
        blockerCount: readiness.blockedCount || 1,
        reason: '평가 입력 또는 MBO 확정 coverage가 아직 완료되지 않았습니다.',
        nextHrAction: 'MBO, policyCategory, score policy blocker를 모두 정리하세요.',
      }),
      condition({
        code: 'CALCULATION_SAMPLE_VERIFIED',
        label: 'calculation sample verified',
        ok: scorePolicyResolved,
        currentValue: scorePolicyViolations == null ? 'not checked' : `${scorePolicyViolations}건 blocker`,
        blockerCount: scorePolicyViolations ?? 1,
        reason: '공식 계산 샘플 검증 metadata가 없습니다.',
        nextHrAction: '대표 샘플로 조직 30%/개인 70% 계산 결과를 HR이 검증하세요.',
      }),
      condition({
        code: 'HR_FINAL_APPROVAL',
        label: 'HR final approval',
        ok: flags.hrApprovalConfirmed,
        currentValue: flags.hrApprovalConfirmed ? 'confirmed' : 'not confirmed',
        reason: 'totalScore write 전 HR final approval이 없습니다.',
        nextHrAction: 'HR final approval을 확보하세요.',
      }),
      condition({
        code: 'NO_GRADE_WRITE_YET',
        label: 'no grade write yet',
        ok: !flags.officialGradeEnabled,
        currentValue: flags.officialGradeEnabled ? 'grade flag enabled' : 'grade flag disabled',
        reason: 'grade write가 totalScore 확정 전에 활성화되어 있습니다.',
        nextHrAction: 'totalScore 확정 전에는 official grade flag를 false로 유지하세요.',
      }),
    ],
    nextHrAction: 'official scoring 활성화, 입력 확정, 계산 샘플 검증, HR final approval을 완료하세요.',
    safetyWarning: '이 gate는 totalScore write 가능 조건만 표시하며 현재 요청에서는 Evaluation.totalScore를 변경하지 않습니다.',
  })

  const gradeIdGate = createGate({
    id: 'EVALUATION_GRADE_ID_WRITE',
    title: 'Evaluation.gradeId write gate',
    requiredConditions: [
      condition({
        code: 'TOTAL_SCORE_FINALIZED',
        label: 'totalScore finalized',
        ok: false,
        currentValue: 'not tracked',
        reason: 'totalScore finalization metadata가 아직 없습니다.',
        nextHrAction: '공식 totalScore 계산 결과를 HR이 확정한 뒤 gradeId gate를 다시 확인하세요.',
      }),
      condition({
        code: 'GRADE_CALCULATION_VERIFIED',
        label: 'grade calculation verified',
        ok: gradePolicyResolved,
        currentValue: gradePolicyResolved ? 'grade policy ready' : `${gradePolicyCount}건 blocker`,
        blockerCount: gradePolicyCount,
        reason: 'grade calculation 검증 전 등급 기준 blocker가 남아 있습니다.',
        nextHrAction: '등급 기준과 샘플 grade 계산 결과를 검증하세요.',
      }),
      condition({
        code: 'CALIBRATION_CEO_FINALIZATION_COMPLETE',
        label: 'calibration/CEO finalization complete',
        ok: false,
        currentValue: 'not tracked',
        reason: 'calibration/CEO finalization 완료 metadata가 없습니다.',
        nextHrAction: '보정 및 CEO 최종 승인 절차를 완료한 뒤 기록하세요.',
      }),
      condition({
        code: 'HR_FINAL_APPROVAL',
        label: 'HR final approval',
        ok: flags.hrApprovalConfirmed,
        currentValue: flags.hrApprovalConfirmed ? 'confirmed' : 'not confirmed',
        reason: 'gradeId write 전 HR final approval이 없습니다.',
        nextHrAction: 'HR final approval을 확보하세요.',
      }),
    ],
    nextHrAction: 'totalScore 확정, grade 계산 검증, calibration/CEO finalization, HR final approval을 모두 완료하세요.',
    safetyWarning: '이 gate는 gradeId write 가능 조건만 표시하며 현재 요청에서는 Evaluation.gradeId를 변경하지 않습니다.',
  })

  return [
    createGate({
      id: 'BACKFILL_APPLY',
      title: 'Backfill apply gate',
      requiredConditions: backfillConditions,
      nextHrAction: 'MBO coverage, policyCategory, SALES/NON_SALES, team KPI, grade/score policy, dry-run 승인, DB backup을 모두 확인하세요.',
      safetyWarning: '이 gate는 backfill --apply 실행 전 조건만 표시하며 backfill을 실행하지 않습니다.',
      notApplicable: flags.backfillExcluded,
    }),
    scoringGate,
    aiGate,
    gradeGate,
    totalScoreGate,
    gradeIdGate,
  ]
}

function gateById(
  gates: Evaluation2026OfficialActivationGate[],
  id: Evaluation2026OfficialActivationGate['id']
) {
  return gates.find((gate) => gate.id === id)
}

function blockedConditionCount(
  gate: Evaluation2026OfficialActivationGate | undefined,
  codes?: string[]
) {
  if (!gate) return 1
  const codeSet = codes ? new Set(codes) : null
  const blockedConditions = gate.requiredConditions.filter((conditionItem) =>
    conditionItem.status === 'BLOCKED' && (!codeSet || codeSet.has(conditionItem.code))
  )
  return blockedConditions.reduce((sum, conditionItem) => sum + conditionItem.blockerCount, 0)
}

function statusFromGate(
  gate: Evaluation2026OfficialActivationGate | undefined,
  readyStatus: Exclude<Evaluation2026OfficialActivationRunbookStatus, 'BLOCKED' | 'NOT_APPLICABLE'>
): Evaluation2026OfficialActivationRunbookStatus {
  if (!gate) return 'BLOCKED'
  if (gate.status === 'NOT_APPLICABLE') return 'NOT_APPLICABLE'
  if (gate.status === 'BLOCKED') return 'BLOCKED'
  return readyStatus
}

function buildRunbookSection(params: Evaluation2026OfficialActivationRunbookSection) {
  return params
}

function buildRunbookMarkdown(
  sections: Evaluation2026OfficialActivationRunbookSection[],
  currentPosition: Evaluation2026OfficialActivationRunbook['currentPosition']
) {
  const sectionMarkdown = sections.map((section) => [
    `### ${section.title}`,
    `- Status: ${section.status}`,
    `- Blockers: ${section.currentBlockerCount}`,
    `- Source panels: ${section.sourceReadinessPanels.join(', ')}`,
    `- Next HR action: ${section.nextHrAction}`,
    `- Next developer action: ${section.nextDeveloperAction}`,
    `- Required checks: ${section.requiredChecks.join('; ')}`,
    `- Prohibited actions: ${section.prohibitedActions.join('; ')}`,
  ].join('\n'))

  return [
    '# 2026 공식 전환 Runbook',
    '',
    '이 화면은 공식 전환 실행 순서를 읽기 전용으로 안내합니다. backfill, feature flag, 공식 점수, 공식 등급은 실행하지 않습니다.',
    '',
    `현재 단계: ${currentPosition.currentStage}`,
    `다음 필요 단계: ${currentPosition.nextRequiredStep}`,
    `다음 실행 검토 단계: ${currentPosition.nextExecutableStep}`,
    `아직 금지: ${currentPosition.prohibitedActions.join(', ')}`,
    '',
    ...sectionMarkdown,
  ].join('\n')
}

function buildRunbookTsv(sections: Evaluation2026OfficialActivationRunbookSection[]) {
  const header = [
    'section',
    'status',
    'blockerCount',
    'sourceReadinessPanels',
    'nextHrAction',
    'nextDeveloperAction',
    'prohibitedActions',
  ].join('\t')
  const rows = sections.map((section) => [
    section.title,
    section.status,
    String(section.currentBlockerCount),
    section.sourceReadinessPanels.join('; '),
    section.nextHrAction,
    section.nextDeveloperAction,
    section.prohibitedActions.join('; '),
  ].join('\t'))
  return [header, ...rows].join('\n')
}

function buildEvaluation2026OfficialActivationRunbook(params: {
  flags: Evaluation2026FeatureFlags
  officialActivationGates: Evaluation2026OfficialActivationGate[]
}): Evaluation2026OfficialActivationRunbook {
  const { flags, officialActivationGates } = params
  const backfillGate = gateById(officialActivationGates, 'BACKFILL_APPLY')
  const scoringGate = gateById(officialActivationGates, 'OFFICIAL_SCORING')
  const aiGate = gateById(officialActivationGates, 'AI_SCORE_EXCLUSION')
  const gradeGate = gateById(officialActivationGates, 'OFFICIAL_GRADE')
  const totalScoreGate = gateById(officialActivationGates, 'EVALUATION_TOTAL_SCORE_WRITE')
  const gradeIdGate = gateById(officialActivationGates, 'EVALUATION_GRADE_ID_WRITE')

  const dryRunBlockerCodes = [
    'OFFICIAL_READINESS_CYCLE_CONFIRMED',
    'NO_TEST_SAMPLE_CYCLE_SIGNAL',
    'READINESS_POPULATION_DRY_RUN_AVAILABLE',
  ]
  const dryRunBlockerCount = blockedConditionCount(backfillGate, dryRunBlockerCodes)
  const dryRunStatus: Evaluation2026OfficialActivationRunbookStatus =
    dryRunBlockerCount > 0 ? 'BLOCKED' : 'READY_FOR_REVIEW'
  const scoringAndAiBlockerCount =
    (scoringGate?.currentBlockerCount ?? 1) + (aiGate?.currentBlockerCount ?? 1)
  const gradeAndTotalScoreBlockerCount =
    (gradeGate?.currentBlockerCount ?? 1) + (totalScoreGate?.currentBlockerCount ?? 1)

  const sections = [
    buildRunbookSection({
      id: 'PRECONDITIONS',
      title: 'A. Preconditions',
      status: statusFromGate(backfillGate, 'READY_FOR_REVIEW'),
      requiredChecks: [
        'production DB backup required',
        'official readiness cycle confirmed',
        'no test/sample cycle signal',
        'active employee target scope confirmed',
        'MBO coverage sufficient',
        'policyCategory missing count = 0',
        'Team KPI HR review blockers = 0',
        'evaluator routing blockers = 0',
        'result-writing blockers resolved',
        'leader evaluation readiness blockers resolved',
        'finalization/CEO readiness blockers resolved',
        'grade policy blockers = 0',
        'score policy blockers = 0',
        'AI exclusion policy confirmed',
        '360/leadership readiness checked',
      ],
      currentBlockerCount: backfillGate?.currentBlockerCount ?? 1,
      sourceReadinessPanels: [
        '2026 readiness population dry-run',
        '2026 정책 매핑 관리',
        '2026 팀 KPI 검토',
        '2026 평가자 배정 readiness QA',
        '2026 수행결과 작성 readiness',
        '2026 리더 평가 readiness',
        '2026 최종 확정 readiness',
        '2026 grade/score/AI/360 readiness',
      ],
      nextHrAction: backfillGate?.nextHrAction ?? '공식 readiness cycle과 dry-run 결과를 먼저 확인하세요.',
      nextDeveloperAction: 'Do not run migrations/backfill/apply. Verify the production branch and collect read-only blocker evidence only.',
      prohibitedActions: OFFICIAL_ACTIVATION_PROHIBITED_ACTIONS_2026,
    }),
    buildRunbookSection({
      id: 'BACKFILL_DRY_RUN',
      title: 'B. Backfill dry-run',
      status: dryRunStatus,
      requiredChecks: [
        'run dry-run first',
        'review Evaluation/EvaluationItem expected changes',
        'confirm no unexpected totalScore/gradeId writes',
        'confirm no unexpected official scoring activation',
        'HR approval required',
      ],
      currentBlockerCount: dryRunBlockerCount,
      sourceReadinessPanels: ['2026 readiness population dry-run', '2026 공식 전환 Gate'],
      nextHrAction: dryRunStatus === 'BLOCKED'
        ? '공식 cycle과 dry-run 결과가 확인될 때까지 HR 검토를 완료하지 마세요.'
        : 'dry-run 출력과 예상 Evaluation/EvaluationItem 변경 범위를 HR이 검토하세요.',
      nextDeveloperAction: 'Run only preview/dry-run commands when explicitly approved; archive output and do not apply.',
      prohibitedActions: OFFICIAL_ACTIVATION_PROHIBITED_ACTIONS_2026,
    }),
    buildRunbookSection({
      id: 'BACKFILL_APPLY',
      title: 'C. Backfill apply',
      status: statusFromGate(backfillGate, 'READY_LATER'),
      requiredChecks: [
        'only after dry-run approval',
        'only after backup confirmation',
        'only explicit developer/HR approval',
        'no automatic apply from UI',
      ],
      currentBlockerCount: backfillGate?.currentBlockerCount ?? 1,
      sourceReadinessPanels: ['Backfill apply gate', 'DB backup confirmation', 'HR approval checklist'],
      nextHrAction: backfillGate?.nextHrAction ?? 'dry-run 승인과 DB backup 확인 전에는 apply를 승인하지 마세요.',
      nextDeveloperAction: 'Keep apply outside the UI and only use a controlled CLI/runbook after explicit approval.',
      prohibitedActions: OFFICIAL_ACTIVATION_PROHIBITED_ACTIONS_2026,
    }),
    buildRunbookSection({
      id: 'OFFICIAL_SCORING_ACTIVATION',
      title: 'D. Official scoring activation',
      status: statusFromGate(scoringGate, 'READY_LATER'),
      requiredChecks: [
        'only after backfill apply or explicit no-backfill decision',
        'AI score exclusion must be confirmed before scoring',
        'sample calculation must be verified',
        'feature flag should remain false until final activation',
      ],
      currentBlockerCount: scoringAndAiBlockerCount,
      sourceReadinessPanels: ['Official scoring gate', 'AI score exclusion gate', 'Score policy readiness simulator'],
      nextHrAction: scoringGate?.nextHrAction ?? 'backfill/AI/score policy/HR approval blocker를 해소하세요.',
      nextDeveloperAction: 'Do not change feature flags. Prepare scoring activation steps as a separate reviewed operation only.',
      prohibitedActions: OFFICIAL_ACTIVATION_PROHIBITED_ACTIONS_2026,
    }),
    buildRunbookSection({
      id: 'EVALUATION_TOTAL_SCORE_WRITE',
      title: 'E. Evaluation.totalScore write',
      status: statusFromGate(totalScoreGate, 'READY_LATER'),
      requiredChecks: [
        'only after evaluation inputs and leader reviews are finalized',
        'requires calculation verification and HR approval',
        'grade write must remain separate',
      ],
      currentBlockerCount: totalScoreGate?.currentBlockerCount ?? 1,
      sourceReadinessPanels: ['Evaluation.totalScore write gate', 'Leader evaluation readiness', 'Finalization/CEO readiness'],
      nextHrAction: totalScoreGate?.nextHrAction ?? 'official scoring 활성화와 계산 샘플 검증 전에는 totalScore write를 승인하지 마세요.',
      nextDeveloperAction: 'Do not write Evaluation.totalScore in this readiness flow; keep grade writes separated.',
      prohibitedActions: OFFICIAL_ACTIVATION_PROHIBITED_ACTIONS_2026,
    }),
    buildRunbookSection({
      id: 'OFFICIAL_GRADE_ACTIVATION',
      title: 'F. Official grade activation',
      status: statusFromGate(gradeGate, 'READY_LATER'),
      requiredChecks: [
        'only after totalScore is stable',
        'grade policy verified',
        'calibration/finalization process ready',
        'CEO confirmation process ready',
      ],
      currentBlockerCount: gradeAndTotalScoreBlockerCount,
      sourceReadinessPanels: ['Official grade gate', 'Grade policy readiness', 'Finalization/CEO readiness'],
      nextHrAction: gradeGate?.nextHrAction ?? 'totalScore 안정화, 등급 정책, 보정/CEO 절차를 확인하세요.',
      nextDeveloperAction: 'Do not enable official grade calculation or grade write flags in this runbook screen.',
      prohibitedActions: OFFICIAL_ACTIVATION_PROHIBITED_ACTIONS_2026,
    }),
    buildRunbookSection({
      id: 'EVALUATION_GRADE_ID_WRITE',
      title: 'G. Evaluation.gradeId write',
      status: statusFromGate(gradeIdGate, 'READY_LATER'),
      requiredChecks: [
        'last step only',
        'after calibration and CEO/final confirmation',
        'adjustment reason required for changes',
        'final approval required',
      ],
      currentBlockerCount: gradeIdGate?.currentBlockerCount ?? 1,
      sourceReadinessPanels: ['Evaluation.gradeId write gate', 'Finalization/CEO readiness', 'Calibration approval'],
      nextHrAction: gradeIdGate?.nextHrAction ?? 'totalScore, grade calculation, calibration, CEO confirmation 완료 전에는 gradeId write를 승인하지 마세요.',
      nextDeveloperAction: 'Keep gradeId writes last and separate from scoring/totalScore operations.',
      prohibitedActions: OFFICIAL_ACTIVATION_PROHIBITED_ACTIONS_2026,
    }),
  ]

  const blockedSectionCount = sections.filter((section) => section.status === 'BLOCKED').length
  const readyForReviewSectionCount = sections.filter((section) => section.status === 'READY_FOR_REVIEW').length
  const readyLaterSectionCount = sections.filter((section) => section.status === 'READY_LATER').length
  const notApplicableSectionCount = sections.filter((section) => section.status === 'NOT_APPLICABLE').length
  const totalBlockerCount = sections.reduce((sum, section) => sum + section.currentBlockerCount, 0)
  const firstBlockedSection = sections.find((section) => section.status === 'BLOCKED')
  const firstReviewSection = sections.find((section) => section.status === 'READY_FOR_REVIEW')
  const nextExecutableStep = firstReviewSection
    ? firstReviewSection.title
    : '공식 실행 가능 단계 없음 - blocker 해소 후 다시 확인'
  const currentPosition: Evaluation2026OfficialActivationRunbook['currentPosition'] = {
    currentStage: blockedSectionCount > 0 ? 'Readiness preparation' : 'Runbook review ready',
    nextRequiredStep: firstBlockedSection?.nextHrAction ?? 'HR approval checklist와 developer execution checklist를 대조하세요.',
    nextExecutableStep,
    blockerCount: totalBlockerCount,
    prohibitedActions: OFFICIAL_ACTIVATION_PROHIBITED_ACTIONS_2026,
    noExecutionButtonsInUi: true,
  }
  const markdown = buildRunbookMarkdown(sections, currentPosition)
  const tsv = buildRunbookTsv(sections)

  return {
    mode: 'READ_ONLY',
    currentPosition,
    sections,
    hrApprovalChecklist: HR_APPROVAL_CHECKLIST_2026,
    developerExecutionChecklist: DEVELOPER_EXECUTION_CHECKLIST_2026,
    copyPayloads: {
      markdown,
      blockerSummary: [
        `현재 단계: ${currentPosition.currentStage}`,
        `blocker count: ${totalBlockerCount}`,
        `다음 필요 단계: ${currentPosition.nextRequiredStep}`,
        `아직 금지: ${OFFICIAL_ACTIVATION_PROHIBITED_ACTIONS_2026.join(', ')}`,
      ].join('\n'),
      hrApprovalChecklist: HR_APPROVAL_CHECKLIST_2026.map((item) => `- [ ] ${item}`).join('\n'),
      developerExecutionChecklist: DEVELOPER_EXECUTION_CHECKLIST_2026.map((item) => `- [ ] ${item}`).join('\n'),
      prohibitedActions: OFFICIAL_ACTIVATION_PROHIBITED_ACTIONS_2026.map((item) => `- ${item}`).join('\n'),
      tsv,
    },
    summary: {
      sectionCount: sections.length,
      blockedSectionCount,
      readyForReviewSectionCount,
      readyLaterSectionCount,
      notApplicableSectionCount,
      totalBlockerCount,
      nextExecutableStep,
      noExecutionButtonsInUi: true,
      officialScoringEnabled: flags.officialScoringEnabled,
      officialGradeEnabled: flags.officialGradeEnabled,
      officialAiScoreExclusionEnabled: flags.aiScoreExclusionEnabled,
    },
    safety: {
      writesPerformed: false,
      backfillExecuted: false,
      migrationsRun: false,
      featureFlagsChanged: false,
      totalScoreChanged: false,
      gradeIdChanged: false,
      evaluationsCreated: 0,
      evaluationItemsCreated: 0,
    },
  }
}

export async function getEvaluation2026ActivationReadiness(params: {
  db?: Evaluation2026ActivationDb
  year?: number
  cycleId?: string
  limit?: number
  env?: NodeJS.ProcessEnv
  flags?: Evaluation2026FeatureFlags
  migrationStatus?: Evaluation2026MigrationReadiness
  readinessSummary?: EvaluationPreviewReadinessSummary2026
  gradePolicyReadiness?: Evaluation2026GradePolicyReadinessResult | null
  evaluatorRoutingReadiness?: Evaluation2026EvaluatorRoutingReadinessResult | null
  feedbackLeadershipReadiness?: Evaluation2026FeedbackLeadershipReadinessResult | null
  populationDryRun?: Evaluation2026ReadinessPopulationDryRun | null
}): Promise<Evaluation2026ActivationReadinessResult> {
  const db = params.db ?? prisma
  const flags = params.flags ?? get2026EvaluationFeatureFlags(params.env)
  const migration =
    params.migrationStatus ?? await verifyEvaluation2026PolicyMigrationReadiness(db)
  const readiness =
    params.readinessSummary ??
    await getEvaluationPreviewReadinessSummary2026({
      db,
      year: params.year,
      cycleId: params.cycleId,
      limit: params.limit,
    })
  const canCheckGradePolicy =
    params.gradePolicyReadiness !== undefined ||
    Boolean((db as Evaluation2026ActivationDb & { evaluationGradePolicy?: unknown }).evaluationGradePolicy)
  const gradePolicyReadiness =
    params.gradePolicyReadiness ??
    (canCheckGradePolicy
      ? await getEvaluation2026GradePolicyReadiness({
          db: db as never,
          evalCycleId: params.cycleId,
          year: params.year,
          env: params.env,
        })
      : null)
  let populationDryRun: Evaluation2026ReadinessPopulationDryRun | null = params.populationDryRun ?? null
  let populationDryRunError: string | null = null
  const populationCycleId = params.cycleId ?? readiness.cycleScope.selectedCycleId ?? undefined
  if (params.populationDryRun === undefined && populationCycleId && canRunPopulationDryRun(db)) {
    try {
      populationDryRun = await getEvaluation2026ReadinessPopulationDryRun({
        db: db as never,
        evalCycleId: populationCycleId,
        limit: params.limit,
        env: params.env,
      })
    } catch (error) {
      populationDryRun = null
      populationDryRunError = toSafePopulationDryRunError(error)
    }
  }
  let evaluatorRoutingReadiness: Evaluation2026EvaluatorRoutingReadinessResult | null =
    params.evaluatorRoutingReadiness ?? null
  if (params.evaluatorRoutingReadiness === undefined && populationCycleId && canRunEvaluatorRoutingReadiness(db)) {
    try {
      evaluatorRoutingReadiness = await getEvaluation2026EvaluatorRoutingReadiness({
        db: db as never,
        evalCycleId: populationCycleId,
      })
    } catch {
      evaluatorRoutingReadiness = null
    }
  }
  let feedbackLeadershipReadiness: Evaluation2026FeedbackLeadershipReadinessResult | null =
    params.feedbackLeadershipReadiness ?? null
  if (params.feedbackLeadershipReadiness === undefined && populationCycleId && canRunFeedbackLeadershipReadiness(db)) {
    try {
      feedbackLeadershipReadiness = await getEvaluation2026FeedbackLeadershipReadiness({
        db: db as never,
        evalCycleId: populationCycleId,
      })
    } catch {
      feedbackLeadershipReadiness = null
    }
  }

  const blockers: Evaluation2026ActivationReadinessItem[] = []
  const warnings: Evaluation2026ActivationReadinessItem[] = []
  collectFlagReadiness(flags, blockers, warnings)
  collectMigrationReadiness(migration, blockers, warnings)
  collectPreviewReadiness(readiness, blockers, warnings)
  collectGradePolicyReadiness(gradePolicyReadiness, blockers, warnings)
  collectEvaluatorRoutingReadiness(evaluatorRoutingReadiness, blockers, warnings)
  collectFeedbackLeadershipReadiness(feedbackLeadershipReadiness, blockers, warnings)
  collectLeaderEvaluationReadiness(populationDryRun, warnings)
  collectFinalizationCeoReadiness(populationDryRun, warnings)
  const officialActivationGates = buildEvaluation2026OfficialActivationGates({
    flags,
    readiness,
    gradePolicyReadiness,
    evaluatorRoutingReadiness,
    feedbackLeadershipReadiness,
    populationDryRun,
    populationDryRunError,
  })
  const officialActivationRunbook = buildEvaluation2026OfficialActivationRunbook({
    flags,
    officialActivationGates,
  })
  const integratedReadinessSnapshot = buildEvaluation2026IntegratedReadinessSnapshot({
    flags,
    readiness,
    gradePolicyReadiness,
    evaluatorRoutingReadiness,
    feedbackLeadershipReadiness,
    populationDryRun,
    populationDryRunError,
    officialActivationGates,
    officialActivationRunbook,
  })
  const readinessActionPlan = buildEvaluation2026ReadinessActionPlan(integratedReadinessSnapshot)
  const readinessExecutionBoard = buildEvaluation2026ReadinessExecutionBoard({
    integratedReadinessSnapshot,
    readinessActionPlan,
    officialActivationRunbook,
    officialActivationGates,
  })

  return {
    policyVersion: EVALUATION_POLICY_2026.version,
    checkedAt: new Date().toISOString(),
    canActivate: blockers.length === 0 && is2026OfficialActivationAllowed(flags),
    flags,
    migration,
    readiness,
    gradePolicyReadiness,
    evaluatorRoutingReadiness,
    feedbackLeadershipReadiness,
    leaderEvaluationReadiness: populationDryRun?.leaderEvaluationReadiness ?? null,
    finalizationCeoReadiness: populationDryRun?.finalizationCeoReadiness ?? null,
    officialActivationGates,
    officialActivationRunbook,
    integratedReadinessSnapshot,
    readinessActionPlan,
    readinessExecutionBoard,
    populationDryRunAvailable: Boolean(populationDryRun),
    populationDryRunError,
    blockers,
    warnings,
  }
}

export async function getEvaluation2026ActivationReadinessForSession(
  params: {
    session: Session
    year?: number
    cycleId?: string
    limit?: number
  },
  options: {
    db?: Evaluation2026ActivationDb
    env?: NodeJS.ProcessEnv
    flags?: Evaluation2026FeatureFlags
    migrationStatus?: Evaluation2026MigrationReadiness
    readinessSummary?: EvaluationPreviewReadinessSummary2026
    gradePolicyReadiness?: Evaluation2026GradePolicyReadinessResult | null
    evaluatorRoutingReadiness?: Evaluation2026EvaluatorRoutingReadinessResult | null
    feedbackLeadershipReadiness?: Evaluation2026FeedbackLeadershipReadinessResult | null
    populationDryRun?: Evaluation2026ReadinessPopulationDryRun | null
  } = {}
) {
  const user = params.session.user as { id?: string } | undefined
  if (!user?.id) {
    throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
  }

  if (!canAccessEvaluationPreview2026(params.session)) {
    throw new AppError(403, 'FORBIDDEN', '2026 공식 전환 준비 상태는 HR 관리자만 확인할 수 있습니다.')
  }

  return getEvaluation2026ActivationReadiness({
    db: options.db,
    env: options.env,
    flags: options.flags,
    migrationStatus: options.migrationStatus,
    readinessSummary: options.readinessSummary,
    gradePolicyReadiness: options.gradePolicyReadiness,
    evaluatorRoutingReadiness: options.evaluatorRoutingReadiness,
    feedbackLeadershipReadiness: options.feedbackLeadershipReadiness,
    populationDryRun: options.populationDryRun,
    year: params.year,
    cycleId: params.cycleId,
    limit: params.limit,
  })
}
