import './register-path-aliases'
import assert from 'node:assert/strict'
import Module from 'node:module'

process.env.DATABASE_URL ||= 'postgresql://postgres:password@localhost:5432/kpi_pms'

// 한 건이 실패해도 나머지 케이스 결과를 함께 보도록 끝까지 돌고, 실패가 있으면 exit 1 로 끝낸다.
async function run(name: string, fn: () => Promise<void> | void) {
  try {
    await fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}

const now = new Date('2026-10-20T00:00:00.000Z')

const departments = [
  { id: 'div-1', deptName: '본부', parentDeptId: null, orgId: 'org-1', leaderEmployeeId: 'emp-ceo', excludeLeaderFromEvaluatorAutoAssign: false },
  { id: 'team-1', deptName: '영업팀', parentDeptId: 'div-1', orgId: 'org-1', leaderEmployeeId: null, excludeLeaderFromEvaluatorAutoAssign: false },
  { id: 'team-2', deptName: '지원팀', parentDeptId: 'div-1', orgId: 'org-1', leaderEmployeeId: null, excludeLeaderFromEvaluatorAutoAssign: false },
  { id: 'other-div', deptName: '다른 회사', parentDeptId: null, orgId: 'org-2', leaderEmployeeId: null, excludeLeaderFromEvaluatorAutoAssign: false },
]

function person(id: string, deptId: string, role: string, status = 'ACTIVE', jobTitle: string | null = null) {
  const department = departments.find((item) => item.id === deptId)!
  return {
    id,
    empId: id,
    empName: `${id}-이름`,
    gwsEmail: `${id}@example.com`,
    deptId,
    role,
    position: 'MEMBER',
    status,
    jobTitle,
    managerId: null,
    teamLeaderId: null,
    sectionChiefId: null,
    divisionHeadId: null,
    joinDate: now,
    createdAt: now,
    department: { id: department.id, deptName: department.deptName, parentDeptId: department.parentDeptId, orgId: department.orgId },
  }
}

const employees = [
  person('emp-a', 'team-1', 'ROLE_MEMBER'),
  person('emp-b', 'team-2', 'ROLE_MEMBER'),
  person('emp-c', 'team-1', 'ROLE_MEMBER'),
  person('emp-ceo', 'div-1', 'ROLE_CEO'),
  person('emp-gone', 'team-1', 'ROLE_MEMBER', 'RESIGNED'),
  person('emp-other', 'other-div', 'ROLE_MEMBER'),
]

function kpi(id: string, employeeId: string, status: string, policyCategory: string | null = 'ORG_GOAL') {
  return {
    id,
    employeeId,
    evalYear: 2026,
    kpiName: `${id}-이름`,
    definition: null,
    formula: null,
    policyCategory,
    status,
    weight: 50,
    targetValue: null,
    targetValueT: null,
    targetValueE: null,
    linkedOrgKpiId: null,
    linkedOrgKpi: null,
    monthlyRecords: [],
  }
}

// kpi-a2 는 DB status CONFIRMED 이고 잠금 로그가 있다(운영 상태 LOCKED).
const personalKpis = [
  kpi('kpi-a1', 'emp-a', 'CONFIRMED'),
  kpi('kpi-a2', 'emp-a', 'CONFIRMED', null),
  kpi('kpi-a3', 'emp-a', 'DRAFT'),
  kpi('kpi-b1', 'emp-b', 'CONFIRMED'),
  kpi('kpi-c1', 'emp-c', 'DRAFT'),
  kpi('kpi-ceo1', 'emp-ceo', 'CONFIRMED'),
  kpi('kpi-gone1', 'emp-gone', 'CONFIRMED'),
  kpi('kpi-other1', 'emp-other', 'CONFIRMED'),
]

const lockLogs = [
  { id: 'log-1', entityType: 'PersonalKpi', entityId: 'kpi-a2', action: 'PERSONAL_KPI_LOCKED', timestamp: new Date('2026-04-01T00:00:00.000Z'), newValue: null, oldValue: null },
]

type Created = { data: Record<string, unknown> & { items: { create: Array<{ personalKpiId: string }> } } }

function matchesWhere(record: Record<string, unknown>, where: Record<string, unknown> | undefined): boolean {
  if (!where) return true
  return Object.entries(where).every(([field, condition]) => {
    if (condition === undefined) return true
    const value = record[field]
    if (condition && typeof condition === 'object' && !(condition instanceof Date)) {
      const c = condition as { in?: unknown[]; not?: unknown; orgId?: string }
      if (c.in) return c.in.includes(value)
      if ('not' in c) return value !== c.not
      if (field === 'department' && c.orgId) return (record.department as { orgId?: string } | undefined)?.orgId === c.orgId
      return true
    }
    return value === condition
  })
}

function createDb(params: {
  cycleStatus?: string
  existingSelf?: Array<{ id: string; targetId: string }>
  onTransactionStart?: () => void
  // 잠금 로그를 남길 KPI id. 기본은 kpi-a2 하나.
  lockedKpiIds?: string[]
} = {}) {
  const logs = (params.lockedKpiIds ?? ['kpi-a2']).map((kpiId, index) => ({ ...lockLogs[0], id: `log-${index + 1}`, entityId: kpiId }))
  const evaluations: Array<Record<string, unknown>> = (params.existingSelf ?? []).map((item) => ({
    ...item,
    evalCycleId: 'cycle-1',
    evalStage: 'SELF',
    evaluatorId: item.targetId,
    status: 'IN_PROGRESS',
    items: [],
  }))
  const created: Created[] = []
  const writes = { count: 0 }
  const cycle = {
    id: 'cycle-1',
    orgId: 'org-1',
    cycleName: '2026 평가',
    evalYear: 2026,
    status: params.cycleStatus ?? 'SELF_EVAL',
    performanceDesignConfig: null,
  }

  const db = {
    evalCycle: { findUnique: async () => cycle },
    department: {
      findMany: async (args?: { where?: { orgId?: string } }) =>
        departments.filter((item) => !args?.where?.orgId || item.orgId === args.where.orgId),
    },
    employee: {
      findMany: async (args?: { where?: Record<string, unknown> }) =>
        employees.filter((item) => matchesWhere(item as never, args?.where)),
    },
    personalKpi: {
      findMany: async (args?: { where?: Record<string, unknown> }) =>
        personalKpis.filter((item) => matchesWhere(item as never, args?.where)),
    },
    auditLog: {
      findMany: async (args?: { where?: { entityId?: { in?: string[] } | string } }) => {
        const entityId = args?.where?.entityId
        if (!entityId) return logs
        if (typeof entityId === 'string') return logs.filter((log) => log.entityId === entityId)
        return logs.filter((log) => entityId.in?.includes(log.entityId))
      },
    },
    evaluation: {
      findMany: async (args?: { where?: Record<string, unknown> }) =>
        evaluations.filter((item) => matchesWhere(item, args?.where)),
      findUnique: async (args: { where: { evalCycleId_targetId_evalStage: { targetId: string; evalStage: string } } }) =>
        evaluations.find(
          (item) =>
            item.targetId === args.where.evalCycleId_targetId_evalStage.targetId &&
            item.evalStage === args.where.evalCycleId_targetId_evalStage.evalStage
        ) ?? null,
      create: async (args: Created) => {
        writes.count += 1
        created.push(args)
        const row = { id: `eval-new-${created.length}`, ...args.data, items: args.data.items.create }
        evaluations.push(row)
        return row
      },
    },
    evaluationAssignment: { findMany: async () => [] },
    orgKpi: { findMany: async () => [] },
    evaluationGradePolicy: { findMany: async () => [] },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      params.onTransactionStart?.()
      const snapshot = evaluations.length
      const createdSnapshot = created.length
      try {
        return await fn(db)
      } catch (error) {
        evaluations.length = snapshot
        created.length = createdSnapshot
        throw error
      }
    },
  }
  return { db: db as never, created, writes, evaluations }
}

