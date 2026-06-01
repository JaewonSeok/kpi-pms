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

// scope='team' + 본부만 선택 + 직접 자식 팀 0건일 때만 발동하는 폴백.
// 그 본부 subtree의 모든 team-scope 부서를 effective 집합으로 채운다.
// 기존 buildOrgKpiEffectiveDepartmentIds의 동작/시그니처를 보존하기 위해 별도 후처리 함수로 분리.
//
// ★ 일관성 보장: 본부 subtree 매칭 판정에 카드 카운트(src/lib/org-kpi-card-counts.ts)와
// 동일한 resolveOrgKpiFilterContext를 사용. 같은 트리 + 같은 함수 → 같은 집합.
// → "카드 N 건인데 목록 M 건" 불일치 구조적으로 안 생긴다.
export function expandTeamScopeWithDivisionSubtreeFallback(params: {
  baseEffectiveIds: Set<string>
  scope: OrgKpiScope
  divisionId: string | null
  sectionId: string | null
  departments: OrgKpiHierarchyDepartmentOption[]
}): Set<string> {
  // 폴백 조건 4가지 AND — 미충족이면 base 그대로 반환 (no-op).
  if (params.scope !== 'team') return params.baseEffectiveIds
  if (!params.divisionId) return params.baseEffectiveIds
  if (params.sectionId) return params.baseEffectiveIds
  if (params.baseEffectiveIds.size > 0) return params.baseEffectiveIds

  // 본부 subtree의 모든 team scope 부서 — 카드 helper의 ancestor walk와 동일 판정.
  const targetDivisionId = params.divisionId
  const result = new Set<string>()
  for (const department of params.departments) {
    if (department.scope !== 'team') continue
    const context = resolveOrgKpiFilterContext(department.id, params.departments)
    if (context.divisionId === targetDivisionId) {
      result.add(department.id)
    }
  }
  return result
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
