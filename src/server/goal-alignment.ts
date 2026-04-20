import type { CheckInStatus, KpiStatus, SystemRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { AppError } from '@/lib/utils'
import { getDescendantDeptIds } from '@/server/auth/org-scope'

type GoalAlignmentSession = {
  user: {
    id: string
    role: SystemRole
    deptId: string
    name: string
    accessibleDepartmentIds?: string[] | null
  }
}

export type GoalAlignmentPageState = 'ready' | 'empty' | 'permission-denied' | 'error'
export type GoalAlignmentStatusFilter = 'ALL' | 'CONFIRMED' | 'DRAFT' | 'ORPHAN' | 'AT_RISK'

export type GoalAlignmentAlert = {
  title: string
  description: string
}

export type GoalAlignmentCycleOption = {
  id: string
  label: string
  year: number
}

export type GoalAlignmentDepartmentOption = {
  id: string
  name: string
  parentDepartmentId: string | null
  level: number
}

export type GoalAlignmentLineageItem = {
  id: string
  title: string
  departmentName: string
  href: string
}

export type GoalAlignmentPersonalNode = {
  id: string
  title: string
  employeeName: string
  departmentName: string
  status: KpiStatus
  progressRate?: number
  isOrphan: boolean
  linkedOrgKpiId?: string | null
  href: string
}

export type GoalAlignmentOrgNode = {
  id: string
  title: string
  departmentId: string
  departmentName: string
  status: KpiStatus
  progressRate?: number
  isOrphan: boolean
  riskFlags: string[]
  linkedPersonalGoalCount: number
  childGoalCount: number
  lineage: GoalAlignmentLineageItem[]
  href: string
  children: GoalAlignmentOrgNode[]
  personalGoals: GoalAlignmentPersonalNode[]
}

export type GoalAlignmentDepartmentSummary = {
  departmentId: string
  departmentName: string
  activeEmployeeCount: number
  orgGoalCount: number
  personalGoalCount: number
  personalGoalSetupRate: number
  alignmentRate: number
  orphanGoalCount: number
  completedCheckInRate: number
  averageProgressRate: number
  riskCount: number
  relatedUrl: string
}

export type GoalAlignmentPageData = {
  state: GoalAlignmentPageState
  message?: string
  alerts: GoalAlignmentAlert[]
  selectedYear: number
  selectedCycleId?: string
  selectedDepartmentId: string
  selectedStatus: GoalAlignmentStatusFilter
  availableYears: number[]
  cycleOptions: GoalAlignmentCycleOption[]
  departmentOptions: GoalAlignmentDepartmentOption[]
  statusOptions: Array<{ value: GoalAlignmentStatusFilter; label: string }>
  summary: {
    orgGoalCount: number
    personalGoalCount: number
    alignedPersonalGoalCount: number
    orphanOrgGoalCount: number
    orphanPersonalGoalCount: number
    personalGoalSetupRate: number
    completedCheckInRate: number
    averageProgressRate: number
  }
  board: GoalAlignmentOrgNode[]
  orphanPersonalGoals: GoalAlignmentPersonalNode[]
  departmentSummary: GoalAlignmentDepartmentSummary[]
  permissions: {
    canExport: boolean
    canRunReminder: boolean
  }
  quickLinks: {
    readModeHref: string
    reminderHref: string
    orgKpiHref: string
  }
}

type DepartmentLite = {
  id: string
  deptName: string
  deptCode: string
  parentDeptId: string | null
}

type OrgGoalLite = {
  id: string
  deptId: string
  evalYear: number
  kpiName: string
  status: KpiStatus
  parentOrgKpiId: string | null
  department: {
    deptName: string
  }
  personalKpis: Array<{
    id: string
    status: KpiStatus
    employeeId: string
    employee: {
      empName: string
      deptId: string
      department: { deptName: string | null } | null
    }
    monthlyRecords: Array<{
      achievementRate: number | null
    }>
  }>
}

type PersonalGoalLite = {
  id: string
  employeeId: string
  evalYear: number
  kpiName: string
  status: KpiStatus
  linkedOrgKpiId: string | null
  employee: {
    empName: string
    deptId: string
    department: { deptName: string | null } | null
  }
  monthlyRecords: Array<{
    achievementRate: number | null
  }>
}

type EmployeeLite = {
  id: string
  empName: string
  deptId: string
  status: string
}

type CheckInLite = {
  id: string
  ownerId: string
  status: CheckInStatus
}

type GoalAlignmentDeps = {
  loadDepartments: () => Promise<DepartmentLite[]>
  loadCycles: (selectedYear: number) => Promise<Array<{ id: string; cycleName: string; evalYear: number }>>
  loadOrgGoals: (selectedYear: number, departmentIds: string[] | null) => Promise<OrgGoalLite[]>
  loadPersonalGoals: (selectedYear: number, departmentIds: string[] | null) => Promise<PersonalGoalLite[]>
  loadEmployees: (departmentIds: string[] | null) => Promise<EmployeeLite[]>
  loadCheckIns: (selectedYear: number, ownerIds: string[]) => Promise<CheckInLite[]>
}

const STATUS_OPTIONS: GoalAlignmentPageData['statusOptions'] = [
  { value: 'ALL', label: '전체' },
  { value: 'CONFIRMED', label: '수립 완료' },
  { value: 'DRAFT', label: '초안/진행 중' },
  { value: 'ORPHAN', label: '미연결' },
  { value: 'AT_RISK', label: '주의' },
]

const defaultDeps: GoalAlignmentDeps = {
  loadDepartments: async () =>
    prisma.department.findMany({
      select: {
        id: true,
        deptName: true,
        deptCode: true,
        parentDeptId: true,
      },
      orderBy: [{ deptCode: 'asc' }],
    }),
  loadCycles: async (selectedYear) =>
    prisma.evalCycle.findMany({
      where: { evalYear: selectedYear },
      select: {
        id: true,
        cycleName: true,
        evalYear: true,
      },
      orderBy: [{ evalYear: 'desc' }, { createdAt: 'desc' }],
    }),
  loadOrgGoals: async (selectedYear, departmentIds) =>
    prisma.orgKpi.findMany({
      where: {
        evalYear: selectedYear,
        ...(departmentIds ? { deptId: { in: departmentIds } } : {}),
        status: { not: 'ARCHIVED' },
      },
      include: {
        department: { select: { deptName: true } },
        personalKpis: {
          include: {
            employee: { include: { department: { select: { deptName: true } } } },
            monthlyRecords: {
              orderBy: { yearMonth: 'desc' },
              take: 1,
            },
          },
        },
      },
      orderBy: [{ deptId: 'asc' }, { kpiName: 'asc' }],
    }),
  loadPersonalGoals: async (selectedYear, departmentIds) =>
    prisma.personalKpi.findMany({
      where: {
        evalYear: selectedYear,
        employee: departmentIds ? { deptId: { in: departmentIds } } : undefined,
        status: { not: 'ARCHIVED' },
      },
      include: {
        employee: { include: { department: { select: { deptName: true } } } },
        monthlyRecords: {
          orderBy: { yearMonth: 'desc' },
          take: 1,
        },
      },
      orderBy: [{ employee: { deptId: 'asc' } }, { kpiName: 'asc' }],
    }),
  loadEmployees: async (departmentIds) =>
    prisma.employee.findMany({
      where: {
        ...(departmentIds ? { deptId: { in: departmentIds } } : {}),
      },
      select: {
        id: true,
        empName: true,
        deptId: true,
        status: true,
      },
      orderBy: [{ deptId: 'asc' }, { empName: 'asc' }],
    }),
  loadCheckIns: async (selectedYear, ownerIds) =>
    prisma.checkIn.findMany({
      where: {
        ownerId: { in: ownerIds },
        scheduledDate: {
          gte: new Date(`${selectedYear}-01-01T00:00:00.000Z`),
          lt: new Date(`${selectedYear + 1}-01-01T00:00:00.000Z`),
        },
      },
      select: {
        id: true,
        ownerId: true,
        status: true,
      },
    }),
}

function normalizeDepartmentIds(accessibleDepartmentIds?: string[] | null) {
  if (!Array.isArray(accessibleDepartmentIds)) return []
  return accessibleDepartmentIds.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
}

function getScopeDepartmentIds(session: GoalAlignmentSession, departments: DepartmentLite[]) {
  if (session.user.role === 'ROLE_ADMIN' || session.user.role === 'ROLE_CEO') {
    return null
  }

  if (session.user.role === 'ROLE_MEMBER') {
    return [session.user.deptId]
  }

  const normalized = normalizeDepartmentIds(session.user.accessibleDepartmentIds)
  return normalized.length ? normalized : [session.user.deptId, ...getDescendantDeptIds(session.user.deptId, departments)]
}

function collectAncestorIds(deptId: string, departmentsById: Map<string, DepartmentLite>) {
  const ids: string[] = []
  let current = departmentsById.get(deptId)
  while (current?.parentDeptId) {
    ids.push(current.parentDeptId)
    current = departmentsById.get(current.parentDeptId)
  }
  return ids
}

function formatPercent(value: number) {
  return Math.round(value * 10) / 10
}

function averageProgress(values: Array<number | undefined>) {
  const filtered = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  if (!filtered.length) return undefined
  return formatPercent(filtered.reduce((sum, value) => sum + value, 0) / filtered.length)
}

async function loadSection<T>(params: {
  title: string
  description: string
  alerts: GoalAlignmentAlert[]
  fallback: T
  loader: () => Promise<T>
}) {
  try {
    return await params.loader()
  } catch (error) {
    console.error('[goal-alignment]', params.title, error)
    params.alerts.push({
      title: params.title,
      description: params.description,
    })
    return params.fallback
  }
}

function matchesStatusFilter(params: {
  status: GoalAlignmentStatusFilter
  nodeStatus: KpiStatus
  isOrphan: boolean
  progressRate?: number
}) {
  if (params.status === 'ALL') return true
  if (params.status === 'ORPHAN') return params.isOrphan
  if (params.status === 'AT_RISK') return params.isOrphan || (typeof params.progressRate === 'number' && params.progressRate < 70)
  if (params.status === 'CONFIRMED') return params.nodeStatus === 'CONFIRMED'
  return params.nodeStatus === 'DRAFT'
}

export async function getGoalAlignmentPageData(
  session: GoalAlignmentSession,
  params: {
    year?: number
    cycleId?: string
    departmentId?: string
    status?: GoalAlignmentStatusFilter
  },
  deps: GoalAlignmentDeps = defaultDeps
): Promise<GoalAlignmentPageData> {
  const alerts: GoalAlignmentAlert[] = []

  if (!['ROLE_ADMIN', 'ROLE_CEO'].includes(session.user.role)) {
    return {
      state: 'permission-denied',
      message: '성과 얼라인먼트 운영 화면에 접근할 권한이 없습니다.',
      alerts,
      selectedYear: params.year ?? new Date().getFullYear(),
      selectedCycleId: params.cycleId,
      selectedDepartmentId: params.departmentId ?? 'ALL',
      selectedStatus: params.status ?? 'ALL',
      availableYears: [params.year ?? new Date().getFullYear()],
      cycleOptions: [],
      departmentOptions: [],
      statusOptions: STATUS_OPTIONS,
      summary: {
        orgGoalCount: 0,
        personalGoalCount: 0,
        alignedPersonalGoalCount: 0,
        orphanOrgGoalCount: 0,
        orphanPersonalGoalCount: 0,
        personalGoalSetupRate: 0,
        completedCheckInRate: 0,
        averageProgressRate: 0,
      },
      board: [],
      orphanPersonalGoals: [],
      departmentSummary: [],
      permissions: { canExport: false, canRunReminder: false },
      quickLinks: {
        readModeHref: '/admin/eval-cycle',
        reminderHref: '/admin/notifications',
        orgKpiHref: '/kpi/org',
      },
    }
  }

  try {
    const departments = await deps.loadDepartments()
    const departmentsById = new Map(departments.map((department) => [department.id, department]))
    const scopeDepartmentIds = getScopeDepartmentIds(session, departments)
    const currentYear = new Date().getFullYear()

    const availableYearsRaw = await loadSection({
      title: '목표 연도 목록을 불러오지 못했습니다.',
      description: '현재 연도를 기준으로 기본 정렬 화면을 표시합니다.',
      alerts,
      fallback: [] as Array<{ evalYear: number }>,
      loader: async () => {
        const [orgYears, personalYears] = await Promise.all([
          prisma.orgKpi.findMany({
            where: scopeDepartmentIds ? { deptId: { in: scopeDepartmentIds } } : undefined,
            select: { evalYear: true },
            distinct: ['evalYear'],
          }),
          prisma.personalKpi.findMany({
            where: scopeDepartmentIds ? { employee: { deptId: { in: scopeDepartmentIds } } } : undefined,
            select: { evalYear: true },
            distinct: ['evalYear'],
          }),
        ])
        return [...orgYears, ...personalYears]
      },
    })

    const availableYears = Array.from(new Set([currentYear, ...availableYearsRaw.map((item) => item.evalYear)])).sort(
      (left, right) => right - left
    )
    const selectedYear = params.year && availableYears.includes(params.year) ? params.year : availableYears[0] ?? currentYear
    const cycleOptions = (await loadSection({
      title: '평가 주기 정보를 불러오지 못했습니다.',
      description: '연도 중심 얼라인먼트 화면만 계속 표시합니다.',
      alerts,
      fallback: [] as Array<{ id: string; cycleName: string; evalYear: number }>,
      loader: () => deps.loadCycles(selectedYear),
    })).map((item) => ({
      id: item.id,
      year: item.evalYear,
      label: `${item.evalYear} ${item.cycleName}`,
    }))

    const scopedDepartmentIds = scopeDepartmentIds ?? departments.map((department) => department.id)
    const selectedDepartmentId =
      params.departmentId && (params.departmentId === 'ALL' || scopedDepartmentIds.includes(params.departmentId))
        ? params.departmentId
        : 'ALL'
    const filteredDepartmentIds =
      selectedDepartmentId === 'ALL'
        ? scopedDepartmentIds
        : [selectedDepartmentId, ...getDescendantDeptIds(selectedDepartmentId, departments)]
    const visibleDepartmentIds = Array.from(
      new Set(
        filteredDepartmentIds.flatMap((departmentId) => [
          departmentId,
          ...collectAncestorIds(departmentId, departmentsById),
        ])
      )
    )

    const [orgGoals, personalGoals, employees] = await Promise.all([
      loadSection({
        title: '조직 목표를 불러오지 못했습니다.',
        description: '정렬 보드는 가능한 범위의 데이터만 표시합니다.',
        alerts,
        fallback: [] as OrgGoalLite[],
        loader: () => deps.loadOrgGoals(selectedYear, visibleDepartmentIds),
      }),
      loadSection({
        title: '개인 목표를 불러오지 못했습니다.',
        description: '개인 목표 연결 현황은 부분 데이터만 표시합니다.',
        alerts,
        fallback: [] as PersonalGoalLite[],
        loader: () => deps.loadPersonalGoals(selectedYear, filteredDepartmentIds),
      }),
      loadSection({
        title: '조직 인원 정보를 불러오지 못했습니다.',
        description: '수립률과 리마인드 기준 인원 수가 일부 비어 있을 수 있습니다.',
        alerts,
        fallback: [] as EmployeeLite[],
        loader: () => deps.loadEmployees(filteredDepartmentIds),
      }),
    ])

    const activeEmployees = employees.filter((employee) => employee.status === 'ACTIVE')
    const checkIns = await loadSection({
      title: '체크인 현황을 불러오지 못했습니다.',
      description: '체크인 진행률 없이 정렬과 목표 수립 현황만 표시합니다.',
      alerts,
      fallback: [] as CheckInLite[],
      loader: () => deps.loadCheckIns(selectedYear, activeEmployees.map((employee) => employee.id)),
    })

    const checkInsByOwnerId = new Map<string, CheckInLite[]>()
    checkIns.forEach((item) => {
      const bucket = checkInsByOwnerId.get(item.ownerId) ?? []
      bucket.push(item)
      checkInsByOwnerId.set(item.ownerId, bucket)
    })

    const personalByOrgId = new Map<string, PersonalGoalLite[]>()
    personalGoals.forEach((goal) => {
      if (!goal.linkedOrgKpiId) return
      const bucket = personalByOrgId.get(goal.linkedOrgKpiId) ?? []
      bucket.push(goal)
      personalByOrgId.set(goal.linkedOrgKpiId, bucket)
    })

    const filteredStatus = params.status ?? 'ALL'
    const personalNodeById = new Map<string, GoalAlignmentPersonalNode>()
    personalGoals.forEach((goal) => {
      const progressRate = goal.monthlyRecords[0]?.achievementRate ?? undefined
      const node: GoalAlignmentPersonalNode = {
        id: goal.id,
        title: goal.kpiName,
        employeeName: goal.employee.empName,
        departmentName: goal.employee.department?.deptName ?? '미지정 조직',
        status: goal.status,
        progressRate: progressRate ?? undefined,
        isOrphan: !goal.linkedOrgKpiId || !orgGoals.some((item) => item.id === goal.linkedOrgKpiId),
        linkedOrgKpiId: goal.linkedOrgKpiId,
        href: `/kpi/personal?year=${selectedYear}&employeeId=${encodeURIComponent(goal.employeeId)}&kpiId=${encodeURIComponent(goal.id)}`,
      }
      personalNodeById.set(goal.id, node)
    })

    const orgGoalById = new Map(orgGoals.map((goal) => [goal.id, goal]))
    const orgNodeById = new Map<string, GoalAlignmentOrgNode>()
    orgGoals.forEach((goal) => {
      const linkedPersonalNodes = (personalByOrgId.get(goal.id) ?? [])
        .map((item) => personalNodeById.get(item.id))
        .filter((item): item is GoalAlignmentPersonalNode => Boolean(item))
      const progressRate = averageProgress([
        ...linkedPersonalNodes.map((item) => item.progressRate),
        ...goal.personalKpis.map((item) => item.monthlyRecords[0]?.achievementRate ?? undefined),
      ])
      const isOrphan = Boolean(goal.parentOrgKpiId && !orgGoalById.has(goal.parentOrgKpiId))
      const riskFlags = [
        ...(isOrphan ? ['상위 목표 연결 확인 필요'] : []),
        ...(linkedPersonalNodes.length === 0 ? ['연결된 개인 목표 없음'] : []),
        ...(typeof progressRate === 'number' && progressRate < 70 ? ['진척 주의'] : []),
      ]

      orgNodeById.set(goal.id, {
        id: goal.id,
        title: goal.kpiName,
        departmentId: goal.deptId,
        departmentName: goal.department.deptName,
        status: goal.status,
        progressRate,
        isOrphan,
        riskFlags,
        linkedPersonalGoalCount: linkedPersonalNodes.length,
        childGoalCount: 0,
        lineage: [],
        href: `/kpi/org?year=${selectedYear}&dept=${encodeURIComponent(goal.deptId)}&kpiId=${encodeURIComponent(goal.id)}`,
        children: [],
        personalGoals: linkedPersonalNodes.filter((item) =>
          matchesStatusFilter({
            status: filteredStatus,
            nodeStatus: item.status,
            isOrphan: item.isOrphan,
            progressRate: item.progressRate,
          })
        ),
      })
    })

    const roots: GoalAlignmentOrgNode[] = []
    orgGoals.forEach((goal) => {
      const node = orgNodeById.get(goal.id)
      if (!node) return
      const lineage: GoalAlignmentLineageItem[] = []
      let current = goal.parentOrgKpiId ? orgGoalById.get(goal.parentOrgKpiId) : null
      while (current) {
        lineage.unshift({
          id: current.id,
          title: current.kpiName,
          departmentName: current.department.deptName,
          href: `/kpi/org?year=${current.evalYear}&dept=${encodeURIComponent(current.deptId)}&kpiId=${encodeURIComponent(current.id)}`,
        })
        current = current.parentOrgKpiId ? orgGoalById.get(current.parentOrgKpiId) : null
      }
      node.lineage = lineage

      if (goal.parentOrgKpiId) {
        const parentNode = orgNodeById.get(goal.parentOrgKpiId)
        if (parentNode) {
          parentNode.children.push(node)
          parentNode.childGoalCount += 1
          return
        }
      }
      roots.push(node)
    })

    function keepNode(node: GoalAlignmentOrgNode): boolean {
      node.children = node.children.filter(keepNode)
      const nodeMatches = matchesStatusFilter({
        status: filteredStatus,
        nodeStatus: node.status,
        isOrphan: node.isOrphan,
        progressRate: node.progressRate,
      })
      return nodeMatches || node.children.length > 0 || node.personalGoals.length > 0
    }

    const board = roots.filter(keepNode)
    const orphanPersonalGoals = Array.from(personalNodeById.values()).filter(
      (item) =>
        item.isOrphan &&
        matchesStatusFilter({
          status: filteredStatus,
          nodeStatus: item.status,
          isOrphan: true,
          progressRate: item.progressRate,
        })
    )

    const activeEmployeesByDept = new Map<string, EmployeeLite[]>()
    activeEmployees.forEach((employee) => {
      const bucket = activeEmployeesByDept.get(employee.deptId) ?? []
      bucket.push(employee)
      activeEmployeesByDept.set(employee.deptId, bucket)
    })

    const personalByDept = new Map<string, PersonalGoalLite[]>()
    personalGoals.forEach((goal) => {
      const bucket = personalByDept.get(goal.employee.deptId) ?? []
      bucket.push(goal)
      personalByDept.set(goal.employee.deptId, bucket)
    })

    const orgByDept = new Map<string, OrgGoalLite[]>()
    orgGoals.forEach((goal) => {
      const bucket = orgByDept.get(goal.deptId) ?? []
      bucket.push(goal)
      orgByDept.set(goal.deptId, bucket)
    })

    const departmentOptions: GoalAlignmentDepartmentOption[] = [
      { id: 'ALL', name: '전체 조직', parentDepartmentId: null, level: 0 },
      ...filteredDepartmentIds
        .filter((departmentId, index, array) => array.indexOf(departmentId) === index)
        .map((departmentId) => departmentsById.get(departmentId))
        .filter((department): department is DepartmentLite => Boolean(department))
        .map((department) => ({
          id: department.id,
          name: department.deptName,
          parentDepartmentId: department.parentDeptId,
          level: collectAncestorIds(department.id, departmentsById).length,
        })),
    ]

    const departmentSummary = departmentOptions
      .filter((department) => department.id !== 'ALL')
      .map((department) => {
        const activeCount = activeEmployeesByDept.get(department.id)?.length ?? 0
        const departmentPersonalGoals = personalByDept.get(department.id) ?? []
        const departmentOrgGoals = orgByDept.get(department.id) ?? []
        const alignedCount = departmentPersonalGoals.filter((goal) => Boolean(goal.linkedOrgKpiId)).length
        const orphanCount =
          departmentOrgGoals.filter((goal) => Boolean(goal.parentOrgKpiId && !orgGoalById.has(goal.parentOrgKpiId))).length +
          departmentPersonalGoals.filter((goal) => !goal.linkedOrgKpiId || !orgGoalById.has(goal.linkedOrgKpiId)).length
        const ownerIds = new Set((activeEmployeesByDept.get(department.id) ?? []).map((employee) => employee.id))
        const departmentCheckIns = Array.from(ownerIds).flatMap((ownerId) => checkInsByOwnerId.get(ownerId) ?? [])
        const completedCheckInRate = departmentCheckIns.length
          ? Math.round((departmentCheckIns.filter((item) => item.status === 'COMPLETED').length / departmentCheckIns.length) * 100)
          : 0
        const averageProgressRate = averageProgress(
          departmentPersonalGoals.map((goal) => goal.monthlyRecords[0]?.achievementRate ?? undefined)
        ) ?? 0

        return {
          departmentId: department.id,
          departmentName: department.name,
          activeEmployeeCount: activeCount,
          orgGoalCount: departmentOrgGoals.length,
          personalGoalCount: departmentPersonalGoals.length,
          personalGoalSetupRate: activeCount ? Math.round((departmentPersonalGoals.length / activeCount) * 100) : 0,
          alignmentRate: departmentPersonalGoals.length ? Math.round((alignedCount / departmentPersonalGoals.length) * 100) : 0,
          orphanGoalCount: orphanCount,
          completedCheckInRate,
          averageProgressRate,
          riskCount: departmentOrgGoals.filter((goal) => (orgNodeById.get(goal.id)?.riskFlags.length ?? 0) > 0).length,
          relatedUrl: `/kpi/org?year=${selectedYear}&dept=${encodeURIComponent(department.id)}&tab=linkage`,
        } satisfies GoalAlignmentDepartmentSummary
      })
      .sort((left, right) => right.orphanGoalCount - left.orphanGoalCount || left.departmentName.localeCompare(right.departmentName, 'ko'))

    const alignedPersonalGoalCount = personalGoals.filter((goal) => Boolean(goal.linkedOrgKpiId && orgGoalById.has(goal.linkedOrgKpiId))).length
    const summary = {
      orgGoalCount: orgGoals.length,
      personalGoalCount: personalGoals.length,
      alignedPersonalGoalCount,
      orphanOrgGoalCount: orgGoals.filter((goal) => Boolean(goal.parentOrgKpiId && !orgGoalById.has(goal.parentOrgKpiId))).length,
      orphanPersonalGoalCount: orphanPersonalGoals.length,
      personalGoalSetupRate: activeEmployees.length ? Math.round((personalGoals.length / activeEmployees.length) * 100) : 0,
      completedCheckInRate: checkIns.length ? Math.round((checkIns.filter((item) => item.status === 'COMPLETED').length / checkIns.length) * 100) : 0,
      averageProgressRate: averageProgress(Array.from(personalNodeById.values()).map((item) => item.progressRate)) ?? 0,
    }

    const state: GoalAlignmentPageState = orgGoals.length || personalGoals.length ? 'ready' : 'empty'

    return {
      state,
      message: state === 'empty' ? '선택한 조건에서 확인할 목표 정렬 데이터가 없습니다.' : undefined,
      alerts,
      selectedYear,
      selectedCycleId: params.cycleId && cycleOptions.some((item) => item.id === params.cycleId) ? params.cycleId : cycleOptions[0]?.id,
      selectedDepartmentId,
      selectedStatus: filteredStatus,
      availableYears,
      cycleOptions,
      departmentOptions,
      statusOptions: STATUS_OPTIONS,
      summary,
      board,
      orphanPersonalGoals,
      departmentSummary,
      permissions: {
        canExport: true,
        canRunReminder: true,
      },
      quickLinks: {
        readModeHref: params.cycleId ? `/admin/eval-cycle?cycleId=${encodeURIComponent(params.cycleId)}` : '/admin/eval-cycle',
        reminderHref: '/admin/notifications',
        orgKpiHref:
          selectedDepartmentId === 'ALL'
            ? `/kpi/org?year=${selectedYear}`
            : `/kpi/org?year=${selectedYear}&dept=${encodeURIComponent(selectedDepartmentId)}`,
      },
    }
  } catch (error) {
    console.error('[goal-alignment] fatal', error)
    return {
      state: 'error',
      message: '목표 얼라인먼트 화면을 준비하는 중 오류가 발생했습니다.',
      alerts,
      selectedYear: params.year ?? new Date().getFullYear(),
      selectedCycleId: params.cycleId,
      selectedDepartmentId: params.departmentId ?? 'ALL',
      selectedStatus: params.status ?? 'ALL',
      availableYears: [params.year ?? new Date().getFullYear()],
      cycleOptions: [],
      departmentOptions: [],
      statusOptions: STATUS_OPTIONS,
      summary: {
        orgGoalCount: 0,
        personalGoalCount: 0,
        alignedPersonalGoalCount: 0,
        orphanOrgGoalCount: 0,
        orphanPersonalGoalCount: 0,
        personalGoalSetupRate: 0,
        completedCheckInRate: 0,
        averageProgressRate: 0,
      },
      board: [],
      orphanPersonalGoals: [],
      departmentSummary: [],
      permissions: { canExport: false, canRunReminder: false },
      quickLinks: {
        readModeHref: '/admin/eval-cycle',
        reminderHref: '/admin/notifications',
        orgKpiHref: '/kpi/org',
      },
    }
  }
}

type OrgParentValidationParams = {
  goalId?: string
  parentOrgKpiId?: string | null
  targetDeptId: string
  targetEvalYear: number
  editableDepartmentIds: string[] | null
  prismaClient?: typeof prisma
}

type PersonalLinkValidationParams = {
  linkedOrgKpiId?: string | null
  targetEvalYear: number
  targetEmployeeDeptId: string
  prismaClient?: typeof prisma
}

export async function validateOrgParentLink(params: OrgParentValidationParams) {
  if (!params.parentOrgKpiId) {
    return null
  }

  const prismaClient = params.prismaClient ?? prisma
  const [parent, departments] = await Promise.all([
    prismaClient.orgKpi.findUnique({
      where: { id: params.parentOrgKpiId },
      select: {
        id: true,
        deptId: true,
        evalYear: true,
        status: true,
        parentOrgKpiId: true,
      },
    }),
    prismaClient.department.findMany({
      select: {
        id: true,
        deptName: true,
        deptCode: true,
        parentDeptId: true,
      },
    }),
  ])

  if (!parent) {
    throw new AppError(404, 'ORG_KPI_PARENT_NOT_FOUND', '상위 조직 목표를 찾을 수 없습니다.')
  }
  if (params.goalId && parent.id === params.goalId) {
    throw new AppError(400, 'ORG_KPI_PARENT_SELF', '자기 자신을 상위 목표로 연결할 수 없습니다.')
  }
  if (parent.evalYear !== params.targetEvalYear) {
    throw new AppError(400, 'ORG_KPI_PARENT_YEAR_MISMATCH', '같은 연도의 조직 목표끼리만 연결할 수 있습니다.')
  }

  const departmentsById = new Map(departments.map((department) => [department.id, department]))
  const allowedDepartmentIds = new Set([
    params.targetDeptId,
    ...collectAncestorIds(params.targetDeptId, departmentsById),
  ])

  if (!allowedDepartmentIds.has(parent.deptId)) {
    throw new AppError(400, 'ORG_KPI_PARENT_SCOPE_MISMATCH', '상위 목표는 같은 조직이거나 상위 조직 목표만 선택할 수 있습니다.')
  }

  if (params.editableDepartmentIds && !params.editableDepartmentIds.includes(params.targetDeptId)) {
    throw new AppError(403, 'ORG_KPI_TARGET_SCOPE_FORBIDDEN', '현재 권한으로 수정할 수 없는 조직 목표입니다.')
  }

  const visited = new Set<string>(params.goalId ? [params.goalId] : [])
  let currentParentId: string | null = parent.parentOrgKpiId
  while (currentParentId) {
    if (visited.has(currentParentId)) {
      throw new AppError(400, 'ORG_KPI_PARENT_CYCLE', '순환 참조가 발생하는 상위 목표 연결은 저장할 수 없습니다.')
    }
    visited.add(currentParentId)
    const current = await prismaClient.orgKpi.findUnique({
      where: { id: currentParentId },
      select: { parentOrgKpiId: true },
    })
    currentParentId = current?.parentOrgKpiId ?? null
  }

  return parent.id
}

export async function validatePersonalOrgLink(params: PersonalLinkValidationParams) {
  if (!params.linkedOrgKpiId) {
    return null
  }

  const prismaClient = params.prismaClient ?? prisma
  const [linkedGoal, departments] = await Promise.all([
    prismaClient.orgKpi.findUnique({
      where: { id: params.linkedOrgKpiId },
      select: {
        id: true,
        deptId: true,
        evalYear: true,
        status: true,
      },
    }),
    prismaClient.department.findMany({
      select: {
        id: true,
        deptName: true,
        deptCode: true,
        parentDeptId: true,
      },
    }),
  ])

  if (!linkedGoal) {
    throw new AppError(404, 'ORG_KPI_NOT_FOUND', '연결할 조직 목표를 찾을 수 없습니다.')
  }
  if (linkedGoal.evalYear !== params.targetEvalYear) {
    throw new AppError(400, 'ORG_KPI_YEAR_MISMATCH', '같은 연도의 조직 목표만 연결할 수 있습니다.')
  }
  if (linkedGoal.status === 'ARCHIVED') {
    throw new AppError(400, 'ORG_KPI_ARCHIVED', '보관된 조직 목표는 연결할 수 없습니다.')
  }

  const departmentsById = new Map(departments.map((department) => [department.id, department]))
  const allowedDepartmentIds = new Set([
    params.targetEmployeeDeptId,
    ...collectAncestorIds(params.targetEmployeeDeptId, departmentsById),
  ])
  if (!allowedDepartmentIds.has(linkedGoal.deptId)) {
    throw new AppError(400, 'ORG_KPI_SCOPE_MISMATCH', '현재 직원이 속한 조직 또는 상위 조직 목표만 연결할 수 있습니다.')
  }

  return linkedGoal.id
}

function csvEscape(value: string | number | null | undefined) {
  if (value === null || value === undefined) return ''
  const text = String(value)
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replaceAll('"', '""')}"`
  }
  return text
}

