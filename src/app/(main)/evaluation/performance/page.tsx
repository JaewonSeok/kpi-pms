import { redirect } from 'next/navigation'
import { PerformanceHrOpsDashboard } from '@/components/evaluation/performance/PerformanceHrOpsDashboard'
import { requireProtectedPageSession } from '@/server/auth/protected-page'
import { getEvaluationWorkbenchPageData } from '@/server/evaluation-workbench'

export const dynamic = 'force-dynamic'

const PERFORMANCE_OPS_ROLES = new Set([
  'ROLE_ADMIN',
  'ROLE_CEO',
  'ROLE_DIV_HEAD',
  'ROLE_SECTION_CHIEF',
  'ROLE_TEAM_LEADER',
])

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

  if (!PERFORMANCE_OPS_ROLES.has(session.user.role)) {
    redirect('/403')
  }

  const resolvedSearchParams = (await searchParams) ?? {}
  const data = await getEvaluationWorkbenchPageData({
    session,
    cycleId: resolvedSearchParams.cycleId,
    evaluationId: resolvedSearchParams.evaluationId,
  })

  const canSeeAllInCycle = session.user.role === 'ROLE_ADMIN'
  return <PerformanceHrOpsDashboard data={data} canSeeAllInCycle={canSeeAllInCycle} />
}
