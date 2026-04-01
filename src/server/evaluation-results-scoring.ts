export type WeightedScoreRow = {
  score: number
  weight?: number
}

export function weightedAverage(rows: WeightedScoreRow[]) {
  if (!rows.length) return null

  const numerator = rows.reduce((sum, row) => sum + row.score * (row.weight ?? 0), 0)
  const denominator = rows.reduce((sum, row) => sum + (row.weight ?? 0), 0)

  if (denominator <= 0) {
    return roundToSingle(rows.reduce((sum, row) => sum + row.score, 0) / rows.length)
  }

  return roundToSingle(numerator / denominator)
}

export function toWeightedScoredRows<T extends { finalScore?: number | null; weight?: number | null }>(
  rows: T[]
) {
  return rows
    .filter((row): row is T & { finalScore: number } => typeof row.finalScore === 'number')
    .map((row) => ({
      score: row.finalScore,
      weight: row.weight ?? undefined,
    }))
}

export function calculateEffectiveTotalScore(params: {
  performanceRows: WeightedScoreRow[]
  competencyRows: WeightedScoreRow[]
  fallback: number
}) {
  return weightedAverage([...params.performanceRows, ...params.competencyRows]) ?? params.fallback
}

function roundToSingle(value: number) {
  return Math.round(value * 10) / 10
}
