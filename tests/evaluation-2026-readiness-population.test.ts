import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import Module from 'node:module'
import path from 'node:path'
import type { Session } from 'next-auth'
import { EVALUATION_POLICY_2026 } from '../src/lib/evaluation-policy-2026'
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
    gwsEmail: 'kpi.owner@rsupport.com',
    deptId: 'team-sales',
    role: 'ROLE_MEMBER',
    position: 'MEMBER',
    department: { id: 'team-sales', deptName: '세일즈팀', parentDeptId: 'division-sales' },
  },
  {
    id: 'emp-missing-kpi',
    empId: 'E002',
    empName: 'KPI 누락자',
    gwsEmail: 'kpi.missing@rsupport.com',
    deptId: 'team-support',
    role: 'ROLE_MEMBER',
    position: 'MEMBER',
    department: { id: 'team-support', deptName: '인사팀', parentDeptId: 'division-support' },
  },
  {
    id: 'emp-existing-eval',
    empId: 'E003',
    empName: '기존 평가자',
    gwsEmail: 'kpi.existing@rsupport.com',
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

function makeReadyGradePolicyRows() {
  const rows = EVALUATION_POLICY_2026.gradeThresholdGroups.flatMap((group) =>
    EVALUATION_POLICY_2026.grades.map((grade) => {
      const band = group.thresholds[grade.code] as {
        minInclusive?: number
        maxExclusive?: number
        selectionOnly?: boolean
        requiresPolicyConfirmation?: boolean
        note?: string
      } | undefined
      const override =
        group.group === 'TEAM_MEMBER_SALES' && grade.code === 'SUPER'
          ? {
              minScore: null,
              maxScore: null,
              selectionRule: 'NOT_APPLICABLE',
              notes: '팀원 영업 Super 별도 구간 미운영',
            }
          : group.group === 'TEAM_MEMBER_SALES' && grade.code === 'OUTSTANDING'
            ? {
                minScore: 110,
                maxScore: null,
                selectionRule: 'SCORE_THRESHOLD',
                notes: 'Outstanding 110점 이상',
              }
            : null

      return {
        id: `${group.group}-${grade.code}`,
        orgId: 'org-1',
        evalYear: 2026,
        policyVersion: EVALUATION_POLICY_2026.version,
        thresholdGroup: group.group,
        gradeLabel: grade.code,
        displayName: `${group.label} - ${grade.label}`,
        minScore: typeof band?.minInclusive === 'number' ? band.minInclusive : null,
        maxScore: typeof band?.maxExclusive === 'number' ? band.maxExclusive : null,
        lowerBoundInclusive: true,
        upperBoundInclusive: false,
        selectionRule:
          !band
            ? 'NOT_APPLICABLE'
            : band.selectionOnly
              ? 'SELECTION_ONLY'
              : band.requiresPolicyConfirmation
                ? 'HR_CONFIRMATION_REQUIRED'
                : null,
        notes: band?.note ?? null,
        isActive: true,
        ...override,
      }
    })
  )
  return rows
}

function makeDb(overrides: {
  cycle?: Record<string, unknown> | null
  personalKpis?: Array<Record<string, unknown>>
  evaluations?: Array<Record<string, unknown>>
  evaluationAssignments?: Array<Record<string, unknown>>
  employees?: Array<Record<string, unknown>>
  departments?: Array<Record<string, unknown>>
  orgKpis?: Array<Record<string, unknown>>
  gradePolicies?: Array<Record<string, unknown>>
  gradePolicyError?: unknown
} = {}) {
  const counts = {
    evalCycleFindUnique: 0,
    employeeFindMany: 0,
    personalKpiFindMany: 0,
    evaluationFindMany: 0,
    evaluationAssignmentFindMany: 0,
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
    evaluationGradePolicy: {
      findMany: async () => {
        if (overrides.gradePolicyError) {
          throw overrides.gradePolicyError
        }
        return overrides.gradePolicies ?? []
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
      findMany: async () => {
        counts.evaluationAssignmentFindMany += 1
        return overrides.evaluationAssignments ?? []
      },
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
  orgKpis?: Array<Record<string, unknown>>
  cycle?: Record<string, unknown> | null
} = {}) {
  const counts = {
    reviewRunCreate: 0,
    orgKpiUpdate: 0,
    audit: 0,
  }
  const defaultOrgKpi = {
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
  }
  let orgKpi = overrides.orgKpi === null
    ? null
    : {
        ...defaultOrgKpi,
        ...overrides.orgKpi,
      }
  const orgKpisById = overrides.orgKpis
    ? new Map(
        overrides.orgKpis.map((record) => [
          String(record.id),
          {
            ...defaultOrgKpi,
            ...record,
          },
        ])
      )
    : null
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
      findUnique: async ({ where }: { where: { id: string } }) => {
        if (orgKpisById) return orgKpisById.get(where.id) ?? null
        return orgKpi
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        counts.orgKpiUpdate += 1
        if (orgKpisById) {
          const current = orgKpisById.get(where.id)
          if (!current) throw new Error('missing orgKpi')
          const updated = {
            ...current,
            ...data,
          }
          orgKpisById.set(where.id, updated)
          return {
            id: updated.id,
            mboExceptionApproved: updated.mboExceptionApproved,
            mboExceptionReason: updated.mboExceptionReason,
            mboExceptionApprovedById: updated.mboExceptionApprovedById,
            mboExceptionApprovedAt: updated.mboExceptionApprovedAt,
          }
        }
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
    Evaluation2026TeamKpiHrReviewBulkDecisionSchema,
    Evaluation2026TeamKpiHrReviewDecisionSchema,
    saveEvaluation2026TeamKpiHrReviewBulkDecisionForSession,
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
    assert.equal(dryRun.mboSetupCoverage.monitoring.missingMboEmployees[0]?.email, 'kpi.missing@rsupport.com')
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
    assert.equal(dryRun.policyCategoryMappingReadiness.missingPolicyCategoryCount, 1)
    assert.equal(dryRun.policyCategoryMappingReadiness.mappedPolicyCategoryCount, 2)
    assert.equal(dryRun.policyCategoryMappingReadiness.manualReviewCount, 1)
    assert.equal(dryRun.policyCategoryMappingReadiness.orgGoalWithoutApprovedSourceCount, 1)
    assert.equal(dryRun.policyCategoryMappingReadiness.dailyWorkDuplicateRiskCount, 0)
    assert.equal(dryRun.policyCategoryMappingReadiness.bulkMappingSavedCount, 0)
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

  await run('grade policy DB compatibility blocker does not fail full population dry-run', async () => {
    const fake = makeDb({
      gradePolicyError: {
        code: 'P2021',
        message: 'The table `evaluation_grade_policies` does not exist in the current database.',
        meta: {
          table: 'evaluation_grade_policies',
        },
      },
    })

    const dryRun = await getEvaluation2026ReadinessPopulationDryRun({
      db: fake.db as never,
      evalCycleId: 'cycle-2026',
      env: {} as NodeJS.ProcessEnv,
    })

    assert.equal(dryRun.isDryRun, true)
    assert.equal(dryRun.activeEmployeeCount, 3)
    assert.equal(dryRun.gradePolicyReadiness.persistence.compatibilityIssue?.code, 'GRADE_POLICY_DB_COMPATIBILITY_REQUIRED')
    assert.equal(dryRun.gradePolicyReadiness.persistence.compatibilityIssue?.prismaCode, 'P2021')
    assert.equal(
      dryRun.blockers.some((blocker) => blocker.code === 'GRADE_POLICY_REQUIRED'),
      true
    )
    assert.equal(
      dryRun.blockers.some((blocker) => blocker.code === 'GRADE_POLICY_DB_COMPATIBILITY_REQUIRED'),
      true
    )
    assert.equal(
      dryRun.gradePolicyReadiness.blockers.some((blocker) => blocker.code === 'GRADE_POLICY_DB_COMPATIBILITY_REQUIRED'),
      true
    )
    assert.equal(fake.counts.writes, 0)
    assert.equal(dryRun.safety.evaluationsCreated, 0)
    assert.equal(dryRun.safety.evaluationItemsCreated, 0)
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

  await run('admin can bulk save multiple Team KPI HR decisions without touching scores', async () => {
    const fake = makeTeamKpiDecisionDb({
      orgKpis: [
        {
          id: 'team-kpi-bulk-1',
          deptId: 'team-sales',
          kpiName: '영업 전환율 개선',
          department: {
            id: 'team-sales',
            orgId: 'org-1',
            deptName: '세일즈팀',
            parentDeptId: 'division-sales',
          },
        },
        {
          id: 'team-kpi-bulk-2',
          deptId: 'team-support',
          kpiName: '지원 프로세스 개선',
          department: {
            id: 'team-support',
            orgId: 'org-1',
            deptName: '인사팀',
            parentDeptId: 'division-support',
          },
        },
      ],
    })

    const result = await saveEvaluation2026TeamKpiHrReviewBulkDecisionForSession(
      {
        session: makeSession('ROLE_ADMIN'),
        input: {
          orgKpiIds: ['team-kpi-bulk-1', 'team-kpi-bulk-2'],
          evalCycleId: 'cycle-2026',
          decision: 'APPROVED_FOR_ORG_GOAL',
          reason: '핵심 과제',
          note: '일괄 조직목표 반영 승인',
        },
      },
      {
        db: fake.db as never,
        audit: fake.audit as never,
        now: new Date('2026-05-20T01:02:03.000Z'),
      }
    )

    assert.equal(result.count, 2)
    assert.deepEqual(result.results.map((item) => item.orgKpiId), ['team-kpi-bulk-1', 'team-kpi-bulk-2'])
    assert.equal(result.safety.officialScoresChanged, false)
    assert.equal(result.safety.officialGradesChanged, false)
    assert.equal(result.safety.totalScoreChanged, false)
    assert.equal(result.safety.gradeIdChanged, false)
    assert.equal(result.safety.evaluationsCreated, 0)
    assert.equal(result.safety.evaluationItemsCreated, 0)
    assert.equal(result.safety.personalKpiPolicyCategoryChanged, false)
    assert.equal(result.safety.evaluationItemPolicyCategoryChanged, false)
    assert.equal(fake.counts.reviewRunCreate, 2)
    assert.equal(fake.counts.orgKpiUpdate, 2)
    assert.equal(fake.counts.audit, 2)
  })

  await run('member cannot bulk save Team KPI HR decisions', async () => {
    const fake = makeTeamKpiDecisionDb({
      orgKpis: [
        {
          id: 'team-kpi-bulk-1',
          deptId: 'team-sales',
          department: {
            id: 'team-sales',
            orgId: 'org-1',
            deptName: '세일즈팀',
            parentDeptId: 'division-sales',
          },
        },
      ],
    })

    await assert.rejects(
      () =>
        saveEvaluation2026TeamKpiHrReviewBulkDecisionForSession(
          {
            session: makeSession('ROLE_MEMBER', 'member-1'),
            input: {
              orgKpiIds: ['team-kpi-bulk-1'],
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
    assert.equal(fake.counts.audit, 0)
  })

  await run('invalid or missing bulk Team KPI HR decision fields fail validation', () => {
    assert.equal(
      Evaluation2026TeamKpiHrReviewBulkDecisionSchema.safeParse({
        orgKpiIds: ['team-kpi-bulk-1'],
        decision: 'INVALID_DECISION',
        reason: '핵심 과제',
      }).success,
      false
    )
    assert.equal(
      Evaluation2026TeamKpiHrReviewBulkDecisionSchema.safeParse({
        orgKpiIds: ['team-kpi-bulk-1'],
        decision: 'APPROVED_FOR_ORG_GOAL',
      }).success,
      false
    )
    assert.equal(
      Evaluation2026TeamKpiHrReviewBulkDecisionSchema.safeParse({
        orgKpiIds: [],
        decision: 'APPROVED_FOR_ORG_GOAL',
        reason: '핵심 과제',
      }).success,
      false
    )
  })

  await run('bulk Team KPI HR decisions update ORG_GOAL and DAILY_WORK suggestions', async () => {
    const approvedFake = makeTeamKpiDecisionDb({
      orgKpis: [
        {
          id: 'team-kpi-pending',
          deptId: 'team-support',
          kpiName: '인사 데이터 정비 KPI',
          department: {
            id: 'team-support',
            orgId: 'org-1',
            deptName: '인사팀',
            parentDeptId: 'division-support',
          },
        },
        {
          id: 'team-kpi-excluded',
          deptId: 'team-support',
          kpiName: '인사 운영 유지 KPI',
          department: {
            id: 'team-support',
            orgId: 'org-1',
            deptName: '인사팀',
            parentDeptId: 'division-support',
          },
        },
      ],
    })
    await saveEvaluation2026TeamKpiHrReviewBulkDecisionForSession(
      {
        session: makeSession('ROLE_ADMIN'),
        input: {
          orgKpiIds: ['team-kpi-pending', 'team-kpi-excluded'],
          evalCycleId: 'cycle-2026',
          decision: 'APPROVED_FOR_ORG_GOAL',
          reason: '핵심 과제',
          note: '일괄 승인',
        },
      },
      {
        db: approvedFake.db as never,
        audit: approvedFake.audit as never,
      }
    )
    const approvedItems = approvedFake.createdRuns.map((run) => (run.items as Array<Record<string, unknown>>)[0])
    const approvedDryRunDb = makeDb({
      orgKpis: [
        {
          ...teamOrgKpis.find((item) => item.id === 'team-kpi-pending'),
          teamKpiReviewItems: [approvedItems[0]],
        },
        {
          ...teamOrgKpis.find((item) => item.id === 'team-kpi-excluded'),
          teamKpiReviewItems: [approvedItems[1]],
        },
      ],
    })
    const approvedDryRun = await getEvaluation2026ReadinessPopulationDryRun({
      db: approvedDryRunDb.db as never,
      evalCycleId: 'cycle-2026',
      env: {} as NodeJS.ProcessEnv,
    })
    assert.equal(
      approvedDryRun.teamKpiHrReviewCoverage.candidates.every((candidate) => candidate.suggestedMboCategory === 'ORG_GOAL'),
      true
    )

    const excludedFake = makeTeamKpiDecisionDb({
      orgKpis: [
        {
          id: 'team-kpi-pending',
          deptId: 'team-support',
          kpiName: '인사 데이터 정비 KPI',
          department: {
            id: 'team-support',
            orgId: 'org-1',
            deptName: '인사팀',
            parentDeptId: 'division-support',
          },
        },
        {
          id: 'team-kpi-excluded',
          deptId: 'team-support',
          kpiName: '인사 운영 유지 KPI',
          department: {
            id: 'team-support',
            orgId: 'org-1',
            deptName: '인사팀',
            parentDeptId: 'division-support',
          },
        },
      ],
    })
    await saveEvaluation2026TeamKpiHrReviewBulkDecisionForSession(
      {
        session: makeSession('ROLE_ADMIN'),
        input: {
          orgKpiIds: ['team-kpi-pending', 'team-kpi-excluded'],
          evalCycleId: 'cycle-2026',
          decision: 'EXCLUDED_DAILY_WORK',
          reason: '단순 운영/유지 업무',
          note: '일괄 제외',
        },
      },
      {
        db: excludedFake.db as never,
        audit: excludedFake.audit as never,
      }
    )
    const excludedItems = excludedFake.createdRuns.map((run) => (run.items as Array<Record<string, unknown>>)[0])
    const excludedDryRunDb = makeDb({
      orgKpis: [
        {
          ...teamOrgKpis.find((item) => item.id === 'team-kpi-pending'),
          teamKpiReviewItems: [excludedItems[0]],
        },
        {
          ...teamOrgKpis.find((item) => item.id === 'team-kpi-excluded'),
          teamKpiReviewItems: [excludedItems[1]],
        },
      ],
    })
    const excludedDryRun = await getEvaluation2026ReadinessPopulationDryRun({
      db: excludedDryRunDb.db as never,
      evalCycleId: 'cycle-2026',
      env: {} as NodeJS.ProcessEnv,
    })
    assert.equal(
      excludedDryRun.teamKpiHrReviewCoverage.candidates.every((candidate) => candidate.suggestedMboCategory === 'DAILY_WORK'),
      true
    )
    assert.equal(
      excludedDryRun.teamKpiHrReviewCoverage.candidates.every((candidate) => candidate.canSuggestAsOrgGoal === false),
      true
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

  await run('score policy readiness detects PPT weight caps, missing category, and source warnings', async () => {
    const fake = makeDb({
      personalKpis: [
        {
          id: 'kpi-org-heavy',
          employeeId: 'emp-with-kpi',
          kpiName: '조직목표 과다 가중치',
          definition: '본부 KPI와 연결되어야 하는 조직목표입니다.',
          formula: '실적 / 목표',
          policyCategory: 'ORG_GOAL',
          status: 'CONFIRMED',
          weight: 55,
          targetValueT: 90,
          targetValueE: 100,
          linkedOrgKpiId: null,
          linkedOrgKpi: null,
        },
        {
          id: 'kpi-project-t-heavy',
          employeeId: 'emp-with-kpi',
          kpiName: '프로젝트 T 과다 가중치',
          definition: '개인 프로젝트 T 과업입니다.',
          formula: '완료율',
          policyCategory: 'PROJECT_T',
          status: 'CONFIRMED',
          weight: 20,
          targetValueT: 90,
          targetValueE: 100,
          linkedOrgKpiId: null,
          linkedOrgKpi: null,
        },
        {
          id: 'kpi-project-k-heavy',
          employeeId: 'emp-with-kpi',
          kpiName: '프로젝트 K 과다 가중치',
          definition: '개인 프로젝트 K 과업입니다.',
          formula: '완료율',
          policyCategory: 'PROJECT_K',
          status: 'CONFIRMED',
          weight: 10,
          targetValueT: 80,
          targetValueE: 90,
          linkedOrgKpiId: null,
          linkedOrgKpi: null,
        },
        {
          id: 'kpi-missing-category',
          employeeId: 'emp-with-kpi',
          kpiName: '카테고리 미분류',
          definition: '카테고리 확인이 필요한 항목입니다.',
          formula: '완료율',
          policyCategory: null,
          status: 'CONFIRMED',
          weight: 15,
          targetValueT: 80,
          targetValueE: 90,
          linkedOrgKpiId: null,
          linkedOrgKpi: null,
        },
      ],
    })

    const dryRun = await getEvaluation2026ReadinessPopulationDryRun({
      db: fake.db as never,
      evalCycleId: 'cycle-2026',
      env: {} as NodeJS.ProcessEnv,
    })

    const codes = new Set(dryRun.scorePolicyReadiness.violations.map((violation) => violation.code))
    assert.equal(dryRun.scorePolicyReadiness.visible, true)
    assert.equal(dryRun.scorePolicyReadiness.scoreSplit.organizationPerformanceWeight, 30)
    assert.equal(dryRun.scorePolicyReadiness.scoreSplit.personalPerformanceWeight, 70)
    assert.equal(dryRun.scorePolicyReadiness.aiExcludedFromAnnualScore, true)
    assert.equal(codes.has('ORG_GOAL_TOTAL_WEIGHT_CAP_EXCEEDED'), true)
    assert.equal(codes.has('ORG_GOAL_ITEM_WEIGHT_CAP_EXCEEDED'), true)
    assert.equal(codes.has('PROJECT_T_ITEM_WEIGHT_CAP_EXCEEDED'), true)
    assert.equal(codes.has('PROJECT_K_ITEM_WEIGHT_CAP_EXCEEDED'), true)
    assert.equal(codes.has('POLICY_CATEGORY_MISSING'), true)
    assert.equal(codes.has('ORG_GOAL_APPROVED_SOURCE_REQUIRED'), true)
    assert.equal(dryRun.scorePolicyReadiness.summary.weightCapViolationCount >= 4, true)
    assert.equal(dryRun.scorePolicyReadiness.summary.categoryMissingCount, 1)
    assert.equal(dryRun.scorePolicyReadiness.summary.orgGoalSourceWarningCount, 1)
    assert.equal(
      dryRun.blockers.some((blocker) => blocker.code === 'SCORE_POLICY_READINESS_VIOLATIONS'),
      true
    )
    assert.equal(fake.counts.writes, 0)
  })

  await run('score policy readiness reports project criteria and daily work duplicate warnings', async () => {
    const fake = makeDb({
      personalKpis: [
        {
          id: 'kpi-org',
          employeeId: 'emp-with-kpi',
          kpiName: '고객 확보 프로젝트',
          definition: '고객 확보 조직목표를 수행합니다.',
          formula: '실적 / 목표',
          policyCategory: 'ORG_GOAL',
          status: 'DRAFT',
          weight: 10,
          targetValueT: 90,
          targetValueE: 100,
          linkedOrgKpiId: 'org-shared',
          linkedOrgKpi: {
            id: 'org-shared',
            kpiName: '고객 확보',
            status: 'CONFIRMED',
            parentOrgKpiId: null,
            mboExceptionApproved: false,
            mboExceptionReason: null,
            mboExceptionApprovedById: null,
            mboExceptionApprovedAt: null,
            department: { id: 'division-sales', deptName: '국내영업총괄본부', parentDeptId: null },
            teamKpiReviewItems: [],
          },
        },
        {
          id: 'kpi-project-missing',
          employeeId: 'emp-with-kpi',
          kpiName: '측정 기준 누락 프로젝트',
          definition: '계획과 측정 기준을 보완해야 합니다.',
          formula: '',
          policyCategory: 'PROJECT_T',
          status: 'DRAFT',
          weight: 10,
          targetValueT: null,
          targetValueE: null,
          linkedOrgKpiId: null,
          linkedOrgKpi: null,
        },
        {
          id: 'kpi-daily-duplicate',
          employeeId: 'emp-with-kpi',
          kpiName: '고객 확보 프로젝트 운영',
          definition: '고객 확보 조직목표와 유사한 반복 운영입니다.',
          formula: '고객 확보 실적 확인',
          policyCategory: 'DAILY_WORK',
          status: 'DRAFT',
          weight: 80,
          targetValueT: null,
          targetValueE: null,
          linkedOrgKpiId: 'org-shared',
          linkedOrgKpi: null,
        },
      ],
    })

    const dryRun = await getEvaluation2026ReadinessPopulationDryRun({
      db: fake.db as never,
      evalCycleId: 'cycle-2026',
      env: {} as NodeJS.ProcessEnv,
    })

    const codes = new Set(dryRun.scorePolicyReadiness.violations.map((violation) => violation.code))
    assert.equal(codes.has('PROJECT_MEASURABLE_TARGET_REQUIRED'), true)
    assert.equal(codes.has('PROJECT_PLAN_REQUIRED'), true)
    assert.equal(codes.has('EXCELLENT_CRITERIA_REQUIRED'), true)
    assert.equal(codes.has('DAILY_WORK_DUPLICATED_WITH_ORG_OR_PROJECT'), true)
    assert.equal(dryRun.scorePolicyReadiness.simulator.isReadOnly, true)
    assert.equal(dryRun.safety.officialScoringEnabled, false)
    assert.equal(dryRun.safety.officialGradeEnabled, false)
    assert.equal(dryRun.safety.totalScoreChanged, false)
    assert.equal(dryRun.safety.gradeIdChanged, false)
    assert.equal(fake.counts.writes, 0)
  })

  await run('follow-up communication readiness has recipient source data and performs no writes', async () => {
    const fake = makeDb()

    const dryRun = await getEvaluation2026ReadinessPopulationDryRun({
      db: fake.db as never,
      evalCycleId: 'cycle-2026',
      env: {} as NodeJS.ProcessEnv,
    })

    const missing = dryRun.mboSetupCoverage.monitoring.missingMboEmployees
    const policyCategory = dryRun.mboSetupCoverage.monitoring.policyCategoryMissingItems
    const teamKpiNeedsHr = dryRun.teamKpiHrReviewCoverage.candidates.filter((candidate) =>
      candidate.reviewStatus === 'PENDING_REVIEW' || candidate.reviewStatus === 'NEEDS_DISCUSSION'
    )

    assert.equal(missing[0]?.actionLabel, '작성 요청 필요')
    assert.equal(missing[0]?.email, 'kpi.missing@rsupport.com')
    assert.equal(policyCategory[0]?.actionLabel, '카테고리 확정 필요')
    assert.equal(policyCategory[0]?.email, 'kpi.owner@rsupport.com')
    assert.equal(teamKpiNeedsHr.length > 0, true)
    assert.equal(teamKpiNeedsHr[0]?.reviewStatus, 'PENDING_REVIEW')
    assert.equal(dryRun.safety.writesPerformed, false)
    assert.equal(dryRun.safety.officialScoringEnabled, false)
    assert.equal(dryRun.safety.officialGradeEnabled, false)
    assert.equal(dryRun.safety.totalScoreChanged, false)
    assert.equal(dryRun.safety.gradeIdChanged, false)
    assert.equal(fake.counts.writes, 0)
  })

  await run('result-writing readiness reports guidance, warnings, exports, and performs no writes', async () => {
    const resultWritingPersonalKpis = [
      ...confirmedPersonalKpis,
      {
        id: 'kpi-daily-duplicate',
        employeeId: 'emp-with-kpi',
        kpiName: '매출 성장',
        definition: '매출 성장 조직목표와 중복될 수 있는 일상 운영 업무입니다.',
        formula: '',
        policyCategory: 'DAILY_WORK',
        status: 'CONFIRMED',
        weight: 10,
        targetValueT: 80,
        linkedOrgKpiId: 'org-1',
        linkedOrgKpi: null,
        monthlyRecords: [],
      },
      {
        id: 'kpi-project-k-missing-deliverable',
        employeeId: 'emp-existing-eval',
        kpiName: '프로젝트 K 과제 미정',
        definition: '간단한 과제',
        formula: '',
        policyCategory: 'PROJECT_K',
        status: 'CONFIRMED',
        weight: 10,
        targetValueT: null,
        linkedOrgKpiId: null,
        linkedOrgKpi: null,
        monthlyRecords: [],
      },
      {
        id: 'kpi-ai-mixed',
        employeeId: 'emp-existing-eval',
        kpiName: 'AI 활용평가 증빙 혼재',
        definition: 'AI 활용평가 Pass/Fail 증빙을 연간 업적점수 결과에 섞어 쓰는 초안입니다.',
        formula: '완료율',
        policyCategory: 'PROJECT_T',
        status: 'CONFIRMED',
        weight: 10,
        targetValueT: 100,
        linkedOrgKpiId: null,
        linkedOrgKpi: null,
        monthlyRecords: [],
      },
    ]
    const fake = makeDb({
      personalKpis: resultWritingPersonalKpis,
      evaluations: [
        {
          id: 'eval-existing-self',
          targetId: 'emp-existing-eval',
          evalStage: 'SELF',
          items: [
            {
              id: 'item-existing',
              personalKpiId: 'kpi-3',
              policyCategory: 'PROJECT_T',
              itemComment: 'Target 100 대비 실제 120건 완료. 본인 주도로 산출물 품질을 개선했고 https://drive.example.com/evidence 를 증빙으로 남겼습니다.',
              targetAchievementLevel: 'EXCELLENT',
              personalKpi: {
                id: 'kpi-3',
                kpiName: '기존 평가 보존 KPI',
                policyCategory: 'PROJECT_T',
              },
            },
            {
              id: 'item-ai-mixed',
              personalKpiId: 'kpi-ai-mixed',
              policyCategory: 'PROJECT_T',
              itemComment: 'AI 활용평가 Pass/Fail 증빙을 연간 업적점수 결과에 포함하려는 초안입니다. https://drive.example.com/ai',
              targetAchievementLevel: 'TARGET',
              personalKpi: {
                id: 'kpi-ai-mixed',
                kpiName: 'AI 활용평가 증빙 혼재',
                policyCategory: 'PROJECT_T',
              },
            },
          ],
        },
      ],
    })

    const dryRun = await getEvaluation2026ReadinessPopulationDryRun({
      db: fake.db as never,
      evalCycleId: 'cycle-2026',
      env: {} as NodeJS.ProcessEnv,
    })

    const readiness = dryRun.resultWritingReadiness
    const findRow = (id: string) => readiness.rows.find((row) => row.personalKpiId === id)

    assert.equal(readiness.mode, 'READ_ONLY')
    assert.equal(readiness.guidance.some((guide) => guide.category === 'ORG_GOAL'), true)
    assert.equal(readiness.guidance.some((guide) => guide.category === 'DAILY_WORK'), true)
    assert.equal(readiness.evidenceGuidance.some((item) => item.includes('Google Drive')), true)
    assert.equal(readiness.leaderReviewChecklist.some((item) => item.includes('AI Pass/Fail')), true)
    assert.equal(readiness.exportColumns.includes('employeeNo'), true)
    assert.equal(readiness.summary.totalItemCount, resultWritingPersonalKpis.length)
    assert.equal(readiness.summary.missingResultCount > 0, true)
    assert.equal(readiness.summary.missingEvidenceCount > 0, true)
    assert.equal(readiness.summary.missingContributionCount > 0, true)
    assert.equal(readiness.summary.missingMeasurableResultCount > 0, true)
    assert.equal(readiness.summary.orgGoalSourceWarningCount, 1)
    assert.equal(readiness.summary.dailyWorkDuplicateRiskCount, 1)
    assert.equal(readiness.summary.projectTkMissingDeliverableCount, 1)
    assert.equal(readiness.summary.aiEvidenceMixedCount, 1)
    assert.equal(findRow('kpi-1')?.warnings.some((warning) => warning.code === 'ORG_GOAL_WITHOUT_APPROVED_SOURCE'), true)
    assert.equal(findRow('kpi-daily-duplicate')?.warnings.some((warning) => warning.code === 'DAILY_WORK_DUPLICATE_RISK'), true)
    assert.equal(findRow('kpi-project-k-missing-deliverable')?.warnings.some((warning) => warning.code === 'PROJECT_TK_MISSING_DELIVERABLE'), true)
    assert.equal(findRow('kpi-ai-mixed')?.warnings.some((warning) => warning.code === 'AI_EVIDENCE_MIXED_IN_ANNUAL_SCORE'), true)
    assert.equal(findRow('kpi-3')?.resultWritingStatus, 'READY_FOR_REVIEW')
    assert.equal(
      dryRun.warnings.some((warning) => warning.code === 'RESULT_WRITING_READINESS_WARNINGS'),
      true
    )
    assert.equal(readiness.safety.writesPerformed, false)
    assert.equal(readiness.safety.officialScoringEnabled, false)
    assert.equal(readiness.safety.officialGradeEnabled, false)
    assert.equal(dryRun.safety.totalScoreChanged, false)
    assert.equal(dryRun.safety.gradeIdChanged, false)
    assert.equal(fake.counts.writes, 0)
  })

  await run('leader evaluation readiness reports stage blockers and exports without writes', async () => {
    const leaderEmployees = [
      {
        id: 'emp-self-pending',
        empId: 'L001',
        empName: '셀프 미제출자',
        gwsEmail: 'self.pending@rsupport.com',
        deptId: 'team-sales',
        role: 'ROLE_MEMBER',
        position: 'MEMBER',
        department: { id: 'team-sales', deptName: '세일즈팀', parentDeptId: 'division-sales' },
      },
      {
        id: 'emp-second-ready',
        empId: 'L002',
        empName: '이차 준비자',
        gwsEmail: 'second.ready@rsupport.com',
        deptId: 'team-sales',
        role: 'ROLE_MEMBER',
        position: 'MEMBER',
        department: { id: 'team-sales', deptName: '세일즈팀', parentDeptId: 'division-sales' },
      },
      {
        id: 'emp-first-incomplete',
        empId: 'L003',
        empName: '일차 진행자',
        gwsEmail: 'first.progress@rsupport.com',
        deptId: 'team-sales',
        role: 'ROLE_MEMBER',
        position: 'MEMBER',
        department: { id: 'team-sales', deptName: '세일즈팀', parentDeptId: 'division-sales' },
      },
      {
        id: 'emp-missing-evaluator',
        empId: 'L004',
        empName: '평가자 누락자',
        gwsEmail: 'missing.evaluator@rsupport.com',
        deptId: 'team-support',
        role: 'ROLE_MEMBER',
        position: 'MEMBER',
        department: { id: 'team-support', deptName: '인사팀', parentDeptId: 'division-support' },
      },
    ]
    const leaderKpis = leaderEmployees.map((employee, index) => ({
      id: `leader-kpi-${index + 1}`,
      employeeId: employee.id,
      kpiName: `${employee.empName} 프로젝트 산출물`,
      definition: '본인 주도로 프로젝트 산출물과 개선 결과를 책임집니다.',
      formula: 'deliverable 완료율과 개선 건수',
      policyCategory: 'PROJECT_T',
      status: 'CONFIRMED',
      weight: 100,
      targetValueT: 100,
      linkedOrgKpiId: null,
      linkedOrgKpi: null,
      monthlyRecords: [
        {
          id: `monthly-${index + 1}`,
          yearMonth: '2026-12',
          actualValue: 120,
          achievementRate: 120,
          activities: '산출물 완료 및 품질 개선',
          efforts: '본인 주도 개선 실행',
          evidenceComment: 'https://drive.example.com/evidence',
          attachments: [],
          submittedAt: new Date('2026-12-31T00:00:00.000Z'),
          isDraft: false,
        },
      ],
    }))
    const makeItem = (employeeIndex: number) => ({
      id: `leader-item-${employeeIndex + 1}`,
      personalKpiId: `leader-kpi-${employeeIndex + 1}`,
      policyCategory: 'PROJECT_T',
      itemComment: 'Target 100 대비 실제 120건 완료. 본인 주도로 산출물을 개선했고 https://drive.example.com/evidence 를 증빙으로 남겼습니다.',
      targetAchievementLevel: 'EXCELLENT',
      personalKpi: {
        id: `leader-kpi-${employeeIndex + 1}`,
        kpiName: `${leaderEmployees[employeeIndex].empName} 프로젝트 산출물`,
        policyCategory: 'PROJECT_T',
      },
    })
    const leaderEvaluations = [
      { id: 'eval-self-pending', targetId: 'emp-self-pending', evaluatorId: 'emp-self-pending', evalStage: 'SELF', status: 'PENDING', items: [makeItem(0)] },
      { id: 'eval-second-ready-self', targetId: 'emp-second-ready', evaluatorId: 'emp-second-ready', evalStage: 'SELF', status: 'SUBMITTED', items: [makeItem(1)] },
      { id: 'eval-second-ready-first', targetId: 'emp-second-ready', evaluatorId: 'leader-1', evalStage: 'FIRST', status: 'SUBMITTED', items: [] },
      { id: 'eval-first-progress-self', targetId: 'emp-first-incomplete', evaluatorId: 'emp-first-incomplete', evalStage: 'SELF', status: 'SUBMITTED', items: [makeItem(2)] },
      { id: 'eval-first-progress-first', targetId: 'emp-first-incomplete', evaluatorId: 'leader-1', evalStage: 'FIRST', status: 'IN_PROGRESS', items: [] },
      { id: 'eval-missing-evaluator-self', targetId: 'emp-missing-evaluator', evaluatorId: 'emp-missing-evaluator', evalStage: 'SELF', status: 'SUBMITTED', items: [makeItem(3)] },
    ]
    const assignmentStages = ['FIRST', 'SECOND', 'FINAL']
    const leaderAssignments = leaderEmployees
      .filter((employee) => employee.id !== 'emp-missing-evaluator')
      .flatMap((employee) =>
        assignmentStages.map((stage) => ({
          id: `${employee.id}-${stage}`,
          targetId: employee.id,
          evaluatorId: `${stage.toLowerCase()}-evaluator`,
          evalStage: stage,
          source: 'AUTO',
          evaluator: {
            id: `${stage.toLowerCase()}-evaluator`,
            empName: `${stage} 평가자`,
            empId: `${stage}-001`,
            status: 'ACTIVE',
          },
        }))
      )
    const fake = makeDb({
      employees: leaderEmployees,
      personalKpis: leaderKpis,
      evaluations: leaderEvaluations,
      evaluationAssignments: leaderAssignments,
    })

    const dryRun = await getEvaluation2026ReadinessPopulationDryRun({
      db: fake.db as never,
      evalCycleId: 'cycle-2026',
      env: {} as NodeJS.ProcessEnv,
    })

    const readiness = dryRun.leaderEvaluationReadiness
    const findRow = (employeeId: string) => readiness.rows.find((row) => row.employeeId === employeeId)

    assert.equal(readiness.mode, 'READ_ONLY')
    assert.equal(readiness.firstEvaluatorChecklist.some((item) => item.includes('target vs actual')), true)
    assert.equal(readiness.secondEvaluatorChecklist.some((item) => item.includes('zero-sum')), true)
    assert.equal(readiness.exportColumns.includes('employeeNo'), true)
    assert.equal(findRow('emp-self-pending')?.readinessStatus, 'BLOCKED_SELF_NOT_SUBMITTED')
    assert.equal(findRow('emp-second-ready')?.readinessStatus, 'READY_FOR_SECOND_REVIEW')
    assert.equal(findRow('emp-first-incomplete')?.readinessStatus, 'BLOCKED_FIRST_NOT_COMPLETE')
    assert.equal(findRow('emp-missing-evaluator')?.readinessStatus, 'BLOCKED_EVALUATOR_MISSING')
    assert.equal(findRow('emp-missing-evaluator')?.missingPrerequisites.includes('EVALUATOR_MISSING'), true)
    assert.equal(readiness.summary.selfSubmittedCount, 3)
    assert.equal(readiness.summary.secondReviewReadyCount, 1)
    assert.equal(readiness.summary.secondReviewMissingPrerequisitesCount, 1)
    assert.equal(readiness.summary.missingEvaluatorCount, 1)
    assert.equal(readiness.summary.officialScoringEnabled, false)
    assert.equal(readiness.summary.officialGradeEnabled, false)
    assert.equal(readiness.safety.writesPerformed, false)
    assert.equal(readiness.safety.evaluationsCreated, 0)
    assert.equal(readiness.safety.evaluationItemsCreated, 0)
    assert.equal(dryRun.warnings.some((warning) => warning.code === 'LEADER_EVALUATION_READINESS_WARNINGS'), true)
    assert.equal(fake.counts.writes, 0)
  })

  await run('finalization CEO readiness reports stage blockers, checklist, exports, and no writes', async () => {
    const finalEmployees = [
      ['emp-self-blocked', 'F001', 'SELF 미준비자'],
      ['emp-first-blocked', 'F002', 'FIRST 미준비자'],
      ['emp-second-blocked', 'F003', 'SECOND 미준비자'],
      ['emp-final-ready', 'F004', '최종 준비자'],
      ['emp-ceo-ready', 'F005', 'CEO later 준비자'],
      ['emp-policy-missing', 'F006', '카테고리 누락자'],
      ['emp-evidence-missing', 'F007', '증빙 누락자'],
      ['emp-evaluator-missing', 'F008', '평가자 chain 누락자'],
    ].map(([id, empId, empName]) => ({
      id,
      empId,
      empName,
      gwsEmail: `${id}@rsupport.com`,
      deptId: 'team-sales',
      role: 'ROLE_MEMBER',
      position: 'MEMBER',
      department: { id: 'team-sales', deptName: '세일즈팀', parentDeptId: 'division-sales' },
    }))
    const finalKpis = finalEmployees.flatMap((employee) => {
      const missingPolicy = employee.id === 'emp-policy-missing'
      const missingEvidence = employee.id === 'emp-evidence-missing'
      return [
        {
          id: `${employee.id}-project`,
          employeeId: employee.id,
          kpiName: `${employee.empName} 프로젝트 산출물`,
          definition: '본인 주도로 프로젝트 산출물과 개선 결과를 책임집니다.',
          formula: 'deliverable 완료율과 개선 건수',
          policyCategory: missingPolicy ? null : 'PROJECT_T',
          status: 'CONFIRMED',
          weight: 10,
          targetValueT: 100,
          targetValueE: 120,
          linkedOrgKpiId: null,
          linkedOrgKpi: null,
          monthlyRecords: missingEvidence
            ? []
            : [
                {
                  id: `${employee.id}-monthly-project`,
                  yearMonth: '2026-12',
                  actualValue: 120,
                  achievementRate: 120,
                  activities: '산출물 완료 및 품질 개선',
                  efforts: '본인 주도 개선 실행',
                  evidenceComment: 'https://drive.example.com/evidence',
                  attachments: [],
                  submittedAt: new Date('2026-12-31T00:00:00.000Z'),
                  isDraft: false,
                },
              ],
        },
        {
          id: `${employee.id}-daily`,
          employeeId: employee.id,
          kpiName: `${employee.empName} 운영 안정화`,
          definition: '반복 운영 책임과 품질 안정화를 수행합니다.',
          formula: '운영 품질 점검 및 안정화 결과',
          policyCategory: 'DAILY_WORK',
          status: 'CONFIRMED',
          weight: 90,
          targetValueT: 100,
          targetValueE: null,
          linkedOrgKpiId: null,
          linkedOrgKpi: null,
          monthlyRecords: missingEvidence
            ? []
            : [
                {
                  id: `${employee.id}-monthly-daily`,
                  yearMonth: '2026-12',
                  actualValue: 100,
                  achievementRate: 100,
                  activities: '운영 안정화 완료',
                  efforts: '본인 담당 품질 개선',
                  evidenceComment: 'https://drive.example.com/daily',
                  attachments: [],
                  submittedAt: new Date('2026-12-31T00:00:00.000Z'),
                  isDraft: false,
                },
              ],
        },
      ]
    })
    const makeFinalItems = (employeeId: string, missingEvidence = false) => [
      {
        id: `${employeeId}-project-item`,
        personalKpiId: `${employeeId}-project`,
        policyCategory: employeeId === 'emp-policy-missing' ? null : 'PROJECT_T',
        itemComment: missingEvidence
          ? 'Target 100 대비 실제 120건 완료. 본인 주도로 산출물 품질을 개선했습니다.'
          : 'Target 100 대비 실제 120건 완료. 본인 주도로 산출물을 개선했고 https://drive.example.com/evidence 를 증빙으로 남겼습니다.',
        targetAchievementLevel: 'EXCELLENT',
        personalKpi: {
          id: `${employeeId}-project`,
          kpiName: `${employeeId} 프로젝트 산출물`,
          policyCategory: employeeId === 'emp-policy-missing' ? null : 'PROJECT_T',
        },
      },
      {
        id: `${employeeId}-daily-item`,
        personalKpiId: `${employeeId}-daily`,
        policyCategory: 'DAILY_WORK',
        itemComment: missingEvidence
          ? 'Target 100 대비 실제 100건 완료. 본인 담당 운영 안정화를 수행했습니다.'
          : 'Target 100 대비 실제 100건 완료. 본인 담당 운영 안정화를 수행했고 https://drive.example.com/daily 를 증빙으로 남겼습니다.',
        targetAchievementLevel: 'TARGET',
        personalKpi: {
          id: `${employeeId}-daily`,
          kpiName: `${employeeId} 운영 안정화`,
          policyCategory: 'DAILY_WORK',
        },
      },
    ]
    const finalEvaluations = [
      { id: 'final-self-blocked-self', targetId: 'emp-self-blocked', evaluatorId: 'emp-self-blocked', evalStage: 'SELF', status: 'PENDING', items: makeFinalItems('emp-self-blocked') },
      { id: 'final-first-blocked-self', targetId: 'emp-first-blocked', evaluatorId: 'emp-first-blocked', evalStage: 'SELF', status: 'SUBMITTED', items: makeFinalItems('emp-first-blocked') },
      { id: 'final-second-blocked-self', targetId: 'emp-second-blocked', evaluatorId: 'emp-second-blocked', evalStage: 'SELF', status: 'SUBMITTED', items: makeFinalItems('emp-second-blocked') },
      { id: 'final-second-blocked-first', targetId: 'emp-second-blocked', evaluatorId: 'first-evaluator', evalStage: 'FIRST', status: 'SUBMITTED', items: [] },
      { id: 'final-ready-self', targetId: 'emp-final-ready', evaluatorId: 'emp-final-ready', evalStage: 'SELF', status: 'SUBMITTED', items: makeFinalItems('emp-final-ready') },
      { id: 'final-ready-first', targetId: 'emp-final-ready', evaluatorId: 'first-evaluator', evalStage: 'FIRST', status: 'SUBMITTED', items: [] },
      { id: 'final-ready-second', targetId: 'emp-final-ready', evaluatorId: 'second-evaluator', evalStage: 'SECOND', status: 'SUBMITTED', items: [] },
      { id: 'ceo-ready-self', targetId: 'emp-ceo-ready', evaluatorId: 'emp-ceo-ready', evalStage: 'SELF', status: 'SUBMITTED', items: makeFinalItems('emp-ceo-ready') },
      { id: 'ceo-ready-first', targetId: 'emp-ceo-ready', evaluatorId: 'first-evaluator', evalStage: 'FIRST', status: 'SUBMITTED', items: [] },
      { id: 'ceo-ready-second', targetId: 'emp-ceo-ready', evaluatorId: 'second-evaluator', evalStage: 'SECOND', status: 'SUBMITTED', items: [] },
      { id: 'ceo-ready-final', targetId: 'emp-ceo-ready', evaluatorId: 'final-evaluator', evalStage: 'FINAL', status: 'SUBMITTED', items: [] },
      { id: 'policy-missing-self', targetId: 'emp-policy-missing', evaluatorId: 'emp-policy-missing', evalStage: 'SELF', status: 'SUBMITTED', items: makeFinalItems('emp-policy-missing') },
      { id: 'evidence-missing-self', targetId: 'emp-evidence-missing', evaluatorId: 'emp-evidence-missing', evalStage: 'SELF', status: 'SUBMITTED', items: makeFinalItems('emp-evidence-missing', true) },
      { id: 'evaluator-missing-self', targetId: 'emp-evaluator-missing', evaluatorId: 'emp-evaluator-missing', evalStage: 'SELF', status: 'SUBMITTED', items: makeFinalItems('emp-evaluator-missing') },
    ]
    const finalAssignments = finalEmployees
      .filter((employee) => employee.id !== 'emp-evaluator-missing')
      .flatMap((employee) =>
        ['FIRST', 'SECOND', 'FINAL'].map((stage) => ({
          id: `${employee.id}-${stage}`,
          targetId: employee.id,
          evaluatorId: `${stage.toLowerCase()}-evaluator`,
          evalStage: stage,
          source: 'AUTO',
          evaluator: {
            id: `${stage.toLowerCase()}-evaluator`,
            empName: `${stage} 평가자`,
            empId: `${stage}-001`,
            status: 'ACTIVE',
          },
        }))
      )
    const fake = makeDb({
      employees: finalEmployees,
      personalKpis: finalKpis,
      evaluations: finalEvaluations,
      evaluationAssignments: finalAssignments,
      gradePolicies: makeReadyGradePolicyRows(),
    })

    const dryRun = await getEvaluation2026ReadinessPopulationDryRun({
      db: fake.db as never,
      evalCycleId: 'cycle-2026',
      env: {} as NodeJS.ProcessEnv,
    })

    const readiness = dryRun.finalizationCeoReadiness
    const findRow = (employeeId: string) => readiness.rows.find((row) => row.employeeId === employeeId)

    assert.equal(readiness.mode, 'READ_ONLY')
    assert.equal(readiness.finalCeoChecklist.some((item) => item.includes('조정 사유')), true)
    assert.equal(readiness.exportColumns.includes('employeeNo'), true)
    assert.equal(findRow('emp-self-blocked')?.finalizationReadinessStatus, 'BLOCKED_SELF_NOT_READY')
    assert.equal(findRow('emp-first-blocked')?.finalizationReadinessStatus, 'BLOCKED_FIRST_NOT_READY')
    assert.equal(findRow('emp-second-blocked')?.finalizationReadinessStatus, 'BLOCKED_SECOND_NOT_READY')
    assert.equal(findRow('emp-final-ready')?.finalizationReadinessStatus, 'READY_FOR_FINAL_REVIEW')
    assert.equal(findRow('emp-ceo-ready')?.finalizationReadinessStatus, 'READY_FOR_CEO_CONFIRMATION_LATER')
    assert.equal(findRow('emp-policy-missing')?.finalizationReadinessStatus, 'BLOCKED_POLICY_CATEGORY_MISSING')
    assert.equal(findRow('emp-evidence-missing')?.finalizationReadinessStatus, 'BLOCKED_RESULT_MISSING')
    assert.equal(findRow('emp-evidence-missing')?.blockerTypes.includes('EVIDENCE_MISSING'), true)
    assert.equal(findRow('emp-evaluator-missing')?.finalizationReadinessStatus, 'BLOCKED_EVALUATOR_CHAIN')
    assert.equal(readiness.summary.blockedBeforeFirstCount >= 4, true)
    assert.equal(readiness.summary.blockedBeforeSecondCount, 1)
    assert.equal(readiness.summary.blockedBeforeFinalCount, 1)
    assert.equal(readiness.summary.readyLaterCount, 2)
    assert.equal(readiness.summary.missingEvidenceCount, 1)
    assert.equal(readiness.summary.missingPolicyCategoryCount, 1)
    assert.equal(readiness.summary.missingEvaluatorChainCount, 1)
    assert.equal(readiness.summary.ceoConfirmationBlockerCount, 7)
    assert.equal(readiness.summary.officialScoringEnabled, false)
    assert.equal(readiness.summary.officialGradeEnabled, false)
    assert.equal(readiness.safety.totalScoreChanged, false)
    assert.equal(readiness.safety.gradeIdChanged, false)
    assert.equal(dryRun.warnings.some((warning) => warning.code === 'FINALIZATION_CEO_READINESS_WARNINGS'), true)
    assert.equal(fake.counts.writes, 0)
  })

  await run('finalization CEO readiness surfaces score and grade policy blockers without writes', async () => {
    const blockerEmployees = [
      {
        id: 'emp-score-blocked',
        empId: 'S001',
        empName: '점수정책 blocker',
        gwsEmail: 'score.blocked@rsupport.com',
        deptId: 'team-sales',
        role: 'ROLE_MEMBER',
        position: 'MEMBER',
        department: { id: 'team-sales', deptName: '세일즈팀', parentDeptId: 'division-sales' },
      },
    ]
    const blockerKpis = [
      {
        id: 'score-blocked-project',
        employeeId: 'emp-score-blocked',
        kpiName: '비중 초과 프로젝트',
        definition: '본인 주도로 프로젝트 산출물과 개선 결과를 책임집니다.',
        formula: 'deliverable 완료율과 개선 건수',
        policyCategory: 'PROJECT_T',
        status: 'CONFIRMED',
        weight: 100,
        targetValueT: 100,
        targetValueE: 120,
        linkedOrgKpiId: null,
        linkedOrgKpi: null,
        monthlyRecords: [
          {
            id: 'score-blocked-monthly',
            yearMonth: '2026-12',
            actualValue: null,
            achievementRate: null,
            activities: '산출물 완료',
            efforts: '본인 주도 개선',
            evidenceComment: 'https://drive.example.com/score',
            attachments: [],
            submittedAt: new Date('2026-12-31T00:00:00.000Z'),
            isDraft: false,
          },
        ],
      },
    ]
    const blockerEvaluations = [
      {
        id: 'score-blocked-self',
        targetId: 'emp-score-blocked',
        evaluatorId: 'emp-score-blocked',
        evalStage: 'SELF',
        status: 'SUBMITTED',
        items: [
          {
            id: 'score-blocked-item',
            personalKpiId: 'score-blocked-project',
            policyCategory: 'PROJECT_T',
            itemComment: '본인 주도로 산출물을 개선했고 https://drive.example.com/score 를 증빙으로 남겼습니다.',
            targetAchievementLevel: 'EXCELLENT',
            personalKpi: {
              id: 'score-blocked-project',
              kpiName: '비중 초과 프로젝트',
              policyCategory: 'PROJECT_T',
            },
          },
        ],
      },
      { id: 'score-blocked-first', targetId: 'emp-score-blocked', evaluatorId: 'first-evaluator', evalStage: 'FIRST', status: 'SUBMITTED', items: [] },
      { id: 'score-blocked-second', targetId: 'emp-score-blocked', evaluatorId: 'second-evaluator', evalStage: 'SECOND', status: 'SUBMITTED', items: [] },
    ]
    const blockerAssignments = ['FIRST', 'SECOND', 'FINAL'].map((stage) => ({
      id: `score-blocked-${stage}`,
      targetId: 'emp-score-blocked',
      evaluatorId: `${stage.toLowerCase()}-evaluator`,
      evalStage: stage,
      source: 'AUTO',
      evaluator: {
        id: `${stage.toLowerCase()}-evaluator`,
        empName: `${stage} 평가자`,
        empId: `${stage}-001`,
        status: 'ACTIVE',
      },
    }))
    const fake = makeDb({
      employees: blockerEmployees,
      personalKpis: blockerKpis,
      evaluations: blockerEvaluations,
      evaluationAssignments: blockerAssignments,
    })

    const dryRun = await getEvaluation2026ReadinessPopulationDryRun({
      db: fake.db as never,
      evalCycleId: 'cycle-2026',
      env: {} as NodeJS.ProcessEnv,
    })
    const row = dryRun.finalizationCeoReadiness.rows[0]

    assert.equal(row.finalizationReadinessStatus, 'BLOCKED_GRADE_POLICY')
    assert.equal(dryRun.finalizationCeoReadiness.summary.scorePolicyBlockerCount > 0, true)
    assert.equal(row.blockerTypes.includes('GRADE_POLICY'), true)
    assert.equal(dryRun.finalizationCeoReadiness.summary.scorePolicyBlockerCount > 0, true)
    assert.equal(dryRun.finalizationCeoReadiness.summary.gradePolicyBlockerCount > 0, true)
    assert.equal(dryRun.finalizationCeoReadiness.summary.calibrationReadinessBlockerCount > 0, true)
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
    const scheduleSource = read('src/lib/evaluation-2026-schedule-readiness.ts')
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
    assert.equal(clientSource.includes('2026 준비 상태 인원 점검 사전 실행 검토'), true)
    assert.equal(clientSource.includes('이 기능은 사전 실행 검토이며 공식 점수/등급을 변경하지 않습니다.'), true)
    assert.equal(clientSource.includes('2026 MBO 수립 준비 현황'), true)
    assert.equal(clientSource.includes('직원들이 2026 Personal KPI를 작성·제출·확정하는 준비 현황입니다.'), true)
    assert.equal(clientSource.includes('인사 MBO 수립 모니터링'), true)
    assert.equal(clientSource.includes('2026 MBO 후속조치 안내'), true)
    assert.equal(clientSource.includes('이 화면은 HR 후속조치용 안내/복사 도구입니다. 알림 발송, 평가 생성, 점수/등급 변경은 수행하지 않습니다.'), true)
    assert.equal(clientSource.includes('getResultWritingScheduleGuidance'), true)
    assert.equal(scheduleSource.includes('2026 업적목표 수행결과 작성 기간입니다. 수행 결과는 달성 여부가 아니라 본인 기여와 산출물 중심으로 작성해야 합니다.'), true)
    assert.equal(clientSource.includes('Evaluation/EvaluationItem을 생성하지 않습니다.'), true)
    assert.equal(clientSource.includes('2026 MBO 수립을 위해 /kpi/personal에서 개인 KPI를 작성해 주세요.'), true)
    assert.equal(clientSource.includes('작성 중인 2026 MBO 초안을 보완 후 제출해 주세요.'), true)
    assert.equal(clientSource.includes('제출된 팀원 MBO를 검토해 주세요.'), true)
    assert.equal(clientSource.includes('policyCategory 미분류 항목을 ORG_GOAL / PROJECT_T / PROJECT_K / DAILY_WORK 중 하나로 확정해 주세요.'), true)
    assert.equal(clientSource.includes('팀 KPI별로 조직목표 반영 / 일상업무 처리 / 예외 승인 / 논의 필요를 결정해 주세요.'), true)
    assert.equal(clientSource.includes('선택 조건 대상 목록 복사'), true)
    assert.equal(clientSource.includes('후속조치 테이블 복사'), true)
    assert.equal(clientSource.includes("['employeeNo', 'name', 'email', 'division', 'team', 'leader', 'action', 'followUpType', 'detail']"), true)
    assert.equal(clientSource.includes('2026 수행결과 작성 준비 상태'), true)
    assert.equal(clientSource.includes('이 화면은 2026 수행결과 작성 준비 상태를 점검합니다. 공식 점수/등급은 변경되지 않습니다.'), true)
    assert.equal(clientSource.includes('수행결과는 달성 여부만이 아니라 본인 기여, 산출물, 증빙 중심으로 작성해야 합니다.'), true)
    assert.equal(clientSource.includes('AI 활용평가 증빙은 연간 업적점수와 별도로 관리됩니다.'), true)
    assert.equal(clientSource.includes('ORG_GOAL 조직목표'), true)
    assert.equal(clientSource.includes('PROJECT_T 프로젝트 T'), true)
    assert.equal(clientSource.includes('PROJECT_K 프로젝트 K'), true)
    assert.equal(clientSource.includes('DAILY_WORK 일상업무'), true)
    assert.equal(clientSource.includes('리더 검토 확인 목록'), true)
    assert.equal(clientSource.includes('결과 누락 복사'), true)
    assert.equal(clientSource.includes('증빙 누락 복사'), true)
    assert.equal(clientSource.includes('기여 누락 복사'), true)
    assert.equal(clientSource.includes('ORG_GOAL 출처 경고 복사'), true)
    assert.equal(clientSource.includes('DAILY_WORK 중복 위험 복사'), true)
    assert.equal(clientSource.includes('필터된 TSV 복사'), true)
    assert.equal(clientSource.includes('2026 리더 평가 준비 상태'), true)
    assert.equal(clientSource.includes('이 화면은 2026 리더 평가 준비 상태를 읽기 전용으로 점검합니다.'), true)
    assert.equal(clientSource.includes('공식 점수, 등급, 제출, 확정 상태는 변경하지 않습니다.'), true)
    assert.equal(clientSource.includes('1차 평가자 확인 목록'), true)
    assert.equal(clientSource.includes('2차 평가자 확인 목록'), true)
    assert.equal(clientSource.includes('1차 평가 차단 복사'), true)
    assert.equal(clientSource.includes('평가자 누락 복사'), true)
    assert.equal(clientSource.includes('통합 TSV 복사'), true)
    assert.equal(clientSource.includes('2026 최종 확정 준비 상태'), true)
    assert.equal(clientSource.includes('이 화면은 최종 확정 가능 여부를 읽기 전용으로 점검합니다. 공식 점수, 등급, 보정, 대표이사 확정은 수행하지 않습니다.'), true)
    assert.equal(clientSource.includes('대표이사 확정은 공식 점수와 등급 산정, 보정 기준 확인 이후 별도 단계에서 진행합니다.'), true)
    assert.equal(clientSource.includes('Evaluation.totalScore 또는 Evaluation.gradeId를 변경하지 않습니다.'), true)
    assert.equal(clientSource.includes('최종/대표이사 검토 확인 목록'), true)
    assert.equal(clientSource.includes('1차 평가 전 해소 필요 항목 복사'), true)
    assert.equal(clientSource.includes('대표이사 확정 추후 가능 복사'), true)
    assert.equal(clientSource.includes('수동 검토 복사'), true)
    assert.equal(serverSource.includes('LEADER_EVALUATION_READINESS_WARNINGS'), true)
    assert.equal(serverSource.includes('FINALIZATION_CEO_READINESS_WARNINGS'), true)
    assert.equal(serverSource.includes('BLOCKED_SECOND_NOT_READY'), true)
    assert.equal(serverSource.includes('READY_FOR_CEO_CONFIRMATION_LATER'), true)
    assert.equal(serverSource.includes('BLOCKED_SELF_NOT_SUBMITTED'), true)
    assert.equal(serverSource.includes('READY_FOR_SECOND_REVIEW'), true)
    assert.equal(serverSource.includes('RESULT_WRITING_READINESS_WARNINGS'), true)
    assert.equal(serverSource.includes('officialScoringEnabled: false'), true)
    assert.equal(serverSource.includes('officialGradeEnabled: false'), true)
    assert.equal(clientSource.includes('/admin/performance-calendar'), true)
    assert.equal(serverSource.includes('작성 요청 필요'), true)
    assert.equal(serverSource.includes('제출 요청 필요'), true)
    assert.equal(serverSource.includes('리더 검토 필요'), true)
    assert.equal(serverSource.includes('카테고리 확정 필요'), true)
    assert.equal(clientSource.includes('policyCategory 미분류 항목'), true)
    assert.equal(clientSource.includes('navigator.clipboard.writeText'), true)
    assert.equal(clientSource.includes('2026 팀 KPI 검토'), true)
    assert.equal(clientSource.includes('본부 KPI에 포함되거나 HR이 승인한 팀 KPI만 개인 MBO의 조직목표 후보가 됩니다.'), true)
    assert.equal(clientSource.includes('팀 KPI 검토 복사'), true)
    assert.equal(clientSource.includes('/api/evaluation/preview-2026/team-kpi-review-decision'), true)
    assert.equal(clientSource.includes('HR 결정 저장'), true)
    assert.equal(clientSource.includes('미지정/검토 대기만'), true)
    assert.equal(clientSource.includes('선택 항목 일괄 HR 결정'), true)
    assert.equal(clientSource.includes('보이는 항목 전체 선택'), true)
    assert.equal(clientSource.includes('선택 항목 일괄 저장'), true)
    assert.equal(clientSource.includes('2026 성과점수 정책 준비 상태'), true)
    assert.equal(clientSource.includes('조직성과 30% + 개인성과 70%'), true)
    assert.equal(clientSource.includes('점수 시뮬레이터'), true)
    assert.equal(clientSource.includes('위반사항 복사'), true)
    assert.equal(clientSource.includes('조정점은 ±5 범위를 벗어날 수 없습니다.'), true)
    assert.equal(clientSource.includes('Target 미만 달성 시 조정점을 적용하지 않습니다.'), true)
    assert.equal(clientSource.includes('AI 활용평가는 연간 업적평가 점수에서 제외됩니다.'), true)
    assert.equal(serverSource.includes('SCORE_POLICY_READINESS_VIOLATIONS'), true)
    assert.equal(serverSource.includes('ORG_GOAL_ITEM_WEIGHT_CAP_EXCEEDED'), true)
    assert.equal(serverSource.includes('PROJECT_K_ITEM_WEIGHT_CAP_EXCEEDED'), true)
    assert.equal(serverSource.includes('TOTAL_WEIGHT_NOT_100'), true)
    assert.equal(serverSource.includes('APPROVED_FOR_ORG_GOAL'), true)
    assert.equal(serverSource.includes('EXCLUDED_DAILY_WORK'), true)
    assert.equal(serverSource.includes('EXCEPTION_APPROVED'), true)
    assert.equal(serverSource.includes('PENDING_REVIEW'), true)
    assert.equal(serverSource.includes('personalKpiOrgGoalWithoutApprovedSourceCount'), true)
    assert.equal(reviewDecisionRouteSource.includes('export async function PATCH'), true)
    assert.equal(reviewDecisionRouteSource.includes('getServerSession(authOptions)'), true)
    assert.equal(reviewDecisionRouteSource.includes('saveEvaluation2026TeamKpiHrReviewDecisionForSession'), true)
    assert.equal(reviewDecisionRouteSource.includes('saveEvaluation2026TeamKpiHrReviewBulkDecisionForSession'), true)
    assert.equal(decisionServerSource.includes('Evaluation2026TeamKpiHrReviewBulkDecisionSchema'), true)
    assert.equal(decisionServerSource.includes('teamKpiReviewRun.create'), true)
    assert.equal(decisionServerSource.includes('officialScoresChanged: false'), true)
    assert.equal(decisionServerSource.includes('personalKpiPolicyCategoryChanged: false'), true)
    assert.equal(decisionServerSource.includes('evaluationItemPolicyCategoryChanged: false'), true)
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
