import {
  AIRequestStatus,
  AIRequestType,
  Prisma,
  type PrismaClient,
  type QuestionType,
  type SystemRole,
} from '@prisma/client'
import { createAuditLog } from '@/lib/audit'
import { sanitizeAiPayload } from '@/lib/ai-assist'
import { readExecutivePerformanceBriefingEnv } from '@/lib/ai-env'
import {
  type ExecutivePerformanceBriefing,
  type ExecutivePerformanceBriefingEvidenceItem as PromptEvidenceDigestItem,
  type ExecutivePerformanceBriefingInput,
} from '@/lib/ai/executive-performance-briefing-prompt'
import {
  determineEvaluationPerformanceBriefingAlignmentStatus,
  EvaluationPerformanceBriefingSnapshotSchema,
  type EvaluationPerformanceBriefingAlignmentStatus,
  type EvaluationPerformanceBriefingEvidenceItem,
  type EvaluationPerformanceBriefingEvidenceLevel,
  type EvaluationPerformanceBriefingSnapshot,
} from '@/lib/evaluation-performance-briefing'
import { recordOperationalEvent } from '@/lib/operations'
import { prisma } from '@/lib/prisma'
import { requestExecutivePerformanceBriefingFromOpenAI } from '@/server/ai/executive-performance-briefing-openai'
import { getPreviousActiveEvaluationStage } from '@/server/evaluation-performance-assignments'
import { AppError, EVAL_STAGE_LABELS, POSITION_LABELS } from '@/lib/utils'

type GenerateEvaluationPerformanceBriefingParams = {
  actorId: string
  actorRole: SystemRole
  evaluationId: string
}

type LoadedEvaluation = Awaited<ReturnType<typeof loadEvaluationPerformanceBriefingContext>>['evaluation']
type LoadedReferenceEvaluation =
  Awaited<ReturnType<typeof loadEvaluationPerformanceBriefingContext>>['referenceEvaluation']

type EvidenceSeed = EvaluationPerformanceBriefingEvidenceItem

type StatementDraft = {
  text: string
  evidenceIds: string[]
}

type BriefingContext = {
  evaluation: NonNullable<LoadedEvaluation>
  referenceEvaluation: NonNullable<LoadedReferenceEvaluation>
  managerScore: number | null
  evidenceScore: number | null
  evidenceLevel: EvaluationPerformanceBriefingEvidenceLevel
  managerCommentSupported: boolean
  alignmentStatus: EvaluationPerformanceBriefingAlignmentStatus
  evidenceSeeds: EvidenceSeed[]
  coverage: EvaluationPerformanceBriefingSnapshot['evidenceCoverage']
  promptInput: ExecutivePerformanceBriefingInput
  payload: Record<string, unknown>
  fallbackSnapshot: EvaluationPerformanceBriefingSnapshot
}

const PERFORMANCE_BRIEFING_PROMPT_VERSION = 'evaluation-performance-briefing-v1'
const PERFORMANCE_BRIEFING_SOURCE_TYPE = 'EvaluationPerformanceBriefing'

function toJsonValue(value: Record<string, unknown> | EvaluationPerformanceBriefingSnapshot) {
  return value as Prisma.InputJsonValue
}

function roundScore(value: number | null | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return null
  }

  return Math.round(value * 10) / 10
}

function formatPercent(value: number | null | undefined) {
  return typeof value === 'number' ? `${Math.round(value * 10) / 10}%` : '미집계'
}

function toLocalDateLabel(value: Date) {
  return value.toISOString().slice(0, 10)
}

function buildEvidenceHref(params: {
  sourceType: EvaluationPerformanceBriefingEvidenceItem['sourceType']
  evaluationId: string
  cycleId: string
  employeeId: string
  personalKpiId?: string
}) {
  switch (params.sourceType) {
    case 'EVALUATION':
    case 'EVALUATION_HISTORY':
      return `/evaluation/performance/${encodeURIComponent(params.evaluationId)}?cycleId=${encodeURIComponent(
        params.cycleId
      )}`
    case 'PERSONAL_KPI':
    case 'MONTHLY_RECORD':
    case 'ORG_KPI':
      return `/kpi/personal?employeeId=${encodeURIComponent(params.employeeId)}&cycleId=${encodeURIComponent(
        params.cycleId
      )}${params.personalKpiId ? `&kpiId=${encodeURIComponent(params.personalKpiId)}` : ''}`
    case 'CHECKIN':
      return '/checkin'
    case 'FEEDBACK':
      return `/evaluation/360/results?cycleId=${encodeURIComponent(params.cycleId)}`
  }
}

function clampStatements(statements: StatementDraft[], fallback: StatementDraft[]) {
  const filtered = statements
    .map((statement) => ({
      text: statement.text.trim(),
      evidenceIds: [...new Set(statement.evidenceIds.map((item) => item.trim()).filter(Boolean))],
    }))
    .filter((statement) => statement.text && statement.evidenceIds.length)
    .slice(0, 5)

  return filtered.length ? filtered : fallback.slice(0, 5)
}

function normalizeQuestions(questions: string[], fallback: string[]) {
  const normalized = questions.map((question) => question.trim()).filter(Boolean).slice(0, 5)
  return normalized.length >= 2 ? normalized : fallback
}

function createStatement(text: string, evidenceIds: string[]): StatementDraft {
  return {
    text,
    evidenceIds: [...new Set(evidenceIds.filter(Boolean))],
  }
}

function computeManagerScore(evaluation: NonNullable<LoadedEvaluation>) {
  if (typeof evaluation.totalScore === 'number') {
    return roundScore(evaluation.totalScore)
  }

  const weightedScore = evaluation.items.reduce((sum, item) => sum + (item.weightedScore ?? 0), 0)
  return weightedScore > 0 ? roundScore(weightedScore) : null
}

function computeEvidenceLevel(metrics: {
  kpiCount: number
  monthlyRecordCount: number
  checkinCount: number
  feedbackRoundCount: number
  evaluationHistoryCount: number
}) {
  const sourceBucketCount = [
    metrics.kpiCount > 0,
    metrics.monthlyRecordCount > 0,
    metrics.checkinCount > 0,
    metrics.feedbackRoundCount > 0,
    metrics.evaluationHistoryCount > 0,
  ].filter(Boolean).length

  if (sourceBucketCount >= 4 && metrics.monthlyRecordCount >= 4) {
    return 'STRONG' as const
  }

  if (sourceBucketCount >= 3 && metrics.monthlyRecordCount >= 2) {
    return 'PARTIAL' as const
  }

  return 'WEAK' as const
}

