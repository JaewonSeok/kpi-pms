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
  const personalKpi = {
    id: overrides.personalKpiId ?? `kpi-${overrides.id ?? 'org'}`,
    kpiName: '본부 KPI 연계 목표',
    definition: null,
    formula: null,
    tags: null,
    policyCategory: 'ORG_GOAL',
    kpiType: 'QUANTITATIVE',
    weight: 100,
    linkedOrgKpiId: 'org-1',
    linkedOrgKpi: {
      id: 'org-1',
      kpiName: '본부 성장',
      department: {
        deptName: '영업본부',
      },
    },
    ...(overrides.personalKpi ?? {}),
  }

  return {
    id: overrides.id ?? 'eval-item-org',
    evaluationId: 'eval-1',
    personalKpiId: personalKpi.id,
    policyCategory: 'ORG_GOAL',
    scoreContributionType: null,
    policyFormulaVersion: null,
    basePolicyScore: null,
    adjustmentScore: null,
    adjustmentGroupKey: null,
    targetAchievementLevel: 'TARGET',
    quantScore: 90,
    qualScore: null,
    planScore: null,
    doScore: null,
    checkScore: null,
    actScore: null,
    weightedScore: 90,
    personalKpi,
    ...overrides,
  }
}

function makeEvaluation(overrides: Partial<any> = {}) {
  const evalCycle = {
    id: overrides.evalCycleId ?? 'cycle-2026',
    cycleName: '2026 상반기',
    evalYear: 2026,
    performanceDesignConfig: null as any,
    ...(overrides.evalCycle ?? {}),
  }
  const target = {
    id: overrides.targetId ?? 'emp-target',
    empName: 'Target Employee',
    position: 'MEMBER',
    role: 'ROLE_MEMBER',
    jobTitle: '백오피스',
    teamName: '인사팀',
    department: {
      deptName: '인사팀',
    },
    ...(overrides.target ?? {}),
  }

  return {
    id: overrides.id ?? 'eval-1',
    evalCycleId: evalCycle.id,
    targetId: target.id,
    evaluatorId: 'leader-1',
    evalStage: 'FIRST',
    totalScore: 88,
    gradeId: 'grade-official',
    evalCycle,
    target,
    items: overrides.items ?? [
      makeItem({
        id: 'missing-policy-category',
        policyCategory: null,
        personalKpi: {
          id: 'kpi-missing',
          kpiName: '정책 카테고리 미분류 KPI',
          policyCategory: null,
          linkedOrgKpiId: 'org-1',
        },
      }),
      makeItem({
        id: 'daily-work',
        policyCategory: 'DAILY_WORK',
        targetAchievementLevel: null,
        quantScore: null,
        qualScore: 80,
        personalKpi: {
          id: 'kpi-daily',
          kpiName: '일상업무 운영',
          policyCategory: 'DAILY_WORK',
          kpiType: 'QUALITATIVE',
          weight: 40,
          linkedOrgKpiId: null,
          linkedOrgKpi: null,
        },
      }),
    ],
  }
}

