import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { EvalCycleSchema, UpdateEvalCycleSchema } from '../src/lib/validations'

function read(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')
}

function run(name: string, fn: () => void) {
  try {
    fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

run('eval cycle schema persists evaluator display visibility with safe defaults', () => {
  const created = EvalCycleSchema.parse({
    orgId: 'org-1',
    evalYear: 2026,
    cycleName: '2026 상반기',
  })
  const updated = UpdateEvalCycleSchema.parse({
    showQuestionWeight: false,
    showScoreSummary: false,
  })

  assert.equal(created.showQuestionWeight, true)
  assert.equal(created.showScoreSummary, true)
  assert.equal(updated.showQuestionWeight, false)
  assert.equal(updated.showScoreSummary, false)
})

run('admin eval cycle routes and form expose evaluator display settings', () => {
  const createRouteSource = read('src/app/api/admin/eval-cycles/route.ts')
  const updateRouteSource = read('src/app/api/admin/eval-cycles/[id]/route.ts')
  const adminClientSource = read('src/components/admin/AdminEvalCycleClient.tsx')

  assert.equal(createRouteSource.includes('showQuestionWeight: data.showQuestionWeight'), true)
  assert.equal(createRouteSource.includes('showScoreSummary: data.showScoreSummary'), true)
  assert.equal(updateRouteSource.includes('showQuestionWeight: data.showQuestionWeight'), true)
  assert.equal(updateRouteSource.includes('showScoreSummary: data.showScoreSummary'), true)
  assert.equal(adminClientSource.includes('평가권자 화면 노출 설정'), true)
  assert.equal(adminClientSource.includes('showQuestionWeight'), true)
  assert.equal(adminClientSource.includes('showScoreSummary'), true)
})

run('evaluation workbench safely hides question weights and score summary when the cycle turns them off', () => {
  const serverSource = read('src/server/evaluation-workbench.ts')
  const clientSource = read('src/components/evaluation/EvaluationWorkbenchClient.tsx')

  assert.equal(serverSource.includes('showQuestionWeight: true'), true)
  assert.equal(serverSource.includes('showScoreSummary: true'), true)
  assert.equal(clientSource.includes('displaySettings.showQuestionWeight'), true)
  assert.equal(clientSource.includes('displaySettings.showScoreSummary'), true)
  assert.equal(clientSource.includes('점수 요약 카드는 평가권자 화면에서 숨겨집니다.'), true)
})

run('user-facing review copy uses 평가권자 wording on live result surfaces', () => {
  const resultsSource = read('src/server/evaluation-results.ts')
  const resultsClientSource = read('src/components/evaluation/EvaluationResultsClient.tsx')

  assert.equal(resultsSource.includes('평가권자'), true)
  assert.equal(resultsClientSource.includes('평가권자'), true)
})

console.log('Evaluation display setting tests completed')
