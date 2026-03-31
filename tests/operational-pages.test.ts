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

const { getMonthlyKpiPageData } = require('../src/server/monthly-kpi-page') as typeof import('../src/server/monthly-kpi-page')
const { getEvaluationResultsPageData } = require('../src/server/evaluation-results') as typeof import('../src/server/evaluation-results')
const { getEvaluationAppealPageData } = require('../src/server/evaluation-appeal') as typeof import('../src/server/evaluation-appeal')
const { getOrgKpiPageData } = require('../src/server/org-kpi-page') as typeof import('../src/server/org-kpi-page')
const { getAiCompetencyPageData } = require('../src/server/ai-competency') as typeof import('../src/server/ai-competency')

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

type OperationalSnapshot = {
  employeeFindUnique: PrismaDelegateMethod
  employeeFindMany: PrismaDelegateMethod
  departmentFindMany: PrismaDelegateMethod
  departmentFindUnique: PrismaDelegateMethod
  evalCycleFindMany: PrismaDelegateMethod
  orgKpiFindMany: PrismaDelegateMethod
  personalKpiFindMany: PrismaDelegateMethod
  auditLogFindMany: PrismaDelegateMethod
  aiRequestLogFindMany: PrismaDelegateMethod
  checkInFindMany: PrismaDelegateMethod
  gradeSettingFindMany: PrismaDelegateMethod
  evaluationFindMany: PrismaDelegateMethod
  evaluationFindFirst: PrismaDelegateMethod
  aiCompetencyResultFindMany: PrismaDelegateMethod
}

function captureSnapshot(): OperationalSnapshot {
  const prismaAny = prisma as any
  return {
    employeeFindUnique: prismaAny.employee.findUnique,
    employeeFindMany: prismaAny.employee.findMany,
    departmentFindMany: prismaAny.department.findMany,
    departmentFindUnique: prismaAny.department.findUnique,
    evalCycleFindMany: prismaAny.evalCycle.findMany,
    orgKpiFindMany: prismaAny.orgKpi.findMany,
    personalKpiFindMany: prismaAny.personalKpi.findMany,
    auditLogFindMany: prismaAny.auditLog.findMany,
    aiRequestLogFindMany: prismaAny.aiRequestLog.findMany,
    checkInFindMany: prismaAny.checkIn.findMany,
    gradeSettingFindMany: prismaAny.gradeSetting.findMany,
    evaluationFindMany: prismaAny.evaluation.findMany,
    evaluationFindFirst: prismaAny.evaluation.findFirst,
    aiCompetencyResultFindMany: prismaAny.aiCompetencyResult.findMany,
  }
}

function restoreSnapshot(snapshot: OperationalSnapshot) {
  const prismaAny = prisma as any
  prismaAny.employee.findUnique = snapshot.employeeFindUnique
  prismaAny.employee.findMany = snapshot.employeeFindMany
  prismaAny.department.findMany = snapshot.departmentFindMany
  prismaAny.department.findUnique = snapshot.departmentFindUnique
  prismaAny.evalCycle.findMany = snapshot.evalCycleFindMany
  prismaAny.orgKpi.findMany = snapshot.orgKpiFindMany
  prismaAny.personalKpi.findMany = snapshot.personalKpiFindMany
  prismaAny.auditLog.findMany = snapshot.auditLogFindMany
  prismaAny.aiRequestLog.findMany = snapshot.aiRequestLogFindMany
  prismaAny.checkIn.findMany = snapshot.checkInFindMany
  prismaAny.gradeSetting.findMany = snapshot.gradeSettingFindMany
  prismaAny.evaluation.findMany = snapshot.evaluationFindMany
  prismaAny.evaluation.findFirst = snapshot.evaluationFindFirst
  prismaAny.aiCompetencyResult.findMany = snapshot.aiCompetencyResultFindMany
}

function makeSession(overrides?: Partial<any>) {
  return {
    user: {
      id: 'emp-1',
      email: 'emp-1@company.test',
      name: '홍길동',
      role: 'ROLE_MEMBER',
      empId: 'EMP-001',
      position: 'STAFF',
      deptId: 'dept-1',
      deptName: '경영지원팀',
      accessibleDepartmentIds: ['dept-1'],
      ...overrides,
    },
  } as any
}

