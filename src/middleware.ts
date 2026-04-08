import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { canAccessMenu, resolveMenuFromPath } from '@/lib/auth/permissions'
import { isAuthPublicPath } from '@/lib/auth-middleware'

export default withAuth(
  function middleware(
    req: NextRequest & {
      nextauth: {
        token: {
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

    if (isAuthPublicPath(pathname)) {
      if ((pathname.startsWith('/login') || pathname.startsWith('/signin')) && token) {
        return NextResponse.redirect(new URL('/dashboard', req.url))
      }

      return NextResponse.next()
    }

    if (!token) {
      return NextResponse.redirect(new URL('/login', req.url))
    }

    const role = token.role ?? ''
    const menuKey = resolveMenuFromPath(pathname)

    if (menuKey && !canAccessMenu(role, menuKey)) {
      return NextResponse.redirect(new URL('/403', req.url))
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
)

export const config = {
  matcher: ['/((?!_next|favicon.ico|manifest.webmanifest|sw.js|icons|login|signin|403|api/auth).*)'],
}
