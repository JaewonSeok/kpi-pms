type EnvMap = Record<string, string | undefined>

type ResolvedEnvValue = {
  value?: string
  source: string
}

export type AiAssistEnv = {
  enabled: boolean
  enabledSource: string
  apiKey?: string
  model: string
  modelSource: string
  baseUrl: string
}

function readBooleanValue(rawValue: string | undefined, fallback: boolean) {
  if (rawValue == null || rawValue === '') {
    return fallback
  }

  return rawValue === 'true'
}

function readFirstValue(env: EnvMap, keys: string[]): ResolvedEnvValue {
  for (const key of keys) {
    const value = env[key]
    if (value != null && value !== '') {
      return { value, source: key }
    }
  }

  return { source: 'default' }
}

export function readAiAssistEnv(env: EnvMap = process.env) : AiAssistEnv {
  const enabledSetting = readFirstValue(env, ['AI_ASSIST_ENABLED', 'AI_FEATURE_ENABLED', 'FEATURE_AI_ASSIST'])
  const modelSetting = readFirstValue(env, ['OPENAI_MODEL', 'OPENAI_RESPONSES_MODEL'])
  const baseUrlSetting = readFirstValue(env, ['OPENAI_BASE_URL'])

  return {
    enabled: readBooleanValue(enabledSetting.value, false),
    enabledSource: enabledSetting.source,
    apiKey: env.OPENAI_API_KEY,
    model: (modelSetting.value ?? 'gpt-5-mini').trim(),
    modelSource: modelSetting.source,
    baseUrl: (baseUrlSetting.value ?? 'https://api.openai.com/v1').replace(/\/$/, ''),
  }
}
