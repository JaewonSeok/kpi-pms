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
}) {
  const current =
    options && 'current' in options
      ? options.current
      : {
          id: 'org-kpi-1',
          deptId: 'dept-1',
          evalYear: 2026,
          status: 'DRAFT' as const,
          kpiName: '매출 성장',
          parentOrgKpiId: 'parent-1',
          copiedFromOrgKpiId: 'source-1',
          _count: {
            personalKpis: 0,
            childOrgKpis: 2,
            clonedOrgKpis: 1,
          },
        }

  const calls = {
    updateMany: [] as Array<unknown>,
    delete: [] as Array<unknown>,
    auditCreate: [] as Array<unknown>,
  }

  const tx = {
    orgKpi: {
      updateMany: async (args: unknown) => {
        calls.updateMany.push(args)
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
  await run('org KPI delete button source is wired into the right detail action area with confirm dialog', () => {
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
    assert.equal(clientSource.includes('label="수정"'), true)
    assert.equal(clientSource.includes('label="복제"'), true)
    assert.equal(
      clientSource.includes("label={kpi.status === 'SUBMITTED' || kpi.status === 'LOCKED' ? '다시 열기' : '제출'}"),
      true
    )
    assert.equal(clientSource.includes('label="확정"'), true)
    assert.equal(clientSource.includes('label="잠금"'), true)
    assert.equal(clientSource.includes('label="보관"'), true)
    assert.equal(clientSource.includes('label="AI 개선"'), true)
  })

  await run('org KPI delete action state disables without selection and enables for deletable draft KPI', () => {
    const noSelection = getOrgKpiDeleteActionState({
      kpi: null,
      canManage: true,
      goalEditLocked: false,
    })
    const enabled = getOrgKpiDeleteActionState({
      kpi: {
        id: 'org-kpi-1',
        title: '매출 성장',
        status: 'DRAFT',
        linkedPersonalKpiCount: 0,
      },
      canManage: true,
      goalEditLocked: false,
    })

    assert.equal(noSelection.disabled, true)
    assert.equal(noSelection.code, 'TARGET_REQUIRED')
    assert.equal(enabled.disabled, false)
  })

  await run('org KPI delete action state blocks linked personal KPIs and read-only cycles', () => {
    const linked = getOrgKpiDeleteActionState({
      kpi: {
        id: 'org-kpi-1',
        title: '매출 성장',
        status: 'DRAFT',
        linkedPersonalKpiCount: 2,
      },
      canManage: true,
      goalEditLocked: false,
    })
    const lockedCycle = getOrgKpiDeleteActionState({
      kpi: {
        id: 'org-kpi-1',
        title: '매출 성장',
        status: 'DRAFT',
        linkedPersonalKpiCount: 0,
      },
      canManage: true,
      goalEditLocked: true,
    })

    assert.equal(linked.disabled, true)
    assert.equal(linked.code, 'LINKED_PERSONAL_KPI_BLOCKED')
    assert.equal(lockedCycle.disabled, true)
    assert.equal(lockedCycle.code, 'GOAL_EDIT_LOCKED')
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

  await run('org KPI delete service removes the record and safely detaches child and clone references', async () => {
    const { prismaMock, calls } = createDeletePrismaMock()

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
    assert.equal(calls.updateMany.length, 2)
    assert.equal(calls.delete.length, 1)
    assert.equal(calls.auditCreate.length, 1)

    const [childDetach, cloneDetach] = calls.updateMany as Array<{
      where: { parentOrgKpiId?: string; copiedFromOrgKpiId?: string }
      data: { parentOrgKpiId?: null; copiedFromOrgKpiId?: null }
    }>
    assert.equal(childDetach.where.parentOrgKpiId, 'org-kpi-1')
    assert.equal(childDetach.data.parentOrgKpiId, null)
    assert.equal(cloneDetach.where.copiedFromOrgKpiId, 'org-kpi-1')
    assert.equal(cloneDetach.data.copiedFromOrgKpiId, null)

    const auditPayload = calls.auditCreate[0] as {
      data: { action: string; entityType: string; entityId: string; newValue: { deleted: boolean } }
    }
    assert.equal(auditPayload.data.action, 'ORG_KPI_DELETED')
    assert.equal(auditPayload.data.entityType, 'OrgKpi')
    assert.equal(auditPayload.data.entityId, 'org-kpi-1')
    assert.equal(auditPayload.data.newValue.deleted, true)
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

  await run('org KPI delete service rejects non-draft workflow states', async () => {
    const { prismaMock } = createDeletePrismaMock({
      logs: [
        {
          action: 'ORG_KPI_SUBMITTED',
          timestamp: new Date('2026-04-14T10:00:00.000Z'),
        },
      ],
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
      'ORG_KPI_NOT_DELETABLE',
      409
    )
  })

  await run('org KPI delete service rejects linked personal KPI references', async () => {
    const { prismaMock } = createDeletePrismaMock({
      current: {
        id: 'org-kpi-1',
        deptId: 'dept-1',
        evalYear: 2026,
        status: 'DRAFT',
        kpiName: '매출 성장',
        parentOrgKpiId: null,
        copiedFromOrgKpiId: null,
        _count: {
          personalKpis: 1,
          childOrgKpis: 0,
          clonedOrgKpis: 0,
        },
      },
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
      'ORG_KPI_DELETE_BLOCKED',
      409
    )
  })

  await run('org KPI delete route is validated and wired to the shared server delete service', () => {
    const routeSource = read('src/app/api/kpi/org/[id]/route.ts')

    assert.equal(routeSource.includes('DeleteOrgKpiSchema'), true)
    assert.equal(routeSource.includes('deleteOrgKpiRecord'), true)
    assert.equal(routeSource.includes('export async function DELETE'), true)
    assert.equal(routeSource.includes("validated.error.issues[0]?.message ?? '삭제 확인이 필요합니다.'"), true)
  })

  console.log('Org KPI delete tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
