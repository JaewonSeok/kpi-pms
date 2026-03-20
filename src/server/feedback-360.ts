import type {
  DevelopmentPlanStatus,
  FeedbackRoundStatus,
  FeedbackRoundType,
  FeedbackStatus,
  QuestionType,
  RaterRelationship,
  SystemRole,
} from '@prisma/client'
import type { Session } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { formatDate } from '@/lib/utils'
import { canApproveFeedbackTarget, getNominationAggregateStatus, parsePersistedReportPayload } from './feedback-360-workflow'

export type Feedback360RouteMode = 'overview' | 'nomination' | 'results' | 'admin' | 'respond'

export type Feedback360PageState = 'ready' | 'empty' | 'permission-denied' | 'error'

export type Feedback360PageData = {
  mode: Feedback360RouteMode
  state: Feedback360PageState
  message?: string
  currentUser?: {
    id: string
    name: string
    role: SystemRole
    department: string
  }
  permissions?: {
    canManageRounds: boolean
    canSubmitNomination: boolean
    canViewAdmin: boolean
    canViewResults: boolean
    canRespond: boolean
  }
  availableCycles: Array<{
    id: string
    name: string
    year: number
    status: string
  }>
  selectedCycleId?: string
  availableRounds: Array<{
    id: string
    roundName: string
    roundType: FeedbackRoundType
    status: FeedbackRoundStatus
    isAnonymous: boolean
    minRaters: number
    startDate: string
    endDate: string
    targetCount: number
    submittedCount: number
    responseRate: number
  }>
  selectedRoundId?: string
  summary: {
    activeRounds: number
    pendingResponses: number
    submittedResponses: number
    averageResponseRate: number
    anonymityReadyCount: number
  }
  pendingRequests?: Array<{
    feedbackId: string
    roundId: string
    roundName: string
    receiverId: string
    receiverName: string
    relationship: string
    dueDate: string
    href: string
  }>
  nomination?: {
    targetEmployee: {
      id: string
      name: string
      department: string
      position: string
    }
    savedDraftCount: number
    reviewerGroups: Array<{
      key: 'self' | 'supervisor' | 'peer' | 'subordinate'
      label: string
      description: string
      reviewers: Array<{
        employeeId: string
        name: string
        department: string
        relationship: RaterRelationship | 'SELF'
      }>
    }>
    guidance: string[]
    workflowStatus?: string
    counts?: {
      total: number
      approved: number
      published: number
    }
    canApprove?: boolean
    canPublish?: boolean
    savedDraft?: {
      updatedAt: string
      reviewers: Array<{
        employeeId: string
        name: string
        relationship: string
      }>
    }
  }
  results?: {
    targetEmployee: {
      id: string
      name: string
      department: string
      position: string
    }
    anonymityThreshold: number
    feedbackCount: number
    thresholdMet: boolean
    categoryScores: Array<{
      category: string
      average: number
      count: number
    }>
    strengths: string[]
    improvements: string[]
    anonymousSummary: string
    textHighlights: string[]
    developmentPlan: {
      focusArea: string
      actions: string[]
      managerSupport: string[]
      nextCheckinTopics: string[]
    }
    reportCache?: {
      id: string
      generatedAt: string
      source: 'persisted' | 'live'
    }
    developmentPlanRecord?: {
      id: string
      title: string
      status: DevelopmentPlanStatus
      updatedAt: string
    }
    linkage: Array<{
      label: string
      href: string
      description: string
    }>
  }
  admin?: {
    roundHealth: Array<{
      roundId: string
      roundName: string
      responseRate: number
      pendingCount: number
      submittedCount: number
      thresholdMet: boolean
      qualityRiskCount: number
    }>
    timeline: Array<{
      title: string
      description: string
      at: string
    }>
    alerts: string[]
    nominationQueue?: Array<{
      targetId: string
      targetName: string
      roundId: string
      roundName: string
      status: string
      totalCount: number
      approvedCount: number
      publishedCount: number
    }>
  }
  respond?: {
    feedbackId: string
    roundId: string
    roundName: string
    receiverId: string
    receiverName: string
    relationship: string
    status: FeedbackStatus
    questionCount: number
    answeredCount: number
    overallComment?: string
    questions: Array<{
      id: string
      category: string
      questionText: string
      questionType: QuestionType
      isRequired: boolean
      scaleMin?: number | null
      scaleMax?: number | null
      ratingValue?: number | null
      textValue?: string | null
    }>
    instructions: string[]
  }
}

