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
import { resolveOrgKpiOperationalStatus, type OrgKpiOperationalStatus } from './org-kpi-workflow'

export type OrgKpiPageState = 'ready' | 'empty' | 'permission-denied' | 'error'

export type OrgKpiScopeOption = {
  id: string
  name: string
  parentDepartmentId: string | null
  organizationName: string
  level: number
}

export type OrgKpiTimelineItem = {
  id: string
  at: string
  actor: string
  action: string
  detail?: string
  fromStatus?: string
  toStatus?: string
}

export type OrgKpiLinkageItem = {
  orgKpiId: string
  title: string
  linkedPersonalKpiCount: number
  targetPopulationCount: number
  coverageRate: number
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'
  hasRecentMonthlyRecord: boolean
  departmentName: string
}

export type OrgKpiAiLogItem = {
  id: string
  createdAt: string
  sourceType: string
  sourceId?: string
  requesterName: string
  requestStatus: AIRequestStatus
  approvalStatus: AIApprovalStatus
  summary: string
}

export type OrgKpiViewModel = {
  id: string
  title: string
  tags: string[]
  evalYear: number
  departmentId: string
  departmentName: string
  departmentCode: string
  parentOrgKpiId?: string | null
  parentOrgKpiTitle?: string | null
  parentOrgDepartmentName?: string | null
  childOrgKpiCount: number
  lineage: Array<{
    id: string
    title: string
    departmentName: string
  }>
  category?: string
  type?: KpiType
  definition?: string
  formula?: string
  targetValue?: number | string
  unit?: string
  weight?: number
  difficulty?: Difficulty
  status: OrgKpiOperationalStatus
  persistedStatus: KpiStatus
  owner?: {
    id: string
    name: string
    position: string
  }
  linkedPersonalKpiCount: number
  linkedConfirmedPersonalKpiCount: number
  monthlyAchievementRate?: number
  updatedAt?: string
  riskFlags: string[]
  coverageRate: number
  targetPopulationCount: number
  cloneInfo?: {
    sourceId: string
    sourceTitle: string
    sourceDepartmentName?: string
    sourceEvalYear: number
    includedProgress: boolean
    includedCheckins: boolean
    progressEntryCount: number
    checkinEntryCount: number
    clonedAt?: string
  }
  suggestedParent?: {
    id: string
    title: string
    departmentName: string
  } | null
  suggestedChildren: Array<{
    id: string
    title: string
    departmentName: string
  }>
  linkedPersonalKpis: Array<{
    id: string
    title: string
    employeeName: string
    employeeId: string
    status: KpiStatus
  }>
  recentMonthlyRecords: Array<{
    id: string
    employeeName: string
    month: string
    achievementRate?: number
    comment?: string
  }>
  history: OrgKpiTimelineItem[]
}

export type OrgKpiTreeNode = {
  departmentId: string
  departmentName: string
  departmentCode: string
  parentDepartmentId?: string | null
  level: number
  organizationName: string
  kpis: OrgKpiViewModel[]
  children: OrgKpiTreeNode[]
}

export type OrgKpiPageData = {
  state: OrgKpiPageState
  message?: string
  alerts?: Array<{
    title: string
    description: string
  }>
  selectedYear: number
  availableYears: number[]
  selectedDepartmentId: string
  departments: OrgKpiScopeOption[]
  parentGoalOptions: Array<{
    id: string
    title: string
    departmentId: string
    departmentName: string
    evalYear: number
  }>
  summary: {
    totalCount: number
    confirmedCount: number
    unlinkedCount: number
    cascadeRate: number
    riskCount: number
    linkedPersonalKpiCount: number
    monthlyCoverageRate: number
    confirmedRate: number
  }
  tree: OrgKpiTreeNode[]
  list: OrgKpiViewModel[]
  history: OrgKpiTimelineItem[]
  linkage: OrgKpiLinkageItem[]
  aiLogs: OrgKpiAiLogItem[]
  permissions: {
    canManage: boolean
    canCreate: boolean
    canConfirm: boolean
    canLock: boolean
    canArchive: boolean
    canUseAi: boolean
  }
  actor: {
    role: SystemRole
    name: string
    departmentName: string
  }
}

