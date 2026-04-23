import { z } from 'zod'

type JsonRecord = Record<string, unknown>

const PERSONAL_KPI_DRAFT_DIFFICULTY_VALUES = ['HIGH', 'MEDIUM', 'LOW'] as const
const PERSONAL_KPI_DRAFT_ANGLE_CATALOG = [
  {
    label: '운영 실행형',
    category: '운영 실행',
    titleSuffix: '핵심 실행률 관리',
    formula: '완료한 핵심 실행 과제 수 / 계획한 핵심 실행 과제 수 x 100',
    unit: '%',
    metricSource: '주간 실행 현황과 월간 실적 기록 기준',
    whyThisOption: '상위 KPI를 실제 실행 일정과 완료율로 직접 연결하는 방식입니다.',
    controllabilityNote: '개인이 직접 관리할 수 있는 실행 과제 범위에 집중해 통제 가능성이 높습니다.',
    riskNote: '과제 정의가 모호하면 진행률만 관리하는 KPI로 흐를 수 있어 결과 기준을 함께 정해야 합니다.',
  },
  {
    label: '프로세스 개선형',
    category: '프로세스 개선',
    titleSuffix: '프로세스 개선 성과',
    formula: '개선 완료한 프로세스 과제 수 / 선정한 프로세스 과제 수 x 100',
    unit: '%',
    metricSource: '업무 개선 과제 관리표와 전후 비교 기록 기준',
    whyThisOption: '반복 업무 구조를 개선해 팀 KPI 달성의 기반을 강화하는 방식입니다.',
    controllabilityNote: '개인이 주도하는 업무 흐름이나 담당 절차에 한정하면 개선 범위를 스스로 통제하기 쉽습니다.',
    riskNote: '개선 효과를 정량으로 남기지 않으면 단순 활동 나열로 보일 수 있습니다.',
  },
  {
    label: '협업/정렬형',
    category: '협업 정렬',
    titleSuffix: '협업 정렬 이슈 해소',
    formula: '정렬이 필요한 협업 이슈 해결 건수 / 합의한 협업 이슈 건수 x 100',
    unit: '%',
    metricSource: '협업 이슈 로그와 후속 조치 완료 기록 기준',
    whyThisOption: '본부 KPI 방향을 팀 간 협업과 우선순위 정렬로 풀어내는 방식입니다.',
    controllabilityNote: '담당자가 조정해야 하는 이해관계자와 이슈 범위를 명확히 두면 실행 책임이 분명해집니다.',
    riskNote: '협업 상대의 의존도가 높으면 개인 KPI만으로는 통제하기 어려운 구간이 생길 수 있습니다.',
  },
  {
    label: '지표 개선형',
    category: '지표 개선',
    titleSuffix: '선행지표 개선',
    formula: '개선한 선행지표 실적 / 목표 선행지표 값 x 100',
    unit: '%',
    metricSource: '대시보드 지표와 월간 실적 입력값 기준',
    whyThisOption: '상위 KPI의 결과를 움직이는 선행지표를 개인 책임 범위에서 직접 관리하는 방식입니다.',
    controllabilityNote: '결과지표보다 선행지표를 택해 개인이 행동을 바꾸고 바로 추적하기 쉽습니다.',
    riskNote: '선행지표와 상위 KPI 결과의 연결 근거가 약하면 정렬도가 낮아질 수 있습니다.',
  },
  {
    label: '리스크 관리형',
    category: '리스크 관리',
    titleSuffix: '리스크 예방 관리',
    formula: '기한 내 해소한 주요 리스크 수 / 식별한 주요 리스크 수 x 100',
    unit: '%',
    metricSource: '리스크 로그와 조치 완료 기록 기준',
    whyThisOption: '성과 저해 요소를 미리 줄여 상위 KPI 달성 가능성을 높이는 방식입니다.',
    controllabilityNote: '담당 영역의 리스크 식별과 후속 조치는 개인이 주도적으로 관리할 수 있습니다.',
    riskNote: '리스크 정의가 넓으면 보고 중심 KPI로 변질될 수 있어 범위를 작게 잡는 것이 좋습니다.',
  },
  {
    label: '자동화/효율화형',
    category: '자동화 효율화',
    titleSuffix: '업무 자동화 효율화',
    formula: '절감한 업무 시간 / 자동화 대상 업무 시간 x 100',
    unit: '%',
    metricSource: '업무 시간 산정표와 자동화 적용 전후 비교 기준',
    whyThisOption: '같은 인력으로 더 높은 실행력을 확보하도록 효율을 끌어올리는 방식입니다.',
    controllabilityNote: '개인이 반복 수행하는 업무를 대상으로 잡으면 설계와 실행을 직접 통제하기 좋습니다.',
    riskNote: '정확한 시간 산정 기준이 없으면 효과를 설명하기 어려울 수 있습니다.',
  },
  {
    label: '고객/품질형',
    category: '고객 품질',
    titleSuffix: '고객/품질 개선',
    formula: '개선한 고객·품질 지표 값 / 목표 고객·품질 지표 값 x 100',
    unit: '%',
    metricSource: '고객 피드백, 품질 점검 결과, 월간 실적 기록 기준',
    whyThisOption: '최종 사용자 경험과 산출물 품질을 통해 상위 KPI를 뒷받침하는 방식입니다.',
    controllabilityNote: '담당 프로세스의 품질 기준과 고객 접점을 명확히 하면 개인 기여를 설명하기 쉽습니다.',
    riskNote: '품질 기준이 추상적이면 평가 시 해석 차이가 커질 수 있습니다.',
  },
] as const

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function normalizeText(value: string | null | undefined) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '')
}

