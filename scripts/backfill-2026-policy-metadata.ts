import 'dotenv/config'
import { writeFileSync } from 'node:fs'
import {
  assertApplyGuardrails,
  parseBackfillSafetyArgs,
  summarizeBackfillSafetyMode,
} from './lib/2026-backfill-safety-guard'
import {
  classifyEvaluationPolicyItem,
  type EvaluationPolicyClassification,
} from '../src/lib/evaluation-policy-2026-classification'
import {
  EVALUATION_POLICY_2026,
  type AiCapabilityRecognitionRouteCode,
} from '../src/lib/evaluation-policy-2026'
import {
  assertPolicyBackfillCanApply,
  baseScoreForCategory,
  buildAiGateCasePolicyMetadataUpdate,
  buildEvaluationItemPolicyMetadataUpdate,
  buildPersonalKpiPolicyMetadataUpdate,
  ensureParentDir,
  getAutoBackfillableAiRouteRows,
  getAutoBackfillablePolicyRows,
  parsePolicyBackfillArgs,
  policyBackfillRowsToCsv,
  scorePolicySnapshotForCategory,
  summarizePolicyBackfillPlan,
  writePolicyBackfillBackup,
  type AiPolicyRouteBackfillPlanRow,
  type PolicyBackfillPlan,
  type PolicyBackfillPlanRow,
} from '../src/lib/evaluation-policy-2026-backfill'

type RequiredColumn = {
  tableName: string
  columnName: string
}

const REQUIRED_APPLY_COLUMNS: RequiredColumn[] = [
  { tableName: 'personal_kpis', columnName: 'policyCategory' },
  { tableName: 'personal_kpis', columnName: 'policyCategoryConfidence' },
  { tableName: 'personal_kpis', columnName: 'policyCategorySource' },
  { tableName: 'personal_kpis', columnName: 'policyCategoryReviewNote' },
  { tableName: 'evaluation_items', columnName: 'policyCategory' },
  { tableName: 'evaluation_items', columnName: 'scoreContributionType' },
  { tableName: 'evaluation_items', columnName: 'policyFormulaVersion' },
  { tableName: 'evaluation_items', columnName: 'basePolicyScore' },
  { tableName: 'evaluation_items', columnName: 'adjustmentScore' },
  { tableName: 'evaluation_items', columnName: 'policyScoreSnapshot' },
  { tableName: 'ai_competency_gate_cases', columnName: 'policyVersion' },
  { tableName: 'ai_competency_gate_cases', columnName: 'policyRecognitionRoute' },
]

function isAutoBackfillable(category: EvaluationPolicyClassification, manualReviewRequired: boolean) {
  return category !== 'UNKNOWN' && !manualReviewRequired
}

function contributionTypeFor(category: EvaluationPolicyClassification) {
  if (category === 'ORG_GOAL') return 'ORGANIZATION' as const
  if (category === 'PROJECT_T' || category === 'PROJECT_K' || category === 'DAILY_WORK') {
    return 'PERSONAL' as const
  }
  return undefined
}

function routeForGateTrack(track?: string | null): {
  route: AiCapabilityRecognitionRouteCode | 'UNKNOWN'
  reason: string
} {
  if (track === 'AI_PROJECT_EXECUTION') {
    return {
      route: 'AI_PROJECT_TK',
      reason: 'AI 기반 프로젝트 수행 트랙은 2026 정책의 AI 기반 프로젝트 T/K 인정 경로 후보입니다.',
    }
  }
  if (track === 'AI_USE_CASE_EXPANSION') {
    return {
      route: 'ORG_CONTRIBUTION_USE_CASE',
      reason: 'AI 활용 사례 확산 트랙은 조직 기여 AI 활용 사례 인정 경로 후보입니다.',
    }
  }
  return {
    route: 'UNKNOWN',
    reason: 'AI gate case track이 없어 인정 경로 수동 검토가 필요합니다.',
  }
}

