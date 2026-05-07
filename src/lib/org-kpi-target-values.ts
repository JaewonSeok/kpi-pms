type OrgKpiTargetValueInput = {
  targetValue?: number | null
  targetValueT?: number | null
  targetValueE?: number | null
  targetValueS?: number | null
}

function normalizeNumericValue(value?: number | null) {
  return typeof value === 'number' && Number.isFinite(value) ? Number(value) : undefined
}

export function resolveOrgKpiTargetValues(input: OrgKpiTargetValueInput) {
  const legacy = normalizeNumericValue(input.targetValue)
  const rawT = normalizeNumericValue(input.targetValueT)
  const rawE = normalizeNumericValue(input.targetValueE)
  const rawS = normalizeNumericValue(input.targetValueS)

  if ([legacy, rawT, rawE, rawS].every((value) => value === undefined)) {
    return {
      targetValue: undefined,
      targetValueT: undefined,
      targetValueE: undefined,
      targetValueS: undefined,
    }
  }

  const hasExplicitBand = rawT !== undefined || rawE !== undefined || rawS !== undefined
  const targetValueT = rawT ?? legacy
  const targetValueE = hasExplicitBand ? rawE : undefined
  const targetValueS = hasExplicitBand ? rawS : undefined
  const targetValue = rawE ?? targetValueT ?? rawS

  return {
    targetValue,
    targetValueT,
    targetValueE,
    targetValueS,
  }
}

function formatMetric(value?: number) {
  if (value === undefined) {
    return '-'
  }

  return Number.isInteger(value) ? new Intl.NumberFormat('ko-KR').format(value) : `${value}`
}

export function formatOrgKpiTargetValues(input: OrgKpiTargetValueInput & { unit?: string | null }) {
  const resolved = resolveOrgKpiTargetValues(input)

  if (
    resolved.targetValueT === undefined &&
    resolved.targetValueE === undefined &&
    resolved.targetValueS === undefined
  ) {
    return '-'
  }

  const unitSuffix = input.unit ? ` ${input.unit}` : ''
  const segments = [
    resolved.targetValueT !== undefined ? `T ${formatMetric(resolved.targetValueT)}${unitSuffix}` : null,
    resolved.targetValueE !== undefined ? `E ${formatMetric(resolved.targetValueE)}${unitSuffix}` : null,
    resolved.targetValueS !== undefined ? `S ${formatMetric(resolved.targetValueS)}${unitSuffix}` : null,
  ].filter((segment): segment is string => Boolean(segment))

  return segments.join(' / ')
}

export function buildOrgKpiTargetValuePersistence(input: {
  targetValueT: number
  targetValueE?: number | null
  targetValueS?: number | null
}) {
  const targetValueT = normalizeNumericValue(input.targetValueT)
  const targetValueE = normalizeNumericValue(input.targetValueE)
  const targetValueS = normalizeNumericValue(input.targetValueS)

  return {
    targetValue: targetValueE ?? targetValueT ?? null,
    targetValueT: targetValueT ?? null,
    targetValueE: targetValueE ?? null,
    targetValueS: targetValueS ?? null,
  }
}
