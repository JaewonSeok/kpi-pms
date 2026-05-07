import type { OrgKpiScope } from '@/lib/org-kpi-scope'

export type OrgKpiHierarchyDepartmentOption = {
  id: string
  name: string
  parentDepartmentId: string | null
  organizationName: string
  level: number
  scope: OrgKpiScope
}

type FilterContext = {
  divisionId: string | null
  sectionId: string | null
  teamId: string | null
}

function buildDepartmentMap(departments: OrgKpiHierarchyDepartmentOption[]) {
  return new Map(departments.map((department) => [department.id, department] as const))
}

function getAncestorIds(
  departmentId: string,
  departmentMap: Map<string, OrgKpiHierarchyDepartmentOption>,
) {
  const ancestorIds: string[] = []
  let current = departmentMap.get(departmentId)

  while (current?.parentDepartmentId) {
    ancestorIds.push(current.parentDepartmentId)
    current = departmentMap.get(current.parentDepartmentId)
  }

  return ancestorIds
}

export function resolveOrgKpiFilterContext(
  departmentId: string | null | undefined,
  departments: OrgKpiHierarchyDepartmentOption[],
): FilterContext {
  if (!departmentId) {
    return {
      divisionId: null,
      sectionId: null,
      teamId: null,
    }
  }

  const departmentMap = buildDepartmentMap(departments)
  const current = departmentMap.get(departmentId)
  if (!current) {
    return {
      divisionId: null,
      sectionId: null,
      teamId: null,
    }
  }

  const ancestorIds = getAncestorIds(departmentId, departmentMap)
  const ancestors = ancestorIds
    .map((ancestorId) => departmentMap.get(ancestorId))
    .filter((department): department is OrgKpiHierarchyDepartmentOption => Boolean(department))

  const division =
    current.scope === 'division'
      ? current
      : ancestors.find((department) => department.scope === 'division') ?? null
  const section =
    current.scope === 'section'
      ? current
      : ancestors.find((department) => department.scope === 'section') ?? null
  const team = current.scope === 'team' ? current : null

  return {
    divisionId: division?.id ?? null,
    sectionId: section?.id ?? null,
    teamId: team?.id ?? null,
  }
}

export function getOrgKpiDivisionOptions(departments: OrgKpiHierarchyDepartmentOption[]) {
  return departments
    .filter((department) => department.scope === 'division')
    .sort((left, right) => left.level - right.level || left.name.localeCompare(right.name, 'ko'))
}

export function getOrgKpiSectionOptions(
  departments: OrgKpiHierarchyDepartmentOption[],
  divisionId: string | null,
) {
  return departments
    .filter(
      (department) =>
        department.scope === 'section' &&
        (!divisionId || department.parentDepartmentId === divisionId),
    )
    .sort((left, right) => left.level - right.level || left.name.localeCompare(right.name, 'ko'))
}

export function getOrgKpiTeamOptions(params: {
  departments: OrgKpiHierarchyDepartmentOption[]
  divisionId: string | null
  sectionId: string | null
}) {
  return params.departments
    .filter((department) => {
      if (department.scope !== 'team') {
        return false
      }

      if (params.sectionId) {
        return department.parentDepartmentId === params.sectionId
      }

      if (params.divisionId) {
        return department.parentDepartmentId === params.divisionId
      }

      return true
    })
    .sort((left, right) => left.level - right.level || left.name.localeCompare(right.name, 'ko'))
}

export function buildOrgKpiEffectiveDepartmentIds(params: {
  scope: OrgKpiScope
  divisionId: string | null
  sectionId: string | null
  teamId: string | null
  divisionOptions: OrgKpiHierarchyDepartmentOption[]
  sectionOptions: OrgKpiHierarchyDepartmentOption[]
  teamOptions: OrgKpiHierarchyDepartmentOption[]
}) {
  if (params.scope === 'division') {
    return new Set(
      params.divisionId ? [params.divisionId] : params.divisionOptions.map((department) => department.id),
    )
  }

  if (params.scope === 'section') {
    return new Set(
      params.sectionId ? [params.sectionId] : params.sectionOptions.map((department) => department.id),
    )
  }

  return new Set(
    params.teamId ? [params.teamId] : params.teamOptions.map((department) => department.id),
  )
}

export function buildOrgKpiFilterContextLabel(params: {
  scopeLabel: string
  divisionName?: string | null
  sectionName?: string | null
  teamName?: string | null
}) {
  const segments = [params.divisionName, params.sectionName, params.teamName].filter(
    (value): value is string => typeof value === 'string' && value.trim().length > 0,
  )

  if (!segments.length) {
    return `현재 범위: ${params.scopeLabel}`
  }

  return `현재 범위: ${segments.join(' / ')} · ${params.scopeLabel}`
}
