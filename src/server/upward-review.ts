import type {
  FeedbackRoundStatus,
  FeedbackStatus,
  QuestionType,
  RaterRelationship,
  SystemRole,
} from '@prisma/client'
import type { Session } from 'next-auth'
import { createAuditLog } from '@/lib/audit'
import { prisma } from '@/lib/prisma'
import { formatDate } from '@/lib/utils'
import {
  buildUpwardSuggestions,
  canViewUpwardResults,
  getPrimaryLeaderId,
  parseChoiceOptions,
  parseUpwardReviewSettings,
  summarizeUpwardResults,
  UPWARD_ASSIGNMENT_STATUS_LABELS,
  UPWARD_ROUND_STATUS_LABELS,
  UPWARD_TARGET_TYPE_LABELS,
  type UpwardDirectoryEmployee,
} from '@/lib/upward-review'
import { getCollaboratorRoundIds, getFeedbackReviewAdminAccess } from './feedback-360-access'

export type UpwardReviewRouteMode = 'overview' | 'admin' | 'respond' | 'results'
export type UpwardReviewPageState = 'ready' | 'empty' | 'permission-denied' | 'error'

type UpwardReviewResultQuestion = {
  questionId: string
  category: string
  questionText: string
  questionType: QuestionType
  averageScore: number | null
  responseCount: number
  textResponses: string[]
  choiceCounts: Array<{ label: string; count: number }>
}

export type UpwardReviewPageData = {
  mode: UpwardReviewRouteMode
  state: UpwardReviewPageState
  message?: string
  currentUser?: {
    id: string
    name: string
    role: SystemRole
    department: string
  }
  permissions?: {
    canManageRounds: boolean
    canRespond: boolean
    canViewResults: boolean
    canViewAdmin: boolean
    canViewRaw: boolean
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
    status: FeedbackRoundStatus
    statusLabel: string
    startDate: string
    endDate: string
    minRaters: number
    templateName?: string | null
    targetTypes: string[]
    assignmentCount: number
    submittedCount: number
    pendingCount: number
    released: boolean
    releaseLabel: string
  }>
  selectedRoundId?: string
  summary: {
    activeRounds: number
    pendingAssignments: number
    submittedAssignments: number
    releasedTargets: number
  }
  overview?: {
    assignments: Array<{
      feedbackId: string
      roundId: string
      roundName: string
      receiverId: string
      receiverName: string
      receiverDepartment: string
      receiverPosition: string
      relationship: RaterRelationship
      status: FeedbackStatus
      statusLabel: string
      dueDate: string
      href: string
    }>
  }
  respond?: {
    feedbackId: string
    roundId: string
    roundName: string
    receiverId: string
    receiverName: string
    receiverDepartment: string
    receiverPosition: string
    relationship: RaterRelationship
    status: FeedbackStatus
    readOnly: boolean
    dueDate: string
    guidance: string[]
    overallComment: string
    questions: Array<{
      id: string
      category: string
      questionText: string
      description?: string | null
      questionType: QuestionType
      scaleMin?: number | null
      scaleMax?: number | null
      isRequired: boolean
      choiceOptions: string[]
      ratingValue?: number | null
      textValue?: string | null
    }>
  }
  admin?: {
    templates: Array<{
      id: string
      name: string
      description?: string | null
      isActive: boolean
      defaultMinResponses: number
      defaultTargetTypes: string[]
      questionCount: number
      questions: Array<{
        id: string
        category?: string | null
        questionText: string
        description?: string | null
        questionType: QuestionType
        scaleMin?: number | null
        scaleMax?: number | null
        isRequired: boolean
        isActive: boolean
        choiceOptions: string[]
        sortOrder: number
      }>
    }>
    selectedTemplateId?: string
    selectedRound?: {
      id: string
      roundName: string
      status: FeedbackRoundStatus
      statusLabel: string
      startDate: string
      endDate: string
      templateId?: string | null
      templateName?: string | null
      targetTypes: string[]
      resultViewerMode: string
      rawResponsePolicy: string
      released: boolean
      assignments: Array<{
        id: string
        evaluatorId: string
        evaluatorName: string
        evaluatorDepartment: string
        evaluateeId: string
        evaluateeName: string
        evaluateeDepartment: string
        relationship: RaterRelationship
        status: FeedbackStatus
        statusLabel: string
        submittedAt?: string | null
      }>
      summaryCards: Array<{
        label: string
        value: string
      }>
    }
    employeeDirectory: UpwardDirectoryEmployee[]
    suggestions: Array<{
      evaluatorId: string
      evaluatorName: string
      evaluateeId: string
      evaluateeName: string
      relationship: RaterRelationship
      reason: string
    }>
  }
  results?: {
    roundId: string
    roundName: string
    released: boolean
    thresholdMet: boolean
    minRaters: number
    feedbackCount: number
    visible: boolean
    canViewRaw: boolean
    hiddenReason?: string
    selectedTargetId: string
    targets: Array<{
      id: string
      name: string
      department: string
      position: string
      feedbackCount: number
      thresholdMet: boolean
      visible: boolean
    }>
    targetEmployee: {
      id: string
      name: string
      department: string
      position: string
    }
    strengths: string[]
    improvements: string[]
    questionSummaries: UpwardReviewResultQuestion[]
    rawResponses: Array<{
      giverId: string
      giverName: string
      relationship: RaterRelationship
      overallComment: string
      answers: Array<{
        questionId: string
        questionText: string
        ratingValue: number | null
        textValue: string
      }>
    }>
  }
}

