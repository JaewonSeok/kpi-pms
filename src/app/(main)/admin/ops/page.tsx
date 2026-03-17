import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { AdminOpsClient } from '@/components/ops/AdminOpsClient'

export default async function AdminOpsPage() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ROLE_ADMIN') {
    redirect('/dashboard')
  }

  return <AdminOpsClient />
}
