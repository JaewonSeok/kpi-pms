import './register-path-aliases'
import assert from 'node:assert/strict'
import Module, { createRequire } from 'node:module'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

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

// 아직 없는 모듈(수정 전)도 테스트가 돌 수 있게 경로 문자열로 불러온다. 없으면 null.
const requireFromTest = createRequire(__filename)
function loadOptional<T>(request: string): T | null {
  try {
    return requireFromTest(request) as T
  } catch {
    return null
  }
}

// ---- fixture -------------------------------------------------------------------------
const ORG = 'org-1'
const department = { id: 'dept-1', deptName: '영업팀', orgId: ORG }
const EMPLOYEES: Record<string, Record<string, unknown>> = {
  'emp-admin': { empName: '관리자', role: 'ROLE_ADMIN', position: 'MEMBER', jobTitle: null },
  'emp-member': { empName: '팀원', role: 'ROLE_MEMBER', position: 'MEMBER', jobTitle: null, teamLeaderId: 'emp-leader' },
  'emp-member2': { empName: '팀원2', role: 'ROLE_MEMBER', position: 'MEMBER', jobTitle: null, teamLeaderId: 'emp-leader' },
  'emp-member3': { empName: '팀원3', role: 'ROLE_MEMBER', position: 'MEMBER', jobTitle: null, teamLeaderId: 'emp-leader' },
  'emp-leader': { empName: '팀장', role: 'ROLE_TEAM_LEADER', position: 'TEAM_LEADER', jobTitle: '팀장' },
  'emp-ceo': { empName: '대표', role: 'ROLE_CEO', position: 'CEO', jobTitle: '대표이사' },
  'emp-peer': { empName: '동료', role: 'ROLE_MEMBER', position: 'MEMBER', jobTitle: null },
}
function employee(id: string) {
  const base = EMPLOYEES[id]
  if (!base) return null
  return {
    id,
    empId: id,
    gwsEmail: `${id}@example.com`,
    teamName: '영업팀',
    teamLeaderId: null,
    sectionChiefId: null,
    divisionHeadId: null,
    status: 'ACTIVE',
    deptId: 'dept-1',
    department,
    ...base,
  }
}

type NominationRow = { id: string; roundId: string; targetId: string; reviewerId: string; relationship: string; status: string }
type Scenario = { status: string; released: boolean; minRaters: number; nominations: NominationRow[] }
let scenario: Scenario = { status: 'RATER_SELECTION', released: false, minRaters: 3, nominations: [] }

function nominationsFor(targetId: string, statuses: string[]) {
  return statuses.map((status, index) => ({
    id: `nom-${targetId}-${index}`,
    roundId: 'round-1',
    targetId,
    reviewerId: `emp-reviewer-${targetId}-${index}`,
    relationship: 'PEER',
    status,
  }))
}

function roundRow() {
  return {
    id: 'round-1',
    roundName: '2026년 4분기 360 다면평가',
    roundType: 'FULL_360',
    status: scenario.status,
    isAnonymous: true,
    minRaters: scenario.minRaters,
    maxRaters: 8,
    selectionSettings: null,
    documentSettings: {
      quarter: 'Q4',
      ...(scenario.released ? { resultReleasedAt: '2026-12-20T00:00:00.000Z', resultReleasedById: 'emp-admin' } : {}),
    },
    onboardingReviewGeneration: null,
    evalCycle: { orgId: ORG },
    nominations: scenario.nominations,
    feedbacks: [{ id: 'fb-1' }],
  }
}

