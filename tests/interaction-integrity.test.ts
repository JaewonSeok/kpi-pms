import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
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

run('critical interaction routes exist', () => {
  const requiredRoutes = [
    'src/app/api/evaluation/results/[cycleId]/acknowledge/route.ts',
    'src/app/api/evaluation/results/[cycleId]/export/route.ts',
    'src/app/api/kpi/org/bulk/route.ts',
    'src/app/api/admin/notification-templates/test-send/route.ts',
  ]

  for (const file of requiredRoutes) {
    assert.equal(existsSync(path.resolve(process.cwd(), file)), true, `${file} should exist`)
  }
})

run('expired-session KPI pages redirect to login', () => {
  const personalPage = read('src/app/(main)/kpi/personal/page.tsx')
  const monthlyPage = read('src/app/(main)/kpi/monthly/page.tsx')

  assert.equal(personalPage.includes("redirect('/login')"), true)
  assert.equal(monthlyPage.includes("redirect('/login')"), true)
})

run('evaluation results client is wired to acknowledge and export endpoints', () => {
  const file = read('src/components/evaluation/EvaluationResultsClient.tsx')

  assert.equal(file.includes('/api/evaluation/results/'), true)
  assert.equal(file.includes('/acknowledge'), true)
  assert.equal(file.includes('/export'), true)
})

run('org KPI client opens real bulk upload modal', () => {
  const file = read('src/components/kpi/OrgKpiManagementClient.tsx')

  assert.equal(file.includes('OrgKpiBulkUploadModal'), true)
  assert.equal(file.includes('setShowBulkUpload(true)'), true)
  assert.equal(file.includes('/api/kpi/org/ai'), true)
})

run('notification ops client uses real test send and dead-letter actions', () => {
  const file = read('src/components/notifications/NotificationOpsClient.tsx')

  assert.equal(file.includes('/api/admin/notification-templates/test-send'), true)
  assert.equal(file.includes('/api/admin/notification-dead-letters'), true)
  assert.equal(file.includes('/api/cron/notifications'), true)
})

console.log('Interaction integrity tests completed')
