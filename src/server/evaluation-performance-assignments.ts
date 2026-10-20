import {
  EvaluationAssignmentSource,
  EvalStage,
  EvalStatus,
  type Position,
  type Prisma,
  type PrismaClient,
  type SystemRole,
} from '@prisma/client'
import { EVAL_STAGE_LABELS, POSITION_LABELS, AppError } from '@/lib/utils'
import { resolveEmployeePositionLabel } from '@/lib/employee-position-label'
import { prisma } from '@/lib/prisma'
import { buildAssignments } from '@/server/admin/employeeHierarchy'
import {
  getEvaluation2026EvaluatorRoutingReadiness,
  type Evaluation2026EvaluatorRoutingReadinessResult,
} from '@/server/evaluation-2026-evaluator-routing-readiness'

const PERFORMANCE_ASSIGNABLE_STAGES: EvalStage[] = ['FIRST', 'SECOND', 'FINAL', 'CEO_ADJUST']
const EVALUATION_STAGE_ORDER: EvalStage[] = ['SELF', 'FIRST', 'SECOND', 'FINAL', 'CEO_ADJUST']
type AssignableEvalStage = Exclude<EvalStage, 'SELF'>
const STAGE_STATUS_LABELS: Record<EvalStatus, string> = {
  PENDING: '대기',
  IN_PROGRESS: '작성 중',
  SUBMITTED: '제출됨',
  REJECTED: '반려',
  CONFIRMED: '확정',
}

const STAGE_ALLOWED_ROLES: Record<EvalStage, SystemRole[]> = {
  SELF: ['ROLE_MEMBER', 'ROLE_TEAM_LEADER', 'ROLE_SECTION_CHIEF', 'ROLE_DIV_HEAD', 'ROLE_CEO', 'ROLE_ADMIN'],
  FIRST: ['ROLE_TEAM_LEADER', 'ROLE_SECTION_CHIEF', 'ROLE_DIV_HEAD', 'ROLE_CEO'],
  SECOND: ['ROLE_SECTION_CHIEF', 'ROLE_DIV_HEAD', 'ROLE_CEO'],
  FINAL: ['ROLE_DIV_HEAD', 'ROLE_CEO'],
  CEO_ADJUST: ['ROLE_CEO'],
}

type AssignmentChain = {
  teamLeaderId: string | null
  sectionChiefId: string | null
  divisionHeadId: string | null
}

type AssignmentHierarchyEmployee = {
  id: string
  empId: string
  empName: string
  deptId: string
  role: SystemRole
  status: 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE' | 'RESIGNED'
  joinDate: Date
  createdAt: Date
  teamLeaderId: string | null
  sectionChiefId: string | null
  divisionHeadId: string | null
  jobTitle?: string | null
}

type AssignmentDbClient = PrismaClient | Prisma.TransactionClient

type StageAssigneeProfile = {
  id: string
  empName: string
  role: SystemRole
  position: Position
  departmentName: string
  jobTitle: string | null
}

// 평가자는 이 프로필에서 정하지 않는다. employees 슬롯(teamLeaderId 등)은 재계산 시점의
// 사본이라 배정 행·기본 배정과 어긋날 수 있다. 자기평가 단계 표시에만 쓴다.
type RuntimeTargetProfile = {
  id: string
  empName: string
  role: SystemRole
  position: Position
  departmentName: string
}

type RuntimeStageAssignment = {
  stage: EvalStage
  evaluatorId: string | null
  evaluator: StageAssigneeProfile | null
}

export type EvaluationStageChainEntry = {
  stage: EvalStage
  reviewOrder: number
  stageRoleLabel: string
  stageLabel: string
  evaluatorId: string
  evaluatorName: string
  evaluatorRole: SystemRole
  evaluatorPosition: string
  evaluatorDepartment: string
}

export type PerformanceAssignmentPageState = 'ready' | 'empty' | 'permission-denied' | 'error'

export type PerformanceAssignmentPageData = {
  state: PerformanceAssignmentPageState
  message?: string
  availableCycles: Array<{
    id: string
    name: string
    year: number
    status: string
  }>
  selectedCycleId?: string
  summary?: {
    totalCount: number
    manualOverrideCount: number
    submittedCount: number
    overdueCount: number
    unassignedCount: number
  }
  rows?: Array<{
    targetId: string
    targetName: string
    targetDepartment: string
    targetPosition: string
    evalStage: EvalStage
    stageLabel: string
    evaluatorId: string | null
    evaluatorName: string | null
    evaluatorDepartment: string | null
    evaluatorPosition: string | null
    assignmentSource: 'AUTO' | 'MANUAL' | 'UNASSIGNED'
    assignmentSourceLabel: string
    evaluationId: string | null
    evaluationStatus: EvalStatus | null
    evaluationStatusLabel: string
    dueAt: string | null
    updatedAt: string | null
  }>
  evaluatorOptions?: Array<{
    id: string
    name: string
    department: string
    position: string
    role: SystemRole
    allowedStages: EvalStage[]
  }>
  routingReadiness?: Evaluation2026EvaluatorRoutingReadinessResult
}

type DefaultAssignmentRecord = {
  targetId: string
  evalStage: EvalStage
  evaluatorId: string | null
}

type LoadPerformanceAssignmentPageDataParams = {
  actorId: string
  actorRole: SystemRole
  cycleId?: string
}

