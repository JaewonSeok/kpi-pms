import type { Position } from '@prisma/client'
import type { AuthRole } from '@/types/auth'

type DepartmentNode = {
  id: string
  deptCode: string
  parentDeptId: string | null
}

type EmployeeScopeTarget = {
  deptId: string
  role: AuthRole
  position: Position
  managerId?: string | null
  teamLeaderId?: string | null
  sectionChiefId?: string | null
  divisionHeadId?: string | null
}

function buildDepartmentMap(departments: DepartmentNode[]) {
  return new Map(departments.map((department) => [department.id, department]))
}

export function getDescendantDeptIds(deptId: string, departments: DepartmentNode[]): string[] {
  const children = departments.filter((department) => department.parentDeptId === deptId)
  return children.flatMap((child) => [child.id, ...getDescendantDeptIds(child.id, departments)])
}

export function buildOrgPath(target: EmployeeScopeTarget, departments: DepartmentNode[]) {
  const departmentMap = buildDepartmentMap(departments)
  const pathSegments: string[] = []
  let current = departmentMap.get(target.deptId)

  while (current) {
    pathSegments.unshift(current.deptCode)
    current = current.parentDeptId ? departmentMap.get(current.parentDeptId) : undefined
  }

  if (!pathSegments.length) {
    return `/${target.position}`
  }

  return `/${pathSegments.join('/')}`
}

export function getAccessibleDeptIds(target: EmployeeScopeTarget, departments: DepartmentNode[]) {
  if (target.role === 'ROLE_ADMIN' || target.role === 'ROLE_CEO') {
    return departments.map((department) => department.id)
  }

  if (target.role === 'ROLE_MEMBER') {
    return []
  }

  return [target.deptId, ...getDescendantDeptIds(target.deptId, departments)]
}

export function resolveManagerId(target: EmployeeScopeTarget) {
  if (target.managerId) {
    return target.managerId
  }

  if (target.position === 'MEMBER') {
    return target.teamLeaderId ?? target.sectionChiefId ?? target.divisionHeadId ?? null
  }

  if (target.position === 'TEAM_LEADER') {
    return target.sectionChiefId ?? target.divisionHeadId ?? null
  }

  if (target.position === 'SECTION_CHIEF') {
    return target.divisionHeadId ?? null
  }

  return null
}
