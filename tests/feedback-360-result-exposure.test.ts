import assert from 'node:assert/strict'
import Module from 'node:module'
import './register-path-aliases'

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

type Relationship = 'SELF' | 'SUPERVISOR' | 'PEER'
type FeedbackSpec = { id: string; giverId: string; relationship: Relationship; rating: number; tags?: string[] }
type Scenario = {
  status: 'IN_PROGRESS' | 'COMPLETED'
  minRaters: number
  feedbacks: FeedbackSpec[]
  // 관리자가 결과를 공개했는지(documentSettings.resultReleasedAt)
  released?: boolean
}

const ORG = 'org-1'
const department = (deptName: string) => ({ id: `dept-${deptName}`, deptName, orgId: ORG })
const EMPLOYEES: Record<string, Record<string, unknown>> = {
  'emp-target': { empName: '대상자', role: 'ROLE_MEMBER', position: 'MEMBER', teamLeaderId: 'emp-leader' },
  'emp-leader': { empName: '팀장', role: 'ROLE_TEAM_LEADER', position: 'TEAM_LEADER', teamLeaderId: null },
  'emp-admin': { empName: '관리자', role: 'ROLE_ADMIN', position: 'MEMBER', teamLeaderId: null },
  'emp-p1': { empName: '동료1', role: 'ROLE_MEMBER', position: 'MEMBER', teamLeaderId: 'emp-leader' },
  'emp-p2': { empName: '동료2', role: 'ROLE_MEMBER', position: 'MEMBER', teamLeaderId: 'emp-leader' },
  'emp-p3': { empName: '동료3', role: 'ROLE_MEMBER', position: 'MEMBER', teamLeaderId: 'emp-leader' },
  'emp-p4': { empName: '동료4', role: 'ROLE_MEMBER', position: 'MEMBER', teamLeaderId: 'emp-leader' },
}

function employee(id: string) {
  const base = EMPLOYEES[id]
  if (!base) return null
  return {
    id,
    empId: id,
    gwsEmail: `${id}@example.com`,
    jobTitle: null,
    teamName: '팀A',
    sectionChiefId: null,
    divisionHeadId: null,
    profileImageUrl: null,
    status: 'ACTIVE',
    deptId: 'dept-팀A',
    department: department('팀A'),
    ...base,
  }
}

const QUESTIONS = [
  { id: 'q-rating', category: '협업', questionText: '협업 점수', questionType: 'RATING_SCALE', scaleMin: 1, scaleMax: 5 },
  { id: 'q-text', category: '성장', questionText: '성장 제안', questionType: 'TEXT', scaleMin: null, scaleMax: null },
]

// 응답 · 코멘트 · 태그 문자열은 결과에 실렸는지 그대로 찾을 수 있게 고유 표식을 쓴다.
const responseText = (id: string) => `RESP_${id}_성장 제안 응답입니다`
const commentText = (id: string) => `COMMENT_${id}_종합 의견`
function overallComment(spec: FeedbackSpec) {
  const tags = spec.tags ?? []
  return tags.length ? `${commentText(spec.id)}\n\n[선택 태그 요약]\n긍정: ${tags.join(', ')}` : commentText(spec.id)
}

let scenario: Scenario = { status: 'COMPLETED', minRaters: 3, feedbacks: [] }

function feedbackRows() {
  return scenario.feedbacks.map((spec) => ({
    id: spec.id,
    roundId: 'round-1',
    giverId: spec.giverId,
    receiverId: 'emp-target',
    relationship: spec.relationship,
    overallComment: overallComment(spec),
    status: 'SUBMITTED',
    submittedAt: new Date('2026-03-20T00:00:00Z'),
    createdAt: new Date('2026-03-01T00:00:00Z'),
    updatedAt: new Date('2026-03-20T00:00:00Z'),
    receiver: employee('emp-target'),
    giver: employee(spec.giverId),
    responses: [
      {
        id: `${spec.id}-rating`,
        feedbackId: spec.id,
        questionId: 'q-rating',
        ratingValue: spec.rating,
        textValue: null,
        question: { category: '협업', questionText: '협업 점수', questionType: 'RATING_SCALE' },
      },
      {
        id: `${spec.id}-text`,
        feedbackId: spec.id,
        questionId: 'q-text',
        ratingValue: null,
        textValue: responseText(spec.id),
        question: { category: '성장', questionText: '성장 제안', questionType: 'TEXT' },
      },
    ],
  }))
}

