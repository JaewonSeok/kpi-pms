import assert from 'node:assert/strict'
import Module from 'node:module'
import path from 'node:path'
import { encode } from 'next-auth/jwt'
import {
  buildAuthenticatedSessionShellFromToken,
  compressDepartmentScopeForToken,
  estimateSerializedPayloadBytes,
  hasAuthenticatedSessionIdentity,
  hasCoreAuthTokenClaims,
  hasFullAppSessionUserClaims,
  hasRecoverableAuthTokenIdentity,
  resolveProtectedSessionAccess,
  resolveDepartmentAccessMode,
} from '../src/lib/auth-session'
import {
  buildAuthCookieNameCandidates,
  collectPresentAuthCookieNames,
  resolveMatchedAuthCookieCandidate,
} from '../src/lib/auth-env'
import { resolveRequestAuthToken } from '../src/lib/auth-middleware'

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

async function buildSessionToken(secret: string) {
  return encode({
    secret,
    token: {
      sub: 'emp-1',
      email: 'member1@rsupport.com',
      name: 'Member One',
      role: 'ROLE_MEMBER',
      empId: 'E-1001',
      position: 'Manager',
      deptId: 'dept-1',
      deptName: 'Platform',
      departmentCode: 'PLT',
      managerId: null,
      orgPath: '/HQ/PLT',
      accessibleDepartmentIds: ['dept-1'],
    },
    maxAge: 60 * 60,
  })
}

