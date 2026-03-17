import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { errorResponse, successResponse, AppError } from '@/lib/utils'
import { CreatePersonalKpiSchema } from '@/lib/validations'
import { canAccessEmployee } from '@/server/auth/authorize'

// GET /api/kpi/personal
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '인증이 필요합니다.')

    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employeeId')
    const evalYear = searchParams.get('evalYear')
    const role = session.user.role

    let targetEmployeeId = session.user.id

    if (employeeId && employeeId !== session.user.id) {
      if (
        !['ROLE_TEAM_LEADER', 'ROLE_SECTION_CHIEF', 'ROLE_DIV_HEAD', 'ROLE_CEO', 'ROLE_ADMIN'].includes(
          role
        )
      ) {
        throw new AppError(403, 'FORBIDDEN', '권한이 없습니다.')
      }

      const targetEmployee = await prisma.employee.findUnique({
        where: { id: employeeId },
        select: { id: true, deptId: true },
      })

      if (!targetEmployee || !canAccessEmployee(session, targetEmployee)) {
        throw new AppError(403, 'FORBIDDEN', '권한 범위를 벗어난 구성원입니다.')
      }

      targetEmployeeId = employeeId
    }

    const kpis = await prisma.personalKpi.findMany({
      where: {
        employeeId: targetEmployeeId,
        ...(evalYear ? { evalYear: parseInt(evalYear, 10) } : {}),
      },
      include: {
        linkedOrgKpi: {
          select: { kpiName: true, kpiCategory: true },
        },
        monthlyRecords: {
          orderBy: { yearMonth: 'asc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    return successResponse(kpis)
  } catch (error) {
    return errorResponse(error)
  }
}

// POST /api/kpi/personal
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '인증이 필요합니다.')

    const body = await request.json()
    const validated = CreatePersonalKpiSchema.safeParse(body)
    if (!validated.success) {
      throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0].message)
    }

    const data = validated.data

    if (
      data.employeeId !== session.user.id &&
      !['ROLE_TEAM_LEADER', 'ROLE_ADMIN'].includes(session.user.role)
    ) {
      throw new AppError(403, 'FORBIDDEN', '권한이 없습니다.')
    }

    if (data.employeeId !== session.user.id) {
      const targetEmployee = await prisma.employee.findUnique({
        where: { id: data.employeeId },
        select: { id: true, deptId: true },
      })

      if (!targetEmployee || !canAccessEmployee(session, targetEmployee)) {
        throw new AppError(403, 'FORBIDDEN', '권한 범위를 벗어난 구성원입니다.')
      }
    }

    const existingKpis = await prisma.personalKpi.findMany({
      where: {
        employeeId: data.employeeId,
        evalYear: data.evalYear,
        status: { not: 'ARCHIVED' },
      },
    })

    const totalWeight = existingKpis.reduce((sum, kpi) => sum + kpi.weight, 0) + data.weight
    if (totalWeight > 100) {
      throw new AppError(
        400,
        'WEIGHT_EXCEEDED',
        `가중치 합계가 100을 초과합니다. (현재: ${totalWeight - data.weight}, 추가: ${data.weight})`
      )
    }

    const kpi = await prisma.personalKpi.create({
      data: {
        ...data,
        status: 'DRAFT',
      },
    })

    return successResponse(kpi)
  } catch (error) {
    return errorResponse(error)
  }
}
