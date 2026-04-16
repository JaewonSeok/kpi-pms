import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { AppError, errorResponse, successResponse } from '@/lib/utils'
import { BusinessPlanDocumentSchema } from '@/lib/validations'
import { saveBusinessPlanDocument } from '@/server/org-kpi-team-ai'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    }

    const body = await request.json()
    const validated = BusinessPlanDocumentSchema.safeParse(body)
    if (!validated.success) {
      throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0]?.message ?? '입력값을 확인해 주세요.')
    }

    const saved = await saveBusinessPlanDocument({
      userId: session.user.id,
      role: session.user.role,
      deptId: session.user.deptId,
      accessibleDepartmentIds: session.user.accessibleDepartmentIds,
      id: validated.data.id,
      targetDepartmentId: validated.data.deptId,
      evalYear: validated.data.evalYear,
      evalCycleId: validated.data.evalCycleId,
      title: validated.data.title,
      sourceType: validated.data.sourceType,
      summaryText: validated.data.summaryText,
      bodyText: validated.data.bodyText,
    })

    return successResponse(saved)
  } catch (error) {
    return errorResponse(error)
  }
}