async function withStubbedOperationalData(
  overrides: Partial<Record<keyof OperationalSnapshot, PrismaDelegateMethod>>,
  fn: () => Promise<void>
) {
  const snapshot = captureSnapshot()
  const prismaAny = prisma as any

  prismaAny.employee.findUnique =
    overrides.employeeFindUnique ??
    (async () => ({
      id: 'emp-1',
      empId: 'EMP-001',
      empName: '홍길동',
      role: 'ROLE_MEMBER',
      deptId: 'dept-1',
      department: {
        id: 'dept-1',
        deptName: '경영지원팀',
        orgId: 'org-1',
        organization: {
          id: 'org-1',
          name: 'RSUPPORT',
        },
      },
    }))

  prismaAny.employee.findMany =
    overrides.employeeFindMany ??
    (async () => [
      {
        id: 'emp-1',
        empId: 'EMP-001',
        empName: '홍길동',
        role: 'ROLE_MEMBER',
        deptId: 'dept-1',
        status: 'ACTIVE',
        position: 'STAFF',
        department: {
          deptName: '경영지원팀',
        },
      },
    ])

  prismaAny.department.findUnique =
    overrides.departmentFindUnique ??
    (async () => ({
      id: 'dept-1',
      deptName: '경영지원팀',
      organization: {
        id: 'org-1',
        name: 'RSUPPORT',
      },
    }))

  prismaAny.department.findMany =
    overrides.departmentFindMany ??
    (async () => [
      {
        id: 'dept-1',
        deptName: '경영지원팀',
        deptCode: 'MGMT',
        parentDeptId: null,
        organization: {
          id: 'org-1',
          name: 'RSUPPORT',
        },
      },
    ])

  prismaAny.evalCycle.findMany =
    overrides.evalCycleFindMany ??
    (async () => [
      {
        id: 'cycle-2026',
        cycleName: '2026 상반기 평가',
        evalYear: 2026,
        status: 'RESULT_OPEN',
        orgId: 'org-1',
        organization: { name: 'RSUPPORT' },
      },
    ])

  prismaAny.orgKpi.findMany =
    overrides.orgKpiFindMany ??
    (async (args?: { select?: { evalYear?: boolean } }) => {
      if (args?.select?.evalYear) {
        return []
      }
      return []
    })

  let personalKpiFindManyCallCount = 0
  prismaAny.personalKpi.findMany =
    overrides.personalKpiFindMany ??
    (async () => {
      personalKpiFindManyCallCount += 1
      return personalKpiFindManyCallCount === 1
        ? []
        : []
    })

  prismaAny.auditLog.findMany = overrides.auditLogFindMany ?? (async () => [])
  prismaAny.aiRequestLog.findMany = overrides.aiRequestLogFindMany ?? (async () => [])
  prismaAny.checkIn.findMany = overrides.checkInFindMany ?? (async () => [])
  prismaAny.gradeSetting.findMany = overrides.gradeSettingFindMany ?? (async () => [])

  let evaluationFindManyCallCount = 0
  prismaAny.evaluation.findMany =
    overrides.evaluationFindMany ??
    (async () => {
      evaluationFindManyCallCount += 1
      if (evaluationFindManyCallCount === 1) {
        return [
          {
            id: 'eval-final-1',
            evalStage: 'FINAL',
            status: 'CONFIRMED',
            totalScore: 87,
            gradeId: 'grade-a',
            comment: '최종 평가 코멘트',
            submittedAt: new Date('2026-06-30T09:00:00.000Z'),
            createdAt: new Date('2026-06-01T09:00:00.000Z'),
            updatedAt: new Date('2026-06-30T09:00:00.000Z'),
            evaluator: {
              empName: '평가자',
              position: 'TEAM_LEADER',
            },
            items: [],
            appeals: [],
          },
        ]
      }

      if (evaluationFindManyCallCount === 2) {
        return [{ totalScore: 84, gradeId: 'grade-b' }]
      }

      return [{ targetId: 'emp-1', totalScore: 87 }]
    })

  prismaAny.evaluation.findFirst =
    overrides.evaluationFindFirst ??
    (async () => ({
      id: 'eval-final-1',
      gradeId: 'grade-a',
      totalScore: 87,
      evalStage: 'FINAL',
      evaluator: {
        empName: '평가자',
      },
      appeals: [
        {
          id: 'appeal-1',
          reason: '점수 반영 근거를 다시 확인하고 싶습니다.',
          status: 'SUBMITTED',
          adminResponse: null,
          resolvedAt: null,
          createdAt: new Date('2026-07-01T09:00:00.000Z'),
          updatedAt: new Date('2026-07-01T09:00:00.000Z'),
        },
      ],
      items: [],
    }))

  prismaAny.aiCompetencyResult.findMany = overrides.aiCompetencyResultFindMany ?? (async () => [])

  try {
    await fn()
  } finally {
    restoreSnapshot(snapshot)
  }
}

