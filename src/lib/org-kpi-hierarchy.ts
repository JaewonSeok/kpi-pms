import type { OrgKpiViewModel } from '@/server/org-kpi-page'

// 직속 자식 중 현재 selectedDepartmentIds/search 필터로 visibleIds에서 빠진 KPI의 요약.
// 옵션 C6 — 빈 상태에서 사용자가 직접 그 KPI로 이동할 수 있도록 빌더에서 가산적으로 노출.
// 기존 visibleIds·children 계산엔 영향 없음.
export type OrgKpiHiddenChildSummary = {
  id: string
  title: string
  departmentId: string
  departmentName: string
  scope: OrgKpiViewModel['scope']
  status: OrgKpiViewModel['status']
}

export type OrgKpiHierarchyNode = {
  kpi: OrgKpiViewModel
  children: OrgKpiHierarchyNode[]
  subtreeIds: Set<string>
  depth: number
  isOrphan: boolean
  isDisconnected: boolean
  // 가산적 옵셔널 — 필터로 가려진 직속 자식 정보. 외부 호출부 시그니처 영향 0.
  hiddenChildren?: OrgKpiHiddenChildSummary[]
}

export type OrgKpiHierarchyView = {
  roots: OrgKpiHierarchyNode[]
  disconnected: OrgKpiViewModel[]
  ancestorIds: Set<string>
  descendantIds: Set<string>
  visibleIds: Set<string>
}

export type OrgKpiHierarchyStructureView = {
  roots: OrgKpiHierarchyNode[]
  disconnected: OrgKpiViewModel[]
  visibleIds: Set<string>
}

export type OrgKpiHierarchySelectionView = {
  ancestorIds: Set<string>
  descendantIds: Set<string>
}

export type OrgKpiHierarchyInteractionState = {
  selectedKpiId: string | null
  ancestorIds: ReadonlySet<string>
  descendantIds: ReadonlySet<string>
  expandedIds: ReadonlySet<string>
}

export type OrgKpiStructureSummary = {
  tone: 'neutral' | 'linked'
  helper: string
}

function matchesSearch(item: OrgKpiViewModel, search: string) {
  const needle = search.trim().toLowerCase()
  if (!needle) return true
  return `${item.title} ${item.departmentName} ${item.category ?? ''} ${item.parentOrgKpiTitle ?? ''} ${item.parentReference?.title ?? ''} ${item.parentReference?.departmentName ?? ''}`
    .toLowerCase()
    .includes(needle)
}

function sortItems(items: OrgKpiViewModel[]) {
  return [...items].sort(
    (left, right) =>
      left.departmentName.localeCompare(right.departmentName, 'ko') ||
      left.title.localeCompare(right.title, 'ko')
  )
}

