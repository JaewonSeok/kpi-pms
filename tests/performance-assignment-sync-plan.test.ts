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

type Stage = 'FIRST' | 'SECOND' | 'FINAL' | 'CEO_ADJUST'
type Role = 'ROLE_MEMBER' | 'ROLE_TEAM_LEADER' | 'ROLE_SECTION_CHIEF' | 'ROLE_DIV_HEAD' | 'ROLE_CEO'
type Source = 'AUTO' | 'MANUAL'
type EvalStatus = 'PENDING' | 'IN_PROGRESS' | 'REJECTED' | 'SUBMITTED' | 'CONFIRMED'

type AssignmentRow = { id: string; evalCycleId: string; targetId: string; evalStage: Stage; evaluatorId: string; assignmentSource: Source }
type EvaluationRow = { id: string; evalCycleId: string; targetId: string; evalStage: Stage; evaluatorId: string; status: EvalStatus }
type State = { rows: AssignmentRow[]; evaluations: EvaluationRow[] }

const CYCLE = 'cycle-1'
const now = new Date('2026-10-20T00:00:00.000Z')

const departments = [
  { id: 'div-1', deptName: '본부', parentDeptId: null, leaderEmployeeId: 'emp-div', excludeLeaderFromEvaluatorAutoAssign: false },
  { id: 'sec-1', deptName: '실', parentDeptId: 'div-1', leaderEmployeeId: 'emp-sec', excludeLeaderFromEvaluatorAutoAssign: false },
  { id: 'team-1', deptName: '팀', parentDeptId: 'sec-1', leaderEmployeeId: 'emp-tl', excludeLeaderFromEvaluatorAutoAssign: false },
]

function person(id: string, deptId: string, role: Role, status = 'ACTIVE') {
  return {
    id,
    empId: id,
    empName: `${id}-name`,
    deptId,
    role,
    position: 'MEMBER',
    status,
    jobTitle: null,
    joinDate: now,
    createdAt: now,
    teamLeaderId: null,
    sectionChiefId: null,
    divisionHeadId: null,
  }
}

const employees = [
  person('emp-div', 'div-1', 'ROLE_DIV_HEAD'),
  person('emp-sec', 'sec-1', 'ROLE_SECTION_CHIEF'),
  person('emp-tl', 'team-1', 'ROLE_TEAM_LEADER'),
  person('emp-ceo', 'div-1', 'ROLE_CEO'),
  person('emp-old', 'div-1', 'ROLE_MEMBER'),
  person('emp-gone', 'div-1', 'ROLE_TEAM_LEADER', 'RESIGNED'),
  person('emp-a', 'team-1', 'ROLE_MEMBER'),
  person('emp-b', 'team-1', 'ROLE_MEMBER'),
]
const statusById = new Map(employees.map((employee) => [employee.id, employee.status]))
const key = (targetId: string, evalStage: string) => `${targetId}:${evalStage}`

