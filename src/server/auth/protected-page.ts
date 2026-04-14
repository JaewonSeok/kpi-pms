import { headers } from 'next/headers'
import { getServerSession, type Session } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { buildAuthCookieNameCandidates, readAuthSecretValue } from '@/lib/auth-env'
import { resolveRequestAuthToken } from '@/lib/auth-middleware'
import { resolveProtectedSessionAccess } from '@/lib/auth-session'
import { authTrace, maskAuthEmail } from '@/lib/auth-trace'

const authSecret = readAuthSecretValue()
const authCookieCandidates = buildAuthCookieNameCandidates()

async function resolveProtectedFallbackToken(pathname: string) {
  const requestHeaders = await headers()
  const host =
    requestHeaders.get('x-forwarded-host') ??
    requestHeaders.get('host') ??
    'kpi-pms.vercel.app'
  const proto = requestHeaders.get('x-forwarded-proto') ?? 'https'
  const request = new Request(`${proto}://${host}${pathname}`, {
    headers: new Headers(requestHeaders),
  })

  return resolveRequestAuthToken({
    request,
    secret: authSecret,
    sessionCookieNames: authCookieCandidates.sessionToken,
  })
}

export async function requireProtectedPageSession(params: {
  route: string
  pathname: string
}): Promise<Session> {
  const session = await getServerSession(authOptions)
  let accessDecision = resolveProtectedSessionAccess({ session })
  let fallbackToken: Awaited<
    ReturnType<typeof resolveProtectedFallbackToken>
  >['token'] | null = null

  if (accessDecision.action === 'redirect-login') {
    authTrace('warn', 'PROTECTED_PAGE_SESSION_NULL', {
      route: params.route,
      pathname: params.pathname,
      sessionPresent: Boolean(session),
      hasUserId: Boolean(session?.user?.id),
      hasRole: Boolean(session?.user?.role),
    })

    const resolvedFallback = await resolveProtectedFallbackToken(params.pathname)
    fallbackToken = resolvedFallback.token
    accessDecision = resolveProtectedSessionAccess({
      session,
      fallbackToken,
    })

    if (accessDecision.action === 'redirect-pending') {
      authTrace('warn', 'PROTECTED_PAGE_TOKEN_FALLBACK_IDENTITY_FOUND', {
        route: params.route,
        pathname: params.pathname,
        reason: accessDecision.reason,
        authErrorReason: accessDecision.authErrorReason,
        source: accessDecision.source,
        tokenSub: fallbackToken?.sub ?? null,
        email: maskAuthEmail(fallbackToken?.email),
      })
    }
  }

  if (accessDecision.action === 'redirect-pending') {
    authTrace('warn', 'PROTECTED_PAGE_PENDING_REDIRECT', {
      route: params.route,
      pathname: params.pathname,
      reason: accessDecision.reason,
      authErrorReason: accessDecision.authErrorReason,
      source: accessDecision.source,
      sessionPresent: Boolean(session),
      hasUserId: Boolean(session?.user?.id || fallbackToken?.sub),
      hasRole: Boolean(session?.user?.role || fallbackToken?.role),
    })
    redirect(`/access-pending?reason=${encodeURIComponent(accessDecision.reason)}`)
  }

  if (accessDecision.action === 'redirect-login') {
    authTrace('warn', 'PROTECTED_PAGE_TRUE_UNAUTHENTICATED', {
      route: params.route,
      pathname: params.pathname,
      reason: accessDecision.reason,
      sessionPresent: false,
      hasFallbackToken: Boolean(fallbackToken),
    })
    redirect('/login?error=SessionRequired')
  }

  if (!session) {
    authTrace('error', 'PROTECTED_PAGE_SESSION_INVARIANT_BROKEN', {
      route: params.route,
      pathname: params.pathname,
      reason: 'MISSING_SESSION_AFTER_ACCESS_ALLOW',
    })
    redirect('/login?error=SessionRequired')
  }

  return session
}
