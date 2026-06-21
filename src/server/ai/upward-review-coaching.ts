import { AIRequestStatus, AIRequestType, Prisma, type PrismaClient } from '@prisma/client'
import type { Session } from 'next-auth'
import { estimateAiCostUsd, sanitizeAiPayload } from '@/lib/ai-assist'
import { readAiAssistEnv } from '@/lib/ai-env'
import { recordOperationalEvent } from '@/lib/operations'
import { prisma } from '@/lib/prisma'
import {
  UpwardReviewAICoachingResultSchema,
  type UpwardReviewAICoachingPreview,
  type UpwardReviewAICoachingResult,
} from '@/lib/upward-review-ai-coaching'
import { AppError } from '@/lib/utils'
import { getUpwardReviewPageData, type UpwardReviewPageData } from '@/server/upward-review'

type JsonRecord = Record<string, unknown>
type UpwardResultsData = NonNullable<UpwardReviewPageData['results']>

type GenerateParams = {
  session: Session
  cycleId?: string
  roundId?: string
  empId?: string
}

const LEADERSHIP_COACHING_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'executiveSummary',
    'leadershipPattern',
    'strengths',
    'risks',
    'coachingPlan',
    'oneOnOneGuide',
    'teamOperatingSuggestions',
    'communicationScripts',
    'cautions',
    'nextReviewChecklist',
  ],
  properties: {
    executiveSummary: { type: 'string' },
    leadershipPattern: { type: 'string' },
    strengths: {
      type: 'array',
      minItems: 2,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'evidence', 'whyItMatters', 'action'],
        properties: {
          title: { type: 'string' },
          evidence: { type: 'string' },
          whyItMatters: { type: 'string' },
          action: { type: 'string' },
        },
      },
    },
    risks: {
      type: 'array',
      minItems: 2,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'signal', 'potentialImpact', 'coachingQuestion'],
        properties: {
          title: { type: 'string' },
          signal: { type: 'string' },
          potentialImpact: { type: 'string' },
          coachingQuestion: { type: 'string' },
        },
      },
    },
    coachingPlan: {
      type: 'array',
      minItems: 3,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['period', 'focus', 'actions', 'successSignals'],
        properties: {
          period: { type: 'string' },
          focus: { type: 'string' },
          actions: { type: 'array', minItems: 2, items: { type: 'string' } },
          successSignals: { type: 'array', minItems: 2, items: { type: 'string' } },
        },
      },
    },
    oneOnOneGuide: {
      type: 'object',
      additionalProperties: false,
      required: ['opening', 'questions', 'commitments'],
      properties: {
        opening: { type: 'string' },
        questions: { type: 'array', minItems: 4, items: { type: 'string' } },
        commitments: { type: 'array', minItems: 3, items: { type: 'string' } },
      },
    },
    teamOperatingSuggestions: { type: 'array', minItems: 4, items: { type: 'string' } },
    communicationScripts: {
      type: 'array',
      minItems: 3,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['situation', 'script'],
        properties: {
          situation: { type: 'string' },
          script: { type: 'string' },
        },
      },
    },
    cautions: { type: 'array', minItems: 3, items: { type: 'string' } },
    nextReviewChecklist: { type: 'array', minItems: 5, items: { type: 'string' } },
  },
} satisfies JsonRecord

function toJsonValue(value: unknown) {
  return value as Prisma.InputJsonValue
}

function extractResponseText(response: {
  output_text?: string | null
  output?: Array<{ content?: Array<{ text?: string | null }> | null } | null>
}) {
  if (typeof response.output_text === 'string' && response.output_text.trim()) {
    return response.output_text.trim()
  }

  const chunks: string[] = []
  for (const item of response.output ?? []) {
    for (const part of item?.content ?? []) {
      if (typeof part?.text === 'string' && part.text.trim()) {
        chunks.push(part.text.trim())
      }
    }
  }

  return chunks.join('\n').trim()
}

function getAverageScore(results: UpwardResultsData) {
  const scores = results.questionSummaries
    .map((question) => question.averageScore)
    .filter((score): score is number => typeof score === 'number')

  if (!scores.length) return null
  return Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 100) / 100
}

function getSortedScoredQuestions(results: UpwardResultsData, direction: 'asc' | 'desc') {
  return results.questionSummaries
    .filter((question) => typeof question.averageScore === 'number')
    .sort((a, b) =>
      direction === 'asc'
        ? (a.averageScore ?? 0) - (b.averageScore ?? 0)
        : (b.averageScore ?? 0) - (a.averageScore ?? 0)
    )
}

