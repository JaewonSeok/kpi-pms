import './register-path-aliases'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import {
  AIAssistRequestSchema,
  MidReviewCycleSchema,
  SubmitMidReviewRecordSchema,
} from '../src/lib/validations'

function read(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')
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

async function main() {
  await run('mid-review operating layer is wired into the planned product surfaces', () => {
    assert.equal(read('src/components/checkin/CheckinClient.tsx').includes('MidReviewDetailDrawer'), true)
    assert.equal(
      read('src/components/admin/PerformanceDesignClient.tsx').includes('MidReviewOperationsPanel'),
      true
    )
    assert.equal(
      read('src/components/kpi/OrgKpiManagementClient.tsx').includes('MidReviewReferencePanel'),
      true
    )
    assert.equal(
      read('src/components/kpi/PersonalKpiManagementClient.tsx').includes('MidReviewReferencePanel'),
      true
    )
    assert.equal(
      read('src/components/kpi/MonthlyKpiManagementClient.tsx').includes('MidReviewReferencePanel'),
      true
    )
    assert.equal(
      read('src/components/evaluation/EvaluationWorkbenchClient.tsx').includes('MidReviewReferencePanel'),
      true
    )
    assert.equal(
      read('src/components/statistics/ExecutiveStatisticsDashboardClient.tsx').includes(
        'function MidReviewOperationsPanel'
      ),
      true
    )
    assert.equal(read('src/lib/utils.ts').includes("MIDYEAR_REVIEW: '중간 점검'"), true)
  })

  await run('mid-review cycle validation requires self due date for self-then-leader workflow', () => {
    const result = MidReviewCycleSchema.safeParse({
      name: '2026 상반기 중간 점검',
      reviewType: 'ASSESSMENT',
      workflowMode: 'SELF_THEN_LEADER',
      scopeTargetKind: 'EMPLOYEE',
      scopeDepartmentId: null,
      includeDescendants: false,
      startsAt: '2026-05-01T00:00:00.000Z',
      leaderDueAt: '2026-05-15T00:00:00.000Z',
      closesAt: '2026-05-20T00:00:00.000Z',
      status: 'DRAFT',
      peopleReviewEnabled: true,
      expectationTemplateEnabled: true,
    })

    assert.equal(result.success, false)
    assert.equal(result.error.issues.some((issue) => issue.path.join('.') === 'selfDueAt'), true)
  })

  await run('mid-review submit validation requires reason and adjustment content for goal redesign', () => {
    const result = SubmitMidReviewRecordSchema.safeParse({
      memberAchievements: '상반기 주요 성과를 정리했습니다.',
      milestoneReview: '',
      issueRiskSummary: '',
      nextPeriodPlan: '',
      agreedContext: '',
      directionClarity: 'CLEAR',
      directionClarityNote: '',
      leaderSummary: '',
      leaderCoachingMemo: '',
      goalReviews: [
        {
          personalKpiId: 'pk-1',
          goalValidityDecision: 'REVISE_GOAL',
          decisionReason: '',
          priorityAdjustmentMemo: '',
          executionAdjustmentMemo: '',
          expectedState: '',
          successScene: '',
          criteriaExceeds: '',
          criteriaMeets: '',
          criteriaBelow: '',
          revisionRequested: true,
        },
      ],
      actionItems: [],
    })

    assert.equal(result.success, false)
    assert.equal(result.error.issues.some((issue) => issue.path.join('.').includes('goalReviews')), true)
  })

  await run('mid-review submit validation requires support planning for high retention risk', () => {
    const result = SubmitMidReviewRecordSchema.safeParse({
      memberAchievements: '핵심 기여를 정리했습니다.',
      milestoneReview: '',
      issueRiskSummary: '',
      nextPeriodPlan: '',
      agreedContext: '',
      directionClarity: 'CLEAR',
      directionClarityNote: '',
      leaderSummary: '',
      leaderCoachingMemo: '',
      goalReviews: [
        {
          personalKpiId: 'pk-1',
          goalValidityDecision: 'KEEP_GOAL',
          decisionReason: '',
          priorityAdjustmentMemo: '',
          executionAdjustmentMemo: '',
          expectedState: '',
          successScene: '',
          criteriaExceeds: '',
          criteriaMeets: '',
          criteriaBelow: '',
          revisionRequested: false,
        },
      ],
      peopleReview: {
        retentionRiskLevel: 'HIGH',
        stayInterviewMemo: '핵심 과제 부담이 커졌습니다.',
        reboundGoal: '역할 집중도 회복',
        supportPlan: '',
        coachingPlan: '',
        nextFollowUpAt: null,
      },
      actionItems: [],
    })

    assert.equal(result.success, false)
    assert.equal(result.error.issues.some((issue) => issue.path.join('.').includes('supportPlan')), true)
    assert.equal(result.error.issues.some((issue) => issue.path.join('.').includes('nextFollowUpAt')), true)
  })

  await run('AI assist validation accepts MID_REVIEW_ASSIST payloads', () => {
    const result = AIAssistRequestSchema.safeParse({
      requestType: 'MID_REVIEW_ASSIST',
      sourceType: 'mid-review',
      sourceId: 'checkin-mid-1',
      payload: {
        mode: 'leader-coach',
        checkInId: 'checkin-mid-1',
      },
    })

    assert.equal(result.success, true)
  })

  console.log('Mid-review operating layer tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
