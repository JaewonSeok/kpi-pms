export type FeatureFlagKey =
  | 'aiAssist'
  | 'notificationsScheduler'
  | 'opsDashboard'
  | 'pwaShell'
  | 'emailDelivery'
  | 'evaluation2026Preview'
  | 'evaluation2026OfficialScoring'
  | 'evaluation2026OfficialGrade'
  | 'evaluation2026AiScoreExclusion'
  | 'evaluation2026BackfillApplied'
  | 'evaluation2026BackfillExcluded'
  | 'evaluation2026HrApproval'

type FeatureFlagDefinition = {
  key: FeatureFlagKey
  envKey: string
  description: string
  defaultValue: boolean
}

const FEATURE_FLAG_DEFINITIONS: FeatureFlagDefinition[] = [
  {
    key: 'aiAssist',
    envKey: 'FEATURE_AI_ASSIST',
    description: 'Controls OpenAI-powered KPI and evaluation assistance.',
    defaultValue: false,
  },
  {
    key: 'notificationsScheduler',
    envKey: 'FEATURE_NOTIFICATIONS_SCHEDULER',
    description: 'Controls scheduled reminders and notification dispatch jobs.',
    defaultValue: true,
  },
  {
    key: 'opsDashboard',
    envKey: 'FEATURE_OPS_DASHBOARD',
    description: 'Controls the admin operations dashboard and metrics endpoints.',
    defaultValue: true,
  },
  {
    key: 'pwaShell',
    envKey: 'FEATURE_PWA_SHELL',
    description: 'Controls service worker registration and PWA shell behavior.',
    defaultValue: true,
  },
  {
    key: 'emailDelivery',
    envKey: 'FEATURE_EMAIL_DELIVERY',
    description: 'Controls outbound email delivery for notifications.',
    defaultValue: true,
  },
  {
    key: 'evaluation2026Preview',
    envKey: 'EVALUATION_2026_PREVIEW_ENABLED',
    description: 'Controls HR/admin-only 2026 evaluation policy preview surfaces.',
    defaultValue: true,
  },
  {
    key: 'evaluation2026OfficialScoring',
    envKey: 'EVALUATION_2026_OFFICIAL_SCORING_ENABLED',
    description: 'Controls official 2026 evaluation scoring activation. Must stay false by default.',
    defaultValue: false,
  },
  {
    key: 'evaluation2026OfficialGrade',
    envKey: 'EVALUATION_2026_OFFICIAL_GRADE_ENABLED',
    description: 'Controls official 2026 grade calculation activation. Must stay false by default.',
    defaultValue: false,
  },
  {
    key: 'evaluation2026AiScoreExclusion',
    envKey: 'EVALUATION_2026_AI_SCORE_EXCLUSION_ENABLED',
    description: 'Controls official AI score exclusion from annual totals. Must stay false by default.',
    defaultValue: false,
  },
  {
    key: 'evaluation2026BackfillApplied',
    envKey: 'EVALUATION_2026_BACKFILL_APPLIED',
    description: 'Marks that 2026 policy metadata backfill was explicitly applied.',
    defaultValue: false,
  },
  {
    key: 'evaluation2026BackfillExcluded',
    envKey: 'EVALUATION_2026_BACKFILL_EXCLUDED',
    description: 'Marks that HR explicitly excluded backfill for the activation scope.',
    defaultValue: false,
  },
  {
    key: 'evaluation2026HrApproval',
    envKey: 'EVALUATION_2026_HR_APPROVAL_CONFIRMED',
    description: 'Marks explicit HR/admin approval for official 2026 policy activation.',
    defaultValue: false,
  },
]

function readBooleanEnv(key: string, fallback: boolean, env: NodeJS.ProcessEnv = process.env) {
  const rawValue = env[key]
  if (rawValue == null || rawValue === '') return fallback
  return rawValue === 'true'
}

function readAiAssistFlag(fallback: boolean) {
  if (process.env.AI_ASSIST_ENABLED != null) {
    return readBooleanEnv('AI_ASSIST_ENABLED', fallback)
  }

  if (process.env.AI_FEATURE_ENABLED != null) {
    return readBooleanEnv('AI_FEATURE_ENABLED', fallback)
  }

  if (process.env.FEATURE_AI_ASSIST != null) {
    return readBooleanEnv('FEATURE_AI_ASSIST', fallback)
  }

  return fallback
}

export function getFeatureFlagSnapshot() {
  return FEATURE_FLAG_DEFINITIONS.map((definition) => ({
    key: definition.key,
    envKey: definition.envKey,
    description: definition.description,
    enabled:
      definition.key === 'aiAssist'
        ? readAiAssistFlag(definition.defaultValue)
        : readBooleanEnv(definition.envKey, definition.defaultValue),
  }))
}

export function isFeatureEnabled(key: FeatureFlagKey) {
  const definition = FEATURE_FLAG_DEFINITIONS.find((item) => item.key === key)
  if (!definition) return false

  if (key === 'aiAssist') {
    return readAiAssistFlag(definition.defaultValue)
  }

  return readBooleanEnv(definition.envKey, definition.defaultValue)
}

export type Evaluation2026FeatureFlags = {
  previewEnabled: boolean
  officialScoringEnabled: boolean
  officialGradeEnabled: boolean
  aiScoreExclusionEnabled: boolean
  backfillApplied: boolean
  backfillExcluded: boolean
  hrApprovalConfirmed: boolean
}

function readDefinitionFlag(key: FeatureFlagKey, env: NodeJS.ProcessEnv) {
  const definition = FEATURE_FLAG_DEFINITIONS.find((item) => item.key === key)
  if (!definition) return false
  return readBooleanEnv(definition.envKey, definition.defaultValue, env)
}

export function get2026EvaluationFeatureFlags(env: NodeJS.ProcessEnv = process.env): Evaluation2026FeatureFlags {
  return {
    previewEnabled: readDefinitionFlag('evaluation2026Preview', env),
    officialScoringEnabled: readDefinitionFlag('evaluation2026OfficialScoring', env),
    officialGradeEnabled: readDefinitionFlag('evaluation2026OfficialGrade', env),
    aiScoreExclusionEnabled: readDefinitionFlag('evaluation2026AiScoreExclusion', env),
    backfillApplied: readDefinitionFlag('evaluation2026BackfillApplied', env),
    backfillExcluded: readDefinitionFlag('evaluation2026BackfillExcluded', env),
    hrApprovalConfirmed: readDefinitionFlag('evaluation2026HrApproval', env),
  }
}

export function is2026PreviewOnlyMode(flags: Evaluation2026FeatureFlags = get2026EvaluationFeatureFlags()) {
  return (
    flags.previewEnabled &&
    !flags.officialScoringEnabled &&
    !flags.officialGradeEnabled &&
    !flags.aiScoreExclusionEnabled
  )
}

export function is2026OfficialActivationAllowed(flags: Evaluation2026FeatureFlags = get2026EvaluationFeatureFlags()) {
  return (
    flags.officialScoringEnabled &&
    flags.officialGradeEnabled &&
    flags.aiScoreExclusionEnabled &&
    flags.hrApprovalConfirmed &&
    (flags.backfillApplied || flags.backfillExcluded)
  )
}

export function assert2026OfficialScoringEnabled(flags: Evaluation2026FeatureFlags = get2026EvaluationFeatureFlags()) {
  if (!flags.officialScoringEnabled) {
    throw new Error('2026 official scoring is disabled. Use preview-only paths until activation readiness passes.')
  }
}
