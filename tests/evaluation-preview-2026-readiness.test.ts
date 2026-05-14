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

const {
  getEvaluationPreviewReadinessForSession2026,
  getEvaluationPreviewReadinessSummary2026,
} = require('../src/server/evaluation-preview-2026-readiness') as typeof import('../src/server/evaluation-preview-2026-readiness')

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
      cycleName: '2026 상반기',
      evalYear: 2026,
    },
    target: {
      id: 'emp-ready',
      empName: 'Ready Employee',
      position: 'MEMBER',
      role: 'ROLE_MEMBER',
      jobTitle: '영업 담당',
      teamName: '영업팀',
      department: {
        deptName: '영업팀',
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
    } as any,
  }
}

async function main() {
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
      target: {
        empName: 'No Sales Group',
        jobTitle: '백오피스',
        teamName: '인사팀',
        department: { deptName: '인사팀' },
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
      year: 2028,
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
