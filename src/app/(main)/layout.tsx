import { getServerSession } from 'next-auth'
import type { ReactNode } from 'react'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { MainShell } from '@/components/layout/MainShell'

export default async function MainLayout({
  children,
}: {
  children: ReactNode
}) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  return (
    <MainShell session={session}>{children}</MainShell>
  )
}
