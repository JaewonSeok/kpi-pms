export function resolveTargetAmount(kpi: {
  targetAmount: bigint | null
  linkedOrgKpi?: { targetAmount: bigint | null } | null
}): bigint | null {
  return kpi.targetAmount ?? kpi.linkedOrgKpi?.targetAmount ?? null
}
