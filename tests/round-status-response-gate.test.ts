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

type RoundStatus = 'DRAFT' | 'RATER_SELECTION' | 'IN_PROGRESS' | 'COMPLETED' | 'CLOSED' | 'CANCELLED'
const ALL_STATUSES: RoundStatus[] = ['DRAFT', 'RATER_SELECTION', 'IN_PROGRESS', 'COMPLETED', 'CLOSED', 'CANCELLED']

// 기간 안 · 기간 밖(이미 끝남) 두 가지. 테스트가 언제 돌아도 판정이 같도록 넓게 잡는다.
const IN_PERIOD = { startDate: new Date('2020-01-01T00:00:00Z'), endDate: new Date('2099-12-31T23:59:59Z') }
const PAST_PERIOD = { startDate: new Date('2020-01-01T00:00:00Z'), endDate: new Date('2020-01-31T23:59:59Z') }

// ---- fixture -------------------------------------------------------------------------
const ORG = 'org-1'
const department = { id: 'dept-1', deptName: '영업팀', orgId: ORG }
const EMPLOYEES: Record<string, Record<string, unknown>> = {
  'emp-admin': { empName: '관리자', role: 'ROLE_ADMIN', position: 'MEMBER' },
  'emp-leader': { empName: '팀장', role: 'ROLE_TEAM_LEADER', position: 'TEAM_LEADER', jobTitle: '팀장' },
  'emp-m1': { empName: '팀원1', role: 'ROLE_MEMBER', position: 'MEMBER', teamLeaderId: 'emp-leader' },
  'emp-m2': { empName: '팀원2', role: 'ROLE_MEMBER', position: 'MEMBER', teamLeaderId: 'emp-leader' },
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

const UPWARD_QUESTIONS = [
  { id: 'q-rating', category: '리더십', questionText: '리더십 점수', description: null, questionType: 'RATING_SCALE', scaleMin: 1, scaleMax: 5, isRequired: true, isActive: true, choiceOptions: null, sortOrder: 1 },
]

// ---- 상황 ----------------------------------------------------------------------------
type UpwardAssignment = { id: string; roundId: string; status: 'PENDING' | 'IN_PROGRESS' | 'SUBMITTED' }
type UpwardRound = { id: string; status: RoundStatus; startDate: Date; endDate: Date }
type HubRound = {
  id: string
  roundType: 'FULL_360' | 'ANYTIME'
  status: RoundStatus
  onboarding: boolean
  feedbackStatus: 'PENDING' | 'IN_PROGRESS' | 'SUBMITTED'
}
const state = {
  // 응답 라우트가 읽는 상향평가 응답 한 건의 라운드
  responseRound: { id: 'up-round', status: 'IN_PROGRESS' as RoundStatus, ...IN_PERIOD },
  // 상향평가 목록(overview)이 읽는 라운드 · 배정
  upwardRounds: [] as UpwardRound[],
  upwardAssignments: [] as UpwardAssignment[],
  // 360 허브가 읽는 라운드
  hubRounds: [] as HubRound[],
  // 짝 추가가 읽는 라운드 상태
  adminRoundStatus: 'IN_PROGRESS' as RoundStatus,
}

function upwardRoundRow(round: UpwardRound) {
  return {
    id: round.id,
    evalCycleId: 'cycle-1',
    roundName: `리더십 진단 ${round.id}`,
    roundType: 'UPWARD',
    status: round.status,
    isAnonymous: true,
    minRaters: 3,
    maxRaters: 20,
    startDate: round.startDate,
    endDate: round.endDate,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    documentSettings: { templateId: 'tpl-1', templateName: '리더십 문항', targetTypes: ['TEAM_LEADER'] },
    evalCycle: { orgId: ORG },
    collaborators: [],
    questions: UPWARD_QUESTIONS,
    feedbacks: [],
  }
}

function hubRoundRow(round: HubRound) {
  const giver = employee('emp-m1')
  const receiver = employee('emp-m2')
  return {
    id: round.id,
    evalCycleId: 'cycle-1',
    folderId: null,
    folder: null,
    roundName: `라운드 ${round.id}`,
    roundType: round.roundType,
    documentKind: null,
    startDate: IN_PERIOD.startDate,
    endDate: IN_PERIOD.endDate,
    status: round.status,
    isAnonymous: true,
    minRaters: 3,
    maxRaters: 8,
    weightInFinal: 0,
    createdById: 'emp-admin',
    selectionSettings: null,
    visibilitySettings: null,
    resultPresentationSettings: null,
    reportAnalysisSettings: null,
    ratingGuideSettings: null,
    documentSettings: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    feedbacks: [
      {
        id: `fb-${round.id}`,
        roundId: round.id,
        giverId: 'emp-m1',
        // 라운드마다 다른 대상으로 둬서 같은 대상 묶기(dedupe)에 걸리지 않게 한다.
        receiverId: `emp-m2`,
        relationship: 'PEER',
        overallComment: null,
        status: round.feedbackStatus,
        submittedAt: null,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
        receiver,
        giver,
        responses: [],
      },
    ],
    questions: [],
    nominations: [],
    reportCaches: [],
    collaborators: [],
    onboardingReviewGeneration: round.onboarding ? { id: `gen-${round.id}` } : null,
    evalCycle: { orgId: ORG },
  }
}

// 스텁하지 않은 모델 · 메서드에 접근하면 기록하고 즉시 던진다. 실제 Prisma 로는 나가지 않는다.
const unstubbedCalls: string[] = []
const writes: string[] = []
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
const record = (call: string) => async () => {
  writes.push(call)
  return { id: 'written', count: 1 }
}

// 어느 화면(테스트)에서 부르는지에 따라 multiFeedbackRound.findMany 가 돌려줄 라운드를 고른다.
let roundListSource: 'hub' | 'upward' = 'hub'
const fakeDb = guardedDb({
  employee: {
    findUnique: async (args: { where: { id: string } }) => employee(args.where.id),
    findFirst: async (args: { where: { id: string } }) => employee(args.where.id),
    findMany: async () => Object.keys(EMPLOYEES).map((id) => employee(id)),
  },
  evalCycle: {
    findMany: async () => [{ id: 'cycle-1', orgId: ORG, cycleName: '2026 평가', evalYear: 2026, status: 'SELF_EVAL' }],
  },
  feedbackAdminGroupMember: { findMany: async () => [] },
  feedbackFolder: { findMany: async () => [] },
  feedbackNomination: { findMany: async () => [] },
  auditLog: { findFirst: async () => null, create: record('auditLog.create') },
  multiFeedbackRound: {
    findMany: async () =>
      roundListSource === 'hub'
        ? state.hubRounds.map((round) => hubRoundRow(round))
        : state.upwardRounds.map((round) => upwardRoundRow(round)),
    // 짝 추가(addAssignment · addSuggestedAssignments)가 읽는 라운드
    findFirst: async () => ({
      ...upwardRoundRow({ id: 'up-admin', status: state.adminRoundStatus, ...IN_PERIOD }),
      feedbacks: [],
    }),
  },
  multiFeedback: {
    // 응답 라우트: 평가자 본인의 상향평가 응답 한 건
    findFirst: async () => ({
      id: 'fb-up',
      roundId: state.responseRound.id,
      giverId: 'emp-m1',
      receiverId: 'emp-leader',
      relationship: 'SUBORDINATE',
      status: 'PENDING',
      overallComment: null,
      round: upwardRoundRow({ ...state.responseRound }),
      responses: [],
      receiver: { id: 'emp-leader', empName: '팀장' },
    }),
    findUnique: async () => null,
    // 상향평가 목록(overview): 평가자 본인의 배정 전부
    findMany: async () =>
      state.upwardAssignments.map((assignment) => {
        const round = state.upwardRounds.find((item) => item.id === assignment.roundId)!
        return {
          id: assignment.id,
          roundId: assignment.roundId,
          giverId: 'emp-m1',
          receiverId: 'emp-leader',
          relationship: 'SUBORDINATE',
          status: assignment.status,
          createdAt: new Date('2026-01-01T00:00:00Z'),
          round: { ...upwardRoundRow(round) },
          receiver: employee('emp-leader'),
        }
      }),
    count: async () => 0,
    create: record('multiFeedback.create'),
    update: record('multiFeedback.update'),
  },
  feedbackResponse: {
    deleteMany: record('feedbackResponse.deleteMany'),
    updateMany: record('feedbackResponse.updateMany'),
    create: record('feedbackResponse.create'),
    findMany: async () => [],
  },
  feedbackReportCache: { findUnique: async () => null },
  developmentPlan: { findFirst: async () => null },
  personalKpi: { findMany: async () => [] },
  checkIn: { findMany: async () => [] },
  upwardReviewTemplate: { findMany: async () => [] },
})

let currentSession: { user: { id: string; role: string; name: string; email: string } } | null = null
const sessionFor = (id: string) => ({
  user: { id, role: String(EMPLOYEES[id].role), name: String(EMPLOYEES[id].empName), email: `${id}@example.com` },
})
stubModule('next-auth', { getServerSession: async () => currentSession })
stubModule('../src/lib/auth', { authOptions: {} })
stubModule('../src/lib/audit', {
  createAuditLog: async () => {
    writes.push('createAuditLog')
  },
  getClientInfo: () => ({}),
  resolveAuditActor: () => ({ userId: currentSession?.user.id }),
})
stubModule('../src/lib/prisma', { prisma: fakeDb })

type ResponseRoute = {
  PATCH: (request: Request, context: { params: Promise<{ feedbackId: string }> }) => Promise<Response>
  POST: (request: Request, context: { params: Promise<{ feedbackId: string }> }) => Promise<Response>
}

async function main() {
  const responseRoute = (await import('../src/app/api/feedback/upward/responses/[feedbackId]/route')) as unknown as ResponseRoute
  const adminRoute = await import('../src/app/api/feedback/upward/admin/route')
  const { getUpwardReviewPageData } = await import('../src/server/upward-review')
  const { getFeedback360PageData } = await import('../src/server/feedback-360')

  // 상향평가 응답 저장(PATCH) · 제출(POST). 본 것 = 상태 코드 · 에러 코드
  const respond = async (method: 'PATCH' | 'POST') => {
    currentSession = sessionFor('emp-m1')
    const response = await responseRoute[method](
      new Request('http://localhost/api/feedback/upward/responses/fb-up', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responses: [{ questionId: 'q-rating', ratingValue: 4 }] }),
      }),
      { params: Promise.resolve({ feedbackId: 'fb-up' }) }
    )
    const json = (await response.json().catch(() => null)) as { error?: { code?: string } } | null
    return response.status === 200 ? 200 : `${response.status}:${json?.error?.code ?? '?'}`
  }
  const respondBoth = async (round: Omit<UpwardRound, 'id'>) => {
    state.responseRound = { id: 'up-round', ...round }
    writes.length = 0
    const save = await respond('PATCH')
    const submit = await respond('POST')
    return { save, submit, writes: writes.length }
  }

  await run('ⓐ 상향평가: 시작 전 라운드는 기간 안이어도 저장 · 제출이 거절되고 아무것도 쓰지 않는다', async () => {
    assert.deepEqual(
      {
        DRAFT: await respondBoth({ status: 'DRAFT', ...IN_PERIOD }),
        RATER_SELECTION: await respondBoth({ status: 'RATER_SELECTION', ...IN_PERIOD }),
      },
      {
        DRAFT: { save: '400:ROUND_NOT_STARTED', submit: '400:ROUND_NOT_STARTED', writes: 0 },
        RATER_SELECTION: { save: '400:ROUND_NOT_STARTED', submit: '400:ROUND_NOT_STARTED', writes: 0 },
      }
    )
  })

  await run('ⓑ 상향평가: IN_PROGRESS 라운드는 기간 안이면 된다. 기간 밖 · 마감 · 취소는 거절된다', async () => {
    const open = await respondBoth({ status: 'IN_PROGRESS', ...IN_PERIOD })
    const ended = await respondBoth({ status: 'IN_PROGRESS', ...PAST_PERIOD })
    const completed = await respondBoth({ status: 'COMPLETED', ...IN_PERIOD })
    const closed = await respondBoth({ status: 'CLOSED', ...IN_PERIOD })
    const cancelled = await respondBoth({ status: 'CANCELLED', ...IN_PERIOD })
    assert.deepEqual(
      {
        open: [open.save, open.submit, open.writes > 0],
        ended: [ended.save, ended.submit, ended.writes],
        completed: [completed.save, completed.submit, completed.writes],
        closed: [closed.save, closed.submit, closed.writes],
        cancelled: [cancelled.save, cancelled.submit, cancelled.writes],
      },
      {
        open: [200, 200, true],
        ended: ['400:ROUND_ENDED', '400:ROUND_ENDED', 0],
        completed: ['400:ROUND_ENDED', '400:ROUND_ENDED', 0],
        closed: ['400:ROUND_ENDED', '400:ROUND_ENDED', 0],
        cancelled: ['400:ROUND_ENDED', '400:ROUND_ENDED', 0],
      }
    )
  })

  // 360 허브 '작성할 응답'(pendingRequests)에 나온 라운드
  const hubPendingRoundIds = async () => {
    roundListSource = 'hub'
    currentSession = sessionFor('emp-m1')
    const data = await getFeedback360PageData({ session: currentSession as never, mode: 'overview', cycleId: 'cycle-1' })
    if (data.state === 'error') throw new Error(`hub error: ${data.message}`)
    return (data.pendingRequests ?? []).map((request) => request.roundId).sort()
  }

  await run("ⓒ 360 허브 '작성할 응답'에 IN_PROGRESS 가 아닌 라운드의 미제출 응답이 나오지 않는다", async () => {
    state.hubRounds = ALL_STATUSES.map((status) => ({
      id: `r360-${status}`,
      roundType: 'FULL_360' as const,
      status,
      onboarding: false,
      feedbackStatus: 'PENDING' as const,
    }))
    assert.deepEqual(await hubPendingRoundIds(), ['r360-IN_PROGRESS'])
  })

  // 상향평가 목록(overview)에 나온 배정
  const upwardOverviewIds = async () => {
    roundListSource = 'upward'
    currentSession = sessionFor('emp-m1')
    const data = await getUpwardReviewPageData({ session: currentSession as never, mode: 'overview', cycleId: 'cycle-1' })
    if (data.state === 'error') throw new Error(`upward error: ${data.message}`)
    return (data.overview?.assignments ?? []).map((assignment) => assignment.feedbackId).sort()
  }

  await run('ⓓ 상향평가 목록에 시작 전 · 마감 라운드의 미제출 항목과 취소 라운드 항목이 나오지 않는다', async () => {
    state.upwardRounds = [
      ...ALL_STATUSES.map((status) => ({ id: `up-${status}`, status, ...IN_PERIOD })),
      { id: 'up-IN_PROGRESS-ended', status: 'IN_PROGRESS' as const, ...PAST_PERIOD },
    ]
    state.upwardAssignments = state.upwardRounds.flatMap((round) => [
      { id: `${round.id}:pending`, roundId: round.id, status: 'PENDING' as const },
      { id: `${round.id}:submitted`, roundId: round.id, status: 'SUBMITTED' as const },
    ])
    assert.deepEqual(
      await upwardOverviewIds(),
      [
        // 미제출은 지금 제출할 수 있는 것만. 제출 기록은 취소 라운드만 뺀다.
        'up-CLOSED:submitted',
        'up-COMPLETED:submitted',
        'up-DRAFT:submitted',
        'up-IN_PROGRESS-ended:submitted',
        'up-IN_PROGRESS:pending',
        'up-IN_PROGRESS:submitted',
        'up-RATER_SELECTION:submitted',
      ].sort()
    )
  })

  await run('ⓔ 취소 · 마감 라운드에는 짝을 추가할 수 없다', async () => {
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
    const results: Record<string, unknown> = {}
    for (const status of ['CANCELLED', 'COMPLETED', 'CLOSED'] as const) {
      state.adminRoundStatus = status
      writes.length = 0
      const single = await adminAction('addAssignment', {
        roundId: 'up-admin',
        evaluatorId: 'emp-m1',
        evaluateeId: 'emp-leader',
        relationship: 'SUBORDINATE',
      })
      const suggested = await adminAction('addSuggestedAssignments', { roundId: 'up-admin' })
      results[status] = { single, suggested, writes: writes.length }
    }
    assert.deepEqual(results, {
      CANCELLED: { single: 400, suggested: 400, writes: 0 },
      COMPLETED: { single: 400, suggested: 400, writes: 0 },
      CLOSED: { single: 400, suggested: 400, writes: 0 },
    })
  })

  await run('ⓕ 진행 중인 수시 리뷰 · 온보딩 라운드의 미제출 응답은 지금처럼 보인다', async () => {
    state.hubRounds = [
      { id: 'r-anytime', roundType: 'ANYTIME', status: 'IN_PROGRESS', onboarding: false, feedbackStatus: 'PENDING' },
      { id: 'r-onboarding', roundType: 'FULL_360', status: 'IN_PROGRESS', onboarding: true, feedbackStatus: 'IN_PROGRESS' },
    ]
    assert.deepEqual(await hubPendingRoundIds(), ['r-anytime', 'r-onboarding'])
  })

  await run('실제 Prisma 로 나간 호출이 없다(스텁하지 않은 DB 호출 0건)', () => {
    assert.deepEqual([...new Set(unstubbedCalls)], [])
  })

  console.log('Round status response gate tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
