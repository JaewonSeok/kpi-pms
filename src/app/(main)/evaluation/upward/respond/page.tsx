import { UpwardReviewWorkspaceClient } from '@/components/evaluation/upward/UpwardReviewWorkspaceClient'
import { requireProtectedPageSession } from '@/server/auth/protected-page'
import { getUpwardReviewPageData } from '@/server/upward-review'

type PageProps = {
  searchParams?: Promise<{
    cycleId?: string
    roundId?: string
  }>
}

export default async function UpwardReviewRespondListPage({ searchParams }: PageProps) {
  const session = await requireProtectedPageSession({
    route: '/evaluation/upward/respond',
    pathname: '/evaluation/upward/respond',
  })

  const resolvedSearchParams = (await searchParams) ?? {}
  const data = await getUpwardReviewPageData({
    session,
    mode: 'overview',
    cycleId: resolvedSearchParams.cycleId,
    roundId: resolvedSearchParams.roundId,
  })

  return <UpwardReviewWorkspaceClient data={data} />
}
