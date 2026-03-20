import type { Prisma } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AppError, errorResponse, successResponse } from '@/lib/utils'
import { FeedbackNominationDraftSchema } from '@/lib/validations'
import { canManageFeedbackTarget, getNominationAggregateStatus } from '@/server/feedback-360-workflow'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')

    const { id: roundId } = await params
    const { searchParams } = new URL(request.url)
    const targetId = searchParams.get('targetId') || session.user.id

    const target = await prisma.employee.findUnique({
      where: { id: targetId },
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

    if (!canManageFeedbackTarget(session.user.id, session.user.role, target)) {
      throw new AppError(403, 'FORBIDDEN', 'nomination 정보를 볼 권한이 없습니다.')
    }

    const nominations = await prisma.feedbackNomination.findMany({
      where: { roundId, targetId },
      include: {
        reviewer: {
          select: {
            id: true,
            empName: true,
          },
        },
      },
      orderBy: [{ relationship: 'asc' }, { reviewer: { empName: 'asc' } }],
    })

    if (!nominations.length) {
      const log = await prisma.auditLog.findFirst({
        where: {
          entityType: 'FeedbackNominationDraft',
          entityId: `${roundId}:${targetId}`,
        },
        orderBy: { timestamp: 'desc' },
      })

      return successResponse({
        targetId,
        targetName: target.empName,
        draft: log?.newValue ?? null,
        updatedAt: log?.timestamp ?? null,
        workflowStatus: 'DRAFT',
      })
    }

    return successResponse({
      targetId,
      targetName: target.empName,
      draft: {
        reviewers: nominations.map((item) => ({
          employeeId: item.reviewerId,
          name: item.reviewer.empName,
          relationship: item.relationship,
        })),
      },
      updatedAt: nominations[0]?.updatedAt ?? null,
      workflowStatus: getNominationAggregateStatus(nominations.map((item) => item.status)),
      counts: {
        total: nominations.length,
        approved: nominations.filter((item) => item.status === 'APPROVED' || item.status === 'PUBLISHED').length,
        published: nominations.filter((item) => item.status === 'PUBLISHED').length,
      },
    })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')

    const { id: roundId } = await params
    const body = await request.json()
    const validated = FeedbackNominationDraftSchema.safeParse({
      ...body,
      roundId,
    })

    if (!validated.success) {
      throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0]?.message || '입력값을 확인해 주세요.')
    }

    const round = await prisma.multiFeedbackRound.findUnique({
      where: { id: roundId },
    })

    if (!round) {
      throw new AppError(404, 'ROUND_NOT_FOUND', '360 라운드를 찾을 수 없습니다.')
    }

    if (!['DRAFT', 'RATER_SELECTION'].includes(round.status)) {
      throw new AppError(400, 'ROUND_LOCKED', '현재 라운드는 nomination draft를 수정할 수 없습니다.')
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

    if (!canManageFeedbackTarget(session.user.id, session.user.role, target)) {
      throw new AppError(403, 'FORBIDDEN', '이 대상자의 nomination을 수정할 권한이 없습니다.')
    }

    if (validated.data.reviewers.length > round.maxRaters) {
      throw new AppError(400, 'MAX_RATERS_EXCEEDED', `리뷰어는 최대 ${round.maxRaters}명까지 선택할 수 있습니다.`)
    }

    const reviewerIds = validated.data.reviewers.map((item) => item.employeeId)
    const reviewerCount = await prisma.employee.count({
      where: {
        id: { in: reviewerIds },
        status: 'ACTIVE',
      },
    })

    if (reviewerCount !== reviewerIds.length) {
      throw new AppError(400, 'INVALID_REVIEWER', '선택한 리뷰어 중 활성 상태가 아닌 사용자가 있습니다.')
    }

    await prisma.$transaction(async (tx) => {
      await tx.feedbackNomination.deleteMany({
        where: {
          roundId,
          targetId: validated.data.targetId,
          status: { not: 'PUBLISHED' },
        },
      })

      if (validated.data.reviewers.length) {
        await tx.feedbackNomination.createMany({
          data: validated.data.reviewers.map((reviewer) => ({
            roundId,
            targetId: validated.data.targetId,
            reviewerId: reviewer.employeeId,
            relationship: reviewer.relationship,
            status: 'DRAFT',
            submittedById: session.user.id,
          })),
        })
      }

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          entityType: 'FeedbackNominationDraft',
          entityId: `${roundId}:${validated.data.targetId}`,
          action: 'FEEDBACK_NOMINATION_DRAFT_SAVED',
          newValue: {
            roundId,
            targetId: validated.data.targetId,
            targetName: target.empName,
            reviewers: validated.data.reviewers,
            savedBy: session.user.name,
          } as Prisma.InputJsonValue,
        },
      })
    })

    return successResponse({
      message: 'reviewer nomination draft를 저장했습니다.',
      savedCount: validated.data.reviewers.length,
      workflowStatus: 'DRAFT',
    })
  } catch (error) {
    return errorResponse(error)
  }
}