type UpsertPerformanceAssignmentParams = {
  actorId: string
  evalCycleId: string
  targetId: string
  evalStage: EvalStage
  evaluatorId: string
  note?: string
}

type ResetPerformanceAssignmentParams = {
  actorId: string
  evalCycleId: string
  targetId: string
  evalStage: EvalStage
}

type SyncPerformanceAssignmentsParams = {
  actorId: string
  evalCycleId: string
}

function getDueAtForStage(
  cycle: {
    selfEvalEnd: Date | null
    firstEvalEnd: Date | null
    secondEvalEnd: Date | null
    finalEvalEnd: Date | null
    ceoAdjustEnd: Date | null
  },
  stage: EvalStage
) {
  switch (stage) {
    case 'SELF':
      return cycle.selfEvalEnd
    case 'FIRST':
      return cycle.firstEvalEnd
    case 'SECOND':
      return cycle.secondEvalEnd
    case 'FINAL':
      return cycle.finalEvalEnd
    case 'CEO_ADJUST':
      return cycle.ceoAdjustEnd
  }
}

function mapAssignmentSourceLabel(source: 'AUTO' | 'MANUAL' | 'UNASSIGNED') {
  switch (source) {
    case 'AUTO':
      return '자동'
    case 'MANUAL':
      return '수동'
    case 'UNASSIGNED':
      return '미지정'
  }
}

function buildAssignmentKey(params: { targetId: string; evalStage: EvalStage }) {
  return `${params.targetId}:${params.evalStage}`
}

async function runAssignmentTransaction<T>(
  db: AssignmentDbClient,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: { timeout: number; maxWait: number }
) {
  if ('$transaction' in db) {
    return db.$transaction(async (tx) => fn(tx), options)
  }

  return fn(db)
}

// sync 트랜잭션 상한. 활성 직원 289명 × 4단계 = 1,156행, 잠기지 않은 행마다 upsert · updateMany 2쿼리라
// 최대 약 2,313쿼리다. 쿼리당 50ms 를 잡아 약 116초 → 120초.
const SYNC_TRANSACTION_OPTIONS = { timeout: 120_000, maxWait: 10_000 }

// 순번은 단계가 정한다. 빈 단계는 칸을 건너뛰되 뒤 번호는 유지한다(§83).
const STAGE_REVIEW_ORDER: Record<EvalStage, number> = {
  SELF: 0, FIRST: 1, SECOND: 2, FINAL: 3, CEO_ADJUST: 4,
}

function getStageRoleLabel(stage: EvalStage, evaluatorRole: SystemRole | null, jobTitle: string | null) {
  if (stage === 'SELF') {
    return '자기평가'
  }

  if (stage === 'CEO_ADJUST') {
    return '대표이사 확정'
  }

  if (evaluatorRole === 'ROLE_CEO') {
    return stage === 'FINAL' ? '본부장평가(대표 대행)' : '대표이사 확정'
  }

  switch (evaluatorRole) {
    case 'ROLE_TEAM_LEADER':
      return '팀장평가'
    case 'ROLE_SECTION_CHIEF':
      return '실장평가'
    case 'ROLE_DIV_HEAD':
      return '본부장평가'
    case 'ROLE_ADMIN':
      switch (jobTitle) {
        case '팀장':
          return '팀장평가'
        case '실장':
        case '부문장':
          return '실장평가'
        case '본부장':
          return '본부장평가'
        default:
          return stage === 'FINAL' ? '최종 검토' : '관리자 검토'
      }
    default:
      break
  }

  switch (stage) {
    case 'FIRST':
      return '1차 검토'
    case 'SECOND':
      return '상위 검토'
    case 'FINAL':
      return '최종 검토'
  }
}

function buildStageDisplayLabel(
  stage: EvalStage,
  reviewOrder: number,
  evaluatorRole: SystemRole | null,
  jobTitle: string | null
) {
  const roleLabel = getStageRoleLabel(stage, evaluatorRole, jobTitle)
  return stage === 'SELF' ? roleLabel : `${reviewOrder}차 ${roleLabel}`
}

async function loadRuntimeTargetProfile(db: AssignmentDbClient, targetId: string) {
  const target = await db.employee.findUnique({
    where: { id: targetId },
    select: {
      id: true,
      empName: true,
      role: true,
      position: true,
      department: {
        select: {
          deptName: true,
        },
      },
    },
  })

  if (!target) {
    throw new AppError(404, 'EVALUATION_TARGET_NOT_FOUND', '평가 대상자를 찾을 수 없습니다.')
  }

  return {
    id: target.id,
    empName: target.empName,
    role: target.role,
    position: target.position,
    departmentName: target.department.deptName,
  } satisfies RuntimeTargetProfile
}

async function loadStageAssigneeProfiles(
  db: AssignmentDbClient,
  employeeIds: string[]
) {
  if (!employeeIds.length) {
    return new Map<string, StageAssigneeProfile>()
  }

  const employees = await db.employee.findMany({
    where: {
      id: {
        in: employeeIds,
      },
      status: 'ACTIVE',
    },
    select: {
      id: true,
      empName: true,
      role: true,
      position: true,
      jobTitle: true,
      department: {
        select: {
          deptName: true,
        },
      },
    },
  })

  return new Map(
    employees.map((employee) => [
      employee.id,
      {
        id: employee.id,
        empName: employee.empName,
        role: employee.role,
        position: employee.position,
        departmentName: employee.department.deptName,
        jobTitle: employee.jobTitle,
      } satisfies StageAssigneeProfile,
    ])
  )
}

