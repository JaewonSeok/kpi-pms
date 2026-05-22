import type { Session } from 'next-auth'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'
import {
  EVALUATION_POLICY_2026,
  type EvaluationPolicyGradeCode,
  type EvaluationPolicyThresholdGroupCode,
  type GradeThresholdPolicy,
  type ScoreBand,
} from '@/lib/evaluation-policy-2026'
import { get2026EvaluationFeatureFlags } from '@/lib/feature-flags'
import {
  readPolicy2026PreviewMappings,
  type EvaluationPolicy2026TeamMemberSalesThresholdDecision,
} from '@/lib/evaluation-policy-2026-preview-metadata'
import { AppError } from '@/lib/utils'
import { canAccessEvaluationPreview2026 } from '@/server/evaluation-preview-2026-loader'

type Evaluation2026GradePolicyDb = {
  evalCycle?: {
    findUnique?: (args: unknown) => Promise<unknown>
  }
  evaluationGradePolicy?: {
    findMany?: (args: unknown) => Promise<unknown[]>
    upsert?: (args: unknown) => Promise<unknown>
  }
}

type AuditWriter = typeof createAuditLog

type EvalCycleForGradePolicy2026 = {
  id: string
  orgId: string
  cycleName: string
  evalYear: number
  performanceDesignConfig: unknown
}

type StoredEvaluationGradePolicy2026 = {
  id?: string
  orgId: string
  evalYear: number
  policyVersion: string
  thresholdGroup: EvaluationPolicyThresholdGroupCode
  gradeLabel: EvaluationPolicyGradeCode
  displayName: string
  minScore: number | null
  maxScore: number | null
  lowerBoundInclusive: boolean
  upperBoundInclusive: boolean
  selectionRule: string | null
  notes: string | null
  isActive: boolean
}

export type Evaluation2026GradePolicyThresholdRow = {
  gradeLabel: EvaluationPolicyGradeCode
  gradeDisplayName: string
  pptMinScore: number | null
  pptMaxScore: number | null
  pptRule: string | null
  pptLabel: string
  pptNotes: string | null
  storedPolicyId: string | null
  storedMinScore: number | null
  storedMaxScore: number | null
  storedRule: string | null
  storedLabel: string
  status: 'MISSING' | 'MATCHES_PPT' | 'DIFFERS_FROM_PPT'
}

export type Evaluation2026GradePolicyThresholdIssue = {
  code: string
  message: string
  group?: EvaluationPolicyThresholdGroupCode
  gradeLabel?: EvaluationPolicyGradeCode
  prismaCode?: string
  objectName?: string
}

export type Evaluation2026GradePolicyGroupReadiness = {
  group: EvaluationPolicyThresholdGroupCode
  label: string
  salesGroup: GradeThresholdPolicy['salesGroup']
  roleGroup: GradeThresholdPolicy['roleGroup']
  rows: Evaluation2026GradePolicyThresholdRow[]
  storedRowsCount: number
  missingRowsCount: number
  differsFromPptCount: number
  overlapCount: number
  gapCount: number
  complete: boolean
  requiresHrConfirmation: boolean
  issues: Evaluation2026GradePolicyThresholdIssue[]
}

export type Evaluation2026GradePolicyReadinessResult = {
  policyVersion: string
  generatedAt: string
  scope: {
    evalCycleId: string | null
    evalCycleName: string | null
    orgId: string | null
    evalYear: number
  }
  persistence: {
    available: boolean
    tableName: 'evaluation_grade_policies'
    mode: 'metadata_only'
    compatibilityIssue?: {
      code: string
      prismaCode?: string
      message: string
      objectName?: string
    } | null
  }
  gradePolicyExists: boolean
  gradePolicyGroupsComplete: boolean
  requiredGroupCount: number
  completeGroupCount: number
  storedRowsCount: number
  expectedRowsCount: number
  missingRowsCount: number
  differsFromPptCount: number
  overlapCount: number
  gapCount: number
  missingHrDecisionCount: number
  teamMemberSalesAmbiguity: {
    currentDecision: EvaluationPolicy2026TeamMemberSalesThresholdDecision
    requiresDecision: boolean
    message: string
  }
  groups: Evaluation2026GradePolicyGroupReadiness[]
  blockers: Evaluation2026GradePolicyThresholdIssue[]
  warnings: Evaluation2026GradePolicyThresholdIssue[]
  safety: {
    officialScoringEnabled: boolean
    officialGradeEnabled: boolean
    officialAiScoreExclusionEnabled: boolean
    officialScoresChanged: false
    officialGradesChanged: false
    totalScoreChanged: false
    gradeIdChanged: false
    evaluationsCreated: 0
    evaluationItemsCreated: 0
  }
}

