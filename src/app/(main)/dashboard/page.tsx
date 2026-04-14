import { authTrace, maskAuthEmail } from '@/lib/auth-trace'
import { requireProtectedPageSession } from '@/server/auth/protected-page'
import { getDashboardPageData } from '@/server/dashboard-page'
import { DashboardPageShell } from '@/components/dashboard/DashboardPageShell'

export default async function DashboardPage() {
  const session = await requireProtectedPageSession({
    route: '/dashboard',
    pathname: '/dashboard',
  })

  authTrace('info', 'LANDING_ROUTE_ENTERED', {
    route: '/dashboard',
    userId: session.user.id,
    email: maskAuthEmail(session.user.email),
    role: session.user.role,
  })
  const data = await getDashboardPageData(session)
  return <DashboardPageShell data={data} />
}
