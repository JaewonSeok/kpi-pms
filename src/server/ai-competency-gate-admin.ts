import type { AiCompetencyGateDecision, AiCompetencyGateStatus, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'
import { queueNotification } from '@/lib/notification-service'
import { AppError } from '@/lib/utils'
import {
  canGateStatusTransition,
  getGateDecisionLabel,
  getGateStatusLabel,
  getGateTrackLabel,
} from '@/lib/ai-competency-gate-config'
import {
  buildCaseSnapshotPayload,
  buildCurrentUser,
  buildCycleOption,
  buildEvidenceSummary,
  buildGuideLibrary,
  buildLatestReview,
  buildReviewCriteriaView,
  buildStatusCard,
  buildTimelineFromCase,
  canManageGate,
  canReviewGate,
  createGateSnapshot,
  ensureDefaultGuideEntries,
  ensureDefaultReviewTemplate,
  gateCaseInclude,
  loadEmployeeWithOrg,
  serializeCaseFormData,
  type AuthenticatedSession,
  type GateAssignmentRecord,
  updateAssignmentStatus,
  validateReviewDecision,
  writeGateDecisionHistory,
} from '@/server/ai-competency-gate-shared'
import type {
  AiCompetencyGateDecisionSubmitSchema,
  AiCompetencyGateReviewDraftSchema,
} from '@/lib/validations'
import type { z } from 'zod'

type ReviewDraftInput = z.infer<typeof import('@/lib/validations').AiCompetencyGateReviewDraftSchema>
type DecisionInput = z.infer<typeof import('@/lib/validations').AiCompetencyGateDecisionSubmitSchema>

export type AiCompetencyGateAdminPageData = {
  state: 'ready' | 'empty' | 'permission-denied' | 'error'
  currentUser?: ReturnType<typeof buildCurrentUser>
  cycleOptions: ReturnType<typeof buildCycleOption>[]
  evalCycleOptions: Array<{
    id: string
    name: string
    year: number
    organizationName: string
    linkedGateCycleId?: string
  }>
  selectedCycleId?: string
  selectedCycle?: {
    id: string
    evalCycleId: string
    cycleName: string
    year: number
    status: string
    submissionOpenAt?: string
    submissionCloseAt?: string
    reviewOpenAt?: string
    reviewCloseAt?: string
    resultPublishAt?: string
    promotionGateEnabled: boolean
    policyAcknowledgementText?: string
  }
  summary: {
    totalCount: number
    notStartedCount: number
    draftCount: number
    submittedCount: number
    reviewCount: number
    revisionRequestedCount: number
    passedCount: number
    failedCount: number
  }
  assignments: Array<{
    id: string
    caseId?: string
    employeeId: string
    employeeName: string
    departmentName: string
    reviewerName?: string
    status: string
    statusLabel: string
    trackLabel?: string
    title?: string
    submittedAt?: string
    decisionAt?: string
    revisionRound: number
  }>
  employeeOptions: Array<{ id: string; name: string; departmentName: string }>
  reviewerOptions: Array<{ id: string; name: string; departmentName: string }>
  guideLibrary: ReturnType<typeof buildGuideLibrary>
  canManageCycles: boolean
  canAssign: boolean
  canReview: boolean
  message?: string
}

export type AiCompetencyGateCaseReviewPageData = {
  state: 'ready' | 'permission-denied' | 'error'
  currentUser?: ReturnType<typeof buildCurrentUser>
  caseId?: string
  assignment?: {
    id: string
    employeeName: string
    departmentName: string
    reviewerName?: string
    status: string
    statusLabel: string
    revisionRound: number
    cycleName: string
    submittedAt?: string
  }
  statusCard?: ReturnType<typeof buildStatusCard>
  caseForm?: ReturnType<typeof serializeCaseFormData>
  evidenceItems: ReturnType<typeof buildEvidenceSummary>
  latestReview?: ReturnType<typeof buildLatestReview>
  timeline: ReturnType<typeof buildTimelineFromCase>
  reviewCriteria: ReturnType<typeof buildReviewCriteriaView>
  reviewDraft?: {
    reviewId?: string
    overallDecision?: AiCompetencyGateDecision
    overallComment: string
    nonRemediable: boolean
    items: Array<{
      criterionId: string
      decision?: AiCompetencyGateDecision
      comment: string
      requiredFix: string
    }>
  }
  canWriteReview: boolean
  message?: string
}

function assertReviewer(session: AuthenticatedSession) {
  if (!canReviewGate(session.user.role)) {
    throw new AppError(403, 'AI_COMPETENCY_GATE_REVIEW_FORBIDDEN', 'AI 역량평가 검토 권한이 없습니다.')
  }
}

function assertReviewTransition(from: AiCompetencyGateStatus, to: AiCompetencyGateStatus) {
  if (!canGateStatusTransition(from, to)) {
    throw new AppError(
      400,
      'AI_COMPETENCY_GATE_ILLEGAL_STATUS_TRANSITION',
      `허용되지 않는 상태 전이입니다. (${from} -> ${to})`
    )
  }
}

async function loadReviewAssignment(params: {
  session: AuthenticatedSession
  caseId: string
}) {
  const submissionCase = await prisma.aiCompetencyGateCase.findUnique({
    where: { id: params.caseId },
    include: {
      assignment: {
        include: {
          cycle: {
            include: {
              evalCycle: {
                include: { organization: true },
              },
            },
          },
          employee: {
            include: {
              department: true,
            },
          },
          submissionCase: {
            include: gateCaseInclude,
          },
        },
      },
    },
  })

  const assignment = submissionCase?.assignment as GateAssignmentRecord | null
  if (!assignment) {
    throw new AppError(404, 'AI_COMPETENCY_GATE_CASE_NOT_FOUND', '검토할 제출서를 찾을 수 없습니다.')
  }

  const isAssignedReviewer = assignment.reviewerId === params.session.user.id
  if (!canManageGate(params.session.user.role) && !isAssignedReviewer) {
    throw new AppError(403, 'AI_COMPETENCY_GATE_REVIEW_CASE_FORBIDDEN', '이 제출서를 검토할 권한이 없습니다.')
  }

  return assignment
}

async function ensureReviewDraft(params: {
  assignment: GateAssignmentRecord
  reviewerId: string
  reviewerName: string
}) {
  const template = await ensureDefaultReviewTemplate({
    cycleId: params.assignment.cycleId,
    actorId: params.reviewerId,
  })
  const revisionRound = params.assignment.currentRevisionRound

  const existing = await prisma.aiCompetencyGateReview.findFirst({
    where: {
      assignmentId: params.assignment.id,
      reviewerId: params.reviewerId,
      revisionRound,
    },
    include: {
      items: true,
      template: {
        include: {
          criteria: {
            orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
          },
        },
      },
    },
  })

  if (existing) {
    return { review: existing, template }
  }

  const review = await prisma.aiCompetencyGateReview.create({
    data: {
      assignmentId: params.assignment.id,
      caseId: params.assignment.submissionCase!.id,
      reviewerId: params.reviewerId,
      reviewerNameSnapshot: params.reviewerName,
      templateId: template.id,
      revisionRound,
      status: 'DRAFT',
    },
    include: {
      items: true,
      template: {
        include: {
          criteria: {
            orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
          },
        },
      },
    },
  })

  return { review, template }
}

export async function getAiCompetencyGateAdminPageData(params: {
  session: AuthenticatedSession
  cycleId?: string
}): Promise<AiCompetencyGateAdminPageData> {
  try {
    assertReviewer(params.session)
    const employee = await loadEmployeeWithOrg(params.session.user.id)
    if (!employee) {
      throw new AppError(403, 'AI_COMPETENCY_GATE_USER_NOT_FOUND', '사용자 정보를 찾을 수 없습니다.')
    }

    await ensureDefaultGuideEntries()

    const cycles = await prisma.aiCompetencyGateCycle.findMany({
      include: { evalCycle: true },
      orderBy: [{ evalCycle: { evalYear: 'desc' } }, { createdAt: 'desc' }],
    })
    const selectedCycle =
      cycles.find((cycle) => cycle.id === params.cycleId) ??
      cycles.find((cycle) => cycle.status === 'OPEN') ??
      cycles[0]

    const guideLibrary = buildGuideLibrary(
      await prisma.aiCompetencyGuideEntry.findMany({
        where: { isActive: true, cycleId: null },
        orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
      })
    )

    if (!selectedCycle) {
      return {
        state: 'empty',
        currentUser: buildCurrentUser(employee),
        cycleOptions: [],
        evalCycleOptions: [],
        summary: {
          totalCount: 0,
          notStartedCount: 0,
          draftCount: 0,
          submittedCount: 0,
          reviewCount: 0,
          revisionRequestedCount: 0,
          passedCount: 0,
          failedCount: 0,
        },
        assignments: [],
        employeeOptions: [],
        reviewerOptions: [],
        guideLibrary,
        canManageCycles: canManageGate(params.session.user.role),
        canAssign: canManageGate(params.session.user.role),
        canReview: true,
        message: '운영 중인 AI 역량평가 회차가 아직 없습니다.',
      }
    }

    const assignments = await prisma.aiCompetencyGateAssignment.findMany({
      where: canManageGate(params.session.user.role)
        ? { cycleId: selectedCycle.id }
        : { cycleId: selectedCycle.id, reviewerId: params.session.user.id },
      include: {
        submissionCase: {
          include: gateCaseInclude,
        },
      },
      orderBy: [{ updatedAt: 'desc' }, { employeeNameSnapshot: 'asc' }],
    })

    const [employeeOptions, reviewerOptions] = await Promise.all([
      canManageGate(params.session.user.role)
        ? prisma.employee.findMany({
            where: { status: 'ACTIVE' },
            include: { department: true },
            orderBy: [{ empName: 'asc' }],
          })
        : Promise.resolve([]),
      canManageGate(params.session.user.role)
        ? prisma.employee.findMany({
            where: {
              status: 'ACTIVE',
              role: { in: ['ROLE_TEAM_LEADER', 'ROLE_SECTION_CHIEF', 'ROLE_DIV_HEAD', 'ROLE_ADMIN', 'ROLE_CEO'] },
            },
            include: { department: true },
            orderBy: [{ empName: 'asc' }],
          })
        : Promise.resolve([]),
    ])
    const evalCycleOptions = canManageGate(params.session.user.role)
      ? await prisma.evalCycle.findMany({
          include: {
            organization: true,
            aiCompetencyGateCycle: true,
          },
          orderBy: [{ evalYear: 'desc' }, { cycleName: 'desc' }],
        })
      : []

    return {
      state: 'ready',
      currentUser: buildCurrentUser(employee),
      cycleOptions: cycles.map((cycle) => buildCycleOption(cycle)),
      evalCycleOptions: evalCycleOptions.map((cycle) => ({
        id: cycle.id,
        name: cycle.cycleName,
        year: cycle.evalYear,
        organizationName: cycle.organization.name,
        linkedGateCycleId: cycle.aiCompetencyGateCycle?.id,
      })),
      selectedCycleId: selectedCycle.id,
      selectedCycle: {
        id: selectedCycle.id,
        evalCycleId: selectedCycle.evalCycleId,
        cycleName: selectedCycle.cycleName,
        year: selectedCycle.evalCycle.evalYear,
        status: selectedCycle.status,
        submissionOpenAt: selectedCycle.submissionOpenAt?.toISOString(),
        submissionCloseAt: selectedCycle.submissionCloseAt?.toISOString(),
        reviewOpenAt: selectedCycle.reviewOpenAt?.toISOString(),
        reviewCloseAt: selectedCycle.reviewCloseAt?.toISOString(),
        resultPublishAt: selectedCycle.resultPublishAt?.toISOString(),
        promotionGateEnabled: selectedCycle.promotionGateEnabled,
        policyAcknowledgementText: selectedCycle.policyAcknowledgementText ?? undefined,
      },
      summary: {
        totalCount: assignments.length,
        notStartedCount: assignments.filter((item) => item.status === 'NOT_STARTED').length,
        draftCount: assignments.filter((item) => item.status === 'DRAFT').length,
        submittedCount: assignments.filter((item) => item.status === 'SUBMITTED' || item.status === 'RESUBMITTED').length,
        reviewCount: assignments.filter((item) => item.status === 'UNDER_REVIEW').length,
        revisionRequestedCount: assignments.filter((item) => item.status === 'REVISION_REQUESTED').length,
        passedCount: assignments.filter((item) => item.status === 'PASSED').length,
        failedCount: assignments.filter((item) => item.status === 'FAILED').length,
      },
      assignments: assignments.map((assignment) => ({
        id: assignment.id,
        caseId: assignment.submissionCase?.id,
        employeeId: assignment.employeeId,
        employeeName: assignment.employeeNameSnapshot,
        departmentName: assignment.departmentNameSnapshot,
        reviewerName: assignment.reviewerNameSnapshot ?? undefined,
        status: assignment.status,
        statusLabel: getGateStatusLabel(assignment.status),
        trackLabel: assignment.submissionCase?.track ? getGateTrackLabel(assignment.submissionCase.track) : undefined,
        title: assignment.submissionCase?.title ?? undefined,
        submittedAt: assignment.submittedAt?.toISOString(),
        decisionAt: assignment.decisionAt?.toISOString(),
        revisionRound: assignment.currentRevisionRound,
      })),
      employeeOptions: employeeOptions.map((item) => ({
        id: item.id,
        name: item.empName,
        departmentName: item.department?.deptName ?? '미지정',
      })),
      reviewerOptions: reviewerOptions.map((item) => ({
        id: item.id,
        name: item.empName,
        departmentName: item.department?.deptName ?? '미지정',
      })),
      guideLibrary,
      canManageCycles: canManageGate(params.session.user.role),
      canAssign: canManageGate(params.session.user.role),
      canReview: true,
    }
  } catch (error) {
    console.error('[ai-competency-gate-admin] getAiCompetencyGateAdminPageData', error)
    return {
      state: error instanceof AppError && error.statusCode === 403 ? 'permission-denied' : 'error',
      cycleOptions: [],
      evalCycleOptions: [],
      summary: {
        totalCount: 0,
        notStartedCount: 0,
        draftCount: 0,
        submittedCount: 0,
        reviewCount: 0,
        revisionRequestedCount: 0,
        passedCount: 0,
        failedCount: 0,
      },
      assignments: [],
      employeeOptions: [],
      reviewerOptions: [],
      guideLibrary: { guides: [], passExamples: [], failExamples: [], faqs: [] },
      canManageCycles: false,
      canAssign: false,
      canReview: false,
      message:
        error instanceof AppError ? error.message : '관리자 화면을 불러오는 중 문제가 발생했습니다.',
    }
  }
}

export async function getAiCompetencyGateCaseReviewPageData(params: {
  session: AuthenticatedSession
  caseId: string
}): Promise<AiCompetencyGateCaseReviewPageData> {
  try {
    assertReviewer(params.session)
    const employee = await loadEmployeeWithOrg(params.session.user.id)
    if (!employee) {
      throw new AppError(403, 'AI_COMPETENCY_GATE_USER_NOT_FOUND', '사용자 정보를 찾을 수 없습니다.')
    }
    const assignment = await loadReviewAssignment(params)
    const { review, template } = await ensureReviewDraft({
      assignment,
      reviewerId: params.session.user.id,
      reviewerName: params.session.user.name ?? employee.empName,
    })

    return {
      state: 'ready',
      currentUser: buildCurrentUser(employee),
      caseId: assignment.submissionCase?.id,
      assignment: {
        id: assignment.id,
        employeeName: assignment.employeeNameSnapshot,
        departmentName: assignment.departmentNameSnapshot,
        reviewerName: assignment.reviewerNameSnapshot ?? undefined,
        status: assignment.status,
        statusLabel: getGateStatusLabel(assignment.status),
        revisionRound: assignment.currentRevisionRound,
        cycleName: assignment.cycle.cycleName,
        submittedAt: assignment.submittedAt?.toISOString(),
      },
      statusCard: buildStatusCard(assignment),
      caseForm: serializeCaseFormData(assignment.submissionCase),
      evidenceItems: buildEvidenceSummary(assignment.submissionCase),
      latestReview: buildLatestReview(assignment.submissionCase),
      timeline: buildTimelineFromCase(assignment.submissionCase),
      reviewCriteria: buildReviewCriteriaView(template),
      reviewDraft: {
        reviewId: review.id,
        overallDecision: review.overallDecision ?? undefined,
        overallComment: review.overallComment ?? '',
        nonRemediable: review.nonRemediable,
        items: template.criteria.map((criterion) => {
          const saved = review.items.find((item) => item.criterionId === criterion.id)
          return {
            criterionId: criterion.id,
            decision: saved?.decision,
            comment: saved?.comment ?? '',
            requiredFix: saved?.requiredFix ?? '',
          }
        }),
      },
      canWriteReview: true,
    }
  } catch (error) {
    console.error('[ai-competency-gate-admin] getAiCompetencyGateCaseReviewPageData', error)
    return {
      state: error instanceof AppError && error.statusCode === 403 ? 'permission-denied' : 'error',
      evidenceItems: [],
      timeline: [],
      reviewCriteria: [],
      canWriteReview: false,
      message:
        error instanceof AppError ? error.message : '제출서 상세를 불러오는 중 문제가 발생했습니다.',
    }
  }
}

export async function startAiCompetencyGateReview(params: {
  session: AuthenticatedSession
  caseId: string
}) {
  const assignment = await loadReviewAssignment(params)
  const reviewerName = params.session.user.name ?? assignment.reviewerNameSnapshot ?? '검토자'
  const { review } = await ensureReviewDraft({
    assignment,
    reviewerId: params.session.user.id,
    reviewerName,
  })

  if (assignment.status === 'SUBMITTED' || assignment.status === 'RESUBMITTED') {
    await prisma.$transaction(async (tx) => {
      assertReviewTransition(assignment.status, 'UNDER_REVIEW')
      await updateAssignmentStatus({
        db: tx,
        assignmentId: assignment.id,
        nextStatus: 'UNDER_REVIEW',
        reviewStartedAt: new Date(),
      })
      await writeGateDecisionHistory({
        db: tx,
        assignmentId: assignment.id,
        caseId: assignment.submissionCase?.id,
        actorId: params.session.user.id,
        actorNameSnapshot: reviewerName,
        fromStatus: assignment.status,
        toStatus: 'UNDER_REVIEW',
        action: '검토 시작',
      })
    })
  }

  return {
    reviewId: review.id,
    status: 'UNDER_REVIEW',
    statusLabel: getGateStatusLabel('UNDER_REVIEW'),
  }
}

export async function saveAiCompetencyGateReviewDraft(params: {
  session: AuthenticatedSession
  input: ReviewDraftInput
}) {
  const assignment = await loadReviewAssignment({
    session: params.session,
    caseId: params.input.caseId,
  })
  const reviewerName = params.session.user.name ?? assignment.reviewerNameSnapshot ?? '검토자'
  const { review, template } = await ensureReviewDraft({
    assignment,
    reviewerId: params.session.user.id,
    reviewerName,
  })

  const itemPayload = params.input.items.map((item) => ({
    criterionId: item.criterionId,
    decision: item.decision,
    comment: item.comment,
    requiredFix: item.requiredFix ?? null,
  }))

  const updatedReview = await prisma.$transaction(async (tx) => {
    if (assignment.status === 'SUBMITTED' || assignment.status === 'RESUBMITTED') {
      assertReviewTransition(assignment.status, 'UNDER_REVIEW')
      await updateAssignmentStatus({
        db: tx,
        assignmentId: assignment.id,
        nextStatus: 'UNDER_REVIEW',
        reviewStartedAt: new Date(),
      })
      await writeGateDecisionHistory({
        db: tx,
        assignmentId: assignment.id,
        caseId: assignment.submissionCase?.id,
        actorId: params.session.user.id,
        actorNameSnapshot: reviewerName,
        fromStatus: assignment.status,
        toStatus: 'UNDER_REVIEW',
        action: '검토 시작',
      })
    }

    await tx.aiCompetencyGateReview.update({
      where: { id: review.id },
      data: {
        overallComment: params.input.overallComment,
        nonRemediable: params.input.nonRemediable,
        overallDecision: params.input.overallDecision ?? null,
        status: 'DRAFT',
      },
    })

    await tx.aiCompetencyGateReviewItem.deleteMany({
      where: { reviewId: review.id },
    })
    if (itemPayload.length) {
      await tx.aiCompetencyGateReviewItem.createMany({
        data: itemPayload.map((item) => ({
          reviewId: review.id,
          criterionId: item.criterionId,
          decision: item.decision,
          comment: item.comment,
          requiredFix: item.requiredFix,
        })),
      })
    }

    return tx.aiCompetencyGateReview.findUniqueOrThrow({
      where: { id: review.id },
      include: {
        items: true,
        template: {
          include: {
            criteria: {
              orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
            },
          },
        },
      },
    })
  })

  return {
    reviewId: updatedReview.id,
    saved: true,
    criteriaCount: template.criteria.length,
  }
}

export async function finalizeAiCompetencyGateDecision(params: {
  session: AuthenticatedSession
  input: DecisionInput
}) {
  const assignment = await loadReviewAssignment({
    session: params.session,
    caseId: params.input.caseId,
  })
  const reviewerName = params.session.user.name ?? assignment.reviewerNameSnapshot ?? '검토자'
  const { review, template } = await ensureReviewDraft({
    assignment,
    reviewerId: params.session.user.id,
    reviewerName,
  })

  validateReviewDecision({
    criteria: template.criteria,
    items: params.input.items,
    action: params.input.action,
    nonRemediable: params.input.nonRemediable,
  })

  const nextStatus: AiCompetencyGateStatus =
    params.input.action === 'PASS'
      ? 'PASSED'
      : params.input.action === 'FAIL'
        ? 'FAILED'
        : 'REVISION_REQUESTED'

  const updated = await prisma.$transaction(async (tx) => {
    let currentStatus = assignment.status
    if (currentStatus === 'SUBMITTED' || currentStatus === 'RESUBMITTED') {
      assertReviewTransition(currentStatus, 'UNDER_REVIEW')
      await updateAssignmentStatus({
        db: tx,
        assignmentId: assignment.id,
        nextStatus: 'UNDER_REVIEW',
        reviewStartedAt: new Date(),
      })
      await writeGateDecisionHistory({
        db: tx,
        assignmentId: assignment.id,
        caseId: assignment.submissionCase?.id,
        actorId: params.session.user.id,
        actorNameSnapshot: reviewerName,
        fromStatus: currentStatus,
        toStatus: 'UNDER_REVIEW',
        action: '寃???쒖옉',
      })
      currentStatus = 'UNDER_REVIEW'
    }

    assertReviewTransition(currentStatus, nextStatus)
    await tx.aiCompetencyGateReview.update({
      where: { id: review.id },
      data: {
        status: 'SUBMITTED',
        overallDecision: params.input.action,
        overallComment: params.input.overallComment,
        nonRemediable: params.input.nonRemediable,
        reviewedAt: new Date(),
      },
    })

    await tx.aiCompetencyGateReviewItem.deleteMany({
      where: { reviewId: review.id },
    })
    await tx.aiCompetencyGateReviewItem.createMany({
      data: params.input.items.map((item) => ({
        reviewId: review.id,
        criterionId: item.criterionId,
        decision: item.decision,
        comment: item.comment,
        requiredFix: item.requiredFix ?? null,
      })),
    })

    const revisionRound =
      nextStatus === 'REVISION_REQUESTED'
        ? assignment.currentRevisionRound + 1
        : assignment.currentRevisionRound

    const assignmentAfter = await updateAssignmentStatus({
      db: tx,
      assignmentId: assignment.id,
      nextStatus,
      decisionAt: nextStatus === 'PASSED' || nextStatus === 'FAILED' ? new Date() : null,
      currentRevisionRound: revisionRound,
    })

    await writeGateDecisionHistory({
      db: tx,
      assignmentId: assignment.id,
      caseId: assignment.submissionCase?.id,
      actorId: params.session.user.id,
      actorNameSnapshot: reviewerName,
      fromStatus: currentStatus,
      toStatus: nextStatus,
      action:
        nextStatus === 'PASSED' ? '최종 통과' : nextStatus === 'FAILED' ? '최종 Fail' : '보완 요청',
      comment: params.input.overallComment,
    })

    const snapshotType =
      nextStatus === 'REVISION_REQUESTED' ? 'REVISION_REQUEST' : 'FINAL_DECISION'

    await createGateSnapshot({
      db: tx,
      assignmentId: assignment.id,
      caseId: assignment.submissionCase!.id,
      snapshotType,
      revisionRound: assignmentAfter.currentRevisionRound,
      payload: buildCaseSnapshotPayload({
        assignment: {
          ...(assignment as GateAssignmentRecord),
          status: assignmentAfter.status,
          currentRevisionRound: assignmentAfter.currentRevisionRound,
          decisionAt: assignmentAfter.decisionAt,
          updatedAt: assignmentAfter.updatedAt,
        } as GateAssignmentRecord,
        caseRecord: assignment.submissionCase!,
        actorId: params.session.user.id,
        actorName: reviewerName,
      }) as Prisma.JsonObject,
      createdById: params.session.user.id,
      createdByNameSnapshot: reviewerName,
    })

    return assignmentAfter
  })

  await createAuditLog({
    userId: params.session.user.id,
    action: 'FINALIZE_AI_COMPETENCY_GATE_DECISION',
    entityType: 'AiCompetencyGateReview',
    entityId: review.id,
    newValue: {
      caseId: params.input.caseId,
      action: params.input.action,
      nextStatus,
    },
  })

  await queueNotification({
    recipientId: assignment.employeeId,
    type: 'SYSTEM',
    sourceType: 'AiCompetencyGateDecision',
    sourceId: review.id,
    dedupeToken: `decision:${review.id}:${nextStatus}:${updated.updatedAt.toISOString()}`,
    payload: {
      title:
        nextStatus === 'REVISION_REQUESTED'
          ? 'AI 역량평가 보완 요청이 등록되었습니다.'
          : nextStatus === 'PASSED'
            ? 'AI 역량평가 결과가 통과로 확정되었습니다.'
            : 'AI 역량평가 결과가 미통과로 확정되었습니다.',
      body: params.input.overallComment,
      link: '/evaluation/ai-competency',
    },
    channels: ['IN_APP'],
  })

  return {
    status: nextStatus,
    statusLabel: getGateStatusLabel(nextStatus),
    decisionLabel: getGateDecisionLabel(params.input.action),
  }
}
