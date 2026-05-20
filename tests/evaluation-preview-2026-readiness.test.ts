import './register-path-aliases'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import Module from 'node:module'
import path from 'node:path'
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

function makeSession(role = 'ROLE_ADMIN', id = 'admin-1') {
  return {
    user: {
      id,
      name: role === 'ROLE_ADMIN' ? 'HR Admin' : 'Member User',
      role,
    },
  } as any
}

function makeItem(overrides: Partial<any> = {}) {
  return {
    id: 'eval-item-org',
    policyCategory: 'ORG_GOAL',
    targetAchievementLevel: 'TARGET',
    basePolicyScore: null,
    adjustmentScore: null,
    adjustmentGroupKey: null,
    quantScore: 90,
    qualScore: null,
    planScore: null,
    doScore: null,
    checkScore: null,
    actScore: null,
    weightedScore: 90,
    personalKpi: {
      id: 'kpi-org',
      kpiName: '본부 KPI 연계 목표',
      policyCategory: 'ORG_GOAL',
      kpiType: 'QUANTITATIVE',
      weight: 100,
      linkedOrgKpi: {
        id: 'org-1',
        kpiName: '본부 성장',
        department: {
          deptName: '영업본부',
        },
      },
    },
    ...overrides,
  }
}

function makeEvaluation(overrides: Partial<any> = {}) {
  const base = {
    id: 'eval-ready',
    evalCycleId: 'cycle-2026',
    targetId: 'emp-ready',
    evaluatorId: 'leader-1',
    evalStage: 'FIRST',
    totalScore: 88,
    gradeId: null,
    evalCycle: {
      id: 'cycle-2026',
      orgId: 'org-1',
      cycleName: '2026 상반기',
      evalYear: 2026,
      performanceDesignConfig: {
        policy2026PreviewMappings: {
          salesGroupsByDivisionId: {
            'dept-sales-division': { salesGroup: 'SALES' },
          },
          salesGroupsByEmployeeId: {},
        },
      },
    },
    target: {
      id: 'emp-ready',
      empName: 'Ready Employee',
      position: 'MEMBER',
      role: 'ROLE_MEMBER',
      deptId: 'dept-sales-team',
      jobTitle: '영업 담당',
      teamName: '영업팀',
      department: {
        id: 'dept-sales-team',
        deptName: '영업팀',
        parentDeptId: 'dept-sales-division',
      },
    },
    evaluator: {
      id: 'leader-1',
      empName: 'Leader Reviewer',
      position: 'TEAM_LEADER',
      role: 'ROLE_TEAM_LEADER',
      department: {
        deptName: '영업팀',
      },
    },
    items: [
      makeItem(),
      makeItem({
        id: 'eval-item-project',
        policyCategory: 'PROJECT_T',
        targetAchievementLevel: 'EXCELLENT',
        quantScore: 100,
        personalKpi: {
          id: 'kpi-project',
          kpiName: 'AI 기반 프로젝트 T',
          policyCategory: 'PROJECT_T',
          kpiType: 'QUANTITATIVE',
          weight: 60,
          linkedOrgKpi: null,
        },
      }),
      makeItem({
        id: 'eval-item-daily',
        policyCategory: 'DAILY_WORK',
        targetAchievementLevel: null,
        quantScore: null,
        qualScore: 80,
        planScore: 80,
        doScore: 80,
        checkScore: 80,
        actScore: 80,
        personalKpi: {
          id: 'kpi-daily',
          kpiName: '일상업무 운영',
          policyCategory: 'DAILY_WORK',
          kpiType: 'QUALITATIVE',
          weight: 40,
          linkedOrgKpi: null,
        },
      }),
    ],
  }

  return {
    ...base,
    ...overrides,
    target: {
      ...base.target,
      ...(overrides.target ?? {}),
      department: {
        ...base.target.department,
        ...(overrides.target?.department ?? {}),
      },
    },
    evalCycle: {
      ...base.evalCycle,
      ...(overrides.evalCycle ?? {}),
    },
  }
}

