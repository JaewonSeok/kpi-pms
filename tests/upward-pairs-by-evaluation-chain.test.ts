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

function stubModule(request: string, exports: Record<string, unknown>) {
  const filename = require.resolve(request)
  const stub = new Module(filename)
  stub.filename = filename
  stub.loaded = true
  stub.exports = exports
  require.cache[filename] = stub
}

// ---- 조직 ------------------------------------------------------------------------------
// 대표 ─ 본부(본부장) ─┬ 실(실장) ─ 팀(팀장): 팀원1 · 팀원2 · 팀원4 · 팀원5
//                      ├ 팀2(팀장2) — 실 없이 본부 바로 아래
//                      └ 팀3(ROLE_ADMIN 팀장): 팀원3
const ORG = 'org-1'
const DEPARTMENTS = [
  { id: 'dept-ceo', deptName: '대표실', parentDeptId: null, leaderEmployeeId: 'emp-ceo', orgId: ORG },
  { id: 'dept-div', deptName: '본부', parentDeptId: 'dept-ceo', leaderEmployeeId: 'emp-div', orgId: ORG },
  { id: 'dept-sec', deptName: '실', parentDeptId: 'dept-div', leaderEmployeeId: 'emp-sec', orgId: ORG },
  { id: 'dept-team', deptName: '팀', parentDeptId: 'dept-sec', leaderEmployeeId: 'emp-tl', orgId: ORG },
  { id: 'dept-team2', deptName: '팀2', parentDeptId: 'dept-div', leaderEmployeeId: 'emp-tl2', orgId: ORG },
  { id: 'dept-team3', deptName: '팀3', parentDeptId: 'dept-div', leaderEmployeeId: 'emp-adminlead', orgId: ORG },
  // 장도 상위 부서도 없는 부서(기본 배정의 1차 · 2차 평가자가 없다)
  { id: 'dept-orphan', deptName: '독립 파트', parentDeptId: null, leaderEmployeeId: null, orgId: ORG },
  // 다른 조직
  { id: 'dept-x', deptName: '다른 조직', parentDeptId: null, leaderEmployeeId: null, orgId: 'org-2' },
]

type EmployeeRow = {
  id: string
  empName: string
  role: string
  jobTitle: string | null
  status: string
  deptId: string
  teamLeaderId: string | null
  sectionChiefId: string | null
  divisionHeadId: string | null
}
const person = (id: string, empName: string, role: string, deptId: string, extra: Partial<EmployeeRow> = {}): EmployeeRow => ({
  id,
  empName,
  role,
  jobTitle: null,
  status: 'ACTIVE',
  deptId,
  teamLeaderId: null,
  sectionChiefId: null,
  divisionHeadId: null,
  ...extra,
})
const EMPLOYEES: EmployeeRow[] = [
  person('emp-ceo', '대표', 'ROLE_CEO', 'dept-ceo', { jobTitle: '대표이사' }),
  person('emp-div', '본부장', 'ROLE_DIV_HEAD', 'dept-div', { jobTitle: '본부장' }),
  person('emp-sec', '실장', 'ROLE_SECTION_CHIEF', 'dept-sec', { jobTitle: '실장', divisionHeadId: 'emp-div' }),
  person('emp-tl', '팀장', 'ROLE_TEAM_LEADER', 'dept-team', { jobTitle: '팀장', sectionChiefId: 'emp-sec', divisionHeadId: 'emp-div' }),
  person('emp-tl2', '팀장2', 'ROLE_TEAM_LEADER', 'dept-team2', { jobTitle: '팀장', divisionHeadId: 'emp-div' }),
  person('emp-adminlead', '관리자팀장', 'ROLE_ADMIN', 'dept-team3', { jobTitle: '팀장', divisionHeadId: 'emp-div' }),
  // 팀원1: 직원 슬롯은 팀장2 를 가리키지만 업적평가 배정 행의 1차 평가자는 팀장이다.
  person('emp-m1', '팀원1', 'ROLE_MEMBER', 'dept-team', { teamLeaderId: 'emp-tl2' }),
  // 팀원2: 배정 행 없음 → 기본 배정
  person('emp-m2', '팀원2', 'ROLE_MEMBER', 'dept-team', { teamLeaderId: 'emp-tl' }),
  person('emp-m3', '팀원3', 'ROLE_MEMBER', 'dept-team3', { teamLeaderId: 'emp-adminlead' }),
  // 팀원4: 배정 행의 1차 평가자가 퇴사자 → 실제 업적평가처럼 기본 배정의 1차(팀장)로 대체
  person('emp-m4', '팀원4', 'ROLE_MEMBER', 'dept-team', { teamLeaderId: 'emp-tl' }),
  // 팀원6: 배정 행의 1차 평가자가 퇴사자이고 기본 배정에도 1차가 없다 → 2차(실장)로 넘기지 않고 짝 없음
  person('emp-m6', '팀원6', 'ROLE_MEMBER', 'dept-orphan', { teamLeaderId: 'emp-tl' }),
  // 팀원5: 배정 행이 대표 확정 단계뿐 → 체인에 상위 평가자 없음
  person('emp-m5', '팀원5', 'ROLE_MEMBER', 'dept-team', { teamLeaderId: 'emp-tl' }),
  // 업적평가 대상이 아닌 사람: 퇴사자 · 다른 조직
  person('emp-gone', '퇴사자', 'ROLE_MEMBER', 'dept-team', { status: 'RESIGNED', teamLeaderId: 'emp-tl' }),
  person('emp-other', '다른조직', 'ROLE_MEMBER', 'dept-x', { teamLeaderId: 'emp-tl' }),
  // 화면을 여는 관리자. 배정 행이 대표 확정 단계뿐이라 짝이 없다.
  person('emp-admin', '운영자', 'ROLE_ADMIN', 'dept-ceo'),
]
const employeeById = new Map(EMPLOYEES.map((employee) => [employee.id, employee]))

