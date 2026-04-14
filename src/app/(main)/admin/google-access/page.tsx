import { redirect } from 'next/navigation'
import { canAccessMenu } from '@/lib/auth/permissions'
import { resolveAdminGoogleAccessTab } from '@/lib/admin-google-access-tabs'
import { requireProtectedPageSession } from '@/server/auth/protected-page'
import { AdminOrgChartScreen } from '@/components/admin/AdminOrgChartScreen'
import { GoogleAccountRegistrationClient } from '@/components/admin/GoogleAccountRegistrationClient'

type AdminGoogleAccessPageProps = {
  searchParams?: Promise<{
    tab?: string
    q?: string
    status?: string
    departmentId?: string
  }>
}

export default async function AdminGoogleAccessPage({
  searchParams,
}: AdminGoogleAccessPageProps) {
  const session = await requireProtectedPageSession({
    route: '/admin/google-access',
    pathname: '/admin/google-access',
  })

  if (!canAccessMenu(session.user.role, 'SYSTEM_SETTING')) {
    redirect('/403')
  }

  const resolvedSearchParams = (await searchParams) ?? {}
  const activeTab = resolveAdminGoogleAccessTab(resolvedSearchParams.tab)

  if (activeTab === 'org-chart') {
    return (
      <AdminOrgChartScreen
        search={resolvedSearchParams.q ?? null}
        status={resolvedSearchParams.status ?? null}
        departmentId={resolvedSearchParams.departmentId ?? null}
      />
    )
  }

  return <GoogleAccountRegistrationClient />
}
