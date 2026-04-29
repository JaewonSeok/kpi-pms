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

  assert.match(pageSource, /resolveReadableOrgKpiDepartmentIds/)
  assert.match(pageSource, /resolveEditableOrgKpiDepartmentIds/)
  assert.match(pageSource, /collectDepartmentAncestorIds/)
  assert.match(routeSource, /resolveReadableOrgKpiDepartmentIds/)
  assert.match(routeSource, /resolveEditableOrgKpiDepartmentIds/)
  assert.match(
    routeSource,
    /if \(deptId && scopeDepartmentIds && !scopeDepartmentIds\.includes\(deptId\)\) \{/
  )
})

run('member org KPI screen switches to a read-only workspace instead of management actions', () => {
  const clientSource = read('src/components/kpi/OrgKpiManagementClient.tsx')

  assert.match(clientSource, /const isReadOnlyScopeView =/)
  assert.match(clientSource, /const MEMBER_TAB_ORDER: TabKey\[\] = \['list', 'map', 'linkage', 'history'\]/)
  assert.match(clientSource, /const visibleTabs = isReadOnlyScopeView\s*\?\s*MEMBER_TAB_ORDER\s*:\s*TAB_ORDER/)
  assert.match(clientSource, /data-testid="org-kpi-readonly-badge"/)
  assert.match(clientSource, /readOnly=\{isReadOnlyScopeView\}/)
  assert.doesNotMatch(clientSource, /MemberReadOnlySummaryCard/)
  assert.doesNotMatch(clientSource, /data-testid="org-kpi-member-readonly-panel-header"/)
})

run('member org KPI flow keeps write APIs server-blocked', () => {
  const createRouteSource = read('src/app/api/kpi/org/route.ts')
  const updateRouteSource = read('src/app/api/kpi/org/[id]/route.ts')
  const workflowRouteSource = read('src/app/api/kpi/org/[id]/workflow/route.ts')

  assert.match(createRouteSource, /canManageOrgKpiWriteScope/)
  assert.match(updateRouteSource, /canManageOrgKpiWriteScope/)
  assert.match(workflowRouteSource, /canManageOrgKpiWriteScope/)
})

console.log('Org KPI member access tests completed')
