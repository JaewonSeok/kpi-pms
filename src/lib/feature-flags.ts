export type FeatureFlagKey =
  | 'aiAssist'
  | 'notificationsScheduler'
  | 'compensationPlanning'
  | 'opsDashboard'
  | 'pwaShell'
  | 'emailDelivery'

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
    key: 'compensationPlanning',
    envKey: 'FEATURE_COMPENSATION_PLANNING',
    description: 'Controls compensation rule/scenario management features.',
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
]

function readBooleanEnv(key: string, fallback: boolean) {
  const rawValue = process.env[key]
  if (rawValue == null || rawValue === '') return fallback
  return rawValue === 'true'
}

export function getFeatureFlagSnapshot() {
  return FEATURE_FLAG_DEFINITIONS.map((definition) => ({
    key: definition.key,
    envKey: definition.envKey,
    description: definition.description,
    enabled:
      definition.key === 'aiAssist' && process.env.AI_FEATURE_ENABLED != null
        ? readBooleanEnv('AI_FEATURE_ENABLED', definition.defaultValue)
        : readBooleanEnv(definition.envKey, definition.defaultValue),
  }))
}

export function isFeatureEnabled(key: FeatureFlagKey) {
  const definition = FEATURE_FLAG_DEFINITIONS.find((item) => item.key === key)
  if (!definition) return false

  if (key === 'aiAssist' && process.env.AI_FEATURE_ENABLED != null) {
    return readBooleanEnv('AI_FEATURE_ENABLED', definition.defaultValue)
  }

  return readBooleanEnv(definition.envKey, definition.defaultValue)
}
