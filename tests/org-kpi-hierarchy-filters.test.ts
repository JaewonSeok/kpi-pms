import 'dotenv/config'
import './register-path-aliases'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import {
  buildOrgKpiEffectiveDepartmentIds,
  buildOrgKpiFilterContextLabel,
  getOrgKpiDivisionOptions,
  getOrgKpiSectionOptions,
  getOrgKpiTeamOptions,
  resolveOrgKpiFilterContext,
} from '../src/lib/org-kpi-filters'

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

const departments = [
  { id: 'div-hq', name: '경영지원본부', parentDepartmentId: null, organizationName: 'RSUPPORT', level: 0, scope: 'division' as const },
  { id: 'team-hr', name: '인사팀', parentDepartmentId: 'div-hq', organizationName: 'RSUPPORT', level: 1, scope: 'team' as const },
  { id: 'sec-fin', name: '재무관리실', parentDepartmentId: 'div-hq', organizationName: 'RSUPPORT', level: 1, scope: 'section' as const },
  { id: 'team-acc', name: '회계팀', parentDepartmentId: 'sec-fin', organizationName: 'RSUPPORT', level: 2, scope: 'team' as const },
]

async function main() {
  await run('mixed hierarchy exposes division, section, and team options separately', () => {
    const divisionOptions = getOrgKpiDivisionOptions(departments)
    const sectionOptions = getOrgKpiSectionOptions(departments, 'div-hq')
    const directTeamOptions = getOrgKpiTeamOptions({
      departments,
      divisionId: 'div-hq',
      sectionId: null,
    })
    const sectionTeamOptions = getOrgKpiTeamOptions({
      departments,
      divisionId: 'div-hq',
      sectionId: 'sec-fin',
    })

    assert.deepEqual(divisionOptions.map((department) => department.id), ['div-hq'])
    assert.deepEqual(sectionOptions.map((department) => department.id), ['sec-fin'])
    assert.deepEqual(directTeamOptions.map((department) => department.id), ['team-hr'])
    assert.deepEqual(sectionTeamOptions.map((department) => department.id), ['team-acc'])
  })

  await run('section-selected team scope excludes direct division teams', () => {
    const effectiveDepartmentIds = buildOrgKpiEffectiveDepartmentIds({
      scope: 'team',
      divisionId: 'div-hq',
      sectionId: 'sec-fin',
      teamId: null,
      divisionOptions: getOrgKpiDivisionOptions(departments),
      sectionOptions: getOrgKpiSectionOptions(departments, 'div-hq'),
      teamOptions: getOrgKpiTeamOptions({
        departments,
        divisionId: 'div-hq',
        sectionId: 'sec-fin',
      }),
    })

    assert.deepEqual(Array.from(effectiveDepartmentIds), ['team-acc'])
  })

  await run('direct division team context remains available when no section is selected', () => {
    const effectiveDepartmentIds = buildOrgKpiEffectiveDepartmentIds({
      scope: 'team',
      divisionId: 'div-hq',
      sectionId: null,
      teamId: null,
      divisionOptions: getOrgKpiDivisionOptions(departments),
      sectionOptions: getOrgKpiSectionOptions(departments, 'div-hq'),
      teamOptions: getOrgKpiTeamOptions({
        departments,
        divisionId: 'div-hq',
        sectionId: null,
      }),
    })

    assert.deepEqual(Array.from(effectiveDepartmentIds), ['team-hr'])
  })

  await run('context label distinguishes scope from actual organization range', () => {
    const label = buildOrgKpiFilterContextLabel({
      scopeLabel: '팀 KPI',
      divisionName: '경영지원본부',
      sectionName: '재무관리실',
      teamName: '회계팀',
    })

    assert.equal(label, '현재 범위: 경영지원본부 / 재무관리실 / 회계팀 · 팀 KPI')
  })

  await run('filter context resolves division and section ancestry from team', () => {
    const context = resolveOrgKpiFilterContext('team-acc', departments)

    assert.deepEqual(context, {
      divisionId: 'div-hq',
      sectionId: 'sec-fin',
      teamId: 'team-acc',
    })
  })

  await run('org KPI page and client source include hierarchy filter query wiring', () => {
    const pageSource = read('src/app/(main)/kpi/org/page.tsx')
    const clientSource = read('src/components/kpi/OrgKpiManagementClient.tsx')
    const serverSource = read('src/server/org-kpi-page.ts')

    assert.equal(pageSource.includes('divisionId?: string'), true)
    assert.equal(pageSource.includes('sectionId?: string'), true)
    assert.equal(pageSource.includes('teamId?: string'), true)
    assert.equal(pageSource.includes('q?: string'), true)
    assert.equal(clientSource.includes('OrgHierarchyFilterBar'), true)
    assert.equal(clientSource.includes("['divisionId', overrides?.divisionId ?? selectedDivisionId]"), true)
    assert.equal(clientSource.includes("['sectionId', overrides?.sectionId ?? selectedSectionId]"), true)
    assert.equal(clientSource.includes("['teamId', overrides?.teamId ?? selectedTeamId]"), true)
    assert.equal(clientSource.includes("['q', overrides?.q ?? (search.trim() || null)]"), true)
    assert.equal(serverSource.includes('hierarchyDepartments: OrgKpiScopeOption[]'), true)
  })
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
