export type OrgKpiDeleteStatus = 'DRAFT' | 'SUBMITTED' | 'CONFIRMED' | 'LOCKED' | 'ARCHIVED'

export type OrgKpiDeleteConstraint = 'TARGET_REQUIRED'

export type OrgKpiDeleteCandidate = {
  id: string
  title?: string | null
  status: OrgKpiDeleteStatus
  linkedPersonalKpiCount: number
}

export type OrgKpiDeleteActionState = {
  disabled: boolean
  code?: OrgKpiDeleteConstraint
  reason?: string
}

export function getOrgKpiDeleteActionState(params: {
  kpi: OrgKpiDeleteCandidate | null
  canManage: boolean
  goalEditLocked: boolean
  busy?: boolean
}): OrgKpiDeleteActionState {
  const { kpi } = params

  if (!kpi) {
    return {
      disabled: true,
      code: 'TARGET_REQUIRED',
      reason: '삭제할 조직 KPI를 먼저 선택해 주세요.',
    }
  }

  return { disabled: false }
}

export function resolveNextOrgKpiSelectionAfterDelete(params: {
  currentItems: Array<{ id: string }>
  deletedId: string
}) {
  const currentIndex = params.currentItems.findIndex((item) => item.id === params.deletedId)
  const remainingItems = params.currentItems.filter((item) => item.id !== params.deletedId)

  if (!remainingItems.length) {
    return ''
  }

  if (currentIndex <= 0) {
    return remainingItems[0]?.id ?? ''
  }

  return remainingItems[Math.min(currentIndex, remainingItems.length - 1)]?.id ?? ''
}
