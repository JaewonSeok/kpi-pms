import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isFeatureEnabled } from '@/lib/feature-flags'
import { buildOperationsSummary } from '@/lib/operations'
import { AppError, errorResponse, successResponse } from '@/lib/utils'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ROLE_ADMIN') {
      throw new AppError(403, 'FORBIDDEN', '관리자만 접근할 수 있습니다.')
    }

    if (!isFeatureEnabled('opsDashboard')) {
      throw new AppError(409, 'FEATURE_DISABLED', 'Operations dashboard is disabled by feature flag.')
    }

    const summary = await buildOperationsSummary()
    return successResponse(summary)
  } catch (error) {
    return errorResponse(error)
  }
}
