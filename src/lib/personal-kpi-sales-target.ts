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
}): string | undefined {
  const raw = params.formTargetAmount.replace(/,/g, '').trim()
  const isAutoMode = !!params.orgKpiTargetAmount && !raw
  if (isAutoMode) return undefined
  if (!raw) return '매출 목표액을 입력하거나, 매출 목표액이 설정된 조직 KPI를 연결해 주세요.'
  if (!/^\d+$/.test(raw)) return '매출 목표액은 숫자로만 입력해 주세요.'
  if (BigInt(raw) <= BigInt(0)) return '매출 목표액은 1 이상이어야 합니다.'
  return undefined
}
