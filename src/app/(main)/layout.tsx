import { getServerSession } from 'next-auth'
import type { ReactNode } from 'react'
import { authOptions } from '@/lib/auth'
import { hasFullAppSessionUserClaims } from '@/lib/auth-session'
import { authTrace, maskAuthEmail } from '@/lib/auth-trace'
import { redirect } from 'next/navigation'
import { MainShell } from '@/components/layout/MainShell'

export default async function MainLayout({
  children,
}: {
  children: ReactNode
}) {
  const session = await getServerSession(authOptions)
  if (session?.authState === 'AUTHENTICATED_BUT_CLAIMS_MISSING') {
    authTrace('warn', 'AUTH_CLAIMS_PENDING_REDIRECT', {
      route: '(main)/layout',
      reason: session.authErrorCode ?? 'AuthenticatedButClaimsMissing',
      authErrorReason: session.authErrorReason ?? null,
      sessionPresent: true,
      hasUserId: Boolean(session.user?.id),
      hasRole: Boolean(session.user?.role),
    })
    redirect('/access-pending?reason=AuthenticatedButClaimsMissing')
  }

  if (!session || !hasFullAppSessionUserClaims(session.user)) {
    authTrace('warn', 'LOGIN_REDIRECT_TRIGGERED', {
      route: '(main)/layout',
      reason: session ? 'MAIN_LAYOUT_SESSION_INCOMPLETE' : 'MAIN_LAYOUT_SESSION_MISSING',
      sessionPresent: Boolean(session),
      hasUserId: Boolean(session?.user?.id),
      hasRole: Boolean(session?.user?.role),
    })
    redirect('/login?error=SessionRequired')
  }

  authTrace('info', 'LANDING_ROUTE_ENTERED', {
    route: '(main)/layout',
    userId: session.user.id,
    email: maskAuthEmail(session.user.email),
    role: session.user.role,
  })

  return (
    <MainShell session={session}>{children}</MainShell>
  )
}
