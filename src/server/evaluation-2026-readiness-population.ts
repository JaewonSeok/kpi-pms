import type { Session } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { EVALUATION_POLICY_2026, type EvaluationPolicyItemCategoryCode } from '@/lib/evaluation-policy-2026'
import {
  readPolicy2026OfficialReadinessEnabled,
  readPolicy2026PreviewMappings,
  type EvaluationPolicy2026SalesGroup,
} from '@/lib/evaluation-policy-2026-preview-metadata'
import { get2026EvaluationFeatureFlags } from '@/lib/feature-flags'
import { AppError } from '@/lib/utils'
import { canAccessEvaluationPreview2026 } from '@/server/evaluation-preview-2026-loader'
import {
  detectDailyWorkDuplicateWithOrgGoal2026,
  determineOrgKpiReflectionEligibility2026,
  type KpiAlignmentOrgLevel2026,
  type OrgKpiAlignmentInput2026,
} from '@/server/kpi-alignment-policy-2026'
import {
  resolvePersonalKpiOperationalStatus,
  type PersonalKpiOperationalStatus,
} from '@/server/personal-kpi-workflow'

type Evaluation2026ReadinessPopulationDb = {
  evalCycle: {
    findUnique: (args: unknown) => Promise<unknown>
  }
  employee: {
    findMany: (args: unknown) => Promise<unknown[]>
  }
  personalKpi: {
    findMany: (args: unknown) => Promise<unknown[]>
  }
  evaluation: {
    findMany: (args: unknown) => Promise<unknown[]>
  }
  department: {
    findMany: (args: unknown) => Promise<unknown[]>
  }
  auditLog?: {
    findMany: (args: unknown) => Promise<unknown[]>
  }
}

type EvalCycleForDryRun2026 = {
  id: string
  orgId: string
  cycleName: string
  evalYear: number
  status: string
  performanceDesignConfig: unknown
}

type DepartmentNode2026 = {
  id: string
  deptName: string
  parentDeptId: string | null
}

type ActiveEmployee2026 = {
  id: string
  empId?: string | null
  empName: string
  deptId: string
  role?: string | null
  position?: string | null
  department?: {
    id?: string
    deptName?: string | null
    parentDeptId?: string | null
  } | null
}

type PersonalKpi2026 = {
  id: string
  employeeId: string
  kpiName: string
  definition?: string | null
  formula?: string | null
  policyCategory: EvaluationPolicyItemCategoryCode | null
  status: 'DRAFT' | 'CONFIRMED' | 'ARCHIVED' | string
  weight?: number | null
  targetValueT?: number | null
  linkedOrgKpiId?: string | null
  linkedOrgKpi?: {
    id: string
    kpiName: string
    status?: string | null
    parentOrgKpiId?: string | null
    mboExceptionApproved?: boolean | null
    mboExceptionReason?: string | null
    mboExceptionApprovedById?: string | null
    mboExceptionApprovedAt?: Date | string | null
    department?: {
      id?: string | null
      deptName?: string | null
      parentDeptId?: string | null
    } | null
    teamKpiReviewItems?: Array<{
      verdict: string
    }>
  } | null
}

type PersonalKpiAuditLog2026 = {
  action: string
  timestamp: Date | string
  entityId?: string | null
  oldValue?: unknown
  newValue?: unknown
}

type ExistingSelfEvaluation2026 = {
  id: string
  targetId: string
  evalStage: string
  items: Array<{
    id: string
    personalKpiId: string
    policyCategory: EvaluationPolicyItemCategoryCode | null
    personalKpi?: {
      id: string
      kpiName: string
      policyCategory: EvaluationPolicyItemCategoryCode | null
    } | null
  }>
}

export type Evaluation2026ReadinessPopulationEmployeeSummary = {
  employeeId: string
  employeeNo: string | null
  employeeName: string
  departmentId: string | null
  departmentName: string
  departmentPath: string
  confirmedPersonalKpiCount: number
}

export type Evaluation2026ReadinessPopulationWouldCreateEvaluation = {
  employeeId: string
  employeeName: string
  departmentName: string
  confirmedPersonalKpiCount: number
  wouldCreateItemCount: number
  missingPolicyCategoryCount: number
  itemTitles: string[]
}

export type Evaluation2026ReadinessPopulationSkippedEvaluation = {
  evaluationId: string
  employeeId: string
  employeeName: string
  departmentName: string
  confirmedPersonalKpiCount: number
  existingItemCount: number
  missingPolicyCategoryCount: number
}

export type Evaluation2026ReadinessPopulationDivisionCoverage = {
  divisionId: string
  divisionName: string
  activeEmployeeCount: number
  draftPersonalKpiEmployeeCount: number
  submittedPersonalKpiEmployeeCount: number
  confirmedPersonalKpiEmployeeCount: number
  missingAnyPersonalKpiEmployeeCount: number
  currentSalesGroup: EvaluationPolicy2026SalesGroup | null
}

export type Evaluation2026ReadinessPopulationTeamCoverage = {
  departmentId: string
  departmentName: string
  departmentPath: string
  activeEmployeeCount: number
  draftPersonalKpiEmployeeCount: number
  submittedPersonalKpiEmployeeCount: number
  confirmedPersonalKpiEmployeeCount: number
  missingAnyPersonalKpiEmployeeCount: number
}

