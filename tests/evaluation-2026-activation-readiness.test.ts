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
    leaderEvaluationReadiness: {
      summary: {
        targetEmployeeCount: 10,
        selfSubmittedCount: 10,
        firstReviewReadyCount: 7,
        firstReviewMissingPrerequisitesCount: 0,
        secondReviewReadyCount: 2,
        secondReviewMissingPrerequisitesCount: 0,
        finalCeoNotReadyCount: 1,
        itemsMissingResultWritingEvidence: 0,
        itemsMissingPolicyCategory: 0,
        itemsMissingApprovedOrgGoalSource: 0,
        itemsMissingMeasurableResult: 0,
        itemsMissingPersonalContribution: 0,
        itemsWithScorePolicyWarnings: 0,
        itemsWithAdjustmentReadinessWarnings: 0,
        missingEvaluatorCount: 0,
        blockerCount: 0,
        readyForLeaderReviewCount: 10,
        officialScoringEnabled: false,
        officialGradeEnabled: false,
      },
      rows: [],
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
    },
    finalizationCeoReadiness: {
      summary: {
        finalReviewCandidateCount: 10,
        readyLaterCount: 10,
        blockedBeforeFirstCount: 0,
        blockedBeforeSecondCount: 0,
        blockedBeforeFinalCount: 0,
        missingEvidenceCount: 0,
        missingPolicyCategoryCount: 0,
        missingEvaluatorChainCount: 0,
        scorePolicyBlockerCount: 0,
        gradePolicyBlockerCount: 0,
        feedbackLeadershipBlockerCount: 0,
        aiReadinessBlockerCount: 0,
        calibrationReadinessBlockerCount: 0,
        ceoConfirmationBlockerCount: 0,
        manualReviewCount: 0,
        finalizationBlockerCount: 0,
        testSampleCycleWarningCount: 0,
        officialScoringEnabled: false,
        officialGradeEnabled: false,
      },
      rows: [],
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

function readyEvaluatorRouting(overrides: Partial<any> = {}) {
  return {
    policyYear: 2026,
    checkedAt: '2026-05-14T00:00:00.000Z',
    evalCycleId: 'cycle-official',
    readOnly: true,
    summary: {
      activeEmployeeCount: 10,
      completeEvaluatorChainCount: 10,
      missingFirstEvaluatorCount: 0,
      missingSecondEvaluatorCount: 0,
      missingFinalApproverCount: 0,
      managerEmployeeNoMissingCount: 0,
      orgAmbiguousCount: 0,
      teamsWithoutLeaderCount: 0,
      leadersWithoutEvaluatableTeamMembersCount: 0,
      duplicateEvaluatorWarningCount: 0,
      selfEvaluatorWarningCount: 0,
      inactiveEvaluatorWarningCount: 0,
      orgPathMissingInvalidCount: 0,
      manualReviewCount: 0,
      blockerCount: 0,
      ...(overrides.summary ?? {}),
    },
    rows: [],
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

function readyFeedbackLeadership(overrides: Partial<any> = {}) {
  return {
    policyYear: 2026,
    checkedAt: '2026-05-14T00:00:00.000Z',
    evalCycleId: 'cycle-official',
    readOnly: true,
    summary: {
      targetEmployeeCount: 10,
      targetLeaderCount: 3,
      reviewerAssignmentCount: 20,
      missingReviewerAssignmentCount: 0,
      responseSubmittedCount: 20,
      responseMissingCount: 0,
      completionRate: 100,
      blockedOrNeedsSetupCount: 0,
      second360Status: 'COMPLETE',
      leadershipDiagnosisStatus: 'COMPLETE',
      ...(overrides.summary ?? {}),
    },
    second360Feedback: {
      status: 'COMPLETE',
      blockedCount: 0,
      needsSetupCount: 0,
    },
    leadershipDiagnosis: {
      status: 'COMPLETE',
      blockedCount: 0,
      needsSetupCount: 0,
    },
    rows: [],
    safety: {
      writesPerformed: false,
      notificationsSent: false,
      emailsSent: false,
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

function findRunbookSection(runbook: any, id: string) {
  const section = runbook.sections.find((item: any) => item.id === id)
  assert.ok(section, `missing runbook section ${id}`)
  return section
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

  await run('activation gate includes evaluator assignment blockers', async () => {
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
      populationDryRun: readyPopulationDryRun() as any,
      evaluatorRoutingReadiness: readyEvaluatorRouting({
        summary: {
          activeEmployeeCount: 10,
          completeEvaluatorChainCount: 7,
          missingFirstEvaluatorCount: 1,
          missingSecondEvaluatorCount: 1,
          missingFinalApproverCount: 1,
          blockerCount: 3,
          manualReviewCount: 3,
        },
      }) as any,
    })

    const gate = findGate(result, 'BACKFILL_APPLY')
    const condition = findCondition(gate, 'EVALUATOR_ASSIGNMENT_CHAIN_READY')

    assert.equal(gate.status, 'BLOCKED')
    assert.equal(condition.status, 'BLOCKED')
    assert.equal(condition.blockerCount, 3)
    assert.equal(result.blockers.some((item: any) => item.code === 'EVALUATOR_ROUTING_UNRESOLVED'), true)
  })

  await run('activation gate includes 360 and leadership readiness blockers', async () => {
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
      feedbackLeadershipReadiness: readyFeedbackLeadership({
        summary: {
          blockedOrNeedsSetupCount: 4,
          second360Status: 'ASSIGNMENT_INCOMPLETE',
          leadershipDiagnosisStatus: 'NOT_CONFIGURED',
        },
        second360Feedback: {
          status: 'ASSIGNMENT_INCOMPLETE',
          blockedCount: 2,
          needsSetupCount: 0,
        },
        leadershipDiagnosis: {
          status: 'NOT_CONFIGURED',
          blockedCount: 0,
          needsSetupCount: 2,
        },
      }) as any,
    })

    const gate = findGate(result, 'OFFICIAL_GRADE')
    const condition = findCondition(gate, 'FEEDBACK_360_LEADERSHIP_READINESS_READY')

    assert.equal(gate.status, 'BLOCKED')
    assert.equal(condition.status, 'BLOCKED')
    assert.equal(condition.blockerCount, 4)
    assert.equal(result.blockers.some((item: any) => item.code === 'FEEDBACK_LEADERSHIP_READINESS_UNRESOLVED'), true)
  })

  await run('activation gate includes leader evaluation readiness blocker', async () => {
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
      populationDryRun: readyPopulationDryRun({
        leaderEvaluationReadiness: {
          summary: {
            targetEmployeeCount: 10,
            selfSubmittedCount: 6,
            firstReviewReadyCount: 4,
            firstReviewMissingPrerequisitesCount: 3,
            secondReviewReadyCount: 1,
            secondReviewMissingPrerequisitesCount: 1,
            finalCeoNotReadyCount: 9,
            itemsMissingResultWritingEvidence: 2,
            itemsMissingPolicyCategory: 1,
            itemsMissingApprovedOrgGoalSource: 1,
            itemsMissingMeasurableResult: 2,
            itemsMissingPersonalContribution: 2,
            itemsWithScorePolicyWarnings: 2,
            itemsWithAdjustmentReadinessWarnings: 4,
            missingEvaluatorCount: 1,
            blockerCount: 4,
            readyForLeaderReviewCount: 5,
            officialScoringEnabled: false,
            officialGradeEnabled: false,
          },
          rows: [],
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
        },
      }) as any,
    })

    const gate = findGate(result, 'OFFICIAL_SCORING')
    const condition = findCondition(gate, 'LEADER_EVALUATION_READINESS_READY')

    assert.equal(gate.status, 'BLOCKED')
    assert.equal(condition.status, 'BLOCKED')
    assert.equal(condition.blockerCount, 4)
    assert.equal(result.warnings.some((item: any) => item.code === 'LEADER_EVALUATION_READINESS_UNRESOLVED'), true)
    assert.equal(result.leaderEvaluationReadiness?.summary.blockerCount, 4)
  })

  await run('activation gate includes finalization CEO readiness blocker', async () => {
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
      populationDryRun: readyPopulationDryRun({
        finalizationCeoReadiness: {
          summary: {
            finalReviewCandidateCount: 10,
            readyLaterCount: 4,
            blockedBeforeFirstCount: 2,
            blockedBeforeSecondCount: 1,
            blockedBeforeFinalCount: 1,
            missingEvidenceCount: 2,
            missingPolicyCategoryCount: 1,
            missingEvaluatorChainCount: 1,
            scorePolicyBlockerCount: 1,
            gradePolicyBlockerCount: 0,
            feedbackLeadershipBlockerCount: 0,
            aiReadinessBlockerCount: 0,
            calibrationReadinessBlockerCount: 1,
            ceoConfirmationBlockerCount: 6,
            manualReviewCount: 2,
            finalizationBlockerCount: 6,
            testSampleCycleWarningCount: 0,
            officialScoringEnabled: false,
            officialGradeEnabled: false,
          },
          rows: [],
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
        },
      }) as any,
    })

    const gate = findGate(result, 'OFFICIAL_GRADE')
    const condition = findCondition(gate, 'FINALIZATION_CEO_READINESS_READY')

    assert.equal(gate.status, 'BLOCKED')
    assert.equal(condition.status, 'BLOCKED')
    assert.equal(condition.blockerCount, 6)
    assert.equal(result.warnings.some((item: any) => item.code === 'FINALIZATION_CEO_READINESS_UNRESOLVED'), true)
    assert.equal(result.finalizationCeoReadiness?.summary.ceoConfirmationBlockerCount, 6)
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

  await run('integrated readiness snapshot summarizes major blockers and stays read-only', async () => {
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
      readinessSummary: readySummary({
        missingPolicyCategoryCount: 3,
        aiInsufficientDataCount: 2,
      }),
      gradePolicyReadiness: readyGradePolicy({
        differsFromPptCount: 1,
      }) as any,
      evaluatorRoutingReadiness: readyEvaluatorRouting({
        summary: {
          blockerCount: 5,
          activeEmployeeCount: 10,
          completeEvaluatorChainCount: 5,
        },
      }) as any,
      feedbackLeadershipReadiness: readyFeedbackLeadership({
        summary: {
          blockedOrNeedsSetupCount: 2,
          completionRate: 70,
        },
      }) as any,
      populationDryRun: readyPopulationDryRun({
        activeEmployeeCount: 10,
        employeesWithConfirmedPersonalKpiCount: 3,
        employeesMissingConfirmedPersonalKpiCount: 7,
        policyCategoryMissingCount: 3,
        mboSetupCoverage: {
          employeesMissingAnyPersonalKpiCount: 4,
        },
        teamKpiHrReviewCoverage: {
          pendingReviewCount: 2,
          needsDiscussionCount: 1,
          personalKpiOrgGoalWithoutApprovedSourceCount: 0,
        },
        scorePolicyReadiness: {
          summary: {
            violationsCount: 4,
            aiExcludedConfirmation: true,
          },
        },
      }) as any,
    })

    const snapshot = result.integratedReadinessSnapshot
    assert.equal(snapshot.mode, 'READ_ONLY')
    assert.equal(snapshot.currentStage, 'MBO_SETUP_IN_PROGRESS')
    assert.equal(snapshot.overallStatus, 'NEEDS_HR_ACTION')
    assert.equal(snapshot.summary.activeEmployeeCount, 10)
    assert.equal(snapshot.summary.confirmedPersonalKpiCount, 3)
    assert.equal(snapshot.summary.missingMboCount, 4)
    assert.equal(snapshot.summary.policyCategoryMissingCount, 3)
    assert.equal(snapshot.summary.teamKpiPendingCount, 3)
    assert.equal(snapshot.summary.aiReadinessBlockerCount, 2)
    assert.equal(snapshot.topBlockers.some((item: any) => item.code === 'MISSING_MBO'), true)
    assert.equal(snapshot.topBlockers.some((item: any) => item.code === 'POLICY_CATEGORY_MISSING'), true)
    assert.equal(snapshot.activationState.some((item: any) => item.id === 'OFFICIAL_SCORING' && item.status === 'BLOCKED'), true)
    assert.equal(snapshot.decisionReadiness.some((item: any) => item.id === 'BACKFILL_APPLY_APPROVAL' && item.status === 'BLOCKED'), true)
    assert.equal(snapshot.copyPayloads.hrActionList.includes('/kpi/personal'), true)
    assert.equal(snapshot.copyPayloads.developerActionList.includes('feature flag'), true)
    assert.equal(snapshot.copyPayloads.prohibitedActions.includes('Evaluation.totalScore write'), true)
    assert.equal(snapshot.safety.writesPerformed, false)
    assert.equal(snapshot.safety.backfillExecuted, false)
    assert.equal(snapshot.safety.totalScoreChanged, false)
    assert.equal(snapshot.safety.gradeIdChanged, false)
    assert.equal(snapshot.safety.noActivationButtons, true)

    const actionPlan = result.readinessActionPlan
    assert.equal(actionPlan.mode, 'READ_ONLY')
    assert.equal(actionPlan.currentStage, 'MBO_SETUP_IN_PROGRESS')
    assert.equal(actionPlan.overallStatus, 'NEEDS_HR_ACTION')
    assert.equal(actionPlan.actionGroups.hr.some((item: any) => item.id === 'HR_MISSING_MBO_REQUEST' && item.priority === 'P0'), true)
    assert.equal(actionPlan.actionGroups.hr.some((item: any) => item.id === 'HR_DRAFT_SUBMIT_REQUEST' && item.priority === 'P0'), true)
    assert.equal(actionPlan.actionGroups.hr.some((item: any) => item.id === 'HR_TEAM_KPI_REVIEW' && item.priority === 'P1'), true)
    assert.equal(actionPlan.actionGroups.hr.some((item: any) => item.id === 'HR_POLICY_CATEGORY_CONFIRM' && item.priority === 'P1'), true)
    assert.equal(actionPlan.actionGroups.developer.some((item: any) => item.id === 'DEV_ACTIVATION_GATE_CONSISTENCY' && item.priority === 'P0'), true)
    assert.equal(actionPlan.thisWeekFocus.some((item: any) => item.id === 'HR_MISSING_MBO_REQUEST'), true)
    assert.equal(actionPlan.copyPayloads.hrActionPlan.includes('MBO 미작성자 작성 요청'), true)
    assert.equal(actionPlan.copyPayloads.leaderActionPlan.includes('팀원 MBO 제출/보완 검토'), true)
    assert.equal(actionPlan.copyPayloads.employeeActionPlan.includes('2026 MBO 작성'), true)
    assert.equal(actionPlan.copyPayloads.developerWatchPlan.includes('Vercel logs watch'), true)
    assert.equal(actionPlan.copyPayloads.tsv.includes('ownerGroup'), true)
    assert.equal(actionPlan.prohibitedActions.includes('backfill --apply'), true)
    assert.equal(actionPlan.prohibitedActions.includes('Evaluation.gradeId write'), true)
    assert.equal(actionPlan.safety.writesPerformed, false)
    assert.equal(actionPlan.safety.notificationsSent, false)
    assert.equal(actionPlan.safety.totalScoreChanged, false)
    assert.equal(actionPlan.safety.gradeIdChanged, false)
    assert.equal(actionPlan.safety.noActivationButtons, true)
    assert.equal(actionPlan.safety.noMetadataSaveButtons, true)

    const executionBoard = result.readinessExecutionBoard
    assert.equal(executionBoard.mode, 'READ_ONLY')
    assert.equal(executionBoard.summary.currentStage, 'MBO_SETUP_IN_PROGRESS')
    assert.equal(executionBoard.summary.overallReadinessStatus, 'NEEDS_HR_ACTION')
    assert.equal(executionBoard.summary.officialActivationStatus, 'BLOCKED')
    assert.equal(executionBoard.summary.p0Count > 0, true)
    assert.equal(executionBoard.summary.p1Count > 0, true)
    assert.equal(executionBoard.summary.p2Count > 0, true)
    assert.equal(executionBoard.actionGroups.hr.some((item: any) => item.id === 'HR_MISSING_MBO_REQUEST' && item.priority === 'P0'), true)
    assert.equal(executionBoard.actionGroups.hr.some((item: any) => item.id === 'HR_DRAFT_SUBMIT_REQUEST' && item.priority === 'P0'), true)
    assert.equal(executionBoard.actionGroups.hr.some((item: any) => item.id === 'HR_EVALUATOR_ROUTING_REVIEW' && item.priority === 'P0'), true)
    assert.equal(executionBoard.actionGroups.hr.some((item: any) => item.id === 'HR_OFFICIAL_GATE_BLOCKER_REVIEW' && item.priority === 'P0'), true)
    assert.equal(executionBoard.actionGroups.hr.some((item: any) => item.id === 'HR_TEAM_KPI_REVIEW' && item.priority === 'P1'), true)
    assert.equal(executionBoard.actionGroups.hr.some((item: any) => item.id === 'HR_POLICY_CATEGORY_CONFIRM' && item.priority === 'P1'), true)
    assert.equal(executionBoard.actionGroups.hr.some((item: any) => item.id === 'HR_SCORE_POLICY_REVIEW' && item.priority === 'P1'), true)
    assert.equal(executionBoard.actionGroups.hr.some((item: any) => item.id === 'HR_GRADE_POLICY_REVIEW' && item.priority === 'P1'), true)
    assert.equal(executionBoard.actionGroups.hr.some((item: any) => item.id === 'HR_AI_READINESS_REVIEW' && item.priority === 'P2'), true)
    assert.equal(executionBoard.actionGroups.hr.some((item: any) => item.id === 'HR_FEEDBACK_LEADERSHIP_REVIEW' && item.priority === 'P2'), true)
    assert.equal(executionBoard.actionGroups.developer.some((item: any) => item.id === 'DEV_VERCEL_LOG_WATCH'), true)
    assert.equal(executionBoard.actionGroups.developer.some((item: any) => item.id === 'DEV_WEEKLY_REPORT_EXPORT'), true)
    assert.equal(executionBoard.workstreams.thisWeekFocus.some((item: any) => item.id === 'HR_BASELINE_RECORD'), true)
    assert.equal(executionBoard.workstreams.thisWeekFocus.some((item: any) => item.id === 'DEV_VERCEL_LOG_WATCH'), true)
    assert.equal(executionBoard.communicationTemplates.some((item: any) => item.title === 'MBO 미작성자 작성 요청'), true)
    assert.equal(executionBoard.executiveWeeklyReportText.includes('Top blockers'), true)
    assert.equal(executionBoard.executiveWeeklyReportText.includes('Prohibited actions'), true)
    assert.equal(executionBoard.copyPayloads.hrActionList.includes('MBO 미작성자 작성 요청'), true)
    assert.equal(executionBoard.copyPayloads.leaderActionList.includes('팀원 MBO 제출/보완 검토'), true)
    assert.equal(executionBoard.copyPayloads.employeeActionList.includes('2026 MBO 작성'), true)
    assert.equal(executionBoard.copyPayloads.developerWatchList.includes('Vercel logs watch'), true)
    assert.equal(executionBoard.copyPayloads.tsv.includes('ownerGroup'), true)
    assert.equal(executionBoard.prohibitedActions.includes('backfill execution from UI'), true)
    assert.equal(executionBoard.prohibitedActions.includes('score/grade write from UI'), true)
    assert.equal(executionBoard.metadataTracking.enabled, false)
    assert.equal(executionBoard.metadataTracking.saveAvailable, false)
    assert.equal(executionBoard.baselineSnapshot.guidance.includes('복사/내보내기'), true)
    assert.equal(executionBoard.safety.writesPerformed, false)
    assert.equal(executionBoard.safety.notificationsSent, false)
    assert.equal(executionBoard.safety.emailsSent, false)
    assert.equal(executionBoard.safety.totalScoreChanged, false)
    assert.equal(executionBoard.safety.gradeIdChanged, false)
    assert.equal(executionBoard.safety.noActivationButtons, true)
    assert.equal(executionBoard.safety.noMetadataSaveButtons, true)
    assert.equal(executionBoard.safety.noBackfillExecutionButtons, true)
    assert.equal(executionBoard.safety.noScoreGradeWriteButtons, true)

    const scenarioSimulator = result.readinessScenarioSimulator
    assert.equal(scenarioSimulator.mode, 'READ_ONLY')
    assert.equal(scenarioSimulator.disclaimer.includes('readiness planning용 추정'), true)
    assert.equal(scenarioSimulator.baselineCounts.missingMboCount, 4)
    assert.equal(scenarioSimulator.baselineCounts.confirmedPersonalKpiCount, 3)
    assert.equal(scenarioSimulator.baselineCounts.confirmedPersonalKpiShortageCount, 7)
    assert.equal(scenarioSimulator.baselineCounts.teamKpiPendingCount, 3)
    assert.equal(scenarioSimulator.baselineCounts.policyCategoryMissingCount, 3)
    assert.equal(scenarioSimulator.presets.length, 5)

    const mboScenario = scenarioSimulator.presetScenarios.find((item: any) => item.id === 'MBO_FIRST_REMINDER')
    assert.ok(mboScenario)
    assert.equal(mboScenario.projectedCounts.missingMboCount, 0)
    assert.equal(mboScenario.projectedCounts.confirmedPersonalKpiShortageCount, 0)
    assert.equal(mboScenario.officialActivationStatus, 'BLOCKED')

    const policyScenario = scenarioSimulator.presetScenarios.find((item: any) => item.id === 'TEAM_KPI_POLICY_CATEGORY_CLEANUP')
    assert.ok(policyScenario)
    assert.equal(policyScenario.projectedCounts.teamKpiPendingCount, 0)
    assert.equal(policyScenario.projectedCounts.policyCategoryMissingCount, 0)

    const evaluatorScenario = scenarioSimulator.presetScenarios.find((item: any) => item.id === 'EVALUATOR_ROUTING_FIRST_CLEANUP')
    assert.ok(evaluatorScenario)
    assert.equal(evaluatorScenario.projectedCounts.evaluatorRoutingBlockerCount, 0)

    const fullScenario = scenarioSimulator.presetScenarios.find((item: any) => item.id === 'FULL_READINESS_TARGET')
    assert.ok(fullScenario)
    assert.equal(fullScenario.projectedCounts.missingMboCount, 0)
    assert.equal(fullScenario.projectedCounts.teamKpiPendingCount, 0)
    assert.equal(fullScenario.projectedCounts.policyCategoryMissingCount, 0)
    assert.equal(fullScenario.projectedCounts.evaluatorRoutingBlockerCount, 0)
    assert.equal(fullScenario.officialActivationStatus, 'BLOCKED')
    assert.equal(fullScenario.decisionReadiness, 'DRY_RUN_BACKUP_HR_APPROVAL_REQUIRED')
    assert.equal(fullScenario.reportText.includes('dry-run, DB backup, HR 승인'), true)
    assert.equal(scenarioSimulator.copyPayloads.markdown.includes('2026 Readiness Scenario Simulator'), true)
    assert.equal(scenarioSimulator.copyPayloads.tsv.includes('scenario'), true)
    assert.equal(scenarioSimulator.prohibitedActions.includes('backfill --apply'), true)
    assert.equal(scenarioSimulator.prohibitedActions.includes('Evaluation.totalScore write'), true)
    assert.equal(scenarioSimulator.safety.writesPerformed, false)
    assert.equal(scenarioSimulator.safety.metadataSaved, false)
    assert.equal(scenarioSimulator.safety.notificationsSent, false)
    assert.equal(scenarioSimulator.safety.totalScoreChanged, false)
    assert.equal(scenarioSimulator.safety.gradeIdChanged, false)
    assert.equal(scenarioSimulator.safety.noActivationButtons, true)
    assert.equal(scenarioSimulator.safety.noMetadataSaveButtons, true)
    assert.equal(scenarioSimulator.safety.noBackfillExecutionButtons, true)
    assert.equal(scenarioSimulator.safety.noScoreGradeWriteButtons, true)

    const ceoReportPack = result.ceoReportPack
    assert.equal(ceoReportPack.mode, 'READ_ONLY')
    assert.equal(ceoReportPack.reportStatus, 'READY_FOR_REPORT')
    assert.equal(ceoReportPack.summary.currentStage, 'MBO_SETUP_IN_PROGRESS')
    assert.equal(ceoReportPack.summary.overallReadinessStatus, 'NEEDS_HR_ACTION')
    assert.equal(ceoReportPack.summary.officialActivationStatus, 'BLOCKED')
    assert.equal(ceoReportPack.summary.executiveSummaryText.includes('공식 전환 readiness'), true)
    assert.equal(ceoReportPack.keyNumbers.some((item: any) => item.id === 'MBO_MISSING' && item.value === 4), true)
    assert.equal(ceoReportPack.keyNumbers.some((item: any) => item.id === 'CONFIRMED_KPI' && item.value === 3), true)
    assert.equal(ceoReportPack.keyNumbers.some((item: any) => item.id === 'OFFICIAL_GATE_BLOCKERS'), true)
    assert.equal(ceoReportPack.topBlockers.some((item: any) => item.code === 'MISSING_MBO'), true)
    assert.equal(ceoReportPack.decisionAgenda.decisionsNeededNow.some((item: string) => item.includes('공식 전환은 현재 BLOCKED')), true)
    assert.equal(ceoReportPack.decisionAgenda.decisionsNotYetAppropriate.some((item: string) => item.includes('official scoring')), true)
    assert.equal(ceoReportPack.decisionAgenda.decisionsExplicitlyProhibited.includes('Evaluation.totalScore write'), true)
    assert.equal(ceoReportPack.scenarioComparison.some((item: any) => item.scenarioName === 'MBO 작성 1차 독려'), true)
    assert.equal(ceoReportPack.scenarioComparison.some((item: any) => item.scenarioName === 'Full readiness target scenario' && item.recommendedInterpretation.includes('dry-run')), true)
    assert.equal(ceoReportPack.recommendedExecutionOrder[0], 'MBO 작성 1차 독려')
    assert.equal(ceoReportPack.prohibitedActions.includes('backfill --apply'), true)
    assert.equal(ceoReportPack.copyPayloads.markdownReport.includes('2026 대표이사 보고 Pack'), true)
    assert.equal(ceoReportPack.copyPayloads.tsvSummary.includes('section'), true)
    assert.equal(ceoReportPack.safety.writesPerformed, false)
    assert.equal(ceoReportPack.safety.notificationsSent, false)
    assert.equal(ceoReportPack.safety.emailsSent, false)
    assert.equal(ceoReportPack.safety.totalScoreChanged, false)
    assert.equal(ceoReportPack.safety.gradeIdChanged, false)
    assert.equal(ceoReportPack.safety.noActivationButtons, true)
    assert.equal(ceoReportPack.safety.noBackfillExecutionButtons, true)
    assert.equal(ceoReportPack.safety.noScoreGradeWriteButtons, true)

    const fastForwardOperationsCockpit = result.fastForwardOperationsCockpit
    assert.equal(fastForwardOperationsCockpit.mode, 'READ_ONLY')
    assert.equal(fastForwardOperationsCockpit.fastForwardSummary.currentStage, 'MBO_SETUP_IN_PROGRESS')
    assert.equal(fastForwardOperationsCockpit.fastForwardSummary.overallReadinessStatus, 'NEEDS_HR_ACTION')
    assert.equal(fastForwardOperationsCockpit.fastForwardSummary.officialActivationStatus, 'BLOCKED')
    assert.equal(fastForwardOperationsCockpit.workstreams.some((item: any) => item.id === 'MBO_COVERAGE'), true)
    assert.equal(fastForwardOperationsCockpit.workstreams.some((item: any) => item.id === 'TEAM_KPI_POLICY_CATEGORY'), true)
    assert.equal(fastForwardOperationsCockpit.workstreams.some((item: any) => item.id === 'EVALUATOR_ROUTING'), true)
    assert.equal(fastForwardOperationsCockpit.workstreams.some((item: any) => item.id === 'DEVELOPER_WATCH'), true)
    assert.equal(fastForwardOperationsCockpit.criticalPath.map((item: any) => item.title).includes('MBO coverage'), true)
    assert.equal(fastForwardOperationsCockpit.criticalPath.map((item: any) => item.title).includes('Team KPI / policyCategory'), true)
    assert.equal(fastForwardOperationsCockpit.criticalPath.map((item: any) => item.title).includes('Evaluator routing'), true)
    assert.equal(fastForwardOperationsCockpit.criticalPath.map((item: any) => item.title).includes('Result writing readiness'), true)
    assert.equal(fastForwardOperationsCockpit.criticalPath.map((item: any) => item.title).includes('Leader evaluation readiness'), true)
    assert.equal(fastForwardOperationsCockpit.criticalPath.map((item: any) => item.title).includes('Finalization/CEO readiness'), true)
    assert.equal(fastForwardOperationsCockpit.criticalPath.map((item: any) => item.title).includes('Backfill dry-run review'), true)
    assert.equal(fastForwardOperationsCockpit.quickWins.some((item: any) => item.id === 'POLICY_CATEGORY_QUICK_WIN'), true)
    assert.equal(fastForwardOperationsCockpit.quickWins.some((item: any) => item.id === 'TEAM_KPI_QUICK_WIN'), true)
    assert.equal(fastForwardOperationsCockpit.minimumSafePathToBackfillDryRunReview.some((item: any) => item.id === 'DB_BACKUP_PLAN'), true)
    assert.equal(fastForwardOperationsCockpit.minimumSafePathToBackfillDryRunReview.some((item: any) => item.id === 'HR_APPROVAL'), true)
    assert.equal(fastForwardOperationsCockpit.prohibitedActions.includes('assignment sync without HR approval'), true)
    assert.equal(fastForwardOperationsCockpit.prohibitedActions.includes('Evaluation.totalScore write'), true)
    assert.equal(fastForwardOperationsCockpit.copyPayloads.criticalPath.includes('Backfill dry-run review'), true)
    assert.equal(fastForwardOperationsCockpit.copyPayloads.ownerActionQueues.includes('Developer / Watch'), true)
    assert.equal(fastForwardOperationsCockpit.copyPayloads.markdown.includes('2026 Fast-Forward Operations Cockpit'), true)
    assert.equal(fastForwardOperationsCockpit.copyPayloads.tsv.includes('workstream'), true)
    assert.equal(fastForwardOperationsCockpit.safety.writesPerformed, false)
    assert.equal(fastForwardOperationsCockpit.safety.metadataSaved, false)
    assert.equal(fastForwardOperationsCockpit.safety.noActivationButtons, true)
    assert.equal(fastForwardOperationsCockpit.safety.noMetadataSaveButtons, true)
    assert.equal(fastForwardOperationsCockpit.safety.noBackfillExecutionButtons, true)
    assert.equal(fastForwardOperationsCockpit.safety.noScoreGradeWriteButtons, true)
    assert.equal(fastForwardOperationsCockpit.safety.totalScoreChanged, false)
    assert.equal(fastForwardOperationsCockpit.safety.gradeIdChanged, false)

    const preflightPack = result.backfillDryRunPreflightPack
    assert.equal(preflightPack.mode, 'READ_ONLY')
    assert.equal(preflightPack.preflightSummary.currentStage, 'MBO_SETUP_IN_PROGRESS')
    assert.equal(preflightPack.preflightSummary.overallReadinessStatus, 'NEEDS_HR_ACTION')
    assert.equal(preflightPack.preflightSummary.officialActivationStatus, 'BLOCKED')
    assert.equal(preflightPack.preflightSummary.backfillDryRunReviewStatus, 'BLOCKED')
    assert.equal(preflightPack.preflightSummary.backfillApplyStatus, 'NOT_ALLOWED')
    assert.equal(preflightPack.preflightSummary.dbBackupStatus, 'REQUIRED_NOT_CONFIRMED')
    assert.equal(preflightPack.preflightSummary.hrApprovalStatus, 'REQUIRED_NOT_COLLECTED')
    assert.equal(preflightPack.preflightSummary.officialFlagsStatus, 'MUST_REMAIN_FALSE')
    assert.equal(preflightPack.preflightSummary.applyRemainsBlocked, true)
    assert.equal(preflightPack.preconditionsChecklist.some((item: any) => item.id === 'MBO_COVERAGE_SUFFICIENT' && item.status === 'BLOCKED'), true)
    assert.equal(preflightPack.preconditionsChecklist.some((item: any) => item.id === 'TEAM_KPI_PENDING_RESOLVED'), true)
    assert.equal(preflightPack.preconditionsChecklist.some((item: any) => item.id === 'POLICY_CATEGORY_ZERO'), true)
    assert.equal(preflightPack.preconditionsChecklist.some((item: any) => item.id === 'EVALUATOR_ROUTING_READY'), true)
    assert.equal(preflightPack.preconditionsChecklist.some((item: any) => item.id === 'DB_BACKUP_PLAN_CONFIRMED'), true)
    assert.equal(preflightPack.preconditionsChecklist.some((item: any) => item.id === 'HR_APPROVAL_PREPARED'), true)
    assert.equal(preflightPack.commandTemplates.every((item: any) => item.mode === 'TEXT_ONLY' && item.executeAvailable === false), true)
    assert.equal(preflightPack.commandTemplates.some((item: any) => item.id === 'APPLY_HIDDEN' && item.commandText.includes('must not be placed in UI')), true)
    assert.equal(preflightPack.expectedOutputChecklist.some((item: any) => item.id === 'TOTAL_SCORE_CHANGES' && item.requiredValue === 'false'), true)
    assert.equal(preflightPack.expectedOutputChecklist.some((item: any) => item.id === 'GRADE_ID_CHANGES' && item.requiredValue === 'false'), true)
    assert.equal(preflightPack.expectedOutputChecklist.some((item: any) => item.id === 'WRITES_PERFORMED' && item.requiredValue.includes('false')), true)
    assert.equal(preflightPack.backupChecklist.includes('DB backup owner'), true)
    assert.equal(preflightPack.hrApprovalChecklist.includes('HR approves dry-run review only'), true)
    assert.equal(preflightPack.developerExecutionChecklist.includes('do not run apply'), true)
    assert.equal(preflightPack.postCheckChecklist.includes('no Evaluation.totalScore changes'), true)
    assert.equal(preflightPack.prohibitedActions.includes('backfill --apply'), true)
    assert.equal(preflightPack.prohibitedActions.includes('UI-triggered backfill'), true)
    assert.equal(preflightPack.prohibitedActions.includes('Evaluation.totalScore write'), true)
    assert.equal(preflightPack.copyPayloads.preconditionsChecklist.includes('MBO coverage sufficient'), true)
    assert.equal(preflightPack.copyPayloads.hrApprovalChecklist.includes('HR approves dry-run review only'), true)
    assert.equal(preflightPack.copyPayloads.markdown.includes('2026 Backfill Dry-run Preflight Pack'), true)
    assert.equal(preflightPack.copyPayloads.tsv.includes('precondition'), true)
    assert.equal(preflightPack.existingSurface.dryRunOnlyWithoutWritesAvailable, true)
    assert.equal(preflightPack.existingSurface.applySeparatedFromDryRun, true)
    assert.equal(preflightPack.existingSurface.writesTotalScore, false)
    assert.equal(preflightPack.existingSurface.writesGradeId, false)
    assert.equal(preflightPack.safety.writesPerformed, false)
    assert.equal(preflightPack.safety.dryRunExecuted, false)
    assert.equal(preflightPack.safety.backfillExecuted, false)
    assert.equal(preflightPack.safety.backfillApplyExecuted, false)
    assert.equal(preflightPack.safety.totalScoreChanged, false)
    assert.equal(preflightPack.safety.gradeIdChanged, false)
    assert.equal(preflightPack.safety.evaluationsCreated, 0)
    assert.equal(preflightPack.safety.evaluationItemsCreated, 0)
    assert.equal(preflightPack.safety.noActivationButtons, true)
    assert.equal(preflightPack.safety.noDryRunExecutionButtons, true)
    assert.equal(preflightPack.safety.noBackfillExecutionButtons, true)
    assert.equal(preflightPack.safety.noApplyButtons, true)
    assert.equal(preflightPack.safety.noScoreGradeWriteButtons, true)

    const dryRunOutputReviewTemplate = result.dryRunOutputReviewTemplate
    assert.equal(dryRunOutputReviewTemplate.mode, 'READ_ONLY')
    assert.equal(dryRunOutputReviewTemplate.templateStatus, 'AVAILABLE')
    assert.equal(dryRunOutputReviewTemplate.templateSummary.currentStage, 'MBO_SETUP_IN_PROGRESS')
    assert.equal(dryRunOutputReviewTemplate.templateSummary.overallReadinessStatus, 'NEEDS_HR_ACTION')
    assert.equal(dryRunOutputReviewTemplate.templateSummary.officialActivationStatus, 'BLOCKED')
    assert.equal(dryRunOutputReviewTemplate.templateSummary.preflightStatus, 'BLOCKED')
    assert.equal(dryRunOutputReviewTemplate.templateSummary.applyStatus, 'NOT_ALLOWED')
    assert.equal(dryRunOutputReviewTemplate.templateSummary.localOnlyPasteHelperStatus, 'LOCAL_ONLY')
    assert.equal(dryRunOutputReviewTemplate.reviewTemplateSections.some((item: any) => item.id === 'DRY_RUN_IDENTITY'), true)
    assert.equal(dryRunOutputReviewTemplate.reviewTemplateSections.some((item: any) => item.id === 'EXPECTED_OUTPUT_FIELDS'), true)
    assert.equal(dryRunOutputReviewTemplate.dryRunIdentityFields.some((item: any) => item.label === 'dry-run timestamp'), true)
    assert.equal(dryRunOutputReviewTemplate.expectedOutputFields.some((item: any) => item.label === 'target population count'), true)
    assert.equal(dryRunOutputReviewTemplate.expectedOutputFields.some((item: any) => item.label === 'totalScore changes expected'), true)
    assert.equal(dryRunOutputReviewTemplate.expectedOutputFields.some((item: any) => item.label === 'gradeId changes expected'), true)
    assert.equal(dryRunOutputReviewTemplate.mustPassCriteria.some((item: any) => item.label === 'writesPerformed must be false'), true)
    assert.equal(dryRunOutputReviewTemplate.mustPassCriteria.some((item: any) => item.label === 'Evaluation.totalScore changes must be 0/false'), true)
    assert.equal(dryRunOutputReviewTemplate.mustPassCriteria.some((item: any) => item.label === 'Evaluation.gradeId changes must be 0/false'), true)
    assert.equal(dryRunOutputReviewTemplate.redFlagConditions.some((item: any) => item.label === 'P2021 / P2022'), true)
    assert.equal(dryRunOutputReviewTemplate.redFlagConditions.some((item: any) => item.label === 'column/relation missing'), true)
    assert.equal(dryRunOutputReviewTemplate.redFlagConditions.some((item: any) => item.label === 'JWT_SESSION_ERROR'), true)
    assert.equal(dryRunOutputReviewTemplate.hrReviewChecklist.includes('HR confirms target cycle'), true)
    assert.equal(dryRunOutputReviewTemplate.developerReviewChecklist.includes('do not run apply'), true)
    assert.equal(dryRunOutputReviewTemplate.postDryRunLogWatchChecklist.includes('PrismaClientKnownRequestError'), true)
    assert.equal(dryRunOutputReviewTemplate.decisionOutcomes.some((item: any) => item.code === 'ACCEPT_FOR_REVIEW'), true)
    assert.equal(dryRunOutputReviewTemplate.decisionOutcomes.some((item: any) => item.code === 'NOT_READY_FOR_APPLY'), true)
    assert.equal(dryRunOutputReviewTemplate.nextActionMapping.some((item: any) => item.condition.includes('policyCategory missing')), true)
    assert.equal(dryRunOutputReviewTemplate.nextActionMapping.some((item: any) => item.condition.includes('evaluator blockers')), true)
    assert.equal(dryRunOutputReviewTemplate.nextActionMapping.some((item: any) => item.condition.includes('dry-run writesPerformed true')), true)
    assert.equal(dryRunOutputReviewTemplate.localOnlyPasteHelper.enabled, true)
    assert.equal(dryRunOutputReviewTemplate.localOnlyPasteHelper.serverSubmitAvailable, false)
    assert.equal(dryRunOutputReviewTemplate.localOnlyPasteHelper.saveAvailable, false)
    assert.equal(dryRunOutputReviewTemplate.localOnlyPasteHelper.uploadAvailable, false)
    assert.equal(dryRunOutputReviewTemplate.localOnlyPasteHelper.apiCallAvailable, false)
    assert.equal(dryRunOutputReviewTemplate.localOnlyPasteHelper.persistenceAvailable, false)
    assert.equal(dryRunOutputReviewTemplate.localOnlyPasteHelper.invalidJsonMessage.includes('구조화하지 못했습니다'), true)
    assert.equal(dryRunOutputReviewTemplate.localOnlyPasteHelper.knownFields.includes('writesPerformed'), true)
    assert.equal(dryRunOutputReviewTemplate.prohibitedActions.includes('dry-run execution from UI'), true)
    assert.equal(dryRunOutputReviewTemplate.prohibitedActions.includes('backfill --apply'), true)
    assert.equal(dryRunOutputReviewTemplate.prohibitedActions.includes('UI-triggered backfill'), true)
    assert.equal(dryRunOutputReviewTemplate.prohibitedActions.includes('Evaluation.totalScore write'), true)
    assert.equal(dryRunOutputReviewTemplate.copyPayloads.reviewTemplate.includes('2026 Dry-run Output Review Template'), true)
    assert.equal(dryRunOutputReviewTemplate.copyPayloads.mustPassCriteria.includes('writesPerformed must be false'), true)
    assert.equal(dryRunOutputReviewTemplate.copyPayloads.redFlags.includes('P2021 / P2022'), true)
    assert.equal(dryRunOutputReviewTemplate.copyPayloads.decisionOutcomeGuide.includes('NOT_READY_FOR_APPLY'), true)
    assert.equal(dryRunOutputReviewTemplate.copyPayloads.nextActionMapping.includes('policyCategory workbench'), true)
    assert.equal(dryRunOutputReviewTemplate.copyPayloads.markdown.includes('2026 Dry-run Output Review Template'), true)
    assert.equal(dryRunOutputReviewTemplate.copyPayloads.tsv.includes('must_pass'), true)
    assert.equal(dryRunOutputReviewTemplate.safety.writesPerformed, false)
    assert.equal(dryRunOutputReviewTemplate.safety.dryRunExecuted, false)
    assert.equal(dryRunOutputReviewTemplate.safety.backfillExecuted, false)
    assert.equal(dryRunOutputReviewTemplate.safety.backfillApplyExecuted, false)
    assert.equal(dryRunOutputReviewTemplate.safety.totalScoreChanged, false)
    assert.equal(dryRunOutputReviewTemplate.safety.gradeIdChanged, false)
    assert.equal(dryRunOutputReviewTemplate.safety.evaluationsCreated, 0)
    assert.equal(dryRunOutputReviewTemplate.safety.evaluationItemsCreated, 0)
    assert.equal(dryRunOutputReviewTemplate.safety.noDryRunExecutionButtons, true)
    assert.equal(dryRunOutputReviewTemplate.safety.noBackfillExecutionButtons, true)
    assert.equal(dryRunOutputReviewTemplate.safety.noApplyButtons, true)
    assert.equal(dryRunOutputReviewTemplate.safety.noScoreGradeWriteButtons, true)
    assert.equal(dryRunOutputReviewTemplate.safety.noServerSubmit, true)
    assert.equal(dryRunOutputReviewTemplate.safety.noUpload, true)
    assert.equal(dryRunOutputReviewTemplate.safety.noPersistence, true)

    const dryRunRehearsalGuardrails = result.dryRunRehearsalGuardrails
    assert.equal(dryRunRehearsalGuardrails.mode, 'READ_ONLY')
    assert.equal(dryRunRehearsalGuardrails.status, 'AVAILABLE')
    assert.equal(dryRunRehearsalGuardrails.summary.currentStage, 'MBO_SETUP_IN_PROGRESS')
    assert.equal(dryRunRehearsalGuardrails.summary.overallReadinessStatus, 'NEEDS_HR_ACTION')
    assert.equal(dryRunRehearsalGuardrails.summary.officialActivationStatus, 'BLOCKED')
    assert.equal(dryRunRehearsalGuardrails.summary.reviewerStatus, 'AVAILABLE')
    assert.equal(dryRunRehearsalGuardrails.summary.localOnlyPasteValidatorStatus, 'LOCAL_ONLY')
    assert.equal(dryRunRehearsalGuardrails.summary.applyStatus, 'PROHIBITED_UNTIL_GATE_READY')
    assert.equal(dryRunRehearsalGuardrails.scriptSurfaceInventory.some((item: any) => item.scriptName === 'scripts/dry-run-backfill-2026-policy-metadata.ts' && item.dryRunAvailable && !item.applyCapable), true)
    assert.equal(dryRunRehearsalGuardrails.scriptSurfaceInventory.some((item: any) => item.scriptName === 'scripts/backfill-2026-policy-metadata.ts' && item.applyCapable && item.applyTrigger === '--apply'), true)
    const applyScript = dryRunRehearsalGuardrails.scriptSurfaceInventory.find((item: any) => item.scriptName === 'scripts/backfill-2026-policy-metadata.ts')
    assert.ok(applyScript)
    assert.equal(applyScript.writesEvaluation, 'no')
    assert.equal(applyScript.writesEvaluationItem, 'yes')
    assert.equal(applyScript.writesEvaluationTotalScore, 'no')
    assert.equal(applyScript.writesEvaluationGradeId, 'no')
    assert.equal(applyScript.currentGuardrails.includes('--confirm-2026-production-apply required'), true)
    assert.equal(applyScript.currentGuardrails.includes('--backup-confirmed required'), true)
    assert.equal(applyScript.currentGuardrails.includes('--hr-approved required'), true)
    assert.equal(applyScript.currentGuardrails.includes('--dry-run-output-reviewed required'), true)
    assert.equal(dryRunRehearsalGuardrails.applyGuardrailStatus.some((item: any) => item.id === 'BACKUP_CONFIRMATION'), true)
    assert.equal(dryRunRehearsalGuardrails.applyGuardrailStatus.some((item: any) => item.id === 'HR_APPROVAL'), true)
    assert.equal(dryRunRehearsalGuardrails.applyGuardrailStatus.some((item: any) => item.id === 'TARGET_CYCLE_CONFIRMED'), true)
    assert.equal(dryRunRehearsalGuardrails.applyGuardrailStatus.some((item: any) => item.id === 'OFFICIAL_FLAGS_FALSE'), true)
    assert.equal(dryRunRehearsalGuardrails.fixtureRehearsalExamples.some((item: any) => item.fileName === 'valid-safe-dryrun.json' && item.expectedClassification === 'PASS_FOR_REVIEW'), true)
    assert.equal(dryRunRehearsalGuardrails.fixtureRehearsalExamples.some((item: any) => item.fileName === 'writes-performed-red-flag.json' && item.expectedClassification === 'REJECT_DRY_RUN_OUTPUT'), true)
    assert.equal(dryRunRehearsalGuardrails.redFlagMatrix.some((item: any) => item.id === 'WRITES_PERFORMED_TRUE'), true)
    assert.equal(dryRunRehearsalGuardrails.redFlagMatrix.some((item: any) => item.id === 'TOTAL_SCORE_CHANGED'), true)
    assert.equal(dryRunRehearsalGuardrails.redFlagMatrix.some((item: any) => item.id === 'GRADE_ID_CHANGED'), true)
    assert.equal(dryRunRehearsalGuardrails.redFlagMatrix.some((item: any) => item.id === 'PRISMA_SCHEMA_ERROR'), true)
    assert.equal(dryRunRehearsalGuardrails.reviewerDecisionGuide.some((item: any) => item.classification === 'PASS_FOR_REVIEW'), true)
    assert.equal(dryRunRehearsalGuardrails.reviewerDecisionGuide.some((item: any) => item.classification === 'REJECT_DRY_RUN_OUTPUT'), true)
    assert.equal(dryRunRehearsalGuardrails.localOnlyPasteValidator.serverSubmitAvailable, false)
    assert.equal(dryRunRehearsalGuardrails.localOnlyPasteValidator.saveAvailable, false)
    assert.equal(dryRunRehearsalGuardrails.localOnlyPasteValidator.uploadAvailable, false)
    assert.equal(dryRunRehearsalGuardrails.localOnlyPasteValidator.apiCallAvailable, false)
    assert.equal(dryRunRehearsalGuardrails.localOnlyPasteValidator.persistenceAvailable, false)
    assert.equal(dryRunRehearsalGuardrails.copyPayloads.scriptInventory.includes('scripts/backfill-2026-policy-metadata.ts'), true)
    assert.equal(dryRunRehearsalGuardrails.copyPayloads.guardrailChecklist.includes('dry-run output reviewed'), true)
    assert.equal(dryRunRehearsalGuardrails.copyPayloads.fixtureRehearsalGuide.includes('valid-safe-dryrun.json'), true)
    assert.equal(dryRunRehearsalGuardrails.copyPayloads.redFlagMatrix.includes('WRITES_PERFORMED_TRUE'), true)
    assert.equal(dryRunRehearsalGuardrails.copyPayloads.markdown.includes('2026 Dry-run Rehearsal & Guardrails'), true)
    assert.equal(dryRunRehearsalGuardrails.copyPayloads.tsv.includes('script_inventory'), true)
    assert.equal(dryRunRehearsalGuardrails.prohibitedActions.includes('backfill --apply'), true)
    assert.equal(dryRunRehearsalGuardrails.prohibitedActions.includes('Evaluation.totalScore write'), true)
    assert.equal(dryRunRehearsalGuardrails.safety.writesPerformed, false)
    assert.equal(dryRunRehearsalGuardrails.safety.dryRunExecuted, false)
    assert.equal(dryRunRehearsalGuardrails.safety.backfillExecuted, false)
    assert.equal(dryRunRehearsalGuardrails.safety.backfillApplyExecuted, false)
    assert.equal(dryRunRehearsalGuardrails.safety.totalScoreChanged, false)
    assert.equal(dryRunRehearsalGuardrails.safety.gradeIdChanged, false)
    assert.equal(dryRunRehearsalGuardrails.safety.noExecutionButtons, true)
    assert.equal(dryRunRehearsalGuardrails.safety.noApplyButtons, true)
    assert.equal(dryRunRehearsalGuardrails.safety.noScoreGradeWriteButtons, true)

    const commandRunbook = result.backfillDryRunCommandRunbook
    assert.equal(commandRunbook.mode, 'READ_ONLY')
    assert.equal(commandRunbook.status, 'AVAILABLE')
    assert.equal(commandRunbook.summary.currentStage, 'MBO_SETUP_IN_PROGRESS')
    assert.equal(commandRunbook.summary.overallReadinessStatus, 'NEEDS_HR_ACTION')
    assert.equal(commandRunbook.summary.officialActivationStatus, 'BLOCKED')
    assert.equal(commandRunbook.summary.commandReferenceStatus, 'REFERENCE_ONLY')
    assert.equal(commandRunbook.summary.dryRunExecutionStatus, 'NOT_EXECUTED')
    assert.equal(commandRunbook.summary.applyStatus, 'PROHIBITED')
    assert.equal(commandRunbook.operatorSummary.purpose.includes('dry-run-only'), true)
    assert.equal(commandRunbook.preRunChecklist.includes('HR approval for dry-run review only'), true)
    assert.equal(commandRunbook.preRunChecklist.includes('DB backup plan documented'), true)
    assert.equal(commandRunbook.preRunChecklist.includes('target cycle confirmed'), true)
    assert.equal(commandRunbook.dryRunOnlyCommandReference.mode, 'TEXT_ONLY')
    assert.equal(commandRunbook.dryRunOnlyCommandReference.copyOnly, true)
    assert.equal(commandRunbook.dryRunOnlyCommandReference.executeAvailable, false)
    assert.equal(commandRunbook.dryRunOnlyCommandReference.commandText.includes('scripts/dry-run-backfill-2026-policy-metadata.ts'), true)
    assert.equal(commandRunbook.dryRunOnlyCommandReference.commandText.includes('--apply'), false)
    assert.equal(commandRunbook.applyCommandWarning.applyCommandExposed, false)
    assert.equal(commandRunbook.applyCommandWarning.applyIsPartOfThisRunbook, false)
    assert.equal(commandRunbook.applyCommandWarning.guardrailReminder.some((item: string) => item.includes('--backup-confirmed')), true)
    assert.equal(commandRunbook.applyCommandWarning.guardrailReminder.some((item: string) => item.includes('--hr-approved')), true)
    assert.equal(commandRunbook.applyCommandWarning.guardrailReminder.some((item: string) => item.includes('--dry-run-output-reviewed')), true)
    assert.equal(commandRunbook.outputArchiveChecklist.includes('save stdout/stderr'), true)
    assert.equal(commandRunbook.outputArchiveChecklist.includes('save JSON output'), true)
    assert.equal(commandRunbook.logWatchChecklist.includes('P2021'), true)
    assert.equal(commandRunbook.logWatchChecklist.includes('Evaluation.totalScore'), true)
    assert.equal(commandRunbook.abortConditions.includes('dry-run command would include --apply'), true)
    assert.equal(commandRunbook.abortConditions.includes('writesPerformed true'), true)
    assert.equal(commandRunbook.handoffChecklist.includes('paste into local-only output review template'), true)
    assert.equal(commandRunbook.handoffChecklist.includes('do not proceed to apply'), true)
    assert.equal(commandRunbook.prohibitedActions.includes('dry-run execution from UI'), true)
    assert.equal(commandRunbook.prohibitedActions.includes('backfill --apply'), true)
    assert.equal(commandRunbook.prohibitedActions.includes('Evaluation.totalScore write'), true)
    assert.equal(commandRunbook.copyPayloads.operatorSummary.includes('current status'), true)
    assert.equal(commandRunbook.copyPayloads.dryRunCommandReference.includes('executeAvailable: false'), true)
    assert.equal(commandRunbook.copyPayloads.markdown.includes('2026 Backfill Dry-run Command Runbook'), true)
    assert.equal(commandRunbook.copyPayloads.tsv.includes('COMMAND_REFERENCE'), true)
    assert.equal(commandRunbook.safety.writesPerformed, false)
    assert.equal(commandRunbook.safety.dryRunExecuted, false)
    assert.equal(commandRunbook.safety.backfillExecuted, false)
    assert.equal(commandRunbook.safety.backfillApplyExecuted, false)
    assert.equal(commandRunbook.safety.totalScoreChanged, false)
    assert.equal(commandRunbook.safety.gradeIdChanged, false)
    assert.equal(commandRunbook.safety.evaluationsCreated, 0)
    assert.equal(commandRunbook.safety.evaluationItemsCreated, 0)
    assert.equal(commandRunbook.safety.noDryRunExecutionButtons, true)
    assert.equal(commandRunbook.safety.noBackfillExecutionButtons, true)
    assert.equal(commandRunbook.safety.noApplyButtons, true)
    assert.equal(commandRunbook.safety.noScoreGradeWriteButtons, true)
    assert.equal(commandRunbook.safety.noCommandExecutionButtons, true)
    assert.equal(commandRunbook.safety.dryRunCommandIsTextOnly, true)
    assert.equal(commandRunbook.safety.applyCommandHidden, true)

    const freezePack = result.dryRunGoNoGoFreezePack
    assert.equal(freezePack.mode, 'READ_ONLY')
    assert.equal(freezePack.status, 'AVAILABLE')
    assert.equal(freezePack.decision.currentDecision, 'NO_GO')
    assert.equal(freezePack.decision.dryRunReviewStatus, 'NO_GO')
    assert.equal(freezePack.decision.applyStatus, 'NOT_ALLOWED')
    assert.equal(freezePack.noGoReasons.some((item: any) => item.id === 'OFFICIAL_GATE_BLOCKERS_ZERO'), true)
    assert.equal(freezePack.noGoReasons.some((item: any) => item.id === 'MBO_MISSING_ZERO'), true)
    assert.equal(freezePack.noGoReasons.some((item: any) => item.id === 'EVALUATOR_ROUTING_READY'), true)
    assert.equal(freezePack.goConditions.some((item: any) => item.id === 'TEAM_KPI_PENDING_ZERO'), true)
    assert.equal(freezePack.goConditions.some((item: any) => item.id === 'POLICY_CATEGORY_ZERO'), true)
    assert.equal(freezePack.goConditions.some((item: any) => item.id === 'DB_BACKUP_CONFIRMED'), true)
    assert.equal(freezePack.goConditions.some((item: any) => item.id === 'HR_APPROVAL_COLLECTED'), true)
    assert.equal(freezePack.requiredEvidencePack.includes('integrated readiness snapshot export'), true)
    assert.equal(freezePack.requiredEvidencePack.includes('DB backup proof'), true)
    assert.equal(freezePack.hrUnlockActions.includes('clear MBO coverage'), true)
    assert.equal(freezePack.developerUnlockActions.includes('do not run apply'), true)
    assert.equal(freezePack.signOffChecklist.includes('Final dry-run review only acknowledgement'), true)
    assert.equal(freezePack.prohibitedActions.includes('dry-run execution from UI'), true)
    assert.equal(freezePack.prohibitedActions.includes('backfill --apply'), true)
    assert.equal(freezePack.prohibitedActions.includes('Evaluation.totalScore write'), true)
    assert.equal(freezePack.copyPayloads.goNoGoSummary.includes('decision: NO_GO'), true)
    assert.equal(freezePack.copyPayloads.requiredEvidencePack.includes('Command Runbook export'), true)
    assert.equal(freezePack.copyPayloads.markdown.includes('2026 Dry-run Go/No-Go Freeze Pack'), true)
    assert.equal(freezePack.copyPayloads.markdown.includes('## Safety note'), true)
    assert.equal(freezePack.copyPayloads.markdown.includes('이 export는 읽기 전용 보고용입니다.'), true)
    assert.equal(freezePack.copyPayloads.tsv.includes('go_condition'), true)
    assert.equal(freezePack.safety.writesPerformed, false)
    assert.equal(freezePack.safety.dryRunExecuted, false)
    assert.equal(freezePack.safety.backfillExecuted, false)
    assert.equal(freezePack.safety.backfillApplyExecuted, false)
    assert.equal(freezePack.safety.totalScoreChanged, false)
    assert.equal(freezePack.safety.gradeIdChanged, false)
    assert.equal(freezePack.safety.evaluationsCreated, 0)
    assert.equal(freezePack.safety.evaluationItemsCreated, 0)
    assert.equal(freezePack.safety.noDryRunExecutionButtons, true)
    assert.equal(freezePack.safety.noBackfillExecutionButtons, true)
    assert.equal(freezePack.safety.noApplyButtons, true)
    assert.equal(freezePack.safety.noScoreGradeWriteButtons, true)
  })

  await run('2026 end-to-end pilot models the workflow as preview-only without official writes', async () => {
    const { buildEvaluation2026EndToEndPilot } = await import('../src/server/evaluation-2026-end-to-end-pilot')
    const pilot = buildEvaluation2026EndToEndPilot({
      populationDryRun: readyPopulationDryRun({
        employeesWithConfirmedPersonalKpiCount: 1,
        employeesWithConfirmedPersonalKpi: [
          {
            employeeId: 'emp-pilot',
            employeeNo: 'P-001',
            employeeName: 'Pilot Employee',
            departmentName: 'Pilot Team',
            confirmedPersonalKpiCount: 4,
          },
        ],
        wouldCreateSelfEvaluationCount: 1,
        wouldCreateEvaluationItemCount: 4,
      }) as any,
      gradePolicyReadiness: readyGradePolicy() as any,
      flags: makeFlags({
        officialScoringEnabled: false,
        officialGradeEnabled: false,
        aiScoreExclusionEnabled: false,
        backfillApplied: false,
        hrApprovalConfirmed: false,
      }),
    })

    assert.equal(pilot.mode, 'PREVIEW_ONLY')
    assert.equal(pilot.status, 'AVAILABLE')
    assert.equal(pilot.workflowSteps.length, 9)
    assert.equal(pilot.workflowSteps.some((step) => step.id === 'TARGET_SELECTION'), true)
    assert.equal(pilot.workflowSteps.some((step) => step.id === 'SELF_EVALUATION'), true)
    assert.equal(pilot.workflowSteps.some((step) => step.id === 'FIRST_REVIEW'), true)
    assert.equal(pilot.workflowSteps.some((step) => step.id === 'SECOND_FINAL_REVIEW'), true)
    assert.equal(pilot.workflowSteps.some((step) => step.id === 'SCORE_PREVIEW'), true)
    assert.equal(pilot.workflowSteps.some((step) => step.id === 'GRADE_PREVIEW'), true)
    assert.equal(pilot.workflowSteps.some((step) => step.id === 'CEO_FINAL_CONFIRMATION_PREVIEW'), true)
    assert.equal(pilot.summary.canSelectPilotEmployeesSafely, true)
    assert.equal(pilot.summary.canPreviewEvaluationPopulationWithoutWrites, true)
    assert.equal(pilot.summary.canPreviewEvaluationItemsWithoutWrites, true)
    assert.equal(pilot.summary.canSimulateSelfEvaluation, true)
    assert.equal(pilot.summary.canSimulateFirstReview, true)
    assert.equal(pilot.summary.canSimulateSecondFinalReview, true)
    assert.equal(pilot.scorePreview.status, 'READY')
    assert.equal(pilot.scorePreview.organizationPerformanceWeight, 30)
    assert.equal(pilot.scorePreview.personalPerformanceWeight, 70)
    assert.equal(typeof pilot.scorePreview.finalScorePreview === 'number', true)
    assert.equal(pilot.scorePreview.aiExcludedFromAnnualPerformanceScore, true)
    assert.equal(pilot.gradePreview.status, 'READY')
    assert.equal(pilot.ceoFinalConfirmationPreview.finalReviewerStagePreview, 'CEO_ADJUST')
    assert.equal(pilot.ceoFinalConfirmationPreview.adjustmentReasonRequired, true)
    assert.equal(pilot.ceoFinalConfirmationPreview.noFinalizationWrite, true)
    assert.equal(pilot.evaluationItemPreview.every((item) => item.wouldCreateEvaluationItem === false), true)
    assert.equal(pilot.safety.writesPerformed, false)
    assert.equal(pilot.safety.dryRunExecuted, false)
    assert.equal(pilot.safety.backfillApplyExecuted, false)
    assert.equal(pilot.safety.officialScoringEnabled, false)
    assert.equal(pilot.safety.officialGradeEnabled, false)
    assert.equal(pilot.safety.officialAiScoreExclusionEnabled, false)
    assert.equal(pilot.safety.totalScoreChanged, false)
    assert.equal(pilot.safety.gradeIdChanged, false)
    assert.equal(pilot.safety.officialEvaluationsCreated, 0)
    assert.equal(pilot.safety.officialEvaluationItemsCreated, 0)
    assert.equal(pilot.safety.noOfficialActivationButtons, true)
    assert.equal(pilot.safety.noBackfillApplyButtons, true)
    assert.equal(pilot.safety.noScoreGradeWriteButtons, true)
  })

  await run('2026 pilot gap closure keeps workflow previewable while official blockers remain', async () => {
    const { buildEvaluation2026EndToEndPilot } = await import('../src/server/evaluation-2026-end-to-end-pilot')
    const pilot = buildEvaluation2026EndToEndPilot({
      populationDryRun: readyPopulationDryRun({
        employeesMissingConfirmedPersonalKpiCount: 284,
        policyCategoryMissingCount: 1,
        scorePolicyReadiness: {
          summary: {
            violationsCount: 17,
            aiExcludedConfirmation: true,
          },
        },
        leaderEvaluationReadiness: {
          summary: {
            blockerCount: 289,
            missingEvaluatorCount: 289,
            firstReviewMissingPrerequisitesCount: 289,
            secondReviewMissingPrerequisitesCount: 289,
          },
        },
        finalizationCeoReadiness: {
          summary: {
            finalizationBlockerCount: 200,
            calibrationReadinessBlockerCount: 200,
            ceoConfirmationBlockerCount: 200,
          },
        },
      }) as any,
      gradePolicyReadiness: readyGradePolicy() as any,
      flags: makeFlags({
        officialScoringEnabled: false,
        officialGradeEnabled: false,
        aiScoreExclusionEnabled: false,
        backfillApplied: false,
        hrApprovalConfirmed: false,
      }),
    })
    const findPilotStep = (id: string) => {
      const step = pilot.workflowSteps.find((item) => item.id === id)
      assert.ok(step, `missing pilot step ${id}`)
      return step
    }

    assert.equal(pilot.summary.currentDecision, 'PREVIEW_WITH_BLOCKERS')
    assert.equal(pilot.summary.hardBlockedStepCount, 0)
    assert.equal(pilot.summary.previewAvailableStepCount, 9)
    assert.equal(pilot.summary.previewCompletenessPercentage, 100)
    assert.equal(findPilotStep('KPI_ITEMS').status, 'PREVIEW_WITH_BLOCKERS')
    assert.equal(findPilotStep('SELF_EVALUATION').status, 'PREVIEW_WITH_BLOCKERS')
    assert.equal(findPilotStep('FIRST_REVIEW').status, 'PREVIEW_WITH_BLOCKERS')
    assert.equal(findPilotStep('SECOND_FINAL_REVIEW').status, 'PREVIEW_WITH_BLOCKERS')
    assert.equal(findPilotStep('SCORE_PREVIEW').status, 'PREVIEW_WITH_BLOCKERS')
    assert.equal(findPilotStep('CEO_FINAL_CONFIRMATION_PREVIEW').status, 'PREVIEW_WITH_BLOCKERS')
    assert.equal(findPilotStep('SAFETY_CONFIRMATION').status, 'SAFETY_CONFIRMED')
    assert.equal(pilot.evaluationItemPreview.some((item) => item.category === 'ORG_GOAL'), true)
    assert.equal(pilot.evaluationItemPreview.some((item) => item.category === 'PROJECT_T'), true)
    assert.equal(pilot.evaluationItemPreview.some((item) => item.category === 'PROJECT_K'), true)
    assert.equal(pilot.evaluationItemPreview.some((item) => item.category === 'DAILY_WORK'), true)
    assert.equal(pilot.evaluationItemPreview.every((item) => item.previewOnly), true)
    assert.equal(pilot.selfEvaluationPreview.status, 'PREVIEW_WITH_BLOCKERS')
    assert.equal(pilot.selfEvaluationPreview.saveAvailable, false)
    assert.equal(pilot.selfEvaluationPreview.submitAvailable, false)
    assert.equal(pilot.firstReviewPreview.status, 'PREVIEW_WITH_BLOCKERS')
    assert.equal(pilot.firstReviewPreview.missingReviewerWarning !== null, true)
    assert.equal(pilot.secondFinalReviewPreview.status, 'PREVIEW_WITH_BLOCKERS')
    assert.equal(pilot.secondFinalReviewPreview.missingChainWarning !== null, true)
    assert.equal(pilot.scorePreview.calculationStatus, 'READY')
    assert.equal(pilot.scorePreview.officialReadinessStatus, 'BLOCKED')
    assert.equal(pilot.scorePreview.finalScorePreview !== null, true)
    assert.equal(pilot.gradePreview.calculationStatus, 'READY')
    assert.equal(pilot.ceoFinalConfirmationPreview.status, 'PREVIEW_WITH_BLOCKERS')
    assert.equal(pilot.ceoFinalConfirmationPreview.noFinalizationWrite, true)
    assert.equal(pilot.pilotGapTable.length, 9)
    assert.equal(pilot.pilotGapTable.some((row) => row.step === '점수 preview' && row.currentPreviewStatus === 'PREVIEW_WITH_BLOCKERS'), true)
    assert.equal(pilot.safety.writesPerformed, false)
    assert.equal(pilot.safety.officialEvaluationsCreated, 0)
    assert.equal(pilot.safety.officialEvaluationItemsCreated, 0)
    assert.equal(pilot.safety.totalScoreChanged, false)
    assert.equal(pilot.safety.gradeIdChanged, false)
    assert.equal(pilot.safety.officialScoringEnabled, false)
    assert.equal(pilot.safety.officialGradeEnabled, false)
  })

  await run('official activation runbook renders all sections and blocks current position while MBO coverage is low', async () => {
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
      populationDryRun: readyPopulationDryRun({
        employeesMissingConfirmedPersonalKpiCount: 7,
      }) as any,
    })

    const runbook = result.officialActivationRunbook
    assert.equal(runbook.mode, 'READ_ONLY')
    assert.equal(runbook.sections.length, 7)
    assert.equal(findRunbookSection(runbook, 'PRECONDITIONS').status, 'BLOCKED')
    assert.equal(findRunbookSection(runbook, 'BACKFILL_DRY_RUN').status, 'READY_FOR_REVIEW')
    assert.equal(findRunbookSection(runbook, 'BACKFILL_APPLY').status, 'BLOCKED')
    assert.equal(runbook.currentPosition.currentStage, 'Readiness preparation')
    assert.equal(runbook.currentPosition.noExecutionButtonsInUi, true)
    assert.equal(runbook.summary.noExecutionButtonsInUi, true)
    assert.equal(runbook.summary.blockedSectionCount > 0, true)
    assert.equal(runbook.copyPayloads.markdown.includes('2026 공식 전환 Runbook'), true)
    assert.equal(runbook.copyPayloads.prohibitedActions.includes('backfill --apply'), true)
    assert.equal(runbook.copyPayloads.prohibitedActions.includes('Evaluation.totalScore write'), true)
    assert.equal(runbook.safety.writesPerformed, false)
    assert.equal(runbook.safety.backfillExecuted, false)
    assert.equal(runbook.safety.totalScoreChanged, false)
    assert.equal(runbook.safety.gradeIdChanged, false)
  })

  await run('official activation runbook blocks scoring grade and gradeId sequencing', async () => {
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

    const runbook = result.officialActivationRunbook
    assert.equal(findRunbookSection(runbook, 'OFFICIAL_SCORING_ACTIVATION').status, 'BLOCKED')
    assert.equal(findRunbookSection(runbook, 'OFFICIAL_GRADE_ACTIVATION').status, 'BLOCKED')
    assert.equal(findRunbookSection(runbook, 'EVALUATION_TOTAL_SCORE_WRITE').status, 'BLOCKED')
    assert.equal(findRunbookSection(runbook, 'EVALUATION_GRADE_ID_WRITE').status, 'BLOCKED')
    assert.equal(runbook.hrApprovalChecklist.includes('HR confirms DB backup before apply'), true)
    assert.equal(runbook.developerExecutionChecklist.includes('write gradeId last'), true)
    assert.equal(runbook.summary.officialScoringEnabled, false)
    assert.equal(runbook.summary.officialGradeEnabled, false)
    assert.equal(runbook.summary.officialAiScoreExclusionEnabled, false)
  })

  await run('activation readiness can pass in a fully mocked ready state', async () => {
    const result = await getEvaluation2026ActivationReadiness({
      flags: makeFlags(),
      migrationStatus: readyMigration(),
      readinessSummary: readySummary(),
    })

    assert.equal(result.canActivate, true)
    assert.equal(result.blockers.length, 0)
    assert.equal(result.officialWriteGuardSummary.overall.status, 'BLOCK')
    assert.equal(result.officialWriteGuardSummary.officialPopulation.status, 'BLOCK')
    assert.equal(result.officialWriteGuardSummary.scoreWrite.status, 'BLOCK')
    assert.equal(result.officialWriteGuardSummary.gradeWrite.status, 'BLOCK')
    assert.equal(result.officialWriteGuardSummary.finalization.status, 'BLOCK')
    assert.equal(result.officialWriteGuardSummary.blockedReasons.includes('SCHEMA_BOUNDARY_NOT_APPLIED'), true)
    assert.equal(result.officialWriteGuardSummary.blockedReasons.includes('STAGING_REHEARSAL_NOT_COMPLETE'), true)
    assert.equal(result.officialWriteGuardSummary.safety.dbWritesPerformed, false)
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
    const processPreviewGuideSource = read('src/components/evaluation/EvaluationProcessPreviewGuide2026.tsx')
    const performancePageSource = read('src/app/(main)/evaluation/performance/page.tsx')
    const workbenchPageSource = read('src/app/(main)/evaluation/workbench/page.tsx')
    const readinessPageSource = read('src/app/(main)/admin/evaluation-readiness/page.tsx')
    const evaluationOpsPageSource = read('src/app/(main)/admin/evaluation-ops/page.tsx')
    const navigationSource = read('src/lib/navigation.ts')
    const permissionsSource = read('src/lib/auth/permissions.ts')
    const activationSource = read('src/server/evaluation-2026-activation-readiness.ts')
    const actionPlanSource = read('src/server/evaluation-2026-readiness-action-plan.ts')
    const executionBoardSource = read('src/server/evaluation-2026-readiness-execution-board.ts')
    const scenarioSimulatorSource = read('src/server/evaluation-2026-readiness-scenario-simulator.ts')
    const ceoReportSource = read('src/server/evaluation-2026-ceo-report-pack.ts')
    const fastForwardSource = read('src/server/evaluation-2026-fast-forward-operations.ts')
    const preflightSource = read('src/server/evaluation-2026-backfill-dryrun-preflight.ts')
    const dryRunOutputReviewSource = read('src/server/evaluation-2026-dryrun-output-review-template.ts')
    const dryRunRehearsalSource = read('src/server/evaluation-2026-dryrun-rehearsal-guardrails.ts')
    const commandRunbookSource = read('src/server/evaluation-2026-backfill-dryrun-command-runbook.ts')
    const freezePackSource = read('src/server/evaluation-2026-dryrun-go-no-go-freeze.ts')
    const endToEndPilotSource = read('src/server/evaluation-2026-end-to-end-pilot.ts')
    const dryRunOutputReviewerSource = read('src/server/evaluation-2026-dryrun-output-reviewer.ts')
    const backfillSafetyGuardSource = read('scripts/lib/2026-backfill-safety-guard.ts')
    const backfillScriptSource = read('scripts/backfill-2026-policy-metadata.ts')

    assert.equal(routeSource.includes('export async function GET'), true)
    assert.equal(routeSource.includes('getServerSession(authOptions)'), true)
    assert.equal(routeSource.includes('getEvaluation2026ActivationReadinessForSession'), true)
    assert.equal(routeSource.includes('export async function POST'), false)
    assert.equal(routeSource.includes('export async function PATCH'), false)
    assert.equal(routeSource.includes('prisma.'), false)
    assert.equal(clientSource.includes('/api/evaluation/preview-2026/activation-readiness'), true)
    assert.equal(clientSource.includes('2026 공식 전환 차단 조건'), true)
    assert.equal(clientSource.includes('이 화면은 공식 전환 가능 여부를 읽기 전용으로 점검합니다.'), true)
    assert.equal(clientSource.includes('여기서는 기존 데이터 채우기, 점수, 등급, 기능 활성화 스위치를 실행하지 않습니다.'), true)
    assert.equal(clientSource.includes('활성화 버튼 없음'), true)
    assert.equal(clientSource.includes('기존 데이터 실제 반영 조건'), true)
    assert.equal(clientSource.includes('공식 점수 반영 조건'), true)
    assert.equal(clientSource.includes('AI 점수 제외 조건'), true)
    assert.equal(clientSource.includes('공식 등급 반영 조건'), true)
    assert.equal(clientSource.includes('Evaluation.totalScore 쓰기 조건'), true)
    assert.equal(clientSource.includes('Evaluation.gradeId 쓰기 조건'), true)
    assert.equal(clientSource.includes('2026 통합 준비 상태 요약'), true)
    assert.equal(clientSource.includes('autoLoadKey'), true)
    assert.equal(clientSource.includes('요약 다시 불러오기'), true)
    assert.equal(clientSource.includes('공식 전환 준비 상태 불러오기 필요'), true)
    assert.equal(clientSource.includes('이 화면은 2026 공식 전환 준비 상태를 읽기 전용으로 요약합니다.'), true)
    assert.equal(clientSource.includes('기존 데이터 채우기, 공식 점수, 공식 등급, 기능 활성화 스위치는 실행하지 않습니다.'), true)
    assert.equal(clientSource.includes('공식 저장 차단 상태'), true)
    assert.equal(clientSource.includes('공식 평가 생성, 단계 저장, 점수 반영, 등급 반영, 최종 확정이 왜 아직 차단되어 있는지 읽기 전용으로 보여줍니다.'), true)
    assert.equal(clientSource.includes('공식 write API 연결 없음'), true)
    assert.equal(clientSource.includes('공식 저장 차단 상태 - ${row.label}'), true)
    assert.equal(clientSource.includes('공식 평가 생성'), true)
    assert.equal(clientSource.includes('schema boundary migration 미적용'), true)
    assert.equal(clientSource.includes('Baseline 마크다운 내보내기'), true)
    assert.equal(clientSource.includes('## 공식 저장 차단 상태'), true)
    assert.equal(clientSource.includes('공식 점수 반영: ${formatReadinessUiStatus2026(row.status)}'), false)
    assert.equal(activationSource.includes('officialWriteGuardSummary'), true)
    assert.equal(activationSource.includes('buildEvaluation2026OfficialWriteGuardSummary'), true)
    assert.equal(activationSource.includes('summarizeOfficialWriteHold'), true)
    assert.equal(activationSource.includes('schemaBoundaryApplied: false'), true)
    assert.equal(activationSource.includes('dbWritesPerformed: false'), true)
    assert.equal(clientSource.includes('현재 단계'), true)
    assert.equal(clientSource.includes('전체 준비 상태'), true)
    assert.equal(clientSource.includes('주요 해소 필요 항목'), true)
    assert.equal(clientSource.includes('판정 준비 상태'), true)
    assert.equal(clientSource.includes('공식 전환 상태'), true)
    assert.equal(clientSource.includes('금지 작업'), true)
    assert.equal(clientSource.includes('2026 준비 상태 액션 계획'), true)
    assert.equal(clientSource.includes('준비 상태 해소 필요 항목을 실행 항목으로 정리하는 읽기 전용 보드'), true)
    assert.equal(clientSource.includes('이번 주 집중 항목'), true)
    assert.equal(actionPlanSource.includes('MBO 미작성자 작성 요청'), true)
    assert.equal(actionPlanSource.includes('Team KPI pending 검토'), true)
    assert.equal(actionPlanSource.includes('Vercel logs watch'), true)
    assert.equal(actionPlanSource.includes('noMetadataSaveButtons'), true)
    assert.equal(clientSource.includes('알림 발송, 저장, 기존 데이터 채우기, 공식 점수/등급 변경은 수행하지 않습니다.'), true)
    assert.equal(clientSource.includes('2026 준비 상태 실행 보드'), true)
    assert.equal(clientSource.includes('준비 상태 실행 항목을 운영 관리하기 위한 보드'), true)
    assert.equal(clientSource.includes('기준선 요약 지원'), true)
    assert.equal(clientSource.includes('사용 가능한 필터'), true)
    assert.equal(clientSource.includes('인사 안내문 패키지'), true)
    assert.equal(clientSource.includes('경영진 주간 요약'), true)
    assert.equal(clientSource.includes('2026 준비 상태 시나리오 시뮬레이터'), true)
    assert.equal(clientSource.includes('해소 필요 항목 감소 효과를 가정해 보는 읽기 전용 시뮬레이터'), true)
    assert.equal(clientSource.includes('수동 시나리오 입력'), true)
    assert.equal(clientSource.includes('예상 변화'), true)
    assert.equal(clientSource.includes('시나리오 요약 보기'), true)
    assert.equal(clientSource.includes('예상 액션 계획 보기'), true)
    assert.equal(clientSource.includes('baseline 저장'), false)
    assert.equal(clientSource.includes('save tracking button'), false)
    assert.equal(clientSource.includes('2026 대표이사 보고 Pack'), true)
    assert.equal(clientSource.includes('대표이사 보고용 준비 상태 요약을 읽기 전용으로 제공합니다.'), true)
    assert.equal(clientSource.includes('경영요약 복사'), true)
    assert.equal(clientSource.includes('대표이사 보고서 마크다운 복사'), true)
    assert.equal(clientSource.includes('대표이사 의사결정 안건 복사'), true)
    assert.equal(clientSource.includes('시나리오 비교 복사'), true)
    assert.equal(clientSource.includes('대표이사 보고 패키지'), true)
    assert.equal(clientSource.includes('2026 병렬 운영 현황판'), true)
    assert.equal(clientSource.includes('2026 평가 운영을 병렬로 앞당기기 위한 읽기 전용 실행 지도'), true)
    assert.equal(clientSource.includes('병렬 운영 요약'), true)
    assert.equal(clientSource.includes('핵심 진행 경로'), true)
    assert.equal(clientSource.includes('빠른 정리 항목'), true)
    assert.equal(clientSource.includes('담당자별 액션'), true)
    assert.equal(clientSource.includes('최소 안전 진행 조건'), true)
    assert.equal(clientSource.includes('2026 기존 데이터 채우기 사전 점검'), true)
    assert.equal(clientSource.includes('기존 데이터 채우기 사전 실행 검토를 준비하기 위한 읽기 전용 사전 점검'), true)
    assert.equal(clientSource.includes('명령 템플릿은 텍스트 참고 전용'), true)
    assert.equal(clientSource.includes('사전 실행 명령 참고'), true)
    assert.equal(clientSource.includes('예상 사전 실행 결과 점검 목록'), true)
    assert.equal(clientSource.includes('DB 백업 점검 목록'), true)
    assert.equal(clientSource.includes('HR 승인 점검 목록'), true)
    assert.equal(clientSource.includes('개발자 실행 전 점검 목록'), true)
    assert.equal(clientSource.includes('운영 실제 반영 명령은 UI에 배치하지 않습니다.'), true)
    assert.equal(clientSource.includes('2026 사전 실행 결과 검토 양식'), true)
    assert.equal(clientSource.includes('향후 사전 실행 결과를 검토하기 위한 읽기 전용 양식'), true)
    assert.equal(clientSource.includes('로컬 붙여넣기 도구'), true)
    assert.equal(clientSource.includes('서버 제출 가능'), true)
    assert.equal(dryRunOutputReviewSource.includes('붙여넣은 결과를 구조화하지 못했습니다. 수동 검토 템플릿을 사용하세요.'), true)
    assert.equal(clientSource.includes('업로드 가능'), true)
    assert.equal(clientSource.includes('예상 결과'), true)
    assert.equal(clientSource.includes('필수 통과 기준'), true)
    assert.equal(clientSource.includes('위험 신호'), true)
    assert.equal(clientSource.includes('판정 결과 가이드'), true)
    assert.equal(clientSource.includes('다음 액션 매핑'), true)
    assert.equal(clientSource.includes('2026 사전 실행 리허설 및 안전장치'), true)
    assert.equal(clientSource.includes('사전 실행 결과 판독과 실제 반영 안전장치'), true)
    assert.equal(clientSource.includes('스크립트 표면 목록'), true)
    assert.equal(clientSource.includes('실제 반영 안전장치 상태'), true)
    assert.equal(clientSource.includes('예시 결과 리허설'), true)
    assert.equal(clientSource.includes('로컬 전용 붙여넣기 검증기'), true)
    assert.equal(clientSource.includes('로컬 전용 분류'), true)
    assert.equal(clientSource.includes('2026 기존 데이터 채우기 명령 실행 절차서'), true)
    assert.equal(clientSource.includes('향후 사전 실행 검토 전용 절차를 문서화합니다'), true)
    assert.equal(clientSource.includes('운영자 요약'), true)
    assert.equal(clientSource.includes('사전 실행 전 점검 목록'), true)
    assert.equal(clientSource.includes('사전 실행 전용 명령 참고'), true)
    assert.equal(clientSource.includes('실제 반영 명령 경고'), true)
    assert.equal(clientSource.includes('결과 보관 점검 목록'), true)
    assert.equal(clientSource.includes('로그 감시 점검 목록'), true)
    assert.equal(clientSource.includes('중단 조건'), true)
    assert.equal(clientSource.includes('인계 점검 목록'), true)
    assert.equal(clientSource.includes('명시적으로 금지된 명령'), true)
    assert.equal(clientSource.includes('2026 사전 실행 진행 가능 여부 최종 판정'), true)
    assert.equal(clientSource.includes('사전 실행 검토 가능 여부를 읽기 전용으로 판정합니다'), true)
    assert.equal(clientSource.includes('진행 판단 요약 복사'), true)
    assert.equal(clientSource.includes('진행 불가 사유'), true)
    assert.equal(clientSource.includes('진행 조건'), true)
    assert.equal(clientSource.includes('필수 증빙 패키지'), true)
    assert.equal(clientSource.includes('인사 해제 액션'), true)
    assert.equal(clientSource.includes('개발자 해제 액션'), true)
    assert.equal(clientSource.includes('승인 확인 목록'), true)
    assert.equal(clientSource.includes('다음 점검 지점'), true)
    assert.equal(clientSource.includes('최종 판정 내보내기'), true)
    assert.equal(clientSource.includes('최종 판정 복사 항목'), true)
    assert.equal(clientSource.includes('마크다운 내보내기'), true)
    assert.equal(clientSource.includes('TSV 내보내기'), true)
    assert.equal(clientSource.includes('진행 판단 요약 복사'), true)
    assert.equal(clientSource.includes('금지 작업 복사'), true)
    assert.equal(clientSource.includes('진행 판단 데이터를 불러오는 중입니다.'), true)
    assert.equal(clientSource.includes('2026 평가 전체 흐름 미리보기'), true)
    assert.equal(clientSource.includes('2026 평가 전체 흐름을 미리보기/파일럿으로 검증합니다'), true)
    assert.equal(clientSource.includes('미리보기 완성도'), true)
    assert.equal(clientSource.includes('완전 차단'), true)
    assert.equal(clientSource.includes('미리보기 가능한 부분'), true)
    assert.equal(clientSource.includes('공식 실행 전 차단 조건'), true)
    assert.equal(clientSource.includes('실제 저장 금지'), true)
    assert.equal(clientSource.includes('파일럿 보완 표'), true)
    assert.equal(clientSource.includes('현재 미리보기 상태'), true)
    assert.equal(clientSource.includes('공식 실행 차단 조건'), true)
    assert.equal(clientSource.includes('자기평가 미리보기'), true)
    assert.equal(clientSource.includes('1차 평가 미리보기'), true)
    assert.equal(clientSource.includes('2차/최종 평가 미리보기'), true)
    assert.equal(clientSource.includes('점수 미리보기'), true)
    assert.equal(clientSource.includes('등급 미리보기'), true)
    assert.equal(clientSource.includes('대표이사 조정 미리보기'), true)
    assert.equal(clientSource.includes('공식 점수 반영 false'), true)
    assert.equal(clientSource.includes('공식 등급 반영 false'), true)
    assert.equal(clientSource.includes('공식 저장 점수(totalScore) 쓰기'), true)
    assert.equal(clientSource.includes('공식 저장 등급(gradeId) 쓰기'), true)
    assert.equal(clientSource.includes('2026 단계별 체험 미리보기'), true)
    assert.equal(clientSource.includes('로컬 전용'), true)
    assert.equal(clientSource.includes('대상자'), true)
    assert.equal(clientSource.includes('KPI 항목'), true)
    assert.equal(clientSource.includes('자기평가 미리보기'), true)
    assert.equal(clientSource.includes('1차 평가 미리보기'), true)
    assert.equal(clientSource.includes('2차/최종 평가 미리보기'), true)
    assert.equal(clientSource.includes('대표이사 조정 미리보기'), true)
    assert.equal(clientSource.includes('파일럿 완료율'), true)
    assert.equal(clientSource.includes('로컬 점수 미리보기'), true)
    assert.equal(clientSource.includes('로컬 등급 미리보기'), true)
    assert.equal(clientSource.includes('KPI 항목 미리보기'), true)
    assert.equal(clientSource.includes('결과 요약'), true)
    assert.equal(clientSource.includes('1차 평가자 코멘트'), true)
    assert.equal(clientSource.includes('2차/최종 평가자 코멘트'), true)
    assert.equal(clientSource.includes('대표이사 조정 미리보기'), true)
    assert.equal(clientSource.includes('대표이사 조정값이 0이 아니면 사유가 필요합니다'), true)
    assert.equal(clientSource.includes('API 쓰기 호출 없음'), true)
    assert.equal(clientSource.includes('미리보기 요약 보기'), true)
    assert.equal(clientSource.includes("label: '자기평가 미리보기'"), true)
    assert.equal(clientSource.includes("label: '1차 평가 미리보기'"), true)
    assert.equal(clientSource.includes("label: '최종 평가 미리보기'"), true)
    assert.equal(clientSource.includes("label: '점수/등급 미리보기'"), true)
    assert.equal(clientSource.includes('안전 확인 요약 보기'), true)
    assert.equal(clientSource.includes('interactive-pilot-export-markdown'), true)
    assert.equal(clientSource.includes('interactive-pilot-export-tsv'), true)
    assert.equal(clientSource.includes('formatInteractivePilotMarkdown2026'), true)
    assert.equal(clientSource.includes('formatInteractivePilotTsv2026'), true)
    assert.equal(clientSource.includes('onExportPreview(item.key, item.text)'), true)
    assert.equal(clientSource.includes('공식 평가 생성'), true)
    assert.equal(clientSource.includes('공식 점수, 공식 등급, 공식 저장 점수(totalScore), 공식 저장 등급(gradeId), 기존 데이터 채우기는 실행하지 않습니다'), true)
    assert.equal(clientSource.includes('2026 평가 워크벤치 흐름 정렬'), true)
    assert.equal(clientSource.includes('워크벤치 미리보기'), true)
    assert.equal(clientSource.includes('2026 평가 워크벤치 미리보기 화면'), true)
    assert.equal(processPreviewGuideSource.includes('2026 평가 과정 미리보기'), true)
    assert.equal(processPreviewGuideSource.includes('목표 작성부터 최종 점수·등급 preview까지 이어지는 평가 흐름입니다.'), true)
    assert.equal(processPreviewGuideSource.includes('HR 기본점수 부여'), true)
    assert.equal(processPreviewGuideSource.includes('HR 본부검수'), true)
    assert.equal(processPreviewGuideSource.includes('Evaluation.totalScore와 Evaluation.gradeId에는 저장하지 않습니다.'), true)
    assert.equal(clientSource.includes('전용 평가 워크벤치 화면'), true)
    assert.equal(clientSource.includes('전용 평가 워크벤치 미리보기 열기'), true)
    assert.equal(clientSource.includes('workbench-pilot'), true)
    assert.equal(clientSource.includes('DedicatedWorkbenchPilotRoute2026'), true)
    assert.equal(workbenchPageSource.includes('PerformanceMemberInputWorkspace'), true)
    assert.equal(clientSource.includes("props.currentUser?.role === 'ROLE_MEMBER'"), false)
    assert.equal(clientSource.includes('isMemberWorkbenchPilotRoute'), false)
    assert.equal(workbenchPageSource.includes('isMemberWorkbench'), false)
    assert.equal(workbenchPageSource.includes("session.user.role === 'ROLE_MEMBER'"), false)
    assert.equal(clientSource.includes('파일럿 대상자'), true)
    assert.equal(clientSource.includes('로컬 달성 수준'), true)
    assert.equal(clientSource.includes('자기평가'), true)
    assert.equal(clientSource.includes('1차 평가'), true)
    assert.equal(clientSource.includes('2차 평가'), true)
    assert.equal(clientSource.includes('최종 평가'), true)
    assert.equal(clientSource.includes('대표이사 조정'), true)
    assert.equal(clientSource.includes('점수 미리보기'), true)
    assert.equal(clientSource.includes('등급 미리보기'), true)
    assert.equal(clientSource.includes('1차 평가자 코멘트'), true)
    assert.equal(clientSource.includes('2차/최종 평가자 코멘트'), true)
    assert.equal(clientSource.includes('대표이사 조정값'), true)
    assert.equal(clientSource.includes('점수 미리보기 연결'), true)
    assert.equal(clientSource.includes('등급 미리보기 연결'), true)
    assert.equal(clientSource.includes('안전 확인 패널'), true)
    assert.equal(clientSource.includes('API 쓰기 호출 false'), true)
    assert.equal(clientSource.includes('워크벤치 미리보기 요약 보기'), true)
    assert.equal(clientSource.includes('자기평가 항목 미리보기'), true)
    assert.equal(clientSource.includes('대표이사 조정 항목 미리보기'), true)
    assert.equal(clientSource.includes('workbench-pilot-alignment-markdown'), true)
    assert.equal(clientSource.includes('workbench-pilot-alignment-tsv'), true)
    assert.equal(clientSource.includes('KPI 항목별 평가 표'), true)
    assert.equal(clientSource.includes('선택 KPI 항목 상세 패널'), true)
    assert.equal(clientSource.includes('자기평가 항목 미리보기'), true)
    assert.equal(clientSource.includes('1차 평가자 항목 미리보기'), true)
    assert.equal(clientSource.includes('2차/최종 평가 항목 미리보기'), true)
    assert.equal(clientSource.includes('대표이사 조정 항목 미리보기'), true)
    assert.equal(clientSource.includes('점수/등급 보조 패널'), true)
    assert.equal(clientSource.includes('단계 인계 요약'), true)
    assert.equal(clientSource.includes('KPI 항목 표 보기'), true)
    assert.equal(clientSource.includes('선택 KPI 항목 미리보기'), true)
    assert.equal(clientSource.includes('자기평가 항목 미리보기'), true)
    assert.equal(clientSource.includes('1차 평가 항목 미리보기'), true)
    assert.equal(clientSource.includes('2차/최종 평가 항목 미리보기'), true)
    assert.equal(clientSource.includes('대표이사 조정 항목 미리보기'), true)
    assert.equal(clientSource.includes('점수/등급 보조 패널 보기'), true)
    assert.equal(clientSource.includes('단계 인계 요약 보기'), true)
    assert.equal(clientSource.includes('KPI 제목'), true)
    assert.equal(clientSource.includes('로컬 계산 점수'), true)
    assert.equal(clientSource.includes('조정값이 0이 아니면 조정 사유가 필요합니다'), true)
    assert.equal(clientSource.includes('공식 EvaluationItem 생성 false'), true)
    assert.equal(clientSource.includes('공식 평가 저장'), true)
    assert.equal(clientSource.includes('점수 반영, 등급 반영은 수행하지 않습니다'), true)
    assert.equal(clientSource.includes('2026 평가 운영 요약'), true)
    assert.equal(clientSource.includes('오늘 할 일'), true)
    assert.equal(clientSource.includes('평가 워크벤치 바로가기'), true)
    assert.equal(clientSource.includes('공식 전환 상태'), true)
    assert.equal(clientSource.includes('Top 3 해소 필요 항목'), true)
    assert.equal(clientSource.includes('전용 평가 워크벤치 열기'), true)
    assert.equal(clientSource.includes('실제 평가 흐름은 전용 평가 워크벤치에서 미리보기로 확인합니다.'), true)
    assert.equal(clientSource.includes('고급 진단 / 준비 상태 상세'), true)
    assert.equal(clientSource.includes('공식 전환 준비 / 사전 실행 검토 도구'), true)
    assert.equal(clientSource.includes('대표/최종 보고'), true)
    assert.equal(clientSource.includes('개발자/모니터링 전용'), true)
    assert.equal(clientSource.includes('공식 전환 준비 화면에서 상세 준비 상태를 확인하세요.'), true)
    assert.equal(clientSource.includes('공식 전환 준비 화면에서 사전 실행 검토와 사전 점검 도구를 확인하세요.'), true)
    assert.equal(clientSource.includes('공식 전환 준비 화면에서 대표/최종 보고 준비 상태를 확인하세요.'), true)
    assert.equal(clientSource.includes('공식 전환 준비 화면에서 모니터링 전용 항목과 금지 작업을 확인하세요.'), true)
    assert.equal(clientSource.includes('상세 준비 상태 열기'), true)
    assert.equal(clientSource.includes('사전 실행 검토 도구 열기'), true)
    assert.equal(clientSource.includes('대표/최종 보고 열기'), true)
    assert.equal(clientSource.includes('모니터링 전용 항목 열기'), true)
    assert.equal(clientSource.includes('전체 상세 진단 열기'), true)
    assert.equal(clientSource.includes('고급 영역 접힘'), true)
    assert.equal(clientSource.includes('기술 용어 참고'), true)
    assert.equal(clientSource.includes("!isPerformanceDashboardMode ? ("), true)
    assert.equal(clientSource.includes("isPerformanceDashboardMode ? 'hidden'"), false)
    assert.equal(clientSource.includes('상세 공식 전환 진단 분리됨'), false)
    assert.equal(clientSource.includes('용어 설명'), false)
    assert.equal(clientSource.includes('준비 상태'), true)
    assert.equal(clientSource.includes('공식 전환 차단 조건'), true)
    assert.equal(clientSource.includes('해소 필요 항목'), true)
    assert.equal(clientSource.includes('사전 실행 검토(dry-run)'), true)
    assert.equal(clientSource.includes('실제 반영'), true)
    assert.equal(clientSource.includes('기존 데이터 채우기'), true)
    assert.equal(clientSource.includes('공식 점수 반영'), true)
    assert.equal(clientSource.includes('공식 등급 반영'), true)
    assert.equal(clientSource.includes('기능 활성화 스위치'), true)
    assert.equal(clientSource.includes('공식 저장 점수'), true)
    assert.equal(clientSource.includes('공식 저장 등급'), true)
    assert.equal(clientSource.includes('performance-dashboard'), true)
    assert.equal(clientSource.includes('readiness-admin'), true)
    assert.equal(clientSource.includes('2026 MBO/KPI 운영 대시보드'), true)
    assert.equal(clientSource.includes('2026 공식 데이터 준비'), true)
    assert.equal(clientSource.includes('Baseline 내보내기, policyCategory 정리, 공식 저장 차단 상태를 읽기 전용으로 확인합니다.'), true)
    assert.equal(clientSource.includes('href="/admin/evaluation-readiness"'), true)
    assert.equal(clientSource.includes('href="/admin/evaluation-ops"'), true)
    assert.equal(clientSource.includes('href="/evaluation/workbench"'), true)
    assert.equal(clientSource.includes('href="/admin/performance-assignments"'), true)
    assert.equal(clientSource.includes('href="/admin/performance-calendar"'), true)
    assert.equal(clientSource.includes('href="/kpi/personal"'), true)
    assert.equal(clientSource.includes('href="/kpi/monthly"'), true)
    assert.equal(performancePageSource.includes('PerformanceHrOpsDashboard'), true)
    assert.equal(performancePageSource.includes('<PerformanceHrOpsDashboard data={data} />'), true)
    assert.equal(performancePageSource.includes('presentationMode="performance-dashboard"'), false)
    assert.equal(workbenchPageSource.includes('requireProtectedPageSession'), true)
    assert.equal(workbenchPageSource.includes('getEvaluationWorkbenchPageData'), true)
    assert.equal(workbenchPageSource.includes('PerformanceMemberInputWorkspace'), true)
    assert.equal(workbenchPageSource.includes('redirect('), false)
    assert.equal(readinessPageSource.includes("route: '/admin/evaluation-readiness'"), true)
    assert.equal(readinessPageSource.includes('getEvaluationWorkbenchPageData'), true)
    assert.equal(readinessPageSource.includes('presentationMode="readiness-admin"'), true)
    assert.equal(clientSource.includes('PolicyReadiness2026Panel'), true)
    assert.equal(clientSource.includes('공식 준비 상태 대상 주기 지정'), true)
    assert.equal(evaluationOpsPageSource.includes('2026 MBO/KPI 운영 허브'), true)
    assert.equal(evaluationOpsPageSource.includes('/evaluation/performance'), true)
    assert.equal(evaluationOpsPageSource.includes('/evaluation/workbench'), true)
    assert.equal(evaluationOpsPageSource.includes('평가 과정 미리보기'), true)
    assert.equal(evaluationOpsPageSource.includes('자기평가, 1차평가, 본부검수, 최종평가, 점수·등급 preview'), true)
    assert.equal(evaluationOpsPageSource.includes('/admin/evaluation-readiness'), true)
    assert.equal(evaluationOpsPageSource.includes('고급 / 공식 전환 준비 화면'), true)
    assert.equal(navigationSource.includes('KPI/MBO'), true)
    assert.equal(navigationSource.includes('내 KPI/MBO'), true)
    assert.equal(navigationSource.includes('업적평가 운영'), true)
    assert.equal(navigationSource.includes('HR 평가 운영 대시보드'), false)
    assert.equal(navigationSource.includes('업적평가'), true)
    assert.equal(navigationSource.includes('평가 워크벤치 미리보기'), false)
    assert.equal(navigationSource.includes('공식 전환 준비(고급)'), true)
    assert.equal(navigationSource.includes('/admin/evaluation-readiness'), true)
    assert.equal(navigationSource.includes('/admin/evaluation-ops'), true)
    assert.equal(permissionsSource.includes("prefix: '/admin/evaluation-readiness'"), true)
    assert.equal(permissionsSource.includes("prefix: '/admin/evaluation-ops'"), true)
    assert.equal(clientSource.includes('ReadinessExportPreviewDialog'), true)
    assert.equal(clientSource.includes('openExportPreview'), true)
    assert.equal(clientSource.includes('2026 공식 데이터 준비 Baseline'), true)
    assert.equal(clientSource.includes('공식 데이터 준비 Baseline 내보내기'), true)
    assert.equal(clientSource.includes('Baseline 요약 보기'), true)
    assert.equal(clientSource.includes('Baseline 마크다운 내보내기'), true)
    assert.equal(clientSource.includes('Baseline TSV 내보내기'), true)
    assert.equal(clientSource.includes('officialDataReadinessBaseline.copyPayloads.markdown'), true)
    assert.equal(clientSource.includes('officialDataReadinessBaseline.copyPayloads.tsv'), true)
    assert.equal(clientSource.includes('buildOfficialDataReadinessBaselineExport2026'), true)
    assert.equal(clientSource.includes('# 2026 Official Data Readiness Baseline v1'), true)
    assert.equal(clientSource.includes('MBO missing'), true)
    assert.equal(clientSource.includes('confirmed KPI shortage'), true)
    assert.equal(clientSource.includes('Team KPI pending/discussion'), true)
    assert.equal(clientSource.includes('policyCategory missing'), true)
    assert.equal(clientSource.includes('policyCategory 미분류 처리'), true)
    assert.equal(clientSource.includes('공식 평가 생성 전 미분류 KPI의 정책 카테고리를 정리합니다.'), true)
    assert.equal(clientSource.includes('미분류 항목 보기'), true)
    assert.equal(clientSource.includes('정책 카테고리 저장'), true)
    assert.equal(clientSource.includes('Baseline 다시 내보내기'), true)
    assert.equal(clientSource.includes('metadata-only'), true)
    assert.equal(clientSource.includes('공식 평가 생성 없음'), true)
    assert.equal(clientSource.includes('점수/등급 반영 없음'), true)
    assert.equal(clientSource.includes('/api/evaluation/preview-2026/mapping-candidates'), true)
    assert.equal(clientSource.includes('/api/evaluation/preview-2026/policy-metadata'), true)
    assert.equal(clientSource.includes('evaluator routing blockers'), true)
    assert.equal(clientSource.includes('official gate blockers'), true)
    assert.equal(clientSource.includes('미확인'), true)
    assert.equal(clientSource.includes('Current count/status'), true)
    assert.equal(clientSource.includes('no Evaluation.totalScore write'), true)
    assert.equal(clientSource.includes('no Evaluation.gradeId write'), true)
    assert.equal(clientSource.includes('준비 상태 내보내기 미리보기 내용'), true)
    assert.equal(clientSource.includes('클릭하면 내용을 먼저 미리보고 복사/다운로드할 수 있습니다.'), true)
    assert.equal(clientSource.includes('클릭하면 미리보기 후 복사할 수 있습니다.'), true)
    assert.equal(clientSource.includes('클립보드 복사'), true)
    assert.equal(clientSource.includes('다운로드'), true)
    assert.equal(clientSource.includes('복사되었습니다.'), true)
    assert.equal(clientSource.includes('readOnly'), true)
    assert.equal(clientSource.includes('new Blob([exportPreview.content]'), true)
    assert.equal(clientSource.includes('setExportPreview(createReadinessExportPreview(key, text))'), true)
    assert.equal(clientSource.includes('navigator.clipboard.writeText(exportPreview.content)'), true)
    assert.equal(clientSource.includes('serverSubmitAvailable'), true)
    assert.equal(activationSource.includes('readinessActionPlan'), true)
    assert.equal(activationSource.includes('buildEvaluation2026ReadinessActionPlan'), true)
    assert.equal(activationSource.includes('readinessExecutionBoard'), true)
    assert.equal(activationSource.includes('buildEvaluation2026ReadinessExecutionBoard'), true)
    assert.equal(executionBoardSource.includes('Evaluation.totalScore write'), true)
    assert.equal(executionBoardSource.includes('Evaluation.gradeId write'), true)
    assert.equal(executionBoardSource.includes('backfill execution from UI'), true)
    assert.equal(executionBoardSource.includes('score/grade write from UI'), true)
    assert.equal(executionBoardSource.includes('noMetadataSaveButtons'), true)
    assert.equal(executionBoardSource.includes('emailsSent: false'), true)
    assert.equal(executionBoardSource.includes('baseline은 복사/내보내기로 기록해 주세요.'), true)
    assert.equal(scenarioSimulatorSource.includes('MBO 작성 1차 독려'), true)
    assert.equal(scenarioSimulatorSource.includes('Team KPI / policyCategory 정리'), true)
    assert.equal(scenarioSimulatorSource.includes('평가자 배정 1차 정리'), true)
    assert.equal(scenarioSimulatorSource.includes('Full readiness target scenario'), true)
    assert.equal(scenarioSimulatorSource.includes('DRY_RUN_BACKUP_HR_APPROVAL_REQUIRED'), true)
    assert.equal(scenarioSimulatorSource.includes('metadataSaved: false'), true)
    assert.equal(scenarioSimulatorSource.includes('noMetadataSaveButtons'), true)
    assert.equal(scenarioSimulatorSource.includes('backfill execution from UI'), true)
    assert.equal(activationSource.includes('readinessScenarioSimulator'), true)
    assert.equal(activationSource.includes('buildEvaluation2026ReadinessScenarioSimulator'), true)
    assert.equal(activationSource.includes('ceoReportPack'), true)
    assert.equal(activationSource.includes('buildEvaluation2026CeoReportPack'), true)
    assert.equal(activationSource.includes('fastForwardOperationsCockpit'), true)
    assert.equal(activationSource.includes('buildEvaluation2026FastForwardOperationsCockpit'), true)
    assert.equal(activationSource.includes('backfillDryRunPreflightPack'), true)
    assert.equal(activationSource.includes('buildEvaluation2026BackfillDryRunPreflightPack'), true)
    assert.equal(activationSource.includes('dryRunOutputReviewTemplate'), true)
    assert.equal(activationSource.includes('buildEvaluation2026DryRunOutputReviewTemplate'), true)
    assert.equal(activationSource.includes('dryRunRehearsalGuardrails'), true)
    assert.equal(activationSource.includes('buildEvaluation2026DryRunRehearsalGuardrails'), true)
    assert.equal(activationSource.includes('backfillDryRunCommandRunbook'), true)
    assert.equal(activationSource.includes('buildEvaluation2026BackfillDryRunCommandRunbook'), true)
    assert.equal(activationSource.includes('dryRunGoNoGoFreezePack'), true)
    assert.equal(activationSource.includes('buildEvaluation2026DryRunGoNoGoFreezePack'), true)
    assert.equal(activationSource.includes('endToEndPilot2026'), true)
    assert.equal(activationSource.includes('buildEvaluation2026EndToEndPilot'), true)
    assert.equal(ceoReportSource.includes('READY_FOR_REPORT'), true)
    assert.equal(ceoReportSource.includes('CEO decision agenda'), true)
    assert.equal(ceoReportSource.includes('MBO 작성 1차 독려'), true)
    assert.equal(ceoReportSource.includes('scenarioComparison'), true)
    assert.equal(ceoReportSource.includes('Evaluation.totalScore write'), true)
    assert.equal(ceoReportSource.includes('Evaluation.gradeId write'), true)
    assert.equal(ceoReportSource.includes('backfill execution from UI'), true)
    assert.equal(ceoReportSource.includes('noActivationButtons'), true)
    assert.equal(fastForwardSource.includes('MBO Coverage Workstream'), true)
    assert.equal(fastForwardSource.includes('Team KPI / policyCategory Workstream'), true)
    assert.equal(fastForwardSource.includes('Evaluator Routing Workstream'), true)
    assert.equal(fastForwardSource.includes('Developer / Watch Workstream'), true)
    assert.equal(fastForwardSource.includes('Backfill dry-run review'), true)
    assert.equal(fastForwardSource.includes('DB backup plan confirmed'), true)
    assert.equal(fastForwardSource.includes('HR approval collected'), true)
    assert.equal(fastForwardSource.includes('assignment sync without HR approval'), true)
    assert.equal(fastForwardSource.includes('automatic emails/notifications'), true)
    assert.equal(fastForwardSource.includes('noMetadataSaveButtons'), true)
    assert.equal(fastForwardSource.includes('noBackfillExecutionButtons'), true)
    assert.equal(fastForwardSource.includes('noScoreGradeWriteButtons'), true)
    assert.equal(preflightSource.includes('scripts/dry-run-backfill-2026-policy-metadata.ts'), true)
    assert.equal(preflightSource.includes('scripts/backfill-2026-policy-metadata.ts defaults to dry-run and requires explicit --apply'), true)
    assert.equal(preflightSource.includes('TEXT_ONLY'), true)
    assert.equal(preflightSource.includes('executeAvailable: false'), true)
    assert.equal(preflightSource.includes('writesPerformed: false'), true)
    assert.equal(preflightSource.includes('dryRunExecuted: false'), true)
    assert.equal(preflightSource.includes('backfillApplyExecuted: false'), true)
    assert.equal(preflightSource.includes('totalScoreChanged: false'), true)
    assert.equal(preflightSource.includes('gradeIdChanged: false'), true)
    assert.equal(preflightSource.includes('noDryRunExecutionButtons'), true)
    assert.equal(preflightSource.includes('noApplyButtons'), true)
    assert.equal(preflightSource.includes('UI-triggered backfill'), true)
    assert.equal(dryRunOutputReviewSource.includes('2026 Dry-run Output Review Template'), true)
    assert.equal(dryRunOutputReviewSource.includes('writesPerformed must be false'), true)
    assert.equal(dryRunOutputReviewSource.includes('Evaluation.totalScore changes must be 0/false'), true)
    assert.equal(dryRunOutputReviewSource.includes('Evaluation.gradeId changes must be 0/false'), true)
    assert.equal(dryRunOutputReviewSource.includes('P2021 / P2022'), true)
    assert.equal(dryRunOutputReviewSource.includes('JWT_SESSION_ERROR'), true)
    assert.equal(dryRunOutputReviewSource.includes('ACCEPT_FOR_REVIEW'), true)
    assert.equal(dryRunOutputReviewSource.includes('NOT_READY_FOR_APPLY'), true)
    assert.equal(dryRunOutputReviewSource.includes('dry-run execution from UI'), true)
    assert.equal(dryRunOutputReviewSource.includes('serverSubmitAvailable: false'), true)
    assert.equal(dryRunOutputReviewSource.includes('uploadAvailable: false'), true)
    assert.equal(dryRunOutputReviewSource.includes('persistenceAvailable: false'), true)
    assert.equal(dryRunOutputReviewSource.includes('noDryRunExecutionButtons'), true)
    assert.equal(dryRunOutputReviewSource.includes('noServerSubmit'), true)
    assert.equal(dryRunOutputReviewSource.includes('noUpload'), true)
    assert.equal(dryRunOutputReviewSource.includes('noPersistence'), true)
    assert.equal(dryRunRehearsalSource.includes('scripts/backfill-2026-policy-metadata.ts'), true)
    assert.equal(dryRunRehearsalSource.includes('--confirm-2026-production-apply required'), true)
    assert.equal(dryRunRehearsalSource.includes('--backup-confirmed required'), true)
    assert.equal(dryRunRehearsalSource.includes('--hr-approved required'), true)
    assert.equal(dryRunRehearsalSource.includes('--dry-run-output-reviewed required'), true)
    assert.equal(dryRunRehearsalSource.includes('valid-safe-dryrun.json'), true)
    assert.equal(dryRunRehearsalSource.includes('writes-performed-red-flag.json'), true)
    assert.equal(dryRunRehearsalSource.includes('Script surface inventory'), true)
    assert.equal(dryRunRehearsalSource.includes('noExecutionButtons'), true)
    assert.equal(dryRunRehearsalSource.includes('noPersistence'), true)
    assert.equal(commandRunbookSource.includes('2026 Backfill Dry-run Command Runbook'), true)
    assert.equal(commandRunbookSource.includes('scripts/dry-run-backfill-2026-policy-metadata.ts'), true)
    assert.equal(commandRunbookSource.includes('executeAvailable: false'), true)
    assert.equal(commandRunbookSource.includes('applyCommandExposed: false'), true)
    assert.equal(commandRunbookSource.includes('applyIsPartOfThisRunbook: false'), true)
    assert.equal(commandRunbookSource.includes('dry-run command would include --apply'), true)
    assert.equal(commandRunbookSource.includes('paste into local-only output review template'), true)
    assert.equal(commandRunbookSource.includes('dry-run execution from UI'), true)
    assert.equal(commandRunbookSource.includes('backfill --apply'), true)
    assert.equal(commandRunbookSource.includes('Evaluation.totalScore write'), true)
    assert.equal(commandRunbookSource.includes('Evaluation.gradeId write'), true)
    assert.equal(commandRunbookSource.includes('dryRunExecuted: false'), true)
    assert.equal(commandRunbookSource.includes('backfillApplyExecuted: false'), true)
    assert.equal(commandRunbookSource.includes('totalScoreChanged: false'), true)
    assert.equal(commandRunbookSource.includes('gradeIdChanged: false'), true)
    assert.equal(commandRunbookSource.includes('noCommandExecutionButtons'), true)
    assert.equal(commandRunbookSource.includes('dryRunCommandIsTextOnly'), true)
    assert.equal(commandRunbookSource.includes('applyCommandHidden'), true)
    assert.equal(freezePackSource.includes('2026 Dry-run Go/No-Go Freeze Pack'), true)
    assert.equal(freezePackSource.includes('NO_GO'), true)
    assert.equal(freezePackSource.includes('READY_LATER'), true)
    assert.equal(freezePackSource.includes('READY_FOR_REVIEW'), true)
    assert.equal(freezePackSource.includes("applyStatus: 'NOT_ALLOWED'"), true)
    assert.equal(freezePackSource.includes('apply status: ${params.decision.applyStatus}'), true)
    assert.equal(freezePackSource.includes('## No-go reasons'), true)
    assert.equal(freezePackSource.includes('## Go conditions'), true)
    assert.equal(freezePackSource.includes('## Required evidence pack'), true)
    assert.equal(freezePackSource.includes('## Prohibited actions'), true)
    assert.equal(freezePackSource.includes('## Safety note'), true)
    assert.equal(freezePackSource.includes('MBO missing 0 or approved exclusions'), true)
    assert.equal(freezePackSource.includes('evaluator blockers 0 or approved exceptions'), true)
    assert.equal(freezePackSource.includes('DB backup confirmed'), true)
    assert.equal(freezePackSource.includes('HR approval collected'), true)
    assert.equal(freezePackSource.includes('integrated readiness snapshot export'), true)
    assert.equal(freezePackSource.includes('Final dry-run review only acknowledgement'), true)
    assert.equal(freezePackSource.includes('dry-run execution from UI'), true)
    assert.equal(freezePackSource.includes('backfill --apply'), true)
    assert.equal(freezePackSource.includes('Evaluation.totalScore write'), true)
    assert.equal(freezePackSource.includes('Evaluation.gradeId write'), true)
    assert.equal(freezePackSource.includes('이 export는 읽기 전용 보고용입니다.'), true)
    assert.equal(freezePackSource.includes('official scoring/grade'), true)
    assert.equal(freezePackSource.includes('dryRunExecuted: false'), true)
    assert.equal(freezePackSource.includes('backfillApplyExecuted: false'), true)
    assert.equal(freezePackSource.includes('noDryRunExecutionButtons'), true)
    assert.equal(freezePackSource.includes('noApplyButtons'), true)
    assert.equal(freezePackSource.includes('noMetadataSaveButtons'), true)
    assert.equal(endToEndPilotSource.includes('calculateEvaluationScore2026'), true)
    assert.equal(endToEndPilotSource.includes('calculateGradePreview2026'), true)
    assert.equal(endToEndPilotSource.includes('PREVIEW_ONLY'), true)
    assert.equal(endToEndPilotSource.includes('PREVIEW_WITH_BLOCKERS'), true)
    assert.equal(endToEndPilotSource.includes('SAFETY_CONFIRMED'), true)
    assert.equal(endToEndPilotSource.includes('SAMPLE_PILOT_FIXTURE'), true)
    assert.equal(endToEndPilotSource.includes('대상자'), true)
    assert.equal(endToEndPilotSource.includes('KPI 항목'), true)
    assert.equal(endToEndPilotSource.includes('자기평가'), true)
    assert.equal(endToEndPilotSource.includes('1차 평가'), true)
    assert.equal(endToEndPilotSource.includes('2차/최종 평가'), true)
    assert.equal(endToEndPilotSource.includes('점수 preview'), true)
    assert.equal(endToEndPilotSource.includes('등급 preview'), true)
    assert.equal(endToEndPilotSource.includes('대표이사 확정 preview'), true)
    assert.equal(endToEndPilotSource.includes('안전 확인'), true)
    assert.equal(endToEndPilotSource.includes('SELF_EVALUATION'), true)
    assert.equal(endToEndPilotSource.includes('FIRST_REVIEW'), true)
    assert.equal(endToEndPilotSource.includes('SECOND_FINAL_REVIEW'), true)
    assert.equal(endToEndPilotSource.includes('SCORE_PREVIEW'), true)
    assert.equal(endToEndPilotSource.includes('GRADE_PREVIEW'), true)
    assert.equal(endToEndPilotSource.includes('CEO_ADJUST'), true)
    assert.equal(endToEndPilotSource.includes('selfEvaluationPreview'), true)
    assert.equal(endToEndPilotSource.includes('firstReviewPreview'), true)
    assert.equal(endToEndPilotSource.includes('secondFinalReviewPreview'), true)
    assert.equal(endToEndPilotSource.includes('pilotGapTable'), true)
    assert.equal(endToEndPilotSource.includes('previewCompletenessPercentage'), true)
    assert.equal(endToEndPilotSource.includes('officialEvaluationsCreated: 0'), true)
    assert.equal(endToEndPilotSource.includes('officialEvaluationItemsCreated: 0'), true)
    assert.equal(endToEndPilotSource.includes('totalScoreChanged: false'), true)
    assert.equal(endToEndPilotSource.includes('gradeIdChanged: false'), true)
    assert.equal(endToEndPilotSource.includes('noOfficialActivationButtons'), true)
    assert.equal(endToEndPilotSource.includes('noBackfillApplyButtons'), true)
    assert.equal(endToEndPilotSource.includes('noScoreGradeWriteButtons'), true)
    assert.equal(dryRunOutputReviewerSource.includes('reviewEvaluation2026DryRunOutput'), true)
    assert.equal(dryRunOutputReviewerSource.includes('WRITES_PERFORMED_TRUE'), true)
    assert.equal(dryRunOutputReviewerSource.includes('TOTAL_SCORE_CHANGED'), true)
    assert.equal(dryRunOutputReviewerSource.includes('GRADE_ID_CHANGED'), true)
    assert.equal(dryRunOutputReviewerSource.includes('PRISMA_SCHEMA_ERROR'), true)
    assert.equal(dryRunOutputReviewerSource.includes('MISSING_REQUIRED_FIELDS'), true)
    assert.equal(dryRunOutputReviewerSource.includes("from '@/lib/prisma'"), false)
    assert.equal(dryRunOutputReviewerSource.includes('import { prisma'), false)
    assert.equal(dryRunOutputReviewerSource.includes('fetch('), false)
    assert.equal(backfillSafetyGuardSource.includes('--confirm-2026-production-apply'), true)
    assert.equal(backfillSafetyGuardSource.includes('--backup-confirmed'), true)
    assert.equal(backfillSafetyGuardSource.includes('--hr-approved'), true)
    assert.equal(backfillSafetyGuardSource.includes('--dry-run-output-reviewed'), true)
    assert.equal(backfillSafetyGuardSource.includes('assertApplyGuardrails'), true)
    assert.equal(backfillScriptSource.includes('assertApplyGuardrails'), true)
    assert.equal(backfillScriptSource.includes('summarizeBackfillSafetyMode'), true)
    assert.equal(activationSource.includes('integratedReadinessSnapshot'), true)
    assert.equal(activationSource.includes('buildEvaluation2026IntegratedReadinessSnapshot'), true)
    assert.equal(clientSource.includes('2026 공식 전환 실행 절차서'), true)
    assert.equal(clientSource.includes('이 화면은 공식 전환 실행 순서를 읽기 전용으로 안내합니다.'), true)
    assert.equal(clientSource.includes('UI 실행 버튼 없음'), true)
    assert.equal(clientSource.includes('HR 승인 확인 목록'), true)
    assert.equal(clientSource.includes('개발자 실행 확인 목록'), true)
    assert.equal(activationSource.includes('officialActivationRunbook'), true)
    assert.equal(activationSource.includes('BACKFILL_DRY_RUN'), true)
    assert.equal(activationSource.includes('OFFICIAL_SCORING_ACTIVATION'), true)
    assert.equal(activationSource.includes('EVALUATION_GRADE_ID_WRITE'), true)
    assert.equal(activationSource.includes('backfill --apply'), true)
    assert.equal(activationSource.includes('evaluator assignment chain complete'), true)
    assert.equal(activationSource.includes('FEEDBACK_360_LEADERSHIP_READINESS_READY'), true)
    assert.equal(activationSource.includes('FEEDBACK_LEADERSHIP_READINESS_UNRESOLVED'), true)
    assert.equal(activationSource.includes('LEADER_EVALUATION_READINESS_READY'), true)
    assert.equal(activationSource.includes('LEADER_EVALUATION_READINESS_UNRESOLVED'), true)
    assert.equal(activationSource.includes('FINALIZATION_CEO_READINESS_READY'), true)
    assert.equal(activationSource.includes('FINALIZATION_CEO_READINESS_UNRESOLVED'), true)
    assert.equal(clientSource.includes('360/리더십'), true)
    assert.equal(clientSource.includes('리더 평가'), true)
    assert.equal(clientSource.includes('최종/CEO'), true)
    assert.equal(clientSource.includes('2026 최종 확정 준비 상태'), true)
    assert.equal(clientSource.includes('공식 점수, 등급, 보정, 대표이사 확정은 수행하지 않습니다.'), true)
    assert.equal(clientSource.includes('export async function POST'), false)
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
