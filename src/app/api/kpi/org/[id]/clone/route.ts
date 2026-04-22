import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getClientInfo } from '@/lib/audit'
import { CloneOrgKpiSchema } from '@/lib/validations'
import { AppError, errorResponse, successResponse } from '@/lib/utils'
import { cloneOrgKpi } from '@/server/kpi-clone'

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    }

    const { id } = await context.params
    const body = await request.json().catch(() => ({}))
    const validated = CloneOrgKpiSchema.safeParse(body)
    if (!validated.success) {
      throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0]?.message ?? '복제 옵션을 확인해 주세요.')
    }

    const cloned = await cloneOrgKpi({
      session,
      sourceId: id,
      targetDeptId: validated.data.targetDeptId,
      targetEvalYear: validated.data.targetEvalYear,
      requestedScope: validated.data.scope ?? null,
      targetCycleId: validated.data.targetCycleId,
      includeProgress: validated.data.includeProgress,
      includeCheckins: validated.data.includeCheckins,
      clientInfo: getClientInfo(request),
    })

    return successResponse(cloned)
  } catch (error) {
    return errorResponse(error)
  }
}
