type JsonRecord = Record<string, unknown>

export type FeedbackRoleArchitectureProfile = {
  id: string
  label: string
  jobFamily: string
  level: string
  guideText: string
  expectedCompetencies: string[]
  nextLevelExpectations: string[]
  goalLibrary: string[]
  filters: {
    departmentKeyword?: string
    roleKeyword?: string
    position?: string
    jobTitleKeyword?: string
    teamNameKeyword?: string
  }
}

export type FeedbackSkillArchitectureSettings = {
  enabled: boolean
  roleProfiles: FeedbackRoleArchitectureProfile[]
}

export type FeedbackAiCopilotSettings = {
  enabled: boolean
  allowManagerView: boolean
  allowSelfView: boolean
  includeGoals: boolean
  includeCheckins: boolean
  includeFeedback: boolean
  includeResults: boolean
  disclaimer: string
}

export type FeedbackRoleGuideTarget = {
  departmentName?: string
  role?: string
  position?: string
  jobTitle?: string
  teamName?: string
}

export type ResolvedFeedbackRoleGuide = FeedbackRoleArchitectureProfile & {
  matchedFilterCount: number
}

export const DEFAULT_FEEDBACK_SKILL_ARCHITECTURE_SETTINGS: FeedbackSkillArchitectureSettings = {
  enabled: false,
  roleProfiles: [],
}

export const DEFAULT_FEEDBACK_AI_COPILOT_SETTINGS: FeedbackAiCopilotSettings = {
  enabled: false,
  allowManagerView: true,
  allowSelfView: true,
  includeGoals: true,
  includeCheckins: true,
  includeFeedback: true,
  includeResults: true,
  disclaimer:
    'AI 코파일럿은 최근 리뷰, 목표, 1:1, 피드백을 바탕으로 성장 포인트와 코칭 초안을 제안하는 보조 기능입니다. 최종 판단과 활용 결정은 리더와 HR이 수행합니다.',
}

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' ? (value as JsonRecord) : null
}

function normalizeText(value: string | undefined) {
  return value?.trim().toLowerCase() ?? ''
}

function parseStringArray(value: unknown, max = 20) {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, max)
}

function parseProfile(value: unknown): FeedbackRoleArchitectureProfile | null {
  const record = asRecord(value)
  if (!record) return null

  const id = typeof record.id === 'string' && record.id.trim() ? record.id.trim() : ''
  const label = typeof record.label === 'string' ? record.label.trim() : ''
  const jobFamily = typeof record.jobFamily === 'string' ? record.jobFamily.trim() : ''
  const level = typeof record.level === 'string' ? record.level.trim() : ''
  const guideText = typeof record.guideText === 'string' ? record.guideText.trim() : ''

  if (!id || !label || !jobFamily || !level || !guideText) {
    return null
  }

  const filtersRecord = asRecord(record.filters)

  return {
    id,
    label,
    jobFamily,
    level,
    guideText,
    expectedCompetencies: parseStringArray(record.expectedCompetencies),
    nextLevelExpectations: parseStringArray(record.nextLevelExpectations),
    goalLibrary: parseStringArray(record.goalLibrary),
    filters: {
      departmentKeyword:
        typeof filtersRecord?.departmentKeyword === 'string' && filtersRecord.departmentKeyword.trim()
          ? filtersRecord.departmentKeyword.trim()
          : undefined,
      roleKeyword:
        typeof filtersRecord?.roleKeyword === 'string' && filtersRecord.roleKeyword.trim()
          ? filtersRecord.roleKeyword.trim()
          : undefined,
      position:
        typeof filtersRecord?.position === 'string' && filtersRecord.position.trim()
          ? filtersRecord.position.trim()
          : undefined,
      jobTitleKeyword:
        typeof filtersRecord?.jobTitleKeyword === 'string' && filtersRecord.jobTitleKeyword.trim()
          ? filtersRecord.jobTitleKeyword.trim()
          : undefined,
      teamNameKeyword:
        typeof filtersRecord?.teamNameKeyword === 'string' && filtersRecord.teamNameKeyword.trim()
          ? filtersRecord.teamNameKeyword.trim()
          : undefined,
    },
  }
}