async function buildPolicyBackfillPlan(params: {
  prisma: typeof import('../src/lib/prisma').prisma
  year: number
}) {
  const personalKpis = await params.prisma.personalKpi.findMany({
    where: {
      evalYear: params.year,
    },
    select: {
      id: true,
      employeeId: true,
      kpiName: true,
      kpiType: true,
      definition: true,
      formula: true,
      linkedOrgKpiId: true,
      tags: true,
      employee: {
        select: {
          id: true,
          empName: true,
        },
      },
      linkedOrgKpi: {
        select: {
          id: true,
          kpiName: true,
          kpiCategory: true,
          teamKpiReviewItems: {
            orderBy: {
              createdAt: 'desc',
            },
            take: 3,
            select: {
              verdict: true,
            },
          },
        },
      },
    },
    orderBy: [{ employeeId: 'asc' }, { kpiName: 'asc' }],
  })

  const evaluationItems = await params.prisma.evaluationItem.findMany({
    where: {
      evaluation: {
        evalCycle: {
          evalYear: params.year,
        },
      },
    },
    select: {
      id: true,
      evaluation: {
        select: {
          id: true,
          evalStage: true,
          targetId: true,
          target: {
            select: {
              empName: true,
            },
          },
        },
      },
      personalKpi: {
        select: {
          id: true,
          kpiName: true,
          kpiType: true,
          definition: true,
          formula: true,
          linkedOrgKpiId: true,
          tags: true,
          linkedOrgKpi: {
            select: {
              id: true,
              kpiName: true,
              kpiCategory: true,
            },
          },
        },
      },
    },
    orderBy: [{ evaluationId: 'asc' }, { personalKpiId: 'asc' }],
  })

  const gateCases = await params.prisma.aiCompetencyGateCase.findMany({
    where: {
      assignment: {
        cycle: {
          evalCycle: {
            evalYear: params.year,
          },
        },
      },
    },
    select: {
      id: true,
      track: true,
      assignment: {
        select: {
          employeeId: true,
          employeeNameSnapshot: true,
        },
      },
    },
    orderBy: [{ assignmentId: 'asc' }],
  })

  const externalCertClaims = await params.prisma.aiCompetencyExternalCertClaim.findMany({
    where: {
      cycle: {
        evalCycle: {
          evalYear: params.year,
        },
      },
    },
    include: {
      employee: {
        select: {
          empName: true,
        },
      },
    },
    orderBy: [{ employeeId: 'asc' }, { submittedAt: 'asc' }],
  })

  const rows: PolicyBackfillPlanRow[] = []

  for (const kpi of personalKpis) {
    const classification = classifyEvaluationPolicyItem({
      kpiName: kpi.kpiName,
      definition: kpi.definition,
      formula: kpi.formula,
      kpiType: kpi.kpiType,
      linkedOrgKpiId: kpi.linkedOrgKpiId,
      linkedOrgKpiCategory: kpi.linkedOrgKpi?.kpiCategory,
      linkedOrgKpiTitle: kpi.linkedOrgKpi?.kpiName,
      tags: kpi.tags,
      reviewVerdicts: kpi.linkedOrgKpi?.teamKpiReviewItems.map((item) => item.verdict),
    })
    const autoBackfillable = isAutoBackfillable(
      classification.category,
      classification.manualReviewRequired
    )

    rows.push({
      recordType: 'PersonalKpi',
      id: kpi.id,
      employeeId: kpi.employeeId,
      employeeName: kpi.employee.empName,
      title: kpi.kpiName,
      proposedPolicyCategory: classification.category,
      proposedContributionType: contributionTypeFor(classification.category),
      proposedFormulaVersion: autoBackfillable ? EVALUATION_POLICY_2026.version : undefined,
      proposedBaseScore: autoBackfillable ? baseScoreForCategory(classification.category) : undefined,
      proposedPolicyScoreSnapshot: autoBackfillable
        ? scorePolicySnapshotForCategory(classification.category)
        : undefined,
      confidence: classification.confidence,
      plannedAction: autoBackfillable ? 'BACKFILL_METADATA' : 'MANUAL_REVIEW_NO_WRITE',
      reasons: classification.reasons.join(' '),
    })
  }

  for (const item of evaluationItems) {
    const kpi = item.personalKpi
    const classification = classifyEvaluationPolicyItem({
      kpiName: kpi.kpiName,
      definition: kpi.definition,
      formula: kpi.formula,
      kpiType: kpi.kpiType,
      linkedOrgKpiId: kpi.linkedOrgKpiId,
      linkedOrgKpiCategory: kpi.linkedOrgKpi?.kpiCategory,
      linkedOrgKpiTitle: kpi.linkedOrgKpi?.kpiName,
      tags: kpi.tags,
    })
    const autoBackfillable = isAutoBackfillable(
      classification.category,
      classification.manualReviewRequired
    )

    rows.push({
      recordType: 'EvaluationItem',
      id: item.id,
      employeeId: item.evaluation.targetId,
      employeeName: item.evaluation.target.empName,
      evaluationId: item.evaluation.id,
      evalStage: item.evaluation.evalStage,
      title: kpi.kpiName,
      proposedPolicyCategory: classification.category,
      proposedContributionType: contributionTypeFor(classification.category),
      proposedFormulaVersion: autoBackfillable ? EVALUATION_POLICY_2026.version : undefined,
      proposedBaseScore: autoBackfillable ? baseScoreForCategory(classification.category) : undefined,
      proposedPolicyScoreSnapshot: autoBackfillable
        ? scorePolicySnapshotForCategory(classification.category)
        : undefined,
      confidence: classification.confidence,
      plannedAction: autoBackfillable ? 'BACKFILL_METADATA' : 'MANUAL_REVIEW_NO_WRITE',
      reasons: classification.reasons.join(' '),
    })
  }

  const aiPolicyRoutes: AiPolicyRouteBackfillPlanRow[] = gateCases.map((record) => {
    const resolved = routeForGateTrack(record.track)
    return {
      recordType: 'AiCompetencyGateCase',
      id: record.id,
      employeeId: record.assignment.employeeId,
      employeeName: record.assignment.employeeNameSnapshot,
      proposedPolicyVersion: EVALUATION_POLICY_2026.version,
      proposedRecognitionRoute: resolved.route,
      plannedAction: resolved.route === 'UNKNOWN' ? 'MANUAL_REVIEW_NO_WRITE' : 'BACKFILL_METADATA',
      reasons: resolved.reason,
    }
  })

  for (const claim of externalCertClaims) {
    aiPolicyRoutes.push({
      recordType: 'AiCompetencyExternalCertClaim',
      id: claim.id,
      employeeId: claim.employeeId,
      employeeName: claim.employee.empName,
      proposedPolicyVersion: EVALUATION_POLICY_2026.version,
      proposedRecognitionRoute: 'AI_PRACTICAL_CERTIFICATION',
      plannedAction: 'MANUAL_REVIEW_NO_WRITE',
      reasons:
        '구형 외부 인증 claim은 AI 실무 역량 인증 경로 후보이나, Phase 0.6에서는 gate case metadata로 자동 변환하지 않습니다.',
    })
  }

  return {
    dryRun: true,
    writesPerformed: false,
    policyVersion: EVALUATION_POLICY_2026.version,
    evalYear: params.year,
    generatedAt: new Date().toISOString(),
    rows,
    aiPolicyRoutes,
  } satisfies PolicyBackfillPlan
}