function makeDb(params: {
  evaluations: any[]
  aiAssignment?: any
  onWrite?: () => void
}) {
  const evaluationsById = new Map(params.evaluations.map((evaluation) => [evaluation.id, evaluation]))
  const cyclesById = new Map(params.evaluations.map((evaluation) => [evaluation.evalCycle.id, evaluation.evalCycle]))
  const departmentsById = new Map<string, any>([
    ['dept-division', { id: 'dept-division', deptName: '경영지원본부', parentDeptId: null }],
    ['dept-team', { id: 'dept-team', deptName: '인사팀', parentDeptId: 'dept-division' }],
    ['dept-sales-division', { id: 'dept-sales-division', deptName: '영업본부', parentDeptId: null }],
    ['dept-sales-team', { id: 'dept-sales-team', deptName: '영업팀', parentDeptId: 'dept-sales-division' }],
  ])
  let findManyCount = 0
  let findUniqueCount = 0
  let gateFindFirstCount = 0
  let writeCount = 0

  const writeTrap = async () => {
    writeCount += 1
    params.onWrite?.()
    throw new Error('readiness preview must not write')
  }

  return {
    counts: {
      get findMany() {
        return findManyCount
      },
      get findUnique() {
        return findUniqueCount
      },
      get gateFindFirst() {
        return gateFindFirstCount
      },
      get writes() {
        return writeCount
      },
    },
    db: {
      evaluation: {
        findMany: async (args: any) => {
          findManyCount += 1
          const rows = params.evaluations.filter((evaluation) => {
            if (args?.where?.id) return evaluation.id === args.where.id
            if (args?.where?.evalCycleId) return evaluation.evalCycleId === args.where.evalCycleId
            if (args?.where?.evalCycle?.evalYear) return evaluation.evalCycle.evalYear === args.where.evalCycle.evalYear
            return true
          })
          return rows.slice(0, args?.take ?? rows.length).map((evaluation) => ({ id: evaluation.id }))
        },
        findUnique: async (args: any) => {
          findUniqueCount += 1
          return evaluationsById.get(args?.where?.id) ?? null
        },
        create: writeTrap,
        update: writeTrap,
        upsert: writeTrap,
        delete: writeTrap,
      },
      aiCompetencyGateAssignment: {
        findFirst: async () => {
          gateFindFirstCount += 1
          return params.aiAssignment ?? null
        },
        create: writeTrap,
        update: writeTrap,
        upsert: writeTrap,
        delete: writeTrap,
      },
      department: {
        findMany: async () => Array.from(departmentsById.values()),
        findUnique: async (args: any) => departmentsById.get(args?.where?.id) ?? null,
      },
      evalCycle: {
        findMany: async (args: any) => {
          const rows = Array.from(cyclesById.values()).filter((cycle) => {
            if (args?.where?.orgId && cycle.orgId !== args.where.orgId) return false
            if (args?.where?.evalYear && cycle.evalYear !== args.where.evalYear) return false
            return true
          })
          return rows
        },
        findUnique: async (args: any) => cyclesById.get(args?.where?.id) ?? null,
        update: async (args: any) => {
          writeCount += 1
          const existing = cyclesById.get(args?.where?.id)
          if (!existing) return null
          const updated = {
            ...existing,
            ...args.data,
          }
          cyclesById.set(args.where.id, updated)
          return updated
        },
      },
    } as any,
  }
}

