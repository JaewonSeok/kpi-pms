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

const { getEvaluationAppealPageData } = require('../src/server/evaluation-appeal') as typeof import('../src/server/evaluation-appeal')

function read(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')
}

async function run(name: string, fn: () => Promise<void> | void) {
  try {
    await fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

type PrismaDelegateMethod = (...args: any[]) => any

type AppealSnapshot = {
  employeeFindUnique: PrismaDelegateMethod
  departmentFindUnique: PrismaDelegateMethod
  evalCycleFindMany: PrismaDelegateMethod
  evaluationFindFirst: PrismaDelegateMethod
  appealFindMany: PrismaDelegateMethod
  gradeSettingFindMany: PrismaDelegateMethod
  auditLogFindMany: PrismaDelegateMethod
}

function captureSnapshot(): AppealSnapshot {
  const prismaAny = prisma as any
  return {
    employeeFindUnique: prismaAny.employee.findUnique,
    departmentFindUnique: prismaAny.department.findUnique,
    evalCycleFindMany: prismaAny.evalCycle.findMany,
    evaluationFindFirst: prismaAny.evaluation.findFirst,
    appealFindMany: prismaAny.appeal.findMany,
    gradeSettingFindMany: prismaAny.gradeSetting.findMany,
    auditLogFindMany: prismaAny.auditLog.findMany,
  }
}

function restoreSnapshot(snapshot: AppealSnapshot) {
  const prismaAny = prisma as any
  prismaAny.employee.findUnique = snapshot.employeeFindUnique
  prismaAny.department.findUnique = snapshot.departmentFindUnique
  prismaAny.evalCycle.findMany = snapshot.evalCycleFindMany
  prismaAny.evaluation.findFirst = snapshot.evaluationFindFirst
  prismaAny.appeal.findMany = snapshot.appealFindMany
  prismaAny.gradeSetting.findMany = snapshot.gradeSettingFindMany
  prismaAny.auditLog.findMany = snapshot.auditLogFindMany
}

function makeSession(overrides?: Partial<any>) {
  return {
    user: {
      id: 'emp-1',
      email: 'member1@rsupport.com',
      name: 'Member One',
      role: 'ROLE_MEMBER',
      empId: 'EMP-001',
      position: 'STAFF',
      deptId: 'dept-1',
      deptName: 'Business Ops',
      accessibleDepartmentIds: ['dept-1'],
      ...overrides,
    },
  } as any
}

function makeEmployee(id: string, role = 'ROLE_MEMBER') {
  return {
    id,
    empId: id.toUpperCase(),
    empName: id === 'admin-1' ? 'Admin One' : 'Member One',
    role,
    deptId: 'dept-1',
    department: {
      id: 'dept-1',
      deptName: 'Business Ops',
      orgId: 'org-1',
      organization: {
        id: 'org-1',
        name: 'RSUPPORT',
      },
    },
  }
}

function makeCycle(overrides?: Partial<any>) {
  return {
    id: 'cycle-2026',
    orgId: 'org-1',
    evalYear: 2026,
    cycleName: '2026 상반기 평가',
    status: 'RESULT_OPEN',
    resultOpenStart: new Date('2026-03-01T09:00:00.000Z'),
    appealDeadline: new Date('2026-04-15T18:00:00.000Z'),
    ...overrides,
  }
}

function makeAppeal(id: string, overrides?: Partial<any>) {
  return {
    id,
    reason: `${id} 사유`,
    status: 'UNDER_REVIEW',
    adminResponse: null,
    resolvedAt: null,
    createdAt: new Date('2026-03-10T09:00:00.000Z'),
    updatedAt: new Date('2026-03-11T10:00:00.000Z'),
    ...overrides,
  }
}

function makeEvaluation(overrides?: Partial<any>) {
  return {
    id: 'eval-1',
    gradeId: 'grade-a',
    totalScore: 87,
    evalStage: 'FINAL',
    evaluator: {
      empName: 'Leader One',
    },
    items: [],
    appeals: [],
    ...overrides,
  }
}

async function withStubbedAppealData(
  overrides: Partial<Record<keyof AppealSnapshot, PrismaDelegateMethod>>,
  fn: () => Promise<void>
) {
  const snapshot = captureSnapshot()
  const prismaAny = prisma as any

  prismaAny.employee.findUnique =
    overrides.employeeFindUnique ??
    (async ({ where }: { where: { id: string } }) =>
      where.id === 'admin-1' ? makeEmployee('admin-1', 'ROLE_ADMIN') : makeEmployee(where.id)
    )

  prismaAny.department.findUnique =
    overrides.departmentFindUnique ??
    (async () => ({
      id: 'dept-1',
      deptName: 'Business Ops',
      orgId: 'org-1',
      organization: {
        id: 'org-1',
        name: 'RSUPPORT',
      },
    }))

  prismaAny.evalCycle.findMany =
    overrides.evalCycleFindMany ??
    (async () => [makeCycle()])

  prismaAny.evaluation.findFirst =
    overrides.evaluationFindFirst ??
    (async () =>
      makeEvaluation({
        appeals: [makeAppeal('appeal-1', { status: 'UNDER_REVIEW' })],
      }))

  prismaAny.appeal.findMany =
    overrides.appealFindMany ??
    (async () => [
      {
        ...makeAppeal('appeal-1', { status: 'UNDER_REVIEW' }),
        appealer: { empName: 'Member One' },
        evaluation: {
          ...makeEvaluation(),
          target: {
            empName: 'Member One',
            department: { deptName: 'Business Ops' },
          },
        },
      },
    ])

  prismaAny.gradeSetting.findMany =
    overrides.gradeSettingFindMany ??
    (async () => [
      {
        id: 'grade-a',
        gradeName: 'A',
        minScore: 85,
        maxScore: 100,
      },
    ])

  prismaAny.auditLog.findMany = overrides.auditLogFindMany ?? (async () => [])

  try {
    await fn()
  } finally {
    restoreSnapshot(snapshot)
  }
}

async function main() {
  await run('self user with no evaluation result gets no-result-yet instead of error', async () => {
    await withStubbedAppealData(
      {
        evaluationFindFirst: async () => null,
      },
      async () => {
        const data = await getEvaluationAppealPageData({
          session: makeSession(),
          cycleId: 'cycle-2026',
        })

        assert.equal(data.state, 'no-result-yet')
        assert.equal(data.selectedCycleId, 'cycle-2026')
        assert.notEqual(data.message, '이의 신청 정보를 불러오지 못했습니다.')
      }
    )
  })

  await run('closed appeal window becomes window-closed instead of hidden or error', async () => {
    await withStubbedAppealData(
      {
        evalCycleFindMany: async () => [
          makeCycle({
            appealDeadline: new Date('2026-03-01T00:00:00.000Z'),
          }),
        ],
        evaluationFindFirst: async () => null,
      },
      async () => {
        const data = await getEvaluationAppealPageData({
          session: makeSession(),
          cycleId: 'cycle-2026',
        })

        assert.equal(data.state, 'window-closed')
      }
    )
  })

  await run('caseId=new keeps a fresh draft open even when older appeals exist', async () => {
    await withStubbedAppealData(
      {
        evaluationFindFirst: async () =>
          makeEvaluation({
            appeals: [
              makeAppeal('appeal-1', {
                status: 'UNDER_REVIEW',
              }),
            ],
          }),
        auditLogFindMany: async (args?: any) => {
          if (args?.where?.entityType === 'AppealDraft') {
            return [
              {
                id: 'draft-log-1',
                entityId: 'eval-1',
                action: 'APPEAL_DRAFT_SAVED',
                userId: 'emp-1',
                oldValue: { status: 'DRAFT' },
                newValue: {
                  status: 'DRAFT',
                  reason: '새 초안 사유입니다.',
                  category: '점수 이의',
                  requestedAction: '재검토 요청',
                  relatedTargets: ['최종 등급'],
                  attachments: [],
                },
                timestamp: new Date('2026-03-27T10:00:00.000Z'),
              },
            ]
          }

          return [
            {
              id: 'appeal-log-1',
              entityId: 'appeal-1',
              action: 'APPEAL_REVIEW_STARTED',
              userId: 'admin-1',
              oldValue: { status: 'SUBMITTED' },
              newValue: { status: 'UNDER_REVIEW' },
              timestamp: new Date('2026-03-15T09:00:00.000Z'),
            },
          ]
        },
      },
      async () => {
        const data = await getEvaluationAppealPageData({
          session: makeSession(),
          cycleId: 'cycle-2026',
          caseId: 'new',
        })

        assert.equal(data.state, 'ready')
        assert.equal(data.selectedCaseId, undefined)
        assert.equal(data.viewModel?.case.id, undefined)
        assert.equal(data.viewModel?.case.status, 'DRAFT')
        assert.equal(data.viewModel?.case.reason, '새 초안 사유입니다.')
      }
    )
  })

  await run('case options keep per-appeal workflow statuses instead of copying the selected case status', async () => {
    await withStubbedAppealData(
      {
        evaluationFindFirst: async () =>
          makeEvaluation({
            appeals: [
              makeAppeal('appeal-1', { status: 'UNDER_REVIEW' }),
              makeAppeal('appeal-2', { status: 'SUBMITTED' }),
            ],
          }),
        auditLogFindMany: async () => [
          {
            id: 'appeal-1-info',
            entityId: 'appeal-1',
            action: 'APPEAL_INFO_REQUESTED',
            userId: 'admin-1',
            oldValue: { status: 'UNDER_REVIEW' },
            newValue: { status: 'INFO_REQUESTED' },
            timestamp: new Date('2026-03-20T10:00:00.000Z'),
          },
          {
            id: 'appeal-2-create',
            entityId: 'appeal-2',
            action: 'APPEAL_CREATED',
            userId: 'emp-1',
            oldValue: { status: 'DRAFT' },
            newValue: { status: 'SUBMITTED' },
            timestamp: new Date('2026-03-18T10:00:00.000Z'),
          },
        ],
      },
      async () => {
        const data = await getEvaluationAppealPageData({
          session: makeSession(),
          cycleId: 'cycle-2026',
          caseId: 'appeal-1',
        })

        assert.equal(data.state, 'ready')
        assert.deepEqual(
          data.viewModel?.caseOptions?.map((item) => ({ id: item.id, status: item.status })),
          [
            { id: 'appeal-1', status: 'INFO_REQUESTED' },
            { id: 'appeal-2', status: 'SUBMITTED' },
          ]
        )
      }
    )
  })

  await run('admin with valid cycle scope but no appeals sees empty operational state, not error', async () => {
    await withStubbedAppealData(
      {
        appealFindMany: async () => [],
      },
      async () => {
        const data = await getEvaluationAppealPageData({
          session: makeSession({
            id: 'admin-1',
            email: 'admin@rsupport.com',
            role: 'ROLE_ADMIN',
          }),
          cycleId: 'cycle-2026',
        })

        assert.equal(data.state, 'empty')
        assert.equal(data.selectedCycleId, 'cycle-2026')
      }
    )
  })

  await run('live client and routes keep real draft/save states instead of local placeholder behavior', () => {
    const clientSource = read('src/components/evaluation/EvaluationAppealClient.tsx')
    const createRouteSource = read('src/app/api/appeals/route.ts')
    const patchRouteSource = read('src/app/api/appeals/[id]/route.ts')

    assert.equal(clientSource.includes("caseId=new"), true)
    assert.equal(clientSource.includes("action: 'save_draft'"), true)
    assert.equal(clientSource.includes("state === 'window-closed'"), true)
    assert.equal(clientSource.includes("state === 'no-result-yet'"), true)
    assert.equal(clientSource.includes('localStorage'), false)
    assert.equal(createRouteSource.includes("action === 'save_draft'"), true)
    assert.equal(patchRouteSource.includes("action === 'save_draft'"), true)
  })

  console.log('Evaluation appeal workspace regression tests completed')
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
