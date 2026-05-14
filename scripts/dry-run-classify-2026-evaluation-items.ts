import 'dotenv/config'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import {
  classifyEvaluationPolicyItem,
  type EvaluationPolicyClassification,
} from '../src/lib/evaluation-policy-2026-classification'
import { EVALUATION_POLICY_2026 } from '../src/lib/evaluation-policy-2026'

type Args = {
  year: number
  jsonPath?: string
  csvPath?: string
}

type ClassificationRow = {
  recordType: 'PersonalKpi' | 'EvaluationItem'
  id: string
  employeeId?: string
  employeeName?: string
  evaluationId?: string
  evalStage?: string
  title: string
  currentType?: string
  linkedOrgKpiId?: string
  proposedCategory: EvaluationPolicyClassification
  confidence: number
  manualReviewRequired: boolean
  signals: string
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
  const dir = path.dirname(path.resolve(filePath))
  mkdirSync(dir, { recursive: true })
}

function escapeCsv(value: unknown) {
  const text = String(value ?? '')
  if (!/[",\n\r]/.test(text)) return text
  return `"${text.replace(/"/g, '""')}"`
}

function toCsv(rows: ClassificationRow[]) {
  const headers: Array<keyof ClassificationRow> = [
    'recordType',
    'id',
    'employeeId',
    'employeeName',
    'evaluationId',
    'evalStage',
    'title',
    'currentType',
    'linkedOrgKpiId',
    'proposedCategory',
    'confidence',
    'manualReviewRequired',
    'signals',
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

async function main() {
  if (!process.env.DATABASE_URL) {
    console.warn('[dry-run] DATABASE_URL is not set. Skipping database inspection.')
    return
  }

  const args = parseArgs(process.argv.slice(2))
  const { prisma } = await import('../src/lib/prisma')

  try {
    const personalKpis = await prisma.personalKpi.findMany({
      where: {
        evalYear: args.year,
      },
      include: {
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
                reviewType: true,
                recommendationType: true,
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
      include: {
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
            employeeId: true,
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

    const rows: ClassificationRow[] = []
    const personalSummary = new Map<string, number>()
    const evaluationItemSummary = new Map<string, number>()

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
      increment(personalSummary, classification.category)
      rows.push({
        recordType: 'PersonalKpi',
        id: kpi.id,
        employeeId: kpi.employeeId,
        employeeName: kpi.employee.empName,
        title: kpi.kpiName,
        currentType: kpi.kpiType,
        linkedOrgKpiId: kpi.linkedOrgKpiId ?? undefined,
        proposedCategory: classification.category,
        confidence: classification.confidence,
        manualReviewRequired: classification.manualReviewRequired,
        signals: classification.signals.join('|'),
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
      increment(evaluationItemSummary, classification.category)
      rows.push({
        recordType: 'EvaluationItem',
        id: item.id,
        employeeId: item.evaluation.targetId,
        employeeName: item.evaluation.target.empName,
        evaluationId: item.evaluation.id,
        evalStage: item.evaluation.evalStage,
        title: kpi.kpiName,
        currentType: kpi.kpiType,
        linkedOrgKpiId: kpi.linkedOrgKpiId ?? undefined,
        proposedCategory: classification.category,
        confidence: classification.confidence,
        manualReviewRequired: classification.manualReviewRequired,
        signals: classification.signals.join('|'),
        reasons: classification.reasons.join(' '),
      })
    }

    const manualReviewRows = rows.filter((row) => row.manualReviewRequired || row.proposedCategory === 'UNKNOWN')
    const report = {
      dryRun: true,
      policyVersion: EVALUATION_POLICY_2026.version,
      evalYear: args.year,
      generatedAt: new Date().toISOString(),
      summary: {
        personalKpis: Object.fromEntries(personalSummary),
        evaluationItems: Object.fromEntries(evaluationItemSummary),
        manualReviewRequiredCount: manualReviewRows.length,
      },
      manualReview: manualReviewRows,
      rows,
    }

    console.log('[dry-run] 2026 evaluation item classification')
    console.log(JSON.stringify(report.summary, null, 2))

    if (manualReviewRows.length) {
      console.log('\n[dry-run] manual review required')
      for (const row of manualReviewRows.slice(0, 50)) {
        console.log(
          `- ${row.recordType} ${row.id} ${row.employeeName ?? ''} "${row.title}" => ${row.proposedCategory} (${row.reasons})`
        )
      }
      if (manualReviewRows.length > 50) {
        console.log(`...and ${manualReviewRows.length - 50} more`)
      }
    }

    if (args.jsonPath) {
      ensureParentDir(args.jsonPath)
      writeFileSync(args.jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
      console.log(`[dry-run] JSON report written: ${args.jsonPath}`)
    }

    if (args.csvPath) {
      ensureParentDir(args.csvPath)
      writeFileSync(args.csvPath, `${toCsv(rows)}\n`, 'utf8')
      console.log(`[dry-run] CSV report written: ${args.csvPath}`)
    }
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error('[dry-run] classification failed', error)
  process.exitCode = 1
})
