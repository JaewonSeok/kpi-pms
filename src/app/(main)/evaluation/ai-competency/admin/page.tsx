import { AiCompetencyAdminPanel } from '@/components/evaluation/AiCompetencyAdminPanel'
import { requireProtectedPageSession } from '@/server/auth/protected-page'
import { getAiCompetencyGateAdminPageData } from '@/server/ai-competency-gate-admin'

type PageProps = {
  searchParams?: Promise<{
    cycleId?: string
  }>
}

export default async function AiCompetencyAdminPage({ searchParams }: PageProps) {
  const session = await requireProtectedPageSession({
    route: '/evaluation/ai-competency/admin',
    pathname: '/evaluation/ai-competency/admin',
  })

  const resolvedSearchParams = (await searchParams) ?? {}
  const pageData = await getAiCompetencyGateAdminPageData({
    session,
    cycleId: resolvedSearchParams.cycleId,
  })

  return <AiCompetencyAdminPanel pageData={pageData} />
}
