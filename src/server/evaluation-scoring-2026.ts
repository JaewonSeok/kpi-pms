import {
  EVALUATION_POLICY_2026,
  isEvaluationPolicyItemCategory,
  type EvaluationPolicyItemCategoryCode,
} from '../lib/evaluation-policy-2026'

export const EVALUATION_SCORING_2026_FORMULA_VERSION = EVALUATION_POLICY_2026.version

export type EvaluationScore2026AchievementLevel =
  | 'BELOW_TARGET'
  | 'TARGET'
  | 'EXCELLENT'
  | 'CUSTOM'

export type EvaluationScore2026ContributionType = 'ORGANIZATION' | 'PERSONAL'

export type EvaluationScore2026ValidationErrorCode =
  | 'CATEGORY_REQUIRED'
  | 'UNKNOWN_CATEGORY'
  | 'SCORE_REQUIRED'
  | 'SCORE_OUT_OF_RANGE'
  | 'DAILY_WORK_SCORE_EXCEEDS_MAX'
  | 'ADJUSTMENT_OUT_OF_RANGE'
  | 'ADJUSTMENT_CATEGORY_NOT_ALLOWED'
  | 'ADJUSTMENT_BELOW_TARGET_NOT_ALLOWED'
  | 'ADJUSTMENT_PRECONDITION_MISSING'
  | 'ADJUSTMENT_GROUP_REQUIRED'
  | 'ADJUSTMENT_GROUP_NOT_ZERO_SUM'
  | 'MISSING_ORGANIZATION_SCORE'
  | 'MISSING_PERSONAL_SCORE'
  | 'ITEMS_REQUIRED'

export type EvaluationScore2026ValidationError = {
  code: EvaluationScore2026ValidationErrorCode
  message: string
  itemId?: string
  groupKey?: string
  category?: string
}

export type EvaluationScore2026Result<T> =
  | {
      ok: true
      value: T
      errors: []
    }
  | {
      ok: false
      errors: EvaluationScore2026ValidationError[]
      value?: never
    }

export type EvaluationScore2026ItemInput = {
  id?: string
  category?: EvaluationPolicyItemCategoryCode | 'UNKNOWN' | null
  achievementLevel?: EvaluationScore2026AchievementLevel | null
  score?: number | null
  adjustmentScore?: number | null
  adjustmentGroupKey?: string | null
  weight?: number | null
  // III-3 조직목표 미달성 예외 매칭 키. 같은 linkedOrgKpiId를 가진 ORG_GOAL ↔ PROJECT_T
  // 항목이 "같은 조직목표 내" 관계로 식별된다. 미전달이면 예외 미적용으로 떨어져 동작 영향 0.
  linkedOrgKpiId?: string | null
}

export type EvaluationScore2026ItemBaseScore = {
  id?: string
  category: EvaluationPolicyItemCategoryCode
  contributionType: EvaluationScore2026ContributionType
  achievementLevel: EvaluationScore2026AchievementLevel
  baseScore: number
  targetScore?: number
}

export type EvaluationScore2026ItemScore = EvaluationScore2026ItemBaseScore & {
  adjustmentScore: number
  finalScore: number
  weight?: number
  adjustmentGroupKey?: string
}

export type EvaluationScore2026SplitResult = {
  organizationPerformanceScore: number
  personalPerformanceScore: number
}

export type EvaluationScore2026EvaluationResult = EvaluationScore2026SplitResult & {
  finalScore: number
  itemScores: EvaluationScore2026ItemScore[]
  formulaVersion: typeof EVALUATION_SCORING_2026_FORMULA_VERSION
}

export type EvaluationScore2026FormulaPreviewResult = {
  used2026Formula: boolean
  score: number
  formulaVersion: string
  result2026?: EvaluationScore2026EvaluationResult
}

type WeightedScore = {
  score: number
  weight?: number
}

function validationError(
  code: EvaluationScore2026ValidationErrorCode,
  message: string,
  details: Omit<EvaluationScore2026ValidationError, 'code' | 'message'> = {}
): EvaluationScore2026ValidationError {
  return {
    code,
    message,
    ...details,
  }
}