function computeEvidenceScore(
  evaluation: NonNullable<LoadedEvaluation>,
  feedbackRounds: Array<{
    averageRating: number | null
  }>
) {
  const weightedAchievementSignals = evaluation.items
    .filter((item) => typeof item.personalKpi.monthlyRecords[0]?.achievementRate === 'number')
    .map((item) => ({
      rate: item.personalKpi.monthlyRecords[0]?.achievementRate as number,
      weight: item.personalKpi.weight,
    }))

  const achievementScore = weightedAchievementSignals.length
    ? weightedAchievementSignals.reduce((sum, item) => sum + item.rate * item.weight, 0) /
      weightedAchievementSignals.reduce((sum, item) => sum + item.weight, 0)
    : null

  const feedbackScoreCandidates = feedbackRounds
    .map((round) => round.averageRating)
    .filter((value): value is number => typeof value === 'number' && value > 0)
  const feedbackScore = feedbackScoreCandidates.length
    ? (feedbackScoreCandidates.reduce((sum, value) => sum + value, 0) / feedbackScoreCandidates.length) * 20
    : null

  if (typeof achievementScore === 'number' && typeof feedbackScore === 'number') {
    return roundScore(achievementScore * 0.75 + feedbackScore * 0.25)
  }

  if (typeof achievementScore === 'number') {
    return roundScore(achievementScore)
  }

  if (typeof feedbackScore === 'number') {
    return roundScore(feedbackScore)
  }

  return null
}

function isManagerCommentSupported(comment: string | null | undefined, titles: string[]) {
  if (!comment || comment.trim().length < 40) {
    return false
  }

  const normalizedComment = comment.trim()
  if (/\d/.test(normalizedComment)) {
    return true
  }

  return titles.some((title) => normalizedComment.includes(title.slice(0, Math.min(title.length, 4))))
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => value?.trim() ?? '').filter(Boolean))]
}

function summarizeText(text: string | null | undefined, fallback = '요약 가능한 근거가 아직 충분하지 않습니다.') {
  const normalized = (text ?? '').replace(/\s+/g, ' ').trim()
  if (!normalized) {
    return fallback
  }

  return normalized.length > 180 ? `${normalized.slice(0, 177)}...` : normalized
}

function inferAchievementTrend(item: NonNullable<LoadedEvaluation>['items'][number]) {
  const latest = item.personalKpi.monthlyRecords[0]?.achievementRate
  const previous = item.personalKpi.monthlyRecords[1]?.achievementRate

  if (typeof latest !== 'number') {
    return '데이터 부족'
  }

  if (typeof previous !== 'number') {
    return '최근 실적 기준'
  }

  if (latest >= previous + 5) {
    return '상승'
  }

  if (latest <= previous - 5) {
    return '하락'
  }

  return '유지'
}

function mapEvidenceSeedToPromptDigestSourceType(
  sourceType: EvidenceSeed['sourceType']
): PromptEvidenceDigestItem['sourceType'] {
  switch (sourceType) {
    case 'PERSONAL_KPI':
    case 'ORG_KPI':
      return 'KPI'
    case 'CHECKIN':
      return 'CHECKIN'
    case 'MONTHLY_RECORD':
      return 'MONTHLY'
    case 'FEEDBACK':
      return 'FEEDBACK'
    case 'EVALUATION':
    case 'EVALUATION_HISTORY':
      return 'REVIEW'
  }
}

