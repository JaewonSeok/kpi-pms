import type { ReactNode } from 'react'
import { authTrace, maskAuthEmail } from '@/lib/auth-trace'
import { requireProtectedPageSession } from '@/server/auth/protected-page'
import { MainShell } from '@/components/layout/MainShell'

export default async function MainLayout({
  children,
}: {
  children: ReactNode
}) {
  const session = await requireProtectedPageSession({
    route: '(main)/layout',
    pathname: '/dashboard',
  })

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
