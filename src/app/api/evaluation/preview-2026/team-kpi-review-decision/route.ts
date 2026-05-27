import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createAuditLog, getClientInfo } from '@/lib/audit'
import { AppError, errorResponse, successResponse } from '@/lib/utils'
import {
  Evaluation2026TeamKpiHrReviewBulkDecisionSchema,
  Evaluation2026TeamKpiHrReviewDecisionSchema,
  saveEvaluation2026TeamKpiHrReviewBulkDecisionForSession,
  saveEvaluation2026TeamKpiHrReviewDecisionForSession,
} from '@/server/evaluation-2026-team-kpi-review-decision'

function validationError(message: string, fieldErrors: Record<string, string[] | undefined>) {
  return new AppError(400, 'VALIDATION_ERROR', message, {
    fieldErrors: Object.fromEntries(
      Object.entries(fieldErrors).flatMap(([field, messages]) =>
        Array.isArray(messages) && messages[0] ? [[field, messages[0]]] : []
      )
    ),
  })
}

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    }

    const body = await request.json()
    const isBulkRequest =
      typeof body === 'object' &&
      body !== null &&
      Array.isArray((body as { orgKpiIds?: unknown }).orgKpiIds)

    const audit = async (entry: Parameters<typeof createAuditLog>[0]) => {
      await createAuditLog({
        ...entry,
        ...getClientInfo(request),
      })
    }

    if (isBulkRequest) {
      const parsed = Evaluation2026TeamKpiHrReviewBulkDecisionSchema.safeParse(body)
      if (!parsed.success) {
        throw validationError(
          parsed.error.issues[0]?.message ?? '2026 팀 KPI HR 검토 입력값을 확인해 주세요.',
          parsed.error.flatten().fieldErrors
        )
      }
      const result = await saveEvaluation2026TeamKpiHrReviewBulkDecisionForSession(
        {
          session,
          input: parsed.data,
        },
        {
          audit,
        }
      )
      return successResponse(result)
    }

    const parsed = Evaluation2026TeamKpiHrReviewDecisionSchema.safeParse(body)
    if (!parsed.success) {
      throw validationError(
        parsed.error.issues[0]?.message ?? '2026 팀 KPI HR 검토 입력값을 확인해 주세요.',
        parsed.error.flatten().fieldErrors
      )
    }
    const result = await saveEvaluation2026TeamKpiHrReviewDecisionForSession(
      {
        session,
        input: parsed.data,
      },
      {
        audit,
      }
    )

    return successResponse(result)
  } catch (error) {
    return errorResponse(error)
  }
}
