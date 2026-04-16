import { Difficulty, TeamKpiRecommendationType } from '@prisma/client'

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

type JobDescriptionContext = {
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

export type DualTrackTeamRecommendationPayload = {
  teamDepartment: TeamDepartmentContext
  planningDepartment: PlanningDepartmentContext
  evalYear: number
  businessPlan: BusinessPlanContext
  divisionJobDescription: JobDescriptionContext
  teamJobDescription: JobDescriptionContext
  linkedParentOrgKpis: TeamRecommendationPayload['linkedParentOrgKpis']
  supportingParentOrgKpis: TeamRecommendationPayload['supportingParentOrgKpis']
  sourceOrgKpis: TeamRecommendationPayload['sourceOrgKpis']
  existingTeamKpis: TeamRecommendationPayload['existingTeamKpis']
  alignedRecommendationRules: string[]
  independentRecommendationRules: string[]
  qualityGuardrails: string[]
  trendGuidance: string[]
}

export type SanitizedTeamRecommendationItem = {
  rank: number
  recommendationType: TeamKpiRecommendationType
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
  basedOnJobDescription: boolean | null
  jobDescriptionEvidence: string | null
  trendRationale: string | null
  whyThisFitsTeamRole: string | null
  controllabilityNote: string | null
  riskComment: string | null
  alignmentScore: number | null
  qualityScore: number | null
  difficultyScore: number | null
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

type BuildDualTrackPayloadParams = {
  teamDepartment: TeamDepartmentContext
  planningDepartment: PlanningDepartmentContext
  evalYear: number
  businessPlan: BusinessPlanContext
  divisionJobDescription: JobDescriptionContext
  teamJobDescription: JobDescriptionContext
  sourceOrgKpis: TeamRecommendationSourceOrgKpi[]
  existingTeamKpis: ExistingTeamKpiContext[]
  preferredParentOrgKpiId?: string | null
}

type SanitizeParams = {
  item: Record<string, unknown>
  sourceOrgKpis: TeamRecommendationSourceOrgKpi[]
  existingTeamKpis: ExistingTeamKpiContext[]
  rank: number
  recommendationType?: TeamKpiRecommendationType
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
  const vagueKeywords = ['강화', '지원', '고도화', '관리', '개선', '운영', '체계']

  return vagueKeywords.some((keyword) => normalized.includes(normalizeText(keyword)))
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
          ? '현재 팀 KPI와 직접 연결된 상위 본부 KPI입니다.'
          : isLinkedParent
            ? '기존 팀 KPI가 이미 연결하고 있는 상위 본부 KPI입니다.'
            : '전략 맥락을 보강하는 보조 상위 KPI입니다.',
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
      '연결된 본부 KPI를 먼저 읽고, 그 KPI 달성에 직접 기여하는 팀 KPI를 우선 추천한다.',
      '활동 나열형 KPI보다 결과 KPI 또는 결과와 강하게 연결된 선행 KPI를 우선한다.',
      '팀이 실제로 통제 가능한 지표만 추천한다.',
      '상위 KPI를 문장만 바꿔 반복한 KPI와 기존 팀 KPI 중복안은 제외한다.',
      'KPI명, 정의, 산식, 데이터 출처, T/E/S 목표값이 모두 구체적이어야 한다.',
    ],
    qualityGuardrails: [
      '측정 가능성, 통제 가능성, 도전성, 명확성이 모두 충족되어야 한다.',
      'KPI명만 보아도 무엇을 측정하는지 이해 가능해야 한다.',
      '지나치게 쉬운 KPI, 모호한 표현, 외부 변수 의존도가 과도한 KPI는 제외한다.',
    ],
  }
}

