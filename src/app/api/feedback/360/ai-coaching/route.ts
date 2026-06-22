import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { AppError, errorResponse, successResponse } from '@/lib/utils'
import { generateFeedback360AiCoaching } from '@/server/ai/feedback360-ai-coaching'

export const runtime = 'nodejs'

const Feedback360AiCoachingRequestSchema = z.object({
  cycleId: z.string().min(1).optional(),
  roundId: z.string().min(1).optional(),
  targetEmployeeId: z.string().min(1).optional(),
  mode: z.enum(['SELF', 'MANAGER', 'HR']).default('SELF'),
})

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    }

    const body = await request.json()
    const validated = Feedback360AiCoachingRequestSchema.safeParse(body)
    if (!validated.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        validated.error.issues[0]?.message || '잘못된 AI 코칭 요청입니다.'
      )
    }

    const preview = await generateFeedback360AiCoaching({
      session,
      cycleId: validated.data.cycleId,
      roundId: validated.data.roundId,
      targetEmployeeId: validated.data.targetEmployeeId,
      mode: validated.data.mode,
    })

    return successResponse(preview)
  } catch (error) {
    return errorResponse(error, 'AI 코칭 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.')
  }
}
