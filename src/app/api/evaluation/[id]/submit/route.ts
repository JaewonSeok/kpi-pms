import type { EvalStage, Prisma } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { createAuditLog, getClientInfo } from '@/lib/audit'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { AuthSession } from '@/types/auth'
import { SubmitEvaluationSchema } from '@/lib/validations'
import {
  AppError,
  calcPdcaScore,
  calcWeightedScore,
  errorResponse,
  successResponse,
} from '@/lib/utils'
import { getEvaluationStageChain } from '@/server/evaluation-performance-assignments'
import {
  logImpersonationRiskExecution,
  validateImpersonationRiskRequest,
  type ValidatedImpersonationRiskContext,
} from '@/server/impersonation'

type NextStageEntry = {
  stage: EvalStage
  stageLabel: string
  evaluatorId: string
}

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
      throw new AppError(400, 'ALREADY_SUBMITTED', '이미 제출했거나 확정된 평가입니다.')
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
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        validated.error.issues[0]?.message ?? '입력값이 올바르지 않습니다.'
      )
    }

    const { comment, strengthComment, improvementComment, nextStepGuidance, gradeId, items } =
      validated.data
    let totalScore = 0
    let finalized = false
    let nextStageLabel: string | null = null

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

      const stageChain = await getEvaluationStageChain({
        db: tx,
        evalCycleId: evaluation.evalCycleId,
        targetId: evaluation.targetId,
      })
      const currentStageIndex = stageChain.findIndex((entry) => entry.stage === evaluation.evalStage)
      if (currentStageIndex < 0) {
        throw new AppError(
          400,
          'INVALID_STAGE_CHAIN',
          '현재 평가 단계 배정이 올바르지 않습니다. 배정 관리에서 승인 체인을 확인해 주세요.'
        )
      }

      const nextStageEntry =
        currentStageIndex >= 0 && currentStageIndex < stageChain.length - 1
          ? stageChain[currentStageIndex + 1] ?? null
          : null

      if (!nextStageEntry && evaluation.evalStage !== 'CEO_ADJUST') {
        throw new AppError(
          400,
          'NEXT_STAGE_ASSIGNMENT_REQUIRED',
          '다음 승인 단계 배정이 완료되지 않아 제출할 수 없습니다. 배정 관리에서 다음 승인자를 확인해 주세요.'
        )
      }

      finalized = evaluation.evalStage === 'CEO_ADJUST' && !nextStageEntry
      nextStageLabel = nextStageEntry?.stageLabel ?? null

      await tx.evaluation.update({
        where: { id },
        data: {
          totalScore,
          gradeId,
          comment,
          strengthComment,
          improvementComment,
          nextStepGuidance: nextStepGuidance ?? null,
          status: finalized ? 'CONFIRMED' : 'SUBMITTED',
          isDraft: false,
          submittedAt: new Date(),
          isRejected: false,
          rejectionReason: null,
          rejectedAt: null,
        },
      })

      if (nextStageEntry) {
        await createNextStageEvaluation(tx, evaluation, {
          stage: nextStageEntry.stage,
          stageLabel: nextStageEntry.stageLabel,
          evaluatorId: nextStageEntry.evaluatorId,
        })
      }
    })

    await createAuditLog({
      userId: session.user.id,
      action: 'EVALUATION_SUBMIT',
      entityType: 'Evaluation',
      entityId: id,
      newValue: {
        stage: evaluation.evalStage,
        totalScore,
        strengthComment,
        improvementComment,
        nextStepGuidance: nextStepGuidance ?? null,
        status: finalized ? 'CONFIRMED' : 'SUBMITTED',
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
        finalized,
      },
    })

    return successResponse({
      message: finalized ? '평가를 최종 확정했습니다.' : '평가를 제출했습니다.',
      totalScore,
      finalized,
      nextStageLabel,
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
  },
  nextStageEntry: NextStageEntry
) {
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

  const existing = await tx.evaluation.findUnique({
    where: {
      evalCycleId_targetId_evalStage: {
        evalCycleId: evaluation.evalCycleId,
        targetId: evaluation.targetId,
        evalStage: nextStageEntry.stage,
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
        evaluatorId: nextStageEntry.evaluatorId,
        evalStage: nextStageEntry.stage,
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
      recipientId: nextStageEntry.evaluatorId,
      type: 'EVAL_RECEIVED',
      title: '새 평가가 배정되었습니다.',
      message: `${target.empName}님의 ${nextStageEntry.stageLabel} 대상 평가가 할당되었습니다.`,
      link: nextEvaluationId
        ? `/evaluation/performance/${encodeURIComponent(nextEvaluationId)}?cycleId=${encodeURIComponent(
            evaluation.evalCycleId
          )}`
        : '/evaluation/performance',
      channel: 'IN_APP',
    },
  })
}