function tokenizeText(value: string | null | undefined) {
  return Array.from(
    new Set(
      String(value ?? '')
        .toLowerCase()
        .split(/[\s/(),.:;+*×x-]+/g)
        .map((token) => token.trim())
        .filter((token) => token.length >= 2)
    )
  )
}

function toRecord(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : null
}

function toTrimmedString(value: unknown) {
  return typeof value === 'string' && value.trim().length ? normalizeWhitespace(value) : null
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

function toStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => toTrimmedString(item)).filter((item): item is string => Boolean(item))
    : []
}

function clampScore(value: number | null, fallback: number) {
  const raw = value ?? fallback
  return Math.max(0, Math.min(100, Math.round(raw)))
}

function resolveDifficulty(value: unknown, fallback: (typeof PERSONAL_KPI_DRAFT_DIFFICULTY_VALUES)[number] = 'MEDIUM') {
  return typeof value === 'string' && PERSONAL_KPI_DRAFT_DIFFICULTY_VALUES.includes(value as never)
    ? (value as (typeof PERSONAL_KPI_DRAFT_DIFFICULTY_VALUES)[number])
    : fallback
}

function resolveTargetNumber(value: unknown, fallback: number) {
  const parsed = toOptionalNumber(value)
  if (parsed === null) return fallback
  return Math.round(parsed * 100) / 100
}

function formatTargetSuggestion(targetT: number, targetE: number, targetS: number, unit: string) {
  return `T ${targetT}${unit} / E ${targetE}${unit} / S ${targetS}${unit}`
}

function buildSafeTitle(baseTitle: string, titleSuffix: string) {
  const compactBase = normalizeWhitespace(baseTitle || '핵심 목표')
  if (compactBase.includes(titleSuffix)) {
    return compactBase
  }

  return `${compactBase} ${titleSuffix}`.trim()
}

function calculateTokenOverlap(left: string | null | undefined, right: string | null | undefined) {
  const leftTokens = tokenizeText(left)
  const rightTokens = tokenizeText(right)

  if (!leftTokens.length || !rightTokens.length) {
    return 0
  }

  const rightSet = new Set(rightTokens)
  const overlap = leftTokens.filter((token) => rightSet.has(token)).length
  return overlap / Math.max(leftTokens.length, rightTokens.length)
}

function buildAlignmentKey(params: {
  primaryId?: string | null
  linkedParentId?: string | null
  primaryTitle?: string | null
  linkedParentTitle?: string | null
}) {
  return normalizeText(
    params.primaryId ??
      params.linkedParentId ??
      params.primaryTitle ??
      params.linkedParentTitle ??
      ''
  )
}

function hasSameTargetShape(left: PersonalKpiDraftRecommendation, right: PersonalKpiDraftRecommendation) {
  return (
    normalizeText(left.unit) === normalizeText(right.unit) &&
    left.targetT === right.targetT &&
    left.targetE === right.targetE &&
    left.targetS === right.targetS
  )
}

