import assert from 'node:assert/strict'
import {
  compressDepartmentScopeForToken,
  estimateSerializedPayloadBytes,
  hasCoreAuthTokenClaims,
  hasRecoverableAuthTokenIdentity,
  resolveDepartmentAccessMode,
} from '../src/lib/auth-session'

function run(name: string, fn: () => void) {
  try {
    fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

run('admin and ceo roles resolve to global department access mode', () => {
  assert.equal(resolveDepartmentAccessMode('ROLE_ADMIN'), 'GLOBAL')
  assert.equal(resolveDepartmentAccessMode('ROLE_CEO'), 'GLOBAL')
  assert.equal(resolveDepartmentAccessMode('ROLE_TEAM_LEADER'), 'SCOPED')
})

run('global department scope is compressed before it is stored in the auth token', () => {
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

run('scoped department access keeps normalized ids for non-admin users', () => {
  const compressed = compressDepartmentScopeForToken({
    role: 'ROLE_SECTION_CHIEF',
    accessibleDepartmentIds: ['dept-1', 'dept-2', 'dept-1', '', 'dept-3'],
  })

  assert.equal(compressed.departmentAccessMode, 'SCOPED')
  assert.deepEqual(compressed.accessibleDepartmentIds, ['dept-1', 'dept-2', 'dept-3'])
})

run('middleware auth check requires complete app claims instead of any token shell', () => {
  assert.equal(
    hasCoreAuthTokenClaims({
      sub: 'emp-1',
      email: 'member1@rsupport.com',
      name: '구성원',
      role: 'ROLE_MEMBER',
      empId: 'E-1001',
      position: 'MEMBER',
      deptId: 'dept-1',
      deptName: '개발팀',
      departmentCode: 'DEV',
      orgPath: '/HQ/DEV',
    }),
    true
  )

  assert.equal(
    hasCoreAuthTokenClaims({
      sub: 'emp-1',
      email: 'member1@rsupport.com',
      name: '구성원',
      role: 'ROLE_MEMBER',
    }),
    false
  )
})

run('first post-callback request can recover from identity-only token claims', () => {
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

console.log('Auth session tests completed')