export type Evaluation2026GradePolicyMetadataSaveResult = {
  policyVersion: string
  evalCycleId: string
  orgId: string
  evalYear: number
  upsertedRows: number
  officialScoresChanged: false
  officialGradesChanged: false
  totalScoreChanged: false
  gradeIdChanged: false
  evaluationsCreated: 0
  evaluationItemsCreated: 0
  notes: string[]
}

export const Evaluation2026GradePolicyReadinessQuerySchema = z.object({
  evalCycleId: z.string().trim().min(1).optional(),
  orgId: z.string().trim().min(1).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
})

export const Evaluation2026GradePolicyMetadataSaveSchema = z.object({
  evalCycleId: z.string().trim().min(1),
  source: z.literal('PPT_BASELINE').default('PPT_BASELINE'),
})

function getSessionUser(session: Session) {
  const user = session.user as { id?: string; role?: string } | undefined
  if (!user?.id) {
    throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
  }
  if (!canAccessEvaluationPreview2026(session)) {
    throw new AppError(403, 'FORBIDDEN', '2026 등급 기준 readiness 관리는 HR 관리자만 사용할 수 있습니다.')
  }
  return user as { id: string; role: string }
}

function gradeDisplayName(grade: EvaluationPolicyGradeCode) {
  return EVALUATION_POLICY_2026.grades.find((item) => item.code === grade)?.label ?? grade
}

function expectedSelectionRule(band: ScoreBand | undefined) {
  if (!band) return 'NOT_APPLICABLE'
  if (band.selectionOnly) return 'SELECTION_ONLY'
  if (band.requiresPolicyConfirmation) return 'HR_CONFIRMATION_REQUIRED'
  return null
}

function scoreLabel(minScore: number | null, maxScore: number | null, rule?: string | null) {
  if (rule === 'NOT_APPLICABLE') return '별도 구간 없음'
  if (rule === 'SELECTION_ONLY') return '선발형 등급'
  const min = typeof minScore === 'number' ? `${minScore}점 이상` : null
  const max = typeof maxScore === 'number' ? `${maxScore}점 미만` : null
  if (min && max) return `${min} / ${max}`
  if (min) return min
  if (max) return max
  return rule === 'HR_CONFIRMATION_REQUIRED' ? 'HR 확인 필요' : '미지정'
}

function valuesMatch(left: number | null, right: number | null) {
  return left === right || (typeof left === 'number' && typeof right === 'number' && Math.abs(left - right) < 0.000001)
}

function makeStoredKey(group: EvaluationPolicyThresholdGroupCode, grade: EvaluationPolicyGradeCode) {
  return `${group}:${grade}`
}

function getRecordValue(record: unknown, key: string) {
  return record && typeof record === 'object'
    ? (record as Record<string, unknown>)[key]
    : undefined
}

function getSafeErrorMessage(error: unknown) {
  const message = getRecordValue(error, 'message')
  return typeof message === 'string' ? message : ''
}

function getSafePrismaCode(error: unknown) {
  const code = getRecordValue(error, 'code')
  return typeof code === 'string' ? code : undefined
}

function getSafeObjectName(error: unknown) {
  const meta = getRecordValue(error, 'meta')
  const directValues = [
    getRecordValue(meta, 'table'),
    getRecordValue(meta, 'tableName'),
    getRecordValue(meta, 'column'),
    getRecordValue(meta, 'target'),
    getRecordValue(meta, 'modelName'),
  ]
  const direct = directValues.find((value): value is string => typeof value === 'string')
  if (direct) return direct

  const driverAdapterError = getRecordValue(meta, 'driverAdapterError')
  const cause = getRecordValue(driverAdapterError, 'cause')
  const originalMessage = getRecordValue(cause, 'originalMessage')
  if (typeof originalMessage === 'string') return originalMessage.slice(0, 180)

  return undefined
}

