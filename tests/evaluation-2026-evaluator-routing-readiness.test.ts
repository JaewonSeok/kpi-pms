import './register-path-aliases'
import assert from 'node:assert/strict'
import Module from 'node:module'
import path from 'node:path'
// 타입만 가져온다. 런타임에 지워지므로 아래 prisma 스텁 해석 순서에 영향이 없다.
import type {
  Evaluation2026EvaluatorRoutingEmployeeInput,
  Evaluation2026EvaluatorRoutingReadinessResult,
} from '../src/server/evaluation-2026-evaluator-routing-readiness'

process.env.DATABASE_URL ||='postgresql://postgres:password@localhost:5432/kpi_pms'

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
    jobTitle: overrides.jobTitle ?? null,
  }
}

function rowOf(result: Evaluation2026EvaluatorRoutingReadinessResult, employeeId: string) {
  return result.rows.find((row) => row.employeeId === employeeId)
}

function activeAssignment(
  targetId: string,
  evalStage: 'FIRST' | 'SECOND' | 'FINAL' | 'CEO_ADJUST',
  evaluatorId: string,
  evaluator: Evaluation2026EvaluatorRoutingEmployeeInput
) {
  return { targetId, evalStage, evaluatorId, assignmentSource: 'MANUAL' as const, evaluator }
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

  // ROLE_ADMIN 은 권한 플래그다. 평가 역할은 jobTitle 에 있다. 기존 데이터에는 ADMIN·jobTitle 이 0건이었다.
  await run('(가) ROLE_ADMIN · 팀장 평가자는 FIRST 로 유효하다', () => {
    const result = buildEvaluation2026EvaluatorRoutingReadinessFromInputs({
      departments,
      employees: baseEmployees({ 'emp-tl': { role: 'ROLE_ADMIN', jobTitle: '팀장' } }),
      checkedAt: now,
    })
    assert.equal(rowOf(result, 'emp-member')?.expectedFirstEvaluator, '팀장 (L001)')
    assert.equal(rowOf(result, 'emp-member')?.status, 'READY')
  })

  await run('(나) ROLE_ADMIN · 본부장 평가자는 FINAL 로 유효하다', () => {
    const result = buildEvaluation2026EvaluatorRoutingReadinessFromInputs({
      departments,
      employees: baseEmployees({ 'emp-div': { role: 'ROLE_ADMIN', jobTitle: '본부장' } }),
      checkedAt: now,
    })
    assert.equal(rowOf(result, 'emp-member')?.expectedFinalApprover, '본부장 (D001)')
    assert.equal(rowOf(result, 'emp-member')?.status, 'READY')
  })

  await run('(다) ROLE_ADMIN · 실장 평가자는 SECOND 로 유효하다', () => {
    const result = buildEvaluation2026EvaluatorRoutingReadinessFromInputs({
      departments,
      employees: baseEmployees({ 'emp-sec': { role: 'ROLE_ADMIN', jobTitle: '실장' } }),
      checkedAt: now,
    })
    assert.equal(rowOf(result, 'emp-member')?.expectedSecondEvaluator, '실장 (S001)')
    assert.equal(rowOf(result, 'emp-member')?.status, 'READY')
  })

  await run('(라) 대상자 본인이 ROLE_ADMIN · 본부장이면 FIRST·SECOND 를 요구하지 않는다', () => {
    const result = buildEvaluation2026EvaluatorRoutingReadinessFromInputs({
      departments,
      employees: baseEmployees({ 'emp-div': { role: 'ROLE_ADMIN', jobTitle: '본부장' } }),
      checkedAt: now,
    })
    assert.deepEqual(rowOf(result, 'emp-div')?.missingEvaluatorTypes, [])
  })

  await run('(마) 대상자 본인이 ROLE_ADMIN · 팀장이면 SECOND·FINAL 만 요구한다', () => {
    const complete = buildEvaluation2026EvaluatorRoutingReadinessFromInputs({
      departments,
      employees: baseEmployees({ 'emp-tl': { role: 'ROLE_ADMIN', jobTitle: '팀장' } }),
      checkedAt: now,
    })
    // FIRST 가 비어 있어도 요구하지 않으므로 누락이 아니다.
    assert.deepEqual(rowOf(complete, 'emp-tl')?.missingEvaluatorTypes, [])

    const withoutSecond = buildEvaluation2026EvaluatorRoutingReadinessFromInputs({
      departments: departments.map((department) =>
        department.id === 'sec-1' ? { ...department, leaderEmployeeId: null } : department
      ),
      employees: baseEmployees({
        'emp-tl': { role: 'ROLE_ADMIN', jobTitle: '팀장' },
        'emp-sec': { status: 'INACTIVE' },
      }),
      checkedAt: now,
    })
    // SECOND 는 여전히 요구한다.
    assert.deepEqual(rowOf(withoutSecond, 'emp-tl')?.missingEvaluatorTypes, ['SECOND'])
  })

  await run('(바) 본부장 대상자의 FINAL 과 CEO_ADJUST 가 같은 대표여도 MANUAL_REVIEW 가 아니다', () => {
    const result = buildEvaluation2026EvaluatorRoutingReadinessFromInputs({
      departments,
      employees: baseEmployees(),
      checkedAt: now,
    })
    const divisionHead = rowOf(result, 'emp-div')
    assert.equal(divisionHead?.expectedFinalApprover, '대표 (C001)')
    assert.equal(divisionHead?.expectedCeoApprover, '대표 (C001)')
    assert.equal(divisionHead?.status, 'READY')
  })

  // targetEmployees 가 ROLE_CEO 를 대상자에서 뺀다(readiness L269 필터).
  // 그래서 대표의 CEO_ADJUST 자기 배정 오탐은 구조적으로 일어나지 않는다. 그 필터를 지킨다.
  await run('(사) 대표(ROLE_CEO)는 readiness 대상자 행에 없다', () => {
    const ceo = employee({ id: 'emp-ceo', empId: 'C001', empName: '대표', deptId: 'div-1', role: 'ROLE_CEO', managerId: null })
    const result = buildEvaluation2026EvaluatorRoutingReadinessFromInputs({
      departments,
      employees: baseEmployees(),
      assignments: [activeAssignment('emp-ceo', 'CEO_ADJUST', 'emp-ceo', ceo)],
      checkedAt: now,
    })
    assert.equal(result.rows.some((row) => row.role === 'ROLE_CEO'), false)
    assert.equal(rowOf(result, 'emp-ceo'), undefined)
  })

  await run('(아) 배정 가능 단계끼리 같은 평가자면 MANUAL_REVIEW 를 유지한다', () => {
    const divisionHead = employee({
      id: 'emp-div', empId: 'D001', empName: '본부장', deptId: 'div-1', role: 'ROLE_DIV_HEAD', managerId: 'emp-ceo',
    })
    const result = buildEvaluation2026EvaluatorRoutingReadinessFromInputs({
      departments,
      employees: baseEmployees(),
      assignments: [activeAssignment('emp-member', 'SECOND', 'emp-div', divisionHead)],
      checkedAt: now,
    })
    const member = rowOf(result, 'emp-member')
    assert.equal(member?.expectedSecondEvaluator, '본부장 (D001)')
    assert.equal(member?.expectedFinalApprover, '본부장 (D001)')
    assert.equal(member?.status, 'MANUAL_REVIEW')
  })

  await run('(자) ROLE_ADMIN · 팀원 평가자는 FIRST 로 유효하지 않다', () => {
    const adminMember = employee({ id: 'emp-admin', empId: 'A001', empName: '관리자', role: 'ROLE_ADMIN', jobTitle: '팀원' })
    const result = buildEvaluation2026EvaluatorRoutingReadinessFromInputs({
      departments,
      employees: [...baseEmployees(), adminMember],
      assignments: [activeAssignment('emp-member', 'FIRST', 'emp-admin', adminMember)],
      checkedAt: now,
    })
    assert.equal(rowOf(result, 'emp-member')?.expectedFirstEvaluator, '관리자 (A001)')
    assert.equal(rowOf(result, 'emp-member')?.status, 'MISSING_FIRST')
  })

  // CEO_ADJUST 의 중복 예외는 FINAL 과 같을 때만이다. FIRST·SECOND 와 같으면 여전히 중복이다.
  await run('(차) CEO_ADJUST 가 FIRST 와 같은 평가자면 MANUAL_REVIEW 를 유지한다', () => {
    const teamLeader = employee({
      id: 'emp-tl', empId: 'L001', empName: '팀장', role: 'ROLE_TEAM_LEADER', position: 'TEAM_LEADER', managerId: 'emp-sec',
    })
    const result = buildEvaluation2026EvaluatorRoutingReadinessFromInputs({
      departments,
      employees: baseEmployees(),
      assignments: [activeAssignment('emp-member', 'CEO_ADJUST', 'emp-tl', teamLeader)],
      checkedAt: now,
    })
    const member = rowOf(result, 'emp-member')
    assert.equal(member?.expectedFirstEvaluator, '팀장 (L001)')
    assert.equal(member?.expectedCeoApprover, '팀장 (L001)')
    assert.equal(member?.status, 'MANUAL_REVIEW')
  })

  // manual review 는 MANUAL_REVIEW 상태만 센다. MISSING_* 까지 세면 blockerCount 와 같은 값이 된다.
  await run('(카) MISSING_FIRST 는 manualReviewCount 에 세지 않고 blockerCount 에만 센다', () => {
    const result = buildEvaluation2026EvaluatorRoutingReadinessFromInputs({
      departments: departments.map((department) =>
        department.id === 'team-1' ? { ...department, leaderEmployeeId: null } : department
      ),
      employees: baseEmployees({
        'emp-tl': { status: 'INACTIVE' },
      }),
      checkedAt: now,
    })
    // 절대값 0 으로 박으면 다른 수정(B-3-3)에 묶인다. 집계식이 맞는지를 잰다.
    const manualReviewRows = result.rows.filter((row) => row.status === 'MANUAL_REVIEW').length
    assert.equal(rowOf(result, 'emp-member')?.status, 'MISSING_FIRST')
    assert.equal(result.summary.manualReviewCount, manualReviewRows)
    assert.ok(result.summary.manualReviewCount < result.summary.blockerCount)
  })

  console.log('2026 evaluator routing readiness tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
