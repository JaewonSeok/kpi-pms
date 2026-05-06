import { buildOrgKpiDepartmentScopeMap, type OrgKpiScope } from './org-kpi-scope'

type DepartmentLike = {
  id: string
  deptCode: string
  deptName: string
  parentDeptId: string | null
}

export type DepartmentSelectorOption = {
  id: string
  deptCode: string
  deptName: string
  scope: OrgKpiScope
}

export type DepartmentSelectionState = {
  selectedDivisionId: string
  selectedSectionId: string
  selectedTeamId: string
  resolvedDepartmentId: string
  divisionOptions: DepartmentSelectorOption[]
  sectionOptions: DepartmentSelectorOption[]
  teamOptions: DepartmentSelectorOption[]
  hasSectionLayer: boolean
}

function sortOptions<T extends DepartmentLike>(departments: T[]) {
  return [...departments].sort(
    (left, right) =>
      left.deptName.localeCompare(right.deptName, 'ko') ||
      left.deptCode.localeCompare(right.deptCode, 'ko'),
  )
}

function looksLikeSectionDepartment(department: DepartmentLike) {
  return department.deptName.trim().endsWith('실')
}

export function buildDepartmentSelectionState<T extends DepartmentLike>(
  departments: T[],
  selectedDepartmentId: string,
): DepartmentSelectionState {
  const baseScopeMap = buildOrgKpiDepartmentScopeMap(departments)
  const departmentById = new Map(departments.map((department) => [department.id, department] as const))
  const childrenByParentId = new Map<string | null, T[]>()

  departments.forEach((department) => {
    const children = childrenByParentId.get(department.parentDeptId) ?? []
    children.push(department)
    childrenByParentId.set(department.parentDeptId, children)
  })

  const scopeMap = new Map(
    departments.map((department) => {
      const baseScope = baseScopeMap.get(department.id) ?? 'team'
      const parentDepartment = department.parentDeptId
        ? departmentById.get(department.parentDeptId) ?? null
        : null
      const parentScope = parentDepartment ? baseScopeMap.get(parentDepartment.id) ?? 'team' : null

      if (baseScope === 'team' && parentScope === 'division' && looksLikeSectionDepartment(department)) {
        return [department.id, 'section' satisfies OrgKpiScope] as const
      }

      return [department.id, baseScope] as const
    }),
  )

  const divisionDepartments = sortOptions(
    departments.filter((department) => (scopeMap.get(department.id) ?? 'team') === 'division'),
  )

  const lineage: T[] = []
  let current = selectedDepartmentId ? departmentById.get(selectedDepartmentId) : undefined
  while (current) {
    lineage.unshift(current)
    current = current.parentDeptId ? departmentById.get(current.parentDeptId) : undefined
  }

  const selectedDivision =
    lineage.find((department) => (scopeMap.get(department.id) ?? 'team') === 'division') ??
    divisionDepartments[0] ??
    null

  const selectedDivisionId = selectedDivision?.id ?? ''
  const sectionOptions = sortOptions(
    (childrenByParentId.get(selectedDivisionId) ?? []).filter(
      (department) => (scopeMap.get(department.id) ?? 'team') === 'section',
    ),
  )
  const hasSectionLayer = sectionOptions.length > 0
  const selectedSection =
    lineage.find((department) => (scopeMap.get(department.id) ?? 'team') === 'section') ?? null
  const selectedSectionId = selectedSection?.id ?? ''

  const teamParentId = hasSectionLayer ? selectedSectionId : selectedDivisionId
  const teamOptions = sortOptions(
    (childrenByParentId.get(teamParentId || null) ?? []).filter(
      (department) => (scopeMap.get(department.id) ?? 'team') === 'team',
    ),
  )
  const selectedTeam =
    lineage.find((department) => (scopeMap.get(department.id) ?? 'team') === 'team') ?? null
  const selectedTeamId = selectedTeam?.id ?? ''

  return {
    selectedDivisionId,
    selectedSectionId,
    selectedTeamId,
    resolvedDepartmentId: selectedTeamId || selectedSectionId || selectedDivisionId,
    divisionOptions: divisionDepartments.map((department) => ({
      id: department.id,
      deptCode: department.deptCode,
      deptName: department.deptName,
      scope: scopeMap.get(department.id) ?? 'division',
    })),
    sectionOptions: sectionOptions.map((department) => ({
      id: department.id,
      deptCode: department.deptCode,
      deptName: department.deptName,
      scope: scopeMap.get(department.id) ?? 'section',
    })),
    teamOptions: teamOptions.map((department) => ({
      id: department.id,
      deptCode: department.deptCode,
      deptName: department.deptName,
      scope: scopeMap.get(department.id) ?? 'team',
    })),
    hasSectionLayer,
  }
}
