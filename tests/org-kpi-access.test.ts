import assert from 'node:assert/strict'
import {
  collectDepartmentAncestorIds,
  resolveReadableOrgKpiDepartmentIds,
} from '../src/server/org-kpi-access'

function run(name: string, fn: () => void) {
  try {
    fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

const directHierarchy = [
  { id: 'dept-division', parentDeptId: null },
  { id: 'dept-team', parentDeptId: 'dept-division' },
]

const sectionHierarchy = [
  { id: 'dept-division', parentDeptId: null },
  { id: 'dept-section', parentDeptId: 'dept-division' },
  { id: 'dept-team', parentDeptId: 'dept-section' },
]

run('member lineage includes own team and direct division when no section exists', () => {
  const ids = resolveReadableOrgKpiDepartmentIds({
    role: 'ROLE_MEMBER',
    deptId: 'dept-team',
    accessibleDepartmentIds: [],
    departments: directHierarchy,
  })

  assert.deepEqual(ids, ['dept-team', 'dept-division'])
})

run('member lineage includes own team, section, and division when a real section exists', () => {
  const ids = resolveReadableOrgKpiDepartmentIds({
    role: 'ROLE_MEMBER',
    deptId: 'dept-team',
    accessibleDepartmentIds: [],
    departments: sectionHierarchy,
  })

  assert.deepEqual(ids, ['dept-team', 'dept-section', 'dept-division'])
})

run('manager scopes continue to use accessible department ids instead of broadening to all ancestors', () => {
  const ids = resolveReadableOrgKpiDepartmentIds({
    role: 'ROLE_TEAM_LEADER',
    deptId: 'dept-team',
    accessibleDepartmentIds: ['dept-team'],
    departments: sectionHierarchy,
  })

  assert.deepEqual(ids, ['dept-team'])
})

run('ancestor helper walks only the current lineage', () => {
  const byId = new Map(sectionHierarchy.map((department) => [department.id, department] as const))

  assert.deepEqual(
    collectDepartmentAncestorIds('dept-team', byId),
    ['dept-section', 'dept-division'],
  )
})
