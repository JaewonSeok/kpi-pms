import { requireProtectedPageSession } from '@/server/auth/protected-page'
import { getKpiProgressPageData } from '@/server/kpi-progress-page'
import { KpiProgressClient } from '@/components/admin/KpiProgressClient'

export const dynamic = 'force-dynamic'

export default async function KpiProgressPage() {
  const session = await requireProtectedPageSession({
    route: '/admin/kpi-progress',
    pathname: '/admin/kpi-progress',
  })

  const data = await getKpiProgressPageData(session)

  return <KpiProgressClient data={data} />
}
