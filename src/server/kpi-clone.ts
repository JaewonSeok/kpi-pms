import type { Prisma, SystemRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'
import { canManagePersonalKpi } from '@/lib/personal-kpi-access'
import { AppError } from '@/lib/utils'
import { canAccessEmployee } from '@/server/auth/authorize'

type CloneClientInfo = {
  ipAddress?: string
  userAgent?: string
}

type PersonalCloneParams = {
  session: {
    user: {
      id: string
      role: SystemRole
      deptId: string
      accessibleDepartmentIds?: string[] | null
      name: string
    }
  }
  sourceId: string
  targetEmployeeId?: string
  assignToSelf: boolean
  targetEvalYear: number
  targetCycleId?: string
  includeProgress: boolean
  includeCheckins: boolean
  clientInfo?: CloneClientInfo
}

type OrgCloneParams = {
  session: {
    user: {
      id: string
      role: SystemRole
      deptId: string
      accessibleDepartmentIds?: string[] | null
      name: string
    }
  }
  sourceId: string
  targetDeptId: string
  targetEvalYear: number
  targetCycleId?: string
  includeProgress: boolean
  includeCheckins: boolean
  clientInfo?: CloneClientInfo
}

type PersonalKpiCloneMetadata = {
  sourcePersonalKpiId: string
  sourceEvalYear: number
  targetCycleId?: string | null
  targetCycleName?: string | null
  assignedToSelf: boolean
  includedProgress: boolean
  includedCheckins: boolean
  progressSnapshot: Array<{
    yearMonth: string
    actualValue?: number | null
    achievementRate?: number | null
    activities?: string | null
    obstacles?: string | null
    efforts?: string | null
  }>
  checkinSnapshot: Array<{
    checkInId: string
    date: string
    summary: string
    progress?: string
    concern?: string
    support?: string
  }>
  clonedAt: string
}

type OrgKpiCloneMetadata = {
  sourceOrgKpiId: string
  sourceEvalYear: number
  targetCycleId?: string | null
  targetCycleName?: string | null
  includedProgress: boolean
  includedCheckins: boolean
  progressSnapshot: {
    linkedPersonalKpiCount: number
    linkedMonthlyRecordCount: number
    averageAchievementRate?: number
    recentMonthlyNotes: Array<{
      employeeName: string
      yearMonth: string
      activities?: string | null
      achievementRate?: number | null
    }>
  } | null
  checkinSnapshot: Array<{
    checkInId: string
    date: string
    ownerName: string
    summary: string
  }>
  clonedAt: string
}

type PersonalKpiSource = Prisma.PersonalKpiGetPayload<{
  include: {
    employee: {
      select: {
        id: true
        deptId: true
        empName: true
      }
    }
    linkedOrgKpi: {
      select: {
        id: true
      }
    }
    monthlyRecords: {
      orderBy: {
        yearMonth: 'desc'
      }
      take: 6
    }
  }
}>

type OrgKpiSource = Prisma.OrgKpiGetPayload<{
  include: {
    department: {
      select: {
        id: true
        deptName: true
      }
    }
    personalKpis: {
      include: {
        employee: {
          select: {
            id: true
            empName: true
          }
        }
        monthlyRecords: {
          orderBy: {
            yearMonth: 'desc'
          }
          take: 3
        }
      }
    }
  }
}>

function getOrgKpiScopeDepartmentIds(params: {
  role: SystemRole
  deptId: string
  accessibleDepartmentIds?: string[] | null
}) {
  if (params.role === 'ROLE_ADMIN' || params.role === 'ROLE_CEO') {
    return null
  }

  if (params.role === 'ROLE_MEMBER') {
    return [params.deptId]
  }

  const accessibleDepartmentIds = Array.isArray(params.accessibleDepartmentIds)
    ? params.accessibleDepartmentIds.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    : []

  return accessibleDepartmentIds.length ? accessibleDepartmentIds : [params.deptId]
}

function canManageOrgKpi(role: SystemRole) {
  return ['ROLE_ADMIN', 'ROLE_CEO', 'ROLE_DIV_HEAD', 'ROLE_SECTION_CHIEF', 'ROLE_TEAM_LEADER'].includes(role)
}

function parseCheckInDiscussionItem(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const record = value as Record<string, unknown>
  return {
    kpiId: typeof record.kpiId === 'string' ? record.kpiId : '',
    progress: typeof record.progress === 'string' ? record.progress : undefined,
    concern: typeof record.concern === 'string' ? record.concern : undefined,
    support: typeof record.support === 'string' ? record.support : undefined,
  }
}

function buildCloneName(baseName: string, existingNames: string[]) {
  const normalized = new Set(existingNames.map((item) => item.trim().toLowerCase()))
  const baseCloneName = `${baseName} (복제)`
  if (!normalized.has(baseCloneName.toLowerCase())) {
    return baseCloneName
  }

  let index = 2
  while (normalized.has(`${baseCloneName} ${index}`.toLowerCase())) {
    index += 1
  }

  return `${baseCloneName} ${index}`
}

function getAverageAchievementRate(values: Array<number | null | undefined>) {
  const numbers = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  if (!numbers.length) return undefined
  return Math.round((numbers.reduce((sum, value) => sum + value, 0) / numbers.length) * 10) / 10
}

async function resolveCycleSnapshot(targetCycleId: string | undefined, targetEvalYear: number) {
  if (!targetCycleId) {
    return null
  }

  const cycle = await prisma.evalCycle.findUnique({
    where: { id: targetCycleId },
    select: {
      id: true,
      cycleName: true,
      evalYear: true,
    },
  })

  if (!cycle) {
    throw new AppError(404, 'EVAL_CYCLE_NOT_FOUND', '복제 대상 평가 주기를 찾을 수 없습니다.')
  }

  if (cycle.evalYear !== targetEvalYear) {
    throw new AppError(400, 'CLONE_CYCLE_YEAR_MISMATCH', '선택한 평가 주기의 연도와 복제 대상 연도가 일치해야 합니다.')
  }

  return cycle
}

async function buildPersonalProgressSnapshot(source: PersonalKpiSource) {
  return source.monthlyRecords.map((record) => ({
    yearMonth: record.yearMonth,
    actualValue: record.actualValue ?? null,
    achievementRate: record.achievementRate ?? null,
    activities: record.activities ?? null,
    obstacles: record.obstacles ?? null,
    efforts: record.efforts ?? null,
  }))
}

async function buildPersonalCheckinSnapshot(source: PersonalKpiSource) {
  const checkIns = await prisma.checkIn.findMany({
    where: {
      ownerId: source.employeeId,
      status: 'COMPLETED',
    },
    orderBy: [{ actualDate: 'desc' }, { scheduledDate: 'desc' }],
    take: 20,
  })

  return checkIns
    .map((checkIn) => {
      const discussions = Array.isArray(checkIn.kpiDiscussed) ? checkIn.kpiDiscussed : []
      const discussion = discussions
        .map((item) => parseCheckInDiscussionItem(item))
        .find((item) => item?.kpiId === source.id)

      if (!discussion) {
        return null
      }

      return {
        checkInId: checkIn.id,
        date: (checkIn.actualDate ?? checkIn.scheduledDate).toISOString(),
        summary: checkIn.keyTakeaways ?? '최근 체크인 요약이 없습니다.',
        progress: discussion.progress,
        concern: discussion.concern,
        support: discussion.support,
      }
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .slice(0, 8)
}

async function buildOrgProgressSnapshot(source: OrgKpiSource) {
  const linkedMonthlyRecords = source.personalKpis.flatMap((personalKpi) =>
    personalKpi.monthlyRecords.map((record) => ({
      employeeName: personalKpi.employee.empName,
      yearMonth: record.yearMonth,
      activities: record.activities ?? null,
      achievementRate: record.achievementRate ?? null,
    }))
  )

  return {
    linkedPersonalKpiCount: source.personalKpis.length,
    linkedMonthlyRecordCount: linkedMonthlyRecords.length,
    averageAchievementRate: getAverageAchievementRate(linkedMonthlyRecords.map((record) => record.achievementRate)),
    recentMonthlyNotes: linkedMonthlyRecords.slice(0, 6),
  }
}

async function buildOrgCheckinSnapshot(source: OrgKpiSource) {
  const linkedPersonalKpiIds = new Set(source.personalKpis.map((item) => item.id))
  if (!linkedPersonalKpiIds.size) {
    return []
  }

  const ownerIds = Array.from(new Set(source.personalKpis.map((item) => item.employeeId)))
  const employeeNameById = new Map(source.personalKpis.map((item) => [item.employeeId, item.employee.empName]))
  const checkIns = await prisma.checkIn.findMany({
    where: {
      ownerId: { in: ownerIds },
      status: 'COMPLETED',
    },
    orderBy: [{ actualDate: 'desc' }, { scheduledDate: 'desc' }],
    take: 40,
  })

  return checkIns
    .map((checkIn) => {
      const discussions = Array.isArray(checkIn.kpiDiscussed) ? checkIn.kpiDiscussed : []
      const linkedDiscussion = discussions
        .map((item) => parseCheckInDiscussionItem(item))
        .find((item) => item && linkedPersonalKpiIds.has(item.kpiId))

      if (!linkedDiscussion) {
        return null
      }

      return {
        checkInId: checkIn.id,
        date: (checkIn.actualDate ?? checkIn.scheduledDate).toISOString(),
        ownerName: employeeNameById.get(checkIn.ownerId) ?? '직원',
        summary: checkIn.keyTakeaways ?? '최근 체크인 요약이 없습니다.',
      }
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .slice(0, 10)
}

export async function clonePersonalKpi(params: PersonalCloneParams) {
  const source = await prisma.personalKpi.findUnique({
    where: { id: params.sourceId },
    include: {
      employee: {
        select: {
          id: true,
          deptId: true,
          empName: true,
        },
      },
      linkedOrgKpi: {
        select: {
          id: true,
        },
      },
      monthlyRecords: {
        orderBy: {
          yearMonth: 'desc',
        },
        take: 6,
      },
    },
  })

  if (!source) {
    throw new AppError(404, 'PERSONAL_KPI_NOT_FOUND', '복제할 개인 KPI를 찾을 수 없습니다.')
  }

  if (!canAccessEmployee(params.session as never, source.employee)) {
    throw new AppError(403, 'FORBIDDEN', '복제할 개인 KPI에 접근할 권한이 없습니다.')
  }

  const targetEmployeeId = params.assignToSelf
    ? params.session.user.id
    : params.targetEmployeeId?.trim() || source.employeeId

  if (targetEmployeeId !== params.session.user.id && !canManagePersonalKpi(params.session.user.role)) {
    throw new AppError(403, 'FORBIDDEN', '다른 담당자에게 목표를 복제할 권한이 없습니다.')
  }

  const targetEmployee = await prisma.employee.findUnique({
    where: { id: targetEmployeeId },
    select: {
      id: true,
      deptId: true,
      empName: true,
    },
  })

  if (!targetEmployee) {
    throw new AppError(404, 'EMPLOYEE_NOT_FOUND', '복제 대상 담당자를 찾을 수 없습니다.')
  }

  if (!canAccessEmployee(params.session as never, targetEmployee)) {
    throw new AppError(403, 'FORBIDDEN', '복제 대상 담당자에 접근할 권한이 없습니다.')
  }

  const cycle = await resolveCycleSnapshot(params.targetCycleId, params.targetEvalYear)
  const existingTargets = await prisma.personalKpi.findMany({
    where: {
      employeeId: targetEmployee.id,
      evalYear: params.targetEvalYear,
    },
    select: {
      kpiName: true,
      weight: true,
      status: true,
    },
  })

  const activeWeight = existingTargets
    .filter((item) => item.status !== 'ARCHIVED')
    .reduce((sum, item) => sum + item.weight, 0)
  if (activeWeight + source.weight > 100) {
    throw new AppError(
      400,
      'WEIGHT_EXCEEDED',
      `복제 후 가중치 합계가 100을 초과합니다. 현재 ${Math.round(activeWeight * 10) / 10}, 복제 ${source.weight}`
    )
  }

  const progressSnapshot = params.includeProgress ? await buildPersonalProgressSnapshot(source) : []
  const checkinSnapshot = params.includeCheckins ? await buildPersonalCheckinSnapshot(source) : []
  const metadata: PersonalKpiCloneMetadata = {
    sourcePersonalKpiId: source.id,
    sourceEvalYear: source.evalYear,
    targetCycleId: cycle?.id ?? null,
    targetCycleName: cycle?.cycleName ?? null,
    assignedToSelf: params.assignToSelf,
    includedProgress: params.includeProgress,
    includedCheckins: params.includeCheckins,
    progressSnapshot,
    checkinSnapshot,
    clonedAt: new Date().toISOString(),
  }

  const cloned = await prisma.personalKpi.create({
    data: {
      employeeId: targetEmployee.id,
      evalYear: params.targetEvalYear,
      kpiType: source.kpiType,
      kpiName: buildCloneName(source.kpiName, existingTargets.map((item) => item.kpiName)),
      definition: source.definition,
      formula: source.formula,
      targetValue: source.targetValue,
      unit: source.unit,
      weight: source.weight,
      difficulty: source.difficulty,
      linkedOrgKpiId: source.linkedOrgKpiId,
      status: 'DRAFT',
      copiedFromPersonalKpiId: source.id,
      copyMetadata: metadata as Prisma.InputJsonValue,
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
      copiedFromPersonalKpi: {
        select: {
          id: true,
          kpiName: true,
          employee: {
            select: {
              empName: true,
            },
          },
        },
      },
    },
  })

  await createAuditLog({
    userId: params.session.user.id,
    action: 'PERSONAL_KPI_CLONED',
    entityType: 'PersonalKpi',
    entityId: cloned.id,
    oldValue: {
      copiedFromPersonalKpiId: source.id,
      sourceEvalYear: source.evalYear,
      sourceEmployeeId: source.employeeId,
    },
    newValue: {
      employeeId: cloned.employeeId,
      evalYear: cloned.evalYear,
      kpiName: cloned.kpiName,
      weight: cloned.weight,
      copiedFromPersonalKpiId: cloned.copiedFromPersonalKpiId,
      copyMetadata: metadata,
    },
    ...params.clientInfo,
  })

  return {
    id: cloned.id,
    employeeId: cloned.employeeId,
    evalYear: cloned.evalYear,
    copiedFromPersonalKpiId: cloned.copiedFromPersonalKpiId,
    copyMetadata: metadata,
  }
}

export async function cloneOrgKpi(params: OrgCloneParams) {
  if (!canManageOrgKpi(params.session.user.role)) {
    throw new AppError(403, 'FORBIDDEN', '조직 KPI를 복제할 권한이 없습니다.')
  }

  const scopeDepartmentIds = getOrgKpiScopeDepartmentIds({
    role: params.session.user.role,
    deptId: params.session.user.deptId,
    accessibleDepartmentIds: params.session.user.accessibleDepartmentIds,
  })

  const source = await prisma.orgKpi.findUnique({
    where: { id: params.sourceId },
    include: {
      department: {
        select: {
          id: true,
          deptName: true,
        },
      },
      personalKpis: {
        include: {
          employee: {
            select: {
              id: true,
              empName: true,
            },
          },
          monthlyRecords: {
            orderBy: {
              yearMonth: 'desc',
            },
            take: 3,
          },
        },
      },
    },
  })

  if (!source) {
    throw new AppError(404, 'ORG_KPI_NOT_FOUND', '복제할 조직 KPI를 찾을 수 없습니다.')
  }

  if (scopeDepartmentIds && !scopeDepartmentIds.includes(source.deptId)) {
    throw new AppError(403, 'FORBIDDEN', '복제할 조직 KPI에 접근할 권한이 없습니다.')
  }

  if (scopeDepartmentIds && !scopeDepartmentIds.includes(params.targetDeptId)) {
    throw new AppError(403, 'FORBIDDEN', '복제 대상 부서에 접근할 권한이 없습니다.')
  }

  const targetDepartment = await prisma.department.findUnique({
    where: { id: params.targetDeptId },
    select: {
      id: true,
      deptName: true,
    },
  })

  if (!targetDepartment) {
    throw new AppError(404, 'DEPARTMENT_NOT_FOUND', '복제 대상 부서를 찾을 수 없습니다.')
  }

  const cycle = await resolveCycleSnapshot(params.targetCycleId, params.targetEvalYear)
  const existingTargets = await prisma.orgKpi.findMany({
    where: {
      deptId: params.targetDeptId,
      evalYear: params.targetEvalYear,
    },
    select: {
      kpiName: true,
      weight: true,
    },
  })

  const totalWeight = existingTargets.reduce((sum, item) => sum + item.weight, 0) + source.weight
  if (totalWeight > 100) {
    throw new AppError(
      400,
      'WEIGHT_EXCEEDED',
      `복제 후 가중치 합계가 100을 초과합니다. 현재 ${Math.round((totalWeight - source.weight) * 10) / 10}, 복제 ${source.weight}`
    )
  }

  const progressSnapshot = params.includeProgress ? await buildOrgProgressSnapshot(source) : null
  const checkinSnapshot = params.includeCheckins ? await buildOrgCheckinSnapshot(source) : []
  const metadata: OrgKpiCloneMetadata = {
    sourceOrgKpiId: source.id,
    sourceEvalYear: source.evalYear,
    targetCycleId: cycle?.id ?? null,
    targetCycleName: cycle?.cycleName ?? null,
    includedProgress: params.includeProgress,
    includedCheckins: params.includeCheckins,
    progressSnapshot,
    checkinSnapshot,
    clonedAt: new Date().toISOString(),
  }

  const cloned = await prisma.orgKpi.create({
    data: {
      deptId: params.targetDeptId,
      evalYear: params.targetEvalYear,
      kpiType: source.kpiType,
      kpiCategory: source.kpiCategory,
      kpiName: buildCloneName(source.kpiName, existingTargets.map((item) => item.kpiName)),
      definition: source.definition,
      formula: source.formula,
      targetValue: source.targetValue,
      unit: source.unit,
      weight: source.weight,
      difficulty: source.difficulty,
      status: 'DRAFT',
      copiedFromOrgKpiId: source.id,
      copyMetadata: metadata as Prisma.InputJsonValue,
    },
    include: {
      department: {
        select: {
          deptName: true,
          deptCode: true,
        },
      },
      copiedFromOrgKpi: {
        select: {
          id: true,
          kpiName: true,
          department: {
            select: {
              deptName: true,
            },
          },
        },
      },
    },
  })

  await createAuditLog({
    userId: params.session.user.id,
    action: 'ORG_KPI_CLONED',
    entityType: 'OrgKpi',
    entityId: cloned.id,
    oldValue: {
      copiedFromOrgKpiId: source.id,
      sourceEvalYear: source.evalYear,
      sourceDeptId: source.deptId,
    },
    newValue: {
      deptId: cloned.deptId,
      evalYear: cloned.evalYear,
      kpiName: cloned.kpiName,
      weight: cloned.weight,
      copiedFromOrgKpiId: cloned.copiedFromOrgKpiId,
      copyMetadata: metadata,
    },
    ...params.clientInfo,
  })

  return {
    id: cloned.id,
    deptId: cloned.deptId,
    evalYear: cloned.evalYear,
    copiedFromOrgKpiId: cloned.copiedFromOrgKpiId,
    copyMetadata: metadata,
  }
}
