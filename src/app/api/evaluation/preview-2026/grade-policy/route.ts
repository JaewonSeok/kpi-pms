import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { AppError, errorResponse, successResponse } from '@/lib/utils'
import {
  Evaluation2026GradePolicyMetadataSaveSchema,
  Evaluation2026GradePolicyReadinessQuerySchema,
  getEvaluation2026GradePolicyReadinessForSession,
  saveEvaluation2026GradePolicyMetadataForSession,
} from '@/server/evaluation-2026-grade-policy-readiness'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    }

    const url = new URL(request.url)
    const parsed = Evaluation2026GradePolicyReadinessQuerySchema.safeParse({
      evalCycleId: url.searchParams.get('evalCycleId') || url.searchParams.get('cycleId') || undefined,
      orgId: url.searchParams.get('orgId') || undefined,
      year: url.searchParams.get('year') || undefined,
    })

    if (!parsed.success) {
      throw new AppError(400, 'INVALID_QUERY', '2026 등급 기준 readiness 조회 조건이 올바르지 않습니다.')
    }

    const readiness = await getEvaluation2026GradePolicyReadinessForSession({
      session,
      ...parsed.data,
    })

    return successResponse(readiness)
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    }

    const body = await request.json().catch(() => null)
    const parsed = Evaluation2026GradePolicyMetadataSaveSchema.safeParse(body)
    if (!parsed.success) {
      throw new AppError(400, 'INVALID_BODY', '2026 등급 기준 metadata 저장 요청이 올바르지 않습니다.')
    }

    const result = await saveEvaluation2026GradePolicyMetadataForSession({
      session,
      input: parsed.data,
    })

    return successResponse(result)
  } catch (error) {
    return errorResponse(error)
  }
}
