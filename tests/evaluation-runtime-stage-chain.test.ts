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

type Role = 'ROLE_MEMBER' | 'ROLE_TEAM_LEADER' | 'ROLE_SECTION_CHIEF' | 'ROLE_DIV_HEAD' | 'ROLE_CEO'
type Stage = 'FIRST' | 'SECOND' | 'FINAL' | 'CEO_ADJUST'

const now = new Date('2026-10-20T00:00:00.000Z')

const departments = [
  { id: 'div-1', deptName: '본부', parentDeptId: null, leaderEmployeeId: 'emp-div', excludeLeaderFromEvaluatorAutoAssign: false },
  { id: 'sec-1', deptName: '실', parentDeptId: 'div-1', leaderEmployeeId: 'emp-sec', excludeLeaderFromEvaluatorAutoAssign: false },
  { id: 'team-1', deptName: '팀', parentDeptId: 'sec-1', leaderEmployeeId: 'emp-tl', excludeLeaderFromEvaluatorAutoAssign: false },
]

type Slots = { teamLeaderId: string | null; sectionChiefId: string | null; divisionHeadId: string | null }

function person(id: string, deptId: string, role: Role, slots: Slots = { teamLeaderId: null, sectionChiefId: null, divisionHeadId: null }) {
  return {
    id,
    empId: id,
    empName: `${id}-name`,
    deptId,
    role,
    position: 'MEMBER',
    status: 'ACTIVE',
    jobTitle: null,
    joinDate: now,
    createdAt: now,
    ...slots,
    department: { deptName: deptId },
  }
}

// 대상자 슬롯은 조직 계층과 일부러 다른 사람을 가리킨다. 슬롯을 읽으면 체인에 드러난다.
const SLOT_DECOYS: Slots = { teamLeaderId: 'emp-decoy-tl', sectionChiefId: 'emp-decoy-sc', divisionHeadId: 'emp-decoy-dh' }

// 퇴사한 평가자. 배정 행에는 남아 있지만 기본 배정 계산에서는 빠진다.
function resigned(id: string, deptId: string, role: Role) {
  return { ...person(id, deptId, role), status: 'RESIGNED' }
}

type Employee = ReturnType<typeof person>

function buildEmployees(targetSlots: Slots): Employee[] {
  return [
    person('emp-div', 'div-1', 'ROLE_DIV_HEAD'),
    person('emp-sec', 'sec-1', 'ROLE_SECTION_CHIEF'),
    person('emp-tl', 'team-1', 'ROLE_TEAM_LEADER'),
    person('emp-ceo', 'div-1', 'ROLE_CEO'),
    person('emp-decoy-tl', 'div-1', 'ROLE_TEAM_LEADER'),
    person('emp-decoy-sc', 'div-1', 'ROLE_SECTION_CHIEF'),
    person('emp-decoy-dh', 'div-1', 'ROLE_DIV_HEAD'),
    resigned('emp-gone-tl', 'team-1', 'ROLE_TEAM_LEADER'),
    resigned('emp-gone-sc', 'sec-1', 'ROLE_SECTION_CHIEF'),
    resigned('emp-gone-ceo', 'div-1', 'ROLE_CEO'),
    person('emp-target', 'team-1', 'ROLE_MEMBER', targetSlots),
  ]
}

// 팀장 · 실장 자리가 퇴사자뿐인 조직: 기본 배정에 FIRST · SECOND 평가자가 없다.
const VACANT_DEPARTMENTS = [
  { id: 'div-1', deptName: '본부', parentDeptId: null, leaderEmployeeId: 'emp-div', excludeLeaderFromEvaluatorAutoAssign: false },
  { id: 'sec-1', deptName: '실', parentDeptId: 'div-1', leaderEmployeeId: 'emp-gone-sc', excludeLeaderFromEvaluatorAutoAssign: false },
  { id: 'team-1', deptName: '팀', parentDeptId: 'sec-1', leaderEmployeeId: 'emp-gone-tl', excludeLeaderFromEvaluatorAutoAssign: false },
]

