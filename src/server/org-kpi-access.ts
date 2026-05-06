import type { SystemRole } from '@prisma/client'
import { buildOrgKpiDepartmentScopeMap } from '../lib/org-kpi-scope'

type DepartmentScopeNode = {
  id: string
  deptName?: string | null
  parentDeptId: string | null
  leaderEmployeeId?: string | null
}

function normalizeScopeDepartmentIds(accessibleDepartmentIds?: string[] | null) {
  if (!Array.isArray(accessibleDepartmentIds)) return []
  return [...new Set(accessibleDepartmentIds.filter(
    (value): value is string => typeof value === 'string' && value.trim().length > 0,
  ))]
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

export function collectDepartmentDescendantIds(
  departmentId: string,
  departments: DepartmentScopeNode[],
) {
  const childrenByParent = new Map<string, string[]>()

  for (const department of departments) {
    if (!department.parentDeptId) continue
    const current = childrenByParent.get(department.parentDeptId) ?? []
    current.push(department.id)
    childrenByParent.set(department.parentDeptId, current)
  }

  const descendants: string[] = []
  const queue = [...(childrenByParent.get(departmentId) ?? [])]

  while (queue.length) {
    const currentId = queue.shift()
    if (!currentId || descendants.includes(currentId)) continue
    descendants.push(currentId)
    queue.push(...(childrenByParent.get(currentId) ?? []))
  }

  return descendants
}

function isDepartmentLeader(params: {
  userId: string
  deptId: string
  departmentsById: Map<string, DepartmentScopeNode>
}) {
  return params.departmentsById.get(params.deptId)?.leaderEmployeeId === params.userId
}

export function resolveReadableOrgKpiDepartmentIds(params: {
  userId?: string
  role: SystemRole
  deptId: string
  accessibleDepartmentIds?: string[] | null
  departments: DepartmentScopeNode[]
}) {
  if (params.role === 'ROLE_ADMIN' || params.role === 'ROLE_CEO') {
    return null
  }

  const departmentsById = new Map(
    params.departments.map((department) => [department.id, department] as const),
  )
  const scopeMap = buildOrgKpiDepartmentScopeMap(params.departments)
  const normalizedIds = normalizeScopeDepartmentIds(params.accessibleDepartmentIds)
  const leaderReadableIds =
    params.userId &&
    isDepartmentLeader({
      userId: params.userId,
      deptId: params.deptId,
      departmentsById,
    })
      ? collectDepartmentDescendantIds(params.deptId, params.departments)
      : []
  const sectionTeamReadableIds =
    scopeMap.get(params.deptId) === 'section'
      ? collectDepartmentDescendantIds(params.deptId, params.departments).filter(
          (departmentId) => scopeMap.get(departmentId) === 'team',
        )
      : []
  const baseIds = normalizedIds.length
    ? [...normalizedIds, ...sectionTeamReadableIds]
    : [params.deptId, ...leaderReadableIds, ...sectionTeamReadableIds]

  return [
    ...new Set([
      ...baseIds,
      params.deptId,
      ...collectDepartmentAncestorIds(params.deptId, departmentsById),
    ]),
  ]
}

export function resolveEditableOrgKpiDepartmentIds(params: {
  userId: string
  role: SystemRole
  deptId: string
  accessibleDepartmentIds?: string[] | null
  departments: DepartmentScopeNode[]
}) {
  if (params.role === 'ROLE_ADMIN' || params.role === 'ROLE_CEO') {
    return null
  }

  const departmentsById = new Map(
    params.departments.map((department) => [department.id, department] as const),
  )
  const normalizedIds = normalizeScopeDepartmentIds(params.accessibleDepartmentIds)
  if (normalizedIds.length) {
    return [
      ...new Set(
        normalizedIds.flatMap((departmentId) => [
          departmentId,
          ...collectDepartmentAncestorIds(departmentId, departmentsById),
        ]),
      ),
    ]
  }

  if (isDepartmentLeader({
    userId: params.userId,
    deptId: params.deptId,
    departmentsById,
  })) {
    return [params.deptId]
  }

  if (params.role === 'ROLE_MEMBER') {
    return []
  }

  return [params.deptId]
}

export function canManageOrgKpiWriteScope(params: {
  userId: string
  role: SystemRole
  deptId: string
  accessibleDepartmentIds?: string[] | null
  departments: DepartmentScopeNode[]
}) {
  const editableDepartmentIds = resolveEditableOrgKpiDepartmentIds(params)
  return editableDepartmentIds === null || editableDepartmentIds.length > 0
}
