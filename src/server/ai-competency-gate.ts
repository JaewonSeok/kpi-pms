import type {
  AiCompetencyGateDecision,
  AiCompetencyGateEvidenceType,
  AiCompetencyGateStatus,
  AiCompetencyGateTrack,
  Prisma,
  SystemRole,
} from '@prisma/client'
import type { z } from 'zod'
import * as XLSX from 'xlsx'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'
import { queueNotification } from '@/lib/notification-service'
import { AppError } from '@/lib/utils'
import type {
  AiCompetencyGateAssignmentUpsertSchema,
  AiCompetencyGateCycleUpsertSchema,
  AiCompetencyGateDraftSchema,
} from '@/lib/validations'
import {
  AI_COMPETENCY_GATE_VISIBLE_STATUS_LABELS,
  canGateStatusTransition,
  canEmployeeEditGateCase,
  getGateTrackLabel,
  getGateStatusLabel,
} from '@/lib/ai-competency-gate-config'
import {
  assertHasEmployeeContext,
  buildCaseSnapshotPayload,
  buildCurrentUser,
  buildCycleOption,
  buildEvidenceSummary,
  buildGuideLibrary,
  buildLatestReview,
  buildReviewCriteriaView,
  buildStatusCard,
  buildTimelineFromCase,
  canManageGate as canManageGateRole,
  canReviewGate as canReviewGateRole,
  createGateSnapshot,
  emptyCaseFormData,
  ensureDefaultGuideEntries,
  ensureDefaultReviewTemplate,
  gateCaseInclude,
  loadEmployeeWithOrg,
  resolveVisibleStatus,
  serializeCaseFormData,
  toIso,
  type AiCompetencyGateCaseFormData,
  type AiCompetencyGateCycleOption,
  type AuthenticatedSession,
  type GateAssignmentRecord,
  type GateCaseRecord,
  type ReviewTemplateRecord,
  updateAssignmentStatus,
  validateCaseReadiness,
  writeGateDecisionHistory,
} from '@/server/ai-competency-gate-shared'

type CycleUpsertInput = z.infer<typeof import('@/lib/validations').AiCompetencyGateCycleUpsertSchema>
type AssignmentUpsertInput = z.infer<typeof import('@/lib/validations').AiCompetencyGateAssignmentUpsertSchema>
type DraftInput = z.infer<typeof import('@/lib/validations').AiCompetencyGateDraftSchema>

export type AiCompetencyGateEvidenceItemView = ReturnType<typeof buildEvidenceSummary>[number]

export type AiCompetencyGateEmployeePageData = {
  state: 'ready' | 'empty' | 'permission-denied' | 'error'
  currentUser?: ReturnType<typeof buildCurrentUser>
  cycleOptions: AiCompetencyGateCycleOption[]
  selectedCycleId?: string
  selectedCycle?: {
    id: string
    cycleName: string
    evalCycleId: string
    year: number
    statusLabel: string
    submissionWindowLabel?: string
    reviewWindowLabel?: string
    resultPublishLabel?: string
  }
  statusCard?: ReturnType<typeof buildStatusCard>
  message?: string
  alerts?: Array<{ title: string; description: string }>
  guideLibrary: ReturnType<typeof buildGuideLibrary>
  caseForm: AiCompetencyGateCaseFormData
  evidenceItems: AiCompetencyGateEvidenceItemView[]
  latestReview?: ReturnType<typeof buildLatestReview>
  timeline: ReturnType<typeof buildTimelineFromCase>
  reviewCriteria: ReturnType<typeof buildReviewCriteriaView>
  assignmentId?: string
  reviewerComment?: string
  canOpenAdmin: boolean
}

type EvidenceUploadInput = {
  assignmentId: string
  evidenceType: AiCompetencyGateEvidenceType
  title: string
  description?: string
  linkUrl?: string
  textNote?: string
  file?: {
    fileName: string
    mimeType: string
    sizeBytes: number
    buffer: Uint8Array<ArrayBuffer>
  }
}

function assertManager(role: SystemRole) {
  if (!canManageGateRole(role)) {
    throw new AppError(403, 'AI_COMPETENCY_GATE_ADMIN_ONLY', '관리자만 처리할 수 있습니다.')
  }
}

function assertEmployeeEditable(assignment: GateAssignmentRecord) {
  if (!canEmployeeEditGateCase(assignment.status)) {
    throw new AppError(403, 'AI_COMPETENCY_GATE_READ_ONLY', '현재 상태에서는 제출서를 수정할 수 없습니다.')
  }
  if (assignment.cycle.status === 'CLOSED') {
    throw new AppError(403, 'AI_COMPETENCY_GATE_CLOSED', '마감된 회차는 수정할 수 없습니다.')
  }
}