export function parseFeedbackSkillArchitectureSettings(value: unknown): FeedbackSkillArchitectureSettings {
  const record = asRecord(value)
  if (!record) return DEFAULT_FEEDBACK_SKILL_ARCHITECTURE_SETTINGS

  return {
    enabled:
      typeof record.enabled === 'boolean'
        ? record.enabled
        : DEFAULT_FEEDBACK_SKILL_ARCHITECTURE_SETTINGS.enabled,
    roleProfiles: Array.isArray(record.roleProfiles)
      ? record.roleProfiles
          .map((item) => parseProfile(item))
          .filter((item): item is FeedbackRoleArchitectureProfile => Boolean(item))
      : DEFAULT_FEEDBACK_SKILL_ARCHITECTURE_SETTINGS.roleProfiles,
  }
}

export function parseFeedbackAiCopilotSettings(value: unknown): FeedbackAiCopilotSettings {
  const record = asRecord(value)
  if (!record) return DEFAULT_FEEDBACK_AI_COPILOT_SETTINGS

  return {
    enabled: typeof record.enabled === 'boolean' ? record.enabled : DEFAULT_FEEDBACK_AI_COPILOT_SETTINGS.enabled,
    allowManagerView:
      typeof record.allowManagerView === 'boolean'
        ? record.allowManagerView
        : DEFAULT_FEEDBACK_AI_COPILOT_SETTINGS.allowManagerView,
    allowSelfView:
      typeof record.allowSelfView === 'boolean'
        ? record.allowSelfView
        : DEFAULT_FEEDBACK_AI_COPILOT_SETTINGS.allowSelfView,
    includeGoals:
      typeof record.includeGoals === 'boolean'
        ? record.includeGoals
        : DEFAULT_FEEDBACK_AI_COPILOT_SETTINGS.includeGoals,
    includeCheckins:
      typeof record.includeCheckins === 'boolean'
        ? record.includeCheckins
        : DEFAULT_FEEDBACK_AI_COPILOT_SETTINGS.includeCheckins,
    includeFeedback:
      typeof record.includeFeedback === 'boolean'
        ? record.includeFeedback
        : DEFAULT_FEEDBACK_AI_COPILOT_SETTINGS.includeFeedback,
    includeResults:
      typeof record.includeResults === 'boolean'
        ? record.includeResults
        : DEFAULT_FEEDBACK_AI_COPILOT_SETTINGS.includeResults,
    disclaimer:
      typeof record.disclaimer === 'string' && record.disclaimer.trim()
        ? record.disclaimer.trim()
        : DEFAULT_FEEDBACK_AI_COPILOT_SETTINGS.disclaimer,
  }
}

function matchesRoleProfile(profile: FeedbackRoleArchitectureProfile, target: FeedbackRoleGuideTarget) {
  const checks = [
    profile.filters.departmentKeyword
      ? normalizeText(target.departmentName).includes(normalizeText(profile.filters.departmentKeyword))
      : null,
    profile.filters.roleKeyword
      ? normalizeText(target.role).includes(normalizeText(profile.filters.roleKeyword))
      : null,
    profile.filters.position
      ? normalizeText(target.position) === normalizeText(profile.filters.position)
      : null,
    profile.filters.jobTitleKeyword
      ? normalizeText(target.jobTitle).includes(normalizeText(profile.filters.jobTitleKeyword))
      : null,
    profile.filters.teamNameKeyword
      ? normalizeText(target.teamName).includes(normalizeText(profile.filters.teamNameKeyword))
      : null,
  ].filter((item): item is boolean => item !== null)

  if (!checks.length) return false
  return checks.every(Boolean)
}

function getProfileSpecificity(profile: FeedbackRoleArchitectureProfile) {
  return Object.values(profile.filters).filter(Boolean).length
}

export function resolveFeedbackRoleGuide(params: {
  settings: FeedbackSkillArchitectureSettings
  target: FeedbackRoleGuideTarget
}): ResolvedFeedbackRoleGuide | null {
  if (!params.settings.enabled) return null

  const matches = params.settings.roleProfiles
    .filter((profile) => matchesRoleProfile(profile, params.target))
    .map((profile) => ({
      ...profile,
      matchedFilterCount: getProfileSpecificity(profile),
    }))
    .sort((a, b) => b.matchedFilterCount - a.matchedFilterCount)

  return matches[0] ?? null
}
