import { Difficulty } from '@prisma/client'

type TeamDepartmentContext = {
  id: string
  name: string
  organizationName: string
}

type PlanningDepartmentContext = TeamDepartmentContext

type BusinessPlanContext = {
  title: string
  summaryText?: string | null
  bodyText: string
}

export type TeamRecommendationSourceOrgKpi = {
  id: string
  kpiName: string
  kpiCategory: string | null
  definition: string | null
  formula: string | null
  targetValueText: string
  weight: number
  difficulty: Difficulty
}

export type ExistingTeamKpiContext = {
  id: string
  kpiName: string
  kpiCategory: string | null
  definition: string | null
  formula?: string | null
  weight: number
  parentOrgKpiId?: string | null
}

export type PrioritizedSourceOrgKpi = {
  id: string
  title: string
  category: string | null
  definition: string | null
  formula: string | null
  targetValueText: string
  weight: number
  difficulty: Difficulty
  priorityTier: 'PRIMARY' | 'SUPPORTING'
  priorityReason: string
  isExplicitParent: boolean
}

export type TeamRecommendationPayload = {
  teamDepartment: TeamDepartmentContext
  planningDepartment: PlanningDepartmentContext
  evalYear: number
  businessPlan: BusinessPlanContext
  currentDraft: {
    title: string
    category: string
    definition: string
    formula: string
    unit: string
    weight: number | null
    difficulty: string
  }
  linkedParentOrgKpis: Array<{
    id: string
    title: string
    category: string | null
    definition: string | null
    formula: string | null
    targetValueText: string
    weight: number
    difficulty: Difficulty
    priorityReason: string
  }>
  supportingParentOrgKpis: Array<{
    id: string
    title: string
    category: string | null
    definition: string | null
    formula: string | null
    targetValueText: string
    weight: number
    difficulty: Difficulty
    priorityReason: string
  }>
  sourceOrgKpis: Array<{
    id: string
    title: string
    category: string | null
    definition: string | null
    formula: string | null
    targetValueText: string
    weight: number
    difficulty: Difficulty
    priorityTier: 'PRIMARY' | 'SUPPORTING'
    priorityReason: string
  }>
  existingTeamKpis: Array<{
    id: string
    title: string
    category: string | null
    definition: string | null
    formula: string | null
    weight: number
    parentOrgKpiId: string | null
  }>
  recommendationRules: string[]
  qualityGuardrails: string[]
}

export type SanitizedTeamRecommendationItem = {
  rank: number
  title: string
  definition: string | null
  formula: string | null
  metricSource: string | null
  targetValueT: number | null
  targetValueE: number | null
  targetValueS: number | null
  unit: string | null
  weightSuggestion: number | null
  difficultySuggestion: Difficulty | null
  sourceOrgKpiId: string | null
  sourceOrgKpiTitle: string | null
  linkageExplanation: string
  recommendationReason: string
  whyThisIsHighQuality: string | null
  controllabilityNote: string | null
  riskComment: string | null
  alignmentScore: number | null
  qualityScore: number | null
  recommendedPriority: number | null
}

type BuildPayloadParams = {
  teamDepartment: TeamDepartmentContext
  planningDepartment: PlanningDepartmentContext
  evalYear: number
  businessPlan: BusinessPlanContext
  currentDraft: TeamRecommendationPayload['currentDraft']
  sourceOrgKpis: TeamRecommendationSourceOrgKpi[]
  existingTeamKpis: ExistingTeamKpiContext[]
  preferredParentOrgKpiId?: string | null
}

type SanitizeParams = {
  item: Record<string, unknown>
  sourceOrgKpis: TeamRecommendationSourceOrgKpi[]
  existingTeamKpis: ExistingTeamKpiContext[]
  rank: number
}

function normalizeText(value: string | null | undefined) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '')
}

function toTrimmedString(value: unknown) {
  return typeof value === 'string' && value.trim().length ? value.trim() : null
}

function toOptionalNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string' && value.trim().length) {
    const parsed = Number(value.trim())
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function clampScore(value: number | null) {
  if (value === null) return null
  return Math.max(0, Math.min(100, Math.round(value)))
}

function resolveDifficulty(value: unknown): Difficulty | null {
  return typeof value === 'string' && ['HIGH', 'MEDIUM', 'LOW'].includes(value)
    ? (value as Difficulty)
    : null
}

