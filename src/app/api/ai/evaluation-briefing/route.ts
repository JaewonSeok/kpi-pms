import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { EvaluationPerformanceBriefingRequestSchema } from '@/lib/validations'
import { AppError, errorResponse, successResponse } from '@/lib/utils'
import { generateEvaluationPerformanceBriefing } from '@/server/ai/evaluation-performance-briefing'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    }

    const body = await request.json()
    const validated = EvaluationPerformanceBriefingRequestSchema.safeParse(body)
    if (!validated.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        validated.error.issues[0]?.message || 'AI 성과 브리핑 요청이 올바르지 않습니다.'
      )
    }

    const result = await generateEvaluationPerformanceBriefing({
      actorId: session.user.id,
      actorRole: session.user.role,
      evaluationId: validated.data.evaluationId,
    })

    return successResponse(result)
  } catch (error) {
    return errorResponse(error)
  }
}

