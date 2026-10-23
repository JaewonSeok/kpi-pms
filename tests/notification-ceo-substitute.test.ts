import './register-path-aliases'
import assert from 'node:assert/strict'
import Module from 'node:module'
import { Prisma } from '@prisma/client'

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

// ---- 사람 ------------------------------------------------------------------------------
const CEO = 'emp-ceo'
const HR = 'emp-hr'
const MEMBER = 'emp-member'
const DIV = 'emp-div'
const PEOPLE: Record<string, { empName: string; role: string; gwsEmail: string }> = {
  [CEO]: { empName: '대표', role: 'ROLE_CEO', gwsEmail: 'ceo@example.com' },
  [HR]: { empName: '인사담당', role: 'ROLE_ADMIN', gwsEmail: 'hr@example.com' },
  [MEMBER]: { empName: '팀원', role: 'ROLE_MEMBER', gwsEmail: 'member@example.com' },
  [DIV]: { empName: '본부장', role: 'ROLE_DIV_HEAD', gwsEmail: 'div@example.com' },
}
const SUBSTITUTE_PREFIX = '[대표 대신] '

// ---- 저장소(잡 · 알림 행) --------------------------------------------------------------
type Job = { recipientId: string; type: string; channel: string; title: string; idempotencyKey: string }
type Row = { recipientId: string; type: string; title: string }
const state = {
  jobs: [] as Job[],
  rows: [] as Row[],
  keys: new Set<string>(),
  ceoLookupFails: false,
  unstubbed: [] as string[],
}
function resetStore() {
  state.jobs = []
  state.rows = []
  state.keys = new Set()
}

const TYPES = [
  'GOAL_REMINDER',
  'CHECKPOINT_REMINDER',
  'EVALUATION_REMINDER',
  'CALIBRATION_REMINDER',
  'RESULT_CONFIRMATION_REMINDER',
  'MEETING_REMINDER',
  'SYSTEM',
]
const templateCode = (type: string, channel: string) =>
  `${type.toLowerCase().replace(/_/g, '-')}-${channel.toLowerCase().replace(/_/g, '-')}`
const TEMPLATES = TYPES.flatMap((type) =>
  ['IN_APP', 'EMAIL'].map((channel) => ({
    code: templateCode(type, channel),
    name: type,
    type,
    channel,
    subjectTemplate: `${type} 제목`,
    bodyTemplate: '{{employeeName}}님 본문',
    defaultLink: '/dashboard',
    isActive: true,
    isDigestCompatible: false,
  }))
)

// 사이클 날짜는 리마인더 창(지금 ~ 3일 뒤) 안에 둔다.
const IN_WINDOW = new Date(Date.now() + 24 * 60 * 60 * 1000)

function employeeFindMany(args?: { where?: Record<string, unknown> }) {
  const where = args?.where ?? {}
  if (where.role === 'ROLE_CEO') {
    if (state.ceoLookupFails) throw new Error('CEO_LOOKUP_FAILED')
    return Object.entries(PEOPLE)
      .filter(([, person]) => person.role === 'ROLE_CEO')
      .map(([id]) => ({ id }))
  }
  const emailFilter = where.gwsEmail as { in?: string[] } | undefined
  if (emailFilter?.in) {
    const wanted = new Set(emailFilter.in.map((email) => email.toLowerCase()))
    return Object.entries(PEOPLE)
      .filter(([, person]) => wanted.has(person.gwsEmail.toLowerCase()))
      .map(([id]) => ({ id }))
  }
  return Object.entries(PEOPLE).map(([id, person]) => ({ id, empName: person.empName, role: person.role }))
}