type GetUpwardReviewPageDataParams = {
  session: Session
  mode: UpwardReviewRouteMode
  cycleId?: string
  roundId?: string
  feedbackId?: string
  empId?: string
}

function canAccessUpwardResultShell(params: {
  actorId: string
  targetId: string
  targetPrimaryLeaderId?: string | null
  settings: ReturnType<typeof parseUpwardReviewSettings>
  canManage: boolean
  canReadRaw: boolean
}) {
  if (params.canManage || params.canReadRaw) {
    return true
  }

  if (params.actorId === params.targetId) {
    return true
  }

  return (
    params.settings.resultViewerMode === 'TARGET_AND_PRIMARY_MANAGER' &&
    params.targetPrimaryLeaderId === params.actorId
  )
}

function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getPositionLabel(value: string | null | undefined) {
  return value?.trim() || '-'
}

function buildEmptyPage(mode: UpwardReviewRouteMode, message: string): UpwardReviewPageData {
  return {
    mode,
    state: 'empty',
    message,
    availableCycles: [],
    availableRounds: [],
    summary: {
      activeRounds: 0,
      pendingAssignments: 0,
      submittedAssignments: 0,
      releasedTargets: 0,
    },
  }
}

function buildDirectoryEmployee(employee: {
  id: string
  empName: string
  role: SystemRole
  position: string
  deptId: string
  jobTitle: string | null
  teamName: string | null
  teamLeaderId: string | null
  sectionChiefId: string | null
  divisionHeadId: string | null
  department: { deptName: string }
}): UpwardDirectoryEmployee {
  return {
    id: employee.id,
    empName: employee.empName,
    role: employee.role,
    position: employee.position,
    deptId: employee.deptId,
    deptName: employee.department.deptName,
    jobTitle: employee.jobTitle,
    teamName: employee.teamName,
    teamLeaderId: employee.teamLeaderId,
    sectionChiefId: employee.sectionChiefId,
    divisionHeadId: employee.divisionHeadId,
  }
}

