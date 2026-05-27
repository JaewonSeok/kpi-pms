import type {
  EmployeeStatus,
  FeedbackNominationStatus,
  FeedbackRoundStatus,
  FeedbackRoundType,
  FeedbackStatus,
  Position,
  SystemRole,
  WordCloud360CycleStatus,
  WordCloudAssignmentStatus,
  WordCloudEvaluatorGroup,
  WordCloudResponseStatus,
} from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { POSITION_LABELS } from '@/lib/utils'

export type Evaluation2026FeedbackLeadershipReadinessStatus =
  | 'NOT_CONFIGURED'
  | 'READY_TO_ASSIGN'
  | 'ASSIGNMENT_INCOMPLETE'
  | 'IN_PROGRESS'
  | 'COMPLETE'
  | 'BLOCKED'
  | 'MANUAL_REVIEW'

export type Evaluation2026FeedbackLeadershipTargetType =
  | 'SECOND_360_FEEDBACK'
  | 'LEADERSHIP_DIAGNOSIS'

export type Evaluation2026FeedbackLeadershipDepartmentInput = {
  id: string
  deptName: string
  parentDeptId: string | null
}

export type Evaluation2026FeedbackLeadershipEmployeeInput = {
  id: string
  empId: string
  empName: string
  gwsEmail: string
  deptId: string
  role: SystemRole
  position: Position
  status: EmployeeStatus
}

export type Evaluation2026FeedbackRoundInput = {
  id: string
  roundName: string
  roundType: FeedbackRoundType
  status: FeedbackRoundStatus
  startDate: Date | null
  endDate: Date | null
  minRaters: number
  maxRaters: number
  feedbacks: Array<{
    giverId: string
    receiverId: string
    status: FeedbackStatus
    submittedAt: Date | null
  }>
  nominations: Array<{
    targetId: string
    reviewerId: string
    status: FeedbackNominationStatus
  }>
}

export type Evaluation2026LeadershipDiagnosisCycleInput = {
  id: string
  cycleName: string
  status: WordCloud360CycleStatus
  startDate: Date | null
  endDate: Date | null
  evaluatorGroups: WordCloudEvaluatorGroup[]
  assignments: Array<{
    evaluatorId: string
    evaluateeId: string
    evaluatorGroup: WordCloudEvaluatorGroup
    status: WordCloudAssignmentStatus
    response: {
      status: WordCloudResponseStatus
      submittedAt: Date | null
    } | null
  }>
}

export type Evaluation2026FeedbackLeadershipReadinessRow = {
  id: string
  employeeId: string
  employeeNo: string
  name: string
  email: string
  role: SystemRole
  roleLabel: string
  positionLabel: string
  departmentPath: string
  division: string | null
  section: string | null
  team: string | null
  targetType: Evaluation2026FeedbackLeadershipTargetType
  targetTypeLabel: string
  readinessStatus: Evaluation2026FeedbackLeadershipReadinessStatus
  reviewerAssignmentStatus: string
  responseStatus: string
  reviewerAssignmentCount: number
  submittedResponseCount: number
  missingReviewerAssignmentCount: number
  missingResponseCount: number
  missingReason: string
  nextHrAction: string
}

export type Evaluation2026FeedbackLeadershipReadinessSection = {
  type: Evaluation2026FeedbackLeadershipTargetType
  label: string
  status: Evaluation2026FeedbackLeadershipReadinessStatus
  configured: boolean
  sourceId: string | null
  sourceName: string | null
  sourceStatus: string | null
  targetEmployeeCount: number
  targetLeaderCount: number
  reviewerAssignmentCount: number
  missingReviewerAssignmentCount: number
  responseSubmittedCount: number
  responseMissingCount: number
  completionRate: number
  blockedCount: number
  needsSetupCount: number
  nextHrAction: string
  scheduleWindowStatus: string | null
}

