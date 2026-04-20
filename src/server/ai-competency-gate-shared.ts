import type {
  AiCompetencyGateDecision,
  AiCompetencyGateStatus,
  AiCompetencyGateTrack,
  Prisma,
  SystemRole,
} from '@prisma/client'
import type { Session } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { AppError } from '@/lib/utils'
import {
  AI_COMPETENCY_GATE_DEFAULT_CRITERIA,
  AI_COMPETENCY_GATE_DEFAULT_GUIDE_ENTRIES,
  AI_COMPETENCY_GATE_VISIBLE_STATUS_LABELS,
  canEmployeeEditGateCase,
  canReviewerWriteGateReview,
  getGateDecisionLabel,
  getGateStatusLabel,
  getGateTrackLabel,
  type GateVisibleStatus,
} from '@/lib/ai-competency-gate-config'

export type AuthenticatedSession = Session & {
  user: Session['user'] & {
    id: string
    role: SystemRole
  }
}

export const gateCaseInclude = {
  metrics: {
    orderBy: [{ displayOrder: 'asc' as const }, { createdAt: 'asc' as const }],
  },
  projectDetail: true,
  adoptionDetail: true,
  evidenceItems: {
    orderBy: [{ createdAt: 'desc' as const }],
  },
  reviews: {
    include: {
      items: {
        orderBy: [{ createdAt: 'asc' as const }],
      },
      template: {
        include: {
          criteria: {
            orderBy: [{ displayOrder: 'asc' as const }, { createdAt: 'asc' as const }],
          },
        },
      },
    },
    orderBy: [{ revisionRound: 'desc' as const }, { createdAt: 'desc' as const }],
  },
  decisionHistory: {
    orderBy: [{ createdAt: 'desc' as const }],
  },
  snapshots: {
    orderBy: [{ createdAt: 'desc' as const }],
  },
} satisfies Prisma.AiCompetencyGateCaseInclude

export type GateCaseRecord = Prisma.AiCompetencyGateCaseGetPayload<{
  include: typeof gateCaseInclude
}>

export type GateAssignmentRecord = Prisma.AiCompetencyGateAssignmentGetPayload<{
  include: {
    cycle: {
      include: {
        evalCycle: {
          include: {
            organization: true
          }
        }
      }
    }
    employee: {
      include: {
        department: true
      }
    }
    submissionCase: {
      include: typeof gateCaseInclude
    }
  }
}>

export type EmployeeWithOrg = Prisma.EmployeeGetPayload<{
  include: {
    department: {
      include: {
        organization: true
      }
    }
  }
}>

export type ReviewTemplateRecord = Prisma.AiCompetencyGateReviewTemplateGetPayload<{
  include: {
    criteria: true
  }
}>

export type GuideEntryRecord = Prisma.AiCompetencyGuideEntryGetPayload<Record<string, never>>

export type AiCompetencyGateCycleOption = {
  id: string
  evalCycleId: string
  year: number
  name: string
  status: 'DRAFT' | 'OPEN' | 'CLOSED'
  submissionWindowLabel?: string
  reviewWindowLabel?: string
  resultPublishLabel?: string
}

export type AiCompetencyGateGuideCard = {
  id: string
  entryType: 'GUIDE' | 'PASS_EXAMPLE' | 'FAIL_EXAMPLE' | 'FAQ'
  title: string
  summary: string
  body: string
  trackApplicability: 'COMMON' | 'PROJECT_ONLY' | 'ADOPTION_ONLY'
}

export type AiCompetencyGateMetricForm = {
  id?: string
  metricName: string
  beforeValue: string
  afterValue: string
  unit: string
  verificationMethod: string
  displayOrder: number
}

