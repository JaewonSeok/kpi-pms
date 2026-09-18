import assert from 'node:assert/strict'
import './register-path-aliases'
import bcrypt from 'bcryptjs'
import * as auditModule from '../src/lib/audit'
import { prisma } from '../src/lib/prisma'
import { authOptions } from '../src/lib/auth'

type CapturedLog = {
  userId: string
  action: string
  newValue?: Record<string, unknown>
}

const capturedLogs: CapturedLog[] = []
;(auditModule as { createAuditLog: unknown }).createAuditLog = async (params: CapturedLog) => {
  capturedLogs.push(params)
}

async function run(name: string, fn: () => Promise<void> | void) {
  try {
    await fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

function getAuthorize() {
  const cred = (authOptions.providers as Array<{ type: string; options: Record<string, unknown> }>).find(
    (provider) => provider.type === 'credentials'
  )
  if (!cred) {
    throw new Error('credentials provider not found in authOptions')
  }
  return cred.options.authorize as (
    credentials: { email?: string; password?: string } | undefined
  ) => Promise<unknown>
}

const ENV_KEYS = ['ADMIN_BREAKGLASS_ENABLED', 'ADMIN_EMAIL', 'ADMIN_PASSWORD_HASH'] as const
const savedEnv: Record<string, string | undefined> = {}
for (const key of ENV_KEYS) savedEnv[key] = process.env[key]

function resetEnv() {
  for (const key of ENV_KEYS) delete process.env[key]
}

function restoreEnv() {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key]
    else process.env[key] = savedEnv[key]
  }
}

async function main() {
  const authorize = getAuthorize()

  await run('플래그 off → authorize 가 null 반환, BREAKGLASS_DISABLED 기록', async () => {
    resetEnv()
    process.env.ADMIN_BREAKGLASS_ENABLED = 'false'
    process.env.ADMIN_EMAIL = 'admin@rsupport.com'
    capturedLogs.length = 0

    const result = await authorize({ email: 'admin@rsupport.com', password: 'irrelevant' })

    assert.equal(result, null)
    assert.equal(capturedLogs.length, 1)
    assert.equal(capturedLogs[0].action, 'AUTH_SIGNIN_FAILED')
    assert.equal(capturedLogs[0].newValue?.reason, 'BREAKGLASS_DISABLED')
    assert.equal('attemptedDomain' in (capturedLogs[0].newValue ?? {}), false)
  })

  await run('플래그 on + 해시 없음 → null, BREAKGLASS_NOT_CONFIGURED', async () => {
    resetEnv()
    process.env.ADMIN_BREAKGLASS_ENABLED = 'true'
    process.env.ADMIN_EMAIL = 'admin@rsupport.com'
    capturedLogs.length = 0

    const result = await authorize({ email: 'admin@rsupport.com', password: 'irrelevant' })

    assert.equal(result, null)
    assert.equal(capturedLogs.length, 1)
    assert.equal(capturedLogs[0].newValue?.reason, 'BREAKGLASS_NOT_CONFIGURED')
  })

  await run('플래그 on + 해시 있음 + 비밀번호 불일치 → null, INVALID_CREDENTIALS', async () => {
    resetEnv()
    process.env.ADMIN_BREAKGLASS_ENABLED = 'true'
    process.env.ADMIN_EMAIL = 'admin@rsupport.com'
    process.env.ADMIN_PASSWORD_HASH = bcrypt.hashSync('correct-test-password', 10)
    capturedLogs.length = 0

    const result = await authorize({ email: 'admin@rsupport.com', password: 'wrong-test-password' })

    assert.equal(result, null)
    assert.equal(capturedLogs.length, 1)
    assert.equal(capturedLogs[0].newValue?.reason, 'INVALID_CREDENTIALS')
  })

  // 검증 경계: bcrypt 통과 + findAuthEmployee 호출까지.
  // buildAuthClaims 는 unstable_cache(AsyncLocalStorage)에 의존해
  // Next 서버 런타임 밖에서 호출 불가. 이 PR 이 만든 제약이 아니라
  // 기존 구조의 성질이다. claims 반환 검증은 수동/e2e 로만 가능.
  await run('플래그 on + 올바른 비밀번호 → bcrypt 통과, findAuthEmployee 가 올바른 이메일로 호출됨', async () => {
    resetEnv()
    process.env.ADMIN_BREAKGLASS_ENABLED = 'true'
    process.env.ADMIN_EMAIL = 'admin@rsupport.com'
    process.env.ADMIN_PASSWORD_HASH = bcrypt.hashSync('correct-test-password', 10)
    capturedLogs.length = 0

    let findUniqueCalledWith: unknown = null
    ;(prisma as { employee: unknown }).employee = {
      findUnique: async (args: unknown) => {
        findUniqueCalledWith = args
        // employee 조회 결과를 null 로 둔다 — buildAuthClaims(unstable_cache 경유)를
        // 호출하지 않기 위한 검증 경계다. 실제 조회 성공 이후 동작은 검증 범위 밖.
        return null
      },
    }

    const result = await authorize({ email: 'admin@rsupport.com', password: 'correct-test-password' })

    assert.ok(
      findUniqueCalledWith,
      'findAuthEmployee 가 호출되지 않았다 — bcrypt.compare 를 통과하지 못했다는 뜻이다'
    )
    assert.deepEqual((findUniqueCalledWith as { where: unknown }).where, {
      gwsEmail: 'admin@rsupport.com',
    })
    assert.equal(result, null)
    assert.equal(capturedLogs.length, 1)
    assert.equal(capturedLogs[0].newValue?.reason, 'EMPLOYEE_NOT_FOUND')
  })

  restoreEnv()
  console.log('Admin break-glass tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
