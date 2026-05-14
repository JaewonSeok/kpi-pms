import 'dotenv/config'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { classifyEvaluationPolicyItem } from '../src/lib/evaluation-policy-2026-classification'
import { EVALUATION_POLICY_2026 } from '../src/lib/evaluation-policy-2026'

type Args = {
  year: number
  jsonPath?: string
}

type ImpactRow = {
  evaluationId: string
  employeeId: string
  employeeName: string
  evalStage: string
  currentStoredTotal: number | null
  itemWeightedTotal: number | null
  potential2026Total: number | null
  missingCategoryCount: number
  orgGoalItemCount: number
  personalItemCount: number
  aiScoreCurrentlyContributes: boolean
  aiScore?: number | null
  blockers: string[]
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
    }
  }

  return result
}

function ensureParentDir(filePath: string) {
  const dir = path.dirname(path.resolve(filePath))
  mkdirSync(dir, { recursive: true })
}

function roundToSingle(value: number) {
  return Math.round(value * 10) / 10
}

function average(values: number[]) {
  if (!values.length) return null
  return roundToSingle(values.reduce((sum, value) => sum + value, 0) / values.length)
}

function weightedAverage(rows: Array<{ score: number; weight: number }>) {
  if (!rows.length) return null
  const denominator = rows.reduce((sum, row) => sum + row.weight, 0)
  if (denominator <= 0) return average(rows.map((row) => row.score))
  return roundToSingle(rows.reduce((sum, row) => sum + row.score * row.weight, 0) / denominator)
}