function makeDb(extra: Record<string, Record<string, unknown>> = {}) {
  const models: Record<string, Record<string, unknown>> = {
    employee: {
      findMany: async (args?: { where?: Record<string, unknown> }) => employeeFindMany(args),
      findUnique: async (args: { where: { id: string } }) => {
        const person = PEOPLE[args.where.id]
        return person ? { id: args.where.id, empName: person.empName, gwsEmail: person.gwsEmail, teamLeaderId: null } : null
      },
    },
    notificationTemplate: { upsert: async () => ({}), findMany: async () => TEMPLATES },
    notificationPreference: {
      upsert: async (args: { where: { employeeId: string } }) => ({
        employeeId: args.where.employeeId,
        inAppEnabled: true,
        emailEnabled: true,
        digestEnabled: false,
        quietHoursEnabled: false,
        timezone: 'Asia/Seoul',
        mutedTypes: [],
      }),
    },
    notificationJob: {
      create: async (args: { data: Job }) => {
        if (state.keys.has(args.data.idempotencyKey)) {
          throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed on idempotencyKey', {
            code: 'P2002',
            clientVersion: 'test',
          })
        }
        state.keys.add(args.data.idempotencyKey)
        state.jobs.push({
          recipientId: args.data.recipientId,
          type: args.data.type,
          channel: args.data.channel,
          title: args.data.title,
          idempotencyKey: args.data.idempotencyKey,
        })
        return { id: `job-${state.jobs.length}` }
      },
      findMany: async () => [],
    },
    notification: {
      create: async (args: { data: Row }) => {
        state.rows.push({ recipientId: args.data.recipientId, type: args.data.type, title: args.data.title })
        return { id: `row-${state.rows.length}` }
      },
    },
    evalCycle: {
      findMany: async () => [
        {
          id: 'cycle-1',
          cycleName: '2026 평가',
          status: 'FINAL_EVAL',
          kpiSetupEnd: IN_WINDOW,
          resultOpenStart: IN_WINDOW,
          ceoAdjustStart: IN_WINDOW,
        },
      ],
    },
    checkIn: {
      // 미팅 리마인더: 대표가 owner, 팀원이 manager 인 체크인 하나
      findMany: async () => [
        {
          id: 'checkin-1',
          checkInType: 'WEEKLY',
          scheduledDate: new Date(Date.now() + 60 * 60 * 1000),
          owner: { id: CEO, empName: '대표' },
          manager: { id: MEMBER, empName: '팀원' },
        },
      ],
    },
    evaluation: {
      findMany: async (args: { distinct?: string[] }) =>
        args.distinct
          ? // 결과 확인 리마인더: 피평가자(대표 · 팀원)
            [{ targetId: CEO }, { targetId: MEMBER }]
          : // 평가 리마인더: 대표가 다른 사람의 평가자, 인사담당도 평가자
            [
              { id: 'e1', evaluatorId: CEO, evalCycleId: 'cycle-1', evalStage: 'CEO_ADJUST', status: 'PENDING', evaluator: { id: CEO, empName: '대표' }, evalCycle: { id: 'cycle-1', status: 'FINAL_EVAL' } },
              { id: 'e2', evaluatorId: HR, evalCycleId: 'cycle-1', evalStage: 'FIRST', status: 'PENDING', evaluator: { id: HR, empName: '인사담당' }, evalCycle: { id: 'cycle-1', status: 'FINAL_EVAL' } },
            ],
    },
    personalKpi: {
      findMany: async () => [
        { id: 'kpi-ceo', employeeId: CEO, employee: { id: CEO, empName: '대표' } },
        { id: 'kpi-member', employeeId: MEMBER, employee: { id: MEMBER, empName: '팀원' } },
      ],
    },
    ...extra,
  }
  const db: Record<string, unknown> = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => {
      if (typeof key !== 'string' || key === 'then') return undefined
      if (key === '$transaction') {
        return async (fn: ((tx: unknown) => unknown) | unknown[]) => (Array.isArray(fn) ? Promise.all(fn) : fn(db))
      }
      const methods = models[key] ?? {}
      return new Proxy({} as Record<string, unknown>, {
        get: (_inner, method) => {
          if (typeof method !== 'string' || method === 'then') return undefined
          if (methods[method]) return methods[method]
          return () => {
            state.unstubbed.push(`${key}.${method}`)
            throw new Error(`UNSTUBBED_DB_CALL:${key}.${method}`)
          }
        },
      })
    },
  })
  return db
}

