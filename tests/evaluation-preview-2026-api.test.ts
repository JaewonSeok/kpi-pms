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

function makeEvaluation(overrides: Partial<any> = {}) {
  return {
    id: 'eval-1',
    evalCycleId: 'cycle-1',
    targetId: 'emp-target',
    evaluatorId: 'leader-1',
    evalStage: 'FIRST',
    totalScore: 88,
    gradeId: null,
    evalCycle: {
      id: 'cycle-1',
      cycleName: '2026 상반기',
      evalYear: 2026,
    },
    target: {
      id: 'emp-target',
      empName: 'Target Employee',
      position: 'TEAM_LEADER',
      role: 'ROLE_TEAM_LEADER',
      jobTitle: '영업 리더',
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
      {
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
      },
      {
        id: 'eval-item-project',
        policyCategory: 'PROJECT_T',
        targetAchievementLevel: 'EXCELLENT',
        basePolicyScore: null,
        adjustmentScore: null,
        adjustmentGroupKey: null,
        quantScore: 100,
        qualScore: null,
        planScore: null,
        doScore: null,
        checkScore: null,
        actScore: null,
        weightedScore: 60,
        personalKpi: {
          id: 'kpi-project',
          kpiName: 'AI 기반 프로젝트 T',
          policyCategory: 'PROJECT_T',
          kpiType: 'QUANTITATIVE',
          weight: 60,
          linkedOrgKpi: null,
        },
      },
      {
        id: 'eval-item-daily',
        policyCategory: 'DAILY_WORK',
        targetAchievementLevel: null,
        basePolicyScore: null,
        adjustmentScore: null,
        adjustmentGroupKey: null,
        quantScore: null,
        qualScore: 80,
        planScore: 80,
        doScore: 80,
        checkScore: 80,
        actScore: 80,
        weightedScore: 32,
        personalKpi: {
          id: 'kpi-daily',
          kpiName: '일상업무 운영',
          policyCategory: 'DAILY_WORK',
          kpiType: 'QUALITATIVE',
          weight: 40,
          linkedOrgKpi: null,
        },
      },
    ],
    ...overrides,
  }
}

function makeDb(params: {
  evaluation?: any
  onWrite?: () => void
} = {}) {
  const evaluation = params.evaluation ?? makeEvaluation()
  let evaluationFindUniqueCount = 0
  let gateFindFirstCount = 0

  return {
    counts: {
      get evaluationFindUnique() {
        return evaluationFindUniqueCount
      },
      get gateFindFirst() {
        return gateFindFirstCount
      },
    },
    db: {
      evaluation: {
        findUnique: async () => {
          evaluationFindUniqueCount += 1
          return evaluation
        },
        update: async () => {
          params.onWrite?.()
          throw new Error('preview must not write evaluation')
        },
      },
      aiCompetencyGateAssignment: {
        findFirst: async () => {
          gateFindFirstCount += 1
          return {
            id: 'ai-gate-assignment-1',
            status: 'PASSED',
            submissionCase: null,
          }
        },
        update: async () => {
          params.onWrite?.()
          throw new Error('preview must not write ai gate')
        },
      },
    } as any,
  }
}