function isGradePolicyDbCompatibilityError(error: unknown) {
  const code = getSafePrismaCode(error)
  if (code === 'P2021' || code === 'P2022') return true

  const message = getSafeErrorMessage(error)
  return /evaluation_grade_policies|EvaluationGradePolicy|column .*does not exist|relation .*does not exist|table .*does not exist/i.test(message)
}

function toGradePolicyCompatibilityIssue(error: unknown) {
  const prismaCode = getSafePrismaCode(error)
  return {
    code: 'GRADE_POLICY_DB_COMPATIBILITY_REQUIRED',
    prismaCode,
    message: '2026 등급 기준 정책을 불러오지 못했습니다. DB compatibility 확인이 필요합니다.',
    objectName: getSafeObjectName(error) ?? 'evaluation_grade_policies',
  }
}

function asStoredPolicy(row: unknown): StoredEvaluationGradePolicy2026 | null {
  if (!row || typeof row !== 'object') return null
  const value = row as Partial<StoredEvaluationGradePolicy2026>
  if (!value.thresholdGroup || !value.gradeLabel) return null
  return {
    id: value.id,
    orgId: value.orgId ?? '',
    evalYear: value.evalYear ?? EVALUATION_POLICY_2026.year,
    policyVersion: value.policyVersion ?? EVALUATION_POLICY_2026.version,
    thresholdGroup: value.thresholdGroup,
    gradeLabel: value.gradeLabel,
    displayName: value.displayName ?? gradeDisplayName(value.gradeLabel),
    minScore: typeof value.minScore === 'number' ? value.minScore : null,
    maxScore: typeof value.maxScore === 'number' ? value.maxScore : null,
    lowerBoundInclusive: value.lowerBoundInclusive ?? true,
    upperBoundInclusive: value.upperBoundInclusive ?? false,
    selectionRule: value.selectionRule ?? null,
    notes: value.notes ?? null,
    isActive: value.isActive ?? true,
  }
}

function makePptRows(policy: GradeThresholdPolicy, storedByKey: Map<string, StoredEvaluationGradePolicy2026>) {
  return EVALUATION_POLICY_2026.grades.map((grade) => {
    const band = policy.thresholds[grade.code] as ScoreBand | undefined
    const pptMinScore = typeof band?.minInclusive === 'number' ? band.minInclusive : null
    const pptMaxScore = typeof band?.maxExclusive === 'number' ? band.maxExclusive : null
    const pptRule = expectedSelectionRule(band)
    const stored = storedByKey.get(makeStoredKey(policy.group, grade.code)) ?? null
    const storedRule = stored?.selectionRule ?? null
    const status: Evaluation2026GradePolicyThresholdRow['status'] = !stored
      ? 'MISSING'
      : valuesMatch(stored.minScore, pptMinScore) &&
          valuesMatch(stored.maxScore, pptMaxScore) &&
          storedRule === pptRule
        ? 'MATCHES_PPT'
        : 'DIFFERS_FROM_PPT'

    return {
      gradeLabel: grade.code,
      gradeDisplayName: grade.label,
      pptMinScore,
      pptMaxScore,
      pptRule,
      pptLabel: scoreLabel(pptMinScore, pptMaxScore, pptRule),
      pptNotes: band?.note ?? null,
      storedPolicyId: stored?.id ?? null,
      storedMinScore: stored?.minScore ?? null,
      storedMaxScore: stored?.maxScore ?? null,
      storedRule,
      storedLabel: stored ? scoreLabel(stored.minScore, stored.maxScore, stored.selectionRule) : '저장 정책 없음',
      status,
    } satisfies Evaluation2026GradePolicyThresholdRow
  })
}

function isComparable(row: Pick<Evaluation2026GradePolicyThresholdRow, 'storedMinScore' | 'storedMaxScore' | 'storedRule'>) {
  if (row.storedRule === 'SELECTION_ONLY' || row.storedRule === 'NOT_APPLICABLE') return false
  return typeof row.storedMinScore === 'number' || typeof row.storedMaxScore === 'number'
}

