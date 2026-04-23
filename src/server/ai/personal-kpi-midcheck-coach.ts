import {
  AIApprovalStatus,
  AIRequestStatus,
  AIRequestType,
  type PrismaClient,
} from '@prisma/client'
import { readMidcheckCoachEnv } from '@/lib/ai-env'
import { estimateAiCostUsd, sanitizeAiPayload } from '@/lib/ai-assist'
import {
  buildPersonalKpiMidcheckCoachFallbackResult,
  normalizePersonalKpiMidcheckCoachInput,
  PERSONAL_KPI_MIDCHECK_COACH_JSON_SCHEMA,
  PersonalKpiMidcheckCoachRequestSchema,
  PersonalKpiMidcheckCoachResultSchema,
  type PersonalKpiMidcheckCoachRequest,
} from '@/lib/personal-kpi-midcheck-coach'
import { getPersonalKpiScopeDepartmentIds } from '@/lib/personal-kpi-access'
import { prisma } from '@/lib/prisma'
import { AppError } from '@/lib/utils'

type JsonRecord = Record<string, unknown>
type FetchLike = typeof fetch

type ResponsesApiEnvelope = {
  output_text?: string | null
  output?: Array<{ content?: Array<{ text?: string | null }> | null } | null>
  usage?: {
    input_tokens?: number
    output_tokens?: number
  }
  model?: string
  status?: string
}

export type PersonalKpiMidcheckCoachSource = 'ai' | 'fallback' | 'disabled'

type PersonalKpiMidcheckCoachSession = {
  user: {
    id: string
    role: Parameters<typeof getPersonalKpiScopeDepartmentIds>[0]['role']
    deptId: string
    accessibleDepartmentIds?: string[] | null
  }
}

export type PersonalKpiMidcheckCoachResponse = {
  requestLogId: string
  source: PersonalKpiMidcheckCoachSource
  fallbackReason?: string | null
  result: ReturnType<typeof buildPersonalKpiMidcheckCoachFallbackResult>
}

export type PersonalKpiMidcheckCoachContext = {
  kpi: {
    id: string
    title: string
    departmentName: string
    status: string
    definition?: string
    formula?: string
    targetValue?: number | string
    unit?: string
    orgKpiTitle?: string | null
    reviewComment?: string
    monthlyAchievementRate?: number
    riskFlags: string[]
  }
  recentMonthlyRecords: Array<{
    month: string
    achievementRate?: number
    activities?: string | null
    obstacles?: string | null
    evidenceComment?: string | null
  }>
}

