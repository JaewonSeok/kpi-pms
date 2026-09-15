import assert from 'node:assert/strict'
import './register-path-aliases'
import { resolveAuditActor } from '../src/lib/audit'
import type { AuthSession } from '../src/types/auth'

function run(name: string, fn: () => void) {
  try {
    fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

type TestMasterLogin = Omit<NonNullable<AuthSession['user']['masterLogin']>, 'active'> & {
  active: boolean
}

function buildSession(overrides: { masterLogin?: TestMasterLogin }): AuthSession {
  return {
    expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    user: {
      id: 'target-emp-1',
      email: 'target@rsupport.com',
      name: 'Target One',
      role: 'ROLE_MEMBER',
      empId: 'E-TARGET-1',
      position: 'MEMBER',
      deptId: 'dept-1',
      deptName: 'Sales',
      departmentCode: 'SALES',
      managerId: null,
      orgPath: '/Sales',
      accessibleDepartmentIds: [],
      masterLoginAvailable: false,
      masterLogin: overrides.masterLogin ?? null,
    },
  } as AuthSession
}

run('대행 중이면 userId=대행 대상, actorUserId=실행 관리자로 분리된다', () => {
  const session = buildSession({
    masterLogin: {
      active: true,
      sessionId: 'sess-1',
      actorId: 'admin-1',
      actorName: 'Admin One',
      actorEmail: 'admin@rsupport.com',
      targetId: 'target-emp-1',
      startedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      reason: 'test',
      targetName: 'Target One',
      targetEmail: 'target@rsupport.com',
    },
  })

  const actor = resolveAuditActor(session)
  assert.equal(actor.userId, 'target-emp-1')
  assert.equal(actor.actorUserId, 'admin-1')
})

run('평상시(대행 아님)면 session.user.id 만 쓰고 actorUserId 는 없다', () => {
  const session = buildSession({})
  const actor = resolveAuditActor(session)
  assert.equal(actor.userId, 'target-emp-1')
  assert.equal(actor.actorUserId, undefined)
})

run('masterLogin.active 가 false 여도 평상시로 처리된다', () => {
  const session = buildSession({
    masterLogin: {
      active: false,
      sessionId: 'sess-1',
      actorId: 'admin-1',
      actorName: 'Admin One',
      actorEmail: 'admin@rsupport.com',
      targetId: 'target-emp-1',
      startedAt: new Date().toISOString(),
      expiresAt: new Date().toISOString(),
      reason: 'test',
      targetName: 'Target One',
      targetEmail: 'target@rsupport.com',
    },
  })
  const actor = resolveAuditActor(session)
  assert.equal(actor.userId, 'target-emp-1')
  assert.equal(actor.actorUserId, undefined)
})

run('session 이 null 이면 ANONYMOUS 로 귀속되고 throw 하지 않는다', () => {
  const actor = resolveAuditActor(null)
  assert.equal(actor.userId, 'ANONYMOUS')
  assert.equal(actor.actorUserId, undefined)
})

run('session 이 undefined 이면 ANONYMOUS 로 귀속되고 throw 하지 않는다', () => {
  const actor = resolveAuditActor(undefined)
  assert.equal(actor.userId, 'ANONYMOUS')
})

run('session 은 있으나 user 가 없으면 ANONYMOUS 로 귀속되고 throw 하지 않는다', () => {
  const actor = resolveAuditActor({} as AuthSession)
  assert.equal(actor.userId, 'ANONYMOUS')
})

console.log('resolveAuditActor tests completed')