function detectRangeIssues(params: {
  group: EvaluationPolicyThresholdGroupCode
  rows: Evaluation2026GradePolicyThresholdRow[]
  teamMemberSalesDecision: EvaluationPolicy2026TeamMemberSalesThresholdDecision
}) {
  const issues: Evaluation2026GradePolicyThresholdIssue[] = []
  const comparable = params.rows.filter((row) => row.storedPolicyId && isComparable(row))

  for (let index = 0; index < comparable.length; index += 1) {
    const left = comparable[index]
    const leftMin = left.storedMinScore ?? Number.NEGATIVE_INFINITY
    const leftMax = left.storedMaxScore ?? Number.POSITIVE_INFINITY
    for (const right of comparable.slice(index + 1)) {
      const rightMin = right.storedMinScore ?? Number.NEGATIVE_INFINITY
      const rightMax = right.storedMaxScore ?? Number.POSITIVE_INFINITY
      const overlaps = leftMin < rightMax && rightMin < leftMax
      if (!overlaps) continue
      const isResolvedTeamMemberSalesOverlap =
        params.group === 'TEAM_MEMBER_SALES' && params.teamMemberSalesDecision !== 'UNRESOLVED'
      if (isResolvedTeamMemberSalesOverlap) continue
      issues.push({
        code: 'GRADE_POLICY_THRESHOLD_OVERLAP',
        group: params.group,
        message: `${gradeDisplayName(left.gradeLabel)} / ${gradeDisplayName(right.gradeLabel)} 기준이 중첩됩니다.`,
      })
    }
  }

  const sorted = comparable
    .filter((row) => typeof row.storedMinScore === 'number' && typeof row.storedMaxScore === 'number')
    .sort((left, right) => (left.storedMinScore ?? 0) - (right.storedMinScore ?? 0))
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1]
    const current = sorted[index]
    if (typeof previous.storedMaxScore === 'number' && typeof current.storedMinScore === 'number' && previous.storedMaxScore < current.storedMinScore) {
      issues.push({
        code: 'GRADE_POLICY_THRESHOLD_GAP',
        group: params.group,
        message: `${previous.storedMaxScore}점 이상 ${current.storedMinScore}점 미만 구간에 등급 기준 공백이 있습니다.`,
      })
    }
  }

  return issues
}

function buildPolicyRowsForSave(scope: { orgId: string; evalYear: number }) {
  return EVALUATION_POLICY_2026.gradeThresholdGroups.flatMap((group) =>
    EVALUATION_POLICY_2026.grades.map((grade) => {
      const band = group.thresholds[grade.code] as ScoreBand | undefined
      const selectionRule = expectedSelectionRule(band)
      const notes = [band?.note, ...(group.notes ?? []), 'PPT 기준 2026 readiness metadata. 공식 점수/등급에는 미반영.']
        .filter((value): value is string => Boolean(value))
        .join(' / ')
      return {
        orgId: scope.orgId,
        evalYear: scope.evalYear,
        policyVersion: EVALUATION_POLICY_2026.version,
        thresholdGroup: group.group,
        gradeLabel: grade.code,
        displayName: `${group.label} - ${grade.label}`,
        minScore: typeof band?.minInclusive === 'number' ? band.minInclusive : null,
        maxScore: typeof band?.maxExclusive === 'number' ? band.maxExclusive : null,
        lowerBoundInclusive: true,
        upperBoundInclusive: false,
        selectionRule,
        notes,
        isActive: true,
      }
    })
  )
}

async function resolveGradePolicyScope(params: {
  db: Evaluation2026GradePolicyDb
  evalCycleId?: string
  orgId?: string
  year?: number
}) {
  if (params.evalCycleId) {
    const cycle = params.db.evalCycle?.findUnique
      ? await params.db.evalCycle.findUnique({
          where: { id: params.evalCycleId },
          select: {
            id: true,
            orgId: true,
            cycleName: true,
            evalYear: true,
            performanceDesignConfig: true,
          },
        }) as EvalCycleForGradePolicy2026 | null
      : null
    if (!cycle) {
      throw new AppError(404, 'EVAL_CYCLE_NOT_FOUND', '평가 주기를 찾을 수 없습니다.')
    }
    return {
      evalCycleId: cycle.id,
      evalCycleName: cycle.cycleName,
      orgId: cycle.orgId,
      evalYear: cycle.evalYear,
      performanceDesignConfig: cycle.performanceDesignConfig,
    }
  }

  return {
    evalCycleId: null,
    evalCycleName: null,
    orgId: params.orgId ?? null,
    evalYear: params.year ?? EVALUATION_POLICY_2026.year,
    performanceDesignConfig: null,
  }
}