// 비활성 평가자 행의 단계들을 기본 배정의 평가자로 대체할 프로필. 단계가 없으면 기본 배정을 계산하지 않는다.
async function loadReplacementProfiles(
  db: AssignmentDbClient,
  targetId: string,
  stages: EvalStage[]
) {
  const replacements = new Map<EvalStage, StageAssigneeProfile>()
  if (!stages.length) {
    return replacements
  }

  const defaults = await buildDefaultAssignmentRecords(db)
  const evaluatorIdByStage = new Map<EvalStage, string>()
  for (const item of defaults) {
    if (item.targetId === targetId && item.evaluatorId && stages.includes(item.evalStage)) {
      evaluatorIdByStage.set(item.evalStage, item.evaluatorId)
    }
  }

  const profiles = await loadStageAssigneeProfiles(db, [...new Set(evaluatorIdByStage.values())])
  for (const [stage, evaluatorId] of evaluatorIdByStage) {
    const profile = profiles.get(evaluatorId)
    if (profile) {
      replacements.set(stage, profile)
    }
  }

  return replacements
}

async function loadRuntimeStageAssignments(params: {
  db: AssignmentDbClient
  evalCycleId: string
  targetId: string
}) {
  const { db, evalCycleId, targetId } = params
  const target = await loadRuntimeTargetProfile(db, targetId)
  const persistedAssignments = await db.evaluationAssignment.findMany({
    where: {
      evalCycleId,
      targetId,
      evalStage: {
        in: PERFORMANCE_ASSIGNABLE_STAGES,
      },
    },
    include: {
      evaluator: {
        select: {
          id: true,
          empName: true,
          role: true,
          position: true,
          status: true,
          jobTitle: true,
          department: {
            select: {
              deptName: true,
            },
          },
        },
      },
    },
  })

  // 배정 행이 하나라도 있으면 행만 쓴다. 행 없는 단계는 건너뛴다(평가자 없음).
  // 평가자가 비활성인 행만 그 단계를 기본 배정의 평가자로 채운다. 기본 배정에도 없으면 빈다.
  if (persistedAssignments.length > 0) {
    const persistedMap = new Map(
      persistedAssignments.map((assignment) => [assignment.evalStage, assignment])
    )
    const inactiveStages = persistedAssignments
      .filter((assignment) => assignment.evaluator?.status !== 'ACTIVE')
      .map((assignment) => assignment.evalStage)
    const replacementProfiles = await loadReplacementProfiles(db, targetId, inactiveStages)

    const assignments = PERFORMANCE_ASSIGNABLE_STAGES.map((stage) => {
      const persisted = persistedMap.get(stage)
      if (persisted && persisted.evaluator?.status !== 'ACTIVE') {
        const replacement = replacementProfiles.get(stage) ?? null
        return {
          stage,
          evaluatorId: replacement?.id ?? null,
          evaluator: replacement,
        } satisfies RuntimeStageAssignment
      }

      if (persisted?.evaluator?.status === 'ACTIVE') {
        return {
          stage,
          evaluatorId: persisted.evaluatorId,
          evaluator: {
            id: persisted.evaluator.id,
            empName: persisted.evaluator.empName,
            role: persisted.evaluator.role,
            position: persisted.evaluator.position,
            departmentName: persisted.evaluator.department.deptName,
            jobTitle: persisted.evaluator.jobTitle,
          } satisfies StageAssigneeProfile,
        } satisfies RuntimeStageAssignment
      }

      return { stage, evaluatorId: null, evaluator: null } satisfies RuntimeStageAssignment
    })

    return { target, assignments }
  }

  // 행이 하나도 없는 대상만 기본 배정을 계산한다. sync 가 행을 쓰는 것과 같은 계산이다.
  const defaults = await buildDefaultAssignmentRecords(db)
  const defaultEvaluatorIdByStage = new Map(
    defaults
      .filter((item) => item.targetId === targetId)
      .map((item) => [item.evalStage, item.evaluatorId] as const)
  )
  const defaultEvaluatorIds = PERFORMANCE_ASSIGNABLE_STAGES.map(
    (stage) => defaultEvaluatorIdByStage.get(stage) ?? null
  ).filter((value): value is string => Boolean(value))
  const defaultProfiles = await loadStageAssigneeProfiles(db, defaultEvaluatorIds)

  const assignments = PERFORMANCE_ASSIGNABLE_STAGES.map((stage) => {
    const evaluatorId = defaultEvaluatorIdByStage.get(stage) ?? null
    const evaluator = evaluatorId ? defaultProfiles.get(evaluatorId) ?? null : null
    return {
      stage,
      evaluatorId: evaluator?.id ?? null,
      evaluator,
    } satisfies RuntimeStageAssignment
  })

  return {
    target,
    assignments,
  }
}