// 쓰기를 모두 기록하는 스텁. 실제 DB 처럼 트랜잭션이 실패하면 변경을 되돌린다.
function createDb(params: {
  rows: Omit<AssignmentRow, 'id' | 'evalCycleId'>[]
  evaluations: Omit<EvaluationRow, 'id' | 'evalCycleId'>[]
  onTransactionStart?: (state: State) => void
}) {
  const state: State = {
    rows: params.rows.map((row, index) => ({ id: `row-${index + 1}`, evalCycleId: CYCLE, ...row })),
    evaluations: params.evaluations.map((evaluation, index) => ({ id: `eval-${index + 1}`, evalCycleId: CYCLE, ...evaluation })),
  }
  const writes = { upsertKeys: [] as string[], deletedIds: [] as string[], transferKeys: [] as string[] }
  let nextRowId = state.rows.length + 1

  const byStageKey = (where: { evalCycleId_targetId_evalStage: { targetId: string; evalStage: string } }) =>
    key(where.evalCycleId_targetId_evalStage.targetId, where.evalCycleId_targetId_evalStage.evalStage)

  const db = {
    evalCycle: { findUnique: async () => ({ id: CYCLE }) },
    department: { findMany: async () => departments },
    employee: { findMany: async () => employees },
    evaluationAssignment: {
      findMany: async () =>
        state.rows.map((row) => ({ ...row, evaluator: { status: statusById.get(row.evaluatorId) ?? 'RESIGNED' } })),
      upsert: async (args: {
        where: { evalCycleId_targetId_evalStage: { targetId: string; evalStage: string } }
        create: Omit<AssignmentRow, 'id'>
        update: { evaluatorId: string; assignmentSource: Source }
      }) => {
        writes.upsertKeys.push(byStageKey(args.where))
        const existing = state.rows.find((row) => key(row.targetId, row.evalStage) === byStageKey(args.where))
        if (existing) {
          existing.evaluatorId = args.update.evaluatorId
          existing.assignmentSource = args.update.assignmentSource
          return existing
        }
        const created = { id: `row-${nextRowId++}`, ...args.create } as AssignmentRow
        state.rows.push(created)
        return created
      },
      deleteMany: async (args: { where: { id: { in: string[] } } }) => {
        const before = state.rows.length
        writes.deletedIds.push(...state.rows.filter((row) => args.where.id.in.includes(row.id)).map((row) => row.id))
        state.rows = state.rows.filter((row) => !args.where.id.in.includes(row.id))
        return { count: before - state.rows.length }
      },
    },
    evaluation: {
      findUnique: async (args: { where: { evalCycleId_targetId_evalStage: { targetId: string; evalStage: string } } }) =>
        state.evaluations.find((evaluation) => key(evaluation.targetId, evaluation.evalStage) === byStageKey(args.where)) ?? null,
      findMany: async (args?: { where?: { status?: { in?: string[] } } }) => {
        const statuses = args?.where?.status?.in
        return state.evaluations.filter((evaluation) => !statuses || statuses.includes(evaluation.status))
      },
      updateMany: async (args: {
        where: { targetId: string; evalStage: string; status: { in: string[] } }
        data: { evaluatorId: string }
      }) => {
        let count = 0
        for (const evaluation of state.evaluations) {
          if (
            evaluation.targetId === args.where.targetId &&
            evaluation.evalStage === args.where.evalStage &&
            args.where.status.in.includes(evaluation.status)
          ) {
            evaluation.evaluatorId = args.data.evaluatorId
            count += 1
          }
        }
        if (count > 0) writes.transferKeys.push(key(args.where.targetId, args.where.evalStage))
        return { count }
      },
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      params.onTransactionStart?.(state)
      const snapshot = JSON.stringify(state)
      try {
        return await fn(db)
      } catch (error) {
        const restored = JSON.parse(snapshot) as State
        state.rows = restored.rows
        state.evaluations = restored.evaluations
        throw error
      }
    },
  }

  return { db: db as never, state, writes }
}

