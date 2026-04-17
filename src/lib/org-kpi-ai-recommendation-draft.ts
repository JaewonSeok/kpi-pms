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

export function buildOrgKpiAiRecommendationSourceLabel(index: number) {
  return `AI 추천 ${index + 1} 기반 초안`
}
