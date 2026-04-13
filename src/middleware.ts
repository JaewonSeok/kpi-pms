import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { canAccessMenu, resolveMenuFromPath } from '@/lib/auth/permissions'
import { resolveAuthRuntimePolicy } from '@/lib/auth-env'
import { isAuthPublicPath } from '@/lib/auth-middleware'
import { hasCoreAuthTokenClaims, hasRecoverableAuthTokenIdentity } from '@/lib/auth-session'
import { authTrace } from '@/lib/auth-trace'

const authRuntimePolicy = resolveAuthRuntimePolicy()

export default withAuth(
  function middleware(
    req: NextRequest & {
      nextauth: {
        token: {
          sub?: string | null
          email?: string | null
          role?: string
          masterLogin?: {
            active?: boolean
          } | null
        } | null
      }
    }
  ) {
    const { pathname } = req.nextUrl
    const token = req.nextauth.token
    const hasValidSessionToken = hasCoreAuthTokenClaims(token)
    const hasRecoverableIdentity = hasRecoverableAuthTokenIdentity(token)
    const detectedSessionCookies = req.cookies
      .getAll()
      .map((cookie) => cookie.name)
      .filter((name) => name.startsWith(authRuntimePolicy.sessionTokenCookieName))

    if (detectedSessionCookies.length > 0) {
      authTrace('info', 'SESSION_COOKIE_DETECTED_IN_REQUEST', {
        path: pathname,
        cookieNames: detectedSessionCookies,
        sessionCookieName: authRuntimePolicy.sessionTokenCookieName,
      })
    }

    if (isAuthPublicPath(pathname)) {
      if ((pathname.startsWith('/login') || pathname.startsWith('/signin')) && hasValidSessionToken) {
        authTrace('info', 'MIDDLEWARE_SESSION_ACCEPTED', {
          path: pathname,
          reason: 'AUTHENTICATED_PUBLIC_PATH_REDIRECT',
        })
        return NextResponse.redirect(new URL('/dashboard', req.url))
      }

      return NextResponse.next()
    }

    if (!token) {
      authTrace('warn', 'MIDDLEWARE_SESSION_REJECTED', {
        path: pathname,
        reason: 'TOKEN_MISSING',
      })
      authTrace('warn', 'LOGIN_REDIRECT_TRIGGERED', {
        path: pathname,
        reason: 'TOKEN_MISSING',
      })
      return NextResponse.redirect(new URL('/login', req.url))
    }

    if (!hasValidSessionToken) {
      if (hasRecoverableIdentity) {
        authTrace('info', 'MIDDLEWARE_SESSION_ACCEPTED', {
          path: pathname,
          reason: 'RECOVERABLE_TOKEN_REHYDRATION',
          tokenSub: token.sub ?? null,
          hasEmail: typeof token.email === 'string' && token.email.length > 0,
        })
        return NextResponse.next()
      }

      authTrace('warn', 'MIDDLEWARE_SESSION_REJECTED', {
        path: pathname,
        reason: 'CLAIMS_INCOMPLETE',
        tokenSub: token.sub ?? null,
        hasEmail: typeof token.email === 'string' && token.email.length > 0,
      })
      const loginUrl = new URL('/login', req.url)
      loginUrl.searchParams.set('error', 'SessionRequired')
      authTrace('warn', 'LOGIN_REDIRECT_TRIGGERED', {
        path: pathname,
        reason: 'CLAIMS_INCOMPLETE',
        redirect: loginUrl.toString(),
      })
      return NextResponse.redirect(loginUrl)
    }

    const role = token.role ?? ''
    const menuKey = resolveMenuFromPath(pathname)

    if (menuKey && !canAccessMenu(role, menuKey)) {
      authTrace('warn', 'MIDDLEWARE_SESSION_REJECTED', {
        path: pathname,
        reason: 'MENU_FORBIDDEN',
        role,
        menuKey,
      })
      return NextResponse.redirect(new URL('/403', req.url))
    }

    authTrace('info', 'MIDDLEWARE_SESSION_ACCEPTED', {
      path: pathname,
      reason: 'CORE_CLAIMS_PRESENT',
      role,
    })
    return NextResponse.next()
  },
  {
    cookies: {
      sessionToken: {
        name: authRuntimePolicy.sessionTokenCookieName,
      },
    },
    callbacks: {
      authorized: () => true,
    },
  }
)

export const config = {
  matcher: ['/((?!_next|favicon.ico|manifest.webmanifest|sw.js|icons|login|signin|403|api/auth).*)'],
}
