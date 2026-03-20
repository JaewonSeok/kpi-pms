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
import { prisma } from '@/lib/prisma'
import { EVAL_STAGE_LABELS, POSITION_LABELS, formatDate } from '@/lib/utils'

export type EvaluationWorkbenchState = 'ready' | 'empty' | 'permission-denied' | 'error'

export type EvaluationWorkbenchPageData = {
  state: EvaluationWorkbenchState
  message?: string
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
  currentUser?: {
    id: string
    name: string
    role: SystemRole
    department: string
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

async function loadEvaluations(params: {
  session: Session
  cycleId: string
}) {
  const { session, cycleId } = params

  const where =
    session.user.role === 'ROLE_ADMIN'
      ? { evalCycleId: cycleId }
      : {
          evalCycleId: cycleId,
          OR: [{ evaluatorId: session.user.id }, { targetId: session.user.id }],
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
    const employee = await prisma.employee.findUnique({
      where: { id: params.session.user.id },
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
      },
      orderBy: [{ evalYear: 'desc' }, { createdAt: 'desc' }],
    })

    const selectedCycle =
      availableCycles.find((cycle) => cycle.id === params.cycleId) ?? availableCycles[0] ?? null

    if (!selectedCycle) {
      return {
        state: 'empty',
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
        employeeId: params.session.user.id,
        evalYear: selectedCycle.evalYear,
        status: 'CONFIRMED',
      },
    })

    const selfEvaluationExists = evaluations.some(
      (item) => item.target.id === params.session.user.id && item.evalStage === 'SELF'
    )

    const selectedEvaluation =
      evaluations.find((item) => item.id === params.evaluationId) ??
      evaluations.find(
        (item) =>
          item.evaluator.id === params.session.user.id &&
          ['PENDING', 'IN_PROGRESS', 'REJECTED'].includes(item.status)
      ) ??
      evaluations[0] ??
      null

    const summaryRates = evaluations.flatMap((evaluation) =>
      evaluation.items
        .map((item) => item.personalKpi.monthlyRecords[0]?.achievementRate)
        .filter((value): value is number => typeof value === 'number')
    )

    const summary = {
      totalCount: evaluations.length,
      actionRequiredCount: evaluations.filter(
        (item) =>
          item.evaluator.id === params.session.user.id &&
          ['PENDING', 'IN_PROGRESS', 'REJECTED'].includes(item.status)
      ).length,
      submittedCount: evaluations.filter((item) => item.status === 'SUBMITTED').length,
      rejectedCount: evaluations.filter((item) => item.status === 'REJECTED').length,
      feedbackRoundCount: await prisma.multiFeedbackRound.count({
        where: { evalCycleId: selectedCycle.id },
      }),
      evidenceFreshnessLabel: getEvidenceFreshnessLabel(summaryRates),
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
        currentUser: {
          id: employee.id,
          name: employee.empName,
          role: employee.role,
          department: employee.department.deptName,
        },
        permissions: {
          canCreateSelfEvaluation:
            selectedCycle.status === 'SELF_EVAL' &&
            !selfEvaluationExists &&
            confirmedKpiCount > 0,
          canViewFeedback: true,
          canSeeAllInCycle: params.session.user.role === 'ROLE_ADMIN',
        },
        evaluations: [],
      }
    }

    const pageData: EvaluationWorkbenchPageData = {
      state: 'ready',
      availableCycles: availableCycles.map((cycle) => ({
        id: cycle.id,
        name: cycle.cycleName,
        year: cycle.evalYear,
        status: cycle.status,
      })),
      selectedCycleId: selectedCycle.id,
      selectedEvaluationId: selectedEvaluation?.id,
      summary,
      currentUser: {
        id: employee.id,
        name: employee.empName,
        role: employee.role,
        department: employee.department.deptName,
      },
      permissions: {
        canCreateSelfEvaluation:
          selectedCycle.status === 'SELF_EVAL' &&
          !selfEvaluationExists &&
          confirmedKpiCount > 0,
        canViewFeedback: true,
        canSeeAllInCycle: params.session.user.role === 'ROLE_ADMIN',
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
        isMine: evaluation.target.id === params.session.user.id,
        isEvaluator: evaluation.evaluator.id === params.session.user.id,
        isActionRequired:
          evaluation.evaluator.id === params.session.user.id &&
          ['PENDING', 'IN_PROGRESS', 'REJECTED'].includes(evaluation.status),
      })),
    }

    if (!selectedEvaluation) {
      return pageData
    }

    const itemIds = selectedEvaluation.items.map((item) => item.personalKpiId)
    const [auditLogs, aiLogs, recentMonthlyRecords, recentCheckins, gradeOptions, feedbackRounds] =
      await Promise.all([
        prisma.auditLog.findMany({
          where: {
            entityType: 'Evaluation',
            entityId: selectedEvaluation.id,
          },
          orderBy: { timestamp: 'desc' },
          take: 20,
        }),
        prisma.aiRequestLog.findMany({
          where: {
            sourceType: 'Evaluation',
            sourceId: selectedEvaluation.id,
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        }),
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
        prisma.checkIn.findMany({
          where: {
            ownerId: selectedEvaluation.target.id,
          },
          orderBy: [{ scheduledDate: 'desc' }],
          take: 6,
        }),
        prisma.gradeSetting.findMany({
          where: {
            orgId: employee.department.orgId,
            evalYear: selectedEvaluation.evalCycle.evalYear,
            isActive: true,
          },
          orderBy: { gradeOrder: 'asc' },
        }),
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
      ])

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
      permissions: {
        canEdit:
          selectedEvaluation.evaluator.id === params.session.user.id ||
          params.session.user.role === 'ROLE_ADMIN',
        canSubmit:
          (selectedEvaluation.evaluator.id === params.session.user.id ||
            params.session.user.role === 'ROLE_ADMIN') &&
          !['SUBMITTED', 'CONFIRMED'].includes(selectedEvaluation.status),
        canReject:
          (selectedEvaluation.evaluator.id === params.session.user.id ||
            params.session.user.role === 'ROLE_ADMIN') &&
          !['CONFIRMED'].includes(selectedEvaluation.status),
        readOnly:
          !(
            selectedEvaluation.evaluator.id === params.session.user.id ||
            params.session.user.role === 'ROLE_ADMIN'
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
