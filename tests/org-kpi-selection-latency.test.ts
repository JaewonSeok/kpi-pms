import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { OrgKpiViewModel } from '../src/server/org-kpi-page'
import {
  buildOrgKpiStructureSummary,
  buildOrgKpiHierarchySelectionView,
  buildOrgKpiHierarchyStructure,
  buildOrgKpiHierarchyView,
  countOrgKpiHierarchyAffectedNodes,
  countOrgKpiHierarchyNodes,
  getOrgKpiHierarchyInteractionChangedIds,
} from '../src/lib/org-kpi-hierarchy'

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
    category: params.category ?? '?댁쁺',
    type: params.type ?? 'QUANTITATIVE',
    definition: params.definition ?? '?뺤쓽',
    formula: params.formula ?? '?곗떇',
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

run('split hierarchy helpers preserve the same structure and selection lineage as the combined builder', () => {
  const root = makeKpi({
    id: 'root',
    title: '蹂몃? 紐⑺몴',
    scope: 'division',
    departmentId: 'dept-root',
    departmentName: '蹂몃?',
    childOrgKpiCount: 1,
    childReferences: [
      {
        id: 'child',
        title: '? 紐⑺몴',
        departmentId: 'dept-team',
        departmentName: '?',
        scope: 'team',
      },
    ],
  })
  const child = makeKpi({
    id: 'child',
    title: '? 紐⑺몴',
    scope: 'team',
    departmentId: 'dept-team',
    departmentName: '?',
    parentOrgKpiId: 'root',
    parentOrgKpiTitle: '蹂몃? 紐⑺몴',
    parentReference: {
      id: 'root',
      title: '蹂몃? 紐⑺몴',
      departmentId: 'dept-root',
      departmentName: '蹂몃?',
      scope: 'division',
    },
    childOrgKpiCount: 1,
  })
  const grandChild = makeKpi({
    id: 'grand-child',
    title: '?ㅽ뻾 怨쇱젣',
    scope: 'team',
    departmentId: 'dept-team',
    departmentName: '?',
    parentOrgKpiId: 'child',
    parentOrgKpiTitle: '? 紐⑺몴',
    parentReference: {
      id: 'child',
      title: '? 紐⑺몴',
      departmentId: 'dept-team',
      departmentName: '?',
      scope: 'team',
    },
  })
  const solo = makeKpi({
    id: 'solo',
    title: '?낅┰ 紐⑺몴',
    scope: 'team',
    departmentId: 'dept-team',
    departmentName: '?',
  })

  const combined = buildOrgKpiHierarchyView({
    items: [root, child, grandChild, solo],
    selectedDepartmentId: 'ALL',
    search: '',
    selectedKpiId: 'child',
  })
  const structure = buildOrgKpiHierarchyStructure({
    items: [root, child, grandChild, solo],
    selectedDepartmentId: 'ALL',
    search: '',
  })
  const selection = buildOrgKpiHierarchySelectionView({
    items: [root, child, grandChild, solo],
    selectedKpiId: 'child',
  })

  assert.deepEqual(structure.roots.map((item) => item.kpi.id), combined.roots.map((item) => item.kpi.id))
  assert.deepEqual(
    structure.roots[0]?.children.map((item) => item.kpi.id),
    combined.roots[0]?.children.map((item) => item.kpi.id),
  )
  assert.deepEqual(Array.from(structure.visibleIds).sort(), Array.from(combined.visibleIds).sort())
  assert.deepEqual(Array.from(selection.ancestorIds).sort(), Array.from(combined.ancestorIds).sort())
  assert.deepEqual(Array.from(selection.descendantIds).sort(), Array.from(combined.descendantIds).sort())
})

