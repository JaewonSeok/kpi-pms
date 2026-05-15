import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { AppError, errorResponse, successResponse } from '@/lib/utils'
import {
  EvaluationPolicy2026MetadataPatchSchema,
  updateEvaluationPolicy2026MetadataForSession,
} from '@/server/evaluation-preview-2026-mapping'

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    }

    const body = await request.json().catch(() => null)
    const parsed = EvaluationPolicy2026MetadataPatchSchema.safeParse(body)
    if (!parsed.success) {
      throw new AppError(400, 'INVALID_BODY', '2026 정책 metadata 저장 요청이 올바르지 않습니다.')
    }

    const result = await updateEvaluationPolicy2026MetadataForSession({
      session,
      input: parsed.data,
    })

    return successResponse(result)
  } catch (error) {
    return errorResponse(error)
  }
}
