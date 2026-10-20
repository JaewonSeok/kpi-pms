import type {
  EmployeeStatus,
  EvalStage,
  EvaluationAssignmentSource,
  Position,
  SystemRole,
} from '@prisma/client'
import { EVALUATION_ROLE_ORDER, resolveEvaluationRole } from '@/lib/evaluation-leader-role'
import { selectEvaluationTargets } from '@/lib/evaluation-targets'
import { prisma } from '@/lib/prisma'
import { POSITION_LABELS } from '@/lib/utils'
import { buildAssignments } from '@/server/admin/employeeHierarchy'

export type Evaluation2026EvaluatorRoutingStatus =
  | 'READY'
  | 'MISSING_FIRST'
  | 'MISSING_SECOND'
  | 'MISSING_FINAL'
  | 'ORG_AMBIGUOUS'
  | 'MANAGER_MISSING'
  | 'EVALUATOR_INACTIVE'
  | 'MANUAL_REVIEW'
  | 'STAGE_SKIPPED'

export type Evaluation2026EvaluatorMissingType = 'FIRST' | 'SECOND' | 'FINAL'

export type Evaluation2026EvaluatorRoutingDepartmentInput = {
  id: string
  deptName: string
  parentDeptId: string | null
  leaderEmployeeId: string | null
  excludeLeaderFromEvaluatorAutoAssign: boolean
}

export type Evaluation2026EvaluatorRoutingEmployeeInput = {
  id: string
  empId: string
  empName: string
  gwsEmail: string
  deptId: string
  role: SystemRole
  position: Position
  status: EmployeeStatus
  managerId: string | null
  teamLeaderId: string | null
  sectionChiefId: string | null
  divisionHeadId: string | null
  joinDate: Date
  createdAt: Date
  // buildAssignments() 의 ROLE_ADMIN 분류에 쓰인다(#286). 로더가 select 를
  // 빠뜨리면 ROLE_ADMIN 리더가 조용히 사라진다. buildAssignments 입력을 만드는
  // 로더 전수: employeeHierarchy.ts loadHierarchyBaseData·previewEmployeeLeadershipLinks,
  // evaluation-performance-assignments.ts loadHierarchyInputs, 이 파일의
  // getEvaluation2026EvaluatorRoutingReadiness.
  jobTitle?: string | null
}

export type Evaluation2026EvaluatorRoutingAssignmentInput = {
  targetId: string
  evalStage: EvalStage
  evaluatorId: string
  assignmentSource: EvaluationAssignmentSource
  evaluator: {
    id: string
    empId: string
    empName: string
    gwsEmail: string
    deptId: string
    role: SystemRole
    position: Position
    status: EmployeeStatus
  }
}

export type Evaluation2026EvaluatorRoutingCurrentAssignment = {
  stage: EvalStage
  stageLabel: string
  evaluatorId: string
  evaluatorName: string
  evaluatorEmployeeNo: string
  evaluatorStatus: EmployeeStatus
  assignmentSource: EvaluationAssignmentSource
}

export type Evaluation2026EvaluatorRoutingRow = {
  employeeId: string
  employeeNo: string
  name: string
  email: string
  role: SystemRole
  roleLabel: string
  positionLabel: string
  departmentPath: string
  division: string | null
  section: string | null
  team: string | null
  managerId: string | null
  managerName: string | null
  expectedFirstEvaluator: string | null
  expectedSecondEvaluator: string | null
  expectedFinalApprover: string | null
  expectedCeoApprover: string | null
  suggestedEvaluator: string | null
  currentAssignments: Evaluation2026EvaluatorRoutingCurrentAssignment[]
  currentAssignmentExists: boolean
  missingEvaluatorTypes: Evaluation2026EvaluatorMissingType[]
  // 조직에 그 계층이 없어(chain 슬롯 null · 저장 배정 없음) 건너뛴 단계다. blocker 가 아니다.
  skippedEvaluatorTypes: Evaluation2026EvaluatorMissingType[]
  warnings: string[]
  status: Evaluation2026EvaluatorRoutingStatus
}

export type Evaluation2026EvaluatorRoutingReadinessSummary = {
  activeEmployeeCount: number
  completeEvaluatorChainCount: number
  missingFirstEvaluatorCount: number
  missingSecondEvaluatorCount: number
  missingFinalApproverCount: number
  managerEmployeeNoMissingCount: number
  orgAmbiguousCount: number
  teamsWithoutLeaderCount: number
  leadersWithoutEvaluatableTeamMembersCount: number
  duplicateEvaluatorWarningCount: number
  selfEvaluatorWarningCount: number
  inactiveEvaluatorWarningCount: number
  orgPathMissingInvalidCount: number
  manualReviewCount: number
  stageSkippedCount: number
  skippedFirstCount: number
  skippedSecondCount: number
  blockerCount: number
}

