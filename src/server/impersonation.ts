import type { Prisma } from '@prisma/client'
import type { Session } from 'next-auth'
import { createAuditLog, getClientInfo } from '@/lib/audit'
import {
  buildImpersonationExpiry,
  IMPERSONATION_HEADERS,
  IMPERSONATION_RISK_REASON_MIN_LENGTH,
  isImpersonationExpired,
  type ImpersonationRiskActionName,
  type ImpersonationSessionState,
} from '@/lib/impersonation'
import { prisma } from '@/lib/prisma'
import type { AuthSession } from '@/types/auth'
import { AppError } from '@/lib/utils'

type CreateImpersonationSessionInput = {
  impersonatorAdminId: string
  impersonatedUserId: string
  reason: string
  metadata?: Record<string, unknown>
}

type ValidateImpersonationRiskInput = {
  session: AuthSession
  request: Request
  actionName: ImpersonationRiskActionName
  targetResourceType: string
  targetResourceId?: string | null
  confirmationText?: string
}

export type ValidatedImpersonationRiskContext = {
  masterLogin: ImpersonationSessionState
  riskReason: string
  actionName: ImpersonationRiskActionName
  targetResourceType: string
  targetResourceId?: string | null
}

function getMasterLoginState(session: Session | null | undefined) {
  return session?.user.masterLogin?.active ? session.user.masterLogin : null
}

async function logImpersonationAudit(params: {
  actorAdminId: string
  action: string
  targetResourceType: string
  targetResourceId?: string | null
  request?: Request
  metadata?: Record<string, unknown>
}) {
  await createAuditLog({
    userId: params.actorAdminId,
    action: params.action,
    entityType: params.targetResourceType,
    entityId: params.targetResourceId ?? undefined,
    newValue: params.metadata,
    ...(params.request ? getClientInfo(params.request) : {}),
  })
}

export async function createImpersonationSessionRecord(input: CreateImpersonationSessionInput) {
  const startedAt = new Date()
  const expiresAt = buildImpersonationExpiry(startedAt)

  return prisma.impersonationSession.create({
    data: {
      impersonatorAdminId: input.impersonatorAdminId,
      impersonatedUserId: input.impersonatedUserId,
      reason: input.reason,
      startedAt,
      expiresAt,
      isActive: true,
      metadata: input.metadata as Prisma.InputJsonValue | undefined,
    },
  })
}

export async function findActiveImpersonationSession(sessionId: string) {
  return prisma.impersonationSession.findUnique({
    where: { id: sessionId },
  })
}

export async function endImpersonationSessionRecord(
  sessionId: string,
  metadata?: Record<string, unknown>
) {
  return prisma.impersonationSession.updateMany({
    where: {
      id: sessionId,
      isActive: true,
    },
    data: {
      isActive: false,
      endedAt: new Date(),
      metadata: metadata as Prisma.InputJsonValue | undefined,
    },
  })
}

