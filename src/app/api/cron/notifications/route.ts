import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { runNotificationJob } from '@/lib/notification-service'
import { isFeatureEnabled } from '@/lib/feature-flags'
import { NotificationCronSchema } from '@/lib/validations'
import { AppError, errorResponse, successResponse } from '@/lib/utils'
import { isAuthorizedCronRequest } from '@/lib/cron-auth'

export const maxDuration = 300

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!isAuthorizedCronRequest(request, session?.user.role ?? null)) {
      throw new AppError(403, 'FORBIDDEN', 'cron 실행 권한이 없습니다.')
    }

    if (!isFeatureEnabled('notificationsScheduler')) {
      throw new AppError(409, 'FEATURE_DISABLED', 'Notification scheduler is disabled by feature flag.')
    }

    // cron 은 실행 모드를 쿼리로 받는다(?mode=dispatch: 정기 리마인더 없이 대기 잡 발송만). 없으면 전체 실행, 모르는 모드는 400.
    const modeParam = new URL(request.url).searchParams.get('mode')
    const validated = NotificationCronSchema.safeParse(modeParam === null ? {} : { mode: modeParam })
    if (!validated.success) {
      throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0].message)
    }

    const result = await runNotificationJob({
      mode: validated.data.mode,
      reminderTypes: validated.data.reminderTypes,
      triggerSource: session?.user.role === 'ROLE_ADMIN' ? 'admin-manual' : 'cron',
    })

    return successResponse(result)
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!isAuthorizedCronRequest(request, session?.user.role ?? null)) {
      throw new AppError(403, 'FORBIDDEN', 'cron 실행 권한이 없습니다.')
    }

    if (!isFeatureEnabled('notificationsScheduler')) {
      throw new AppError(409, 'FEATURE_DISABLED', 'Notification scheduler is disabled by feature flag.')
    }

    const body = await request.json().catch(() => ({}))
    const validated = NotificationCronSchema.safeParse(body)
    if (!validated.success) {
      throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0].message)
    }

    const result = await runNotificationJob({
      mode: validated.data.mode,
      reminderTypes: validated.data.reminderTypes,
      triggerSource: session?.user.role === 'ROLE_ADMIN' ? 'admin-manual' : 'cron',
    })

    return successResponse(result)
  } catch (error) {
    return errorResponse(error)
  }
}