function isVagueTitle(title: string) {
  const normalized = normalizeText(title)
  const vagueKeywords = [
    '관리강화',
    '운영지원',
    '지원강화',
    '체계고도화',
    '역량강화',
    '프로세스개선',
    '품질개선',
    '업무개선',
    '협업강화',
  ]

  return vagueKeywords.some((keyword) => normalized.includes(keyword))
}

function buildPriorityIdSet(params: {
  preferredParentOrgKpiId?: string | null
  sourceOrgKpis: TeamRecommendationSourceOrgKpi[]
  existingTeamKpis: ExistingTeamKpiContext[]
}) {
  const validSourceIds = new Set(params.sourceOrgKpis.map((kpi) => kpi.id))
  const ordered: string[] = []

  if (params.preferredParentOrgKpiId && validSourceIds.has(params.preferredParentOrgKpiId)) {
    ordered.push(params.preferredParentOrgKpiId)
  }

  params.existingTeamKpis.forEach((kpi) => {
    if (kpi.parentOrgKpiId && validSourceIds.has(kpi.parentOrgKpiId) && !ordered.includes(kpi.parentOrgKpiId)) {
      ordered.push(kpi.parentOrgKpiId)
    }
  })

  return new Set(ordered)
}

export function prioritizeSourceOrgKpis(params: {
  sourceOrgKpis: TeamRecommendationSourceOrgKpi[]
  existingTeamKpis: ExistingTeamKpiContext[]
  preferredParentOrgKpiId?: string | null
}) {
  const explicitId = params.preferredParentOrgKpiId ?? null
  const priorityIds = buildPriorityIdSet(params)

  return params.sourceOrgKpis
    .map<PrioritizedSourceOrgKpi>((kpi) => {
      const isExplicitParent = Boolean(explicitId && explicitId === kpi.id)
      const isLinkedParent = priorityIds.has(kpi.id)

      return {
        id: kpi.id,
        title: kpi.kpiName,
        category: kpi.kpiCategory,
        definition: kpi.definition,
        formula: kpi.formula,
        targetValueText: kpi.targetValueText,
        weight: kpi.weight,
        difficulty: kpi.difficulty,
        priorityTier: isLinkedParent ? 'PRIMARY' : 'SUPPORTING',
        priorityReason: isExplicitParent
          ? '현재 선택한 상위 본부 KPI와 직접 연결된 KPI'
          : isLinkedParent
            ? '기존 팀 KPI가 이미 연결하고 있는 본부 KPI'
            : '사업계획서와 본부 KPI 풀에서 보조 컨텍스트로 참고할 KPI',
        isExplicitParent,
      }
    })
    .sort((left, right) => {
      if (left.priorityTier !== right.priorityTier) {
        return left.priorityTier === 'PRIMARY' ? -1 : 1
      }

      if (left.isExplicitParent !== right.isExplicitParent) {
        return left.isExplicitParent ? -1 : 1
      }

      if (left.weight !== right.weight) {
        return right.weight - left.weight
      }

      return left.title.localeCompare(right.title, 'ko-KR')
    })
}

