import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAuditLog, getClientInfo } from '@/lib/audit'
import { buildScenarioSimulation, getScenarioUpdatePayload } from '@/lib/compensation-server'
import { canManageCompensation } from '@/lib/compensation'
import { UpdateCompensationScenarioSchema } from '@/lib/validations'
import { AppError, errorResponse, successResponse } from '@/lib/utils'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '인증이 필요합니다.')
    if (!canManageCompensation(session.user.role)) {
      throw new AppError(403, 'FORBIDDEN', '보상 시나리오 접근 권한이 없습니다.')
    }

    const { id } = await params
    const scenario = await prisma.compensationScenario.findUnique({
      where: { id },
      include: {
        evalCycle: {
          select: { id: true, cycleName: true, evalYear: true },
        },
        ruleSet: {
          include: {
            rules: {
              orderBy: { gradeName: 'asc' },
            },
          },
        },
        approvals: {
          orderBy: { createdAt: 'desc' },
        },
        employees: {
          include: {
            employee: {
              select: {
                empId: true,
                empName: true,
                department: { select: { deptName: true } },
              },
            },
          },
          orderBy: [{ gradeName: 'asc' }, { bonusAmount: 'desc' }],
        },
      },
    })

    if (!scenario) {
      throw new AppError(404, 'SCENARIO_NOT_FOUND', '보상 시나리오를 찾을 수 없습니다.')
    }

    return successResponse(scenario)
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '인증이 필요합니다.')
    if (session.user.role !== 'ROLE_ADMIN') {
      throw new AppError(403, 'FORBIDDEN', 'HR 관리자만 작성 중 시나리오를 수정할 수 있습니다.')
    }

    const { id } = await params
    const scenario = await prisma.compensationScenario.findUnique({
      where: { id },
    })

    if (!scenario) {
      throw new AppError(404, 'SCENARIO_NOT_FOUND', '보상 시나리오를 찾을 수 없습니다.')
    }
    if (scenario.isLocked) {
      throw new AppError(400, 'SCENARIO_LOCKED', '잠금된 시나리오는 수정할 수 없습니다.')
    }
    if (scenario.status !== 'DRAFT' && scenario.status !== 'REJECTED') {
      throw new AppError(400, 'INVALID_STATUS', '작성 중 또는 반려 상태에서만 수정할 수 있습니다.')
    }

    const body = await request.json()
    const validated = UpdateCompensationScenarioSchema.safeParse(body)
    if (!validated.success) {
      throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0].message)
    }

    const nextBudgetLimit = validated.data.budgetLimit ?? scenario.budgetLimit
    const simulationBundle = await buildScenarioSimulation({
      evalCycleId: scenario.evalCycleId,
      budgetLimit: nextBudgetLimit,
      ruleSetId: validated.data.ruleSetId ?? scenario.ruleSetId,
    })

    const updated = await prisma.$transaction(async (tx) => {
      await tx.compensationScenarioEmployee.deleteMany({
        where: { scenarioId: scenario.id },
      })

      const result = await tx.compensationScenario.update({
        where: { id: scenario.id },
        data: {
          scenarioName: validated.data.scenarioName ?? scenario.scenarioName,
          budgetLimit: nextBudgetLimit,
          ruleSetId: simulationBundle.ruleSet.id,
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
        },
        include: {
          evalCycle: {
            select: { id: true, cycleName: true, evalYear: true },
          },
          ruleSet: {
            select: { id: true, versionNo: true },
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

    const clientInfo = getClientInfo(request)
    await createAuditLog({
      userId: session.user.id,
      action: 'COMPENSATION_SCENARIO_UPDATE',
      entityType: 'CompensationScenario',
      entityId: scenario.id,
      oldValue: {
        scenarioName: scenario.scenarioName,
        budgetLimit: scenario.budgetLimit,
        ruleSetId: scenario.ruleSetId,
      },
      newValue: {
        scenarioName: updated.scenarioName,
        budgetLimit: updated.budgetLimit,
        ruleSetId: updated.ruleSet.id,
        totalCost: updated.totalCost,
      },
      ...clientInfo,
    })

    return successResponse(updated)
  } catch (error) {
    return errorResponse(error)
  }
}
