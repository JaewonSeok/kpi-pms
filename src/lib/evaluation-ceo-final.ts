export type CeoFinalDepartmentNode = {
  id: string
  deptName: string
  parentDeptId: string | null
}

export type CeoFinalDivisionScope = {
  divisionId: string
  divisionName: string
}

function normalizeGradeId(value?: string | null) {
  const trimmed = value?.trim()
  return trimmed && trimmed.length ? trimmed : null
}

export function isCeoFinalGradeAdjusted(params: {
  originalDivisionHeadGradeId?: string | null
  finalCeoGradeId?: string | null
}) {
  const originalGradeId = normalizeGradeId(params.originalDivisionHeadGradeId)
  const finalGradeId = normalizeGradeId(params.finalCeoGradeId)

  if (!originalGradeId || !finalGradeId) return false
  return originalGradeId !== finalGradeId
}

export function requiresCeoFinalAdjustmentReason(params: {
  originalDivisionHeadGradeId?: string | null
  finalCeoGradeId?: string | null
  adjustmentReason?: string | null
}) {
  if (
    !isCeoFinalGradeAdjusted({
      originalDivisionHeadGradeId: params.originalDivisionHeadGradeId,
      finalCeoGradeId: params.finalCeoGradeId,
    })
  ) {
    return false
  }

  return !(params.adjustmentReason?.trim().length)
}

export function normalizeCeoAdjustmentReason(reason?: string | null) {
  const trimmed = reason?.trim()
  return trimmed && trimmed.length ? trimmed : null
}

export function buildCeoFinalDivisionScopeMap(departments: CeoFinalDepartmentNode[]) {
  const byId = new Map(departments.map((department) => [department.id, department]))
  const cache = new Map<string, CeoFinalDivisionScope>()

  const resolveScope = (departmentId: string): CeoFinalDivisionScope => {
    const cached = cache.get(departmentId)
    if (cached) return cached

    const chain: CeoFinalDepartmentNode[] = []
    const visited = new Set<string>()
    let current = byId.get(departmentId) ?? null

    while (current && !visited.has(current.id)) {
      visited.add(current.id)
      chain.push(current)
      current = current.parentDeptId ? byId.get(current.parentDeptId) ?? null : null
    }

    const scopeDepartment =
      chain.length <= 2
        ? chain[0] ?? byId.get(departmentId) ?? null
        : chain[chain.length - 2] ?? chain[chain.length - 1] ?? chain[0]

    const fallbackDepartment = byId.get(departmentId)
    const resolved = {
      divisionId: scopeDepartment?.id ?? fallbackDepartment?.id ?? departmentId,
      divisionName: scopeDepartment?.deptName ?? fallbackDepartment?.deptName ?? '미분류 조직',
    }

    cache.set(departmentId, resolved)
    return resolved
  }

  for (const department of departments) {
    resolveScope(department.id)
  }

  return cache
}
