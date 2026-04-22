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
    title: '핵심 비용 절감',
    scope: 'division',
    tags: [],
    evalYear: 2026,
    departmentId: 'dept-hq',
    departmentName: '경영지원본부',
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
    riskFlags: [],
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
        departmentName: '인사팀',
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
        title: '채용 브랜딩 강화',
        departmentId: 'dept-hr-team',
        departmentName: '인사팀',
        scope: 'team',
      }),
    ]

    const updated = applySavedOrgKpiToList({
      currentItems,
      savedId: 'org-kpi-1',
      departments: [
        {
          id: 'dept-hq',
          name: '경영지원본부',
          parentDepartmentId: null,
          organizationName: '본사',
          level: 0,
          scope: 'division',
        },
        {
          id: 'dept-hr-team',
          name: '인사팀',
          parentDepartmentId: 'dept-hq',
          organizationName: '본사',
          level: 1,
          scope: 'team',
        },
      ],
      parentGoalOptions: [
        {
          id: 'parent-division',
          title: '인재 확보 고도화',
          departmentId: 'dept-hq',
          departmentName: '경영지원본부',
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
        kpiName: '우수 인재 확보',
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
    assert.equal(moved.departmentName, '인사팀')
    assert.equal(moved.scope, 'team')
    assert.equal(moved.parentOrgKpiId, 'parent-division')
    assert.equal(moved.parentOrgKpiTitle, '인재 확보 고도화')
    assert.equal(moved.parentReference?.scope, 'division')
    assert.equal(moved.title, '우수 인재 확보')
    assert.equal(moved.category, '인사')
    assert.equal(moved.targetValue, 12)
    assert.equal(moved.targetValueT, 10)
    assert.equal(moved.targetValueE, 12)
    assert.equal(moved.targetValueS, 14)
  })

  await run('org KPI client keeps URL state synchronized with scope and selected KPI', () => {
    const source = read('src/components/kpi/OrgKpiManagementClient.tsx')

    assert.equal(source.includes('buildOrgKpiServerListSignature(pageData.list)'), true)
    assert.equal(source.includes('applySavedOrgKpiToList'), true)
    assert.equal(source.includes("['scope', overrides?.scope ?? pageData.selectedScope]"), true)
    assert.equal(source.includes("['dept', overrides?.dept"), true)
    assert.equal(source.includes("['kpiId', overrides?.kpiId"), true)
    assert.equal(source.includes('window.history.replaceState'), true)
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
