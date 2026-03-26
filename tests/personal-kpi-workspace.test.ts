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
        empName: '팀장',
        role: 'ROLE_TEAM_LEADER',
        deptId: 'dept-1',
        status: 'ACTIVE',
        department: {
          deptName: '사업지원팀',
        },
      },
      {
        id: 'member-2',
        empId: 'EMP-MEMBER-2',
        empName: '구성원2',
        role: 'ROLE_MEMBER',
        deptId: 'dept-1',
        status: 'ACTIVE',
        department: {
          deptName: '사업지원팀',
        },
      },
    ])
  prismaAny.department.findUnique =
    overrides.departmentFindUnique ??
    (async () => ({
      id: 'dept-1',
      deptName: '사업지원팀',
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
        cycleName: '2026 KPI 설정',
        evalYear: 2026,
        status: 'KPI_SETTING',
      },
    ])
  let personalKpiFindManyCallCount = 0
  prismaAny.personalKpi.findMany =
    overrides.personalKpiFindMany ??
    (async () => {
      personalKpiFindManyCallCount += 1
      return personalKpiFindManyCallCount === 1 ? [] : []
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
            name: '팀장',
            deptId: 'dept-1',
            deptName: '사업지원팀',
            accessibleDepartmentIds: undefined as never,
          },
        },
        year: 2026,
        employeeId: 'member-2',
      })

      assert.equal(data.state, 'empty')
      assert.equal(data.summary.totalCount, 0)
      assert.notEqual(data.message, '개인 KPI 데이터를 불러오는 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.')
    })
  })

  await run('zero personal KPI rows render as empty state, not error state', async () => {
    await withStubbedPersonalKpiPageData(
      {
        employeeFindMany: async () => [
          {
            id: 'member-2',
            empId: 'EMP-MEMBER-2',
            empName: '구성원2',
            role: 'ROLE_MEMBER',
            deptId: 'dept-1',
            status: 'ACTIVE',
            department: {
              deptName: '사업지원팀',
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
              name: '구성원2',
              deptId: 'dept-1',
              deptName: '사업지원팀',
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

  await run('no-target, setup-required, and error fallbacks stay distinct', async () => {
    await withStubbedPersonalKpiPageData(
      {
        employeeFindMany: async () => [],
      },
      async () => {
        const denied = await getPersonalKpiPageData({
          session: {
            user: {
              id: 'leader-1',
              role: 'ROLE_TEAM_LEADER',
              name: '팀장',
              deptId: 'dept-1',
              deptName: '사업지원팀',
              accessibleDepartmentIds: ['dept-1'],
            },
          },
          year: 2026,
          employeeId: 'missing-user',
        })

        assert.equal(denied.state, 'no-target')
      }
    )

    await withStubbedPersonalKpiPageData(
      {
        employeeFindMany: async () => [],
      },
      async () => {
        const setupRequired = await getPersonalKpiPageData({
          session: {
            user: {
              id: 'leader-1',
              role: 'ROLE_TEAM_LEADER',
              name: '리더',
              deptId: 'dept-1',
              deptName: '사업지원팀',
              accessibleDepartmentIds: ['dept-1'],
            },
          },
          year: 2026,
        })

        assert.equal(setupRequired.state, 'setup-required')
      }
    )

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
          const failed = await getPersonalKpiPageData({
            session: {
              user: {
                id: 'leader-1',
                role: 'ROLE_TEAM_LEADER',
                name: '팀장',
                deptId: 'dept-1',
                deptName: '사업지원팀',
                accessibleDepartmentIds: ['dept-1'],
              },
            },
            year: 2026,
          })

          assert.equal(failed.state, 'error')
          assert.equal(failed.message, '개인 KPI 데이터를 불러오는 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.')
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

    const permissions = buildPersonalKpiPermissions({
      actorId: 'emp-1',
      actorRole: 'ROLE_MEMBER',
      targetEmployeeId: 'emp-1',
      pageState: 'error',
      aiAccess: {
        allowed: true,
        reason: null,
      },
    })

    assert.equal(permissions.canCreate, false)
    assert.equal(permissions.canUseAi, false)

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

    assert.equal(noTargetPermissions.canCreate, false)
    assert.equal(noTargetPermissions.canSubmit, false)
    assert.equal(noTargetPermissions.canUseAi, false)
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
                name: '팀장',
                deptId: 'dept-1',
                deptName: '사업지원팀',
                accessibleDepartmentIds: ['dept-1'],
              },
            },
            year: 2026,
          })

          assert.equal(data.state, 'empty')
          assert.equal(data.aiLogs.length, 0)
          assert.equal(data.alerts?.some((item) => item.title === '개인 KPI AI 요청 이력을 불러오지 못했습니다.'), true)
        } finally {
          console.error = originalConsoleError
        }
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

  await run('missing department mapping on scoped employees no longer crashes the personal KPI page', async () => {
    await withStubbedPersonalKpiPageData(
      {
        employeeFindMany: async () => [
          {
            id: 'emp-1',
            empId: 'EMP-001',
            empName: '홍길동',
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
              name: '홍길동',
              deptId: 'dept-1',
              deptName: '사업지원팀',
              accessibleDepartmentIds: ['dept-1'],
            },
          },
          year: 2026,
        })

        assert.equal(data.state, 'empty')
        assert.equal(data.employeeOptions[0]?.departmentName, '미지정 부서')
      }
    )
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
