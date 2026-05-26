import type { Session } from 'next-auth'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'
import { EVALUATION_POLICY_2026, type EvaluationPolicyItemCategoryCode } from '@/lib/evaluation-policy-2026'
import {
  classifyEvaluationPolicyItem,
  type EvaluationPolicyClassificationResult,
} from '@/lib/evaluation-policy-2026-classification'
import {
  contributionTypeForPolicyCategory2026,
  inferPolicy2026SalesGroupFromEmployeeText,
  isEvaluationPolicy2026Category,
  readPolicy2026PreviewMappings,
  resolvePolicy2026PreviewSalesGroup,
  writePolicy2026PreviewMappingsToConfig,
  type EvaluationPolicy2026SalesGroup,
  type EvaluationPolicy2026TeamMemberSalesThresholdDecision,
} from '@/lib/evaluation-policy-2026-preview-metadata'
import { AppError } from '@/lib/utils'
import { canAccessEvaluationPreview2026 } from '@/server/evaluation-preview-2026-loader'
import {
  resolvePersonalKpiOperationalStatus,
  type PersonalKpiOperationalStatus,
} from '@/server/personal-kpi-workflow'

type EvaluationPreviewMappingDb = Pick<
  typeof prisma,
  'evaluation' | 'evaluationItem' | 'personalKpi' | 'evalCycle'
> & Partial<Pick<typeof prisma, 'department'>>
  & Partial<Pick<typeof prisma, 'employee' | 'auditLog'>>

type DepartmentNode2026 = {
  id: string
  deptName: string
  parentDeptId: string | null
}

type EmployeeForDivisionMapping2026 = {
  id: string
  empId?: string | null
  empName: string
  deptId: string
  managerId?: string | null
  status?: string | null
}

type MappingPersonalKpiAuditLog2026 = {
  action: string
  timestamp: Date | string
  entityId?: string | null
  oldValue?: unknown
  newValue?: unknown
}

type MappingEvaluationItem2026 = {
  id: string
  evaluationId: string
  policyCategory: EvaluationPolicyItemCategoryCode | null
  scoreContributionType?: 'ORGANIZATION' | 'PERSONAL' | null
  policyFormulaVersion?: string | null
  evaluation?: {
    id: string
    evalCycleId: string
    evalStage: string
    targetId: string
  } | null
}

type MappingPersonalKpi2026 = {
  id: string
  employeeId: string
  evalYear: number
  kpiName: string
  definition?: string | null
  formula?: string | null
  kpiType?: string | null
  tags?: unknown
  status?: string | null
  policyCategory: EvaluationPolicyItemCategoryCode | null
  policyCategoryConfidence?: number | null
  policyCategorySource?: string | null
  policyCategoryReviewedAt?: Date | string | null
  policyCategoryReviewNote?: string | null
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
    parentOrgKpi?: {
      id: string
      kpiName: string
      department?: {
        deptName?: string | null
      } | null
    } | null
    teamKpiReviewItems?: Array<{
      verdict?: string | null
      rationale?: string | null
      linkageComment?: string | null
      recommendationText?: string | null
      createdAt?: Date | string | null
    }>
  } | null
  employee?: {
    id: string
    empId?: string | null
    empName: string
    deptId: string
    managerId?: string | null
    department?: {
      id?: string | null
      deptName?: string | null
      parentDeptId?: string | null
    } | null
  } | null
  evaluationItems?: MappingEvaluationItem2026[]
}

type MappingCycle2026 = {
  id: string
  evalYear: number
  performanceDesignConfig: unknown
}

type AuditWriter = typeof createAuditLog

export const EvaluationPolicy2026MappingQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  cycleId: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(80),
})

const PolicyCategoryMappingSchema = z.enum([
  'ORG_GOAL',
  'PROJECT_T',
  'PROJECT_K',
  'DAILY_WORK',
  'KEEP_UNCLASSIFIED',
])

const ScoreContributionTypeMappingSchema = z.enum(['ORGANIZATION', 'PERSONAL'])
const SalesGroupMappingSchema = z.enum(['SALES', 'NON_SALES', 'UNRESOLVED'])
const ThresholdDecisionSchema = z.enum(['UNRESOLVED', 'SUPER_PRIORITY', 'OUTSTANDING_PRIORITY'])

export const EvaluationPolicy2026MetadataPatchSchema = z.object({
  itemMappings: z
    .array(
      z.object({
        evaluationItemId: z.string().trim().min(1),
        personalKpiId: z.string().trim().min(1).optional(),
        category: PolicyCategoryMappingSchema,
        note: z.string().trim().max(500).optional(),
      })
    )
    .default([]),
  policyCategoryMappings: z
    .array(
      z.object({
        personalKpiId: z.string().trim().min(1),
        evaluationItemId: z.string().trim().min(1).optional(),
        category: PolicyCategoryMappingSchema,
        scoreContributionType: ScoreContributionTypeMappingSchema.optional(),
        note: z.string().trim().max(1000).optional(),
      })
    )
    .default([]),
  salesGroupMappings: z
    .array(
      z.object({
        evalCycleId: z.string().trim().min(1),
        employeeId: z.string().trim().min(1),
        salesGroup: SalesGroupMappingSchema,
        note: z.string().trim().max(500).optional(),
      })
    )
    .default([]),
  divisionSalesGroupMappings: z
    .array(
      z.object({
        evalCycleId: z.string().trim().min(1),
        divisionId: z.string().trim().min(1),
        salesGroup: SalesGroupMappingSchema,
        note: z.string().trim().max(500).optional(),
      })
    )
    .default([]),
  departmentSalesGroupMappings: z
    .array(
      z.object({
        evalCycleId: z.string().trim().min(1),
        departmentId: z.string().trim().min(1),
        salesGroup: SalesGroupMappingSchema,
        note: z.string().trim().max(500).optional(),
      })
    )
    .default([]),
  thresholdDecisions: z
    .array(
      z.object({
        evalCycleId: z.string().trim().min(1),
        decision: ThresholdDecisionSchema,
        note: z.string().trim().max(500).optional(),
      })
    )
    .default([]),
})

export type EvaluationPolicy2026MappingQuery = z.infer<typeof EvaluationPolicy2026MappingQuerySchema>
export type EvaluationPolicy2026MetadataPatchInput = z.infer<typeof EvaluationPolicy2026MetadataPatchSchema>

export type EvaluationPolicy2026MappingCandidate = {
  evaluationItemId: string
  personalKpiId: string
  evaluationId: string
  evalCycleId: string
  evalYear: number
  evalStage: string
  employeeId: string
  employeeName: string
  departmentName: string
  title: string
  currentEvaluationItemCategory: EvaluationPolicyItemCategoryCode | null
  currentPersonalKpiCategory: EvaluationPolicyItemCategoryCode | null
  currentEffectiveCategory: EvaluationPolicyItemCategoryCode | null
  suggestedCategory: EvaluationPolicyClassificationResult['category']
  confidence: number
  manualReviewRequired: boolean
  reason: string
  sourceSignals: string[]
  linkedOrgKpi: {
    id: string
    title: string
    departmentName: string | null
  } | null
}

export type EvaluationPolicy2026SalesGroupCandidate = {
  evalCycleId: string
  evalYear: number
  employeeId: string
  employeeName: string
  departmentName: string
  currentSalesGroup: EvaluationPolicy2026SalesGroup | null
  source: 'manual_mapping' | 'text_inference' | 'missing'
  reason: string
}

export type EvaluationPolicy2026DivisionSalesGroupCandidate = {
  evalCycleId: string
  evalYear: number
  divisionId: string
  divisionName: string
  currentSalesGroup: EvaluationPolicy2026SalesGroup | null
  suggestedSalesGroup: EvaluationPolicy2026SalesGroup | null
  affectedEmployeeCount: number
  activeEmployeeCount: number
  currentCycleTargetCount: number
  sampleEmployees: string[]
  reason: string
}

export type EvaluationPolicy2026DepartmentSalesGroupCandidate = {
  evalCycleId: string
  evalYear: number
  departmentId: string
  departmentName: string
  departmentPath: string
  divisionId: string | null
  divisionName: string | null
  currentSalesGroup: EvaluationPolicy2026SalesGroup | null
  suggestedSalesGroup: EvaluationPolicy2026SalesGroup | null
  affectedEmployeeCount: number
  activeEmployeeCount: number
  currentCycleTargetCount: number
  sampleEmployees: string[]
  reason: string
}

