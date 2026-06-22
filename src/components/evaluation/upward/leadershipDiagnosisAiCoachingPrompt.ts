import type { UpwardReviewPageData } from '@/server/upward-review'
import {
  UpwardReviewAICoachingResultSchema,
  type UpwardReviewAICoachingResult,
} from '@/lib/upward-review-ai-coaching'

type ResultsData = NonNullable<UpwardReviewPageData['results']>
type JsonRecord = Record<string, unknown>

export type LeadershipDiagnosisAiCoachingPromptInput = {
  period: string
  orgContext: string
  criteriaSatisfied: boolean
  anonymitySatisfied: boolean
  responseCount: number
  anonymityThreshold: number
  visibilitySummary: string
  categorySummary: Array<{
    category: string
    averageSignal: number | null
    responseCount: number
  }>
  strengthCategories: string[]
  developmentCategories: string[]
  commentSummary: string[]
  limitations: string[]
}

export const LEADERSHIP_DIAGNOSIS_AI_COACHING_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'summary',
    'confidenceLevel',
    'dataLimitations',
    'leadershipStrengths',
    'developmentAreas',
    'blindSpots',
    'actionPlan30Days',
    'actionPlan60Days',
    'actionPlan90Days',
    'coachingQuestions',
    'managerHrGuide',
    'safetyNote',
  ],
  properties: {
    summary: { type: 'string' },
    confidenceLevel: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] },
    dataLimitations: { type: 'array', items: { type: 'string' } },
    leadershipStrengths: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'category', 'observedBehavior', 'evidence', 'keepDoing', 'teamImpact'],
        properties: {
          title: { type: 'string' },
          category: { type: 'string' },
          observedBehavior: { type: 'string' },
          evidence: { type: 'array', items: { type: 'string' } },
          keepDoing: { type: 'array', items: { type: 'string' } },
          teamImpact: { type: 'string' },
        },
      },
    },
    developmentAreas: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'category', 'observedPattern', 'impact', 'recommendedActions'],
        properties: {
          title: { type: 'string' },
          category: { type: 'string' },
          observedPattern: { type: 'string' },
          impact: { type: 'string' },
          recommendedActions: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    blindSpots: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'whyItMatters', 'signals', 'suggestedCheck'],
        properties: {
          title: { type: 'string' },
          whyItMatters: { type: 'string' },
          signals: { type: 'array', items: { type: 'string' } },
          suggestedCheck: { type: 'string' },
        },
      },
    },
    actionPlan30Days: { type: 'array', items: { type: 'string' } },
    actionPlan60Days: { type: 'array', items: { type: 'string' } },
    actionPlan90Days: { type: 'array', items: { type: 'string' } },
    coachingQuestions: {
      type: 'object',
      additionalProperties: false,
      required: ['selfReflection', 'teamConversation', 'nextCheckIn'],
      properties: {
        selfReflection: { type: 'array', items: { type: 'string' } },
        teamConversation: { type: 'array', items: { type: 'string' } },
        nextCheckIn: { type: 'array', items: { type: 'string' } },
      },
    },
    managerHrGuide: {
      type: 'object',
      additionalProperties: false,
      required: ['recognize', 'ask', 'agree', 'followUp'],
      properties: {
        recognize: { type: 'array', items: { type: 'string' } },
        ask: { type: 'array', items: { type: 'string' } },
        agree: { type: 'array', items: { type: 'string' } },
        followUp: { type: 'array', items: { type: 'string' } },
      },
    },
    safetyNote: { type: 'string' },
  },
} satisfies JsonRecord

export const LEADERSHIP_DIAGNOSIS_AI_COACHING_SYSTEM_PROMPT = [
  '너는 HR 성과관리 시스템의 리더십 진단 코칭 어시스턴트다.',
  '너의 역할은 공식 평가 점수나 등급을 산정하는 것이 아니라, 리더십 진단 결과를 바탕으로 대상자가 더 나은 리더십 행동을 실천할 수 있도록 구체적이고 실행 가능한 코칭 인사이트를 제공하는 것이다.',
  '반드시 지킬 원칙:',
  '1. 공식 평가 점수, 등급, 보상, 승진, 인사 판단을 산정하지 않는다.',
  '2. 응답자/평가자의 신원, 이름, 이메일, 사번, 개별 응답자를 추정하거나 노출하지 않는다.',
  '3. 익명성을 해칠 수 있는 표현을 사용하지 않는다.',
  '4. 입력 데이터에 없는 사실을 만들지 않는다.',
  '5. 강점과 보완점을 균형 있게 제시한다.',
  '6. 비난하거나 단정하지 않고, 관찰 가능한 행동 중심으로 설명한다.',
  '7. 리더십 행동 변화에 바로 적용할 수 있는 실행 계획을 제시한다.',
  '8. 한국어로 작성한다.',
  '9. 회사/팀 문화에 맞게 부드럽고 실용적으로 작성한다.',
  '10. 응답 수가 부족하거나 기준이 미충족이면 해석을 제한하고 주의 문구를 포함한다.',
  '11. 출력은 반드시 JSON으로만 작성하고 마크다운 코드블록은 쓰지 않는다.',
].join('\n')

