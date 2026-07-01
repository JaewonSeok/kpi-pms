import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  OrgKpiExceptionRequestsClient,
  type ExceptionRequestItem,
} from '@/components/kpi/OrgKpiExceptionRequestsClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function OrgKpiExceptionRequestsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  if (session.user.role !== 'ROLE_ADMIN') redirect('/dashboard')

  const rows = await prisma.orgKpiExceptionRequest.findMany({
    orderBy: [{ createdAt: 'desc' }],
    select: {
      id: true,
      status: true,
      reason: true,
      reviewNote: true,
      createdAt: true,
      resolvedAt: true,
      orgKpi: {
        select: {
          id: true,
          kpiName: true,
          evalYear: true,
          department: { select: { id: true, deptName: true } },
        },
      },
      requester: { select: { id: true, empName: true } },
      reviewer: { select: { id: true, empName: true } },
    },
  })

  const requests: ExceptionRequestItem[] = rows.map((r) => ({
    id: r.id,
    status: r.status,
    reason: r.reason,
    reviewNote: r.reviewNote,
    createdAt: r.createdAt.toISOString(),
    resolvedAt: r.resolvedAt?.toISOString() ?? null,
    orgKpi: {
      id: r.orgKpi.id,
      kpiName: r.orgKpi.kpiName,
      evalYear: r.orgKpi.evalYear,
      deptId: r.orgKpi.department.id,
      deptName: r.orgKpi.department.deptName,
    },
    requester: r.requester,
    reviewer: r.reviewer ?? null,
  }))

  return <OrgKpiExceptionRequestsClient initialRequests={requests} />
}
