import './register-path-aliases'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import Module from 'node:module'
import path from 'node:path'

process.env.DATABASE_URL ||= 'postgresql://postgres:password@localhost:5432/kpi_pms'
process.env.CRON_SECRET = 'test-cron-secret'

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

// DB 호출 기록. 정기 리마인더 생성(enqueueLifecycleReminders)은 사이클 · KPI · 체크인 · 평가를 읽고,
// 대기 잡 발송(dispatchDueNotificationJobs)은 notificationJob.findMany 로 처리할 잡을 읽는다.
const calls: string[] = []
const unstubbed: string[] = []
const record = (call: string, value: unknown) => async () => {
  calls.push(call)
  return value
}
const fakeDb = new Proxy({} as Record<string, unknown>, {
  get: (_target, key) => {
    if (typeof key !== 'string' || key === 'then') return undefined
    const models: Record<string, Record<string, unknown>> = {
      jobExecution: {
        findFirst: record('jobExecution.findFirst', null),
        create: record('jobExecution.create', { id: 'exec-1' }),
        update: record('jobExecution.update', {}),
        updateMany: record('jobExecution.updateMany', { count: 0 }),
      },
      notificationTemplate: { upsert: record('notificationTemplate.upsert', {}), findMany: record('notificationTemplate.findMany', []) },
      employee: { findMany: record('employee.findMany', []) },
      evalCycle: { findMany: record('evalCycle.findMany', []) },
      checkIn: { findMany: record('checkIn.findMany', []) },
      evaluation: { findMany: record('evaluation.findMany', []) },
      personalKpi: { findMany: record('personalKpi.findMany', []) },
      notificationJob: { findMany: record('notificationJob.findMany', []) },
    }
    const methods = models[key] ?? {}
    return new Proxy({} as Record<string, unknown>, {
      get: (_inner, method) => {
        if (typeof method !== 'string' || method === 'then') return undefined
        if (methods[method]) return methods[method]
        return () => {
          unstubbed.push(`${key}.${method}`)
          throw new Error(`UNSTUBBED_DB_CALL:${key}.${method}`)
        }
      },
    })
  },
})

stubModule('next-auth', { getServerSession: async () => null })
stubModule('../src/lib/auth', { authOptions: {} })
stubModule('../src/lib/prisma', { prisma: fakeDb })

const LIFECYCLE_READS = ['evalCycle.findMany', 'checkIn.findMany', 'evaluation.findMany', 'personalKpi.findMany']

async function main() {
  const cronRoute = await import('../src/app/api/cron/notifications/route')

  const callCron = async (query: string, authorization: string | null = 'Bearer test-cron-secret') => {
    calls.length = 0
    const response = await cronRoute.GET(
      new Request(`http://localhost/api/cron/notifications${query}`, {
        method: 'GET',
        headers: authorization ? { authorization } : {},
      })
    )
    return {
      status: response.status,
      lifecycle: LIFECYCLE_READS.filter((call) => calls.includes(call)),
      dispatched: calls.includes('notificationJob.findMany'),
      executions: calls.filter((call) => call === 'jobExecution.create').length,
    }
  }

  await run('ⓐ mode=dispatch 인 cron 호출은 대기 잡 발송만 하고 정기 리마인더를 만들지 않는다', async () => {
    assert.deepEqual(await callCron('?mode=dispatch'), { status: 200, lifecycle: [], dispatched: true, executions: 1 })
  })

  await run('ⓑ 모드 없는 cron 호출은 지금처럼 전체 실행이다', async () => {
    assert.deepEqual(await callCron(''), { status: 200, lifecycle: LIFECYCLE_READS, dispatched: true, executions: 1 })
  })

  await run('ⓒ 모르는 모드는 400 이고 아무것도 실행하지 않는다', async () => {
    const unknown = await callCron('?mode=everything')
    assert.deepEqual({ ...unknown, calls: [...calls] }, { status: 400, lifecycle: [], dispatched: false, executions: 0, calls: [] })
  })

  await run('ⓓ 인증이 없거나 틀리면 지금처럼 거절된다', async () => {
    const none = await callCron('?mode=dispatch', null)
    const wrong = await callCron('?mode=dispatch', 'Bearer wrong-secret')
    assert.deepEqual(
      { none: [none.status, none.executions, none.dispatched], wrong: [wrong.status, wrong.executions, wrong.dispatched] },
      { none: [403, 0, false], wrong: [403, 0, false] }
    )
  })

  await run('ⓔ vercel.json 에 09:00 전체 실행 cron 과 10~18시 매시 dispatch cron 이 둘 다 있다', () => {
    const vercel = JSON.parse(readFileSync(path.resolve(__dirname, '..', 'vercel.json'), 'utf8')) as {
      crons?: Array<{ path: string; schedule: string }>
    }
    const crons = (vercel.crons ?? []).map((cron) => `${cron.schedule} ${cron.path}`).sort()
    assert.deepEqual(crons, ['0 0 * * 1-5 /api/cron/notifications', '0 1-9 * * 1-5 /api/cron/notifications?mode=dispatch'])
  })

  await run('실제 Prisma 로 나간 호출이 없다(스텁하지 않은 DB 호출 0건)', () => {
    assert.deepEqual([...new Set(unstubbed)], [])
  })

  console.log('Notification dispatch cron tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