function ok<T>(value: T): EvaluationScore2026Result<T> {
  return { ok: true, value, errors: [] }
}

function fail<T = never>(errors: EvaluationScore2026ValidationError[]): EvaluationScore2026Result<T> {
  return { ok: false, errors }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function roundToSingle(value: number) {
  return Math.round(value * 10) / 10
}

function normalizeAdjustment(value: number | null | undefined) {
  return isFiniteNumber(value) ? value : 0
}

function normalizeWeight(value: number | null | undefined) {
  return isFiniteNumber(value) && value > 0 ? value : undefined
}

function validateScoringCategory(
  category: EvaluationScore2026ItemInput['category'],
  itemId?: string
): EvaluationScore2026Result<EvaluationPolicyItemCategoryCode> {
  if (!category) {
    return fail([
      validationError('CATEGORY_REQUIRED', '2026 산식에서는 평가 항목 category가 필요합니다.', {
        itemId,
      }),
    ])
  }

  if (!isEvaluationPolicyItemCategory(category)) {
    return fail([
      validationError('UNKNOWN_CATEGORY', '2026 산식에서 지원하지 않는 평가 항목 category입니다.', {
        itemId,
        category,
      }),
    ])
  }

  return ok(category)
}

export function getContributionType2026(
  category: EvaluationPolicyItemCategoryCode
): EvaluationScore2026ContributionType {
  return EVALUATION_POLICY_2026.categories[category].contributionType
}

export function getTargetScore2026(category: EvaluationPolicyItemCategoryCode) {
  const config = EVALUATION_POLICY_2026.categories[category]
  return 'baselineScores' in config ? config.baselineScores?.target : undefined
}

export function is2026FormulaVersion(formulaVersion: string | null | undefined) {
  return formulaVersion === '2026' || formulaVersion === EVALUATION_SCORING_2026_FORMULA_VERSION
}

export function calculateItemBaseScore2026(
  input: EvaluationScore2026ItemInput
): EvaluationScore2026Result<EvaluationScore2026ItemBaseScore> {
  const categoryResult = validateScoringCategory(input.category, input.id)
  if (!categoryResult.ok) return categoryResult

  const category = categoryResult.value
  const config = EVALUATION_POLICY_2026.categories[category]
  const achievementLevel = input.achievementLevel ?? 'CUSTOM'
  const errors: EvaluationScore2026ValidationError[] = []
  let baseScore: number | null = null
  let targetScore: number | undefined

  if (category === 'DAILY_WORK') {
    const maxScore = 'maxScore' in config && typeof config.maxScore === 'number' ? config.maxScore : 80
    if (!isFiniteNumber(input.score)) {
      errors.push(validationError('SCORE_REQUIRED', '일상업무 점수는 숫자 점수가 필요합니다.', { itemId: input.id, category }))
    } else if (input.score < 0) {
      errors.push(validationError('SCORE_OUT_OF_RANGE', '평가 점수는 0점 이상이어야 합니다.', { itemId: input.id, category }))
    } else if (input.score > maxScore) {
      errors.push(
        validationError('DAILY_WORK_SCORE_EXCEEDS_MAX', `일상업무 점수는 ${maxScore}점을 초과할 수 없습니다.`, {
          itemId: input.id,
          category,
        })
      )
    } else {
      baseScore = input.score
    }
  } else if ('baselineScores' in config && config.baselineScores) {
    targetScore = config.baselineScores.target
    if (achievementLevel === 'TARGET') {
      baseScore = config.baselineScores.target
    } else if (achievementLevel === 'EXCELLENT') {
      baseScore = config.baselineScores.excellent
    } else if (!isFiniteNumber(input.score)) {
      errors.push(
        validationError('SCORE_REQUIRED', 'Target/Excellent 외 점수 산정에는 숫자 점수가 필요합니다.', {
          itemId: input.id,
          category,
        })
      )
    } else if (input.score < 0 || input.score > 100) {
      errors.push(
        validationError('SCORE_OUT_OF_RANGE', '2026 평가 항목 점수는 0점 이상 100점 이하이어야 합니다.', {
          itemId: input.id,
          category,
        })
      )
    } else {
      baseScore = input.score
    }
  }

  if (errors.length || baseScore === null) return fail(errors)

  const value: EvaluationScore2026ItemBaseScore = {
    id: input.id,
    category,
    contributionType: getContributionType2026(category),
    achievementLevel,
    baseScore: roundToSingle(baseScore),
    targetScore,
  }

  return ok(value)
}

export function isBelowTarget2026(params: {
  category: EvaluationPolicyItemCategoryCode
  achievementLevel?: EvaluationScore2026AchievementLevel | null
  baseScore?: number | null
}) {
  if (params.achievementLevel === 'BELOW_TARGET') return true
  if (typeof params.baseScore !== 'number' || !isFiniteNumber(params.baseScore)) return false

  const targetScore = getTargetScore2026(params.category)
  return isFiniteNumber(targetScore) && params.baseScore < targetScore
}

export function validateAdjustment2026(params: {
  itemId?: string
  category?: EvaluationPolicyItemCategoryCode | 'UNKNOWN' | null
  achievementLevel?: EvaluationScore2026AchievementLevel | null
  baseScore?: number | null
  adjustmentScore?: number | null
  // enforceTargetGate=true(기본): precondition(basePolicyScore/achievementLevel 둘 다 없으면 거부) +
  // below-target 검사. submit 라우트용. false면 둘 다 건너뜀 — draft 라우트용(작성 중이라 점수/Target 확정 전).
  enforceTargetGate?: boolean
}): EvaluationScore2026Result<null> {
  const enforceTargetGate = params.enforceTargetGate ?? true
  const categoryResult = validateScoringCategory(params.category, params.itemId)
  if (!categoryResult.ok) return categoryResult

  const category = categoryResult.value
  const adjustmentScore = normalizeAdjustment(params.adjustmentScore)
  if (adjustmentScore === 0) return ok(null)

  const errors: EvaluationScore2026ValidationError[] = []
  const rule = EVALUATION_POLICY_2026.adjustmentRule

  if (adjustmentScore < rule.min || adjustmentScore > rule.max) {
    errors.push(
      validationError('ADJUSTMENT_OUT_OF_RANGE', `조정점수는 ${rule.min}점부터 +${rule.max}점까지만 가능합니다.`, {
        itemId: params.itemId,
        category,
      })
    )
  }

  const applicableCategories: readonly string[] = rule.applicableCategories
  if (!applicableCategories.includes(category)) {
    errors.push(
      validationError('ADJUSTMENT_CATEGORY_NOT_ALLOWED', '해당 category에는 2026 조정점수를 적용할 수 없습니다.', {
        itemId: params.itemId,
        category,
      })
    )
  }

  if (enforceTargetGate) {
    const hasBaseScore = typeof params.baseScore === 'number' && isFiniteNumber(params.baseScore)
    const hasAchievementLevel =
      params.achievementLevel === 'BELOW_TARGET' ||
      params.achievementLevel === 'TARGET' ||
      params.achievementLevel === 'EXCELLENT'

    if (!hasBaseScore && !hasAchievementLevel) {
      errors.push(
        validationError(
          'ADJUSTMENT_PRECONDITION_MISSING',
          '가감점 적용 전에 기본 점수(basePolicyScore) 또는 달성 수준(targetAchievementLevel)이 확정되어야 합니다.',
          { itemId: params.itemId, category },
        ),
      )
    } else if (
      rule.notApplicableBelowTarget &&
      isBelowTarget2026({
        category,
        achievementLevel: params.achievementLevel,
        baseScore: params.baseScore,
      })
    ) {
      errors.push(
        validationError('ADJUSTMENT_BELOW_TARGET_NOT_ALLOWED', 'Target 미만 항목에는 2026 조정점수를 적용할 수 없습니다.', {
          itemId: params.itemId,
          category,
        })
      )
    }
  }

  return errors.length ? fail(errors) : ok(null)
}

export function calculateItemScore2026(
  input: EvaluationScore2026ItemInput
): EvaluationScore2026Result<EvaluationScore2026ItemScore> {
  const baseResult = calculateItemBaseScore2026(input)
  if (!baseResult.ok) return baseResult

  const adjustmentScore = normalizeAdjustment(input.adjustmentScore)
  const adjustmentValidation = validateAdjustment2026({
    itemId: input.id,
    category: baseResult.value.category,
    achievementLevel: baseResult.value.achievementLevel,
    baseScore: baseResult.value.baseScore,
    adjustmentScore,
  })
  if (!adjustmentValidation.ok) return adjustmentValidation

  return ok({
    ...baseResult.value,
    adjustmentScore,
    adjustmentGroupKey: input.adjustmentGroupKey?.trim() || undefined,
    finalScore: roundToSingle(baseResult.value.baseScore + adjustmentScore),
    weight: normalizeWeight(input.weight),
  })
}

// 2026 가감점 적용 분기 결정 — submit/draft 라우트가 이 함수로 active/cycle/stage 게이트를 판정한다.
// 분기 true일 때만 라우트가 항목별 validateAdjustment2026 호출 + 가감점 3필드를 DB에 persist.
// cross-person zero-sum 총합 검증은 본부검수(HR) 단계에서 별도로 처리한다.
export type EvaluationAdjustmentStage = 'SELF' | 'FIRST' | 'SECOND' | 'FINAL' | 'CEO_ADJUST'

// 명시적 allowlist. 9단계 확장 시 새 stage가 자동으로 가감점 허용되지 않도록 set 멤버십으로 판정.
export const ALLOWED_ADJUSTMENT_STAGES_2026: ReadonlySet<EvaluationAdjustmentStage> = new Set([
  'FIRST',
  'SECOND',
  'FINAL',
])

export function shouldApplyAdjustmentRule2026(params: {
  cycleYear: number
  evalStage: EvaluationAdjustmentStage
}): boolean {
  if (!EVALUATION_POLICY_2026.adjustmentRule.active) return false
  if (params.cycleYear !== 2026) return false
  return ALLOWED_ADJUSTMENT_STAGES_2026.has(params.evalStage)
}

export function validateAdjustmentGroupZeroSum2026(
  items: Array<Pick<EvaluationScore2026ItemInput, 'id' | 'adjustmentScore' | 'adjustmentGroupKey'>>
): EvaluationScore2026Result<null> {
  const errors: EvaluationScore2026ValidationError[] = []
  const groups = new Map<string, number>()

  for (const item of items) {
    const adjustmentScore = normalizeAdjustment(item.adjustmentScore)
    if (adjustmentScore === 0) continue

    const groupKey = item.adjustmentGroupKey?.trim()
    if (!groupKey) {
      errors.push(
        validationError('ADJUSTMENT_GROUP_REQUIRED', '조정점수가 있는 항목은 zero-sum 검증용 adjustment group이 필요합니다.', {
          itemId: item.id,
        })
      )
      continue
    }

    groups.set(groupKey, (groups.get(groupKey) ?? 0) + adjustmentScore)
  }

  for (const [groupKey, sum] of groups) {
    if (Math.abs(sum) > 0.000001) {
      errors.push(
        validationError('ADJUSTMENT_GROUP_NOT_ZERO_SUM', '2026 조정점수 그룹의 합계는 0이어야 합니다.', {
          groupKey,
        })
      )
    }
  }

  return errors.length ? fail(errors) : ok(null)
}

function weightedAverage2026(rows: WeightedScore[]) {
  if (!rows.length) return null

  const weightSum = rows.reduce((sum, row) => sum + (row.weight ?? 0), 0)
  if (weightSum <= 0) {
    return roundToSingle(rows.reduce((sum, row) => sum + row.score, 0) / rows.length)
  }

  return roundToSingle(rows.reduce((sum, row) => sum + row.score * (row.weight ?? 0), 0) / weightSum)
}

export function calculateOrganizationPerformanceScore2026(items: EvaluationScore2026ItemScore[]) {
  return weightedAverage2026(
    items
      .filter((item) => item.contributionType === 'ORGANIZATION')
      .map((item) => ({
        score: item.finalScore,
        weight: item.weight,
      }))
  )
}

export function calculatePersonalPerformanceScore2026(items: EvaluationScore2026ItemScore[]) {
  return weightedAverage2026(
    items
      .filter((item) => item.contributionType === 'PERSONAL')
      .map((item) => ({
        score: item.finalScore,
        weight: item.weight,
      }))
  )
}

export function calculateFinalPerformanceScore2026(params: EvaluationScore2026SplitResult) {
  const formula = EVALUATION_POLICY_2026.finalScoreFormula
  return roundToSingle(
    params.organizationPerformanceScore * (formula.organizationPerformanceWeight / 100) +
      params.personalPerformanceScore * (formula.personalPerformanceWeight / 100)
  )
}

// III-3 조직목표 미달성 예외 — 슬라이드 14.
// 조직목표(ORG_GOAL)가 BELOW_TARGET이어도, 같은 linkedOrgKpiId를 공유하는 본인 PROJECT_T 항목이
// Target 이상이면 해당 ORG_GOAL 항목 점수를 exceptionScore(80)로 override. 가중 집계 전에 적용해
// 조직 점수에 반영되게 한다. cutover dormant: rule.active=false인 동안 itemScores를 변경 없이 반환.
//
// 정책 상수를 우회한 테스트 주입을 위해 rule/cycleYear 옵셔널 옵션을 지원한다 (가감점
// enforceTargetGate 패턴과 유사). 옵션 미전달이면 EVALUATION_POLICY_2026.belowTargetExceptionRule
// 그대로 사용.
export type BelowTargetExceptionRuleOverride = {
  active: boolean
  exceptionScore: number
  cycleYear: number
}

export function shouldApplyBelowTargetException2026(params: {
  cycleYear: number
  rule?: BelowTargetExceptionRuleOverride
}): boolean {
  const rule = params.rule ?? EVALUATION_POLICY_2026.belowTargetExceptionRule
  if (!rule.active) return false
  return params.cycleYear === rule.cycleYear
}

export function applyBelowTargetOrgGoalException2026(params: {
  items: EvaluationScore2026ItemInput[]
  itemScores: EvaluationScore2026ItemScore[]
  cycleYear: number
  rule?: BelowTargetExceptionRuleOverride
}): EvaluationScore2026ItemScore[] {
  if (!shouldApplyBelowTargetException2026({ cycleYear: params.cycleYear, rule: params.rule })) {
    return params.itemScores
  }
  const exceptionScore = (params.rule ?? EVALUATION_POLICY_2026.belowTargetExceptionRule).exceptionScore

  // items[]에서 linkedOrgKpiId를 itemScores와 매칭하기 위해 id 기반 lookup.
  const inputById = new Map(params.items.filter((item) => item.id).map((item) => [item.id!, item]))

  // 같은 linkedOrgKpiId를 공유하는 PROJECT_T 항목 중 Target 이상인 항목을 미리 인덱싱.
  const projectTAtOrAboveByOrgKpiId = new Set<string>()
  for (const input of params.items) {
    if (input.category !== 'PROJECT_T') continue
    const linkedOrgKpiId = input.linkedOrgKpiId
    if (!linkedOrgKpiId) continue
    const matchedScore = params.itemScores.find((score) => score.id === input.id)
    if (!matchedScore) continue
    const belowTarget = isBelowTarget2026({
      category: 'PROJECT_T',
      achievementLevel: matchedScore.achievementLevel,
      baseScore: matchedScore.baseScore,
    })
    if (!belowTarget) {
      projectTAtOrAboveByOrgKpiId.add(linkedOrgKpiId)
    }
  }

  return params.itemScores.map((score) => {
    if (score.category !== 'ORG_GOAL') return score
    const belowTarget = isBelowTarget2026({
      category: 'ORG_GOAL',
      achievementLevel: score.achievementLevel,
      baseScore: score.baseScore,
    })
    if (!belowTarget) return score
    const linkedOrgKpiId = score.id ? inputById.get(score.id)?.linkedOrgKpiId ?? null : null
    if (!linkedOrgKpiId) return score
    if (!projectTAtOrAboveByOrgKpiId.has(linkedOrgKpiId)) return score
    // 예외 적용 — baseScore와 finalScore 모두 exceptionScore로 override.
    // 정책상 below-target은 가감점 금지(ADJUSTMENT_BELOW_TARGET_NOT_ALLOWED)라 adjustmentScore=0 가정.
    // achievementLevel은 변경하지 않음 — BELOW_TARGET 유지(점수 override만).
    return {
      ...score,
      baseScore: roundToSingle(exceptionScore),
      finalScore: roundToSingle(exceptionScore + score.adjustmentScore),
    }
  })
}

export function calculateEvaluationScore2026(params: {
  items: EvaluationScore2026ItemInput[]
  cycleYear?: number
  belowTargetExceptionRule?: BelowTargetExceptionRuleOverride
}): EvaluationScore2026Result<EvaluationScore2026EvaluationResult> {
  if (!params.items.length) {
    return fail([validationError('ITEMS_REQUIRED', '2026 평가 점수 계산에는 평가 항목이 필요합니다.')])
  }

  const itemScores: EvaluationScore2026ItemScore[] = []
  const errors: EvaluationScore2026ValidationError[] = []

  for (const item of params.items) {
    const result = calculateItemScore2026(item)
    if (result.ok) {
      itemScores.push(result.value)
    } else {
      errors.push(...result.errors)
    }
  }

  const zeroSumValidation = validateAdjustmentGroupZeroSum2026(params.items)
  if (!zeroSumValidation.ok) errors.push(...zeroSumValidation.errors)

  if (errors.length) return fail(errors)

  // III-3 예외 패스: 가중 집계 직전. dormant(rule.active=false)면 itemScores 변경 없음.
  const adjustedItemScores = applyBelowTargetOrgGoalException2026({
    items: params.items,
    itemScores,
    cycleYear: params.cycleYear ?? EVALUATION_POLICY_2026.belowTargetExceptionRule.cycleYear,
    rule: params.belowTargetExceptionRule,
  })

  const organizationPerformanceScore = calculateOrganizationPerformanceScore2026(adjustedItemScores)
  const personalPerformanceScore = calculatePersonalPerformanceScore2026(adjustedItemScores)

  if (organizationPerformanceScore === null || personalPerformanceScore === null) {
    if (organizationPerformanceScore === null) {
      errors.push(validationError('MISSING_ORGANIZATION_SCORE', '2026 최종점수 계산에는 조직성과 점수가 필요합니다.'))
    }
    if (personalPerformanceScore === null) {
      errors.push(validationError('MISSING_PERSONAL_SCORE', '2026 최종점수 계산에는 개인성과 점수가 필요합니다.'))
    }
    return fail(errors)
  }

  const split = {
    organizationPerformanceScore,
    personalPerformanceScore,
  }

  return ok({
    ...split,
    finalScore: calculateFinalPerformanceScore2026(split),
    itemScores: adjustedItemScores,
    formulaVersion: EVALUATION_SCORING_2026_FORMULA_VERSION,
  })
}

export function calculateEvaluationScoreByFormulaVersion(params: {
  formulaVersion?: string | null
  legacyScore: number
  items?: EvaluationScore2026ItemInput[]
}): EvaluationScore2026Result<EvaluationScore2026FormulaPreviewResult> {
  if (!is2026FormulaVersion(params.formulaVersion)) {
    return ok({
      used2026Formula: false,
      score: params.legacyScore,
      formulaVersion: params.formulaVersion ?? 'LEGACY',
    })
  }

  if (!params.items?.length) {
    return fail([validationError('ITEMS_REQUIRED', '2026 preview 산식에는 평가 항목이 필요합니다.')])
  }

  const result2026 = calculateEvaluationScore2026({ items: params.items })
  if (!result2026.ok) return result2026

  return ok({
    used2026Formula: true,
    score: result2026.value.finalScore,
    formulaVersion: EVALUATION_SCORING_2026_FORMULA_VERSION,
    result2026: result2026.value,
  })
}
