import {
  EVALUATION_POLICY_2026,
  type EvaluationPolicyGradeCode,
  type EvaluationPolicyThresholdGroupCode,
  type GradeThresholdPolicy,
  type ScoreBand,
} from '../lib/evaluation-policy-2026'
import type { EvaluationPolicy2026TeamMemberSalesThresholdDecision } from '../lib/evaluation-policy-2026-preview-metadata'

export const EVALUATION_GRADE_2026_FORMULA_VERSION = EVALUATION_POLICY_2026.version

export type EvaluationGrade2026SalesGroup = 'SALES' | 'NON_SALES'
export type EvaluationGrade2026RoleGroup = 'TEAM_MEMBER' | 'TEAM_SECTION_LEADER' | 'DIVISION_HEAD'

export type EvaluationGrade2026ErrorCode =
  | 'GRADE_THRESHOLD_GROUP_REQUIRED'
  | 'GRADE_THRESHOLD_GROUP_NOT_FOUND'
  | 'SCORE_REQUIRED'
  | 'NO_MATCHING_THRESHOLD'
  | 'AMBIGUOUS_THRESHOLD_MATCH'
  | 'GRADE_CODE_NOT_FOUND'
  | 'MANUAL_ADJUSTMENT_REASON_REQUIRED'

export type EvaluationGrade2026WarningCode =
  | 'SELECTION_ONLY_GRADE'
  | 'POLICY_CONFIRMATION_REQUIRED'
  | 'INCOMPLETE_THRESHOLD_BAND'

export type EvaluationGrade2026Issue = {
  code: EvaluationGrade2026ErrorCode | EvaluationGrade2026WarningCode
  message: string
  group?: EvaluationPolicyThresholdGroupCode
  grade?: EvaluationPolicyGradeCode
  score?: number
  requiresPolicyConfirmation?: boolean
}

export type EvaluationGrade2026Result<T> =
  | {
      ok: true
      value: T
      errors: []
      warnings: EvaluationGrade2026Issue[]
    }
  | {
      ok: false
      errors: EvaluationGrade2026Issue[]
      warnings: EvaluationGrade2026Issue[]
      value?: never
    }

export type EvaluationGrade2026ThresholdGroupInput = {
  thresholdGroup?: EvaluationPolicyThresholdGroupCode | null
  salesGroup?: EvaluationGrade2026SalesGroup | null
  roleGroup?: EvaluationGrade2026RoleGroup | null
  teamMemberSalesThresholdDecision?: EvaluationPolicy2026TeamMemberSalesThresholdDecision | null
}

export type EvaluationGrade2026Comparison = {
  comparable: boolean
  matches: boolean
  minInclusive?: number
  maxExclusive?: number
}

export type EvaluationGrade2026CalculatedGrade = {
  code: EvaluationPolicyGradeCode
  label: string
  band: ScoreBand
}

export type EvaluationGrade2026AbsoluteGrade = {
  score: number
  thresholdGroup: EvaluationPolicyThresholdGroupCode
  thresholdGroupLabel: string
  calculatedGrade: EvaluationGrade2026CalculatedGrade
  finalGrade: EvaluationGrade2026CalculatedGrade
  formulaVersion: typeof EVALUATION_GRADE_2026_FORMULA_VERSION
  manualAdjustment?: {
    originalGrade: EvaluationGrade2026CalculatedGrade
    adjustedGrade: EvaluationGrade2026CalculatedGrade
    reason: string
  }
  requiresPolicyConfirmation: boolean
}

export type EvaluationGrade2026ThresholdValidation = {
  requiredGradeLabelsPresent: boolean
  requiredThresholdGroupsPresent: boolean
  requiresPolicyConfirmation: boolean
  selectionOnlyGrades: Array<{
    group: EvaluationPolicyThresholdGroupCode
    grade: EvaluationPolicyGradeCode
    note?: string
  }>
}

export type EvaluationGrade2026PreviewResult = {
  used2026Grade: boolean
  grade: string
  formulaVersion: string
  result2026?: EvaluationGrade2026AbsoluteGrade
}

export type EvaluationGrade2026ManualAdjustmentInput = {
  adjustedGrade: EvaluationPolicyGradeCode
  reason?: string | null
}

const REQUIRED_THRESHOLD_GROUPS: EvaluationPolicyThresholdGroupCode[] = [
  'TEAM_MEMBER_NON_SALES',
  'TEAM_SECTION_LEADER_NON_SALES',
  'TEAM_MEMBER_SALES',
  'TEAM_SECTION_LEADER_SALES',
  'DIVISION_HEAD',
]