function parseOptionalDate(value?: string | null) {
  if (!value) return null
  return new Date(value)
}

function assertStatusTransition(from: AiCompetencyGateStatus, to: AiCompetencyGateStatus) {
  if (!canGateStatusTransition(from, to)) {
    throw new AppError(
      400,
      'AI_COMPETENCY_GATE_ILLEGAL_STATUS_TRANSITION',
      `허용되지 않는 상태 전이입니다. (${from} -> ${to})`
    )
  }
}

async function loadAssignmentForEmployee(params: {
  session: AuthenticatedSession
  assignmentId: string
}) {
  const assignment = await prisma.aiCompetencyGateAssignment.findUnique({
    where: { id: params.assignmentId },
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
  })

  if (!assignment || assignment.employeeId !== params.session.user.id) {
    throw new AppError(404, 'AI_COMPETENCY_GATE_ASSIGNMENT_NOT_FOUND', 'AI 역량평가 대상 정보를 찾을 수 없습니다.')
  }

  return assignment as GateAssignmentRecord
}

function buildCycleWindowLabel(cycle: {
  submissionOpenAt: Date | null
  submissionCloseAt: Date | null
  reviewOpenAt: Date | null
  reviewCloseAt: Date | null
  resultPublishAt: Date | null
}) {
  return {
    submissionWindowLabel:
      cycle.submissionOpenAt || cycle.submissionCloseAt
        ? `${cycle.submissionOpenAt ? cycle.submissionOpenAt.toLocaleDateString('ko-KR') : '-'} ~ ${cycle.submissionCloseAt ? cycle.submissionCloseAt.toLocaleDateString('ko-KR') : '-'}`
        : undefined,
    reviewWindowLabel:
      cycle.reviewOpenAt || cycle.reviewCloseAt
        ? `${cycle.reviewOpenAt ? cycle.reviewOpenAt.toLocaleDateString('ko-KR') : '-'} ~ ${cycle.reviewCloseAt ? cycle.reviewCloseAt.toLocaleDateString('ko-KR') : '-'}`
        : undefined,
    resultPublishLabel: cycle.resultPublishAt?.toLocaleDateString('ko-KR'),
  }
}

