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

type Evaluation2026ActivationDb = Pick<typeof prisma, 'evaluation' | 'aiCompetencyGateAssignment'> & Partial<Pick<typeof prisma, 'evalCycle' | 'department'>> & {
  $queryRawUnsafe?: typeof prisma.$queryRawUnsafe
}

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

export type Evaluation2026ActivationReadinessResult = {
  policyVersion: string
  checkedAt: string
  canActivate: boolean
  flags: Evaluation2026FeatureFlags
  migration: Evaluation2026MigrationReadiness
  readiness: EvaluationPreviewReadinessSummary2026
  gradePolicyReadiness: Evaluation2026GradePolicyReadinessResult | null
  blockers: Evaluation2026ActivationReadinessItem[]
  warnings: Evaluation2026ActivationReadinessItem[]
}

const PHASE0_MIGRATION_NAME = '20260514_phase0_2026_policy_prep'

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

  const blockers: Evaluation2026ActivationReadinessItem[] = []
  const warnings: Evaluation2026ActivationReadinessItem[] = []
  collectFlagReadiness(flags, blockers, warnings)
  collectMigrationReadiness(migration, blockers, warnings)
  collectPreviewReadiness(readiness, blockers, warnings)
  collectGradePolicyReadiness(gradePolicyReadiness, blockers, warnings)

  return {
    policyVersion: EVALUATION_POLICY_2026.version,
    checkedAt: new Date().toISOString(),
    canActivate: blockers.length === 0 && is2026OfficialActivationAllowed(flags),
    flags,
    migration,
    readiness,
    gradePolicyReadiness,
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
    year: params.year,
    cycleId: params.cycleId,
    limit: params.limit,
  })
}
