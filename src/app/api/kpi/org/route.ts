import { Prisma } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAuditLog, getClientInfo } from '@/lib/audit'
import { buildOrgKpiTargetValuePersistence } from '@/lib/org-kpi-target-values'
import { AppError, errorResponse, successResponse } from '@/lib/utils'
import { CreateOrgKpiSchema } from '@/lib/validations'
import { validateOrgParentLink } from '@/server/goal-alignment'
import {
  canManageOrgKpiWriteScope,
  canSetOrgKpiTargetAmount,
  resolveEditableOrgKpiDepartmentIds,
  resolveReadableOrgKpiDepartmentIds,
} from '@/server/org-kpi-access'
import { assertOrgKpiScopeMatchesDepartment } from '@/server/org-kpi-scope-validation'

type CreateFailureStep =
  | 'authenticate'
  | 'load-departments'
  | 'validate-payload'
  | 'resolve-editable-scope'
  | 'validate-scope'
  | 'load-cycle'
  | 'validate-weight'
  | 'validate-parent-link'
  | 'create-kpi'
  | 'write-audit-log'

function formatCreateFailureStep(step: CreateFailureStep) {
  switch (step) {
    case 'authenticate':
      return '인증 확인'
    case 'load-departments':
      return '조직 정보 조회'
    case 'validate-payload':
      return '입력값 검증'
    case 'resolve-editable-scope':
      return '권한 범위 계산'
    case 'validate-scope':
      return '조직 범위 검증'
    case 'load-cycle':
      return '평가 주기 확인'
    case 'validate-weight':
      return '가중치 검증'
    case 'validate-parent-link':
      return '상위 KPI 연결 검증'
    case 'create-kpi':
      return '조직 KPI 저장'
    case 'write-audit-log':
      return '감사 로그 기록'
    default:
      return '요청 처리'
  }
}

function buildValidationFieldErrors(issues: Array<{ path: PropertyKey[]; message: string }>) {
  return Object.fromEntries(
    issues
      .map((issue) => {
        const field = issue.path[0]
        return typeof field === 'string' ? [field, issue.message] : null
      })
      .filter((entry): entry is [string, string] => Array.isArray(entry))
  )
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '인증이 필요합니다.')

    const { searchParams } = new URL(request.url)
    const evalYear = Number(searchParams.get('evalYear') || new Date().getFullYear())
    const deptId = searchParams.get('deptId')
    const departments = await prisma.department.findMany({
      select: {
        id: true,
        parentDeptId: true,
        leaderEmployeeId: true,
      },
    })
    const scopeDepartmentIds = resolveReadableOrgKpiDepartmentIds({
      userId: session.user.id,
      role: session.user.role,
      deptId: session.user.deptId,
      accessibleDepartmentIds: session.user.accessibleDepartmentIds,
      departments,
    })

    if (deptId && scopeDepartmentIds && !scopeDepartmentIds.includes(deptId)) {
      throw new AppError(403, 'FORBIDDEN', '권한 범위를 벗어난 조직입니다.')
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
  let failureStep: CreateFailureStep = 'authenticate'

  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '인증이 필요합니다.')

    failureStep = 'load-departments'
    const departments = await prisma.department.findMany({
      select: {
        id: true,
        parentDeptId: true,
        leaderEmployeeId: true,
      },
    })
    if (
      !canManageOrgKpiWriteScope({
        userId: session.user.id,
        role: session.user.role,
        deptId: session.user.deptId,
        accessibleDepartmentIds: session.user.accessibleDepartmentIds,
        departments,
      })
    ) {
      throw new AppError(403, 'FORBIDDEN', '현재 권한으로는 조직 KPI를 작성할 수 없습니다.')
    }

    failureStep = 'validate-payload'
    const body = await request.json()
    const validated = CreateOrgKpiSchema.safeParse(body)

    if (!validated.success) {
      const fieldErrors = buildValidationFieldErrors(validated.error.issues)
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        validated.error.issues[0]?.message ?? '입력값을 확인해 주세요.',
        {
          step: failureStep,
          ...(Object.keys(fieldErrors).length ? { fieldErrors } : {}),
        }
      )
    }

    const data = validated.data

    if (data.targetAmount !== undefined && !canSetOrgKpiTargetAmount(session.user.role)) {
      throw new AppError(403, 'FORBIDDEN', '매출 목표액은 관리자(ADMIN/CEO)만 설정할 수 있습니다.')
    }

    failureStep = 'resolve-editable-scope'
    const scopeDepartmentIds = resolveEditableOrgKpiDepartmentIds({
      userId: session.user.id,
      role: session.user.role,
      deptId: session.user.deptId,
      accessibleDepartmentIds: session.user.accessibleDepartmentIds,
      departments,
    })
    if (scopeDepartmentIds && !scopeDepartmentIds.includes(data.deptId)) {
      throw new AppError(403, 'FORBIDDEN', '권한 범위를 벗어난 조직입니다.')
    }

    failureStep = 'validate-scope'
    await assertOrgKpiScopeMatchesDepartment({
      requestedScope: data.scope ?? null,
      deptId: data.deptId,
    })

    failureStep = 'load-cycle'
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
        '현재 주기는 체크인 전용 모드입니다. 목표 생성/수정은 잠겨 있으며 체크인과 코멘트만 허용됩니다.'
      )
    }

    failureStep = 'validate-weight'
    const related = await prisma.orgKpi.findMany({
      where: { deptId: data.deptId, evalYear: data.evalYear },
      select: { weight: true },
    })

    const totalWeight = related.reduce((sum, item) => sum + item.weight, 0) + data.weight
    if (totalWeight > 100) {
      throw new AppError(
        400,
        'WEIGHT_EXCEEDED',
        `가중치 합계가 100%를 초과합니다. (현재: ${Math.round((totalWeight - data.weight) * 10) / 10}, 추가: ${data.weight})`
      )
    }

    failureStep = 'validate-parent-link'
    const parentOrgKpiId = await validateOrgParentLink({
      parentOrgKpiId: data.parentOrgKpiId ?? null,
      targetDeptId: data.deptId,
      targetEvalYear: data.evalYear,
      editableDepartmentIds: scopeDepartmentIds,
    })

    failureStep = 'create-kpi'
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
        weight: data.weight,
        difficulty: data.difficulty,
        tags: data.tags ?? [],
        parentOrgKpiId,
        status: 'DRAFT',
        ...(data.targetAmount !== undefined ? { targetAmount: data.targetAmount } : {}),
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

    failureStep = 'write-audit-log'
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
    if (error instanceof AppError) {
      return errorResponse(error)
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return errorResponse(
        new AppError(
          500,
          'ORG_KPI_CREATE_DB_ERROR',
          '조직 KPI를 저장하는 중 데이터베이스 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
          {
            step: failureStep,
            prismaCode: error.code,
          }
        )
      )
    }

    if (error instanceof Error) {
      return errorResponse(
        new AppError(
          500,
          'ORG_KPI_CREATE_FAILED',
          `${formatCreateFailureStep(failureStep)} 단계에서 오류가 발생했습니다. ${error.message}`.trim(),
          { step: failureStep }
        )
      )
    }

    return errorResponse(error)
  }
}
