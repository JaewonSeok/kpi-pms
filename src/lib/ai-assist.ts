import {
  AIApprovalStatus,
  AIRequestStatus,
  AIRequestType,
  Prisma,
  type PrismaClient,
} from '@prisma/client'
import { prisma } from './prisma'
import { AppError } from './utils'
import { isFeatureEnabled } from './feature-flags'
import { recordOperationalEvent } from './operations'

type JsonRecord = Record<string, unknown>

type AiConfig = {
  schemaName: string
  schema: JsonRecord
  systemPrompt: string
}

type AiAssistExecutionParams = {
  requesterId: string
  requestType: AIRequestType
  sourceType?: string
  sourceId?: string
  payload: JsonRecord
}

type DecisionParams = {
  id: string
  actorId: string
  action: 'approve' | 'reject'
  approvedPayload?: JsonRecord
  rejectionReason?: string
}

type OpenAIResponseData = {
  result: JsonRecord
  model: string
  inputTokens: number
  outputTokens: number
  estimatedCostUsd: number
}

export const AI_REQUEST_LABELS: Record<AIRequestType, string> = {
  KPI_ASSIST: 'KPI 작성 보조',
  EVAL_COMMENT_DRAFT: '평가 코멘트 초안',
  BIAS_ANALYSIS: '편향 분석',
  GROWTH_PLAN: '성장 계획 추천',
}

const KPI_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'kpiName',
    'definition',
    'formula',
    'targetValueSuggestion',
    'unitSuggestion',
    'weightSuggestion',
    'difficultySuggestion',
    'smartChecks',
    'managerReviewPoints',
  ],
  properties: {
    kpiName: { type: 'string' },
    definition: { type: 'string' },
    formula: { type: 'string' },
    targetValueSuggestion: { type: 'string' },
    unitSuggestion: { type: 'string' },
    weightSuggestion: { type: 'number' },
    difficultySuggestion: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] },
    smartChecks: {
      type: 'array',
      items: { type: 'string' },
    },
    managerReviewPoints: {
      type: 'array',
      items: { type: 'string' },
    },
  },
} satisfies JsonRecord

const EVAL_COMMENT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'strengths', 'improvements', 'draftComment'],
  properties: {
    summary: { type: 'string' },
    strengths: {
      type: 'array',
      items: { type: 'string' },
    },
    improvements: {
      type: 'array',
      items: { type: 'string' },
    },
    draftComment: { type: 'string' },
  },
} satisfies JsonRecord

const BIAS_ANALYSIS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['riskLevel', 'findings', 'balancedRewrite'],
  properties: {
    riskLevel: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['severity', 'issue', 'recommendation'],
        properties: {
          severity: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
          issue: { type: 'string' },
          recommendation: { type: 'string' },
        },
      },
    },
    balancedRewrite: { type: 'string' },
  },
} satisfies JsonRecord

const GROWTH_PLAN_SCHEMA = {
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
} satisfies JsonRecord

const AI_CONFIGS: Record<AIRequestType, AiConfig> = {
  KPI_ASSIST: {
    schemaName: 'kpi_assist',
    schema: KPI_SCHEMA,
    systemPrompt:
      'You are an HR performance management assistant. Draft a SMART KPI suggestion using only the provided sanitized context. Never include personal identifiers. Keep the output concise and practical.',
  },
  EVAL_COMMENT_DRAFT: {
    schemaName: 'evaluation_comment_draft',
    schema: EVAL_COMMENT_SCHEMA,
    systemPrompt:
      'You are an evaluation writing assistant. Produce balanced, evidence-based feedback using only the provided sanitized context. Avoid absolute claims, sensitive identity assumptions, and unsupported conclusions.',
  },
  BIAS_ANALYSIS: {
    schemaName: 'bias_analysis',
    schema: BIAS_ANALYSIS_SCHEMA,
    systemPrompt:
      'You are a bias review assistant for performance evaluations. Detect wording risks such as subjectivity, recency bias, halo effect, gendered or personality-loaded language, and missing evidence. Return actionable recommendations.',
  },
  GROWTH_PLAN: {
    schemaName: 'growth_plan',
    schema: GROWTH_PLAN_SCHEMA,
    systemPrompt:
      'You are a career development assistant. Recommend a short growth plan grounded in the provided performance context. Keep it specific, realistic, and appropriate for manager review.',
  },
}

