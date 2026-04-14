import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import './register-path-aliases'
import { resolveMenuFromPath } from '../src/lib/auth/permissions'
import {
  AdminMasterLoginPermissionSchema,
  AdminMasterLoginSchema,
} from '../src/lib/validations'
import {
  MASTER_LOGIN_PERMISSION_KEY,
  canUseMasterLogin,
  isFixedMasterLoginAccessSource,
  readMasterLoginConfig,
  resolveMasterLoginPermissionManagementState,
  resolveMasterLoginPermissionToggleState,
  resolveMasterLoginAccess,
} from '../src/lib/master-login'

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

run('master login permission allows owner, legacy admins, and granted HR admins only', () => {
  const env = {
    MASTER_LOGIN_OWNER_EMAIL: 'owner@rsupport.com',
    MASTER_LOGIN_ALLOWED_EMAILS: 'ops-admin@rsupport.com',
  }

  assert.deepEqual(
    resolveMasterLoginAccess(
      { role: 'ROLE_ADMIN', email: 'owner@rsupport.com', masterLoginPermissionGranted: false },
      env
    ),
    { allowed: true, source: 'owner' }
  )
  assert.deepEqual(
    resolveMasterLoginAccess(
      { role: 'ROLE_ADMIN', email: 'ops-admin@rsupport.com', masterLoginPermissionGranted: false },
      env
    ),
    { allowed: true, source: 'legacy_admin' }
  )
  assert.deepEqual(
    resolveMasterLoginAccess(
      { role: 'ROLE_ADMIN', email: 'hr-admin@rsupport.com', masterLoginPermissionGranted: true },
      env
    ),
    { allowed: true, source: 'granted_hr_admin' }
  )
  assert.equal(
    canUseMasterLogin(
      { role: 'ROLE_ADMIN', email: 'hr-admin@rsupport.com', masterLoginPermissionGranted: true },
      env
    ),
    true
  )
  assert.equal(
    canUseMasterLogin(
      { role: 'ROLE_ADMIN', email: 'hr-admin@rsupport.com', masterLoginPermissionGranted: false },
      env
    ),
    false
  )
  assert.equal(
    canUseMasterLogin(
      { role: 'ROLE_MEMBER', email: 'owner@rsupport.com', masterLoginPermissionGranted: true },
      env
    ),
    false
  )
})

run('master login permission management only blocks active impersonation sessions', () => {
  assert.deepEqual(
    resolveMasterLoginPermissionManagementState({
      isAuthenticated: true,
      hasActiveMasterLogin: false,
    }),
    {
      allowed: true,
      reason: 'NONE',
      message: null,
    }
  )

  assert.deepEqual(
    resolveMasterLoginPermissionManagementState({
      isAuthenticated: true,
      hasActiveMasterLogin: true,
    }),
    {
      allowed: false,
      reason: 'MASTER_LOGIN_ACTIVE',
      message:
        '마스터 로그인 진행 중에는 권한을 변경할 수 없습니다. 먼저 현재 세션을 종료해 주세요.',
    }
  )
})

run('master login permission toggle enables grantable HR admins and explains fixed accounts', () => {
  assert.equal(isFixedMasterLoginAccessSource('owner'), true)
  assert.equal(isFixedMasterLoginAccessSource('legacy_admin'), true)
  assert.equal(isFixedMasterLoginAccessSource('granted_hr_admin'), false)

  assert.deepEqual(
    resolveMasterLoginPermissionToggleState({
      isAuthenticated: true,
      hasActiveMasterLogin: false,
      accessSource: 'none',
      pending: false,
    }),
    {
      disabled: false,
      reason: 'NONE',
      message: null,
    }
  )

  assert.deepEqual(
    resolveMasterLoginPermissionToggleState({
      isAuthenticated: true,
      hasActiveMasterLogin: false,
      accessSource: 'owner',
      pending: false,
    }),
    {
      disabled: true,
      reason: 'FIXED_ACCESS_SOURCE',
      message: '소유자 또는 기본 허용 HR 관리자 계정은 여기에서 변경할 수 없습니다.',
    }
  )
})

