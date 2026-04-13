import type { NextRequest } from 'next/server'
import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth'
import {
  buildAuthCookieNameCandidates,
  collectPresentAuthCookieNames,
  extractSetCookieNames,
  resolveAuthRequestDiagnostics,
  summarizeSessionPayload,
} from '@/lib/auth-env'
import { authTrace } from '@/lib/auth-trace'

const authCookieCandidates = buildAuthCookieNameCandidates()
const handler = NextAuth(authOptions)

async function resolveSessionTrace(response: Response) {
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    return {
      sessionPresent: false,
      hasUserId: false,
      hasRole: false,
    }
  }

  try {
    const payload = await response.clone().json()
    return summarizeSessionPayload(payload)
  } catch {
    return {
      sessionPresent: false,
      hasUserId: false,
      hasRole: false,
    }
  }
}

async function tracedAuthHandler(request: NextRequest, context: { params: Promise<{ nextauth: string[] }> }) {
  const response = await handler(request, context)
  const nextauth = (await context.params)?.nextauth ?? []
  const action = nextauth[0] ?? 'unknown'
  const provider = nextauth[1] ?? null
  const diagnostics = resolveAuthRequestDiagnostics(request)
  const requestCookieNames = request.cookies.getAll().map((cookie) => cookie.name)
  const presentAuthCookieNames = collectPresentAuthCookieNames(
    requestCookieNames,
    authCookieCandidates.sessionToken
  )
  const setCookieNames = extractSetCookieNames(response.headers)
  const wroteSessionCookie = collectPresentAuthCookieNames(
    setCookieNames,
    authCookieCandidates.sessionToken
  ).length > 0

  if (action === 'callback' && provider === 'google') {
    authTrace('info', 'SESSION_COOKIE_SET', {
      action,
      provider,
      wroteSessionCookie,
      host: diagnostics.host,
      forwardedHost: diagnostics.forwardedHost,
      forwardedProto: diagnostics.forwardedProto,
      originCandidate: diagnostics.originCandidate,
      setCookieNames,
      location: response.headers.get('location') ?? null,
      status: response.status,
    })
  }

  if (action === 'session') {
    const sessionTrace = await resolveSessionTrace(response)
    authTrace('info', 'AUTH_SESSION_TRACE', {
      action,
      host: diagnostics.host,
      forwardedHost: diagnostics.forwardedHost,
      forwardedProto: diagnostics.forwardedProto,
      originCandidate: diagnostics.originCandidate,
      requestAuthCookieNames: presentAuthCookieNames,
      responseStatus: response.status,
      ...sessionTrace,
    })
  }

  return response
}

export { tracedAuthHandler as GET, tracedAuthHandler as POST }