export async function getEvaluationStageChain(params: {
  db?: AssignmentDbClient
  evalCycleId: string
  targetId: string
}) {
  const db = params.db ?? prisma
  const { target, assignments } = await loadRuntimeStageAssignments({
    db,
    evalCycleId: params.evalCycleId,
    targetId: params.targetId,
  })

  const activeStages: EvaluationStageChainEntry[] = [
    {
      stage: 'SELF',
      reviewOrder: 0,
      stageRoleLabel: '자기평가',
      stageLabel: '자기평가',
      evaluatorId: target.id,
      evaluatorName: target.empName,
      evaluatorRole: target.role,
      evaluatorPosition: POSITION_LABELS[target.position] ?? target.position,
      evaluatorDepartment: target.departmentName,
    },
  ]

  const assignmentMap = new Map(assignments.map((assignment) => [assignment.stage, assignment] as const))
  const appendStage = (stage: AssignableEvalStage) => {
    const assignment = assignmentMap.get(stage)
    if (!assignment?.evaluatorId || !assignment.evaluator) {
      return false
    }

    const reviewOrder = STAGE_REVIEW_ORDER[assignment.stage]
    const stageRoleLabel = getStageRoleLabel(assignment.stage, assignment.evaluator.role, assignment.evaluator.jobTitle)

    activeStages.push({
      stage: assignment.stage,
      reviewOrder,
      stageRoleLabel,
      stageLabel: buildStageDisplayLabel(
        assignment.stage,
        reviewOrder,
        assignment.evaluator.role,
        assignment.evaluator.jobTitle
      ),
      evaluatorId: assignment.evaluator.id,
      evaluatorName: assignment.evaluator.empName,
      evaluatorRole: assignment.evaluator.role,
      evaluatorPosition: resolveEmployeePositionLabel({
        role: assignment.evaluator.role,
        position: assignment.evaluator.position,
        jobTitle: assignment.evaluator.jobTitle,
      }),
      evaluatorDepartment: assignment.evaluator.departmentName,
    })

    return true
  }

  // 리더 본인은 teamLeaderId 가 구조적으로 비므로 FIRST 부재가 체인 중단 사유는 아니다.
  appendStage('FIRST')

  appendStage('SECOND')

  if (!appendStage('FINAL')) {
    return activeStages
  }

  appendStage('CEO_ADJUST')

  return activeStages
}

export async function getPreviousActiveEvaluationStage(params: {
  db?: AssignmentDbClient
  evalCycleId: string
  targetId: string
  currentStage: EvalStage
}) {
  const chain = await getEvaluationStageChain(params)
  const currentIndex = chain.findIndex((entry) => entry.stage === params.currentStage)
  return currentIndex > 0 ? chain[currentIndex - 1]?.stage ?? null : null
}

export async function getNextActiveEvaluationStage(params: {
  db?: AssignmentDbClient
  evalCycleId: string
  targetId: string
  currentStage: EvalStage
}) {
  const chain = await getEvaluationStageChain(params)
  const currentIndex = chain.findIndex((entry) => entry.stage === params.currentStage)
  if (currentIndex < 0 || currentIndex >= chain.length - 1) {
    return null
  }

  return chain[currentIndex + 1]?.stage ?? null
}

export function getPreviousEvaluationStage(stage: EvalStage) {
  const index = EVALUATION_STAGE_ORDER.indexOf(stage)
  return index > 0 ? EVALUATION_STAGE_ORDER[index - 1] : null
}

export function getNextEvaluationStage(stage: EvalStage) {
  const index = EVALUATION_STAGE_ORDER.indexOf(stage)
  return index >= 0 && index < EVALUATION_STAGE_ORDER.length - 1
    ? EVALUATION_STAGE_ORDER[index + 1]
    : null
}

function getDefaultEvaluatorIdForStage(
  chain: AssignmentChain | undefined,
  stage: EvalStage,
  ceoId: string | null
) {
  if (!chain && stage !== 'CEO_ADJUST') {
    return null
  }

  switch (stage) {
    case 'FIRST':
      return chain?.teamLeaderId ?? null
    case 'SECOND':
      return chain?.sectionChiefId ?? null
    case 'FINAL':
      return chain?.divisionHeadId ?? null
    case 'CEO_ADJUST':
      return ceoId
    case 'SELF':
      return null
  }
}

async function loadHierarchyInputs(db: AssignmentDbClient) {
  const [departments, employees] = await Promise.all([
    db.department.findMany({
      select: {
        id: true,
        deptName: true,
        parentDeptId: true,
        leaderEmployeeId: true,
        excludeLeaderFromEvaluatorAutoAssign: true,
      },
    }),
    db.employee.findMany({
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
        jobTitle: true,
      },
      orderBy: [{ joinDate: 'asc' }, { createdAt: 'asc' }],
    }),
  ])

  return {
    departments,
    employees: employees as AssignmentHierarchyEmployee[],
  }
}

async function buildDefaultAssignmentRecords(db: AssignmentDbClient): Promise<DefaultAssignmentRecord[]> {
  const { departments, employees } = await loadHierarchyInputs(db)
  const activeEmployees = employees.filter((employee) => employee.status === 'ACTIVE')
  const assignmentMap = buildAssignments(departments, activeEmployees)
  const ceoId = activeEmployees.find((employee) => employee.role === 'ROLE_CEO')?.id ?? null

  const rows: DefaultAssignmentRecord[] = []

  for (const employee of activeEmployees) {
    const chain = assignmentMap.get(employee.id)

    for (const stage of PERFORMANCE_ASSIGNABLE_STAGES) {
      rows.push({
        targetId: employee.id,
        evalStage: stage,
        evaluatorId: getDefaultEvaluatorIdForStage(chain, stage, ceoId),
      })
    }
  }

  return rows
}

