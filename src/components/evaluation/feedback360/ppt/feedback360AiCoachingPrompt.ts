import { z } from 'zod'
import type { Feedback360PageData } from '@/server/feedback-360'
import {
  getSelectedFeedback360ResponseTagLabels,
  parseFeedback360TagSummaryFromComment,
} from '../feedback360-response-tag-pool'

type ResultsData = NonNullable<Feedback360PageData['results']>

export type Feedback360AiCoachingRole = 'SELF' | 'MANAGER' | 'HR'

export type Feedback360AiCoachingPromptInput = {
  period: string
  orgContext: string
  anonymitySatisfied: boolean
  responseCount: number
  anonymityThreshold: number
  visibilitySummary: string
  categorySummary: Array<{
    category: string
    averageSignal: number
    responseCount: number
  }>
  positiveTags: Array<{
    label: string
    category: string
    count: number
  }>
  improvementTags: Array<{
    label: string
    category: string
    count: number
  }>
  commentSummary: string[]
  strengths: string[]
  improvements: string[]
  limitations: string[]
}

export const Feedback360AiCoachingResultSchema = z.object({
  summary: z.string().min(1),
  confidenceLevel: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  dataLimitations: z.array(z.string()).default([]),
  strengths: z.array(
    z.object({
      title: z.string(),
      evidence: z.array(z.string()).default([]),
      coaching: z.string(),
      keepDoing: z.array(z.string()).default([]),
    })
  ),
  developmentAreas: z.array(
    z.object({
      title: z.string(),
      evidence: z.array(z.string()).default([]),
      impact: z.string(),
      recommendedActions: z.array(z.string()).default([]),
    })
  ),
  blindSpots: z.array(
    z.object({
      title: z.string(),
      whyItMatters: z.string(),
      signals: z.array(z.string()).default([]),
      suggestedCheck: z.string(),
    })
  ),
  actionPlan30Days: z.array(z.string()).default([]),
  actionPlan60Days: z.array(z.string()).default([]),
  actionPlan90Days: z.array(z.string()).default([]),
  coachingQuestions: z.object({
    selfReflection: z.array(z.string()).default([]),
    managerConversation: z.array(z.string()).default([]),
    nextCheckIn: z.array(z.string()).default([]),
  }),
  managerGuide: z.object({
    recognize: z.array(z.string()).default([]),
    ask: z.array(z.string()).default([]),
    agree: z.array(z.string()).default([]),
    followUp: z.array(z.string()).default([]),
  }),
  safetyNote: z.string().min(1),
})

export type Feedback360AiCoachingResult = z.infer<typeof Feedback360AiCoachingResultSchema>

type JsonRecord = Record<string, unknown>

