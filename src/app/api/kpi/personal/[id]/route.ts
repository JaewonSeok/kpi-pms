import { getServerSession, type Session } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AppError, errorResponse, successResponse } from '@/lib/utils'
import { UpdatePersonalKpiSchema } from '@/lib/validations'
import { createAuditLog, getClientInfo } from '@/lib/audit'
import {
  canEditPersonalKpiByOperationalStatus,
  resolvePersonalKpiOperationalStatus,
} from '@/server/personal-kpi-workflow'

type RouteContext = {
  params: Promise<{ id: string }>
}

function canManage(role: string) {
  return ['ROLE_ADMIN', 'ROLE_CEO', 'ROLE_DIV_HEAD', 'ROLE_SECTION_CHIEF', 'ROLE_TEAM_LEADER'].includes(role)
}

function getScopeDepartmentIds(session: Session | null) {
  if (!session) return []
  if (session.user.role === 'ROLE_ADMIN' || session.user.role === 'ROLE_CEO') return null
  if (session.user.role === 'ROLE_MEMBER') return [session.user.deptId]
  return session.user.accessibleDepartmentIds.length
    ? session.user.accessibleDepartmentIds
    : [session.user.deptId]
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

    if (nextEmployeeId !== current.employeeId && !canManage(session.user.role)) {
      throw new AppError(403, 'FORBIDDEN', '다른 직원으로 KPI를 이동할 권한이 없습니다.')
    }

    if (data.linkedOrgKpiId) {
      const orgKpi = await prisma.orgKpi.findUnique({
        where: { id: data.linkedOrgKpiId },
        select: { id: true, evalYear: true, status: true },
      })

      if (!orgKpi) {
        throw new AppError(404, 'ORG_KPI_NOT_FOUND', '연결할 조직 KPI를 찾을 수 없습니다.')
      }

      if (orgKpi.evalYear !== nextEvalYear) {
        throw new AppError(400, 'ORG_KPI_YEAR_MISMATCH', '같은 연도의 조직 KPI만 연결할 수 있습니다.')
      }

      if (orgKpi.status === 'ARCHIVED') {
        throw new AppError(400, 'ORG_KPI_ARCHIVED', '보관된 조직 KPI에는 연결할 수 없습니다.')
      }
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

    if (data.status === 'CONFIRMED' && !canManage(session.user.role)) {
      throw new AppError(403, 'FORBIDDEN', '확정 상태로 변경할 권한이 없습니다.')
    }

    if (data.status === 'ARCHIVED' && !canManage(session.user.role)) {
      throw new AppError(403, 'FORBIDDEN', '보관 처리할 권한이 없습니다.')
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
        ...(data.linkedOrgKpiId !== undefined ? { linkedOrgKpiId: data.linkedOrgKpiId || null } : {}),
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