function areNearDuplicateDrafts(left: PersonalKpiDraftRecommendation, right: PersonalKpiDraftRecommendation) {
  const titleExact = normalizeText(left.recommendedTitle) === normalizeText(right.recommendedTitle)
  const titleOverlap = calculateTokenOverlap(left.recommendedTitle, right.recommendedTitle)
  const definitionOverlap = calculateTokenOverlap(left.recommendedDefinition, right.recommendedDefinition)
  const formulaOverlap = calculateTokenOverlap(left.formula, right.formula)
  const metricSourceOverlap = calculateTokenOverlap(left.metricSource, right.metricSource)
  const linkageReasonOverlap = calculateTokenOverlap(left.linkageReason, right.linkageReason)
  const angleSame = normalizeText(left.draftAngleLabel) === normalizeText(right.draftAngleLabel)
  const sameAlignmentContext =
    buildAlignmentKey({
      primaryId: left.primaryLinkedOrgKpiId,
      linkedParentId: left.linkedParentKpiId,
      primaryTitle: left.primaryLinkedOrgKpiTitle,
      linkedParentTitle: left.linkedParentKpiTitle,
    }) ===
      buildAlignmentKey({
        primaryId: right.primaryLinkedOrgKpiId,
        linkedParentId: right.linkedParentKpiId,
        primaryTitle: right.primaryLinkedOrgKpiTitle,
        linkedParentTitle: right.linkedParentKpiTitle,
      }) &&
    buildAlignmentKey({
      primaryId: left.primaryLinkedOrgKpiId,
      linkedParentId: left.linkedParentKpiId,
      primaryTitle: left.primaryLinkedOrgKpiTitle,
      linkedParentTitle: left.linkedParentKpiTitle,
    }).length > 0

  if (titleExact) return true
  if (titleOverlap >= 0.88) return true
  if (angleSame && titleOverlap >= 0.55) return true
  if (titleOverlap >= 0.7 && definitionOverlap >= 0.7) return true
  if (formulaOverlap >= 0.88 && definitionOverlap >= 0.65) return true
  if (sameAlignmentContext && formulaOverlap >= 0.72 && metricSourceOverlap >= 0.72) return true
  if (sameAlignmentContext && hasSameTargetShape(left, right) && formulaOverlap >= 0.65 && definitionOverlap >= 0.55)
    return true
  if (angleSame && sameAlignmentContext && linkageReasonOverlap >= 0.75 && titleOverlap >= 0.45) return true

  return false
}

function collidesWithExistingPersonalKpi(
  option: PersonalKpiDraftRecommendation,
  existingItems: Array<{
    title?: string | null
    definition?: string | null
    formula?: string | null
    linkedOrgKpiId?: string | null
  }>
) {
  const optionAlignmentKey = buildAlignmentKey({
    primaryId: option.primaryLinkedOrgKpiId,
    linkedParentId: option.linkedParentKpiId,
    primaryTitle: option.primaryLinkedOrgKpiTitle,
    linkedParentTitle: option.linkedParentKpiTitle,
  })

  return existingItems.some((existing) => {
    const titleExact = normalizeText(existing.title) === normalizeText(option.recommendedTitle)
    const titleOverlap = calculateTokenOverlap(existing.title, option.recommendedTitle)
    const definitionOverlap = calculateTokenOverlap(existing.definition, option.recommendedDefinition)
    const formulaOverlap = calculateTokenOverlap(existing.formula, option.formula)
    const sameAlignmentContext =
      optionAlignmentKey.length > 0 &&
      optionAlignmentKey ===
        buildAlignmentKey({
          primaryId: existing.linkedOrgKpiId,
        })

    return (
      titleExact ||
      titleOverlap >= 0.88 ||
      (titleOverlap >= 0.7 && definitionOverlap >= 0.65) ||
      (titleOverlap >= 0.6 && formulaOverlap >= 0.8) ||
      (sameAlignmentContext && formulaOverlap >= 0.75 && definitionOverlap >= 0.55)
    )
  })
}