run('master login schemas require preview reason and permission toggle payload', () => {
  assert.equal(
    AdminMasterLoginSchema.safeParse({
      targetEmployeeId: 'emp-1',
      reason: 'Need to verify a production issue through delegated admin access.',
    }).success,
    true
  )
  assert.equal(
    AdminMasterLoginSchema.safeParse({
      targetEmployeeId: '',
      reason: 'Need to verify a production issue through delegated admin access.',
    }).success,
    false
  )
  assert.equal(
    AdminMasterLoginPermissionSchema.safeParse({
      targetEmployeeId: 'emp-2',
      enabled: true,
    }).success,
    true
  )
  assert.equal(
    AdminMasterLoginPermissionSchema.safeParse({
      targetEmployeeId: '',
      enabled: false,
    }).success,
    false
  )
})

run('master login route, auth, service, and UI sources expose permission safeguards', () => {
  const routeSource = readFileSync(
    path.resolve(
      process.cwd(),
      'src/app/api/admin/employees/google-account/master-login/route.ts'
    ),
    'utf8'
  )
  const authSource = readFileSync(path.resolve(process.cwd(), 'src/lib/auth.ts'), 'utf8')
  const panelSource = readFileSync(
    path.resolve(process.cwd(), 'src/components/admin/MasterLoginAdminPanel.tsx'),
    'utf8'
  )
  const serviceSource = readFileSync(
    path.resolve(process.cwd(), 'src/server/master-login-permissions.ts'),
    'utf8'
  )
  const bannerSource = readFileSync(
    path.resolve(process.cwd(), 'src/components/layout/MasterLoginBanner.tsx'),
    'utf8'
  )

  assert.match(routeSource, /authorizeMenu\('SYSTEM_SETTING'\)/)
  assert.match(routeSource, /MASTER_LOGIN_PREVIEW/)
  assert.match(routeSource, /assertMasterLoginExecutionPermission/)
  assert.match(routeSource, /updateMasterLoginPermission/)
  assert.match(routeSource, /canManage: true/)

  assert.match(serviceSource, /MASTER_LOGIN_PERMISSION_KEY/)
  assert.match(serviceSource, /MASTER_LOGIN_PERMISSION_GRANTED/)
  assert.match(serviceSource, /MASTER_LOGIN_PERMISSION_REVOKED/)
  assert.match(serviceSource, /MASTER_LOGIN_PERMISSION_FIXED_ACCOUNT/)
  assert.match(serviceSource, /MASTER_LOGIN_FORBIDDEN/)
  assert.match(serviceSource, /MASTER_LOGIN_TARGET_NOT_FOUND/)
  assert.match(serviceSource, /resolveMasterLoginPermissionManagementState/)

  assert.match(authSource, /canUseMasterLoginForActor/)
  assert.match(authSource, /MASTER_LOGIN_STARTED/)
  assert.match(authSource, /MASTER_LOGIN_ENDED/)
  assert.match(authSource, /MASTER_LOGIN_EXPIRED/)
  assert.match(authSource, /createImpersonationSessionRecord/)
  assert.match(authSource, /endImpersonationSessionRecord/)

  assert.match(panelSource, /masterLoginPermissionGranted/)
  assert.match(panelSource, /type="checkbox"/)
  assert.match(panelSource, /resolveMasterLoginPermissionToggleState/)
  assert.match(panelSource, /resolveMasterLoginPermissionManagementState/)
  assert.match(panelSource, /title=\{toggleState\.message \?\? undefined\}/)
  assert.match(panelSource, /fetch\('\/api\/admin\/employees\/google-account\/master-login'/)

  assert.match(bannerSource, /IMPERSONATION_SYNC_STORAGE_KEY/)
})

run('master login API path stays under SYSTEM_SETTING authz', () => {
  assert.equal(
    resolveMenuFromPath('/api/admin/employees/google-account/master-login'),
    'SYSTEM_SETTING'
  )
})

run('master login permission key stays stable', () => {
  assert.equal(MASTER_LOGIN_PERMISSION_KEY, 'MASTER_LOGIN_ALLOWED')
})

console.log('Master login tests completed')
