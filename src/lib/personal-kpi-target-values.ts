import type { Prisma } from '@prisma/client'

type PersonalKpiTargetValueInput = {
  targetValue?: number | string | null
  targetValueT?: number | string | null
  targetValueE?: number | string | null
  targetValueS?: number | string | null
  copyMetadata?: unknown
}

type PersonalKpiTargetValueMetadata = {
  targetValueT?: number | string | null
  targetValueE?: number | string | null
  targetValueS?: number | string | null
}

function normalizeNumericValue(value?: number | string | null) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Number(value)
  }

  if (typeof value === 'string' && value.trim().length) {
    const parsed = Number(value.trim())
    return Number.isFinite(parsed) ? parsed : undefined
  }

  return undefined
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

function readTargetValueMetadata(copyMetadata: unknown): PersonalKpiTargetValueMetadata {
  const metadata = asRecord(copyMetadata)
  const targetValues = asRecord(metadata?.personalTargetValues)

  return {
    targetValueT: targetValues?.targetValueT as number | string | null | undefined,
    targetValueE: targetValues?.targetValueE as number | string | null | undefined,
    targetValueS: targetValues?.targetValueS as number | string | null | undefined,
  }
}

export function resolvePersonalKpiTargetValues(input: PersonalKpiTargetValueInput) {
  const metadataValues = readTargetValueMetadata(input.copyMetadata)
  const legacy = normalizeNumericValue(input.targetValue)
  const targetValueT = normalizeNumericValue(input.targetValueT) ?? normalizeNumericValue(metadataValues.targetValueT) ?? legacy
  const targetValueE = normalizeNumericValue(input.targetValueE) ?? normalizeNumericValue(metadataValues.targetValueE)
  const targetValueS = normalizeNumericValue(input.targetValueS) ?? normalizeNumericValue(metadataValues.targetValueS)

  if ([targetValueT, targetValueE, targetValueS].every((value) => value === undefined)) {
    return {
      targetValue: undefined,
      targetValueT: undefined,
      targetValueE: undefined,
      targetValueS: undefined,
    }
  }

  return {
    targetValue: targetValueT,
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

export function formatPersonalKpiTargetValues(input: PersonalKpiTargetValueInput) {
  const resolved = resolvePersonalKpiTargetValues(input)

  if (
    resolved.targetValueT === undefined &&
    resolved.targetValueE === undefined &&
    resolved.targetValueS === undefined
  ) {
    return '-'
  }

  return [
    `T ${formatMetric(resolved.targetValueT)}`,
    `E ${formatMetric(resolved.targetValueE)}`,
    `S ${formatMetric(resolved.targetValueS)}`,
  ].join(' / ')
}

export function buildPersonalKpiTargetValuePersistence(input: {
  targetValueT: number
  targetValueE?: number | null
  targetValueS?: number | null
  copyMetadata?: unknown
}) {
  const metadata = asRecord(input.copyMetadata) ?? {}

  return {
    targetValue: input.targetValueT,
    copyMetadata: {
      ...metadata,
      personalTargetValues: {
        targetValueT: input.targetValueT,
        targetValueE: input.targetValueE ?? null,
        targetValueS: input.targetValueS ?? null,
      },
    } satisfies Prisma.InputJsonValue,
  }
}
