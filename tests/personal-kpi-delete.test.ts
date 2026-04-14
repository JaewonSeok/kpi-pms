/* eslint-disable @typescript-eslint/no-require-imports */
import 'dotenv/config'
import './register-path-aliases'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const { AppError } = require('../src/lib/utils') as typeof import('../src/lib/utils')
const {
  getPersonalKpiDeleteActionState,
  resolveNextPersonalKpiSelectionAfterDelete,
} = require('../src/lib/personal-kpi-delete') as typeof import('../src/lib/personal-kpi-delete')
const { deletePersonalKpiRecord } = require('../src/server/personal-kpi-delete') as typeof import('../src/server/personal-kpi-delete')

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

function createDeletePrismaMock(options?: {
  goalEditMode?: 'FULL' | 'CHECKIN_ONLY'
  current?: {
    id: string
    employeeId: string
    evalYear: number
    status: 'DRAFT' | 'CONFIRMED' | 'ARCHIVED'
    kpiName: string
    linkedOrgKpiId: string | null
    copiedFromPersonalKpiId: string | null
    employee: {
      deptId: string
      empName: string
    }
    _count: {
      monthlyRecords: number
      evaluationItems: number
      clonedPersonalKpis: number
    }
  } | null
  logs?: Array<{
    action: string
    timestamp: Date
    oldValue?: unknown
    newValue?: unknown
  }>
}) {
  const current =
    options && 'current' in options
      ? options.current
      : {
          id: 'personal-kpi-1',
          employeeId: 'emp-1',
          evalYear: 2026,
          status: 'DRAFT' as const,
          kpiName: '신규 고객 발굴',
          linkedOrgKpiId: 'org-kpi-1',
          copiedFromPersonalKpiId: 'source-kpi-1',
          employee: {
            deptId: 'dept-1',
            empName: '홍길동',
          },
          _count: {
            monthlyRecords: 0,
            evaluationItems: 0,
            clonedPersonalKpis: 2,
          },
        }

  const calls = {
    updateMany: [] as Array<unknown>,
    delete: [] as Array<unknown>,
    auditCreate: [] as Array<unknown>,
  }

  const tx = {
    personalKpi: {
      updateMany: async (args: unknown) => {
        calls.updateMany.push(args)
        return { count: current?._count.clonedPersonalKpis ?? 0 }
      },
      delete: async (args: unknown) => {
        calls.delete.push(args)
        if (!current) {
          throw new Error('delete should not run without a current personal KPI')
        }
        return {
          id: current.id,
          employeeId: current.employeeId,
          evalYear: current.evalYear,
          kpiName: current.kpiName,
        }
      },
    },
    auditLog: {
      create: async (args: unknown) => {
        calls.auditCreate.push(args)
        return args
      },
    },
  }

  const prismaMock = {
    personalKpi: {
      findUnique: async () => current,
    },
    auditLog: {
      findMany: async () => options?.logs ?? [],
    },
    department: {
      findUnique: async () => ({ orgId: 'org-1' }),
    },
    evalCycle: {
      findFirst: async () => ({
        goalEditMode: options?.goalEditMode ?? 'FULL',
      }),
    },
    $transaction: async <T>(callback: (transaction: typeof tx) => Promise<T>) => callback(tx),
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
  await run('personal KPI delete UI is wired into the right detail action area with confirm dialog', () => {
    const clientSource = read('src/components/kpi/PersonalKpiManagementClient.tsx')

    assert.equal(clientSource.includes('DeletePersonalKpiDialog'), true)
    assert.equal(clientSource.includes('testId="personal-kpi-delete-button"'), true)
    assert.equal(clientSource.includes('data-testid="personal-kpi-delete-dialog"'), true)
    assert.equal(clientSource.includes('data-testid="personal-kpi-delete-name"'), true)
    assert.equal(clientSource.includes('testId="personal-kpi-delete-cancel"'), true)
    assert.equal(clientSource.includes('testId="personal-kpi-delete-confirm"'), true)
    assert.equal(clientSource.includes('되돌릴 수 없습니다'), true)
    assert.equal(clientSource.includes("body: JSON.stringify({ confirmDelete: true })"), true)
    assert.equal(clientSource.includes('setMineItems(nextItems)'), true)
    assert.equal(clientSource.includes('resolveNextPersonalKpiSelectionAfterDelete'), true)
    assert.equal(clientSource.includes('수정'), true)
    assert.equal(clientSource.includes('복제'), true)
    assert.equal(clientSource.includes('data-testid="personal-kpi-submit-helper"'), true)
  })

  await run('personal KPI delete action state disables without selection and enables for deletable draft KPI', () => {
    const noSelection = getPersonalKpiDeleteActionState({
      kpi: null,
      canManage: true,
      goalEditLocked: false,
    })
    const enabled = getPersonalKpiDeleteActionState({
      kpi: {
        id: 'personal-kpi-1',
        title: '신규 고객 발굴',
        status: 'DRAFT',
        linkedMonthlyCount: 0,
        linkedEvaluationItemCount: 0,
      },
      canManage: true,
      goalEditLocked: false,
    })

    assert.equal(noSelection.disabled, true)
    assert.equal(noSelection.code, 'TARGET_REQUIRED')
    assert.equal(enabled.disabled, false)
  })

  await run('personal KPI delete action state blocks non-draft status, monthly records, and read-only cycles', () => {
    const nonDraft = getPersonalKpiDeleteActionState({
      kpi: {
        id: 'personal-kpi-1',
        title: '신규 고객 발굴',
        status: 'SUBMITTED',
        linkedMonthlyCount: 0,
      },
      canManage: true,
      goalEditLocked: false,
    })
    const linkedMonthly = getPersonalKpiDeleteActionState({
      kpi: {
        id: 'personal-kpi-1',
        title: '신규 고객 발굴',
        status: 'DRAFT',
        linkedMonthlyCount: 2,
      },
      canManage: true,
      goalEditLocked: false,
    })
    const lockedCycle = getPersonalKpiDeleteActionState({
      kpi: {
        id: 'personal-kpi-1',
        title: '신규 고객 발굴',
        status: 'DRAFT',
        linkedMonthlyCount: 0,
      },
      canManage: true,
      goalEditLocked: true,
    })

    assert.equal(nonDraft.disabled, true)
    assert.equal(nonDraft.code, 'STATUS_BLOCKED')
    assert.equal(linkedMonthly.disabled, true)
    assert.equal(linkedMonthly.code, 'MONTHLY_RECORD_BLOCKED')
    assert.equal(lockedCycle.disabled, true)
    assert.equal(lockedCycle.code, 'GOAL_EDIT_LOCKED')
  })

  await run('personal KPI delete selection resolver chooses the next surviving KPI or clears selection', () => {
    assert.equal(
      resolveNextPersonalKpiSelectionAfterDelete({
        currentItems: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
        deletedId: 'b',
      }),
      'c'
    )
    assert.equal(
      resolveNextPersonalKpiSelectionAfterDelete({
        currentItems: [{ id: 'a' }],
        deletedId: 'a',
      }),
      ''
    )
  })

  await run('personal KPI delete service removes the record and detaches clone references with audit log', async () => {
    const { prismaMock, calls } = createDeletePrismaMock()

    const result = await deletePersonalKpiRecord(
      {
        id: 'personal-kpi-1',
        actor: {
          id: 'emp-1',
          role: 'ROLE_MEMBER',
          deptId: 'dept-1',
          accessibleDepartmentIds: [],
        },
        clientInfo: {
          ipAddress: '127.0.0.1',
          userAgent: 'test-agent',
        },
      },
      { prisma: prismaMock as any }
    )

    assert.equal(result.deleted, true)
    assert.equal(result.id, 'personal-kpi-1')
    assert.equal(calls.updateMany.length, 1)
    assert.equal(calls.delete.length, 1)
    assert.equal(calls.auditCreate.length, 1)

    const auditPayload = calls.auditCreate[0] as {
      data: {
        action: string
        newValue: {
          deleted: boolean
          detachedCloneReferenceCount: number
        }
      }
    }
    assert.equal(auditPayload.data.action, 'PERSONAL_KPI_DELETED')
    assert.equal(auditPayload.data.newValue.deleted, true)
    assert.equal(auditPayload.data.newValue.detachedCloneReferenceCount, 2)
  })

  await run('personal KPI delete service blocks users outside the allowed scope', async () => {
    const { prismaMock } = createDeletePrismaMock({
      current: {
        id: 'personal-kpi-1',
        employeeId: 'emp-2',
        evalYear: 2026,
        status: 'DRAFT',
        kpiName: '신규 고객 발굴',
        linkedOrgKpiId: 'org-kpi-1',
        copiedFromPersonalKpiId: null,
        employee: {
          deptId: 'dept-2',
          empName: '김영희',
        },
        _count: {
          monthlyRecords: 0,
          evaluationItems: 0,
          clonedPersonalKpis: 0,
        },
      },
    })

    await expectAppError(
      deletePersonalKpiRecord(
        {
          id: 'personal-kpi-1',
          actor: {
            id: 'emp-1',
            role: 'ROLE_MEMBER',
            deptId: 'dept-1',
            accessibleDepartmentIds: [],
          },
          clientInfo: {},
        },
        { prisma: prismaMock as any }
      ),
      'FORBIDDEN',
      403
    )
  })

  await run('personal KPI delete service fails when the KPI does not exist', async () => {
    const { prismaMock } = createDeletePrismaMock({ current: null })

    await expectAppError(
      deletePersonalKpiRecord(
        {
          id: 'missing',
          actor: {
            id: 'emp-1',
            role: 'ROLE_MEMBER',
            deptId: 'dept-1',
            accessibleDepartmentIds: [],
          },
          clientInfo: {},
        },
        { prisma: prismaMock as any }
      ),
      'PERSONAL_KPI_NOT_FOUND',
      404
    )
  })

  await run('personal KPI delete service blocks non-draft and linked monthly record cases', async () => {
    const confirmedMock = createDeletePrismaMock({
      current: {
        id: 'personal-kpi-1',
        employeeId: 'emp-1',
        evalYear: 2026,
        status: 'CONFIRMED',
        kpiName: '신규 고객 발굴',
        linkedOrgKpiId: 'org-kpi-1',
        copiedFromPersonalKpiId: null,
        employee: {
          deptId: 'dept-1',
          empName: '홍길동',
        },
        _count: {
          monthlyRecords: 0,
          evaluationItems: 0,
          clonedPersonalKpis: 0,
        },
      },
    })

    await expectAppError(
      deletePersonalKpiRecord(
        {
          id: 'personal-kpi-1',
          actor: {
            id: 'emp-1',
            role: 'ROLE_MEMBER',
            deptId: 'dept-1',
            accessibleDepartmentIds: [],
          },
          clientInfo: {},
        },
        { prisma: confirmedMock.prismaMock as any }
      ),
      'PERSONAL_KPI_NOT_DELETABLE',
      409
    )

    const linkedMonthlyMock = createDeletePrismaMock({
      current: {
        id: 'personal-kpi-1',
        employeeId: 'emp-1',
        evalYear: 2026,
        status: 'DRAFT',
        kpiName: '신규 고객 발굴',
        linkedOrgKpiId: 'org-kpi-1',
        copiedFromPersonalKpiId: null,
        employee: {
          deptId: 'dept-1',
          empName: '홍길동',
        },
        _count: {
          monthlyRecords: 1,
          evaluationItems: 0,
          clonedPersonalKpis: 0,
        },
      },
    })

    await expectAppError(
      deletePersonalKpiRecord(
        {
          id: 'personal-kpi-1',
          actor: {
            id: 'emp-1',
            role: 'ROLE_MEMBER',
            deptId: 'dept-1',
            accessibleDepartmentIds: [],
          },
          clientInfo: {},
        },
        { prisma: linkedMonthlyMock.prismaMock as any }
      ),
      'PERSONAL_KPI_DELETE_BLOCKED',
      409
    )
  })

  await run('personal KPI delete route uses validation and the shared delete service', () => {
    const routeSource = read('src/app/api/kpi/personal/[id]/route.ts')

    assert.equal(routeSource.includes('export async function DELETE'), true)
    assert.equal(routeSource.includes('DeletePersonalKpiSchema'), true)
    assert.equal(routeSource.includes('deletePersonalKpiRecord'), true)
  })
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
