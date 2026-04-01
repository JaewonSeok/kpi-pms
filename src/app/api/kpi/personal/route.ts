import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canManagePersonalKpi } from '@/lib/personal-kpi-access'
import { AppError, errorResponse, successResponse } from '@/lib/utils'
import { CreatePersonalKpiSchema } from '@/lib/validations'
import { canAccessEmployee } from '@/server/auth/authorize'
import { createAuditLog, getClientInfo } from '@/lib/audit'
import { validatePersonalOrgLink } from '@/server/goal-alignment'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')

    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employeeId')
    const evalYear = searchParams.get('evalYear')

    let targetEmployeeId = session.user.id

    if (employeeId && employeeId !== session.user.id) {
      if (!canManagePersonalKpi(session.user.role)) {
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

    if (data.employeeId !== session.user.id && !canManagePersonalKpi(session.user.role)) {
      throw new AppError(403, 'FORBIDDEN', '다른 직원의 개인 KPI를 생성할 권한이 없습니다.')
    }

    let targetEmployeeDeptId = session.user.deptId
    if (data.employeeId !== session.user.id) {
      const targetEmployee = await prisma.employee.findUnique({
        where: { id: data.employeeId },
        select: { id: true, deptId: true },
      })

      if (!targetEmployee || !canAccessEmployee(session, targetEmployee)) {
        throw new AppError(403, 'FORBIDDEN', '권한 범위를 벗어난 직원입니다.')
      }

      targetEmployeeDeptId = targetEmployee.deptId
    }

    const targetDepartment = await prisma.department.findUnique({
      where: { id: targetEmployeeDeptId },
      select: { orgId: true },
    })

    const targetCycle = targetDepartment
      ? await prisma.evalCycle.findFirst({
          where: {
            orgId: targetDepartment.orgId,
            evalYear: data.evalYear,
          },
          orderBy: { createdAt: 'desc' },
          select: { goalEditMode: true },
        })
      : null

    if (targetCycle?.goalEditMode === 'CHECKIN_ONLY') {
      throw new AppError(
        400,
        'GOAL_EDIT_LOCKED',
        '현재 주기는 읽기 전용 모드입니다. 목표 생성/수정은 막혀 있으며 체크인과 코멘트만 허용됩니다.'
      )
    }

    const linkedOrgKpiId = await validatePersonalOrgLink({
      linkedOrgKpiId: data.linkedOrgKpiId ?? null,
      targetEvalYear: data.evalYear,
      targetEmployeeDeptId,
    })

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
        linkedOrgKpiId,
        tags: data.tags ?? [],
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
        tags: kpi.tags,
        status: kpi.status,
      },
      ...getClientInfo(request),
    })

    return successResponse(kpi)
  } catch (error) {
    return errorResponse(error)
  }
}
