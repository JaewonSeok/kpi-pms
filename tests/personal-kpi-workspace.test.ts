/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
import 'dotenv/config'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import Module from 'node:module'
import path from 'node:path'
import { prisma } from '../src/lib/prisma'
import {
  buildPersonalKpiPermissions,
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

const { getPersonalKpiPageData } = require('../src/server/personal-kpi-page') as typeof import('../src/server/personal-kpi-page')

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
    assert.equal(missingApiKey.allowed, false)
    assert.equal(missingApiKey.reason, 'configuration-missing')
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
                unit: '%',
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
      }
    )
  })

  await run('personal KPI client disables create and AI hero CTAs when the server says they are unavailable', () => {
    const source = read('src/components/kpi/PersonalKpiManagementClient.tsx')

    assert.equal(source.includes('disabled={Boolean(props.createDisabledReason)}'), true)
    assert.equal(source.includes('disabled={Boolean(props.aiDisabledReason)}'), true)
    assert.equal(source.includes("const createDisabledReason ="), true)
    assert.equal(source.includes("const aiDisabledReason ="), true)
    assert.equal(source.includes('일부 운영 정보를 불러오지 못해 기본 화면으로 표시 중입니다.'), true)
  })

  await run('personal KPI AI route now uses the same access resolver as the page', () => {
    const routeSource = read('src/app/api/kpi/personal/ai/route.ts')

    assert.equal(routeSource.includes('resolvePersonalKpiAiAccess'), true)
    assert.equal(routeSource.includes("throw new AppError(403, 'FORBIDDEN', aiAccess.message"), true)
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
    assert.equal(source.includes('onChangeEmployee={(employeeId) => handleRouteSelection({ employeeId, tab: \'mine\', kpiId: \'\' })}'), true)
    assert.equal(source.includes('employeeId: saved.employeeId'), true)
    assert.equal(source.includes('kpiId: saved.id'), true)
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
    assert.equal(source.includes("import { formatCountWithUnit, formatRateBaseCopy, joinInlineParts } from '@/lib/metric-copy'"), true)
    assert.equal(source.includes('{joinInlineParts([segment.departmentName, segment.title])}'), true)
    assert.equal(source.includes('{joinInlineParts([history.actor, history.note])}'), true)
    assert.equal(source.includes('{joinInlineParts([employee.name, employee.departmentName])}'), true)
    assert.equal(source.includes('{joinInlineParts([option.title, option.departmentName])}'), true)
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


