import assert from 'node:assert/strict'
import {
  calculateAnnualScoreWithAiPolicyAdapter2026,
  calculateAnnualScoreWithoutAi2026,
  evaluateAiLevelUpRequirement2026,
  isAiLevelUpRequirementApplicable2026,
  removeAiScoreFromAnnualTotal2026,
  resolveAiRecognitionRoute2026,
  shouldIncludeAiInAnnualScore2026,
  validateAiRecognitionEvidence2026,
} from '../src/server/evaluation-ai-policy-2026'

function run(name: string, fn: () => void) {
  try {
    fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

run('2026 path excludes AI score from annual performance total', () => {
  const result = calculateAnnualScoreWithoutAi2026({
    organizationPerformanceScore: 100,
    personalPerformanceScore: 80,
    aiCompetencyScore: 0,
    aiGateStatus: 'PASSED',
  })

  assert.equal(shouldIncludeAiInAnnualScore2026(), false)
  assert.equal(result.annualPerformanceScore, 86)
  assert.equal(result.aiIncludedInAnnualScore, false)
  assert.equal(result.aiReference.score, 0)
  assert.equal(result.aiReference.gateStatus, 'PASSED')
})

run('legacy annual score path remains unchanged by default', () => {
  const result = calculateAnnualScoreWithAiPolicyAdapter2026({
    legacyAnnualScore: 91.2,
    legacyAiIncludedInAnnualScore: true,
    organizationPerformanceScore: 100,
    personalPerformanceScore: 80,
    aiCompetencyScore: 0,
  })

  assert.equal(result.used2026AiPolicy, false)
  assert.equal(result.annualPerformanceScore, 91.2)
  assert.equal(result.aiIncludedInAnnualScore, true)
  assert.equal(result.result2026, undefined)
})

run('AI reference metadata can be returned separately from performance score', () => {
  const result = removeAiScoreFromAnnualTotal2026({
    organizationPerformanceScore: 95,
    personalPerformanceScore: 85,
    aiCompetencyScore: 72,
    aiGateStatus: 'UNDER_REVIEW',
  })

  assert.equal(result.annualPerformanceScore, 88)
  assert.deepEqual(result.aiReference, {
    score: 72,
    gateStatus: 'UNDER_REVIEW',
    annualScoreIncluded: false,
    levelUpRequirementStartsFromYear: 2028,
  })
})

run('removing AI does not alter organization/personal score inputs', () => {
  const input = {
    organizationPerformanceScore: 93,
    personalPerformanceScore: 87,
    aiCompetencyScore: 100,
  }
  const result = calculateAnnualScoreWithoutAi2026(input)

  assert.equal(result.organizationPerformanceScore, input.organizationPerformanceScore)
  assert.equal(result.personalPerformanceScore, input.personalPerformanceScore)
  assert.equal(result.annualPerformanceScore, 88.8)
})

run('team member is applicable target', () => {
  const result = isAiLevelUpRequirementApplicable2026({ evalYear: 2028, position: 'MEMBER' })
  assert.equal(result.targetIncluded, true)
  assert.equal(result.required, true)
  assert.equal(result.reason, 'APPLICABLE_AND_REQUIRED')
})

run('team leader is applicable target', () => {
  const result = isAiLevelUpRequirementApplicable2026({ evalYear: 2028, position: 'TEAM_LEADER' })
  assert.equal(result.targetIncluded, true)
  assert.equal(result.required, true)
})

run('section leader is excluded target', () => {
  const result = isAiLevelUpRequirementApplicable2026({ evalYear: 2028, position: 'SECTION_CHIEF' })
  assert.equal(result.excluded, true)
  assert.equal(result.required, false)
})

run('division head is excluded target', () => {
  const result = isAiLevelUpRequirementApplicable2026({ evalYear: 2028, position: 'DIV_HEAD' })
  assert.equal(result.excluded, true)
  assert.equal(result.required, false)
})

run('before 2028 AI level-up requirement is not required', () => {
  const result = evaluateAiLevelUpRequirement2026({ evalYear: 2027, position: 'MEMBER' })
  assert.equal(result.status, 'NOT_REQUIRED')
  assert.equal(result.pass, true)
})

run('2028 and after AI level-up requirement is required for applicable target', () => {
  const result = evaluateAiLevelUpRequirement2026({ evalYear: 2028, role: 'ROLE_MEMBER' })
  assert.equal(result.applicability.required, true)
  assert.equal(result.status, 'PENDING')
  assert.equal(result.pass, false)
})

run('AI Project T/K recognition route passes with linked project and documented contribution', () => {
  const result = evaluateAiLevelUpRequirement2026({
    evalYear: 2028,
    position: 'MEMBER',
    evidence: {
      route: 'AI_PROJECT_TK',
      projectTk: {
        linkedProjectCategory: 'PROJECT_T',
        aiContributionDocumented: true,
        achievementAtLeastTarget: true,
        contributionRoleDocumented: true,
      },
    },
  })

  assert.equal(result.status, 'PASS')
  assert.equal(result.recognitionRoute, 'AI_PROJECT_TK')
})

run('org-contribution route passes with improvement, before/after, application, sharing, and survey >= 4.0', () => {
  const result = evaluateAiLevelUpRequirement2026({
    evalYear: 2028,
    position: 'TEAM_LEADER',
    evidence: {
      gateTrack: 'AI_USE_CASE_EXPANSION',
      orgContribution: {
        improvement: { time: true },
        beforeAfterComparison: true,
        realWorkApplication: true,
        teamOrgContribution: true,
        sharingTrainingReportEvidence: true,
        surveyAverage: 4.2,
      },
    },
  })

  assert.equal(resolveAiRecognitionRoute2026({ gateTrack: 'AI_USE_CASE_EXPANSION' }), 'ORG_CONTRIBUTION_USE_CASE')
  assert.equal(result.status, 'PASS')
  assert.equal(result.recognitionRoute, 'ORG_CONTRIBUTION_USE_CASE')
})

run('certification route passes with validated certification or practical proof', () => {
  const result = evaluateAiLevelUpRequirement2026({
    evalYear: 2028,
    role: 'ROLE_MEMBER',
    evidence: {
      route: 'AI_PRACTICAL_CERTIFICATION',
      certification: {
        certificationProofProvided: true,
        validated: true,
      },
    },
  })

  assert.equal(result.status, 'PASS')
  assert.equal(result.recognitionRoute, 'AI_PRACTICAL_CERTIFICATION')
})

run('missing recognition evidence returns pending or insufficient data, not pass', () => {
  const noEvidence = evaluateAiLevelUpRequirement2026({ evalYear: 2028, position: 'MEMBER' })
  assert.equal(noEvidence.status, 'PENDING')
  assert.equal(noEvidence.pass, false)

  const incompleteRoute = validateAiRecognitionEvidence2026('AI_PROJECT_TK', {
    route: 'AI_PROJECT_TK',
    projectTk: {
      linkedProjectCategory: 'PROJECT_T',
    },
  })
  assert.equal(incompleteRoute.status, 'INSUFFICIENT_DATA')
  assert.equal(incompleteRoute.passed, false)
})

run('survey below 4.0 does not pass org-contribution route', () => {
  const result = validateAiRecognitionEvidence2026('ORG_CONTRIBUTION_USE_CASE', {
    route: 'ORG_CONTRIBUTION_USE_CASE',
    orgContribution: {
      improvement: { productivity: true },
      beforeAfterComparison: true,
      realWorkApplication: true,
      teamOrgContribution: true,
      sharingTrainingReportEvidence: true,
      surveyAverage: 3.9,
    },
  })

  assert.equal(result.status, 'FAIL')
  assert.equal(result.passed, false)
  assert.equal(result.issues.some((issue) => issue.code === 'SURVEY_AVERAGE_BELOW_REQUIRED'), true)
})

run('explicit 2026 annual score adapter excludes AI score', () => {
  const result = calculateAnnualScoreWithAiPolicyAdapter2026({
    formulaVersion: '2026',
    legacyAnnualScore: 99,
    organizationPerformanceScore: 100,
    personalPerformanceScore: 80,
    aiCompetencyScore: 100,
    aiGateStatus: 'PASSED',
  })

  assert.equal(result.used2026AiPolicy, true)
  assert.equal(result.annualPerformanceScore, 86)
  assert.equal(result.aiIncludedInAnnualScore, false)
  assert.equal(result.result2026?.aiReference.score, 100)
})

console.log('2026 evaluation AI policy separation tests completed')
