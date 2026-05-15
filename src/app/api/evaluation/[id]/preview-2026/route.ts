import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { errorResponse, successResponse, AppError } from '@/lib/utils'
import { getEvaluationPreview2026ForSession } from '@/server/evaluation-preview-2026-loader'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    }

    const { id } = await params
    const preview = await getEvaluationPreview2026ForSession({
      session,
      evaluationId: id,
    })

    return successResponse(preview)
  } catch (error) {
    return errorResponse(error)
  }
}
