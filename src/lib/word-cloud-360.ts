export const WORD_CLOUD_POLARITIES = ['POSITIVE', 'NEGATIVE'] as const
export const WORD_CLOUD_CATEGORIES = ['ATTITUDE', 'ABILITY', 'OTHER'] as const
export const WORD_CLOUD_SOURCE_TYPES = ['KDN', 'MBTI', 'ENNEAGRAM', 'EXTRA'] as const
export const WORD_CLOUD_EVALUATOR_GROUPS = ['MANAGER', 'PEER', 'SUBORDINATE', 'SELF'] as const

export type WordCloudKeywordPolarity = (typeof WORD_CLOUD_POLARITIES)[number]
export type WordCloudKeywordCategory = (typeof WORD_CLOUD_CATEGORIES)[number]
export type WordCloudKeywordSourceType = (typeof WORD_CLOUD_SOURCE_TYPES)[number]
export type WordCloudEvaluatorGroup = (typeof WORD_CLOUD_EVALUATOR_GROUPS)[number]

export type WordCloudKeywordSeed = {
  keyword: string
  polarity: WordCloudKeywordPolarity
  category: WordCloudKeywordCategory
  sourceType: WordCloudKeywordSourceType
  displayOrder: number
  note?: string
  warningFlag?: boolean
}

export type WordCloudSelectionValidation = {
  isValid: boolean
  errors: string[]
}

export type WordCloudEmployeeNode = {
  id: string
  deptId: string
  managerId?: string | null
  status?: string
}

export type WordCloudAssignmentDraft = {
  cycleId: string
  evaluatorId: string
  evaluateeId: string
  evaluatorGroup: WordCloudEvaluatorGroup
}

export type WordCloudResponseItemLike = {
  keywordId: string
  keywordTextSnapshot: string
  polarity: WordCloudKeywordPolarity
  category: WordCloudKeywordCategory
  evaluatorGroup: WordCloudEvaluatorGroup
}

export type WordCloudResponseLike = {
  status: 'DRAFT' | 'SUBMITTED'
  evaluatorGroup: WordCloudEvaluatorGroup
  items: WordCloudResponseItemLike[]
}

export type WordCloudAggregateKeyword = {
  keywordId: string
  keyword: string
  polarity: WordCloudKeywordPolarity
  category: WordCloudKeywordCategory
  count: number
  weight: number
}

export const WORD_CLOUD_CATEGORY_LABELS: Record<WordCloudKeywordCategory, string> = {
  ATTITUDE: '태도',
  ABILITY: '역량',
  OTHER: '기타',
}

export const WORD_CLOUD_POLARITY_LABELS: Record<WordCloudKeywordPolarity, string> = {
  POSITIVE: '긍정',
  NEGATIVE: '부정',
}

export const WORD_CLOUD_GROUP_LABELS: Record<WordCloudEvaluatorGroup, string> = {
  MANAGER: '상사',
  PEER: '동료',
  SUBORDINATE: '구성원',
  SELF: '자기평가',
}