export type Evaluation2026FeedbackLeadershipReadinessResult = {
  policyYear: 2026
  checkedAt: string
  evalCycleId: string | null
  readOnly: true
  persistence: {
    feedbackRoundModel: 'MultiFeedbackRound'
    leadershipDiagnosisModel: 'WordCloud360Cycle'
    supportsTargetParticipants: boolean
    supportsReviewerAssignments: boolean
    supportsCompletionStatus: boolean
    supportsQuestionTemplates: boolean
    supportsReadinessMetadata: boolean
    migrationRequired: false
  }
  summary: {
    targetEmployeeCount: number
    targetLeaderCount: number
    reviewerAssignmentCount: number
    missingReviewerAssignmentCount: number
    responseSubmittedCount: number
    responseMissingCount: number
    completionRate: number
    blockedOrNeedsSetupCount: number
    second360Status: Evaluation2026FeedbackLeadershipReadinessStatus
    leadershipDiagnosisStatus: Evaluation2026FeedbackLeadershipReadinessStatus
  }
  second360Feedback: Evaluation2026FeedbackLeadershipReadinessSection
  leadershipDiagnosis: Evaluation2026FeedbackLeadershipReadinessSection
  rows: Evaluation2026FeedbackLeadershipReadinessRow[]
  setupGuidance: string[]
  exportRows: Array<{
    employeeNo: string
    name: string
    email: string
    departmentPath: string
    role: string
    targetType: string
    readinessStatus: string
    missingReason: string
    nextHrAction: string
  }>
  safety: {
    writesPerformed: false
    notificationsSent: false
    emailsSent: false
    evaluationsCreated: 0
    evaluationItemsCreated: 0
    totalScoreChanged: false
    gradeIdChanged: false
    officialScoringEnabled: false
    officialGradeEnabled: false
    officialAiScoreExclusionEnabled: false
  }
}

type FeedbackLeadershipReadinessDb = Pick<
  typeof prisma,
  'department' | 'employee' | 'multiFeedbackRound' | 'wordCloud360Cycle'
>

const ROLE_LABELS: Record<SystemRole, string> = {
  ROLE_MEMBER: '팀원',
  ROLE_TEAM_LEADER: '팀장',
  ROLE_SECTION_CHIEF: '실장/섹션장',
  ROLE_DIV_HEAD: '본부장',
  ROLE_CEO: 'CEO',
  ROLE_ADMIN: '관리자',
}

const TARGET_TYPE_LABELS: Record<Evaluation2026FeedbackLeadershipTargetType, string> = {
  SECOND_360_FEEDBACK: '2차 다면평가',
  LEADERSHIP_DIAGNOSIS: '리더십 진단',
}

const LEADER_ROLES: SystemRole[] = ['ROLE_TEAM_LEADER', 'ROLE_SECTION_CHIEF', 'ROLE_DIV_HEAD']
const DEFAULT_WORD_CLOUD_GROUPS: WordCloudEvaluatorGroup[] = ['MANAGER', 'PEER', 'SUBORDINATE']

export const EMPTY_EVALUATION_2026_FEEDBACK_LEADERSHIP_READINESS =
  buildEvaluation2026FeedbackLeadershipReadinessFromInputs({
    evalCycleId: null,
    departments: [],
    employees: [],
    feedbackRounds: [],
    leadershipDiagnosisCycles: [],
    checkedAt: new Date(0),
  })

function buildDepartmentPath(
  deptId: string,
  departmentById: Map<string, Evaluation2026FeedbackLeadershipDepartmentInput>
) {
  const path: Evaluation2026FeedbackLeadershipDepartmentInput[] = []
  const visited = new Set<string>()
  let currentId: string | null | undefined = deptId

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId)
    const department = departmentById.get(currentId)
    if (!department) break
    path.unshift(department)
    currentId = department.parentDeptId
  }

  const names = path.map((item) => item.deptName)
  return {
    pathLabel: names.join(' > ') || '-',
    division: names[0] ?? null,
    section: names.length >= 3 ? names[1] ?? null : null,
    team: names.length >= 2 ? names[names.length - 1] ?? null : null,
  }
}

