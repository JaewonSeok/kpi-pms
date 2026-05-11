import {
  AIApprovalStatus,
  AIRequestStatus,
  AIRequestType,
  type PrismaClient,
  type SystemRole,
} from '@prisma/client'
import { estimateAiCostUsd, sanitizeAiPayload } from '@/lib/ai-assist'
import { readMidcheckCoachEnv } from '@/lib/ai-env'
import {
  buildCheckinAiFeedbackFallbackResult,
  CHECKIN_AI_FEEDBACK_JSON_SCHEMA,
  CheckinAiFeedbackRequestSchema,
  CheckinAiFeedbackResultSchema,
  normalizeCheckinAiFeedbackInput,
  type CheckinAiFeedbackContext,
  type CheckinAiFeedbackResponse,
} from '@/lib/checkin-ai-feedback'
import { prisma } from '@/lib/prisma'
import { AppError, POSITION_LABELS, ROLE_LABELS } from '@/lib/utils'
import { canAccessManagedEmployeeContext } from '@/server/checkin-access'

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

type CheckinAiFeedbackSession = {
  user: {
    id: string
    role: SystemRole
  }
}

type ParsedActionItem = {
  title: string
  priority: 'LOW' | 'MEDIUM' | 'HIGH'
  completed: boolean
  dueDate?: string | null
}

type ParsedKpiDiscussion = {
  progress?: string | null
  concern?: string | null
  support?: string | null
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
    'You are a leadership check-in coaching assistant.',
    'Reply only in Korean.',
    'Use only the provided employee-specific KPI, monthly, check-in, feedback, and action-item context.',
    'Do not invent achievements, blockers, ratings, grades, or facts that are not present.',
    'Never assign a formal performance rating, rank, grade, or compensation recommendation.',
    'If data is missing or weak, set status to insufficient_data or explicitly list evidence_gaps.',
    'Produce practical, specific, supportive coaching guidance for a leader preparing a check-in.',
    'Treat the output as a draft for the leader only; do not write as if it was sent to the employee.',
    'Return strictly valid JSON that matches the schema.',
  ].join(' ')
}

function buildUserPrompt(payload: Record<string, unknown>) {
  return JSON.stringify(payload, null, 2)
}

function parseAgendaTopics(value: unknown) {
  if (!Array.isArray(value)) return []
  const topics: string[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    const topic = typeof record.topic === 'string' ? record.topic.trim() : ''
    if (topic) topics.push(topic)
  }
  return topics
}

function parseActionItems(value: unknown): ParsedActionItem[] {
  if (!Array.isArray(value)) return []
  const items: ParsedActionItem[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    const action = typeof record.action === 'string' ? record.action.trim() : ''
    if (!action) continue
    const priority =
      record.priority === 'LOW' || record.priority === 'MEDIUM' || record.priority === 'HIGH'
        ? record.priority
        : 'MEDIUM'
    items.push({
      title: action,
      priority,
      completed: Boolean(record.completed),
      dueDate: typeof record.dueDate === 'string' ? record.dueDate : null,
    })
  }
  return items
}

function parseKpiDiscussed(value: unknown): ParsedKpiDiscussion[] {
  if (!Array.isArray(value)) return []
  const items: ParsedKpiDiscussion[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    const progress = typeof record.progress === 'string' ? record.progress.trim() : ''
    const concern = typeof record.concern === 'string' ? record.concern.trim() : ''
    const support = typeof record.support === 'string' ? record.support.trim() : ''
    if (!progress && !concern && !support) continue
    items.push({
      progress: progress || null,
      concern: concern || null,
      support: support || null,
    })
  }
  return items
}

function isOverdueDate(value?: string | null) {
  if (!value) return false
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return false
  date.setHours(23, 59, 59, 999)
  return date.getTime() < Date.now()
}

function isoDate(value?: Date | string | null) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

function buildRiskFlags(params: {
  linkedOrgKpiTitle?: string | null
  latestAchievementRate?: number | null
  latestObstacles?: string | null
}) {
  return [
    params.linkedOrgKpiTitle ? null : '조직 KPI 연결 정보가 없습니다.',
    typeof params.latestAchievementRate === 'number' && params.latestAchievementRate < 80
      ? '최근 달성률이 80% 미만입니다.'
      : null,
    params.latestObstacles?.trim() ? '최근 월간 실적에 장애 요인이 기록되어 있습니다.' : null,
  ].filter((item): item is string => Boolean(item))
}

