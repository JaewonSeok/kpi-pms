import { getOrgKpiPageData } from '@/server/org-kpi-page'
import { requireProtectedPageSession } from '@/server/auth/protected-page'
import { OrgKpiManagementClient } from '@/components/kpi/OrgKpiManagementClient'

type OrgKpiPageProps = {
  searchParams?: Promise<{
    year?: string
    dept?: string
    scope?: string
    tab?: string
    kpiId?: string
  }>
}

export default async function OrgKpiPage({ searchParams }: OrgKpiPageProps) {
  const session = await requireProtectedPageSession({
    route: '/kpi/org',
    pathname: '/kpi/org',
  })

  const resolvedSearchParams = (await searchParams) ?? {}
  const year = resolvedSearchParams.year ? Number(resolvedSearchParams.year) : undefined

  const pageData = await getOrgKpiPageData({
    userId: session.user.id,
    role: session.user.role,
    deptId: session.user.deptId,
    deptName: session.user.deptName,
    accessibleDepartmentIds: session.user.accessibleDepartmentIds,
    year,
    selectedDepartmentId: resolvedSearchParams.dept,
    selectedScope: resolvedSearchParams.scope,
    selectedKpiId: resolvedSearchParams.kpiId,
    userName: session.user.name,
  })

  return (
    <OrgKpiManagementClient
      {...pageData}
      initialDepartmentFilterId={resolvedSearchParams.dept}
      initialTab={resolvedSearchParams.tab}
      initialSelectedKpiId={resolvedSearchParams.kpiId}
    />
  )
}