export type Evaluation2026ReadinessPopulationDepartmentOverrideCoverage = {
  departmentId: string
  departmentName: string
  departmentPath: string
  currentSalesGroup: EvaluationPolicy2026SalesGroup
  affectedActiveEmployeeCount: number
}

export type Evaluation2026ReadinessPopulationBlocker = {
  code: string
  message: string
  count?: number
}

export type Evaluation2026ReadinessPopulationDryRun = {
  policyVersion: string
  generatedAt: string
  isDryRun: true
  selectedEvalCycle: {
    id: string
    name: string
    year: number
    status: string
    isOfficialReadinessTarget: boolean
  }
  activeEmployeeCount: number
  employeesWithConfirmedPersonalKpiCount: number
  employeesWithConfirmedPersonalKpi: Evaluation2026ReadinessPopulationEmployeeSummary[]
  employeesMissingConfirmedPersonalKpiCount: number
  employeesMissingConfirmedPersonalKpi: Evaluation2026ReadinessPopulationEmployeeSummary[]
  existingSelfEvaluationCount: number
  existingSelfEvaluationsSkipped: Evaluation2026ReadinessPopulationSkippedEvaluation[]
  wouldCreateSelfEvaluationCount: number
  wouldCreateSelfEvaluations: Evaluation2026ReadinessPopulationWouldCreateEvaluation[]
  wouldCreateEvaluationItemCount: number
  existingEvaluationItemsSkippedCount: number
  policyCategoryMissingCount: number
  mboSetupCoverage: {
    employeesWithDraftPersonalKpiCount: number
    employeesWithSubmittedPersonalKpiCount: number
    employeesWithConfirmedPersonalKpiCount: number
    employeesMissingAnyPersonalKpiCount: number
    personalKpiStatusDistribution: Record<'draft' | 'submitted' | 'managerReview' | 'confirmed' | 'locked' | 'archived', number>
    categoryDistribution: Record<'ORG_GOAL' | 'PROJECT_T' | 'PROJECT_K' | 'DAILY_WORK' | 'UNMAPPED', number>
    linkedOrgKpiPersonalKpiCount: number
    warningCounts: {
      orgGoalWithoutEligibleOrgKpi: number
      dailyWorkDuplicateRisk: number
      missingWeight: number
      missingPlan: number
      missingMeasurableTarget: number
      missingOwnerContribution: number
      missingCategory: number
    }
    divisionCoverage: Evaluation2026ReadinessPopulationDivisionCoverage[]
    teamCoverage: Evaluation2026ReadinessPopulationTeamCoverage[]
  }
  divisionSalesMappingCoverage: {
    totalDivisions: number
    mappedDivisions: number
    unmappedDivisions: number
    mappedActiveEmployeeCount: number
    unmappedActiveEmployeeCount: number
    divisions: Evaluation2026ReadinessPopulationDivisionCoverage[]
  }
  departmentOverrideCoverage: {
    savedOverrideCount: number
    affectedActiveEmployeeCount: number
    overrides: Evaluation2026ReadinessPopulationDepartmentOverrideCoverage[]
  }
  blockers: Evaluation2026ReadinessPopulationBlocker[]
  warnings: Evaluation2026ReadinessPopulationBlocker[]
  safety: {
    writesPerformed: false
    evaluationsCreated: 0
    evaluationItemsCreated: 0
    assignmentsMutated: 0
    totalScoreChanged: false
    gradeIdChanged: false
    officialScoringEnabled: boolean
    officialGradeEnabled: boolean
    officialAiScoreExclusionEnabled: boolean
  }
}

function hasText(value: string | null | undefined) {
  return typeof value === 'string' && value.trim().length > 0
}

function formatDepartmentPath(params: {
  departmentId?: string | null
  departmentsById: Map<string, DepartmentNode2026>
}) {
  if (!params.departmentId) return '소속 조직 미지정'
  const path: DepartmentNode2026[] = []
  const visited = new Set<string>()
  let current = params.departmentsById.get(params.departmentId)

  while (current && !visited.has(current.id)) {
    visited.add(current.id)
    path.push(current)
    current = current.parentDeptId ? params.departmentsById.get(current.parentDeptId) : undefined
  }

  return path.length ? path.reverse().map((department) => department.deptName).join(' > ') : params.departmentId
}

function resolveDivisionId(params: {
  departmentId?: string | null
  departmentsById: Map<string, DepartmentNode2026>
}) {
  if (!params.departmentId) return null
  let current = params.departmentsById.get(params.departmentId)
  if (!current) return null

  const visited = new Set<string>()
  while (current.parentDeptId && !visited.has(current.id)) {
    visited.add(current.id)
    const parent = params.departmentsById.get(current.parentDeptId)
    if (!parent) break
    current = parent
  }

  return current.id
}

function resolveDepartmentOverridePath(params: {
  departmentId?: string | null
  departmentsById: Map<string, DepartmentNode2026>
}) {
  if (!params.departmentId) return []
  const ids: string[] = []
  const visited = new Set<string>()
  let current = params.departmentsById.get(params.departmentId)

  while (current && !visited.has(current.id)) {
    visited.add(current.id)
    if (current.parentDeptId) ids.push(current.id)
    current = current.parentDeptId ? params.departmentsById.get(current.parentDeptId) : undefined
  }

  return ids
}

