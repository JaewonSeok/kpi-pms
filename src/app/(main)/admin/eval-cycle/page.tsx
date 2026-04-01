import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AdminEvalCycleClient } from '@/components/admin/AdminEvalCycleClient'

export default async function AdminEvalCyclePage() {
  const session = await getServerSession(authOptions)

  if (!session) redirect('/login')
  if (session.user.role !== 'ROLE_ADMIN') redirect('/dashboard')

  const [organizations, cycles] = await Promise.all([
    prisma.organization.findMany({
      select: {
        id: true,
        name: true,
        fiscalYear: true,
      },
      orderBy: [{ fiscalYear: 'desc' }, { name: 'asc' }],
    }),
    prisma.evalCycle.findMany({
      include: {
        organization: { select: { name: true } },
        _count: { select: { evaluations: true } },
      },
      orderBy: [{ evalYear: 'desc' }, { createdAt: 'desc' }],
    }),
  ])

  const serializedCycles = cycles.map((cycle) => ({
    ...cycle,
    showQuestionWeight: cycle.showQuestionWeight,
    showScoreSummary: cycle.showScoreSummary,
    kpiSetupStart: cycle.kpiSetupStart?.toISOString() ?? null,
    kpiSetupEnd: cycle.kpiSetupEnd?.toISOString() ?? null,
    selfEvalStart: cycle.selfEvalStart?.toISOString() ?? null,
    selfEvalEnd: cycle.selfEvalEnd?.toISOString() ?? null,
    firstEvalStart: cycle.firstEvalStart?.toISOString() ?? null,
    firstEvalEnd: cycle.firstEvalEnd?.toISOString() ?? null,
    secondEvalStart: cycle.secondEvalStart?.toISOString() ?? null,
    secondEvalEnd: cycle.secondEvalEnd?.toISOString() ?? null,
    finalEvalStart: cycle.finalEvalStart?.toISOString() ?? null,
    finalEvalEnd: cycle.finalEvalEnd?.toISOString() ?? null,
    ceoAdjustStart: cycle.ceoAdjustStart?.toISOString() ?? null,
    ceoAdjustEnd: cycle.ceoAdjustEnd?.toISOString() ?? null,
    resultOpenStart: cycle.resultOpenStart?.toISOString() ?? null,
    resultOpenEnd: cycle.resultOpenEnd?.toISOString() ?? null,
    appealDeadline: cycle.appealDeadline?.toISOString() ?? null,
    createdAt: cycle.createdAt.toISOString(),
    updatedAt: cycle.updatedAt.toISOString(),
  }))

  return <AdminEvalCycleClient initialCycles={serializedCycles} organizations={organizations} />
}
