import assert from 'node:assert/strict'
import { EVALUATION_POLICY_2026 } from '../src/lib/evaluation-policy-2026'
import {
  applyManualGradeAdjustmentPreview2026,
  calculateAbsoluteGrade2026,
  calculateGradePreview2026,
  compareScoreToThreshold2026,
  resolveGradeThresholdGroup2026,
  validateGradeThresholds2026,
  type EvaluationGrade2026Result,
} from '../src/server/evaluation-grade-2026'

function run(name: string, fn: () => void) {
  try {
    fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

function expectOk<T>(result: EvaluationGrade2026Result<T>) {
  assert.equal(result.ok, true)
  if (!result.ok) throw new Error('Expected result to be ok')
  return result.value
}

function expectError<T>(result: EvaluationGrade2026Result<T>, code: string) {
  assert.equal(result.ok, false)
  if (result.ok) throw new Error('Expected result to be an error')
  assert.equal(result.errors.some((error) => error.code === code), true)
}

run('every 2026 grade label exists', () => {
  assert.deepEqual(
    EVALUATION_POLICY_2026.grades.map((grade) => grade.label),
    ['Super', 'Outstanding', 'Excellent', 'Good', 'Need Improvement', 'Unsatisfactory']
  )
})

run('every 2026 threshold group exists', () => {
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
})

run('valid score maps to correct grade for non-sales member', () => {
  const result = expectOk(
    calculateAbsoluteGrade2026({
      score: 84,
      thresholdGroup: 'TEAM_MEMBER_NON_SALES',
    })
  )
  assert.equal(result.calculatedGrade.code, 'GOOD')
  assert.equal(result.finalGrade.label, 'Good')
})

run('valid score maps to correct grade for non-sales team/section leader', () => {
  const result = expectOk(
    calculateAbsoluteGrade2026({
      score: 117,
      thresholdGroup: 'TEAM_SECTION_LEADER_NON_SALES',
    })
  )
  assert.equal(result.calculatedGrade.code, 'OUTSTANDING')
})

run('valid score maps to correct grade for sales member when score is outside ambiguous overlap', () => {
  const result = expectOk(
    calculateAbsoluteGrade2026({
      score: 105,
      thresholdGroup: 'TEAM_MEMBER_SALES',
    })
  )
  assert.equal(result.calculatedGrade.code, 'EXCELLENT')
})

run('valid score maps to correct grade for sales team/section leader', () => {
  const result = expectOk(
    calculateAbsoluteGrade2026({
      score: 105,
      thresholdGroup: 'TEAM_SECTION_LEADER_SALES',
    })
  )
  assert.equal(result.calculatedGrade.code, 'OUTSTANDING')
})

run('valid score maps to correct grade for division head', () => {
  const result = expectOk(
    calculateAbsoluteGrade2026({
      score: 120,
      thresholdGroup: 'DIVISION_HEAD',
    })
  )
  assert.equal(result.calculatedGrade.code, 'SUPER')
})

run('boundary conditions use min inclusive and max exclusive rules', () => {
  assert.equal(
    expectOk(calculateAbsoluteGrade2026({ score: 115, thresholdGroup: 'TEAM_SECTION_LEADER_NON_SALES' }))
      .calculatedGrade.code,
    'OUTSTANDING'
  )
  assert.equal(
    expectOk(calculateAbsoluteGrade2026({ score: 120, thresholdGroup: 'TEAM_SECTION_LEADER_NON_SALES' }))
      .calculatedGrade.code,
    'SUPER'
  )
  assert.equal(
    expectOk(calculateAbsoluteGrade2026({ score: 90, thresholdGroup: 'TEAM_SECTION_LEADER_NON_SALES' }))
      .calculatedGrade.code,
    'GOOD'
  )
  assert.equal(
    expectOk(calculateAbsoluteGrade2026({ score: 80, thresholdGroup: 'TEAM_SECTION_LEADER_NON_SALES' }))
      .calculatedGrade.code,
    'NEED_IMPROVEMENT'
  )
  assert.equal(
    compareScoreToThreshold2026(85, { minInclusive: 75, maxExclusive: 85 }).matches,
    false
  )
})

run('missing threshold group returns safe error', () => {
  expectError(
    resolveGradeThresholdGroup2026({
      thresholdGroup: 'UNKNOWN_GROUP' as never,
    }),
    'GRADE_THRESHOLD_GROUP_NOT_FOUND'
  )
})

run('ambiguous threshold group is surfaced safely and not guessed', () => {
  const result = calculateAbsoluteGrade2026({
    score: 110,
    thresholdGroup: 'TEAM_MEMBER_SALES',
  })
  expectError(result, 'AMBIGUOUS_THRESHOLD_MATCH')
  if (!result.ok) {
    assert.equal(result.errors.some((error) => error.requiresPolicyConfirmation), true)
    assert.equal(result.warnings.some((warning) => warning.code === 'POLICY_CONFIRMATION_REQUIRED'), true)
  }

  const validation = expectOk(validateGradeThresholds2026())
  assert.equal(validation.requiresPolicyConfirmation, true)
  assert.equal(validation.selectionOnlyGrades.some((row) => row.group === 'TEAM_MEMBER_NON_SALES'), true)
})

run('manual grade adjustment without reason is rejected', () => {
  const calculated = expectOk(calculateAbsoluteGrade2026({ score: 84, thresholdGroup: 'TEAM_MEMBER_NON_SALES' }))
  expectError(
    applyManualGradeAdjustmentPreview2026(calculated, {
      adjustedGrade: 'EXCELLENT',
      reason: ' ',
    }),
    'MANUAL_ADJUSTMENT_REASON_REQUIRED'
  )
})

run('manual grade adjustment with reason is accepted as preview result', () => {
  const calculated = expectOk(calculateAbsoluteGrade2026({ score: 84, thresholdGroup: 'TEAM_MEMBER_NON_SALES' }))
  const adjusted = expectOk(
    applyManualGradeAdjustmentPreview2026(calculated, {
      adjustedGrade: 'EXCELLENT',
      reason: '핵심 프로젝트 추가 기여 확인',
    })
  )

  assert.equal(adjusted.calculatedGrade.code, 'GOOD')
  assert.equal(adjusted.finalGrade.code, 'EXCELLENT')
  assert.equal(adjusted.manualAdjustment?.originalGrade.code, 'GOOD')
  assert.equal(adjusted.manualAdjustment?.reason, '핵심 프로젝트 추가 기여 확인')
})

run('legacy grade behavior remains unchanged by default through grade preview adapter', () => {
  const preview = expectOk(
    calculateGradePreview2026({
      legacyGrade: 'A0',
      score: 120,
      thresholdGroup: 'DIVISION_HEAD',
    })
  )

  assert.equal(preview.used2026Grade, false)
  assert.equal(preview.grade, 'A0')
  assert.equal(preview.formulaVersion, 'LEGACY')
})

run('explicit 2026 grade preview calculates policy grade without live activation', () => {
  const preview = expectOk(
    calculateGradePreview2026({
      formulaVersion: '2026',
      legacyGrade: 'A0',
      score: 120,
      thresholdGroup: 'DIVISION_HEAD',
      manualAdjustment: {
        adjustedGrade: 'OUTSTANDING',
        reason: '대표 조정 preview',
      },
    })
  )

  assert.equal(preview.used2026Grade, true)
  assert.equal(preview.grade, 'Outstanding')
  assert.equal(preview.result2026?.calculatedGrade.code, 'SUPER')
  assert.equal(preview.result2026?.finalGrade.code, 'OUTSTANDING')
})

console.log('2026 evaluation grade threshold engine tests completed')