export function buildStrategicTeamRecommendationPayload(params: BuildPayloadParams): TeamRecommendationPayload {
  const prioritized = prioritizeSourceOrgKpis({
    sourceOrgKpis: params.sourceOrgKpis,
    existingTeamKpis: params.existingTeamKpis,
    preferredParentOrgKpiId: params.preferredParentOrgKpiId,
  })

  return {
    teamDepartment: params.teamDepartment,
    planningDepartment: params.planningDepartment,
    evalYear: params.evalYear,
    businessPlan: params.businessPlan,
    currentDraft: params.currentDraft,
    linkedParentOrgKpis: prioritized
      .filter((kpi) => kpi.priorityTier === 'PRIMARY')
      .slice(0, 5)
      .map((kpi) => ({
        id: kpi.id,
        title: kpi.title,
        category: kpi.category,
        definition: kpi.definition,
        formula: kpi.formula,
        targetValueText: kpi.targetValueText,
        weight: kpi.weight,
        difficulty: kpi.difficulty,
        priorityReason: kpi.priorityReason,
      })),
    supportingParentOrgKpis: prioritized
      .filter((kpi) => kpi.priorityTier === 'SUPPORTING')
      .slice(0, 6)
      .map((kpi) => ({
        id: kpi.id,
        title: kpi.title,
        category: kpi.category,
        definition: kpi.definition,
        formula: kpi.formula,
        targetValueText: kpi.targetValueText,
        weight: kpi.weight,
        difficulty: kpi.difficulty,
        priorityReason: kpi.priorityReason,
      })),
    sourceOrgKpis: prioritized.map((kpi) => ({
      id: kpi.id,
      title: kpi.title,
      category: kpi.category,
      definition: kpi.definition,
      formula: kpi.formula,
      targetValueText: kpi.targetValueText,
      weight: kpi.weight,
      difficulty: kpi.difficulty,
      priorityTier: kpi.priorityTier,
      priorityReason: kpi.priorityReason,
    })),
    existingTeamKpis: params.existingTeamKpis.map((kpi) => ({
      id: kpi.id,
      title: kpi.kpiName,
      category: kpi.kpiCategory,
      definition: kpi.definition,
      formula: kpi.formula ?? null,
      weight: kpi.weight,
      parentOrgKpiId: kpi.parentOrgKpiId ?? null,
    })),
    recommendationRules: [
      '연결된 본부 KPI를 먼저 읽고, 그 KPI 달성에 직접 기여하는 팀 KPI를 우선 제안한다.',
      '단순 활동 KPI보다 결과 KPI 또는 강한 선행지표를 우선한다.',
      '산식, 데이터 출처, 측정 주기가 명확한 KPI만 제안한다.',
      '팀이 실제로 통제 가능한 범위 안에 있는 KPI를 우선한다.',
      '상위 KPI를 문장만 바꿔 반복한 KPI와 기존 팀 KPI의 중복 KPI는 제외한다.',
      '너무 쉬운 KPI나 모호한 표현만 있는 KPI는 제외한다.',
    ],
    qualityGuardrails: [
      '본부 KPI와 연결 이유를 반드시 적는다.',
      'KPI명만 보아도 무엇을 측정하는지 이해되게 쓴다.',
      'T/E/S 목표값은 stretch 수준으로 제안한다.',
      '외생 변수 영향이 큰 경우에는 리스크와 통제 범위를 함께 적는다.',
    ],
  }
}

function findSourceOrgKpi(
  item: Record<string, unknown>,
  sourceOrgKpis: TeamRecommendationSourceOrgKpi[]
) {
  const linkedId =
    toTrimmedString(item.linkedParentKpiId) ??
    toTrimmedString(item.sourceOrgKpiId)

  if (linkedId) {
    const byId = sourceOrgKpis.find((candidate) => candidate.id === linkedId)
    if (byId) return byId
  }

  const linkedTitle =
    toTrimmedString(item.linkedParentKpiTitle) ??
    toTrimmedString(item.sourceOrgKpiTitle)

  if (linkedTitle) {
    const normalizedTitle = normalizeText(linkedTitle)
    const byTitle = sourceOrgKpis.find((candidate) => normalizeText(candidate.kpiName) === normalizedTitle)
    if (byTitle) return byTitle
  }

  return null
}

function computeRecommendationScores(
  params: Pick<
    SanitizedTeamRecommendationItem,
    | 'title'
    | 'formula'
    | 'metricSource'
    | 'whyThisIsHighQuality'
    | 'controllabilityNote'
    | 'sourceOrgKpiId'
    | 'sourceOrgKpiTitle'
    | 'difficultySuggestion'
  > & {
    alignmentScore: number | null
    qualityScore: number | null
    existingTeamKpis: ExistingTeamKpiContext[]
  }
) {
  const normalizedTitle = normalizeText(params.title)
  const existingDuplicate = params.existingTeamKpis.some(
    (kpi) => normalizeText(kpi.kpiName) === normalizedTitle
  )
  const parentMirror =
    params.sourceOrgKpiTitle && normalizeText(params.sourceOrgKpiTitle) === normalizedTitle

  const computedAlignment =
    params.alignmentScore ??
    clampScore(
      58 +
        (params.sourceOrgKpiId ? 18 : 0) +
        (params.sourceOrgKpiTitle ? 6 : 0) +
        (params.controllabilityNote ? 6 : 0) +
        (params.formula ? 6 : 0)
    )

  const computedQuality =
    params.qualityScore ??
    clampScore(
      54 +
        (params.formula ? 10 : 0) +
        (params.metricSource ? 10 : 0) +
        (params.whyThisIsHighQuality ? 10 : 0) +
        (params.controllabilityNote ? 8 : 0) +
        (params.difficultySuggestion === 'HIGH' ? 6 : params.difficultySuggestion === 'MEDIUM' ? 3 : 0) -
        (isVagueTitle(params.title) ? 18 : 0) -
        (existingDuplicate ? 22 : 0) -
        (parentMirror ? 14 : 0)
    )

  return {
    alignmentScore: computedAlignment,
    qualityScore: computedQuality,
    existingDuplicate,
    parentMirror,
  }
}