// 업적평가 배정 행(사이클 cycle-1)
const ASSIGNMENT_ROWS = [
  { targetId: 'emp-m1', evalStage: 'FIRST', evaluatorId: 'emp-tl' },
  { targetId: 'emp-m1', evalStage: 'SECOND', evaluatorId: 'emp-sec' },
  { targetId: 'emp-m4', evalStage: 'FIRST', evaluatorId: 'emp-gone' },
  { targetId: 'emp-m4', evalStage: 'SECOND', evaluatorId: 'emp-sec' },
  { targetId: 'emp-m6', evalStage: 'FIRST', evaluatorId: 'emp-gone' },
  { targetId: 'emp-m6', evalStage: 'SECOND', evaluatorId: 'emp-sec' },
  { targetId: 'emp-m5', evalStage: 'CEO_ADJUST', evaluatorId: 'emp-ceo' },
  { targetId: 'emp-admin', evalStage: 'CEO_ADJUST', evaluatorId: 'emp-ceo' },
]

// 스텁하지 않은 모델 · 메서드에 접근하면 기록하고 즉시 던진다. 실제 Prisma 로는 나가지 않는다.
const unstubbedCalls: string[] = []
const createdPairs: string[] = []
function guardedDb(models: Record<string, Record<string, unknown>>): Record<string, unknown> {
  return new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => {
      if (typeof key !== 'string' || key === 'then') return undefined
      const methods = models[key] ?? {}
      return new Proxy({} as Record<string, unknown>, {
        get: (_inner, method) => {
          if (typeof method !== 'string' || method === 'then') return undefined
          if (methods[method]) return methods[method]
          return () => {
            unstubbedCalls.push(`${key}.${method}`)
            throw new Error(`UNSTUBBED_DB_CALL:${key}.${method}`)
          }
        },
      })
    },
  })
}