export type Evaluation2026EvaluatorRoutingReadinessResult = {
  policyYear: 2026
  checkedAt: string
  evalCycleId: string | null
  readOnly: true
  summary: Evaluation2026EvaluatorRoutingReadinessSummary
  rows: Evaluation2026EvaluatorRoutingRow[]
  safety: {
    writesPerformed: false
    evaluationsCreated: 0
    evaluationItemsCreated: 0
    totalScoreChanged: false
    gradeIdChanged: false
    officialScoringEnabled: false
    officialGradeEnabled: false
    officialAiScoreExclusionEnabled: false
  }
}

type EvaluatorRoutingDb = Pick<typeof prisma, 'department' | 'employee' | 'evaluationAssignment'> &
  Partial<Pick<typeof prisma, 'evalCycle'>>

const ASSIGNABLE_ROUTING_STAGES: EvalStage[] = ['FIRST', 'SECOND', 'FINAL', 'CEO_ADJUST']

const STAGE_LABELS: Record<EvalStage, string> = {
  SELF: '자기평가',
  FIRST: '1차 평가',
  SECOND: '2차 평가',
  FINAL: '최종 평가',
  CEO_ADJUST: 'CEO 확인',
}

const ROLE_LABELS: Record<SystemRole, string> = {
  ROLE_MEMBER: '팀원',
  ROLE_TEAM_LEADER: '팀장',
  ROLE_SECTION_CHIEF: '실장/섹션장',
  ROLE_DIV_HEAD: '본부장',
  ROLE_CEO: 'CEO',
  ROLE_ADMIN: '관리자',
}

function assignmentKey(params: { targetId: string; evalStage: EvalStage }) {
  return `${params.targetId}:${params.evalStage}`
}

// 평가 역할 판정은 전부 resolveEvaluationRole 을 거친다. ROLE_ADMIN 은 권한 플래그라
// 평가 역할이 jobTitle 에 있다. 권한·표시(role·roleLabel)와 ceoId 조회만 원래 role 을 본다.
function requiredMissingTypesForRole(employee: { role: SystemRole; jobTitle?: string | null }) {
  const role = resolveEvaluationRole(employee)
  if (role === 'ROLE_CEO') return [] satisfies Evaluation2026EvaluatorMissingType[]
  if (role === 'ROLE_DIV_HEAD') return ['FINAL'] satisfies Evaluation2026EvaluatorMissingType[]

  const required: Evaluation2026EvaluatorMissingType[] = []
  if (EVALUATION_ROLE_ORDER[role] < EVALUATION_ROLE_ORDER.ROLE_TEAM_LEADER) required.push('FIRST')
  if (EVALUATION_ROLE_ORDER[role] < EVALUATION_ROLE_ORDER.ROLE_SECTION_CHIEF) required.push('SECOND')
  if (EVALUATION_ROLE_ORDER[role] < EVALUATION_ROLE_ORDER.ROLE_DIV_HEAD) required.push('FINAL')
  return required
}

function buildDepartmentPath(
  deptId: string,
  departmentById: Map<string, Evaluation2026EvaluatorRoutingDepartmentInput>
) {
  const path: Evaluation2026EvaluatorRoutingDepartmentInput[] = []
  const visited = new Set<string>()
  let currentId: string | null | undefined = deptId

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId)
    const department = departmentById.get(currentId)
    if (!department) break
    path.unshift(department)
    currentId = department.parentDeptId
  }

  const names = path.map((item) => item.deptName)
  return {
    path,
    pathLabel: names.join(' > ') || '-',
    division: names[0] ?? null,
    section: names.length >= 3 ? names[1] ?? null : null,
    team: names.length >= 2 ? names[names.length - 1] ?? null : null,
    invalid: path.length === 0 || Boolean(currentId),
  }
}

function resolveEffectiveEvaluatorId(params: {
  stage: EvalStage
  targetId: string
  defaultId: string | null
  persistedByKey: Map<string, Evaluation2026EvaluatorRoutingAssignmentInput>
}) {
  const persisted = params.persistedByKey.get(assignmentKey({
    targetId: params.targetId,
    evalStage: params.stage,
  }))

  if (persisted?.evaluator.status === 'ACTIVE') {
    return persisted.evaluatorId
  }

  return params.defaultId
}