// emp-a FIRST: 행은 이미 기본 평가자, 진행 중 평가만 예전 평가자 → transfer 만
// emp-a SECOND: 예전 평가자 행 + 진행 중 평가 → update + transfer
// emp-a FINAL: 행 없음 → create
// emp-tl FIRST: 기본 평가자 없음, 진행 중 평가 있음 → delete(진행 중 표시)
// emp-b FIRST: 퇴사자 수동 지정 + 진행 중 평가 → 손대지 않음, manualInactive
const baseFixture = () => ({
  rows: [
    { targetId: 'emp-a', evalStage: 'FIRST' as Stage, evaluatorId: 'emp-tl', assignmentSource: 'AUTO' as Source },
    { targetId: 'emp-a', evalStage: 'SECOND' as Stage, evaluatorId: 'emp-old', assignmentSource: 'AUTO' as Source },
    { targetId: 'emp-tl', evalStage: 'FIRST' as Stage, evaluatorId: 'emp-old', assignmentSource: 'AUTO' as Source },
    { targetId: 'emp-b', evalStage: 'FIRST' as Stage, evaluatorId: 'emp-gone', assignmentSource: 'MANUAL' as Source },
  ],
  evaluations: [
    { targetId: 'emp-a', evalStage: 'FIRST' as Stage, evaluatorId: 'emp-old', status: 'IN_PROGRESS' as EvalStatus },
    { targetId: 'emp-a', evalStage: 'SECOND' as Stage, evaluatorId: 'emp-old', status: 'IN_PROGRESS' as EvalStatus },
    { targetId: 'emp-tl', evalStage: 'FIRST' as Stage, evaluatorId: 'emp-old', status: 'PENDING' as EvalStatus },
    { targetId: 'emp-b', evalStage: 'FIRST' as Stage, evaluatorId: 'emp-gone', status: 'IN_PROGRESS' as EvalStatus },
  ],
})

type PlanEntry = { id: string; targetId: string; evalStage: string }
type Plan = {
  fingerprint: string
  create: Array<PlanEntry & { evaluatorId: string }>
  update: Array<PlanEntry & { beforeEvaluatorId: string; afterEvaluatorId: string }>
  delete: Array<PlanEntry & { beforeEvaluatorId: string; hasInProgressEvaluation: boolean }>
  transfer: Array<PlanEntry & { beforeEvaluatorId: string; afterEvaluatorId: string }>
}

function stubModule(relativePath: string, exports: Record<string, unknown>) {
  const filename = require.resolve(relativePath)
  const stub = new Module(filename)
  stub.filename = filename
  stub.loaded = true
  stub.exports = exports
  require.cache[filename] = stub
}

