import { createAuditLog, getClientInfo, resolveAuditActor } from '@/lib/audit'
import { AdminPerformanceAssignmentActionSchema } from '@/lib/validations'
import { errorResponse, successResponse, AppError } from '@/lib/utils'
import { authorizeMenu } from '@/server/auth/authorize'
import {
  getPerformanceAssignmentPageData,
  planPerformanceAssignmentSync,
  resetPerformanceAssignmentToAuto,
  syncPerformanceAssignmentsForCycle,
  upsertPerformanceAssignment,
} from '@/server/evaluation-performance-assignments'
import { planSelfEvaluationPopulation, runSelfEvaluationPopulation } from '@/server/evaluation-self-population'

export const maxDuration = 300

export async function GET(request: Request) {
  try {
    const session = await authorizeMenu('EVAL_CYCLE')
    const { searchParams } = new URL(request.url)
    const cycleId = searchParams.get('cycleId') ?? undefined

    return successResponse(
      await getPerformanceAssignmentPageData({
        actorId: session.user.id,
        actorRole: session.user.role,
        cycleId,
      })
    )
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const session = await authorizeMenu('EVAL_CYCLE')
    const body = await request.json()
    const validated = AdminPerformanceAssignmentActionSchema.safeParse(body)

    if (!validated.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        validated.error.issues[0]?.message || '평가 배정 요청이 올바르지 않습니다.'
      )
    }

    const input = validated.data

    // 미리보기는 계획과 지문만 돌려준다. 아무것도 쓰지 않으므로 감사 로그도 남기지 않는다.
    if (input.action === 'syncPreview') {
      return successResponse({
        plan: await planPerformanceAssignmentSync({ evalCycleId: input.evalCycleId }),
      })
    }

    if (input.action === 'populationPreview') {
      return successResponse({
        plan: await planSelfEvaluationPopulation({ evalCycleId: input.evalCycleId }),
      })
    }

    let result: Record<string, unknown>
    let auditAction = 'PERFORMANCE_ASSIGNMENT_SYNC'
    let auditEntityType = 'EvaluationAssignment'
    let auditEntityId = input.evalCycleId

    if (input.action === 'population') {
      // 감사 로그 1건: 생성 · 건너뜀 · 확정 KPI 없음 건수, 직원 id 목록, 지문(반환값이 펼쳐진다).
      auditAction = 'SELF_EVALUATION_POPULATION'
      auditEntityType = 'Evaluation'
      result = await runSelfEvaluationPopulation({
        evalCycleId: input.evalCycleId,
        fingerprint: input.fingerprint ?? null,
      })
    } else if (input.action === 'sync') {
      result = await syncPerformanceAssignmentsForCycle({
        actorId: session.user.id,
        evalCycleId: input.evalCycleId,
        fingerprint: input.fingerprint ?? null,
      })
    } else if (input.action === 'override') {
      auditAction = 'PERFORMANCE_ASSIGNMENT_OVERRIDE'
      auditEntityId = `${input.evalCycleId}:${input.targetId}:${input.evalStage}`
      result = await upsertPerformanceAssignment({
        actorId: session.user.id,
        evalCycleId: input.evalCycleId,
        targetId: input.targetId,
        evalStage: input.evalStage,
        evaluatorId: input.evaluatorId,
        note: input.note,
      })
    } else {
      auditAction = 'PERFORMANCE_ASSIGNMENT_RESET'
      auditEntityId = `${input.evalCycleId}:${input.targetId}:${input.evalStage}`
      result = await resetPerformanceAssignmentToAuto({
        actorId: session.user.id,
        evalCycleId: input.evalCycleId,
        targetId: input.targetId,
        evalStage: input.evalStage,
      })
    }

    await createAuditLog({
      ...resolveAuditActor(session),
      action: auditAction,
      entityType: auditEntityType,
      entityId: auditEntityId,
      newValue: {
        action: input.action,
        ...result,
      },
      ...getClientInfo(request),
    })

    return successResponse({
      result,
      page: await getPerformanceAssignmentPageData({
        actorId: session.user.id,
        actorRole: session.user.role,
        cycleId: input.evalCycleId,
      }),
    })
  } catch (error) {
    return errorResponse(error)
  }
}
