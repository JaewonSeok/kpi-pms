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

  const targetValueE = rawE ?? legacy
  const targetValueT = rawT ?? targetValueE
  const targetValueS = rawS ?? targetValueE

  return {
    targetValue: targetValueE,
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
  return [
    `T ${formatMetric(resolved.targetValueT)}${unitSuffix}`,
    `E ${formatMetric(resolved.targetValueE)}${unitSuffix}`,
    `S ${formatMetric(resolved.targetValueS)}${unitSuffix}`,
  ].join(' / ')
}

export function buildOrgKpiTargetValuePersistence(input: {
  targetValueT: number
  targetValueE: number
  targetValueS: number
}) {
  return {
    targetValue: input.targetValueE,
    targetValueT: input.targetValueT,
    targetValueE: input.targetValueE,
    targetValueS: input.targetValueS,
  }
}
