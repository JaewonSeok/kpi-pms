import { AIRequestType } from '@prisma/client'
import { generateAiAssist } from '@/lib/ai-assist'

type JsonRecord = Record<string, unknown>

type NotificationOpsAiParams = {
  requesterId: string
  sourceId?: string
  payload: JsonRecord
}

export function summarizeNotificationOps(params: NotificationOpsAiParams) {
  return generateAiAssist({
    requesterId: params.requesterId,
    requestType: AIRequestType.KPI_ASSIST,
    sourceType: 'NotificationOpsSummary',
    sourceId: params.sourceId,
    payload: params.payload,
  })
}

export function summarizeDeadLetterPatterns(params: NotificationOpsAiParams) {
  return generateAiAssist({
    requesterId: params.requesterId,
    requestType: AIRequestType.KPI_ASSIST,
    sourceType: 'NotificationDeadLetterPatterns',
    sourceId: params.sourceId,
    payload: params.payload,
  })
}

export function validateTemplateVariablesWithAi(params: NotificationOpsAiParams) {
  return generateAiAssist({
    requesterId: params.requesterId,
    requestType: AIRequestType.KPI_ASSIST,
    sourceType: 'NotificationTemplateValidation',
    sourceId: params.sourceId,
    payload: params.payload,
  })
}

export function generateOpsReportDraft(params: NotificationOpsAiParams) {
  return generateAiAssist({
    requesterId: params.requesterId,
    requestType: AIRequestType.KPI_ASSIST,
    sourceType: 'NotificationOpsReport',
    sourceId: params.sourceId,
    payload: params.payload,
  })
}
