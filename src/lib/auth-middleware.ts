import { getToken } from 'next-auth/jwt'
import {
  buildAuthCookieNameCandidates,
  collectPresentAuthCookieNames,
  resolveMatchedAuthCookieCandidate,
} from './auth-env'

export const AUTH_PUBLIC_PATHS = [
  '/login',
  '/signin',
  '/403',
  '/manifest.webmanifest',
  '/sw.js',
  '/favicon.ico',
  '/icon-192.svg',
  '/icon-512.svg',
] as const

export const AUTH_PUBLIC_PATH_PREFIXES = ['/_next', '/icons', '/api/auth', '/manifest'] as const
const AUTH_LOGIN_PATH_PREFIXES = ['/login', '/signin'] as const
const STATIC_ASSET_PATTERN =
  /\.(?:css|js|mjs|png|jpg|jpeg|gif|svg|ico|webp|map|txt|xml|json|woff2?|ttf|eot)$/i

export type MiddlewareDecisionReason =
  | 'CORE_CLAIMS_PRESENT'
  | 'PUBLIC_PATH'
  | 'TOKEN_MISSING'
  | 'PARTIAL_TOKEN_REHYDRATE'
  | 'SESSION_REQUIRED'
  | 'UNAUTHORIZED_MENU'
  | 'LOGIN_ALREADY_AUTHENTICATED'

export type MiddlewareDecision =
  | {
      action: 'allow'
      reason: Exclude<MiddlewareDecisionReason, 'TOKEN_MISSING' | 'SESSION_REQUIRED' | 'UNAUTHORIZED_MENU' | 'LOGIN_ALREADY_AUTHENTICATED'>
    }
  | {
      action: 'redirect-login'
      reason: Extract<MiddlewareDecisionReason, 'TOKEN_MISSING' | 'SESSION_REQUIRED'>
    }
  | {
      action: 'redirect-403'
      reason: 'UNAUTHORIZED_MENU'
    }
  | {
      action: 'redirect-dashboard'
      reason: 'LOGIN_ALREADY_AUTHENTICATED'
    }

export type ResolvedRequestAuthToken = {
  token: Awaited<ReturnType<typeof getToken>>
  matchedSessionCookieName: string | null
  presentSessionCookieNames: string[]
}

function parseCookieHeader(cookieHeader: string) {
  return cookieHeader
    .split(';')
    .map((cookie) => cookie.trim())
    .filter((cookie) => cookie.length > 0)
    .reduce<Record<string, string>>((cookies, cookie) => {
      const separatorIndex = cookie.indexOf('=')
      const cookieName = separatorIndex >= 0 ? cookie.slice(0, separatorIndex).trim() : cookie.trim()
      const cookieValue = separatorIndex >= 0 ? cookie.slice(separatorIndex + 1).trim() : ''

      if (cookieName) {
        cookies[cookieName] = cookieValue
      }

      return cookies
    }, {})
}

export function isAuthPublicPath(pathname: string) {
  return (
    AUTH_PUBLIC_PATHS.includes(pathname as (typeof AUTH_PUBLIC_PATHS)[number]) ||
    AUTH_PUBLIC_PATH_PREFIXES.some((path) => pathname.startsWith(path)) ||
    STATIC_ASSET_PATTERN.test(pathname)
  )
}

export function isLoginPath(pathname: string) {
  return AUTH_LOGIN_PATH_PREFIXES.some((path) => pathname.startsWith(path))
}

export function resolveMiddlewareAccessDecision(params: {
  pathname: string
  tokenPresent: boolean
  hasCoreClaims: boolean
  hasRecoverableIdentity: boolean
  menuAuthorized?: boolean | null
}) {
  if (isAuthPublicPath(params.pathname)) {
    if (isLoginPath(params.pathname) && params.hasCoreClaims) {
      return {
        action: 'redirect-dashboard',
        reason: 'LOGIN_ALREADY_AUTHENTICATED',
      } satisfies MiddlewareDecision
    }

    return {
      action: 'allow',
      reason: 'PUBLIC_PATH',
    } satisfies MiddlewareDecision
  }

  if (!params.tokenPresent) {
    return {
      action: 'redirect-login',
      reason: 'TOKEN_MISSING',
    } satisfies MiddlewareDecision
  }

  if (!params.hasCoreClaims) {
    if (params.hasRecoverableIdentity) {
      return {
        action: 'allow',
        reason: 'PARTIAL_TOKEN_REHYDRATE',
      } satisfies MiddlewareDecision
    }

    return {
      action: 'redirect-login',
      reason: 'SESSION_REQUIRED',
    } satisfies MiddlewareDecision
  }

  if (params.menuAuthorized === false) {
    return {
      action: 'redirect-403',
      reason: 'UNAUTHORIZED_MENU',
    } satisfies MiddlewareDecision
  }

  return {
    action: 'allow',
    reason: 'CORE_CLAIMS_PRESENT',
  } satisfies MiddlewareDecision
}

export async function resolveRequestAuthToken(params: {
  request: Request | Pick<Request, 'headers'>
  secret: string
  sessionCookieNames?: readonly string[]
}) {
  const sessionCookieNames =
    params.sessionCookieNames ?? buildAuthCookieNameCandidates().sessionToken
  const cookieHeader = params.request.headers.get('cookie') ?? ''
  const cookieNames = cookieHeader
    .split(';')
    .map((cookie) => cookie.trim().split('=')[0]?.trim() ?? '')
    .filter((cookieName) => cookieName.length > 0)

  const presentSessionCookieNames = collectPresentAuthCookieNames(cookieNames, sessionCookieNames)
  const request =
    'cookies' in params.request && params.request.cookies
      ? (params.request as Parameters<typeof getToken>[0]['req'])
      : ({
          headers: new Headers(
            cookieHeader
              ? {
                  cookie: cookieHeader,
                }
              : undefined
          ),
          cookies: parseCookieHeader(cookieHeader),
        } as unknown as Parameters<typeof getToken>[0]['req'])
  let token: Awaited<ReturnType<typeof getToken>> = null
  let matchedSessionCookieName: string | null = null

  for (const sessionCookieName of sessionCookieNames) {
    token = await getToken({
      req: request,
      secret: params.secret,
      cookieName: sessionCookieName,
      secureCookie:
        sessionCookieName.startsWith('__Secure-') || sessionCookieName.startsWith('__Host-'),
    })

    if (token) {
      matchedSessionCookieName = sessionCookieName
      break
    }
  }

  return {
    token,
    matchedSessionCookieName:
      matchedSessionCookieName ??
      resolveMatchedAuthCookieCandidate(presentSessionCookieNames, sessionCookieNames),
    presentSessionCookieNames,
  } satisfies ResolvedRequestAuthToken
}
