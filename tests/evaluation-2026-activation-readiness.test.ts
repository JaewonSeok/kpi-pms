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
  assert2026OfficialScoringEnabled,
  get2026EvaluationFeatureFlags,
  is2026OfficialActivationAllowed,
  is2026PreviewOnlyMode,
} = require('../src/lib/feature-flags') as typeof import('../src/lib/feature-flags')
const {
  getEvaluation2026ActivationReadiness,
  getEvaluation2026ActivationReadinessForSession,
} = require('../src/server/evaluation-2026-activation-readiness') as typeof import('../src/server/evaluation-2026-activation-readiness')

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
      year: 2026,
      limit: 200,
    },
    totalEvaluationsChecked: 2,
    canCalculateCount: 2,
    blockedCount: 0,
    missingPolicyCategoryCount: 0,
    manualReviewCount: 0,
    missingSalesClassificationCount: 0,
    ambiguousThresholdCount: 0,
    aiInsufficientDataCount: 0,
    samples: [],
    activationBlockers: [],
    ...overrides,
  }
}

async function main() {
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
    assert.equal(clientSource.includes('2026 공식 전환 준비 상태'), true)
    assert.equal(clientSource.includes('공식 점수에는 아직 반영되지 않습니다.'), true)
    assert.equal(clientSource.includes('활성화 버튼 없음'), true)
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
