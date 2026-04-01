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
import {
  buildPersonalKpiPermissions,
  canManagePersonalKpi,
  getPersonalKpiScopeDepartmentIds,
  resolvePersonalKpiAiAccess,
} from '@/lib/personal-kpi-access'
import {
  hasRejectedRevisionPending,
  resolvePersonalKpiOperationalStatus,
  type PersonalKpiOperationalStatus,
} from './personal-kpi-workflow'

export type PersonalKpiPageState =
  | 'ready'
  | 'empty'
  | 'no-target'
  | 'setup-required'
  | 'permission-denied'
  | 'error'

export type PersonalKpiPageAlert = {
  title: string
  description: string
}

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
  tags: string[]
  employeeId: string
  employeeName: string
  departmentName: string
  orgKpiId?: string | null
  orgKpiTitle?: string | null
  orgKpiCategory?: string | null
  orgKpiDefinition?: string | null
  orgLineage: Array<{
    id: string
    title: string
    departmentName: string
  }>
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
  cloneInfo?: {
    sourceId: string
    sourceTitle: string
    sourceOwnerName?: string
    sourceEvalYear: number
    includedProgress: boolean
    includedCheckins: boolean
    progressEntryCount: number
    checkinEntryCount: number
    assignedToSelf: boolean
    clonedAt?: string
  }
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
  tags: string[]
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
  alerts?: PersonalKpiPageAlert[]
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
    copiedFromPersonalKpi: {
      select: {
        id: true
        kpiName: true
        evalYear: true
        employee: {
          select: {
            empName: true
          }
        }
      }
    }
  }
}>

type ReviewQueueKpi = Prisma.PersonalKpiGetPayload<{
  include: {
    employee: {
      include: {
        department: true
      }
    }
    linkedOrgKpi: true
    monthlyRecords: {
      orderBy: {
        yearMonth: 'desc'
      }
      take: 1
    }
  }
}>

type OrgKpiRecord = Prisma.OrgKpiGetPayload<{
  include: {
    department: true
    parentOrgKpi: {
      select: {
        id: true
        kpiName: true
        deptId: true
        parentOrgKpiId: true
        department: {
          select: {
            deptName: true
          }
        }
      }
    }
  }
}>

type PersonalAiLogRecord = Prisma.AiRequestLogGetPayload<{
  include: {
    requester: {
      select: {
        empName: true
      }
    }
  }
}>

