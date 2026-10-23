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

type RoundStatus = 'DRAFT' | 'RATER_SELECTION' | 'IN_PROGRESS' | 'COMPLETED' | 'CLOSED' | 'CANCELLED'
const ALL_STATUSES: RoundStatus[] = ['DRAFT', 'RATER_SELECTION', 'IN_PROGRESS', 'COMPLETED', 'CLOSED', 'CANCELLED']

const ORG = 'org-1'
const department = { id: 'dept-1', deptName: '영업팀', orgId: ORG }
const EMPLOYEES: Record<string, Record<string, unknown>> = {
  'emp-admin': { empName: '관리자', role: 'ROLE_ADMIN', position: 'MEMBER' },
  'emp-leader': { empName: '팀장', role: 'ROLE_TEAM_LEADER', position: 'TEAM_LEADER' },
  'emp-m1': { empName: '팀원1', role: 'ROLE_MEMBER', position: 'MEMBER', teamLeaderId: 'emp-leader' },
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
    status: 'ACTIVE',
    deptId: 'dept-1',
    department,
    ...base,
  }
}

type Scenario = { status: RoundStatus; released: boolean; roundType: 'UPWARD' | 'FULL_360' }
let scenario: Scenario = { status: 'DRAFT', released: false, roundType: 'UPWARD' }
function roundRow() {
  return {
    id: 'round-1',
    evalCycleId: 'cycle-1',
    roundName: '2026 리더십 진단',
    roundType: scenario.roundType,
    status: scenario.status,
    minRaters: 3,
    startDate: new Date('2026-11-01T00:00:00Z'),
    endDate: new Date('2026-11-30T00:00:00Z'),
    documentSettings: {
      templateId: 'tpl-1',
      targetTypes: ['TEAM_LEADER'],
      ...(scenario.released ? { resultReleasedAt: '2026-12-01T00:00:00.000Z', resultReleasedById: 'emp-admin' } : {}),
    },
    evalCycle: { orgId: ORG },
    feedbacks: [{ giverId: 'emp-m1', receiverId: 'emp-leader', status: 'PENDING' }],
    nominations: [],
  }
}

// 스텁하지 않은 모델 · 메서드에 접근하면 기록하고 즉시 던진다. 실제 Prisma 로는 나가지 않는다.
const unstubbedCalls: string[] = []
const roundUpdates: Array<Record<string, unknown>> = []
const jobs: string[] = []
const notificationRows: string[] = []
const audits: string[] = []
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
  employee: {
    findUnique: async (args: { where: { id: string } }) => employee(args.where.id),
    // 대표 조회(where.role ROLE_CEO)에는 대표가 없다. 그 밖에는 고른 직원(id in)
    findMany: async (args?: { where?: { role?: string; id?: { in?: string[] } } }) =>
      args?.where?.role === 'ROLE_CEO' ? [] : (args?.where?.id?.in ?? []).map((id) => employee(id)).filter(Boolean),
  },
  feedbackAdminGroupMember: { findMany: async () => [] },
  multiFeedbackRound: {
    findFirst: async () => roundRow(),
    findUnique: async () => roundRow(),
    update: async (args: { data: Record<string, unknown> }) => {
      roundUpdates.push(args.data)
      return { id: 'round-1' }
    },
  },
  multiFeedback: { count: async () => roundRow().feedbacks.length },
  notificationTemplate: {
    upsert: async () => ({}),
    findMany: async () =>
      ['evaluation-reminder-in-app', 'evaluation-reminder-email'].map((code) => ({
        code,
        channel: code.endsWith('email') ? 'EMAIL' : 'IN_APP',
        isActive: true,
        isDigestCompatible: false,
        subjectTemplate: '리마인더',
        bodyTemplate: '본문',
        defaultLink: '/evaluation/360',
      })),
  },
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
    create: async (args: { data: { recipientId: string; channel: string } }) => {
      jobs.push(`${args.data.recipientId}:${args.data.channel}`)
      return { id: `job-${jobs.length}` }
    },
  },
  notification: {
    create: async (args: { data: { recipientId: string } }) => {
      notificationRows.push(args.data.recipientId)
      return { id: `row-${notificationRows.length}` }
    },
  },
})

