type SalesTargetCheck = { valid: true } | { valid: false; code: string; message: string }

export function checkSalesKpiTargetSource(params: {
  personalTargetAmount: bigint | null
  linkedOrgKpiId: string | null
  orgKpiTargetAmount: bigint | null
}): SalesTargetCheck {
  if (params.personalTargetAmount !== null) return { valid: true }

  if (!params.linkedOrgKpiId) {
    return {
      valid: false,
      code: 'SALES_KPI_NO_TARGET',
      message: '매출 목표액을 직접 입력하거나, 매출 목표가 설정된 조직 KPI를 연결해야 합니다.',
    }
  }

  if (params.orgKpiTargetAmount === null || params.orgKpiTargetAmount <= BigInt(0)) {
    return {
      valid: false,
      code: 'ORG_KPI_NO_TARGET_AMOUNT',
      message: '연결한 조직 KPI에 매출 목표액이 설정되어 있지 않습니다.',
    }
  }

  return { valid: true }
}