export async function loadCheckinAiFeedbackContext(
  params: {
    session: CheckinAiFeedbackSession
    employeeId: string
  },
  db: PrismaClient = prisma
): Promise<CheckinAiFeedbackContext> {
  const targetEmployee = await db.employee.findUnique({
    where: { id: params.employeeId },
    select: {
      id: true,
      status: true,
      position: true,
      role: true,
      teamLeaderId: true,
      sectionChiefId: true,
      divisionHeadId: true,
      department: {
        select: {
          deptName: true,
        },
      },
    },
  })

  if (!targetEmployee || targetEmployee.status !== 'ACTIVE') {
    throw new AppError(404, 'EMPLOYEE_NOT_FOUND', '피드백 대상 구성원을 찾을 수 없습니다.')
  }

  if (
    !canAccessManagedEmployeeContext(params.session.user.id, params.session.user.role, {
      id: targetEmployee.id,
      teamLeaderId: targetEmployee.teamLeaderId,
      sectionChiefId: targetEmployee.sectionChiefId,
      divisionHeadId: targetEmployee.divisionHeadId,
    })
  ) {
    throw new AppError(403, 'FORBIDDEN', '피드백 대상이 현재 리더 권한 범위에 없습니다.')
  }

  const currentYear = new Date().getFullYear()
  const since = new Date()
  since.setMonth(since.getMonth() - 8)

  const [personalKpis, monthlyRecords, checkins, feedbacks] = await Promise.all([
    db.personalKpi.findMany({
      where: {
        employeeId: params.employeeId,
        evalYear: currentYear,
      },
      include: {
        linkedOrgKpi: {
          select: {
            kpiName: true,
          },
        },
      },
      orderBy: [{ weight: 'desc' }, { kpiName: 'asc' }],
      take: 12,
    }),
    db.monthlyRecord.findMany({
      where: {
        employeeId: params.employeeId,
      },
      include: {
        personalKpi: {
          select: {
            kpiName: true,
          },
        },
      },
      orderBy: [{ yearMonth: 'desc' }, { updatedAt: 'desc' }],
      take: 14,
    }),
    db.checkIn.findMany({
      where: {
        ownerId: params.employeeId,
        scheduledDate: {
          gte: since,
        },
      },
      orderBy: [{ scheduledDate: 'desc' }, { createdAt: 'desc' }],
      take: 10,
    }),
    db.multiFeedback.findMany({
      where: {
        receiverId: params.employeeId,
        status: 'SUBMITTED',
      },
      select: {
        relationship: true,
        overallComment: true,
        submittedAt: true,
        createdAt: true,
      },
      orderBy: { submittedAt: 'desc' },
      take: 6,
    }),
  ])

  const latestMonthlyByKpiId = new Map<string, (typeof monthlyRecords)[number]>()
  for (const record of monthlyRecords) {
    if (!latestMonthlyByKpiId.has(record.personalKpiId)) {
      latestMonthlyByKpiId.set(record.personalKpiId, record)
    }
  }

  const parsedCheckins = checkins.map((checkin) => ({
    date: isoDate(checkin.actualDate ?? checkin.scheduledDate) ?? checkin.scheduledDate.toISOString(),
    type: checkin.checkInType,
    status: checkin.status,
    agendaTopics: parseAgendaTopics(checkin.agendaItems),
    ownerNotes: checkin.ownerNotes ?? null,
    managerNotes: checkin.managerNotes ?? null,
    summary: checkin.keyTakeaways ?? null,
    energyLevel: checkin.energyLevel ?? null,
    satisfactionLevel: checkin.satisfactionLevel ?? null,
    blockerCount: checkin.blockerCount ?? null,
    actionItems: parseActionItems(checkin.actionItems),
    kpiDiscussed: parseKpiDiscussed(checkin.kpiDiscussed),
  }))

  const openActions = parsedCheckins
    .flatMap((checkin) =>
      checkin.actionItems
        .filter((item) => !item.completed)
        .map((item) => ({
          title: item.title,
          priority: item.priority,
          dueDate: item.dueDate ?? null,
          overdue: isOverdueDate(item.dueDate),
          sourceDate: checkin.date,
        }))
    )
    .slice(0, 10)

  return {
    employee: {
      departmentName: targetEmployee.department?.deptName ?? '미지정 조직',
      position: POSITION_LABELS[targetEmployee.position] ?? targetEmployee.position,
      roleLabel: ROLE_LABELS[targetEmployee.role] ?? targetEmployee.role,
    },
    kpis: personalKpis.map((kpi) => {
      const latestMonthly = latestMonthlyByKpiId.get(kpi.id)
      return {
        title: kpi.kpiName,
        status: kpi.status,
        weight: kpi.weight,
        type: kpi.kpiType,
        targetValue: kpi.targetValue ?? null,
        unit: kpi.unit ?? null,
        linkedOrgKpiTitle: kpi.linkedOrgKpi?.kpiName ?? null,
        latestAchievementRate: latestMonthly?.achievementRate ?? null,
        riskFlags: buildRiskFlags({
          linkedOrgKpiTitle: kpi.linkedOrgKpi?.kpiName ?? null,
          latestAchievementRate: latestMonthly?.achievementRate ?? null,
          latestObstacles: latestMonthly?.obstacles ?? null,
        }),
      }
    }),
    monthlyRecords: monthlyRecords.map((record) => ({
      month: record.yearMonth,
      kpiTitle: record.personalKpi.kpiName,
      achievementRate: record.achievementRate ?? null,
      activities: record.activities ?? null,
      obstacles: record.obstacles ?? null,
      efforts: record.efforts ?? null,
      evidenceComment: record.evidenceComment ?? null,
      submitted: !record.isDraft || Boolean(record.submittedAt),
    })),
    checkins: parsedCheckins,
    feedbacks: feedbacks.map((feedback) => ({
      date: isoDate(feedback.submittedAt ?? feedback.createdAt) ?? new Date().toISOString(),
      relationship: feedback.relationship,
      comment: feedback.overallComment ?? null,
    })),
    openActions,
    generatedAt: new Date().toISOString(),
  }
}

