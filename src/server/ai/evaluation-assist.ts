import {
  AIRequestStatus,
  AIRequestType,
  Prisma,
  type PrismaClient,
  type SystemRole,
} from '@prisma/client'
import { estimateAiCostUsd, sanitizeAiPayload } from '@/lib/ai-assist'
import { readAiAssistEnv } from '@/lib/ai-env'
import {
  EvaluationAssistResultSchema,
  type EvaluationAssistMode,
  type EvaluationAssistResult,
} from '@/lib/evaluation-ai-assist'
import { recordOperationalEvent } from '@/lib/operations'
import { prisma } from '@/lib/prisma'
import { AppError, EVAL_STAGE_LABELS, POSITION_LABELS } from '@/lib/utils'

type DraftItemInput = {
  personalKpiId: string
  title: string
  weight: number
  quantScore?: number | null
  planScore?: number | null
  doScore?: number | null
  checkScore?: number | null
  actScore?: number | null
  itemComment?: string
}

type GenerateEvaluationAssistParams = {
  actorId: string
  actorRole: SystemRole
  mode: EvaluationAssistMode
  evaluationId: string
  draftComment: string
  growthMemo: string
  draftGradeId?: string | null
  items: DraftItemInput[]
}

type EvaluationAssistContext = {
  evaluationId: string
  requestType: AIRequestType
  fallbackResult: EvaluationAssistResult
  payload: Record<string, unknown>
}

type JsonRecord = Record<string, unknown>

function toJsonValue(value: Record<string, unknown> | EvaluationAssistResult) {
  return value as Prisma.InputJsonValue
}

const EVALUATION_ASSIST_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['focusArea', 'recommendedActions', 'supportNeeded', 'milestone'],
  properties: {
    focusArea: { type: 'string' },
    recommendedActions: {
      type: 'array',
      items: { type: 'string' },
    },
    supportNeeded: {
      type: 'array',
      items: { type: 'string' },
    },
    milestone: { type: 'string' },
  },
} as const

function resolveRequestType(mode: EvaluationAssistMode) {
  switch (mode) {
    case 'draft':
      return AIRequestType.EVAL_COMMENT_DRAFT
    case 'bias':
      return AIRequestType.BIAS_ANALYSIS
    case 'growth':
      return AIRequestType.GROWTH_PLAN
  }
}

function buildEvaluationAssistFallbackResult(
  mode: EvaluationAssistMode,
  params: {
    draftComment: string
    gradeName: string
    highlights: string[]
  }
): EvaluationAssistResult {
  const highlights = params.highlights.length
    ? params.highlights
    : ['현재 입력된 근거를 기준으로 핵심 포인트를 먼저 정리해보세요.']

  if (mode === 'draft') {
    return {
      focusArea: params.gradeName
        ? `${params.gradeName} 기준으로 근거 중심의 종합 의견을 정리합니다.`
        : '현재 근거를 바탕으로 균형 잡힌 종합 의견을 정리합니다.',
      recommendedActions: [
        params.draftComment || highlights[0],
        '주요 성과와 협업 기여를 분리해서 적고, 확인된 사실만 담아 문장을 구성하세요.',
        '보완이 필요한 지점은 단정 대신 근거와 기대 행동을 함께 적어주세요.',
      ],
      supportNeeded: [
        '최근 월간 실적과 체크인 메모에서 반복된 강점/리스크를 한 번 더 확인해주세요.',
        '점수와 코멘트가 서로 어긋나는 항목이 없는지 검토해주세요.',
      ],
      milestone: '종합 의견 초안 확인 후 제출 전 1회 검토',
    }
  }

  if (mode === 'bias') {
    return {
      focusArea: '주관적 표현을 줄이고 근거 중심 문장으로 다시 정리합니다.',
      recommendedActions: [
        params.draftComment || '현재 초안에서 감정적이거나 단정적인 표현을 먼저 확인해주세요.',
        '개인 성향 판단 대신 관찰 가능한 행동과 KPI 결과를 중심으로 문장을 수정하세요.',
        '최근 사례 하나에 치우치지 않도록 기간 전체 근거를 다시 묶어 표현하세요.',
      ],
      supportNeeded: [
        '정량 결과와 구체 사례가 부족한 문장은 추가 근거를 보완해주세요.',
        '협업/태도 표현은 실제 관찰 사례가 있는지 다시 확인해주세요.',
      ],
      milestone: '편향 위험 문장 정리 후 수정안 재검토',
    }
  }

  return {
    focusArea: '다음 평가 주기까지 바로 실행할 수 있는 성장 포인트를 정리합니다.',
    recommendedActions: [
      '다음 체크인 전까지 가장 중요한 개선 과제 1개를 정하고 실행 계획을 명확히 적어주세요.',
      '정기 리뷰에서 진척도를 확인할 수 있도록 측정 가능한 행동 기준을 함께 두세요.',
      '현재 강점을 유지하면서도 보완이 필요한 역량을 한 가지로 좁혀 집중하세요.',
    ],
    supportNeeded: [
      '리더 피드백과 필요한 지원 리소스를 구체적으로 적어주세요.',
      '월간 실적 또는 360 피드백과 연결되는 근거를 함께 남겨주세요.',
    ],
    milestone: '다음 1:1 전까지 성장 계획 초안 합의',
  }
}

