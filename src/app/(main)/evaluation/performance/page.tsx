import { EvaluationWorkbenchClient } from '@/components/evaluation/EvaluationWorkbenchClient'
import { EvaluationProcessPreviewGuide2026 } from '@/components/evaluation/EvaluationProcessPreviewGuide2026'
import { requireProtectedPageSession } from '@/server/auth/protected-page'
import { getEvaluationWorkbenchPageData } from '@/server/evaluation-workbench'

export const dynamic = 'force-dynamic'

type PageProps = {
  searchParams?: Promise<{
    cycleId?: string
    evaluationId?: string
  }>
}

export default async function PerformanceEvaluationPage({ searchParams }: PageProps) {
  const session = await requireProtectedPageSession({
    route: '/evaluation/performance',
    pathname: '/evaluation/performance',
  })

  const resolvedSearchParams = (await searchParams) ?? {}
  const data = await getEvaluationWorkbenchPageData({
    session,
    cycleId: resolvedSearchParams.cycleId,
    evaluationId: resolvedSearchParams.evaluationId,
  })

  return (
    <div className="space-y-5">
      <EvaluationProcessPreviewGuide2026 compact />
      <EvaluationWorkbenchClient {...data} presentationMode="performance-dashboard" />
    </div>
  )
}