const OMIT_KEY_PATTERN =
  /^(name|empname|employeename|email|gwsemail|empid|employeeid|requesterid|targetid|evaluatorid|recipientid|approvedbyid|linkedorgkpiid)$/i

function redactText(value: string) {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
    .replace(/\bEMP-\d{4}-\d{3,}\b/gi, '[redacted-employee-id]')
    .replace(/\b01[016789]-?\d{3,4}-?\d{4}\b/g, '[redacted-phone]')
}

function sanitizeValue(value: unknown, key?: string): unknown {
  if (key && OMIT_KEY_PATTERN.test(key)) {
    return undefined
  }

  if (typeof value === 'string') {
    return redactText(value).slice(0, 4000)
  }

  if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
    return value
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeValue(item))
      .filter((item) => item !== undefined)
      .slice(0, 20)
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .map(([entryKey, entryValue]) => [entryKey, sanitizeValue(entryValue, entryKey)] as const)
      .filter(([, entryValue]) => entryValue !== undefined)

    return Object.fromEntries(entries)
  }

  if (value === undefined) {
    return undefined
  }

  return String(value)
}

export function sanitizeAiPayload(payload: JsonRecord) {
  return (sanitizeValue(payload) ?? {}) as JsonRecord
}

function toJsonValue(value: JsonRecord | undefined) {
  return (value ?? {}) as Prisma.InputJsonValue
}

function toStringArray(values: unknown, fallback: string[]) {
  if (!Array.isArray(values)) return fallback
  const list = values.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
  return list.length ? list : fallback
}

export function buildFallbackResult(requestType: AIRequestType, payload: JsonRecord): JsonRecord {
  const summary = String(payload.summary ?? payload.contextSummary ?? payload.definition ?? '').trim()
  const goal = String(payload.goal ?? payload.kpiName ?? payload.focusArea ?? '').trim()
  const orgKpi = String(payload.orgKpiName ?? '').trim()
  const grade = String(payload.gradeName ?? '').trim()

  switch (requestType) {
    case AIRequestType.KPI_ASSIST:
      return {
        kpiName: goal || (orgKpi ? `${orgKpi} 실행력 강화` : '핵심 KPI 초안'),
        definition:
          summary ||
          '조직 목표와 연결된 핵심 결과를 분기 또는 연간 기준으로 측정할 수 있게 정의한 KPI 초안입니다.',
        formula: payload.kpiType === 'QUALITATIVE' ? '정성 평가 체크리스트 충족률' : '실적 / 목표 x 100',
        targetValueSuggestion: String(payload.targetValue ?? '월별 목표 100 기준'),
        unitSuggestion: String(payload.unit ?? (payload.kpiType === 'QUALITATIVE' ? '점수' : '%')),
        weightSuggestion: Number(payload.weight ?? 20),
        difficultySuggestion: String(payload.difficulty ?? 'MEDIUM'),
        smartChecks: [
          '목표 대상과 산출물이 문장에 포함되어 있습니다.',
          '측정 방식 또는 점검 기준이 포함되어 있습니다.',
          '조직 KPI와 연결되는 맥락이 드러납니다.',
        ],
        managerReviewPoints: [
          '가중치가 전체 KPI 합계와 충돌하지 않는지 확인하세요.',
          '측정 주기와 데이터 출처를 한 번 더 검토하세요.',
        ],
      }
    case AIRequestType.EVAL_COMMENT_DRAFT:
      return {
        summary: summary || '현재 입력된 근거를 기준으로 균형 잡힌 평가 코멘트 초안을 준비했습니다.',
        strengths: toStringArray(payload.strengths, ['주요 KPI 또는 과제에서 안정적인 실행력을 보였습니다.']),
        improvements: toStringArray(payload.improvements, ['우선순위 조정과 후속 커뮤니케이션을 더 명확히 하면 효과가 커질 수 있습니다.']),
        draftComment:
          summary ||
          `${grade ? `${grade} 수준의 ` : ''}성과를 뒷받침하는 근거를 중심으로 강점과 개선 포인트를 함께 정리한 초안입니다. 구체 사례와 수치를 추가한 뒤 제출해 주세요.`,
      }
    case AIRequestType.BIAS_ANALYSIS:
      return {
        riskLevel: 'MEDIUM',
        findings: [
          {
            severity: 'MEDIUM',
            issue: '주관적 표현이나 성향 중심 표현이 포함될 수 있습니다.',
            recommendation: '행동과 결과, 관찰 가능한 사실 중심으로 문장을 다시 써 주세요.',
          },
          {
            severity: 'LOW',
            issue: '최근 사례에 근거가 치우쳤는지 확인이 필요합니다.',
            recommendation: '기간 전체의 대표 사례를 함께 언급해 주세요.',
          },
        ],
        balancedRewrite:
          summary ||
          '관찰된 행동, KPI 결과, 협업 기여를 기준으로 표현을 정리하고, 개인 성향 대신 구체적인 사례 중심으로 보완한 문장입니다.',
      }
    case AIRequestType.GROWTH_PLAN:
      return {
        focusArea: goal || '우선 개선 영역',
        recommendedActions: [
          '다음 분기 핵심 과제 1개를 선정해 주간 점검 지표를 운영합니다.',
          '리뷰 또는 피드백 루프를 월 1회 이상 정례화합니다.',
        ],
        supportNeeded: [
          '매니저와 월별 체크인에서 진행 상황을 확인합니다.',
          '필요한 교육이나 멘토링 자원을 사전에 확보합니다.',
        ],
        milestone: grade ? `${grade} 결과 피드백 반영 후 90일 내 중간 점검` : '90일 내 중간 점검',
      }
    default:
      return {
        summary: 'Fallback response',
      }
  }
}