function buildContextDefaults(payload: JsonRecord) {
  const orgCascade = toRecord(payload.orgCascade)
  const linkedGoal = toRecord(orgCascade?.linkedGoal)
  const divisionGoal = toRecord(orgCascade?.divisionGoal)
  const teamGoal = toRecord(orgCascade?.teamGoal)
  const currentDraft = toRecord(payload.currentDraft)
  const employeeProfile = toRecord(payload.employeeProfile)
  const businessContext = toRecord(payload.businessContext)

  const primaryTitle =
    toTrimmedString(linkedGoal?.title) ??
    toTrimmedString(payload.orgKpiName) ??
    toTrimmedString(currentDraft?.title) ??
    '연계 조직 KPI'
  const divisionTitle = toTrimmedString(divisionGoal?.title) ?? primaryTitle
  const teamTitle =
    toTrimmedString(teamGoal?.title) ??
    (normalizeText(primaryTitle) !== normalizeText(divisionTitle) ? primaryTitle : null)
  const employeeRoleLabel =
    toTrimmedString(employeeProfile?.jobTitleText) ??
    toTrimmedString(employeeProfile?.positionLabel) ??
    toTrimmedString(employeeProfile?.roleLabel) ??
    toTrimmedString(employeeProfile?.departmentLabel) ??
    '담당 역할'
  const baseTitle =
    toTrimmedString(currentDraft?.title) ??
    teamTitle ??
    divisionTitle ??
    toTrimmedString(payload.goal) ??
    '개인 기여'
  const unit = toTrimmedString(currentDraft?.unit) ?? '%'
  const targetE = resolveTargetNumber(currentDraft?.targetValue, unit === '%' ? 100 : 1)
  const targetT = resolveTargetNumber(linkedGoal?.targetValueT, unit === '%' ? Math.max(70, targetE - 10) : targetE)
  const targetS = resolveTargetNumber(linkedGoal?.targetValueS, unit === '%' ? Math.min(130, targetE + 10) : targetE)
  const weight = resolveTargetNumber(currentDraft?.weight, 20)
  const difficulty = resolveDifficulty(currentDraft?.difficulty)
  const category =
    toTrimmedString(currentDraft?.category) ??
    toTrimmedString(payload.orgKpiCategory) ??
    toTrimmedString(linkedGoal?.category) ??
    '개인 기여'
  const cascadePath =
    toStringArray(orgCascade?.pathLabels).join(' → ') ||
    [divisionTitle, teamTitle, baseTitle].filter((item): item is string => Boolean(item)).join(' → ')
  const businessSummary =
    toTrimmedString(businessContext?.businessPlanSummaryText) ??
    toTrimmedString(businessContext?.divisionJobDescriptionSummaryText) ??
    toTrimmedString(businessContext?.teamJobDescriptionSummaryText)

  return {
    primaryTitle,
    divisionTitle,
    teamTitle,
    baseTitle,
    category,
    unit,
    weight,
    difficulty,
    targetT,
    targetE,
    targetS,
    employeeRoleLabel,
    cascadePath,
    businessSummary,
    primaryId: toTrimmedString(linkedGoal?.id) ?? null,
    divisionId: toTrimmedString(divisionGoal?.id) ?? toTrimmedString(linkedGoal?.id) ?? null,
    teamId: toTrimmedString(teamGoal?.id) ?? (teamTitle ? toTrimmedString(linkedGoal?.id) : null),
  }
}

function buildFallbackRecommendation(
  payload: JsonRecord,
  angleIndex: number,
  usedAngleLabels: Set<string>,
  existingItems: Array<{ title?: string | null; definition?: string | null; formula?: string | null }>
): PersonalKpiDraftRecommendation | null {
  const defaults = buildContextDefaults(payload)
  const catalog = PERSONAL_KPI_DRAFT_ANGLE_CATALOG.find((item) => !usedAngleLabels.has(normalizeText(item.label)))
    ?? PERSONAL_KPI_DRAFT_ANGLE_CATALOG[angleIndex % PERSONAL_KPI_DRAFT_ANGLE_CATALOG.length]

  const recommendedTitle = buildSafeTitle(defaults.baseTitle, catalog.titleSuffix)
  const recommendedDefinition = [
    defaults.teamTitle ? `${defaults.teamTitle}에 직접 기여하고` : null,
    defaults.divisionTitle && defaults.divisionTitle !== defaults.teamTitle
      ? `${defaults.divisionTitle} 방향과도 정렬되도록`
      : null,
    `${defaults.employeeRoleLabel}가 통제 가능한 범위의 실행 결과를 관리하는 개인 KPI 초안입니다.`,
  ]
    .filter((item): item is string => Boolean(item))
    .join(' ')

  const option: PersonalKpiDraftRecommendation = {
    recommendedTitle,
    recommendedDefinition,
    category: catalog.category,
    formula: catalog.formula,
    metricSource: catalog.metricSource,
    targetT: defaults.targetT,
    targetE: defaults.targetE,
    targetS: defaults.targetS,
    targetValueSuggestion: formatTargetSuggestion(defaults.targetT, defaults.targetE, defaults.targetS, defaults.unit),
    unit: defaults.unit,
    weightSuggestion: defaults.weight,
    difficultyLevel: defaults.difficulty,
    linkedParentKpiId: defaults.primaryId,
    linkedParentKpiTitle: defaults.primaryTitle,
    linkageReason: `${defaults.cascadePath} 흐름을 기준으로 ${catalog.label} 관점에서 개인 기여를 설계했습니다.`,
    whyThisIsHighQuality: `${catalog.whyThisOption} ${defaults.businessSummary ? `사업/직무 맥락: ${defaults.businessSummary}` : '실행과 측정 기준을 함께 포함해 합의하기 쉽습니다.'}`,
    controllabilityNote: catalog.controllabilityNote,
    riskNote: catalog.riskNote,
    alignmentScore: clampScore(defaults.teamTitle ? 88 - angleIndex * 2 : 82 - angleIndex * 2, 80),
    qualityScore: clampScore(84 - angleIndex, 80),
    recommendedPriority: angleIndex + 1,
    draftAngleLabel: catalog.label,
    whyThisOption: catalog.whyThisOption,
    alignmentSummary: `${defaults.divisionTitle}${defaults.teamTitle ? ` → ${defaults.teamTitle}` : ''} 방향을 ${catalog.label}으로 개인 실행 KPI에 연결했습니다.`,
    primaryLinkedOrgKpiId: defaults.primaryId,
    primaryLinkedOrgKpiTitle: defaults.primaryTitle,
    secondaryLinkedOrgKpiId:
      defaults.teamTitle && defaults.teamTitle !== defaults.divisionTitle ? defaults.divisionId : null,
    secondaryLinkedOrgKpiTitle:
      defaults.teamTitle && defaults.teamTitle !== defaults.divisionTitle ? defaults.divisionTitle : null,
    divisionKpiId: defaults.divisionId,
    divisionKpiTitle: defaults.divisionTitle,
    teamKpiId: defaults.teamId,
    teamKpiTitle: defaults.teamTitle,
  }

  if (collidesWithExistingPersonalKpi(option, existingItems)) {
    return null
  }

  return option
}

