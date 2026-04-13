import assert from 'node:assert/strict'
import { encode } from 'next-auth/jwt'
import {
  compressDepartmentScopeForToken,
  estimateSerializedPayloadBytes,
  hasCoreAuthTokenClaims,
  hasFullAppSessionUserClaims,
  hasRecoverableAuthTokenIdentity,
  resolveDepartmentAccessMode,
} from '../src/lib/auth-session'
import {
  buildAuthCookieNameCandidates,
  collectPresentAuthCookieNames,
  resolveMatchedAuthCookieCandidate,
} from '../src/lib/auth-env'
import { resolveRequestAuthToken } from '../src/lib/auth-middleware'

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
