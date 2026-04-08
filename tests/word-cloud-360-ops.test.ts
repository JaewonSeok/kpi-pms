/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
import 'dotenv/config'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import Module from 'node:module'
import path from 'node:path'
import { prisma } from '../src/lib/prisma'

const moduleLoader = Module as unknown as {
  _resolveFilename: (
    request: string,
    parent: unknown,
    isMain: boolean,
    options: unknown
  ) => string
}
const originalResolveFilename = moduleLoader._resolveFilename
moduleLoader._resolveFilename = function patchedResolveFilename(request, parent, isMain, options) {
  if (request.startsWith('@/')) {
    request = path.resolve(process.cwd(), 'src', request.slice(2))
  }
  return originalResolveFilename.call(this, request, parent, isMain, options)
}

process.env.DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/kpi_pms_test'

const {
  applyWordCloud360TargetUpload,
  generateWordCloudComparisonReport,
  exportWordCloud360Results,
} = require('../src/server/word-cloud-360') as typeof import('../src/server/word-cloud-360')
const { parseExportReason, createExportAuditLog } = require('../src/lib/export-audit') as typeof import('../src/lib/export-audit')
const { WordCloud360CycleSchema } = require('../src/lib/validations') as typeof import('../src/lib/validations')
const {
  buildWordCloudCycleFormState,
  toWordCloudCyclePayload,
} = require('../src/lib/word-cloud-360-cycle-form') as typeof import('../src/lib/word-cloud-360-cycle-form')

type PrismaMethod = (...args: any[]) => any
type Snapshot = {
  employeeFindUnique: PrismaMethod
  employeeFindMany: PrismaMethod
  cycleFindUnique: PrismaMethod
  assignmentFindMany: PrismaMethod
  assignmentUpsert: PrismaMethod
  responseFindMany: PrismaMethod
  uploadHistoryCreate: PrismaMethod
  auditLogCreate: PrismaMethod
  transaction: PrismaMethod
}

