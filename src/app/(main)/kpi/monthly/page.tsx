import { getMonthlyKpiPageData } from '@/server/monthly-kpi-page'
import { requireProtectedPageSession } from '@/server/auth/protected-page'
import { MonthlyKpiManagementClient } from '@/components/kpi/MonthlyKpiManagementClient'

type PageProps = {
  searchParams?: Promise<{
    year?: string
    month?: string
    scope?: string
    employeeId?: string
    tab?: string
    recordId?: string
  }>
}

export default async function MonthlyKpiPage({ searchParams }: PageProps) {
  const session = await requireProtectedPageSession({
    route: '/kpi/monthly',
    pathname: '/kpi/monthly',
  })

  const resolvedSearchParams = (await searchParams) ?? {}
  const selectedYear = resolvedSearchParams.year ? Number.parseInt(resolvedSearchParams.year, 10) : undefined

  const data = await getMonthlyKpiPageData({
    session,
    year: Number.isFinite(selectedYear) ? selectedYear : undefined,
    month: resolvedSearchParams.month,
    scope: resolvedSearchParams.scope,
    employeeId: resolvedSearchParams.employeeId,
  })

  return (
    <MonthlyKpiManagementClient
      {...data}
      initialTab={resolvedSearchParams.tab}
      initialRecordId={resolvedSearchParams.recordId}
    />
  )
}
