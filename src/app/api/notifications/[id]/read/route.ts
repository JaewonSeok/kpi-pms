import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { errorResponse, successResponse, AppError } from '@/lib/utils'

// PATCH /api/notifications/[id]/read
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '인증이 필요합니다.')

    const { id } = await params

    if (id === 'read-all') {
      await prisma.notification.updateMany({
        where: { recipientId: session.user.id, isRead: false },
        data: { isRead: true, readAt: new Date() },
      })
      return successResponse({ message: '모든 알림을 읽음 처리했습니다.' })
    }

    const notification = await prisma.notification.findUnique({
      where: { id },
    })
    if (!notification) throw new AppError(404, 'NOT_FOUND', '알림을 찾을 수 없습니다.')
    if (notification.recipientId !== session.user.id) {
      throw new AppError(403, 'FORBIDDEN', '권한이 없습니다.')
    }

    await prisma.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    })

    return successResponse({ message: '읽음 처리 완료' })
  } catch (error) {
    return errorResponse(error)
  }
}
