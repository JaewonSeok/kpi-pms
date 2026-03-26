import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

type PageProps = {
  searchParams?: Promise<{
    cycleId?: string
    evaluationId?: string
  }>
}

export default async function EvaluationAssistantPage({ searchParams }: PageProps) {
  const resolvedSearchParams = (await searchParams) ?? {}
  const params = new URLSearchParams()

  if (resolvedSearchParams.cycleId) {
    params.set('cycleId', resolvedSearchParams.cycleId)
  }

  if (resolvedSearchParams.evaluationId) {
    params.set('evaluationId', resolvedSearchParams.evaluationId)
  }

  redirect(params.size ? `/evaluation/workbench?${params.toString()}` : '/evaluation/workbench')
}
