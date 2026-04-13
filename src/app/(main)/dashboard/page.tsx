import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { authTrace, maskAuthEmail } from '@/lib/auth-trace'
import { getDashboardPageData } from '@/server/dashboard-page'
import { DashboardPageShell } from '@/components/dashboard/DashboardPageShell'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    authTrace('warn', 'LOGIN_REDIRECT_TRIGGERED', {
      route: '/dashboard',
      reason: 'DASHBOARD_SESSION_MISSING',
    })
    redirect('/login')
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
