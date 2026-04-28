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

  const shellSession = {
    user: {
      name: session.user.name,
      email: session.user.email,
      image: session.user.image,
      role: session.user.role,
      empId: session.user.empId,
      deptName: session.user.deptName,
      masterLogin: session.user.masterLogin ?? null,
    },
  }

  return (
    <MainShell session={shellSession}>{children}</MainShell>
  )
}
