// 조직 KPI 선택 상태 해소 — effect/render가 동일 규칙을 공유하도록 단일 출처화.
// 회귀 방지: 이전엔 render fallback이 filteredList → list 전역으로 폴백해
// "현재 필터엔 없지만 직전 본부에 있던 stale KPI"를 그대로 보여주는 버그가 있었음.
// 이 헬퍼는 현재 selectable 집합 밖이면 명시적으로 null을 반환해 호출측이
// placeholder(빈 상태)를 떨어뜨리도록 한다.

import type { OrgKpiViewModel } from '@/server/org-kpi-page'

export type OrgKpiSelectionTabKey = 'list' | 'map' | 'linkage' | 'history'

// 탭/필터 결합 규칙:
// - 'map': hierarchyVisibleIds에 포함된 KPI만 selectable. 트리에 표시되는
//   타 본부 ancestor를 상세 패널에서 볼 수 있어야 하기 때문.
// - 그 외 탭: 현재 dept/검색 필터가 적용된 filteredList 그대로.
export function getSelectableOrgKpis(input: {
  tab: OrgKpiSelectionTabKey
  list: OrgKpiViewModel[]
  filteredList: OrgKpiViewModel[]
  hierarchyVisibleIds: ReadonlySet<string>
}): OrgKpiViewModel[] {
  if (input.tab === 'map') {
    return input.list.filter((item) => input.hierarchyVisibleIds.has(item.id))
  }
  return input.filteredList
}

// 선택 id는 현재 selectable 집합 안에서만 해소. 폴백으로 전체 list나 첫 항목으로
// 새지 않는다. id가 비어있거나 selectable 밖이면 null 반환.
export function resolveSelectedOrgKpi(input: {
  selectedKpiId: string | null | undefined
  selectableItems: OrgKpiViewModel[]
}): OrgKpiViewModel | null {
  const id = input.selectedKpiId
  if (!id) return null
  return input.selectableItems.find((item) => item.id === id) ?? null
}