function isLeader(employee: Evaluation2026FeedbackLeadershipEmployeeInput) {
  return LEADER_ROLES.includes(employee.role)
}

function isFeedbackTarget(employee: Evaluation2026FeedbackLeadershipEmployeeInput) {
  return employee.role !== 'ROLE_CEO' && employee.role !== 'ROLE_ADMIN'
}

function ratio(submitted: number, total: number) {
  if (total <= 0) return 0
  return Math.round((submitted / total) * 100)
}

function sectionStatus(params: {
  configured: boolean
  targetCount: number
  assignmentCount: number
  missingAssignmentCount: number
  missingResponseCount: number
  manualReviewCount?: number
  sourceBlocked?: boolean
}): Evaluation2026FeedbackLeadershipReadinessStatus {
  if (!params.configured) return 'NOT_CONFIGURED'
  if (params.sourceBlocked) return 'BLOCKED'
  if (params.manualReviewCount && params.manualReviewCount > 0) return 'MANUAL_REVIEW'
  if (params.targetCount <= 0 || params.assignmentCount <= 0) return 'READY_TO_ASSIGN'
  if (params.missingAssignmentCount > 0) return 'ASSIGNMENT_INCOMPLETE'
  if (params.missingResponseCount > 0) return 'IN_PROGRESS'
  return 'COMPLETE'
}

function rowForEmployee(params: {
  employee: Evaluation2026FeedbackLeadershipEmployeeInput
  departmentById: Map<string, Evaluation2026FeedbackLeadershipDepartmentInput>
  targetType: Evaluation2026FeedbackLeadershipTargetType
  readinessStatus: Evaluation2026FeedbackLeadershipReadinessStatus
  reviewerAssignmentCount: number
  submittedResponseCount: number
  missingReviewerAssignmentCount: number
  missingResponseCount: number
  missingReason: string
  nextHrAction: string
}) {
  const departmentPath = buildDepartmentPath(params.employee.deptId, params.departmentById)
  return {
    id: `${params.targetType}:${params.employee.id}`,
    employeeId: params.employee.id,
    employeeNo: params.employee.empId,
    name: params.employee.empName,
    email: params.employee.gwsEmail,
    role: params.employee.role,
    roleLabel: ROLE_LABELS[params.employee.role] ?? params.employee.role,
    positionLabel: POSITION_LABELS[params.employee.position] ?? params.employee.position,
    departmentPath: departmentPath.pathLabel,
    division: departmentPath.division,
    section: departmentPath.section,
    team: departmentPath.team,
    targetType: params.targetType,
    targetTypeLabel: TARGET_TYPE_LABELS[params.targetType],
    readinessStatus: params.readinessStatus,
    reviewerAssignmentStatus: `${params.reviewerAssignmentCount}명 배정 · 누락 ${params.missingReviewerAssignmentCount}명`,
    responseStatus: `${params.submittedResponseCount}건 제출 · 미응답 ${params.missingResponseCount}건`,
    reviewerAssignmentCount: params.reviewerAssignmentCount,
    submittedResponseCount: params.submittedResponseCount,
    missingReviewerAssignmentCount: params.missingReviewerAssignmentCount,
    missingResponseCount: params.missingResponseCount,
    missingReason: params.missingReason,
    nextHrAction: params.nextHrAction,
  } satisfies Evaluation2026FeedbackLeadershipReadinessRow
}

function sortRows(rows: Evaluation2026FeedbackLeadershipReadinessRow[]) {
  return rows.sort((left, right) => {
    if (left.targetType !== right.targetType) return left.targetType.localeCompare(right.targetType)
    if (left.departmentPath !== right.departmentPath) return left.departmentPath.localeCompare(right.departmentPath, 'ko')
    return left.name.localeCompare(right.name, 'ko')
  })
}