function getRowStatus(params: {
  missingTypes: Evaluation2026EvaluatorMissingType[]
  orgAmbiguous: boolean
  managerMissing: boolean
  inactiveEvaluator: boolean
  manualReview: boolean
  skippedTypes: Evaluation2026EvaluatorMissingType[]
}): Evaluation2026EvaluatorRoutingStatus {
  if (params.missingTypes.includes('FIRST')) return 'MISSING_FIRST'
  if (params.missingTypes.includes('SECOND')) return 'MISSING_SECOND'
  if (params.missingTypes.includes('FINAL')) return 'MISSING_FINAL'
  if (params.orgAmbiguous) return 'ORG_AMBIGUOUS'
  if (params.managerMissing) return 'MANAGER_MISSING'
  if (params.inactiveEvaluator) return 'EVALUATOR_INACTIVE'
  if (params.manualReview) return 'MANUAL_REVIEW'
  // 건너뛴 단계만 남은 행이다. 다른 문제가 하나라도 있으면 그 상태가 먼저다 — 건너뜀이 문제를 가리지 않게 한다.
  if (params.skippedTypes.length) return 'STAGE_SKIPPED'
  return 'READY'
}

function evaluatorName(
  employeeId: string | null | undefined,
  employeeById: Map<string, Evaluation2026EvaluatorRoutingEmployeeInput>
) {
  if (!employeeId) return null
  const employee = employeeById.get(employeeId)
  return employee ? `${employee.empName} (${employee.empId})` : null
}