type AuditLogLite = {
  id: string
  userId: string
  action: string
  entityType: string
  entityId: string | null
  oldValue: Prisma.JsonValue | null
  newValue: Prisma.JsonValue | null
  timestamp: Date
}

type OrgKpiWithRelations = Prisma.OrgKpiGetPayload<{
  include: {
    department: {
      include: {
        organization: true
      }
    }
    personalKpis: {
      include: {
        employee: {
          select: {
            id: true
            empId: true
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
    _count: {
      select: {
        personalKpis: true
      }
    }
    copiedFromOrgKpi: {
      select: {
        id: true
        kpiName: true
        evalYear: true
        department: {
          select: {
            deptName: true
          }
        }
      }
    }
    parentOrgKpi: {
      select: {
        id: true
        kpiName: true
        deptId: true
        department: {
          select: {
            deptName: true
          }
        }
      }
    }
    childOrgKpis: {
      select: {
        id: true
      }
    }
  }
}>

type DepartmentLite = Prisma.DepartmentGetPayload<{
  include: {
    organization: true
  }
}>

type EmployeeLite = Prisma.EmployeeGetPayload<{
  select: {
    id: true
    empName: true
    deptId: true
    position: true
    role: true
    status: true
  }
}>

type OrgKpiPageAlert = NonNullable<OrgKpiPageData['alerts']>[number]

function normalizeScopeDepartmentIds(accessibleDepartmentIds?: string[] | null) {
  if (!Array.isArray(accessibleDepartmentIds)) return []
  return accessibleDepartmentIds.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
}

function getEffectiveScopeDepartmentIds(params: {
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

  const normalizedIds = normalizeScopeDepartmentIds(params.accessibleDepartmentIds)
  return normalizedIds.length ? normalizedIds : [params.deptId]
}

async function loadOrgKpiSection<T>(params: {
  title: string
  description: string
  alerts: OrgKpiPageAlert[]
  loader: () => Promise<T>
  fallback: T
}) {
  try {
    return await params.loader()
  } catch (error) {
    console.error(`[org-kpi-page] ${params.title}`, error)
    params.alerts.push({
      title: params.title,
      description: params.description,
    })
    return params.fallback
  }
}

function buildDepartmentLevelMap(departments: DepartmentLite[]) {
  const byId = new Map(departments.map((department) => [department.id, department]))
  const memo = new Map<string, number>()

  function getLevel(id: string): number {
    if (memo.has(id)) return memo.get(id) ?? 0
    const department = byId.get(id)
    if (!department?.parentDeptId) {
      memo.set(id, 0)
      return 0
    }
    const level = getLevel(department.parentDeptId) + 1
    memo.set(id, level)
    return level
  }

  departments.forEach((department) => {
    getLevel(department.id)
  })

  return memo
}

function collectAncestorIds(departmentId: string, departmentsById: Map<string, DepartmentLite>) {
  const ids: string[] = []
  let current = departmentsById.get(departmentId)

  while (current?.parentDeptId) {
    ids.push(current.parentDeptId)
    current = departmentsById.get(current.parentDeptId)
  }

  return ids
}

function rankPosition(position: EmployeeLite['position']) {
  switch (position) {
    case 'CEO':
      return 5
    case 'DIV_HEAD':
      return 4
    case 'SECTION_CHIEF':
      return 3
    case 'TEAM_LEADER':
      return 2
    case 'MEMBER':
    default:
      return 1
  }
}

function findDepartmentOwner(
  departmentId: string,
  employeesByDept: Map<string, EmployeeLite[]>,
  departmentsById: Map<string, DepartmentLite>
) {
  let currentDeptId: string | null = departmentId

  while (currentDeptId) {
    const candidates = (employeesByDept.get(currentDeptId) ?? [])
      .filter((employee) => employee.status === 'ACTIVE')
      .sort((left, right) => rankPosition(right.position) - rankPosition(left.position))

    if (candidates.length) {
      return candidates[0]
    }

    currentDeptId = departmentsById.get(currentDeptId)?.parentDeptId ?? null
  }

  return null
}

function getRecentMonthlyRate(kpi: OrgKpiWithRelations) {
  const values = kpi.personalKpis
    .flatMap((personalKpi) => personalKpi.monthlyRecords)
    .filter((record) => typeof record.achievementRate === 'number' && !record.isDraft)
    .map((record) => Number(record.achievementRate))

  if (!values.length) return undefined

  const avg = values.reduce((sum, value) => sum + value, 0) / values.length
  return Math.round(avg * 10) / 10
}

function makeTimelineItems(params: {
  logs: AuditLogLite[]
  employeeNameMap: Map<string, string>
}): OrgKpiTimelineItem[] {
  return params.logs
    .sort((left, right) => right.timestamp.getTime() - left.timestamp.getTime())
    .map((log) => {
      const oldRecord = (log.oldValue ?? {}) as Record<string, unknown>
      const newRecord = (log.newValue ?? {}) as Record<string, unknown>

      return {
        id: log.id,
        at: log.timestamp.toISOString(),
        actor: params.employeeNameMap.get(log.userId) ?? '시스템',
        action: log.action,
        detail:
          typeof newRecord.note === 'string'
            ? newRecord.note
            : typeof newRecord.reason === 'string'
              ? newRecord.reason
              : undefined,
        fromStatus: typeof oldRecord.status === 'string' ? oldRecord.status : undefined,
        toStatus: typeof newRecord.status === 'string' ? newRecord.status : undefined,
      }
    })
}

function tokenizeTitle(value: string) {
  return value
    .toLowerCase()
    .split(/[\s/()_-]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
}

function findSuggestedParent(params: {
  kpi: OrgKpiWithRelations
  accessibleKpis: OrgKpiWithRelations[]
  departmentsById: Map<string, DepartmentLite>
}) {
  const ancestors = collectAncestorIds(params.kpi.deptId, params.departmentsById)
  const titleTokens = new Set(tokenizeTitle(params.kpi.kpiName))
  const category = params.kpi.kpiCategory

  const candidates = params.accessibleKpis.filter((candidate) => {
    if (candidate.id === params.kpi.id) return false
    if (!ancestors.includes(candidate.deptId)) return false
    if (candidate.kpiCategory === category) return true

    const overlap = tokenizeTitle(candidate.kpiName).filter((token) => titleTokens.has(token))
    return overlap.length >= 1
  })

  if (!candidates.length) return null

  const best = candidates.sort((left, right) => {
    const leftSameCategory = left.kpiCategory === category ? 1 : 0
    const rightSameCategory = right.kpiCategory === category ? 1 : 0
    if (leftSameCategory !== rightSameCategory) return rightSameCategory - leftSameCategory
    return right.updatedAt.getTime() - left.updatedAt.getTime()
  })[0]

  return {
    id: best.id,
    title: best.kpiName,
    departmentName: best.department.deptName,
  }
}

function findSuggestedChildren(params: {
  kpi: OrgKpiWithRelations
  accessibleKpis: OrgKpiWithRelations[]
  departmentsById: Map<string, DepartmentLite>
}) {
  const descendants = params.accessibleKpis.filter((candidate) => {
    if (candidate.id === params.kpi.id) return false

    let currentDeptId = params.departmentsById.get(candidate.deptId)?.parentDeptId ?? null
    while (currentDeptId) {
      if (currentDeptId === params.kpi.deptId) {
        return candidate.kpiCategory === params.kpi.kpiCategory
      }
      currentDeptId = params.departmentsById.get(currentDeptId)?.parentDeptId ?? null
    }

    return false
  })

  return descendants.slice(0, 6).map((child) => ({
    id: child.id,
    title: child.kpiName,
    departmentName: child.department.deptName,
  }))
}

function buildTree(params: {
  departments: DepartmentLite[]
  departmentLevelMap: Map<string, number>
  kpisByDepartment: Map<string, OrgKpiViewModel[]>
  selectedScopeIds: Set<string>
}) {
  const nodesById = new Map<string, OrgKpiTreeNode>()

  params.departments.forEach((department) => {
    nodesById.set(department.id, {
      departmentId: department.id,
      departmentName: department.deptName,
      departmentCode: department.deptCode,
      parentDepartmentId: department.parentDeptId,
      level: params.departmentLevelMap.get(department.id) ?? 0,
      organizationName: department.organization.name,
      kpis: params.kpisByDepartment.get(department.id) ?? [],
      children: [],
    })
  })

  const roots: OrgKpiTreeNode[] = []

  nodesById.forEach((node) => {
    if (node.parentDepartmentId && nodesById.has(node.parentDepartmentId)) {
      nodesById.get(node.parentDepartmentId)?.children.push(node)
    } else {
      roots.push(node)
    }
  })

  function shouldKeep(node: OrgKpiTreeNode): boolean {
    const childMatches = node.children.filter(shouldKeep)
    node.children = childMatches
    return (
      params.selectedScopeIds.has(node.departmentId) ||
      node.kpis.length > 0 ||
      childMatches.length > 0
    )
  }

  return roots.filter(shouldKeep)
}

function parseAiSummary(record: Prisma.JsonValue | null | undefined) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return 'AI 요청 결과'
  }

  const payload = record as Record<string, unknown>
  const candidates = [
    payload.kpiName,
    payload.title,
    payload.improvedTitle,
    payload.summary,
    payload.executiveSummary,
    payload.comment,
  ]

  const match = candidates.find((candidate) => typeof candidate === 'string' && candidate.trim().length > 0)
  if (typeof match === 'string') return match

  return 'AI 요청 결과'
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function parseCloneInfo(kpi: OrgKpiWithRelations): OrgKpiViewModel['cloneInfo'] {
  if (!kpi.copiedFromOrgKpiId || !kpi.copiedFromOrgKpi) {
    return undefined
  }

  const metadata = asRecord(kpi.copyMetadata)
  const progressSnapshot = asRecord(metadata?.progressSnapshot)
  const checkinSnapshot = Array.isArray(metadata?.checkinSnapshot) ? metadata.checkinSnapshot : []

  return {
    sourceId: kpi.copiedFromOrgKpi.id,
    sourceTitle: kpi.copiedFromOrgKpi.kpiName,
    sourceDepartmentName: kpi.copiedFromOrgKpi.department.deptName,
    sourceEvalYear:
      typeof metadata?.sourceEvalYear === 'number'
        ? metadata.sourceEvalYear
        : kpi.copiedFromOrgKpi.evalYear,
    includedProgress: metadata?.includedProgress === true,
    includedCheckins: metadata?.includedCheckins === true,
    progressEntryCount:
      typeof progressSnapshot?.linkedMonthlyRecordCount === 'number'
        ? progressSnapshot.linkedMonthlyRecordCount
        : 0,
    checkinEntryCount: checkinSnapshot.length,
    clonedAt: typeof metadata?.clonedAt === 'string' ? metadata.clonedAt : undefined,
  }
}

function parseTags(value: Prisma.JsonValue | null) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : []
}

export async function getOrgKpiPageData(params: {
  userId: string
  role: SystemRole
  deptId: string
  deptName: string
  accessibleDepartmentIds?: string[] | null
  year?: number
  selectedDepartmentId?: string
  userName: string
}): Promise<OrgKpiPageData> {
  try {
    const alerts: OrgKpiPageAlert[] = []
    const scopeDepartmentIds = getEffectiveScopeDepartmentIds({
      role: params.role,
      deptId: params.deptId,
      accessibleDepartmentIds: params.accessibleDepartmentIds,
    })

    const [departments, employees] = await Promise.all([
      prisma.department.findMany({
        include: {
          organization: true,
        },
        orderBy: [{ deptName: 'asc' }],
      }),
      prisma.employee.findMany({
        where: {
          ...(scopeDepartmentIds ? { deptId: { in: scopeDepartmentIds } } : {}),
        },
        select: {
          id: true,
          empName: true,
          deptId: true,
          position: true,
          role: true,
          status: true,
        },
      }),
    ])

    if (!departments.length) {
      return {
        state: 'empty',
        message: '조직 정보가 아직 준비되지 않았습니다.',
        selectedYear: new Date().getFullYear(),
        availableYears: [new Date().getFullYear()],
        selectedDepartmentId: params.deptId,
        departments: [],
        parentGoalOptions: [],
        summary: {
          totalCount: 0,
          confirmedCount: 0,
          unlinkedCount: 0,
          cascadeRate: 0,
          riskCount: 0,
          linkedPersonalKpiCount: 0,
          monthlyCoverageRate: 0,
          confirmedRate: 0,
        },
        tree: [],
        list: [],
        history: [],
        linkage: [],
        aiLogs: [],
        alerts,
        permissions: {
          canManage: false,
          canCreate: false,
          canConfirm: false,
          canLock: false,
          canArchive: false,
          canUseAi: false,
        },
        actor: {
          role: params.role,
          name: params.userName,
          departmentName: params.deptName,
        },
      }
    }

    const departmentsById = new Map(departments.map((department) => [department.id, department]))
    const levelMap = buildDepartmentLevelMap(departments)
    const effectiveScopeIds = new Set<string>(
      scopeDepartmentIds ?? departments.map((department) => department.id)
    )

    const visibleTreeIds = new Set<string>()
    effectiveScopeIds.forEach((departmentId) => {
      visibleTreeIds.add(departmentId)
      collectAncestorIds(departmentId, departmentsById).forEach((ancestorId) => {
        visibleTreeIds.add(ancestorId)
      })
    })

    const availableYearsRaw = await prisma.orgKpi.findMany({
      where: {
        ...(scopeDepartmentIds ? { deptId: { in: scopeDepartmentIds } } : {}),
      },
      select: { evalYear: true },
      distinct: ['evalYear'],
      orderBy: { evalYear: 'desc' },
    })

    const currentYear = new Date().getFullYear()
    const availableYears = Array.from(
      new Set([currentYear, ...availableYearsRaw.map((item) => item.evalYear)])
    ).sort((left, right) => right - left)

    const selectedYear = params.year && availableYears.includes(params.year) ? params.year : availableYears[0]
    const selectedOrgId = departments.find((department) => department.id === params.deptId)?.organization.id ?? departments[0]?.organization.id
    const cycleRecords =
      selectedOrgId
        ? await prisma.evalCycle.findMany({
            where: {
              orgId: selectedOrgId,
              evalYear: selectedYear,
            },
            orderBy: [{ createdAt: 'desc' }],
            take: 5,
          })
        : []
    const goalEditLocked = cycleRecords.some((cycle) => cycle.goalEditMode === 'CHECKIN_ONLY')

    const kpis = await prisma.orgKpi.findMany({
      where: {
        evalYear: selectedYear,
        ...(scopeDepartmentIds ? { deptId: { in: scopeDepartmentIds } } : {}),
      },
      include: {
        department: {
          include: {
            organization: true,
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
        },
        _count: {
          select: {
            personalKpis: true,
          },
        },
        copiedFromOrgKpi: {
          select: {
            id: true,
            kpiName: true,
            evalYear: true,
            department: {
              select: {
                deptName: true,
              },
            },
          },
        },
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
          },
        },
        childOrgKpis: {
          select: {
            id: true,
          },
        },
      },
      orderBy: [{ deptId: 'asc' }, { kpiName: 'asc' }],
    })

    const [auditLogs, aiLogs] = await Promise.all([
      loadOrgKpiSection({
        title: '조직 KPI 이력',
        description: '조직 KPI 변경 이력을 불러오지 못해 상세 이력은 표시되지 않습니다.',
        alerts,
        loader: () =>
          prisma.auditLog.findMany({
            where: {
              entityType: 'OrgKpi',
            },
            orderBy: { timestamp: 'desc' },
            take: 200,
          }),
        fallback: [] as AuditLogLite[],
      }),
      loadOrgKpiSection({
        title: '조직 KPI AI 보조',
        description: 'AI 보조 이력을 불러오지 못해 AI 탭은 기본 정보만 표시됩니다.',
        alerts,
        loader: () =>
          prisma.aiRequestLog.findMany({
            where: {
              requesterId: params.userId,
              sourceType: {
                startsWith: 'OrgKpi',
              },
            },
            include: {
              requester: {
                select: {
                  empName: true,
                },
              },
            },
            orderBy: { createdAt: 'desc' },
            take: 30,
          }),
        fallback: [] as Prisma.AiRequestLogGetPayload<{
          include: {
            requester: {
              select: {
                empName: true
              }
            }
          }
        }>[],
      }),
    ])

    const employeeNameMap = new Map(employees.map((employee) => [employee.id, employee.empName]))
    const employeesByDept = new Map<string, EmployeeLite[]>()

    employees.forEach((employee) => {
      const current = employeesByDept.get(employee.deptId) ?? []
      current.push(employee)
      employeesByDept.set(employee.deptId, current)
    })

    const logsByEntityId = new Map<string, AuditLogLite[]>()
    auditLogs.forEach((log) => {
      if (!log.entityId) return
      const current = logsByEntityId.get(log.entityId) ?? []
      current.push(log)
      logsByEntityId.set(log.entityId, current)
    })

    const kpisById = new Map(kpis.map((item) => [item.id, item]))

    const buildLineage = (kpiId: string) => {
      const lineage: OrgKpiViewModel['lineage'] = []
      let current = kpisById.get(kpiId)?.parentOrgKpiId ?? null
      const visited = new Set<string>()

      while (current && !visited.has(current)) {
        visited.add(current)
        const parent = kpisById.get(current)
        if (!parent) break
        lineage.unshift({
          id: parent.id,
          title: parent.kpiName,
          departmentName: parent.department.deptName,
        })
        current = parent.parentOrgKpiId ?? null
      }

      return lineage
    }

    const mappedList = kpis.map<OrgKpiViewModel>((kpi) => {
      const logs = logsByEntityId.get(kpi.id) ?? []
      const owner = findDepartmentOwner(kpi.deptId, employeesByDept, departmentsById)
      const linkedConfirmedPersonalKpiCount = kpi.personalKpis.filter(
        (personalKpi) => personalKpi.status === 'CONFIRMED'
      ).length
      const monthlyAchievementRate = getRecentMonthlyRate(kpi)
      const targetPopulationCount = (employeesByDept.get(kpi.deptId) ?? []).filter(
        (employee) => employee.status === 'ACTIVE'
      ).length
      const coverageRate = targetPopulationCount
        ? Math.round((kpi._count.personalKpis / targetPopulationCount) * 100)
        : 0
      const recentMonthlyRecords = kpi.personalKpis
        .flatMap((personalKpi) =>
          personalKpi.monthlyRecords.map((record) => ({
            id: record.id,
            employeeName: personalKpi.employee.empName,
            month: record.yearMonth,
            achievementRate:
              typeof record.achievementRate === 'number' ? Number(record.achievementRate) : undefined,
            comment: record.activities ?? record.obstacles ?? record.efforts ?? undefined,
          }))
        )
        .sort((left, right) => right.month.localeCompare(left.month))
        .slice(0, 5)

      const riskFlags: string[] = []
      if (kpi._count.personalKpis === 0) {
        riskFlags.push('개인 KPI 연결 없음')
      }
      if (!recentMonthlyRecords.length) {
        riskFlags.push('최근 월간 실적 없음')
      }
      if (typeof monthlyAchievementRate === 'number' && monthlyAchievementRate < 80) {
        riskFlags.push('달성률 저하')
      }
      if (!findSuggestedChildren({ kpi, accessibleKpis: kpis, departmentsById }).length) {
        riskFlags.push('하위 cascade 후보 부족')
      }

      return {
        id: kpi.id,
        title: kpi.kpiName,
        tags: parseTags(kpi.tags),
        evalYear: kpi.evalYear,
        departmentId: kpi.deptId,
        departmentName: kpi.department.deptName,
        departmentCode: kpi.department.deptCode,
        parentOrgKpiId: kpi.parentOrgKpiId ?? null,
        parentOrgKpiTitle: kpi.parentOrgKpi?.kpiName ?? null,
        parentOrgDepartmentName: kpi.parentOrgKpi?.department?.deptName ?? null,
        childOrgKpiCount: kpi.childOrgKpis?.length ?? 0,
        lineage: buildLineage(kpi.id),
        category: kpi.kpiCategory,
        type: kpi.kpiType,
        definition: kpi.definition ?? undefined,
        formula: kpi.formula ?? undefined,
        targetValue: typeof kpi.targetValue === 'number' ? Number(kpi.targetValue) : undefined,
        unit: kpi.unit ?? undefined,
        weight: Number(kpi.weight),
        difficulty: kpi.difficulty,
        status: resolveOrgKpiOperationalStatus({
          status: kpi.status,
          logs,
        }),
        persistedStatus: kpi.status,
        owner: owner
          ? {
              id: owner.id,
              name: owner.empName,
              position: owner.position,
            }
          : undefined,
        linkedPersonalKpiCount: kpi._count.personalKpis,
        linkedConfirmedPersonalKpiCount,
        monthlyAchievementRate,
        updatedAt: kpi.updatedAt.toISOString(),
        riskFlags,
        coverageRate,
        targetPopulationCount,
        cloneInfo: parseCloneInfo(kpi),
        suggestedParent: findSuggestedParent({
          kpi,
          accessibleKpis: kpis,
          departmentsById,
        }),
        suggestedChildren: findSuggestedChildren({
          kpi,
          accessibleKpis: kpis,
          departmentsById,
        }),
        linkedPersonalKpis: kpi.personalKpis.slice(0, 12).map((personalKpi) => ({
          id: personalKpi.id,
          title: personalKpi.kpiName,
          employeeName: personalKpi.employee.empName,
          employeeId: personalKpi.employee.empId,
          status: personalKpi.status,
        })),
        recentMonthlyRecords,
        history: makeTimelineItems({
          logs: logs.slice(0, 12),
          employeeNameMap,
        }),
      }
    })

    const mappedById = new Map(mappedList.map((item) => [item.id, item]))
    const kpisByDepartment = new Map<string, OrgKpiViewModel[]>()
    mappedList.forEach((kpi) => {
      const current = kpisByDepartment.get(kpi.departmentId) ?? []
      current.push(kpi)
      kpisByDepartment.set(kpi.departmentId, current)
    })

    const linkage = mappedList.map<OrgKpiLinkageItem>((kpi) => ({
      orgKpiId: kpi.id,
      title: kpi.title,
      linkedPersonalKpiCount: kpi.linkedPersonalKpiCount,
      targetPopulationCount: kpi.targetPopulationCount,
      coverageRate: kpi.coverageRate,
      riskLevel:
        kpi.riskFlags.length >= 3 ? 'HIGH' : kpi.riskFlags.length >= 1 ? 'MEDIUM' : 'LOW',
      hasRecentMonthlyRecord: kpi.recentMonthlyRecords.length > 0,
      departmentName: kpi.departmentName,
    }))

    const totalCount = mappedList.length
    const confirmedCount = mappedList.filter((item) =>
      ['CONFIRMED', 'LOCKED'].includes(item.status)
    ).length
    const unlinkedCount = mappedList.filter((item) => item.linkedPersonalKpiCount === 0).length
    const linkedPersonalKpiCount = mappedList.reduce(
      (sum, item) => sum + item.linkedPersonalKpiCount,
      0
    )
    const riskCount = mappedList.filter((item) => item.riskFlags.length > 0).length
    const cascadeRate = totalCount
      ? Math.round(
          (mappedList.filter((item) => item.suggestedParent || item.suggestedChildren.length).length /
            totalCount) *
            100
        )
      : 0
    const monthlyCoverageRate = totalCount
      ? Math.round((mappedList.filter((item) => item.recentMonthlyRecords.length > 0).length / totalCount) * 100)
      : 0
    const confirmedRate = totalCount ? Math.round((confirmedCount / totalCount) * 100) : 0

    const departmentsForSelector = departments
      .filter((department) => effectiveScopeIds.has(department.id))
      .map((department) => ({
        id: department.id,
        name: department.deptName,
        parentDepartmentId: department.parentDeptId,
        organizationName: department.organization.name,
        level: levelMap.get(department.id) ?? 0,
      }))
      .sort((left, right) => left.level - right.level || left.name.localeCompare(right.name))

    const selectedDepartmentId =
      params.selectedDepartmentId && departmentsForSelector.some((department) => department.id === params.selectedDepartmentId)
        ? params.selectedDepartmentId
        : departmentsForSelector[0]?.id ?? params.deptId

    const parentGoalOptions = kpis
      .filter((kpi) => visibleTreeIds.has(kpi.deptId))
      .map((kpi) => ({
        id: kpi.id,
        title: kpi.kpiName,
        departmentId: kpi.deptId,
        departmentName: kpi.department.deptName,
        evalYear: kpi.evalYear,
      }))

    const history = makeTimelineItems({
      logs: auditLogs.filter((log) => log.entityId && mappedById.has(log.entityId)).slice(0, 80),
      employeeNameMap,
    })

    const tree = buildTree({
      departments,
      departmentLevelMap: levelMap,
      kpisByDepartment,
      selectedScopeIds: visibleTreeIds,
    })

    const canManage = ['ROLE_ADMIN', 'ROLE_CEO', 'ROLE_DIV_HEAD', 'ROLE_SECTION_CHIEF', 'ROLE_TEAM_LEADER'].includes(
      params.role
    )
    const canConfirm = ['ROLE_ADMIN', 'ROLE_CEO', 'ROLE_DIV_HEAD', 'ROLE_SECTION_CHIEF'].includes(
      params.role
    )
    const canLock = ['ROLE_ADMIN', 'ROLE_CEO'].includes(params.role)

    if (goalEditLocked) {
      alerts.push({
        title: '현재 목표는 읽기 전용 모드입니다.',
        description: '목표 생성, 수정, 삭제는 막혀 있으며 현재 확정 상태와 연결 관계를 중심으로 조회할 수 있습니다.',
      })
    }

    const pageState: OrgKpiPageState = totalCount ? 'ready' : 'empty'

    return {
      state: pageState,
      message: totalCount ? undefined : '해당 범위에 등록된 조직 KPI가 없습니다. 올해 목표부터 정리해 보세요.',
      selectedYear,
      availableYears,
      selectedDepartmentId,
      departments: departmentsForSelector,
      parentGoalOptions,
      summary: {
        totalCount,
        confirmedCount,
        unlinkedCount,
        cascadeRate,
        riskCount,
        linkedPersonalKpiCount,
        monthlyCoverageRate,
        confirmedRate,
      },
      tree,
      list: mappedList,
      history,
      linkage,
      aiLogs: aiLogs.map((log) => ({
        id: log.id,
        createdAt: log.createdAt.toISOString(),
        sourceType: log.sourceType ?? 'OrgKpiAssist',
        sourceId: log.sourceId ?? undefined,
        requesterName: log.requester.empName,
        requestStatus: log.requestStatus,
        approvalStatus: log.approvalStatus,
        summary: parseAiSummary(log.responsePayload),
      })),
      alerts,
      permissions: {
        canManage,
        canCreate: goalEditLocked ? false : canManage,
        canConfirm,
        canLock,
        canArchive: canManage,
        canUseAi: canManage,
      },
      actor: {
        role: params.role,
        name: params.userName,
        departmentName: params.deptName,
      },
    }
  } catch (error) {
    console.error('[org-kpi-page]', error)
    return {
      state: 'error',
      message: '조직 KPI 화면을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
      selectedYear: new Date().getFullYear(),
      availableYears: [new Date().getFullYear()],
      selectedDepartmentId: params.deptId,
      departments: [],
      parentGoalOptions: [],
      summary: {
        totalCount: 0,
        confirmedCount: 0,
        unlinkedCount: 0,
        cascadeRate: 0,
        riskCount: 0,
        linkedPersonalKpiCount: 0,
        monthlyCoverageRate: 0,
        confirmedRate: 0,
      },
      tree: [],
      list: [],
      history: [],
      linkage: [],
      aiLogs: [],
      alerts: [],
      permissions: {
        canManage: false,
        canCreate: false,
        canConfirm: false,
        canLock: false,
        canArchive: false,
        canUseAi: false,
      },
      actor: {
        role: params.role,
        name: params.userName,
        departmentName: params.deptName,
      },
    }
  }
}
