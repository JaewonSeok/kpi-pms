import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { getWordCloud360PageData } from '@/server/word-cloud-360'
import { WordCloud360WorkspaceClient } from '@/components/evaluation/wordcloud360/WordCloud360WorkspaceClient'

export const dynamic = 'force-dynamic'

type PageProps = {
  searchParams?: Promise<{
    cycleId?: string
    group?: 'ALL' | 'MANAGER' | 'PEER' | 'SUBORDINATE' | 'SELF'
  }>
}

export default async function WordCloud360Page({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const resolvedSearchParams = (await searchParams) ?? {}
  const data = await getWordCloud360PageData({
    session: session as Parameters<typeof getWordCloud360PageData>[0]['session'],
    cycleId: resolvedSearchParams.cycleId,
    evaluatorGroup: resolvedSearchParams.group,
  })

  const renderKey = JSON.stringify({
    state: data.state,
    cycleId: data.selectedCycleId ?? '',
    availableCycles: data.availableCycles.length,
    keywordPool: data.adminView?.keywordPool.length ?? 0,
    adminCycleId: data.adminView?.cycle?.id ?? '',
    evaluatorAssignments:
      data.evaluatorView?.assignments.map((assignment) => [
        assignment.assignmentId,
        assignment.responseStatus ?? '',
        assignment.selectedPositiveKeywordIds.length,
        assignment.selectedNegativeKeywordIds.length,
        assignment.submittedAt ?? '',
      ]) ?? [],
    evaluateeResult: [
      data.evaluateeView?.responseCount ?? 0,
      data.evaluateeView?.selectedGroup ?? 'ALL',
      data.evaluateeView?.resultVisible ?? false,
    ],
  })

  return <WordCloud360WorkspaceClient key={renderKey} data={data} />
}