function ensureAssignableStage(stage: EvalStage) {
  if (!PERFORMANCE_ASSIGNABLE_STAGES.includes(stage)) {
    throw new AppError(400, 'INVALID_EVALUATION_STAGE', '배정 관리에서는 상위 평가 단계만 변경할 수 있습니다.')
  }
}

async function assertCycleExists(db: AssignmentDbClient, evalCycleId: string) {
  const cycle = await db.evalCycle.findUnique({
    where: { id: evalCycleId },
    select: { id: true },
  })

  if (!cycle) {
    throw new AppError(404, 'EVAL_CYCLE_NOT_FOUND', '평가 주기를 찾을 수 없습니다.')
  }
}

async function assertEditableAssignmentStage(params: {
  db: AssignmentDbClient
  evalCycleId: string
  targetId: string
  evalStage: EvalStage
}) {
  const evaluation = await params.db.evaluation.findUnique({
    where: {
      evalCycleId_targetId_evalStage: {
        evalCycleId: params.evalCycleId,
        targetId: params.targetId,
        evalStage: params.evalStage,
      },
    },
    select: {
      id: true,
      status: true,
    },
  })

  if (evaluation && ['SUBMITTED', 'CONFIRMED'].includes(evaluation.status)) {
    throw new AppError(400, 'ASSIGNMENT_LOCKED', '이미 제출된 단계는 배정 담당자를 변경할 수 없습니다.')
  }

  return evaluation
}

function mapAllowedStages(role: SystemRole): EvalStage[] {
  return PERFORMANCE_ASSIGNABLE_STAGES.filter((stage) => STAGE_ALLOWED_ROLES[stage].includes(role))
}

export async function resolveEvaluationStageAssignee(params: {
  db?: AssignmentDbClient
  evalCycleId: string
  targetId: string
  evalStage: EvalStage
}) {
  ensureAssignableStage(params.evalStage)
  const db = params.db ?? prisma

  // loadRuntimeStageAssignments 와 같은 규칙: 대상자의 배정 행이 하나라도 있으면 그 단계 행만 쓴다.
  const persistedAssignments = await db.evaluationAssignment.findMany({
    where: {
      evalCycleId: params.evalCycleId,
      targetId: params.targetId,
      evalStage: {
        in: PERFORMANCE_ASSIGNABLE_STAGES,
      },
    },
    select: {
      evalStage: true,
      evaluatorId: true,
      evaluator: {
        select: {
          status: true,
        },
      },
    },
  })

  // 평가자가 비활성인 행은 기본 배정의 평가자로 대체한다(행 없는 단계는 null).
  if (persistedAssignments.length > 0) {
    const persisted = persistedAssignments.find((assignment) => assignment.evalStage === params.evalStage)
    if (!persisted) {
      return null
    }
    if (persisted.evaluator.status === 'ACTIVE') {
      return persisted.evaluatorId
    }

    const replacements = await loadReplacementProfiles(db, params.targetId, [params.evalStage])
    return replacements.get(params.evalStage)?.id ?? null
  }

  const defaults = await buildDefaultAssignmentRecords(db)
  return (
    defaults.find(
      (item) =>
        item.targetId === params.targetId &&
        item.evalStage === params.evalStage
    )?.evaluatorId ?? null
  )
}

async function resolveDefaultEvaluationStageAssignee(params: {
  db?: AssignmentDbClient
  targetId: string
  evalStage: EvalStage
}) {
  ensureAssignableStage(params.evalStage)
  const db = params.db ?? prisma
  const defaults = await buildDefaultAssignmentRecords(db)
  return (
    defaults.find(
      (item) =>
        item.targetId === params.targetId &&
        item.evalStage === params.evalStage
    )?.evaluatorId ?? null
  )
}

