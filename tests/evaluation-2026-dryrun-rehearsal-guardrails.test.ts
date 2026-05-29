import './register-path-aliases'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import {
  assertApplyGuardrails,
  parseBackfillSafetyArgs,
  summarizeBackfillSafetyMode,
} from '../scripts/lib/2026-backfill-safety-guard'
import {
  reviewEvaluation2026DryRunOutput,
} from '../src/server/evaluation-2026-dryrun-output-reviewer'

async function run(name: string, fn: () => Promise<void> | void) {
  try {
    await fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

function fixture(name: string) {
  return JSON.parse(
    readFileSync(path.resolve(process.cwd(), 'tests/fixtures/2026-dryrun-output', name), 'utf8')
  )
}

async function main() {
  await run('dry-run default mode remains non-apply and needs no confirmations', () => {
    const args = parseBackfillSafetyArgs(['--year=2026'], {
      expectedPolicyVersion: '2026-PPT-PHASE0',
      env: {},
    })
    const summary = summarizeBackfillSafetyMode(args)
    assert.equal(summary.mode, 'DRY_RUN_ONLY')
    assert.equal(summary.apply, false)
    assert.doesNotThrow(() => assertApplyGuardrails(args))
  })

  await run('apply guardrail rejects --apply without required confirmations', () => {
    const args = parseBackfillSafetyArgs(['--apply', '--year=2026'], {
      expectedPolicyVersion: '2026-PPT-PHASE0',
      env: {},
    })
    assert.throws(() => assertApplyGuardrails(args), /--apply refused/)
    const summary = summarizeBackfillSafetyMode(args)
    assert.equal(summary.missingConfirmations.includes('--confirm-2026-production-apply'), true)
    assert.equal(summary.missingConfirmations.includes('--backup-confirmed'), true)
    assert.equal(summary.missingConfirmations.includes('--hr-approved'), true)
    assert.equal(summary.missingConfirmations.includes('--dry-run-output-reviewed'), true)
    assert.equal(summary.missingConfirmations.includes('--target-cycle=<cycle-id>'), true)
  })

  await run('apply guardrail accepts explicit confirmations and official flags false', () => {
    const args = parseBackfillSafetyArgs([
      '--apply',
      '--year=2026',
      '--policy-version=2026-PPT-PHASE0',
      '--target-cycle=cycle-2026-rehearsal',
      '--confirm-2026-production-apply',
      '--backup-confirmed',
      '--hr-approved',
      '--dry-run-output-reviewed',
    ], {
      expectedPolicyVersion: '2026-PPT-PHASE0',
      env: {},
    })
    assert.doesNotThrow(() => assertApplyGuardrails(args))
    assert.equal(summarizeBackfillSafetyMode(args).mode, 'APPLY_CONFIRMED')
  })

  await run('apply guardrail rejects official activation flags', () => {
    const args = parseBackfillSafetyArgs([
      '--apply',
      '--year=2026',
      '--policy-version=2026-PPT-PHASE0',
      '--target-cycle=cycle-2026-rehearsal',
      '--confirm-2026-production-apply',
      '--backup-confirmed',
      '--hr-approved',
      '--dry-run-output-reviewed',
    ], {
      expectedPolicyVersion: '2026-PPT-PHASE0',
      env: {
        EVALUATION_2026_OFFICIAL_SCORING_ENABLED: 'true',
      },
    })
    assert.throws(() => assertApplyGuardrails(args), /official scoring\/grade\/AI exclusion flags/)
  })

  await run('output reviewer classifies safe fixture as PASS_FOR_REVIEW', () => {
    const result = reviewEvaluation2026DryRunOutput(fixture('valid-safe-dryrun.json'))
    assert.equal(result.classification, 'PASS_FOR_REVIEW')
    assert.equal(result.redFlags.length, 0)
    assert.equal(result.safety.prismaUsed, false)
    assert.equal(result.safety.fetchUsed, false)
  })

  await run('output reviewer flags HR blocker fixtures', () => {
    const policy = reviewEvaluation2026DryRunOutput(fixture('missing-policy-category.json'))
    assert.equal(policy.classification, 'NEEDS_HR_FIX')
    assert.equal(policy.redFlags.some((flag) => flag.id === 'POLICY_CATEGORY_MISSING'), true)

    const evaluator = reviewEvaluation2026DryRunOutput(fixture('evaluator-blockers.json'))
    assert.equal(evaluator.classification, 'NEEDS_HR_FIX')
    assert.equal(evaluator.redFlags.some((flag) => flag.id === 'EVALUATOR_MISSING'), true)
  })

  await run('output reviewer rejects writesPerformed and score/grade red flags', () => {
    const writes = reviewEvaluation2026DryRunOutput(fixture('writes-performed-red-flag.json'))
    assert.equal(writes.classification, 'REJECT_DRY_RUN_OUTPUT')
    assert.equal(writes.redFlags.some((flag) => flag.id === 'WRITES_PERFORMED_TRUE'), true)

    const totalScore = reviewEvaluation2026DryRunOutput(fixture('total-score-changed-red-flag.json'))
    assert.equal(totalScore.classification, 'REJECT_DRY_RUN_OUTPUT')
    assert.equal(totalScore.redFlags.some((flag) => flag.id === 'TOTAL_SCORE_CHANGED'), true)

    const gradeId = reviewEvaluation2026DryRunOutput(fixture('grade-id-changed-red-flag.json'))
    assert.equal(gradeId.classification, 'REJECT_DRY_RUN_OUTPUT')
    assert.equal(gradeId.redFlags.some((flag) => flag.id === 'GRADE_ID_CHANGED'), true)
  })

  await run('output reviewer rejects schema/P2021/P2022 red flags and missing required fields', () => {
    const schema = reviewEvaluation2026DryRunOutput(fixture('schema-error-red-flag.json'))
    assert.equal(schema.classification, 'REJECT_DRY_RUN_OUTPUT')
    assert.equal(schema.redFlags.some((flag) => flag.id === 'PRISMA_SCHEMA_ERROR'), true)

    const missing = reviewEvaluation2026DryRunOutput({ writesPerformed: false })
    assert.equal(missing.classification, 'NEEDS_DEVELOPER_FIX')
    assert.equal(missing.redFlags.some((flag) => flag.id === 'MISSING_REQUIRED_FIELDS'), true)
  })
}

void main()
