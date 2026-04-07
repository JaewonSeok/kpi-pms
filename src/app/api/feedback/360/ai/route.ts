import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { errorResponse, successResponse, AppError } from '@/lib/utils'
import { Feedback360AiActionSchema } from '@/lib/validations'
import {
  detectCarelessReviews,
  recommend360Reviewers,
  suggestDevelopmentPlan,
  suggestGrowthCopilot,
  summarize360Themes,
} from '@/server/ai/performance-copilot'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')

    const body = await request.json()
    const validated = Feedback360AiActionSchema.safeParse(body)
    if (!validated.success) {
      throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0]?.message || '요청 형식을 확인해 주세요.')
    }

    const params = {
      requesterId: session.user.id,
      sourceId: validated.data.sourceId,
      payload: validated.data.payload,
    }

    const result =
      validated.data.action === 'recommend-reviewers'
        ? await recommend360Reviewers(params)
        : validated.data.action === 'summarize-themes'
          ? await summarize360Themes(params)
          : validated.data.action === 'detect-careless-reviews'
            ? await detectCarelessReviews(params)
            : validated.data.action === 'suggest-growth-copilot'
              ? await suggestGrowthCopilot(params)
              : await suggestDevelopmentPlan(params)

    return successResponse(result)
  } catch (error) {
    return errorResponse(error)
  }
}
