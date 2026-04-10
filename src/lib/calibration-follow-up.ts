export const CALIBRATION_COMMUNICATION_GUIDE = {
  purpose:
    '캘리브레이션 결과 전달은 결과 통보로 끝나지 않습니다. 맥락, 기대치, 다음 반기 행동까지 연결해야 수용도가 높아집니다.',
  sequence: [
    '결론을 바로 말하기 전에 이번 주기의 기대치와 평가 맥락을 먼저 정리합니다.',
    '최종 등급 또는 핵심 판단을 짧고 분명하게 설명합니다.',
    '캘리브레이션에서 정리된 공개용 코멘트와 구체 사례를 연결합니다.',
    '다음 주기에 기대 초과를 만들기 위한 행동과 지원 계획을 함께 합의합니다.',
  ],
  goodExample:
    '이번 결과는 단순 비교가 아니라 기대치 대비 성과와 영향도를 다시 점검한 결과입니다. 이번에 강했던 점과 다음 단계에서 기대하는 기준을 함께 설명드리겠습니다.',
  badExample:
    '위에서 그렇게 정해서 어쩔 수 없습니다. 다른 팀과 비교했을 때 여기까지밖에 안 됩니다.',
  avoidPhrases: [
    '위에서 그렇게 정해서 어쩔 수 없다',
    '다른 사람도 비슷하니 그냥 받아들여라',
    '캘리브레이션에서 밀렸다',
  ],
  managerDo: [
    '등급 변경이 있었다면 이유와 기대 기준을 함께 설명합니다.',
    '향후 방향과 지원 계획을 구체적으로 말합니다.',
    '개인 공격처럼 들릴 수 있는 표현은 피하고 사실과 기대에 집중합니다.',
  ],
} as const

export type CalibrationCommentRevision = {
  id: string
  stage: 'DRAFT' | 'FINALIZED'
  comment: string
  createdAt: string
  actorUserId: string
  actorName: string
}

export type CalibrationCommentHandoff = {
  draftComment: string
  finalizedComment: string | null
  finalizedAt: string | null
  finalizedById: string | null
  finalizedByName: string | null
  packetGeneratedAt: string | null
  packetGeneratedById: string | null
  packetGeneratedByName: string | null
  revisions: CalibrationCommentRevision[]
}

export type CalibrationFollowUpReviewFlag = {
  compensationSensitive: boolean
  finalCheckNote: string
  updatedAt: string | null
  updatedById: string | null
  updatedByName: string | null
}

export type CalibrationRetrospectiveSurveyResponse = {
  id: string
  respondentId: string
  respondentName: string
  hardestPart: string
  missingData: string
  rulesAndTimebox: string
  positives: string
  improvements: string
  nextCycleNeeds: string
  leniencyFeedback: string
  submittedAt: string
}

export type CalibrationLeaderFeedbackEntry = {
  leaderId: string
  leaderName: string
  summary: string
  suggestions: string
  visibility: 'LEADER_ONLY'
  updatedAt: string | null
  updatedById: string | null
  updatedByName: string | null
}

export type CalibrationFollowUpValue = {
  commentHandoffsByTargetId: Record<string, CalibrationCommentHandoff>
  reviewFlagsByTargetId: Record<string, CalibrationFollowUpReviewFlag>
  retrospectiveSurveys: CalibrationRetrospectiveSurveyResponse[]
  leaderFeedbackByLeaderId: Record<string, CalibrationLeaderFeedbackEntry>
}

export function createDefaultCalibrationCommentHandoff(
  publicComment = ''
): CalibrationCommentHandoff {
  return {
    draftComment: publicComment.trim(),
    finalizedComment: null,
    finalizedAt: null,
    finalizedById: null,
    finalizedByName: null,
    packetGeneratedAt: null,
    packetGeneratedById: null,
    packetGeneratedByName: null,
    revisions: [],
  }
}

export function createDefaultCalibrationFollowUpReviewFlag(): CalibrationFollowUpReviewFlag {
  return {
    compensationSensitive: false,
    finalCheckNote: '',
    updatedAt: null,
    updatedById: null,
    updatedByName: null,
  }
}

export function createEmptyCalibrationFollowUp(): CalibrationFollowUpValue {
  return {
    commentHandoffsByTargetId: {},
    reviewFlagsByTargetId: {},
    retrospectiveSurveys: [],
    leaderFeedbackByLeaderId: {},
  }
}

export function normalizeCalibrationCommentHandoff(
  value: Partial<CalibrationCommentHandoff> | null | undefined
): CalibrationCommentHandoff {
  const defaults = createDefaultCalibrationCommentHandoff()
  const revisions = Array.isArray(value?.revisions)
    ? value.revisions
        .map((revision) => {
          if (!revision || typeof revision !== 'object' || Array.isArray(revision)) return null
          const record = revision as Record<string, unknown>
          const comment = typeof record.comment === 'string' ? record.comment.trim() : ''
          if (!comment) return null
          return {
            id:
              typeof record.id === 'string' && record.id.trim().length > 0
                ? record.id
                : `revision-${Math.random().toString(36).slice(2, 10)}`,
            stage: record.stage === 'FINALIZED' ? 'FINALIZED' : 'DRAFT',
            comment,
            createdAt: typeof record.createdAt === 'string' ? record.createdAt : new Date(0).toISOString(),
            actorUserId: typeof record.actorUserId === 'string' ? record.actorUserId : '',
            actorName: typeof record.actorName === 'string' ? record.actorName : '',
          } satisfies CalibrationCommentRevision
        })
        .filter((item): item is CalibrationCommentRevision => Boolean(item))
    : defaults.revisions

  return {
    draftComment: value?.draftComment?.trim() ?? defaults.draftComment,
    finalizedComment:
      typeof value?.finalizedComment === 'string' && value.finalizedComment.trim().length > 0
        ? value.finalizedComment.trim()
        : null,
    finalizedAt: value?.finalizedAt ?? null,
    finalizedById: value?.finalizedById ?? null,
    finalizedByName: value?.finalizedByName ?? null,
    packetGeneratedAt: value?.packetGeneratedAt ?? null,
    packetGeneratedById: value?.packetGeneratedById ?? null,
    packetGeneratedByName: value?.packetGeneratedByName ?? null,
    revisions,
  }
}

