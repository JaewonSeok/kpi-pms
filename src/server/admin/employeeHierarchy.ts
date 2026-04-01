import type { EmployeeStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'

type EmployeeRole =
  | 'ROLE_MEMBER'
  | 'ROLE_TEAM_LEADER'
  | 'ROLE_SECTION_CHIEF'
  | 'ROLE_DIV_HEAD'
  | 'ROLE_CEO'
  | 'ROLE_ADMIN'

type Assignment = {
  teamLeaderId: string | null
  sectionChiefId: string | null
  divisionHeadId: string | null
}

type HierarchyDepartment = {
  id: string
  deptName: string
  parentDeptId: string | null
  leaderEmployeeId: string | null
  excludeLeaderFromEvaluatorAutoAssign: boolean
}

type HierarchyEmployee = {
  id: string
  empId: string
  empName: string
  deptId: string
  role: EmployeeRole
  status: EmployeeStatus
  joinDate: Date
  createdAt: Date
  teamLeaderId: string | null
  sectionChiefId: string | null
  divisionHeadId: string | null
}

type PreviewEmployeeInput = {
  id?: string
  empId: string
  empName: string
  deptId: string
  role: EmployeeRole
  status: EmployeeStatus
  joinDate?: Date
}

const ROLE_ORDER: Record<EmployeeRole, number> = {
  ROLE_MEMBER: 0,
  ROLE_ADMIN: 0,
  ROLE_TEAM_LEADER: 1,
  ROLE_SECTION_CHIEF: 2,
  ROLE_DIV_HEAD: 3,
  ROLE_CEO: 4,
}

function shouldAssignTeamLeader(role: EmployeeRole) {
  return ROLE_ORDER[role] < ROLE_ORDER.ROLE_TEAM_LEADER
}

function shouldAssignSectionChief(role: EmployeeRole) {
  return ROLE_ORDER[role] < ROLE_ORDER.ROLE_SECTION_CHIEF
}

function shouldAssignDivisionHead(role: EmployeeRole) {
  return ROLE_ORDER[role] < ROLE_ORDER.ROLE_DIV_HEAD
}

function buildRoleBasedAssignments(departments: HierarchyDepartment[], employees: HierarchyEmployee[]) {
  const parentByDeptId = new Map(departments.map((department) => [department.id, department.parentDeptId]))
  const activeEmployees = employees.filter((employee) => employee.status === 'ACTIVE')
  const leadersByDept = new Map<
    string,
    {
      teamLeaderIds: string[]
      sectionChiefIds: string[]
      divisionHeadIds: string[]
    }
  >()

  for (const employee of activeEmployees) {
    const current = leadersByDept.get(employee.deptId) ?? {
      teamLeaderIds: [],
      sectionChiefIds: [],
      divisionHeadIds: [],
    }

    if (employee.role === 'ROLE_TEAM_LEADER') {
      current.teamLeaderIds.push(employee.id)
    }
    if (employee.role === 'ROLE_SECTION_CHIEF') {
      current.sectionChiefIds.push(employee.id)
    }
    if (employee.role === 'ROLE_DIV_HEAD') {
      current.divisionHeadIds.push(employee.id)
    }

    leadersByDept.set(employee.deptId, current)
  }

  const findLeaderInHierarchy = (
    deptId: string,
    keys: 'teamLeaderIds' | 'sectionChiefIds' | 'divisionHeadIds',
    employeeId: string
  ) => {
    const visited = new Set<string>()
    let currentDeptId: string | null | undefined = deptId

    while (currentDeptId && !visited.has(currentDeptId)) {
      visited.add(currentDeptId)
      const deptLeaders = leadersByDept.get(currentDeptId)
      const found = deptLeaders?.[keys].find((candidateId) => candidateId !== employeeId)
      if (found) {
        return found
      }
      currentDeptId = parentByDeptId.get(currentDeptId)
    }

    return null
  }

  return new Map(
    employees.map((employee) => {
      const nextAssignment: Assignment = {
        teamLeaderId: shouldAssignTeamLeader(employee.role)
          ? findLeaderInHierarchy(employee.deptId, 'teamLeaderIds', employee.id)
          : null,
        sectionChiefId: shouldAssignSectionChief(employee.role)
          ? findLeaderInHierarchy(employee.deptId, 'sectionChiefIds', employee.id)
          : null,
        divisionHeadId: shouldAssignDivisionHead(employee.role)
          ? findLeaderInHierarchy(employee.deptId, 'divisionHeadIds', employee.id)
          : null,
      }

      return [employee.id, nextAssignment]
    })
  )
}

function fillAssignmentSlots(candidates: Array<string | null | undefined>) {
  const assigned: string[] = []

  for (const candidate of candidates) {
    if (!candidate || assigned.includes(candidate)) continue
    assigned.push(candidate)
    if (assigned.length === 3) break
  }

  return {
    teamLeaderId: assigned[0] ?? null,
    sectionChiefId: assigned[1] ?? null,
    divisionHeadId: assigned[2] ?? null,
  } satisfies Assignment
}

export function buildAssignments(
  departments: HierarchyDepartment[],
  employees: HierarchyEmployee[]
) {
  const roleBasedAssignments = buildRoleBasedAssignments(departments, employees)
  const activeEmployeeIds = new Set(
    employees.filter((employee) => employee.status === 'ACTIVE').map((employee) => employee.id)
  )
  const departmentById = new Map(departments.map((department) => [department.id, department]))

  return new Map(
    employees.map((employee) => {
      const leaderChain: string[] = []
      const excludedLeaderIds = new Set<string>()
      const visited = new Set<string>()
      let currentDeptId: string | null | undefined = employee.deptId

      while (currentDeptId && !visited.has(currentDeptId)) {
        visited.add(currentDeptId)
        const department = departmentById.get(currentDeptId)
        const leaderId = department?.leaderEmployeeId ?? null

        if (department?.excludeLeaderFromEvaluatorAutoAssign && leaderId) {
          excludedLeaderIds.add(leaderId)
        }

        if (
          leaderId &&
          !department?.excludeLeaderFromEvaluatorAutoAssign &&
          leaderId !== employee.id &&
          activeEmployeeIds.has(leaderId) &&
          !leaderChain.includes(leaderId)
        ) {
          leaderChain.push(leaderId)
        }

        currentDeptId = department?.parentDeptId ?? null
      }

      const fallback = roleBasedAssignments.get(employee.id) ?? {
        teamLeaderId: null,
        sectionChiefId: null,
        divisionHeadId: null,
      }

      const nextAssignment = fillAssignmentSlots([
        ...leaderChain,
        excludedLeaderIds.has(fallback.teamLeaderId ?? '') ? null : fallback.teamLeaderId,
        excludedLeaderIds.has(fallback.sectionChiefId ?? '') ? null : fallback.sectionChiefId,
        excludedLeaderIds.has(fallback.divisionHeadId ?? '') ? null : fallback.divisionHeadId,
      ])

      return [employee.id, nextAssignment]
    })
  )
}

async function loadHierarchyBaseData() {
  const [departments, employees] = await Promise.all([
    prisma.department.findMany({
      select: {
        id: true,
        deptName: true,
        parentDeptId: true,
        leaderEmployeeId: true,
        excludeLeaderFromEvaluatorAutoAssign: true,
      },
    }),
    prisma.employee.findMany({
      select: {
        id: true,
        empId: true,
        empName: true,
        deptId: true,
        role: true,
        status: true,
        joinDate: true,
        createdAt: true,
        teamLeaderId: true,
        sectionChiefId: true,
        divisionHeadId: true,
      },
      orderBy: [{ joinDate: 'asc' }, { createdAt: 'asc' }],
    }),
  ])

  return { departments, employees }
}

export async function previewEmployeeLeadershipLinks(
  overrides: {
    updates?: PreviewEmployeeInput[]
    creates?: PreviewEmployeeInput[]
  } = {}
) {
  const { departments, employees } = await loadHierarchyBaseData()

  const updateMap = new Map((overrides.updates ?? []).map((employee) => [employee.id, employee]))
  const currentEmployees: HierarchyEmployee[] = employees.map((employee) => {
    const override = employee.id ? updateMap.get(employee.id) : undefined
    return {
      id: employee.id,
      empId: override?.empId ?? employee.empId,
      empName: override?.empName ?? employee.empName,
      deptId: override?.deptId ?? employee.deptId,
      role: (override?.role ?? employee.role) as EmployeeRole,
      status: (override?.status ?? employee.status) as EmployeeStatus,
      joinDate: override?.joinDate ?? employee.joinDate,
      createdAt: employee.createdAt,
      teamLeaderId: employee.teamLeaderId,
      sectionChiefId: employee.sectionChiefId,
      divisionHeadId: employee.divisionHeadId,
    }
  })

  const createdEmployees: HierarchyEmployee[] = (overrides.creates ?? []).map((employee, index) => ({
    id: employee.id ?? `preview-new-${employee.empId}-${index}`,
    empId: employee.empId,
    empName: employee.empName,
    deptId: employee.deptId,
    role: employee.role,
    status: employee.status,
    joinDate: employee.joinDate ?? new Date(),
    createdAt: new Date(),
    teamLeaderId: null,
    sectionChiefId: null,
    divisionHeadId: null,
  }))

  const combinedEmployees = [...currentEmployees, ...createdEmployees].sort((a, b) => {
    const joinTimeDiff = a.joinDate.getTime() - b.joinDate.getTime()
    if (joinTimeDiff !== 0) {
      return joinTimeDiff
    }
    return a.createdAt.getTime() - b.createdAt.getTime()
  })

  const nextAssignments = buildAssignments(
    departments.map((department) => ({
      id: department.id,
      deptName: department.deptName,
      parentDeptId: department.parentDeptId,
      leaderEmployeeId: department.leaderEmployeeId,
      excludeLeaderFromEvaluatorAutoAssign: department.excludeLeaderFromEvaluatorAutoAssign,
    })),
    combinedEmployees
  )

  const employeeMap = new Map(combinedEmployees.map((employee) => [employee.id, employee]))
  const departmentMap = new Map(departments.map((department) => [department.id, department.deptName]))
  const changedEmployees = combinedEmployees
    .map((employee) => {
      const nextAssignment = nextAssignments.get(employee.id) ?? {
        teamLeaderId: null,
        sectionChiefId: null,
        divisionHeadId: null,
      }

      const changedFields = [
        employee.teamLeaderId !== nextAssignment.teamLeaderId ? 'teamLeader' : null,
        employee.sectionChiefId !== nextAssignment.sectionChiefId ? 'sectionChief' : null,
        employee.divisionHeadId !== nextAssignment.divisionHeadId ? 'divisionHead' : null,
      ].filter((value): value is 'teamLeader' | 'sectionChief' | 'divisionHead' => value !== null)

      if (!changedFields.length) {
        return null
      }

      return {
        employeeId: employee.id,
        empId: employee.empId,
        empName: employee.empName,
        deptName: departmentMap.get(employee.deptId) ?? '-',
        role: employee.role,
        changedFields,
        current: {
          teamLeaderName: employee.teamLeaderId ? employeeMap.get(employee.teamLeaderId)?.empName ?? '-' : '-',
          sectionChiefName: employee.sectionChiefId
            ? employeeMap.get(employee.sectionChiefId)?.empName ?? '-'
            : '-',
          divisionHeadName: employee.divisionHeadId
            ? employeeMap.get(employee.divisionHeadId)?.empName ?? '-'
            : '-',
        },
        next: {
          teamLeaderName: nextAssignment.teamLeaderId
            ? employeeMap.get(nextAssignment.teamLeaderId)?.empName ?? '-'
            : '-',
          sectionChiefName: nextAssignment.sectionChiefId
            ? employeeMap.get(nextAssignment.sectionChiefId)?.empName ?? '-'
            : '-',
          divisionHeadName: nextAssignment.divisionHeadId
            ? employeeMap.get(nextAssignment.divisionHeadId)?.empName ?? '-'
            : '-',
        },
      }
    })
    .filter((value): value is NonNullable<typeof value> => value !== null)

  return {
    summary: {
      changedEmployeeCount: changedEmployees.length,
      teamLeaderChangedCount: changedEmployees.filter((item) => item.changedFields.includes('teamLeader')).length,
      sectionChiefChangedCount: changedEmployees.filter((item) => item.changedFields.includes('sectionChief'))
        .length,
      divisionHeadChangedCount: changedEmployees.filter((item) => item.changedFields.includes('divisionHead'))
        .length,
    },
    changedEmployees,
  }
}

export async function recalculateEmployeeLeadershipLinks() {
  const { departments, employees } = await loadHierarchyBaseData()
  const nextAssignments = buildAssignments(
    departments.map((department) => ({
      id: department.id,
      deptName: department.deptName,
      parentDeptId: department.parentDeptId,
      leaderEmployeeId: department.leaderEmployeeId,
      excludeLeaderFromEvaluatorAutoAssign: department.excludeLeaderFromEvaluatorAutoAssign,
    })),
    employees.map((employee) => ({
      ...employee,
      role: employee.role as EmployeeRole,
      status: employee.status,
    }))
  )

  let updatedCount = 0

  for (const employee of employees) {
    const nextAssignment = nextAssignments.get(employee.id) ?? {
      teamLeaderId: null,
      sectionChiefId: null,
      divisionHeadId: null,
    }

    await prisma.employee.update({
      where: { id: employee.id },
      data: nextAssignment,
    })
    updatedCount += 1
  }

  return {
    updatedCount,
  }
}
