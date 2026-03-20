import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { getDashboardPageData } from '@/server/dashboard-page'
import { DashboardPageShell } from '@/components/dashboard/DashboardPageShell'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  const data = await getDashboardPageData(session)
  return <DashboardPageShell data={data} />
}
