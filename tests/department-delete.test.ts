/* eslint-disable @typescript-eslint/no-require-imports */
import 'dotenv/config'
import './register-path-aliases'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { DeleteAdminDepartmentSchema } from '../src/lib/validations'

const { AppError } = require('../src/lib/utils') as typeof import('../src/lib/utils')
const {
  deleteDepartmentRecord,
} = require('../src/server/admin/google-account-management') as typeof import('../src/server/admin/google-account-management')

function read(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')
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

function createDepartmentDeletePrismaMock(options?: {
  current?: {
    id: string
    deptCode: string
    deptName: string
    parentDeptId: string | null
    leaderEmployeeId: string | null
    _count: {
      childDepts: number
      employees: number
      orgKpis: number
    }
  } | null
  deleteError?: Error
}) {
  const current =
    options && 'current' in options
      ? options.current
      : {
          id: 'dept-1',
          deptCode: 'HR',
          deptName: '인사운영',
          parentDeptId: null,
          leaderEmployeeId: 'leader-1',
          _count: {
            childDepts: 0,
            employees: 0,
            orgKpis: 0,
          },
        }

  const calls = {
    delete: [] as Array<unknown>,
  }

  const prismaMock = {
    department: {
      findUnique: async () => current,
      delete: async (args: unknown) => {
        calls.delete.push(args)
        if (options?.deleteError) {
          throw options.deleteError
        }
        return current
      },
    },
  }

  return { prismaMock, calls }
}

async function expectAppError(promise: Promise<unknown>, expectedCode: string, expectedStatus: number) {
  await assert.rejects(
    promise,
    (error: unknown) =>
      error instanceof AppError &&
      error.code === expectedCode &&
      error.statusCode === expectedStatus
  )
}

async function main() {
  await run('department delete UI is wired into the edit modal with confirm dialog and refresh flow', () => {
    const panelSource = read('src/components/admin/OrgMemberManagementPanel.tsx')

    assert.equal(panelSource.includes('data-testid="department-delete-button"'), true)
    assert.equal(panelSource.includes('data-testid="department-delete-dialog"'), true)
    assert.equal(panelSource.includes('data-testid="department-delete-name"'), true)
    assert.equal(panelSource.includes('data-testid="department-delete-cancel"'), true)
    assert.equal(panelSource.includes('data-testid="department-delete-confirm"'), true)
    assert.equal(panelSource.includes("method: 'DELETE'"), true)
    assert.equal(panelSource.includes('departmentId: editingDepartment.id'), true)
    assert.equal(panelSource.includes('confirmDelete: true'), true)
    assert.equal(panelSource.includes('departmentDeleteBlockedReason'), true)
    assert.equal(panelSource.includes('editingDepartmentChildCount > 0'), true)
    assert.equal(panelSource.includes('editingDepartment.memberCount > 0'), true)
    assert.equal(panelSource.includes('editingDepartment.orgKpiCount > 0'), true)
    assert.equal(panelSource.includes('props.onSelectDepartment(nextDepartmentId)'), true)
    assert.equal(panelSource.includes('closeDepartmentModal()'), true)
    assert.equal(panelSource.includes('await props.onRefresh()'), true)
    assert.equal(panelSource.includes('submitDepartment'), true)
    assert.equal(panelSource.includes('props.onOpenCreateEmployee'), true)
    assert.equal(panelSource.includes('props.onOpenUpload'), true)
  })

  await run('department delete route uses validation, authz, delete service, and audit logging', () => {
    const routeSource = read('src/app/api/admin/employees/google-account/departments/route.ts')

    assert.equal(routeSource.includes('DeleteAdminDepartmentSchema'), true)
    assert.equal(routeSource.includes("authorizeMenu('SYSTEM_SETTING')"), true)
    assert.equal(routeSource.includes('deleteDepartmentRecord'), true)
    assert.equal(routeSource.includes("action: 'DEPARTMENT_DELETE'"), true)
    assert.equal(routeSource.includes('export async function DELETE'), true)
  })

  await run('department delete schema requires explicit confirmation', () => {
    assert.equal(
      DeleteAdminDepartmentSchema.safeParse({
        departmentId: 'dept-1',
        confirmDelete: true,
      }).success,
      true
    )
    assert.equal(
      DeleteAdminDepartmentSchema.safeParse({
        departmentId: 'dept-1',
        confirmDelete: false,
      }).success,
      false
    )
  })

  await run('department delete service removes the record and returns deleted metadata', async () => {
    const { prismaMock, calls } = createDepartmentDeletePrismaMock()

    const result = await deleteDepartmentRecord(
      {
        departmentId: 'dept-1',
      },
      {
        prisma: prismaMock as any,
        recalculateLeadershipLinks: async () => ({ updatedCount: 3 }),
      }
    )

    assert.equal(result.deletedDepartment.id, 'dept-1')
    assert.equal(result.deletedDepartment.deptCode, 'HR')
    assert.equal(result.hierarchyUpdatedCount, 3)
    assert.equal(calls.delete.length, 1)
  })

  await run('department delete service rejects missing departments', async () => {
    const { prismaMock } = createDepartmentDeletePrismaMock({ current: null })

    await expectAppError(
      deleteDepartmentRecord(
        {
          departmentId: 'missing',
        },
        {
          prisma: prismaMock as any,
          recalculateLeadershipLinks: async () => ({ updatedCount: 0 }),
        }
      ),
      'DEPARTMENT_NOT_FOUND',
      404
    )
  })

  await run('department delete service blocks departments with child departments', async () => {
    const { prismaMock } = createDepartmentDeletePrismaMock({
      current: {
        id: 'dept-1',
        deptCode: 'HR',
        deptName: '인사운영',
        parentDeptId: null,
        leaderEmployeeId: null,
        _count: {
          childDepts: 2,
          employees: 0,
          orgKpis: 0,
        },
      },
    })

    await expectAppError(
      deleteDepartmentRecord(
        {
          departmentId: 'dept-1',
        },
        {
          prisma: prismaMock as any,
          recalculateLeadershipLinks: async () => ({ updatedCount: 0 }),
        }
      ),
      'DEPARTMENT_DELETE_BLOCKED',
      409
    )
  })

  await run('department delete service blocks departments with employees', async () => {
    const { prismaMock } = createDepartmentDeletePrismaMock({
      current: {
        id: 'dept-1',
        deptCode: 'HR',
        deptName: '인사운영',
        parentDeptId: null,
        leaderEmployeeId: null,
        _count: {
          childDepts: 0,
          employees: 4,
          orgKpis: 0,
        },
      },
    })

    await expectAppError(
      deleteDepartmentRecord(
        {
          departmentId: 'dept-1',
        },
        {
          prisma: prismaMock as any,
          recalculateLeadershipLinks: async () => ({ updatedCount: 0 }),
        }
      ),
      'DEPARTMENT_DELETE_BLOCKED',
      409
    )
  })

  await run('department delete service blocks departments referenced by org KPIs', async () => {
    const { prismaMock } = createDepartmentDeletePrismaMock({
      current: {
        id: 'dept-1',
        deptCode: 'HR',
        deptName: '인사운영',
        parentDeptId: null,
        leaderEmployeeId: null,
        _count: {
          childDepts: 0,
          employees: 0,
          orgKpis: 5,
        },
      },
    })

    await expectAppError(
      deleteDepartmentRecord(
        {
          departmentId: 'dept-1',
        },
        {
          prisma: prismaMock as any,
          recalculateLeadershipLinks: async () => ({ updatedCount: 0 }),
        }
      ),
      'DEPARTMENT_DELETE_BLOCKED',
      409
    )
  })

  await run('department delete service maps FK cleanup failures to a user-facing delete error', async () => {
    const { prismaMock } = createDepartmentDeletePrismaMock({
      deleteError: Object.assign(new Error('fk blocked'), { code: 'P2003' }),
    })

    await expectAppError(
      deleteDepartmentRecord(
        {
          departmentId: 'dept-1',
        },
        {
          prisma: prismaMock as any,
          recalculateLeadershipLinks: async () => ({ updatedCount: 0 }),
        }
      ),
      'DEPARTMENT_DELETE_REFERENCE_BLOCKED',
      409
    )
  })

  console.log('Department delete tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