export type EvaluationPolicy2026ThresholdDecisionCandidate = {
  evalCycleId: string
  evalYear: number
  currentDecision: EvaluationPolicy2026TeamMemberSalesThresholdDecision
  requiresDecision: boolean
  affectedSalesMemberCount: number
  note?: string
}

export type EvaluationPolicy2026PolicyCategoryConfidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'MANUAL_REVIEW'
export type EvaluationPolicy2026PolicyCategoryWorkbenchItem = {
  mappingId: string
  itemSource: 'PersonalKpi' | 'EvaluationItem'
  personalKpiId: string
  evaluationItemId: string | null
  evaluationId: string | null
  evalCycleId: string | null
  evalYear: number
  evalStage: string | null
  employeeId: string
  employeeNo: string | null
  employeeName: string
  divisionId: string | null
  divisionName: string
  departmentId: string | null
  departmentName: string
  departmentPath: string
  managerId: string | null
  managerName: string
  mboStatus: PersonalKpiOperationalStatus
  kpiTitle: string
  kpiDescription: string | null
  linkedOrgKpi: {
    id: string
    title: string
    departmentName: string | null
    departmentPath: string | null
    isDivisionKpi: boolean
    isTeamKpi: boolean
    latestTeamReviewVerdict: string | null
    hrApprovedForOrgGoal: boolean
    excludedDailyWork: boolean
    needsDiscussion: boolean
  } | null
  linkedTeamKpi: {
    id: string
    title: string
    reviewStatus: 'APPROVED_FOR_ORG_GOAL' | 'EXCLUDED_DAILY_WORK' | 'NEEDS_DISCUSSION' | 'PENDING_REVIEW'
  } | null
  currentPolicyCategory: EvaluationPolicyItemCategoryCode | null
  currentEvaluationItemCategory: EvaluationPolicyItemCategoryCode | null
  currentPersonalKpiCategory: EvaluationPolicyItemCategoryCode | null
  suggestedPolicyCategory: EvaluationPolicyItemCategoryCode | 'MANUAL_REVIEW'
  suggestionReason: string
  sourceConfidence: EvaluationPolicy2026PolicyCategoryConfidence
  currentScoreContributionType: 'ORGANIZATION' | 'PERSONAL' | null
  suggestedScoreContributionType: 'ORGANIZATION' | 'PERSONAL' | null
  currentPolicyFormulaVersion: string | null
  reviewNote: string | null
  sourceSignals: string[]
  requiresHrApprovedSource: boolean
  hasHrApprovedSource: boolean
}

export type EvaluationPolicy2026MappingCandidates = {
  policyVersion: string
  generatedAt: string
  filters: {
    year?: number
    cycleId?: string
    limit: number
  }
  policyCategoryCandidates: EvaluationPolicy2026MappingCandidate[]
  policyCategoryWorkbenchItems: EvaluationPolicy2026PolicyCategoryWorkbenchItem[]
  divisionSalesGroupCandidates: EvaluationPolicy2026DivisionSalesGroupCandidate[]
  departmentSalesGroupCandidates: EvaluationPolicy2026DepartmentSalesGroupCandidate[]
  salesGroupCandidates: EvaluationPolicy2026SalesGroupCandidate[]
  thresholdDecisions: EvaluationPolicy2026ThresholdDecisionCandidate[]
  divisionMappingSummary: {
    totalDivisions: number
    mappedDivisions: number
    unmappedDivisions: number
    divisionsWithCurrentCycleTargets: number
    divisionsWithoutCurrentCycleTargets: number
    hasPartialCurrentCycleTargets: boolean
    warning: string | null
  }
  persistence: {
    itemPolicyCategory: 'PersonalKpi.policyCategory + EvaluationItem.policyCategory'
    divisionSalesGroup: 'EvalCycle.performanceDesignConfig.policy2026PreviewMappings.salesGroupsByDivisionId'
    departmentSalesGroup: 'EvalCycle.performanceDesignConfig.policy2026PreviewMappings.salesGroupsByDepartmentId'
    salesGroup: 'EvalCycle.performanceDesignConfig.policy2026PreviewMappings.salesGroupsByEmployeeId'
    thresholdDecision: 'EvalCycle.performanceDesignConfig.policy2026PreviewMappings.teamMemberSalesThresholdDecision'
  }
}

export type EvaluationPolicy2026MetadataPatchResult = {
  policyVersion: string
  updatedItemMappings: number
  updatedPolicyCategoryMappings: number
  updatedDivisionSalesGroupMappings: number
  updatedDepartmentSalesGroupMappings: number
  updatedSalesGroupMappings: number
  updatedThresholdDecisions: number
  officialScoresChanged: false
  officialGradesChanged: false
  notes: string[]
}

type MappingSessionUser = NonNullable<Session['user']> & {
  id: string
  role: string
}

function getSessionUser(session: Session): MappingSessionUser | null {
  const user = session.user as Partial<MappingSessionUser> | undefined
  if (!user?.id || !user.role) return null
  return user as MappingSessionUser
}

function assertMappingAccess(session: Session) {
  const user = getSessionUser(session)
  if (!user) {
    throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
  }
  if (!canAccessEvaluationPreview2026(session)) {
    throw new AppError(403, 'FORBIDDEN', '2026 정책 매핑 관리는 HR 관리자만 사용할 수 있습니다.')
  }
  return user
}

function candidateReason(params: {
  currentCategory: EvaluationPolicyItemCategoryCode | null
  classification: EvaluationPolicyClassificationResult
}) {
  if (!params.currentCategory) return 'policyCategory가 비어 있어 2026 preview 계산 전에 HR 확정이 필요합니다.'
  if (params.classification.category === 'UNKNOWN') return '자동 분류 신호가 부족하여 HR 수동 검토가 필요합니다.'
  if (params.classification.manualReviewRequired) return '분류 신호가 충돌하거나 HR 확인 신호가 있어 수동 검토가 필요합니다.'
  return 'HR 검토 후보입니다.'
}

function buildLogsByKpiId2026(logs: MappingPersonalKpiAuditLog2026[]) {
  const byKpiId = new Map<string, MappingPersonalKpiAuditLog2026[]>()
  for (const log of logs) {
    if (!log.entityId) continue
    const current = byKpiId.get(log.entityId) ?? []
    current.push(log)
    byKpiId.set(log.entityId, current)
  }
  return byKpiId
}

function toOperationalStatus2026(kpi: MappingPersonalKpi2026, logsByKpiId: Map<string, MappingPersonalKpiAuditLog2026[]>) {
  return resolvePersonalKpiOperationalStatus({
    status: (kpi.status === 'CONFIRMED' || kpi.status === 'ARCHIVED' ? kpi.status : 'DRAFT') as
      | 'DRAFT'
      | 'CONFIRMED'
      | 'ARCHIVED',
    logs: logsByKpiId.get(kpi.id) ?? [],
  })
}

function shouldListPolicyCandidate(params: {
  currentCategory: EvaluationPolicyItemCategoryCode | null
  classification: EvaluationPolicyClassificationResult
}) {
  return !params.currentCategory || params.classification.category === 'UNKNOWN' || params.classification.manualReviewRequired
}

function isTeamMember(target: { position?: string | null; role?: string | null }) {
  return target.position === 'MEMBER' || target.role === 'ROLE_MEMBER'
}

async function loadDepartmentHierarchyForMapping2026(db: EvaluationPreviewMappingDb): Promise<DepartmentNode2026[]> {
  if (!db.department?.findMany) return []
  return db.department.findMany({
    select: {
      id: true,
      deptName: true,
      parentDeptId: true,
    },
  })
}

async function loadActiveEmployeesForDivisionMapping2026(
  db: EvaluationPreviewMappingDb
): Promise<EmployeeForDivisionMapping2026[]> {
  if (!db.employee?.findMany) return []

  return db.employee.findMany({
    where: {
      status: 'ACTIVE',
    },
    select: {
      id: true,
      empId: true,
      empName: true,
      deptId: true,
      managerId: true,
      status: true,
    },
  })
}

