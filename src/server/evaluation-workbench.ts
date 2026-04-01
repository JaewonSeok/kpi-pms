import type {
  CycleStatus,
  EvalStage,
  EvalStatus,
  FeedbackRoundType,
  FeedbackStatus,
  QuestionType,
  SystemRole,
} from '@prisma/client'
import type { Session } from 'next-auth'
import { buildEvaluationAssistEvidenceView } from '@/lib/evaluation-ai-assist'
import { buildEvaluationQualityWarnings } from '@/lib/evaluation-writing-guide'
import { prisma } from '@/lib/prisma'
import type { SessionUserClaims } from '@/types/auth'
import { EVAL_STAGE_LABELS, POSITION_LABELS, formatDate } from '@/lib/utils'

export type EvaluationWorkbenchState = 'ready' | 'empty' | 'permission-denied' | 'error'

export type EvaluationWorkbenchPageData = {
  state: EvaluationWorkbenchState
  message?: string
  alerts?: string[]
  availableCycles: Array<{
    id: string
    name: string
    year: number
    status: CycleStatus
  }>
  selectedCycleId?: string
  selectedEvaluationId?: string
  summary?: {
    totalCount: number
    actionRequiredCount: number
    submittedCount: number
    rejectedCount: number
    feedbackRoundCount: number
    evidenceFreshnessLabel: string
  }
  adminSummary?: {
    guideViewedCount: number
    guideConfirmedCount: number
    aiUsedCount: number
    insufficientEvidenceWarningCount: number
    biasWarningCount: number
    coachingGapCount: number
  }
  currentUser?: {
    id: string
    name: string
    role: SystemRole
    department: string
  }
  displaySettings?: {
    showQuestionWeight: boolean
    showScoreSummary: boolean
  }
  permissions?: {
    canCreateSelfEvaluation: boolean
    canViewFeedback: boolean
    canSeeAllInCycle: boolean
  }
  evaluations?: Array<{
    id: string
    cycleId: string
    cycleName: string
    cycleYear: number
    evalStage: EvalStage
    stageLabel: string
    status: EvalStatus
    statusLabel: string
    targetId: string
    targetName: string
    targetDepartment: string
    evaluatorName: string
    totalScore?: number | null
    updatedAt: string
    submittedAt?: string
    isMine: boolean
    isEvaluator: boolean
    isActionRequired: boolean
  }>
  selected?: {
    id: string
    cycle: {
      id: string
      name: string
      year: number
      status: CycleStatus
    }
    target: {
      id: string
      name: string
      department: string
      position: string
    }
    evaluator: {
      id: string
      name: string
      position: string
    }
    evalStage: EvalStage
    stageLabel: string
    status: EvalStatus
    statusLabel: string
    totalScore?: number | null
    comment?: string | null
    gradeId?: string | null
    submittedAt?: string
    updatedAt: string
    reviewGuidance: string[]
    guideStatus: {
      viewed: boolean
      confirmed: boolean
    }
    permissions: {
      canEdit: boolean
      canSubmit: boolean
      canReject: boolean
      readOnly: boolean
    }
    gradeOptions: Array<{
      id: string
      gradeName: string
      scoreRange: string
    }>
    items: Array<{
      personalKpiId: string
      title: string
      type: 'QUANTITATIVE' | 'QUALITATIVE'
      weight: number
      linkedOrgKpiTitle?: string | null
      targetValue?: number | null
      unit?: string | null
      definition?: string | null
      recentAchievementRate?: number | null
      latestMonthlyComment?: string | null
      quantScore?: number | null
      planScore?: number | null
      doScore?: number | null
      checkScore?: number | null
      actScore?: number | null
      weightedScore?: number | null
      itemComment?: string | null
    }>
    evidence: {
      monthlyRecords: Array<{
        yearMonth: string
        title: string
        achievementRate?: number | null
        activities?: string | null
        obstacles?: string | null
      }>
      checkins: Array<{
        id: string
        scheduledDate: string
        status: string
        summary: string
        actionItems: string[]
      }>
      orgKpis: Array<{
        id: string
        title: string
        department: string
      }>
      feedbackRounds: Array<{
        id: string
        roundName: string
        roundType: FeedbackRoundType
        submittedCount: number
        averageRating?: number
        summary: string
      }>
      highlights: string[]
    }
    aiLogs: Array<{
      id: string
      createdAt: string
      requestType: string
      requestStatus: string
      approvalStatus: string
    }>
    auditLogs: Array<{
      id: string
      timestamp: string
      actor: string
      action: string
      detail: string
    }>
  }
}

