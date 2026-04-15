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

function makeKpi(overrides?: Partial<OrgKpiViewModel>): OrgKpiViewModel {
  return {
    id: 'org-kpi-1',
    title: '원가 절감',
    tags: [],
    evalYear: 2026,
    departmentId: 'dept-hq',
    departmentName: '경영지원본부',
    departmentCode: 'HQ',
    parentOrgKpiId: null,
    parentOrgKpiTitle: null,
    parentOrgDepartmentName: null,
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
        departmentId: 'dept-hr',
        departmentName: '인사팀',
      }),
    ])

    assert.notEqual(before, after)
  })

  await run('saved org KPI is reclassified into the new department immediately after save', () => {
    const currentItems = [
      makeKpi(),
      makeKpi({
        id: 'org-kpi-2',
        title: '채용 브랜딩 강화',
        departmentId: 'dept-hr',
        departmentName: '인사팀',
      }),
    ]

    const updated = applySavedOrgKpiToList({
      currentItems,
      savedId: 'org-kpi-1',
      departments: [
        { id: 'dept-hq', name: '경영지원본부', parentDepartmentId: null, organizationName: '본사', level: 0 },
        { id: 'dept-hr', name: '인사팀', parentDepartmentId: 'dept-hq', organizationName: '본사', level: 1 },
      ],
      parentGoalOptions: [
        {
          id: 'parent-hr',
          title: '인사 전략 고도화',
          departmentId: 'dept-hr',
          departmentName: '인사팀',
          evalYear: 2026,
        },
      ],
      form: {
        deptId: 'dept-hr',
        evalYear: '2026',
        parentOrgKpiId: 'parent-hr',
        kpiType: 'QUALITATIVE',
        kpiCategory: '인사',
        kpiName: '핵심 인재 확보',
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
    assert.equal(moved.departmentId, 'dept-hr')
    assert.equal(moved.departmentName, '인사팀')
    assert.equal(moved.parentOrgKpiId, 'parent-hr')
    assert.equal(moved.parentOrgKpiTitle, '인사 전략 고도화')
    assert.equal(moved.title, '핵심 인재 확보')
    assert.equal(moved.category, '인사')

    assert.equal(moved.targetValue, 12)
    assert.equal(moved.targetValueT, 10)
    assert.equal(moved.targetValueE, 12)
    assert.equal(moved.targetValueS, 14)

    const oldDepartmentCount = updated.filter((item) => item.departmentId === 'dept-hq').length
    const newDepartmentCount = updated.filter((item) => item.departmentId === 'dept-hr').length
    assert.equal(oldDepartmentCount, 0)
    assert.equal(newDepartmentCount, 2)
  })

  await run('org KPI client keeps server sync tied to department-sensitive signatures and refresh URL state', () => {
    const source = read('src/components/kpi/OrgKpiManagementClient.tsx')

    assert.equal(source.includes('buildOrgKpiServerListSignature(pageData.list)'), true)
    assert.equal(source.includes('applySavedOrgKpiToList'), true)
    assert.equal(source.includes("nextParams.set('dept', saved.deptId)"), true)
    assert.equal(source.includes("nextParams.set('kpiId', saved.id)"), true)
    assert.equal(source.includes('router.replace(`/kpi/org'), true)
  })

  await run('org KPI update route still persists deptId changes in the database', () => {
    const routeSource = read('src/app/api/kpi/org/[id]/route.ts')

    assert.equal(routeSource.includes('const targetDeptId = data.deptId ?? current.deptId'), true)
    assert.equal(routeSource.includes("...(data.deptId !== undefined ? { deptId: data.deptId } : {})"), true)
  })
}

void main()
