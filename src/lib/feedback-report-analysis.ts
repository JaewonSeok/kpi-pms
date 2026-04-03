import type { QuestionType, RaterRelationship } from '@prisma/client'
import type { FeedbackResultRecipientProfile } from './feedback-result-presentation'

export type FeedbackReportAnalysisStrength = 'LIGHT' | 'DEFAULT' | 'STRONG'

export type FeedbackReportAnalysisSectionKey =
  | 'overview'
  | 'questionInsights'
  | 'relativeComparison'
  | 'selfAwareness'
  | 'reviewDetails'
  | 'questionScores'
  | 'objectiveAnswers'
  | 'resultLink'

export type FeedbackReportAnalysisMenuItemConfig = {
  label: string
  visible: boolean
}

export type FeedbackReportAnalysisSettings = {
  overview: {
    companyMessage: string
    purposeMessage: string
    acceptanceGuide: string
  }
  menu: Record<FeedbackReportAnalysisSectionKey, FeedbackReportAnalysisMenuItemConfig>
  wording: {
    strengthLabel: string
    improvementLabel: string
    selfAwarenessLabel: string
    selfHighLabel: string
    selfLowLabel: string
    balancedLabel: string
  }
  strength: FeedbackReportAnalysisStrength
}

export type FeedbackReportAnalysisMenuItem = {
  key: FeedbackReportAnalysisSectionKey
  label: string
  visible: boolean
}

export type FeedbackReportQuestionInsight = {
  questionId: string
  category: string
  questionText: string
  tone: 'STRENGTH' | 'IMPROVEMENT' | 'BALANCED'
  toneLabel: string
  targetScore: number | null
  benchmarkScore: number | null
  deltaFromBenchmark: number | null
  selfScore: number | null
  othersScore: number | null
  deltaFromOthers: number | null
  reviewerAverages: Array<{
    relationship: string
    label: string
    average: number | null
    count: number
  }>
  interpretation: string
}

export type FeedbackReportQuestionScoreCard = {
  questionId: string
  category: string
  questionText: string
  targetScore: number | null
  benchmarkScore: number | null
  series: Array<{
    key: string
    label: string
    value: number | null
  }>
}

export type FeedbackReportReviewDetail = {
  feedbackId: string
  reviewerName: string
  relationship: string
  relationshipLabel: string
  totalScore: number | null
  overallComment: string | null
  submittedAt?: string | null
  responseCount: number
}

export type FeedbackReportChoiceOption = {
  label: string
  count: number
  ratio: number
  reviewerBreakdown: Array<{
    relationship: string
    label: string
    count: number
    total: number
    ratio: number
  }>
}

export type FeedbackReportChoiceAnalysis = {
  questionId: string
  category: string
  questionText: string
  selectionMode: 'SINGLE' | 'MULTIPLE'
  description: string
  responsesCount: number
  options: FeedbackReportChoiceOption[]
}

export type FeedbackReportAnalysisPayload = {
  overview: FeedbackReportAnalysisSettings['overview']
  menu: FeedbackReportAnalysisMenuItem[]
  wording: FeedbackReportAnalysisSettings['wording']
  strength: FeedbackReportAnalysisStrength
  strengthDescription: string
  questionInsights: FeedbackReportQuestionInsight[]
  relativeComparisons: FeedbackReportQuestionInsight[]
  selfAwareness: FeedbackReportQuestionInsight[]
  reviewDetails: FeedbackReportReviewDetail[]
  questionScoreCards: FeedbackReportQuestionScoreCard[]
  objectiveAnswers: FeedbackReportChoiceAnalysis[]
  resultLink: {
    profileLabel: string
    pdfHref: string
    links: Array<{
      label: string
      href: string
      description: string
    }>
  }
}

type RatingResponse = {
  questionId: string
  ratingValue: number | null
  textValue: string | null
  question: {
    category: string
    questionText: string
    questionType: QuestionType
  }
}

type FeedbackShape = {
  id: string
  relationship: RaterRelationship | string
  giverName: string
  overallComment: string | null
  submittedAt?: string | Date | null
  responses: RatingResponse[]
}

