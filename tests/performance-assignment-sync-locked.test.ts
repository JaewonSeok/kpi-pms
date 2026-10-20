import './register-path-aliases'
import assert from 'node:assert/strict'

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

const CYCLE = 'cycle-1'
const STAGES: Stage[] = ['FIRST', 'SECOND', 'FINAL', 'CEO_ADJUST']
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
  // 예전 평가자. 지금 기본 배정에는 어느 자리에도 오지 않는다.
  person('emp-old', 'div-1', 'ROLE_MEMBER'),
  person('emp-gone', 'div-1', 'ROLE_TEAM_LEADER', 'RESIGNED'),
  person('emp-a', 'team-1', 'ROLE_MEMBER'),
  person('emp-b', 'team-1', 'ROLE_MEMBER'),
]
const statusById = new Map(employees.map((employee) => [employee.id, employee.status]))

const key = (targetId: string, evalStage: string) => `${targetId}:${evalStage}`

function createDb(params: { rows: Omit<AssignmentRow, 'id' | 'evalCycleId'>[]; evaluations: Omit<EvaluationRow, 'id' | 'evalCycleId'>[] }) {
  const state = {
    rows: params.rows.map((row, index) => ({ id: `row-${index + 1}`, evalCycleId: CYCLE, ...row })) as AssignmentRow[],
    evaluations: params.evaluations.map((evaluation, index) => ({ id: `eval-${index + 1}`, evalCycleId: CYCLE, ...evaluation })) as EvaluationRow[],
  }
  const transactionOptions: unknown[] = []
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
        return { count }
      },
    },
    // 실제 DB 처럼 실패하면 트랜잭션 안의 변경을 모두 되돌린다.
    $transaction: async (fn: (tx: unknown) => Promise<unknown>, options?: unknown) => {
      transactionOptions.push(options)
      const snapshot = JSON.stringify(state)
      try {
        return await fn(db)
      } catch (error) {
        const restored = JSON.parse(snapshot)
        state.rows = restored.rows
        state.evaluations = restored.evaluations
        throw error
      }
    },
  }

  return { db: db as never, state, transactionOptions }
}

