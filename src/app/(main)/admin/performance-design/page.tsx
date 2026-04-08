import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { PerformanceDesignClient } from '@/components/admin/PerformanceDesignClient'
import { getPerformanceDesignPageData } from '@/server/admin/performance-design'

type PageProps = {
  searchParams?: Promise<{
    cycleId?: string
  }>
}

export default async function AdminPerformanceDesignPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  if (session.user.role !== 'ROLE_ADMIN') redirect('/dashboard')

  const params = await searchParams
  const data = await getPerformanceDesignPageData(session, {
    cycleId: params?.cycleId,
  })

  return <PerformanceDesignClient data={data} />
}
