import { prisma } from '@/lib/prisma'
import type { AuthSession } from '@/types/auth'

interface AuditLogParams {
  userId: string
  actorUserId?: string
  action: string
  entityType: string
  entityId?: string
  oldValue?: object
  newValue?: object
  ipAddress?: string
  userAgent?: string
}

export async function createAuditLog(params: AuditLogParams) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId,
        actorUserId: params.actorUserId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        oldValue: params.oldValue as any,
        newValue: params.newValue as any,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      },
    })
  } catch (error) {
    console.error('AuditLog 생성 실패:', error)
  }
}

export type AuditActor = {
  userId: string
  actorUserId?: string
}

// 대행 중이면 userId=대행 대상 / actorUserId=실행 관리자로 분리한다
export function resolveAuditActor(
  session: AuthSession | null | undefined
): AuditActor {
  const user = session?.user
  if (!user?.id) {
    return { userId: 'ANONYMOUS' }
  }

  if (user.masterLogin?.active) {
    return {
      userId: user.masterLogin.targetId,
      actorUserId: user.masterLogin.actorId,
    }
  }

  return { userId: user.id }
}

export function getClientInfo(request: Request) {
  return {
    ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
    userAgent: request.headers.get('user-agent') || 'unknown',
  }
}
