import './register-path-aliases'
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

function makeSession(user?: Partial<{ id: string; name: string; role: string }>) {
  return {
    user: {
      id: user?.id ?? 'emp-admin',
      name: user?.name ?? 'Admin Reviewer',
      role: user?.role ?? 'ROLE_ADMIN',
    },
  } as any
}

function buildEvaluationListRow(params?: Partial<any>) {
  return {
    id: params?.id ?? 'eval-1',
    evalCycleId: params?.evalCycleId ?? 'cycle-1',
    evalCycle: {
      id: 'cycle-1',
      cycleName: '2026 상반기',
      evalYear: 2026,
      status: 'SELF_EVAL',
    },
    evaluator: {
      id: params?.evaluator?.id ?? 'emp-team-leader',
      empName: params?.evaluator?.empName ?? 'Leader Reviewer',
      position: params?.evaluator?.position ?? 'TEAM_LEADER',
      department: {
        deptName: params?.evaluator?.department?.deptName ?? '영업팀',
      },
    },
    target: {
      id: params?.target?.id ?? 'emp-target',
      empName: params?.target?.empName ?? 'Target Employee',
      position: params?.target?.position ?? 'TEAM_LEADER',
      department: {
        deptName: params?.target?.department?.deptName ?? '영업팀',
      },
    },
    evalStage: params?.evalStage ?? 'FIRST',
    status: params?.status ?? 'IN_PROGRESS',
    totalScore: params?.totalScore ?? 78,
    comment: params?.comment ?? '현재 단계 초안 의견',
    gradeId: params?.gradeId ?? 'grade-a',
    submittedAt: params?.submittedAt ?? null,
    updatedAt: params?.updatedAt ?? new Date('2026-03-31T09:00:00Z'),
    createdAt: params?.createdAt ?? new Date('2026-03-30T09:00:00Z'),
    items:
      params?.items ??
      [
        {
          id: 'eval-item-1',
          personalKpiId: 'pk-1',
          quantScore: 80,
          planScore: null,
          doScore: null,
          checkScore: null,
          actScore: null,
          weightedScore: 32,
          itemComment: '담당 KPI를 안정적으로 수행했습니다.',
          personalKpi: {
            id: 'pk-1',
            kpiName: '매출 성장',
            kpiType: 'QUANTITATIVE',
            status: 'CONFIRMED',
            weight: 40,
            targetValue: 100,
            unit: '%',
            definition: '매출 성장률 달성',
            linkedOrgKpi: {
              id: 'org-kpi-1',
              kpiName: '회사 성장',
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
  }
}

function buildStageEvaluation(params: {
  id: string
  stage: string
  evaluatorName: string
  evaluatorPosition: string
  status?: string
  totalScore?: number
  comment?: string | null
  submittedAt?: Date | null
  updatedAt?: Date
}) {
  return {
    id: params.id,
    evalStage: params.stage,
    totalScore: params.totalScore ?? null,
    comment: params.comment ?? null,
    status: params.status ?? 'SUBMITTED',
    submittedAt: params.submittedAt ?? new Date('2026-03-31T08:00:00Z'),
    updatedAt: params.updatedAt ?? new Date('2026-03-31T08:10:00Z'),
    evaluator: {
      empName: params.evaluatorName,
      position: params.evaluatorPosition,
    },
  }
}

async function withStubbedWorkbenchData(
  overrides: Partial<Record<string, PrismaMethod>>,
  fn: () => Promise<void>
) {
  const { prisma } = await import('../src/lib/prisma')
  const prismaAny = prisma as any

  const snapshot = {
    employeeFindUnique: prismaAny.employee.findUnique,
    employeeFindMany: prismaAny.employee.findMany,
    employeeFindFirst: prismaAny.employee.findFirst,
    evalCycleFindMany: prismaAny.evalCycle.findMany,
    evaluationFindMany: prismaAny.evaluation.findMany,
    personalKpiCount: prismaAny.personalKpi.count,
    feedbackRoundCount: prismaAny.multiFeedbackRound.count,
    evaluationAssignmentFindMany: prismaAny.evaluationAssignment.findMany,
    auditLogFindMany: prismaAny.auditLog.findMany,
    aiRequestLogFindMany: prismaAny.aiRequestLog.findMany,
    aiRequestLogFindFirst: prismaAny.aiRequestLog.findFirst,
    monthlyRecordFindMany: prismaAny.monthlyRecord.findMany,
    checkInFindMany: prismaAny.checkIn.findMany,
    gradeSettingFindMany: prismaAny.gradeSetting.findMany,
    feedbackRoundFindMany: prismaAny.multiFeedbackRound.findMany,
  }

  const defaultTargetProfile = {
    id: 'emp-target',
    empName: 'Target Employee',
    role: 'ROLE_MEMBER',
    position: 'TEAM_LEADER',
    teamLeaderId: 'emp-team-leader',
    sectionChiefId: 'emp-section-chief',
    divisionHeadId: 'emp-div-head',
    department: {
      deptName: '영업팀',
    },
  }

  const defaultEvaluations = [buildEvaluationListRow()]
  const defaultStageEvaluations = [
    buildStageEvaluation({
      id: 'eval-self-1',
      stage: 'SELF',
      evaluatorName: 'Target Employee',
      evaluatorPosition: 'TEAM_LEADER',
      totalScore: 74,
      comment: '이전 단계 자기평가 의견입니다.',
    }),
    buildStageEvaluation({
      id: 'eval-1',
      stage: 'FIRST',
      evaluatorName: 'Leader Reviewer',
      evaluatorPosition: 'TEAM_LEADER',
      totalScore: 78,
      comment: '팀장 평가 의견입니다.',
      status: 'IN_PROGRESS',
      submittedAt: null,
    }),
  ]

  prismaAny.employee.findUnique =
    overrides.employeeFindUnique ??
    (async (args: { where?: { id?: string } }) => {
      const id = args?.where?.id

      if (id === 'emp-admin') {
        return {
          id: 'emp-admin',
          empName: 'Admin Reviewer',
          role: 'ROLE_ADMIN',
          position: 'DIRECTOR',
          department: {
            deptName: '인사팀',
            orgId: 'org-1',
            organization: { id: 'org-1', orgName: 'RSUPPORT' },
          },
        }
      }

      if (id === 'emp-member') {
        return {
          id: 'emp-member',
          empName: 'Member User',
          role: 'ROLE_MEMBER',
          position: 'TEAM_LEADER',
          department: {
            deptName: '인사팀',
            orgId: 'org-1',
            organization: { id: 'org-1', orgName: 'RSUPPORT' },
          },
        }
      }

      if (id === 'emp-target') {
        return defaultTargetProfile
      }

      return null
    })

  prismaAny.employee.findMany =
    overrides.employeeFindMany ??
    (async () => [
      {
        id: 'emp-team-leader',
        empName: 'Leader Reviewer',
        role: 'ROLE_TEAM_LEADER',
        position: 'TEAM_LEADER',
        department: { deptName: '영업팀' },
      },
      {
        id: 'emp-section-chief',
        empName: 'Section Reviewer',
        role: 'ROLE_SECTION_CHIEF',
        position: 'DIRECTOR',
        department: { deptName: '사업부' },
      },
      {
        id: 'emp-div-head',
        empName: 'Division Reviewer',
        role: 'ROLE_DIV_HEAD',
        position: 'DIRECTOR',
        department: { deptName: '본부' },
      },
    ])

  prismaAny.employee.findFirst =
    overrides.employeeFindFirst ??
    (async (args: { where?: { role?: string } }) => {
      if (args?.where?.role === 'ROLE_CEO') {
        return {
          id: 'emp-ceo',
          empName: 'CEO Reviewer',
          role: 'ROLE_CEO',
          position: 'CEO',
          department: { deptName: '대표이사실' },
        }
      }

      if (args?.where?.role === 'ROLE_ADMIN') {
        return {
          id: 'emp-admin',
          empName: 'Admin Reviewer',
          role: 'ROLE_ADMIN',
          position: 'DIRECTOR',
          department: { deptName: '인사팀' },
        }
      }

      return null
    })

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
    (async (args: { include?: Record<string, unknown>; select?: Record<string, unknown> }) => {
      if (args?.include?.items) {
        return defaultEvaluations
      }

      if (args?.select?.evalStage) {
        return defaultStageEvaluations
      }

      return defaultEvaluations
    })

  prismaAny.personalKpi.count = overrides.personalKpiCount ?? (async () => 1)
  prismaAny.multiFeedbackRound.count = overrides.feedbackRoundCount ?? (async () => 2)
  prismaAny.evaluationAssignment.findMany =
    overrides.evaluationAssignmentFindMany ?? (async () => [])
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
        efforts: '자동화 규칙을 안정적으로 운영했습니다.',
        attachments: null,
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
        keyTakeaways: '우선순위 조정을 완료했습니다.',
        managerNotes: null,
        ownerNotes: null,
        actionItems: [{ action: '다음 단계 공유', assignee: 'Leader Reviewer' }],
        kpiDiscussed: [
          {
            kpiId: 'pk-1',
            progress: '핵심 리드를 안정적으로 관리했습니다.',
            support: '추가 협업 자원이 필요합니다.',
          },
        ],
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
    prismaAny.employee.findMany = snapshot.employeeFindMany
    prismaAny.employee.findFirst = snapshot.employeeFindFirst
    prismaAny.evalCycle.findMany = snapshot.evalCycleFindMany
    prismaAny.evaluation.findMany = snapshot.evaluationFindMany
    prismaAny.personalKpi.count = snapshot.personalKpiCount
    prismaAny.multiFeedbackRound.count = snapshot.feedbackRoundCount
    prismaAny.evaluationAssignment.findMany = snapshot.evaluationAssignmentFindMany
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
        assert.equal((data.alerts?.length ?? 0) > 0, true)
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
            obstacles: '핵심 리드 확인이 늦어졌습니다.',
            efforts: '자동화 규칙을 단계별로 운영했습니다.',
            attachments: [
              {
                id: 'link-1',
                name: '성과 정리 문서',
                uploadedBy: 'HR Partner',
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
            activities: '초기 세팅을 진행했습니다.',
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
            keyTakeaways: '실행 우선순위를 다시 조정했습니다.',
            managerNotes: null,
            ownerNotes: null,
            actionItems: [
              { action: '고객 인터뷰 정리', assignee: '박하나' },
              { action: '후속 미팅 조율', assignee: '정수민' },
            ],
            kpiDiscussed: [
              {
                kpiId: 'pk-1',
                progress: '리드를 안정적으로 관리하고 있습니다.',
                support: '추가 협업 지원이 필요합니다.',
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
        assert.deepEqual(data.selected?.items[0]?.goalContext.collaborators, ['박하나', '정수민', 'HR Partner'])
        assert.equal(
          data.selected?.items[0]?.goalContext.achievementSummary?.includes('자동화 규칙을 단계별로 운영했습니다.'),
          true
        )
        assert.deepEqual(data.selected?.items[0]?.goalContext.links, [
          {
            id: 'link-1',
            label: '성과 정리 문서',
            href: 'https://example.com/goal-context',
            uploadedBy: 'HR Partner',
          },
        ])
        assert.equal(data.selected?.items[0]?.goalContext.progressRate, 88)
        assert.equal(data.selected?.items[0]?.goalContext.approvalStatusKey, 'CONFIRMED')
        assert.equal(data.selected?.items[0]?.goalContext.weightLabel.includes('40%'), true)
      }
    )
  })

  await run('evaluation workbench only requests self-stage rows for the target employee view', async () => {
    const { getEvaluationWorkbenchPageData } = await import('../src/server/evaluation-workbench')

    let capturedWhere: Record<string, unknown> | null = null

    await withStubbedWorkbenchData(
      {
        employeeFindUnique: async (args: { where?: { id?: string } }) => {
          if (args?.where?.id === 'emp-member') {
            return {
              id: 'emp-member',
              empName: 'Member User',
              role: 'ROLE_MEMBER',
              position: 'TEAM_LEADER',
              department: {
                deptName: '인사팀',
                orgId: 'org-1',
                organization: { id: 'org-1', orgName: 'RSUPPORT' },
              },
            }
          }

          if (args?.where?.id === 'emp-target') {
            return {
              id: 'emp-target',
              empName: 'Target Employee',
              role: 'ROLE_MEMBER',
              position: 'TEAM_LEADER',
              teamLeaderId: 'emp-team-leader',
              sectionChiefId: null,
              divisionHeadId: 'emp-div-head',
              department: { deptName: '영업팀' },
            }
          }

          return null
        },
        evaluationFindMany: async (args: { where: Record<string, unknown>; include?: Record<string, unknown> }) => {
          if (args?.include?.items) {
            capturedWhere = args.where
          }
          return []
        },
      },
      async () => {
        const data = await getEvaluationWorkbenchPageData({
          session: makeSession({
            id: 'emp-member',
            name: 'Member User',
            role: 'ROLE_MEMBER',
          }),
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

  await run('evaluation workbench exposes dynamic prior-stage history and upper-stage AI briefing access', async () => {
    const { getEvaluationWorkbenchPageData } = await import('../src/server/evaluation-workbench')

    await withStubbedWorkbenchData(
      {
        employeeFindUnique: async (args: { where?: { id?: string } }) => {
          if (args?.where?.id === 'emp-admin') {
            return {
              id: 'emp-admin',
              empName: 'Admin Reviewer',
              role: 'ROLE_ADMIN',
              position: 'DIRECTOR',
              department: {
                deptName: '인사팀',
                orgId: 'org-1',
                organization: { id: 'org-1', orgName: 'RSUPPORT' },
              },
            }
          }

          if (args?.where?.id === 'emp-target') {
            return {
              id: 'emp-target',
              empName: 'Target Employee',
              role: 'ROLE_MEMBER',
              position: 'TEAM_LEADER',
              teamLeaderId: 'emp-team-leader',
              sectionChiefId: null,
              divisionHeadId: 'emp-div-head',
              department: { deptName: '영업팀' },
            }
          }

          return null
        },
        evaluationFindMany: async (args: { include?: Record<string, unknown>; select?: Record<string, unknown> }) => {
          if (args?.include?.items) {
            return [
              buildEvaluationListRow({
                id: 'eval-final-1',
                evalStage: 'FINAL',
                evaluator: {
                  id: 'emp-div-head',
                  empName: 'Division Reviewer',
                  position: 'DIRECTOR',
                  department: { deptName: '본부' },
                },
                status: 'IN_PROGRESS',
                comment: '본부장 검토 중입니다.',
              }),
            ]
          }

          if (args?.select?.evalStage) {
            return [
              buildStageEvaluation({
                id: 'eval-self-1',
                stage: 'SELF',
                evaluatorName: 'Target Employee',
                evaluatorPosition: 'TEAM_LEADER',
                totalScore: 70,
                comment: '자기평가 의견입니다.',
              }),
              buildStageEvaluation({
                id: 'eval-first-1',
                stage: 'FIRST',
                evaluatorName: 'Leader Reviewer',
                evaluatorPosition: 'TEAM_LEADER',
                totalScore: 81,
                comment: '팀장 평가 의견입니다.',
              }),
              buildStageEvaluation({
                id: 'eval-final-1',
                stage: 'FINAL',
                evaluatorName: 'Division Reviewer',
                evaluatorPosition: 'DIRECTOR',
                totalScore: 84,
                comment: '본부장 검토 중입니다.',
                status: 'IN_PROGRESS',
                submittedAt: null,
              }),
            ]
          }

          return []
        },
      },
      async () => {
        const data = await getEvaluationWorkbenchPageData({
          session: makeSession(),
          cycleId: 'cycle-1',
          evaluationId: 'eval-final-1',
        })

        assert.equal(data.state, 'ready')
        assert.deepEqual(
          data.selected?.stageChain.map((entry) => entry.stage),
          ['SELF', 'FIRST', 'FINAL', 'CEO_ADJUST']
        )
        assert.deepEqual(
          data.selected?.priorStageEvaluations.map((entry) => entry.stage),
          ['SELF', 'FIRST']
        )
        assert.equal(data.selected?.previousStageEvaluation?.id, 'eval-first-1')
        assert.equal(data.selected?.briefing?.canView, true)
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
