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

const { getEvaluationResultsPageData } = require('../src/server/evaluation-results') as typeof import('../src/server/evaluation-results')

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

type ResultsSnapshot = {
  employeeFindUnique: PrismaDelegateMethod
  employeeFindMany: PrismaDelegateMethod
  departmentFindUnique: PrismaDelegateMethod
  evalCycleFindMany: PrismaDelegateMethod
  evaluationFindMany: PrismaDelegateMethod
  evaluationFindFirst: PrismaDelegateMethod
  personalKpiFindMany: PrismaDelegateMethod
  checkInFindMany: PrismaDelegateMethod
  auditLogFindMany: PrismaDelegateMethod
  gradeSettingFindMany: PrismaDelegateMethod
  aiCompetencyResultFindMany: PrismaDelegateMethod
}

function captureSnapshot(): ResultsSnapshot {
  const prismaAny = prisma as any
  return {
    employeeFindUnique: prismaAny.employee.findUnique,
    employeeFindMany: prismaAny.employee.findMany,
    departmentFindUnique: prismaAny.department.findUnique,
    evalCycleFindMany: prismaAny.evalCycle.findMany,
    evaluationFindMany: prismaAny.evaluation.findMany,
    evaluationFindFirst: prismaAny.evaluation.findFirst,
    personalKpiFindMany: prismaAny.personalKpi.findMany,
    checkInFindMany: prismaAny.checkIn.findMany,
    auditLogFindMany: prismaAny.auditLog.findMany,
    gradeSettingFindMany: prismaAny.gradeSetting.findMany,
    aiCompetencyResultFindMany: prismaAny.aiCompetencyResult.findMany,
  }
}

function restoreSnapshot(snapshot: ResultsSnapshot) {
  const prismaAny = prisma as any
  prismaAny.employee.findUnique = snapshot.employeeFindUnique
  prismaAny.employee.findMany = snapshot.employeeFindMany
  prismaAny.department.findUnique = snapshot.departmentFindUnique
  prismaAny.evalCycle.findMany = snapshot.evalCycleFindMany
  prismaAny.evaluation.findMany = snapshot.evaluationFindMany
  prismaAny.evaluation.findFirst = snapshot.evaluationFindFirst
  prismaAny.personalKpi.findMany = snapshot.personalKpiFindMany
  prismaAny.checkIn.findMany = snapshot.checkInFindMany
  prismaAny.auditLog.findMany = snapshot.auditLogFindMany
  prismaAny.gradeSetting.findMany = snapshot.gradeSettingFindMany
  prismaAny.aiCompetencyResult.findMany = snapshot.aiCompetencyResultFindMany
}

function makeSession(overrides?: Partial<any>) {
  return {
    user: {
      id: 'emp-1',
      email: 'member1@rsupport.com',
      name: '구성원',
      role: 'ROLE_MEMBER',
      empId: 'EMP-001',
      position: 'STAFF',
      deptId: 'dept-1',
      deptName: '경영지원',
      accessibleDepartmentIds: ['dept-1'],
      ...overrides,
    },
  } as any
}

function makeEmployee(id: string, name: string, role = 'ROLE_MEMBER', deptId = 'dept-1', deptName = '경영지원') {
  return {
    id,
    empId: id.toUpperCase(),
    empName: name,
    role,
    status: 'ACTIVE',
    position: role === 'ROLE_ADMIN' ? 'TEAM_LEADER' : 'STAFF',
    deptId,
    department: {
      id: deptId,
      deptName,
      orgId: 'org-1',
      organization: {
        id: 'org-1',
        name: 'RSUPPORT',
      },
    },
  }
}

function makeCycle(status: string = 'RESULT_OPEN') {
  return {
    id: 'cycle-2026',
    cycleName: '2026 상반기 평가',
    evalYear: 2026,
    status,
    orgId: 'org-1',
    resultOpenStart: new Date('2026-06-20T00:00:00.000Z'),
    appealDeadline: new Date('2026-07-10T00:00:00.000Z'),
    organization: {
      name: 'RSUPPORT',
    },
  }
}

