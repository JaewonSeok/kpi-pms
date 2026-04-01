import assert from 'node:assert/strict'

type PrismaMethod = (...args: any[]) => Promise<any>

process.env.DATABASE_URL ||= 'postgresql://postgres:password@localhost:5432/kpi_pms'

async function run(name: string, fn: () => Promise<void> | void) {
  try {
    await fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

function makeSession() {
  return {
    user: {
      id: 'emp-admin',
      name: '관리자',
      role: 'ROLE_ADMIN',
    },
  } as any
}

async function withStubbedWorkbenchData(
  overrides: Partial<Record<string, PrismaMethod>>,
  fn: () => Promise<void>
) {
  const { prisma } = await import('../src/lib/prisma')
  const prismaAny = prisma as any

  const snapshot = {
    employeeFindUnique: prismaAny.employee.findUnique,
    evalCycleFindMany: prismaAny.evalCycle.findMany,
    evaluationFindMany: prismaAny.evaluation.findMany,
    personalKpiCount: prismaAny.personalKpi.count,
    feedbackRoundCount: prismaAny.multiFeedbackRound.count,
    auditLogFindMany: prismaAny.auditLog.findMany,
    aiRequestLogFindMany: prismaAny.aiRequestLog.findMany,
    monthlyRecordFindMany: prismaAny.monthlyRecord.findMany,
    checkInFindMany: prismaAny.checkIn.findMany,
    gradeSettingFindMany: prismaAny.gradeSetting.findMany,
    feedbackRoundFindMany: prismaAny.multiFeedbackRound.findMany,
  }

  prismaAny.employee.findUnique =
    overrides.employeeFindUnique ??
    (async () => ({
      id: 'emp-admin',
      empName: '관리자',
      role: 'ROLE_ADMIN',
      department: {
        deptName: '인사팀',
        orgId: 'org-1',
        organization: { id: 'org-1', orgName: 'RSUPPORT' },
      },
    }))

  prismaAny.evalCycle.findMany =
    overrides.evalCycleFindMany ??
    (async () => [
      {
        id: 'cycle-1',
        cycleName: '2026 상반기',
        evalYear: 2026,
        status: 'SELF_EVAL',
        showQuestionWeight: true,
        showScoreSummary: true,
      },
    ])

  prismaAny.evaluation.findMany =
    overrides.evaluationFindMany ??
    (async () => [
      {
        id: 'eval-1',
        evalCycleId: 'cycle-1',
        evalCycle: {
          id: 'cycle-1',
          cycleName: '2026 상반기',
          evalYear: 2026,
          status: 'SELF_EVAL',
        },
        evaluator: {
          id: 'emp-admin',
          empName: '관리자',
          position: 'DIRECTOR',
          department: { deptName: '인사팀' },
        },
        target: {
          id: 'emp-target',
          empName: '홍길동',
          position: 'TEAM_LEADER',
          department: { deptName: '플랫폼팀' },
        },
        evalStage: 'FIRST',
        status: 'IN_PROGRESS',
        totalScore: 78,
        comment: '현재 초안',
        gradeId: 'grade-a',
        submittedAt: null,
        updatedAt: new Date('2026-03-31T09:00:00Z'),
        createdAt: new Date('2026-03-30T09:00:00Z'),
        items: [
          {
            id: 'eval-item-1',
            personalKpiId: 'pk-1',
            quantScore: 80,
            planScore: null,
            doScore: null,
            checkScore: null,
            actScore: null,
            weightedScore: 32,
            itemComment: '핵심 KPI를 안정적으로 수행했습니다.',
            personalKpi: {
              id: 'pk-1',
              kpiName: '매출 성장',
              kpiType: 'QUANTITATIVE',
              weight: 40,
              targetValue: 100,
              unit: '%',
              definition: '매출 성장률',
              linkedOrgKpi: {
                id: 'org-kpi-1',
                kpiName: '전사 성장',
                department: { deptName: '경영기획' },
              },
              monthlyRecords: [
                {
                  id: 'mr-inline-1',
                  yearMonth: '2026-03',
                  achievementRate: 92,
                  activities: '주요 프로젝트를 마감했습니다.',
                  obstacles: null,
                  updatedAt: new Date('2026-03-31T09:00:00Z'),
                },
              ],
            },
          },
        ],
      },
    ])

  prismaAny.personalKpi.count = overrides.personalKpiCount ?? (async () => 1)
  prismaAny.multiFeedbackRound.count = overrides.feedbackRoundCount ?? (async () => 2)
  prismaAny.auditLog.findMany = overrides.auditLogFindMany ?? (async () => [])
  prismaAny.aiRequestLog.findMany = overrides.aiRequestLogFindMany ?? (async () => [])
  prismaAny.monthlyRecord.findMany =
    overrides.monthlyRecordFindMany ??
    (async () => [
      {
        id: 'mr-1',
        personalKpiId: 'pk-1',
        yearMonth: '2026-03',
        achievementRate: 92,
        activities: '주요 프로젝트를 마감했습니다.',
        obstacles: null,
        personalKpi: {
          kpiName: '매출 성장',
        },
      },
    ])
  prismaAny.checkIn.findMany =
    overrides.checkInFindMany ??
    (async () => [
      {
        id: 'checkin-1',
        scheduledDate: new Date('2026-03-20T00:00:00Z'),
        status: 'COMPLETED',
        keyTakeaways: '우선순위 정리가 빨라졌습니다.',
        managerNotes: null,
        ownerNotes: null,
        actionItems: [{ action: '다음 달 공유 일정 선반영' }],
      },
    ])
  prismaAny.gradeSetting.findMany =
    overrides.gradeSettingFindMany ??
    (async () => [
      {
        id: 'grade-a',
        gradeName: 'A',
        minScore: 90,
        maxScore: 100,
        gradeOrder: 1,
      },
    ])
  prismaAny.multiFeedbackRound.findMany =
    overrides.feedbackRoundFindMany ??
    (async () => [
      {
        id: 'round-1',
        roundName: '상반기 360',
        roundType: 'PEER',
        minRaters: 3,
        feedbacks: [
          {
            responses: [
              {
                question: { questionType: 'RATING_SCALE' },
                ratingValue: 4,
                textValue: '협업 조율이 안정적입니다.',
              },
            ],
          },
        ],
      },
    ])

  try {
    await fn()
  } finally {
    prismaAny.employee.findUnique = snapshot.employeeFindUnique
    prismaAny.evalCycle.findMany = snapshot.evalCycleFindMany
    prismaAny.evaluation.findMany = snapshot.evaluationFindMany
    prismaAny.personalKpi.count = snapshot.personalKpiCount
    prismaAny.multiFeedbackRound.count = snapshot.feedbackRoundCount
    prismaAny.auditLog.findMany = snapshot.auditLogFindMany
    prismaAny.aiRequestLog.findMany = snapshot.aiRequestLogFindMany
    prismaAny.monthlyRecord.findMany = snapshot.monthlyRecordFindMany
    prismaAny.checkIn.findMany = snapshot.checkInFindMany
    prismaAny.gradeSetting.findMany = snapshot.gradeSettingFindMany
    prismaAny.multiFeedbackRound.findMany = snapshot.feedbackRoundFindMany
  }
}

async function main() {
  await run('evaluation workbench stays ready and surfaces alerts when monthly evidence loading fails', async () => {
    const { getEvaluationWorkbenchPageData } = await import('../src/server/evaluation-workbench')

    await withStubbedWorkbenchData(
      {
        monthlyRecordFindMany: async () => {
          throw new Error('monthly source failed')
        },
      },
      async () => {
        const data = await getEvaluationWorkbenchPageData({
          session: makeSession(),
          cycleId: 'cycle-1',
          evaluationId: 'eval-1',
        })

        assert.equal(data.state, 'ready')
        assert.equal(Boolean(data.selected), true)
        assert.equal(data.selected?.evidence.monthlyRecords.length, 0)
        assert.equal(data.alerts?.some((item) => item.includes('월간 실적')), true)
      }
    )
  })

  await run('evaluation workbench keeps rendering when checkin and feedback sources partially fail', async () => {
    const { getEvaluationWorkbenchPageData } = await import('../src/server/evaluation-workbench')

    await withStubbedWorkbenchData(
      {
        checkInFindMany: async () => {
          throw new Error('checkin source failed')
        },
        feedbackRoundFindMany: async () => {
          throw new Error('feedback source failed')
        },
      },
      async () => {
        const data = await getEvaluationWorkbenchPageData({
          session: makeSession(),
          cycleId: 'cycle-1',
          evaluationId: 'eval-1',
        })

        assert.equal(data.state, 'ready')
        assert.equal(data.selected?.evidence.checkins.length, 0)
        assert.equal(data.selected?.evidence.feedbackRounds.length, 0)
        assert.equal(data.alerts?.some((item) => item.includes('체크인')), true)
        assert.equal(data.alerts?.some((item) => item.includes('다면 피드백')), true)
      }
    )
  })

  await run('evaluation workbench derives guide status and admin training summary from audit and AI usage logs', async () => {
    const { getEvaluationWorkbenchPageData } = await import('../src/server/evaluation-workbench')

    await withStubbedWorkbenchData(
      {
        auditLogFindMany: async () => [
          {
            id: 'audit-guide-view',
            entityId: 'eval-1',
            entityType: 'Evaluation',
            userId: 'emp-admin',
            action: 'EVALUATION_GUIDE_VIEWED',
            timestamp: new Date('2026-03-31T10:00:00Z'),
            newValue: null,
          },
          {
            id: 'audit-guide-confirm',
            entityId: 'eval-1',
            entityType: 'Evaluation',
            userId: 'emp-admin',
            action: 'EVALUATION_GUIDE_CONFIRMED',
            timestamp: new Date('2026-03-31T10:10:00Z'),
            newValue: null,
          },
        ],
        aiRequestLogFindMany: async () => [
          {
            id: 'ai-log-1',
            sourceId: 'eval-1',
            requestType: 'EVAL_COMMENT_DRAFT',
            requestStatus: 'SUCCESS',
            approvalStatus: 'PENDING',
            createdAt: new Date('2026-03-31T10:20:00Z'),
          },
        ],
      },
      async () => {
        const data = await getEvaluationWorkbenchPageData({
          session: makeSession(),
          cycleId: 'cycle-1',
          evaluationId: 'eval-1',
        })

        assert.equal(data.state, 'ready')
        assert.deepEqual(data.selected?.guideStatus, {
          viewed: true,
          confirmed: true,
        })
        assert.equal(data.adminSummary?.guideViewedCount, 1)
        assert.equal(data.adminSummary?.guideConfirmedCount, 1)
        assert.equal(data.adminSummary?.aiUsedCount, 1)
      }
    )
  })

  console.log('Evaluation workbench loader tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
