import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createAuditLog, getClientInfo } from '@/lib/audit'
import { prisma } from '@/lib/prisma'
import { EvaluationGuideActionSchema } from '@/lib/validations'
import { AppError, errorResponse, successResponse } from '@/lib/utils'

const GUIDE_ACTIONS = {
  view: 'EVALUATION_GUIDE_VIEWED',
  confirm: 'EVALUATION_GUIDE_CONFIRMED',
} as const

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    }

    const { id } = await params
    const evaluation = await prisma.evaluation.findUnique({
      where: { id },
      select: {
        id: true,
        evaluatorId: true,
      },
    })

    if (!evaluation) {
      throw new AppError(404, 'NOT_FOUND', '평가를 찾을 수 없습니다.')
    }

    const canAccess = evaluation.evaluatorId === session.user.id || session.user.role === 'ROLE_ADMIN'
    if (!canAccess) {
      throw new AppError(403, 'FORBIDDEN', '평가 가이드를 확인할 권한이 없습니다.')
    }

    const body = await request.json()
    const validated = EvaluationGuideActionSchema.safeParse(body)
    if (!validated.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        validated.error.issues[0]?.message ?? '잘못된 가이드 요청입니다.'
      )
    }

    const action = GUIDE_ACTIONS[validated.data.action]
    const clientInfo = getClientInfo(request)

    await createAuditLog({
      userId: session.user.id,
      action,
      entityType: 'Evaluation',
      entityId: evaluation.id,
      newValue: {
        action: validated.data.action,
        confirmedAt: validated.data.action === 'confirm' ? new Date().toISOString() : null,
      },
      ...clientInfo,
    })

    return successResponse({
      evaluationId: evaluation.id,
      guideStatus: {
        viewed: true,
        confirmed: validated.data.action === 'confirm',
      },
      message:
        validated.data.action === 'confirm'
          ? '평가 가이드 확인 상태를 기록했습니다.'
          : '평가 가이드 열람 이력을 기록했습니다.',
    })
  } catch (error) {
    return errorResponse(error)
  }
}
