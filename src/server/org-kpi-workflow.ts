type WorkflowLogLike = {
  action: string
  timestamp: Date | string
  oldValue?: unknown
  newValue?: unknown
}

export type OrgKpiOperationalStatus =
  | 'DRAFT'
  | 'SUBMITTED'
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

export function resolveOrgKpiOperationalStatus(params: {
  status: 'DRAFT' | 'CONFIRMED' | 'ARCHIVED'
  logs?: WorkflowLogLike[]
}) {
  const { status, logs = [] } = params

  if (status === 'ARCHIVED') {
    return 'ARCHIVED' satisfies OrgKpiOperationalStatus
  }

  const submittedAt = Math.max(
    0,
    ...logs
      .filter((log) => log.action === 'ORG_KPI_SUBMITTED')
      .map((log) => toTime(log.timestamp))
  )

  const lockedAt = Math.max(
    0,
    ...logs
      .filter((log) => log.action === 'ORG_KPI_LOCKED')
      .map((log) => toTime(log.timestamp))
  )

  const reopenedAt = Math.max(
    0,
    ...logs
      .filter((log) => {
        if (log.action === 'ORG_KPI_REOPENED') return true
        if (log.action === 'ORG_KPI_STATUS_CHANGED') {
          return statusFromValue(log.newValue) === 'DRAFT'
        }
        return false
      })
      .map((log) => toTime(log.timestamp))
  )

  if (status === 'CONFIRMED') {
    if (lockedAt > reopenedAt) {
      return 'LOCKED' satisfies OrgKpiOperationalStatus
    }
    return 'CONFIRMED' satisfies OrgKpiOperationalStatus
  }

  if (submittedAt > reopenedAt) {
    return 'SUBMITTED' satisfies OrgKpiOperationalStatus
  }

  return 'DRAFT' satisfies OrgKpiOperationalStatus
}

export function canEditOrgKpiByOperationalStatus(status: OrgKpiOperationalStatus) {
  return status === 'DRAFT'
}

export function canSubmitOrgKpi(status: OrgKpiOperationalStatus) {
  return status === 'DRAFT'
}

export function canLockOrgKpi(status: OrgKpiOperationalStatus) {
  return status === 'CONFIRMED'
}

export function canReopenOrgKpi(status: OrgKpiOperationalStatus) {
  return status === 'SUBMITTED' || status === 'LOCKED'
}
