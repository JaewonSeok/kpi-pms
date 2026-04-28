export type MonthlySubmitOperationalStatus =
  | 'NOT_STARTED'
  | 'DRAFT'
  | 'SUBMITTED'
  | 'REVIEWED'
  | 'LOCKED'

export type MonthlySubmitValidationInput = {
  hasSelection: boolean
  hasSubmitPermission: boolean
  status?: MonthlySubmitOperationalStatus | null
  type?: string | null
  actualValue?: number | string | null
  activityNote?: string | null
  blockerNote?: string | null
  effortNote?: string | null
  evidenceComment?: string | null
  attachmentsCount?: number
  linkedCheckinCount?: number
  achievementRate?: number | null
}

export type MonthlySubmitValidationResult = {
  canSubmit: boolean
  blockingReasons: string[]
  recommendationReasons: string[]
  summary?: string
}

function hasText(value?: string | null) {
  return typeof value === 'string' && value.trim().length > 0
}

function hasQuantitativeActualValue(value: MonthlySubmitValidationInput['actualValue']) {
  if (typeof value === 'number') {
    return Number.isFinite(value)
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return false
    return Number.isFinite(Number(trimmed))
  }
  return false
}

function hasQualitativeContent(input: MonthlySubmitValidationInput) {
  return (
    hasText(input.activityNote) ||
    hasText(input.blockerNote) ||
    hasText(input.effortNote) ||
    hasText(input.evidenceComment) ||
    (input.attachmentsCount ?? 0) > 0 ||
    (input.linkedCheckinCount ?? 0) > 0
  )
}

function getStatusBlockingReason(status?: MonthlySubmitOperationalStatus | null) {
  switch (status) {
    case 'SUBMITTED':
      return '이미 제출된 월간 실적입니다.'
    case 'REVIEWED':
      return '리뷰가 완료된 월간 실적은 다시 제출할 수 없습니다.'
    case 'LOCKED':
      return '잠금 상태의 월간 실적은 제출할 수 없습니다.'
    case 'NOT_STARTED':
    case 'DRAFT':
    case undefined:
    case null:
      return undefined
    default:
      return '현재 상태에서는 제출할 수 없습니다.'
  }
}

export function evaluateMonthlySubmit(input: MonthlySubmitValidationInput): MonthlySubmitValidationResult {
  const blockingReasons: string[] = []
  const recommendationReasons: string[] = []

  if (!input.hasSelection) {
    blockingReasons.push('제출할 KPI를 먼저 선택해 주세요.')
  }

  if (!input.hasSubmitPermission) {
    const statusReason = getStatusBlockingReason(input.status)
    blockingReasons.push(statusReason ?? '월간 실적을 제출할 권한이 없습니다.')
  } else {
    const statusReason = getStatusBlockingReason(input.status)
    if (statusReason) {
      blockingReasons.push(statusReason)
    }
  }

  if (!blockingReasons.length) {
    if (input.type === 'QUANTITATIVE') {
      if (!hasQuantitativeActualValue(input.actualValue)) {
        blockingReasons.push('정량 KPI의 실적값을 입력해 주세요.')
      }
    } else if (!hasQualitativeContent(input)) {
      blockingReasons.push('정성 KPI의 활동 내용이나 코멘트를 먼저 입력해 주세요.')
    }
  }

  if ((input.attachmentsCount ?? 0) === 0) {
    recommendationReasons.push('증빙은 필수는 아니지만 근거 정리를 위해 첨부를 권장합니다.')
  }

  if ((input.achievementRate ?? 100) < 80 && !hasText(input.blockerNote)) {
    recommendationReasons.push('위험 신호 KPI는 장애 요인 코멘트를 남기면 리뷰에 도움이 됩니다.')
  }

  return {
    canSubmit: blockingReasons.length === 0,
    blockingReasons,
    recommendationReasons,
    summary: blockingReasons.length
      ? blockingReasons.length === 1
        ? `제출할 수 없습니다. ${blockingReasons[0]}`
        : `제출할 수 없습니다. 다음 항목을 먼저 완료해 주세요: ${blockingReasons.join(', ')}`
      : undefined,
  }
}
