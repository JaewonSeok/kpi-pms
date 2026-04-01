import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { resolvePersonalKpiAiAccess } from '@/lib/personal-kpi-access'
import { AppError, errorResponse, successResponse } from '@/lib/utils'
import { PersonalKpiAiActionSchema } from '@/lib/validations'
import {
  detectDuplicatePersonalKpis,
  draftPersonalMonthlyComment,
  evaluatePersonalSmartCriteria,
  generatePersonalKpiDraft,
  improvePersonalKpiWording,
  suggestOrgKpiAlignment,
  suggestWeightAllocation,
  summarizeReviewerRisks,
} from '@/server/ai/personal-kpi'

const PERSONAL_KPI_AI_PUBLIC_ERROR_MESSAGE =
  'AI 초안 생성 중 설정 오류가 발생했습니다. 잠시 후 다시 시도해 주세요. 문제가 계속되면 관리자에게 문의해 주세요.'

function shouldMaskPersonalKpiAiError(error: unknown): error is AppError {
  if (!(error instanceof AppError)) {
    return false
  }

  return (
    error.code.startsWith('AI_') ||
    error.message.includes('response_format') ||
    error.message.includes('json_schema') ||
    error.message.includes('structured output')
  )
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    }

    const aiAccess = resolvePersonalKpiAiAccess({
      role: session.user.role,
    })

    if (!aiAccess.allowed) {
      throw new AppError(403, 'FORBIDDEN', aiAccess.message || '개인 KPI AI 보조를 사용할 수 없습니다.')
    }

    const body = await request.json()
    const validated = PersonalKpiAiActionSchema.safeParse(body)
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
        case 'generate-draft':
          return generatePersonalKpiDraft(commonParams)
        case 'improve-wording':
          return improvePersonalKpiWording(commonParams)
        case 'smart-check':
          return evaluatePersonalSmartCriteria(commonParams)
        case 'suggest-weight':
          return suggestWeightAllocation(commonParams)
        case 'suggest-org-alignment':
          return suggestOrgKpiAlignment(commonParams)
        case 'detect-duplicates':
          return detectDuplicatePersonalKpis(commonParams)
        case 'summarize-review-risks':
          return summarizeReviewerRisks(commonParams)
        case 'draft-monthly-comment':
          return draftPersonalMonthlyComment(commonParams)
        default:
          throw new AppError(400, 'UNSUPPORTED_AI_ACTION', '지원하지 않는 AI 작업입니다.')
      }
    })()

    return successResponse(result)
  } catch (error) {
    if (shouldMaskPersonalKpiAiError(error)) {
      console.error('[personal-kpi-ai]', error)
      return errorResponse(
        new AppError(
          error.statusCode,
          error.code,
          PERSONAL_KPI_AI_PUBLIC_ERROR_MESSAGE
        )
      )
    }

    return errorResponse(error)
  }
}
