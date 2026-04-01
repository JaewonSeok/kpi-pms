/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
import 'dotenv/config'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
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

const {
  buildGoalAlignmentCsv,
  getGoalAlignmentPageData,
  validateOrgParentLink,
  validatePersonalOrgLink,
} = require('../src/server/goal-alignment') as typeof import('../src/server/goal-alignment')

function read(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')
}

function makeSession(role: string = 'ROLE_ADMIN', overrides?: Partial<any>) {
  return {
    user: {
      id: 'admin-1',
      email: role === 'ROLE_ADMIN' ? 'admin@rsupport.com' : 'member1@rsupport.com',
      role,
      deptId: 'dept-root',
      name: role === 'ROLE_ADMIN' ? '관리자' : '구성원',
      accessibleDepartmentIds: ['dept-root', 'dept-team'],
      ...overrides,
    },
  } as any
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

type GoalAlignmentSnapshot = {
  orgKpiFindMany: any
  personalKpiFindMany: any
}

function captureSnapshot(): GoalAlignmentSnapshot {
  const prismaAny = prisma as any
  return {
    orgKpiFindMany: prismaAny.orgKpi.findMany,
    personalKpiFindMany: prismaAny.personalKpi.findMany,
  }
}

function restoreSnapshot(snapshot: GoalAlignmentSnapshot) {
  const prismaAny = prisma as any
  prismaAny.orgKpi.findMany = snapshot.orgKpiFindMany
  prismaAny.personalKpi.findMany = snapshot.personalKpiFindMany
}

async function withStubbedYears(fn: () => Promise<void>) {
  const snapshot = captureSnapshot()
  const prismaAny = prisma as any
  prismaAny.orgKpi.findMany = async () => [{ evalYear: 2026 }]
  prismaAny.personalKpi.findMany = async () => [{ evalYear: 2026 }]

  try {
    await fn()
  } finally {
    restoreSnapshot(snapshot)
  }
}

async function main() {
  await run('goal alignment merges company, org, and personal goals while marking orphan nodes', async () => {
    await withStubbedYears(async () => {
      const data = await getGoalAlignmentPageData(
        makeSession(),
        {
          year: 2026,
          departmentId: 'ALL',
          status: 'ALL',
        },
        {
          loadDepartments: async () => [
            { id: 'dept-root', deptName: '전사', deptCode: 'ROOT', parentDeptId: null },
            { id: 'dept-team', deptName: '영업본부', deptCode: 'SALES', parentDeptId: 'dept-root' },
          ],
          loadCycles: async () => [{ id: 'cycle-2026', cycleName: '2026 상반기', evalYear: 2026 }],
          loadOrgGoals: async () => [
            {
              id: 'org-root',
              deptId: 'dept-root',
              evalYear: 2026,
              kpiName: '전사 매출 성장',
              status: 'CONFIRMED',
              parentOrgKpiId: null,
              department: { deptName: '전사' },
              personalKpis: [],
            },
            {
              id: 'org-team',
              deptId: 'dept-team',
              evalYear: 2026,
              kpiName: '팀 파이프라인 확대',
              status: 'DRAFT',
              parentOrgKpiId: 'org-root',
              department: { deptName: '영업본부' },
              personalKpis: [
                {
                  id: 'pk-1',
                  status: 'DRAFT',
                  employeeId: 'emp-1',
                  employee: {
                    empName: '구성원1',
                    deptId: 'dept-team',
                    department: { deptName: '영업본부' },
                  },
                  monthlyRecords: [{ achievementRate: 32 }],
                },
              ],
            },
            {
              id: 'org-orphan',
              deptId: 'dept-team',
              evalYear: 2026,
              kpiName: '고립 목표',
              status: 'DRAFT',
              parentOrgKpiId: 'missing-parent',
              department: { deptName: '영업본부' },
              personalKpis: [],
            },
          ],
          loadPersonalGoals: async () => [
            {
              id: 'pk-1',
              employeeId: 'emp-1',
              evalYear: 2026,
              kpiName: '잠재 고객 발굴',
              status: 'DRAFT',
              linkedOrgKpiId: 'org-team',
              employee: {
                empName: '구성원1',
                deptId: 'dept-team',
                department: { deptName: '영업본부' },
              },
              monthlyRecords: [{ achievementRate: 24 }],
            },
            {
              id: 'pk-2',
              employeeId: 'emp-2',
              evalYear: 2026,
              kpiName: '미연결 개인 목표',
              status: 'DRAFT',
              linkedOrgKpiId: null,
              employee: {
                empName: '구성원2',
                deptId: 'dept-team',
                department: { deptName: '영업본부' },
              },
              monthlyRecords: [{ achievementRate: 10 }],
            },
          ],
          loadEmployees: async () => [
            { id: 'emp-1', empName: '구성원1', deptId: 'dept-team', status: 'ACTIVE' },
            { id: 'emp-2', empName: '구성원2', deptId: 'dept-team', status: 'ACTIVE' },
          ],
          loadCheckIns: async () => [
            { id: 'checkin-1', ownerId: 'emp-1', status: 'COMPLETED' },
            { id: 'checkin-2', ownerId: 'emp-2', status: 'SCHEDULED' },
          ],
        }
      )

      assert.equal(data.state, 'ready')
      assert.equal(data.summary.orgGoalCount, 3)
      assert.equal(data.summary.personalGoalCount, 2)
      assert.equal(data.summary.alignedPersonalGoalCount, 1)
      assert.equal(data.summary.orphanOrgGoalCount, 1)
      assert.equal(data.orphanPersonalGoals.length, 1)
      assert.equal(data.board.length, 2)
      assert.equal(data.board.some((node) => node.children.some((child) => child.id === 'org-team')), true)
      assert.equal(data.departmentSummary.length >= 1, true)
      assert.equal(data.quickLinks.orgKpiHref.includes('/kpi/org?year=2026'), true)
    })
  })

  await run('goal alignment tolerates a failing source and keeps partial data with alerts', async () => {
    await withStubbedYears(async () => {
      const originalConsoleError = console.error
      console.error = () => undefined

      try {
        const data = await getGoalAlignmentPageData(
          makeSession(),
          { year: 2026, status: 'ALL' },
          {
            loadDepartments: async () => [{ id: 'dept-root', deptName: '전사', deptCode: 'ROOT', parentDeptId: null }],
            loadCycles: async () => [],
            loadOrgGoals: async () => [
              {
                id: 'org-root',
                deptId: 'dept-root',
                evalYear: 2026,
                kpiName: '전사 목표',
                status: 'CONFIRMED',
                parentOrgKpiId: null,
                department: { deptName: '전사' },
                personalKpis: [],
              },
            ],
            loadPersonalGoals: async () => {
              throw new Error('personal source unavailable')
            },
            loadEmployees: async () => [],
            loadCheckIns: async () => [],
          }
        )

        assert.equal(data.state, 'ready')
        assert.equal(data.board.length, 1)
        assert.equal(data.alerts.length, 1)
      } finally {
        console.error = originalConsoleError
      }
    })
  })

  await run('goal alignment returns permission-denied for non-admin access', async () => {
    await withStubbedYears(async () => {
      const data = await getGoalAlignmentPageData(makeSession('ROLE_MEMBER'), { year: 2026 })

      assert.equal(data.state, 'permission-denied')
      assert.equal(data.permissions.canExport, false)
      assert.equal(data.board.length, 0)
    })
  })

  await run('goal alignment returns empty instead of fatal when no goal data exists', async () => {
    await withStubbedYears(async () => {
      const data = await getGoalAlignmentPageData(
        makeSession(),
        { year: 2026 },
        {
          loadDepartments: async () => [{ id: 'dept-root', deptName: '전사', deptCode: 'ROOT', parentDeptId: null }],
          loadCycles: async () => [],
          loadOrgGoals: async () => [],
          loadPersonalGoals: async () => [],
          loadEmployees: async () => [],
          loadCheckIns: async () => [],
        }
      )

      assert.equal(data.state, 'empty')
      assert.equal(data.board.length, 0)
      assert.equal(data.message?.length ? true : false, true)
    })
  })

  await run('goal alignment parent validation blocks cross-year and circular links', async () => {
    await assert.rejects(
      () =>
        validateOrgParentLink({
          goalId: 'goal-1',
          parentOrgKpiId: 'goal-parent',
          targetDeptId: 'dept-team',
          targetEvalYear: 2026,
          editableDepartmentIds: ['dept-team'],
          prismaClient: {
            orgKpi: {
              findUnique: async ({ where }: any) => {
                if (where.id === 'goal-parent') {
                  return {
                    id: 'goal-parent',
                    deptId: 'dept-root',
                    evalYear: 2025,
                    status: 'CONFIRMED',
                    parentOrgKpiId: null,
                  }
                }
                return null
              },
            },
            department: {
              findMany: async () => [
                { id: 'dept-root', deptName: '전사', deptCode: 'ROOT', parentDeptId: null },
                { id: 'dept-team', deptName: '영업본부', deptCode: 'SALES', parentDeptId: 'dept-root' },
              ],
            },
          } as any,
        }),
      (error: any) => {
        assert.equal(error.code, 'ORG_KPI_PARENT_YEAR_MISMATCH')
        return true
      }
    )

    await assert.rejects(
      () =>
        validateOrgParentLink({
          goalId: 'goal-1',
          parentOrgKpiId: 'goal-parent',
          targetDeptId: 'dept-team',
          targetEvalYear: 2026,
          editableDepartmentIds: ['dept-team'],
          prismaClient: {
            orgKpi: {
              findUnique: async ({ where }: any) => {
                if (where.id === 'goal-parent') {
                  return {
                    id: 'goal-parent',
                    deptId: 'dept-root',
                    evalYear: 2026,
                    status: 'CONFIRMED',
                    parentOrgKpiId: 'goal-1',
                  }
                }
                if (where.id === 'goal-1') {
                  return { parentOrgKpiId: 'goal-parent' }
                }
                return { parentOrgKpiId: null }
              },
            },
            department: {
              findMany: async () => [
                { id: 'dept-root', deptName: '전사', deptCode: 'ROOT', parentDeptId: null },
                { id: 'dept-team', deptName: '영업본부', deptCode: 'SALES', parentDeptId: 'dept-root' },
              ],
            },
          } as any,
        }),
      (error: any) => {
        assert.equal(error.code, 'ORG_KPI_PARENT_CYCLE')
        return true
      }
    )
  })

  await run('goal alignment personal link validation blocks out-of-scope org goals', async () => {
    await assert.rejects(
      () =>
        validatePersonalOrgLink({
          linkedOrgKpiId: 'org-root',
          targetEvalYear: 2026,
          targetEmployeeDeptId: 'dept-other',
          prismaClient: {
            orgKpi: {
              findUnique: async () => ({
                id: 'org-root',
                deptId: 'dept-root',
                evalYear: 2026,
                status: 'CONFIRMED',
              }),
            },
            department: {
              findMany: async () => [
                { id: 'dept-root', deptName: '전사', deptCode: 'ROOT', parentDeptId: null },
                { id: 'dept-other', deptName: '고객지원', deptCode: 'CS', parentDeptId: null },
              ],
            },
          } as any,
        }),
      (error: any) => {
        assert.equal(error.code, 'ORG_KPI_SCOPE_MISMATCH')
        return true
      }
    )
  })

  await run('goal alignment export keeps board and orphan summary rows', async () => {
    const csv = buildGoalAlignmentCsv({
      state: 'ready',
      alerts: [],
      selectedYear: 2026,
      selectedCycleId: 'cycle-2026',
      selectedDepartmentId: 'ALL',
      selectedStatus: 'ALL',
      availableYears: [2026],
      cycleOptions: [{ id: 'cycle-2026', label: '2026 상반기', year: 2026 }],
      departmentOptions: [{ id: 'ALL', name: '전체 조직', parentDepartmentId: null, level: 0 }],
      statusOptions: [],
      summary: {
        orgGoalCount: 1,
        personalGoalCount: 1,
        alignedPersonalGoalCount: 0,
        orphanOrgGoalCount: 0,
        orphanPersonalGoalCount: 1,
        personalGoalSetupRate: 100,
        completedCheckInRate: 50,
        averageProgressRate: 30,
      },
      board: [
        {
          id: 'org-1',
          title: '전사 목표',
          departmentId: 'dept-root',
          departmentName: '전사',
          status: 'CONFIRMED',
          progressRate: 30,
          isOrphan: false,
          riskFlags: [],
          linkedPersonalGoalCount: 0,
          childGoalCount: 0,
          lineage: [],
          href: '/kpi/org?year=2026&kpiId=org-1',
          children: [],
          personalGoals: [],
        },
      ],
      orphanPersonalGoals: [
        {
          id: 'pk-1',
          title: '미연결 개인 목표',
          employeeName: '구성원1',
          departmentName: '영업본부',
          status: 'DRAFT',
          progressRate: 20,
          isOrphan: true,
          linkedOrgKpiId: null,
          href: '/kpi/personal?year=2026&kpiId=pk-1',
        },
      ],
      departmentSummary: [],
      permissions: { canExport: true, canRunReminder: true },
      quickLinks: {
        readModeHref: '/admin/eval-cycle',
        reminderHref: '/admin/notifications',
        orgKpiHref: '/kpi/org?year=2026',
      },
    })

    assert.equal(csv.startsWith('\uFEFF'), true)
    assert.equal(csv.includes('전사 목표'), true)
    assert.equal(csv.includes('미연결 개인 목표'), true)
  })

  await run('goal alignment route and compact lineage UI are wired into the live product', () => {
    const dashboardSource = read('src/server/dashboard-page.ts')
    const navigationSource = read('src/lib/navigation.ts')
    const clientSource = read('src/components/admin/GoalAlignmentClient.tsx')
    const orgSource = read('src/components/kpi/OrgKpiManagementClient.tsx')
    const orgLoaderSource = read('src/server/org-kpi-page.ts')
    const personalSource = read('src/components/kpi/PersonalKpiManagementClient.tsx')

    assert.equal(existsSync(path.resolve(process.cwd(), 'src/app/(main)/admin/goal-alignment/page.tsx')), true)
    assert.equal(existsSync(path.resolve(process.cwd(), 'src/app/api/admin/goal-alignment/export/route.ts')), true)
    assert.equal(dashboardSource.includes('/admin/goal-alignment'), true)
    assert.equal(navigationSource.includes('/admin/goal-alignment'), true)
    assert.equal(clientSource.includes('/api/admin/goal-alignment/export'), true)
    assert.equal(clientSource.includes("reminderTypes: [reminderType]"), true)
    assert.equal(orgSource.includes('parentOrgKpiId'), true)
    assert.equal(orgSource.includes('parentGoalOptions'), true)
    assert.equal(orgLoaderSource.includes('childOrgKpiCount'), true)
    assert.equal(personalSource.includes('orgLineage'), true)
  })

  console.log('Goal alignment tests completed')
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
