import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { AppError, errorResponse, successResponse } from '@/lib/utils'
import { getMidReviewMonitoringView } from '@/server/mid-review'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    }
    if (!['ROLE_ADMIN', 'ROLE_CEO'].includes(session.user.role)) {
      throw new AppError(403, 'FORBIDDEN', '중간 점검 운영 현황을 볼 권한이 없습니다.')
    }

    const url = new URL(request.url)
    const evalCycleId = url.searchParams.get('evalCycleId') || undefined
    const data = await getMidReviewMonitoringView(evalCycleId)
    return successResponse(data)
  } catch (error) {
    return errorResponse(error)
  }
}
