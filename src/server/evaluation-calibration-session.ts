import type { Prisma } from '@prisma/client'
import {
  type CalibrationFollowUpValue,
  createEmptyCalibrationFollowUp,
  normalizeCalibrationFollowUp,
} from '@/lib/calibration-follow-up'
import {
  type CalibrationWorkspaceValue,
  createEmptyCalibrationWorkspace,
  normalizeCalibrationWorkspace,
} from '@/lib/calibration-workspace'
import {
  type CalibrationSessionSetupValue,
  createDefaultCalibrationSessionSetup,
  normalizeCalibrationSessionSetup,
} from '@/lib/calibration-session-setup'

export type CalibrationExternalColumn = {
  key: string
  label: string
}

export type CalibrationExternalRow = Record<string, string>

export type CalibrationMergeSummary = {
  mergedAt: string
  mergedBy: string
  createdCount: number
  skippedCount: number
  scopeId?: string
}

export type CalibrationSessionConfigValue = {
  excludedTargetIds: string[]
  participantIds: string[]
  evaluatorIds: string[]
  observerIds: string[]
  externalColumns: CalibrationExternalColumn[]
  externalRowsByTargetId: Record<string, CalibrationExternalRow>
  lastMergeSummary: CalibrationMergeSummary | null
  setup: CalibrationSessionSetupValue
  workspace: CalibrationWorkspaceValue
  followUp: CalibrationFollowUpValue
}

export function createEmptyCalibrationSessionConfig(): CalibrationSessionConfigValue {
  const setup = createDefaultCalibrationSessionSetup()
  return {
    excludedTargetIds: [],
    participantIds: [],
    evaluatorIds: [],
    observerIds: [],
    externalColumns: [],
    externalRowsByTargetId: {},
    lastMergeSummary: null,
    setup,
    workspace: createEmptyCalibrationWorkspace(setup.timeboxMinutes),
    followUp: createEmptyCalibrationFollowUp(),
  }
}

export function parseCalibrationSessionConfig(
  value: Prisma.JsonValue | null
): CalibrationSessionConfigValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return createEmptyCalibrationSessionConfig()
  }

  const record = value as Record<string, unknown>
  const externalColumns = Array.isArray(record.externalColumns)
    ? record.externalColumns
        .map((item) => {
          if (!item || typeof item !== 'object' || Array.isArray(item)) return null
          const columnRecord = item as Record<string, unknown>
          const key = typeof columnRecord.key === 'string' ? columnRecord.key.trim() : ''
          const label = typeof columnRecord.label === 'string' ? columnRecord.label.trim() : ''
          if (!key || !label) return null
          return { key, label }
        })
        .filter((item): item is CalibrationExternalColumn => Boolean(item))
    : []

  const rawRows =
    record.externalRowsByTargetId && typeof record.externalRowsByTargetId === 'object' && !Array.isArray(record.externalRowsByTargetId)
      ? (record.externalRowsByTargetId as Record<string, unknown>)
      : {}

  const externalRowsByTargetId = Object.fromEntries(
    Object.entries(rawRows).map(([targetId, rowValue]) => {
      if (!rowValue || typeof rowValue !== 'object' || Array.isArray(rowValue)) {
        return [targetId, {}]
      }

      const rowRecord = rowValue as Record<string, unknown>
      const normalizedRow = Object.fromEntries(
        Object.entries(rowRecord)
          .filter(([key]) => typeof key === 'string' && key.trim().length > 0)
          .map(([key, itemValue]) => [key, itemValue == null ? '' : String(itemValue).trim()])
      )
      return [targetId, normalizedRow]
    })
  ) as Record<string, CalibrationExternalRow>

  const rawMergeSummary =
    record.lastMergeSummary && typeof record.lastMergeSummary === 'object' && !Array.isArray(record.lastMergeSummary)
      ? (record.lastMergeSummary as Record<string, unknown>)
      : null

  const lastMergeSummary =
    rawMergeSummary && typeof rawMergeSummary.mergedAt === 'string' && typeof rawMergeSummary.mergedBy === 'string'
      ? {
          mergedAt: rawMergeSummary.mergedAt,
          mergedBy: rawMergeSummary.mergedBy,
          createdCount:
            typeof rawMergeSummary.createdCount === 'number' ? rawMergeSummary.createdCount : 0,
          skippedCount:
            typeof rawMergeSummary.skippedCount === 'number' ? rawMergeSummary.skippedCount : 0,
          scopeId: typeof rawMergeSummary.scopeId === 'string' ? rawMergeSummary.scopeId : undefined,
        }
      : null

  const rawSetup =
    record.setup && typeof record.setup === 'object' && !Array.isArray(record.setup)
      ? (record.setup as Partial<CalibrationSessionSetupValue>)
      : null
  const setup = normalizeCalibrationSessionSetup(rawSetup)
  const rawWorkspace =
    record.workspace && typeof record.workspace === 'object' && !Array.isArray(record.workspace)
      ? (record.workspace as Partial<CalibrationWorkspaceValue>)
      : null
  const rawFollowUp =
    record.followUp && typeof record.followUp === 'object' && !Array.isArray(record.followUp)
      ? (record.followUp as Partial<CalibrationFollowUpValue>)
      : null

  return {
    excludedTargetIds: Array.isArray(record.excludedTargetIds)
      ? record.excludedTargetIds.filter((item): item is string => typeof item === 'string')
      : [],
    participantIds: Array.isArray(record.participantIds)
      ? record.participantIds.filter((item): item is string => typeof item === 'string')
      : [],
    evaluatorIds: Array.isArray(record.evaluatorIds)
      ? record.evaluatorIds.filter((item): item is string => typeof item === 'string')
      : [],
    observerIds: Array.isArray(record.observerIds)
      ? record.observerIds.filter((item): item is string => typeof item === 'string')
      : [],
    externalColumns,
    externalRowsByTargetId,
    lastMergeSummary,
    setup,
    workspace: normalizeCalibrationWorkspace(rawWorkspace, setup.timeboxMinutes),
    followUp: normalizeCalibrationFollowUp(rawFollowUp),
  }
}

export function toCalibrationSessionConfigJson(
  value: CalibrationSessionConfigValue
): Prisma.InputJsonValue {
  return {
    excludedTargetIds: value.excludedTargetIds,
    participantIds: value.participantIds,
    evaluatorIds: value.evaluatorIds,
    observerIds: value.observerIds,
    externalColumns: value.externalColumns,
    externalRowsByTargetId: value.externalRowsByTargetId,
    lastMergeSummary: value.lastMergeSummary,
    setup: value.setup,
    workspace: value.workspace,
    followUp: value.followUp,
  }
}
