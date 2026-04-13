const PLACEHOLDER_ENV_VALUES = new Set([
  'your-google-client-id',
  'your-google-client-secret',
  'your-nextauth-secret-change-in-production',
  'your-random-secret-key',
  'change-me',
])

type AuthEnvKey = 'NEXTAUTH_URL' | 'AUTH_URL' | 'NEXTAUTH_SECRET' | 'AUTH_SECRET'
type AuthEnvSource = Record<string, string | undefined>

type AuthCookieOption = {
  name: string
  options: {
    httpOnly: boolean
    sameSite: 'lax'
    path: '/'
    secure: boolean
    maxAge?: number
  }
}

export type AuthCookiePolicy = {
  sessionToken: AuthCookieOption
  callbackUrl: AuthCookieOption
  csrfToken: AuthCookieOption
  pkceCodeVerifier: AuthCookieOption
  state: AuthCookieOption
  nonce: AuthCookieOption
}

export type AuthRuntimePolicy = {
  shouldTrustHost: boolean
  useSecureCookies: boolean
  sessionTokenCookieName: string
  callbackUrlCookieName: string
  csrfTokenCookieName: string
  cookiePrefix: string
}

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

function isTruthyEnvValue(value: string | undefined) {
  return /^(1|true|yes|on)$/i.test(value?.trim() ?? '')
}

function readRequiredValue(key: string, value: string | undefined) {
  if (!value) {
    throw new Error(
      `[auth] Missing required environment variable: ${key}. ` +
        'This project uses NEXTAUTH_URL/AUTH_URL, NEXTAUTH_SECRET/AUTH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and ALLOWED_DOMAIN.'
    )
  }

  if (
    (key === 'GOOGLE_CLIENT_ID' ||
      key === 'GOOGLE_CLIENT_SECRET' ||
      key === 'NEXTAUTH_SECRET' ||
      key === 'AUTH_SECRET') &&
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

export function resolveAuthRuntimePolicy(env: AuthEnvSource = process.env): AuthRuntimePolicy {
  const normalizedBaseUrl = env.NEXTAUTH_URL?.trim() || env.AUTH_URL?.trim() || ''
  const isProduction = env.NODE_ENV === 'production'
  const shouldTrustHost =
    isTruthyEnvValue(env.AUTH_TRUST_HOST) || Boolean(env.VERCEL) || !isProduction
  const useSecureCookies =
    isProduction &&
    (shouldTrustHost || normalizedBaseUrl.toLowerCase().startsWith('https://'))

  return {
    shouldTrustHost,
    useSecureCookies,
    cookiePrefix: useSecureCookies ? '__Secure-' : '',
    sessionTokenCookieName: useSecureCookies
      ? '__Secure-next-auth.session-token'
      : 'next-auth.session-token',
    callbackUrlCookieName: useSecureCookies
      ? '__Secure-next-auth.callback-url'
      : 'next-auth.callback-url',
    csrfTokenCookieName: useSecureCookies
      ? '__Host-next-auth.csrf-token'
      : 'next-auth.csrf-token',
  }
}

export function applyAuthRuntimeEnvironment(env: AuthEnvSource = process.env) {
  const policy = resolveAuthRuntimePolicy(env)

  if (policy.shouldTrustHost && !env.AUTH_TRUST_HOST) {
    env.AUTH_TRUST_HOST = 'true'
  }

  return policy
}

export function buildAuthCookiePolicy(
  runtimePolicy: AuthRuntimePolicy = resolveAuthRuntimePolicy()
): AuthCookiePolicy {
  const secure = runtimePolicy.useSecureCookies
  const sharedOptions = {
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/' as const,
    secure,
  }

  return {
    sessionToken: {
      name: runtimePolicy.sessionTokenCookieName,
      options: sharedOptions,
    },
    callbackUrl: {
      name: runtimePolicy.callbackUrlCookieName,
      options: sharedOptions,
    },
    csrfToken: {
      name: runtimePolicy.csrfTokenCookieName,
      options: sharedOptions,
    },
    pkceCodeVerifier: {
      name: `${runtimePolicy.cookiePrefix}next-auth.pkce.code_verifier`,
      options: {
        ...sharedOptions,
        maxAge: 60 * 15,
      },
    },
    state: {
      name: `${runtimePolicy.cookiePrefix}next-auth.state`,
      options: {
        ...sharedOptions,
        maxAge: 60 * 15,
      },
    },
    nonce: {
      name: `${runtimePolicy.cookiePrefix}next-auth.nonce`,
      options: sharedOptions,
    },
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
    googleClientSecret: readRequiredValue(
      'GOOGLE_CLIENT_SECRET',
      env.GOOGLE_CLIENT_SECRET?.trim()
    ),
    allowedDomain: readRequiredValue('ALLOWED_DOMAIN', env.ALLOWED_DOMAIN?.trim())
      .toLowerCase()
      .replace(/^@/, ''),
  }
}
