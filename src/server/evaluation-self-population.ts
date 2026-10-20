import { createHash } from 'node:crypto'
import type { Prisma, PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { AppError } from '@/lib/utils'
import { selectEvaluationTargets, type EvaluationTargetCandidate } from '@/lib/evaluation-targets'

// 자기평가 생성(직원 본인 POST 와 관리자 일괄 생성 population)이 같은 규칙을 쓰도록 모은 모듈.

type SelfEvaluationDb = PrismaClient | Prisma.TransactionClient

// 자기평가 항목이 되는 개인 KPI 는 DB status CONFIRMED 전부다. 운영 상태(LOCKED 등)로 다시 거르지 않는다.
export const SELF_EVALUATION_KPI_STATUS = 'CONFIRMED' as const

export function isSelfEvaluationItemKpi(kpi: { status: string }) {
  return kpi.status === SELF_EVALUATION_KPI_STATUS
}

// 자기평가 하나와 항목을 만든다. 상태 IN_PROGRESS · 작성 중 · 평가자 본인.
export async function createSelfEvaluation(
  db: SelfEvaluationDb,
  params: { evalCycleId: string; employeeId: string; evalYear: number }
) {
  const kpis = await db.personalKpi.findMany({
    where: {
      employeeId: params.employeeId,
      evalYear: params.evalYear,
      status: SELF_EVALUATION_KPI_STATUS,
    },
  })
  const itemKpis = kpis
  if (itemKpis.length === 0) {
    throw new AppError(400, 'NO_KPI', '확정된 KPI가 없습니다. 먼저 KPI를 설정하고 확정해주세요.')
  }

  return db.evaluation.create({
    data: {
      evalCycleId: params.evalCycleId,
      targetId: params.employeeId,
      evaluatorId: params.employeeId,
      evalStage: 'SELF',
      status: 'IN_PROGRESS',
      isDraft: true,
      items: {
        create: itemKpis.map((kpi) => ({
          personalKpiId: kpi.id,
        })),
      },
    },
    include: {
      items: {
        include: {
          personalKpi: true,
        },
      },
    },
  })
}

type PopulationEmployeeInput = EvaluationTargetCandidate & {
  id: string
  empName: string
  department?: { deptName?: string | null } | null
}

type PopulationPlanEntryBase = {
  employeeId: string
  employeeName: string
  departmentName: string
}

export type SelfEvaluationPopulationPlan = {
  evalCycleId: string
  cycleStatus: string
  fingerprint: string
  targetCount: number
  create: Array<
    PopulationPlanEntryBase & {
      personalKpiIds: string[]
      kpis: Array<{ id: string; kpiName: string; policyCategory: string | null }>
    }
  >
  skippedExisting: Array<PopulationPlanEntryBase & { evaluationId: string; confirmedKpiCount: number }>
  noConfirmedKpi: PopulationPlanEntryBase[]
}

// 지문은 만들 것(직원 id · KPI id 들)만으로 정한다. 이름 · 부서는 넣지 않는다.
function fingerprintPopulationCreates(create: SelfEvaluationPopulationPlan['create']) {
  const payload = [...create]
    .sort((left, right) => (left.employeeId < right.employeeId ? -1 : left.employeeId > right.employeeId ? 1 : 0))
    .map((item) => [item.employeeId, [...item.personalKpiIds].sort()])
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex')
}

// 계획 계산(쓰기 없음). dry-run 도 이미 읽은 데이터로 이 함수를 쓴다.
export function buildSelfEvaluationPopulationPlan(input: {
  evalCycleId: string
  cycleStatus: string
  departments: Array<{ id: string; deptName: string }>
  employees: PopulationEmployeeInput[]
  personalKpis: Array<{ id: string; employeeId: string; kpiName: string; policyCategory: string | null; status: string }>
  existingSelfEvaluations: Array<{ id: string; targetId: string }>
}): SelfEvaluationPopulationPlan {
  const deptNameById = new Map(input.departments.map((department) => [department.id, department.deptName]))
  const targets = selectEvaluationTargets(input.employees, { orgDepartmentIds: new Set(deptNameById.keys()) })
  const existingByTargetId = new Map(input.existingSelfEvaluations.map((evaluation) => [evaluation.targetId, evaluation.id]))
  const kpisByEmployeeId = new Map<string, SelfEvaluationPopulationPlan['create'][number]['kpis']>()
  for (const kpi of input.personalKpis) {
    if (!isSelfEvaluationItemKpi(kpi)) continue
    const current = kpisByEmployeeId.get(kpi.employeeId) ?? []
    current.push({ id: kpi.id, kpiName: kpi.kpiName, policyCategory: kpi.policyCategory })
    kpisByEmployeeId.set(kpi.employeeId, current)
  }

  const plan: Omit<SelfEvaluationPopulationPlan, 'fingerprint'> = {
    evalCycleId: input.evalCycleId,
    cycleStatus: input.cycleStatus,
    targetCount: targets.length,
    create: [],
    skippedExisting: [],
    noConfirmedKpi: [],
  }

  for (const employee of targets) {
    const base = {
      employeeId: employee.id,
      employeeName: employee.empName,
      departmentName: deptNameById.get(employee.deptId) ?? employee.department?.deptName ?? '소속 조직 미지정',
    }
    const kpis = kpisByEmployeeId.get(employee.id) ?? []
    const existingId = existingByTargetId.get(employee.id)

    if (existingId) {
      plan.skippedExisting.push({ ...base, evaluationId: existingId, confirmedKpiCount: kpis.length })
    } else if (!kpis.length) {
      plan.noConfirmedKpi.push(base)
    } else {
      plan.create.push({ ...base, personalKpiIds: kpis.map((kpi) => kpi.id), kpis })
    }
  }

  return { ...plan, fingerprint: fingerprintPopulationCreates(plan.create) }
}

export async function planSelfEvaluationPopulation(
  params: { evalCycleId: string },
  db: SelfEvaluationDb = prisma
): Promise<SelfEvaluationPopulationPlan> {
  const cycle = await db.evalCycle.findUnique({
    where: { id: params.evalCycleId },
    select: { id: true, orgId: true, evalYear: true, status: true },
  })
  if (!cycle) {
    throw new AppError(404, 'EVAL_CYCLE_NOT_FOUND', '평가 주기를 찾을 수 없습니다.')
  }

  const [departments, employees, existingSelfEvaluations] = await Promise.all([
    db.department.findMany({
      where: { orgId: cycle.orgId },
      select: { id: true, deptName: true },
    }),
    db.employee.findMany({
      where: { status: 'ACTIVE', department: { orgId: cycle.orgId } },
      select: { id: true, empName: true, deptId: true, role: true, status: true, jobTitle: true },
      orderBy: [{ empName: 'asc' }],
    }),
    db.evaluation.findMany({
      where: { evalCycleId: cycle.id, evalStage: 'SELF' },
      select: { id: true, targetId: true },
    }),
  ])

  const targetIds = selectEvaluationTargets(employees, {
    orgDepartmentIds: new Set(departments.map((department) => department.id)),
  }).map((employee) => employee.id)
  const personalKpis = targetIds.length
    ? await db.personalKpi.findMany({
        where: {
          evalYear: cycle.evalYear,
          status: SELF_EVALUATION_KPI_STATUS,
          employeeId: { in: targetIds },
        },
        select: { id: true, employeeId: true, kpiName: true, policyCategory: true, status: true },
        orderBy: [{ employeeId: 'asc' }, { createdAt: 'asc' }],
      })
    : []

  return buildSelfEvaluationPopulationPlan({
    evalCycleId: cycle.id,
    cycleStatus: cycle.status,
    departments,
    employees,
    personalKpis,
    existingSelfEvaluations,
  })
}

// 일괄 생성 트랜잭션 상한. 대상 289명(활성 직원 기준) × 생성 1건당 3쿼리(자기평가 존재 확인 · KPI 조회 ·
// 평가+항목 생성) ≈ 867쿼리, 쿼리당 50ms 면 약 43초. 항목 중첩 생성 여유를 두어 120초.
const POPULATION_TRANSACTION_OPTIONS = { timeout: 120_000, maxWait: 10_000 }

async function runPopulationTransaction<T>(db: SelfEvaluationDb, fn: (tx: Prisma.TransactionClient) => Promise<T>) {
  if ('$transaction' in db) {
    return db.$transaction(async (tx) => fn(tx), POPULATION_TRANSACTION_OPTIONS)
  }
  return fn(db)
}

export async function runSelfEvaluationPopulation(
  params: { evalCycleId: string; fingerprint?: string | null },
  db: SelfEvaluationDb = prisma
) {
  const cycle = await db.evalCycle.findUnique({
    where: { id: params.evalCycleId },
    select: { id: true, evalYear: true, status: true },
  })
  if (!cycle) {
    throw new AppError(404, 'EVAL_CYCLE_NOT_FOUND', '평가 주기를 찾을 수 없습니다.')
  }
  if (cycle.status !== 'SELF_EVAL') {
    throw new AppError(400, 'INVALID_CYCLE_STATUS', '자기평가 기간이 아닙니다.')
  }

  // 미리보기에서 본 계획과 지금 계획이 같을 때만 만든다.
  const plan = await planSelfEvaluationPopulation({ evalCycleId: params.evalCycleId }, db)
  if (!params.fingerprint || params.fingerprint !== plan.fingerprint) {
    throw new AppError(
      409,
      'SELF_EVALUATION_POPULATION_PLAN_CHANGED',
      '미리보기 이후 자기평가 생성 대상이 바뀌었습니다. 미리보기를 다시 확인한 뒤 실행해 주세요.'
    )
  }

  const createdEmployeeIds: string[] = []
  const skippedDuringRun: string[] = []
  let createdItemCount = 0

  await runPopulationTransaction(db, async (tx) => {
    for (const entry of plan.create) {
      // 계획 뒤에 자기평가가 생긴 대상은 건너뛴다. 다시 돌려도 결과가 같다.
      const existing = await tx.evaluation.findUnique({
        where: {
          evalCycleId_targetId_evalStage: {
            evalCycleId: cycle.id,
            targetId: entry.employeeId,
            evalStage: 'SELF',
          },
        },
        select: { id: true },
      })
      if (existing) {
        skippedDuringRun.push(entry.employeeId)
        continue
      }

      const evaluation = await createSelfEvaluation(tx, {
        evalCycleId: cycle.id,
        employeeId: entry.employeeId,
        evalYear: cycle.evalYear,
      })
      createdEmployeeIds.push(entry.employeeId)
      createdItemCount += evaluation.items.length
    }
  })

  return {
    fingerprint: plan.fingerprint,
    createdCount: createdEmployeeIds.length,
    createdItemCount,
    skippedExistingCount: plan.skippedExisting.length + skippedDuringRun.length,
    noConfirmedKpiCount: plan.noConfirmedKpi.length,
    createdEmployeeIds,
    skippedExistingEmployeeIds: [...plan.skippedExisting.map((item) => item.employeeId), ...skippedDuringRun],
    noConfirmedKpiEmployeeIds: plan.noConfirmedKpi.map((item) => item.employeeId),
  }
}
