import type { NextRequest } from 'next/server'
import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth'
import { resolveAuthRuntimePolicy } from '@/lib/auth-env'
import { authTrace } from '@/lib/auth-trace'

const authRuntimePolicy = resolveAuthRuntimePolicy()
const handler = NextAuth(authOptions)

async function tracedAuthHandler(request: NextRequest, context: { params: Promise<{ nextauth: string[] }> }) {
  const response = await handler(request, context)
  const nextauth = (await context.params)?.nextauth ?? []
  const action = nextauth[0] ?? 'unknown'
  const provider = nextauth[1] ?? null
  const setCookieHeader = response.headers.get('set-cookie') ?? ''
  const wroteSessionCookie =
    setCookieHeader.includes(authRuntimePolicy.sessionTokenCookieName) ||
    setCookieHeader.includes(`${authRuntimePolicy.sessionTokenCookieName}.0`)

  if (action === 'callback' && provider === 'google') {
    authTrace('info', 'SESSION_COOKIE_SET', {
      action,
      provider,
      wroteSessionCookie,
      sessionCookieName: authRuntimePolicy.sessionTokenCookieName,
      location: response.headers.get('location') ?? null,
      status: response.status,
    })
  }

  return response
}

export { tracedAuthHandler as GET, tracedAuthHandler as POST }
