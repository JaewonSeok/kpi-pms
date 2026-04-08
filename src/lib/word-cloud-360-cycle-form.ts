type WordCloud360CycleFormInput = {
  id?: string
  cycleId?: string
  evalCycleId?: string
  cycleName?: string
  startDate?: string
  endDate?: string
  positiveSelectionLimit?: number
  negativeSelectionLimit?: number
  resultPrivacyThreshold?: number
  evaluatorGroups?: string[]
  notes?: string
  status?: string
}

export function toWordCloudCycleLocalInputValue(value?: string) {
  if (!value) return ''
  const date = new Date(value)
  const offset = date.getTimezoneOffset()
  const localDate = new Date(date.getTime() - offset * 60 * 1000)
  return localDate.toISOString().slice(0, 16)
}

export function toWordCloudCycleIsoValue(value: string) {
  return value ? new Date(value).toISOString() : undefined
}

export function buildWordCloudCycleFormState(cycle?: WordCloud360CycleFormInput | null) {
  return {
    cycleId: cycle?.cycleId ?? cycle?.id ?? '',
    evalCycleId: cycle?.evalCycleId ?? '',
    cycleName: cycle?.cycleName ?? '',
    startDate: toWordCloudCycleLocalInputValue(cycle?.startDate),
    endDate: toWordCloudCycleLocalInputValue(cycle?.endDate),
    positiveSelectionLimit: cycle?.positiveSelectionLimit ?? 10,
    negativeSelectionLimit: cycle?.negativeSelectionLimit ?? 10,
    resultPrivacyThreshold: cycle?.resultPrivacyThreshold ?? 3,
    evaluatorGroups: cycle?.evaluatorGroups ?? ['MANAGER', 'PEER', 'SUBORDINATE'],
    notes: cycle?.notes ?? '',
    status: cycle?.status ?? 'DRAFT',
  }
}

export function toWordCloudCyclePayload<T extends WordCloud360CycleFormInput>(form: T) {
  return {
    ...form,
    cycleId: form.cycleId || undefined,
    evalCycleId: form.evalCycleId || undefined,
    startDate: toWordCloudCycleIsoValue(form.startDate ?? ''),
    endDate: toWordCloudCycleIsoValue(form.endDate ?? ''),
  }
}
