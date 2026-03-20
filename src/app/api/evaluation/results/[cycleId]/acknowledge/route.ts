import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createAuditLog, getClientInfo } from '@/lib/audit'
import { prisma } from '@/lib/prisma'
import { AppError, errorResponse, successResponse } from '@/lib/utils'

export async function POST(
  request: Request,
  context: {
    params: Promise<{
      cycleId: string
    }>
  }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')

    const { cycleId } = await context.params
    const evaluation = await prisma.evaluation.findFirst({
      where: {
        evalCycleId: cycleId,
        targetId: session.user.id,
      },
      orderBy: [{ evalStage: 'desc' }, { updatedAt: 'desc' }],
      select: {
        id: true,
      },
    })

    if (!evaluation) {
      throw new AppError(404, 'EVALUATION_NOT_FOUND', '확인할 평가 결과를 찾지 못했습니다.')
    }

    const existing = await prisma.auditLog.findFirst({
      where: {
        userId: session.user.id,
        action: 'EVALUATION_RESULT_ACKNOWLEDGED',
        entityType: 'EvalCycle',
        entityId: cycleId,
      },
      orderBy: {
        timestamp: 'desc',
      },
    })

    if (!existing) {
      await createAuditLog({
        userId: session.user.id,
        action: 'EVALUATION_RESULT_ACKNOWLEDGED',
        entityType: 'EvalCycle',
        entityId: cycleId,
        newValue: {
          evaluationId: evaluation.id,
          acknowledged: true,
        },
        ...getClientInfo(request),
      })
    }

    return successResponse({
      acknowledged: true,
    })
  } catch (error) {
    return errorResponse(error)
  }
}
