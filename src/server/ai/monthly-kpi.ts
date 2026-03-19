import { AIRequestType } from '@prisma/client'
import { generateAiAssist } from '@/lib/ai-assist'

type JsonRecord = Record<string, unknown>

type MonthlyKpiAiParams = {
  requesterId: string
  sourceId?: string
  payload: JsonRecord
}

export function generateMonthlyPerformanceSummary(params: MonthlyKpiAiParams) {
  return generateAiAssist({
    requesterId: params.requesterId,
    requestType: AIRequestType.KPI_ASSIST,
    sourceType: 'MonthlyPerformanceSummary',
    sourceId: params.sourceId,
    payload: params.payload,
  })
}

export function explainRiskyKpi(params: MonthlyKpiAiParams) {
  return generateAiAssist({
    requesterId: params.requesterId,
    requestType: AIRequestType.KPI_ASSIST,
    sourceType: 'MonthlyRiskExplanation',
    sourceId: params.sourceId,
    payload: params.payload,
  })
}

export function generateManagerReviewDraft(params: MonthlyKpiAiParams) {
  return generateAiAssist({
    requesterId: params.requesterId,
    requestType: AIRequestType.KPI_ASSIST,
    sourceType: 'MonthlyManagerReview',
    sourceId: params.sourceId,
    payload: params.payload,
  })
}

export function summarizeMonthlyEvidence(params: MonthlyKpiAiParams) {
  return generateAiAssist({
    requesterId: params.requesterId,
    requestType: AIRequestType.KPI_ASSIST,
    sourceType: 'MonthlyEvidenceSummary',
    sourceId: params.sourceId,
    payload: params.payload,
  })
}

export function generateMonthlyRetrospective(params: MonthlyKpiAiParams) {
  return generateAiAssist({
    requesterId: params.requesterId,
    requestType: AIRequestType.KPI_ASSIST,
    sourceType: 'MonthlyRetrospective',
    sourceId: params.sourceId,
    payload: params.payload,
  })
}

export function suggestMonthlyCheckinAgenda(params: MonthlyKpiAiParams) {
  return generateAiAssist({
    requesterId: params.requesterId,
    requestType: AIRequestType.KPI_ASSIST,
    sourceType: 'MonthlyCheckinAgenda',
    sourceId: params.sourceId,
    payload: params.payload,
  })
}

export function summarizeMonthlyEvaluationEvidence(params: MonthlyKpiAiParams) {
  return generateAiAssist({
    requesterId: params.requesterId,
    requestType: AIRequestType.KPI_ASSIST,
    sourceType: 'MonthlyEvaluationEvidence',
    sourceId: params.sourceId,
    payload: params.payload,
  })
}
