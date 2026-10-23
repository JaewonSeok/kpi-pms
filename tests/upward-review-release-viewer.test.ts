import './register-path-aliases'
import assert from 'node:assert/strict'
import Module from 'node:module'

process.env.DATABASE_URL ||= 'postgresql://postgres:password@localhost:5432/kpi_pms'

// 한 건이 실패해도 나머지 케이스 결과를 함께 보도록 끝까지 돌고, 실패가 있으면 exit 1 로 끝낸다.
async function run(name: string, fn: () => Promise<void> | void) {
  try {
    await fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}

function stubModule(request: string, exports: Record<string, unknown>) {
  const filename = require.resolve(request)
  const stub = new Module(filename)
  stub.filename = filename
  stub.loaded = true
  stub.exports = exports
  require.cache[filename] = stub
}

type Scenario = {
  status: 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
  released: boolean
  viewerMode: 'TARGET_ONLY' | 'TARGET_AND_PRIMARY_MANAGER'
  feedbackCount: number
}
let scenario: Scenario = { status: 'COMPLETED', released: true, viewerMode: 'TARGET_ONLY', feedbackCount: 3 }

const ORG = 'org-1'
const department = { id: 'dept-1', deptName: '영업팀', orgId: ORG }
const EMPLOYEES: Record<string, Record<string, unknown>> = {
  // 상향평가 대상(리더)과 그 리더 슬롯(실장)
  'emp-leader': { empName: '팀장', role: 'ROLE_TEAM_LEADER', position: 'TEAM_LEADER', sectionChiefId: 'emp-chief' },
  'emp-chief': { empName: '실장', role: 'ROLE_SECTION_CHIEF', position: 'SECTION_CHIEF' },
  'emp-admin': { empName: '관리자', role: 'ROLE_ADMIN', position: 'MEMBER' },
  'emp-m1': { empName: '팀원1', role: 'ROLE_MEMBER', position: 'MEMBER', teamLeaderId: 'emp-leader' },
  'emp-m2': { empName: '팀원2', role: 'ROLE_MEMBER', position: 'MEMBER', teamLeaderId: 'emp-leader' },
  'emp-m3': { empName: '팀원3', role: 'ROLE_MEMBER', position: 'MEMBER', teamLeaderId: 'emp-leader' },
}
function employee(id: string) {
  const base = EMPLOYEES[id]
  if (!base) return null
  return {
    id,
    empId: id,
    gwsEmail: `${id}@example.com`,
    jobTitle: null,
    teamName: '영업팀',
    teamLeaderId: null,
    sectionChiefId: null,
    divisionHeadId: null,
    profileImageUrl: null,
    status: 'ACTIVE',
    deptId: 'dept-1',
    department,
    ...base,
  }
}

const responseText = (index: number) => `UPWARD_RESP_${index}_원문`
function documentSettings() {
  return {
    templateId: 'tpl-1',
    templateName: '리더십 문항',
    targetTypes: ['TEAM_LEADER'],
    resultViewerMode: scenario.viewerMode,
    rawResponsePolicy: 'ADMIN_ONLY',
    ...(scenario.released ? { resultReleasedAt: '2026-07-01T00:00:00.000Z', resultReleasedById: 'emp-admin' } : {}),
  }
}
const QUESTIONS = [
  { id: 'q-rating', category: '리더십', questionText: '리더십 점수', description: null, questionType: 'RATING_SCALE', scaleMin: 1, scaleMax: 5, isRequired: true, isActive: true, choiceOptions: null, sortOrder: 1 },
  { id: 'q-text', category: '리더십', questionText: '리더십 의견', description: null, questionType: 'TEXT', scaleMin: null, scaleMax: null, isRequired: true, isActive: true, choiceOptions: null, sortOrder: 2 },
]
function roundRow() {
  const givers = ['emp-m1', 'emp-m2', 'emp-m3'].slice(0, scenario.feedbackCount)
  return {
    id: 'round-up',
    evalCycleId: 'cycle-1',
    roundName: '리더십 진단',
    roundType: 'UPWARD',
    status: scenario.status,
    isAnonymous: true,
    minRaters: 3,
    maxRaters: 20,
    startDate: new Date('2026-06-01T00:00:00Z'),
    endDate: new Date('2026-06-30T00:00:00Z'),
    createdAt: new Date('2026-05-01T00:00:00Z'),
    documentSettings: documentSettings(),
    evalCycle: { orgId: ORG },
    collaborators: [],
    questions: QUESTIONS,
    feedbacks: givers.map((giverId, index) => ({
      id: `fb-${index}`,
      roundId: 'round-up',
      giverId,
      receiverId: 'emp-leader',
      relationship: 'SUBORDINATE',
      status: 'SUBMITTED',
      overallComment: null,
      submittedAt: new Date('2026-06-20T00:00:00Z'),
      createdAt: new Date('2026-06-01T00:00:00Z'),
      updatedAt: new Date('2026-06-20T00:00:00Z'),
      giver: employee(giverId),
      receiver: employee('emp-leader'),
      responses: [
        { id: `r-${index}-1`, questionId: 'q-rating', ratingValue: 4, textValue: null, question: QUESTIONS[0] },
        { id: `r-${index}-2`, questionId: 'q-text', ratingValue: null, textValue: responseText(index), question: QUESTIONS[1] },
      ],
    })),
  }
}

// 스텁하지 않은 모델 · 메서드에 접근하면 기록하고 즉시 던진다. 실제 Prisma 로는 나가지 않는다.
const unstubbedCalls: string[] = []
const roundUpdates: Array<Record<string, unknown>> = []
function guardedDb(models: Record<string, Record<string, unknown>>): Record<string, unknown> {
  return new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => {
      if (typeof key !== 'string' || key === 'then') return undefined
      const methods = models[key] ?? {}
      return new Proxy({} as Record<string, unknown>, {
        get: (_inner, method) => {
          if (typeof method !== 'string' || method === 'then') return undefined
          if (methods[method]) return methods[method]
          return () => {
            unstubbedCalls.push(`${key}.${method}`)
            throw new Error(`UNSTUBBED_DB_CALL:${key}.${method}`)
          }
        },
      })
    },
  })
}
const fakeDb = guardedDb({
  employee: { findUnique: async (args: { where: { id: string } }) => employee(args.where.id) },
  feedbackAdminGroupMember: { findMany: async () => [] },
  evalCycle: { findMany: async () => [{ id: 'cycle-1', cycleName: '2026 평가', evalYear: 2026, status: 'FINAL_EVAL' }] },
  multiFeedbackRound: {
    findMany: async () => [roundRow()],
    findFirst: async () => roundRow(),
    update: async (args: { data: Record<string, unknown> }) => {
      roundUpdates.push(args.data)
      return { id: 'round-up' }
    },
  },
  multiFeedback: { count: async () => roundRow().feedbacks.length },
})