function resolveDivisionDepartment2026(params: {
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

  return current
}

function resolveDepartmentPath2026(params: {
  departmentId?: string | null
  departmentsById: Map<string, DepartmentNode2026>
}) {
  if (!params.departmentId) return []
  let current = params.departmentsById.get(params.departmentId)
  if (!current) return []

  const path: DepartmentNode2026[] = []
  const visited = new Set<string>()
  while (current && !visited.has(current.id)) {
    visited.add(current.id)
    path.push(current)
    current = current.parentDeptId ? params.departmentsById.get(current.parentDeptId) : undefined
  }

  return path.reverse()
}

function resolveDepartmentOverridePath2026(params: {
  departmentId?: string | null
  departmentsById: Map<string, DepartmentNode2026>
}) {
  return resolveDepartmentPath2026(params)
    .filter((department) => department.parentDeptId)
    .reverse()
}

function formatDepartmentPath2026(params: {
  departmentId: string
  departmentsById: Map<string, DepartmentNode2026>
}) {
  const path = resolveDepartmentPath2026({
    departmentId: params.departmentId,
    departmentsById: params.departmentsById,
  })
  return path.length ? path.map((department) => department.deptName).join(' > ') : params.departmentId
}

function formatNullableDepartmentPath2026(params: {
  departmentId?: string | null
  departmentsById: Map<string, DepartmentNode2026>
}) {
  if (!params.departmentId) return '소속 조직 미지정'
  return formatDepartmentPath2026({
    departmentId: params.departmentId,
    departmentsById: params.departmentsById,
  })
}

function isDivisionDepartment2026(params: {
  departmentId?: string | null
  departmentsById: Map<string, DepartmentNode2026>
}) {
  if (!params.departmentId) return false
  const department = params.departmentsById.get(params.departmentId)
  return Boolean(department && !department.parentDeptId)
}

function latestTeamKpiReviewVerdict2026(kpi: MappingPersonalKpi2026['linkedOrgKpi']) {
  return kpi?.teamKpiReviewItems?.[0]?.verdict ?? null
}

function resolveTeamKpiReviewStatusForPolicyCategory2026(
  kpi: MappingPersonalKpi2026['linkedOrgKpi']
): 'APPROVED_FOR_ORG_GOAL' | 'EXCLUDED_DAILY_WORK' | 'NEEDS_DISCUSSION' | 'PENDING_REVIEW' {
  if (kpi?.mboExceptionApproved && kpi.mboExceptionReason?.trim()) return 'APPROVED_FOR_ORG_GOAL'
  const verdict = latestTeamKpiReviewVerdict2026(kpi)
  if (verdict === 'ADEQUATE') return 'APPROVED_FOR_ORG_GOAL'
  if (verdict === 'INSUFFICIENT' || kpi?.status === 'ARCHIVED') return 'EXCLUDED_DAILY_WORK'
  if (verdict === 'CAUTION') return 'NEEDS_DISCUSSION'
  return 'PENDING_REVIEW'
}

function suggestPolicyCategoryForWorkbench2026(params: {
  kpi: MappingPersonalKpi2026
  departmentsById: Map<string, DepartmentNode2026>
  classification: EvaluationPolicyClassificationResult
}) {
  const linkedOrgKpi = params.kpi.linkedOrgKpi ?? null
  const linkedDepartmentId = linkedOrgKpi?.department?.id ?? null
  const linkedIsDivisionKpi = isDivisionDepartment2026({
    departmentId: linkedDepartmentId,
    departmentsById: params.departmentsById,
  })
  const linkedIsTeamKpi = Boolean(linkedOrgKpi && !linkedIsDivisionKpi)
  const teamReviewStatus = linkedIsTeamKpi
    ? resolveTeamKpiReviewStatusForPolicyCategory2026(linkedOrgKpi)
    : null

  if (linkedOrgKpi && linkedIsDivisionKpi) {
    return {
      category: 'ORG_GOAL' as const,
      confidence: 'HIGH' as const,
      reason: '본부 KPI와 연결되어 있어 ORG_GOAL 후보입니다.',
      signals: ['LINKED_DIVISION_KPI'],
      hasHrApprovedSource: true,
      requiresHrApprovedSource: true,
    }
  }

  if (linkedOrgKpi && teamReviewStatus === 'APPROVED_FOR_ORG_GOAL') {
    return {
      category: 'ORG_GOAL' as const,
      confidence: 'HIGH' as const,
      reason: 'HR 승인 또는 예외 승인된 팀 KPI와 연결되어 ORG_GOAL 후보입니다.',
      signals: ['LINKED_HR_APPROVED_TEAM_KPI'],
      hasHrApprovedSource: true,
      requiresHrApprovedSource: true,
    }
  }

  if (linkedOrgKpi && teamReviewStatus === 'EXCLUDED_DAILY_WORK') {
    return {
      category: 'DAILY_WORK' as const,
      confidence: 'HIGH' as const,
      reason: 'HR 검토에서 일상업무 처리된 팀 KPI와 연결되어 DAILY_WORK 후보입니다.',
      signals: ['LINKED_EXCLUDED_TEAM_KPI'],
      hasHrApprovedSource: false,
      requiresHrApprovedSource: true,
    }
  }

  if (linkedOrgKpi && teamReviewStatus === 'NEEDS_DISCUSSION') {
    return {
      category: 'MANUAL_REVIEW' as const,
      confidence: 'MANUAL_REVIEW' as const,
      reason: '연결 팀 KPI가 NEEDS_DISCUSSION 상태라 HR 수동 검토가 필요합니다.',
      signals: ['LINKED_TEAM_KPI_NEEDS_DISCUSSION'],
      hasHrApprovedSource: false,
      requiresHrApprovedSource: true,
    }
  }

  if (linkedOrgKpi && teamReviewStatus === 'PENDING_REVIEW') {
    return {
      category: 'MANUAL_REVIEW' as const,
      confidence: 'MANUAL_REVIEW' as const,
      reason: '연결 팀 KPI가 아직 HR 승인되지 않아 ORG_GOAL 확정 전 수동 검토가 필요합니다.',
      signals: ['LINKED_TEAM_KPI_PENDING_REVIEW'],
      hasHrApprovedSource: false,
      requiresHrApprovedSource: true,
    }
  }

  if (params.classification.category === 'PROJECT_T' || params.classification.category === 'PROJECT_K') {
    return {
      category: params.classification.category,
      confidence: params.classification.confidence >= 0.8 ? 'HIGH' as const : 'MEDIUM' as const,
      reason: params.classification.reasons[0] ?? '프로젝트 T/K 신호가 감지되었습니다.',
      signals: params.classification.signals,
      hasHrApprovedSource: false,
      requiresHrApprovedSource: false,
    }
  }

  if (params.classification.category === 'DAILY_WORK') {
    return {
      category: 'DAILY_WORK' as const,
      confidence: 'MEDIUM' as const,
      reason: params.classification.reasons[0] ?? '반복/운영 업무 신호가 감지되었습니다.',
      signals: params.classification.signals,
      hasHrApprovedSource: false,
      requiresHrApprovedSource: false,
    }
  }

  return {
    category: 'MANUAL_REVIEW' as const,
    confidence: 'MANUAL_REVIEW' as const,
    reason: '조직 KPI 연결, HR 승인 팀 KPI, 프로젝트 T/K, 일상업무 신호가 부족하여 HR 수동 검토가 필요합니다.',
    signals: params.classification.signals.length ? params.classification.signals : ['NO_SOURCE_SIGNAL'],
    hasHrApprovedSource: false,
    requiresHrApprovedSource: false,
  }
}

function keyByCycleAndDivision(evalCycleId: string, divisionId: string) {
  return `${evalCycleId}:${divisionId}`
}

function keyByCycleAndDepartment(evalCycleId: string, departmentId: string) {
  return `${evalCycleId}:${departmentId}`
}

function addTargetSample(
  candidate: EvaluationPolicy2026DivisionSalesGroupCandidate,
  employeeName: string
) {
  if (candidate.sampleEmployees.includes(employeeName) || candidate.sampleEmployees.length >= 5) return
  candidate.sampleEmployees.push(employeeName)
}

function addDepartmentTargetSample(
  candidate: EvaluationPolicy2026DepartmentSalesGroupCandidate,
  employeeName: string
) {
  if (candidate.sampleEmployees.includes(employeeName) || candidate.sampleEmployees.length >= 5) return
  candidate.sampleEmployees.push(employeeName)
}

async function loadPolicyCategoryWorkbenchKpis2026(params: {
  db: EvaluationPreviewMappingDb
  evalYear: number
  activeEmployeeIds: string[]
}) {
  if (!params.activeEmployeeIds.length) return [] as MappingPersonalKpi2026[]

  return params.db.personalKpi.findMany({
    where: {
      evalYear: params.evalYear,
      employeeId: {
        in: params.activeEmployeeIds,
      },
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
          parentOrgKpi: {
            include: {
              department: true,
            },
          },
          teamKpiReviewItems: {
            orderBy: {
              createdAt: 'desc',
            },
            take: 1,
          },
        },
      },
      evaluationItems: {
        include: {
          evaluation: {
            select: {
              id: true,
              evalCycleId: true,
              evalStage: true,
              targetId: true,
            },
          },
        },
      },
    },
    orderBy: [{ employeeId: 'asc' }, { createdAt: 'asc' }],
  }) as Promise<MappingPersonalKpi2026[]>
}