function scoreFromItem(item: {
  quantScore: number | null
  qualScore: number | null
  planScore: number | null
  doScore: number | null
  checkScore: number | null
  actScore: number | null
  weightedScore: number | null
  personalKpi: {
    weight: number
  }
}) {
  if (typeof item.quantScore === 'number') return item.quantScore
  if (typeof item.qualScore === 'number') return item.qualScore

  const pdcaScores = [item.planScore, item.doScore, item.checkScore, item.actScore]
  if (pdcaScores.some((score) => typeof score === 'number')) {
    return roundToSingle(
      ((item.planScore ?? 0) + (item.doScore ?? 0) + (item.checkScore ?? 0) + (item.actScore ?? 0)) / 4
    )
  }

  if (typeof item.weightedScore === 'number' && item.personalKpi.weight > 0) {
    return roundToSingle((item.weightedScore * 100) / item.personalKpi.weight)
  }

  return null
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.warn('[dry-run] DATABASE_URL is not set. Skipping database inspection.')
    return
  }

  const args = parseArgs(process.argv.slice(2))
  const { prisma } = await import('../src/lib/prisma')

  try {
    const evaluations = await prisma.evaluation.findMany({
      where: {
        evalCycle: {
          evalYear: args.year,
        },
      },
      include: {
        evalCycle: {
          select: {
            id: true,
            evalYear: true,
          },
        },
        target: {
          select: {
            id: true,
            empName: true,
          },
        },
        items: {
          include: {
            personalKpi: {
              select: {
                id: true,
                kpiName: true,
                kpiType: true,
                definition: true,
                formula: true,
                linkedOrgKpiId: true,
                tags: true,
                weight: true,
                linkedOrgKpi: {
                  select: {
                    kpiName: true,
                    kpiCategory: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [{ evalCycleId: 'asc' }, { targetId: 'asc' }, { evalStage: 'asc' }],
    })

    const evalCycleIds = Array.from(new Set(evaluations.map((evaluation) => evaluation.evalCycleId)))
    const employeeIds = Array.from(new Set(evaluations.map((evaluation) => evaluation.targetId)))

    const [gateCycles, aiResults] = await Promise.all([
      prisma.aiCompetencyGateCycle.findMany({
        where: {
          evalCycleId: {
            in: evalCycleIds,
          },
        },
        select: {
          evalCycleId: true,
        },
      }),
      prisma.aiCompetencyResult.findMany({
        where: {
          evalCycleId: {
            in: evalCycleIds,
          },
          employeeId: {
            in: employeeIds,
          },
        },
        select: {
          evalCycleId: true,
          employeeId: true,
          finalScore: true,
          syncedCompetencyScore: true,
          syncState: true,
        },
      }),
    ])

    const gateCycleIds = new Set(gateCycles.map((cycle) => cycle.evalCycleId))
    const aiResultMap = new Map(aiResults.map((result) => [`${result.evalCycleId}:${result.employeeId}`, result]))
    const rows: ImpactRow[] = []

    for (const evaluation of evaluations) {
      const blockers: string[] = []
      const orgRows: Array<{ score: number; weight: number }> = []
      const personalRows: Array<{ score: number; weight: number }> = []
      let missingCategoryCount = 0

      for (const item of evaluation.items) {
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
        const score = scoreFromItem(item)

        if (classification.category === 'UNKNOWN' || classification.manualReviewRequired) {
          missingCategoryCount += 1
        }

        if (score === null) {
          blockers.push(`점수 없음: ${kpi.kpiName}`)
          continue
        }

        if (classification.category === 'ORG_GOAL') {
          orgRows.push({ score, weight: kpi.weight })
        } else if (classification.category === 'PROJECT_T' || classification.category === 'PROJECT_K') {
          personalRows.push({ score, weight: kpi.weight })
        } else if (classification.category === 'DAILY_WORK') {
          personalRows.push({
            score: Math.min(score, EVALUATION_POLICY_2026.categories.DAILY_WORK.maxScore),
            weight: kpi.weight,
          })
        }
      }

      if (missingCategoryCount > 0) {
        blockers.push('수동 검토 또는 unknown 카테고리 존재')
      }

      if (!orgRows.length) {
        blockers.push('조직성과 30% 산출에 필요한 조직목표 항목 없음')
      }

      if (!personalRows.length) {
        blockers.push('개인성과 70% 산출에 필요한 개인성과 항목 없음')
      }

      const orgScore = weightedAverage(orgRows)
      const personalScore = weightedAverage(personalRows)
      const potential2026Total =
        orgScore === null || personalScore === null
          ? null
          : roundToSingle(
              orgScore * (EVALUATION_POLICY_2026.finalScoreFormula.organizationPerformanceWeight / 100) +
                personalScore * (EVALUATION_POLICY_2026.finalScoreFormula.personalPerformanceWeight / 100)
            )

      const itemWeightedScores = evaluation.items
        .map((item) => item.weightedScore)
        .filter((value): value is number => typeof value === 'number')
      const aiResult = aiResultMap.get(`${evaluation.evalCycleId}:${evaluation.targetId}`)
      const aiScoreCurrentlyContributes = Boolean(aiResult && !gateCycleIds.has(evaluation.evalCycleId))

      rows.push({
        evaluationId: evaluation.id,
        employeeId: evaluation.targetId,
        employeeName: evaluation.target.empName,
        evalStage: evaluation.evalStage,
        currentStoredTotal: evaluation.totalScore,
        itemWeightedTotal: itemWeightedScores.length
          ? roundToSingle(itemWeightedScores.reduce((sum, value) => sum + value, 0))
          : null,
        potential2026Total,
        missingCategoryCount,
        orgGoalItemCount: orgRows.length,
        personalItemCount: personalRows.length,
        aiScoreCurrentlyContributes,
        aiScore: aiResult?.syncedCompetencyScore ?? aiResult?.finalScore ?? null,
        blockers,
      })
    }

    const report = {
      dryRun: true,
      policyVersion: EVALUATION_POLICY_2026.version,
      evalYear: args.year,
      generatedAt: new Date().toISOString(),
      summary: {
        evaluationCount: rows.length,
        cannotScoreDueToMissingCategory: rows.filter((row) => row.missingCategoryCount > 0).length,
        missingOrganizationSplit: rows.filter((row) => row.orgGoalItemCount === 0).length,
        missingPersonalSplit: rows.filter((row) => row.personalItemCount === 0).length,
        aiScoreCurrentlyContributes: rows.filter((row) => row.aiScoreCurrentlyContributes).length,
        potential2026Scorable: rows.filter((row) => row.potential2026Total !== null && row.blockers.length === 0).length,
      },
      rows,
    }

    console.log('[dry-run] 2026 score impact')
    console.log(JSON.stringify(report.summary, null, 2))

    const blockedRows = rows.filter((row) => row.blockers.length > 0 || row.aiScoreCurrentlyContributes)
    if (blockedRows.length) {
      console.log('\n[dry-run] impact review highlights')
      for (const row of blockedRows.slice(0, 50)) {
        const flags = [
          ...row.blockers,
          row.aiScoreCurrentlyContributes ? '현재 결과 화면에서 구형 AI 점수 기여 가능' : null,
        ].filter(Boolean)
        console.log(`- ${row.employeeName} ${row.evalStage} ${row.evaluationId}: ${flags.join(' / ')}`)
      }
      if (blockedRows.length > 50) {
        console.log(`...and ${blockedRows.length - 50} more`)
      }
    }

    if (args.jsonPath) {
      ensureParentDir(args.jsonPath)
      writeFileSync(args.jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
      console.log(`[dry-run] JSON report written: ${args.jsonPath}`)
    }
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error('[dry-run] score impact failed', error)
  process.exitCode = 1
})
