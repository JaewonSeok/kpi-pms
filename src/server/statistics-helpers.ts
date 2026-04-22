import type { EvalStage, EvalStatus } from '@prisma/client'
import type { EvaluationPerformanceBriefingAlignmentStatus } from '@/lib/evaluation-performance-briefing'

export type StatisticsPeriod = '6m' | '12m' | 'ytd'

export type StatisticsAlignmentSummary = {
  totalCount: number
  warningCount: number
  counts: Record<EvaluationPerformanceBriefingAlignmentStatus, number>
}

const EVALUATION_PRECEDENCE: EvalStage[] = ['CEO_ADJUST', 'FINAL', 'SECOND', 'FIRST']
const BASELINE_PRECEDENCE: EvalStage[] = ['FINAL', 'SECOND', 'FIRST']

export function parseStatisticsPeriod(value?: string): StatisticsPeriod {
  if (value === '6m' || value === '12m' || value === 'ytd') {
    return value
  }

  return '12m'
}

export function pickEffectiveEvaluationOutcome<T extends { evalStage: EvalStage; status: EvalStatus }>(
  evaluations: T[]
) {
  return pickEvaluationByPrecedence(evaluations, EVALUATION_PRECEDENCE)
}

export function pickBaselineEvaluationOutcome<T extends { evalStage: EvalStage; status: EvalStatus }>(
  evaluations: T[]
) {
  return pickEvaluationByPrecedence(evaluations, BASELINE_PRECEDENCE)
}

export function buildStatisticsStageFlow(params: {
  hasFirst: boolean
  hasSecond: boolean
  hasFinal: boolean
  hasCeo: boolean
}) {
  const stages: EvalStage[] = ['SELF']

  if (!params.hasFirst) {
    return stages
  }

  stages.push('FIRST')

  if (params.hasSecond) {
    stages.push('SECOND')
  }

  if (!params.hasFinal) {
    return stages
  }

  stages.push('FINAL')

  if (params.hasCeo) {
    stages.push('CEO_ADJUST')
  }

  return stages
}

export function summarizeStatisticsAiAlignment(
  statuses: EvaluationPerformanceBriefingAlignmentStatus[]
): StatisticsAlignmentSummary {
  const initial: StatisticsAlignmentSummary = {
    totalCount: statuses.length,
    warningCount: 0,
    counts: {
      MATCHED: 0,
      MOSTLY_MATCHED: 0,
      REVIEW_NEEDED: 0,
      POSSIBLE_OVER_RATING: 0,
      POSSIBLE_UNDER_RATING: 0,
      INSUFFICIENT_EVIDENCE: 0,
    },
  }

  for (const status of statuses) {
    initial.counts[status] += 1
    if (
      status === 'REVIEW_NEEDED' ||
      status === 'POSSIBLE_OVER_RATING' ||
      status === 'POSSIBLE_UNDER_RATING' ||
      status === 'INSUFFICIENT_EVIDENCE'
    ) {
      initial.warningCount += 1
    }
  }

  return initial
}

function pickEvaluationByPrecedence<T extends { evalStage: EvalStage; status: EvalStatus }>(
  evaluations: T[],
  precedence: EvalStage[]
) {
  for (const stage of precedence) {
    const matched = evaluations.find(
      (evaluation) =>
        evaluation.evalStage === stage &&
        (evaluation.status === 'SUBMITTED' || evaluation.status === 'CONFIRMED')
    )
    if (matched) {
      return matched
    }
  }

  return null
}
