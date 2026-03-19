import type {
  AIApprovalStatus,
  AIRequestStatus,
  KpiType,
  Prisma,
  SystemRole,
} from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { isFeatureEnabled } from '@/lib/feature-flags'
import { getManagedEmployees } from './checkin-access'
import {
  resolveMonthlyOperationalStatus,
  type MonthlyRecordOperationalStatus,
} from './monthly-kpi-workflow'

export type MonthlyPageState = 'ready' | 'empty' | 'permission-denied' | 'error'
export type MonthlyPageScope = 'self' | 'team' | 'employee'

export type MonthlyAttachmentViewModel = {
  id: string
  name: string
  kind: 'KPI' | 'OUTPUT' | 'REPORT' | 'OTHER'
  uploadedAt?: string
  uploadedBy?: string
  sizeLabel?: string
  dataUrl?: string
}

export type MonthlyRecordTimelineItem = {
  id: string
  at: string
  actor: string
  action: string
  detail?: string
  fromStatus?: string
  toStatus?: string
}

export type MonthlyRecordViewModel = {
  id: string
  recordId?: string
  personalKpiId: string
  employeeId: string
  employeeName: string
  departmentName: string
  kpiTitle: string
  orgKpiTitle?: string | null
  type: KpiType
  targetValue?: number | string
  actualValue?: number | string
  unit?: string
  achievementRate?: number
  activityNote?: string
  blockerNote?: string
  effortNote?: string
  status: MonthlyRecordOperationalStatus
  reviewComment?: string
  reviewRequestComment?: string
  reviewedAt?: string
  reviewerName?: string
  attachments: MonthlyAttachmentViewModel[]
  riskFlags: string[]
  previousRecord?: {
    yearMonth: string
    actualValue?: number | string
    achievementRate?: number
    activities?: string | null
  }
  linkedCheckins: Array<{
    id: string
    date: string
    summary: string
  }>
  history: MonthlyRecordTimelineItem[]
  persistedDraft: boolean
  submittedAt?: string
}

export type MonthlyTrendPoint = {
  month: string
  achievementRate?: number
}

export type MonthlyTrendViewModel = {
  personalKpiId: string
  kpiTitle: string
  type: KpiType
  points: MonthlyTrendPoint[]
  average?: number
  highest?: number
  lowest?: number
  latest?: number
}

export type MonthlyReviewViewModel = {
  id: string
  recordId: string
  kpiTitle: string
  reviewerName: string
  reviewedAt: string
  comment: string
  status: 'REVIEWED' | 'REQUEST_UPDATE'
}

export type MonthlyEvidenceViewModel = {
  id: string
  recordId: string
  kpiTitle: string
  name: string
  kind: 'KPI' | 'OUTPUT' | 'REPORT' | 'OTHER'
  uploadedAt?: string
  uploadedBy?: string
  sizeLabel?: string
  dataUrl?: string
}

export type MonthlyAiLogItem = {
  id: string
  createdAt: string
  sourceType: string
  sourceId?: string
  requesterName: string
  requestStatus: AIRequestStatus
  approvalStatus: AIApprovalStatus
  summary: string
}

export type MonthlyScopeOption = {
  id: string
  name: string
  departmentName: string
  role: SystemRole
}

export type MonthlyPageData = {
  state: MonthlyPageState
  message?: string
  selectedYear: number
  selectedMonth: string
  selectedScope: MonthlyPageScope
  selectedEmployeeId: string
  availableYears: number[]
  employeeOptions: MonthlyScopeOption[]
  summary: {
    totalKpiCount: number
    submittedCount: number
    missingCount: number
    riskyCount: number
    averageAchievementRate?: number
    submissionRate: number
    attachmentCount: number
    reviewPendingCount: number
    overallStatus: MonthlyRecordOperationalStatus | 'MIXED'
  }
  records: MonthlyRecordViewModel[]
  trends: MonthlyTrendViewModel[]
  reviews: MonthlyReviewViewModel[]
  evidence: MonthlyEvidenceViewModel[]
  aiLogs: MonthlyAiLogItem[]
  permissions: {
    canEdit: boolean
    canSubmit: boolean
    canReview: boolean
    canLock: boolean
    canUnlock: boolean
    canUseAi: boolean
  }
  actor: {
    id: string
    role: SystemRole
    name: string
    departmentName: string
  }
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
  month?: string
  scope?: string
  employeeId?: string
}

