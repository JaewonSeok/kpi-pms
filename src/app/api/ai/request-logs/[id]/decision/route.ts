import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { decideAiRequest } from '@/lib/ai-assist'
import { prisma } from '@/lib/prisma'
import { AppError, errorResponse, successResponse } from '@/lib/utils'
import { AIApprovalDecisionSchema } from '@/lib/validations'

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
    const body = await request.json()
    const validated = AIApprovalDecisionSchema.safeParse(body)
    if (!validated.success) {
      throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0]?.message || 'Invalid decision.')
    }

    const log = await prisma.aiRequestLog.findUnique({
      where: { id },
      select: { id: true, requesterId: true },
    })

    if (!log) {
      throw new AppError(404, 'AI_REQUEST_NOT_FOUND', 'AI request log not found.')
    }

    const canDecide = log.requesterId === session.user.id || session.user.role === 'ROLE_ADMIN'
    if (!canDecide) {
      throw new AppError(403, 'FORBIDDEN', '승인 또는 반려 권한이 없습니다.')
    }

    const updated = await decideAiRequest({
      id,
      actorId: session.user.id,
      action: validated.data.action,
      approvedPayload: validated.data.approvedPayload,
      rejectionReason: validated.data.rejectionReason,
    })

    return successResponse(updated)
  } catch (error) {
    return errorResponse(error)
  }
}
