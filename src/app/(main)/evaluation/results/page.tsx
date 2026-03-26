import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { getEvaluationResultsPageData } from '@/server/evaluation-results'
import { EvaluationResultsClient } from '@/components/evaluation/EvaluationResultsClient'

type EvaluationResultsPageProps = {
  searchParams?: Promise<{
    cycleId?: string
  }>
}

export default async function EvaluationResultsPage({ searchParams }: EvaluationResultsPageProps) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  const resolvedSearchParams = (await searchParams) ?? {}
  const pageData = await getEvaluationResultsPageData({
    session,
    cycleId: resolvedSearchParams.cycleId,
  })

  return <EvaluationResultsClient {...pageData} />
}
