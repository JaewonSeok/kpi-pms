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
  buildEvaluationAssistEvidenceView,
  EvaluationAssistResultSchema,
  getEvaluationAssistPublicErrorMessage,
  type EvaluationAssistEvidenceView,
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
  evidenceView: EvaluationAssistEvidenceView
  payload: Record<string, unknown>
}

type JsonRecord = Record<string, unknown>

type ItemSummary = {
  title: string
  type: string
  weight: number
  definition: string | null
  targetValue: number | null
  unit: string | null
  linkedOrgKpi: string | null
  draftScore: number | null
  draftComment: string
  recentMonthlyEvidence: Array<{
    yearMonth: string
    achievementRate: number | null
    activities: string | null
    obstacles: string | null
    efforts: string | null
  }>
}

type LoadedEvaluationItem = {
  personalKpiId: string
  quantScore: number | null
  planScore: number | null
  doScore: number | null
  checkScore: number | null
  actScore: number | null
  itemComment: string | null
  personalKpi: {
    kpiName: string
    kpiType: string
    weight: number
    definition: string | null
    targetValue: number | null
    unit: string | null
    linkedOrgKpi: {
      department: {
        deptName: string
      }
      kpiName: string
    } | null
    monthlyRecords: Array<{
      yearMonth: string
      achievementRate: number | null
      activities: string | null
      obstacles: string | null
      efforts: string | null
    }>
  }
}

const EVALUATION_ASSIST_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['draftText', 'strengths', 'concerns', 'coachingPoints', 'nextStep'],
  properties: {
    draftText: { type: 'string' },
    strengths: {
      type: 'array',
      items: { type: 'string' },
    },
    concerns: {
      type: 'array',
      items: { type: 'string' },
    },
    coachingPoints: {
      type: 'array',
      items: { type: 'string' },
    },
    nextStep: { type: 'string' },
  },
} as const

function toJsonValue(value: Record<string, unknown> | EvaluationAssistResult) {
  return value as Prisma.InputJsonValue
}

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
    : ['현재 입력된 근거를 먼저 정리한 뒤 평가 초안을 검토해 주세요.']

  if (mode === 'draft') {
    return {
      draftText:
        params.draftComment ||
        `${params.gradeName ? `${params.gradeName} 기준으로 ` : ''}현재 근거를 바탕으로 강점과 보완 포인트를 균형 있게 정리한 평가 코멘트 초안입니다.`,
      strengths: highlights.slice(0, 2),
      concerns: [
        '근거가 부족한 항목은 단정적인 표현 대신 확인이 필요한 포인트로 남겨 주세요.',
        '최근 실적과 체크인에서 보이지 않는 내용은 최종 제출 전에 다시 확인해 주세요.',
      ],
      coachingPoints: [
        '핵심 성과와 보완 포인트를 각각 한 문단씩 나눠서 정리해 주세요.',
        '정량 KPI와 정성 KPI 근거가 서로 모순되지 않는지 마지막으로 점검해 주세요.',
      ],
      nextStep: '근거를 보강한 뒤 평가 코멘트를 다듬고 제출 전 최종 검토를 진행하세요.',
    }
  }

  if (mode === 'bias') {
    return {
      draftText:
        '다음 1:1에서는 최근 성과 근거를 먼저 확인한 뒤, 강점은 유지하고 보완 과제는 구체적 행동으로 연결하는 방향으로 대화를 시작해 보세요.',
      strengths: highlights.slice(0, 2),
      concerns: [
        '근거가 적은 항목은 평가 확정이 아니라 질문 형태로 다루는 것이 안전합니다.',
        '최근 사례 한두 개에만 의존하면 과도한 일반화로 이어질 수 있습니다.',
      ],
      coachingPoints: [
        '최근 월간 실적과 체크인 메모를 기준으로 사실 확인 질문부터 시작해 주세요.',
        '행동 변화에 필요한 지원과 기대 수준을 함께 합의하는 문장으로 마무리해 주세요.',
      ],
      nextStep: '코칭 대화 초안을 메모에 반영하고, 실제 1:1 전에 근거 항목을 다시 확인해 주세요.',
    }
  }

  return {
    draftText: '다음 주기에 우선 추진할 성장 과제와 지원 요청을 한 번에 볼 수 있도록 개선 과제 초안을 정리했습니다.',
    strengths: highlights.slice(0, 2),
    concerns: [
      '현재 자료만으로는 장기 성과 추세를 단정하기 어렵습니다.',
      '지속 개선이 필요한 항목은 월간 체크인에서 다시 확인해 주세요.',
    ],
    coachingPoints: [
      '다음 체크인 전까지 실행할 개선 과제를 1~2개로 압축해 주세요.',
      '필요한 지원과 점검 시점을 함께 적어 실행 가능성을 높여 주세요.',
    ],
    nextStep: '성장 과제를 메모에 반영하고 다음 체크인 아젠다와 연결해 주세요.',
  }
}

