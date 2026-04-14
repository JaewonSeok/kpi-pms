import { UpwardReviewWorkspaceClient } from '@/components/evaluation/upward/UpwardReviewWorkspaceClient'
import { requireProtectedPageSession } from '@/server/auth/protected-page'
import { getUpwardReviewPageData } from '@/server/upward-review'

type PageProps = {
  params: Promise<{
    feedbackId: string
  }>
  searchParams?: Promise<{
    cycleId?: string
    roundId?: string
  }>
}

export default async function UpwardReviewRespondPage({ params, searchParams }: PageProps) {
  const resolvedParams = await params
  const session = await requireProtectedPageSession({
    route: '/evaluation/upward/respond/[feedbackId]',
    pathname: `/evaluation/upward/respond/${encodeURIComponent(resolvedParams.feedbackId)}`,
  })

  const resolvedSearchParams = (await searchParams) ?? {}
  const data = await getUpwardReviewPageData({
    session,
    mode: 'respond',
    feedbackId: resolvedParams.feedbackId,
    cycleId: resolvedSearchParams.cycleId,
    roundId: resolvedSearchParams.roundId,
  })

  return <UpwardReviewWorkspaceClient data={data} />
}
