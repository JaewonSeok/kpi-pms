import type {
  AIApprovalStatus,
  AIRequestStatus,
  Difficulty,
  KpiStatus,
  KpiType,
  Prisma,
  SystemRole,
} from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { isFeatureEnabled } from '@/lib/feature-flags'
import {
  hasRejectedRevisionPending,
  resolvePersonalKpiOperationalStatus,
  type PersonalKpiOperationalStatus,
} from './personal-kpi-workflow'

export type PersonalKpiPageState = 'ready' | 'empty' | 'permission-denied' | 'error'

export type PersonalKpiScopeOption = {
  id: string
  name: string
  departmentName: string
  role: SystemRole
}

export type EvalCycleOption = {
  id: string
  name: string
  year: number
  status: string
}

export type PersonalKpiTimelineItem = {
  id: string
  at: string
  actor: string
  action: string
  detail?: string
  fromStatus?: string
  toStatus?: string
  note?: string
}

export type PersonalKpiAiLogItem = {
  id: string
  createdAt: string
  sourceType: string
  sourceId?: string
  requesterName: string
  requestStatus: AIRequestStatus
  approvalStatus: AIApprovalStatus
  summary: string
}

export type PersonalKpiViewModel = {
  id: string
  title: string
  employeeId: string
  employeeName: string
  departmentName: string
  orgKpiId?: string | null
  orgKpiTitle?: string | null
  orgKpiCategory?: string | null
  orgKpiDefinition?: string | null
  type: KpiType
  definition?: string
  formula?: string
  targetValue?: number | string
  unit?: string
  weight: number
  difficulty?: Difficulty
  status: PersonalKpiOperationalStatus
  persistedStatus: KpiStatus
  reviewComment?: string
  reviewer?: {
    id: string
    name: string
  }
  monthlyAchievementRate?: number
  updatedAt?: string
  hasRejectedRevision: boolean
  linkedMonthlyCount: number
  riskFlags: string[]
  recentMonthlyRecords: Array<{
    id: string
    month: string
    achievementRate?: number
    activities?: string | null
    obstacles?: string | null
  }>
  history: PersonalKpiTimelineItem[]
}

export type PersonalKpiReviewQueueItem = {
  id: string
  employeeId: string
  employeeName: string
  departmentName: string
  title: string
  status: 'SUBMITTED' | 'MANAGER_REVIEW'
  changedFields: string[]
  previousValueSummary?: string
  currentValueSummary?: string
  submittedAt?: string
  reviewComment?: string
}

export type OrgKpiOption = {
  id: string
  title: string
  category?: string
  departmentName: string
  description?: string | null
}

export type PersonalKpiPageData = {
  state: PersonalKpiPageState
  message?: string
  selectedYear: number
  availableYears: number[]
  selectedEmployeeId: string
  selectedCycleId?: string
  cycleOptions: EvalCycleOption[]
  employeeOptions: PersonalKpiScopeOption[]
  orgKpiOptions: OrgKpiOption[]
  summary: {
    totalCount: number
    totalWeight: number
    remainingWeight: number
    linkedOrgKpiCount: number
    rejectedCount: number
    reviewPendingCount: number
    monthlyCoverageRate: number
    overallStatus: PersonalKpiOperationalStatus | 'MIXED'
  }
  mine: PersonalKpiViewModel[]
  reviewQueue: PersonalKpiReviewQueueItem[]
  history: PersonalKpiTimelineItem[]
  aiLogs: PersonalKpiAiLogItem[]
  permissions: {
    canEdit: boolean
    canCreate: boolean
    canSubmit: boolean
    canReview: boolean
    canLock: boolean
    canUseAi: boolean
    canOverride: boolean
  }
  actor: {
    id: string
    role: SystemRole
    name: string
    departmentName: string
  }
}

