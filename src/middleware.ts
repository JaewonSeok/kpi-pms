import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { canAccessMenu, resolveMenuFromPath } from '@/lib/auth/permissions'
import { buildAuthCookieNameCandidates, readAuthSecretValue, resolveAuthRequestDiagnostics } from '@/lib/auth-env'
import { resolveMiddlewareAccessDecision, resolveRequestAuthToken } from '@/lib/auth-middleware'
import { hasCoreAuthTokenClaims, hasRecoverableAuthTokenIdentity } from '@/lib/auth-session'
import { authTrace } from '@/lib/auth-trace'

const authSecret = readAuthSecretValue()
const authCookieCandidates = buildAuthCookieNameCandidates()

function buildLoginRedirect(request: NextRequest) {
  const loginUrl = new URL('/login', request.url)
  loginUrl.searchParams.set('error', 'SessionRequired')
  return loginUrl
}

function buildAccessPendingRedirect(
  request: NextRequest,
  reason = 'AuthenticatedButClaimsMissing'
) {
  const pendingUrl = new URL('/access-pending', request.url)
  pendingUrl.searchParams.set('reason', reason)
  return pendingUrl
}

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const requestDiagnostics = resolveAuthRequestDiagnostics(request)
  const { token, matchedSessionCookieName, presentSessionCookieNames } =
    await resolveRequestAuthToken({
      request,
      secret: authSecret,
      sessionCookieNames: authCookieCandidates.sessionToken,
    })

  const hasCoreClaims = hasCoreAuthTokenClaims(token)
  const hasRecoverableIdentity = hasRecoverableAuthTokenIdentity(token)
  const claimsPending = token?.authState === 'AUTHENTICATED_BUT_CLAIMS_MISSING'
  const role = typeof token?.role === 'string' ? token.role : ''
  const menuKey = resolveMenuFromPath(pathname)
  const menuAuthorized = menuKey ? canAccessMenu(role, menuKey) : null
  const decision = resolveMiddlewareAccessDecision({
    pathname,
    tokenPresent: Boolean(token),
    hasCoreClaims,
    hasRecoverableIdentity,
    claimsPending,
    menuAuthorized,
  })
  const tracePayload = {
    path: pathname,
    reason: decision.reason,
    host: requestDiagnostics.host,
    forwardedHost: requestDiagnostics.forwardedHost,
    forwardedProto: requestDiagnostics.forwardedProto,
    originCandidate: requestDiagnostics.originCandidate,
    nodeEnv: requestDiagnostics.nodeEnv,
    vercelEnv: requestDiagnostics.vercelEnv,
    vercel: requestDiagnostics.vercel,
    presentSessionCookieNames,
    matchedSessionCookieName,
    sessionPresent: Boolean(token),
    hasCoreClaims,
    hasRecoverableIdentity,
    claimsPending,
    menuKey,
    role,
  }

  if (decision.action === 'allow') {
    authTrace('info', 'MIDDLEWARE_SESSION_ACCEPTED', tracePayload)
    return NextResponse.next()
  }

  if (decision.action === 'redirect-dashboard') {
    authTrace('info', 'MIDDLEWARE_SESSION_ACCEPTED', tracePayload)
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  if (decision.action === 'redirect-403') {
    authTrace('warn', 'MIDDLEWARE_SESSION_REJECTED', tracePayload)
    return NextResponse.redirect(new URL('/403', request.url))
  }

  if (decision.action === 'redirect-pending') {
    const pendingReason =
      token?.authErrorCode === 'CLAIMS_REHYDRATION_FAILED'
        ? 'CLAIMS_REHYDRATION_FAILED'
        : 'AuthenticatedButClaimsMissing'
    const pendingUrl = buildAccessPendingRedirect(request, pendingReason)
    authTrace('warn', 'AUTH_CLAIMS_PENDING_REDIRECT', {
      ...tracePayload,
      redirect: pendingUrl.toString(),
    })
    return NextResponse.redirect(pendingUrl)
  }

  const loginUrl = buildLoginRedirect(request)
  authTrace('warn', 'MIDDLEWARE_SESSION_REJECTED', tracePayload)
  authTrace('warn', 'LOGIN_REDIRECT_TRIGGERED', {
    ...tracePayload,
    redirect: loginUrl.toString(),
  })
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|.*\\.(?:css|js|mjs|png|jpg|jpeg|gif|svg|ico|webp|map|txt|xml|json|woff2?|ttf|eot)$).*)'],
}
