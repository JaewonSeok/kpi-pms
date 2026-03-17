import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureNotificationPreference } from '@/lib/notification-service'
import { NotificationPreferenceSchema } from '@/lib/validations'
import { AppError, errorResponse, successResponse } from '@/lib/utils'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '인증이 필요합니다.')

    const preference = await ensureNotificationPreference(session.user.id, prisma)
    return successResponse(preference)
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '인증이 필요합니다.')

    const body = await request.json()
    const validated = NotificationPreferenceSchema.safeParse(body)
    if (!validated.success) {
      throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0].message)
    }

    const preference = await prisma.notificationPreference.upsert({
      where: { employeeId: session.user.id },
      update: validated.data,
      create: {
        employeeId: session.user.id,
        ...validated.data,
      },
    })

    return successResponse(preference)
  } catch (error) {
    return errorResponse(error)
  }
}
