import type { Prisma } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AppError, errorResponse, successResponse } from '@/lib/utils'
import { FeedbackNominationWorkflowSchema } from '@/lib/validations'
import {
  canManageFeedbackRoundByAccess,
  getFeedbackReviewAdminAccess,
} from '@/server/feedback-360-access'
import {
  canApproveFeedbackTarget,
  canManageFeedbackTarget,
} from '@/server/feedback-360-workflow'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    }

    const { id: roundId } = await params
    const body = await request.json()
    const validated = FeedbackNominationWorkflowSchema.safeParse(body)
    if (!validated.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        validated.error.issues[0]?.message ?? '요청 값을 확인해 주세요.'
      )
    }

    const round = await prisma.multiFeedbackRound.findUnique({
      where: { id: roundId },
      select: {
        id: true,
        status: true,
        minRaters: true,
        evalCycle: {
          select: {
            orgId: true,
          },
        },
      },
    })

    if (!round) {
      throw new AppError(404, 'ROUND_NOT_FOUND', '360 리뷰 라운드를 찾을 수 없습니다.')
    }

    const employee = await prisma.employee.findUnique({
      where: { id: session.user.id },
      include: { department: true },
    })

    if (!employee) {
      throw new AppError(404, 'EMPLOYEE_NOT_FOUND', '직원 정보를 찾을 수 없습니다.')
    }

    const target = await prisma.employee.findUnique({
      where: { id: validated.data.targetId },
      select: {
        id: true,
        empName: true,
        teamLeaderId: true,
        sectionChiefId: true,
        divisionHeadId: true,
      },
    })

    if (!target) {
      throw new AppError(404, 'TARGET_NOT_FOUND', '대상자를 찾을 수 없습니다.')
    }

    const nominations = await prisma.feedbackNomination.findMany({
      where: {
        roundId,
        targetId: validated.data.targetId,
      },
    })

    if (!nominations.length) {
      throw new AppError(400, 'NOMINATION_EMPTY', '발행할 리뷰어 nomination 초안이 없습니다.')
    }

    const action = validated.data.action
    const note = validated.data.note

    if (action === 'submit') {
      if (!canManageFeedbackTarget(session.user.id, session.user.role, target)) {
        throw new AppError(403, 'FORBIDDEN', 'nomination 제출 권한이 없습니다.')
      }

      await prisma.$transaction([
        prisma.feedbackNomination.updateMany({
          where: {
            roundId,
            targetId: validated.data.targetId,
            status: { in: ['DRAFT', 'REJECTED'] },
          },
          data: {
            status: 'SUBMITTED',
            submittedById: session.user.id,
            submittedAt: new Date(),
            note,
          },
        }),
        prisma.multiFeedbackRound.update({
          where: { id: roundId },
          data: {
            status: round.status === 'DRAFT' ? 'RATER_SELECTION' : round.status,
          },
        }),
        prisma.auditLog.create({
          data: {
            userId: session.user.id,
            entityType: 'FeedbackNomination',
            entityId: `${roundId}:${validated.data.targetId}`,
            action: 'FEEDBACK_NOMINATION_SUBMITTED',
            newValue: {
              targetId: validated.data.targetId,
              note,
              count: nominations.length,
            } as Prisma.InputJsonValue,
          },
        }),
      ])

      return successResponse({
        message: 'nomination을 승인 요청 상태로 제출했습니다.',
        workflowStatus: 'SUBMITTED',
      })
    }

    if (!canApproveFeedbackTarget(session.user.id, session.user.role, target)) {
      throw new AppError(403, 'FORBIDDEN', '이 nomination을 승인하거나 반려할 권한이 없습니다.')
    }

    if (action === 'approve') {
      await prisma.$transaction([
        prisma.feedbackNomination.updateMany({
          where: {
            roundId,
            targetId: validated.data.targetId,
            status: { in: ['SUBMITTED', 'REJECTED'] },
          },
          data: {
            status: 'APPROVED',
            approvedById: session.user.id,
            approvedAt: new Date(),
            note,
          },
        }),
        prisma.auditLog.create({
          data: {
            userId: session.user.id,
            entityType: 'FeedbackNomination',
            entityId: `${roundId}:${validated.data.targetId}`,
            action: 'FEEDBACK_NOMINATION_APPROVED',
            newValue: {
              targetId: validated.data.targetId,
              note,
              count: nominations.length,
            } as Prisma.InputJsonValue,
          },
        }),
      ])

      return successResponse({
        message: 'nomination을 승인했습니다.',
        workflowStatus: 'APPROVED',
      })
    }

    if (action === 'reject') {
      await prisma.$transaction([
        prisma.feedbackNomination.updateMany({
          where: {
            roundId,
            targetId: validated.data.targetId,
          },
          data: {
            status: 'REJECTED',
            approvedById: session.user.id,
            rejectedAt: new Date(),
            note,
          },
        }),
        prisma.auditLog.create({
          data: {
            userId: session.user.id,
            entityType: 'FeedbackNomination',
            entityId: `${roundId}:${validated.data.targetId}`,
            action: 'FEEDBACK_NOMINATION_REJECTED',
            newValue: {
              targetId: validated.data.targetId,
              note,
              count: nominations.length,
            } as Prisma.InputJsonValue,
          },
        }),
      ])

      return successResponse({
        message: 'nomination을 반려했습니다.',
        workflowStatus: 'REJECTED',
      })
    }

    const reviewAdminAccess = await getFeedbackReviewAdminAccess({
      employeeId: employee.id,
      actorRole: employee.role,
      orgId: round.evalCycle.orgId,
    })
    const canPublishRound = await canManageFeedbackRoundByAccess({
      access: reviewAdminAccess,
      employeeId: employee.id,
      roundId,
    })

    if (!canPublishRound) {
      throw new AppError(403, 'FORBIDDEN', '해당 리뷰 라운드를 발행할 권한이 없습니다.')
    }

    const approvedNominations = nominations.filter(
      (item) => item.status === 'APPROVED' || item.status === 'PUBLISHED'
    )
    if (approvedNominations.length < round.minRaters) {
      throw new AppError(
        400,
        'MIN_RATERS_NOT_MET',
        `발행 전 승인된 리뷰어가 anonymity threshold ${round.minRaters}명 이상이어야 합니다.`
      )
    }

    await prisma.$transaction(async (tx) => {
      for (const nomination of approvedNominations) {
        await tx.multiFeedback.upsert({
          where: {
            roundId_giverId_receiverId: {
              roundId,
              giverId: nomination.reviewerId,
              receiverId: nomination.targetId,
            },
          },
          create: {
            roundId,
            giverId: nomination.reviewerId,
            receiverId: nomination.targetId,
            relationship: nomination.relationship,
            status: 'PENDING',
          },
          update: {
            relationship: nomination.relationship,
          },
        })
      }

      await tx.feedbackNomination.updateMany({
        where: {
          roundId,
          targetId: validated.data.targetId,
          status: 'APPROVED',
        },
        data: {
          status: 'PUBLISHED',
          publishedAt: new Date(),
        },
      })

      await tx.multiFeedbackRound.update({
        where: { id: roundId },
        data: { status: 'IN_PROGRESS' },
      })

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          entityType: 'FeedbackNomination',
          entityId: `${roundId}:${validated.data.targetId}`,
          action: 'FEEDBACK_NOMINATION_PUBLISHED',
          newValue: {
            targetId: validated.data.targetId,
            note,
            count: approvedNominations.length,
          } as Prisma.InputJsonValue,
        },
      })
    })

    return successResponse({
      message: '승인된 nomination을 발행하고 리뷰 요청을 생성했습니다.',
      workflowStatus: 'PUBLISHED',
    })
  } catch (error) {
    return errorResponse(error)
  }
}
