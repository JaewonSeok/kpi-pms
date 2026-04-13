import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { authTrace, maskAuthEmail } from '@/lib/auth-trace'
import { hasFullAppSessionUserClaims } from '@/lib/auth-session'
import { getDashboardPageData } from '@/server/dashboard-page'
import { DashboardPageShell } from '@/components/dashboard/DashboardPageShell'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)

  if (session?.authState === 'AUTHENTICATED_BUT_CLAIMS_MISSING') {
    authTrace('warn', 'AUTH_CLAIMS_PENDING_REDIRECT', {
      route: '/dashboard',
      reason: session.authErrorCode ?? 'AuthenticatedButClaimsMissing',
      authErrorReason: session.authErrorReason ?? null,
      sessionPresent: true,
    })
    redirect('/access-pending?reason=AuthenticatedButClaimsMissing')
  }

  if (!session || !hasFullAppSessionUserClaims(session.user)) {
    authTrace('error', 'DASHBOARD_SESSION_INVARIANT_BROKEN', {
      route: '/dashboard',
      reason: session ? 'DASHBOARD_SESSION_INCOMPLETE' : 'DASHBOARD_SESSION_MISSING',
      sessionPresent: Boolean(session),
    })
    redirect('/login?error=SessionRequired')
  }

  authTrace('info', 'LANDING_ROUTE_ENTERED', {
    route: '/dashboard',
    userId: session.user.id,
    email: maskAuthEmail(session.user.email),
    role: session.user.role,
  })
  const data = await getDashboardPageData(session)
  return <DashboardPageShell data={data} />
}