type GetEvaluationWorkbenchPageDataParams = {
  session: Session
  cycleId?: string
  evaluationId?: string
}

type EvaluationRecord = Awaited<ReturnType<typeof loadEvaluations>>[number]
type WorkbenchSessionUser = NonNullable<Session['user']> &
  Pick<SessionUserClaims, 'id' | 'role'>
type WorkbenchMonthlyEvidenceRecord = {
  personalKpiId: string
  yearMonth: string
  achievementRate: number | null
  activities: string | null
  obstacles: string | null
  personalKpi: {
    kpiName: string
  }
}
type WorkbenchFeedbackRound = {
  id: string
  roundName: string
  roundType: FeedbackRoundType
  minRaters: number
  feedbacks: Array<{
    responses: Array<{
      question: {
        questionType: QuestionType
      }
      ratingValue: number | null
    }>
  }>
}

function getWorkbenchSessionUser(session: Session): WorkbenchSessionUser | null {
  const sessionUser = session.user as Partial<WorkbenchSessionUser> | undefined

  if (!sessionUser?.id || !sessionUser.role) {
    return null
  }

  return sessionUser as WorkbenchSessionUser
}

const STATUS_LABELS: Record<EvalStatus, string> = {
  PENDING: '대기',
  IN_PROGRESS: '작성 중',
  SUBMITTED: '제출됨',
  REJECTED: '반려',
  CONFIRMED: '확정',
}

function getEvidenceFreshnessLabel(rates: number[]) {
  if (!rates.length) return '근거 데이터가 아직 적습니다'
  const average = rates.reduce((sum, value) => sum + value, 0) / rates.length
  if (average >= 90) return '최근 월간 실적 흐름이 안정적입니다'
  if (average >= 75) return '일부 KPI에 추가 확인이 필요합니다'
  return '실적 근거를 먼저 보완해야 합니다'
}

function buildReviewGuidance(record: EvaluationRecord) {
  const guidance = [
    `${EVAL_STAGE_LABELS[record.evalStage]} 기준으로 KPI별 코멘트와 종합 의견을 함께 확인하세요.`,
  ]

  const quantitativeCount = record.items.filter((item) => item.personalKpi.kpiType === 'QUANTITATIVE').length
  const qualitativeCount = record.items.length - quantitativeCount

  if (quantitativeCount > 0) {
    guidance.push(`정량 KPI ${quantitativeCount}건은 실적 수치와 달성률 근거를 먼저 검토하세요.`)
  }

  if (qualitativeCount > 0) {
    guidance.push(`정성 KPI ${qualitativeCount}건은 PDCA 점수와 실행 맥락을 함께 보세요.`)
  }

  if (record.status === 'REJECTED') {
    guidance.push('반려 사유를 확인하고, 수정된 항목이 충분히 보완되었는지 비교하세요.')
  }

  return guidance
}

function getGuideStatusFromAuditLogs(
  logs: Array<{ userId: string; action: string }>,
  userId: string
) {
  const userLogs = logs.filter((log) => log.userId === userId)

  return {
    viewed: userLogs.some((log) => log.action === 'EVALUATION_GUIDE_VIEWED' || log.action === 'EVALUATION_GUIDE_CONFIRMED'),
    confirmed: userLogs.some((log) => log.action === 'EVALUATION_GUIDE_CONFIRMED'),
  }
}

