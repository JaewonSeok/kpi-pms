import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { EvaluationAIAssistRequestSchema } from '@/lib/validations'
import { AppError, errorResponse, successResponse } from '@/lib/utils'
import { generateEvaluationAssist } from '@/server/ai/evaluation-assist'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    }

    const body = await request.json()
    const validated = EvaluationAIAssistRequestSchema.safeParse(body)
    if (!validated.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        validated.error.issues[0]?.message || '잘못된 AI 보조 요청입니다.'
      )
    }

    const result = await generateEvaluationAssist({
      actorId: session.user.id,
      actorRole: session.user.role,
      mode: validated.data.mode,
      evaluationId: validated.data.evaluationId,
      draftComment: validated.data.draftComment,
      growthMemo: validated.data.growthMemo,
      draftGradeId: validated.data.draftGradeId,
      items: validated.data.items,
    })

    return successResponse(result)
  } catch (error) {
    return errorResponse(error)
  }
}
