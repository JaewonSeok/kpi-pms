import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAuditLog, getClientInfo } from '@/lib/audit'
import { buildScenarioSimulation, getScenarioUpdatePayload } from '@/lib/compensation-server'
import { canManageCompensation, resolveWorkflowTransition } from '@/lib/compensation'
import { CompensationWorkflowSchema } from '@/lib/validations'
import { AppError, errorResponse, successResponse } from '@/lib/utils'

function getWorkflowTransitionOrThrow(params: Parameters<typeof resolveWorkflowTransition>[0]) {
  try {
    return resolveWorkflowTransition(params)
  } catch (error) {
    if (error instanceof Error) {
      const mapping: Record<string, AppError> = {
        FORBIDDEN: new AppError(403, 'FORBIDDEN', '해당 워크플로를 실행할 권한이 없습니다.'),
        SCENARIO_LOCKED: new AppError(400, 'SCENARIO_LOCKED', '잠금된 시나리오는 변경할 수 없습니다.'),
        INVALID_STATUS: new AppError(400, 'INVALID_STATUS', '현재 상태에서는 해당 작업을 수행할 수 없습니다.'),
        BUDGET_EXCEEDED: new AppError(400, 'BUDGET_EXCEEDED', '총예산 한도를 초과하여 승인할 수 없습니다.'),
        LATEST_RULES_NOT_APPLIED: new AppError(400, 'LATEST_RULES_NOT_APPLIED', '최신 보상 규칙이 반영되지 않았습니다. 재계산 후 진행해 주세요.'),
      }

      if (mapping[error.message]) {
        throw mapping[error.message]
      }
    }

    throw error
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '인증이 필요합니다.')
    if (!canManageCompensation(session.user.role)) {
      throw new AppError(403, 'FORBIDDEN', '보상 워크플로 권한이 없습니다.')
    }

    const { id } = await params
    const body = await request.json()
    const validated = CompensationWorkflowSchema.safeParse(body)
    if (!validated.success) {
      throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0].message)
    }

    const scenario = await prisma.compensationScenario.findUnique({
      where: { id },
      include: {
        evalCycle: true,
      },
    })

    if (!scenario) {
      throw new AppError(404, 'SCENARIO_NOT_FOUND', '보상 시나리오를 찾을 수 없습니다.')
    }

    if (validated.data.action === 'RECALCULATE') {
      const transition = getWorkflowTransitionOrThrow({
        action: validated.data.action,
        actorRole: session.user.role,
        currentStatus: scenario.status,
        isLocked: scenario.isLocked,
        isOverBudget: scenario.isOverBudget,
        needsRecalculation: scenario.needsRecalculation,
      })

      const simulationBundle = await buildScenarioSimulation({
        evalCycleId: scenario.evalCycleId,
        budgetLimit: scenario.budgetLimit,
        ruleSetId: scenario.ruleSetId,
      })

      const updated = await prisma.$transaction(async (tx) => {
        await tx.compensationScenarioEmployee.deleteMany({
          where: { scenarioId: scenario.id },
        })

        const result = await tx.compensationScenario.update({
          where: { id: scenario.id },
          data: {
            status: transition.nextStatus,
            ...getScenarioUpdatePayload(simulationBundle.simulation),
            employees: {
              create: simulationBundle.simulation.rows.map((row) => ({
                employeeId: row.employeeId,
                evaluationId: row.evaluationId,
                gradeName: row.gradeName,
                currentSalary: row.currentSalary,
                bonusRate: row.bonusRate,
                salaryIncreaseRate: row.salaryIncreaseRate,
                bonusAmount: row.bonusAmount,
                salaryIncreaseAmount: row.salaryIncreaseAmount,
                projectedSalary: row.projectedSalary,
                projectedTotalCompensation: row.projectedTotalCompensation,
                sourceRuleId: row.sourceRuleId,
                sourceRuleVersionNo: row.sourceRuleVersionNo,
                calculationNote: row.calculationNote,
              })),
            },
            approvals: {
              create: {
                actorId: session.user.id,
                actorRole: session.user.role,
                action: 'RECALCULATE',
                fromStatus: scenario.status,
                toStatus: transition.nextStatus,
                comment: validated.data.comment,
              },
            },
          },
          include: {
            evalCycle: {
              select: { id: true, cycleName: true, evalYear: true },
            },
            ruleSet: {
              select: { id: true, versionNo: true },
            },
            approvals: {
              orderBy: { createdAt: 'desc' },
            },
            employees: {
              include: {
                employee: {
                  select: { empName: true, empId: true },
                },
              },
              orderBy: [{ gradeName: 'asc' }, { bonusAmount: 'desc' }],
            },
          },
        })

        return result
      })

      return successResponse(updated)
    }

    const transition = getWorkflowTransitionOrThrow({
      action: validated.data.action,
      actorRole: session.user.role,
      currentStatus: scenario.status,
      isLocked: scenario.isLocked,
      isOverBudget: scenario.isOverBudget,
      needsRecalculation: scenario.needsRecalculation,
    })

    const updated = await prisma.compensationScenario.update({
      where: { id: scenario.id },
      data: {
        status: transition.nextStatus,
        isLocked: transition.shouldLock || scenario.isLocked,
        lockReason:
          validated.data.action === 'LOCK'
            ? validated.data.comment ?? '수동 잠금'
            : transition.shouldLock
              ? '최종 승인 시 자동 잠금'
              : scenario.lockReason,
        lockedAt:
          transition.shouldLock || validated.data.action === 'LOCK'
            ? new Date()
            : scenario.lockedAt,
        reviewedById:
          validated.data.action === 'REVIEW_APPROVE' ? session.user.id : scenario.reviewedById,
        approvedById:
          validated.data.action === 'FINAL_APPROVE' ? session.user.id : scenario.approvedById,
        rejectedById:
          validated.data.action === 'REJECT' ? session.user.id : scenario.rejectedById,
        publishedAt:
          transition.shouldPublish ? new Date() : scenario.publishedAt,
        approvals:
          validated.data.action === 'PUBLISH'
            ? undefined
            : {
                create: {
                  actorId: session.user.id,
                  actorRole: session.user.role,
                  action: validated.data.action,
                  fromStatus: scenario.status,
                  toStatus: transition.nextStatus,
                  comment: validated.data.comment,
                },
              },
      },
      include: {
        evalCycle: {
          select: { id: true, cycleName: true, evalYear: true },
        },
        ruleSet: {
          select: { id: true, versionNo: true },
        },
        approvals: {
          orderBy: { createdAt: 'desc' },
        },
        employees: {
          include: {
            employee: {
              select: { empName: true, empId: true },
            },
          },
          orderBy: [{ gradeName: 'asc' }, { bonusAmount: 'desc' }],
        },
      },
    })

    const clientInfo = getClientInfo(request)
    await createAuditLog({
      userId: session.user.id,
      action: `COMPENSATION_${validated.data.action}`,
      entityType: 'CompensationScenario',
      entityId: scenario.id,
      oldValue: {
        status: scenario.status,
        isLocked: scenario.isLocked,
      },
      newValue: {
        status: updated.status,
        isLocked: updated.isLocked,
        publishedAt: updated.publishedAt,
      },
      ...clientInfo,
    })

    return successResponse(updated)
  } catch (error) {
    return errorResponse(error)
  }
}
