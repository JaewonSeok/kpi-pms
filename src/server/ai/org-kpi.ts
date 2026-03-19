import { AIRequestType } from '@prisma/client'
import { generateAiAssist } from '@/lib/ai-assist'

type JsonRecord = Record<string, unknown>

type OrgKpiAiParams = {
  requesterId: string
  sourceId?: string
  payload: JsonRecord
}

export function generateOrgKpiDraft(params: OrgKpiAiParams) {
  return generateAiAssist({
    requesterId: params.requesterId,
    requestType: AIRequestType.KPI_ASSIST,
    sourceType: 'OrgKpiDraft',
    sourceId: params.sourceId,
    payload: params.payload,
  })
}

export function improveOrgKpiWording(params: OrgKpiAiParams) {
  return generateAiAssist({
    requesterId: params.requesterId,
    requestType: AIRequestType.KPI_ASSIST,
    sourceType: 'OrgKpiWording',
    sourceId: params.sourceId,
    payload: params.payload,
  })
}

export function evaluateSmartCriteria(params: OrgKpiAiParams) {
  return generateAiAssist({
    requesterId: params.requesterId,
    requestType: AIRequestType.KPI_ASSIST,
    sourceType: 'OrgKpiSmart',
    sourceId: params.sourceId,
    payload: params.payload,
  })
}

export function detectDuplicateOrgKpis(params: OrgKpiAiParams) {
  return generateAiAssist({
    requesterId: params.requesterId,
    requestType: AIRequestType.KPI_ASSIST,
    sourceType: 'OrgKpiDuplicate',
    sourceId: params.sourceId,
    payload: params.payload,
  })
}

export function suggestCascadeAlignment(params: OrgKpiAiParams) {
  return generateAiAssist({
    requesterId: params.requesterId,
    requestType: AIRequestType.KPI_ASSIST,
    sourceType: 'OrgKpiAlignment',
    sourceId: params.sourceId,
    payload: params.payload,
  })
}

export function summarizeKpiOperationalRisk(params: OrgKpiAiParams) {
  return generateAiAssist({
    requesterId: params.requesterId,
    requestType: AIRequestType.KPI_ASSIST,
    sourceType: 'OrgKpiOperationalRisk',
    sourceId: params.sourceId,
    payload: params.payload,
  })
}

export function draftMonthlyExecutionComment(params: OrgKpiAiParams) {
  return generateAiAssist({
    requesterId: params.requesterId,
    requestType: AIRequestType.KPI_ASSIST,
    sourceType: 'OrgKpiMonthlyComment',
    sourceId: params.sourceId,
    payload: params.payload,
  })
}
