/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
import 'dotenv/config'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import Module from 'node:module'
import path from 'node:path'
import { prisma } from '../src/lib/prisma'
import {
  buildPersonalKpiPermissions,
  canCoachPersonalKpiTarget,
  getPersonalKpiScopeDepartmentIds,
  resolvePersonalKpiAiAccess,
} from '../src/lib/personal-kpi-access'

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
  buildPersonalKpiMboPolicyGuidanceList2026,
  getPersonalKpiPageData,
} = require('../src/server/personal-kpi-page') as typeof import('../src/server/personal-kpi-page')

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

type PersonalKpiPagePrismaSnapshot = {
  employeeFindMany: PrismaDelegateMethod
  departmentFindMany: PrismaDelegateMethod
  departmentFindUnique: PrismaDelegateMethod
  evalCycleFindMany: PrismaDelegateMethod
  personalKpiFindMany: PrismaDelegateMethod
  personalKpiCreateMany: PrismaDelegateMethod
  orgKpiFindMany: PrismaDelegateMethod
  auditLogFindMany: PrismaDelegateMethod
  aiRequestLogFindMany: PrismaDelegateMethod
  multiFeedbackFindMany: PrismaDelegateMethod
}

function capturePrismaSnapshot(): PersonalKpiPagePrismaSnapshot {
  const prismaAny = prisma as any
  return {
    employeeFindMany: prismaAny.employee.findMany,
    departmentFindMany: prismaAny.department.findMany,
    departmentFindUnique: prismaAny.department.findUnique,
    evalCycleFindMany: prismaAny.evalCycle.findMany,
    personalKpiFindMany: prismaAny.personalKpi.findMany,
    personalKpiCreateMany: prismaAny.personalKpi.createMany,
    orgKpiFindMany: prismaAny.orgKpi.findMany,
    auditLogFindMany: prismaAny.auditLog.findMany,
    aiRequestLogFindMany: prismaAny.aiRequestLog.findMany,
    multiFeedbackFindMany: prismaAny.multiFeedback.findMany,
  }
}

function restorePrismaSnapshot(snapshot: PersonalKpiPagePrismaSnapshot) {
  const prismaAny = prisma as any
  prismaAny.employee.findMany = snapshot.employeeFindMany
  prismaAny.department.findMany = snapshot.departmentFindMany
  prismaAny.department.findUnique = snapshot.departmentFindUnique
  prismaAny.evalCycle.findMany = snapshot.evalCycleFindMany
  prismaAny.personalKpi.findMany = snapshot.personalKpiFindMany
  prismaAny.personalKpi.createMany = snapshot.personalKpiCreateMany
  prismaAny.orgKpi.findMany = snapshot.orgKpiFindMany
  prismaAny.auditLog.findMany = snapshot.auditLogFindMany
  prismaAny.aiRequestLog.findMany = snapshot.aiRequestLogFindMany
  prismaAny.multiFeedback.findMany = snapshot.multiFeedbackFindMany
}

async function withStubbedPersonalKpiPageData(
  overrides: Partial<Record<keyof PersonalKpiPagePrismaSnapshot, PrismaDelegateMethod>>,
  fn: () => Promise<void>
) {
  const snapshot = capturePrismaSnapshot()
  const prismaAny = prisma as any

  prismaAny.employee.findMany =
    overrides.employeeFindMany ??
    (async () => [
      {
        id: 'leader-1',
        empId: 'EMP-LEADER',
        empName: 'Leader One',
        role: 'ROLE_TEAM_LEADER',
        deptId: 'dept-1',
        teamLeaderId: null,
        sectionChiefId: null,
        divisionHeadId: null,
      },
      {
        id: 'member-2',
        empId: 'EMP-MEMBER-2',
        empName: 'Member Two',
        role: 'ROLE_MEMBER',
        deptId: 'dept-1',
        teamLeaderId: 'leader-1',
        sectionChiefId: null,
        divisionHeadId: null,
      },
    ])

  prismaAny.department.findMany =
    overrides.departmentFindMany ??
    (async () => [
      {
        id: 'dept-1',
        deptName: 'Business Ops',
      },
      {
        id: 'dept-2',
        deptName: 'Finance',
      },
    ])

  prismaAny.department.findUnique =
    overrides.departmentFindUnique ??
    (async () => ({
      id: 'dept-1',
      deptName: 'Business Ops',
      organization: {
        id: 'org-1',
        name: 'RSUPPORT',
      },
    }))

  prismaAny.evalCycle.findMany =
    overrides.evalCycleFindMany ??
    (async () => [
      {
        id: 'cycle-2026',
        cycleName: '2026 KPI ?ㅼ젙',
        evalYear: 2026,
        status: 'KPI_SETTING',
      },
    ])

  let personalKpiFindManyCallCount = 0
  prismaAny.personalKpi.findMany =
    overrides.personalKpiFindMany ??
    (async () => {
      personalKpiFindManyCallCount += 1
      return personalKpiFindManyCallCount >= 1 ? [] : []
    })
  prismaAny.personalKpi.createMany =
    overrides.personalKpiCreateMany ??
    (async () => ({
      count: 0,
    }))

  prismaAny.orgKpi.findMany = overrides.orgKpiFindMany ?? (async () => [])
  prismaAny.auditLog.findMany = overrides.auditLogFindMany ?? (async () => [])
  prismaAny.aiRequestLog.findMany = overrides.aiRequestLogFindMany ?? (async () => [])
  prismaAny.multiFeedback.findMany = overrides.multiFeedbackFindMany ?? (async () => [])

  try {
    await fn()
  } finally {
    restorePrismaSnapshot(snapshot)
  }
}

