import './register-path-aliases'
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

type TestScoreBand = {
  minInclusive?: number
  maxExclusive?: number
  selectionOnly?: boolean
  requiresPolicyConfirmation?: boolean
  note?: string
}

function expectedSelectionRule(band: TestScoreBand | undefined) {
  if (!band) return 'NOT_APPLICABLE'
  if (band.selectionOnly) return 'SELECTION_ONLY'
  if (band.requiresPolicyConfirmation) return 'HR_CONFIRMATION_REQUIRED'
  return null
}

function makeStoredRows(params: {
  orgId?: string
  evalYear?: number
  overrides?: Array<Record<string, unknown>>
} = {}) {
  const orgId = params.orgId ?? 'org-1'
  const evalYear = params.evalYear ?? 2026
  const rows = EVALUATION_POLICY_2026.gradeThresholdGroups.flatMap((group) =>
    EVALUATION_POLICY_2026.grades.map((grade) => {
      const band = group.thresholds[grade.code] as TestScoreBand | undefined
      return {
        id: `${group.group}-${grade.code}`,
        orgId,
        evalYear,
        policyVersion: EVALUATION_POLICY_2026.version,
        thresholdGroup: group.group,
        gradeLabel: grade.code,
        displayName: `${group.label} - ${grade.label}`,
        minScore: typeof band?.minInclusive === 'number' ? band.minInclusive : null,
        maxScore: typeof band?.maxExclusive === 'number' ? band.maxExclusive : null,
        lowerBoundInclusive: true,
        upperBoundInclusive: false,
        selectionRule: expectedSelectionRule(band),
        notes: band?.note ?? null,
        isActive: true,
      }
    })
  )

  return rows.map((row) => {
    const override = params.overrides?.find(
      (item) => item.thresholdGroup === row.thresholdGroup && item.gradeLabel === row.gradeLabel
    )
    return {
      ...row,
      ...override,
    }
  })
}

function makeCycle(performanceDesignConfig: unknown = {
  policy2026OfficialReadinessEnabled: true,
  policy2026PreviewMappings: {},
}) {
  return {
    id: 'cycle-2026',
    orgId: 'org-1',
    cycleName: '2026 공식 평가',
    evalYear: 2026,
    performanceDesignConfig,
  }
}

function makeDb(params: {
  cycle?: Record<string, unknown> | null
  storedRows?: Array<Record<string, unknown>>
  gradePolicyError?: unknown
} = {}) {
  const counts = {
    evalCycleFindUnique: 0,
    gradePolicyFindMany: 0,
    gradePolicyUpsert: 0,
    forbiddenWrites: 0,
  }
  const upsertedRows: Array<Record<string, unknown>> = []
  const cycle = params.cycle === null ? null : makeCycle(params.cycle?.performanceDesignConfig)
  const db = {
    evalCycle: {
      findUnique: async () => {
        counts.evalCycleFindUnique += 1
        return cycle
      },
    },
    evaluationGradePolicy: {
      findMany: async () => {
        counts.gradePolicyFindMany += 1
        if (params.gradePolicyError) {
          throw params.gradePolicyError
        }
        return params.storedRows ?? []
      },
      upsert: async (args: { create: Record<string, unknown> }) => {
        counts.gradePolicyUpsert += 1
        upsertedRows.push(args.create)
        return args.create
      },
    },
    evaluation: {
      update: async () => {
        counts.forbiddenWrites += 1
        throw new Error('grade policy readiness must not update evaluations')
      },
    },
  }

  return { db: db as unknown, counts, upsertedRows }
}

function makeFlags(overrides: Record<string, unknown> = {}) {
  return {
    previewEnabled: true,
    officialScoringEnabled: true,
    officialGradeEnabled: true,
    aiScoreExclusionEnabled: true,
    backfillApplied: true,
    backfillExcluded: false,
    hrApprovalConfirmed: true,
    ...overrides,
  }
}

function readyMigration() {
  return {
    requiredSchemaPresent: true,
    migrationApplied: true,
    migrationHistoryTableExists: true,
    migrationName: '20260514_phase0_2026_policy_prep',
    missingFields: [],
    checkedVia: 'provided' as const,
  }
}

