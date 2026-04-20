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

run('review decision flow maps pass and fail actions to terminal gate statuses', () => {
  assert.match(adminServerSource, /params\.input\.action === 'PASS'/)
  assert.match(adminServerSource, /params\.input\.action === 'FAIL'/)
  assert.match(adminServerSource, /nextStatus === 'PASSED'/)
  assert.match(adminServerSource, /nextStatus === 'FAILED'/)
  assert.match(adminServerSource, /const snapshotType =/)
  assert.match(adminServerSource, /'FINAL_DECISION'/)
})

run('review page keeps explicit pass and fail decision actions visible', () => {
  assert.equal(reviewPageSource.includes('통과'), true)
  assert.equal(reviewPageSource.includes('Fail'), true)
  assert.equal(reviewPageSource.includes('AI 역량평가를 통과 처리했습니다.'), true)
  assert.equal(reviewPageSource.includes('AI 역량평가를 Fail 처리했습니다.'), true)
})

console.log('AI competency gate pass-fail tests completed')
