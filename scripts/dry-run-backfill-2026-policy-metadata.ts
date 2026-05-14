import 'dotenv/config'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import {
  classifyEvaluationPolicyItem,
  type EvaluationPolicyClassification,
} from '../src/lib/evaluation-policy-2026-classification'
import {
  EVALUATION_POLICY_2026,
  type AiCapabilityRecognitionRouteCode,
  type EvaluationPolicyItemCategoryCode,
} from '../src/lib/evaluation-policy-2026'

type Args = {
  year: number
  jsonPath?: string
  csvPath?: string
}

type BackfillPlanRow = {
  recordType: 'PersonalKpi' | 'EvaluationItem'
  id: string
  employeeId?: string
  employeeName?: string
  evaluationId?: string
  evalStage?: string
  title: string
  currentPolicyCategory?: string | null
  proposedPolicyCategory: EvaluationPolicyClassification
  proposedContributionType?: 'ORGANIZATION' | 'PERSONAL'
  proposedFormulaVersion?: string
  proposedBaseScoreMetadata?: string
  confidence: number
  plannedAction: 'BACKFILL_METADATA' | 'MANUAL_REVIEW_NO_WRITE'
  reasons: string
}

type AiPolicyRoutePlanRow = {
  recordType: 'AiCompetencyGateCase' | 'AiCompetencyExternalCertClaim'
  id: string
  employeeId: string
  employeeName: string
  currentPolicyVersion?: string | null
  currentPolicyRecognitionRoute?: string | null
  proposedPolicyVersion: string
  proposedRecognitionRoute: AiCapabilityRecognitionRouteCode | 'UNKNOWN'
  plannedAction: 'BACKFILL_METADATA' | 'MANUAL_REVIEW_NO_WRITE'
  reasons: string
}

function parseArgs(argv: string[]): Args {
  const result: Args = {
    year: EVALUATION_POLICY_2026.year,
  }

  for (const arg of argv) {
    if (arg.startsWith('--year=')) {
      const value = Number(arg.slice('--year='.length))
      if (Number.isInteger(value)) result.year = value
    } else if (arg.startsWith('--json=')) {
      result.jsonPath = arg.slice('--json='.length)
    } else if (arg.startsWith('--csv=')) {
      result.csvPath = arg.slice('--csv='.length)
    }
  }

  return result
}

function ensureParentDir(filePath: string) {
  mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true })
}

function escapeCsv(value: unknown) {
  const text = String(value ?? '')
  if (!/[",\n\r]/.test(text)) return text
  return `"${text.replace(/"/g, '""')}"`
}

function rowsToCsv(rows: BackfillPlanRow[]) {
  const headers: Array<keyof BackfillPlanRow> = [
    'recordType',
    'id',
    'employeeId',
    'employeeName',
    'evaluationId',
    'evalStage',
    'title',
    'currentPolicyCategory',
    'proposedPolicyCategory',
    'proposedContributionType',
    'proposedFormulaVersion',
    'proposedBaseScoreMetadata',
    'confidence',
    'plannedAction',
    'reasons',
  ]

  return [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => escapeCsv(row[header])).join(',')),
  ].join('\n')
}

function increment(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1)
}

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

function baseScoreMetadataFor(category: EvaluationPolicyClassification) {
  if (category === 'UNKNOWN') return undefined
  const categoryConfig = EVALUATION_POLICY_2026.categories[category as EvaluationPolicyItemCategoryCode]
  if ('baselineScores' in categoryConfig && categoryConfig.baselineScores) {
    return JSON.stringify({
      target: categoryConfig.baselineScores.target,
      excellent: categoryConfig.baselineScores.excellent,
    })
  }
  if ('maxScore' in categoryConfig && categoryConfig.maxScore) {
    return JSON.stringify({
      maxScore: categoryConfig.maxScore,
    })
  }
  return undefined
}

