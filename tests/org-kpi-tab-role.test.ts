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

function makeKpi(
  params: Partial<OrgKpiViewModel> &
    Pick<OrgKpiViewModel, 'id' | 'title' | 'departmentId' | 'departmentName'>
): OrgKpiViewModel {
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
    category: params.category ?? '운영',
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

run('org KPI hierarchy keeps parent nodes visible when child goals are hidden by department filters', () => {
  const root = makeKpi({
    id: 'root-filter',
    title: '본부 공통 개선 과제',
    departmentId: 'dept-root',
    departmentName: '경영지원본부',
    childOrgKpiCount: 1,
  })
  const child = makeKpi({
    id: 'child-filter',
    title: '팀 실행 과제',
    departmentId: 'dept-team',
    departmentName: '인사팀',
    parentOrgKpiId: 'root-filter',
    parentOrgKpiTitle: '본부 공통 개선 과제',
  })

  const view = buildOrgKpiHierarchyView({
    items: [root, child],
    selectedDepartmentId: 'dept-root',
    search: '',
    selectedKpiId: 'root-filter',
  })

  assert.equal(view.roots.length, 1)
  assert.equal(view.roots[0]?.kpi.id, 'root-filter')
  assert.equal(view.roots[0]?.children.length, 0)
})

run('org KPI workspace exposes a distinct map tab and relationship-focused UI', () => {
  const clientSource = read('src/components/kpi/OrgKpiManagementClient.tsx')

  assert.match(clientSource, /type TabKey = 'map' \| 'list' \| 'linkage' \| 'history' \| 'ai'/)
  assert.match(clientSource, /map: '목표맵'/)
  assert.match(clientSource, /<OrgKpiHierarchyPanel/)
  assert.match(clientSource, /목표 구조 읽는 법/)
  assert.match(clientSource, /미연결 KPI/)
  assert.match(clientSource, /하위 목표 연결 상태/)
  assert.match(clientSource, /상위 목표에서 하위 목표로 이어지는 구조를 따라가며 cascade 상태를 확인합니다\./)
})

run('goal map cards expose connector-capable DOM structure for expanded and collapsed hierarchy states', () => {
  const clientSource = read('src/components/kpi/OrgKpiManagementClient.tsx')

  assert.match(clientSource, /const \[expandedMapNodeIds, setExpandedMapNodeIds\] = useState<string\[\]>\(\[\]\)/)
  assert.match(clientSource, /const toggleMapNodeExpansion = useCallback\(\(kpiId: string\) =>/)
  assert.match(clientSource, /const totalChildCount = Math\.max\(node\.kpi\.childOrgKpiCount, node\.children\.length\)/)
  assert.match(clientSource, /const hiddenChildCount = Math\.max\(totalChildCount - node\.children\.length, 0\)/)
  assert.match(clientSource, /const childSummaryLabel = hasChildren \? `하위 목표 \$\{totalChildCount\}개` : '하위 목표 없음'/)
  assert.match(clientSource, /role="button"/)
  assert.match(clientSource, /data-testid="org-kpi-connector-preview"/)
  assert.match(clientSource, /data-testid="org-kpi-expanded-child-section"/)
  assert.match(clientSource, /data-testid="org-kpi-connector-parent-stem"/)
  assert.match(clientSource, /data-testid="org-kpi-connector-trunk"/)
  assert.match(clientSource, /data-testid="org-kpi-connector-branch"/)
  assert.match(clientSource, /data-testid="org-kpi-filtered-child-hint"/)
  assert.match(clientSource, /border-l-2 border-dotted border-slate-400/)
  assert.match(clientSource, /border-t-2 border-dotted border-slate-400/)
  assert.match(clientSource, /하위 목표가 없습니다\./)
  assert.match(clientSource, /필터로 숨겨진 하위 목표가 있습니다\./)
  assert.match(clientSource, /필터로 숨김/)
  assert.match(clientSource, /상위 목표와 연결되지 않았습니다\./)
  assert.match(clientSource, /하위 목표 펼치기/)
  assert.match(clientSource, /하위 목표 접기/)
  assert.match(clientSource, /연결 현황 보기/)
  assert.match(clientSource, /expandedIds=\{expandedMapNodeIds\}/)
  assert.match(clientSource, /onToggleExpand=\{toggleMapNodeExpansion\}/)
})

run('goal alignment links target the structure-first map tab again', () => {
  const source = read('src/server/goal-alignment.ts')

  assert.equal(source.includes('tab=map'), true)
  assert.match(source, /orgKpiHref:\s*selectedDepartmentId === 'ALL'\s*\?\s*`\/kpi\/org\?year=\$\{selectedYear\}&tab=map`/)
})

console.log('Org KPI tab role tests completed')
