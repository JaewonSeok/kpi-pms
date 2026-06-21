import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { UpwardReviewAICoachingRequestSchema } from '@/lib/validations'
import { AppError, errorResponse, successResponse } from '@/lib/utils'
import { generateUpwardReviewAiCoaching } from '@/server/ai/upward-review-coaching'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    }

    const body = await request.json()
    const validated = UpwardReviewAICoachingRequestSchema.safeParse(body)
    if (!validated.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        validated.error.issues[0]?.message || '잘못된 AI 코칭 요청입니다.'
      )
    }

    const preview = await generateUpwardReviewAiCoaching({
      session,
      cycleId: validated.data.cycleId,
      roundId: validated.data.roundId,
      empId: validated.data.empId,
    })

    return successResponse(preview)
  } catch (error) {
    return errorResponse(error)
  }
}
