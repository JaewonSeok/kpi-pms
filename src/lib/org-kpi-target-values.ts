type OrgKpiTargetPrimitive = number | string | null | undefined

type OrgKpiTargetValueInput = {
  targetValue?: OrgKpiTargetPrimitive
  targetValueT?: OrgKpiTargetPrimitive
  targetValueE?: OrgKpiTargetPrimitive
  targetValueS?: OrgKpiTargetPrimitive
}

function normalizeTargetValue(value?: OrgKpiTargetPrimitive) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length ? trimmed : undefined
  }

  return undefined
}

export function resolveOrgKpiTargetValues(input: OrgKpiTargetValueInput) {
  const legacy = normalizeTargetValue(input.targetValue)
  const rawT = normalizeTargetValue(input.targetValueT)
  const rawE = normalizeTargetValue(input.targetValueE)
  const rawS = normalizeTargetValue(input.targetValueS)

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

function formatMetric(value?: string) {
  if (value === undefined) {
    return '-'
  }
  return value
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

  const unitSuffix = input.unit ? `${input.unit}` : ''
  const segments = [
    resolved.targetValueT !== undefined ? `T ${formatMetric(resolved.targetValueT)}${unitSuffix}` : null,
    resolved.targetValueE !== undefined ? `E ${formatMetric(resolved.targetValueE)}${unitSuffix}` : null,
    resolved.targetValueS !== undefined ? `S ${formatMetric(resolved.targetValueS)}${unitSuffix}` : null,
  ].filter((segment): segment is string => Boolean(segment))

  return segments.join(' / ')
}

export function buildOrgKpiTargetValuePersistence(input: {
  targetValueT: OrgKpiTargetPrimitive
  targetValueE?: OrgKpiTargetPrimitive
  targetValueS?: OrgKpiTargetPrimitive
}) {
  const targetValueT = normalizeTargetValue(input.targetValueT)
  const targetValueE = normalizeTargetValue(input.targetValueE)
  const targetValueS = normalizeTargetValue(input.targetValueS)

  return {
    targetValue: targetValueE ?? targetValueT ?? null,
    targetValueT: targetValueT ?? null,
    targetValueE: targetValueE ?? null,
    targetValueS: targetValueS ?? null,
  }
}
