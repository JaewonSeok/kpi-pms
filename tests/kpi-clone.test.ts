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
  _load: (request: string, parent: unknown, isMain: boolean) => unknown
}

const originalResolveFilename = moduleLoader._resolveFilename
moduleLoader._resolveFilename = function patchedResolveFilename(request, parent, isMain, options) {
  if (request.startsWith('@/')) {
    request = path.resolve(process.cwd(), 'src', request.slice(2))
  }
  return originalResolveFilename.call(this, request, parent, isMain, options)
}

const auditLogs: Array<Record<string, unknown>> = []
const originalLoad = moduleLoader._load
moduleLoader._load = function patchedLoad(request, parent, isMain) {
  if (request === '@/lib/audit') {
    return {
      createAuditLog: async (payload: Record<string, unknown>) => {
        auditLogs.push(payload)
      },
    }
  }
  return originalLoad.call(this, request, parent, isMain)
}

const { clonePersonalKpi, cloneOrgKpi } = require('../src/server/kpi-clone') as typeof import('../src/server/kpi-clone')
moduleLoader._load = originalLoad

function read(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')
}

function run(name: string, fn: () => Promise<void> | void) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      console.log(`PASS ${name}`)
    })
    .catch((error) => {
      console.error(`FAIL ${name}`)
      throw error
    })
}

type PrismaSnapshot = {
  personalKpiFindUnique: any
  personalKpiFindMany: any
  personalKpiCreate: any
  employeeFindUnique: any
  evalCycleFindUnique: any
  checkInFindMany: any
  orgKpiFindUnique: any
  orgKpiFindMany: any
  orgKpiCreate: any
  departmentFindUnique: any
}

function captureSnapshot(): PrismaSnapshot {
  const prismaAny = prisma as any
  return {
    personalKpiFindUnique: prismaAny.personalKpi.findUnique,
    personalKpiFindMany: prismaAny.personalKpi.findMany,
    personalKpiCreate: prismaAny.personalKpi.create,
    employeeFindUnique: prismaAny.employee.findUnique,
    evalCycleFindUnique: prismaAny.evalCycle.findUnique,
    checkInFindMany: prismaAny.checkIn.findMany,
    orgKpiFindUnique: prismaAny.orgKpi.findUnique,
    orgKpiFindMany: prismaAny.orgKpi.findMany,
    orgKpiCreate: prismaAny.orgKpi.create,
    departmentFindUnique: prismaAny.department.findUnique,
  }
}

function restoreSnapshot(snapshot: PrismaSnapshot) {
  const prismaAny = prisma as any
  prismaAny.personalKpi.findUnique = snapshot.personalKpiFindUnique
  prismaAny.personalKpi.findMany = snapshot.personalKpiFindMany
  prismaAny.personalKpi.create = snapshot.personalKpiCreate
  prismaAny.employee.findUnique = snapshot.employeeFindUnique
  prismaAny.evalCycle.findUnique = snapshot.evalCycleFindUnique
  prismaAny.checkIn.findMany = snapshot.checkInFindMany
  prismaAny.orgKpi.findUnique = snapshot.orgKpiFindUnique
  prismaAny.orgKpi.findMany = snapshot.orgKpiFindMany
  prismaAny.orgKpi.create = snapshot.orgKpiCreate
  prismaAny.department.findUnique = snapshot.departmentFindUnique
}

async function withStubbedCloneData(
  overrides: Partial<Record<keyof PrismaSnapshot, (...args: any[]) => Promise<any>>>,
  fn: () => Promise<void>
) {
  const snapshot = captureSnapshot()
  const prismaAny = prisma as any
  auditLogs.length = 0

  prismaAny.personalKpi.findUnique = overrides.personalKpiFindUnique
  prismaAny.personalKpi.findMany = overrides.personalKpiFindMany
  prismaAny.personalKpi.create = overrides.personalKpiCreate
  prismaAny.employee.findUnique = overrides.employeeFindUnique
  prismaAny.evalCycle.findUnique = overrides.evalCycleFindUnique
  prismaAny.checkIn.findMany = overrides.checkInFindMany
  prismaAny.orgKpi.findUnique = overrides.orgKpiFindUnique
  prismaAny.orgKpi.findMany = overrides.orgKpiFindMany
  prismaAny.orgKpi.create = overrides.orgKpiCreate
  prismaAny.department.findUnique = overrides.departmentFindUnique

  try {
    await fn()
  } finally {
    restoreSnapshot(snapshot)
  }
}

