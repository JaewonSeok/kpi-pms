import type { KpiAiPreviewRecommendation } from '@/lib/kpi-ai-preview'

export type OrgKpiAiRecommendationFormSeed = {
  deptId: string
  evalYear: string
  parentOrgKpiId: string
  kpiType: 'QUANTITATIVE' | 'QUALITATIVE'
  kpiCategory: string
  kpiName: string
  tags: string
  definition: string
  formula: string
  targetValueT: string
  targetValueE: string
  targetValueS: string
  unit: string
  weight: string
  difficulty: 'HIGH' | 'MEDIUM' | 'LOW'
}

function normalizeDifficulty(value?: string | null): OrgKpiAiRecommendationFormSeed['difficulty'] {
  return value === 'HIGH' || value === 'LOW' ? value : 'MEDIUM'
}

function normalizeSeedValue(value: string) {
  return value.trim()
}

export function buildOrgKpiFormFromAiRecommendation(
  item: KpiAiPreviewRecommendation,
  evalYear: number,
  departmentId: string,
): OrgKpiAiRecommendationFormSeed {
  const isLinkedRecommendation = Boolean(item.linkedParentKpiId)

  return {
    deptId: departmentId,
    evalYear: String(evalYear),
    parentOrgKpiId: item.linkedParentKpiId ?? '',
    kpiType: 'QUANTITATIVE',
    kpiCategory: item.category?.trim() || (isLinkedRecommendation ? 'AI 연계형 KPI' : 'AI 추천 KPI'),
    kpiName: item.title,
    tags: isLinkedRecommendation ? 'AI추천, 연계형KPI' : 'AI추천',
    definition: item.definition,
    formula: item.formula,
    targetValueT: item.targetValueT ?? '',
    targetValueE: item.targetValueE ?? '',
    targetValueS: item.targetValueS ?? '',
    unit: item.unit?.trim() || '%',
    weight: item.weightSuggestion ?? '20',
    difficulty: normalizeDifficulty(item.difficultyLevel),
  }
}

export function buildOrgKpiAiRecommendationOptionLabel(index: number) {
  return `AI 추천안 ${index + 1}`
}

export function buildOrgKpiAiRecommendationSourceLabel(index: number) {
  return `${buildOrgKpiAiRecommendationOptionLabel(index)} 기반 초안`
}

export function buildOrgKpiAiRecommendationDraftStatusLabel(
  index: number | null,
  dirty: boolean,
) {
  if (dirty) return 'AI 추천안 기반 초안 · 수정됨'
  if (index === null || index < 0) return null
  return buildOrgKpiAiRecommendationSourceLabel(index)
}

export function isOrgKpiAiRecommendationDraftDirty(
  current: OrgKpiAiRecommendationFormSeed,
  baseline: OrgKpiAiRecommendationFormSeed | null,
) {
  if (!baseline) return false

  const normalizedCurrent = {
    ...current,
    deptId: normalizeSeedValue(current.deptId),
    evalYear: normalizeSeedValue(current.evalYear),
    parentOrgKpiId: normalizeSeedValue(current.parentOrgKpiId),
    kpiCategory: normalizeSeedValue(current.kpiCategory),
    kpiName: normalizeSeedValue(current.kpiName),
    tags: normalizeSeedValue(current.tags),
    definition: normalizeSeedValue(current.definition),
    formula: normalizeSeedValue(current.formula),
    targetValueT: normalizeSeedValue(current.targetValueT),
    targetValueE: normalizeSeedValue(current.targetValueE),
    targetValueS: normalizeSeedValue(current.targetValueS),
    unit: normalizeSeedValue(current.unit),
    weight: normalizeSeedValue(current.weight),
  }
  const normalizedBaseline = {
    ...baseline,
    deptId: normalizeSeedValue(baseline.deptId),
    evalYear: normalizeSeedValue(baseline.evalYear),
    parentOrgKpiId: normalizeSeedValue(baseline.parentOrgKpiId),
    kpiCategory: normalizeSeedValue(baseline.kpiCategory),
    kpiName: normalizeSeedValue(baseline.kpiName),
    tags: normalizeSeedValue(baseline.tags),
    definition: normalizeSeedValue(baseline.definition),
    formula: normalizeSeedValue(baseline.formula),
    targetValueT: normalizeSeedValue(baseline.targetValueT),
    targetValueE: normalizeSeedValue(baseline.targetValueE),
    targetValueS: normalizeSeedValue(baseline.targetValueS),
    unit: normalizeSeedValue(baseline.unit),
    weight: normalizeSeedValue(baseline.weight),
  }

  return JSON.stringify(normalizedCurrent) !== JSON.stringify(normalizedBaseline)
}