export async function getUpwardReviewPageData(
  params: GetUpwardReviewPageDataParams
): Promise<UpwardReviewPageData> {
  const sessionUser = params.session.user as Session['user'] & { id?: string }
  if (!sessionUser?.id) {
    return buildEmptyPage(params.mode, '로그인 정보를 확인할 수 없습니다.')
  }

  const employee = await prisma.employee.findUnique({
    where: { id: sessionUser.id },
    include: {
      department: true,
    },
  })

  if (!employee) {
    return buildEmptyPage(params.mode, '직원 정보를 찾을 수 없습니다.')
  }

  const reviewAdminAccess = await getFeedbackReviewAdminAccess({
    employeeId: employee.id,
    actorRole: employee.role,
    orgId: employee.department.orgId,
  })

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
      ...buildEmptyPage(params.mode, '상향 평가를 운영할 평가 주기가 없습니다.'),
      currentUser: {
        id: employee.id,
        name: employee.empName,
        role: employee.role,
        department: employee.department.deptName,
      },
    }
  }

  const rounds = await prisma.multiFeedbackRound.findMany({
    where: {
      evalCycleId: selectedCycle.id,
      roundType: 'UPWARD',
    },
    include: {
      feedbacks: {
        include: {
          giver: {
            select: {
              id: true,
              empName: true,
              department: { select: { deptName: true } },
            },
          },
          receiver: {
            select: {
              id: true,
              empName: true,
              role: true,
              position: true,
              teamLeaderId: true,
              sectionChiefId: true,
              divisionHeadId: true,
              department: { select: { deptName: true } },
            },
          },
          responses: {
            include: {
              question: {
                select: {
                  id: true,
                  category: true,
                  questionText: true,
                  questionType: true,
                  choiceOptions: true,
                },
              },
            },
          },
        },
      },
      questions: {
        orderBy: [{ sortOrder: 'asc' }],
        select: {
          id: true,
          category: true,
          questionText: true,
          description: true,
          questionType: true,
          scaleMin: true,
          scaleMax: true,
          isRequired: true,
          isActive: true,
          choiceOptions: true,
          sortOrder: true,
        },
      },
      collaborators: {
        select: {
          employeeId: true,
        },
      },
    },
    orderBy: [{ endDate: 'desc' }, { createdAt: 'desc' }],
  })

  const collaboratorRoundIds =
    reviewAdminAccess.canManageCollaboratorRounds && !reviewAdminAccess.canManageAllRounds
      ? await getCollaboratorRoundIds({
          employeeId: employee.id,
          roundIds: rounds.map((round) => round.id),
        })
      : new Set<string>()

  const adminScopedRounds =
    reviewAdminAccess.canManageAllRounds
      ? rounds
      : reviewAdminAccess.canManageCollaboratorRounds
        ? rounds.filter((round) => collaboratorRoundIds.has(round.id))
        : []

  const selectableRounds = params.mode === 'admin' ? adminScopedRounds : rounds
  const selectedRound = selectableRounds.find((round) => round.id === params.roundId) ?? selectableRounds[0] ?? null
  const selectedRoundSettings = selectedRound ? parseUpwardReviewSettings(selectedRound.documentSettings) : null
  const canManageSelectedRound = selectedRound
    ? reviewAdminAccess.canManageAllRounds ||
      (reviewAdminAccess.canManageCollaboratorRounds && collaboratorRoundIds.has(selectedRound.id))
    : false
  const canReadSelectedRoundContent = selectedRound
    ? reviewAdminAccess.canReadAllContent ||
      (reviewAdminAccess.canReadCollaboratorContent && collaboratorRoundIds.has(selectedRound.id))
    : false

  const availableRounds = rounds.map((round) => {
    const settings = parseUpwardReviewSettings(round.documentSettings)
    const submittedCount = round.feedbacks.filter((feedback) => feedback.status === 'SUBMITTED').length
    const releasedTargetCount = settings.resultReleasedAt
      ? Array.from(
          round.feedbacks
            .filter((feedback) => feedback.status === 'SUBMITTED')
            .reduce((map, feedback) => {
              const current = map.get(feedback.receiverId) ?? 0
              map.set(feedback.receiverId, current + 1)
              return map
            }, new Map<string, number>())
            .values()
        ).filter((count) => count >= round.minRaters).length
      : 0

    return {
      id: round.id,
      roundName: round.roundName,
      status: round.status,
      statusLabel: UPWARD_ROUND_STATUS_LABELS[round.status],
      startDate: formatDate(round.startDate),
      endDate: formatDate(round.endDate),
      minRaters: round.minRaters,
      templateName: settings.templateName,
      targetTypes: settings.targetTypes.map((type) => UPWARD_TARGET_TYPE_LABELS[type]),
      assignmentCount: round.feedbacks.length,
      submittedCount,
      pendingCount: round.feedbacks.length - submittedCount,
      released: Boolean(settings.resultReleasedAt),
      releaseLabel: settings.resultReleasedAt ? '공개됨' : '비공개',
      releasedTargetCount,
    }
  })

  const baseData: UpwardReviewPageData = {
    mode: params.mode,
    state: rounds.length ? 'ready' : 'empty',
    message: rounds.length
      ? undefined
      : '아직 운영 중인 상향 평가 라운드가 없습니다. 관리자 페이지에서 템플릿과 라운드를 먼저 준비해 주세요.',
    currentUser: {
      id: employee.id,
      name: employee.empName,
      role: employee.role,
      department: employee.department.deptName,
    },
    permissions: {
      canManageRounds:
        reviewAdminAccess.canManageAllRounds || reviewAdminAccess.canManageCollaboratorRounds,
      canRespond: true,
      canViewResults: true,
      canViewAdmin:
        reviewAdminAccess.canManageAllRounds || reviewAdminAccess.canManageCollaboratorRounds,
      canViewRaw: canReadSelectedRoundContent || reviewAdminAccess.isGlobalAdmin,
    },
    availableCycles: availableCycles.map((cycle) => ({
      id: cycle.id,
      name: cycle.cycleName,
      year: cycle.evalYear,
      status: cycle.status,
    })),
    selectedCycleId: selectedCycle.id,
    availableRounds: availableRounds.map((round) => ({
      id: round.id,
      roundName: round.roundName,
      status: round.status,
      statusLabel: round.statusLabel,
      startDate: round.startDate,
      endDate: round.endDate,
      minRaters: round.minRaters,
      templateName: round.templateName,
      targetTypes: round.targetTypes,
      assignmentCount: round.assignmentCount,
      submittedCount: round.submittedCount,
      pendingCount: round.pendingCount,
      released: round.released,
      releaseLabel: round.releaseLabel,
    })),
    selectedRoundId: selectedRound?.id,
    summary: {
      activeRounds: rounds.filter((round) => round.status === 'IN_PROGRESS').length,
      pendingAssignments: rounds.reduce(
        (sum, round) => sum + round.feedbacks.filter((feedback) => feedback.status !== 'SUBMITTED').length,
        0
      ),
      submittedAssignments: rounds.reduce(
        (sum, round) => sum + round.feedbacks.filter((feedback) => feedback.status === 'SUBMITTED').length,
        0
      ),
      releasedTargets: availableRounds.reduce((sum, round) => sum + round.releasedTargetCount, 0),
    },
  }

  if (params.mode === 'overview') {
    const assignments = await prisma.multiFeedback.findMany({
      where: {
        giverId: employee.id,
        round: {
          roundType: 'UPWARD',
          evalCycleId: selectedCycle.id,
        },
      },
      include: {
        round: {
          select: {
            id: true,
            roundName: true,
            endDate: true,
          },
        },
        receiver: {
          select: {
            id: true,
            empName: true,
            position: true,
            department: { select: { deptName: true } },
          },
        },
      },
      orderBy: [{ round: { endDate: 'asc' } }, { createdAt: 'asc' }],
    })

    return {
      ...baseData,
      overview: {
        assignments: assignments.map((feedback) => ({
          feedbackId: feedback.id,
          roundId: feedback.roundId,
          roundName: feedback.round.roundName,
          receiverId: feedback.receiverId,
          receiverName: feedback.receiver.empName,
          receiverDepartment: feedback.receiver.department.deptName,
          receiverPosition: getPositionLabel(feedback.receiver.position),
          relationship: feedback.relationship,
          status: feedback.status,
          statusLabel:
            feedback.status === 'PENDING'
              ? '미작성'
              : feedback.status === 'IN_PROGRESS'
                ? '초안'
                : '제출완료',
          dueDate: formatDate(feedback.round.endDate),
          href: `/evaluation/upward/respond/${encodeURIComponent(feedback.id)}?cycleId=${encodeURIComponent(selectedCycle.id)}&roundId=${encodeURIComponent(feedback.roundId)}`,
        })),
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
                questions: {
                  orderBy: [{ sortOrder: 'asc' }],
                },
              },
            },
            receiver: {
              select: {
                id: true,
                empName: true,
                position: true,
                department: { select: { deptName: true } },
              },
            },
            responses: true,
          },
        })
      : null

    if (!feedback || feedback.round.roundType !== 'UPWARD') {
      return {
        ...baseData,
        state: 'permission-denied',
        message: '상향 평가 응답을 찾을 수 없습니다.',
      }
    }

    if (feedback.giverId !== employee.id) {
      return {
        ...baseData,
        state: 'permission-denied',
        message: '이 상향 평가 응답을 작성할 권한이 없습니다.',
      }
    }

    const responseMap = new Map(feedback.responses.map((response) => [response.questionId, response]))
    const questions = feedback.round.questions
      .filter((question) => question.isActive)
      .map((question) => ({
        id: question.id,
        category: question.category,
        questionText: question.questionText,
        description: question.description,
        questionType: question.questionType,
        scaleMin: question.scaleMin,
        scaleMax: question.scaleMax,
        isRequired: question.isRequired,
        choiceOptions: parseChoiceOptions(question.choiceOptions),
        ratingValue: responseMap.get(question.id)?.ratingValue ?? null,
        textValue: responseMap.get(question.id)?.textValue ?? null,
      }))

    return {
      ...baseData,
      selectedRoundId: feedback.roundId,
      respond: {
        feedbackId: feedback.id,
        roundId: feedback.roundId,
        roundName: feedback.round.roundName,
        receiverId: feedback.receiverId,
        receiverName: feedback.receiver.empName,
        receiverDepartment: feedback.receiver.department.deptName,
        receiverPosition: getPositionLabel(feedback.receiver.position),
        relationship: feedback.relationship,
        status: feedback.status,
        readOnly: feedback.status === 'SUBMITTED' || feedback.round.status !== 'IN_PROGRESS',
        dueDate: formatDate(feedback.round.endDate),
        guidance: [
          '이 평가는 리더의 운영 방식과 리더십을 더 잘 이해하고 개선하기 위한 참고 자료로 활용됩니다.',
          '구체적인 관찰과 경험을 바탕으로 작성해 주세요.',
          '감정적 표현보다 사실과 행동 중심으로 작성해 주세요.',
          '익명 기준을 충족한 경우에만 결과가 공개됩니다.',
        ],
        overallComment: feedback.overallComment ?? '',
        questions,
      },
    }
  }

  if (params.mode === 'admin') {
    if (!baseData.permissions?.canManageRounds) {
      return {
        ...baseData,
        state: 'permission-denied',
        message: '상향 평가 관리자 운영 화면을 볼 권한이 없습니다.',
      }
    }

    const [templates, employeeDirectoryRows] = await Promise.all([
      prisma.upwardReviewTemplate.findMany({
        where: { orgId: employee.department.orgId },
        include: {
          questions: {
            orderBy: [{ sortOrder: 'asc' }],
          },
        },
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      }),
      prisma.employee.findMany({
        where: {
          department: { orgId: employee.department.orgId },
          status: 'ACTIVE',
        },
        select: {
          id: true,
          empName: true,
          role: true,
          position: true,
          deptId: true,
          jobTitle: true,
          teamName: true,
          teamLeaderId: true,
          sectionChiefId: true,
          divisionHeadId: true,
          department: { select: { deptName: true } },
        },
        orderBy: [{ empName: 'asc' }],
      }),
    ])

    const employeeDirectory = employeeDirectoryRows.map((employeeRow) => buildDirectoryEmployee(employeeRow))
    const suggestionRows =
      selectedRound && selectedRoundSettings
        ? buildUpwardSuggestions({
            employees: employeeDirectory,
            targetTypes: selectedRoundSettings.targetTypes,
            existingPairs: selectedRound.feedbacks.map((feedback) => ({
              evaluatorId: feedback.giverId,
              evaluateeId: feedback.receiverId,
            })),
          }).slice(0, 80)
        : []

    return {
      ...baseData,
      admin: {
        templates: templates.map((template) => ({
          id: template.id,
          name: template.name,
          description: template.description,
          isActive: template.isActive,
          defaultMinResponses: template.defaultMinResponses,
          defaultTargetTypes: (() => {
            const settings =
              template.defaultSettings && typeof template.defaultSettings === 'object'
                ? parseUpwardReviewSettings(template.defaultSettings)
                : null
            return (settings?.targetTypes ?? ['TEAM_LEADER']).map((type) => UPWARD_TARGET_TYPE_LABELS[type])
          })(),
          questionCount: template.questions.length,
          questions: template.questions.map((question) => ({
            id: question.id,
            category: question.category,
            questionText: question.questionText,
            description: question.description,
            questionType: question.questionType,
            scaleMin: question.scaleMin,
            scaleMax: question.scaleMax,
            isRequired: question.isRequired,
            isActive: question.isActive,
            choiceOptions: parseChoiceOptions(question.choiceOptions),
            sortOrder: question.sortOrder,
          })),
        })),
        selectedTemplateId: selectedRoundSettings?.templateId ?? templates[0]?.id,
        selectedRound: selectedRound
          ? {
              id: selectedRound.id,
              roundName: selectedRound.roundName,
              status: selectedRound.status,
              statusLabel: UPWARD_ROUND_STATUS_LABELS[selectedRound.status],
              startDate: selectedRound.startDate.toISOString(),
              endDate: selectedRound.endDate.toISOString(),
              templateId: selectedRoundSettings?.templateId,
              templateName: selectedRoundSettings?.templateName,
              targetTypes: (selectedRoundSettings?.targetTypes ?? []).map((type) => UPWARD_TARGET_TYPE_LABELS[type]),
              resultViewerMode:
                selectedRoundSettings?.resultViewerMode === 'TARGET_AND_PRIMARY_MANAGER'
                  ? '피평가자 + 1차 리더'
                  : '피평가자만',
              rawResponsePolicy:
                selectedRoundSettings?.rawResponsePolicy === 'REVIEW_ADMIN_CONTENT'
                  ? '콘텐츠 열람 권한 운영자'
                  : '관리자만',
              released: Boolean(selectedRoundSettings?.resultReleasedAt),
              assignments: selectedRound.feedbacks
                .slice()
                .sort((a, b) => a.receiver.empName.localeCompare(b.receiver.empName, 'ko'))
                .map((feedback) => ({
                  id: feedback.id,
                  evaluatorId: feedback.giverId,
                  evaluatorName: feedback.giver.empName,
                  evaluatorDepartment: feedback.giver.department.deptName,
                  evaluateeId: feedback.receiverId,
                  evaluateeName: feedback.receiver.empName,
                  evaluateeDepartment: feedback.receiver.department.deptName,
                  relationship: feedback.relationship,
                  status: feedback.status,
                  statusLabel: UPWARD_ASSIGNMENT_STATUS_LABELS[feedback.status],
                  submittedAt: formatDateTime(feedback.submittedAt),
                })),
              summaryCards: [
                { label: '배정 수', value: `${selectedRound.feedbacks.length}건` },
                {
                  label: '제출 수',
                  value: `${selectedRound.feedbacks.filter((feedback) => feedback.status === 'SUBMITTED').length}건`,
                },
                {
                  label: '미제출 수',
                  value: `${selectedRound.feedbacks.filter((feedback) => feedback.status !== 'SUBMITTED').length}건`,
                },
                {
                  label: '공개 가능 대상 수',
                  value: `${
                    Boolean(selectedRoundSettings?.resultReleasedAt)
                      ? Array.from(
                          selectedRound.feedbacks
                            .filter((feedback) => feedback.status === 'SUBMITTED')
                            .reduce((map, feedback) => {
                              const current = map.get(feedback.receiverId) ?? 0
                              map.set(feedback.receiverId, current + 1)
                              return map
                            }, new Map<string, number>())
                            .values()
                        ).filter((count) => count >= selectedRound.minRaters).length
                      : 0
                  }명`,
                },
              ],
            }
          : undefined,
        employeeDirectory,
        suggestions: suggestionRows.map((suggestion) => ({
          evaluatorId: suggestion.evaluatorId,
          evaluatorName: employeeDirectory.find((item) => item.id === suggestion.evaluatorId)?.empName ?? '알 수 없음',
          evaluateeId: suggestion.evaluateeId,
          evaluateeName: employeeDirectory.find((item) => item.id === suggestion.evaluateeId)?.empName ?? '알 수 없음',
          relationship: suggestion.relationship,
          reason: suggestion.reason,
        })),
      },
    }
  }

  const resultsRound = selectedRound
  if (!resultsRound) {
    return {
      ...baseData,
      state: 'empty',
      message: '확인할 상향 평가 결과가 없습니다.',
    }
  }

  const resultSettings = parseUpwardReviewSettings(resultsRound.documentSettings)
  const resultTargets = Array.from(
    resultsRound.feedbacks.reduce((map, feedback) => {
      if (!map.has(feedback.receiverId)) {
        map.set(feedback.receiverId, feedback.receiver)
      }
      return map
    }, new Map<string, (typeof resultsRound.feedbacks)[number]['receiver']>())
  ).map(([, receiver]) => receiver)

  const accessibleTargets = resultTargets.filter((target) =>
    canAccessUpwardResultShell({
      actorId: employee.id,
      targetId: target.id,
      targetPrimaryLeaderId: getPrimaryLeaderId({
        teamLeaderId: target.teamLeaderId,
        sectionChiefId: target.sectionChiefId,
        divisionHeadId: target.divisionHeadId,
      }),
      settings: resultSettings,
      canManage: canManageSelectedRound,
      canReadRaw: canReadSelectedRoundContent,
    })
  )

  if (!accessibleTargets.length) {
    return {
      ...baseData,
      state: 'permission-denied',
      message: '현재 열람할 수 있는 상향 평가 결과가 없습니다.',
    }
  }

  const selectedTarget =
    accessibleTargets.find((target) => target.id === params.empId) ??
    accessibleTargets.find((target) => target.id === employee.id) ??
    accessibleTargets[0]

  const submittedFeedbacks = resultsRound.feedbacks.filter(
    (feedback) => feedback.receiverId === selectedTarget.id && feedback.status === 'SUBMITTED'
  )
  const thresholdMet = submittedFeedbacks.length >= resultsRound.minRaters
  const visible = canViewUpwardResults({
    actorId: employee.id,
    actorRole: employee.role,
    targetId: selectedTarget.id,
    targetPrimaryLeaderId: getPrimaryLeaderId({
      teamLeaderId: selectedTarget.teamLeaderId,
      sectionChiefId: selectedTarget.sectionChiefId,
      divisionHeadId: selectedTarget.divisionHeadId,
    }),
    settings: resultSettings,
    thresholdMet,
    canManage: canManageSelectedRound,
    canReadRaw: canReadSelectedRoundContent,
  })

  const summarized = summarizeUpwardResults({
    submittedFeedbacks: submittedFeedbacks.map((feedback) => ({
      giverId: feedback.giverId,
      giverName: feedback.giver.empName,
      relationship: feedback.relationship,
      overallComment: feedback.overallComment,
      responses: feedback.responses.map((response) => ({
        questionId: response.questionId,
        ratingValue: response.ratingValue,
        textValue: response.textValue,
        question: {
          questionText: response.question.questionText,
          category: response.question.category,
          questionType: response.question.questionType,
          choiceOptions: response.question.choiceOptions,
        },
      })),
    })),
    questions: resultsRound.questions
      .filter((question) => question.isActive)
      .map((question) => ({
        id: question.id,
        category: question.category,
        questionText: question.questionText,
        questionType: question.questionType,
        choiceOptions: question.choiceOptions,
      })),
  })

  const rawResponsePolicyAllows =
    resultSettings.rawResponsePolicy === 'ADMIN_ONLY'
      ? reviewAdminAccess.isGlobalAdmin
      : canReadSelectedRoundContent || canManageSelectedRound

  await createAuditLog({
    userId: employee.id,
    action: 'UPWARD_REVIEW_RESULTS_VIEWED',
    entityType: 'MultiFeedbackRound',
    entityId: resultsRound.id,
    newValue: {
      roundId: resultsRound.id,
      targetRevieweeId: selectedTarget.id,
      visibilityMode: rawResponsePolicyAllows ? 'ADMIN_RAW' : visible ? 'AGGREGATED' : 'HIDDEN',
    },
  })

  return {
    ...baseData,
    selectedRoundId: resultsRound.id,
    results: {
      roundId: resultsRound.id,
      roundName: resultsRound.roundName,
      released: Boolean(resultSettings.resultReleasedAt),
      thresholdMet,
      minRaters: resultsRound.minRaters,
      feedbackCount: submittedFeedbacks.length,
      visible,
      canViewRaw: rawResponsePolicyAllows,
      hiddenReason: visible
        ? undefined
        : !resultSettings.resultReleasedAt
          ? '관리자가 아직 결과를 공개하지 않았습니다.'
          : `익명 기준 ${resultsRound.minRaters}명에 미달하여 결과를 공개할 수 없습니다.`,
      selectedTargetId: selectedTarget.id,
      targets: accessibleTargets.map((target) => {
        const feedbackCount = resultsRound.feedbacks.filter(
          (feedback) => feedback.receiverId === target.id && feedback.status === 'SUBMITTED'
        ).length
        const targetThresholdMet = feedbackCount >= resultsRound.minRaters
        const targetVisible = canViewUpwardResults({
          actorId: employee.id,
          actorRole: employee.role,
          targetId: target.id,
          targetPrimaryLeaderId: getPrimaryLeaderId({
            teamLeaderId: target.teamLeaderId,
            sectionChiefId: target.sectionChiefId,
            divisionHeadId: target.divisionHeadId,
          }),
          settings: resultSettings,
          thresholdMet: targetThresholdMet,
          canManage: canManageSelectedRound,
          canReadRaw: canReadSelectedRoundContent,
        })
        return {
          id: target.id,
          name: target.empName,
          department: target.department.deptName,
          position: getPositionLabel(target.position),
          feedbackCount,
          thresholdMet: targetThresholdMet,
          visible: targetVisible,
        }
      }),
      targetEmployee: {
        id: selectedTarget.id,
        name: selectedTarget.empName,
        department: selectedTarget.department.deptName,
        position: getPositionLabel(selectedTarget.position),
      },
      strengths: summarized.strengths,
      improvements: summarized.improvements,
      questionSummaries: visible || rawResponsePolicyAllows ? summarized.questionSummaries : [],
      rawResponses: rawResponsePolicyAllows ? summarized.rawResponses : [],
    },
  }
}
