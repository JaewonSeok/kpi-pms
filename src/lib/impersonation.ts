export const IMPERSONATION_DEFAULT_TTL_MINUTES = 60
export const IMPERSONATION_RISK_REASON_MIN_LENGTH = 10
export const IMPERSONATION_SYNC_STORAGE_KEY = 'kpi-pms:impersonation-sync'
export const IMPERSONATION_RISK_CANCELLED = '__IMPERSONATION_RISK_CANCELLED__'

export const IMPERSONATION_HEADERS = {
  sessionId: 'x-impersonation-session-id',
  actionName: 'x-impersonation-risk-action',
  riskReason: 'x-impersonation-risk-reason',
  confirmationText: 'x-impersonation-confirm-text',
} as const

export type ImpersonationRiskActionName =
  | 'DELETE_RECORD'
  | 'DOWNLOAD_EXPORT'
  | 'FINAL_SUBMIT'
  | 'APPROVE_RECORD'
  | 'REJECT_RECORD'
  | 'LOCK_RECORD'
  | 'REOPEN_RECORD'
  | 'SHARE_RESULT'
  | 'PUBLISH_RESULT'
  | 'UPLOAD_APPLY'
  | 'TRANSFER_REVIEWER'
  | 'CHANGE_DUE_DATE'

export type ImpersonationSessionState = {
  active: true
  sessionId: string
  actorId: string
  actorName: string
  actorEmail: string
  targetId: string
  targetName: string
  targetEmail: string
  reason: string
  startedAt: string
  expiresAt: string
}

export type ImpersonationRiskConfirmationPayload = {
  riskReason: string
  confirmationText?: string
}

export function buildImpersonationExpiry(startedAt = new Date()) {
  return new Date(startedAt.getTime() + IMPERSONATION_DEFAULT_TTL_MINUTES * 60_000)
}

export function isImpersonationExpired(
  state: Pick<ImpersonationSessionState, 'active' | 'expiresAt'> | null | undefined,
  now = new Date()
) {
  if (!state?.active) {
    return false
  }

  const expiresAt = new Date(state.expiresAt)
  if (Number.isNaN(expiresAt.getTime())) {
    return true
  }

  return expiresAt.getTime() <= now.getTime()
}

export function buildImpersonationRiskHeaders(
  masterLogin: ImpersonationSessionState,
  actionName: ImpersonationRiskActionName,
  confirmation: ImpersonationRiskConfirmationPayload
) {
  return {
    [IMPERSONATION_HEADERS.sessionId]: masterLogin.sessionId,
    [IMPERSONATION_HEADERS.actionName]: actionName,
    [IMPERSONATION_HEADERS.riskReason]: confirmation.riskReason,
    ...(confirmation.confirmationText
      ? { [IMPERSONATION_HEADERS.confirmationText]: confirmation.confirmationText }
      : {}),
  }
}

export function createImpersonationRiskCancelledError() {
  return new Error(IMPERSONATION_RISK_CANCELLED)
}

export function isImpersonationRiskCancelledError(error: unknown) {
  return error instanceof Error && error.message === IMPERSONATION_RISK_CANCELLED
}

export function createImpersonationSyncPayload(
  type: 'start' | 'stop' | 'expire',
  sessionId?: string
) {
  return JSON.stringify({
    type,
    sessionId: sessionId ?? null,
    at: new Date().toISOString(),
  })
}

export function parseImpersonationSyncPayload(value: string | null) {
  if (!value) {
    return null
  }

  try {
    const parsed = JSON.parse(value) as {
      type?: 'start' | 'stop' | 'expire'
      sessionId?: string | null
      at?: string
    }
    if (!parsed.type) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}