function ok<T>(value: T, warnings: EvaluationGrade2026Issue[] = []): EvaluationGrade2026Result<T> {
  return {
    ok: true,
    value,
    errors: [],
    warnings,
  }
}

function fail<T = never>(
  errors: EvaluationGrade2026Issue[],
  warnings: EvaluationGrade2026Issue[] = []
): EvaluationGrade2026Result<T> {
  return {
    ok: false,
    errors,
    warnings,
  }
}

function issue(
  code: EvaluationGrade2026Issue['code'],
  message: string,
  details: Omit<EvaluationGrade2026Issue, 'code' | 'message'> = {}
): EvaluationGrade2026Issue {
  return {
    code,
    message,
    ...details,
  }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function getGradeLabel2026(grade: EvaluationPolicyGradeCode) {
  return EVALUATION_POLICY_2026.grades.find((item) => item.code === grade)?.label ?? grade
}

function hasComparableBoundary(band: ScoreBand | undefined) {
  return isFiniteNumber(band?.minInclusive) || isFiniteNumber(band?.maxExclusive)
}

function findGradeCode(value: unknown): value is EvaluationPolicyGradeCode {
  return (
    typeof value === 'string' &&
    EVALUATION_POLICY_2026.grades.some((grade) => grade.code === value)
  )
}

function thresholdWarningsForGroup(
  policy: GradeThresholdPolicy,
  decision?: EvaluationPolicy2026TeamMemberSalesThresholdDecision | null
) {
  const warnings: EvaluationGrade2026Issue[] = []
  const hasResolvedTeamMemberSalesOverlap =
    policy.group === 'TEAM_MEMBER_SALES' && decision && decision !== 'UNRESOLVED'

  for (const grade of EVALUATION_POLICY_2026.grades) {
    const band = policy.thresholds[grade.code]
    if (!band) continue

    if (band.selectionOnly) {
      warnings.push(
        issue('SELECTION_ONLY_GRADE', '해당 등급은 점수 구간만으로 확정할 수 없는 선발형 등급입니다.', {
          group: policy.group,
          grade: grade.code,
        })
      )
    }

    if (band.requiresPolicyConfirmation && !hasResolvedTeamMemberSalesOverlap) {
      warnings.push(
        issue('POLICY_CONFIRMATION_REQUIRED', band.note ?? '정책 담당자 확인이 필요한 등급 구간입니다.', {
          group: policy.group,
          grade: grade.code,
          requiresPolicyConfirmation: true,
        })
      )
    }

    if (!band.selectionOnly && !hasComparableBoundary(band)) {
      warnings.push(
        issue('INCOMPLETE_THRESHOLD_BAND', '점수 비교에 사용할 min/max 기준이 없는 등급 구간입니다.', {
          group: policy.group,
          grade: grade.code,
        })
      )
    }
  }

  return warnings
}

export function is2026GradeFormulaVersion(formulaVersion: string | null | undefined) {
  return formulaVersion === '2026' || formulaVersion === EVALUATION_GRADE_2026_FORMULA_VERSION
}

export function getGradeThresholdPolicy2026(
  group: EvaluationPolicyThresholdGroupCode,
  decision?: EvaluationPolicy2026TeamMemberSalesThresholdDecision | null
): EvaluationGrade2026Result<GradeThresholdPolicy> {
  const policy = EVALUATION_POLICY_2026.gradeThresholdGroups.find((item) => item.group === group)
  if (!policy) {
    return fail([
      issue('GRADE_THRESHOLD_GROUP_NOT_FOUND', '2026 등급 기준 그룹을 찾을 수 없습니다.', {
        group,
      }),
    ])
  }

  return ok(policy, thresholdWarningsForGroup(policy, decision))
}

export function resolveGradeThresholdGroup2026(
  input: EvaluationGrade2026ThresholdGroupInput
): EvaluationGrade2026Result<GradeThresholdPolicy> {
  if (input.thresholdGroup) {
    return getGradeThresholdPolicy2026(input.thresholdGroup, input.teamMemberSalesThresholdDecision)
  }

  if (!input.roleGroup) {
    return fail([issue('GRADE_THRESHOLD_GROUP_REQUIRED', '2026 등급 기준 그룹 또는 역할 그룹이 필요합니다.')])
  }

  const group =
    input.roleGroup === 'DIVISION_HEAD'
      ? EVALUATION_POLICY_2026.gradeThresholdGroups.find((item) => item.roleGroup === 'DIVISION_HEAD')
      : EVALUATION_POLICY_2026.gradeThresholdGroups.find(
          (item) => item.roleGroup === input.roleGroup && item.salesGroup === input.salesGroup
        )

  if (!group) {
    return fail([
      issue('GRADE_THRESHOLD_GROUP_NOT_FOUND', '역할/직군에 맞는 2026 등급 기준 그룹을 찾을 수 없습니다.'),
    ])
  }

  return ok(group, thresholdWarningsForGroup(group, input.teamMemberSalesThresholdDecision))
}

export function compareScoreToThreshold2026(score: number, band: ScoreBand): EvaluationGrade2026Comparison {
  const comparable = hasComparableBoundary(band)
  if (!comparable) {
    return {
      comparable: false,
      matches: false,
      minInclusive: band.minInclusive,
      maxExclusive: band.maxExclusive,
    }
  }

  const minOk = !isFiniteNumber(band.minInclusive) || score >= band.minInclusive
  const maxOk = !isFiniteNumber(band.maxExclusive) || score < band.maxExclusive

  return {
    comparable: true,
    matches: minOk && maxOk,
    minInclusive: band.minInclusive,
    maxExclusive: band.maxExclusive,
  }
}

export function validateGradeThresholds2026(): EvaluationGrade2026Result<EvaluationGrade2026ThresholdValidation> {
  const warnings: EvaluationGrade2026Issue[] = []
  const selectionOnlyGrades: EvaluationGrade2026ThresholdValidation['selectionOnlyGrades'] = []

  const requiredGradeLabelsPresent =
    EVALUATION_POLICY_2026.grades.map((grade) => grade.code).join('|') ===
    'SUPER|OUTSTANDING|EXCELLENT|GOOD|NEED_IMPROVEMENT|UNSATISFACTORY'

  const requiredThresholdGroupsPresent = REQUIRED_THRESHOLD_GROUPS.every((group) =>
    EVALUATION_POLICY_2026.gradeThresholdGroups.some((policy) => policy.group === group)
  )

  for (const policy of EVALUATION_POLICY_2026.gradeThresholdGroups) {
    const groupWarnings = thresholdWarningsForGroup(policy)
    warnings.push(...groupWarnings)

    for (const warning of groupWarnings) {
      if (warning.code === 'SELECTION_ONLY_GRADE' && warning.grade) {
        const band = policy.thresholds[warning.grade] as ScoreBand | undefined
        selectionOnlyGrades.push({
          group: policy.group,
          grade: warning.grade,
          note: band?.note,
        })
      }
    }
  }

  return ok(
    {
      requiredGradeLabelsPresent,
      requiredThresholdGroupsPresent,
      requiresPolicyConfirmation: warnings.some((warning) => warning.requiresPolicyConfirmation),
      selectionOnlyGrades,
    },
    warnings
  )
}

export function calculateAbsoluteGrade2026(params: {
  score: number
  thresholdGroup?: EvaluationPolicyThresholdGroupCode | null
  salesGroup?: EvaluationGrade2026SalesGroup | null
  roleGroup?: EvaluationGrade2026RoleGroup | null
  teamMemberSalesThresholdDecision?: EvaluationPolicy2026TeamMemberSalesThresholdDecision | null
}): EvaluationGrade2026Result<EvaluationGrade2026AbsoluteGrade> {
  if (!isFiniteNumber(params.score)) {
    return fail([issue('SCORE_REQUIRED', '2026 등급 계산에는 숫자 점수가 필요합니다.')])
  }

  const groupResult = resolveGradeThresholdGroup2026(params)
  if (!groupResult.ok) return groupResult

  const policy = groupResult.value
  const warnings = [...groupResult.warnings]
  const matches: EvaluationGrade2026CalculatedGrade[] = []

  for (const grade of EVALUATION_POLICY_2026.grades) {
    const band = policy.thresholds[grade.code]
    if (!band || band.selectionOnly) continue

    const comparison = compareScoreToThreshold2026(params.score, band)
    if (!comparison.comparable || !comparison.matches) continue

    matches.push({
      code: grade.code,
      label: grade.label,
      band,
    })
  }

  if (!matches.length) {
    return fail(
      [
        issue('NO_MATCHING_THRESHOLD', '해당 점수와 일치하는 2026 등급 구간이 없습니다.', {
          group: policy.group,
          score: params.score,
        }),
      ],
      warnings
    )
  }

  if (matches.length > 1) {
    if (policy.group === 'TEAM_MEMBER_SALES' && params.teamMemberSalesThresholdDecision === 'SUPER_PRIORITY') {
      const selected = matches.find((match) => match.code === 'SUPER')
      if (selected) {
        return ok(
          {
            score: params.score,
            thresholdGroup: policy.group,
            thresholdGroupLabel: policy.label,
            calculatedGrade: selected,
            finalGrade: selected,
            formulaVersion: EVALUATION_GRADE_2026_FORMULA_VERSION,
            requiresPolicyConfirmation: false,
          },
          warnings
        )
      }
    }

    if (policy.group === 'TEAM_MEMBER_SALES' && params.teamMemberSalesThresholdDecision === 'OUTSTANDING_PRIORITY') {
      const selected = matches.find((match) => match.code === 'OUTSTANDING')
      if (selected) {
        return ok(
          {
            score: params.score,
            thresholdGroup: policy.group,
            thresholdGroupLabel: policy.label,
            calculatedGrade: selected,
            finalGrade: selected,
            formulaVersion: EVALUATION_GRADE_2026_FORMULA_VERSION,
            requiresPolicyConfirmation: false,
          },
          warnings
        )
      }
    }

    return fail(
      [
        issue('AMBIGUOUS_THRESHOLD_MATCH', '복수의 2026 등급 구간이 동시에 일치하여 정책 확인이 필요합니다.', {
          group: policy.group,
          score: params.score,
          requiresPolicyConfirmation: true,
        }),
      ],
      warnings
    )
  }

  const calculatedGrade = matches[0]
  return ok(
    {
      score: params.score,
      thresholdGroup: policy.group,
      thresholdGroupLabel: policy.label,
      calculatedGrade,
      finalGrade: calculatedGrade,
      formulaVersion: EVALUATION_GRADE_2026_FORMULA_VERSION,
      requiresPolicyConfirmation: warnings.some((warning) => warning.requiresPolicyConfirmation),
    },
    warnings
  )
}

export function applyManualGradeAdjustmentPreview2026(
  calculated: EvaluationGrade2026AbsoluteGrade,
  adjustment: EvaluationGrade2026ManualAdjustmentInput
): EvaluationGrade2026Result<EvaluationGrade2026AbsoluteGrade> {
  if (!findGradeCode(adjustment.adjustedGrade)) {
    return fail([
      issue('GRADE_CODE_NOT_FOUND', '2026 정책에 없는 등급으로 수동 조정할 수 없습니다.', {
        grade: adjustment.adjustedGrade,
      }),
    ])
  }

  const reason = adjustment.reason?.trim()
  if (!reason) {
    return fail([
      issue('MANUAL_ADJUSTMENT_REASON_REQUIRED', '2026 등급 수동 조정에는 사유가 필요합니다.', {
        grade: adjustment.adjustedGrade,
      }),
    ])
  }

  const adjustedGrade = {
    code: adjustment.adjustedGrade,
    label: getGradeLabel2026(adjustment.adjustedGrade),
    band: calculated.finalGrade.band,
  }

  return ok({
    ...calculated,
    finalGrade: adjustedGrade,
    manualAdjustment: {
      originalGrade: calculated.calculatedGrade,
      adjustedGrade,
      reason,
    },
  })
}

export function calculateGradePreview2026(params: {
  formulaVersion?: string | null
  legacyGrade: string
  score?: number | null
  thresholdGroup?: EvaluationPolicyThresholdGroupCode | null
  salesGroup?: EvaluationGrade2026SalesGroup | null
  roleGroup?: EvaluationGrade2026RoleGroup | null
  manualAdjustment?: EvaluationGrade2026ManualAdjustmentInput | null
  teamMemberSalesThresholdDecision?: EvaluationPolicy2026TeamMemberSalesThresholdDecision | null
}): EvaluationGrade2026Result<EvaluationGrade2026PreviewResult> {
  if (!is2026GradeFormulaVersion(params.formulaVersion)) {
    return ok({
      used2026Grade: false,
      grade: params.legacyGrade,
      formulaVersion: params.formulaVersion ?? 'LEGACY',
    })
  }

  const absoluteGrade = calculateAbsoluteGrade2026({
    score: params.score ?? Number.NaN,
    thresholdGroup: params.thresholdGroup,
    salesGroup: params.salesGroup,
    roleGroup: params.roleGroup,
    teamMemberSalesThresholdDecision: params.teamMemberSalesThresholdDecision,
  })
  if (!absoluteGrade.ok) return absoluteGrade

  const adjusted = params.manualAdjustment
    ? applyManualGradeAdjustmentPreview2026(absoluteGrade.value, params.manualAdjustment)
    : absoluteGrade
  if (!adjusted.ok) return adjusted

  return ok(
    {
      used2026Grade: true,
      grade: adjusted.value.finalGrade.label,
      formulaVersion: EVALUATION_GRADE_2026_FORMULA_VERSION,
      result2026: adjusted.value,
    },
    adjusted.warnings
  )
}