async function syncCaseDraft(params: {
  db: Prisma.TransactionClient
  assignmentId: string
  input: DraftInput
}) {
  const payload = params.input
  const caseRecord = await params.db.aiCompetencyGateCase.upsert({
    where: { assignmentId: params.assignmentId },
    update: {
      track: payload.track,
      title: payload.title,
      problemStatement: payload.problemStatement,
      importanceReason: payload.importanceReason,
      goalStatement: payload.goalStatement,
      scopeDescription: payload.scopeDescription,
      ownerRoleDescription: payload.ownerRoleDescription,
      beforeWorkflow: payload.beforeWorkflow,
      afterWorkflow: payload.afterWorkflow,
      impactSummary: payload.impactSummary,
      teamOrganizationAdoption: payload.teamOrganizationAdoption,
      reusableOutputSummary: payload.reusableOutputSummary,
      humanReviewControl: payload.humanReviewControl,
      factCheckMethod: payload.factCheckMethod,
      securityEthicsPrivacyHandling: payload.securityEthicsPrivacyHandling,
      sharingExpansionActivity: payload.sharingExpansionActivity,
      toolList: payload.toolList,
      approvedToolBasis: payload.approvedToolBasis,
      sensitiveDataHandling: payload.sensitiveDataHandling,
      maskingAnonymizationHandling: payload.maskingAnonymizationHandling,
      prohibitedAutomationAcknowledged: payload.prohibitedAutomationAcknowledged,
      finalDeclarationAccepted: payload.finalDeclarationAccepted,
      lastSavedAt: new Date(),
    },
    create: {
      assignmentId: params.assignmentId,
      track: payload.track,
      title: payload.title,
      problemStatement: payload.problemStatement,
      importanceReason: payload.importanceReason,
      goalStatement: payload.goalStatement,
      scopeDescription: payload.scopeDescription,
      ownerRoleDescription: payload.ownerRoleDescription,
      beforeWorkflow: payload.beforeWorkflow,
      afterWorkflow: payload.afterWorkflow,
      impactSummary: payload.impactSummary,
      teamOrganizationAdoption: payload.teamOrganizationAdoption,
      reusableOutputSummary: payload.reusableOutputSummary,
      humanReviewControl: payload.humanReviewControl,
      factCheckMethod: payload.factCheckMethod,
      securityEthicsPrivacyHandling: payload.securityEthicsPrivacyHandling,
      sharingExpansionActivity: payload.sharingExpansionActivity,
      toolList: payload.toolList,
      approvedToolBasis: payload.approvedToolBasis,
      sensitiveDataHandling: payload.sensitiveDataHandling,
      maskingAnonymizationHandling: payload.maskingAnonymizationHandling,
      prohibitedAutomationAcknowledged: payload.prohibitedAutomationAcknowledged,
      finalDeclarationAccepted: payload.finalDeclarationAccepted,
      lastSavedAt: new Date(),
    },
    include: gateCaseInclude,
  })

  await params.db.aiCompetencyGateMetric.deleteMany({
    where: {
      caseId: caseRecord.id,
      ...(payload.metrics.length
        ? {
            id: {
              notIn: payload.metrics
                .map((item) => item.id)
                .filter((value): value is string => typeof value === 'string' && value.length > 0),
            },
          }
        : {}),
    },
  })

  for (const metric of payload.metrics) {
    if (metric.id) {
      await params.db.aiCompetencyGateMetric.update({
        where: { id: metric.id },
        data: {
          metricName: metric.metricName,
          beforeValue: metric.beforeValue,
          afterValue: metric.afterValue,
          unit: metric.unit,
          verificationMethod: metric.verificationMethod,
          displayOrder: metric.displayOrder,
        },
      })
    } else {
      await params.db.aiCompetencyGateMetric.create({
        data: {
          caseId: caseRecord.id,
          metricName: metric.metricName,
          beforeValue: metric.beforeValue,
          afterValue: metric.afterValue,
          unit: metric.unit,
          verificationMethod: metric.verificationMethod,
          displayOrder: metric.displayOrder,
        },
      })
    }
  }

  await params.db.aiCompetencyGateProjectDetail.upsert({
    where: { caseId: caseRecord.id },
    update: {
      projectBackground: payload.projectDetail.projectBackground,
      stakeholders: payload.projectDetail.stakeholders,
      executionSteps: payload.projectDetail.executionSteps,
      deliverables: payload.projectDetail.deliverables,
      projectStartedAt: parseOptionalDate(payload.projectDetail.projectStartedAt),
      projectEndedAt: parseOptionalDate(payload.projectDetail.projectEndedAt),
      ownerPmRoleDetail: payload.projectDetail.ownerPmRoleDetail,
      contributionSummary: payload.projectDetail.contributionSummary,
    },
    create: {
      caseId: caseRecord.id,
      projectBackground: payload.projectDetail.projectBackground,
      stakeholders: payload.projectDetail.stakeholders,
      executionSteps: payload.projectDetail.executionSteps,
      deliverables: payload.projectDetail.deliverables,
      projectStartedAt: parseOptionalDate(payload.projectDetail.projectStartedAt),
      projectEndedAt: parseOptionalDate(payload.projectDetail.projectEndedAt),
      ownerPmRoleDetail: payload.projectDetail.ownerPmRoleDetail,
      contributionSummary: payload.projectDetail.contributionSummary,
    },
  })

  await params.db.aiCompetencyGateAdoptionDetail.upsert({
    where: { caseId: caseRecord.id },
    update: {
      useCaseDescription: payload.adoptionDetail.useCaseDescription,
      teamDivisionScope: payload.adoptionDetail.teamDivisionScope,
      repeatedUseExamples: payload.adoptionDetail.repeatedUseExamples,
      measuredEffectDetail: payload.adoptionDetail.measuredEffectDetail,
      seminarSharingEvidence: payload.adoptionDetail.seminarSharingEvidence,
      organizationExpansionDetail: payload.adoptionDetail.organizationExpansionDetail,
    },
    create: {
      caseId: caseRecord.id,
      useCaseDescription: payload.adoptionDetail.useCaseDescription,
      teamDivisionScope: payload.adoptionDetail.teamDivisionScope,
      repeatedUseExamples: payload.adoptionDetail.repeatedUseExamples,
      measuredEffectDetail: payload.adoptionDetail.measuredEffectDetail,
      seminarSharingEvidence: payload.adoptionDetail.seminarSharingEvidence,
      organizationExpansionDetail: payload.adoptionDetail.organizationExpansionDetail,
    },
  })

  return params.db.aiCompetencyGateCase.findUniqueOrThrow({
    where: { id: caseRecord.id },
    include: gateCaseInclude,
  }) as Promise<GateCaseRecord>
}