// 라우트 실행용: prisma 모듈 · 세션 · 접근 판정 · 배정 · 대행 위험 확인을 스텁한다.
let routeDb: Record<string, unknown> = makeDb()
const prismaProxy = new Proxy({} as Record<string, unknown>, { get: (_target, key) => routeDb[key as string] })
let sessionUser = { id: HR, role: 'ROLE_ADMIN', name: '인사담당', email: 'hr@example.com' }
stubModule('next-auth', { getServerSession: async () => ({ user: sessionUser }) })
stubModule('../src/lib/auth', { authOptions: {} })
stubModule('../src/lib/audit', { createAuditLog: async () => undefined, getClientInfo: () => ({}), resolveAuditActor: () => ({ userId: sessionUser.id }) })
stubModule('../src/lib/prisma', { prisma: prismaProxy })
stubModule('../src/server/checkin-access', {
  canAccessCheckin: async () => true,
  canOperateCheckinRole: () => true,
  CHECKIN_OPERATOR_ROLES: [],
})
stubModule('../src/server/impersonation', {
  validateImpersonationRiskRequest: async () => null,
  logImpersonationRiskExecution: async () => undefined,
})
// 평가 단계 체인: 본부장(FINAL) 다음은 대표(CEO_ADJUST)다. 반려의 이전 단계는 FINAL 이다.
let nextStageEvaluatorId = CEO
stubModule('../src/server/evaluation-performance-assignments', {
  getEvaluationStageChain: async () => [
    { stage: 'SELF', evaluatorId: MEMBER, stageLabel: '자기평가' },
    { stage: 'FINAL', evaluatorId: DIV, stageLabel: '본부장 평가' },
  ],
  resolveEvaluationStageAssignee: async () => nextStageEvaluatorId,
  getPreviousActiveEvaluationStage: async () => 'FINAL',
})

