import { createHash } from 'node:crypto'
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
  // 미리보기 계획의 지문. 없거나 지금 계획과 다르면 쓰지 않는다.
  fingerprint?: string | null
}

type SyncPlanEntryBase = {
  targetId: string
  targetName: string | null
  evalStage: EvalStage
}

type SyncPlanWrites = {
  // id 는 (대상 · 단계) 키다. 아직 행이 없다.
  create: Array<SyncPlanEntryBase & { id: string; evaluatorId: string; evaluatorName: string | null }>
  // id 는 배정 행 id 다.
  update: Array<
    SyncPlanEntryBase & {
      id: string
      beforeEvaluatorId: string
      beforeEvaluatorName: string | null
      afterEvaluatorId: string
      afterEvaluatorName: string | null
    }
  >
  delete: Array<
    SyncPlanEntryBase & {
      id: string
      beforeEvaluatorId: string
      beforeEvaluatorName: string | null
      hasInProgressEvaluation: boolean
    }
  >
  // id 는 평가 id 다.
  transfer: Array<
    SyncPlanEntryBase & {
      id: string
      beforeEvaluatorId: string
      beforeEvaluatorName: string | null
      afterEvaluatorId: string
      afterEvaluatorName: string | null
    }
  >
}

type SyncLockedSkipped = {
  targetId: string
  evalStage: EvalStage
  storedEvaluatorId: string | null
  defaultEvaluatorId: string | null
}