export type AiCompetencyGateCaseFormData = {
  caseId?: string
  track?: AiCompetencyGateTrack
  title: string
  problemStatement: string
  importanceReason: string
  goalStatement: string
  scopeDescription: string
  ownerRoleDescription: string
  beforeWorkflow: string
  afterWorkflow: string
  impactSummary: string
  teamOrganizationAdoption: string
  reusableOutputSummary: string
  humanReviewControl: string
  factCheckMethod: string
  securityEthicsPrivacyHandling: string
  sharingExpansionActivity: string
  toolList: string
  approvedToolBasis: string
  sensitiveDataHandling: string
  maskingAnonymizationHandling: string
  prohibitedAutomationAcknowledged: boolean
  finalDeclarationAccepted: boolean
  metrics: AiCompetencyGateMetricForm[]
  projectDetail: {
    projectBackground: string
    stakeholders: string
    executionSteps: string
    deliverables: string
    projectStartedAt: string
    projectEndedAt: string
    ownerPmRoleDetail: string
    contributionSummary: string
  }
  adoptionDetail: {
    useCaseDescription: string
    teamDivisionScope: string
    repeatedUseExamples: string
    measuredEffectDetail: string
    seminarSharingEvidence: string
    organizationExpansionDetail: string
  }
}

export type AiCompetencyGateTimelineItem = {
  id: string
  createdAt: string
  title: string
  description: string
  tone: 'neutral' | 'success' | 'warning'
}

export type AiCompetencyGateLatestReview = {
  reviewId: string
  overallDecision?: AiCompetencyGateDecision
  overallDecisionLabel: string
  overallComment?: string
  reviewedAt?: string
  reviewerName: string
  items: Array<{
    criterionId: string
    criterionName: string
    decision: AiCompetencyGateDecision
    decisionLabel: string
    comment: string
    requiredFix?: string
  }>
}

export function isManagerRole(role: SystemRole) {
  return role === 'ROLE_TEAM_LEADER' || role === 'ROLE_SECTION_CHIEF' || role === 'ROLE_DIV_HEAD'
}

export function canManageGate(role: SystemRole) {
  return role === 'ROLE_ADMIN' || role === 'ROLE_CEO'
}

export function canReviewGate(role: SystemRole) {
  return canManageGate(role) || isManagerRole(role)
}

export function toIso(value?: Date | null) {
  return value ? value.toISOString() : undefined
}

export function resolvePositionLabel(position?: string | null) {
  const map: Record<string, string> = {
    MEMBER: '구성원',
    TEAM_LEADER: '팀장',
    SECTION_CHIEF: '실장/부문장',
    DIV_HEAD: '본부장',
    CEO: 'CEO',
  }
  if (!position) return '미지정'
  return map[position] ?? position
}

export function resolveVisibleStatus(status?: AiCompetencyGateStatus | null): GateVisibleStatus {
  if (!status) return 'NOT_ASSIGNED'
  return status
}

export function buildCurrentUser(employee: EmployeeWithOrg) {
  return {
    id: employee.id,
    name: employee.empName,
    department: employee.department.deptName,
    position: resolvePositionLabel(employee.position),
    role: employee.role,
  }
}

export function buildCycleOption(
  cycle: Prisma.AiCompetencyGateCycleGetPayload<{
    include: {
      evalCycle: true
    }
  }>
): AiCompetencyGateCycleOption {
  const submissionWindowLabel =
    cycle.submissionOpenAt || cycle.submissionCloseAt
      ? `${cycle.submissionOpenAt ? cycle.submissionOpenAt.toLocaleDateString('ko-KR') : '-'} ~ ${cycle.submissionCloseAt ? cycle.submissionCloseAt.toLocaleDateString('ko-KR') : '-'}`
      : undefined
  const reviewWindowLabel =
    cycle.reviewOpenAt || cycle.reviewCloseAt
      ? `${cycle.reviewOpenAt ? cycle.reviewOpenAt.toLocaleDateString('ko-KR') : '-'} ~ ${cycle.reviewCloseAt ? cycle.reviewCloseAt.toLocaleDateString('ko-KR') : '-'}`
      : undefined

  return {
    id: cycle.id,
    evalCycleId: cycle.evalCycleId,
    year: cycle.evalCycle.evalYear,
    name: cycle.cycleName,
    status: cycle.status,
    submissionWindowLabel,
    reviewWindowLabel,
    resultPublishLabel: cycle.resultPublishAt?.toLocaleDateString('ko-KR'),
  }
}