type QuestionCatalogItem = {
  id: string
  category: string
  questionText: string
  questionType: QuestionType
}

export const FEEDBACK_REPORT_ANALYSIS_SECTIONS: FeedbackReportAnalysisSectionKey[] = [
  'overview',
  'questionInsights',
  'relativeComparison',
  'selfAwareness',
  'reviewDetails',
  'questionScores',
  'objectiveAnswers',
  'resultLink',
]

const SECTION_DEFAULT_LABELS: Record<FeedbackReportAnalysisSectionKey, string> = {
  overview: '개요',
  questionInsights: '질문별 인사이트',
  relativeComparison: '상대 비교',
  selfAwareness: '자기객관화',
  reviewDetails: '리뷰 상세 내역',
  questionScores: '질문별 점수',
  objectiveAnswers: '객관식 답변',
  resultLink: '리뷰 결과 바로가기',
}

export const FEEDBACK_ANALYSIS_STRENGTH_LABELS: Record<FeedbackReportAnalysisStrength, string> = {
  LIGHT: '약함',
  DEFAULT: '기본',
  STRONG: '강함',
}

const STRENGTH_DESCRIPTIONS: Record<FeedbackReportAnalysisStrength, string> = {
  LIGHT: '작은 차이도 넓게 보여주는 분석입니다.',
  DEFAULT: '적절히 균형 잡힌 차이만 보여주는 기본 분석입니다.',
  STRONG: '조직 평균 대비 차이가 큰 항목만 선명하게 보여주는 분석입니다.',
}

const RELATIONSHIP_LABELS: Record<string, string> = {
  SELF: '셀프',
  SUPERVISOR: '상향',
  PEER: '동료',
  SUBORDINATE: '하향',
  CROSS_TEAM_PEER: '타 팀 동료',
  CROSS_DEPT: '타 조직',
}

const DEFAULT_FEEDBACK_REPORT_ANALYSIS_MENU = FEEDBACK_REPORT_ANALYSIS_SECTIONS.reduce(
  (acc, key) => {
    acc[key] = {
      label: SECTION_DEFAULT_LABELS[key],
      visible: true,
    }
    return acc
  },
  {} as Record<FeedbackReportAnalysisSectionKey, FeedbackReportAnalysisMenuItemConfig>
)

export const DEFAULT_FEEDBACK_REPORT_ANALYSIS_SETTINGS: FeedbackReportAnalysisSettings = {
  overview: {
    companyMessage:
      '이번 리포트는 지난 리뷰 과정에서 확인된 강점과 보완 포인트를 차분히 이해하고, 다음 성장 대화로 이어가기 위한 참고 자료입니다.',
    purposeMessage:
      '평가 결과를 단순히 전달하는 데 그치지 않고, 질문별 차이와 reviewer 관점을 함께 살펴보며 실제 행동 계획으로 연결할 수 있도록 구성했습니다.',
    acceptanceGuide:
      '결과를 읽을 때는 한두 문장보다 반복된 패턴과 질문별 차이를 먼저 살펴봐 주세요. 필요하면 리더와 함께 해석을 조정하며 다음 분기 실행 과제로 이어가면 좋습니다.',
  },
  menu: DEFAULT_FEEDBACK_REPORT_ANALYSIS_MENU,
  wording: {
    strengthLabel: '강점',
    improvementLabel: '보완점',
    selfAwarenessLabel: '자기객관화',
    selfHighLabel: '자기 인식이 높음',
    selfLowLabel: '자기 인식이 낮음',
    balancedLabel: '균형',
  },
  strength: 'DEFAULT',
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function sanitizeLabel(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim().slice(0, 40) : fallback
}

function sanitizeLongText(value: unknown, fallback: string, max = 1200) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim().slice(0, max) : fallback
}

function parseMenuItem(value: unknown, fallback: FeedbackReportAnalysisMenuItemConfig) {
  const record = asRecord(value)
  if (!record) return fallback

  return {
    label: sanitizeLabel(record.label, fallback.label),
    visible: typeof record.visible === 'boolean' ? record.visible : fallback.visible,
  }
}

