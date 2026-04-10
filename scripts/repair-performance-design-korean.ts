import { Prisma } from '@prisma/client'
import { prisma } from '../src/lib/prisma'
import { repairPerformanceDesignPersistedConfig } from '../src/lib/performance-design'

function stableStringify(value: unknown) {
  return JSON.stringify(value)
}

async function main() {
  const cycles = await prisma.evalCycle.findMany({
    where: {
      performanceDesignConfig: {
        not: Prisma.JsonNull,
      },
    },
    select: {
      id: true,
      cycleName: true,
      performanceDesignConfig: true,
    },
  })

  let repairedCount = 0

  for (const cycle of cycles) {
    if (!cycle.performanceDesignConfig || typeof cycle.performanceDesignConfig !== 'object') continue

    const repairedConfig = repairPerformanceDesignPersistedConfig(cycle.performanceDesignConfig)
    if (stableStringify(repairedConfig) === stableStringify(cycle.performanceDesignConfig)) continue

    await prisma.evalCycle.update({
      where: { id: cycle.id },
      data: {
        performanceDesignConfig: repairedConfig as Prisma.InputJsonValue,
      },
    })

    repairedCount += 1
    console.log(`repaired performance design config: ${cycle.cycleName} (${cycle.id})`)
  }

  console.log(`done: repaired ${repairedCount} cycle(s)`)
}

main()
  .catch((error) => {
    console.error('repair-performance-design-korean failed')
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
