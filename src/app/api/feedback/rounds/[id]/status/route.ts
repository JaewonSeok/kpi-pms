import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createAuditLog, getClientInfo, resolveAuditActor } from '@/lib/audit'
import { prisma } from '@/lib/prisma'
import { AppError, errorResponse, successResponse } from '@/lib/utils'
import { FeedbackRoundStatusSchema } from '@/lib/validations'
import {
  canManageFeedbackRoundByAccess,
  getFeedbackReviewAdminAccess,
} from '@/server/feedback-360-access'

/**
 * 360 리뷰 라운드(FULL_360 · PEER · CROSS_DEPT)의 종료 전이.
 *
 * 기존에는 COMPLETED·CLOSED·CANCELLED로 가는 경로가 ANYTIME(rounds/route.ts)과
 * UPWARD(upward/admin/route.ts)에만 있어, 분기 360 라운드는 publish 이후
 * IN_PROGRESS에서 빠져나올 수 없었다.
 *
 * ANYTIME은 수시 리뷰 문서 전용 lifecycle(documentSettings)을 따로 쓰므로
 * 이 라우트의 대상에서 제외한다.
 */
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
    const validated = FeedbackRoundStatusSchema.safeParse(body)
    if (!validated.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        validated.error.issues[0]?.message ?? '요청 값을 확인해 주세요.'
      )
    }

    const { action } = validated.data

    const round = await prisma.multiFeedbackRound.findUnique({
      where: { id: roundId },
      select: {
        id: true,
        roundName: true,
        roundType: true,
        status: true,
        evalCycle: { select: { orgId: true } },
      },
    })

    if (!round) {
      throw new AppError(404, 'ROUND_NOT_FOUND', '360 리뷰 라운드를 찾을 수 없습니다.')
    }

    if (round.roundType === 'ANYTIME') {
      throw new AppError(
        400,
        'ANYTIME_ROUND_NOT_SUPPORTED',
        '수시 리뷰 문서는 수시 리뷰 관리 화면에서 처리해 주세요.'
      )
    }

    if (round.roundType === 'UPWARD') {
      throw new AppError(
        400,
        'UPWARD_ROUND_NOT_SUPPORTED',
        '리더십 진단은 리더십 진단 관리 화면에서 처리해 주세요.'
      )
    }

    const employee = await prisma.employee.findUnique({
      where: { id: session.user.id },
      include: { department: true },
    })

    if (!employee) {
      throw new AppError(404, 'EMPLOYEE_NOT_FOUND', '직원 정보를 찾을 수 없습니다.')
    }

    const reviewAdminAccess = await getFeedbackReviewAdminAccess({
      employeeId: employee.id,
      actorRole: employee.role,
      orgId: round.evalCycle.orgId,
    })

    const canManage = await canManageFeedbackRoundByAccess({
      access: reviewAdminAccess,
      employeeId: employee.id,
      roundId,
    })

    if (!canManage) {
      throw new AppError(403, 'FORBIDDEN', '해당 리뷰 라운드를 관리할 권한이 없습니다.')
    }

    let nextStatus: 'COMPLETED' | 'CANCELLED' | 'IN_PROGRESS'

    if (action === 'CLOSE') {
      if (round.status !== 'IN_PROGRESS') {
        throw new AppError(
          400,
          'INVALID_TRANSITION',
          '응답 진행 중인 라운드만 종료할 수 있습니다.'
        )
      }
      nextStatus = 'COMPLETED'
    } else if (action === 'CANCEL') {
      if (
        round.status !== 'DRAFT' &&
        round.status !== 'RATER_SELECTION' &&
        round.status !== 'IN_PROGRESS'
      ) {
        throw new AppError(400, 'INVALID_TRANSITION', '이미 종료된 라운드는 취소할 수 없습니다.')
      }

      // 제출된 응답이 하나라도 있으면 취소를 거부한다. 취소는 되돌릴 수 없고,
      // 제출된 평가를 조용히 묻어버리는 경로를 만들지 않기 위해서다.
      const submittedCount = await prisma.multiFeedback.count({
        where: { roundId, status: 'SUBMITTED' },
      })
      if (submittedCount > 0) {
        throw new AppError(
          400,
          'FEEDBACK_ALREADY_SUBMITTED',
          `이미 제출된 응답이 ${submittedCount}건 있어 취소할 수 없습니다. 종료(CLOSE)를 사용해 주세요.`
        )
      }
      nextStatus = 'CANCELLED'
    } else {
      // REOPEN
      if (round.status !== 'COMPLETED' && round.status !== 'CLOSED') {
        throw new AppError(
          400,
          'INVALID_TRANSITION',
          '종료된 라운드만 다시 열 수 있습니다. 취소된 라운드는 재개할 수 없습니다.'
        )
      }
      nextStatus = 'IN_PROGRESS'
    }

    const updated = await prisma.multiFeedbackRound.update({
      where: { id: roundId },
      data: { status: nextStatus },
      select: { id: true, status: true },
    })

    const clientInfo = getClientInfo(request)
    await createAuditLog({
      ...resolveAuditActor(session),
      action: `FEEDBACK_ROUND_${action}`,
      entityType: 'MultiFeedbackRound',
      entityId: roundId,
      oldValue: { status: round.status },
      newValue: { status: nextStatus, roundName: round.roundName },
      ipAddress: clientInfo.ipAddress,
      userAgent: clientInfo.userAgent,
    })

    const message =
      action === 'CLOSE'
        ? '라운드를 종료했습니다.'
        : action === 'CANCEL'
          ? '라운드를 취소했습니다.'
          : '라운드를 다시 열었습니다.'

    return successResponse({ roundId: updated.id, status: updated.status, message })
  } catch (error) {
    return errorResponse(error)
  }
}
