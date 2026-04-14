export type PersonalKpiDeleteStatus = 'DRAFT' | 'SUBMITTED' | 'MANAGER_REVIEW' | 'CONFIRMED' | 'LOCKED' | 'ARCHIVED'

export type PersonalKpiDeleteConstraint =
  | 'TARGET_REQUIRED'
  | 'FORBIDDEN'
  | 'GOAL_EDIT_LOCKED'
  | 'BUSY'
  | 'STATUS_BLOCKED'
  | 'MONTHLY_RECORD_BLOCKED'
  | 'EVALUATION_BLOCKED'

export type PersonalKpiDeleteCandidate = {
  id: string
  title?: string | null
  status: PersonalKpiDeleteStatus
  linkedMonthlyCount: number
  linkedEvaluationItemCount?: number
}

export type PersonalKpiDeleteActionState = {
  disabled: boolean
  code?: PersonalKpiDeleteConstraint
  reason?: string
}

export function getPersonalKpiDeleteActionState(params: {
  kpi: PersonalKpiDeleteCandidate | null
  canManage: boolean
  goalEditLocked: boolean
  busy?: boolean
}): PersonalKpiDeleteActionState {
  const { kpi, canManage, goalEditLocked, busy = false } = params

  if (!kpi) {
    return {
      disabled: true,
      code: 'TARGET_REQUIRED',
      reason: '삭제할 개인 KPI를 먼저 선택해 주세요.',
    }
  }

  if (!canManage) {
    return {
      disabled: true,
      code: 'FORBIDDEN',
      reason: '현재 권한으로는 개인 KPI를 삭제할 수 없습니다.',
    }
  }

  if (goalEditLocked) {
    return {
      disabled: true,
      code: 'GOAL_EDIT_LOCKED',
      reason: '현재 주기는 체크인 전용 모드라 개인 KPI를 삭제할 수 없습니다.',
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
      reason: '초안 상태의 개인 KPI만 삭제할 수 있습니다.',
    }
  }

  if (kpi.linkedMonthlyCount > 0) {
    return {
      disabled: true,
      code: 'MONTHLY_RECORD_BLOCKED',
      reason: '월간 실적이 연결된 개인 KPI는 삭제할 수 없습니다.',
    }
  }

  if ((kpi.linkedEvaluationItemCount ?? 0) > 0) {
    return {
      disabled: true,
      code: 'EVALUATION_BLOCKED',
      reason: '평가 항목에 반영된 개인 KPI는 삭제할 수 없습니다.',
    }
  }

  return { disabled: false }
}

export function resolveNextPersonalKpiSelectionAfterDelete(params: {
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
