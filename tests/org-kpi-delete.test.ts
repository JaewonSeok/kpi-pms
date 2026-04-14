/* eslint-disable @typescript-eslint/no-require-imports */
import 'dotenv/config'
import './register-path-aliases'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
const { AppError } = require('../src/lib/utils') as typeof import('../src/lib/utils')
const {
  getOrgKpiDeleteActionState,
  resolveNextOrgKpiSelectionAfterDelete,
} = require('../src/lib/org-kpi-delete') as typeof import('../src/lib/org-kpi-delete')
const { deleteOrgKpiRecord } = require('../src/server/org-kpi-delete') as typeof import('../src/server/org-kpi-delete')

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
  actorInScope?: boolean
  goalEditMode?: 'FULL' | 'CHECKIN_ONLY'
  current?: {
    id: string
    deptId: string
    evalYear: number
    status: 'DRAFT' | 'CONFIRMED' | 'ARCHIVED'
    kpiName: string
    parentOrgKpiId: string | null
    copiedFromOrgKpiId: string | null
    _count: {
      personalKpis: number
      childOrgKpis: number
      clonedOrgKpis: number
    }
  } | null
  logs?: Array<{
    action: string
    timestamp: Date
    oldValue?: unknown
    newValue?: unknown
  }>
  transactionError?: Error
}) {
  const current =
    options && 'current' in options
      ? options.current
      : {
          id: 'org-kpi-1',
          deptId: 'dept-1',
          evalYear: 2026,
          status: 'ARCHIVED' as const,
          kpiName: '매출 성장',
          parentOrgKpiId: 'parent-1',
          copiedFromOrgKpiId: 'source-1',
          _count: {
            personalKpis: 3,
            childOrgKpis: 2,
            clonedOrgKpis: 1,
          },
        }

  const calls = {
    orgUpdateMany: [] as Array<unknown>,
    personalUpdateMany: [] as Array<unknown>,
    delete: [] as Array<unknown>,
    auditCreate: [] as Array<unknown>,
  }

  const tx = {
    orgKpi: {
      updateMany: async (args: unknown) => {
        calls.orgUpdateMany.push(args)
        const where = (args as { where?: { parentOrgKpiId?: string; copiedFromOrgKpiId?: string } }).where ?? {}
        if (where.parentOrgKpiId) {
          return { count: current?._count.childOrgKpis ?? 0 }
        }
        if (where.copiedFromOrgKpiId) {
          return { count: current?._count.clonedOrgKpis ?? 0 }
        }
        return { count: 0 }
      },
      delete: async (args: unknown) => {
        calls.delete.push(args)
        if (!current) {
          throw new Error('delete should not run without a current org KPI')
        }
        return {
          id: current.id,
          kpiName: current.kpiName,
          deptId: current.deptId,
          evalYear: current.evalYear,
        }
      },
    },
    personalKpi: {
      updateMany: async (args: unknown) => {
        calls.personalUpdateMany.push(args)
        return { count: current?._count.personalKpis ?? 0 }
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
    orgKpi: {
      findUnique: async () => current,
    },
    auditLog: {
      findMany: async () => options?.logs ?? [],
    },
    department: {
      findUnique: async () =>
        options?.actorInScope === false
          ? { orgId: 'org-1' }
          : { orgId: 'org-1' },
    },
    evalCycle: {
      findFirst: async () => ({
        goalEditMode: options?.goalEditMode ?? 'CHECKIN_ONLY',
      }),
    },
    $transaction: async <T>(callback: (transaction: typeof tx) => Promise<T>) => {
      if (options?.transactionError) {
        throw options.transactionError
      }
      return callback(tx)
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
  await run('org KPI delete button source stays in the detail action area with confirm dialog and refresh flow', () => {
    const clientSource = read('src/components/kpi/OrgKpiManagementClient.tsx')

    assert.equal(clientSource.includes('DeleteOrgKpiDialog'), true)
    assert.equal(clientSource.includes('testId="org-kpi-delete-button"'), true)
    assert.equal(clientSource.includes('data-testid="org-kpi-delete-dialog"'), true)
    assert.equal(clientSource.includes('data-testid="org-kpi-delete-name"'), true)
    assert.equal(clientSource.includes('testId="org-kpi-delete-cancel"'), true)
    assert.equal(clientSource.includes('testId="org-kpi-delete-confirm"'), true)
    assert.equal(clientSource.includes('되돌릴 수 없습니다'), true)
    assert.equal(clientSource.includes("body: JSON.stringify({ confirmDelete: true })"), true)
    assert.equal(clientSource.includes('setList((current) => current.filter((item) => item.id !== selectedKpi.id))'), true)
    assert.equal(clientSource.includes('setSelectedKpiId(nextSelectedId)'), true)
    assert.equal(clientSource.includes('resolveNextOrgKpiSelectionAfterDelete'), true)
    assert.equal(clientSource.includes('router.replace(`/kpi/org'), true)
    assert.equal(clientSource.includes('label="수정"'), true)
    assert.equal(clientSource.includes('label="복제"'), true)
    assert.equal(clientSource.includes('label="삭제"'), true)
    assert.equal(clientSource.includes('label="AI 개선"'), true)
  })

  await run('org KPI delete action state disables only when no KPI is selected', () => {
    const noSelection = getOrgKpiDeleteActionState({
      kpi: null,
      canManage: false,
      goalEditLocked: true,
      busy: true,
    })

    const statuses: Array<'DRAFT' | 'SUBMITTED' | 'CONFIRMED' | 'LOCKED' | 'ARCHIVED'> = [
      'DRAFT',
      'SUBMITTED',
      'CONFIRMED',
      'LOCKED',
      'ARCHIVED',
    ]

    for (const status of statuses) {
      const state = getOrgKpiDeleteActionState({
        kpi: {
          id: `org-kpi-${status}`,
          title: `${status} KPI`,
          status,
          linkedPersonalKpiCount: 4,
        },
        canManage: false,
        goalEditLocked: true,
        busy: true,
      })

      assert.equal(state.disabled, false)
    }

    assert.equal(noSelection.disabled, true)
    assert.equal(noSelection.code, 'TARGET_REQUIRED')
  })

  await run('org KPI delete selection resolver chooses the next surviving KPI or clears selection', () => {
    assert.equal(
      resolveNextOrgKpiSelectionAfterDelete({
        currentItems: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
        deletedId: 'b',
      }),
      'c'
    )
    assert.equal(
      resolveNextOrgKpiSelectionAfterDelete({
        currentItems: [{ id: 'a' }],
        deletedId: 'a',
      }),
      ''
    )
  })

  await run('org KPI delete service force deletes archived goals and detaches child, clone, and personal links first', async () => {
    const { prismaMock, calls } = createDeletePrismaMock({
      logs: [
        {
          action: 'ORG_KPI_SUBMITTED',
          timestamp: new Date('2026-04-14T10:00:00.000Z'),
        },
      ],
    })

    const result = await deleteOrgKpiRecord(
      {
        id: 'org-kpi-1',
        actor: {
          id: 'emp-1',
          role: 'ROLE_ADMIN',
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
    assert.equal(result.id, 'org-kpi-1')
    assert.equal(result.detachedChildOrgKpiCount, 2)
    assert.equal(result.detachedCloneReferenceCount, 1)
    assert.equal(result.detachedLinkedPersonalKpiCount, 3)
    assert.equal(calls.orgUpdateMany.length, 2)
    assert.equal(calls.personalUpdateMany.length, 1)
    assert.equal(calls.delete.length, 1)
    assert.equal(calls.auditCreate.length, 1)

    const [childDetach, cloneDetach] = calls.orgUpdateMany as Array<{
      where: { parentOrgKpiId?: string; copiedFromOrgKpiId?: string }
      data: { parentOrgKpiId?: null; copiedFromOrgKpiId?: null }
    }>
    const personalDetach = calls.personalUpdateMany[0] as {
      where: { linkedOrgKpiId?: string }
      data: { linkedOrgKpiId?: null }
    }

    assert.equal(childDetach.where.parentOrgKpiId, 'org-kpi-1')
    assert.equal(childDetach.data.parentOrgKpiId, null)
    assert.equal(cloneDetach.where.copiedFromOrgKpiId, 'org-kpi-1')
    assert.equal(cloneDetach.data.copiedFromOrgKpiId, null)
    assert.equal(personalDetach.where.linkedOrgKpiId, 'org-kpi-1')
    assert.equal(personalDetach.data.linkedOrgKpiId, null)

    const auditPayload = calls.auditCreate[0] as {
      data: {
        action: string
        entityType: string
        entityId: string
        newValue: {
          deleted: boolean
          forceDelete: boolean
          detachedLinkedPersonalKpiCount: number
        }
      }
    }
    assert.equal(auditPayload.data.action, 'ORG_KPI_DELETED')
    assert.equal(auditPayload.data.entityType, 'OrgKpi')
    assert.equal(auditPayload.data.entityId, 'org-kpi-1')
    assert.equal(auditPayload.data.newValue.deleted, true)
    assert.equal(auditPayload.data.newValue.forceDelete, true)
    assert.equal(auditPayload.data.newValue.detachedLinkedPersonalKpiCount, 3)
  })

  await run('org KPI delete service rejects unauthorized actors', async () => {
    const { prismaMock } = createDeletePrismaMock()

    await expectAppError(
      deleteOrgKpiRecord(
        {
          id: 'org-kpi-1',
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

  await run('org KPI delete service rejects missing KPIs', async () => {
    const { prismaMock } = createDeletePrismaMock({
      current: null,
    })

    await expectAppError(
      deleteOrgKpiRecord(
        {
          id: 'missing-org-kpi',
          actor: {
            id: 'emp-1',
            role: 'ROLE_ADMIN',
            deptId: 'dept-1',
            accessibleDepartmentIds: [],
          },
          clientInfo: {},
        },
        { prisma: prismaMock as any }
      ),
      'ORG_KPI_NOT_FOUND',
      404
    )
  })

  await run('org KPI delete service reports referential cleanup failures with a force delete specific error', async () => {
    const { prismaMock } = createDeletePrismaMock({
      transactionError: Object.assign(new Error('fk failure'), { code: 'P2003' }),
    })

    await expectAppError(
      deleteOrgKpiRecord(
        {
          id: 'org-kpi-1',
          actor: {
            id: 'emp-1',
            role: 'ROLE_ADMIN',
            deptId: 'dept-1',
            accessibleDepartmentIds: [],
          },
          clientInfo: {},
        },
        { prisma: prismaMock as any }
      ),
      'ORG_KPI_DELETE_REFERENCE_CLEANUP_FAILED',
      409
    )
  })

  await run('org KPI delete route is validated and wired to the shared server delete service', () => {
    const routeSource = read('src/app/api/kpi/org/[id]/route.ts')

    assert.equal(routeSource.includes('DeleteOrgKpiSchema'), true)
    assert.equal(routeSource.includes('deleteOrgKpiRecord'), true)
    assert.equal(routeSource.includes('export async function DELETE'), true)
    assert.equal(routeSource.includes('validated.error.issues[0]?.message'), true)
  })

  console.log('Org KPI delete tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
