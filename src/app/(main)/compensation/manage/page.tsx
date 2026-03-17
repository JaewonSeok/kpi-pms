import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { CompensationManageClient } from '@/components/compensation/CompensationManageClient'

export default async function CompensationManagePage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  if (!['ROLE_ADMIN', 'ROLE_DIV_HEAD', 'ROLE_CEO'].includes(session.user.role)) {
    redirect('/dashboard')
  }

  return <CompensationManageClient role={session.user.role} />
}