function resolveDepartmentLevel2026(params: {
  departmentId?: string | null
  departmentsById: Map<string, DepartmentNode2026>
}): KpiAlignmentOrgLevel2026 {
  if (!params.departmentId) return 'UNKNOWN'
  const current = params.departmentsById.get(params.departmentId)
  if (!current) return 'UNKNOWN'
  return current.parentDeptId ? 'TEAM' : 'DIVISION'
}

function makeEmployeeSummary(params: {
  employee: ActiveEmployee2026
  confirmedPersonalKpiCount: number
  departmentsById: Map<string, DepartmentNode2026>
}): Evaluation2026ReadinessPopulationEmployeeSummary {
  return {
    employeeId: params.employee.id,
    employeeNo: params.employee.empId ?? null,
    employeeName: params.employee.empName,
    departmentId: params.employee.deptId ?? null,
    departmentName:
      params.employee.department?.deptName ??
      params.departmentsById.get(params.employee.deptId)?.deptName ??
      '소속 조직 미지정',
    departmentPath: formatDepartmentPath({
      departmentId: params.employee.deptId,
      departmentsById: params.departmentsById,
    }),
    confirmedPersonalKpiCount: params.confirmedPersonalKpiCount,
  }
}

function countMissingPolicyCategoriesForKpis(kpis: PersonalKpi2026[]) {
  return kpis.filter((kpi) => !kpi.policyCategory).length
}

function countMissingPolicyCategoriesForExistingItems(evaluation: ExistingSelfEvaluation2026) {
  return evaluation.items.filter((item) => !(item.policyCategory ?? item.personalKpi?.policyCategory ?? null)).length
}

function addBlocker(params: {
  target: Evaluation2026ReadinessPopulationBlocker[]
  code: string
  message: string
  count?: number
}) {
  if (params.count !== undefined && params.count <= 0) return
  params.target.push({
    code: params.code,
    message: params.message,
    ...(params.count !== undefined ? { count: params.count } : {}),
  })
}

function buildLogsByKpiId(logs: PersonalKpiAuditLog2026[]) {
  const logsByKpiId = new Map<string, PersonalKpiAuditLog2026[]>()
  for (const log of logs) {
    if (!log.entityId) continue
    const current = logsByKpiId.get(log.entityId) ?? []
    current.push(log)
    logsByKpiId.set(log.entityId, current)
  }
  return logsByKpiId
}

function toOperationalStatus2026(kpi: PersonalKpi2026, logsByKpiId: Map<string, PersonalKpiAuditLog2026[]>) {
  return resolvePersonalKpiOperationalStatus({
    status: (kpi.status === 'CONFIRMED' || kpi.status === 'ARCHIVED' ? kpi.status : 'DRAFT') as
      | 'DRAFT'
      | 'CONFIRMED'
      | 'ARCHIVED',
    logs: logsByKpiId.get(kpi.id) ?? [],
  })
}

function toOrgKpiAlignmentInput2026(
  orgKpi: PersonalKpi2026['linkedOrgKpi'],
  departmentsById: Map<string, DepartmentNode2026>
): OrgKpiAlignmentInput2026 | null {
  if (!orgKpi) return null
  const departmentId = orgKpi.department?.id ?? null
  return {
    id: orgKpi.id,
    title: orgKpi.kpiName,
    kpiName: orgKpi.kpiName,
    level: resolveDepartmentLevel2026({ departmentId, departmentsById }),
    status: orgKpi.status ?? null,
    parentOrgKpiId: orgKpi.parentOrgKpiId ?? null,
    latestReviewVerdict: orgKpi.teamKpiReviewItems?.[0]?.verdict ?? null,
    hrExceptionApproved: orgKpi.mboExceptionApproved ?? null,
    hrExceptionReason: orgKpi.mboExceptionReason ?? null,
    hrExceptionApprovedById: orgKpi.mboExceptionApprovedById ?? null,
    hrExceptionApprovedAt: orgKpi.mboExceptionApprovedAt ?? null,
    department: {
      id: departmentId,
      deptName: orgKpi.department?.deptName ?? null,
      parentDeptId: orgKpi.department?.parentDeptId ?? null,
    },
  }
}

function hasMeaningfulText(value: string | null | undefined, minLength = 8) {
  return typeof value === 'string' && value.trim().length >= minLength
}