async function main() {
  const service = await import('../src/server/evaluation-performance-assignments')
  const plan = (db: never) =>
    (service as unknown as { planPerformanceAssignmentSync: (p: { evalCycleId: string }, db: never) => Promise<Plan> })
      .planPerformanceAssignmentSync({ evalCycleId: CYCLE }, db)
  const sync = (db: never, fingerprint?: string | null) =>
    service.syncPerformanceAssignmentsForCycle(
      { actorId: 'emp-admin', evalCycleId: CYCLE, fingerprint } as never,
      db
    ) as Promise<Record<string, unknown>>

  // 라우트를 실제로 실행한다. 인증 · 감사 로그 · 화면 데이터만 스텁으로 바꾸고, sync 는 스텁 DB 로 돈다.
  const auditLogs: Array<{ action: string; newValue: Record<string, unknown> }> = []
  let routeDb: never = createDb(baseFixture()).db
  stubModule('../src/server/auth/authorize', {
    authorizeMenu: async () => ({ user: { id: 'emp-admin', role: 'ROLE_ADMIN', name: 'Admin' } }),
  })
  stubModule('../src/lib/audit', {
    createAuditLog: async (entry: { action: string; newValue: Record<string, unknown> }) => {
      auditLogs.push(entry)
    },
    getClientInfo: () => ({}),
    resolveAuditActor: () => ({ userId: 'emp-admin' }),
  })
  const servicePath = require.resolve('../src/server/evaluation-performance-assignments')
  const realService = require.cache[servicePath]!.exports as Record<string, (...args: unknown[]) => unknown>
  require.cache[servicePath]!.exports = {
    ...realService,
    planPerformanceAssignmentSync: (params: unknown) => realService.planPerformanceAssignmentSync(params, routeDb),
    syncPerformanceAssignmentsForCycle: (params: unknown) => realService.syncPerformanceAssignmentsForCycle(params, routeDb),
    getPerformanceAssignmentPageData: async () => ({ state: 'ready' }),
  }
  const route = await import('../src/app/api/admin/performance-assignments/route')
  const post = async (body: Record<string, unknown>) => {
    const response = await route.POST(
      new Request('http://localhost/api/admin/performance-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    )
    return { status: response.status, json: (await response.json()) as { success: boolean; data?: Record<string, unknown> } }
  }

  await run('ⓐ 미리보기는 아무것도 쓰지 않는다', async () => {
    const fixture = createDb(baseFixture())
    routeDb = fixture.db
    auditLogs.length = 0
    const before = JSON.stringify(fixture.state)
    const response = await post({ action: 'syncPreview', evalCycleId: CYCLE })
    assert.equal(response.status, 200)
    assert.equal(typeof (response.json.data?.plan as Plan | undefined)?.fingerprint, 'string')
    assert.equal(JSON.stringify(fixture.state), before)
    assert.deepEqual(fixture.writes, { upsertKeys: [], deletedIds: [], transferKeys: [] })
    assert.equal(auditLogs.length, 0)
  })

  await run('ⓑ 같은 데이터에서 적용이 쓴 것 = 미리보기 계획', async () => {
    const { db, writes } = createDb(baseFixture())
    const planned = await plan(db)
    const result = await sync(db, planned.fingerprint)
    const sorted = (values: string[]) => [...values].sort()
    assert.deepEqual(
      sorted(writes.upsertKeys),
      sorted([...planned.create, ...planned.update].map((entry) => key(entry.targetId, entry.evalStage)))
    )
    assert.deepEqual(sorted(writes.deletedIds), sorted(planned.delete.map((entry) => entry.id)))
    assert.deepEqual(sorted(writes.transferKeys), sorted(planned.transfer.map((entry) => key(entry.targetId, entry.evalStage))))
    assert.deepEqual(result.writes, { create: planned.create, update: planned.update, delete: planned.delete, transfer: planned.transfer })
    // 픽스처가 뜻하는 계획.
    assert.equal(planned.update.some((entry) => entry.targetId === 'emp-a' && entry.evalStage === 'SECOND' && entry.afterEvaluatorId === 'emp-sec'), true)
    assert.equal(planned.create.some((entry) => entry.targetId === 'emp-a' && entry.evalStage === 'FINAL'), true)
    assert.deepEqual(
      planned.delete.map((entry) => [entry.targetId, entry.evalStage, entry.hasInProgressEvaluation]),
      [['emp-tl', 'FIRST', true]]
    )
    assert.deepEqual(
      planned.transfer.filter((entry) => entry.targetId === 'emp-a').map((entry) => [entry.evalStage, entry.beforeEvaluatorId, entry.afterEvaluatorId]).sort(),
      [['FIRST', 'emp-old', 'emp-tl'], ['SECOND', 'emp-old', 'emp-sec']]
    )
    assert.equal(planned.transfer.some((entry) => entry.targetId === 'emp-b'), false)
  })

  await run('ⓒ 바뀌지 않는 행은 쓰지 않는다(쓰기 수 = create + update + delete)', async () => {
    const { db, writes } = createDb(baseFixture())
    const planned = await plan(db)
    const result = await sync(db, planned.fingerprint)
    const rowWrites = writes.upsertKeys.length + writes.deletedIds.length
    assert.equal(rowWrites, planned.create.length + planned.update.length + planned.delete.length)
    assert.equal(result.syncedCount, rowWrites)
    assert.equal(writes.upsertKeys.includes(key('emp-a', 'FIRST')), false)
    assert.equal(result.transferCount, planned.transfer.length)
  })

  await run('ⓓ 지문이 다르거나 없으면 아무것도 쓰지 않고 거절한다', async () => {
    for (const fingerprint of ['not-the-plan', null, undefined]) {
      const { db, state, writes } = createDb(baseFixture())
      const before = JSON.stringify(state)
      await assert.rejects(sync(db, fingerprint), (error: unknown) => (error as { statusCode?: number }).statusCode === 409)
      assert.equal(JSON.stringify(state), before)
      assert.deepEqual(writes, { upsertKeys: [], deletedIds: [], transferKeys: [] })
    }

    const fixture = createDb(baseFixture())
    routeDb = fixture.db
    auditLogs.length = 0
    const response = await post({ action: 'sync', evalCycleId: CYCLE })
    assert.equal(response.status, 409)
    assert.deepEqual(fixture.writes, { upsertKeys: [], deletedIds: [], transferKeys: [] })
    assert.equal(auditLogs.length, 0)
  })

  await run('ⓔ 계획 뒤에 잠긴 단계는 쓰지 않고 lockedSkipped 에 들어간다', async () => {
    // 지문을 다시 계산한 뒤, 쓰기 트랜잭션이 열리는 순간 emp-a SECOND 가 제출된다.
    let lockAtTransaction = false
    const { db, state, writes } = createDb({
      ...baseFixture(),
      onTransactionStart: (current) => {
        if (!lockAtTransaction) return
        const evaluation = current.evaluations.find((item) => item.targetId === 'emp-a' && item.evalStage === 'SECOND')!
        evaluation.status = 'SUBMITTED'
      },
    })
    const planned = await plan(db)
    lockAtTransaction = true
    const result = (await sync(db, planned.fingerprint)) as { lockedSkipped: unknown[]; writes: Plan }

    assert.equal(writes.upsertKeys.includes(key('emp-a', 'SECOND')), false)
    assert.equal(state.rows.find((row) => row.targetId === 'emp-a' && row.evalStage === 'SECOND')?.evaluatorId, 'emp-old')
    assert.equal(state.evaluations.find((item) => item.targetId === 'emp-a' && item.evalStage === 'SECOND')?.evaluatorId, 'emp-old')
    assert.deepEqual(result.lockedSkipped, [
      { targetId: 'emp-a', evalStage: 'SECOND', storedEvaluatorId: 'emp-old', defaultEvaluatorId: 'emp-sec' },
    ])
    assert.equal(result.writes.update.some((entry) => entry.targetId === 'emp-a' && entry.evalStage === 'SECOND'), false)
  })

  await run('ⓕ 감사 로그 newValue 에 쓴 행의 이전 · 이후 평가자와 지문이 들어간다', async () => {
    const fixture = createDb(baseFixture())
    routeDb = fixture.db
    auditLogs.length = 0
    const preview = await post({ action: 'syncPreview', evalCycleId: CYCLE })
    const planned = preview.json.data?.plan as Plan
    const response = await post({ action: 'sync', evalCycleId: CYCLE, fingerprint: planned.fingerprint })
    assert.equal(response.status, 200)
    assert.equal(auditLogs.length, 1)
    assert.equal(auditLogs[0].action, 'PERFORMANCE_ASSIGNMENT_SYNC')
    const newValue = auditLogs[0].newValue as { fingerprint?: string; writes?: Plan }
    assert.equal(newValue.fingerprint, planned.fingerprint)
    assert.deepEqual(
      newValue.writes?.update.find((entry) => entry.targetId === 'emp-a' && entry.evalStage === 'SECOND'),
      planned.update.find((entry) => entry.targetId === 'emp-a' && entry.evalStage === 'SECOND')
    )
    const updated = newValue.writes?.update.find((entry) => entry.targetId === 'emp-a' && entry.evalStage === 'SECOND')
    assert.equal(updated?.beforeEvaluatorId, 'emp-old')
    assert.equal(updated?.afterEvaluatorId, 'emp-sec')
    assert.equal(newValue.writes?.delete[0]?.beforeEvaluatorId, 'emp-old')
    assert.deepEqual(newValue.writes, { create: planned.create, update: planned.update, delete: planned.delete, transfer: planned.transfer })
  })

  console.log('Performance assignment sync plan tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
