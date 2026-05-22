import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getClientInfo } from '@/lib/audit'
import { AppError, errorResponse, successResponse } from '@/lib/utils'
import {
  Evaluation2026TeamKpiHrReviewDecisionSchema,
  saveEvaluation2026TeamKpiHrReviewDecisionForSession,
} from '@/server/evaluation-2026-team-kpi-review-decision'

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    }

    const body = await request.json()
    const parsed = Evaluation2026TeamKpiHrReviewDecisionSchema.safeParse(body)
    if (!parsed.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        parsed.error.issues[0]?.message ?? '2026 팀 KPI HR 검토 입력값을 확인해 주세요.',
        {
          fieldErrors: Object.fromEntries(
            Object.entries(parsed.error.flatten().fieldErrors).flatMap(([field, messages]) =>
              Array.isArray(messages) && messages[0] ? [[field, messages[0]]] : []
            )
          ),
        }
      )
    }

    const result = await saveEvaluation2026TeamKpiHrReviewDecisionForSession(
      {
        session,
        input: parsed.data,
      },
      {
        audit: async (entry) => {
          const { createAuditLog } = await import('@/lib/audit')
          await createAuditLog({
            ...entry,
            ...getClientInfo(request),
          })
        },
      }
    )

    return successResponse(result)
  } catch (error) {
    return errorResponse(error)
  }
}
