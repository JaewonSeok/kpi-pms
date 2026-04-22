import { getServerSession } from 'next-auth'
import { createAuditLog, getClientInfo } from '@/lib/audit'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { AuthSession } from '@/types/auth'
import { RejectEvaluationSchema } from '@/lib/validations'
import { AppError, errorResponse, successResponse } from '@/lib/utils'
import { getPreviousActiveEvaluationStage } from '@/server/evaluation-performance-assignments'
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
        target: {
          select: {
            empName: true,
          },
        },
      },
    })

    if (!evaluation) {
      throw new AppError(404, 'NOT_FOUND', '평가를 찾을 수 없습니다.')
    }

    const canReview =
      evaluation.evaluatorId === session.user.id || session.user.role === 'ROLE_ADMIN'

    if (!canReview) {
      throw new AppError(403, 'FORBIDDEN', '평가 반려 권한이 없습니다.')
    }

    if (evaluation.status === 'CONFIRMED') {
      throw new AppError(400, 'LOCKED', '확정된 평가는 반려할 수 없습니다.')
    }

    const previousStage = await getPreviousActiveEvaluationStage({
      evalCycleId: evaluation.evalCycleId,
      targetId: evaluation.targetId,
      currentStage: evaluation.evalStage,
    })
    if (!previousStage) {
      throw new AppError(400, 'PREVIOUS_STAGE_REQUIRED', '이전 단계가 없는 평가는 반려할 수 없습니다.')
    }

    riskContext = await validateImpersonationRiskRequest({
      session,
      request,
      actionName: 'REJECT_RECORD',
      targetResourceType: 'Evaluation',
      targetResourceId: id,
      confirmationText: '반려',
    })

    const body = await request.json()
    const validated = RejectEvaluationSchema.safeParse(body)

    if (!validated.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        validated.error.issues[0]?.message ?? '입력값이 올바르지 않습니다.'
      )
    }

    const previousEvaluation = await prisma.evaluation.findUnique({
      where: {
        evalCycleId_targetId_evalStage: {
          evalCycleId: evaluation.evalCycleId,
          targetId: evaluation.targetId,
          evalStage: previousStage,
        },
      },
      select: {
        id: true,
        evaluatorId: true,
      },
    })

    if (!previousEvaluation) {
      throw new AppError(404, 'PREVIOUS_EVALUATION_NOT_FOUND', '되돌릴 이전 단계 평가를 찾을 수 없습니다.')
    }

    await prisma.$transaction(async (tx) => {
      await tx.evaluation.update({
        where: { id: previousEvaluation.id },
        data: {
          status: 'REJECTED',
          isRejected: true,
          rejectionReason: validated.data.rejectionReason,
          rejectedAt: new Date(),
          isDraft: true,
          submittedAt: null,
        },
      })

      await tx.evaluation.update({
        where: { id: evaluation.id },
        data: {
          status: 'PENDING',
          totalScore: null,
          gradeId: null,
          comment: null,
          strengthComment: null,
          improvementComment: null,
          nextStepGuidance: null,
          isDraft: true,
          submittedAt: null,
          isRejected: false,
          rejectionReason: null,
          rejectedAt: null,
        },
      })

      await tx.evaluationItem.updateMany({
        where: {
          evaluationId: evaluation.id,
        },
        data: {
          quantScore: null,
          planScore: null,
          doScore: null,
          checkScore: null,
          actScore: null,
          qualScore: null,
          itemComment: null,
          weightedScore: null,
        },
      })

      await tx.notification.create({
        data: {
          recipientId: previousEvaluation.evaluatorId,
          type: 'EVAL_REJECTED',
          title: '평가 보완 요청이 도착했습니다.',
          message: `${evaluation.target.empName}님의 평가가 반려되어 이전 단계에서 다시 보완해야 합니다.`,
          link: `/evaluation/performance/${encodeURIComponent(previousEvaluation.id)}?cycleId=${encodeURIComponent(
            evaluation.evalCycleId
          )}`,
          channel: 'IN_APP',
        },
      })
    })

    await createAuditLog({
      userId: session.user.id,
      action: 'EVALUATION_RETURN_TO_PREVIOUS_STAGE',
      entityType: 'Evaluation',
      entityId: id,
      oldValue: {
        status: evaluation.status,
      },
      newValue: {
        status: 'PENDING',
        returnedToStage: previousStage,
        rejectionReason: validated.data.rejectionReason,
      },
      ...getClientInfo(request),
    })

    await createAuditLog({
      userId: session.user.id,
      action: 'EVALUATION_REOPEN_FOR_REVISION',
      entityType: 'Evaluation',
      entityId: previousEvaluation.id,
      newValue: {
        status: 'REJECTED',
        rejectionReason: validated.data.rejectionReason,
        reopenedByStage: evaluation.evalStage,
      },
      ...getClientInfo(request),
    })

    await logImpersonationRiskExecution({
      session,
      request,
      riskContext,
      success: true,
      metadata: {
        targetId: evaluation.targetId,
        previousStage,
      },
    })

    return successResponse({
      id,
      status: 'PENDING',
      previousEvaluationId: previousEvaluation.id,
      message: '평가를 반려하고 이전 단계 평가자에게 보완을 요청했습니다.',
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
