export const LEADERSHIP_DIAGNOSIS_CATEGORY_ORDER = [
  '바른생각 (커뮤니케이션)',
  '창의도전 (변화주도)',
  '비전공유 (조직관리)',
  '전략적 사고',
  '혁신',
]

const LEADERSHIP_DIAGNOSIS_CATEGORY_TOTALS = new Map<string, number>([
  ['바른생각 (커뮤니케이션)', 6],
  ['창의도전 (변화주도)', 6],
  ['비전공유 (조직관리)', 6],
  ['전략적 사고', 3],
  ['혁신', 3],
])

export type LeadershipDiagnosisQuestionSummaryInput = {
  questionId?: string
  category?: string | null
  averageScore?: number | null
  responseCount?: number | null
  textResponses?: string[] | null
}

export type LeadershipDiagnosisCategorySummary = {
  category: string
  averageScore: number | null
  responseCount: number
  answeredQuestionCount: number
  totalQuestionCount: number
  percent: number
  questionIds: string[]
  textResponses: string[]
}

function roundToTwoDecimals(value: number) {
  return Math.round(value * 100) / 100
}

export function normalizeLeadershipDiagnosisCategory(value?: string | null) {
  const category = value?.trim()
  if (!category) return '기타'
  return LEADERSHIP_DIAGNOSIS_CATEGORY_ORDER.find((knownCategory) => knownCategory === category) ?? category
}

export function buildLeadershipDiagnosisCategorySummaries(
  questionSummaries: LeadershipDiagnosisQuestionSummaryInput[]
): LeadershipDiagnosisCategorySummary[] {
  const grouped = questionSummaries.reduce(
    (map, question) => {
      const category = normalizeLeadershipDiagnosisCategory(question.category)
      const current = map.get(category) ?? {
        category,
        scores: [] as number[],
        responseCount: 0,
        answeredQuestionCount: 0,
        totalQuestionCount: 0,
        questionIds: [] as string[],
        textResponses: [] as string[],
      }

      current.totalQuestionCount += 1
      if (question.questionId) current.questionIds.push(question.questionId)
      if (Array.isArray(question.textResponses)) current.textResponses.push(...question.textResponses.filter(Boolean))
      if (typeof question.responseCount === 'number') {
        current.responseCount = Math.max(current.responseCount, question.responseCount)
      }
      if (typeof question.averageScore === 'number') {
        current.scores.push(question.averageScore)
        current.answeredQuestionCount += 1
      }

      map.set(category, current)
      return map
    },
    new Map<
      string,
      {
        category: string
        scores: number[]
        responseCount: number
        answeredQuestionCount: number
        totalQuestionCount: number
        questionIds: string[]
        textResponses: string[]
      }
    >()
  )

  return Array.from(grouped.values())
    .map((item) => {
      const averageScore = item.scores.length
        ? roundToTwoDecimals(item.scores.reduce((sum, score) => sum + score, 0) / item.scores.length)
        : null
      const totalQuestionCount =
        LEADERSHIP_DIAGNOSIS_CATEGORY_TOTALS.get(item.category) ?? item.totalQuestionCount

      return {
        category: item.category,
        averageScore,
        responseCount: item.responseCount,
        answeredQuestionCount: item.answeredQuestionCount,
        totalQuestionCount,
        percent: averageScore == null ? 0 : Math.max(0, Math.min(100, roundToTwoDecimals((averageScore / 6) * 100))),
        questionIds: item.questionIds,
        textResponses: Array.from(new Set(item.textResponses)),
      }
    })
    .sort((left, right) => {
      const leftIndex = LEADERSHIP_DIAGNOSIS_CATEGORY_ORDER.indexOf(left.category)
      const rightIndex = LEADERSHIP_DIAGNOSIS_CATEGORY_ORDER.indexOf(right.category)
      if (leftIndex >= 0 && rightIndex >= 0) return leftIndex - rightIndex
      if (leftIndex >= 0) return -1
      if (rightIndex >= 0) return 1
      return left.category.localeCompare(right.category, 'ko')
    })
}

export function getLeadershipDiagnosisStrengthCategories(
  categorySummaries: LeadershipDiagnosisCategorySummary[],
  limit = 3
) {
  return categorySummaries
    .filter((category) => typeof category.averageScore === 'number')
    .sort((left, right) => (right.averageScore ?? 0) - (left.averageScore ?? 0))
    .slice(0, limit)
    .map((category) => category.category)
}

export function getLeadershipDiagnosisDevelopmentCategories(
  categorySummaries: LeadershipDiagnosisCategorySummary[],
  limit = 3
) {
  return categorySummaries
    .filter((category) => typeof category.averageScore === 'number')
    .sort((left, right) => (left.averageScore ?? 0) - (right.averageScore ?? 0))
    .slice(0, limit)
    .map((category) => category.category)
}
