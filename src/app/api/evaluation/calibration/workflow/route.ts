import type { Prisma } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createAuditLog, getClientInfo } from '@/lib/audit'
import { buildCalibrationSetupReadiness } from '@/lib/calibration-session-setup'
import { prisma } from '@/lib/prisma'
import { CalibrationWorkflowSchema } from '@/lib/validations'
import { AppError, errorResponse, successResponse } from '@/lib/utils'
import {
  createEmptyCalibrationSessionConfig,
  parseCalibrationSessionConfig,
  toCalibrationSessionConfigJson,
} from '@/server/evaluation-calibration-session'

type CalibrationEvaluationRecord = Prisma.EvaluationGetPayload<{
  include: {
    target: {
      include: {
        department: {
          select: {
            deptName: true
          }
        }
      }
    }
    items: true
  }
}>

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

    const { cycleId, action, scopeId } = parsed.data
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
          in: [
            'CALIBRATION_REVIEW_CONFIRMED',
            'CALIBRATION_LOCKED',
            'CALIBRATION_SESSION_STARTED',
            'CALIBRATION_REOPEN_REQUESTED',
            'CALIBRATION_SESSION_DELETED',
            'CALIBRATION_MERGED',
          ],
        },
      },
      orderBy: {
        timestamp: 'desc',
      },
    })

    const client = getClientInfo(request)

    if (action === 'START_SESSION') {
      if (isPublishedCycle(cycle.status)) {
        throw new AppError(400, 'RESULT_ALREADY_PUBLISHED', '결과 공개 이후에는 세션 시작 상태를 변경할 수 없습니다.')
      }

      const sessionConfig = parseCalibrationSessionConfig(cycle.calibrationSessionConfig)
      const readiness = buildCalibrationSetupReadiness({
        setup: sessionConfig.setup,
        participantIds: sessionConfig.participantIds,
      })

      if (!readiness.readyToStart) {
        throw new AppError(
          400,
          'SETUP_INCOMPLETE',
          `세션 시작 전 아래 설정을 완료해 주세요.\n- ${readiness.blockingItems.join('\n- ')}`
        )
      }

      await createAuditLog({
        userId: session.user.id,
        action: 'CALIBRATION_SESSION_STARTED',
        entityType: 'EvalCycle',
        entityId: cycle.id,
        newValue: {
          status: 'CALIBRATING',
          startedBy: session.user.name,
          sessionOwnerId: sessionConfig.setup.ownerId,
          facilitatorId: sessionConfig.setup.facilitatorId,
          timeboxMinutes: sessionConfig.setup.timeboxMinutes,
          decisionPolicy: sessionConfig.setup.decisionPolicy,
        },
        ...client,
      })

      return successResponse({ status: 'CALIBRATING' })
    }

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

    if (action === 'MERGE') {
      if (isPublishedCycle(cycle.status)) {
        throw new AppError(400, 'RESULT_ALREADY_PUBLISHED', '결과 공개 이후에는 캘리브레이션 병합을 진행할 수 없습니다.')
      }

      const sessionConfig = parseCalibrationSessionConfig(cycle.calibrationSessionConfig)
      const evaluations = await prisma.evaluation.findMany({
        where: {
          evalCycleId: cycle.id,
          evalStage: {
            in: ['FIRST', 'SECOND', 'FINAL', 'CEO_ADJUST'],
          },
          ...(scopeId && scopeId !== 'all'
            ? {
                target: {
                  deptId: scopeId,
                },
              }
            : {}),
        },
        include: {
          target: {
            include: {
              department: {
                select: {
                  deptName: true,
                },
              },
            },
          },
          items: true,
        },
      })

      const grouped = groupEvaluationsByTarget(evaluations)
      const mergeableGroups = [...grouped.values()].filter(
        (group) => !sessionConfig.excludedTargetIds.includes(group.targetId)
      )

      let createdCount = 0
      let skippedCount = 0
      const mergedTargetIds: string[] = []

      for (const group of mergeableGroups) {
        const sourceEvaluation = group.finalEvaluation ?? group.secondEvaluation ?? group.firstEvaluation
        if (!sourceEvaluation || group.adjustedEvaluation) {
          skippedCount += 1
          continue
        }

        await prisma.evaluation.create({
          data: {
            evalCycleId: cycle.id,
            targetId: group.targetId,
            evaluatorId: session.user.id,
            evalStage: 'CEO_ADJUST',
            totalScore: sourceEvaluation.totalScore,
            gradeId: sourceEvaluation.gradeId,
            comment: sourceEvaluation.comment?.trim() || '다단계 캘리브레이션 병합 결과입니다.',
            status: 'CONFIRMED',
            isDraft: false,
            submittedAt: new Date(),
            items: {
              create: sourceEvaluation.items.map((item) => ({
                personalKpiId: item.personalKpiId,
                quantScore: item.quantScore,
                planScore: item.planScore,
                doScore: item.doScore,
                checkScore: item.checkScore,
                actScore: item.actScore,
                qualScore: item.qualScore,
                itemComment: item.itemComment,
                weightedScore: item.weightedScore,
              })),
            },
          },
        })

        createdCount += 1
        mergedTargetIds.push(group.targetId)
      }

      const nextSessionConfig = {
        ...sessionConfig,
        lastMergeSummary: {
          mergedAt: new Date().toISOString(),
          mergedBy: session.user.name ?? session.user.email ?? '관리자',
          createdCount,
          skippedCount,
          scopeId,
        },
      }

      await prisma.evalCycle.update({
        where: { id: cycle.id },
        data: {
          calibrationSessionConfig: toCalibrationSessionConfigJson(nextSessionConfig),
        },
      })

      await createAuditLog({
        userId: session.user.id,
        action: 'CALIBRATION_MERGED',
        entityType: 'EvalCycle',
        entityId: cycle.id,
        newValue: {
          createdCount,
          skippedCount,
          scopeId,
          targetIds: mergedTargetIds,
        },
        ...client,
      })

      return successResponse({
        status: 'CALIBRATING',
        createdCount,
        skippedCount,
        scopeId,
      })
    }

    if (action === 'DELETE_SESSION') {
      if (session.user.role !== 'ROLE_ADMIN') {
        throw new AppError(403, 'ADMIN_ONLY', '세션 삭제는 관리자만 수행할 수 있습니다.')
      }

      if (isPublishedCycle(cycle.status)) {
        throw new AppError(400, 'RESULT_ALREADY_PUBLISHED', '결과 공개 이후에는 세션을 삭제할 수 없습니다.')
      }

      const adjustedEvaluations = await prisma.evaluation.findMany({
        where: {
          evalCycleId: cycle.id,
          evalStage: 'CEO_ADJUST',
        },
        select: {
          id: true,
          targetId: true,
        },
      })

      const evaluationIds = adjustedEvaluations.map((evaluation) => evaluation.id)
      const deletedTargetIds = adjustedEvaluations.map((evaluation) => evaluation.targetId)
      const currentSessionConfig = parseCalibrationSessionConfig(cycle.calibrationSessionConfig)

      await prisma.$transaction(async (tx) => {
        if (evaluationIds.length) {
          await tx.evaluationItem.deleteMany({
            where: {
              evaluationId: {
                in: evaluationIds,
              },
            },
          })
        }

        await tx.evaluation.deleteMany({
          where: {
            evalCycleId: cycle.id,
            evalStage: 'CEO_ADJUST',
          },
        })

        await tx.evalCycle.update({
          where: { id: cycle.id },
          data: {
            calibrationSessionConfig: toCalibrationSessionConfigJson(createEmptyCalibrationSessionConfig()),
          },
        })
      })

      await createAuditLog({
        userId: session.user.id,
        action: 'CALIBRATION_SESSION_DELETED',
        entityType: 'EvalCycle',
        entityId: cycle.id,
        oldValue: {
          adjustedEvaluationCount: evaluationIds.length,
          externalColumnCount: currentSessionConfig.externalColumns.length,
          participantCount: currentSessionConfig.participantIds.length,
          evaluatorCount: currentSessionConfig.evaluatorIds.length,
        },
        newValue: {
          adjustedEvaluationCount: 0,
          deletedTargetIds,
          cleared: ['ceo_adjust_evaluations', 'session_config', 'external_data', 'merge_summary'],
        },
        ...client,
      })

      return successResponse({
        status: 'READY',
        deletedCount: evaluationIds.length,
      })
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

function groupEvaluationsByTarget(evaluations: CalibrationEvaluationRecord[]) {
  const grouped = new Map<
    string,
    {
      targetId: string
      firstEvaluation: CalibrationEvaluationRecord | null
      secondEvaluation: CalibrationEvaluationRecord | null
      finalEvaluation: CalibrationEvaluationRecord | null
      adjustedEvaluation: CalibrationEvaluationRecord | null
    }
  >()

  for (const evaluation of evaluations) {
    const current = grouped.get(evaluation.targetId) ?? {
      targetId: evaluation.targetId,
      firstEvaluation: null,
      secondEvaluation: null,
      finalEvaluation: null,
      adjustedEvaluation: null,
    }

    if (evaluation.evalStage === 'FIRST') current.firstEvaluation = evaluation
    if (evaluation.evalStage === 'SECOND') current.secondEvaluation = evaluation
    if (evaluation.evalStage === 'FINAL') current.finalEvaluation = evaluation
    if (evaluation.evalStage === 'CEO_ADJUST') current.adjustedEvaluation = evaluation

    grouped.set(evaluation.targetId, current)
  }

  return grouped
}
