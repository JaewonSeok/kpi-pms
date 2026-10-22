import type { Prisma } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isFeedback360ResultRuleRound, isFeedback360RoundEnded } from '@/lib/feedback-360-result-exposure'
import { selectFeedback360BulkPublishTargets } from '@/lib/feedback-360-round-operations'
import { prisma } from '@/lib/prisma'
import { AppError, errorResponse, successResponse } from '@/lib/utils'
import { getFeedbackReviewAdminAccess } from '@/server/feedback-360-access'

// 배정 동기화(sync)와 같은 실행 한도.
export const maxDuration = 300

// 일괄 발행 트랜잭션. 쓰기는 대상 수와 상관없이 묶어서 하지만 기본(5초)보다 넉넉하게 둔다.
const BULK_PUBLISH_TRANSACTION_TIMEOUT_MS = 60_000

/**
 * 360(FULL_360, 온보딩 제외) 일괄 발행: 승인된 지명이 minRaters 이상인 대상을 한 번에 발행한다.
 * 전체 리뷰 관리자(canManageAllRounds)만 쓸 수 있다. 대상 한 명씩 발행하는 기존 경로(workflow)는 그대로다.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')

    const { id: roundId } = await params
    const round = await prisma.multiFeedbackRound.findUnique({
      where: { id: roundId },
      select: {
        id: true,
        roundName: true,
        roundType: true,
        status: true,
        minRaters: true,
        onboardingReviewGeneration: { select: { id: true } },
        evalCycle: { select: { orgId: true } },
      },
    })
    if (!round) throw new AppError(404, 'ROUND_NOT_FOUND', '360 리뷰 라운드를 찾을 수 없습니다.')

    const employee = await prisma.employee.findUnique({
      where: { id: session.user.id },
      include: { department: true },
    })
    if (!employee) throw new AppError(404, 'EMPLOYEE_NOT_FOUND', '직원 정보를 찾을 수 없습니다.')

    const access = await getFeedbackReviewAdminAccess({
      employeeId: employee.id,
      actorRole: employee.role,
      orgId: round.evalCycle.orgId,
    })
    if (!access.canManageAllRounds) {
      throw new AppError(403, 'FORBIDDEN', '전체 리뷰 관리자만 일괄 발행할 수 있습니다.')
    }

    if (
      !isFeedback360ResultRuleRound({
        roundType: round.roundType,
        isOnboarding: Boolean(round.onboardingReviewGeneration),
      })
    ) {
      throw new AppError(400, 'NOT_360_ROUND', '360 다면평가(분기) 라운드에서만 일괄 발행할 수 있습니다.')
    }
    if (round.status === 'CANCELLED' || isFeedback360RoundEnded(round.status)) {
      throw new AppError(400, 'ROUND_ALREADY_CLOSED', '종료되거나 취소된 라운드는 발행할 수 없습니다.')
    }

    const nominations = await prisma.feedbackNomination.findMany({
      where: { roundId },
      select: { id: true, targetId: true, reviewerId: true, relationship: true, status: true },
    })
    const selection = selectFeedback360BulkPublishTargets({ minRaters: round.minRaters, nominations })
    const publishTargetIds = new Set(selection.publish)
    const toPublish = nominations.filter(
      (nomination) => publishTargetIds.has(nomination.targetId) && nomination.status === 'APPROVED'
    )

    if (selection.publish.length) {
      await prisma.$transaction(
        async (tx) => {
          // 응답 요청 행은 한 번에 만든다. 같은 평가자 → 대상 행이 이미 있으면 그대로 둔다(unique: 라운드 · 평가자 · 대상).
          await tx.multiFeedback.createMany({
            data: toPublish.map((nomination) => ({
              roundId,
              giverId: nomination.reviewerId,
              receiverId: nomination.targetId,
              relationship: nomination.relationship,
              status: 'PENDING' as const,
            })),
            skipDuplicates: true,
          })

          await tx.feedbackNomination.updateMany({
            where: { roundId, targetId: { in: selection.publish }, status: 'APPROVED' },
            data: { status: 'PUBLISHED', publishedAt: new Date() },
          })

          await tx.multiFeedbackRound.update({
            where: { id: roundId },
            data: { status: 'IN_PROGRESS' },
          })

          await tx.auditLog.create({
            data: {
              userId: session.user.id,
              entityType: 'MultiFeedbackRound',
              entityId: roundId,
              action: 'FEEDBACK_ROUND_BULK_PUBLISHED',
              newValue: {
                roundName: round.roundName,
                publishedTargetIds: selection.publish,
                publishedNominationCount: toPublish.length,
                skippedBelowMinRaters: selection.skippedBelowMinRaters,
                notApprovedTargets: selection.notApprovedTargets,
              } as Prisma.InputJsonValue,
            },
          })
        },
        { timeout: BULK_PUBLISH_TRANSACTION_TIMEOUT_MS }
      )
    }

    return successResponse({
      publishedCount: selection.publish.length,
      publishedTargetIds: selection.publish,
      skippedBelowMinRaters: selection.skippedBelowMinRaters,
      notApprovedTargets: selection.notApprovedTargets,
      message: selection.publish.length
        ? `${selection.publish.length}명의 응답 요청을 발행했습니다.`
        : '기준 인원 이상 승인된 대상이 없어 발행하지 않았습니다.',
    })
  } catch (error) {
    return errorResponse(error)
  }
}