export const DEFAULT_WORD_CLOUD_KEYWORDS: WordCloudKeywordSeed[] = [
  { keyword: '책임감 있음', polarity: 'POSITIVE', category: 'ATTITUDE', sourceType: 'KDN', displayOrder: 1 },
  { keyword: '성실함', polarity: 'POSITIVE', category: 'ATTITUDE', sourceType: 'KDN', displayOrder: 2 },
  { keyword: '협업적임', polarity: 'POSITIVE', category: 'ATTITUDE', sourceType: 'MBTI', displayOrder: 3 },
  { keyword: '배려심 있음', polarity: 'POSITIVE', category: 'ATTITUDE', sourceType: 'ENNEAGRAM', displayOrder: 4 },
  { keyword: '주도적임', polarity: 'POSITIVE', category: 'ATTITUDE', sourceType: 'KDN', displayOrder: 5 },
  { keyword: '침착함', polarity: 'POSITIVE', category: 'ATTITUDE', sourceType: 'MBTI', displayOrder: 6 },
  { keyword: '유연함', polarity: 'POSITIVE', category: 'ATTITUDE', sourceType: 'MBTI', displayOrder: 7 },
  { keyword: '신뢰감 있음', polarity: 'POSITIVE', category: 'ATTITUDE', sourceType: 'KDN', displayOrder: 8 },
  { keyword: '청렴함', polarity: 'POSITIVE', category: 'ATTITUDE', sourceType: 'EXTRA', displayOrder: 9, warningFlag: true },
  { keyword: '성인지 감수성이 높음', polarity: 'POSITIVE', category: 'ATTITUDE', sourceType: 'EXTRA', displayOrder: 10, warningFlag: true },
  { keyword: '갑질 성향이 없음', polarity: 'POSITIVE', category: 'ATTITUDE', sourceType: 'EXTRA', displayOrder: 11, warningFlag: true },
  { keyword: '일 떠넘기기 없음', polarity: 'POSITIVE', category: 'ATTITUDE', sourceType: 'EXTRA', displayOrder: 12, warningFlag: true },
  { keyword: '분석적임', polarity: 'POSITIVE', category: 'ABILITY', sourceType: 'KDN', displayOrder: 13 },
  { keyword: '문제해결력이 좋음', polarity: 'POSITIVE', category: 'ABILITY', sourceType: 'KDN', displayOrder: 14 },
  { keyword: '기획력이 좋음', polarity: 'POSITIVE', category: 'ABILITY', sourceType: 'KDN', displayOrder: 15 },
  { keyword: '커뮤니케이션이 명확함', polarity: 'POSITIVE', category: 'ABILITY', sourceType: 'MBTI', displayOrder: 16 },
  { keyword: '실행력이 좋음', polarity: 'POSITIVE', category: 'ABILITY', sourceType: 'KDN', displayOrder: 17 },
  { keyword: '학습이 빠름', polarity: 'POSITIVE', category: 'ABILITY', sourceType: 'KDN', displayOrder: 18 },
  { keyword: '업무 구조화가 뛰어남', polarity: 'POSITIVE', category: 'ABILITY', sourceType: 'KDN', displayOrder: 19 },
  { keyword: '고객지향적임', polarity: 'POSITIVE', category: 'ABILITY', sourceType: 'KDN', displayOrder: 20 },
  { keyword: '변화 수용력이 높음', polarity: 'POSITIVE', category: 'OTHER', sourceType: 'ENNEAGRAM', displayOrder: 21 },
  { keyword: '조직 적응력이 높음', polarity: 'POSITIVE', category: 'OTHER', sourceType: 'MBTI', displayOrder: 22 },
  { keyword: '책임 회피', polarity: 'NEGATIVE', category: 'ATTITUDE', sourceType: 'KDN', displayOrder: 101 },
  { keyword: '성의 없음', polarity: 'NEGATIVE', category: 'ATTITUDE', sourceType: 'KDN', displayOrder: 102 },
  { keyword: '비협조적임', polarity: 'NEGATIVE', category: 'ATTITUDE', sourceType: 'MBTI', displayOrder: 103 },
  { keyword: '방어적임', polarity: 'NEGATIVE', category: 'ATTITUDE', sourceType: 'ENNEAGRAM', displayOrder: 104 },
  { keyword: '감정기복이 큼', polarity: 'NEGATIVE', category: 'ATTITUDE', sourceType: 'MBTI', displayOrder: 105 },
  { keyword: '소통이 단절됨', polarity: 'NEGATIVE', category: 'ATTITUDE', sourceType: 'KDN', displayOrder: 106 },
  { keyword: '청렴하지 않음', polarity: 'NEGATIVE', category: 'ATTITUDE', sourceType: 'EXTRA', displayOrder: 107, warningFlag: true },
  { keyword: '성인지 감수성이 낮음', polarity: 'NEGATIVE', category: 'ATTITUDE', sourceType: 'EXTRA', displayOrder: 108, warningFlag: true },
  { keyword: '갑질 성향이 많음', polarity: 'NEGATIVE', category: 'ATTITUDE', sourceType: 'EXTRA', displayOrder: 109, warningFlag: true },
  { keyword: '일 떠넘기기 많음', polarity: 'NEGATIVE', category: 'ATTITUDE', sourceType: 'EXTRA', displayOrder: 110, warningFlag: true },
  { keyword: '우선순위 혼선', polarity: 'NEGATIVE', category: 'ABILITY', sourceType: 'KDN', displayOrder: 111 },
  { keyword: '문제정의가 약함', polarity: 'NEGATIVE', category: 'ABILITY', sourceType: 'KDN', displayOrder: 112 },
  { keyword: '실행 지연', polarity: 'NEGATIVE', category: 'ABILITY', sourceType: 'KDN', displayOrder: 113 },
  { keyword: '분석이 피상적임', polarity: 'NEGATIVE', category: 'ABILITY', sourceType: 'KDN', displayOrder: 114 },
  { keyword: '고객관점 부족', polarity: 'NEGATIVE', category: 'ABILITY', sourceType: 'KDN', displayOrder: 115 },
  { keyword: '피드백 수용이 낮음', polarity: 'NEGATIVE', category: 'OTHER', sourceType: 'ENNEAGRAM', displayOrder: 116 },
  { keyword: '변화 저항이 큼', polarity: 'NEGATIVE', category: 'OTHER', sourceType: 'ENNEAGRAM', displayOrder: 117 },
]

