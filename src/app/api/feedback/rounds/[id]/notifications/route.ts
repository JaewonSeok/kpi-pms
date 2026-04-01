import { NotificationType } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createAuditLog, getClientInfo } from '@/lib/audit'
import { prisma } from '@/lib/prisma'
import { queueNotification, sendAdhocNotificationTest } from '@/lib/notification-service'
import { getEligibleReminderRecipientIds } from '@/server/feedback-360-admin'
import { AppError, errorResponse, successResponse } from '@/lib/utils'
import { FeedbackRoundReminderSchema } from '@/lib/validations'

type RouteContext = {
  params: Promise<{ id: string }>
}

function resolveNotificationType(
  action: 'send-review-reminder' | 'send-peer-selection-reminder' | 'send-result-share'
) {
  if (action === 'send-result-share') {
    return NotificationType.RESULT_CONFIRMATION_REMINDER
  }

  return NotificationType.EVALUATION_REMINDER
}

async function getAdminEmployee(userId: string) {
  return prisma.employee.findUnique({
    where: { id: userId },
    include: {
      department: true,
    },
  })
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    if (session.user.role !== 'ROLE_ADMIN') {
      throw new AppError(403, 'FORBIDDEN', '리마인드 발송은 관리자만 실행할 수 있습니다.')
    }

    const { id } = await context.params
    const validated = FeedbackRoundReminderSchema.safeParse(await request.json())
    if (!validated.success) {
      throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0]?.message ?? '발송 대상을 확인해 주세요.')
    }

    if (validated.data.roundId !== id) {
      throw new AppError(400, 'ROUND_MISMATCH', '현재 라운드와 발송 대상이 일치하지 않습니다.')
    }

    const employee = await getAdminEmployee(session.user.id)
    if (!employee) {
      throw new AppError(404, 'EMPLOYEE_NOT_FOUND', '직원 정보를 찾을 수 없습니다.')
    }

    const round = await prisma.multiFeedbackRound.findUnique({
      where: { id },
      select: {
        id: true,
        roundName: true,
        evalCycle: {
          select: {
            orgId: true,
          },
        },
        feedbacks: {
          select: {
            giverId: true,
            receiverId: true,
            status: true,
          },
        },
        nominations: {
          select: {
            targetId: true,
            status: true,
          },
        },
      },
    })

    if (!round) {
      throw new AppError(404, 'ROUND_NOT_FOUND', '360 리뷰 라운드를 찾을 수 없습니다.')
    }
    if (round.evalCycle.orgId !== employee.department.orgId) {
      throw new AppError(403, 'FORBIDDEN', '현재 조직에서 관리할 수 없는 리뷰 라운드입니다.')
    }

    if (validated.data.action === 'test-send') {
      const preview = await sendAdhocNotificationTest({
        recipientEmail: validated.data.testEmail!,
        recipientName: session.user.name,
        subject: validated.data.subject,
        body: validated.data.body,
      })

      return successResponse({
        message: '테스트 발송을 완료했습니다.',
        preview,
      })
    }

    const eligibleRecipientIds = new Set(
      getEligibleReminderRecipientIds(validated.data.action, {
        feedbacks: round.feedbacks,
        nominations: round.nominations,
      })
    )
    const invalidTargetIds = validated.data.targetIds.filter((item) => !eligibleRecipientIds.has(item))
    if (invalidTargetIds.length) {
      throw new AppError(400, 'INVALID_REMINDER_TARGET', '현재 조건에서 발송할 수 없는 대상자가 포함되어 있습니다.')
    }

    const recipients = await prisma.employee.findMany({
      where: {
        id: {
          in: Array.from(new Set(validated.data.targetIds)),
        },
      },
      select: {
        id: true,
        empName: true,
      },
    })

    if (!recipients.length) {
      throw new AppError(400, 'NO_RECIPIENTS', '발송할 대상자를 선택해 주세요.')
    }

    const type = resolveNotificationType(validated.data.action)
    let queuedCount = 0
    let suppressedCount = 0
    let duplicateCount = 0

    for (const recipient of recipients) {
      const result = await queueNotification({
        recipientId: recipient.id,
        type,
        sourceType: 'MultiFeedbackRound',
        sourceId: round.id,
        dedupeToken: `${validated.data.action}:${round.id}:${recipient.id}:${new Date().toISOString().slice(0, 10)}`,
        subjectOverride: validated.data.subject,
        bodyOverride: validated.data.body,
        payload: {
          employeeName: recipient.empName,
          roundName: round.roundName,
          cycleName: round.roundName,
          link:
            validated.data.action === 'send-peer-selection-reminder'
              ? `/evaluation/360/nomination?roundId=${encodeURIComponent(round.id)}`
              : validated.data.action === 'send-result-share'
                ? `/evaluation/360/results?roundId=${encodeURIComponent(round.id)}`
                : `/evaluation/360?roundId=${encodeURIComponent(round.id)}`,
        },
      })
      queuedCount += result.created
      suppressedCount += result.suppressed
      duplicateCount += result.duplicates
    }

    await createAuditLog({
      userId: session.user.id,
      action: 'FEEDBACK_REMINDER_SENT',
      entityType: 'MultiFeedbackRound',
      entityId: round.id,
      newValue: {
        action: validated.data.action,
        targetCount: recipients.length,
        queuedCount,
        suppressedCount,
        duplicateCount,
        subject: validated.data.subject,
      },
      ...getClientInfo(request),
    })

    return successResponse({
      message: `${recipients.length}명에게 리마인드 발송을 예약했습니다.`,
      queuedCount,
      suppressedCount,
      duplicateCount,
    })
  } catch (error) {
    return errorResponse(error)
  }
}
