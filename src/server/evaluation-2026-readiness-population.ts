import type { Session } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { EVALUATION_POLICY_2026, type EvaluationPolicyItemCategoryCode } from '@/lib/evaluation-policy-2026'
import {
  readPolicy2026OfficialReadinessEnabled,
  readPolicy2026PreviewMappings,
  type EvaluationPolicy2026SalesGroup,
} from '@/lib/evaluation-policy-2026-preview-metadata'
import { get2026EvaluationFeatureFlags } from '@/lib/feature-flags'
import { AppError } from '@/lib/utils'
import { canAccessEvaluationPreview2026 } from '@/server/evaluation-preview-2026-loader'
import {
  getEvaluation2026GradePolicyReadiness,
  type Evaluation2026GradePolicyReadinessResult,
} from '@/server/evaluation-2026-grade-policy-readiness'
import {
  detectDailyWorkDuplicateWithOrgGoal2026,
  determineOrgKpiReflectionEligibility2026,
  type KpiAlignmentOrgLevel2026,
  type OrgKpiAlignmentInput2026,
} from '@/server/kpi-alignment-policy-2026'
import {
  resolvePersonalKpiOperationalStatus,
  type PersonalKpiOperationalStatus,
} from '@/server/personal-kpi-workflow'

type Evaluation2026ReadinessPopulationDb = {
  evalCycle: {
    findUnique: (args: unknown) => Promise<unknown>
  }
  employee: {
    findMany: (args: unknown) => Promise<unknown[]>
  }
  personalKpi: {
    findMany: (args: unknown) => Promise<unknown[]>
  }
  evaluation: {
    findMany: (args: unknown) => Promise<unknown[]>
  }
  orgKpi?: {
    findMany: (args: unknown) => Promise<unknown[]>
  }
  evaluationGradePolicy?: {
    findMany: (args: unknown) => Promise<unknown[]>
  }
  department: {
    findMany: (args: unknown) => Promise<unknown[]>
  }
  auditLog?: {
    findMany: (args: unknown) => Promise<unknown[]>
  }
}

type EvalCycleForDryRun2026 = {
  id: string
  orgId: string
  cycleName: string
  evalYear: number
  status: string
  performanceDesignConfig: unknown
}

type DepartmentNode2026 = {
  id: string
  deptName: string
  parentDeptId: string | null
}

type ActiveEmployee2026 = {
  id: string
  empId?: string | null
  empName: string
  gwsEmail?: string | null
  deptId: string
  role?: string | null
  position?: string | null
  managerId?: string | null
  teamLeaderId?: string | null
  department?: {
    id?: string
    deptName?: string | null
    parentDeptId?: string | null
  } | null
}

type PersonalKpi2026 = {
  id: string
  employeeId: string
  kpiName: string
  definition?: string | null
  formula?: string | null
  policyCategory: EvaluationPolicyItemCategoryCode | null
  status: 'DRAFT' | 'CONFIRMED' | 'ARCHIVED' | string
  weight?: number | null
  targetValue?: number | null
  targetValueT?: number | null
  targetValueE?: number | null
  linkedOrgKpiId?: string | null
  linkedOrgKpi?: {
    id: string
    kpiName: string
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
    teamKpiReviewItems?: Array<{
      verdict: string
    }>
  } | null
  monthlyRecords?: Array<{
    id?: string | null
    yearMonth: string
    actualValue?: number | null
    achievementRate?: number | null
    activities?: string | null
    obstacles?: string | null
    efforts?: string | null
    evidenceComment?: string | null
    attachments?: unknown
    submittedAt?: Date | string | null
    isDraft?: boolean | null
  }>
}

type PersonalKpiAuditLog2026 = {
  action: string
  timestamp: Date | string
  entityId?: string | null
  oldValue?: unknown
  newValue?: unknown
}

type ExistingSelfEvaluation2026 = {
  id: string
  targetId: string
  evalStage: string
  items: Array<{
    id: string
    personalKpiId: string
    policyCategory: EvaluationPolicyItemCategoryCode | null
    itemComment?: string | null
    targetAchievementLevel?: string | null
    personalKpi?: {
      id: string
      kpiName: string
      policyCategory: EvaluationPolicyItemCategoryCode | null
    } | null
  }>
}

type TeamKpiReviewItemSnapshot2026 = {
  id?: string | null
  verdict?: string | null
  rationale?: string | null
  linkageComment?: string | null
  duplicationComment?: string | null
  recommendationText?: string | null
  improvementSuggestions?: string | null
  createdAt?: Date | string | null
  run?: {
    id?: string | null
    requesterId?: string | null
    reviewType?: string | null
    overallVerdict?: string | null
    overallSummary?: string | null
    aiRequestLogId?: string | null
    createdAt?: Date | string | null
  } | null
}

type TeamOrgKpiForHrReview2026 = {
  id: string
  deptId: string
  evalYear: number
  kpiName: string
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
  parentOrgKpi?: {
    id: string
    kpiName: string
    department?: {
      deptName?: string | null
    } | null
  } | null
  teamKpiReviewItems?: TeamKpiReviewItemSnapshot2026[]
}

export type Evaluation2026ReadinessPopulationEmployeeSummary = {
  employeeId: string
  employeeNo: string | null
  employeeName: string
  departmentId: string | null
  departmentName: string
  departmentPath: string
  confirmedPersonalKpiCount: number
}

export type Evaluation2026ReadinessPopulationWouldCreateEvaluation = {
  employeeId: string
  employeeName: string
  departmentName: string
  confirmedPersonalKpiCount: number
  wouldCreateItemCount: number
  missingPolicyCategoryCount: number
  itemTitles: string[]
}

export type Evaluation2026ReadinessPopulationSkippedEvaluation = {
  evaluationId: string
  employeeId: string
  employeeName: string
  departmentName: string
  confirmedPersonalKpiCount: number
  existingItemCount: number
  missingPolicyCategoryCount: number
}

export type Evaluation2026ReadinessPopulationDivisionCoverage = {
  divisionId: string
  divisionName: string
  activeEmployeeCount: number
  draftPersonalKpiEmployeeCount: number
  submittedPersonalKpiEmployeeCount: number
  confirmedPersonalKpiEmployeeCount: number
  missingAnyPersonalKpiEmployeeCount: number
  currentSalesGroup: EvaluationPolicy2026SalesGroup | null
}

export type Evaluation2026ReadinessPopulationTeamCoverage = {
  departmentId: string
  departmentName: string
  departmentPath: string
  activeEmployeeCount: number
  draftPersonalKpiEmployeeCount: number
  submittedPersonalKpiEmployeeCount: number
  confirmedPersonalKpiEmployeeCount: number
  missingAnyPersonalKpiEmployeeCount: number
}

export type Evaluation2026ReadinessPopulationDepartmentOverrideCoverage = {
  departmentId: string
  departmentName: string
  departmentPath: string
  currentSalesGroup: EvaluationPolicy2026SalesGroup
  affectedActiveEmployeeCount: number
}

export type Evaluation2026MboSetupMonitoringStatus = 'MISSING' | 'DRAFT' | 'SUBMITTED_REVIEWING' | 'CONFIRMED'

export type Evaluation2026MboSetupEmployeeMonitoringRow = {
  employeeId: string
  employeeNo: string | null
  employeeName: string
  email: string | null
  divisionId: string | null
  divisionName: string
  departmentId: string | null
  departmentName: string
  departmentPath: string
  managerId: string | null
  managerName: string
  status: Evaluation2026MboSetupMonitoringStatus
  actionLabel: string
  totalPersonalKpiCount: number
  draftPersonalKpiCount: number
  submittedPersonalKpiCount: number
  managerReviewPersonalKpiCount: number
  confirmedPersonalKpiCount: number
  missingPolicyCategoryCount: number
  linkedOrgKpiPersonalKpiCount: number
}

export type Evaluation2026MboPolicyCategoryMissingItemRow = {
  personalKpiId: string
  personalKpiName: string
  employeeId: string
  employeeNo: string | null
  employeeName: string
  email: string | null
  divisionId: string | null
  divisionName: string
  departmentId: string | null
  departmentName: string
  departmentPath: string
  managerId: string | null
  managerName: string
  operationalStatus: PersonalKpiOperationalStatus
  currentCategory: null
  linkedOrgKpiId: string | null
  linkedOrgKpiTitle: string | null
  actionLabel: '카테고리 확정 필요'
}

export type Evaluation2026ResultWritingWarningCode =
  | 'MISSING_ACTUAL_RESULT'
  | 'MISSING_MEASURABLE_RESULT'
  | 'MISSING_EVIDENCE'
  | 'MISSING_PERSONAL_CONTRIBUTION'
  | 'MISSING_TARGET_ACTUAL_COMPARISON'
  | 'MISSING_OUTPUT_IMPACT'
  | 'MISSING_CATEGORY'
  | 'ORG_GOAL_WITHOUT_APPROVED_SOURCE'
  | 'DAILY_WORK_DUPLICATE_RISK'
  | 'PROJECT_TK_MISSING_DELIVERABLE'
  | 'AI_EVIDENCE_MIXED_IN_ANNUAL_SCORE'

export type Evaluation2026ResultWritingStatus =
  | 'READY_FOR_REVIEW'
  | 'NEEDS_RESULT'
  | 'NEEDS_EVIDENCE'
  | 'NEEDS_CONTRIBUTION'
  | 'NEEDS_CATEGORY'
  | 'MANUAL_REVIEW'

export type Evaluation2026ResultWritingReadinessRow = {
  personalKpiId: string
  evaluationItemId: string | null
  employeeId: string
  employeeNo: string | null
  employeeName: string
  email: string | null
  divisionId: string | null
  divisionName: string
  departmentId: string | null
  departmentName: string
  departmentPath: string
  leaderId: string | null
  leaderName: string
  kpiName: string
  category: EvaluationPolicyItemCategoryCode | null
  categoryLabel: string
  mboStatus: PersonalKpiOperationalStatus
  resultWritingStatus: Evaluation2026ResultWritingStatus
  resultDraftPresent: boolean
  evidencePresent: boolean
  personalContributionPresent: boolean
  measurableResultPresent: boolean
  targetActualComparisonPresent: boolean
  outputImpactPresent: boolean
  linkedOrgKpiId: string | null
  linkedOrgKpiTitle: string | null
  approvedOrgGoalSource: boolean
  latestMonthlyRecordLabel: string | null
  evidenceSourceCount: number
  warnings: Array<{
    code: Evaluation2026ResultWritingWarningCode
    label: string
    message: string
  }>
  nextAction: string
}

export type Evaluation2026ResultWritingReadiness = {
  mode: 'READ_ONLY'
  guidance: Array<{
    category: EvaluationPolicyItemCategoryCode
    label: string
    expectations: string[]
  }>
  evidenceGuidance: string[]
  leaderReviewChecklist: string[]
  exportColumns: string[]
  summary: {
    totalItemCount: number
    resultDraftPresentCount: number
    missingResultCount: number
    missingEvidenceCount: number
    missingContributionCount: number
    missingMeasurableResultCount: number
    missingCategoryCount: number
    orgGoalSourceWarningCount: number
    dailyWorkDuplicateRiskCount: number
    projectTkMissingDeliverableCount: number
    aiEvidenceMixedCount: number
    leaderReviewWarningCount: number
    readyForReviewCount: number
    warningItemCount: number
    categoryWarningCounts: Record<'ORG_GOAL' | 'PROJECT_T' | 'PROJECT_K' | 'DAILY_WORK' | 'UNMAPPED', number>
    officialScoringEnabled: false
    officialGradeEnabled: false
  }
  rows: Evaluation2026ResultWritingReadinessRow[]
  safety: {
    writesPerformed: false
    evaluationsCreated: 0
    evaluationItemsCreated: 0
    totalScoreChanged: false
    gradeIdChanged: false
    officialScoringEnabled: false
    officialGradeEnabled: false
    officialAiScoreExclusionEnabled: false
  }
}

