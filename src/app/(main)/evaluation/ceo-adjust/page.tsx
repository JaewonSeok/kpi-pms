import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { EvaluationCeoFinalClient } from '@/components/evaluation/EvaluationCeoFinalClient'
import { getEvaluationCeoFinalPageData } from '@/server/evaluation-ceo-final-page'

type EvaluationCeoAdjustPageProps = {
  searchParams?: Promise<{
    cycleId?: string
    scope?: string
  }>
}

export default async function EvaluationCeoAdjustPage({
  searchParams,
}: EvaluationCeoAdjustPageProps) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  if (!['ROLE_ADMIN', 'ROLE_CEO'].includes(session.user.role)) {
    redirect('/dashboard')
  }

  const resolvedSearchParams = (await searchParams) ?? {}
  const pageData = await getEvaluationCeoFinalPageData({
    userId: session.user.id,
    userName: session.user.name,
    role: session.user.role,
    cycleId: resolvedSearchParams.cycleId,
    scopeId: resolvedSearchParams.scope,
  })

  return <EvaluationCeoFinalClient {...pageData} />
}