export function buildDualTrackTeamRecommendationPayload(
  params: BuildDualTrackPayloadParams
): DualTrackTeamRecommendationPayload {
  const base = buildStrategicTeamRecommendationPayload({
    teamDepartment: params.teamDepartment,
    planningDepartment: params.planningDepartment,
    evalYear: params.evalYear,
    businessPlan: params.businessPlan,
    currentDraft: {
      title: '',
      category: '',
      definition: '',
      formula: '',
      unit: '',
      weight: null,
      difficulty: 'MEDIUM',
    },
    sourceOrgKpis: params.sourceOrgKpis,
    existingTeamKpis: params.existingTeamKpis,
    preferredParentOrgKpiId: params.preferredParentOrgKpiId,
  })

  return {
    ...base,
    divisionJobDescription: params.divisionJobDescription,
    teamJobDescription: params.teamJobDescription,
    alignedRecommendationRules: [
      '연결된 본부 KPI를 먼저 읽고, 그 KPI를 팀 차원에서 실행 가능하게 분해한 KPI만 추천한다.',
      '본부 KPI 문장을 단순 반복하지 말고, 팀이 실제로 통제 가능한 실행 KPI로 바꾼다.',
      '상위 KPI와의 연결 이유를 각 추천안마다 반드시 설명한다.',
      '정렬도, 측정 가능성, 도전성, 통제 가능성을 함께 만족하는 KPI를 우선한다.',
    ],
    independentRecommendationRules: [
      '본부 직무기술서와 팀 직무기술서를 먼저 읽고 팀 고유 역할에 필요한 KPI만 추천한다.',
      '연계형 KPI와 겹치지 않는 독립 KPI를 2~3개만 추천한다.',
      '모호한 활동 KPI는 제외하고, 역할 적합성과 측정 가능성이 높은 KPI를 추천한다.',
      '현재 저장된 문서와 일반적인 운영 관점만 사용하고 확인되지 않은 최신 트렌드는 단정하지 않는다.',
    ],
    qualityGuardrails: [
      ...base.qualityGuardrails,
      '독립형 KPI는 직무기술서 근거와 팀 역할 적합성 설명이 반드시 있어야 한다.',
      '연계형 KPI는 linkedParentKpiId, linkedParentKpiTitle, linkageReason이 반드시 채워져야 한다.',
    ],
    trendGuidance: [
      '외부 검색이 없으면 저장된 직무기술서와 일반적인 산업 운영 관점 기준으로만 trend rationale을 작성한다.',
      '확인되지 않은 최신 동향을 단정적으로 서술하지 않는다.',
    ],
  }
}

