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

const operations = require('../src/lib/operations') as typeof import('../src/lib/operations')
const { getDashboardPageData } = require('../src/server/dashboard-page') as typeof import('../src/server/dashboard-page')

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

type DashboardPrismaSnapshot = {
  employeeFindUnique: PrismaDelegateMethod
  employeeFindMany: PrismaDelegateMethod
  notificationFindMany: PrismaDelegateMethod
  personalKpiFindMany: PrismaDelegateMethod
  checkInFindMany: PrismaDelegateMethod
  midReviewAssignmentFindMany: PrismaDelegateMethod
  evaluationFindMany: PrismaDelegateMethod
  monthlyRecordCount: PrismaDelegateMethod
  buildOperationsSummary: typeof operations.buildOperationsSummary
}

function captureSnapshot(): DashboardPrismaSnapshot {
  const prismaAny = prisma as any
  return {
    employeeFindUnique: prismaAny.employee.findUnique,
    employeeFindMany: prismaAny.employee.findMany,
    notificationFindMany: prismaAny.notification.findMany,
    personalKpiFindMany: prismaAny.personalKpi.findMany,
    checkInFindMany: prismaAny.checkIn.findMany,
    midReviewAssignmentFindMany: prismaAny.midReviewAssignment.findMany,
    evaluationFindMany: prismaAny.evaluation.findMany,
    monthlyRecordCount: prismaAny.monthlyRecord.count,
    buildOperationsSummary: operations.buildOperationsSummary,
  }
}

function restoreSnapshot(snapshot: DashboardPrismaSnapshot) {
  const prismaAny = prisma as any
  prismaAny.employee.findUnique = snapshot.employeeFindUnique
  prismaAny.employee.findMany = snapshot.employeeFindMany
  prismaAny.notification.findMany = snapshot.notificationFindMany
  prismaAny.personalKpi.findMany = snapshot.personalKpiFindMany
  prismaAny.checkIn.findMany = snapshot.checkInFindMany
  prismaAny.midReviewAssignment.findMany = snapshot.midReviewAssignmentFindMany
  prismaAny.evaluation.findMany = snapshot.evaluationFindMany
  prismaAny.monthlyRecord.count = snapshot.monthlyRecordCount
  operations.buildOperationsSummary = snapshot.buildOperationsSummary
}

async function withStubbedDashboardData(
  overrides: Partial<Record<keyof DashboardPrismaSnapshot, PrismaDelegateMethod | typeof operations.buildOperationsSummary>>,
  fn: () => Promise<void>
) {
  const snapshot = captureSnapshot()
  const prismaAny = prisma as any

  prismaAny.employee.findUnique =
    overrides.employeeFindUnique ??
    (async () => ({
      id: 'user-1',
      empName: '홍길동',
      deptId: 'dept-1',
      department: {
        deptName: '경영지원팀',
      },
    }))

  prismaAny.employee.findMany = overrides.employeeFindMany ?? (async () => [])
  prismaAny.notification.findMany = overrides.notificationFindMany ?? (async () => [])
  prismaAny.personalKpi.findMany = overrides.personalKpiFindMany ?? (async () => [])
  prismaAny.checkIn.findMany = overrides.checkInFindMany ?? (async () => [])
  prismaAny.midReviewAssignment.findMany = overrides.midReviewAssignmentFindMany ?? (async () => [])
  prismaAny.evaluation.findMany = overrides.evaluationFindMany ?? (async () => [])
  prismaAny.monthlyRecord.count = overrides.monthlyRecordCount ?? (async () => 0)
  operations.buildOperationsSummary =
    (overrides.buildOperationsSummary as typeof operations.buildOperationsSummary | undefined) ??
    (async () => ({
      status: { label: '정상', tone: 'ok' as const },
      metrics: {
        failedJobs24h: 0,
        notificationDeadLetters: 0,
        overBudgetScenarios: 0,
        activeEvalCycles: 0,
        delayedEvalCycles: 0,
        loginUnavailableAccounts: 0,
        unreviewedMonthlyRecords: 0,
        unresolvedCalibrationCount: 0,
      },
      risks: [],
    })) as unknown as typeof operations.buildOperationsSummary

  try {
    await fn()
  } finally {
    restoreSnapshot(snapshot)
  }
}

