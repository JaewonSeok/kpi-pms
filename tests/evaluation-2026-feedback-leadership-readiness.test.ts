import './register-path-aliases'
import assert from 'node:assert/strict'
import {
  buildEvaluation2026FeedbackLeadershipReadinessFromInputs,
  type Evaluation2026FeedbackLeadershipDepartmentInput,
  type Evaluation2026FeedbackLeadershipEmployeeInput,
} from '../src/server/evaluation-2026-feedback-leadership-readiness'

process.env.DATABASE_URL ||= 'postgresql://postgres:password@localhost:5432/kpi_pms'

const departments: Evaluation2026FeedbackLeadershipDepartmentInput[] = [
  { id: 'div-1', deptName: '영업본부', parentDeptId: null },
  { id: 'sec-1', deptName: '영업1실', parentDeptId: 'div-1' },
  { id: 'team-1', deptName: '세일즈마케팅팀', parentDeptId: 'sec-1' },
]

function employee(overrides: Partial<Evaluation2026FeedbackLeadershipEmployeeInput>) {
  return {
    id: 'emp-1',
    empId: 'E001',
    empName: '김구성',
    gwsEmail: 'member@example.com',
    deptId: 'team-1',
    role: 'ROLE_MEMBER' as const,
    position: 'MEMBER' as const,
    status: 'ACTIVE' as const,
    ...overrides,
  } satisfies Evaluation2026FeedbackLeadershipEmployeeInput
}

const employees = [
  employee({ id: 'member-1', empId: 'E001', empName: '김구성' }),
  employee({
    id: 'leader-1',
    empId: 'L001',
    empName: '박팀장',
    role: 'ROLE_TEAM_LEADER',
    position: 'TEAM_LEADER',
  }),
  employee({
    id: 'head-1',
    empId: 'H001',
    empName: '최본부',
    role: 'ROLE_DIV_HEAD',
    position: 'DIV_HEAD',
  }),
]