async function main() {
  const {
    canAccessEvaluationPreview2026,
    getEvaluationPreview2026ForSession,
  } = await import('../src/server/evaluation-preview-2026-loader')

  await run('HR admin can access the 2026 preview API core', async () => {
    const fake = makeDb()
    const payload = await getEvaluationPreview2026ForSession(
      {
        session: makeSession('ROLE_ADMIN'),
        evaluationId: 'eval-1',
      },
      {
        db: fake.db,
      }
    )

    assert.equal(canAccessEvaluationPreview2026(makeSession('ROLE_ADMIN')), true)
    assert.equal(payload.evaluation.id, 'eval-1')
    assert.equal(payload.preview.isPreview, true)
    assert.equal(payload.preview.canCalculate, true)
    assert.equal(payload.preview.score.finalScore, 91.4)
    assert.equal(payload.preview.grade.calculatedGrade, 'Excellent')
    assert.equal(payload.preview.ai.includedInAnnualScore, false)
    assert.equal(payload.preview.ai.levelUpRequirementStatus, 'not_applicable')
    assert.equal(fake.counts.evaluationFindUnique, 1)
    assert.equal(fake.counts.gateFindFirst, 1)
  })

  await run('ordinary member cannot access the preview API core for another employee', async () => {
    const fake = makeDb()
    assert.equal(canAccessEvaluationPreview2026(makeSession('ROLE_MEMBER', 'member-1')), false)

    await assert.rejects(
      () =>
        getEvaluationPreview2026ForSession(
          {
            session: makeSession('ROLE_MEMBER', 'member-1'),
            evaluationId: 'eval-1',
          },
          {
            db: fake.db,
          }
        ),
      (error) => error instanceof AppError && error.statusCode === 403
    )
    assert.equal(fake.counts.evaluationFindUnique, 0)
  })

  await run('preview API core returns readiness issues instead of fabricating missing category data', async () => {
    const evaluation = makeEvaluation({
      items: [
        {
          ...makeEvaluation().items[0],
          id: 'eval-item-missing-category',
          policyCategory: null,
          personalKpi: {
            ...makeEvaluation().items[0].personalKpi,
            policyCategory: null,
            kpiName: '정책 카테고리 미분류 KPI',
          },
        },
      ],
    })
    const fake = makeDb({ evaluation })
    const payload = await getEvaluationPreview2026ForSession(
      {
        session: makeSession('ROLE_ADMIN'),
        evaluationId: 'eval-1',
      },
      {
        db: fake.db,
      }
    )

    assert.equal(payload.preview.canCalculate, false)
    assert.equal(payload.preview.issues.some((issue) => issue.code === 'POLICY_CATEGORY_REQUIRED'), true)
  })

  await run('preview API core does not mutate evaluation or AI gate data', async () => {
    let writeCount = 0
    const fake = makeDb({
      onWrite: () => {
        writeCount += 1
      },
    })

    await getEvaluationPreview2026ForSession(
      {
        session: makeSession('ROLE_ADMIN'),
        evaluationId: 'eval-1',
      },
      {
        db: fake.db,
      }
    )

    assert.equal(writeCount, 0)
  })

  await run('preview API route is GET-only and wired through the admin-only preview loader', () => {
    const routeSource = read('src/app/api/evaluation/[id]/preview-2026/route.ts')

    assert.equal(routeSource.includes('export async function GET'), true)
    assert.equal(routeSource.includes('getServerSession(authOptions)'), true)
    assert.equal(routeSource.includes('getEvaluationPreview2026ForSession'), true)
    assert.equal(routeSource.includes('successResponse(preview)'), true)
    assert.equal(routeSource.includes('export async function PATCH'), false)
    assert.equal(routeSource.includes('prisma.'), false)
  })

  await run('minimal HR/admin preview UI is clearly marked and isolated from official result UI', () => {
    const clientSource = read('src/components/evaluation/EvaluationWorkbenchClient.tsx')
    const liveRouteSource = read('src/app/api/evaluation/[id]/route.ts')
    const submitRouteSource = read('src/app/api/evaluation/[id]/submit/route.ts')

    assert.equal(clientSource.includes('2026 평가 미리보기'), true)
    assert.equal(clientSource.includes('공식 평가 결과가 아닙니다.'), true)
    assert.equal(clientSource.includes('/api/evaluation/${selected.id}/preview-2026'), true)
    assert.equal(clientSource.includes('props.permissions?.canSeeAllInCycle'), true)
    assert.equal(clientSource.includes('정책 카테고리 미분류'), true)
    assert.equal(clientSource.includes('조직성과 split 부족'), true)
    assert.equal(clientSource.includes('등급 threshold 정책 확인 필요'), true)
    assert.equal(clientSource.includes('AI 증빙 부족'), true)
    assert.equal(clientSource.includes('MetricCard label="저장 점수"'), true)
    assert.equal(clientSource.includes('selected.totalScore?.toFixed(1)'), true)
    assert.equal(liveRouteSource.includes('preview-2026'), false)
    assert.equal(submitRouteSource.includes('preview-2026'), false)
  })

  console.log('2026 evaluation preview API and UI tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
