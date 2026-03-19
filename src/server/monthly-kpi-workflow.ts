type WorkflowLogLike = {
  action: string
  timestamp: Date | string
}

export type MonthlyRecordOperationalStatus =
  | 'NOT_STARTED'
  | 'DRAFT'
  | 'SUBMITTED'
  | 'REVIEWED'
  | 'LOCKED'

function toTime(value: Date | string | undefined) {
  if (!value) return 0
  return new Date(value).getTime()
}

function latestActionTime(logs: WorkflowLogLike[], action: string) {
  return Math.max(
    0,
    ...logs.filter((log) => log.action === action).map((log) => toTime(log.timestamp))
  )
}

export function resolveMonthlyOperationalStatus(params: {
  hasRecord: boolean
  isDraft?: boolean
  submittedAt?: Date | string | null
  logs?: WorkflowLogLike[]
}) {
  const logs = params.logs ?? []

  if (!params.hasRecord) {
    return 'NOT_STARTED' satisfies MonthlyRecordOperationalStatus
  }

  const lockedAt = latestActionTime(logs, 'MONTHLY_RECORD_LOCKED')
  const unlockedAt = latestActionTime(logs, 'MONTHLY_RECORD_UNLOCKED')
  const reviewedAt = Math.max(
    latestActionTime(logs, 'MONTHLY_RECORD_REVIEWED'),
    latestActionTime(logs, 'MONTHLY_RECORD_REVIEW_REQUESTED')
  )

  if (lockedAt > unlockedAt) {
    return 'LOCKED' satisfies MonthlyRecordOperationalStatus
  }

  if (reviewedAt > 0) {
    return 'REVIEWED' satisfies MonthlyRecordOperationalStatus
  }

  if (!params.isDraft || params.submittedAt) {
    return 'SUBMITTED' satisfies MonthlyRecordOperationalStatus
  }

  return 'DRAFT' satisfies MonthlyRecordOperationalStatus
}

export function canEditMonthlyRecord(status: MonthlyRecordOperationalStatus) {
  return status === 'NOT_STARTED' || status === 'DRAFT'
}

export function canSubmitMonthlyRecord(status: MonthlyRecordOperationalStatus) {
  return status === 'NOT_STARTED' || status === 'DRAFT'
}

export function canReviewMonthlyRecord(status: MonthlyRecordOperationalStatus) {
  return status === 'SUBMITTED' || status === 'REVIEWED'
}

export function canLockMonthlyRecord(status: MonthlyRecordOperationalStatus) {
  return status === 'REVIEWED'
}

export function canUnlockMonthlyRecord(status: MonthlyRecordOperationalStatus) {
  return status === 'LOCKED'
}
