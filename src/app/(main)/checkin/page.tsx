import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { getCheckinPageData } from '@/server/checkin-page'
import { CheckinClient } from '@/components/checkin/CheckinClient'

type CheckinPageProps = {
  searchParams?: Promise<{
    period?: string
    scope?: string
    employeeId?: string
    startDate?: string
    endDate?: string
  }>
}

export default async function CheckinPage({ searchParams }: CheckinPageProps) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  const resolvedSearchParams = (await searchParams) ?? {}

  const pageData = await getCheckinPageData({
    userId: session.user.id,
    role: session.user.role,
    period: resolvedSearchParams.period,
    scope: resolvedSearchParams.scope,
    employeeId: resolvedSearchParams.employeeId,
    startDate: resolvedSearchParams.startDate,
    endDate: resolvedSearchParams.endDate,
  })

  return <CheckinClient {...pageData} />
}
