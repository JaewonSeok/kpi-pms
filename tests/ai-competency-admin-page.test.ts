/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports */
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

const { getAiCompetencyGateAdminPageData } =
  require('../src/server/ai-competency-gate-admin') as typeof import('../src/server/ai-competency-gate-admin')

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

type AdminPageSnapshot = {
  employeeFindUnique: PrismaDelegateMethod
  employeeFindMany: PrismaDelegateMethod
  evalCycleFindMany: PrismaDelegateMethod
  aiCompetencyGuideEntryUpsert: PrismaDelegateMethod
  aiCompetencyGuideEntryFindMany: PrismaDelegateMethod
  aiCompetencyGateCycleFindMany: PrismaDelegateMethod
  aiCompetencyGateAssignmentFindMany: PrismaDelegateMethod
}

function captureSnapshot(): AdminPageSnapshot {
  const prismaAny = prisma as any
  return {
    employeeFindUnique: prismaAny.employee.findUnique,
    employeeFindMany: prismaAny.employee.findMany,
    evalCycleFindMany: prismaAny.evalCycle.findMany,
    aiCompetencyGuideEntryUpsert: prismaAny.aiCompetencyGuideEntry.upsert,
    aiCompetencyGuideEntryFindMany: prismaAny.aiCompetencyGuideEntry.findMany,
    aiCompetencyGateCycleFindMany: prismaAny.aiCompetencyGateCycle.findMany,
    aiCompetencyGateAssignmentFindMany: prismaAny.aiCompetencyGateAssignment.findMany,
  }
}

function restoreSnapshot(snapshot: AdminPageSnapshot) {
  const prismaAny = prisma as any
  prismaAny.employee.findUnique = snapshot.employeeFindUnique
  prismaAny.employee.findMany = snapshot.employeeFindMany
  prismaAny.evalCycle.findMany = snapshot.evalCycleFindMany
  prismaAny.aiCompetencyGuideEntry.upsert = snapshot.aiCompetencyGuideEntryUpsert
  prismaAny.aiCompetencyGuideEntry.findMany = snapshot.aiCompetencyGuideEntryFindMany
  prismaAny.aiCompetencyGateCycle.findMany = snapshot.aiCompetencyGateCycleFindMany
  prismaAny.aiCompetencyGateAssignment.findMany = snapshot.aiCompetencyGateAssignmentFindMany
}

function makeSession(overrides?: Partial<any>) {
  return {
    user: {
      id: 'admin-1',
      email: 'admin@company.test',
      name: '관리자',
      role: 'ROLE_ADMIN',
      empId: 'EMP-ADMIN',
      deptId: 'dept-admin',
      deptName: '경영지원본부',
      ...overrides,
    },
  } as any
}

function makeAdminEmployee() {
  return {
    id: 'admin-1',
    empId: 'EMP-ADMIN',
    empName: '관리자',
    role: 'ROLE_ADMIN',
    position: 'CEO',
    department: {
      id: 'dept-admin',
      deptName: '경영지원본부',
      organization: {
        id: 'org-1',
        name: 'RSUPPORT',
      },
    },
  }
}

function makeGuideEntries() {
  return [
    {
      id: 'guide-1',
      entryKey: 'default:overview-guide',
      cycleId: null,
      entryType: 'GUIDE',
      trackApplicability: 'COMMON',
      title: 'AI 역량평가 안내',
      summary: '실제 업무 개선과 조직 확산 중심으로 검토합니다.',
      body: '실제 업무 문제, 증빙, 검토 체계를 중심으로 작성합니다.',
      displayOrder: 10,
      isActive: true,
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-01T00:00:00.000Z'),
    },
  ]
}

function makeEvalCycles() {
  return [
    {
      id: 'eval-cycle-2026',
      cycleName: '2026 상반기',
      evalYear: 2026,
      organization: { id: 'org-1', name: 'RSUPPORT' },
      aiCompetencyGateCycle: null,
    },
  ]
}

function makeAssignableEmployees() {
  return [
    {
      id: 'emp-1',
      empName: '석재원',
      role: 'ROLE_MEMBER',
      department: { id: 'dept-hr', deptName: '인사팀' },
    },
    {
      id: 'reviewer-1',
      empName: '김검토',
      role: 'ROLE_TEAM_LEADER',
      department: { id: 'dept-ops', deptName: '경영지원본부' },
    },
  ]
}

async function withStubbedAdminPageData(
  overrides: Partial<Record<keyof AdminPageSnapshot, PrismaDelegateMethod>>,
  fn: () => Promise<void>
) {
  const snapshot = captureSnapshot()
  const prismaAny = prisma as any

  prismaAny.employee.findUnique = overrides.employeeFindUnique ?? (async () => makeAdminEmployee())
  prismaAny.aiCompetencyGuideEntry.upsert =
    overrides.aiCompetencyGuideEntryUpsert ?? (async () => ({ id: 'guide-1' }))
  prismaAny.aiCompetencyGuideEntry.findMany =
    overrides.aiCompetencyGuideEntryFindMany ?? (async () => makeGuideEntries())
  prismaAny.aiCompetencyGateCycle.findMany =
    overrides.aiCompetencyGateCycleFindMany ?? (async () => [])
  prismaAny.aiCompetencyGateAssignment.findMany =
    overrides.aiCompetencyGateAssignmentFindMany ?? (async () => [])
  prismaAny.evalCycle.findMany = overrides.evalCycleFindMany ?? (async () => makeEvalCycles())
  prismaAny.employee.findMany =
    overrides.employeeFindMany ??
    (async (args?: { where?: { role?: { in?: string[] } } }) => {
      const employees = makeAssignableEmployees()
      if (args?.where?.role?.in) {
        return employees.filter((item) => args.where?.role?.in?.includes(item.role))
      }
      return employees
    })

  try {
    await fn()
  } finally {
    restoreSnapshot(snapshot)
  }
}

async function main() {
  await run('admin loader keeps creation and assignment options available when no gate cycle exists yet', async () => {
    await withStubbedAdminPageData({}, async () => {
      const data = await getAiCompetencyGateAdminPageData({
        session: makeSession(),
      })

      assert.equal(data.state, 'empty')
      assert.equal(data.cycleOptions.length, 0)
      assert.equal(data.evalCycleOptions.length, 1)
      assert.equal(data.employeeOptions.length, 2)
      assert.equal(data.reviewerOptions.length, 1)
      assert.equal(data.canManageCycles, true)
      assert.equal(data.canAssign, true)
    })
  })

  await run('admin panel renders explicit empty-state handling instead of a dead cycle select', () => {
    const source = read('src/components/evaluation/AiCompetencyAdminPanel.tsx')

    assert.equal(source.includes('hasCycleOptions'), true)
    assert.equal(source.includes('선택할 회차가 아직 없습니다.'), true)
    assert.equal(source.includes('먼저 회차를 생성하거나 선택해 주세요.'), true)
  })

  console.log('AI competency admin page tests completed')
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
