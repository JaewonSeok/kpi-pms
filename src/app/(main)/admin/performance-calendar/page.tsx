import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { PerformanceCalendarClient } from '@/components/admin/PerformanceCalendarClient'
import {
  getPerformanceCalendarPageData,
  type PerformanceCalendarEventType,
} from '@/server/admin/performance-calendar'

type PageProps = {
  searchParams?: Promise<{
    month?: string
    types?: string
  }>
}

function parseTypes(value?: string): PerformanceCalendarEventType[] | undefined {
  if (!value) return undefined
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(
      (item): item is PerformanceCalendarEventType =>
        item === 'goal' ||
        item === 'review' ||
        item === 'survey' ||
        item === 'calibration' ||
        item === 'anniversary' ||
        item === 'milestone'
    )
}

export default async function AdminPerformanceCalendarPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions)

  if (!session) redirect('/login')
  if (session.user.role !== 'ROLE_ADMIN') redirect('/dashboard')

  const params = await searchParams
  const data = await getPerformanceCalendarPageData(session, {
    month: params?.month,
    types: parseTypes(params?.types),
  })

  return <PerformanceCalendarClient data={data} />
}
