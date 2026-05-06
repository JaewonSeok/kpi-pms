import assert from 'node:assert/strict'
import { buildDepartmentSelectionState } from '../src/lib/admin-department-hierarchy'

function run(name: string, fn: () => void) {
  try {
    fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

const threeLayerDepartments = [
  { id: 'dept-division', deptCode: 'DIV', deptName: '경영지원본부', parentDeptId: null },
  { id: 'dept-section', deptCode: 'SEC', deptName: '경영지원실', parentDeptId: 'dept-division' },
  { id: 'dept-team', deptCode: 'TEAM', deptName: '인사팀', parentDeptId: 'dept-section' },
]

const twoLayerDepartments = [
  { id: 'dept-division', deptCode: 'DIV', deptName: '사업본부', parentDeptId: null },
  { id: 'dept-team', deptCode: 'TEAM', deptName: '영업팀', parentDeptId: 'dept-division' },
]

run('three-layer lineage resolves division, section, and team selectors', () => {
  const state = buildDepartmentSelectionState(threeLayerDepartments, 'dept-team')

  assert.equal(state.selectedDivisionId, 'dept-division')
  assert.equal(state.selectedSectionId, 'dept-section')
  assert.equal(state.selectedTeamId, 'dept-team')
  assert.equal(state.hasSectionLayer, true)
  assert.deepEqual(
    state.sectionOptions.map((department) => department.id),
    ['dept-section'],
  )
  assert.deepEqual(
    state.teamOptions.map((department) => department.id),
    ['dept-team'],
  )
})

run('two-layer lineage keeps section selector empty and resolves direct team selection', () => {
  const state = buildDepartmentSelectionState(twoLayerDepartments, 'dept-team')

  assert.equal(state.selectedDivisionId, 'dept-division')
  assert.equal(state.selectedSectionId, '')
  assert.equal(state.selectedTeamId, 'dept-team')
  assert.equal(state.hasSectionLayer, false)
  assert.deepEqual(
    state.teamOptions.map((department) => department.id),
    ['dept-team'],
  )
})

console.log('Admin department hierarchy tests completed')