function summarizePlanRows(rows: BackfillPlanRow[]) {
  const byAction = new Map<string, number>()
  const byCategory = new Map<string, number>()

  for (const row of rows) {
    increment(byAction, row.plannedAction)
    increment(byCategory, row.proposedPolicyCategory)
  }

  return {
    byAction: Object.fromEntries(byAction),
    byCategory: Object.fromEntries(byCategory),
  }
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

async function main() {
  if (!process.env.DATABASE_URL) {
    console.warn('[dry-run] DATABASE_URL is not set. Skipping backfill preview.')
    return
  }

  const args = parseArgs(process.argv.slice(2))
  const { prisma } = await import('../src/lib/prisma')

  try {
    const personalKpis = await prisma.personalKpi.findMany({
      where: {
        evalYear: args.year,
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

    const evaluationItems = await prisma.evaluationItem.findMany({
      where: {
        evaluation: {
          evalCycle: {
            evalYear: args.year,
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

    const gateCases = await prisma.aiCompetencyGateCase.findMany({
      where: {
        assignment: {
          cycle: {
            evalCycle: {
              evalYear: args.year,
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

    const externalCertClaims = await prisma.aiCompetencyExternalCertClaim.findMany({
      where: {
        cycle: {
          evalCycle: {
            evalYear: args.year,
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

    const rows: BackfillPlanRow[] = []

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
        currentPolicyCategory: null,
        proposedPolicyCategory: classification.category,
        proposedContributionType: contributionTypeFor(classification.category),
        proposedFormulaVersion: autoBackfillable ? EVALUATION_POLICY_2026.version : undefined,
        proposedBaseScoreMetadata: autoBackfillable
          ? baseScoreMetadataFor(classification.category)
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
        currentPolicyCategory: null,
        proposedPolicyCategory: classification.category,
        proposedContributionType: contributionTypeFor(classification.category),
        proposedFormulaVersion: autoBackfillable ? EVALUATION_POLICY_2026.version : undefined,
        proposedBaseScoreMetadata: autoBackfillable
          ? baseScoreMetadataFor(classification.category)
          : undefined,
        confidence: classification.confidence,
        plannedAction: autoBackfillable ? 'BACKFILL_METADATA' : 'MANUAL_REVIEW_NO_WRITE',
        reasons: classification.reasons.join(' '),
      })
    }

    const aiRouteRows: AiPolicyRoutePlanRow[] = gateCases.map((record) => {
      const resolved = routeForGateTrack(record.track)
      return {
        recordType: 'AiCompetencyGateCase',
        id: record.id,
        employeeId: record.assignment.employeeId,
        employeeName: record.assignment.employeeNameSnapshot,
        currentPolicyVersion: null,
        currentPolicyRecognitionRoute: null,
        proposedPolicyVersion: EVALUATION_POLICY_2026.version,
        proposedRecognitionRoute: resolved.route,
        plannedAction: resolved.route === 'UNKNOWN' ? 'MANUAL_REVIEW_NO_WRITE' : 'BACKFILL_METADATA',
        reasons: resolved.reason,
      }
    })

    for (const claim of externalCertClaims) {
      aiRouteRows.push({
        recordType: 'AiCompetencyExternalCertClaim',
        id: claim.id,
        employeeId: claim.employeeId,
        employeeName: claim.employee.empName,
        proposedPolicyVersion: EVALUATION_POLICY_2026.version,
        proposedRecognitionRoute: 'AI_PRACTICAL_CERTIFICATION',
        plannedAction: 'MANUAL_REVIEW_NO_WRITE',
        reasons:
          '구형 외부 인증 claim은 2026 정책의 AI 실무 역량 인증 경로 후보이나, Phase 0.5에서는 gate case metadata로 자동 변환하지 않습니다.',
      })
    }

    const summary = {
      ...summarizePlanRows(rows),
      aiPolicyRoutes: {
        total: aiRouteRows.length,
        backfillMetadata: aiRouteRows.filter((row) => row.plannedAction === 'BACKFILL_METADATA').length,
        manualReview: aiRouteRows.filter((row) => row.plannedAction === 'MANUAL_REVIEW_NO_WRITE').length,
      },
    }

    const report = {
      dryRun: true,
      writesPerformed: false,
      policyVersion: EVALUATION_POLICY_2026.version,
      evalYear: args.year,
      generatedAt: new Date().toISOString(),
      summary,
      manualReview: rows.filter((row) => row.plannedAction === 'MANUAL_REVIEW_NO_WRITE'),
      plannedBackfill: rows.filter((row) => row.plannedAction === 'BACKFILL_METADATA'),
      aiPolicyRoutes: aiRouteRows,
    }

    console.log('[dry-run] 2026 policy metadata backfill preview')
    console.log(JSON.stringify(report.summary, null, 2))

    if (report.manualReview.length) {
      console.log('\n[dry-run] manual review records')
      for (const row of report.manualReview.slice(0, 50)) {
        console.log(
          `- ${row.recordType} ${row.id} ${row.employeeName ?? ''} "${row.title}" => ${row.proposedPolicyCategory} (${row.reasons})`
        )
      }
      if (report.manualReview.length > 50) {
        console.log(`...and ${report.manualReview.length - 50} more`)
      }
    }

    if (aiRouteRows.length) {
      console.log('\n[dry-run] AI policy route metadata candidates')
      for (const row of aiRouteRows.slice(0, 50)) {
        console.log(
          `- ${row.recordType} ${row.id} ${row.employeeName}: ${row.proposedRecognitionRoute} (${row.plannedAction})`
        )
      }
      if (aiRouteRows.length > 50) {
        console.log(`...and ${aiRouteRows.length - 50} more`)
      }
    }

    if (args.jsonPath) {
      ensureParentDir(args.jsonPath)
      writeFileSync(args.jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
      console.log(`[dry-run] JSON report written: ${args.jsonPath}`)
    }

    if (args.csvPath) {
      ensureParentDir(args.csvPath)
      writeFileSync(args.csvPath, `${rowsToCsv(rows)}\n`, 'utf8')
      console.log(`[dry-run] CSV report written: ${args.csvPath}`)
    }
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error('[dry-run] backfill preview failed', error)
  process.exitCode = 1
})
