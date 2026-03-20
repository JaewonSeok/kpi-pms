import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { flattenNavigationItems, filterNavigationItemsByRole, NAV_ITEMS } from '../src/lib/navigation'

async function run(name: string, fn: () => void | Promise<void>) {
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

function hrefsForRole(role: string) {
  return flattenNavigationItems(filterNavigationItemsByRole(NAV_ITEMS, role)).map((item) => item.href)
}

async function main() {
await run('feedback 360 routes exist as usable page shells', () => {
  const requiredPages = [
    'src/app/(main)/evaluation/360/page.tsx',
    'src/app/(main)/evaluation/360/nomination/page.tsx',
    'src/app/(main)/evaluation/360/results/page.tsx',
    'src/app/(main)/evaluation/360/admin/page.tsx',
    'src/app/(main)/evaluation/360/respond/[feedbackId]/page.tsx',
  ]

  for (const file of requiredPages) {
    assert.equal(existsSync(path.resolve(process.cwd(), file)), true, `${file} should exist`)
  }
})

await run('feedback 360 navigation is visible to authenticated members and admins', () => {
  assert.equal(hrefsForRole('ROLE_MEMBER').includes('/evaluation/360'), true)
  assert.equal(hrefsForRole('ROLE_ADMIN').includes('/evaluation/360'), true)
})

await run('feedback 360 api routes exist', () => {
  const requiredRoutes = [
    'src/app/api/feedback/rounds/route.ts',
    'src/app/api/feedback/rounds/[id]/nominations/route.ts',
    'src/app/api/feedback/rounds/[id]/workflow/route.ts',
    'src/app/api/feedback/rounds/[id]/report/route.ts',
    'src/app/api/feedback/360/ai/route.ts',
    'src/app/api/development-plans/route.ts',
  ]

  for (const file of requiredRoutes) {
    assert.equal(existsSync(path.resolve(process.cwd(), file)), true, `${file} should exist`)
  }
})

await run('feedback 360 validation contracts are defined', () => {
  const file = read('src/lib/validations.ts')

  assert.equal(file.includes('FeedbackNominationDraftSchema'), true)
  assert.equal(file.includes('Feedback360AiActionSchema'), true)
})

await run('performance copilot defines feedback 360 helpers', () => {
  const file = read('src/server/ai/performance-copilot.ts')

  assert.equal(file.includes('export function recommend360Reviewers'), true)
  assert.equal(file.includes('export function summarize360Themes'), true)
  assert.equal(file.includes('export function detectCarelessReviews'), true)
  assert.equal(file.includes('export function suggestDevelopmentPlan'), true)
})

console.log('Feedback 360 foundation tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
