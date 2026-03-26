import type { AppealStatus, CycleStatus, Prisma, SystemRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export type AppealCaseStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'INFO_REQUESTED'
  | 'RESOLVED'
  | 'REJECTED'
  | 'WITHDRAWN'

export type AppealPageState = 'ready' | 'empty' | 'hidden' | 'permission-denied' | 'error'

export type AppealPageAlert = {
  title: string
  description: string
}

export type AppealViewModel = {
  actorMode: 'applicant' | 'admin'
  cycle: {
    id: string
    name: string
    year: number
    appealOpen: boolean
    appealDeadline?: string
  }
  resultSummary: {
    resultId: string
    finalGrade: string
    totalScore: number
    publishedAt?: string
    evaluatorName?: string
    calibrationAdjusted?: boolean
  }
  case: {
    id?: string
    caseNumber: string
    status: AppealCaseStatus
    category: string
    reason: string
    requestedAction?: string
    relatedTargets: string[]
    createdAt: string
    updatedAt: string
    assignedTo?: {
      id: string
      name: string
    }
    slaDueAt?: string
    resolutionType?: string
    resolutionNote?: string
    canEdit: boolean
    canWithdraw: boolean
    canSubmit: boolean
  }
  attachments: Array<{
    id: string
    name: string
    kind: 'KPI' | 'CHECKIN' | 'FEEDBACK' | 'OTHER'
    uploadedAt: string
    uploadedBy: string
    sizeLabel?: string
    persisted?: boolean
  }>
  timeline: Array<{
    id: string
    at: string
    actor: string
    action: string
    detail?: string
    fromStatus?: string
    toStatus?: string
  }>
  decision?: {
    decidedAt?: string
    decidedBy?: string
    status?: 'RESOLVED' | 'REJECTED'
    note?: string
    scoreChanged?: boolean
    gradeChanged?: boolean
    beforeScore?: number
    afterScore?: number
    beforeGrade?: string
    afterGrade?: string
  }
  queueSummary?: {
    openCount: number
    infoRequestedCount: number
    overdueCount: number
  }
  caseOptions?: Array<{
    id: string
    caseNumber: string
    status: AppealCaseStatus
    applicantName: string
    label: string
  }>
}

export type AppealPageData = {
  state: AppealPageState
  availableCycles: Array<{
    id: string
    name: string
    year: number
    status: CycleStatus
  }>
  selectedCycleId?: string
  selectedCaseId?: string
  viewModel?: AppealViewModel
  message?: string
  alerts?: AppealPageAlert[]
}

type AppealSession = {
  user: {
    id: string
    role: SystemRole
    name: string
    deptId: string
    accessibleDepartmentIds: string[]
  }
}

type AppealAuditPayload = {
  category?: string
  requestedAction?: string
  relatedTargets?: string[]
  attachments?: Array<{
    id: string
    name: string
    kind: 'KPI' | 'CHECKIN' | 'FEEDBACK' | 'OTHER'
    uploadedAt: string
    uploadedBy: string
    sizeLabel?: string
    persisted?: boolean
  }>
  resolutionType?: string
  resolutionNote?: string
  assignedTo?: {
    id: string
    name: string
  }
  beforeScore?: number
  afterScore?: number
  beforeGrade?: string
  afterGrade?: string
}

async function loadAppealSection<T>(params: {
  alerts: AppealPageAlert[]
  title: string
  description: string
  fallback: T
  loader: () => Promise<T>
}) {
  try {
    return await params.loader()
  } catch (error) {
    console.error(`[evaluation-appeal] ${params.title}`, error)
    params.alerts.push({
      title: params.title,
      description: params.description,
    })
    return params.fallback
  }
}

function hasDepartmentScope(employee: { department?: { orgId?: string | null } | null }) {
  return Boolean(employee.department?.orgId)
}

export async function getEvaluationAppealPageData(params: {
  session: AppealSession
  cycleId?: string
  caseId?: string
}): Promise<AppealPageData> {
  try {
    const alerts: AppealPageAlert[] = []
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
    const sessionDepartment =
      !employee && params.session.user.deptId
        ? await prisma.department.findUnique({
            where: { id: params.session.user.deptId },
            include: {
              organization: true,
            },
          })
        : null
    const organizationId = employee?.department?.orgId ?? sessionDepartment?.orgId ?? null

    if (!employee && !organizationId) {
      return {
        state: 'permission-denied',
        availableCycles: [],
        message: '이의 신청 화면을 확인할 수 있는 직원 정보를 찾지 못했습니다.',
        alerts,
      }
    }

    if (employee && !hasDepartmentScope(employee) && !organizationId) {
      return {
        state: 'permission-denied',
        availableCycles: [],
        message: '이의 신청을 조회할 부서 정보가 없어 관리자에게 설정 확인이 필요합니다.',
        alerts,
      }
    }

    const cycles = await prisma.evalCycle.findMany({
      where: {
        orgId: organizationId ?? undefined,
      },
      orderBy: [{ evalYear: 'desc' }, { createdAt: 'desc' }],
    })

    const availableCycles = cycles.map((cycle) => ({
      id: cycle.id,
      name: cycle.cycleName,
      year: cycle.evalYear,
      status: cycle.status,
    }))

    if (!cycles.length) {
      return {
        state: 'empty',
        availableCycles,
        message: '아직 평가 주기가 생성되지 않았습니다.',
        alerts,
      }
    }

    const selectedCycle =
      cycles.find((cycle) => cycle.id === params.cycleId) ??
      cycles.find((cycle) => cycle.status !== 'SETUP') ??
      cycles[0]

    const actorMode = params.session.user.role === 'ROLE_ADMIN' ? 'admin' : 'applicant'

    if (!employee && actorMode !== 'admin') {
      return {
        state: isAppealOpen(selectedCycle) ? 'empty' : 'hidden',
        availableCycles,
        selectedCycleId: selectedCycle.id,
        alerts,
        message: '연결된 직원 평가 결과가 없어 현재 계정으로 신청할 이의 신청이 없습니다.',
      }
    }

    if (actorMode === 'admin') {
      return buildAdminAppealPage({
        alerts,
        employeeId: params.session.user.id,
        selectedCycle,
        availableCycles,
        caseId: params.caseId,
      })
    }

    return buildApplicantAppealPage({
      alerts,
      employeeId: params.session.user.id,
      selectedCycle,
      availableCycles,
      caseId: params.caseId,
    })
  } catch (error) {
    console.error('[evaluation-appeal] failed to build page data', error)
    return {
      state: 'error',
      availableCycles: [],
      message: '이의 신청 화면을 불러오는 중 오류가 발생했습니다.',
      alerts: [],
    }
  }
}

type AppealEvaluationRecord = {
  id: string
  gradeId: string | null
  totalScore: number | null
  evalStage: string
  evaluator: {
    empName: string
  }
  items: Array<{
    personalKpi: {
      kpiName: string
      monthlyRecords: Array<{
        attachments: Prisma.JsonValue
        yearMonth: string
      }>
    }
  }>
}

type AppealRecord = {
  id: string
  reason: string
  status: AppealStatus
  adminResponse: string | null
  resolvedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

type AppealAuditLogRecord = {
  id: string
  entityId: string | null
  action: string
  userId: string
  oldValue: Prisma.JsonValue | null
  newValue: Prisma.JsonValue | null
  timestamp: Date
}

async function buildApplicantAppealPage(params: {
  alerts: AppealPageAlert[]
  employeeId: string
  selectedCycle: {
    id: string
    orgId: string
    evalYear: number
    cycleName: string
    status: CycleStatus
    resultOpenStart: Date | null
    appealDeadline: Date | null
  }
  availableCycles: AppealPageData['availableCycles']
  caseId?: string
}): Promise<AppealPageData> {
  const evaluation = await prisma.evaluation.findFirst({
    where: {
      evalCycleId: params.selectedCycle.id,
      targetId: params.employeeId,
      evalStage: {
        in: ['CEO_ADJUST', 'FINAL', 'SECOND', 'FIRST'],
      },
    },
    include: {
      evaluator: {
        select: {
          empName: true,
        },
      },
      appeals: {
        orderBy: {
          createdAt: 'desc',
        },
      },
      items: {
        include: {
          personalKpi: {
            include: {
              monthlyRecords: {
                orderBy: {
                  yearMonth: 'desc',
                },
              },
            },
          },
        },
      },
    },
    orderBy: [{ evalStage: 'desc' }, { updatedAt: 'desc' }],
  })

  if (!evaluation) {
    return {
      state: isAppealOpen(params.selectedCycle) ? 'empty' : 'hidden',
      availableCycles: params.availableCycles,
      selectedCycleId: params.selectedCycle.id,
      alerts: params.alerts,
      message: isAppealOpen(params.selectedCycle)
        ? '연결된 평가 결과가 없어 이의 신청을 만들 수 없습니다.'
        : '현재 주기는 아직 이의 신청 기간이 아닙니다.',
    }
  }

  const selectedAppeal =
    evaluation.appeals.find((appeal) => appeal.id === params.caseId) ??
    evaluation.appeals[0] ??
    null

  const gradeSettings = await loadAppealSection({
    alerts: params.alerts,
    title: '등급 기준을 불러오지 못했습니다.',
    description: '등급 표시는 최종 점수 기준으로만 안내합니다.',
    fallback: [] as Array<{
      id: string
      gradeName: string
      minScore: number
      maxScore: number
    }>,
    loader: () =>
      prisma.gradeSetting.findMany({
        where: {
          orgId: params.selectedCycle.orgId,
          evalYear: params.selectedCycle.evalYear,
          isActive: true,
        },
        select: {
          id: true,
          gradeName: true,
          minScore: true,
          maxScore: true,
        },
        orderBy: {
          gradeOrder: 'asc',
        },
      }),
  })

  const auditLogs = selectedAppeal
    ? await loadAppealSection({
        alerts: params.alerts,
        title: '이의 신청 처리 이력을 불러오지 못했습니다.',
        description: '처리 타임라인은 축약해 표시합니다.',
        fallback: [] as AppealAuditLogRecord[],
        loader: () =>
          prisma.auditLog.findMany({
            where: {
              entityType: 'Appeal',
              entityId: selectedAppeal.id,
            },
            orderBy: {
              timestamp: 'asc',
            },
          }) as Promise<AppealAuditLogRecord[]>,
      })
    : []

  const viewModel = await buildAppealViewModel({
    actorMode: 'applicant',
    cycle: params.selectedCycle,
    evaluation,
    appeal: selectedAppeal,
    gradeSettings,
    auditLogs,
    caseOptions: evaluation.appeals.map((appeal) => ({
      id: appeal.id,
      caseNumber: buildCaseNumber(appeal.id, appeal.createdAt),
      status: deriveAppealCaseStatus(appeal, auditLogs),
      applicantName: '나',
      label: '내 신청',
    })),
  })

  return {
    state: 'ready',
    availableCycles: params.availableCycles,
    selectedCycleId: params.selectedCycle.id,
    selectedCaseId: selectedAppeal?.id,
    viewModel,
    alerts: params.alerts,
  }
}

async function buildAdminAppealPage(params: {
  alerts: AppealPageAlert[]
  employeeId: string
  selectedCycle: {
    id: string
    orgId: string
    evalYear: number
    cycleName: string
    status: CycleStatus
    resultOpenStart: Date | null
    appealDeadline: Date | null
  }
  availableCycles: AppealPageData['availableCycles']
  caseId?: string
}): Promise<AppealPageData> {
  const appeals = await prisma.appeal.findMany({
    where: {
      evaluation: {
        evalCycleId: params.selectedCycle.id,
      },
    },
    include: {
      appealer: {
        select: {
          empName: true,
        },
      },
      evaluation: {
        include: {
          evaluator: {
            select: {
              empName: true,
            },
          },
          target: {
            select: {
              empName: true,
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
                  monthlyRecords: {
                    orderBy: {
                      yearMonth: 'desc',
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  const selectedAppeal = appeals.find((appeal) => appeal.id === params.caseId) ?? appeals[0] ?? null

  if (!selectedAppeal) {
    return {
      state: isAppealOpen(params.selectedCycle) ? 'empty' : 'hidden',
      availableCycles: params.availableCycles,
      selectedCycleId: params.selectedCycle.id,
      alerts: params.alerts,
      message: isAppealOpen(params.selectedCycle)
        ? '현재 주기에는 검토할 이의 신청 케이스가 없습니다.'
        : '이의 신청 운영 기간이 아니어서 검토할 케이스가 없습니다.',
    }
  }

  const gradeSettings = await loadAppealSection({
    alerts: params.alerts,
    title: '운영용 등급 기준을 불러오지 못했습니다.',
    description: '점수/등급 비교는 기본 값으로 표시합니다.',
    fallback: [] as Array<{
      id: string
      gradeName: string
      minScore: number
      maxScore: number
    }>,
    loader: () =>
      prisma.gradeSetting.findMany({
        where: {
          orgId: params.selectedCycle.orgId,
          evalYear: params.selectedCycle.evalYear,
          isActive: true,
        },
        select: {
          id: true,
          gradeName: true,
          minScore: true,
          maxScore: true,
        },
        orderBy: {
          gradeOrder: 'asc',
        },
      }),
  })

  const allAuditLogs = await loadAppealSection({
    alerts: params.alerts,
    title: '운영 처리 이력을 불러오지 못했습니다.',
    description: '처리 이력과 SLA 계산은 일부 생략될 수 있습니다.',
    fallback: [] as AppealAuditLogRecord[],
    loader: () =>
      prisma.auditLog.findMany({
        where: {
          entityType: 'Appeal',
          entityId: {
            in: appeals.map((appeal) => appeal.id),
          },
        },
        orderBy: {
          timestamp: 'asc',
        },
      }) as Promise<AppealAuditLogRecord[]>,
  })

  const selectedAuditLogs = allAuditLogs.filter((log) => log.entityId === selectedAppeal.id)

  const viewModel = await buildAppealViewModel({
    actorMode: 'admin',
    cycle: params.selectedCycle,
    evaluation: selectedAppeal.evaluation,
    appeal: selectedAppeal,
    gradeSettings,
    auditLogs: selectedAuditLogs,
    caseOptions: appeals.map((appeal) => ({
      id: appeal.id,
      caseNumber: buildCaseNumber(appeal.id, appeal.createdAt),
      status: deriveAppealCaseStatus(
        appeal,
        allAuditLogs.filter((log) => log.entityId === appeal.id)
      ),
      applicantName: appeal.appealer.empName,
      label: `${appeal.evaluation.target.empName} / ${appeal.evaluation.target.department?.deptName ?? '미지정'}`,
    })),
    queueSummary: {
      openCount: appeals.filter((appeal) => ['SUBMITTED', 'UNDER_REVIEW'].includes(appeal.status)).length,
      infoRequestedCount: appeals.filter((appeal) =>
        deriveAppealCaseStatus(
          appeal,
          allAuditLogs.filter((log) => log.entityId === appeal.id)
        ) === 'INFO_REQUESTED'
      ).length,
      overdueCount: appeals.filter((appeal) => {
        const due = new Date(appeal.createdAt)
        due.setDate(due.getDate() + 7)
        return due < new Date() && ['SUBMITTED', 'UNDER_REVIEW'].includes(appeal.status)
      }).length,
    },
  })

  return {
    state: 'ready',
    availableCycles: params.availableCycles,
    selectedCycleId: params.selectedCycle.id,
    selectedCaseId: selectedAppeal.id,
    viewModel,
    alerts: params.alerts,
  }
}

async function buildAppealViewModel(params: {
  actorMode: 'applicant' | 'admin'
  cycle: {
    id: string
    evalYear: number
    cycleName: string
    appealDeadline: Date | null
    status: CycleStatus
    resultOpenStart: Date | null
  }
  evaluation: AppealEvaluationRecord
  appeal: AppealRecord | null
  gradeSettings: Array<{
    id: string
    gradeName: string
    minScore: number
    maxScore: number
  }>
  auditLogs: AppealAuditLogRecord[]
  caseOptions: AppealViewModel['caseOptions']
  queueSummary?: AppealViewModel['queueSummary']
}) {
  const parsedAuditPayload = extractLatestAppealPayload(params.auditLogs)
  const attachments = parsedAuditPayload.attachments?.length
    ? parsedAuditPayload.attachments
    : buildSuggestedAttachments(params.evaluation.items)
  const status = deriveAppealCaseStatus(params.appeal, params.auditLogs)
  const slaDueAt = params.appeal ? addDays(params.appeal.createdAt, 7).toISOString() : addDays(new Date(), 7).toISOString()
  const finalGrade = resolveGradeName(
    params.evaluation.gradeId,
    params.evaluation.totalScore,
    params.gradeSettings
  )

  return {
    actorMode: params.actorMode,
    cycle: {
      id: params.cycle.id,
      name: params.cycle.cycleName,
      year: params.cycle.evalYear,
      appealOpen: isAppealOpen(params.cycle),
      appealDeadline: params.cycle.appealDeadline?.toISOString(),
    },
    resultSummary: {
      resultId: params.evaluation.id,
      finalGrade: finalGrade ?? '미확정',
      totalScore: params.evaluation.totalScore ?? 0,
      publishedAt: params.cycle.resultOpenStart?.toISOString(),
      evaluatorName: params.evaluation.evaluator.empName,
      calibrationAdjusted: params.evaluation.evalStage === 'CEO_ADJUST',
    },
    case: {
      id: params.appeal?.id,
      caseNumber: params.appeal ? buildCaseNumber(params.appeal.id, params.appeal.createdAt) : buildDraftCaseNumber(params.cycle.evalYear),
      status,
      category: parsedAuditPayload.category ?? '점수 이의',
      reason: params.appeal?.reason ?? '',
      requestedAction: parsedAuditPayload.requestedAction ?? '재검토 요청',
      relatedTargets: parsedAuditPayload.relatedTargets ?? ['최종 등급'],
      createdAt: (params.appeal?.createdAt ?? new Date()).toISOString(),
      updatedAt: (params.appeal?.updatedAt ?? new Date()).toISOString(),
      assignedTo: parsedAuditPayload.assignedTo,
      slaDueAt,
      resolutionType: parsedAuditPayload.resolutionType,
      resolutionNote: params.appeal?.adminResponse ?? parsedAuditPayload.resolutionNote,
      canEdit: status === 'DRAFT' || status === 'INFO_REQUESTED',
      canWithdraw: ['SUBMITTED', 'UNDER_REVIEW', 'INFO_REQUESTED'].includes(status),
      canSubmit: isAppealOpen(params.cycle) && (status === 'DRAFT' || status === 'INFO_REQUESTED'),
    },
    attachments,
    timeline: buildTimeline(params.appeal, params.auditLogs),
    decision:
      params.appeal && ['ACCEPTED', 'REJECTED', 'CLOSED'].includes(params.appeal.status)
        ? {
            decidedAt: params.appeal.resolvedAt?.toISOString(),
            decidedBy:
              parsedAuditPayload.assignedTo?.name ??
              (params.actorMode === 'admin' ? '나' : 'HR 운영자'),
            status: params.appeal.status === 'REJECTED' ? 'REJECTED' : 'RESOLVED',
            note: params.appeal.adminResponse ?? parsedAuditPayload.resolutionNote,
            scoreChanged:
              parsedAuditPayload.beforeScore !== undefined &&
              parsedAuditPayload.afterScore !== undefined &&
              parsedAuditPayload.beforeScore !== parsedAuditPayload.afterScore,
            gradeChanged:
              parsedAuditPayload.beforeGrade !== undefined &&
              parsedAuditPayload.afterGrade !== undefined &&
              parsedAuditPayload.beforeGrade !== parsedAuditPayload.afterGrade,
            beforeScore: parsedAuditPayload.beforeScore,
            afterScore: parsedAuditPayload.afterScore,
            beforeGrade: parsedAuditPayload.beforeGrade,
            afterGrade: parsedAuditPayload.afterGrade,
          }
        : undefined,
    queueSummary: params.queueSummary,
    caseOptions: params.caseOptions,
  } satisfies AppealViewModel
}

function deriveAppealCaseStatus(
  appeal: {
    status: AppealStatus
  } | null,
  auditLogs: Array<{
    action: string
  }>
): AppealCaseStatus {
  if (!appeal) return 'DRAFT'

  const latestAction = [...auditLogs].reverse().find((log) => log.action.startsWith('APPEAL_'))?.action

  if (latestAction === 'APPEAL_WITHDRAWN') return 'WITHDRAWN'
  if (latestAction === 'APPEAL_INFO_REQUESTED') return 'INFO_REQUESTED'
  if (appeal.status === 'UNDER_REVIEW') return 'UNDER_REVIEW'
  if (appeal.status === 'REJECTED') return 'REJECTED'
  if (appeal.status === 'ACCEPTED') return 'RESOLVED'
  if (appeal.status === 'CLOSED') return 'WITHDRAWN'
  return 'SUBMITTED'
}

function buildSuggestedAttachments(
  items: Array<{
    personalKpi: {
      kpiName: string
      monthlyRecords: Array<{
        attachments: Prisma.JsonValue
        yearMonth: string
      }>
    }
  }>
) {
  const attachments: AppealViewModel['attachments'] = []

  for (const item of items) {
    for (const record of item.personalKpi.monthlyRecords) {
      if (!Array.isArray(record.attachments)) continue
      record.attachments.forEach((attachment, index) => {
        attachments.push({
          id: `${item.personalKpi.kpiName}-${record.yearMonth}-${index}`,
          name:
            typeof attachment === 'string'
              ? attachment
              : typeof attachment === 'object' && attachment && 'name' in attachment
                ? String(attachment.name)
                : `${item.personalKpi.kpiName} 증빙 ${index + 1}`,
          kind: 'KPI',
          uploadedAt: new Date().toISOString(),
          uploadedBy: '시스템 연동 근거',
          persisted: true,
        })
      })
    }
  }

  return attachments.slice(0, 8)
}

function buildTimeline(
  appeal: {
    id: string
    createdAt: Date
    updatedAt: Date
    status: AppealStatus
    resolvedAt: Date | null
  } | null,
  auditLogs: AppealAuditLogRecord[]
) {
  const timeline: AppealViewModel['timeline'] = []

  if (appeal) {
    timeline.push({
      id: `${appeal.id}-created`,
      at: appeal.createdAt.toISOString(),
      actor: '신청자',
      action: '생성',
      detail: '이의 신청 케이스가 생성되었습니다.',
      fromStatus: 'DRAFT',
      toStatus: 'SUBMITTED',
    })
  }

  for (const log of auditLogs) {
    const payload = parseAuditPayload(log.newValue)
    timeline.push({
      id: log.id,
      at: log.timestamp.toISOString(),
      actor: payload.assignedTo?.name ?? log.userId,
      action: humanizeAuditAction(log.action),
      detail:
        payload.resolutionNote ??
        payload.requestedAction ??
        (typeof payload.category === 'string' ? `유형: ${payload.category}` : undefined),
      fromStatus: getStatusValue(log.oldValue),
      toStatus: getStatusValue(log.newValue),
    })
  }

  if (appeal?.resolvedAt && !timeline.some((item) => item.at === appeal.resolvedAt?.toISOString())) {
    timeline.push({
      id: `${appeal.id}-resolved`,
      at: appeal.resolvedAt.toISOString(),
      actor: '운영자',
      action: appeal.status === 'REJECTED' ? '기각' : '처리 완료',
      toStatus: appeal.status === 'REJECTED' ? 'REJECTED' : 'RESOLVED',
    })
  }

  return timeline.sort((a, b) => b.at.localeCompare(a.at))
}

function extractLatestAppealPayload(auditLogs: AppealAuditLogRecord[]): AppealAuditPayload {
  for (const log of [...auditLogs].reverse()) {
    const payload = parseAuditPayload(log.newValue)
    if (
      payload.category ||
      payload.requestedAction ||
      payload.relatedTargets?.length ||
      payload.attachments?.length ||
      payload.resolutionNote
    ) {
      return payload
    }
  }

  return {}
}

function parseAuditPayload(value: Prisma.JsonValue | null): AppealAuditPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as AppealAuditPayload
}

function getStatusValue(value: Prisma.JsonValue | null) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  if ('status' in value && typeof value.status === 'string') {
    return value.status
  }
  return undefined
}

function buildCaseNumber(id: string, createdAt: Date) {
  return `APL-${createdAt.getFullYear()}-${id.slice(-6).toUpperCase()}`
}

function buildDraftCaseNumber(year: number) {
  return `APL-${year}-DRAFT`
}

function isAppealOpen(cycle: { status: CycleStatus; appealDeadline: Date | null }) {
  if (cycle.status === 'APPEAL') {
    return !cycle.appealDeadline || cycle.appealDeadline >= new Date()
  }
  if (cycle.status === 'RESULT_OPEN') {
    return !cycle.appealDeadline || cycle.appealDeadline >= new Date()
  }
  return false
}

function resolveGradeName(
  gradeId: string | null,
  totalScore: number | null,
  gradeSettings: Array<{
    id: string
    gradeName: string
    minScore: number
    maxScore: number
  }>
) {
  if (gradeId) {
    const matched = gradeSettings.find((grade) => grade.id === gradeId)
    if (matched) return matched.gradeName
  }
  if (totalScore === null) return null
  return gradeSettings.find((grade) => totalScore >= grade.minScore && totalScore <= grade.maxScore)?.gradeName ?? null
}

function humanizeAuditAction(action: string) {
  switch (action) {
    case 'APPEAL_CREATED':
      return '제출'
    case 'APPEAL_DRAFT_SAVED':
      return '임시저장'
    case 'APPEAL_REVIEW_STARTED':
      return '검토 시작'
    case 'APPEAL_INFO_REQUESTED':
      return '보완 요청'
    case 'APPEAL_RESUBMITTED':
      return '재제출'
    case 'APPEAL_RESOLVED':
      return '처리 완료'
    case 'APPEAL_REJECTED':
      return '기각'
    case 'APPEAL_WITHDRAWN':
      return '철회'
    default:
      return action
  }
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}