function buildSystemPrompt(mode: EvaluationAssistMode) {
  if (mode === 'draft') {
    return [
      '당신은 한국어 성과평가 작성 보조자입니다.',
      '제공된 근거만 사용해 전문적이고 균형 잡힌 평가 코멘트 초안용 구조화 제안을 만드세요.',
      '사실을 꾸며내지 말고, 과장하거나 단정하지 마세요.',
      'focusArea는 코멘트의 핵심 초점을 한 문장으로 적습니다.',
      'recommendedActions는 실제 초안 문장으로 바로 사용할 수 있는 한국어 문장 3개 이상을 적습니다.',
      'supportNeeded는 제출 전 더 확인하면 좋은 근거 또는 검토 포인트를 적습니다.',
      'milestone은 다음 검토 단계 한 줄로 적습니다.',
    ].join(' ')
  }

  if (mode === 'bias') {
    return [
      '당신은 한국어 평가 문장 편향 점검 보조자입니다.',
      '주관적, 감정적, 모호한 표현을 줄이고 근거 기반의 중립적 문장으로 정리하세요.',
      '사실을 새로 만들지 말고 제공된 맥락 안에서만 답하세요.',
      'focusArea는 수정이 필요한 핵심 편향/모호성 포인트를 한 문장으로 적습니다.',
      'recommendedActions는 현재 초안을 대체하거나 수정하는 한국어 문장 3개 이상을 적습니다.',
      'supportNeeded는 공정성을 높이기 위해 추가 확인이 필요한 근거나 질문을 적습니다.',
      'milestone은 다음 수정 단계 한 줄로 적습니다.',
    ].join(' ')
  }

  return [
    '당신은 한국어 성장계획 코칭 보조자입니다.',
    '성과관리 문맥에 맞는 현실적이고 실행 가능한 성장 제안을 작성하세요.',
    '막연한 조언이나 꾸며낸 사실은 금지합니다.',
    'focusArea는 가장 중요한 성장 초점을 한 문장으로 적습니다.',
    'recommendedActions는 바로 실행 가능한 액션 3개 이상을 적습니다.',
    'supportNeeded는 리더/조직 차원의 지원 항목을 적습니다.',
    'milestone은 다음 점검 시점까지 확인할 마일스톤 한 줄로 적습니다.',
  ].join(' ')
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

async function callEvaluationAssistModel(
  mode: EvaluationAssistMode,
  payload: Record<string, unknown>
) {
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
          content: [{ type: 'input_text', text: buildSystemPrompt(mode) }],
        },
        {
          role: 'user',
          content: [{ type: 'input_text', text: JSON.stringify(payload, null, 2) }],
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: `evaluation_assist_${mode}`,
          schema: EVALUATION_ASSIST_JSON_SCHEMA,
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

  const validated = EvaluationAssistResultSchema.safeParse(parsed)
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

async function loadEvaluationAssistContext(
  params: GenerateEvaluationAssistParams,
  db: PrismaClient
): Promise<EvaluationAssistContext> {
  const evaluation = await db.evaluation.findUnique({
    where: { id: params.evaluationId },
    include: {
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
            select: { deptName: true, orgId: true },
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
                take: 2,
              },
            },
          },
        },
      },
    },
  })

  if (!evaluation) {
    throw new AppError(404, 'EVALUATION_NOT_FOUND', '평가 정보를 찾을 수 없습니다.')
  }

  const canUseAssist =
    params.actorRole === 'ROLE_ADMIN' || evaluation.evaluatorId === params.actorId

  if (!canUseAssist) {
    throw new AppError(403, 'FORBIDDEN', '평가 AI 보조를 사용할 권한이 없습니다.')
  }

  const [gradeSettings, recentCheckins, feedbackRounds] = await Promise.all([
    db.gradeSetting.findMany({
      where: {
        orgId: evaluation.target.department.orgId,
        evalYear: evaluation.evalCycle.evalYear,
        isActive: true,
      },
      select: {
        id: true,
        gradeName: true,
      },
    }),
    db.checkIn.findMany({
      where: {
        ownerId: evaluation.targetId,
      },
      orderBy: [{ scheduledDate: 'desc' }],
      take: 3,
      select: {
        scheduledDate: true,
        keyTakeaways: true,
        managerNotes: true,
        ownerNotes: true,
      },
    }),
    db.multiFeedbackRound.findMany({
      where: {
        evalCycleId: evaluation.evalCycleId,
      },
      include: {
        feedbacks: {
          where: {
            receiverId: evaluation.targetId,
            status: 'SUBMITTED',
          },
          include: {
            responses: {
              select: {
                ratingValue: true,
                textValue: true,
              },
            },
          },
        },
      },
      orderBy: { endDate: 'desc' },
      take: 3,
    }),
  ])

  const draftItemMap = new Map(params.items.map((item) => [item.personalKpiId, item]))
  const selectedGradeName =
    gradeSettings.find((grade) => grade.id === (params.draftGradeId || evaluation.gradeId))?.gradeName ?? ''

  const itemSummaries = evaluation.items.map((item) => {
    const draftItem = draftItemMap.get(item.personalKpiId)

    return {
      title: item.personalKpi.kpiName,
      type: item.personalKpi.kpiType,
      weight: item.personalKpi.weight,
      definition: item.personalKpi.definition,
      targetValue: item.personalKpi.targetValue,
      unit: item.personalKpi.unit,
      linkedOrgKpi: item.personalKpi.linkedOrgKpi
        ? `${item.personalKpi.linkedOrgKpi.department.deptName} / ${item.personalKpi.linkedOrgKpi.kpiName}`
        : null,
      draftScore:
        draftItem?.quantScore ??
        item.quantScore ??
        draftItem?.planScore ??
        item.planScore ??
        draftItem?.doScore ??
        item.doScore ??
        null,
      draftComment: draftItem?.itemComment ?? item.itemComment ?? '',
      recentMonthlyEvidence: item.personalKpi.monthlyRecords.map((record) => ({
        yearMonth: record.yearMonth,
        achievementRate: record.achievementRate,
        activities: record.activities,
        obstacles: record.obstacles,
        efforts: record.efforts,
      })),
    }
  })

  const highlights = [
    ...itemSummaries
      .slice(0, 3)
      .map((item) => `${item.title}: ${item.draftComment || '평가 코멘트 초안 없음'}`),
    ...recentCheckins
      .slice(0, 2)
      .map((checkin) => checkin.keyTakeaways || checkin.managerNotes || checkin.ownerNotes || '최근 체크인 요약 없음'),
  ].filter((item) => item && item.trim().length > 0)

  const requestType = resolveRequestType(params.mode)
  const fallbackResult = buildEvaluationAssistFallbackResult(params.mode, {
    draftComment: params.draftComment || evaluation.comment || '',
    gradeName: selectedGradeName,
    highlights,
  })

  return {
    evaluationId: evaluation.id,
    requestType,
    fallbackResult,
    payload: sanitizeAiPayload({
      mode: params.mode,
      cycle: {
        name: evaluation.evalCycle.cycleName,
        year: evaluation.evalCycle.evalYear,
        stage: EVAL_STAGE_LABELS[evaluation.evalStage],
      },
      targetContext: {
        department: evaluation.target.department.deptName,
        position: POSITION_LABELS[evaluation.target.position] ?? evaluation.target.position,
      },
      evaluatorContext: {
        department: evaluation.evaluator.department.deptName,
        position: POSITION_LABELS[evaluation.evaluator.position] ?? evaluation.evaluator.position,
      },
      selectedGradeName,
      currentDraftComment: params.draftComment || evaluation.comment || '',
      currentGrowthMemo: params.growthMemo,
      itemSummaries,
      evidence: {
        recentCheckins: recentCheckins.map((checkin) => ({
          scheduledDate: checkin.scheduledDate.toISOString(),
          summary: checkin.keyTakeaways || checkin.managerNotes || checkin.ownerNotes || '',
        })),
        feedbackSummaries: feedbackRounds.map((round) => ({
          roundName: round.roundName,
          roundType: round.roundType,
          submittedCount: round.feedbacks.length,
          highlights: round.feedbacks
            .flatMap((feedback) => feedback.responses.map((response) => response.textValue || '').filter(Boolean))
            .slice(0, 5),
        })),
        highlights,
      },
    }),
  }
}