function buildEvaluationRecordEvidence(record: EvaluationRecord) {
  const kpiSummaries = record.items.map((item) => {
    const parts = [
      item.personalKpi.kpiName,
      `가중치 ${item.personalKpi.weight}%`,
      item.personalKpi.linkedOrgKpi
        ? `연결 목표 ${item.personalKpi.linkedOrgKpi.department.deptName} / ${item.personalKpi.linkedOrgKpi.kpiName}`
        : '연결 목표 없음',
    ]

    const latestMonthly = item.personalKpi.monthlyRecords[0]
    if (latestMonthly && typeof latestMonthly.achievementRate === 'number') {
      parts.push(`최근 달성률 ${latestMonthly.achievementRate}%`)
    }

    return parts.join(' / ')
  })

  const monthlySummaries = record.items
    .flatMap((item) =>
      item.personalKpi.monthlyRecords.slice(0, 1).map((monthlyRecord) =>
        [
          `${item.personalKpi.kpiName} / ${monthlyRecord.yearMonth}`,
          typeof monthlyRecord.achievementRate === 'number'
            ? `달성률 ${monthlyRecord.achievementRate}%`
            : '달성률 미집계',
          monthlyRecord.activities || monthlyRecord.obstacles || '상세 메모 없음',
        ].join(' / ')
      )
    )
    .slice(0, 6)

  const keyPoints = record.items
    .map((item) => {
      const latestMonthly = item.personalKpi.monthlyRecords[0]
      if (item.itemComment?.trim()) {
        return `${item.personalKpi.kpiName}: ${item.itemComment.trim()}`
      }

      if (latestMonthly?.activities?.trim()) {
        return `${item.personalKpi.kpiName}: ${latestMonthly.activities.trim()}`
      }

      return ''
    })
    .filter(Boolean)
    .slice(0, 6)

  return buildEvaluationAssistEvidenceView({
    kpiSummaries,
    monthlySummaries,
    noteSummaries: [],
    keyPoints,
  })
}

function buildAdminQualitySummary(records: EvaluationRecord[]) {
  const summary = {
    insufficientEvidenceWarningCount: 0,
    biasWarningCount: 0,
    coachingGapCount: 0,
  }

  for (const record of records) {
    const warnings = buildEvaluationQualityWarnings({
      comment: record.comment ?? '',
      evidence: buildEvaluationRecordEvidence(record),
      mode: 'draft',
    })

    if (warnings.some((warning) => warning.key === 'missing-evidence')) {
      summary.insufficientEvidenceWarningCount += 1
    }

    if (warnings.some((warning) => warning.key === 'bias-risk' || warning.key === 'emotional-tone')) {
      summary.biasWarningCount += 1
    }

    if (warnings.some((warning) => warning.key === 'missing-action')) {
      summary.coachingGapCount += 1
    }
  }

  return summary
}

async function loadWorkbenchSection<T>(params: {
  title: string
  fallback: T
  alert: string
  load: () => Promise<T>
}) {
  try {
    return {
      value: await params.load(),
      alert: null as string | null,
    }
  } catch (error) {
    console.error(`[evaluation-workbench] ${params.title}`, error)
    return {
      value: params.fallback,
      alert: params.alert,
    }
  }
}

async function loadEvaluations(params: {
  session: Session
  cycleId: string
}) {
  const { session, cycleId } = params
  const sessionUser = getWorkbenchSessionUser(session)

  if (!sessionUser) {
    return []
  }

  const where =
    sessionUser.role === 'ROLE_ADMIN'
      ? { evalCycleId: cycleId }
      : {
          evalCycleId: cycleId,
          OR: [{ evaluatorId: sessionUser.id }, { targetId: sessionUser.id }],
        }

  return prisma.evaluation.findMany({
    where,
    include: {
      evalCycle: true,
      evaluator: {
        select: {
          id: true,
          empName: true,
          position: true,
        },
      },
      target: {
        select: {
          id: true,
          empName: true,
          position: true,
          department: {
            select: {
              deptName: true,
            },
          },
        },
      },
      items: {
        include: {
          personalKpi: {
            include: {
              linkedOrgKpi: {
                include: {
                  department: {
                    select: {
                      deptName: true,
                    },
                  },
                },
              },
              monthlyRecords: {
                orderBy: { yearMonth: 'desc' },
                take: 3,
              },
            },
          },
        },
      },
    },
    orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
  })
}

