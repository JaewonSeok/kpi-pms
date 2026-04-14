import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { resolveMenuFromPath } from '../src/lib/auth/permissions'
import { flattenNavigationItems, filterNavigationItemsByRole, NAV_ITEMS } from '../src/lib/navigation'

function run(name: string, fn: () => void) {
  try {
    fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

function hrefsForRole(role: string) {
  return flattenNavigationItems(filterNavigationItemsByRole(NAV_ITEMS, role)).map((item) => item.href)
}

run('all sidebar leaf routes resolve to an implemented page file', () => {
  const leafItems = flattenNavigationItems(NAV_ITEMS)

  for (const item of leafItems) {
    const routePath = new URL(item.href, 'https://kpi-pms.local').pathname
    const candidates = [
      path.resolve(process.cwd(), `src/app${routePath}/page.tsx`),
      path.resolve(process.cwd(), `src/app/(main)${routePath}/page.tsx`),
    ]

    assert.equal(
      candidates.some((candidate) => existsSync(candidate)),
      true,
      `${item.label} -> ${item.href} is missing a page.tsx`
    )
  }
})

run('main app catch-all placeholder exists for unmapped in-app routes', () => {
  const catchAllPage = path.resolve(process.cwd(), 'src/app/(main)/[...slug]/page.tsx')
  assert.equal(existsSync(catchAllPage), true)
})

run('guarded navigation routes map back to middleware permission keys', () => {
  const guardedItems = flattenNavigationItems(NAV_ITEMS).filter((item) => item.menuKey && !item.href.includes('?'))

  for (const item of guardedItems) {
    assert.equal(resolveMenuFromPath(item.href), item.menuKey, `${item.href} should resolve to ${item.menuKey}`)
  }
})

run('member sidebar hides admin-only and restricted KPI routes', () => {
  const memberHrefs = hrefsForRole('ROLE_MEMBER')

  assert.equal(memberHrefs.includes('/admin/grades'), false)
  assert.equal(memberHrefs.includes('/admin/org-chart'), false)
  assert.equal(memberHrefs.includes('/kpi/org'), true)
  assert.equal(memberHrefs.includes('/compensation/manage'), false)
  assert.equal(memberHrefs.includes('/kpi/monthly'), true)
  assert.equal(memberHrefs.includes('/evaluation/ai-competency'), true)
  assert.equal(memberHrefs.includes('/evaluation/360'), true)
  assert.equal(memberHrefs.includes('/evaluation/upward/respond'), true)
  assert.equal(memberHrefs.includes('/evaluation/upward/admin'), false)
  assert.equal(memberHrefs.includes('/evaluation/word-cloud-360'), true)
})

run('ceo sidebar excludes monthly record but keeps ceo-specific routes', () => {
  const ceoHrefs = hrefsForRole('ROLE_CEO')

  assert.equal(ceoHrefs.includes('/kpi/monthly'), false)
  assert.equal(ceoHrefs.includes('/evaluation/ai-competency'), true)
  assert.equal(ceoHrefs.includes('/evaluation/word-cloud-360'), true)
  assert.equal(ceoHrefs.includes('/evaluation/ceo-adjust'), true)
  assert.equal(ceoHrefs.includes('/compensation/manage'), true)
})

run('admin sidebar exposes every admin and setup route', () => {
  const adminHrefs = hrefsForRole('ROLE_ADMIN')

  for (const href of [
    '/kpi/org',
    '/kpi/monthly',
    '/evaluation/ai-competency',
    '/evaluation/360',
    '/evaluation/upward/respond',
    '/evaluation/upward/admin',
    '/evaluation/word-cloud-360',
    '/evaluation/results',
    '/evaluation/appeal',
    '/evaluation/ceo-adjust',
    '/admin/google-access?tab=org-chart',
    '/admin/grades',
    '/admin/eval-cycle',
    '/admin/performance-calendar',
    '/admin/performance-design',
    '/admin/goal-alignment',
    '/admin/google-access',
    '/admin/notifications',
    '/admin/ops',
  ]) {
    assert.equal(adminHrefs.includes(href), true, `${href} should be visible to ROLE_ADMIN`)
  }
})

console.log('Navigation integrity tests completed')