export async function syncPerformanceAssignmentsForCycle(
  params: SyncPerformanceAssignmentsParams,
  db: AssignmentDbClient = prisma
) {
  await assertCycleExists(db, params.evalCycleId)

  const [defaults, existingAssignments, lockedEvaluations] = await Promise.all([
    buildDefaultAssignmentRecords(db),
    db.evaluationAssignment.findMany({
      where: {
        evalCycleId: params.evalCycleId,
      },
      select: {
        id: true,
        targetId: true,
        evalStage: true,
        evaluatorId: true,
        assignmentSource: true,
        evaluator: {
          select: {
            status: true,
          },
        },
      },
    }),
    db.evaluation.findMany({
      where: {
        evalCycleId: params.evalCycleId,
        status: {
          in: ['SUBMITTED', 'CONFIRMED'],
        },
      },
      select: {
        targetId: true,
        evalStage: true,
      },
    }),
  ])

  const defaultMap = new Map(
    defaults.map((item) => [buildAssignmentKey(item), item])
  )
  const existingMap = new Map(
    existingAssignments.map((item) => [buildAssignmentKey(item), item])
  )

  // 잠긴 단계(평가가 이미 제출 · 확정됨)는 sync 가 실패하지 않고 건너뛴다. 행도 평가도 그대로 둔다.
  // 수동 지정 경로는 assertEditableAssignmentStage 로 계속 막는다.
  const lockedKeys = new Set(lockedEvaluations.map((item) => buildAssignmentKey(item)))

  const manualKeys = new Set(
    existingAssignments
      .filter((item) => item.assignmentSource === EvaluationAssignmentSource.MANUAL)
      .map((item) => buildAssignmentKey(item))
  )

  const manualInactive = existingAssignments
    .filter(
      (item) =>
        item.assignmentSource === EvaluationAssignmentSource.MANUAL &&
        item.evaluator.status !== 'ACTIVE'
    )
    .map((item) => ({
      targetId: item.targetId,
      evalStage: item.evalStage,
      evaluatorId: item.evaluatorId,
    }))

  const autoCandidates = defaults.filter(
    (item) => !manualKeys.has(buildAssignmentKey(item)) && item.evaluatorId
  )
  const staleCandidates = existingAssignments.filter(
    (item) =>
      item.assignmentSource === EvaluationAssignmentSource.AUTO &&
      !defaultMap.get(buildAssignmentKey(item))?.evaluatorId
  )

  // 바뀌어야 했는데 잠겨서 못 바꾼 단계만 보고한다. 이미 기본 평가자인 잠긴 단계는 넣지 않는다.
  const lockedSkipped: Array<{
    targetId: string
    evalStage: EvalStage
    storedEvaluatorId: string | null
    defaultEvaluatorId: string | null
  }> = []
  for (const item of autoCandidates) {
    const stored = existingMap.get(buildAssignmentKey(item))
    if (lockedKeys.has(buildAssignmentKey(item)) && stored?.evaluatorId !== item.evaluatorId) {
      lockedSkipped.push({
        targetId: item.targetId,
        evalStage: item.evalStage,
        storedEvaluatorId: stored?.evaluatorId ?? null,
        defaultEvaluatorId: item.evaluatorId,
      })
    }
  }
  for (const item of staleCandidates) {
    if (lockedKeys.has(buildAssignmentKey(item))) {
      lockedSkipped.push({
        targetId: item.targetId,
        evalStage: item.evalStage,
        storedEvaluatorId: item.evaluatorId,
        defaultEvaluatorId: null,
      })
    }
  }

  const autoAssignments = autoCandidates.filter((item) => !lockedKeys.has(buildAssignmentKey(item)))
  const staleAutoAssignmentIds = staleCandidates
    .filter((item) => !lockedKeys.has(buildAssignmentKey(item)))
    .map((item) => item.id)

  await runAssignmentTransaction(db, async (tx) => {
    for (const assignment of autoAssignments) {
      await tx.evaluationAssignment.upsert({
        where: {
          evalCycleId_targetId_evalStage: {
            evalCycleId: params.evalCycleId,
            targetId: assignment.targetId,
            evalStage: assignment.evalStage,
          },
        },
        create: {
          evalCycleId: params.evalCycleId,
          targetId: assignment.targetId,
          evalStage: assignment.evalStage,
          evaluatorId: assignment.evaluatorId as string,
          assignmentSource: EvaluationAssignmentSource.AUTO,
          createdById: params.actorId,
          updatedById: params.actorId,
        },
        update: {
          evaluatorId: assignment.evaluatorId as string,
          assignmentSource: EvaluationAssignmentSource.AUTO,
          note: null,
          updatedById: params.actorId,
        },
      })

      await tx.evaluation.updateMany({
        where: {
          evalCycleId: params.evalCycleId,
          targetId: assignment.targetId,
          evalStage: assignment.evalStage,
          status: {
            in: ['PENDING', 'IN_PROGRESS', 'REJECTED'],
          },
        },
        data: {
          evaluatorId: assignment.evaluatorId as string,
        },
      })
    }

    if (staleAutoAssignmentIds.length) {
      await tx.evaluationAssignment.deleteMany({
        where: {
          id: {
            in: staleAutoAssignmentIds,
          },
        },
      })
    }
  }, SYNC_TRANSACTION_OPTIONS)

  return {
    syncedCount: autoAssignments.length,
    preservedManualCount: manualKeys.size,
    removedAutoCount: staleAutoAssignmentIds.length,
    lockedSkipped,
    manualInactive,
  }
}

