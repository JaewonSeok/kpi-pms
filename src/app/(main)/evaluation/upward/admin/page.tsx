import { UpwardReviewWorkspaceClient } from '@/components/evaluation/upward/UpwardReviewWorkspaceClient'
import { requireProtectedPageSession } from '@/server/auth/protected-page'
import { getUpwardReviewPageData } from '@/server/upward-review'

type PageProps = {
  searchParams?: Promise<{
    cycleId?: string
    roundId?: string
  }>
}

export default async function UpwardReviewAdminPage({ searchParams }: PageProps) {
  const session = await requireProtectedPageSession({
    route: '/evaluation/upward/admin',
    pathname: '/evaluation/upward/admin',
  })

  const resolvedSearchParams = (await searchParams) ?? {}
  const data = await getUpwardReviewPageData({
    session,
    mode: 'admin',
    cycleId: resolvedSearchParams.cycleId,
    roundId: resolvedSearchParams.roundId,
  })

  return <UpwardReviewWorkspaceClient data={data} />
}
