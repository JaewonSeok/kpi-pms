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

const now = new Date('2026-10-20T00:00:00.000Z')

const departments = [
  { id: 'div-1', deptName: '성장본부', parentDeptId: null, leaderEmployeeId: 'emp-div', excludeLeaderFromEvaluatorAutoAssign: false },
  { id: 'sec-1', deptName: '전략실', parentDeptId: 'div-1', leaderEmployeeId: 'emp-sec', excludeLeaderFromEvaluatorAutoAssign: false },
  { id: 'team-1', deptName: '성장팀', parentDeptId: 'sec-1', leaderEmployeeId: 'emp-tl', excludeLeaderFromEvaluatorAutoAssign: false },
]

type Role = 'ROLE_MEMBER' | 'ROLE_ADMIN' | 'ROLE_TEAM_LEADER' | 'ROLE_SECTION_CHIEF' | 'ROLE_DIV_HEAD' | 'ROLE_CEO'

function employee(id: string, deptId: string, role: Role, jobTitle: string | null = null) {
  return {
    id,
    empId: id,
    empName: id,
    gwsEmail: `${id}@example.com`,
    deptId,
    role,
    position: 'MEMBER' as const,
    status: 'ACTIVE' as const,
    managerId: null,
    teamLeaderId: null,
    sectionChiefId: null,
    divisionHeadId: null,
    joinDate: now,
    createdAt: now,
    jobTitle,
  }
}

// 위 계층에 하위 역할 리더를 하나씩 둔다. ADMIN 리더를 팀원처럼 다루면 이들이 상위 리더의
// 평가자로 끌려 들어와 배정이 갈린다.
function buildEmployees(subjectId: string, subjectRole: Role, subjectJobTitle: string | null) {
  const base: Record<string, ReturnType<typeof employee>> = {
    'emp-div': employee('emp-div', 'div-1', 'ROLE_DIV_HEAD', '본부장'),
    'emp-sec': employee('emp-sec', 'sec-1', 'ROLE_SECTION_CHIEF', '실장'),
    'emp-tl': employee('emp-tl', 'team-1', 'ROLE_TEAM_LEADER', '팀장'),
    'emp-member': employee('emp-member', 'team-1', 'ROLE_MEMBER'),
    'emp-x-tl': employee('emp-x-tl', 'div-1', 'ROLE_TEAM_LEADER', '팀장'),
    'emp-x-sc': employee('emp-x-sc', 'div-1', 'ROLE_SECTION_CHIEF', '실장'),
    'emp-y-tl': employee('emp-y-tl', 'sec-1', 'ROLE_TEAM_LEADER', '팀장'),
    'emp-ceo': employee('emp-ceo', 'div-1', 'ROLE_CEO', '대표이사'),
  }
  base[subjectId] = { ...base[subjectId], role: subjectRole, jobTitle: subjectJobTitle }
  return Object.values(base)
}

async function main() {
  const { resolveAdminJobTitleLeaderTier } = await import('../src/lib/evaluation-leader-role')
  const { buildAssignments } = await import('../src/server/admin/employeeHierarchy')
  const { buildEvaluation2026EvaluatorRoutingReadinessFromInputs } = await import(
    '../src/server/evaluation-2026-evaluator-routing-readiness'
  )

  // 대응표는 resolveAdminJobTitleLeaderTier 가 정한다. 여기서는 입력 jobTitle 만 나열한다.
  const jobTitles: Array<string | null> = ['팀장', '실장', '부문장', '본부장', '대표이사', '팀원', '파트장', null]
  const SUBJECT_BY_TIER: Record<string, string> = {
    TEAM_LEADER: 'emp-tl',
    SECTION_CHIEF: 'emp-sec',
    DIV_HEAD: 'emp-div',
  }

  for (const jobTitle of jobTitles) {
    const tier = resolveAdminJobTitleLeaderTier(jobTitle)
    // tier 가 없으면 ADMIN 은 팀원과 같아야 한다.
    const equivalentRole = (tier ? `ROLE_${tier}` : 'ROLE_MEMBER') as Role
    const subjectId = tier ? SUBJECT_BY_TIER[tier] : 'emp-tl'
    const label = `${jobTitle ?? 'NULL'} — ${equivalentRole} vs ROLE_ADMIN (${subjectId})`

    await run(`① buildAssignments 결과가 같다: ${label}`, () => {
      const asRole = Object.fromEntries(buildAssignments(departments, buildEmployees(subjectId, equivalentRole, jobTitle)))
      const asAdmin = Object.fromEntries(buildAssignments(departments, buildEmployees(subjectId, 'ROLE_ADMIN', jobTitle)))
      assert.deepEqual(asAdmin, asRole)
    })

    await run(`② readiness 판정이 같다: ${label}`, () => {
      const judge = (role: Role) => {
        const result = buildEvaluation2026EvaluatorRoutingReadinessFromInputs({
          departments,
          employees: buildEmployees(subjectId, role, jobTitle),
          checkedAt: now,
        })
        return {
          blockerCount: result.summary.blockerCount,
          rows: result.rows
            .map((row) => ({
              employeeId: row.employeeId,
              status: row.status,
              missing: row.missingEvaluatorTypes,
              skipped: row.skippedEvaluatorTypes,
            }))
            .sort((left, right) => left.employeeId.localeCompare(right.employeeId)),
        }
      }
      assert.deepEqual(judge('ROLE_ADMIN'), judge(equivalentRole))
    })
  }

  console.log('Evaluation leader role tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