export function buildEvaluation2026EvaluatorRoutingReadinessFromInputs(params: {
  evalCycleId?: string | null
  departments: Evaluation2026EvaluatorRoutingDepartmentInput[]
  employees: Evaluation2026EvaluatorRoutingEmployeeInput[]
  assignments?: Evaluation2026EvaluatorRoutingAssignmentInput[]
  // 사이클 조직의 부서 id. 없으면 조직으로 거르지 않는다.
  orgDepartmentIds?: ReadonlySet<string> | null
  checkedAt?: Date
}): Evaluation2026EvaluatorRoutingReadinessResult {
  const activeEmployees = params.employees.filter((employee) => employee.status === 'ACTIVE')
  // 평가 대상의 정의는 자기평가 일괄 생성과 같은 함수 하나다.
  const targetEmployees = selectEvaluationTargets(params.employees, { orgDepartmentIds: params.orgDepartmentIds ?? null })
  const employeeById = new Map(activeEmployees.map((employee) => [employee.id, employee]))
  const departmentById = new Map(params.departments.map((department) => [department.id, department]))
  const persistedByKey = new Map(
    (params.assignments ?? []).map((assignment) => [assignmentKey(assignment), assignment])
  )
  const assignmentMap = buildAssignments(params.departments, activeEmployees)
  const ceoId = activeEmployees.find((employee) => employee.role === 'ROLE_CEO')?.id ?? null

  const usedEvaluatorIds = new Set<string>()
  const rows = targetEmployees.map((employee) => {
    const chain = assignmentMap.get(employee.id)
    const requiredMissingTypes = requiredMissingTypesForRole(employee)
    const firstId = resolveEffectiveEvaluatorId({
      stage: 'FIRST',
      targetId: employee.id,
      defaultId: chain?.teamLeaderId ?? null,
      persistedByKey,
    })
    const secondId = resolveEffectiveEvaluatorId({
      stage: 'SECOND',
      targetId: employee.id,
      defaultId: chain?.sectionChiefId ?? null,
      persistedByKey,
    })
    const finalId = resolveEffectiveEvaluatorId({
      stage: 'FINAL',
      targetId: employee.id,
      defaultId: chain?.divisionHeadId ?? null,
      persistedByKey,
    })
    const ceoApproverId = resolveEffectiveEvaluatorId({
      stage: 'CEO_ADJUST',
      targetId: employee.id,
      defaultId: ceoId,
      persistedByKey,
    })

    const firstEvaluator = firstId ? employeeById.get(firstId) ?? null : null
    const secondEvaluator = secondId ? employeeById.get(secondId) ?? null : null
    const finalEvaluator = finalId ? employeeById.get(finalId) ?? null : null
    const ceoApprover = ceoApproverId ? employeeById.get(ceoApproverId) ?? null : null
    // ROLE_ADMIN 은 권한 플래그다. 평가 역할은 jobTitle 에 있다.
    // #322 가 로더에 jobTitle 을 넣고 #326 이 필수로 만든 값이다.
    const firstRole = firstEvaluator ? resolveEvaluationRole(firstEvaluator) : null
    const secondRole = secondEvaluator ? resolveEvaluationRole(secondEvaluator) : null
    const finalRole = finalEvaluator ? resolveEvaluationRole(finalEvaluator) : null
    const validByMissingType: Record<Evaluation2026EvaluatorMissingType, boolean> = {
      FIRST: firstRole === 'ROLE_TEAM_LEADER',
      SECOND: secondRole === 'ROLE_SECTION_CHIEF' || secondRole === 'ROLE_DIV_HEAD',
      FINAL:
        finalRole === 'ROLE_DIV_HEAD' ||
        finalRole === 'ROLE_CEO' ||
        (resolveEvaluationRole(employee) === 'ROLE_DIV_HEAD' &&
          Boolean(ceoApprover) &&
          resolveEvaluationRole(ceoApprover as Evaluation2026EvaluatorRoutingEmployeeInput) === 'ROLE_CEO'),
    }
    // 조직에 그 계층이 없으면 blocker 가 아니다. 실장·부문장은 전사 7명이고
    // 겸직 팀장은 #324 로 자기 역할 슬롯에 간다. 사람이 없는 자리를 세지 않는다.
    // 판정은 평가자를 정하는 근거와 같은 chain 으로 한다. 저장된 배정이 있으면
    // 조직 상태가 아니라 배정 실수이므로 건너뛰지 않는다. FINAL 은 #323 의 대표 폴백이 채운다.
    const isStageSkipped = (stage: Evaluation2026EvaluatorMissingType) => {
      if (persistedByKey.has(assignmentKey({ targetId: employee.id, evalStage: stage }))) return false
      if (stage === 'FIRST') return !chain?.teamLeaderId
      if (stage === 'SECOND') return !chain?.sectionChiefId
      return false
    }
    const invalidRequiredTypes = requiredMissingTypes.filter((stage) => !validByMissingType[stage])
    const skippedEvaluatorTypes = invalidRequiredTypes.filter((stage) => isStageSkipped(stage))
    const missingEvaluatorTypes = invalidRequiredTypes.filter((stage) => !isStageSkipped(stage))
    const currentAssignments = ASSIGNABLE_ROUTING_STAGES
      .map((stage) =>
        persistedByKey.get(assignmentKey({
          targetId: employee.id,
          evalStage: stage,
        }))
      )
      .filter((assignment): assignment is Evaluation2026EvaluatorRoutingAssignmentInput => Boolean(assignment))
      .map((assignment) => ({
        stage: assignment.evalStage,
        stageLabel: STAGE_LABELS[assignment.evalStage],
        evaluatorId: assignment.evaluatorId,
        evaluatorName: assignment.evaluator.empName,
        evaluatorEmployeeNo: assignment.evaluator.empId,
        evaluatorStatus: assignment.evaluator.status,
        assignmentSource: assignment.assignmentSource,
      }))

    const path = buildDepartmentPath(employee.deptId, departmentById)
    const managerName = evaluatorName(employee.managerId, employeeById)
    // 직책이 리더가 아닌 ROLE_ADMIN 도 평가에서는 팀원이다. 매니저·조직 경로 검사를 같이 받는다.
    const isEvaluationMember = resolveEvaluationRole(employee) === 'ROLE_MEMBER'
    const managerMissing = isEvaluationMember && !employee.managerId
    const orgAmbiguous = isEvaluationMember && path.path.length < 2
    const inactiveEvaluator = currentAssignments.some((assignment) => assignment.evaluatorStatus !== 'ACTIVE')
    const effectiveEvaluatorIds = [firstId, secondId, finalId, ceoApproverId].filter((value): value is string => Boolean(value))
    for (const evaluatorId of effectiveEvaluatorIds) usedEvaluatorIds.add(evaluatorId)
    // FINAL 과 CEO_ADJUST 가 같은 것은 정상이다. 본부장의 FINAL 은 대표이고
    // CEO_ADJUST 도 대표다(#323 전사 폴백). 구조적으로 피할 수 없다.
    // 배정 가능한 3단계(FIRST·SECOND·FINAL)는 서로 중복을 본다. CEO_ADJUST 는 FINAL 과 같을 때만 예외다.
    const stagedEvaluatorIds = [firstId, secondId, finalId].filter((value): value is string => Boolean(value))
    const ceoApproverDuplicatesNonFinal =
      Boolean(ceoApproverId) && ceoApproverId !== finalId && (ceoApproverId === firstId || ceoApproverId === secondId)
    const duplicateEvaluator =
      new Set(stagedEvaluatorIds).size < stagedEvaluatorIds.length || ceoApproverDuplicatesNonFinal
    const selfEvaluator = effectiveEvaluatorIds.includes(employee.id)
    const orgPathMissing = path.invalid
    const manualReview = duplicateEvaluator || selfEvaluator || orgPathMissing
    const warnings = [
      managerMissing ? 'managerEmployeeNo/managerId가 비어 있습니다.' : null,
      orgAmbiguous ? 'division/section 직접 배정으로 team 경로 확인이 필요합니다.' : null,
      inactiveEvaluator ? '현재 배정된 평가자 중 비활성 계정이 있습니다.' : null,
      duplicateEvaluator ? '동일 평가자가 여러 단계에 중복 배정되어 있습니다.' : null,
      selfEvaluator ? '자기 자신이 상위 평가자로 배정되어 있습니다.' : null,
      orgPathMissing ? '조직 경로가 누락되었거나 유효하지 않습니다.' : null,
    ].filter((warning): warning is string => Boolean(warning))

    return {
      employeeId: employee.id,
      employeeNo: employee.empId,
      name: employee.empName,
      email: employee.gwsEmail,
      role: employee.role,
      roleLabel: ROLE_LABELS[employee.role] ?? employee.role,
      positionLabel: POSITION_LABELS[employee.position] ?? employee.position,
      departmentPath: path.pathLabel,
      division: path.division,
      section: path.section,
      team: path.team,
      managerId: employee.managerId,
      managerName,
      expectedFirstEvaluator: evaluatorName(firstId, employeeById),
      expectedSecondEvaluator: evaluatorName(secondId, employeeById),
      expectedFinalApprover: evaluatorName(finalId, employeeById),
      expectedCeoApprover: evaluatorName(ceoApproverId, employeeById),
      suggestedEvaluator:
        missingEvaluatorTypes.includes('FIRST')
          ? '팀 leader 확인 필요'
          : missingEvaluatorTypes.includes('SECOND')
            ? 'section head 또는 division head 확인 필요'
            : missingEvaluatorTypes.includes('FINAL')
              ? 'division head 또는 CEO/final approver 확인 필요'
              : null,
      currentAssignments,
      currentAssignmentExists: currentAssignments.length > 0,
      missingEvaluatorTypes,
      skippedEvaluatorTypes,
      warnings,
      status: getRowStatus({
        missingTypes: missingEvaluatorTypes,
        orgAmbiguous,
        managerMissing,
        inactiveEvaluator,
        manualReview,
        skippedTypes: skippedEvaluatorTypes,
      }),
    } satisfies Evaluation2026EvaluatorRoutingRow
  }).sort((left, right) => {
    if (left.departmentPath !== right.departmentPath) {
      return left.departmentPath.localeCompare(right.departmentPath, 'ko')
    }
    return left.name.localeCompare(right.name, 'ko')
  })

  // 조직 지표다. 팀장이 없어 건너뛴 팀도 "팀장 없는 팀"이다.
  const teamsWithoutLeader = new Set(
    rows
      .filter((row) => row.missingEvaluatorTypes.includes('FIRST') || row.skippedEvaluatorTypes.includes('FIRST'))
      .map((row) => row.team ?? row.departmentPath)
  )
  const leadersWithoutEvaluatableTeamMembers = activeEmployees
    .filter((employee) => {
      const evaluationRole = resolveEvaluationRole(employee)
      return evaluationRole !== 'ROLE_MEMBER' && evaluationRole !== 'ROLE_CEO'
    })
    .filter((employee) => !usedEvaluatorIds.has(employee.id))

  const summary: Evaluation2026EvaluatorRoutingReadinessSummary = {
    activeEmployeeCount: targetEmployees.length,
    // 건너뛴 단계만 남은 행도 평가자 체인이 완성된 것이다.
    completeEvaluatorChainCount: rows.filter((row) => row.status === 'READY' || row.status === 'STAGE_SKIPPED').length,
    missingFirstEvaluatorCount: rows.filter((row) => row.missingEvaluatorTypes.includes('FIRST')).length,
    missingSecondEvaluatorCount: rows.filter((row) => row.missingEvaluatorTypes.includes('SECOND')).length,
    missingFinalApproverCount: rows.filter((row) => row.missingEvaluatorTypes.includes('FINAL')).length,
    managerEmployeeNoMissingCount: rows.filter((row) => row.status === 'MANAGER_MISSING' || row.warnings.some((warning) => warning.includes('manager'))).length,
    orgAmbiguousCount: rows.filter((row) => row.status === 'ORG_AMBIGUOUS').length,
    teamsWithoutLeaderCount: teamsWithoutLeader.size,
    leadersWithoutEvaluatableTeamMembersCount: leadersWithoutEvaluatableTeamMembers.length,
    duplicateEvaluatorWarningCount: rows.filter((row) => row.warnings.some((warning) => warning.includes('중복'))).length,
    selfEvaluatorWarningCount: rows.filter((row) => row.warnings.some((warning) => warning.includes('자기 자신'))).length,
    inactiveEvaluatorWarningCount: rows.filter((row) => row.warnings.some((warning) => warning.includes('비활성'))).length,
    orgPathMissingInvalidCount: rows.filter((row) => row.warnings.some((warning) => warning.includes('조직 경로'))).length,
    // manual review 는 MANUAL_REVIEW 상태만이다. MISSING_* 까지 세면 blockerCount 와 같은 값이 된다.
    manualReviewCount: rows.filter((row) => row.status === 'MANUAL_REVIEW').length,
    stageSkippedCount: rows.filter((row) => row.status === 'STAGE_SKIPPED').length,
    skippedFirstCount: rows.filter((row) => row.skippedEvaluatorTypes.includes('FIRST')).length,
    skippedSecondCount: rows.filter((row) => row.skippedEvaluatorTypes.includes('SECOND')).length,
    // STAGE_SKIPPED 는 조직에 그 계층이 없는 것이라 blocker 가 아니다.
    blockerCount: rows.filter((row) => row.status !== 'READY' && row.status !== 'STAGE_SKIPPED').length,
  }

  return {
    policyYear: 2026,
    checkedAt: (params.checkedAt ?? new Date()).toISOString(),
    evalCycleId: params.evalCycleId ?? null,
    readOnly: true,
    summary,
    rows,
    safety: {
      writesPerformed: false,
      evaluationsCreated: 0,
      evaluationItemsCreated: 0,
      totalScoreChanged: false,
      gradeIdChanged: false,
      officialScoringEnabled: false,
      officialGradeEnabled: false,
      officialAiScoreExclusionEnabled: false,
    },
  }
}

