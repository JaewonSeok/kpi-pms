import './register-path-aliases'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import Module from 'node:module'
import path from 'node:path'
import { AppError } from '../src/lib/utils'
import {
  assert2026OfficialScoringEnabled,
  get2026EvaluationFeatureFlags,
  is2026OfficialActivationAllowed,
  is2026PreviewOnlyMode,
} from '../src/lib/feature-flags'

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

function makeFlags(overrides: Partial<ReturnType<typeof get2026EvaluationFeatureFlags>> = {}) {
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

function readyMigration(overrides: Partial<any> = {}) {
  return {
    requiredSchemaPresent: true,
    migrationApplied: true,
    migrationHistoryTableExists: true,
    migrationName: '20260514_phase0_2026_policy_prep',
    missingFields: [],
    checkedVia: 'provided' as const,
    ...overrides,
  }
}

function readySummary(overrides: Partial<any> = {}) {
  return {
    policyVersion: '2026-PPT',
    generatedAt: '2026-05-14T00:00:00.000Z',
    filters: {
      cycleId: 'cycle-official',
      limit: 200,
    },
    cycleScope: {
      requestedYear: 2026,
      requestedCycleId: 'cycle-official',
      selectedCycleId: 'cycle-official',
      selectedCycleName: '2026 공식 평가',
      selectedCycleYear: 2026,
      selectionMode: 'explicit_cycle' as const,
      isOfficialReadinessTarget: true,
      officialCycleCandidates: [
        {
          id: 'cycle-official',
          cycleName: '2026 공식 평가',
          evalYear: 2026,
          isOfficialReadinessTarget: true,
        },
      ],
      warning: null,
    },
    totalEvaluationsChecked: 2,
    canCalculateCount: 2,
    blockedCount: 0,
    missingPolicyCategoryCount: 0,
    manualReviewCount: 0,
    missingSalesClassificationCount: 0,
    missingOrgMasterDivisionSalesMappingCount: 0,
    ambiguousThresholdCount: 0,
    aiInsufficientDataCount: 0,
    samples: [],
    activationBlockers: [],
    ...overrides,
  }
}

function readyGradePolicy(overrides: Partial<any> = {}) {
  return {
    persistence: {
      available: true,
      compatibilityIssue: null,
    },
    gradePolicyExists: true,
    gradePolicyGroupsComplete: true,
    missingRowsCount: 0,
    differsFromPptCount: 0,
    overlapCount: 0,
    gapCount: 0,
    teamMemberSalesAmbiguity: {
      requiresDecision: false,
    },
    blockers: [],
    ...overrides,
  }
}

function readyPopulationDryRun(overrides: Partial<any> = {}) {
  return {
    selectedEvalCycle: {
      id: 'cycle-official',
      name: '2026 공식 평가',
      year: 2026,
      status: 'SELF_EVAL',
      isOfficialReadinessTarget: true,
    },
    activeEmployeeCount: 10,
    employeesMissingConfirmedPersonalKpiCount: 0,
    policyCategoryMissingCount: 0,
    divisionSalesMappingCoverage: {
      unmappedDivisions: 0,
    },
    teamKpiHrReviewCoverage: {
      pendingReviewCount: 0,
      needsDiscussionCount: 0,
      personalKpiOrgGoalWithoutApprovedSourceCount: 0,
    },
    scorePolicyReadiness: {
      summary: {
        violationsCount: 0,
        aiExcludedConfirmation: true,
      },
    },
    warnings: [],
    safety: {
      writesPerformed: false,
      evaluationsCreated: 0,
      evaluationItemsCreated: 0,
      totalScoreChanged: false,
      gradeIdChanged: false,
      officialScoringEnabled: false,
      officialGradeEnabled: false,
      officialAiScoreExclusionEnabled: false,
    },
    ...overrides,
  }
}

function findGate(result: any, id: string) {
  const gate = result.officialActivationGates.find((item: any) => item.id === id)
  assert.ok(gate, `missing gate ${id}`)
  return gate
}

function findCondition(gate: any, code: string) {
  const condition = gate.requiredConditions.find((item: any) => item.code === code)
  assert.ok(condition, `missing condition ${code}`)
  return condition
}

async function main() {
  const {
    getEvaluation2026ActivationReadiness,
    getEvaluation2026ActivationReadinessForSession,
  } = await import('../src/server/evaluation-2026-activation-readiness')

  await run('default official 2026 flags are false while preview can be enabled', () => {
    const flags = get2026EvaluationFeatureFlags({} as NodeJS.ProcessEnv)

    assert.equal(flags.previewEnabled, true)
    assert.equal(flags.officialScoringEnabled, false)
    assert.equal(flags.officialGradeEnabled, false)
    assert.equal(flags.aiScoreExclusionEnabled, false)
    assert.equal(flags.backfillApplied, false)
    assert.equal(flags.hrApprovalConfirmed, false)
    assert.equal(is2026PreviewOnlyMode(flags), true)
    assert.equal(is2026OfficialActivationAllowed(flags), false)
    assert.throws(() => assert2026OfficialScoringEnabled(flags), /disabled/)
  })

  await run('preview flag can be true without official activation', () => {
    const flags = get2026EvaluationFeatureFlags({
      EVALUATION_2026_PREVIEW_ENABLED: 'true',
      EVALUATION_2026_OFFICIAL_SCORING_ENABLED: 'false',
    } as unknown as NodeJS.ProcessEnv)

    assert.equal(flags.previewEnabled, true)
    assert.equal(flags.officialScoringEnabled, false)
    assert.equal(is2026PreviewOnlyMode(flags), true)
    assert.equal(is2026OfficialActivationAllowed(flags), false)
  })

  await run('activation readiness fails when manual-review records remain', async () => {
    const result = await getEvaluation2026ActivationReadiness({
      flags: makeFlags(),
      migrationStatus: readyMigration(),
      readinessSummary: readySummary({
        blockedCount: 1,
        canCalculateCount: 1,
        manualReviewCount: 1,
      }),
    })

    assert.equal(result.canActivate, false)
    assert.equal(result.blockers.some((item) => item.code === 'MANUAL_REVIEW_UNRESOLVED'), true)
  })

  await run('activation readiness fails when sales/non-sales classification is missing', async () => {
    const result = await getEvaluation2026ActivationReadiness({
      flags: makeFlags(),
      migrationStatus: readyMigration(),
      readinessSummary: readySummary({
        blockedCount: 1,
        canCalculateCount: 1,
        missingSalesClassificationCount: 1,
      }),
    })

    assert.equal(result.canActivate, false)
    assert.equal(result.blockers.some((item) => item.code === 'SALES_GROUP_UNRESOLVED'), true)
  })

  await run('activation readiness fails when sales threshold ambiguity is unresolved', async () => {
    const result = await getEvaluation2026ActivationReadiness({
      flags: makeFlags(),
      migrationStatus: readyMigration(),
      readinessSummary: readySummary({
        blockedCount: 1,
        canCalculateCount: 1,
        ambiguousThresholdCount: 1,
      }),
    })

    assert.equal(result.canActivate, false)
    assert.equal(result.blockers.some((item) => item.code === 'THRESHOLD_AMBIGUITY_UNRESOLVED'), true)
  })

  await run('activation readiness fails when backfill is not applied or explicitly excluded', async () => {
    const result = await getEvaluation2026ActivationReadiness({
      flags: makeFlags({
        backfillApplied: false,
        backfillExcluded: false,
      }),
      migrationStatus: readyMigration(),
      readinessSummary: readySummary(),
    })

    assert.equal(result.canActivate, false)
    assert.equal(result.blockers.some((item) => item.code === 'BACKFILL_NOT_CONFIRMED'), true)
  })

  await run('activation readiness fails when official readiness cycle is not confirmed', async () => {
    const result = await getEvaluation2026ActivationReadiness({
      flags: makeFlags(),
      migrationStatus: readyMigration(),
      readinessSummary: readySummary({
        cycleScope: {
          requestedYear: 2026,
          selectedCycleId: null,
          selectedCycleName: null,
          selectedCycleYear: null,
          selectionMode: 'no_official_cycle' as const,
          isOfficialReadinessTarget: false,
          officialCycleCandidates: [],
          warning: '공식 2026 readiness 대상 평가 주기가 설정되지 않았습니다.',
        },
      }),
    })

    assert.equal(result.canActivate, false)
    assert.equal(result.blockers.some((item) => item.code === 'OFFICIAL_READINESS_CYCLE_NOT_CONFIRMED'), true)
  })

  await run('official activation gate remains blocked when confirmed KPI coverage is low', async () => {
    const result = await getEvaluation2026ActivationReadiness({
      flags: makeFlags({
        officialScoringEnabled: false,
        officialGradeEnabled: false,
        aiScoreExclusionEnabled: false,
        backfillApplied: false,
        hrApprovalConfirmed: false,
      }),
      migrationStatus: readyMigration(),
      readinessSummary: readySummary(),
      gradePolicyReadiness: readyGradePolicy() as any,
      populationDryRun: readyPopulationDryRun({
        employeesMissingConfirmedPersonalKpiCount: 7,
      }) as any,
    })

    const gate = findGate(result, 'BACKFILL_APPLY')
    const condition = findCondition(gate, 'CONFIRMED_PERSONAL_KPI_COVERAGE')

    assert.equal(gate.status, 'BLOCKED')
    assert.equal(condition.status, 'BLOCKED')
    assert.equal(condition.blockerCount, 7)
  })

  await run('backfill apply gate is blocked when policyCategory missing exists', async () => {
    const result = await getEvaluation2026ActivationReadiness({
      flags: makeFlags({
        officialScoringEnabled: false,
        officialGradeEnabled: false,
        aiScoreExclusionEnabled: false,
        backfillApplied: false,
        hrApprovalConfirmed: false,
      }),
      migrationStatus: readyMigration(),
      readinessSummary: readySummary({
        missingPolicyCategoryCount: 2,
      }),
      gradePolicyReadiness: readyGradePolicy() as any,
      populationDryRun: readyPopulationDryRun({
        policyCategoryMissingCount: 2,
      }) as any,
    })

    const gate = findGate(result, 'BACKFILL_APPLY')
    const condition = findCondition(gate, 'POLICY_CATEGORY_MISSING_ZERO')

    assert.equal(gate.status, 'BLOCKED')
    assert.equal(condition.status, 'BLOCKED')
    assert.equal(condition.blockerCount, 2)
  })

  await run('official scoring gate is blocked before backfill and HR approval', async () => {
    const result = await getEvaluation2026ActivationReadiness({
      flags: makeFlags({
        officialScoringEnabled: false,
        officialGradeEnabled: false,
        aiScoreExclusionEnabled: false,
        backfillApplied: false,
        backfillExcluded: false,
        hrApprovalConfirmed: false,
      }),
      migrationStatus: readyMigration(),
      readinessSummary: readySummary(),
      gradePolicyReadiness: readyGradePolicy() as any,
      populationDryRun: readyPopulationDryRun() as any,
    })

    const gate = findGate(result, 'OFFICIAL_SCORING')

    assert.equal(gate.status, 'BLOCKED')
    assert.equal(findCondition(gate, 'BACKFILL_APPLIED_OR_NOT_REQUIRED').status, 'BLOCKED')
    assert.equal(findCondition(gate, 'HR_APPROVAL_CONFIRMED').status, 'BLOCKED')
    assert.equal(findCondition(gate, 'OFFICIAL_SCORING_FLAG_STILL_FALSE').status, 'READY')
  })

  await run('official grade gate is blocked when grade policy blockers remain', async () => {
    const result = await getEvaluation2026ActivationReadiness({
      flags: makeFlags({
        officialScoringEnabled: false,
        officialGradeEnabled: false,
        aiScoreExclusionEnabled: false,
        backfillApplied: true,
        hrApprovalConfirmed: true,
      }),
      migrationStatus: readyMigration(),
      readinessSummary: readySummary(),
      gradePolicyReadiness: readyGradePolicy({
        overlapCount: 1,
        blockers: [{ code: 'GRADE_POLICY_THRESHOLD_OVERLAP' }],
      }) as any,
      populationDryRun: readyPopulationDryRun() as any,
    })

    const gate = findGate(result, 'OFFICIAL_GRADE')

    assert.equal(gate.status, 'BLOCKED')
    assert.equal(findCondition(gate, 'GRADE_POLICY_BLOCKERS_RESOLVED').status, 'BLOCKED')
    assert.equal(findCondition(gate, 'TEAM_MEMBER_SALES_AMBIGUITY_RESOLVED').status, 'READY')
  })

  await run('totalScore and gradeId write gates remain blocked before official finalization', async () => {
    const result = await getEvaluation2026ActivationReadiness({
      flags: makeFlags({
        officialScoringEnabled: false,
        officialGradeEnabled: false,
        aiScoreExclusionEnabled: false,
        backfillApplied: true,
        hrApprovalConfirmed: true,
      }),
      migrationStatus: readyMigration(),
      readinessSummary: readySummary(),
      gradePolicyReadiness: readyGradePolicy() as any,
      populationDryRun: readyPopulationDryRun() as any,
    })

    const totalScoreGate = findGate(result, 'EVALUATION_TOTAL_SCORE_WRITE')
    const gradeIdGate = findGate(result, 'EVALUATION_GRADE_ID_WRITE')

    assert.equal(totalScoreGate.status, 'BLOCKED')
    assert.equal(findCondition(totalScoreGate, 'OFFICIAL_SCORING_ACTIVE').status, 'BLOCKED')
    assert.equal(gradeIdGate.status, 'BLOCKED')
    assert.equal(findCondition(gradeIdGate, 'TOTAL_SCORE_FINALIZED').status, 'BLOCKED')
    assert.equal(result.flags.officialScoringEnabled, false)
    assert.equal(result.flags.officialGradeEnabled, false)
    assert.equal(result.flags.aiScoreExclusionEnabled, false)
  })

  await run('activation readiness can pass in a fully mocked ready state', async () => {
    const result = await getEvaluation2026ActivationReadiness({
      flags: makeFlags(),
      migrationStatus: readyMigration(),
      readinessSummary: readySummary(),
    })

    assert.equal(result.canActivate, true)
    assert.equal(result.blockers.length, 0)
  })

  await run('admin can access activation readiness and member cannot', async () => {
    const adminResult = await getEvaluation2026ActivationReadinessForSession(
      {
        session: makeSession('ROLE_ADMIN'),
        year: 2026,
      },
      {
        flags: makeFlags(),
        migrationStatus: readyMigration(),
        readinessSummary: readySummary(),
      }
    )
    assert.equal(adminResult.canActivate, true)

    await assert.rejects(
      () =>
        getEvaluation2026ActivationReadinessForSession(
          {
            session: makeSession('ROLE_MEMBER', 'member-1'),
            year: 2026,
          },
          {
            flags: makeFlags(),
            migrationStatus: readyMigration(),
            readinessSummary: readySummary(),
          }
        ),
      (error) => error instanceof AppError && error.statusCode === 403
    )
  })

  await run('activation readiness API and UI are read-only and admin-gated', () => {
    const routeSource = read('src/app/api/evaluation/preview-2026/activation-readiness/route.ts')
    const clientSource = read('src/components/evaluation/EvaluationWorkbenchClient.tsx')

    assert.equal(routeSource.includes('export async function GET'), true)
    assert.equal(routeSource.includes('getServerSession(authOptions)'), true)
    assert.equal(routeSource.includes('getEvaluation2026ActivationReadinessForSession'), true)
    assert.equal(routeSource.includes('export async function POST'), false)
    assert.equal(routeSource.includes('export async function PATCH'), false)
    assert.equal(routeSource.includes('prisma.'), false)
    assert.equal(clientSource.includes('/api/evaluation/preview-2026/activation-readiness'), true)
    assert.equal(clientSource.includes('2026 공식 전환 Gate'), true)
    assert.equal(clientSource.includes('이 화면은 공식 전환 가능 여부를 읽기 전용으로 점검합니다.'), true)
    assert.equal(clientSource.includes('여기서는 backfill, 점수, 등급, feature flag를 실행하지 않습니다.'), true)
    assert.equal(clientSource.includes('활성화 버튼 없음'), true)
    assert.equal(clientSource.includes('Backfill apply gate'), true)
    assert.equal(clientSource.includes('Official scoring gate'), true)
    assert.equal(clientSource.includes('AI score exclusion gate'), true)
    assert.equal(clientSource.includes('Official grade gate'), true)
    assert.equal(clientSource.includes('Evaluation.totalScore write gate'), true)
    assert.equal(clientSource.includes('Evaluation.gradeId write gate'), true)
    assert.equal(clientSource.includes('공식 전환 실행'), false)
  })

  await run('live evaluation routes do not import or use official activation gate yet', () => {
    const liveRouteSource = read('src/app/api/evaluation/[id]/route.ts')
    const submitRouteSource = read('src/app/api/evaluation/[id]/submit/route.ts')
    const calibrationSource = read('src/server/evaluation-calibration.ts')

    for (const source of [liveRouteSource, submitRouteSource, calibrationSource]) {
      assert.equal(source.includes('evaluation-2026-activation-readiness'), false)
      assert.equal(source.includes('assert2026OfficialScoringEnabled'), false)
      assert.equal(source.includes('is2026OfficialActivationAllowed'), false)
      assert.equal(source.includes('activation-readiness'), false)
    }
  })

  console.log('2026 evaluation activation readiness tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