run('team-scope KPI with a hidden division parent is not treated as an orphan', () => {
  const teamGoal = makeKpi({
    id: 'team-goal',
    title: '? ?ㅽ뻾 KPI',
    scope: 'team',
    departmentId: 'dept-team',
    departmentName: '?몄궗?',
    parentOrgKpiId: 'division-goal',
    parentOrgKpiTitle: '蹂몃? ?꾨왂 KPI',
    parentReference: {
      id: 'division-goal',
      title: '蹂몃? ?꾨왂 KPI',
      departmentId: 'dept-division',
      departmentName: '寃쎌쁺吏?먮낯遺',
      scope: 'division',
    },
  })

  const structure = buildOrgKpiHierarchyStructure({
    items: [teamGoal],
    selectedDepartmentId: 'ALL',
    search: '',
  })

  assert.equal(structure.roots.length, 1)
  assert.equal(structure.roots[0]?.kpi.id, 'team-goal')
  assert.equal(structure.roots[0]?.isOrphan, false)
  assert.equal(structure.disconnected.some((item) => item.id === 'team-goal'), false)
})

run('hierarchy interaction changes stay inside the affected branch', () => {
  const rootA = makeKpi({
    id: 'root-a',
    title: 'Root A',
    scope: 'division',
    departmentId: 'dept-a',
    departmentName: 'Dept A',
    childOrgKpiCount: 2,
  })
  const branchA = makeKpi({
    id: 'branch-a',
    title: 'Branch A',
    scope: 'team',
    departmentId: 'dept-a-team',
    departmentName: 'Dept A Team',
    parentOrgKpiId: 'root-a',
    parentReference: {
      id: 'root-a',
      title: 'Root A',
      departmentId: 'dept-a',
      departmentName: 'Dept A',
      scope: 'division',
    },
    childOrgKpiCount: 2,
  })
  const leafA1 = makeKpi({
    id: 'leaf-a-1',
    title: 'Leaf A1',
    scope: 'team',
    departmentId: 'dept-a-team',
    departmentName: 'Dept A Team',
    parentOrgKpiId: 'branch-a',
    parentReference: {
      id: 'branch-a',
      title: 'Branch A',
      departmentId: 'dept-a-team',
      departmentName: 'Dept A Team',
      scope: 'team',
    },
  })
  const leafA2 = makeKpi({
    id: 'leaf-a-2',
    title: 'Leaf A2',
    scope: 'team',
    departmentId: 'dept-a-team',
    departmentName: 'Dept A Team',
    parentOrgKpiId: 'branch-a',
    parentReference: {
      id: 'branch-a',
      title: 'Branch A',
      departmentId: 'dept-a-team',
      departmentName: 'Dept A Team',
      scope: 'team',
    },
  })
  const rootB = makeKpi({
    id: 'root-b',
    title: 'Root B',
    scope: 'division',
    departmentId: 'dept-b',
    departmentName: 'Dept B',
    childOrgKpiCount: 1,
  })
  const leafB1 = makeKpi({
    id: 'leaf-b-1',
    title: 'Leaf B1',
    scope: 'team',
    departmentId: 'dept-b-team',
    departmentName: 'Dept B Team',
    parentOrgKpiId: 'root-b',
    parentReference: {
      id: 'root-b',
      title: 'Root B',
      departmentId: 'dept-b',
      departmentName: 'Dept B',
      scope: 'division',
    },
  })

  const items = [rootA, branchA, leafA1, leafA2, rootB, leafB1]
  const structure = buildOrgKpiHierarchyStructure({
    items,
    selectedDepartmentId: 'ALL',
    search: '',
  })
  const beforeSelection = buildOrgKpiHierarchySelectionView({
    items,
    selectedKpiId: 'leaf-a-1',
  })
  const afterSelection = buildOrgKpiHierarchySelectionView({
    items,
    selectedKpiId: 'leaf-a-2',
  })
  const changedIds = getOrgKpiHierarchyInteractionChangedIds(
    {
      selectedKpiId: 'leaf-a-1',
      ancestorIds: beforeSelection.ancestorIds,
      descendantIds: beforeSelection.descendantIds,
      expandedIds: new Set(['root-a', 'branch-a']),
    },
    {
      selectedKpiId: 'leaf-a-2',
      ancestorIds: afterSelection.ancestorIds,
      descendantIds: afterSelection.descendantIds,
      expandedIds: new Set(['root-a', 'branch-a']),
    },
  )

  assert.equal(countOrgKpiHierarchyNodes(structure.roots) >= 2, true)
  assert.equal(countOrgKpiHierarchyAffectedNodes(structure.roots, changedIds) < countOrgKpiHierarchyNodes(structure.roots), true)
  assert.equal(changedIds.has('root-b'), false)
})

run('disconnected KPI summary stays informational without warning-remediation badges', () => {
  const kpi = makeKpi({
    id: 'disconnected',
    title: 'Disconnected Goal',
    departmentId: 'dept-a',
    departmentName: 'Dept A',
    linkedPersonalKpiCount: 0,
    recentMonthlyRecords: [],
  })

  const summary = buildOrgKpiStructureSummary(kpi, { isDisconnected: true })

  assert.equal(summary.label, null)
  assert.equal(summary.tone, 'neutral')
})

run('healthy structure without recent monthly records asks for execution input', () => {
  const kpi = makeKpi({
    id: 'execution-gap',
    title: 'Execution Gap',
    departmentId: 'dept-a',
    departmentName: 'Dept A',
    parentOrgKpiId: 'root-a',
    parentOrgKpiTitle: 'Root A',
    parentReference: {
      id: 'root-a',
      title: 'Root A',
      departmentId: 'dept-a',
      departmentName: 'Dept A',
      scope: 'division',
    },
    linkedPersonalKpiCount: 2,
    coverageRate: 100,
    recentMonthlyRecords: [],
  })

  const summary = buildOrgKpiStructureSummary(kpi)

  assert.equal(summary.label, '실적 입력 필요')
  assert.equal(summary.tone, 'warning')
})

run('linkage gaps no longer surface a dedicated warning-remediation badge', () => {
  const kpi = makeKpi({
    id: 'linkage-gap',
    title: 'Linkage Gap',
    departmentId: 'dept-a',
    departmentName: 'Dept A',
    parentOrgKpiId: 'root-a',
    parentOrgKpiTitle: 'Root A',
    parentReference: {
      id: 'root-a',
      title: 'Root A',
      departmentId: 'dept-a',
      departmentName: 'Dept A',
      scope: 'division',
    },
    linkedPersonalKpiCount: 0,
    coverageRate: 0,
    recentMonthlyRecords: [{ id: 'monthly-linkage-gap', employeeName: 'Sample', month: '2026-03', achievementRate: 82 }],
  })

  const summary = buildOrgKpiStructureSummary(kpi)

  assert.equal(summary.label, '정상')
  assert.equal(summary.tone, 'linked')
})

run('healthy root KPI with children is not flagged just for lacking a parent', () => {
  const kpi = makeKpi({
    id: 'root-healthy',
    title: 'Healthy Root',
    departmentId: 'dept-root',
    departmentName: 'Root Dept',
    childOrgKpiCount: 2,
    linkedPersonalKpiCount: 2,
    coverageRate: 100,
    recentMonthlyRecords: [{ id: 'monthly-root', employeeName: 'Sample', month: '2026-03', achievementRate: 91 }],
  })

  const summary = buildOrgKpiStructureSummary(kpi, { visibleChildCount: 2 })

  assert.equal(summary.label, '정상')
  assert.equal(summary.tone, 'linked')
})

run('org KPI client keeps separate scope tabs and URL-based scope switching', () => {
  const clientSource = read('src/components/kpi/OrgKpiManagementClient.tsx')

  assert.match(clientSource, /pageData\.scopeTabs\.map/)
  assert.match(clientSource, /handleScopeSwitch/)
  assert.match(clientSource, /buildOrgKpiHref/)
  assert.match(clientSource, /selectedScope === 'division'/)
  assert.match(clientSource, /ORG_KPI_SCOPE_LABELS/)
})


