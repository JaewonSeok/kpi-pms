import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { UnderConstruction } from '@/components/common/UnderConstruction'

export default async function AdminOrgChartPage() {
  const session = await getServerSession(authOptions)

  if (!session) redirect('/login')
  if (session.user.role !== 'ROLE_ADMIN') redirect('/dashboard')

  return <UnderConstruction requestedPath="/admin/org-chart" />
}