export function parseFeedbackReportAnalysisSettings(
  value: unknown
): FeedbackReportAnalysisSettings {
  const record = asRecord(value)
  if (!record) return DEFAULT_FEEDBACK_REPORT_ANALYSIS_SETTINGS

  const overview = asRecord(record.overview)
  const menu = asRecord(record.menu)
  const wording = asRecord(record.wording)

  return {
    overview: {
      companyMessage: sanitizeLongText(
        overview?.companyMessage,
        DEFAULT_FEEDBACK_REPORT_ANALYSIS_SETTINGS.overview.companyMessage
      ),
      purposeMessage: sanitizeLongText(
        overview?.purposeMessage,
        DEFAULT_FEEDBACK_REPORT_ANALYSIS_SETTINGS.overview.purposeMessage
      ),
      acceptanceGuide: sanitizeLongText(
        overview?.acceptanceGuide,
        DEFAULT_FEEDBACK_REPORT_ANALYSIS_SETTINGS.overview.acceptanceGuide
      ),
    },
    menu: FEEDBACK_REPORT_ANALYSIS_SECTIONS.reduce((acc, key) => {
      acc[key] = parseMenuItem(menu?.[key], DEFAULT_FEEDBACK_REPORT_ANALYSIS_SETTINGS.menu[key])
      return acc
    }, {} as Record<FeedbackReportAnalysisSectionKey, FeedbackReportAnalysisMenuItemConfig>),
    wording: {
      strengthLabel: sanitizeLabel(
        wording?.strengthLabel,
        DEFAULT_FEEDBACK_REPORT_ANALYSIS_SETTINGS.wording.strengthLabel
      ),
      improvementLabel: sanitizeLabel(
        wording?.improvementLabel,
        DEFAULT_FEEDBACK_REPORT_ANALYSIS_SETTINGS.wording.improvementLabel
      ),
      selfAwarenessLabel: sanitizeLabel(
        wording?.selfAwarenessLabel,
        DEFAULT_FEEDBACK_REPORT_ANALYSIS_SETTINGS.wording.selfAwarenessLabel
      ),
      selfHighLabel: sanitizeLabel(
        wording?.selfHighLabel,
        DEFAULT_FEEDBACK_REPORT_ANALYSIS_SETTINGS.wording.selfHighLabel
      ),
      selfLowLabel: sanitizeLabel(
        wording?.selfLowLabel,
        DEFAULT_FEEDBACK_REPORT_ANALYSIS_SETTINGS.wording.selfLowLabel
      ),
      balancedLabel: sanitizeLabel(
        wording?.balancedLabel,
        DEFAULT_FEEDBACK_REPORT_ANALYSIS_SETTINGS.wording.balancedLabel
      ),
    },
    strength:
      record.strength === 'LIGHT' || record.strength === 'DEFAULT' || record.strength === 'STRONG'
        ? record.strength
        : DEFAULT_FEEDBACK_REPORT_ANALYSIS_SETTINGS.strength,
  }
}

export function getFeedbackReportAnalysisThreshold(level: FeedbackReportAnalysisStrength) {
  if (level === 'LIGHT') {
    return { benchmarkDelta: 4, selfAwarenessDelta: 5 }
  }
  if (level === 'STRONG') {
    return { benchmarkDelta: 12, selfAwarenessDelta: 14 }
  }
  return { benchmarkDelta: 8, selfAwarenessDelta: 10 }
}

export function describeFeedbackAnalysisStrength(level: FeedbackReportAnalysisStrength) {
  return {
    label: FEEDBACK_ANALYSIS_STRENGTH_LABELS[level],
    description: STRENGTH_DESCRIPTIONS[level],
  }
}

function average(values: number[]) {
  if (!values.length) return null
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10
}

function toScore100(value: number | null | undefined) {
  if (typeof value !== 'number') return null
  return Math.round(value * 20 * 10) / 10
}

function roundDelta(value: number | null) {
  return typeof value === 'number' ? Math.round(value * 10) / 10 : null
}

