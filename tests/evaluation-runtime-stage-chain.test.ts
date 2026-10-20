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

function buildEmployees(targetSlots: Slots) {
  return [
    person('emp-div', 'div-1', 'ROLE_DIV_HEAD'),
    person('emp-sec', 'sec-1', 'ROLE_SECTION_CHIEF'),
    person('emp-tl', 'team-1', 'ROLE_TEAM_LEADER'),
    person('emp-ceo', 'div-1', 'ROLE_CEO'),
    person('emp-decoy-tl', 'div-1', 'ROLE_TEAM_LEADER'),
    person('emp-decoy-sc', 'div-1', 'ROLE_SECTION_CHIEF'),
    person('emp-decoy-dh', 'div-1', 'ROLE_DIV_HEAD'),
    person('emp-target', 'team-1', 'ROLE_MEMBER', targetSlots),
  ]
}

type Row = { evalStage: Stage; evaluatorId: string }

function createDb(params: { targetSlots: Slots; rows: Row[] }) {
  const employees = buildEmployees(params.targetSlots)
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
        return departments
      },
    },
    employee: {
      findUnique: async (args: { where?: { id?: string } }) => byId.get(args?.where?.id ?? '') ?? null,
      findFirst: async (args: { where?: { role?: string } }) =>
        employees.find((employee) => employee.role === args?.where?.role && employee.status === 'ACTIVE') ?? null,
      findMany: async (args?: { where?: { id?: { in?: string[] } } }) => {
        const ids = args?.where?.id?.in
        return ids ? employees.filter((employee) => ids.includes(employee.id)) : employees
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

  // buildDefaultAssignmentRecords 와 같은 계산: buildAssignments 의 chain + CEO_ADJUST 는 활성 ROLE_CEO.
  const defaultRows = (): Row[] => {
    const employees = buildEmployees(SLOT_DECOYS)
    const chain = buildAssignments(departments, employees as never).get('emp-target')
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

  console.log('Evaluation runtime stage chain tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
