export type Feedback360ResponseAssignmentLike = {
  feedbackId?: string | null
  roundId?: string | null
  roundName?: string | null
  receiverId?: string | null
  receiverEmployeeId?: string | null
  receiverEmail?: string | null
  receiverName?: string | null
  receiverDepartmentName?: string | null
  receiverTeamName?: string | null
  receiverProfileImageUrl?: string | null
  relationship?: string | null
  dueDate?: string | null
  href?: string | null
  status?: string | null
  selectedTagCount?: number | null
  overallComment?: string | null
}

export type Feedback360MergedResponseTarget = Feedback360ResponseAssignmentLike & {
  uniqueKey: string
  feedbackId: string
  href: string
  roundId: string
  roundName: string
  receiverName: string
  dueDate: string
  relationships: string[]
  duplicateCount: number
  sourceFeedbackIds: string[]
  canonicalFeedbackId: string
  mergedStatus?: string
}

export type Feedback360ResponseTargetDedupeOptions = {
  groupByRound?: boolean
  scopeKey?: string | null
}

function normalizeKeyPart(value?: string | number | null) {
  return String(value ?? '').trim()
}

export function buildFeedback360ResponseTargetDedupeKey(
  request: Feedback360ResponseAssignmentLike,
  index = 0,
  options: Feedback360ResponseTargetDedupeOptions = {}
) {
  const roundId = normalizeKeyPart(request.roundId)
  const groupByRound = options.groupByRound !== false
  const scopeValue = groupByRound ? roundId : normalizeKeyPart(options.scopeKey) || roundId
  const scopePrefix = groupByRound ? 'round' : 'scope'
  const receiverId = normalizeKeyPart(request.receiverId)
  if (scopeValue && receiverId) return `${scopePrefix}:${scopeValue}:receiver:${receiverId}`

  const receiverEmployeeId = normalizeKeyPart(request.receiverEmployeeId)
  if (scopeValue && receiverEmployeeId) return `${scopePrefix}:${scopeValue}:employee:${receiverEmployeeId}`

  const receiverEmail = normalizeKeyPart(request.receiverEmail).toLowerCase()
  if (scopeValue && receiverEmail) return `${scopePrefix}:${scopeValue}:email:${receiverEmail}`

  const receiverName = normalizeKeyPart(request.receiverName)
  const receiverScope = [
    normalizeKeyPart(request.receiverDepartmentName),
    normalizeKeyPart(request.receiverTeamName),
  ]
    .filter(Boolean)
    .join(':')
  if (scopeValue && receiverName) {
    return `${scopePrefix}:${scopeValue}:name:${receiverName}:${receiverScope || 'none'}`
  }

  const feedbackId = normalizeKeyPart(request.feedbackId)
  if (feedbackId) return `feedback:${feedbackId}`

  return `fallback:${scopeValue || roundId || 'none'}:${index}`
}

function getStatusPriority(status?: string | null) {
  switch (status) {
    case 'SUBMITTED':
      return 4
    case 'IN_PROGRESS':
      return 3
    case 'DRAFT':
      return 2
    case 'PENDING':
      return 1
    default:
      return 0
  }
}

function parseDueDate(value?: string | null) {
  const normalized = normalizeKeyPart(value)
  if (!normalized) return null

  const explicitMatch = normalized.match(/(\d{4})[.\-/년\s]+(\d{1,2})[.\-/월\s]+(\d{1,2})/)
  if (explicitMatch) {
    const [, year, month, day] = explicitMatch
    return new Date(Number(year), Number(month) - 1, Number(day)).getTime()
  }

  const parsed = Date.parse(normalized)
  return Number.isNaN(parsed) ? null : parsed
}

function getEarlierDueDate(current?: string | null, candidate?: string | null) {
  const currentTime = parseDueDate(current)
  const candidateTime = parseDueDate(candidate)

  if (currentTime == null) return normalizeKeyPart(candidate) || normalizeKeyPart(current)
  if (candidateTime == null) return normalizeKeyPart(current)
  return candidateTime < currentTime ? normalizeKeyPart(candidate) : normalizeKeyPart(current)
}

function shouldUseCanonical(
  current: Feedback360ResponseAssignmentLike,
  candidate: Feedback360ResponseAssignmentLike
) {
  const statusDelta = getStatusPriority(candidate.status) - getStatusPriority(current.status)
  if (statusDelta !== 0) return statusDelta > 0

  const tagDelta = (candidate.selectedTagCount ?? 0) - (current.selectedTagCount ?? 0)
  if (tagDelta !== 0) return tagDelta > 0

  const candidateHasComment = Boolean(candidate.overallComment?.trim())
  const currentHasComment = Boolean(current.overallComment?.trim())
  if (candidateHasComment !== currentHasComment) return candidateHasComment

  const candidateHasHref = Boolean(candidate.href)
  const currentHasHref = Boolean(current.href)
  if (candidateHasHref !== currentHasHref) return candidateHasHref

  return false
}

function getMergedStatus(requests: Feedback360ResponseAssignmentLike[]) {
  return requests.reduce<string | undefined>((current, request) => {
    if (!current) return request.status ?? undefined
    return getStatusPriority(request.status) > getStatusPriority(current) ? request.status ?? current : current
  }, undefined)
}

export function dedupeFeedback360ResponseTargets<T extends Feedback360ResponseAssignmentLike>(
  requests: T[],
  options: Feedback360ResponseTargetDedupeOptions = {}
): Feedback360MergedResponseTarget[] {
  const groups = new Map<
    string,
    {
      requests: T[]
      relationships: string[]
      dueDate: string
    }
  >()

  requests.forEach((request, index) => {
    const uniqueKey = buildFeedback360ResponseTargetDedupeKey(request, index, options)
    const relationship = normalizeKeyPart(request.relationship)
    const existing = groups.get(uniqueKey)

    if (!existing) {
      groups.set(uniqueKey, {
        requests: [request],
        relationships: relationship ? [relationship] : [],
        dueDate: normalizeKeyPart(request.dueDate),
      })
      return
    }

    existing.requests.push(request)
    if (relationship && !existing.relationships.includes(relationship)) {
      existing.relationships.push(relationship)
    }
    existing.dueDate = getEarlierDueDate(existing.dueDate, request.dueDate)
  })

  return Array.from(groups.entries()).map(([uniqueKey, group]) => {
    const [firstRequest, ...remainingRequests] = group.requests
    const canonical = remainingRequests.reduce<T>((current, candidate) =>
      shouldUseCanonical(current, candidate) ? candidate : current
    , firstRequest)
    const canonicalFeedbackId = normalizeKeyPart(canonical.feedbackId)

    return {
      ...canonical,
      uniqueKey,
      feedbackId: canonicalFeedbackId,
      href: normalizeKeyPart(canonical.href),
      roundId: normalizeKeyPart(canonical.roundId),
      roundName: normalizeKeyPart(canonical.roundName),
      receiverName: normalizeKeyPart(canonical.receiverName),
      dueDate: group.dueDate || normalizeKeyPart(canonical.dueDate),
      relationships: group.relationships,
      duplicateCount: group.requests.length,
      sourceFeedbackIds: group.requests
        .map((request) => normalizeKeyPart(request.feedbackId))
        .filter(Boolean),
      canonicalFeedbackId,
      mergedStatus: getMergedStatus(group.requests),
    }
  })
}