function findSourceOrgKpi(
  item: Record<string, unknown>,
  sourceOrgKpis: TeamRecommendationSourceOrgKpi[]
) {
  const linkedId = toTrimmedString(item.linkedParentKpiId) ?? toTrimmedString(item.sourceOrgKpiId)

  if (linkedId) {
    const byId = sourceOrgKpis.find((candidate) => candidate.id === linkedId)
    if (byId) return byId
  }

  const linkedTitle = toTrimmedString(item.linkedParentKpiTitle) ?? toTrimmedString(item.sourceOrgKpiTitle)

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
    | 'recommendationType'
    | 'title'
    | 'formula'
    | 'metricSource'
    | 'whyThisIsHighQuality'
    | 'basedOnJobDescription'
    | 'jobDescriptionEvidence'
    | 'trendRationale'
    | 'whyThisFitsTeamRole'
    | 'controllabilityNote'
    | 'sourceOrgKpiId'
    | 'sourceOrgKpiTitle'
    | 'difficultySuggestion'
  > & {
    alignmentScore: number | null
    qualityScore: number | null
    difficultyScore: number | null
    existingTeamKpis: ExistingTeamKpiContext[]
  }
) {
  const normalizedTitle = normalizeText(params.title)
  const existingDuplicate = params.existingTeamKpis.some((kpi) => normalizeText(kpi.kpiName) === normalizedTitle)
  const parentMirror = params.sourceOrgKpiTitle && normalizeText(params.sourceOrgKpiTitle) === normalizedTitle

  const computedAlignment =
    params.alignmentScore ??
    clampScore(
      (params.recommendationType === TeamKpiRecommendationType.ALIGNED_WITH_DIVISION_KPI ? 62 : 52) +
        (params.sourceOrgKpiId ? 18 : 0) +
        (params.sourceOrgKpiTitle ? 6 : 0) +
        (params.jobDescriptionEvidence ? 8 : 0) +
        (params.whyThisFitsTeamRole ? 6 : 0) +
        (params.controllabilityNote ? 4 : 0)
    )

  const computedQuality =
    params.qualityScore ??
    clampScore(
      52 +
        (params.formula ? 10 : 0) +
        (params.metricSource ? 10 : 0) +
        (params.whyThisIsHighQuality ? 10 : 0) +
        (params.controllabilityNote ? 8 : 0) +
        (params.jobDescriptionEvidence ? 6 : 0) +
        (params.trendRationale ? 5 : 0) +
        (params.whyThisFitsTeamRole ? 5 : 0) +
        (params.difficultySuggestion === 'HIGH' ? 7 : params.difficultySuggestion === 'MEDIUM' ? 3 : 0) -
        (isVagueTitle(params.title) ? 18 : 0) -
        (existingDuplicate ? 24 : 0) -
        (parentMirror ? 12 : 0)
    )

  const computedDifficulty =
    params.difficultyScore ??
    clampScore(
      50 +
        (params.difficultySuggestion === 'HIGH' ? 22 : params.difficultySuggestion === 'MEDIUM' ? 12 : 4) +
        (params.trendRationale ? 8 : 0) +
        (params.controllabilityNote ? 6 : 0)
    )

  return {
    alignmentScore: computedAlignment,
    qualityScore: computedQuality,
    difficultyScore: computedDifficulty,
    existingDuplicate,
    parentMirror,
  }
}

