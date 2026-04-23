import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createAuditLog, getClientInfo } from '@/lib/audit'
import { AppError, errorResponse, successResponse } from '@/lib/utils'
import { UpdateMidReviewCycleSchema } from '@/lib/validations'
import { updateMidReviewCycle } from '@/server/mid-review'

type RouteContext = {
  params: Promise<{ cycleId: string; midReviewCycleId: string }>
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    if (session.user.role !== 'ROLE_ADMIN') {
      throw new AppError(403, 'FORBIDDEN', '관리자 권한이 필요합니다.')
    }

    const { midReviewCycleId } = await context.params
    const body = await request.json()
    const validated = UpdateMidReviewCycleSchema.safeParse(body)
    if (!validated.success) {
      throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0]?.message ?? '입력값을 확인해 주세요.')
    }

    const updated = await updateMidReviewCycle({
      midReviewCycleId,
      input: validated.data,
    })

    const clientInfo = getClientInfo(request)
    await createAuditLog({
      userId: session.user.id,
      action: 'MID_REVIEW_CYCLE_UPDATED',
      entityType: 'MidReviewCycle',
      entityId: updated.id,
      newValue: validated.data as unknown as Record<string, unknown>,
      ipAddress: clientInfo.ipAddress,
      userAgent: clientInfo.userAgent,
    })

    return successResponse(updated)
  } catch (error) {
    return errorResponse(error)
  }
}