function buildMboSetupCoverage2026(params: {
  activeEmployees: ActiveEmployee2026[]
  personalKpis: PersonalKpi2026[]
  departmentsById: Map<string, DepartmentNode2026>
  operationalStatusByKpiId: Map<string, PersonalKpiOperationalStatus>
}) {
  const kpisByEmployeeId = new Map<string, PersonalKpi2026[]>()
  const employeeStatusSets = new Map<string, Set<PersonalKpiOperationalStatus>>()
  const activeEmployeeIds = new Set(params.activeEmployees.map((employee) => employee.id))

  const categoryDistribution = {
    ORG_GOAL: 0,
    PROJECT_T: 0,
    PROJECT_K: 0,
    DAILY_WORK: 0,
    UNMAPPED: 0,
  }
  const personalKpiStatusDistribution = {
    draft: 0,
    submitted: 0,
    managerReview: 0,
    confirmed: 0,
    locked: 0,
    archived: 0,
  }
  const warningCounts = {
    orgGoalWithoutEligibleOrgKpi: 0,
    dailyWorkDuplicateRisk: 0,
    missingWeight: 0,
    missingPlan: 0,
    missingMeasurableTarget: 0,
    missingOwnerContribution: 0,
    missingCategory: 0,
  }

  for (const kpi of params.personalKpis) {
    if (!activeEmployeeIds.has(kpi.employeeId)) continue
    const current = kpisByEmployeeId.get(kpi.employeeId) ?? []
    current.push(kpi)
    kpisByEmployeeId.set(kpi.employeeId, current)

    const status = params.operationalStatusByKpiId.get(kpi.id) ?? 'DRAFT'
    if (status === 'SUBMITTED') personalKpiStatusDistribution.submitted += 1
    else if (status === 'MANAGER_REVIEW') personalKpiStatusDistribution.managerReview += 1
    else if (status === 'CONFIRMED') personalKpiStatusDistribution.confirmed += 1
    else if (status === 'LOCKED') personalKpiStatusDistribution.locked += 1
    else if (status === 'ARCHIVED') personalKpiStatusDistribution.archived += 1
    else personalKpiStatusDistribution.draft += 1

    const statusSet = employeeStatusSets.get(kpi.employeeId) ?? new Set<PersonalKpiOperationalStatus>()
    statusSet.add(status)
    employeeStatusSets.set(kpi.employeeId, statusSet)

    const category = kpi.policyCategory
    if (category === 'ORG_GOAL' || category === 'PROJECT_T' || category === 'PROJECT_K' || category === 'DAILY_WORK') {
      categoryDistribution[category] += 1
    } else {
      categoryDistribution.UNMAPPED += 1
      warningCounts.missingCategory += 1
    }

    if (!kpi.weight || kpi.weight <= 0) warningCounts.missingWeight += 1
    if (!hasMeaningfulText(kpi.formula)) warningCounts.missingPlan += 1
    if (kpi.targetValueT == null) warningCounts.missingMeasurableTarget += 1
    if (!hasMeaningfulText(kpi.definition)) warningCounts.missingOwnerContribution += 1

    if (category === 'ORG_GOAL') {
      const orgKpi = toOrgKpiAlignmentInput2026(kpi.linkedOrgKpi, params.departmentsById)
      if (!orgKpi || !determineOrgKpiReflectionEligibility2026(orgKpi).eligibleAsOrgGoal) {
        warningCounts.orgGoalWithoutEligibleOrgKpi += 1
      }
    }
  }

  const orgGoalReferences = params.personalKpis
    .filter((kpi) => kpi.policyCategory === 'ORG_GOAL')
    .map((kpi) => ({
      id: kpi.id,
      title: kpi.kpiName,
      kpiName: kpi.kpiName,
      definition: kpi.definition,
      formula: kpi.formula,
      linkedOrgKpiId: kpi.linkedOrgKpiId,
    }))

  for (const kpi of params.personalKpis) {
    if (kpi.policyCategory !== 'DAILY_WORK') continue
    const duplicate = detectDailyWorkDuplicateWithOrgGoal2026({
      dailyWork: {
        id: kpi.id,
        title: kpi.kpiName,
        kpiName: kpi.kpiName,
        definition: kpi.definition,
        formula: kpi.formula,
        linkedOrgKpiId: kpi.linkedOrgKpiId,
      },
      orgGoals: orgGoalReferences.filter((orgGoal) => orgGoal.id !== kpi.id),
    })
    if (duplicate.duplicated) warningCounts.dailyWorkDuplicateRisk += 1
  }

  const countEmployeesWithStatus = (predicate: (statuses: Set<PersonalKpiOperationalStatus>) => boolean) =>
    params.activeEmployees.filter((employee) => predicate(employeeStatusSets.get(employee.id) ?? new Set())).length

  const divisionBuckets = new Map<string, ActiveEmployee2026[]>()
  const teamBuckets = new Map<string, ActiveEmployee2026[]>()
  for (const employee of params.activeEmployees) {
    const divisionId = resolveDivisionId({ departmentId: employee.deptId, departmentsById: params.departmentsById })
    if (divisionId) {
      const current = divisionBuckets.get(divisionId) ?? []
      current.push(employee)
      divisionBuckets.set(divisionId, current)
    }
    if (employee.deptId) {
      const current = teamBuckets.get(employee.deptId) ?? []
      current.push(employee)
      teamBuckets.set(employee.deptId, current)
    }
  }

  const buildCoverageCounts = (employees: ActiveEmployee2026[]) => {
    const employeesWithDraftPersonalKpiCount = employees.filter((employee) =>
      (employeeStatusSets.get(employee.id) ?? new Set()).has('DRAFT')
    ).length
    const employeesWithSubmittedPersonalKpiCount = employees.filter((employee) => {
      const statuses = employeeStatusSets.get(employee.id) ?? new Set()
      return statuses.has('SUBMITTED') || statuses.has('MANAGER_REVIEW')
    }).length
    const employeesWithConfirmedPersonalKpiCount = employees.filter((employee) =>
      (employeeStatusSets.get(employee.id) ?? new Set()).has('CONFIRMED')
    ).length
    const employeesMissingAnyPersonalKpiCount = employees.filter((employee) => !kpisByEmployeeId.has(employee.id)).length

    return {
      employeesWithDraftPersonalKpiCount,
      employeesWithSubmittedPersonalKpiCount,
      employeesWithConfirmedPersonalKpiCount,
      employeesMissingAnyPersonalKpiCount,
    }
  }

  const divisionCoverage = Array.from(divisionBuckets.entries())
    .map(([divisionId, employees]) => {
      const counts = buildCoverageCounts(employees)
      return {
        divisionId,
        divisionName: params.departmentsById.get(divisionId)?.deptName ?? divisionId,
        activeEmployeeCount: employees.length,
        draftPersonalKpiEmployeeCount: counts.employeesWithDraftPersonalKpiCount,
        submittedPersonalKpiEmployeeCount: counts.employeesWithSubmittedPersonalKpiCount,
        confirmedPersonalKpiEmployeeCount: counts.employeesWithConfirmedPersonalKpiCount,
        missingAnyPersonalKpiEmployeeCount: counts.employeesMissingAnyPersonalKpiCount,
        currentSalesGroup: null,
      } satisfies Evaluation2026ReadinessPopulationDivisionCoverage
    })
    .sort((left, right) => left.divisionName.localeCompare(right.divisionName, 'ko'))

  const teamCoverage = Array.from(teamBuckets.entries())
    .map(([departmentId, employees]) => ({
      departmentId,
      departmentName: params.departmentsById.get(departmentId)?.deptName ?? departmentId,
      departmentPath: formatDepartmentPath({ departmentId, departmentsById: params.departmentsById }),
      activeEmployeeCount: employees.length,
      draftPersonalKpiEmployeeCount: buildCoverageCounts(employees).employeesWithDraftPersonalKpiCount,
      submittedPersonalKpiEmployeeCount: buildCoverageCounts(employees).employeesWithSubmittedPersonalKpiCount,
      confirmedPersonalKpiEmployeeCount: buildCoverageCounts(employees).employeesWithConfirmedPersonalKpiCount,
      missingAnyPersonalKpiEmployeeCount: buildCoverageCounts(employees).employeesMissingAnyPersonalKpiCount,
    }))
    .sort((left, right) => right.missingAnyPersonalKpiEmployeeCount - left.missingAnyPersonalKpiEmployeeCount)

  return {
    employeesWithDraftPersonalKpiCount: countEmployeesWithStatus((statuses) => statuses.has('DRAFT')),
    employeesWithSubmittedPersonalKpiCount: countEmployeesWithStatus(
      (statuses) => statuses.has('SUBMITTED') || statuses.has('MANAGER_REVIEW')
    ),
    employeesWithConfirmedPersonalKpiCount: countEmployeesWithStatus((statuses) => statuses.has('CONFIRMED')),
    employeesMissingAnyPersonalKpiCount: params.activeEmployees.filter((employee) => !kpisByEmployeeId.has(employee.id)).length,
    personalKpiStatusDistribution,
    categoryDistribution,
    linkedOrgKpiPersonalKpiCount: params.personalKpis.filter((kpi) => Boolean(kpi.linkedOrgKpiId)).length,
    warningCounts,
    divisionCoverage,
    teamCoverage,
  }
}

