import { AIRequestType } from '@prisma/client'
import { generateAiAssist } from '@/lib/ai-assist'

type JsonRecord = Record<string, unknown>

type AdminOpsAiParams = {
  requesterId: string
  sourceId?: string
  payload: JsonRecord
}

export function summarizeOpsStatus(params: AdminOpsAiParams) {
  return generateAiAssist({
    requesterId: params.requesterId,
    requestType: AIRequestType.KPI_ASSIST,
    sourceType: 'AdminOpsStatusSummary',
    sourceId: params.sourceId,
    payload: params.payload,
  })
}

export function summarizeIncidentPatterns(params: AdminOpsAiParams) {
  return generateAiAssist({
    requesterId: params.requesterId,
    requestType: AIRequestType.KPI_ASSIST,
    sourceType: 'AdminOpsIncidentPatterns',
    sourceId: params.sourceId,
    payload: params.payload,
  })
}

export function generateDailyOpsReport(params: AdminOpsAiParams) {
  return generateAiAssist({
    requesterId: params.requesterId,
    requestType: AIRequestType.KPI_ASSIST,
    sourceType: 'AdminOpsDailyReport',
    sourceId: params.sourceId,
    payload: params.payload,
  })
}

export function prioritizeOperationalRisks(params: AdminOpsAiParams) {
  return generateAiAssist({
    requesterId: params.requesterId,
    requestType: AIRequestType.KPI_ASSIST,
    sourceType: 'AdminOpsRiskPrioritization',
    sourceId: params.sourceId,
    payload: params.payload,
  })
}