function getCommentHighlights(results: UpwardResultsData) {
  return results.rawResponses
    .flatMap((response) => [
      response.overallComment,
      ...response.answers.map((answer) => answer.textValue),
    ])
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 8)
}

function buildFallbackLeadershipCoachingResult(results: UpwardResultsData): UpwardReviewAICoachingResult {
  const averageScore = getAverageScore(results)
  const highQuestions = getSortedScoredQuestions(results, 'desc').slice(0, 3)
  const lowQuestions = getSortedScoredQuestions(results, 'asc').slice(0, 3)
  const strengths = results.strengths.length
    ? results.strengths.slice(0, 3)
    : highQuestions.map((question) => `${question.category}에서 상대적으로 높은 평가가 확인됩니다.`)
  const improvements = results.improvements.length
    ? results.improvements.slice(0, 3)
    : lowQuestions.map((question) => `${question.category}의 실행 방식을 더 구체적으로 점검할 필요가 있습니다.`)
  const primaryStrength = strengths[0] ?? '현재 리더십 강점은 추가 응답이 쌓이면 더 선명해집니다.'
  const primaryImprovement = improvements[0] ?? '보완 포인트는 다음 1:1에서 구체 사례 중심으로 확인해 주세요.'
  const lowCategory = lowQuestions[0]?.category ?? '우선 개선 영역'
  const highCategory = highQuestions[0]?.category ?? '강점 영역'

  return {
    executiveSummary: `${results.targetEmployee.name} ${results.targetEmployee.position}의 리더십 진단은 평균 ${
      averageScore?.toFixed(2) ?? '데이터 부족'
    } 수준으로 집계되었습니다. ${primaryStrength} 다만 ${primaryImprovement} 결과는 등급이나 공식 평가가 아니라 리더십 개선을 위한 코칭 자료로 활용해야 합니다.`,
    leadershipPattern: `${highCategory}은 유지할 강점으로 보이고, ${lowCategory}은 구성원 경험을 더 안정적으로 만들기 위해 행동 기준과 반복 루틴을 정리할 필요가 있습니다.`,
    strengths: (strengths.length ? strengths : [primaryStrength]).slice(0, 3).map((item, index) => ({
      title: index === 0 ? '반복 관찰된 강점' : `강점 포인트 ${index + 1}`,
      evidence: item,
      whyItMatters: '구성원이 리더의 일관된 행동을 경험할수록 협업 예측 가능성과 심리적 안정감이 높아집니다.',
      action: '다음 2주 동안 이 강점이 드러난 실제 장면을 2개 이상 기록하고, 팀 회의에서 같은 방식을 의도적으로 반복해 주세요.',
    })),
    risks: (improvements.length ? improvements : [primaryImprovement]).slice(0, 3).map((item, index) => ({
      title: index === 0 ? '우선 보완 영역' : `보완 리스크 ${index + 1}`,
      signal: item,
      potentialImpact: '이 신호가 반복되면 구성원은 의사결정 기준을 예측하기 어렵고, 업무 우선순위와 실행 속도가 흔들릴 수 있습니다.',
      coachingQuestion: '최근 한 달 동안 구성원이 같은 기준으로 이해하지 못했을 가능성이 있는 장면은 무엇이었나요?',
    })),
    coachingPlan: [
      {
        period: '30일',
        focus: '진단 결과 공유와 핵심 행동 1개 선택',
        actions: [
          '가장 낮은 점수 영역 1개를 선택해 구성원에게 “앞으로 바꿀 행동”을 한 문장으로 공유합니다.',
          '팀 회의 또는 1:1에서 구성원이 기대하는 리더 행동을 질문하고, 반복되는 요청을 3개 이하로 정리합니다.',
        ],
        successSignals: [
          '구성원이 개선 과제를 같은 표현으로 설명할 수 있습니다.',
          '리더가 매주 한 번 이상 선택한 행동을 의식적으로 실행합니다.',
        ],
      },
      {
        period: '60일',
        focus: '운영 루틴으로 고정',
        actions: [
          '우선순위 공유, 의사결정 기준 설명, 피드백 응답 중 하나를 정례 회의 아젠다에 넣습니다.',
          '구성원에게 “이번 주에 도움이 된 리더 행동”과 “불편했던 장면”을 짧게 수집합니다.',
        ],
        successSignals: [
          '회의 후 실행 담당자와 판단 기준이 바로 정리됩니다.',
          '구성원이 피드백을 요청하거나 이견을 말하는 빈도가 증가합니다.',
        ],
      },
      {
        period: '90일',
        focus: '재진단과 지속 개선',
        actions: [
          '초기 진단의 낮은 영역과 같은 질문을 기준으로 짧은 펄스 체크를 진행합니다.',
          '개선된 행동은 유지 루틴으로 남기고, 새로 드러난 병목은 다음 분기 코칭 과제로 전환합니다.',
        ],
        successSignals: [
          '구성원이 리더의 변화 행동을 구체 사례로 말할 수 있습니다.',
          '업무 공유, 의사결정, 피드백 흐름에서 같은 문제가 반복되는 빈도가 줄어듭니다.',
        ],
      },
    ],
    oneOnOneGuide: {
      opening: '이번 진단은 점수를 확인하는 목적보다 함께 일하는 방식을 더 좋게 만들기 위한 자료로 보려고 합니다. 편하게 구체적인 장면 중심으로 이야기해 주세요.',
      questions: [
        '최근 제가 리더로서 가장 도움이 됐던 장면은 무엇이었나요?',
        '반대로 기준이나 설명이 부족해서 다시 확인해야 했던 장면은 무엇이었나요?',
        '제가 계속 유지했으면 하는 행동 한 가지는 무엇인가요?',
        '다음 달부터 바로 바꾸면 팀에 도움이 될 행동 한 가지는 무엇인가요?',
      ],
      commitments: [
        '피드백을 방어하지 않고 먼저 듣고 요약합니다.',
        '바꿀 행동은 한 번에 하나만 정하고 실행 날짜를 잡습니다.',
        '2~4주 뒤 같은 주제로 다시 확인합니다.',
      ],
    },
    teamOperatingSuggestions: [
      '회의 시작 시 오늘 결정할 것과 공유만 할 것을 구분합니다.',
      '업무 요청에는 기대 결과, 마감, 판단 기준을 함께 적습니다.',
      '구성원이 이견을 말할 수 있도록 “다르게 보는 관점이 있나요?”를 회의 루틴에 넣습니다.',
      '피드백은 성향이 아니라 관찰 가능한 행동과 결과 중심으로 전달합니다.',
    ],
    communicationScripts: [
      {
        situation: '우선순위가 바뀔 때',
        script: '이번 주 우선순위가 바뀐 이유는 A 때문입니다. 기존 B 업무는 언제까지 어느 수준이면 충분한지 다시 정리하겠습니다.',
      },
      {
        situation: '피드백을 줄 때',
        script: '이번 결과에서 좋았던 점은 A입니다. 다음에는 B 행동을 더하면 C 효과가 날 것 같습니다. 제가 지원할 부분도 같이 정하겠습니다.',
      },
      {
        situation: '구성원 의견을 끌어낼 때',
        script: '제가 놓친 관점이 있을 수 있습니다. 실행 전에 리스크나 다른 제안을 하나씩만 이야기해 주세요.',
      },
    ],
    cautions: [
      '낮은 점수를 개인 비난으로 받아들이지 말고 반복 행동의 신호로 해석해 주세요.',
      '익명 의견의 작성자를 추정하거나 확인하려고 하지 마세요.',
      '한 번에 여러 행동을 바꾸려 하면 실행이 흐려질 수 있으니 핵심 행동 하나부터 시작하세요.',
    ],
    nextReviewChecklist: [
      '가장 낮은 영역 1개를 선택했는가',
      '구성원에게 바꿀 행동을 한 문장으로 공유했는가',
      '2주 안에 확인할 성공 신호를 정했는가',
      '1:1에서 들은 피드백을 방어 없이 요약했는가',
      '다음 점검 일정을 잡았는가',
    ],
  }
}