export async function getEvaluation2026ReadinessPopulationDryRun(params: {
  db?: Evaluation2026ReadinessPopulationDb
  evalCycleId: string
  limit?: number
  env?: NodeJS.ProcessEnv
}): Promise<Evaluation2026ReadinessPopulationDryRun> {
  const db = params.db ?? prisma
  const limit = Math.max(1, Math.min(params.limit ?? 80, 300))
  const cycle = await db.evalCycle.findUnique({
    where: { id: params.evalCycleId },
    select: {
      id: true,
      orgId: true,
      cycleName: true,
      evalYear: true,
      status: true,
      performanceDesignConfig: true,
    },
  }) as EvalCycleForDryRun2026 | null

  if (!cycle) {
    throw new AppError(404, 'EVAL_CYCLE_NOT_FOUND', '평가 주기를 찾을 수 없습니다.')
  }

  const [departments, activeEmployees, personalKpis, selfEvaluations] = await Promise.all([
    db.department.findMany({
      where: { orgId: cycle.orgId },
      select: {
        id: true,
        deptName: true,
        parentDeptId: true,
      },
      orderBy: [{ parentDeptId: 'asc' }, { deptName: 'asc' }],
    }),
    db.employee.findMany({
      where: {
        status: 'ACTIVE',
        department: {
          orgId: cycle.orgId,
        },
      },
      select: {
        id: true,
        empId: true,
        empName: true,
        deptId: true,
        role: true,
        position: true,
        department: {
          select: {
            id: true,
            deptName: true,
            parentDeptId: true,
          },
        },
      },
      orderBy: [{ empName: 'asc' }],
    }),
    db.personalKpi.findMany({
      where: {
        evalYear: cycle.evalYear,
        status: {
          not: 'ARCHIVED',
        },
      },
      select: {
        id: true,
        employeeId: true,
        kpiName: true,
        definition: true,
        formula: true,
        policyCategory: true,
        status: true,
        weight: true,
        targetValueT: true,
        linkedOrgKpiId: true,
        linkedOrgKpi: {
          select: {
            id: true,
            kpiName: true,
            status: true,
            parentOrgKpiId: true,
            mboExceptionApproved: true,
            mboExceptionReason: true,
            mboExceptionApprovedById: true,
            mboExceptionApprovedAt: true,
            department: {
              select: {
                id: true,
                deptName: true,
                parentDeptId: true,
              },
            },
            teamKpiReviewItems: {
              orderBy: {
                createdAt: 'desc',
              },
              take: 1,
              select: {
                verdict: true,
              },
            },
          },
        },
      },
      orderBy: [{ employeeId: 'asc' }, { createdAt: 'asc' }],
    }),
    db.evaluation.findMany({
      where: {
        evalCycleId: cycle.id,
        evalStage: 'SELF',
      },
      select: {
        id: true,
        targetId: true,
        evalStage: true,
        items: {
          select: {
            id: true,
            personalKpiId: true,
            policyCategory: true,
            personalKpi: {
              select: {
                id: true,
                kpiName: true,
                policyCategory: true,
              },
            },
          },
        },
      },
      orderBy: [{ targetId: 'asc' }],
    }),
  ])

  const departmentsById = new Map(
    (departments as DepartmentNode2026[]).map((department) => [department.id, department])
  )
  const activeEmployeesById = new Map((activeEmployees as ActiveEmployee2026[]).map((employee) => [employee.id, employee]))
  const activeEmployeeIds = new Set(activeEmployeesById.keys())
  const typedPersonalKpis = (personalKpis as PersonalKpi2026[]).filter((kpi) => activeEmployeeIds.has(kpi.employeeId))
  const auditLogs = typedPersonalKpis.length && db.auditLog
    ? await db.auditLog.findMany({
        where: {
          entityType: 'PersonalKpi',
          entityId: {
            in: typedPersonalKpis.map((kpi) => kpi.id),
          },
        },
        orderBy: {
          timestamp: 'desc',
        },
        take: Math.max(200, typedPersonalKpis.length * 8),
      }) as PersonalKpiAuditLog2026[]
    : []
  const logsByKpiId = buildLogsByKpiId(auditLogs)
  const operationalStatusByKpiId: Map<string, PersonalKpiOperationalStatus> = new Map(
    typedPersonalKpis.map((kpi) => [kpi.id, toOperationalStatus2026(kpi, logsByKpiId)])
  )
  const confirmedPersonalKpis = typedPersonalKpis.filter(
    (kpi) => operationalStatusByKpiId.get(kpi.id) === 'CONFIRMED'
  )
  const kpisByEmployeeId = new Map<string, PersonalKpi2026[]>()

  for (const kpi of confirmedPersonalKpis) {
    const current = kpisByEmployeeId.get(kpi.employeeId) ?? []
    current.push(kpi)
    kpisByEmployeeId.set(kpi.employeeId, current)
  }

  const selfEvaluationByTargetId = new Map(
    (selfEvaluations as ExistingSelfEvaluation2026[]).map((evaluation) => [evaluation.targetId, evaluation])
  )

  const employeesWithConfirmedPersonalKpi: Evaluation2026ReadinessPopulationEmployeeSummary[] = []
  const employeesMissingConfirmedPersonalKpi: Evaluation2026ReadinessPopulationEmployeeSummary[] = []
  const wouldCreateSelfEvaluations: Evaluation2026ReadinessPopulationWouldCreateEvaluation[] = []
  const existingSelfEvaluationsSkipped: Evaluation2026ReadinessPopulationSkippedEvaluation[] = []
  let wouldCreateEvaluationItemCount = 0
  let existingEvaluationItemsSkippedCount = 0
  let policyCategoryMissingCount = 0

  for (const employee of activeEmployees as ActiveEmployee2026[]) {
    const confirmedKpis = kpisByEmployeeId.get(employee.id) ?? []
    const summary = makeEmployeeSummary({
      employee,
      confirmedPersonalKpiCount: confirmedKpis.length,
      departmentsById,
    })

    if (!confirmedKpis.length) {
      employeesMissingConfirmedPersonalKpi.push(summary)
      continue
    }

    employeesWithConfirmedPersonalKpi.push(summary)
    const existingSelfEvaluation = selfEvaluationByTargetId.get(employee.id)
    if (existingSelfEvaluation) {
      const missing = countMissingPolicyCategoriesForExistingItems(existingSelfEvaluation)
      existingEvaluationItemsSkippedCount += existingSelfEvaluation.items.length
      policyCategoryMissingCount += missing
      existingSelfEvaluationsSkipped.push({
        evaluationId: existingSelfEvaluation.id,
        employeeId: employee.id,
        employeeName: employee.empName,
        departmentName: summary.departmentName,
        confirmedPersonalKpiCount: confirmedKpis.length,
        existingItemCount: existingSelfEvaluation.items.length,
        missingPolicyCategoryCount: missing,
      })
      continue
    }

    const missing = countMissingPolicyCategoriesForKpis(confirmedKpis)
    policyCategoryMissingCount += missing
    wouldCreateEvaluationItemCount += confirmedKpis.length
    wouldCreateSelfEvaluations.push({
      employeeId: employee.id,
      employeeName: employee.empName,
      departmentName: summary.departmentName,
      confirmedPersonalKpiCount: confirmedKpis.length,
      wouldCreateItemCount: confirmedKpis.length,
      missingPolicyCategoryCount: missing,
      itemTitles: confirmedKpis.slice(0, 5).map((kpi) => kpi.kpiName),
    })
  }

  const mappings = readPolicy2026PreviewMappings(cycle.performanceDesignConfig)
  const activeEmployeeCountByDivisionId = new Map<string, number>()
  const confirmedEmployeeCountByDivisionId = new Map<string, number>()
  const affectedEmployeeCountByDepartmentId = new Map<string, number>()

  for (const employee of activeEmployees as ActiveEmployee2026[]) {
    const divisionId = resolveDivisionId({
      departmentId: employee.deptId,
      departmentsById,
    })
    if (divisionId) {
      activeEmployeeCountByDivisionId.set(divisionId, (activeEmployeeCountByDivisionId.get(divisionId) ?? 0) + 1)
      if (kpisByEmployeeId.has(employee.id)) {
        confirmedEmployeeCountByDivisionId.set(
          divisionId,
          (confirmedEmployeeCountByDivisionId.get(divisionId) ?? 0) + 1
        )
      }
    }

    for (const departmentId of resolveDepartmentOverridePath({
      departmentId: employee.deptId,
      departmentsById,
    })) {
      affectedEmployeeCountByDepartmentId.set(
        departmentId,
        (affectedEmployeeCountByDepartmentId.get(departmentId) ?? 0) + 1
      )
    }
  }

  const rootDivisions = (departments as DepartmentNode2026[])
    .filter((department) => !department.parentDeptId && (activeEmployeeCountByDivisionId.get(department.id) ?? 0) > 0)
    .sort((left, right) => left.deptName.localeCompare(right.deptName, 'ko'))
  const divisions = rootDivisions.map((division) => {
    const currentSalesGroup = mappings.salesGroupsByDivisionId[division.id]?.salesGroup ?? null
    return {
      divisionId: division.id,
      divisionName: division.deptName,
      activeEmployeeCount: activeEmployeeCountByDivisionId.get(division.id) ?? 0,
      draftPersonalKpiEmployeeCount: 0,
      submittedPersonalKpiEmployeeCount: 0,
      confirmedPersonalKpiEmployeeCount: confirmedEmployeeCountByDivisionId.get(division.id) ?? 0,
      missingAnyPersonalKpiEmployeeCount: activeEmployeeCountByDivisionId.get(division.id) ?? 0,
      currentSalesGroup,
    } satisfies Evaluation2026ReadinessPopulationDivisionCoverage
  })
  const mappedDivisions = divisions.filter((division) => division.currentSalesGroup).length
  const unmappedDivisions = divisions.length - mappedDivisions
  const mappedActiveEmployeeCount = divisions
    .filter((division) => division.currentSalesGroup)
    .reduce((sum, division) => sum + division.activeEmployeeCount, 0)
  const unmappedActiveEmployeeCount = divisions
    .filter((division) => !division.currentSalesGroup)
    .reduce((sum, division) => sum + division.activeEmployeeCount, 0)

  const overrides = Object.entries(mappings.salesGroupsByDepartmentId)
    .map(([departmentId, mapping]) => {
      const department = departmentsById.get(departmentId)
      return {
        departmentId,
        departmentName: department?.deptName ?? departmentId,
        departmentPath: formatDepartmentPath({ departmentId, departmentsById }),
        currentSalesGroup: mapping.salesGroup,
        affectedActiveEmployeeCount: affectedEmployeeCountByDepartmentId.get(departmentId) ?? 0,
      } satisfies Evaluation2026ReadinessPopulationDepartmentOverrideCoverage
    })
    .sort((left, right) => left.departmentPath.localeCompare(right.departmentPath, 'ko'))
  const mboSetupCoverage = buildMboSetupCoverage2026({
    activeEmployees: activeEmployees as ActiveEmployee2026[],
    personalKpis: typedPersonalKpis,
    departmentsById,
    operationalStatusByKpiId,
  })
  const divisionCoverageById = new Map(
    mboSetupCoverage.divisionCoverage.map((division) => [division.divisionId, division])
  )

  const blockers: Evaluation2026ReadinessPopulationBlocker[] = []
  const warnings: Evaluation2026ReadinessPopulationBlocker[] = []
  const isOfficialReadinessTarget = readPolicy2026OfficialReadinessEnabled(cycle.performanceDesignConfig)

  addBlocker({
    target: blockers,
    code: 'OFFICIAL_READINESS_CYCLE_NOT_CONFIRMED',
    message: '선택한 평가 주기가 공식 2026 readiness 대상으로 지정되어 있지 않습니다.',
    count: isOfficialReadinessTarget ? 0 : 1,
  })
  addBlocker({
    target: blockers,
    code: 'CONFIRMED_PERSONAL_KPI_REQUIRED',
    message: '확정된 2026 Personal KPI가 없는 재직자가 있어 population apply를 안전하게 진행할 수 없습니다.',
    count: employeesMissingConfirmedPersonalKpi.length,
  })
  addBlocker({
    target: blockers,
    code: 'POLICY_CATEGORY_REQUIRED',
    message: '생성되거나 유지될 평가 항목에 2026 policyCategory가 비어 있습니다.',
    count: policyCategoryMissingCount,
  })
  addBlocker({
    target: blockers,
    code: 'DIVISION_SALES_GROUP_REQUIRED',
    message: '전체 조직 master 기준 division SALES/NON_SALES 매핑이 비어 있습니다.',
    count: unmappedDivisions,
  })
  addBlocker({
    target: blockers,
    code: 'NO_CONFIRMED_PERSONAL_KPI',
    message: '현재 주기 연도에 확정된 Personal KPI가 없어 생성할 평가 항목이 없습니다.',
    count: employeesWithConfirmedPersonalKpi.length === 0 ? 1 : 0,
  })

  if (selfEvaluationByTargetId.size > 0 && selfEvaluationByTargetId.size < Math.max(3, activeEmployees.length * 0.1)) {
    addBlocker({
      target: warnings,
      code: 'CURRENT_CYCLE_SCOPE_LOOKS_PARTIAL',
      message: '현재 주기의 SELF 평가가 일부 대상자에만 존재합니다. 테스트/샘플 주기인지 HR 확인이 필요합니다.',
      count: selfEvaluationByTargetId.size,
    })
  }

  const possibleSampleTargets = (activeEmployees as ActiveEmployee2026[])
    .filter((employee) => selfEvaluationByTargetId.has(employee.id))
    .map((employee) => employee.empName)
    .filter(hasText)
  if (possibleSampleTargets.some((name) => name.includes('석재원'))) {
    addBlocker({
      target: warnings,
      code: 'SAMPLE_DATA_SIGNAL',
      message: '기존 SELF 평가 대상에 석재원 테스트/샘플 데이터 신호가 있습니다. 공식 readiness 판단 전에 주기 범위를 확인해 주세요.',
      count: 1,
    })
  }

  const flags = get2026EvaluationFeatureFlags(params.env)

  return {
    policyVersion: EVALUATION_POLICY_2026.version,
    generatedAt: new Date().toISOString(),
    isDryRun: true,
    selectedEvalCycle: {
      id: cycle.id,
      name: cycle.cycleName,
      year: cycle.evalYear,
      status: cycle.status,
      isOfficialReadinessTarget,
    },
    activeEmployeeCount: activeEmployees.length,
    employeesWithConfirmedPersonalKpiCount: employeesWithConfirmedPersonalKpi.length,
    employeesWithConfirmedPersonalKpi: employeesWithConfirmedPersonalKpi.slice(0, limit),
    employeesMissingConfirmedPersonalKpiCount: employeesMissingConfirmedPersonalKpi.length,
    employeesMissingConfirmedPersonalKpi: employeesMissingConfirmedPersonalKpi.slice(0, limit),
    existingSelfEvaluationCount: selfEvaluationByTargetId.size,
    existingSelfEvaluationsSkipped: existingSelfEvaluationsSkipped.slice(0, limit),
    wouldCreateSelfEvaluationCount: wouldCreateSelfEvaluations.length,
    wouldCreateSelfEvaluations: wouldCreateSelfEvaluations.slice(0, limit),
    wouldCreateEvaluationItemCount,
    existingEvaluationItemsSkippedCount,
    policyCategoryMissingCount,
    mboSetupCoverage: {
      ...mboSetupCoverage,
      divisionCoverage: mboSetupCoverage.divisionCoverage.map((division) => ({
        ...division,
        currentSalesGroup: mappings.salesGroupsByDivisionId[division.divisionId]?.salesGroup ?? null,
      })),
      teamCoverage: mboSetupCoverage.teamCoverage.slice(0, limit),
    },
    divisionSalesMappingCoverage: {
      totalDivisions: divisions.length,
      mappedDivisions,
      unmappedDivisions,
      mappedActiveEmployeeCount,
      unmappedActiveEmployeeCount,
      divisions: divisions.map((division) => {
        const coverage = divisionCoverageById.get(division.divisionId)
        return {
          ...division,
          draftPersonalKpiEmployeeCount: coverage?.draftPersonalKpiEmployeeCount ?? 0,
          submittedPersonalKpiEmployeeCount: coverage?.submittedPersonalKpiEmployeeCount ?? 0,
          missingAnyPersonalKpiEmployeeCount: coverage?.missingAnyPersonalKpiEmployeeCount ?? division.activeEmployeeCount,
        }
      }),
    },
    departmentOverrideCoverage: {
      savedOverrideCount: overrides.length,
      affectedActiveEmployeeCount: overrides.reduce((sum, override) => sum + override.affectedActiveEmployeeCount, 0),
      overrides,
    },
    blockers,
    warnings,
    safety: {
      writesPerformed: false,
      evaluationsCreated: 0,
      evaluationItemsCreated: 0,
      assignmentsMutated: 0,
      totalScoreChanged: false,
      gradeIdChanged: false,
      officialScoringEnabled: flags.officialScoringEnabled,
      officialGradeEnabled: flags.officialGradeEnabled,
      officialAiScoreExclusionEnabled: flags.aiScoreExclusionEnabled,
    },
  }
}

export async function getEvaluation2026ReadinessPopulationDryRunForSession(
  params: {
    session: Session
    evalCycleId: string
    limit?: number
  },
  options: {
    db?: Evaluation2026ReadinessPopulationDb
    env?: NodeJS.ProcessEnv
  } = {}
) {
  const sessionUser = params.session.user as { id?: string } | undefined
  if (!sessionUser?.id) {
    throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
  }

  if (!canAccessEvaluationPreview2026(params.session)) {
    throw new AppError(403, 'FORBIDDEN', '2026 readiness population dry-run은 HR 관리자만 사용할 수 있습니다.')
  }

  return getEvaluation2026ReadinessPopulationDryRun({
    db: options.db,
    evalCycleId: params.evalCycleId,
    limit: params.limit,
    env: options.env,
  })
}
