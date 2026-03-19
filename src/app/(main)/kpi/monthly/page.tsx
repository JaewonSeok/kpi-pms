import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getMonthlyKpiPageData } from '@/server/monthly-kpi-page'
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
  const session = await getServerSession(authOptions)
  if (!session) {
    return null
  }

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