function makeSession(overrides?: Partial<any>) {
  return {
    user: {
      id: 'user-1',
      email: 'user-1@company.test',
      name: '홍길동',
      role: 'ROLE_TEAM_LEADER',
      empId: 'EMP-001',
      position: '팀장',
      deptId: 'dept-1',
      deptName: '경영지원팀',
      departmentCode: 'MGMT',
      managerId: null,
      orgPath: 'ROOT>MGMT',
      accessibleDepartmentIds: ['dept-1'],
      ...overrides,
    },
  } as any
}

async function main() {
  await run('missing accessibleDepartmentIds no longer crashes dashboard and safely falls back to deptId', async () => {
    await withStubbedDashboardData({}, async () => {
      const data = await getDashboardPageData(
        makeSession({
          accessibleDepartmentIds: undefined,
        })
      )

      assert.equal(data.role, 'ROLE_TEAM_LEADER')
      assert.equal(data.summary.length, 4)
      assert.equal(data.alerts.length, 0)
      assert.equal(data.statusTone, 'success')
    })
  })

  await run('operations summary failure only degrades the admin section instead of crashing the whole dashboard', async () => {
    await withStubbedDashboardData(
      {
        buildOperationsSummary: async () => {
          throw new Error('ops summary unavailable')
        },
      },
      async () => {
        const originalConsoleError = console.error
        console.error = () => undefined

        try {
          const data = await getDashboardPageData(
            makeSession({
              role: 'ROLE_ADMIN',
              position: '관리자',
            })
          )

          assert.equal(data.role, 'ROLE_ADMIN')
          assert.equal(data.summary.length, 4)
          assert.equal(data.alerts.some((item) => item.title === '운영 요약 일부 생략'), true)
          assert.equal(data.statusTone, 'warn')
        } finally {
          console.error = originalConsoleError
        }
      }
    )
  })

  await run('notification failure only affects the related widget and leaves the page renderable', async () => {
    await withStubbedDashboardData(
      {
        notificationFindMany: async () => {
          throw new Error('notification query failed')
        },
      },
      async () => {
        const originalConsoleError = console.error
        console.error = () => undefined

        try {
          const data = await getDashboardPageData(
            makeSession({
              role: 'ROLE_ADMIN',
              position: '관리자',
            })
          )

          assert.equal(data.summary.length, 4)
          assert.equal(data.notifications.length, 0)
          assert.equal(data.actions.length, 6)
          assert.equal(data.actions.some((item) => item.href === '/admin/performance-calendar'), true)
          assert.equal(data.actions.some((item) => item.href === '/admin/goal-alignment'), true)
          assert.equal(data.alerts.some((item) => item.title === '알림 위젯 일부 생략'), true)
        } finally {
          console.error = originalConsoleError
        }
      }
    )
  })

  await run('leader dashboard surfaces pending mid-review queue items alongside evaluation work', async () => {
    await withStubbedDashboardData(
      {
        midReviewAssignmentFindMany: async () => [
          {
            id: 'mid-review-assignment-1',
            status: 'LEADER_DRAFT',
            cycle: {
              name: '2026 상반기 중간 점검',
              reviewType: 'ASSESSMENT',
              leaderDueAt: new Date('2026-05-10T09:00:00Z'),
            },
            relatedCheckIn: {
              id: 'checkin-mid-1',
            },
            targetEmployee: {
              empName: '김민수',
              department: {
                deptName: '영업1팀',
              },
            },
            targetDepartment: null,
          },
        ],
      },
      async () => {
        const data = await getDashboardPageData(makeSession())

        assert.equal(
          data.reviewQueue.some((item) => item.href?.includes('/checkin?recordId=checkin-mid-1') ?? false),
          true
        )
        assert.equal(data.reviewQueue.some((item) => item.title.includes('2026 상반기 중간 점검')), true)
      }
    )
  })

  await run('missing employee returns a warning dashboard instead of throwing the route', async () => {
    await withStubbedDashboardData(
      {
        employeeFindUnique: async () => null,
      },
      async () => {
        const data = await getDashboardPageData(makeSession())

        assert.equal(data.title, '대시보드')
        assert.equal(data.statusTone, 'warn')
        assert.equal(data.summary.length, 0)
      }
    )
  })

  await run('dashboard shell renders a visible degraded-state banner for alert-backed fallbacks', () => {
    const source = read('src/components/dashboard/DashboardPageShell.tsx')

    assert.equal(source.includes('data.alerts.length'), true)
    assert.equal(source.includes('일부 정보를 불러오지 못해 기본 대시보드로 표시 중입니다.'), true)
  })

  console.log('Dashboard page tests completed')
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