type GetFeedback360PageDataParams = {
  session: Session
  mode: Feedback360RouteMode
  cycleId?: string
  roundId?: string
  empId?: string
  feedbackId?: string
}

function toResponseRate(submittedCount: number, totalCount: number) {
  if (!totalCount) return 0
  return Math.round((submittedCount / totalCount) * 100)
}

function isManagerOfTarget(target: {
  teamLeaderId: string | null
  sectionChiefId: string | null
  divisionHeadId: string | null
}, actorId: string) {
  return (
    target.teamLeaderId === actorId ||
    target.sectionChiefId === actorId ||
    target.divisionHeadId === actorId
  )
}

function canViewTarget({
  actorId,
  actorRole,
  target,
}: {
  actorId: string
  actorRole: string
  target: {
    id: string
    teamLeaderId: string | null
    sectionChiefId: string | null
    divisionHeadId: string | null
  }
}) {
  if (actorRole === 'ROLE_ADMIN') return true
  if (target.id === actorId) return true
  return isManagerOfTarget(target, actorId)
}

function getPositionLabel(position: string) {
  const labels: Record<string, string> = {
    MEMBER: '구성원',
    TEAM_LEADER: '팀장',
    SECTION_CHIEF: '부서장',
    DIV_HEAD: '본부장',
    CEO: 'CEO',
  }

  return labels[position] ?? position
}

function parseAuditRecord(value: unknown) {
  if (!value || typeof value !== 'object') {
    return null
  }

  return value as Record<string, unknown>
}

