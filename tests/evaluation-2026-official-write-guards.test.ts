import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import {
  evaluateFinalizationGuard,
  evaluateGradeWriteGuard,
  evaluateOfficialPopulationGuard,
  evaluateReviewerStageSaveGuard,
  evaluateScoreWriteGuard,
  evaluateSelfStageSaveGuard,
  summarizeOfficialWriteHold,
  type OfficialEvaluationReadinessInput,
} from '../src/server/evaluation-2026-official-write-guards'

async function run(name: string, fn: () => Promise<void> | void) {
  try {
    await fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

function read(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')
}

const baselineV1: OfficialEvaluationReadinessInput = {
  schemaBoundaryApplied: false,
  stagingRehearsalComplete: false,
  productionMigrationApproved: false,
  hrApprovalCollected: false,
  dbBackupConfirmed: false,
  writeRouteApproved: false,
  activeEmployees: 289,
  confirmedKpiCount: 1,
  confirmedKpiCoverageRate: 0.3,
  mboMissing: 284,
  confirmedKpiShortage: 288,
  teamKpiPending: 25,
  policyCategoryMissing: 1,
  evaluatorRoutingBlockers: 289,
  scorePolicyBlockers: 17,
  gradePolicyBlockers: 0,
  leaderEvaluationBlockers: 289,
  finalizationCeoBlockers: 200,
  leadership360Blockers: 287,
  officialGateBlockers: 1753,
  aiPassFailBlockers: 0,
  aiAnnualScoreExcluded: false,
  priorStagesComplete: false,
  scoreWriteComplete: false,
  gradeWriteComplete: false,
  ceoApprovalCollected: false,
}

const readyInput: OfficialEvaluationReadinessInput = {
  schemaBoundaryApplied: true,
  stagingRehearsalComplete: true,
  productionMigrationApproved: true,
  hrApprovalCollected: true,
  dbBackupConfirmed: true,
  writeRouteApproved: true,
  ceoApprovalCollected: true,
  priorStagesComplete: true,
  scoreWriteComplete: true,
  gradeWriteComplete: true,
  scoreCalculated: true,
  gradeCalculated: true,
  activeEmployees: 289,
  confirmedKpiCount: 289,
  confirmedKpiCoverageRate: 100,
  mboMissing: 0,
  confirmedKpiShortage: 0,
  teamKpiPending: 0,
  policyCategoryMissing: 0,
  evaluatorRoutingBlockers: 0,
  scorePolicyBlockers: 0,
  gradePolicyBlockers: 0,
  leaderEvaluationBlockers: 0,
  finalizationCeoBlockers: 0,
  leadership360Blockers: 0,
  officialGateBlockers: 0,
  aiPassFailBlockers: 0,
  aiAnnualScoreExcluded: true,
}

function expectBlocked(decision: { allowed: boolean; status: string }) {
  assert.equal(decision.allowed, false)
  assert.equal(decision.status, 'BLOCK')
}

function expectAllowed(decision: { allowed: boolean; status: string }) {
  assert.equal(decision.allowed, true)
  assert.equal(decision.status, 'ALLOW')
}

async function main() {
  await run('current Baseline v1 blocks every official write guard', () => {
    const summary = summarizeOfficialWriteHold(baselineV1)

    expectBlocked(summary.officialPopulation)
    expectBlocked(summary.selfStageSave)
    expectBlocked(summary.reviewerStageSave)
    expectBlocked(summary.scoreWrite)
    expectBlocked(summary.gradeWrite)
    expectBlocked(summary.finalization)
    expectBlocked(summary.overall)
    assert.equal(summary.overall.reasons.includes('SCHEMA_BOUNDARY_NOT_APPLIED'), true)
    assert.equal(summary.overall.reasons.includes('MBO_COVERAGE_INSUFFICIENT'), true)
    assert.equal(summary.overall.reasons.includes('POLICY_CATEGORY_MISSING'), true)
    assert.equal(summary.overall.reasons.includes('OFFICIAL_GATE_BLOCKED'), true)
  })

  await run('missing schema boundary blocks everything even when data blockers are zero', () => {
    const input = {
      ...readyInput,
      schemaBoundaryApplied: false,
    }
    const summary = summarizeOfficialWriteHold(input)

    for (const decision of [
      summary.officialPopulation,
      summary.selfStageSave,
      summary.reviewerStageSave,
      summary.scoreWrite,
      summary.gradeWrite,
      summary.finalization,
      summary.overall,
    ]) {
      expectBlocked(decision)
      assert.equal(decision.reasons.includes('SCHEMA_BOUNDARY_NOT_APPLIED'), true)
    }
  })

  await run('MBO missing blocks population unless approved exception is documented', () => {
    const blocked = evaluateOfficialPopulationGuard({
      ...readyInput,
      mboMissing: 3,
    })
    expectBlocked(blocked)
    assert.equal(blocked.reasons.includes('MBO_COVERAGE_INSUFFICIENT'), true)

    const allowed = evaluateOfficialPopulationGuard({
      ...readyInput,
      mboMissing: 3,
      approvedExceptions: { mboMissing: true },
    })
    expectAllowed(allowed)
  })

  await run('confirmed KPI shortage blocks population unless approved exception is documented', () => {
    const blocked = evaluateOfficialPopulationGuard({
      ...readyInput,
      confirmedKpiShortage: 2,
    })
    expectBlocked(blocked)
    assert.equal(blocked.reasons.includes('CONFIRMED_KPI_COVERAGE_INSUFFICIENT'), true)

    const allowed = evaluateOfficialPopulationGuard({
      ...readyInput,
      confirmedKpiShortage: 2,
      approvedExceptions: { confirmedKpiShortage: true },
    })
    expectAllowed(allowed)
  })

  await run('policyCategory missing blocks population unless approved exception is documented', () => {
    const blocked = evaluateOfficialPopulationGuard({
      ...readyInput,
      policyCategoryMissing: 1,
    })
    expectBlocked(blocked)
    assert.equal(blocked.reasons.includes('POLICY_CATEGORY_MISSING'), true)

    const allowed = evaluateOfficialPopulationGuard({
      ...readyInput,
      policyCategoryMissing: 1,
      approvedExceptions: { policyCategoryMissing: true },
    })
    expectAllowed(allowed)
  })

  await run('Team KPI pending blocks population unless approved exception is documented', () => {
    const blocked = evaluateOfficialPopulationGuard({
      ...readyInput,
      teamKpiPending: 4,
    })
    expectBlocked(blocked)
    assert.equal(blocked.reasons.includes('TEAM_KPI_PENDING'), true)

    const allowed = evaluateOfficialPopulationGuard({
      ...readyInput,
      teamKpiPending: 4,
      approvedExceptions: { teamKpiPending: true },
    })
    expectAllowed(allowed)
  })

  await run('evaluator routing blockers block population and reviewer save', () => {
    const input = {
      ...readyInput,
      evaluatorRoutingBlockers: 5,
    }

    const population = evaluateOfficialPopulationGuard(input)
    const reviewerSave = evaluateReviewerStageSaveGuard(input)

    expectBlocked(population)
    expectBlocked(reviewerSave)
    assert.equal(population.reasons.includes('EVALUATOR_ROUTING_BLOCKED'), true)
    assert.equal(reviewerSave.reasons.includes('EVALUATOR_ROUTING_BLOCKED'), true)
  })

  await run('score policy blockers block official score write', () => {
    const decision = evaluateScoreWriteGuard({
      ...readyInput,
      scorePolicyBlockers: 1,
    })

    expectBlocked(decision)
    assert.equal(decision.reasons.includes('SCORE_POLICY_BLOCKED'), true)
  })

  await run('grade policy blockers block official grade write', () => {
    const decision = evaluateGradeWriteGuard({
      ...readyInput,
      gradePolicyBlockers: 1,
    })

    expectBlocked(decision)
    assert.equal(decision.reasons.includes('GRADE_POLICY_BLOCKED'), true)
  })

  await run('finalization and CEO blockers block finalization', () => {
    const decision = evaluateFinalizationGuard({
      ...readyInput,
      finalizationCeoBlockers: 1,
    })

    expectBlocked(decision)
    assert.equal(decision.reasons.includes('FINALIZATION_CEO_BLOCKED'), true)
  })

  await run('AI annual score separation missing blocks official score write', () => {
    const decision = evaluateScoreWriteGuard({
      ...readyInput,
      aiAnnualScoreExcluded: false,
    })

    expectBlocked(decision)
    assert.equal(decision.reasons.includes('AI_SCORE_SEPARATION_NOT_CONFIRMED'), true)
  })

  await run('self stage save remains blocked when population guard is blocked', () => {
    const decision = evaluateSelfStageSaveGuard({
      ...readyInput,
      officialGateBlockers: 1,
    })

    expectBlocked(decision)
    assert.equal(decision.reasons.includes('OFFICIAL_GATE_BLOCKED'), true)
  })

  await run('all gates satisfied returns ALLOW for population and overall summary', () => {
    const population = evaluateOfficialPopulationGuard(readyInput)
    const summary = summarizeOfficialWriteHold(readyInput)

    expectAllowed(population)
    expectAllowed(summary.overall)
    assert.deepEqual(summary.overall.reasons, [])
  })

  await run('decisions include Korean messages and next actions', () => {
    const decision = evaluateOfficialPopulationGuard({
      ...readyInput,
      policyCategoryMissing: 1,
    })

    expectBlocked(decision)
    assert.equal(decision.messageKo.includes('허용되지 않습니다'), true)
    assert.equal(decision.nextActions.some((item) => item.includes('policyCategory 미분류')), true)
  })

  await run('helper is pure and has no DB client, API, or write imports', () => {
    const source = read('src/server/evaluation-2026-official-write-guards.ts')

    assert.equal(source.includes("from '@/lib/prisma'"), false)
    assert.equal(source.includes("from '../lib/prisma'"), false)
    assert.equal(source.includes('import { prisma'), false)
    assert.equal(source.includes('fetch('), false)
    assert.equal(source.includes('createAuditLog'), false)
    assert.equal(source.includes('.create('), false)
    assert.equal(source.includes('.update('), false)
    assert.equal(source.includes('.upsert('), false)
    assert.equal(source.includes('DATABASE_URL'), false)
  })

  console.log('2026 official write guard tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
