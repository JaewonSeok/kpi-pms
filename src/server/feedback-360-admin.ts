type ReminderAction =
  | 'send-review-reminder'
  | 'send-peer-selection-reminder'
  | 'send-result-share'

export type FeedbackResultShareAudience = 'REVIEWEE' | 'LEADER' | 'LEADER_AND_REVIEWEE'
export type FeedbackResultReceiptRole = 'REVIEWEE' | 'LEADER'

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

type ResultTargetShape = {
  id: string
  teamLeaderId: string | null
  sectionChiefId: string | null
  divisionHeadId: string | null
}

export function resolveFeedbackResultPrimaryLeaderId(target: ResultTargetShape) {
  return target.teamLeaderId ?? target.sectionChiefId ?? target.divisionHeadId ?? null
}

export function getFeedbackResultRecipientRole(params: {
  actorId: string
  target: ResultTargetShape
}): FeedbackResultReceiptRole | null {
  if (params.actorId === params.target.id) {
    return 'REVIEWEE'
  }

  const primaryLeaderId = resolveFeedbackResultPrimaryLeaderId(params.target)
  if (primaryLeaderId && primaryLeaderId === params.actorId) {
    return 'LEADER'
  }

  return null
}

export function resolveFeedbackResultRecipientIds(params: {
  audience: FeedbackResultShareAudience
  target: ResultTargetShape
}) {
  const revieweeIds =
    params.audience === 'LEADER'
      ? []
      : [params.target.id]
  const leaderId = resolveFeedbackResultPrimaryLeaderId(params.target)
  const leaderIds =
    params.audience === 'REVIEWEE' || !leaderId
      ? []
      : [leaderId]

  return Array.from(new Set([...revieweeIds, ...leaderIds]))
}
