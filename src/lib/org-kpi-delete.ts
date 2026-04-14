export type OrgKpiDeleteStatus = 'DRAFT' | 'SUBMITTED' | 'CONFIRMED' | 'LOCKED' | 'ARCHIVED'

export type OrgKpiDeleteConstraint =
  | 'TARGET_REQUIRED'
  | 'FORBIDDEN'
  | 'GOAL_EDIT_LOCKED'
  | 'BUSY'
  | 'STATUS_BLOCKED'
  | 'LINKED_PERSONAL_KPI_BLOCKED'

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
  const { kpi, canManage, goalEditLocked, busy = false } = params

  if (!kpi) {
    return {
      disabled: true,
      code: 'TARGET_REQUIRED',
      reason: '삭제할 조직 KPI를 먼저 선택해 주세요.',
    }
  }

  if (!canManage) {
    return {
      disabled: true,
      code: 'FORBIDDEN',
      reason: '현재 권한으로는 조직 KPI를 삭제할 수 없습니다.',
    }
  }

  if (goalEditLocked) {
    return {
      disabled: true,
      code: 'GOAL_EDIT_LOCKED',
      reason: '현재 주기는 목표 읽기 전용 모드입니다. 조직 KPI를 삭제할 수 없습니다.',
    }
  }

  if (busy) {
    return {
      disabled: true,
      code: 'BUSY',
      reason: '다른 작업을 처리하는 중입니다.',
    }
  }

  if (kpi.status !== 'DRAFT') {
    return {
      disabled: true,
      code: 'STATUS_BLOCKED',
      reason: '초안 상태의 조직 KPI만 삭제할 수 있습니다.',
    }
  }

  if (kpi.linkedPersonalKpiCount > 0) {
    return {
      disabled: true,
      code: 'LINKED_PERSONAL_KPI_BLOCKED',
      reason: '개인 KPI와 연결된 조직 KPI는 삭제할 수 없습니다.',
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