export async function requestCheckinAiFeedbackFromOpenAI(
  context: CheckinAiFeedbackContext,
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

  const requestPayload = normalizeCheckinAiFeedbackInput(context)
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
            name: 'checkin_ai_feedback',
            schema: CHECKIN_AI_FEEDBACK_JSON_SCHEMA,
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

    const validated = CheckinAiFeedbackResultSchema.safeParse(parsed)
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

export async function generateCheckinAiFeedback(
  params: {
    session: CheckinAiFeedbackSession
    input: unknown
  },
  options?: {
    db?: PrismaClient
    env?: Record<string, string | undefined>
    fetcher?: FetchLike
  }
): Promise<CheckinAiFeedbackResponse> {
  const db = options?.db ?? prisma
  const validated = CheckinAiFeedbackRequestSchema.safeParse(params.input)
  if (!validated.success) {
    throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0]?.message ?? '입력값을 확인해 주세요.')
  }

  const context = await loadCheckinAiFeedbackContext(
    {
      session: params.session,
      employeeId: validated.data.employeeId,
    },
    db
  )

  const fallbackResult = buildCheckinAiFeedbackFallbackResult(context)
  const sanitizedPayload = sanitizeAiPayload(
    normalizeCheckinAiFeedbackInput(context) as Record<string, unknown>
  )
  const env = readMidcheckCoachEnv(options?.env)
  const baseLogData = {
    requesterId: params.session.user.id,
    requestType: AIRequestType.MID_REVIEW_ASSIST,
    approvalStatus: AIApprovalStatus.APPROVED,
    approvedAt: new Date(),
    approvedById: params.session.user.id,
    sourceType: 'checkin-ai-feedback',
    sourceId: validated.data.employeeId,
    requestPayload: sanitizedPayload as never,
    piiMinimized: true,
  }

  if (!env.enabled || !env.apiKey) {
    const log = await db.aiRequestLog.create({
      data: {
        ...baseLogData,
        requestStatus: AIRequestStatus.DISABLED,
        model: env.coachModel,
        responsePayload: fallbackResult as never,
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
        ? 'AI 피드백을 생성하지 못했습니다. 잠시 후 다시 시도해 주세요.'
        : 'AI 기능이 비활성화되어 기본 가이드를 표시합니다.',
      result: fallbackResult,
    }
  }

  try {
    const aiResult = await requestCheckinAiFeedbackFromOpenAI(context, {
      env: options?.env,
      fetcher: options?.fetcher,
    })

    const log = await db.aiRequestLog.create({
      data: {
        ...baseLogData,
        requestStatus: AIRequestStatus.SUCCESS,
        provider: 'OPENAI',
        model: aiResult.model,
        responsePayload: aiResult.result as never,
        approvedPayload: aiResult.result as never,
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
    console.warn('[checkin-ai-feedback]', errorCode, errorMessage)

    const fallback = buildCheckinAiFeedbackFallbackResult(context, errorMessage)

    const log = await db.aiRequestLog.create({
      data: {
        ...baseLogData,
        requestStatus: AIRequestStatus.FALLBACK,
        provider: 'OPENAI',
        model: env.coachModel,
        responsePayload: fallback as never,
        approvedPayload: fallback as never,
        errorCode,
        errorMessage,
      },
    })

    return {
      requestLogId: log.id,
      source: 'fallback',
      fallbackReason: 'AI 피드백을 생성하지 못했습니다. 잠시 후 다시 시도해 주세요.',
      result: fallback,
    }
  }
}
