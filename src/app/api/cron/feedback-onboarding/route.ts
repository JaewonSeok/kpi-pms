import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { AppError, errorResponse, successResponse } from '@/lib/utils'
import { runScheduledOnboardingReviewGeneration } from '@/server/onboarding-review-workflow'

function isAuthorizedCronRequest(request: Request, sessionRole?: string | null) {
  const secret = process.env.CRON_SECRET
  const headerSecret = request.headers.get('x-cron-secret')
  if (secret && headerSecret === secret) return true
  return sessionRole === 'ROLE_ADMIN'
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!isAuthorizedCronRequest(request, session?.user.role ?? null)) {
      throw new AppError(403, 'FORBIDDEN', 'cron 실행 권한이 없습니다.')
    }

    const result = await runScheduledOnboardingReviewGeneration()
    return successResponse(result)
  } catch (error) {
    return errorResponse(error)
  }
}
