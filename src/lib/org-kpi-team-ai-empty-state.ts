export type OrgKpiTeamAiEmptyStateFlags = {
  businessPlanMissing: boolean
  recommendationMissing: boolean
  reviewMissing: boolean
}

export type OrgKpiTeamAiResultMode =
  | 'BUSINESS_PLAN_EMPTY'
  | 'RECOMMENDATION_EMPTY'
  | 'REVIEW_EMPTY'
  | 'TRUE_FALLBACK'
  | 'NORMAL_RESULT'

export function getOrgKpiTeamAiEmptyStateFlags(args: {
  businessPlan: unknown | null
  recommendationSetCount: number
  reviewRunCount: number
}): OrgKpiTeamAiEmptyStateFlags {
  return {
    businessPlanMissing: !args.businessPlan,
    recommendationMissing: args.recommendationSetCount === 0,
    reviewMissing: args.reviewRunCount === 0,
  }
}

export function resolveOrgKpiTeamAiResultMode(args: {
  businessPlan: unknown | null
  recommendationSetCount: number
  reviewRunCount: number
  hasTrueFallback: boolean
}): OrgKpiTeamAiResultMode {
  if (args.hasTrueFallback) {
    return 'TRUE_FALLBACK'
  }

  if (!args.businessPlan) {
    return 'BUSINESS_PLAN_EMPTY'
  }

  if (args.recommendationSetCount === 0) {
    return 'RECOMMENDATION_EMPTY'
  }

  if (args.reviewRunCount === 0) {
    return 'REVIEW_EMPTY'
  }

  return 'NORMAL_RESULT'
}