function makeSession(overrides?: Partial<any>) {
  return {
    user: {
      id: 'member-1',
      role: 'ROLE_MEMBER',
      deptId: 'dept-1',
      accessibleDepartmentIds: ['dept-1'],
      name: '구성원1',
      ...overrides,
    },
  } as any
}

async function main() {
  await run('personal KPI clone preserves copiedFrom relation and carry-over metadata', async () => {
    const source = {
      id: 'pk-1',
      employeeId: 'member-1',
      evalYear: 2026,
      kpiType: 'QUANTITATIVE',
      kpiName: '재계약률 향상',
      definition: '정의',
      formula: '계산식',
      targetValue: 95,
      unit: '%',
      weight: 30,
      difficulty: 'MEDIUM',
      linkedOrgKpiId: 'org-1',
      employee: {
        id: 'member-1',
        deptId: 'dept-1',
        empName: '구성원1',
      },
      linkedOrgKpi: {
        id: 'org-1',
      },
      monthlyRecords: [
        {
          id: 'monthly-1',
          yearMonth: '2026-02',
          actualValue: 91,
          achievementRate: 95,
          activities: '재계약률 개선 활동',
          obstacles: null,
          efforts: '고객 이탈 분석',
        },
      ],
    }

    let createPayload: any = null

    await withStubbedCloneData(
      {
        personalKpiFindUnique: async () => source,
        personalKpiFindMany: async () => [],
        personalKpiCreate: async ({ data }: any) => {
          createPayload = data
          return {
            id: 'pk-clone-1',
            employeeId: data.employeeId,
            evalYear: data.evalYear,
            weight: data.weight,
            copiedFromPersonalKpiId: data.copiedFromPersonalKpiId,
            kpiName: data.kpiName,
          }
        },
        employeeFindUnique: async () => ({
          id: 'member-1',
          deptId: 'dept-1',
          empName: '구성원1',
        }),
        evalCycleFindUnique: async () => ({
          id: 'cycle-2027',
          cycleName: '2027 상반기',
          evalYear: 2027,
        }),
        checkInFindMany: async () => [
          {
            id: 'checkin-1',
            ownerId: 'member-1',
            status: 'COMPLETED',
            scheduledDate: new Date('2026-02-15T00:00:00.000Z'),
            actualDate: new Date('2026-02-16T00:00:00.000Z'),
            keyTakeaways: '진행 상황 점검',
            kpiDiscussed: [
              {
                kpiId: 'pk-1',
                progress: '80%',
                concern: '리소스 부족',
                support: '우선순위 조정 필요',
              },
            ],
          },
        ],
      },
      async () => {
        const result = await clonePersonalKpi({
          session: makeSession(),
          sourceId: 'pk-1',
          assignToSelf: true,
          targetEvalYear: 2027,
          targetCycleId: 'cycle-2027',
          includeProgress: true,
          includeCheckins: true,
        })

        assert.equal(result.id, 'pk-clone-1')
        assert.equal(result.copiedFromPersonalKpiId, 'pk-1')
        assert.equal(result.copyMetadata.includedProgress, true)
        assert.equal(result.copyMetadata.includedCheckins, true)
        assert.equal(result.copyMetadata.progressSnapshot.length, 1)
        assert.equal(result.copyMetadata.checkinSnapshot.length, 1)
        assert.equal(createPayload.copiedFromPersonalKpiId, 'pk-1')
        assert.equal(source.kpiName, '재계약률 향상')
        assert.equal(auditLogs.length, 1)
      }
    )
  })

  await run('personal KPI clone blocks unauthorized reassignment for members', async () => {
    await withStubbedCloneData(
      {
        personalKpiFindUnique: async () => ({
          id: 'pk-1',
          employeeId: 'member-1',
          evalYear: 2026,
          kpiType: 'QUANTITATIVE',
          kpiName: '재계약률 향상',
          definition: null,
          formula: null,
          targetValue: 95,
          unit: '%',
          weight: 30,
          difficulty: 'MEDIUM',
          linkedOrgKpiId: null,
          employee: {
            id: 'member-1',
            deptId: 'dept-1',
            empName: '구성원1',
          },
          linkedOrgKpi: null,
          monthlyRecords: [],
        }),
      },
      async () => {
        await assert.rejects(
          () =>
            clonePersonalKpi({
              session: makeSession(),
              sourceId: 'pk-1',
              targetEmployeeId: 'member-2',
              assignToSelf: false,
              targetEvalYear: 2027,
              includeProgress: false,
              includeCheckins: false,
            }),
          (error: any) => {
            assert.equal(error.statusCode, 403)
            return true
          }
        )
      }
    )
  })

  await run('org KPI clone keeps source relationship and snapshot metadata', async () => {
    let createPayload: any = null

    await withStubbedCloneData(
      {
        orgKpiFindUnique: async () => ({
          id: 'org-1',
          deptId: 'dept-1',
          evalYear: 2026,
          kpiType: 'QUANTITATIVE',
          kpiCategory: '매출',
          kpiName: '매출 성장',
          definition: '정의',
          formula: '수식',
          targetValue: 100,
          unit: '%',
          weight: 40,
          difficulty: 'HIGH',
          department: {
            id: 'dept-1',
            deptName: '영업본부',
          },
          personalKpis: [
            {
              id: 'pk-1',
              employeeId: 'member-1',
              employee: {
                id: 'member-1',
                empName: '구성원1',
              },
              monthlyRecords: [
                {
                  id: 'monthly-1',
                  yearMonth: '2026-02',
                  activities: '실적 정리',
                  achievementRate: 90,
                },
              ],
            },
          ],
        }),
        orgKpiFindMany: async () => [],
        orgKpiCreate: async ({ data }: any) => {
          createPayload = data
          return {
            id: 'org-clone-1',
            deptId: data.deptId,
            evalYear: data.evalYear,
            copiedFromOrgKpiId: data.copiedFromOrgKpiId,
          }
        },
        departmentFindUnique: async () => ({
          id: 'dept-2',
          deptName: '사업본부',
        }),
        evalCycleFindUnique: async () => ({
          id: 'cycle-2027',
          cycleName: '2027 상반기',
          evalYear: 2027,
        }),
        checkInFindMany: async () => [
          {
            id: 'checkin-1',
            ownerId: 'member-1',
            status: 'COMPLETED',
            scheduledDate: new Date('2026-02-15T00:00:00.000Z'),
            actualDate: new Date('2026-02-16T00:00:00.000Z'),
            keyTakeaways: '조직 KPI 체크인',
            kpiDiscussed: [
              {
                kpiId: 'pk-1',
              },
            ],
          },
        ],
      },
      async () => {
        const result = await cloneOrgKpi({
          session: makeSession({
            id: 'admin-1',
            role: 'ROLE_ADMIN',
            deptId: 'dept-1',
            accessibleDepartmentIds: ['dept-1', 'dept-2'],
          }),
          sourceId: 'org-1',
          targetDeptId: 'dept-2',
          targetEvalYear: 2027,
          targetCycleId: 'cycle-2027',
          includeProgress: true,
          includeCheckins: true,
        })

        assert.equal(result.id, 'org-clone-1')
        assert.equal(result.copiedFromOrgKpiId, 'org-1')
        assert.equal(result.copyMetadata.includedProgress, true)
        assert.equal(result.copyMetadata.includedCheckins, true)
        assert.equal(result.copyMetadata.progressSnapshot?.linkedPersonalKpiCount, 1)
        assert.equal(result.copyMetadata.checkinSnapshot.length, 1)
        assert.equal(createPayload.copiedFromOrgKpiId, 'org-1')
        assert.equal(auditLogs.length, 1)
      }
    )
  })

  await run('personal and org KPI clients are wired to the live clone routes', () => {
    const personalSource = read('src/components/kpi/PersonalKpiManagementClient.tsx')
    const orgSource = read('src/components/kpi/OrgKpiManagementClient.tsx')

    assert.equal(personalSource.includes('/api/kpi/personal/${selectedKpi.id}/clone'), true)
    assert.equal(personalSource.includes('assignToSelf'), true)
    assert.equal(orgSource.includes('/api/kpi/org/${selectedKpi.id}/clone'), true)
    assert.equal(orgSource.includes('CloneOrgKpiModal'), true)
    assert.equal(orgSource.includes('copiedFromOrgKpiId'), false)
    assert.equal(orgSource.includes('cloneInfo'), true)
  })

  console.log('KPI clone tests completed')
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