export async function getFeedback360PageData(
  params: GetFeedback360PageDataParams
): Promise<Feedback360PageData> {
  try {
    const employee = await prisma.employee.findUnique({
      where: { id: params.session.user.id },
      include: {
        department: true,
      },
    })

    if (!employee) {
      return {
        mode: params.mode,
        state: 'permission-denied',
        message: '직원 정보를 찾을 수 없습니다.',
        availableCycles: [],
        availableRounds: [],
        summary: {
          activeRounds: 0,
          pendingResponses: 0,
          submittedResponses: 0,
          averageResponseRate: 0,
          anonymityReadyCount: 0,
        },
      }
    }

    const availableCycles = await prisma.evalCycle.findMany({
      where: { orgId: employee.department.orgId },
      orderBy: [{ evalYear: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        cycleName: true,
        evalYear: true,
        status: true,
      },
    })

    const selectedCycle = availableCycles.find((cycle) => cycle.id === params.cycleId) ?? availableCycles[0] ?? null
    if (!selectedCycle) {
      return {
        mode: params.mode,
        state: 'empty',
        message: '360 다면평가를 볼 수 있는 평가 주기가 없습니다.',
        currentUser: {
          id: employee.id,
          name: employee.empName,
          role: employee.role,
          department: employee.department.deptName,
        },
        permissions: {
          canManageRounds: employee.role === 'ROLE_ADMIN',
          canSubmitNomination: true,
          canViewAdmin: employee.role === 'ROLE_ADMIN',
          canViewResults: true,
          canRespond: true,
        },
        availableCycles: [],
        availableRounds: [],
        summary: {
          activeRounds: 0,
          pendingResponses: 0,
          submittedResponses: 0,
          averageResponseRate: 0,
          anonymityReadyCount: 0,
        },
      }
    }

    const rounds = await prisma.multiFeedbackRound.findMany({
      where: { evalCycleId: selectedCycle.id },
      include: {
        feedbacks: {
          include: {
            receiver: {
              select: {
                id: true,
                empName: true,
                position: true,
                teamLeaderId: true,
                sectionChiefId: true,
                divisionHeadId: true,
                department: { select: { deptName: true } },
              },
            },
            giver: {
              select: {
                id: true,
                empName: true,
                department: { select: { deptName: true } },
              },
            },
            responses: {
              include: {
                question: {
                  select: {
                    category: true,
                    questionType: true,
                  },
                },
              },
            },
          },
        },
        questions: {
          select: {
            id: true,
            category: true,
            questionType: true,
          },
        },
      },
      orderBy: [{ endDate: 'desc' }, { createdAt: 'desc' }],
    })

    const selectedRound = rounds.find((round) => round.id === params.roundId) ?? rounds[0] ?? null
    const currentUser = {
      id: employee.id,
      name: employee.empName,
      role: employee.role,
      department: employee.department.deptName,
    }

    const pendingResponses = rounds.reduce(
      (sum, round) =>
        sum +
        round.feedbacks.filter(
          (feedback) =>
            feedback.giverId === employee.id &&
            feedback.status !== 'SUBMITTED'
        ).length,
      0
    )
    const submittedResponses = rounds.reduce(
      (sum, round) =>
        sum +
        round.feedbacks.filter(
          (feedback) =>
            feedback.giverId === employee.id &&
            feedback.status === 'SUBMITTED'
        ).length,
      0
    )

    const availableRounds = rounds.map((round) => {
      const totalCount = round.feedbacks.length
      const submittedCount = round.feedbacks.filter((feedback) => feedback.status === 'SUBMITTED').length
      const uniqueTargets = new Set(round.feedbacks.map((feedback) => feedback.receiverId))

      return {
        id: round.id,
        roundName: round.roundName,
        roundType: round.roundType,
        status: round.status,
        isAnonymous: round.isAnonymous,
        minRaters: round.minRaters,
        startDate: formatDate(round.startDate),
        endDate: formatDate(round.endDate),
        targetCount: uniqueTargets.size,
        submittedCount,
        responseRate: toResponseRate(submittedCount, totalCount),
      }
    })

    const averageResponseRate = availableRounds.length
      ? Math.round(
          availableRounds.reduce((sum, round) => sum + round.responseRate, 0) / availableRounds.length
        )
      : 0

    const pendingRequests = rounds
      .flatMap((round) =>
        round.feedbacks
          .filter(
            (feedback) =>
              feedback.giverId === employee.id &&
              feedback.status !== 'SUBMITTED'
          )
          .map((feedback) => ({
            feedbackId: feedback.id,
            roundId: round.id,
            roundName: round.roundName,
            receiverId: feedback.receiverId,
            receiverName: feedback.receiver.empName,
            relationship: feedback.relationship,
            dueDate: formatDate(round.endDate),
            href: `/evaluation/360/respond/${encodeURIComponent(feedback.id)}?cycleId=${encodeURIComponent(
              selectedCycle.id
            )}&roundId=${encodeURIComponent(round.id)}`,
          }))
      )
      .slice(0, 8)

    const baseData: Feedback360PageData = {
      mode: params.mode,
      state: rounds.length ? 'ready' : 'empty',
      message: rounds.length ? undefined : '생성된 다면평가 라운드가 아직 없습니다. 먼저 평가 주기와 360 라운드를 설정하세요.',
      currentUser,
      permissions: {
        canManageRounds: employee.role === 'ROLE_ADMIN',
        canSubmitNomination: true,
        canViewAdmin: employee.role === 'ROLE_ADMIN',
        canViewResults: true,
        canRespond: true,
      },
      availableCycles: availableCycles.map((cycle) => ({
        id: cycle.id,
        name: cycle.cycleName,
        year: cycle.evalYear,
        status: cycle.status,
      })),
      selectedCycleId: selectedCycle.id,
      availableRounds,
      selectedRoundId: selectedRound?.id,
      summary: {
        activeRounds: rounds.filter((round) => ['RATER_SELECTION', 'IN_PROGRESS'].includes(round.status)).length,
        pendingResponses,
        submittedResponses,
        averageResponseRate,
        anonymityReadyCount: rounds.filter((round) => {
          const submittedCount = round.feedbacks.filter((feedback) => feedback.status === 'SUBMITTED').length
          return submittedCount >= round.minRaters
        }).length,
      },
      pendingRequests,
    }

    if (!selectedRound) {
      return baseData
    }

    const requestedTargetId = params.empId || employee.id
    const explicitTarget =
      requestedTargetId === employee.id
        ? employee
        : await prisma.employee.findUnique({
            where: { id: requestedTargetId },
            include: { department: true },
          })

    const target = explicitTarget && canViewTarget({
      actorId: employee.id,
      actorRole: employee.role,
      target: explicitTarget,
    })
      ? explicitTarget
      : employee

    const nominationEntityId = `${selectedRound.id}:${target.id}`
    const [persistedNominations, nominationDraftLog, reportCache, developmentPlanRecord] = await Promise.all([
      prisma.feedbackNomination.findMany({
        where: {
          roundId: selectedRound.id,
          targetId: target.id,
        },
        include: {
          reviewer: {
            select: {
              id: true,
              empName: true,
            },
          },
        },
        orderBy: [{ relationship: 'asc' }, { reviewer: { empName: 'asc' } }],
      }),
      prisma.auditLog.findFirst({
        where: {
          entityType: 'FeedbackNominationDraft',
          entityId: nominationEntityId,
        },
        orderBy: { timestamp: 'desc' },
      }),
      prisma.feedbackReportCache.findUnique({
        where: {
          roundId_targetId: {
            roundId: selectedRound.id,
            targetId: target.id,
          },
        },
      }),
      prisma.developmentPlan.findFirst({
        where: {
          employeeId: target.id,
          sourceType: 'FEEDBACK_360',
          sourceId: `${selectedRound.id}:${target.id}`,
        },
        orderBy: { updatedAt: 'desc' },
      }),
    ])

    const savedDraft = parseAuditRecord(nominationDraftLog?.newValue)
    const persistedReviewers = persistedNominations.map((item) => ({
      employeeId: item.reviewerId,
      name: item.reviewer.empName,
      relationship: item.relationship,
    }))
    const savedReviewers = Array.isArray(savedDraft?.reviewers)
      ? savedDraft.reviewers
          .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
          .map((item) => ({
            employeeId: String(item.employeeId ?? ''),
            name: String(item.name ?? '이름 없음'),
            relationship: String(item.relationship ?? 'PEER'),
          }))
      : []

    const nominationSavedReviewers = persistedReviewers.length ? persistedReviewers : savedReviewers
    const nominationWorkflowStatus = getNominationAggregateStatus(persistedNominations.map((item) => item.status))

    if (params.mode === 'nomination') {
      const sameDepartmentEmployees = await prisma.employee.findMany({
        where: {
          deptId: target.deptId,
          status: 'ACTIVE',
          id: { not: target.id },
        },
        select: {
          id: true,
          empName: true,
          department: { select: { deptName: true } },
        },
        orderBy: { empName: 'asc' },
        take: 12,
      })

      const subordinateEmployees = await prisma.employee.findMany({
        where: {
          status: 'ACTIVE',
          OR: [
            { teamLeaderId: target.id },
            { sectionChiefId: target.id },
            { divisionHeadId: target.id },
          ],
        },
        select: {
          id: true,
          empName: true,
          department: { select: { deptName: true } },
        },
        orderBy: { empName: 'asc' },
        take: 12,
      })

      const supervisorIds = [target.teamLeaderId, target.sectionChiefId, target.divisionHeadId].filter(Boolean) as string[]
      const supervisors = supervisorIds.length
        ? await prisma.employee.findMany({
            where: { id: { in: supervisorIds } },
            select: {
              id: true,
              empName: true,
              department: { select: { deptName: true } },
            },
          })
        : []

      return {
        ...baseData,
        nomination: {
          targetEmployee: {
            id: target.id,
            name: target.empName,
            department: target.department.deptName,
            position: getPositionLabel(target.position),
          },
          savedDraftCount: nominationSavedReviewers.length,
          reviewerGroups: [
            {
              key: 'self',
              label: '자기',
              description: '자기 인식 비교용으로 자기 응답을 함께 확인할 수 있습니다.',
              reviewers: [
                {
                  employeeId: target.id,
                  name: target.empName,
                  department: target.department.deptName,
                  relationship: 'SELF',
                },
              ],
            },
            {
              key: 'supervisor',
              label: '상사',
              description: '직속 리더 또는 상위 리더를 포함합니다.',
              reviewers: supervisors.map((reviewer) => ({
                employeeId: reviewer.id,
                name: reviewer.empName,
                department: reviewer.department.deptName,
                relationship: 'SUPERVISOR',
              })),
            },
            {
              key: 'peer',
              label: '동료',
              description: '같은 조직 안에서 협업 맥락이 있는 동료를 추천합니다.',
              reviewers: sameDepartmentEmployees.map((reviewer) => ({
                employeeId: reviewer.id,
                name: reviewer.empName,
                department: reviewer.department.deptName,
                relationship: 'PEER',
              })),
            },
            {
              key: 'subordinate',
              label: '부하',
              description: '리더 역할을 가진 대상자라면 하향 피드백을 포함합니다.',
              reviewers: subordinateEmployees.map((reviewer) => ({
                employeeId: reviewer.id,
                name: reviewer.empName,
                department: reviewer.department.deptName,
                relationship: 'SUBORDINATE',
              })),
            },
          ],
          guidance: [
            '기본 anonymity threshold는 3명이며, 기준 미달 시 익명 요약과 텍스트 응답은 숨겨집니다.',
            '상사 1명, 동료 3명, 부하 3명 기준의 균형을 먼저 맞추고 필요 시 HR이 예외를 승인합니다.',
            '이번 1차 구현에서는 nomination draft를 저장해 운영 검토 흐름에 연결하는 기반까지 제공합니다.',
          ],
          workflowStatus: nominationWorkflowStatus,
          counts: {
            total: persistedNominations.length,
            approved: persistedNominations.filter((item) => item.status === 'APPROVED' || item.status === 'PUBLISHED').length,
            published: persistedNominations.filter((item) => item.status === 'PUBLISHED').length,
          },
          canApprove: canApproveFeedbackTarget(employee.id, employee.role, target),
          canPublish: employee.role === 'ROLE_ADMIN',
          savedDraft: nominationSavedReviewers.length
            ? {
                updatedAt: nominationDraftLog ? formatDate(nominationDraftLog.timestamp) : formatDate(new Date()),
                reviewers: nominationSavedReviewers,
              }
            : undefined,
        },
      }
    }

    const targetFeedbacks = selectedRound.feedbacks.filter((feedback) => feedback.receiverId === target.id)
    const submittedTargetFeedbacks = targetFeedbacks.filter((feedback) => feedback.status === 'SUBMITTED')
    const thresholdMet = submittedTargetFeedbacks.length >= selectedRound.minRaters
    const categoryMap = new Map<string, number[]>()
    const textHighlights: string[] = []

    for (const feedback of submittedTargetFeedbacks) {
      for (const response of feedback.responses) {
        if (
          response.question.questionType === ('RATING_SCALE' as QuestionType) &&
          typeof response.ratingValue === 'number'
        ) {
          const current = categoryMap.get(response.question.category) ?? []
          current.push(response.ratingValue)
          categoryMap.set(response.question.category, current)
        }

        if (
          thresholdMet &&
          typeof response.textValue === 'string' &&
          response.textValue.trim().length >= 10 &&
          textHighlights.length < 5
        ) {
          textHighlights.push(response.textValue.trim())
        }
      }
    }

    const categoryScores = [...categoryMap.entries()].map(([category, values]) => ({
      category,
      average: Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10,
      count: values.length,
    }))
      .sort((a, b) => b.average - a.average)

    const strengths = categoryScores.slice(0, 3).map((item) => `${item.category} 영역에서 평균 ${item.average}점으로 상대적 강점이 보입니다.`)
    const improvements = categoryScores.slice(-3).reverse().map((item) => `${item.category} 영역은 평균 ${item.average}점으로 추가 코칭이 필요합니다.`)

    const developmentFocus = improvements[0]?.split(' 영역')[0] ?? '협업과 영향력'

    const persistedPayload = parsePersistedReportPayload(reportCache?.reportPayload)
    const persistedCategoryScores = Array.isArray(persistedPayload?.categoryScores)
      ? (persistedPayload.categoryScores as Array<{ category: string; average: number; count: number }>)
      : categoryScores
    const persistedStrengths = Array.isArray(persistedPayload?.strengths)
      ? (persistedPayload.strengths as string[])
      : strengths
    const persistedImprovements = Array.isArray(persistedPayload?.improvements)
      ? (persistedPayload.improvements as string[])
      : improvements
    const persistedTextHighlights = Array.isArray(persistedPayload?.textHighlights)
      ? (persistedPayload.textHighlights as string[])
      : textHighlights
    const persistedDevelopmentPlan = parsePersistedReportPayload(persistedPayload?.developmentPlan)

    if (params.mode === 'results') {
      return {
        ...baseData,
        results: {
          targetEmployee: {
            id: target.id,
            name: target.empName,
            department: target.department.deptName,
            position: getPositionLabel(target.position),
          },
          anonymityThreshold: selectedRound.minRaters,
          feedbackCount: reportCache?.feedbackCount ?? submittedTargetFeedbacks.length,
          thresholdMet: reportCache?.thresholdMet ?? thresholdMet,
          categoryScores: persistedCategoryScores,
          strengths: strengths.length ? strengths : ['아직 충분한 응답이 없어 강점 테마를 생성하지 못했습니다.'],
          improvements: improvements.length ? improvements : ['응답 수가 anonymity threshold를 충족하면 개선 포인트를 더 선명하게 볼 수 있습니다.'],
          anonymousSummary: thresholdMet
            ? '익명성을 유지한 상태로 강점, blind spot, 개발 포인트를 요약할 준비가 되었습니다.'
            : `현재 응답 수는 ${submittedTargetFeedbacks.length}건이며, 익명 요약 공개 기준 ${selectedRound.minRaters}건에 아직 미달합니다.`,
          textHighlights: persistedTextHighlights,
          developmentPlan: {
            focusArea: `${developmentFocus} 역량 강화`,
            actions: [
              '다음 체크인에서 360 blind spot과 최근 월간 실적을 함께 검토합니다.',
              '다음 분기 개인 KPI 중 하나를 협업 또는 리더십 개선 목표와 연결합니다.',
              '피드백에서 반복된 주제를 기준으로 작은 실행 실험을 2주 단위로 설계합니다.',
            ],
            managerSupport: [
              '리더는 행동 예시 기반 피드백을 월 1회 이상 제공합니다.',
              '리더는 체크인에서 성과와 역량 피드백을 분리해 기록합니다.',
            ],
            nextCheckinTopics: [
              '360 강점과 현재 KPI 실행 방식의 연결',
              'blind spot이 실제 협업 장면에서 드러나는 순간',
              '다음 달 실천 항목과 증빙 방식',
            ],
          },
          reportCache: reportCache
            ? {
                id: reportCache.id,
                generatedAt: formatDate(reportCache.generatedAt),
                source: 'persisted',
              }
            : undefined,
          developmentPlanRecord: developmentPlanRecord
            ? {
                id: developmentPlanRecord.id,
                title: developmentPlanRecord.title,
                status: developmentPlanRecord.status,
                updatedAt: formatDate(developmentPlanRecord.updatedAt),
              }
            : undefined,
          linkage: [
            {
              label: '평가 워크벤치로 이동',
              href: `/evaluation/assistant?cycleId=${encodeURIComponent(selectedCycle.id)}`,
              description: '다면피드백을 평가 근거로 함께 검토합니다.',
            },
            {
              label: '평가 결과 보기',
              href: '/evaluation/results',
              description: '최종 결과 리포트와 성장 제안 화면으로 이동합니다.',
            },
            {
              label: '이의 신청 정책 확인',
              href: '/evaluation/appeal',
              description: '다면피드백은 익명성 기준을 지키며 결과 설명의 보조 근거로만 사용합니다.',
            },
            {
              label: '다음 체크인 준비',
              href: '/checkin',
              description: '개발 계획 초안을 체크인 아젠다로 이어갑니다.',
            },
          ],
        },
      }
    }

    if (params.mode === 'admin') {
      const roundHealth = rounds.map((round) => {
        const roundSubmitted = round.feedbacks.filter((feedback) => feedback.status === 'SUBMITTED')
        const qualityRiskCount = roundSubmitted.filter((feedback) => {
          const ratingValues = feedback.responses
            .map((response) => response.ratingValue)
            .filter((value): value is number => typeof value === 'number')
          const textResponses = feedback.responses
            .map((response) => response.textValue)
            .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)

          const identicalScores = ratingValues.length >= 3 && new Set(ratingValues).size === 1
          const weakText = textResponses.length > 0 && textResponses.every((text) => text.trim().length < 12)
          return identicalScores || weakText
        }).length

        const submittedCount = roundSubmitted.length
        const totalCount = round.feedbacks.length

        return {
          roundId: round.id,
          roundName: round.roundName,
          responseRate: toResponseRate(submittedCount, totalCount),
          pendingCount: totalCount - submittedCount,
          submittedCount,
          thresholdMet: submittedCount >= round.minRaters,
          qualityRiskCount,
        }
      })

      const nominationRecords = await prisma.feedbackNomination.findMany({
        where: {
          roundId: { in: rounds.map((round) => round.id) },
        },
        include: {
          target: {
            select: {
              id: true,
              empName: true,
            },
          },
          round: {
            select: {
              id: true,
              roundName: true,
            },
          },
        },
        orderBy: [{ updatedAt: 'desc' }],
      })

      const nominationQueue = Array.from(
        nominationRecords.reduce((map, item) => {
          const key = `${item.roundId}:${item.targetId}`
          const current = map.get(key) ?? {
            targetId: item.targetId,
            targetName: item.target.empName,
            roundId: item.roundId,
            roundName: item.round.roundName,
            statuses: [] as string[],
          }

          current.statuses.push(item.status)
          map.set(key, current)
          return map
        }, new Map<string, { targetId: string; targetName: string; roundId: string; roundName: string; statuses: string[] }>())
      )
        .map(([, item]) => ({
          targetId: item.targetId,
          targetName: item.targetName,
          roundId: item.roundId,
          roundName: item.roundName,
          status: getNominationAggregateStatus(item.statuses as any),
          totalCount: item.statuses.length,
          approvedCount: item.statuses.filter((status) => status === 'APPROVED' || status === 'PUBLISHED').length,
          publishedCount: item.statuses.filter((status) => status === 'PUBLISHED').length,
        }))
        .slice(0, 12)

      return {
        ...baseData,
        admin: {
          roundHealth,
          timeline: rounds.slice(0, 6).map((round) => ({
            title: round.roundName,
            description: `${round.status} · 응답률 ${toResponseRate(round.feedbacks.filter((feedback) => feedback.status === 'SUBMITTED').length, round.feedbacks.length)}%`,
            at: formatDate(round.endDate),
          })),
          alerts: roundHealth.flatMap((item) => {
            const alerts: string[] = []
            if (item.responseRate < 60) {
              alerts.push(`${item.roundName}의 응답률이 낮아 reminder cadence 점검이 필요합니다.`)
            }
            if (item.qualityRiskCount > 0) {
              alerts.push(`${item.roundName}에서 careless review 의심 응답 ${item.qualityRiskCount}건이 감지되었습니다.`)
            }
            return alerts
          }),
          nominationQueue,
        },
      }
    }

    if (params.mode === 'respond') {
      const feedback = params.feedbackId
        ? await prisma.multiFeedback.findUnique({
            where: { id: params.feedbackId },
            include: {
              round: {
                include: {
                  questions: true,
                },
              },
              receiver: {
                select: {
                  empName: true,
                },
              },
              responses: true,
            },
          })
        : null

      if (!feedback || (feedback.giverId !== employee.id && employee.role !== 'ROLE_ADMIN')) {
        return {
          ...baseData,
          state: 'permission-denied',
          message: '응답 화면에 접근할 권한이 없습니다.',
        }
      }

      return {
        ...baseData,
        respond: {
          feedbackId: feedback.id,
          roundId: feedback.roundId,
          roundName: feedback.round.roundName,
          receiverId: feedback.receiverId,
          receiverName: feedback.receiver.empName,
          relationship: feedback.relationship,
          status: feedback.status,
          questionCount: feedback.round.questions.length,
          answeredCount: feedback.responses.length,
          overallComment: feedback.overallComment ?? undefined,
          questions: feedback.round.questions.map((question) => {
            const existing = feedback.responses.find((response) => response.questionId === question.id)

            return {
              id: question.id,
              category: question.category,
              questionText: question.questionText,
              questionType: question.questionType,
              isRequired: question.isRequired,
              scaleMin: question.scaleMin,
              scaleMax: question.scaleMax,
              ratingValue: existing?.ratingValue ?? null,
              textValue: existing?.textValue ?? null,
            }
          }),
          instructions: [
            '행동 기반으로 작성하고 개인 신상이나 감정 표현은 최소화합니다.',
            '익명 라운드는 threshold 충족 전까지 텍스트 응답이 보고서에 공개되지 않습니다.',
            '이번 1차 구현에서는 응답 상세 shell과 진행 상태, 추후 API 확장 포인트를 먼저 제공합니다.',
          ],
        },
      }
    }

    return baseData
  } catch (error) {
    console.error(error)
    return {
      mode: params.mode,
      state: 'error',
      message: '360 다면평가 화면 데이터를 불러오지 못했습니다.',
      availableCycles: [],
      availableRounds: [],
      summary: {
        activeRounds: 0,
        pendingResponses: 0,
        submittedResponses: 0,
        averageResponseRate: 0,
        anonymityReadyCount: 0,
      },
    }
  }
}
