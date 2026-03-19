import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { getOrgKpiPageData } from '@/server/org-kpi-page'
import { OrgKpiManagementClient } from '@/components/kpi/OrgKpiManagementClient'

type OrgKpiPageProps = {
  searchParams?: Promise<{
    year?: string
    dept?: string
    tab?: string
    kpiId?: string
  }>
}

export default async function OrgKpiPage({ searchParams }: OrgKpiPageProps) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

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