function buildExecutivePerformanceBriefingInput(params: {
  evaluation: NonNullable<LoadedEvaluation>
  referenceEvaluation: NonNullable<LoadedReferenceEvaluation>
  checkins: Awaited<ReturnType<typeof loadEvaluationPerformanceBriefingContext>>['checkins']
  feedbackRounds: Awaited<ReturnType<typeof loadEvaluationPerformanceBriefingContext>>['feedbackRounds']
  previousEvaluations: Awaited<ReturnType<typeof loadEvaluationPerformanceBriefingContext>>['previousEvaluations']
  managerScore: number | null
  evidenceScore: number | null
  evidenceSeeds: EvidenceSeed[]
  coverage: EvaluationPerformanceBriefingSnapshot['evidenceCoverage']
  managerCommentSupported: boolean
  alignmentStatus: EvaluationPerformanceBriefingAlignmentStatus
}): ExecutivePerformanceBriefingInput {
  const {
    evaluation,
    referenceEvaluation,
    checkins,
    feedbackRounds,
    previousEvaluations,
    managerScore,
    evidenceScore,
    evidenceSeeds,
    coverage,
    managerCommentSupported,
    alignmentStatus,
  } = params

  const sortedItems = [...evaluation.items].sort(
    (left, right) =>
      right.personalKpi.weight - left.personalKpi.weight ||
      (right.personalKpi.monthlyRecords[0]?.achievementRate ?? -1) -
        (left.personalKpi.monthlyRecords[0]?.achievementRate ?? -1)
  )
  const highAchievementItems = sortedItems.filter(
    (item) => (item.personalKpi.monthlyRecords[0]?.achievementRate ?? 0) >= 90
  )
  const lowAchievementItems = sortedItems.filter(
    (item) => typeof item.personalKpi.monthlyRecords[0]?.achievementRate === 'number'
  ).filter((item) => (item.personalKpi.monthlyRecords[0]?.achievementRate ?? 0) < 80)
  const comment = referenceEvaluation.comment?.trim() ?? ''
  const mentionedKpiNames = sortedItems
    .filter((item) => comment.includes(item.personalKpi.kpiName.slice(0, Math.min(item.personalKpi.kpiName.length, 4))))
    .map((item) => item.personalKpi.kpiName)

  const weightedKpiSummary = sortedItems.slice(0, 5).map(
    (item) =>
      `${item.personalKpi.kpiName}: 가중치 ${item.personalKpi.weight}% · 최근 달성률 ${formatPercent(
        item.personalKpi.monthlyRecords[0]?.achievementRate
      )}`
  )

  const highWeightKpis = sortedItems.slice(0, 3).map(
    (item) =>
      item.personalKpi.linkedOrgKpi
        ? `${item.personalKpi.kpiName} (조직 목표: ${item.personalKpi.linkedOrgKpi.kpiName})`
        : item.personalKpi.kpiName
  )

  const kpiAchievementTrend = sortedItems.slice(0, 5).map(
    (item) =>
      `${item.personalKpi.kpiName}: 최근 달성률 ${formatPercent(
        item.personalKpi.monthlyRecords[0]?.achievementRate
      )}, 추이 ${inferAchievementTrend(item)}`
  )

  const monthlyPerformanceSummary = sortedItems
    .flatMap((item) =>
      item.personalKpi.monthlyRecords.slice(0, 2).map((record) => ({
        updatedAt: record.updatedAt,
        summary: `${record.yearMonth} ${item.personalKpi.kpiName}: ${summarizeText(
          [record.activities, record.efforts, record.obstacles].filter(Boolean).join(' / '),
          '상세 메모 없음'
        )}`,
      }))
    )
    .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())
    .slice(0, 6)
    .map((item) => item.summary)

  const checkinSummary = checkins
    .slice(0, 4)
    .map((checkin) => `${toLocalDateLabel(checkin.scheduledDate)} 체크인: ${summarizeText(checkin.keyTakeaways || checkin.managerNotes || checkin.ownerNotes, '요약 메모 없음')}`)

  const collaborationSummary = uniqueStrings([
    ...feedbackRounds
      .filter((round) => round.submittedCount > 0)
      .slice(0, 4)
      .map((round) => `${round.roundName}: ${round.summary ?? `응답 ${round.submittedCount}건`}`),
    ...checkins
      .filter((checkin) => Boolean(checkin.managerNotes))
      .slice(0, 2)
      .map((checkin) => `체크인 메모: ${summarizeText(checkin.managerNotes)}`),
  ]).slice(0, 5)

  const orgContributionSummary = uniqueStrings(
    sortedItems
      .filter((item) => item.personalKpi.linkedOrgKpi)
      .slice(0, 4)
      .map(
        (item) =>
          `${item.personalKpi.kpiName} → ${item.personalKpi.linkedOrgKpi?.department.deptName} ${item.personalKpi.linkedOrgKpi?.kpiName}`
      )
  )

  const peerFeedbackSummary = feedbackRounds
    .filter((round) => round.submittedCount > 0)
    .slice(0, 4)
    .map(
      (round) =>
        `${round.roundName}: 응답 ${round.submittedCount}건 · 평균 ${typeof round.averageRating === 'number' ? round.averageRating.toFixed(1) : '-'}${
          round.summary ? ` · ${summarizeText(round.summary)}` : ''
        }`
    )

  const riskEvents = uniqueStrings([
    ...lowAchievementItems.slice(0, 4).map(
      (item) =>
        `${item.personalKpi.kpiName}: 최근 달성률 ${formatPercent(item.personalKpi.monthlyRecords[0]?.achievementRate)}`
    ),
    ...sortedItems
      .flatMap((item) => item.personalKpi.monthlyRecords.slice(0, 2))
      .filter((record) => Boolean(record.obstacles?.trim()))
      .slice(0, 3)
      .map((record) => `월간 장애 요소: ${summarizeText(record.obstacles)}`),
  ]).slice(0, 5)

  const missingEvidenceAreas = uniqueStrings([
    coverage.monthlyRecordCount < 4 ? '최근 12개월 월간 실적 기록이 충분하지 않습니다.' : null,
    coverage.checkinCount < 2 ? '체크인 근거가 부족합니다.' : null,
    coverage.feedbackRoundCount < 1 ? '다면 피드백 근거가 부족합니다.' : null,
    previousEvaluations.length < 1 ? '이전 평가 비교 이력이 부족합니다.' : null,
    managerCommentSupported ? null : '팀장 코멘트가 구체적 근거와 직접 연결되지 않습니다.',
    evidenceScore === null ? '근거 기반 성과 수준을 수치로 비교하기 어렵습니다.' : null,
    alignmentStatus === 'INSUFFICIENT_EVIDENCE' ? '정합성 판단을 위한 전체 근거량이 부족합니다.' : null,
  ])

  return {
    employeeId: evaluation.target.id,
    employeeName: evaluation.target.empName,
    departmentName: evaluation.target.department.deptName,
    position: POSITION_LABELS[evaluation.target.position] ?? evaluation.target.position,
    evaluationYear: evaluation.evalCycle.evalYear,
    reviewPeriodStart: toLocalDateLabel(
      evaluation.evalCycle.selfEvalStart ?? evaluation.evalCycle.kpiSetupStart ?? evaluation.createdAt
    ),
    reviewPeriodEnd: toLocalDateLabel(
      evaluation.evalCycle.resultOpenEnd ?? evaluation.evalCycle.finalEvalEnd ?? evaluation.updatedAt
    ),
    managerRatingLabel: referenceEvaluation.gradeId ?? null,
    managerScore,
    managerComment: referenceEvaluation.comment ?? null,
    managerStrengthKeywords: uniqueStrings([
      ...highAchievementItems.slice(0, 3).map((item) => item.personalKpi.kpiName),
      ...mentionedKpiNames.slice(0, 2),
    ]).slice(0, 5),
    managerRiskKeywords: uniqueStrings(lowAchievementItems.slice(0, 4).map((item) => item.personalKpi.kpiName)).slice(
      0,
      5
    ),
    weightedKpiSummary,
    highWeightKpis,
    kpiAchievementTrend,
    checkinSummary,
    monthlyPerformanceSummary,
    projectSummary: [],
    collaborationSummary,
    orgContributionSummary,
    peerFeedbackSummary,
    riskEvents,
    missingEvidenceAreas,
    evidenceItems: evidenceSeeds.map<PromptEvidenceDigestItem>((item) => ({
      id: item.id,
      sourceType: mapEvidenceSeedToPromptDigestSourceType(item.sourceType),
      title: item.title,
      summary: summarizeText(item.snippet, item.title),
    })),
  }
}