async function loadPolicyCategoryAuditLogs2026(params: {
  db: EvaluationPreviewMappingDb
  personalKpiIds: string[]
}) {
  if (!params.db.auditLog?.findMany || !params.personalKpiIds.length) return [] as MappingPersonalKpiAuditLog2026[]

  return params.db.auditLog.findMany({
    where: {
      entityType: 'PersonalKpi',
      entityId: {
        in: params.personalKpiIds,
      },
    },
    orderBy: {
      timestamp: 'desc',
    },
    take: Math.max(200, params.personalKpiIds.length * 8),
  }) as Promise<MappingPersonalKpiAuditLog2026[]>
}

function buildPolicyCategoryWorkbenchItems2026(params: {
  personalKpis: MappingPersonalKpi2026[]
  employeesById: Map<string, EmployeeForDivisionMapping2026>
  departmentsById: Map<string, DepartmentNode2026>
  logsByKpiId: Map<string, MappingPersonalKpiAuditLog2026[]>
  cycleIds: Set<string>
}) {
  const rows: EvaluationPolicy2026PolicyCategoryWorkbenchItem[] = []

  for (const kpi of params.personalKpis) {
    const employee = params.employeesById.get(kpi.employeeId) ?? kpi.employee ?? null
    const departmentId = employee?.deptId ?? kpi.employee?.deptId ?? null
    const division = resolveDivisionDepartment2026({
      departmentId,
      departmentsById: params.departmentsById,
    })
    const departmentPath = formatNullableDepartmentPath2026({
      departmentId,
      departmentsById: params.departmentsById,
    })
    const managerId = employee?.managerId ?? kpi.employee?.managerId ?? null
    const manager = managerId ? params.employeesById.get(managerId) : null
    const classification = classifyEvaluationPolicyItem({
      kpiName: kpi.kpiName,
      definition: kpi.definition,
      formula: kpi.formula,
      kpiType: kpi.kpiType,
      linkedOrgKpiId: kpi.linkedOrgKpiId,
      linkedOrgKpiCategory: undefined,
      linkedOrgKpiTitle: kpi.linkedOrgKpi?.kpiName,
      tags: kpi.tags,
      reviewVerdicts: kpi.linkedOrgKpi?.teamKpiReviewItems?.map((item) => item.verdict ?? '').filter(Boolean) ?? [],
    })
    const suggestion = suggestPolicyCategoryForWorkbench2026({
      kpi,
      departmentsById: params.departmentsById,
      classification,
    })
    const linkedOrgKpi = kpi.linkedOrgKpi ?? null
    const linkedOrgKpiDepartmentId = linkedOrgKpi?.department?.id ?? null
    const linkedOrgKpiDepartmentPath = linkedOrgKpiDepartmentId
      ? formatNullableDepartmentPath2026({
          departmentId: linkedOrgKpiDepartmentId,
          departmentsById: params.departmentsById,
        })
      : null
    const linkedIsDivisionKpi = isDivisionDepartment2026({
      departmentId: linkedOrgKpiDepartmentId,
      departmentsById: params.departmentsById,
    })
    const linkedIsTeamKpi = Boolean(linkedOrgKpi && !linkedIsDivisionKpi)
    const teamReviewStatus = linkedIsTeamKpi
      ? resolveTeamKpiReviewStatusForPolicyCategory2026(linkedOrgKpi)
      : null
    const operationalStatus = toOperationalStatus2026(kpi, params.logsByKpiId)
    const relevantItems = (kpi.evaluationItems ?? [])
      .filter((item) => !params.cycleIds.size || (item.evaluation?.evalCycleId && params.cycleIds.has(item.evaluation.evalCycleId)))
      .sort((left, right) => (left.evaluation?.evalStage ?? '').localeCompare(right.evaluation?.evalStage ?? ''))
    const itemRows = relevantItems.length ? relevantItems : [null]

    for (const item of itemRows) {
      const currentCategory = item?.policyCategory ?? kpi.policyCategory ?? null
      const currentContribution = item?.scoreContributionType ?? (
        currentCategory ? contributionTypeForPolicyCategory2026(currentCategory) : null
      )
      const suggestedContribution =
        suggestion.category === 'MANUAL_REVIEW'
          ? null
          : contributionTypeForPolicyCategory2026(suggestion.category)
      const needsReview =
        !currentCategory ||
        suggestion.category === 'MANUAL_REVIEW' ||
        suggestion.category !== currentCategory ||
        (currentCategory === 'ORG_GOAL' && !suggestion.hasHrApprovedSource) ||
        (currentCategory === 'DAILY_WORK' && suggestion.hasHrApprovedSource)

      if (!needsReview) continue

      rows.push({
        mappingId: item ? `EvaluationItem:${item.id}` : `PersonalKpi:${kpi.id}`,
        itemSource: item ? 'EvaluationItem' : 'PersonalKpi',
        personalKpiId: kpi.id,
        evaluationItemId: item?.id ?? null,
        evaluationId: item?.evaluation?.id ?? item?.evaluationId ?? null,
        evalCycleId: item?.evaluation?.evalCycleId ?? null,
        evalYear: kpi.evalYear,
        evalStage: item?.evaluation?.evalStage ?? null,
        employeeId: kpi.employeeId,
        employeeNo: employee?.empId ?? kpi.employee?.empId ?? null,
        employeeName: employee?.empName ?? kpi.employee?.empName ?? '대상자 미확인',
        divisionId: division?.id ?? null,
        divisionName: division?.deptName ?? '본부 미지정',
        departmentId,
        departmentName:
          params.departmentsById.get(departmentId ?? '')?.deptName ??
          kpi.employee?.department?.deptName ??
          '소속 조직 미지정',
        departmentPath,
        managerId,
        managerName: manager?.empName ?? '리더 미지정',
        mboStatus: operationalStatus,
        kpiTitle: kpi.kpiName,
        kpiDescription: kpi.definition ?? kpi.formula ?? null,
        linkedOrgKpi: linkedOrgKpi
          ? {
              id: linkedOrgKpi.id,
              title: linkedOrgKpi.kpiName,
              departmentName: linkedOrgKpi.department?.deptName ?? null,
              departmentPath: linkedOrgKpiDepartmentPath,
              isDivisionKpi: linkedIsDivisionKpi,
              isTeamKpi: linkedIsTeamKpi,
              latestTeamReviewVerdict: latestTeamKpiReviewVerdict2026(linkedOrgKpi),
              hrApprovedForOrgGoal: suggestion.hasHrApprovedSource,
              excludedDailyWork: teamReviewStatus === 'EXCLUDED_DAILY_WORK',
              needsDiscussion: teamReviewStatus === 'NEEDS_DISCUSSION',
            }
          : null,
        linkedTeamKpi: linkedOrgKpi && linkedIsTeamKpi && teamReviewStatus
          ? {
              id: linkedOrgKpi.id,
              title: linkedOrgKpi.kpiName,
              reviewStatus: teamReviewStatus,
            }
          : null,
        currentPolicyCategory: currentCategory,
        currentEvaluationItemCategory: item?.policyCategory ?? null,
        currentPersonalKpiCategory: kpi.policyCategory,
        suggestedPolicyCategory: suggestion.category,
        suggestionReason: suggestion.reason,
        sourceConfidence: suggestion.confidence,
        currentScoreContributionType: currentContribution,
        suggestedScoreContributionType: suggestedContribution,
        currentPolicyFormulaVersion: item?.policyFormulaVersion ?? null,
        reviewNote: kpi.policyCategoryReviewNote ?? null,
        sourceSignals: Array.from(new Set([...suggestion.signals, ...classification.signals])),
        requiresHrApprovedSource: suggestion.requiresHrApprovedSource,
        hasHrApprovedSource: suggestion.hasHrApprovedSource,
      })
    }
  }

  return rows.sort((left, right) =>
    left.divisionName.localeCompare(right.divisionName, 'ko') ||
    left.departmentPath.localeCompare(right.departmentPath, 'ko') ||
    left.employeeName.localeCompare(right.employeeName, 'ko') ||
    left.kpiTitle.localeCompare(right.kpiTitle, 'ko')
  )
}

