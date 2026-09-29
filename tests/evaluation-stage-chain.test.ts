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
  teamLeaderId?: string | null
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
          teamLeaderId:
            params?.teamLeaderId === undefined ? 'emp-team-leader' : params.teamLeaderId,
          sectionChiefId:
            params?.sectionChiefId === undefined ? 'emp-section-chief' : params.sectionChiefId,
          divisionHeadId:
            params?.divisionHeadId === undefined ? 'emp-div-head' : params.divisionHeadId,
          jobTitle: null,
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
            jobTitle: '팀장',
            department: { deptName: 'Sales' },
            status: 'ACTIVE',
          },
          {
            id: 'emp-section-chief',
            empName: 'Section Reviewer',
            role: 'ROLE_SECTION_CHIEF',
            position: 'DIRECTOR',
            jobTitle: '실장',
            department: { deptName: 'Section Office' },
            status: 'ACTIVE',
          },
          {
            id: 'emp-div-head',
            empName: 'Division Reviewer',
            role: 'ROLE_DIV_HEAD',
            position: 'DIRECTOR',
            jobTitle: '본부장',
            department: { deptName: 'Division HQ' },
            status: 'ACTIVE',
          },
          {
            id: 'emp-ceo',
            empName: 'CEO Reviewer',
            role: 'ROLE_CEO',
            position: 'CEO',
            jobTitle: '대표이사',
            department: { deptName: 'CEO Office' },
            status: 'ACTIVE',
          },
          {
            id: 'emp-admin-leader',
            empName: 'Admin Leader Reviewer',
            role: 'ROLE_ADMIN',
            position: 'MEMBER',
            jobTitle: '팀장',
            department: { deptName: 'Sales' },
            status: 'ACTIVE',
          },
          {
            id: 'emp-admin-plain',
            empName: 'Admin Plain Reviewer',
            role: 'ROLE_ADMIN',
            position: 'MEMBER',
            jobTitle: null,
            department: { deptName: 'Sales' },
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
    assert.deepEqual(chain.map((entry) => entry.reviewOrder), [0, 1, 2, 3, 4])
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
    assert.deepEqual(chain.map((entry) => entry.reviewOrder), [0, 1, 3, 4])
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

  await run('stage chain continues when first reviewer is absent', async () => {
    const { getEvaluationStageChain } = await import('../src/server/evaluation-performance-assignments')
    const chain = await getEvaluationStageChain({
      db: createStageChainDb({ teamLeaderId: null }),
      evalCycleId: 'cycle-1',
      targetId: 'emp-target',
    })

    assert.deepEqual(chain.map((entry) => entry.stage), ['SELF', 'SECOND', 'FINAL', 'CEO_ADJUST'])
    assert.equal(chain.some((entry) => entry.stage === 'FIRST'), false)
  })

  await run('stage chain for a team leader has no first or second reviewer', async () => {
    const { getEvaluationStageChain } = await import('../src/server/evaluation-performance-assignments')
    const chain = await getEvaluationStageChain({
      db: createStageChainDb({ teamLeaderId: null, sectionChiefId: null }),
      evalCycleId: 'cycle-1',
      targetId: 'emp-target',
    })

    assert.deepEqual(chain.map((entry) => entry.stage), ['SELF', 'FINAL', 'CEO_ADJUST'])
  })

  await run('stage chain has only self review when no reviewer is assigned', async () => {
    const { getEvaluationStageChain } = await import('../src/server/evaluation-performance-assignments')
    const chain = await getEvaluationStageChain({
      db: createStageChainDb({ teamLeaderId: null, sectionChiefId: null, divisionHeadId: null }),
      evalCycleId: 'cycle-1',
      targetId: 'emp-target',
    })

    assert.deepEqual(chain.map((entry) => entry.stage), ['SELF'])
  })

  await run('final stage shows ceo as acting division head', async () => {
    const { getEvaluationStageChain } = await import('../src/server/evaluation-performance-assignments')
    const chain = await getEvaluationStageChain({
      db: createStageChainDb({ divisionHeadId: 'emp-ceo' }),
      evalCycleId: 'cycle-1',
      targetId: 'emp-target',
    })

    const finalLabel = chain.find((entry) => entry.stage === 'FINAL')?.stageLabel
    const ceoAdjustLabel = chain.find((entry) => entry.stage === 'CEO_ADJUST')?.stageLabel

    assert.equal(finalLabel, '3차 본부장평가(대표 대행)')
    assert.equal(ceoAdjustLabel, '4차 대표이사 확정')
    assert.notEqual(finalLabel, ceoAdjustLabel)
  })

  await run('admin role leader is labeled by job title', async () => {
    const { getEvaluationStageChain } = await import('../src/server/evaluation-performance-assignments')
    const chain = await getEvaluationStageChain({
      db: createStageChainDb({ teamLeaderId: 'emp-admin-leader' }),
      evalCycleId: 'cycle-1',
      targetId: 'emp-target',
    })

    const firstStage = chain.find((entry) => entry.stage === 'FIRST')
    assert.equal(firstStage?.stageRoleLabel, '팀장평가')
    assert.equal(firstStage?.evaluatorPosition, '팀장')
  })

  await run('admin role without job title keeps the generic label', async () => {
    const { getEvaluationStageChain } = await import('../src/server/evaluation-performance-assignments')
    const chain = await getEvaluationStageChain({
      db: createStageChainDb({ teamLeaderId: 'emp-admin-plain' }),
      evalCycleId: 'cycle-1',
      targetId: 'emp-target',
    })

    assert.equal(chain.find((entry) => entry.stage === 'FIRST')?.stageRoleLabel, '관리자 검토')
  })

  console.log('Evaluation stage chain tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
