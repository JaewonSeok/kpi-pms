import { ExecutiveStatisticsDashboardClient } from '@/components/statistics/ExecutiveStatisticsDashboardClient'
import { requireProtectedPageSession } from '@/server/auth/protected-page'
import { getStatisticsPageData } from '@/server/statistics-page'

export const dynamic = 'force-dynamic'

type PageProps = {
  searchParams?: Promise<{
    cycleId?: string
    period?: string
    orgId?: string
    departmentId?: string
    position?: string
  }>
}

export default async function StatisticsPage({ searchParams }: PageProps) {
  const session = await requireProtectedPageSession({
    route: '/statistics',
    pathname: '/statistics',
  })

  const resolvedSearchParams = (await searchParams) ?? {}
  const data = await getStatisticsPageData(session, resolvedSearchParams)

  return <ExecutiveStatisticsDashboardClient data={data} />
}