export async function loadEmployeeWithOrg(userId: string) {
  return prisma.employee.findUnique({
    where: { id: userId },
    include: {
      department: {
        include: {
          organization: true,
        },
      },
    },
  })
}

export function assertHasEmployeeContext(employee: EmployeeWithOrg | null): asserts employee is EmployeeWithOrg {
  if (!employee?.department?.organization?.id) {
    throw new AppError(403, 'AI_COMPETENCY_GATE_PERMISSION_DENIED', '직원 조직 정보를 확인할 수 없습니다.')
  }
}

export async function ensureDefaultGuideEntries(db: Prisma.TransactionClient | typeof prisma = prisma) {
  for (const entry of AI_COMPETENCY_GATE_DEFAULT_GUIDE_ENTRIES) {
    await db.aiCompetencyGuideEntry.upsert({
      where: { entryKey: `default:${entry.key}` },
      update: {
        entryType: entry.entryType,
        trackApplicability: entry.trackApplicability,
        title: entry.title,
        summary: entry.summary,
        body: entry.body,
        displayOrder: entry.displayOrder,
        isActive: true,
      },
      create: {
        entryKey: `default:${entry.key}`,
        entryType: entry.entryType,
        trackApplicability: entry.trackApplicability,
        title: entry.title,
        summary: entry.summary,
        body: entry.body,
        displayOrder: entry.displayOrder,
        isActive: true,
      },
    })
  }
}

export async function ensureDefaultReviewTemplate(params: {
  cycleId: string
  actorId: string
  db?: Prisma.TransactionClient | typeof prisma
}): Promise<ReviewTemplateRecord> {
  const db = params.db ?? prisma
  const existing = await db.aiCompetencyGateReviewTemplate.findFirst({
    where: {
      cycleId: params.cycleId,
      isActive: true,
    },
    include: {
      criteria: {
        orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
      },
    },
    orderBy: [{ createdAt: 'asc' }],
  })

  if (existing) return existing

  return db.aiCompetencyGateReviewTemplate.create({
    data: {
      cycleId: params.cycleId,
      templateName: 'AI 역량평가 기본 심사 기준',
      templateVersion: 1,
      isActive: true,
      createdById: params.actorId,
      criteria: {
        create: AI_COMPETENCY_GATE_DEFAULT_CRITERIA.map((criterion, index) => ({
          criterionCode: criterion.criterionCode,
          criterionName: criterion.criterionName,
          criterionDescription: criterion.criterionDescription,
          trackApplicability: criterion.trackApplicability,
          displayOrder: index,
          mandatory: criterion.mandatory,
          knockout: criterion.knockout,
          passGuidance: criterion.passGuidance,
          revisionGuidance: criterion.revisionGuidance,
          failGuidance: criterion.failGuidance,
        })),
      },
    },
    include: {
      criteria: {
        orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
      },
    },
  })
}

export function buildGuideLibrary(entries: GuideEntryRecord[]) {
  const cards = entries
    .filter((entry) => entry.isActive)
    .sort((a, b) => a.displayOrder - b.displayOrder || a.createdAt.getTime() - b.createdAt.getTime())
    .map((entry) => ({
      id: entry.id,
      entryType: entry.entryType,
      title: entry.title,
      summary: entry.summary,
      body: entry.body,
      trackApplicability: entry.trackApplicability,
    }))

  return {
    guides: cards.filter((entry) => entry.entryType === 'GUIDE'),
    passExamples: cards.filter((entry) => entry.entryType === 'PASS_EXAMPLE'),
    failExamples: cards.filter((entry) => entry.entryType === 'FAIL_EXAMPLE'),
    faqs: cards.filter((entry) => entry.entryType === 'FAQ'),
  }
}