async function main() {
  await run('admin and ceo roles resolve to global department access mode', () => {
    assert.equal(resolveDepartmentAccessMode('ROLE_ADMIN'), 'GLOBAL')
    assert.equal(resolveDepartmentAccessMode('ROLE_CEO'), 'GLOBAL')
    assert.equal(resolveDepartmentAccessMode('ROLE_TEAM_LEADER'), 'SCOPED')
  })

  await run('global department scope is compressed before it is stored in the auth token', () => {
    const fullDepartmentIds = Array.from({ length: 220 }, (_, index) => `dept-${index + 1}`)
    const rawPayload = {
      sub: 'admin-1',
      email: 'admin@rsupport.com',
      role: 'ROLE_ADMIN',
      accessibleDepartmentIds: fullDepartmentIds,
    }
    const compressed = compressDepartmentScopeForToken({
      role: 'ROLE_ADMIN',
      accessibleDepartmentIds: fullDepartmentIds,
    })
    const compressedPayload = {
      ...rawPayload,
      ...compressed,
    }

    assert.equal(compressed.departmentAccessMode, 'GLOBAL')
    assert.deepEqual(compressed.accessibleDepartmentIds, [])
    assert.ok(
      estimateSerializedPayloadBytes(compressedPayload) <
        estimateSerializedPayloadBytes(rawPayload) / 4
    )
  })

  await run('scoped department access keeps normalized ids for non-admin users', () => {
    const compressed = compressDepartmentScopeForToken({
      role: 'ROLE_SECTION_CHIEF',
      accessibleDepartmentIds: ['dept-1', 'dept-2', 'dept-1', '', 'dept-3'],
    })

    assert.equal(compressed.departmentAccessMode, 'SCOPED')
    assert.deepEqual(compressed.accessibleDepartmentIds, ['dept-1', 'dept-2', 'dept-3'])
  })

  await run('middleware auth check requires complete app claims instead of any token shell', () => {
    assert.equal(
      hasCoreAuthTokenClaims({
        sub: 'emp-1',
        email: 'member1@rsupport.com',
        name: 'Member One',
        role: 'ROLE_MEMBER',
        empId: 'E-1001',
        position: 'Manager',
        deptId: 'dept-1',
        deptName: 'Platform',
        departmentCode: 'PLT',
        orgPath: '/HQ/PLT',
      }),
      true
    )

    assert.equal(
      hasCoreAuthTokenClaims({
        sub: 'emp-1',
        email: 'member1@rsupport.com',
        name: 'Member One',
        role: 'ROLE_MEMBER',
      }),
      false
    )
  })

  await run('first post-callback request can recover from identity-only token claims', () => {
    assert.equal(
      hasRecoverableAuthTokenIdentity({
        sub: 'emp-1',
      }),
      true
    )

    assert.equal(
      hasRecoverableAuthTokenIdentity({
        email: 'member1@rsupport.com',
      }),
      true
    )

    assert.equal(
      hasRecoverableAuthTokenIdentity({
        role: 'ROLE_ADMIN',
      }),
      false
    )
  })

  await run('full app session claims helper distinguishes valid and partial session users', () => {
    assert.equal(
      hasFullAppSessionUserClaims({
        id: 'emp-1',
        email: 'member1@rsupport.com',
        name: 'Member One',
        role: 'ROLE_MEMBER',
        empId: 'E-1001',
        position: 'Manager',
        deptId: 'dept-1',
        deptName: 'Platform',
        departmentCode: 'PLT',
        orgPath: '/HQ/PLT',
      }),
      true
    )
    assert.equal(
      hasFullAppSessionUserClaims({
        id: 'emp-1',
        email: 'member1@rsupport.com',
        role: 'ROLE_MEMBER',
      }),
      false
    )
  })

  await run('authenticated session identity helper treats partial user shells as signed-in users', () => {
    assert.equal(
      hasAuthenticatedSessionIdentity({
        id: 'emp-1',
      }),
      true
    )
    assert.equal(
      hasAuthenticatedSessionIdentity({
        email: 'member1@rsupport.com',
      }),
      true
    )
    assert.equal(
      hasAuthenticatedSessionIdentity({
        role: 'ROLE_MEMBER',
      }),
      false
    )
  })

  await run('authenticated session shell builder keeps token identity alive during non-fatal claims failures', () => {
    const shell = buildAuthenticatedSessionShellFromToken(
      {
        sub: 'emp-1',
        email: 'member1@rsupport.com',
        name: 'Member One',
      },
      {
        authErrorCode: 'CLAIMS_REHYDRATION_FAILED',
        authErrorReason: 'P2022',
      }
    )

    assert.deepEqual(shell, {
      authState: 'AUTHENTICATED_BUT_CLAIMS_MISSING',
      authErrorCode: 'CLAIMS_REHYDRATION_FAILED',
      authErrorReason: 'P2022',
      user: {
        id: 'emp-1',
        email: 'member1@rsupport.com',
        name: 'Member One',
      },
    })
  })

  await run('protected layout fallback treats token identity as pending instead of unauthenticated', () => {
    assert.deepEqual(
      resolveProtectedSessionAccess({
        session: null,
        fallbackToken: {
          sub: 'emp-1',
          email: 'member1@rsupport.com',
          authErrorCode: 'CLAIMS_REHYDRATION_FAILED',
          authErrorReason: 'P2022',
        },
      }),
      {
        action: 'redirect-pending',
        reason: 'CLAIMS_REHYDRATION_FAILED',
        authErrorReason: 'P2022',
        source: 'token',
      }
    )
    assert.deepEqual(
      resolveProtectedSessionAccess({
        session: null,
      }),
      {
        action: 'redirect-login',
        reason: 'SessionRequired',
      }
    )
  })

  await run('session callback keeps an authenticated shell when Prisma claims rehydration fails', async () => {
    process.env.NEXTAUTH_URL ??= 'https://kpi-pms.vercel.app'
    process.env.NEXTAUTH_SECRET ??= 'unit-test-secret'
    process.env.GOOGLE_CLIENT_ID ??= 'unit-google-client-id'
    process.env.GOOGLE_CLIENT_SECRET ??= 'unit-google-client-secret'
    process.env.ALLOWED_DOMAIN ??= 'rsupport.com'

    const prismaStub = {
      employee: {
        findUnique: async () => {
          throw {
            code: 'P2022',
            name: 'PrismaClientKnownRequestError',
            message: 'The column `(not available)` does not exist.',
          }
        },
      },
      department: {
        findMany: async () => [],
      },
    }

    moduleLoader._load = function patchedLoad(request, parent, isMain) {
      if (request === '@/lib/prisma') {
        return {
          prisma: prismaStub,
        }
      }

      if (request === '@/lib/audit') {
        return {
          createAuditLog: async () => {},
        }
      }

      if (request === '@/lib/impersonation') {
        return {
          isImpersonationExpired: () => false,
        }
      }

      if (request === '@/lib/master-login') {
        return {
          canUseMasterLoginForActor: async () => false,
        }
      }

      if (request === '@/server/auth/org-scope') {
        return {
          buildOrgPath: async () => '/HQ',
          getAccessibleDeptIds: async () => [],
        }
      }

      if (request === '@/server/impersonation') {
        return {
          createImpersonationSessionRecord: async () => null,
          endImpersonationSessionRecord: async () => null,
          findActiveImpersonationSession: async () => null,
        }
      }

      return originalLoad.call(this, request, parent, isMain)
    }

    try {
      const { authOptions } = (await import('../src/lib/auth')) as typeof import('../src/lib/auth')
      const sessionCallback = authOptions.callbacks?.session
      assert.ok(sessionCallback)

      const session = (await sessionCallback({
        session: {
          user: {
            name: 'Member One',
            email: '',
            image: null,
          },
        },
        token: {
          sub: 'emp-1',
          email: 'member1@rsupport.com',
          name: 'Member One',
        },
      } as never)) as {
        authState?: string | null
        authErrorCode?: string | null
        authErrorReason?: string | null
        user: {
          id?: string
          email?: string
          name?: string
        }
      }

      assert.equal(session.authState, 'AUTHENTICATED_BUT_CLAIMS_MISSING')
      assert.equal(session.authErrorCode, 'CLAIMS_REHYDRATION_FAILED')
      assert.equal(session.authErrorReason, 'P2022')
      assert.equal(session.user.id, 'emp-1')
      assert.equal(session.user.email, 'member1@rsupport.com')
      assert.equal(session.user.name, 'Member One')
    } finally {
      moduleLoader._load = originalLoad
    }
  })

  await run('auth cookie candidate helpers detect secure and plain names in priority order', () => {
    const candidates = buildAuthCookieNameCandidates()
    const requestCookieNames = [
      '__Secure-next-auth.session-token.0',
      'next-auth.csrf-token',
      'next-auth.session-token',
    ]

    assert.deepEqual(candidates.sessionToken, [
      '__Secure-next-auth.session-token',
      'next-auth.session-token',
    ])
    assert.deepEqual(
      collectPresentAuthCookieNames(requestCookieNames, candidates.sessionToken),
      ['__Secure-next-auth.session-token.0', 'next-auth.session-token']
    )
    assert.equal(
      resolveMatchedAuthCookieCandidate(requestCookieNames, candidates.sessionToken),
      '__Secure-next-auth.session-token'
    )
  })

  await run('secure cookie requests resolve a valid auth token in middleware fallback order', async () => {
    const secret = 'unit-test-secret'
    const token = await buildSessionToken(secret)
    const request = new Request('https://kpi-pms.vercel.app/dashboard', {
      headers: {
        cookie: `__Secure-next-auth.session-token=${token}`,
      },
    })

    const resolved = await resolveRequestAuthToken({
      request,
      secret,
    })

    assert.equal(resolved.matchedSessionCookieName, '__Secure-next-auth.session-token')
    assert.deepEqual(resolved.presentSessionCookieNames, ['__Secure-next-auth.session-token'])
    assert.equal(resolved.token?.sub, 'emp-1')
  })

  await run('plain cookie requests resolve a valid auth token for localhost and dev flows', async () => {
    const secret = 'unit-test-secret'
    const token = await buildSessionToken(secret)
    const request = new Request('http://localhost:3000/dashboard', {
      headers: {
        cookie: `next-auth.session-token=${token}`,
      },
    })

    const resolved = await resolveRequestAuthToken({
      request,
      secret,
    })

    assert.equal(resolved.matchedSessionCookieName, 'next-auth.session-token')
    assert.deepEqual(resolved.presentSessionCookieNames, ['next-auth.session-token'])
    assert.equal(resolved.token?.email, 'member1@rsupport.com')
  })

  console.log('Auth session tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