export function normalizeCalibrationFollowUpReviewFlag(
  value: Partial<CalibrationFollowUpReviewFlag> | null | undefined
): CalibrationFollowUpReviewFlag {
  const defaults = createDefaultCalibrationFollowUpReviewFlag()
  return {
    compensationSensitive: Boolean(value?.compensationSensitive),
    finalCheckNote: value?.finalCheckNote?.trim() ?? defaults.finalCheckNote,
    updatedAt: value?.updatedAt ?? null,
    updatedById: value?.updatedById ?? null,
    updatedByName: value?.updatedByName ?? null,
  }
}

export function normalizeCalibrationRetrospectiveSurveyResponse(
  value: Partial<CalibrationRetrospectiveSurveyResponse> | null | undefined
): CalibrationRetrospectiveSurveyResponse | null {
  if (!value) return null
  const respondentId = value.respondentId?.trim() ?? ''
  const respondentName = value.respondentName?.trim() ?? ''
  const submittedAt = value.submittedAt ?? null
  if (!respondentId || !respondentName || !submittedAt) return null

  return {
    id: value.id?.trim() || `survey-${respondentId}`,
    respondentId,
    respondentName,
    hardestPart: value.hardestPart?.trim() ?? '',
    missingData: value.missingData?.trim() ?? '',
    rulesAndTimebox: value.rulesAndTimebox?.trim() ?? '',
    positives: value.positives?.trim() ?? '',
    improvements: value.improvements?.trim() ?? '',
    nextCycleNeeds: value.nextCycleNeeds?.trim() ?? '',
    leniencyFeedback: value.leniencyFeedback?.trim() ?? '',
    submittedAt,
  }
}

export function normalizeCalibrationLeaderFeedbackEntry(
  value: Partial<CalibrationLeaderFeedbackEntry> | null | undefined
): CalibrationLeaderFeedbackEntry | null {
  if (!value) return null
  const leaderId = value.leaderId?.trim() ?? ''
  const leaderName = value.leaderName?.trim() ?? ''
  if (!leaderId || !leaderName) return null

  return {
    leaderId,
    leaderName,
    summary: value.summary?.trim() ?? '',
    suggestions: value.suggestions?.trim() ?? '',
    visibility: 'LEADER_ONLY',
    updatedAt: value.updatedAt ?? null,
    updatedById: value.updatedById ?? null,
    updatedByName: value.updatedByName ?? null,
  }
}

export function normalizeCalibrationFollowUp(
  value: Partial<CalibrationFollowUpValue> | null | undefined
): CalibrationFollowUpValue {
  const defaults = createEmptyCalibrationFollowUp()
  const commentHandoffsByTargetId =
    value?.commentHandoffsByTargetId && typeof value.commentHandoffsByTargetId === 'object'
      ? Object.fromEntries(
          Object.entries(value.commentHandoffsByTargetId).map(([targetId, handoff]) => [
            targetId,
            normalizeCalibrationCommentHandoff(handoff),
          ])
        )
      : defaults.commentHandoffsByTargetId

  const reviewFlagsByTargetId =
    value?.reviewFlagsByTargetId && typeof value.reviewFlagsByTargetId === 'object'
      ? Object.fromEntries(
          Object.entries(value.reviewFlagsByTargetId).map(([targetId, flag]) => [
            targetId,
            normalizeCalibrationFollowUpReviewFlag(flag),
          ])
        )
      : defaults.reviewFlagsByTargetId

  const retrospectiveSurveys = Array.isArray(value?.retrospectiveSurveys)
    ? value.retrospectiveSurveys
        .map((response) => normalizeCalibrationRetrospectiveSurveyResponse(response))
        .filter((response): response is CalibrationRetrospectiveSurveyResponse => Boolean(response))
    : defaults.retrospectiveSurveys

  const leaderFeedbackByLeaderId =
    value?.leaderFeedbackByLeaderId && typeof value.leaderFeedbackByLeaderId === 'object'
      ? Object.fromEntries(
          Object.entries(value.leaderFeedbackByLeaderId)
            .map(([leaderId, feedback]) => [
              leaderId,
              normalizeCalibrationLeaderFeedbackEntry(feedback),
            ])
            .filter((entry): entry is [string, CalibrationLeaderFeedbackEntry] => Boolean(entry[1]))
        )
      : defaults.leaderFeedbackByLeaderId

  return {
    commentHandoffsByTargetId,
    reviewFlagsByTargetId,
    retrospectiveSurveys,
    leaderFeedbackByLeaderId,
  }
}

export function collectCalibrationFollowUpThemes(values: string[], limit = 3) {
  return values
    .map((value) => value.trim())
    .filter((value, index, list) => value.length > 0 && list.indexOf(value) === index)
    .slice(0, limit)
}