export async function validateImpersonationRiskRequest(
  input: ValidateImpersonationRiskInput
): Promise<ValidatedImpersonationRiskContext | null> {
  const masterLogin = getMasterLoginState(input.session)
  if (!masterLogin) {
    return null
  }

  const fail = async (
    code: string,
    message: string,
    metadata?: Record<string, unknown>
  ): Promise<never> => {
    await logImpersonationAudit({
      actorAdminId: masterLogin.actorId,
      action: 'IMPERSONATION_RISK_ACTION_BLOCKED',
      targetResourceType: input.targetResourceType,
      targetResourceId: input.targetResourceId,
      request: input.request,
      metadata: {
        impersonationSessionId: masterLogin.sessionId,
        impersonatedUserId: masterLogin.targetId,
        impersonatedUserEmail: masterLogin.targetEmail,
        actorAdminEmail: masterLogin.actorEmail,
        actionName: input.actionName,
        code,
        ...metadata,
      },
    })
    throw new AppError(403, code, message)
  }

  if (isImpersonationExpired(masterLogin)) {
    await endImpersonationSessionRecord(masterLogin.sessionId, {
      expiredAt: new Date().toISOString(),
    })
    await fail(
      'IMPERSONATION_EXPIRED',
      '마스터 로그인 세션이 만료되어 작업을 진행할 수 없습니다. 다시 시작해 주세요.'
    )
  }

  const persistedSession = await findActiveImpersonationSession(masterLogin.sessionId)
  if (!persistedSession || !persistedSession.isActive || persistedSession.endedAt) {
    await fail(
      'IMPERSONATION_SESSION_INACTIVE',
      '이미 종료된 마스터 로그인 세션입니다. 다시 시작해 주세요.'
    )
  }

  const activeSession = persistedSession!

  if (activeSession.impersonatorAdminId !== masterLogin.actorId) {
    await fail(
      'IMPERSONATION_ACTOR_MISMATCH',
      '마스터 로그인 세션 정보가 현재 관리자와 일치하지 않습니다.'
    )
  }

  if (activeSession.impersonatedUserId !== masterLogin.targetId) {
    await fail(
      'IMPERSONATION_TARGET_MISMATCH',
      '마스터 로그인 대상 정보가 현재 사용자와 일치하지 않습니다.'
    )
  }

  const requestedSessionId = input.request.headers.get(IMPERSONATION_HEADERS.sessionId)
  const requestedActionName = input.request.headers.get(IMPERSONATION_HEADERS.actionName)
  const riskReason = input.request.headers.get(IMPERSONATION_HEADERS.riskReason)?.trim() ?? ''
  const confirmationText = input.request.headers.get(IMPERSONATION_HEADERS.confirmationText)?.trim() ?? ''

  if (!requestedSessionId || requestedSessionId !== masterLogin.sessionId) {
    await fail(
      'IMPERSONATION_CONFIRM_REQUIRED',
      '마스터 로그인 상태에서 위험 작업을 진행하려면 추가 확인이 필요합니다.'
    )
  }

  if (requestedActionName !== input.actionName) {
    await fail(
      'IMPERSONATION_ACTION_MISMATCH',
      '확인한 작업과 실제 요청한 작업이 일치하지 않습니다.'
    )
  }

  if (riskReason.length < IMPERSONATION_RISK_REASON_MIN_LENGTH) {
    await fail(
      'IMPERSONATION_RISK_REASON_REQUIRED',
      `위험 작업 사유를 ${IMPERSONATION_RISK_REASON_MIN_LENGTH}자 이상 입력해 주세요.`
    )
  }

  if (input.confirmationText && confirmationText !== input.confirmationText) {
    await fail(
      'IMPERSONATION_CONFIRM_TEXT_MISMATCH',
      `확인 문구 "${input.confirmationText}"를 정확히 입력해 주세요.`
    )
  }

  return {
    masterLogin,
    riskReason,
    actionName: input.actionName,
    targetResourceType: input.targetResourceType,
    targetResourceId: input.targetResourceId ?? undefined,
  }
}

export async function logImpersonationRiskExecution(params: {
  session: AuthSession
  request: Request
  riskContext: ValidatedImpersonationRiskContext | null
  success: boolean
  metadata?: Record<string, unknown>
}) {
  const masterLogin = getMasterLoginState(params.session)
  if (!masterLogin || !params.riskContext) {
    return
  }

  await logImpersonationAudit({
    actorAdminId: masterLogin.actorId,
    action: params.success ? 'IMPERSONATION_RISK_ACTION_EXECUTED' : 'IMPERSONATION_RISK_ACTION_FAILED',
    targetResourceType: params.riskContext.targetResourceType,
    targetResourceId: params.riskContext.targetResourceId,
    request: params.request,
    metadata: {
      impersonationSessionId: masterLogin.sessionId,
      actorAdminId: masterLogin.actorId,
      actorAdminEmail: masterLogin.actorEmail,
      impersonatedUserId: masterLogin.targetId,
      impersonatedUserEmail: masterLogin.targetEmail,
      actionName: params.riskContext.actionName,
      reason: masterLogin.reason,
      riskReason: params.riskContext.riskReason,
      route: new URL(params.request.url).pathname,
      method: params.request.method,
      ...params.metadata,
    },
  })
}