const departmentOf = (deptId: string) => DEPARTMENTS.find((department) => department.id === deptId)!
const fakeDb = guardedDb({
  employee: {
    findUnique: async (args: { where: { id: string } }) => {
      const row = employeeById.get(args.where.id)
      return row ? { ...row, department: { ...departmentOf(row.deptId) } } : null
    },
    // 조직 재직자 조회 · 기본 배정의 전 직원 조회 모두 전원을 돌려준다(어느 판정이 거르는지 보기 위해 where 를 적용하지 않는다).
    findMany: async () =>
      EMPLOYEES.map((row) => ({
        ...row,
        empId: row.id,
        position: 'MEMBER',
        teamName: departmentOf(row.deptId).deptName,
        joinDate: new Date('2020-01-01T00:00:00Z'),
        createdAt: new Date('2020-01-01T00:00:00Z'),
        department: { deptName: departmentOf(row.deptId).deptName },
      })),
  },
  department: {
    findMany: async (args?: { where?: { orgId?: string } }) =>
      DEPARTMENTS.filter((department) => !args?.where?.orgId || department.orgId === args.where.orgId).map((department) => ({
        ...department,
        excludeLeaderFromEvaluatorAutoAssign: false,
      })),
  },
  evaluationAssignment: {
    // 추천(여러 대상: targetId.in)과 업적평가 체인(한 대상: targetId 문자열) 둘 다 받는다.
    findMany: async (args: { where: { evalCycleId: string; targetId?: string | { in?: string[] } } }) =>
      ASSIGNMENT_ROWS.filter((row) => {
        const target = args.where.targetId
        const matches = typeof target === 'string' ? row.targetId === target : !target?.in || target.in.includes(row.targetId)
        return args.where.evalCycleId === 'cycle-1' && matches
      }).map((row) => {
        const evaluator = employeeById.get(row.evaluatorId)
        return {
          ...row,
          evaluator: {
            id: row.evaluatorId,
            empName: evaluator?.empName ?? row.evaluatorId,
            role: evaluator?.role ?? 'ROLE_MEMBER',
            position: 'MEMBER',
            jobTitle: evaluator?.jobTitle ?? null,
            status: evaluator?.status ?? 'RESIGNED',
            department: { deptName: evaluator ? departmentOf(evaluator.deptId).deptName : '-' },
          },
        }
      }),
  },
  feedbackAdminGroupMember: { findMany: async () => [] },
  multiFeedbackRound: {
    findFirst: async () => ({
      id: 'up-round',
      evalCycleId: 'cycle-1',
      roundName: '리더십 진단',
      roundType: 'UPWARD',
      status: 'DRAFT',
      minRaters: 3,
      startDate: new Date('2026-11-01T00:00:00Z'),
      endDate: new Date('2026-11-30T00:00:00Z'),
      documentSettings: { targetTypes: ['TEAM_LEADER', 'SECTION_CHIEF', 'DIVISION_HEAD'] },
      feedbacks: [],
    }),
  },
  multiFeedback: {
    create: async (args: { data: { giverId: string; receiverId: string } }) => {
      createdPairs.push(`${args.data.giverId}->${args.data.receiverId}`)
      return { id: `fb-${createdPairs.length}` }
    },
  },
})

stubModule('next-auth', {
  getServerSession: async () => ({ user: { id: 'emp-admin', role: 'ROLE_ADMIN', name: '운영자', email: 'emp-admin@example.com' } }),
})
stubModule('../src/lib/auth', { authOptions: {} })
stubModule('../src/lib/audit', {
  createAuditLog: async () => undefined,
  getClientInfo: () => ({}),
  resolveAuditActor: () => ({ userId: 'emp-admin' }),
})
stubModule('../src/lib/prisma', { prisma: fakeDb })

type SuggestResult = {
  status: number
  pairs: string[]
  unpaired: Array<{ evaluatorId: string; reason?: string }>
  belowMinRaters: Array<{ evaluateeId: string; raterCount: number }>
}

