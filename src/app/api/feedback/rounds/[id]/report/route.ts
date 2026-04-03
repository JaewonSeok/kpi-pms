import type { Prisma } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AppError, errorResponse, successResponse } from '@/lib/utils'
import { Feedback360ReportGenerateSchema } from '@/lib/validations'
import {
  canReadFeedbackRoundContentByAccess,
  getFeedbackReviewAdminAccess,
} from '@/server/feedback-360-access'
import { canManageFeedbackTarget, persistFeedback360Report } from '@/server/feedback-360-workflow'

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
    const validated = Feedback360ReportGenerateSchema.safeParse(body)
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
      include: {
        department: true,
      },
    })
    if (!employee) {
      throw new AppError(404, 'EMPLOYEE_NOT_FOUND', '직원 정보를 찾을 수 없습니다.')
    }

    const target = await prisma.employee.findUnique({
      where: { id: validated.data.targetId },
      select: {
        id: true,
        teamLeaderId: true,
        sectionChiefId: true,
        divisionHeadId: true,
      },
    })
    if (!target) {
      throw new AppError(404, 'TARGET_NOT_FOUND', '대상자를 찾을 수 없습니다.')
    }

    const canManageTarget = canManageFeedbackTarget(session.user.id, session.user.role, target)
    if (!canManageTarget) {
      const reviewAdminAccess = await getFeedbackReviewAdminAccess({
        employeeId: employee.id,
        actorRole: employee.role,
        orgId: round.evalCycle.orgId,
      })
      const canReadRoundContent = await canReadFeedbackRoundContentByAccess({
        access: reviewAdminAccess,
        employeeId: employee.id,
        roundId,
      })

      if (!canReadRoundContent) {
        throw new AppError(403, 'FORBIDDEN', '해당 대상자의 360 리포트를 생성할 권한이 없습니다.')
      }
    }

    const { cache, reportPayload } = await persistFeedback360Report({
      roundId,
      targetId: validated.data.targetId,
      generatedById: session.user.id,
    })

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        entityType: 'FeedbackReportCache',
        entityId: cache.id,
        action: 'FEEDBACK_REPORT_CACHE_GENERATED',
        newValue: {
          roundId,
          targetId: validated.data.targetId,
          feedbackCount: cache.feedbackCount,
          thresholdMet: cache.thresholdMet,
        } as Prisma.InputJsonValue,
      },
    })

    return successResponse({
      message: cache.thresholdMet
        ? '360 리포트 캐시를 생성했습니다.'
        : '응답 수가 기준에는 미달하지만 현재 집계 상태로 리포트 캐시를 생성했습니다.',
      report: reportPayload,
      cacheId: cache.id,
      generatedAt: cache.generatedAt,
    })
  } catch (error) {
    return errorResponse(error)
  }
}
