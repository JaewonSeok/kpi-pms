import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { errorResponse, successResponse, AppError } from '@/lib/utils'
import { UpdateOrgKpiSchema } from '@/lib/validations'
import { createAuditLog, getClientInfo } from '@/lib/audit'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '인증이 필요합니다.')

    const { id } = await context.params

    const kpi = await prisma.orgKpi.findUnique({
      where: { id },
      include: {
        department: {
          select: {
            deptName: true,
            deptCode: true,
          },
        },
        personalKpis: {
          select: {
            id: true,
            kpiName: true,
            status: true,
            employee: {
              select: {
                empId: true,
                empName: true,
              },
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

    const auditLogs = await prisma.auditLog.findMany({
      where: {
        entityType: 'OrgKpi',
        entityId: id,
      },
      orderBy: { timestamp: 'desc' },
      take: 20,
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
    if (!['ROLE_ADMIN', 'ROLE_TEAM_LEADER', 'ROLE_SECTION_CHIEF', 'ROLE_DIV_HEAD'].includes(session.user.role)) {
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
        definition: true,
        formula: true,
        targetValue: true,
        unit: true,
        difficulty: true,
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

    const targetDeptId = data.deptId ?? current.deptId
    const targetEvalYear = data.evalYear ?? current.evalYear
    const targetWeight = data.weight ?? current.weight
    const hasFieldUpdates =
      data.deptId !== undefined ||
      data.evalYear !== undefined ||
      data.kpiType !== undefined ||
      data.kpiCategory !== undefined ||
      data.kpiName !== undefined ||
      data.definition !== undefined ||
      data.formula !== undefined ||
      data.targetValue !== undefined ||
      data.unit !== undefined ||
      data.weight !== undefined ||
      data.difficulty !== undefined

    const linkedConfirmedPersonalKpis = current.personalKpis.filter(
      (personalKpi) => personalKpi.status === 'CONFIRMED'
    ).length

    if (current.status === 'CONFIRMED' && hasFieldUpdates) {
      throw new AppError(
        400,
        'ORG_KPI_LOCKED',
        '확정된 조직 KPI는 수정할 수 없습니다. 먼저 초안으로 전환하세요.'
      )
    }

    if (current.status === 'ARCHIVED' && hasFieldUpdates) {
      throw new AppError(
        400,
        'ORG_KPI_ARCHIVED',
        '보관된 조직 KPI는 수정할 수 없습니다. 먼저 초안으로 전환하세요.'
      )
    }

    if (data.status === 'DRAFT' && current.status === 'CONFIRMED') {
      if (session.user.role !== 'ROLE_ADMIN') {
        throw new AppError(
          403,
          'ORG_KPI_UNLOCK_FORBIDDEN',
          '확정된 조직 KPI를 초안으로 되돌릴 수 있는 권한이 없습니다.'
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
      data.deptId !== undefined ||
      data.evalYear !== undefined ||
      data.weight !== undefined
    ) {
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
          `가중치 합계가 100을 초과합니다. (변경 후: ${totalWeight})`
        )
      }
    }

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
        ...(data.targetValue !== undefined ? { targetValue: data.targetValue } : {}),
        ...(data.unit !== undefined ? { unit: data.unit || null } : {}),
        ...(data.weight !== undefined ? { weight: data.weight } : {}),
        ...(data.difficulty !== undefined ? { difficulty: data.difficulty } : {}),
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
          select: {
            id: true,
            kpiName: true,
            status: true,
            employee: {
              select: {
                empId: true,
                empName: true,
              },
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
        kpiName: current.kpiName,
        kpiCategory: current.kpiCategory,
        kpiType: current.kpiType,
        definition: current.definition,
        formula: current.formula,
        targetValue: current.targetValue,
        unit: current.unit,
        difficulty: current.difficulty,
      },
      newValue: {
        deptId: kpi.deptId,
        evalYear: kpi.evalYear,
        weight: kpi.weight,
        status: kpi.status,
        kpiName: kpi.kpiName,
        kpiCategory: kpi.kpiCategory,
        kpiType: kpi.kpiType,
        definition: kpi.definition,
        formula: kpi.formula,
        targetValue: kpi.targetValue,
        unit: kpi.unit,
        difficulty: kpi.difficulty,
      },
      ...clientInfo,
    })

    return successResponse(kpi)
  } catch (error) {
    return errorResponse(error)
  }
}