let currentSession: { user: { id: string; role: string; name: string; email: string } } | null = null
const sessionFor = (id: string) => ({
  user: { id, role: String(EMPLOYEES[id].role), name: String(EMPLOYEES[id].empName), email: `${id}@example.com` },
})
stubModule('next-auth', { getServerSession: async () => currentSession })
stubModule('../src/lib/auth', { authOptions: {} })
stubModule('../src/lib/audit', {
  createAuditLog: async () => undefined,
  getClientInfo: () => ({}),
  resolveAuditActor: () => ({ userId: currentSession?.user.id }),
})
stubModule('../src/lib/prisma', { prisma: fakeDb })

async function main() {
  const { getUpwardReviewPageData } = await import('../src/server/upward-review')
  const adminRoute = await import('../src/app/api/feedback/upward/admin/route')

  // 결과 화면을 본다: 본 것 = 준비됨 · 결과 visible · 응답 원문이 내려왔는지
  const viewResults = async (viewerId: string) => {
    currentSession = sessionFor(viewerId)
    const data = await getUpwardReviewPageData({
      session: currentSession as never,
      mode: 'results',
      cycleId: 'cycle-1',
      roundId: 'round-up',
      empId: 'emp-leader',
      skipResultsAuditLog: true,
    })
    const json = JSON.stringify(data.results ?? null)
    return {
      sees: data.state === 'ready' && data.results?.visible === true,
      hasResponseText: [0, 1, 2].some((index) => json.includes(responseText(index))),
    }
  }
  const adminAction = async (action: string, payload: Record<string, unknown>) => {
    currentSession = sessionFor('emp-admin')
    const response = await adminRoute.POST(
      new Request('http://localhost/api/feedback/upward/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, payload }),
      })
    )
    return response.status
  }

  await run('ⓐ TARGET_ONLY: 리더 슬롯은 결과를 못 본다', async () => {
    scenario = { status: 'COMPLETED', released: true, viewerMode: 'TARGET_ONLY', feedbackCount: 3 }
    assert.deepEqual(
      // 대상 본인은 그대로 본다(문항별 응답 요약 포함). 리더 슬롯(실장)은 결과도 응답 원문도 받지 않는다.
      { chief: await viewResults('emp-chief'), targetSees: (await viewResults('emp-leader')).sees },
      { chief: { sees: false, hasResponseText: false }, targetSees: true }
    )
  })

  await run('ⓑ 다른 열람 모드는 지금과 같다', async () => {
    scenario = { status: 'COMPLETED', released: true, viewerMode: 'TARGET_AND_PRIMARY_MANAGER', feedbackCount: 3 }
    const chief = await viewResults('emp-chief')
    const target = await viewResults('emp-leader')
    assert.deepEqual({ chief: chief.sees, target: target.sees }, { chief: true, target: true })
  })

  await run('ⓒ 마감 전 공개는 거절되고 아무것도 쓰지 않는다', async () => {
    scenario = { status: 'IN_PROGRESS', released: false, viewerMode: 'TARGET_ONLY', feedbackCount: 3 }
    roundUpdates.length = 0
    const status = await adminAction('setRelease', { roundId: 'round-up', released: true })
    assert.deepEqual({ status, writes: roundUpdates.length }, { status: 400, writes: 0 })
  })

  await run('ⓓ 공개 후 다시 열면 공개 표시가 지워진다', async () => {
    scenario = { status: 'COMPLETED', released: true, viewerMode: 'TARGET_ONLY', feedbackCount: 3 }
    roundUpdates.length = 0
    const status = await adminAction('updateRoundStatus', { roundId: 'round-up', action: 'REOPEN' })
    const written = roundUpdates[0]?.documentSettings as Record<string, unknown> | undefined
    assert.deepEqual(
      {
        status,
        nextStatus: roundUpdates[0]?.status ?? null,
        releasedAtCleared: written ? !('resultReleasedAt' in written) && !('resultReleasedById' in written) : false,
        keepsOtherSettings: written?.templateId ?? null,
      },
      { status: 200, nextStatus: 'IN_PROGRESS', releasedAtCleared: true, keepsOtherSettings: 'tpl-1' }
    )
  })

  await run('ⓔ 취소된 라운드 · 짝 0건 라운드는 START 가 거절된다', async () => {
    scenario = { status: 'CANCELLED', released: false, viewerMode: 'TARGET_ONLY', feedbackCount: 3 }
    roundUpdates.length = 0
    const cancelled = await adminAction('updateRoundStatus', { roundId: 'round-up', action: 'START' })
    scenario = { status: 'DRAFT', released: false, viewerMode: 'TARGET_ONLY', feedbackCount: 0 }
    const empty = await adminAction('updateRoundStatus', { roundId: 'round-up', action: 'START' })
    assert.deepEqual({ cancelled, empty, writes: roundUpdates.length }, { cancelled: 400, empty: 400, writes: 0 })
  })

  await run('실제 Prisma 로 나간 호출이 없다(스텁하지 않은 DB 호출 0건)', () => {
    assert.deepEqual([...new Set(unstubbedCalls)], [])
  })

  console.log('Upward review release · viewer tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
