import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { errorResponse, successResponse, AppError } from '@/lib/utils'

// GET /api/evaluation - 내 평가 현황 (피평가자 or 평가자)
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '인증이 필요합니다.')

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'target' // 'target' | 'evaluator'

    if (type === 'target') {
      // 나를 대상으로 하는 평가
      const evaluations = await prisma.evaluation.findMany({
        where: { targetId: session.user.id },
        include: {
          evalCycle: { select: { cycleName: true, evalYear: true, status: true } },
          evaluator: { select: { empName: true, position: true } },
          items: {
            include: {
              personalKpi: { select: { kpiName: true, kpiType: true, weight: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      })
      return successResponse(evaluations)
    } else {
      // 내가 평가해야 할 대상
      const evaluations = await prisma.evaluation.findMany({
        where: {
          evaluatorId: session.user.id,
          status: { in: ['PENDING', 'IN_PROGRESS', 'REJECTED'] },
        },
        include: {
          evalCycle: { select: { cycleName: true, evalYear: true } },
          target: {
            select: {
              empName: true, empId: true, position: true,
              department: { select: { deptName: true } },
            },
          },
          items: true,
        },
        orderBy: { createdAt: 'desc' },
      })
      return successResponse(evaluations)
    }
  } catch (error) {
    return errorResponse(error)
  }
}

// POST /api/evaluation - 자기평가 시작
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '인증이 필요합니다.')

    const body = await request.json()
    const { evalCycleId } = body

    if (!evalCycleId) throw new AppError(400, 'MISSING_CYCLE', '평가 주기 ID가 없습니다.')

    // 평가 주기 확인
    const cycle = await prisma.evalCycle.findUnique({
      where: { id: evalCycleId },
    })
    if (!cycle) throw new AppError(404, 'CYCLE_NOT_FOUND', '평가 주기를 찾을 수 없습니다.')
    if (cycle.status !== 'SELF_EVAL') {
      throw new AppError(400, 'INVALID_CYCLE_STATUS', '자기평가 기간이 아닙니다.')
    }

    // 이미 자기평가가 있는지 확인
    const existing = await prisma.evaluation.findUnique({
      where: {
        evalCycleId_targetId_evalStage: {
          evalCycleId,
          targetId: session.user.id,
          evalStage: 'SELF',
        },
      },
    })
    if (existing) throw new AppError(409, 'ALREADY_EXISTS', '이미 자기평가가 존재합니다.')

    // 개인 KPI 조회
    const kpis = await prisma.personalKpi.findMany({
      where: {
        employeeId: session.user.id,
        evalYear: cycle.evalYear,
        status: 'CONFIRMED',
      },
    })
    if (kpis.length === 0) {
      throw new AppError(400, 'NO_KPI', '확정된 KPI가 없습니다. 먼저 KPI를 설정하고 확정해주세요.')
    }

    // 자기평가 생성 (평가자 = 본인)
    const evaluation = await prisma.evaluation.create({
      data: {
        evalCycleId,
        targetId: session.user.id,
        evaluatorId: session.user.id,
        evalStage: 'SELF',
        status: 'IN_PROGRESS',
        isDraft: true,
        items: {
          create: kpis.map(kpi => ({
            personalKpiId: kpi.id,
          })),
        },
      },
      include: {
        items: {
          include: {
            personalKpi: true,
          },
        },
      },
    })

    return successResponse(evaluation)
  } catch (error) {
    return errorResponse(error)
  }
}
