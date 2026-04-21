import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

type PageProps = {
  searchParams?: Promise<{
    cycleId?: string
    evaluationId?: string
  }>
}

export default async function EvaluationWorkbenchPage({ searchParams }: PageProps) {
  const resolvedSearchParams = (await searchParams) ?? {}
  const params = new URLSearchParams()

  if (resolvedSearchParams.cycleId) {
    params.set('cycleId', resolvedSearchParams.cycleId)
  }

  if (resolvedSearchParams.evaluationId) {
    const base = `/evaluation/performance/${encodeURIComponent(resolvedSearchParams.evaluationId)}`
    redirect(params.size ? `${base}?${params.toString()}` : base)
  }

  redirect(params.size ? `/evaluation/performance?${params.toString()}` : '/evaluation/performance')
}