function buildCoachingPayload(results: UpwardResultsData) {
  const averageScore = getAverageScore(results)
  const scoredQuestions = results.questionSummaries
    .filter((question) => typeof question.averageScore === 'number')
    .map((question) => ({
      category: question.category,
      questionText: question.questionText,
      averageScore: question.averageScore,
      responseCount: question.responseCount,
      textHighlights: question.textResponses.slice(0, 3),
    }))

  return sanitizeAiPayload({
    reportType: 'leadership-diagnosis',
    coachingDepth: 'very-detailed',
    target: {
      id: results.targetEmployee.id,
      name: results.targetEmployee.name,
      department: results.targetEmployee.department,
      position: results.targetEmployee.position,
    },
    round: {
      id: results.roundId,
      name: results.roundName,
      feedbackCount: results.feedbackCount,
      minRaters: results.minRaters,
      thresholdMet: results.thresholdMet,
      released: results.released,
      visible: results.visible,
      canViewRaw: results.canViewRaw,
    },
    summary: {
      averageScore,
      strengths: results.strengths,
      improvements: results.improvements,
      strongestQuestions: getSortedScoredQuestions(results, 'desc').slice(0, 5),
      weakestQuestions: getSortedScoredQuestions(results, 'asc').slice(0, 5),
    },
    questionSummaries: scoredQuestions.slice(0, 24),
    commentHighlights: getCommentHighlights(results),
    guardrails: [
      'Do not infer identities of anonymous raters.',
      'Do not produce official score, grade, promotion, compensation, or disciplinary decisions.',
      'Use only the provided leadership diagnosis result data.',
      'Write in Korean with specific coaching actions.',
    ],
  })
}

