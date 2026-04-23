import './register-path-aliases'
import assert from 'node:assert/strict'

type PrismaMethod = (...args: any[]) => Promise<any>

process.env.DATABASE_URL ||= 'postgresql://postgres:password@localhost:5432/kpi_pms'
process.env.AUTH_URL ||= 'http://localhost:3000'
process.env.AUTH_SECRET ||= 'test-secret'
process.env.GOOGLE_CLIENT_ID ||= 'test-google-client'
process.env.GOOGLE_CLIENT_SECRET ||= 'test-google-secret'
process.env.ALLOWED_DOMAIN ||= 'example.com'

async function run(name: string, fn: () => Promise<void> | void) {
  try {
    await fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

function makeSession(user?: Partial<{ id: string; name: string; role: string }>) {
  return {
    user: {
      id: user?.id ?? 'emp-admin',
      name: user?.name ?? 'Admin User',
      role: user?.role ?? 'ROLE_ADMIN',
    },
  } as any
}

function buildCycle() {
  return {
    id: 'cycle-2026',
    cycleName: '2026 상반기',
    evalYear: 2026,
    status: 'CEO_ADJUST',
    orgId: 'org-1',
    organization: {
      name: 'RSUPPORT',
    },
    firstEvalEnd: new Date('2026-03-31T09:00:00Z'),
    secondEvalEnd: new Date('2026-04-10T09:00:00Z'),
    finalEvalEnd: new Date('2026-04-20T09:00:00Z'),
    ceoAdjustEnd: new Date('2026-04-25T09:00:00Z'),
    createdAt: new Date('2026-01-01T00:00:00Z'),
  }
}

function buildScopedEmployees() {
  return [
    {
      id: 'emp-target',
      empName: 'Target Employee',
      deptId: 'dept-1',
      position: 'MEMBER',
      role: 'ROLE_MEMBER',
      teamLeaderId: 'leader-1',
      sectionChiefId: null,
      divisionHeadId: 'div-head-1',
      department: {
        deptName: '영업1팀',
      },
    },
  ]
}

function buildEvaluationRows() {
  return [
    {
      id: 'eval-final-1',
      evalCycleId: 'cycle-2026',
      targetId: 'emp-target',
      evaluatorId: 'div-head-1',
      evalStage: 'FINAL',
      totalScore: 89,
      gradeId: 'grade-a',
      comment: '본부장 평가 의견',
      strengthComment: '목표 달성이 안정적입니다.',
      improvementComment: null,
      nextStepGuidance: null,
      status: 'SUBMITTED',
      target: {
        id: 'emp-target',
        deptId: 'dept-1',
        empName: 'Target Employee',
        position: 'MEMBER',
        department: {
          deptName: '영업1팀',
        },
      },
      items: [
        {
          id: 'eval-item-1',
          itemComment: '월간 실적이 일관되게 유지됐습니다.',
          personalKpi: {
            id: 'pk-1',
            kpiName: '신규 매출',
            weight: 100,
            linkedOrgKpi: {
              id: 'org-kpi-1',
              kpiName: '매출 성장',
              department: {
                deptName: '영업1팀',
              },
            },
            monthlyRecords: [
              {
                id: 'mr-inline-1',
                yearMonth: '2026-03',
                achievementRate: 92,
                activities: '주요 프로젝트 마감',
                obstacles: null,
                efforts: null,
              },
            ],
          },
        },
      ],
    },
    {
      id: 'eval-ceo-1',
      evalCycleId: 'cycle-2026',
      targetId: 'emp-target',
      evaluatorId: 'emp-ceo',
      evalStage: 'CEO_ADJUST',
      totalScore: 91,
      gradeId: 'grade-a',
      comment: '대표이사 확정 의견',
      strengthComment: '핵심 실적이 확인됩니다.',
      improvementComment: null,
      nextStepGuidance: '다음 분기 과제를 명확히 제시합니다.',
      status: 'CONFIRMED',
      target: {
        id: 'emp-target',
        deptId: 'dept-1',
        empName: 'Target Employee',
        position: 'MEMBER',
        department: {
          deptName: '영업1팀',
        },
      },
      items: [
        {
          id: 'eval-item-2',
          itemComment: '최종 확정 근거',
          personalKpi: {
            id: 'pk-1',
            kpiName: '신규 매출',
            weight: 100,
            linkedOrgKpi: {
              id: 'org-kpi-1',
              kpiName: '매출 성장',
              department: {
                deptName: '영업1팀',
              },
            },
            monthlyRecords: [
              {
                id: 'mr-inline-2',
                yearMonth: '2026-03',
                achievementRate: 92,
                activities: '최종 월간 실적',
                obstacles: null,
                efforts: null,
              },
            ],
          },
        },
      ],
    },
  ]
}

function buildAssignments() {
  return [
    {
      id: 'assign-first-1',
      targetId: 'emp-target',
      evalStage: 'FIRST',
      evaluatorId: 'leader-1',
      evaluator: {
        id: 'leader-1',
        empName: 'Leader Reviewer',
        role: 'ROLE_TEAM_LEADER',
        position: 'TEAM_LEADER',
        status: 'ACTIVE',
        department: {
          deptName: '영업1팀',
        },
      },
    },
    {
      id: 'assign-final-1',
      targetId: 'emp-target',
      evalStage: 'FINAL',
      evaluatorId: 'div-head-1',
      evaluator: {
        id: 'div-head-1',
        empName: 'Division Reviewer',
        role: 'ROLE_DIV_HEAD',
        position: 'DIV_HEAD',
        status: 'ACTIVE',
        department: {
          deptName: '본부',
        },
      },
    },
    {
      id: 'assign-ceo-1',
      targetId: 'emp-target',
      evalStage: 'CEO_ADJUST',
      evaluatorId: 'emp-ceo',
      evaluator: {
        id: 'emp-ceo',
        empName: 'CEO Reviewer',
        role: 'ROLE_CEO',
        position: 'CEO',
        status: 'ACTIVE',
        department: {
          deptName: '대표',
        },
      },
    },
  ]
}

function buildPersonalKpis() {
  return [
    {
      id: 'pk-1',
      employeeId: 'emp-target',
      linkedOrgKpiId: 'org-kpi-1',
      status: 'CONFIRMED',
      employee: {
        deptId: 'dept-1',
      },
    },
  ]
}

function buildOrgKpis() {
  return [
    {
      id: 'org-kpi-1',
      deptId: 'dept-1',
      parentOrgKpiId: null,
      status: 'CONFIRMED',
    },
  ]
}

function buildMonthlyRecords() {
  return [
    {
      id: 'mr-1',
      employeeId: 'emp-target',
      personalKpiId: 'pk-1',
      yearMonth: '2026-03',
      achievementRate: 92,
      obstacles: '',
      attachments: [{ type: 'LINK', url: 'https://drive.google.com/file/d/123/view', comment: '증빙 링크' }],
      personalKpi: {
        id: 'pk-1',
        kpiName: '신규 매출',
        employeeId: 'emp-target',
        linkedOrgKpiId: 'org-kpi-1',
        employee: {
          deptId: 'dept-1',
        },
      },
    },
  ]
}

function buildCheckIns() {
  return [
    {
      id: 'checkin-1',
      ownerId: 'emp-target',
      status: 'COMPLETED',
    },
  ]
}

async function withStubbedStatisticsPrisma(
  overrides: Partial<Record<string, PrismaMethod>>,
  fn: () => Promise<void>
) {
  const { prisma } = await import('../src/lib/prisma')
  const prismaAny = prisma as any

  const snapshot = {
    employeeFindUnique: prismaAny.employee.findUnique,
    employeeFindMany: prismaAny.employee.findMany,
    organizationFindMany: prismaAny.organization.findMany,
    evalCycleFindMany: prismaAny.evalCycle.findMany,
    departmentFindMany: prismaAny.department.findMany,
    gradeSettingFindMany: prismaAny.gradeSetting.findMany,
    evaluationFindMany: prismaAny.evaluation.findMany,
    evaluationAssignmentFindMany: prismaAny.evaluationAssignment.findMany,
    personalKpiFindMany: prismaAny.personalKpi.findMany,
    orgKpiFindMany: prismaAny.orgKpi.findMany,
    monthlyRecordFindMany: prismaAny.monthlyRecord.findMany,
    checkInFindMany: prismaAny.checkIn.findMany,
    midReviewAssignmentFindMany: prismaAny.midReviewAssignment.findMany,
    appealFindMany: prismaAny.appeal.findMany,
    aiRequestLogFindMany: prismaAny.aiRequestLog.findMany,
    aiCompetencyCycleFindFirst: prismaAny.aiCompetencyCycle.findFirst,
    aiCompetencyAssignmentFindMany: prismaAny.aiCompetencyAssignment.findMany,
    aiCompetencyAttemptFindMany: prismaAny.aiCompetencyAttempt.findMany,
    aiCompetencyResultFindMany: prismaAny.aiCompetencyResult.findMany,
  }

  prismaAny.employee.findUnique =
    overrides.employeeFindUnique ??
    (async () => ({
      id: 'emp-admin',
      empName: 'Admin User',
      role: 'ROLE_ADMIN',
      department: {
        deptName: '경영지원',
        orgId: 'org-1',
        organization: {
          name: 'RSUPPORT',
        },
      },
    }))

  prismaAny.employee.findMany = overrides.employeeFindMany ?? (async () => buildScopedEmployees())
  prismaAny.organization.findMany =
    overrides.organizationFindMany ?? (async () => [{ id: 'org-1', name: 'RSUPPORT' }])
  prismaAny.evalCycle.findMany = overrides.evalCycleFindMany ?? (async () => [buildCycle()])
  prismaAny.department.findMany =
    overrides.departmentFindMany ??
    (async () => [
      {
        id: 'dept-1',
        deptName: '영업1팀',
        deptCode: 'D001',
        parentDeptId: null,
        orgId: 'org-1',
      },
    ])
  prismaAny.gradeSetting.findMany =
    overrides.gradeSettingFindMany ??
    (async () => [
      {
        id: 'grade-a',
        gradeName: 'A',
        minScore: 85,
        maxScore: 94.9,
        targetDistRate: 40,
        gradeOrder: 1,
      },
    ])
  prismaAny.evaluation.findMany = overrides.evaluationFindMany ?? (async () => buildEvaluationRows())
  prismaAny.evaluationAssignment.findMany =
    overrides.evaluationAssignmentFindMany ?? (async () => buildAssignments())
  prismaAny.personalKpi.findMany = overrides.personalKpiFindMany ?? (async () => buildPersonalKpis())
  prismaAny.orgKpi.findMany = overrides.orgKpiFindMany ?? (async () => buildOrgKpis())
  prismaAny.monthlyRecord.findMany = overrides.monthlyRecordFindMany ?? (async () => buildMonthlyRecords())
  prismaAny.checkIn.findMany = overrides.checkInFindMany ?? (async () => buildCheckIns())
  prismaAny.midReviewAssignment.findMany = overrides.midReviewAssignmentFindMany ?? (async () => [])
  prismaAny.appeal.findMany = overrides.appealFindMany ?? (async () => [])
  prismaAny.aiRequestLog.findMany = overrides.aiRequestLogFindMany ?? (async () => [])
  prismaAny.aiCompetencyCycle.findFirst = overrides.aiCompetencyCycleFindFirst ?? (async () => null)
  prismaAny.aiCompetencyAssignment.findMany =
    overrides.aiCompetencyAssignmentFindMany ?? (async () => [])
  prismaAny.aiCompetencyAttempt.findMany = overrides.aiCompetencyAttemptFindMany ?? (async () => [])
  prismaAny.aiCompetencyResult.findMany = overrides.aiCompetencyResultFindMany ?? (async () => [])

  try {
    await fn()
  } finally {
    prismaAny.employee.findUnique = snapshot.employeeFindUnique
    prismaAny.employee.findMany = snapshot.employeeFindMany
    prismaAny.organization.findMany = snapshot.organizationFindMany
    prismaAny.evalCycle.findMany = snapshot.evalCycleFindMany
    prismaAny.department.findMany = snapshot.departmentFindMany
    prismaAny.gradeSetting.findMany = snapshot.gradeSettingFindMany
    prismaAny.evaluation.findMany = snapshot.evaluationFindMany
    prismaAny.evaluationAssignment.findMany = snapshot.evaluationAssignmentFindMany
    prismaAny.personalKpi.findMany = snapshot.personalKpiFindMany
    prismaAny.orgKpi.findMany = snapshot.orgKpiFindMany
    prismaAny.monthlyRecord.findMany = snapshot.monthlyRecordFindMany
    prismaAny.checkIn.findMany = snapshot.checkInFindMany
    prismaAny.midReviewAssignment.findMany = snapshot.midReviewAssignmentFindMany
    prismaAny.appeal.findMany = snapshot.appealFindMany
    prismaAny.aiRequestLog.findMany = snapshot.aiRequestLogFindMany
    prismaAny.aiCompetencyCycle.findFirst = snapshot.aiCompetencyCycleFindFirst
    prismaAny.aiCompetencyAssignment.findMany = snapshot.aiCompetencyAssignmentFindMany
    prismaAny.aiCompetencyAttempt.findMany = snapshot.aiCompetencyAttemptFindMany
    prismaAny.aiCompetencyResult.findMany = snapshot.aiCompetencyResultFindMany
  }
}

async function main() {
  await run('statistics loader returns ready state with real sections when data exists', async () => {
    const { getStatisticsPageData } = await import('../src/server/statistics-page')

    await withStubbedStatisticsPrisma({}, async () => {
      const data = await getStatisticsPageData(makeSession(), {})

      assert.equal(data.state, 'ready')
      assert.equal(Boolean(data.sections), true)
      assert.equal(data.sections?.evaluationOperations.state, 'ready')
      assert.equal(data.sections?.kpiExecution.state, 'ready')
      assert.equal(data.sections?.fairness.state, 'ready')
      assert.equal(data.summaryCards.length > 0, true)
    })
  })

  await run('statistics loader returns empty state when no cycles exist', async () => {
    const { getStatisticsPageData } = await import('../src/server/statistics-page')

    await withStubbedStatisticsPrisma(
      {
        evalCycleFindMany: async () => [],
      },
      async () => {
        const data = await getStatisticsPageData(makeSession(), {})

        assert.equal(data.state, 'empty')
        assert.equal(data.message, '표시할 평가 주기가 없습니다.')
        assert.equal(data.summaryCards.length, 0)
      }
    )
  })

  await run('statistics loader returns empty state when no scoped employees exist', async () => {
    const { getStatisticsPageData } = await import('../src/server/statistics-page')

    await withStubbedStatisticsPrisma(
      {
        employeeFindMany: async () => [],
      },
      async () => {
        const data = await getStatisticsPageData(makeSession(), {})

        assert.equal(data.state, 'empty')
        assert.equal(data.message, '선택한 조건에 해당하는 인원이 없습니다.')
      }
    )
  })

  await run('statistics loader isolates evaluation domain failures and keeps page ready', async () => {
    const { getStatisticsPageData } = await import('../src/server/statistics-page')

    await withStubbedStatisticsPrisma(
      {
        evaluationFindMany: async () => {
          throw new Error('evaluation domain failure')
        },
      },
      async () => {
        const data = await getStatisticsPageData(makeSession(), {})

        assert.equal(data.state, 'ready')
        assert.equal(data.alerts.length > 0, true)
        assert.equal(data.sections?.evaluationOperations.state, 'error')
        assert.equal(data.sections?.performanceDistribution.state, 'error')
        assert.equal(data.sections?.kpiExecution.state, 'ready')
      }
    )
  })

  await run('statistics loader treats required-scope failures as fatal errors', async () => {
    const { getStatisticsPageData } = await import('../src/server/statistics-page')

    await withStubbedStatisticsPrisma(
      {
        departmentFindMany: async () => {
          throw new Error('scope failure')
        },
      },
      async () => {
        const data = await getStatisticsPageData(makeSession(), {})

        assert.equal(data.state, 'error')
        assert.equal(data.message, '통계 페이지를 불러오는 중 오류가 발생했습니다.')
      }
    )
  })

  await run('statistics loader normalizes stale filters without fatal failure', async () => {
    const { getStatisticsPageData } = await import('../src/server/statistics-page')

    await withStubbedStatisticsPrisma({}, async () => {
      const data = await getStatisticsPageData(makeSession(), {
        period: 'bad-period',
        cycleId: 'missing-cycle',
        departmentId: 'missing-dept',
        position: 'UNKNOWN_POSITION',
        orgId: 'missing-org',
      })

      assert.equal(data.state, 'ready')
      assert.equal(data.filters.selectedPeriod, '12m')
      assert.equal(data.filters.selectedDepartmentId, 'ALL')
      assert.equal(data.filters.selectedPosition, 'ALL')
      assert.equal(data.alerts.some((alert) => alert.title.includes('필터')), true)
    })
  })

  console.log('Statistics loader tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
