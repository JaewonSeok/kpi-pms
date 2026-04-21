import type { EvalStage, Prisma } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { createAuditLog, getClientInfo } from '@/lib/audit'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { AuthSession } from '@/types/auth'
import { SubmitEvaluationSchema } from '@/lib/validations'
import { AppError, calcPdcaScore, calcWeightedScore, errorResponse, successResponse } from '@/lib/utils'
import {
  getNextEvaluationStage,
  resolveEvaluationStageAssignee,
} from '@/server/evaluation-performance-assignments'
import {
  logImpersonationRiskExecution,
  validateImpersonationRiskRequest,
  type ValidatedImpersonationRiskContext,
} from '@/server/impersonation'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let session: AuthSession | null = null
  let riskContext: ValidatedImpersonationRiskContext | null = null

  try {
    session = (await getServerSession(authOptions)) as AuthSession | null
    if (!session) {
      throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    }

    const { id } = await params

    const evaluation = await prisma.evaluation.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            personalKpi: true,
          },
        },
        evalCycle: true,
      },
    })

    if (!evaluation) {
      throw new AppError(404, 'NOT_FOUND', '평가를 찾을 수 없습니다.')
    }

    const canSubmit =
      evaluation.evaluatorId === session.user.id || session.user.role === 'ROLE_ADMIN'

    if (!canSubmit) {
      throw new AppError(403, 'FORBIDDEN', '제출 권한이 없습니다.')
    }

    if (evaluation.status === 'SUBMITTED' || evaluation.status === 'CONFIRMED') {
      throw new AppError(400, 'ALREADY_SUBMITTED', '이미 제출되었거나 확정된 평가입니다.')
    }

    riskContext = await validateImpersonationRiskRequest({
      session,
      request,
      actionName: 'FINAL_SUBMIT',
      targetResourceType: 'Evaluation',
      targetResourceId: id,
      confirmationText: '제출',
    })

    const body = await request.json()
    const validated = SubmitEvaluationSchema.safeParse(body)

    if (!validated.success) {
      throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0]?.message ?? '입력값이 올바르지 않습니다.')
    }

    const { comment, gradeId, items } = validated.data
    let totalScore = 0

    await prisma.$transaction(async (tx) => {
      for (const itemInput of items) {
        const evaluationItem = evaluation.items.find(
          (item) => item.personalKpiId === itemInput.personalKpiId
        )

        if (!evaluationItem) {
          continue
        }

        const kpi = evaluationItem.personalKpi
        const normalizedScore =
          kpi.kpiType === 'QUANTITATIVE'
            ? itemInput.quantScore || 0
            : calcPdcaScore(
                itemInput.planScore || 0,
                itemInput.doScore || 0,
                itemInput.checkScore || 0,
                itemInput.actScore || 0
              )

        const weightedScore = calcWeightedScore(normalizedScore, kpi.weight)
        totalScore += weightedScore

        await tx.evaluationItem.update({
          where: { id: evaluationItem.id },
          data: {
            quantScore: itemInput.quantScore,
            planScore: itemInput.planScore,
            doScore: itemInput.doScore,
            checkScore: itemInput.checkScore,
            actScore: itemInput.actScore,
            qualScore:
              kpi.kpiType === 'QUALITATIVE'
                ? calcPdcaScore(
                    itemInput.planScore || 0,
                    itemInput.doScore || 0,
                    itemInput.checkScore || 0,
                    itemInput.actScore || 0
                  )
                : null,
            itemComment: itemInput.itemComment,
            weightedScore,
          },
        })
      }

      await tx.evaluation.update({
        where: { id },
        data: {
          totalScore,
          gradeId,
          comment,
          status: 'SUBMITTED',
          isDraft: false,
          submittedAt: new Date(),
          isRejected: false,
          rejectionReason: null,
          rejectedAt: null,
        },
      })

      await createNextStageEvaluation(tx, evaluation)
    })

    await createAuditLog({
      userId: session.user.id,
      action: 'EVALUATION_SUBMIT',
      entityType: 'Evaluation',
      entityId: id,
      newValue: {
        stage: evaluation.evalStage,
        totalScore,
        submittedAt: new Date(),
      },
      ...getClientInfo(request),
    })

    await logImpersonationRiskExecution({
      session,
      request,
      riskContext,
      success: true,
      metadata: {
        evalStage: evaluation.evalStage,
        targetId: evaluation.targetId,
      },
    })

    return successResponse({
      message: '평가를 제출했습니다.',
      totalScore,
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

async function createNextStageEvaluation(
  tx: Prisma.TransactionClient,
  evaluation: {
    id: string
    evalCycleId: string
    targetId: string
    evalStage: EvalStage
  }
) {
  const nextStage = getNextEvaluationStage(evaluation.evalStage)
  if (!nextStage) {
    return
  }

  const target = await tx.employee.findUnique({
    where: { id: evaluation.targetId },
    select: {
      id: true,
      empName: true,
    },
  })

  if (!target) {
    return
  }

  const nextEvaluatorId = await resolveEvaluationStageAssignee({
    db: tx,
    evalCycleId: evaluation.evalCycleId,
    targetId: evaluation.targetId,
    evalStage: nextStage,
  })

  if (!nextEvaluatorId) {
    return
  }

  const existing = await tx.evaluation.findUnique({
    where: {
      evalCycleId_targetId_evalStage: {
        evalCycleId: evaluation.evalCycleId,
        targetId: evaluation.targetId,
        evalStage: nextStage,
      },
    },
    select: {
      id: true,
    },
  })

  let nextEvaluationId = existing?.id ?? null

  if (!existing) {
    const previousItems = await tx.evaluationItem.findMany({
      where: { evaluationId: evaluation.id },
      select: {
        personalKpiId: true,
      },
    })

    const created = await tx.evaluation.create({
      data: {
        evalCycleId: evaluation.evalCycleId,
        targetId: evaluation.targetId,
        evaluatorId: nextEvaluatorId,
        evalStage: nextStage,
        status: 'PENDING',
        isDraft: true,
        items: {
          create: previousItems.map((item) => ({
            personalKpiId: item.personalKpiId,
          })),
        },
      },
      select: {
        id: true,
      },
    })

    nextEvaluationId = created.id
  }

  await tx.notification.create({
    data: {
      recipientId: nextEvaluatorId,
      type: 'EVAL_RECEIVED',
      title: '새 평가가 배정되었습니다.',
      message: `${target.empName}님의 ${getStageLabel(nextStage)} 대상 평가가 도착했습니다.`,
      link: nextEvaluationId
        ? `/evaluation/performance/${encodeURIComponent(nextEvaluationId)}?cycleId=${encodeURIComponent(
            evaluation.evalCycleId
          )}`
        : '/evaluation/performance',
      channel: 'IN_APP',
    },
  })
}

function getStageLabel(stage: EvalStage) {
  const labels: Record<EvalStage, string> = {
    SELF: '자기평가',
    FIRST: '1차 평가',
    SECOND: '2차 평가',
    FINAL: '최종 평가',
    CEO_ADJUST: 'CEO 조정',
  }

  return labels[stage]
}
