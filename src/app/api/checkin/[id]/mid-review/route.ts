import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createAuditLog, getClientInfo } from '@/lib/audit'
import { AppError, errorResponse, successResponse } from '@/lib/utils'
import { SaveMidReviewRecordSchema, SubmitMidReviewRecordSchema } from '@/lib/validations'
import { getMidReviewWorkspace, saveMidReviewRecord } from '@/server/mid-review'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')

    const { id } = await context.params
    const workspace = await getMidReviewWorkspace({
      session,
      checkInId: id,
    })

    return successResponse(workspace)
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')

    const body = await request.json()
    const validated = SaveMidReviewRecordSchema.safeParse(body)
    if (!validated.success) {
      throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0]?.message ?? '입력값을 확인해 주세요.')
    }

    const { id } = await context.params
    const result = await saveMidReviewRecord({
      session,
      checkInId: id,
      input: validated.data,
      submit: false,
    })

    const clientInfo = getClientInfo(request)
    await createAuditLog({
      userId: session.user.id,
      action: 'MID_REVIEW_RECORD_SAVED',
      entityType: 'MidReviewRecord',
      entityId: result.recordId,
      newValue: validated.data as unknown as Record<string, unknown>,
      ipAddress: clientInfo.ipAddress,
      userAgent: clientInfo.userAgent,
    })

    const workspace = await getMidReviewWorkspace({
      session,
      checkInId: id,
    })

    return successResponse(workspace)
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')

    const body = await request.json()
    const validated = SubmitMidReviewRecordSchema.safeParse(body)
    if (!validated.success) {
      throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0]?.message ?? '입력값을 확인해 주세요.')
    }

    const { id } = await context.params
    const result = await saveMidReviewRecord({
      session,
      checkInId: id,
      input: validated.data,
      submit: true,
    })

    const clientInfo = getClientInfo(request)
    await createAuditLog({
      userId: session.user.id,
      action: 'MID_REVIEW_RECORD_SUBMITTED',
      entityType: 'MidReviewRecord',
      entityId: result.recordId,
      newValue: validated.data as unknown as Record<string, unknown>,
      ipAddress: clientInfo.ipAddress,
      userAgent: clientInfo.userAgent,
    })

    const workspace = await getMidReviewWorkspace({
      session,
      checkInId: id,
    })

    return successResponse(workspace)
  } catch (error) {
    return errorResponse(error)
  }
}