export function sanitizeAndRankTeamRecommendationItem(params: SanitizeParams): SanitizedTeamRecommendationItem {
  const sourceOrgKpi = findSourceOrgKpi(params.item, params.sourceOrgKpis)
  const recommendationType =
    params.recommendationType ??
    (toTrimmedString(params.item.recommendationType) === TeamKpiRecommendationType.TEAM_INDEPENDENT
      ? TeamKpiRecommendationType.TEAM_INDEPENDENT
      : TeamKpiRecommendationType.ALIGNED_WITH_DIVISION_KPI)

  const title = toTrimmedString(params.item.recommendedTitle) ?? toTrimmedString(params.item.title) ?? ''
  const definition =
    toTrimmedString(params.item.recommendedDefinition) ?? toTrimmedString(params.item.definition)
  const formula = toTrimmedString(params.item.formula)
  const metricSource = toTrimmedString(params.item.metricSource)
  const unit = toTrimmedString(params.item.unit)
  const difficultySuggestion =
    resolveDifficulty(params.item.difficultyLevel) ?? resolveDifficulty(params.item.difficultySuggestion)
  const linkageExplanation =
    recommendationType === TeamKpiRecommendationType.TEAM_INDEPENDENT
      ? toTrimmedString(params.item.whyThisFitsTeamRole) ??
        toTrimmedString(params.item.jobDescriptionEvidence) ??
        '팀 직무기술서와 역할 범위를 근거로 도출한 독립형 KPI입니다.'
      : toTrimmedString(params.item.linkageReason) ??
        toTrimmedString(params.item.linkageExplanation) ??
        ''
  const recommendationReason =
    toTrimmedString(params.item.recommendationReason) ??
    toTrimmedString(params.item.whyThisIsHighQuality) ??
    ''
  const whyThisIsHighQuality = toTrimmedString(params.item.whyThisIsHighQuality)
  const basedOnJobDescription =
    recommendationType === TeamKpiRecommendationType.TEAM_INDEPENDENT
      ? Boolean(params.item.basedOnJobDescription ?? true)
      : null
  const jobDescriptionEvidence = toTrimmedString(params.item.jobDescriptionEvidence)
  const trendRationale = toTrimmedString(params.item.trendRationale)
  const whyThisFitsTeamRole = toTrimmedString(params.item.whyThisFitsTeamRole)
  const controllabilityNote = toTrimmedString(params.item.controllabilityNote)
  const riskComment = toTrimmedString(params.item.riskNote) ?? toTrimmedString(params.item.riskComment)

  const scores = computeRecommendationScores({
    recommendationType,
    title,
    formula,
    metricSource,
    whyThisIsHighQuality,
    basedOnJobDescription,
    jobDescriptionEvidence,
    trendRationale,
    whyThisFitsTeamRole,
    controllabilityNote,
    sourceOrgKpiId: sourceOrgKpi?.id ?? null,
    sourceOrgKpiTitle: sourceOrgKpi?.kpiName ?? null,
    difficultySuggestion,
    alignmentScore: clampScore(toOptionalNumber(params.item.alignmentScore)),
    qualityScore: clampScore(toOptionalNumber(params.item.qualityScore)),
    difficultyScore: clampScore(toOptionalNumber(params.item.difficultyScore)),
    existingTeamKpis: params.existingTeamKpis,
  })

  const recommendedPriority =
    toOptionalNumber(params.item.recommendedPriority) ??
    (scores.alignmentScore !== null && scores.qualityScore !== null
      ? Math.max(1, Math.min(7, 8 - Math.round((scores.alignmentScore + scores.qualityScore) / 35)))
      : params.rank)

  return {
    rank: params.rank,
    recommendationType,
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
    sourceOrgKpiId:
      recommendationType === TeamKpiRecommendationType.ALIGNED_WITH_DIVISION_KPI ? sourceOrgKpi?.id ?? null : null,
    sourceOrgKpiTitle:
      recommendationType === TeamKpiRecommendationType.ALIGNED_WITH_DIVISION_KPI
        ? sourceOrgKpi?.kpiName ?? null
        : null,
    linkageExplanation,
    recommendationReason,
    whyThisIsHighQuality,
    basedOnJobDescription,
    jobDescriptionEvidence,
    trendRationale,
    whyThisFitsTeamRole,
    controllabilityNote,
    riskComment,
    alignmentScore: scores.alignmentScore,
    qualityScore: scores.qualityScore,
    difficultyScore: scores.difficultyScore,
    recommendedPriority: recommendedPriority ? Math.round(recommendedPriority) : null,
  }
}

export function rankTeamRecommendationItems(items: SanitizedTeamRecommendationItem[]) {
  return items
    .slice()
    .sort((left, right) => {
      if (left.recommendationType !== right.recommendationType) {
        return left.recommendationType === TeamKpiRecommendationType.ALIGNED_WITH_DIVISION_KPI ? -1 : 1
      }

      const leftPriority = left.recommendedPriority ?? 99
      const rightPriority = right.recommendedPriority ?? 99
      if (leftPriority !== rightPriority) return leftPriority - rightPriority

      const leftAlignment = left.alignmentScore ?? 0
      const rightAlignment = right.alignmentScore ?? 0
      if (leftAlignment !== rightAlignment) return rightAlignment - leftAlignment

      const leftQuality = left.qualityScore ?? 0
      const rightQuality = right.qualityScore ?? 0
      if (leftQuality !== rightQuality) return rightQuality - leftQuality

      const leftDifficulty = left.difficultyScore ?? 0
      const rightDifficulty = right.difficultyScore ?? 0
      if (leftDifficulty !== rightDifficulty) return rightDifficulty - leftDifficulty

      return left.title.localeCompare(right.title, 'ko-KR')
    })
    .map((item, index) => ({
      ...item,
      rank: index + 1,
      recommendedPriority: item.recommendedPriority ?? index + 1,
    }))
}