function buildSecond360Rows(params: {
  round: Evaluation2026FeedbackRoundInput | null
  targetEmployees: Evaluation2026FeedbackLeadershipEmployeeInput[]
  employeeById: Map<string, Evaluation2026FeedbackLeadershipEmployeeInput>
  departmentById: Map<string, Evaluation2026FeedbackLeadershipDepartmentInput>
}) {
  if (!params.round) {
    return params.targetEmployees.map((employee) =>
      rowForEmployee({
        employee,
        departmentById: params.departmentById,
        targetType: 'SECOND_360_FEEDBACK',
        readinessStatus: 'NOT_CONFIGURED',
        reviewerAssignmentCount: 0,
        submittedResponseCount: 0,
        missingReviewerAssignmentCount: 1,
        missingResponseCount: 0,
        missingReason: '2차 다면평가 라운드가 아직 설정되지 않았습니다.',
        nextHrAction: '다면평가 라운드, 대상자, reviewer 배정을 먼저 확정하세요.',
      })
    )
  }

  const receiverIds = new Set<string>()
  for (const feedback of params.round.feedbacks) receiverIds.add(feedback.receiverId)
  for (const nomination of params.round.nominations) receiverIds.add(nomination.targetId)

  const targets = Array.from(receiverIds)
    .map((employeeId) => params.employeeById.get(employeeId))
    .filter((employee): employee is Evaluation2026FeedbackLeadershipEmployeeInput => Boolean(employee))
  const fallbackTargets = targets.length ? targets : params.targetEmployees

  return fallbackTargets.map((employee) => {
    const feedbacks = params.round!.feedbacks.filter((feedback) => feedback.receiverId === employee.id)
    const nominationReviewerIds = new Set(
      params.round!.nominations
        .filter((nomination) => nomination.targetId === employee.id && nomination.status !== 'REJECTED')
        .map((nomination) => nomination.reviewerId)
    )
    const reviewerIds = new Set([
      ...feedbacks.map((feedback) => feedback.giverId),
      ...Array.from(nominationReviewerIds),
    ])
    const submittedCount = feedbacks.filter((feedback) => feedback.status === 'SUBMITTED').length
    const missingAssignmentCount = Math.max(0, params.round!.minRaters - reviewerIds.size)
    const missingResponseCount = Math.max(0, feedbacks.length - submittedCount)
    const status = missingAssignmentCount > 0
      ? 'ASSIGNMENT_INCOMPLETE'
      : missingResponseCount > 0
        ? 'IN_PROGRESS'
        : feedbacks.length > 0
          ? 'COMPLETE'
          : 'READY_TO_ASSIGN'
    return rowForEmployee({
      employee,
      departmentById: params.departmentById,
      targetType: 'SECOND_360_FEEDBACK',
      readinessStatus: status,
      reviewerAssignmentCount: reviewerIds.size,
      submittedResponseCount: submittedCount,
      missingReviewerAssignmentCount: missingAssignmentCount,
      missingResponseCount,
      missingReason:
        missingAssignmentCount > 0
          ? `최소 reviewer ${params.round!.minRaters}명 기준 ${missingAssignmentCount}명 부족`
          : missingResponseCount > 0
            ? '배정된 reviewer 응답이 아직 제출되지 않았습니다.'
            : '현재 확인 범위에서는 추가 누락이 없습니다.',
      nextHrAction:
        missingAssignmentCount > 0
          ? 'missing reviewer assignment를 보완하세요.'
          : missingResponseCount > 0
            ? '미응답자에게 제출 안내를 준비하세요.'
            : '라운드 결과 확인 및 finalization 전 검토만 남았습니다.',
    })
  })
}