function run(name: string, fn: () => void | Promise<void>) {
  try {
    const result = fn()
    if (result instanceof Promise) {
      return result.then(() => console.log(`PASS ${name}`))
    }
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

function buildCsvBuffer(rows: Array<Record<string, string>>, headers: string[]) {
  const escape = (value: string) => {
    if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
    return value
  }

  return Buffer.from(
    `\uFEFF${[headers.join(','), ...rows.map((row) => headers.map((header) => escape(row[header] ?? '')).join(','))].join('\r\n')}`,
    'utf8'
  )
}

function captureSnapshot(): Snapshot {
  const prismaAny = prisma as any
  return {
    employeeFindUnique: prismaAny.employee.findUnique,
    employeeFindMany: prismaAny.employee.findMany,
    cycleFindUnique: prismaAny.wordCloud360Cycle.findUnique,
    assignmentFindMany: prismaAny.wordCloud360Assignment.findMany,
    assignmentUpsert: prismaAny.wordCloud360Assignment.upsert,
    responseFindMany: prismaAny.wordCloud360Response.findMany,
    uploadHistoryCreate: prismaAny.uploadHistory.create,
    auditLogCreate: prismaAny.auditLog.create,
    transaction: prismaAny.$transaction,
  }
}

function restoreSnapshot(snapshot: Snapshot) {
  const prismaAny = prisma as any
  prismaAny.employee.findUnique = snapshot.employeeFindUnique
  prismaAny.employee.findMany = snapshot.employeeFindMany
  prismaAny.wordCloud360Cycle.findUnique = snapshot.cycleFindUnique
  prismaAny.wordCloud360Assignment.findMany = snapshot.assignmentFindMany
  prismaAny.wordCloud360Assignment.upsert = snapshot.assignmentUpsert
  prismaAny.wordCloud360Response.findMany = snapshot.responseFindMany
  prismaAny.uploadHistory.create = snapshot.uploadHistoryCreate
  prismaAny.auditLog.create = snapshot.auditLogCreate
  prismaAny.$transaction = snapshot.transaction
}

async function withWordCloudOpsContext(
  overrides: Partial<{
    actor: any
    employees: any[]
    cycle: any
    existingAssignments: any[]
    responses: any[]
    onUpsert: (args: any) => void
    onAuditCreate: (args: any) => void
  }>,
  fn: () => Promise<void>
) {
  const snapshot = captureSnapshot()
  const prismaAny = prisma as any

  prismaAny.employee.findUnique = async () =>
    overrides.actor ?? {
      id: 'admin-1',
      empId: 'ADM-001',
      empName: '관리자',
      role: 'ROLE_ADMIN',
      department: {
        id: 'dept-admin',
        deptName: '경영지원',
        orgId: 'org-1',
      },
    }

  prismaAny.employee.findMany = async () =>
    overrides.employees ?? [
      {
        id: 'mgr-1',
        empId: 'MGR-001',
        empName: 'Leader',
        deptId: 'dept-a',
        managerId: null,
        status: 'ACTIVE',
        department: { deptName: 'Dept A' },
      },
      {
        id: 'emp-1',
        empId: 'EMP-001',
        empName: 'Alice',
        deptId: 'dept-a',
        managerId: 'mgr-1',
        status: 'ACTIVE',
        department: { deptName: 'Dept A' },
      },
      {
        id: 'emp-2',
        empId: 'EMP-002',
        empName: 'Bob',
        deptId: 'dept-a',
        managerId: 'mgr-1',
        status: 'ACTIVE',
        department: { deptName: 'Dept A' },
      },
    ]

  prismaAny.wordCloud360Cycle.findUnique = async () =>
    overrides.cycle ?? {
      id: 'cycle-1',
      orgId: 'org-1',
      cycleName: '2026 Survey',
      resultPrivacyThreshold: 2,
      evaluatorGroups: ['MANAGER', 'PEER'],
    }

  prismaAny.wordCloud360Assignment.findMany = async () => overrides.existingAssignments ?? []
  prismaAny.wordCloud360Assignment.upsert = async (args: any) => {
    overrides.onUpsert?.(args)
    return args.create
  }
  prismaAny.wordCloud360Response.findMany = async () => overrides.responses ?? []
  prismaAny.uploadHistory.create = async () => ({ id: 'upload-1' })
  prismaAny.auditLog.create = async (args: any) => {
    overrides.onAuditCreate?.(args)
    return { id: 'audit-1', ...args.data }
  }
  prismaAny.$transaction = async (input: any) => {
    if (typeof input === 'function') return input(prismaAny)
    return Promise.all(input)
  }

  try {
    await fn()
  } finally {
    restoreSnapshot(snapshot)
  }
}

async function main() {
  await run('target upload applies valid rows and reports partial failures', async () => {
    const upserts: any[] = []

    await withWordCloudOpsContext(
      {
        existingAssignments: [
          {
            cycleId: 'cycle-1',
            evaluatorId: 'mgr-1',
            evaluateeId: 'emp-1',
            evaluatorGroup: 'MANAGER',
          },
        ],
        onUpsert: (args) => upserts.push(args),
      },
      async () => {
        const result = await applyWordCloud360TargetUpload({
          actorId: 'admin-1',
          cycleId: 'cycle-1',
          fileName: 'targets.csv',
          buffer: buildCsvBuffer(
            [
              { ignored: '', employeenumber: 'EMP-001' },
              { ignored: '', employeenumber: 'EMP-404' },
            ],
            ['ignored', 'employeenumber']
          ),
        })

        assert.equal(result.summary.totalRows, 2)
        assert.equal(result.summary.validRows, 1)
        assert.equal(result.summary.invalidRows, 1)
        assert.equal(result.summary.targetCount, 1)
        assert.equal(result.summary.createdAssignmentCount >= 1, true)
        assert.equal(result.summary.existingAssignmentCount >= 0, true)
        assert.equal(result.rows[0]?.valid, true)
        assert.equal(
          (result.rows[0]?.createdAssignmentCount ?? 0) + (result.rows[0]?.existingAssignmentCount ?? 0) >= 1,
          true
        )
        assert.equal(result.rows[1]?.valid, false)
        assert.equal(result.rows[1]?.issues.some((issue) => issue.field === 'employee_number'), true)
        assert.equal(
          upserts.length,
          result.summary.createdAssignmentCount + result.summary.existingAssignmentCount
        )
      }
    )
  })

  await run('comparison report compares departments and hides rows below anonymity threshold', async () => {
    await withWordCloudOpsContext(
      {
        responses: [
          {
            evaluateeId: 'emp-1',
            evaluatee: { department: { deptName: 'Dept A' } },
            status: 'SUBMITTED',
            items: [
              {
                evaluatorGroup: 'MANAGER',
                keywordId: 'p1',
                keywordTextSnapshot: '협업',
                polarity: 'POSITIVE',
                category: 'ATTITUDE',
              },
            ],
          },
          {
            evaluateeId: 'emp-2',
            evaluatee: { department: { deptName: 'Dept A' } },
            status: 'SUBMITTED',
            items: [
              {
                evaluatorGroup: 'PEER',
                keywordId: 'n1',
                keywordTextSnapshot: '지연',
                polarity: 'NEGATIVE',
                category: 'ABILITY',
              },
            ],
          },
        ],
      },
      async () => {
        const report = await generateWordCloudComparisonReport({
          actorId: 'admin-1',
          cycleId: 'cycle-1',
          fileName: 'baseline.csv',
          buffer: buildCsvBuffer(
            [
              {
                ignored: '',
                employeenumber: 'EMP-001',
                department: 'Dept A',
                responsecount: '2',
                thresholdmet: 'Y',
                polarity: 'POSITIVE',
                keyword: '협업',
                count: '1',
              },
              {
                ignored: '',
                employeenumber: 'EMP-003',
                department: '',
                responsecount: '1',
                thresholdmet: 'N',
                polarity: 'NEGATIVE',
                keyword: '침묵',
                count: '1',
              },
            ],
            ['ignored', 'employeenumber', 'department', 'responsecount', 'thresholdmet', 'polarity', 'keyword', 'count']
          ),
        })

        assert.equal(report.summary.hiddenBaselineRows, 1)
        assert.equal(report.summary.currentDepartmentCount, 1)
        assert.equal(report.departments.some((department) => department.department === 'Dept A'), true)
        assert.equal(report.departments[0]?.insight.length > 0, true)
      }
    )
  })

  await run('anonymity threshold schema accepts 3 to 10 only', () => {
    assert.equal(WordCloud360CycleSchema.safeParse({
      cycleName: 'cycle',
      positiveSelectionLimit: 10,
      negativeSelectionLimit: 10,
      resultPrivacyThreshold: 2,
      evaluatorGroups: ['MANAGER'],
      status: 'DRAFT',
    }).success, false)

    assert.equal(WordCloud360CycleSchema.safeParse({
      cycleName: 'cycle',
      positiveSelectionLimit: 10,
      negativeSelectionLimit: 10,
      resultPrivacyThreshold: 11,
      evaluatorGroups: ['MANAGER'],
      status: 'DRAFT',
    }).success, false)

    assert.equal(WordCloud360CycleSchema.safeParse({
      cycleName: 'cycle',
      positiveSelectionLimit: 10,
      negativeSelectionLimit: 10,
      resultPrivacyThreshold: 3,
      evaluatorGroups: ['MANAGER'],
      status: 'DRAFT',
    }).success, true)
  })

  await run('anonymous export blanks department when threshold is not met', async () => {
    await withWordCloudOpsContext(
      {
        responses: [
          {
            evaluateeId: 'emp-1',
            evaluatee: {
              empId: 'EMP-001',
              empName: 'Alice',
              department: { deptName: 'Dept A' },
            },
            status: 'SUBMITTED',
            items: [
              {
                evaluatorGroup: 'MANAGER',
                keywordId: 'p1',
                keywordTextSnapshot: '협업',
                polarity: 'POSITIVE',
                category: 'ATTITUDE',
              },
            ],
          },
          {
            evaluateeId: 'emp-2',
            evaluatee: {
              empId: 'EMP-002',
              empName: 'Bob',
              department: { deptName: 'Dept B' },
            },
            status: 'SUBMITTED',
            items: [
              {
                evaluatorGroup: 'MANAGER',
                keywordId: 'p1',
                keywordTextSnapshot: '협업',
                polarity: 'POSITIVE',
                category: 'ATTITUDE',
              },
            ],
          },
          {
            evaluateeId: 'emp-2',
            evaluatee: {
              empId: 'EMP-002',
              empName: 'Bob',
              department: { deptName: 'Dept B' },
            },
            status: 'SUBMITTED',
            items: [
              {
                evaluatorGroup: 'PEER',
                keywordId: 'n1',
                keywordTextSnapshot: '지연',
                polarity: 'NEGATIVE',
                category: 'ABILITY',
              },
            ],
          },
        ],
      },
      async () => {
        const exported = await exportWordCloud360Results({
          actorId: 'admin-1',
          cycleId: 'cycle-1',
          format: 'csv',
        })

        const lines = exported.body.toString('utf8').trim().split(/\r?\n/)
        const aliceLine = lines.find((line) => line.includes('EMP-001'))
        const bobLine = lines.find((line) => line.includes('EMP-002'))

        assert.equal(Boolean(aliceLine), true)
        assert.equal(Boolean(bobLine), true)
        assert.equal((aliceLine ?? '').split(',')[3], '')
        assert.equal((bobLine ?? '').split(',')[3], 'Dept B')
      }
    )
  })

  await run('export reason parser validates and audit log stores reason', async () => {
    assert.throws(() => parseExportReason('짧음'), /다운로드 사유/)
    assert.equal(parseExportReason('조직별 서베이 비교 보고서 작성'), '조직별 서베이 비교 보고서 작성')

    const auditCalls: any[] = []
    await withWordCloudOpsContext(
      {
        onAuditCreate: (args) => auditCalls.push(args),
      },
      async () => {
        await createExportAuditLog({
          userId: 'admin-1',
          entityType: 'WORD_CLOUD_360_CYCLE',
          entityId: 'cycle-1',
          action: 'EXPORT_WORD_CLOUD_360_RESULTS',
          reason: '조직별 비교 리포트 검토',
          format: 'xlsx',
          extra: { menuKey: 'WORD_CLOUD_360' },
        })
      }
    )

    assert.equal(auditCalls.length, 1)
    assert.equal(auditCalls[0]?.data?.newValue?.reason, '조직별 비교 리포트 검토')
    assert.equal(auditCalls[0]?.data?.newValue?.format, 'xlsx')
  })

  await run('cycle schema accepts blank cycleId for create mode', () => {
    const result = WordCloud360CycleSchema.safeParse({
      cycleId: '',
      evalCycleId: '',
      cycleName: '2026 상반기 워드클라우드',
      startDate: '',
      endDate: '',
      positiveSelectionLimit: 10,
      negativeSelectionLimit: 10,
      resultPrivacyThreshold: 3,
      evaluatorGroups: ['MANAGER', 'PEER'],
      notes: '',
      status: 'DRAFT',
    })

    assert.equal(result.success, true)
    if (result.success) {
      assert.equal(result.data.cycleId, undefined)
    }
  })

  await run('cycle form helper keeps localized display values separate from ISO payload values', () => {
    const formState = buildWordCloudCycleFormState({
      id: 'cycle-1',
      evalCycleId: 'eval-1',
      cycleName: '2026 상반기 워드클라우드 360',
      startDate: '2026-04-07T08:33:00.000Z',
      endDate: '2026-04-08T09:15:00.000Z',
      positiveSelectionLimit: 10,
      negativeSelectionLimit: 10,
      resultPrivacyThreshold: 3,
      evaluatorGroups: ['MANAGER', 'PEER'],
      notes: '',
      status: 'DRAFT',
    })

    assert.equal(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(formState.startDate), true)
    assert.equal(formState.startDate.includes('오후'), false)

    const payload = toWordCloudCyclePayload(formState)
    assert.equal(payload.cycleId, 'cycle-1')
    assert.equal(payload.evalCycleId, 'eval-1')
    assert.equal(typeof payload.startDate, 'string')
    assert.equal(typeof payload.endDate, 'string')
    assert.equal(String(payload.startDate).includes('오후'), false)
    assert.equal(String(payload.startDate).includes('T'), true)
    assert.equal(String(payload.startDate).endsWith('Z'), true)
  })

  await run('survey workspace source wires upload endpoints and export reason modal', () => {
    const clientSource = readFileSync(
      path.resolve(process.cwd(), 'src/components/evaluation/wordcloud360/WordCloud360WorkspaceClient.tsx'),
      'utf8'
    )
    const actionRouteSource = readFileSync(
      path.resolve(process.cwd(), 'src/app/api/evaluation/word-cloud-360/actions/route.ts'),
      'utf8'
    )
    const exportRouteSource = readFileSync(
      path.resolve(process.cwd(), 'src/app/api/evaluation/word-cloud-360/export/[cycleId]/route.ts'),
      'utf8'
    )

    assert.equal(clientSource.includes('/api/evaluation/word-cloud-360/targets/upload'), true)
    assert.equal(clientSource.includes('/api/evaluation/word-cloud-360/comparison/upload'), true)
    assert.equal(clientSource.includes('다운로드 사유 입력'), true)
    assert.equal(clientSource.includes('과거/현재 서베이 비교'), true)
    assert.equal(clientSource.includes('const hasSelectedCycle = Boolean(data.selectedCycleId)'), true)
    assert.equal(clientSource.includes('const isCreateMode = Boolean(data.permissions?.canManage && !hasSelectedCycle)'), true)
    assert.equal(clientSource.includes('updateCycle(savedCycle.id)'), true)
    assert.equal(clientSource.includes('buildWordCloudCycleFormState(data.adminView?.cycle)'), true)
    assert.equal(clientSource.includes("toWordCloudCyclePayload(cycleForm)"), true)
    assert.equal(clientSource.includes('Invalid ISO datetime'), true)
    assert.equal(clientSource.includes('!hasSelectedCycle ? ('), true)
    assert.equal(actionRouteSource.includes('getCycleValidationMessage'), true)
    assert.equal(actionRouteSource.includes('연결할 PMS 평가 주기를 선택해 주세요.'), true)
    assert.equal(exportRouteSource.includes('parseExportReason'), true)
    assert.equal(exportRouteSource.includes('createExportAuditLog'), true)
  })
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