export function buildGoalAlignmentCsv(data: GoalAlignmentPageData) {
  const rows: string[] = []
  rows.push(
    [
      '유형',
      '조직',
      '목표명',
      '상태',
      '진척도',
      '상위 경로',
      '연결 개인 목표 수',
      '위험 플래그',
      '이동 경로',
    ]
      .map(csvEscape)
      .join(',')
  )

  function pushNode(node: GoalAlignmentOrgNode, depth = 0) {
    rows.push(
      [
        `조직 목표 L${depth + 1}`,
        node.departmentName,
        node.title,
        node.status,
        node.progressRate ?? '',
        node.lineage.map((item) => `${item.departmentName}:${item.title}`).join(' > '),
        node.linkedPersonalGoalCount,
        node.riskFlags.join(' / '),
        node.href,
      ]
        .map(csvEscape)
        .join(',')
    )

    node.personalGoals.forEach((goal) => {
      rows.push(
        [
          '개인 목표',
          goal.departmentName,
          `${goal.employeeName} · ${goal.title}`,
          goal.status,
          goal.progressRate ?? '',
          node.title,
          '',
          goal.isOrphan ? '미연결' : '',
          goal.href,
        ]
          .map(csvEscape)
          .join(',')
      )
    })
    node.children.forEach((child) => pushNode(child, depth + 1))
  }

  data.board.forEach((node) => pushNode(node))
  data.orphanPersonalGoals.forEach((goal) => {
    rows.push(
      ['미연결 개인 목표', goal.departmentName, `${goal.employeeName} · ${goal.title}`, goal.status, goal.progressRate ?? '', '', '', '미연결', goal.href]
        .map(csvEscape)
        .join(',')
    )
  })

  return `\uFEFF${rows.join('\n')}`
}
