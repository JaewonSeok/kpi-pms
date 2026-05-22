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

type ConfirmedPersonalKpi2026 = {
  id: string
  employeeId: string
  kpiName: string
  policyCategory: EvaluationPolicyItemCategoryCode | null
  weight?: number | null
  linkedOrgKpi?: {
    id: string
    kpiName: string
    department?: {
      deptName?: string | null
    } | null
  } | null
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
  confirmedPersonalKpiEmployeeCount: number
  currentSalesGroup: EvaluationPolicy2026SalesGroup | null
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

function countMissingPolicyCategoriesForKpis(kpis: ConfirmedPersonalKpi2026[]) {
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

  const [departments, activeEmployees, confirmedPersonalKpis, selfEvaluations] = await Promise.all([
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
        status: 'CONFIRMED',
      },
      select: {
        id: true,
        employeeId: true,
        kpiName: true,
        policyCategory: true,
        weight: true,
        linkedOrgKpi: {
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
  const kpisByEmployeeId = new Map<string, ConfirmedPersonalKpi2026[]>()

  for (const kpi of confirmedPersonalKpis as ConfirmedPersonalKpi2026[]) {
    if (!activeEmployeeIds.has(kpi.employeeId)) continue
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
      confirmedPersonalKpiEmployeeCount: confirmedEmployeeCountByDivisionId.get(division.id) ?? 0,
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
    divisionSalesMappingCoverage: {
      totalDivisions: divisions.length,
      mappedDivisions,
      unmappedDivisions,
      mappedActiveEmployeeCount,
      unmappedActiveEmployeeCount,
      divisions,
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
