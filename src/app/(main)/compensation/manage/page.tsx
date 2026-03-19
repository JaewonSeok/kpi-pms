import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { CompensationManageClient } from '@/components/compensation/CompensationManageClient'
import { getCompensationManagePageData } from '@/server/compensation-manage'

export default async function CompensationManagePage({
  searchParams,
}: {
  searchParams?: Promise<{
    year?: string
    cycleId?: string
    scenarioId?: string
  }>
}) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  if (!['ROLE_ADMIN', 'ROLE_DIV_HEAD', 'ROLE_CEO'].includes(session.user.role)) {
    redirect('/dashboard')
  }

  const resolvedSearchParams = (await searchParams) ?? {}
  const yearParam = resolvedSearchParams.year ? Number(resolvedSearchParams.year) : undefined

  const pageData = await getCompensationManagePageData({
    userId: session.user.id,
    role: session.user.role,
    year: yearParam && !Number.isNaN(yearParam) ? yearParam : undefined,
    cycleId: resolvedSearchParams.cycleId,
    scenarioId: resolvedSearchParams.scenarioId,
  })

  return <CompensationManageClient {...pageData} />
}
