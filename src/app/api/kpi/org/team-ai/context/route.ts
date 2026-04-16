import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { AppError, errorResponse, successResponse } from '@/lib/utils'
import { loadOrgKpiTeamAiContext } from '@/server/org-kpi-team-ai'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    }

    const { searchParams } = new URL(request.url)
    const targetDeptId = searchParams.get('deptId')
    const evalYear = Number(searchParams.get('evalYear') || new Date().getFullYear())

    if (!targetDeptId) {
      throw new AppError(400, 'VALIDATION_ERROR', '조회할 팀을 선택해 주세요.')
    }

    const context = await loadOrgKpiTeamAiContext({
      userId: session.user.id,
      role: session.user.role,
      deptId: session.user.deptId,
      accessibleDepartmentIds: session.user.accessibleDepartmentIds,
      targetDepartmentId: targetDeptId,
      evalYear,
    })

    return successResponse(context)
  } catch (error) {
    return errorResponse(error)
  }
}
