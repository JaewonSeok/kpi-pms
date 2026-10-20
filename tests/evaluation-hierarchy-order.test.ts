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

function employee(id: string, deptId: string, role: Role, joinDate: string, createdAt = joinDate) {
  return {
    id,
    empId: id,
    empName: id,
    deptId,
    role,
    status: 'ACTIVE' as const,
    joinDate: new Date(joinDate),
    createdAt: new Date(createdAt),
    teamLeaderId: null,
    sectionChiefId: null,
    divisionHeadId: null,
    jobTitle: null,
  }
}

// 부서장이 없는 팀에 같은 평가 역할(팀장) 리더가 둘 있다. 그러면 팀원의 1차는
// buildRoleBasedAssignments 의 버킷에서 고른다. 두 팀장은 joinDate·createdAt 이 같다.
const departments = [
  { id: 'div-1', deptName: '본부', parentDeptId: null, leaderEmployeeId: 'emp-div', excludeLeaderFromEvaluatorAutoAssign: false },
  { id: 'team-1', deptName: '팀', parentDeptId: 'div-1', leaderEmployeeId: null, excludeLeaderFromEvaluatorAutoAssign: false },
]

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items]
  return items.flatMap((item, index) =>
    permutations([...items.slice(0, index), ...items.slice(index + 1)]).map((rest) => [item, ...rest])
  )
}

async function main() {
  const { buildAssignments } = await import('../src/server/admin/employeeHierarchy')

  // 결과는 대상자 id 를 키로 비교한다. Map 의 삽입 순서는 보지 않는다.
  const byTarget = (result: ReturnType<typeof buildAssignments>) => Object.fromEntries(result)

  await run('① employees·departments 순열이 달라도 buildAssignments 결과가 같다 (동률 리더)', () => {
    const tiedEmployees = [
      employee('emp-div', 'div-1', 'ROLE_DIV_HEAD', '2020-01-01T00:00:00.000Z'),
      employee('emp-tl-b', 'team-1', 'ROLE_TEAM_LEADER', '2021-01-01T00:00:00.000Z'),
      employee('emp-tl-a', 'team-1', 'ROLE_TEAM_LEADER', '2021-01-01T00:00:00.000Z'),
      employee('emp-member', 'team-1', 'ROLE_MEMBER', '2022-01-01T00:00:00.000Z'),
    ]
    const departmentOrders = [departments, [...departments].reverse()]
    const results = permutations(tiedEmployees).flatMap((order) =>
      departmentOrders.map((departmentOrder) => byTarget(buildAssignments(departmentOrder, order)))
    )
    for (const result of results.slice(1)) {
      assert.deepEqual(result, results[0])
    }
  })

  await run('② 동률이 없으면 버킷 후보 중 joinDate 가 가장 이른 사람이 뽑힌다 (로더 순서 입력)', () => {
    // 로더와 같은 순서(joinDate → createdAt 오름차순)로 넣는다.
    const loaderOrdered = [
      employee('emp-div', 'div-1', 'ROLE_DIV_HEAD', '2020-01-01T00:00:00.000Z'),
      employee('emp-tl-early', 'team-1', 'ROLE_TEAM_LEADER', '2021-01-01T00:00:00.000Z'),
      employee('emp-tl-late', 'team-1', 'ROLE_TEAM_LEADER', '2021-06-01T00:00:00.000Z'),
      employee('emp-member', 'team-1', 'ROLE_MEMBER', '2022-01-01T00:00:00.000Z'),
    ]
    const result = buildAssignments(departments, loaderOrdered)
    assert.equal(result.get('emp-member')?.teamLeaderId, 'emp-tl-early')
  })

  console.log('Evaluation hierarchy order tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
