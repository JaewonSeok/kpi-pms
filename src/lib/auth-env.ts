const PLACEHOLDER_ENV_VALUES = new Set([
  'your-google-client-id',
  'your-google-client-secret',
  'your-nextauth-secret-change-in-production',
  'your-random-secret-key',
  'change-me',
])

type AuthEnvKey = 'NEXTAUTH_URL' | 'AUTH_URL' | 'NEXTAUTH_SECRET' | 'AUTH_SECRET'
type AuthEnvSource = Record<string, string | undefined>
type HeaderMapLike = Pick<Headers, 'get'>
type AuthRequestLike =
  | HeaderMapLike
  | {
      headers?: HeaderMapLike | null
      url?: string | URL | null
      nextUrl?: {
        origin?: string | null
      } | null
}

export type AuthRequestDiagnostics = {
  host: string | null
  forwardedHost: string | null
  forwardedProto: string | null
  originCandidate: string | null
  nodeEnv: string | null
  vercelEnv: string | null
  vercel: boolean
}

type SessionPayloadUserLike = {
  id?: string | null
  email?: string | null
  name?: string | null
  role?: string | null
  empId?: string | null
  position?: string | null
  deptId?: string | null
  deptName?: string | null
  departmentCode?: string | null
  orgPath?: string | null
}

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

export type AuthCookieNameCandidates = {
  sessionToken: readonly string[]
  callbackUrl: readonly string[]
  csrfToken: readonly string[]
  pkceCodeVerifier: readonly string[]
  state: readonly string[]
  nonce: readonly string[]
}

const AUTH_COOKIE_NAME_CANDIDATES: AuthCookieNameCandidates = {
  sessionToken: ['__Secure-next-auth.session-token', 'next-auth.session-token'],
  callbackUrl: ['__Secure-next-auth.callback-url', 'next-auth.callback-url'],
  csrfToken: ['__Host-next-auth.csrf-token', 'next-auth.csrf-token'],
  pkceCodeVerifier: ['__Secure-next-auth.pkce.code_verifier', 'next-auth.pkce.code_verifier'],
  state: ['__Secure-next-auth.state', 'next-auth.state'],
  nonce: ['__Secure-next-auth.nonce', 'next-auth.nonce'],
}

const SET_COOKIE_ATTRIBUTE_NAMES = new Set([
  'expires',
  'max-age',
  'domain',
  'path',
  'secure',
  'httponly',
  'samesite',
  'priority',
  'partitioned',
])

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

function normalizeHeaderValue(value: string | null | undefined) {
  const normalized = value
    ?.split(',')[0]
    ?.trim()

  return normalized ? normalized : null
}

function resolveHeaders(request?: AuthRequestLike | null): HeaderMapLike | null {
  if (!request) {
    return null
  }

  if ('headers' in request && request.headers) {
    return request.headers
  }

  if ('get' in request) {
    return request
  }

  return null
}

function readRequestOrigin(request?: AuthRequestLike | null) {
  if (!request) {
    return null
  }

  const nextUrlOrigin =
    'nextUrl' in request && request.nextUrl?.origin ? request.nextUrl.origin : null
  if (nextUrlOrigin) {
    return nextUrlOrigin
  }

  const requestUrl = 'url' in request ? request.url : null
  if (!requestUrl) {
    return null
  }

  try {
    return new URL(requestUrl.toString()).origin
  } catch {
    return null
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

export function readAuthSecretValue(env: AuthEnvSource = process.env) {
  return readRequiredSecret(env).value
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

export function buildAuthCookieNameCandidates(): AuthCookieNameCandidates {
  return {
    sessionToken: [...AUTH_COOKIE_NAME_CANDIDATES.sessionToken],
    callbackUrl: [...AUTH_COOKIE_NAME_CANDIDATES.callbackUrl],
    csrfToken: [...AUTH_COOKIE_NAME_CANDIDATES.csrfToken],
    pkceCodeVerifier: [...AUTH_COOKIE_NAME_CANDIDATES.pkceCodeVerifier],
    state: [...AUTH_COOKIE_NAME_CANDIDATES.state],
    nonce: [...AUTH_COOKIE_NAME_CANDIDATES.nonce],
  }
}

export function isAuthCookieCandidateMatch(cookieName: string, candidateName: string) {
  return cookieName === candidateName || cookieName.startsWith(`${candidateName}.`)
}

export function collectPresentAuthCookieNames(
  cookieNames: readonly string[],
  candidateNames: readonly string[]
) {
  return [...new Set(cookieNames.filter((cookieName) =>
    candidateNames.some((candidateName) => isAuthCookieCandidateMatch(cookieName, candidateName))
  ))]
}

export function resolveMatchedAuthCookieCandidate(
  cookieNames: readonly string[],
  candidateNames: readonly string[]
) {
  return (
    candidateNames.find((candidateName) =>
      cookieNames.some((cookieName) => isAuthCookieCandidateMatch(cookieName, candidateName))
    ) ?? null
  )
}

export function extractSetCookieNames(headers: HeaderMapLike) {
  const headerBag = headers as HeaderMapLike & {
    getSetCookie?: () => string[]
  }
  if (typeof headerBag.getSetCookie === 'function') {
    return [...new Set(headerBag
      .getSetCookie()
      .map((value) => value.split('=')[0]?.trim() ?? '')
      .filter((value) => value.length > 0))]
  }

  const rawHeader = headers.get('set-cookie') ?? ''
  const cookieNames = [...rawHeader.matchAll(/(?:^|,\s*)([A-Za-z0-9!#$%&'*+.^_`|~-]+)=/g)]
    .map((match) => match[1]?.trim() ?? '')
    .filter((value) => value.length > 0 && !SET_COOKIE_ATTRIBUTE_NAMES.has(value.toLowerCase()))

  return [...new Set(cookieNames)]
}

export function summarizeSessionPayload(payload: unknown) {
  const user =
    payload && typeof payload === 'object' && 'user' in payload
      ? (payload as { user?: SessionPayloadUserLike | null }).user
      : null

  return {
    sessionPresent: Boolean(payload && typeof payload === 'object' && user),
    hasUserId: Boolean(user && typeof user.id === 'string' && user.id.length > 0),
    hasRole: Boolean(user && typeof user.role === 'string' && user.role.length > 0),
    hasFullClaims: Boolean(
      user &&
        user.id &&
        user.email &&
        user.name &&
        user.role &&
        user.empId &&
        user.position &&
        user.deptId &&
        user.deptName &&
        user.departmentCode &&
        user.orgPath
    ),
  }
}

export function resolveAuthRequestDiagnostics(
  request?: AuthRequestLike | null,
  env: AuthEnvSource = process.env
): AuthRequestDiagnostics {
  const headers = resolveHeaders(request)
  const requestOrigin = readRequestOrigin(request)
  const host = normalizeHeaderValue(headers?.get('host'))
  const forwardedHost = normalizeHeaderValue(headers?.get('x-forwarded-host'))
  const forwardedProto = normalizeHeaderValue(headers?.get('x-forwarded-proto'))
  const originCandidate =
    forwardedHost && forwardedProto
      ? `${forwardedProto}://${forwardedHost}`
      : host
        ? `${forwardedProto ?? (requestOrigin?.startsWith('https://') ? 'https' : 'http')}://${host}`
        : requestOrigin

  return {
    host,
    forwardedHost,
    forwardedProto,
    originCandidate,
    nodeEnv: env.NODE_ENV ?? null,
    vercelEnv: env.VERCEL_ENV ?? null,
    vercel: Boolean(env.VERCEL),
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
