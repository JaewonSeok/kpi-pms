import { getServerSession } from 'next-auth'
import { AIRequestType } from '@prisma/client'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { generateAiAssist } from '@/lib/ai-assist'
import { AppError, errorResponse, successResponse } from '@/lib/utils'
import { buildMidReviewAiPayload } from '@/server/mid-review'

const MidReviewAiRequestSchema = z.object({
  mode: z.enum(['evidence-summary', 'leader-coach', 'comment-support']),
})

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')

    const body = await request.json()
    const validated = MidReviewAiRequestSchema.safeParse(body)
    if (!validated.success) {
      throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0]?.message ?? '입력값을 확인해 주세요.')
    }

    const { id } = await context.params
    const payload = await buildMidReviewAiPayload({
      session,
      checkInId: id,
      mode: validated.data.mode,
    })

    const result = await generateAiAssist({
      requesterId: session.user.id,
      requestType: AIRequestType.MID_REVIEW_ASSIST,
      sourceType: validated.data.mode,
      sourceId: id,
      payload,
    })

    return successResponse(result)
  } catch (error) {
    return errorResponse(error)
  }
}
