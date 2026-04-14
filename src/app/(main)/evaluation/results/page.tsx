import { getEvaluationResultsPageData } from '@/server/evaluation-results'
import { requireProtectedPageSession } from '@/server/auth/protected-page'
import { EvaluationResultsClient } from '@/components/evaluation/EvaluationResultsClient'

type EvaluationResultsPageProps = {
  searchParams?: Promise<{
    cycleId?: string
    employeeId?: string
  }>
}

export default async function EvaluationResultsPage({ searchParams }: EvaluationResultsPageProps) {
  const session = await requireProtectedPageSession({
    route: '/evaluation/results',
    pathname: '/evaluation/results',
  })

  const resolvedSearchParams = (await searchParams) ?? {}
  const pageData = await getEvaluationResultsPageData({
    session,
    cycleId: resolvedSearchParams.cycleId,
    employeeId: resolvedSearchParams.employeeId,
  })

  return <EvaluationResultsClient {...pageData} />
}
