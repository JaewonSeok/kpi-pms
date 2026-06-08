import { redirect } from 'next/navigation'
import { requireProtectedPageSession } from '@/server/auth/protected-page'
import { getDepartmentScoreIntakePageData } from '@/server/admin/department-score-intake-page'
import { DepartmentScoreIntakeAdminClient } from '@/components/admin/DepartmentScoreIntakeAdminClient'

export const dynamic = 'force-dynamic'

type PageProps = {
  searchParams?: Promise<{
    evalCycleId?: string
  }>
}

export default async function DepartmentScoreIntakeAdminPage({ searchParams }: PageProps) {
  const session = await requireProtectedPageSession({
    route: '/admin/department-score-intake',
    pathname: '/admin/department-score-intake',
  })

  if (session.user.role !== 'ROLE_ADMIN') {
    redirect('/dashboard')
  }

  const resolved = (await searchParams) ?? {}
  const data = await getDepartmentScoreIntakePageData({
    session,
    evalCycleId: resolved.evalCycleId,
  })

  return <DepartmentScoreIntakeAdminClient {...data} />
}
