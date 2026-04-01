type ReminderAction =
  | 'send-review-reminder'
  | 'send-peer-selection-reminder'
  | 'send-result-share'

type ReminderRoundShape = {
  feedbacks: Array<{
    giverId: string
    receiverId: string
    status: string
  }>
  nominations: Array<{
    targetId: string
    status: string
  }>
}

export function resolveFeedbackFolderId(params: {
  searchParamId?: string | null
  body?: unknown
}) {
  const searchParamId = params.searchParamId?.trim()
  if (searchParamId) return searchParamId

  if (params.body && typeof params.body === 'object' && 'id' in params.body) {
    const bodyId = (params.body as { id?: unknown }).id
    if (typeof bodyId === 'string' && bodyId.trim()) {
      return bodyId.trim()
    }
  }

  return ''
}

export function getEligibleReminderRecipientIds(
  action: ReminderAction,
  round: ReminderRoundShape
) {
  if (action === 'send-peer-selection-reminder') {
    return Array.from(
      new Set(
        round.nominations
          .filter((item) => item.status !== 'PUBLISHED')
          .map((item) => item.targetId)
      )
    )
  }

  if (action === 'send-result-share') {
    return Array.from(
      new Set(
        round.feedbacks
          .filter((item) => item.status === 'SUBMITTED')
          .map((item) => item.receiverId)
      )
    )
  }

  return Array.from(
    new Set(
      round.feedbacks
        .filter((item) => item.status !== 'SUBMITTED')
        .map((item) => item.giverId)
    )
  )
}