function documentSettings() {
  return {
    quarter: 'Q1',
    quarterLabel: '1분기',
    source: 'feedback360HubOperations',
    ...(scenario.released ? { resultReleasedAt: '2026-04-01T00:00:00.000Z', resultReleasedById: 'emp-admin' } : {}),
  }
}

function roundRow() {
  return {
    id: 'round-1',
    evalCycleId: 'cycle-1',
    folderId: null,
    folder: null,
    roundName: '2026년 1분기 360 다면평가',
    roundType: 'FULL_360',
    documentKind: null,
    startDate: new Date('2026-01-01T00:00:00Z'),
    endDate: new Date('2026-03-31T00:00:00Z'),
    status: scenario.status,
    isAnonymous: true,
    minRaters: scenario.minRaters,
    maxRaters: 8,
    weightInFinal: 0,
    createdById: 'emp-admin',
    selectionSettings: null,
    visibilitySettings: null,
    resultPresentationSettings: null,
    reportAnalysisSettings: null,
    ratingGuideSettings: null,
    documentSettings: documentSettings(),
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    feedbacks: feedbackRows(),
    questions: QUESTIONS,
    nominations: [],
    reportCaches: [],
    collaborators: [],
    onboardingReviewGeneration: null,
    evalCycle: { orgId: ORG },
  }
}