function buildVacantEmployees(): Employee[] {
  return [
    person('emp-div', 'div-1', 'ROLE_DIV_HEAD'),
    person('emp-ceo', 'div-1', 'ROLE_CEO'),
    resigned('emp-gone-tl', 'team-1', 'ROLE_TEAM_LEADER'),
    resigned('emp-gone-sc', 'sec-1', 'ROLE_SECTION_CHIEF'),
    person('emp-target', 'team-1', 'ROLE_MEMBER'),
  ]
}

type Row = { evalStage: Stage; evaluatorId: string }

function createDb(params: { targetSlots: Slots; rows: Row[]; departments?: typeof departments; employees?: Employee[] }) {
  const employees = params.employees ?? buildEmployees(params.targetSlots)
  const hierarchy = params.departments ?? departments
  const byId = new Map(employees.map((employee) => [employee.id, employee]))
  const counters = { hierarchyLoads: 0 }
  const persisted = params.rows.map((row) => ({
    evalCycleId: 'cycle-1',
    targetId: 'emp-target',
    evalStage: row.evalStage,
    evaluatorId: row.evaluatorId,
    evaluator: byId.get(row.evaluatorId),
  }))

  const db = {
    department: {
      findMany: async () => {
        counters.hierarchyLoads += 1
        return hierarchy
      },
    },
    employee: {
      findUnique: async (args: { where?: { id?: string } }) => byId.get(args?.where?.id ?? '') ?? null,
      findFirst: async (args: { where?: { role?: string } }) =>
        employees.find((employee) => employee.role === args?.where?.role && employee.status === 'ACTIVE') ?? null,
      findMany: async (args?: { where?: { id?: { in?: string[] }; status?: string } }) => {
        const ids = args?.where?.id?.in
        const status = args?.where?.status
        return employees.filter(
          (employee) => (!ids || ids.includes(employee.id)) && (!status || employee.status === status)
        )
      },
    },
    evaluationAssignment: {
      findMany: async () => persisted,
      findUnique: async (args: { where: { evalCycleId_targetId_evalStage: { evalStage: Stage } } }) =>
        persisted.find((row) => row.evalStage === args.where.evalCycleId_targetId_evalStage.evalStage) ?? null,
    },
  }
  return { db: db as never, counters }
}

