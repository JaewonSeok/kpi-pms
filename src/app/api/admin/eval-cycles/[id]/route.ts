import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { errorResponse, successResponse, AppError } from '@/lib/utils'
import { UpdateEvalCycleSchema } from '@/lib/validations'
import { createAuditLog, getClientInfo } from '@/lib/audit'

type RouteContext = {
  params: Promise<{ id: string }>
}

function toDate(value?: string) {
  return value ? new Date(value) : undefined
}

function getReadinessFailures(cycle: {
  kpiSetupStart: Date | null
  kpiSetupEnd: Date | null
  selfEvalStart: Date | null
  selfEvalEnd: Date | null
  firstEvalStart: Date | null
  firstEvalEnd: Date | null
  finalEvalStart: Date | null
  finalEvalEnd: Date | null
  resultOpenStart: Date | null
  appealDeadline: Date | null
  _count: { evaluations: number }
}) {
  const failures: string[] = []

  if (!cycle.kpiSetupStart || !cycle.kpiSetupEnd) failures.push('KPI 설정 일정이 완성되지 않았습니다.')
  if (!cycle.selfEvalStart || !cycle.selfEvalEnd) failures.push('자기 평가 일정이 완성되지 않았습니다.')
  if (!cycle.firstEvalStart || !cycle.firstEvalEnd) failures.push('1차 평가 일정이 완성되지 않았습니다.')
  if (!cycle.finalEvalStart || !cycle.finalEvalEnd) failures.push('최종 평가 일정이 완성되지 않았습니다.')
  if (!cycle.resultOpenStart) failures.push('결과 공개 시작일이 설정되지 않았습니다.')
  if (!cycle.appealDeadline) failures.push('이의 신청 마감일이 설정되지 않았습니다.')
  if (cycle._count.evaluations === 0) failures.push('생성된 평가 데이터가 없습니다.')

  return failures
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '인증이 필요합니다.')
    if (session.user.role !== 'ROLE_ADMIN') {
      throw new AppError(403, 'FORBIDDEN', '관리자 권한이 필요합니다.')
    }

    const { id } = await context.params

    const cycle = await prisma.evalCycle.findUnique({
      where: { id },
      include: {
        organization: { select: { name: true } },
        _count: { select: { evaluations: true } },
      },
    })

    if (!cycle) {
      throw new AppError(404, 'CYCLE_NOT_FOUND', '평가 주기를 찾을 수 없습니다.')
    }

    return successResponse(cycle)
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '인증이 필요합니다.')
    if (session.user.role !== 'ROLE_ADMIN') {
      throw new AppError(403, 'FORBIDDEN', '관리자 권한이 필요합니다.')
    }

    const { id } = await context.params
    const body = await request.json()
    const validated = UpdateEvalCycleSchema.safeParse(body)

    if (!validated.success) {
      throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0].message)
    }

    const data = validated.data

    const existing = await prisma.evalCycle.findUnique({
      where: { id },
      select: {
        id: true,
        kpiSetupStart: true,
        kpiSetupEnd: true,
        selfEvalStart: true,
        selfEvalEnd: true,
        firstEvalStart: true,
        firstEvalEnd: true,
        finalEvalStart: true,
        finalEvalEnd: true,
        resultOpenStart: true,
        appealDeadline: true,
        _count: { select: { evaluations: true } },
      },
    })

    if (!existing) {
      throw new AppError(404, 'CYCLE_NOT_FOUND', '평가 주기를 찾을 수 없습니다.')
    }

    const updateData = {
      ...(data.orgId ? { orgId: data.orgId } : {}),
      ...(data.evalYear !== undefined ? { evalYear: data.evalYear } : {}),
      ...(data.cycleName !== undefined ? { cycleName: data.cycleName } : {}),
      ...(data.showQuestionWeight !== undefined ? { showQuestionWeight: data.showQuestionWeight } : {}),
      ...(data.showScoreSummary !== undefined ? { showScoreSummary: data.showScoreSummary } : {}),
      ...(data.goalEditMode !== undefined ? { goalEditMode: data.goalEditMode } : {}),
      ...(data.status ? { status: data.status } : {}),
      ...(data.kpiSetupStart !== undefined ? { kpiSetupStart: toDate(data.kpiSetupStart) } : {}),
      ...(data.kpiSetupEnd !== undefined ? { kpiSetupEnd: toDate(data.kpiSetupEnd) } : {}),
      ...(data.selfEvalStart !== undefined ? { selfEvalStart: toDate(data.selfEvalStart) } : {}),
      ...(data.selfEvalEnd !== undefined ? { selfEvalEnd: toDate(data.selfEvalEnd) } : {}),
      ...(data.firstEvalStart !== undefined ? { firstEvalStart: toDate(data.firstEvalStart) } : {}),
      ...(data.firstEvalEnd !== undefined ? { firstEvalEnd: toDate(data.firstEvalEnd) } : {}),
      ...(data.secondEvalStart !== undefined ? { secondEvalStart: toDate(data.secondEvalStart) } : {}),
      ...(data.secondEvalEnd !== undefined ? { secondEvalEnd: toDate(data.secondEvalEnd) } : {}),
      ...(data.finalEvalStart !== undefined ? { finalEvalStart: toDate(data.finalEvalStart) } : {}),
      ...(data.finalEvalEnd !== undefined ? { finalEvalEnd: toDate(data.finalEvalEnd) } : {}),
      ...(data.ceoAdjustStart !== undefined ? { ceoAdjustStart: toDate(data.ceoAdjustStart) } : {}),
      ...(data.ceoAdjustEnd !== undefined ? { ceoAdjustEnd: toDate(data.ceoAdjustEnd) } : {}),
      ...(data.resultOpenStart !== undefined ? { resultOpenStart: toDate(data.resultOpenStart) } : {}),
      ...(data.resultOpenEnd !== undefined ? { resultOpenEnd: toDate(data.resultOpenEnd) } : {}),
      ...(data.appealDeadline !== undefined ? { appealDeadline: toDate(data.appealDeadline) } : {}),
    }

    const nextCycle = {
      ...existing,
      kpiSetupStart: data.kpiSetupStart !== undefined ? toDate(data.kpiSetupStart) ?? null : existing.kpiSetupStart,
      kpiSetupEnd: data.kpiSetupEnd !== undefined ? toDate(data.kpiSetupEnd) ?? null : existing.kpiSetupEnd,
      selfEvalStart: data.selfEvalStart !== undefined ? toDate(data.selfEvalStart) ?? null : existing.selfEvalStart,
      selfEvalEnd: data.selfEvalEnd !== undefined ? toDate(data.selfEvalEnd) ?? null : existing.selfEvalEnd,
      firstEvalStart: data.firstEvalStart !== undefined ? toDate(data.firstEvalStart) ?? null : existing.firstEvalStart,
      firstEvalEnd: data.firstEvalEnd !== undefined ? toDate(data.firstEvalEnd) ?? null : existing.firstEvalEnd,
      finalEvalStart: data.finalEvalStart !== undefined ? toDate(data.finalEvalStart) ?? null : existing.finalEvalStart,
      finalEvalEnd: data.finalEvalEnd !== undefined ? toDate(data.finalEvalEnd) ?? null : existing.finalEvalEnd,
      resultOpenStart: data.resultOpenStart !== undefined ? toDate(data.resultOpenStart) ?? null : existing.resultOpenStart,
      appealDeadline: data.appealDeadline !== undefined ? toDate(data.appealDeadline) ?? null : existing.appealDeadline,
    }

    if (data.status && ['RESULT_OPEN', 'APPEAL', 'CLOSED'].includes(data.status)) {
      const failures = getReadinessFailures(nextCycle)
      if (failures.length > 0) {
        throw new AppError(
          400,
          'CYCLE_NOT_READY',
          `공개 전 readiness 체크를 통과하지 못했습니다. ${failures.join(' ')}`
        )
      }
    }

    const cycle = await prisma.evalCycle.update({
      where: { id },
      data: updateData,
      include: {
        organization: { select: { name: true } },
        _count: { select: { evaluations: true } },
      },
    })

    return successResponse(cycle)
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '인증이 필요합니다.')
    if (session.user.role !== 'ROLE_ADMIN') {
      throw new AppError(403, 'FORBIDDEN', '관리자 권한이 필요합니다.')
    }

    const { id } = await context.params
    const url = new URL(request.url)
    const force = url.searchParams.get('force') === 'true'

    if (force) {
      const cycleForForce = await prisma.evalCycle.findUnique({
        where: { id },
        select: {
          id: true,
          cycleName: true,
          evalYear: true,
          _count: {
            select: {
              evaluations: true,
              multiFeedbackRounds: true,
              compensationScenarios: true,
              aiCompetencyResults: true,
            },
          },
          aiCompetencyCycle: { select: { id: true } },
          aiCompetencyGateCycle: { select: { id: true } },
        },
      })

      if (!cycleForForce) {
        throw new AppError(404, 'EVAL_CYCLE_NOT_FOUND', '평가 주기를 찾을 수 없습니다.')
      }

      if (cycleForForce._count.evaluations > 0) {
        throw new AppError(
          409,
          'EVAL_CYCLE_FORCE_DELETE_BLOCKED',
          `평가 ${cycleForForce._count.evaluations}건이 연결되어 있어 강제 삭제도 할 수 없습니다. 실제 평가 데이터는 보호됩니다.`
        )
      }

      const counts = {
        multiFeedbackRounds: cycleForForce._count.multiFeedbackRounds,
        compensationScenarios: cycleForForce._count.compensationScenarios,
        aiCompetencyResults: cycleForForce._count.aiCompetencyResults,
        hasAiCompetencyCycle: cycleForForce.aiCompetencyCycle !== null,
        hasAiCompetencyGateCycle: cycleForForce.aiCompetencyGateCycle !== null,
      }

      try {
        await prisma.$transaction(
          async (tx) => {
            // 1. FeedbackResponse (feedbackId·questionId 양쪽 Restrict FK)
            await tx.feedbackResponse.deleteMany({
              where: {
                OR: [
                  { feedback: { round: { evalCycleId: id } } },
                  { question: { round: { evalCycleId: id } } },
                ],
              },
            })
            // 2. FeedbackQuestion (roundId Restrict)
            await tx.feedbackQuestion.deleteMany({
              where: { round: { evalCycleId: id } },
            })
            // 3. MultiFeedback (roundId Restrict)
            await tx.multiFeedback.deleteMany({
              where: { round: { evalCycleId: id } },
            })
            // 4. FeedbackNomination (roundId Restrict)
            await tx.feedbackNomination.deleteMany({
              where: { round: { evalCycleId: id } },
            })
            // 5. FeedbackReportCache (roundId Restrict)
            await tx.feedbackReportCache.deleteMany({
              where: { round: { evalCycleId: id } },
            })
            // 6. MultiFeedbackRound — FeedbackRoundCollaborator·OnboardingReviewGeneration Cascade
            await tx.multiFeedbackRound.deleteMany({
              where: { evalCycleId: id },
            })
            // 7. AiCompetencyResult by evalCycleId (Restrict)
            await tx.aiCompetencyResult.deleteMany({
              where: { evalCycleId: id },
            })
            // 8. AiCompetencyGateCycle and its children (Cascade)
            await tx.aiCompetencyGateCycle.deleteMany({
              where: { evalCycleId: id },
            })
            // 9. AiCompetencyCycle and remaining children (Cascade; AiCompetencyResult already deleted)
            await tx.aiCompetencyCycle.deleteMany({
              where: { evalCycleId: id },
            })
            // 10. CompensationScenario — CompensationScenarioEmployee·CompensationApproval Cascade
            await tx.compensationScenario.deleteMany({
              where: { evalCycleId: id },
            })
            // 11. EvalCycle — EvaluationAssignment·OnboardingReviewWorkflow·MidReviewCycle·DepartmentScoreIntake Cascade
            await tx.evalCycle.delete({ where: { id } })
          },
          { timeout: 30000, maxWait: 10000 }
        )
      } catch (error) {
        const code =
          typeof error === 'object' && error && 'code' in error
            ? (error as { code?: string }).code
            : null
        if (code === 'P2003') {
          const meta =
            typeof error === 'object' && error && 'meta' in error
              ? (error as { meta?: { modelName?: string; field_name?: string } }).meta
              : null
          const location = meta?.modelName ?? meta?.field_name ?? '알 수 없는 테이블'
          throw new AppError(
            409,
            'EVAL_CYCLE_FORCE_DELETE_REFERENCE_BLOCKED',
            `${location} 테이블의 참조 제약으로 강제 삭제할 수 없습니다. 조사가 필요합니다.`
          )
        }
        throw error
      }

      await createAuditLog({
        userId: session.user.id,
        action: 'EVAL_CYCLE_FORCE_DELETE',
        entityType: 'EvalCycle',
        entityId: id,
        oldValue: {
          id: cycleForForce.id,
          cycleName: cycleForForce.cycleName,
          evalYear: cycleForForce.evalYear,
          counts,
        },
        newValue: { deleted: true, force: true },
        ...getClientInfo(request),
      })

      return successResponse({ id, counts })
    }

    const cycle = await prisma.evalCycle.findUnique({
      where: { id },
      select: {
        id: true,
        cycleName: true,
        evalYear: true,
        _count: {
          select: {
            evaluations: true,
            evaluationAssignments: true,
            multiFeedbackRounds: true,
            onboardingReviewWorkflows: true,
            compensationScenarios: true,
            aiCompetencyResults: true,
            wordCloud360Cycles: true,
            businessPlans: true,
            jobDescriptions: true,
            teamKpiRecommendationSets: true,
            teamKpiReviewRuns: true,
            midReviewCycles: true,
            departmentScoreIntakes: true,
          },
        },
        aiCompetencyCycle: { select: { id: true } },
        aiCompetencyGateCycle: { select: { id: true } },
      },
    })

    if (!cycle) {
      throw new AppError(404, 'EVAL_CYCLE_NOT_FOUND', '평가 주기를 찾을 수 없습니다.')
    }

    const blockers: string[] = []
    if (cycle._count.evaluations > 0) blockers.push(`평가 ${cycle._count.evaluations}건`)
    if (cycle._count.evaluationAssignments > 0) blockers.push(`평가자 배정 ${cycle._count.evaluationAssignments}건`)
    if (cycle._count.multiFeedbackRounds > 0) blockers.push(`360 라운드 ${cycle._count.multiFeedbackRounds}건`)
    if (cycle._count.onboardingReviewWorkflows > 0) blockers.push(`온보딩 검토 ${cycle._count.onboardingReviewWorkflows}건`)
    if (cycle._count.compensationScenarios > 0) blockers.push(`보상 시나리오 ${cycle._count.compensationScenarios}건`)
    if (cycle._count.aiCompetencyResults > 0) blockers.push(`AI 역량 결과 ${cycle._count.aiCompetencyResults}건`)
    if (cycle._count.wordCloud360Cycles > 0) blockers.push(`360 워드클라우드 ${cycle._count.wordCloud360Cycles}건`)
    if (cycle._count.businessPlans > 0) blockers.push(`사업계획 문서 ${cycle._count.businessPlans}건`)
    if (cycle._count.jobDescriptions > 0) blockers.push(`직무기술서 ${cycle._count.jobDescriptions}건`)
    if (cycle._count.teamKpiRecommendationSets > 0) blockers.push(`팀 KPI 추천 ${cycle._count.teamKpiRecommendationSets}건`)
    if (cycle._count.teamKpiReviewRuns > 0) blockers.push(`팀 KPI 검토 실행 ${cycle._count.teamKpiReviewRuns}건`)
    if (cycle._count.midReviewCycles > 0) blockers.push(`중간검토 주기 ${cycle._count.midReviewCycles}건`)
    if (cycle._count.departmentScoreIntakes > 0) blockers.push(`조직 점수 ${cycle._count.departmentScoreIntakes}건`)
    if (cycle.aiCompetencyCycle !== null) blockers.push('AI 역량 주기')
    if (cycle.aiCompetencyGateCycle !== null) blockers.push('AI 역량 게이트 주기')

    if (blockers.length > 0) {
      throw new AppError(
        409,
        'EVAL_CYCLE_DELETE_BLOCKED',
        `${blockers.join(', ')}이 남아 있어 평가 주기를 삭제할 수 없습니다. 먼저 정리해 주세요.`
      )
    }

    try {
      await prisma.evalCycle.delete({ where: { id } })
    } catch (error) {
      const code =
        typeof error === 'object' && error && 'code' in error ? (error as { code?: string }).code : null
      if (code === 'P2003') {
        throw new AppError(
          409,
          'EVAL_CYCLE_DELETE_REFERENCE_BLOCKED',
          '연결된 데이터를 정리하지 못해 평가 주기를 삭제할 수 없습니다.'
        )
      }
      throw error
    }

    await createAuditLog({
      userId: session.user.id,
      action: 'EVAL_CYCLE_DELETE',
      entityType: 'EvalCycle',
      entityId: id,
      oldValue: { id: cycle.id, cycleName: cycle.cycleName, evalYear: cycle.evalYear },
      newValue: { deleted: true },
      ...getClientInfo(request),
    })

    return successResponse({ id })
  } catch (error) {
    return errorResponse(error)
  }
}
