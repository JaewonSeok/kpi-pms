import 'dotenv/config'
import './register-path-aliases'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { filterTeamDepartmentsForOrgKpiContext } from '../src/lib/org-kpi-scope'

function read(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')
}

async function run(name: string, fn: () => void | Promise<void>) {
  try {
    await fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

async function main() {
  const departments = [
    { id: 'dept-division', deptName: '경영지원본부', parentDeptId: null },
    { id: 'dept-direct-team', deptName: '인사팀', parentDeptId: 'dept-division' },
    { id: 'dept-section', deptName: '재무관리실', parentDeptId: 'dept-division' },
    { id: 'dept-team-a', deptName: '회계팀', parentDeptId: 'dept-section' },
    { id: 'dept-team-b', deptName: '자금팀', parentDeptId: 'dept-section' },
  ]

  await run('section context keeps only child teams under that section', () => {
    const filtered = filterTeamDepartmentsForOrgKpiContext(departments, departments, 'dept-section')

    assert.deepEqual(
      filtered.map((department) => department.id),
      ['dept-team-a', 'dept-team-b'],
    )
  })

  await run('section with no child team does not fall back to direct division teams', () => {
    const noChildDepartments = [
      { id: 'dept-division', deptName: '경영지원본부', parentDeptId: null },
      { id: 'dept-direct-team', deptName: '인사팀', parentDeptId: 'dept-division' },
      { id: 'dept-section', deptName: '재무관리실', parentDeptId: 'dept-division' },
    ]

    const filtered = filterTeamDepartmentsForOrgKpiContext(
      noChildDepartments,
      noChildDepartments,
      'dept-section',
    )

    assert.deepEqual(filtered.map((department) => department.id), [])
  })

  await run('non-section context keeps direct division team behavior', () => {
    const filtered = filterTeamDepartmentsForOrgKpiContext(departments, departments, 'dept-division')

    assert.deepEqual(
      filtered.map((department) => department.id),
      ['dept-direct-team', 'dept-team-a', 'dept-team-b'],
    )
  })

  await run('org KPI route/client preserve section context with departmentId anchor', () => {
    const pageSource = read('src/app/(main)/kpi/org/page.tsx')
    const clientSource = read('src/components/kpi/OrgKpiManagementClient.tsx')
    const loaderSource = read('src/server/org-kpi-page.ts')

    assert.equal(pageSource.includes('departmentId?: string'), true)
    assert.equal(pageSource.includes('selectedDepartmentId: resolvedSearchParams.departmentId'), true)
    assert.equal(clientSource.includes("['departmentId', overrides?.departmentId ?? activeScopeDepartmentId]"), true)
    assert.equal(clientSource.includes("scopeContext?.scope === 'section'"), true)
    assert.equal(loaderSource.includes('filterTeamDepartmentsForOrgKpiContext'), true)
    assert.equal(loaderSource.includes('scopeContext:'), true)
  })
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