function fillFallbackRecommendations(
  payload: JsonRecord,
  existingItems: Array<{
    title?: string | null
    definition?: string | null
    formula?: string | null
    linkedOrgKpiId?: string | null
  }>,
  currentItems: PersonalKpiDraftRecommendation[]
) {
  const recommendations = currentItems.slice()
  const usedAngleLabels = new Set(recommendations.map((item) => normalizeText(item.draftAngleLabel)))
  let attempts = 0

  while (recommendations.length < 3 && attempts < PERSONAL_KPI_DRAFT_ANGLE_CATALOG.length * 2) {
    const fallbackOption = buildFallbackRecommendation(payload, attempts, new Set(Array.from(usedAngleLabels)), existingItems)
    attempts += 1
    if (!fallbackOption) continue
    if (usedAngleLabels.has(normalizeText(fallbackOption.draftAngleLabel))) continue
    if (recommendations.some((existing) => areNearDuplicateDrafts(existing, fallbackOption))) continue
    recommendations.push(fallbackOption)
    usedAngleLabels.add(normalizeText(fallbackOption.draftAngleLabel))
  }

  return recommendations.slice(0, 5)
}

function buildRecommendationFromRecord(
  item: JsonRecord,
  rank: number,
  payload: JsonRecord,
  existingItems: Array<{
    title?: string | null
    definition?: string | null
    formula?: string | null
    linkedOrgKpiId?: string | null
  }>
): PersonalKpiDraftRecommendation | null {
  const defaults = buildContextDefaults(payload)
  const draftAngleLabel =
    toTrimmedString(item.draftAngleLabel) ??
    PERSONAL_KPI_DRAFT_ANGLE_CATALOG[(rank - 1) % PERSONAL_KPI_DRAFT_ANGLE_CATALOG.length]?.label
  if (!draftAngleLabel) return null

  const linkedParentKpiTitle =
    toTrimmedString(item.linkedParentKpiTitle) ??
    toTrimmedString(item.primaryLinkedOrgKpiTitle) ??
    defaults.primaryTitle

  const linkedParentKpiId =
    toTrimmedString(item.linkedParentKpiId) ??
    toTrimmedString(item.primaryLinkedOrgKpiId) ??
    defaults.primaryId

  const unit = toTrimmedString(item.unit) ?? defaults.unit
  const targetT = resolveTargetNumber(item.targetT ?? item.targetValueT, defaults.targetT)
  const targetE = resolveTargetNumber(item.targetE ?? item.targetValueE, defaults.targetE)
  const targetS = resolveTargetNumber(item.targetS ?? item.targetValueS, defaults.targetS)

  const candidate: PersonalKpiDraftRecommendation = {
    recommendedTitle:
      toTrimmedString(item.recommendedTitle) ??
      toTrimmedString(item.title) ??
      buildSafeTitle(defaults.baseTitle, PERSONAL_KPI_DRAFT_ANGLE_CATALOG[(rank - 1) % PERSONAL_KPI_DRAFT_ANGLE_CATALOG.length]!.titleSuffix),
    recommendedDefinition:
      toTrimmedString(item.recommendedDefinition) ??
      toTrimmedString(item.definition) ??
      `${linkedParentKpiTitle}에 기여하도록 ${draftAngleLabel} 관점에서 설계한 개인 KPI 초안입니다.`,
    category: toTrimmedString(item.category) ?? defaults.category,
    formula:
      toTrimmedString(item.formula) ??
      PERSONAL_KPI_DRAFT_ANGLE_CATALOG[(rank - 1) % PERSONAL_KPI_DRAFT_ANGLE_CATALOG.length]!.formula,
    metricSource:
      toTrimmedString(item.metricSource) ??
      PERSONAL_KPI_DRAFT_ANGLE_CATALOG[(rank - 1) % PERSONAL_KPI_DRAFT_ANGLE_CATALOG.length]!.metricSource,
    targetT,
    targetE,
    targetS,
    targetValueSuggestion:
      toTrimmedString(item.targetValueSuggestion) ?? formatTargetSuggestion(targetT, targetE, targetS, unit),
    unit,
    weightSuggestion: Math.max(1, Math.min(100, Math.round(resolveTargetNumber(item.weightSuggestion, defaults.weight)))),
    difficultyLevel: resolveDifficulty(item.difficultyLevel ?? item.difficultySuggestion, defaults.difficulty),
    linkedParentKpiId,
    linkedParentKpiTitle,
    linkageReason:
      toTrimmedString(item.linkageReason) ??
      `${defaults.cascadePath} 흐름을 기준으로 ${draftAngleLabel} 관점에서 기여 경로를 설계했습니다.`,
    whyThisIsHighQuality:
      toTrimmedString(item.whyThisIsHighQuality) ??
      `${draftAngleLabel} 관점에서 개인이 책임질 수 있는 범위와 측정 기준을 함께 제시했습니다.`,
    controllabilityNote:
      toTrimmedString(item.controllabilityNote) ??
      PERSONAL_KPI_DRAFT_ANGLE_CATALOG[(rank - 1) % PERSONAL_KPI_DRAFT_ANGLE_CATALOG.length]!.controllabilityNote,
    riskNote:
      toTrimmedString(item.riskNote) ??
      toTrimmedString(item.riskComment) ??
      PERSONAL_KPI_DRAFT_ANGLE_CATALOG[(rank - 1) % PERSONAL_KPI_DRAFT_ANGLE_CATALOG.length]!.riskNote,
    alignmentScore: clampScore(toOptionalNumber(item.alignmentScore), defaults.teamTitle ? 86 : 80),
    qualityScore: clampScore(toOptionalNumber(item.qualityScore), 82),
    recommendedPriority: Math.max(1, Math.min(5, Math.round(resolveTargetNumber(item.recommendedPriority, rank)))),
    draftAngleLabel,
    whyThisOption:
      toTrimmedString(item.whyThisOption) ??
      PERSONAL_KPI_DRAFT_ANGLE_CATALOG[(rank - 1) % PERSONAL_KPI_DRAFT_ANGLE_CATALOG.length]!.whyThisOption,
    alignmentSummary:
      toTrimmedString(item.alignmentSummary) ??
      `${defaults.divisionTitle}${defaults.teamTitle ? ` → ${defaults.teamTitle}` : ''} 방향을 ${draftAngleLabel}으로 풀어낸 개인 KPI 초안입니다.`,
    primaryLinkedOrgKpiId:
      toTrimmedString(item.primaryLinkedOrgKpiId) ?? linkedParentKpiId ?? defaults.primaryId,
    primaryLinkedOrgKpiTitle:
      toTrimmedString(item.primaryLinkedOrgKpiTitle) ?? linkedParentKpiTitle ?? defaults.primaryTitle,
    secondaryLinkedOrgKpiId:
      toTrimmedString(item.secondaryLinkedOrgKpiId) ??
      (defaults.teamTitle && defaults.teamTitle !== defaults.divisionTitle ? defaults.divisionId : null),
    secondaryLinkedOrgKpiTitle:
      toTrimmedString(item.secondaryLinkedOrgKpiTitle) ??
      (defaults.teamTitle && defaults.teamTitle !== defaults.divisionTitle ? defaults.divisionTitle : null),
    divisionKpiId: toTrimmedString(item.divisionKpiId) ?? defaults.divisionId,
    divisionKpiTitle: toTrimmedString(item.divisionKpiTitle) ?? defaults.divisionTitle,
    teamKpiId: toTrimmedString(item.teamKpiId) ?? defaults.teamId,
    teamKpiTitle: toTrimmedString(item.teamKpiTitle) ?? defaults.teamTitle,
  }

  const parsed = PersonalKpiDraftRecommendationSchema.safeParse(candidate)
  if (!parsed.success) {
    return null
  }

  if (collidesWithExistingPersonalKpi(parsed.data, existingItems)) {
    return null
  }

  return parsed.data
}