async function main() {
  const { planPerformanceAssignmentSync, syncPerformanceAssignmentsForCycle } = await import(
    '../src/server/evaluation-performance-assignments'
  )
  const { buildAssignments } = await import('../src/server/admin/employeeHierarchy')

  // buildDefaultAssignmentRecords 와 같은 계산: 활성 직원으로 buildAssignments + CEO_ADJUST 는 활성 ROLE_CEO.
  const active = employees.filter((employee) => employee.status === 'ACTIVE')
  const chains = buildAssignments(departments, active as never)
  const ceoId = active.find((employee) => employee.role === 'ROLE_CEO')?.id ?? null
  const defaultOf = (targetId: string, stage: Stage): string | null => {
    const chain = chains.get(targetId)
    if (stage === 'CEO_ADJUST') return ceoId
    if (!chain) return null
    return stage === 'FIRST' ? chain.teamLeaderId : stage === 'SECOND' ? chain.sectionChiefId : chain.divisionHeadId
  }

  // 적용은 미리보기 계획의 지문을 받아야 한다.
  const sync = async (db: never) => {
    const plan = await planPerformanceAssignmentSync({ evalCycleId: CYCLE }, db)
    return syncPerformanceAssignmentsForCycle({ actorId: 'emp-admin', evalCycleId: CYCLE, fingerprint: plan.fingerprint }, db)
  }
  const rowOf = (state: { rows: AssignmentRow[] }, targetId: string, stage: Stage) =>
    state.rows.find((row) => row.targetId === targetId && row.evalStage === stage) ?? null
  const evaluationOf = (state: { evaluations: EvaluationRow[] }, targetId: string, stage: Stage) =>
    state.evaluations.find((evaluation) => evaluation.targetId === targetId && evaluation.evalStage === stage) ?? null

  // 전제: 픽스처가 뜻하는 기본 배정.
  assert.equal(defaultOf('emp-a', 'FIRST'), 'emp-tl')
  assert.equal(defaultOf('emp-a', 'SECOND'), 'emp-sec')
  assert.equal(defaultOf('emp-a', 'FINAL'), 'emp-div')
  assert.equal(defaultOf('emp-tl', 'FIRST'), null)

  // emp-a FIRST: 예전 평가자(emp-old)로 제출됨 → 잠김 · 바뀌어야 함
  // emp-a SECOND: 예전 평가자로 진행 중 → 바뀌어야 함
  // emp-a FINAL: 이미 기본 평가자, 확정 → 잠김 · 바뀔 것 없음
  // emp-b FIRST: 퇴사자를 수동 지정
  const lockedFixture = () =>
    createDb({
      rows: [
        { targetId: 'emp-a', evalStage: 'FIRST', evaluatorId: 'emp-old', assignmentSource: 'AUTO' },
        { targetId: 'emp-a', evalStage: 'SECOND', evaluatorId: 'emp-old', assignmentSource: 'AUTO' },
        { targetId: 'emp-a', evalStage: 'FINAL', evaluatorId: 'emp-div', assignmentSource: 'AUTO' },
        { targetId: 'emp-b', evalStage: 'FIRST', evaluatorId: 'emp-gone', assignmentSource: 'MANUAL' },
      ],
      evaluations: [
        { targetId: 'emp-a', evalStage: 'FIRST', evaluatorId: 'emp-old', status: 'SUBMITTED' },
        { targetId: 'emp-a', evalStage: 'SECOND', evaluatorId: 'emp-old', status: 'IN_PROGRESS' },
        { targetId: 'emp-a', evalStage: 'FINAL', evaluatorId: 'emp-div', status: 'CONFIRMED' },
      ],
    })

  await run('ⓐ 잠긴 단계가 있어도 sync 가 끝까지 돌고, 잠긴 단계의 행과 평가는 그대로다', async () => {
    const { db, state } = lockedFixture()
    await sync(db)
    assert.equal(rowOf(state, 'emp-a', 'FIRST')?.evaluatorId, 'emp-old')
    assert.equal(evaluationOf(state, 'emp-a', 'FIRST')?.evaluatorId, 'emp-old')
    assert.equal(evaluationOf(state, 'emp-a', 'FIRST')?.status, 'SUBMITTED')
    assert.equal(rowOf(state, 'emp-a', 'FINAL')?.evaluatorId, 'emp-div')
  })

  await run('ⓑ 같은 실행에서 잠기지 않은 단계는 기본 배정대로 바뀌고, 진행 중 평가의 evaluatorId 도 따라간다', async () => {
    const { db, state } = lockedFixture()
    await sync(db)
    assert.equal(rowOf(state, 'emp-a', 'SECOND')?.evaluatorId, defaultOf('emp-a', 'SECOND'))
    assert.equal(evaluationOf(state, 'emp-a', 'SECOND')?.evaluatorId, defaultOf('emp-a', 'SECOND'))
    assert.equal(rowOf(state, 'emp-a', 'CEO_ADJUST')?.evaluatorId, ceoId)
    assert.equal(rowOf(state, 'emp-b', 'SECOND')?.evaluatorId, defaultOf('emp-b', 'SECOND'))
  })

  await run('ⓒ lockedSkipped 에는 바뀌어야 했던 잠긴 단계만 나온다', async () => {
    const { db } = lockedFixture()
    const result = (await sync(db)) as { lockedSkipped?: unknown }
    assert.deepEqual(result.lockedSkipped, [
      { targetId: 'emp-a', evalStage: 'FIRST', storedEvaluatorId: 'emp-old', defaultEvaluatorId: 'emp-tl' },
    ])
  })

  await run('ⓓ 평가자가 비활성인 MANUAL 행은 그대로 남고 manualInactive 에 나온다', async () => {
    const { db, state } = lockedFixture()
    const result = (await sync(db)) as { manualInactive?: unknown }
    assert.equal(rowOf(state, 'emp-b', 'FIRST')?.evaluatorId, 'emp-gone')
    assert.equal(rowOf(state, 'emp-b', 'FIRST')?.assignmentSource, 'MANUAL')
    assert.deepEqual(result.manualInactive, [{ targetId: 'emp-b', evalStage: 'FIRST', evaluatorId: 'emp-gone' }])
  })

  await run('ⓔ 잠긴 단계의 AUTO 행은 기본 평가자가 없어도 지워지지 않는다', async () => {
    // emp-tl 은 자기 팀의 장이라 FIRST 기본 평가자가 없다. 예전 행으로 이미 제출됐다.
    const { db, state } = createDb({
      rows: [{ targetId: 'emp-tl', evalStage: 'FIRST', evaluatorId: 'emp-old', assignmentSource: 'AUTO' }],
      evaluations: [{ targetId: 'emp-tl', evalStage: 'FIRST', evaluatorId: 'emp-old', status: 'SUBMITTED' }],
    })
    await sync(db)
    assert.equal(rowOf(state, 'emp-tl', 'FIRST')?.evaluatorId, 'emp-old')
  })

  await run('ⓕ 잠긴 단계가 없으면 행 · 평가 결과가 지금과 같다', async () => {
    const { db, state } = createDb({
      rows: [
        { targetId: 'emp-a', evalStage: 'FIRST', evaluatorId: 'emp-old', assignmentSource: 'AUTO' },
        { targetId: 'emp-tl', evalStage: 'FIRST', evaluatorId: 'emp-old', assignmentSource: 'AUTO' },
        { targetId: 'emp-b', evalStage: 'FIRST', evaluatorId: 'emp-gone', assignmentSource: 'MANUAL' },
      ],
      evaluations: [
        { targetId: 'emp-a', evalStage: 'FIRST', evaluatorId: 'emp-old', status: 'IN_PROGRESS' },
        { targetId: 'emp-a', evalStage: 'SECOND', evaluatorId: 'emp-old', status: 'PENDING' },
        { targetId: 'emp-b', evalStage: 'SECOND', evaluatorId: 'emp-old', status: 'REJECTED' },
      ],
    })
    await sync(db)

    // 지금 규칙: MANUAL 키 외의 모든 (대상 · 단계)는 기본 평가자가 있으면 그 평가자의 AUTO 행, 없으면 행 없음.
    const expectedRows = new Map<string, { evaluatorId: string; assignmentSource: Source }>()
    for (const employee of active) {
      for (const stage of STAGES) {
        const evaluatorId = defaultOf(employee.id, stage)
        if (evaluatorId) expectedRows.set(key(employee.id, stage), { evaluatorId, assignmentSource: 'AUTO' })
      }
    }
    expectedRows.set(key('emp-b', 'FIRST'), { evaluatorId: 'emp-gone', assignmentSource: 'MANUAL' })
    const actualRows = new Map(
      state.rows.map((row) => [key(row.targetId, row.evalStage), { evaluatorId: row.evaluatorId, assignmentSource: row.assignmentSource }])
    )
    assert.deepEqual(actualRows, expectedRows)

    assert.deepEqual(
      state.evaluations.map((evaluation) => [key(evaluation.targetId, evaluation.evalStage), evaluation.evaluatorId]),
      [
        [key('emp-a', 'FIRST'), defaultOf('emp-a', 'FIRST')],
        [key('emp-a', 'SECOND'), defaultOf('emp-a', 'SECOND')],
        [key('emp-b', 'SECOND'), defaultOf('emp-b', 'SECOND')],
      ]
    )
  })

  console.log('Performance assignment sync locked-stage tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
