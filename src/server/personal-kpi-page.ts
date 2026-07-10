import type {
  AIApprovalStatus,
  AIRequestStatus,
  Difficulty,
  KpiStatus,
  KpiType,
  Prisma,
  SystemRole,
} from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { parseMonthlyAttachments, type MonthlyAttachmentItem } from '@/lib/monthly-attachments'
import {
  buildPersonalKpiTargetValuePersistence,
  formatPersonalKpiTargetValues,
  resolvePersonalKpiTargetValues,
} from '@/lib/personal-kpi-target-values'
import {
  buildPersonalKpiPermissions,
  canManagePersonalKpi,
  getPersonalKpiScopeDepartmentIds,
  resolvePersonalKpiAiAccess,
  toPersonalKpiAiAccessView,
  type PersonalKpiAiAccessView,
} from '@/lib/personal-kpi-access'
import {
  EVALUATION_POLICY_2026,
  isEvaluationPolicyItemCategory,
  type EvaluationPolicyItemCategoryCode,
} from '@/lib/evaluation-policy-2026'
import {
  hasRejectedRevisionPending,
  resolvePersonalKpiOperationalStatus,
  type PersonalKpiOperationalStatus,
} from './personal-kpi-workflow'
import {
  classifyOrgKpiForPersonalMbo2026,
  detectDailyWorkDuplicateWithOrgGoal2026,
  normalizeOrgKpiHrReflectionState2026,
  validatePersonalKpiMboCategory2026,
  type KpiAlignmentHrReflectionState2026,
  type KpiAlignmentOrgLevel2026,
  type MboPolicyIssue2026,
  type MboPolicySeverity2026,
  type OrgKpiAlignmentInput2026,
  type OrgKpiPersonalMboClassification2026,
  type PersonalMboItemInput2026,
} from './kpi-alignment-policy-2026'
import { resolveTargetAmount } from '@/lib/resolve-target-amount'

export type PersonalKpiPageState =
  | 'ready'
  | 'empty'
  | 'no-target'
  | 'setup-required'
  | 'permission-denied'
  | 'error'

export type PersonalKpiPageAlert = {
  title: string
  description: string
}

export type PersonalKpiScopeOption = {
  id: string
  name: string
  departmentName: string
  role: SystemRole
}

export type EvalCycleOption = {
  id: string
  name: string
  year: number
  status: string
}

export type PersonalKpiTimelineItem = {
  id: string
  at: string
  actor: string
  action: string
  detail?: string
  fromStatus?: string
  toStatus?: string
  note?: string
}

export type PersonalKpiWeightApprovalHistoryItem = {
  id: string
  at: string
  actor: string
  status: 'REQUESTED' | 'APPROVED' | 'REJECTED'
  note?: string
}

export type PersonalKpiWeightApprovalSummary = {
  status: 'NOT_REQUESTED' | 'PENDING' | 'APPROVED' | 'REJECTED'
  label: string
  requestedAt?: string
  reviewedAt?: string
  reviewerName?: string
  reviewNote?: string
  history: PersonalKpiWeightApprovalHistoryItem[]
}

export type PersonalKpiAiLogItem = {
  id: string
  createdAt: string
  sourceType: string
  sourceId?: string
  requesterName: string
  requestStatus: AIRequestStatus
  approvalStatus: AIApprovalStatus
  summary: string
}

export type PersonalKpiMboPolicyIssueView2026 = {
  code: MboPolicyIssue2026['code']
  severity: MboPolicySeverity2026
  message: string
  targetField?: string
  suggestedAction?: string
}

export type PersonalKpiMboPolicyGuidance2026 = {
  itemId?: string | null
  suggestedCategory: EvaluationPolicyItemCategoryCode | 'UNKNOWN'
  suggestedCategoryLabel: string
  guidanceLabel: string
  guidanceMessage: string
  severity: MboPolicySeverity2026
  source:
    | OrgKpiPersonalMboClassification2026['source']
    | 'EXPLICIT_CATEGORY'
    | 'PERSONAL_PROJECT'
    | 'PERSONAL_DAILY_WORK'
    | 'UNKNOWN'
  issues: PersonalKpiMboPolicyIssueView2026[]
  duplicateDailyWork: boolean
  duplicateMatches: Array<{
    id?: string | null
    title: string
    reason: string
  }>
  linkedOrgKpi?: {
    orgLevel: KpiAlignmentOrgLevel2026
    reflectionStatus: string
    hrReflectionState: KpiAlignmentHrReflectionState2026
    hrReflectionLabel: string
    eligibleAsOrgGoal: boolean
    requiresHrException: boolean
    exceptionReason?: string | null
    exceptionApprovedById?: string | null
    exceptionApprovedAt?: string | null
  }
  hrExceptionRequired: boolean
  displayOnly: true
}

export type PersonalKpiMboPolicySummary2026 = {
  orgGoalCandidateCount: number
  dailyWorkCandidateCount: number
  reviewNeededCount: number
  duplicateRiskCount: number
}

export type PersonalKpiViewModel = {
  id: string
  title: string
  tags: string[]
  employeeId: string
  employeeName: string
  departmentName: string
  orgKpiId?: string | null
  orgKpiTitle?: string | null
  orgKpiCategory?: string | null
  orgKpiDefinition?: string | null
  orgLineage: Array<{
    id: string
    title: string
    departmentName: string
  }>
  policyCategory?: EvaluationPolicyItemCategoryCode | null
  mboPolicy: PersonalKpiMboPolicyGuidance2026
  type: KpiType
  definition?: string
  formula?: string
  targetValue?: number | string
  targetValueT?: number
  targetValueE?: number
  targetValueS?: number
  weight: number
  difficulty?: Difficulty
  status: PersonalKpiOperationalStatus
  persistedStatus: KpiStatus
  reviewComment?: string
  reviewer?: {
    id: string
    name: string
  }
  monthlyAchievementRate?: number
  updatedAt?: string
  hasRejectedRevision: boolean
  linkedMonthlyCount: number
  riskFlags: string[]
  cloneInfo?: {
    sourceId: string
    sourceTitle: string
    sourceOwnerName?: string
    sourceEvalYear: number
    includedProgress: boolean
    includedCheckins: boolean
    progressEntryCount: number
    checkinEntryCount: number
    assignedToSelf: boolean
    clonedAt?: string
  }
  recentMonthlyRecords: Array<{
    id: string
    month: string
    achievementRate?: number
    activities?: string | null
    obstacles?: string | null
    evidenceComment?: string | null
  }>
  goalType: 'GENERAL' | 'SALES_REVENUE'
  targetAmount: string | null
  isReferenceSalesTarget: boolean
  evidenceRecord: {
    recordId?: string
    yearMonth: string
    evidenceComment?: string
    attachments: MonthlyAttachmentItem[]
  }
  weightApproval: PersonalKpiWeightApprovalSummary
  history: PersonalKpiTimelineItem[]
}

export type PersonalKpiReviewQueueItem = {
  id: string
  employeeId: string
  employeeName: string
  departmentName: string
  title: string
  tags: string[]
  status: 'SUBMITTED' | 'MANAGER_REVIEW'
  changedFields: string[]
  previousValueSummary?: string
  currentValueSummary?: string
  submittedAt?: string
  reviewComment?: string
  weight: number
  orgKpiTitle?: string | null
  orgLineage: Array<{
    id: string
    title: string
    departmentName: string
  }>
  weightApproval: PersonalKpiWeightApprovalSummary
}

export type OrgKpiOption = {
  id: string
  deptId: string
  title: string
  category?: string
  departmentName: string
  description?: string | null
  targetAmount: string | null
  mboReflection?: {
    state: KpiAlignmentHrReflectionState2026
    label: string
    personalMboLabel: string
    guidance: string
    eligibleAsOrgGoal: boolean
    defaultPersonalMboCategory: EvaluationPolicyItemCategoryCode
    requiresHrException: boolean
    exceptionReason?: string | null
    exceptionApprovedById?: string | null
    exceptionApprovedAt?: string | null
  }
}

export type PersonalKpiPageData = {
  state: PersonalKpiPageState
  message?: string
  alerts?: PersonalKpiPageAlert[]
  selectedYear: number
  selectedEmployeeId: string
  selectedCycleId?: string
  cycleOptions: EvalCycleOption[]
  employeeOptions: PersonalKpiScopeOption[]
  orgKpiOptions: OrgKpiOption[]
  summary: {
    totalCount: number
    totalWeight: number
    remainingWeight: number
    linkedOrgKpiCount: number
    rejectedCount: number
    reviewPendingCount: number
    monthlyCoverageRate: number
    overallStatus: PersonalKpiOperationalStatus | 'MIXED'
    mboPolicy: PersonalKpiMboPolicySummary2026
  }
  mine: PersonalKpiViewModel[]
  reviewQueue: PersonalKpiReviewQueueItem[]
  history: PersonalKpiTimelineItem[]
  aiLogs: PersonalKpiAiLogItem[]
  permissions: {
    canEdit: boolean
    canCreate: boolean
    canSubmit: boolean
    canReview: boolean
    canLock: boolean
    canUseAi: boolean
    canUseMidcheckCoach: boolean
    canOverride: boolean
  }
  aiAccess: PersonalKpiAiAccessView
  actor: {
    id: string
    deptId: string
    role: SystemRole
    name: string
    departmentName: string
    jobCategory: 'GENERAL' | 'SALES'
  }
}

