/* eslint-disable @typescript-eslint/no-require-imports */
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { resolveMenuFromPath } from '../src/lib/auth/permissions'
import { flattenNavigationItems, NAV_ITEMS } from '../src/lib/navigation'
import { AiCompetencyCycleUpsertSchema } from '../src/lib/validations'
import {
  analyzeBlueprintQuestionPool,
  assembleExamFromBlueprint,
  validateBlueprintDefinition,
} from '../src/lib/ai-competency-blueprint'
import { calculateRubricReview, validateRubricDefinition } from '../src/lib/ai-competency-rubric'

process.env.DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/kpi_pms_test'

const {
  calculateAiCompetencyFinalScore,
  calculateAiCompetencyGrade,
  scoreObjectiveQuestion,
  canApplyForSecondRound,
} = require('../src/lib/ai-competency-scoring') as typeof import('../src/lib/ai-competency-scoring')

function run(name: string, fn: () => void) {
  try {
    fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

function readProjectFile(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')
}

const actionRouteSource = readProjectFile('src/app/api/evaluation/ai-competency/actions/route.ts')
const exportRouteSource = readProjectFile('src/app/api/evaluation/ai-competency/export/[cycleId]/route.ts')
const blueprintExportRouteSource = readProjectFile('src/app/api/evaluation/ai-competency/blueprints/[blueprintId]/export/route.ts')
const artifactRouteSource = readProjectFile('src/app/api/evaluation/ai-competency/artifacts/[artifactId]/route.ts')
const proofRouteSource = readProjectFile('src/app/api/evaluation/ai-competency/certificates/claims/[claimId]/proof/route.ts')
const clientSource = readProjectFile('src/components/evaluation/AiCompetencyClient.tsx')
const adminPanelSource = readProjectFile('src/components/evaluation/AiCompetencyAdminPanel.tsx')
const sharedSource = readProjectFile('src/components/evaluation/AiCompetencyShared.tsx')
const pageSource = readProjectFile('src/app/(main)/evaluation/ai-competency/page.tsx')
const serverSource = readProjectFile('src/server/ai-competency.ts')
const evalResultsSource = readProjectFile('src/server/evaluation-results.ts')
const calibrationSource = readProjectFile('src/server/evaluation-calibration.ts')
const compensationSource = readProjectFile('src/server/compensation-manage.ts')
const leafNavigationItems = flattenNavigationItems(NAV_ITEMS)

run('AI competency menu and page route are registered in navigation and permissions', () => {
  assert.equal(resolveMenuFromPath('/evaluation/ai-competency'), 'AI_COMPETENCY')
  assert.equal(resolveMenuFromPath('/api/evaluation/ai-competency/actions'), 'AI_COMPETENCY')
  assert.equal(
    leafNavigationItems.some((item) => item.href === '/evaluation/ai-competency' && item.menuKey === 'AI_COMPETENCY'),
    true
  )
  assert.equal(existsSync(path.resolve(process.cwd(), 'src/app/(main)/evaluation/ai-competency/page.tsx')), true)
  assert.match(pageSource, /getAiCompetencyPageData/)
  assert.match(pageSource, /AiCompetencyClient/)
})

run('cycle create and publish flow remains admin-only', () => {
  assert.match(actionRouteSource, /case 'createCycle'/)
  assert.match(actionRouteSource, /case 'publishResults'/)
  assert.match(actionRouteSource, /ensureAdmin\(session\.user\.role\)/)
  assert.match(serverSource, /AI_COMPETENCY_CYCLE_CREATED/)
  assert.match(serverSource, /AI_COMPETENCY_RESULTS_PUBLISHED/)
})

run('score calculation and first-round scoring regression rules hold', () => {
  assert.equal(calculateAiCompetencyFinalScore({ firstRoundScore: 82, externalCertMappedScore: 88, secondRoundBonus: 9, cap: 100 }), 97)
  assert.equal(calculateAiCompetencyFinalScore({ firstRoundScore: 99, externalCertMappedScore: 90, secondRoundBonus: 8, cap: 100 }), 100)
  assert.equal(calculateAiCompetencyGrade({ finalScore: 95, secondRoundPassed: true }), 'S')
  assert.equal(calculateAiCompetencyGrade({ finalScore: 95, secondRoundPassed: false }), 'A')
  assert.deepEqual(scoreObjectiveQuestion({ questionType: 'SINGLE_CHOICE', answerKey: ['A'], answerPayload: 'A', maxScore: 10 }), { score: 10, isCorrect: true })
  assert.deepEqual(scoreObjectiveQuestion({ questionType: 'MULTIPLE_CHOICE', answerKey: ['A', 'C'], answerPayload: ['C', 'A'], maxScore: 8 }), { score: 8, isCorrect: true })
  assert.deepEqual(scoreObjectiveQuestion({ questionType: 'SHORT_ANSWER', answerKey: ['free text'], answerPayload: '답안', maxScore: 20 }), { score: null, isCorrect: undefined })
})

run('second-round eligibility and external-cert flows remain wired', () => {
  assert.equal(canApplyForSecondRound({ firstRoundScore: 80, passThreshold: 75, passStatus: 'PASSED' }), true)
  assert.equal(canApplyForSecondRound({ firstRoundScore: 74, passThreshold: 75, passStatus: 'FAILED' }), false)
  assert.match(actionRouteSource, /case 'submitSecondRound'/)
  assert.match(actionRouteSource, /case 'assignReviewers'/)
  assert.match(actionRouteSource, /case 'reviewSubmission'/)
  assert.match(actionRouteSource, /case 'submitCertClaim'/)
  assert.match(actionRouteSource, /case 'decideCertClaim'/)
  assert.match(serverSource, /AI_COMPETENCY_SECOND_ROUND_SUBMITTED/)
  assert.match(serverSource, /AI_COMPETENCY_EXTERNAL_CERT_APPROVED/)
  assert.match(proofRouteSource, /getAiCompetencyCertProofDownload/)
})

run('cycle validation still enforces sensible artifact count rules', () => {
  const invalid = AiCompetencyCycleUpsertSchema.safeParse({
    evalCycleId: 'eval-1',
    cycleName: '2026 AI 활용능력 평가',
    firstRoundPassThreshold: 75,
    secondRoundBonusCap: 10,
    scoreCap: 100,
    timeLimitMinutes: 90,
    randomizeQuestions: true,
    artifactMinCount: 4,
    artifactMaxCount: 2,
  })
  assert.equal(invalid.success, false)
})

run('blueprint validation rejects inconsistent totals and detects pool shortages', () => {
  const blueprint = {
    blueprintName: '공통 체계표',
    blueprintVersion: 1,
    track: null,
    totalQuestionCount: 3,
    totalPoints: 15,
    timeLimitMinutes: 60,
    passScore: 10,
    randomizationEnabled: true,
  }
  const rows = [
    {
      competencyDomain: 'AI_FOUNDATION' as const,
      itemType: 'SINGLE_CHOICE' as const,
      difficulty: 'INTERMEDIATE' as const,
      requiredQuestionCount: 2,
      pointsPerQuestion: 5,
      scope: 'COMMON' as const,
      requiredTags: [],
      excludedTags: [],
      displayOrder: 0,
    },
  ]
  const invalid = validateBlueprintDefinition({ blueprint, rows })
  assert.equal(invalid.isValid, false)

  const validBlueprint = { ...blueprint, totalQuestionCount: 2, totalPoints: 10, passScore: 8 }
  const gap = analyzeBlueprintQuestionPool({
    blueprint: validBlueprint,
    rows,
    questions: [
      {
        id: 'q1',
        competencyDomain: 'AI_FOUNDATION',
        questionType: 'SINGLE_CHOICE',
        difficulty: 'INTERMEDIATE',
        track: null,
        isCommon: true,
        isActive: true,
        maxScore: 5,
        tags: [],
      },
    ],
  })
  assert.equal(gap.canAssemble, false)
  assert.equal(gap.shortageCount, 1)
})

run('exam assembly follows common plus track-specific blueprints exactly and avoids duplicates', () => {
  const assembled = assembleExamFromBlueprint({
    seed: 'assignment-1',
    blueprints: [
      {
        blueprint: {
          id: 'bp-common',
          blueprintName: '공통',
          blueprintVersion: 1,
          track: null,
          totalQuestionCount: 1,
          totalPoints: 5,
          timeLimitMinutes: 30,
          passScore: 3,
          randomizationEnabled: false,
        },
        rows: [
          {
            competencyDomain: 'AI_FOUNDATION',
            itemType: 'SINGLE_CHOICE',
            difficulty: 'INTERMEDIATE',
            requiredQuestionCount: 1,
            pointsPerQuestion: 5,
            scope: 'COMMON',
            displayOrder: 0,
          },
        ],
      },
      {
        blueprint: {
          id: 'bp-track',
          blueprintName: 'HR 전용',
          blueprintVersion: 1,
          track: 'HR_SUPPORT',
          totalQuestionCount: 1,
          totalPoints: 5,
          timeLimitMinutes: 30,
          passScore: 3,
          randomizationEnabled: false,
        },
        rows: [
          {
            competencyDomain: 'PROMPT_CONTEXT_DESIGN',
            itemType: 'SCENARIO_JUDGEMENT',
            difficulty: 'INTERMEDIATE',
            requiredQuestionCount: 1,
            pointsPerQuestion: 5,
            scope: 'TRACK_SPECIFIC',
            displayOrder: 0,
          },
        ],
      },
    ],
    questions: [
      { id: 'q-common', competencyDomain: 'AI_FOUNDATION', questionType: 'SINGLE_CHOICE', difficulty: 'INTERMEDIATE', track: null, isCommon: true, isActive: true, maxScore: 5, sortOrder: 1, tags: [] },
      { id: 'q-track', competencyDomain: 'PROMPT_CONTEXT_DESIGN', questionType: 'SCENARIO_JUDGEMENT', difficulty: 'INTERMEDIATE', track: 'HR_SUPPORT', isCommon: false, isActive: true, maxScore: 5, sortOrder: 2, tags: [] },
    ],
  })

  assert.deepEqual(assembled.questionIds, ['q-common', 'q-track'])
  assert.equal(assembled.totalQuestionCount, 2)
  assert.equal(assembled.totalPoints, 10)
})

run('rubric validation, knockout handling, and bonus logic are deterministic', () => {
  const rubric = {
    rubricName: '2차 루브릭',
    rubricVersion: 1,
    track: 'HR_SUPPORT' as const,
    totalScore: 10,
    passScore: 8,
    bonusScoreIfPassed: 5,
    certificationLabel: 'AI 실무인증',
  }
  const criteria = [
    {
      id: 'criterion-1',
      criterionCode: 'DEFINE',
      criterionName: '문제 정의',
      maxScore: 5,
      displayOrder: 0,
      mandatory: true,
      knockout: false,
      bands: [{ score: 5, title: '우수', displayOrder: 0 }],
    },
    {
      id: 'criterion-2',
      criterionCode: 'SECURITY',
      criterionName: '보안 준수',
      maxScore: 5,
      displayOrder: 1,
      mandatory: true,
      knockout: true,
      bands: [{ score: 5, title: '우수', displayOrder: 0 }],
    },
  ]

  assert.equal(validateRubricDefinition({ rubric, criteria }).isValid, true)

  const passed = calculateRubricReview({
    rubric,
    criteria,
    criterionScores: [
      { criterionId: 'criterion-1', score: 5 },
      { criterionId: 'criterion-2', score: 4, knockoutTriggered: false },
    ],
    decision: 'PASS',
    submitFinal: true,
  })
  assert.equal(passed.isValid, true)
  assert.equal(passed.totalScore, 9)
  assert.equal(passed.bonusScore, 5)
  assert.equal(passed.passed, true)

  const failed = calculateRubricReview({
    rubric,
    criteria,
    criterionScores: [
      { criterionId: 'criterion-1', score: 5 },
      { criterionId: 'criterion-2', score: 5, knockoutTriggered: true },
    ],
    decision: 'PASS',
    submitFinal: true,
  })
  assert.equal(failed.isValid, false)
})

run('blueprint and rubric CRUD, duplication, and activation flows are exposed', () => {
  for (const action of ['upsertBlueprint', 'activateBlueprint', 'archiveBlueprint', 'duplicateBlueprint', 'upsertRubric', 'activateRubric', 'archiveRubric', 'duplicateRubric']) {
    assert.match(actionRouteSource, new RegExp(`case '${action}'`))
  }
  for (const audit of ['AI_COMPETENCY_BLUEPRINT_CREATED', 'AI_COMPETENCY_BLUEPRINT_ACTIVATED', 'AI_COMPETENCY_BLUEPRINT_DUPLICATED', 'AI_COMPETENCY_RUBRIC_CREATED', 'AI_COMPETENCY_RUBRIC_ACTIVATED', 'AI_COMPETENCY_RUBRIC_DUPLICATED']) {
    assert.match(serverSource, new RegExp(audit))
  }
  assert.match(serverSource, /AI_COMPETENCY_EXAM_GENERATED/)
  assert.match(serverSource, /aiCompetencyGeneratedExamSet\.create/)
  assert.match(serverSource, /generatedSet: true/)
})

run('reviewer scoring is rubric-based, draftable, and permission-guarded', () => {
  assert.match(actionRouteSource, /criterionScores/)
  assert.match(actionRouteSource, /submitFinal/)
  assert.match(serverSource, /reviewerId: params\.session\.user\.id/)
  assert.match(serverSource, /배정된 리뷰어만 심사할 수 있습니다/)
  assert.match(serverSource, /AI_COMPETENCY_REVIEW_DRAFT_SAVED/)
  assert.match(serverSource, /AI_COMPETENCY_SECOND_ROUND_REVIEWED/)
  assert.match(clientSource, /criterionScores/)
  assert.match(clientSource, /submitFinal: true/)
  assert.match(clientSource, /submitFinal: false/)
})

run('question bank, blueprint, and rubric admin screens are exposed with Korean labels', () => {
  for (const label of ['문항 체계표', '문항 분포 검증', '문항 부족 경고', '루브릭 시트', '평가기준', '리뷰어 심사']) {
    assert.match(adminPanelSource + clientSource + sharedSource, new RegExp(label))
  }
  assert.match(sharedSource, /PRACTICAL/)
  assert.match(serverSource, /competencyDomain/)
  assert.match(serverSource, /tags/)
})

run('PMS result, calibration, compensation, export, and secure download regression paths remain intact', () => {
  assert.match(evalResultsSource, /loadAiCompetencySyncedResults/)
  assert.match(calibrationSource, /loadAiCompetencySyncedResults/)
  assert.match(compensationSource, /loadAiCompetencySyncedResults/)
  assert.match(exportRouteSource, /attachment; filename/)
  assert.match(blueprintExportRouteSource, /attachment; filename/)
  assert.match(artifactRouteSource, /getAiCompetencyArtifactDownload/)
  assert.match(proofRouteSource, /getAiCompetencyCertProofDownload/)
})

console.log('AI competency tests completed')
