import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { buildAdminGoogleAccessHref } from '@/lib/admin-google-access-tabs'

export default async function AdminOrgChartPage() {
  const session = await getServerSession(authOptions)

  if (!session || session.user.role !== 'ROLE_ADMIN') {
    redirect('/dashboard')
  }

  redirect(buildAdminGoogleAccessHref('org-chart'))
}
