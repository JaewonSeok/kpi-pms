import assert from 'node:assert/strict'
import Module from 'node:module'
import path from 'node:path'

const moduleLoader = Module as unknown as {
  _resolveFilename: (
    request: string,
    parent: unknown,
    isMain: boolean,
    options: unknown
  ) => string
  _load: (request: string, parent: unknown, isMain: boolean) => unknown
}

const originalResolveFilename = moduleLoader._resolveFilename
const originalLoad = moduleLoader._load
moduleLoader._resolveFilename = function patchedResolveFilename(request, parent, isMain, options) {
  if (request.startsWith('@/')) {
    request = path.resolve(process.cwd(), 'src', request.slice(2))
  }
  return originalResolveFilename.call(this, request, parent, isMain, options)
}

async function run(name: string, fn: () => void | Promise<void>) {
  try {
    await fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

function buildExpiredMasterLoginToken() {
  const actor = {
    id: 'admin-1',
    email: 'admin@rsupport.com',
    name: 'Admin One',
    role: 'ROLE_ADMIN',
    empId: 'E-ADMIN-1',
    position: 'MEMBER',
    deptId: 'dept-1',
    deptName: 'HR',
    departmentCode: 'HR',
    managerId: null,
    orgPath: '/HR',
    accessibleDepartmentIds: [] as string[],
    departmentAccessMode: 'SCOPED',
  }

  return {
    sub: 'target-1',
    email: 'target@rsupport.com',
    name: 'Target One',
    role: 'ROLE_MEMBER',
    empId: 'E-TARGET-1',
    position: 'MEMBER',
    deptId: 'dept-2',
    deptName: 'Sales',
    departmentCode: 'SALES',
    managerId: null,
    orgPath: '/Sales',
    accessibleDepartmentIds: [] as string[],
    departmentAccessMode: 'SCOPED',
    masterLogin: {
      active: true,
      sessionId: 'sess-1',
      actorId: actor.id,
      actorName: actor.name,
      actorEmail: actor.email,
      targetId: 'target-1',
      targetName: 'Target One',
      targetEmail: 'target@rsupport.com',
      reason: 'test',
      startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      expiresAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      actor,
      target: {
        id: 'target-1',
        email: 'target@rsupport.com',
        name: 'Target One',
        role: 'ROLE_MEMBER',
        deptName: 'Sales',
      },
    },
  }
}

async function main() {
  process.env.NEXTAUTH_URL ??= 'https://kpi-pms.vercel.app'
  process.env.NEXTAUTH_SECRET ??= 'unit-test-secret'
  process.env.GOOGLE_CLIENT_ID ??= 'unit-google-client-id'
  process.env.GOOGLE_CLIENT_SECRET ??= 'unit-google-client-secret'
  process.env.ALLOWED_DOMAIN ??= 'rsupport.com'

  await run(
    'jwt callback logs MASTER_LOGIN_EXPIRED exactly once across two independent stale-cookie invocations, but restores actor claims on every invocation',
    async () => {
      const auditCalls: Array<{ action: string; userId: string }> = []
      let endCallCount = 0

      moduleLoader._load = function patchedLoad(request, parent, isMain) {
        if (request === '@/lib/prisma') {
          return { prisma: {} }
        }
        if (request === '@/lib/audit') {
          return {
            createAuditLog: async (params: { action: string; userId: string }) => {
              auditCalls.push({ action: params.action, userId: params.userId })
            },
            getClientInfo: () => ({ ipAddress: undefined, userAgent: undefined }),
          }
        }
        if (request === '@/lib/impersonation') {
          return {
            isImpersonationExpired: () => true,
          }
        }
        if (request === '@/lib/master-login') {
          return {
            canUseMasterLoginForActor: async () => false,
          }
        }
        if (request === '@/server/auth/org-scope') {
          return {
            buildOrgPath: async () => '/HR',
            getAccessibleDeptIds: async () => [],
          }
        }
        if (request === '@/server/impersonation') {
          return {
            createImpersonationSessionRecord: async () => null,
            endImpersonationSessionRecord: async () => {
              endCallCount += 1
              // 첫 호출만 실제로 활성 행을 비활성화한다고 가정(count>0),
              // 두 번째는 이미 비활성화된 뒤라 매치되는 행이 없다(count=0)
              return { count: endCallCount === 1 ? 1 : 0 }
            },
            findActiveImpersonationSession: async () => null,
          }
        }
        return originalLoad.call(this, request, parent, isMain)
      }

      try {
        const { authOptions } = (await import('../src/lib/auth')) as typeof import('../src/lib/auth')
        const jwtCallback = authOptions.callbacks?.jwt
        assert.ok(jwtCallback)

        // 동시 요청 두 건이 각자 독립적으로 같은(아직 갱신되지 않은) 만료 쿠키를 디코드하는 상황을 재현한다.
        const tokenForRequestA = buildExpiredMasterLoginToken()
        const tokenForRequestB = buildExpiredMasterLoginToken()

        const resultA = (await jwtCallback({
          token: tokenForRequestA,
          trigger: undefined,
        } as never)) as { sub?: string; masterLogin?: unknown }
        const resultB = (await jwtCallback({
          token: tokenForRequestB,
          trigger: undefined,
        } as never)) as { sub?: string; masterLogin?: unknown }

        assert.equal(auditCalls.length, 1, 'MASTER_LOGIN_EXPIRED must be logged exactly once, not once per invocation')
        assert.equal(auditCalls[0].action, 'MASTER_LOGIN_EXPIRED')
        assert.equal(auditCalls[0].userId, 'admin-1')

        // restoreActorClaims 는 가드 밖이므로 두 호출 모두 actor claims 로 복원되고 masterLogin 이 null 이어야 한다
        assert.equal(resultA.sub, 'admin-1')
        assert.equal(resultB.sub, 'admin-1')
        assert.equal(resultA.masterLogin, null)
        assert.equal(resultB.masterLogin, null)
      } finally {
        moduleLoader._load = originalLoad
      }
    }
  )

  console.log('Master login expiry idempotency tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
