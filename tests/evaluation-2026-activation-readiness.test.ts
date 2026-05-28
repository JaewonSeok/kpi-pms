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
    const activationSource = read('src/server/evaluation-2026-activation-readiness.ts')
    const actionPlanSource = read('src/server/evaluation-2026-readiness-action-plan.ts')
    const executionBoardSource = read('src/server/evaluation-2026-readiness-execution-board.ts')
    const scenarioSimulatorSource = read('src/server/evaluation-2026-readiness-scenario-simulator.ts')
    const ceoReportSource = read('src/server/evaluation-2026-ceo-report-pack.ts')
    const fastForwardSource = read('src/server/evaluation-2026-fast-forward-operations.ts')

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
    assert.equal(clientSource.includes('2026 통합 readiness snapshot'), true)
    assert.equal(clientSource.includes('autoLoadKey'), true)
    assert.equal(clientSource.includes('snapshot 다시 불러오기'), true)
    assert.equal(clientSource.includes('activation readiness load 필요'), true)
    assert.equal(clientSource.includes('이 화면은 2026 공식 전환 준비 상태를 읽기 전용으로 요약합니다.'), true)
    assert.equal(clientSource.includes('backfill, 공식 점수, 공식 등급, feature flag는 실행하지 않습니다.'), true)
    assert.equal(clientSource.includes('현재 단계'), true)
    assert.equal(clientSource.includes('overall readiness status'), true)
    assert.equal(clientSource.includes('top blockers'), true)
    assert.equal(clientSource.includes('Decision readiness'), true)
    assert.equal(clientSource.includes('Official activation state'), true)
    assert.equal(clientSource.includes('Prohibited actions'), true)
    assert.equal(clientSource.includes('2026 Readiness Action Plan'), true)
    assert.equal(clientSource.includes('readiness blocker를 실행 항목으로 정리하는 읽기 전용 보드'), true)
    assert.equal(clientSource.includes('This week focus'), true)
    assert.equal(actionPlanSource.includes('MBO 미작성자 작성 요청'), true)
    assert.equal(actionPlanSource.includes('Team KPI pending 검토'), true)
    assert.equal(actionPlanSource.includes('Vercel logs watch'), true)
    assert.equal(actionPlanSource.includes('noMetadataSaveButtons'), true)
    assert.equal(clientSource.includes('알림 발송, 저장, backfill, 공식 점수/등급 변경은 수행하지 않습니다.'), true)
    assert.equal(clientSource.includes('2026 Readiness Execution Board'), true)
    assert.equal(clientSource.includes('readiness 실행 항목을 운영 관리하기 위한 보드'), true)
    assert.equal(clientSource.includes('Baseline snapshot support'), true)
    assert.equal(clientSource.includes('Filters available'), true)
    assert.equal(clientSource.includes('HR communication package'), true)
    assert.equal(clientSource.includes('Executive weekly report'), true)
    assert.equal(clientSource.includes('2026 Readiness Scenario Simulator'), true)
    assert.equal(clientSource.includes('blocker 감소 효과를 가정해 보는 read-only 시뮬레이터'), true)
    assert.equal(clientSource.includes('Manual scenario inputs'), true)
    assert.equal(clientSource.includes('Projected delta'), true)
    assert.equal(clientSource.includes('Scenario summary'), true)
    assert.equal(clientSource.includes('Projected action plan'), true)
    assert.equal(clientSource.includes('baseline 저장'), false)
    assert.equal(clientSource.includes('save tracking button'), false)
    assert.equal(clientSource.includes('2026 대표이사 보고 Pack'), true)
    assert.equal(clientSource.includes('대표이사 보고용 readiness 요약을 읽기 전용으로 제공합니다.'), true)
    assert.equal(clientSource.includes('경영요약 복사'), true)
    assert.equal(clientSource.includes('대표이사 보고서 Markdown 복사'), true)
    assert.equal(clientSource.includes('CEO decision agenda 복사'), true)
    assert.equal(clientSource.includes('Scenario comparison 복사'), true)
    assert.equal(clientSource.includes('CEO report pack'), true)
    assert.equal(clientSource.includes('2026 Fast-Forward Operations Cockpit'), true)
    assert.equal(clientSource.includes('2026 평가 운영을 병렬로 앞당기기 위한 read-only 실행 지도'), true)
    assert.equal(clientSource.includes('Fast-forward summary'), true)
    assert.equal(clientSource.includes('Critical path'), true)
    assert.equal(clientSource.includes('Quick wins'), true)
    assert.equal(clientSource.includes('Owner action queues'), true)
    assert.equal(clientSource.includes('Minimum safe path'), true)
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
    assert.equal(activationSource.includes('integratedReadinessSnapshot'), true)
    assert.equal(activationSource.includes('buildEvaluation2026IntegratedReadinessSnapshot'), true)
    assert.equal(clientSource.includes('2026 공식 전환 Runbook'), true)
    assert.equal(clientSource.includes('이 화면은 공식 전환 실행 순서를 읽기 전용으로 안내합니다.'), true)
    assert.equal(clientSource.includes('No execution buttons in UI'), true)
    assert.equal(clientSource.includes('HR approval checklist'), true)
    assert.equal(clientSource.includes('Developer execution checklist'), true)
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
    assert.equal(clientSource.includes('2026 최종 확정 readiness'), true)
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
