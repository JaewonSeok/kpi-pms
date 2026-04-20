import { AiCompetencyCaseReviewPage } from '@/components/evaluation/AiCompetencyCaseReviewPage'
import { requireProtectedPageSession } from '@/server/auth/protected-page'
import { getAiCompetencyGateCaseReviewPageData } from '@/server/ai-competency-gate-admin'

export default async function AiCompetencyAdminCasePage({
  params,
}: {
  params: Promise<{ caseId: string }>
}) {
  const session = await requireProtectedPageSession({
    route: '/evaluation/ai-competency/admin/[caseId]',
    pathname: '/evaluation/ai-competency/admin/[caseId]',
  })

  const resolvedParams = await params
  const pageData = await getAiCompetencyGateCaseReviewPageData({
    session,
    caseId: resolvedParams.caseId,
  })

  return <AiCompetencyCaseReviewPage pageData={pageData} />
}
