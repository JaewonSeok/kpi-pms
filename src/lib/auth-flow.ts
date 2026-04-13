import { normalizeGoogleWorkspaceEmail } from './google-workspace'

export const DEFAULT_POST_LOGIN_PATH = '/dashboard'

export const LOGIN_ERROR_MESSAGES: Record<string, string> = {
  InvalidDomain: '사내 Google Workspace 계정으로만 로그인할 수 있습니다.',
  NotRegistered:
    'Google 계정은 확인되었지만 시스템 사용 권한이 없습니다. HR 관리자에게 문의해 주세요.',
  InactiveAccount: '비활성화된 계정입니다. HR 관리자에게 문의해 주세요.',
  OAuthAccountNotLinked: '다른 로그인 방식으로 이미 연결된 계정입니다.',
  OAuthProfileMissing:
    'Google 계정 이메일을 확인하지 못했습니다. 다른 계정으로 다시 시도해 주세요.',
  AccessDenied:
    '로그인에 성공했지만 사용자 권한을 확인하지 못했습니다. 관리자에게 문의해 주세요.',
  Configuration: '로그인 설정에 문제가 있습니다. 관리자에게 문의해 주세요.',
  OAuthSignin: 'Google 로그인 시작 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.',
  OAuthCallback: 'Google 인증 응답을 처리하는 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.',
  Callback: '로그인 결과를 확인하는 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.',
  SessionRequired: '세션 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.',
  AuthenticatedButClaimsMissing:
    'Google 로그인은 완료됐지만 사내 권한 정보를 확인하지 못했습니다. 잠시 후 다시 시도하거나 HR 관리자에게 문의해 주세요.',
  CookieNotPersisted:
    '로그인 쿠키를 유지하지 못했습니다. 브라우저 쿠키 설정을 확인한 뒤 다시 시도해 주세요.',
  Default: '로그인 중 오류가 발생했습니다. 다시 시도해 주세요.',
}

export type GoogleAccessDecision =
  | {
      allowed: true
      normalizedEmail: string
    }
  | {
      allowed: false
      normalizedEmail: string | null
      errorCode: keyof typeof LOGIN_ERROR_MESSAGES
    }

export type LoginFeedbackKind = 'auth' | 'access' | 'session'

const LOGIN_ERROR_KINDS: Record<string, LoginFeedbackKind> = {
  InvalidDomain: 'access',
  NotRegistered: 'access',
  InactiveAccount: 'access',
  AccessDenied: 'access',
  SessionRequired: 'session',
  OAuthCallback: 'session',
  Callback: 'session',
  AuthenticatedButClaimsMissing: 'session',
  CookieNotPersisted: 'session',
}

function normalizeAllowedDomain(domain: string) {
  return domain.trim().toLowerCase().replace(/^@/, '')
}

function buildAbsoluteUrl(origin: string, path: string) {
  return new URL(path, origin).toString()
}

function isUnsafePostLoginPath(pathname: string) {
  return (
    pathname === '/login' ||
    pathname === '/signin' ||
    pathname.startsWith('/login?') ||
    pathname.startsWith('/signin?') ||
    pathname.startsWith('/api/auth')
  )
}

export function getLoginErrorMessage(errorCode?: string | null) {
  if (!errorCode) {
    return null
  }

  return LOGIN_ERROR_MESSAGES[errorCode] ?? LOGIN_ERROR_MESSAGES.Default
}

export function resolveLoginFeedback(errorCode?: string | null) {
  const message = getLoginErrorMessage(errorCode)
  if (!message) {
    return null
  }

  return {
    code: errorCode,
    kind: LOGIN_ERROR_KINDS[errorCode ?? ''] ?? 'auth',
    message,
  }
}

export function resolveClientCallbackUrl(
  requestedCallbackUrl: string | null | undefined,
  origin: string,
  fallbackPath = DEFAULT_POST_LOGIN_PATH
) {
  try {
    if (!requestedCallbackUrl) {
      return buildAbsoluteUrl(origin, fallbackPath)
    }

    const resolved = new URL(requestedCallbackUrl, origin)
    if (resolved.origin !== origin || isUnsafePostLoginPath(resolved.pathname)) {
      return buildAbsoluteUrl(origin, fallbackPath)
    }

    return resolved.toString()
  } catch {
    return buildAbsoluteUrl(origin, fallbackPath)
  }
}

export function buildGoogleSignInRequest(
  origin: string,
  requestedCallbackUrl: string | null | undefined
) {
  return {
    provider: 'google' as const,
    callbackUrl: resolveClientCallbackUrl(requestedCallbackUrl, origin),
  }
}

export function resolveAuthRedirect(
  url: string,
  baseUrl: string,
  fallbackPath = DEFAULT_POST_LOGIN_PATH
) {
  const fallbackUrl = buildAbsoluteUrl(baseUrl, fallbackPath)

  try {
    if (url.startsWith('/')) {
      return buildAbsoluteUrl(baseUrl, url)
    }

    const resolved = new URL(url)
    if (
      resolved.origin === new URL(baseUrl).origin &&
      !isUnsafePostLoginPath(resolved.pathname)
    ) {
      return resolved.toString()
    }
  } catch {
    return fallbackUrl
  }

  return fallbackUrl
}

export function decideGoogleAccess(params: {
  email?: string | null
  allowedDomain: string
  employeeStatus?: string | null
}): GoogleAccessDecision {
  if (!params.email) {
    return {
      allowed: false,
      normalizedEmail: null,
      errorCode: 'OAuthProfileMissing',
    }
  }

  const normalizedEmail = normalizeGoogleWorkspaceEmail(params.email)
  const normalizedDomain = normalizeAllowedDomain(params.allowedDomain)

  if (!normalizedEmail.endsWith(`@${normalizedDomain}`)) {
    return {
      allowed: false,
      normalizedEmail,
      errorCode: 'InvalidDomain',
    }
  }

  if (!params.employeeStatus) {
    return {
      allowed: false,
      normalizedEmail,
      errorCode: 'NotRegistered',
    }
  }

  if (params.employeeStatus !== 'ACTIVE') {
    return {
      allowed: false,
      normalizedEmail,
      errorCode: 'InactiveAccount',
    }
  }

  return {
    allowed: true,
    normalizedEmail,
  }
}
