import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { getEvaluationAppealPageData } from '@/server/evaluation-appeal'
import { EvaluationAppealClient } from '@/components/evaluation/EvaluationAppealClient'

type EvaluationAppealPageProps = {
  searchParams?: Promise<{
    cycleId?: string
    caseId?: string
  }>
}

export default async function EvaluationAppealPage({ searchParams }: EvaluationAppealPageProps) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  const resolvedSearchParams = (await searchParams) ?? {}
  const pageData = await getEvaluationAppealPageData({
    session,
    cycleId: resolvedSearchParams.cycleId,
    caseId: resolvedSearchParams.caseId,
  })

  return <EvaluationAppealClient {...pageData} />
}
