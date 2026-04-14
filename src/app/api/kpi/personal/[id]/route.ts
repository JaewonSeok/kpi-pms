import { getServerSession, type Session } from 'next-auth'
import { authOptions } from '@/lib/auth'
import {
  canManagePersonalKpi,
  getPersonalKpiScopeDepartmentIds,
} from '@/lib/personal-kpi-access'
import { prisma } from '@/lib/prisma'
import { AppError, errorResponse, successResponse } from '@/lib/utils'
import { DeletePersonalKpiSchema, UpdatePersonalKpiSchema } from '@/lib/validations'
import { createAuditLog, getClientInfo } from '@/lib/audit'
import {
  canEditPersonalKpiByOperationalStatus,
  resolvePersonalKpiOperationalStatus,
} from '@/server/personal-kpi-workflow'
import { canAccessEmployee } from '@/server/auth/authorize'
import { validatePersonalOrgLink } from '@/server/goal-alignment'
import { deletePersonalKpiRecord } from '@/server/personal-kpi-delete'

type RouteContext = {
  params: Promise<{ id: string }>
}

function getScopeDepartmentIds(session: Session | null) {
  if (!session) return []
  return getPersonalKpiScopeDepartmentIds({
    role: session.user.role,
    deptId: session.user.deptId,
    accessibleDepartmentIds: session.user.accessibleDepartmentIds,
  })
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')

    const { id } = await context.params
    const scopeDepartmentIds = getScopeDepartmentIds(session)

    const kpi = await prisma.personalKpi.findUnique({
      where: { id },
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
    })

    if (!kpi) {
      throw new AppError(404, 'PERSONAL_KPI_NOT_FOUND', '개인 KPI를 찾을 수 없습니다.')
    }

    if (scopeDepartmentIds && !scopeDepartmentIds.includes(kpi.employee.deptId) && session.user.id !== kpi.employeeId) {
      throw new AppError(403, 'FORBIDDEN', '권한 범위를 벗어난 개인 KPI입니다.')
    }

    const auditLogs = await prisma.auditLog.findMany({
      where: {
        entityType: 'PersonalKpi',
        entityId: id,
      },
      orderBy: { timestamp: 'desc' },
      take: 40,
    })

    return successResponse({
      ...kpi,
      auditLogs,
    })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')

    const { id } = await context.params
    const body = await request.json()
    const validated = UpdatePersonalKpiSchema.safeParse(body)
    if (!validated.success) {
      throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0].message)
    }

    const data = validated.data
    const current = await prisma.personalKpi.findUnique({
      where: { id },
      include: {
        employee: {
          include: {
            department: true,
          },
        },
      },
    })

    if (!current) {
      throw new AppError(404, 'PERSONAL_KPI_NOT_FOUND', '개인 KPI를 찾을 수 없습니다.')
    }

    const scopeDepartmentIds = getScopeDepartmentIds(session)
    const canManageTarget =
      current.employeeId === session.user.id ||
      session.user.role === 'ROLE_ADMIN' ||
      session.user.role === 'ROLE_CEO' ||
      (scopeDepartmentIds?.includes(current.employee.deptId) ?? true)

    if (!canManageTarget) {
      throw new AppError(403, 'FORBIDDEN', '권한 범위를 벗어난 개인 KPI입니다.')
    }

    const workflowLogs = await prisma.auditLog.findMany({
      where: {
        entityType: 'PersonalKpi',
        entityId: id,
      },
      orderBy: {
        timestamp: 'desc',
      },
      take: 30,
    })

    const operationalStatus = resolvePersonalKpiOperationalStatus({
      status: current.status,
      logs: workflowLogs,
    })

    const hasFieldUpdates =
      data.employeeId !== undefined ||
      data.evalYear !== undefined ||
      data.kpiType !== undefined ||
      data.kpiName !== undefined ||
      data.definition !== undefined ||
      data.formula !== undefined ||
      data.targetValue !== undefined ||
      data.unit !== undefined ||
      data.weight !== undefined ||
      data.difficulty !== undefined ||
      data.tags !== undefined ||
      data.linkedOrgKpiId !== undefined

    if (hasFieldUpdates && !canEditPersonalKpiByOperationalStatus(operationalStatus)) {
      throw new AppError(
        400,
        'PERSONAL_KPI_LOCKED',
        '초안 상태의 개인 KPI만 수정할 수 있습니다. 제출 또는 확정된 KPI는 먼저 재오픈해 주세요.'
      )
    }

    const nextEmployeeId = data.employeeId ?? current.employeeId
    const nextEvalYear = data.evalYear ?? current.evalYear
    const nextWeight = data.weight ?? current.weight

    if (nextEmployeeId !== current.employeeId && !canManagePersonalKpi(session.user.role)) {
      throw new AppError(403, 'FORBIDDEN', '다른 직원으로 KPI를 이동할 권한이 없습니다.')
    }

    let nextEmployeeDeptId = current.employee.deptId
    if (nextEmployeeId !== current.employeeId) {
      const targetEmployee = await prisma.employee.findUnique({
        where: { id: nextEmployeeId },
        select: { id: true, deptId: true },
      })

      if (!targetEmployee || !canAccessEmployee(session, targetEmployee)) {
        throw new AppError(403, 'FORBIDDEN', '권한 범위를 벗어난 직원입니다.')
      }

      nextEmployeeDeptId = targetEmployee.deptId
    }

    const nextDepartment = await prisma.department.findUnique({
      where: { id: nextEmployeeDeptId },
      select: { orgId: true },
    })

    const targetCycle = nextDepartment
      ? await prisma.evalCycle.findFirst({
          where: {
            orgId: nextDepartment.orgId,
            evalYear: nextEvalYear,
          },
          orderBy: { createdAt: 'desc' },
          select: { goalEditMode: true },
        })
      : null

    const linkedOrgKpiId =
      data.linkedOrgKpiId !== undefined || data.employeeId !== undefined || data.evalYear !== undefined
        ? await validatePersonalOrgLink({
            linkedOrgKpiId:
              data.linkedOrgKpiId !== undefined ? data.linkedOrgKpiId ?? null : current.linkedOrgKpiId,
            targetEvalYear: nextEvalYear,
            targetEmployeeDeptId: nextEmployeeDeptId,
          })
        : current.linkedOrgKpiId

    if ((hasFieldUpdates || data.status === 'ARCHIVED') && targetCycle?.goalEditMode === 'CHECKIN_ONLY') {
      throw new AppError(
        400,
        'GOAL_EDIT_LOCKED',
        '현재 주기는 읽기 전용 모드입니다. 목표 생성/수정/삭제는 막혀 있으며 체크인과 코멘트만 허용됩니다.'
      )
    }

    if (hasFieldUpdates || data.employeeId !== undefined || data.evalYear !== undefined || data.weight !== undefined) {
      const related = await prisma.personalKpi.findMany({
        where: {
          employeeId: nextEmployeeId,
          evalYear: nextEvalYear,
          id: { not: id },
          status: { not: 'ARCHIVED' },
        },
        select: { weight: true },
      })

      const totalWeight = related.reduce((sum, item) => sum + item.weight, 0) + nextWeight
      if (totalWeight > 100) {
        throw new AppError(
          400,
          'WEIGHT_EXCEEDED',
          `가중치 합계가 100을 초과합니다. 변경 후 ${Math.round(totalWeight * 10) / 10}`
        )
      }
    }

    if (data.status === 'CONFIRMED' && !canManagePersonalKpi(session.user.role)) {
      throw new AppError(403, 'FORBIDDEN', '확정 상태로 변경할 권한이 없습니다.')
    }

    if (data.status === 'ARCHIVED' && !canManagePersonalKpi(session.user.role)) {
      throw new AppError(403, 'FORBIDDEN', '보관 처리 권한이 없습니다.')
    }

    const updated = await prisma.personalKpi.update({
      where: { id },
      data: {
        ...(data.employeeId !== undefined ? { employeeId: data.employeeId } : {}),
        ...(data.evalYear !== undefined ? { evalYear: data.evalYear } : {}),
        ...(data.kpiType !== undefined ? { kpiType: data.kpiType } : {}),
        ...(data.kpiName !== undefined ? { kpiName: data.kpiName } : {}),
        ...(data.definition !== undefined ? { definition: data.definition || null } : {}),
        ...(data.formula !== undefined ? { formula: data.formula || null } : {}),
        ...(data.targetValue !== undefined ? { targetValue: data.targetValue } : {}),
        ...(data.unit !== undefined ? { unit: data.unit || null } : {}),
        ...(data.weight !== undefined ? { weight: data.weight } : {}),
        ...(data.difficulty !== undefined ? { difficulty: data.difficulty } : {}),
        ...(data.tags !== undefined ? { tags: data.tags } : {}),
        ...(data.linkedOrgKpiId !== undefined || data.employeeId !== undefined || data.evalYear !== undefined
          ? { linkedOrgKpiId }
          : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
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
    })

    await createAuditLog({
      userId: session.user.id,
      action: data.status && data.status !== current.status ? 'PERSONAL_KPI_STATUS_CHANGED' : 'PERSONAL_KPI_UPDATED',
      entityType: 'PersonalKpi',
      entityId: id,
      oldValue: {
        employeeId: current.employeeId,
        evalYear: current.evalYear,
        kpiType: current.kpiType,
        kpiName: current.kpiName,
        definition: current.definition,
        formula: current.formula,
        targetValue: current.targetValue,
        unit: current.unit,
        weight: current.weight,
        difficulty: current.difficulty,
        tags: current.tags,
        linkedOrgKpiId: current.linkedOrgKpiId,
        status: current.status,
        workflowStatus: operationalStatus,
      },
      newValue: {
        employeeId: updated.employeeId,
        evalYear: updated.evalYear,
        kpiType: updated.kpiType,
        kpiName: updated.kpiName,
        definition: updated.definition,
        formula: updated.formula,
        targetValue: updated.targetValue,
        unit: updated.unit,
        weight: updated.weight,
        difficulty: updated.difficulty,
        tags: updated.tags,
        linkedOrgKpiId: updated.linkedOrgKpiId,
        status: updated.status,
      },
      ...getClientInfo(request),
    })

    return successResponse(updated)
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')

    const { id } = await context.params
    const body = await request.json()
    const validated = DeletePersonalKpiSchema.safeParse(body)
    if (!validated.success) {
      throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0].message)
    }

    const result = await deletePersonalKpiRecord({
      id,
      actor: {
        id: session.user.id,
        role: session.user.role,
        deptId: session.user.deptId,
        accessibleDepartmentIds: session.user.accessibleDepartmentIds ?? [],
      },
      clientInfo: getClientInfo(request),
    })

    return successResponse(result)
  } catch (error) {
    return errorResponse(error)
  }
}
