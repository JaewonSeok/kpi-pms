import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { PerformanceAssignmentAdminClient } from '@/components/admin/PerformanceAssignmentAdminClient'
import { getPerformanceAssignmentPageData } from '@/server/evaluation-performance-assignments'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type PageProps = {
  searchParams?: Promise<{
    cycleId?: string
  }>
}

export default async function AdminPerformanceAssignmentsPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  if (session.user.role !== 'ROLE_ADMIN') {
    redirect('/dashboard')
  }

  const resolvedSearchParams = (await searchParams) ?? {}
  const data = await getPerformanceAssignmentPageData({
    actorId: session.user.id,
    actorRole: session.user.role,
    cycleId: resolvedSearchParams.cycleId,
  })

  return <PerformanceAssignmentAdminClient initialData={data} />
}