type PersonalKpiWithRelations = Prisma.PersonalKpiGetPayload<{
  include: {
    employee: {
      include: {
        department: true
      }
    }
    linkedOrgKpi: {
      include: {
        department: true
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

type EmployeeLite = Prisma.EmployeeGetPayload<{
  include: {
    department: true
  }
}>

type AuditLogLite = {
  id: string
  action: string
  entityId: string | null
  oldValue: Prisma.JsonValue | null
  newValue: Prisma.JsonValue | null
  timestamp: Date
  userId: string
}

type PageParams = {
  session: {
    user: {
      id: string
      role: SystemRole
      name: string
      deptId: string
      deptName: string
      accessibleDepartmentIds: string[]
    }
  }
  year?: number
  employeeId?: string
  cycleId?: string
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function getScopeDepartmentIds(params: {
  role: SystemRole
  deptId: string
  accessibleDepartmentIds: string[]
}) {
  if (params.role === 'ROLE_ADMIN' || params.role === 'ROLE_CEO') {
    return null
  }
  if (params.role === 'ROLE_MEMBER') {
    return [params.deptId]
  }
  return params.accessibleDepartmentIds.length ? params.accessibleDepartmentIds : [params.deptId]
}

function getReviewerCandidate(employee: EmployeeLite, employeesById: Map<string, EmployeeLite>) {
  const reviewerId = employee.teamLeaderId ?? employee.sectionChiefId ?? employee.divisionHeadId
  if (!reviewerId) return undefined
  const reviewer = employeesById.get(reviewerId)
  if (!reviewer) return undefined
  return {
    id: reviewer.id,
    name: reviewer.empName,
  }
}

function parseReviewComment(logs: AuditLogLite[]) {
  const reviewLog = logs.find((log) =>
    ['PERSONAL_KPI_REJECTED', 'PERSONAL_KPI_APPROVED', 'PERSONAL_KPI_REVIEW_STARTED'].includes(log.action)
  )
  const nextValue = asRecord(reviewLog?.newValue)
  return typeof nextValue?.note === 'string' ? nextValue.note : undefined
}

function getChangedFields(logs: AuditLogLite[]) {
  const updated = logs.find((log) => log.action === 'PERSONAL_KPI_UPDATED')
  const oldValue = asRecord(updated?.oldValue)
  const newValue = asRecord(updated?.newValue)
  if (!oldValue || !newValue) return []

  return Object.keys(newValue).filter((key) => JSON.stringify(oldValue[key]) !== JSON.stringify(newValue[key]))
}

function buildSummaryText(record: Record<string, unknown> | null) {
  if (!record) return undefined
  const title = typeof record.kpiName === 'string' ? record.kpiName : ''
  const weight = typeof record.weight === 'number' ? `${record.weight}%` : ''
  const targetValue =
    typeof record.targetValue === 'number'
      ? `${record.targetValue}${typeof record.unit === 'string' ? ` ${record.unit}` : ''}`
      : ''
  return [title, targetValue, weight].filter(Boolean).join(' · ')
}

function mapHistoryItem(log: AuditLogLite, employeesById: Map<string, EmployeeLite>): PersonalKpiTimelineItem {
  const actor = employeesById.get(log.userId)?.empName ?? '시스템'
  const oldValue = asRecord(log.oldValue)
  const newValue = asRecord(log.newValue)

  return {
    id: log.id,
    at: log.timestamp.toISOString(),
    actor,
    action: log.action,
    detail:
      typeof newValue?.detail === 'string'
        ? newValue.detail
        : typeof newValue?.reason === 'string'
          ? newValue.reason
          : undefined,
    fromStatus:
      typeof oldValue?.workflowStatus === 'string'
        ? oldValue.workflowStatus
        : typeof oldValue?.status === 'string'
          ? oldValue.status
          : undefined,
    toStatus:
      typeof newValue?.workflowStatus === 'string'
        ? newValue.workflowStatus
        : typeof newValue?.status === 'string'
          ? newValue.status
          : undefined,
    note: typeof newValue?.note === 'string' ? newValue.note : undefined,
  }
}

function deriveRiskFlags(kpi: PersonalKpiWithRelations, hasRejectedRevision: boolean) {
  const flags: string[] = []
  if (!kpi.linkedOrgKpiId) flags.push('조직 KPI 연결 누락')
  if (kpi.weight <= 0) flags.push('가중치 미설정')
  const latestRecord = kpi.monthlyRecords[0]
  if (!latestRecord) {
    flags.push('최근 월간 실적 없음')
  } else if ((latestRecord.achievementRate ?? 100) < 80) {
    flags.push('최근 달성률 저조')
  }
  if (hasRejectedRevision) flags.push('반려 후 수정 필요')
  return flags
}

function deriveOverallStatus(items: PersonalKpiViewModel[]): PersonalKpiPageData['summary']['overallStatus'] {
  if (!items.length) return 'DRAFT'
  const statuses = Array.from(new Set(items.map((item) => item.status)))
  return statuses.length === 1 ? statuses[0] : 'MIXED'
}

export async function getPersonalKpiPageData(params: PageParams): Promise<PersonalKpiPageData> {
  try {
    const scopeDepartmentIds = getScopeDepartmentIds({
      role: params.session.user.role,
      deptId: params.session.user.deptId,
      accessibleDepartmentIds: params.session.user.accessibleDepartmentIds,
    })

    const employeeWhere = scopeDepartmentIds
      ? { deptId: { in: scopeDepartmentIds }, status: 'ACTIVE' as const }
      : { status: 'ACTIVE' as const }

    const employees = await prisma.employee.findMany({
      where: employeeWhere,
      include: {
        department: true,
      },
      orderBy: [{ deptId: 'asc' }, { empName: 'asc' }],
    })

    const employeesById = new Map(employees.map((employee) => [employee.id, employee]))
    const targetEmployee =
      employeesById.get(params.employeeId ?? params.session.user.id) ??
      employeesById.get(params.session.user.id)

    if (!targetEmployee) {
      return {
        state: 'permission-denied',
        message: '조회 가능한 직원 범위를 찾을 수 없습니다.',
        selectedYear: params.year ?? new Date().getFullYear(),
        availableYears: [params.year ?? new Date().getFullYear()],
        selectedEmployeeId: params.session.user.id,
        cycleOptions: [],
        employeeOptions: [],
        orgKpiOptions: [],
        summary: {
          totalCount: 0,
          totalWeight: 0,
          remainingWeight: 100,
          linkedOrgKpiCount: 0,
          rejectedCount: 0,
          reviewPendingCount: 0,
          monthlyCoverageRate: 0,
          overallStatus: 'DRAFT',
        },
        mine: [],
        reviewQueue: [],
        history: [],
        aiLogs: [],
        permissions: {
          canEdit: false,
          canCreate: false,
          canSubmit: false,
          canReview: false,
          canLock: false,
          canUseAi: false,
          canOverride: false,
        },
        actor: {
          id: params.session.user.id,
          role: params.session.user.role,
          name: params.session.user.name,
          departmentName: params.session.user.deptName,
        },
      }
    }

    const selectedYear = params.year ?? new Date().getFullYear()

    const selectedDepartment = await prisma.department.findUnique({
      where: { id: targetEmployee.deptId },
      include: {
        organization: true,
      },
    })

    const cycleOptions = selectedDepartment
      ? await prisma.evalCycle.findMany({
          where: {
            orgId: selectedDepartment.organization.id,
            evalYear: selectedYear,
          },
          orderBy: [{ evalYear: 'desc' }, { createdAt: 'desc' }],
        })
      : []

    const selectedCycleId =
      params.cycleId && cycleOptions.some((cycle) => cycle.id === params.cycleId)
        ? params.cycleId
        : cycleOptions[0]?.id

    const availableYearsRaw = await prisma.personalKpi.findMany({
      where: {
        employeeId: targetEmployee.id,
      },
      select: {
        evalYear: true,
      },
      distinct: ['evalYear'],
      orderBy: {
        evalYear: 'desc',
      },
    })

    const availableYears = Array.from(
      new Set([selectedYear, ...availableYearsRaw.map((item) => item.evalYear), ...cycleOptions.map((item) => item.evalYear)])
    ).sort((a, b) => b - a)

    const mine = await prisma.personalKpi.findMany({
      where: {
        employeeId: targetEmployee.id,
        evalYear: selectedYear,
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
          orderBy: {
            yearMonth: 'desc',
          },
          take: 6,
        },
      },
      orderBy: [{ createdAt: 'asc' }],
    })

    const reviewQueueCandidates = params.session.user.role === 'ROLE_MEMBER'
      ? []
      : await prisma.personalKpi.findMany({
          where: {
            evalYear: selectedYear,
            employee: scopeDepartmentIds
              ? {
                  deptId: { in: scopeDepartmentIds },
                }
              : undefined,
            NOT: {
              employeeId: params.session.user.id,
            },
          },
          include: {
            employee: {
              include: {
                department: true,
              },
            },
            linkedOrgKpi: true,
            monthlyRecords: {
              orderBy: {
                yearMonth: 'desc',
              },
              take: 1,
            },
          },
          orderBy: [{ updatedAt: 'desc' }],
        })

    const allKpiIds = [...mine.map((item) => item.id), ...reviewQueueCandidates.map((item) => item.id)]

    const auditLogs = allKpiIds.length
      ? await prisma.auditLog.findMany({
          where: {
            entityType: 'PersonalKpi',
            entityId: { in: allKpiIds },
          },
          orderBy: {
            timestamp: 'desc',
          },
          take: Math.max(120, allKpiIds.length * 8),
        })
      : []

    const logsByKpiId = new Map<string, AuditLogLite[]>()
    auditLogs.forEach((log) => {
      if (!log.entityId) return
      const current = logsByKpiId.get(log.entityId) ?? []
      current.push(log)
      logsByKpiId.set(log.entityId, current)
    })

    const linkedOrgKpiDeptIds = Array.from(
      new Set([
        targetEmployee.deptId,
        ...mine.map((item) => item.linkedOrgKpi?.deptId).filter((value): value is string => Boolean(value)),
      ])
    )

    const orgKpiOptions = await prisma.orgKpi.findMany({
      where: {
        evalYear: selectedYear,
        deptId: {
          in: scopeDepartmentIds ?? linkedOrgKpiDeptIds,
        },
        status: {
          not: 'ARCHIVED',
        },
      },
      include: {
        department: true,
      },
      orderBy: [{ deptId: 'asc' }, { kpiName: 'asc' }],
    })

    const aiLogs = await prisma.aiRequestLog.findMany({
      where: {
        sourceType: {
          in: [
            'PersonalKpiDraft',
            'PersonalKpiWording',
            'PersonalKpiSmart',
            'PersonalKpiWeight',
            'PersonalKpiAlignment',
            'PersonalKpiDuplicate',
            'PersonalKpiReviewerRisk',
            'PersonalKpiMonthlyComment',
          ],
        },
        OR: [
          { requesterId: params.session.user.id },
          { sourceId: { in: mine.map((item) => item.id) } },
        ],
      },
      include: {
        requester: {
          select: {
            empName: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 20,
    })

    const feedbacks = await prisma.multiFeedback.findMany({
      where: {
        receiverId: targetEmployee.id,
        status: 'SUBMITTED',
      },
      include: {
        giver: {
          select: {
            empName: true,
          },
        },
      },
      orderBy: {
        submittedAt: 'desc',
      },
      take: 10,
    })

    const feedbackSummary = feedbacks
      .map((item) => item.overallComment)
      .filter((value): value is string => Boolean(value))
      .slice(0, 2)
      .join(' / ')

    const mappedMine = mine.map((kpi) => {
      const logs = logsByKpiId.get(kpi.id) ?? []
      const status = resolvePersonalKpiOperationalStatus({
        status: kpi.status,
        logs,
      })
      const hasRejectedRevision = hasRejectedRevisionPending(logs)
      const latestRecord = kpi.monthlyRecords[0]

      return {
        id: kpi.id,
        title: kpi.kpiName,
        employeeId: kpi.employeeId,
        employeeName: kpi.employee.empName,
        departmentName: kpi.employee.department.deptName,
        orgKpiId: kpi.linkedOrgKpiId,
        orgKpiTitle: kpi.linkedOrgKpi?.kpiName ?? null,
        orgKpiCategory: kpi.linkedOrgKpi?.kpiCategory ?? null,
        orgKpiDefinition: kpi.linkedOrgKpi?.definition ?? null,
        type: kpi.kpiType,
        definition: kpi.definition ?? undefined,
        formula: kpi.formula ?? undefined,
        targetValue: kpi.targetValue ?? undefined,
        unit: kpi.unit ?? undefined,
        weight: kpi.weight,
        difficulty: kpi.difficulty,
        status,
        persistedStatus: kpi.status,
        reviewComment: parseReviewComment(logs),
        reviewer: getReviewerCandidate(kpi.employee, employeesById),
        monthlyAchievementRate: latestRecord?.achievementRate ?? undefined,
        updatedAt: kpi.updatedAt.toISOString(),
        hasRejectedRevision,
        linkedMonthlyCount: kpi.monthlyRecords.length,
        riskFlags: deriveRiskFlags(kpi, hasRejectedRevision),
        recentMonthlyRecords: kpi.monthlyRecords.map((record) => ({
          id: record.id,
          month: record.yearMonth,
          achievementRate: record.achievementRate ?? undefined,
          activities: record.activities,
          obstacles: record.obstacles,
        })),
        history: logs.slice(0, 10).map((log) => mapHistoryItem(log, employeesById)),
      } satisfies PersonalKpiViewModel
    })

    const mappedReviewQueue = reviewQueueCandidates.reduce<PersonalKpiReviewQueueItem[]>((queue, kpi) => {
      const logs = logsByKpiId.get(kpi.id) ?? []
      const status = resolvePersonalKpiOperationalStatus({
        status: kpi.status,
        logs,
      })

      if (status !== 'SUBMITTED' && status !== 'MANAGER_REVIEW') {
        return queue
      }

      const lastSubmit = logs.find((log) => log.action === 'PERSONAL_KPI_SUBMITTED')
      const updateLog = logs.find((log) => log.action === 'PERSONAL_KPI_UPDATED')

      queue.push({
        id: kpi.id,
        employeeId: kpi.employeeId,
        employeeName: kpi.employee.empName,
        departmentName: kpi.employee.department.deptName,
        title: kpi.kpiName,
        status,
        changedFields: getChangedFields(logs),
        previousValueSummary: buildSummaryText(asRecord(updateLog?.oldValue)),
        currentValueSummary: buildSummaryText(asRecord(updateLog?.newValue)) ?? `${kpi.kpiName} · ${kpi.weight}%`,
        submittedAt: lastSubmit?.timestamp.toISOString() ?? kpi.updatedAt.toISOString(),
        reviewComment: parseReviewComment(logs),
      })

      return queue
    }, [])

    const totalWeight = mappedMine.reduce((sum, item) => sum + item.weight, 0)
    const linkedOrgKpiCount = mappedMine.filter((item) => item.orgKpiId).length
    const rejectedCount = mappedMine.filter((item) => item.hasRejectedRevision).length
    const reviewPendingCount = mappedReviewQueue.length
    const monthlyCoverageRate = mappedMine.length
      ? Math.round((mappedMine.filter((item) => item.linkedMonthlyCount > 0).length / mappedMine.length) * 100)
      : 0

    const permissions = {
      canEdit:
        targetEmployee.id === params.session.user.id ||
        ['ROLE_ADMIN', 'ROLE_TEAM_LEADER', 'ROLE_SECTION_CHIEF', 'ROLE_DIV_HEAD', 'ROLE_CEO'].includes(params.session.user.role),
      canCreate:
        targetEmployee.id === params.session.user.id ||
        ['ROLE_ADMIN', 'ROLE_TEAM_LEADER', 'ROLE_SECTION_CHIEF', 'ROLE_DIV_HEAD', 'ROLE_CEO'].includes(params.session.user.role),
      canSubmit:
        targetEmployee.id === params.session.user.id ||
        ['ROLE_ADMIN', 'ROLE_TEAM_LEADER', 'ROLE_SECTION_CHIEF', 'ROLE_DIV_HEAD', 'ROLE_CEO'].includes(params.session.user.role),
      canReview: ['ROLE_ADMIN', 'ROLE_TEAM_LEADER', 'ROLE_SECTION_CHIEF', 'ROLE_DIV_HEAD', 'ROLE_CEO'].includes(params.session.user.role),
      canLock: ['ROLE_ADMIN', 'ROLE_TEAM_LEADER', 'ROLE_SECTION_CHIEF', 'ROLE_DIV_HEAD', 'ROLE_CEO'].includes(params.session.user.role),
      canUseAi: isFeatureEnabled('aiAssist'),
      canOverride: ['ROLE_ADMIN'].includes(params.session.user.role),
    }

    return {
      state: mappedMine.length || mappedReviewQueue.length ? 'ready' : 'empty',
      message:
        !mappedMine.length && !mappedReviewQueue.length
          ? '아직 개인 KPI가 없습니다. 올해 목표를 작성하고 상사 검토를 요청해보세요.'
          : undefined,
      selectedYear,
      availableYears,
      selectedEmployeeId: targetEmployee.id,
      selectedCycleId,
      cycleOptions: cycleOptions.map((cycle) => ({
        id: cycle.id,
        name: cycle.cycleName,
        year: cycle.evalYear,
        status: cycle.status,
      })),
      employeeOptions: employees.map((employee) => ({
        id: employee.id,
        name: employee.empName,
        departmentName: employee.department.deptName,
        role: employee.role,
      })),
      orgKpiOptions: orgKpiOptions.map((item) => ({
        id: item.id,
        title: item.kpiName,
        category: item.kpiCategory,
        departmentName: item.department.deptName,
        description: item.definition,
      })),
      summary: {
        totalCount: mappedMine.length,
        totalWeight: Math.round(totalWeight * 10) / 10,
        remainingWeight: Math.round(Math.max(0, 100 - totalWeight) * 10) / 10,
        linkedOrgKpiCount,
        rejectedCount,
        reviewPendingCount,
        monthlyCoverageRate,
        overallStatus: deriveOverallStatus(mappedMine),
      },
      mine: mappedMine,
      reviewQueue: mappedReviewQueue,
      history: auditLogs
        .filter((log) => mine.some((item) => item.id === log.entityId))
        .slice(0, 40)
        .map((log) => mapHistoryItem(log, employeesById)),
      aiLogs: aiLogs.map((log) => ({
        id: log.id,
        createdAt: log.createdAt.toISOString(),
        sourceType: log.sourceType ?? 'PersonalKpiDraft',
        sourceId: log.sourceId ?? undefined,
        requesterName: log.requester.empName,
        requestStatus: log.requestStatus,
        approvalStatus: log.approvalStatus,
        summary:
          (asRecord(log.requestPayload)?.summary as string | undefined) ??
          (asRecord(log.responsePayload)?.summary as string | undefined) ??
          feedbackSummary ??
          '개인 KPI AI 보조 요청',
      })),
      permissions,
      actor: {
        id: params.session.user.id,
        role: params.session.user.role,
        name: params.session.user.name,
        departmentName: params.session.user.deptName,
      },
    }
  } catch (error) {
    console.error('Failed to build personal KPI page data:', error)
    return {
      state: 'error',
      message: '개인 KPI 데이터를 불러오는 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.',
      selectedYear: params.year ?? new Date().getFullYear(),
      availableYears: [params.year ?? new Date().getFullYear()],
      selectedEmployeeId: params.employeeId ?? params.session.user.id,
      cycleOptions: [],
      employeeOptions: [],
      orgKpiOptions: [],
      summary: {
        totalCount: 0,
        totalWeight: 0,
        remainingWeight: 100,
        linkedOrgKpiCount: 0,
        rejectedCount: 0,
        reviewPendingCount: 0,
        monthlyCoverageRate: 0,
        overallStatus: 'DRAFT',
      },
      mine: [],
      reviewQueue: [],
      history: [],
      aiLogs: [],
      permissions: {
        canEdit: false,
        canCreate: false,
        canSubmit: false,
        canReview: false,
        canLock: false,
        canUseAi: false,
        canOverride: false,
      },
      actor: {
        id: params.session.user.id,
        role: params.session.user.role,
        name: params.session.user.name,
        departmentName: params.session.user.deptName,
      },
    }
  }
}
