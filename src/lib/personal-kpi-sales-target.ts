export function resolveSalesTargetMode(params: {
  goalType: string
  formTargetAmount: string
  orgKpiTargetAmount: string | null
}): 'auto' | 'manual' {
  if (params.goalType !== 'SALES_REVENUE') return 'manual'
  if (!params.orgKpiTargetAmount) return 'manual'
  if (params.formTargetAmount.replace(/,/g, '').trim()) return 'manual'
  return 'auto'
}

export function validateSalesKpiTargetAmount(params: {
  formTargetAmount: string
  orgKpiTargetAmount: string | null
  useOrgKpiAmount: boolean
}): string | undefined {
  if (params.useOrgKpiAmount) {
    if (!params.orgKpiTargetAmount) return '팀 KPI 금액이 설정되지 않았습니다. 목표액을 직접 입력해 주세요.'
    return undefined
  }
  const raw = params.formTargetAmount.replace(/,/g, '').trim()
  if (!raw) return '매출 목표액을 입력해 주세요.'
  if (!/^\d+$/.test(raw)) return '매출 목표액은 숫자로만 입력해 주세요.'
  if (BigInt(raw) <= BigInt(0)) return '매출 목표액은 1 이상이어야 합니다.'
  return undefined
}