async function main() {
  await run('missing accessibleDepartmentIds falls back safely instead of turning the page into a generic error', async () => {
    await withStubbedPersonalKpiPageData({}, async () => {
      const data = await getPersonalKpiPageData({
        session: {
          user: {
            id: 'leader-1',
            role: 'ROLE_TEAM_LEADER',
            name: 'Leader One',
            deptId: 'dept-1',
            deptName: 'Business Ops',
            accessibleDepartmentIds: undefined as never,
          },
        },
        year: 2026,
        employeeId: 'member-2',
      })

      assert.equal(data.state, 'empty')
      assert.equal(data.summary.totalCount, 0)
      assert.ok(data.employeeOptions.length > 0)
      assert.notEqual(data.message, '\uAC1C\uC778 KPI \uB370\uC774\uD130\uB97C \uBD88\uB7EC\uC624\uB294 \uC911 \uBB38\uC81C\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.')
    })
  })

  await run('zero personal KPI rows render as empty state, not error state', async () => {
    await withStubbedPersonalKpiPageData(
      {
        employeeFindMany: async () => [
          {
            id: 'member-2',
            empId: 'EMP-MEMBER-2',
            empName: 'Member Two',
            role: 'ROLE_MEMBER',
            deptId: 'dept-1',
            status: 'ACTIVE',
            department: {
              deptName: 'Business Ops',
            },
          },
        ],
      },
      async () => {
        const data = await getPersonalKpiPageData({
          session: {
            user: {
              id: 'member-2',
              role: 'ROLE_MEMBER',
              name: 'Member Two',
              deptId: 'dept-1',
              deptName: 'Business Ops',
              accessibleDepartmentIds: [],
            },
          },
          year: 2026,
        })

        assert.equal(data.state, 'empty')
        assert.equal(data.summary.totalCount, 0)
        assert.equal(data.permissions.canCreate, true)
        assert.equal(data.permissions.canSubmit, true)
      }
    )
  })

  await run('HR admin without a direct employee row still gets assignee options and a valid target', async () => {
    await withStubbedPersonalKpiPageData(
      {
        employeeFindMany: async () => [
          {
            id: 'member-10',
            empId: 'EMP-010',
            empName: 'Scoped Member',
            role: 'ROLE_MEMBER',
            deptId: 'dept-1',
            teamLeaderId: null,
            sectionChiefId: null,
            divisionHeadId: null,
          },
          {
            id: 'member-11',
            empId: 'EMP-011',
            empName: 'Another Member',
            role: 'ROLE_MEMBER',
            deptId: 'dept-2',
            teamLeaderId: null,
            sectionChiefId: null,
            divisionHeadId: null,
          },
        ],
      },
      async () => {
        const data = await getPersonalKpiPageData({
          session: {
            user: {
              id: 'admin-without-employee-row',
              role: 'ROLE_ADMIN',
              name: 'HR Admin',
              deptId: 'dept-admin',
              deptName: 'HR',
              accessibleDepartmentIds: [],
            },
          },
          year: 2026,
        })

        assert.equal(data.state, 'empty')
        assert.equal(data.employeeOptions.length, 2)
        assert.equal(data.selectedEmployeeId, 'member-10')
        assert.equal(data.permissions.canCreate, true)
      }
    )
  })

  await run('assignee dropdown stays populated even when department-name lookup fails', async () => {
    await withStubbedPersonalKpiPageData(
      {
        employeeFindMany: async () => [
          {
            id: 'member-10',
            empId: 'EMP-010',
            empName: 'Scoped Member',
            role: 'ROLE_MEMBER',
            deptId: 'dept-1',
            teamLeaderId: null,
            sectionChiefId: null,
            divisionHeadId: null,
          },
        ],
        departmentFindMany: async () => {
          throw new Error('department lookup failed')
        },
      },
      async () => {
        const originalConsoleError = console.error
        console.error = () => undefined

        try {
          const data = await getPersonalKpiPageData({
            session: {
              user: {
                id: 'admin-without-employee-row',
                role: 'ROLE_ADMIN',
                name: 'HR Admin',
                deptId: 'dept-admin',
                deptName: 'HR',
                accessibleDepartmentIds: [],
              },
            },
            year: 2026,
          })

          assert.equal(data.state, 'empty')
          assert.equal(data.employeeOptions.length, 1)
          assert.equal(data.employeeOptions[0]?.departmentName, '\uBBF8\uC9C0\uC815 \uBD80\uC11C')
          assert.equal(data.selectedEmployeeId, 'member-10')
        } finally {
          console.error = originalConsoleError
        }
      }
    )
  })

  await run('requested out-of-scope employee returns no-target instead of a generic error', async () => {
    await withStubbedPersonalKpiPageData(
      {
        employeeFindMany: async () => [],
      },
      async () => {
        const data = await getPersonalKpiPageData({
          session: {
            user: {
              id: 'leader-1',
              role: 'ROLE_TEAM_LEADER',
              name: 'Leader One',
              deptId: 'dept-1',
              deptName: 'Business Ops',
              accessibleDepartmentIds: ['dept-1'],
            },
          },
          year: 2026,
          employeeId: 'missing-user',
        })

        assert.equal(data.state, 'no-target')
      }
    )
  })

  await run('no scoped employees for a manager returns setup-required', async () => {
    await withStubbedPersonalKpiPageData(
      {
        employeeFindMany: async () => [],
      },
      async () => {
        const data = await getPersonalKpiPageData({
          session: {
            user: {
              id: 'leader-1',
              role: 'ROLE_TEAM_LEADER',
              name: 'Leader One',
              deptId: 'dept-1',
              deptName: 'Business Ops',
              accessibleDepartmentIds: ['dept-1'],
            },
          },
          year: 2026,
        })

        assert.equal(data.state, 'setup-required')
      }
    )
  })

  await run('employee lookup failure is still fatal and returns the true error state', async () => {
    await withStubbedPersonalKpiPageData(
      {
        employeeFindMany: async () => {
          throw new Error('db unavailable')
        },
      },
      async () => {
        const originalConsoleError = console.error
        console.error = () => undefined

        try {
          const data = await getPersonalKpiPageData({
            session: {
              user: {
                id: 'leader-1',
                role: 'ROLE_TEAM_LEADER',
                name: 'Leader One',
                deptId: 'dept-1',
                deptName: 'Business Ops',
                accessibleDepartmentIds: ['dept-1'],
              },
            },
            year: 2026,
          })

          assert.equal(data.state, 'error')
          assert.equal(data.message, '\uAC1C\uC778 KPI \uB370\uC774\uD130\uB97C \uBD88\uB7EC\uC624\uB294 \uC911 \uBB38\uC81C\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.')
        } finally {
          console.error = originalConsoleError
        }
      }
    )
  })

  await run('non-critical AI log failure keeps the personal KPI page operational with a degraded-state alert', async () => {
    await withStubbedPersonalKpiPageData(
      {
        aiRequestLogFindMany: async () => {
          throw new Error('ai log unavailable')
        },
      },
      async () => {
        const originalConsoleError = console.error
        console.error = () => undefined

        try {
          const data = await getPersonalKpiPageData({
            session: {
              user: {
                id: 'leader-1',
                role: 'ROLE_TEAM_LEADER',
                name: 'Leader One',
                deptId: 'dept-1',
                deptName: 'Business Ops',
                accessibleDepartmentIds: ['dept-1'],
              },
            },
            year: 2026,
          })

          assert.equal(data.state, 'empty')
          assert.equal(data.aiLogs.length, 0)
          assert.equal(data.alerts?.some((item) => item.title.includes('AI')), true)
        } finally {
          console.error = originalConsoleError
        }
      }
    )
  })

  await run('a recoverable KPI-list failure preserves the assignee shell instead of returning a generic error', async () => {
    await withStubbedPersonalKpiPageData(
      {
        personalKpiFindMany: async (args: any) => {
          if (args?.select?.evalYear) {
            return []
          }
          throw new Error('personal kpi query failed')
        },
      },
      async () => {
        const originalConsoleError = console.error
        console.error = () => undefined

        try {
          const data = await getPersonalKpiPageData({
            session: {
              user: {
                id: 'admin-without-employee-row',
                role: 'ROLE_ADMIN',
                name: 'HR Admin',
                deptId: 'dept-admin',
                deptName: 'HR',
                accessibleDepartmentIds: [],
              },
            },
            year: 2026,
          })

          assert.equal(data.state, 'empty')
          assert.equal(data.employeeOptions.length, 2)
          assert.equal(data.selectedEmployeeId, 'leader-1')
          assert.equal(data.alerts?.some((item) => item.title.includes('KPI')), true)
        } finally {
          console.error = originalConsoleError
        }
      }
    )
  })

  await run('leadership targets auto-import only their exact org KPI scope into personal KPI and remain idempotent', async () => {
    const departments = [
      {
        id: 'dept-team',
        deptName: 'Customer Ops Team',
        parentDeptId: 'dept-section',
        leaderEmployeeId: 'leader-hr',
      },
      {
        id: 'dept-section',
        deptName: 'Customer Ops Section',
        parentDeptId: 'dept-division',
        leaderEmployeeId: 'leader-section',
      },
      {
        id: 'dept-division',
        deptName: 'Customer Experience Division',
        parentDeptId: null,
        leaderEmployeeId: 'leader-division',
      },
    ]

    const orgKpis = [
      {
        id: 'org-team-1',
        deptId: 'dept-team',
        evalYear: 2026,
        kpiType: 'QUANTITATIVE',
        kpiCategory: '운영',
        kpiName: '팀 KPI 1',
        definition: '팀 실행 KPI',
        formula: 'A/B',
        targetValue: 90,
        targetValueT: 88,
        targetValueE: 90,
        targetValueS: 93,
        weight: 30,
        difficulty: 'MEDIUM',
        status: 'CONFIRMED',
        department: { deptName: 'Customer Ops Team' },
        parentOrgKpiId: 'org-section-1',
      },
      {
        id: 'org-section-1',
        deptId: 'dept-section',
        evalYear: 2026,
        kpiType: 'QUANTITATIVE',
        kpiCategory: '운영',
        kpiName: '실 KPI 1',
        definition: '실 실행 KPI',
        formula: 'C/D',
        targetValue: 92,
        targetValueT: 90,
        targetValueE: 92,
        targetValueS: 95,
        weight: 35,
        difficulty: 'HIGH',
        status: 'CONFIRMED',
        department: { deptName: 'Customer Ops Section' },
        parentOrgKpiId: 'org-division-1',
      },
      {
        id: 'org-division-1',
        deptId: 'dept-division',
        evalYear: 2026,
        kpiType: 'QUANTITATIVE',
        kpiCategory: '전략',
        kpiName: '본부 KPI 1',
        definition: '본부 전략 KPI',
        formula: 'E/F',
        targetValue: 95,
        targetValueT: 93,
        targetValueE: 95,
        targetValueS: 97,
        weight: 40,
        difficulty: 'HIGH',
        status: 'CONFIRMED',
        department: { deptName: 'Customer Experience Division' },
        parentOrgKpiId: null,
      },
    ]

    const buildLoaderHarness = (employees: Array<Record<string, unknown>>, initialPersonalKpis?: Array<Record<string, unknown>>) => {
      const personalKpis = [...(initialPersonalKpis ?? [])]
      let createdCount = 0

      return {
        personalKpis,
        getCreatedCount: () => createdCount,
        overrides: {
          employeeFindMany: async () => employees,
          departmentFindMany: async () => departments,
          departmentFindUnique: async ({ where }: { where: { id: string } }) => ({
            id: where.id,
            deptName: departments.find((item) => item.id === where.id)?.deptName ?? 'Unknown',
            organization: {
              id: 'org-1',
              name: 'RSUPPORT',
            },
          }),
          evalCycleFindMany: async () => [
            {
              id: 'cycle-2026',
              cycleName: '2026 KPI 설정',
              evalYear: 2026,
              status: 'KPI_SETTING',
              goalEditMode: 'OPEN',
            },
          ],
          personalKpiFindMany: async (args?: { where?: Record<string, unknown> }) => {
            const where = args?.where ?? {}
            return personalKpis.filter((item) => {
              const employeeId = where.employeeId as string | undefined
              const evalYear = where.evalYear as number | undefined
              const linkedOrgKpiWhere = where.linkedOrgKpiId as { in?: string[] } | undefined

              if (employeeId && item.employeeId !== employeeId) return false
              if (typeof evalYear === 'number' && item.evalYear !== evalYear) return false
              if (linkedOrgKpiWhere?.in && !linkedOrgKpiWhere.in.includes((item.linkedOrgKpiId as string | null) ?? '')) {
                return false
              }
              return true
            })
          },
          personalKpiCreateMany: async ({ data }: { data: Array<Record<string, unknown>> }) => {
            createdCount += data.length
            data.forEach((item, index) => {
              personalKpis.push({
                id: `boot-${createdCount}-${index}`,
                ...item,
                employee: {
                  empName:
                    employees.find((employee) => employee.id === item.employeeId)?.empName ?? 'Target Employee',
                  department: {
                    deptName:
                      departments.find((department) => department.id === employees.find((employee) => employee.id === item.employeeId)?.deptId)
                        ?.deptName ?? 'Unknown',
                  },
                },
                linkedOrgKpi: orgKpis.find((orgKpi) => orgKpi.id === item.linkedOrgKpiId),
                monthlyRecords: [],
                copiedFromPersonalKpi: null,
                updatedAt: new Date('2026-04-01T00:00:00.000Z'),
                createdAt: new Date('2026-04-01T00:00:00.000Z'),
              })
            })
            return { count: data.length }
          },
          orgKpiFindMany: async (args?: { where?: Record<string, unknown> }) => {
            const where = args?.where ?? {}
            return orgKpis.filter((item) => {
              const evalYear = where.evalYear as number | undefined
              const deptId = where.deptId as string | { in?: string[] } | undefined
              if (typeof evalYear === 'number' && item.evalYear !== evalYear) return false
              if (typeof deptId === 'string' && item.deptId !== deptId) return false
              if (deptId && typeof deptId === 'object' && Array.isArray(deptId.in) && !deptId.in.includes(item.deptId)) {
                return false
              }
              return item.status !== 'ARCHIVED'
            })
          },
          auditLogFindMany: async () => [],
          aiRequestLogFindMany: async () => [],
          multiFeedbackFindMany: async () => [],
        },
      }
    }

    const teamHarness = buildLoaderHarness([
      {
        id: 'leader-team',
        empId: 'EMP-TL',
        empName: 'Team Leader',
        role: 'ROLE_TEAM_LEADER',
        deptId: 'dept-team',
        teamLeaderId: null,
        sectionChiefId: null,
        divisionHeadId: null,
      },
    ])

    await withStubbedPersonalKpiPageData(teamHarness.overrides, async () => {
      const first = await getPersonalKpiPageData({
        session: {
          user: {
            id: 'leader-team',
            role: 'ROLE_TEAM_LEADER',
            name: 'Team Leader',
            deptId: 'dept-team',
            deptName: 'Customer Ops Team',
            accessibleDepartmentIds: ['dept-team'],
          },
        },
        year: 2026,
      })
      const second = await getPersonalKpiPageData({
        session: {
          user: {
            id: 'leader-team',
            role: 'ROLE_TEAM_LEADER',
            name: 'Team Leader',
            deptId: 'dept-team',
            deptName: 'Customer Ops Team',
            accessibleDepartmentIds: ['dept-team'],
          },
        },
        year: 2026,
      })

      assert.equal(first.mine.length, 1)
      assert.equal(first.mine[0]?.orgKpiId, 'org-team-1')
      assert.equal(teamHarness.getCreatedCount(), 1)
      assert.equal(second.mine.length, 1)
      assert.equal(teamHarness.personalKpis.length, 1)
    })

    const hrTeamLeaderHarness = buildLoaderHarness([
      {
        id: 'leader-hr',
        empId: 'EMP-HR-TL',
        empName: '인사팀장',
        role: 'ROLE_MEMBER',
        deptId: 'dept-team',
        teamLeaderId: null,
        sectionChiefId: 'leader-section',
        divisionHeadId: 'leader-division',
      },
    ])

    await withStubbedPersonalKpiPageData(hrTeamLeaderHarness.overrides, async () => {
      const data = await getPersonalKpiPageData({
        session: {
          user: {
            id: 'leader-hr',
            role: 'ROLE_MEMBER',
            name: '인사팀장',
            deptId: 'dept-team',
            deptName: 'Customer Ops Team',
            accessibleDepartmentIds: ['dept-team'],
          },
        },
        year: 2026,
      })

      assert.equal(data.mine.length, 1)
      assert.equal(data.mine[0]?.orgKpiId, 'org-team-1')
      assert.equal(hrTeamLeaderHarness.getCreatedCount(), 1)
      assert.equal(hrTeamLeaderHarness.personalKpis[0]?.linkedOrgKpiId, 'org-team-1')
    })

    const sectionHarness = buildLoaderHarness([
      {
        id: 'leader-section',
        empId: 'EMP-SC',
        empName: 'Section Chief',
        role: 'ROLE_SECTION_CHIEF',
        deptId: 'dept-section',
        teamLeaderId: null,
        sectionChiefId: null,
        divisionHeadId: null,
      },
    ])

    await withStubbedPersonalKpiPageData(sectionHarness.overrides, async () => {
      const data = await getPersonalKpiPageData({
        session: {
          user: {
            id: 'leader-section',
            role: 'ROLE_SECTION_CHIEF',
            name: 'Section Chief',
            deptId: 'dept-section',
            deptName: 'Customer Ops Section',
            accessibleDepartmentIds: ['dept-section'],
          },
        },
        year: 2026,
      })

      assert.equal(data.mine.length, 1)
      assert.equal(data.mine[0]?.orgKpiId, 'org-section-1')
    })

    const divisionHarness = buildLoaderHarness([
      {
        id: 'leader-division',
        empId: 'EMP-DH',
        empName: 'Division Head',
        role: 'ROLE_DIV_HEAD',
        deptId: 'dept-division',
        teamLeaderId: null,
        sectionChiefId: null,
        divisionHeadId: null,
      },
    ])

    await withStubbedPersonalKpiPageData(divisionHarness.overrides, async () => {
      const data = await getPersonalKpiPageData({
        session: {
          user: {
            id: 'leader-division',
            role: 'ROLE_DIV_HEAD',
            name: 'Division Head',
            deptId: 'dept-division',
            deptName: 'Customer Experience Division',
            accessibleDepartmentIds: ['dept-division'],
          },
        },
        year: 2026,
      })

      assert.equal(data.mine.length, 1)
      assert.equal(data.mine[0]?.orgKpiId, 'org-division-1')
    })

    const memberHarness = buildLoaderHarness([
      {
        id: 'member-1',
        empId: 'EMP-M1',
        empName: 'Member One',
        role: 'ROLE_MEMBER',
        deptId: 'dept-team',
        teamLeaderId: 'leader-team',
        sectionChiefId: 'leader-section',
        divisionHeadId: 'leader-division',
      },
    ])

    await withStubbedPersonalKpiPageData(memberHarness.overrides, async () => {
      const data = await getPersonalKpiPageData({
        session: {
          user: {
            id: 'member-1',
            role: 'ROLE_MEMBER',
            name: 'Member One',
            deptId: 'dept-team',
            deptName: 'Customer Ops Team',
            accessibleDepartmentIds: ['dept-team'],
          },
        },
        year: 2026,
      })

      assert.equal(data.mine.length, 0)
      assert.equal(memberHarness.getCreatedCount(), 0)
    })
  })

  await run('personal KPI leadership bootstrap uses viewed target employee context under impersonation-style access', async () => {
    const personalKpis: Array<Record<string, unknown>> = []

    await withStubbedPersonalKpiPageData(
      {
        employeeFindMany: async () => [
          {
            id: 'div-head-1',
            empId: 'EMP-DIV',
            empName: 'Viewed Division Head',
            role: 'ROLE_DIV_HEAD',
            deptId: 'dept-division',
            teamLeaderId: null,
            sectionChiefId: null,
            divisionHeadId: null,
          },
        ],
        departmentFindMany: async () => [{ id: 'dept-division', deptName: 'Customer Experience Division', parentDeptId: null }],
        departmentFindUnique: async () => ({
          id: 'dept-division',
          deptName: 'Customer Experience Division',
          organization: {
            id: 'org-1',
            name: 'RSUPPORT',
          },
        }),
        evalCycleFindMany: async () => [
          {
            id: 'cycle-2026',
            cycleName: '2026 KPI 설정',
            evalYear: 2026,
            status: 'KPI_SETTING',
            goalEditMode: 'OPEN',
          },
        ],
        personalKpiFindMany: async (args?: { where?: Record<string, unknown> }) => {
          const where = args?.where ?? {}
          return personalKpis.filter((item) => {
            if (where.employeeId && item.employeeId !== where.employeeId) return false
            if (where.evalYear && item.evalYear !== where.evalYear) return false
            if ((where.linkedOrgKpiId as { in?: string[] } | undefined)?.in) {
              return (where.linkedOrgKpiId as { in: string[] }).in.includes((item.linkedOrgKpiId as string) ?? '')
            }
            return true
          })
        },
        personalKpiCreateMany: async ({ data }: { data: Array<Record<string, unknown>> }) => {
          personalKpis.push(
            ...data.map((item, index) => ({
              id: `imp-${index}`,
              ...item,
              employee: {
                empName: 'Viewed Division Head',
                department: {
                  deptName: 'Customer Experience Division',
                },
              },
              linkedOrgKpi: {
                id: 'org-division-1',
                deptId: 'dept-division',
                kpiName: '본부 KPI 1',
                department: {
                  deptName: 'Customer Experience Division',
                },
                parentOrgKpiId: null,
              },
              monthlyRecords: [],
              copiedFromPersonalKpi: null,
              updatedAt: new Date('2026-04-01T00:00:00.000Z'),
              createdAt: new Date('2026-04-01T00:00:00.000Z'),
            }))
          )
          return { count: data.length }
        },
        orgKpiFindMany: async (args?: { where?: Record<string, unknown> }) => {
          const deptId = args?.where?.deptId as string | { in?: string[] } | undefined
          if (typeof deptId === 'string' && deptId !== 'dept-division') return []
          if (deptId && typeof deptId === 'object' && Array.isArray(deptId.in) && !deptId.in.includes('dept-division')) return []
          return [
            {
              id: 'org-division-1',
              deptId: 'dept-division',
              evalYear: 2026,
              kpiType: 'QUANTITATIVE',
              kpiCategory: '전략',
              kpiName: '본부 KPI 1',
              definition: '본부 전략 KPI',
              formula: 'E/F',
              targetValue: 95,
              targetValueT: 93,
              targetValueE: 95,
              targetValueS: 97,
              weight: 40,
              difficulty: 'HIGH',
              status: 'CONFIRMED',
              department: { deptName: 'Customer Experience Division' },
              parentOrgKpiId: null,
            },
          ]
        },
        auditLogFindMany: async () => [],
        aiRequestLogFindMany: async () => [],
        multiFeedbackFindMany: async () => [],
      },
      async () => {
        const data = await getPersonalKpiPageData({
          session: {
            user: {
              id: 'admin-1',
              role: 'ROLE_ADMIN',
              name: 'Admin User',
              deptId: 'dept-admin',
              deptName: 'Admin',
              accessibleDepartmentIds: ['dept-division'],
            },
          },
          year: 2026,
          employeeId: 'div-head-1',
        })

        assert.equal(data.selectedEmployeeId, 'div-head-1')
        assert.equal(data.mine.length, 1)
        assert.equal(data.mine[0]?.employeeId, 'div-head-1')
        assert.equal(data.mine[0]?.orgKpiId, 'org-division-1')
      }
    )
  })

  await run('personal KPI loader exposes the evidence record snapshot used by the evidence panel', async () => {
    await withStubbedPersonalKpiPageData(
      {
        personalKpiFindMany: async (args: any) => {
          if (args?.select?.evalYear) {
            return [{ evalYear: 2026 }]
          }

          return [
            {
              id: 'pk-evidence-1',
              employeeId: 'member-2',
              evalYear: 2026,
              kpiName: '재계약률 향상',
              tags: [],
              kpiType: 'QUANTITATIVE',
              definition: '핵심 고객 재계약률 유지',
              formula: '재계약 고객 수 / 전체 고객 수',
              targetValue: 95,
              weight: 40,
              difficulty: 'MEDIUM',
              status: 'CONFIRMED',
              reviewComment: null,
              linkedOrgKpiId: 'org-1',
              linkedOrgKpi: {
                id: 'org-1',
                kpiName: '고객 유지율',
                kpiCategory: '성과',
                definition: '재계약률 유지',
                department: {
                  deptName: 'Business Ops',
                },
              },
              employee: {
                id: 'member-2',
                empName: 'Member Two',
                deptId: 'dept-1',
                teamLeaderId: 'leader-1',
                sectionChiefId: null,
                divisionHeadId: null,
                department: {
                  deptName: 'Business Ops',
                },
              },
              monthlyRecords: [
                {
                  id: 'monthly-evidence-1',
                  yearMonth: '2026-04',
                  achievementRate: 90,
                  activities: '핵심 고객 follow-up',
                  obstacles: null,
                  evidenceComment: '4월 핵심 근거 정리',
                  attachments: [
                    {
                      id: 'file-1',
                      type: 'FILE',
                      name: '실적 보고서.pdf',
                      kind: 'REPORT',
                      uploadedAt: '2026-04-05T09:00:00.000Z',
                      uploadedBy: '구성원',
                      sizeLabel: '1.2MB',
                      dataUrl: 'data:application/pdf;base64,AAAA',
                      comment: '핵심 실적 요약',
                    },
                    {
                      id: 'link-1',
                      type: 'LINK',
                      name: 'Google Docs 링크',
                      kind: 'OTHER',
                      uploadedAt: '2026-04-06T09:00:00.000Z',
                      uploadedBy: '구성원',
                      url: 'https://docs.google.com/document/d/123/edit',
                      comment: '상세 설명 문서',
                    },
                  ],
                },
              ],
              updatedAt: new Date('2026-04-10T09:00:00Z'),
              createdAt: new Date('2026-02-01T09:00:00Z'),
            },
          ]
        },
      },
      async () => {
        const data = await getPersonalKpiPageData({
          session: {
            user: {
              id: 'member-2',
              role: 'ROLE_MEMBER',
              name: 'Member Two',
              deptId: 'dept-1',
              deptName: 'Business Ops',
              accessibleDepartmentIds: ['dept-1'],
            },
          },
          year: 2026,
        })

        assert.equal(data.state, 'ready')
        assert.equal(data.mine[0]?.evidenceRecord.yearMonth, '2026-04')
        assert.equal(data.mine[0]?.evidenceRecord.evidenceComment, '4월 핵심 근거 정리')
        assert.equal(data.mine[0]?.evidenceRecord.attachments.length, 2)
        assert.equal(data.mine[0]?.evidenceRecord.attachments[1]?.type, 'LINK')
      }
    )
  })

  await run('scope helper and permission helper use deterministic fallbacks and disable actions outside operational states', () => {
    assert.deepEqual(
      getPersonalKpiScopeDepartmentIds({
        role: 'ROLE_TEAM_LEADER',
        deptId: 'dept-team',
        accessibleDepartmentIds: undefined,
      }),
      ['dept-team']
    )

    const errorPermissions = buildPersonalKpiPermissions({
      actorId: 'emp-1',
      actorRole: 'ROLE_MEMBER',
      targetEmployeeId: 'emp-1',
      pageState: 'error',
      aiAccess: {
        allowed: true,
        reason: null,
      },
    })
    assert.equal(errorPermissions.canCreate, false)
    assert.equal(errorPermissions.canUseAi, false)

    const noTargetPermissions = buildPersonalKpiPermissions({
      actorId: 'leader-1',
      actorRole: 'ROLE_TEAM_LEADER',
      targetEmployeeId: 'member-2',
      pageState: 'no-target',
      aiAccess: {
        allowed: true,
        reason: null,
      },
    })
    assert.equal(noTargetPermissions.canCreate, false)
    assert.equal(noTargetPermissions.canSubmit, false)
    assert.equal(noTargetPermissions.canUseAi, false)

    const setupPermissions = buildPersonalKpiPermissions({
      actorId: 'leader-1',
      actorRole: 'ROLE_TEAM_LEADER',
      targetEmployeeId: 'member-2',
      pageState: 'setup-required',
      aiAccess: {
        allowed: true,
        reason: null,
      },
    })
    assert.equal(setupPermissions.canCreate, false)
    assert.equal(setupPermissions.canSubmit, false)
    assert.equal(setupPermissions.canUseAi, false)

    const memberSelfPermissions = buildPersonalKpiPermissions({
      actorId: 'member-2',
      actorRole: 'ROLE_MEMBER',
      targetEmployeeId: 'member-2',
      pageState: 'ready',
      aiAccess: {
        allowed: true,
        reason: null,
      },
    })
    const memberCrossPermissions = buildPersonalKpiPermissions({
      actorId: 'member-2',
      actorRole: 'ROLE_MEMBER',
      targetEmployeeId: 'member-3',
      pageState: 'ready',
      aiAccess: {
        allowed: true,
        reason: null,
      },
    })

    assert.equal(memberSelfPermissions.canCreate, true)
    assert.equal(memberSelfPermissions.canUseAi, true)
    assert.equal(memberSelfPermissions.canUseMidcheckCoach, false)
    assert.equal(memberCrossPermissions.canCreate, false)
    assert.equal(memberCrossPermissions.canUseAi, false)
    assert.equal(memberCrossPermissions.canUseMidcheckCoach, false)

    const leaderCoachingPermissions = buildPersonalKpiPermissions({
      actorId: 'leader-1',
      actorRole: 'ROLE_TEAM_LEADER',
      targetEmployeeId: 'member-2',
      targetEmployee: {
        id: 'member-2',
        teamLeaderId: 'leader-1',
        sectionChiefId: null,
        divisionHeadId: null,
      },
      pageState: 'ready',
      aiAccess: {
        allowed: true,
        reason: null,
      },
    })
    const leaderSelfPermissions = buildPersonalKpiPermissions({
      actorId: 'leader-1',
      actorRole: 'ROLE_TEAM_LEADER',
      targetEmployeeId: 'leader-1',
      targetEmployee: {
        id: 'leader-1',
        teamLeaderId: null,
        sectionChiefId: null,
        divisionHeadId: null,
      },
      pageState: 'ready',
      aiAccess: {
        allowed: true,
        reason: null,
      },
    })

    assert.equal(leaderCoachingPermissions.canUseMidcheckCoach, true)
    assert.equal(leaderSelfPermissions.canUseMidcheckCoach, false)
    assert.equal(
      canCoachPersonalKpiTarget({
        actorId: 'leader-1',
        actorRole: 'ROLE_TEAM_LEADER',
        targetEmployee: {
          id: 'member-2',
          teamLeaderId: 'leader-1',
          sectionChiefId: null,
          divisionHeadId: null,
        },
      }),
      true
    )
    assert.equal(
      canCoachPersonalKpiTarget({
        actorId: 'member-2',
        actorRole: 'ROLE_MEMBER',
        targetEmployee: {
          id: 'member-2',
          teamLeaderId: 'leader-1',
          sectionChiefId: null,
          divisionHeadId: null,
        },
      }),
      false
    )
  })

  await run('AI access resolver disables personal KPI AI consistently when feature or configuration is unavailable', () => {
    const featureOff = resolvePersonalKpiAiAccess({
      role: 'ROLE_MEMBER',
      env: {
        enabled: false,
        apiKey: 'test-key',
      },
    })
    const missingApiKey = resolvePersonalKpiAiAccess({
      role: 'ROLE_MEMBER',
      env: {
        enabled: true,
        apiKey: undefined,
      },
    })

    assert.equal(featureOff.allowed, false)
    assert.equal(featureOff.reason, 'feature-disabled')
    assert.equal(featureOff.message, '서버 AI 작성 보조 기능이 꺼져 있어 초안 생성을 사용할 수 없습니다.')
    assert.equal(missingApiKey.allowed, false)
    assert.equal(missingApiKey.reason, 'configuration-missing')
    assert.equal(
      missingApiKey.message,
      'AI provider 설정이 완료되지 않아 초안 생성을 사용할 수 없습니다. 관리자에게 설정 확인을 요청하세요.'
    )
  })

  await run('scoped employees still get department labels from department lookup even without embedded relation data', async () => {
    await withStubbedPersonalKpiPageData(
      {
        employeeFindMany: async () => [
          {
            id: 'emp-1',
            empId: 'EMP-001',
            empName: 'Employee One',
            role: 'ROLE_MEMBER',
            deptId: 'dept-1',
            teamLeaderId: null,
            sectionChiefId: null,
            divisionHeadId: null,
            department: null,
          },
        ],
        personalKpiFindMany: async () => [],
      },
      async () => {
        const data = await getPersonalKpiPageData({
          session: {
            user: {
              id: 'emp-1',
              role: 'ROLE_MEMBER',
              name: 'Employee One',
              deptId: 'dept-1',
              deptName: 'Business Ops',
              accessibleDepartmentIds: ['dept-1'],
            },
          },
          year: 2026,
        })

        assert.equal(data.state, 'empty')
        assert.equal(data.employeeOptions[0]?.departmentName, 'Business Ops')
      }
    )
  })

  await run('assignee selection returns the requested employee data and recomputes KPI summary from that employee rows', async () => {
    await withStubbedPersonalKpiPageData(
      {
        employeeFindMany: async () => [
          {
            id: 'member-1',
            empId: 'EMP-001',
            empName: 'Member One',
            role: 'ROLE_MEMBER',
            deptId: 'dept-1',
            teamLeaderId: 'leader-1',
            sectionChiefId: null,
            divisionHeadId: null,
          },
          {
            id: 'member-2',
            empId: 'EMP-002',
            empName: 'Member Two',
            role: 'ROLE_MEMBER',
            deptId: 'dept-1',
            teamLeaderId: 'leader-1',
            sectionChiefId: null,
            divisionHeadId: null,
          },
          {
            id: 'leader-1',
            empId: 'EMP-LEADER',
            empName: 'Leader One',
            role: 'ROLE_TEAM_LEADER',
            deptId: 'dept-1',
            teamLeaderId: null,
            sectionChiefId: null,
            divisionHeadId: null,
          },
        ],
        personalKpiFindMany: async (args: any) => {
          if (args?.select?.evalYear) {
            return [{ evalYear: 2026 }]
          }

          if (args?.where?.employeeId === 'member-2') {
            return [
              {
                id: 'pk-2',
                employeeId: 'member-2',
                evalYear: 2026,
                kpiType: 'QUANTITATIVE',
                kpiName: '재계약률 향상',
                definition: '재계약률을 95% 이상 유지한다.',
                formula: '재계약 고객 수 / 전체 고객 수 x 100',
                targetValue: 95,
                weight: 40,
                difficulty: 'MEDIUM',
                status: 'DRAFT',
                linkedOrgKpiId: 'org-1',
                linkedOrgKpi: {
                  id: 'org-1',
                  deptId: 'dept-1',
                  kpiName: '고객 유지율',
                  kpiCategory: '성과',
                  definition: '재계약률 유지',
                  department: {
                    deptName: 'Business Ops',
                  },
                },
                employee: {
                  id: 'member-2',
                  empName: 'Member Two',
                  deptId: 'dept-1',
                  teamLeaderId: 'leader-1',
                  sectionChiefId: null,
                  divisionHeadId: null,
                  department: {
                    deptName: 'Business Ops',
                  },
                },
                monthlyRecords: [
                  {
                    id: 'monthly-1',
                    yearMonth: '2026-03',
                    achievementRate: 92,
                    activities: '핵심 고객 follow-up',
                    obstacles: null,
                  },
                ],
                updatedAt: new Date('2026-03-01T09:00:00Z'),
                createdAt: new Date('2026-02-01T09:00:00Z'),
              },
            ]
          }

          return []
        },
        auditLogFindMany: async () => [],
      },
      async () => {
        const data = await getPersonalKpiPageData({
          session: {
            user: {
              id: 'leader-1',
              role: 'ROLE_TEAM_LEADER',
              name: 'Leader One',
              deptId: 'dept-1',
              deptName: 'Business Ops',
              accessibleDepartmentIds: ['dept-1'],
            },
          },
          year: 2026,
          employeeId: 'member-2',
        })

        assert.equal(data.state, 'ready')
        assert.equal(data.selectedEmployeeId, 'member-2')
        assert.equal(data.mine[0]?.title, '재계약률 향상')
        assert.equal(data.summary.totalCount, 1)
        assert.equal(data.summary.totalWeight, 40)
        assert.equal(data.summary.remainingWeight, 60)
        assert.equal(data.summary.linkedOrgKpiCount, 1)
        assert.equal(data.summary.mboPolicy.orgGoalCandidateCount, 1)
        assert.equal(data.summary.mboPolicy.reviewNeededCount, 1)
        assert.equal(data.mine[0]?.mboPolicy.guidanceLabel, '조직목표 후보')
      }
    )
  })

  await run('personal KPI 2026 MBO diagnostics classify org-linked, reflected-team, daily-work, and duplicate guidance', () => {
    const guidances = buildPersonalKpiMboPolicyGuidanceList2026([
      {
        id: 'pk-division',
        title: '본부 KPI 반영',
        policyCategory: null,
        linkedOrgKpiId: 'org-division',
        linkedOrgKpi: {
          id: 'org-division',
          title: '본부 KPI 반영',
          level: 'DIVISION',
          status: 'CONFIRMED',
        },
      },
      {
        id: 'pk-team-reflected',
        title: '반영 팀 KPI',
        policyCategory: null,
        linkedOrgKpiId: 'org-team-reflected',
        linkedOrgKpi: {
          id: 'org-team-reflected',
          title: '반영 팀 KPI',
          level: 'TEAM',
          latestReviewVerdict: 'ADEQUATE',
          status: 'CONFIRMED',
        },
      },
      {
        id: 'pk-team-excluded',
        title: '미반영 팀 KPI',
        policyCategory: null,
        linkedOrgKpiId: 'org-team-excluded',
        linkedOrgKpi: {
          id: 'org-team-excluded',
          title: '미반영 팀 KPI',
          level: 'TEAM',
          latestReviewVerdict: 'INSUFFICIENT',
          status: 'CONFIRMED',
        },
      },
      {
        id: 'pk-team-reviewing',
        title: '검토 중 팀 KPI',
        policyCategory: null,
        linkedOrgKpiId: 'org-team-reviewing',
        linkedOrgKpi: {
          id: 'org-team-reviewing',
          title: '검토 중 팀 KPI',
          level: 'TEAM',
          latestReviewVerdict: 'CAUTION',
          status: 'CONFIRMED',
        },
      },
      {
        id: 'pk-daily-duplicate',
        title: '본부 KPI 반영',
        policyCategory: 'DAILY_WORK',
        definition: '본부 KPI 반영 업무',
      },
    ])

    const division = guidances.find((item) => item.itemId === 'pk-division')
    const reflected = guidances.find((item) => item.itemId === 'pk-team-reflected')
    const excluded = guidances.find((item) => item.itemId === 'pk-team-excluded')
    const reviewing = guidances.find((item) => item.itemId === 'pk-team-reviewing')
    const duplicate = guidances.find((item) => item.itemId === 'pk-daily-duplicate')

    assert.equal(division?.suggestedCategory, 'ORG_GOAL')
    assert.equal(division?.guidanceMessage.includes('본부 KPI와 연결'), true)
    assert.equal(division?.issues.some((issue) => issue.code === 'MISSING_MBO_CATEGORY'), true)
    assert.equal(reflected?.suggestedCategory, 'ORG_GOAL')
    assert.equal(reflected?.guidanceMessage.includes('HR 반영 완료 팀 KPI'), true)
    assert.equal(excluded?.suggestedCategory, 'DAILY_WORK')
    assert.equal(excluded?.linkedOrgKpi?.hrReflectionState, 'EXCLUDED')
    assert.equal(excluded?.hrExceptionRequired, true)
    assert.equal(reviewing?.suggestedCategory, 'DAILY_WORK')
    assert.equal(reviewing?.guidanceLabel, '검토 중')
    assert.equal(reviewing?.linkedOrgKpi?.hrReflectionLabel, '검토 중')
    assert.equal(duplicate?.duplicateDailyWork, true)
    assert.equal(duplicate?.issues.some((issue) => issue.code === 'DAILY_WORK_DUPLICATES_ORG_GOAL'), true)
  })

  await run('personal KPI client surfaces compact non-blocking 2026 MBO guidance without changing save validation', () => {
    const source = read('src/components/kpi/PersonalKpiManagementClient.tsx')
    const scheduleSource = read('src/lib/evaluation-2026-schedule-readiness.ts')
    const validateStart = source.indexOf('function validateKpiForm')
    const validateEnd = source.indexOf('function getReviewActionState', validateStart)
    const validateSource = source.slice(validateStart, validateEnd > validateStart ? validateEnd : validateStart + 2000)

    assert.equal(source.includes('2026 MBO 정책 점검'), true)
    assert.equal(source.includes('2026 MBO 설정 안내'), true)
    assert.equal(source.includes('현재 화면은 2026 MBO 작성/정렬 준비 단계입니다.'), true)
    assert.equal(source.includes('2026 수행결과 작성 준비 안내'), true)
    assert.equal(source.includes('수행결과는 달성 여부만이 아니라 본인 기여, 산출물, 증빙 중심으로 작성해야 합니다.'), true)
    assert.equal(source.includes('AI 활용평가 증빙은 연간 업적점수와 별도 Pass/Fail readiness로 관리합니다.'), true)
    assert.equal(source.includes('이 안내는 read-only이며 저장/제출/점수 계산을 변경하지 않습니다.'), true)
    assert.equal(source.includes('작성 품질 체크'), true)
    assert.equal(source.includes('조직목표/프로젝트 T/프로젝트 K/일상업무 중 하나로 HR 확인이 필요합니다.'), true)
    assert.equal(source.includes('본부 KPI 또는 HR 반영 완료 팀 KPI는 조직목표로 설정할 수 있습니다.'), true)
    assert.equal(source.includes('formatPersonalOrgKpiOptionLabel(option)'), true)
    assert.equal(source.includes('option.mboReflection?.personalMboLabel'), true)
    assert.equal(source.includes('getPersonalOrgKpiReflectionHelper'), true)
    assert.equal(source.includes('예외 승인 사유: ${option.mboReflection.exceptionReason}'), true)
    assert.equal(source.includes('예외 승인 사유: {exceptionReason}'), true)
    assert.equal(source.includes('공식 점수에는 반영되지 않는 비차단 안내입니다.'), true)
    assert.equal(source.includes('저장/제출을 막지 않는 참고 정보입니다.'), true)
    assert.equal(source.includes('2026 목표 수정 일정 안내'), true)
    assert.equal(scheduleSource.includes('현재는 공식 목표 수정 기간이 아닙니다. 수정이 필요한 경우 목표 변경 신청 절차를 확인해 주세요.'), true)
    assert.equal(source.includes('이 안내는 비차단 readiness guidance이며 기존 저장/제출 동작을 변경하지 않습니다.'), true)
    assert.equal(validateSource.includes('mboPolicy'), false)
  })

  await run('personal KPI review queue exposes safe return-to-draft action with reason requirement', () => {
    const source = read('src/components/kpi/PersonalKpiManagementClient.tsx')
    const workflowRouteSource = read('src/app/api/kpi/personal/[id]/workflow/route.ts')
    const reviewQueueStart = source.indexOf('function GoalReviewQueueSection(props: {')
    const reviewQueueEnd = source.indexOf('function BulkEditPersonalKpiModal(', reviewQueueStart)
    const reviewQueueBlock = source.slice(reviewQueueStart, reviewQueueEnd)

    assert.notEqual(reviewQueueStart, -1)
    assert.notEqual(reviewQueueEnd, -1)
    assert.equal(source.includes("action: 'START_REVIEW' | 'APPROVE' | 'REJECT' | 'REOPEN'"), true)
    assert.equal(source.includes("action === 'REOPEN' && reviewNote.trim().length < 5"), true)
    assert.equal(source.includes('개인 KPI 초안으로 되돌리기'), true)
    assert.equal(reviewQueueBlock.includes('초안으로 되돌리기'), true)
    assert.equal(reviewQueueBlock.includes('reopenReasonMissing'), true)
    assert.equal(reviewQueueBlock.includes("props.onAction(selectedItem.id, 'REOPEN')"), true)
    assert.equal(reviewQueueBlock.includes('삭제가 아니며'), true)
    assert.equal(workflowRouteSource.includes("validated.data.action === 'REOPEN'"), true)
    assert.equal(workflowRouteSource.includes('REOPEN_REASON_REQUIRED'), true)
  })

  await run('personal KPI client disables create and AI hero CTAs when the server says they are unavailable', () => {
    const source = read('src/components/kpi/PersonalKpiManagementClient.tsx')

    assert.equal(source.includes('disabled={Boolean(props.createDisabledReason)}'), true)
    assert.equal(source.includes('disabled={Boolean(props.aiDisabledReason)}'), true)
    assert.equal(source.includes('aiHelperText={aiHeroHelperText}'), true)
    assert.equal(source.includes('const aiHeroHelperText ='), true)
    assert.equal(source.includes("aiActionStates['generate-draft']?.reason"), true)
    assert.equal(source.includes('{props.aiHelperText ? <p>{props.aiHelperText}</p> : null}'), true)
    assert.equal(source.includes("const createDisabledReason ="), true)
    assert.equal(source.includes('const resolvedAiDisabledReason ='), true)
    assert.equal(source.includes('개인 KPI AI 작성 보조는 본인 KPI 작성 화면에서 사용할 수 있습니다.'), true)
    assert.equal(source.includes('서버 AI 작성 보조 기능이 꺼져 있어 초안 생성을 사용할 수 없습니다.'), false)
    assert.equal(source.includes('props.aiAccess.message'), true)
    assert.equal(source.includes("description={props.unavailableReason ?? PERSONAL_KPI_AI_PERMISSION_DENIED_MESSAGE}"), true)
    assert.equal(source.includes('AI 기능이 비활성화되어 있거나 현재 계정 권한으로는 사용할 수 없습니다.'), false)
    assert.equal(source.includes('일부 운영 정보를 불러오지 못해 기본 화면으로 표시 중입니다.'), true)
  })

  await run('personal KPI AI draft generation keeps a default linked org KPI in zero-KPI self-service context', () => {
    const source = read('src/components/kpi/PersonalKpiManagementClient.tsx')

    assert.equal(source.includes("function buildEmptyForm(year: number, employeeId: string, defaultLinkedOrgKpiId = '')"), true)
    assert.equal(source.includes('const defaultLinkedOrgKpiId = props.orgKpiOptions[0]?.id ?? \'\''), true)
    assert.equal(source.includes('linkedOrgKpiId: defaultLinkedOrgKpiId,'), true)
    assert.equal(source.includes('buildEmptyForm(props.selectedYear, props.selectedEmployeeId, defaultLinkedOrgKpiId)'), true)
  })

  await run('personal KPI AI route now uses the same access resolver as the page', () => {
    const routeSource = read('src/app/api/kpi/personal/ai/route.ts')

    assert.equal(routeSource.includes('resolvePersonalKpiAiAccess'), true)
    assert.equal(routeSource.includes('canAccessPersonalKpiTarget'), true)
    assert.equal(routeSource.includes("throw new AppError(403, 'FORBIDDEN', aiAccess.message"), true)
    assert.equal(routeSource.includes('개인 KPI AI 작성 보조는 본인 KPI 작성 화면에서 사용할 수 있습니다.'), true)
  })

  await run('personal KPI AI access view and UI copy separate configuration, scope, and official score safety reasons', () => {
    const accessSource = read('src/lib/personal-kpi-access.ts')
    const loaderSource = read('src/server/personal-kpi-page.ts')
    const source = read('src/components/kpi/PersonalKpiManagementClient.tsx')

    assert.equal(accessSource.includes('export type PersonalKpiAiAccessView'), true)
    assert.equal(accessSource.includes('toPersonalKpiAiAccessView'), true)
    assert.equal(loaderSource.includes('aiAccess: PersonalKpiAiAccessView'), true)
    assert.equal(loaderSource.includes('aiAccess: aiAccessView'), true)
    assert.equal(source.includes('function getPersonalKpiAiUnavailableReason(props: Props)'), true)
    assert.equal(source.includes('현재 계정에는 개인 KPI AI 작성 보조 권한이 없습니다.'), true)
    assert.equal(source.includes('개인 KPI AI 작성 보조는 본인 KPI 작성 화면에서 사용할 수 있습니다.'), true)
    assert.equal(source.includes('AI 초안 생성을 위해 먼저 연계할 조직 KPI를 선택하세요.'), true)
    assert.equal(source.includes('AI는 개인 KPI 작성과 표현 정리를 돕는 보조 기능입니다. 결과는 저장 전 초안이며 사용자가 직접 확인해야 합니다.'), true)
    assert.equal(source.includes('공식 평가 점수나 등급을 산정하지 않습니다.'), true)
  })

  await run('personal KPI AI hides leader-only actions from members in UI and API', () => {
    const source = read('src/components/kpi/PersonalKpiManagementClient.tsx')
    const routeSource = read('src/app/api/kpi/personal/ai/route.ts')

    assert.equal(source.includes('MEMBER_ALLOWED_PERSONAL_KPI_AI_ACTIONS'), true)
    assert.equal(source.includes('LEADER_ONLY_PERSONAL_KPI_AI_ACTIONS'), true)
    assert.equal(source.includes('getVisiblePersonalKpiAiActions(props.permissions.canReview)'), true)
    assert.equal(source.includes('MEMBER_ALLOWED_PERSONAL_KPI_AI_ACTIONS.has(item.action)'), true)
    assert.equal(source.includes("new Set<AiAction>(['summarize-review-risks'])"), true)
    assert.equal(routeSource.includes('canReviewPersonalKpi'), true)
    assert.equal(routeSource.includes('LEADER_ONLY_PERSONAL_KPI_AI_ACTIONS'), true)
    assert.equal(routeSource.includes('현재 계정에는 리더/검토용 개인 KPI AI 보조 권한이 없습니다.'), true)
  })

  await run('shared AI assist responses request opts out of provider-side storage', () => {
    const source = read('src/lib/ai-assist.ts')

    assert.equal(source.includes('store: false'), true)
  })

  await run('personal KPI AI route masks raw structured-output failures with a Korean fallback message', () => {
    const routeSource = read('src/app/api/kpi/personal/ai/route.ts')

    assert.equal(routeSource.includes('PERSONAL_KPI_AI_PUBLIC_ERROR_MESSAGE'), true)
    assert.equal(
      routeSource.includes(
        'AI 초안 생성 중 설정 오류가 발생했습니다. 잠시 후 다시 시도해 주세요. 문제가 계속되면 관리자에게 문의해 주세요.'
      ),
      true
    )
    assert.equal(routeSource.includes("error.code.startsWith('AI_')"), true)
    assert.equal(routeSource.includes("error.message.includes('response_format')"), true)
  })

  await run('personal KPI client resets stale selection and editor state when assignee scope changes', () => {
    const source = read('src/components/kpi/PersonalKpiManagementClient.tsx')

    assert.equal(source.includes('setActiveTabState(\'mine\')'), true)
    assert.equal(source.includes('setEditorOpen(false)'), true)
    assert.equal(source.includes('setAiPreview(null)'), true)
    assert.equal(source.includes('employeeId: saved.employeeId'), true)
    assert.equal(source.includes('kpiId: saved.id'), true)
  })

  await run('personal KPI workspace follows the PPT personal-goal detail parity structure', () => {
    const source = read('src/components/kpi/PersonalKpiManagementClient.tsx')

    assert.equal(source.includes('function SummaryCards'), false)
    assert.equal(source.includes('function MetricCard'), false)
    assert.equal(source.includes('function SelectorCard'), false)
    assert.equal(source.includes('availableYears={props.availableYears}'), false)
    assert.equal(source.includes('onChangeYear={(year) => handleRouteSelection({ year, tab: \'mine\', kpiId: \'\' })}'), false)
    assert.equal(source.includes('onChangeCycle={(cycleId) => handleRouteSelection({ cycleId, tab: \'mine\', kpiId: \'\' })}'), false)
    assert.equal(source.includes('onChangeEmployee={(employeeId) => handleRouteSelection({ employeeId, tab: \'mine\', kpiId: \'\' })}'), false)
    assert.equal(source.includes('StatusBadge status={props.summary.overallStatus}'), false)
    assert.equal(source.includes('운영 중'), false)
    assert.equal(source.includes('전체 개인 KPI'), false)
    assert.equal(source.includes('조직 KPI 연결 비율'), false)
    assert.equal(source.includes('Personal KPI workspace'), true)
    assert.equal(source.includes('AI 작성 보조'), true)
    assert.equal(source.includes('개인목표 목록'), true)
    assert.equal(source.includes('PmsMetricRail'), true)
    assert.equal(source.includes('개인목표 상세'), true)
    assert.equal(source.includes('ReadOnlyGoalField'), true)
    assert.equal(source.includes('업무수행 직접 역량레벨'), true)
    assert.equal(source.includes('진행 프로젝트명'), true)
    assert.equal(source.includes('수정 버튼으로 기존 입력 화면을 열어 저장하세요.'), true)
    assert.equal(source.includes('PmsDetailPanel'), false)
    assert.equal(source.includes('PmsProgressRing'), false)
    assert.equal(source.includes('PmsTrafficLight'), false)
    assert.equal(source.includes('buildPersonalCockpitMetrics'), true)
    assert.equal(source.includes('xl:grid-cols-5'), true)
    assert.equal(source.includes('grid items-start gap-4 min-[1440px]:grid-cols-[minmax(0,1fr)_minmax(540px,620px)]'), true)
    assert.equal(source.includes('h-fit self-start rounded-2xl'), true)
    assert.equal(source.includes('min-[1440px]:grid-cols-[minmax(0,1fr)_minmax(540px,620px)]'), true)
    assert.equal(source.includes('min-[1440px]:sticky min-[1440px]:top-4'), true)
    assert.equal(source.includes('md:grid-cols-[64px_minmax(0,1.05fr)_minmax(120px,0.95fr)_minmax(96px,0.65fr)_56px_76px_78px_28px]'), true)
    assert.equal(source.includes('목표가 적은 경우 상단 KPI 추가 또는 AI 초안 생성으로 보완할 수 있습니다.'), true)
    assert.equal(source.includes('증빙은 월간 실적에서 관리'), true)
    assert.equal(source.includes('ChevronRight'), true)
    assert.equal(source.includes('CompactActionButton'), true)
    assert.equal(source.includes('KPI 추가'), true)
    assert.equal(source.includes('목표 일괄 수정'), true)
    assert.equal(source.includes('AI 초안 생성'), true)
    assert.equal(source.includes('검토 대기 보기'), true)
    assert.equal(source.includes('이력 보기'), true)
    assert.equal(source.includes('승인 요청'), true)
  })

  await run('personal KPI editor modal removes goal tags and uses explicit T/E/S target inputs', () => {
    const source = read('src/components/kpi/PersonalKpiManagementClient.tsx')
    const editorStart = source.indexOf('function EditorModal(props: {')
    const editorEnd = source.indexOf('function SectionCard(', editorStart)
    const editorBlock = source.slice(editorStart, editorEnd)

    assert.notEqual(editorStart, -1)
    assert.notEqual(editorEnd, -1)
    assert.equal(editorBlock.includes('목표 태그'), false)
    assert.equal(editorBlock.includes('targetValue: event.target.value'), false)
    assert.equal(editorBlock.includes('targetValueT: event.target.value'), true)
    assert.equal(editorBlock.includes('targetValueE: event.target.value'), true)
    assert.equal(editorBlock.includes('targetValueS: event.target.value'), true)
    assert.equal(editorBlock.includes('T 필수'), true)
    assert.equal(editorBlock.includes('T는 필수이며 E와 S는 필요할 때만 입력하세요.'), true)
  })

  await run('personal KPI review queue cards use a clean middle-dot separator between employee and department', () => {
    const source = read('src/components/kpi/PersonalKpiManagementClient.tsx')
    const reviewQueueStart = source.indexOf('function GoalReviewQueueSection(props: {')
    const reviewQueueEnd = source.indexOf('function BulkEditPersonalKpiModal(', reviewQueueStart)
    const reviewQueueBlock = source.slice(reviewQueueStart, reviewQueueEnd)

    assert.notEqual(reviewQueueStart, -1)
    assert.notEqual(reviewQueueEnd, -1)
    assert.equal(reviewQueueBlock.includes('{item.employeeName} · {item.departmentName}'), true)
    assert.equal(reviewQueueBlock.includes('{item.employeeName} 쨌 {item.departmentName}'), false)
  })

  await run('personal KPI approval, detail, and bulk edit labels use the inline separator helper without any broken token', () => {
    const source = read('src/components/kpi/PersonalKpiManagementClient.tsx')

    assert.equal(source.includes('쨌'), false)
    assert.equal(source.includes("import { joinInlineParts } from '@/lib/metric-copy'"), true)
    assert.equal(source.includes('{joinInlineParts([segment.departmentName, segment.title])}'), true)
    assert.equal(source.includes('{joinInlineParts([history.actor, history.note])}'), true)
    assert.equal(source.includes('{joinInlineParts([employee.name, employee.departmentName])}'), true)
    assert.equal(source.includes('formatPersonalOrgKpiOptionLabel(option)'), true)
    assert.equal(source.includes('joinInlineParts([option.title, option.departmentName, option.mboReflection?.personalMboLabel])'), true)
  })

  await run('personal KPI selection preserves scroll when syncing kpiId into the URL', () => {
    const source = read('src/components/kpi/PersonalKpiManagementClient.tsx')
    const routeSelectionStart = source.indexOf('function handleRouteSelection(next: {')
    const routeSelectionEnd = source.indexOf('function handleOpenCreate()', routeSelectionStart)
    const routeSelectionBlock = source.slice(routeSelectionStart, routeSelectionEnd)

    assert.notEqual(routeSelectionStart, -1)
    assert.notEqual(routeSelectionEnd, -1)
    assert.equal(routeSelectionBlock.includes('router.replace(`/kpi/personal?${query}`, { scroll: false })'), true)
    assert.equal(source.includes('function handleSelectKpi(kpiId: string) {'), true)
    assert.equal(source.includes('handleRouteSelection({ kpiId })'), true)
  })

  await run('personal KPI client gates edit, review, and AI actions with live operational state instead of dead-ending in the API', () => {
    const source = read('src/components/kpi/PersonalKpiManagementClient.tsx')

    assert.equal(source.includes('function getReviewActionState('), true)
    assert.equal(source.includes('const aiActionStates = Object.fromEntries('), true)
    assert.equal(source.includes('if (!isDraftStatus(kpi.status))'), true)
    assert.equal(source.includes('disabled={!props.canReview || props.busy || startReviewState.disabled}'), true)
    assert.equal(source.includes('disabled={props.busy || props.actionStates[item.action]?.disabled}'), true)
  })

  await run('personal KPI AI preview client shows a Korean fallback instead of raw structured-output schema errors', () => {
    const source = read('src/components/kpi/PersonalKpiManagementClient.tsx')

    assert.equal(source.includes('PERSONAL_KPI_AI_PREVIEW_ERROR_MESSAGE'), true)
    assert.equal(
      source.includes(
        'AI 초안 생성 중 설정 오류가 발생했습니다. 잠시 후 다시 시도해 주세요. 문제가 계속되면 관리자에게 문의해 주세요.'
      ),
      true
    )
    assert.equal(source.includes('function toPersonalKpiAiPreviewErrorMessage('), true)
    assert.equal(source.includes('const data = await parseAiJsonOrThrow<{'), true)
  })

  await run('personal KPI mine panel keeps evidence editing and only shows AI midcheck coaching in authorized leadership scope', () => {
    const source = read('src/components/kpi/PersonalKpiManagementClient.tsx')

    assert.equal(source.includes('PersonalKpiEvidencePanel'), true)
    assert.equal(source.includes('PersonalKpiMidcheckCoachCard'), true)
    assert.equal(source.includes('증빙 자료'), true)
    assert.equal(source.includes('증빙 코멘트'), true)
    assert.equal(source.includes('Google Drive 링크'), true)
    assert.equal(source.includes('파일 첨부'), true)
    assert.equal(source.includes('증빙 저장'), true)
    assert.equal(source.includes('/api/kpi/monthly-record'), true)
    assert.equal(source.includes('/api/kpi/personal/${selectedKpi.id}/midcheck-coach'), true)
    assert.equal(source.includes('{props.permissions.canUseMidcheckCoach ? ('), true)
    assert.equal(source.includes('AI 중간 점검 코치'), true)
    assert.equal(source.includes('AI 코칭 받기'), true)
    assert.equal(source.includes('다시 생성'), true)
    assert.equal(source.includes('화면 초안에 반영'), true)
    assert.equal(source.includes('저장 전 화면 초안에만 추가했습니다'), true)
    assert.equal(source.includes('관리자 공유용 문안 복사'), true)
    assert.equal(source.includes('navigator.clipboard.writeText'), true)
    assert.equal(source.includes('appendCoachDraft('), true)
  })

  await run('personal KPI AI draft payload now carries real cascade and existing KPI context instead of a shallow single-title prompt', () => {
    const source = read('src/components/kpi/PersonalKpiManagementClient.tsx')
    const serverSource = read('src/server/ai/personal-kpi.ts')

    assert.equal(source.includes('employeeProfile:'), true)
    assert.equal(source.includes('linkedOrgKpiId,'), true)
    assert.equal(source.includes('orgLineage:'), true)
    assert.equal(source.includes('existingPersonalKpis:'), true)
    assert.equal(serverSource.includes('loadOrgKpiCascade('), true)
    assert.equal(serverSource.includes('divisionGoal:'), true)
    assert.equal(serverSource.includes('teamGoal:'), true)
    assert.equal(serverSource.includes('teamRecommendationContext:'), true)
    assert.equal(serverSource.includes('businessContext:'), true)
    assert.equal(serverSource.includes('2026 MBO 카테고리 구조(조직목표, 프로젝트 T, 프로젝트 K, 일상업무)를 기준으로 초안 성격을 설명합니다.'), true)
    assert.equal(serverSource.includes('조직목표는 본부 KPI 또는 HR 승인 팀 KPI와 연결된 목표로만 제안'), true)
    assert.equal(serverSource.includes("sourceType: 'PersonalKpiDraft'"), true)
  })

  await run('personal KPI AI preview now supports selecting truly different draft options with cascade-aware labels', () => {
    const source = read('src/components/kpi/PersonalKpiManagementClient.tsx')
    const previewSource = read('src/components/kpi/KpiAiPreviewPanel.tsx')

    assert.equal(source.includes('extractKpiAiPreviewRecommendations'), true)
    assert.equal(source.includes('selectedAiRecommendationIndex'), true)
    assert.equal(source.includes('handleSelectAiRecommendation'), true)
    assert.equal(source.includes('AiRecommendationSwitchDialog'), true)
    assert.equal(previewSource.includes('초안 유형'), true)
    assert.equal(previewSource.includes('정렬 기준'), true)
    assert.equal(previewSource.includes('추천 이유'), true)
    assert.equal(previewSource.includes('연계 조직 KPI'), true)
    assert.equal(previewSource.includes('본부 KPI'), true)
    assert.equal(previewSource.includes('팀 KPI'), true)
    assert.equal(previewSource.includes('화면 초안에 반영'), true)
    assert.equal(source.includes('다른 관점으로 다시 생성'), true)
  })

  console.log('Personal KPI workspace tests completed')
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })


