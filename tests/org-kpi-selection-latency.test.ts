import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { OrgKpiViewModel } from '../src/server/org-kpi-page'
import {
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

run('split hierarchy helpers preserve the same structure and selection lineage as the combined builder', () => {
  const root = makeKpi({
    id: 'root',
    title: '본부 목표',
    departmentId: 'dept-root',
    departmentName: '본부',
    childOrgKpiCount: 2,
  })
  const child = makeKpi({
    id: 'child',
    title: '팀 목표',
    departmentId: 'dept-team',
    departmentName: '팀',
    parentOrgKpiId: 'root',
    parentOrgKpiTitle: '본부 목표',
    childOrgKpiCount: 1,
  })
  const grandChild = makeKpi({
    id: 'grand-child',
    title: '세부 목표',
    departmentId: 'dept-team',
    departmentName: '팀',
    parentOrgKpiId: 'child',
    parentOrgKpiTitle: '팀 목표',
  })
  const solo = makeKpi({
    id: 'solo',
    title: '독립 목표',
    departmentId: 'dept-team',
    departmentName: '팀',
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
    combined.roots[0]?.children.map((item) => item.kpi.id)
  )
  assert.deepEqual(structure.disconnected.map((item) => item.id), combined.disconnected.map((item) => item.id))
  assert.deepEqual(Array.from(structure.visibleIds).sort(), Array.from(combined.visibleIds).sort())
  assert.deepEqual(Array.from(selection.ancestorIds).sort(), Array.from(combined.ancestorIds).sort())
  assert.deepEqual(Array.from(selection.descendantIds).sort(), Array.from(combined.descendantIds).sort())
})

run('org KPI client keeps immediate active selection separate from deferred detail selection work', () => {
  const clientSource = read('src/components/kpi/OrgKpiManagementClient.tsx')

  assert.match(clientSource, /import \{ memo, startTransition, useCallback/)
  assert.match(clientSource, /const \[selectedKpiId, setSelectedKpiId\] = useState/)
  assert.match(clientSource, /const \[activeKpiId, setActiveKpiId\] = useState/)
  assert.match(clientSource, /const commitSelectedKpi = useCallback/)
  assert.match(clientSource, /const handleSelectKpi = useCallback/)
  assert.match(clientSource, /setActiveKpiId\(\(current\) => \(current === kpiId \? current : kpiId\)\)/)
  assert.match(clientSource, /startTransition\(\(\) => \{/)
  assert.match(clientSource, /setSelectedKpiId\(\(current\) => \(current === kpiId \? current : kpiId\)\)/)
  assert.match(clientSource, /selectedKpiId=\{activeKpiId \|\| selectedKpi\?\.id \|\| null\}/)
  assert.match(clientSource, /<OrgKpiListItemCard/)
  assert.match(clientSource, /const OrgKpiListItemCard = memo\(function OrgKpiListItemCard/)
})

run('hierarchy interaction changes can stay inside the affected branch instead of touching the whole tree', () => {
  const rootA = makeKpi({
    id: 'root-a',
    title: 'Root A',
    departmentId: 'dept-a',
    departmentName: 'Dept A',
    childOrgKpiCount: 3,
  })
  const branchA = makeKpi({
    id: 'branch-a',
    title: 'Branch A',
    departmentId: 'dept-a',
    departmentName: 'Dept A',
    parentOrgKpiId: 'root-a',
    childOrgKpiCount: 2,
  })
  const leafA1 = makeKpi({
    id: 'leaf-a-1',
    title: 'Leaf A1',
    departmentId: 'dept-a',
    departmentName: 'Dept A',
    parentOrgKpiId: 'branch-a',
  })
  const leafA2 = makeKpi({
    id: 'leaf-a-2',
    title: 'Leaf A2',
    departmentId: 'dept-a',
    departmentName: 'Dept A',
    parentOrgKpiId: 'branch-a',
  })
  const rootB = makeKpi({
    id: 'root-b',
    title: 'Root B',
    departmentId: 'dept-b',
    departmentName: 'Dept B',
    childOrgKpiCount: 2,
  })
  const branchB = makeKpi({
    id: 'branch-b',
    title: 'Branch B',
    departmentId: 'dept-b',
    departmentName: 'Dept B',
    parentOrgKpiId: 'root-b',
    childOrgKpiCount: 1,
  })
  const leafB1 = makeKpi({
    id: 'leaf-b-1',
    title: 'Leaf B1',
    departmentId: 'dept-b',
    departmentName: 'Dept B',
    parentOrgKpiId: 'branch-b',
  })

  const items = [rootA, branchA, leafA1, leafA2, rootB, branchB, leafB1]
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
      expandedIds: new Set(['root-a', 'branch-a', 'root-b']),
    },
    {
      selectedKpiId: 'leaf-a-2',
      ancestorIds: afterSelection.ancestorIds,
      descendantIds: afterSelection.descendantIds,
      expandedIds: new Set(['root-a', 'branch-a', 'root-b']),
    }
  )

  const totalNodes = countOrgKpiHierarchyNodes(structure.roots)
  const affectedNodes = countOrgKpiHierarchyAffectedNodes(structure.roots, changedIds)

  assert.equal(totalNodes, 7)
  assert.equal(affectedNodes, 4)
  assert.ok(affectedNodes < totalNodes)
})

run('org KPI map and detail regions are memoized behind branch-aware props', () => {
  const clientSource = read('src/components/kpi/OrgKpiManagementClient.tsx')

  assert.match(clientSource, /const expandedMapNodeIdSet = useMemo\(\(\) => new Set\(expandedMapNodeIds\), \[expandedMapNodeIds\]\)/)
  assert.match(clientSource, /function areOrgKpiHierarchyNodeCardPropsEqual/)
  assert.match(clientSource, /const OrgKpiHierarchyNodeCard = memo\(function OrgKpiHierarchyNodeCard/)
  assert.match(clientSource, /const OrgKpiDisconnectedCard = memo\(function OrgKpiDisconnectedCard/)
  assert.match(clientSource, /const KpiDetailCard = memo\(function KpiDetailCard/)
  assert.match(clientSource, /onCreateChildGoal=\{handleCreateChildGoal\}/)
  assert.match(clientSource, /onEditParentLink=\{handleEditParentLink\}/)
  assert.match(clientSource, /onViewLinkage=\{handleViewLinkage\}/)
})

console.log('Org KPI selection latency tests completed')
