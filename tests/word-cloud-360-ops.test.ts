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
  revertWordCloud360FinalSubmit,
  restoreWordCloud360ResponseFromHistory,
  saveWordCloud360Response,
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
  assignmentFindUnique: PrismaMethod
  assignmentUpsert: PrismaMethod
  assignmentUpdate: PrismaMethod
  responseFindMany: PrismaMethod
  responseUpdate: PrismaMethod
  responseCreate: PrismaMethod
  responseItemDeleteMany: PrismaMethod
  responseItemCreateMany: PrismaMethod
  keywordFindMany: PrismaMethod
  auditLogFindFirst: PrismaMethod
  auditLogFindMany: PrismaMethod
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
    assignmentFindUnique: prismaAny.wordCloud360Assignment.findUnique,
    assignmentUpsert: prismaAny.wordCloud360Assignment.upsert,
    assignmentUpdate: prismaAny.wordCloud360Assignment.update,
    responseFindMany: prismaAny.wordCloud360Response.findMany,
    responseUpdate: prismaAny.wordCloud360Response.update,
    responseCreate: prismaAny.wordCloud360Response.create,
    responseItemDeleteMany: prismaAny.wordCloud360ResponseItem.deleteMany,
    responseItemCreateMany: prismaAny.wordCloud360ResponseItem.createMany,
    keywordFindMany: prismaAny.wordCloud360Keyword.findMany,
    auditLogFindFirst: prismaAny.auditLog.findFirst,
    auditLogFindMany: prismaAny.auditLog.findMany,
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
  prismaAny.wordCloud360Assignment.findUnique = snapshot.assignmentFindUnique
  prismaAny.wordCloud360Assignment.upsert = snapshot.assignmentUpsert
  prismaAny.wordCloud360Assignment.update = snapshot.assignmentUpdate
  prismaAny.wordCloud360Response.findMany = snapshot.responseFindMany
  prismaAny.wordCloud360Response.update = snapshot.responseUpdate
  prismaAny.wordCloud360Response.create = snapshot.responseCreate
  prismaAny.wordCloud360ResponseItem.deleteMany = snapshot.responseItemDeleteMany
  prismaAny.wordCloud360ResponseItem.createMany = snapshot.responseItemCreateMany
  prismaAny.wordCloud360Keyword.findMany = snapshot.keywordFindMany
  prismaAny.auditLog.findFirst = snapshot.auditLogFindFirst
  prismaAny.auditLog.findMany = snapshot.auditLogFindMany
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
    assignmentRecord: any
    responses: any[]
    keywords: any[]
    latestAuditLog: any
    auditLogs: any[]
    onUpsert: (args: any) => void
    onAssignmentUpdate: (args: any) => void
    onResponseUpdate: (args: any) => void
    onResponseCreate: (args: any) => void
    onResponseItemDeleteMany: (args: any) => void
    onResponseItemCreateMany: (args: any) => void
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
  prismaAny.wordCloud360Assignment.findUnique = async () => overrides.assignmentRecord ?? null
  prismaAny.wordCloud360Assignment.upsert = async (args: any) => {
    overrides.onUpsert?.(args)
    return args.create
  }
  prismaAny.wordCloud360Assignment.update = async (args: any) => {
    overrides.onAssignmentUpdate?.(args)
    return { id: args.where.id, ...args.data }
  }
  prismaAny.wordCloud360Response.findMany = async () => overrides.responses ?? []
  prismaAny.wordCloud360Response.update = async (args: any) => {
    overrides.onResponseUpdate?.(args)
    return { id: args.where.id, ...args.data }
  }
  prismaAny.wordCloud360Response.create = async (args: any) => {
    overrides.onResponseCreate?.(args)
    return { id: 'response-1', ...args.data }
  }
  prismaAny.wordCloud360ResponseItem.deleteMany = async (args: any) => {
    overrides.onResponseItemDeleteMany?.(args)
    return { count: 0 }
  }
  prismaAny.wordCloud360ResponseItem.createMany = async (args: any) => {
    overrides.onResponseItemCreateMany?.(args)
    return { count: args.data?.length ?? 0 }
  }
  prismaAny.wordCloud360Keyword.findMany = async () =>
    overrides.keywords ?? [
      { id: 'p1', orgId: 'org-1', polarity: 'POSITIVE', category: 'ATTITUDE', keyword: '협업' },
      { id: 'n1', orgId: 'org-1', polarity: 'NEGATIVE', category: 'ABILITY', keyword: '지연' },
    ]
  prismaAny.auditLog.findFirst = async () => overrides.latestAuditLog ?? null
  prismaAny.auditLog.findMany = async () => overrides.auditLogs ?? []
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

  await run('draft save and final submit audits store restorable selection snapshots', async () => {
    const draftAuditCalls: any[] = []
    const submitAuditCalls: any[] = []

    await withWordCloudOpsContext(
      {
        actor: {
          id: 'emp-1',
          empId: 'EMP-001',
          empName: 'Alice',
          role: 'ROLE_MEMBER',
          department: {
            id: 'dept-a',
            deptName: 'Dept A',
            orgId: 'org-1',
          },
        },
        assignmentRecord: {
          id: 'assign-1',
          cycleId: 'cycle-1',
          evaluatorId: 'emp-1',
          evaluateeId: 'emp-2',
          status: 'IN_PROGRESS',
          draftSavedAt: new Date('2026-04-10T09:00:00.000Z'),
          cycle: {
            id: 'cycle-1',
            orgId: 'org-1',
            status: 'OPEN',
            positiveSelectionLimit: 10,
            negativeSelectionLimit: 10,
          },
          evaluatorGroup: 'PEER',
          response: {
            id: 'response-1',
            status: 'DRAFT',
            submittedAt: null,
            items: [],
          },
        },
        keywords: [{ id: 'p1', orgId: 'org-1', polarity: 'POSITIVE', category: 'ATTITUDE', keyword: '업무 몰입' }],
        onAuditCreate: (args) => draftAuditCalls.push(args),
      },
      async () => {
        await saveWordCloud360Response({
          actorId: 'emp-1',
          input: {
            assignmentId: 'assign-1',
            positiveKeywordIds: ['p1'],
            negativeKeywordIds: [],
            submitFinal: false,
          },
        })
      }
    )

    assert.equal(draftAuditCalls[draftAuditCalls.length - 1]?.data?.action, 'SAVE_WORD_CLOUD_360_RESPONSE_DRAFT')
    assert.equal(draftAuditCalls[draftAuditCalls.length - 1]?.data?.newValue?.positiveSelections?.[0]?.keywordId, 'p1')
    assert.equal(draftAuditCalls[draftAuditCalls.length - 1]?.data?.newValue?.negativeSelections?.length, 0)
    assert.equal(draftAuditCalls[draftAuditCalls.length - 1]?.data?.newValue?.nextStatus, 'IN_PROGRESS')

    await withWordCloudOpsContext(
      {
        actor: {
          id: 'emp-1',
          empId: 'EMP-001',
          empName: 'Alice',
          role: 'ROLE_MEMBER',
          department: {
            id: 'dept-a',
            deptName: 'Dept A',
            orgId: 'org-1',
          },
        },
        assignmentRecord: {
          id: 'assign-1',
          cycleId: 'cycle-1',
          evaluatorId: 'emp-1',
          evaluateeId: 'emp-2',
          status: 'IN_PROGRESS',
          draftSavedAt: new Date('2026-04-10T09:00:00.000Z'),
          cycle: {
            id: 'cycle-1',
            orgId: 'org-1',
            status: 'OPEN',
            positiveSelectionLimit: 10,
            negativeSelectionLimit: 10,
          },
          evaluatorGroup: 'PEER',
          response: {
            id: 'response-1',
            status: 'DRAFT',
            submittedAt: null,
            items: [
              {
                keywordId: 'p1',
                keywordTextSnapshot: '업무 몰입',
                polarity: 'POSITIVE',
                category: 'ATTITUDE',
                evaluatorGroup: 'PEER',
              },
            ],
          },
        },
        onAuditCreate: (args) => submitAuditCalls.push(args),
      },
      async () => {
        await saveWordCloud360Response({
          actorId: 'emp-1',
          input: {
            assignmentId: 'assign-1',
            positiveKeywordIds: ['p1'],
            negativeKeywordIds: ['n1'],
            submitFinal: true,
          },
        })
      }
    )

    assert.equal(submitAuditCalls[submitAuditCalls.length - 1]?.data?.action, 'SUBMIT_WORD_CLOUD_360_RESPONSE')
    assert.equal(submitAuditCalls[submitAuditCalls.length - 1]?.data?.newValue?.positiveSelections?.[0]?.keywordId, 'p1')
    assert.equal(submitAuditCalls[submitAuditCalls.length - 1]?.data?.newValue?.negativeSelections?.[0]?.keywordId, 'n1')
    assert.equal(submitAuditCalls[submitAuditCalls.length - 1]?.data?.newValue?.nextStatus, 'SUBMITTED')
  })

  await run('admin can revert final submitted response to in-progress and keep audit metadata', async () => {
    const assignmentUpdates: any[] = []
    const responseUpdates: any[] = []
    const auditCalls: any[] = []

    await withWordCloudOpsContext(
      {
        assignmentRecord: {
          id: 'assign-1',
          cycleId: 'cycle-1',
          evaluatorId: 'emp-1',
          evaluateeId: 'emp-2',
          status: 'SUBMITTED',
          draftSavedAt: new Date('2026-04-10T07:00:00.000Z'),
          cycle: {
            id: 'cycle-1',
            orgId: 'org-1',
            status: 'PUBLISHED',
          },
          evaluator: { id: 'emp-1', empName: 'Alice' },
          evaluatee: { id: 'emp-2', empName: 'Bob' },
          response: {
            id: 'response-1',
            status: 'SUBMITTED',
            submittedAt: new Date('2026-04-10T08:00:00.000Z'),
            items: [
              {
                keywordId: 'p1',
                keywordTextSnapshot: '업무 몰입',
                polarity: 'POSITIVE',
                category: 'ATTITUDE',
                evaluatorGroup: 'PEER',
              },
              {
                keywordId: 'n1',
                keywordTextSnapshot: '지원 부족',
                polarity: 'NEGATIVE',
                category: 'ABILITY',
                evaluatorGroup: 'PEER',
              },
            ],
          },
        },
        onAssignmentUpdate: (args) => assignmentUpdates.push(args),
        onResponseUpdate: (args) => responseUpdates.push(args),
        onAuditCreate: (args) => auditCalls.push(args),
      },
      async () => {
        const result = await revertWordCloud360FinalSubmit({
          actorId: 'admin-1',
          input: {
            assignmentId: 'assign-1',
            reason: '평가자 요청으로 응답을 다시 열어 수정',
          },
        })

        assert.equal(result.assignmentId, 'assign-1')
        assert.equal(result.previousStatus, 'SUBMITTED')
        assert.equal(result.nextStatus, 'IN_PROGRESS')
        assert.equal(result.responseStatus, 'DRAFT')
      }
    )

    assert.equal(responseUpdates[0]?.data?.status, 'DRAFT')
    assert.equal(responseUpdates[0]?.data?.submittedAt, null)
    assert.equal(assignmentUpdates[0]?.data?.status, 'IN_PROGRESS')
    assert.equal(assignmentUpdates[0]?.data?.submittedAt, null)
    assert.equal(auditCalls.length, 1)
    assert.equal(auditCalls[0]?.data?.action, 'WORD_CLOUD_360_FINAL_SUBMIT_REVERTED')
    assert.equal(auditCalls[0]?.data?.newValue?.eventType, 'wordcloud_final_submit_reverted')
    assert.equal(auditCalls[0]?.data?.newValue?.previousStatus, 'SUBMITTED')
    assert.equal(auditCalls[0]?.data?.newValue?.nextStatus, 'IN_PROGRESS')
    assert.equal(auditCalls[0]?.data?.newValue?.targetResponseId, 'response-1')
    assert.equal(auditCalls[0]?.data?.newValue?.targetEvaluatorId, 'emp-1')
    assert.equal(auditCalls[0]?.data?.newValue?.positiveSelections?.[0]?.keywordId, 'p1')
    assert.equal(auditCalls[0]?.data?.newValue?.negativeSelections?.[0]?.keywordId, 'n1')
    assert.equal(auditCalls[0]?.data?.newValue?.reason, '평가자 요청으로 응답을 다시 열어 수정')
  })

  await run('revert final submit is blocked for non-admin actors', async () => {
    await withWordCloudOpsContext(
      {
        actor: {
          id: 'emp-1',
          empId: 'EMP-001',
          empName: '일반 사용자',
          role: 'ROLE_MEMBER',
          department: {
            id: 'dept-a',
            deptName: 'Dept A',
            orgId: 'org-1',
          },
        },
        assignmentRecord: {
          id: 'assign-1',
          cycleId: 'cycle-1',
          evaluatorId: 'emp-1',
          evaluateeId: 'emp-2',
          status: 'SUBMITTED',
          cycle: {
            id: 'cycle-1',
            orgId: 'org-1',
            status: 'PUBLISHED',
          },
          evaluator: { id: 'emp-1', empName: 'Alice' },
          evaluatee: { id: 'emp-2', empName: 'Bob' },
          response: {
            id: 'response-1',
            status: 'SUBMITTED',
            submittedAt: new Date('2026-04-10T08:00:00.000Z'),
            items: [{ keywordId: 'p1' }],
          },
        },
      },
      async () => {
        await assert.rejects(
          () =>
            revertWordCloud360FinalSubmit({
              actorId: 'emp-1',
              input: {
                assignmentId: 'assign-1',
                reason: '권한 없는 사용자의 취소 시도',
              },
            }),
          /최종 제출 취소 권한이 없습니다\./
        )
      }
    )
  })

  await run('admin can restore a response from history and keep audit metadata', async () => {
    const assignmentUpdates: any[] = []
    const responseUpdates: any[] = []
    const deletedItems: any[] = []
    const createdItems: any[] = []
    const auditCalls: any[] = []

    await withWordCloudOpsContext(
      {
        assignmentRecord: {
          id: 'assign-1',
          cycleId: 'cycle-1',
          evaluatorId: 'emp-1',
          evaluateeId: 'emp-2',
          status: 'SUBMITTED',
          draftSavedAt: new Date('2026-04-10T07:00:00.000Z'),
          cycle: {
            id: 'cycle-1',
            orgId: 'org-1',
            status: 'PUBLISHED',
          },
          evaluator: { id: 'emp-1', empName: 'Alice' },
          evaluatee: { id: 'emp-2', empName: 'Bob' },
          response: {
            id: 'response-1',
            status: 'SUBMITTED',
            submittedAt: new Date('2026-04-10T08:00:00.000Z'),
            items: [
              {
                keywordId: 'p1',
                keywordTextSnapshot: '현재 긍정',
                polarity: 'POSITIVE',
                category: 'ATTITUDE',
                evaluatorGroup: 'PEER',
              },
              {
                keywordId: 'n1',
                keywordTextSnapshot: '현재 부정',
                polarity: 'NEGATIVE',
                category: 'ABILITY',
                evaluatorGroup: 'PEER',
              },
            ],
          },
        },
        auditLogs: [
          {
            id: 'audit-restore-target',
            userId: 'emp-1',
            action: 'SUBMIT_WORD_CLOUD_360_RESPONSE',
            entityType: 'WORD_CLOUD_360_RESPONSE',
            entityId: 'response-1',
            oldValue: {},
            newValue: {
              actorUserId: 'emp-1',
              previousStatus: 'IN_PROGRESS',
              nextStatus: 'SUBMITTED',
              responseStatus: 'SUBMITTED',
              positiveCount: 1,
              negativeCount: 1,
              positiveSelections: [
                {
                  keywordId: 'p-old',
                  keyword: '이전 긍정',
                  category: 'ATTITUDE',
                  polarity: 'POSITIVE',
                  evaluatorGroup: 'PEER',
                },
              ],
              negativeSelections: [
                {
                  keywordId: 'n-old',
                  keyword: '이전 부정',
                  category: 'ABILITY',
                  polarity: 'NEGATIVE',
                  evaluatorGroup: 'PEER',
                },
              ],
            },
            timestamp: new Date('2026-04-10T07:30:00.000Z'),
          },
        ],
        onAssignmentUpdate: (args) => assignmentUpdates.push(args),
        onResponseUpdate: (args) => responseUpdates.push(args),
        onResponseItemDeleteMany: (args) => deletedItems.push(args),
        onResponseItemCreateMany: (args) => createdItems.push(args),
        onAuditCreate: (args) => auditCalls.push(args),
      },
      async () => {
        const result = await restoreWordCloud360ResponseFromHistory({
          actorId: 'admin-1',
          input: {
            assignmentId: 'assign-1',
            revisionId: 'audit-restore-target',
            reason: '이전 제출 기준으로 다시 평가할 수 있게 복원',
          },
        })

        assert.equal(result.assignmentId, 'assign-1')
        assert.equal(result.restoredFromRevisionId, 'audit-restore-target')
        assert.equal(result.nextStatus, 'IN_PROGRESS')
        assert.equal(result.responseStatus, 'DRAFT')
      }
    )

    assert.equal(deletedItems[0]?.where?.responseId, 'response-1')
    assert.equal(createdItems[0]?.data?.[0]?.keywordId, 'p-old')
    assert.equal(createdItems[0]?.data?.[1]?.keywordId, 'n-old')
    assert.equal(responseUpdates[0]?.data?.status, 'DRAFT')
    assert.equal(assignmentUpdates[0]?.data?.status, 'IN_PROGRESS')
    assert.equal(auditCalls[0]?.data?.action, 'WORD_CLOUD_360_RESPONSE_RESTORED')
    assert.equal(auditCalls[0]?.data?.newValue?.restoredFromRevisionId, 'audit-restore-target')
    assert.equal(auditCalls[0]?.data?.newValue?.positiveSelections?.[0]?.keywordId, 'p-old')
  })

  await run('restore response history is blocked for non-admin actors', async () => {
    await withWordCloudOpsContext(
      {
        actor: {
          id: 'emp-1',
          empId: 'EMP-001',
          empName: 'Alice',
          role: 'ROLE_MEMBER',
          department: {
            id: 'dept-a',
            deptName: 'Dept A',
            orgId: 'org-1',
          },
        },
        assignmentRecord: {
          id: 'assign-1',
          cycleId: 'cycle-1',
          evaluatorId: 'emp-1',
          evaluateeId: 'emp-2',
          status: 'SUBMITTED',
          cycle: {
            id: 'cycle-1',
            orgId: 'org-1',
            status: 'PUBLISHED',
          },
          evaluator: { id: 'emp-1', empName: 'Alice' },
          evaluatee: { id: 'emp-2', empName: 'Bob' },
          response: {
            id: 'response-1',
            status: 'SUBMITTED',
            submittedAt: new Date('2026-04-10T08:00:00.000Z'),
            items: [],
          },
        },
        auditLogs: [
          {
            id: 'audit-restore-target',
            userId: 'emp-1',
            action: 'SUBMIT_WORD_CLOUD_360_RESPONSE',
            entityType: 'WORD_CLOUD_360_RESPONSE',
            entityId: 'response-1',
            oldValue: {},
            newValue: {
              actorUserId: 'emp-1',
              previousStatus: 'IN_PROGRESS',
              nextStatus: 'SUBMITTED',
              responseStatus: 'SUBMITTED',
              positiveSelections: [],
              negativeSelections: [],
            },
            timestamp: new Date('2026-04-10T07:30:00.000Z'),
          },
        ],
      },
      async () => {
        await assert.rejects(
          () =>
            restoreWordCloud360ResponseFromHistory({
              actorId: 'emp-1',
              input: {
                assignmentId: 'assign-1',
                revisionId: 'audit-restore-target',
                reason: '권한 없는 복원 시도',
              },
            }),
          /관리자|권한|沅뚰븳/
        )
      }
    )
  })

  await run('reopened draft can be submitted again outside the normal open window', async () => {
    const assignmentUpdates: any[] = []
    const responseUpdates: any[] = []
    const auditCalls: any[] = []

    await withWordCloudOpsContext(
      {
        actor: {
          id: 'emp-1',
          empId: 'EMP-001',
          empName: 'Alice',
          role: 'ROLE_MEMBER',
          department: {
            id: 'dept-a',
            deptName: 'Dept A',
            orgId: 'org-1',
          },
        },
        assignmentRecord: {
          id: 'assign-1',
          cycleId: 'cycle-1',
          evaluatorId: 'emp-1',
          evaluateeId: 'emp-2',
          status: 'IN_PROGRESS',
          draftSavedAt: new Date('2026-04-10T09:00:00.000Z'),
          cycle: {
            id: 'cycle-1',
            orgId: 'org-1',
            status: 'PUBLISHED',
            positiveSelectionLimit: 10,
            negativeSelectionLimit: 10,
          },
          response: {
            id: 'response-1',
            status: 'DRAFT',
            submittedAt: null,
            items: [{ keywordId: 'p1' }, { keywordId: 'n1' }],
          },
        },
        latestAuditLog: {
          id: 'audit-reopen-1',
          action: 'WORD_CLOUD_360_FINAL_SUBMIT_REVERTED',
        },
        onAssignmentUpdate: (args) => assignmentUpdates.push(args),
        onResponseUpdate: (args) => responseUpdates.push(args),
        onAuditCreate: (args) => auditCalls.push(args),
      },
      async () => {
        await saveWordCloud360Response({
          actorId: 'emp-1',
          input: {
            assignmentId: 'assign-1',
            positiveKeywordIds: ['p1'],
            negativeKeywordIds: ['n1'],
            submitFinal: true,
          },
        })
      }
    )

    assert.equal(responseUpdates[0]?.data?.status, 'SUBMITTED')
    assert.equal(assignmentUpdates[0]?.data?.status, 'SUBMITTED')
    assert.equal(auditCalls[auditCalls.length - 1]?.data?.action, 'SUBMIT_WORD_CLOUD_360_RESPONSE')
  })

  await run('non-reopened draft stays blocked when the cycle is not open', async () => {
    await withWordCloudOpsContext(
      {
        actor: {
          id: 'emp-1',
          empId: 'EMP-001',
          empName: 'Alice',
          role: 'ROLE_MEMBER',
          department: {
            id: 'dept-a',
            deptName: 'Dept A',
            orgId: 'org-1',
          },
        },
        assignmentRecord: {
          id: 'assign-1',
          cycleId: 'cycle-1',
          evaluatorId: 'emp-1',
          evaluateeId: 'emp-2',
          status: 'IN_PROGRESS',
          cycle: {
            id: 'cycle-1',
            orgId: 'org-1',
            status: 'PUBLISHED',
            positiveSelectionLimit: 10,
            negativeSelectionLimit: 10,
          },
          response: {
            id: 'response-1',
            status: 'DRAFT',
            submittedAt: null,
            items: [{ keywordId: 'p1' }],
          },
        },
        latestAuditLog: null,
      },
      async () => {
        await assert.rejects(
          () =>
            saveWordCloud360Response({
              actorId: 'emp-1',
              input: {
                assignmentId: 'assign-1',
                positiveKeywordIds: ['p1'],
                negativeKeywordIds: ['n1'],
                submitFinal: false,
              },
            }),
          /현재 주기는 응답 작성 기간이 아닙니다\./
        )
      }
    )
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
    assert.equal(clientSource.includes('최종 제출 취소'), true)
    assert.equal(clientSource.includes('최종 제출을 취소하면 평가자가 다시 응답을 수정하고 제출할 수 있습니다.'), true)
    assert.equal(clientSource.includes('제출 이력'), true)
    assert.equal(clientSource.includes('이 시점으로 되돌리기'), true)
    assert.equal(clientSource.includes("'revertFinalSubmit'"), true)
    assert.equal(clientSource.includes("'restoreResponseRevision'"), true)
    assert.equal(actionRouteSource.includes('getCycleValidationMessage'), true)
    assert.equal(actionRouteSource.includes('연결할 PMS 평가 주기를 선택해 주세요.'), true)
    assert.equal(actionRouteSource.includes("case 'revertFinalSubmit'"), true)
    assert.equal(actionRouteSource.includes('WordCloud360RevertResponseSchema'), true)
    assert.equal(actionRouteSource.includes("case 'restoreResponseRevision'"), true)
    assert.equal(actionRouteSource.includes('WordCloud360RestoreResponseSchema'), true)
    assert.equal(actionRouteSource.includes('restoreWordCloud360ResponseFromHistory'), true)
    assert.equal(actionRouteSource.includes("actionName: 'REOPEN_RECORD'"), true)
    assert.equal(exportRouteSource.includes('parseExportReason'), true)
    assert.equal(exportRouteSource.includes('createExportAuditLog'), true)
  })
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
