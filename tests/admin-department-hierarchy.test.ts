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

const leafSectionDepartments = [
  { id: 'dept-division', deptCode: 'HQ', deptName: '경영지원본부', parentDeptId: null },
  { id: 'dept-section-leaf', deptCode: 'FIN-SEC', deptName: '재무관리실', parentDeptId: 'dept-division' },
]

const mixedHierarchyDepartments = [
  { id: 'dept-division', deptCode: 'HQ', deptName: '경영지원본부', parentDeptId: null },
  { id: 'dept-section', deptCode: 'FIN-SEC', deptName: '재무관리실', parentDeptId: 'dept-division' },
  { id: 'dept-direct-team', deptCode: 'HR-TEAM', deptName: '인사팀', parentDeptId: 'dept-division' },
  { id: 'dept-section-team', deptCode: 'ACC-TEAM', deptName: '회계팀', parentDeptId: 'dept-section' },
]

run('three-layer lineage resolves division, section, and team selectors', () => {
  const state = buildDepartmentSelectionState(threeLayerDepartments, 'dept-team')

  assert.equal(state.selectedDivisionId, 'dept-division')
  assert.equal(state.selectedSectionId, 'dept-section')
  assert.equal(state.selectedTeamId, 'dept-team')
  assert.equal(state.hasSectionLayer, true)
  assert.equal(state.hasDirectDivisionTeams, false)
  assert.deepEqual(state.sectionOptions.map((department) => department.id), ['dept-section'])
  assert.deepEqual(state.teamOptions.map((department) => department.id), ['dept-team'])
  assert.equal(state.resolvedDepartmentId, 'dept-team')
})

run('two-layer lineage keeps section selector empty and resolves direct team selection', () => {
  const state = buildDepartmentSelectionState(twoLayerDepartments, 'dept-team')

  assert.equal(state.selectedDivisionId, 'dept-division')
  assert.equal(state.selectedSectionId, '')
  assert.equal(state.selectedTeamId, 'dept-team')
  assert.equal(state.hasSectionLayer, false)
  assert.equal(state.hasDirectDivisionTeams, true)
  assert.deepEqual(state.teamOptions.map((department) => department.id), ['dept-team'])
  assert.equal(state.resolvedDepartmentId, 'dept-team')
})

run('leaf child departments ending with 실 are treated as section options in admin registration', () => {
  const state = buildDepartmentSelectionState(leafSectionDepartments, 'dept-section-leaf')

  assert.equal(state.selectedDivisionId, 'dept-division')
  assert.equal(state.selectedSectionId, 'dept-section-leaf')
  assert.equal(state.selectedTeamId, '')
  assert.equal(state.hasSectionLayer, true)
  assert.deepEqual(state.sectionOptions.map((department) => department.id), ['dept-section-leaf'])
  assert.deepEqual(state.teamOptions, [])
  assert.equal(state.resolvedDepartmentId, 'dept-section-leaf')
})

run('mixed hierarchy shows direct division teams when no section is selected', () => {
  const state = buildDepartmentSelectionState(mixedHierarchyDepartments, 'dept-division')

  assert.equal(state.selectedDivisionId, 'dept-division')
  assert.equal(state.selectedSectionId, '')
  assert.equal(state.selectedTeamId, '')
  assert.equal(state.hasSectionLayer, true)
  assert.equal(state.hasDirectDivisionTeams, true)
  assert.deepEqual(state.sectionOptions.map((department) => department.id), ['dept-section'])
  assert.deepEqual(state.teamOptions.map((department) => department.id), ['dept-direct-team'])
  assert.equal(state.resolvedDepartmentId, 'dept-division')
})

run('mixed hierarchy switches team options to the selected section children', () => {
  const state = buildDepartmentSelectionState(mixedHierarchyDepartments, 'dept-section')

  assert.equal(state.selectedDivisionId, 'dept-division')
  assert.equal(state.selectedSectionId, 'dept-section')
  assert.equal(state.selectedTeamId, '')
  assert.deepEqual(state.teamOptions.map((department) => department.id), ['dept-section-team'])
  assert.equal(state.resolvedDepartmentId, 'dept-section')
})

run('mixed hierarchy resolves final affiliation to the deepest selected team', () => {
  const state = buildDepartmentSelectionState(mixedHierarchyDepartments, 'dept-section-team')

  assert.equal(state.selectedDivisionId, 'dept-division')
  assert.equal(state.selectedSectionId, 'dept-section')
  assert.equal(state.selectedTeamId, 'dept-section-team')
  assert.deepEqual(state.teamOptions.map((department) => department.id), ['dept-section-team'])
  assert.equal(state.resolvedDepartmentId, 'dept-section-team')
})

console.log('Admin department hierarchy tests completed')