// 스텁하지 않은 모델 · 메서드에 접근하면 기록하고 즉시 던진다. 실제 Prisma 로는 나가지 않는다.
const unstubbedCalls: string[] = []
function guardedDb(models: Record<string, Record<string, unknown>>) {
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

// 같은 대상이 받은 상향평가(UPWARD) 응답 1건. 360 리포트에는 나오면 안 된다.
function upwardRow() {
  return {
    id: 'fb-upward',
    roundId: 'round-up',
    giverId: 'emp-p1',
    receiverId: 'emp-target',
    relationship: 'SUBORDINATE',
    overallComment: 'UPWARD_COMMENT',
    status: 'SUBMITTED',
    round: {
      roundName: '리더십 진단',
      roundType: 'UPWARD',
      isAnonymous: true,
      minRaters: 1,
      status: 'COMPLETED',
      onboardingReviewGeneration: null,
      documentSettings: null,
      resultPresentationSettings: null,
    },
    responses: [
      {
        id: 'fb-upward-rating',
        questionId: 'q-up',
        ratingValue: 4,
        textValue: null,
        question: { category: '리더십', questionText: '리더십 점수', questionType: 'RATING_SCALE' },
      },
    ],
  }
}

const roundUpdates: Array<{ data: Record<string, unknown> }> = []
const auditActions: string[] = []

const fakePrisma = guardedDb({
  employee: { findUnique: async (args: { where: { id: string } }) => employee(args.where.id) },
  evalCycle: {
    findMany: async () => [{ id: 'cycle-1', orgId: ORG, cycleName: '2026 평가', evalYear: 2026, status: 'SELF_EVAL' }],
  },
  multiFeedbackRound: {
    findMany: async () => [roundRow()],
    findUnique: async () => roundRow(),
    // DB 처럼 쓴 값을 시나리오에 반영한다(상태 · 공개 표시). 이어지는 조회가 바뀐 라운드를 본다.
    update: async (args: { data: Record<string, unknown> }) => {
      roundUpdates.push({ data: args.data })
      if (args.data.status === 'IN_PROGRESS' || args.data.status === 'COMPLETED') scenario.status = args.data.status
      if ('documentSettings' in args.data) {
        const written = args.data.documentSettings as Record<string, unknown> | null
        scenario.released = typeof written?.resultReleasedAt === 'string'
      }
      return { id: 'round-1', status: scenario.status }
    },
  },
  multiFeedback: {
    // DB 처럼 where 의 roundId · round.roundType 조건만 적용한다.
    findMany: async (args: { where?: { roundId?: string; round?: { roundType?: string } } }) =>
      [
        ...feedbackRows().map((row) => ({
          ...row,
          round: {
            roundName: '2026년 1분기 360 다면평가',
            roundType: 'FULL_360',
            isAnonymous: true,
            minRaters: scenario.minRaters,
            status: scenario.status,
            onboardingReviewGeneration: null,
            documentSettings: documentSettings(),
            resultPresentationSettings: null,
          },
        })),
        upwardRow(),
      ].filter(
        (row) =>
          (!args.where?.roundId || row.roundId === args.where.roundId) &&
          (!args.where?.round?.roundType || row.round.roundType === args.where.round.roundType)
      ),
    count: async () => 0,
  },
  feedbackAdminGroupMember: { findMany: async () => [] },
  feedbackFolder: { findMany: async () => [] },
  feedbackNomination: { findMany: async () => [] },
  auditLog: { findFirst: async () => null },
  feedbackReportCache: { findUnique: async () => null },
  developmentPlan: { findFirst: async () => null },
  personalKpi: { findMany: async () => [] },
  checkIn: { findMany: async () => [] },
})

let currentSession: { user: { id: string; role: string; name: string; email: string } } | null = null
function sessionFor(id: string) {
  const row = EMPLOYEES[id]
  return { user: { id, role: String(row.role), name: String(row.empName), email: `${id}@example.com` } }
}

stubModule('next-auth', { getServerSession: async () => currentSession })
stubModule('../src/lib/auth', { authOptions: {} })
stubModule('../src/lib/audit', {
  createAuditLog: async (entry: { action: string }) => {
    auditActions.push(entry.action)
  },
  getClientInfo: () => ({}),
  resolveAuditActor: () => ({ userId: currentSession?.user.id }),
})
stubModule('../src/lib/prisma', { prisma: fakePrisma })

type PageResults = NonNullable<Awaited<ReturnType<typeof import('../src/server/feedback-360').getFeedback360PageData>>['results']>

async function main() {
  const { getFeedback360PageData } = await import('../src/server/feedback-360')
  const resultViewRoute = await import('../src/app/api/feedback/rounds/[id]/result-view/route')
  const reportRoute = await import('../src/app/api/feedback/report/[empId]/route')
  const statusRoute = await import('../src/app/api/feedback/rounds/[id]/status/route')

  const pageErrors: string[] = []
  const page = async (viewerId: string) => {
    currentSession = sessionFor(viewerId)
    const data = await getFeedback360PageData({
      session: currentSession as never,
      mode: 'results',
      cycleId: 'cycle-1',
      roundId: 'round-1',
      empId: 'emp-target',
    })
    if (data.state === 'error') pageErrors.push(`${viewerId}:${data.message}`)
    return data
  }
  const sees = async (viewerId: string) => {
    const data = await page(viewerId)
    return data.state === 'ready' && Boolean(data.results)
  }
  const resultView = async (viewerId: string) => {
    currentSession = sessionFor(viewerId)
    const response = await resultViewRoute.POST(
      new Request('http://localhost/api/feedback/rounds/round-1/result-view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetId: 'emp-target' }),
      }),
      { params: Promise.resolve({ id: 'round-1' }) }
    )
    return response.status
  }
  const reportEntry = async (viewerId: string) => {
    currentSession = sessionFor(viewerId)
    const response = await reportRoute.GET(
      new Request('http://localhost/api/feedback/report/emp-target?roundId=round-1'),
      { params: Promise.resolve({ empId: 'emp-target' }) }
    )
    const json = (await response.json()) as { data?: Array<Record<string, unknown>> }
    return (json.data ?? []).find((entry) => entry.roundId === 'round-1') ?? null
  }
  // roundId 없이 부르는 360 리포트: 대상이 받은 라운드 전부
  const reportAll = async (viewerId: string) => {
    currentSession = sessionFor(viewerId)
    const response = await reportRoute.GET(new Request('http://localhost/api/feedback/report/emp-target'), {
      params: Promise.resolve({ empId: 'emp-target' }),
    })
    const json = (await response.json()) as { data?: Array<Record<string, unknown>> }
    return json.data ?? []
  }
  const statusAction = async (viewerId: string, action: 'RELEASE_RESULTS' | 'REOPEN' | 'CLOSE') => {
    currentSession = sessionFor(viewerId)
    const response = await statusRoute.POST(
      new Request('http://localhost/api/feedback/rounds/round-1/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      }),
      { params: Promise.resolve({ id: 'round-1' }) }
    )
    return response.status
  }
  const releaseResults = (viewerId: string) => statusAction(viewerId, 'RELEASE_RESULTS')

  const THRESHOLD_MET: FeedbackSpec[] = [
    { id: 'fb-self', giverId: 'emp-target', relationship: 'SELF', rating: 5 },
    { id: 'fb-leader', giverId: 'emp-leader', relationship: 'SUPERVISOR', rating: 2, tags: ['리더단독태그'] },
    { id: 'fb-p1', giverId: 'emp-p1', relationship: 'PEER', rating: 4, tags: ['공유태그', '단독태그'] },
    { id: 'fb-p2', giverId: 'emp-p2', relationship: 'PEER', rating: 3, tags: ['공유태그'] },
    { id: 'fb-p3', giverId: 'emp-p3', relationship: 'PEER', rating: 4 },
  ]
  const BELOW_THRESHOLD: FeedbackSpec[] = [
    { id: 'fb-self', giverId: 'emp-target', relationship: 'SELF', rating: 5 },
    { id: 'fb-leader', giverId: 'emp-leader', relationship: 'SUPERVISOR', rating: 2, tags: ['리더단독태그'] },
    { id: 'fb-p1', giverId: 'emp-p1', relationship: 'PEER', rating: 4, tags: ['공유태그', '단독태그'] },
  ]

  await run('ⓐ 진행 중 라운드: 대상 본인 · 리더는 결과를 못 보고, 관리자는 본다', async () => {
    scenario = { status: 'IN_PROGRESS', minRaters: 3, feedbacks: THRESHOLD_MET }
    const observed = {
      page: { target: await sees('emp-target'), leader: await sees('emp-leader'), admin: await sees('emp-admin') },
      resultView: {
        target: await resultView('emp-target'),
        leader: await resultView('emp-leader'),
        admin: await resultView('emp-admin'),
      },
      report: {
        target: Boolean(await reportEntry('emp-target')),
        leader: Boolean(await reportEntry('emp-leader')),
        admin: Boolean(await reportEntry('emp-admin')),
      },
    }
    assert.deepEqual(observed, {
      page: { target: false, leader: false, admin: true },
      resultView: { target: 403, leader: 403, admin: 200 },
      report: { target: false, leader: false, admin: true },
    })
  })

  await run('ⓑ 마감했지만 공개 전: 대상 본인 · 리더는 못 본다', async () => {
    scenario = { status: 'COMPLETED', minRaters: 3, feedbacks: THRESHOLD_MET, released: false }
    const observed = {
      page: { target: await sees('emp-target'), leader: await sees('emp-leader'), admin: await sees('emp-admin') },
      resultView: { target: await resultView('emp-target'), leader: await resultView('emp-leader') },
      report: {
        target: Boolean(await reportEntry('emp-target')),
        leader: Boolean(await reportEntry('emp-leader')),
      },
    }
    assert.deepEqual(observed, {
      page: { target: false, leader: false, admin: true },
      resultView: { target: 403, leader: 403 },
      report: { target: false, leader: false },
    })
  })

  await run("ⓑ' 마감 + 공개 후 기준 충족: 대상 본인 · 리더가 본다", async () => {
    scenario = { status: 'COMPLETED', minRaters: 3, feedbacks: THRESHOLD_MET, released: true }
    const targetData = await page('emp-target')
    const observed = {
      page: { target: await sees('emp-target'), leader: await sees('emp-leader') },
      targetHasResponses: (targetData.results?.groupedResponses.length ?? 0) > 0,
      resultView: { target: await resultView('emp-target'), leader: await resultView('emp-leader') },
      report: {
        target: Boolean((await reportEntry('emp-target'))?.categoryAverages),
        leader: Boolean((await reportEntry('emp-leader'))?.categoryAverages),
      },
    }
    assert.deepEqual(observed, {
      page: { target: true, leader: true },
      targetHasResponses: true,
      resultView: { target: 200, leader: 200 },
      report: { target: true, leader: true },
    })
  })

  // 내려간 결과에 점수 · 문항별 응답 · 태그 · 코멘트가 남아 있으면 그 이름을 돌려준다.
  const MARKERS = [
    ...BELOW_THRESHOLD.flatMap((spec) => [responseText(spec.id), commentText(spec.id)]),
    '리더단독태그',
    '공유태그',
    '단독태그',
  ]
  function leakedContent(results: PageResults | undefined) {
    if (!results) return ['NO_RESULTS']
    const leaks: string[] = []
    if (results.categoryScores.length) leaks.push('categoryScores')
    if (results.summaryCards.some((card) => card.totalScore != null)) leaks.push('summaryCards.totalScore')
    if (results.summaryCards.some((card) => card.comment)) leaks.push('summaryCards.comment')
    if (results.groupedResponses.length) leaks.push('groupedResponses')
    if ((results.overallTagSummaries ?? []).some((summary) => summary.tagLabels.length)) leaks.push('tags')
    if (results.textHighlights.length) leaks.push('textHighlights')
    if (results.strengths.some((item) => item.includes('평균'))) leaks.push('strengths')
    if (results.improvements.some((item) => item.includes('평균'))) leaks.push('improvements')
    if (results.analysis?.reviewDetails.length) leaks.push('analysis.reviewDetails')
    if (results.managerEffectiveness) leaks.push('managerEffectiveness')
    const json = JSON.stringify(results)
    for (const marker of MARKERS) if (json.includes(marker)) leaks.push(`marker:${marker}`)
    return leaks
  }

  await run('ⓒ 기준 미달: 관리자 외에는 점수 · 응답 · 태그 · 코멘트가 하나도 나가지 않는다', async () => {
    scenario = { status: 'COMPLETED', minRaters: 3, feedbacks: BELOW_THRESHOLD, released: true }
    const targetReport = await reportEntry('emp-target')
    const observed = {
      target: leakedContent((await page('emp-target')).results),
      leader: leakedContent((await page('emp-leader')).results),
      report: {
        categoryAverages: targetReport?.categoryAverages ?? null,
        relationshipAverages: targetReport?.relationshipAverages ?? null,
        textResponses: targetReport?.textResponses ?? null,
      },
      // 대조: 관리자는 기준 미달이어도 점수를 본다(fixture 에 내용이 있다는 확인).
      adminSeesScores: ((await page('emp-admin')).results?.categoryScores.length ?? 0) > 0,
    }
    assert.deepEqual(observed, {
      target: [],
      leader: [],
      report: { categoryAverages: null, relationshipAverages: null, textResponses: null },
      adminSeesScores: true,
    })
  })

  await run('ⓓ 한 번만 쓰인 태그는 나가지 않는다', async () => {
    scenario = { status: 'COMPLETED', minRaters: 3, feedbacks: THRESHOLD_MET, released: true }
    const json = JSON.stringify((await page('emp-target')).results ?? null)
    assert.deepEqual(
      { 단독태그: json.includes('단독태그'), 리더단독태그: json.includes('리더단독태그'), 공유태그: json.includes('공유태그') },
      { 단독태그: false, 리더단독태그: false, 공유태그: true }
    )
  })

  await run('ⓔ showLeaderScore 가 false 면 groupedResponses 에도 리더 점수가 없다', async () => {
    scenario = { status: 'COMPLETED', minRaters: 3, feedbacks: THRESHOLD_MET, released: true }
    const leaderRatings = (results: PageResults | undefined) =>
      (results?.groupedResponses ?? [])
        .flatMap((group) => group.answers)
        .filter((answer) => answer.feedbackId === 'fb-leader')
        .map((answer) => answer.ratingValue ?? null)
        .filter((value) => value !== null)
    const target = (await page('emp-target')).results
    const leader = (await page('emp-leader')).results
    assert.deepEqual(
      {
        targetShowLeaderScore: target?.presentationSettings.showLeaderScore,
        targetLeaderRatings: leaderRatings(target),
        // 대조: 팀장용 결과지(showLeaderScore true)에는 남는다.
        leaderShowLeaderScore: leader?.presentationSettings.showLeaderScore,
        leaderLeaderRatings: leaderRatings(leader),
      },
      { targetShowLeaderScore: false, targetLeaderRatings: [], leaderShowLeaderScore: true, leaderLeaderRatings: [2] }
    )
  })

  await run('ⓕ 해석 민감도 경고 기준 = minRaters, 응답 수에서 SELF 제외', async () => {
    const SENSITIVITY = '응답 수가 적어 해석 민감도가 높을 수 있습니다.'
    const hasSensitivityWarning = async (next: Scenario) => {
      scenario = next
      return ((await page('emp-admin')).results?.warnings ?? []).includes(SENSITIVITY)
    }
    const observed = {
      // SELF 1 + 타인 4, minRaters 5: 타인 4 < 5 → 경고
      fourOthersWithSelfMin5: await hasSensitivityWarning({
        status: 'COMPLETED',
        minRaters: 5,
        feedbacks: [
          { id: 'fb-self', giverId: 'emp-target', relationship: 'SELF', rating: 5 },
          { id: 'fb-p1', giverId: 'emp-p1', relationship: 'PEER', rating: 4 },
          { id: 'fb-p2', giverId: 'emp-p2', relationship: 'PEER', rating: 4 },
          { id: 'fb-p3', giverId: 'emp-p3', relationship: 'PEER', rating: 4 },
          { id: 'fb-p4', giverId: 'emp-p4', relationship: 'PEER', rating: 4 },
        ],
      }),
      // 타인 2, minRaters 2: 2 < 2 아님 → 경고 없음
      twoOthersMin2: await hasSensitivityWarning({
        status: 'COMPLETED',
        minRaters: 2,
        feedbacks: [
          { id: 'fb-p1', giverId: 'emp-p1', relationship: 'PEER', rating: 4 },
          { id: 'fb-p2', giverId: 'emp-p2', relationship: 'PEER', rating: 4 },
        ],
      }),
    }
    assert.deepEqual(observed, { fourOthersWithSelfMin5: true, twoOthersMin2: false })
  })

  await run('ⓖ 공개 action 은 마감 전이거나 관리 권한이 없으면 거절된다', async () => {
    roundUpdates.length = 0
    auditActions.length = 0
    scenario = { status: 'IN_PROGRESS', minRaters: 3, feedbacks: THRESHOLD_MET, released: false }
    const adminBeforeClose = await releaseResults('emp-admin')
    scenario = { status: 'COMPLETED', minRaters: 3, feedbacks: THRESHOLD_MET, released: false }
    const leaderAfterClose = await releaseResults('emp-leader')
    const targetAfterClose = await releaseResults('emp-target')
    const rejectedWrites = { updates: roundUpdates.length, audits: auditActions.length }
    const adminAfterClose = await releaseResults('emp-admin')
    const written = roundUpdates[0]?.data.documentSettings as Record<string, unknown> | undefined
    assert.deepEqual(
      {
        adminBeforeClose,
        leaderAfterClose,
        targetAfterClose,
        rejectedWrites,
        adminAfterClose,
        updates: roundUpdates.length,
        statusUnchanged: roundUpdates[0] ? !('status' in roundUpdates[0].data) : null,
        releasedAtWritten: typeof written?.resultReleasedAt === 'string',
        keepsOtherSettings: written?.quarter,
        audits: auditActions,
      },
      {
        adminBeforeClose: 400,
        leaderAfterClose: 403,
        targetAfterClose: 403,
        rejectedWrites: { updates: 0, audits: 0 },
        adminAfterClose: 200,
        updates: 1,
        statusUnchanged: true,
        releasedAtWritten: true,
        keepsOtherSettings: 'Q1',
        audits: ['FEEDBACK_ROUND_RESULTS_RELEASED'],
      }
    )
  })

  await run('ⓗ 익명 라운드: 기준을 넘어도 관리자 외에는 평가자별 상세가 없다', async () => {
    scenario = { status: 'COMPLETED', minRaters: 3, feedbacks: THRESHOLD_MET, released: true }
    const reviewDetailCount = async (viewerId: string) =>
      (await page(viewerId)).results?.analysis?.reviewDetails.length ?? null
    assert.deepEqual(
      {
        target: await reviewDetailCount('emp-target'),
        leader: await reviewDetailCount('emp-leader'),
        // 대조: 관리자는 평가자별 상세를 본다.
        adminHasDetails: ((await reviewDetailCount('emp-admin')) ?? 0) > 0,
      },
      { target: 0, leader: 0, adminHasDetails: true }
    )
  })

  await run('ⓘ showLeaderScore 가 false 면 리포트의 관계별 평균에도 SUPERVISOR 가 없다', async () => {
    scenario = { status: 'COMPLETED', minRaters: 3, feedbacks: THRESHOLD_MET, released: true }
    const relationships = async (viewerId: string) =>
      ((await reportEntry(viewerId))?.relationshipAverages as Array<{ relationship: string }> | null | undefined)?.map(
        (item) => item.relationship
      ) ?? null
    assert.deepEqual(
      {
        // 구성원용 결과지(showLeaderScore false)
        targetHasSupervisor: (await relationships('emp-target'))?.includes('SUPERVISOR') ?? null,
        // 대조: 팀장용 결과지(showLeaderScore true)
        leaderHasSupervisor: (await relationships('emp-leader'))?.includes('SUPERVISOR') ?? null,
      },
      { targetHasSupervisor: false, leaderHasSupervisor: true }
    )
  })

  await run('ⓙ 360 리포트에 UPWARD 라운드가 나오지 않는다', async () => {
    scenario = { status: 'COMPLETED', minRaters: 3, feedbacks: THRESHOLD_MET, released: true }
    const roundTypes = async (viewerId: string) => (await reportAll(viewerId)).map((entry) => entry.roundType)
    assert.deepEqual(
      { admin: await roundTypes('emp-admin'), target: await roundTypes('emp-target'), leader: await roundTypes('emp-leader') },
      { admin: ['FULL_360'], target: ['FULL_360'], leader: ['FULL_360'] }
    )
  })

  await run('ⓚ 공개 → REOPEN → 다시 마감하면 공개 전 상태다(본인 · 리더는 못 본다)', async () => {
    scenario = { status: 'COMPLETED', minRaters: 3, feedbacks: THRESHOLD_MET, released: true }
    roundUpdates.length = 0
    auditActions.length = 0
    const beforeReopen = await sees('emp-target')
    const reopen = await statusAction('emp-admin', 'REOPEN')
    const reopenSettings = roundUpdates[0]?.data.documentSettings as Record<string, unknown> | undefined
    const close = await statusAction('emp-admin', 'CLOSE')
    assert.deepEqual(
      {
        beforeReopen,
        reopen,
        close,
        status: scenario.status,
        released: scenario.released,
        // 공개 표시만 지우고 다른 설정은 유지한다.
        reopenKeepsOtherSettings: reopenSettings?.quarter ?? null,
        page: { target: await sees('emp-target'), leader: await sees('emp-leader'), admin: await sees('emp-admin') },
        resultView: { target: await resultView('emp-target'), leader: await resultView('emp-leader') },
      },
      {
        beforeReopen: true,
        reopen: 200,
        close: 200,
        status: 'COMPLETED',
        released: false,
        reopenKeepsOtherSettings: 'Q1',
        page: { target: false, leader: false, admin: true },
        resultView: { target: 403, leader: 403 },
      }
    )
  })

  await run('결과 화면 데이터가 오류 없이 만들어졌고, 실제 Prisma 로 나간 호출이 없다', () => {
    const prismaPath = require.resolve('../src/lib/prisma')
    assert.deepEqual(
      {
        pageErrors,
        unstubbedCalls: [...new Set(unstubbedCalls)],
        prismaIsFake: (require.cache[prismaPath]?.exports as { prisma?: unknown } | undefined)?.prisma === fakePrisma,
      },
      { pageErrors: [], unstubbedCalls: [], prismaIsFake: true }
    )
  })

  console.log('Feedback 360 result exposure tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
