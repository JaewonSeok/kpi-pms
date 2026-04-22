import { getServerSession, type Session } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAuditLog, getClientInfo } from '@/lib/audit'
import { buildOrgKpiTargetValuePersistence } from '@/lib/org-kpi-target-values'
import { AppError, errorResponse, successResponse } from '@/lib/utils'
import { CreateOrgKpiSchema } from '@/lib/validations'
import { validateOrgParentLink } from '@/server/goal-alignment'
import { assertOrgKpiScopeMatchesDepartment } from '@/server/org-kpi-scope-validation'

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

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '인증이 필요합니다.')

    const { searchParams } = new URL(request.url)
    const evalYear = Number(searchParams.get('evalYear') || new Date().getFullYear())
    const deptId = searchParams.get('deptId')
    const scopeDepartmentIds = getScopeDepartmentIds(session)

    if (deptId && scopeDepartmentIds && !scopeDepartmentIds.includes(deptId)) {
      throw new AppError(403, 'FORBIDDEN', '권한 범위를 벗어난 부서입니다.')
    }

    const kpis = await prisma.orgKpi.findMany({
      where: {
        evalYear,
        ...(deptId ? { deptId } : {}),
        ...(scopeDepartmentIds ? { deptId: { in: scopeDepartmentIds } } : {}),
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
              take: 2,
            },
          },
        },
        _count: { select: { personalKpis: true } },
      },
      orderBy: [{ deptId: 'asc' }, { kpiName: 'asc' }],
    })

    return successResponse(kpis)
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '인증이 필요합니다.')
    if (!canManage(session.user.role)) {
      throw new AppError(403, 'FORBIDDEN', '권한이 없습니다.')
    }

    const body = await request.json()
    const validated = CreateOrgKpiSchema.safeParse(body)

    if (!validated.success) {
      throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0].message)
    }

    const data = validated.data
    const scopeDepartmentIds = getScopeDepartmentIds(session)
    if (scopeDepartmentIds && !scopeDepartmentIds.includes(data.deptId)) {
      throw new AppError(403, 'FORBIDDEN', '권한 범위를 벗어난 부서입니다.')
    }

    await assertOrgKpiScopeMatchesDepartment({
      requestedScope: data.scope ?? null,
      deptId: data.deptId,
    })

    const targetDepartment = await prisma.department.findUnique({
      where: { id: data.deptId },
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

    const related = await prisma.orgKpi.findMany({
      where: { deptId: data.deptId, evalYear: data.evalYear },
      select: { weight: true },
    })

    const totalWeight = related.reduce((sum, item) => sum + item.weight, 0) + data.weight
    if (totalWeight > 100) {
      throw new AppError(
        400,
        'WEIGHT_EXCEEDED',
        `가중치 합계가 100을 초과합니다. (현재: ${Math.round((totalWeight - data.weight) * 10) / 10}, 추가: ${data.weight})`
      )
    }

    const parentOrgKpiId = await validateOrgParentLink({
      parentOrgKpiId: data.parentOrgKpiId ?? null,
      targetDeptId: data.deptId,
      targetEvalYear: data.evalYear,
      editableDepartmentIds: scopeDepartmentIds,
    })

    const kpi = await prisma.orgKpi.create({
      data: {
        deptId: data.deptId,
        evalYear: data.evalYear,
        kpiType: data.kpiType,
        kpiCategory: data.kpiCategory,
        kpiName: data.kpiName,
        definition: data.definition,
        formula: data.formula,
        ...buildOrgKpiTargetValuePersistence({
          targetValueT: data.targetValueT,
          targetValueE: data.targetValueE,
          targetValueS: data.targetValueS,
        }),
        unit: data.unit,
        weight: data.weight,
        difficulty: data.difficulty,
        tags: data.tags ?? [],
        parentOrgKpiId,
        status: 'DRAFT',
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
          },
        },
        _count: { select: { personalKpis: true } },
      },
    })

    const clientInfo = getClientInfo(request)
    await createAuditLog({
      userId: session.user.id,
      action: 'ORG_KPI_CREATED',
      entityType: 'OrgKpi',
      entityId: kpi.id,
      newValue: {
        deptId: kpi.deptId,
        evalYear: kpi.evalYear,
        weight: kpi.weight,
        status: kpi.status,
        kpiName: kpi.kpiName,
        kpiCategory: kpi.kpiCategory,
        kpiType: kpi.kpiType,
        targetValue: kpi.targetValue,
        targetValueT: kpi.targetValueT,
        targetValueE: kpi.targetValueE,
        targetValueS: kpi.targetValueS,
        parentOrgKpiId: kpi.parentOrgKpiId,
        tags: kpi.tags,
      },
      ...clientInfo,
    })

    return successResponse(kpi)
  } catch (error) {
    return errorResponse(error)
  }
}
