import assert from 'node:assert/strict'
import {
  canManageOrgKpiWriteScope,
  collectDepartmentAncestorIds,
  resolveEditableOrgKpiDepartmentIds,
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
  { id: 'dept-division', parentDeptId: null, leaderEmployeeId: 'leader-division' },
  { id: 'dept-section', parentDeptId: 'dept-division', leaderEmployeeId: 'leader-section' },
  { id: 'dept-team', parentDeptId: 'dept-section', leaderEmployeeId: 'leader-team' },
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

run('actual section leader can read team descendants plus section and division lineage', () => {
  const ids = resolveReadableOrgKpiDepartmentIds({
    userId: 'leader-section',
    role: 'ROLE_MEMBER',
    deptId: 'dept-section',
    accessibleDepartmentIds: [],
    departments: sectionHierarchy,
  })

  assert.deepEqual(ids, ['dept-section', 'dept-team', 'dept-division'])
})

run('section-lineage members can still read lower team scope in the same branch', () => {
  const ids = resolveReadableOrgKpiDepartmentIds({
    role: 'ROLE_MEMBER',
    deptId: 'dept-section',
    accessibleDepartmentIds: [],
    departments: sectionHierarchy,
  })

  assert.deepEqual(ids, ['dept-section', 'dept-team', 'dept-division'])
})

run('team-level leaders can read their own lineage up through section and division', () => {
  const ids = resolveReadableOrgKpiDepartmentIds({
    role: 'ROLE_TEAM_LEADER',
    deptId: 'dept-team',
    accessibleDepartmentIds: ['dept-team'],
    departments: sectionHierarchy,
  })

  assert.deepEqual(ids, ['dept-team', 'dept-section', 'dept-division'])
})

run('ordinary members stay non-editable even when they can read ancestor scopes', () => {
  const ids = resolveEditableOrgKpiDepartmentIds({
    userId: 'member-1',
    role: 'ROLE_MEMBER',
    deptId: 'dept-team',
    accessibleDepartmentIds: [],
    departments: sectionHierarchy,
  })

  assert.deepEqual(ids, [])
})

run('department leader can edit their own section even without elevated role string', () => {
  const ids = resolveEditableOrgKpiDepartmentIds({
    userId: 'leader-section',
    role: 'ROLE_MEMBER',
    deptId: 'dept-section',
    accessibleDepartmentIds: [],
    departments: sectionHierarchy,
  })

  assert.deepEqual(ids, ['dept-section'])
  assert.equal(
    canManageOrgKpiWriteScope({
      userId: 'leader-section',
      role: 'ROLE_MEMBER',
      deptId: 'dept-section',
      accessibleDepartmentIds: [],
      departments: sectionHierarchy,
    }),
    true,
  )
})

run('team-manage lineage also gains editable section and division scopes in the same branch', () => {
  const ids = resolveEditableOrgKpiDepartmentIds({
    userId: 'leader-team',
    role: 'ROLE_TEAM_LEADER',
    deptId: 'dept-team',
    accessibleDepartmentIds: ['dept-team'],
    departments: sectionHierarchy,
  })

  assert.deepEqual(ids, ['dept-team', 'dept-section', 'dept-division'])
  assert.equal(
    canManageOrgKpiWriteScope({
      userId: 'leader-team',
      role: 'ROLE_TEAM_LEADER',
      deptId: 'dept-team',
      accessibleDepartmentIds: ['dept-team'],
      departments: sectionHierarchy,
    }),
    true,
  )
})

run('ancestor helper walks only the current lineage', () => {
  const byId = new Map(sectionHierarchy.map((department) => [department.id, department] as const))

  assert.deepEqual(
    collectDepartmentAncestorIds('dept-team', byId),
    ['dept-section', 'dept-division'],
  )
})
