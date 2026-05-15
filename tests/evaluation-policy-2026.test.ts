import assert from 'node:assert/strict'
import {
  EVALUATION_POLICIES_BY_YEAR,
  EVALUATION_POLICY_2026,
  EVALUATION_POLICY_ITEM_CATEGORY_CODES,
  getEvaluationPolicy,
  isEvaluationPolicyItemCategory,
} from '../src/lib/evaluation-policy-2026'

function run(name: string, fn: () => void) {
  try {
    fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

run('2026 policy config is year and version aware', () => {
  assert.equal(EVALUATION_POLICY_2026.year, 2026)
  assert.equal(EVALUATION_POLICY_2026.version, '2026-PPT-PHASE0')
  assert.equal(getEvaluationPolicy(2026), EVALUATION_POLICY_2026)
  assert.equal(EVALUATION_POLICIES_BY_YEAR[2026], EVALUATION_POLICY_2026)
  assert.equal(getEvaluationPolicy(2025), undefined)
})

run('2026 policy config has all required evaluation item categories', () => {
  assert.deepEqual([...EVALUATION_POLICY_ITEM_CATEGORY_CODES], [
    'ORG_GOAL',
    'PROJECT_T',
    'PROJECT_K',
    'DAILY_WORK',
  ])
  assert.equal(EVALUATION_POLICY_2026.categories.ORG_GOAL.labelKo, '조직목표')
  assert.equal(EVALUATION_POLICY_2026.categories.PROJECT_T.labelKo, '프로젝트 T')
  assert.equal(EVALUATION_POLICY_2026.categories.PROJECT_K.labelKo, '프로젝트 K')
  assert.equal(EVALUATION_POLICY_2026.categories.DAILY_WORK.labelKo, '일상업무')
  assert.equal(isEvaluationPolicyItemCategory('ORG_GOAL'), true)
  assert.equal(isEvaluationPolicyItemCategory('UNKNOWN'), false)
})

run('2026 policy baseline scores match the PPT policy', () => {
  assert.deepEqual(EVALUATION_POLICY_2026.categories.ORG_GOAL.baselineScores, {
    target: 90,
    excellent: 100,
  })
  assert.deepEqual(EVALUATION_POLICY_2026.categories.PROJECT_T.baselineScores, {
    target: 90,
    excellent: 100,
  })
  assert.deepEqual(EVALUATION_POLICY_2026.categories.PROJECT_K.baselineScores, {
    target: 80,
    excellent: 90,
  })
  assert.equal(EVALUATION_POLICY_2026.categories.DAILY_WORK.maxScore, 80)
})

run('2026 policy final score formula is represented but inactive', () => {
  assert.equal(EVALUATION_POLICY_2026.finalScoreFormula.organizationPerformanceWeight, 30)
  assert.equal(EVALUATION_POLICY_2026.finalScoreFormula.personalPerformanceWeight, 70)
  assert.equal(EVALUATION_POLICY_2026.finalScoreFormula.active, false)
})

run('2026 policy adjustment rule is represented but inactive', () => {
  assert.equal(EVALUATION_POLICY_2026.adjustmentRule.min, -5)
  assert.equal(EVALUATION_POLICY_2026.adjustmentRule.max, 5)
  assert.equal(EVALUATION_POLICY_2026.adjustmentRule.zeroSumRequired, true)
  assert.deepEqual(EVALUATION_POLICY_2026.adjustmentRule.applicableCategories, [
    'ORG_GOAL',
    'PROJECT_T',
    'PROJECT_K',
  ])
  assert.equal(EVALUATION_POLICY_2026.adjustmentRule.notApplicableBelowTarget, true)
  assert.equal(EVALUATION_POLICY_2026.adjustmentRule.active, false)
})

run('2026 AI capability policy is pass/fail and excluded from annual score', () => {
  assert.equal(EVALUATION_POLICY_2026.aiCapability.annualEvaluationScoreIncluded, false)
  assert.equal(EVALUATION_POLICY_2026.aiCapability.levelUpRequirementStartsFromYear, 2028)
  assert.equal(EVALUATION_POLICY_2026.aiCapability.evaluationMode, 'PASS_FAIL')
  assert.deepEqual(EVALUATION_POLICY_2026.aiCapability.applicableTargets, ['TEAM_LEADER', 'MEMBER'])
  assert.deepEqual(EVALUATION_POLICY_2026.aiCapability.excludedTargets, ['SECTION_CHIEF', 'DIV_HEAD'])
  assert.deepEqual(
    EVALUATION_POLICY_2026.aiCapability.recognitionRoutes.map((route) => route.code),
    ['AI_PROJECT_TK', 'ORG_CONTRIBUTION_USE_CASE', 'AI_PRACTICAL_CERTIFICATION']
  )
})

run('2026 grade labels and threshold groups are present', () => {
  assert.deepEqual(
    EVALUATION_POLICY_2026.grades.map((grade) => grade.label),
    ['Super', 'Outstanding', 'Excellent', 'Good', 'Need Improvement', 'Unsatisfactory']
  )
  assert.deepEqual(
    EVALUATION_POLICY_2026.gradeThresholdGroups.map((group) => group.group),
    [
      'TEAM_MEMBER_NON_SALES',
      'TEAM_SECTION_LEADER_NON_SALES',
      'TEAM_MEMBER_SALES',
      'TEAM_SECTION_LEADER_SALES',
      'DIVISION_HEAD',
    ]
  )
  for (const group of EVALUATION_POLICY_2026.gradeThresholdGroups) {
    assert.ok(group.thresholds.UNSATISFACTORY)
    assert.ok(group.thresholds.GOOD)
  }
})

console.log('2026 evaluation policy config tests completed')