export type PerformanceAssignmentSyncPlan = SyncPlanWrites & {
  evalCycleId: string
  fingerprint: string
  unchangedCount: number
  preservedManualCount: number
  lockedSkipped: SyncLockedSkipped[]
  manualInactive: Array<{ targetId: string; evalStage: EvalStage; evaluatorId: string }>
  // 계획에 나오는 직원 id → 이름. lockedSkipped · manualInactive 는 모양을 유지하고 이름은 여기서 찾는다.
  employeeNames: Record<string, string>
  // 계획에 나오는 직원 id → 부서명. 배정 행이 없는 대상도 부서를 보여 줄 수 있다.
  employeeDepartments: Record<string, string>
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

type PersistedStageRow = { evalStage: EvalStage; evaluatorId: string; evaluatorActive: boolean }

export type ResolvedStageEvaluator = {
  stage: AssignableEvalStage
  // 비활성 평가자의 행인데 기본 배정에도 평가자가 없으면 null 이다.
  evaluatorId: string | null
  source: 'ASSIGNMENT' | 'REPLACEMENT' | 'DEFAULT'
}

// 기본 배정이 필요한 경우: 배정 행이 하나도 없거나, 평가자가 비활성인 행이 있을 때.
function needsDefaultAssignment(rows: PersistedStageRow[]) {
  return rows.length === 0 || rows.some((row) => !row.evaluatorActive)
}

function groupDefaultEvaluatorIdsByTarget(defaults: DefaultAssignmentRecord[]) {
  const byTarget = new Map<string, Map<EvalStage, string>>()
  for (const item of defaults) {
    if (!item.evaluatorId) continue
    const current = byTarget.get(item.targetId) ?? new Map<EvalStage, string>()
    current.set(item.evalStage, item.evaluatorId)
    byTarget.set(item.targetId, current)
  }
  return byTarget
}

// 실제 업적평가의 단계별 평가자 결정. loadRuntimeStageAssignments 와 loadStageEvaluatorsForTargets 가 함께 쓴다.
// 배정 행이 하나라도 있으면 행만 쓴다(행 없는 단계는 체인에 없다). 평가자가 비활성인 행은 그 단계의 기본 배정 평가자로
// 대체하고, 기본 배정에도 없으면 평가자 없음(null)이다. 행이 하나도 없는 대상은 기본 배정을 쓴다.
function resolveStageEvaluators(
  rows: PersistedStageRow[],
  defaultEvaluatorIdByStage: ReadonlyMap<EvalStage, string>
): ResolvedStageEvaluator[] {
  if (!rows.length) {
    return PERFORMANCE_ASSIGNABLE_STAGES.flatMap((stage): ResolvedStageEvaluator[] => {
      const evaluatorId = defaultEvaluatorIdByStage.get(stage)
      return evaluatorId ? [{ stage: stage as AssignableEvalStage, evaluatorId, source: 'DEFAULT' }] : []
    })
  }

  const rowByStage = new Map(rows.map((row) => [row.evalStage, row]))
  return PERFORMANCE_ASSIGNABLE_STAGES.flatMap((stage): ResolvedStageEvaluator[] => {
    const row = rowByStage.get(stage)
    if (!row) return []
    if (row.evaluatorActive) return [{ stage: stage as AssignableEvalStage, evaluatorId: row.evaluatorId, source: 'ASSIGNMENT' }]
    const replacementId = defaultEvaluatorIdByStage.get(stage) ?? null
    return [{ stage: stage as AssignableEvalStage, evaluatorId: replacementId, source: 'REPLACEMENT' }]
  })
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

  // 평가자 결정은 resolveStageEvaluators 하나다(배정 행 우선, 비활성 행은 기본 배정으로 대체, 행이 없으면 기본 배정).
  // 기본 배정은 필요할 때만 계산한다. sync 가 행을 쓰는 것과 같은 계산이다.
  const rows: PersistedStageRow[] = persistedAssignments.map((assignment) => ({
    evalStage: assignment.evalStage,
    evaluatorId: assignment.evaluatorId,
    evaluatorActive: assignment.evaluator?.status === 'ACTIVE',
  }))
  const defaultEvaluatorIdByStage = needsDefaultAssignment(rows)
    ? groupDefaultEvaluatorIdsByTarget(await buildDefaultAssignmentRecords(db)).get(targetId) ?? new Map<EvalStage, string>()
    : new Map<EvalStage, string>()
  const resolved = new Map(resolveStageEvaluators(rows, defaultEvaluatorIdByStage).map((entry) => [entry.stage, entry]))

  // 대체 · 기본 배정 평가자는 ACTIVE 프로필로 확인한다. 배정 행의 ACTIVE 평가자는 행의 프로필을 그대로 쓴다.
  const profileIds = [...resolved.values()]
    .filter((entry) => entry.source !== 'ASSIGNMENT' && entry.evaluatorId)
    .map((entry) => entry.evaluatorId as string)
  const profiles = await loadStageAssigneeProfiles(db, [...new Set(profileIds)])
  const persistedMap = new Map(persistedAssignments.map((assignment) => [assignment.evalStage, assignment]))

  const assignments = PERFORMANCE_ASSIGNABLE_STAGES.map((stage) => {
    const entry = resolved.get(stage as AssignableEvalStage)
    const persisted = persistedMap.get(stage)
    if (entry?.source === 'ASSIGNMENT' && persisted?.evaluator) {
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

    const evaluator = entry?.evaluatorId ? profiles.get(entry.evaluatorId) ?? null : null
    return { stage, evaluatorId: evaluator?.id ?? null, evaluator } satisfies RuntimeStageAssignment
  })

  return { target, assignments }
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
  return (await buildDefaultAssignmentContext(db)).rows
}

// 기본 배정과, 그 계산에 쓴 전체 직원(비활성 포함). sync 계획이 이름을 붙일 때 직원 목록을 다시 읽지 않게 한다.
async function buildDefaultAssignmentContext(db: AssignmentDbClient) {
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

  return { rows, employees, departments }
}

// 여러 대상자의 단계별 평가자를 한 번에 구한다. 판정은 실제 업적평가(loadRuntimeStageAssignments)와 같은
// resolveStageEvaluators 다. 배정 행은 한 번에 읽고, 기본 배정(buildDefaultAssignmentRecords)은 필요할 때 호출당 한 번만 계산한다.
export async function loadStageEvaluatorsForTargets(params: {
  db?: AssignmentDbClient
  evalCycleId: string
  targetIds: string[]
}) {
  const db = params.db ?? prisma
  const result = new Map<string, { source: 'ASSIGNMENT' | 'DEFAULT'; stages: ResolvedStageEvaluator[] }>()
  if (!params.targetIds.length) return result

  const rows = await db.evaluationAssignment.findMany({
    where: {
      evalCycleId: params.evalCycleId,
      targetId: { in: params.targetIds },
      evalStage: { in: PERFORMANCE_ASSIGNABLE_STAGES },
    },
    select: {
      targetId: true,
      evalStage: true,
      evaluatorId: true,
      evaluator: { select: { status: true } },
    },
  })
  const rowsByTarget = new Map<string, PersistedStageRow[]>()
  for (const row of rows) {
    rowsByTarget.set(row.targetId, [
      ...(rowsByTarget.get(row.targetId) ?? []),
      { evalStage: row.evalStage, evaluatorId: row.evaluatorId, evaluatorActive: row.evaluator?.status === 'ACTIVE' },
    ])
  }

  const needsDefaults = params.targetIds.some((targetId) => needsDefaultAssignment(rowsByTarget.get(targetId) ?? []))
  const defaultsByTarget = needsDefaults
    ? groupDefaultEvaluatorIdsByTarget(await buildDefaultAssignmentRecords(db))
    : new Map<string, Map<EvalStage, string>>()

  for (const targetId of params.targetIds) {
    const targetRows = rowsByTarget.get(targetId) ?? []
    result.set(targetId, {
      source: targetRows.length ? 'ASSIGNMENT' : 'DEFAULT',
      stages: resolveStageEvaluators(targetRows, defaultsByTarget.get(targetId) ?? new Map()),
    })
  }
  return result
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

  // 평가자 결정은 resolveStageEvaluators 하나다. 평가자가 비활성인 행은 기본 배정의 평가자로 대체한다(행 없는 단계는 null).
  // 기본 배정은 행이 없거나 이 단계의 행이 비활성일 때만 계산한다.
  const rows: PersistedStageRow[] = persistedAssignments.map((assignment) => ({
    evalStage: assignment.evalStage,
    evaluatorId: assignment.evaluatorId,
    evaluatorActive: assignment.evaluator.status === 'ACTIVE',
  }))
  const stageRow = rows.find((row) => row.evalStage === params.evalStage)
  if (rows.length > 0 && !stageRow) {
    return null
  }
  const defaultEvaluatorIdByStage =
    !rows.length || !stageRow?.evaluatorActive
      ? groupDefaultEvaluatorIdsByTarget(await buildDefaultAssignmentRecords(db)).get(params.targetId) ??
        new Map<EvalStage, string>()
      : new Map<EvalStage, string>()
  const entry = resolveStageEvaluators(rows, defaultEvaluatorIdByStage).find((item) => item.stage === params.evalStage)
  if (!entry?.evaluatorId) {
    return null
  }
  if (entry.source !== 'REPLACEMENT') {
    return entry.evaluatorId
  }

  // 대체 평가자는 ACTIVE 프로필로 확인한다(loadRuntimeStageAssignments 와 같다).
  const profiles = await loadStageAssigneeProfiles(db, [entry.evaluatorId])
  return profiles.get(entry.evaluatorId)?.id ?? null
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

const SYNC_IN_PROGRESS_STATUSES: EvalStatus[] = ['PENDING', 'IN_PROGRESS', 'REJECTED']
const SYNC_LOCKED_STATUSES: EvalStatus[] = ['SUBMITTED', 'CONFIRMED']

function compareById(left: { id: string }, right: { id: string }) {
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0
}

// 계획 지문: 쓰기 목록을 id 로만 정렬해 쓰기를 정하는 값만 해시한다. 이름은 넣지 않는다.
function fingerprintSyncWrites(writes: SyncPlanWrites) {
  const payload = {
    create: [...writes.create].sort(compareById).map((item) => [item.id, item.evaluatorId]),
    update: [...writes.update].sort(compareById).map((item) => [item.id, item.beforeEvaluatorId, item.afterEvaluatorId]),
    delete: [...writes.delete].sort(compareById).map((item) => [item.id, item.beforeEvaluatorId]),
    transfer: [...writes.transfer].sort(compareById).map((item) => [item.id, item.beforeEvaluatorId, item.afterEvaluatorId]),
  }
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex')
}

// 행에 쓸 (대상 · 단계 · 평가자). 계획의 create · update 만이다.
function planRowUpserts(plan: PerformanceAssignmentSyncPlan): DefaultAssignmentRecord[] {
  return [
    ...plan.create.map((item) => ({ targetId: item.targetId, evalStage: item.evalStage, evaluatorId: item.evaluatorId })),
    ...plan.update.map((item) => ({ targetId: item.targetId, evalStage: item.evalStage, evaluatorId: item.afterEvaluatorId })),
  ]
}

async function computePerformanceAssignmentSyncPlan(db: AssignmentDbClient, evalCycleId: string) {
  const [defaultContext, existingAssignments, lockedEvaluations, inProgressEvaluations] = await Promise.all([
    buildDefaultAssignmentContext(db),
    db.evaluationAssignment.findMany({
      where: {
        evalCycleId,
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
        evalCycleId,
        status: {
          in: SYNC_LOCKED_STATUSES,
        },
      },
      select: {
        targetId: true,
        evalStage: true,
      },
    }),
    db.evaluation.findMany({
      where: {
        evalCycleId,
        status: {
          in: SYNC_IN_PROGRESS_STATUSES,
        },
      },
      select: {
        id: true,
        targetId: true,
        evalStage: true,
        evaluatorId: true,
      },
    }),
  ])

  const defaults = defaultContext.rows
  const nameById = new Map(defaultContext.employees.map((employee) => [employee.id, employee.empName]))
  const nameOf = (employeeId: string | null) => (employeeId ? nameById.get(employeeId) ?? null : null)

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
  const lockedSkipped: SyncLockedSkipped[] = []
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

  const unlockedAutoAssignments = autoCandidates.filter((item) => !lockedKeys.has(buildAssignmentKey(item)))

  const writes: SyncPlanWrites = { create: [], update: [], delete: [], transfer: [] }
  let unchangedCount = 0
  for (const item of unlockedAutoAssignments) {
    const assignmentKey = buildAssignmentKey(item)
    const stored = existingMap.get(assignmentKey)
    const evaluatorId = item.evaluatorId as string
    const base = { targetId: item.targetId, targetName: nameOf(item.targetId), evalStage: item.evalStage }

    if (!stored) {
      writes.create.push({ id: assignmentKey, ...base, evaluatorId, evaluatorName: nameOf(evaluatorId) })
    } else if (stored.evaluatorId !== evaluatorId) {
      writes.update.push({
        id: stored.id,
        ...base,
        beforeEvaluatorId: stored.evaluatorId,
        beforeEvaluatorName: nameOf(stored.evaluatorId),
        afterEvaluatorId: evaluatorId,
        afterEvaluatorName: nameOf(evaluatorId),
      })
    } else {
      unchangedCount += 1
    }
  }

  const inProgressMap = new Map(inProgressEvaluations.map((item) => [buildAssignmentKey(item), item]))
  for (const item of staleCandidates) {
    if (lockedKeys.has(buildAssignmentKey(item))) continue
    writes.delete.push({
      id: item.id,
      targetId: item.targetId,
      targetName: nameOf(item.targetId),
      evalStage: item.evalStage,
      beforeEvaluatorId: item.evaluatorId,
      beforeEvaluatorName: nameOf(item.evaluatorId),
      hasInProgressEvaluation: inProgressMap.has(buildAssignmentKey(item)),
    })
  }

  // 이관은 바뀐 행만이 아니라 계획상 평가자가 있는 잠기지 않은 AUTO 단계 전부를 본다.
  // 행은 맞는데 진행 중 평가만 예전 평가자인 단계도 옮긴다. MANUAL 행의 단계는 옮기지 않는다.
  for (const item of unlockedAutoAssignments) {
    const evaluation = inProgressMap.get(buildAssignmentKey(item))
    const evaluatorId = item.evaluatorId as string
    if (!evaluation || evaluation.evaluatorId === evaluatorId) continue
    writes.transfer.push({
      id: evaluation.id,
      targetId: item.targetId,
      targetName: nameOf(item.targetId),
      evalStage: item.evalStage,
      beforeEvaluatorId: evaluation.evaluatorId,
      beforeEvaluatorName: nameOf(evaluation.evaluatorId),
      afterEvaluatorId: evaluatorId,
      afterEvaluatorName: nameOf(evaluatorId),
    })
  }

  const referencedEmployeeIds = new Set<string>()
  for (const item of [...writes.create, ...writes.update, ...writes.delete, ...writes.transfer]) {
    referencedEmployeeIds.add(item.targetId)
  }
  for (const item of writes.create) referencedEmployeeIds.add(item.evaluatorId)
  for (const item of [...writes.update, ...writes.transfer]) {
    referencedEmployeeIds.add(item.beforeEvaluatorId)
    referencedEmployeeIds.add(item.afterEvaluatorId)
  }
  for (const item of writes.delete) referencedEmployeeIds.add(item.beforeEvaluatorId)
  for (const item of lockedSkipped) {
    referencedEmployeeIds.add(item.targetId)
    if (item.storedEvaluatorId) referencedEmployeeIds.add(item.storedEvaluatorId)
    if (item.defaultEvaluatorId) referencedEmployeeIds.add(item.defaultEvaluatorId)
  }
  for (const item of manualInactive) {
    referencedEmployeeIds.add(item.targetId)
    referencedEmployeeIds.add(item.evaluatorId)
  }
  const deptNameById = new Map(defaultContext.departments.map((department) => [department.id, department.deptName]))
  const deptIdByEmployeeId = new Map(defaultContext.employees.map((employee) => [employee.id, employee.deptId]))
  const employeeNames: Record<string, string> = {}
  const employeeDepartments: Record<string, string> = {}
  for (const employeeId of referencedEmployeeIds) {
    const name = nameById.get(employeeId)
    if (name) employeeNames[employeeId] = name
    const deptName = deptNameById.get(deptIdByEmployeeId.get(employeeId) ?? '')
    if (deptName) employeeDepartments[employeeId] = deptName
  }

  const plan: PerformanceAssignmentSyncPlan = {
    evalCycleId,
    fingerprint: fingerprintSyncWrites(writes),
    ...writes,
    unchangedCount,
    preservedManualCount: manualKeys.size,
    lockedSkipped,
    manualInactive,
    employeeNames,
    employeeDepartments,
  }

  return { plan, unlockedAutoAssignments }
}

// 미리보기: 쓰기 없이 계획과 지문을 돌려준다.
export async function planPerformanceAssignmentSync(
  params: { evalCycleId: string },
  db: AssignmentDbClient = prisma
) {
  await assertCycleExists(db, params.evalCycleId)
  return (await computePerformanceAssignmentSyncPlan(db, params.evalCycleId)).plan
}

export async function syncPerformanceAssignmentsForCycle(
  params: SyncPerformanceAssignmentsParams,
  db: AssignmentDbClient = prisma
) {
  await assertCycleExists(db, params.evalCycleId)

  const computed = await computePerformanceAssignmentSyncPlan(db, params.evalCycleId)
  const { plan } = computed

  // 미리보기에서 본 계획과 지금 계획이 같을 때만 쓴다.
  if (!params.fingerprint || params.fingerprint !== plan.fingerprint) {
    throw new AppError(
      409,
      'ASSIGNMENT_SYNC_PLAN_CHANGED',
      '미리보기 이후 배정 계획이 바뀌었습니다. 미리보기를 다시 확인한 뒤 적용해 주세요.'
    )
  }

  const lockedSkipped = [...plan.lockedSkipped]
  const written: SyncPlanWrites = { create: [], update: [], delete: [], transfer: [] }

  await runAssignmentTransaction(db, async (tx) => {
    // 계획 이후 제출 · 확정된 단계는 쓰지 않는다. 계획 키의 잠금을 트랜잭션 안에서 한 번 더 본다.
    const plannedTargetIds = [
      ...new Set([...plan.create, ...plan.update, ...plan.delete, ...plan.transfer].map((item) => item.targetId)),
    ]
    const lateLocked = plannedTargetIds.length
      ? await tx.evaluation.findMany({
          where: {
            evalCycleId: params.evalCycleId,
            targetId: {
              in: plannedTargetIds,
            },
            status: {
              in: SYNC_LOCKED_STATUSES,
            },
          },
          select: {
            targetId: true,
            evalStage: true,
          },
        })
      : []
    const lateLockedKeys = new Set(lateLocked.map((item) => buildAssignmentKey(item)))
    const isWritable = (item: { targetId: string; evalStage: EvalStage }) => !lateLockedKeys.has(buildAssignmentKey(item))

    const rowUpserts = planRowUpserts(plan)
    for (const assignment of rowUpserts) {
      if (!isWritable(assignment)) continue
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
    }

    for (const entry of plan.transfer) {
      if (!isWritable(entry)) continue
      await tx.evaluation.updateMany({
        where: {
          evalCycleId: params.evalCycleId,
          targetId: entry.targetId,
          evalStage: entry.evalStage,
          status: {
            in: SYNC_IN_PROGRESS_STATUSES,
          },
        },
        data: {
          evaluatorId: entry.afterEvaluatorId,
        },
      })
    }

    const deleteIds = plan.delete.filter(isWritable).map((item) => item.id)
    if (deleteIds.length) {
      await tx.evaluationAssignment.deleteMany({
        where: {
          id: {
            in: deleteIds,
          },
        },
      })
    }

    written.create = plan.create.filter(isWritable)
    written.update = plan.update.filter(isWritable)
    written.delete = plan.delete.filter(isWritable)
    written.transfer = plan.transfer.filter(isWritable)

    for (const item of plan.create.filter((entry) => !isWritable(entry))) {
      lockedSkipped.push({ targetId: item.targetId, evalStage: item.evalStage, storedEvaluatorId: null, defaultEvaluatorId: item.evaluatorId })
    }
    for (const item of plan.update.filter((entry) => !isWritable(entry))) {
      lockedSkipped.push({
        targetId: item.targetId,
        evalStage: item.evalStage,
        storedEvaluatorId: item.beforeEvaluatorId,
        defaultEvaluatorId: item.afterEvaluatorId,
      })
    }
    for (const item of plan.delete.filter((entry) => !isWritable(entry))) {
      lockedSkipped.push({ targetId: item.targetId, evalStage: item.evalStage, storedEvaluatorId: item.beforeEvaluatorId, defaultEvaluatorId: null })
    }
  }, SYNC_TRANSACTION_OPTIONS)

  return {
    fingerprint: plan.fingerprint,
    syncedCount: written.create.length + written.update.length + written.delete.length,
    transferCount: written.transfer.length,
    unchangedCount: plan.unchangedCount,
    preservedManualCount: plan.preservedManualCount,
    removedAutoCount: written.delete.length,
    lockedSkipped,
    manualInactive: plan.manualInactive,
    // 감사 로그에 그대로 들어간다: 쓴 행마다 이전 · 이후 평가자.
    writes: written,
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