export async function getAiCompetencyGatePageData(params: {
  session: AuthenticatedSession
  cycleId?: string
}): Promise<AiCompetencyGateEmployeePageData> {
  try {
    const employee = await loadEmployeeWithOrg(params.session.user.id)
    assertHasEmployeeContext(employee)
    await ensureDefaultGuideEntries()

    const cycles = await prisma.aiCompetencyGateCycle.findMany({
      include: { evalCycle: true },
      orderBy: [{ evalCycle: { evalYear: 'desc' } }, { createdAt: 'desc' }],
    })

    const selectedCycle =
      cycles.find((cycle) => cycle.id === params.cycleId) ??
      cycles.find((cycle) => cycle.status === 'OPEN') ??
      cycles[0]

    const cycleOptions = cycles.map((cycle) => buildCycleOption(cycle))
    const guideLibrary = buildGuideLibrary(
      await prisma.aiCompetencyGuideEntry.findMany({
        where: {
          isActive: true,
          OR: [{ cycleId: null }, selectedCycle ? { cycleId: selectedCycle.id } : undefined].filter(Boolean) as Prisma.AiCompetencyGuideEntryWhereInput[],
        },
        orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
      })
    )

    if (!selectedCycle) {
      return {
        state: 'empty',
        currentUser: buildCurrentUser(employee),
        cycleOptions,
        message: '운영 중인 AI 역량평가 회차가 아직 없습니다.',
        guideLibrary,
        caseForm: emptyCaseFormData(),
        evidenceItems: [],
        timeline: [],
        reviewCriteria: [],
        canOpenAdmin: canManageGateRole(params.session.user.role) || canReviewGateRole(params.session.user.role),
      }
    }

    const assignment = await prisma.aiCompetencyGateAssignment.findUnique({
      where: {
        cycleId_employeeId: {
          cycleId: selectedCycle.id,
          employeeId: employee.id,
        },
      },
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
    }) as GateAssignmentRecord | null

    const template = await ensureDefaultReviewTemplate({
      cycleId: selectedCycle.id,
      actorId: params.session.user.id,
    })

    return {
      state: 'ready',
      currentUser: buildCurrentUser(employee),
      cycleOptions,
      selectedCycleId: selectedCycle.id,
      selectedCycle: {
        id: selectedCycle.id,
        cycleName: selectedCycle.cycleName,
        evalCycleId: selectedCycle.evalCycleId,
        year: selectedCycle.evalCycle.evalYear,
        statusLabel: selectedCycle.status,
        ...buildCycleWindowLabel(selectedCycle),
      },
      statusCard: assignment ? buildStatusCard(assignment) : undefined,
      message: assignment ? undefined : '현재 선택한 회차에서 아직 AI 역량평가 대상자로 배정되지 않았습니다.',
      guideLibrary,
      caseForm: serializeCaseFormData(assignment?.submissionCase),
      evidenceItems: buildEvidenceSummary(assignment?.submissionCase),
      latestReview: buildLatestReview(assignment?.submissionCase),
      timeline: buildTimelineFromCase(assignment?.submissionCase),
      reviewCriteria: buildReviewCriteriaView(template),
      assignmentId: assignment?.id,
      reviewerComment: assignment?.submissionCase?.reviews[0]?.overallComment ?? undefined,
      canOpenAdmin: canManageGateRole(params.session.user.role) || canReviewGateRole(params.session.user.role),
    }
  } catch (error) {
    console.error('[ai-competency-gate] getAiCompetencyGatePageData', error)
    return {
      state: error instanceof AppError && error.statusCode === 403 ? 'permission-denied' : 'error',
      cycleOptions: [],
      guideLibrary: { guides: [], passExamples: [], failExamples: [], faqs: [] },
      caseForm: emptyCaseFormData(),
      evidenceItems: [],
      timeline: [],
      reviewCriteria: [],
      canOpenAdmin: false,
      message: 'AI 역량평가 화면을 불러오는 중 문제가 발생했습니다.',
    }
  }
}