function buildSystemPrompt() {
  return [
    '당신은 HR 리더십 코치이자 조직 개발 전문가입니다.',
    '사용자가 제공한 리더십 진단 집계 결과만 사용해 한국어로 매우 자세한 코칭 리포트를 작성하세요.',
    '익명 평가자의 신원을 추정하지 말고, 공식 점수/등급/승진/보상/징계 판단을 만들지 마세요.',
    '코칭은 행동 중심, 관찰 가능, 30/60/90일 실행 가능 형태여야 합니다.',
    '강점은 유지 행동까지, 보완 영역은 리스크와 질문까지 구체화하세요.',
    '1:1 대화 문장, 팀 운영 루틴, 다음 점검 체크리스트를 반드시 실무자가 바로 쓸 수 있게 작성하세요.',
  ].join(' ')
}

async function callLeadershipCoachingModel(payload: JsonRecord) {
  const env = readAiAssistEnv()
  if (!env.apiKey) {
    throw new AppError(503, 'AI_API_KEY_MISSING', 'OPENAI_API_KEY is not configured.')
  }

  const response = await fetch(`${env.baseUrl}/responses`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: env.model,
      input: [
        {
          role: 'system',
          content: [{ type: 'input_text', text: buildSystemPrompt() }],
        },
        {
          role: 'user',
          content: [{ type: 'input_text', text: JSON.stringify(payload, null, 2) }],
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'leadership_diagnosis_ai_coaching',
          schema: LEADERSHIP_COACHING_SCHEMA,
          strict: true,
        },
      },
    }),
  })

  const json = (await response.json()) as JsonRecord
  if (!response.ok) {
    const errorMessage =
      typeof (json.error as JsonRecord | undefined)?.message === 'string'
        ? String((json.error as JsonRecord).message)
        : 'OpenAI Responses API request failed.'
    throw new AppError(response.status, 'AI_REQUEST_FAILED', errorMessage)
  }

  const responseText = extractResponseText(json as never)
  if (!responseText) {
    throw new AppError(502, 'AI_EMPTY_RESPONSE', 'OpenAI response did not include structured output.')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(responseText)
  } catch {
    throw new AppError(502, 'AI_INVALID_JSON', 'OpenAI response JSON could not be parsed.')
  }

  const validated = UpwardReviewAICoachingResultSchema.safeParse(parsed)
  if (!validated.success) {
    throw new AppError(502, 'AI_INVALID_SHAPE', 'OpenAI response did not match the expected schema.')
  }

  const usage = (json.usage ?? {}) as JsonRecord
  const inputTokens = Number(usage.input_tokens ?? 0)
  const outputTokens = Number(usage.output_tokens ?? 0)

  return {
    result: validated.data,
    model: typeof json.model === 'string' ? json.model : env.model,
    inputTokens,
    outputTokens,
    estimatedCostUsd: estimateAiCostUsd({ inputTokens, outputTokens }),
  }
}

