import 'dotenv/config'
import './register-path-aliases'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { OrgKpiViewModel } from '../src/server/org-kpi-page'
import {
  applySavedOrgKpiToList,
  buildOrgKpiServerListSignature,
} from '../src/lib/org-kpi-client-state'

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

function makeKpi(overrides: Partial<OrgKpiViewModel> = {}): OrgKpiViewModel {
  return {
    id: 'org-kpi-1',
    title: 'Operating Cost Reduction',
    scope: 'division',
    tags: [],
    evalYear: 2026,
    departmentId: 'dept-hq',
    departmentName: 'Division HQ',
    departmentCode: 'HQ',
    parentOrgKpiId: null,
    parentOrgKpiTitle: null,
    parentOrgDepartmentName: null,
    parentReference: null,
    childReferences: [],
    childOrgKpiCount: 0,
    lineage: [],
    category: '운영',
    type: 'QUANTITATIVE',
    definition: '기존 정의',
    formula: '기존 산식',
    targetValue: 10,
    targetValueT: 8,
    targetValueE: 10,
    targetValueS: 12,
    unit: '%',
    weight: 40,
    difficulty: 'MEDIUM',
    status: 'DRAFT',
    persistedStatus: 'DRAFT',
    owner: undefined,
    linkedPersonalKpiCount: 0,
    linkedConfirmedPersonalKpiCount: 0,
    monthlyAchievementRate: undefined,
    updatedAt: '2026-04-15T00:00:00.000Z',
    coverageRate: 0,
    targetPopulationCount: 0,
    cloneInfo: undefined,
    suggestedParent: null,
    suggestedChildren: [],
    linkedPersonalKpis: [],
    recentMonthlyRecords: [],
    history: [],
    ...overrides,
  }
}

async function main() {
  await run('server list signature changes when the KPI keeps the same id but moves departments', () => {
    const before = buildOrgKpiServerListSignature([makeKpi()])
    const after = buildOrgKpiServerListSignature([
      makeKpi({
        departmentId: 'dept-hr-team',
        departmentName: 'HR Team',
        scope: 'team',
      }),
    ])

    assert.notEqual(before, after)
  })

  await run('saved org KPI is reclassified into the new department and scope immediately after save', () => {
    const currentItems = [
      makeKpi(),
      makeKpi({
        id: 'org-kpi-2',
        title: 'Recruiting Brand Strengthening',
        departmentId: 'dept-hr-team',
        departmentName: 'HR Team',
        scope: 'team',
      }),
    ]

    const updated = applySavedOrgKpiToList({
      currentItems,
      savedId: 'org-kpi-1',
      departments: [
        {
          id: 'dept-hq',
          name: 'Division HQ',
          parentDepartmentId: null,
          organizationName: 'Head Office',
          level: 0,
          scope: 'division',
        },
        {
          id: 'dept-hr-team',
          name: 'HR Team',
          parentDepartmentId: 'dept-hq',
          organizationName: 'Head Office',
          level: 1,
          scope: 'team',
        },
      ],
      parentGoalOptions: [
        {
          id: 'parent-division',
          title: 'Talent Information Advancement',
          departmentId: 'dept-hq',
          departmentName: 'Division HQ',
          evalYear: 2026,
          scope: 'division',
        },
      ],
      form: {
        deptId: 'dept-hr-team',
        evalYear: '2026',
        parentOrgKpiId: 'parent-division',
        kpiType: 'QUALITATIVE',
        kpiCategory: '인사',
        kpiName: 'Core Talent Information',
        tags: '채용, 브랜딩',
        definition: '신규 정의',
        formula: '신규 산식',
        targetValueT: '10',
        targetValueE: '12',
        targetValueS: '14',
        unit: '건',
        weight: '35',
        difficulty: 'HIGH',
      },
    })

    const moved = updated.find((item) => item.id === 'org-kpi-1')
    assert.ok(moved)
    assert.equal(moved.departmentId, 'dept-hr-team')
    assert.equal(moved.departmentName, 'HR Team')
    assert.equal(moved.scope, 'team')
    assert.equal(moved.parentOrgKpiId, 'parent-division')
    assert.equal(moved.parentOrgKpiTitle, 'Talent Information Advancement')
    assert.equal(moved.parentReference?.scope, 'division')
    assert.equal(moved.title, 'Core Talent Information')
    assert.equal(moved.category, '인사')
    assert.equal(moved.targetValue, 12)
    assert.equal(moved.targetValueT, 10)
    assert.equal(moved.targetValueE, 12)
    assert.equal(moved.targetValueS, 14)
  })

  await run('org KPI client keeps URL state synchronized with scope, tab, and selected KPI', () => {
    const source = read('src/components/kpi/OrgKpiManagementClient.tsx')

    assert.equal(source.includes('buildOrgKpiServerListSignature(pageData.list)'), true)
    assert.equal(source.includes('applySavedOrgKpiToList'), true)
    assert.equal(source.includes("['scope', overrides?.scope ?? pageData.selectedScope]"), true)
    assert.equal(source.includes("['tab', overrides?.tab]"), true)
    assert.equal(source.includes("['kpiId', overrides?.kpiId"), true)
    assert.equal(source.includes('window.history.replaceState'), true)
    assert.equal(source.includes("['dept', overrides?.dept"), false)
  })

  await run('org KPI update routes validate scope before persisting department changes', () => {
    const createRouteSource = read('src/app/api/kpi/org/route.ts')
    const updateRouteSource = read('src/app/api/kpi/org/[id]/route.ts')

    assert.equal(createRouteSource.includes('assertOrgKpiScopeMatchesDepartment'), true)
    assert.equal(updateRouteSource.includes('assertOrgKpiScopeMatchesDepartment'), true)
    assert.equal(updateRouteSource.includes('const targetDeptId = data.deptId ?? current.deptId'), true)
  })
}

void main()
