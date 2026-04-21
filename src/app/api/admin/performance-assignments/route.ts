import { createAuditLog, getClientInfo } from '@/lib/audit'
import { AdminPerformanceAssignmentActionSchema } from '@/lib/validations'
import { errorResponse, successResponse, AppError } from '@/lib/utils'
import { authorizeMenu } from '@/server/auth/authorize'
import {
  getPerformanceAssignmentPageData,
  resetPerformanceAssignmentToAuto,
  syncPerformanceAssignmentsForCycle,
  upsertPerformanceAssignment,
} from '@/server/evaluation-performance-assignments'

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
    let result: Record<string, unknown>
    let auditAction = 'PERFORMANCE_ASSIGNMENT_SYNC'
    let auditEntityId = input.evalCycleId

    if (input.action === 'sync') {
      result = await syncPerformanceAssignmentsForCycle({
        actorId: session.user.id,
        evalCycleId: input.evalCycleId,
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
      userId: session.user.id,
      action: auditAction,
      entityType: 'EvaluationAssignment',
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
