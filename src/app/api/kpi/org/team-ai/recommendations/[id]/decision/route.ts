import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { AppError, errorResponse, successResponse } from '@/lib/utils'
import { TeamKpiRecommendationDecisionSchema } from '@/lib/validations'
import { applyTeamKpiRecommendationDecision } from '@/server/org-kpi-team-ai'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    }

    const body = await request.json()
    const validated = TeamKpiRecommendationDecisionSchema.safeParse(body)
    if (!validated.success) {
      throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0]?.message ?? '입력값을 확인해 주세요.')
    }

    const { id } = await context.params
    const result = await applyTeamKpiRecommendationDecision({
      userId: session.user.id,
      role: session.user.role,
      deptId: session.user.deptId,
      accessibleDepartmentIds: session.user.accessibleDepartmentIds,
      recommendationItemId: id,
      decision: validated.data.decision,
      draft: validated.data.draft,
    })

    return successResponse(result)
  } catch (error) {
    return errorResponse(error)
  }
}
