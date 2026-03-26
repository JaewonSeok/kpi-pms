import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { getAiCompetencyPageData } from '@/server/ai-competency'
import { AiCompetencyClient } from '@/components/evaluation/AiCompetencyClient'

type PageProps = {
  searchParams?: Promise<{
    cycleId?: string
  }>
}

export default async function AiCompetencyPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  const resolvedSearchParams = (await searchParams) ?? {}
  const pageData = await getAiCompetencyPageData({
    session,
    cycleId: resolvedSearchParams.cycleId,
  })

  return <AiCompetencyClient {...pageData} />
}