export type Evaluation2026TeamKpiHrReviewStatus =
  | 'PENDING_REVIEW'
  | 'APPROVED_FOR_ORG_GOAL'
  | 'EXCLUDED_DAILY_WORK'
  | 'EXCEPTION_APPROVED'
  | 'NEEDS_DISCUSSION'

export type Evaluation2026TeamKpiHrReason =
  | '전년 대비 상향 KPI'
  | '핵심 과제'
  | '매출/수익/고객 확보 직접 연계'
  | '본부 KPI 직접 포함'
  | '단순 운영/유지 업무'
  | '중복 목표'
  | '기타 HR 사유'

const EVALUATION_2026_TEAM_KPI_HR_REASON_VALUES = [
  '전년 대비 상향 KPI',
  '핵심 과제',
  '매출/수익/고객 확보 직접 연계',
  '본부 KPI 직접 포함',
  '단순 운영/유지 업무',
  '중복 목표',
  '기타 HR 사유',
] as const satisfies readonly Evaluation2026TeamKpiHrReason[]

export type Evaluation2026TeamKpiHrReviewCandidate = {
  orgKpiId: string
  teamKpiName: string
  evalYear: number
  divisionId: string | null
  divisionName: string
  departmentId: string
  departmentName: string
  departmentPath: string
  ownerName: string
  ownerId: string | null
  linkedDivisionKpiId: string | null
  linkedDivisionKpiName: string | null
  linkedDivisionKpiDepartmentName: string | null
  reviewStatus: Evaluation2026TeamKpiHrReviewStatus
  reviewStatusLabel: string
  hrDecisionLabel: string
  reason: Evaluation2026TeamKpiHrReason | null
  notes: string | null
  latestReviewVerdict: string | null
  latestReviewAt: string | null
  reviewedById: string | null
  reviewedAt: string | null
  affectedActiveEmployeeCount: number
  linkedPersonalKpiCount: number
  suggestedMboCategory: EvaluationPolicyItemCategoryCode
  canSuggestAsOrgGoal: boolean
  guidance: string
}

export type Evaluation2026TeamKpiHrReviewCoverage = {
  totalCandidates: number
  pendingReviewCount: number
  approvedForOrgGoalCount: number
  excludedDailyWorkCount: number
  exceptionApprovedCount: number
  needsDiscussionCount: number
  personalKpiOrgGoalWithoutApprovedSourceCount: number
  candidates: Evaluation2026TeamKpiHrReviewCandidate[]
}

export type Evaluation2026ReadinessPopulationBlocker = {
  code: string
  message: string
  count?: number
}

export type Evaluation2026ReadinessPopulationDryRun = {
  policyVersion: string
  generatedAt: string
  isDryRun: true
  selectedEvalCycle: {
    id: string
    name: string
    year: number
    status: string
    isOfficialReadinessTarget: boolean
  }
  activeEmployeeCount: number
  employeesWithConfirmedPersonalKpiCount: number
  employeesWithConfirmedPersonalKpi: Evaluation2026ReadinessPopulationEmployeeSummary[]
  employeesMissingConfirmedPersonalKpiCount: number
  employeesMissingConfirmedPersonalKpi: Evaluation2026ReadinessPopulationEmployeeSummary[]
  existingSelfEvaluationCount: number
  existingSelfEvaluationsSkipped: Evaluation2026ReadinessPopulationSkippedEvaluation[]
  wouldCreateSelfEvaluationCount: number
  wouldCreateSelfEvaluations: Evaluation2026ReadinessPopulationWouldCreateEvaluation[]
  wouldCreateEvaluationItemCount: number
  existingEvaluationItemsSkippedCount: number
  policyCategoryMissingCount: number
  mboSetupCoverage: {
    employeesWithDraftPersonalKpiCount: number
    employeesWithSubmittedPersonalKpiCount: number
    employeesWithConfirmedPersonalKpiCount: number
    employeesMissingAnyPersonalKpiCount: number
    personalKpiStatusDistribution: Record<'draft' | 'submitted' | 'managerReview' | 'confirmed' | 'locked' | 'archived', number>
    categoryDistribution: Record<'ORG_GOAL' | 'PROJECT_T' | 'PROJECT_K' | 'DAILY_WORK' | 'UNMAPPED', number>
    linkedOrgKpiPersonalKpiCount: number
    warningCounts: {
      orgGoalWithoutEligibleOrgKpi: number
      dailyWorkDuplicateRisk: number
      missingWeight: number
      missingPlan: number
      missingMeasurableTarget: number
      missingOwnerContribution: number
      missingCategory: number
    }
    divisionCoverage: Evaluation2026ReadinessPopulationDivisionCoverage[]
    teamCoverage: Evaluation2026ReadinessPopulationTeamCoverage[]
    monitoring: {
      employeeRows: Evaluation2026MboSetupEmployeeMonitoringRow[]
      missingMboEmployees: Evaluation2026MboSetupEmployeeMonitoringRow[]
      draftMboEmployees: Evaluation2026MboSetupEmployeeMonitoringRow[]
      submittedReviewingMboEmployees: Evaluation2026MboSetupEmployeeMonitoringRow[]
      confirmedMboEmployees: Evaluation2026MboSetupEmployeeMonitoringRow[]
      policyCategoryMissingItems: Evaluation2026MboPolicyCategoryMissingItemRow[]
    }
  }
  divisionSalesMappingCoverage: {
    totalDivisions: number
    mappedDivisions: number
    unmappedDivisions: number
    mappedActiveEmployeeCount: number
    unmappedActiveEmployeeCount: number
    divisions: Evaluation2026ReadinessPopulationDivisionCoverage[]
  }
  departmentOverrideCoverage: {
    savedOverrideCount: number
    affectedActiveEmployeeCount: number
    overrides: Evaluation2026ReadinessPopulationDepartmentOverrideCoverage[]
  }
  gradePolicyReadiness: Evaluation2026GradePolicyReadinessResult
  teamKpiHrReviewCoverage: Evaluation2026TeamKpiHrReviewCoverage
  policyCategoryMappingReadiness: {
    missingPolicyCategoryCount: number
    mappedPolicyCategoryCount: number
    manualReviewCount: number
    orgGoalWithoutApprovedSourceCount: number
    dailyWorkDuplicateRiskCount: number
    projectTkMissingTargetOrPlanCount: number
    bulkMappingSavedCount: number
  }
  resultWritingReadiness: Evaluation2026ResultWritingReadiness
  blockers: Evaluation2026ReadinessPopulationBlocker[]
  warnings: Evaluation2026ReadinessPopulationBlocker[]
  safety: {
    writesPerformed: false
    evaluationsCreated: 0
    evaluationItemsCreated: 0
    assignmentsMutated: 0
    totalScoreChanged: false
    gradeIdChanged: false
    officialScoringEnabled: boolean
    officialGradeEnabled: boolean
    officialAiScoreExclusionEnabled: boolean
  }
}

function hasText(value: string | null | undefined) {
  return typeof value === 'string' && value.trim().length > 0
}

function serializeDate(value: Date | string | null | undefined) {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  return value
}

function formatDepartmentPath(params: {
  departmentId?: string | null
  departmentsById: Map<string, DepartmentNode2026>
}) {
  if (!params.departmentId) return '소속 조직 미지정'
  const path: DepartmentNode2026[] = []
  const visited = new Set<string>()
  let current = params.departmentsById.get(params.departmentId)

  while (current && !visited.has(current.id)) {
    visited.add(current.id)
    path.push(current)
    current = current.parentDeptId ? params.departmentsById.get(current.parentDeptId) : undefined
  }

  return path.length ? path.reverse().map((department) => department.deptName).join(' > ') : params.departmentId
}

function resolveDivisionId(params: {
  departmentId?: string | null
  departmentsById: Map<string, DepartmentNode2026>
}) {
  if (!params.departmentId) return null
  let current = params.departmentsById.get(params.departmentId)
  if (!current) return null

  const visited = new Set<string>()
  while (current.parentDeptId && !visited.has(current.id)) {
    visited.add(current.id)
    const parent = params.departmentsById.get(current.parentDeptId)
    if (!parent) break
    current = parent
  }

  return current.id
}

function resolveDepartmentOverridePath(params: {
  departmentId?: string | null
  departmentsById: Map<string, DepartmentNode2026>
}) {
  if (!params.departmentId) return []
  const ids: string[] = []
  const visited = new Set<string>()
  let current = params.departmentsById.get(params.departmentId)

  while (current && !visited.has(current.id)) {
    visited.add(current.id)
    if (current.parentDeptId) ids.push(current.id)
    current = current.parentDeptId ? params.departmentsById.get(current.parentDeptId) : undefined
  }

  return ids
}

function resolveDepartmentLevel2026(params: {
  departmentId?: string | null
  departmentsById: Map<string, DepartmentNode2026>
}): KpiAlignmentOrgLevel2026 {
  if (!params.departmentId) return 'UNKNOWN'
  const current = params.departmentsById.get(params.departmentId)
  if (!current) return 'UNKNOWN'
  return current.parentDeptId ? 'TEAM' : 'DIVISION'
}

function isDepartmentInScope2026(params: {
  employeeDepartmentId?: string | null
  scopeDepartmentId: string
  departmentsById: Map<string, DepartmentNode2026>
}) {
  let currentId = params.employeeDepartmentId ?? null
  const visited = new Set<string>()

  while (currentId && !visited.has(currentId)) {
    if (currentId === params.scopeDepartmentId) return true
    visited.add(currentId)
    currentId = params.departmentsById.get(currentId)?.parentDeptId ?? null
  }

  return false
}

function makeEmployeeSummary(params: {
  employee: ActiveEmployee2026
  confirmedPersonalKpiCount: number
  departmentsById: Map<string, DepartmentNode2026>
}): Evaluation2026ReadinessPopulationEmployeeSummary {
  return {
    employeeId: params.employee.id,
    employeeNo: params.employee.empId ?? null,
    employeeName: params.employee.empName,
    departmentId: params.employee.deptId ?? null,
    departmentName:
      params.employee.department?.deptName ??
      params.departmentsById.get(params.employee.deptId)?.deptName ??
      '소속 조직 미지정',
    departmentPath: formatDepartmentPath({
      departmentId: params.employee.deptId,
      departmentsById: params.departmentsById,
    }),
    confirmedPersonalKpiCount: params.confirmedPersonalKpiCount,
  }
}

function countMissingPolicyCategoriesForKpis(kpis: PersonalKpi2026[]) {
  return kpis.filter((kpi) => !kpi.policyCategory).length
}

function countMissingPolicyCategoriesForExistingItems(evaluation: ExistingSelfEvaluation2026) {
  return evaluation.items.filter((item) => !(item.policyCategory ?? item.personalKpi?.policyCategory ?? null)).length
}

function addBlocker(params: {
  target: Evaluation2026ReadinessPopulationBlocker[]
  code: string
  message: string
  count?: number
}) {
  if (params.count !== undefined && params.count <= 0) return
  params.target.push({
    code: params.code,
    message: params.message,
    ...(params.count !== undefined ? { count: params.count } : {}),
  })
}

function buildLogsByKpiId(logs: PersonalKpiAuditLog2026[]) {
  const logsByKpiId = new Map<string, PersonalKpiAuditLog2026[]>()
  for (const log of logs) {
    if (!log.entityId) continue
    const current = logsByKpiId.get(log.entityId) ?? []
    current.push(log)
    logsByKpiId.set(log.entityId, current)
  }
  return logsByKpiId
}

function countPolicyCategoryMetadataSaves2026(logs: PersonalKpiAuditLog2026[]) {
  return logs.filter((log) => log.action === 'UPDATE_2026_POLICY_PREVIEW_METADATA').length
}

function toOperationalStatus2026(kpi: PersonalKpi2026, logsByKpiId: Map<string, PersonalKpiAuditLog2026[]>) {
  return resolvePersonalKpiOperationalStatus({
    status: (kpi.status === 'CONFIRMED' || kpi.status === 'ARCHIVED' ? kpi.status : 'DRAFT') as
      | 'DRAFT'
      | 'CONFIRMED'
      | 'ARCHIVED',
    logs: logsByKpiId.get(kpi.id) ?? [],
  })
}

