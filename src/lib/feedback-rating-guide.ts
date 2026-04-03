export type FeedbackRatingDistributionMode = 'NONE' | 'RATIO' | 'HEADCOUNT'
export type FeedbackRatingDistributionScope = 'EVALUATOR' | 'DEPARTMENT'

export type FeedbackRatingQuestionMeta = {
  id: string
  questionText: string
  scaleMin?: number | null
  scaleMax?: number | null
}

export type FeedbackRatingGuideScaleEntry = {
  value: number
  label: string
  description: string
  targetRatio: number | null
  headcountLimit: number | null
  isNonEvaluative: boolean
}

export type FeedbackRatingGuideRuleFilters = {
  departmentKeyword?: string
  roleKeyword?: string
  position?: string
  jobTitleKeyword?: string
  teamNameKeyword?: string
}

export type FeedbackRatingGuideRule = {
  id: string
  label: string
  headline: string
  guidance: string
  filters: FeedbackRatingGuideRuleFilters
  gradeDescriptions: Record<string, string>
}

export type FeedbackRatingGuideSettings = {
  distributionQuestionId?: string
  distributionMode: FeedbackRatingDistributionMode
  distributionScope: FeedbackRatingDistributionScope
  scaleEntries: FeedbackRatingGuideScaleEntry[]
  guideRules: FeedbackRatingGuideRule[]
}

export type FeedbackRatingGuideScaleDisplayEntry = FeedbackRatingGuideScaleEntry & {
  isHighest: boolean
  isLowest: boolean
}

export type FeedbackRatingGuideTargetProfile = {
  departmentName?: string | null
  role?: string | null
  position?: string | null
  jobTitle?: string | null
  teamName?: string | null
}

export const DEFAULT_FEEDBACK_RATING_GUIDE_SETTINGS: FeedbackRatingGuideSettings = {
  distributionMode: 'NONE',
  distributionScope: 'EVALUATOR',
  scaleEntries: [],
  guideRules: [],
}

function normalizeKeyword(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeNullableNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function normalizeNullableInteger(value: unknown) {
  return typeof value === 'number' && Number.isInteger(value) ? value : null
}

export function buildFeedbackRatingScaleEntries(params: {
  scaleMin?: number | null
  scaleMax?: number | null
  existingEntries?: FeedbackRatingGuideScaleEntry[]
}): FeedbackRatingGuideScaleEntry[] {
  const scaleMin = params.scaleMin ?? 1
  const scaleMax = params.scaleMax ?? 5
  const existingMap = new Map((params.existingEntries ?? []).map((entry) => [entry.value, entry] as const))

  return Array.from({ length: scaleMax - scaleMin + 1 }, (_, index) => scaleMax - index).map((value) => {
    const existing = existingMap.get(value)

    return {
      value,
      label: normalizeKeyword(existing?.label) || String(value),
      description: normalizeKeyword(existing?.description),
      targetRatio: normalizeNullableNumber(existing?.targetRatio),
      headcountLimit: normalizeNullableInteger(existing?.headcountLimit),
      isNonEvaluative: Boolean(existing?.isNonEvaluative),
    }
  })
}

export function annotateFeedbackRatingScaleEntries(
  entries: FeedbackRatingGuideScaleEntry[]
): FeedbackRatingGuideScaleDisplayEntry[] {
  const evaluative = entries.filter((entry) => !entry.isNonEvaluative)
  const highestValue = evaluative[0]?.value ?? null
  const lowestValue = evaluative[evaluative.length - 1]?.value ?? null

  return entries.map((entry) => ({
    ...entry,
    isHighest: highestValue != null && entry.value === highestValue,
    isLowest: lowestValue != null && entry.value === lowestValue,
  }))
}

export function parseFeedbackRatingGuideSettings(
  input: unknown,
  ratingQuestions: FeedbackRatingQuestionMeta[] = []
): FeedbackRatingGuideSettings {
  if (!input || typeof input !== 'object') {
    const selectedQuestion = ratingQuestions[0]
    return {
      ...DEFAULT_FEEDBACK_RATING_GUIDE_SETTINGS,
      distributionQuestionId: selectedQuestion?.id,
      scaleEntries: selectedQuestion
        ? buildFeedbackRatingScaleEntries({
            scaleMin: selectedQuestion.scaleMin,
            scaleMax: selectedQuestion.scaleMax,
          })
        : [],
    }
  }

  const raw = input as {
    distributionQuestionId?: unknown
    distributionMode?: unknown
    distributionScope?: unknown
    scaleEntries?: unknown
    guideRules?: unknown
  }

  const selectedQuestion =
    ratingQuestions.find((question) => question.id === raw.distributionQuestionId) ?? ratingQuestions[0]

  const scaleEntries = Array.isArray(raw.scaleEntries)
    ? raw.scaleEntries
        .filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === 'object'))
        .map((entry) => ({
          value: typeof entry.value === 'number' ? entry.value : Number(entry.value ?? 0),
          label: normalizeKeyword(entry.label),
          description: normalizeKeyword(entry.description),
          targetRatio: normalizeNullableNumber(entry.targetRatio),
          headcountLimit: normalizeNullableInteger(entry.headcountLimit),
          isNonEvaluative: Boolean(entry.isNonEvaluative),
        }))
        .filter((entry) => Number.isInteger(entry.value))
    : []

  const guideRules = Array.isArray(raw.guideRules)
    ? raw.guideRules
        .filter((rule): rule is Record<string, unknown> => Boolean(rule && typeof rule === 'object'))
        .map((rule, index) => ({
          id: normalizeKeyword(rule.id) || `rule-${index + 1}`,
          label: normalizeKeyword(rule.label) || `가이드 ${index + 1}`,
          headline: normalizeKeyword(rule.headline),
          guidance: normalizeKeyword(rule.guidance),
          filters: {
            departmentKeyword: normalizeKeyword((rule.filters as Record<string, unknown> | undefined)?.departmentKeyword),
            roleKeyword: normalizeKeyword((rule.filters as Record<string, unknown> | undefined)?.roleKeyword),
            position: normalizeKeyword((rule.filters as Record<string, unknown> | undefined)?.position),
            jobTitleKeyword: normalizeKeyword((rule.filters as Record<string, unknown> | undefined)?.jobTitleKeyword),
            teamNameKeyword: normalizeKeyword((rule.filters as Record<string, unknown> | undefined)?.teamNameKeyword),
          },
          gradeDescriptions:
            rule.gradeDescriptions && typeof rule.gradeDescriptions === 'object'
              ? Object.fromEntries(
                  Object.entries(rule.gradeDescriptions as Record<string, unknown>)
                    .map(([key, value]) => [key, normalizeKeyword(value)] as const)
                    .filter(([, value]) => value.length > 0)
                )
              : {},
        }))
    : []

  return {
    distributionQuestionId: selectedQuestion?.id,
    distributionMode:
      raw.distributionMode === 'RATIO' || raw.distributionMode === 'HEADCOUNT' ? raw.distributionMode : 'NONE',
    distributionScope: raw.distributionScope === 'DEPARTMENT' ? 'DEPARTMENT' : 'EVALUATOR',
    scaleEntries: selectedQuestion
      ? buildFeedbackRatingScaleEntries({
          scaleMin: selectedQuestion.scaleMin,
          scaleMax: selectedQuestion.scaleMax,
          existingEntries: scaleEntries,
        })
      : [],
    guideRules: guideRules.filter((rule) => rule.headline || rule.guidance || hasGuideRuleFilters(rule.filters)),
  }
}

