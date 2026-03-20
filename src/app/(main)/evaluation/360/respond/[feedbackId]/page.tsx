import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { getFeedback360PageData } from '@/server/feedback-360'
import { Feedback360WorkspaceClient } from '@/components/evaluation/feedback360/Feedback360WorkspaceClient'

type PageProps = {
  params: Promise<{
    feedbackId: string
  }>
  searchParams?: Promise<{
    cycleId?: string
    roundId?: string
  }>
}

export default async function Feedback360RespondPage({ params, searchParams }: PageProps) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const resolvedParams = await params
  const resolvedSearchParams = (await searchParams) ?? {}
  const data = await getFeedback360PageData({
    session,
    mode: 'respond',
    feedbackId: resolvedParams.feedbackId,
    cycleId: resolvedSearchParams.cycleId,
    roundId: resolvedSearchParams.roundId,
  })

  return <Feedback360WorkspaceClient data={data} />
}
