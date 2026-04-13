import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { UpwardReviewWorkspaceClient } from '@/components/evaluation/upward/UpwardReviewWorkspaceClient'
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
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const resolvedParams = await params
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
