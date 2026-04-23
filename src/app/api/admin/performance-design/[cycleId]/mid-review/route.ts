import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createAuditLog, getClientInfo } from '@/lib/audit'
import { AppError, errorResponse, successResponse } from '@/lib/utils'
import { MidReviewCycleSchema } from '@/lib/validations'
import { createMidReviewCycle, listMidReviewCyclesForEvalCycle } from '@/server/mid-review'

type RouteContext = {
  params: Promise<{ cycleId: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    if (session.user.role !== 'ROLE_ADMIN') {
      throw new AppError(403, 'FORBIDDEN', '관리자 권한이 필요합니다.')
    }

    const { cycleId } = await context.params
    const cycles = await listMidReviewCyclesForEvalCycle(cycleId)
    return successResponse(cycles)
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    if (session.user.role !== 'ROLE_ADMIN') {
      throw new AppError(403, 'FORBIDDEN', '관리자 권한이 필요합니다.')
    }

    const { cycleId } = await context.params
    const body = await request.json()
    const validated = MidReviewCycleSchema.safeParse(body)
    if (!validated.success) {
      throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0]?.message ?? '입력값을 확인해 주세요.')
    }

    const created = await createMidReviewCycle({
      actorId: session.user.id,
      evalCycleId: cycleId,
      input: validated.data,
    })

    const clientInfo = getClientInfo(request)
    await createAuditLog({
      userId: session.user.id,
      action: 'MID_REVIEW_CYCLE_CREATED',
      entityType: 'MidReviewCycle',
      entityId: created.id,
      newValue: validated.data as unknown as Record<string, unknown>,
      ipAddress: clientInfo.ipAddress,
      userAgent: clientInfo.userAgent,
    })

    const cycles = await listMidReviewCyclesForEvalCycle(cycleId)
    return successResponse({
      createdId: created.id,
      cycles,
    })
  } catch (error) {
    return errorResponse(error)
  }
}