export async function getEvaluation2026EvaluatorRoutingReadiness(params: {
  db?: EvaluatorRoutingDb
  evalCycleId?: string | null
} = {}) {
  const db = params.db ?? prisma
  const [departments, employees, assignments, cycle] = await Promise.all([
    db.department.findMany({
      select: {
        id: true,
        deptName: true,
        parentDeptId: true,
        leaderEmployeeId: true,
        excludeLeaderFromEvaluatorAutoAssign: true,
        orgId: true,
      },
    }),
    db.employee.findMany({
      select: {
        id: true,
        empId: true,
        empName: true,
        gwsEmail: true,
        deptId: true,
        role: true,
        position: true,
        status: true,
        managerId: true,
        teamLeaderId: true,
        sectionChiefId: true,
        divisionHeadId: true,
        joinDate: true,
        createdAt: true,
        jobTitle: true,
      },
      orderBy: [{ joinDate: 'asc' }, { createdAt: 'asc' }],
    }),
    params.evalCycleId
      ? db.evaluationAssignment.findMany({
          where: {
            evalCycleId: params.evalCycleId,
          },
          select: {
            targetId: true,
            evalStage: true,
            evaluatorId: true,
            assignmentSource: true,
            evaluator: {
              select: {
                id: true,
                empId: true,
                empName: true,
                gwsEmail: true,
                deptId: true,
                role: true,
                position: true,
                status: true,
              },
            },
          },
        })
      : Promise.resolve([]),
    params.evalCycleId && db.evalCycle
      ? db.evalCycle.findUnique({ where: { id: params.evalCycleId }, select: { orgId: true } })
      : Promise.resolve(null),
  ])

  // 사이클을 알면 그 조직의 부서만 평가 대상 범위로 본다.
  const orgDepartmentIds = cycle
    ? new Set(departments.filter((department) => department.orgId === cycle.orgId).map((department) => department.id))
    : null

  return buildEvaluation2026EvaluatorRoutingReadinessFromInputs({
    evalCycleId: params.evalCycleId ?? null,
    departments,
    employees,
    assignments,
    orgDepartmentIds,
  })
}
