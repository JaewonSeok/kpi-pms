import { prisma } from '@/lib/prisma'
import { getOrgKpiDeleteActionState } from '@/lib/org-kpi-delete'
import { AppError } from '@/lib/utils'
import { resolveOrgKpiOperationalStatus } from './org-kpi-workflow'

type DeleteActor = {
  id: string
  role: string
  deptId: string
  accessibleDepartmentIds: string[]
}

type DeleteClientInfo = {
  ipAddress?: string
  userAgent?: string
}

type PrismaLike = typeof prisma

function canManage(role: string) {
  return ['ROLE_ADMIN', 'ROLE_CEO', 'ROLE_DIV_HEAD', 'ROLE_SECTION_CHIEF', 'ROLE_TEAM_LEADER'].includes(role)
}

function getScopeDepartmentIds(actor: DeleteActor) {
  if (actor.role === 'ROLE_ADMIN' || actor.role === 'ROLE_CEO') {
    return null
  }

  if (actor.role === 'ROLE_MEMBER') {
    return [actor.deptId]
  }

  return actor.accessibleDepartmentIds.length ? actor.accessibleDepartmentIds : [actor.deptId]
}

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

export async function deleteOrgKpiRecord(
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

  if (!canManage(params.actor.role)) {
    throw new AppError(403, 'FORBIDDEN', '현재 권한으로는 조직 KPI를 삭제할 수 없습니다.')
  }

  const current = await db.orgKpi.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      deptId: true,
      evalYear: true,
      status: true,
      kpiName: true,
      parentOrgKpiId: true,
      copiedFromOrgKpiId: true,
      _count: {
        select: {
          personalKpis: true,
          childOrgKpis: true,
          clonedOrgKpis: true,
        },
      },
    },
  })

  if (!current) {
    throw new AppError(404, 'ORG_KPI_NOT_FOUND', '조직 KPI를 찾을 수 없습니다.')
  }

  const scopeDepartmentIds = getScopeDepartmentIds(params.actor)
  if (scopeDepartmentIds && !scopeDepartmentIds.includes(current.deptId)) {
    throw new AppError(403, 'FORBIDDEN', '권한 범위를 벗어난 조직 KPI입니다.')
  }

  const [logs, goalEditLocked] = await Promise.all([
    db.auditLog.findMany({
      where: {
        entityType: 'OrgKpi',
        entityId: current.id,
      },
      orderBy: {
        timestamp: 'desc',
      },
      take: 30,
    }),
    isGoalEditLocked(db, current.deptId, current.evalYear),
  ])

  const operationalStatus = resolveOrgKpiOperationalStatus({
    status: current.status,
    logs,
  })

  const deleteState = getOrgKpiDeleteActionState({
    kpi: {
      id: current.id,
      title: current.kpiName,
      status: operationalStatus,
      linkedPersonalKpiCount: current._count.personalKpis,
    },
    canManage: true,
    goalEditLocked,
  })

  if (deleteState.disabled) {
    if (deleteState.code === 'GOAL_EDIT_LOCKED') {
      throw new AppError(
        400,
        'GOAL_EDIT_LOCKED',
        deleteState.reason ?? '현재 주기는 목표 읽기 전용 모드입니다. 조직 KPI를 삭제할 수 없습니다.'
      )
    }

    if (deleteState.code === 'LINKED_PERSONAL_KPI_BLOCKED') {
      throw new AppError(
        409,
        'ORG_KPI_DELETE_BLOCKED',
        deleteState.reason ?? '개인 KPI와 연결된 조직 KPI는 삭제할 수 없습니다.'
      )
    }

    throw new AppError(
      409,
      'ORG_KPI_NOT_DELETABLE',
      deleteState.reason ?? '현재 상태의 조직 KPI는 삭제할 수 없습니다.'
    )
  }

  const result = await db.$transaction(async (tx) => {
    const [detachedChildren, detachedClones] = await Promise.all([
      tx.orgKpi.updateMany({
        where: {
          parentOrgKpiId: current.id,
        },
        data: {
          parentOrgKpiId: null,
        },
      }),
      tx.orgKpi.updateMany({
        where: {
          copiedFromOrgKpiId: current.id,
        },
        data: {
          copiedFromOrgKpiId: null,
        },
      }),
    ])

    const deleted = await tx.orgKpi.delete({
      where: { id: current.id },
      select: {
        id: true,
        kpiName: true,
        deptId: true,
        evalYear: true,
      },
    })

    await tx.auditLog.create({
      data: {
        userId: params.actor.id,
        action: 'ORG_KPI_DELETED',
        entityType: 'OrgKpi',
        entityId: current.id,
        oldValue: {
          deptId: current.deptId,
          evalYear: current.evalYear,
          kpiName: current.kpiName,
          status: current.status,
          workflowStatus: operationalStatus,
          parentOrgKpiId: current.parentOrgKpiId,
          copiedFromOrgKpiId: current.copiedFromOrgKpiId,
          linkedPersonalKpiCount: current._count.personalKpis,
          childOrgKpiCount: current._count.childOrgKpis,
          clonedOrgKpiCount: current._count.clonedOrgKpis,
        },
        newValue: {
          deleted: true,
          detachedChildOrgKpiCount: detachedChildren.count,
          detachedCloneReferenceCount: detachedClones.count,
        },
        ipAddress: params.clientInfo.ipAddress,
        userAgent: params.clientInfo.userAgent,
      },
    })

    return {
      deleted,
      detachedChildOrgKpiCount: detachedChildren.count,
      detachedCloneReferenceCount: detachedClones.count,
    }
  })

  return {
    deleted: true,
    id: result.deleted.id,
    title: result.deleted.kpiName,
    detachedChildOrgKpiCount: result.detachedChildOrgKpiCount,
    detachedCloneReferenceCount: result.detachedCloneReferenceCount,
  }
}
