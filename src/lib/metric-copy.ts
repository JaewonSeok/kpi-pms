export type MetricUnit = '명' | '건' | '개'

export const INLINE_TEXT_SEPARATOR = ' · '
export const HIERARCHY_TEXT_SEPARATOR = ' → '

function normalizeMetricValue(value?: number | null) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function isNonEmptyPart(value?: string | null) {
  return typeof value === 'string' && value.trim().length > 0
}

export function formatCountWithUnit(value?: number | null, unit: MetricUnit = '건') {
  return `${normalizeMetricValue(value)}${unit}`
}

export function formatEntityCount(params: {
  label: string
  value?: number | null
  unit?: MetricUnit
}) {
  return `${params.label} ${formatCountWithUnit(params.value, params.unit ?? '건')}`
}

export function formatExplicitRatio(params: {
  numeratorLabel: string
  numeratorValue?: number | null
  numeratorUnit?: MetricUnit
  denominatorLabel: string
  denominatorValue?: number | null
  denominatorUnit?: MetricUnit
  separator?: string
}) {
  const separator = params.separator ?? ' / '
  return [
    `${params.numeratorLabel} ${formatCountWithUnit(params.numeratorValue, params.numeratorUnit ?? '건')}`,
    `${params.denominatorLabel} ${formatCountWithUnit(
      params.denominatorValue,
      params.denominatorUnit ?? '건'
    )}`,
  ].join(separator)
}

export function formatRateBaseCopy(baseLabel: string) {
  return `${baseLabel} 기준`
}

export function joinInlineParts(parts: Array<string | null | undefined>) {
  return parts.filter(isNonEmptyPart).join(INLINE_TEXT_SEPARATOR)
}

export function joinHierarchyParts(parts: Array<string | null | undefined>) {
  return parts.filter(isNonEmptyPart).join(HIERARCHY_TEXT_SEPARATOR)
}