export async function getEvaluationWorkbenchPageData(
  params: GetEvaluationWorkbenchPageDataParams
): Promise<EvaluationWorkbenchPageData> {
  try {
    const alerts: string[] = []
    const sessionUser = getWorkbenchSessionUser(params.session)

    if (!sessionUser) {
      return {
        state: 'permission-denied',
        message: '세션 정보를 확인하지 못했습니다. 다시 로그인해 주세요.',
        availableCycles: [],
      }
    }

    const employee = await prisma.employee.findUnique({
      where: { id: sessionUser.id },
      include: {
        department: {
          include: {
            organization: true,
          },
        },
      },
    })

    if (!employee) {
      return {
        state: 'permission-denied',
        message: '직원 정보를 찾을 수 없습니다.',
        availableCycles: [],
      }
    }

    const availableCycles = await prisma.evalCycle.findMany({
      where: {
        orgId: employee.department.orgId,
      },
      select: {
        id: true,
        cycleName: true,
        evalYear: true,
        status: true,
        showQuestionWeight: true,
        showScoreSummary: true,
      },
      orderBy: [{ evalYear: 'desc' }, { createdAt: 'desc' }],
    })

    const selectedCycle =
      availableCycles.find((cycle) => cycle.id === params.cycleId) ?? availableCycles[0] ?? null

    if (!selectedCycle) {
      return {
        state: 'empty',
        alerts,
        message: '진행 가능한 평가 주기가 없습니다.',
        availableCycles: [],
      }
    }

    const evaluations = await loadEvaluations({
      session: params.session,
      cycleId: selectedCycle.id,
    })

    const confirmedKpiCount = await prisma.personalKpi.count({
      where: {
        employeeId: sessionUser.id,
        evalYear: selectedCycle.evalYear,
        status: 'CONFIRMED',
      },
    })

    const selfEvaluationExists = evaluations.some(
      (item) => item.target.id === sessionUser.id && item.evalStage === 'SELF'
    )

    const selectedEvaluation =
      evaluations.find((item) => item.id === params.evaluationId) ??
      evaluations.find(
        (item) =>
          item.evaluator.id === sessionUser.id &&
          ['PENDING', 'IN_PROGRESS', 'REJECTED'].includes(item.status)
      ) ??
      evaluations[0] ??
      null

    const summaryRates = evaluations.flatMap((evaluation) =>
      evaluation.items
        .map((item) => item.personalKpi.monthlyRecords[0]?.achievementRate)
        .filter((value): value is number => typeof value === 'number')
    )

    const feedbackRoundCountResult = await loadWorkbenchSection({
      title: 'summary feedback round count',
      fallback: 0,
      alert: '다면 피드백 집계를 일부 불러오지 못해 현재 확인 가능한 수치만 표시합니다.',
      load: () =>
        prisma.multiFeedbackRound.count({
          where: { evalCycleId: selectedCycle.id },
        }),
    })

    if (feedbackRoundCountResult.alert) {
      alerts.push(feedbackRoundCountResult.alert)
    }

    const summary = {
      totalCount: evaluations.length,
      actionRequiredCount: evaluations.filter(
        (item) =>
          item.evaluator.id === sessionUser.id &&
          ['PENDING', 'IN_PROGRESS', 'REJECTED'].includes(item.status)
      ).length,
      submittedCount: evaluations.filter((item) => item.status === 'SUBMITTED').length,
      rejectedCount: evaluations.filter((item) => item.status === 'REJECTED').length,
      feedbackRoundCount: feedbackRoundCountResult.value,
      evidenceFreshnessLabel: getEvidenceFreshnessLabel(summaryRates),
    }

    let adminSummary: EvaluationWorkbenchPageData['adminSummary'] | undefined

    if (sessionUser.role === 'ROLE_ADMIN' && evaluations.length) {
      const evaluationIds = evaluations.map((evaluation) => evaluation.id)
      const [guideLogsResult, cycleAiLogsResult] = await Promise.all([
        loadWorkbenchSection({
          title: 'admin guide logs',
          fallback: [] as Array<{ entityId: string; action: string }>,
          alert: '평가 가이드 확인 현황 일부를 불러오지 못해 운영 요약이 부분적으로만 표시됩니다.',
          load: () =>
            prisma.auditLog.findMany({
              where: {
                entityType: 'Evaluation',
                entityId: { in: evaluationIds },
                action: { in: ['EVALUATION_GUIDE_VIEWED', 'EVALUATION_GUIDE_CONFIRMED'] },
              },
              select: {
                entityId: true,
                action: true,
              },
            }),
        }),
        loadWorkbenchSection({
          title: 'cycle ai logs',
          fallback: [] as Array<{ sourceId: string | null; requestStatus: string }>,
          alert: 'AI 사용 현황 일부를 불러오지 못해 운영 요약이 부분적으로만 표시됩니다.',
          load: () =>
            prisma.aiRequestLog.findMany({
              where: {
                sourceType: 'Evaluation',
                sourceId: { in: evaluationIds },
              },
              select: {
                sourceId: true,
                requestStatus: true,
              },
            }),
        }),
      ])

      if (guideLogsResult.alert) {
        alerts.push(guideLogsResult.alert)
      }

      if (cycleAiLogsResult.alert) {
        alerts.push(cycleAiLogsResult.alert)
      }

      const guideViewedIds = new Set(
        guideLogsResult.value
          .filter((log) => log.action === 'EVALUATION_GUIDE_VIEWED' || log.action === 'EVALUATION_GUIDE_CONFIRMED')
          .map((log) => log.entityId)
      )
      const guideConfirmedIds = new Set(
        guideLogsResult.value.filter((log) => log.action === 'EVALUATION_GUIDE_CONFIRMED').map((log) => log.entityId)
      )
      const aiUsedIds = new Set(
        cycleAiLogsResult.value
          .filter((log): log is { sourceId: string; requestStatus: string } => Boolean(log.sourceId))
          .filter((log) => log.requestStatus !== 'DISABLED')
          .map((log) => log.sourceId)
      )
      const qualitySummary = buildAdminQualitySummary(evaluations)

      adminSummary = {
        guideViewedCount: guideViewedIds.size,
        guideConfirmedCount: guideConfirmedIds.size,
        aiUsedCount: aiUsedIds.size,
        insufficientEvidenceWarningCount: qualitySummary.insufficientEvidenceWarningCount,
        biasWarningCount: qualitySummary.biasWarningCount,
        coachingGapCount: qualitySummary.coachingGapCount,
      }
    }

    if (!selectedEvaluation && !selfEvaluationExists && confirmedKpiCount === 0) {
      return {
        state: 'empty',
        message: '현재 작성하거나 검토할 평가가 없습니다. 먼저 KPI 확정과 평가 주기를 확인하세요.',
        availableCycles: availableCycles.map((cycle) => ({
          id: cycle.id,
          name: cycle.cycleName,
          year: cycle.evalYear,
          status: cycle.status,
        })),
        selectedCycleId: selectedCycle.id,
        summary,
        adminSummary,
        currentUser: {
          id: employee.id,
          name: employee.empName,
          role: employee.role,
          department: employee.department.deptName,
        },
        displaySettings: {
          showQuestionWeight: selectedCycle.showQuestionWeight,
          showScoreSummary: selectedCycle.showScoreSummary,
        },
        permissions: {
          canCreateSelfEvaluation:
            selectedCycle.status === 'SELF_EVAL' &&
            !selfEvaluationExists &&
            confirmedKpiCount > 0,
          canViewFeedback: true,
          canSeeAllInCycle: sessionUser.role === 'ROLE_ADMIN',
        },
        evaluations: [],
      }
    }

    const pageData: EvaluationWorkbenchPageData = {
      state: 'ready',
      alerts,
      availableCycles: availableCycles.map((cycle) => ({
        id: cycle.id,
        name: cycle.cycleName,
        year: cycle.evalYear,
        status: cycle.status,
      })),
      selectedCycleId: selectedCycle.id,
      selectedEvaluationId: selectedEvaluation?.id,
      summary,
      adminSummary,
      currentUser: {
        id: employee.id,
        name: employee.empName,
        role: employee.role,
        department: employee.department.deptName,
      },
      displaySettings: {
        showQuestionWeight: selectedCycle.showQuestionWeight,
        showScoreSummary: selectedCycle.showScoreSummary,
      },
      permissions: {
        canCreateSelfEvaluation:
          selectedCycle.status === 'SELF_EVAL' &&
          !selfEvaluationExists &&
          confirmedKpiCount > 0,
        canViewFeedback: true,
        canSeeAllInCycle: sessionUser.role === 'ROLE_ADMIN',
      },
      evaluations: evaluations.map((evaluation) => ({
        id: evaluation.id,
        cycleId: evaluation.evalCycleId,
        cycleName: evaluation.evalCycle.cycleName,
        cycleYear: evaluation.evalCycle.evalYear,
        evalStage: evaluation.evalStage,
        stageLabel: EVAL_STAGE_LABELS[evaluation.evalStage],
        status: evaluation.status,
        statusLabel: STATUS_LABELS[evaluation.status],
        targetId: evaluation.target.id,
        targetName: evaluation.target.empName,
        targetDepartment: evaluation.target.department.deptName,
        evaluatorName: evaluation.evaluator.empName,
        totalScore: evaluation.totalScore,
        updatedAt: formatDate(evaluation.updatedAt),
        submittedAt: evaluation.submittedAt ? formatDate(evaluation.submittedAt) : undefined,
        isMine: evaluation.target.id === sessionUser.id,
        isEvaluator: evaluation.evaluator.id === sessionUser.id,
        isActionRequired:
          evaluation.evaluator.id === sessionUser.id &&
          ['PENDING', 'IN_PROGRESS', 'REJECTED'].includes(evaluation.status),
      })),
    }

    if (!selectedEvaluation) {
      return pageData
    }

    const itemIds = selectedEvaluation.items.map((item) => item.personalKpiId)
    const [
      auditLogsResult,
      aiLogsResult,
      recentMonthlyRecordsResult,
      recentCheckinsResult,
      gradeOptionsResult,
      feedbackRoundsResult,
    ] = await Promise.all([
      loadWorkbenchSection({
        title: 'audit logs',
        fallback: [] as Awaited<ReturnType<typeof prisma.auditLog.findMany>>,
        alert: '평가 이력을 일부 불러오지 못했지만 현재 작업은 계속 진행할 수 있습니다.',
        load: () =>
          prisma.auditLog.findMany({
            where: {
              entityType: 'Evaluation',
              entityId: selectedEvaluation.id,
            },
            orderBy: { timestamp: 'desc' },
            take: 20,
          }),
      }),
      loadWorkbenchSection({
        title: 'ai logs',
        fallback: [] as Awaited<ReturnType<typeof prisma.aiRequestLog.findMany>>,
        alert: 'AI 요청 이력을 일부 불러오지 못했지만 워크벤치는 계속 사용할 수 있습니다.',
        load: () =>
          prisma.aiRequestLog.findMany({
            where: {
              sourceType: 'Evaluation',
              sourceId: selectedEvaluation.id,
            },
            orderBy: { createdAt: 'desc' },
            take: 20,
          }),
      }),
      loadWorkbenchSection({
        title: 'monthly evidence',
        fallback: [] as WorkbenchMonthlyEvidenceRecord[],
        alert: '월간 실적 근거를 일부 불러오지 못해 현재 확인 가능한 자료 중심으로 표시합니다.',
        load: () =>
          prisma.monthlyRecord.findMany({
            where: {
              employeeId: selectedEvaluation.target.id,
              personalKpiId: { in: itemIds },
            },
            include: {
              personalKpi: {
                select: {
                  kpiName: true,
                },
              },
            },
            orderBy: [{ yearMonth: 'desc' }, { updatedAt: 'desc' }],
            take: 12,
          }),
      }),
      loadWorkbenchSection({
        title: 'checkins',
        fallback: [] as Awaited<ReturnType<typeof prisma.checkIn.findMany>>,
        alert: '체크인 기록 일부를 불러오지 못해 현재 확인 가능한 메모만 표시합니다.',
        load: () =>
          prisma.checkIn.findMany({
            where: {
              ownerId: selectedEvaluation.target.id,
            },
            orderBy: [{ scheduledDate: 'desc' }],
            take: 6,
          }),
      }),
      loadWorkbenchSection({
        title: 'grade options',
        fallback: [] as Awaited<ReturnType<typeof prisma.gradeSetting.findMany>>,
        alert: '등급 기준을 일부 불러오지 못해 현재 저장된 등급 중심으로 표시합니다.',
        load: () =>
          prisma.gradeSetting.findMany({
            where: {
              orgId: employee.department.orgId,
              evalYear: selectedEvaluation.evalCycle.evalYear,
              isActive: true,
            },
            orderBy: { gradeOrder: 'asc' },
          }),
      }),
      loadWorkbenchSection({
        title: 'feedback rounds',
        fallback: [] as WorkbenchFeedbackRound[],
        alert: '다면 피드백 일부를 불러오지 못해 현재 연결된 근거만 표시합니다.',
        load: () =>
          prisma.multiFeedbackRound.findMany({
            where: {
              evalCycleId: selectedEvaluation.evalCycleId,
            },
            include: {
              feedbacks: {
                where: {
                  receiverId: selectedEvaluation.target.id,
                  status: 'SUBMITTED' as FeedbackStatus,
                },
                include: {
                  responses: {
                    include: {
                      question: true,
                    },
                  },
                },
              },
            },
            orderBy: { endDate: 'desc' },
          }),
      }),
    ])

    const auditLogs = auditLogsResult.value
    const aiLogs = aiLogsResult.value
    const recentMonthlyRecords = recentMonthlyRecordsResult.value
    const recentCheckins = recentCheckinsResult.value
    const gradeOptions = gradeOptionsResult.value
    const feedbackRounds = feedbackRoundsResult.value
    const guideStatus = getGuideStatusFromAuditLogs(auditLogs, sessionUser.id)

    for (const alert of [
      auditLogsResult.alert,
      aiLogsResult.alert,
      recentMonthlyRecordsResult.alert,
      recentCheckinsResult.alert,
      gradeOptionsResult.alert,
      feedbackRoundsResult.alert,
    ]) {
      if (alert) {
        alerts.push(alert)
      }
    }

    const recordMap = new Map<string, typeof recentMonthlyRecords[number]>()
    for (const record of recentMonthlyRecords) {
      if (!recordMap.has(record.personalKpiId)) {
        recordMap.set(record.personalKpiId, record)
      }
    }

    pageData.selected = {
      id: selectedEvaluation.id,
      cycle: {
        id: selectedEvaluation.evalCycle.id,
        name: selectedEvaluation.evalCycle.cycleName,
        year: selectedEvaluation.evalCycle.evalYear,
        status: selectedEvaluation.evalCycle.status,
      },
      target: {
        id: selectedEvaluation.target.id,
        name: selectedEvaluation.target.empName,
        department: selectedEvaluation.target.department.deptName,
        position: POSITION_LABELS[selectedEvaluation.target.position] ?? selectedEvaluation.target.position,
      },
      evaluator: {
        id: selectedEvaluation.evaluator.id,
        name: selectedEvaluation.evaluator.empName,
        position:
          POSITION_LABELS[selectedEvaluation.evaluator.position] ??
          selectedEvaluation.evaluator.position,
      },
      evalStage: selectedEvaluation.evalStage,
      stageLabel: EVAL_STAGE_LABELS[selectedEvaluation.evalStage],
      status: selectedEvaluation.status,
      statusLabel: STATUS_LABELS[selectedEvaluation.status],
      totalScore: selectedEvaluation.totalScore,
      comment: selectedEvaluation.comment,
      gradeId: selectedEvaluation.gradeId,
      submittedAt: selectedEvaluation.submittedAt ? formatDate(selectedEvaluation.submittedAt) : undefined,
      updatedAt: formatDate(selectedEvaluation.updatedAt),
      reviewGuidance: buildReviewGuidance(selectedEvaluation),
      guideStatus,
      permissions: {
        canEdit:
          selectedEvaluation.evaluator.id === sessionUser.id || sessionUser.role === 'ROLE_ADMIN',
        canSubmit:
          (selectedEvaluation.evaluator.id === sessionUser.id || sessionUser.role === 'ROLE_ADMIN') &&
          !['SUBMITTED', 'CONFIRMED'].includes(selectedEvaluation.status),
        canReject:
          (selectedEvaluation.evaluator.id === sessionUser.id || sessionUser.role === 'ROLE_ADMIN') &&
          !['CONFIRMED'].includes(selectedEvaluation.status),
        readOnly:
          !(
            selectedEvaluation.evaluator.id === sessionUser.id || sessionUser.role === 'ROLE_ADMIN'
          ) || ['SUBMITTED', 'CONFIRMED'].includes(selectedEvaluation.status),
      },
      gradeOptions: gradeOptions.map((grade) => ({
        id: grade.id,
        gradeName: grade.gradeName,
        scoreRange: `${grade.minScore} - ${grade.maxScore}`,
      })),
      items: selectedEvaluation.items.map((item) => {
        const latestRecord = recordMap.get(item.personalKpiId)
        return {
          personalKpiId: item.personalKpiId,
          title: item.personalKpi.kpiName,
          type: item.personalKpi.kpiType,
          weight: item.personalKpi.weight,
          linkedOrgKpiTitle: item.personalKpi.linkedOrgKpi?.kpiName ?? null,
          targetValue: item.personalKpi.targetValue,
          unit: item.personalKpi.unit,
          definition: item.personalKpi.definition,
          recentAchievementRate: latestRecord?.achievementRate ?? null,
          latestMonthlyComment: latestRecord?.activities ?? latestRecord?.obstacles ?? null,
          quantScore: item.quantScore,
          planScore: item.planScore,
          doScore: item.doScore,
          checkScore: item.checkScore,
          actScore: item.actScore,
          weightedScore: item.weightedScore,
          itemComment: item.itemComment,
        }
      }),
      evidence: {
        monthlyRecords: recentMonthlyRecords.map((record) => ({
          yearMonth: record.yearMonth,
          title: record.personalKpi.kpiName,
          achievementRate: record.achievementRate,
          activities: record.activities,
          obstacles: record.obstacles,
        })),
        checkins: recentCheckins.map((checkin) => ({
          id: checkin.id,
          scheduledDate: formatDate(checkin.scheduledDate),
          status: checkin.status,
          summary: checkin.keyTakeaways ?? checkin.managerNotes ?? checkin.ownerNotes ?? '체크인 메모가 아직 없습니다.',
          actionItems: Array.isArray(checkin.actionItems)
            ? checkin.actionItems
                .map((item) =>
                  typeof item === 'object' && item !== null && 'action' in item
                    ? String(item.action)
                    : ''
                )
                .filter(Boolean)
            : [],
        })),
        orgKpis: selectedEvaluation.items
          .filter((item) => item.personalKpi.linkedOrgKpi)
          .map((item) => ({
            id: item.personalKpi.linkedOrgKpi!.id,
            title: item.personalKpi.linkedOrgKpi!.kpiName,
            department: item.personalKpi.linkedOrgKpi!.department.deptName,
          })),
        feedbackRounds: feedbackRounds.map((round) => {
          const ratingValues = round.feedbacks.flatMap((feedback) =>
            feedback.responses
              .filter(
                (response) =>
                  response.question.questionType === ('RATING_SCALE' as QuestionType) &&
                  typeof response.ratingValue === 'number'
              )
              .map((response) => response.ratingValue as number)
          )

          const averageRating = ratingValues.length
            ? Math.round((ratingValues.reduce((sum, value) => sum + value, 0) / ratingValues.length) * 10) /
              10
            : undefined

          return {
            id: round.id,
            roundName: round.roundName,
            roundType: round.roundType,
            submittedCount: round.feedbacks.length,
            averageRating,
            summary:
              round.feedbacks.length >= round.minRaters
                ? `응답 ${round.feedbacks.length}건이 수집되어 결과를 참고할 수 있습니다.`
                : `최소 ${round.minRaters}건 기준에 아직 도달하지 않았습니다.`,
          }
        }),
        highlights: [
          recentMonthlyRecords[0]
            ? `${recentMonthlyRecords[0].personalKpi.kpiName}의 최신 달성률은 ${
                recentMonthlyRecords[0].achievementRate ?? 0
              }%입니다.`
            : '최근 월간 실적 데이터가 많지 않아 정성 근거를 우선 확인해야 합니다.',
          recentCheckins[0]
            ? `최근 체크인 메모: ${
                recentCheckins[0].keyTakeaways ??
                recentCheckins[0].managerNotes ??
                recentCheckins[0].ownerNotes ??
                '핵심 요약 없음'
              }`
            : '최근 체크인 기록이 없어 면담 맥락을 별도로 확인해야 합니다.',
          feedbackRounds[0]
            ? `${feedbackRounds[0].roundName} 라운드 응답 ${feedbackRounds[0].feedbacks.length}건이 연결되어 있습니다.`
            : '연결된 다면 피드백 라운드가 없습니다.',
        ],
      },
      aiLogs: aiLogs.map((log) => ({
        id: log.id,
        createdAt: formatDate(log.createdAt),
        requestType: log.requestType,
        requestStatus: log.requestStatus,
        approvalStatus: log.approvalStatus,
      })),
      auditLogs: auditLogs.map((log) => ({
        id: log.id,
        timestamp: formatDate(log.timestamp),
        actor: log.userId,
        action: log.action,
        detail:
          typeof log.newValue === 'object' && log.newValue && 'totalScore' in log.newValue
            ? `총점 ${String((log.newValue as Record<string, unknown>).totalScore ?? '-')}`
            : '상태 또는 코멘트가 갱신되었습니다.',
      })),
    }

    return pageData
  } catch (error) {
    console.error(error)
    return {
      state: 'error',
      message: '평가 워크벤치 데이터를 불러오지 못했습니다.',
      availableCycles: [],
    }
  }
}
