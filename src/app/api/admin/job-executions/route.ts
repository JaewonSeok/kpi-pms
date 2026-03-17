import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AppError, errorResponse, successResponse } from '@/lib/utils'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '인증이 필요합니다.')
    if (session.user.role !== 'ROLE_ADMIN') {
      throw new AppError(403, 'FORBIDDEN', '관리자 권한이 필요합니다.')
    }

    const { searchParams } = new URL(request.url)
    const take = Math.min(Number(searchParams.get('take') || 20), 100)

    const [executions, queueSummary] = await Promise.all([
      prisma.jobExecution.findMany({
        orderBy: { startedAt: 'desc' },
        take,
      }),
      Promise.all([
        prisma.notificationJob.count({ where: { status: 'QUEUED' } }),
        prisma.notificationJob.count({ where: { status: 'RETRY_PENDING' } }),
        prisma.notificationJob.count({ where: { status: 'DEAD_LETTER' } }),
        prisma.notificationJob.count({ where: { status: 'SUPPRESSED' } }),
      ]),
    ])

    return successResponse({
      executions,
      queue: {
        queued: queueSummary[0],
        retryPending: queueSummary[1],
        deadLetter: queueSummary[2],
        suppressed: queueSummary[3],
      },
    })
  } catch (error) {
    return errorResponse(error)
  }
}
