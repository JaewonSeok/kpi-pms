type WorkflowLogLike = {
  action: string
  timestamp: Date | string
  oldValue?: unknown
  newValue?: unknown
}

export type PersonalKpiOperationalStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'MANAGER_REVIEW'
  | 'CONFIRMED'
  | 'LOCKED'
  | 'ARCHIVED'

function toTime(value: Date | string | undefined) {
  if (!value) return 0
  return new Date(value).getTime()
}

function statusFromValue(record: unknown) {
  if (!record || typeof record !== 'object') return null
  const value = (record as Record<string, unknown>).status
  return typeof value === 'string' ? value : null
}

export function resolvePersonalKpiOperationalStatus(params: {
  status: 'DRAFT' | 'CONFIRMED' | 'ARCHIVED'
  logs?: WorkflowLogLike[]
}) {
  const { status, logs = [] } = params

  if (status === 'ARCHIVED') {
    return 'ARCHIVED' satisfies PersonalKpiOperationalStatus
  }

  const submittedAt = Math.max(
    0,
    ...logs
      .filter((log) => log.action === 'PERSONAL_KPI_SUBMITTED')
      .map((log) => toTime(log.timestamp))
  )

  const reviewStartedAt = Math.max(
    0,
    ...logs
      .filter((log) => log.action === 'PERSONAL_KPI_REVIEW_STARTED')
      .map((log) => toTime(log.timestamp))
  )

  const lockedAt = Math.max(
    0,
    ...logs
      .filter((log) => log.action === 'PERSONAL_KPI_LOCKED')
      .map((log) => toTime(log.timestamp))
  )

  const reopenedAt = Math.max(
    0,
    ...logs
      .filter((log) => {
        if (log.action === 'PERSONAL_KPI_REOPENED') return true
        if (log.action === 'PERSONAL_KPI_STATUS_CHANGED') {
          return statusFromValue(log.newValue) === 'DRAFT'
        }
        return false
      })
      .map((log) => toTime(log.timestamp))
  )

  const rejectedAt = Math.max(
    0,
    ...logs
      .filter((log) => log.action === 'PERSONAL_KPI_REJECTED')
      .map((log) => toTime(log.timestamp))
  )

  if (status === 'CONFIRMED') {
    if (lockedAt > reopenedAt) {
      return 'LOCKED' satisfies PersonalKpiOperationalStatus
    }

    return 'CONFIRMED' satisfies PersonalKpiOperationalStatus
  }

  if (reviewStartedAt > Math.max(reopenedAt, rejectedAt) && reviewStartedAt >= submittedAt) {
    return 'MANAGER_REVIEW' satisfies PersonalKpiOperationalStatus
  }

  if (submittedAt > Math.max(reopenedAt, rejectedAt)) {
    return 'SUBMITTED' satisfies PersonalKpiOperationalStatus
  }

  return 'DRAFT' satisfies PersonalKpiOperationalStatus
}

export function hasRejectedRevisionPending(logs: WorkflowLogLike[] = []) {
  const rejectedAt = Math.max(
    0,
    ...logs
      .filter((log) => log.action === 'PERSONAL_KPI_REJECTED')
      .map((log) => toTime(log.timestamp))
  )

  const resubmittedAt = Math.max(
    0,
    ...logs
      .filter((log) =>
        ['PERSONAL_KPI_SUBMITTED', 'PERSONAL_KPI_APPROVED', 'PERSONAL_KPI_REOPENED'].includes(log.action)
      )
      .map((log) => toTime(log.timestamp))
  )

  return rejectedAt > 0 && rejectedAt > resubmittedAt
}

export function canEditPersonalKpiByOperationalStatus(status: PersonalKpiOperationalStatus) {
  return status === 'DRAFT'
}

export function canSubmitPersonalKpi(status: PersonalKpiOperationalStatus) {
  return status === 'DRAFT'
}

export function canStartPersonalKpiReview(status: PersonalKpiOperationalStatus) {
  return status === 'SUBMITTED'
}

export function canApprovePersonalKpi(status: PersonalKpiOperationalStatus) {
  return status === 'SUBMITTED' || status === 'MANAGER_REVIEW'
}

export function canRejectPersonalKpi(status: PersonalKpiOperationalStatus) {
  return status === 'SUBMITTED' || status === 'MANAGER_REVIEW'
}

export function canLockPersonalKpi(status: PersonalKpiOperationalStatus) {
  return status === 'CONFIRMED'
}

export function canReopenPersonalKpi(status: PersonalKpiOperationalStatus) {
  return status === 'SUBMITTED' || status === 'MANAGER_REVIEW' || status === 'LOCKED' || status === 'CONFIRMED'
}
