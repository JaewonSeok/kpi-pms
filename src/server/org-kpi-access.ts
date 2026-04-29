import type { SystemRole } from '@prisma/client'

type DepartmentScopeNode = {
  id: string
  parentDeptId: string | null
}

function normalizeScopeDepartmentIds(accessibleDepartmentIds?: string[] | null) {
  if (!Array.isArray(accessibleDepartmentIds)) return []
  return accessibleDepartmentIds.filter(
    (value): value is string => typeof value === 'string' && value.trim().length > 0,
  )
}

export function collectDepartmentAncestorIds(
  departmentId: string,
  departmentsById: Map<string, DepartmentScopeNode>,
) {
  const ids: string[] = []
  let current: DepartmentScopeNode | undefined = departmentsById.get(departmentId)

  while (current?.parentDeptId) {
    ids.push(current.parentDeptId)
    current = departmentsById.get(current.parentDeptId)
  }

  return ids
}

export function resolveReadableOrgKpiDepartmentIds(params: {
  role: SystemRole
  deptId: string
  accessibleDepartmentIds?: string[] | null
  departments: DepartmentScopeNode[]
}) {
  if (params.role === 'ROLE_ADMIN' || params.role === 'ROLE_CEO') {
    return null
  }

  if (params.role === 'ROLE_MEMBER') {
    const departmentsById = new Map(
      params.departments.map((department) => [department.id, department] as const),
    )

    return [
      params.deptId,
      ...collectDepartmentAncestorIds(params.deptId, departmentsById),
    ]
  }

  const normalizedIds = normalizeScopeDepartmentIds(params.accessibleDepartmentIds)
  return normalizedIds.length ? normalizedIds : [params.deptId]
}