function buildResultSummary(payload: JsonRecord, recommendationCount: number) {
  const defaults = buildContextDefaults(payload)
  const cascadeBase = defaults.teamTitle
    ? `${defaults.divisionTitle} → ${defaults.teamTitle}`
    : defaults.divisionTitle
  return `${cascadeBase} 방향을 기준으로 ${recommendationCount}개의 관점별 개인 KPI 초안을 정리했습니다.`
}

function buildTopLevelFields(
  recommendation: PersonalKpiDraftRecommendation,
  payload: JsonRecord
) {
  return {
    summary: buildResultSummary(payload, 1),
    title: recommendation.recommendedTitle,
    category: recommendation.category,
    definition: recommendation.recommendedDefinition,
    formula: recommendation.formula,
    targetValueSuggestion: recommendation.targetValueSuggestion,
    unit: recommendation.unit,
    weightSuggestion: recommendation.weightSuggestion,
    difficultySuggestion: recommendation.difficultyLevel,
    evaluationCriteria: [
      `${recommendation.primaryLinkedOrgKpiTitle}과의 정렬 근거가 설명되는지 확인하세요.`,
      `${recommendation.metricSource} 기준으로 월간 또는 분기 단위 추적이 가능한지 확인하세요.`,
      `${recommendation.draftAngleLabel} 관점이 기존 개인 KPI와 중복되지 않는지 확인하세요.`,
    ],
    reviewPoints: [
      recommendation.whyThisOption,
      recommendation.controllabilityNote,
      recommendation.riskNote,
    ],
    alignmentSummary: recommendation.alignmentSummary,
    primaryLinkedOrgKpiId: recommendation.primaryLinkedOrgKpiId,
    primaryLinkedOrgKpiTitle: recommendation.primaryLinkedOrgKpiTitle,
    secondaryLinkedOrgKpiId: recommendation.secondaryLinkedOrgKpiId,
    secondaryLinkedOrgKpiTitle: recommendation.secondaryLinkedOrgKpiTitle,
    divisionKpiId: recommendation.divisionKpiId,
    divisionKpiTitle: recommendation.divisionKpiTitle,
    teamKpiId: recommendation.teamKpiId,
    teamKpiTitle: recommendation.teamKpiTitle,
    draftAngleLabel: recommendation.draftAngleLabel,
    whyThisOption: recommendation.whyThisOption,
  }
}