function stubModule(relativePath: string, exports: Record<string, unknown>) {
  const filename = require.resolve(relativePath)
  const stub = new Module(filename)
  stub.filename = filename
  stub.loaded = true
  stub.exports = exports
  require.cache[filename] = stub
}

type Plan = {
  fingerprint: string
  create: Array<{ employeeId: string; personalKpiIds: string[] }>
  skippedExisting: Array<{ employeeId: string }>
  noConfirmedKpi: Array<{ employeeId: string }>
}

async function main() {
  // POST 라우트는 실제로 실행한다. 세션 · 인증 설정만 스텁이고, DB 는 prisma 클라이언트 메서드를 바꿔 끼운다.
  let sessionUserId = 'emp-a'
  stubModule('next-auth', { getServerSession: async () => ({ user: { id: sessionUserId, role: 'ROLE_MEMBER' } }) })
  stubModule('../src/lib/auth', { authOptions: {} })

  // 모듈이 없을 때도(수정 전) 나머지 케이스가 돌도록 경로 변수로 불러온다.
  const populationModulePath = '../src/server/evaluation-self-population'
  const population = (await import(populationModulePath).catch(() => null)) as null | {
    planSelfEvaluationPopulation: (params: { evalCycleId: string }, db: never) => Promise<Plan>
    runSelfEvaluationPopulation: (
      params: { evalCycleId: string; fingerprint?: string | null },
      db: never
    ) => Promise<{ createdEmployeeIds: string[]; createdCount: number; skippedExistingCount: number }>
  }
  const requirePopulation = () => {
    assert.ok(population, 'src/server/evaluation-self-population 모듈이 없다')
    return population!
  }

  const { prisma } = await import('../src/lib/prisma')
  const prismaAny = prisma as unknown as Record<string, Record<string, unknown>>
  const postRoute = await import('../src/app/api/evaluation/route')

  // 실제 prisma 클라이언트의 메서드를 스텁 DB 로 바꿔 POST 를 돌린다.
  async function postAs(employeeId: string, fake: ReturnType<typeof createDb>) {
    sessionUserId = employeeId
    const stub = fake.db as unknown as Record<string, Record<string, unknown>>
    const saved: Array<[string, string, unknown]> = []
    for (const model of ['evalCycle', 'evaluation', 'personalKpi', 'auditLog']) {
      for (const method of Object.keys(stub[model])) {
        saved.push([model, method, prismaAny[model][method]])
        prismaAny[model][method] = stub[model][method]
      }
    }
    try {
      const response = await postRoute.POST(
        new Request('http://localhost/api/evaluation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ evalCycleId: 'cycle-1' }),
        })
      )
      return { status: response.status, json: (await response.json()) as { success: boolean; error?: { code?: string } } }
    } finally {
      for (const [model, method, original] of saved) prismaAny[model][method] = original
    }
  }

  const itemKpiIds = (created: Created) => created.data.items.create.map((item) => item.personalKpiId).sort()
  const withoutTarget = (created: Created) => {
    const { items, ...rest } = created.data
    void items
    return { ...rest, targetId: '*', evaluatorId: '*' }
  }

  await run('ⓐ population 으로 만든 자기평가 = 같은 직원이 POST 로 만든 자기평가(필드 · 항목 구성)', async () => {
    const service = requirePopulation()
    const viaPost = createDb()
    const posted = await postAs('emp-a', viaPost)
    assert.equal(posted.status, 200)

    const viaPopulation = createDb()
    const plan = await service.planSelfEvaluationPopulation({ evalCycleId: 'cycle-1' }, viaPopulation.db)
    await service.runSelfEvaluationPopulation({ evalCycleId: 'cycle-1', fingerprint: plan.fingerprint }, viaPopulation.db)
    const populated = viaPopulation.created.find((item) => item.data.targetId === 'emp-a')!

    assert.deepEqual(withoutTarget(populated), withoutTarget(viaPost.created[0]))
    assert.deepEqual(populated.data.targetId, viaPost.created[0].data.targetId)
    assert.deepEqual(populated.data.evaluatorId, viaPost.created[0].data.evaluatorId)
    assert.deepEqual(itemKpiIds(populated), itemKpiIds(viaPost.created[0]))
  })

  await run('ⓑ 항목에 LOCKED KPI 가 들어간다(DB status CONFIRMED)', async () => {
    const service = requirePopulation()
    const fake = createDb()
    const plan = await service.planSelfEvaluationPopulation({ evalCycleId: 'cycle-1' }, fake.db)
    await service.runSelfEvaluationPopulation({ evalCycleId: 'cycle-1', fingerprint: plan.fingerprint }, fake.db)
    const created = fake.created.find((item) => item.data.targetId === 'emp-a')!
    assert.deepEqual(itemKpiIds(created), ['kpi-a1', 'kpi-a2'])
    assert.deepEqual(plan.create.find((item) => item.employeeId === 'emp-a')?.personalKpiIds.sort(), ['kpi-a1', 'kpi-a2'])
  })

  await run('ⓒ 대표 · 비활성 · 다른 조직 직원은 대상이 아니다. routing readiness 의 대상과 같은 집합이다', async () => {
    const service = requirePopulation()
    const fake = createDb()
    const plan = await service.planSelfEvaluationPopulation({ evalCycleId: 'cycle-1' }, fake.db)
    const targets = [...plan.create, ...plan.skippedExisting, ...plan.noConfirmedKpi].map((item) => item.employeeId).sort()
    assert.deepEqual(targets, ['emp-a', 'emp-b', 'emp-c'])

    const { getEvaluation2026EvaluatorRoutingReadiness } = await import('../src/server/evaluation-2026-evaluator-routing-readiness')
    const readiness = await getEvaluation2026EvaluatorRoutingReadiness({ db: fake.db, evalCycleId: 'cycle-1' })
    assert.deepEqual(readiness.rows.map((row) => row.employeeId).sort(), targets)
  })

  await run('ⓓ 미리보기는 아무것도 쓰지 않고, 실행이 만든 것 = 미리보기 create 목록', async () => {
    const service = requirePopulation()
    const fake = createDb({ existingSelf: [{ id: 'eval-b', targetId: 'emp-b' }] })
    const plan = await service.planSelfEvaluationPopulation({ evalCycleId: 'cycle-1' }, fake.db)
    assert.equal(fake.writes.count, 0)
    await service.runSelfEvaluationPopulation({ evalCycleId: 'cycle-1', fingerprint: plan.fingerprint }, fake.db)
    assert.deepEqual(
      fake.created.map((item) => [item.data.targetId, itemKpiIds(item)]).sort(),
      plan.create.map((item) => [item.employeeId, [...item.personalKpiIds].sort()]).sort()
    )
  })

  await run('ⓔ 이미 자기평가가 있는 대상은 건너뛰고, 두 번 실행해도 결과가 같다', async () => {
    const service = requirePopulation()
    const fake = createDb({ existingSelf: [{ id: 'eval-b', targetId: 'emp-b' }] })
    const plan = await service.planSelfEvaluationPopulation({ evalCycleId: 'cycle-1' }, fake.db)
    assert.deepEqual(plan.skippedExisting.map((item) => item.employeeId), ['emp-b'])
    await service.runSelfEvaluationPopulation({ evalCycleId: 'cycle-1', fingerprint: plan.fingerprint }, fake.db)
    const afterFirst = JSON.stringify(fake.evaluations)

    const secondPlan = await service.planSelfEvaluationPopulation({ evalCycleId: 'cycle-1' }, fake.db)
    assert.equal(secondPlan.create.length, 0)
    const second = await service.runSelfEvaluationPopulation({ evalCycleId: 'cycle-1', fingerprint: secondPlan.fingerprint }, fake.db)
    assert.equal(second.createdCount, 0)
    assert.equal(JSON.stringify(fake.evaluations), afterFirst)

    // 계획 뒤, 실행 트랜잭션 전에 자기평가가 생긴 대상도 건너뛴다.
    let createLate = false
    const late = createDb({
      onTransactionStart: () => {
        if (createLate) late.evaluations.push({ id: 'eval-late', evalCycleId: 'cycle-1', targetId: 'emp-a', evalStage: 'SELF', items: [] })
      },
    })
    const latePlan = await service.planSelfEvaluationPopulation({ evalCycleId: 'cycle-1' }, late.db)
    createLate = true
    const lateResult = await service.runSelfEvaluationPopulation({ evalCycleId: 'cycle-1', fingerprint: latePlan.fingerprint }, late.db)
    assert.equal(late.created.some((item) => item.data.targetId === 'emp-a'), false)
    assert.equal(lateResult.createdEmployeeIds.includes('emp-a'), false)
  })

  await run('ⓕ 사이클이 SELF_EVAL 이 아니면 실행하지 않는다. 지문이 다르거나 없으면 409, 아무것도 쓰지 않는다', async () => {
    const service = requirePopulation()
    const notSelf = createDb({ cycleStatus: 'KPI_SETTING' })
    const notSelfPlan = await service.planSelfEvaluationPopulation({ evalCycleId: 'cycle-1' }, notSelf.db)
    await assert.rejects(
      service.runSelfEvaluationPopulation({ evalCycleId: 'cycle-1', fingerprint: notSelfPlan.fingerprint }, notSelf.db),
      (error: unknown) => (error as { statusCode?: number }).statusCode === 400
    )
    assert.equal(notSelf.writes.count, 0)

    for (const fingerprint of ['not-the-plan', null, undefined]) {
      const fake = createDb()
      await assert.rejects(
        service.runSelfEvaluationPopulation({ evalCycleId: 'cycle-1', fingerprint }, fake.db),
        (error: unknown) => (error as { statusCode?: number }).statusCode === 409
      )
      assert.equal(fake.writes.count, 0)
    }
  })

  await run('ⓖ dry-run 의 생성 예정 수 = 계획의 create 수', async () => {
    const service = requirePopulation()
    const fake = createDb({ existingSelf: [{ id: 'eval-b', targetId: 'emp-b' }] })
    const plan = await service.planSelfEvaluationPopulation({ evalCycleId: 'cycle-1' }, fake.db)
    const { getEvaluation2026ReadinessPopulationDryRun } = await import('../src/server/evaluation-2026-readiness-population')
    const dryRun = await getEvaluation2026ReadinessPopulationDryRun({ db: fake.db, evalCycleId: 'cycle-1', env: {} as NodeJS.ProcessEnv })
    assert.equal(dryRun.wouldCreateSelfEvaluationCount, plan.create.length)
    assert.deepEqual(
      dryRun.wouldCreateSelfEvaluations.map((item) => [item.employeeId, item.wouldCreateItemCount]),
      plan.create.map((item) => [item.employeeId, item.personalKpiIds.length])
    )
    assert.deepEqual(dryRun.existingSelfEvaluationsSkipped.map((item) => item.employeeId), plan.skippedExisting.map((item) => item.employeeId))
    assert.deepEqual(dryRun.employeesMissingConfirmedPersonalKpi.map((item) => item.employeeId), plan.noConfirmedKpi.map((item) => item.employeeId))
  })

  await run('ⓗ POST 의 기존 동작(SELF_EVAL 아님 400 · 이미 있음 409 · 생성 결과)이 그대로다', async () => {
    const notSelf = await postAs('emp-a', createDb({ cycleStatus: 'KPI_SETTING' }))
    assert.equal(notSelf.status, 400)
    assert.equal(notSelf.json.error?.code, 'INVALID_CYCLE_STATUS')

    const existing = await postAs('emp-b', createDb({ existingSelf: [{ id: 'eval-b', targetId: 'emp-b' }] }))
    assert.equal(existing.status, 409)
    assert.equal(existing.json.error?.code, 'ALREADY_EXISTS')

    const noKpi = await postAs('emp-c', createDb())
    assert.equal(noKpi.status, 400)
    assert.equal(noKpi.json.error?.code, 'NO_KPI')

    const fake = createDb()
    const ok = await postAs('emp-a', fake)
    assert.equal(ok.status, 200)
    assert.equal(fake.created.length, 1)
    const data = fake.created[0].data
    assert.equal(data.targetId, 'emp-a')
    assert.equal(data.evaluatorId, 'emp-a')
    assert.equal(data.evalStage, 'SELF')
    assert.equal(data.status, 'IN_PROGRESS')
    assert.equal(data.isDraft, true)
    assert.deepEqual(itemKpiIds(fake.created[0]), ['kpi-a1', 'kpi-a2'])
  })

  await run('ⓘ dry-run 의 확정 집계가 LOCKED KPI 를 포함한다', async () => {
    // emp-a 의 확정 KPI 둘이 모두 잠겼다(운영 상태 LOCKED, DB status CONFIRMED).
    const fake = createDb({ lockedKpiIds: ['kpi-a1', 'kpi-a2'] })
    const { getEvaluation2026ReadinessPopulationDryRun } = await import('../src/server/evaluation-2026-readiness-population')
    const dryRun = await getEvaluation2026ReadinessPopulationDryRun({ db: fake.db, evalCycleId: 'cycle-1', env: {} as NodeJS.ProcessEnv })

    // 사이클 조직의 ACTIVE 직원 중 DB status CONFIRMED KPI 가 있는 사람: emp-a · emp-b · emp-ceo.
    const expectedConfirmedEmployeeCount = 3
    const row = dryRun.mboSetupCoverage.monitoring.employeeRows.find((item) => item.employeeId === 'emp-a')
    assert.equal(row?.confirmedPersonalKpiCount, 2)
    assert.equal(dryRun.scorePolicyReadiness.summary.employeesWithConfirmedPersonalKpiCount, expectedConfirmedEmployeeCount)
    assert.equal(
      dryRun.mboSetupCoverage.divisionCoverage.find((item) => item.divisionId === 'div-1')?.confirmedPersonalKpiEmployeeCount,
      expectedConfirmedEmployeeCount
    )
    assert.equal(
      dryRun.divisionSalesMappingCoverage.divisions.find((item) => item.divisionId === 'div-1')?.confirmedPersonalKpiEmployeeCount,
      expectedConfirmedEmployeeCount
    )
  })

  console.log('Evaluation self population tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