async function main() {
  const adminRoute = await import('../src/app/api/feedback/upward/admin/route')
  const { getEvaluationStageChain } = await import('../src/server/evaluation-performance-assignments')

  // 추천 짝 추가(addSuggestedAssignments). 본 것 = 만들어진 짝 · 짝 없음 · minRaters 미만 표시
  const suggest = async (): Promise<SuggestResult> => {
    createdPairs.length = 0
    const response = await adminRoute.POST(
      new Request('http://localhost/api/feedback/upward/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'addSuggestedAssignments', payload: { roundId: 'up-round' } }),
      })
    )
    const json = (await response.json().catch(() => null)) as { data?: Partial<SuggestResult> } | null
    return {
      status: response.status,
      pairs: [...createdPairs].sort(),
      unpaired: (json?.data?.unpaired ?? []) as SuggestResult['unpaired'],
      belowMinRaters: (json?.data?.belowMinRaters ?? []) as SuggestResult['belowMinRaters'],
    }
  }
  const pairsOf = (result: SuggestResult, giverId: string) =>
    result.pairs.filter((pair) => pair.startsWith(`${giverId}->`))
  const unpairedReason = (result: SuggestResult, evaluatorId: string) =>
    result.unpaired.find((item) => item.evaluatorId === evaluatorId)?.reason ?? null

  await run('ⓐ 팀원의 짝 대상은 배정 행의 1차 평가자다. 직원 슬롯이 다른 사람을 가리켜도 배정 행을 따른다', async () => {
    const result = await suggest()
    assert.deepEqual({ status: result.status, m1: pairsOf(result, 'emp-m1') }, { status: 200, m1: ['emp-m1->emp-tl'] })
  })

  await run('ⓑ 1차 단계가 체인에 없는 팀장은 그다음 단계 평가자(실장, 없으면 본부장)를 평가한다', async () => {
    const result = await suggest()
    assert.deepEqual(
      { tl: pairsOf(result, 'emp-tl'), tl2: pairsOf(result, 'emp-tl2'), sec: pairsOf(result, 'emp-sec') },
      { tl: ['emp-tl->emp-sec'], tl2: ['emp-tl2->emp-div'], sec: ['emp-sec->emp-div'] }
    )
  })

  await run('ⓒ 바로 위가 대표면 짝이 없고, 대표는 어떤 짝에도 대상 · 평가자로 나오지 않는다', async () => {
    const result = await suggest()
    assert.deepEqual(
      {
        div: pairsOf(result, 'emp-div'),
        divReason: unpairedReason(result, 'emp-div'),
        ceoInPairs: result.pairs.filter((pair) => pair.includes('emp-ceo')),
      },
      { div: [], divReason: 'EVALUATOR_IS_CEO', ceoInPairs: [] }
    )
  })

  await run('ⓓ ROLE_ADMIN 리더도 짝의 대상이 된다', async () => {
    const result = await suggest()
    assert.deepEqual(
      { m3: pairsOf(result, 'emp-m3'), adminLead: pairsOf(result, 'emp-adminlead') },
      { m3: ['emp-m3->emp-adminlead'], adminLead: ['emp-adminlead->emp-div'] }
    )
  })

  await run("ⓔ 배정 행이 없으면 기본 배정 결과를 따른다. 평가자를 정하지 못하면 '짝 없음'으로 돌려준다", async () => {
    const result = await suggest()
    assert.deepEqual(
      {
        m2: pairsOf(result, 'emp-m2'),
        // 1차가 퇴사자이고 기본 배정에도 1차가 없다: 2차(실장)로 넘기지 않는다.
        m6: pairsOf(result, 'emp-m6'),
        m6Reason: unpairedReason(result, 'emp-m6'),
        m5: pairsOf(result, 'emp-m5'),
        m5Reason: unpairedReason(result, 'emp-m5'),
      },
      { m2: ['emp-m2->emp-tl'], m6: [], m6Reason: 'EVALUATOR_INACTIVE', m5: [], m5Reason: 'NO_UPPER_STAGE' }
    )
  })

  await run('ⓕ 업적평가 대상이 아닌 사람(비활성 · 사이클 조직 밖)은 평가자로 나오지 않는다', async () => {
    const result = await suggest()
    assert.deepEqual(
      { gone: pairsOf(result, 'emp-gone'), other: pairsOf(result, 'emp-other') },
      { gone: [], other: [] }
    )
  })

  await run('ⓖ 배정 행의 평가자가 비활성이면 실제 업적평가와 같은 대체 평가자를 대상으로 한다', async () => {
    const result = await suggest()
    // 같은 fixture 로 업적평가 쪽 평가자 결정(getEvaluationStageChain)을 돌려 바로 위 평가자를 본다.
    const chain = await getEvaluationStageChain({ db: fakeDb as never, evalCycleId: 'cycle-1', targetId: 'emp-m4' })
    const evaluationUpper = chain.find((entry) => entry.stage !== 'SELF')
    assert.deepEqual(
      {
        upward: pairsOf(result, 'emp-m4'),
        evaluation: evaluationUpper ? `${evaluationUpper.stage}:${evaluationUpper.evaluatorId}` : null,
      },
      { upward: ['emp-m4->emp-tl'], evaluation: 'FIRST:emp-tl' }
    )
  })

  await run('보조: 대상(리더)별 평가자 수가 minRaters 미만이면 표시하고 짝은 만든다', async () => {
    const result = await suggest()
    const below = Object.fromEntries(result.belowMinRaters.map((item) => [item.evaluateeId, item.raterCount]))
    assert.deepEqual(
      {
        adminLead: below['emp-adminlead'] ?? null,
        div: below['emp-div'] ?? null,
        adminLeadPairsCreated: result.pairs.filter((pair) => pair.endsWith('->emp-adminlead')).length,
      },
      // 관리자팀장: 팀원3 = 1명 < 3 → 표시하고 짝은 만든다. 본부장: 팀장2 · 관리자팀장 · 실장 = 3명 → 표시하지 않는다.
      { adminLead: 1, div: null, adminLeadPairsCreated: 1 }
    )
  })

  await run('실제 Prisma 로 나간 호출이 없다(스텁하지 않은 DB 호출 0건)', () => {
    assert.deepEqual([...new Set(unstubbedCalls)], [])
  })

  console.log('Upward pairs by evaluation chain tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