function parseChoiceValues(textValue: string | null | undefined) {
  if (!textValue?.trim()) return []
  const trimmed = textValue.trim()

  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => (typeof item === 'string' ? item.trim() : ''))
          .filter((item) => item.length > 0)
      }
    } catch {
      // Ignore malformed legacy payloads and fall through to string parsing.
    }
  }

  if (trimmed.includes('\n')) {
    return trimmed
      .split('\n')
      .map((item) => item.replace(/^[-*]\s*/, '').trim())
      .filter((item) => item.length > 0)
  }

  if (trimmed.includes(',')) {
    return trimmed
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
  }

  return [trimmed]
}

function formatRelationshipLabel(relationship: string) {
  return RELATIONSHIP_LABELS[relationship] ?? relationship
}

function buildBenchmarkMap(feedbacks: FeedbackShape[]) {
  const benchmark = new Map<string, number[]>()
  for (const feedback of feedbacks) {
    for (const response of feedback.responses) {
      if (response.question.questionType !== 'RATING_SCALE' || typeof response.ratingValue !== 'number') continue
      const current = benchmark.get(response.questionId) ?? []
      current.push(toScore100(response.ratingValue) ?? 0)
      benchmark.set(response.questionId, current)
    }
  }
  return benchmark
}

function buildQuestionAggregates(params: {
  questions: QuestionCatalogItem[]
  targetFeedbacks: FeedbackShape[]
  benchmarkFeedbacks: FeedbackShape[]
  wording: FeedbackReportAnalysisSettings['wording']
  strength: FeedbackReportAnalysisStrength
}) {
  const threshold = getFeedbackReportAnalysisThreshold(params.strength)
  const benchmarkMap = buildBenchmarkMap(params.benchmarkFeedbacks)

  const insights: FeedbackReportQuestionInsight[] = []
  const scoreCards: FeedbackReportQuestionScoreCard[] = []
  const selfAwareness: FeedbackReportQuestionInsight[] = []
  const objectiveAnswers: FeedbackReportChoiceAnalysis[] = []

  for (const question of params.questions) {
    const responses = params.targetFeedbacks.flatMap((feedback) =>
      feedback.responses
        .filter((response) => response.questionId === question.id)
        .map((response) => ({
          ...response,
          relationship: feedback.relationship,
        }))
    )

    if (question.questionType === 'RATING_SCALE') {
      const scoreByRelationship = new Map<string, number[]>()
      for (const response of responses) {
        if (typeof response.ratingValue !== 'number') continue
        const list = scoreByRelationship.get(response.relationship) ?? []
        list.push(toScore100(response.ratingValue) ?? 0)
        scoreByRelationship.set(response.relationship, list)
      }

      const targetScore = average(
        responses
          .map((response) => toScore100(response.ratingValue))
          .filter((value): value is number => typeof value === 'number')
      )
      const benchmarkScore = average(benchmarkMap.get(question.id) ?? [])
      const deltaFromBenchmark =
        typeof targetScore === 'number' && typeof benchmarkScore === 'number'
          ? roundDelta(targetScore - benchmarkScore)
          : null
      const selfScore = average(scoreByRelationship.get('SELF') ?? [])
      const othersScore = average(
        [...scoreByRelationship.entries()]
          .filter(([relationship]) => relationship !== 'SELF')
          .flatMap(([, values]) => values)
      )
      const deltaFromOthers =
        typeof selfScore === 'number' && typeof othersScore === 'number'
          ? roundDelta(selfScore - othersScore)
          : null

      const reviewerAverages = [...scoreByRelationship.entries()]
        .map(([relationship, values]) => ({
          relationship,
          label: formatRelationshipLabel(relationship),
          average: average(values),
          count: values.length,
        }))
        .sort((a, b) => a.label.localeCompare(b.label, 'ko'))

      const tone =
        typeof deltaFromBenchmark === 'number' && deltaFromBenchmark >= threshold.benchmarkDelta
          ? 'STRENGTH'
          : typeof deltaFromBenchmark === 'number' && deltaFromBenchmark <= -threshold.benchmarkDelta
            ? 'IMPROVEMENT'
            : 'BALANCED'

      const toneLabel =
        tone === 'STRENGTH'
          ? params.wording.strengthLabel
          : tone === 'IMPROVEMENT'
            ? params.wording.improvementLabel
            : params.wording.balancedLabel

      const interpretation =
        tone === 'STRENGTH'
          ? `${params.wording.strengthLabel}으로 볼 수 있는 질문입니다. 조직 평균보다 ${Math.abs(deltaFromBenchmark ?? 0).toFixed(1)}점 높았습니다.`
          : tone === 'IMPROVEMENT'
            ? `${params.wording.improvementLabel}으로 먼저 살펴볼 질문입니다. 조직 평균보다 ${Math.abs(deltaFromBenchmark ?? 0).toFixed(1)}점 낮았습니다.`
            : '조직 평균과 큰 차이는 없지만, reviewer type별 점수 차이를 함께 보면 해석에 도움이 됩니다.'

      insights.push({
        questionId: question.id,
        category: question.category,
        questionText: question.questionText,
        tone,
        toneLabel,
        targetScore,
        benchmarkScore,
        deltaFromBenchmark,
        selfScore,
        othersScore,
        deltaFromOthers,
        reviewerAverages,
        interpretation,
      })

      if (typeof deltaFromOthers === 'number') {
        const selfTone =
          deltaFromOthers >= threshold.selfAwarenessDelta
            ? params.wording.selfHighLabel
            : deltaFromOthers <= -threshold.selfAwarenessDelta
              ? params.wording.selfLowLabel
              : params.wording.balancedLabel

        selfAwareness.push({
          questionId: question.id,
          category: question.category,
          questionText: question.questionText,
          tone:
            deltaFromOthers >= threshold.selfAwarenessDelta
              ? 'STRENGTH'
              : deltaFromOthers <= -threshold.selfAwarenessDelta
                ? 'IMPROVEMENT'
                : 'BALANCED',
          toneLabel: selfTone,
          targetScore,
          benchmarkScore,
          deltaFromBenchmark,
          selfScore,
          othersScore,
          deltaFromOthers,
          reviewerAverages,
          interpretation:
            deltaFromOthers >= threshold.selfAwarenessDelta
              ? `셀프 점수가 타인 평균보다 ${Math.abs(deltaFromOthers).toFixed(1)}점 높습니다. 기대와 실제 인식 차이를 함께 점검해 보세요.`
              : deltaFromOthers <= -threshold.selfAwarenessDelta
                ? `셀프 점수가 타인 평균보다 ${Math.abs(deltaFromOthers).toFixed(1)}점 낮습니다. 스스로 낮게 평가한 이유를 함께 살펴보면 좋습니다.`
                : '셀프 평가와 타인 평균이 비교적 비슷합니다. 현재 인식 차이는 크지 않습니다.',
        })
      }

      scoreCards.push({
        questionId: question.id,
        category: question.category,
        questionText: question.questionText,
        targetScore,
        benchmarkScore,
        series: [
          { key: 'target', label: '내 평균 점수', value: targetScore },
          { key: 'benchmark', label: '조직 평균', value: benchmarkScore },
          ...reviewerAverages.map((item) => ({
            key: item.relationship,
            label: item.label,
            value: item.average,
          })),
        ],
      })

      continue
    }

    if (question.questionType !== 'MULTIPLE_CHOICE') {
      continue
    }

    const optionMap = new Map<
      string,
      {
        label: string
        count: number
        reviewerBreakdown: Map<string, number>
      }
    >()
    const relationshipTotals = new Map<string, number>()
    let isMultiple = false
    let answeredCount = 0

    for (const response of responses) {
      const selectedOptions = parseChoiceValues(response.textValue)
      if (!selectedOptions.length) continue
      answeredCount += 1
      if (selectedOptions.length > 1) isMultiple = true
      relationshipTotals.set(
        response.relationship,
        (relationshipTotals.get(response.relationship) ?? 0) + 1
      )

      for (const option of selectedOptions) {
        const current =
          optionMap.get(option) ??
          {
            label: option,
            count: 0,
            reviewerBreakdown: new Map<string, number>(),
          }
        current.count += 1
        current.reviewerBreakdown.set(
          response.relationship,
          (current.reviewerBreakdown.get(response.relationship) ?? 0) + 1
        )
        optionMap.set(option, current)
      }
    }

    const options = [...optionMap.values()]
      .map((item) => ({
        label: item.label,
        count: item.count,
        ratio: answeredCount ? Math.round((item.count / answeredCount) * 1000) / 10 : 0,
        reviewerBreakdown: [...item.reviewerBreakdown.entries()]
          .map(([relationship, count]) => ({
            relationship,
            label: formatRelationshipLabel(relationship),
            count,
            total: relationshipTotals.get(relationship) ?? 0,
            ratio:
              relationshipTotals.get(relationship)
                ? Math.round((count / (relationshipTotals.get(relationship) ?? 1)) * 1000) / 10
                : 0,
          }))
          .sort((a, b) => a.label.localeCompare(b.label, 'ko')),
      }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'ko'))

    objectiveAnswers.push({
      questionId: question.id,
      category: question.category,
      questionText: question.questionText,
      selectionMode: isMultiple ? 'MULTIPLE' : 'SINGLE',
      description: isMultiple
        ? '복수 선택 응답을 기준으로 전체 참여 대비 비율을 보여줍니다.'
        : '선택 인원 수와 reviewer type별 분포를 함께 보여줍니다.',
      responsesCount: answeredCount,
      options,
    })
  }

  return {
    insights: insights.sort(
      (a, b) => Math.abs(b.deltaFromBenchmark ?? 0) - Math.abs(a.deltaFromBenchmark ?? 0)
    ),
    selfAwareness: selfAwareness.sort(
      (a, b) => Math.abs(b.deltaFromOthers ?? 0) - Math.abs(a.deltaFromOthers ?? 0)
    ),
    scoreCards,
    objectiveAnswers,
  }
}

