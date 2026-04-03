export type FeedbackResultRecipientProfile = 'REVIEWEE' | 'LEADER' | 'EXECUTIVE'

export type FeedbackResultVersionConfig = {
  showLeaderComment: boolean
  showLeaderScore: boolean
  showExecutiveComment: boolean
  showExecutiveScore: boolean
  showFinalScore: boolean
  showFinalComment: boolean
}

export type FeedbackResultPresentationSettings = Record<
  FeedbackResultRecipientProfile,
  FeedbackResultVersionConfig
>

export const FEEDBACK_RESULT_PROFILE_LABELS: Record<FeedbackResultRecipientProfile, string> = {
  REVIEWEE: '구성원용 결과지',
  LEADER: '팀장용 결과지',
  EXECUTIVE: '경영진용 결과지',
}

export const DEFAULT_FEEDBACK_RESULT_PRESENTATION_SETTINGS: FeedbackResultPresentationSettings = {
  REVIEWEE: {
    showLeaderComment: true,
    showLeaderScore: false,
    showExecutiveComment: false,
    showExecutiveScore: false,
    showFinalScore: true,
    showFinalComment: true,
  },
  LEADER: {
    showLeaderComment: true,
    showLeaderScore: true,
    showExecutiveComment: false,
    showExecutiveScore: false,
    showFinalScore: true,
    showFinalComment: true,
  },
  EXECUTIVE: {
    showLeaderComment: true,
    showLeaderScore: true,
    showExecutiveComment: true,
    showExecutiveScore: true,
    showFinalScore: true,
    showFinalComment: true,
  },
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function parseVersionConfig(
  value: unknown,
  fallback: FeedbackResultVersionConfig
): FeedbackResultVersionConfig {
  const record = asRecord(value)
  if (!record) return fallback

  return {
    showLeaderComment:
      typeof record.showLeaderComment === 'boolean'
        ? record.showLeaderComment
        : fallback.showLeaderComment,
    showLeaderScore:
      typeof record.showLeaderScore === 'boolean'
        ? record.showLeaderScore
        : fallback.showLeaderScore,
    showExecutiveComment:
      typeof record.showExecutiveComment === 'boolean'
        ? record.showExecutiveComment
        : fallback.showExecutiveComment,
    showExecutiveScore:
      typeof record.showExecutiveScore === 'boolean'
        ? record.showExecutiveScore
        : fallback.showExecutiveScore,
    showFinalScore:
      typeof record.showFinalScore === 'boolean'
        ? record.showFinalScore
        : fallback.showFinalScore,
    showFinalComment:
      typeof record.showFinalComment === 'boolean'
        ? record.showFinalComment
        : fallback.showFinalComment,
  }
}

export function parseFeedbackResultPresentationSettings(
  value: unknown
): FeedbackResultPresentationSettings {
  const record = asRecord(value)
  if (!record) return DEFAULT_FEEDBACK_RESULT_PRESENTATION_SETTINGS

  return {
    REVIEWEE: parseVersionConfig(record.REVIEWEE, DEFAULT_FEEDBACK_RESULT_PRESENTATION_SETTINGS.REVIEWEE),
    LEADER: parseVersionConfig(record.LEADER, DEFAULT_FEEDBACK_RESULT_PRESENTATION_SETTINGS.LEADER),
    EXECUTIVE: parseVersionConfig(record.EXECUTIVE, DEFAULT_FEEDBACK_RESULT_PRESENTATION_SETTINGS.EXECUTIVE),
  }
}

export function resolveFeedbackResultPresentationProfile(params: {
  actorId: string
  actorRole: string
  target: {
    id: string
    teamLeaderId: string | null
    sectionChiefId: string | null
    divisionHeadId: string | null
  }
  requestedProfile?: FeedbackResultRecipientProfile | null
}) {
  if (params.actorRole === 'ROLE_ADMIN' && params.requestedProfile) {
    return params.requestedProfile
  }

  if (params.actorId === params.target.id) {
    return 'REVIEWEE'
  }

  if (params.target.teamLeaderId === params.actorId) {
    return 'LEADER'
  }

  return 'EXECUTIVE'
}
