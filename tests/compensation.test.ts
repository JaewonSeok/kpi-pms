import assert from 'node:assert/strict'
import {
  resolveWorkflowTransition,
  simulateCompensationScenario,
  summarizeRuleChangeImpact,
} from '../src/lib/compensation'

function run(name: string, fn: () => void) {
  try {
    fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

run('budget overflow is detected', () => {
  const result = simulateCompensationScenario({
    targets: [
      { employeeId: 'e1', employeeName: 'Kim', currentSalary: 100000000, gradeName: 'A0' },
      { employeeId: 'e2', employeeName: 'Lee', currentSalary: 80000000, gradeName: 'B+' },
    ],
    rules: [
      { gradeName: 'A0', bonusRate: 20, salaryIncreaseRate: 7 },
      { gradeName: 'B+', bonusRate: 15, salaryIncreaseRate: 5 },
    ],
    budgetLimit: 20000000,
    ruleVersionNo: 1,
  })

  assert.equal(result.isOverBudget, true)
  assert.equal(result.totalBonus, 32000000)
  assert.equal(result.totalSalaryIncrease, 11000000)
  assert.equal(result.totalCost, 43000000)
  assert.equal(result.overBudgetAmount, 23000000)
})

run('approval and rejection workflow transitions are enforced', () => {
  const submitted = resolveWorkflowTransition({
    action: 'SUBMIT',
    actorRole: 'ROLE_ADMIN',
    currentStatus: 'DRAFT',
    isLocked: false,
    isOverBudget: false,
    needsRecalculation: false,
  })
  assert.equal(submitted.nextStatus, 'UNDER_REVIEW')

  const reviewed = resolveWorkflowTransition({
    action: 'REVIEW_APPROVE',
    actorRole: 'ROLE_DIV_HEAD',
    currentStatus: 'UNDER_REVIEW',
    isLocked: false,
    isOverBudget: false,
    needsRecalculation: false,
  })
  assert.equal(reviewed.nextStatus, 'REVIEW_APPROVED')

  const rejected = resolveWorkflowTransition({
    action: 'REJECT',
    actorRole: 'ROLE_CEO',
    currentStatus: 'REVIEW_APPROVED',
    isLocked: false,
    isOverBudget: false,
    needsRecalculation: false,
  })
  assert.equal(rejected.nextStatus, 'REJECTED')

  const approved = resolveWorkflowTransition({
    action: 'FINAL_APPROVE',
    actorRole: 'ROLE_CEO',
    currentStatus: 'REVIEW_APPROVED',
    isLocked: false,
    isOverBudget: false,
    needsRecalculation: false,
  })
  assert.equal(approved.nextStatus, 'FINAL_APPROVED')
  assert.equal(approved.shouldLock, true)
  assert.equal(approved.shouldPublish, true)
})

run('permission separation blocks unauthorized actions', () => {
  assert.throws(
    () =>
      resolveWorkflowTransition({
        action: 'FINAL_APPROVE',
        actorRole: 'ROLE_ADMIN',
        currentStatus: 'REVIEW_APPROVED',
        isLocked: false,
        isOverBudget: false,
        needsRecalculation: false,
      }),
    /FORBIDDEN/
  )

  assert.throws(
    () =>
      resolveWorkflowTransition({
        action: 'SUBMIT',
        actorRole: 'ROLE_MEMBER',
        currentStatus: 'DRAFT',
        isLocked: false,
        isOverBudget: false,
        needsRecalculation: false,
      }),
    /FORBIDDEN/
  )
})

run('rule changes mark only unlocked scenarios for recalculation', () => {
  const impact = summarizeRuleChangeImpact([
    {
      id: 'draft-1',
      scenarioName: 'Draft',
      versionNo: 1,
      status: 'DRAFT',
      isLocked: false,
      employeeCount: 5,
    },
    {
      id: 'review-1',
      scenarioName: 'Review',
      versionNo: 2,
      status: 'UNDER_REVIEW',
      isLocked: false,
      employeeCount: 5,
    },
    {
      id: 'final-1',
      scenarioName: 'Final',
      versionNo: 3,
      status: 'FINAL_APPROVED',
      isLocked: true,
      employeeCount: 5,
    },
  ])

  assert.deepEqual(impact.recalculationRequiredScenarioIds.sort(), ['draft-1', 'review-1'])
  assert.equal(impact.recalculationRequiredCount, 2)
  assert.deepEqual(impact.unaffectedLockedScenarioIds, ['final-1'])
  assert.equal(impact.unaffectedPublishedEmployeeCount, 5)
})

console.log('Compensation tests completed')
