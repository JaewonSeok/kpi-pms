import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { getEvaluationWorkbenchPageData } from '@/server/evaluation-workbench'
import { EvaluationWorkbenchClient } from '@/components/evaluation/EvaluationWorkbenchClient'

type PageProps = {
  searchParams?: Promise<{
    cycleId?: string
    evaluationId?: string
  }>
}

export default async function EvaluationAssistantPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  const resolvedSearchParams = (await searchParams) ?? {}
  const data = await getEvaluationWorkbenchPageData({
    session,
    cycleId: resolvedSearchParams.cycleId,
    evaluationId: resolvedSearchParams.evaluationId,
  })

  return <EvaluationWorkbenchClient {...data} />
}