function readySummary() {
  return {
    policyVersion: '2026-PPT',
    generatedAt: '2026-05-14T00:00:00.000Z',
    filters: {
      cycleId: 'cycle-2026',
      limit: 200,
    },
    cycleScope: {
      requestedYear: 2026,
      requestedCycleId: 'cycle-2026',
      selectedCycleId: 'cycle-2026',
      selectedCycleName: '2026 공식 평가',
      selectedCycleYear: 2026,
      selectionMode: 'explicit_cycle' as const,
      isOfficialReadinessTarget: true,
      officialCycleCandidates: [],
      warning: null,
    },
    totalEvaluationsChecked: 1,
    canCalculateCount: 1,
    blockedCount: 0,
    missingPolicyCategoryCount: 0,
    manualReviewCount: 0,
    missingSalesClassificationCount: 0,
    missingOrgMasterDivisionSalesMappingCount: 0,
    ambiguousThresholdCount: 0,
    aiInsufficientDataCount: 0,
    samples: [],
    activationBlockers: [],
  }
}

async function main() {
  const {
    getEvaluation2026GradePolicyReadiness,
    saveEvaluation2026GradePolicyMetadataForSession,
  } = await import('../src/server/evaluation-2026-grade-policy-readiness')
  const {
    getEvaluation2026ActivationReadiness,
  } = await import('../src/server/evaluation-2026-activation-readiness')

  await run('grade policy readiness lists all PPT groups and missing stored policy rows', async () => {
    const fake = makeDb()
    const readiness = await getEvaluation2026GradePolicyReadiness({
      db: fake.db as never,
      evalCycleId: 'cycle-2026',
      env: {} as NodeJS.ProcessEnv,
    })

    assert.equal(readiness.groups.length, 5)
    assert.deepEqual(readiness.groups.map((group) => group.group), [
      'TEAM_MEMBER_NON_SALES',
      'TEAM_SECTION_LEADER_NON_SALES',
      'TEAM_MEMBER_SALES',
      'TEAM_SECTION_LEADER_SALES',
      'DIVISION_HEAD',
    ])
    assert.equal(readiness.expectedRowsCount, 30)
    assert.equal(readiness.storedRowsCount, 0)
    assert.equal(readiness.gradePolicyExists, false)
    assert.equal(readiness.missingRowsCount, 30)
    assert.equal(readiness.blockers.some((blocker) => blocker.code === 'GRADE_POLICY_ROW_MISSING'), true)
    assert.equal(readiness.safety.officialScoringEnabled, false)
    assert.equal(readiness.safety.officialGradeEnabled, false)
    assert.equal(readiness.safety.totalScoreChanged, false)
    assert.equal(readiness.safety.gradeIdChanged, false)
    assert.equal(fake.counts.forbiddenWrites, 0)
  })

  await run('stored PPT baseline is complete but unresolved TEAM_MEMBER_SALES ambiguity remains a blocker', async () => {
    const fake = makeDb({
      storedRows: makeStoredRows(),
    })
    const readiness = await getEvaluation2026GradePolicyReadiness({
      db: fake.db as never,
      evalCycleId: 'cycle-2026',
      env: {} as NodeJS.ProcessEnv,
    })

    assert.equal(readiness.gradePolicyExists, true)
    assert.equal(readiness.gradePolicyGroupsComplete, true)
    assert.equal(readiness.differsFromPptCount, 0)
    assert.equal(readiness.teamMemberSalesAmbiguity.requiresDecision, true)
    assert.equal(
      readiness.blockers.some((blocker) => blocker.code === 'TEAM_MEMBER_SALES_THRESHOLD_AMBIGUITY'),
      true
    )
    assert.equal(
      readiness.groups.find((group) => group.group === 'TEAM_MEMBER_SALES')?.requiresHrConfirmation,
      true
    )
  })

  await run('HR decision resolves TEAM_MEMBER_SALES ambiguity while preserving metadata-only safety', async () => {
    const fake = makeDb({
      cycle: {
        performanceDesignConfig: {
          policy2026PreviewMappings: {
            teamMemberSalesThresholdDecision: {
              decision: 'SUPER_PRIORITY',
              note: 'HR confirmed Super priority for 110+',
            },
          },
        },
      },
      storedRows: makeStoredRows(),
    })

    const readiness = await getEvaluation2026GradePolicyReadiness({
      db: fake.db as never,
      evalCycleId: 'cycle-2026',
      env: {} as NodeJS.ProcessEnv,
    })

    assert.equal(readiness.teamMemberSalesAmbiguity.requiresDecision, false)
    assert.equal(readiness.blockers.length, 0)
    assert.equal(readiness.safety.officialGradesChanged, false)
    assert.equal(readiness.safety.evaluationsCreated, 0)
    assert.equal(readiness.safety.evaluationItemsCreated, 0)
  })

  await run('stored threshold differences and overlaps are detected as readiness blockers', async () => {
    const fake = makeDb({
      storedRows: makeStoredRows({
        overrides: [
          {
            thresholdGroup: 'TEAM_SECTION_LEADER_SALES',
            gradeLabel: 'GOOD',
            minScore: 75,
          },
          {
            thresholdGroup: 'TEAM_SECTION_LEADER_SALES',
            gradeLabel: 'NEED_IMPROVEMENT',
            maxScore: 82,
          },
        ],
      }),
    })

    const readiness = await getEvaluation2026GradePolicyReadiness({
      db: fake.db as never,
      evalCycleId: 'cycle-2026',
      env: {} as NodeJS.ProcessEnv,
    })

    assert.equal(readiness.differsFromPptCount >= 1, true)
    assert.equal(readiness.overlapCount >= 1, true)
    assert.equal(readiness.blockers.some((blocker) => blocker.code === 'GRADE_POLICY_DIFFERS_FROM_PPT'), true)
    assert.equal(readiness.blockers.some((blocker) => blocker.code === 'GRADE_POLICY_THRESHOLD_OVERLAP'), true)
  })

  await run('Prisma schema compatibility error returns blocker instead of throwing', async () => {
    const fake = makeDb({
      gradePolicyError: {
        code: 'P2022',
        message: 'The column `evaluation_grade_policies.selectionRule` does not exist in the current database.',
        meta: {
          column: 'evaluation_grade_policies.selectionRule',
        },
      },
    })

    const readiness = await getEvaluation2026GradePolicyReadiness({
      db: fake.db as never,
      evalCycleId: 'cycle-2026',
      env: {} as NodeJS.ProcessEnv,
    })

    assert.equal(readiness.persistence.available, false)
    assert.equal(readiness.persistence.compatibilityIssue?.code, 'GRADE_POLICY_DB_COMPATIBILITY_REQUIRED')
    assert.equal(readiness.persistence.compatibilityIssue?.prismaCode, 'P2022')
    assert.equal(
      readiness.blockers.some((blocker) => blocker.code === 'GRADE_POLICY_DB_COMPATIBILITY_REQUIRED'),
      true
    )
    assert.equal(readiness.gradePolicyExists, false)
    assert.equal(readiness.safety.totalScoreChanged, false)
    assert.equal(readiness.safety.gradeIdChanged, false)
    assert.equal(fake.counts.gradePolicyFindMany, 1)
    assert.equal(fake.counts.forbiddenWrites, 0)
  })

  await run('activation readiness reports grade policy blockers without enabling official grade', async () => {
    const fake = makeDb()
    const gradePolicyReadiness = await getEvaluation2026GradePolicyReadiness({
      db: fake.db as never,
      evalCycleId: 'cycle-2026',
      env: {} as NodeJS.ProcessEnv,
    })
    const activation = await getEvaluation2026ActivationReadiness({
      flags: makeFlags(),
      migrationStatus: readyMigration(),
      readinessSummary: readySummary() as never,
      gradePolicyReadiness,
    })

    assert.equal(activation.canActivate, false)
    assert.equal(activation.blockers.some((blocker) => blocker.code === 'GRADE_POLICY_MISSING'), true)
    assert.equal(activation.blockers.some((blocker) => blocker.code === 'GRADE_POLICY_INCOMPLETE'), true)
    assert.equal(
      activation.blockers.some((blocker) => blocker.code === 'TEAM_MEMBER_SALES_GRADE_POLICY_CONFIRMATION_REQUIRED'),
      true
    )
    assert.equal(gradePolicyReadiness.safety.officialGradeEnabled, false)
  })

  await run('ROLE_ADMIN can save PPT baseline metadata without touching score or grade fields', async () => {
    const fake = makeDb()
    let auditCount = 0

    const result = await saveEvaluation2026GradePolicyMetadataForSession(
      {
        session: makeSession('ROLE_ADMIN'),
        input: {
          evalCycleId: 'cycle-2026',
          source: 'PPT_BASELINE',
        },
      },
      {
        db: fake.db as never,
        audit: async () => {
          auditCount += 1
        },
      }
    )

    assert.equal(result.upsertedRows, 30)
    assert.equal(fake.counts.gradePolicyUpsert, 30)
    assert.equal(auditCount, 1)
    assert.equal(result.officialScoresChanged, false)
    assert.equal(result.officialGradesChanged, false)
    assert.equal(result.totalScoreChanged, false)
    assert.equal(result.gradeIdChanged, false)
    assert.equal(result.evaluationsCreated, 0)
    assert.equal(result.evaluationItemsCreated, 0)
    assert.equal(fake.counts.forbiddenWrites, 0)
  })

  await run('ROLE_MEMBER cannot save grade policy readiness metadata', async () => {
    const fake = makeDb()

    await assert.rejects(
      () =>
        saveEvaluation2026GradePolicyMetadataForSession(
          {
            session: makeSession('ROLE_MEMBER', 'member-1'),
            input: {
              evalCycleId: 'cycle-2026',
              source: 'PPT_BASELINE',
            },
          },
          {
            db: fake.db as never,
            audit: async () => undefined,
          }
        ),
      (error) => error instanceof AppError && error.statusCode === 403
    )
    assert.equal(fake.counts.gradePolicyUpsert, 0)
  })

  await run('grade policy API and UI are admin-readiness metadata only', () => {
    const routeSource = read('src/app/api/evaluation/preview-2026/grade-policy/route.ts')
    const clientSource = read('src/components/evaluation/EvaluationWorkbenchClient.tsx')
    const helperSource = read('src/server/evaluation-2026-grade-policy-readiness.ts')
    const liveRouteSource = read('src/app/api/evaluation/[id]/route.ts')
    const submitRouteSource = read('src/app/api/evaluation/[id]/submit/route.ts')

    assert.equal(routeSource.includes('export async function GET'), true)
    assert.equal(routeSource.includes('export async function PATCH'), true)
    assert.equal(routeSource.includes('getServerSession(authOptions)'), true)
    assert.equal(routeSource.includes('saveEvaluation2026GradePolicyMetadataForSession'), true)
    assert.equal(clientSource.includes('/api/evaluation/preview-2026/grade-policy'), true)
    assert.equal(clientSource.includes('2026 등급 기준 readiness'), true)
    assert.equal(clientSource.includes('PPT 기준'), true)
    assert.equal(clientSource.includes('현재 저장 정책'), true)
    assert.equal(clientSource.includes('차이 있음'), true)
    assert.equal(clientSource.includes('TEAM_MEMBER_SALES 기준 확인 필요'), true)
    assert.equal(clientSource.includes('DB compatibility 확인 필요'), true)
    assert.equal(clientSource.includes('LEADER_NON_SALES'), true)
    assert.equal(clientSource.includes('LEADER_SALES'), true)
    assert.equal(helperSource.includes('evaluationGradePolicy.upsert'), true)
    assert.equal(helperSource.includes('officialScoresChanged: false'), true)
    assert.equal(helperSource.includes('officialGradesChanged: false'), true)
    assert.equal(helperSource.includes('totalScoreChanged: false'), true)
    assert.equal(helperSource.includes('gradeIdChanged: false'), true)
    assert.equal(helperSource.includes('evaluationsCreated: 0'), true)
    assert.equal(helperSource.includes('evaluationItemsCreated: 0'), true)
    assert.equal(liveRouteSource.includes('grade-policy'), false)
    assert.equal(submitRouteSource.includes('grade-policy'), false)
  })

  console.log('2026 grade policy readiness tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
