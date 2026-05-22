import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { AppError, errorResponse, successResponse } from '@/lib/utils'
import { getEvaluation2026ReadinessPopulationDryRunForSession } from '@/server/evaluation-2026-readiness-population'

const ReadinessPopulationDryRunQuerySchema = z.object({
  evalCycleId: z.string().trim().min(1),
  limit: z.coerce.number().int().min(1).max(300).optional(),
})

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    }

    const url = new URL(request.url)
    const parsed = ReadinessPopulationDryRunQuerySchema.safeParse({
      evalCycleId: url.searchParams.get('evalCycleId') || url.searchParams.get('cycleId') || undefined,
      limit: url.searchParams.get('limit') || undefined,
    })

    if (!parsed.success) {
      throw new AppError(400, 'INVALID_QUERY', '2026 readiness population dry-run 조회 조건이 올바르지 않습니다.')
    }

    const dryRun = await getEvaluation2026ReadinessPopulationDryRunForSession({
      session,
      evalCycleId: parsed.data.evalCycleId,
      limit: parsed.data.limit,
    })

    return successResponse(dryRun)
  } catch (error) {
    return errorResponse(error)
  }
}
