import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AppError, errorResponse, successResponse } from '@/lib/utils'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '인증이 필요합니다.')

    const scenarios = await prisma.compensationScenario.findMany({
      where: {
        status: 'FINAL_APPROVED',
        publishedAt: { not: null },
        employees: {
          some: {
            employeeId: session.user.id,
          },
        },
      },
      include: {
        evalCycle: {
          select: { cycleName: true, evalYear: true },
        },
        ruleSet: {
          select: { versionNo: true, changeReason: true },
        },
        employees: {
          where: { employeeId: session.user.id },
          take: 1,
        },
      },
      orderBy: [{ evalCycle: { evalYear: 'desc' } }, { versionNo: 'desc' }],
    })

    const payload = scenarios.map((scenario) => {
      const row = scenario.employees[0]
      return {
        scenarioId: scenario.id,
        scenarioName: scenario.scenarioName,
        versionNo: scenario.versionNo,
        status: scenario.status,
        publishedAt: scenario.publishedAt,
        evalCycle: scenario.evalCycle,
        ruleSet: scenario.ruleSet,
        row,
      }
    })

    return successResponse(payload)
  } catch (error) {
    return errorResponse(error)
  }
}