type PersonalKpiWithRelations = Prisma.PersonalKpiGetPayload<{
  include: {
    employee: {
      include: {
        department: true
      }
    }
    linkedOrgKpi: {
      include: {
        department: true
        teamKpiReviewItems: {
          orderBy: {
            createdAt: 'desc'
          }
          take: 1
          select: {
            verdict: true
          }
        }
      }
    }
    monthlyRecords: {
      orderBy: {
        yearMonth: 'desc'
      }
      take: 6
    }
    copiedFromPersonalKpi: {
      select: {
        id: true
        kpiName: true
        evalYear: true
        employee: {
          select: {
            empName: true
          }
        }
      }
    }
  }
}>

type ReviewQueueKpi = Prisma.PersonalKpiGetPayload<{
  include: {
    employee: {
      include: {
        department: true
      }
    }
    linkedOrgKpi: true
    monthlyRecords: {
      orderBy: {
        yearMonth: 'desc'
      }
      take: 1
    }
  }
}>

type OrgKpiRecord = Prisma.OrgKpiGetPayload<{
  include: {
    department: true
    parentOrgKpi: {
      select: {
        id: true
        kpiName: true
        deptId: true
        parentOrgKpiId: true
        department: {
          select: {
            deptName: true
          }
        }
      }
    }
    teamKpiReviewItems: {
      orderBy: {
        createdAt: 'desc'
      }
      take: 1
      select: {
        verdict: true
      }
    }
  }
}>

type PersonalAiLogRecord = Prisma.AiRequestLogGetPayload<{
  include: {
    requester: {
      select: {
        empName: true
      }
    }
  }
}>

type EmployeeLite = Prisma.EmployeeGetPayload<{
  select: {
    id: true
    empId: true
    empName: true
    role: true
    deptId: true
    teamLeaderId: true
    sectionChiefId: true
    divisionHeadId: true
    jobCategory: true
  }
}>

type DepartmentLite = {
  id: string
  deptName: string | null
  parentDeptId: string | null
  leaderEmployeeId: string | null
}

type LeadershipBootstrapScope = 'TEAM' | 'SECTION' | 'DIVISION'

type LeadershipBootstrapOrgKpi = Prisma.OrgKpiGetPayload<{
  select: {
    id: true
    deptId: true
    evalYear: true
    kpiType: true
    kpiName: true
    definition: true
    formula: true
    targetValue: true
    targetValueT: true
    targetValueE: true
    targetValueS: true
    weight: true
    difficulty: true
    status: true
  }
}>

type AuditLogLite = {
  id: string
  action: string
  entityId: string | null
  oldValue: Prisma.JsonValue | null
  newValue: Prisma.JsonValue | null
  timestamp: Date
  userId: string
}

async function loadPersonalKpiSection<T>(params: {
  alerts: PersonalKpiPageAlert[]
  title: string
  description: string
  fallback: T
  loader: () => Promise<T>
}) {
  try {
    return await params.loader()
  } catch (error) {
    console.error(`[personal-kpi] ${params.title}`, error)
    params.alerts.push({
      title: params.title,
      description: params.description,
    })
    return params.fallback
  }
}

function mapPersonalKpiSection<TInput, TOutput>(params: {
  alerts: PersonalKpiPageAlert[]
  title: string
  description: string
  items: TInput[]
  mapper: (item: TInput) => TOutput | undefined
}) {
  const mapped: TOutput[] = []
  let failed = false

  for (const item of params.items) {
    try {
      const next = params.mapper(item)
      if (typeof next !== 'undefined') {
        mapped.push(next)
      }
    } catch (error) {
      failed = true
      console.error(`[personal-kpi] ${params.title}`, error)
    }
  }

  if (failed) {
    params.alerts.push({
      title: params.title,
      description: params.description,
    })
  }

  return mapped
}