export function estimateAiCostUsd(params: { inputTokens: number; outputTokens: number }) {
  const inputRate = Number(process.env.OPENAI_INPUT_COST_PER_1M ?? 0)
  const outputRate = Number(process.env.OPENAI_OUTPUT_COST_PER_1M ?? 0)
  const total =
    (Math.max(params.inputTokens, 0) / 1_000_000) * inputRate +
    (Math.max(params.outputTokens, 0) / 1_000_000) * outputRate

  return Math.round(total * 1_000_000) / 1_000_000
}

export function isAiFeatureEnabled() {
  return isFeatureEnabled('aiAssist')
}

function extractOutputText(response: JsonRecord) {
  const outputText = response.output_text
  if (typeof outputText === 'string' && outputText.trim()) {
    return outputText
  }

  const output = Array.isArray(response.output) ? response.output : []
  const chunks: string[] = []

  for (const item of output) {
    if (!item || typeof item !== 'object') continue
    const content = Array.isArray((item as JsonRecord).content)
      ? ((item as JsonRecord).content as unknown[])
      : []

    for (const part of content) {
      if (!part || typeof part !== 'object') continue
      const record = part as JsonRecord
      if (typeof record.text === 'string' && record.text.trim()) {
        chunks.push(record.text)
      }
    }
  }

  return chunks.join('\n').trim()
}

async function callOpenAIResponsesApi(
  requestType: AIRequestType,
  payload: JsonRecord
): Promise<OpenAIResponseData> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new AppError(503, 'AI_API_KEY_MISSING', 'OPENAI_API_KEY is not configured.')
  }

  const config = AI_CONFIGS[requestType]
  const model = process.env.OPENAI_RESPONSES_MODEL || 'gpt-5-mini'
  const baseUrl = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '')
  const response = await fetch(`${baseUrl}/responses`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: 'system',
          content: [{ type: 'input_text', text: config.systemPrompt }],
        },
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: JSON.stringify(payload, null, 2),
            },
          ],
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: config.schemaName,
          schema: config.schema,
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

  const text = extractOutputText(json)
  if (!text) {
    throw new AppError(502, 'AI_EMPTY_RESPONSE', 'OpenAI response did not include structured output.')
  }

  let parsed: JsonRecord
  try {
    parsed = JSON.parse(text) as JsonRecord
  } catch {
    throw new AppError(502, 'AI_INVALID_JSON', 'OpenAI response JSON could not be parsed.')
  }

  const usage = (json.usage ?? {}) as JsonRecord
  const inputTokens = Number(usage.input_tokens ?? 0)
  const outputTokens = Number(usage.output_tokens ?? 0)

  return {
    result: parsed,
    model: typeof json.model === 'string' ? json.model : model,
    inputTokens,
    outputTokens,
    estimatedCostUsd: estimateAiCostUsd({ inputTokens, outputTokens }),
  }
}