function makeDb(evaluations: any[]) {
  const cycles = new Map<string, any>()
  const evaluationsById = new Map<string, any>()
  const itemsById = new Map<string, any>()
  const personalKpisById = new Map<string, any>()
  const writes = {
    evaluation: 0,
    evaluationItem: 0,
    personalKpi: 0,
    evalCycle: 0,
    audit: 0,
  }

  for (const evaluation of evaluations) {
    evaluationsById.set(evaluation.id, evaluation)
    cycles.set(evaluation.evalCycleId, evaluation.evalCycle)
    for (const item of evaluation.items) {
      item.evaluationId = evaluation.id
      item.personalKpiId = item.personalKpi.id
      itemsById.set(item.id, item)
      personalKpisById.set(item.personalKpi.id, item.personalKpi)
    }
  }

  const db = {
    evaluation: {
      findMany: async (args: any) => {
        const rows = evaluations.filter((evaluation) => {
          if (args?.where?.evalCycleId) return evaluation.evalCycleId === args.where.evalCycleId
          if (args?.where?.evalCycle?.evalYear) return evaluation.evalCycle.evalYear === args.where.evalCycle.evalYear
          return true
        })
        if (args?.select?.id && !args.include) return rows.map((evaluation) => ({ id: evaluation.id }))
        return rows
      },
      findUnique: async (args: any) => evaluationsById.get(args?.where?.id) ?? null,
      count: async (args: any) =>
        evaluations.filter((evaluation) => {
          if (args?.where?.evalCycleId && evaluation.evalCycleId !== args.where.evalCycleId) return false
          if (args?.where?.targetId && evaluation.targetId !== args.where.targetId) return false
          return true
        }).length,
      update: async () => {
        writes.evaluation += 1
        throw new Error('official evaluation result must not be written')
      },
    },
    evaluationItem: {
      findUnique: async (args: any) => {
        const item = itemsById.get(args?.where?.id)
        if (!item) return null
        const evaluation = evaluationsById.get(item.evaluationId)
        return {
          ...item,
          evaluation: {
            id: evaluation.id,
            evalCycleId: evaluation.evalCycleId,
            totalScore: evaluation.totalScore,
            gradeId: evaluation.gradeId,
          },
        }
      },
      update: async (args: any) => {
        writes.evaluationItem += 1
        const item = itemsById.get(args.where.id)
        Object.assign(item, args.data)
        return item
      },
    },
    personalKpi: {
      update: async (args: any) => {
        writes.personalKpi += 1
        const personalKpi = personalKpisById.get(args.where.id)
        Object.assign(personalKpi, args.data)
        return personalKpi
      },
    },
    evalCycle: {
      findUnique: async (args: any) => cycles.get(args?.where?.id) ?? null,
      update: async (args: any) => {
        writes.evalCycle += 1
        const cycle = cycles.get(args.where.id)
        Object.assign(cycle, args.data)
        return cycle
      },
    },
    aiCompetencyGateAssignment: {
      findFirst: async () => null,
    },
  } as any

  return {
    db,
    writes,
    audit: async () => {
      writes.audit += 1
    },
    getEvaluation: (id: string) => evaluationsById.get(id),
  }
}

