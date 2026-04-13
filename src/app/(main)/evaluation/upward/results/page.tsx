import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { UpwardReviewWorkspaceClient } from '@/components/evaluation/upward/UpwardReviewWorkspaceClient'
import { getUpwardReviewPageData } from '@/server/upward-review'

type PageProps = {
  searchParams?: Promise<{
    cycleId?: string
    roundId?: string
    empId?: string
  }>
}

export default async function UpwardReviewResultsPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const resolvedSearchParams = (await searchParams) ?? {}
  const data = await getUpwardReviewPageData({
    session,
    mode: 'results',
    cycleId: resolvedSearchParams.cycleId,
    roundId: resolvedSearchParams.roundId,
    empId: resolvedSearchParams.empId,
  })

  return <UpwardReviewWorkspaceClient data={data} />
}
