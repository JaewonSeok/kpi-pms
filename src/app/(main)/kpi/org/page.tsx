import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { OrgKpiManagementClient } from '@/components/kpi/OrgKpiManagementClient'

export default async function OrgKpiPage() {
  const session = await getServerSession(authOptions)

  if (!session) redirect('/login')
  if (session.user.role !== 'ROLE_ADMIN') redirect('/dashboard')

  const currentYear = new Date().getFullYear()

  const [departments, kpis] = await Promise.all([
    prisma.department.findMany({
      include: {
        organization: { select: { name: true } },
      },
      orderBy: [{ deptName: 'asc' }],
    }),
    prisma.orgKpi.findMany({
      where: { evalYear: currentYear },
      include: {
        department: { select: { deptName: true, deptCode: true } },
        personalKpis: {
          select: {
            id: true,
            kpiName: true,
            status: true,
            employee: {
              select: {
                empId: true,
                empName: true,
              },
            },
          },
          orderBy: [{ employee: { empName: 'asc' } }],
        },
        _count: { select: { personalKpis: true } },
      },
      orderBy: [{ deptId: 'asc' }, { kpiName: 'asc' }],
    }),
  ])

  const serializedKpis = kpis.map((kpi) => ({
    ...kpi,
    createdAt: kpi.createdAt.toISOString(),
    updatedAt: kpi.updatedAt.toISOString(),
  }))

  return <OrgKpiManagementClient initialKpis={serializedKpis} departments={departments} />
}