type EmployeeLite = Prisma.EmployeeGetPayload<{
  select: {
    id: true
    empId: true
    empName: true
    role: true
    deptId: true
    teamLeaderId: true
    sectionChiefId: true
    divisionHeadId: true
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

async function loadPersonalKpiSection<T>(params: {
  alerts: PersonalKpiPageAlert[]
  title: string
  description: string
  fallback: T
  loader: () => Promise<T>
}) {
  try {
    return await params.loader()
  } catch (error) {
    console.error(`[personal-kpi] ${params.title}`, error)
    params.alerts.push({
      title: params.title,
      description: params.description,
    })
    return params.fallback
  }
}

function mapPersonalKpiSection<TInput, TOutput>(params: {
  alerts: PersonalKpiPageAlert[]
  title: string
  description: string
  items: TInput[]
  mapper: (item: TInput) => TOutput | undefined
}) {
  const mapped: TOutput[] = []
  let failed = false

  for (const item of params.items) {
    try {
      const next = params.mapper(item)
      if (typeof next !== 'undefined') {
        mapped.push(next)
      }
    } catch (error) {
      failed = true
      console.error(`[personal-kpi] ${params.title}`, error)
    }
  }

  if (failed) {
    params.alerts.push({
      title: params.title,
      description: params.description,
    })
  }

  return mapped
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

function resolveDepartmentLabel(department?: { deptName?: string | null } | null) {
  const name = department?.deptName?.trim()
  return name?.length ? name : '미지정 부서'
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
  if (!kpi.linkedOrgKpiId) flags.push('조직 KPI 연결 필요')
  if (kpi.weight <= 0) flags.push('가중치 확인 필요')
  const latestRecord = kpi.monthlyRecords[0]
  if (!latestRecord) {
    flags.push('최근 월간 실적 없음')
  } else if ((latestRecord.achievementRate ?? 100) < 80) {
    flags.push('최근 달성률 저조')
  }
  if (hasRejectedRevision) flags.push('반려 후 수정 필요')
  return flags
}

function parseCloneInfo(kpi: PersonalKpiWithRelations): PersonalKpiViewModel['cloneInfo'] {
  if (!kpi.copiedFromPersonalKpiId || !kpi.copiedFromPersonalKpi) {
    return undefined
  }

  const metadata = asRecord(kpi.copyMetadata)
  const progressSnapshot = Array.isArray(metadata?.progressSnapshot) ? metadata.progressSnapshot : []
  const checkinSnapshot = Array.isArray(metadata?.checkinSnapshot) ? metadata.checkinSnapshot : []

  return {
    sourceId: kpi.copiedFromPersonalKpi.id,
    sourceTitle: kpi.copiedFromPersonalKpi.kpiName,
    sourceOwnerName: kpi.copiedFromPersonalKpi.employee.empName,
    sourceEvalYear:
      typeof metadata?.sourceEvalYear === 'number'
        ? metadata.sourceEvalYear
        : kpi.copiedFromPersonalKpi.evalYear,
    includedProgress: metadata?.includedProgress === true,
    includedCheckins: metadata?.includedCheckins === true,
    progressEntryCount: progressSnapshot.length,
    checkinEntryCount: checkinSnapshot.length,
    assignedToSelf: metadata?.assignedToSelf === true,
    clonedAt: typeof metadata?.clonedAt === 'string' ? metadata.clonedAt : undefined,
  }
}

function parseTags(value: Prisma.JsonValue | null): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function deriveOverallStatus(items: PersonalKpiViewModel[]): PersonalKpiPageData['summary']['overallStatus'] {
  if (!items.length) return 'DRAFT'
  const statuses = Array.from(new Set(items.map((item) => item.status)))
  return statuses.length === 1 ? statuses[0] : 'MIXED'
}

export async function getPersonalKpiPageData(params: PageParams): Promise<PersonalKpiPageData> {
  const selectedYear = params.year ?? new Date().getFullYear()
  const actor = {
    id: params.session.user.id,
    role: params.session.user.role,
    name: params.session.user.name,
    departmentName: params.session.user.deptName,
  }
  const aiAccess = resolvePersonalKpiAiAccess({
    role: params.session.user.role,
  })
  const emptySummary: PersonalKpiPageData['summary'] = {
    totalCount: 0,
    totalWeight: 0,
    remainingWeight: 100,
    linkedOrgKpiCount: 0,
    rejectedCount: 0,
    reviewPendingCount: 0,
    monthlyCoverageRate: 0,
    overallStatus: 'DRAFT',
  }

  let failureStage = 'bootstrap'
  let shellEmployeeOptions: PersonalKpiScopeOption[] = []
  let shellTargetEmployee: EmployeeLite | undefined
  let shellCycleOptions: EvalCycleOption[] = []
  let shellAlerts: PersonalKpiPageAlert[] = []

  try {
    const alerts: PersonalKpiPageAlert[] = []
    shellAlerts = alerts

    const scopeDepartmentIds = getPersonalKpiScopeDepartmentIds({
      role: params.session.user.role,
      deptId: params.session.user.deptId,
      accessibleDepartmentIds: params.session.user.accessibleDepartmentIds,
    })

    failureStage = 'employee-options'
    const employees = await prisma.employee.findMany({
      where: scopeDepartmentIds
        ? { deptId: { in: scopeDepartmentIds }, status: 'ACTIVE' }
        : { status: 'ACTIVE' },
      select: {
        id: true,
        empId: true,
        empName: true,
        role: true,
        deptId: true,
        teamLeaderId: true,
        sectionChiefId: true,
        divisionHeadId: true,
      },
      orderBy: [{ deptId: 'asc' }, { empName: 'asc' }],
    })
    const departmentIds = Array.from(
      new Set(
        employees
          .map((employee) => employee.deptId)
          .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      )
    )
    const departments = departmentIds.length
      ? await loadPersonalKpiSection({
          alerts,
          title: '대상자 부서 정보를 모두 불러오지 못했습니다.',
          description: '대상자 목록은 유지하고, 확인되지 않은 부서는 미지정으로 표시합니다.',
          fallback: [] as Array<{ id: string; deptName: string | null; parentDeptId: string | null }>,
          loader: () =>
            prisma.department.findMany({
              where: {
                id: {
                  in: departmentIds,
                },
              },
              select: {
                id: true,
                deptName: true,
                parentDeptId: true,
              },
            }),
        })
      : []
    const departmentNameMap = new Map(departments.map((department) => [department.id, department.deptName]))
    const departmentsById = new Map(departments.map((department) => [department.id, department]))
    const employeesById = new Map(employees.map((employee) => [employee.id, employee]))
    const collectAncestorDepartmentIds = (deptId: string) => {
      const ids: string[] = []
      let current = departmentsById.get(deptId)

      while (current?.parentDeptId) {
        ids.push(current.parentDeptId)
        current = departmentsById.get(current.parentDeptId)
      }

      return ids
    }
    const employeeOptions = employees.map((employee) => ({
      id: employee.id,
      name: employee.empName,
      departmentName: resolveDepartmentLabel({
        deptName: departmentNameMap.get(employee.deptId) ?? null,
      }),
      role: employee.role,
    }))
    shellEmployeeOptions = employeeOptions

    const requestedEmployeeId = params.employeeId?.trim() || undefined
    const requestedEmployee = requestedEmployeeId ? employeesById.get(requestedEmployeeId) : undefined
    const defaultTargetEmployee =
      employeesById.get(params.session.user.id) ??
      (canManagePersonalKpi(params.session.user.role) ? employees[0] : undefined)
    const targetEmployee = requestedEmployee ?? defaultTargetEmployee
    shellTargetEmployee = targetEmployee

    if (requestedEmployeeId && !requestedEmployee) {
      return {
        state: 'no-target',
        message: '현재 범위에서 조회할 대상자를 찾지 못했습니다. 대상자를 다시 선택해 주세요.',
        alerts,
        selectedYear,
        availableYears: [selectedYear],
        selectedEmployeeId: '',
        cycleOptions: [],
        employeeOptions,
        orgKpiOptions: [],
        summary: emptySummary,
        mine: [],
        reviewQueue: [],
        history: [],
        aiLogs: [],
        permissions: buildPersonalKpiPermissions({
          actorId: params.session.user.id,
          actorRole: params.session.user.role,
          targetEmployeeId: requestedEmployeeId,
          pageState: 'no-target',
          aiAccess,
        }),
        actor,
      }
    }

    if (!targetEmployee) {
      const pageState: PersonalKpiPageState = canManagePersonalKpi(params.session.user.role)
        ? 'setup-required'
        : 'permission-denied'

      return {
        state: pageState,
        message:
          pageState === 'setup-required'
            ? '조회 가능한 대상자가 없어 개인 KPI 운영을 시작할 수 없습니다. 대상자 범위 또는 조직 설정을 확인해 주세요.'
            : '조회 가능한 직원 범위를 찾을 수 없습니다.',
        alerts,
        selectedYear,
        availableYears: [selectedYear],
        selectedEmployeeId: '',
        cycleOptions: [],
        employeeOptions,
        orgKpiOptions: [],
        summary: emptySummary,
        mine: [],
        reviewQueue: [],
        history: [],
        aiLogs: [],
        permissions: buildPersonalKpiPermissions({
          actorId: params.session.user.id,
          actorRole: params.session.user.role,
          targetEmployeeId: params.employeeId ?? params.session.user.id,
          pageState,
          aiAccess,
        }),
        actor,
      }
    }

    failureStage = 'cycle-options'
    const cycleRecords = await loadPersonalKpiSection({
      alerts,
      title: '평가 주기 옵션을 불러오지 못했습니다.',
      description: '주기 선택은 비어 있는 상태로 표시합니다.',
      fallback: [] as Array<{
        id: string
        cycleName: string
        evalYear: number
        status: string
        goalEditMode?: string
      }>,
      loader: async () => {
        const selectedDepartment = await prisma.department.findUnique({
          where: { id: targetEmployee.deptId },
          include: {
            organization: true,
          },
        })

        if (!selectedDepartment) return []

        return prisma.evalCycle.findMany({
          where: {
            orgId: selectedDepartment.organization.id,
            evalYear: selectedYear,
          },
          orderBy: [{ evalYear: 'desc' }, { createdAt: 'desc' }],
        })
      },
    })

    const cycleOptions = cycleRecords.map((cycle) => ({
      id: cycle.id,
      name: cycle.cycleName,
      year: cycle.evalYear,
      status: cycle.status,
    }))
    shellCycleOptions = cycleOptions

    const selectedCycleId =
      params.cycleId && cycleOptions.some((cycle) => cycle.id === params.cycleId)
        ? params.cycleId
        : cycleOptions[0]?.id
    const selectedCycleRecord = cycleRecords.find((cycle) => cycle.id === selectedCycleId)

    failureStage = 'available-years'
    const availableYearsRaw = await loadPersonalKpiSection({
      alerts,
      title: '개인 KPI 연도 옵션을 불러오지 못했습니다.',
      description: '연도 선택은 현재 연도 기준으로 표시합니다.',
      fallback: [] as Array<{ evalYear: number }>,
      loader: () =>
        prisma.personalKpi.findMany({
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
        }),
    })

    const availableYears = Array.from(
      new Set([selectedYear, ...availableYearsRaw.map((item) => item.evalYear), ...cycleOptions.map((item) => item.year)])
    ).sort((a, b) => b - a)

    failureStage = 'mine-query'
    const mine = await loadPersonalKpiSection({
      alerts,
      title: '개인 KPI 목록을 불러오지 못했습니다.',
      description: '기존 KPI 목록 없이 기본 화면으로 표시합니다.',
      fallback: [] as PersonalKpiWithRelations[],
      loader: () =>
        prisma.personalKpi.findMany({
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
            copiedFromPersonalKpi: {
              select: {
                id: true,
                kpiName: true,
                evalYear: true,
                employee: {
                  select: {
                    empName: true,
                  },
                },
              },
            },
          },
          orderBy: [{ createdAt: 'asc' }],
        }),
    })

    failureStage = 'review-queue'
    const reviewQueueCandidates: ReviewQueueKpi[] =
      params.session.user.role === 'ROLE_MEMBER'
        ? []
        : await loadPersonalKpiSection({
            alerts,
            title: '검토 대기 KPI 목록을 불러오지 못했습니다.',
            description: '검토 대기 목록은 비어 있는 상태로 표시합니다.',
            fallback: [] as ReviewQueueKpi[],
            loader: () =>
              prisma.personalKpi.findMany({
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
              }),
          })

    const allKpiIds = [...mine.map((item) => item.id), ...reviewQueueCandidates.map((item) => item.id)]

    failureStage = 'audit-logs'
    const auditLogs = allKpiIds.length
      ? await loadPersonalKpiSection({
          alerts,
          title: 'KPI 변경 이력을 불러오지 못했습니다.',
          description: '이력 영역은 비어 있는 상태로 표시합니다.',
          fallback: [] as AuditLogLite[],
          loader: () =>
            prisma.auditLog.findMany({
              where: {
                entityType: 'PersonalKpi',
                entityId: { in: allKpiIds },
              },
              orderBy: {
                timestamp: 'desc',
              },
              take: Math.max(120, allKpiIds.length * 8),
            }) as Promise<AuditLogLite[]>,
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
        ...collectAncestorDepartmentIds(targetEmployee.deptId),
        ...mine.map((item) => item.linkedOrgKpi?.deptId).filter((value): value is string => Boolean(value)),
      ])
    )

    failureStage = 'org-kpi-options'
    const orgKpiRecords = await loadPersonalKpiSection({
      alerts,
      title: '조직 KPI 옵션을 불러오지 못했습니다.',
      description: '상위 목표 연결 목록은 비어 있는 상태로 표시합니다.',
      fallback: [] as OrgKpiRecord[],
      loader: () =>
        prisma.orgKpi.findMany({
          where: {
            evalYear: selectedYear,
            deptId: {
              in: Array.from(new Set([...(scopeDepartmentIds ?? [targetEmployee.deptId]), ...linkedOrgKpiDeptIds])),
            },
            status: {
              not: 'ARCHIVED',
            },
          },
          include: {
            department: true,
            parentOrgKpi: {
              select: {
                id: true,
                kpiName: true,
                deptId: true,
                department: {
                  select: {
                    deptName: true,
                  },
                },
                parentOrgKpiId: true,
              },
            },
          },
          orderBy: [{ deptId: 'asc' }, { kpiName: 'asc' }],
        }),
    })
    const orgKpiById = new Map(orgKpiRecords.map((item) => [item.id, item]))
    const buildOrgLineage = (orgKpiId?: string | null) => {
      const lineage: PersonalKpiViewModel['orgLineage'] = []
      let current = orgKpiId ? orgKpiById.get(orgKpiId) : undefined
      const visited = new Set<string>()

      while (current && !visited.has(current.id)) {
        visited.add(current.id)
        lineage.unshift({
          id: current.id,
          title: current.kpiName,
          departmentName: resolveDepartmentLabel(current.department),
        })
        current = current.parentOrgKpiId ? orgKpiById.get(current.parentOrgKpiId) : undefined
      }

      return lineage
    }

    failureStage = 'ai-logs'
    const aiLogRecords = await loadPersonalKpiSection({
      alerts,
      title: '개인 KPI AI 요청 이력을 불러오지 못했습니다.',
      description: 'AI 요청 이력은 비어 있는 상태로 표시합니다.',
      fallback: [] as PersonalAiLogRecord[],
      loader: () =>
        prisma.aiRequestLog.findMany({
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
        }),
    })

    failureStage = 'feedback-summary'
    const feedbacks = await loadPersonalKpiSection({
      alerts,
      title: '다면 피드백 요약을 불러오지 못했습니다.',
      description: 'AI 요약에서 참고할 피드백 없이 표시합니다.',
      fallback: [] as Awaited<ReturnType<typeof prisma.multiFeedback.findMany>>,
      loader: () =>
        prisma.multiFeedback.findMany({
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
        }),
    })
    const feedbackSummary = feedbacks
      .map((item) => item.overallComment)
      .filter((value): value is string => Boolean(value))
      .slice(0, 2)
      .join(' / ')

    failureStage = 'mine-mapping'
    const mappedMine = mapPersonalKpiSection({
      alerts,
      title: '개인 KPI 화면 정보를 구성하지 못한 항목이 있습니다.',
      description: '일부 KPI 항목을 제외하고 화면을 계속 표시합니다.',
      items: mine,
      mapper: (kpi) => {
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
          tags: parseTags(kpi.tags),
          employeeId: kpi.employeeId,
          employeeName: kpi.employee.empName,
          departmentName: resolveDepartmentLabel(kpi.employee.department),
          orgKpiId: kpi.linkedOrgKpiId,
          orgKpiTitle: kpi.linkedOrgKpi?.kpiName ?? null,
          orgKpiCategory: kpi.linkedOrgKpi?.kpiCategory ?? null,
          orgKpiDefinition: kpi.linkedOrgKpi?.definition ?? null,
          orgLineage: buildOrgLineage(kpi.linkedOrgKpiId),
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
          cloneInfo: parseCloneInfo(kpi),
          recentMonthlyRecords: kpi.monthlyRecords.map((record) => ({
            id: record.id,
            month: record.yearMonth,
            achievementRate: record.achievementRate ?? undefined,
            activities: record.activities,
            obstacles: record.obstacles,
          })),
          history: mapPersonalKpiSection({
            alerts,
            title: '개인 KPI 이력 일부를 구성하지 못했습니다.',
            description: '일부 이력 항목을 제외하고 계속 표시합니다.',
            items: logs.slice(0, 10),
            mapper: (log) => mapHistoryItem(log, employeesById),
          }),
        } satisfies PersonalKpiViewModel
      },
    })

    failureStage = 'review-queue-mapping'
    const mappedReviewQueue = mapPersonalKpiSection({
      alerts,
      title: '검토 대기 KPI 일부를 구성하지 못했습니다.',
      description: '일부 검토 대기 항목을 제외하고 계속 표시합니다.',
      items: reviewQueueCandidates,
      mapper: (kpi) => {
        const logs = logsByKpiId.get(kpi.id) ?? []
        const status = resolvePersonalKpiOperationalStatus({
          status: kpi.status,
          logs,
        })

        if (status !== 'SUBMITTED' && status !== 'MANAGER_REVIEW') {
          return undefined
        }

        const lastSubmit = logs.find((log) => log.action === 'PERSONAL_KPI_SUBMITTED')
        const updateLog = logs.find((log) => log.action === 'PERSONAL_KPI_UPDATED')

        return {
          id: kpi.id,
          employeeId: kpi.employeeId,
          employeeName: kpi.employee.empName,
          departmentName: resolveDepartmentLabel(kpi.employee.department),
          title: kpi.kpiName,
          tags: parseTags(kpi.tags),
          status,
          changedFields: getChangedFields(logs),
          previousValueSummary: buildSummaryText(asRecord(updateLog?.oldValue)),
          currentValueSummary: buildSummaryText(asRecord(updateLog?.newValue)) ?? `${kpi.kpiName} · ${kpi.weight}%`,
          submittedAt: lastSubmit?.timestamp.toISOString() ?? kpi.updatedAt.toISOString(),
          reviewComment: parseReviewComment(logs),
        } satisfies PersonalKpiReviewQueueItem
      },
    })

    failureStage = 'history-mapping'
    const mappedHistory = mapPersonalKpiSection({
      alerts,
      title: '개인 KPI 전체 이력 일부를 구성하지 못했습니다.',
      description: '일부 이력 항목을 제외하고 계속 표시합니다.',
      items: auditLogs.filter((log) => mine.some((item) => item.id === log.entityId)).slice(0, 40),
      mapper: (log) => mapHistoryItem(log, employeesById),
    })

    failureStage = 'ai-log-mapping'
    const mappedAiLogs = mapPersonalKpiSection({
      alerts,
      title: 'AI 요청 이력 일부를 구성하지 못했습니다.',
      description: '일부 AI 요청 이력을 제외하고 계속 표시합니다.',
      items: aiLogRecords,
      mapper: (log) => ({
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
      }),
    })

    const totalWeight = mappedMine.reduce((sum, item) => sum + item.weight, 0)
    const linkedOrgKpiCount = mappedMine.filter((item) => item.orgKpiId).length
    const rejectedCount = mappedMine.filter((item) => item.hasRejectedRevision).length
    const reviewPendingCount = mappedReviewQueue.length
    const monthlyCoverageRate = mappedMine.length
      ? Math.round((mappedMine.filter((item) => item.linkedMonthlyCount > 0).length / mappedMine.length) * 100)
      : 0

    const pageState: PersonalKpiPageState = mappedMine.length || mappedReviewQueue.length ? 'ready' : 'empty'
    const basePermissions = buildPersonalKpiPermissions({
      actorId: params.session.user.id,
      actorRole: params.session.user.role,
      targetEmployeeId: targetEmployee.id,
      pageState,
      aiAccess,
    })
    const goalEditLocked = selectedCycleRecord?.goalEditMode === 'CHECKIN_ONLY'

    if (goalEditLocked) {
      alerts.push({
        title: '현재 목표는 읽기 전용 모드입니다.',
        description: '목표 생성/수정/삭제는 막혀 있으며 체크인과 코멘트만 이어갈 수 있습니다.',
      })
    }

    return {
      state: pageState,
      message:
        pageState === 'empty'
          ? '아직 등록된 개인 KPI가 없습니다. 새 KPI를 작성하거나 대상자를 선택해 주세요.'
          : undefined,
      alerts,
      selectedYear,
      availableYears,
      selectedEmployeeId: targetEmployee.id,
      selectedCycleId,
      cycleOptions,
      employeeOptions,
      orgKpiOptions: orgKpiRecords.map((item) => ({
        id: item.id,
        title: item.kpiName,
        category: item.kpiCategory,
        departmentName: resolveDepartmentLabel(item.department),
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
      history: mappedHistory,
      aiLogs: mappedAiLogs,
      permissions: {
        ...basePermissions,
        canCreate: goalEditLocked ? false : basePermissions.canCreate,
        canEdit: goalEditLocked ? false : basePermissions.canEdit,
        canSubmit: goalEditLocked ? false : basePermissions.canSubmit,
      },
      actor,
    }
  } catch (error) {
    console.error('Failed to build personal KPI page data:', {
      failureStage,
      actorId: params.session.user.id,
      actorRole: params.session.user.role,
      requestedEmployeeId: params.employeeId ?? null,
      employeeOptionCount: shellEmployeeOptions.length,
      hasTargetEmployee: Boolean(shellTargetEmployee),
      error,
    })

    if (shellEmployeeOptions.length || shellTargetEmployee) {
      const pageState: PersonalKpiPageState = shellTargetEmployee
        ? 'empty'
        : canManagePersonalKpi(params.session.user.role)
          ? 'setup-required'
          : 'permission-denied'

      return {
        state: pageState,
        message:
          pageState === 'setup-required'
            ? '조회 가능한 대상자가 없어 개인 KPI 운영을 시작할 수 없습니다. 대상자 범위 또는 조직 설정을 확인해 주세요.'
            : '개인 KPI 화면을 구성하는 중 일부 보조 정보를 불러오지 못해 기본 화면으로 표시합니다.',
        alerts: [
          ...shellAlerts,
          {
            title: '개인 KPI 운영 화면 정보를 완전히 불러오지 못했습니다.',
            description: `구성 단계(${failureStage})에서 문제가 발생해 기본 화면으로 전환했습니다.`,
          },
        ],
        selectedYear,
        availableYears: [selectedYear],
        selectedEmployeeId: shellTargetEmployee?.id ?? '',
        selectedCycleId: shellCycleOptions[0]?.id,
        cycleOptions: shellCycleOptions,
        employeeOptions: shellEmployeeOptions,
        orgKpiOptions: [],
        summary: emptySummary,
        mine: [],
        reviewQueue: [],
        history: [],
        aiLogs: [],
        permissions: buildPersonalKpiPermissions({
          actorId: params.session.user.id,
          actorRole: params.session.user.role,
          targetEmployeeId: shellTargetEmployee?.id ?? params.employeeId ?? params.session.user.id,
          pageState,
          aiAccess,
        }),
        actor,
      }
    }

    return {
      state: 'error',
      message: '개인 KPI 데이터를 불러오는 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.',
      alerts: shellAlerts,
      selectedYear,
      availableYears: [selectedYear],
      selectedEmployeeId: params.employeeId ?? params.session.user.id,
      selectedCycleId: shellCycleOptions[0]?.id,
      cycleOptions: shellCycleOptions,
      employeeOptions: shellEmployeeOptions,
      orgKpiOptions: [],
      summary: emptySummary,
      mine: [],
      reviewQueue: [],
      history: [],
      aiLogs: [],
      permissions: buildPersonalKpiPermissions({
        actorId: params.session.user.id,
        actorRole: params.session.user.role,
        targetEmployeeId: params.employeeId ?? params.session.user.id,
        pageState: 'error',
        aiAccess,
      }),
      actor,
    }
  }
}