type EmployeeLite = Prisma.EmployeeGetPayload<{
  include: {
    department: true
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

function getScopeDepartmentIds(params: {
  role: SystemRole
  deptId: string
  accessibleDepartmentIds: string[]
}) {
  if (params.role === 'ROLE_ADMIN' || params.role === 'ROLE_CEO') return null
  if (params.role === 'ROLE_MEMBER') return [params.deptId]
  return params.accessibleDepartmentIds.length ? params.accessibleDepartmentIds : [params.deptId]
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function toMonthString(year: number, monthIndex: number) {
  return `${year}-${String(monthIndex).padStart(2, '0')}`
}

function parseMonthlyAttachments(value: Prisma.JsonValue | null | undefined): MonthlyAttachmentViewModel[] {
  if (!Array.isArray(value)) return []
  const items: MonthlyAttachmentViewModel[] = []

  value.forEach((item, index) => {
    const record = asRecord(item)
    if (!record) return
    items.push({
      id: typeof record.id === 'string' ? record.id : `attachment-${index}`,
      name: typeof record.name === 'string' ? record.name : `첨부 ${index + 1}`,
      kind:
        record.kind === 'KPI' || record.kind === 'OUTPUT' || record.kind === 'REPORT'
          ? record.kind
          : 'OTHER',
      uploadedAt: typeof record.uploadedAt === 'string' ? record.uploadedAt : undefined,
      uploadedBy: typeof record.uploadedBy === 'string' ? record.uploadedBy : undefined,
      sizeLabel: typeof record.sizeLabel === 'string' ? record.sizeLabel : undefined,
      dataUrl: typeof record.dataUrl === 'string' ? record.dataUrl : undefined,
    })
  })

  return items
}

function getActorName(userId: string, employeesById: Map<string, EmployeeLite>) {
  return employeesById.get(userId)?.empName ?? '시스템'
}

function mapTimelineItem(log: AuditLogLite, employeesById: Map<string, EmployeeLite>): MonthlyRecordTimelineItem {
  const oldValue = asRecord(log.oldValue)
  const newValue = asRecord(log.newValue)
  return {
    id: log.id,
    at: log.timestamp.toISOString(),
    actor: getActorName(log.userId, employeesById),
    action: log.action,
    detail:
      typeof newValue?.comment === 'string'
        ? newValue.comment
        : typeof newValue?.note === 'string'
          ? newValue.note
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
  }
}

function parseReviewComment(logs: AuditLogLite[]) {
  const reviewLog = logs.find((log) =>
    ['MONTHLY_RECORD_REVIEWED', 'MONTHLY_RECORD_REVIEW_REQUESTED'].includes(log.action)
  )
  if (!reviewLog) return {}
  const payload = asRecord(reviewLog.newValue)
  return {
    reviewComment: typeof payload?.comment === 'string' ? payload.comment : undefined,
    reviewedAt: reviewLog.timestamp.toISOString(),
    reviewerName: reviewLog.userId,
    reviewType:
      reviewLog.action === 'MONTHLY_RECORD_REVIEW_REQUESTED'
        ? ('REQUEST_UPDATE' as const)
        : ('REVIEWED' as const),
  }
}

function buildRiskFlags(params: {
  achievementRate?: number
  blockerNote?: string | null
  attachments: MonthlyAttachmentViewModel[]
  status: MonthlyRecordOperationalStatus
  linkedOrgKpiId?: string | null
}) {
  const flags: string[] = []
  if ((params.achievementRate ?? 100) < 80) {
    flags.push('달성률 주의')
  }
  if (params.blockerNote?.trim()) {
    flags.push('장애요인 기록')
  }
  if (!params.attachments.length && (params.achievementRate ?? 100) < 80) {
    flags.push('증빙 보완 필요')
  }
  if (!params.linkedOrgKpiId) {
    flags.push('상위 KPI 연결 없음')
  }
  if (params.status === 'NOT_STARTED') {
    flags.push('이번 달 실적 미입력')
  }
  return flags
}

function calcAverage(values: Array<number | undefined>) {
  const actual = values.filter((value): value is number => typeof value === 'number')
  if (!actual.length) return undefined
  return Math.round((actual.reduce((sum, value) => sum + value, 0) / actual.length) * 10) / 10
}

function deriveOverallStatus(
  items: MonthlyRecordViewModel[]
): MonthlyRecordOperationalStatus | 'MIXED' {
  if (!items.length) return 'NOT_STARTED' satisfies MonthlyRecordOperationalStatus
  const statuses = Array.from(new Set(items.map((item) => item.status)))
  return statuses.length === 1 ? statuses[0] : 'MIXED'
}

function isManageRole(role: SystemRole) {
  return ['ROLE_ADMIN', 'ROLE_CEO', 'ROLE_DIV_HEAD', 'ROLE_SECTION_CHIEF', 'ROLE_TEAM_LEADER'].includes(role)
}

function monthWindow(selectedYear: number) {
  return Array.from({ length: 12 }, (_, index) => toMonthString(selectedYear, index + 1))
}

function buildAiLogSummary(payload: Prisma.JsonValue | null) {
  const record = asRecord(payload)
  if (!record) return '월간 실적 AI 보조 요청'
  const summary =
    typeof record.summary === 'string'
      ? record.summary
      : typeof record.comment === 'string'
        ? record.comment
        : typeof record.title === 'string'
          ? record.title
          : undefined
  return summary ?? '월간 실적 AI 보조 요청'
}

export async function getMonthlyKpiPageData(params: PageParams): Promise<MonthlyPageData> {
  try {
    const selectedYear = params.year ?? new Date().getFullYear()
    const selectedMonth = /^\d{4}-\d{2}$/.test(params.month ?? '')
      ? (params.month as string)
      : `${selectedYear}-${String(new Date().getMonth() + 1).padStart(2, '0')}`

    const actor = await prisma.employee.findUnique({
      where: { id: params.session.user.id },
      include: {
        department: true,
      },
    })

    if (!actor) {
      return {
        state: 'permission-denied',
        message: '월간 실적 화면을 사용할 수 있는 직원 정보를 찾지 못했습니다.',
        selectedYear,
        selectedMonth,
        selectedScope: 'self',
        selectedEmployeeId: params.session.user.id,
        availableYears: [selectedYear],
        employeeOptions: [],
        summary: {
          totalKpiCount: 0,
          submittedCount: 0,
          missingCount: 0,
          riskyCount: 0,
          submissionRate: 0,
          attachmentCount: 0,
          reviewPendingCount: 0,
          overallStatus: 'NOT_STARTED',
        },
        records: [],
        trends: [],
        reviews: [],
        evidence: [],
        aiLogs: [],
        permissions: {
          canEdit: false,
          canSubmit: false,
          canReview: false,
          canLock: false,
          canUnlock: false,
          canUseAi: false,
        },
        actor: {
          id: params.session.user.id,
          role: params.session.user.role,
          name: params.session.user.name,
          departmentName: params.session.user.deptName,
        },
      }
    }

    const scopeDepartmentIds = getScopeDepartmentIds({
      role: params.session.user.role,
      deptId: params.session.user.deptId,
      accessibleDepartmentIds: params.session.user.accessibleDepartmentIds,
    })

    const employeeWhere =
      scopeDepartmentIds === null
        ? { status: 'ACTIVE' as const }
        : { status: 'ACTIVE' as const, deptId: { in: scopeDepartmentIds } }

    const employees = await prisma.employee.findMany({
      where: employeeWhere,
      include: { department: true },
      orderBy: [{ deptId: 'asc' }, { empName: 'asc' }],
    })

    const employeesById = new Map(employees.map((employee) => [employee.id, employee]))
    const managedEmployees = isManageRole(params.session.user.role)
      ? await getManagedEmployees(params.session.user.id, params.session.user.role)
      : []

    let selectedScope: MonthlyPageScope =
      params.scope === 'team' || params.scope === 'employee' || params.scope === 'self'
        ? params.scope
        : 'self'

    if (!isManageRole(params.session.user.role)) {
      selectedScope = 'self'
    }

    let targetEmployeeId = params.session.user.id
    if (selectedScope === 'employee' && params.employeeId && employeesById.has(params.employeeId)) {
      targetEmployeeId = params.employeeId
    } else if (selectedScope === 'team') {
      targetEmployeeId = managedEmployees[0]?.id ?? params.session.user.id
    }

    const targetEmployee = employeesById.get(targetEmployeeId) ?? actor
    if (!targetEmployee) {
      return {
        state: 'permission-denied',
        message: '조회 가능한 대상자를 찾지 못했습니다.',
        selectedYear,
        selectedMonth,
        selectedScope: 'self',
        selectedEmployeeId: params.session.user.id,
        availableYears: [selectedYear],
        employeeOptions: [],
        summary: {
          totalKpiCount: 0,
          submittedCount: 0,
          missingCount: 0,
          riskyCount: 0,
          submissionRate: 0,
          attachmentCount: 0,
          reviewPendingCount: 0,
          overallStatus: 'NOT_STARTED',
        },
        records: [],
        trends: [],
        reviews: [],
        evidence: [],
        aiLogs: [],
        permissions: {
          canEdit: false,
          canSubmit: false,
          canReview: false,
          canLock: false,
          canUnlock: false,
          canUseAi: false,
        },
        actor: {
          id: params.session.user.id,
          role: params.session.user.role,
          name: params.session.user.name,
          departmentName: params.session.user.deptName,
        },
      }
    }

    const personalKpis = await prisma.personalKpi.findMany({
      where: {
        employeeId: targetEmployee.id,
        evalYear: selectedYear,
        status: { not: 'ARCHIVED' },
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
          },
        },
        monthlyRecords: {
          orderBy: {
            yearMonth: 'desc',
          },
        },
      },
      orderBy: [{ weight: 'desc' }, { createdAt: 'asc' }],
    })

    const availableYearsRaw = await prisma.personalKpi.findMany({
      where: { employeeId: targetEmployee.id },
      select: { evalYear: true },
      distinct: ['evalYear'],
      orderBy: { evalYear: 'desc' },
    })
    const availableYears = Array.from(new Set([selectedYear, ...availableYearsRaw.map((item) => item.evalYear)])).sort((a, b) => b - a)

    if (!personalKpis.length) {
      return {
        state: 'empty',
        message: '아직 등록된 개인 KPI가 없습니다. 먼저 개인 KPI를 작성한 뒤 월간 실적을 입력해 주세요.',
        selectedYear,
        selectedMonth,
        selectedScope,
        selectedEmployeeId: targetEmployee.id,
        availableYears,
        employeeOptions: employees.map((employee) => ({
          id: employee.id,
          name: employee.empName,
          departmentName: employee.department.deptName,
          role: employee.role,
        })),
        summary: {
          totalKpiCount: 0,
          submittedCount: 0,
          missingCount: 0,
          riskyCount: 0,
          submissionRate: 0,
          attachmentCount: 0,
          reviewPendingCount: 0,
          overallStatus: 'NOT_STARTED',
        },
        records: [],
        trends: [],
        reviews: [],
        evidence: [],
        aiLogs: [],
        permissions: {
          canEdit: targetEmployee.id === params.session.user.id || params.session.user.role === 'ROLE_ADMIN',
          canSubmit: targetEmployee.id === params.session.user.id || params.session.user.role === 'ROLE_ADMIN',
          canReview: isManageRole(params.session.user.role) && targetEmployee.id !== params.session.user.id,
          canLock: params.session.user.role === 'ROLE_ADMIN',
          canUnlock: params.session.user.role === 'ROLE_ADMIN',
          canUseAi: isFeatureEnabled('aiAssist'),
        },
        actor: {
          id: actor.id,
          role: params.session.user.role,
          name: actor.empName,
          departmentName: actor.department.deptName,
        },
      }
    }

    const recordIds = personalKpis.flatMap((kpi) => kpi.monthlyRecords.map((record) => record.id))
    const monthlyLogs = recordIds.length
      ? await prisma.auditLog.findMany({
          where: {
            entityType: 'MonthlyRecord',
            entityId: { in: recordIds },
          },
          orderBy: { timestamp: 'desc' },
          take: Math.max(120, recordIds.length * 8),
        })
      : []

    const logsByRecordId = new Map<string, AuditLogLite[]>()
    monthlyLogs.forEach((log) => {
      if (!log.entityId) return
      const bucket = logsByRecordId.get(log.entityId) ?? []
      bucket.push(log as AuditLogLite)
      logsByRecordId.set(log.entityId, bucket)
    })

    const checkins = await prisma.checkIn.findMany({
      where: {
        ownerId: targetEmployee.id,
      },
      orderBy: [{ scheduledDate: 'desc' }],
      take: 8,
    })

    const aiLogs = await prisma.aiRequestLog.findMany({
      where: {
        sourceType: {
          in: [
            'MonthlyPerformanceSummary',
            'MonthlyRiskExplanation',
            'MonthlyManagerReview',
            'MonthlyEvidenceSummary',
            'MonthlyRetrospective',
            'MonthlyCheckinAgenda',
            'MonthlyEvaluationEvidence',
          ],
        },
        OR: [
          { requesterId: params.session.user.id },
          { sourceId: { in: recordIds } },
        ],
      },
      include: {
        requester: {
          select: {
            empName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    const selectedMonthRecords = personalKpis.map((kpi) => {
      const currentRecord = kpi.monthlyRecords.find((record) => record.yearMonth === selectedMonth)
      const previousRecord = kpi.monthlyRecords.find((record) => record.yearMonth < selectedMonth)
      const logs = currentRecord ? logsByRecordId.get(currentRecord.id) ?? [] : []
      const reviewMeta = parseReviewComment(logs)
      const attachments = parseMonthlyAttachments(currentRecord?.attachments)
      const status = resolveMonthlyOperationalStatus({
        hasRecord: Boolean(currentRecord),
        isDraft: currentRecord?.isDraft,
        submittedAt: currentRecord?.submittedAt,
        logs,
      })
      const linkedCheckins = checkins
        .filter((checkin) => {
          if (!Array.isArray(checkin.kpiDiscussed)) return false
          return checkin.kpiDiscussed.some((item) => {
            const record = asRecord(item)
            return record?.kpiId === kpi.id
          })
        })
        .slice(0, 3)
        .map((checkin) => ({
          id: checkin.id,
          date: (checkin.actualDate ?? checkin.scheduledDate).toISOString(),
          summary: checkin.keyTakeaways ?? '최근 체크인 요약이 없습니다.',
        }))

      return {
        id: currentRecord?.id ?? `${kpi.id}-${selectedMonth}`,
        recordId: currentRecord?.id,
        personalKpiId: kpi.id,
        employeeId: targetEmployee.id,
        employeeName: targetEmployee.empName,
        departmentName: targetEmployee.department.deptName,
        kpiTitle: kpi.kpiName,
        orgKpiTitle: kpi.linkedOrgKpi?.kpiName ?? null,
        type: kpi.kpiType,
        targetValue: kpi.targetValue ?? undefined,
        actualValue: currentRecord?.actualValue ?? undefined,
        unit: kpi.unit ?? undefined,
        achievementRate: currentRecord?.achievementRate ?? undefined,
        activityNote: currentRecord?.activities ?? undefined,
        blockerNote: currentRecord?.obstacles ?? undefined,
        effortNote: currentRecord?.efforts ?? undefined,
        status,
        reviewComment: reviewMeta.reviewComment,
        reviewRequestComment:
          logs.find((log) => log.action === 'MONTHLY_RECORD_REVIEW_REQUESTED') &&
          reviewMeta.reviewType === 'REQUEST_UPDATE'
            ? reviewMeta.reviewComment
            : undefined,
        reviewedAt: reviewMeta.reviewedAt,
        reviewerName: reviewMeta.reviewerName ? getActorName(reviewMeta.reviewerName, employeesById) : undefined,
        attachments,
        riskFlags: buildRiskFlags({
          achievementRate: currentRecord?.achievementRate ?? undefined,
          blockerNote: currentRecord?.obstacles,
          attachments,
          status,
          linkedOrgKpiId: kpi.linkedOrgKpiId,
        }),
        previousRecord: previousRecord
          ? {
              yearMonth: previousRecord.yearMonth,
              actualValue: previousRecord.actualValue ?? undefined,
              achievementRate: previousRecord.achievementRate ?? undefined,
              activities: previousRecord.activities,
            }
          : undefined,
        linkedCheckins,
        history: logs.slice(0, 10).map((log) => mapTimelineItem(log, employeesById)),
        persistedDraft: Boolean(currentRecord?.isDraft),
        submittedAt: currentRecord?.submittedAt?.toISOString(),
      } satisfies MonthlyRecordViewModel
    })

    const trends: MonthlyTrendViewModel[] = personalKpis.map((kpi) => {
      const months = monthWindow(selectedYear)
      const points = months.map((month) => {
        const record = kpi.monthlyRecords.find((item) => item.yearMonth === month)
        return {
          month,
          achievementRate: record?.achievementRate ?? undefined,
        }
      })
      const values = points.map((item) => item.achievementRate)
      const actual = values.filter((value): value is number => typeof value === 'number')

      return {
        personalKpiId: kpi.id,
        kpiTitle: kpi.kpiName,
        type: kpi.kpiType,
        points,
        average: calcAverage(values),
        highest: actual.length ? Math.max(...actual) : undefined,
        lowest: actual.length ? Math.min(...actual) : undefined,
        latest: points.findLast((item) => typeof item.achievementRate === 'number')?.achievementRate,
      }
    })

    const reviews: MonthlyReviewViewModel[] = selectedMonthRecords
      .filter((record) => record.reviewComment && record.recordId)
      .map((record) => ({
        id: `${record.recordId}-review`,
        recordId: record.recordId!,
        kpiTitle: record.kpiTitle,
        reviewerName: record.reviewerName ?? '리더',
        reviewedAt: record.reviewedAt ?? new Date().toISOString(),
        comment: record.reviewComment ?? '',
        status: record.reviewRequestComment ? 'REQUEST_UPDATE' : 'REVIEWED',
      }))

    const evidence = selectedMonthRecords.flatMap<MonthlyEvidenceViewModel>((record) =>
      record.attachments.map((attachment) => ({
        id: attachment.id,
        recordId: record.recordId ?? record.id,
        kpiTitle: record.kpiTitle,
        name: attachment.name,
        kind: attachment.kind,
        uploadedAt: attachment.uploadedAt,
        uploadedBy: attachment.uploadedBy,
        sizeLabel: attachment.sizeLabel,
        dataUrl: attachment.dataUrl,
      }))
    )

    const totalKpiCount = selectedMonthRecords.length
    const submittedCount = selectedMonthRecords.filter((record) => ['SUBMITTED', 'REVIEWED', 'LOCKED'].includes(record.status)).length
    const missingCount = selectedMonthRecords.filter((record) => record.status === 'NOT_STARTED').length
    const riskyCount = selectedMonthRecords.filter((record) => record.riskFlags.length > 0).length
    const reviewPendingCount = selectedMonthRecords.filter((record) => record.status === 'SUBMITTED').length
    const averageAchievementRate = calcAverage(selectedMonthRecords.map((record) => record.achievementRate))
    const summary = {
      totalKpiCount,
      submittedCount,
      missingCount,
      riskyCount,
      averageAchievementRate,
      submissionRate: totalKpiCount ? Math.round((submittedCount / totalKpiCount) * 100) : 0,
      attachmentCount: evidence.length,
      reviewPendingCount,
      overallStatus: deriveOverallStatus(selectedMonthRecords),
    }

    return {
      state: 'ready',
      selectedYear,
      selectedMonth,
      selectedScope,
      selectedEmployeeId: targetEmployee.id,
      availableYears,
      employeeOptions: employees.map((employee) => ({
        id: employee.id,
        name: employee.empName,
        departmentName: employee.department.deptName,
        role: employee.role,
      })),
      summary,
      records: selectedMonthRecords,
      trends,
      reviews,
      evidence,
      aiLogs: aiLogs.map((log) => ({
        id: log.id,
        createdAt: log.createdAt.toISOString(),
        sourceType: log.sourceType ?? 'MonthlyPerformanceSummary',
        sourceId: log.sourceId ?? undefined,
        requesterName: log.requester.empName,
        requestStatus: log.requestStatus,
        approvalStatus: log.approvalStatus,
        summary:
          buildAiLogSummary(log.responsePayload) ||
          buildAiLogSummary(log.requestPayload) ||
          '월간 실적 AI 보조 요청',
      })),
      permissions: {
        canEdit: targetEmployee.id === params.session.user.id || params.session.user.role === 'ROLE_ADMIN',
        canSubmit: targetEmployee.id === params.session.user.id || params.session.user.role === 'ROLE_ADMIN',
        canReview: isManageRole(params.session.user.role) && targetEmployee.id !== params.session.user.id,
        canLock: params.session.user.role === 'ROLE_ADMIN',
        canUnlock: params.session.user.role === 'ROLE_ADMIN',
        canUseAi: isFeatureEnabled('aiAssist'),
      },
      actor: {
        id: actor.id,
        role: params.session.user.role,
        name: actor.empName,
        departmentName: actor.department.deptName,
      },
    }
  } catch (error) {
    console.error('Failed to build monthly KPI page data:', error)
    return {
      state: 'error',
      message: '월간 실적 데이터를 불러오는 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.',
      selectedYear: params.year ?? new Date().getFullYear(),
      selectedMonth:
        params.month && /^\d{4}-\d{2}$/.test(params.month)
          ? params.month
          : `${params.year ?? new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
      selectedScope: 'self',
      selectedEmployeeId: params.employeeId ?? params.session.user.id,
      availableYears: [params.year ?? new Date().getFullYear()],
      employeeOptions: [],
      summary: {
        totalKpiCount: 0,
        submittedCount: 0,
        missingCount: 0,
        riskyCount: 0,
        submissionRate: 0,
        attachmentCount: 0,
        reviewPendingCount: 0,
        overallStatus: 'NOT_STARTED',
      },
      records: [],
      trends: [],
      reviews: [],
      evidence: [],
      aiLogs: [],
      permissions: {
        canEdit: false,
        canSubmit: false,
        canReview: false,
        canLock: false,
        canUnlock: false,
        canUseAi: false,
      },
      actor: {
        id: params.session.user.id,
        role: params.session.user.role,
        name: params.session.user.name,
        departmentName: params.session.user.deptName,
      },
    }
  }
}