// 스텁하지 않은 모델 · 메서드에 접근하면 기록하고 즉시 던진다. 실제 Prisma 로는 나가지 않는다.
const unstubbedCalls: string[] = []
const writes: Array<{ call: string; data?: unknown }> = []
const transactionOptions: unknown[] = []
function guardedDb(models: Record<string, Record<string, unknown>>): Record<string, unknown> {
  return new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => {
      if (typeof key !== 'string' || key === 'then') return undefined
      if (key === '$transaction') {
        return async (fn: ((tx: unknown) => unknown) | unknown[], options?: unknown) => {
          transactionOptions.push(options ?? null)
          return Array.isArray(fn) ? Promise.all(fn) : fn(fakeDb)
        }
      }
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
// upsert 는 create 에 새 행 값을 담는다.
const record = (call: string) => async (args?: { data?: unknown; create?: unknown }) => {
  writes.push({ call, data: args?.data ?? args?.create })
  if (call === 'multiFeedbackRound.update') {
    const data = (args?.data ?? {}) as Record<string, unknown>
    if (typeof data.status === 'string') scenario.status = data.status
    if ('documentSettings' in data) {
      scenario.released = typeof (data.documentSettings as Record<string, unknown> | null)?.resultReleasedAt === 'string'
    }
  }
  return { id: 'written', count: 1 }
}
const fakeDb: Record<string, unknown> = guardedDb({
  employee: {
    findUnique: async (args: { where: { id: string } }) => employee(args.where.id),
    count: async (args: { where?: { id?: { in?: string[] } } }) => args?.where?.id?.in?.length ?? 0,
    findMany: async () => [],
  },
  department: { findMany: async () => [{ id: 'dept-1' }] },
  multiFeedbackRound: {
    findUnique: async () => ({
      ...roundRow(),
      feedbacks: [{ id: 'fb-1' }],
    }),
    update: record('multiFeedbackRound.update'),
  },
  feedbackNomination: {
    // 지명 워크플로(제출 · 승인 · 반려)는 대상 한 명의 지명만 읽는다.
    findMany: async (args?: { where?: { targetId?: string } }) =>
      args?.where?.targetId
        ? scenario.nominations.filter((nomination) => nomination.targetId === args.where!.targetId)
        : scenario.nominations,
    deleteMany: record('feedbackNomination.deleteMany'),
    createMany: record('feedbackNomination.createMany'),
    updateMany: record('feedbackNomination.updateMany'),
  },
  multiFeedback: {
    upsert: record('multiFeedback.upsert'),
    createMany: record('multiFeedback.createMany'),
    count: async () => 0,
  },
  auditLog: { create: record('auditLog.create') },
  feedbackAdminGroupMember: { findMany: async () => [] },
  feedbackRoundCollaborator: { findUnique: async () => null },
})

let currentSession: { user: { id: string; role: string; name: string; email: string } } | null = null
const sessionFor = (id: string) => ({
  user: { id, role: String(EMPLOYEES[id].role), name: String(EMPLOYEES[id].empName), email: `${id}@example.com` },
})
const auditActions: string[] = []
stubModule('next-auth', { getServerSession: async () => currentSession })
stubModule('../src/lib/auth', { authOptions: {} })
stubModule('../src/lib/audit', {
  createAuditLog: async (entry: { action: string }) => {
    auditActions.push(entry.action)
  },
  getClientInfo: () => ({}),
  resolveAuditActor: () => ({ userId: currentSession?.user.id }),
})
stubModule('../src/lib/prisma', { prisma: fakeDb })

type RouteModule = { POST: (request: Request, context: { params: Promise<{ id: string }> }) => Promise<Response> }
type Actions = Record<'bulkPublish' | 'close' | 'release' | 'unrelease', { enabled: boolean; reason?: string | null }>
type OperationsLib = {
  buildFeedback360TargetProgress: (params: {
    minRaters: number
    nominations: Array<{ targetId: string; status: string }>
    targets: Array<{ id: string; name: string; department: string }>
  }) => {
    rows: Array<{ targetId: string; draft: number; submitted: number; approved: number; meetsMinRaters: boolean; published: boolean }>
    unnominated: Array<{ id: string }>
  }
  resolveFeedback360RoundActions: (params: {
    round: { roundType: string; status: string; isOnboarding: boolean; released: boolean }
    canManageAllRounds: boolean
    canManageRound: boolean
    publishableTargetCount: number
  }) => Actions
}

async function main() {
  const nominationsRoute = (await import('../src/app/api/feedback/rounds/[id]/nominations/route')) as unknown as RouteModule
  const statusRoute = (await import('../src/app/api/feedback/rounds/[id]/status/route')) as unknown as RouteModule
  const resultViewRoute = (await import('../src/app/api/feedback/rounds/[id]/result-view/route')) as unknown as RouteModule
  const bulkPublishRoute = loadOptional<RouteModule>('../src/app/api/feedback/rounds/[id]/bulk-publish/route')
  const operations = loadOptional<OperationsLib>('../src/lib/feedback-360-round-operations')
  const panelModule = loadOptional<{ Feedback360RoundOperationsPanel: React.FC<Record<string, unknown>> }>(
    '../src/components/evaluation/feedback360/Feedback360RoundOperationsPanel'
  )

  const post = async (route: RouteModule | null, viewerId: string, path: string, body: Record<string, unknown>) => {
    if (!route) return { status: 'NO_ROUTE' as const, json: null as null | Record<string, unknown> }
    currentSession = sessionFor(viewerId)
    const response = await route.POST(
      new Request(`http://localhost/api/feedback/rounds/round-1/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ id: 'round-1' }) }
    )
    return { status: response.status, json: (await response.json().catch(() => null)) as null | Record<string, unknown> }
  }

  await run('ⓐ 리더 · 대표를 대상으로 한 지명 초안은 거절되고, 팀원은 된다', async () => {
    scenario = { status: 'RATER_SELECTION', released: false, minRaters: 3, nominations: [] }
    const draft = (targetId: string) =>
      post(nominationsRoute, 'emp-admin', 'nominations', {
        targetId,
        reviewers: [{ employeeId: 'emp-peer', name: '동료', relationship: 'PEER' }],
      })
    const leader = await draft('emp-leader')
    const ceo = await draft('emp-ceo')
    const member = await draft('emp-member')
    const messageOf = (result: { json: null | Record<string, unknown> }) =>
      (result.json?.error as { message?: string } | undefined)?.message ?? null
    assert.deepEqual(
      { leader: [leader.status, messageOf(leader)], ceo: [ceo.status, messageOf(ceo)], member: member.status },
      {
        leader: [400, '리더와 대표는 360 대상이 아닙니다(리더십 평가 대상)'],
        ceo: [400, '리더와 대표는 360 대상이 아닙니다(리더십 평가 대상)'],
        member: 200,
      }
    )
  })

  await run('ⓑ 일괄 발행은 기준을 충족한 대상만 발행하고 건너뛴 대상을 돌려준다. 관리 권한이 없으면 거절된다', async () => {
    scenario = {
      status: 'RATER_SELECTION',
      released: false,
      minRaters: 3,
      nominations: [
        ...nominationsFor('emp-member', ['APPROVED', 'APPROVED', 'APPROVED']),
        ...nominationsFor('emp-member2', ['APPROVED', 'APPROVED']),
        ...nominationsFor('emp-member3', ['SUBMITTED', 'SUBMITTED', 'SUBMITTED']),
      ],
    }
    writes.length = 0
    auditActions.length = 0
    transactionOptions.length = 0
    const forbidden = await post(bulkPublishRoute, 'emp-member', 'bulk-publish', {})
    const writesAfterForbidden = writes.length
    const published = await post(bulkPublishRoute, 'emp-admin', 'bulk-publish', {})
    const data = (published.json?.data ?? {}) as {
      publishedCount?: number
      skippedBelowMinRaters?: Array<{ targetId: string }>
      notApprovedTargets?: Array<{ targetId: string }>
    }
    // 응답 요청 행은 한 건씩(upsert) 만들 수도, 묶어서(createMany) 만들 수도 있다. 둘 다 센다.
    const upsertedReceivers = writes
      .filter((write) => write.call === 'multiFeedback.upsert' || write.call === 'multiFeedback.createMany')
      .flatMap((write) => (Array.isArray(write.data) ? write.data : [write.data]))
      .map((row) => (row as { receiverId?: string } | undefined)?.receiverId)
    assert.deepEqual(
      {
        forbidden: forbidden.status,
        writesAfterForbidden,
        status: published.status,
        publishedCount: data.publishedCount ?? null,
        skipped: (data.skippedBelowMinRaters ?? []).map((item) => item.targetId),
        notApproved: (data.notApprovedTargets ?? []).map((item) => item.targetId),
        upsertedReceivers: [...new Set(upsertedReceivers)],
        roundStatus: scenario.status,
        transactionHasTimeout: transactionOptions.some(
          (options) => typeof (options as { timeout?: unknown } | null)?.timeout === 'number'
        ),
        audits: auditActions.length + writes.filter((write) => write.call === 'auditLog.create').length,
      },
      {
        forbidden: 403,
        writesAfterForbidden: 0,
        status: 200,
        publishedCount: 1,
        skipped: ['emp-member2'],
        notApproved: ['emp-member3'],
        upsertedReceivers: ['emp-member'],
        roundStatus: 'IN_PROGRESS',
        transactionHasTimeout: true,
        audits: 1,
      }
    )
  })

  await run('ⓒ 공개 취소 후에는 비관리자가 결과를 못 본다', async () => {
    scenario = { status: 'COMPLETED', released: true, minRaters: 3, nominations: [] }
    const before = await post(resultViewRoute, 'emp-member', 'result-view', { targetId: 'emp-member' })
    auditActions.length = 0
    const unrelease = await post(statusRoute, 'emp-admin', 'status', { action: 'UNRELEASE_RESULTS' })
    const forbiddenUnrelease = await post(statusRoute, 'emp-member', 'status', { action: 'UNRELEASE_RESULTS' })
    const after = await post(resultViewRoute, 'emp-member', 'result-view', { targetId: 'emp-member' })
    assert.deepEqual(
      {
        before: before.status,
        unrelease: unrelease.status,
        forbiddenUnrelease: forbiddenUnrelease.status,
        released: scenario.released,
        after: after.status,
        audits: auditActions.filter((action) => action === 'FEEDBACK_ROUND_RESULTS_UNRELEASED').length,
      },
      { before: 200, unrelease: 200, forbiddenUnrelease: 403, released: false, after: 403, audits: 1 }
    )
  })

  await run("ⓓ 대상별 현황의 수치 = 지명 데이터, '미지명' = 360 대상 − 지명이 있는 사람", () => {
    assert.ok(operations, 'feedback-360-round-operations 모듈이 없다')
    const progress = operations!.buildFeedback360TargetProgress({
      minRaters: 3,
      nominations: [
        ...nominationsFor('emp-member', ['DRAFT', 'SUBMITTED', 'APPROVED', 'PUBLISHED']),
        ...nominationsFor('emp-member2', ['APPROVED', 'APPROVED', 'APPROVED']),
      ],
      targets: [
        { id: 'emp-member', name: '팀원', department: '영업팀' },
        { id: 'emp-member2', name: '팀원2', department: '영업팀' },
        { id: 'emp-member3', name: '팀원3', department: '영업팀' },
      ],
    })
    assert.deepEqual(
      {
        rows: progress.rows.map((row) => [row.targetId, row.draft, row.submitted, row.approved, row.meetsMinRaters, row.published]),
        unnominated: progress.unnominated.map((item) => item.id),
      },
      {
        // 승인 수는 승인 + 발행(발행은 승인된 지명이다)
        rows: [
          ['emp-member', 1, 1, 2, false, true],
          ['emp-member2', 0, 0, 3, true, false],
        ],
        unnominated: ['emp-member3'],
      }
    )
  })

  await run('ⓔ 버튼은 상태에 맞을 때만 켜진다(진행 중이 아니면 마감 불가, 마감 전이면 공개 불가 등)', () => {
    assert.ok(operations, 'feedback-360-round-operations 모듈이 없다')
    assert.ok(panelModule, 'Feedback360RoundOperationsPanel 이 없다')
    const enabledOf = (status: string, released: boolean, publishable = 1, canManageAllRounds = true) => {
      const actions = operations!.resolveFeedback360RoundActions({
        round: { roundType: 'FULL_360', status, isOnboarding: false, released },
        canManageAllRounds,
        canManageRound: canManageAllRounds,
        publishableTargetCount: publishable,
      })
      return Object.fromEntries(Object.entries(actions).map(([key, value]) => [key, value.enabled]))
    }
    const actionsInProgress = operations!.resolveFeedback360RoundActions({
      round: { roundType: 'FULL_360', status: 'IN_PROGRESS', isOnboarding: false, released: false },
      canManageAllRounds: true,
      canManageRound: true,
      publishableTargetCount: 0,
    })
    const html = renderToStaticMarkup(
      React.createElement(panelModule!.Feedback360RoundOperationsPanel, {
        roundName: '2026년 4분기 360 다면평가',
        actions: actionsInProgress,
        progress: { rows: [], unnominated: [] },
        busy: false,
        onAction: () => undefined,
      })
    )
    const buttonTag = (action: string) => html.match(new RegExp(`<button[^>]*data-round-action="${action}"[^>]*>`))?.[0] ?? ''
    assert.deepEqual(
      {
        selection: enabledOf('RATER_SELECTION', false),
        inProgress: enabledOf('IN_PROGRESS', false, 0),
        completed: enabledOf('COMPLETED', false),
        released: enabledOf('COMPLETED', true),
        cancelled: enabledOf('CANCELLED', false),
        notAllManager: enabledOf('RATER_SELECTION', false, 1, false).bulkPublish,
        // 패널: 마감만 켜지고, 막힌 버튼에는 사유가 보인다.
        panelClose: /\sdisabled=""/.test(buttonTag('close')),
        panelRelease: /\sdisabled=""/.test(buttonTag('release')),
        panelShowsReason: Boolean(actionsInProgress.release.reason && html.includes(actionsInProgress.release.reason)),
      },
      {
        selection: { bulkPublish: true, close: false, release: false, unrelease: false },
        inProgress: { bulkPublish: false, close: true, release: false, unrelease: false },
        completed: { bulkPublish: false, close: false, release: true, unrelease: false },
        released: { bulkPublish: false, close: false, release: false, unrelease: true },
        cancelled: { bulkPublish: false, close: false, release: false, unrelease: false },
        notAllManager: false,
        panelClose: false,
        panelRelease: true,
        panelShowsReason: true,
      }
    )
  })

  const workflowRoute = (await import('../src/app/api/feedback/rounds/[id]/workflow/route')) as unknown as RouteModule

  await run('ⓕ 취소 · 마감 라운드에서 지명 제출 · 승인 · 반려는 400 이고 아무것도 쓰지 않는다', async () => {
    const observed: Record<string, { status: number | string; writes: number }> = {}
    for (const status of ['CANCELLED', 'COMPLETED', 'CLOSED']) {
      for (const action of ['submit', 'approve', 'reject']) {
        scenario = {
          status,
          released: false,
          minRaters: 3,
          nominations: nominationsFor('emp-member', [action === 'submit' ? 'DRAFT' : 'SUBMITTED']),
        }
        writes.length = 0
        const result = await post(workflowRoute, 'emp-admin', 'workflow', { action, targetId: 'emp-member', note: '확인' })
        observed[`${status}:${action}`] = { status: result.status, writes: writes.length }
      }
    }
    assert.deepEqual(
      observed,
      Object.fromEntries(Object.keys(observed).map((key) => [key, { status: 400, writes: 0 }]))
    )
  })

  await run('ⓖ roundHealth 와 경고에 취소 라운드가 나오지 않는다', async () => {
    const server = (await import('../src/server/feedback-360')) as unknown as Record<string, unknown>
    const buildRoundHealth = server.buildFeedback360RoundHealth as
      | undefined
      | ((rounds: unknown[]) => Array<{ roundId: string; roundName: string; responseRate: number; qualityRiskCount: number }>)
    const buildAlerts = server.buildFeedback360RoundHealthAlerts as
      | undefined
      | ((roundHealth: unknown[]) => string[])
    assert.equal(typeof buildRoundHealth, 'function', 'buildFeedback360RoundHealth 를 불러올 수 없다')
    assert.equal(typeof buildAlerts, 'function', 'buildFeedback360RoundHealthAlerts 를 불러올 수 없다')
    // 둘 다 응답률 0%(경고 대상). 취소 라운드는 판정 · 경고 어디에도 나오면 안 된다.
    const pendingFeedback = (id: string) => ({ id, receiverId: 'emp-member', relationship: 'PEER', status: 'PENDING', responses: [] })
    const rounds = [
      { id: 'round-live', roundName: 'LIVE_ROUND', status: 'IN_PROGRESS', minRaters: 3, feedbacks: [pendingFeedback('f-1')] },
      { id: 'round-cancelled', roundName: 'CANCELLED_ROUND', status: 'CANCELLED', minRaters: 3, feedbacks: [pendingFeedback('f-2')] },
    ]
    const roundHealth = buildRoundHealth!(rounds)
    const alerts = buildAlerts!(roundHealth)
    assert.deepEqual(
      {
        roundIds: roundHealth.map((item) => item.roundId),
        cancelledInAlerts: alerts.some((alert) => alert.includes('CANCELLED_ROUND')),
        liveInAlerts: alerts.some((alert) => alert.includes('LIVE_ROUND')),
      },
      { roundIds: ['round-live'], cancelledInAlerts: false, liveInAlerts: true }
    )
  })

  await run('ⓗ 확인 창 문구에 라운드 이름이 있고, 고른 라운드와 패널 라운드가 다르면 버튼 넷이 막힌다', () => {
    assert.ok(operations, 'feedback-360-round-operations 모듈이 없다')
    assert.ok(panelModule, 'Feedback360RoundOperationsPanel 이 없다')
    const confirmMessage = (panelModule as unknown as Record<string, unknown>).buildFeedback360RoundActionConfirmMessage as
      | undefined
      | ((roundName: string, action: string) => string)
    assert.equal(typeof confirmMessage, 'function', 'buildFeedback360RoundActionConfirmMessage 를 불러올 수 없다')
    const allEnabled = operations!.resolveFeedback360RoundActions({
      round: { roundType: 'FULL_360', status: 'IN_PROGRESS', isOnboarding: false, released: true },
      canManageAllRounds: true,
      canManageRound: true,
      publishableTargetCount: 1,
    })
    const html = renderToStaticMarkup(
      React.createElement(panelModule!.Feedback360RoundOperationsPanel, {
        roundId: 'round-1',
        roundName: '2026년 4분기 360 다면평가',
        selectedRoundId: 'round-other',
        actions: allEnabled,
        progress: { rows: [], unnominated: [] },
        busy: false,
        onAction: () => undefined,
      })
    )
    const disabledOf = (action: string) =>
      /\sdisabled=""/.test(html.match(new RegExp(`<button[^>]*data-round-action="${action}"[^>]*>`))?.[0] ?? '')
    assert.deepEqual(
      {
        confirmHasRoundName: ['bulkPublish', 'close', 'release', 'unrelease'].every((action) =>
          confirmMessage!('2026년 4분기 360 다면평가', action).includes('2026년 4분기 360 다면평가')
        ),
        disabled: ['bulkPublish', 'close', 'release', 'unrelease'].map(disabledOf),
        mismatchNotice: html.includes('2026년 4분기 360 다면평가 라운드 기준입니다. 새로 불러오면 고른 라운드로 바뀝니다.'),
      },
      { confirmHasRoundName: true, disabled: [true, true, true, true], mismatchNotice: true }
    )
  })

  await run('ⓘ 일괄 발행의 트랜잭션 안 쓰기 호출 수가 대상 3명일 때와 30명일 때 같다', async () => {
    const writeCallsFor = async (targetCount: number) => {
      scenario = {
        status: 'RATER_SELECTION',
        released: false,
        minRaters: 3,
        nominations: Array.from({ length: targetCount }, (_, index) =>
          nominationsFor(`emp-bulk-${index}`, ['APPROVED', 'APPROVED', 'APPROVED'])
        ).flat(),
      }
      writes.length = 0
      const result = await post(bulkPublishRoute, 'emp-admin', 'bulk-publish', {})
      return { status: result.status, writeCalls: writes.length }
    }
    const three = await writeCallsFor(3)
    const thirty = await writeCallsFor(30)
    assert.deepEqual(
      { status: [three.status, thirty.status], sameWriteCalls: three.writeCalls === thirty.writeCalls, three, thirty },
      { status: [200, 200], sameWriteCalls: true, three, thirty: { ...thirty, writeCalls: three.writeCalls } }
    )
  })

  await run('실제 Prisma 로 나간 호출이 없다(스텁하지 않은 DB 호출 0건)', () => {
    assert.deepEqual([...new Set(unstubbedCalls)], [])
  })

  console.log('Feedback 360 round operations tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
