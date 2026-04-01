import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createAuditLog, getClientInfo } from '@/lib/audit'
import { prisma } from '@/lib/prisma'
import { AppError, errorResponse, successResponse } from '@/lib/utils'
import { FeedbackResultViewReceiptSchema } from '@/lib/validations'
import { getFeedbackResultRecipientRole } from '@/server/feedback-360-admin'

type RouteContext = {
  params: Promise<{ id: string }>
}

function canViewResultTarget(params: {
  actorId: string
  actorRole: string
  target: {
    id: string
    teamLeaderId: string | null
    sectionChiefId: string | null
    divisionHeadId: string | null
  }
}) {
  if (params.actorRole === 'ROLE_ADMIN') return true
  if (params.target.id === params.actorId) return true

  return (
    params.target.teamLeaderId === params.actorId ||
    params.target.sectionChiefId === params.actorId ||
    params.target.divisionHeadId === params.actorId
  )
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')

    const { id: roundId } = await context.params
    const validated = FeedbackResultViewReceiptSchema.safeParse(await request.json())
    if (!validated.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        validated.error.issues[0]?.message ?? '열람 대상을 확인해 주세요.'
      )
    }

    const round = await prisma.multiFeedbackRound.findUnique({
      where: { id: roundId },
      select: {
        id: true,
        evalCycle: {
          select: {
            orgId: true,
          },
        },
        feedbacks: {
          where: {
            receiverId: validated.data.targetId,
            status: 'SUBMITTED',
          },
          select: {
            id: true,
          },
        },
      },
    })

    if (!round) {
      throw new AppError(404, 'ROUND_NOT_FOUND', '360 리뷰 라운드를 찾을 수 없습니다.')
    }

    const actor = await prisma.employee.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        role: true,
        department: {
          select: {
            orgId: true,
          },
        },
      },
    })

    if (!actor) {
      throw new AppError(404, 'EMPLOYEE_NOT_FOUND', '직원 정보를 찾을 수 없습니다.')
    }

    if (actor.department.orgId !== round.evalCycle.orgId) {
      throw new AppError(403, 'FORBIDDEN', '현재 조직에서 열람할 수 없는 결과입니다.')
    }

    const target = await prisma.employee.findUnique({
      where: { id: validated.data.targetId },
      select: {
        id: true,
        empName: true,
        teamLeaderId: true,
        sectionChiefId: true,
        divisionHeadId: true,
      },
    })

    if (!target) {
      throw new AppError(404, 'TARGET_NOT_FOUND', '결과 대상자를 찾을 수 없습니다.')
    }

    if (!canViewResultTarget({ actorId: actor.id, actorRole: actor.role, target })) {
      throw new AppError(403, 'FORBIDDEN', '이 결과를 열람할 권한이 없습니다.')
    }

    if (!round.feedbacks.length) {
      return successResponse({
        recorded: false,
        message: '아직 공유 가능한 결과가 준비되지 않았습니다.',
      })
    }

    const recipientRole = getFeedbackResultRecipientRole({
      actorId: actor.id,
      target,
    })

    if (!recipientRole) {
      return successResponse({
        recorded: false,
        message: '운영자 조회는 별도 열람 확인에 집계되지 않습니다.',
      })
    }

    await createAuditLog({
      userId: actor.id,
      action: 'FEEDBACK_RESULT_VIEWED',
      entityType: 'MultiFeedbackRound',
      entityId: round.id,
      newValue: {
        targetId: target.id,
        targetName: target.empName,
        recipientId: actor.id,
        recipientRole,
      },
      ...getClientInfo(request),
    })

    return successResponse({
      recorded: true,
      recipientRole,
    })
  } catch (error) {
    return errorResponse(error)
  }
}