async function main() {
  await run('monthly KPI page treats missing accessibleDepartmentIds as a safe empty state', async () => {
    await withStubbedOperationalData({}, async () => {
      const data = await getMonthlyKpiPageData({
        session: makeSession({
          accessibleDepartmentIds: undefined,
        }),
        year: 2026,
      })

      assert.equal(data.state, 'empty')
      assert.equal(data.message, '아직 등록된 개인 KPI가 없습니다. 먼저 개인 KPI를 작성한 뒤 월간 실적을 입력해 주세요.')
    })
  })

  await run('monthly KPI page returns permission-denied instead of crashing when actor department mapping is missing', async () => {
    await withStubbedOperationalData(
      {
        employeeFindUnique: async () => ({
          id: 'emp-1',
          empId: 'EMP-001',
          empName: '홍길동',
          role: 'ROLE_MEMBER',
          deptId: 'dept-1',
          department: null,
        }),
      },
      async () => {
        const data = await getMonthlyKpiPageData({
          session: makeSession(),
          year: 2026,
        })

        assert.equal(data.state, 'permission-denied')
        assert.equal(data.message, '월간 실적 화면을 준비할 부서 정보가 없어 관리자에게 설정 확인이 필요합니다.')
      }
    )
  })

  await run('monthly KPI page stays ready when only AI log loading fails', async () => {
    await withStubbedOperationalData(
      {
        personalKpiFindMany: async () => [
          {
            id: 'kpi-1',
            kpiName: '고객 만족도 개선',
            employeeId: 'emp-1',
            evalYear: 2026,
            status: 'APPROVED',
            weight: 40,
            kpiType: 'QUALITATIVE',
            targetValue: null,
            unit: null,
            linkedOrgKpiId: null,
            employee: {
              empName: '홍길동',
              department: {
                deptName: '경영지원팀',
              },
            },
            linkedOrgKpi: null,
            monthlyRecords: [],
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
          },
        ],
        aiRequestLogFindMany: async () => {
          throw new Error('ai logs unavailable')
        },
      },
      async () => {
        const originalConsoleError = console.error
        console.error = () => undefined

        try {
          const data = await getMonthlyKpiPageData({
            session: makeSession(),
            year: 2026,
          })

          assert.equal(data.state, 'ready')
          assert.equal(data.aiLogs.length, 0)
          assert.equal(data.alerts?.some((item) => item.title === '월간 실적 AI 요청 이력을 불러오지 못했습니다.'), true)
        } finally {
          console.error = originalConsoleError
        }
      }
    )
  })

  await run('monthly KPI page exposes no-target instead of a fatal error when an out-of-scope employee is requested', async () => {
    await withStubbedOperationalData(
      {
        employeeFindMany: async () => [
          {
            id: 'emp-2',
            empId: 'EMP-002',
            empName: '팀 구성원',
            role: 'ROLE_MEMBER',
            deptId: 'dept-1',
            status: 'ACTIVE',
            position: 'STAFF',
            department: {
              deptName: '경영지원팀',
            },
          },
        ],
      },
      async () => {
        const data = await getMonthlyKpiPageData({
          session: makeSession({ role: 'ROLE_TEAM_LEADER' }),
          year: 2026,
          scope: 'employee',
          employeeId: 'missing-user',
        })

        assert.equal(data.state, 'no-target')
        assert.equal(data.selectedEmployeeId, '')
      }
    )
  })

  await run('monthly KPI page exposes setup-required for managers with no available employees instead of a fatal error', async () => {
    await withStubbedOperationalData(
      {
        employeeFindUnique: async () => null,
        employeeFindMany: async () => [],
      },
      async () => {
        const data = await getMonthlyKpiPageData({
          session: makeSession({ role: 'ROLE_ADMIN' }),
          year: 2026,
          scope: 'employee',
        })

        assert.equal(data.state, 'setup-required')
        assert.equal(data.employeeOptions.length, 0)
      }
    )
  })

  await run('evaluation results page stays ready when AI competency sync data fails', async () => {
    await withStubbedOperationalData(
      {
        gradeSettingFindMany: async () => [
          { id: 'grade-a', gradeName: 'A', minScore: 85, maxScore: 94 },
        ],
        aiCompetencyResultFindMany: async () => {
          throw new Error('ai competency sync unavailable')
        },
      },
      async () => {
        const originalConsoleError = console.error
        console.error = () => undefined

        try {
          const data = await getEvaluationResultsPageData({
            session: makeSession(),
            cycleId: 'cycle-2026',
          })

          assert.equal(data.state, 'ready')
          assert.equal(Boolean(data.viewModel), true)
          assert.equal(
            data.alerts?.some((item) => item.title === 'AI 활용능력 연동 점수를 불러오지 못했습니다.'),
            true
          )
        } finally {
          console.error = originalConsoleError
        }
      }
    )
  })

  await run('evaluation results page returns permission-denied instead of crashing when department mapping is missing', async () => {
    await withStubbedOperationalData(
      {
        employeeFindUnique: async () => ({
          id: 'emp-1',
          empId: 'EMP-001',
          empName: '홍길동',
          role: 'ROLE_MEMBER',
          deptId: 'dept-1',
          department: null,
        }),
      },
      async () => {
        const data = await getEvaluationResultsPageData({
          session: makeSession(),
          cycleId: 'cycle-2026',
        })

        assert.equal(data.state, 'permission-denied')
        assert.equal(data.message, '평가 결과를 조회할 부서 정보가 없어 관리자에게 설정 확인이 필요합니다.')
      }
    )
  })

  await run('evaluation results page uses session department scope and returns empty when the employee row is missing', async () => {
    await withStubbedOperationalData(
      {
        employeeFindUnique: async () => null,
        departmentFindUnique: async () => ({
          id: 'dept-1',
          deptName: '경영지원팀',
          orgId: 'org-1',
          organization: {
            id: 'org-1',
            name: 'RSUPPORT',
          },
        }),
      },
      async () => {
        const data = await getEvaluationResultsPageData({
          session: makeSession(),
          cycleId: 'cycle-2026',
        })

        assert.equal(data.state, 'empty')
        assert.equal(data.selectedCycleId, 'cycle-2026')
      }
    )
  })

  await run('AI competency page returns permission-denied instead of crashing when department mapping is missing', async () => {
    await withStubbedOperationalData(
      {
        employeeFindUnique: async () => ({
          id: 'emp-1',
          empId: 'EMP-001',
          empName: '홍길동',
          role: 'ROLE_MEMBER',
          deptId: 'dept-1',
          department: null,
        }),
      },
      async () => {
        const data = await getAiCompetencyPageData({
          session: makeSession(),
        })

        assert.equal(data.state, 'permission-denied')
        assert.equal(data.message, 'AI 활용능력 평가 화면을 준비할 부서 정보가 없어 관리자에게 설정 확인이 필요합니다.')
      }
    )
  })

  await run('org KPI page treats missing accessibleDepartmentIds as a safe empty state', async () => {
    await withStubbedOperationalData({}, async () => {
      const data = await getOrgKpiPageData({
        userId: 'emp-1',
        role: 'ROLE_MEMBER',
        deptId: 'dept-1',
        deptName: '경영지원팀',
        accessibleDepartmentIds: undefined,
        year: 2026,
        userName: '홍길동',
      })

      assert.equal(data.state, 'empty')
      assert.equal(data.message, '해당 범위에 등록된 조직 KPI가 없습니다. 올해 목표부터 정리해 보세요.')
      assert.equal(data.selectedDepartmentId, 'dept-1')
    })
  })

  await run('org KPI page stays ready when only AI log loading fails', async () => {
    await withStubbedOperationalData(
      {
        orgKpiFindMany: async (args?: { select?: { evalYear?: boolean } }) => {
          if (args?.select?.evalYear) {
            return [{ evalYear: 2026 }]
          }

          return [
            {
              id: 'org-kpi-1',
              kpiName: '핵심 고객 유지율 개선',
              evalYear: 2026,
              deptId: 'dept-1',
              kpiCategory: '고객 성공',
              kpiType: 'QUALITATIVE',
              definition: '핵심 고객 유지율을 높입니다.',
              formula: null,
              targetValue: null,
              unit: '%',
              weight: 40,
              difficulty: 'MEDIUM',
              status: 'DRAFT',
              updatedAt: new Date('2026-03-01T00:00:00.000Z'),
              department: {
                id: 'dept-1',
                deptName: '경영지원팀',
                deptCode: 'MGMT',
                parentDeptId: null,
                organization: {
                  id: 'org-1',
                  name: 'RSUPPORT',
                },
              },
              personalKpis: [],
              _count: {
                personalKpis: 0,
              },
            },
          ]
        },
        aiRequestLogFindMany: async () => {
          throw new Error('org ai logs unavailable')
        },
      },
      async () => {
        const originalConsoleError = console.error
        console.error = () => undefined

        try {
          const data = await getOrgKpiPageData({
            userId: 'emp-1',
            role: 'ROLE_ADMIN',
            deptId: 'dept-1',
            deptName: '경영지원팀',
            accessibleDepartmentIds: undefined,
            year: 2026,
            userName: '홍길동',
          })

          assert.equal(data.state, 'ready')
          assert.equal(data.aiLogs.length, 0)
          assert.equal(data.alerts?.some((item) => item.title === '조직 KPI AI 보조'), true)
        } finally {
          console.error = originalConsoleError
        }
      }
    )
  })

  await run('appeal page stays ready when audit log loading fails for an existing case', async () => {
    await withStubbedOperationalData(
      {
        auditLogFindMany: async () => {
          throw new Error('appeal audit unavailable')
        },
      },
      async () => {
        const originalConsoleError = console.error
        console.error = () => undefined

        try {
          const data = await getEvaluationAppealPageData({
            session: makeSession(),
            cycleId: 'cycle-2026',
            caseId: 'appeal-1',
          })

          assert.equal(data.state, 'ready')
          assert.equal(Boolean(data.viewModel), true)
          assert.equal(
            data.alerts?.some((item) => item.title === '이의 신청 처리 이력을 불러오지 못했습니다.'),
            true
          )
        } finally {
          console.error = originalConsoleError
        }
      }
    )
  })

  await run('appeal page returns permission-denied instead of crashing when department mapping is missing', async () => {
    await withStubbedOperationalData(
      {
        employeeFindUnique: async () => ({
          id: 'emp-1',
          empId: 'EMP-001',
          empName: '홍길동',
          role: 'ROLE_MEMBER',
          deptId: 'dept-1',
          department: null,
        }),
      },
      async () => {
        const data = await getEvaluationAppealPageData({
          session: makeSession(),
          cycleId: 'cycle-2026',
        })

        assert.equal(data.state, 'permission-denied')
        assert.equal(data.message, '이의 신청을 조회할 부서 정보가 없어 관리자에게 설정 확인이 필요합니다.')
      }
    )
  })

  await run('appeal page keeps applicant flow in no-result-yet/window-closed state when employee mapping is missing but session scope is still valid', async () => {
    await withStubbedOperationalData(
      {
        employeeFindUnique: async () => null,
        departmentFindUnique: async () => ({
          id: 'dept-1',
          deptName: '경영지원팀',
          orgId: 'org-1',
          organization: {
            id: 'org-1',
            name: 'RSUPPORT',
          },
        }),
      },
      async () => {
        const data = await getEvaluationAppealPageData({
          session: makeSession(),
          cycleId: 'cycle-2026',
        })

        assert.equal(data.state, 'no-result-yet')
        assert.equal(data.selectedCycleId, 'cycle-2026')
      }
    )
  })

  await run('repaired pages render degraded-state banners in their active clients', () => {
    const orgSource = read('src/components/kpi/OrgKpiManagementClient.tsx')
    const monthlySource = read('src/components/kpi/MonthlyKpiManagementClient.tsx')
    const resultsSource = read('src/components/evaluation/EvaluationResultsClient.tsx')
    const appealSource = read('src/components/evaluation/EvaluationAppealClient.tsx')

    assert.equal(orgSource.includes('일부 운영 데이터를 불러오지 못해 기본 화면으로 표시 중입니다.'), true)
    assert.equal(monthlySource.includes('일부 운영 데이터를 불러오지 못해 기본 화면으로 표시 중입니다.'), true)
    assert.equal(resultsSource.includes('일부 평가 근거를 불러오지 못해 기본 결과 화면으로 표시 중입니다.'), true)
    assert.equal(appealSource.includes('일부 운영 정보를 불러오지 못해 기본 이의 신청 화면으로 표시 중입니다.'), true)
  })

  console.log('Operational page regression tests completed')
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
