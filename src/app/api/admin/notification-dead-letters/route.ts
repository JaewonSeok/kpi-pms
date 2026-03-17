import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AppError, errorResponse, successResponse } from '@/lib/utils'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '인증이 필요합니다.')
    if (session.user.role !== 'ROLE_ADMIN') {
      throw new AppError(403, 'FORBIDDEN', '관리자 권한이 필요합니다.')
    }

    const letters = await prisma.notificationDeadLetter.findMany({
      include: {
        recipient: {
          select: { empId: true, empName: true, gwsEmail: true },
        },
        notificationJob: {
          select: {
            templateCode: true,
            retryCount: true,
            lastError: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    return successResponse(letters)
  } catch (error) {
    return errorResponse(error)
  }
}