export function validateWordCloudSelections(params: {
  positiveKeywordIds: string[]
  negativeKeywordIds: string[]
  positiveLimit: number
  negativeLimit: number
}) {
  const errors: string[] = []

  if (new Set(params.positiveKeywordIds).size !== params.positiveKeywordIds.length) {
    errors.push('긍정 키워드는 중복 선택할 수 없습니다.')
  }

  if (new Set(params.negativeKeywordIds).size !== params.negativeKeywordIds.length) {
    errors.push('부정 키워드는 중복 선택할 수 없습니다.')
  }

  if (params.positiveKeywordIds.length > params.positiveLimit) {
    errors.push(`긍정 키워드는 최대 ${params.positiveLimit}개까지 선택할 수 있습니다.`)
  }

  if (params.negativeKeywordIds.length > params.negativeLimit) {
    errors.push(`부정 키워드는 최대 ${params.negativeLimit}개까지 선택할 수 있습니다.`)
  }

  if (params.positiveKeywordIds.length !== params.positiveLimit) {
    errors.push(`긍정 키워드는 정확히 ${params.positiveLimit}개를 선택해야 제출할 수 있습니다.`)
  }

  if (params.negativeKeywordIds.length !== params.negativeLimit) {
    errors.push(`부정 키워드는 정확히 ${params.negativeLimit}개를 선택해야 제출할 수 있습니다.`)
  }

  return {
    isValid: errors.length === 0,
    errors,
  } satisfies WordCloudSelectionValidation
}

