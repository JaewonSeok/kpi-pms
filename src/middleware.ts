import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { canAccessMenu, resolveMenuFromPath } from '@/lib/auth/permissions'

const PUBLIC_PATHS = ['/login', '/403', '/api/auth']

export default withAuth(
  function middleware(
    req: NextRequest & {
      nextauth: {
        token: {
          role?: string
        } | null
      }
    }
  ) {
    const { pathname } = req.nextUrl
    const token = req.nextauth.token

    if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
      if (pathname.startsWith('/login') && token) {
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
  matcher: ['/((?!_next/static|_next/image|favicon.ico|login|403|api/auth).*)'],
}
