import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { NotificationOpsClient } from '@/components/notifications/NotificationOpsClient'
import { authOptions } from '@/lib/auth'

export default async function AdminNotificationsPage() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ROLE_ADMIN') {
    redirect('/dashboard')
  }

  return <NotificationOpsClient />
}