function parseEvaluatorGroups(value: unknown): WordCloudEvaluatorGroup[] {
  if (!Array.isArray(value)) return DEFAULT_WORD_CLOUD_GROUPS
  const allowed = new Set<WordCloudEvaluatorGroup>(['MANAGER', 'PEER', 'SUBORDINATE', 'SELF'])
  const parsed = value.filter((item): item is WordCloudEvaluatorGroup =>
    typeof item === 'string' && allowed.has(item as WordCloudEvaluatorGroup)
  )
  return parsed.length ? parsed : DEFAULT_WORD_CLOUD_GROUPS
}

function buildLeadershipRows(params: {
  cycle: Evaluation2026LeadershipDiagnosisCycleInput | null
  leaderEmployees: Evaluation2026FeedbackLeadershipEmployeeInput[]
  employeeById: Map<string, Evaluation2026FeedbackLeadershipEmployeeInput>
  departmentById: Map<string, Evaluation2026FeedbackLeadershipDepartmentInput>
}) {
  if (!params.cycle) {
    return params.leaderEmployees.map((employee) =>
      rowForEmployee({
        employee,
        departmentById: params.departmentById,
        targetType: 'LEADERSHIP_DIAGNOSIS',
        readinessStatus: 'NOT_CONFIGURED',
        reviewerAssignmentCount: 0,
        submittedResponseCount: 0,
        missingReviewerAssignmentCount: 1,
        missingResponseCount: 0,
        missingReason: '리더십 진단 cycle이 아직 설정되지 않았습니다.',
        nextHrAction: '리더 대상자와 진단 reviewer 배정 기준을 먼저 확정하세요.',
      })
    )
  }

  const evaluateeIds = new Set(params.cycle.assignments.map((assignment) => assignment.evaluateeId))
  for (const leader of params.leaderEmployees) evaluateeIds.add(leader.id)

  return Array.from(evaluateeIds)
    .map((employeeId) => params.employeeById.get(employeeId))
    .filter((employee): employee is Evaluation2026FeedbackLeadershipEmployeeInput => Boolean(employee))
    .map((employee) => {
      const assignments = params.cycle!.assignments.filter((assignment) => assignment.evaluateeId === employee.id)
      const assignedGroups = new Set(assignments.map((assignment) => assignment.evaluatorGroup))
      const requiredGroups = params.cycle!.evaluatorGroups
      const submittedCount = assignments.filter((assignment) =>
        assignment.status === 'SUBMITTED' || assignment.response?.status === 'SUBMITTED'
      ).length
      const missingAssignmentCount = Math.max(0, requiredGroups.length - assignedGroups.size)
      const missingResponseCount = Math.max(0, assignments.length - submittedCount)
      const targetIsLeader = isLeader(employee)
      const status: Evaluation2026FeedbackLeadershipReadinessStatus = !targetIsLeader
        ? 'MANUAL_REVIEW'
        : missingAssignmentCount > 0
          ? 'ASSIGNMENT_INCOMPLETE'
          : missingResponseCount > 0
            ? 'IN_PROGRESS'
            : assignments.length > 0
              ? 'COMPLETE'
              : 'READY_TO_ASSIGN'

      return rowForEmployee({
        employee,
        departmentById: params.departmentById,
        targetType: 'LEADERSHIP_DIAGNOSIS',
        readinessStatus: status,
        reviewerAssignmentCount: assignments.length,
        submittedResponseCount: submittedCount,
        missingReviewerAssignmentCount: missingAssignmentCount,
        missingResponseCount,
        missingReason:
          !targetIsLeader
            ? '리더십 진단 대상이 아닌 일반 구성원이 포함되어 HR 확인이 필요합니다.'
            : missingAssignmentCount > 0
              ? `필수 evaluator group ${requiredGroups.join(', ')} 기준 ${missingAssignmentCount}개 group 배정 부족`
              : missingResponseCount > 0
                ? '리더십 진단 응답이 아직 모두 제출되지 않았습니다.'
                : '현재 확인 범위에서는 추가 누락이 없습니다.',
        nextHrAction:
          !targetIsLeader
            ? '리더십 진단 대상자 범위를 HR이 확인하세요.'
            : missingAssignmentCount > 0
              ? '리더별 reviewer assignment를 보완하세요.'
              : missingResponseCount > 0
                ? '미응답 진단 제출 현황을 확인하세요.'
                : '진단 결과 공개/활용 정책만 별도 확인하세요.',
      })
    })
}

