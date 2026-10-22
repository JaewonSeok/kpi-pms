import type { Prisma } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createAuditLog, getClientInfo, resolveAuditActor } from '@/lib/audit'
import { prisma } from '@/lib/prisma'
import { AppError, errorResponse, successResponse } from '@/lib/utils'
import { FeedbackRoundStatusSchema } from '@/lib/validations'
import { isFeedback360RoundEnded } from '@/lib/feedback-360-result-exposure'
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
        documentSettings: true,
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

    const currentSettings =
      round.documentSettings && typeof round.documentSettings === 'object' && !Array.isArray(round.documentSettings)
        ? (round.documentSettings as Prisma.JsonObject)
        : {}

    // 결과 공개: 상태는 그대로 두고 documentSettings.resultReleasedAt 만 쓴다(마이그레이션 없음).
    // 본인 · 리더는 마감됐고 공개된 라운드의 결과만 본다(feedback-360-result-exposure).
    if (action === 'RELEASE_RESULTS') {
      if (!isFeedback360RoundEnded(round.status)) {
        throw new AppError(400, 'ROUND_NOT_CLOSED', '마감된 라운드만 결과를 공개할 수 있습니다.')
      }

      const releasedAt = new Date().toISOString()
      await prisma.multiFeedbackRound.update({
        where: { id: roundId },
        data: {
          documentSettings: {
            ...currentSettings,
            resultReleasedAt: releasedAt,
            resultReleasedById: employee.id,
          },
        },
        select: { id: true },
      })

      const releaseClientInfo = getClientInfo(request)
      await createAuditLog({
        ...resolveAuditActor(session),
        action: 'FEEDBACK_ROUND_RESULTS_RELEASED',
        entityType: 'MultiFeedbackRound',
        entityId: roundId,
        oldValue: { resultReleasedAt: currentSettings.resultReleasedAt ?? null },
        newValue: { resultReleasedAt: releasedAt, roundName: round.roundName },
        ipAddress: releaseClientInfo.ipAddress,
        userAgent: releaseClientInfo.userAgent,
      })

      return successResponse({ roundId, status: round.status, resultReleasedAt: releasedAt, message: '결과를 공개했습니다.' })
    }

    // 공개 취소: 상태는 그대로 두고 공개 표시만 지운다(다른 설정은 유지). 다시 공개할 때까지 본인 · 리더는 결과를 못 본다.
    if (action === 'UNRELEASE_RESULTS') {
      if (!('resultReleasedAt' in currentSettings)) {
        throw new AppError(400, 'RESULT_NOT_RELEASED', '공개된 결과가 없습니다.')
      }

      const unreleasedSettings = Object.fromEntries(
        Object.entries(currentSettings).filter(([key]) => key !== 'resultReleasedAt' && key !== 'resultReleasedById')
      ) as Prisma.JsonObject
      await prisma.multiFeedbackRound.update({
        where: { id: roundId },
        data: { documentSettings: unreleasedSettings },
        select: { id: true },
      })

      const unreleaseClientInfo = getClientInfo(request)
      await createAuditLog({
        ...resolveAuditActor(session),
        action: 'FEEDBACK_ROUND_RESULTS_UNRELEASED',
        entityType: 'MultiFeedbackRound',
        entityId: roundId,
        oldValue: { resultReleasedAt: currentSettings.resultReleasedAt ?? null },
        newValue: { resultReleasedAt: null, roundName: round.roundName },
        ipAddress: unreleaseClientInfo.ipAddress,
        userAgent: unreleaseClientInfo.userAgent,
      })

      return successResponse({ roundId, status: round.status, resultReleasedAt: null, message: '결과 공개를 취소했습니다.' })
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

    // REOPEN 은 결과 공개 표시를 지운다. 다시 마감한 뒤 새로 공개해야 본인 · 리더에게 열린다. 다른 설정은 유지한다.
    const clearsRelease =
      action === 'REOPEN' && ('resultReleasedAt' in currentSettings || 'resultReleasedById' in currentSettings)
    const settingsWithoutRelease = Object.fromEntries(
      Object.entries(currentSettings).filter(([key]) => key !== 'resultReleasedAt' && key !== 'resultReleasedById')
    ) as Prisma.JsonObject

    const updated = await prisma.multiFeedbackRound.update({
      where: { id: roundId },
      data: {
        status: nextStatus,
        ...(clearsRelease ? { documentSettings: settingsWithoutRelease } : {}),
      },
      select: { id: true, status: true },
    })

    const clientInfo = getClientInfo(request)
    await createAuditLog({
      ...resolveAuditActor(session),
      action: `FEEDBACK_ROUND_${action}`,
      entityType: 'MultiFeedbackRound',
      entityId: roundId,
      oldValue: { status: round.status },
      newValue: {
        status: nextStatus,
        roundName: round.roundName,
        ...(action === 'REOPEN' ? { resultReleaseCleared: clearsRelease } : {}),
      },
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
