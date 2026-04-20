import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'

function run(name: string, fn: () => void) {
  try {
    fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

function read(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')
}

const actionRouteSource = read('src/app/api/evaluation/ai-competency/actions/route.ts')
const evidenceRouteSource = read('src/app/api/evaluation/ai-competency/evidence/[evidenceId]/route.ts')
const exportRouteSource = read('src/app/api/evaluation/ai-competency/export/[cycleId]/route.ts')

run('actions route keeps every visible gate action connected to a working server handler', () => {
  for (const actionName of [
    'upsertCycle',
    'upsertAssignment',
    'saveDraft',
    'uploadEvidence',
    'deleteEvidence',
    'submitCase',
    'startReview',
    'saveReviewDraft',
    'finalizeDecision',
  ]) {
    assert.match(actionRouteSource, new RegExp(`case '${actionName}'`))
  }

  assert.match(actionRouteSource, /upsertAiCompetencyGateCycle/)
  assert.match(actionRouteSource, /upsertAiCompetencyGateAssignment/)
  assert.match(actionRouteSource, /saveAiCompetencyGateDraft/)
  assert.match(actionRouteSource, /uploadAiCompetencyGateEvidence/)
  assert.match(actionRouteSource, /submitAiCompetencyGateCase/)
  assert.match(actionRouteSource, /startAiCompetencyGateReview/)
  assert.match(actionRouteSource, /saveAiCompetencyGateReviewDraft/)
  assert.match(actionRouteSource, /finalizeAiCompetencyGateDecision/)
})

run('evidence download and export routes are routed to the gate domain services', () => {
  assert.match(evidenceRouteSource, /getAiCompetencyGateEvidenceDownload/)
  assert.match(exportRouteSource, /exportAiCompetencyGateReport/)
})

console.log('AI competency actions-route tests completed')
