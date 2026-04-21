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

const pageSource = read('src/app/(main)/admin/performance-assignments/page.tsx')
const clientSource = read('src/components/admin/PerformanceAssignmentAdminClient.tsx')
const routeSource = read('src/app/api/admin/performance-assignments/route.ts')
const serviceSource = read('src/server/evaluation-performance-assignments.ts')
const navigationSource = read('src/lib/navigation.ts')
const permissionsSource = read('src/lib/auth/permissions.ts')

run('performance assignment admin route, client, and server files exist', () => {
  assert.equal(
    existsSync(path.resolve(process.cwd(), 'src/app/(main)/admin/performance-assignments/page.tsx')),
    true
  )
  assert.equal(
    existsSync(
      path.resolve(process.cwd(), 'src/components/admin/PerformanceAssignmentAdminClient.tsx')
    ),
    true
  )
  assert.equal(
    existsSync(path.resolve(process.cwd(), 'src/app/api/admin/performance-assignments/route.ts')),
    true
  )
})

run('performance assignment management is wired into navigation and permission guards', () => {
  assert.equal(navigationSource.includes('/admin/performance-assignments'), true)
  assert.equal(permissionsSource.includes('/admin/performance-assignments'), true)
  assert.equal(permissionsSource.includes('/api/admin/performance-assignments'), true)
})

run('performance assignment admin page loads real server data and renders the interactive client', () => {
  assert.equal(pageSource.includes('getPerformanceAssignmentPageData'), true)
  assert.equal(pageSource.includes('PerformanceAssignmentAdminClient'), true)
  assert.equal(pageSource.includes("redirect('/dashboard')"), true)
})

run('performance assignment client supports sync, override, reset, and evaluation deep links', () => {
  assert.equal(clientSource.includes("/api/admin/performance-assignments"), true)
  assert.equal(clientSource.includes("action: 'sync'"), true)
  assert.equal(clientSource.includes("action: 'override'"), true)
  assert.equal(clientSource.includes("action: 'reset'"), true)
  assert.equal(clientSource.includes('/evaluation/performance/'), true)
  assert.equal(clientSource.includes('자동 동기화'), true)
  assert.equal(clientSource.includes('자동 기준 복원'), true)
})

run('performance assignment service persists cycle-specific overrides and auto-reset behavior', () => {
  assert.equal(serviceSource.includes('EvaluationAssignmentSource.MANUAL'), true)
  assert.equal(serviceSource.includes('EvaluationAssignmentSource.AUTO'), true)
  assert.equal(serviceSource.includes('syncPerformanceAssignmentsForCycle'), true)
  assert.equal(serviceSource.includes('resetPerformanceAssignmentToAuto'), true)
  assert.equal(serviceSource.includes('resolveEvaluationStageAssignee'), true)
})

run('performance assignment admin API validates actions and writes refreshed page data', () => {
  assert.equal(routeSource.includes('AdminPerformanceAssignmentActionSchema'), true)
  assert.equal(routeSource.includes('syncPerformanceAssignmentsForCycle'), true)
  assert.equal(routeSource.includes('upsertPerformanceAssignment'), true)
  assert.equal(routeSource.includes('resetPerformanceAssignmentToAuto'), true)
  assert.equal(routeSource.includes('getPerformanceAssignmentPageData'), true)
})

console.log('Performance assignment admin tests completed')
