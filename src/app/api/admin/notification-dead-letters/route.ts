import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createAuditLog, getClientInfo } from '@/lib/audit'
import { prisma } from '@/lib/prisma'
import { AppError, errorResponse, successResponse } from '@/lib/utils'
import { NotificationDeadLetterActionSchema } from '@/lib/validations'

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
            id: true,
            templateCode: true,
            title: true,
            message: true,
            retryCount: true,
            lastError: true,
            payload: true,
            status: true,
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

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    if (session.user.role !== 'ROLE_ADMIN') {
      throw new AppError(403, 'FORBIDDEN', '관리자 권한이 필요합니다.')
    }

    const body = await request.json()
    const validated = NotificationDeadLetterActionSchema.safeParse(body)
    if (!validated.success) {
      throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0]?.message || '잘못된 요청입니다.')
    }

    const letters = await prisma.notificationDeadLetter.findMany({
      where: { id: { in: validated.data.ids } },
      include: {
        notificationJob: {
          select: {
            id: true,
            status: true,
            retryCount: true,
            maxRetries: true,
            lastError: true,
            payload: true,
            templateCode: true,
          },
        },
      },
    })

    if (!letters.length) {
      throw new AppError(404, 'NOT_FOUND', '선택한 dead letter 항목을 찾을 수 없습니다.')
    }

    const clientInfo = getClientInfo(request)
    const now = new Date()

    if (validated.data.action === 'retry') {
      await prisma.$transaction(async (tx) => {
        for (const letter of letters) {
          await tx.notificationJob.update({
            where: { id: letter.notificationJobId },
            data: {
              status: 'RETRY_PENDING',
              availableAt: now,
              nextRetryAt: now,
              lastError: null,
              maxRetries: Math.max(letter.notificationJob.maxRetries, letter.notificationJob.retryCount + 1),
            },
          })

          await tx.notificationDeadLetter.delete({
            where: { id: letter.id },
          })
        }
      })

      await Promise.all(
        letters.map((letter) =>
          createAuditLog({
            userId: session.user.id,
            action: 'NOTIFICATION_DEAD_LETTER_RETRIED',
            entityType: 'NotificationDeadLetter',
            entityId: letter.id,
            oldValue: {
              status: letter.notificationJob.status,
              retryCount: letter.notificationJob.retryCount,
              reason: letter.reason,
            },
            newValue: {
              status: 'RETRY_PENDING',
              templateCode: letter.notificationJob.templateCode,
            },
            ...clientInfo,
          })
        )
      )

      return successResponse({
        action: 'retry',
        count: letters.length,
      })
    }

    await prisma.$transaction(async (tx) => {
      for (const letter of letters) {
        await tx.notificationJob.update({
          where: { id: letter.notificationJobId },
          data: {
            status: 'SUPPRESSED',
            suppressedAt: now,
            suppressReason: `ADMIN_ARCHIVE:${letter.reason}`,
          },
        })

        await tx.notificationDeadLetter.delete({
          where: { id: letter.id },
        })
      }
    })

    await Promise.all(
      letters.map((letter) =>
        createAuditLog({
          userId: session.user.id,
          action: 'NOTIFICATION_DEAD_LETTER_ARCHIVED',
          entityType: 'NotificationDeadLetter',
          entityId: letter.id,
          oldValue: {
            status: letter.notificationJob.status,
            retryCount: letter.notificationJob.retryCount,
            reason: letter.reason,
          },
          newValue: {
            status: 'SUPPRESSED',
            templateCode: letter.notificationJob.templateCode,
          },
          ...clientInfo,
        })
      )
    )

    return successResponse({
      action: 'archive',
      count: letters.length,
    })
  } catch (error) {
    return errorResponse(error)
  }
}