export async function upsertPerformanceAssignment(
  params: UpsertPerformanceAssignmentParams,
  db: AssignmentDbClient = prisma
) {
  ensureAssignableStage(params.evalStage)
  await assertCycleExists(db, params.evalCycleId)

  const evaluator = await db.employee.findUnique({
    where: { id: params.evaluatorId },
    select: {
      id: true,
      empName: true,
      role: true,
      status: true,
    },
  })

  if (!evaluator || evaluator.status !== 'ACTIVE') {
    throw new AppError(404, 'EVALUATOR_NOT_FOUND', '배정할 평가자를 찾을 수 없습니다.')
  }

  if (!STAGE_ALLOWED_ROLES[params.evalStage].includes(evaluator.role)) {
    throw new AppError(400, 'INVALID_STAGE_EVALUATOR', '선택한 사용자는 이 단계의 평가자로 배정할 수 없습니다.')
  }

  const linkedEvaluation = await assertEditableAssignmentStage({
    db,
    evalCycleId: params.evalCycleId,
    targetId: params.targetId,
    evalStage: params.evalStage,
  })

  const assignment = await runAssignmentTransaction(db, async (tx) => {
    const saved = await tx.evaluationAssignment.upsert({
      where: {
        evalCycleId_targetId_evalStage: {
          evalCycleId: params.evalCycleId,
          targetId: params.targetId,
          evalStage: params.evalStage,
        },
      },
      create: {
        evalCycleId: params.evalCycleId,
        targetId: params.targetId,
        evalStage: params.evalStage,
        evaluatorId: params.evaluatorId,
        assignmentSource: EvaluationAssignmentSource.MANUAL,
        note: params.note?.trim() || null,
        createdById: params.actorId,
        updatedById: params.actorId,
      },
      update: {
        evaluatorId: params.evaluatorId,
        assignmentSource: EvaluationAssignmentSource.MANUAL,
        note: params.note?.trim() || null,
        updatedById: params.actorId,
      },
    })

    if (linkedEvaluation) {
      await tx.evaluation.update({
        where: { id: linkedEvaluation.id },
        data: {
          evaluatorId: params.evaluatorId,
        },
      })
    }

    return saved
  })

  return {
    assignmentId: assignment.id,
    evaluationId: linkedEvaluation?.id ?? null,
    evaluatorName: evaluator.empName,
  }
}

export async function resetPerformanceAssignmentToAuto(
  params: ResetPerformanceAssignmentParams,
  db: AssignmentDbClient = prisma
) {
  ensureAssignableStage(params.evalStage)
  await assertCycleExists(db, params.evalCycleId)

  const linkedEvaluation = await assertEditableAssignmentStage({
    db,
    evalCycleId: params.evalCycleId,
    targetId: params.targetId,
    evalStage: params.evalStage,
  })

  const nextEvaluatorId = await resolveDefaultEvaluationStageAssignee({
    db,
    targetId: params.targetId,
    evalStage: params.evalStage,
  })

  if (!nextEvaluatorId) {
    throw new AppError(400, 'AUTO_ASSIGNMENT_NOT_AVAILABLE', '자동 배정 기준으로 되돌릴 평가자가 없습니다.')
  }

  const assignment = await runAssignmentTransaction(db, async (tx) => {
    const saved = await tx.evaluationAssignment.upsert({
      where: {
        evalCycleId_targetId_evalStage: {
          evalCycleId: params.evalCycleId,
          targetId: params.targetId,
          evalStage: params.evalStage,
        },
      },
      create: {
        evalCycleId: params.evalCycleId,
        targetId: params.targetId,
        evalStage: params.evalStage,
        evaluatorId: nextEvaluatorId,
        assignmentSource: EvaluationAssignmentSource.AUTO,
        createdById: params.actorId,
        updatedById: params.actorId,
      },
      update: {
        evaluatorId: nextEvaluatorId,
        assignmentSource: EvaluationAssignmentSource.AUTO,
        note: null,
        updatedById: params.actorId,
      },
    })

    if (linkedEvaluation) {
      await tx.evaluation.update({
        where: { id: linkedEvaluation.id },
        data: {
          evaluatorId: nextEvaluatorId,
        },
      })
    }

    return saved
  })

  return {
    assignmentId: assignment.id,
    evaluationId: linkedEvaluation?.id ?? null,
    evaluatorId: nextEvaluatorId,
  }
}

