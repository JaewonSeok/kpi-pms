export type SalesBannerInput = {
  jobCategory: 'GENERAL' | 'SALES'
  createDisabledReason: string | undefined
  mineItems: Array<{ goalType: string; persistedStatus: string }>
  orgKpiOptions: Array<{ targetAmount: string | null }>
}

export function shouldShowSalesBanner({
  jobCategory,
  createDisabledReason,
  mineItems,
  orgKpiOptions,
}: SalesBannerInput): boolean {
  if (jobCategory !== 'SALES') return false
  if (createDisabledReason) return false
  if (mineItems.some((i) => i.goalType === 'SALES_REVENUE' && i.persistedStatus !== 'ARCHIVED')) return false
  if (!orgKpiOptions.some((o) => o.targetAmount != null && Number(o.targetAmount) > 0)) return false
  return true
}

export function findSalesLinkedOrgKpiId(
  options: Array<{ id: string; deptId: string; targetAmount: string | null }>,
  actorDeptId?: string | null,
): string {
  const positive = options.filter((o) => o.targetAmount != null && Number(o.targetAmount) > 0)
  if (actorDeptId) {
    const sameTeam = positive.find((o) => o.deptId === actorDeptId)
    if (sameTeam) return sameTeam.id
  }
  return positive[0]?.id ?? ''
}
