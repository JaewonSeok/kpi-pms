const WEIGHT_FORMATTER = new Intl.NumberFormat('ko-KR', {
  maximumFractionDigits: 2,
})

const normalizeWeightNumber = (value?: number | string | null) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim().replace(/%$/, '').trim()
  if (!normalized) {
    return null
  }

  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

const roundWeight = (value: number) => Math.round(value * 100) / 100

export function formatOrgKpiWeight(value?: number | string | null) {
  if (value === undefined || value === null) {
    return '-'
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) {
      return '-'
    }
    if (trimmed.endsWith('%')) {
      return trimmed
    }

    const numericValue = normalizeWeightNumber(trimmed)
    return numericValue === null ? trimmed : `${WEIGHT_FORMATTER.format(roundWeight(numericValue))}%`
  }

  return Number.isFinite(value) ? `${WEIGHT_FORMATTER.format(roundWeight(value))}%` : '-'
}

export type OrgKpiWeightStatus = 'normal' | 'under' | 'over'

export type OrgKpiWeightSummary = {
  totalWeight: number
  status: OrgKpiWeightStatus
  remainingWeight: number
  excessWeight: number
  countedItemCount: number
}

export function calculateOrgKpiWeightSummary(items: Array<{ weight?: number | string | null }>) {
  const totalWeight = roundWeight(
    items.reduce((sum, item) => {
      const weight = normalizeWeightNumber(item.weight)
      return weight === null ? sum : sum + weight
    }, 0)
  )

  const difference = roundWeight(totalWeight - 100)
  const tolerance = 0.01

  if (Math.abs(difference) <= tolerance) {
    return {
      totalWeight: 100,
      status: 'normal' as const,
      remainingWeight: 0,
      excessWeight: 0,
      countedItemCount: items.filter((item) => normalizeWeightNumber(item.weight) !== null).length,
    }
  }

  if (difference < 0) {
    return {
      totalWeight,
      status: 'under' as const,
      remainingWeight: roundWeight(Math.abs(difference)),
      excessWeight: 0,
      countedItemCount: items.filter((item) => normalizeWeightNumber(item.weight) !== null).length,
    }
  }

  return {
    totalWeight,
    status: 'over' as const,
    remainingWeight: 0,
    excessWeight: roundWeight(difference),
    countedItemCount: items.filter((item) => normalizeWeightNumber(item.weight) !== null).length,
  }
}