async function assertMigrationColumnsExist(prisma: typeof import('../src/lib/prisma').prisma) {
  const rows = await prisma.$queryRawUnsafe<Array<{ table_name: string; column_name: string }>>(
    `
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND (
          table_name = 'personal_kpis'
          OR table_name = 'evaluation_items'
          OR table_name = 'ai_competency_gate_cases'
        )
    `
  )
  const available = new Set(rows.map((row) => `${row.table_name}.${row.column_name}`))
  const missing = REQUIRED_APPLY_COLUMNS.filter(
    (column) => !available.has(`${column.tableName}.${column.columnName}`)
  )

  if (missing.length) {
    throw new Error(
      `--apply refused because Phase 0.5 migration columns are missing: ${missing
        .map((column) => `${column.tableName}.${column.columnName}`)
        .join(', ')}`
    )
  }
}

async function applyPolicyBackfill(params: {
  prisma: typeof import('../src/lib/prisma').prisma
  plan: PolicyBackfillPlan
}) {
  const policyRows = getAutoBackfillablePolicyRows(params.plan.rows)
  const aiRows = getAutoBackfillableAiRouteRows(params.plan.aiPolicyRoutes)

  let personalKpiUpdated = 0
  let evaluationItemUpdated = 0
  let aiGateCaseUpdated = 0

  await params.prisma.$transaction(async (tx) => {
    for (const row of policyRows) {
      if (row.recordType === 'PersonalKpi') {
        const data = buildPersonalKpiPolicyMetadataUpdate(row)
        if (!data) continue
        await tx.personalKpi.update({
          where: { id: row.id },
          data,
        })
        personalKpiUpdated += 1
      } else if (row.recordType === 'EvaluationItem') {
        const data = buildEvaluationItemPolicyMetadataUpdate(row)
        if (!data) continue
        await tx.evaluationItem.update({
          where: { id: row.id },
          data,
        })
        evaluationItemUpdated += 1
      }
    }

    for (const row of aiRows) {
      const data = buildAiGateCasePolicyMetadataUpdate(row)
      if (!data) continue
      await tx.aiCompetencyGateCase.update({
        where: { id: row.id },
        data,
      })
      aiGateCaseUpdated += 1
    }
  })

  return {
    personalKpiUpdated,
    evaluationItemUpdated,
    aiGateCaseUpdated,
  }
}