export function sanitizeAndRankTeamRecommendationItem(params: SanitizeParams): SanitizedTeamRecommendationItem {
  const sourceOrgKpi = findSourceOrgKpi(params.item, params.sourceOrgKpis)

  const title =
    toTrimmedString(params.item.recommendedTitle) ??
    toTrimmedString(params.item.title) ??
    ''
  const definition =
    toTrimmedString(params.item.recommendedDefinition) ??
    toTrimmedString(params.item.definition)
  const formula = toTrimmedString(params.item.formula)
  const metricSource = toTrimmedString(params.item.metricSource)
  const unit = toTrimmedString(params.item.unit)
  const difficultySuggestion =
    resolveDifficulty(params.item.difficultyLevel) ??
    resolveDifficulty(params.item.difficultySuggestion)
  const linkageExplanation =
    toTrimmedString(params.item.linkageReason) ??
    toTrimmedString(params.item.linkageExplanation) ??
    ''
  const recommendationReason =
    toTrimmedString(params.item.recommendationReason) ??
    toTrimmedString(params.item.whyThisIsHighQuality) ??
    ''
  const whyThisIsHighQuality = toTrimmedString(params.item.whyThisIsHighQuality)
  const controllabilityNote = toTrimmedString(params.item.controllabilityNote)
  const riskComment =
    toTrimmedString(params.item.riskNote) ??
    toTrimmedString(params.item.riskComment)

  const scores = computeRecommendationScores({
    title,
    formula,
    metricSource,
    whyThisIsHighQuality,
    controllabilityNote,
    sourceOrgKpiId: sourceOrgKpi?.id ?? null,
    sourceOrgKpiTitle: sourceOrgKpi?.kpiName ?? null,
    difficultySuggestion,
    alignmentScore: clampScore(toOptionalNumber(params.item.alignmentScore)),
    qualityScore: clampScore(toOptionalNumber(params.item.qualityScore)),
    existingTeamKpis: params.existingTeamKpis,
  })

  const recommendedPriority =
    toOptionalNumber(params.item.recommendedPriority) ??
    (scores.alignmentScore !== null && scores.qualityScore !== null
      ? Math.max(1, Math.min(5, 6 - Math.round((scores.alignmentScore + scores.qualityScore) / 40)))
      : params.rank)

  return {
    rank: params.rank,
    title,
    definition,
    formula,
    metricSource,
    targetValueT: toOptionalNumber(params.item.targetT ?? params.item.targetValueT),
    targetValueE: toOptionalNumber(params.item.targetE ?? params.item.targetValueE),
    targetValueS: toOptionalNumber(params.item.targetS ?? params.item.targetValueS),
    unit,
    weightSuggestion: toOptionalNumber(params.item.weightSuggestion),
    difficultySuggestion,
    sourceOrgKpiId: sourceOrgKpi?.id ?? null,
    sourceOrgKpiTitle: sourceOrgKpi?.kpiName ?? null,
    linkageExplanation,
    recommendationReason,
    whyThisIsHighQuality,
    controllabilityNote,
    riskComment,
    alignmentScore: scores.alignmentScore,
    qualityScore: scores.qualityScore,
    recommendedPriority: recommendedPriority ? Math.round(recommendedPriority) : null,
  }
}

export function rankTeamRecommendationItems(items: SanitizedTeamRecommendationItem[]) {
  return items
    .slice()
    .sort((left, right) => {
      const leftPriority = left.recommendedPriority ?? 99
      const rightPriority = right.recommendedPriority ?? 99
      if (leftPriority !== rightPriority) return leftPriority - rightPriority

      const leftAlignment = left.alignmentScore ?? 0
      const rightAlignment = right.alignmentScore ?? 0
      if (leftAlignment !== rightAlignment) return rightAlignment - leftAlignment

      const leftQuality = left.qualityScore ?? 0
      const rightQuality = right.qualityScore ?? 0
      if (leftQuality !== rightQuality) return rightQuality - leftQuality

      return left.title.localeCompare(right.title, 'ko-KR')
    })
    .map((item, index) => ({
      ...item,
      rank: index + 1,
      recommendedPriority: item.recommendedPriority ?? index + 1,
    }))
}
