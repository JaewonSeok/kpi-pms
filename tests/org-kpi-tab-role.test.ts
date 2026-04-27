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
    title: 'Division Goal',
    scope: 'division',
    departmentId: 'dept-root',
    departmentName: 'Division',
    childOrgKpiCount: 1,
    childReferences: [
      {
        id: 'child',
        title: 'Team Goal',
        departmentId: 'dept-team',
        departmentName: 'HR Team',
        scope: 'team',
      },
    ],
  })
  const child = makeKpi({
    id: 'child',
    title: 'Team Goal',
    scope: 'team',
    departmentId: 'dept-team',
    departmentName: 'HR Team',
    parentOrgKpiId: 'root',
    parentOrgKpiTitle: 'Division Goal',
    parentReference: {
      id: 'root',
      title: 'Division Goal',
      departmentId: 'dept-root',
      departmentName: 'Division',
      scope: 'division',
    },
  })
  const disconnected = makeKpi({
    id: 'solo',
    title: 'Solo Goal',
    scope: 'team',
    departmentId: 'dept-team',
    departmentName: 'HR Team',
    linkedPersonalKpiCount: 0,
    coverageRate: 0,
    childOrgKpiCount: 0,
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

run('org KPI page exposes division and team scope tabs without the removed AI tab', () => {
  const clientSource = read('src/components/kpi/OrgKpiManagementClient.tsx')

  assert.match(clientSource, /pageData\.scopeTabs\.map/)
  assert.match(clientSource, /scopeCreateLabel/)
  assert.match(clientSource, /scopeMapTitle/)
  assert.match(clientSource, /scopeHistoryTitle/)
  assert.match(clientSource, /const TAB_ORDER: TabKey\[\] = \['list', 'map', 'linkage', 'history'\]/)
  assert.doesNotMatch(clientSource, /tab === 'ai' \? \(/)
})

run('goal alignment links preserve the org KPI scope in deep links', () => {
  const source = read('src/server/goal-alignment.ts')

  assert.equal(source.includes('scope='), true)
  assert.equal(source.includes('resolveOrgKpiScopeFromDepartmentId'), true)
  assert.equal(source.includes('tab=map'), true)
  assert.equal(source.includes('tab=linkage'), true)
})

console.log('Org KPI tab role tests completed')
