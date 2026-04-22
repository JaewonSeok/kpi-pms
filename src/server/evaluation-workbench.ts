import type {
  AIRequestStatus,
  CycleStatus,
  EvalStage,
  EvalStatus,
  FeedbackRoundType,
  FeedbackStatus,
  KpiStatus,
  Prisma,
  QuestionType,
  SystemRole,
} from '@prisma/client'
import type { Session } from 'next-auth'
import { buildEvaluationAssistEvidenceView } from '@/lib/evaluation-ai-assist'
import {
  normalizeEvaluationPerformanceBriefingSnapshot,
  type EvaluationPerformanceBriefingSnapshot,
} from '@/lib/evaluation-performance-briefing'
import { buildEvaluationQualityWarnings } from '@/lib/evaluation-writing-guide'
import { prisma } from '@/lib/prisma'
import { getEvaluationStageChain } from '@/server/evaluation-performance-assignments'
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
    strengthComment?: string | null
    improvementComment?: string | null
    nextStepGuidance?: string | null
    gradeId?: string | null
    submittedAt?: string
    updatedAt: string
    previousStageEvaluation?: {
      id: string
      stageLabel: string
      evaluatorName: string
      totalScore?: number | null
      comment?: string | null
      strengthComment?: string | null
      improvementComment?: string | null
      nextStepGuidance?: string | null
      submittedAt?: string
      updatedAt: string
    } | null
    priorStageEvaluations: Array<{
      id: string
      stage: EvalStage
      stageLabel: string
      evaluatorName: string
      evaluatorPosition: string
      totalScore?: number | null
      comment?: string | null
      strengthComment?: string | null
      improvementComment?: string | null
      nextStepGuidance?: string | null
      submittedAt?: string
      updatedAt: string
    }>
    stageChain: Array<{
      stage: EvalStage
      stageLabel: string
      stageRoleLabel: string
      evaluatorName: string
      evaluatorPosition: string
      evaluatorDepartment: string
      reviewOrder: number
      evaluationId?: string | null
      status?: EvalStatus | null
      statusLabel: string
      submittedAt?: string
      updatedAt?: string
      isCurrent: boolean
    }>
    reviewGuidance: string[]
    guideStatus: {
      viewed: boolean
      confirmed: boolean
    }
    permissions: {
      canEdit: boolean
      canSubmit: boolean
      canFinalize: boolean
      canReject: boolean
      submitDisabledReason?: string | null
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
      goalContext: {
        periodLabel: string
        collaborators: string[]
        achievementSummary?: string | null
        links: Array<{
          id: string
          label: string
          href: string
          uploadedBy?: string
          comment?: string
        }>
        progressRate?: number | null
        progressLabel: string
        approvalStatusKey: 'DRAFT' | 'CONFIRMED' | 'ARCHIVED' | 'UNKNOWN'
        approvalStatusLabel: string
        weightLabel: string
        linkedGoalLabel?: string | null
      }
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
    briefing?: {
      canView: boolean
      latestSnapshot?: EvaluationPerformanceBriefingSnapshot | null
    }
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
  efforts: string | null
  attachments: Prisma.JsonValue | null
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

type WorkbenchGoalContextLink = {
  id: string
  label: string
  href: string
  uploadedBy?: string
  comment?: string
}

type WorkbenchGoalContextStatus = 'DRAFT' | 'CONFIRMED' | 'ARCHIVED' | 'UNKNOWN'

type WorkbenchKpiDiscussion = {
  kpiId: string
  progress?: string
  concern?: string
  support?: string
}

type WorkbenchCheckinGoalContext = {
  scheduledDate: Date
  progress?: string
  concern?: string
  support?: string
  collaborators: string[]
}

function asWorkbenchRecord(value: unknown) {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function parseGoalContextLinksV2(
  value: Prisma.JsonValue | null | undefined
): WorkbenchGoalContextLink[] {
  if (!Array.isArray(value)) return []

  return value.flatMap<WorkbenchGoalContextLink>((item, index) => {
    const record = asWorkbenchRecord(item)
    if (!record) return []

    const href =
      typeof record.dataUrl === 'string'
        ? record.dataUrl.trim()
        : typeof record.href === 'string'
          ? record.href.trim()
          : typeof record.url === 'string'
            ? record.url.trim()
            : ''

    if (!href) {
      return []
    }

    const uploadedBy =
      typeof record.uploadedBy === 'string' && record.uploadedBy.trim()
        ? record.uploadedBy.trim()
        : undefined
    const comment =
      typeof record.comment === 'string' && record.comment.trim()
        ? record.comment.trim()
        : undefined

    return [
      {
        id: typeof record.id === 'string' ? record.id : `goal-link-${index}`,
        label:
          typeof record.name === 'string' && record.name.trim()
            ? record.name.trim()
            : `관련 링크 ${index + 1}`,
        href,
        ...(uploadedBy ? { uploadedBy } : {}),
        ...(comment ? { comment } : {}),
      },
    ]
  })
}

function parseGoalContextActionAssignees(value: Prisma.JsonValue | null | undefined) {
  if (!Array.isArray(value)) return []

  const assignees: string[] = []

  for (const item of value) {
    const record = asWorkbenchRecord(item)
    if (!record) continue

    const assignee = typeof record.assignee === 'string' ? record.assignee.trim() : ''
    if (!assignee) continue
    assignees.push(assignee)
  }

  return assignees
}

function parseGoalContextKpiDiscussions(value: Prisma.JsonValue | null | undefined): WorkbenchKpiDiscussion[] {
  if (!Array.isArray(value)) return []

  const discussions: WorkbenchKpiDiscussion[] = []

  for (const item of value) {
    const record = asWorkbenchRecord(item)
    if (!record) continue

    const kpiId = typeof record.kpiId === 'string' ? record.kpiId : ''
    if (!kpiId) continue

    discussions.push({
      kpiId,
      progress: typeof record.progress === 'string' ? record.progress.trim() || undefined : undefined,
      concern: typeof record.concern === 'string' ? record.concern.trim() || undefined : undefined,
      support: typeof record.support === 'string' ? record.support.trim() || undefined : undefined,
    })
  }

  return discussions
}

function formatGoalContextMonthLabel(yearMonth: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(yearMonth)
  if (!match) {
    return yearMonth
  }

  return `${match[1]}.${match[2]}`
}

function buildGoalContextPeriodLabel(params: {
  cycleYear: number
  records: WorkbenchMonthlyEvidenceRecord[]
  checkins: WorkbenchCheckinGoalContext[]
}) {
  const { cycleYear, records, checkins } = params

  if (records.length) {
    const ordered = [...records]
      .map((record) => record.yearMonth)
      .sort((left, right) => left.localeCompare(right))
    const first = formatGoalContextMonthLabel(ordered[0]!)
    const last = formatGoalContextMonthLabel(ordered[ordered.length - 1]!)
    return first === last ? `${first} 기준` : `${first} ~ ${last}`
  }

  if (checkins.length) {
    const ordered = [...checkins].sort(
      (left, right) => left.scheduledDate.getTime() - right.scheduledDate.getTime()
    )
    const first = formatDate(ordered[0]!.scheduledDate)
    const last = formatDate(ordered[ordered.length - 1]!.scheduledDate)
    return first === last ? `${first} 체크인 기준` : `${first} ~ ${last}`
  }

  return `${cycleYear}년 평가 주기`
}

function getGoalContextStatus(status: KpiStatus | null | undefined): {
  approvalStatusKey: WorkbenchGoalContextStatus
  approvalStatusLabel: string
} {
  if (status === 'CONFIRMED') {
    return {
      approvalStatusKey: 'CONFIRMED',
      approvalStatusLabel: '승인 상태: 확정',
    }
  }

  if (status === 'ARCHIVED') {
    return {
      approvalStatusKey: 'ARCHIVED',
      approvalStatusLabel: '승인 상태: 보관',
    }
  }

  if (status === 'DRAFT') {
    return {
      approvalStatusKey: 'DRAFT',
      approvalStatusLabel: '승인 상태: 초안',
    }
  }

  return {
    approvalStatusKey: 'UNKNOWN',
    approvalStatusLabel: '승인 상태: 미확인',
  }
}

function buildGoalAchievementSummary(params: {
  latestRecord?: WorkbenchMonthlyEvidenceRecord
  latestCheckin?: WorkbenchCheckinGoalContext
}) {
  const parts = [
    params.latestRecord?.activities?.trim(),
    params.latestRecord?.efforts?.trim() ? `주요 기여: ${params.latestRecord.efforts.trim()}` : '',
    params.latestCheckin?.progress?.trim(),
    params.latestCheckin?.support?.trim()
      ? `지원 필요: ${params.latestCheckin.support.trim()}`
      : '',
    params.latestCheckin?.concern?.trim()
      ? `주의 포인트: ${params.latestCheckin.concern.trim()}`
      : params.latestRecord?.obstacles?.trim()
        ? `주의 포인트: ${params.latestRecord.obstacles.trim()}`
        : '',
  ].filter(Boolean)

  return parts.length ? parts.join(' · ') : null
}

function buildGoalProgressLabel(params: {
  latestRecord?: WorkbenchMonthlyEvidenceRecord
  latestCheckin?: WorkbenchCheckinGoalContext
}) {
  if (typeof params.latestRecord?.achievementRate === 'number') {
    return `진행률 ${params.latestRecord.achievementRate}%`
  }

  if (params.latestCheckin?.progress) {
    return '진행 메모 참고'
  }

  return '진행률 미집계'
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
          OR: [
            { evaluatorId: sessionUser.id },
            { targetId: sessionUser.id, evalStage: 'SELF' as EvalStage },
          ],
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
      latestBriefingResult,
      stageChainResult,
      stageEvaluationsResult,
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
        title: 'performance briefing',
        fallback: null as Awaited<ReturnType<typeof prisma.aiRequestLog.findFirst>> | null,
        alert: 'AI 성과 브리핑 이력을 불러오지 못했지만 워크벤치는 계속 사용할 수 있습니다.',
        load: () =>
          prisma.aiRequestLog.findFirst({
            where: {
              sourceType: 'EvaluationPerformanceBriefing',
              sourceId: selectedEvaluation.id,
              requestStatus: {
                in: ['SUCCESS', 'FALLBACK', 'DISABLED'] as AIRequestStatus[],
              },
            },
            orderBy: { createdAt: 'desc' },
          }),
      }),
      loadWorkbenchSection({
        title: 'evaluation stage chain',
        fallback: [] as Awaited<ReturnType<typeof getEvaluationStageChain>>,
        alert: '?? ?? ??? ???? ???? ?? ?? ??? ?? ??? ? ????.',
        load: () =>
          getEvaluationStageChain({
            db: prisma,
            evalCycleId: selectedEvaluation.evalCycleId,
            targetId: selectedEvaluation.target.id,
          }),
      }),
      loadWorkbenchSection({
        title: 'prior stage evaluations',
        fallback: [] as Array<{
          id: string
          evalStage: EvalStage
          totalScore: number | null
          comment: string | null
          strengthComment: string | null
          improvementComment: string | null
          nextStepGuidance: string | null
          status: EvalStatus
          submittedAt: Date | null
          updatedAt: Date
          evaluator: {
            empName: string
            position: string
          }
        }>,
        alert: '?? ?? ?? ??? ???? ???? ?? ?? ??? ?? ??? ? ????.',
        load: () =>
          prisma.evaluation.findMany({
            where: {
              evalCycleId: selectedEvaluation.evalCycleId,
              targetId: selectedEvaluation.target.id,
            },
            select: {
              id: true,
              evalStage: true,
              totalScore: true,
              comment: true,
              strengthComment: true,
              improvementComment: true,
              nextStepGuidance: true,
              status: true,
              submittedAt: true,
              updatedAt: true,
              evaluator: {
                select: {
                  empName: true,
                  position: true,
                },
              },
            },
            orderBy: {
              createdAt: 'asc',
            },
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
    const latestBriefingLog = latestBriefingResult.value
    const stageChain = stageChainResult.value
    const stageEvaluations = stageEvaluationsResult.value
    const recentMonthlyRecords = recentMonthlyRecordsResult.value
    const recentCheckins = recentCheckinsResult.value
    const gradeOptions = gradeOptionsResult.value
    const feedbackRounds = feedbackRoundsResult.value
    const guideStatus = getGuideStatusFromAuditLogs(auditLogs, sessionUser.id)

    for (const alert of [
      auditLogsResult.alert,
      aiLogsResult.alert,
      latestBriefingResult.alert,
      stageChainResult.alert,
      stageEvaluationsResult.alert,
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
    const recordsByKpiId = new Map<string, WorkbenchMonthlyEvidenceRecord[]>()
    for (const record of recentMonthlyRecords) {
      if (!recordMap.has(record.personalKpiId)) {
        recordMap.set(record.personalKpiId, record)
      }

      const current = recordsByKpiId.get(record.personalKpiId) ?? []
      current.push(record)
      recordsByKpiId.set(record.personalKpiId, current)
    }

    const checkinGoalContextByKpiId = new Map<string, WorkbenchCheckinGoalContext[]>()
    for (const checkin of recentCheckins) {
      const collaborators = parseGoalContextActionAssignees(checkin.actionItems)
      const discussions = parseGoalContextKpiDiscussions(checkin.kpiDiscussed)

      for (const discussion of discussions) {
        const current = checkinGoalContextByKpiId.get(discussion.kpiId) ?? []
        current.push({
          scheduledDate: checkin.scheduledDate,
          progress: discussion.progress,
          concern: discussion.concern,
          support: discussion.support,
          collaborators,
        })
        checkinGoalContextByKpiId.set(discussion.kpiId, current)
      }
    }

    const latestBriefingSnapshot = latestBriefingLog
      ? normalizeEvaluationPerformanceBriefingSnapshot(latestBriefingLog.responsePayload, {
          requestLogId: latestBriefingLog.id,
          stale: latestBriefingLog.createdAt < selectedEvaluation.updatedAt,
        })
      : null
    const stageEvaluationMap = new Map(
      stageEvaluations.map((evaluation) => [evaluation.evalStage, evaluation] as const)
    )
    const currentStageIndex = stageChain.findIndex((entry) => entry.stage === selectedEvaluation.evalStage)
    const previousStage =
      currentStageIndex > 0 ? stageChain[currentStageIndex - 1]?.stage ?? null : null
    const previousStageEvaluation = previousStage
      ? stageEvaluationMap.get(previousStage) ?? null
      : null
    const priorStageEvaluations = stageChain
      .slice(0, currentStageIndex > 0 ? currentStageIndex : 0)
      .map((entry) => {
        const history = stageEvaluationMap.get(entry.stage)
        if (!history) {
          return null
        }

        return {
          id: history.id,
          stage: entry.stage,
          stageLabel: entry.stageLabel,
          evaluatorName: history.evaluator.empName,
          evaluatorPosition:
            POSITION_LABELS[history.evaluator.position] ?? history.evaluator.position,
          totalScore: history.totalScore,
          comment: history.comment,
          strengthComment: history.strengthComment,
          improvementComment: history.improvementComment,
          nextStepGuidance: history.nextStepGuidance,
          submittedAt: history.submittedAt ? formatDate(history.submittedAt) : undefined,
          updatedAt: formatDate(history.updatedAt),
        }
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
    const stageChainView = stageChain.map((entry) => {
      const stageEvaluation = stageEvaluationMap.get(entry.stage)
      return {
        stage: entry.stage,
        stageLabel: entry.stageLabel,
        stageRoleLabel: entry.stageRoleLabel,
        evaluatorName: entry.evaluatorName,
        evaluatorPosition: entry.evaluatorPosition,
        evaluatorDepartment: entry.evaluatorDepartment,
        reviewOrder: entry.reviewOrder,
        evaluationId: stageEvaluation?.id ?? null,
        status: stageEvaluation?.status ?? null,
        statusLabel: stageEvaluation ? STATUS_LABELS[stageEvaluation.status] : '대기',
        submittedAt: stageEvaluation?.submittedAt ? formatDate(stageEvaluation.submittedAt) : undefined,
        updatedAt: stageEvaluation ? formatDate(stageEvaluation.updatedAt) : undefined,
        isCurrent: entry.stage === selectedEvaluation.evalStage,
      }
    })
    const nextStageEntry =
      currentStageIndex >= 0 && currentStageIndex < stageChain.length - 1
        ? stageChain[currentStageIndex + 1] ?? null
        : null
    const canFinalize = selectedEvaluation.evalStage === 'CEO_ADJUST' && !nextStageEntry
    const submitDisabledReason =
      !canFinalize && !nextStageEntry
        ? '다음 승인 단계 배정이 완료되지 않아 제출할 수 없습니다. 배정 관리에서 다음 승인자를 확인해 주세요.'
        : null
    const canViewBriefing =
      (sessionUser.role === 'ROLE_ADMIN' || selectedEvaluation.evaluator.id === sessionUser.id) &&
      ['SECOND', 'FINAL', 'CEO_ADJUST'].includes(selectedEvaluation.evalStage)
    const canManageSelected =
      selectedEvaluation.evaluator.id === sessionUser.id || sessionUser.role === 'ROLE_ADMIN'
    const canEditSelected =
      canManageSelected && !['SUBMITTED', 'CONFIRMED'].includes(selectedEvaluation.status)
    const canReturnToPreviousStage =
      canManageSelected &&
      Boolean(previousStageEvaluation) &&
      !['SUBMITTED', 'CONFIRMED'].includes(selectedEvaluation.status)

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
      stageLabel:
        stageChain.find((entry) => entry.stage === selectedEvaluation.evalStage)?.stageLabel ??
        EVAL_STAGE_LABELS[selectedEvaluation.evalStage],
      status: selectedEvaluation.status,
      statusLabel: STATUS_LABELS[selectedEvaluation.status],
      totalScore: selectedEvaluation.totalScore,
      comment: selectedEvaluation.comment,
      strengthComment: selectedEvaluation.strengthComment,
      improvementComment: selectedEvaluation.improvementComment,
      nextStepGuidance: selectedEvaluation.nextStepGuidance,
      gradeId: selectedEvaluation.gradeId,
      submittedAt: selectedEvaluation.submittedAt ? formatDate(selectedEvaluation.submittedAt) : undefined,
      updatedAt: formatDate(selectedEvaluation.updatedAt),
      previousStageEvaluation: previousStageEvaluation
        ? {
            id: previousStageEvaluation.id,
            stageLabel:
              stageChain.find((entry) => entry.stage === previousStageEvaluation.evalStage)
                ?.stageLabel ?? EVAL_STAGE_LABELS[previousStageEvaluation.evalStage],
            evaluatorName: previousStageEvaluation.evaluator.empName,
            totalScore: previousStageEvaluation.totalScore,
            comment: previousStageEvaluation.comment,
            strengthComment: previousStageEvaluation.strengthComment,
            improvementComment: previousStageEvaluation.improvementComment,
            nextStepGuidance: previousStageEvaluation.nextStepGuidance,
            submittedAt: previousStageEvaluation.submittedAt
              ? formatDate(previousStageEvaluation.submittedAt)
              : undefined,
            updatedAt: formatDate(previousStageEvaluation.updatedAt),
          }
        : null,
      priorStageEvaluations,
      stageChain: stageChainView,
      reviewGuidance: buildReviewGuidance(selectedEvaluation),
      guideStatus,
      permissions: {
        canEdit: canEditSelected,
        canSubmit: canEditSelected && !submitDisabledReason,
        canFinalize: canEditSelected && canFinalize,
        canReject: canReturnToPreviousStage,
        submitDisabledReason,
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
        const relatedRecords = recordsByKpiId.get(item.personalKpiId) ?? []
        const relatedCheckins = checkinGoalContextByKpiId.get(item.personalKpiId) ?? []
        const latestCheckin = relatedCheckins[0]
        const links = relatedRecords.flatMap((record) => parseGoalContextLinksV2(record.attachments))
        const collaborators = Array.from(
          new Set(
            [
              ...relatedCheckins.flatMap((checkin) => checkin.collaborators),
              ...links
                .map((link) => link.uploadedBy?.trim())
                .filter((name): name is string => Boolean(name)),
            ].filter((name) => name !== selectedEvaluation.target.empName)
          )
        )
        const { approvalStatusKey, approvalStatusLabel } = getGoalContextStatus(
          item.personalKpi.status
        )

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
          goalContext: {
            periodLabel: buildGoalContextPeriodLabel({
              cycleYear: selectedEvaluation.evalCycle.evalYear,
              records: relatedRecords,
              checkins: relatedCheckins,
            }),
            collaborators,
            achievementSummary: buildGoalAchievementSummary({
              latestRecord,
              latestCheckin,
            }),
            links,
            progressRate: latestRecord?.achievementRate ?? null,
            progressLabel: buildGoalProgressLabel({
              latestRecord,
              latestCheckin,
            }),
            approvalStatusKey,
            approvalStatusLabel,
            weightLabel: `성과 가중치 ${item.personalKpi.weight}%`,
            linkedGoalLabel: item.personalKpi.linkedOrgKpi
              ? `${item.personalKpi.linkedOrgKpi.department.deptName} / ${item.personalKpi.linkedOrgKpi.kpiName}`
              : null,
          },
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
      briefing: {
        canView: canViewBriefing,
        latestSnapshot: latestBriefingSnapshot,
      },
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
