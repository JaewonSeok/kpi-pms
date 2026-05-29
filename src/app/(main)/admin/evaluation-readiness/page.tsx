import type { ComponentType } from 'react'

import { EvaluationWorkbenchClient } from '@/components/evaluation/EvaluationWorkbenchClient'
import { requireProtectedPageSession } from '@/server/auth/protected-page'
import { getEvaluationWorkbenchPageData } from '@/server/evaluation-workbench'

export const dynamic = 'force-dynamic'

type PageProps = {
  searchParams?: Promise<{
    cycleId?: string
    evaluationId?: string
  }>
}

const EvaluationReadinessClient = EvaluationWorkbenchClient as ComponentType<Record<string, unknown>>

export default async function EvaluationReadinessAdminPage({ searchParams }: PageProps) {
  const session = await requireProtectedPageSession({
    route: '/admin/evaluation-readiness',
    pathname: '/admin/evaluation-readiness',
  })

  const resolvedSearchParams = (await searchParams) ?? {}
  const data = await getEvaluationWorkbenchPageData({
    session,
    cycleId: resolvedSearchParams.cycleId,
    evaluationId: resolvedSearchParams.evaluationId,
  })

  return <EvaluationReadinessClient {...data} presentationMode="readiness-admin" />
}
