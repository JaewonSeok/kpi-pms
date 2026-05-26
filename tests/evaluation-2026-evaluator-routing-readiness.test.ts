import './register-path-aliases'
import assert from 'node:assert/strict'
import Module from 'node:module'
import path from 'node:path'

process.env.DATABASE_URL ||= 'postgresql://postgres:password@localhost:5432/kpi_pms'

type ResolveFilename = (
  request: string,
  parent: NodeModule | null | undefined,
  isMain: boolean,
  options?: unknown
) => string

const moduleLoader = Module as typeof Module & {
  _resolveFilename: ResolveFilename
}
const previousResolveFilename = moduleLoader._resolveFilename
moduleLoader._resolveFilename = function resolveFilename(request, parent, isMain, options) {
  const parentFilename = (parent as { filename?: string } | null | undefined)?.filename ?? ''
  const isPrismaRequest =
    request === '@/lib/prisma' ||
    ((request === './prisma' || request === '../prisma') &&
      parentFilename.includes(`${path.sep}src${path.sep}`))

  if (isPrismaRequest) {
    return path.resolve(process.cwd(), 'tests/stubs/prisma.js')
  }

  return previousResolveFilename.call(this, request, parent, isMain, options)
}

async function run(name: string, fn: () => Promise<void> | void) {
  try {
    await fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

const now = new Date('2026-05-26T00:00:00.000Z')

const departments = [
  {
    id: 'div-1',
    deptName: '성장본부',
    parentDeptId: null,
    leaderEmployeeId: 'emp-div',
    excludeLeaderFromEvaluatorAutoAssign: false,
  },
  {
    id: 'sec-1',
    deptName: '전략실',
    parentDeptId: 'div-1',
    leaderEmployeeId: 'emp-sec',
    excludeLeaderFromEvaluatorAutoAssign: false,
  },
  {
    id: 'team-1',
    deptName: '성장팀',
    parentDeptId: 'sec-1',
    leaderEmployeeId: 'emp-tl',
    excludeLeaderFromEvaluatorAutoAssign: false,
  },
]

function employee(overrides: Partial<any> = {}) {
  const id = overrides.id ?? 'emp-member'
  return {
    id,
    empId: overrides.empId ?? id,
    empName: overrides.empName ?? id,
    gwsEmail: overrides.gwsEmail ?? `${id}@example.com`,
    deptId: overrides.deptId ?? 'team-1',
    role: overrides.role ?? 'ROLE_MEMBER',
    position: overrides.position ?? 'MEMBER',
    status: overrides.status ?? 'ACTIVE',
    managerId: Object.prototype.hasOwnProperty.call(overrides, 'managerId') ? overrides.managerId : 'emp-tl',
    teamLeaderId: overrides.teamLeaderId ?? null,
    sectionChiefId: overrides.sectionChiefId ?? null,
    divisionHeadId: overrides.divisionHeadId ?? null,
    joinDate: now,
    createdAt: now,
  }
}

function baseEmployees(overrides: Record<string, Partial<any>> = {}) {
  return [
    employee({ id: 'emp-member', empId: 'M001', empName: '멤버', ...overrides['emp-member'] }),
    employee({
      id: 'emp-tl',
      empId: 'L001',
      empName: '팀장',
      role: 'ROLE_TEAM_LEADER',
      position: 'TEAM_LEADER',
      managerId: 'emp-sec',
      ...overrides['emp-tl'],
    }),
    employee({
      id: 'emp-sec',
      empId: 'S001',
      empName: '실장',
      deptId: 'sec-1',
      role: 'ROLE_SECTION_CHIEF',
      position: 'SECTION_CHIEF',
      managerId: 'emp-div',
      ...overrides['emp-sec'],
    }),
    employee({
      id: 'emp-div',
      empId: 'D001',
      empName: '본부장',
      deptId: 'div-1',
      role: 'ROLE_DIV_HEAD',
      position: 'DIV_HEAD',
      managerId: 'emp-ceo',
      ...overrides['emp-div'],
    }),
    employee({
      id: 'emp-ceo',
      empId: 'C001',
      empName: '대표',
      deptId: 'div-1',
      role: 'ROLE_CEO',
      position: 'CEO',
      managerId: null,
      ...overrides['emp-ceo'],
    }),
  ]
}

async function main() {
  const {
    buildEvaluation2026EvaluatorRoutingReadinessFromInputs,
  } = await import('../src/server/evaluation-2026-evaluator-routing-readiness')

  await run('complete evaluator chain is READY', () => {
    const result = buildEvaluation2026EvaluatorRoutingReadinessFromInputs({
      evalCycleId: 'cycle-2026',
      departments,
      employees: baseEmployees(),
      checkedAt: now,
    })
    const member = result.rows.find((row: any) => row.employeeId === 'emp-member')

    assert.equal(result.summary.activeEmployeeCount, 4)
    assert.equal(member?.status, 'READY')
    assert.equal(member?.expectedFirstEvaluator, '팀장 (L001)')
    assert.equal(member?.expectedSecondEvaluator, '실장 (S001)')
    assert.equal(member?.expectedFinalApprover, '본부장 (D001)')
  })

  await run('missing team leader creates MISSING_FIRST', () => {
    const result = buildEvaluation2026EvaluatorRoutingReadinessFromInputs({
      departments: departments.map((department) =>
        department.id === 'team-1' ? { ...department, leaderEmployeeId: null } : department
      ),
      employees: baseEmployees({
        'emp-tl': { status: 'INACTIVE' },
      }),
      checkedAt: now,
    })
    const member = result.rows.find((row: any) => row.employeeId === 'emp-member')

    assert.equal(member?.status, 'MISSING_FIRST')
    assert.equal(result.summary.missingFirstEvaluatorCount, 1)
  })

  await run('missing section or division evaluator creates MISSING_SECOND', () => {
    const result = buildEvaluation2026EvaluatorRoutingReadinessFromInputs({
      departments: [
        departments[0],
        { ...departments[1], leaderEmployeeId: null },
        departments[2],
      ],
      employees: baseEmployees({
        'emp-sec': { status: 'INACTIVE' },
        'emp-div': { status: 'INACTIVE' },
      }),
      checkedAt: now,
    })
    const member = result.rows.find((row: any) => row.employeeId === 'emp-member')

    assert.equal(member?.status, 'MISSING_SECOND')
    assert.ok(result.summary.missingSecondEvaluatorCount >= 1)
  })

  await run('missing final approver creates MISSING_FINAL', () => {
    const result = buildEvaluation2026EvaluatorRoutingReadinessFromInputs({
      departments: departments.map((department) =>
        department.id === 'div-1' ? { ...department, leaderEmployeeId: null } : department
      ),
      employees: baseEmployees({
        'emp-div': { status: 'INACTIVE' },
        'emp-ceo': { status: 'INACTIVE' },
      }),
      checkedAt: now,
    })
    const member = result.rows.find((row: any) => row.employeeId === 'emp-member')

    assert.equal(member?.status, 'MISSING_FINAL')
    assert.ok(result.summary.missingFinalApproverCount >= 1)
  })

  await run('inactive evaluator warning is reported from current assignment rows', () => {
    const inactiveLeader = employee({
      id: 'inactive-leader',
      empId: 'I001',
      empName: '비활성 평가자',
      role: 'ROLE_TEAM_LEADER',
      position: 'TEAM_LEADER',
      status: 'INACTIVE',
    })
    const result = buildEvaluation2026EvaluatorRoutingReadinessFromInputs({
      departments,
      employees: [...baseEmployees(), inactiveLeader],
      assignments: [
        {
          targetId: 'emp-member',
          evalStage: 'FIRST',
          evaluatorId: 'inactive-leader',
          assignmentSource: 'MANUAL',
          evaluator: inactiveLeader,
        },
      ],
      checkedAt: now,
    })
    const member = result.rows.find((row: any) => row.employeeId === 'emp-member')

    assert.equal(member?.warnings.some((warning: string) => warning.includes('비활성')), true)
    assert.equal(result.summary.inactiveEvaluatorWarningCount, 1)
  })

  await run('self-evaluator warning and manager missing warning are reported', () => {
    const result = buildEvaluation2026EvaluatorRoutingReadinessFromInputs({
      departments,
      employees: baseEmployees({
        'emp-member': { managerId: null },
      }),
      assignments: [
        {
          targetId: 'emp-member',
          evalStage: 'FIRST',
          evaluatorId: 'emp-member',
          assignmentSource: 'MANUAL',
          evaluator: employee({ id: 'emp-member', empId: 'M001', empName: '멤버' }),
        },
      ],
      checkedAt: now,
    })
    const member = result.rows.find((row: any) => row.employeeId === 'emp-member')

    assert.equal(member?.warnings.some((warning: string) => warning.includes('자기 자신')), true)
    assert.equal(member?.warnings.some((warning: string) => warning.includes('manager')), true)
    assert.equal(result.summary.selfEvaluatorWarningCount, 1)
    assert.equal(result.summary.managerEmployeeNoMissingCount, 1)
  })

  await run('export rows include expected routing fields and no official writes', () => {
    const result = buildEvaluation2026EvaluatorRoutingReadinessFromInputs({
      departments,
      employees: baseEmployees(),
      checkedAt: now,
    })
    const member = result.rows.find((row: any) => row.employeeId === 'emp-member')

    assert.equal(member?.employeeNo, 'M001')
    assert.equal(member?.departmentPath, '성장본부 > 전략실 > 성장팀')
    assert.equal(result.safety.writesPerformed, false)
    assert.equal(result.safety.evaluationsCreated, 0)
    assert.equal(result.safety.evaluationItemsCreated, 0)
    assert.equal(result.safety.totalScoreChanged, false)
    assert.equal(result.safety.gradeIdChanged, false)
    assert.equal(result.safety.officialScoringEnabled, false)
    assert.equal(result.safety.officialGradeEnabled, false)
  })

  console.log('2026 evaluator routing readiness tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
