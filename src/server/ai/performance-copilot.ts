import { AIRequestType } from '@prisma/client'
import { generateAiAssist } from '../../lib/ai-assist'

type JsonRecord = Record<string, unknown>

type BaseParams = {
  requesterId: string
  sourceId?: string
  payload: JsonRecord
}

type GoalParams = BaseParams & {
  scope?: 'org' | 'personal'
}

type ReviewDraftParams = BaseParams & {
  context?: 'monthly' | 'evaluation'
}

function kpiAssist(requesterId: string, sourceType: string, sourceId: string | undefined, payload: JsonRecord) {
  return generateAiAssist({
    requesterId,
    requestType: AIRequestType.KPI_ASSIST,
    sourceType,
    sourceId,
    payload,
  })
}

export function generateGoalDraft(params: GoalParams) {
  return kpiAssist(
    params.requesterId,
    params.scope === 'personal' ? 'PersonalKpiDraft' : 'OrgKpiDraft',
    params.sourceId,
    params.payload
  )
}

export function improveGoalWording(params: GoalParams) {
  return kpiAssist(
    params.requesterId,
    params.scope === 'personal' ? 'PersonalKpiWording' : 'OrgKpiWording',
    params.sourceId,
    params.payload
  )
}

export function evaluateSmartCriteria(params: GoalParams) {
  return kpiAssist(
    params.requesterId,
    params.scope === 'personal' ? 'PersonalKpiSmart' : 'OrgKpiSmart',
    params.sourceId,
    params.payload
  )
}

export function summarizeMonthlyPerformance(params: BaseParams) {
  return kpiAssist(params.requesterId, 'MonthlyPerformanceSummary', params.sourceId, params.payload)
}

export function generateManagerReviewDraft(params: ReviewDraftParams) {
  if (params.context === 'evaluation') {
    return generateAiAssist({
      requesterId: params.requesterId,
      requestType: AIRequestType.EVAL_COMMENT_DRAFT,
      sourceType: 'EvaluationReviewDraft',
      sourceId: params.sourceId,
      payload: params.payload,
    })
  }

  return kpiAssist(params.requesterId, 'MonthlyManagerReview', params.sourceId, params.payload)
}

export function suggestCheckinAgenda(params: BaseParams) {
  return kpiAssist(params.requesterId, 'MonthlyCheckinAgenda', params.sourceId, params.payload)
}

export function summarizeEvidence(params: BaseParams) {
  return kpiAssist(params.requesterId, 'MonthlyEvidenceSummary', params.sourceId, params.payload)
}

export function recommend360Reviewers(params: BaseParams) {
  return kpiAssist(params.requesterId, 'Feedback360ReviewerRecommendation', params.sourceId, params.payload)
}

export function summarize360Themes(params: BaseParams) {
  return kpiAssist(params.requesterId, 'Feedback360ThemeSummary', params.sourceId, params.payload)
}

export function detectCarelessReviews(params: BaseParams) {
  return kpiAssist(params.requesterId, 'Feedback360CarelessReview', params.sourceId, params.payload)
}

export function suggestDevelopmentPlan(params: BaseParams) {
  return kpiAssist(params.requesterId, 'Feedback360DevelopmentPlan', params.sourceId, params.payload)
}

export function suggestGrowthCopilot(params: BaseParams) {
  return generateAiAssist({
    requesterId: params.requesterId,
    requestType: AIRequestType.GROWTH_PLAN,
    sourceType: 'Feedback360GrowthCopilot',
    sourceId: params.sourceId,
    payload: params.payload,
  })
}

export function summarizeCalibrationRisk(params: BaseParams) {
  return kpiAssist(params.requesterId, 'CalibrationRiskSummary', params.sourceId, params.payload)
}

export function explainCompensationDecision(params: BaseParams) {
  return kpiAssist(params.requesterId, 'CompensationDecisionExplanation', params.sourceId, params.payload)
}