function toOrgKpiAlignmentInput2026(
  orgKpi: PersonalKpi2026['linkedOrgKpi'],
  departmentsById: Map<string, DepartmentNode2026>
): OrgKpiAlignmentInput2026 | null {
  if (!orgKpi) return null
  const departmentId = orgKpi.department?.id ?? null
  return {
    id: orgKpi.id,
    title: orgKpi.kpiName,
    kpiName: orgKpi.kpiName,
    level: resolveDepartmentLevel2026({ departmentId, departmentsById }),
    status: orgKpi.status ?? null,
    parentOrgKpiId: orgKpi.parentOrgKpiId ?? null,
    latestReviewVerdict: orgKpi.teamKpiReviewItems?.[0]?.verdict ?? null,
    hrExceptionApproved: orgKpi.mboExceptionApproved ?? null,
    hrExceptionReason: orgKpi.mboExceptionReason ?? null,
    hrExceptionApprovedById: orgKpi.mboExceptionApprovedById ?? null,
    hrExceptionApprovedAt: orgKpi.mboExceptionApprovedAt ?? null,
    department: {
      id: departmentId,
      deptName: orgKpi.department?.deptName ?? null,
      parentDeptId: orgKpi.department?.parentDeptId ?? null,
    },
  }
}

function toTeamOrgKpiAlignmentInput2026(
  orgKpi: TeamOrgKpiForHrReview2026,
  departmentsById: Map<string, DepartmentNode2026>
): OrgKpiAlignmentInput2026 {
  const departmentId = orgKpi.department?.id ?? orgKpi.deptId
  return {
    id: orgKpi.id,
    title: orgKpi.kpiName,
    kpiName: orgKpi.kpiName,
    level: resolveDepartmentLevel2026({ departmentId, departmentsById }),
    status: orgKpi.status ?? null,
    parentOrgKpiId: orgKpi.parentOrgKpiId ?? null,
    latestReviewVerdict: orgKpi.teamKpiReviewItems?.[0]?.verdict ?? null,
    hrExceptionApproved: orgKpi.mboExceptionApproved ?? null,
    hrExceptionReason: orgKpi.mboExceptionReason ?? null,
    hrExceptionApprovedById: orgKpi.mboExceptionApprovedById ?? null,
    hrExceptionApprovedAt: orgKpi.mboExceptionApprovedAt ?? null,
    department: {
      id: departmentId,
      deptName: orgKpi.department?.deptName ?? null,
      parentDeptId: orgKpi.department?.parentDeptId ?? null,
    },
  }
}

function hasMeaningfulText(value: string | null | undefined, minLength = 8) {
  return typeof value === 'string' && value.trim().length >= minLength
}

const RESULT_WRITING_GUIDANCE_2026: Evaluation2026ResultWritingReadiness['guidance'] = [
  {
    category: 'ORG_GOAL',
    label: 'ORG_GOAL 조직목표',
    expectations: [
      '본부 KPI 또는 HR 승인 팀 KPI와의 연결을 먼저 확인합니다.',
      '목표 결과와 실제 결과를 분리해서 작성합니다.',
      '조직 KPI에 대한 본인 기여와 산출물/영향을 증빙 중심으로 남깁니다.',
      '조직목표 증빙을 DAILY_WORK로 중복 작성하지 않았는지 확인합니다.',
    ],
  },
  {
    category: 'PROJECT_T',
    label: 'PROJECT_T 프로젝트 T',
    expectations: [
      '프로젝트 목적, 담당 역할, 목표 산출물을 명확히 적습니다.',
      '실제 산출물과 완료 상태를 목표 대비로 비교합니다.',
      '정량 영향과 증빙 링크/코멘트를 함께 남깁니다.',
    ],
  },
  {
    category: 'PROJECT_K',
    label: 'PROJECT_K 프로젝트 K',
    expectations: [
      '핵심 과제 산출물과 구체 deliverable을 중심으로 작성합니다.',
      '본인 기여와 목표/실제 비교를 분리합니다.',
      'PROJECT_T와 다른 비중/항목 cap이 적용될 수 있음을 확인합니다.',
    ],
  },
  {
    category: 'DAILY_WORK',
    label: 'DAILY_WORK 일상업무',
    expectations: [
      '운영 책임, 품질/안정성, 프로세스 개선 근거를 중심으로 작성합니다.',
      '관리자 검토 기준이 되는 반복 업무 품질과 리스크 대응을 남깁니다.',
      'ORG_GOAL 또는 PROJECT 업무를 DAILY_WORK로 중복 기재하지 않습니다.',
      'DAILY_WORK는 별도 score ceiling/guidance가 있음을 확인합니다.',
    ],
  },
]

const RESULT_WRITING_EVIDENCE_GUIDANCE_2026 = [
  'Google Drive 링크, 월간 실적 evidenceComment, 첨부 JSON, 또는 짧은 증빙 메모 중 하나 이상을 근거로 남깁니다.',
  '새 파일 저장소를 만들거나 자동 업로드하지 않습니다. 기존 링크/코멘트/월간 실적 근거만 readiness에 사용합니다.',
  '초안 저장 단계에서 모든 증빙을 강제하지 않으며, 제출/리더 검토 전 보완 warning으로 먼저 표시합니다.',
  'AI 활용평가 증빙은 연간 업적점수와 별도로 관리됩니다.',
]

const RESULT_WRITING_LEADER_REVIEW_CHECKLIST_2026 = [
  '수행결과가 측정 가능하게 작성되었는지 확인합니다.',
  '증빙 링크/파일/코멘트가 최소 1개 이상 있는지 확인합니다.',
  '본인 기여와 산출물/영향이 분리되어 있는지 확인합니다.',
  'policyCategory와 실제 업무 성격이 맞는지 확인합니다.',
  '비중/cap warning을 확인합니다.',
  '향후 ±5 adjustment를 사용할 경우 기여 차이 증빙과 zero-sum 근거가 필요한지 확인합니다.',
  'AI Pass/Fail 증빙은 연간 업적점수 결과와 분리되어 있는지 확인합니다.',
]

function getPolicyCategoryLabel2026(category: EvaluationPolicyItemCategoryCode | null) {
  if (category === 'ORG_GOAL') return '조직목표'
  if (category === 'PROJECT_T') return '프로젝트 T'
  if (category === 'PROJECT_K') return '프로젝트 K'
  if (category === 'DAILY_WORK') return '일상업무'
  return '미분류'
}

function getResultWritingWarningLabel2026(code: Evaluation2026ResultWritingWarningCode) {
  const labels: Record<Evaluation2026ResultWritingWarningCode, string> = {
    MISSING_ACTUAL_RESULT: '수행결과 누락',
    MISSING_MEASURABLE_RESULT: '정량 결과 부족',
    MISSING_EVIDENCE: '증빙 부족',
    MISSING_PERSONAL_CONTRIBUTION: '본인 기여 부족',
    MISSING_TARGET_ACTUAL_COMPARISON: '목표/실제 비교 부족',
    MISSING_OUTPUT_IMPACT: '산출물/영향 부족',
    MISSING_CATEGORY: 'policyCategory 미분류',
    ORG_GOAL_WITHOUT_APPROVED_SOURCE: 'ORG_GOAL 승인 소스 없음',
    DAILY_WORK_DUPLICATE_RISK: 'DAILY_WORK 중복 위험',
    PROJECT_TK_MISSING_DELIVERABLE: '프로젝트 deliverable 부족',
    AI_EVIDENCE_MIXED_IN_ANNUAL_SCORE: 'AI 증빙 혼재 위험',
  }
  return labels[code]
}

function getResultWritingWarningMessage2026(code: Evaluation2026ResultWritingWarningCode) {
  const messages: Record<Evaluation2026ResultWritingWarningCode, string> = {
    MISSING_ACTUAL_RESULT: 'actual result 또는 EvaluationItem itemComment 초안이 없습니다.',
    MISSING_MEASURABLE_RESULT: '달성률, 실적값, 정량 개선 등 측정 가능한 결과 근거가 부족합니다.',
    MISSING_EVIDENCE: 'Google Drive 링크, 월간 evidenceComment, 첨부, 증빙 메모가 부족합니다.',
    MISSING_PERSONAL_CONTRIBUTION: '본인 역할/기여가 결과 문장이나 KPI 정의에 충분히 드러나지 않습니다.',
    MISSING_TARGET_ACTUAL_COMPARISON: 'Target 대비 실제 결과 비교가 부족합니다.',
    MISSING_OUTPUT_IMPACT: '산출물, 품질/효율 개선, 고객/조직 영향이 부족합니다.',
    MISSING_CATEGORY: 'ORG_GOAL / PROJECT_T / PROJECT_K / DAILY_WORK 중 하나로 확정되어야 합니다.',
    ORG_GOAL_WITHOUT_APPROVED_SOURCE: 'ORG_GOAL은 본부 KPI 또는 HR 승인 팀 KPI와 연결되어야 합니다.',
    DAILY_WORK_DUPLICATE_RISK: '조직목표/프로젝트 업무가 DAILY_WORK로 중복 작성될 가능성이 있습니다.',
    PROJECT_TK_MISSING_DELIVERABLE: 'PROJECT_T/K는 목표 산출물과 실제 deliverable이 필요합니다.',
    AI_EVIDENCE_MIXED_IN_ANNUAL_SCORE: 'AI 활용평가 증빙은 연간 업적점수 결과와 별도로 관리되어야 합니다.',
  }
  return messages[code]
}

function buildResultWritingWarning(code: Evaluation2026ResultWritingWarningCode) {
  return {
    code,
    label: getResultWritingWarningLabel2026(code),
    message: getResultWritingWarningMessage2026(code),
  }
}

function hasAttachmentValue2026(value: unknown) {
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'string') return value.trim().length > 0 && value.trim() !== '[]'
  if (typeof value === 'object' && value !== null) return Object.keys(value).length > 0
  return false
}

function textContainsMeasurableResult2026(value: string | null | undefined) {
  if (!value) return false
  return /(\d+(\.\d+)?\s*(%|건|원|시간|일|명|개|회|점)|증가|감소|절감|단축|향상|개선|완료율|달성률)/i.test(value)
}

function textContainsAiScoreEvidence2026(value: string | null | undefined) {
  if (!value) return false
  return /(AI\s*활용평가|AI\s*역량|AI\s*인증|AI\s*Pass\/?Fail|레벨업|승진\s*요건|실무\s*역량\s*인증)/i.test(value)
}

function resolveResultWritingStatus2026(
  warnings: Array<{ code: Evaluation2026ResultWritingWarningCode }>
): Evaluation2026ResultWritingStatus {
  if (warnings.some((warning) => warning.code === 'MISSING_CATEGORY')) return 'NEEDS_CATEGORY'
  if (warnings.some((warning) => warning.code === 'MISSING_ACTUAL_RESULT')) return 'NEEDS_RESULT'
  if (warnings.some((warning) => warning.code === 'MISSING_EVIDENCE')) return 'NEEDS_EVIDENCE'
  if (warnings.some((warning) => warning.code === 'MISSING_PERSONAL_CONTRIBUTION')) return 'NEEDS_CONTRIBUTION'
  if (warnings.length) return 'MANUAL_REVIEW'
  return 'READY_FOR_REVIEW'
}

function getResultWritingNextAction2026(status: Evaluation2026ResultWritingStatus) {
  if (status === 'READY_FOR_REVIEW') return '리더 검토 준비 가능'
  if (status === 'NEEDS_CATEGORY') return 'policyCategory 확정'
  if (status === 'NEEDS_RESULT') return '수행결과 초안 작성'
  if (status === 'NEEDS_EVIDENCE') return '증빙 링크/코멘트 보완'
  if (status === 'NEEDS_CONTRIBUTION') return '본인 기여 보완'
  return 'HR/리더 수동 검토'
}

