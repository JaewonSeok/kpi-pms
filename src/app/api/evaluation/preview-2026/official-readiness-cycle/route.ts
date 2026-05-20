import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { AppError, errorResponse, successResponse } from '@/lib/utils'
import {
  EvaluationPolicy2026OfficialReadinessCyclePatchSchema,
  updatePolicy2026OfficialReadinessCycleForSession,
} from '@/server/evaluation-preview-2026-official-cycle'

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    }

    const body = await request.json().catch(() => null)
    const parsed = EvaluationPolicy2026OfficialReadinessCyclePatchSchema.safeParse(body)
    if (!parsed.success) {
      throw new AppError(400, 'INVALID_BODY', '2026 readiness 대상 주기 지정 요청이 올바르지 않습니다.')
    }

    const result = await updatePolicy2026OfficialReadinessCycleForSession({
      session,
      input: parsed.data,
    })

    return successResponse(result)
  } catch (error) {
    return errorResponse(error)
  }
}
