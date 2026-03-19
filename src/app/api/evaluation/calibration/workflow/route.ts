import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createAuditLog, getClientInfo } from '@/lib/audit'
import { prisma } from '@/lib/prisma'
import { CalibrationWorkflowSchema } from '@/lib/validations'
import { AppError, errorResponse, successResponse } from '@/lib/utils'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    if (!['ROLE_ADMIN', 'ROLE_CEO'].includes(session.user.role)) {
      throw new AppError(403, 'FORBIDDEN', '등급 조정 워크플로 권한이 없습니다.')
    }

    const parsed = CalibrationWorkflowSchema.safeParse(await request.json())
    if (!parsed.success) {
      throw new AppError(400, 'INVALID_BODY', parsed.error.issues[0]?.message ?? '요청 형식이 올바르지 않습니다.')
    }

    const { cycleId, action } = parsed.data
    const cycle = await prisma.evalCycle.findUnique({
      where: { id: cycleId },
    })

    if (!cycle) {
      throw new AppError(404, 'CYCLE_NOT_FOUND', '평가 주기를 찾지 못했습니다.')
    }

    const latestAction = await prisma.auditLog.findFirst({
      where: {
        entityType: 'EvalCycle',
        entityId: cycle.id,
        action: {
          in: ['CALIBRATION_REVIEW_CONFIRMED', 'CALIBRATION_LOCKED', 'CALIBRATION_REOPEN_REQUESTED'],
        },
      },
      orderBy: {
        timestamp: 'desc',
      },
    })

    const client = getClientInfo(request)

    if (action === 'CONFIRM_REVIEW') {
      if (isPublishedCycle(cycle.status)) {
        throw new AppError(400, 'CALIBRATION_LOCKED', '결과 공개 이후에는 리뷰 확정을 변경할 수 없습니다.')
      }

      await createAuditLog({
        userId: session.user.id,
        action: 'CALIBRATION_REVIEW_CONFIRMED',
        entityType: 'EvalCycle',
        entityId: cycle.id,
        newValue: {
          status: 'REVIEW_CONFIRMED',
          confirmedBy: session.user.name,
        },
        ...client,
      })

      return successResponse({ status: 'REVIEW_CONFIRMED' })
    }

    if (action === 'LOCK') {
      if (session.user.role !== 'ROLE_CEO') {
        throw new AppError(403, 'CEO_ONLY', '최종 잠금은 CEO만 수행할 수 있습니다.')
      }

      if (isPublishedCycle(cycle.status) || latestAction?.action === 'CALIBRATION_LOCKED') {
        throw new AppError(400, 'CALIBRATION_LOCKED', '이미 잠긴 주기입니다.')
      }

      const [finalEvaluations, adjustedEvaluations, reviewConfirmed] = await Promise.all([
        prisma.evaluation.findMany({
          where: {
            evalCycleId: cycle.id,
            evalStage: {
              in: ['FINAL', 'SECOND', 'FIRST'],
            },
          },
          select: {
            targetId: true,
            totalScore: true,
            gradeId: true,
            evalStage: true,
          },
        }),
        prisma.evaluation.findMany({
          where: {
            evalCycleId: cycle.id,
            evalStage: 'CEO_ADJUST',
          },
          select: {
            targetId: true,
            comment: true,
            gradeId: true,
            totalScore: true,
          },
        }),
        prisma.auditLog.findFirst({
          where: {
            entityType: 'EvalCycle',
            entityId: cycle.id,
            action: 'CALIBRATION_REVIEW_CONFIRMED',
          },
          orderBy: {
            timestamp: 'desc',
          },
        }),
      ])

      if (!reviewConfirmed) {
        throw new AppError(400, 'REVIEW_NOT_CONFIRMED', '리뷰 확정 후 최종 잠금을 진행해 주세요.')
      }

      const finalByTarget = new Map<string, { gradeId: string | null; totalScore: number | null }>()
      for (const evaluation of finalEvaluations) {
        if (!finalByTarget.has(evaluation.targetId)) {
          finalByTarget.set(evaluation.targetId, {
            gradeId: evaluation.gradeId,
            totalScore: evaluation.totalScore,
          })
        }
      }

      const missingReasonCount = adjustedEvaluations.filter((evaluation) => {
        const original = finalByTarget.get(evaluation.targetId)
        return (
          evaluation.gradeId &&
          evaluation.gradeId !== original?.gradeId &&
          !(evaluation.comment && evaluation.comment.trim().length >= 30)
        )
      }).length

      if (missingReasonCount > 0) {
        throw new AppError(400, 'MISSING_REASON', '사유가 비어 있는 조정 건이 있어 잠글 수 없습니다.')
      }

      await createAuditLog({
        userId: session.user.id,
        action: 'CALIBRATION_LOCKED',
        entityType: 'EvalCycle',
        entityId: cycle.id,
        newValue: {
          status: 'FINAL_LOCKED',
          lockedBy: session.user.name,
        },
        ...client,
      })

      return successResponse({ status: 'FINAL_LOCKED' })
    }

    if (isPublishedCycle(cycle.status)) {
      throw new AppError(400, 'RESULT_ALREADY_PUBLISHED', '결과 공개 이후에는 재오픈 요청을 등록할 수 없습니다.')
    }

    await createAuditLog({
      userId: session.user.id,
      action: 'CALIBRATION_REOPEN_REQUESTED',
      entityType: 'EvalCycle',
      entityId: cycle.id,
      oldValue: {
        status: latestAction?.action === 'CALIBRATION_LOCKED' ? 'FINAL_LOCKED' : 'REVIEW_CONFIRMED',
      },
      newValue: {
        status: 'CALIBRATING',
        requestedBy: session.user.name,
      },
      ...client,
    })

    return successResponse({ status: 'CALIBRATING' })
  } catch (error) {
    return errorResponse(error)
  }
}

function isPublishedCycle(status: string) {
  return ['RESULT_OPEN', 'APPEAL', 'CLOSED'].includes(status)
}