export async function upsertAiCompetencyGateCycle(params: {
  session: AuthenticatedSession
  input: CycleUpsertInput
}) {
  assertManager(params.session.user.role)

  const evalCycle = await prisma.evalCycle.findUnique({
    where: { id: params.input.evalCycleId },
  })
  if (!evalCycle) {
    throw new AppError(404, 'AI_COMPETENCY_GATE_EVAL_CYCLE_NOT_FOUND', '연결할 평가 주기를 찾을 수 없습니다.')
  }

  const cycle = await prisma.aiCompetencyGateCycle.upsert({
    where: { evalCycleId: params.input.evalCycleId },
    update: {
      cycleName: params.input.cycleName,
      status: params.input.status,
      submissionOpenAt: parseOptionalDate(params.input.submissionOpenAt),
      submissionCloseAt: parseOptionalDate(params.input.submissionCloseAt),
      reviewOpenAt: parseOptionalDate(params.input.reviewOpenAt),
      reviewCloseAt: parseOptionalDate(params.input.reviewCloseAt),
      resultPublishAt: parseOptionalDate(params.input.resultPublishAt),
      closedAt: params.input.status === 'CLOSED' ? new Date() : null,
      promotionGateEnabled: params.input.promotionGateEnabled,
      policyAcknowledgementText: params.input.policyAcknowledgementText,
      updatedById: params.session.user.id,
    },
    create: {
      evalCycleId: params.input.evalCycleId,
      cycleName: params.input.cycleName,
      status: params.input.status,
      submissionOpenAt: parseOptionalDate(params.input.submissionOpenAt),
      submissionCloseAt: parseOptionalDate(params.input.submissionCloseAt),
      reviewOpenAt: parseOptionalDate(params.input.reviewOpenAt),
      reviewCloseAt: parseOptionalDate(params.input.reviewCloseAt),
      resultPublishAt: parseOptionalDate(params.input.resultPublishAt),
      closedAt: params.input.status === 'CLOSED' ? new Date() : null,
      promotionGateEnabled: params.input.promotionGateEnabled,
      policyAcknowledgementText: params.input.policyAcknowledgementText,
      createdById: params.session.user.id,
      updatedById: params.session.user.id,
    },
    include: {
      evalCycle: true,
    },
  })

  await ensureDefaultGuideEntries()
  await ensureDefaultReviewTemplate({
    cycleId: cycle.id,
    actorId: params.session.user.id,
  })

  await createAuditLog({
    userId: params.session.user.id,
    action: 'UPSERT_AI_COMPETENCY_GATE_CYCLE',
    entityType: 'AiCompetencyGateCycle',
    entityId: cycle.id,
    newValue: {
      cycleName: cycle.cycleName,
      status: cycle.status,
      evalCycleId: cycle.evalCycleId,
    },
  })

  return {
    id: cycle.id,
    cycleName: cycle.cycleName,
    evalCycleId: cycle.evalCycleId,
    status: cycle.status,
  }
}

export async function upsertAiCompetencyGateAssignment(params: {
  session: AuthenticatedSession
  input: AssignmentUpsertInput
}) {
  assertManager(params.session.user.role)

  const [cycle, employee, reviewer] = await Promise.all([
    prisma.aiCompetencyGateCycle.findUnique({ where: { id: params.input.cycleId } }),
    prisma.employee.findUnique({
      where: { id: params.input.employeeId },
      include: { department: true },
    }),
    params.input.reviewerId
      ? prisma.employee.findUnique({
          where: { id: params.input.reviewerId },
        })
      : Promise.resolve(null),
  ])

  if (!cycle || !employee?.department) {
    throw new AppError(404, 'AI_COMPETENCY_GATE_ASSIGNMENT_TARGET_NOT_FOUND', '배정 대상 정보를 찾을 수 없습니다.')
  }
  if (params.input.reviewerId && !reviewer) {
    throw new AppError(404, 'AI_COMPETENCY_GATE_REVIEWER_NOT_FOUND', '검토자를 찾을 수 없습니다.')
  }

  const assignment = await prisma.aiCompetencyGateAssignment.upsert({
    where: {
      cycleId_employeeId: {
        cycleId: params.input.cycleId,
        employeeId: params.input.employeeId,
      },
    },
    update: {
      reviewerId: params.input.reviewerId ?? null,
      reviewerNameSnapshot: reviewer?.empName ?? null,
      adminNote: params.input.adminNote ?? null,
    },
    create: {
      cycleId: params.input.cycleId,
      employeeId: params.input.employeeId,
      reviewerId: params.input.reviewerId ?? null,
      employeeNameSnapshot: employee.empName,
      departmentNameSnapshot: employee.department.deptName,
      positionSnapshot: employee.position ?? 'MEMBER',
      reviewerNameSnapshot: reviewer?.empName ?? null,
      adminNote: params.input.adminNote ?? null,
    },
  })

  await writeGateDecisionHistory({
    db: prisma,
    assignmentId: assignment.id,
    actorId: params.session.user.id,
    actorNameSnapshot: params.session.user.name ?? '관리자',
    fromStatus: undefined,
    toStatus: assignment.status,
    action: '배정 생성/수정',
    comment: params.input.adminNote ?? null,
  })

  await queueNotification({
    recipientId: assignment.employeeId,
    type: 'SYSTEM',
    sourceType: 'AiCompetencyGateAssignment',
    sourceId: assignment.id,
    dedupeToken: `assignment:${assignment.id}:${assignment.updatedAt.toISOString()}`,
    payload: {
      title: 'AI 역량평가 대상자로 배정되었습니다.',
      body: `${cycle.cycleName} 회차에서 AI 역량평가 제출서를 작성할 수 있습니다.`,
      link: '/evaluation/ai-competency',
    },
    channels: ['IN_APP'],
  })

  return {
    id: assignment.id,
    status: assignment.status,
    statusLabel: getGateStatusLabel(assignment.status),
  }
}