function makeEvaluation(targetId: string) {
  return {
    id: `eval-final-${targetId}`,
    evalStage: 'FINAL',
    status: 'CONFIRMED',
    totalScore: targetId === 'emp-2' ? 91 : 87,
    gradeId: 'grade-a',
    comment: `${targetId} 최종 평가 코멘트`,
    submittedAt: new Date('2026-06-30T09:00:00.000Z'),
    createdAt: new Date('2026-06-01T09:00:00.000Z'),
    updatedAt: new Date('2026-06-30T09:00:00.000Z'),
    evaluator: {
      empName: '평가자',
      position: 'TEAM_LEADER',
    },
    items: [],
    appeals: [],
  }
}

async function withStubbedResultsData(
  overrides: Partial<Record<keyof ResultsSnapshot, PrismaDelegateMethod>>,
  fn: () => Promise<void>
) {
  const snapshot = captureSnapshot()
  const prismaAny = prisma as any

  prismaAny.employee.findUnique =
    overrides.employeeFindUnique ??
    (async ({ where }: { where: { id: string } }) => {
      if (where.id === 'admin-1') return null
      return makeEmployee(where.id, where.id === 'emp-2' ? '구성원2' : '구성원1')
    })

  prismaAny.employee.findMany =
    overrides.employeeFindMany ??
    (async () => [
      makeEmployee('emp-1', '구성원1'),
      makeEmployee('emp-2', '구성원2', 'ROLE_MEMBER', 'dept-2', '영업지원'),
    ])

  prismaAny.department.findUnique =
    overrides.departmentFindUnique ??
    (async () => ({
      id: 'dept-1',
      deptName: '경영지원',
      orgId: 'org-1',
      organization: {
        id: 'org-1',
        name: 'RSUPPORT',
      },
    }))

  prismaAny.evalCycle.findMany =
    overrides.evalCycleFindMany ??
    (async () => [makeCycle()])

  prismaAny.evaluation.findMany =
    overrides.evaluationFindMany ??
    (async (args?: any) => {
      if (args?.where?.evalCycleId && args?.where?.targetId) {
        return [makeEvaluation(args.where.targetId)]
      }

      if (args?.where?.targetId && args?.where?.evalCycle?.evalYear?.lt) {
        return [{ totalScore: 82, gradeId: 'grade-b' }]
      }

      if (args?.where?.evalCycleId && args?.where?.status === 'CONFIRMED') {
        return [
          { targetId: 'emp-1', totalScore: 87 },
          { targetId: 'emp-2', totalScore: 91 },
        ]
      }

      return []
    })

  prismaAny.evaluation.findFirst =
    overrides.evaluationFindFirst ??
    (async (args?: any) => makeEvaluation(args?.where?.targetId ?? 'emp-1'))

  prismaAny.personalKpi.findMany =
    overrides.personalKpiFindMany ??
    (async (args?: any) => [
      {
        id: `kpi-${args?.where?.employeeId ?? 'emp-1'}`,
        employeeId: args?.where?.employeeId ?? 'emp-1',
        kpiName: '고객 전환율 개선',
        kpiType: 'QUANTITATIVE',
        targetValue: 100,
        unit: '%',
        weight: 40,
        status: 'APPROVED',
        monthlyRecords: [
          {
            id: 'mr-2026-03',
            yearMonth: '2026-03',
            actualValue: 87,
            achievementRate: 87,
          },
        ],
      },
    ])

  prismaAny.checkIn.findMany = overrides.checkInFindMany ?? (async () => [])
  prismaAny.auditLog.findMany = overrides.auditLogFindMany ?? (async () => [])
  prismaAny.gradeSetting.findMany =
    overrides.gradeSettingFindMany ??
    (async () => [
      {
        id: 'grade-a',
        gradeName: 'A',
        minScore: 85,
        maxScore: 100,
      },
      {
        id: 'grade-b',
        gradeName: 'B',
        minScore: 70,
        maxScore: 84.99,
      },
    ])
  prismaAny.aiCompetencyResult.findMany = overrides.aiCompetencyResultFindMany ?? (async () => [])

  try {
    await fn()
  } finally {
    restoreSnapshot(snapshot)
  }
}

