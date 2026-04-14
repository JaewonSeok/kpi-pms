import assert from 'node:assert/strict'
import './register-path-aliases'
import { updateMasterLoginPermission } from '../src/server/master-login-permissions'
import { AppError } from '../src/lib/utils'

async function run(name: string, fn: () => Promise<void> | void) {
  try {
    await fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

const baseActor = {
  id: 'actor-1',
  name: '시스템 관리자',
  email: 'system-admin@rsupport.com',
  role: 'ROLE_ADMIN' as const,
  canManage: true,
  masterLoginActive: false,
}

const baseTarget = {
  id: 'target-1',
  empId: 'E-2001',
  empName: 'HR 관리자',
  gwsEmail: 'hr-admin@rsupport.com',
  role: 'ROLE_ADMIN' as const,
  masterLoginPermissionGranted: false,
}

function createDeps(overrides?: {
  target?: typeof baseTarget | null
  updatedTarget?: typeof baseTarget
}) {
  const auditEntries: Array<Record<string, unknown>> = []

  return {
    auditEntries,
    deps: {
      async loadTarget() {
        return overrides?.target === undefined ? baseTarget : overrides.target
      },
      async updateTarget(_targetEmployeeId: string, enabled: boolean) {
        return (
          overrides?.updatedTarget ?? {
            ...baseTarget,
            masterLoginPermissionGranted: enabled,
          }
        )
      },
      async createAuditEntry(payload: Record<string, unknown>) {
        auditEntries.push(payload)
      },
    },
  }
}

function expectAppError(code: string) {
  return (error: unknown) => error instanceof AppError && error.code === code
}

async function main() {
  await run('master login permission service grants permission and writes an audit log', async () => {
    const { deps, auditEntries } = createDeps()

    const result = await updateMasterLoginPermission(
      {
        actor: baseActor,
        targetEmployeeId: baseTarget.id,
        enabled: true,
        auditContext: {
          ipAddress: '127.0.0.1',
          userAgent: 'test',
        },
      },
      deps
    )

    assert.equal(result.targetUserId, baseTarget.id)
    assert.equal(result.enabled, true)
    assert.equal(result.accessSource, 'granted_hr_admin')
    assert.equal(result.effectiveAccess, true)
    assert.equal(auditEntries.length, 1)
    assert.equal(auditEntries[0]?.action, 'MASTER_LOGIN_PERMISSION_GRANTED')
  })

  await run('master login permission service revokes permission and writes an audit log', async () => {
    const grantedTarget = {
      ...baseTarget,
      masterLoginPermissionGranted: true,
    }
    const { deps, auditEntries } = createDeps({
      target: grantedTarget,
      updatedTarget: {
        ...grantedTarget,
        masterLoginPermissionGranted: false,
      },
    })

    const result = await updateMasterLoginPermission(
      {
        actor: baseActor,
        targetEmployeeId: grantedTarget.id,
        enabled: false,
        auditContext: {
          ipAddress: '127.0.0.1',
          userAgent: 'test',
        },
      },
      deps
    )

    assert.equal(result.enabled, false)
    assert.equal(result.accessSource, 'none')
    assert.equal(result.effectiveAccess, false)
    assert.equal(auditEntries[0]?.action, 'MASTER_LOGIN_PERMISSION_REVOKED')
  })

  await run('master login permission service rejects actors without management rights', async () => {
    const { deps } = createDeps()

    await assert.rejects(
      () =>
        updateMasterLoginPermission(
          {
            actor: {
              ...baseActor,
              canManage: false,
            },
            targetEmployeeId: baseTarget.id,
            enabled: true,
            auditContext: {},
          },
          deps
        ),
      expectAppError('MASTER_LOGIN_FORBIDDEN')
    )
  })

  await run('master login permission service rejects missing targets', async () => {
    const { deps } = createDeps({ target: null })

    await assert.rejects(
      () =>
        updateMasterLoginPermission(
          {
            actor: baseActor,
            targetEmployeeId: 'missing',
            enabled: true,
            auditContext: {},
          },
          deps
        ),
      expectAppError('MASTER_LOGIN_TARGET_NOT_FOUND')
    )
  })

  await run('master login permission service rejects fixed owner accounts', async () => {
    const previousOwnerEmail = process.env.MASTER_LOGIN_OWNER_EMAIL
    process.env.MASTER_LOGIN_OWNER_EMAIL = 'owner@rsupport.com'
    const { deps } = createDeps({
      target: {
        ...baseTarget,
        gwsEmail: 'owner@rsupport.com',
      },
    })

    try {
      await assert.rejects(
        () =>
          updateMasterLoginPermission(
            {
              actor: baseActor,
              targetEmployeeId: baseTarget.id,
              enabled: true,
              auditContext: {},
            },
            deps
          ),
        expectAppError('MASTER_LOGIN_PERMISSION_FIXED_ACCOUNT')
      )
    } finally {
      if (previousOwnerEmail === undefined) {
        delete process.env.MASTER_LOGIN_OWNER_EMAIL
      } else {
        process.env.MASTER_LOGIN_OWNER_EMAIL = previousOwnerEmail
      }
    }
  })

  await run('master login permission service rejects updates while master login is active', async () => {
    const { deps } = createDeps()

    await assert.rejects(
      () =>
        updateMasterLoginPermission(
          {
            actor: {
              ...baseActor,
              masterLoginActive: true,
            },
            targetEmployeeId: baseTarget.id,
            enabled: true,
            auditContext: {},
          },
          deps
        ),
      expectAppError('MASTER_LOGIN_PERMISSION_UPDATE_BLOCKED')
    )
  })

  console.log('Master login permission service tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
