import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { getFeedback360PageData } from '@/server/feedback-360'
import { Feedback360WorkspaceClient } from '@/components/evaluation/feedback360/Feedback360WorkspaceClient'

type PageProps = {
  searchParams?: Promise<{
    cycleId?: string
    roundId?: string
  }>
}

export default async function Feedback360AdminPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const resolvedSearchParams = (await searchParams) ?? {}
  const data = await getFeedback360PageData({
    session,
    mode: 'admin',
    cycleId: resolvedSearchParams.cycleId,
    roundId: resolvedSearchParams.roundId,
  })

  return <Feedback360WorkspaceClient data={data} />
}
