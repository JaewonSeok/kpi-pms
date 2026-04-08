export const WORD_CLOUD_POLARITIES = ['POSITIVE', 'NEGATIVE'] as const
export const WORD_CLOUD_CATEGORIES = ['ATTITUDE', 'ABILITY', 'BOTH', 'OTHER'] as const
export const WORD_CLOUD_SOURCE_TYPES = ['DOCUMENT_FINAL', 'EXTRA_GOVERNANCE', 'ADMIN_ADDED', 'IMPORTED'] as const
export const WORD_CLOUD_EVALUATOR_GROUPS = ['MANAGER', 'PEER', 'SUBORDINATE', 'SELF'] as const

export type WordCloudKeywordPolarity = (typeof WORD_CLOUD_POLARITIES)[number]
export type WordCloudKeywordCategory = (typeof WORD_CLOUD_CATEGORIES)[number]
export type WordCloudKeywordSourceType = (typeof WORD_CLOUD_SOURCE_TYPES)[number]
export type WordCloudEvaluatorGroup = (typeof WORD_CLOUD_EVALUATOR_GROUPS)[number]

export type WordCloudKeywordSeed = {
  keywordCode?: string
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
  BOTH: '태도/역량',
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

export const WORD_CLOUD_SOURCE_TYPE_LABELS: Record<WordCloudKeywordSourceType, string> = {
  DOCUMENT_FINAL: '문서 확정',
  EXTRA_GOVERNANCE: '거버넌스 추가',
  ADMIN_ADDED: '관리자 추가',
  IMPORTED: 'CSV 업로드',
}

export const DEFAULT_WORD_CLOUD_KEYWORDS: WordCloudKeywordSeed[] = [
  { keywordCode: 'POS_001', keyword: '책임감 있음', polarity: 'POSITIVE', category: 'ATTITUDE', sourceType: 'DOCUMENT_FINAL', displayOrder: 1 },
  { keywordCode: 'POS_002', keyword: '성실함', polarity: 'POSITIVE', category: 'ATTITUDE', sourceType: 'DOCUMENT_FINAL', displayOrder: 2 },
  { keywordCode: 'POS_003', keyword: '협업적임', polarity: 'POSITIVE', category: 'ATTITUDE', sourceType: 'DOCUMENT_FINAL', displayOrder: 3 },
  { keywordCode: 'POS_004', keyword: '배려심 있음', polarity: 'POSITIVE', category: 'ATTITUDE', sourceType: 'DOCUMENT_FINAL', displayOrder: 4 },
  { keywordCode: 'POS_005', keyword: '주도적임', polarity: 'POSITIVE', category: 'ATTITUDE', sourceType: 'DOCUMENT_FINAL', displayOrder: 5 },
  { keywordCode: 'POS_006', keyword: '침착함', polarity: 'POSITIVE', category: 'ATTITUDE', sourceType: 'DOCUMENT_FINAL', displayOrder: 6 },
  { keywordCode: 'POS_007', keyword: '유연함', polarity: 'POSITIVE', category: 'ATTITUDE', sourceType: 'DOCUMENT_FINAL', displayOrder: 7 },
  { keywordCode: 'POS_008', keyword: '신뢰감 있음', polarity: 'POSITIVE', category: 'ATTITUDE', sourceType: 'DOCUMENT_FINAL', displayOrder: 8 },
  { keywordCode: 'POS_009', keyword: '청렴함', polarity: 'POSITIVE', category: 'ATTITUDE', sourceType: 'EXTRA_GOVERNANCE', displayOrder: 9, warningFlag: true },
  { keywordCode: 'POS_010', keyword: '성인지 감수성이 높음', polarity: 'POSITIVE', category: 'ATTITUDE', sourceType: 'EXTRA_GOVERNANCE', displayOrder: 10, warningFlag: true },
  { keywordCode: 'POS_011', keyword: '갑질 성향이 없음', polarity: 'POSITIVE', category: 'ATTITUDE', sourceType: 'EXTRA_GOVERNANCE', displayOrder: 11, warningFlag: true },
  { keywordCode: 'POS_012', keyword: '일 떠넘기기 없음', polarity: 'POSITIVE', category: 'ATTITUDE', sourceType: 'EXTRA_GOVERNANCE', displayOrder: 12, warningFlag: true },
  { keywordCode: 'POS_013', keyword: '분석적임', polarity: 'POSITIVE', category: 'ABILITY', sourceType: 'DOCUMENT_FINAL', displayOrder: 13 },
  { keywordCode: 'POS_014', keyword: '문제해결력이 좋음', polarity: 'POSITIVE', category: 'ABILITY', sourceType: 'DOCUMENT_FINAL', displayOrder: 14 },
  { keywordCode: 'POS_015', keyword: '기획력이 좋음', polarity: 'POSITIVE', category: 'ABILITY', sourceType: 'DOCUMENT_FINAL', displayOrder: 15 },
  { keywordCode: 'POS_016', keyword: '커뮤니케이션이 명확함', polarity: 'POSITIVE', category: 'ABILITY', sourceType: 'DOCUMENT_FINAL', displayOrder: 16 },
  { keywordCode: 'POS_017', keyword: '실행력이 좋음', polarity: 'POSITIVE', category: 'ABILITY', sourceType: 'DOCUMENT_FINAL', displayOrder: 17 },
  { keywordCode: 'POS_018', keyword: '학습이 빠름', polarity: 'POSITIVE', category: 'ABILITY', sourceType: 'DOCUMENT_FINAL', displayOrder: 18 },
  { keywordCode: 'POS_019', keyword: '업무 구조화가 뛰어남', polarity: 'POSITIVE', category: 'ABILITY', sourceType: 'DOCUMENT_FINAL', displayOrder: 19 },
  { keywordCode: 'POS_020', keyword: '고객지향적임', polarity: 'POSITIVE', category: 'ABILITY', sourceType: 'DOCUMENT_FINAL', displayOrder: 20 },
  { keywordCode: 'POS_021', keyword: '변화 수용력이 높음', polarity: 'POSITIVE', category: 'OTHER', sourceType: 'DOCUMENT_FINAL', displayOrder: 21 },
  { keywordCode: 'POS_022', keyword: '조직 적응력이 높음', polarity: 'POSITIVE', category: 'OTHER', sourceType: 'DOCUMENT_FINAL', displayOrder: 22 },
  { keywordCode: 'NEG_001', keyword: '책임 회피', polarity: 'NEGATIVE', category: 'ATTITUDE', sourceType: 'DOCUMENT_FINAL', displayOrder: 101 },
  { keywordCode: 'NEG_002', keyword: '성의 없음', polarity: 'NEGATIVE', category: 'ATTITUDE', sourceType: 'DOCUMENT_FINAL', displayOrder: 102 },
  { keywordCode: 'NEG_003', keyword: '비협조적임', polarity: 'NEGATIVE', category: 'ATTITUDE', sourceType: 'DOCUMENT_FINAL', displayOrder: 103 },
  { keywordCode: 'NEG_004', keyword: '방어적임', polarity: 'NEGATIVE', category: 'ATTITUDE', sourceType: 'DOCUMENT_FINAL', displayOrder: 104 },
  { keywordCode: 'NEG_005', keyword: '감정기복이 큼', polarity: 'NEGATIVE', category: 'ATTITUDE', sourceType: 'DOCUMENT_FINAL', displayOrder: 105 },
  { keywordCode: 'NEG_006', keyword: '소통이 단절됨', polarity: 'NEGATIVE', category: 'ATTITUDE', sourceType: 'DOCUMENT_FINAL', displayOrder: 106 },
  { keywordCode: 'NEG_007', keyword: '청렴하지 않음', polarity: 'NEGATIVE', category: 'ATTITUDE', sourceType: 'EXTRA_GOVERNANCE', displayOrder: 107, warningFlag: true },
  { keywordCode: 'NEG_008', keyword: '성인지 감수성이 낮음', polarity: 'NEGATIVE', category: 'ATTITUDE', sourceType: 'EXTRA_GOVERNANCE', displayOrder: 108, warningFlag: true },
  { keywordCode: 'NEG_009', keyword: '갑질 성향이 많음', polarity: 'NEGATIVE', category: 'ATTITUDE', sourceType: 'EXTRA_GOVERNANCE', displayOrder: 109, warningFlag: true },
  { keywordCode: 'NEG_010', keyword: '일 떠넘기기 많음', polarity: 'NEGATIVE', category: 'ATTITUDE', sourceType: 'EXTRA_GOVERNANCE', displayOrder: 110, warningFlag: true },
  { keywordCode: 'NEG_011', keyword: '우선순위 혼선', polarity: 'NEGATIVE', category: 'ABILITY', sourceType: 'DOCUMENT_FINAL', displayOrder: 111 },
  { keywordCode: 'NEG_012', keyword: '문제정의가 약함', polarity: 'NEGATIVE', category: 'ABILITY', sourceType: 'DOCUMENT_FINAL', displayOrder: 112 },
  { keywordCode: 'NEG_013', keyword: '실행 지연', polarity: 'NEGATIVE', category: 'ABILITY', sourceType: 'DOCUMENT_FINAL', displayOrder: 113 },
  { keywordCode: 'NEG_014', keyword: '분석이 피상적임', polarity: 'NEGATIVE', category: 'ABILITY', sourceType: 'DOCUMENT_FINAL', displayOrder: 114 },
  { keywordCode: 'NEG_015', keyword: '고객관점 부족', polarity: 'NEGATIVE', category: 'ABILITY', sourceType: 'DOCUMENT_FINAL', displayOrder: 115 },
  { keywordCode: 'NEG_016', keyword: '피드백 수용이 낮음', polarity: 'NEGATIVE', category: 'OTHER', sourceType: 'DOCUMENT_FINAL', displayOrder: 116 },
  { keywordCode: 'NEG_017', keyword: '변화 저항이 큼', polarity: 'NEGATIVE', category: 'OTHER', sourceType: 'DOCUMENT_FINAL', displayOrder: 117 },
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

export function validateWordCloudSubmitSelections(params: {
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

  if (params.positiveKeywordIds.length < 1) {
    errors.push('긍정 키워드와 부정 키워드는 각각 1개 이상 선택해 주세요.')
  }

  if (params.negativeKeywordIds.length < 1) {
    errors.push('긍정 키워드와 부정 키워드는 각각 1개 이상 선택해 주세요.')
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
