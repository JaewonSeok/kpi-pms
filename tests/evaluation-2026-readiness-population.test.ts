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
    definition: '본인 담당 고객군 매출 성장을 책임지고 실행합니다.',
    formula: '실적 / 목표 x 100',
    policyCategory: 'ORG_GOAL',
    status: 'CONFIRMED',
    weight: 50,
    targetValueT: 90,
    linkedOrgKpiId: 'org-1',
    linkedOrgKpi: null,
  },
  {
    id: 'kpi-2',
    employeeId: 'emp-with-kpi',
    kpiName: '정책 미분류 프로젝트',
    definition: '정책 미분류 프로젝트의 실행 산출물을 관리합니다.',
    formula: '완료율',
    policyCategory: null,
    status: 'CONFIRMED',
    weight: 50,
    targetValueT: 80,
    linkedOrgKpiId: null,
    linkedOrgKpi: null,
  },
  {
    id: 'kpi-3',
    employeeId: 'emp-existing-eval',
    kpiName: '기존 평가 보존 KPI',
    definition: '기존 평가 항목과 연결된 KPI를 보존합니다.',
    formula: '완료율',
    policyCategory: 'PROJECT_T',
    status: 'CONFIRMED',
    weight: 100,
    targetValueT: 100,
    linkedOrgKpiId: null,
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

const teamOrgKpis = [
  {
    id: 'team-kpi-approved',
    deptId: 'team-sales',
    evalYear: 2026,
    kpiName: '세일즈 핵심 매출 KPI',
    status: 'CONFIRMED',
    parentOrgKpiId: 'division-kpi-sales',
    mboExceptionApproved: false,
    mboExceptionReason: null,
    mboExceptionApprovedById: null,
    mboExceptionApprovedAt: null,
    department: { id: 'team-sales', deptName: '세일즈팀', parentDeptId: 'division-sales' },
    parentOrgKpi: {
      id: 'division-kpi-sales',
      kpiName: '국내영업총괄 매출 성장',
      department: { deptName: '국내영업총괄본부' },
    },
    teamKpiReviewItems: [
      {
        id: 'review-approved',
        verdict: 'ADEQUATE',
        rationale: '본부 KPI에 직접 연결된 핵심 과제입니다.',
        linkageComment: '본부 KPI 직접 포함',
        duplicationComment: null,
        recommendationText: '조직목표 반영 가능',
        improvementSuggestions: null,
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
        run: {
          id: 'run-approved',
          reviewType: 'FULL_SET',
          overallVerdict: 'ADEQUATE',
          overallSummary: '반영 가능',
          createdAt: new Date('2026-03-01T00:00:00.000Z'),
        },
      },
    ],
  },
  {
    id: 'team-kpi-excluded',
    deptId: 'team-support',
    evalYear: 2026,
    kpiName: '인사 운영 유지 KPI',
    status: 'CONFIRMED',
    parentOrgKpiId: null,
    mboExceptionApproved: false,
    mboExceptionReason: null,
    mboExceptionApprovedById: null,
    mboExceptionApprovedAt: null,
    department: { id: 'team-support', deptName: '인사팀', parentDeptId: 'division-support' },
    parentOrgKpi: null,
    teamKpiReviewItems: [
      {
        id: 'review-excluded',
        verdict: 'INSUFFICIENT',
        rationale: '단순 운영 업무로 조직목표 반영 대상이 아닙니다.',
        linkageComment: null,
        duplicationComment: null,
        recommendationText: '일상업무 처리',
        improvementSuggestions: '개인 MBO에서는 DAILY_WORK로 검토하세요.',
        createdAt: new Date('2026-03-02T00:00:00.000Z'),
        run: {
          id: 'run-excluded',
          reviewType: 'FULL_SET',
          overallVerdict: 'INSUFFICIENT',
          overallSummary: '제외',
          createdAt: new Date('2026-03-02T00:00:00.000Z'),
        },
      },
    ],
  },
  {
    id: 'team-kpi-exception',
    deptId: 'team-support',
    evalYear: 2026,
    kpiName: '인사 제도 전환 프로젝트',
    status: 'CONFIRMED',
    parentOrgKpiId: null,
    mboExceptionApproved: true,
    mboExceptionReason: '본부 KPI에는 없지만 2026 핵심 전략 프로젝트로 HR 협의 완료',
    mboExceptionApprovedById: 'admin-1',
    mboExceptionApprovedAt: new Date('2026-03-03T00:00:00.000Z'),
    department: { id: 'team-support', deptName: '인사팀', parentDeptId: 'division-support' },
    parentOrgKpi: null,
    teamKpiReviewItems: [],
  },
  {
    id: 'team-kpi-pending',
    deptId: 'team-support',
    evalYear: 2026,
    kpiName: '인사 데이터 정비 KPI',
    status: 'CONFIRMED',
    parentOrgKpiId: null,
    mboExceptionApproved: false,
    mboExceptionReason: null,
    mboExceptionApprovedById: null,
    mboExceptionApprovedAt: null,
    department: { id: 'team-support', deptName: '인사팀', parentDeptId: 'division-support' },
    parentOrgKpi: null,
    teamKpiReviewItems: [],
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
  orgKpis?: Array<Record<string, unknown>>
} = {}) {
  const counts = {
    evalCycleFindUnique: 0,
    employeeFindMany: 0,
    personalKpiFindMany: 0,
    evaluationFindMany: 0,
    departmentFindMany: 0,
    orgKpiFindMany: 0,
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
    orgKpi: {
      findMany: async () => {
        counts.orgKpiFindMany += 1
        return overrides.orgKpis ?? teamOrgKpis
      },
    },
    auditLog: {
      findMany: async () => [],
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

function makeTeamKpiDecisionDb(overrides: {
  orgKpi?: Record<string, unknown> | null
  cycle?: Record<string, unknown> | null
} = {}) {
  const counts = {
    reviewRunCreate: 0,
    orgKpiUpdate: 0,
    audit: 0,
  }
  let orgKpi = overrides.orgKpi === null
    ? null
    : {
        id: 'team-kpi-pending',
        deptId: 'team-sales',
        evalYear: 2026,
        kpiName: '신규 고객 확보',
        status: 'CONFIRMED',
        parentOrgKpiId: null,
        mboExceptionApproved: false,
        mboExceptionReason: null,
        mboExceptionApprovedById: null,
        mboExceptionApprovedAt: null,
        department: {
          id: 'team-sales',
          orgId: 'org-1',
          deptName: '세일즈팀',
          parentDeptId: 'division-sales',
        },
        ...overrides.orgKpi,
      }
  const cycle = overrides.cycle === null
    ? null
    : {
        id: 'cycle-2026',
        orgId: 'org-1',
        evalYear: 2026,
        ...overrides.cycle,
      }
  const createdRuns: Array<Record<string, unknown>> = []
  const db = {
    department: {
      findMany: async () => departments,
    },
    evalCycle: {
      findUnique: async () => cycle,
    },
    orgKpi: {
      findUnique: async () => orgKpi,
      update: async ({ data }: { data: Record<string, unknown> }) => {
        counts.orgKpiUpdate += 1
        if (!orgKpi) throw new Error('missing orgKpi')
        orgKpi = {
          ...orgKpi,
          ...data,
        }
        return {
          id: orgKpi.id,
          mboExceptionApproved: orgKpi.mboExceptionApproved,
          mboExceptionReason: orgKpi.mboExceptionReason,
          mboExceptionApprovedById: orgKpi.mboExceptionApprovedById,
          mboExceptionApprovedAt: orgKpi.mboExceptionApprovedAt,
        }
      },
    },
    teamKpiReviewRun: {
      create: async ({ data }: { data: Record<string, any> }) => {
        counts.reviewRunCreate += 1
        const item = {
          id: `review-item-${counts.reviewRunCreate}`,
          ...data.items.create,
          createdAt: new Date('2026-05-20T01:02:03.000Z'),
          run: {
            id: `review-run-${counts.reviewRunCreate}`,
            requesterId: data.requesterId,
            reviewType: data.reviewType,
            overallVerdict: data.overallVerdict,
            overallSummary: data.overallSummary,
            aiRequestLogId: data.aiRequestLogId,
            createdAt: new Date('2026-05-20T01:02:03.000Z'),
          },
        }
        const runRecord = {
          id: `review-run-${counts.reviewRunCreate}`,
          ...data,
          items: [item],
        }
        createdRuns.push(runRecord)
        return runRecord
      },
    },
  }
  const audit = async () => {
    counts.audit += 1
  }

  return { db: db as unknown, counts, audit, createdRuns, getOrgKpi: () => orgKpi }
}

async function main() {
  const {
    getEvaluation2026ReadinessPopulationDryRun,
    getEvaluation2026ReadinessPopulationDryRunForSession,
  } = await import('../src/server/evaluation-2026-readiness-population')
  const {
    Evaluation2026TeamKpiHrReviewDecisionSchema,
    saveEvaluation2026TeamKpiHrReviewDecisionForSession,
  } = await import('../src/server/evaluation-2026-team-kpi-review-decision')

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
    assert.equal(dryRun.mboSetupCoverage.monitoring.missingMboEmployees.length, 1)
    assert.equal(dryRun.mboSetupCoverage.monitoring.missingMboEmployees[0]?.actionLabel, '작성 요청 필요')
    assert.equal(dryRun.mboSetupCoverage.monitoring.employeeRows.length, 3)
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

  await run('team KPI HR review coverage derives ORG_GOAL and DAILY_WORK suggestions without writes', async () => {
    const fake = makeDb()

    const dryRun = await getEvaluation2026ReadinessPopulationDryRun({
      db: fake.db as never,
      evalCycleId: 'cycle-2026',
      env: {} as NodeJS.ProcessEnv,
    })

    assert.equal(dryRun.teamKpiHrReviewCoverage.totalCandidates, 4)
    assert.equal(dryRun.teamKpiHrReviewCoverage.approvedForOrgGoalCount, 1)
    assert.equal(dryRun.teamKpiHrReviewCoverage.excludedDailyWorkCount, 1)
    assert.equal(dryRun.teamKpiHrReviewCoverage.exceptionApprovedCount, 1)
    assert.equal(dryRun.teamKpiHrReviewCoverage.pendingReviewCount, 1)

    const approved = dryRun.teamKpiHrReviewCoverage.candidates.find((candidate) => candidate.orgKpiId === 'team-kpi-approved')
    const excluded = dryRun.teamKpiHrReviewCoverage.candidates.find((candidate) => candidate.orgKpiId === 'team-kpi-excluded')
    const exception = dryRun.teamKpiHrReviewCoverage.candidates.find((candidate) => candidate.orgKpiId === 'team-kpi-exception')
    const pending = dryRun.teamKpiHrReviewCoverage.candidates.find((candidate) => candidate.orgKpiId === 'team-kpi-pending')

    assert.equal(approved?.reviewStatus, 'APPROVED_FOR_ORG_GOAL')
    assert.equal(approved?.suggestedMboCategory, 'ORG_GOAL')
    assert.equal(approved?.canSuggestAsOrgGoal, true)
    assert.equal(approved?.reason, '본부 KPI 직접 포함')
    assert.equal(approved?.linkedDivisionKpiName, '국내영업총괄 매출 성장')

    assert.equal(excluded?.reviewStatus, 'EXCLUDED_DAILY_WORK')
    assert.equal(excluded?.suggestedMboCategory, 'DAILY_WORK')
    assert.equal(excluded?.canSuggestAsOrgGoal, false)
    assert.equal(excluded?.reason, '단순 운영/유지 업무')

    assert.equal(exception?.reviewStatus, 'EXCEPTION_APPROVED')
    assert.equal(exception?.suggestedMboCategory, 'ORG_GOAL')
    assert.equal(exception?.canSuggestAsOrgGoal, true)

    assert.equal(pending?.reviewStatus, 'PENDING_REVIEW')
    assert.equal(pending?.suggestedMboCategory, 'DAILY_WORK')
    assert.equal(pending?.canSuggestAsOrgGoal, false)
    assert.equal(dryRun.teamKpiHrReviewCoverage.personalKpiOrgGoalWithoutApprovedSourceCount, 1)
    assert.equal(fake.counts.orgKpiFindMany, 1)
    assert.equal(fake.counts.writes, 0)
  })

  await run('admin can save APPROVED_FOR_ORG_GOAL team KPI HR decision without touching scores', async () => {
    const fake = makeTeamKpiDecisionDb()

    const result = await saveEvaluation2026TeamKpiHrReviewDecisionForSession(
      {
        session: makeSession('ROLE_ADMIN'),
        input: {
          orgKpiId: 'team-kpi-pending',
          evalCycleId: 'cycle-2026',
          decision: 'APPROVED_FOR_ORG_GOAL',
          reason: '핵심 과제',
          note: 'HR 검토 완료',
        },
      },
      {
        db: fake.db as never,
        audit: fake.audit as never,
        now: new Date('2026-05-20T01:02:03.000Z'),
      }
    )

    assert.equal(result.verdict, 'ADEQUATE')
    assert.equal(result.hrException.approved, false)
    assert.equal(result.safety.totalScoreChanged, false)
    assert.equal(result.safety.gradeIdChanged, false)
    assert.equal(result.safety.evaluationsCreated, 0)
    assert.equal(result.safety.evaluationItemsCreated, 0)
    assert.equal(fake.counts.reviewRunCreate, 1)
    assert.equal(fake.counts.orgKpiUpdate, 1)
    assert.equal(fake.counts.audit, 1)
  })

  await run('admin can save EXCLUDED_DAILY_WORK team KPI HR decision', async () => {
    const fake = makeTeamKpiDecisionDb()

    const result = await saveEvaluation2026TeamKpiHrReviewDecisionForSession(
      {
        session: makeSession('ROLE_ADMIN'),
        input: {
          orgKpiId: 'team-kpi-pending',
          evalCycleId: 'cycle-2026',
          decision: 'EXCLUDED_DAILY_WORK',
          reason: '단순 운영/유지 업무',
          note: '조직목표 반영 제외',
        },
      },
      {
        db: fake.db as never,
        audit: fake.audit as never,
      }
    )

    assert.equal(result.verdict, 'INSUFFICIENT')
    assert.equal(result.hrException.approved, false)
    assert.equal(fake.counts.reviewRunCreate, 1)
    assert.equal(fake.counts.audit, 1)
  })

  await run('admin can save EXCEPTION_APPROVED with reason metadata', async () => {
    const fake = makeTeamKpiDecisionDb()

    const result = await saveEvaluation2026TeamKpiHrReviewDecisionForSession(
      {
        session: makeSession('ROLE_ADMIN'),
        input: {
          orgKpiId: 'team-kpi-pending',
          evalCycleId: 'cycle-2026',
          decision: 'EXCEPTION_APPROVED',
          reason: '매출/수익/고객 확보 직접 연계',
          note: '본부 KPI에는 없지만 예외 승인',
        },
      },
      {
        db: fake.db as never,
        audit: fake.audit as never,
        now: new Date('2026-05-20T01:02:03.000Z'),
      }
    )

    assert.equal(result.verdict, 'ADEQUATE')
    assert.equal(result.hrException.approved, true)
    assert.equal(result.hrException.reason, '매출/수익/고객 확보 직접 연계')
    assert.equal(result.hrException.approvedById, 'admin-1')
    assert.equal(result.hrException.approvedAt, '2026-05-20T01:02:03.000Z')
  })

  await run('member cannot save team KPI HR decision', async () => {
    const fake = makeTeamKpiDecisionDb()

    await assert.rejects(
      () =>
        saveEvaluation2026TeamKpiHrReviewDecisionForSession(
          {
            session: makeSession('ROLE_MEMBER', 'member-1'),
            input: {
              orgKpiId: 'team-kpi-pending',
              evalCycleId: 'cycle-2026',
              decision: 'APPROVED_FOR_ORG_GOAL',
              reason: '핵심 과제',
              note: '권한 없음',
            },
          },
          {
            db: fake.db as never,
            audit: fake.audit as never,
          }
        ),
      (error) => error instanceof AppError && error.statusCode === 403
    )
    assert.equal(fake.counts.reviewRunCreate, 0)
    assert.equal(fake.counts.orgKpiUpdate, 0)
  })

  await run('invalid or missing team KPI HR decision fields fail validation', () => {
    assert.equal(
      Evaluation2026TeamKpiHrReviewDecisionSchema.safeParse({
        orgKpiId: 'team-kpi-pending',
        decision: 'INVALID_DECISION',
        reason: '핵심 과제',
      }).success,
      false
    )
    assert.equal(
      Evaluation2026TeamKpiHrReviewDecisionSchema.safeParse({
        orgKpiId: 'team-kpi-pending',
        decision: 'APPROVED_FOR_ORG_GOAL',
      }).success,
      false
    )
  })

  await run('saved team KPI HR decisions are reflected in readiness suggestions', async () => {
    const fake = makeTeamKpiDecisionDb()
    const result = await saveEvaluation2026TeamKpiHrReviewDecisionForSession(
      {
        session: makeSession('ROLE_ADMIN'),
        input: {
          orgKpiId: 'team-kpi-pending',
          evalCycleId: 'cycle-2026',
          decision: 'APPROVED_FOR_ORG_GOAL',
          reason: '핵심 과제',
          note: '조직목표 후보 승인',
        },
      },
      {
        db: fake.db as never,
        audit: fake.audit as never,
      }
    )
    const savedItem = (fake.createdRuns[0]?.items as Array<Record<string, unknown>> | undefined)?.[0]
    const dryRunDb = makeDb({
      orgKpis: [
        {
          ...teamOrgKpis.find((item) => item.id === 'team-kpi-pending'),
          teamKpiReviewItems: [
            {
              ...savedItem,
              id: result.teamKpiReviewItemId,
              verdict: 'ADEQUATE',
              rationale: '핵심 과제',
              recommendationText: '조직목표 후보 승인',
              run: {
                requesterId: 'admin-1',
                createdAt: new Date('2026-05-20T01:02:03.000Z'),
              },
            },
          ],
        },
      ],
    })

    const dryRun = await getEvaluation2026ReadinessPopulationDryRun({
      db: dryRunDb.db as never,
      evalCycleId: 'cycle-2026',
      env: {} as NodeJS.ProcessEnv,
    })

    assert.equal(dryRun.teamKpiHrReviewCoverage.candidates[0]?.reviewStatus, 'APPROVED_FOR_ORG_GOAL')
    assert.equal(dryRun.teamKpiHrReviewCoverage.candidates[0]?.suggestedMboCategory, 'ORG_GOAL')
    assert.equal(dryRun.teamKpiHrReviewCoverage.candidates[0]?.reason, '핵심 과제')

    const excludedDryRunDb = makeDb({
      orgKpis: [
        {
          ...teamOrgKpis.find((item) => item.id === 'team-kpi-pending'),
          teamKpiReviewItems: [
            {
              id: 'manual-excluded',
              verdict: 'INSUFFICIENT',
              rationale: '단순 운영/유지 업무',
              recommendationText: '일상업무 처리',
              createdAt: new Date('2026-05-20T01:02:03.000Z'),
              run: {
                requesterId: 'admin-1',
                createdAt: new Date('2026-05-20T01:02:03.000Z'),
              },
            },
          ],
        },
      ],
    })
    const excludedDryRun = await getEvaluation2026ReadinessPopulationDryRun({
      db: excludedDryRunDb.db as never,
      evalCycleId: 'cycle-2026',
      env: {} as NodeJS.ProcessEnv,
    })
    assert.equal(excludedDryRun.teamKpiHrReviewCoverage.candidates[0]?.reviewStatus, 'EXCLUDED_DAILY_WORK')
    assert.equal(excludedDryRun.teamKpiHrReviewCoverage.candidates[0]?.suggestedMboCategory, 'DAILY_WORK')
    assert.equal(excludedDryRun.teamKpiHrReviewCoverage.candidates[0]?.canSuggestAsOrgGoal, false)
  })

  await run('MBO setup coverage reports draft/submitted/confirmed/missing and category distribution without writes', async () => {
    const fake = makeDb({
      personalKpis: [
        ...confirmedPersonalKpis,
        {
          id: 'kpi-draft',
          employeeId: 'emp-missing-kpi',
          kpiName: '초안 KPI',
          definition: '',
          formula: '',
          policyCategory: 'DAILY_WORK',
          status: 'DRAFT',
          weight: 0,
          targetValueT: null,
          linkedOrgKpiId: null,
          linkedOrgKpi: null,
        },
        {
          id: 'kpi-submitted',
          employeeId: 'emp-missing-kpi',
          kpiName: '제출 KPI',
          definition: '제출된 KPI입니다.',
          formula: '완료율',
          policyCategory: 'PROJECT_K',
          status: 'DRAFT',
          weight: 20,
          targetValueT: 70,
          linkedOrgKpiId: null,
          linkedOrgKpi: null,
        },
      ],
    })
    const fakeDb = fake.db as {
      auditLog: {
        findMany: () => Promise<Array<{ action: string; entityId: string; timestamp: Date }>>
      }
    }
    fakeDb.auditLog.findMany = async () => [
      {
        action: 'PERSONAL_KPI_SUBMITTED',
        entityId: 'kpi-submitted',
        timestamp: new Date('2026-04-01T00:00:00.000Z'),
      },
    ]

    const dryRun = await getEvaluation2026ReadinessPopulationDryRun({
      db: fake.db as never,
      evalCycleId: 'cycle-2026',
      env: {} as NodeJS.ProcessEnv,
    })

    assert.equal(dryRun.mboSetupCoverage.employeesWithDraftPersonalKpiCount, 1)
    assert.equal(dryRun.mboSetupCoverage.employeesWithSubmittedPersonalKpiCount, 1)
    assert.equal(dryRun.mboSetupCoverage.employeesWithConfirmedPersonalKpiCount, 2)
    assert.equal(dryRun.mboSetupCoverage.employeesMissingAnyPersonalKpiCount, 0)
    assert.equal(dryRun.mboSetupCoverage.categoryDistribution.ORG_GOAL, 1)
    assert.equal(dryRun.mboSetupCoverage.categoryDistribution.PROJECT_T, 1)
    assert.equal(dryRun.mboSetupCoverage.categoryDistribution.PROJECT_K, 1)
    assert.equal(dryRun.mboSetupCoverage.categoryDistribution.DAILY_WORK, 1)
    assert.equal(dryRun.mboSetupCoverage.categoryDistribution.UNMAPPED, 1)
    assert.equal(dryRun.mboSetupCoverage.warningCounts.missingWeight, 1)
    assert.equal(dryRun.mboSetupCoverage.monitoring.submittedReviewingMboEmployees.length, 1)
    assert.equal(dryRun.mboSetupCoverage.monitoring.submittedReviewingMboEmployees[0]?.employeeName, 'KPI 누락자')
    assert.equal(dryRun.mboSetupCoverage.monitoring.submittedReviewingMboEmployees[0]?.actionLabel, '리더 검토 필요')
    assert.equal(dryRun.mboSetupCoverage.monitoring.confirmedMboEmployees.length, 2)
    assert.equal(dryRun.mboSetupCoverage.monitoring.policyCategoryMissingItems.length, 1)
    assert.equal(dryRun.mboSetupCoverage.monitoring.policyCategoryMissingItems[0]?.personalKpiName, '정책 미분류 프로젝트')
    assert.equal(dryRun.mboSetupCoverage.monitoring.policyCategoryMissingItems[0]?.actionLabel, '카테고리 확정 필요')
    assert.equal(fake.counts.writes, 0)
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
    const reviewDecisionRouteSource = read('src/app/api/evaluation/preview-2026/team-kpi-review-decision/route.ts')
    const clientSource = read('src/components/evaluation/EvaluationWorkbenchClient.tsx')
    const serverSource = read('src/server/evaluation-2026-readiness-population.ts')
    const decisionServerSource = read('src/server/evaluation-2026-team-kpi-review-decision.ts')
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
    assert.equal(clientSource.includes('2026 MBO setup coverage'), true)
    assert.equal(clientSource.includes('직원들이 2026 Personal KPI를 작성·제출·확정하는 준비 현황입니다.'), true)
    assert.equal(clientSource.includes('HR MBO setup monitoring'), true)
    assert.equal(serverSource.includes('작성 요청 필요'), true)
    assert.equal(serverSource.includes('제출 요청 필요'), true)
    assert.equal(serverSource.includes('리더 검토 필요'), true)
    assert.equal(serverSource.includes('카테고리 확정 필요'), true)
    assert.equal(clientSource.includes('policyCategory missing items'), true)
    assert.equal(clientSource.includes('navigator.clipboard.writeText'), true)
    assert.equal(clientSource.includes('2026 팀 KPI 검토'), true)
    assert.equal(clientSource.includes('본부 KPI에 포함되거나 HR이 승인한 팀 KPI만 개인 MBO의 조직목표 후보가 됩니다.'), true)
    assert.equal(clientSource.includes('팀 KPI 검토 복사'), true)
    assert.equal(clientSource.includes('/api/evaluation/preview-2026/team-kpi-review-decision'), true)
    assert.equal(clientSource.includes('HR 결정 저장'), true)
    assert.equal(serverSource.includes('APPROVED_FOR_ORG_GOAL'), true)
    assert.equal(serverSource.includes('EXCLUDED_DAILY_WORK'), true)
    assert.equal(serverSource.includes('EXCEPTION_APPROVED'), true)
    assert.equal(serverSource.includes('PENDING_REVIEW'), true)
    assert.equal(serverSource.includes('personalKpiOrgGoalWithoutApprovedSourceCount'), true)
    assert.equal(reviewDecisionRouteSource.includes('export async function PATCH'), true)
    assert.equal(reviewDecisionRouteSource.includes('getServerSession(authOptions)'), true)
    assert.equal(reviewDecisionRouteSource.includes('saveEvaluation2026TeamKpiHrReviewDecisionForSession'), true)
    assert.equal(decisionServerSource.includes('teamKpiReviewRun.create'), true)
    assert.equal(decisionServerSource.includes('officialScoresChanged: false'), true)
    assert.equal(decisionServerSource.includes('evaluationsCreated: 0'), true)
    assert.equal(decisionServerSource.includes('evaluationItemsCreated: 0'), true)
    assert.equal(clientSource.includes("limit: '300'"), true)
    assert.equal(clientSource.includes('/api/evaluation/preview-2026/readiness-population'), true)
    assert.equal(liveRouteSource.includes('readiness-population'), false)
    assert.equal(liveRouteSource.includes('team-kpi-review-decision'), false)
    assert.equal(submitRouteSource.includes('readiness-population'), false)
    assert.equal(submitRouteSource.includes('team-kpi-review-decision'), false)
  })

  console.log('2026 readiness population dry-run tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
