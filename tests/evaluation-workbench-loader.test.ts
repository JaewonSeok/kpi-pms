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
    evaluationFindUnique: prismaAny.evaluation.findUnique,
    evaluationFindMany: prismaAny.evaluation.findMany,
    personalKpiCount: prismaAny.personalKpi.count,
    feedbackRoundCount: prismaAny.multiFeedbackRound.count,
    auditLogFindMany: prismaAny.auditLog.findMany,
    aiRequestLogFindMany: prismaAny.aiRequestLog.findMany,
    aiRequestLogFindFirst: prismaAny.aiRequestLog.findFirst,
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

  prismaAny.evaluation.findUnique =
    overrides.evaluationFindUnique ??
    (async () => null)

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
              status: 'CONFIRMED',
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
  prismaAny.aiRequestLog.findFirst = overrides.aiRequestLogFindFirst ?? (async () => null)
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
    prismaAny.evaluation.findUnique = snapshot.evaluationFindUnique
    prismaAny.evaluation.findMany = snapshot.evaluationFindMany
    prismaAny.personalKpi.count = snapshot.personalKpiCount
    prismaAny.multiFeedbackRound.count = snapshot.feedbackRoundCount
    prismaAny.auditLog.findMany = snapshot.auditLogFindMany
    prismaAny.aiRequestLog.findMany = snapshot.aiRequestLogFindMany
    prismaAny.aiRequestLog.findFirst = snapshot.aiRequestLogFindFirst
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

  await run('evaluation workbench builds goal-linked context from KPI, monthly record, and checkin evidence', async () => {
    const { getEvaluationWorkbenchPageData } = await import('../src/server/evaluation-workbench')

    await withStubbedWorkbenchData(
      {
        monthlyRecordFindMany: async () => [
          {
            id: 'mr-1',
            personalKpiId: 'pk-1',
            yearMonth: '2026-02',
            achievementRate: 88,
            activities: '신규 파이프라인 운영 체계를 정리했습니다.',
            obstacles: '승인 리드타임이 길었습니다.',
            efforts: '자동화 규칙을 설계해 운영 부담을 줄였습니다.',
            attachments: [
              {
                id: 'link-1',
                name: '성과 정리 문서',
                uploadedBy: '정지원',
                dataUrl: 'https://example.com/goal-context',
              },
            ],
            personalKpi: {
              kpiName: '매출 성장',
            },
          },
          {
            id: 'mr-2',
            personalKpiId: 'pk-1',
            yearMonth: '2026-01',
            achievementRate: 72,
            activities: '초기 실험을 진행했습니다.',
            obstacles: null,
            efforts: null,
            attachments: null,
            personalKpi: {
              kpiName: '매출 성장',
            },
          },
        ],
        checkInFindMany: async () => [
          {
            id: 'checkin-1',
            scheduledDate: new Date('2026-02-20T00:00:00Z'),
            status: 'COMPLETED',
            keyTakeaways: '실행 우선순위를 다시 잡았습니다.',
            managerNotes: null,
            ownerNotes: null,
            actionItems: [
              { action: '고객 인터뷰 정리', assignee: '박하나' },
              { action: '후속 미팅 조율', assignee: '정수현' },
            ],
            kpiDiscussed: [
              {
                kpiId: 'pk-1',
                progress: '리드 품질이 안정적으로 개선되고 있습니다.',
                support: '승인 리드타임 단축이 필요합니다.',
              },
            ],
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
        assert.equal(data.selected?.items[0]?.goalContext.periodLabel, '2026.01 ~ 2026.02')
        assert.deepEqual(data.selected?.items[0]?.goalContext.collaborators, ['박하나', '정수현', '정지원'])
        assert.equal(
          data.selected?.items[0]?.goalContext.achievementSummary?.includes('자동화 규칙을 설계해 운영 부담을 줄였습니다.'),
          true
        )
        assert.deepEqual(data.selected?.items[0]?.goalContext.links, [
          {
            id: 'link-1',
            label: '성과 정리 문서',
            href: 'https://example.com/goal-context',
            uploadedBy: '정지원',
          },
        ])
        assert.equal(data.selected?.items[0]?.goalContext.progressRate, 88)
        assert.equal(data.selected?.items[0]?.goalContext.progressLabel, '진행률 88%')
        assert.equal(data.selected?.items[0]?.goalContext.approvalStatusKey, 'CONFIRMED')
        assert.equal(data.selected?.items[0]?.goalContext.approvalStatusLabel, '승인 상태: 확정')
        assert.equal(data.selected?.items[0]?.goalContext.weightLabel, '성과 가중치 40%')
      }
    )
  })

  await run('evaluation workbench goal-linked context degrades safely when optional goal details are missing', async () => {
    const { getEvaluationWorkbenchPageData } = await import('../src/server/evaluation-workbench')

    await withStubbedWorkbenchData(
      {
        evaluationFindMany: async () => [
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
              department: { deptName: '영업팀' },
            },
            evalStage: 'FIRST',
            status: 'IN_PROGRESS',
            totalScore: 78,
            comment: null,
            gradeId: null,
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
                itemComment: null,
                personalKpi: {
                  id: 'pk-1',
                  kpiName: '매출 성장',
                  kpiType: 'QUANTITATIVE',
                  status: 'DRAFT',
                  weight: 40,
                  targetValue: 100,
                  unit: '%',
                  definition: '매출 성장 목표',
                  linkedOrgKpi: null,
                  monthlyRecords: [],
                },
              },
            ],
          },
        ],
        monthlyRecordFindMany: async () => [],
        checkInFindMany: async () => [],
      },
      async () => {
        const data = await getEvaluationWorkbenchPageData({
          session: makeSession(),
          cycleId: 'cycle-1',
          evaluationId: 'eval-1',
        })

        assert.equal(data.state, 'ready')
        assert.equal(data.selected?.items[0]?.goalContext.periodLabel, '2026년 평가 주기')
        assert.deepEqual(data.selected?.items[0]?.goalContext.collaborators, [])
        assert.equal(data.selected?.items[0]?.goalContext.achievementSummary, null)
        assert.deepEqual(data.selected?.items[0]?.goalContext.links, [])
        assert.equal(data.selected?.items[0]?.goalContext.progressRate, null)
        assert.equal(data.selected?.items[0]?.goalContext.progressLabel, '진행률 미집계')
        assert.equal(data.selected?.items[0]?.goalContext.approvalStatusKey, 'DRAFT')
        assert.equal(data.selected?.items[0]?.goalContext.approvalStatusLabel, '승인 상태: 초안')
        assert.equal(data.selected?.items[0]?.goalContext.linkedGoalLabel, null)
      }
    )
  })

  await run('evaluation workbench only requests self-stage rows for the target employee view', async () => {
    const { getEvaluationWorkbenchPageData } = await import('../src/server/evaluation-workbench')

    let capturedWhere: Record<string, unknown> | null = null

    await withStubbedWorkbenchData(
      {
        employeeFindUnique: async () => ({
          id: 'emp-member',
          empName: '구성원',
          role: 'ROLE_MEMBER',
          department: {
            deptName: '인사팀',
            orgId: 'org-1',
            organization: { id: 'org-1', orgName: 'RSUPPORT' },
          },
        }),
        evaluationFindMany: async (args: { where: Record<string, unknown> }) => {
          capturedWhere = args.where
          return []
        },
      },
      async () => {
        const data = await getEvaluationWorkbenchPageData({
          session: {
            user: {
              id: 'emp-member',
              name: '구성원',
              role: 'ROLE_MEMBER',
            },
          } as any,
          cycleId: 'cycle-1',
        })

        assert.equal(data.state, 'ready')
        assert.deepEqual(capturedWhere, {
          evalCycleId: 'cycle-1',
          OR: [
            { evaluatorId: 'emp-member' },
            { targetId: 'emp-member', evalStage: 'SELF' },
          ],
        })
      }
    )
  })

  await run('evaluation workbench exposes the previous stage evaluation summary when available', async () => {
    const { getEvaluationWorkbenchPageData } = await import('../src/server/evaluation-workbench')

    await withStubbedWorkbenchData(
      {
        evaluationFindUnique: async () => ({
          id: 'eval-self-1',
          evalStage: 'SELF',
          totalScore: 74,
          comment: '이전 단계 자기평가 의견입니다.',
          submittedAt: new Date('2026-03-31T08:00:00Z'),
          updatedAt: new Date('2026-03-31T08:10:00Z'),
          evaluator: {
            empName: '홍길동',
          },
        }),
      },
      async () => {
        const data = await getEvaluationWorkbenchPageData({
          session: makeSession(),
          cycleId: 'cycle-1',
          evaluationId: 'eval-1',
        })

        assert.equal(data.state, 'ready')
        assert.equal(data.selected?.previousStageEvaluation?.id, 'eval-self-1')
        assert.equal(Boolean(data.selected?.previousStageEvaluation?.comment?.includes('이전 단계')), true)
        assert.equal(data.selected?.permissions.canReject, true)
      }
    )
  })

  console.log('Evaluation workbench loader tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
