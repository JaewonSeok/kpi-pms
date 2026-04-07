import assert from 'node:assert/strict'
import './register-path-aliases'
import {
  DEFAULT_FEEDBACK_MANAGER_EFFECTIVENESS_SETTINGS,
  buildManagerEffectivenessCoachingPack,
  getManagerEffectivenessReviewerSummary,
  getManagerEffectivenessRiskLevel,
  isManagerEffectivenessTarget,
  isRelationshipEnabledForManagerEffectiveness,
  parseFeedbackManagerEffectivenessSettings,
} from '../src/lib/feedback-manager-effectiveness'

async function run(name: string, fn: () => void | Promise<void>) {
  try {
    await fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

async function main() {
  await run('manager effectiveness settings parser falls back to defaults', () => {
    const parsed = parseFeedbackManagerEffectivenessSettings(undefined)

    assert.deepEqual(parsed, DEFAULT_FEEDBACK_MANAGER_EFFECTIVENESS_SETTINGS)
  })

  await run('reviewer relationships respect enabled combinations', () => {
    const parsed = parseFeedbackManagerEffectivenessSettings({
      enabled: true,
      reviewerCombination: {
        self: true,
        supervisor: false,
        peer: true,
        subordinate: false,
      },
      competencyLabels: ['코칭'],
    })

    assert.equal(isRelationshipEnabledForManagerEffectiveness('SELF', parsed), true)
    assert.equal(isRelationshipEnabledForManagerEffectiveness('SUPERVISOR', parsed), false)
    assert.equal(isRelationshipEnabledForManagerEffectiveness('PEER', parsed), true)
    assert.equal(isRelationshipEnabledForManagerEffectiveness('SUBORDINATE', parsed), false)
    assert.deepEqual(getManagerEffectivenessReviewerSummary(parsed), ['자기평가', '동료 리더'])
  })

  await run('manager target detection works for position and direct reports', () => {
    assert.equal(isManagerEffectivenessTarget({ position: 'TEAM_LEADER' }), true)
    assert.equal(isManagerEffectivenessTarget({ position: 'ROLE_MEMBER', directReportCount: 2 }), true)
    assert.equal(isManagerEffectivenessTarget({ position: 'ROLE_MEMBER', directReportCount: 0 }), false)
  })

  await run('risk level reflects missing scores and negative benchmark gaps', () => {
    assert.equal(
      getManagerEffectivenessRiskLevel({ overallScore: null, benchmarkDelta: null, improvementCount: 0 }),
      'HIGH'
    )
    assert.equal(
      getManagerEffectivenessRiskLevel({ overallScore: 3.2, benchmarkDelta: -0.8, improvementCount: 1 }),
      'HIGH'
    )
    assert.equal(
      getManagerEffectivenessRiskLevel({ overallScore: 3.8, benchmarkDelta: -0.4, improvementCount: 2 }),
      'MEDIUM'
    )
    assert.equal(
      getManagerEffectivenessRiskLevel({ overallScore: 4.2, benchmarkDelta: 0.1, improvementCount: 1 }),
      'LOW'
    )
  })

  await run('coaching pack produces actionable prompts and hr memo', () => {
    const pack = buildManagerEffectivenessCoachingPack({
      leaderName: '김리더',
      strengths: ['기대치 설정'],
      improvements: ['코칭'],
      competencyLabels: ['코칭', '피드백'],
      overallScore: 3.6,
      benchmarkDelta: -0.5,
    })

    assert.equal(pack.coachingPoints.length >= 3, true)
    assert.equal(pack.nextOneOnOneQuestions.length >= 3, true)
    assert.equal(pack.growthActions.length >= 3, true)
    assert.equal(pack.hrMemo.includes('김리더'), true)
    assert.equal(pack.hrMemo.includes('코칭'), true)
  })

  console.log('Feedback manager effectiveness tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
