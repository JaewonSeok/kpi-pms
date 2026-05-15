import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { EVALUATION_POLICY_2026 } from '@/lib/evaluation-policy-2026'
import { AppError, errorResponse, successResponse } from '@/lib/utils'
import { getEvaluation2026ActivationReadinessForSession } from '@/server/evaluation-2026-activation-readiness'

function parseOptionalInt(value: string | null, fallback: number) {
  if (!value) return fallback
  const parsed = Number(value)
  if (!Number.isInteger(parsed)) {
    throw new AppError(400, 'INVALID_QUERY', '숫자 query parameter가 올바르지 않습니다.')
  }
  return parsed
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    }

    const url = new URL(request.url)
    const cycleId = url.searchParams.get('cycleId')?.trim() || undefined
    const year = cycleId
      ? undefined
      : parseOptionalInt(url.searchParams.get('year'), EVALUATION_POLICY_2026.year)
    const limit = parseOptionalInt(url.searchParams.get('limit'), 200)

    const readiness = await getEvaluation2026ActivationReadinessForSession({
      session,
      year,
      cycleId,
      limit,
    })

    return successResponse(readiness)
  } catch (error) {
    return errorResponse(error)
  }
}