export const PersonalKpiDraftRecommendationSchema = z.object({
  recommendedTitle: z.string().trim().min(1).max(200),
  recommendedDefinition: z.string().trim().min(1).max(4000),
  category: z.string().trim().min(1).max(100).nullable(),
  formula: z.string().trim().min(1).max(2000),
  metricSource: z.string().trim().min(1).max(2000),
  targetT: z.number().finite(),
  targetE: z.number().finite(),
  targetS: z.number().finite(),
  targetValueSuggestion: z.string().trim().min(1).max(500),
  unit: z.string().trim().min(1).max(50),
  weightSuggestion: z.number().finite().min(1).max(100),
  difficultyLevel: z.enum(PERSONAL_KPI_DRAFT_DIFFICULTY_VALUES),
  linkedParentKpiId: z.string().trim().min(1).nullable(),
  linkedParentKpiTitle: z.string().trim().min(1).max(200),
  linkageReason: z.string().trim().min(1).max(2000),
  whyThisIsHighQuality: z.string().trim().min(1).max(2000),
  controllabilityNote: z.string().trim().min(1).max(2000),
  riskNote: z.string().trim().min(1).max(2000),
  alignmentScore: z.number().int().min(0).max(100),
  qualityScore: z.number().int().min(0).max(100),
  recommendedPriority: z.number().int().min(1).max(5),
  draftAngleLabel: z.string().trim().min(1).max(80),
  whyThisOption: z.string().trim().min(1).max(2000),
  alignmentSummary: z.string().trim().min(1).max(2000),
  primaryLinkedOrgKpiId: z.string().trim().min(1).nullable(),
  primaryLinkedOrgKpiTitle: z.string().trim().min(1).max(200),
  secondaryLinkedOrgKpiId: z.string().trim().min(1).nullable(),
  secondaryLinkedOrgKpiTitle: z.string().trim().max(200).nullable(),
  divisionKpiId: z.string().trim().min(1).nullable(),
  divisionKpiTitle: z.string().trim().max(200).nullable(),
  teamKpiId: z.string().trim().min(1).nullable(),
  teamKpiTitle: z.string().trim().max(200).nullable(),
})