export async function generateAiAssist(
  params: AiAssistExecutionParams,
  db: PrismaClient = prisma
) {
  const requestPayload = sanitizeAiPayload(params.payload)
  const fallbackResult = buildFallbackResult(params.requestType, requestPayload)
  const baseData = {
    requesterId: params.requesterId,
    requestType: params.requestType,
    sourceType: params.sourceType,
    sourceId: params.sourceId,
    requestPayload: toJsonValue(requestPayload),
    piiMinimized: true,
  }

  if (!isAiFeatureEnabled()) {
    await recordOperationalEvent({
      level: 'WARN',
      component: 'ai-assist',
      eventType: 'AI_DISABLED_FALLBACK',
      message: 'AI feature is disabled. Serving deterministic fallback.',
      metadata: {
        requestType: params.requestType,
        requesterId: params.requesterId,
      },
    }, db)

    const log = await db.aiRequestLog.create({
      data: {
        ...baseData,
        requestStatus: AIRequestStatus.DISABLED,
        responsePayload: toJsonValue(fallbackResult),
        errorCode: 'AI_DISABLED',
        errorMessage: 'AI feature is disabled. Returned deterministic fallback.',
      },
    })

    return {
      requestLogId: log.id,
      source: 'disabled' as const,
      result: fallbackResult,
      fallbackReason: 'AI 기능이 비활성화되어 기본 제안을 제공합니다.',
    }
  }

  try {
    const aiResult = await callOpenAIResponsesApi(params.requestType, requestPayload)
    const log = await db.aiRequestLog.create({
      data: {
        ...baseData,
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
      result: aiResult.result,
      fallbackReason: null,
    }
  } catch (error) {
    const errorCode = error instanceof AppError ? error.code : 'AI_REQUEST_FAILED'
    const errorMessage = error instanceof Error ? error.message : 'Unknown AI request error.'

    await recordOperationalEvent({
      level: 'WARN',
      component: 'ai-assist',
      eventType: 'AI_FALLBACK_TRIGGERED',
      message: errorMessage,
      metadata: {
        errorCode,
        requestType: params.requestType,
        requesterId: params.requesterId,
      },
    }, db)

    const log = await db.aiRequestLog.create({
      data: {
        ...baseData,
        requestStatus: AIRequestStatus.FALLBACK,
        provider: 'OPENAI',
        model: process.env.OPENAI_RESPONSES_MODEL || 'gpt-5-mini',
        responsePayload: toJsonValue(fallbackResult),
        errorCode,
        errorMessage,
      },
    })

    return {
      requestLogId: log.id,
      source: 'fallback' as const,
      result: fallbackResult,
      fallbackReason: errorMessage,
    }
  }
}

export async function decideAiRequest(
  params: DecisionParams,
  db: PrismaClient = prisma
) {
  const log = await db.aiRequestLog.findUnique({
    where: { id: params.id },
  })

  if (!log) {
    throw new AppError(404, 'AI_REQUEST_NOT_FOUND', 'AI request log not found.')
  }

  if (log.approvalStatus !== AIApprovalStatus.PENDING) {
    throw new AppError(409, 'AI_REQUEST_ALREADY_DECIDED', 'This AI request has already been decided.')
  }

  if (params.action === 'approve') {
    return db.aiRequestLog.update({
      where: { id: params.id },
      data: {
        approvalStatus: AIApprovalStatus.APPROVED,
        approvedPayload: toJsonValue(
          params.approvedPayload ??
            ((log.responsePayload as JsonRecord | null | undefined) ?? buildFallbackResult(log.requestType, {}))
        ),
        approvedById: params.actorId,
        approvedAt: new Date(),
      },
    })
  }

  return db.aiRequestLog.update({
    where: { id: params.id },
    data: {
      approvalStatus: AIApprovalStatus.REJECTED,
      approvedById: params.actorId,
      rejectedAt: new Date(),
      rejectionReason: params.rejectionReason ?? 'User rejected the suggestion.',
    },
  })
}