export function emptyCaseFormData(track?: AiCompetencyGateTrack | null): AiCompetencyGateCaseFormData {
  return {
    track: track ?? undefined,
    title: '',
    problemStatement: '',
    importanceReason: '',
    goalStatement: '',
    scopeDescription: '',
    ownerRoleDescription: '',
    beforeWorkflow: '',
    afterWorkflow: '',
    impactSummary: '',
    teamOrganizationAdoption: '',
    reusableOutputSummary: '',
    humanReviewControl: '',
    factCheckMethod: '',
    securityEthicsPrivacyHandling: '',
    sharingExpansionActivity: '',
    toolList: '',
    approvedToolBasis: '',
    sensitiveDataHandling: '',
    maskingAnonymizationHandling: '',
    prohibitedAutomationAcknowledged: false,
    finalDeclarationAccepted: false,
    metrics: [],
    projectDetail: {
      projectBackground: '',
      stakeholders: '',
      executionSteps: '',
      deliverables: '',
      projectStartedAt: '',
      projectEndedAt: '',
      ownerPmRoleDetail: '',
      contributionSummary: '',
    },
    adoptionDetail: {
      useCaseDescription: '',
      teamDivisionScope: '',
      repeatedUseExamples: '',
      measuredEffectDetail: '',
      seminarSharingEvidence: '',
      organizationExpansionDetail: '',
    },
  }
}

export function serializeCaseFormData(record?: GateCaseRecord | null): AiCompetencyGateCaseFormData {
  if (!record) return emptyCaseFormData()
  return {
    caseId: record.id,
    track: record.track ?? undefined,
    title: record.title ?? '',
    problemStatement: record.problemStatement ?? '',
    importanceReason: record.importanceReason ?? '',
    goalStatement: record.goalStatement ?? '',
    scopeDescription: record.scopeDescription ?? '',
    ownerRoleDescription: record.ownerRoleDescription ?? '',
    beforeWorkflow: record.beforeWorkflow ?? '',
    afterWorkflow: record.afterWorkflow ?? '',
    impactSummary: record.impactSummary ?? '',
    teamOrganizationAdoption: record.teamOrganizationAdoption ?? '',
    reusableOutputSummary: record.reusableOutputSummary ?? '',
    humanReviewControl: record.humanReviewControl ?? '',
    factCheckMethod: record.factCheckMethod ?? '',
    securityEthicsPrivacyHandling: record.securityEthicsPrivacyHandling ?? '',
    sharingExpansionActivity: record.sharingExpansionActivity ?? '',
    toolList: record.toolList ?? '',
    approvedToolBasis: record.approvedToolBasis ?? '',
    sensitiveDataHandling: record.sensitiveDataHandling ?? '',
    maskingAnonymizationHandling: record.maskingAnonymizationHandling ?? '',
    prohibitedAutomationAcknowledged: record.prohibitedAutomationAcknowledged,
    finalDeclarationAccepted: record.finalDeclarationAccepted,
    metrics: record.metrics.map((metric) => ({
      id: metric.id,
      metricName: metric.metricName ?? '',
      beforeValue: metric.beforeValue ?? '',
      afterValue: metric.afterValue ?? '',
      unit: metric.unit ?? '',
      verificationMethod: metric.verificationMethod ?? '',
      displayOrder: metric.displayOrder,
    })),
    projectDetail: {
      projectBackground: record.projectDetail?.projectBackground ?? '',
      stakeholders: record.projectDetail?.stakeholders ?? '',
      executionSteps: record.projectDetail?.executionSteps ?? '',
      deliverables: record.projectDetail?.deliverables ?? '',
      projectStartedAt: record.projectDetail?.projectStartedAt ? record.projectDetail.projectStartedAt.toISOString() : '',
      projectEndedAt: record.projectDetail?.projectEndedAt ? record.projectDetail.projectEndedAt.toISOString() : '',
      ownerPmRoleDetail: record.projectDetail?.ownerPmRoleDetail ?? '',
      contributionSummary: record.projectDetail?.contributionSummary ?? '',
    },
    adoptionDetail: {
      useCaseDescription: record.adoptionDetail?.useCaseDescription ?? '',
      teamDivisionScope: record.adoptionDetail?.teamDivisionScope ?? '',
      repeatedUseExamples: record.adoptionDetail?.repeatedUseExamples ?? '',
      measuredEffectDetail: record.adoptionDetail?.measuredEffectDetail ?? '',
      seminarSharingEvidence: record.adoptionDetail?.seminarSharingEvidence ?? '',
      organizationExpansionDetail: record.adoptionDetail?.organizationExpansionDetail ?? '',
    },
  }
}

