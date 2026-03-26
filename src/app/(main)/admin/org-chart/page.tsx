import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'

export default async function AdminOrgChartPage() {
  const session = await getServerSession(authOptions)

  if (!session || session.user.role !== 'ROLE_ADMIN') {
    redirect('/dashboard')
  }

  redirect('/admin/google-access?tab=org-chart')
}