export async function saveAiCompetencyGateDraft(params: {
  session: AuthenticatedSession
  input: DraftInput
}) {
  const assignment = await loadAssignmentForEmployee({
    session: params.session,
    assignmentId: params.input.assignmentId,
  })
  assertEmployeeEditable(assignment)

  const actorName = params.session.user.name ?? assignment.employeeNameSnapshot
    const result = await prisma.$transaction(async (tx) => {
      const caseRecord = await syncCaseDraft({
        db: tx,
        assignmentId: assignment.id,
        input: params.input,
      })

      if (assignment.status === 'NOT_STARTED') {
        assertStatusTransition('NOT_STARTED', 'DRAFT')
        await updateAssignmentStatus({
          db: tx,
          assignmentId: assignment.id,
          nextStatus: 'DRAFT',
      })
      await writeGateDecisionHistory({
        db: tx,
        assignmentId: assignment.id,
        caseId: caseRecord.id,
        actorId: params.session.user.id,
        actorNameSnapshot: actorName,
        fromStatus: 'NOT_STARTED',
        toStatus: 'DRAFT',
        action: '초안 저장',
      })
    }

    return caseRecord
  })

  return {
    assignmentId: assignment.id,
    status: assignment.status === 'NOT_STARTED' ? 'DRAFT' : assignment.status,
    statusLabel: getGateStatusLabel(assignment.status === 'NOT_STARTED' ? 'DRAFT' : assignment.status),
    caseForm: serializeCaseFormData(result),
    evidenceItems: buildEvidenceSummary(result),
    timeline: buildTimelineFromCase(result),
  }
}

export async function uploadAiCompetencyGateEvidence(params: {
  session: AuthenticatedSession
  input: EvidenceUploadInput
}) {
  const assignment = await loadAssignmentForEmployee({
    session: params.session,
    assignmentId: params.input.assignmentId,
  })
  assertEmployeeEditable(assignment)

  if (!params.input.file && !params.input.linkUrl?.trim() && !params.input.textNote?.trim()) {
    throw new AppError(400, 'AI_COMPETENCY_GATE_EVIDENCE_EMPTY', '파일, 링크, 설명 중 하나 이상을 등록해 주세요.')
  }

  const caseRecord =
    assignment.submissionCase ??
    (await prisma.aiCompetencyGateCase.create({
      data: {
        assignmentId: assignment.id,
        lastSavedAt: new Date(),
      },
      include: gateCaseInclude,
    }))

  const evidence = await prisma.aiCompetencyGateEvidence.create({
    data: {
      caseId: caseRecord.id,
      evidenceType: params.input.evidenceType,
      title: params.input.title,
      description: params.input.description?.trim() || null,
      linkUrl: params.input.linkUrl?.trim() || null,
      textNote: params.input.textNote?.trim() || null,
      fileName: params.input.file?.fileName ?? null,
      mimeType: params.input.file?.mimeType ?? null,
      sizeBytes: params.input.file?.sizeBytes ?? null,
      content: params.input.file?.buffer ? Buffer.from(params.input.file.buffer) : null,
      uploadedById: params.session.user.id,
    },
  })

  await createAuditLog({
    userId: params.session.user.id,
    action: 'UPLOAD_AI_COMPETENCY_GATE_EVIDENCE',
    entityType: 'AiCompetencyGateEvidence',
    entityId: evidence.id,
    newValue: {
      caseId: caseRecord.id,
      evidenceType: evidence.evidenceType,
      title: evidence.title,
    },
  })

  const reloaded = await prisma.aiCompetencyGateCase.findUnique({
    where: { id: caseRecord.id },
    include: gateCaseInclude,
  })

  return {
    evidenceItems: buildEvidenceSummary(reloaded),
  }
}