export async function generateUpwardReviewAiCoaching(
  params: GenerateParams,
  db: PrismaClient = prisma
): Promise<UpwardReviewAICoachingPreview> {
  const actorId = params.session.user.id
  const pageData = await getUpwardReviewPageData({
    session: params.session,
    mode: 'results',
    cycleId: params.cycleId,
    roundId: params.roundId,
    empId: params.empId,
  })

  if (pageData.state !== 'ready' || !pageData.results) {
    throw new AppError(404, 'UPWARD_RESULTS_NOT_READY', pageData.message ?? '리더십 진단 결과를 찾지 못했습니다.')
  }

  const results = pageData.results
  if (!results.visible && !results.canViewRaw) {
    throw new AppError(403, 'UPWARD_RESULTS_HIDDEN', results.hiddenReason ?? '공개된 리더십 진단 결과만 AI 코칭을 생성할 수 있습니다.')
  }

  if (!results.questionSummaries.length) {
    throw new AppError(400, 'UPWARD_RESULTS_EMPTY', 'AI 코칭을 생성할 문항별 결과가 아직 없습니다.')
  }

  const payload = buildCoachingPayload(results)
  const fallbackResult = buildFallbackLeadershipCoachingResult(results)
  const env = readAiAssistEnv()
  const baseLogData = {
    requesterId: actorId,
    requestType: AIRequestType.GROWTH_PLAN,
    sourceType: 'LeadershipDiagnosisCoaching',
    sourceId: `${results.roundId}:${results.selectedTargetId}`,
    requestPayload: toJsonValue(payload),
    piiMinimized: true,
  } as const
  const disabledReason = !env.enabled
    ? 'AI 코칭 기능이 현재 비활성화되어 있어 근거 기반 코칭 초안으로 표시했습니다.'
    : !env.apiKey
      ? 'OPENAI_API_KEY가 설정되지 않아 근거 기반 코칭 초안으로 표시했습니다.'
      : null

  if (disabledReason) {
    await recordOperationalEvent(
      {
        level: 'WARN',
        component: 'upward-review-ai-coaching',
        eventType: 'AI_DISABLED',
        message: disabledReason,
        metadata: {
          roundId: results.roundId,
          targetId: results.selectedTargetId,
          enabledSource: env.enabledSource,
        },
      },
      db
    )

    const log = await db.aiRequestLog.create({
      data: {
        ...baseLogData,
        requestStatus: AIRequestStatus.DISABLED,
        responsePayload: toJsonValue(fallbackResult),
        errorCode: !env.enabled ? 'AI_DISABLED' : 'AI_API_KEY_MISSING',
        errorMessage: disabledReason,
      },
    })

    return {
      requestLogId: log.id,
      source: 'disabled',
      fallbackReason: disabledReason,
      result: fallbackResult,
    }
  }

  try {
    const aiResult = await callLeadershipCoachingModel(payload)
    const log = await db.aiRequestLog.create({
      data: {
        ...baseLogData,
        requestStatus: AIRequestStatus.SUCCESS,
        provider: 'OPENAI',
        model: aiResult.model,
        responsePayload: toJsonValue(aiResult.result),
        inputTokens: aiResult.inputTokens,
        outputTokens: aiResult.outputTokens,
        estimatedCostUsd: aiResult.estimatedCostUsd,
      },
    })

    return {
      requestLogId: log.id,
      source: 'ai',
      fallbackReason: null,
      result: aiResult.result,
    }
  } catch (error) {
    const errorCode = error instanceof AppError ? error.code : 'AI_REQUEST_FAILED'
    const errorMessage = error instanceof Error ? error.message : 'Unknown AI request error.'

    await recordOperationalEvent(
      {
        level: 'WARN',
        component: 'upward-review-ai-coaching',
        eventType: 'AI_FALLBACK_TRIGGERED',
        message: errorMessage,
        metadata: {
          roundId: results.roundId,
          targetId: results.selectedTargetId,
          errorCode,
        },
      },
      db
    )

    const log = await db.aiRequestLog.create({
      data: {
        ...baseLogData,
        requestStatus: AIRequestStatus.FALLBACK,
        provider: 'OPENAI',
        model: env.model,
        responsePayload: toJsonValue(fallbackResult),
        errorCode,
        errorMessage,
      },
    })

    return {
      requestLogId: log.id,
      source: 'fallback',
      fallbackReason: 'AI 응답을 생성하지 못해 근거 기반 코칭 초안으로 표시했습니다.',
      result: fallbackResult,
    }
  }
}
