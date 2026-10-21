import './setup-test-env'
import './register-path-aliases'
import assert from 'node:assert/strict'

// 실제 SMTP 로 나가지 않게 한다. setup-test-env 가 .env 를 읽으므로 SMTP 설정을 지워 jsonTransport 만 쓰게 한다.
for (const key of ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS']) delete process.env[key]

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

// 템플릿 테스트 발송 스텁. 실제 발송 여부는 성공 시도(notificationAttempt SUCCESS) 기록으로 본다.
function createDb(params: { recipientId: string; recipientEmail: string | null; ceoIds?: string[] }) {
  const attempts: Array<{ status: string }> = []
  const jobUpdates: Array<Record<string, unknown>> = []
  const db = {
    employee: {
      findUnique: async () => ({ id: params.recipientId, empName: `${params.recipientId}-이름`, gwsEmail: params.recipientEmail }),
      findMany: async (args?: { where?: { role?: string } }) =>
        args?.where?.role === 'ROLE_CEO' ? (params.ceoIds ?? []).map((id) => ({ id })) : [],
    },
    notificationJob: {
      create: async (args: { data: Record<string, unknown> }) => ({ id: 'job-1', ...args.data }),
      update: async (args: { data: Record<string, unknown> }) => {
        jobUpdates.push(args.data)
        return {}
      },
    },
    notificationAttempt: {
      create: async (args: { data: { status: string } }) => {
        attempts.push({ status: args.data.status })
        return {}
      },
    },
    notification: { create: async () => ({}) },
    notificationDeadLetter: { create: async () => ({}) },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(db),
  }
  return { db: db as never, attempts, jobUpdates }
}

async function main() {
  const { sendNotificationTemplateTest } = await import('../src/lib/notification-service')
  const sendEmailTest = (db: never) =>
    sendNotificationTemplateTest(
      {
        recipientId: 'emp-admin',
        type: 'GOAL_REMINDER' as never,
        code: 'GOAL_REMINDER_EMAIL',
        channel: 'EMAIL' as never,
        subjectTemplate: '테스트 {{employeeName}}',
        bodyTemplate: '본문',
        payload: {},
      },
      db
    ) as Promise<Record<string, unknown>>

  const withAllowlist = async <T>(value: string | undefined, fn: () => Promise<T>) => {
    const previous = process.env.NOTIFICATION_EMAIL_ALLOWLIST
    if (value === undefined) delete process.env.NOTIFICATION_EMAIL_ALLOWLIST
    else process.env.NOTIFICATION_EMAIL_ALLOWLIST = value
    try {
      return await fn()
    } finally {
      if (previous === undefined) delete process.env.NOTIFICATION_EMAIL_ALLOWLIST
      else process.env.NOTIFICATION_EMAIL_ALLOWLIST = previous
    }
  }
  const sentCount = (attempts: Array<{ status: string }>) => attempts.filter((item) => item.status === 'SUCCESS').length

  await run('ⓐ allowlist 에 없는 주소는 보내지 않고 NOT_IN_ALLOWLIST 를 돌려준다', async () => {
    const fake = createDb({ recipientId: 'emp-admin', recipientEmail: 'admin@example.com' })
    const result = await withAllowlist('someone-else@example.com', () => sendEmailTest(fake.db))
    assert.equal(sentCount(fake.attempts), 0)
    assert.equal(result.suppressReason, 'NOT_IN_ALLOWLIST')
  })

  await run('ⓑ 대표 주소는 보내지 않고 CEO_EMAIL_SUPPRESSED 를 돌려준다', async () => {
    const fake = createDb({ recipientId: 'emp-admin', recipientEmail: 'ceo@example.com', ceoIds: ['emp-admin'] })
    const result = await withAllowlist('*', () => sendEmailTest(fake.db))
    assert.equal(sentCount(fake.attempts), 0)
    assert.equal(result.suppressReason, 'CEO_EMAIL_SUPPRESSED')
  })

  await run("ⓒ allowlist 에 있는 주소(또는 '*')는 지금처럼 보낸다", async () => {
    for (const allowlist of ['admin@example.com', '*']) {
      const fake = createDb({ recipientId: 'emp-admin', recipientEmail: 'admin@example.com' })
      const result = await withAllowlist(allowlist, () => sendEmailTest(fake.db))
      assert.equal(sentCount(fake.attempts), 1, `allowlist=${allowlist}`)
      assert.equal(result.jobId, 'job-1')
      assert.equal(fake.jobUpdates.some((update) => update.status === 'SENT'), true)
    }
  })

  console.log('Notification template test-send guard tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