function printPlan(plan: PolicyBackfillPlan) {
  console.log('[backfill] 2026 policy metadata plan')
  for (const row of plan.rows) {
    console.log(
      `- ${row.plannedAction} ${row.recordType} ${row.id} ${row.employeeName ?? ''} "${row.title}" => ${row.proposedPolicyCategory} (${row.reasons})`
    )
  }
  for (const row of plan.aiPolicyRoutes) {
    console.log(
      `- ${row.plannedAction} ${row.recordType} ${row.id} ${row.employeeName} => ${row.proposedRecognitionRoute} (${row.reasons})`
    )
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.warn('[backfill] DATABASE_URL is not set. Skipping.')
    return
  }

  const args = parsePolicyBackfillArgs(process.argv.slice(2))
  const safetyArgs = parseBackfillSafetyArgs(process.argv.slice(2), {
    expectedYear: EVALUATION_POLICY_2026.year,
    expectedPolicyVersion: EVALUATION_POLICY_2026.version,
    env: process.env,
  })
  const { prisma } = await import('../src/lib/prisma')

  try {
    console.log('[backfill] 2026 apply safety guard')
    console.log(JSON.stringify(summarizeBackfillSafetyMode(safetyArgs), null, 2))

    const plan = await buildPolicyBackfillPlan({
      prisma,
      year: args.year,
    })
    const summary = summarizePolicyBackfillPlan(plan)

    printPlan(plan)
    console.log('[backfill] summary')
    console.log(JSON.stringify(summary, null, 2))

    if (args.jsonPath) {
      ensureParentDir(args.jsonPath)
      writeFileSync(args.jsonPath, `${JSON.stringify({ ...plan, summary }, null, 2)}\n`, 'utf8')
      console.log(`[backfill] JSON report written: ${args.jsonPath}`)
    }

    if (args.csvPath) {
      ensureParentDir(args.csvPath)
      writeFileSync(args.csvPath, `${policyBackfillRowsToCsv(plan.rows)}\n`, 'utf8')
      console.log(`[backfill] CSV report written: ${args.csvPath}`)
    }

    if (!args.apply) {
      console.log('[backfill] dry-run only. No writes performed. Pass --apply to write metadata.')
      return
    }

    assertApplyGuardrails(safetyArgs)
    assertPolicyBackfillCanApply(plan, {
      apply: args.apply,
      excludeManualReview: args.excludeManualReview,
    })
    await assertMigrationColumnsExist(prisma)
    const backupPath = writePolicyBackfillBackup({
      backupDir: args.backupDir,
      plan,
      summary,
    })
    console.log(`[backfill] backup written before apply: ${backupPath}`)

    const result = await applyPolicyBackfill({
      prisma,
      plan,
    })
    console.log('[backfill] apply completed')
    console.log(JSON.stringify(result, null, 2))
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error('[backfill] failed', error)
  process.exitCode = 1
})
