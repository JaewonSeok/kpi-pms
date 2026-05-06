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
  assert.equal(normalizeOrgKpiScope('section'), 'section')
  assert.equal(normalizeOrgKpiScope('team'), 'team')
  assert.equal(normalizeOrgKpiScope('unknown'), null)
})

run('department scope is derived from tree depth and child ownership', () => {
  const scopeMap = buildOrgKpiDepartmentScopeMap(departments)

  assert.equal(scopeMap.get('dept-hq'), 'division')
  assert.equal(scopeMap.get('dept-section'), 'section')
  assert.equal(scopeMap.get('dept-team-a'), 'team')
  assert.equal(scopeMap.get('dept-team-b'), 'team')
})

run('division, section, and team filters stay partitioned', () => {
  const divisionDepartments = filterDepartmentsByOrgKpiScope(departments, 'division')
  const sectionDepartments = filterDepartmentsByOrgKpiScope(departments, 'section')
  const teamDepartments = filterDepartmentsByOrgKpiScope(departments, 'team')

  assert.deepEqual(
    divisionDepartments.map((item) => item.id),
    ['dept-hq'],
  )
  assert.deepEqual(
    sectionDepartments.map((item) => item.id),
    ['dept-section'],
  )
  assert.deepEqual(
    teamDepartments.map((item) => item.id),
    ['dept-team-a', 'dept-team-b'],
  )
})

run('single department scope resolution uses the same derived rule', () => {
  assert.equal(resolveOrgKpiScopeFromDepartmentId('dept-section', departments), 'section')
  assert.equal(resolveOrgKpiScopeFromDepartmentId('dept-team-a', departments), 'team')
})

run('orgs without a section layer continue to expose division and team only', () => {
  const flattenedDepartments = [
    { id: 'dept-hq', parentDeptId: null },
    { id: 'dept-team-a', parentDeptId: 'dept-hq' },
    { id: 'dept-team-b', parentDeptId: 'dept-hq' },
  ]

  const scopeMap = buildOrgKpiDepartmentScopeMap(flattenedDepartments)

  assert.equal(scopeMap.get('dept-hq'), 'division')
  assert.equal(scopeMap.get('dept-team-a'), 'team')
  assert.equal(scopeMap.get('dept-team-b'), 'team')
  assert.deepEqual(
    filterDepartmentsByOrgKpiScope(flattenedDepartments, 'section').map((item) => item.id),
    [],
  )
})

run('multi-level org trees still preserve division above a real section layer', () => {
  const layeredDepartments = [
    { id: 'dept-root', parentDeptId: null },
    { id: 'dept-division', parentDeptId: 'dept-root' },
    { id: 'dept-section', parentDeptId: 'dept-division' },
    { id: 'dept-team', parentDeptId: 'dept-section' },
  ]

  const scopeMap = buildOrgKpiDepartmentScopeMap(layeredDepartments)

  assert.equal(scopeMap.get('dept-root'), 'division')
  assert.equal(scopeMap.get('dept-division'), 'division')
  assert.equal(scopeMap.get('dept-section'), 'section')
  assert.equal(scopeMap.get('dept-team'), 'team')
})

run('mixed division children keep leaf 실 as section and sibling teams as team', () => {
  const mixedDepartments = [
    { id: 'dept-division', deptName: '경영지원본부', parentDeptId: null },
    { id: 'dept-section-leaf', deptName: '재무관리실', parentDeptId: 'dept-division' },
    { id: 'dept-team-direct', deptName: '인사팀', parentDeptId: 'dept-division' },
  ]

  const scopeMap = buildOrgKpiDepartmentScopeMap(mixedDepartments)

  assert.equal(scopeMap.get('dept-division'), 'division')
  assert.equal(scopeMap.get('dept-section-leaf'), 'section')
  assert.equal(scopeMap.get('dept-team-direct'), 'team')
  assert.deepEqual(
    filterDepartmentsByOrgKpiScope(mixedDepartments, 'section').map((item) => item.id),
    ['dept-section-leaf'],
  )
  assert.deepEqual(
    filterDepartmentsByOrgKpiScope(mixedDepartments, 'team').map((item) => item.id),
    ['dept-team-direct'],
  )
})
