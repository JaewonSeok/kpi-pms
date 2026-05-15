import assert from 'node:assert/strict'
import {
  EVALUATION_SCORING_2026_FORMULA_VERSION,
  calculateEvaluationScore2026,
  calculateEvaluationScoreByFormulaVersion,
  calculateFinalPerformanceScore2026,
  calculateItemBaseScore2026,
  calculateItemScore2026,
  validateAdjustment2026,
  validateAdjustmentGroupZeroSum2026,
  type EvaluationScore2026Result,
} from '../src/server/evaluation-scoring-2026'

function run(name: string, fn: () => void) {
  try {
    fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

function expectOk<T>(result: EvaluationScore2026Result<T>) {
  assert.equal(result.ok, true)
  if (!result.ok) throw new Error('Expected result to be ok')
  return result.value
}

function expectError<T>(result: EvaluationScore2026Result<T>, code: string) {
  assert.equal(result.ok, false)
  if (result.ok) throw new Error('Expected result to be an error')
  assert.equal(result.errors.some((error) => error.code === code), true)
}

run('ORG_GOAL Target base score is 90', () => {
  const result = expectOk(calculateItemBaseScore2026({ category: 'ORG_GOAL', achievementLevel: 'TARGET' }))
  assert.equal(result.baseScore, 90)
})

run('ORG_GOAL Excellent base score is 100', () => {
  const result = expectOk(calculateItemBaseScore2026({ category: 'ORG_GOAL', achievementLevel: 'EXCELLENT' }))
  assert.equal(result.baseScore, 100)
})

run('PROJECT_T Target base score is 90', () => {
  const result = expectOk(calculateItemBaseScore2026({ category: 'PROJECT_T', achievementLevel: 'TARGET' }))
  assert.equal(result.baseScore, 90)
})

run('PROJECT_T Excellent base score is 100', () => {
  const result = expectOk(calculateItemBaseScore2026({ category: 'PROJECT_T', achievementLevel: 'EXCELLENT' }))
  assert.equal(result.baseScore, 100)
})

run('PROJECT_K Target base score is 80', () => {
  const result = expectOk(calculateItemBaseScore2026({ category: 'PROJECT_K', achievementLevel: 'TARGET' }))
  assert.equal(result.baseScore, 80)
})

run('PROJECT_K Excellent base score is 90', () => {
  const result = expectOk(calculateItemBaseScore2026({ category: 'PROJECT_K', achievementLevel: 'EXCELLENT' }))
  assert.equal(result.baseScore, 90)
})

run('DAILY_WORK score can be 80 at maximum', () => {
  const result = expectOk(calculateItemBaseScore2026({ category: 'DAILY_WORK', score: 80 }))
  assert.equal(result.baseScore, 80)
})

run('DAILY_WORK score over 80 is rejected', () => {
  expectError(
    calculateItemBaseScore2026({
      category: 'DAILY_WORK',
      score: 81,
    }),
    'DAILY_WORK_SCORE_EXCEEDS_MAX'
  )
})

run('final performance score uses 30/70 organization/personal formula', () => {
  assert.equal(
    calculateFinalPerformanceScore2026({
      organizationPerformanceScore: 100,
      personalPerformanceScore: 80,
    }),
    86
  )
})

run('+5 and -5 adjustments are allowed for eligible categories', () => {
  assert.equal(
    validateAdjustment2026({
      category: 'ORG_GOAL',
      achievementLevel: 'TARGET',
      baseScore: 90,
      adjustmentScore: 5,
    }).ok,
    true
  )
  assert.equal(
    validateAdjustment2026({
      category: 'PROJECT_T',
      achievementLevel: 'TARGET',
      baseScore: 90,
      adjustmentScore: -5,
    }).ok,
    true
  )
})

run('adjustments over +5 or below -5 are rejected', () => {
  expectError(
    validateAdjustment2026({
      category: 'ORG_GOAL',
      achievementLevel: 'TARGET',
      baseScore: 90,
      adjustmentScore: 6,
    }),
    'ADJUSTMENT_OUT_OF_RANGE'
  )
  expectError(
    validateAdjustment2026({
      category: 'PROJECT_K',
      achievementLevel: 'TARGET',
      baseScore: 80,
      adjustmentScore: -6,
    }),
    'ADJUSTMENT_OUT_OF_RANGE'
  )
})

run('DAILY_WORK adjustment is rejected', () => {
  expectError(
    calculateItemScore2026({
      category: 'DAILY_WORK',
      score: 70,
      adjustmentScore: 1,
    }),
    'ADJUSTMENT_CATEGORY_NOT_ALLOWED'
  )
})

run('adjustment below Target is rejected', () => {
  expectError(
    calculateItemScore2026({
      category: 'PROJECT_K',
      achievementLevel: 'BELOW_TARGET',
      score: 79,
      adjustmentScore: 1,
    }),
    'ADJUSTMENT_BELOW_TARGET_NOT_ALLOWED'
  )
})

run('adjustment group must sum to zero', () => {
  expectError(
    validateAdjustmentGroupZeroSum2026([
      { id: 'item-a', adjustmentScore: 5, adjustmentGroupKey: 'group-1' },
      { id: 'item-b', adjustmentScore: -3, adjustmentGroupKey: 'group-1' },
    ]),
    'ADJUSTMENT_GROUP_NOT_ZERO_SUM'
  )
  assert.equal(
    validateAdjustmentGroupZeroSum2026([
      { id: 'item-a', adjustmentScore: 5, adjustmentGroupKey: 'group-1' },
      { id: 'item-b', adjustmentScore: -5, adjustmentGroupKey: 'group-1' },
    ]).ok,
    true
  )
})

run('unknown or missing category cannot be scored under 2026 formula', () => {
  expectError(calculateItemBaseScore2026({ category: 'UNKNOWN', score: 90 }), 'UNKNOWN_CATEGORY')
  expectError(calculateItemBaseScore2026({ score: 90 }), 'CATEGORY_REQUIRED')
})

run('calculateEvaluationScore2026 returns item scores, split scores, and final score', () => {
  const result = expectOk(
    calculateEvaluationScore2026({
      items: [
        {
          id: 'org-1',
          category: 'ORG_GOAL',
          achievementLevel: 'TARGET',
          weight: 100,
          adjustmentScore: 5,
          adjustmentGroupKey: 'adj-1',
        },
        {
          id: 'project-t-1',
          category: 'PROJECT_T',
          achievementLevel: 'EXCELLENT',
          weight: 60,
          adjustmentScore: -5,
          adjustmentGroupKey: 'adj-1',
        },
        {
          id: 'daily-1',
          category: 'DAILY_WORK',
          score: 80,
          weight: 40,
        },
      ],
    })
  )

  assert.equal(result.formulaVersion, EVALUATION_SCORING_2026_FORMULA_VERSION)
  assert.equal(result.organizationPerformanceScore, 95)
  assert.equal(result.personalPerformanceScore, 89)
  assert.equal(result.finalScore, 90.8)
  assert.equal(result.itemScores.length, 3)
})

run('legacy scoring remains unchanged by default through formula-version adapter', () => {
  const result = expectOk(
    calculateEvaluationScoreByFormulaVersion({
      legacyScore: 83.4,
      items: [
        {
          category: 'ORG_GOAL',
          achievementLevel: 'EXCELLENT',
        },
      ],
    })
  )

  assert.equal(result.used2026Formula, false)
  assert.equal(result.score, 83.4)
  assert.equal(result.formulaVersion, 'LEGACY')
})

console.log('2026 evaluation scoring engine tests completed')
