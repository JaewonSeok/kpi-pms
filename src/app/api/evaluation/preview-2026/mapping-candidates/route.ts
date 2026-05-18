import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { AppError, errorResponse, successResponse } from '@/lib/utils'
import {
  EvaluationPolicy2026MappingQuerySchema,
  getEvaluationPolicy2026MappingCandidatesForSession,
} from '@/server/evaluation-preview-2026-mapping'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    }

    const url = new URL(request.url)
    const parsed = EvaluationPolicy2026MappingQuerySchema.safeParse({
      cycleId: url.searchParams.get('cycleId') || undefined,
      year: url.searchParams.get('year') || undefined,
      limit: url.searchParams.get('limit') || undefined,
    })

    if (!parsed.success) {
      throw new AppError(400, 'INVALID_QUERY', '2026 정책 매핑 후보 조회 조건이 올바르지 않습니다.')
    }

    const candidates = await getEvaluationPolicy2026MappingCandidatesForSession({
      session,
      ...parsed.data,
    })

    return successResponse(candidates)
  } catch (error) {
    return errorResponse(error)
  }
}
