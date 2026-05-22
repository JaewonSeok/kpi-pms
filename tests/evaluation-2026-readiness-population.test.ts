import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import Module from 'node:module'
import path from 'node:path'
import type { Session } from 'next-auth'
import { AppError } from '../src/lib/utils'

process.env.DATABASE_URL ||= 'postgresql://postgres:password@localhost:5432/kpi_pms'

type ResolveFilename = (
  request: string,
  parent: NodeModule | null | undefined,
  isMain: boolean,
  options?: unknown
) => string

const moduleLoader = Module as typeof Module & {
  _resolveFilename: ResolveFilename
}
const previousResolveFilename = moduleLoader._resolveFilename
moduleLoader._resolveFilename = function resolveFilename(request, parent, isMain, options) {
  const parentFilename = (parent as { filename?: string } | null | undefined)?.filename ?? ''
  const isPrismaRequest =
    request === '@/lib/prisma' ||
    ((request === './prisma' || request === '../prisma') &&
      parentFilename.includes(`${path.sep}src${path.sep}`))

  if (isPrismaRequest) {
    return path.resolve(process.cwd(), 'tests/stubs/prisma.js')
  }

  if (request.startsWith('@/')) {
    return previousResolveFilename.call(
      this,
      path.resolve(process.cwd(), 'src', request.slice(2)),
      parent,
      isMain,
      options
    )
  }

  return previousResolveFilename.call(this, request, parent, isMain, options)
}

