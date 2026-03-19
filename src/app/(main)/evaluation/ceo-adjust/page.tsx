import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { getEvaluationCalibrationPageData } from '@/server/evaluation-calibration'
import { EvaluationCalibrationClient } from '@/components/evaluation/EvaluationCalibrationClient'

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
  const pageData = await getEvaluationCalibrationPageData({
    userId: session.user.id,
    role: session.user.role,
    cycleId: resolvedSearchParams.cycleId,
    scopeId: resolvedSearchParams.scope,
  })

  return <EvaluationCalibrationClient {...pageData} />
}