export function buildStatusCard(assignment: GateAssignmentRecord | null | undefined) {
  const visibleStatus = resolveVisibleStatus(assignment?.status)
  return {
    assignmentId: assignment?.id,
    visibleStatus,
    statusLabel: getGateStatusLabel(visibleStatus),
    cycleName: assignment?.cycle.cycleName,
    reviewerName: assignment?.reviewerNameSnapshot ?? undefined,
    revisionRound: assignment?.currentRevisionRound ?? 0,
    submittedAt: toIso(assignment?.submittedAt),
    decisionAt: toIso(assignment?.decisionAt),
    canEdit: canEmployeeEditGateCase(visibleStatus),
    canSubmit:
      assignment?.status === 'DRAFT' ||
      assignment?.status === 'NOT_STARTED',
    canResubmit: assignment?.status === 'REVISION_REQUESTED',
  }
}

export function buildLatestReview(record?: GateCaseRecord | null): AiCompetencyGateLatestReview | undefined {
  const latest = record?.reviews[0]
  if (!latest) return undefined

  const criteriaMap = new Map(latest.template.criteria.map((criterion) => [criterion.id, criterion] as const))
  return {
    reviewId: latest.id,
    overallDecision: latest.overallDecision ?? undefined,
    overallDecisionLabel: getGateDecisionLabel(latest.overallDecision),
    overallComment: latest.overallComment ?? undefined,
    reviewedAt: toIso(latest.reviewedAt),
    reviewerName: latest.reviewerNameSnapshot,
    items: latest.items.map((item) => ({
      criterionId: item.criterionId,
      criterionName: criteriaMap.get(item.criterionId)?.criterionName ?? item.criterionId,
      decision: item.decision,
      decisionLabel: getGateDecisionLabel(item.decision),
      comment: item.comment,
      requiredFix: item.requiredFix ?? undefined,
    })),
  }
}

