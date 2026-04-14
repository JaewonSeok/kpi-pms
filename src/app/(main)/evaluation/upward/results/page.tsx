import { UpwardReviewWorkspaceClient } from '@/components/evaluation/upward/UpwardReviewWorkspaceClient'
import { requireProtectedPageSession } from '@/server/auth/protected-page'
import { getUpwardReviewPageData } from '@/server/upward-review'

type PageProps = {
  searchParams?: Promise<{
    cycleId?: string
    roundId?: string
    empId?: string
  }>
}

export default async function UpwardReviewResultsPage({ searchParams }: PageProps) {
  const session = await requireProtectedPageSession({
    route: '/evaluation/upward/results',
    pathname: '/evaluation/upward/results',
  })

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
