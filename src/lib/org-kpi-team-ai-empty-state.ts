export type OrgKpiTeamAiEmptyStateFlags = {
  businessPlanMissing: boolean
  recommendationMissing: boolean
  reviewMissing: boolean
}

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
