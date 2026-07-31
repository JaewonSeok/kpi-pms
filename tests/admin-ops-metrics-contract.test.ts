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

// Metrics keys that AdminOpsClient declares in its OpsSummary type and renders
const CLIENT_METRICS_KEYS = [
  'failedJobs24h',
  'notificationDeadLetters',
  'aiFallback24h',
  'loginUnavailableAccounts',
  'activeEvalCycles',
  'delayedEvalCycles',
  'unreviewedMonthlyRecords',
  'unresolvedCalibrationCount',
  'queueBacklog',
  'inactiveTemplates',
]

run('all AdminOpsClient metrics keys are present in operations.ts server return', () => {
  const clientSource = read('src/components/ops/AdminOpsClient.tsx')
  const serverSource = read('src/lib/operations.ts')

  for (const key of CLIENT_METRICS_KEYS) {
    assert.equal(
      clientSource.includes(key),
      true,
      `AdminOpsClient.tsx must reference client metrics key: ${key}`
    )
    assert.equal(
      serverSource.includes(key),
      true,
      `operations.ts must return metrics key: ${key}`
    )
  }
})

run('overBudgetScenarios is absent from both client and server after 1c8b207 cleanup', () => {
  const clientSource = read('src/components/ops/AdminOpsClient.tsx')
  const serverSource = read('src/lib/operations.ts')

  assert.equal(clientSource.includes('overBudgetScenarios'), false)
  assert.equal(serverSource.includes('overBudgetScenarios'), false)
})

console.log('Admin ops metrics contract tests completed')
