import { redirect } from 'next/navigation'
import { PerformanceHrOpsDashboard } from '@/components/evaluation/performance/PerformanceHrOpsDashboard'
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

  if (session.user.role !== 'ROLE_ADMIN') {
    redirect('/403')
  }

  const resolvedSearchParams = (await searchParams) ?? {}
  const data = await getEvaluationWorkbenchPageData({
    session,
    cycleId: resolvedSearchParams.cycleId,
    evaluationId: resolvedSearchParams.evaluationId,
  })

  return <PerformanceHrOpsDashboard data={data} />
}