export function buildTimelineFromCase(record?: GateCaseRecord | null): AiCompetencyGateTimelineItem[] {
  if (!record) return []
  const items: AiCompetencyGateTimelineItem[] = []

  for (const entry of record.decisionHistory) {
    items.push({
      id: `history:${entry.id}`,
      createdAt: entry.createdAt.toISOString(),
      title: entry.action,
      description: entry.comment ?? `${entry.actorNameSnapshot}님이 상태를 ${getGateStatusLabel(entry.toStatus)}(으)로 변경했습니다.`,
      tone:
        entry.toStatus === 'PASSED'
          ? 'success'
          : entry.toStatus === 'FAILED' || entry.toStatus === 'REVISION_REQUESTED'
            ? 'warning'
            : 'neutral',
    })
  }

  for (const snapshot of record.snapshots) {
    items.push({
      id: `snapshot:${snapshot.id}`,
      createdAt: snapshot.createdAt.toISOString(),
      title:
        snapshot.snapshotType === 'SUBMIT'
          ? '제출 스냅샷'
          : snapshot.snapshotType === 'RESUBMIT'
            ? '재제출 스냅샷'
            : snapshot.snapshotType === 'REVISION_REQUEST'
              ? '보완 요청 스냅샷'
              : '최종 결정 스냅샷',
      description: `${snapshot.createdByNameSnapshot}님이 당시 제출 내용을 저장했습니다.`,
      tone:
        snapshot.snapshotType === 'FINAL_DECISION'
          ? 'success'
          : snapshot.snapshotType === 'REVISION_REQUEST'
            ? 'warning'
            : 'neutral',
    })
  }

  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function buildReviewCriteriaView(template?: ReviewTemplateRecord | null) {
  if (!template) return []
  return template.criteria.map((criterion) => ({
    id: criterion.id,
    code: criterion.criterionCode,
    name: criterion.criterionName,
    description: criterion.criterionDescription ?? undefined,
    mandatory: criterion.mandatory,
    knockout: criterion.knockout,
    passGuidance: criterion.passGuidance ?? undefined,
    revisionGuidance: criterion.revisionGuidance ?? undefined,
    failGuidance: criterion.failGuidance ?? undefined,
  }))
}

export function validateCaseReadiness(record: GateCaseRecord | null | undefined) {
  if (!record) {
    throw new AppError(400, 'AI_COMPETENCY_GATE_CASE_MISSING', '제출서를 먼저 작성해 주세요.')
  }

  const requiredCommon: Array<{ key: keyof GateCaseRecord; label: string }> = [
    { key: 'title', label: '과제명' },
    { key: 'problemStatement', label: '해결하려는 업무 문제' },
    { key: 'goalStatement', label: '목표' },
    { key: 'ownerRoleDescription', label: '본인 역할' },
    { key: 'beforeWorkflow', label: '기존 방식(Before)' },
    { key: 'afterWorkflow', label: 'AI 적용 후 방식(After)' },
    { key: 'impactSummary', label: '측정 지표 / 효과 요약' },
    { key: 'humanReviewControl', label: '사람의 최종 검토/판단 방식' },
    { key: 'securityEthicsPrivacyHandling', label: '보안/윤리/개인정보 대응' },
    { key: 'teamOrganizationAdoption', label: '팀/조직 적용 또는 공유/확산 근거' },
  ]

  for (const item of requiredCommon) {
    const value = record[item.key]
    if (typeof value !== 'string' || !value.trim()) {
      throw new AppError(400, 'AI_COMPETENCY_GATE_SUBMIT_VALIDATION_ERROR', `${item.label}을(를) 입력해 주세요.`)
    }
  }

  if (!record.track) {
    throw new AppError(400, 'AI_COMPETENCY_GATE_TRACK_REQUIRED', '트랙을 선택해 주세요.')
  }
  if (!record.prohibitedAutomationAcknowledged) {
    throw new AppError(400, 'AI_COMPETENCY_GATE_PROHIBITED_AUTOMATION_REQUIRED', 'AI의 최종 자동 판단 금지 확인이 필요합니다.')
  }
  if (!record.finalDeclarationAccepted) {
    throw new AppError(400, 'AI_COMPETENCY_GATE_DECLARATION_REQUIRED', '최종 자기 점검/서약에 동의해 주세요.')
  }
  if (!record.evidenceItems.length) {
    throw new AppError(400, 'AI_COMPETENCY_GATE_EVIDENCE_REQUIRED', '증빙 자료를 1건 이상 등록해 주세요.')
  }

  const meaningfulMetrics = record.metrics.filter(
    (metric) =>
      (metric.metricName?.trim().length ?? 0) > 0 &&
      (metric.verificationMethod?.trim().length ?? 0) > 0
  )
  if (!meaningfulMetrics.length) {
    throw new AppError(400, 'AI_COMPETENCY_GATE_METRIC_REQUIRED', '측정 지표를 1개 이상 입력해 주세요.')
  }

  if (record.track === 'AI_PROJECT_EXECUTION') {
    if (!record.projectDetail?.projectBackground?.trim()) {
      throw new AppError(400, 'AI_COMPETENCY_GATE_PROJECT_BACKGROUND_REQUIRED', '프로젝트 배경을 입력해 주세요.')
    }
    if (!record.projectDetail.executionSteps?.trim()) {
      throw new AppError(400, 'AI_COMPETENCY_GATE_PROJECT_EXECUTION_STEPS_REQUIRED', '실행 단계를 입력해 주세요.')
    }
    if (!record.projectDetail.deliverables?.trim()) {
      throw new AppError(400, 'AI_COMPETENCY_GATE_PROJECT_DELIVERABLES_REQUIRED', '산출물을 입력해 주세요.')
    }
    if (!record.projectDetail.ownerPmRoleDetail?.trim()) {
      throw new AppError(400, 'AI_COMPETENCY_GATE_PROJECT_OWNER_PM_REQUIRED', 'PM/Owner 역할 증빙을 입력해 주세요.')
    }
  }

  if (record.track === 'AI_USE_CASE_EXPANSION') {
    if (!record.adoptionDetail?.useCaseDescription?.trim()) {
      throw new AppError(400, 'AI_COMPETENCY_GATE_USE_CASE_REQUIRED', '실제 활용 사례 설명을 입력해 주세요.')
    }
    if (!record.adoptionDetail.teamDivisionScope?.trim()) {
      throw new AppError(400, 'AI_COMPETENCY_GATE_SCOPE_REQUIRED', '팀/본부 적용 범위를 입력해 주세요.')
    }
    if (!record.adoptionDetail.measuredEffectDetail?.trim()) {
      throw new AppError(400, 'AI_COMPETENCY_GATE_EFFECT_DETAIL_REQUIRED', '측정 가능한 효과 상세를 입력해 주세요.')
    }
    if (!record.adoptionDetail.seminarSharingEvidence?.trim()) {
      throw new AppError(400, 'AI_COMPETENCY_GATE_SHARING_EVIDENCE_REQUIRED', '세미나/공유 근거를 입력해 주세요.')
    }
  }
}

export function validateReviewDecision(params: {
  criteria: ReviewTemplateRecord['criteria']
  items: Array<{ criterionId: string; decision: AiCompetencyGateDecision; comment: string; requiredFix?: string | null }>
  action: AiCompetencyGateDecision
  nonRemediable?: boolean
}) {
  const itemMap = new Map(params.items.map((item) => [item.criterionId, item] as const))
  for (const criterion of params.criteria) {
    if (!itemMap.has(criterion.id)) {
      throw new AppError(400, 'AI_COMPETENCY_GATE_REVIEW_ITEM_MISSING', `${criterion.criterionName} 평가가 누락되었습니다.`)
    }
  }

  if (params.action === 'PASS') {
    for (const criterion of params.criteria) {
      const item = itemMap.get(criterion.id)
      if (!item) continue
      if (criterion.mandatory && item.decision !== 'PASS') {
        throw new AppError(400, 'AI_COMPETENCY_GATE_PASS_BLOCKED', '모든 필수 기준이 통과여야 최종 Pass 처리할 수 있습니다.')
      }
      if (criterion.knockout && item.decision === 'FAIL') {
        throw new AppError(400, 'AI_COMPETENCY_GATE_PASS_KNOCKOUT_BLOCKED', 'Knockout 기준 실패가 있어 Pass 처리할 수 없습니다.')
      }
    }
  }

  if (params.action === 'REVISION_REQUIRED') {
    const hasActionableFix = params.items.some((item) => Boolean(item.requiredFix?.trim()))
    if (!hasActionableFix) {
      throw new AppError(400, 'AI_COMPETENCY_GATE_REVISION_FIX_REQUIRED', '보완 요청 시 최소 1개 이상의 구체적인 보완 요청을 입력해 주세요.')
    }
  }

  if (params.action === 'FAIL') {
    const hasKnockoutFail = params.criteria.some((criterion) => {
      const item = itemMap.get(criterion.id)
      return criterion.knockout && item?.decision === 'FAIL'
    })
    if (!hasKnockoutFail && !params.nonRemediable) {
      throw new AppError(
        400,
        'AI_COMPETENCY_GATE_FAIL_REASON_REQUIRED',
        'Fail 처리는 Knockout 실패가 있거나 비가역적 사유가 확인된 경우에만 가능합니다.'
      )
    }
  }
}

export function buildEvidenceSummary(record?: GateCaseRecord | null) {
  return (record?.evidenceItems ?? []).map((item) => ({
    id: item.id,
    evidenceType: item.evidenceType,
    title: item.title,
    description: item.description ?? '',
    fileName: item.fileName ?? undefined,
    mimeType: item.mimeType ?? undefined,
    sizeBytes: item.sizeBytes ?? undefined,
    linkUrl: item.linkUrl ?? undefined,
    textNote: item.textNote ?? undefined,
    createdAt: item.createdAt.toISOString(),
    hasFile: Boolean(item.content && item.fileName),
  }))
}

export function buildCaseSnapshotPayload(params: {
  assignment: GateAssignmentRecord
  caseRecord: GateCaseRecord
  actorId: string
  actorName: string
}) {
  const latestReview = buildLatestReview(params.caseRecord)
  return {
    assignment: {
      id: params.assignment.id,
      cycleId: params.assignment.cycleId,
      cycleName: params.assignment.cycle.cycleName,
      evalCycleId: params.assignment.cycle.evalCycleId,
      status: params.assignment.status,
      employeeId: params.assignment.employeeId,
      employeeName: params.assignment.employeeNameSnapshot,
      departmentName: params.assignment.departmentNameSnapshot,
      position: params.assignment.positionSnapshot,
      reviewerId: params.assignment.reviewerId ?? null,
      reviewerName: params.assignment.reviewerNameSnapshot ?? null,
      currentRevisionRound: params.assignment.currentRevisionRound,
      createdAt: params.assignment.createdAt.toISOString(),
      updatedAt: params.assignment.updatedAt.toISOString(),
    },
    submissionCase: {
      id: params.caseRecord.id,
      track: params.caseRecord.track,
      form: serializeCaseFormData(params.caseRecord),
      evidenceItems: buildEvidenceSummary(params.caseRecord),
      latestReview,
    },
    actor: {
      id: params.actorId,
      name: params.actorName,
      capturedAt: new Date().toISOString(),
    },
  }
}

export async function createGateSnapshot(params: {
  db: Prisma.TransactionClient | typeof prisma
  assignmentId: string
  caseId: string
  snapshotType: 'SUBMIT' | 'REVISION_REQUEST' | 'RESUBMIT' | 'FINAL_DECISION'
  revisionRound: number
  payload: Prisma.JsonObject
  createdById: string
  createdByNameSnapshot: string
}) {
  return params.db.aiCompetencyGateSnapshot.create({
    data: {
      assignmentId: params.assignmentId,
      caseId: params.caseId,
      snapshotType: params.snapshotType,
      revisionRound: params.revisionRound,
      payload: params.payload,
      createdById: params.createdById,
      createdByNameSnapshot: params.createdByNameSnapshot,
    },
  })
}

export async function writeGateDecisionHistory(params: {
  db: Prisma.TransactionClient | typeof prisma
  assignmentId: string
  caseId?: string | null
  actorId: string
  actorNameSnapshot: string
  fromStatus?: AiCompetencyGateStatus | null
  toStatus: AiCompetencyGateStatus
  action: string
  comment?: string | null
}) {
  return params.db.aiCompetencyGateDecisionHistory.create({
    data: {
      assignmentId: params.assignmentId,
      caseId: params.caseId ?? undefined,
      actorId: params.actorId,
      actorNameSnapshot: params.actorNameSnapshot,
      fromStatus: params.fromStatus ?? undefined,
      toStatus: params.toStatus,
      action: params.action,
      comment: params.comment ?? undefined,
    },
  })
}

export async function updateAssignmentStatus(params: {
  db: Prisma.TransactionClient | typeof prisma
  assignmentId: string
  nextStatus: AiCompetencyGateStatus
  submittedAt?: Date | null
  reviewStartedAt?: Date | null
  decisionAt?: Date | null
  closedAt?: Date | null
  currentRevisionRound?: number
  reviewerId?: string | null
  reviewerNameSnapshot?: string | null
  adminNote?: string | null
}) {
  return params.db.aiCompetencyGateAssignment.update({
    where: { id: params.assignmentId },
    data: {
      status: params.nextStatus,
      submittedAt: params.submittedAt === undefined ? undefined : params.submittedAt,
      reviewStartedAt: params.reviewStartedAt === undefined ? undefined : params.reviewStartedAt,
      decisionAt: params.decisionAt === undefined ? undefined : params.decisionAt,
      closedAt: params.closedAt === undefined ? undefined : params.closedAt,
      currentRevisionRound:
        params.currentRevisionRound === undefined ? undefined : params.currentRevisionRound,
      reviewerId: params.reviewerId === undefined ? undefined : params.reviewerId,
      reviewerNameSnapshot:
        params.reviewerNameSnapshot === undefined ? undefined : params.reviewerNameSnapshot,
      adminNote: params.adminNote === undefined ? undefined : params.adminNote,
    },
  })
}
