import './register-path-aliases'
import assert from 'node:assert/strict'

process.env.DATABASE_URL ||= 'postgresql://postgres:password@localhost:5432/kpi_pms'

async function run(name: string, fn: () => Promise<void> | void) {
  try {
    await fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

function createStageChainDb(params?: {
  sectionChiefId?: string | null
  divisionHeadId?: string | null
  ceoPresent?: boolean
  persistedAssignments?: Array<any>
}) {
  const persistedAssignments = params?.persistedAssignments ?? []

  return {
    employee: {
      findUnique: async (args: { where?: { id?: string } }) => {
        if (args?.where?.id !== 'emp-target') {
          return null
        }

        return {
          id: 'emp-target',
          empName: 'Target Employee',
          role: 'ROLE_MEMBER',
          position: 'TEAM_LEADER',
          teamLeaderId: 'emp-team-leader',
          sectionChiefId:
            params?.sectionChiefId === undefined ? 'emp-section-chief' : params.sectionChiefId,
          divisionHeadId:
            params?.divisionHeadId === undefined ? 'emp-div-head' : params.divisionHeadId,
          department: {
            deptName: 'Sales',
          },
        }
      },
      findMany: async (args: { where?: { id?: { in?: string[] } } }) => {
        const ids = args?.where?.id?.in ?? []
        const profiles = [
          {
            id: 'emp-team-leader',
            empName: 'Leader Reviewer',
            role: 'ROLE_TEAM_LEADER',
            position: 'TEAM_LEADER',
            department: { deptName: 'Sales' },
            status: 'ACTIVE',
          },
          {
            id: 'emp-section-chief',
            empName: 'Section Reviewer',
            role: 'ROLE_SECTION_CHIEF',
            position: 'DIRECTOR',
            department: { deptName: 'Section Office' },
            status: 'ACTIVE',
          },
          {
            id: 'emp-div-head',
            empName: 'Division Reviewer',
            role: 'ROLE_DIV_HEAD',
            position: 'DIRECTOR',
            department: { deptName: 'Division HQ' },
            status: 'ACTIVE',
          },
          {
            id: 'emp-ceo',
            empName: 'CEO Reviewer',
            role: 'ROLE_CEO',
            position: 'CEO',
            department: { deptName: 'CEO Office' },
            status: 'ACTIVE',
          },
        ]

        return profiles.filter((profile) => ids.includes(profile.id))
      },
      findFirst: async (args: { where?: { role?: string } }) => {
        if (args?.where?.role === 'ROLE_CEO' && params?.ceoPresent !== false) {
          return {
            id: 'emp-ceo',
            empName: 'CEO Reviewer',
            role: 'ROLE_CEO',
            position: 'CEO',
            department: { deptName: 'CEO Office' },
          }
        }

        return null
      },
    },
    evaluationAssignment: {
      findMany: async () => persistedAssignments,
    },
  } as any
}

async function main() {
  await run('stage chain includes section chief when hierarchy has an intermediate reviewer', async () => {
    const { getEvaluationStageChain } = await import('../src/server/evaluation-performance-assignments')
    const chain = await getEvaluationStageChain({
      db: createStageChainDb(),
      evalCycleId: 'cycle-1',
      targetId: 'emp-target',
    })

    assert.deepEqual(
      chain.map((entry) => entry.stage),
      ['SELF', 'FIRST', 'SECOND', 'FINAL', 'CEO_ADJUST']
    )
    assert.equal(chain.find((entry) => entry.stage === 'SECOND')?.evaluatorName, 'Section Reviewer')
    assert.equal(chain.find((entry) => entry.stage === 'FINAL')?.evaluatorName, 'Division Reviewer')
  })

  await run('stage chain skips section chief and falls back to division head when section chief is absent', async () => {
    const { getEvaluationStageChain } = await import('../src/server/evaluation-performance-assignments')
    const chain = await getEvaluationStageChain({
      db: createStageChainDb({ sectionChiefId: null }),
      evalCycleId: 'cycle-1',
      targetId: 'emp-target',
    })

    assert.deepEqual(chain.map((entry) => entry.stage), ['SELF', 'FIRST', 'FINAL', 'CEO_ADJUST'])
    assert.equal(chain.some((entry) => entry.stage === 'SECOND'), false)
    assert.equal(chain.find((entry) => entry.stage === 'FINAL')?.evaluatorName, 'Division Reviewer')
  })

  await run('stage chain respects manual stage assignments even when hierarchy does not provide section chief', async () => {
    const { getEvaluationStageChain } = await import('../src/server/evaluation-performance-assignments')
    const chain = await getEvaluationStageChain({
      db: createStageChainDb({
        sectionChiefId: null,
        persistedAssignments: [
          {
            evalStage: 'SECOND',
            evaluatorId: 'emp-section-chief',
            evaluator: {
              id: 'emp-section-chief',
              empName: 'Section Reviewer',
              role: 'ROLE_SECTION_CHIEF',
              position: 'DIRECTOR',
              status: 'ACTIVE',
              department: {
                deptName: 'Section Office',
              },
            },
          },
        ],
      }),
      evalCycleId: 'cycle-1',
      targetId: 'emp-target',
    })

    assert.deepEqual(
      chain.map((entry) => entry.stage),
      ['SELF', 'FIRST', 'SECOND', 'FINAL', 'CEO_ADJUST']
    )
    assert.equal(chain.find((entry) => entry.stage === 'SECOND')?.evaluatorName, 'Section Reviewer')
  })

  await run('stage chain stops at final review when CEO is not assigned', async () => {
    const { getEvaluationStageChain } = await import('../src/server/evaluation-performance-assignments')
    const chain = await getEvaluationStageChain({
      db: createStageChainDb({ ceoPresent: false }),
      evalCycleId: 'cycle-1',
      targetId: 'emp-target',
    })

    assert.deepEqual(chain.map((entry) => entry.stage), ['SELF', 'FIRST', 'SECOND', 'FINAL'])
    assert.equal(chain.some((entry) => entry.stage === 'CEO_ADJUST'), false)
  })

  await run('stage chain does not jump to CEO when division head is absent', async () => {
    const { getEvaluationStageChain } = await import('../src/server/evaluation-performance-assignments')
    const chain = await getEvaluationStageChain({
      db: createStageChainDb({
        sectionChiefId: null,
        divisionHeadId: null,
      }),
      evalCycleId: 'cycle-1',
      targetId: 'emp-target',
    })

    assert.deepEqual(chain.map((entry) => entry.stage), ['SELF', 'FIRST'])
    assert.equal(chain.some((entry) => entry.stage === 'CEO_ADJUST'), false)
  })

  console.log('Evaluation stage chain tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