function buildSection(params: {
  type: Evaluation2026FeedbackLeadershipTargetType
  configured: boolean
  sourceId: string | null
  sourceName: string | null
  sourceStatus: string | null
  rows: Evaluation2026FeedbackLeadershipReadinessRow[]
  sourceBlocked?: boolean
  scheduleWindowStatus?: string | null
}) {
  const targetCount = params.rows.length
  const targetLeaderCount = params.rows.filter((row) => LEADER_ROLES.includes(row.role)).length
  const reviewerAssignmentCount = params.rows.reduce((sum, row) => sum + row.reviewerAssignmentCount, 0)
  const missingReviewerAssignmentCount = params.rows.reduce((sum, row) => sum + row.missingReviewerAssignmentCount, 0)
  const responseSubmittedCount = params.rows.reduce((sum, row) => sum + row.submittedResponseCount, 0)
  const responseMissingCount = params.rows.reduce((sum, row) => sum + row.missingResponseCount, 0)
  const manualReviewCount = params.rows.filter((row) => row.readinessStatus === 'MANUAL_REVIEW').length
  const status = sectionStatus({
    configured: params.configured,
    targetCount,
    assignmentCount: reviewerAssignmentCount,
    missingAssignmentCount: missingReviewerAssignmentCount,
    missingResponseCount: responseMissingCount,
    manualReviewCount,
    sourceBlocked: params.sourceBlocked,
  })
  const blockedCount = params.rows.filter((row) =>
    row.readinessStatus === 'ASSIGNMENT_INCOMPLETE' ||
    row.readinessStatus === 'BLOCKED' ||
    row.readinessStatus === 'MANUAL_REVIEW'
  ).length
  const needsSetupCount = params.rows.filter((row) =>
    row.readinessStatus === 'NOT_CONFIGURED' || row.readinessStatus === 'READY_TO_ASSIGN'
  ).length

  return {
    type: params.type,
    label: TARGET_TYPE_LABELS[params.type],
    status,
    configured: params.configured,
    sourceId: params.sourceId,
    sourceName: params.sourceName,
    sourceStatus: params.sourceStatus,
    targetEmployeeCount: targetCount,
    targetLeaderCount,
    reviewerAssignmentCount,
    missingReviewerAssignmentCount,
    responseSubmittedCount,
    responseMissingCount,
    completionRate: ratio(responseSubmittedCount, reviewerAssignmentCount),
    blockedCount,
    needsSetupCount,
    nextHrAction:
      status === 'NOT_CONFIGURED'
        ? `${TARGET_TYPE_LABELS[params.type]} 운영 round/cycle을 설정하세요.`
        : status === 'ASSIGNMENT_INCOMPLETE' || status === 'READY_TO_ASSIGN'
          ? 'reviewer assignment를 확정하세요.'
          : status === 'IN_PROGRESS'
            ? '미응답 제출 현황을 확인하세요.'
            : status === 'MANUAL_REVIEW'
              ? '대상자/배정 범위를 HR이 수동 검토하세요.'
              : '최종 평가/등급 전 결과 활용 정책을 확인하세요.',
    scheduleWindowStatus: params.scheduleWindowStatus ?? null,
  } satisfies Evaluation2026FeedbackLeadershipReadinessSection
}

