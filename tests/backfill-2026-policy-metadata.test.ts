import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import {
  assertPolicyBackfillCanApply,
  buildAiGateCasePolicyMetadataUpdate,
  buildEvaluationItemPolicyMetadataUpdate,
  buildPersonalKpiPolicyMetadataUpdate,
  parsePolicyBackfillArgs,
  summarizePolicyBackfillPlan,
  writePolicyBackfillBackup,
  type PolicyBackfillPlan,
} from '../src/lib/evaluation-policy-2026-backfill'
import { EVALUATION_POLICY_2026 } from '../src/lib/evaluation-policy-2026'

function run(name: string, fn: () => void) {
  try {
    fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

function makePlan(): PolicyBackfillPlan {
  return {
    dryRun: true,
    writesPerformed: false,
    policyVersion: EVALUATION_POLICY_2026.version,
    evalYear: 2026,
    generatedAt: '2026-05-14T00:00:00.000Z',
    rows: [
      {
        recordType: 'PersonalKpi',
        id: 'kpi-auto',
        employeeId: 'emp-1',
        employeeName: '자동분류',
        title: '본부 KPI 연계 목표',
        proposedPolicyCategory: 'ORG_GOAL',
        proposedContributionType: 'ORGANIZATION',
        proposedFormulaVersion: EVALUATION_POLICY_2026.version,
        proposedBaseScore: 90,
        proposedPolicyScoreSnapshot: {
          category: 'ORG_GOAL',
          baselineScores: { target: 90, excellent: 100 },
        },
        confidence: 0.78,
        plannedAction: 'BACKFILL_METADATA',
        reasons: '상위 조직 KPI와 연결되어 있어 조직목표 후보로 분류했습니다.',
      },
      {
        recordType: 'EvaluationItem',
        id: 'item-auto',
        employeeId: 'emp-1',
        employeeName: '자동분류',
        evaluationId: 'eval-1',
        evalStage: 'FIRST',
        title: '본부 KPI 연계 목표',
        proposedPolicyCategory: 'ORG_GOAL',
        proposedContributionType: 'ORGANIZATION',
        proposedFormulaVersion: EVALUATION_POLICY_2026.version,
        proposedBaseScore: 90,
        proposedPolicyScoreSnapshot: {
          category: 'ORG_GOAL',
          baselineScores: { target: 90, excellent: 100 },
        },
        confidence: 0.78,
        plannedAction: 'BACKFILL_METADATA',
        reasons: '상위 조직 KPI와 연결되어 있어 조직목표 후보로 분류했습니다.',
      },
      {
        recordType: 'PersonalKpi',
        id: 'kpi-manual',
        employeeId: 'emp-2',
        employeeName: '수동검토',
        title: '두번째',
        proposedPolicyCategory: 'UNKNOWN',
        confidence: 0,
        plannedAction: 'MANUAL_REVIEW_NO_WRITE',
        reasons: '조직 KPI 연결, 프로젝트 T/K, 일상업무를 구분할 충분한 신호가 없습니다.',
      },
    ],
    aiPolicyRoutes: [
      {
        recordType: 'AiCompetencyGateCase',
        id: 'case-auto',
        employeeId: 'emp-1',
        employeeName: '자동분류',
        proposedPolicyVersion: EVALUATION_POLICY_2026.version,
        proposedRecognitionRoute: 'AI_PROJECT_TK',
        plannedAction: 'BACKFILL_METADATA',
        reasons: 'AI 기반 프로젝트 수행 트랙은 인정 경로 후보입니다.',
      },
    ],
  }
}

run('backfill args default to dry-run and require explicit apply', () => {
  const defaults = parsePolicyBackfillArgs(['--year=2026'])
  const apply = parsePolicyBackfillArgs(['--year=2026', '--apply', '--exclude-manual-review'])

  assert.equal(defaults.year, 2026)
  assert.equal(defaults.apply, false)
  assert.equal(defaults.excludeManualReview, false)
  assert.equal(apply.apply, true)
  assert.equal(apply.excludeManualReview, true)
})

run('apply is refused when manual-review records are not explicitly excluded', () => {
  const plan = makePlan()

  assert.doesNotThrow(() =>
    assertPolicyBackfillCanApply(plan, {
      apply: false,
      excludeManualReview: false,
    })
  )
  assert.throws(
    () =>
      assertPolicyBackfillCanApply(plan, {
        apply: true,
        excludeManualReview: false,
      }),
    /manual-review records exist/
  )
  assert.doesNotThrow(() =>
    assertPolicyBackfillCanApply(plan, {
      apply: true,
      excludeManualReview: true,
    })
  )
})

run('metadata updates touch only additive policy fields', () => {
  const plan = makePlan()
  const personalUpdate = buildPersonalKpiPolicyMetadataUpdate(plan.rows[0])
  const itemUpdate = buildEvaluationItemPolicyMetadataUpdate(plan.rows[1])
  const manualUpdate = buildPersonalKpiPolicyMetadataUpdate(plan.rows[2])
  const aiUpdate = buildAiGateCasePolicyMetadataUpdate(plan.aiPolicyRoutes[0])

  assert.deepEqual(Object.keys(personalUpdate ?? {}).sort(), [
    'policyCategory',
    'policyCategoryConfidence',
    'policyCategoryReviewNote',
    'policyCategorySource',
  ])
  assert.deepEqual(Object.keys(itemUpdate ?? {}).sort(), [
    'adjustmentScore',
    'basePolicyScore',
    'policyCategory',
    'policyFormulaVersion',
    'policyScoreSnapshot',
    'scoreContributionType',
  ])
  assert.equal(manualUpdate, null)
  assert.deepEqual(Object.keys(aiUpdate ?? {}).sort(), ['policyRecognitionRoute', 'policyVersion'])
})

run('backup report is produced before apply and includes manual review rows', () => {
  const plan = makePlan()
  const summary = summarizePolicyBackfillPlan(plan)
  const backupDir = mkdtempSync(path.join(tmpdir(), 'policy-backfill-'))
  const backupPath = writePolicyBackfillBackup({
    backupDir,
    plan,
    summary,
    now: new Date('2026-05-14T00:00:00.000Z'),
  })

  assert.equal(existsSync(backupPath), true)
  const payload = JSON.parse(readFileSync(backupPath, 'utf8')) as {
    applyRequiresExplicitFlag: boolean
    plannedPolicyRows: unknown[]
    manualReviewRows: unknown[]
  }
  assert.equal(payload.applyRequiresExplicitFlag, true)
  assert.equal(payload.plannedPolicyRows.length, 2)
  assert.equal(payload.manualReviewRows.length, 1)
})

run('summary separates safe metadata backfill from manual review', () => {
  const summary = summarizePolicyBackfillPlan(makePlan())

  assert.equal(summary.byAction.BACKFILL_METADATA, 2)
  assert.equal(summary.byAction.MANUAL_REVIEW_NO_WRITE, 1)
  assert.equal(summary.byCategory.ORG_GOAL, 2)
  assert.equal(summary.byCategory.UNKNOWN, 1)
  assert.equal(summary.aiPolicyRoutes.backfillMetadata, 1)
})

console.log('2026 policy metadata backfill safety tests completed')