export async function getEvaluation2026GradePolicyReadiness(params: {
  db?: Evaluation2026GradePolicyDb
  evalCycleId?: string
  orgId?: string
  year?: number
  env?: NodeJS.ProcessEnv
} = {}): Promise<Evaluation2026GradePolicyReadinessResult> {
  const db = (params.db ?? prisma) as Evaluation2026GradePolicyDb
  const scope = await resolveGradePolicyScope({
    db,
    evalCycleId: params.evalCycleId,
    orgId: params.orgId,
    year: params.year,
  })
  let persistenceAvailable = typeof db.evaluationGradePolicy?.findMany === 'function'
  let compatibilityIssue: ReturnType<typeof toGradePolicyCompatibilityIssue> | null = null
  let rawStoredRows: unknown[] = []

  if (persistenceAvailable && scope.orgId) {
    try {
      rawStoredRows = await db.evaluationGradePolicy!.findMany!({
        where: {
          orgId: scope.orgId,
          evalYear: scope.evalYear,
          policyVersion: EVALUATION_POLICY_2026.version,
          isActive: true,
        },
        orderBy: [{ thresholdGroup: 'asc' }, { gradeLabel: 'asc' }],
      })
    } catch (error) {
      if (!isGradePolicyDbCompatibilityError(error)) {
        throw error
      }
      compatibilityIssue = toGradePolicyCompatibilityIssue(error)
      persistenceAvailable = false
      rawStoredRows = []
    }
  }

  const storedRows = rawStoredRows
    .map(asStoredPolicy)
    .filter((row): row is StoredEvaluationGradePolicy2026 => Boolean(row))

  const storedByKey = new Map(
    storedRows.map((row) => [makeStoredKey(row.thresholdGroup, row.gradeLabel), row])
  )
  const mappings = readPolicy2026PreviewMappings(scope.performanceDesignConfig)
  const currentDecision = mappings.teamMemberSalesThresholdDecision?.decision ?? 'UNRESOLVED'
  const groups = EVALUATION_POLICY_2026.gradeThresholdGroups.map((policy) => {
    const rows = makePptRows(policy, storedByKey)
    const rangeIssues = detectRangeIssues({
      group: policy.group,
      rows,
      teamMemberSalesDecision: currentDecision,
    })
    const missingRows = rows.filter((row) => row.status === 'MISSING')
    const differs = rows.filter((row) => row.status === 'DIFFERS_FROM_PPT')
    const missingIssues = missingRows.map((row) => ({
      code: 'GRADE_POLICY_ROW_MISSING',
      group: policy.group,
      gradeLabel: row.gradeLabel,
      message: `${policy.label} ${row.gradeDisplayName} 저장 정책이 없습니다.`,
    }))
    const differenceIssues = differs.map((row) => ({
      code: 'GRADE_POLICY_DIFFERS_FROM_PPT',
      group: policy.group,
      gradeLabel: row.gradeLabel,
      message: `${policy.label} ${row.gradeDisplayName} 저장 정책이 PPT 기준과 다릅니다.`,
    }))
    const requiresHrConfirmation =
      policy.group === 'TEAM_MEMBER_SALES' && currentDecision === 'UNRESOLVED'
    return {
      group: policy.group,
      label: policy.label,
      salesGroup: policy.salesGroup,
      roleGroup: policy.roleGroup,
      rows,
      storedRowsCount: rows.filter((row) => row.storedPolicyId).length,
      missingRowsCount: missingRows.length,
      differsFromPptCount: differs.length,
      overlapCount: rangeIssues.filter((issue) => issue.code === 'GRADE_POLICY_THRESHOLD_OVERLAP').length,
      gapCount: rangeIssues.filter((issue) => issue.code === 'GRADE_POLICY_THRESHOLD_GAP').length,
      complete: missingRows.length === 0,
      requiresHrConfirmation,
      issues: [...missingIssues, ...differenceIssues, ...rangeIssues],
    } satisfies Evaluation2026GradePolicyGroupReadiness
  })

  const blockers: Evaluation2026GradePolicyThresholdIssue[] = []
  const warnings: Evaluation2026GradePolicyThresholdIssue[] = []
  if (!persistenceAvailable && !compatibilityIssue) {
    warnings.push({
      code: 'GRADE_POLICY_PERSISTENCE_UNAVAILABLE',
      message: 'evaluation_grade_policies 조회 delegate가 없어 저장 정책 존재 여부를 확인하지 못했습니다.',
    })
  }
  if (compatibilityIssue) {
    blockers.push({
      code: compatibilityIssue.code,
      message: compatibilityIssue.message,
      prismaCode: compatibilityIssue.prismaCode,
      objectName: compatibilityIssue.objectName,
    })
  }
  if (persistenceAvailable && !scope.orgId) {
    blockers.push({
      code: 'GRADE_POLICY_SCOPE_REQUIRED',
      message: '등급 정책 readiness 확인에는 orgId 또는 evalCycleId가 필요합니다.',
    })
  }

  for (const group of groups) {
    for (const issue of group.issues) {
      if (
        issue.code === 'GRADE_POLICY_ROW_MISSING' ||
        issue.code === 'GRADE_POLICY_DIFFERS_FROM_PPT' ||
        issue.code === 'GRADE_POLICY_THRESHOLD_OVERLAP' ||
        issue.code === 'GRADE_POLICY_THRESHOLD_GAP'
      ) {
        blockers.push(issue)
      } else {
        warnings.push(issue)
      }
    }
  }

  if (currentDecision === 'UNRESOLVED') {
    blockers.push({
      code: 'TEAM_MEMBER_SALES_THRESHOLD_AMBIGUITY',
      group: 'TEAM_MEMBER_SALES',
      message: 'TEAM_MEMBER_SALES 등급 기준에 HR 확인이 필요합니다.',
    })
  }

  const flags = get2026EvaluationFeatureFlags(params.env)
  const storedRowsCount = groups.reduce((sum, group) => sum + group.storedRowsCount, 0)
  const missingRowsCount = groups.reduce((sum, group) => sum + group.missingRowsCount, 0)
  const differsFromPptCount = groups.reduce((sum, group) => sum + group.differsFromPptCount, 0)
  const overlapCount = groups.reduce((sum, group) => sum + group.overlapCount, 0)
  const gapCount = groups.reduce((sum, group) => sum + group.gapCount, 0)

  return {
    policyVersion: EVALUATION_POLICY_2026.version,
    generatedAt: new Date().toISOString(),
    scope: {
      evalCycleId: scope.evalCycleId,
      evalCycleName: scope.evalCycleName,
      orgId: scope.orgId,
      evalYear: scope.evalYear,
    },
    persistence: {
      available: persistenceAvailable,
      tableName: 'evaluation_grade_policies',
      mode: 'metadata_only',
      compatibilityIssue,
    },
    gradePolicyExists: storedRowsCount > 0,
    gradePolicyGroupsComplete: groups.every((group) => group.complete),
    requiredGroupCount: groups.length,
    completeGroupCount: groups.filter((group) => group.complete).length,
    storedRowsCount,
    expectedRowsCount: EVALUATION_POLICY_2026.gradeThresholdGroups.length * EVALUATION_POLICY_2026.grades.length,
    missingRowsCount,
    differsFromPptCount,
    overlapCount,
    gapCount,
    missingHrDecisionCount: currentDecision === 'UNRESOLVED' ? 1 : 0,
    teamMemberSalesAmbiguity: {
      currentDecision,
      requiresDecision: currentDecision === 'UNRESOLVED',
      message:
        currentDecision === 'UNRESOLVED'
          ? 'TEAM_MEMBER_SALES Super/Outstanding 기준은 HR 결정 전까지 unresolved입니다.'
          : 'TEAM_MEMBER_SALES Super/Outstanding 기준 결정이 저장되어 있습니다.',
    },
    groups,
    blockers,
    warnings,
    safety: {
      officialScoringEnabled: flags.officialScoringEnabled,
      officialGradeEnabled: flags.officialGradeEnabled,
      officialAiScoreExclusionEnabled: flags.aiScoreExclusionEnabled,
      officialScoresChanged: false,
      officialGradesChanged: false,
      totalScoreChanged: false,
      gradeIdChanged: false,
      evaluationsCreated: 0,
      evaluationItemsCreated: 0,
    },
  }
}