function buildSystemPrompt(mode: EvaluationAssistMode) {
  if (mode === 'draft') {
    return [
      '당신은 성과 평가 코멘트 초안을 돕는 HR 평가 보조자입니다.',
      '반드시 제공된 근거만 사용하고, 없는 사실을 만들거나 단정하지 마세요.',
      'draftText에는 제출 전 사람이 다듬을 수 있는 평가 코멘트 초안을 작성하세요.',
      'strengths에는 실제로 확인된 강점 포인트를, concerns에는 보완이 필요한 포인트를 적으세요.',
      'coachingPoints에는 평가자와 대상자가 바로 논의할 수 있는 코칭 포인트를 적으세요.',
      'nextStep에는 제출 전 확인할 다음 단계를 한 문장으로 적으세요.',
    ].join(' ')
  }

  if (mode === 'bias') {
    return [
      '당신은 평가자 1:1 코칭 대화 초안을 돕는 HR 코칭 보조자입니다.',
      '반드시 제공된 근거만 사용하고, 불확실한 내용은 질문형 또는 확인 필요 표현으로 남기세요.',
      'draftText에는 존중하는 톤의 코칭 대화 시작 문안을 작성하세요.',
      'strengths에는 대화에서 먼저 인정할 강점 포인트를 적으세요.',
      'concerns에는 확인이 필요한 우려 포인트를 적으세요.',
      'coachingPoints에는 실제 1:1에서 사용할 질문 또는 합의 포인트를 적으세요.',
      'nextStep에는 다음 대화나 점검 시점을 한 문장으로 적으세요.',
    ].join(' ')
  }

  return [
    '당신은 다음 주기 성장 과제 초안을 돕는 성과 관리 보조자입니다.',
    '반드시 제공된 근거만 사용하고, 과장하거나 없는 사실을 추가하지 마세요.',
    'draftText에는 성장/개선 과제의 전체 방향을 한 단락으로 정리하세요.',
    'strengths에는 계속 활용할 강점을, concerns에는 우선 보완할 과제를 적으세요.',
    'coachingPoints에는 실행 가능한 개선 액션과 필요한 지원을 적으세요.',
    'nextStep에는 다음 체크인이나 리뷰 전까지의 실행 단계를 한 문장으로 적으세요.',
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

async function loadAssistSource<T>(params: {
  title: string
  fallback: T
  alert: string
  load: () => Promise<T>
}) {
  try {
    return { value: await params.load(), alert: null as string | null }
  } catch (error) {
    console.error(`[evaluation-ai-assist] ${params.title}`, error)
    return { value: params.fallback, alert: params.alert }
  }
}

function formatScore(value: number | null) {
  return typeof value === 'number' ? `${Math.round(value * 10) / 10}점` : '점수 미기입'
}

function buildItemSummaries(evaluationItems: LoadedEvaluationItem[], items: DraftItemInput[]) {
  const draftItemMap = new Map(items.map((item) => [item.personalKpiId, item]))

  return evaluationItems.map<ItemSummary>((item) => {
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
    throw new AppError(404, 'EVALUATION_NOT_FOUND', '평가 정보를 찾지 못했습니다.')
  }

  const canUseAssist = params.actorRole === 'ROLE_ADMIN' || evaluation.evaluatorId === params.actorId
  if (!canUseAssist) {
    throw new AppError(403, 'FORBIDDEN', '평가 AI 보조를 사용할 권한이 없습니다.')
  }

  const [gradeSettingsResult, recentCheckinsResult, feedbackRoundsResult] = await Promise.all([
    loadAssistSource({
      title: 'grade settings',
      fallback: [] as Array<{ id: string; gradeName: string }>,
      alert: '평가 등급 기준을 일부 불러오지 못해 현재 코멘트 기준으로 초안을 작성합니다.',
      load: () =>
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
    }),
    loadAssistSource({
      title: 'recent checkins',
      fallback: [] as Array<{
        scheduledDate: Date
        keyTakeaways: string | null
        managerNotes: string | null
        ownerNotes: string | null
      }>,
      alert: '최근 체크인 메모를 모두 불러오지 못해 확인 가능한 자료 중심으로 초안을 생성합니다.',
      load: () =>
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
    }),
    loadAssistSource({
      title: 'feedback rounds',
      fallback: [] as Array<{
        roundName: string
        roundType: string
        feedbacks: Array<{ responses: Array<{ textValue: string | null }> }>
      }>,
      alert: '다면 피드백 일부를 불러오지 못해 현재 KPI와 체크인 근거 중심으로 초안을 생성합니다.',
      load: () =>
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
                    textValue: true,
                  },
                },
              },
            },
          },
          orderBy: { endDate: 'desc' },
          take: 3,
        }),
    }),
  ])

  const gradeSettings = gradeSettingsResult.value
  const recentCheckins = recentCheckinsResult.value
  const feedbackRounds = feedbackRoundsResult.value
  const sourceAlerts = [
    gradeSettingsResult.alert,
    recentCheckinsResult.alert,
    feedbackRoundsResult.alert,
  ].filter((value): value is string => Boolean(value))

  const itemSummaries = buildItemSummaries(evaluation.items, params.items)
  const selectedGradeName =
    gradeSettings.find((grade) => grade.id === (params.draftGradeId || evaluation.gradeId))?.gradeName ?? ''

  const kpiSummaries = itemSummaries.slice(0, 6).map((item) => {
    const parts = [
      item.title,
      `가중치 ${item.weight}%`,
      formatScore(item.draftScore),
      item.linkedOrgKpi ? `연결 ${item.linkedOrgKpi}` : '연결 목표 없음',
    ]

    const monthlyEvidence = item.recentMonthlyEvidence[0]
    if (monthlyEvidence && typeof monthlyEvidence.achievementRate === 'number') {
      parts.push(`최근 달성률 ${monthlyEvidence.achievementRate}%`)
    }

    return parts.join(' / ')
  })

  const monthlySummaries = itemSummaries
    .flatMap((item) =>
      item.recentMonthlyEvidence.slice(0, 1).map((record) =>
        [
          `${item.title} / ${record.yearMonth}`,
          typeof record.achievementRate === 'number' ? `달성률 ${record.achievementRate}%` : '달성률 미집계',
          record.activities || record.obstacles || record.efforts || '상세 메모 없음',
        ].join(' / ')
      )
    )
    .slice(0, 6)

  const noteSummaries = [
    ...recentCheckins.map((checkin) =>
      [
        `체크인 / ${checkin.scheduledDate.toISOString().slice(0, 10)}`,
        checkin.keyTakeaways || checkin.managerNotes || checkin.ownerNotes || '메모 없음',
      ].join(' / ')
    ),
    ...feedbackRounds.map((round) => {
      const highlight =
        round.feedbacks
          .flatMap((feedback) => feedback.responses.map((response) => response.textValue || '').filter(Boolean))
          .slice(0, 2)
          .join(' / ') || '텍스트 피드백 요약 없음'

      return `${round.roundName} / ${round.roundType} / 응답 ${round.feedbacks.length}건 / ${highlight}`
    }),
  ].slice(0, 6)

  const highlights = [
    ...itemSummaries
      .slice(0, 3)
      .map((item) => `${item.title}: ${item.draftComment || `${formatScore(item.draftScore)} 기준으로 추가 코멘트 보강이 필요합니다.`}`),
    ...recentCheckins
      .slice(0, 2)
      .map((checkin) => checkin.keyTakeaways || checkin.managerNotes || checkin.ownerNotes || '최근 체크인 요약 없음'),
    ...feedbackRounds
      .slice(0, 1)
      .map((round) => `${round.roundName} 응답 ${round.feedbacks.length}건이 연결되어 있습니다.`),
  ]
    .filter((item) => item && item.trim().length > 0)
    .slice(0, 8)

  const evidenceView = buildEvaluationAssistEvidenceView({
    kpiSummaries,
    monthlySummaries,
    noteSummaries,
    keyPoints: highlights,
    alerts: sourceAlerts,
  })

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
    evidenceView,
    payload: sanitizeAiPayload({
      mode: params.mode,
      cycle: {
        name: evaluation.evalCycle.cycleName,
        year: evaluation.evalCycle.evalYear,
        stage: EVAL_STAGE_LABELS[evaluation.evalStage],
      },
      targetContext: {
        employeeName: evaluation.target.empName,
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
        kpiSummaries,
        monthlySummaries,
        noteSummaries,
        keyPoints: evidenceView.keyPoints,
        warnings: evidenceView.warnings,
        sufficiency: evidenceView.sufficiency,
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
      ? 'OPENAI_API_KEY가 설정되지 않아 AI 보조 기능을 사용할 수 없습니다.'
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
      evidence: context.evidenceView,
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
      evidence: context.evidenceView,
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

    throw new AppError(502, 'AI_ASSIST_FAILED', getEvaluationAssistPublicErrorMessage())
  }
}
