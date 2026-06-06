import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { errorResponse, successResponse, AppError, calcPdcaScore, calcWeightedScore } from '@/lib/utils'
import { SaveEvaluationDraftSchema } from '@/lib/validations'
import { createAuditLog, getClientInfo } from '@/lib/audit'
import {
  applyBelowTargetExceptionForPersistence2026,
  shouldApplyAdjustmentRule2026,
  validateAdjustment2026,
  type BelowTargetPersistenceItem2026,
  type EvaluationAdjustmentStage,
} from '@/server/evaluation-scoring-2026'
import {
  validateDailyWorkScoreForPersistence2026,
  type EvaluationStageForDailyWorkRule2026,
} from '@/server/kpi-alignment-policy-2026'
import type { EvaluationPolicyItemCategoryCode } from '@/lib/evaluation-policy-2026'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '인증이 필요합니다.')

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

    if (!evaluation) throw new AppError(404, 'NOT_FOUND', '평가를 찾을 수 없습니다.')

    const canEdit =
      evaluation.evaluatorId === session.user.id || session.user.role === 'ROLE_ADMIN'

    if (!canEdit) {
      throw new AppError(403, 'FORBIDDEN', '초안을 수정할 권한이 없습니다.')
    }

    if (evaluation.status === 'CONFIRMED') {
      throw new AppError(400, 'LOCKED', '확정된 평가는 수정할 수 없습니다.')
    }

    const body = await request.json()
    const validated = SaveEvaluationDraftSchema.safeParse(body)
    if (!validated.success) {
      throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0]?.message ?? '입력값이 올바르지 않습니다.')
    }

    const previousSnapshot = {
      comment: evaluation.comment,
      strengthComment: evaluation.strengthComment,
      improvementComment: evaluation.improvementComment,
      nextStepGuidance: evaluation.nextStepGuidance,
      gradeId: evaluation.gradeId,
      totalScore: evaluation.totalScore,
      status: evaluation.status,
    }

    const itemMap = new Map(evaluation.items.map((item) => [item.personalKpiId, item]))
    let totalScore = 0

    // 2026 가감점 분기 — submit 라우트와 동일 게이트지만 draft는 enforceTargetGate=false
    // (작성 중이라 점수/Target 확정 전이라 below-target/precondition은 submit에 위임).
    // ±5 범위와 reason 필수는 schema(superRefine)가 이미 보장.
    const allowAdjustment = shouldApplyAdjustmentRule2026({
      cycleYear: evaluation.evalCycle.evalYear,
      evalStage: evaluation.evalStage as EvaluationAdjustmentStage,
    })

    await prisma.$transaction(async (tx) => {
      // 2-pass 구조 — below-target 예외(III-3) wiring을 위해. submit 라우트와 동일 패턴.
      // pass 1: normalizedScore 계산 + daily-work cap·가감점 검증 + collectedItems 수집
      // pass 2: helper로 effective score 산출(dormant이면 원본 그대로) → weightedScore +
      //         totalScore 합산 + EvaluationItem update
      type CollectedItem = {
        currentItem: NonNullable<ReturnType<typeof itemMap.get>>
        kpi: NonNullable<ReturnType<typeof itemMap.get>>['personalKpi']
        itemInput: (typeof validated.data.items)[number]
        normalizedScore: number | null
        adjustmentUpdate: {
          adjustmentScore?: number | null
          adjustmentGroupKey?: string | null
          adjustmentReason?: string | null
        }
      }
      const collectedItems: CollectedItem[] = []

      for (const itemInput of validated.data.items) {
        const currentItem = itemMap.get(itemInput.personalKpiId)
        if (!currentItem) continue

        const kpi = currentItem.personalKpi
        let normalizedScore: number | null = null

        if (kpi.kpiType === 'QUANTITATIVE') {
          normalizedScore = itemInput.quantScore ?? null
        } else {
          const hasAnyPdcaScore =
            itemInput.planScore != null ||
            itemInput.doScore != null ||
            itemInput.checkScore != null ||
            itemInput.actScore != null

          normalizedScore = hasAnyPdcaScore
            ? calcPdcaScore(
                itemInput.planScore ?? 0,
                itemInput.doScore ?? 0,
                itemInput.checkScore ?? 0,
                itemInput.actScore ?? 0
              )
            : null
        }

        // 2026 DAILY_WORK 점수 cap 즉시 적용 — dormant flag와 무관하게 데이터 정합성 보호.
        // 81~100 점수가 schema(0-100)를 통과해 그대로 저장되던 갭을 라우트에서 봉합.
        // category !== DAILY_WORK 또는 cycleYear !== 2026이면 helper가 즉시 skip.
        // stage gate(SELF 차단)는 dailyWorkScoringRule.active dormant 게이트 뒤로 분리.
        const dwValidation = validateDailyWorkScoreForPersistence2026({
          category: (currentItem.policyCategory ?? null) as
            | EvaluationPolicyItemCategoryCode
            | null,
          score: normalizedScore,
          evalStage: evaluation.evalStage as EvaluationStageForDailyWorkRule2026,
          cycleYear: evaluation.evalCycle.evalYear,
        })
        if (dwValidation.canSubmit === false) {
          const blocker = dwValidation.issues.find((iss) => iss.severity === 'blocker')
          throw new AppError(
            400,
            blocker?.code ?? 'DAILY_WORK_VALIDATION_FAILED',
            blocker?.message ?? '일상업무 점수 검증에 실패했습니다.'
          )
        }

        // 가감점 처리 (draft) — 카테고리/±5만 검증, Target/precondition은 submit에 위임.
        const adjustmentUpdate: {
          adjustmentScore?: number | null
          adjustmentGroupKey?: string | null
          adjustmentReason?: string | null
        } = {}
        if (allowAdjustment) {
          const inputAdjustmentScore =
            itemInput.adjustmentScore === undefined ? null : itemInput.adjustmentScore
          if (typeof inputAdjustmentScore === 'number' && inputAdjustmentScore !== 0) {
            const validation = validateAdjustment2026({
              itemId: currentItem.id,
              category: (currentItem.policyCategory ?? null) as
                | EvaluationPolicyItemCategoryCode
                | null,
              achievementLevel: currentItem.targetAchievementLevel as
                | 'BELOW_TARGET'
                | 'TARGET'
                | 'EXCELLENT'
                | null
                | undefined,
              baseScore: currentItem.basePolicyScore,
              adjustmentScore: inputAdjustmentScore,
              enforceTargetGate: false,
            })
            if (!validation.ok) {
              const firstError = validation.errors[0]
              throw new AppError(
                400,
                firstError?.code ?? 'ADJUSTMENT_VALIDATION_FAILED',
                firstError?.message ?? '가감점 검증에 실패했습니다.'
              )
            }
          }
          adjustmentUpdate.adjustmentScore = inputAdjustmentScore
          adjustmentUpdate.adjustmentGroupKey =
            itemInput.adjustmentGroupKey === undefined ? null : itemInput.adjustmentGroupKey
          adjustmentUpdate.adjustmentReason =
            itemInput.adjustmentReason === undefined ? null : itemInput.adjustmentReason
        }

        collectedItems.push({ currentItem, kpi, itemInput, normalizedScore, adjustmentUpdate })
      }

      // III-3 below-target 예외 — dormant이면 effective=원본, active이면 ORG_GOAL 매칭만 80.
      // normalizedScore가 null인 항목은 helper Map에 안 들어가고 fallback으로 그대로 null 유지.
      const belowTargetItems: BelowTargetPersistenceItem2026[] = collectedItems.map((collected) => ({
        id: collected.currentItem.id,
        category: (collected.currentItem.policyCategory ?? null) as
          | EvaluationPolicyItemCategoryCode
          | null,
        normalizedScore: collected.normalizedScore,
        linkedOrgKpiId: collected.kpi.linkedOrgKpiId,
        achievementLevel: collected.currentItem.targetAchievementLevel as
          | 'BELOW_TARGET'
          | 'TARGET'
          | 'EXCELLENT'
          | null,
      }))
      const belowTargetEffective = applyBelowTargetExceptionForPersistence2026({
        items: belowTargetItems,
        cycleYear: evaluation.evalCycle.evalYear,
      })

      // pass 2: effective score로 weightedScore + totalScore 합산 + EvaluationItem update.
      // raw 입력(quantScore/PDCA/qualScore)은 보존, weightedScore만 effective 기반.
      for (const collected of collectedItems) {
        const { currentItem, kpi, itemInput, normalizedScore, adjustmentUpdate } = collected
        const effectiveScore = belowTargetEffective.get(currentItem.id) ?? normalizedScore
        const weightedScore =
          effectiveScore == null ? null : calcWeightedScore(effectiveScore, kpi.weight)
        totalScore += weightedScore ?? 0

        await tx.evaluationItem.update({
          where: { id: currentItem.id },
          data: {
            quantScore: itemInput.quantScore ?? null,
            planScore: itemInput.planScore ?? null,
            doScore: itemInput.doScore ?? null,
            checkScore: itemInput.checkScore ?? null,
            actScore: itemInput.actScore ?? null,
            qualScore: kpi.kpiType === 'QUALITATIVE' ? normalizedScore : null,
            itemComment: itemInput.itemComment ?? null,
            weightedScore,
            ...adjustmentUpdate,
          },
        })
      }

      await tx.evaluation.update({
        where: { id },
        data: {
          comment: validated.data.comment ?? null,
          strengthComment: validated.data.strengthComment ?? null,
          improvementComment: validated.data.improvementComment ?? null,
          nextStepGuidance: validated.data.nextStepGuidance ?? null,
          gradeId: validated.data.gradeId ?? null,
          totalScore,
          status: 'IN_PROGRESS',
          isDraft: true,
          isRejected: false,
          rejectionReason: null,
          rejectedAt: null,
        },
      })
    })

    const clientInfo = getClientInfo(request)
    await createAuditLog({
      userId: session.user.id,
      action: 'EVALUATION_SAVE_DRAFT',
      entityType: 'Evaluation',
      entityId: id,
      oldValue: previousSnapshot,
      newValue: {
        comment: validated.data.comment ?? null,
        strengthComment: validated.data.strengthComment ?? null,
        improvementComment: validated.data.improvementComment ?? null,
        nextStepGuidance: validated.data.nextStepGuidance ?? null,
        gradeId: validated.data.gradeId ?? null,
        totalScore,
        status: 'IN_PROGRESS',
      },
      ...clientInfo,
    })

    return successResponse({
      id,
      totalScore,
      status: 'IN_PROGRESS',
      message: '평가 초안을 저장했습니다.',
    })
  } catch (error) {
    return errorResponse(error)
  }
}