async function main() {
  const {
    getEvaluationPolicy2026MappingCandidatesForSession,
    updateEvaluationPolicy2026MetadataForSession,
  } = await import('../src/server/evaluation-preview-2026-mapping')
  const {
    getEvaluationPreviewReadinessSummary2026,
  } = await import('../src/server/evaluation-preview-2026-readiness')

  await run('admin can list 2026 policy mapping candidates', async () => {
    const fake = makeDb([makeEvaluation()])
    const payload = await getEvaluationPolicy2026MappingCandidatesForSession(
      {
        session: makeSession('ROLE_ADMIN'),
        cycleId: 'cycle-2026',
      },
      { db: fake.db }
    )

    assert.equal(payload.policyCategoryCandidates.length, 1)
    assert.equal(payload.policyCategoryCandidates[0].evaluationItemId, 'missing-policy-category')
    assert.equal(payload.salesGroupCandidates.length, 1)
    assert.equal(payload.persistence.salesGroup.includes('performanceDesignConfig'), true)
  })

  await run('ordinary member cannot list mapping candidates', async () => {
    const fake = makeDb([makeEvaluation()])
    await assert.rejects(
      () =>
        getEvaluationPolicy2026MappingCandidatesForSession(
          {
            session: makeSession('ROLE_MEMBER', 'member-1'),
            cycleId: 'cycle-2026',
          },
          { db: fake.db }
        ),
      (error) => error instanceof AppError && error.statusCode === 403
    )
  })

  await run('admin can update policy metadata without changing official totalScore or grade', async () => {
    const evaluation = makeEvaluation()
    const fake = makeDb([evaluation])
    await updateEvaluationPolicy2026MetadataForSession(
      {
        session: makeSession('ROLE_ADMIN'),
        input: {
          itemMappings: [
            {
              evaluationItemId: 'missing-policy-category',
              personalKpiId: 'kpi-missing',
              category: 'ORG_GOAL',
              note: 'HR confirmed as organization goal',
            },
          ],
          salesGroupMappings: [
            {
              evalCycleId: 'cycle-2026',
              employeeId: 'emp-target',
              salesGroup: 'NON_SALES',
              note: 'HR confirmed non-sales',
            },
          ],
          thresholdDecisions: [],
        },
      },
      {
        db: fake.db,
        audit: fake.audit,
      }
    )

    const updated = fake.getEvaluation('eval-1')
    assert.equal(updated.totalScore, 88)
    assert.equal(updated.gradeId, 'grade-official')
    assert.equal(updated.items[0].policyCategory, 'ORG_GOAL')
    assert.equal(updated.items[0].scoreContributionType, 'ORGANIZATION')
    assert.equal(updated.items[0].personalKpi.policyCategory, 'ORG_GOAL')
    assert.equal(fake.writes.evaluation, 0)
    assert.equal(fake.writes.evaluationItem, 1)
    assert.equal(fake.writes.personalKpi, 1)
    assert.equal(fake.writes.evalCycle, 1)
    assert.equal(fake.writes.audit, 2)
  })

  await run('ordinary member cannot update metadata', async () => {
    const fake = makeDb([makeEvaluation()])
    await assert.rejects(
      () =>
        updateEvaluationPolicy2026MetadataForSession(
          {
            session: makeSession('ROLE_MEMBER', 'member-1'),
            input: {
              itemMappings: [
                {
                  evaluationItemId: 'missing-policy-category',
                  category: 'ORG_GOAL',
                },
              ],
              salesGroupMappings: [],
              thresholdDecisions: [],
            },
          },
          { db: fake.db, audit: fake.audit }
        ),
      (error) => error instanceof AppError && error.statusCode === 403
    )
    assert.equal(fake.writes.evaluationItem, 0)
    assert.equal(fake.writes.personalKpi, 0)
  })

  await run('UNKNOWN remains unresolved unless HR explicitly maps it', async () => {
    const fake = makeDb([makeEvaluation()])
    await updateEvaluationPolicy2026MetadataForSession(
      {
        session: makeSession('ROLE_ADMIN'),
        input: {
          itemMappings: [
            {
              evaluationItemId: 'missing-policy-category',
              personalKpiId: 'kpi-missing',
              category: 'KEEP_UNCLASSIFIED',
            },
          ],
          salesGroupMappings: [],
          thresholdDecisions: [],
        },
      },
      { db: fake.db, audit: fake.audit }
    )

    const updated = fake.getEvaluation('eval-1')
    assert.equal(updated.items[0].policyCategory, null)
    assert.equal(updated.items[0].personalKpi.policyCategory, null)
  })

  await run('sales/non-sales is not defaulted silently and readiness improves after explicit mapping', async () => {
    const evaluation = makeEvaluation()
    const fake = makeDb([evaluation])
    const before = await getEvaluationPreviewReadinessSummary2026({
      db: fake.db,
      cycleId: 'cycle-2026',
    })
    assert.equal(before.missingPolicyCategoryCount, 1)
    assert.equal(before.missingSalesClassificationCount, 1)

    await updateEvaluationPolicy2026MetadataForSession(
      {
        session: makeSession('ROLE_ADMIN'),
        input: {
          itemMappings: [
            {
              evaluationItemId: 'missing-policy-category',
              personalKpiId: 'kpi-missing',
              category: 'ORG_GOAL',
            },
          ],
          salesGroupMappings: [
            {
              evalCycleId: 'cycle-2026',
              employeeId: 'emp-target',
              salesGroup: 'NON_SALES',
            },
          ],
          thresholdDecisions: [],
        },
      },
      { db: fake.db, audit: fake.audit }
    )

    const after = await getEvaluationPreviewReadinessSummary2026({
      db: fake.db,
      cycleId: 'cycle-2026',
    })
    assert.equal(after.missingPolicyCategoryCount, 0)
    assert.equal(after.missingSalesClassificationCount, 0)
  })

  await run('threshold decision resolves sales member Super/Outstanding ambiguity for preview only', async () => {
    const evaluation = makeEvaluation({
      id: 'eval-sales',
      target: {
        id: 'emp-sales',
        empName: 'Sales Member',
        jobTitle: '영업 담당',
        teamName: '영업팀',
        department: { deptName: '영업팀' },
      },
      items: [
        makeItem(),
        makeItem({
          id: 'project-t',
          policyCategory: 'PROJECT_T',
          targetAchievementLevel: 'EXCELLENT',
          personalKpi: {
            id: 'kpi-project',
            kpiName: '프로젝트 T',
            policyCategory: 'PROJECT_T',
            kpiType: 'QUANTITATIVE',
            weight: 60,
            linkedOrgKpiId: null,
            linkedOrgKpi: null,
          },
        }),
        makeItem({
          id: 'daily',
          policyCategory: 'DAILY_WORK',
          targetAchievementLevel: null,
          quantScore: null,
          qualScore: 80,
          personalKpi: {
            id: 'kpi-daily-sales',
            kpiName: '일상업무',
            policyCategory: 'DAILY_WORK',
            kpiType: 'QUALITATIVE',
            weight: 40,
            linkedOrgKpiId: null,
            linkedOrgKpi: null,
          },
        }),
      ],
    })
    const fake = makeDb([evaluation])
    const before = await getEvaluationPreviewReadinessSummary2026({
      db: fake.db,
      cycleId: 'cycle-2026',
    })
    assert.equal(before.ambiguousThresholdCount, 1)

    await updateEvaluationPolicy2026MetadataForSession(
      {
        session: makeSession('ROLE_ADMIN'),
        input: {
          itemMappings: [],
          salesGroupMappings: [],
          thresholdDecisions: [
            {
              evalCycleId: 'cycle-2026',
              decision: 'SUPER_PRIORITY',
            },
          ],
        },
      },
      { db: fake.db, audit: fake.audit }
    )

    const after = await getEvaluationPreviewReadinessSummary2026({
      db: fake.db,
      cycleId: 'cycle-2026',
    })
    assert.equal(after.ambiguousThresholdCount, 0)
    assert.equal(fake.writes.evaluation, 0)
  })

  await run('mapping APIs and UI remain preview-only and admin-gated', () => {
    const candidatesRoute = read('src/app/api/evaluation/preview-2026/mapping-candidates/route.ts')
    const metadataRoute = read('src/app/api/evaluation/preview-2026/policy-metadata/route.ts')
    const clientSource = read('src/components/evaluation/EvaluationWorkbenchClient.tsx')
    const liveRouteSource = read('src/app/api/evaluation/[id]/route.ts')
    const submitRouteSource = read('src/app/api/evaluation/[id]/submit/route.ts')

    assert.equal(candidatesRoute.includes('export async function GET'), true)
    assert.equal(candidatesRoute.includes('getEvaluationPolicy2026MappingCandidatesForSession'), true)
    assert.equal(metadataRoute.includes('export async function PATCH'), true)
    assert.equal(metadataRoute.includes('EvaluationPolicy2026MetadataPatchSchema'), true)
    assert.equal(clientSource.includes('2026 정책 매핑 관리'), true)
    assert.equal(clientSource.includes('공식 평가 결과에는 반영되지 않습니다.'), true)
    assert.equal(clientSource.includes('/api/evaluation/preview-2026/mapping-candidates'), true)
    assert.equal(clientSource.includes('/api/evaluation/preview-2026/policy-metadata'), true)
    assert.equal(liveRouteSource.includes('policy-metadata'), false)
    assert.equal(submitRouteSource.includes('policy-metadata'), false)
  })

  console.log('2026 evaluation preview mapping tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
