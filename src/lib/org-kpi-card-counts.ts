// /kpi/org 상단 요약 카드 (본부/실/팀 KPI 개수) 카운트 helper.
//
// 서버는 슬림 cross-scope 인덱스(`kpiDepartmentIdsByScope: Record<OrgKpiScope, string[]>`)를
// 내려보내고, 클라는 selectedDivisionId 기준으로 본부 귀속 판정을 부모-chain walk로
// 즉시 derive한다. 본부 변경 시 서버 round-trip 0.
//
// 본부 귀속 판정은 목록 필터와 동일 소스(departments + resolveOrgKpiFilterContext)를
// 사용해 "카드 수 ≠ 목록 수" 구조적 불일치를 방지한다.

import type { OrgKpiScope } from '@/lib/org-kpi-scope'
import {
  resolveOrgKpiFilterContext,
  type OrgKpiHierarchyDepartmentOption,
} from '@/lib/org-kpi-filters'

export type OrgKpiCardCounts = Record<OrgKpiScope, number>

export function countOrgKpisByScopeForDivision(params: {
  kpiDepartmentIdsByScope: Record<OrgKpiScope, string[]>
  departments: OrgKpiHierarchyDepartmentOption[]
  selectedDivisionId: string | null
}): OrgKpiCardCounts {
  // 본부 미선택 → 전체 합계 fallback (departments 매핑 없이 단순 길이)
  if (!params.selectedDivisionId) {
    return {
      division: params.kpiDepartmentIdsByScope.division.length,
      section: params.kpiDepartmentIdsByScope.section.length,
      team: params.kpiDepartmentIdsByScope.team.length,
    }
  }

  const selectedId = params.selectedDivisionId
  const matchesDivision = (deptId: string) => {
    const context = resolveOrgKpiFilterContext(deptId, params.departments)
    return context.divisionId === selectedId
  }

  return {
    division: params.kpiDepartmentIdsByScope.division.filter(matchesDivision).length,
    section: params.kpiDepartmentIdsByScope.section.filter(matchesDivision).length,
    team: params.kpiDepartmentIdsByScope.team.filter(matchesDivision).length,
  }
}