function normalizeText(value: string) {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[이메일 제거]')
    .replace(/\b\d{2,3}[-.\s]?\d{3,4}[-.\s]?\d{4}\b/g, '[연락처 제거]')
    .replace(/\b\d{3,6}\b/g, '[식별번호 제거]')
    .replace(/\s+/g, ' ')
    .trim()
}

function uniqueStrings(values: string[], limit: number) {
  return Array.from(new Set(values.map(normalizeText).filter(Boolean))).slice(0, limit)
}

function sortByAverage(
  questions: ResultsData['questionSummaries'],
  direction: 'asc' | 'desc'
) {
  return questions
    .filter((question) => typeof question.averageScore === 'number')
    .sort((left, right) =>
      direction === 'asc'
        ? (left.averageScore ?? 0) - (right.averageScore ?? 0)
        : (right.averageScore ?? 0) - (left.averageScore ?? 0)
    )
}

export function buildLeadershipDiagnosisAiCoachingPromptInput(
  results: ResultsData
): LeadershipDiagnosisAiCoachingPromptInput {
  const categorySummary = results.questionSummaries.slice(0, 24).map((question) => ({
    category: question.category,
    averageSignal: question.averageScore,
    responseCount: question.responseCount,
  }))
  const strengthCategories = uniqueStrings(
    [
      ...results.strengths,
      ...sortByAverage(results.questionSummaries, 'desc')
        .slice(0, 5)
        .map((question) => question.category),
    ],
    8
  )
  const developmentCategories = uniqueStrings(
    [
      ...results.improvements,
      ...sortByAverage(results.questionSummaries, 'asc')
        .slice(0, 5)
        .map((question) => question.category),
    ],
    8
  )
  const commentSummary = uniqueStrings(
    [
      ...results.questionSummaries.flatMap((question) => question.textResponses.slice(0, 2)),
      ...results.rawResponses.flatMap((response) => [
        response.overallComment,
        ...response.answers.map((answer) => answer.textValue),
      ]),
    ],
    10
  )
  const limitations = [
    results.thresholdMet ? '' : `익명 기준 ${results.minRaters}명에 미달하여 해석을 제한해야 합니다.`,
    results.feedbackCount < results.minRaters
      ? `현재 응답 ${results.feedbackCount}건 / 기준 ${results.minRaters}건입니다.`
      : '',
    results.questionSummaries.length ? '' : '문항별 결과 데이터가 아직 충분하지 않습니다.',
    commentSummary.length ? '' : '익명화된 의견 요약이 충분하지 않습니다.',
  ].filter(Boolean)

  return {
    period: results.roundName,
    orgContext: `${results.targetEmployee.department} · ${results.targetEmployee.position}`,
    criteriaSatisfied: results.thresholdMet,
    anonymitySatisfied: results.thresholdMet,
    responseCount: results.feedbackCount,
    anonymityThreshold: results.minRaters,
    visibilitySummary: results.visible ? '익명 기준 충족 후 결과 공개' : '익명 기준 또는 공개 상태 대기',
    categorySummary,
    strengthCategories,
    developmentCategories,
    commentSummary,
    limitations,
  }
}

export function buildLeadershipDiagnosisAiCoachingPrompt(
  input: LeadershipDiagnosisAiCoachingPromptInput
) {
  return {
    system: LEADERSHIP_DIAGNOSIS_AI_COACHING_SYSTEM_PROMPT,
    user: [
      '다음은 리더십 진단 결과 요약입니다.',
      '이 데이터만 사용해서 코칭 인사이트를 작성해 주세요.',
      '',
      '[진단 맥락]',
      `- 진단 기간: ${input.period}`,
      `- 대상자 역할/조직: ${input.orgContext}`,
      `- 응답 기준 충족 여부: ${input.criteriaSatisfied ? '충족' : '미충족'}`,
      `- 익명 기준 충족 여부: ${input.anonymitySatisfied ? '충족' : '미충족'}`,
      `- 응답 수: ${input.responseCount}`,
      `- 익명 기준: ${input.anonymityThreshold}`,
      `- 결과 공개 범위: ${input.visibilitySummary}`,
      '',
      '[카테고리 요약]',
      JSON.stringify(input.categorySummary),
      '',
      '[강점 카테고리]',
      JSON.stringify(input.strengthCategories),
      '',
      '[보완 카테고리]',
      JSON.stringify(input.developmentCategories),
      '',
      '[주요 의견 요약]',
      JSON.stringify(input.commentSummary),
      '',
      '[데이터 한계]',
      JSON.stringify(input.limitations),
      '',
      '[주의]',
      '- 개별 응답자를 추정하지 마세요.',
      '- 공식 점수나 등급을 산정하지 마세요.',
      '- 승진, 보상, 인사 판단을 하지 마세요.',
      '- 입력 데이터에 없는 내용을 만들지 마세요.',
      '- 응답 수가 부족하면 확정적인 표현을 피하세요.',
      '',
      '정해진 JSON schema에 맞춰 응답하세요.',
    ].join('\n'),
  }
}

export function validateLeadershipDiagnosisAiCoachingResult(value: unknown): UpwardReviewAICoachingResult {
  return UpwardReviewAICoachingResultSchema.parse(value)
}