export function buildSuggestedWordCloudAssignments(params: {
  cycleId: string
  employees: WordCloudEmployeeNode[]
  includeSelf: boolean
  peerLimit: number
  subordinateLimit: number
}) {
  const activeEmployees = params.employees.filter((employee) => employee.status !== 'RESIGNED')
  const peersByDept = new Map<string, WordCloudEmployeeNode[]>()
  const subordinateMap = new Map<string, WordCloudEmployeeNode[]>()

  for (const employee of activeEmployees) {
    const peers = peersByDept.get(employee.deptId) ?? []
    peers.push(employee)
    peersByDept.set(employee.deptId, peers)

    if (employee.managerId) {
      const bucket = subordinateMap.get(employee.managerId) ?? []
      bucket.push(employee)
      subordinateMap.set(employee.managerId, bucket)
    }
  }

  const suggestions: WordCloudAssignmentDraft[] = []
  const seen = new Set<string>()

  for (const evaluatee of activeEmployees) {
    const register = (evaluatorId: string, group: WordCloudEvaluatorGroup) => {
      const key = `${params.cycleId}:${evaluatorId}:${evaluatee.id}:${group}`
      if (seen.has(key)) return
      seen.add(key)
      suggestions.push({
        cycleId: params.cycleId,
        evaluatorId,
        evaluateeId: evaluatee.id,
        evaluatorGroup: group,
      })
    }

    if (params.includeSelf) {
      register(evaluatee.id, 'SELF')
    }

    if (evaluatee.managerId) {
      register(evaluatee.managerId, 'MANAGER')
    }

    const peers = (peersByDept.get(evaluatee.deptId) ?? [])
      .filter((employee) => employee.id !== evaluatee.id)
      .slice(0, params.peerLimit)
    peers.forEach((peer) => register(peer.id, 'PEER'))

    const subordinates = (subordinateMap.get(evaluatee.id) ?? []).slice(0, params.subordinateLimit)
    subordinates.forEach((employee) => register(employee.id, 'SUBORDINATE'))
  }

  return suggestions
}

export function aggregateWordCloudResponses(params: {
  responses: WordCloudResponseLike[]
  minimumResponses: number
  selectedGroup?: WordCloudEvaluatorGroup | 'ALL'
}) {
  const submitted = params.responses.filter((response) => response.status === 'SUBMITTED')
  const filtered =
    params.selectedGroup && params.selectedGroup !== 'ALL'
      ? submitted.filter((response) => response.evaluatorGroup === params.selectedGroup)
      : submitted

  const keywordMap = new Map<string, WordCloudAggregateKeyword>()
  const categoryCounts = new Map<string, number>()
  const groupCounts = new Map<WordCloudEvaluatorGroup, number>()
  let positiveSelectionCount = 0
  let negativeSelectionCount = 0

  for (const response of filtered) {
    groupCounts.set(response.evaluatorGroup, (groupCounts.get(response.evaluatorGroup) ?? 0) + 1)

    for (const item of response.items) {
      const key = `${item.polarity}:${item.keywordId}`
      const existing = keywordMap.get(key)
      if (existing) {
        existing.count += 1
      } else {
        keywordMap.set(key, {
          keywordId: item.keywordId,
          keyword: item.keywordTextSnapshot,
          polarity: item.polarity,
          category: item.category,
          count: 1,
          weight: 0,
        })
      }

      const categoryKey = `${item.polarity}:${item.category}`
      categoryCounts.set(categoryKey, (categoryCounts.get(categoryKey) ?? 0) + 1)

      if (item.polarity === 'POSITIVE') positiveSelectionCount += 1
      else negativeSelectionCount += 1
    }
  }

  const allKeywords = Array.from(keywordMap.values()).sort((left, right) => {
    if (right.count !== left.count) return right.count - left.count
    return left.keyword.localeCompare(right.keyword, 'ko-KR')
  })

  const maxCount = allKeywords[0]?.count ?? 1
  allKeywords.forEach((item) => {
    item.weight = Math.max(1, Math.round((item.count / maxCount) * 10))
  })

  const byPolarity = (polarity: WordCloudKeywordPolarity) => allKeywords.filter((item) => item.polarity === polarity)

  return {
    responseCount: filtered.length,
    thresholdMet: filtered.length >= params.minimumResponses,
    positiveSelectionCount,
    negativeSelectionCount,
    positiveKeywords: byPolarity('POSITIVE'),
    negativeKeywords: byPolarity('NEGATIVE'),
    categorySummary: WORD_CLOUD_POLARITIES.flatMap((polarity) =>
      WORD_CLOUD_CATEGORIES.map((category) => ({
        polarity,
        category,
        count: categoryCounts.get(`${polarity}:${category}`) ?? 0,
      }))
    ),
    evaluatorGroupSummary: WORD_CLOUD_EVALUATOR_GROUPS.map((group) => ({
      evaluatorGroup: group,
      responseCount: groupCounts.get(group) ?? 0,
    })),
  }
}