export async function getEvaluationPolicy2026MappingCandidates(params: {
  db?: EvaluationPreviewMappingDb
  year?: number
  cycleId?: string
  limit?: number
}): Promise<EvaluationPolicy2026MappingCandidates> {
  const db = params.db ?? prisma
  const limit = Math.max(1, Math.min(params.limit ?? 80, 200))
  const where = params.cycleId
    ? { evalCycleId: params.cycleId }
    : {
        evalCycle: {
          evalYear: params.year ?? EVALUATION_POLICY_2026.year,
        },
      }

  const evaluations = await db.evaluation.findMany({
    where,
    include: {
      evalCycle: true,
      target: {
        include: {
          department: true,
        },
      },
      items: {
        include: {
          personalKpi: {
            include: {
              linkedOrgKpi: {
                include: {
                  department: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
      },
    },
    orderBy: [{ evalCycleId: 'asc' }, { targetId: 'asc' }, { evalStage: 'asc' }],
    take: limit,
  })
  const departments = await loadDepartmentHierarchyForMapping2026(db)
  const departmentsById = new Map(departments.map((department) => [department.id, department]))
  const rootDivisions = departments
    .filter((department) => !department.parentDeptId)
    .sort((left, right) => left.deptName.localeCompare(right.deptName, 'ko'))
  const nonRootDepartments = departments
    .filter((department) => department.parentDeptId)
    .sort((left, right) =>
      formatDepartmentPath2026({ departmentId: left.id, departmentsById })
        .localeCompare(formatDepartmentPath2026({ departmentId: right.id, departmentsById }), 'ko')
    )
  const activeEmployees = await loadActiveEmployeesForDivisionMapping2026(db)
  const activeEmployeesById = new Map(activeEmployees.map((employee) => [employee.id, employee]))
  const activeEmployeeCountByDivisionId = new Map<string, number>()
  const activeEmployeeCountByDepartmentId = new Map<string, number>()

  for (const employee of activeEmployees) {
    const division = resolveDivisionDepartment2026({
      departmentId: employee.deptId,
      departmentsById,
    })
    if (!division) continue
    activeEmployeeCountByDivisionId.set(
      division.id,
      (activeEmployeeCountByDivisionId.get(division.id) ?? 0) + 1
    )
    for (const department of resolveDepartmentOverridePath2026({
      departmentId: employee.deptId,
      departmentsById,
    })) {
      activeEmployeeCountByDepartmentId.set(
        department.id,
        (activeEmployeeCountByDepartmentId.get(department.id) ?? 0) + 1
      )
    }
  }

  const cyclesById = new Map<string, MappingCycle2026>()
  for (const evaluation of evaluations) {
    cyclesById.set(evaluation.evalCycleId, {
      id: evaluation.evalCycleId,
      evalYear: evaluation.evalCycle.evalYear,
      performanceDesignConfig: evaluation.evalCycle.performanceDesignConfig,
    })
  }

  if (params.cycleId && !cyclesById.has(params.cycleId) && db.evalCycle?.findUnique) {
    const cycle = await db.evalCycle.findUnique({
      where: { id: params.cycleId },
      select: {
        id: true,
        evalYear: true,
        performanceDesignConfig: true,
      },
    })
    if (cycle) {
      cyclesById.set(cycle.id, cycle)
    }
  } else if (!params.cycleId && db.evalCycle?.findMany) {
    const cycles = await db.evalCycle.findMany({
      where: {
        evalYear: params.year ?? EVALUATION_POLICY_2026.year,
      },
      select: {
        id: true,
        evalYear: true,
        performanceDesignConfig: true,
      },
      orderBy: [{ createdAt: 'desc' }],
    })
    for (const cycle of cycles) {
      cyclesById.set(cycle.id, cycle)
    }
  }

  const policyCategoryCandidates: EvaluationPolicy2026MappingCandidate[] = []
  const divisionSalesGroupCandidatesByKey = new Map<string, EvaluationPolicy2026DivisionSalesGroupCandidate>()
  const departmentSalesGroupCandidatesByKey = new Map<string, EvaluationPolicy2026DepartmentSalesGroupCandidate>()
  const salesGroupCandidates: EvaluationPolicy2026SalesGroupCandidate[] = []
  const thresholdDecisionByCycle = new Map<string, EvaluationPolicy2026ThresholdDecisionCandidate>()
  const seenSalesCandidates = new Set<string>()

  for (const cycle of cyclesById.values()) {
    const mappings = readPolicy2026PreviewMappings(cycle.performanceDesignConfig)
    for (const division of rootDivisions) {
      const currentSalesGroup = mappings.salesGroupsByDivisionId[division.id]?.salesGroup ?? null
      const activeEmployeeCount = activeEmployeeCountByDivisionId.get(division.id) ?? 0
      const key = keyByCycleAndDivision(cycle.id, division.id)
      divisionSalesGroupCandidatesByKey.set(key, {
        evalCycleId: cycle.id,
        evalYear: cycle.evalYear,
        divisionId: division.id,
        divisionName: division.deptName,
        currentSalesGroup,
        suggestedSalesGroup: inferPolicy2026SalesGroupFromEmployeeText({
          department: { deptName: division.deptName },
          teamName: null,
          jobTitle: null,
        }),
        affectedEmployeeCount: activeEmployeeCount,
        activeEmployeeCount,
        currentCycleTargetCount: 0,
        sampleEmployees: [],
        reason: currentSalesGroup
          ? 'division 기준 영업/비영업 preview 매핑이 저장되어 있습니다. 공식 점수나 등급에는 반영되지 않습니다.'
          : '전체 조직 master 기준 division 매핑이 필요합니다. 텍스트 추론은 참고 제안으로만 표시됩니다.',
      })
    }
    for (const department of nonRootDepartments) {
      const currentSalesGroup = mappings.salesGroupsByDepartmentId[department.id]?.salesGroup ?? null
      const activeEmployeeCount = activeEmployeeCountByDepartmentId.get(department.id) ?? 0
      if (activeEmployeeCount <= 0 && !currentSalesGroup) continue

      const path = resolveDepartmentPath2026({ departmentId: department.id, departmentsById })
      const division = path.find((entry) => !entry.parentDeptId) ?? null
      const key = keyByCycleAndDepartment(cycle.id, department.id)
      departmentSalesGroupCandidatesByKey.set(key, {
        evalCycleId: cycle.id,
        evalYear: cycle.evalYear,
        departmentId: department.id,
        departmentName: department.deptName,
        departmentPath: path.length ? path.map((entry) => entry.deptName).join(' > ') : department.deptName,
        divisionId: division?.id ?? null,
        divisionName: division?.deptName ?? null,
        currentSalesGroup,
        suggestedSalesGroup: inferPolicy2026SalesGroupFromEmployeeText({
          department: { deptName: department.deptName },
          teamName: department.deptName,
          jobTitle: null,
        }),
        affectedEmployeeCount: activeEmployeeCount,
        activeEmployeeCount,
        currentCycleTargetCount: 0,
        sampleEmployees: [],
        reason: currentSalesGroup
          ? 'department/team override 영업/비영업 preview 매핑이 저장되어 있습니다. 공식 점수나 등급에는 반영되지 않습니다.'
          : '본부 기본값과 다른 팀만 예외로 지정합니다. 텍스트 추론은 참고 제안으로만 표시됩니다.',
      })
    }
  }

  for (const evaluation of evaluations) {
    const mappings = readPolicy2026PreviewMappings(evaluation.evalCycle.performanceDesignConfig)
    const division = resolveDivisionDepartment2026({
      departmentId: evaluation.target.deptId ?? evaluation.target.department?.id,
      departmentsById,
    })
    const departmentOverridePath = resolveDepartmentOverridePath2026({
      departmentId: evaluation.target.deptId ?? evaluation.target.department?.id,
      departmentsById,
    })
    const departmentMappedSalesGroup = departmentOverridePath
      .map((department) => mappings.salesGroupsByDepartmentId[department.id]?.salesGroup)
      .find((salesGroup): salesGroup is EvaluationPolicy2026SalesGroup => salesGroup === 'SALES' || salesGroup === 'NON_SALES')
    const suggestedSalesGroup = inferPolicy2026SalesGroupFromEmployeeText(evaluation.target)
    const currentSalesGroup = resolvePolicy2026PreviewSalesGroup({
      evalCycleConfig: evaluation.evalCycle.performanceDesignConfig,
      employeeId: evaluation.targetId,
      departmentId: evaluation.target.deptId ?? evaluation.target.department?.id,
      departmentAncestorIds: departmentOverridePath.map((department) => department.id),
      divisionId: division?.id ?? null,
      employee: evaluation.target,
    })

    if (division) {
      const key = keyByCycleAndDivision(evaluation.evalCycleId, division.id)
      const existing = divisionSalesGroupCandidatesByKey.get(key)
      if (existing) {
        existing.currentCycleTargetCount += 1
        addTargetSample(existing, evaluation.target.empName)
        existing.suggestedSalesGroup = existing.suggestedSalesGroup ?? suggestedSalesGroup
      } else if (!currentSalesGroup) {
        divisionSalesGroupCandidatesByKey.set(key, {
          evalCycleId: evaluation.evalCycleId,
          evalYear: evaluation.evalCycle.evalYear,
          divisionId: division.id,
          divisionName: division.deptName,
          currentSalesGroup: null,
          suggestedSalesGroup,
          affectedEmployeeCount: 1,
          activeEmployeeCount: 0,
          currentCycleTargetCount: 1,
          sampleEmployees: [evaluation.target.empName],
          reason: 'division 기준 영업/비영업 preview 매핑이 없어 HR 확인이 필요합니다. 텍스트 추론은 참고 제안으로만 표시됩니다.',
        })
      }
    }

    for (const department of departmentOverridePath) {
      const key = keyByCycleAndDepartment(evaluation.evalCycleId, department.id)
      const existing = departmentSalesGroupCandidatesByKey.get(key)
      if (existing) {
        existing.currentCycleTargetCount += 1
        addDepartmentTargetSample(existing, evaluation.target.empName)
        existing.suggestedSalesGroup = existing.suggestedSalesGroup ?? suggestedSalesGroup
      } else {
        const path = resolveDepartmentPath2026({ departmentId: department.id, departmentsById })
        departmentSalesGroupCandidatesByKey.set(key, {
          evalCycleId: evaluation.evalCycleId,
          evalYear: evaluation.evalCycle.evalYear,
          departmentId: department.id,
          departmentName: department.deptName,
          departmentPath: path.length ? path.map((entry) => entry.deptName).join(' > ') : department.deptName,
          divisionId: division?.id ?? null,
          divisionName: division?.deptName ?? null,
          currentSalesGroup: departmentMappedSalesGroup ?? null,
          suggestedSalesGroup,
          affectedEmployeeCount: 0,
          activeEmployeeCount: 0,
          currentCycleTargetCount: 1,
          sampleEmployees: [evaluation.target.empName],
          reason: departmentMappedSalesGroup
            ? 'department/team override 영업/비영업 preview 매핑이 저장되어 있습니다. 공식 점수나 등급에는 반영되지 않습니다.'
            : '본부 기본값과 다른 팀만 예외로 지정합니다. 텍스트 추론은 참고 제안으로만 표시됩니다.',
        })
      }
    }

    if (!currentSalesGroup && !division && !seenSalesCandidates.has(`${evaluation.evalCycleId}:${evaluation.targetId}`)) {
      seenSalesCandidates.add(`${evaluation.evalCycleId}:${evaluation.targetId}`)
      salesGroupCandidates.push({
        evalCycleId: evaluation.evalCycleId,
        evalYear: evaluation.evalCycle.evalYear,
        employeeId: evaluation.targetId,
        employeeName: evaluation.target.empName,
        departmentName: evaluation.target.department.deptName,
        currentSalesGroup: null,
        source: 'missing',
        reason: 'division 기준 매핑 대상을 찾지 못해 직원 override 매핑이 필요합니다. 텍스트 추론은 공식 readiness 기준으로 사용하지 않습니다.',
      })
    }

    const existingThreshold = thresholdDecisionByCycle.get(evaluation.evalCycleId)
    const currentDecision = mappings.teamMemberSalesThresholdDecision?.decision ?? 'UNRESOLVED'
    const isSalesMember = isTeamMember(evaluation.target) && currentSalesGroup === 'SALES'
    thresholdDecisionByCycle.set(evaluation.evalCycleId, {
      evalCycleId: evaluation.evalCycleId,
      evalYear: evaluation.evalCycle.evalYear,
      currentDecision,
      requiresDecision: (existingThreshold?.requiresDecision ?? false) || (isSalesMember && currentDecision === 'UNRESOLVED'),
      affectedSalesMemberCount: (existingThreshold?.affectedSalesMemberCount ?? 0) + (isSalesMember ? 1 : 0),
      note: mappings.teamMemberSalesThresholdDecision?.note,
    })

    for (const item of evaluation.items) {
      const personalKpi = item.personalKpi
      const classification = classifyEvaluationPolicyItem({
        kpiName: personalKpi.kpiName,
        definition: personalKpi.definition,
        formula: personalKpi.formula,
        kpiType: personalKpi.kpiType,
        linkedOrgKpiId: personalKpi.linkedOrgKpiId,
        linkedOrgKpiCategory: undefined,
        linkedOrgKpiTitle: personalKpi.linkedOrgKpi?.kpiName,
        tags: personalKpi.tags,
        reviewVerdicts: [],
      })
      const currentCategory = item.policyCategory ?? personalKpi.policyCategory ?? null
      if (!shouldListPolicyCandidate({ currentCategory, classification })) continue

      policyCategoryCandidates.push({
        evaluationItemId: item.id,
        personalKpiId: personalKpi.id,
        evaluationId: evaluation.id,
        evalCycleId: evaluation.evalCycleId,
        evalYear: evaluation.evalCycle.evalYear,
        evalStage: evaluation.evalStage,
        employeeId: evaluation.targetId,
        employeeName: evaluation.target.empName,
        departmentName: evaluation.target.department.deptName,
        title: personalKpi.kpiName,
        currentEvaluationItemCategory: item.policyCategory,
        currentPersonalKpiCategory: personalKpi.policyCategory,
        currentEffectiveCategory: currentCategory,
        suggestedCategory: classification.category,
        confidence: classification.confidence,
        manualReviewRequired: classification.manualReviewRequired,
        reason: candidateReason({ currentCategory, classification }),
        sourceSignals: classification.signals,
        linkedOrgKpi: personalKpi.linkedOrgKpi
          ? {
              id: personalKpi.linkedOrgKpi.id,
              title: personalKpi.linkedOrgKpi.kpiName,
              departmentName: personalKpi.linkedOrgKpi.department?.deptName ?? null,
            }
          : null,
      })
    }
  }

  const workbenchEvalYear =
    params.cycleId && cyclesById.size
      ? Array.from(cyclesById.values())[0]?.evalYear ?? params.year ?? EVALUATION_POLICY_2026.year
      : params.year ?? EVALUATION_POLICY_2026.year
  const workbenchCycleIds = new Set(Array.from(cyclesById.keys()))
  const policyCategoryWorkbenchKpis = await loadPolicyCategoryWorkbenchKpis2026({
    db,
    evalYear: workbenchEvalYear,
    activeEmployeeIds: Array.from(activeEmployeesById.keys()),
  })
  const policyCategoryAuditLogs = await loadPolicyCategoryAuditLogs2026({
    db,
    personalKpiIds: policyCategoryWorkbenchKpis.map((kpi) => kpi.id),
  })
  const policyCategoryWorkbenchItems = buildPolicyCategoryWorkbenchItems2026({
    personalKpis: policyCategoryWorkbenchKpis,
    employeesById: activeEmployeesById,
    departmentsById,
    logsByKpiId: buildLogsByKpiId2026(policyCategoryAuditLogs),
    cycleIds: workbenchCycleIds,
  }).slice(0, limit)

  return {
    policyVersion: EVALUATION_POLICY_2026.version,
    generatedAt: new Date().toISOString(),
    filters: {
      year: params.cycleId ? undefined : params.year ?? EVALUATION_POLICY_2026.year,
      cycleId: params.cycleId,
      limit,
    },
    policyCategoryCandidates,
    policyCategoryWorkbenchItems,
    divisionSalesGroupCandidates: Array.from(divisionSalesGroupCandidatesByKey.values()),
    departmentSalesGroupCandidates: Array.from(departmentSalesGroupCandidatesByKey.values())
      .sort((left, right) =>
        `${left.evalCycleId}:${left.departmentPath}`.localeCompare(`${right.evalCycleId}:${right.departmentPath}`, 'ko')
      ),
    salesGroupCandidates,
    thresholdDecisions: Array.from(thresholdDecisionByCycle.values()).filter(
      (decision) => decision.affectedSalesMemberCount > 0 || decision.currentDecision !== 'UNRESOLVED'
    ),
    divisionMappingSummary: (() => {
      const candidates = Array.from(divisionSalesGroupCandidatesByKey.values())
      const mappedDivisions = candidates.filter(
        (candidate) => candidate.currentSalesGroup === 'SALES' || candidate.currentSalesGroup === 'NON_SALES'
      ).length
      const divisionsWithCurrentCycleTargets = candidates.filter(
        (candidate) => candidate.currentCycleTargetCount > 0
      ).length
      const hasPartialCurrentCycleTargets =
        candidates.length > 0 &&
        divisionsWithCurrentCycleTargets > 0 &&
        divisionsWithCurrentCycleTargets < candidates.length

      return {
        totalDivisions: candidates.length,
        mappedDivisions,
        unmappedDivisions: candidates.length - mappedDivisions,
        divisionsWithCurrentCycleTargets,
        divisionsWithoutCurrentCycleTargets: candidates.length - divisionsWithCurrentCycleTargets,
        hasPartialCurrentCycleTargets,
        warning: hasPartialCurrentCycleTargets
          ? '현재 공식 readiness 주기의 평가 대상이 일부 본부에만 있습니다. Division 매핑은 전체 조직 기준으로 저장되지만, 평가항목 readiness는 현재 주기 데이터 범위로 계산됩니다.'
          : null,
      }
    })(),
    persistence: {
      itemPolicyCategory: 'PersonalKpi.policyCategory + EvaluationItem.policyCategory',
      divisionSalesGroup: 'EvalCycle.performanceDesignConfig.policy2026PreviewMappings.salesGroupsByDivisionId',
      departmentSalesGroup: 'EvalCycle.performanceDesignConfig.policy2026PreviewMappings.salesGroupsByDepartmentId',
      salesGroup: 'EvalCycle.performanceDesignConfig.policy2026PreviewMappings.salesGroupsByEmployeeId',
      thresholdDecision: 'EvalCycle.performanceDesignConfig.policy2026PreviewMappings.teamMemberSalesThresholdDecision',
    },
  }
}

export async function getEvaluationPolicy2026MappingCandidatesForSession(
  params: {
    session: Session
    year?: number
    cycleId?: string
    limit?: number
  },
  options: {
    db?: EvaluationPreviewMappingDb
  } = {}
) {
  assertMappingAccess(params.session)
  return getEvaluationPolicy2026MappingCandidates({
    db: options.db,
    year: params.year,
    cycleId: params.cycleId,
    limit: params.limit,
  })
}

async function updateCyclePreviewMappings(
  db: EvaluationPreviewMappingDb,
  evalCycleId: string,
  updater: (mappings: ReturnType<typeof readPolicy2026PreviewMappings>) => ReturnType<typeof readPolicy2026PreviewMappings>
) {
  const cycle = await db.evalCycle.findUnique({
    where: { id: evalCycleId },
    select: {
      id: true,
      performanceDesignConfig: true,
    },
  })
  if (!cycle) {
    throw new AppError(404, 'EVAL_CYCLE_NOT_FOUND', '평가 주기를 찾을 수 없습니다.')
  }

  const nextMappings = updater(readPolicy2026PreviewMappings(cycle.performanceDesignConfig))
  return db.evalCycle.update({
    where: { id: evalCycleId },
    data: {
      performanceDesignConfig: writePolicy2026PreviewMappingsToConfig(
        cycle.performanceDesignConfig,
        nextMappings
      ),
    },
  })
}

export async function updateEvaluationPolicy2026MetadataForSession(
  params: {
    session: Session
    input: EvaluationPolicy2026MetadataPatchInput
  },
  options: {
    db?: EvaluationPreviewMappingDb
    audit?: AuditWriter
    now?: Date
  } = {}
): Promise<EvaluationPolicy2026MetadataPatchResult> {
  const actor = assertMappingAccess(params.session)
  const db = options.db ?? prisma
  const audit = options.audit ?? createAuditLog
  const now = options.now ?? new Date()
  const reviewedAt = now.toISOString()

  let updatedPolicyCategoryMappings = 0
  let updatedDivisionSalesGroupMappings = 0
  let updatedDepartmentSalesGroupMappings = 0
  let updatedSalesGroupMappings = 0
  let updatedThresholdDecisions = 0

  async function savePolicyCategoryMapping(mapping: {
    personalKpiId: string
    evaluationItemId?: string
    category: z.infer<typeof PolicyCategoryMappingSchema>
    scoreContributionType?: 'ORGANIZATION' | 'PERSONAL'
    note?: string
  }) {
    const note = mapping.note || 'HR manual policyCategory mapping from 2026 readiness workbench'

    if (mapping.evaluationItemId) {
      const item = await db.evaluationItem.findUnique({
        where: { id: mapping.evaluationItemId },
        include: {
          evaluation: {
            select: {
              id: true,
              evalCycleId: true,
              totalScore: true,
              gradeId: true,
            },
          },
          personalKpi: {
            select: {
              id: true,
              policyCategory: true,
            },
          },
        },
      })
      if (!item) {
        throw new AppError(404, 'EVALUATION_ITEM_NOT_FOUND', '평가 항목을 찾을 수 없습니다.')
      }
      if (mapping.personalKpiId !== item.personalKpiId) {
        throw new AppError(400, 'PERSONAL_KPI_MISMATCH', '평가 항목과 KPI가 일치하지 않습니다.')
      }

      const oldValue = {
        evaluationItemPolicyCategory: item.policyCategory,
        personalKpiPolicyCategory: item.personalKpi.policyCategory,
        totalScore: item.evaluation.totalScore,
        gradeId: item.evaluation.gradeId,
      }

      if (mapping.category === 'KEEP_UNCLASSIFIED') {
        await db.personalKpi.update({
          where: { id: item.personalKpiId },
          data: {
            policyCategory: null,
            policyCategoryConfidence: 1,
            policyCategorySource: '2026_POLICY_HR_KEEP_UNCLASSIFIED',
            policyCategoryReviewedAt: now,
            policyCategoryReviewNote: note,
          },
        })
        await db.evaluationItem.update({
          where: { id: item.id },
          data: {
            policyCategory: null,
            scoreContributionType: null,
            policyFormulaVersion: EVALUATION_POLICY_2026.version,
            policyScoreSnapshot: {
              action: 'KEEP_UNCLASSIFIED',
              policyVersion: EVALUATION_POLICY_2026.version,
              reviewedById: actor.id,
              reviewedAt,
              note,
            },
          },
        })
      } else {
        if (!isEvaluationPolicy2026Category(mapping.category)) {
          throw new AppError(400, 'INVALID_POLICY_CATEGORY', '지원하지 않는 2026 정책 카테고리입니다.')
        }
        const category = mapping.category
        const contributionType = mapping.scoreContributionType ?? contributionTypeForPolicyCategory2026(category)
        await db.personalKpi.update({
          where: { id: item.personalKpiId },
          data: {
            policyCategory: category,
            policyCategoryConfidence: 1,
            policyCategorySource: '2026_POLICY_HR_MANUAL',
            policyCategoryReviewedAt: now,
            policyCategoryReviewNote: note,
          },
        })
        await db.evaluationItem.update({
          where: { id: item.id },
          data: {
            policyCategory: category,
            scoreContributionType: contributionType,
            policyFormulaVersion: EVALUATION_POLICY_2026.version,
            policyScoreSnapshot: {
              action: 'HR_MANUAL_POLICY_CATEGORY',
              category,
              contributionType,
              policyVersion: EVALUATION_POLICY_2026.version,
              reviewedById: actor.id,
              reviewedAt,
              note,
            },
          },
        })
      }

      await audit({
        userId: actor.id,
        action: 'UPDATE_2026_POLICY_PREVIEW_METADATA',
        entityType: 'EvaluationItem',
        entityId: item.id,
        oldValue,
        newValue: {
          category: mapping.category,
          scoreContributionType: mapping.scoreContributionType ?? null,
          policyVersion: EVALUATION_POLICY_2026.version,
          officialScoresChanged: false,
          officialGradesChanged: false,
          evaluationsCreated: 0,
          evaluationItemsCreated: 0,
        },
      })
      updatedPolicyCategoryMappings += 1
      return
    }

    const personalKpi = await db.personalKpi.findUnique({
      where: { id: mapping.personalKpiId },
      select: {
        id: true,
        policyCategory: true,
        policyCategoryConfidence: true,
        policyCategorySource: true,
        policyCategoryReviewNote: true,
      },
    })
    if (!personalKpi) {
      throw new AppError(404, 'PERSONAL_KPI_NOT_FOUND', '개인 KPI를 찾을 수 없습니다.')
    }

    const oldValue = {
      personalKpiPolicyCategory: personalKpi.policyCategory,
      policyCategoryConfidence: personalKpi.policyCategoryConfidence,
      policyCategorySource: personalKpi.policyCategorySource,
      policyCategoryReviewNote: personalKpi.policyCategoryReviewNote,
    }

    if (mapping.category === 'KEEP_UNCLASSIFIED') {
      await db.personalKpi.update({
        where: { id: personalKpi.id },
        data: {
          policyCategory: null,
          policyCategoryConfidence: 1,
          policyCategorySource: '2026_POLICY_HR_KEEP_UNCLASSIFIED',
          policyCategoryReviewedAt: now,
          policyCategoryReviewNote: note,
        },
      })
    } else {
      if (!isEvaluationPolicy2026Category(mapping.category)) {
        throw new AppError(400, 'INVALID_POLICY_CATEGORY', '지원하지 않는 2026 정책 카테고리입니다.')
      }
      await db.personalKpi.update({
        where: { id: personalKpi.id },
        data: {
          policyCategory: mapping.category,
          policyCategoryConfidence: 1,
          policyCategorySource: '2026_POLICY_HR_MANUAL',
          policyCategoryReviewedAt: now,
          policyCategoryReviewNote: note,
        },
      })
    }

    await audit({
      userId: actor.id,
      action: 'UPDATE_2026_POLICY_PREVIEW_METADATA',
      entityType: 'PersonalKpi',
      entityId: personalKpi.id,
      oldValue,
      newValue: {
        category: mapping.category,
        scoreContributionType: mapping.scoreContributionType ?? null,
        policyVersion: EVALUATION_POLICY_2026.version,
        officialScoresChanged: false,
        officialGradesChanged: false,
        evaluationsCreated: 0,
        evaluationItemsCreated: 0,
      },
    })
    updatedPolicyCategoryMappings += 1
  }

  const legacyPolicyCategoryMappings = params.input.itemMappings.map((mapping) => ({
    personalKpiId: mapping.personalKpiId ?? '',
    evaluationItemId: mapping.evaluationItemId,
    category: mapping.category,
    note: mapping.note,
  }))
  for (const mapping of [...legacyPolicyCategoryMappings, ...params.input.policyCategoryMappings]) {
    if (!mapping.personalKpiId && mapping.evaluationItemId) {
      const item = await db.evaluationItem.findUnique({
        where: { id: mapping.evaluationItemId },
        select: {
          personalKpiId: true,
        },
      })
      if (!item) {
        throw new AppError(404, 'EVALUATION_ITEM_NOT_FOUND', '평가 항목을 찾을 수 없습니다.')
      }
      await savePolicyCategoryMapping({
        ...mapping,
        personalKpiId: item.personalKpiId,
      })
    } else {
      await savePolicyCategoryMapping(mapping)
    }
  }

  for (const mapping of params.input.divisionSalesGroupMappings) {
    if (db.department?.findUnique) {
      const department = await db.department.findUnique({
        where: { id: mapping.divisionId },
        select: {
          id: true,
        },
      })
      if (!department) {
        throw new AppError(404, 'DIVISION_MAPPING_TARGET_NOT_FOUND', 'division 매핑 대상 부서를 찾을 수 없습니다.')
      }
    }

    await updateCyclePreviewMappings(db, mapping.evalCycleId, (current) => {
      const next = {
        ...current,
        salesGroupsByDivisionId: {
          ...current.salesGroupsByDivisionId,
        },
      }
      if (mapping.salesGroup === 'UNRESOLVED') {
        delete next.salesGroupsByDivisionId[mapping.divisionId]
      } else {
        next.salesGroupsByDivisionId[mapping.divisionId] = {
          salesGroup: mapping.salesGroup,
          note: mapping.note,
          updatedAt: reviewedAt,
          updatedById: actor.id,
        }
      }
      return next
    })

    updatedDivisionSalesGroupMappings += 1
    await audit({
      userId: actor.id,
      action: 'UPDATE_2026_POLICY_PREVIEW_DIVISION_SALES_GROUP',
      entityType: 'EvalCycle',
      entityId: mapping.evalCycleId,
      newValue: {
        divisionId: mapping.divisionId,
        salesGroup: mapping.salesGroup,
        policyVersion: EVALUATION_POLICY_2026.version,
      },
    })
  }

  for (const mapping of params.input.departmentSalesGroupMappings) {
    if (db.department?.findUnique) {
      const department = await db.department.findUnique({
        where: { id: mapping.departmentId },
        select: {
          id: true,
        },
      })
      if (!department) {
        throw new AppError(404, 'DEPARTMENT_MAPPING_TARGET_NOT_FOUND', 'department/team override 매핑 대상 부서를 찾을 수 없습니다.')
      }
    }

    await updateCyclePreviewMappings(db, mapping.evalCycleId, (current) => {
      const next = {
        ...current,
        salesGroupsByDepartmentId: {
          ...current.salesGroupsByDepartmentId,
        },
      }
      if (mapping.salesGroup === 'UNRESOLVED') {
        delete next.salesGroupsByDepartmentId[mapping.departmentId]
      } else {
        next.salesGroupsByDepartmentId[mapping.departmentId] = {
          salesGroup: mapping.salesGroup,
          note: mapping.note,
          updatedAt: reviewedAt,
          updatedById: actor.id,
        }
      }
      return next
    })

    updatedDepartmentSalesGroupMappings += 1
    await audit({
      userId: actor.id,
      action: 'UPDATE_2026_POLICY_PREVIEW_DEPARTMENT_SALES_GROUP',
      entityType: 'EvalCycle',
      entityId: mapping.evalCycleId,
      newValue: {
        departmentId: mapping.departmentId,
        salesGroup: mapping.salesGroup,
        policyVersion: EVALUATION_POLICY_2026.version,
      },
    })
  }

  for (const mapping of params.input.salesGroupMappings) {
    const evaluationCount = await db.evaluation.count({
      where: {
        evalCycleId: mapping.evalCycleId,
        targetId: mapping.employeeId,
      },
    })
    if (evaluationCount <= 0) {
      throw new AppError(404, 'SALES_GROUP_MAPPING_TARGET_NOT_FOUND', '해당 평가 주기의 대상자를 찾을 수 없습니다.')
    }

    await updateCyclePreviewMappings(db, mapping.evalCycleId, (current) => {
      const next = {
        ...current,
        salesGroupsByEmployeeId: {
          ...current.salesGroupsByEmployeeId,
        },
      }
      if (mapping.salesGroup === 'UNRESOLVED') {
        delete next.salesGroupsByEmployeeId[mapping.employeeId]
      } else {
        next.salesGroupsByEmployeeId[mapping.employeeId] = {
          salesGroup: mapping.salesGroup,
          note: mapping.note,
          updatedAt: reviewedAt,
          updatedById: actor.id,
        }
      }
      return next
    })

    updatedSalesGroupMappings += 1
    await audit({
      userId: actor.id,
      action: 'UPDATE_2026_POLICY_PREVIEW_SALES_GROUP',
      entityType: 'EvalCycle',
      entityId: mapping.evalCycleId,
      newValue: {
        employeeId: mapping.employeeId,
        salesGroup: mapping.salesGroup,
        policyVersion: EVALUATION_POLICY_2026.version,
      },
    })
  }

  for (const decision of params.input.thresholdDecisions) {
    await updateCyclePreviewMappings(db, decision.evalCycleId, (current) => ({
      ...current,
      teamMemberSalesThresholdDecision: {
        decision: decision.decision,
        note: decision.note,
        updatedAt: reviewedAt,
        updatedById: actor.id,
      },
    }))

    updatedThresholdDecisions += 1
    await audit({
      userId: actor.id,
      action: 'UPDATE_2026_POLICY_PREVIEW_THRESHOLD_DECISION',
      entityType: 'EvalCycle',
      entityId: decision.evalCycleId,
      newValue: {
        decision: decision.decision,
        policyVersion: EVALUATION_POLICY_2026.version,
      },
    })
  }

  return {
    policyVersion: EVALUATION_POLICY_2026.version,
    updatedItemMappings: updatedPolicyCategoryMappings,
    updatedPolicyCategoryMappings,
    updatedDivisionSalesGroupMappings,
    updatedDepartmentSalesGroupMappings,
    updatedSalesGroupMappings,
    updatedThresholdDecisions,
    officialScoresChanged: false,
    officialGradesChanged: false,
    notes: [
      '2026 preview readiness metadata only.',
      'Evaluation.totalScore and Evaluation.gradeId are not updated.',
      'Finalization/calibration behavior remains unchanged.',
    ],
  }
}