export function buildEvaluation2026FeedbackLeadershipReadinessFromInputs(params: {
  evalCycleId?: string | null
  departments: Evaluation2026FeedbackLeadershipDepartmentInput[]
  employees: Evaluation2026FeedbackLeadershipEmployeeInput[]
  feedbackRounds: Evaluation2026FeedbackRoundInput[]
  leadershipDiagnosisCycles: Evaluation2026LeadershipDiagnosisCycleInput[]
  checkedAt?: Date
}): Evaluation2026FeedbackLeadershipReadinessResult {
  const departmentById = new Map(params.departments.map((department) => [department.id, department]))
  const activeEmployees = params.employees.filter((employee) => employee.status === 'ACTIVE')
  const employeeById = new Map(activeEmployees.map((employee) => [employee.id, employee]))
  const feedbackTargets = activeEmployees.filter(isFeedbackTarget)
  const leaderTargets = activeEmployees.filter(isLeader)
  const feedbackRound =
    params.feedbackRounds.find((round) => round.roundType === 'FULL_360') ??
    params.feedbackRounds.find((round) => round.roundType !== 'UPWARD') ??
    null
  const leadershipCycle = params.leadershipDiagnosisCycles[0] ?? null

  const second360Rows = buildSecond360Rows({
    round: feedbackRound,
    targetEmployees: feedbackTargets,
    employeeById,
    departmentById,
  })
  const leadershipRows = buildLeadershipRows({
    cycle: leadershipCycle,
    leaderEmployees: leaderTargets,
    employeeById,
    departmentById,
  })
  const rows = sortRows([...second360Rows, ...leadershipRows])

  const second360Feedback = buildSection({
    type: 'SECOND_360_FEEDBACK',
    configured: Boolean(feedbackRound),
    sourceId: feedbackRound?.id ?? null,
    sourceName: feedbackRound?.roundName ?? null,
    sourceStatus: feedbackRound?.status ?? null,
    rows: second360Rows,
    sourceBlocked: feedbackRound?.status === 'CANCELLED',
  })
  const leadershipDiagnosis = buildSection({
    type: 'LEADERSHIP_DIAGNOSIS',
    configured: Boolean(leadershipCycle),
    sourceId: leadershipCycle?.id ?? null,
    sourceName: leadershipCycle?.cycleName ?? null,
    sourceStatus: leadershipCycle?.status ?? null,
    rows: leadershipRows,
    sourceBlocked: leadershipCycle?.status === 'ARCHIVED',
  })
  const reviewerAssignmentCount = second360Feedback.reviewerAssignmentCount + leadershipDiagnosis.reviewerAssignmentCount
  const responseSubmittedCount = second360Feedback.responseSubmittedCount + leadershipDiagnosis.responseSubmittedCount
  const blockedOrNeedsSetupCount =
    second360Feedback.blockedCount +
    second360Feedback.needsSetupCount +
    leadershipDiagnosis.blockedCount +
    leadershipDiagnosis.needsSetupCount

  return {
    policyYear: 2026,
    checkedAt: (params.checkedAt ?? new Date()).toISOString(),
    evalCycleId: params.evalCycleId ?? null,
    readOnly: true,
    persistence: {
      feedbackRoundModel: 'MultiFeedbackRound',
      leadershipDiagnosisModel: 'WordCloud360Cycle',
      supportsTargetParticipants: true,
      supportsReviewerAssignments: true,
      supportsCompletionStatus: true,
      supportsQuestionTemplates: true,
      supportsReadinessMetadata: false,
      migrationRequired: false,
    },
    summary: {
      targetEmployeeCount: second360Feedback.targetEmployeeCount,
      targetLeaderCount: leadershipDiagnosis.targetLeaderCount,
      reviewerAssignmentCount,
      missingReviewerAssignmentCount:
        second360Feedback.missingReviewerAssignmentCount + leadershipDiagnosis.missingReviewerAssignmentCount,
      responseSubmittedCount,
      responseMissingCount: second360Feedback.responseMissingCount + leadershipDiagnosis.responseMissingCount,
      completionRate: ratio(responseSubmittedCount, reviewerAssignmentCount),
      blockedOrNeedsSetupCount,
      second360Status: second360Feedback.status,
      leadershipDiagnosisStatus: leadershipDiagnosis.status,
    },
    second360Feedback,
    leadershipDiagnosis,
    rows,
    setupGuidance: [
      '2차 다면평가 round/cycle, 대상자, reviewer assignment를 확정하세요.',
      '리더십 진단은 팀장/실장/본부장 대상자 기준과 reviewer group을 먼저 확정하세요.',
      '응답 요청, 알림 발송, 점수/등급 반영은 이 readiness 화면에서 수행하지 않습니다.',
      '다면평가/리더십 진단 결과는 공식 업적점수 계산과 별도 정책으로 관리됩니다.',
    ],
    exportRows: rows.map((row) => ({
      employeeNo: row.employeeNo,
      name: row.name,
      email: row.email,
      departmentPath: row.departmentPath,
      role: row.roleLabel,
      targetType: row.targetTypeLabel,
      readinessStatus: row.readinessStatus,
      missingReason: row.missingReason,
      nextHrAction: row.nextHrAction,
    })),
    safety: {
      writesPerformed: false,
      notificationsSent: false,
      emailsSent: false,
      evaluationsCreated: 0,
      evaluationItemsCreated: 0,
      totalScoreChanged: false,
      gradeIdChanged: false,
      officialScoringEnabled: false,
      officialGradeEnabled: false,
      officialAiScoreExclusionEnabled: false,
    },
  }
}