async function main() {
  const { getEvaluationStageChain, resolveEvaluationStageAssignee } = await import(
    '../src/server/evaluation-performance-assignments'
  )
  const { buildAssignments } = await import('../src/server/admin/employeeHierarchy')

  const chainOf = async (db: never) =>
    (await getEvaluationStageChain({ db, evalCycleId: 'cycle-1', targetId: 'emp-target' })).map((entry) => ({
      stage: entry.stage,
      evaluatorId: entry.evaluatorId,
    }))

  // buildDefaultAssignmentRecords 와 같은 계산: 활성 직원만으로 buildAssignments 의 chain + CEO_ADJUST 는 활성 ROLE_CEO.
  const defaultRows = (
    hierarchy: typeof departments = departments,
    allEmployees: Employee[] = buildEmployees(SLOT_DECOYS)
  ): Row[] => {
    const employees = allEmployees.filter((employee) => employee.status === 'ACTIVE')
    const chain = buildAssignments(hierarchy, employees as never).get('emp-target')
    const ceoId = employees.find((employee) => employee.role === 'ROLE_CEO')?.id ?? null
    const byStage: Record<Stage, string | null> = {
      FIRST: chain?.teamLeaderId ?? null,
      SECOND: chain?.sectionChiefId ?? null,
      FINAL: chain?.divisionHeadId ?? null,
      CEO_ADJUST: ceoId,
    }
    // sync 와 같은 필터: 평가자가 있는 행만.
    return (Object.keys(byStage) as Stage[])
      .filter((stage) => byStage[stage])
      .map((stage) => ({ evalStage: stage, evaluatorId: byStage[stage] as string }))
  }

  const ROWS_WITHOUT_SECOND: Row[] = [
    { evalStage: 'FIRST', evaluatorId: 'emp-tl' },
    { evalStage: 'FINAL', evaluatorId: 'emp-div' },
    { evalStage: 'CEO_ADJUST', evaluatorId: 'emp-ceo' },
  ]
  const NO_SLOTS: Slots = { teamLeaderId: null, sectionChiefId: null, divisionHeadId: null }

  await run('① 행이 있는 대상: 슬롯 값을 어떻게 바꿔도 단계 체인이 같다', async () => {
    const withDecoys = await chainOf(createDb({ targetSlots: SLOT_DECOYS, rows: ROWS_WITHOUT_SECOND }).db)
    const withoutSlots = await chainOf(createDb({ targetSlots: NO_SLOTS, rows: ROWS_WITHOUT_SECOND }).db)
    assert.deepEqual(withDecoys, withoutSlots)
  })

  await run('② 행이 있는 대상: 행 없는 단계는 체인에 없다', async () => {
    const chain = await chainOf(createDb({ targetSlots: SLOT_DECOYS, rows: ROWS_WITHOUT_SECOND }).db)
    assert.equal(chain.some((entry) => entry.stage === 'SECOND'), false)
    assert.deepEqual(chain.map((entry) => entry.stage), ['SELF', 'FIRST', 'FINAL', 'CEO_ADJUST'])
  })

  await run('③ 행이 없는 대상: 체인이 buildDefaultAssignmentRecords 결과와 같다', async () => {
    const chain = await chainOf(createDb({ targetSlots: SLOT_DECOYS, rows: [] }).db)
    const expected = [{ stage: 'SELF', evaluatorId: 'emp-target' }, ...defaultRows().map((row) => ({ stage: row.evalStage, evaluatorId: row.evaluatorId }))]
    assert.deepEqual(chain, expected)
  })

  await run('④ 행이 없는 대상: 기본 배정 계산이 호출 한 번에 1회', async () => {
    const { db, counters } = createDb({ targetSlots: SLOT_DECOYS, rows: [] })
    await chainOf(db)
    assert.equal(counters.hierarchyLoads, 1)
  })

  await run('⑤ 기본 배정을 sync 처럼 행으로 넣은 대상: 체인이 ③과 같고 마지막이 대표의 CEO_ADJUST 다', async () => {
    const asRows = await chainOf(createDb({ targetSlots: SLOT_DECOYS, rows: defaultRows() }).db)
    const asDefaults = await chainOf(createDb({ targetSlots: NO_SLOTS, rows: [] }).db)
    assert.deepEqual(asRows, asDefaults)
    assert.deepEqual(asRows[asRows.length - 1], { stage: 'CEO_ADJUST', evaluatorId: 'emp-ceo' })
  })

  // 추가 확인: resolveEvaluationStageAssignee 도 같은 규칙을 탄다(CEO_ADJUST 포함).
  await run('⑥ resolveEvaluationStageAssignee: 행이 있으면 그 단계 행만, 없으면 기본 배정', async () => {
    const withRows = createDb({ targetSlots: SLOT_DECOYS, rows: ROWS_WITHOUT_SECOND.filter((row) => row.evalStage !== 'CEO_ADJUST') })
    assert.equal(
      await resolveEvaluationStageAssignee({ db: withRows.db, evalCycleId: 'cycle-1', targetId: 'emp-target', evalStage: 'CEO_ADJUST' }),
      null
    )
    const noRows = createDb({ targetSlots: SLOT_DECOYS, rows: [] })
    assert.equal(
      await resolveEvaluationStageAssignee({ db: noRows.db, evalCycleId: 'cycle-1', targetId: 'emp-target', evalStage: 'CEO_ADJUST' }),
      'emp-ceo'
    )
  })

  const defaultEvaluatorOf = (stage: Stage, rows: Row[] = defaultRows()) =>
    rows.find((row) => row.evalStage === stage)?.evaluatorId ?? null

  await run('⑦ 행의 평가자가 비활성이면 그 단계는 기본 배정의 평가자다. 다른 단계는 행 그대로', async () => {
    const chain = await chainOf(
      createDb({
        targetSlots: SLOT_DECOYS,
        rows: [
          { evalStage: 'FIRST', evaluatorId: 'emp-gone-tl' },
          { evalStage: 'SECOND', evaluatorId: 'emp-decoy-sc' },
          { evalStage: 'FINAL', evaluatorId: 'emp-div' },
          { evalStage: 'CEO_ADJUST', evaluatorId: 'emp-ceo' },
        ],
      }).db
    )
    assert.notEqual(defaultEvaluatorOf('FIRST'), null)
    assert.deepEqual(chain, [
      { stage: 'SELF', evaluatorId: 'emp-target' },
      { stage: 'FIRST', evaluatorId: defaultEvaluatorOf('FIRST') },
      { stage: 'SECOND', evaluatorId: 'emp-decoy-sc' },
      { stage: 'FINAL', evaluatorId: 'emp-div' },
      { stage: 'CEO_ADJUST', evaluatorId: 'emp-ceo' },
    ])
  })

  await run('⑧ 기본 배정에도 평가자가 없으면 그 단계는 체인에 없다(FIRST · SECOND)', async () => {
    const vacantDefaults = defaultRows(VACANT_DEPARTMENTS, buildVacantEmployees())
    assert.equal(defaultEvaluatorOf('FIRST', vacantDefaults), null)
    assert.equal(defaultEvaluatorOf('SECOND', vacantDefaults), null)

    const chain = await chainOf(
      createDb({
        targetSlots: NO_SLOTS,
        departments: VACANT_DEPARTMENTS,
        employees: buildVacantEmployees(),
        rows: [
          { evalStage: 'FIRST', evaluatorId: 'emp-gone-tl' },
          { evalStage: 'SECOND', evaluatorId: 'emp-gone-sc' },
          { evalStage: 'FINAL', evaluatorId: 'emp-div' },
          { evalStage: 'CEO_ADJUST', evaluatorId: 'emp-ceo' },
        ],
      }).db
    )
    assert.deepEqual(chain.map((entry) => entry.stage), ['SELF', 'FINAL', 'CEO_ADJUST'])
  })

  await run('⑨ resolveEvaluationStageAssignee: 행의 평가자가 비활성이면 기본 배정의 평가자(CEO_ADJUST 포함)', async () => {
    const rows: Row[] = [
      { evalStage: 'FIRST', evaluatorId: 'emp-gone-tl' },
      { evalStage: 'FINAL', evaluatorId: 'emp-div' },
      { evalStage: 'CEO_ADJUST', evaluatorId: 'emp-gone-ceo' },
    ]
    const resolve = (evalStage: Stage) =>
      resolveEvaluationStageAssignee({
        db: createDb({ targetSlots: SLOT_DECOYS, rows }).db,
        evalCycleId: 'cycle-1',
        targetId: 'emp-target',
        evalStage,
      })
    assert.equal(await resolve('CEO_ADJUST'), 'emp-ceo')
    assert.equal(await resolve('FIRST'), defaultEvaluatorOf('FIRST'))
    assert.equal(await resolve('FINAL'), 'emp-div')
  })

  await run('⑩ 비활성 행이 2개여도 계층 로드는 1회, 비활성 행이 없으면 0회', async () => {
    const twoInactive: Row[] = [
      { evalStage: 'FIRST', evaluatorId: 'emp-gone-tl' },
      { evalStage: 'SECOND', evaluatorId: 'emp-gone-sc' },
      { evalStage: 'FINAL', evaluatorId: 'emp-div' },
      { evalStage: 'CEO_ADJUST', evaluatorId: 'emp-ceo' },
    ]
    const withInactive = createDb({ targetSlots: SLOT_DECOYS, rows: twoInactive })
    await chainOf(withInactive.db)
    assert.equal(withInactive.counters.hierarchyLoads, 1)

    const allActive = createDb({ targetSlots: SLOT_DECOYS, rows: ROWS_WITHOUT_SECOND })
    await chainOf(allActive.db)
    assert.equal(allActive.counters.hierarchyLoads, 0)

    const resolverInactive = createDb({ targetSlots: SLOT_DECOYS, rows: twoInactive })
    await resolveEvaluationStageAssignee({ db: resolverInactive.db, evalCycleId: 'cycle-1', targetId: 'emp-target', evalStage: 'FIRST' })
    assert.equal(resolverInactive.counters.hierarchyLoads, 1)

    const resolverActive = createDb({ targetSlots: SLOT_DECOYS, rows: twoInactive })
    await resolveEvaluationStageAssignee({ db: resolverActive.db, evalCycleId: 'cycle-1', targetId: 'emp-target', evalStage: 'FINAL' })
    assert.equal(resolverActive.counters.hierarchyLoads, 0)
  })

  console.log('Evaluation runtime stage chain tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