type PageParams = {
  session: {
    user: {
      id: string
      role: SystemRole
      name: string
      deptId: string
      deptName: string
      accessibleDepartmentIds: string[]
    }
  }
  year?: number
  employeeId?: string
  cycleId?: string
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function resolveDepartmentLabel(department?: { deptName?: string | null } | null) {
  const name = department?.deptName?.trim()
  return name?.length ? name : '미지정 부서'
}

function resolveLeadershipBootstrapScope(params: {
  targetEmployee: EmployeeLite
  departmentsById: Map<string, DepartmentLite>
}): LeadershipBootstrapScope | null {
  switch (params.targetEmployee.role) {
    case 'ROLE_DIV_HEAD':
      return 'DIVISION'
    case 'ROLE_SECTION_CHIEF':
      return 'SECTION'
    case 'ROLE_TEAM_LEADER':
      return 'TEAM'
    default:
      break
  }

  const currentDepartment = params.departmentsById.get(params.targetEmployee.deptId)
  if (currentDepartment?.leaderEmployeeId === params.targetEmployee.id) {
    return 'TEAM'
  }

  return null
}

function buildLeadershipBootstrapMetadata(params: {
  scope: LeadershipBootstrapScope
  sourceOrgKpiId: string
  sourceStatus: string
}) {
  return {
    autoBootstrapFromOrgKpi: {
      sourceOrgKpiId: params.sourceOrgKpiId,
      scope: params.scope,
      sourceStatus: params.sourceStatus,
      version: 1,
    },
  } satisfies Prisma.InputJsonValue
}

function buildPersonalKpiBootstrapPayloadFromOrgKpi(params: {
  employeeId: string
  evalYear: number
  scope: LeadershipBootstrapScope
  orgKpi: LeadershipBootstrapOrgKpi
}) {
  const metadata = buildLeadershipBootstrapMetadata({
    scope: params.scope,
    sourceOrgKpiId: params.orgKpi.id,
    sourceStatus: params.orgKpi.status,
  })
  const resolvedTargetValues = resolvePersonalKpiTargetValues(params.orgKpi)

  return {
    employeeId: params.employeeId,
    evalYear: params.evalYear,
    kpiType: params.orgKpi.kpiType,
    kpiName: params.orgKpi.kpiName,
    definition: params.orgKpi.definition,
    formula: params.orgKpi.formula,
    ...(resolvedTargetValues.targetValueT !== undefined
      ? buildPersonalKpiTargetValuePersistence({
          targetValueT: resolvedTargetValues.targetValueT,
          targetValueE: resolvedTargetValues.targetValueE ?? null,
          targetValueS: resolvedTargetValues.targetValueS ?? null,
          copyMetadata: metadata,
        })
      : { copyMetadata: metadata }),
    weight: params.orgKpi.weight,
    difficulty: params.orgKpi.difficulty,
    linkedOrgKpiId: params.orgKpi.id,
    status: 'DRAFT' as const,
  }
}

async function autoBootstrapLeadershipPersonalKpis(params: {
  sessionUserId: string
  targetEmployee: EmployeeLite
  departmentsById: Map<string, DepartmentLite>
  selectedYear: number
  goalEditLocked: boolean
}) {
  const scope = resolveLeadershipBootstrapScope({
    targetEmployee: params.targetEmployee,
    departmentsById: params.departmentsById,
  })
  if (!scope || params.goalEditLocked) {
    return
  }

  const sourceOrgKpis = await prisma.orgKpi.findMany({
    where: {
      deptId: params.targetEmployee.deptId,
      evalYear: params.selectedYear,
      status: {
        not: 'ARCHIVED',
      },
    },
    select: {
      id: true,
      deptId: true,
      evalYear: true,
      kpiType: true,
      kpiName: true,
      definition: true,
      formula: true,
      targetValue: true,
      targetValueT: true,
      targetValueE: true,
      targetValueS: true,
      weight: true,
      difficulty: true,
      status: true,
    },
    orderBy: [{ createdAt: 'asc' }],
  })

  if (!sourceOrgKpis.length) {
    return
  }

  const existingLinked = await prisma.personalKpi.findMany({
    where: {
      employeeId: params.targetEmployee.id,
      evalYear: params.selectedYear,
      linkedOrgKpiId: {
        in: sourceOrgKpis.map((item) => item.id),
      },
    },
    select: {
      linkedOrgKpiId: true,
    },
  })

  const existingLinkedIds = new Set(
    existingLinked
      .map((item) => item.linkedOrgKpiId)
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
  )

  const missingOrgKpis = sourceOrgKpis.filter((item) => !existingLinkedIds.has(item.id))
  if (!missingOrgKpis.length) {
    return
  }

  await prisma.personalKpi.createMany({
    data: missingOrgKpis.map((orgKpi) =>
      buildPersonalKpiBootstrapPayloadFromOrgKpi({
        employeeId: params.targetEmployee.id,
        evalYear: params.selectedYear,
        scope,
        orgKpi,
      })
    ),
  })

  console.info('[personal-kpi-bootstrap] leadership scope imported', {
    actorId: params.sessionUserId,
    targetEmployeeId: params.targetEmployee.id,
    targetRole: params.targetEmployee.role,
    scope,
    evalYear: params.selectedYear,
    createdCount: missingOrgKpis.length,
    linkedOrgKpiIds: missingOrgKpis.map((item) => item.id),
  })
}

function getReviewerCandidate(employee: EmployeeLite, employeesById: Map<string, EmployeeLite>) {
  const reviewerId = employee.teamLeaderId ?? employee.sectionChiefId ?? employee.divisionHeadId
  if (!reviewerId) return undefined
  const reviewer = employeesById.get(reviewerId)
  if (!reviewer) return undefined
  return {
    id: reviewer.id,
    name: reviewer.empName,
  }
}

function parseReviewComment(logs: AuditLogLite[]) {
  const reviewLog = logs.find((log) =>
    ['PERSONAL_KPI_REJECTED', 'PERSONAL_KPI_APPROVED', 'PERSONAL_KPI_REVIEW_STARTED'].includes(log.action)
  )
  const nextValue = asRecord(reviewLog?.newValue)
  return typeof nextValue?.note === 'string' ? nextValue.note : undefined
}

function buildWeightApprovalSummary(
  logs: AuditLogLite[],
  employeesById: Map<string, EmployeeLite>
): PersonalKpiWeightApprovalSummary {
  const approvalLogs = logs.filter((log) =>
    ['PERSONAL_KPI_SUBMITTED', 'PERSONAL_KPI_APPROVED', 'PERSONAL_KPI_REJECTED'].includes(log.action)
  )

  const history = approvalLogs.slice(0, 6).map((log) => {
    const nextValue = asRecord(log.newValue)
    const status =
      log.action === 'PERSONAL_KPI_APPROVED'
        ? 'APPROVED'
        : log.action === 'PERSONAL_KPI_REJECTED'
          ? 'REJECTED'
          : 'REQUESTED'

    return {
      id: log.id,
      at: log.timestamp.toISOString(),
      actor: employeesById.get(log.userId)?.empName ?? '시스템',
      status,
      note: typeof nextValue?.note === 'string' ? nextValue.note : undefined,
    } satisfies PersonalKpiWeightApprovalHistoryItem
  })

  const latest = history[0]
  const requested = history.find((item) => item.status === 'REQUESTED')
  const reviewed = history.find((item) => item.status === 'APPROVED' || item.status === 'REJECTED')

  if (!latest) {
    return {
      status: 'NOT_REQUESTED',
      label: '가중치 승인 요청 전',
      history: [],
    }
  }

  return {
    status:
      latest.status === 'REQUESTED'
        ? 'PENDING'
        : latest.status === 'APPROVED'
          ? 'APPROVED'
          : 'REJECTED',
    label:
      latest.status === 'REQUESTED'
        ? '승인 대기'
        : latest.status === 'APPROVED'
          ? '승인 완료'
          : '반려',
    requestedAt: requested?.at,
    reviewedAt: reviewed?.at,
    reviewerName:
      reviewed && reviewed.status !== 'REQUESTED'
        ? reviewed.actor
        : undefined,
    reviewNote: reviewed?.note,
    history,
  }
}

function getChangedFields(logs: AuditLogLite[]) {
  const updated = logs.find((log) => log.action === 'PERSONAL_KPI_UPDATED')
  const oldValue = asRecord(updated?.oldValue)
  const newValue = asRecord(updated?.newValue)
  if (!oldValue || !newValue) return []

  return Object.keys(newValue).filter((key) => JSON.stringify(oldValue[key]) !== JSON.stringify(newValue[key]))
}

function buildSummaryText(record: Record<string, unknown> | null) {
  if (!record) return undefined
  const title = typeof record.kpiName === 'string' ? record.kpiName : ''
  const weight = typeof record.weight === 'number' ? `${record.weight}%` : ''
  const targetValue = formatPersonalKpiTargetValues({
    targetValue: typeof record.targetValue === 'number' ? record.targetValue : undefined,
    targetValueT: typeof record.targetValueT === 'number' ? record.targetValueT : undefined,
    targetValueE: typeof record.targetValueE === 'number' ? record.targetValueE : undefined,
    targetValueS: typeof record.targetValueS === 'number' ? record.targetValueS : undefined,
    copyMetadata: record.copyMetadata,
  })
  return [title, targetValue, weight].filter(Boolean).join(' · ')
}

function mapHistoryItem(log: AuditLogLite, employeesById: Map<string, EmployeeLite>): PersonalKpiTimelineItem {
  const actor = employeesById.get(log.userId)?.empName ?? '시스템'
  const oldValue = asRecord(log.oldValue)
  const newValue = asRecord(log.newValue)

  return {
    id: log.id,
    at: log.timestamp.toISOString(),
    actor,
    action: log.action,
    detail:
      typeof newValue?.detail === 'string'
        ? newValue.detail
        : typeof newValue?.reason === 'string'
          ? newValue.reason
          : undefined,
    fromStatus:
      typeof oldValue?.workflowStatus === 'string'
        ? oldValue.workflowStatus
        : typeof oldValue?.status === 'string'
          ? oldValue.status
          : undefined,
    toStatus:
      typeof newValue?.workflowStatus === 'string'
        ? newValue.workflowStatus
        : typeof newValue?.status === 'string'
          ? newValue.status
          : undefined,
    note: typeof newValue?.note === 'string' ? newValue.note : undefined,
  }
}

function deriveRiskFlags(kpi: PersonalKpiWithRelations, hasRejectedRevision: boolean) {
  const flags: string[] = []
  if (!kpi.linkedOrgKpiId) flags.push('조직 KPI 연결 필요')
  if (kpi.weight <= 0) flags.push('가중치 확인 필요')
  const latestRecord = kpi.monthlyRecords[0]
  if (!latestRecord) {
    flags.push('최근 월간 실적 없음')
  } else if ((latestRecord.achievementRate ?? 100) < 80) {
    flags.push('최근 달성률 저조')
  }
  if (hasRejectedRevision) flags.push('반려 후 수정 필요')
  return flags
}

function parseCloneInfo(kpi: PersonalKpiWithRelations): PersonalKpiViewModel['cloneInfo'] {
  if (!kpi.copiedFromPersonalKpiId || !kpi.copiedFromPersonalKpi) {
    return undefined
  }

  const metadata = asRecord(kpi.copyMetadata)
  const progressSnapshot = Array.isArray(metadata?.progressSnapshot) ? metadata.progressSnapshot : []
  const checkinSnapshot = Array.isArray(metadata?.checkinSnapshot) ? metadata.checkinSnapshot : []

  return {
    sourceId: kpi.copiedFromPersonalKpi.id,
    sourceTitle: kpi.copiedFromPersonalKpi.kpiName,
    sourceOwnerName: kpi.copiedFromPersonalKpi.employee.empName,
    sourceEvalYear:
      typeof metadata?.sourceEvalYear === 'number'
        ? metadata.sourceEvalYear
        : kpi.copiedFromPersonalKpi.evalYear,
    includedProgress: metadata?.includedProgress === true,
    includedCheckins: metadata?.includedCheckins === true,
    progressEntryCount: progressSnapshot.length,
    checkinEntryCount: checkinSnapshot.length,
    assignedToSelf: metadata?.assignedToSelf === true,
    clonedAt: typeof metadata?.clonedAt === 'string' ? metadata.clonedAt : undefined,
  }
}

function parseTags(value: Prisma.JsonValue | null): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function resolvePersonalKpiEvidenceYearMonth(
  selectedYear: number,
  monthlyRecords: Array<{ yearMonth: string }>
) {
  const today = new Date()
  const preferred = `${selectedYear}-${String(today.getMonth() + 1).padStart(2, '0')}`

  return monthlyRecords.find((record) => record.yearMonth === preferred)?.yearMonth
    ?? monthlyRecords[0]?.yearMonth
    ?? preferred
}

function deriveOverallStatus(items: PersonalKpiViewModel[]): PersonalKpiPageData['summary']['overallStatus'] {
  if (!items.length) return 'DRAFT'
  const statuses = Array.from(new Set(items.map((item) => item.status)))
  return statuses.length === 1 ? statuses[0] : 'MIXED'
}

function getMboPolicyCategoryLabel2026(category: EvaluationPolicyItemCategoryCode | 'UNKNOWN') {
  if (category === 'UNKNOWN') return '검토 필요'
  return EVALUATION_POLICY_2026.categories[category].labelKo
}

function normalizeMboPolicyIssue2026(issue: MboPolicyIssue2026): PersonalKpiMboPolicyIssueView2026 {
  return {
    code: issue.code,
    severity: issue.severity,
    message: issue.message,
    targetField: issue.targetField,
    suggestedAction: issue.suggestedAction,
  }
}

function maxMboPolicySeverity2026(issues: PersonalKpiMboPolicyIssueView2026[]): MboPolicySeverity2026 {
  if (issues.some((issue) => issue.severity === 'blocker')) return 'blocker'
  if (issues.some((issue) => issue.severity === 'warning')) return 'warning'
  return 'info'
}

function inferOrgKpiLevelForPersonalMbo2026(
  orgKpi: {
    parentOrgKpiId?: string | null
    department?: {
      deptName?: string | null
    } | null
  },
  orgKpiById?: ReadonlyMap<string, { parentOrgKpiId?: string | null }>
): KpiAlignmentOrgLevel2026 {
  const deptName = orgKpi.department?.deptName ?? ''
  if (deptName.includes('본부') || /division/i.test(deptName)) return 'DIVISION'
  if (deptName.includes('실') || /section/i.test(deptName)) return 'SECTION'
  if (deptName.includes('팀') || /team/i.test(deptName)) return 'TEAM'
  if (!orgKpi.parentOrgKpiId) return 'DIVISION'

  const parent = orgKpiById?.get(orgKpi.parentOrgKpiId)
  if (parent && !parent.parentOrgKpiId) return 'TEAM'
  return 'TEAM'
}

type OrgKpiAlignmentSourceForPersonal2026 = {
  id: string
  kpiName: string
  definition?: string | null
  formula?: string | null
  status?: string | null
  parentOrgKpiId?: string | null
  mboExceptionApproved?: boolean | null
  mboExceptionReason?: string | null
  mboExceptionApprovedById?: string | null
  mboExceptionApprovedAt?: Date | string | null
  department?: {
    id?: string | null
    deptName?: string | null
    parentDeptId?: string | null
  } | null
  teamKpiReviewItems?: Array<{ verdict: string }>
}

function toOrgKpiAlignmentInput2026(
  orgKpi: OrgKpiAlignmentSourceForPersonal2026 | null | undefined,
  orgKpiById?: Map<string, OrgKpiRecord>
): OrgKpiAlignmentInput2026 | null {
  if (!orgKpi) return null
  return {
    id: orgKpi.id,
    title: orgKpi.kpiName,
    kpiName: orgKpi.kpiName,
    definition: orgKpi.definition,
    formula: orgKpi.formula,
    level: inferOrgKpiLevelForPersonalMbo2026(orgKpi, orgKpiById),
    department: {
      id: orgKpi.department?.id,
      deptName: orgKpi.department?.deptName,
      parentDeptId: orgKpi.department?.parentDeptId,
    },
    status: orgKpi.status,
    parentOrgKpiId: orgKpi.parentOrgKpiId,
    latestReviewVerdict: orgKpi.teamKpiReviewItems?.[0]?.verdict ?? null,
    hrExceptionApproved: orgKpi.mboExceptionApproved,
    hrExceptionReason: orgKpi.mboExceptionReason,
    hrExceptionApprovedById: orgKpi.mboExceptionApprovedById,
    hrExceptionApprovedAt: orgKpi.mboExceptionApprovedAt,
  }
}

function buildPersonalOrgKpiOptionMboReflection2026(
  orgKpi: OrgKpiRecord,
  orgKpiById: Map<string, OrgKpiRecord>
): NonNullable<OrgKpiOption['mboReflection']> {
  const input = toOrgKpiAlignmentInput2026(orgKpi, orgKpiById)
  const normalized = normalizeOrgKpiHrReflectionState2026(input ?? { id: orgKpi.id, title: orgKpi.kpiName })

  return {
    state: normalized.state,
    label: normalized.labelKo,
    personalMboLabel: normalized.personalMboLabelKo,
    guidance: normalized.guidanceKo,
    eligibleAsOrgGoal: normalized.eligibleAsOrgGoal,
    defaultPersonalMboCategory: normalized.defaultPersonalMboCategory,
    requiresHrException: normalized.requiresHrException,
    exceptionReason: normalized.exceptionReason,
    exceptionApprovedById: normalized.exceptionApprovedById,
    exceptionApprovedAt: normalized.exceptionApprovedAt,
  }
}

function getExplicitMboCategory2026(value: unknown): EvaluationPolicyItemCategoryCode | null {
  return isEvaluationPolicyItemCategory(value) ? value : null
}

function getDefaultGuidanceMessage2026(params: {
  explicitCategory: EvaluationPolicyItemCategoryCode | null
  suggestedCategory: EvaluationPolicyItemCategoryCode | 'UNKNOWN'
  classification: OrgKpiPersonalMboClassification2026 | null
}) {
  if (params.classification?.source === 'DIVISION_KPI') {
    return {
      label: '조직목표 후보',
      message: '본부 KPI와 연결되어 2026 정책상 조직목표 후보입니다.',
    }
  }
  if (params.classification?.source === 'TEAM_KPI_REFLECTED') {
    return {
      label: '조직목표 후보',
      message: 'HR 반영 완료 팀 KPI로 2026 정책상 조직목표 후보입니다.',
    }
  }
  if (params.classification?.source === 'HR_EXCEPTION') {
    return {
      label: '조직목표 후보',
      message: 'HR 예외 승인 맥락이 있어 팀 KPI를 조직목표 후보로 볼 수 있습니다.',
    }
  }
  if (params.classification?.source === 'TEAM_KPI_DEFAULT_DAILY_WORK') {
    if (params.classification.eligibility.hrReflectionState === 'HR_REVIEWING') {
      return {
        label: '검토 중',
        message: 'HR 검토 중인 팀 KPI입니다. 반영 완료 전까지는 기본적으로 일상업무로 안내합니다.',
      }
    }
    if (params.classification.eligibility.hrReflectionState === 'EXCEPTION_REQUIRED') {
      return {
        label: '예외 승인 필요',
        message: 'HR 반영 완료되지 않은 팀 KPI입니다. 조직목표로 쓰려면 HR 예외 승인이 필요합니다.',
      }
    }
    return {
      label: '일상업무 후보',
      message: '본부 KPI에 포함되지 않았거나 HR 반영 완료되지 않은 팀 KPI로, 기본적으로 일상업무로 분류됩니다.',
    }
  }
  if (params.explicitCategory === 'PROJECT_T') {
    return {
      label: '프로젝트 T',
      message: '개인 프로젝트 T로 분류된 항목입니다. 산출물과 성과 중심으로 작성해 주세요.',
    }
  }
  if (params.explicitCategory === 'PROJECT_K') {
    return {
      label: '프로젝트 K',
      message: '개인 프로젝트 K로 분류된 항목입니다. 산출물과 성과 중심으로 작성해 주세요.',
    }
  }
  if (params.explicitCategory === 'ORG_GOAL') {
    return {
      label: '조직목표 후보',
      message: '조직목표로 분류된 항목입니다. 연결된 본부 KPI 또는 HR 반영/예외 승인 상태를 확인해 주세요.',
    }
  }
  if (params.explicitCategory === 'DAILY_WORK' || params.suggestedCategory === 'DAILY_WORK') {
    return {
      label: '일상업무 후보',
      message: '일상업무 후보입니다. 조직목표에 포함된 업무와 중복되지 않는지 확인해 주세요.',
    }
  }
  return {
    label: '검토 필요',
    message: '정책 카테고리를 확인해 주세요.',
  }
}

export function buildPersonalKpiMboPolicyGuidance2026(params: {
  item: PersonalMboItemInput2026
  orgGoalItems?: PersonalMboItemInput2026[]
}): PersonalKpiMboPolicyGuidance2026 {
  const explicitCategory = getExplicitMboCategory2026(params.item.policyCategory ?? params.item.category)
  const classification = params.item.linkedOrgKpi ? classifyOrgKpiForPersonalMbo2026(params.item.linkedOrgKpi) : null
  const hrReflection = params.item.linkedOrgKpi ? normalizeOrgKpiHrReflectionState2026(params.item.linkedOrgKpi) : null
  const suggestedCategory = explicitCategory ?? classification?.category ?? 'UNKNOWN'
  const issues: PersonalKpiMboPolicyIssueView2026[] = []

  if (!explicitCategory) {
    issues.push({
      code: 'MISSING_MBO_CATEGORY',
      severity: 'warning',
      message: '정책 카테고리 미분류 항목입니다. 2026 MBO 기준에 맞는 카테고리 확인이 필요합니다.',
      targetField: 'policyCategory',
      suggestedAction: '조직목표, 프로젝트 T, 프로젝트 K, 일상업무 중 하나로 검토해 주세요.',
    })
  }

  if (suggestedCategory !== 'UNKNOWN') {
    const diagnostic = validatePersonalKpiMboCategory2026({
      item: {
        ...params.item,
        policyCategory: explicitCategory ?? suggestedCategory,
      },
      orgGoalItems: (params.orgGoalItems ?? []).filter((orgGoal) => orgGoal.id !== params.item.id),
    })
    issues.push(...diagnostic.issues.map(normalizeMboPolicyIssue2026))
  } else if (classification?.issues.length) {
    issues.push(...classification.issues.map(normalizeMboPolicyIssue2026))
  }

  const duplicate =
    suggestedCategory === 'DAILY_WORK'
      ? detectDailyWorkDuplicateWithOrgGoal2026({
          dailyWork: {
            id: params.item.id,
            title: params.item.title,
            kpiName: params.item.kpiName,
            definition: params.item.definition,
            formula: params.item.formula,
            linkedOrgKpiId: params.item.linkedOrgKpiId,
          },
          orgGoals: (params.orgGoalItems ?? []).filter((orgGoal) => orgGoal.id !== params.item.id),
        })
      : { duplicated: false, matches: [] }

  if (duplicate.duplicated && !issues.some((issue) => issue.code === 'DAILY_WORK_DUPLICATES_ORG_GOAL')) {
    issues.push({
      code: 'DAILY_WORK_DUPLICATES_ORG_GOAL',
      severity: 'warning',
      message: `일상업무가 조직목표(${duplicate.matches[0]?.title ?? '조직목표'})와 중복될 수 있습니다.`,
      targetField: 'kpiName',
      suggestedAction: '조직목표에 포함된 업무는 일상업무로 중복 등록하지 않는 것이 원칙입니다.',
    })
  }

  const guidance = getDefaultGuidanceMessage2026({
    explicitCategory,
    suggestedCategory,
    classification,
  })

  return {
    itemId: params.item.id,
    suggestedCategory,
    suggestedCategoryLabel: getMboPolicyCategoryLabel2026(suggestedCategory),
    guidanceLabel: guidance.label,
    guidanceMessage: guidance.message,
    severity: maxMboPolicySeverity2026(issues),
    source:
      explicitCategory === 'PROJECT_T' || explicitCategory === 'PROJECT_K'
        ? 'PERSONAL_PROJECT'
        : explicitCategory === 'DAILY_WORK'
          ? 'PERSONAL_DAILY_WORK'
          : explicitCategory
            ? 'EXPLICIT_CATEGORY'
            : classification?.source ?? 'UNKNOWN',
    issues,
    duplicateDailyWork: duplicate.duplicated || issues.some((issue) => issue.code === 'DAILY_WORK_DUPLICATES_ORG_GOAL'),
    duplicateMatches: duplicate.matches,
    linkedOrgKpi: classification
      ? {
          orgLevel: classification.eligibility.orgLevel,
          reflectionStatus: classification.eligibility.status,
          hrReflectionState: hrReflection?.state ?? classification.eligibility.hrReflectionState,
          hrReflectionLabel: hrReflection?.labelKo ?? classification.eligibility.status,
          eligibleAsOrgGoal: classification.eligibility.eligibleAsOrgGoal,
          requiresHrException: classification.eligibility.requiresHrException,
          exceptionReason: hrReflection?.exceptionReason,
          exceptionApprovedById: hrReflection?.exceptionApprovedById,
          exceptionApprovedAt: hrReflection?.exceptionApprovedAt,
        }
      : undefined,
    hrExceptionRequired:
      Boolean(classification?.eligibility.requiresHrException) ||
      issues.some((issue) => issue.code === 'HR_EXCEPTION_REQUIRED'),
    displayOnly: true,
  }
}

export function buildPersonalKpiMboPolicyGuidanceList2026(
  items: PersonalMboItemInput2026[]
): PersonalKpiMboPolicyGuidance2026[] {
  const preliminary = items.map((item) => {
    const explicitCategory = getExplicitMboCategory2026(item.policyCategory ?? item.category)
    const classification = item.linkedOrgKpi ? classifyOrgKpiForPersonalMbo2026(item.linkedOrgKpi) : null
    return {
      item,
      suggestedCategory: explicitCategory ?? classification?.category ?? 'UNKNOWN',
    }
  })
  const orgGoalItems = preliminary
    .filter((entry) => entry.suggestedCategory === 'ORG_GOAL')
    .map((entry) => entry.item)

  return items.map((item) =>
    buildPersonalKpiMboPolicyGuidance2026({
      item,
      orgGoalItems,
    })
  )
}

export function buildPersonalKpiMboPolicySummary2026(
  guidances: PersonalKpiMboPolicyGuidance2026[]
): PersonalKpiMboPolicySummary2026 {
  return {
    orgGoalCandidateCount: guidances.filter((item) => item.suggestedCategory === 'ORG_GOAL').length,
    dailyWorkCandidateCount: guidances.filter((item) => item.suggestedCategory === 'DAILY_WORK').length,
    reviewNeededCount: guidances.filter(
      (item) =>
        item.suggestedCategory === 'UNKNOWN' ||
        item.issues.some((issue) => issue.code === 'MISSING_MBO_CATEGORY' || issue.code === 'HR_EXCEPTION_REQUIRED')
    ).length,
    duplicateRiskCount: guidances.filter((item) => item.duplicateDailyWork).length,
  }
}

export async function getPersonalKpiPageData(params: PageParams): Promise<PersonalKpiPageData> {
  const selectedYear = params.year ?? new Date().getFullYear()
  const actor = {
    id: params.session.user.id,
    deptId: params.session.user.deptId,
    role: params.session.user.role,
    name: params.session.user.name,
    departmentName: params.session.user.deptName,
    jobCategory: 'GENERAL' as 'GENERAL' | 'SALES',
  }
  const aiAccess = resolvePersonalKpiAiAccess({
    role: params.session.user.role,
  })
  const aiAccessView = toPersonalKpiAiAccessView(aiAccess)
  const emptySummary: PersonalKpiPageData['summary'] = {
    totalCount: 0,
    totalWeight: 0,
    remainingWeight: 100,
    linkedOrgKpiCount: 0,
    rejectedCount: 0,
    reviewPendingCount: 0,
    monthlyCoverageRate: 0,
    overallStatus: 'DRAFT',
    mboPolicy: {
      orgGoalCandidateCount: 0,
      dailyWorkCandidateCount: 0,
      reviewNeededCount: 0,
      duplicateRiskCount: 0,
    },
  }

  let failureStage = 'bootstrap'
  let shellEmployeeOptions: PersonalKpiScopeOption[] = []
  let shellTargetEmployee: EmployeeLite | undefined
  let shellCycleOptions: EvalCycleOption[] = []
  let shellAlerts: PersonalKpiPageAlert[] = []

  try {
    const alerts: PersonalKpiPageAlert[] = []
    shellAlerts = alerts

    const scopeDepartmentIds = getPersonalKpiScopeDepartmentIds({
      role: params.session.user.role,
      deptId: params.session.user.deptId,
      accessibleDepartmentIds: params.session.user.accessibleDepartmentIds,
    })

    failureStage = 'employee-options'
    const employees = await prisma.employee.findMany({
      where: scopeDepartmentIds
        ? { deptId: { in: scopeDepartmentIds }, status: 'ACTIVE' }
        : { status: 'ACTIVE' },
      select: {
        id: true,
        empId: true,
        empName: true,
        role: true,
        deptId: true,
        teamLeaderId: true,
        sectionChiefId: true,
        divisionHeadId: true,
        jobCategory: true,
      },
      orderBy: [{ deptId: 'asc' }, { empName: 'asc' }],
    })
    const departmentIds = Array.from(
      new Set(
        employees
          .map((employee) => employee.deptId)
          .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      )
    )
    const departments = departmentIds.length
      ? await loadPersonalKpiSection({
          alerts,
          title: '대상자 부서 정보를 모두 불러오지 못했습니다.',
          description: '대상자 목록은 유지하고, 확인되지 않은 부서는 미지정으로 표시합니다.',
          fallback: [] as DepartmentLite[],
          loader: () =>
            prisma.department.findMany({
              where: {
                id: {
                  in: departmentIds,
                },
              },
              select: {
                id: true,
                deptName: true,
                parentDeptId: true,
                leaderEmployeeId: true,
              },
            }),
        })
      : []
    const departmentNameMap = new Map(departments.map((department) => [department.id, department.deptName]))
    const departmentsById = new Map(departments.map((department) => [department.id, department]))
    const employeesById = new Map(employees.map((employee) => [employee.id, employee]))
    const collectAncestorDepartmentIds = (deptId: string) => {
      const ids: string[] = []
      let current = departmentsById.get(deptId)

      while (current?.parentDeptId) {
        ids.push(current.parentDeptId)
        current = departmentsById.get(current.parentDeptId)
      }

      return ids
    }
    const employeeOptions = employees.map((employee) => ({
      id: employee.id,
      name: employee.empName,
      departmentName: resolveDepartmentLabel({
        deptName: departmentNameMap.get(employee.deptId) ?? null,
      }),
      role: employee.role,
    }))
    shellEmployeeOptions = employeeOptions

    const requestedEmployeeId = params.employeeId?.trim() || undefined
    const requestedEmployee = requestedEmployeeId ? employeesById.get(requestedEmployeeId) : undefined
    const defaultTargetEmployee =
      employeesById.get(params.session.user.id) ??
      (canManagePersonalKpi(params.session.user.role) ? employees[0] : undefined)
    const targetEmployee = requestedEmployee ?? defaultTargetEmployee
    shellTargetEmployee = targetEmployee

    // KPI 대상자(화면 주인)의 직군·부서. viewer가 아님. 임퍼소네이션 시 대상자 기준.
    actor.jobCategory = (targetEmployee?.jobCategory ?? 'GENERAL') as 'GENERAL' | 'SALES'
    actor.deptId = targetEmployee?.deptId ?? actor.deptId

    if (requestedEmployeeId && !requestedEmployee) {
      return {
        state: 'no-target',
        message: '현재 범위에서 조회할 대상자를 찾지 못했습니다. 대상자를 다시 선택해 주세요.',
        alerts,
        selectedYear,
        selectedEmployeeId: '',
        cycleOptions: [],
        employeeOptions,
        orgKpiOptions: [],
        summary: emptySummary,
        mine: [],
        reviewQueue: [],
        history: [],
        aiLogs: [],
        permissions: buildPersonalKpiPermissions({
          actorId: params.session.user.id,
          actorRole: params.session.user.role,
          targetEmployeeId: requestedEmployeeId,
          pageState: 'no-target',
          aiAccess,
        }),
        aiAccess: aiAccessView,
        actor,
      }
    }

    if (!targetEmployee) {
      const pageState: PersonalKpiPageState = canManagePersonalKpi(params.session.user.role)
        ? 'setup-required'
        : 'permission-denied'

      return {
        state: pageState,
        message:
          pageState === 'setup-required'
            ? '조회 가능한 대상자가 없어 개인 KPI 운영을 시작할 수 없습니다. 대상자 범위 또는 조직 설정을 확인해 주세요.'
            : '조회 가능한 직원 범위를 찾을 수 없습니다.',
        alerts,
        selectedYear,
        selectedEmployeeId: '',
        cycleOptions: [],
        employeeOptions,
        orgKpiOptions: [],
        summary: emptySummary,
        mine: [],
        reviewQueue: [],
        history: [],
        aiLogs: [],
        permissions: buildPersonalKpiPermissions({
          actorId: params.session.user.id,
          actorRole: params.session.user.role,
          targetEmployeeId: params.employeeId ?? params.session.user.id,
          targetEmployee,
          pageState,
          aiAccess,
        }),
        aiAccess: aiAccessView,
        actor,
      }
    }

    failureStage = 'cycle-options'
    const cycleRecords = await loadPersonalKpiSection({
      alerts,
      title: '평가 주기 옵션을 불러오지 못했습니다.',
      description: '주기 선택은 비어 있는 상태로 표시합니다.',
      fallback: [] as Array<{
        id: string
        cycleName: string
        evalYear: number
        status: string
        goalEditMode?: string
      }>,
      loader: async () => {
        const selectedDepartment = await prisma.department.findUnique({
          where: { id: targetEmployee.deptId },
          include: {
            organization: true,
          },
        })

        if (!selectedDepartment) return []

        return prisma.evalCycle.findMany({
          where: {
            orgId: selectedDepartment.organization.id,
            evalYear: selectedYear,
          },
          orderBy: [{ evalYear: 'desc' }, { createdAt: 'desc' }],
        })
      },
    })

    const cycleOptions = cycleRecords.map((cycle) => ({
      id: cycle.id,
      name: cycle.cycleName,
      year: cycle.evalYear,
      status: cycle.status,
    }))
    shellCycleOptions = cycleOptions

    const selectedCycleId =
      params.cycleId && cycleOptions.some((cycle) => cycle.id === params.cycleId)
        ? params.cycleId
        : cycleOptions[0]?.id
    const selectedCycleRecord = cycleRecords.find((cycle) => cycle.id === selectedCycleId)
    const goalEditLocked = selectedCycleRecord?.goalEditMode === 'CHECKIN_ONLY'

    failureStage = 'leadership-bootstrap'
    await loadPersonalKpiSection({
      alerts,
      title: '리더십 개인 KPI 자동 반영을 완료하지 못했습니다.',
      description: '기존 개인 KPI 화면은 그대로 표시하고, 자동 반영은 이번 요청에서 건너뜁니다.',
      fallback: undefined,
      loader: () =>
        autoBootstrapLeadershipPersonalKpis({
          sessionUserId: params.session.user.id,
          targetEmployee,
          departmentsById,
          selectedYear,
          goalEditLocked,
        }),
    })

    failureStage = 'mine-query'
    const mine = await loadPersonalKpiSection({
      alerts,
      title: '개인 KPI 목록을 불러오지 못했습니다.',
      description: '기존 KPI 목록 없이 기본 화면으로 표시합니다.',
      fallback: [] as PersonalKpiWithRelations[],
      loader: () =>
        prisma.personalKpi.findMany({
          where: {
            employeeId: targetEmployee.id,
            evalYear: selectedYear,
          },
          include: {
            employee: {
              include: {
                department: true,
              },
            },
            linkedOrgKpi: {
              include: {
                department: true,
                teamKpiReviewItems: {
                  orderBy: {
                    createdAt: 'desc',
                  },
                  take: 1,
                  select: {
                    verdict: true,
                  },
                },
              },
            },
            monthlyRecords: {
              orderBy: {
                yearMonth: 'desc',
              },
              take: 6,
            },
            copiedFromPersonalKpi: {
              select: {
                id: true,
                kpiName: true,
                evalYear: true,
                employee: {
                  select: {
                    empName: true,
                  },
                },
              },
            },
          },
          orderBy: [{ createdAt: 'asc' }],
        }),
    })

    failureStage = 'review-queue'
    const reviewQueueCandidates: ReviewQueueKpi[] =
      params.session.user.role === 'ROLE_MEMBER'
        ? []
        : await loadPersonalKpiSection({
            alerts,
            title: '검토 대기 KPI 목록을 불러오지 못했습니다.',
            description: '검토 대기 목록은 비어 있는 상태로 표시합니다.',
            fallback: [] as ReviewQueueKpi[],
            loader: () =>
              prisma.personalKpi.findMany({
                where: {
                  evalYear: selectedYear,
                  employee: scopeDepartmentIds
                    ? {
                        deptId: { in: scopeDepartmentIds },
                      }
                    : undefined,
                  NOT: {
                    employeeId: params.session.user.id,
                  },
                },
                include: {
                  employee: {
                    include: {
                      department: true,
                    },
                  },
                  linkedOrgKpi: true,
                  monthlyRecords: {
                    orderBy: {
                      yearMonth: 'desc',
                    },
                    take: 1,
                  },
                },
                orderBy: [{ updatedAt: 'desc' }],
              }),
          })

    const allKpiIds = [...mine.map((item) => item.id), ...reviewQueueCandidates.map((item) => item.id)]

    failureStage = 'audit-logs'
    const auditLogs = allKpiIds.length
      ? await loadPersonalKpiSection({
          alerts,
          title: 'KPI 변경 이력을 불러오지 못했습니다.',
          description: '이력 영역은 비어 있는 상태로 표시합니다.',
          fallback: [] as AuditLogLite[],
          loader: () =>
            prisma.auditLog.findMany({
              where: {
                entityType: 'PersonalKpi',
                entityId: { in: allKpiIds },
              },
              orderBy: {
                timestamp: 'desc',
              },
              take: Math.max(120, allKpiIds.length * 8),
            }) as Promise<AuditLogLite[]>,
        })
      : []

    const logsByKpiId = new Map<string, AuditLogLite[]>()
    auditLogs.forEach((log) => {
      if (!log.entityId) return
      const current = logsByKpiId.get(log.entityId) ?? []
      current.push(log)
      logsByKpiId.set(log.entityId, current)
    })

    const linkedOrgKpiDeptIds = Array.from(
      new Set([
        targetEmployee.deptId,
        ...collectAncestorDepartmentIds(targetEmployee.deptId),
        ...mine.map((item) => item.linkedOrgKpi?.deptId).filter((value): value is string => Boolean(value)),
      ])
    )

    failureStage = 'org-kpi-options'
    const orgKpiRecords = await loadPersonalKpiSection({
      alerts,
      title: '조직 KPI 옵션을 불러오지 못했습니다.',
      description: '상위 목표 연결 목록은 비어 있는 상태로 표시합니다.',
      fallback: [] as OrgKpiRecord[],
      loader: () =>
        prisma.orgKpi.findMany({
          where: {
            evalYear: selectedYear,
            deptId: {
              in: Array.from(new Set([...(scopeDepartmentIds ?? [targetEmployee.deptId]), ...linkedOrgKpiDeptIds])),
            },
            status: {
              not: 'ARCHIVED',
            },
          },
          include: {
            department: true,
            parentOrgKpi: {
              select: {
                id: true,
                kpiName: true,
                deptId: true,
                department: {
                  select: {
                    deptName: true,
                  },
                },
                parentOrgKpiId: true,
              },
            },
            teamKpiReviewItems: {
              orderBy: {
                createdAt: 'desc',
              },
              take: 1,
              select: {
                verdict: true,
              },
            },
          },
          orderBy: [{ deptId: 'asc' }, { kpiName: 'asc' }],
        }),
    })
    const orgKpiById = new Map(orgKpiRecords.map((item) => [item.id, item]))
    const buildOrgLineage = (orgKpiId?: string | null) => {
      const lineage: PersonalKpiViewModel['orgLineage'] = []
      let current = orgKpiId ? orgKpiById.get(orgKpiId) : undefined
      const visited = new Set<string>()

      while (current && !visited.has(current.id)) {
        visited.add(current.id)
        lineage.unshift({
          id: current.id,
          title: current.kpiName,
          departmentName: resolveDepartmentLabel(current.department),
        })
        current = current.parentOrgKpiId ? orgKpiById.get(current.parentOrgKpiId) : undefined
      }

      return lineage
    }
    const mboPolicyInputs: PersonalMboItemInput2026[] = mine.map((kpi) => ({
      id: kpi.id,
      title: kpi.kpiName,
      kpiName: kpi.kpiName,
      definition: kpi.definition,
      formula: kpi.formula,
      policyCategory: kpi.policyCategory ?? null,
      weight: kpi.weight,
      linkedOrgKpiId: kpi.linkedOrgKpiId,
      linkedOrgKpi: toOrgKpiAlignmentInput2026(kpi.linkedOrgKpi, orgKpiById),
    }))
    const mboPolicyGuidanceById = new Map(
      buildPersonalKpiMboPolicyGuidanceList2026(mboPolicyInputs).map((guidance) => [guidance.itemId, guidance])
    )

    failureStage = 'ai-logs'
    const aiLogRecords = await loadPersonalKpiSection({
      alerts,
      title: '개인 KPI AI 요청 이력을 불러오지 못했습니다.',
      description: 'AI 요청 이력은 비어 있는 상태로 표시합니다.',
      fallback: [] as PersonalAiLogRecord[],
      loader: () =>
        prisma.aiRequestLog.findMany({
          where: {
            sourceType: {
              in: [
                'PersonalKpiDraft',
                'PersonalKpiWording',
                'PersonalKpiSmart',
                'PersonalKpiWeight',
                'PersonalKpiAlignment',
                'PersonalKpiDuplicate',
                'PersonalKpiReviewerRisk',
                'PersonalKpiMonthlyComment',
              ],
            },
            OR: [
              { requesterId: params.session.user.id },
              { sourceId: { in: mine.map((item) => item.id) } },
            ],
          },
          include: {
            requester: {
              select: {
                empName: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 20,
        }),
    })

    failureStage = 'feedback-summary'
    const feedbacks = await loadPersonalKpiSection({
      alerts,
      title: '다면 피드백 요약을 불러오지 못했습니다.',
      description: 'AI 요약에서 참고할 피드백 없이 표시합니다.',
      fallback: [] as Awaited<ReturnType<typeof prisma.multiFeedback.findMany>>,
      loader: () =>
        prisma.multiFeedback.findMany({
          where: {
            receiverId: targetEmployee.id,
            status: 'SUBMITTED',
          },
          include: {
            giver: {
              select: {
                empName: true,
              },
            },
          },
          orderBy: {
            submittedAt: 'desc',
          },
          take: 10,
        }),
    })
    const feedbackSummary = feedbacks
      .map((item) => item.overallComment)
      .filter((value): value is string => Boolean(value))
      .slice(0, 2)
      .join(' / ')

    failureStage = 'mine-mapping'
    const mappedMine = mapPersonalKpiSection({
      alerts,
      title: '개인 KPI 화면 정보를 구성하지 못한 항목이 있습니다.',
      description: '일부 KPI 항목을 제외하고 화면을 계속 표시합니다.',
      items: mine,
      mapper: (kpi) => {
        const resolvedTargetValues = resolvePersonalKpiTargetValues(
          kpi as typeof kpi & {
            targetValue?: number | string | null
            targetValueT?: number | null
            targetValueE?: number | null
            targetValueS?: number | null
            copyMetadata?: unknown
          }
        )
        const logs = logsByKpiId.get(kpi.id) ?? []
        const status = resolvePersonalKpiOperationalStatus({
          status: kpi.status,
          logs,
        })
        const weightApproval = buildWeightApprovalSummary(logs, employeesById)
        const hasRejectedRevision = hasRejectedRevisionPending(logs)
        const latestRecord = kpi.monthlyRecords[0]
        const evidenceYearMonth = resolvePersonalKpiEvidenceYearMonth(selectedYear, kpi.monthlyRecords)
        const evidenceRecord = kpi.monthlyRecords.find((record) => record.yearMonth === evidenceYearMonth)

        return {
          id: kpi.id,
          title: kpi.kpiName,
          tags: parseTags(kpi.tags),
          employeeId: kpi.employeeId,
          employeeName: kpi.employee.empName,
          departmentName: resolveDepartmentLabel(kpi.employee.department),
          orgKpiId: kpi.linkedOrgKpiId,
          orgKpiTitle: kpi.linkedOrgKpi?.kpiName ?? null,
          orgKpiCategory: kpi.linkedOrgKpi?.kpiCategory ?? null,
          orgKpiDefinition: kpi.linkedOrgKpi?.definition ?? null,
          orgLineage: buildOrgLineage(kpi.linkedOrgKpiId),
          policyCategory: kpi.policyCategory ?? null,
          mboPolicy:
            mboPolicyGuidanceById.get(kpi.id) ??
            buildPersonalKpiMboPolicyGuidance2026({
              item: {
                id: kpi.id,
                title: kpi.kpiName,
                kpiName: kpi.kpiName,
                definition: kpi.definition,
                formula: kpi.formula,
                policyCategory: kpi.policyCategory ?? null,
                weight: kpi.weight,
                linkedOrgKpiId: kpi.linkedOrgKpiId,
                linkedOrgKpi: toOrgKpiAlignmentInput2026(kpi.linkedOrgKpi, orgKpiById),
              },
            }),
          type: kpi.kpiType,
          definition: kpi.definition ?? undefined,
          formula: kpi.formula ?? undefined,
          targetValue: resolvedTargetValues.targetValue,
          targetValueT: resolvedTargetValues.targetValueT,
          targetValueE: resolvedTargetValues.targetValueE,
          targetValueS: resolvedTargetValues.targetValueS,
          weight: kpi.weight,
          difficulty: kpi.difficulty,
          status,
          persistedStatus: kpi.status,
          reviewComment: parseReviewComment(logs),
          weightApproval,
          reviewer: getReviewerCandidate(kpi.employee, employeesById),
          monthlyAchievementRate: latestRecord?.achievementRate ?? undefined,
          updatedAt: kpi.updatedAt.toISOString(),
          hasRejectedRevision,
          linkedMonthlyCount: kpi.monthlyRecords.length,
          riskFlags: deriveRiskFlags(kpi, hasRejectedRevision),
          cloneInfo: parseCloneInfo(kpi),
          recentMonthlyRecords: kpi.monthlyRecords.map((record) => ({
            id: record.id,
            month: record.yearMonth,
            achievementRate: record.achievementRate ?? undefined,
            activities: record.activities,
            obstacles: record.obstacles,
            evidenceComment: record.evidenceComment,
          })),
          goalType: kpi.goalType as 'GENERAL' | 'SALES_REVENUE',
          targetAmount: resolveTargetAmount(kpi)?.toString() ?? null,
          isReferenceSalesTarget: kpi.goalType === 'SALES_REVENUE' && kpi.targetAmount === null,
          evidenceRecord: {
            recordId: evidenceRecord?.id,
            yearMonth: evidenceYearMonth,
            evidenceComment: evidenceRecord?.evidenceComment ?? undefined,
            attachments: parseMonthlyAttachments(evidenceRecord?.attachments),
          },
          history: mapPersonalKpiSection({
            alerts,
            title: '개인 KPI 이력 일부를 구성하지 못했습니다.',
            description: '일부 이력 항목을 제외하고 계속 표시합니다.',
            items: logs.slice(0, 10),
            mapper: (log) => mapHistoryItem(log, employeesById),
          }),
        } satisfies PersonalKpiViewModel
      },
    })

    failureStage = 'review-queue-mapping'
    const mappedReviewQueue = mapPersonalKpiSection({
      alerts,
      title: '검토 대기 KPI 일부를 구성하지 못했습니다.',
      description: '일부 검토 대기 항목을 제외하고 계속 표시합니다.',
      items: reviewQueueCandidates,
      mapper: (kpi) => {
        const logs = logsByKpiId.get(kpi.id) ?? []
        const status = resolvePersonalKpiOperationalStatus({
          status: kpi.status,
          logs,
        })

        if (status !== 'SUBMITTED' && status !== 'MANAGER_REVIEW') {
          return undefined
        }

        const lastSubmit = logs.find((log) => log.action === 'PERSONAL_KPI_SUBMITTED')
        const updateLog = logs.find((log) => log.action === 'PERSONAL_KPI_UPDATED')
        const weightApproval = buildWeightApprovalSummary(logs, employeesById)

        return {
          id: kpi.id,
          employeeId: kpi.employeeId,
          employeeName: kpi.employee.empName,
          departmentName: resolveDepartmentLabel(kpi.employee.department),
          title: kpi.kpiName,
          tags: parseTags(kpi.tags),
          status,
          weight: kpi.weight,
          orgKpiTitle: kpi.linkedOrgKpi?.kpiName ?? null,
          orgLineage: buildOrgLineage(kpi.linkedOrgKpiId),
          changedFields: getChangedFields(logs),
          previousValueSummary: buildSummaryText(asRecord(updateLog?.oldValue)),
          currentValueSummary: buildSummaryText(asRecord(updateLog?.newValue)) ?? `${kpi.kpiName} · ${kpi.weight}%`,
          submittedAt: lastSubmit?.timestamp.toISOString() ?? kpi.updatedAt.toISOString(),
          reviewComment: parseReviewComment(logs),
          weightApproval,
        } satisfies PersonalKpiReviewQueueItem
      },
    })

    failureStage = 'history-mapping'
    const mappedHistory = mapPersonalKpiSection({
      alerts,
      title: '개인 KPI 전체 이력 일부를 구성하지 못했습니다.',
      description: '일부 이력 항목을 제외하고 계속 표시합니다.',
      items: auditLogs.filter((log) => mine.some((item) => item.id === log.entityId)).slice(0, 40),
      mapper: (log) => mapHistoryItem(log, employeesById),
    })

    failureStage = 'ai-log-mapping'
    const mappedAiLogs = mapPersonalKpiSection({
      alerts,
      title: 'AI 요청 이력 일부를 구성하지 못했습니다.',
      description: '일부 AI 요청 이력을 제외하고 계속 표시합니다.',
      items: aiLogRecords,
      mapper: (log) => ({
        id: log.id,
        createdAt: log.createdAt.toISOString(),
        sourceType: log.sourceType ?? 'PersonalKpiDraft',
        sourceId: log.sourceId ?? undefined,
        requesterName: log.requester.empName,
        requestStatus: log.requestStatus,
        approvalStatus: log.approvalStatus,
        summary:
          (asRecord(log.requestPayload)?.summary as string | undefined) ??
          (asRecord(log.responsePayload)?.summary as string | undefined) ??
          feedbackSummary ??
          '개인 KPI AI 보조 요청',
      }),
    })

    const totalWeight = mappedMine.reduce((sum, item) => sum + item.weight, 0)
    const linkedOrgKpiCount = mappedMine.filter((item) => item.orgKpiId).length
    const rejectedCount = mappedMine.filter((item) => item.hasRejectedRevision).length
    const reviewPendingCount = mappedReviewQueue.length
    const monthlyCoverageRate = mappedMine.length
      ? Math.round((mappedMine.filter((item) => item.linkedMonthlyCount > 0).length / mappedMine.length) * 100)
      : 0
    const mboPolicySummary = buildPersonalKpiMboPolicySummary2026(mappedMine.map((item) => item.mboPolicy))

    const pageState: PersonalKpiPageState = mappedMine.length || mappedReviewQueue.length ? 'ready' : 'empty'
    const basePermissions = buildPersonalKpiPermissions({
      actorId: params.session.user.id,
      actorRole: params.session.user.role,
      targetEmployeeId: targetEmployee.id,
      targetEmployee,
      pageState,
      aiAccess,
    })

    if (goalEditLocked) {
      alerts.push({
        title: '현재 목표는 읽기 전용 모드입니다.',
        description: '목표 생성/수정/삭제는 막혀 있으며 체크인과 코멘트만 이어갈 수 있습니다.',
      })
    }

    return {
      state: pageState,
      message:
        pageState === 'empty'
          ? '아직 등록된 개인 KPI가 없습니다. 새 KPI를 작성하거나 대상자를 선택해 주세요.'
          : undefined,
      alerts,
      selectedYear,
      selectedEmployeeId: targetEmployee.id,
      selectedCycleId,
      cycleOptions,
      employeeOptions,
      orgKpiOptions: orgKpiRecords.map((item) => ({
        id: item.id,
        deptId: item.deptId,
        title: item.kpiName,
        category: item.kpiCategory,
        departmentName: resolveDepartmentLabel(item.department),
        description: item.definition,
        targetAmount: item.targetAmount != null ? item.targetAmount.toString() : null,
        mboReflection: buildPersonalOrgKpiOptionMboReflection2026(item, orgKpiById),
      })),
      summary: {
        totalCount: mappedMine.length,
        totalWeight: Math.round(totalWeight * 10) / 10,
        remainingWeight: Math.round(Math.max(0, 100 - totalWeight) * 10) / 10,
        linkedOrgKpiCount,
        rejectedCount,
        reviewPendingCount,
        monthlyCoverageRate,
        overallStatus: deriveOverallStatus(mappedMine),
        mboPolicy: mboPolicySummary,
      },
      mine: mappedMine,
      reviewQueue: mappedReviewQueue,
      history: mappedHistory,
      aiLogs: mappedAiLogs,
      permissions: {
        ...basePermissions,
        canCreate: goalEditLocked ? false : basePermissions.canCreate,
        canEdit: goalEditLocked ? false : basePermissions.canEdit,
        canSubmit: goalEditLocked ? false : basePermissions.canSubmit,
      },
      aiAccess: aiAccessView,
      actor,
    }
  } catch (error) {
    console.error('Failed to build personal KPI page data:', {
      failureStage,
      actorId: params.session.user.id,
      actorRole: params.session.user.role,
      requestedEmployeeId: params.employeeId ?? null,
      employeeOptionCount: shellEmployeeOptions.length,
      hasTargetEmployee: Boolean(shellTargetEmployee),
      errorName: error instanceof Error ? error.name : typeof error,
      errorMessage: error instanceof Error ? error.message : String(error),
      error,
    })

    if (shellEmployeeOptions.length || shellTargetEmployee) {
      const pageState: PersonalKpiPageState = shellTargetEmployee
        ? 'empty'
        : canManagePersonalKpi(params.session.user.role)
          ? 'setup-required'
          : 'permission-denied'

      return {
        state: pageState,
        message:
          pageState === 'setup-required'
            ? '조회 가능한 대상자가 없어 개인 KPI 운영을 시작할 수 없습니다. 대상자 범위 또는 조직 설정을 확인해 주세요.'
            : '개인 KPI 화면을 구성하는 중 일부 보조 정보를 불러오지 못해 기본 화면으로 표시합니다.',
        alerts: [
          ...shellAlerts,
          {
            title: '개인 KPI 운영 화면 정보를 완전히 불러오지 못했습니다.',
            description: `구성 단계(${failureStage})에서 문제가 발생해 기본 화면으로 전환했습니다.`,
          },
        ],
        selectedYear,
        selectedEmployeeId: shellTargetEmployee?.id ?? '',
        selectedCycleId: shellCycleOptions[0]?.id,
        cycleOptions: shellCycleOptions,
        employeeOptions: shellEmployeeOptions,
        orgKpiOptions: [],
        summary: emptySummary,
        mine: [],
        reviewQueue: [],
        history: [],
        aiLogs: [],
        permissions: buildPersonalKpiPermissions({
          actorId: params.session.user.id,
          actorRole: params.session.user.role,
          targetEmployeeId: shellTargetEmployee?.id ?? params.employeeId ?? params.session.user.id,
          targetEmployee: shellTargetEmployee,
          pageState,
          aiAccess,
        }),
        aiAccess: aiAccessView,
        actor,
      }
    }

    return {
      state: 'error',
      message: '개인 KPI 데이터를 불러오는 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.',
      alerts: shellAlerts,
      selectedYear,
      selectedEmployeeId: params.employeeId ?? params.session.user.id,
      selectedCycleId: shellCycleOptions[0]?.id,
      cycleOptions: shellCycleOptions,
      employeeOptions: shellEmployeeOptions,
      orgKpiOptions: [],
      summary: emptySummary,
      mine: [],
      reviewQueue: [],
      history: [],
      aiLogs: [],
      permissions: buildPersonalKpiPermissions({
        actorId: params.session.user.id,
        actorRole: params.session.user.role,
        targetEmployeeId: params.employeeId ?? params.session.user.id,
        targetEmployee: shellTargetEmployee,
        pageState: 'error',
        aiAccess,
      }),
      aiAccess: aiAccessView,
      actor,
    }
  }
}