async function run(name: string, fn: () => Promise<void> | void) {
  try {
    await fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

function read(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')
}

function makeSession(role = 'ROLE_ADMIN', id = 'admin-1'): Session {
  return {
    user: {
      id,
      name: role === 'ROLE_ADMIN' ? 'HR Admin' : 'Member User',
      role,
    },
  } as unknown as Session
}

const departments = [
  { id: 'division-sales', deptName: '국내영업총괄본부', parentDeptId: null },
  { id: 'team-sales', deptName: '세일즈팀', parentDeptId: 'division-sales' },
  { id: 'division-support', deptName: '경영지원본부', parentDeptId: null },
  { id: 'team-support', deptName: '인사팀', parentDeptId: 'division-support' },
]

const employees = [
  {
    id: 'emp-with-kpi',
    empId: 'E001',
    empName: 'KPI 보유자',
    deptId: 'team-sales',
    role: 'ROLE_MEMBER',
    position: 'MEMBER',
    department: { id: 'team-sales', deptName: '세일즈팀', parentDeptId: 'division-sales' },
  },
  {
    id: 'emp-missing-kpi',
    empId: 'E002',
    empName: 'KPI 누락자',
    deptId: 'team-support',
    role: 'ROLE_MEMBER',
    position: 'MEMBER',
    department: { id: 'team-support', deptName: '인사팀', parentDeptId: 'division-support' },
  },
  {
    id: 'emp-existing-eval',
    empId: 'E003',
    empName: '기존 평가자',
    deptId: 'team-sales',
    role: 'ROLE_MEMBER',
    position: 'MEMBER',
    department: { id: 'team-sales', deptName: '세일즈팀', parentDeptId: 'division-sales' },
  },
]

const confirmedPersonalKpis = [
  {
    id: 'kpi-1',
    employeeId: 'emp-with-kpi',
    kpiName: '매출 성장',
    policyCategory: 'ORG_GOAL',
    weight: 50,
    linkedOrgKpi: null,
  },
  {
    id: 'kpi-2',
    employeeId: 'emp-with-kpi',
    kpiName: '정책 미분류 프로젝트',
    policyCategory: null,
    weight: 50,
    linkedOrgKpi: null,
  },
  {
    id: 'kpi-3',
    employeeId: 'emp-existing-eval',
    kpiName: '기존 평가 보존 KPI',
    policyCategory: 'PROJECT_T',
    weight: 100,
    linkedOrgKpi: null,
  },
]

const existingSelfEvaluations = [
  {
    id: 'eval-existing-self',
    targetId: 'emp-existing-eval',
    evalStage: 'SELF',
    items: [
      {
        id: 'item-existing',
        personalKpiId: 'kpi-3',
        policyCategory: 'PROJECT_T',
        personalKpi: {
          id: 'kpi-3',
          kpiName: '기존 평가 보존 KPI',
          policyCategory: 'PROJECT_T',
        },
      },
    ],
  },
]

function makeCycle(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cycle-2026',
    orgId: 'org-1',
    cycleName: '2026 공식 평가',
    evalYear: 2026,
    status: 'SELF_EVAL',
    performanceDesignConfig: {
      policy2026OfficialReadinessEnabled: true,
      policy2026PreviewMappings: {
        salesGroupsByDivisionId: {
          'division-sales': { salesGroup: 'SALES' },
        },
        salesGroupsByDepartmentId: {
          'team-sales': { salesGroup: 'NON_SALES' },
        },
        salesGroupsByEmployeeId: {},
      },
    },
    ...overrides,
  }
}

function makeDb(overrides: {
  cycle?: Record<string, unknown> | null
  personalKpis?: Array<Record<string, unknown>>
  evaluations?: Array<Record<string, unknown>>
  employees?: Array<Record<string, unknown>>
  departments?: Array<Record<string, unknown>>
} = {}) {
  const counts = {
    evalCycleFindUnique: 0,
    employeeFindMany: 0,
    personalKpiFindMany: 0,
    evaluationFindMany: 0,
    departmentFindMany: 0,
    writes: 0,
  }
  const cycle = overrides.cycle === null ? null : makeCycle(overrides.cycle)
  const db = {
    evalCycle: {
      findUnique: async () => {
        counts.evalCycleFindUnique += 1
        return cycle
      },
      update: async () => {
        counts.writes += 1
        throw new Error('dry-run must not update evalCycle')
      },
    },
    employee: {
      findMany: async () => {
        counts.employeeFindMany += 1
        return overrides.employees ?? employees
      },
      update: async () => {
        counts.writes += 1
        throw new Error('dry-run must not update employee')
      },
    },
    personalKpi: {
      findMany: async () => {
        counts.personalKpiFindMany += 1
        return overrides.personalKpis ?? confirmedPersonalKpis
      },
      create: async () => {
        counts.writes += 1
        throw new Error('dry-run must not create personal KPI')
      },
    },
    evaluation: {
      findMany: async () => {
        counts.evaluationFindMany += 1
        return overrides.evaluations ?? existingSelfEvaluations
      },
      create: async () => {
        counts.writes += 1
        throw new Error('dry-run must not create evaluation')
      },
      update: async () => {
        counts.writes += 1
        throw new Error('dry-run must not update evaluation')
      },
    },
    department: {
      findMany: async () => {
        counts.departmentFindMany += 1
        return overrides.departments ?? departments
      },
    },
    evaluationItem: {
      create: async () => {
        counts.writes += 1
        throw new Error('dry-run must not create evaluation item')
      },
    },
    evaluationAssignment: {
      upsert: async () => {
        counts.writes += 1
        throw new Error('dry-run must not mutate assignments')
      },
    },
  }

  return { db: db as unknown, counts }
}

async function main() {
  const {
    getEvaluation2026ReadinessPopulationDryRun,
    getEvaluation2026ReadinessPopulationDryRunForSession,
  } = await import('../src/server/evaluation-2026-readiness-population')

  await run('population dry-run reports missing confirmed PersonalKpi and performs no writes', async () => {
    const fake = makeDb()

    const dryRun = await getEvaluation2026ReadinessPopulationDryRun({
      db: fake.db as never,
      evalCycleId: 'cycle-2026',
      env: {} as NodeJS.ProcessEnv,
    })

    assert.equal(dryRun.isDryRun, true)
    assert.equal(dryRun.activeEmployeeCount, 3)
    assert.equal(dryRun.employeesWithConfirmedPersonalKpiCount, 2)
    assert.equal(dryRun.employeesMissingConfirmedPersonalKpiCount, 1)
    assert.equal(dryRun.employeesMissingConfirmedPersonalKpi[0]?.employeeName, 'KPI 누락자')
    assert.equal(fake.counts.writes, 0)
    assert.equal(dryRun.safety.writesPerformed, false)
    assert.equal(dryRun.safety.evaluationsCreated, 0)
    assert.equal(dryRun.safety.evaluationItemsCreated, 0)
    assert.equal(dryRun.safety.assignmentsMutated, 0)
  })

  await run('existing SELF evaluations are skipped and would-create item count matches confirmed PersonalKpi', async () => {
    const fake = makeDb()

    const dryRun = await getEvaluation2026ReadinessPopulationDryRun({
      db: fake.db as never,
      evalCycleId: 'cycle-2026',
      env: {} as NodeJS.ProcessEnv,
    })

    assert.equal(dryRun.existingSelfEvaluationCount, 1)
    assert.equal(dryRun.existingSelfEvaluationsSkipped.length, 1)
    assert.equal(dryRun.existingSelfEvaluationsSkipped[0]?.employeeName, '기존 평가자')
    assert.equal(dryRun.wouldCreateSelfEvaluationCount, 1)
    assert.equal(dryRun.wouldCreateSelfEvaluations[0]?.employeeName, 'KPI 보유자')
    assert.equal(dryRun.wouldCreateEvaluationItemCount, 2)
    assert.equal(dryRun.existingEvaluationItemsSkippedCount, 1)
  })

  await run('policyCategory and division mapping blockers are surfaced', async () => {
    const fake = makeDb()

    const dryRun = await getEvaluation2026ReadinessPopulationDryRun({
      db: fake.db as never,
      evalCycleId: 'cycle-2026',
      env: {} as NodeJS.ProcessEnv,
    })

    assert.equal(dryRun.policyCategoryMissingCount, 1)
    assert.equal(
      dryRun.blockers.some((blocker) => blocker.code === 'POLICY_CATEGORY_REQUIRED' && blocker.count === 1),
      true
    )
    assert.equal(dryRun.divisionSalesMappingCoverage.totalDivisions, 2)
    assert.equal(dryRun.divisionSalesMappingCoverage.mappedDivisions, 1)
    assert.equal(dryRun.divisionSalesMappingCoverage.unmappedDivisions, 1)
    assert.equal(
      dryRun.blockers.some((blocker) => blocker.code === 'DIVISION_SALES_GROUP_REQUIRED' && blocker.count === 1),
      true
    )
  })

  await run('department override coverage is reported without counting suggestions as saved mappings', async () => {
    const fake = makeDb()

    const dryRun = await getEvaluation2026ReadinessPopulationDryRun({
      db: fake.db as never,
      evalCycleId: 'cycle-2026',
      env: {} as NodeJS.ProcessEnv,
    })

    assert.equal(dryRun.departmentOverrideCoverage.savedOverrideCount, 1)
    assert.equal(dryRun.departmentOverrideCoverage.affectedActiveEmployeeCount, 2)
    assert.equal(dryRun.departmentOverrideCoverage.overrides[0]?.departmentPath, '국내영업총괄본부 > 세일즈팀')
    assert.equal(dryRun.departmentOverrideCoverage.overrides[0]?.currentSalesGroup, 'NON_SALES')
  })

  await run('official scoring and grade flags remain disabled in dry-run safety output', async () => {
    const fake = makeDb()

    const dryRun = await getEvaluation2026ReadinessPopulationDryRun({
      db: fake.db as never,
      evalCycleId: 'cycle-2026',
      env: {
        EVALUATION_2026_PREVIEW_ENABLED: 'true',
      } as unknown as NodeJS.ProcessEnv,
    })

    assert.equal(dryRun.safety.officialScoringEnabled, false)
    assert.equal(dryRun.safety.officialGradeEnabled, false)
    assert.equal(dryRun.safety.officialAiScoreExclusionEnabled, false)
  })

  await run('ROLE_ADMIN can access population dry-run and ROLE_MEMBER is forbidden', async () => {
    const adminDb = makeDb()
    const adminResult = await getEvaluation2026ReadinessPopulationDryRunForSession(
      {
        session: makeSession('ROLE_ADMIN'),
        evalCycleId: 'cycle-2026',
      },
      {
        db: adminDb.db as never,
        env: {} as NodeJS.ProcessEnv,
      }
    )
    assert.equal(adminResult.activeEmployeeCount, 3)

    const memberDb = makeDb()
    await assert.rejects(
      () =>
        getEvaluation2026ReadinessPopulationDryRunForSession(
          {
            session: makeSession('ROLE_MEMBER', 'member-1'),
            evalCycleId: 'cycle-2026',
          },
          {
            db: memberDb.db as never,
            env: {} as NodeJS.ProcessEnv,
          }
        ),
      (error) => error instanceof AppError && error.statusCode === 403
    )
    assert.equal(memberDb.counts.writes, 0)
  })

  await run('population dry-run API is GET-only, admin-gated, and not wired into live routes', () => {
    const routeSource = read('src/app/api/evaluation/preview-2026/readiness-population/route.ts')
    const clientSource = read('src/components/evaluation/EvaluationWorkbenchClient.tsx')
    const liveRouteSource = read('src/app/api/evaluation/route.ts')
    const submitRouteSource = read('src/app/api/evaluation/[id]/submit/route.ts')

    assert.equal(routeSource.includes('export async function GET'), true)
    assert.equal(routeSource.includes('getServerSession(authOptions)'), true)
    assert.equal(routeSource.includes('getEvaluation2026ReadinessPopulationDryRunForSession'), true)
    assert.equal(routeSource.includes('successResponse(dryRun)'), true)
    assert.equal(routeSource.includes('export async function POST'), false)
    assert.equal(routeSource.includes('export async function PATCH'), false)
    assert.equal(routeSource.includes('prisma.'), false)
    assert.equal(clientSource.includes('2026 readiness population dry-run'), true)
    assert.equal(clientSource.includes('이 기능은 dry-run이며 공식 점수/등급을 변경하지 않습니다.'), true)
    assert.equal(clientSource.includes('/api/evaluation/preview-2026/readiness-population'), true)
    assert.equal(liveRouteSource.includes('readiness-population'), false)
    assert.equal(submitRouteSource.includes('readiness-population'), false)
  })

  console.log('2026 readiness population dry-run tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
