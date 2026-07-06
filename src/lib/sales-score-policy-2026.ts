export const SALES_SCORE_POLICY_YEAR = 2026

// Score band defined in basis points (bp): 100% = 10_000 bp.
// Bands are checked highest-first; the first matching band wins.
// 2027 note: if bands change, add SALES_SCORE_BANDS_2027 in the same structure
// and pass the year-appropriate constant to calcSalesScore.
export type SalesScoreBand = {
  minBp: number // inclusive
  score: 70 | 80 | 90 | 100 | 110
}

export const SALES_SCORE_BANDS_2026: readonly SalesScoreBand[] = [
  { minBp: 11000, score: 110 }, // >= 110% (capped — 120% or beyond also yields 110)
  { minBp: 10000, score: 100 }, // >= 100% and < 110%
  { minBp:  9000, score:  90 }, // >=  90% and < 100%
  { minBp:  8000, score:  80 }, // >=  80% and <  90%
  { minBp:      0, score:  70 }, // <   80% (includes actual = 0)
] as const

export function calcSalesScore(
  targetAmount: bigint,
  actualAmount: bigint,
  bands: readonly SalesScoreBand[] = SALES_SCORE_BANDS_2026,
): 70 | 80 | 90 | 100 | 110 {
  if (targetAmount <= BigInt(0)) {
    throw new Error(
      `calcSalesScore: targetAmount must be positive, got ${targetAmount}`,
    )
  }

  // BigInt integer division truncates toward zero (floors for positive quotients).
  // 109.99% → (10999 * 10000) / 10000 = 10999 bp — correctly below the 110% band.
  const achievedBp = Number((actualAmount * BigInt(10000)) / targetAmount)

  for (const band of bands) {
    if (achievedBp >= band.minBp) {
      return band.score
    }
  }

  // Fallback: only reached when actualAmount < 0 (achievedBp < 0, below minBp 0).
  // Treated as 70 (minimum score).
  return 70
}
