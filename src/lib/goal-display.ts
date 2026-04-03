import type { KpiStatus } from '@prisma/client'

export function formatGoalApprovalStatus(status: KpiStatus | null | undefined) {
  if (status === 'CONFIRMED') return '승인 완료'
  if (status === 'ARCHIVED') return '보관'
  if (status === 'DRAFT') return '승인 요청 전'
  return '미확정'
}

export function formatGoalWeightLabel(weight: number | null | undefined) {
  return typeof weight === 'number' ? `가중치 ${weight}%` : '가중치 미설정'
}
