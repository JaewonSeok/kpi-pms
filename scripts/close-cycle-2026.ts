import 'dotenv/config'
import { prisma } from '../src/lib/prisma'
import { resolveEvalCycleDisplayStatus } from '../src/lib/eval-cycle-status'

const TARGET_CYCLE_ID = 'cycle-2026'

const CLOSED_TIMELINE = {
  status: 'CLOSED' as const,
  selfEvalStart: new Date('2026-02-01T00:00:00.000Z'),
  selfEvalEnd: new Date('2026-02-10T23:59:59.000Z'),
  firstEvalStart: new Date('2026-02-11T00:00:00.000Z'),
  firstEvalEnd: new Date('2026-02-15T23:59:59.000Z'),
  secondEvalStart: new Date('2026-02-16T00:00:00.000Z'),
  secondEvalEnd: new Date('2026-02-20T23:59:59.000Z'),
  finalEvalStart: new Date('2026-02-21T00:00:00.000Z'),
  finalEvalEnd: new Date('2026-02-24T23:59:59.000Z'),
  ceoAdjustStart: new Date('2026-02-25T00:00:00.000Z'),
  ceoAdjustEnd: new Date('2026-02-27T23:59:59.000Z'),
  resultOpenStart: new Date('2026-03-01T00:00:00.000Z'),
  resultOpenEnd: new Date('2026-03-07T23:59:59.000Z'),
  appealDeadline: new Date('2026-03-14T23:59:59.000Z'),
}

async function loadCycleSnapshot(id: string) {
  const cycle = await prisma.evalCycle.findUnique({
    where: { id },
    select: {
      id: true,
      cycleName: true,
      status: true,
      evalYear: true,
      kpiSetupStart: true,
      kpiSetupEnd: true,
      selfEvalStart: true,
      selfEvalEnd: true,
      firstEvalStart: true,
      firstEvalEnd: true,
      secondEvalStart: true,
      secondEvalEnd: true,
      finalEvalStart: true,
      finalEvalEnd: true,
      ceoAdjustStart: true,
      ceoAdjustEnd: true,
      resultOpenStart: true,
      resultOpenEnd: true,
      appealDeadline: true,
      createdAt: true,
      updatedAt: true,
      organization: { select: { id: true, name: true } },
    },
  })

  if (!cycle) {
    throw new Error(`EvalCycle ${id} not found`)
  }

  const now = new Date()
  return {
    ...cycle,
    helperStatus: resolveEvalCycleDisplayStatus(cycle, { now }),
    inspectedAt: now.toISOString(),
  }
}

async function main() {
  const before = await loadCycleSnapshot(TARGET_CYCLE_ID)
  console.log(
    JSON.stringify(
      {
        phase: 'before',
        cycle: before,
      },
      null,
      2
    )
  )

  await prisma.evalCycle.update({
    where: { id: TARGET_CYCLE_ID },
    data: CLOSED_TIMELINE,
  })

  const after = await loadCycleSnapshot(TARGET_CYCLE_ID)
  console.log(
    JSON.stringify(
      {
        phase: 'after',
        cycle: after,
      },
      null,
      2
    )
  )
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
