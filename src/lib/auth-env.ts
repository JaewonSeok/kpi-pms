const PLACEHOLDER_ENV_VALUES = new Set([
  'your-google-client-id',
  'your-google-client-secret',
  'your-nextauth-secret-change-in-production',
  'your-random-secret-key',
  'change-me',
])

type AuthEnvKey = 'NEXTAUTH_URL' | 'AUTH_URL' | 'NEXTAUTH_SECRET' | 'AUTH_SECRET'
type AuthEnvSource = Record<string, string | undefined>

function warnOnMismatch(env: AuthEnvSource, primaryKey: AuthEnvKey, aliasKey: AuthEnvKey) {
  const primaryValue = env[primaryKey]?.trim()
  const aliasValue = env[aliasKey]?.trim()

  if (primaryValue && aliasValue && primaryValue !== aliasValue) {
    console.warn(
      `[auth] ${primaryKey} and ${aliasKey} are both set but do not match. ` +
        `Using ${primaryKey}.`
    )
  }
}

function readRequiredValue(key: string, value: string | undefined) {
  if (!value) {
    throw new Error(
      `[auth] Missing required environment variable: ${key}. ` +
        'This project uses NEXTAUTH_URL/AUTH_URL, NEXTAUTH_SECRET/AUTH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and ALLOWED_DOMAIN.'
    )
  }

  if (
    (key === 'GOOGLE_CLIENT_ID' || key === 'GOOGLE_CLIENT_SECRET' || key === 'NEXTAUTH_SECRET' || key === 'AUTH_SECRET') &&
    PLACEHOLDER_ENV_VALUES.has(value)
  ) {
    throw new Error(
      `[auth] ${key} is still set to a placeholder value. ` +
        'Replace it with the real Google OAuth credential or auth secret before starting the app.'
    )
  }

  return value
}

function readRequiredUrl(env: AuthEnvSource) {
  warnOnMismatch(env, 'NEXTAUTH_URL', 'AUTH_URL')

  const rawValue = env.NEXTAUTH_URL?.trim() || env.AUTH_URL?.trim()
  const source = env.NEXTAUTH_URL?.trim() ? 'NEXTAUTH_URL' : 'AUTH_URL'
  const value = readRequiredValue(source, rawValue)

  try {
    const parsed = new URL(value)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('invalid protocol')
    }

    return {
      value: parsed.toString().replace(/\/$/, ''),
      source,
    }
  } catch {
    throw new Error(
      `[auth] ${source} must be a valid absolute URL. ` +
        'Example production callback: https://kpi-pms.vercel.app/api/auth/callback/google'
    )
  }
}

function readRequiredSecret(env: AuthEnvSource) {
  warnOnMismatch(env, 'NEXTAUTH_SECRET', 'AUTH_SECRET')

  const rawValue = env.NEXTAUTH_SECRET?.trim() || env.AUTH_SECRET?.trim()
  const source = env.NEXTAUTH_SECRET?.trim() ? 'NEXTAUTH_SECRET' : 'AUTH_SECRET'

  return {
    value: readRequiredValue(source, rawValue),
    source,
  }
}

export function readAuthEnv(env: AuthEnvSource = process.env) {
  const baseUrl = readRequiredUrl(env)
  const secret = readRequiredSecret(env)

  return {
    baseUrl: baseUrl.value,
    baseUrlSource: baseUrl.source,
    secret: secret.value,
    secretSource: secret.source,
    googleClientId: readRequiredValue('GOOGLE_CLIENT_ID', env.GOOGLE_CLIENT_ID?.trim()),
    googleClientSecret: readRequiredValue('GOOGLE_CLIENT_SECRET', env.GOOGLE_CLIENT_SECRET?.trim()),
    allowedDomain: readRequiredValue('ALLOWED_DOMAIN', env.ALLOWED_DOMAIN?.trim())
      .toLowerCase()
      .replace(/^@/, ''),
  }
}
