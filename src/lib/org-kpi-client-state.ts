import type { OrgKpiPageData, OrgKpiViewModel } from '@/server/org-kpi-page'

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
  targetValue: string
  unit: string
  weight: string
  difficulty: 'HIGH' | 'MEDIUM' | 'LOW'
}

function parseNumber(value: string) {
  const parsed = Number(value.trim())
  return Number.isFinite(parsed) ? parsed : undefined
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

  return params.currentItems.map((item) => {
    if (item.id !== params.savedId) {
      return item
    }

    return {
      ...item,
      departmentId: params.form.deptId,
      departmentName: nextDepartment?.name ?? item.departmentName,
      evalYear: Number(params.form.evalYear || item.evalYear),
      parentOrgKpiId: params.form.parentOrgKpiId || null,
      parentOrgKpiTitle: nextParent?.title ?? null,
      parentOrgDepartmentName: nextParent?.departmentName ?? null,
      category: params.form.kpiCategory.trim(),
      type: params.form.kpiType,
      title: params.form.kpiName.trim(),
      tags: parseTagInput(params.form.tags),
      definition: params.form.definition.trim() || undefined,
      formula: params.form.formula.trim() || undefined,
      targetValue: parseNumber(params.form.targetValue),
      unit: params.form.unit.trim() || undefined,
      weight: Number(params.form.weight),
      difficulty: params.form.difficulty,
    }
  })
}
