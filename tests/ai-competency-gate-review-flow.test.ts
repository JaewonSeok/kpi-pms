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

const adminServerSource = read('src/server/ai-competency-gate-admin.ts')
const reviewPageSource = read('src/components/evaluation/AiCompetencyCaseReviewPage.tsx')

run('review workflow keeps draft save, revision request, resubmission, and review-start transitions wired', () => {
  assert.match(adminServerSource, /export async function startAiCompetencyGateReview/)
  assert.match(adminServerSource, /export async function saveAiCompetencyGateReviewDraft/)
  assert.match(adminServerSource, /nextStatus: 'UNDER_REVIEW'/)
  assert.match(adminServerSource, /nextStatus === 'REVISION_REQUESTED'/)
  assert.match(adminServerSource, /const snapshotType =/)
  assert.match(adminServerSource, /'REVISION_REQUEST'/)
  assert.match(adminServerSource, /writeGateDecisionHistory/)
  assert.match(adminServerSource, /createGateSnapshot/)
})

run('review page exposes save-draft and revision-request actions with Korean copy', () => {
  assert.equal(reviewPageSource.includes('검토 초안 저장'), true)
  assert.equal(reviewPageSource.includes('보완 요청'), true)
  assert.equal(reviewPageSource.includes('종합 의견'), true)
})

console.log('AI competency gate review-flow tests completed')
