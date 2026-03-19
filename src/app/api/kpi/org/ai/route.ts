import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { AppError, errorResponse, successResponse } from '@/lib/utils'
import { OrgKpiAiActionSchema } from '@/lib/validations'
import {
  detectDuplicateOrgKpis,
  draftMonthlyExecutionComment,
  evaluateSmartCriteria,
  generateOrgKpiDraft,
  improveOrgKpiWording,
  suggestCascadeAlignment,
  summarizeKpiOperationalRisk,
} from '@/server/ai/org-kpi'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      throw new AppError(401, 'UNAUTHORIZED', '인증이 필요합니다.')
    }

    if (!['ROLE_ADMIN', 'ROLE_CEO', 'ROLE_DIV_HEAD', 'ROLE_SECTION_CHIEF', 'ROLE_TEAM_LEADER'].includes(session.user.role)) {
      throw new AppError(403, 'FORBIDDEN', '조직 KPI AI 보조를 사용할 권한이 없습니다.')
    }

    const body = await request.json()
    const validated = OrgKpiAiActionSchema.safeParse(body)
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
          return generateOrgKpiDraft(commonParams)
        case 'improve-wording':
          return improveOrgKpiWording(commonParams)
        case 'smart-check':
          return evaluateSmartCriteria(commonParams)
        case 'detect-duplicates':
          return detectDuplicateOrgKpis(commonParams)
        case 'suggest-alignment':
          return suggestCascadeAlignment(commonParams)
        case 'summarize-risk':
          return summarizeKpiOperationalRisk(commonParams)
        case 'draft-monthly-comment':
          return draftMonthlyExecutionComment(commonParams)
        default:
          throw new AppError(400, 'UNSUPPORTED_AI_ACTION', '지원하지 않는 AI 작업입니다.')
      }
    })()

    return successResponse(result)
  } catch (error) {
    return errorResponse(error)
  }
}