export function buildOrgKpiHierarchyStructure(params: {
  items: OrgKpiViewModel[]
  selectedDepartmentIds?: string[]
  selectedDepartmentId?: string
  search: string
  // P1-E 가산 옵셔널 — 현재 list(items) 밖의 자식 OrgKpi(scope ≠ selectedScope).
  // childrenByParentId 구축에만 합쳐 부모 bucket에 들어가게 한다.
  // ★ visibleIds 산정에는 사용하지 않음(focusItems/itemsById/visibleItems 모두 items만).
  // 결과: 자식은 childrenByParentId에 있으나 visibleIds 밖 → buildNode가 hiddenChildren에 자동 수집.
  // 옵션 미전달 시 기존 동작과 100% 동일(옵셔널).
  extraItems?: OrgKpiViewModel[]
}): OrgKpiHierarchyStructureView {
  const itemsById = new Map(params.items.map((item) => [item.id, item]))
  const childrenByParentId = new Map<string, OrgKpiViewModel[]>()

  // items + extraItems를 합쳐 childrenByParentId 구축. items만 부모 후보(itemsById에 있는 부모).
  // extraItems의 자식들도 부모 id로 그룹핑되어 buildNode가 hiddenChildren 수집 시 사용.
  const childrenSourceItems: OrgKpiViewModel[] = params.extraItems
    ? [...params.items, ...params.extraItems]
    : params.items
  childrenSourceItems.forEach((item) => {
    if (!item.parentOrgKpiId) return
    const bucket = childrenByParentId.get(item.parentOrgKpiId) ?? []
    bucket.push(item)
    childrenByParentId.set(item.parentOrgKpiId, bucket)
  })

  const selectedDepartmentIdSet = new Set(
    params.selectedDepartmentIds ?? (params.selectedDepartmentId ? [params.selectedDepartmentId] : [])
  )
  const allowAllDepartments = selectedDepartmentIdSet.size === 0
  const matchesDepartment = (item: OrgKpiViewModel) =>
    allowAllDepartments || selectedDepartmentIdSet.has(item.departmentId)

  const focusItems = params.items.filter((item) => matchesDepartment(item) && matchesSearch(item, params.search))
  const visibleIds = new Set<string>()

  const addAncestors = (item: OrgKpiViewModel) => {
    let currentParentId = item.parentOrgKpiId
    const visited = new Set<string>()
    while (currentParentId && !visited.has(currentParentId)) {
      visited.add(currentParentId)
      visibleIds.add(currentParentId)
      currentParentId = itemsById.get(currentParentId)?.parentOrgKpiId ?? null
    }
  }

  const addDescendants = (itemId: string) => {
    const children = sortItems(childrenByParentId.get(itemId) ?? [])
    children.forEach((child) => {
      if (!matchesDepartment(child) && !allowAllDepartments) {
        return
      }
      visibleIds.add(child.id)
      addDescendants(child.id)
    })
  }

  focusItems.forEach((item) => {
    visibleIds.add(item.id)
    addAncestors(item)
    addDescendants(item.id)
  })

  const visibleItems = sortItems(params.items.filter((item) => visibleIds.has(item.id)))
  const visibleItemById = new Map(visibleItems.map((item) => [item.id, item]))

  const isOrphan = (item: OrgKpiViewModel) =>
    Boolean(item.parentOrgKpiId && !item.parentReference && !itemsById.has(item.parentOrgKpiId))
  const visibleChildCount = (itemId: string) =>
    (childrenByParentId.get(itemId) ?? []).filter((child) => visibleIds.has(child.id)).length

  const disconnected = visibleItems.filter(
    (item) =>
      isOrphan(item) ||
      (!item.parentOrgKpiId && visibleChildCount(item.id) === 0 && item.childOrgKpiCount === 0)
  )
  const disconnectedIds = new Set(disconnected.map((item) => item.id))

  const buildNode = (item: OrgKpiViewModel, depth: number): OrgKpiHierarchyNode => {
    const rawDirectChildren = sortItems(childrenByParentId.get(item.id) ?? [])
    const children = rawDirectChildren
      .filter((child) => visibleIds.has(child.id) && !disconnectedIds.has(child.id))
      .map((child) => buildNode(child, depth + 1))
    // 가산 — 직속 자식 중 visibleIds에서 빠진(필터로 가려진) 자식 요약.
    const hiddenChildrenSummaries: OrgKpiHiddenChildSummary[] = rawDirectChildren
      .filter((child) => !visibleIds.has(child.id))
      .map((child) => ({
        id: child.id,
        title: child.title,
        departmentId: child.departmentId,
        departmentName: child.departmentName,
        scope: child.scope,
        status: child.status,
      }))
    const subtreeIds = new Set<string>([item.id])
    children.forEach((child) => {
      child.subtreeIds.forEach((subtreeId) => {
        subtreeIds.add(subtreeId)
      })
    })

    return {
      kpi: item,
      children,
      subtreeIds,
      depth,
      isOrphan: isOrphan(item),
      isDisconnected:
        disconnectedIds.has(item.id) || (!item.parentOrgKpiId && children.length === 0 && item.childOrgKpiCount === 0),
      hiddenChildren: hiddenChildrenSummaries.length > 0 ? hiddenChildrenSummaries : undefined,
    }
  }

  const roots = visibleItems
    .filter(
      (item) =>
        !disconnectedIds.has(item.id) &&
        (!item.parentOrgKpiId || !visibleItemById.has(item.parentOrgKpiId))
    )
    .map((item) => buildNode(item, 0))

  return {
    roots,
    disconnected,
    visibleIds,
  }
}

export function buildOrgKpiHierarchySelectionView(params: {
  items: OrgKpiViewModel[]
  selectedKpiId?: string | null
}): OrgKpiHierarchySelectionView {
  const ancestorIds = new Set<string>()
  const descendantIds = new Set<string>()

  if (!params.selectedKpiId) {
    return {
      ancestorIds,
      descendantIds,
    }
  }

  const itemsById = new Map(params.items.map((item) => [item.id, item]))
  const childrenByParentId = new Map<string, OrgKpiViewModel[]>()

  params.items.forEach((item) => {
    if (!item.parentOrgKpiId) return
    const bucket = childrenByParentId.get(item.parentOrgKpiId) ?? []
    bucket.push(item)
    childrenByParentId.set(item.parentOrgKpiId, bucket)
  })

  if (!itemsById.has(params.selectedKpiId)) {
    return {
      ancestorIds,
      descendantIds,
    }
  }

  let currentParentId = itemsById.get(params.selectedKpiId)?.parentOrgKpiId ?? null
  const visited = new Set<string>()
  while (currentParentId && !visited.has(currentParentId)) {
    visited.add(currentParentId)
    ancestorIds.add(currentParentId)
    currentParentId = itemsById.get(currentParentId)?.parentOrgKpiId ?? null
  }

  const walkChildren = (parentId: string) => {
    ;(childrenByParentId.get(parentId) ?? []).forEach((child) => {
      descendantIds.add(child.id)
      walkChildren(child.id)
    })
  }

  walkChildren(params.selectedKpiId)

  return {
    ancestorIds,
    descendantIds,
  }
}