async function main() {
  await run('admin with valid org scope gets employee options and can browse another employee result', async () => {
    await withStubbedResultsData({}, async () => {
      const data = await getEvaluationResultsPageData({
        session: makeSession({
          id: 'admin-1',
          role: 'ROLE_ADMIN',
          deptId: 'dept-1',
          accessibleDepartmentIds: undefined,
        }),
        cycleId: 'cycle-2026',
        employeeId: 'emp-2',
      })

      assert.equal(data.state, 'ready')
      assert.equal(data.canSelectEmployee, true)
      assert.equal(data.employeeOptions.length, 2)
      assert.equal(data.selectedEmployeeId, 'emp-2')
      assert.equal(data.viewModel?.employee.id, 'emp-2')
      assert.equal(data.viewModel?.actions.canAcknowledge, false)
    })
  })

  await run('out-of-scope employee filter returns permission-denied instead of error', async () => {
    await withStubbedResultsData(
      {
        employeeFindMany: async () => [makeEmployee('emp-1', '구성원1')],
      },
      async () => {
        const data = await getEvaluationResultsPageData({
          session: makeSession({
            id: 'admin-1',
            role: 'ROLE_SECTION_CHIEF',
            accessibleDepartmentIds: ['dept-1'],
          }),
          cycleId: 'cycle-2026',
          employeeId: 'emp-2',
        })

        assert.equal(data.state, 'permission-denied')
        assert.notEqual(data.state, 'error')
        assert.equal(data.employeeOptions.length, 1)
      }
    )
  })

  await run('no result is rendered as empty, not error', async () => {
    await withStubbedResultsData(
      {
        evaluationFindMany: async (args?: any) => {
          if (args?.where?.evalCycleId && args?.where?.targetId) {
            return []
          }
          if (args?.where?.evalCycleId && args?.where?.status === 'CONFIRMED') {
            return []
          }
          return []
        },
        evaluationFindFirst: async () => null,
      },
      async () => {
        const data = await getEvaluationResultsPageData({
          session: makeSession(),
          cycleId: 'cycle-2026',
        })

        assert.equal(data.state, 'empty')
      }
    )
  })

  await run('unpublished state stays distinct from empty and error', async () => {
    await withStubbedResultsData(
      {
        evalCycleFindMany: async () => [makeCycle('DRAFT')],
        evaluationFindMany: async (args?: any) => {
          if (args?.where?.evalCycleId && args?.where?.targetId) {
            return []
          }
          return []
        },
        evaluationFindFirst: async () => null,
      },
      async () => {
        const data = await getEvaluationResultsPageData({
          session: makeSession(),
          cycleId: 'cycle-2026',
        })

        assert.equal(data.state, 'unpublished')
      }
    )
  })

  await run('employee row missing with valid session department falls back to scoped browsing without fatal error', async () => {
    await withStubbedResultsData(
      {
        employeeFindUnique: async () => null,
      },
      async () => {
        const data = await getEvaluationResultsPageData({
          session: makeSession({
            id: 'admin-1',
            role: 'ROLE_ADMIN',
            deptId: 'dept-1',
            accessibleDepartmentIds: undefined,
          }),
          cycleId: 'cycle-2026',
          employeeId: 'emp-1',
        })

        assert.notEqual(data.state, 'error')
        assert.equal(data.employeeOptions.length, 2)
        assert.equal(data.selectedEmployeeId, 'emp-1')
      }
    )
  })

  await run('evaluation results client preserves employee filter and resets stale local state on filter changes', () => {
    const source = read('src/components/evaluation/EvaluationResultsClient.tsx')

    assert.equal(source.includes('handleEmployeeChange'), true)
    assert.equal(source.includes('selectedEmployeeId || undefined'), true)
    assert.equal(source.includes("setActiveTab('summary')"), true)
    assert.equal(source.includes("setSelectedDetailId('')"), true)
    assert.equal(source.includes('viewModel.actions.canAcknowledge'), true)
    assert.equal(source.includes('viewModel.actions.canExport'), true)
    assert.equal(source.includes("state === 'unpublished'"), true)
  })

  console.log('Evaluation results workspace regression tests completed')
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