export async function deleteAiCompetencyGateEvidence(params: {
  session: AuthenticatedSession
  assignmentId: string
  evidenceId: string
}) {
  const assignment = await loadAssignmentForEmployee({
    session: params.session,
    assignmentId: params.assignmentId,
  })
  assertEmployeeEditable(assignment)

  const evidence = await prisma.aiCompetencyGateEvidence.findUnique({
    where: { id: params.evidenceId },
  })
  if (!evidence || evidence.caseId !== assignment.submissionCase?.id) {
    throw new AppError(404, 'AI_COMPETENCY_GATE_EVIDENCE_NOT_FOUND', '삭제할 증빙을 찾을 수 없습니다.')
  }

  await prisma.aiCompetencyGateEvidence.delete({
    where: { id: params.evidenceId },
  })

  const reloaded = await prisma.aiCompetencyGateCase.findUnique({
    where: { id: evidence.caseId },
    include: gateCaseInclude,
  })

  return {
    evidenceItems: buildEvidenceSummary(reloaded),
  }
}

export async function submitAiCompetencyGateCase(params: {
  session: AuthenticatedSession
  assignmentId: string
}) {
  const assignment = await loadAssignmentForEmployee({
    session: params.session,
    assignmentId: params.assignmentId,
  })
  assertEmployeeEditable(assignment)

  const caseRecord = assignment.submissionCase
  validateCaseReadiness(caseRecord)

  const actorName = params.session.user.name ?? assignment.employeeNameSnapshot
  const isResubmission = assignment.status === 'REVISION_REQUESTED'
  const nextStatus: AiCompetencyGateStatus = isResubmission ? 'RESUBMITTED' : 'SUBMITTED'
  const snapshotType = isResubmission ? 'RESUBMIT' : 'SUBMIT'
  assertStatusTransition(assignment.status, nextStatus)

  const updated = await prisma.$transaction(async (tx) => {
    const refreshedCase = await tx.aiCompetencyGateCase.findUniqueOrThrow({
      where: { id: caseRecord!.id },
      include: gateCaseInclude,
    })
    validateCaseReadiness(refreshedCase)

    const assignmentAfter = await updateAssignmentStatus({
      db: tx,
      assignmentId: assignment.id,
      nextStatus,
      submittedAt: new Date(),
    })

    await writeGateDecisionHistory({
      db: tx,
      assignmentId: assignment.id,
      caseId: refreshedCase.id,
      actorId: params.session.user.id,
      actorNameSnapshot: actorName,
      fromStatus: assignment.status,
      toStatus: nextStatus,
      action: isResubmission ? '보완 후 재제출' : '제출 완료',
    })

    await createGateSnapshot({
      db: tx,
      assignmentId: assignment.id,
      caseId: refreshedCase.id,
      snapshotType,
      revisionRound: assignmentAfter.currentRevisionRound,
      payload: buildCaseSnapshotPayload({
        assignment: {
          ...(assignment as GateAssignmentRecord),
          status: assignmentAfter.status,
          submittedAt: assignmentAfter.submittedAt,
          currentRevisionRound: assignmentAfter.currentRevisionRound,
          updatedAt: assignmentAfter.updatedAt,
        } as GateAssignmentRecord,
        caseRecord: refreshedCase,
        actorId: params.session.user.id,
        actorName,
      }) as Prisma.JsonObject,
      createdById: params.session.user.id,
      createdByNameSnapshot: actorName,
    })

    return {
      assignment: assignmentAfter,
      caseRecord: refreshedCase,
    }
  })

  if (assignment.reviewerId) {
    await queueNotification({
      recipientId: assignment.reviewerId,
      type: 'SYSTEM',
      sourceType: 'AiCompetencyGateCase',
      sourceId: caseRecord!.id,
      dedupeToken: `submit:${assignment.id}:${updated.assignment.status}:${updated.assignment.updatedAt.toISOString()}`,
      payload: {
        title: 'AI 역량평가 제출서가 도착했습니다.',
        body: `${assignment.employeeNameSnapshot}님이 ${assignment.cycle.cycleName} 회차 AI 역량평가 제출서를 제출했습니다.`,
        link: `/evaluation/ai-competency/admin/${caseRecord!.id}`,
      },
      channels: ['IN_APP'],
    })
  }

  return {
    assignmentId: updated.assignment.id,
    status: updated.assignment.status,
    statusLabel: getGateStatusLabel(updated.assignment.status),
    submittedAt: toIso(updated.assignment.submittedAt),
  }
}