export function buildOrgKpiHierarchyView(params: {
  items: OrgKpiViewModel[]
  selectedDepartmentIds?: string[]
  selectedDepartmentId?: string
  search: string
  selectedKpiId?: string | null
}): OrgKpiHierarchyView {
  return {
    ...buildOrgKpiHierarchyStructure({
      items: params.items,
      selectedDepartmentIds: params.selectedDepartmentIds,
      selectedDepartmentId: params.selectedDepartmentId,
      search: params.search,
    }),
    ...buildOrgKpiHierarchySelectionView({
      items: params.items,
      selectedKpiId: params.selectedKpiId,
    }),
  }
}

function addSymmetricDifference(
  target: Set<string>,
  before: ReadonlySet<string>,
  after: ReadonlySet<string>
) {
  before.forEach((value) => {
    if (!after.has(value)) {
      target.add(value)
    }
  })
  after.forEach((value) => {
    if (!before.has(value)) {
      target.add(value)
    }
  })
}

export function getOrgKpiHierarchyInteractionChangedIds(
  before: OrgKpiHierarchyInteractionState,
  after: OrgKpiHierarchyInteractionState
) {
  const changedIds = new Set<string>()

  if (before.selectedKpiId && before.selectedKpiId !== after.selectedKpiId) {
    changedIds.add(before.selectedKpiId)
  }
  if (after.selectedKpiId && before.selectedKpiId !== after.selectedKpiId) {
    changedIds.add(after.selectedKpiId)
  }

  addSymmetricDifference(changedIds, before.ancestorIds, after.ancestorIds)
  addSymmetricDifference(changedIds, before.descendantIds, after.descendantIds)
  addSymmetricDifference(changedIds, before.expandedIds, after.expandedIds)

  return changedIds
}

export function isOrgKpiHierarchyNodeAffected(node: OrgKpiHierarchyNode, changedIds: ReadonlySet<string>) {
  for (const changedId of changedIds) {
    if (node.subtreeIds.has(changedId)) {
      return true
    }
  }

  return false
}

export function countOrgKpiHierarchyNodes(nodes: OrgKpiHierarchyNode[]): number {
  return nodes.reduce((total, node) => total + 1 + countOrgKpiHierarchyNodes(node.children), 0)
}

export function countOrgKpiHierarchyAffectedNodes(
  nodes: OrgKpiHierarchyNode[],
  changedIds: ReadonlySet<string>
): number {
  return nodes.reduce(
    (total, node) =>
      total + (isOrgKpiHierarchyNodeAffected(node, changedIds) ? 1 : 0) + countOrgKpiHierarchyAffectedNodes(node.children, changedIds),
    0
  )
}

export function getOrgKpiVisibleChildren(items: OrgKpiViewModel[], parentId: string) {
  return sortItems(items.filter((item) => item.parentOrgKpiId === parentId))
}

export function isOrgKpiTopLevelDivisionGoal(
  kpi: Pick<OrgKpiViewModel, 'scope' | 'parentOrgKpiId' | 'parentOrgKpiTitle' | 'parentReference'>
) {
  return (
    kpi.scope === 'division' &&
    !kpi.parentOrgKpiId &&
    !kpi.parentOrgKpiTitle &&
    !kpi.parentReference
  )
}

export function buildOrgKpiStructureSummary(
  kpi: OrgKpiViewModel,
  options: {
    isDisconnected?: boolean
    isOrphan?: boolean
    visibleChildCount?: number
  } = {}
): OrgKpiStructureSummary {
  const childCount = Math.max(options.visibleChildCount ?? 0, kpi.childOrgKpiCount)
  const hasParent = Boolean(kpi.parentOrgKpiId || kpi.parentOrgKpiTitle || kpi.parentReference)
  const hasChildren = childCount > 0
  const isValidRootGoal = !hasParent && hasChildren
  const hasStructuralGap =
    Boolean(options.isDisconnected || options.isOrphan) ||
    (!hasParent && !isValidRootGoal && !hasChildren)
  if (hasStructuralGap) {
    return {
      tone: 'neutral',
      helper: hasChildren
        ? '상위 목표 없이도 하위 목표가 연결된 구조입니다.'
        : '상위 목표 없이 단독으로 표시되는 KPI입니다.',
    }
  }

  return {
    tone: 'linked',
    helper: hasChildren
      ? '이 목표 아래 연결된 하위 목표를 확인할 수 있습니다.'
      : '상위·하위 구조가 안정적으로 연결되어 있습니다.',
  }
}
