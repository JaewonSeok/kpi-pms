import type { SystemRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getPersonalKpiScopeDepartmentIds } from '@/lib/personal-kpi-access'
import { getPersonalKpiDeleteActionState } from '@/lib/personal-kpi-delete'
import { AppError } from '@/lib/utils'
import { resolvePersonalKpiOperationalStatus } from './personal-kpi-workflow'

type DeleteActor = {
  id: string
  role: SystemRole
  deptId: string
  accessibleDepartmentIds: string[]
}

type DeleteClientInfo = {
  ipAddress?: string
  userAgent?: string
}

type PrismaLike = typeof prisma

async function isGoalEditLocked(db: PrismaLike, deptId: string, evalYear: number) {
  const department = await db.department.findUnique({
    where: { id: deptId },
    select: { orgId: true },
  })

  if (!department) {
    return false
  }

  const cycle = await db.evalCycle.findFirst({
    where: {
      orgId: department.orgId,
      evalYear,
    },
    orderBy: { createdAt: 'desc' },
    select: { goalEditMode: true },
  })

  return cycle?.goalEditMode === 'CHECKIN_ONLY'
}

export async function deletePersonalKpiRecord(
  params: {
    id: string
    actor: DeleteActor
    clientInfo: DeleteClientInfo
  },
  deps: {
    prisma?: PrismaLike
  } = {}
) {
  const db = deps.prisma ?? prisma

  const current = await db.personalKpi.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      employeeId: true,
      evalYear: true,
      status: true,
      kpiName: true,
      linkedOrgKpiId: true,
      copiedFromPersonalKpiId: true,
      employee: {
        select: {
          deptId: true,
          empName: true,
        },
      },
      _count: {
        select: {
          monthlyRecords: true,
          evaluationItems: true,
          clonedPersonalKpis: true,
        },
      },
    },
  })

  if (!current) {
    throw new AppError(404, 'PERSONAL_KPI_NOT_FOUND', '개인 KPI를 찾을 수 없습니다.')
  }

  const scopeDepartmentIds = getPersonalKpiScopeDepartmentIds({
    role: params.actor.role,
    deptId: params.actor.deptId,
    accessibleDepartmentIds: params.actor.accessibleDepartmentIds,
  })

  const canManageTarget =
    current.employeeId === params.actor.id ||
    params.actor.role === 'ROLE_ADMIN' ||
    params.actor.role === 'ROLE_CEO' ||
    (scopeDepartmentIds?.includes(current.employee.deptId) ?? true)

  const [logs, goalEditLocked] = await Promise.all([
    db.auditLog.findMany({
      where: {
        entityType: 'PersonalKpi',
        entityId: current.id,
      },
      orderBy: {
        timestamp: 'desc',
      },
      take: 30,
    }),
    isGoalEditLocked(db, current.employee.deptId, current.evalYear),
  ])

  const operationalStatus = resolvePersonalKpiOperationalStatus({
    status: current.status,
    logs,
  })

  const deleteState = getPersonalKpiDeleteActionState({
    kpi: {
      id: current.id,
      title: current.kpiName,
      status: operationalStatus,
      linkedMonthlyCount: current._count.monthlyRecords,
      linkedEvaluationItemCount: current._count.evaluationItems,
    },
    canManage: canManageTarget,
    goalEditLocked,
  })

  if (deleteState.disabled) {
    if (deleteState.code === 'FORBIDDEN') {
      throw new AppError(403, 'FORBIDDEN', deleteState.reason ?? '현재 권한으로는 개인 KPI를 삭제할 수 없습니다.')
    }

    if (deleteState.code === 'GOAL_EDIT_LOCKED') {
      throw new AppError(400, 'GOAL_EDIT_LOCKED', deleteState.reason ?? '현재 주기는 읽기 전용 상태입니다.')
    }

    if (deleteState.code === 'MONTHLY_RECORD_BLOCKED' || deleteState.code === 'EVALUATION_BLOCKED') {
      throw new AppError(
        409,
        'PERSONAL_KPI_DELETE_BLOCKED',
        deleteState.reason ?? '연관 데이터가 있어 개인 KPI를 삭제할 수 없습니다.'
      )
    }

    throw new AppError(
      409,
      'PERSONAL_KPI_NOT_DELETABLE',
      deleteState.reason ?? '현재 상태의 개인 KPI는 삭제할 수 없습니다.'
    )
  }

  const result = await db.$transaction(async (tx) => {
    const detachedClones = await tx.personalKpi.updateMany({
      where: {
        copiedFromPersonalKpiId: current.id,
      },
      data: {
        copiedFromPersonalKpiId: null,
      },
    })

    const deleted = await tx.personalKpi.delete({
      where: { id: current.id },
      select: {
        id: true,
        employeeId: true,
        evalYear: true,
        kpiName: true,
      },
    })

    await tx.auditLog.create({
      data: {
        userId: params.actor.id,
        action: 'PERSONAL_KPI_DELETED',
        entityType: 'PersonalKpi',
        entityId: current.id,
        oldValue: {
          employeeId: current.employeeId,
          employeeName: current.employee.empName,
          employeeDeptId: current.employee.deptId,
          evalYear: current.evalYear,
          kpiName: current.kpiName,
          status: current.status,
          workflowStatus: operationalStatus,
          linkedOrgKpiId: current.linkedOrgKpiId,
          copiedFromPersonalKpiId: current.copiedFromPersonalKpiId,
          monthlyRecordCount: current._count.monthlyRecords,
          evaluationItemCount: current._count.evaluationItems,
          clonedPersonalKpiCount: current._count.clonedPersonalKpis,
        },
        newValue: {
          deleted: true,
          detachedCloneReferenceCount: detachedClones.count,
        },
        ipAddress: params.clientInfo.ipAddress,
        userAgent: params.clientInfo.userAgent,
      },
    })

    return {
      deleted,
      detachedCloneReferenceCount: detachedClones.count,
    }
  })

  return {
    deleted: true,
    id: result.deleted.id,
    title: result.deleted.kpiName,
    employeeId: result.deleted.employeeId,
    evalYear: result.deleted.evalYear,
    detachedCloneReferenceCount: result.detachedCloneReferenceCount,
  }
}
