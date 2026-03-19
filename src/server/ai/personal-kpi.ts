import { AIRequestType } from '@prisma/client'
import { generateAiAssist } from '@/lib/ai-assist'

type JsonRecord = Record<string, unknown>

type PersonalKpiAiParams = {
  requesterId: string
  sourceId?: string
  payload: JsonRecord
}

export function generatePersonalKpiDraft(params: PersonalKpiAiParams) {
  return generateAiAssist({
    requesterId: params.requesterId,
    requestType: AIRequestType.KPI_ASSIST,
    sourceType: 'PersonalKpiDraft',
    sourceId: params.sourceId,
    payload: params.payload,
  })
}

export function improvePersonalKpiWording(params: PersonalKpiAiParams) {
  return generateAiAssist({
    requesterId: params.requesterId,
    requestType: AIRequestType.KPI_ASSIST,
    sourceType: 'PersonalKpiWording',
    sourceId: params.sourceId,
    payload: params.payload,
  })
}

export function evaluatePersonalSmartCriteria(params: PersonalKpiAiParams) {
  return generateAiAssist({
    requesterId: params.requesterId,
    requestType: AIRequestType.KPI_ASSIST,
    sourceType: 'PersonalKpiSmart',
    sourceId: params.sourceId,
    payload: params.payload,
  })
}

export function suggestWeightAllocation(params: PersonalKpiAiParams) {
  return generateAiAssist({
    requesterId: params.requesterId,
    requestType: AIRequestType.KPI_ASSIST,
    sourceType: 'PersonalKpiWeight',
    sourceId: params.sourceId,
    payload: params.payload,
  })
}

export function suggestOrgKpiAlignment(params: PersonalKpiAiParams) {
  return generateAiAssist({
    requesterId: params.requesterId,
    requestType: AIRequestType.KPI_ASSIST,
    sourceType: 'PersonalKpiAlignment',
    sourceId: params.sourceId,
    payload: params.payload,
  })
}

export function detectDuplicatePersonalKpis(params: PersonalKpiAiParams) {
  return generateAiAssist({
    requesterId: params.requesterId,
    requestType: AIRequestType.KPI_ASSIST,
    sourceType: 'PersonalKpiDuplicate',
    sourceId: params.sourceId,
    payload: params.payload,
  })
}

export function summarizeReviewerRisks(params: PersonalKpiAiParams) {
  return generateAiAssist({
    requesterId: params.requesterId,
    requestType: AIRequestType.KPI_ASSIST,
    sourceType: 'PersonalKpiReviewerRisk',
    sourceId: params.sourceId,
    payload: params.payload,
  })
}

export function draftPersonalMonthlyComment(params: PersonalKpiAiParams) {
  return generateAiAssist({
    requesterId: params.requesterId,
    requestType: AIRequestType.KPI_ASSIST,
    sourceType: 'PersonalKpiMonthlyComment',
    sourceId: params.sourceId,
    payload: params.payload,
  })
}
