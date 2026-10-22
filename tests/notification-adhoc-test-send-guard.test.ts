import './register-path-aliases'
import assert from 'node:assert/strict'
import Module from 'node:module'

process.env.DATABASE_URL ||= 'postgresql://postgres:password@localhost:5432/kpi_pms'
// 외부로 나가지 않게: SMTP 를 비우고(jsonTransport) nodemailer 도 기록용 스텁으로 바꾼다.
process.env.SMTP_HOST = ''
process.env.SMTP_USER = ''
process.env.SMTP_PASS = ''
process.env.ALLOWED_DOMAIN = 'example.com'
process.env.NOTIFICATION_EMAIL_ALLOWLIST = 'allowed@example.com,ceo@example.com'

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

const sentMails: Array<{ to: string }> = []
stubModule('nodemailer', {
  createTransport: () => ({
    sendMail: async (mail: { to: string }) => {
      sentMails.push({ to: mail.to })
      return { messageId: `msg-${sentMails.length}` }
    },
  }),
})

// 스텁하지 않은 모델 · 메서드에 접근하면 기록하고 즉시 던진다. 실제 Prisma 로는 나가지 않는다.
const unstubbedCalls: string[] = []
function guardedDb(models: Record<string, Record<string, unknown>>): Record<string, unknown> {
  return new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => {
      if (typeof key !== 'string' || key === 'then') return undefined
      if (key === '$transaction') {
        return async (fn: (tx: unknown) => unknown) => fn(fakeDb)
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

const EMPLOYEE_ID_BY_EMAIL: Record<string, string> = {
  'allowed@example.com': 'emp-allowed',
  'ceo@example.com': 'emp-ceo',
  'other@example.com': 'emp-other',
}
let ceoLookupFails = false
const jobUpdates: Array<{ id: string; status?: unknown }> = []
const attempts: Array<{ jobId: string }> = []
const inAppNotifications: Array<{ jobId: string }> = []
let processableJobs: Array<Record<string, unknown>> = []

const fakeDb: Record<string, unknown> = guardedDb({
  employee: {
    // 대표 판정(getCeoRecipientIds): ROLE_CEO · ACTIVE
    findMany: async () => {
      if (ceoLookupFails) throw new Error('CEO lookup failed')
      return [{ id: 'emp-ceo' }]
    },
    findFirst: async (args: { where?: { gwsEmail?: { equals?: string } | string } }) => {
      const raw = args?.where?.gwsEmail
      const email = (typeof raw === 'string' ? raw : raw?.equals ?? '').toLowerCase()
      const id = EMPLOYEE_ID_BY_EMAIL[email]
      return id ? { id } : null
    },
    findUnique: async (args: { where?: { gwsEmail?: string } }) => {
      const id = EMPLOYEE_ID_BY_EMAIL[(args?.where?.gwsEmail ?? '').toLowerCase()]
      return id ? { id } : null
    },
  },
  notificationJob: {
    findMany: async () => processableJobs,
    update: async (args: { where: { id: string }; data: { status?: unknown } }) => {
      jobUpdates.push({ id: args.where.id, status: args.data.status })
      return {}
    },
  },
  notificationAttempt: {
    create: async (args: { data: { notificationJobId: string } }) => {
      attempts.push({ jobId: args.data.notificationJobId })
      return {}
    },
  },
  notification: {
    create: async (args: { data: { jobId: string } }) => {
      inAppNotifications.push({ jobId: args.data.jobId })
      return {}
    },
  },
})
stubModule('../src/lib/prisma', { prisma: fakeDb })

async function main() {
  const service = await import('../src/lib/notification-service')

  const adhoc = async (recipientEmail: string) => {
    sentMails.length = 0
    // db 를 두 번째 인자로 넘긴다(가짜 DB). 결과에 막힌 사유가 있는지 본다.
    const sendAdhoc = service.sendAdhocNotificationTest as unknown as (params: unknown, db: unknown) => Promise<unknown>
    const result = (await sendAdhoc(
      { recipientEmail, recipientName: '테스트', subject: '테스트 발송', body: '<p>본문</p>' },
      fakeDb
    )) as { sent?: boolean; suppressReason?: string | null } | undefined
    return { sentTo: sentMails.map((mail) => mail.to), suppressReason: result?.suppressReason ?? null }
  }

  await run('ⓐ allowlist 에 없는 주소는 보내지 않고 NOT_IN_ALLOWLIST', async () => {
    assert.deepEqual(await adhoc('other@example.com'), { sentTo: [], suppressReason: 'NOT_IN_ALLOWLIST' })
  })

  await run('ⓑ 대표 주소는 보내지 않고 CEO_EMAIL_SUPPRESSED', async () => {
    assert.deepEqual(await adhoc('ceo@example.com'), { sentTo: [], suppressReason: 'CEO_EMAIL_SUPPRESSED' })
  })

  await run('ⓒ allowlist 에 있는 주소는 지금처럼 보낸다', async () => {
    const result = await adhoc('allowed@example.com')
    assert.deepEqual(result.sentTo, ['allowed@example.com'])
  })

  await run('ⓓ 대표 조회가 실패하면 EMAIL 잡이 하나도 나가지 않고 대기로 남는다', async () => {
    ceoLookupFails = true
    sentMails.length = 0
    jobUpdates.length = 0
    attempts.length = 0
    inAppNotifications.length = 0
    const recipient = { id: 'emp-allowed', empName: '수신자', gwsEmail: 'allowed@example.com' }
    const baseJob = {
      recipientId: 'emp-allowed',
      recipient,
      type: 'EVALUATION_REMINDER',
      templateCode: 'evaluation-reminder',
      title: '제목',
      message: '본문',
      link: null,
      payload: null,
      status: 'QUEUED',
      retryCount: 0,
      maxRetries: 3,
      isDigestMember: false,
      digestKey: null,
    }
    processableJobs = [
      { ...baseJob, id: 'job-email', channel: 'EMAIL' },
      { ...baseJob, id: 'job-email-digest', channel: 'EMAIL', isDigestMember: true, digestKey: 'emp-allowed:2026-10-22' },
      { ...baseJob, id: 'job-inapp', channel: 'IN_APP' },
    ]
    try {
      await service.dispatchDueNotificationJobs(fakeDb as never)
    } finally {
      ceoLookupFails = false
    }
    assert.deepEqual(
      {
        sentMails: sentMails.length,
        emailJobWrites: [...jobUpdates, ...attempts.map((attempt) => ({ id: attempt.jobId }))].filter((write) =>
          String(write.id).startsWith('job-email')
        ),
        // IN_APP 은 그대로 나간다.
        inAppDelivered: inAppNotifications.map((item) => item.jobId),
      },
      { sentMails: 0, emailJobWrites: [], inAppDelivered: ['job-inapp'] }
    )
  })

  await run('실제 Prisma 로 나간 호출이 없다(스텁하지 않은 DB 호출 0건)', () => {
    assert.deepEqual([...new Set(unstubbedCalls)], [])
  })

  console.log('Notification adhoc test-send guard tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