export async function getEvaluation2026FeedbackLeadershipReadiness(params: {
  db?: FeedbackLeadershipReadinessDb
  evalCycleId?: string | null
} = {}) {
  const db = params.db ?? prisma
  const [departments, employees, feedbackRounds, leadershipDiagnosisCycles] = await Promise.all([
    db.department.findMany({
      select: {
        id: true,
        deptName: true,
        parentDeptId: true,
      },
    }),
    db.employee.findMany({
      select: {
        id: true,
        empId: true,
        empName: true,
        gwsEmail: true,
        deptId: true,
        role: true,
        position: true,
        status: true,
      },
      orderBy: [{ empName: 'asc' }],
    }),
    params.evalCycleId
      ? db.multiFeedbackRound.findMany({
          where: {
            evalCycleId: params.evalCycleId,
            roundType: { in: ['FULL_360', 'PEER', 'CROSS_DEPT'] },
            status: { not: 'CANCELLED' },
          },
          select: {
            id: true,
            roundName: true,
            roundType: true,
            status: true,
            startDate: true,
            endDate: true,
            minRaters: true,
            maxRaters: true,
            feedbacks: {
              select: {
                giverId: true,
                receiverId: true,
                status: true,
                submittedAt: true,
              },
            },
            nominations: {
              select: {
                targetId: true,
                reviewerId: true,
                status: true,
              },
            },
          },
          orderBy: [{ endDate: 'desc' }, { createdAt: 'desc' }],
        })
      : Promise.resolve([]),
    params.evalCycleId
      ? db.wordCloud360Cycle.findMany({
          where: {
            evalCycleId: params.evalCycleId,
            status: { not: 'ARCHIVED' },
          },
          select: {
            id: true,
            cycleName: true,
            status: true,
            startDate: true,
            endDate: true,
            evaluatorGroups: true,
            assignments: {
              select: {
                evaluatorId: true,
                evaluateeId: true,
                evaluatorGroup: true,
                status: true,
                response: {
                  select: {
                    status: true,
                    submittedAt: true,
                  },
                },
              },
            },
          },
          orderBy: [{ createdAt: 'desc' }],
        })
      : Promise.resolve([]),
  ])

  return buildEvaluation2026FeedbackLeadershipReadinessFromInputs({
    evalCycleId: params.evalCycleId ?? null,
    departments,
    employees,
    feedbackRounds,
    leadershipDiagnosisCycles: leadershipDiagnosisCycles.map((cycle) => ({
      ...cycle,
      evaluatorGroups: parseEvaluatorGroups(cycle.evaluatorGroups),
    })),
  })
}
