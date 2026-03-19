import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AppError, errorResponse, successResponse } from '@/lib/utils'
import { CreatePersonalKpiSchema } from '@/lib/validations'
import { canAccessEmployee } from '@/server/auth/authorize'
import { createAuditLog, getClientInfo } from '@/lib/audit'

function canManage(role: string) {
  return ['ROLE_ADMIN', 'ROLE_CEO', 'ROLE_DIV_HEAD', 'ROLE_SECTION_CHIEF', 'ROLE_TEAM_LEADER'].includes(role)
}

// GET /api/kpi/personal
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')

    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employeeId')
    const evalYear = searchParams.get('evalYear')

    let targetEmployeeId = session.user.id

    if (employeeId && employeeId !== session.user.id) {
      if (!canManage(session.user.role)) {
        throw new AppError(403, 'FORBIDDEN', '다른 직원의 개인 KPI를 조회할 권한이 없습니다.')
      }

      const targetEmployee = await prisma.employee.findUnique({
        where: { id: employeeId },
        select: { id: true, deptId: true },
      })

      if (!targetEmployee || !canAccessEmployee(session, targetEmployee)) {
        throw new AppError(403, 'FORBIDDEN', '권한 범위를 벗어난 직원입니다.')
      }

      targetEmployeeId = employeeId
    }

    const kpis = await prisma.personalKpi.findMany({
      where: {
        employeeId: targetEmployeeId,
        ...(evalYear ? { evalYear: parseInt(evalYear, 10) } : {}),
      },
      include: {
        employee: {
          include: {
            department: true,
          },
        },
        linkedOrgKpi: {
          include: {
            department: true,
          },
        },
        monthlyRecords: {
          orderBy: { yearMonth: 'desc' },
          take: 6,
        },
      },
      orderBy: [{ createdAt: 'asc' }],
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
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')

    const body = await request.json()
    const validated = CreatePersonalKpiSchema.safeParse(body)
    if (!validated.success) {
      throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0].message)
    }

    const data = validated.data

    if (data.employeeId !== session.user.id && !canManage(session.user.role)) {
      throw new AppError(403, 'FORBIDDEN', '다른 직원의 개인 KPI를 생성할 권한이 없습니다.')
    }

    if (data.employeeId !== session.user.id) {
      const targetEmployee = await prisma.employee.findUnique({
        where: { id: data.employeeId },
        select: { id: true, deptId: true },
      })

      if (!targetEmployee || !canAccessEmployee(session, targetEmployee)) {
        throw new AppError(403, 'FORBIDDEN', '권한 범위를 벗어난 직원입니다.')
      }
    }

    if (data.linkedOrgKpiId) {
      const orgKpi = await prisma.orgKpi.findUnique({
        where: { id: data.linkedOrgKpiId },
        select: {
          id: true,
          evalYear: true,
          status: true,
        },
      })

      if (!orgKpi) {
        throw new AppError(404, 'ORG_KPI_NOT_FOUND', '연결할 조직 KPI를 찾을 수 없습니다.')
      }

      if (orgKpi.evalYear !== data.evalYear) {
        throw new AppError(400, 'ORG_KPI_YEAR_MISMATCH', '같은 연도의 조직 KPI만 연결할 수 있습니다.')
      }

      if (orgKpi.status === 'ARCHIVED') {
        throw new AppError(400, 'ORG_KPI_ARCHIVED', '보관된 조직 KPI에는 연결할 수 없습니다.')
      }
    }

    const existingKpis = await prisma.personalKpi.findMany({
      where: {
        employeeId: data.employeeId,
        evalYear: data.evalYear,
        status: { not: 'ARCHIVED' },
      },
      select: {
        weight: true,
      },
    })

    const totalWeight = existingKpis.reduce((sum, item) => sum + item.weight, 0) + data.weight
    if (totalWeight > 100) {
      throw new AppError(
        400,
        'WEIGHT_EXCEEDED',
        `가중치 합계가 100을 초과합니다. 현재 ${Math.round((totalWeight - data.weight) * 10) / 10}, 추가 ${data.weight}`
      )
    }

    const kpi = await prisma.personalKpi.create({
      data: {
        ...data,
        linkedOrgKpiId: data.linkedOrgKpiId || null,
        status: 'DRAFT',
      },
      include: {
        employee: {
          include: {
            department: true,
          },
        },
        linkedOrgKpi: {
          include: {
            department: true,
          },
        },
      },
    })

    await createAuditLog({
      userId: session.user.id,
      action: 'PERSONAL_KPI_CREATED',
      entityType: 'PersonalKpi',
      entityId: kpi.id,
      newValue: {
        employeeId: kpi.employeeId,
        evalYear: kpi.evalYear,
        kpiName: kpi.kpiName,
        kpiType: kpi.kpiType,
        targetValue: kpi.targetValue,
        unit: kpi.unit,
        weight: kpi.weight,
        difficulty: kpi.difficulty,
        linkedOrgKpiId: kpi.linkedOrgKpiId,
        status: kpi.status,
      },
      ...getClientInfo(request),
    })

    return successResponse(kpi)
  } catch (error) {
    return errorResponse(error)
  }
}
