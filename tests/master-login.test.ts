import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import './register-path-aliases'
import { resolveMenuFromPath } from '../src/lib/auth/permissions'
import { AdminMasterLoginSchema } from '../src/lib/validations'
import { canUseMasterLogin, readMasterLoginConfig } from '../src/lib/master-login'

function run(name: string, fn: () => void) {
  try {
    fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

run('master login config accepts owner and allowed admin emails', () => {
  const config = readMasterLoginConfig({
    MASTER_LOGIN_OWNER_EMAIL: 'owner@rsupport.com',
    MASTER_LOGIN_ALLOWED_EMAILS: 'admin1@rsupport.com, admin2@rsupport.com',
  })

  assert.equal(config.ownerEmail, 'owner@rsupport.com')
  assert.equal(config.allowedEmailSet.has('owner@rsupport.com'), true)
  assert.equal(config.allowedEmailSet.has('admin1@rsupport.com'), true)
  assert.equal(config.allowedEmailSet.has('admin2@rsupport.com'), true)
})

run('master login config falls back to ADMIN_EMAIL when owner email is omitted', () => {
  const config = readMasterLoginConfig({
    ADMIN_EMAIL: 'fallback@rsupport.com',
  })

  assert.equal(config.ownerEmail, 'fallback@rsupport.com')
  assert.equal(config.enabled, true)
})

run('master login permission requires ROLE_ADMIN and configured email', () => {
  const env = {
    MASTER_LOGIN_OWNER_EMAIL: 'owner@rsupport.com',
    MASTER_LOGIN_ALLOWED_EMAILS: 'ops-admin@rsupport.com',
  }

  assert.equal(
    canUseMasterLogin({ role: 'ROLE_ADMIN', email: 'owner@rsupport.com' }, env),
    true
  )
  assert.equal(
    canUseMasterLogin({ role: 'ROLE_ADMIN', email: 'ops-admin@rsupport.com' }, env),
    true
  )
  assert.equal(
    canUseMasterLogin({ role: 'ROLE_MEMBER', email: 'owner@rsupport.com' }, env),
    false
  )
  assert.equal(
    canUseMasterLogin({ role: 'ROLE_ADMIN', email: 'other@rsupport.com' }, env),
    false
  )
})

run('master login request schema requires a target employee id', () => {
  assert.equal(AdminMasterLoginSchema.safeParse({ targetEmployeeId: 'emp-1' }).success, true)
  assert.equal(AdminMasterLoginSchema.safeParse({ targetEmployeeId: '' }).success, false)
})

run('master login route, auth, and shell sources expose read-only guardrails', () => {
  const routeSource = readFileSync(
    path.resolve(
      process.cwd(),
      'src/app/api/admin/employees/google-account/master-login/route.ts'
    ),
    'utf8'
  )
  const authSource = readFileSync(path.resolve(process.cwd(), 'src/lib/auth.ts'), 'utf8')
  const middlewareSource = readFileSync(path.resolve(process.cwd(), 'src/middleware.ts'), 'utf8')
  const registrationClientSource = readFileSync(
    path.resolve(process.cwd(), 'src/components/admin/GoogleAccountRegistrationClient.tsx'),
    'utf8'
  )
  const bannerSource = readFileSync(
    path.resolve(process.cwd(), 'src/components/layout/MasterLoginBanner.tsx'),
    'utf8'
  )

  assert.match(routeSource, /authorizeMenu\('SYSTEM_SETTING'\)/)
  assert.match(routeSource, /MASTER_LOGIN_FORBIDDEN/)
  assert.match(routeSource, /MASTER_LOGIN_PREVIEW/)
  assert.match(authSource, /MASTER_LOGIN_STARTED/)
  assert.match(authSource, /MASTER_LOGIN_ENDED/)
  assert.match(authSource, /trigger === 'update'/)
  assert.match(authSource, /masterLoginAvailable/)
  assert.match(middlewareSource, /MASTER_LOGIN_READ_ONLY/)
  assert.match(registrationClientSource, /마스터 로그인/)
  assert.match(bannerSource, /마스터 로그인 중입니다\./)
  assert.match(bannerSource, /읽기 전용/)
  assert.match(bannerSource, /종료/)
})

run('master login API path stays under SYSTEM_SETTING authz', () => {
  assert.equal(
    resolveMenuFromPath('/api/admin/employees/google-account/master-login'),
    'SYSTEM_SETTING'
  )
})

console.log('Master login tests completed')