async function run(name: string, fn: () => Promise<void> | void) {
  try {
    await fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

async function main() {
  await run('360 and leadership readiness show NOT_CONFIGURED when no round or cycle exists', () => {
    const result = buildEvaluation2026FeedbackLeadershipReadinessFromInputs({
      evalCycleId: 'cycle-2026',
      departments,
      employees,
      feedbackRounds: [],
      leadershipDiagnosisCycles: [],
      checkedAt: new Date('2026-05-26T00:00:00.000Z'),
    })

    assert.equal(result.readOnly, true)
    assert.equal(result.second360Feedback.status, 'NOT_CONFIGURED')
    assert.equal(result.leadershipDiagnosis.status, 'NOT_CONFIGURED')
    assert.equal(result.summary.targetEmployeeCount, 3)
    assert.equal(result.summary.targetLeaderCount, 2)
    assert.equal(result.summary.blockedOrNeedsSetupCount, result.rows.length)
    assert.equal(result.safety.totalScoreChanged, false)
    assert.equal(result.safety.gradeIdChanged, false)
    assert.equal(result.safety.evaluationsCreated, 0)
    assert.equal(result.safety.evaluationItemsCreated, 0)
    assert.equal(result.safety.notificationsSent, false)
    assert.equal(result.safety.emailsSent, false)
  })

  await run('missing reviewer assignment and missing response counts are reported', () => {
    const result = buildEvaluation2026FeedbackLeadershipReadinessFromInputs({
      evalCycleId: 'cycle-2026',
      departments,
      employees,
      feedbackRounds: [
        {
          id: 'round-1',
          roundName: '2026 2차 다면평가',
          roundType: 'FULL_360',
          status: 'IN_PROGRESS',
          startDate: new Date('2026-12-01T00:00:00.000Z'),
          endDate: new Date('2026-12-15T00:00:00.000Z'),
          minRaters: 3,
          maxRaters: 8,
          feedbacks: [
            {
              giverId: 'leader-1',
              receiverId: 'member-1',
              status: 'SUBMITTED',
              submittedAt: new Date('2026-12-02T00:00:00.000Z'),
            },
            {
              giverId: 'head-1',
              receiverId: 'member-1',
              status: 'PENDING',
              submittedAt: null,
            },
          ],
          nominations: [],
        },
      ],
      leadershipDiagnosisCycles: [
        {
          id: 'leadership-cycle-1',
          cycleName: '2026 리더십 진단',
          status: 'OPEN',
          startDate: null,
          endDate: null,
          evaluatorGroups: ['MANAGER', 'PEER', 'SUBORDINATE'],
          assignments: [
            {
              evaluatorId: 'member-1',
              evaluateeId: 'leader-1',
              evaluatorGroup: 'SUBORDINATE',
              status: 'SUBMITTED',
              response: {
                status: 'SUBMITTED',
                submittedAt: new Date('2026-12-02T00:00:00.000Z'),
              },
            },
          ],
        },
      ],
      checkedAt: new Date('2026-05-26T00:00:00.000Z'),
    })

    const feedbackRow = result.rows.find((row) => row.employeeId === 'member-1' && row.targetType === 'SECOND_360_FEEDBACK')
    const leadershipRow = result.rows.find((row) => row.employeeId === 'leader-1' && row.targetType === 'LEADERSHIP_DIAGNOSIS')

    assert.equal(feedbackRow?.readinessStatus, 'ASSIGNMENT_INCOMPLETE')
    assert.equal(feedbackRow?.missingReviewerAssignmentCount, 1)
    assert.equal(feedbackRow?.missingResponseCount, 1)
    assert.equal(leadershipRow?.readinessStatus, 'ASSIGNMENT_INCOMPLETE')
    assert.equal(leadershipRow?.missingReviewerAssignmentCount, 2)
    assert.equal(result.summary.responseSubmittedCount, 2)
    assert.equal(result.summary.blockedOrNeedsSetupCount > 0, true)
  })

  await run('leader target detection, completion rate, and export rows work for complete data', () => {
    const result = buildEvaluation2026FeedbackLeadershipReadinessFromInputs({
      evalCycleId: 'cycle-2026',
      departments,
      employees,
      feedbackRounds: [
        {
          id: 'round-1',
          roundName: '2026 2차 다면평가',
          roundType: 'FULL_360',
          status: 'COMPLETED',
          startDate: null,
          endDate: null,
          minRaters: 1,
          maxRaters: 8,
          feedbacks: [
            {
              giverId: 'leader-1',
              receiverId: 'member-1',
              status: 'SUBMITTED',
              submittedAt: new Date('2026-12-02T00:00:00.000Z'),
            },
          ],
          nominations: [],
        },
      ],
      leadershipDiagnosisCycles: [
        {
          id: 'leadership-cycle-1',
          cycleName: '2026 리더십 진단',
          status: 'CLOSED',
          startDate: null,
          endDate: null,
          evaluatorGroups: ['SUBORDINATE'],
          assignments: [
            {
              evaluatorId: 'member-1',
              evaluateeId: 'leader-1',
              evaluatorGroup: 'SUBORDINATE',
              status: 'SUBMITTED',
              response: {
                status: 'SUBMITTED',
                submittedAt: new Date('2026-12-02T00:00:00.000Z'),
              },
            },
            {
              evaluatorId: 'leader-1',
              evaluateeId: 'head-1',
              evaluatorGroup: 'SUBORDINATE',
              status: 'SUBMITTED',
              response: {
                status: 'SUBMITTED',
                submittedAt: new Date('2026-12-02T00:00:00.000Z'),
              },
            },
          ],
        },
      ],
      checkedAt: new Date('2026-05-26T00:00:00.000Z'),
    })

    assert.equal(result.second360Feedback.status, 'COMPLETE')
    assert.equal(result.leadershipDiagnosis.status, 'COMPLETE')
    assert.equal(result.summary.targetLeaderCount, 2)
    assert.equal(result.summary.completionRate, 100)
    assert.equal(result.summary.blockedOrNeedsSetupCount, 0)
    assert.equal(result.exportRows.some((row) => row.targetType === '리더십 진단' && row.employeeNo === 'L001'), true)
  })

  console.log('2026 feedback leadership readiness tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