export async function getPerformanceAssignmentPageData(
  params: LoadPerformanceAssignmentPageDataParams,
  db: AssignmentDbClient = prisma
): Promise<PerformanceAssignmentPageData> {
  try {
    if (params.actorRole !== 'ROLE_ADMIN') {
      return {
        state: 'permission-denied',
        message: '관리자만 배정 현황을 확인할 수 있습니다.',
        availableCycles: [],
      }
    }

    const availableCycles = await db.evalCycle.findMany({
      select: {
        id: true,
        cycleName: true,
        evalYear: true,
        status: true,
        selfEvalEnd: true,
        firstEvalEnd: true,
        secondEvalEnd: true,
        finalEvalEnd: true,
        ceoAdjustEnd: true,
      },
      orderBy: [{ evalYear: 'desc' }, { createdAt: 'desc' }],
    })

    if (!availableCycles.length) {
      return {
        state: 'empty',
        message: '등록된 평가 주기가 없습니다.',
        availableCycles: [],
      }
    }

    const selectedCycle =
      availableCycles.find((cycle) => cycle.id === params.cycleId) ?? availableCycles[0] ?? null

    if (!selectedCycle) {
      return {
        state: 'empty',
        message: '선택할 평가 주기가 없습니다.',
        availableCycles: [],
      }
    }

    const defaults = await buildDefaultAssignmentRecords(db)
    const routingReadiness = await getEvaluation2026EvaluatorRoutingReadiness({
      db: db as never,
      evalCycleId: selectedCycle.id,
    })

    const [persistedAssignments, evaluations, employees] = await Promise.all([
      db.evaluationAssignment.findMany({
        where: {
          evalCycleId: selectedCycle.id,
        },
        include: {
          evaluator: {
            include: {
              department: {
                select: { deptName: true },
              },
            },
          },
        },
      }),
      db.evaluation.findMany({
        where: {
          evalCycleId: selectedCycle.id,
        },
        select: {
          id: true,
          targetId: true,
          evalStage: true,
          evaluatorId: true,
          status: true,
          updatedAt: true,
        },
      }),
      db.employee.findMany({
        where: {
          status: 'ACTIVE',
        },
        select: {
          id: true,
          empName: true,
          role: true,
          position: true,
          department: {
            select: {
              deptName: true,
            },
          },
        },
        orderBy: [{ empName: 'asc' }],
      }),
    ])

    const targetMap = new Map(
      employees.map((employee) => [
        employee.id,
        {
          id: employee.id,
          name: employee.empName,
          department: employee.department.deptName,
          position: POSITION_LABELS[employee.position] ?? employee.position,
        },
      ])
    )
    const evaluatorMap = new Map(
      employees.map((employee) => [
        employee.id,
        {
          id: employee.id,
          name: employee.empName,
          department: employee.department.deptName,
          position: POSITION_LABELS[employee.position] ?? employee.position,
          role: employee.role,
        },
      ])
    )
    const persistedMap = new Map(
      persistedAssignments.map((assignment) => [buildAssignmentKey(assignment), assignment])
    )
    const evaluationMap = new Map(
      evaluations.map((evaluation) => [buildAssignmentKey(evaluation), evaluation])
    )
    const stageRows = defaults.filter((row) => row.evalStage !== 'SELF')

    const rows = stageRows
      .map((row) => {
        const target = targetMap.get(row.targetId)
        if (!target) {
          return null
        }

        const persisted = persistedMap.get(buildAssignmentKey(row))
        const evaluation = evaluationMap.get(buildAssignmentKey(row))
        const evaluatorId = persisted?.evaluatorId ?? row.evaluatorId ?? null
        const evaluator = evaluatorId ? evaluatorMap.get(evaluatorId) ?? null : null
        const assignmentSource = persisted
          ? persisted.assignmentSource
          : evaluatorId
            ? EvaluationAssignmentSource.AUTO
            : null
        const normalizedAssignmentSource: 'AUTO' | 'MANUAL' | 'UNASSIGNED' =
          assignmentSource === EvaluationAssignmentSource.MANUAL
            ? 'MANUAL'
            : assignmentSource === EvaluationAssignmentSource.AUTO
              ? 'AUTO'
              : 'UNASSIGNED'

        return {
          targetId: target.id,
          targetName: target.name,
          targetDepartment: target.department,
          targetPosition: target.position,
          evalStage: row.evalStage,
          stageLabel: EVAL_STAGE_LABELS[row.evalStage],
          evaluatorId,
          evaluatorName: evaluator?.name ?? null,
          evaluatorDepartment: evaluator?.department ?? null,
          evaluatorPosition: evaluator?.position ?? null,
          assignmentSource: normalizedAssignmentSource,
          assignmentSourceLabel: mapAssignmentSourceLabel(normalizedAssignmentSource),
          evaluationId: evaluation?.id ?? null,
          evaluationStatus: evaluation?.status ?? null,
          evaluationStatusLabel: evaluation
            ? STAGE_STATUS_LABELS[evaluation.status]
            : evaluatorId
              ? '이전 단계 대기'
              : '평가자 미지정',
          dueAt: getDueAtForStage(selectedCycle, row.evalStage)?.toISOString() ?? null,
          updatedAt: evaluation?.updatedAt.toISOString() ?? null,
        }
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
      .sort((left, right) => {
        if (left.targetDepartment !== right.targetDepartment) {
          return left.targetDepartment.localeCompare(right.targetDepartment, 'ko')
        }
        if (left.targetName !== right.targetName) {
          return left.targetName.localeCompare(right.targetName, 'ko')
        }
        return EVALUATION_STAGE_ORDER.indexOf(left.evalStage) - EVALUATION_STAGE_ORDER.indexOf(right.evalStage)
      })

    const now = Date.now()
    const overdueCount = rows.filter((row) => {
      if (!row.dueAt) {
        return false
      }

      if (!row.evaluationStatus || ['SUBMITTED', 'CONFIRMED'].includes(row.evaluationStatus)) {
        return false
      }

      return new Date(row.dueAt).getTime() < now
    }).length

    return {
      state: 'ready',
      availableCycles: availableCycles.map((cycle) => ({
        id: cycle.id,
        name: cycle.cycleName,
        year: cycle.evalYear,
        status: cycle.status,
      })),
      selectedCycleId: selectedCycle.id,
      summary: {
        totalCount: rows.length,
        manualOverrideCount: rows.filter((row) => row.assignmentSource === 'MANUAL').length,
        submittedCount: rows.filter((row) => row.evaluationStatus === 'SUBMITTED' || row.evaluationStatus === 'CONFIRMED').length,
        overdueCount,
        unassignedCount: rows.filter((row) => !row.evaluatorId).length,
      },
      rows,
      evaluatorOptions: employees.map((employee) => ({
        id: employee.id,
        name: employee.empName,
        department: employee.department.deptName,
        position: POSITION_LABELS[employee.position] ?? employee.position,
        role: employee.role,
        allowedStages: mapAllowedStages(employee.role),
      })),
      routingReadiness,
    }
  } catch (error) {
    console.error('[performance-assignments]', error)
    return {
      state: 'error',
      message: '평가 배정 현황을 불러오지 못했습니다.',
      availableCycles: [],
    }
  }
}