const jsonRequest = (url: string, method: string, body: unknown) =>
  new Request(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

async function main() {
  const service = await import('../src/lib/notification-service')
  const checkinCompleteRoute = await import('../src/app/api/checkin/[id]/complete/route')
  const checkinRoute = await import('../src/app/api/checkin/route')
  const reviewRoute = await import('../src/app/api/evaluation/[id]/review/route')
  const submitRoute = await import('../src/app/api/evaluation/[id]/submit/route')

  const setSubstitutes = (value: string | undefined) => {
    if (value === undefined) delete process.env.CEO_SUBSTITUTE_EMAILS
    else process.env.CEO_SUBSTITUTE_EMAILS = value
  }

  // 6개 경로(enqueueLifecycleReminders) 한 번 실행
  const runLifecycle = async () => {
    resetStore()
    let error: string | null = null
    try {
      await service.enqueueLifecycleReminders(makeDb() as never)
    } catch (caught) {
      error = caught instanceof Error ? caught.message : String(caught)
    }
    return { jobs: [...state.jobs], error }
  }

  // 직접 생성 5곳: 체크인 완료(다음 일정 · 낮은 에너지), 체크인 예약, 평가 반려, 다음 단계 배정
  const runDirectSites = async (params: { ceoIs: 'owner' | 'manager' | 'none' }) => {
    resetStore()
    const ownerId = params.ceoIs === 'owner' ? CEO : MEMBER
    const managerId = params.ceoIs === 'manager' ? CEO : DIV
    routeDb = makeDb({
      checkIn: {
        findUnique: async () => ({ id: 'ci-1', ownerId, managerId, owner: { teamLeaderId: null, sectionChiefId: null, divisionHeadId: null } }),
        update: async () => ({ id: 'ci-1' }),
        findMany: async () => [{ id: 'ci-0', energyLevel: 1 }],
        create: async () => ({ id: 'ci-new', ownerId, managerId }),
      },
      evaluation: {
        findUnique: async (args: { where: { id?: string } }) =>
          args.where.id === 'eval-cur'
            ? { id: 'eval-cur', evalCycleId: 'cycle-1', targetId: MEMBER, evaluatorId: HR, evalStage: 'CEO_ADJUST', status: 'IN_PROGRESS', target: { empName: '팀원' } }
            : args.where.id === 'eval-submit'
              ? submitEvaluation()
              : args.where.id
                ? null
                : params.ceoIs === 'none'
                  ? { id: 'eval-prev', evaluatorId: DIV }
                  : // 반려의 이전 단계(FINAL)를 대표가 대행했다
                    { id: 'eval-prev', evaluatorId: CEO },
        update: async () => ({}),
        create: async () => ({ id: 'eval-next' }),
      },
      evaluationItem: { updateMany: async () => ({ count: 1 }), update: async () => ({}), findMany: async () => [{ personalKpiId: 'kpi-1' }] },
    })
    nextStageEvaluatorId = params.ceoIs === 'none' ? DIV : CEO
    const statuses: Record<string, number> = {}

    sessionUser = { id: HR, role: 'ROLE_ADMIN', name: '인사담당', email: 'hr@example.com' }
    statuses.complete = (
      await checkinCompleteRoute.PATCH(
        jsonRequest('http://localhost/api/checkin/ci-1/complete', 'PATCH', {
          actualDate: new Date().toISOString(),
          nextCheckInDate: new Date(Date.now() + 7 * 86400000).toISOString(),
          energyLevel: 1,
        }),
        { params: Promise.resolve({ id: 'ci-1' }) }
      )
    ).status
    statuses.schedule = (
      await checkinRoute.POST(
        jsonRequest('http://localhost/api/checkin', 'POST', {
          ownerId,
          checkInType: 'WEEKLY',
          scheduledDate: new Date(Date.now() + 86400000).toISOString(),
        })
      )
    ).status
    statuses.reject = (
      await reviewRoute.PATCH(
        jsonRequest('http://localhost/api/evaluation/eval-cur/review', 'PATCH', { rejectionReason: '보완이 필요한 부분이 있어 반려합니다.' }),
        { params: Promise.resolve({ id: 'eval-cur' }) }
      )
    ).status
    sessionUser = { id: DIV, role: 'ROLE_DIV_HEAD', name: '본부장', email: 'div@example.com' }
    statuses.submit = (
      await submitRoute.PATCH(
        jsonRequest('http://localhost/api/evaluation/eval-submit/submit', 'PATCH', {
          comment: '종합 의견입니다. '.repeat(6),
          strengthComment: '강점 요약을 충분히 적었습니다.',
          improvementComment: '보완 포인트를 충분히 적었습니다.',
          items: [{ personalKpiId: 'kpi-1', quantScore: 90 }],
        }),
        { params: Promise.resolve({ id: 'eval-submit' }) }
      )
    ).status
    return { rows: [...state.rows], statuses }
  }
  function submitEvaluation() {
    return {
      id: 'eval-submit',
      evalCycleId: 'cycle-1',
      targetId: MEMBER,
      evaluatorId: DIV,
      evalStage: 'FINAL',
      status: 'IN_PROGRESS',
      evalCycle: { id: 'cycle-1', evalYear: 2026, status: 'FINAL_EVAL' },
      items: [
        {
          id: 'item-1',
          evaluationId: 'eval-submit',
          personalKpiId: 'kpi-1',
          policyCategory: 'ORG_GOAL',
          targetAchievementLevel: null,
          basePolicyScore: null,
          personalKpi: { id: 'kpi-1', kpiName: 'KPI', goalType: 'GENERAL', kpiType: 'QUANTITATIVE', weight: 100, targetAmount: null, linkedOrgKpi: null, policyCategory: 'ORG_GOAL' },
        },
      ],
    }
  }

  const SUBSTITUTE_TYPES = ['CALIBRATION_REMINDER', 'EVALUATION_REMINDER']
  const OTHER_TYPES = ['GOAL_REMINDER', 'CHECKPOINT_REMINDER', 'RESULT_CONFIRMATION_REMINDER', 'MEETING_REMINDER']
  // 대표 앞으로 만들어졌거나 대표를 대신해 만들어진 잡: 키가 대표 id 로 시작한다.
  const ceoKeyed = (jobs: Job[]) => jobs.filter((job) => job.idempotencyKey.startsWith(`${CEO}:`))

  await run('ⓐ 6개 경로와 직접 생성 5곳 어디에서도 대표 앞 알림 행 · 잡이 생기지 않는다(전 채널)', async () => {
    setSubstitutes('hr@example.com')
    const lifecycle = await runLifecycle()
    const ceoMessage = await service.queueNotification(
      { recipientId: CEO, type: 'SYSTEM' as never, sourceType: 'Test', sourceId: 't-1', dedupeToken: 'direct', payload: {} },
      makeDb() as never
    ).then(() => state.jobs.filter((job) => job.recipientId === CEO).length)
    const owner = await runDirectSites({ ceoIs: 'owner' })
    const manager = await runDirectSites({ ceoIs: 'manager' })
    assert.deepEqual(
      {
        lifecycleError: lifecycle.error,
        lifecycleCeoJobs: lifecycle.jobs.filter((job) => job.recipientId === CEO).map((job) => `${job.type}:${job.channel}`),
        queueCeoJobs: ceoMessage,
        directCeoRows: [...owner.rows, ...manager.rows].filter((row) => row.recipientId === CEO).map((row) => row.type),
        routeStatuses: [owner.statuses, manager.statuses],
      },
      {
        lifecycleError: null,
        lifecycleCeoJobs: [],
        queueCeoJobs: 0,
        directCeoRows: [],
        routeStatuses: [
          { complete: 200, schedule: 200, reject: 200, submit: 200 },
          { complete: 200, schedule: 200, reject: 200, submit: 200 },
        ],
      }
    )
  })

  await run("ⓑ 평가 · 보정 · 확정 · 승인 알림은 HR 수신자에게 '[대표 대신]' 제목으로 간다(전 채널)", async () => {
    setSubstitutes('hr@example.com')
    const lifecycle = await runLifecycle()
    const direct = await runDirectSites({ ceoIs: 'owner' })
    const substituteJobs = ceoKeyed(lifecycle.jobs)
    assert.deepEqual(
      {
        lifecycle: substituteJobs
          .map((job) => `${job.type}:${job.channel}:${job.recipientId}:${job.title.startsWith(SUBSTITUTE_PREFIX)}`)
          .sort(),
        direct: direct.rows
          .filter((row) => row.title.startsWith(SUBSTITUTE_PREFIX))
          .map((row) => `${row.type}:${row.recipientId}`)
          .sort(),
      },
      {
        lifecycle: SUBSTITUTE_TYPES.flatMap((type) => [`${type}:EMAIL:${HR}:true`, `${type}:IN_APP:${HR}:true`]).sort(),
        direct: [`EVAL_RECEIVED:${HR}`, `EVAL_REJECTED:${HR}`],
      }
    )
  })

  await run('ⓒ 그 밖의 대표 앞 알림은 아무에게도 가지 않는다', async () => {
    setSubstitutes('hr@example.com')
    const lifecycle = await runLifecycle()
    const owner = await runDirectSites({ ceoIs: 'owner' })
    const manager = await runDirectSites({ ceoIs: 'manager' })
    assert.deepEqual(
      {
        lifecycleOther: ceoKeyed(lifecycle.jobs).filter((job) => OTHER_TYPES.includes(job.type)).map((job) => job.type),
        substituteOther: lifecycle.jobs.filter((job) => OTHER_TYPES.includes(job.type) && job.title.startsWith(SUBSTITUTE_PREFIX)).length,
        // 체크인 일정 · 낮은 에너지 알림은 대표 대신 누구에게도 가지 않는다
        directCheckin: [...owner.rows, ...manager.rows].filter(
          (row) => ['CHECKIN_SCHEDULED', 'SYSTEM'].includes(row.type) && (row.recipientId === CEO || row.title.startsWith(SUBSTITUTE_PREFIX))
        ).length,
      },
      { lifecycleOther: [], substituteOther: 0, directCheckin: 0 }
    )
  })

  await run('ⓓ HR 설정이 비었거나 못 찾으면 아무에게도 가지 않는다', async () => {
    const results: Record<string, unknown> = {}
    for (const [label, value] of [['unset', undefined], ['empty', ''], ['unknown', 'nobody@example.com']] as const) {
      setSubstitutes(value)
      const lifecycle = await runLifecycle()
      const direct = await runDirectSites({ ceoIs: 'owner' })
      results[label] = {
        ceoKeyed: ceoKeyed(lifecycle.jobs).length,
        substituteTitles: [...lifecycle.jobs.map((job) => job.title), ...direct.rows.map((row) => row.title)].filter((title) =>
          title.startsWith(SUBSTITUTE_PREFIX)
        ).length,
        ceoRows: direct.rows.filter((row) => row.recipientId === CEO).length,
      }
    }
    const empty = { ceoKeyed: 0, substituteTitles: 0, ceoRows: 0 }
    assert.deepEqual(results, { unset: empty, empty, unknown: empty })
  })

  await run('ⓔ 대신 보낸 알림과 HR 본인의 같은 유형 알림이 둘 다 생긴다(키가 겹치지 않는다)', async () => {
    setSubstitutes('hr@example.com')
    const lifecycle = await runLifecycle()
    const hrEvaluation = lifecycle.jobs.filter((job) => job.recipientId === HR && job.type === 'EVALUATION_REMINDER')
    assert.deepEqual(
      hrEvaluation.map((job) => `${job.channel}:${job.title.startsWith(SUBSTITUTE_PREFIX) ? 'substitute' : 'own'}`).sort(),
      ['EMAIL:own', 'EMAIL:substitute', 'IN_APP:own', 'IN_APP:substitute']
    )
  })

  await run('ⓕ 대표 조회가 실패하면 그 호출은 알림을 하나도 만들지 않는다', async () => {
    setSubstitutes('hr@example.com')
    state.ceoLookupFails = true
    try {
      const lifecycle = await runLifecycle()
      resetStore()
      let queueError: string | null = null
      try {
        await service.queueNotification(
          { recipientId: MEMBER, type: 'SYSTEM' as never, sourceType: 'Test', sourceId: 't-2', dedupeToken: 'fail', payload: {} },
          makeDb() as never
        )
      } catch (caught) {
        queueError = caught instanceof Error ? caught.message : String(caught)
      }
      assert.deepEqual(
        { lifecycleFailed: Boolean(lifecycle.error), lifecycleJobs: lifecycle.jobs.length, queueFailed: Boolean(queueError), queueJobs: state.jobs.length },
        { lifecycleFailed: true, lifecycleJobs: 0, queueFailed: true, queueJobs: 0 }
      )
    } finally {
      state.ceoLookupFails = false
    }
  })

  await run('ⓖ 대표가 아닌 수신자는 지금과 같다', async () => {
    setSubstitutes('hr@example.com')
    const lifecycle = await runLifecycle()
    const direct = await runDirectSites({ ceoIs: 'none' })
    const key = (type: string, channel: string, sourceType: string, sourceId: string, dedupeToken: string) =>
      service.buildNotificationIdempotencyKey({ recipientId: MEMBER, type: type as never, channel: channel as never, sourceType, sourceId, dedupeToken })
    const kst = lifecycle.jobs.find((job) => job.recipientId === MEMBER && job.type === 'GOAL_REMINDER')
    const yearMonth = new Date().toISOString().slice(0, 7)
    assert.deepEqual(
      {
        member: lifecycle.jobs
          .filter((job) => job.recipientId === MEMBER)
          .map((job) => `${job.type}:${job.channel}:${job.title}`)
          .sort(),
        checkpointKeys: lifecycle.jobs
          .filter((job) => job.recipientId === MEMBER && job.type === 'CHECKPOINT_REMINDER')
          .map((job) => job.idempotencyKey)
          .sort(),
        goalKeyOk: Boolean(kst?.idempotencyKey.startsWith(`${MEMBER}:GOAL_REMINDER:`)),
        direct: direct.rows.map((row) => `${row.type}:${row.recipientId}:${row.title}`).sort(),
      },
      {
        member: ['GOAL_REMINDER', 'CHECKPOINT_REMINDER', 'RESULT_CONFIRMATION_REMINDER', 'MEETING_REMINDER']
          .flatMap((type) => [`${type}:EMAIL:${type} 제목`, `${type}:IN_APP:${type} 제목`])
          .sort(),
        checkpointKeys: ['EMAIL', 'IN_APP']
          .map((channel) => key('CHECKPOINT_REMINDER', channel, 'Employee', MEMBER, `checkpoint:${yearMonth}`))
          .sort(),
        goalKeyOk: true,
        direct: [
          `CHECKIN_SCHEDULED:${MEMBER}:다음 체크인 일정`,
          `CHECKIN_SCHEDULED:${MEMBER}:체크인 일정`,
          `EVAL_RECEIVED:${DIV}:새 평가가 배정되었습니다.`,
          `EVAL_REJECTED:${DIV}:평가 보완 요청이 도착했습니다.`,
          `SYSTEM:${DIV}:반복 낮은 에너지 감지`,
        ].sort(),
      }
    )
  })

  await run('실제 Prisma 로 나간 호출이 없다(스텁하지 않은 DB 호출 0건)', () => {
    assert.deepEqual([...new Set(state.unstubbed)], [])
  })

  console.log('Notification CEO substitute tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
