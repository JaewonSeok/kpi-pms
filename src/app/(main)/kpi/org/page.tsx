import { getOrgKpiPageData } from '@/server/org-kpi-page'
import { requireProtectedPageSession } from '@/server/auth/protected-page'
import { OrgKpiManagementClient } from '@/components/kpi/OrgKpiManagementClient'

type OrgKpiPageProps = {
  searchParams?: Promise<{
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

  const pageData = await getOrgKpiPageData({
    userId: session.user.id,
    role: session.user.role,
    deptId: session.user.deptId,
    deptName: session.user.deptName,
    accessibleDepartmentIds: session.user.accessibleDepartmentIds,
    selectedScope: resolvedSearchParams.scope,
    selectedKpiId: resolvedSearchParams.kpiId,
    userName: session.user.name,
  })

  return (
    <OrgKpiManagementClient
      {...pageData}
      initialTab={resolvedSearchParams.tab}
      initialSelectedKpiId={resolvedSearchParams.kpiId}
    />
  )
}
