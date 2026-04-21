import { EvaluationWorkbenchClient } from '@/components/evaluation/EvaluationWorkbenchClient'
import { prisma } from '@/lib/prisma'
import { requireProtectedPageSession } from '@/server/auth/protected-page'
import { getEvaluationWorkbenchPageData } from '@/server/evaluation-workbench'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{
    evaluationId: string
  }>
  searchParams?: Promise<{
    cycleId?: string
  }>
}

export default async function PerformanceEvaluationDetailPage({
  params,
  searchParams,
}: PageProps) {
  const session = await requireProtectedPageSession({
    route: '/evaluation/performance',
    pathname: '/evaluation/performance',
  })

  const { evaluationId } = await params
  const resolvedSearchParams = (await searchParams) ?? {}
  const evaluation = await prisma.evaluation.findUnique({
    where: { id: evaluationId },
    select: {
      evalCycleId: true,
    },
  })

  const data = await getEvaluationWorkbenchPageData({
    session,
    cycleId: resolvedSearchParams.cycleId ?? evaluation?.evalCycleId,
    evaluationId,
  })

  return <EvaluationWorkbenchClient {...data} />
}