async function main() {
  const {
    getEvaluationPreviewReadinessForSession2026,
    getEvaluationPreviewReadinessSummary2026,
  } = await import('../src/server/evaluation-preview-2026-readiness')
  const {
    updatePolicy2026OfficialReadinessCycleForSession,
  } = await import('../src/server/evaluation-preview-2026-official-cycle')

  await run('readiness uses explicit cycleId and marks unconfirmed test cycle', async () => {
    const fake = makeDb({ evaluations: [makeEvaluation()] })

    const summary = await getEvaluationPreviewReadinessSummary2026({
      db: fake.db,
      cycleId: 'cycle-2026',
    })

    assert.equal(summary.totalEvaluationsChecked, 1)
    assert.equal(summary.cycleScope.selectedCycleId, 'cycle-2026')
    assert.equal(summary.cycleScope.selectionMode, 'explicit_cycle')
    assert.equal(summary.cycleScope.isOfficialReadinessTarget, false)
    assert.equal(Boolean(summary.cycleScope.warning), true)
  })

  await run('readiness warns and does not year-scan when no official cycle is selected', async () => {
    const fake = makeDb({ evaluations: [makeEvaluation()] })

    const summary = await getEvaluationPreviewReadinessSummary2026({
      db: fake.db,
      year: 2026,
    })

    assert.equal(summary.totalEvaluationsChecked, 0)
    assert.equal(summary.cycleScope.selectionMode, 'no_official_cycle')
    assert.equal(summary.cycleScope.isOfficialReadinessTarget, false)
    assert.equal(summary.activationBlockers.some((blocker) => blocker.includes('공식 readiness 대상')), true)
  })

  await run('official readiness marker scopes year lookup to the confirmed cycle only', async () => {
    const official = makeEvaluation({
      id: 'eval-official-cycle',
      evalCycle: {
        id: 'cycle-official',
        cycleName: '2026 공식 평가',
        performanceDesignConfig: {
          policy2026OfficialReadinessEnabled: true,
          policy2026PreviewMappings: {
            salesGroupsByDivisionId: {
              'dept-sales-division': { salesGroup: 'SALES' },
            },
            salesGroupsByEmployeeId: {},
          },
        },
      },
      evalCycleId: 'cycle-official',
    })
    const testCycle = makeEvaluation({
      id: 'eval-test-cycle',
      evalCycle: {
        id: 'cycle-test',
        cycleName: '2026 테스트 평가',
      },
      evalCycleId: 'cycle-test',
    })
    const fake = makeDb({ evaluations: [official, testCycle] })

    const summary = await getEvaluationPreviewReadinessSummary2026({
      db: fake.db,
      year: 2026,
    })

    assert.equal(summary.totalEvaluationsChecked, 1)
    assert.equal(summary.cycleScope.selectedCycleId, 'cycle-official')
    assert.equal(summary.cycleScope.selectedCycleName, '2026 공식 평가')
    assert.equal(summary.cycleScope.isOfficialReadinessTarget, true)
  })

  await run('admin can mark exactly one official readiness cycle for an org/year', async () => {
    const existingOfficial = makeEvaluation({
      id: 'eval-existing-official-cycle',
      evalCycleId: 'cycle-existing-official',
      evalCycle: {
        id: 'cycle-existing-official',
        cycleName: '2026 기존 공식 후보',
        performanceDesignConfig: {
          policy2026OfficialReadinessEnabled: true,
        },
      },
    })
    const nextOfficial = makeEvaluation({
      id: 'eval-next-official-cycle',
      evalCycleId: 'cycle-next-official',
      evalCycle: {
        id: 'cycle-next-official',
        cycleName: '2026 최종 공식 평가',
        performanceDesignConfig: null,
      },
    })
    const fake = makeDb({ evaluations: [existingOfficial, nextOfficial] })

    const result = await updatePolicy2026OfficialReadinessCycleForSession(
      {
        session: makeSession('ROLE_ADMIN'),
        input: {
          evalCycleId: 'cycle-next-official',
          enabled: true,
        },
      },
      {
        db: fake.db,
      }
    )

    assert.equal(result.enabled, true)
    assert.deepEqual(result.disabledOtherCycleIds, ['cycle-existing-official'])
    assert.equal(result.officialScoresChanged, false)
    assert.equal(result.officialGradesChanged, false)
    assert.equal(result.aiScoreExclusionChanged, false)
    assert.equal(result.backfillApplied, false)
    assert.equal(fake.counts.writes, 2)

    const summary = await getEvaluationPreviewReadinessSummary2026({
      db: fake.db,
      year: 2026,
    })
    assert.equal(summary.cycleScope.selectionMode, 'official_cycle')
    assert.equal(summary.cycleScope.selectedCycleId, 'cycle-next-official')
    assert.equal(summary.cycleScope.officialCycleCandidates.length, 1)
  })

  await run('ordinary member cannot mark official readiness cycle', async () => {
    const fake = makeDb({ evaluations: [makeEvaluation()] })

    await assert.rejects(
      () =>
        updatePolicy2026OfficialReadinessCycleForSession(
          {
            session: makeSession('ROLE_MEMBER', 'member-1'),
            input: {
              evalCycleId: 'cycle-2026',
              enabled: true,
            },
          },
          {
            db: fake.db,
          }
        ),
      (error) => error instanceof AppError && error.statusCode === 403
    )
    assert.equal(fake.counts.writes, 0)
  })

  await run('admin can clear official readiness marker without touching scores', async () => {
    const official = makeEvaluation({
      evalCycle: {
        performanceDesignConfig: {
          policy2026OfficialReadinessEnabled: true,
        },
      },
    })
    const fake = makeDb({ evaluations: [official] })

    const result = await updatePolicy2026OfficialReadinessCycleForSession(
      {
        session: makeSession('ROLE_ADMIN'),
        input: {
          evalCycleId: 'cycle-2026',
          enabled: false,
        },
      },
      {
        db: fake.db,
      }
    )

    assert.equal(result.enabled, false)
    assert.equal(result.officialScoresChanged, false)
    assert.equal(result.officialGradesChanged, false)
    assert.equal(fake.counts.writes, 1)

    const summary = await getEvaluationPreviewReadinessSummary2026({
      db: fake.db,
      year: 2026,
    })
    assert.equal(summary.cycleScope.selectionMode, 'no_official_cycle')
  })

  await run('readiness helper counts missing policy category and manual-review records', async () => {
    const missingCategory = makeEvaluation({
      id: 'eval-missing-category',
      targetId: 'emp-missing-category',
      target: {
        id: 'emp-missing-category',
        empName: 'Missing Category',
        jobTitle: '영업 담당',
        teamName: '영업팀',
        department: { deptName: '영업팀' },
      },
      items: [
        makeItem({
          id: 'missing-policy-category',
          policyCategory: null,
          personalKpi: {
            id: 'kpi-missing-category',
            kpiName: '정책 카테고리 미분류 KPI',
            policyCategory: null,
            kpiType: 'QUANTITATIVE',
            weight: 100,
            linkedOrgKpi: null,
          },
        }),
      ],
    })
    const manualReview = makeEvaluation({
      id: 'eval-manual-review',
      targetId: 'emp-manual-review',
      target: {
        id: 'emp-manual-review',
        empName: 'Manual Review',
        jobTitle: '영업 담당',
        teamName: '영업팀',
        department: { deptName: '영업팀' },
      },
      items: [
        makeItem({
          id: 'manual-review-category',
          policyCategory: 'UNKNOWN',
          personalKpi: {
            id: 'kpi-manual-review',
            kpiName: 'UNKNOWN 수동 검토 KPI',
            policyCategory: 'UNKNOWN',
            kpiType: 'QUANTITATIVE',
            weight: 100,
            linkedOrgKpi: null,
          },
        }),
      ],
    })
    const fake = makeDb({ evaluations: [missingCategory, manualReview] })

    const summary = await getEvaluationPreviewReadinessSummary2026({
      db: fake.db,
      cycleId: 'cycle-2026',
    })

    assert.equal(summary.totalEvaluationsChecked, 2)
    assert.equal(summary.missingPolicyCategoryCount, 1)
    assert.equal(summary.manualReviewCount, 1)
    assert.equal(summary.blockedCount, 2)
    assert.equal(summary.samples.some((sample) => sample.issueCode === 'POLICY_CATEGORY_REQUIRED'), true)
    assert.equal(summary.samples.some((sample) => sample.issueCode === 'POLICY_CATEGORY_MANUAL_REVIEW_REQUIRED'), true)
    assert.equal(fake.counts.writes, 0)
  })

  await run('readiness helper counts missing sales/non-sales classification', async () => {
    const evaluation = makeEvaluation({
      id: 'eval-missing-sales-group',
      evalCycle: {
        performanceDesignConfig: {
          policy2026PreviewMappings: {
            salesGroupsByDivisionId: {},
            salesGroupsByEmployeeId: {},
          },
        },
      },
      target: {
        empName: 'No Sales Group',
        deptId: 'dept-team',
        jobTitle: '백오피스',
        teamName: '인사팀',
        department: { id: 'dept-team', deptName: '인사팀', parentDeptId: 'dept-division' },
      },
    })
    const fake = makeDb({ evaluations: [evaluation] })

    const summary = await getEvaluationPreviewReadinessSummary2026({
      db: fake.db,
      cycleId: 'cycle-2026',
    })

    assert.equal(summary.missingSalesClassificationCount, 1)
    assert.equal(summary.samples.some((sample) => sample.issueCode === 'SALES_GROUP_REQUIRED'), true)
  })

  await run('readiness helper counts ambiguous sales threshold confirmation', async () => {
    const evaluation = makeEvaluation({
      id: 'eval-ambiguous-sales-threshold',
    })
    const fake = makeDb({ evaluations: [evaluation] })

    const summary = await getEvaluationPreviewReadinessSummary2026({
      db: fake.db,
      cycleId: 'cycle-2026',
    })

    assert.equal(summary.ambiguousThresholdCount, 1)
    assert.equal(summary.activationBlockers.some((blocker) => blocker.includes('Super/Outstanding')), true)
  })

  await run('readiness helper counts AI insufficient data separately for applicable 2028 targets', async () => {
    const evaluation = makeEvaluation({
      id: 'eval-ai-pending',
      evalCycle: {
        id: 'cycle-2028',
        cycleName: '2028 상반기',
        evalYear: 2028,
      },
      evalCycleId: 'cycle-2028',
    })
    const fake = makeDb({ evaluations: [evaluation] })

    const summary = await getEvaluationPreviewReadinessSummary2026({
      db: fake.db,
      cycleId: 'cycle-2028',
    })

    assert.equal(summary.aiInsufficientDataCount, 1)
    assert.equal(summary.samples.some((sample) => sample.issueCode === 'NO_RECOGNITION_ROUTE_PASSED'), true)
  })

  await run('readiness endpoint core allows HR admin and denies ordinary members before reading evaluations', async () => {
    const fake = makeDb({ evaluations: [makeEvaluation()] })

    const adminSummary = await getEvaluationPreviewReadinessForSession2026(
      {
        session: makeSession('ROLE_ADMIN'),
        cycleId: 'cycle-2026',
      },
      {
        db: fake.db,
      }
    )
    assert.equal(adminSummary.totalEvaluationsChecked, 1)
    assert.equal(fake.counts.findMany, 1)

    await assert.rejects(
      () =>
        getEvaluationPreviewReadinessForSession2026(
          {
            session: makeSession('ROLE_MEMBER', 'member-1'),
            cycleId: 'cycle-2026',
          },
          {
            db: fake.db,
          }
        ),
      (error) => error instanceof AppError && error.statusCode === 403
    )
    assert.equal(fake.counts.findMany, 1)
  })

  await run('readiness API route is GET-only, admin-gated, and does not own DB writes', () => {
    const routeSource = read('src/app/api/evaluation/preview-2026/readiness/route.ts')

    assert.equal(routeSource.includes('export async function GET'), true)
    assert.equal(routeSource.includes('getServerSession(authOptions)'), true)
    assert.equal(routeSource.includes('getEvaluationPreviewReadinessForSession2026'), true)
    assert.equal(routeSource.includes('successResponse(readiness)'), true)
    assert.equal(routeSource.includes('export async function POST'), false)
    assert.equal(routeSource.includes('export async function PATCH'), false)
    assert.equal(routeSource.includes('prisma.'), false)
  })

  await run('official readiness cycle API is PATCH-only and metadata-only', () => {
    const routeSource = read('src/app/api/evaluation/preview-2026/official-readiness-cycle/route.ts')
    const helperSource = read('src/server/evaluation-preview-2026-official-cycle.ts')

    assert.equal(routeSource.includes('export async function PATCH'), true)
    assert.equal(routeSource.includes('getServerSession(authOptions)'), true)
    assert.equal(routeSource.includes('updatePolicy2026OfficialReadinessCycleForSession'), true)
    assert.equal(routeSource.includes('export async function GET'), false)
    assert.equal(routeSource.includes('export async function POST'), false)
    assert.equal(helperSource.includes('writePolicy2026OfficialReadinessEnabledToConfig'), true)
    assert.equal(helperSource.includes('performanceDesignConfig'), true)
    assert.equal(helperSource.includes('totalScore'), true)
    assert.equal(helperSource.includes('gradeId'), true)
    assert.equal(helperSource.includes('officialScoresChanged: false'), true)
    assert.equal(helperSource.includes('officialGradesChanged: false'), true)
    assert.equal(helperSource.includes('backfillApplied: false'), true)
    assert.equal(helperSource.includes('createAuditLog'), false)
  })

  await run('HR/admin readiness UI is preview-only and lists actionable blocker categories', () => {
    const clientSource = read('src/components/evaluation/EvaluationWorkbenchClient.tsx')
    const liveRouteSource = read('src/app/api/evaluation/[id]/route.ts')
    const submitRouteSource = read('src/app/api/evaluation/[id]/submit/route.ts')

    assert.equal(clientSource.includes('2026 평가 전환 준비 상태'), true)
    assert.equal(clientSource.includes('공식 결과에는 반영되지 않습니다.'), true)
    assert.equal(clientSource.includes('/api/evaluation/preview-2026/readiness'), true)
    assert.equal(clientSource.includes('정책 카테고리 미분류'), true)
    assert.equal(clientSource.includes('영업/비영업 구분 필요'), true)
    assert.equal(clientSource.includes('등급 기준 HR 확인 필요'), true)
    assert.equal(clientSource.includes('AI 증빙 부족'), true)
    assert.equal(clientSource.includes('공식 점수 전환이 아니라 readiness 대상 주기 지정입니다.'), true)
    assert.equal(clientSource.includes('/api/evaluation/preview-2026/official-readiness-cycle'), true)
    assert.equal(clientSource.includes('이 주기를 readiness 대상으로 지정'), true)
    assert.equal(clientSource.includes('props.permissions?.canSeeAllInCycle'), true)
    assert.equal(liveRouteSource.includes('preview-2026/readiness'), false)
    assert.equal(submitRouteSource.includes('preview-2026/readiness'), false)
  })

  console.log('2026 evaluation preview readiness tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