export async function getEvaluation2026GradePolicyReadinessForSession(
  params: {
    session: Session
    evalCycleId?: string
    orgId?: string
    year?: number
  },
  options: {
    db?: Evaluation2026GradePolicyDb
    env?: NodeJS.ProcessEnv
  } = {}
) {
  getSessionUser(params.session)
  return getEvaluation2026GradePolicyReadiness({
    db: options.db,
    evalCycleId: params.evalCycleId,
    orgId: params.orgId,
    year: params.year,
    env: options.env,
  })
}

export async function saveEvaluation2026GradePolicyMetadataForSession(
  params: {
    session: Session
    input: z.infer<typeof Evaluation2026GradePolicyMetadataSaveSchema>
  },
  options: {
    db?: Evaluation2026GradePolicyDb
    audit?: AuditWriter
    now?: Date
  } = {}
): Promise<Evaluation2026GradePolicyMetadataSaveResult> {
  const actor = getSessionUser(params.session)
  const db = (options.db ?? prisma) as Evaluation2026GradePolicyDb
  const audit = options.audit ?? createAuditLog
  const parsed = Evaluation2026GradePolicyMetadataSaveSchema.parse(params.input)

  if (typeof db.evaluationGradePolicy?.upsert !== 'function') {
    throw new AppError(500, 'GRADE_POLICY_PERSISTENCE_UNAVAILABLE', '등급 정책 저장 persistence가 준비되어 있지 않습니다.')
  }

  const scope = await resolveGradePolicyScope({
    db,
    evalCycleId: parsed.evalCycleId,
  })
  if (!scope.orgId) {
    throw new AppError(400, 'GRADE_POLICY_SCOPE_REQUIRED', '등급 정책 저장에는 평가 주기 orgId가 필요합니다.')
  }

  const rows = buildPolicyRowsForSave({
    orgId: scope.orgId,
    evalYear: scope.evalYear,
  })
  try {
    for (const row of rows) {
      await db.evaluationGradePolicy.upsert({
        where: {
          orgId_evalYear_policyVersion_thresholdGroup_gradeLabel: {
            orgId: row.orgId,
            evalYear: row.evalYear,
            policyVersion: row.policyVersion,
            thresholdGroup: row.thresholdGroup,
            gradeLabel: row.gradeLabel,
          },
        },
        create: row,
        update: {
          displayName: row.displayName,
          minScore: row.minScore,
          maxScore: row.maxScore,
          lowerBoundInclusive: row.lowerBoundInclusive,
          upperBoundInclusive: row.upperBoundInclusive,
          selectionRule: row.selectionRule,
          notes: row.notes,
          isActive: true,
        },
      })
    }
  } catch (error) {
    if (!isGradePolicyDbCompatibilityError(error)) {
      throw error
    }
    const issue = toGradePolicyCompatibilityIssue(error)
    throw new AppError(409, issue.code, issue.message, {
      prismaCode: issue.prismaCode,
    })
  }

  await audit({
    userId: actor.id,
    action: 'UPDATE_2026_GRADE_POLICY_READINESS_METADATA',
    entityType: 'EvalCycle',
    entityId: parsed.evalCycleId,
    newValue: {
      policyVersion: EVALUATION_POLICY_2026.version,
      source: parsed.source,
      upsertedRows: rows.length,
      officialScoresChanged: false,
      officialGradesChanged: false,
      totalScoreChanged: false,
      gradeIdChanged: false,
      evaluationsCreated: 0,
      evaluationItemsCreated: 0,
    },
  })

  return {
    policyVersion: EVALUATION_POLICY_2026.version,
    evalCycleId: parsed.evalCycleId,
    orgId: scope.orgId,
    evalYear: scope.evalYear,
    upsertedRows: rows.length,
    officialScoresChanged: false,
    officialGradesChanged: false,
    totalScoreChanged: false,
    gradeIdChanged: false,
    evaluationsCreated: 0,
    evaluationItemsCreated: 0,
    notes: [
      '2026 grade policy readiness metadata only.',
      'Evaluation.totalScore and Evaluation.gradeId are not updated.',
      'Official scoring/grade activation remains disabled.',
    ],
  }
}
