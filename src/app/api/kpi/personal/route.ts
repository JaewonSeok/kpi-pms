import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canManagePersonalKpi } from '@/lib/personal-kpi-access'
import { buildPersonalKpiTargetValuePersistence } from '@/lib/personal-kpi-target-values'
import { AppError, errorResponse, successResponse } from '@/lib/utils'
import { CreatePersonalKpiSchema } from '@/lib/validations'
import { canAccessEmployee } from '@/server/auth/authorize'
import { createAuditLog, getClientInfo } from '@/lib/audit'
import { validatePersonalOrgLink } from '@/server/goal-alignment'
import { resolvePersonalKpiTargetValues } from '@/lib/personal-kpi-target-values'
import { validatePersonalKpiWeightCapForPersistence2026 } from '@/server/kpi-alignment-policy-2026'
import { buildPolicyCategoryPersistenceAtCreate2026 } from '@/lib/policy-category-sources-2026'

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
        id: true,
        kpiName: true,
        weight: true,
        policyCategory: true,
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

    // 2026 weight-cap wiring — weightRule.enforced dormant 게이트 따름.
    // cutover 전(enforced=false): severity 'warning' → canSubmit 통과 → 차단 X.
    // cutover 후(enforced=true): perItem/sumMax/총합=100 위반 시 'blocker' → 400.
    // 신규 KPI에 작성자가 카테고리를 선택했다면 perItem cap 검증이 자동 발동(dormant이면
    // warning만, cutover 후 blocker). 미선택(null) 시 perItem skip + 분류된 다른 KPI의
    // sumMax/total 검증엔 포함.
    const weightCapDiagnostic = validatePersonalKpiWeightCapForPersistence2026({
      existingItems: existingKpis,
      newOrChangedItem: {
        id: null,
        kpiName: data.kpiName,
        weight: data.weight,
        policyCategory: data.policyCategory ?? null,
      },
      cycleYear: data.evalYear,
    })
    if (weightCapDiagnostic.canSubmit === false) {
      const blocker = weightCapDiagnostic.issues.find((iss) => iss.severity === 'blocker')
      throw new AppError(
        400,
        blocker?.code ?? 'WEIGHT_CAP_VALIDATION_FAILED',
        blocker?.message ?? '가중치 정책 검증에 실패했습니다.'
      )
    }

    const kpi = await prisma.personalKpi.create({
      data: {
        employeeId: data.employeeId,
        evalYear: data.evalYear,
        kpiType: data.kpiType,
        kpiName: data.kpiName,
        definition: data.definition,
        formula: data.formula,
        ...buildPersonalKpiTargetValuePersistence({
          targetValueT: data.targetValueT,
          targetValueE: data.targetValueE,
          targetValueS: data.targetValueS,
          copyMetadata: null,
        }),
        unit: data.unit,
        weight: data.weight,
        difficulty: data.difficulty,
        linkedOrgKpiId,
        status: 'DRAFT',
        // 2026 정책 분류 — 작성자가 등록 폼에서 선택한 카테고리와 메타 5컬럼 set.
        // 미선택(null)이면 5컬럼 모두 null → HR이 사후에 PolicyMapping2026Panel에서 분류.
        ...buildPolicyCategoryPersistenceAtCreate2026(data.policyCategory ?? null),
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

    const resolvedTargetValues = resolvePersonalKpiTargetValues(kpi)

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
        targetValue: resolvedTargetValues.targetValue,
        targetValueT: resolvedTargetValues.targetValueT,
        targetValueE: resolvedTargetValues.targetValueE,
        targetValueS: resolvedTargetValues.targetValueS,
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
