import type { OrgKpiViewModel } from '@/server/org-kpi-page'

export type OrgKpiHierarchyNode = {
  kpi: OrgKpiViewModel
  children: OrgKpiHierarchyNode[]
  depth: number
  isOrphan: boolean
  isDisconnected: boolean
}

export type OrgKpiHierarchyView = {
  roots: OrgKpiHierarchyNode[]
  disconnected: OrgKpiViewModel[]
  ancestorIds: Set<string>
  descendantIds: Set<string>
  visibleIds: Set<string>
}

function matchesSearch(item: OrgKpiViewModel, search: string) {
  const needle = search.trim().toLowerCase()
  if (!needle) return true
  return `${item.title} ${item.departmentName} ${item.category ?? ''} ${item.parentOrgKpiTitle ?? ''}`
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

export function buildOrgKpiHierarchyView(params: {
  items: OrgKpiViewModel[]
  selectedDepartmentId: string
  search: string
  selectedKpiId?: string | null
}): OrgKpiHierarchyView {
  const itemsById = new Map(params.items.map((item) => [item.id, item]))
  const childrenByParentId = new Map<string, OrgKpiViewModel[]>()

  params.items.forEach((item) => {
    if (!item.parentOrgKpiId) return
    const bucket = childrenByParentId.get(item.parentOrgKpiId) ?? []
    bucket.push(item)
    childrenByParentId.set(item.parentOrgKpiId, bucket)
  })

  const matchesDepartment = (item: OrgKpiViewModel) =>
    params.selectedDepartmentId === 'ALL' || item.departmentId === params.selectedDepartmentId

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
      if (!matchesDepartment(child) && params.selectedDepartmentId !== 'ALL') {
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

  const isOrphan = (item: OrgKpiViewModel) => Boolean(item.parentOrgKpiId && !itemsById.has(item.parentOrgKpiId))
  const visibleChildCount = (itemId: string) =>
    (childrenByParentId.get(itemId) ?? []).filter((child) => visibleIds.has(child.id)).length

  const disconnected = visibleItems.filter(
    (item) =>
      isOrphan(item) ||
      (!item.parentOrgKpiId && visibleChildCount(item.id) === 0 && item.childOrgKpiCount === 0)
  )
  const disconnectedIds = new Set(disconnected.map((item) => item.id))

  const buildNode = (item: OrgKpiViewModel, depth: number): OrgKpiHierarchyNode => {
    const children = sortItems(childrenByParentId.get(item.id) ?? [])
      .filter((child) => visibleIds.has(child.id) && !disconnectedIds.has(child.id))
      .map((child) => buildNode(child, depth + 1))

    return {
      kpi: item,
      children,
      depth,
      isOrphan: isOrphan(item),
      isDisconnected:
        disconnectedIds.has(item.id) || (!item.parentOrgKpiId && children.length === 0 && item.childOrgKpiCount === 0),
    }
  }

  const roots = visibleItems
    .filter(
      (item) =>
        !disconnectedIds.has(item.id) &&
        (!item.parentOrgKpiId || !visibleItemById.has(item.parentOrgKpiId))
    )
    .map((item) => buildNode(item, 0))

  const ancestorIds = new Set<string>()
  const descendantIds = new Set<string>()
  if (params.selectedKpiId && itemsById.has(params.selectedKpiId)) {
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
  }

  return {
    roots,
    disconnected,
    ancestorIds,
    descendantIds,
    visibleIds,
  }
}

export function getOrgKpiVisibleChildren(items: OrgKpiViewModel[], parentId: string) {
  return sortItems(items.filter((item) => item.parentOrgKpiId === parentId))
}

export function getOrgKpiConnectionTone(kpi: OrgKpiViewModel) {
  if (kpi.riskFlags.length >= 3) return 'critical'
  if (kpi.riskFlags.length > 0) return 'warning'
  if (kpi.parentOrgKpiId || kpi.childOrgKpiCount > 0) return 'linked'
  return 'neutral'
}
