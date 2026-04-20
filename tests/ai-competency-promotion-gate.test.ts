import 'dotenv/config'
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-require-imports */
import assert from 'node:assert/strict'

process.env.DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/kpi_pms_test'

const { prisma } = require('../src/lib/prisma') as typeof import('../src/lib/prisma')
const { loadAiCompetencyGatePromotionStatuses } = require('../src/server/ai-competency-gate-promotion') as typeof import('../src/server/ai-competency-gate-promotion')

function run(name: string, fn: () => Promise<void> | void) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      console.log(`PASS ${name}`)
    })
    .catch((error) => {
      console.error(`FAIL ${name}`)
      throw error
    })
}

type PrismaDelegateMethod = (...args: any[]) => any

type PromotionSnapshot = {
  aiCompetencyGateAssignmentFindMany: PrismaDelegateMethod
}

function captureSnapshot(): PromotionSnapshot {
  const prismaAny = prisma as any
  return {
    aiCompetencyGateAssignmentFindMany: prismaAny.aiCompetencyGateAssignment.findMany,
  }
}

function restoreSnapshot(snapshot: PromotionSnapshot) {
  const prismaAny = prisma as any
  prismaAny.aiCompetencyGateAssignment.findMany = snapshot.aiCompetencyGateAssignmentFindMany
}

async function withStubbedAssignments(
  implementation: PrismaDelegateMethod,
  fn: () => Promise<void>
) {
  const snapshot = captureSnapshot()
  const prismaAny = prisma as any
  prismaAny.aiCompetencyGateAssignment.findMany = implementation

  try {
    await fn()
  } finally {
    restoreSnapshot(snapshot)
  }
}

async function main() {
  await run('promotion helper returns status labels and satisfaction flags from gate assignments', async () => {
    await withStubbedAssignments(
      async () => [
        {
          status: 'PASSED',
          employeeId: 'emp-1',
          cycle: {
            evalCycleId: 'cycle-2026',
          },
          submissionCase: {
            id: 'case-1',
          },
        },
        {
          status: 'REVISION_REQUESTED',
          employeeId: 'emp-2',
          cycle: {
            evalCycleId: 'cycle-2026',
          },
          submissionCase: {
            id: 'case-2',
          },
        },
      ],
      async () => {
        const result = await loadAiCompetencyGatePromotionStatuses({
          evalCycleIds: ['cycle-2026'],
          employeeIds: ['emp-1', 'emp-2'],
        })

        assert.equal(result.get('cycle-2026:emp-1')?.status, 'PASSED')
        assert.equal(result.get('cycle-2026:emp-1')?.isSatisfied, true)
        assert.equal(result.get('cycle-2026:emp-1')?.caseId, 'case-1')

        assert.equal(result.get('cycle-2026:emp-2')?.status, 'REVISION_REQUESTED')
        assert.equal(result.get('cycle-2026:emp-2')?.isSatisfied, false)
        assert.equal(typeof result.get('cycle-2026:emp-2')?.statusLabel, 'string')
      }
    )
  })

  await run('promotion helper returns an empty map when no cycle or employee filters are provided', async () => {
    const result = await loadAiCompetencyGatePromotionStatuses({
      evalCycleIds: [],
      employeeIds: ['emp-1'],
    })

    assert.equal(result.size, 0)
  })

  console.log('AI competency promotion-gate tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
