import assert from 'node:assert/strict'
import { canAccessMenu, getAccessibleMenus, resolveMenuFromPath } from '../src/lib/auth/permissions'
import { buildOrgPath, getAccessibleDeptIds, getDescendantDeptIds, resolveManagerId } from '../src/server/auth/org-scope'

function run(name: string, fn: () => void) {
  try {
    fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

const departments = [
  { id: 'hq', deptCode: 'HQ', parentDeptId: null },
  { id: 'biz', deptCode: 'BIZ', parentDeptId: 'hq' },
  { id: 'dev', deptCode: 'DEV', parentDeptId: 'biz' },
  { id: 'team-a', deptCode: 'TEAM-A', parentDeptId: 'dev' },
]

run('menu permissions keep admin-only pages restricted', () => {
  assert.equal(canAccessMenu('ROLE_MEMBER', 'ORG_MANAGE'), false)
  assert.equal(canAccessMenu('ROLE_ADMIN', 'ORG_MANAGE'), true)
  assert.equal(canAccessMenu('ROLE_CEO', 'GRADE_ADJUST'), true)
})

run('accessible menu list includes compensation manage only for configured roles', () => {
  assert.equal(getAccessibleMenus('ROLE_MEMBER').includes('COMPENSATION_MANAGE'), false)
  assert.equal(getAccessibleMenus('ROLE_DIV_HEAD').includes('COMPENSATION_MANAGE'), true)
})

run('path resolution maps protected routes to menu keys', () => {
  assert.equal(resolveMenuFromPath('/admin/grades'), 'GRADE_SETTING')
  assert.equal(resolveMenuFromPath('/compensation/manage'), 'COMPENSATION_MANAGE')
  assert.equal(resolveMenuFromPath('/unknown/path'), null)
})

run('org path is built from department hierarchy', () => {
  const orgPath = buildOrgPath(
    {
      deptId: 'team-a',
      role: 'ROLE_TEAM_LEADER',
      position: 'TEAM_LEADER',
    },
    departments
  )

  assert.equal(orgPath, '/HQ/BIZ/DEV/TEAM-A')
})

run('descendant collection returns nested departments', () => {
  assert.deepEqual(getDescendantDeptIds('biz', departments), ['dev', 'team-a'])
})

run('accessible departments expand by role while member stays self-only', () => {
  assert.deepEqual(
    getAccessibleDeptIds(
      { deptId: 'dev', role: 'ROLE_DIV_HEAD', position: 'DIV_HEAD' },
      departments
    ),
    ['dev', 'team-a']
  )

  assert.deepEqual(
    getAccessibleDeptIds(
      { deptId: 'team-a', role: 'ROLE_MEMBER', position: 'MEMBER' },
      departments
    ),
    []
  )
})

run('manager resolution follows reporting chain fallback', () => {
  assert.equal(
    resolveManagerId({
      deptId: 'team-a',
      role: 'ROLE_MEMBER',
      position: 'MEMBER',
      managerId: 'explicit-manager',
      teamLeaderId: 'leader-1',
      sectionChiefId: 'chief-1',
      divisionHeadId: 'div-1',
    }),
    'explicit-manager'
  )

  assert.equal(
    resolveManagerId({
      deptId: 'team-a',
      role: 'ROLE_MEMBER',
      position: 'MEMBER',
      teamLeaderId: 'leader-1',
      sectionChiefId: 'chief-1',
      divisionHeadId: 'div-1',
    }),
    'leader-1'
  )

  assert.equal(
    resolveManagerId({
      deptId: 'dev',
      role: 'ROLE_SECTION_CHIEF',
      position: 'SECTION_CHIEF',
      divisionHeadId: 'div-1',
    }),
    'div-1'
  )
})

console.log('Auth RBAC tests completed')
