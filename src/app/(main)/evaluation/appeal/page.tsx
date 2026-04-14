import { getEvaluationAppealPageData } from '@/server/evaluation-appeal'
import { requireProtectedPageSession } from '@/server/auth/protected-page'
import { EvaluationAppealClient } from '@/components/evaluation/EvaluationAppealClient'

type EvaluationAppealPageProps = {
  searchParams?: Promise<{
    cycleId?: string
    caseId?: string
  }>
}

export default async function EvaluationAppealPage({ searchParams }: EvaluationAppealPageProps) {
  const session = await requireProtectedPageSession({
    route: '/evaluation/appeal',
    pathname: '/evaluation/appeal',
  })

  const resolvedSearchParams = (await searchParams) ?? {}
  const pageData = await getEvaluationAppealPageData({
    session,
    cycleId: resolvedSearchParams.cycleId,
    caseId: resolvedSearchParams.caseId,
  })

  return <EvaluationAppealClient {...pageData} />
}
