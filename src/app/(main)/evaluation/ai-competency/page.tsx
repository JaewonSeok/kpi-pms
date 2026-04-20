import { getAiCompetencyGatePageData } from '@/server/ai-competency-gate'
import { requireProtectedPageSession } from '@/server/auth/protected-page'
import { AiCompetencyClient } from '@/components/evaluation/AiCompetencyClient'

type PageProps = {
  searchParams?: Promise<{
    cycleId?: string
  }>
}

export default async function AiCompetencyPage({ searchParams }: PageProps) {
  const session = await requireProtectedPageSession({
    route: '/evaluation/ai-competency',
    pathname: '/evaluation/ai-competency',
  })

  const resolvedSearchParams = (await searchParams) ?? {}
  const pageData = await getAiCompetencyGatePageData({
    session,
    cycleId: resolvedSearchParams.cycleId,
  })

  return <AiCompetencyClient {...pageData} />
}