function buildResultWritingReadiness2026(params: {
  activeEmployees: ActiveEmployee2026[]
  personalKpis: PersonalKpi2026[]
  selfEvaluations: ExistingSelfEvaluation2026[]
  departmentsById: Map<string, DepartmentNode2026>
  operationalStatusByKpiId: Map<string, PersonalKpiOperationalStatus>
  limit: number
}): Evaluation2026ResultWritingReadiness {
  const activeEmployeesById = new Map(params.activeEmployees.map((employee) => [employee.id, employee]))
  const activeEmployeeIds = new Set(params.activeEmployees.map((employee) => employee.id))
  const itemByPersonalKpiId = new Map<string, ExistingSelfEvaluation2026['items'][number]>()
  for (const evaluation of params.selfEvaluations) {
    if (!activeEmployeeIds.has(evaluation.targetId)) continue
    for (const item of evaluation.items) {
      if (!itemByPersonalKpiId.has(item.personalKpiId)) {
        itemByPersonalKpiId.set(item.personalKpiId, item)
      }
    }
  }

  const orgGoalReferences = params.personalKpis
    .filter((kpi) => kpi.policyCategory === 'ORG_GOAL')
    .map((kpi) => ({
      id: kpi.id,
      title: kpi.kpiName,
      kpiName: kpi.kpiName,
      definition: kpi.definition,
      formula: kpi.formula,
      linkedOrgKpiId: kpi.linkedOrgKpiId,
    }))

  const rows = params.personalKpis
    .filter((kpi) => activeEmployeeIds.has(kpi.employeeId))
    .map((kpi) => {
      const employee = activeEmployeesById.get(kpi.employeeId)
      const divisionId = resolveDivisionId({ departmentId: employee?.deptId, departmentsById: params.departmentsById })
      const divisionName = divisionId ? params.departmentsById.get(divisionId)?.deptName ?? divisionId : '본부 미지정'
      const managerId = employee?.managerId ?? employee?.teamLeaderId ?? null
      const manager = managerId ? activeEmployeesById.get(managerId) : null
      const monthlyRecords = kpi.monthlyRecords ?? []
      const latestMonthly = monthlyRecords[0] ?? null
      const item = itemByPersonalKpiId.get(kpi.id) ?? null
      const itemComment = item?.itemComment ?? null
      const textBundle = [kpi.kpiName, kpi.definition, kpi.formula, itemComment, latestMonthly?.activities, latestMonthly?.efforts]
        .filter((value): value is string => typeof value === 'string')
        .join(' ')
      const evidenceSourceCount = monthlyRecords.filter((record) =>
        hasMeaningfulText(record.evidenceComment, 4) ||
        hasAttachmentValue2026(record.attachments) ||
        /https?:\/\//i.test([record.activities, record.efforts, record.evidenceComment].filter(Boolean).join(' '))
      ).length + (/https?:\/\//i.test(itemComment ?? '') ? 1 : 0)
      const resultDraftPresent = hasMeaningfulText(itemComment, 10)
      const measurableResultPresent =
        monthlyRecords.some((record) => typeof record.actualValue === 'number' || typeof record.achievementRate === 'number') ||
        textContainsMeasurableResult2026(itemComment)
      const evidencePresent = evidenceSourceCount > 0
      const personalContributionPresent =
        hasMeaningfulText(kpi.definition, 12) || /(본인|기여|주도|담당|개선|실행|협업|역할)/.test(textBundle)
      const targetActualComparisonPresent =
        (kpi.targetValueT != null || kpi.targetValue != null || kpi.targetValueE != null) && measurableResultPresent
      const outputImpactPresent =
        hasMeaningfulText(kpi.formula, 8) ||
        hasMeaningfulText(latestMonthly?.activities, 8) ||
        hasMeaningfulText(latestMonthly?.efforts, 8) ||
        /(산출|결과|영향|효과|품질|안정|생산성|절감|단축|개선|완료)/.test(textBundle)
      const orgKpiAlignment = toOrgKpiAlignmentInput2026(kpi.linkedOrgKpi, params.departmentsById)
      const approvedOrgGoalSource =
        kpi.policyCategory === 'ORG_GOAL'
          ? Boolean(orgKpiAlignment && determineOrgKpiReflectionEligibility2026(orgKpiAlignment).eligibleAsOrgGoal)
          : false
      const duplicate =
        kpi.policyCategory === 'DAILY_WORK'
          ? detectDailyWorkDuplicateWithOrgGoal2026({
              dailyWork: {
                id: kpi.id,
                title: kpi.kpiName,
                kpiName: kpi.kpiName,
                definition: kpi.definition,
                formula: kpi.formula,
                linkedOrgKpiId: kpi.linkedOrgKpiId,
              },
              orgGoals: orgGoalReferences.filter((orgGoal) => orgGoal.id !== kpi.id),
            }).duplicated
          : false
      const warnings: Evaluation2026ResultWritingReadinessRow['warnings'] = []

      if (!resultDraftPresent) warnings.push(buildResultWritingWarning('MISSING_ACTUAL_RESULT'))
      if (!measurableResultPresent) warnings.push(buildResultWritingWarning('MISSING_MEASURABLE_RESULT'))
      if (!evidencePresent) warnings.push(buildResultWritingWarning('MISSING_EVIDENCE'))
      if (!personalContributionPresent) warnings.push(buildResultWritingWarning('MISSING_PERSONAL_CONTRIBUTION'))
      if (!targetActualComparisonPresent) warnings.push(buildResultWritingWarning('MISSING_TARGET_ACTUAL_COMPARISON'))
      if (!outputImpactPresent) warnings.push(buildResultWritingWarning('MISSING_OUTPUT_IMPACT'))
      if (!kpi.policyCategory) warnings.push(buildResultWritingWarning('MISSING_CATEGORY'))
      if (kpi.policyCategory === 'ORG_GOAL' && !approvedOrgGoalSource) {
        warnings.push(buildResultWritingWarning('ORG_GOAL_WITHOUT_APPROVED_SOURCE'))
      }
      if (duplicate) warnings.push(buildResultWritingWarning('DAILY_WORK_DUPLICATE_RISK'))
      if (
        (kpi.policyCategory === 'PROJECT_T' || kpi.policyCategory === 'PROJECT_K') &&
        !hasMeaningfulText(kpi.formula, 8) &&
        !/(산출|deliverable|완료|결과물|출시|구축)/i.test(textBundle)
      ) {
        warnings.push(buildResultWritingWarning('PROJECT_TK_MISSING_DELIVERABLE'))
      }
      if (textContainsAiScoreEvidence2026(textBundle)) {
        warnings.push(buildResultWritingWarning('AI_EVIDENCE_MIXED_IN_ANNUAL_SCORE'))
      }

      const status = resolveResultWritingStatus2026(warnings)

      return {
        personalKpiId: kpi.id,
        evaluationItemId: item?.id ?? null,
        employeeId: kpi.employeeId,
        employeeNo: employee?.empId ?? null,
        employeeName: employee?.empName ?? '대상자 미확인',
        email: employee?.gwsEmail ?? null,
        divisionId,
        divisionName,
        departmentId: employee?.deptId ?? null,
        departmentName:
          employee?.department?.deptName ??
          (employee?.deptId ? params.departmentsById.get(employee.deptId)?.deptName : null) ??
          '소속 조직 미지정',
        departmentPath: formatDepartmentPath({ departmentId: employee?.deptId, departmentsById: params.departmentsById }),
        leaderId: managerId,
        leaderName: manager?.empName ?? '리더 미지정',
        kpiName: kpi.kpiName,
        category: kpi.policyCategory,
        categoryLabel: getPolicyCategoryLabel2026(kpi.policyCategory),
        mboStatus: params.operationalStatusByKpiId.get(kpi.id) ?? 'DRAFT',
        resultWritingStatus: status,
        resultDraftPresent,
        evidencePresent,
        personalContributionPresent,
        measurableResultPresent,
        targetActualComparisonPresent,
        outputImpactPresent,
        linkedOrgKpiId: kpi.linkedOrgKpiId ?? null,
        linkedOrgKpiTitle: kpi.linkedOrgKpi?.kpiName ?? null,
        approvedOrgGoalSource,
        latestMonthlyRecordLabel: latestMonthly
          ? `${latestMonthly.yearMonth}${typeof latestMonthly.achievementRate === 'number' ? ` · 달성률 ${latestMonthly.achievementRate}%` : ''}`
          : null,
        evidenceSourceCount,
        warnings,
        nextAction: getResultWritingNextAction2026(status),
      } satisfies Evaluation2026ResultWritingReadinessRow
    })
    .sort((left, right) =>
      left.divisionName.localeCompare(right.divisionName, 'ko') ||
      left.departmentPath.localeCompare(right.departmentPath, 'ko') ||
      left.employeeName.localeCompare(right.employeeName, 'ko') ||
      left.kpiName.localeCompare(right.kpiName, 'ko')
    )

  const categoryWarningCounts = {
    ORG_GOAL: 0,
    PROJECT_T: 0,
    PROJECT_K: 0,
    DAILY_WORK: 0,
    UNMAPPED: 0,
  }
  for (const row of rows) {
    if (!row.warnings.length) continue
    categoryWarningCounts[row.category ?? 'UNMAPPED'] += 1
  }

  const countWarning = (code: Evaluation2026ResultWritingWarningCode) =>
    rows.filter((row) => row.warnings.some((warning) => warning.code === code)).length

  return {
    mode: 'READ_ONLY',
    guidance: RESULT_WRITING_GUIDANCE_2026,
    evidenceGuidance: RESULT_WRITING_EVIDENCE_GUIDANCE_2026,
    leaderReviewChecklist: RESULT_WRITING_LEADER_REVIEW_CHECKLIST_2026,
    exportColumns: [
      'employeeNo',
      'employeeName',
      'email',
      'division',
      'departmentPath',
      'leader',
      'category',
      'mboStatus',
      'resultWritingStatus',
      'kpiName',
      'warnings',
      'nextAction',
    ],
    summary: {
      totalItemCount: rows.length,
      resultDraftPresentCount: rows.filter((row) => row.resultDraftPresent).length,
      missingResultCount: countWarning('MISSING_ACTUAL_RESULT'),
      missingEvidenceCount: countWarning('MISSING_EVIDENCE'),
      missingContributionCount: countWarning('MISSING_PERSONAL_CONTRIBUTION'),
      missingMeasurableResultCount: countWarning('MISSING_MEASURABLE_RESULT'),
      missingCategoryCount: countWarning('MISSING_CATEGORY'),
      orgGoalSourceWarningCount: countWarning('ORG_GOAL_WITHOUT_APPROVED_SOURCE'),
      dailyWorkDuplicateRiskCount: countWarning('DAILY_WORK_DUPLICATE_RISK'),
      projectTkMissingDeliverableCount: countWarning('PROJECT_TK_MISSING_DELIVERABLE'),
      aiEvidenceMixedCount: countWarning('AI_EVIDENCE_MIXED_IN_ANNUAL_SCORE'),
      leaderReviewWarningCount: rows.filter((row) => row.warnings.length > 0).length,
      readyForReviewCount: rows.filter((row) => row.resultWritingStatus === 'READY_FOR_REVIEW').length,
      warningItemCount: rows.filter((row) => row.warnings.length > 0).length,
      categoryWarningCounts,
      officialScoringEnabled: false,
      officialGradeEnabled: false,
    },
    rows: rows.slice(0, params.limit),
    safety: {
      writesPerformed: false,
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

function getMboSetupStatusActionLabel2026(status: Evaluation2026MboSetupMonitoringStatus) {
  if (status === 'MISSING') return '작성 요청 필요'
  if (status === 'DRAFT') return '제출 요청 필요'
  if (status === 'SUBMITTED_REVIEWING') return '리더 검토 필요'
  return '완료'
}

function resolveMboSetupMonitoringStatus2026(params: {
  kpis: PersonalKpi2026[]
  statuses: PersonalKpiOperationalStatus[]
}): Evaluation2026MboSetupMonitoringStatus {
  if (!params.kpis.length) return 'MISSING'
  if (params.statuses.some((status) => status === 'SUBMITTED' || status === 'MANAGER_REVIEW')) {
    return 'SUBMITTED_REVIEWING'
  }
  if (params.statuses.some((status) => status === 'DRAFT')) return 'DRAFT'
  return 'CONFIRMED'
}

function resolveTeamKpiHrReviewStatus2026(params: {
  orgKpi: TeamOrgKpiForHrReview2026
  eligibility: ReturnType<typeof determineOrgKpiReflectionEligibility2026>
}): Evaluation2026TeamKpiHrReviewStatus {
  if (params.orgKpi.mboExceptionApproved && hasText(params.orgKpi.mboExceptionReason)) return 'EXCEPTION_APPROVED'
  if (params.eligibility.eligibleAsOrgGoal) return 'APPROVED_FOR_ORG_GOAL'

  const latestVerdict = params.orgKpi.teamKpiReviewItems?.[0]?.verdict ?? null
  if (latestVerdict === 'INSUFFICIENT' || params.orgKpi.status === 'ARCHIVED') return 'EXCLUDED_DAILY_WORK'
  if (latestVerdict === 'CAUTION') return 'NEEDS_DISCUSSION'
  return 'PENDING_REVIEW'
}

function getTeamKpiHrReviewStatusLabel2026(status: Evaluation2026TeamKpiHrReviewStatus) {
  if (status === 'APPROVED_FOR_ORG_GOAL') return '조직목표 반영 가능'
  if (status === 'EXCLUDED_DAILY_WORK') return '일상업무 처리'
  if (status === 'EXCEPTION_APPROVED') return '예외 승인'
  if (status === 'NEEDS_DISCUSSION') return '검토 필요'
  return '검토 대기'
}

function getTeamKpiHrDecisionLabel2026(status: Evaluation2026TeamKpiHrReviewStatus) {
  if (status === 'APPROVED_FOR_ORG_GOAL') return 'APPROVED_FOR_ORG_GOAL'
  if (status === 'EXCLUDED_DAILY_WORK') return 'EXCLUDED_DAILY_WORK'
  if (status === 'EXCEPTION_APPROVED') return 'EXCEPTION_APPROVED'
  if (status === 'NEEDS_DISCUSSION') return 'NEEDS_DISCUSSION'
  return 'PENDING_REVIEW'
}

function resolveTeamKpiHrReason2026(params: {
  status: Evaluation2026TeamKpiHrReviewStatus
  orgKpi: TeamOrgKpiForHrReview2026
  latestReview: TeamKpiReviewItemSnapshot2026 | null
}): Evaluation2026TeamKpiHrReason | null {
  if (params.status === 'PENDING_REVIEW') return null
  const manualReason = params.latestReview?.rationale?.trim()
  if (
    EVALUATION_2026_TEAM_KPI_HR_REASON_VALUES.includes(
      manualReason as Evaluation2026TeamKpiHrReason
    )
  ) {
    return manualReason as Evaluation2026TeamKpiHrReason
  }
  if (params.status === 'EXCEPTION_APPROVED') return '기타 HR 사유'
  if (params.status === 'APPROVED_FOR_ORG_GOAL') {
    if (params.orgKpi.parentOrgKpiId) return '본부 KPI 직접 포함'
    return '핵심 과제'
  }
  if (params.status === 'EXCLUDED_DAILY_WORK') {
    if (hasText(params.latestReview?.duplicationComment)) return '중복 목표'
    return '단순 운영/유지 업무'
  }
  return '기타 HR 사유'
}

function buildTeamKpiHrReviewCoverage2026(params: {
  orgKpis: TeamOrgKpiForHrReview2026[]
  activeEmployees: ActiveEmployee2026[]
  personalKpis: PersonalKpi2026[]
  departmentsById: Map<string, DepartmentNode2026>
  personalKpiOrgGoalWithoutApprovedSourceCount: number
}): Evaluation2026TeamKpiHrReviewCoverage {
  const ownerByDepartmentId = new Map<string, ActiveEmployee2026>()
  for (const employee of params.activeEmployees) {
    if (employee.position === 'TEAM_LEADER' || employee.position === 'SECTION_CHIEF' || employee.position === 'DIV_HEAD') {
      if (!ownerByDepartmentId.has(employee.deptId)) ownerByDepartmentId.set(employee.deptId, employee)
    }
  }

  const candidates = params.orgKpis
    .filter((orgKpi) => Boolean(orgKpi.department?.parentDeptId))
    .map((orgKpi) => {
      const latestReview = orgKpi.teamKpiReviewItems?.[0] ?? null
      const departmentId = orgKpi.department?.id ?? orgKpi.deptId
      const divisionId = resolveDivisionId({ departmentId, departmentsById: params.departmentsById })
      const eligibility = determineOrgKpiReflectionEligibility2026(
        toTeamOrgKpiAlignmentInput2026(orgKpi, params.departmentsById)
      )
      const reviewStatus = resolveTeamKpiHrReviewStatus2026({ orgKpi, eligibility })
      const reason = resolveTeamKpiHrReason2026({ status: reviewStatus, orgKpi, latestReview })
      const owner = ownerByDepartmentId.get(departmentId)
      const affectedActiveEmployeeCount = params.activeEmployees.filter((employee) =>
        isDepartmentInScope2026({
          employeeDepartmentId: employee.deptId,
          scopeDepartmentId: departmentId,
          departmentsById: params.departmentsById,
        })
      ).length
      const notes =
        orgKpi.mboExceptionReason?.trim() ||
        latestReview?.recommendationText?.trim() ||
        latestReview?.rationale?.trim() ||
        latestReview?.improvementSuggestions?.trim() ||
        null
      const reviewedAt = latestReview?.createdAt
        ? serializeDate(latestReview.createdAt)
        : latestReview?.run?.createdAt
          ? serializeDate(latestReview.run.createdAt)
          : orgKpi.mboExceptionApprovedAt
            ? serializeDate(orgKpi.mboExceptionApprovedAt)
            : null

      return {
        orgKpiId: orgKpi.id,
        teamKpiName: orgKpi.kpiName,
        evalYear: orgKpi.evalYear,
        divisionId,
        divisionName: divisionId ? params.departmentsById.get(divisionId)?.deptName ?? divisionId : '본부 미지정',
        departmentId,
        departmentName: orgKpi.department?.deptName ?? params.departmentsById.get(departmentId)?.deptName ?? '팀 미지정',
        departmentPath: formatDepartmentPath({ departmentId, departmentsById: params.departmentsById }),
        ownerName: owner?.empName ?? '리더 미지정',
        ownerId: owner?.id ?? null,
        linkedDivisionKpiId: orgKpi.parentOrgKpi?.id ?? orgKpi.parentOrgKpiId ?? null,
        linkedDivisionKpiName: orgKpi.parentOrgKpi?.kpiName ?? null,
        linkedDivisionKpiDepartmentName: orgKpi.parentOrgKpi?.department?.deptName ?? null,
        reviewStatus,
        reviewStatusLabel: getTeamKpiHrReviewStatusLabel2026(reviewStatus),
        hrDecisionLabel: getTeamKpiHrDecisionLabel2026(reviewStatus),
        reason,
        notes,
        latestReviewVerdict: latestReview?.verdict ?? null,
        latestReviewAt: reviewedAt,
        reviewedById: latestReview?.run?.requesterId ?? orgKpi.mboExceptionApprovedById ?? null,
        reviewedAt,
        affectedActiveEmployeeCount,
        linkedPersonalKpiCount: params.personalKpis.filter((personalKpi) => personalKpi.linkedOrgKpiId === orgKpi.id).length,
        suggestedMboCategory: eligibility.eligibleAsOrgGoal ? 'ORG_GOAL' : 'DAILY_WORK',
        canSuggestAsOrgGoal: eligibility.eligibleAsOrgGoal,
        guidance: eligibility.eligibleAsOrgGoal
          ? '본부 KPI에 포함되거나 HR이 승인한 팀 KPI로 개인 MBO 조직목표 후보가 될 수 있습니다.'
          : 'HR 반영 완료 또는 예외 승인 전까지는 개인 MBO 조직목표가 아니라 일상업무/개인 과업으로 검토합니다.',
      } satisfies Evaluation2026TeamKpiHrReviewCandidate
    })
    .sort((left, right) =>
      left.divisionName.localeCompare(right.divisionName, 'ko') ||
      left.departmentPath.localeCompare(right.departmentPath, 'ko') ||
      left.teamKpiName.localeCompare(right.teamKpiName, 'ko')
    )

  return {
    totalCandidates: candidates.length,
    pendingReviewCount: candidates.filter((candidate) => candidate.reviewStatus === 'PENDING_REVIEW').length,
    approvedForOrgGoalCount: candidates.filter((candidate) => candidate.reviewStatus === 'APPROVED_FOR_ORG_GOAL').length,
    excludedDailyWorkCount: candidates.filter((candidate) => candidate.reviewStatus === 'EXCLUDED_DAILY_WORK').length,
    exceptionApprovedCount: candidates.filter((candidate) => candidate.reviewStatus === 'EXCEPTION_APPROVED').length,
    needsDiscussionCount: candidates.filter((candidate) => candidate.reviewStatus === 'NEEDS_DISCUSSION').length,
    personalKpiOrgGoalWithoutApprovedSourceCount: params.personalKpiOrgGoalWithoutApprovedSourceCount,
    candidates,
  }
}

function buildMboSetupCoverage2026(params: {
  activeEmployees: ActiveEmployee2026[]
  personalKpis: PersonalKpi2026[]
  departmentsById: Map<string, DepartmentNode2026>
  operationalStatusByKpiId: Map<string, PersonalKpiOperationalStatus>
}) {
  const kpisByEmployeeId = new Map<string, PersonalKpi2026[]>()
  const employeeStatusSets = new Map<string, Set<PersonalKpiOperationalStatus>>()
  const activeEmployeeIds = new Set(params.activeEmployees.map((employee) => employee.id))
  const activeEmployeesById = new Map(params.activeEmployees.map((employee) => [employee.id, employee]))

  const categoryDistribution = {
    ORG_GOAL: 0,
    PROJECT_T: 0,
    PROJECT_K: 0,
    DAILY_WORK: 0,
    UNMAPPED: 0,
  }
  const personalKpiStatusDistribution = {
    draft: 0,
    submitted: 0,
    managerReview: 0,
    confirmed: 0,
    locked: 0,
    archived: 0,
  }
  const warningCounts = {
    orgGoalWithoutEligibleOrgKpi: 0,
    dailyWorkDuplicateRisk: 0,
    missingWeight: 0,
    missingPlan: 0,
    missingMeasurableTarget: 0,
    missingOwnerContribution: 0,
    missingCategory: 0,
  }

  for (const kpi of params.personalKpis) {
    if (!activeEmployeeIds.has(kpi.employeeId)) continue
    const current = kpisByEmployeeId.get(kpi.employeeId) ?? []
    current.push(kpi)
    kpisByEmployeeId.set(kpi.employeeId, current)

    const status = params.operationalStatusByKpiId.get(kpi.id) ?? 'DRAFT'
    if (status === 'SUBMITTED') personalKpiStatusDistribution.submitted += 1
    else if (status === 'MANAGER_REVIEW') personalKpiStatusDistribution.managerReview += 1
    else if (status === 'CONFIRMED') personalKpiStatusDistribution.confirmed += 1
    else if (status === 'LOCKED') personalKpiStatusDistribution.locked += 1
    else if (status === 'ARCHIVED') personalKpiStatusDistribution.archived += 1
    else personalKpiStatusDistribution.draft += 1

    const statusSet = employeeStatusSets.get(kpi.employeeId) ?? new Set<PersonalKpiOperationalStatus>()
    statusSet.add(status)
    employeeStatusSets.set(kpi.employeeId, statusSet)

    const category = kpi.policyCategory
    if (category === 'ORG_GOAL' || category === 'PROJECT_T' || category === 'PROJECT_K' || category === 'DAILY_WORK') {
      categoryDistribution[category] += 1
    } else {
      categoryDistribution.UNMAPPED += 1
      warningCounts.missingCategory += 1
    }

    if (!kpi.weight || kpi.weight <= 0) warningCounts.missingWeight += 1
    if (!hasMeaningfulText(kpi.formula)) warningCounts.missingPlan += 1
    if (kpi.targetValueT == null) warningCounts.missingMeasurableTarget += 1
    if (!hasMeaningfulText(kpi.definition)) warningCounts.missingOwnerContribution += 1

    if (category === 'ORG_GOAL') {
      const orgKpi = toOrgKpiAlignmentInput2026(kpi.linkedOrgKpi, params.departmentsById)
      if (!orgKpi || !determineOrgKpiReflectionEligibility2026(orgKpi).eligibleAsOrgGoal) {
        warningCounts.orgGoalWithoutEligibleOrgKpi += 1
      }
    }
  }

  const orgGoalReferences = params.personalKpis
    .filter((kpi) => kpi.policyCategory === 'ORG_GOAL')
    .map((kpi) => ({
      id: kpi.id,
      title: kpi.kpiName,
      kpiName: kpi.kpiName,
      definition: kpi.definition,
      formula: kpi.formula,
      linkedOrgKpiId: kpi.linkedOrgKpiId,
    }))

  for (const kpi of params.personalKpis) {
    if (kpi.policyCategory !== 'DAILY_WORK') continue
    const duplicate = detectDailyWorkDuplicateWithOrgGoal2026({
      dailyWork: {
        id: kpi.id,
        title: kpi.kpiName,
        kpiName: kpi.kpiName,
        definition: kpi.definition,
        formula: kpi.formula,
        linkedOrgKpiId: kpi.linkedOrgKpiId,
      },
      orgGoals: orgGoalReferences.filter((orgGoal) => orgGoal.id !== kpi.id),
    })
    if (duplicate.duplicated) warningCounts.dailyWorkDuplicateRisk += 1
  }

  const countEmployeesWithStatus = (predicate: (statuses: Set<PersonalKpiOperationalStatus>) => boolean) =>
    params.activeEmployees.filter((employee) => predicate(employeeStatusSets.get(employee.id) ?? new Set())).length

  const divisionBuckets = new Map<string, ActiveEmployee2026[]>()
  const teamBuckets = new Map<string, ActiveEmployee2026[]>()
  for (const employee of params.activeEmployees) {
    const divisionId = resolveDivisionId({ departmentId: employee.deptId, departmentsById: params.departmentsById })
    if (divisionId) {
      const current = divisionBuckets.get(divisionId) ?? []
      current.push(employee)
      divisionBuckets.set(divisionId, current)
    }
    if (employee.deptId) {
      const current = teamBuckets.get(employee.deptId) ?? []
      current.push(employee)
      teamBuckets.set(employee.deptId, current)
    }
  }

  const buildCoverageCounts = (employees: ActiveEmployee2026[]) => {
    const employeesWithDraftPersonalKpiCount = employees.filter((employee) =>
      (employeeStatusSets.get(employee.id) ?? new Set()).has('DRAFT')
    ).length
    const employeesWithSubmittedPersonalKpiCount = employees.filter((employee) => {
      const statuses = employeeStatusSets.get(employee.id) ?? new Set()
      return statuses.has('SUBMITTED') || statuses.has('MANAGER_REVIEW')
    }).length
    const employeesWithConfirmedPersonalKpiCount = employees.filter((employee) =>
      (employeeStatusSets.get(employee.id) ?? new Set()).has('CONFIRMED')
    ).length
    const employeesMissingAnyPersonalKpiCount = employees.filter((employee) => !kpisByEmployeeId.has(employee.id)).length

    return {
      employeesWithDraftPersonalKpiCount,
      employeesWithSubmittedPersonalKpiCount,
      employeesWithConfirmedPersonalKpiCount,
      employeesMissingAnyPersonalKpiCount,
    }
  }

  const divisionCoverage = Array.from(divisionBuckets.entries())
    .map(([divisionId, employees]) => {
      const counts = buildCoverageCounts(employees)
      return {
        divisionId,
        divisionName: params.departmentsById.get(divisionId)?.deptName ?? divisionId,
        activeEmployeeCount: employees.length,
        draftPersonalKpiEmployeeCount: counts.employeesWithDraftPersonalKpiCount,
        submittedPersonalKpiEmployeeCount: counts.employeesWithSubmittedPersonalKpiCount,
        confirmedPersonalKpiEmployeeCount: counts.employeesWithConfirmedPersonalKpiCount,
        missingAnyPersonalKpiEmployeeCount: counts.employeesMissingAnyPersonalKpiCount,
        currentSalesGroup: null,
      } satisfies Evaluation2026ReadinessPopulationDivisionCoverage
    })
    .sort((left, right) => left.divisionName.localeCompare(right.divisionName, 'ko'))

  const teamCoverage = Array.from(teamBuckets.entries())
    .map(([departmentId, employees]) => ({
      departmentId,
      departmentName: params.departmentsById.get(departmentId)?.deptName ?? departmentId,
      departmentPath: formatDepartmentPath({ departmentId, departmentsById: params.departmentsById }),
      activeEmployeeCount: employees.length,
      draftPersonalKpiEmployeeCount: buildCoverageCounts(employees).employeesWithDraftPersonalKpiCount,
      submittedPersonalKpiEmployeeCount: buildCoverageCounts(employees).employeesWithSubmittedPersonalKpiCount,
      confirmedPersonalKpiEmployeeCount: buildCoverageCounts(employees).employeesWithConfirmedPersonalKpiCount,
      missingAnyPersonalKpiEmployeeCount: buildCoverageCounts(employees).employeesMissingAnyPersonalKpiCount,
    }))
    .sort((left, right) => right.missingAnyPersonalKpiEmployeeCount - left.missingAnyPersonalKpiEmployeeCount)

  const employeeRows = params.activeEmployees
    .map((employee) => {
      const employeeKpis = kpisByEmployeeId.get(employee.id) ?? []
      const statuses = employeeKpis.map((kpi) => params.operationalStatusByKpiId.get(kpi.id) ?? 'DRAFT')
      const status = resolveMboSetupMonitoringStatus2026({ kpis: employeeKpis, statuses })
      const divisionId = resolveDivisionId({ departmentId: employee.deptId, departmentsById: params.departmentsById })
      const divisionName = divisionId ? params.departmentsById.get(divisionId)?.deptName ?? divisionId : '본부 미지정'
      const managerId = employee.managerId ?? employee.teamLeaderId ?? null
      const manager = managerId ? activeEmployeesById.get(managerId) : null
      return {
        employeeId: employee.id,
        employeeNo: employee.empId ?? null,
        employeeName: employee.empName,
        email: employee.gwsEmail ?? null,
        divisionId,
        divisionName,
        departmentId: employee.deptId ?? null,
        departmentName:
          employee.department?.deptName ??
          params.departmentsById.get(employee.deptId)?.deptName ??
          '소속 조직 미지정',
        departmentPath: formatDepartmentPath({ departmentId: employee.deptId, departmentsById: params.departmentsById }),
        managerId,
        managerName: manager?.empName ?? '리더 미지정',
        status,
        actionLabel: getMboSetupStatusActionLabel2026(status),
        totalPersonalKpiCount: employeeKpis.length,
        draftPersonalKpiCount: statuses.filter((item) => item === 'DRAFT').length,
        submittedPersonalKpiCount: statuses.filter((item) => item === 'SUBMITTED').length,
        managerReviewPersonalKpiCount: statuses.filter((item) => item === 'MANAGER_REVIEW').length,
        confirmedPersonalKpiCount: statuses.filter((item) => item === 'CONFIRMED').length,
        missingPolicyCategoryCount: employeeKpis.filter((kpi) => !kpi.policyCategory).length,
        linkedOrgKpiPersonalKpiCount: employeeKpis.filter((kpi) => Boolean(kpi.linkedOrgKpiId)).length,
      } satisfies Evaluation2026MboSetupEmployeeMonitoringRow
    })
    .sort((left, right) =>
      left.divisionName.localeCompare(right.divisionName, 'ko') ||
      left.departmentPath.localeCompare(right.departmentPath, 'ko') ||
      left.employeeName.localeCompare(right.employeeName, 'ko')
    )

  const policyCategoryMissingItems = params.personalKpis
    .filter((kpi) => activeEmployeeIds.has(kpi.employeeId) && !kpi.policyCategory)
    .map((kpi) => {
      const employee = activeEmployeesById.get(kpi.employeeId)
      const divisionId = resolveDivisionId({ departmentId: employee?.deptId, departmentsById: params.departmentsById })
      const divisionName = divisionId ? params.departmentsById.get(divisionId)?.deptName ?? divisionId : '본부 미지정'
      const managerId = employee?.managerId ?? employee?.teamLeaderId ?? null
      const manager = managerId ? activeEmployeesById.get(managerId) : null
      return {
        personalKpiId: kpi.id,
        personalKpiName: kpi.kpiName,
        employeeId: kpi.employeeId,
        employeeNo: employee?.empId ?? null,
        employeeName: employee?.empName ?? '대상자 미확인',
        email: employee?.gwsEmail ?? null,
        divisionId,
        divisionName,
        departmentId: employee?.deptId ?? null,
        departmentName:
          employee?.department?.deptName ??
          (employee?.deptId ? params.departmentsById.get(employee.deptId)?.deptName : null) ??
          '소속 조직 미지정',
        departmentPath: formatDepartmentPath({ departmentId: employee?.deptId, departmentsById: params.departmentsById }),
        managerId,
        managerName: manager?.empName ?? '리더 미지정',
        operationalStatus: params.operationalStatusByKpiId.get(kpi.id) ?? 'DRAFT',
        currentCategory: null,
        linkedOrgKpiId: kpi.linkedOrgKpiId ?? null,
        linkedOrgKpiTitle: kpi.linkedOrgKpi?.kpiName ?? null,
        actionLabel: '카테고리 확정 필요',
      } satisfies Evaluation2026MboPolicyCategoryMissingItemRow
    })
    .sort((left, right) =>
      left.divisionName.localeCompare(right.divisionName, 'ko') ||
      left.departmentPath.localeCompare(right.departmentPath, 'ko') ||
      left.employeeName.localeCompare(right.employeeName, 'ko') ||
      left.personalKpiName.localeCompare(right.personalKpiName, 'ko')
    )

  return {
    employeesWithDraftPersonalKpiCount: countEmployeesWithStatus((statuses) => statuses.has('DRAFT')),
    employeesWithSubmittedPersonalKpiCount: countEmployeesWithStatus(
      (statuses) => statuses.has('SUBMITTED') || statuses.has('MANAGER_REVIEW')
    ),
    employeesWithConfirmedPersonalKpiCount: countEmployeesWithStatus((statuses) => statuses.has('CONFIRMED')),
    employeesMissingAnyPersonalKpiCount: params.activeEmployees.filter((employee) => !kpisByEmployeeId.has(employee.id)).length,
    personalKpiStatusDistribution,
    categoryDistribution,
    linkedOrgKpiPersonalKpiCount: params.personalKpis.filter((kpi) => Boolean(kpi.linkedOrgKpiId)).length,
    warningCounts,
    divisionCoverage,
    teamCoverage,
    monitoring: {
      employeeRows,
      missingMboEmployees: employeeRows.filter((employee) => employee.status === 'MISSING'),
      draftMboEmployees: employeeRows.filter((employee) => employee.status === 'DRAFT'),
      submittedReviewingMboEmployees: employeeRows.filter((employee) => employee.status === 'SUBMITTED_REVIEWING'),
      confirmedMboEmployees: employeeRows.filter((employee) => employee.status === 'CONFIRMED'),
      policyCategoryMissingItems,
    },
  }
}

export async function getEvaluation2026ReadinessPopulationDryRun(params: {
  db?: Evaluation2026ReadinessPopulationDb
  evalCycleId: string
  limit?: number
  env?: NodeJS.ProcessEnv
}): Promise<Evaluation2026ReadinessPopulationDryRun> {
  const db = params.db ?? prisma
  const limit = Math.max(1, Math.min(params.limit ?? 80, 300))
  const cycle = await db.evalCycle.findUnique({
    where: { id: params.evalCycleId },
    select: {
      id: true,
      orgId: true,
      cycleName: true,
      evalYear: true,
      status: true,
      performanceDesignConfig: true,
    },
  }) as EvalCycleForDryRun2026 | null

  if (!cycle) {
    throw new AppError(404, 'EVAL_CYCLE_NOT_FOUND', '평가 주기를 찾을 수 없습니다.')
  }

  const [departments, activeEmployees, personalKpis, selfEvaluations, teamOrgKpis] = await Promise.all([
    db.department.findMany({
      where: { orgId: cycle.orgId },
      select: {
        id: true,
        deptName: true,
        parentDeptId: true,
      },
      orderBy: [{ parentDeptId: 'asc' }, { deptName: 'asc' }],
    }),
    db.employee.findMany({
      where: {
        status: 'ACTIVE',
        department: {
          orgId: cycle.orgId,
        },
      },
      select: {
        id: true,
        empId: true,
        empName: true,
        gwsEmail: true,
        deptId: true,
        role: true,
        position: true,
        managerId: true,
        teamLeaderId: true,
        department: {
          select: {
            id: true,
            deptName: true,
            parentDeptId: true,
          },
        },
      },
      orderBy: [{ empName: 'asc' }],
    }),
    db.personalKpi.findMany({
      where: {
        evalYear: cycle.evalYear,
        status: {
          not: 'ARCHIVED',
        },
      },
      select: {
        id: true,
        employeeId: true,
        kpiName: true,
        definition: true,
        formula: true,
        policyCategory: true,
        status: true,
        weight: true,
        targetValue: true,
        targetValueT: true,
        targetValueE: true,
        linkedOrgKpiId: true,
        linkedOrgKpi: {
          select: {
            id: true,
            kpiName: true,
            status: true,
            parentOrgKpiId: true,
            mboExceptionApproved: true,
            mboExceptionReason: true,
            mboExceptionApprovedById: true,
            mboExceptionApprovedAt: true,
            department: {
              select: {
                id: true,
                deptName: true,
                parentDeptId: true,
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
        },
        monthlyRecords: {
          orderBy: {
            yearMonth: 'desc',
          },
          take: 12,
          select: {
            id: true,
            yearMonth: true,
            actualValue: true,
            achievementRate: true,
            activities: true,
            obstacles: true,
            efforts: true,
            evidenceComment: true,
            attachments: true,
            submittedAt: true,
            isDraft: true,
          },
        },
      },
      orderBy: [{ employeeId: 'asc' }, { createdAt: 'asc' }],
    }),
    db.evaluation.findMany({
      where: {
        evalCycleId: cycle.id,
        evalStage: 'SELF',
      },
      select: {
        id: true,
        targetId: true,
        evalStage: true,
        items: {
          select: {
            id: true,
            personalKpiId: true,
            policyCategory: true,
            itemComment: true,
            targetAchievementLevel: true,
            personalKpi: {
              select: {
                id: true,
                kpiName: true,
                policyCategory: true,
              },
            },
          },
        },
      },
      orderBy: [{ targetId: 'asc' }],
    }),
    db.orgKpi
      ? db.orgKpi.findMany({
          where: {
            evalYear: cycle.evalYear,
            department: {
              orgId: cycle.orgId,
              parentDeptId: {
                not: null,
              },
            },
          },
          select: {
            id: true,
            deptId: true,
            evalYear: true,
            kpiName: true,
            status: true,
            parentOrgKpiId: true,
            mboExceptionApproved: true,
            mboExceptionReason: true,
            mboExceptionApprovedById: true,
            mboExceptionApprovedAt: true,
            department: {
              select: {
                id: true,
                deptName: true,
                parentDeptId: true,
              },
            },
            parentOrgKpi: {
              select: {
                id: true,
                kpiName: true,
                department: {
                  select: {
                    deptName: true,
                  },
                },
              },
            },
            teamKpiReviewItems: {
              orderBy: {
                createdAt: 'desc',
              },
              take: 1,
              select: {
                id: true,
                verdict: true,
                rationale: true,
                linkageComment: true,
                duplicationComment: true,
                recommendationText: true,
                improvementSuggestions: true,
                createdAt: true,
                run: {
                  select: {
                    id: true,
                    requesterId: true,
                    reviewType: true,
                    overallVerdict: true,
                    overallSummary: true,
                    aiRequestLogId: true,
                    createdAt: true,
                  },
                },
              },
            },
          },
          orderBy: [{ deptId: 'asc' }, { kpiName: 'asc' }],
        })
      : Promise.resolve([]),
  ])

  const departmentsById = new Map(
    (departments as DepartmentNode2026[]).map((department) => [department.id, department])
  )
  const activeEmployeesById = new Map((activeEmployees as ActiveEmployee2026[]).map((employee) => [employee.id, employee]))
  const activeEmployeeIds = new Set(activeEmployeesById.keys())
  const typedPersonalKpis = (personalKpis as PersonalKpi2026[]).filter((kpi) => activeEmployeeIds.has(kpi.employeeId))
  const auditLogs = typedPersonalKpis.length && db.auditLog
    ? await db.auditLog.findMany({
        where: {
          entityType: 'PersonalKpi',
          entityId: {
            in: typedPersonalKpis.map((kpi) => kpi.id),
          },
        },
        orderBy: {
          timestamp: 'desc',
        },
        take: Math.max(200, typedPersonalKpis.length * 8),
      }) as PersonalKpiAuditLog2026[]
    : []
  const logsByKpiId = buildLogsByKpiId(auditLogs)
  const operationalStatusByKpiId: Map<string, PersonalKpiOperationalStatus> = new Map(
    typedPersonalKpis.map((kpi) => [kpi.id, toOperationalStatus2026(kpi, logsByKpiId)])
  )
  const confirmedPersonalKpis = typedPersonalKpis.filter(
    (kpi) => operationalStatusByKpiId.get(kpi.id) === 'CONFIRMED'
  )
  const kpisByEmployeeId = new Map<string, PersonalKpi2026[]>()

  for (const kpi of confirmedPersonalKpis) {
    const current = kpisByEmployeeId.get(kpi.employeeId) ?? []
    current.push(kpi)
    kpisByEmployeeId.set(kpi.employeeId, current)
  }

  const selfEvaluationByTargetId = new Map(
    (selfEvaluations as ExistingSelfEvaluation2026[]).map((evaluation) => [evaluation.targetId, evaluation])
  )

  const employeesWithConfirmedPersonalKpi: Evaluation2026ReadinessPopulationEmployeeSummary[] = []
  const employeesMissingConfirmedPersonalKpi: Evaluation2026ReadinessPopulationEmployeeSummary[] = []
  const wouldCreateSelfEvaluations: Evaluation2026ReadinessPopulationWouldCreateEvaluation[] = []
  const existingSelfEvaluationsSkipped: Evaluation2026ReadinessPopulationSkippedEvaluation[] = []
  let wouldCreateEvaluationItemCount = 0
  let existingEvaluationItemsSkippedCount = 0
  let policyCategoryMissingCount = 0

  for (const employee of activeEmployees as ActiveEmployee2026[]) {
    const confirmedKpis = kpisByEmployeeId.get(employee.id) ?? []
    const summary = makeEmployeeSummary({
      employee,
      confirmedPersonalKpiCount: confirmedKpis.length,
      departmentsById,
    })

    if (!confirmedKpis.length) {
      employeesMissingConfirmedPersonalKpi.push(summary)
      continue
    }

    employeesWithConfirmedPersonalKpi.push(summary)
    const existingSelfEvaluation = selfEvaluationByTargetId.get(employee.id)
    if (existingSelfEvaluation) {
      const missing = countMissingPolicyCategoriesForExistingItems(existingSelfEvaluation)
      existingEvaluationItemsSkippedCount += existingSelfEvaluation.items.length
      policyCategoryMissingCount += missing
      existingSelfEvaluationsSkipped.push({
        evaluationId: existingSelfEvaluation.id,
        employeeId: employee.id,
        employeeName: employee.empName,
        departmentName: summary.departmentName,
        confirmedPersonalKpiCount: confirmedKpis.length,
        existingItemCount: existingSelfEvaluation.items.length,
        missingPolicyCategoryCount: missing,
      })
      continue
    }

    const missing = countMissingPolicyCategoriesForKpis(confirmedKpis)
    policyCategoryMissingCount += missing
    wouldCreateEvaluationItemCount += confirmedKpis.length
    wouldCreateSelfEvaluations.push({
      employeeId: employee.id,
      employeeName: employee.empName,
      departmentName: summary.departmentName,
      confirmedPersonalKpiCount: confirmedKpis.length,
      wouldCreateItemCount: confirmedKpis.length,
      missingPolicyCategoryCount: missing,
      itemTitles: confirmedKpis.slice(0, 5).map((kpi) => kpi.kpiName),
    })
  }

  const mappings = readPolicy2026PreviewMappings(cycle.performanceDesignConfig)
  const activeEmployeeCountByDivisionId = new Map<string, number>()
  const confirmedEmployeeCountByDivisionId = new Map<string, number>()
  const affectedEmployeeCountByDepartmentId = new Map<string, number>()

  for (const employee of activeEmployees as ActiveEmployee2026[]) {
    const divisionId = resolveDivisionId({
      departmentId: employee.deptId,
      departmentsById,
    })
    if (divisionId) {
      activeEmployeeCountByDivisionId.set(divisionId, (activeEmployeeCountByDivisionId.get(divisionId) ?? 0) + 1)
      if (kpisByEmployeeId.has(employee.id)) {
        confirmedEmployeeCountByDivisionId.set(
          divisionId,
          (confirmedEmployeeCountByDivisionId.get(divisionId) ?? 0) + 1
        )
      }
    }

    for (const departmentId of resolveDepartmentOverridePath({
      departmentId: employee.deptId,
      departmentsById,
    })) {
      affectedEmployeeCountByDepartmentId.set(
        departmentId,
        (affectedEmployeeCountByDepartmentId.get(departmentId) ?? 0) + 1
      )
    }
  }

  const rootDivisions = (departments as DepartmentNode2026[])
    .filter((department) => !department.parentDeptId && (activeEmployeeCountByDivisionId.get(department.id) ?? 0) > 0)
    .sort((left, right) => left.deptName.localeCompare(right.deptName, 'ko'))
  const divisions = rootDivisions.map((division) => {
    const currentSalesGroup = mappings.salesGroupsByDivisionId[division.id]?.salesGroup ?? null
    return {
      divisionId: division.id,
      divisionName: division.deptName,
      activeEmployeeCount: activeEmployeeCountByDivisionId.get(division.id) ?? 0,
      draftPersonalKpiEmployeeCount: 0,
      submittedPersonalKpiEmployeeCount: 0,
      confirmedPersonalKpiEmployeeCount: confirmedEmployeeCountByDivisionId.get(division.id) ?? 0,
      missingAnyPersonalKpiEmployeeCount: activeEmployeeCountByDivisionId.get(division.id) ?? 0,
      currentSalesGroup,
    } satisfies Evaluation2026ReadinessPopulationDivisionCoverage
  })
  const mappedDivisions = divisions.filter((division) => division.currentSalesGroup).length
  const unmappedDivisions = divisions.length - mappedDivisions
  const mappedActiveEmployeeCount = divisions
    .filter((division) => division.currentSalesGroup)
    .reduce((sum, division) => sum + division.activeEmployeeCount, 0)
  const unmappedActiveEmployeeCount = divisions
    .filter((division) => !division.currentSalesGroup)
    .reduce((sum, division) => sum + division.activeEmployeeCount, 0)

  const overrides = Object.entries(mappings.salesGroupsByDepartmentId)
    .map(([departmentId, mapping]) => {
      const department = departmentsById.get(departmentId)
      return {
        departmentId,
        departmentName: department?.deptName ?? departmentId,
        departmentPath: formatDepartmentPath({ departmentId, departmentsById }),
        currentSalesGroup: mapping.salesGroup,
        affectedActiveEmployeeCount: affectedEmployeeCountByDepartmentId.get(departmentId) ?? 0,
      } satisfies Evaluation2026ReadinessPopulationDepartmentOverrideCoverage
    })
    .sort((left, right) => left.departmentPath.localeCompare(right.departmentPath, 'ko'))
  const mboSetupCoverage = buildMboSetupCoverage2026({
    activeEmployees: activeEmployees as ActiveEmployee2026[],
    personalKpis: typedPersonalKpis,
    departmentsById,
    operationalStatusByKpiId,
  })
  const teamKpiHrReviewCoverage = buildTeamKpiHrReviewCoverage2026({
    orgKpis: teamOrgKpis as TeamOrgKpiForHrReview2026[],
    activeEmployees: activeEmployees as ActiveEmployee2026[],
    personalKpis: typedPersonalKpis,
    departmentsById,
    personalKpiOrgGoalWithoutApprovedSourceCount: mboSetupCoverage.warningCounts.orgGoalWithoutEligibleOrgKpi,
  })
  const policyCategoryMappingReadiness = {
    missingPolicyCategoryCount: typedPersonalKpis.filter((kpi) => !kpi.policyCategory).length,
    mappedPolicyCategoryCount: typedPersonalKpis.filter((kpi) => Boolean(kpi.policyCategory)).length,
    manualReviewCount: mboSetupCoverage.monitoring.policyCategoryMissingItems.length,
    orgGoalWithoutApprovedSourceCount: mboSetupCoverage.warningCounts.orgGoalWithoutEligibleOrgKpi,
    dailyWorkDuplicateRiskCount: mboSetupCoverage.warningCounts.dailyWorkDuplicateRisk,
    projectTkMissingTargetOrPlanCount: typedPersonalKpis.filter((kpi) =>
      (kpi.policyCategory === 'PROJECT_T' || kpi.policyCategory === 'PROJECT_K') &&
      (!hasMeaningfulText(kpi.definition, 8) || kpi.targetValueT == null)
    ).length,
    bulkMappingSavedCount: countPolicyCategoryMetadataSaves2026(auditLogs),
  }
  const resultWritingReadiness = buildResultWritingReadiness2026({
    activeEmployees: activeEmployees as ActiveEmployee2026[],
    personalKpis: typedPersonalKpis,
    selfEvaluations: selfEvaluations as ExistingSelfEvaluation2026[],
    departmentsById,
    operationalStatusByKpiId,
    limit,
  })
  const gradePolicyReadiness = await getEvaluation2026GradePolicyReadiness({
    db: db as never,
    evalCycleId: cycle.id,
    env: params.env,
  })
  const divisionCoverageById = new Map(
    mboSetupCoverage.divisionCoverage.map((division) => [division.divisionId, division])
  )

  const blockers: Evaluation2026ReadinessPopulationBlocker[] = []
  const warnings: Evaluation2026ReadinessPopulationBlocker[] = []
  const isOfficialReadinessTarget = readPolicy2026OfficialReadinessEnabled(cycle.performanceDesignConfig)

  addBlocker({
    target: blockers,
    code: 'OFFICIAL_READINESS_CYCLE_NOT_CONFIRMED',
    message: '선택한 평가 주기가 공식 2026 readiness 대상으로 지정되어 있지 않습니다.',
    count: isOfficialReadinessTarget ? 0 : 1,
  })
  addBlocker({
    target: blockers,
    code: 'CONFIRMED_PERSONAL_KPI_REQUIRED',
    message: '확정된 2026 Personal KPI가 없는 재직자가 있어 population apply를 안전하게 진행할 수 없습니다.',
    count: employeesMissingConfirmedPersonalKpi.length,
  })
  addBlocker({
    target: blockers,
    code: 'POLICY_CATEGORY_REQUIRED',
    message: '생성되거나 유지될 평가 항목에 2026 policyCategory가 비어 있습니다.',
    count: policyCategoryMissingCount,
  })
  addBlocker({
    target: blockers,
    code: 'DIVISION_SALES_GROUP_REQUIRED',
    message: '전체 조직 master 기준 division SALES/NON_SALES 매핑이 비어 있습니다.',
    count: unmappedDivisions,
  })
  addBlocker({
    target: blockers,
    code: 'NO_CONFIRMED_PERSONAL_KPI',
    message: '현재 주기 연도에 확정된 Personal KPI가 없어 생성할 평가 항목이 없습니다.',
    count: employeesWithConfirmedPersonalKpi.length === 0 ? 1 : 0,
  })
  addBlocker({
    target: blockers,
    code: 'GRADE_POLICY_REQUIRED',
    message: '2026 등급 기준 저장 정책이 없어 official grade readiness를 진행할 수 없습니다.',
    count: gradePolicyReadiness.gradePolicyExists ? 0 : 1,
  })
  addBlocker({
    target: blockers,
    code: 'GRADE_POLICY_DB_COMPATIBILITY_REQUIRED',
    message: '2026 등급 기준 정책을 불러오지 못했습니다. DB compatibility 확인이 필요합니다.',
    count: gradePolicyReadiness.persistence.compatibilityIssue ? 1 : 0,
  })
  addBlocker({
    target: blockers,
    code: 'GRADE_POLICY_GROUPS_INCOMPLETE',
    message: '2026 등급 기준 그룹 또는 등급 행이 누락되어 있습니다.',
    count: gradePolicyReadiness.missingRowsCount,
  })
  addBlocker({
    target: blockers,
    code: 'GRADE_POLICY_DIFFERS_FROM_PPT',
    message: '저장된 2026 등급 기준이 PPT 기준과 달라 HR 확인이 필요합니다.',
    count: gradePolicyReadiness.differsFromPptCount,
  })
  addBlocker({
    target: blockers,
    code: 'GRADE_POLICY_THRESHOLD_OVERLAP',
    message: '저장된 2026 등급 기준에 중첩 구간이 있습니다.',
    count: gradePolicyReadiness.overlapCount,
  })
  addBlocker({
    target: blockers,
    code: 'GRADE_POLICY_THRESHOLD_GAP',
    message: '저장된 2026 등급 기준에 공백 구간이 있습니다.',
    count: gradePolicyReadiness.gapCount,
  })
  addBlocker({
    target: blockers,
    code: 'TEAM_MEMBER_SALES_GRADE_POLICY_CONFIRMATION_REQUIRED',
    message: 'TEAM_MEMBER_SALES Super/Outstanding 등급 기준에 HR 확인이 필요합니다.',
    count: gradePolicyReadiness.teamMemberSalesAmbiguity.requiresDecision ? 1 : 0,
  })
  addBlocker({
    target: warnings,
    code: 'RESULT_WRITING_READINESS_WARNINGS',
    message: '2026 수행결과 작성 readiness warning이 남아 있습니다. 공식 점수/등급은 변경하지 않고 작성 품질만 점검합니다.',
    count: resultWritingReadiness.summary.warningItemCount,
  })

  if (selfEvaluationByTargetId.size > 0 && selfEvaluationByTargetId.size < Math.max(3, activeEmployees.length * 0.1)) {
    addBlocker({
      target: warnings,
      code: 'CURRENT_CYCLE_SCOPE_LOOKS_PARTIAL',
      message: '현재 주기의 SELF 평가가 일부 대상자에만 존재합니다. 테스트/샘플 주기인지 HR 확인이 필요합니다.',
      count: selfEvaluationByTargetId.size,
    })
  }

  const possibleSampleTargets = (activeEmployees as ActiveEmployee2026[])
    .filter((employee) => selfEvaluationByTargetId.has(employee.id))
    .map((employee) => employee.empName)
    .filter(hasText)
  if (possibleSampleTargets.some((name) => name.includes('석재원'))) {
    addBlocker({
      target: warnings,
      code: 'SAMPLE_DATA_SIGNAL',
      message: '기존 SELF 평가 대상에 석재원 테스트/샘플 데이터 신호가 있습니다. 공식 readiness 판단 전에 주기 범위를 확인해 주세요.',
      count: 1,
    })
  }

  const flags = get2026EvaluationFeatureFlags(params.env)

  return {
    policyVersion: EVALUATION_POLICY_2026.version,
    generatedAt: new Date().toISOString(),
    isDryRun: true,
    selectedEvalCycle: {
      id: cycle.id,
      name: cycle.cycleName,
      year: cycle.evalYear,
      status: cycle.status,
      isOfficialReadinessTarget,
    },
    activeEmployeeCount: activeEmployees.length,
    employeesWithConfirmedPersonalKpiCount: employeesWithConfirmedPersonalKpi.length,
    employeesWithConfirmedPersonalKpi: employeesWithConfirmedPersonalKpi.slice(0, limit),
    employeesMissingConfirmedPersonalKpiCount: employeesMissingConfirmedPersonalKpi.length,
    employeesMissingConfirmedPersonalKpi: employeesMissingConfirmedPersonalKpi.slice(0, limit),
    existingSelfEvaluationCount: selfEvaluationByTargetId.size,
    existingSelfEvaluationsSkipped: existingSelfEvaluationsSkipped.slice(0, limit),
    wouldCreateSelfEvaluationCount: wouldCreateSelfEvaluations.length,
    wouldCreateSelfEvaluations: wouldCreateSelfEvaluations.slice(0, limit),
    wouldCreateEvaluationItemCount,
    existingEvaluationItemsSkippedCount,
    policyCategoryMissingCount,
    mboSetupCoverage: {
      ...mboSetupCoverage,
      divisionCoverage: mboSetupCoverage.divisionCoverage.map((division) => ({
        ...division,
        currentSalesGroup: mappings.salesGroupsByDivisionId[division.divisionId]?.salesGroup ?? null,
      })),
      teamCoverage: mboSetupCoverage.teamCoverage.slice(0, limit),
    },
    divisionSalesMappingCoverage: {
      totalDivisions: divisions.length,
      mappedDivisions,
      unmappedDivisions,
      mappedActiveEmployeeCount,
      unmappedActiveEmployeeCount,
      divisions: divisions.map((division) => {
        const coverage = divisionCoverageById.get(division.divisionId)
        return {
          ...division,
          draftPersonalKpiEmployeeCount: coverage?.draftPersonalKpiEmployeeCount ?? 0,
          submittedPersonalKpiEmployeeCount: coverage?.submittedPersonalKpiEmployeeCount ?? 0,
          missingAnyPersonalKpiEmployeeCount: coverage?.missingAnyPersonalKpiEmployeeCount ?? division.activeEmployeeCount,
        }
      }),
    },
    departmentOverrideCoverage: {
      savedOverrideCount: overrides.length,
      affectedActiveEmployeeCount: overrides.reduce((sum, override) => sum + override.affectedActiveEmployeeCount, 0),
      overrides,
    },
    gradePolicyReadiness,
    teamKpiHrReviewCoverage,
    policyCategoryMappingReadiness,
    resultWritingReadiness,
    blockers,
    warnings,
    safety: {
      writesPerformed: false,
      evaluationsCreated: 0,
      evaluationItemsCreated: 0,
      assignmentsMutated: 0,
      totalScoreChanged: false,
      gradeIdChanged: false,
      officialScoringEnabled: flags.officialScoringEnabled,
      officialGradeEnabled: flags.officialGradeEnabled,
      officialAiScoreExclusionEnabled: flags.aiScoreExclusionEnabled,
    },
  }
}

export async function getEvaluation2026ReadinessPopulationDryRunForSession(
  params: {
    session: Session
    evalCycleId: string
    limit?: number
  },
  options: {
    db?: Evaluation2026ReadinessPopulationDb
    env?: NodeJS.ProcessEnv
  } = {}
) {
  const sessionUser = params.session.user as { id?: string } | undefined
  if (!sessionUser?.id) {
    throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
  }

  if (!canAccessEvaluationPreview2026(params.session)) {
    throw new AppError(403, 'FORBIDDEN', '2026 readiness population dry-run은 HR 관리자만 사용할 수 있습니다.')
  }

  return getEvaluation2026ReadinessPopulationDryRun({
    db: options.db,
    evalCycleId: params.evalCycleId,
    limit: params.limit,
    env: options.env,
  })
}
