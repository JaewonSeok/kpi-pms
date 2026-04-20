import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { OrgKpiViewModel } from '../src/server/org-kpi-page'
import { buildOrgKpiHierarchyView } from '../src/lib/org-kpi-hierarchy'

function run(name: string, fn: () => void) {
  try {
    fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

function read(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')
}

function makeKpi(params: Partial<OrgKpiViewModel> & Pick<OrgKpiViewModel, 'id' | 'title' | 'departmentId' | 'departmentName'>): OrgKpiViewModel {
  return {
    id: params.id,
    title: params.title,
    tags: [],
    evalYear: 2026,
    departmentId: params.departmentId,
    departmentName: params.departmentName,
    departmentCode: 'D-1',
    parentOrgKpiId: params.parentOrgKpiId ?? null,
    parentOrgKpiTitle: params.parentOrgKpiTitle ?? null,
    parentOrgDepartmentName: params.parentOrgDepartmentName ?? null,
    childOrgKpiCount: params.childOrgKpiCount ?? 0,
    lineage: params.lineage ?? [],
    category: params.category ?? '전략',
    type: params.type ?? 'QUANTITATIVE',
    definition: params.definition ?? '정의',
    formula: params.formula ?? '산식',
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
    riskFlags: params.riskFlags ?? [],
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

run('org KPI hierarchy view groups parent-child links and separates disconnected goals', () => {
  const root = makeKpi({
    id: 'root',
    title: '본부 비용 구조 개선',
    departmentId: 'dept-root',
    departmentName: '경영지원본부',
    childOrgKpiCount: 1,
  })
  const child = makeKpi({
    id: 'child',
    title: '인사팀 채용 효율화',
    departmentId: 'dept-team',
    departmentName: '인사팀',
    parentOrgKpiId: 'root',
    parentOrgKpiTitle: '본부 비용 구조 개선',
  })
  const disconnected = makeKpi({
    id: 'solo',
    title: '독립 운영 지표',
    departmentId: 'dept-team',
    departmentName: '인사팀',
    linkedPersonalKpiCount: 0,
    coverageRate: 0,
    childOrgKpiCount: 0,
    riskFlags: ['개인 KPI 연결 없음'],
  })

  const view = buildOrgKpiHierarchyView({
    items: [root, child, disconnected],
    selectedDepartmentId: 'dept-team',
    search: '',
    selectedKpiId: 'child',
  })

  assert.equal(view.roots.length, 1)
  assert.equal(view.roots[0]?.kpi.id, 'root')
  assert.equal(view.roots[0]?.children[0]?.kpi.id, 'child')
  assert.equal(view.disconnected[0]?.id, 'solo')
  assert.equal(view.ancestorIds.has('root'), true)
})

run('org KPI workspace exposes a distinct map tab and relationship-focused UI', () => {
  const clientSource = read('src/components/kpi/OrgKpiManagementClient.tsx')

  assert.match(clientSource, /type TabKey = 'map' \| 'list' \| 'linkage' \| 'history' \| 'ai'/)
  assert.match(clientSource, /map: '목표맵'/)
  assert.match(clientSource, /<OrgKpiHierarchyPanel/)
  assert.match(clientSource, /목표 구조 읽는 법/)
  assert.match(clientSource, /미연결 KPI/)
  assert.match(clientSource, /연결 구조 요약/)
  assert.match(clientSource, /상위 목표와 하위 목표의 cascade 구조를 따라가며/)
  assert.match(clientSource, /조직 KPI를 검색하고, 부서별로 살펴보며 연결 상태와 상세 정보를 빠르게 운영 관점에서 확인합니다\./)
})

run('goal alignment links target the structure-first map tab again', () => {
  const source = read('src/server/goal-alignment.ts')

  assert.equal(source.includes('tab=map'), true)
  assert.match(source, /orgKpiHref:\s*selectedDepartmentId === 'ALL'\s*\?\s*`\/kpi\/org\?year=\$\{selectedYear\}&tab=map`/)
})

console.log('Org KPI tab role tests completed')