function extractResponseText(response: ResponsesApiEnvelope) {
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

function buildSystemPrompt() {
  return [
    'You are an AI mid-review coach for personal KPI evidence.',
    'Reply only in Korean.',
    'Use only the provided KPI and evidence snapshot.',
    'Never claim evidence that is not present.',
    'Never assign ratings, rankings, or formal performance evaluations.',
    'If evidence is weak, explicitly mark the result as insufficient_data or partial evidence.',
    'Provide supportive and practical next actions for the employee and manager.',
    'Return strictly valid JSON that matches the schema.',
  ].join(' ')
}

function buildUserPrompt(payload: Record<string, unknown>) {
  return JSON.stringify(payload, null, 2)
}

export async function loadPersonalKpiMidcheckCoachContext(
  params: {
    session: PersonalKpiMidcheckCoachSession
    personalKpiId: string
  },
  db: PrismaClient = prisma
): Promise<PersonalKpiMidcheckCoachContext> {
  const scopeDepartmentIds = getPersonalKpiScopeDepartmentIds({
    role: params.session.user.role,
    deptId: params.session.user.deptId,
    accessibleDepartmentIds: params.session.user.accessibleDepartmentIds,
  })

  const kpi = await db.personalKpi.findUnique({
    where: { id: params.personalKpiId },
    include: {
      employee: {
        include: {
          department: true,
        },
      },
      linkedOrgKpi: {
        select: {
          kpiName: true,
        },
      },
      monthlyRecords: {
        orderBy: {
          yearMonth: 'desc',
        },
        take: 6,
      },
    },
  })

  if (!kpi) {
    throw new AppError(404, 'PERSONAL_KPI_NOT_FOUND', '개인 KPI를 찾을 수 없습니다.')
  }

  if (scopeDepartmentIds && !scopeDepartmentIds.includes(kpi.employee.deptId) && params.session.user.id !== kpi.employeeId) {
    throw new AppError(403, 'FORBIDDEN', '권한 범위를 벗어난 개인 KPI입니다.')
  }

  const latestRecord = kpi.monthlyRecords[0]

  return {
    kpi: {
      id: kpi.id,
      title: kpi.kpiName,
      departmentName: kpi.employee.department?.deptName ?? '미지정 조직',
      status: kpi.status,
      definition: kpi.definition ?? undefined,
      formula: kpi.formula ?? undefined,
      targetValue: kpi.targetValue ?? undefined,
      unit: kpi.unit ?? undefined,
      orgKpiTitle: kpi.linkedOrgKpi?.kpiName ?? null,
      reviewComment: undefined,
      monthlyAchievementRate: latestRecord?.achievementRate ?? undefined,
      riskFlags: [
        ...(kpi.linkedOrgKpiId ? [] : ['조직 KPI 연결이 비어 있습니다.']),
        ...(typeof latestRecord?.achievementRate === 'number' && latestRecord.achievementRate < 80
          ? ['최근 달성 흐름이 낮습니다.']
          : []),
      ],
    },
    recentMonthlyRecords: kpi.monthlyRecords.map((record) => ({
      month: record.yearMonth,
      achievementRate: record.achievementRate ?? undefined,
      activities: record.activities ?? undefined,
      obstacles: record.obstacles ?? undefined,
      evidenceComment: record.evidenceComment ?? undefined,
    })),
  }
}

export async function requestPersonalKpiMidcheckCoachFromOpenAI(
  input: PersonalKpiMidcheckCoachContext & PersonalKpiMidcheckCoachRequest,
  options?: {
    env?: Record<string, string | undefined>
    fetcher?: FetchLike
  }
) {
  const env = readMidcheckCoachEnv(options?.env)
  if (!env.enabled) {
    throw new AppError(503, 'AI_DISABLED', 'AI feature is disabled.')
  }
  if (!env.apiKey) {
    throw new AppError(503, 'AI_API_KEY_MISSING', 'OPENAI_API_KEY is not configured.')
  }

  const requestPayload = normalizePersonalKpiMidcheckCoachInput({
    kpi: input.kpi,
    yearMonth: input.yearMonth,
    evidenceComment: input.evidenceComment,
    attachments: input.attachments,
    recentMonthlyRecords: input.recentMonthlyRecords,
  })

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 25_000)

  try {
    const response = await (options?.fetcher ?? fetch)(`${env.baseUrl}/responses`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: env.coachModel,
        store: false,
        input: [
          {
            role: 'system',
            content: [{ type: 'input_text', text: buildSystemPrompt() }],
          },
          {
            role: 'user',
            content: [{ type: 'input_text', text: buildUserPrompt(requestPayload) }],
          },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'personal_kpi_midcheck_coach',
            schema: PERSONAL_KPI_MIDCHECK_COACH_JSON_SCHEMA,
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

    const envelope = json as ResponsesApiEnvelope
    const responseText = extractResponseText(envelope)
    if (!responseText) {
      if (envelope.status === 'incomplete') {
        throw new AppError(502, 'AI_INCOMPLETE_RESPONSE', 'OpenAI response was incomplete.')
      }
      throw new AppError(502, 'AI_EMPTY_RESPONSE', 'OpenAI response did not include structured output.')
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(responseText)
    } catch {
      throw new AppError(502, 'AI_INVALID_JSON', 'OpenAI response JSON could not be parsed.')
    }

    const validated = PersonalKpiMidcheckCoachResultSchema.safeParse(parsed)
    if (!validated.success) {
      throw new AppError(502, 'AI_INVALID_SHAPE', 'OpenAI response did not match the expected schema.')
    }

    const inputTokens = Number(envelope.usage?.input_tokens ?? 0)
    const outputTokens = Number(envelope.usage?.output_tokens ?? 0)

    return {
      result: validated.data,
      model: typeof envelope.model === 'string' ? envelope.model : env.coachModel,
      inputTokens,
      outputTokens,
      estimatedCostUsd: estimateAiCostUsd({ inputTokens, outputTokens }),
      requestPayload,
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new AppError(504, 'AI_REQUEST_TIMEOUT', 'AI request timed out.')
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

export async function generatePersonalKpiMidcheckCoach(
  params: {
    session: PersonalKpiMidcheckCoachSession
    personalKpiId: string
    input: unknown
  },
  options?: {
    db?: PrismaClient
    env?: Record<string, string | undefined>
    fetcher?: FetchLike
  }
): Promise<PersonalKpiMidcheckCoachResponse> {
  const db = options?.db ?? prisma
  const validated = PersonalKpiMidcheckCoachRequestSchema.safeParse(params.input)
  if (!validated.success) {
    throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0]?.message ?? '입력값을 확인해 주세요.')
  }

  const context = await loadPersonalKpiMidcheckCoachContext(
    {
      session: params.session,
      personalKpiId: params.personalKpiId,
    },
    db
  )

  const fallbackResult = buildPersonalKpiMidcheckCoachFallbackResult({
    ...context,
    ...validated.data,
  })
  const sanitizedPayload = sanitizeAiPayload(
    normalizePersonalKpiMidcheckCoachInput({
      ...context,
      ...validated.data,
    }) as Record<string, unknown>
  )
  const env = readMidcheckCoachEnv(options?.env)

  if (!env.enabled || !env.apiKey) {
    const log = await db.aiRequestLog.create({
      data: {
        requesterId: params.session.user.id,
        requestType: AIRequestType.MID_REVIEW_ASSIST,
        requestStatus: AIRequestStatus.DISABLED,
        approvalStatus: AIApprovalStatus.APPROVED,
        approvedAt: new Date(),
        approvedById: params.session.user.id,
        sourceType: 'personal-kpi-midcheck-coach',
        sourceId: params.personalKpiId,
        model: env.coachModel,
        requestPayload: sanitizedPayload as never,
        responsePayload: fallbackResult as never,
        piiMinimized: true,
        errorCode: env.enabled ? 'AI_API_KEY_MISSING' : 'AI_DISABLED',
        errorMessage: env.enabled
          ? 'OPENAI_API_KEY is not configured.'
          : 'AI feature is disabled.',
      },
    })

    return {
      requestLogId: log.id,
      source: 'disabled',
      fallbackReason: env.enabled
        ? 'AI 코칭을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'
        : 'AI 기능이 비활성화되어 기본 가이드를 표시합니다.',
      result: fallbackResult,
    }
  }

  try {
    const aiResult = await requestPersonalKpiMidcheckCoachFromOpenAI(
      {
        ...context,
        ...validated.data,
      },
      {
        env: options?.env,
        fetcher: options?.fetcher,
      }
    )

    const log = await db.aiRequestLog.create({
      data: {
        requesterId: params.session.user.id,
        requestType: AIRequestType.MID_REVIEW_ASSIST,
        requestStatus: AIRequestStatus.SUCCESS,
        approvalStatus: AIApprovalStatus.APPROVED,
        approvedAt: new Date(),
        approvedById: params.session.user.id,
        sourceType: 'personal-kpi-midcheck-coach',
        sourceId: params.personalKpiId,
        provider: 'OPENAI',
        model: aiResult.model,
        requestPayload: sanitizedPayload as never,
        responsePayload: aiResult.result as never,
        approvedPayload: aiResult.result as never,
        piiMinimized: true,
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
    console.warn('[personal-kpi-midcheck-coach]', errorCode, errorMessage)

    const fallback = buildPersonalKpiMidcheckCoachFallbackResult(
      {
        ...context,
        ...validated.data,
      },
      errorMessage
    )

    const log = await db.aiRequestLog.create({
      data: {
        requesterId: params.session.user.id,
        requestType: AIRequestType.MID_REVIEW_ASSIST,
        requestStatus: AIRequestStatus.FALLBACK,
        approvalStatus: AIApprovalStatus.APPROVED,
        approvedAt: new Date(),
        approvedById: params.session.user.id,
        sourceType: 'personal-kpi-midcheck-coach',
        sourceId: params.personalKpiId,
        provider: 'OPENAI',
        model: env.coachModel,
        requestPayload: sanitizedPayload as never,
        responsePayload: fallback as never,
        approvedPayload: fallback as never,
        piiMinimized: true,
        errorCode,
        errorMessage,
      },
    })

    return {
      requestLogId: log.id,
      source: 'fallback',
      fallbackReason: 'AI 코칭을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
      result: fallback,
    }
  }
}
