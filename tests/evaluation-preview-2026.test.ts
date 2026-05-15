import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  EVALUATION_PREVIEW_2026_FORMULA_VERSION,
  buildEvaluationPreviewInput2026,
  calculateEvaluationPreview2026,
  summarizeEvaluationPreviewIssues2026,
  type EvaluationPreviewInput2026,
} from '../src/server/evaluation-preview-2026'

function run(name: string, fn: () => void) {
  try {
    fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

function basePreviewInput(overrides: Partial<EvaluationPreviewInput2026> = {}): EvaluationPreviewInput2026 {
  return {
    evalYear: 2028,
    salesGroup: 'SALES',
    roleGroup: 'TEAM_SECTION_LEADER',
    employee: {
      position: 'TEAM_LEADER',
    },
    ai: {
      score: 100,
      evidence: {
        route: 'AI_PROJECT_TK',
        projectTk: {
          linkedProjectCategory: 'PROJECT_T',
          aiContributionDocumented: true,
          achievementAtLeastTarget: true,
          contributionRoleDocumented: true,
        },
      },
    },
    items: [
      {
        id: 'org-1',
        title: '본부 KPI 연계 목표',
        category: 'ORG_GOAL',
        achievementLevel: 'TARGET',
        weight: 100,
      },
      {
        id: 'project-t-1',
        title: 'AI 기반 프로젝트 T',
        category: 'PROJECT_T',
        achievementLevel: 'EXCELLENT',
        weight: 60,
      },
      {
        id: 'daily-1',
        title: '일상업무 운영',
        category: 'DAILY_WORK',
        score: 80,
        weight: 40,
      },
    ],
    ...overrides,
  }
}

run('preview combines 2026 scoring, grade, and AI separation', () => {
  const result = calculateEvaluationPreview2026(basePreviewInput())

  assert.equal(result.formulaVersion, EVALUATION_PREVIEW_2026_FORMULA_VERSION)
  assert.equal(result.isPreview, true)
  assert.equal(result.canCalculate, true)
  assert.equal(result.score.organizationScore, 90)
  assert.equal(result.score.personalScore, 92)
  assert.equal(result.score.finalScore, 91.4)
  assert.equal(result.score.organizationWeight, 0.3)
  assert.equal(result.score.personalWeight, 0.7)
  assert.equal(result.grade.calculatedGrade, 'Excellent')
  assert.equal(result.grade.thresholdGroup, 'TEAM_SECTION_LEADER_SALES')
  assert.equal(result.ai.includedInAnnualScore, false)
  assert.equal(result.ai.referenceScore, 100)
  assert.equal(result.ai.levelUpRequirementStatus, 'passed')
  assert.equal(result.ai.recognitionRoute, 'AI_PROJECT_TK')
  assert.equal(result.items.length, 3)
})

run('preview final score uses 30/70 and ignores AI reference score changes', () => {
  const withHighAi = calculateEvaluationPreview2026(basePreviewInput({ ai: { ...basePreviewInput().ai, score: 100 } }))
  const withLowAi = calculateEvaluationPreview2026(basePreviewInput({ ai: { ...basePreviewInput().ai, score: 0 } }))

  assert.equal(withHighAi.score.finalScore, 91.4)
  assert.equal(withLowAi.score.finalScore, 91.4)
  assert.equal(withHighAi.ai.referenceScore, 100)
  assert.equal(withLowAi.ai.referenceScore, 0)
})

run('AI level-up status appears separately as pending when evidence is missing', () => {
  const result = calculateEvaluationPreview2026(
    basePreviewInput({
      ai: {
        score: 100,
        gateStatus: 'NOT_STARTED',
      },
    })
  )

  assert.equal(result.canCalculate, true)
  assert.equal(result.ai.levelUpRequirementStatus, 'pending')
  assert.equal(result.issues.some((issue) => issue.source === 'ai' && issue.code === 'NO_RECOGNITION_ROUTE_PASSED'), true)
})

run('missing policyCategory blocks preview calculation', () => {
  const result = calculateEvaluationPreview2026(
    basePreviewInput({
      items: [
        {
          id: 'missing-category',
          title: '분류 누락 항목',
          category: null,
          score: 90,
        },
      ],
    })
  )

  assert.equal(result.canCalculate, false)
  assert.equal(result.score.finalScore, null)
  assert.equal(result.issues.some((issue) => issue.code === 'POLICY_CATEGORY_REQUIRED'), true)
})

run('UNKNOWN/manual-review category blocks preview calculation', () => {
  const result = calculateEvaluationPreview2026(
    basePreviewInput({
      items: [
        {
          id: 'manual-review',
          title: '수동 검토 항목',
          category: 'UNKNOWN',
          score: 90,
        },
      ],
    })
  )

  assert.equal(result.canCalculate, false)
  assert.equal(result.issues.some((issue) => issue.code === 'POLICY_CATEGORY_MANUAL_REVIEW_REQUIRED'), true)
})

run('sales member threshold policy confirmation is surfaced in preview', () => {
  const result = calculateEvaluationPreview2026(
    basePreviewInput({
      thresholdGroup: 'TEAM_MEMBER_SALES',
      salesGroup: undefined,
      roleGroup: undefined,
      employee: {
        position: 'MEMBER',
      },
    })
  )

  assert.equal(result.canCalculate, true)
  assert.equal(result.grade.calculatedGrade, 'Good')
  assert.equal(result.grade.requiresPolicyConfirmation, true)
  assert.equal(result.grade.issues.some((issue) => issue.code === 'POLICY_CONFIRMATION_REQUIRED'), true)
})

run('raw preview input builder normalizes supported categories and flags unsupported values', () => {
  const input = buildEvaluationPreviewInput2026({
    evalYear: 2026,
    roleGroup: 'TEAM_MEMBER',
    salesGroup: 'NON_SALES',
    employee: {
      role: 'ROLE_MEMBER',
    },
    items: [
      {
        id: 'raw-1',
        title: '정상 항목',
        policyCategory: 'ORG_GOAL',
        targetAchievementLevel: 'TARGET',
      },
      {
        id: 'raw-2',
        title: '알 수 없는 항목',
        policyCategory: 'LEGACY_CATEGORY',
        score: 90,
      },
    ],
  })

  assert.equal(input.items[0].category, 'ORG_GOAL')
  assert.equal(input.items[0].achievementLevel, 'TARGET')
  assert.equal(input.items[1].category, null)
})

run('preview issue summary reports calculation readiness', () => {
  const result = calculateEvaluationPreview2026(
    basePreviewInput({
      items: [],
    })
  )
  const summary = summarizeEvaluationPreviewIssues2026(result.issues)

  assert.equal(summary.canCalculate, false)
  assert.equal(summary.errorCount > 0, true)
  assert.equal(summary.bySource.readiness! > 0, true)
})

run('legacy live evaluation API routes are not wired to the preview module', () => {
  const evaluationRoute = readFileSync('src/app/api/evaluation/[id]/route.ts', 'utf8')
  const submitRoute = readFileSync('src/app/api/evaluation/[id]/submit/route.ts', 'utf8')

  assert.equal(evaluationRoute.includes('calculateEvaluationPreview2026'), false)
  assert.equal(submitRoute.includes('calculateEvaluationPreview2026'), false)
  assert.equal(evaluationRoute.includes('evaluation-preview-2026'), false)
  assert.equal(submitRoute.includes('evaluation-preview-2026'), false)
})

console.log('2026 evaluation preview composition tests completed')
