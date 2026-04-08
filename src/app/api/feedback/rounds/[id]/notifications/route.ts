import { NotificationType } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createAuditLog, getClientInfo } from '@/lib/audit'
import { prisma } from '@/lib/prisma'
import { queueNotification, sendAdhocNotificationTest } from '@/lib/notification-service'
import { buildReviewEmailContent } from '@/lib/review-email-editor'
import type { AuthSession } from '@/types/auth'
import {
  logImpersonationRiskExecution,
  validateImpersonationRiskRequest,
  type ValidatedImpersonationRiskContext,
} from '@/server/impersonation'
import {
  getEligibleReminderRecipientIds,
  resolveFeedbackResultPrimaryLeaderId,
  resolveFeedbackResultRecipientIds,
} from '@/server/feedback-360-admin'
import {
  canManageFeedbackRoundByAccess,
  getFeedbackReviewAdminAccess,
} from '@/server/feedback-360-access'
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
  let session: AuthSession | null = null
  let riskContext: ValidatedImpersonationRiskContext | null = null

  try {
    session = (await getServerSession(authOptions)) as AuthSession | null
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')

    const { id } = await context.params
    const validated = FeedbackRoundReminderSchema.safeParse(await request.json())
    if (!validated.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        validated.error.issues[0]?.message ?? '발송 대상을 확인해 주세요.'
      )
    }

    if (validated.data.roundId !== id) {
      throw new AppError(400, 'ROUND_MISMATCH', '현재 라운드와 발송 대상이 일치하지 않습니다.')
    }

    const normalizedBody = buildReviewEmailContent(validated.data.body)

    const employee = await getAdminEmployee(session.user.id)
    if (!employee) {
      throw new AppError(404, 'EMPLOYEE_NOT_FOUND', '직원 정보를 찾을 수 없습니다.')
    }

    const reviewAdminAccess = await getFeedbackReviewAdminAccess({
      employeeId: employee.id,
      actorRole: employee.role,
      orgId: employee.department.orgId,
    })

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
    if (round.evalCycle.orgId !== employee.department.orgId && session.user.role !== 'ROLE_ADMIN') {
      throw new AppError(403, 'FORBIDDEN', '현재 조직에서 관리할 수 없는 리뷰 라운드입니다.')
    }

    const canManageRound = await canManageFeedbackRoundByAccess({
      access: reviewAdminAccess,
      employeeId: employee.id,
      roundId: round.id,
    })

    if (!canManageRound) {
      throw new AppError(403, 'FORBIDDEN', '이 리뷰 라운드의 알림을 발송할 권한이 없습니다.')
    }

    if (validated.data.action === 'send-result-share') {
      riskContext = await validateImpersonationRiskRequest({
        session,
        request,
        actionName: 'SHARE_RESULT',
        targetResourceType: 'MultiFeedbackRound',
        targetResourceId: round.id,
        confirmationText: '공유',
      })
    }

    if (validated.data.action === 'test-send') {
      const preview = await sendAdhocNotificationTest({
        recipientEmail: validated.data.testEmail!,
        recipientName: session.user.name,
        subject: validated.data.subject,
        body: normalizedBody.html,
      })

      return successResponse({
        message: '테스트 발송이 완료되었습니다.',
        preview,
      })
    }

    const eligibleTargetIds = new Set(
      getEligibleReminderRecipientIds(validated.data.action, {
        feedbacks: round.feedbacks,
        nominations: round.nominations,
      })
    )
    const invalidTargetIds = validated.data.targetIds.filter((item) => !eligibleTargetIds.has(item))
    if (invalidTargetIds.length) {
      throw new AppError(
        400,
        'INVALID_REMINDER_TARGET',
        '현재 조건에서 발송할 수 없는 대상자가 포함되어 있습니다.'
      )
    }

    const type = resolveNotificationType(validated.data.action)
    let queuedCount = 0
    let suppressedCount = 0
    let duplicateCount = 0

    const uniqueTargetIds = Array.from(new Set(validated.data.targetIds))
    const recipients: Array<{
      recipientId: string
      recipientName: string
      targetId: string
      targetName: string
      recipientRole?: 'LEADER' | 'REVIEWEE'
    }> = []

    if (validated.data.action === 'send-result-share') {
      const targets = await prisma.employee.findMany({
        where: {
          id: {
            in: uniqueTargetIds,
          },
        },
        select: {
          id: true,
          empName: true,
          teamLeaderId: true,
          sectionChiefId: true,
          divisionHeadId: true,
        },
      })

      if (!targets.length) {
        throw new AppError(400, 'NO_RECIPIENTS', '공유할 결과 대상자를 선택해 주세요.')
      }

      const leaderIds = Array.from(
        new Set(
          targets
            .map((target) => resolveFeedbackResultPrimaryLeaderId(target))
            .filter((value): value is string => Boolean(value))
        )
      )

      const leaders = leaderIds.length
        ? await prisma.employee.findMany({
            where: {
              id: {
                in: leaderIds,
              },
            },
            select: {
              id: true,
              empName: true,
            },
          })
        : []

      const leadersById = new Map(leaders.map((leader) => [leader.id, leader.empName] as const))
      const recipientMap = new Map<
        string,
        {
          recipientId: string
          recipientName: string
          targetId: string
          targetName: string
          recipientRole: 'LEADER' | 'REVIEWEE'
        }
      >()

      for (const target of targets) {
        for (const recipientId of resolveFeedbackResultRecipientIds({
          audience: validated.data.shareAudience,
          target,
        })) {
          if (recipientId === target.id) {
            recipientMap.set(`${target.id}:REVIEWEE`, {
              recipientId,
              recipientName: target.empName,
              targetId: target.id,
              targetName: target.empName,
              recipientRole: 'REVIEWEE',
            })
            continue
          }

          const leaderName = leadersById.get(recipientId)
          if (!leaderName) continue

          recipientMap.set(`${target.id}:LEADER:${recipientId}`, {
            recipientId,
            recipientName: leaderName,
            targetId: target.id,
            targetName: target.empName,
            recipientRole: 'LEADER',
          })
        }
      }

      recipients.push(...recipientMap.values())
    } else {
      const selectedRecipients = await prisma.employee.findMany({
        where: {
          id: {
            in: uniqueTargetIds,
          },
        },
        select: {
          id: true,
          empName: true,
        },
      })

      recipients.push(
        ...selectedRecipients.map((recipient) => ({
          recipientId: recipient.id,
          recipientName: recipient.empName,
          targetId: recipient.id,
          targetName: recipient.empName,
        }))
      )
    }

    if (!recipients.length) {
      throw new AppError(400, 'NO_RECIPIENTS', '발송 대상자를 선택해 주세요.')
    }

    for (const recipient of recipients) {
      const result = await queueNotification({
        recipientId: recipient.recipientId,
        type,
        sourceType: 'MultiFeedbackRound',
        sourceId: round.id,
        dedupeToken: `${validated.data.action}:${round.id}:${recipient.recipientId}:${recipient.targetId}:${new Date().toISOString().slice(0, 10)}`,
        subjectOverride: validated.data.subject,
        bodyOverride: normalizedBody.html,
        payload: {
          employeeName: recipient.recipientName,
          roundName: round.roundName,
          cycleName: round.roundName,
          link:
            validated.data.action === 'send-peer-selection-reminder'
              ? `/evaluation/360/nomination?roundId=${encodeURIComponent(round.id)}`
              : validated.data.action === 'send-result-share'
                ? `/evaluation/360/results?roundId=${encodeURIComponent(round.id)}&empId=${encodeURIComponent(recipient.targetId)}`
                : `/evaluation/360?roundId=${encodeURIComponent(round.id)}`,
        },
      })

      queuedCount += result.created
      suppressedCount += result.suppressed
      duplicateCount += result.duplicates

      if (validated.data.action === 'send-result-share' && recipient.recipientRole) {
        await createAuditLog({
          userId: session.user.id,
          action: 'FEEDBACK_RESULT_SHARED',
          entityType: 'MultiFeedbackRound',
          entityId: round.id,
          newValue: {
            targetId: recipient.targetId,
            targetName: recipient.targetName,
            recipientId: recipient.recipientId,
            recipientName: recipient.recipientName,
            recipientRole: recipient.recipientRole,
            shareAudience: validated.data.shareAudience,
          },
          ...getClientInfo(request),
        })
      }
    }

    await createAuditLog({
      userId: session.user.id,
      action: 'FEEDBACK_REMINDER_SENT',
      entityType: 'MultiFeedbackRound',
      entityId: round.id,
      newValue: {
        action: validated.data.action,
        targetCount: uniqueTargetIds.length,
        recipientCount: recipients.length,
        queuedCount,
        suppressedCount,
        duplicateCount,
        subject: validated.data.subject,
        bodyPreview: normalizedBody.text.slice(0, 200),
        shareAudience: validated.data.action === 'send-result-share' ? validated.data.shareAudience : undefined,
      },
      ...getClientInfo(request),
    })

    await logImpersonationRiskExecution({
      session,
      request,
      riskContext,
      success: true,
      metadata: {
        roundId: round.id,
        action: validated.data.action,
        shareAudience: validated.data.action === 'send-result-share' ? validated.data.shareAudience : null,
        targetCount: uniqueTargetIds.length,
        recipientCount: recipients.length,
      },
    })

    return successResponse({
      message:
        validated.data.action === 'send-result-share'
          ? `${uniqueTargetIds.length}명의 결과 공유를 예약했습니다. (발송 대상 ${recipients.length}명)`
          : `${recipients.length}명에게 리마인드 발송을 예약했습니다.`,
      queuedCount,
      suppressedCount,
      duplicateCount,
    })
  } catch (error) {
    if (session && riskContext) {
      await logImpersonationRiskExecution({
        session,
        request,
        riskContext,
        success: false,
        metadata: {
          error: error instanceof Error ? error.message : 'unknown',
        },
      }).catch(() => undefined)
    }

    return errorResponse(error)
  }
}