stubModule('next-auth', {
  getServerSession: async () => ({ user: { id: 'emp-admin', role: 'ROLE_ADMIN', name: '관리자', email: 'emp-admin@example.com' } }),
})
stubModule('../src/lib/auth', { authOptions: {} })
stubModule('../src/lib/audit', {
  createAuditLog: async (entry: { action: string }) => {
    audits.push(entry.action)
  },
  getClientInfo: () => ({}),
  resolveAuditActor: () => ({ userId: 'emp-admin' }),
})
stubModule('../src/lib/prisma', { prisma: fakeDb })
stubModule('../src/server/impersonation', {
  validateImpersonationRiskRequest: async () => null,
  logImpersonationRiskExecution: async () => undefined,
})

type StatusButtonModule = {
  UpwardRoundStatusButton: React.FC<Record<string, unknown>>
  resolveUpwardRoundStatusAction: (round: { status: string; roundName: string }) => {
    action: string | null
    label: string
    enabled: boolean
    confirmMessage: string | null
  }
}

async function main() {
  const adminRoute = await import('../src/app/api/feedback/upward/admin/route')
  const notificationsRoute = await import('../src/app/api/feedback/rounds/[id]/notifications/route')
  const buttonModule = loadOptional<StatusButtonModule>('../src/components/evaluation/upward/UpwardRoundStatusButton')

  const reset = () => {
    roundUpdates.length = 0
    jobs.length = 0
    notificationRows.length = 0
    audits.length = 0
  }
  // 상태 전환. 본 것 = 상태 코드 · 에러 메시지 · 바뀐 상태 · 공개 표시가 지워졌는지 · 감사 로그 수
  const transition = async (status: RoundStatus, action: 'START' | 'CLOSE' | 'REOPEN', released = false) => {
    scenario = { status, released, roundType: 'UPWARD' }
    reset()
    const response = await adminRoute.POST(
      new Request('http://localhost/api/feedback/upward/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'updateRoundStatus', payload: { roundId: 'round-1', action } }),
      })
    )
    const json = (await response.json().catch(() => null)) as { error?: { message?: string } } | null
    const written = roundUpdates[0]?.documentSettings as Record<string, unknown> | undefined
    return {
      status: response.status,
      message: json?.error?.message ?? null,
      next: (roundUpdates[0]?.status as string | undefined) ?? null,
      releaseCleared: written ? !('resultReleasedAt' in written) : null,
      writes: roundUpdates.length,
      audits: audits.length,
    }
  }

  await run('ⓐ START: 마감 라운드는 400 이고 아무것도 쓰지 않는다. 시작 전 라운드는 지금처럼 IN_PROGRESS 가 된다', async () => {
    const closed = await transition('COMPLETED', 'START', true)
    const ended = await transition('CLOSED', 'START', true)
    const draft = await transition('DRAFT', 'START')
    const selection = await transition('RATER_SELECTION', 'START')
    assert.deepEqual(
      {
        closed: [closed.status, closed.message, closed.writes],
        ended: [ended.status, ended.message, ended.writes],
        draft: [draft.status, draft.next],
        selection: [selection.status, selection.next],
      },
      {
        closed: [400, '마감된 라운드는 다시 열기로 엽니다', 0],
        ended: [400, '마감된 라운드는 다시 열기로 엽니다', 0],
        draft: [200, 'IN_PROGRESS'],
        selection: [200, 'IN_PROGRESS'],
      }
    )
  })

  await run('ⓑ REOPEN: 마감 라운드는 IN_PROGRESS 가 되고 공개 표시가 지워지며 감사 로그 1건. 다른 상태는 400', async () => {
    const reopened = await transition('COMPLETED', 'REOPEN', true)
    const closedReopened = await transition('CLOSED', 'REOPEN', true)
    const others: Record<string, [number, number]> = {}
    for (const status of ['DRAFT', 'RATER_SELECTION', 'IN_PROGRESS', 'CANCELLED'] as const) {
      const result = await transition(status, 'REOPEN')
      others[status] = [result.status, result.writes]
    }
    assert.deepEqual(
      {
        reopened: [reopened.status, reopened.next, reopened.releaseCleared, reopened.audits],
        closedReopened: [closedReopened.status, closedReopened.next],
        others,
      },
      {
        reopened: [200, 'IN_PROGRESS', true, 1],
        closedReopened: [200, 'IN_PROGRESS'],
        others: { DRAFT: [400, 0], RATER_SELECTION: [400, 0], IN_PROGRESS: [400, 0], CANCELLED: [400, 0] },
      }
    )
  })

  await run('ⓒ CLOSE: IN_PROGRESS 만 COMPLETED 가 된다. 시작 전 · 취소 라운드는 400', async () => {
    const results: Record<string, [number, string | null]> = {}
    for (const status of ALL_STATUSES) {
      const result = await transition(status, 'CLOSE')
      results[status] = [result.status, result.next]
    }
    assert.deepEqual(results, {
      DRAFT: [400, null],
      RATER_SELECTION: [400, null],
      IN_PROGRESS: [200, 'COMPLETED'],
      COMPLETED: [400, null],
      CLOSED: [400, null],
      CANCELLED: [400, null],
    })
  })

  await run("ⓓ 화면: 마감 라운드에는 '시작' 대신 '다시 열기'가 보이고, 확인 창에 라운드 이름이 있다", () => {
    assert.ok(buttonModule, 'UpwardRoundStatusButton 모듈이 없다')
    const render = (status: RoundStatus) =>
      renderToStaticMarkup(
        React.createElement(buttonModule.UpwardRoundStatusButton, {
          round: { id: 'round-1', status, roundName: '2026 리더십 진단' },
          busy: false,
          onAction: () => undefined,
        })
      )
    const closedMarkup = render('COMPLETED')
    const reopen = buttonModule.resolveUpwardRoundStatusAction({ status: 'COMPLETED', roundName: '2026 리더십 진단' })
    const states = Object.fromEntries(
      ALL_STATUSES.map((status) => {
        const resolved = buttonModule.resolveUpwardRoundStatusAction({ status, roundName: '2026 리더십 진단' })
        return [status, `${resolved.action}:${resolved.enabled}`]
      })
    )
    assert.deepEqual(
      {
        showsReopen: closedMarkup.includes('다시 열기'),
        showsStart: closedMarkup.includes('진단 기간 시작'),
        confirmHasRoundName: Boolean(reopen.confirmMessage?.includes('2026 리더십 진단')),
        confirmWarnsRelease: Boolean(reopen.confirmMessage?.includes('결과 공개가 취소됩니다')),
        disabledWhenCancelled: render('CANCELLED').includes('disabled'),
        states,
      },
      {
        showsReopen: true,
        showsStart: false,
        confirmHasRoundName: true,
        confirmWarnsRelease: true,
        disabledWhenCancelled: true,
        states: {
          DRAFT: 'START:true',
          RATER_SELECTION: 'START:true',
          IN_PROGRESS: 'CLOSE:true',
          COMPLETED: 'REOPEN:true',
          CLOSED: 'REOPEN:true',
          CANCELLED: 'null:false',
        },
      }
    )
  })

  await run('ⓔ 수동 알림: 취소 라운드는 400 이고 잡 · 알림 행이 생기지 않는다. 다른 상태는 지금과 같다', async () => {
    const send = async (status: RoundStatus, roundType: 'UPWARD' | 'FULL_360') => {
      scenario = { status, released: false, roundType }
      reset()
      const response = await notificationsRoute.POST(
        new Request('http://localhost/api/feedback/rounds/round-1/notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'send-review-reminder',
            roundId: 'round-1',
            targetIds: ['emp-m1'],
            subject: '응답 요청',
            body: '<p>응답을 부탁드립니다.</p>',
          }),
        }),
        { params: Promise.resolve({ id: 'round-1' }) }
      )
      return [response.status, jobs.length + notificationRows.length]
    }
    assert.deepEqual(
      {
        upwardCancelled: await send('CANCELLED', 'UPWARD'),
        fullCancelled: await send('CANCELLED', 'FULL_360'),
        upwardInProgress: await send('IN_PROGRESS', 'UPWARD'),
        fullInProgress: await send('IN_PROGRESS', 'FULL_360'),
      },
      // 진행 중 라운드는 지금처럼 평가자에게 앱 · 메일 잡 2건이 생긴다.
      { upwardCancelled: [400, 0], fullCancelled: [400, 0], upwardInProgress: [200, 2], fullInProgress: [200, 2] }
    )
  })

  await run('실제 Prisma 로 나간 호출이 없다(스텁하지 않은 DB 호출 0건)', () => {
    assert.deepEqual([...new Set(unstubbedCalls)], [])
  })

  console.log('Upward round status transition tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
