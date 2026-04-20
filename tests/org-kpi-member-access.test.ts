import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { canAccessMenu } from '../src/lib/auth/permissions'
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

function read(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')
}

run('members can see the org KPI menu entry in the KPI section', () => {
  const memberHrefs = flattenNavigationItems(filterNavigationItemsByRole(NAV_ITEMS, 'ROLE_MEMBER')).map(
    (item) => item.href
  )

  assert.equal(canAccessMenu('ROLE_MEMBER', 'ORG_KPI_UPLOAD'), true)
  assert.equal(memberHrefs.includes('/kpi/org'), true)
})

run('member org KPI data is server-scoped to the actor department', () => {
  const pageSource = read('src/server/org-kpi-page.ts')
  const routeSource = read('src/app/api/kpi/org/route.ts')

  assert.match(pageSource, /if \(params\.role === 'ROLE_MEMBER'\) \{\s*return \[params\.deptId\]/)
  assert.match(routeSource, /if \(session\.user\.role === 'ROLE_MEMBER'\) \{\s*return \[session\.user\.deptId\]/)
  assert.match(
    routeSource,
    /if \(deptId && scopeDepartmentIds && !scopeDepartmentIds\.includes\(deptId\)\) \{/
  )
})

run('member org KPI screen switches to a read-only workspace instead of management actions', () => {
  const clientSource = read('src/components/kpi/OrgKpiManagementClient.tsx')

  assert.match(clientSource, /const isReadOnlyMemberView = pageData\.actor\.role === 'ROLE_MEMBER'/)
  assert.match(
    clientSource,
    /const visibleTabs = isReadOnlyMemberView\s*\?\s*\(\['list', 'linkage', 'history'\] as TabKey\[\]\)/
  )
  assert.match(clientSource, /data-testid="org-kpi-member-readonly-badge"/)
  assert.match(clientSource, /MemberReadOnlySummaryCard/)
  assert.match(clientSource, /readOnly=\{isReadOnlyMemberView\}/)
  assert.match(clientSource, /data-testid="org-kpi-member-readonly-panel"/)
})

run('member org KPI flow keeps write APIs server-blocked', () => {
  const createRouteSource = read('src/app/api/kpi/org/route.ts')
  const updateRouteSource = read('src/app/api/kpi/org/[id]/route.ts')
  const workflowRouteSource = read('src/app/api/kpi/org/[id]/workflow/route.ts')

  assert.match(createRouteSource, /if \(session\.user\.role === 'ROLE_MEMBER'\) \{/)
  assert.match(updateRouteSource, /if \(session\.user\.role === 'ROLE_MEMBER'\) \{/)
  assert.match(
    workflowRouteSource,
    /return \['ROLE_ADMIN', 'ROLE_CEO', 'ROLE_DIV_HEAD', 'ROLE_SECTION_CHIEF', 'ROLE_TEAM_LEADER'\]\.includes\(role\)/
  )
})

console.log('Org KPI member access tests completed')
