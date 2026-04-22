import { getServerSession, type Session } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { errorResponse, successResponse, AppError } from '@/lib/utils'
import { DeleteOrgKpiSchema, UpdateOrgKpiSchema } from '@/lib/validations'
import { createAuditLog, getClientInfo } from '@/lib/audit'
import { buildOrgKpiTargetValuePersistence } from '@/lib/org-kpi-target-values'
import {
  canEditOrgKpiByOperationalStatus,
  resolveOrgKpiOperationalStatus,
} from '@/server/org-kpi-workflow'
import { validateOrgParentLink } from '@/server/goal-alignment'
import { deleteOrgKpiRecord } from '@/server/org-kpi-delete'
import { assertOrgKpiScopeMatchesDepartment } from '@/server/org-kpi-scope-validation'

type RouteContext = {
  params: Promise<{ id: string }>
}

function canManage(role: string) {
  return ['ROLE_ADMIN', 'ROLE_CEO', 'ROLE_DIV_HEAD', 'ROLE_SECTION_CHIEF', 'ROLE_TEAM_LEADER'].includes(role)
}

function getScopeDepartmentIds(session: Session | null) {
  if (!session) return []
  if (session.user.role === 'ROLE_ADMIN' || session.user.role === 'ROLE_CEO') {
    return null
  }
  if (session.user.role === 'ROLE_MEMBER') {
    return [session.user.deptId]
  }
  return session.user.accessibleDepartmentIds.length
    ? session.user.accessibleDepartmentIds
    : [session.user.deptId]
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '인증이 필요합니다.')

    const { id } = await context.params
    const scopeDepartmentIds = getScopeDepartmentIds(session)

    const kpi = await prisma.orgKpi.findUnique({
      where: { id },
      include: {
        department: {
          select: {
            id: true,
            deptName: true,
            deptCode: true,
          },
        },
        personalKpis: {
          include: {
            employee: {
              select: {
                id: true,
                empId: true,
                empName: true,
              },
            },
            monthlyRecords: {
              orderBy: [{ yearMonth: 'desc' }],
              take: 3,
            },
          },
          orderBy: [{ employee: { empName: 'asc' } }],
        },
        _count: { select: { personalKpis: true } },
      },
    })

    if (!kpi) {
      throw new AppError(404, 'ORG_KPI_NOT_FOUND', '조직 KPI를 찾을 수 없습니다.')
    }

    if (scopeDepartmentIds && !scopeDepartmentIds.includes(kpi.deptId)) {
      throw new AppError(403, 'FORBIDDEN', '권한 범위를 벗어난 조직 KPI입니다.')
    }

    const auditLogs = await prisma.auditLog.findMany({
      where: {
        entityType: 'OrgKpi',
        entityId: id,
      },
      orderBy: { timestamp: 'desc' },
      take: 30,
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
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '인증이 필요합니다.')
    if (!canManage(session.user.role)) {
      throw new AppError(403, 'FORBIDDEN', '권한이 없습니다.')
    }

    const { id } = await context.params
    const body = await request.json()
    const validated = UpdateOrgKpiSchema.safeParse(body)

    if (!validated.success) {
      throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0].message)
    }

    const data = validated.data

    const current = await prisma.orgKpi.findUnique({
      where: { id },
      select: {
        id: true,
        deptId: true,
        evalYear: true,
        weight: true,
        status: true,
        kpiName: true,
        kpiCategory: true,
        kpiType: true,
        parentOrgKpiId: true,
        definition: true,
        formula: true,
        targetValue: true,
        targetValueT: true,
        targetValueE: true,
        targetValueS: true,
        unit: true,
        difficulty: true,
        tags: true,
        personalKpis: {
          select: {
            status: true,
          },
        },
      },
    })

    if (!current) {
      throw new AppError(404, 'ORG_KPI_NOT_FOUND', '조직 KPI를 찾을 수 없습니다.')
    }

    const scopeDepartmentIds = getScopeDepartmentIds(session)
    if (scopeDepartmentIds && !scopeDepartmentIds.includes(current.deptId)) {
      throw new AppError(403, 'FORBIDDEN', '권한 범위를 벗어난 조직 KPI입니다.')
    }

    const workflowLogs = await prisma.auditLog.findMany({
      where: {
        entityType: 'OrgKpi',
        entityId: id,
      },
      orderBy: {
        timestamp: 'desc',
      },
      take: 30,
    })

    const operationalStatus = resolveOrgKpiOperationalStatus({
      status: current.status,
      logs: workflowLogs,
    })

    const targetDeptId = data.deptId ?? current.deptId
    const targetEvalYear = data.evalYear ?? current.evalYear
    const targetWeight = data.weight ?? current.weight

    await assertOrgKpiScopeMatchesDepartment({
      requestedScope: data.scope ?? null,
      deptId: targetDeptId,
    })

    const hasFieldUpdates =
      data.deptId !== undefined ||
      data.evalYear !== undefined ||
      data.kpiType !== undefined ||
      data.kpiCategory !== undefined ||
      data.kpiName !== undefined ||
      data.definition !== undefined ||
      data.formula !== undefined ||
      data.targetValueT !== undefined ||
      data.targetValueE !== undefined ||
      data.targetValueS !== undefined ||
      data.unit !== undefined ||
      data.weight !== undefined ||
      data.difficulty !== undefined ||
      data.tags !== undefined

    const targetDepartment = await prisma.department.findUnique({
      where: { id: targetDeptId },
      select: { orgId: true },
    })

    const targetCycle = targetDepartment
      ? await prisma.evalCycle.findFirst({
          where: {
            orgId: targetDepartment.orgId,
            evalYear: targetEvalYear,
          },
          orderBy: { createdAt: 'desc' },
          select: { goalEditMode: true },
        })
      : null

    const linkedConfirmedPersonalKpis = current.personalKpis.filter(
      (personalKpi) => personalKpi.status === 'CONFIRMED'
    ).length

    if (hasFieldUpdates && !canEditOrgKpiByOperationalStatus(operationalStatus)) {
      throw new AppError(
        400,
        'ORG_KPI_LOCKED',
        '초안 상태 KPI만 수정할 수 있습니다. 제출되었거나 잠금된 KPI는 먼저 재오픈해 주세요.'
      )
    }

    if ((hasFieldUpdates || data.status === 'ARCHIVED') && targetCycle?.goalEditMode === 'CHECKIN_ONLY') {
      throw new AppError(
        400,
        'GOAL_EDIT_LOCKED',
        '현재 주기는 읽기 전용 모드입니다. 목표 생성/수정/삭제는 막혀 있으며 체크인과 코멘트만 허용됩니다.'
      )
    }

    if (data.status === 'DRAFT' && current.status === 'CONFIRMED') {
      if (session.user.role !== 'ROLE_ADMIN') {
        throw new AppError(
          403,
          'ORG_KPI_UNLOCK_FORBIDDEN',
          '확정 KPI를 초안으로 되돌릴 권한이 없습니다.'
        )
      }

      if (linkedConfirmedPersonalKpis > 0) {
        throw new AppError(
          400,
          'ORG_KPI_UNLOCK_BLOCKED',
          '연결된 확정 개인 KPI가 있어 초안으로 되돌릴 수 없습니다.'
        )
      }
    }

    if (
      (data.deptId !== undefined || data.evalYear !== undefined || data.weight !== undefined) &&
      scopeDepartmentIds &&
      !scopeDepartmentIds.includes(targetDeptId)
    ) {
      throw new AppError(403, 'FORBIDDEN', '권한 범위를 벗어난 부서로 이동할 수 없습니다.')
    }

    if (data.status === 'CONFIRMED' && !['ROLE_ADMIN', 'ROLE_CEO', 'ROLE_DIV_HEAD', 'ROLE_SECTION_CHIEF'].includes(session.user.role)) {
      throw new AppError(403, 'FORBIDDEN', '이 역할은 조직 KPI를 확정할 수 없습니다.')
    }

    if (data.status === 'ARCHIVED' && !['ROLE_ADMIN', 'ROLE_CEO', 'ROLE_DIV_HEAD', 'ROLE_SECTION_CHIEF'].includes(session.user.role)) {
      throw new AppError(403, 'FORBIDDEN', '이 역할은 조직 KPI를 보관할 수 없습니다.')
    }

    if (data.deptId !== undefined || data.evalYear !== undefined || data.weight !== undefined) {
      const related = await prisma.orgKpi.findMany({
        where: {
          deptId: targetDeptId,
          evalYear: targetEvalYear,
          id: { not: id },
        },
        select: { weight: true },
      })

      const totalWeight = related.reduce((sum, item) => sum + item.weight, 0) + targetWeight
      if (totalWeight > 100) {
        throw new AppError(
          400,
          'WEIGHT_EXCEEDED',
          `가중치 합계가 100을 초과합니다. (변경 후: ${Math.round(totalWeight * 10) / 10})`
        )
      }
    }

    const validatedParentOrgKpiId =
      data.parentOrgKpiId !== undefined || data.deptId !== undefined || data.evalYear !== undefined
        ? await validateOrgParentLink({
            goalId: id,
            parentOrgKpiId:
              data.parentOrgKpiId !== undefined ? data.parentOrgKpiId ?? null : current.parentOrgKpiId,
            targetDeptId,
            targetEvalYear,
            editableDepartmentIds: scopeDepartmentIds,
          })
        : current.parentOrgKpiId

    const kpi = await prisma.orgKpi.update({
      where: { id },
      data: {
        ...(data.deptId !== undefined ? { deptId: data.deptId } : {}),
        ...(data.evalYear !== undefined ? { evalYear: data.evalYear } : {}),
        ...(data.kpiType !== undefined ? { kpiType: data.kpiType } : {}),
        ...(data.kpiCategory !== undefined ? { kpiCategory: data.kpiCategory } : {}),
        ...(data.kpiName !== undefined ? { kpiName: data.kpiName } : {}),
        ...(data.definition !== undefined ? { definition: data.definition || null } : {}),
        ...(data.formula !== undefined ? { formula: data.formula || null } : {}),
        ...(data.targetValueT !== undefined &&
        data.targetValueE !== undefined &&
        data.targetValueS !== undefined
          ? buildOrgKpiTargetValuePersistence({
              targetValueT: data.targetValueT,
              targetValueE: data.targetValueE,
              targetValueS: data.targetValueS,
            })
          : {}),
        ...(data.unit !== undefined ? { unit: data.unit || null } : {}),
        ...(data.weight !== undefined ? { weight: data.weight } : {}),
        ...(data.difficulty !== undefined ? { difficulty: data.difficulty } : {}),
        ...(data.tags !== undefined ? { tags: data.tags } : {}),
        ...(data.parentOrgKpiId !== undefined || data.deptId !== undefined || data.evalYear !== undefined
          ? { parentOrgKpiId: validatedParentOrgKpiId }
          : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
      },
      include: {
        department: {
          select: {
            deptName: true,
            deptCode: true,
          },
        },
        personalKpis: {
          include: {
            employee: {
              select: {
                id: true,
                empId: true,
                empName: true,
              },
            },
            monthlyRecords: {
              orderBy: [{ yearMonth: 'desc' }],
              take: 3,
            },
          },
          orderBy: [{ employee: { empName: 'asc' } }],
        },
        _count: { select: { personalKpis: true } },
      },
    })

    const clientInfo = getClientInfo(request)
    await createAuditLog({
      userId: session.user.id,
      action: data.status && data.status !== current.status ? 'ORG_KPI_STATUS_CHANGED' : 'ORG_KPI_UPDATED',
      entityType: 'OrgKpi',
      entityId: id,
      oldValue: {
        deptId: current.deptId,
        evalYear: current.evalYear,
        weight: current.weight,
        status: current.status,
        workflowStatus: operationalStatus,
        kpiName: current.kpiName,
        kpiCategory: current.kpiCategory,
        kpiType: current.kpiType,
        parentOrgKpiId: current.parentOrgKpiId,
        definition: current.definition,
        formula: current.formula,
        targetValue: current.targetValue,
        targetValueT: current.targetValueT,
        targetValueE: current.targetValueE,
        targetValueS: current.targetValueS,
        unit: current.unit,
        difficulty: current.difficulty,
        tags: current.tags,
      },
      newValue: {
        deptId: kpi.deptId,
        evalYear: kpi.evalYear,
        weight: kpi.weight,
        status: kpi.status,
        kpiName: kpi.kpiName,
        kpiCategory: kpi.kpiCategory,
        kpiType: kpi.kpiType,
        parentOrgKpiId: kpi.parentOrgKpiId,
        definition: kpi.definition,
        formula: kpi.formula,
        targetValue: kpi.targetValue,
        targetValueT: kpi.targetValueT,
        targetValueE: kpi.targetValueE,
        targetValueS: kpi.targetValueS,
        unit: kpi.unit,
        difficulty: kpi.difficulty,
        tags: kpi.tags,
      },
      ...clientInfo,
    })

    return successResponse(kpi)
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    }

    const body = await request.json().catch(() => null)
    const validated = DeleteOrgKpiSchema.safeParse(body)
    if (!validated.success) {
      throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0]?.message ?? '삭제 확인이 필요합니다.')
    }

    const { id } = await context.params
    const result = await deleteOrgKpiRecord({
      id,
      actor: {
        id: session.user.id,
        role: session.user.role,
        deptId: session.user.deptId,
        accessibleDepartmentIds: session.user.accessibleDepartmentIds,
      },
      clientInfo: getClientInfo(request),
    })

    return successResponse(result)
  } catch (error) {
    return errorResponse(error)
  }
}
