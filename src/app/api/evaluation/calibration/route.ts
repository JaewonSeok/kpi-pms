import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createAuditLog, getClientInfo } from '@/lib/audit'
import { prisma } from '@/lib/prisma'
import { CalibrationCandidateUpdateSchema } from '@/lib/validations'
import { AppError, errorResponse, successResponse } from '@/lib/utils'

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    if (!['ROLE_ADMIN', 'ROLE_CEO'].includes(session.user.role)) {
      throw new AppError(403, 'FORBIDDEN', '등급 조정 권한이 없습니다.')
    }

    const parsed = CalibrationCandidateUpdateSchema.safeParse(await request.json())
    if (!parsed.success) {
      throw new AppError(400, 'INVALID_BODY', parsed.error.issues[0]?.message ?? '요청 형식이 올바르지 않습니다.')
    }

    const body = parsed.data
    const client = getClientInfo(request)
    const cycle = await prisma.evalCycle.findUnique({
      where: { id: body.cycleId },
      include: {
        organization: true,
      },
    })

    if (!cycle) {
      throw new AppError(404, 'CYCLE_NOT_FOUND', '평가 주기를 찾지 못했습니다.')
    }

    if (isLockedCycle(cycle.status)) {
      throw new AppError(400, 'CALIBRATION_LOCKED', '이미 잠긴 주기라 조정할 수 없습니다.')
    }

    const latestCycleAction = await prisma.auditLog.findFirst({
      where: {
        entityType: 'EvalCycle',
        entityId: cycle.id,
        action: {
          in: ['CALIBRATION_LOCKED', 'CALIBRATION_REOPEN_REQUESTED'],
        },
      },
      orderBy: {
        timestamp: 'desc',
      },
    })

    if (latestCycleAction?.action === 'CALIBRATION_LOCKED') {
      throw new AppError(400, 'CALIBRATION_LOCKED', '잠금 상태에서는 조정을 수정할 수 없습니다.')
    }

    if (body.action === 'update-session-config') {
      await prisma.evalCycle.update({
        where: { id: cycle.id },
        data: {
          calibrationSessionConfig: body.sessionConfig,
        },
      })

      await createAuditLog({
        userId: session.user.id,
        action: 'CALIBRATION_SESSION_CONFIG_UPDATED',
        entityType: 'EvalCycle',
        entityId: cycle.id,
        newValue: body.sessionConfig,
        ...client,
      })

      return successResponse({
        cycleId: cycle.id,
        sessionConfig: body.sessionConfig,
      })
    }

    if (body.action === 'bulk-import') {
      const targetIds = Array.from(new Set((body.rows ?? []).map((row) => row.targetId)))
      const [gradeSettings, evaluations] = await Promise.all([
        prisma.gradeSetting.findMany({
          where: {
            orgId: cycle.orgId,
            evalYear: cycle.evalYear,
            isActive: true,
          },
          select: {
            id: true,
            gradeName: true,
            minScore: true,
            maxScore: true,
          },
        }),
        prisma.evaluation.findMany({
          where: {
            evalCycleId: cycle.id,
            targetId: { in: targetIds },
            evalStage: {
              in: ['FIRST', 'SECOND', 'FINAL', 'CEO_ADJUST'],
            },
          },
          include: {
            target: {
              include: {
                department: true,
              },
            },
            items: true,
          },
        }),
      ])

      const grouped = new Map<
        string,
        {
          finalEvaluation: (typeof evaluations)[number] | null
          adjustedEvaluation: (typeof evaluations)[number] | null
        }
      >()

      for (const evaluation of evaluations) {
        const current = grouped.get(evaluation.targetId) ?? { finalEvaluation: null, adjustedEvaluation: null }
        if (evaluation.evalStage === 'CEO_ADJUST') current.adjustedEvaluation = evaluation
        if (evaluation.evalStage === 'FINAL') current.finalEvaluation = evaluation
        if (!current.finalEvaluation && evaluation.evalStage === 'SECOND') current.finalEvaluation = evaluation
        if (!current.finalEvaluation && evaluation.evalStage === 'FIRST') current.finalEvaluation = evaluation
        grouped.set(evaluation.targetId, current)
      }

      const savedRows: Array<{
        targetId: string
        targetName: string
        department: string
        fromGrade: string
        toGrade: string
        rawScore: number
        reason: string
        evaluationId: string
      }> = []

      await prisma.$transaction(async (tx) => {
        for (const row of body.rows ?? []) {
          const grade = gradeSettings.find((item) => item.id === row.gradeId)
          if (!grade) {
            throw new AppError(404, 'GRADE_NOT_FOUND', '선택한 조정 등급을 찾지 못했습니다.')
          }

          const entry = grouped.get(row.targetId)
          const finalEvaluation = entry?.finalEvaluation
          const adjustedEvaluation = entry?.adjustedEvaluation

          if (!finalEvaluation) {
            throw new AppError(404, 'FINAL_EVALUATION_NOT_FOUND', '원 평가 결과를 찾지 못했습니다.')
          }

          const originalGrade =
            resolveGradeName(
              adjustedEvaluation?.gradeId ?? finalEvaluation.gradeId,
              finalEvaluation.totalScore,
              gradeSettings
            ) ?? '미확정'

          const savedEvaluation = adjustedEvaluation
            ? await tx.evaluation.update({
                where: { id: adjustedEvaluation.id },
                data: {
                  gradeId: grade.id,
                  totalScore: finalEvaluation.totalScore,
                  comment: row.adjustReason.trim(),
                  evaluatorId: session.user.id,
                  status: 'CONFIRMED',
                  isDraft: false,
                  submittedAt: new Date(),
                },
              })
            : await tx.evaluation.create({
                data: {
                  evalCycleId: cycle.id,
                  targetId: row.targetId,
                  evaluatorId: session.user.id,
                  evalStage: 'CEO_ADJUST',
                  totalScore: finalEvaluation.totalScore,
                  gradeId: grade.id,
                  comment: row.adjustReason.trim(),
                  status: 'CONFIRMED',
                  isDraft: false,
                  submittedAt: new Date(),
                  items: {
                    create: finalEvaluation.items.map((item) => ({
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

          savedRows.push({
            targetId: row.targetId,
            targetName: finalEvaluation.target.empName,
            department: finalEvaluation.target.department.deptName,
            fromGrade: originalGrade,
            toGrade: grade.gradeName,
            rawScore: finalEvaluation.totalScore ?? 0,
            reason: row.adjustReason.trim(),
            evaluationId: savedEvaluation.id,
          })
        }
      })

      for (const row of savedRows) {
        await createAuditLog({
          userId: session.user.id,
          action: 'CALIBRATION_UPDATED',
          entityType: 'Evaluation',
          entityId: row.evaluationId,
          oldValue: {
            targetId: row.targetId,
            targetName: row.targetName,
            department: row.department,
            fromGrade: row.fromGrade,
          },
          newValue: {
            targetId: row.targetId,
            targetName: row.targetName,
            department: row.department,
            fromGrade: row.fromGrade,
            toGrade: row.toGrade,
            rawScore: row.rawScore,
            reason: row.reason,
            confirmedBy: session.user.name,
          },
          ...client,
        })
      }

      await createAuditLog({
        userId: session.user.id,
        action: 'CALIBRATION_BULK_IMPORTED',
        entityType: 'EvalCycle',
        entityId: cycle.id,
        newValue: {
          rowCount: savedRows.length,
          targetIds: savedRows.map((item) => item.targetId),
        },
        ...client,
      })

      return successResponse({
        cycleId: cycle.id,
        rowCount: savedRows.length,
      })
    }

    const [gradeSettings, evaluations] = await Promise.all([
      prisma.gradeSetting.findMany({
        where: {
          orgId: cycle.orgId,
          evalYear: cycle.evalYear,
          isActive: true,
        },
        select: {
          id: true,
          gradeName: true,
          minScore: true,
          maxScore: true,
        },
      }),
      prisma.evaluation.findMany({
        where: {
          evalCycleId: cycle.id,
          targetId: body.targetId,
          evalStage: {
            in: ['FIRST', 'SECOND', 'FINAL', 'CEO_ADJUST'],
          },
        },
        include: {
          target: {
            include: {
              department: true,
            },
          },
          items: true,
        },
      }),
    ])

    const finalEvaluation =
      evaluations.find((evaluation) => evaluation.evalStage === 'FINAL') ??
      evaluations.find((evaluation) => evaluation.evalStage === 'SECOND') ??
      evaluations.find((evaluation) => evaluation.evalStage === 'FIRST')
    const adjustedEvaluation = evaluations.find((evaluation) => evaluation.evalStage === 'CEO_ADJUST')
    const targetId = body.targetId ?? finalEvaluation?.targetId ?? adjustedEvaluation?.targetId

    if (!finalEvaluation) {
      throw new AppError(404, 'FINAL_EVALUATION_NOT_FOUND', '원 평가 결과를 찾지 못했습니다.')
    }

    if (!targetId) {
      throw new AppError(400, 'TARGET_REQUIRED', '?깃툒 議곗젙 ??곸옄瑜?李얠? 紐삵뻽?듬땲??')
    }

    const originalGrade =
      resolveGradeName(finalEvaluation.gradeId, finalEvaluation.totalScore, gradeSettings) ?? '미확정'

    if (body.action === 'clear') {
      if (adjustedEvaluation) {
        await prisma.$transaction(async (tx) => {
          await tx.evaluationItem.deleteMany({
            where: {
              evaluationId: adjustedEvaluation.id,
            },
          })
          await tx.evaluation.delete({
            where: {
              id: adjustedEvaluation.id,
            },
          })
        })
      }

      await createAuditLog({
        userId: session.user.id,
        action: 'CALIBRATION_CLEARED',
        entityType: 'EvalCycle',
        entityId: cycle.id,
        oldValue: {
          targetId: body.targetId,
          targetName: finalEvaluation.target.empName,
          fromGrade:
            resolveGradeName(adjustedEvaluation?.gradeId ?? null, adjustedEvaluation?.totalScore ?? null, gradeSettings) ??
            originalGrade,
        },
        newValue: {
          targetId: body.targetId,
          targetName: finalEvaluation.target.empName,
          toGrade: originalGrade,
          reason: '원등급 복원',
        },
        ...client,
      })

      return successResponse({
        targetId,
        cleared: true,
      })
    }

    const nextGrade = gradeSettings.find((grade) => grade.id === body.gradeId)
    if (!nextGrade) {
      throw new AppError(404, 'GRADE_NOT_FOUND', '선택한 조정 등급을 찾지 못했습니다.')
    }

    const savedEvaluation = await prisma.$transaction(async (tx) => {
      if (adjustedEvaluation) {
        return tx.evaluation.update({
          where: { id: adjustedEvaluation.id },
          data: {
            gradeId: nextGrade.id,
            totalScore: finalEvaluation.totalScore,
            comment: body.adjustReason?.trim(),
            evaluatorId: session.user.id,
            status: 'CONFIRMED',
            isDraft: false,
            submittedAt: new Date(),
          },
        })
      }

      return tx.evaluation.create({
        data: {
          evalCycleId: cycle.id,
          targetId,
          evaluatorId: session.user.id,
          evalStage: 'CEO_ADJUST',
          totalScore: finalEvaluation.totalScore,
          gradeId: nextGrade.id,
          comment: body.adjustReason?.trim(),
          status: 'CONFIRMED',
          isDraft: false,
          submittedAt: new Date(),
          items: {
            create: finalEvaluation.items.map((item) => ({
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
    })

    await createAuditLog({
      userId: session.user.id,
      action: 'CALIBRATION_UPDATED',
      entityType: 'Evaluation',
      entityId: savedEvaluation.id,
      oldValue: {
        targetId: body.targetId,
        targetName: finalEvaluation.target.empName,
        department: finalEvaluation.target.department.deptName,
        fromGrade:
          resolveGradeName(adjustedEvaluation?.gradeId ?? finalEvaluation.gradeId, finalEvaluation.totalScore, gradeSettings) ??
          originalGrade,
      },
      newValue: {
        targetId: body.targetId,
        targetName: finalEvaluation.target.empName,
        department: finalEvaluation.target.department.deptName,
        fromGrade: originalGrade,
        toGrade: nextGrade.gradeName,
        rawScore: finalEvaluation.totalScore ?? 0,
        reason: body.adjustReason?.trim(),
        confirmedBy: session.user.name,
      },
      ...client,
    })

    return successResponse({
      targetId: body.targetId,
      evaluationId: savedEvaluation.id,
      adjustedGrade: nextGrade.gradeName,
    })
  } catch (error) {
    return errorResponse(error)
  }
}

function isLockedCycle(status: string) {
  return ['RESULT_OPEN', 'APPEAL', 'CLOSED'].includes(status)
}

function resolveGradeName(
  gradeId: string | null,
  totalScore: number | null,
  gradeSettings: Array<{
    id: string
    gradeName: string
    minScore: number
    maxScore: number
  }>
) {
  if (gradeId) {
    const matched = gradeSettings.find((grade) => grade.id === gradeId)
    if (matched) return matched.gradeName
  }

  if (totalScore === null) return null

  return (
    gradeSettings.find((grade) => totalScore >= grade.minScore && totalScore <= grade.maxScore)?.gradeName ??
    null
  )
}
