import type { OrgKpiPageData, OrgKpiViewModel } from '@/server/org-kpi-page'
import { buildOrgKpiTargetValuePersistence } from './org-kpi-target-values'

type OrgKpiDepartmentOption = OrgKpiPageData['departments'][number]
type OrgKpiParentGoalOption = OrgKpiPageData['parentGoalOptions'][number]

export type OrgKpiEditorFormSnapshot = {
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

function parseTagInput(value: string) {
  return Array.from(
    new Set(
      value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    )
  )
}

export function buildOrgKpiServerListSignature(items: OrgKpiViewModel[]) {
  return items
    .map((item) =>
      [
        item.id,
        item.departmentId,
        item.evalYear,
        item.status,
        item.title,
        item.category ?? '',
        item.parentOrgKpiId ?? '',
        item.weight,
        item.targetValueT ?? '',
        item.targetValueE ?? '',
        item.targetValueS ?? '',
      ].join(':')
    )
    .join('|')
}

export function applySavedOrgKpiToList(params: {
  currentItems: OrgKpiViewModel[]
  savedId: string
  departments: OrgKpiDepartmentOption[]
  parentGoalOptions: OrgKpiParentGoalOption[]
  form: OrgKpiEditorFormSnapshot
}) {
  const nextDepartment = params.departments.find((department) => department.id === params.form.deptId)
  const nextParent =
    params.form.parentOrgKpiId
      ? params.parentGoalOptions.find((option) => option.id === params.form.parentOrgKpiId)
      : null
  const nextTargetValues = buildOrgKpiTargetValuePersistence({
    targetValueT: Number(params.form.targetValueT),
    targetValueE: Number(params.form.targetValueE),
    targetValueS: Number(params.form.targetValueS),
  })

  const nextItem: OrgKpiViewModel = {
    id: params.savedId,
    title: params.form.kpiName.trim(),
    tags: parseTagInput(params.form.tags),
    evalYear: Number(params.form.evalYear),
    departmentId: params.form.deptId,
    departmentName: nextDepartment?.name ?? '',
    departmentCode: '',
    parentOrgKpiId: params.form.parentOrgKpiId || null,
    parentOrgKpiTitle: nextParent?.title ?? null,
    parentOrgDepartmentName: nextParent?.departmentName ?? null,
    childOrgKpiCount: 0,
    lineage: [],
    category: params.form.kpiCategory.trim(),
    type: params.form.kpiType,
    definition: params.form.definition.trim() || undefined,
    formula: params.form.formula.trim() || undefined,
    targetValue: nextTargetValues.targetValue,
    targetValueT: nextTargetValues.targetValueT,
    targetValueE: nextTargetValues.targetValueE,
    targetValueS: nextTargetValues.targetValueS,
    unit: params.form.unit.trim() || undefined,
    weight: Number(params.form.weight),
    difficulty: params.form.difficulty,
    status: 'DRAFT',
    persistedStatus: 'DRAFT',
    linkedPersonalKpiCount: 0,
    linkedConfirmedPersonalKpiCount: 0,
    riskFlags: ['개인 KPI 연결 없음', '최근 월간 실적 없음'],
    coverageRate: 0,
    targetPopulationCount: 0,
    suggestedParent: null,
    suggestedChildren: [],
    linkedPersonalKpis: [],
    recentMonthlyRecords: [],
    history: [],
  }

  const updatedItems = params.currentItems.map((item) => {
    if (item.id !== params.savedId) {
      return item
    }

    return {
      ...item,
      ...nextItem,
      departmentCode: item.departmentCode,
      childOrgKpiCount: item.childOrgKpiCount,
      lineage: item.lineage,
      status: item.status,
      persistedStatus: item.persistedStatus,
      owner: item.owner,
      linkedPersonalKpiCount: item.linkedPersonalKpiCount,
      linkedConfirmedPersonalKpiCount: item.linkedConfirmedPersonalKpiCount,
      monthlyAchievementRate: item.monthlyAchievementRate,
      updatedAt: item.updatedAt,
      riskFlags: item.riskFlags,
      coverageRate: item.coverageRate,
      targetPopulationCount: item.targetPopulationCount,
      cloneInfo: item.cloneInfo,
      suggestedParent: item.suggestedParent,
      suggestedChildren: item.suggestedChildren,
      linkedPersonalKpis: item.linkedPersonalKpis,
      recentMonthlyRecords: item.recentMonthlyRecords,
      history: item.history,
    }
  })

  return updatedItems.some((item) => item.id === params.savedId)
    ? updatedItems
    : [nextItem, ...updatedItems]
}
