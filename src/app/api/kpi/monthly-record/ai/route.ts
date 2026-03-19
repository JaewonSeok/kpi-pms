import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { AppError, errorResponse, successResponse } from '@/lib/utils'
import { MonthlyRecordAiActionSchema } from '@/lib/validations'
import {
  explainRiskyKpi,
  generateManagerReviewDraft,
  generateMonthlyPerformanceSummary,
  generateMonthlyRetrospective,
  suggestMonthlyCheckinAgenda,
  summarizeMonthlyEvaluationEvidence,
  summarizeMonthlyEvidence,
} from '@/server/ai/monthly-kpi'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    }

    const body = await request.json()
    const validated = MonthlyRecordAiActionSchema.safeParse(body)
    if (!validated.success) {
      throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0]?.message || '잘못된 AI 요청입니다.')
    }

    const commonParams = {
      requesterId: session.user.id,
      sourceId: validated.data.sourceId,
      payload: validated.data.payload,
    }

    const result = await (async () => {
      switch (validated.data.action) {
        case 'generate-summary':
          return generateMonthlyPerformanceSummary(commonParams)
        case 'explain-risk':
          return explainRiskyKpi(commonParams)
        case 'generate-review':
          return generateManagerReviewDraft(commonParams)
        case 'summarize-evidence':
          return summarizeMonthlyEvidence(commonParams)
        case 'generate-retrospective':
          return generateMonthlyRetrospective(commonParams)
        case 'suggest-checkin-agenda':
          return suggestMonthlyCheckinAgenda(commonParams)
        case 'summarize-evaluation-evidence':
          return summarizeMonthlyEvaluationEvidence(commonParams)
        default:
          throw new AppError(400, 'UNSUPPORTED_AI_ACTION', '지원하지 않는 월간 실적 AI 작업입니다.')
      }
    })()

    return successResponse(result)
  } catch (error) {
    return errorResponse(error)
  }
}