async function loadEvaluationPerformanceBriefingContext(
  params: GenerateEvaluationPerformanceBriefingParams,
  db: PrismaClient
) {
  const oneYearAgo = new Date()
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)

  const evaluationInclude = {
    evalCycle: true,
    evaluator: {
      include: {
        department: {
          select: { deptName: true },
        },
      },
    },
    target: {
      include: {
        department: {
          select: { deptName: true },
        },
      },
    },
    items: {
      include: {
        personalKpi: {
          include: {
            linkedOrgKpi: {
              include: {
                department: {
                  select: { deptName: true },
                },
              },
            },
            monthlyRecords: {
              orderBy: [{ yearMonth: 'desc' }, { updatedAt: 'desc' }],
              take: 12,
              select: {
                id: true,
                yearMonth: true,
                achievementRate: true,
                activities: true,
                obstacles: true,
                efforts: true,
                updatedAt: true,
              },
            },
          },
        },
      },
    },
  } satisfies Prisma.EvaluationInclude

  const evaluation = await db.evaluation.findUnique({
    where: { id: params.evaluationId },
    include: evaluationInclude,
  })

  if (!evaluation) {
    throw new AppError(404, 'EVALUATION_NOT_FOUND', '평가 대상을 찾지 못했습니다.')
  }

  const canUseBriefing =
    params.actorRole === 'ROLE_ADMIN' ||
    (
      evaluation.evaluatorId === params.actorId &&
      ['SECOND', 'FINAL', 'CEO_ADJUST'].includes(evaluation.evalStage)
    )

  if (!canUseBriefing) {
    throw new AppError(403, 'FORBIDDEN', 'AI 성과 브리핑을 볼 권한이 없습니다.')
  }

  const previousStage = await getPreviousActiveEvaluationStage({
    db,
    evalCycleId: evaluation.evalCycleId,
    targetId: evaluation.targetId,
    currentStage: evaluation.evalStage,
  })
  const referenceEvaluation =
    evaluation.evalStage === 'FIRST' || !previousStage
      ? evaluation
      : await db.evaluation.findUnique({
          where: {
            evalCycleId_targetId_evalStage: {
              evalCycleId: evaluation.evalCycleId,
              targetId: evaluation.targetId,
              evalStage: previousStage,
            },
          },
          include: evaluationInclude,
        })

  const referenceEvaluationId = referenceEvaluation?.id ?? evaluation.id

  const [checkins, feedbackRounds, previousEvaluations] = await Promise.all([
    db.checkIn.findMany({
      where: {
        ownerId: evaluation.targetId,
        scheduledDate: { gte: oneYearAgo },
      },
      orderBy: { scheduledDate: 'desc' },
      take: 12,
      select: {
        id: true,
        scheduledDate: true,
        keyTakeaways: true,
        managerNotes: true,
        ownerNotes: true,
      },
    }),
    db.multiFeedbackRound.findMany({
      where: {
        endDate: { gte: oneYearAgo },
      },
      orderBy: { endDate: 'desc' },
      take: 6,
      include: {
        feedbacks: {
          where: {
            receiverId: evaluation.targetId,
            status: 'SUBMITTED',
          },
          include: {
            responses: {
              include: {
                question: {
                  select: {
                    questionType: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
    db.evaluation.findMany({
      where: {
        targetId: evaluation.targetId,
        id: {
          notIn: [...new Set([evaluation.id, referenceEvaluationId])],
        },
        updatedAt: { gte: oneYearAgo },
      },
      orderBy: { updatedAt: 'desc' },
      take: 4,
      select: {
        id: true,
        totalScore: true,
        comment: true,
        evalStage: true,
        updatedAt: true,
        evalCycle: {
          select: {
            id: true,
            cycleName: true,
            evalYear: true,
          },
        },
      },
    }),
  ])

  return {
    evaluation,
    referenceEvaluation: referenceEvaluation ?? evaluation,
    checkins,
    feedbackRounds: feedbackRounds.map((round) => {
      const ratings = round.feedbacks.flatMap((feedback) =>
        feedback.responses
          .filter(
            (response) =>
              response.question.questionType === ('RATING_SCALE' as QuestionType) &&
              typeof response.ratingValue === 'number'
          )
          .map((response) => response.ratingValue as number)
      )

      const averageRating = ratings.length
        ? Math.round((ratings.reduce((sum, value) => sum + value, 0) / ratings.length) * 10) / 10
        : null

      const highlight =
        round.feedbacks
          .flatMap((feedback) => feedback.responses.map((response) => response.textValue ?? '').filter(Boolean))
          .slice(0, 2)
          .join(' / ') || null

      return {
        id: round.id,
        roundName: round.roundName,
        roundType: round.roundType,
        averageRating,
        submittedCount: round.feedbacks.length,
        summary: highlight,
      }
    }),
    previousEvaluations,
  }
}

function buildFallbackSnapshot(
  context: Omit<BriefingContext, 'fallbackSnapshot' | 'promptInput'>
): EvaluationPerformanceBriefingSnapshot {
  const { evaluation, referenceEvaluation, coverage, evidenceSeeds, managerScore, evidenceScore, alignmentStatus } =
    context
  const pickEvidence = (...items: Array<string | undefined>) => items.filter(Boolean) as string[]
  const currentEvaluationEvidenceId = `evaluation:${referenceEvaluation.id}`
  const topKpi = evaluation.items[0]
  const topKpiEvidenceId = topKpi ? `kpi:${topKpi.personalKpiId}` : currentEvaluationEvidenceId
  const topMonthly = topKpi?.personalKpi.monthlyRecords[0]
  const topMonthlyEvidenceId = topMonthly ? `monthly:${topMonthly.id}` : topKpiEvidenceId
  const topFeedback = context.evidenceSeeds.find((item) => item.sourceType === 'FEEDBACK')?.id
  const topCheckin = context.evidenceSeeds.find((item) => item.sourceType === 'CHECKIN')?.id

  const strengths: StatementDraft[] = []
  const highAchievementItems = evaluation.items
    .filter((item) => typeof item.personalKpi.monthlyRecords[0]?.achievementRate === 'number')
    .sort(
      (left, right) =>
        (right.personalKpi.monthlyRecords[0]?.achievementRate ?? 0) -
        (left.personalKpi.monthlyRecords[0]?.achievementRate ?? 0)
    )
    .slice(0, 2)

  for (const item of highAchievementItems) {
    const monthly = item.personalKpi.monthlyRecords[0]
    strengths.push(
      createStatement(
        `${item.personalKpi.kpiName}는 최근 확인 기준 ${formatPercent(monthly?.achievementRate)}로 유지되고 있습니다.`,
        pickEvidence(`kpi:${item.personalKpiId}`, monthly ? `monthly:${monthly.id}` : undefined)
      )
    )
  }

  if (topFeedback) {
    const feedbackItem = context.evidenceSeeds.find((item) => item.id === topFeedback)
    strengths.push(
      createStatement(
        `다면 피드백에서도 ${feedbackItem?.snippet || '협업 강점'}이 반복적으로 확인됩니다.`,
        pickEvidence(topFeedback)
      )
    )
  }

  if (!strengths.length) {
    strengths.push(
      createStatement(
        '등록된 KPI와 최근 실적 근거를 기준으로 핵심 성과를 다시 확인할 수 있습니다.',
        pickEvidence(topKpiEvidenceId, topMonthlyEvidenceId)
      )
    )
  }

  const kpiSummary = [
    createStatement(
      `최근 12개월 기준 KPI 근거 ${coverage.monthlyRecordCount}건이 연결되어 있으며, 근거 기반 점수는 ${evidenceScore ?? '미산정'}입니다.`,
      pickEvidence(topKpiEvidenceId, topMonthlyEvidenceId)
    ),
    createStatement(
      `현재 팀장 평가 점수는 ${managerScore ?? '미입력'}이며, 목표 연결과 월간 실적을 함께 검토해야 합니다.`,
      pickEvidence(currentEvaluationEvidenceId, topKpiEvidenceId)
    ),
  ]

  const contributionSummary = [
    createStatement(
      context.coverage.feedbackRoundCount
        ? `다면 피드백 ${context.coverage.feedbackRoundCount}개 라운드와 체크인 ${context.coverage.checkinCount}건을 통해 협업/조직 기여를 확인할 수 있습니다.`
        : `체크인 ${context.coverage.checkinCount}건과 연결된 조직 KPI를 중심으로 협업/조직 기여를 확인할 수 있습니다.`,
      pickEvidence(topFeedback, topCheckin, topKpiEvidenceId)
    ),
  ]

  const risks: StatementDraft[] = []
  const lowAchievementItems = evaluation.items
    .filter((item) => typeof item.personalKpi.monthlyRecords[0]?.achievementRate === 'number')
    .filter((item) => (item.personalKpi.monthlyRecords[0]?.achievementRate ?? 0) < 80)
    .slice(0, 2)

  for (const item of lowAchievementItems) {
    const monthly = item.personalKpi.monthlyRecords[0]
    risks.push(
      createStatement(
        `${item.personalKpi.kpiName}는 최근 확인 기준 ${formatPercent(monthly?.achievementRate)}로 추가 확인이 필요합니다.`,
        pickEvidence(`kpi:${item.personalKpiId}`, monthly ? `monthly:${monthly.id}` : undefined)
      )
    )
  }

  if (coverage.evidenceLevel === 'WEAK') {
    risks.push(
      createStatement(
        '최근 12개월 근거가 부족해 현재 평가 의견을 그대로 신뢰하기보다 추가 자료 확인이 필요합니다.',
        pickEvidence(currentEvaluationEvidenceId, topKpiEvidenceId)
      )
    )
  }

  if (!risks.length) {
    risks.push(
      createStatement(
        '대부분의 위험 신호는 크지 않지만, 최근 월간 실적과 체크인 메모를 함께 확인하는 것이 안전합니다.',
        pickEvidence(topMonthlyEvidenceId, topCheckin, currentEvaluationEvidenceId)
      )
    )
  }

  const questions = [
    alignmentStatus === 'POSSIBLE_OVER_RATING'
      ? '현재 점수를 지지하는 추가 실적 근거나 조직 기여 자료가 더 있는지 확인해 주세요.'
      : alignmentStatus === 'POSSIBLE_UNDER_RATING'
        ? '점수에 충분히 반영되지 않은 성과나 협업 기여가 누락되지 않았는지 확인해 주세요.'
        : '팀장 의견에서 특히 강조한 성과가 최근 근거 자료와 직접 연결되는지 확인해 주세요.',
    coverage.evidenceLevel === 'WEAK'
      ? '월간 실적, 체크인, 다면 피드백 중 누락된 근거를 추가로 확인할 수 있는지 점검해 주세요.'
      : '최근 12개월 동안 성과가 지속적으로 유지되었는지 월별 흐름을 다시 확인해 주세요.',
    '리스크로 보인 항목이 일시적 변수인지 구조적 문제인지 구분할 추가 설명이 필요한지 확인해 주세요.',
  ].slice(0, 5)

  return EvaluationPerformanceBriefingSnapshotSchema.parse({
    source: 'fallback',
    generatedAt: new Date().toISOString(),
    promptVersion: PERFORMANCE_BRIEFING_PROMPT_VERSION,
    model: null,
    stale: false,
    headline:
      coverage.evidenceLevel === 'WEAK'
        ? '최근 12개월 근거가 제한적이어서 현재 평가 의견을 보수적으로 검토해야 합니다.'
        : `${evaluation.target.empName}의 최근 12개월 성과는 핵심 KPI와 월간 실적을 기준으로 대체로 추적 가능합니다.`,
    headlineEvidenceIds: pickEvidence(topKpiEvidenceId, topMonthlyEvidenceId, currentEvaluationEvidenceId).slice(0, 6),
    strengths: strengths.slice(0, 5),
    kpiSummary: kpiSummary.slice(0, 5),
    contributionSummary: contributionSummary.slice(0, 5),
    risks: risks.slice(0, 5),
    alignment: {
      status: alignmentStatus,
      reason:
        alignmentStatus === 'INSUFFICIENT_EVIDENCE'
          ? '평가 코멘트와 점수를 비교할 기본 근거는 있으나, 최근 12개월 데이터가 충분하지 않아 추가 확인이 필요합니다.'
          : `팀장 평가 점수 ${managerScore ?? '미입력'}와 근거 기반 점수 ${evidenceScore ?? '미산정'}의 차이를 중심으로 비교했으며, 현재 근거 수준은 ${coverage.evidenceLevel}입니다.`,
      evidenceIds: pickEvidence(currentEvaluationEvidenceId, topKpiEvidenceId, topMonthlyEvidenceId, topFeedback).slice(0, 8),
    },
    questions,
    evidenceCoverage: coverage,
    evidence: evidenceSeeds.slice(0, 32),
  })
}

function buildBriefingContext(
  loaded: Awaited<ReturnType<typeof loadEvaluationPerformanceBriefingContext>>
): BriefingContext {
  const { evaluation, referenceEvaluation, checkins, feedbackRounds, previousEvaluations } = loaded

  const evidenceSeeds: EvidenceSeed[] = []
  const addEvidence = (item: EvidenceSeed) => {
    if (!evidenceSeeds.some((existing) => existing.id === item.id)) {
      evidenceSeeds.push(item)
    }
  }

  addEvidence({
    id: `evaluation:${referenceEvaluation.id}`,
    sourceType: 'EVALUATION',
    sourceId: referenceEvaluation.id,
    title: `${EVAL_STAGE_LABELS[referenceEvaluation.evalStage]} 평가 의견`,
    snippet:
      referenceEvaluation.comment?.trim() || '종합 의견이 아직 충분히 작성되지 않았습니다.',
    href: buildEvidenceHref({
      sourceType: 'EVALUATION',
      evaluationId: referenceEvaluation.id,
      cycleId: evaluation.evalCycleId,
      employeeId: evaluation.targetId,
    }),
  })

  for (const item of evaluation.items) {
    addEvidence({
      id: `kpi:${item.personalKpiId}`,
      sourceType: 'PERSONAL_KPI',
      sourceId: item.personalKpiId,
      title: item.personalKpi.kpiName,
      snippet: `가중치 ${item.personalKpi.weight}% · 최근 달성률 ${formatPercent(
        item.personalKpi.monthlyRecords[0]?.achievementRate
      )}`,
      href: buildEvidenceHref({
        sourceType: 'PERSONAL_KPI',
        evaluationId: evaluation.id,
        cycleId: evaluation.evalCycleId,
        employeeId: evaluation.targetId,
        personalKpiId: item.personalKpiId,
      }),
    })

    if (item.personalKpi.linkedOrgKpi) {
      addEvidence({
        id: `orgkpi:${item.personalKpi.linkedOrgKpi.id}`,
        sourceType: 'ORG_KPI',
        sourceId: item.personalKpi.linkedOrgKpi.id,
        title: `${item.personalKpi.linkedOrgKpi.department.deptName} · ${item.personalKpi.linkedOrgKpi.kpiName}`,
        snippet: `${item.personalKpi.kpiName}와 연결된 조직 목표`,
        href: buildEvidenceHref({
          sourceType: 'ORG_KPI',
          evaluationId: evaluation.id,
          cycleId: evaluation.evalCycleId,
          employeeId: evaluation.targetId,
          personalKpiId: item.personalKpiId,
        }),
      })
    }

    for (const record of item.personalKpi.monthlyRecords.slice(0, 2)) {
      addEvidence({
        id: `monthly:${record.id}`,
        sourceType: 'MONTHLY_RECORD',
        sourceId: record.id,
        title: `${item.personalKpi.kpiName} / ${record.yearMonth}`,
        snippet: [record.activities, record.obstacles, record.efforts].filter(Boolean).join(' / ') || '상세 메모 없음',
        href: buildEvidenceHref({
          sourceType: 'MONTHLY_RECORD',
          evaluationId: evaluation.id,
          cycleId: evaluation.evalCycleId,
          employeeId: evaluation.targetId,
          personalKpiId: item.personalKpiId,
        }),
      })
    }
  }

  for (const checkin of checkins.slice(0, 4)) {
    addEvidence({
      id: `checkin:${checkin.id}`,
      sourceType: 'CHECKIN',
      sourceId: checkin.id,
      title: `체크인 / ${toLocalDateLabel(checkin.scheduledDate)}`,
      snippet: checkin.keyTakeaways || checkin.managerNotes || checkin.ownerNotes || '요약 메모 없음',
      href: buildEvidenceHref({
        sourceType: 'CHECKIN',
        evaluationId: evaluation.id,
        cycleId: evaluation.evalCycleId,
        employeeId: evaluation.targetId,
      }),
    })
  }

  for (const round of feedbackRounds.filter((item) => item.submittedCount > 0).slice(0, 4)) {
    addEvidence({
      id: `feedback:${round.id}`,
      sourceType: 'FEEDBACK',
      sourceId: round.id,
      title: `${round.roundName} (${round.roundType})`,
      snippet:
        round.summary ||
        `응답 ${round.submittedCount}건 · 평균 ${typeof round.averageRating === 'number' ? round.averageRating.toFixed(1) : '-'}`,
      href: buildEvidenceHref({
        sourceType: 'FEEDBACK',
        evaluationId: evaluation.id,
        cycleId: evaluation.evalCycleId,
        employeeId: evaluation.targetId,
      }),
    })
  }

  for (const history of previousEvaluations.slice(0, 3)) {
    addEvidence({
      id: `history:${history.id}`,
      sourceType: 'EVALUATION_HISTORY',
      sourceId: history.id,
      title: `${history.evalCycle.evalYear} ${history.evalCycle.cycleName} / ${EVAL_STAGE_LABELS[history.evalStage]}`,
      snippet:
        history.comment?.trim() ||
        `이전 평가 점수 ${typeof history.totalScore === 'number' ? Math.round(history.totalScore * 10) / 10 : '미입력'}`,
      href: buildEvidenceHref({
        sourceType: 'EVALUATION_HISTORY',
        evaluationId: history.id,
        cycleId: history.evalCycle.id,
        employeeId: evaluation.targetId,
      }),
    })
  }

  const managerScore = computeManagerScore(referenceEvaluation)
  const evidenceScore = computeEvidenceScore(evaluation, feedbackRounds)

  const coverage: EvaluationPerformanceBriefingSnapshot['evidenceCoverage'] = {
    evidenceLevel: computeEvidenceLevel({
      kpiCount: evaluation.items.length,
      monthlyRecordCount: evaluation.items.reduce((sum, item) => sum + item.personalKpi.monthlyRecords.length, 0),
      checkinCount: checkins.length,
      feedbackRoundCount: feedbackRounds.filter((round) => round.submittedCount > 0).length,
      evaluationHistoryCount: previousEvaluations.length,
    }),
    evidenceCount: evidenceSeeds.length,
    kpiCount: evaluation.items.length,
    monthlyRecordCount: evaluation.items.reduce((sum, item) => sum + item.personalKpi.monthlyRecords.length, 0),
    checkinCount: checkins.length,
    feedbackRoundCount: feedbackRounds.filter((round) => round.submittedCount > 0).length,
    evaluationHistoryCount: previousEvaluations.length,
  }

  const managerCommentSupported = isManagerCommentSupported(
    referenceEvaluation.comment,
    evaluation.items.map((item) => item.personalKpi.kpiName)
  )

  const alignmentStatus = determineEvaluationPerformanceBriefingAlignmentStatus({
    managerScore,
    evidenceScore,
    evidenceLevel: coverage.evidenceLevel,
    evidenceCount: coverage.evidenceCount,
    managerCommentSupported,
  })

  const promptInput = buildExecutivePerformanceBriefingInput({
    evaluation,
    referenceEvaluation,
    checkins,
    feedbackRounds,
    previousEvaluations,
    managerScore,
    evidenceScore,
    evidenceSeeds,
    coverage,
    managerCommentSupported,
    alignmentStatus,
  })

  const payload = sanitizeAiPayload({
    promptVersion: PERFORMANCE_BRIEFING_PROMPT_VERSION,
    evaluationId: evaluation.id,
    cycleId: evaluation.evalCycle.id,
    promptInput,
    heuristics: {
      alignmentStatus,
      scoreGap:
        typeof managerScore === 'number' && typeof evidenceScore === 'number'
          ? roundScore(managerScore - evidenceScore)
          : null,
      managerCommentSupported,
      evidenceLevel: coverage.evidenceLevel,
    },
  })

  const fallbackSnapshot = buildFallbackSnapshot({
    evaluation,
    referenceEvaluation,
    managerScore,
    evidenceScore,
    evidenceLevel: coverage.evidenceLevel,
    managerCommentSupported,
    alignmentStatus,
    evidenceSeeds,
    coverage,
    payload,
  })

  return {
    evaluation,
    referenceEvaluation,
    managerScore,
    evidenceScore,
    evidenceLevel: coverage.evidenceLevel,
    managerCommentSupported,
    alignmentStatus,
    evidenceSeeds,
    coverage,
    promptInput,
    payload,
    fallbackSnapshot,
  }
}

function composeStatementText(title: string, detail: string) {
  const normalizedTitle = title.trim()
  const normalizedDetail = detail.trim()
  if (!normalizedTitle) {
    return normalizedDetail
  }

  if (!normalizedDetail) {
    return normalizedTitle
  }

  if (normalizedDetail.startsWith(`${normalizedTitle}:`) || normalizedDetail.startsWith(normalizedTitle)) {
    return normalizedDetail
  }

  return `${normalizedTitle}: ${normalizedDetail}`
}

function buildSnapshotFromAiResult(params: {
  context: BriefingContext
  aiResult: ExecutivePerformanceBriefing
  source: EvaluationPerformanceBriefingSnapshot['source']
  model?: string | null
}) {
  const evidenceIds = new Set(params.context.evidenceSeeds.map((item) => item.id))
  const sanitizeEvidenceIds = (items: string[], fallback: string[]) => {
    const filtered = [...new Set(items.filter((item) => evidenceIds.has(item)))]
    return filtered.length ? filtered.slice(0, 8) : fallback.slice(0, 8)
  }
  const buildStatementDraft = (
    item: { title: string; detail: string; evidenceRefs: string[] },
    fallbackIds: string[]
  ) =>
    createStatement(
      composeStatementText(item.title, item.detail),
      sanitizeEvidenceIds(item.evidenceRefs, fallbackIds)
    )

  const summaryBlocks: StatementDraft[] = [
    createStatement(
      params.aiResult.performanceSummary.kpiAchievement.summary,
      sanitizeEvidenceIds(
        params.aiResult.performanceSummary.kpiAchievement.evidenceRefs,
        params.context.fallbackSnapshot.kpiSummary[0]?.evidenceIds ??
          params.context.fallbackSnapshot.headlineEvidenceIds
      )
    ),
    createStatement(
      params.aiResult.performanceSummary.continuity.summary,
      sanitizeEvidenceIds(
        params.aiResult.performanceSummary.continuity.evidenceRefs,
        params.context.fallbackSnapshot.kpiSummary[1]?.evidenceIds ??
          params.context.fallbackSnapshot.kpiSummary[0]?.evidenceIds ??
          params.context.fallbackSnapshot.headlineEvidenceIds
      )
    ),
  ]

  const contributionBlocks: StatementDraft[] = [
    createStatement(
      params.aiResult.performanceSummary.collaboration.summary,
      sanitizeEvidenceIds(
        params.aiResult.performanceSummary.collaboration.evidenceRefs,
        params.context.fallbackSnapshot.contributionSummary[0]?.evidenceIds ??
          params.context.fallbackSnapshot.headlineEvidenceIds
      )
    ),
    createStatement(
      params.aiResult.performanceSummary.organizationContribution.summary,
      sanitizeEvidenceIds(
        params.aiResult.performanceSummary.organizationContribution.evidenceRefs,
        params.context.fallbackSnapshot.contributionSummary[1]?.evidenceIds ??
          params.context.fallbackSnapshot.contributionSummary[0]?.evidenceIds ??
          params.context.fallbackSnapshot.headlineEvidenceIds
      )
    ),
    ...params.aiResult.contributionSummary.map((item) =>
      buildStatementDraft(
        item,
        params.context.fallbackSnapshot.contributionSummary[0]?.evidenceIds ??
          params.context.fallbackSnapshot.headlineEvidenceIds
      )
    ),
  ]

  const alignmentEvidenceIds = sanitizeEvidenceIds(
    [
      ...params.aiResult.alignment.matchedPoints.flatMap((item) => item.evidenceRefs),
      ...params.aiResult.alignment.mismatchPoints.flatMap((item) => item.evidenceRefs),
    ],
    params.context.fallbackSnapshot.alignment.evidenceIds
  )

  const headlineFallbackEvidence = sanitizeEvidenceIds(
    [
      ...params.aiResult.performanceSummary.kpiAchievement.evidenceRefs,
      ...params.aiResult.performanceSummary.continuity.evidenceRefs,
      ...params.aiResult.strengths.flatMap((item) => item.evidenceRefs),
    ],
    params.context.fallbackSnapshot.headlineEvidenceIds
  )

  const resolvedAlignmentStatus =
    params.context.alignmentStatus === 'INSUFFICIENT_EVIDENCE'
      ? 'INSUFFICIENT_EVIDENCE'
      : params.aiResult.alignment.status

  return EvaluationPerformanceBriefingSnapshotSchema.parse({
    source: params.source,
    generatedAt: new Date().toISOString(),
    promptVersion: PERFORMANCE_BRIEFING_PROMPT_VERSION,
    model: params.model ?? null,
    stale: false,
    headline: params.aiResult.headline.trim() || params.context.fallbackSnapshot.headline,
    headlineEvidenceIds: headlineFallbackEvidence,
    strengths: clampStatements(
      params.aiResult.strengths.map((item) =>
        buildStatementDraft(
          item,
          params.context.fallbackSnapshot.strengths[0]?.evidenceIds ??
            params.context.fallbackSnapshot.headlineEvidenceIds
        )
      ),
      params.context.fallbackSnapshot.strengths
    ),
    kpiSummary: clampStatements(summaryBlocks, params.context.fallbackSnapshot.kpiSummary),
    contributionSummary: clampStatements(contributionBlocks, params.context.fallbackSnapshot.contributionSummary),
    risks: clampStatements(
      params.aiResult.risks.map((item) =>
        buildStatementDraft(
          item,
          params.context.fallbackSnapshot.risks[0]?.evidenceIds ??
            params.context.fallbackSnapshot.headlineEvidenceIds
        )
      ),
      params.context.fallbackSnapshot.risks
    ),
    alignment: {
      status: resolvedAlignmentStatus,
      reason: params.aiResult.alignment.reason.trim() || params.context.fallbackSnapshot.alignment.reason,
      evidenceIds: alignmentEvidenceIds,
    },
    questions: normalizeQuestions(
      params.aiResult.followUpQuestions.map((item) => item.question),
      params.context.fallbackSnapshot.questions
    ),
    evidenceCoverage: params.context.coverage,
    evidence: params.context.evidenceSeeds.slice(0, 32),
  })
}

async function persistBriefingLog(params: {
  db: PrismaClient
  actorId: string
  requestStatus: AIRequestStatus
  evaluationId: string
  requestPayload: Record<string, unknown>
  snapshot: EvaluationPerformanceBriefingSnapshot
  model?: string | null
  inputTokens?: number
  outputTokens?: number
  estimatedCostUsd?: number
  errorCode?: string
  errorMessage?: string
}) {
  const log = await params.db.aiRequestLog.create({
    data: {
      requesterId: params.actorId,
      requestType: AIRequestType.EVAL_PERFORMANCE_BRIEFING,
      requestStatus: params.requestStatus,
      sourceType: PERFORMANCE_BRIEFING_SOURCE_TYPE,
      sourceId: params.evaluationId,
      provider: 'OPENAI',
      model: params.model ?? undefined,
      requestPayload: toJsonValue(params.requestPayload),
      responsePayload: toJsonValue(params.snapshot),
      piiMinimized: true,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      estimatedCostUsd: params.estimatedCostUsd ?? 0,
      errorCode: params.errorCode,
      errorMessage: params.errorMessage,
    },
  })

  await createAuditLog({
    userId: params.actorId,
    action: 'GENERATE_AI_PERFORMANCE_BRIEFING',
    entityType: 'Evaluation',
    entityId: params.evaluationId,
    newValue: {
      requestLogId: log.id,
      requestStatus: params.requestStatus,
      sourceType: PERFORMANCE_BRIEFING_SOURCE_TYPE,
      alignmentStatus: params.snapshot.alignment.status,
      evidenceCount: params.snapshot.evidenceCoverage.evidenceCount,
      source: params.snapshot.source,
    },
  })

  return log
}

export async function generateEvaluationPerformanceBriefing(
  params: GenerateEvaluationPerformanceBriefingParams,
  db: PrismaClient = prisma
) {
  const env = readExecutivePerformanceBriefingEnv()
  const loaded = await loadEvaluationPerformanceBriefingContext(params, db)
  const context = buildBriefingContext(loaded)
  const disabledReason = !env.enabled
    ? 'AI 브리핑 기능이 현재 비활성화되어 있어 근거 기반 요약만 제공합니다.'
    : !env.apiKey
      ? 'OPENAI_API_KEY가 설정되지 않아 근거 기반 요약으로 대체했습니다.'
      : null

  if (disabledReason) {
    const snapshot = EvaluationPerformanceBriefingSnapshotSchema.parse({
      ...context.fallbackSnapshot,
      source: 'disabled',
    })

    const log = await persistBriefingLog({
      db,
      actorId: params.actorId,
      requestStatus: AIRequestStatus.DISABLED,
      evaluationId: params.evaluationId,
      requestPayload: context.payload,
      snapshot,
      model: null,
      errorCode: !env.enabled ? 'AI_DISABLED' : 'AI_API_KEY_MISSING',
      errorMessage: disabledReason,
    })

    await recordOperationalEvent(
      {
        level: 'WARN',
        component: 'evaluation-performance-briefing',
        eventType: 'AI_DISABLED',
        message: disabledReason,
        metadata: {
          evaluationId: params.evaluationId,
          enabledSource: env.enabledSource,
        },
      },
      db
    )

    return EvaluationPerformanceBriefingSnapshotSchema.parse({
      ...snapshot,
      requestLogId: log.id,
    })
  }

  try {
    const aiResult = await requestExecutivePerformanceBriefingFromOpenAI(context.promptInput)
    const snapshot = buildSnapshotFromAiResult({
      context,
      aiResult: aiResult.result,
      source: 'ai',
      model: aiResult.model,
    })

    const log = await persistBriefingLog({
      db,
      actorId: params.actorId,
      requestStatus: AIRequestStatus.SUCCESS,
      evaluationId: params.evaluationId,
      requestPayload: context.payload,
      snapshot,
      model: aiResult.model,
      inputTokens: aiResult.inputTokens,
      outputTokens: aiResult.outputTokens,
      estimatedCostUsd: aiResult.estimatedCostUsd,
    })

    return EvaluationPerformanceBriefingSnapshotSchema.parse({
      ...snapshot,
      requestLogId: log.id,
    })
  } catch (error) {
    const errorCode = error instanceof AppError ? error.code : 'AI_REQUEST_FAILED'
    const errorMessage = error instanceof Error ? error.message : 'Unknown AI request error.'
    const snapshot = EvaluationPerformanceBriefingSnapshotSchema.parse({
      ...context.fallbackSnapshot,
      source: 'fallback',
    })

    const log = await persistBriefingLog({
      db,
      actorId: params.actorId,
      requestStatus: AIRequestStatus.FALLBACK,
      evaluationId: params.evaluationId,
      requestPayload: context.payload,
      snapshot,
      model: env.briefingModel,
      errorCode,
      errorMessage,
    })

    await recordOperationalEvent(
      {
        level: 'WARN',
        component: 'evaluation-performance-briefing',
        eventType: 'AI_REQUEST_FAILED',
        message: errorMessage,
        metadata: {
          evaluationId: params.evaluationId,
          errorCode,
        },
      },
      db
    )

    return EvaluationPerformanceBriefingSnapshotSchema.parse({
      ...snapshot,
      requestLogId: log.id,
    })
  }
}
