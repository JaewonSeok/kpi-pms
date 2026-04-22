export type OrgKpiScope = 'division' | 'team'

export const ORG_KPI_SCOPE_VALUES = ['division', 'team'] as const

type ScopeDepartmentLike = {
  id: string
  parentDeptId?: string | null
  parentDepartmentId?: string | null
}

type ScopeKpiLike = {
  departmentId?: string
  deptId?: string
}

function getParentDepartmentId(department: ScopeDepartmentLike) {
  if (typeof department.parentDeptId === 'string') {
    return department.parentDeptId
  }

  if (typeof department.parentDepartmentId === 'string') {
    return department.parentDepartmentId
  }

  return null
}

export function normalizeOrgKpiScope(value?: string | null): OrgKpiScope | null {
  if (value === 'division' || value === 'team') {
    return value
  }

  return null
}

export function buildOrgKpiDepartmentScopeMap<TDepartment extends ScopeDepartmentLike>(
  departments: TDepartment[],
) {
  const childCountByParentId = new Map<string, number>()

  departments.forEach((department) => {
    const parentDepartmentId = getParentDepartmentId(department)
    if (!parentDepartmentId) return
    childCountByParentId.set(
      parentDepartmentId,
      (childCountByParentId.get(parentDepartmentId) ?? 0) + 1,
    )
  })

  return new Map(
    departments.map((department) => [
      department.id,
      childCountByParentId.has(department.id) ? 'division' : 'team',
    ] as const),
  )
}

export function resolveOrgKpiScopeFromDepartmentId<TDepartment extends ScopeDepartmentLike>(
  departmentId: string,
  departments: TDepartment[],
): OrgKpiScope {
  return buildOrgKpiDepartmentScopeMap(departments).get(departmentId) ?? 'team'
}

export function resolveOrgKpiScopeFromKpi<TDepartment extends ScopeDepartmentLike>(
  kpi: ScopeKpiLike,
  departments: TDepartment[],
): OrgKpiScope {
  const departmentId = kpi.departmentId ?? kpi.deptId ?? ''
  return resolveOrgKpiScopeFromDepartmentId(departmentId, departments)
}

export function filterDepartmentsByOrgKpiScope<TDepartment extends ScopeDepartmentLike>(
  departments: TDepartment[],
  scope: OrgKpiScope,
) {
  const scopeMap = buildOrgKpiDepartmentScopeMap(departments)
  return departments.filter((department) => (scopeMap.get(department.id) ?? 'team') === scope)
}
