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
    scope: 'division',
    departmentId: 'dept-root',
    departmentName: '경영지원본부',
    childOrgKpiCount: 1,
    childReferences: [
      {
        id: 'child',
        title: '인사팀 채용 효율화',
        departmentId: 'dept-team',
        departmentName: '인사팀',
        scope: 'team',
      },
    ],
  })
  const child = makeKpi({
    id: 'child',
    title: '인사팀 채용 효율화',
    scope: 'team',
    departmentId: 'dept-team',
    departmentName: '인사팀',
    parentOrgKpiId: 'root',
    parentOrgKpiTitle: '본부 비용 구조 개선',
    parentReference: {
      id: 'root',
      title: '본부 비용 구조 개선',
      departmentId: 'dept-root',
      departmentName: '경영지원본부',
      scope: 'division',
    },
  })
  const disconnected = makeKpi({
    id: 'solo',
    title: '독립 운영 지표',
    scope: 'team',
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

run('org KPI page exposes a two-level scope UX with division and team tabs', () => {
  const clientSource = read('src/components/kpi/OrgKpiManagementClient.tsx')

  assert.match(clientSource, /본부 KPI/)
  assert.match(clientSource, /팀 KPI/)
  assert.match(clientSource, /pageData\.scopeTabs\.map/)
  assert.match(clientSource, /type TabKey = 'map' \| 'list' \| 'linkage' \| 'history' \| 'ai'/)
  assert.match(clientSource, /scopeCreateLabel/)
  assert.match(clientSource, /scopeMapTitle/)
  assert.match(clientSource, /scopeHistoryTitle/)
})

run('AI workspace stays in team scope and division scope offers a real jump action', () => {
  const clientSource = read('src/components/kpi/OrgKpiManagementClient.tsx')

  assert.match(clientSource, /pageData\.selectedScope === 'team'/)
  assert.match(clientSource, /팀 KPI AI 추천은 팀 KPI 탭에서 사용할 수 있습니다\./)
  assert.match(clientSource, /actionLabel="팀 KPI로 이동"/)
  assert.match(clientSource, /<OrgKpiTeamAiWorkspace/)
})

run('goal alignment links now preserve the org KPI scope in deep links', () => {
  const source = read('src/server/goal-alignment.ts')

  assert.equal(source.includes('scope='), true)
  assert.equal(source.includes('resolveOrgKpiScopeFromDepartmentId'), true)
  assert.equal(source.includes('tab=map'), true)
  assert.equal(source.includes('tab=linkage'), true)
})

console.log('Org KPI tab role tests completed')
