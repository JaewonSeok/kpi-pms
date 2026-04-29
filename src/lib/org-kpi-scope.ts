export type OrgKpiScope = 'division' | 'section' | 'team'

export const ORG_KPI_SCOPE_VALUES = ['division', 'section', 'team'] as const
export const ORG_KPI_SCOPE_ORDER: OrgKpiScope[] = ['division', 'section', 'team']

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
  if (value === 'division' || value === 'section' || value === 'team') {
    return value
  }

  return null
}

export function buildOrgKpiDepartmentScopeMap<TDepartment extends ScopeDepartmentLike>(
  departments: TDepartment[],
) {
  const childIdsByParentId = new Map<string, string[]>()

  departments.forEach((department) => {
    const parentDepartmentId = getParentDepartmentId(department)
    if (!parentDepartmentId) return
    const children = childIdsByParentId.get(parentDepartmentId) ?? []
    children.push(department.id)
    childIdsByParentId.set(parentDepartmentId, children)
  })

  const subtreeDepthMemo = new Map<string, number>()

  function getSubtreeDepth(departmentId: string): number {
    if (subtreeDepthMemo.has(departmentId)) {
      return subtreeDepthMemo.get(departmentId) ?? 0
    }

    const childIds = childIdsByParentId.get(departmentId) ?? []
    if (!childIds.length) {
      subtreeDepthMemo.set(departmentId, 0)
      return 0
    }

    const depth = Math.max(...childIds.map((childId) => getSubtreeDepth(childId))) + 1
    subtreeDepthMemo.set(departmentId, depth)
    return depth
  }

  return new Map(
    departments.map((department) => [
      department.id,
      (() => {
        const subtreeDepth = getSubtreeDepth(department.id)
        if (subtreeDepth <= 0) return 'team'
        const parentDepartmentId = getParentDepartmentId(department)
        const parentSubtreeDepth = parentDepartmentId ? getSubtreeDepth(parentDepartmentId) : null
        if (subtreeDepth === 1 && parentSubtreeDepth !== null && parentSubtreeDepth >= 2) {
          return 'section'
        }
        return 'division'
      })(),
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
