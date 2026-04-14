import { getPersonalKpiPageData } from '@/server/personal-kpi-page'
import { requireProtectedPageSession } from '@/server/auth/protected-page'
import { PersonalKpiManagementClient } from '@/components/kpi/PersonalKpiManagementClient'

type PageProps = {
  searchParams?: Promise<{
    year?: string
    employeeId?: string
    cycleId?: string
    tab?: string
    kpiId?: string
  }>
}

export default async function PersonalKpiPage({ searchParams }: PageProps) {
  const session = await requireProtectedPageSession({
    route: '/kpi/personal',
    pathname: '/kpi/personal',
  })

  const resolvedSearchParams = (await searchParams) ?? {}
  const selectedYear = resolvedSearchParams.year ? Number.parseInt(resolvedSearchParams.year, 10) : undefined

  const data = await getPersonalKpiPageData({
    session,
    year: Number.isFinite(selectedYear) ? selectedYear : undefined,
    employeeId: resolvedSearchParams.employeeId,
    cycleId: resolvedSearchParams.cycleId,
  })

  return (
    <PersonalKpiManagementClient
      {...data}
      initialTab={resolvedSearchParams.tab}
      initialKpiId={resolvedSearchParams.kpiId}
    />
  )
}
