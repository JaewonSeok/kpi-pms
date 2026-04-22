import assert from 'node:assert/strict'
import {
  buildOrgKpiDepartmentScopeMap,
  filterDepartmentsByOrgKpiScope,
  normalizeOrgKpiScope,
  resolveOrgKpiScopeFromDepartmentId,
} from '../src/lib/org-kpi-scope'

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
  { id: 'dept-hq', parentDeptId: null },
  { id: 'dept-section', parentDeptId: 'dept-hq' },
  { id: 'dept-team-a', parentDeptId: 'dept-section' },
  { id: 'dept-team-b', parentDeptId: 'dept-section' },
]

run('normalizeOrgKpiScope accepts only supported values', () => {
  assert.equal(normalizeOrgKpiScope('division'), 'division')
  assert.equal(normalizeOrgKpiScope('team'), 'team')
  assert.equal(normalizeOrgKpiScope('unknown'), null)
})

run('department scope is derived from whether the department has children', () => {
  const scopeMap = buildOrgKpiDepartmentScopeMap(departments)

  assert.equal(scopeMap.get('dept-hq'), 'division')
  assert.equal(scopeMap.get('dept-section'), 'division')
  assert.equal(scopeMap.get('dept-team-a'), 'team')
  assert.equal(scopeMap.get('dept-team-b'), 'team')
})

run('leaf and non-leaf department filters stay partitioned', () => {
  const divisionDepartments = filterDepartmentsByOrgKpiScope(departments, 'division')
  const teamDepartments = filterDepartmentsByOrgKpiScope(departments, 'team')

  assert.deepEqual(
    divisionDepartments.map((item) => item.id),
    ['dept-hq', 'dept-section'],
  )
  assert.deepEqual(
    teamDepartments.map((item) => item.id),
    ['dept-team-a', 'dept-team-b'],
  )
})

run('single department scope resolution uses the same derived rule', () => {
  assert.equal(resolveOrgKpiScopeFromDepartmentId('dept-section', departments), 'division')
  assert.equal(resolveOrgKpiScopeFromDepartmentId('dept-team-a', departments), 'team')
})