export async function generateEvaluationAssist(
  params: GenerateEvaluationAssistParams,
  db: PrismaClient = prisma
) {
  const env = readAiAssistEnv()
  const context = await loadEvaluationAssistContext(params, db)
  const disabledReason = !env.enabled
    ? 'AI 보조 기능이 현재 비활성화되어 있습니다.'
    : !env.apiKey
      ? 'OPENAI_API_KEY가 설정되지 않아 AI 보조 기능이 현재 비활성화되어 있습니다.'
      : null

  const baseLogData = {
    requesterId: params.actorId,
    requestType: context.requestType,
    sourceType: 'Evaluation',
    sourceId: context.evaluationId,
    requestPayload: toJsonValue(context.payload),
    piiMinimized: true,
  } as const

  if (disabledReason) {
    await recordOperationalEvent(
      {
        level: 'WARN',
        component: 'evaluation-ai-assist',
        eventType: 'AI_DISABLED',
        message: disabledReason,
        metadata: {
          evaluationId: context.evaluationId,
          mode: params.mode,
          enabledSource: env.enabledSource,
        },
      },
      db
    )

    const log = await db.aiRequestLog.create({
      data: {
        ...baseLogData,
        requestStatus: AIRequestStatus.DISABLED,
        responsePayload: toJsonValue(context.fallbackResult),
        errorCode: !env.enabled ? 'AI_DISABLED' : 'AI_API_KEY_MISSING',
        errorMessage: disabledReason,
      },
    })

    return {
      requestLogId: log.id,
      source: 'disabled' as const,
      fallbackReason: disabledReason,
      result: context.fallbackResult,
    }
  }

  try {
    const aiResult = await callEvaluationAssistModel(params.mode, context.payload)
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
      source: 'ai' as const,
      fallbackReason: null,
      result: aiResult.result,
    }
  } catch (error) {
    const errorCode = error instanceof AppError ? error.code : 'AI_REQUEST_FAILED'
    const errorMessage = error instanceof Error ? error.message : 'Unknown AI request error.'

    await recordOperationalEvent(
      {
        level: 'WARN',
        component: 'evaluation-ai-assist',
        eventType: 'AI_REQUEST_FAILED',
        message: errorMessage,
        metadata: {
          evaluationId: context.evaluationId,
          mode: params.mode,
          errorCode,
        },
      },
      db
    )

    await db.aiRequestLog.create({
      data: {
        ...baseLogData,
        requestStatus: AIRequestStatus.FALLBACK,
        provider: 'OPENAI',
        model: env.model,
        responsePayload: toJsonValue(context.fallbackResult),
        errorCode,
        errorMessage,
      },
    })

    throw new AppError(502, 'AI_ASSIST_FAILED', 'AI 제안을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.')
  }
}
