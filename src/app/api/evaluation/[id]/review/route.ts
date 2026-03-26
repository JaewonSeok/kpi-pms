import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAuditLog, getClientInfo } from '@/lib/audit'
import { errorResponse, successResponse, AppError } from '@/lib/utils'
import { RejectEvaluationSchema } from '@/lib/validations'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '인증이 필요합니다.')

    const { id } = await params
    const evaluation = await prisma.evaluation.findUnique({
      where: { id },
      include: {
        target: {
          select: {
            empName: true,
          },
        },
      },
    })

    if (!evaluation) throw new AppError(404, 'NOT_FOUND', '평가를 찾을 수 없습니다.')

    const canReview =
      evaluation.evaluatorId === session.user.id || session.user.role === 'ROLE_ADMIN'

    if (!canReview) {
      throw new AppError(403, 'FORBIDDEN', '평가 반려 권한이 없습니다.')
    }

    if (evaluation.status === 'CONFIRMED') {
      throw new AppError(400, 'LOCKED', '확정된 평가는 반려할 수 없습니다.')
    }

    const body = await request.json()
    const validated = RejectEvaluationSchema.safeParse(body)

    if (!validated.success) {
      throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0]?.message ?? '입력값이 올바르지 않습니다.')
    }

    await prisma.$transaction(async (tx) => {
      await tx.evaluation.update({
        where: { id },
        data: {
          status: 'REJECTED',
          isRejected: true,
          rejectionReason: validated.data.rejectionReason,
          rejectedAt: new Date(),
          isDraft: true,
        },
      })

      await tx.notification.create({
        data: {
          recipientId: evaluation.targetId,
          type: 'EVAL_REJECTED',
          title: '평가 보완 요청',
          message: `${evaluation.target.empName}님의 평가가 반려되어 보완이 필요합니다.`,
          link: '/evaluation/workbench',
          channel: 'IN_APP',
        },
      })
    })

    const clientInfo = getClientInfo(request)
    await createAuditLog({
      userId: session.user.id,
      action: 'EVALUATION_REJECT',
      entityType: 'Evaluation',
      entityId: id,
      oldValue: {
        status: evaluation.status,
        rejectionReason: evaluation.rejectionReason,
      },
      newValue: {
        status: 'REJECTED',
        rejectionReason: validated.data.rejectionReason,
      },
      ...clientInfo,
    })

    return successResponse({
      id,
      status: 'REJECTED',
      message: '평가를 반려하고 보완 요청을 남겼습니다.',
    })
  } catch (error) {
    return errorResponse(error)
  }
}
