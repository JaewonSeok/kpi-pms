export type AiCompetencyGateCycleFormInput = {
  cycleId?: string
  evalCycleId: string
  cycleName: string
  status: 'DRAFT' | 'OPEN' | 'CLOSED'
  submissionOpenAt: string
  submissionCloseAt: string
  reviewOpenAt: string
  reviewCloseAt: string
  resultPublishAt: string
  promotionGateEnabled: boolean
  policyAcknowledgementText: string
}

export function toAiCompetencyGateCycleLocalInputValue(value?: string) {
  if (!value) return ''
  const date = new Date(value)
  const offset = date.getTimezoneOffset()
  const localDate = new Date(date.getTime() - offset * 60 * 1000)
  return localDate.toISOString().slice(0, 16)
}

export function toAiCompetencyGateCycleIsoValue(value?: string) {
  return value ? new Date(value).toISOString() : undefined
}

export function toAiCompetencyGateCyclePayload<T extends AiCompetencyGateCycleFormInput>(form: T) {
  return {
    ...form,
    cycleId: form.cycleId || undefined,
    submissionOpenAt: toAiCompetencyGateCycleIsoValue(form.submissionOpenAt),
    submissionCloseAt: toAiCompetencyGateCycleIsoValue(form.submissionCloseAt),
    reviewOpenAt: toAiCompetencyGateCycleIsoValue(form.reviewOpenAt),
    reviewCloseAt: toAiCompetencyGateCycleIsoValue(form.reviewCloseAt),
    resultPublishAt: toAiCompetencyGateCycleIsoValue(form.resultPublishAt),
  }
}
