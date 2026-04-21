import {
  EvaluationAssignmentSource,
  EvalStage,
  EvalStatus,
  type Prisma,
  type PrismaClient,
  type SystemRole,
} from '@prisma/client'
import { EVAL_STAGE_LABELS, POSITION_LABELS, AppError } from '@/lib/utils'
import { prisma } from '@/lib/prisma'
import { buildAssignments } from '@/server/admin/employeeHierarchy'

const PERFORMANCE_ASSIGNABLE_STAGES: EvalStage[] = ['FIRST', 'SECOND', 'FINAL', 'CEO_ADJUST']
const EVALUATION_STAGE_ORDER: EvalStage[] = ['SELF', 'FIRST', 'SECOND', 'FINAL', 'CEO_ADJUST']
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
}

type AssignmentDbClient = PrismaClient | Prisma.TransactionClient

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
  fn: (tx: Prisma.TransactionClient) => Promise<T>
) {
  if ('$transaction' in db) {
    return db.$transaction(async (tx) => fn(tx))
  }

  return fn(db)
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
  const ceoId =
    activeEmployees.find((employee) => employee.role === 'ROLE_CEO')?.id ??
    activeEmployees.find((employee) => employee.role === 'ROLE_ADMIN')?.id ??
    null

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

  const persisted = await db.evaluationAssignment.findUnique({
    where: {
      evalCycleId_targetId_evalStage: {
        evalCycleId: params.evalCycleId,
        targetId: params.targetId,
        evalStage: params.evalStage,
      },
    },
    select: {
      evaluatorId: true,
      evaluator: {
        select: {
          status: true,
        },
      },
    },
  })

  if (persisted?.evaluator.status === 'ACTIVE') {
    return persisted.evaluatorId
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

  const [defaults, existingAssignments] = await Promise.all([
    buildDefaultAssignmentRecords(db),
    db.evaluationAssignment.findMany({
      where: {
        evalCycleId: params.evalCycleId,
      },
      select: {
        id: true,
        targetId: true,
        evalStage: true,
        assignmentSource: true,
      },
    }),
  ])

  const defaultMap = new Map(
    defaults.map((item) => [buildAssignmentKey(item), item])
  )

  const manualKeys = new Set(
    existingAssignments
      .filter((item) => item.assignmentSource === EvaluationAssignmentSource.MANUAL)
      .map((item) => buildAssignmentKey(item))
  )

  const autoAssignments = defaults.filter(
    (item) => !manualKeys.has(buildAssignmentKey(item)) && item.evaluatorId
  )

  const staleAutoAssignmentIds = existingAssignments
    .filter(
      (item) =>
        item.assignmentSource === EvaluationAssignmentSource.AUTO &&
        !defaultMap.get(buildAssignmentKey(item))?.evaluatorId
    )
    .map((item) => item.id)

  await runAssignmentTransaction(db, async (tx) => {
    for (const assignment of autoAssignments) {
      await assertEditableAssignmentStage({
        db: tx,
        evalCycleId: params.evalCycleId,
        targetId: assignment.targetId,
        evalStage: assignment.evalStage,
      })

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
  })

  return {
    syncedCount: autoAssignments.length,
    preservedManualCount: manualKeys.size,
    removedAutoCount: staleAutoAssignmentIds.length,
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