export function buildFeedbackReportAnalysis(params: {
  settings: FeedbackReportAnalysisSettings
  roundName: string
  recipientProfile: FeedbackResultRecipientProfile
  pdfHref: string
  links: Array<{
    label: string
    href: string
    description: string
  }>
  questions: QuestionCatalogItem[]
  targetFeedbacks: FeedbackShape[]
  benchmarkFeedbacks: FeedbackShape[]
}) {
  const { insights, selfAwareness, scoreCards, objectiveAnswers } = buildQuestionAggregates({
    questions: params.questions,
    targetFeedbacks: params.targetFeedbacks,
    benchmarkFeedbacks: params.benchmarkFeedbacks,
    wording: params.settings.wording,
    strength: params.settings.strength,
  })

  const reviewDetails = params.targetFeedbacks
    .map((feedback) => ({
      feedbackId: feedback.id,
      reviewerName: feedback.giverName,
      relationship: feedback.relationship,
      relationshipLabel: formatRelationshipLabel(feedback.relationship),
      totalScore: average(
        feedback.responses
          .map((response) => toScore100(response.ratingValue))
          .filter((value): value is number => typeof value === 'number')
      ),
      overallComment: feedback.overallComment,
      submittedAt:
        typeof feedback.submittedAt === 'string'
          ? feedback.submittedAt
          : feedback.submittedAt instanceof Date
            ? feedback.submittedAt.toISOString()
            : null,
      responseCount: feedback.responses.length,
    }))
    .sort((a, b) => a.relationshipLabel.localeCompare(b.relationshipLabel, 'ko'))

  return {
    overview: params.settings.overview,
    menu: FEEDBACK_REPORT_ANALYSIS_SECTIONS.map((key) => ({
      key,
      label: params.settings.menu[key].label,
      visible: params.settings.menu[key].visible,
    })),
    wording: params.settings.wording,
    strength: params.settings.strength,
    strengthDescription: describeFeedbackAnalysisStrength(params.settings.strength).description,
    questionInsights: insights,
    relativeComparisons: insights,
    selfAwareness,
    reviewDetails,
    questionScoreCards: scoreCards,
    objectiveAnswers,
    resultLink: {
      profileLabel:
        params.recipientProfile === 'REVIEWEE'
          ? '구성원용 결과지'
          : params.recipientProfile === 'LEADER'
            ? '팀장용 결과지'
            : '경영진용 결과지',
      pdfHref: params.pdfHref,
      links: params.links,
    },
  } satisfies FeedbackReportAnalysisPayload
}