function hasGuideRuleFilters(filters: FeedbackRatingGuideRuleFilters) {
  return Boolean(
    normalizeKeyword(filters.departmentKeyword) ||
      normalizeKeyword(filters.roleKeyword) ||
      normalizeKeyword(filters.position) ||
      normalizeKeyword(filters.jobTitleKeyword) ||
      normalizeKeyword(filters.teamNameKeyword)
  )
}

function includesKeyword(source: string | null | undefined, keyword: string | undefined) {
  const normalizedKeyword = normalizeKeyword(keyword).toLowerCase()
  if (!normalizedKeyword) return true
  return normalizeKeyword(source).toLowerCase().includes(normalizedKeyword)
}

export function resolveFeedbackRatingGuideRule(params: {
  rules: FeedbackRatingGuideRule[]
  target: FeedbackRatingGuideTargetProfile
}): FeedbackRatingGuideRule | null {
  let winner: FeedbackRatingGuideRule | null = null
  let winnerWeight = -1

  for (const rule of params.rules) {
    const filters = rule.filters
    const matches =
      includesKeyword(params.target.departmentName, filters.departmentKeyword) &&
      includesKeyword(params.target.role, filters.roleKeyword) &&
      includesKeyword(params.target.jobTitle, filters.jobTitleKeyword) &&
      includesKeyword(params.target.teamName, filters.teamNameKeyword) &&
      (!normalizeKeyword(filters.position) ||
        normalizeKeyword(params.target.position).toLowerCase() === normalizeKeyword(filters.position).toLowerCase())

    if (!matches) continue

    const weight = [
      filters.departmentKeyword,
      filters.roleKeyword,
      filters.position,
      filters.jobTitleKeyword,
      filters.teamNameKeyword,
    ].filter((value) => normalizeKeyword(value).length > 0).length

    if (weight > winnerWeight) {
      winner = rule
      winnerWeight = weight
    }
  }

  return winner
}

export function buildFeedbackRatingGuideDescriptionMap(params: {
  entries: FeedbackRatingGuideScaleEntry[]
  rule: FeedbackRatingGuideRule | null
}) {
  return Object.fromEntries(
    params.entries.map((entry) => [
      entry.value,
      params.rule?.gradeDescriptions[String(entry.value)] || entry.description,
    ])
  ) as Record<number, string>
}

export function calculateFeedbackRatingRecommendedCount(targetRatio: number | null, scopeCount: number) {
  if (!targetRatio || scopeCount <= 0) return null
  const raw = Math.round((targetRatio / 100) * scopeCount)
  return raw === 0 ? 1 : raw
}

export function describeFeedbackRatingDistributionMode(mode: FeedbackRatingDistributionMode) {
  switch (mode) {
    case 'HEADCOUNT':
      return {
        label: '인원 기준',
        description: '등급별 제한 인원을 초과하면 제출이 차단됩니다.',
      }
    case 'RATIO':
      return {
        label: '비율 기준',
        description: '등급별 권장 비율과 현재 분포를 참고할 수 있습니다.',
      }
    default:
      return {
        label: '가이드 없음',
        description: '등급 배분 강제는 적용되지 않습니다.',
      }
  }
}

export function describeFeedbackRatingDistributionScope(scope: FeedbackRatingDistributionScope) {
  return scope === 'DEPARTMENT' ? '조직 기준' : '평가자 기준'
}
