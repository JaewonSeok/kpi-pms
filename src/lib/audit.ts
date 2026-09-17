import { prisma } from '@/lib/prisma'
import { authTrace } from '@/lib/auth-trace'

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

// next-auth의 전역 Session 증강(src/lib/auth.ts)에 기대지 않는 최소 구조.
// ts-node 는 진입 파일이 그 증강을 로드하지 않으면 Session 을 기본형으로 취급하므로,
// AuthSession 같은 증강 의존 타입을 받으면 파일마다 컴파일 결과가 갈린다.
type ResolvableAuditSession = {
  user?: {
    id?: string | null
    masterLogin?: {
      active?: boolean
      targetId: string
      actorId: string
    } | null
  } | null
} | null | undefined

// 대행 중이면 userId=대행 대상 / actorUserId=실행 관리자로 분리한다
export function resolveAuditActor(session: ResolvableAuditSession): AuditActor {
  const user = session?.user
  if (!user?.id) {
    authTrace('warn', 'AUDIT_ACTOR_UNRESOLVED', {
      hasSession: Boolean(session),
      hasUser: Boolean(user),
    })
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
