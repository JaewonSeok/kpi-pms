import { getEvaluationWorkbenchPageData } from '@/server/evaluation-workbench'
import { requireProtectedPageSession } from '@/server/auth/protected-page'
import { EvaluationWorkbenchClient } from '@/components/evaluation/EvaluationWorkbenchClient'

export const dynamic = 'force-dynamic'

type PageProps = {
  searchParams?: Promise<{
    cycleId?: string
    evaluationId?: string
  }>
}

export default async function EvaluationWorkbenchPage({ searchParams }: PageProps) {
  const session = await requireProtectedPageSession({
    route: '/evaluation/workbench',
    pathname: '/evaluation/workbench',
  })

  const resolvedSearchParams = (await searchParams) ?? {}
  const data = await getEvaluationWorkbenchPageData({
    session,
    cycleId: resolvedSearchParams.cycleId,
    evaluationId: resolvedSearchParams.evaluationId,
  })

  return <EvaluationWorkbenchClient {...data} />
}
