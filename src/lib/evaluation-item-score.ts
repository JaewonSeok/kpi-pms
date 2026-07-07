import { calcSalesScore } from '@/lib/sales-score-policy-2026'
import { calcPdcaScore } from '@/lib/utils'

export type ResolveItemScoreInput = {
  goalType: string
  kpiType: string
  targetAmount: bigint | null
  salesActualAmount: bigint | null
  quantScore: number | null | undefined
  planScore: number | null | undefined
  doScore: number | null | undefined
  checkScore: number | null | undefined
  actScore: number | null | undefined
}

export type ResolveItemScoreResult =
  | { ok: true; score: number }
  | { ok: false; code: string; message: string }

export function resolveItemScore(input: ResolveItemScoreInput): ResolveItemScoreResult {
  if (input.goalType === 'SALES_REVENUE') {
    if (input.salesActualAmount === null || input.targetAmount === null) {
      return {
        ok: false,
        code: 'SALES_REVENUE_RECORD_REQUIRED',
        message: '매출 실적이 입력되지 않아 평가를 제출할 수 없습니다.',
      }
    }
    try {
      const score = calcSalesScore(input.targetAmount, input.salesActualAmount)
      return { ok: true, score }
    } catch {
      return {
        ok: false,
        code: 'SALES_REVENUE_SCORE_CALC_FAILED',
        message: '매출 점수 산정에 실패했습니다. 실적 금액을 확인해 주세요.',
      }
    }
  }
  if (input.kpiType === 'QUANTITATIVE') {
    return { ok: true, score: input.quantScore || 0 }
  }
  return {
    ok: true,
    score: calcPdcaScore(
      input.planScore || 0,
      input.doScore || 0,
      input.checkScore || 0,
      input.actScore || 0,
    ),
  }
}