export const PersonalKpiDraftResultSchema = z.object({
  summary: z.string().trim().min(1).max(2000),
  title: z.string().trim().min(1).max(200),
  category: z.string().trim().max(100).nullable(),
  definition: z.string().trim().min(1).max(4000),
  formula: z.string().trim().min(1).max(2000),
  targetValueSuggestion: z.string().trim().min(1).max(500),
  unit: z.string().trim().min(1).max(50),
  weightSuggestion: z.number().finite().min(1).max(100),
  difficultySuggestion: z.enum(PERSONAL_KPI_DRAFT_DIFFICULTY_VALUES),
  evaluationCriteria: z.array(z.string().trim().min(1).max(500)).min(2).max(6),
  reviewPoints: z.array(z.string().trim().min(1).max(500)).min(2).max(6),
  alignmentSummary: z.string().trim().min(1).max(2000),
  primaryLinkedOrgKpiId: z.string().trim().min(1).nullable(),
  primaryLinkedOrgKpiTitle: z.string().trim().min(1).max(200),
  secondaryLinkedOrgKpiId: z.string().trim().min(1).nullable(),
  secondaryLinkedOrgKpiTitle: z.string().trim().max(200).nullable(),
  divisionKpiId: z.string().trim().min(1).nullable(),
  divisionKpiTitle: z.string().trim().max(200).nullable(),
  teamKpiId: z.string().trim().min(1).nullable(),
  teamKpiTitle: z.string().trim().max(200).nullable(),
  draftAngleLabel: z.string().trim().min(1).max(80),
  whyThisOption: z.string().trim().min(1).max(2000),
  recommendations: z.array(PersonalKpiDraftRecommendationSchema).min(3).max(5),
})

export type PersonalKpiDraftRecommendation = z.infer<typeof PersonalKpiDraftRecommendationSchema>
export type PersonalKpiDraftResult = z.infer<typeof PersonalKpiDraftResultSchema>

export function mapPersonalKpiDraftStatusLabel(status: 'recommended' | 'warning' | 'review') {
  if (status === 'recommended') return '추천'
  if (status === 'warning') return '주의'
  return '검토 필요'
}

export function normalizePersonalKpiDraftResult(params: {
  rawResult: JsonRecord
  payload: JsonRecord
}): PersonalKpiDraftResult {
  const existingItems = Array.isArray(params.payload.existingPersonalKpis)
    ? params.payload.existingPersonalKpis
        .map((item) => toRecord(item))
        .filter((item): item is JsonRecord => Boolean(item))
        .map((item) => ({
          title: toTrimmedString(item.title),
          definition: toTrimmedString(item.definition),
          formula: toTrimmedString(item.formula),
          linkedOrgKpiId: toTrimmedString(item.linkedOrgKpiId),
        }))
    : []

  const rawRecommendations = Array.isArray(params.rawResult.recommendations)
    ? params.rawResult.recommendations
    : []

  const normalizedRecommendations: PersonalKpiDraftRecommendation[] = []
  const usedAngleLabels = new Set<string>()

  rawRecommendations.forEach((item, index) => {
    const recommendation = buildRecommendationFromRecord(
      toRecord(item) ?? {},
      index + 1,
      params.payload,
      existingItems
    )
    if (!recommendation) return
    if (usedAngleLabels.has(normalizeText(recommendation.draftAngleLabel))) return
    if (normalizedRecommendations.some((existing) => areNearDuplicateDrafts(existing, recommendation))) return

    normalizedRecommendations.push(recommendation)
    usedAngleLabels.add(normalizeText(recommendation.draftAngleLabel))
  })

  const completedRecommendations = fillFallbackRecommendations(params.payload, existingItems, normalizedRecommendations)
    .map((item, index) => ({
      ...item,
      recommendedPriority: index + 1,
    }))
    .slice(0, 5)

  const primaryRecommendation = completedRecommendations[0]
  if (!primaryRecommendation) {
    throw new Error('Personal KPI draft generation did not produce any usable recommendation.')
  }

  const topLevel = buildTopLevelFields(primaryRecommendation, params.payload)
  const parsed = PersonalKpiDraftResultSchema.parse({
    ...topLevel,
    summary: buildResultSummary(params.payload, completedRecommendations.length),
    recommendations: completedRecommendations,
  })

  return parsed
}

export function buildPersonalKpiDraftFallbackResult(payload: JsonRecord): PersonalKpiDraftResult {
  return normalizePersonalKpiDraftResult({
    rawResult: {
      recommendations: [],
    },
    payload,
  })
}
