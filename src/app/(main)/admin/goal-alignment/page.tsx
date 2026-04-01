import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { GoalAlignmentClient } from '@/components/admin/GoalAlignmentClient'
import {
  getGoalAlignmentPageData,
  type GoalAlignmentStatusFilter,
} from '@/server/goal-alignment'

type PageProps = {
  searchParams?: Promise<{
    year?: string
    cycleId?: string
    departmentId?: string
    status?: string
  }>
}

function parseStatus(value?: string): GoalAlignmentStatusFilter | undefined {
  if (
    value === 'ALL' ||
    value === 'CONFIRMED' ||
    value === 'DRAFT' ||
    value === 'ORPHAN' ||
    value === 'AT_RISK'
  ) {
    return value
  }
  return undefined
}

export default async function AdminGoalAlignmentPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  if (!['ROLE_ADMIN', 'ROLE_CEO'].includes(session.user.role)) redirect('/dashboard')

  const params = await searchParams
  const year = params?.year ? Number(params.year) : undefined
  const data = await getGoalAlignmentPageData(session, {
    year: Number.isInteger(year) ? year : undefined,
    cycleId: params?.cycleId,
    departmentId: params?.departmentId,
    status: parseStatus(params?.status),
  })

  return <GoalAlignmentClient data={data} />
}
