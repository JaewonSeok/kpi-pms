import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAuditLog, getClientInfo } from '@/lib/audit'
import { buildScenarioSimulation, getActiveRuleSetOrThrow, getOrganizationOrThrow, getScenarioUpdatePayload } from '@/lib/compensation-server'
import { canManageCompensation } from '@/lib/compensation'
import { CreateCompensationScenarioSchema } from '@/lib/validations'
import { AppError, errorResponse, getCurrentYear, successResponse } from '@/lib/utils'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '인증이 필요합니다.')
    if (!canManageCompensation(session.user.role)) {
      throw new AppError(403, 'FORBIDDEN', '보상 시나리오 접근 권한이 없습니다.')
    }

    const { searchParams } = new URL(request.url)
    const evalYear = Number(searchParams.get('year') || getCurrentYear())
    const org = await getOrganizationOrThrow()

    const [cycles, activeRuleSet, scenarios] = await Promise.all([
      prisma.evalCycle.findMany({
        where: { orgId: org.id, evalYear },
        orderBy: [{ evalYear: 'desc' }, { createdAt: 'desc' }],
      }),
      prisma.compensationRuleSet.findFirst({
        where: { orgId: org.id, evalYear, isActive: true },
        include: {
          rules: {
            orderBy: { gradeName: 'asc' },
          },
        },
      }),
      prisma.compensationScenario.findMany({
        where: {
          evalCycle: { evalYear },
        },
        include: {
          evalCycle: {
            select: { id: true, cycleName: true, evalYear: true },
          },
          ruleSet: {
            select: { id: true, versionNo: true, changeReason: true },
          },
          employees: {
            select: { id: true },
          },
        },
        orderBy: [{ evalCycle: { evalYear: 'desc' } }, { versionNo: 'desc' }],
      }),
    ])

    return successResponse({
      evalYear,
      cycles,
      activeRuleSet,
      scenarios: scenarios.map((scenario) => ({
        ...scenario,
        employeeCount: scenario.employees.length,
      })),
    })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '인증이 필요합니다.')
    if (session.user.role !== 'ROLE_ADMIN') {
      throw new AppError(403, 'FORBIDDEN', 'HR 관리자만 보상 시나리오를 작성할 수 있습니다.')
    }

    const body = await request.json()
    const validated = CreateCompensationScenarioSchema.safeParse(body)
    if (!validated.success) {
      throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0].message)
    }

    const data = validated.data
    const sourceScenario = data.cloneFromScenarioId
      ? await prisma.compensationScenario.findUnique({
          where: { id: data.cloneFromScenarioId },
        })
      : null

    if (sourceScenario && sourceScenario.evalCycleId !== data.evalCycleId) {
      throw new AppError(400, 'VERSION_SOURCE_INVALID', '같은 평가 주기 안에서만 시나리오 버전을 생성할 수 있습니다.')
    }

    const simulationBundle = await buildScenarioSimulation({
      evalCycleId: data.evalCycleId,
      budgetLimit: data.budgetLimit,
      ruleSetId: data.ruleSetId ?? sourceScenario?.ruleSetId,
    })

    await getActiveRuleSetOrThrow(
      simulationBundle.cycle.orgId,
      simulationBundle.cycle.evalYear,
      data.ruleSetId ?? sourceScenario?.ruleSetId
    )

    const latestVersion = await prisma.compensationScenario.findFirst({
      where: { evalCycleId: data.evalCycleId },
      orderBy: { versionNo: 'desc' },
    })

    const scenario = await prisma.$transaction(async (tx) => {
      const created = await tx.compensationScenario.create({
        data: {
          evalCycleId: data.evalCycleId,
          ruleSetId: simulationBundle.ruleSet.id,
          scenarioName: data.scenarioName,
          versionNo: (latestVersion?.versionNo ?? 0) + 1,
          sourceScenarioId: sourceScenario?.id,
          budgetLimit: data.budgetLimit,
          createdById: session.user.id,
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

      return created
    })

    const clientInfo = getClientInfo(request)
    await createAuditLog({
      userId: session.user.id,
      action: 'COMPENSATION_SCENARIO_CREATE',
      entityType: 'CompensationScenario',
      entityId: scenario.id,
      newValue: {
        evalCycleId: data.evalCycleId,
        versionNo: scenario.versionNo,
        budgetLimit: scenario.budgetLimit,
        ruleSetVersion: scenario.ruleSet.versionNo,
        totalCost: scenario.totalCost,
      },
      ...clientInfo,
    })

    return successResponse(scenario)
  } catch (error) {
    return errorResponse(error)
  }
}