export async function getAiCompetencyGateEvidenceDownload(params: {
  session: AuthenticatedSession
  evidenceId: string
}) {
  const evidence = await prisma.aiCompetencyGateEvidence.findUnique({
    where: { id: params.evidenceId },
    include: {
      submissionCase: {
        include: {
          assignment: true,
        },
      },
    },
  })

  if (!evidence || !evidence.content || !evidence.fileName || !evidence.mimeType) {
    throw new AppError(404, 'AI_COMPETENCY_GATE_EVIDENCE_DOWNLOAD_NOT_FOUND', '다운로드할 파일을 찾을 수 없습니다.')
  }

  const isOwner = evidence.submissionCase.assignment.employeeId === params.session.user.id
  const isReviewer = evidence.submissionCase.assignment.reviewerId === params.session.user.id
  const isManager = canManageGateRole(params.session.user.role)
  if (!isOwner && !isReviewer && !isManager) {
    throw new AppError(403, 'AI_COMPETENCY_GATE_EVIDENCE_FORBIDDEN', '이 증빙 파일을 볼 권한이 없습니다.')
  }

  return {
    fileName: evidence.fileName,
    contentType: evidence.mimeType,
    body: Buffer.from(evidence.content),
  }
}

export async function exportAiCompetencyGateReport(params: {
  session: AuthenticatedSession
  cycleId: string
  format: 'csv' | 'xlsx'
}) {
  assertManager(params.session.user.role)

  const cycle = await prisma.aiCompetencyGateCycle.findUnique({
    where: { id: params.cycleId },
    include: {
      assignments: {
        include: {
          submissionCase: {
            include: gateCaseInclude,
          },
        },
        orderBy: [{ employeeNameSnapshot: 'asc' }],
      },
    },
  })
  if (!cycle) {
    throw new AppError(404, 'AI_COMPETENCY_GATE_EXPORT_CYCLE_NOT_FOUND', '내보낼 회차를 찾을 수 없습니다.')
  }

  const rows = cycle.assignments.map((assignment) => {
    const latestReview = assignment.submissionCase?.reviews[0]
    return {
      employeeName: assignment.employeeNameSnapshot,
      departmentName: assignment.departmentNameSnapshot,
      position: assignment.positionSnapshot,
      status: AI_COMPETENCY_GATE_VISIBLE_STATUS_LABELS[resolveVisibleStatus(assignment.status)],
      track: assignment.submissionCase?.track ? getGateTrackLabel(assignment.submissionCase.track) : '',
      title: assignment.submissionCase?.title ?? '',
      reviewer: assignment.reviewerNameSnapshot ?? '',
      submittedAt: assignment.submittedAt ? assignment.submittedAt.toISOString() : '',
      decision: latestReview?.overallDecision ?? '',
      decisionComment: latestReview?.overallComment ?? '',
      evidenceCount: assignment.submissionCase?.evidenceItems.length ?? 0,
      metricCount: assignment.submissionCase?.metrics.length ?? 0,
    }
  })

  if (params.format === 'xlsx') {
    const workbook = XLSX.utils.book_new()
    const sheet = XLSX.utils.json_to_sheet(rows)
    XLSX.utils.book_append_sheet(workbook, sheet, 'AI Gate')
    const body = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
    return {
      fileName: `${cycle.cycleName}-ai-gate-report.xlsx`,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      body,
    }
  }

  const headers = Object.keys(rows[0] ?? {
    employeeName: '',
    departmentName: '',
    position: '',
    status: '',
    track: '',
    title: '',
    reviewer: '',
    submittedAt: '',
    decision: '',
    decisionComment: '',
    evidenceCount: '',
    metricCount: '',
  })
  const csv = [
    headers.join(','),
    ...rows.map((row) =>
      headers
        .map((header) => `"${String((row as Record<string, unknown>)[header] ?? '').replaceAll('"', '""')}"`)
        .join(',')
    ),
  ].join('\n')

  return {
    fileName: `${cycle.cycleName}-ai-gate-report.csv`,
    contentType: 'text/csv; charset=utf-8',
    body: Buffer.from(`\uFEFF${csv}`, 'utf8'),
  }
}