export const FEEDBACK_360_AI_COACHING_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'summary',
    'confidenceLevel',
    'dataLimitations',
    'strengths',
    'developmentAreas',
    'blindSpots',
    'actionPlan30Days',
    'actionPlan60Days',
    'actionPlan90Days',
    'coachingQuestions',
    'managerGuide',
    'safetyNote',
  ],
  properties: {
    summary: { type: 'string' },
    confidenceLevel: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] },
    dataLimitations: { type: 'array', items: { type: 'string' } },
    strengths: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'evidence', 'coaching', 'keepDoing'],
        properties: {
          title: { type: 'string' },
          evidence: { type: 'array', items: { type: 'string' } },
          coaching: { type: 'string' },
          keepDoing: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    developmentAreas: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'evidence', 'impact', 'recommendedActions'],
        properties: {
          title: { type: 'string' },
          evidence: { type: 'array', items: { type: 'string' } },
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
      required: ['selfReflection', 'managerConversation', 'nextCheckIn'],
      properties: {
        selfReflection: { type: 'array', items: { type: 'string' } },
        managerConversation: { type: 'array', items: { type: 'string' } },
        nextCheckIn: { type: 'array', items: { type: 'string' } },
      },
    },
    managerGuide: {
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

export const FEEDBACK_360_AI_COACHING_SYSTEM_PROMPT = [
  '너는 HR 성과관리 시스템의 360 다면평가 코칭 어시스턴트다.',
  '역할은 공식 평가 결과 산정이 아니라, 다면평가 요약을 바탕으로 대상자가 성장할 수 있도록 실행 가능한 코칭 인사이트를 제공하는 것이다.',
  '반드시 지킬 원칙:',
  '1. 공식 평가 점수, 등급, 보상, 승진 판단을 산정하지 않는다.',
  '2. 리뷰어의 신원, 이름, 이메일, 사번, 개별 응답자를 추정하거나 노출하지 않는다.',
  '3. 익명성을 해칠 수 있는 표현을 사용하지 않는다.',
  '4. 입력 데이터에 없는 사실을 만들지 않는다.',
  '5. 강점과 보완점을 균형 있게 제시한다.',
  '6. 비난하거나 단정하지 말고, 관찰 가능한 행동 중심으로 설명한다.',
  '7. 실행 가능한 행동 제안을 제공한다.',
  '8. 한국어로 작성한다.',
  '9. 응답 수가 부족하거나 익명 기준이 미충족이면 해석을 제한하고 주의 문구를 포함한다.',
  '10. 출력은 반드시 JSON으로만 작성하고 마크다운 코드블록은 쓰지 않는다.',
].join('\n')

function normalizeText(value: string) {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[이메일 제거]')
    .replace(/\b\d{3,6}\b/g, '[식별번호 제거]')
    .replace(/\b\d{2,3}[-.\s]?\d{3,4}[-.\s]?\d{4}\b/g, '[연락처 제거]')
    .replace(/\s+/g, ' ')
    .trim()
}

function uniqueStrings(values: string[], limit: number) {
  return Array.from(new Set(values.map(normalizeText).filter(Boolean))).slice(0, limit)
}

function buildTagCounts(results: ResultsData) {
  const tagCounts = new Map<string, { label: string; category: string; tone: 'positive' | 'improvement'; count: number }>()

  for (const group of results.groupedResponses) {
    for (const answer of group.answers) {
      const parsed = parseFeedback360TagSummaryFromComment(answer.textValue)
      const tags = getSelectedFeedback360ResponseTagLabels(parsed.selectedTags)

      for (const tag of tags) {
        const key = `${tag.tone}:${tag.category}:${tag.label}`
        const current = tagCounts.get(key)
        tagCounts.set(key, {
          label: tag.label,
          category: tag.category,
          tone: tag.tone,
          count: (current?.count ?? 0) + 1,
        })
      }
    }
  }

  return Array.from(tagCounts.values()).sort((left, right) => right.count - left.count)
}

export function buildFeedback360AiCoachingPromptInput(results: ResultsData): Feedback360AiCoachingPromptInput {
  const tagCounts = buildTagCounts(results)
  const positiveTags = tagCounts
    .filter((tag) => tag.tone === 'positive')
    .slice(0, 8)
    .map(({ label, category, count }) => ({ label, category, count }))
  const improvementTags = tagCounts
    .filter((tag) => tag.tone === 'improvement')
    .slice(0, 8)
    .map(({ label, category, count }) => ({ label, category, count }))
  const commentSummary = uniqueStrings(
    [
      results.anonymousSummary,
      ...results.textHighlights,
      ...results.developmentPlan.nextCheckinTopics,
    ],
    8
  )
  const limitations = [
    results.thresholdMet ? '' : '익명 기준이 충족되지 않아 해석을 제한해야 합니다.',
    results.feedbackCount < results.anonymityThreshold
      ? `현재 응답 ${results.feedbackCount}건 / 익명 기준 ${results.anonymityThreshold}건입니다.`
      : '',
    positiveTags.length || improvementTags.length ? '' : '해시태그 선택 데이터가 충분하지 않습니다.',
  ].filter(Boolean)

  return {
    period: results.roundName,
    orgContext: `${results.targetEmployee.department} · ${results.targetEmployee.position}`,
    anonymitySatisfied: results.thresholdMet,
    responseCount: results.feedbackCount,
    anonymityThreshold: results.anonymityThreshold,
    visibilitySummary: results.thresholdMet ? '익명 기준 충족 후 요약 공개' : '익명 기준 대기',
    categorySummary: results.categoryScores.slice(0, 8).map((item) => ({
      category: item.category,
      averageSignal: item.average,
      responseCount: item.count,
    })),
    positiveTags,
    improvementTags,
    commentSummary,
    strengths: uniqueStrings(results.strengths, 6),
    improvements: uniqueStrings(results.improvements, 6),
    limitations,
  }
}

export function buildFeedback360AiCoachingPrompt(input: Feedback360AiCoachingPromptInput) {
  return {
    system: FEEDBACK_360_AI_COACHING_SYSTEM_PROMPT,
    user: [
      '다음은 360 다면평가 결과 요약입니다. 이 데이터만 사용해서 코칭 인사이트를 작성해 주세요.',
      '',
      '[평가 맥락]',
      `- 평가 기간: ${input.period}`,
      `- 대상자 역할/조직: ${input.orgContext}`,
      `- 익명 기준 충족 여부: ${input.anonymitySatisfied ? '충족' : '미충족'}`,
      `- 응답 수: ${input.responseCount}`,
      `- 익명 기준: ${input.anonymityThreshold}`,
      `- 결과 공개 범위: ${input.visibilitySummary}`,
      '',
      '[카테고리 요약]',
      JSON.stringify(input.categorySummary),
      '',
      '[강점 태그]',
      JSON.stringify(input.positiveTags),
      '',
      '[보완 태그]',
      JSON.stringify(input.improvementTags),
      '',
      '[주요 의견 요약]',
      JSON.stringify(input.commentSummary),
      '',
      '[강점/보완 리포트 문장]',
      JSON.stringify({ strengths: input.strengths, improvements: input.improvements }),
      '',
      '[데이터 한계]',
      JSON.stringify(input.limitations),
      '',
      '[주의]',
      '- 개별 리뷰어를 추정하지 마세요.',
      '- 공식 점수나 등급을 산정하지 마세요.',
      '- 보상/승진/인사 판단을 만들지 마세요.',
      '- 입력 데이터에 없는 내용을 만들지 마세요.',
      '- 응답 수가 부족하면 확정적인 표현을 피하세요.',
      '',
      '정해진 JSON schema에 맞춰 응답하세요.',
    ].join('\n'),
  }
}

export function validateFeedback360AiCoachingResult(value: unknown) {
  return Feedback360AiCoachingResultSchema.parse(value)
}
