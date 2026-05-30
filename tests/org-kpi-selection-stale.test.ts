import assert from 'node:assert/strict'
import type { OrgKpiViewModel } from '../src/server/org-kpi-page'
import {
  getSelectableOrgKpis,
  resolveSelectedOrgKpi,
} from '../src/lib/org-kpi-selection'

function run(name: string, fn: () => void) {
  try {
    fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

function makeKpi(
  params: Partial<OrgKpiViewModel> &
    Pick<OrgKpiViewModel, 'id' | 'title' | 'departmentId' | 'departmentName'>,
): OrgKpiViewModel {
  return {
    id: params.id,
    title: params.title,
    scope: params.scope ?? 'team',
    tags: [],
    evalYear: 2026,
    departmentId: params.departmentId,
    departmentName: params.departmentName,
    departmentCode: 'D-1',
    parentOrgKpiId: params.parentOrgKpiId ?? null,
    parentOrgKpiTitle: params.parentOrgKpiTitle ?? null,
    parentOrgDepartmentName: params.parentOrgDepartmentName ?? null,
    parentReference: params.parentReference ?? null,
    childReferences: params.childReferences ?? [],
    childOrgKpiCount: params.childOrgKpiCount ?? 0,
    lineage: params.lineage ?? [],
    category: params.category ?? '운영',
    type: params.type ?? 'QUANTITATIVE',
    definition: params.definition ?? '정의',
    formula: params.formula ?? '공식',
    targetValue: params.targetValue ?? 100,
    targetValueT: params.targetValueT ?? 90,
    targetValueE: params.targetValueE ?? 100,
    targetValueS: params.targetValueS ?? 110,
    unit: params.unit ?? '%',
    weight: params.weight ?? 20,
    difficulty: params.difficulty ?? 'MEDIUM',
    status: params.status ?? 'DRAFT',
    persistedStatus: params.persistedStatus ?? 'DRAFT',
    owner: params.owner,
    linkedPersonalKpiCount: params.linkedPersonalKpiCount ?? 1,
    linkedConfirmedPersonalKpiCount: params.linkedConfirmedPersonalKpiCount ?? 1,
    monthlyAchievementRate: params.monthlyAchievementRate ?? 95,
    updatedAt: params.updatedAt,
    coverageRate: params.coverageRate ?? 75,
    targetPopulationCount: params.targetPopulationCount ?? 4,
    cloneInfo: params.cloneInfo,
    suggestedParent: params.suggestedParent ?? null,
    suggestedChildren: params.suggestedChildren ?? [],
    linkedPersonalKpis: params.linkedPersonalKpis ?? [],
    recentMonthlyRecords: params.recentMonthlyRecords ?? [],
    history: params.history ?? [],
  }
}

// 시나리오 데이터 — 두 본부에 각각 KPI 하나씩.
const deptA = { id: 'dept-a', name: '경영지원본부' }
const deptB = { id: 'dept-b', name: '글로벌기술지원본부' } // 빈 본부
const kpiA = makeKpi({
  id: 'kpi-a',
  title: 'AI 활용 업무 프로세스 개선',
  departmentId: deptA.id,
  departmentName: deptA.name,
})
const kpiC = makeKpi({
  id: 'kpi-c',
  title: '다른 본부 KPI',
  departmentId: 'dept-c',
  departmentName: '제3본부',
})
const fullList = [kpiA, kpiC]

// ────────────────────────────────────────────
// getSelectableOrgKpis (단독)
// ────────────────────────────────────────────
run('getSelectableOrgKpis: list 탭은 filteredList를 그대로 반환', () => {
  const result = getSelectableOrgKpis({
    tab: 'list',
    list: fullList,
    filteredList: [kpiA],
    hierarchyVisibleIds: new Set(),
  })
  assert.deepEqual(result.map((k) => k.id), ['kpi-a'])
})

run('getSelectableOrgKpis: linkage 탭도 filteredList 사용 (map 외)', () => {
  const result = getSelectableOrgKpis({
    tab: 'linkage',
    list: fullList,
    filteredList: [kpiA],
    hierarchyVisibleIds: new Set(['kpi-c']),
  })
  assert.deepEqual(result.map((k) => k.id), ['kpi-a'])
})

run('getSelectableOrgKpis: map 탭은 hierarchyVisibleIds로 list 필터', () => {
  const result = getSelectableOrgKpis({
    tab: 'map',
    list: fullList,
    filteredList: [kpiA],
    hierarchyVisibleIds: new Set(['kpi-c']),
  })
  // map 탭은 filteredList 무시 — visibleIds가 진실의 원천 (타 본부 ancestor 노출)
  assert.deepEqual(result.map((k) => k.id), ['kpi-c'])
})

// ────────────────────────────────────────────
// resolveSelectedOrgKpi — 회귀 직접 방지 케이스
// ────────────────────────────────────────────
run('resolveSelectedOrgKpi: id가 selectableItems에 있으면 그 KPI 반환', () => {
  const result = resolveSelectedOrgKpi({ selectedKpiId: 'kpi-a', selectableItems: [kpiA] })
  assert.equal(result?.id, 'kpi-a')
})

run('회귀방지: id가 list엔 있고 filteredList엔 없으면 null (이전엔 list.find로 stale 렌더)', () => {
  // 시나리오: 사용자가 본부A의 kpi-a를 선택 → 본부B로 전환 → kpi-a는 본부B의
  // selectable(=filteredList)에 없음. 이전 버그에선 render fallback이 전역
  // list.find로 폴백해 kpi-a를 그대로 렌더했음.
  const selectableItems = getSelectableOrgKpis({
    tab: 'list',
    list: fullList,
    filteredList: [], // 본부B는 KPI 없음
    hierarchyVisibleIds: new Set(),
  })
  const result = resolveSelectedOrgKpi({
    selectedKpiId: 'kpi-a',
    selectableItems,
  })
  assert.equal(result, null)
})

run('회귀방지: 빈 본부(filteredList=[]) + 어떤 selectedKpiId든 → null (이전엔 list[0] 폴백)', () => {
  const result = resolveSelectedOrgKpi({
    selectedKpiId: 'kpi-a',
    selectableItems: [],
  })
  assert.equal(result, null)
})

run('resolveSelectedOrgKpi: selectedKpiId가 null/undefined/빈문자열 → null', () => {
  for (const id of [null, undefined, '']) {
    const result = resolveSelectedOrgKpi({ selectedKpiId: id, selectableItems: [kpiA] })
    assert.equal(result, null, `id=${JSON.stringify(id)} 인데 null 아님`)
  }
})

// ────────────────────────────────────────────
// map 탭 ancestor 동작 보존 — 회귀 없음을 보장
// ────────────────────────────────────────────
run('map 탭 ancestor: filteredList엔 없지만 hierarchyVisibleIds엔 있으면 selectable→반환', () => {
  // 본부A 사용자가 map 탭에서 본부B(또는 본부C)의 상위 ancestor를 클릭한 시나리오.
  const selectableItems = getSelectableOrgKpis({
    tab: 'map',
    list: fullList,
    filteredList: [kpiA],
    hierarchyVisibleIds: new Set(['kpi-a', 'kpi-c']), // ancestor 포함
  })
  const result = resolveSelectedOrgKpi({ selectedKpiId: 'kpi-c', selectableItems })
  assert.equal(result?.id, 'kpi-c')
})

run('map 탭: id가 hierarchyVisibleIds 밖이면 null', () => {
  const selectableItems = getSelectableOrgKpis({
    tab: 'map',
    list: fullList,
    filteredList: [kpiA],
    hierarchyVisibleIds: new Set(['kpi-a']),
  })
  const result = resolveSelectedOrgKpi({ selectedKpiId: 'kpi-c', selectableItems })
  assert.equal(result, null)
})
