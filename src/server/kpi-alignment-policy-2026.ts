import {
  EVALUATION_POLICY_2026,
  isEvaluationPolicyItemCategory,
  type EvaluationPolicyItemCategoryCode,
} from '../lib/evaluation-policy-2026'

export type KpiAlignmentOrgLevel2026 = 'DIVISION' | 'SECTION' | 'TEAM' | 'UNKNOWN'
export type KpiAlignmentKpiStatus2026 = 'DRAFT' | 'CONFIRMED' | 'ARCHIVED' | string
export type KpiAlignmentTeamReviewVerdict2026 = 'ADEQUATE' | 'CAUTION' | 'INSUFFICIENT' | string

export type KpiAlignmentReflectionStatus2026 =
  | 'DRAFT'
  | 'SUBMITTED_TO_HR'
  | 'HR_REVIEWING'
  | 'REFLECTED'
  | 'EXCLUDED'
  | 'EXCEPTION_APPROVED'

export type KpiAlignmentHrReflectionState2026 =
  | 'DIVISION_KPI'
  | 'NOT_SUBMITTED'
  | 'SUBMITTED'
  | 'HR_REVIEWING'
  | 'REFLECTED'
  | 'EXCLUDED'
  | 'EXCEPTION_REQUIRED'
  | 'EXCEPTION_APPROVED'

export type MboPolicySeverity2026 = 'info' | 'warning' | 'blocker'

export type MboPolicyIssueCode2026 =
  | 'ORG_GOAL_REQUIRES_REFLECTED_KPI'
  | 'TEAM_KPI_NOT_REFLECTED_DEFAULT_DAILY_WORK'
  | 'DAILY_WORK_DUPLICATES_ORG_GOAL'
  | 'HR_EXCEPTION_REQUIRED'
  | 'MISSING_MBO_CATEGORY'
  | 'WEIGHT_POLICY_REVIEW_REQUIRED'
  | 'WEIGHT_CATEGORY_ITEM_CAP_EXCEEDED'
  | 'WEIGHT_CATEGORY_SUM_CAP_EXCEEDED'
  | 'WEIGHT_TOTAL_SUM_INVALID'
  | 'DAILY_WORK_SCORE_CAP_EXCEEDED'
  | 'DAILY_WORK_STAGE_NOT_ALLOWED'

export type MboPolicyIssue2026 = {
  code: MboPolicyIssueCode2026
  severity: MboPolicySeverity2026
  message: string
  targetField?: string
  suggestedAction?: string
}

export type MboPolicyDiagnostic2026 = {
  canSubmit: boolean | null
  severity: MboPolicySeverity2026
  issues: MboPolicyIssue2026[]
}

export type OrgKpiAlignmentInput2026 = {
  id?: string | null
  title?: string | null
  kpiName?: string | null
  definition?: string | null
  formula?: string | null
  level?: KpiAlignmentOrgLevel2026 | null
  department?: {
    id?: string | null
    deptName?: string | null
    level?: KpiAlignmentOrgLevel2026 | null
    scope?: KpiAlignmentOrgLevel2026 | null
    leaderPosition?: string | null
    parentDeptId?: string | null
  } | null
  status?: KpiAlignmentKpiStatus2026 | null
  parentOrgKpiId?: string | null
  latestReviewVerdict?: KpiAlignmentTeamReviewVerdict2026 | null
  reflectionStatus?: KpiAlignmentReflectionStatus2026 | null
  hrExceptionApproved?: boolean | null
  hrExceptionReason?: string | null
  hrExceptionApprovedById?: string | null
  hrExceptionApprovedAt?: Date | string | null
}

export type OrgKpiReflectionEligibility2026 = {
  status: KpiAlignmentReflectionStatus2026
  hrReflectionState: KpiAlignmentHrReflectionState2026
  orgLevel: KpiAlignmentOrgLevel2026
  eligibleAsOrgGoal: boolean
  defaultPersonalMboCategory: EvaluationPolicyItemCategoryCode
  requiresHrException: boolean
  reasons: string[]
  issues: MboPolicyIssue2026[]
}

export type NormalizedOrgKpiHrReflectionStatus2026 = {
  state: KpiAlignmentHrReflectionState2026
  reflectionStatus: KpiAlignmentReflectionStatus2026
  orgLevel: KpiAlignmentOrgLevel2026
  labelKo: string
  personalMboLabelKo: string
  guidanceKo: string
  eligibleAsOrgGoal: boolean
  defaultPersonalMboCategory: EvaluationPolicyItemCategoryCode
  requiresHrException: boolean
  sourceVerdict?: KpiAlignmentTeamReviewVerdict2026 | null
  exceptionReason?: string | null
  exceptionApprovedById?: string | null
  exceptionApprovedAt?: string | null
}

export type OrgKpiPersonalMboClassification2026 = {
  category: EvaluationPolicyItemCategoryCode
  confidence: number
  source: 'DIVISION_KPI' | 'TEAM_KPI_REFLECTED' | 'TEAM_KPI_DEFAULT_DAILY_WORK' | 'HR_EXCEPTION' | 'UNKNOWN'
  eligibility: OrgKpiReflectionEligibility2026
  reasons: string[]
  issues: MboPolicyIssue2026[]
}

export type PersonalMboItemInput2026 = {
  id?: string | null
  title?: string | null
  kpiName?: string | null
  definition?: string | null
  formula?: string | null
  category?: EvaluationPolicyItemCategoryCode | 'UNKNOWN' | null
  policyCategory?: EvaluationPolicyItemCategoryCode | 'UNKNOWN' | null
  weight?: number | null
  linkedOrgKpiId?: string | null
  linkedOrgKpi?: OrgKpiAlignmentInput2026 | null
}

export type MboDuplicateReference2026 = {
  id?: string | null
  title?: string | null
  kpiName?: string | null
  definition?: string | null
  formula?: string | null
  linkedOrgKpiId?: string | null
}

export type DailyWorkDuplicateResult2026 = {
  duplicated: boolean
  matches: Array<{
    id?: string | null
    title: string
    reason: 'SAME_LINKED_ORG_KPI' | 'NORMALIZED_TITLE_MATCH' | 'TEXT_OVERLAP'
  }>
}

const ORG_KPI_REFLECTION_STATUS_PRIORITY: KpiAlignmentReflectionStatus2026[] = [
  'EXCEPTION_APPROVED',
  'REFLECTED',
  'HR_REVIEWING',
  'SUBMITTED_TO_HR',
  'EXCLUDED',
  'DRAFT',
]

function issue(params: {
  code: MboPolicyIssueCode2026
  severity?: MboPolicySeverity2026
  message: string
  targetField?: string
  suggestedAction?: string
}): MboPolicyIssue2026 {
  return {
    severity: params.severity ?? 'warning',
    code: params.code,
    message: params.message,
    targetField: params.targetField,
    suggestedAction: params.suggestedAction,
  }
}

function hasText(value: string | null | undefined) {
  return typeof value === 'string' && value.trim().length > 0
}

function displayTitle(value: { title?: string | null; kpiName?: string | null }) {
  return value.title?.trim() || value.kpiName?.trim() || 'KPI'
}

function serializeDate(value: Date | string | null | undefined) {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  return value
}

function maxSeverity(issues: MboPolicyIssue2026[]): MboPolicySeverity2026 {
  if (issues.some((item) => item.severity === 'blocker')) return 'blocker'
  if (issues.some((item) => item.severity === 'warning')) return 'warning'
  return 'info'
}

function diagnosticFromIssues(issues: MboPolicyIssue2026[]): MboPolicyDiagnostic2026 {
  const severity = maxSeverity(issues)
  return {
    canSubmit: severity === 'blocker' ? false : null,
    severity,
    issues,
  }
}

function normalizeReviewVerdict(value: KpiAlignmentTeamReviewVerdict2026 | null | undefined) {
  return value === 'ADEQUATE' || value === 'CAUTION' || value === 'INSUFFICIENT' ? value : null
}

function normalizeReflectionStatus(value: KpiAlignmentReflectionStatus2026 | null | undefined) {
  return value && ORG_KPI_REFLECTION_STATUS_PRIORITY.includes(value) ? value : null
}

export function resolveOrgKpiLevel2026(input: OrgKpiAlignmentInput2026): KpiAlignmentOrgLevel2026 {
  if (input.level) return input.level
  if (input.department?.level) return input.department.level
  if (input.department?.scope) return input.department.scope
  if (input.department?.leaderPosition === 'DIV_HEAD') return 'DIVISION'
  if (input.department?.leaderPosition === 'SECTION_CHIEF') return 'SECTION'
  if (input.department?.leaderPosition === 'TEAM_LEADER') return 'TEAM'
  if (input.parentOrgKpiId) return 'TEAM'
  return 'UNKNOWN'
}

export function normalizeOrgKpiHrReflectionState2026(
  orgKpi: OrgKpiAlignmentInput2026
): NormalizedOrgKpiHrReflectionStatus2026 {
  const orgLevel = resolveOrgKpiLevel2026(orgKpi)
  const reviewVerdict = normalizeReviewVerdict(orgKpi.latestReviewVerdict)
  const explicitStatus = normalizeReflectionStatus(orgKpi.reflectionStatus)
  const exceptionReason = hasText(orgKpi.hrExceptionReason) ? orgKpi.hrExceptionReason?.trim() ?? null : null
  const exceptionMetadata =
    orgKpi.hrExceptionApproved && exceptionReason
      ? {
          exceptionReason,
          exceptionApprovedById: orgKpi.hrExceptionApprovedById ?? null,
          exceptionApprovedAt: serializeDate(orgKpi.hrExceptionApprovedAt),
        }
      : {}

  const fromState = (
    state: KpiAlignmentHrReflectionState2026,
    sourceVerdict: KpiAlignmentTeamReviewVerdict2026 | null = reviewVerdict
  ): NormalizedOrgKpiHrReflectionStatus2026 => {
    switch (state) {
      case 'DIVISION_KPI':
        return {
          state,
          reflectionStatus: orgKpi.status === 'DRAFT' ? 'DRAFT' : 'REFLECTED',
          orgLevel,
          labelKo: '본부 KPI',
          personalMboLabelKo: '조직목표 후보',
          guidanceKo: '본부 KPI는 개인 MBO 조직목표 우선 반영 후보입니다.',
          eligibleAsOrgGoal: true,
          defaultPersonalMboCategory: 'ORG_GOAL',
          requiresHrException: false,
          sourceVerdict,
        }
      case 'REFLECTED':
        return {
          state,
          reflectionStatus: 'REFLECTED',
          orgLevel,
          labelKo: 'HR 반영',
          personalMboLabelKo: '조직목표 후보',
          guidanceKo: 'HR 검토에서 반영 완료되어 개인 MBO 조직목표 후보로 볼 수 있습니다.',
          eligibleAsOrgGoal: true,
          defaultPersonalMboCategory: 'ORG_GOAL',
          requiresHrException: false,
          sourceVerdict,
        }
      case 'EXCEPTION_APPROVED':
        return {
          state,
          reflectionStatus: 'EXCEPTION_APPROVED',
          orgLevel,
          labelKo: '예외 승인',
          personalMboLabelKo: '조직목표 후보',
          guidanceKo: 'HR 예외 승인 맥락이 있어 개인 MBO 조직목표 후보로 볼 수 있습니다.',
          eligibleAsOrgGoal: true,
          defaultPersonalMboCategory: 'ORG_GOAL',
          requiresHrException: false,
          sourceVerdict,
          ...exceptionMetadata,
        }
      case 'EXCLUDED':
        return {
          state,
          reflectionStatus: 'EXCLUDED',
          orgLevel,
          labelKo: 'HR 제외',
          personalMboLabelKo: '일상업무 기본',
          guidanceKo: 'HR 검토에서 제외된 팀 KPI는 기본적으로 일상업무로 분류합니다.',
          eligibleAsOrgGoal: false,
          defaultPersonalMboCategory: 'DAILY_WORK',
          requiresHrException: true,
          sourceVerdict,
        }
      case 'HR_REVIEWING':
        return {
          state,
          reflectionStatus: 'HR_REVIEWING',
          orgLevel,
          labelKo: '검토 중',
          personalMboLabelKo: '검토 중',
          guidanceKo: 'HR 검토가 진행 중이므로 조직목표 반영 여부를 확인해야 합니다.',
          eligibleAsOrgGoal: false,
          defaultPersonalMboCategory: 'DAILY_WORK',
          requiresHrException: true,
          sourceVerdict,
        }
      case 'SUBMITTED':
        return {
          state,
          reflectionStatus: 'SUBMITTED_TO_HR',
          orgLevel,
          labelKo: 'HR 제출',
          personalMboLabelKo: '검토 필요',
          guidanceKo: 'HR 반영 완료 전까지는 개인 MBO 조직목표로 확정하지 않습니다.',
          eligibleAsOrgGoal: false,
          defaultPersonalMboCategory: 'DAILY_WORK',
          requiresHrException: true,
          sourceVerdict,
        }
      case 'EXCEPTION_REQUIRED':
        return {
          state,
          reflectionStatus: 'SUBMITTED_TO_HR',
          orgLevel,
          labelKo: '예외 승인 필요',
          personalMboLabelKo: '일상업무 기본',
          guidanceKo: 'HR 반영 완료되지 않은 팀 KPI를 조직목표로 쓰려면 HR 예외 승인이 필요합니다.',
          eligibleAsOrgGoal: false,
          defaultPersonalMboCategory: 'DAILY_WORK',
          requiresHrException: true,
          sourceVerdict,
        }
      case 'NOT_SUBMITTED':
      default:
        return {
          state: 'NOT_SUBMITTED',
          reflectionStatus: 'DRAFT',
          orgLevel,
          labelKo: 'HR 미제출',
          personalMboLabelKo: '일상업무 기본',
          guidanceKo: 'HR 검토에 제출되지 않은 팀 KPI는 기본적으로 일상업무로 분류합니다.',
          eligibleAsOrgGoal: false,
          defaultPersonalMboCategory: 'DAILY_WORK',
          requiresHrException: true,
          sourceVerdict,
        }
    }
  }

  if (orgLevel === 'DIVISION') return fromState('DIVISION_KPI')

  if (explicitStatus) {
    if (explicitStatus === 'REFLECTED') return fromState('REFLECTED')
    if (explicitStatus === 'EXCLUDED') return fromState('EXCLUDED')
    if (explicitStatus === 'EXCEPTION_APPROVED') return fromState('EXCEPTION_APPROVED')
    if (explicitStatus === 'HR_REVIEWING') return fromState('HR_REVIEWING')
    if (explicitStatus === 'SUBMITTED_TO_HR') return fromState('SUBMITTED')
    return fromState('NOT_SUBMITTED')
  }

  if (orgKpi.hrExceptionApproved && hasText(orgKpi.hrExceptionReason)) {
    return fromState('EXCEPTION_APPROVED')
  }

  if (reviewVerdict === 'ADEQUATE') return fromState('REFLECTED')
  if (reviewVerdict === 'INSUFFICIENT' || orgKpi.status === 'ARCHIVED') return fromState('EXCLUDED')
  if (reviewVerdict === 'CAUTION') return fromState('HR_REVIEWING')
  if (orgKpi.status === 'DRAFT') return fromState('NOT_SUBMITTED')

  return fromState(orgLevel === 'TEAM' || orgLevel === 'SECTION' ? 'EXCEPTION_REQUIRED' : 'SUBMITTED')
}

export function determineOrgKpiReflectionEligibility2026(
  orgKpi: OrgKpiAlignmentInput2026
): OrgKpiReflectionEligibility2026 {
  const orgLevel = resolveOrgKpiLevel2026(orgKpi)
  const reviewVerdict = normalizeReviewVerdict(orgKpi.latestReviewVerdict)
  const hrReflection = normalizeOrgKpiHrReflectionState2026(orgKpi)
  const reasons: string[] = []
  const issues: MboPolicyIssue2026[] = []

  if (orgKpi.reflectionStatus && ORG_KPI_REFLECTION_STATUS_PRIORITY.includes(orgKpi.reflectionStatus)) {
    const eligible =
      orgKpi.reflectionStatus === 'REFLECTED' || orgKpi.reflectionStatus === 'EXCEPTION_APPROVED'
    return {
      status: orgKpi.reflectionStatus,
      hrReflectionState: hrReflection.state,
      orgLevel,
      eligibleAsOrgGoal: eligible,
      defaultPersonalMboCategory: eligible ? 'ORG_GOAL' : 'DAILY_WORK',
      requiresHrException: !eligible && orgLevel === 'TEAM',
      reasons: [`명시된 2026 반영 상태(${orgKpi.reflectionStatus})를 우선 사용했습니다.`],
      issues: eligible
        ? []
        : [
            issue({
              code: 'TEAM_KPI_NOT_REFLECTED_DEFAULT_DAILY_WORK',
              message: 'HR 반영 완료 또는 예외 승인되지 않은 팀 KPI는 기본적으로 일상업무로 분류합니다.',
              suggestedAction: 'HR 검토/예외 승인 전까지 개인 MBO 조직목표로 사용하지 마세요.',
            }),
          ],
    }
  }

  if (orgLevel === 'DIVISION') {
    reasons.push('본부 KPI는 개인 MBO에서 조직목표 우선 반영 후보입니다.')
    if (orgKpi.status && orgKpi.status !== 'CONFIRMED') {
      issues.push(
        issue({
          code: 'ORG_GOAL_REQUIRES_REFLECTED_KPI',
          severity: 'warning',
          message: '본부 KPI가 아직 확정 상태가 아니므로 최종 반영 전 상태 확인이 필요합니다.',
          suggestedAction: '본부 KPI 확정 상태를 확인해 주세요.',
        })
      )
    }
    return {
      status: orgKpi.status === 'DRAFT' ? 'DRAFT' : 'REFLECTED',
      hrReflectionState: hrReflection.state,
      orgLevel,
      eligibleAsOrgGoal: true,
      defaultPersonalMboCategory: 'ORG_GOAL',
      requiresHrException: false,
      reasons,
      issues,
    }
  }

  if (orgLevel === 'TEAM' || orgLevel === 'SECTION') {
    if (orgKpi.hrExceptionApproved) {
      if (hasText(orgKpi.hrExceptionReason)) {
        reasons.push(`HR 예외 승인 사유가 있어 팀 KPI를 조직목표 후보로 반영할 수 있습니다: ${orgKpi.hrExceptionReason?.trim()}`)
        return {
          status: 'EXCEPTION_APPROVED',
          hrReflectionState: hrReflection.state,
          orgLevel,
          eligibleAsOrgGoal: true,
          defaultPersonalMboCategory: 'ORG_GOAL',
          requiresHrException: false,
          reasons,
          issues,
        }
      }

      issues.push(
        issue({
          code: 'HR_EXCEPTION_REQUIRED',
          severity: 'blocker',
          message: '팀 KPI 예외 반영은 HR 승인 사유가 필요합니다.',
          targetField: 'hrExceptionReason',
          suggestedAction: '예외 반영 사유를 기록하거나 일상업무로 분류하세요.',
        })
      )
    }

    if (reviewVerdict === 'ADEQUATE') {
      reasons.push('HR 검토 결과 ADEQUATE로 확인되어 조직목표 후보로 반영할 수 있습니다.')
      return {
        status: 'REFLECTED',
        hrReflectionState: hrReflection.state,
        orgLevel,
        eligibleAsOrgGoal: true,
        defaultPersonalMboCategory: 'ORG_GOAL',
        requiresHrException: false,
        reasons,
        issues,
      }
    }

    if (reviewVerdict === 'INSUFFICIENT' || orgKpi.status === 'ARCHIVED') {
      issues.push(
        issue({
          code: 'TEAM_KPI_NOT_REFLECTED_DEFAULT_DAILY_WORK',
          message: 'HR 검토에서 반영 제외된 팀 KPI는 조직목표가 아니라 일상업무로 분류하는 것이 원칙입니다.',
          suggestedAction: '개인 MBO에서는 일상업무로 분류하거나 HR 예외 승인을 요청하세요.',
        })
      )
      return {
        status: 'EXCLUDED',
        hrReflectionState: hrReflection.state,
        orgLevel,
        eligibleAsOrgGoal: false,
        defaultPersonalMboCategory: 'DAILY_WORK',
        requiresHrException: true,
        reasons: ['팀 KPI가 HR 반영 완료 상태가 아닙니다.'],
        issues,
      }
    }

    issues.push(
      issue({
        code: 'TEAM_KPI_NOT_REFLECTED_DEFAULT_DAILY_WORK',
        message: '본부 KPI에 포함되지 않았거나 HR 반영 완료되지 않은 팀 KPI는 기본적으로 일상업무입니다.',
        suggestedAction: '조직목표로 반영하려면 HR 검토 또는 예외 승인을 남겨 주세요.',
      })
    )
    if (hrReflection.state === 'EXCEPTION_REQUIRED') {
      issues.push(
        issue({
          code: 'HR_EXCEPTION_REQUIRED',
          message: 'HR 반영 완료되지 않은 팀 KPI를 조직목표로 사용하려면 HR 예외 승인이 필요합니다.',
          suggestedAction: 'HR 예외 승인 여부를 확인하거나 일상업무로 분류하세요.',
        })
      )
    }

    return {
      status: hrReflection.reflectionStatus,
      hrReflectionState: hrReflection.state,
      orgLevel,
      eligibleAsOrgGoal: false,
      defaultPersonalMboCategory: 'DAILY_WORK',
      requiresHrException: true,
      reasons: ['팀 KPI는 HR 반영 완료 또는 예외 승인 전까지 일상업무로 분류합니다.'],
      issues,
    }
  }

  issues.push(
    issue({
      code: 'HR_EXCEPTION_REQUIRED',
      message: '조직 KPI의 본부/팀 계층을 판단할 수 없어 HR 확인이 필요합니다.',
      suggestedAction: '조직 계층 또는 HR 반영 상태를 먼저 확인해 주세요.',
    })
  )
  return {
    status: 'SUBMITTED_TO_HR',
    hrReflectionState: hrReflection.state,
    orgLevel,
    eligibleAsOrgGoal: false,
    defaultPersonalMboCategory: 'DAILY_WORK',
    requiresHrException: true,
    reasons: ['조직 KPI 계층이 불명확합니다.'],
    issues,
  }
}

export function classifyOrgKpiForPersonalMbo2026(
  orgKpi: OrgKpiAlignmentInput2026
): OrgKpiPersonalMboClassification2026 {
  const eligibility = determineOrgKpiReflectionEligibility2026(orgKpi)
  if (eligibility.eligibleAsOrgGoal) {
    const source =
      eligibility.status === 'EXCEPTION_APPROVED'
        ? 'HR_EXCEPTION'
        : eligibility.orgLevel === 'DIVISION'
          ? 'DIVISION_KPI'
          : 'TEAM_KPI_REFLECTED'
    return {
      category: 'ORG_GOAL',
      confidence: source === 'DIVISION_KPI' ? 0.92 : 0.86,
      source,
      eligibility,
      reasons: eligibility.reasons,
      issues: eligibility.issues,
    }
  }

  return {
    category: 'DAILY_WORK',
    confidence: eligibility.orgLevel === 'TEAM' || eligibility.orgLevel === 'SECTION' ? 0.82 : 0.64,
    source: eligibility.orgLevel === 'UNKNOWN' ? 'UNKNOWN' : 'TEAM_KPI_DEFAULT_DAILY_WORK',
    eligibility,
    reasons: eligibility.reasons,
    issues: eligibility.issues,
  }
}

function normalizedText(value: string | null | undefined) {
  return (value ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '')
}

function tokenSet(value: string | null | undefined) {
  return new Set(
    (value ?? '')
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .map((item) => item.trim())
      .filter((item) => item.length >= 2)
  )
}

function textOverlap(left: string | null | undefined, right: string | null | undefined) {
  const leftTokens = tokenSet(left)
  const rightTokens = tokenSet(right)
  if (!leftTokens.size || !rightTokens.size) return 0
  const shared = [...leftTokens].filter((token) => rightTokens.has(token)).length
  return shared / Math.min(leftTokens.size, rightTokens.size)
}

export function detectDailyWorkDuplicateWithOrgGoal2026(params: {
  dailyWork: MboDuplicateReference2026
  orgGoals: MboDuplicateReference2026[]
}): DailyWorkDuplicateResult2026 {
  const matches: DailyWorkDuplicateResult2026['matches'] = []
  const dailyTitle = displayTitle(params.dailyWork)
  const dailyNormalized = normalizedText(dailyTitle)

  for (const orgGoal of params.orgGoals) {
    const orgGoalTitle = displayTitle(orgGoal)
    if (
      params.dailyWork.linkedOrgKpiId &&
      orgGoal.linkedOrgKpiId &&
      params.dailyWork.linkedOrgKpiId === orgGoal.linkedOrgKpiId
    ) {
      matches.push({ id: orgGoal.id, title: orgGoalTitle, reason: 'SAME_LINKED_ORG_KPI' })
      continue
    }

    const goalNormalized = normalizedText(orgGoalTitle)
    if (dailyNormalized && goalNormalized && dailyNormalized === goalNormalized) {
      matches.push({ id: orgGoal.id, title: orgGoalTitle, reason: 'NORMALIZED_TITLE_MATCH' })
      continue
    }

    if (
      dailyNormalized.length >= 6 &&
      goalNormalized.length >= 6 &&
      (dailyNormalized.includes(goalNormalized) || goalNormalized.includes(dailyNormalized))
    ) {
      matches.push({ id: orgGoal.id, title: orgGoalTitle, reason: 'NORMALIZED_TITLE_MATCH' })
      continue
    }

    const overlap = Math.max(
      textOverlap(`${params.dailyWork.title ?? ''} ${params.dailyWork.definition ?? ''}`, `${orgGoal.title ?? ''} ${orgGoal.definition ?? ''}`),
      textOverlap(`${params.dailyWork.kpiName ?? ''} ${params.dailyWork.formula ?? ''}`, `${orgGoal.kpiName ?? ''} ${orgGoal.formula ?? ''}`)
    )
    if (overlap >= 0.67) {
      matches.push({ id: orgGoal.id, title: orgGoalTitle, reason: 'TEXT_OVERLAP' })
    }
  }

  return {
    duplicated: matches.length > 0,
    matches,
  }
}

function resolveMboCategory(item: PersonalMboItemInput2026) {
  return item.policyCategory ?? item.category ?? null
}

export function validatePersonalKpiMboCategory2026(params: {
  item: PersonalMboItemInput2026
  orgGoalItems?: MboDuplicateReference2026[]
}): MboPolicyDiagnostic2026 {
  const category = resolveMboCategory(params.item)
  const issues: MboPolicyIssue2026[] = []

  if (!category || category === 'UNKNOWN' || !isEvaluationPolicyItemCategory(category)) {
    issues.push(
      issue({
        code: 'MISSING_MBO_CATEGORY',
        severity: 'blocker',
        message: '개인 MBO는 조직목표, 프로젝트 T, 프로젝트 K, 일상업무 중 하나로 분류되어야 합니다.',
        targetField: 'policyCategory',
        suggestedAction: 'HR 정책 기준에 따라 MBO 카테고리를 선택해 주세요.',
      })
    )
    return diagnosticFromIssues(issues)
  }

  if (typeof params.item.weight === 'number' && (params.item.weight <= 0 || params.item.weight > 100)) {
    issues.push(
      issue({
        code: 'WEIGHT_POLICY_REVIEW_REQUIRED',
        message: '개인 KPI 가중치는 0% 초과 100% 이하인지 확인이 필요합니다.',
        targetField: 'weight',
        suggestedAction: '가중치 합계와 개별 가중치를 HR 기준에 맞게 검토해 주세요.',
      })
    )
  }

  if (category === 'PROJECT_T' || category === 'PROJECT_K') {
    return diagnosticFromIssues(issues)
  }

  if (category === 'ORG_GOAL') {
    if (!params.item.linkedOrgKpi) {
      issues.push(
        issue({
          code: 'ORG_GOAL_REQUIRES_REFLECTED_KPI',
          severity: 'blocker',
          message: '조직목표 카테고리는 본부 KPI 또는 HR 반영 완료/예외 승인된 팀 KPI 연결이 필요합니다.',
          targetField: 'linkedOrgKpiId',
          suggestedAction: '본부 KPI를 연결하거나 팀 KPI HR 반영 상태를 확인해 주세요.',
        })
      )
      return diagnosticFromIssues(issues)
    }

    const eligibility = determineOrgKpiReflectionEligibility2026(params.item.linkedOrgKpi)
    if (!eligibility.eligibleAsOrgGoal) {
      issues.push(
        issue({
          code: 'ORG_GOAL_REQUIRES_REFLECTED_KPI',
          severity: 'blocker',
          message: '연결된 조직 KPI가 2026 정책상 조직목표 반영 대상이 아닙니다.',
          targetField: 'linkedOrgKpiId',
          suggestedAction: '반영 완료된 본부 KPI를 연결하거나 HR 예외 승인을 남겨 주세요.',
        })
      )
      if (eligibility.requiresHrException) {
        issues.push(
          issue({
            code: 'HR_EXCEPTION_REQUIRED',
            severity: 'blocker',
            message: '팀 KPI를 조직목표로 예외 반영하려면 HR 협의/승인이 필요합니다.',
            targetField: 'linkedOrgKpiId',
            suggestedAction: 'HR 예외 승인과 사유를 기록하세요.',
          })
        )
      }
    }
    return diagnosticFromIssues([...issues, ...eligibility.issues])
  }

  if (category === 'DAILY_WORK') {
    if (params.item.linkedOrgKpi) {
      const classification = classifyOrgKpiForPersonalMbo2026(params.item.linkedOrgKpi)
      if (classification.category === 'ORG_GOAL') {
        issues.push(
          issue({
            code: 'DAILY_WORK_DUPLICATES_ORG_GOAL',
            severity: 'blocker',
            message: '조직목표에 포함되는 본부/반영 완료 팀 KPI 업무는 일상업무로 중복 기재하지 않는 것이 원칙입니다.',
            targetField: 'policyCategory',
            suggestedAction: '조직목표로 분류하거나 일상업무 항목에서 제외하세요.',
          })
        )
      } else {
        issues.push(...classification.issues)
      }
    }

    const duplicate = detectDailyWorkDuplicateWithOrgGoal2026({
      dailyWork: {
        id: params.item.id,
        title: params.item.title,
        kpiName: params.item.kpiName,
        definition: params.item.definition,
        formula: params.item.formula,
        linkedOrgKpiId: params.item.linkedOrgKpiId,
      },
      orgGoals: params.orgGoalItems ?? [],
    })

    if (duplicate.duplicated) {
      issues.push(
        issue({
          code: 'DAILY_WORK_DUPLICATES_ORG_GOAL',
          severity: 'blocker',
          message: `일상업무가 조직목표(${duplicate.matches[0]?.title ?? '조직목표'})와 중복될 수 있습니다.`,
          targetField: 'kpiName',
          suggestedAction: '조직목표에 포함된 업무는 일상업무로 중복 등록하지 마세요.',
        })
      )
    }
  }

  return diagnosticFromIssues(issues)
}

export function summarizeMboPolicyIssues2026(params: {
  items: PersonalMboItemInput2026[]
}): MboPolicyDiagnostic2026 {
  const orgGoalItems = params.items
    .filter((item) => resolveMboCategory(item) === 'ORG_GOAL')
    .map((item) => ({
      id: item.id,
      title: item.title,
      kpiName: item.kpiName,
      definition: item.definition,
      formula: item.formula,
      linkedOrgKpiId: item.linkedOrgKpiId,
    }))

  const issues = params.items.flatMap((item) =>
    validatePersonalKpiMboCategory2026({
      item,
      orgGoalItems: orgGoalItems.filter((orgGoal) => orgGoal.id !== item.id),
    }).issues
  )

  return diagnosticFromIssues(issues)
}

// 2026 가중치 정책 — III-2 비중 상한 검증.
//
// 정책(슬라이드 14):
//   - ORG_GOAL: 항목≤10%, 합계≤50%
//   - PROJECT_T: 항목≤10% (합 cap 없음)
//   - PROJECT_K: 항목≤5%  (합 cap 없음)
//   - DAILY_WORK: 잔여 = 100 - (ORG_GOAL + PROJECT_T + PROJECT_K)
//   - 전체 합 = 100%
//
// Cutover gate(EVALUATION_POLICY_2026.weightRule.enforced):
//   - false (현재, H2 cutover 전): 모든 위반을 severity='warning'으로 surface.
//     라우트는 저장을 차단하지 않음(레거시 카드 호환).
//   - true (2026-07-01 flip 후): severity='blocker'. 라우트가 400으로 차단.
//   - 2026 cycle이 아니면 검증 전체 skip (다른 연도 영향 0).

export type PersonalKpiWeightCapInput2026 = {
  id?: string | null
  policyCategory?: EvaluationPolicyItemCategoryCode | 'UNKNOWN' | null
  category?: EvaluationPolicyItemCategoryCode | 'UNKNOWN' | null
  weight?: number | null
  kpiName?: string | null
  title?: string | null
}

function severityForWeightRule(): MboPolicySeverity2026 {
  return EVALUATION_POLICY_2026.weightRule.enforced ? 'blocker' : 'warning'
}

function resolveWeightCategory(
  item: PersonalKpiWeightCapInput2026
): EvaluationPolicyItemCategoryCode | null {
  const raw = item.policyCategory ?? item.category ?? null
  if (!raw || raw === 'UNKNOWN') return null
  return isEvaluationPolicyItemCategory(raw) ? raw : null
}

export function validatePersonalKpiWeightCapItem2026(params: {
  item: PersonalKpiWeightCapInput2026
  cycleYear: number
}): MboPolicyDiagnostic2026 {
  if (params.cycleYear !== EVALUATION_POLICY_2026.weightRule.cycleYear) {
    return diagnosticFromIssues([])
  }

  const category = resolveWeightCategory(params.item)
  const weight = params.item.weight
  if (!category || typeof weight !== 'number' || !Number.isFinite(weight)) {
    return diagnosticFromIssues([])
  }

  const cap = EVALUATION_POLICY_2026.categories[category].weightCap as
    | { perItem?: number; sumMax?: number; isRemainder?: boolean }
    | undefined
  if (!cap || typeof cap.perItem !== 'number') {
    return diagnosticFromIssues([])
  }
  const perItemCap = cap.perItem

  const issues: MboPolicyIssue2026[] = []
  if (weight > perItemCap) {
    const categoryLabel = EVALUATION_POLICY_2026.categories[category].labelKo
    issues.push(
      issue({
        code: 'WEIGHT_CATEGORY_ITEM_CAP_EXCEEDED',
        severity: severityForWeightRule(),
        message: `${categoryLabel} 항목 가중치는 최대 ${perItemCap}%까지 허용됩니다. (현재 ${weight}%)`,
        targetField: 'weight',
        suggestedAction: `${categoryLabel} 카테고리의 항목별 가중치를 ${perItemCap}% 이하로 조정해 주세요.`,
      })
    )
  }

  return diagnosticFromIssues(issues)
}

export function validatePersonalKpiWeightAggregate2026(params: {
  items: PersonalKpiWeightCapInput2026[]
  cycleYear: number
}): MboPolicyDiagnostic2026 {
  if (params.cycleYear !== EVALUATION_POLICY_2026.weightRule.cycleYear) {
    return diagnosticFromIssues([])
  }

  const issues: MboPolicyIssue2026[] = []
  const totalSumExpected = EVALUATION_POLICY_2026.weightRule.totalSum
  const sumByCategory = new Map<EvaluationPolicyItemCategoryCode, number>()
  let totalSum = 0

  for (const item of params.items) {
    const category = resolveWeightCategory(item)
    const weight = item.weight
    if (typeof weight !== 'number' || !Number.isFinite(weight)) continue
    totalSum += weight
    if (category) {
      sumByCategory.set(category, (sumByCategory.get(category) ?? 0) + weight)
    }
  }

  // 카테고리 합계 cap (현재 ORG_GOAL만 sumMax 50)
  for (const code of ['ORG_GOAL', 'PROJECT_T', 'PROJECT_K', 'DAILY_WORK'] as const) {
    const cap = EVALUATION_POLICY_2026.categories[code].weightCap as
      | { perItem?: number; sumMax?: number; isRemainder?: boolean }
      | undefined
    if (!cap || typeof cap.sumMax !== 'number') continue
    const sumMaxCap = cap.sumMax
    const actual = sumByCategory.get(code) ?? 0
    if (actual > sumMaxCap) {
      const categoryLabel = EVALUATION_POLICY_2026.categories[code].labelKo
      issues.push(
        issue({
          code: 'WEIGHT_CATEGORY_SUM_CAP_EXCEEDED',
          severity: severityForWeightRule(),
          message: `${categoryLabel} 가중치 합계는 ${sumMaxCap}%를 초과할 수 없습니다. (현재 ${Math.round(actual * 100) / 100}%)`,
          targetField: 'weight',
          suggestedAction: `${categoryLabel} 항목들의 가중치 합을 ${sumMaxCap}% 이하로 조정해 주세요.`,
        })
      )
    }
  }

  // 전체 합계 정확히 100%
  const totalSumRounded = Math.round(totalSum * 100) / 100
  if (totalSumRounded !== totalSumExpected) {
    issues.push(
      issue({
        code: 'WEIGHT_TOTAL_SUM_INVALID',
        severity: severityForWeightRule(),
        message: `전체 가중치 합계는 정확히 ${totalSumExpected}%여야 합니다. (현재 ${totalSumRounded}%)`,
        targetField: 'weight',
        suggestedAction: '일상업무 항목 가중치로 잔여 비중을 채워 전체 합을 100%로 맞춰 주세요.',
      })
    )
  }

  return diagnosticFromIssues(issues)
}

// 2026 일상업무(DAILY_WORK) 점수 게이트 — III-5 PPT 슬라이드 14·15.
//
// (a) 점수 상한: dailyWorkScoringRule.maxScore (정책 80)
// (b) 자기평가(SELF) 종료 후 단계 한정: allowedStages (FIRST/SECOND/FINAL)
// (c) 팀장(평가자) 재량 부여
//
// ★ documented decision (role): 정책 문구의 '팀장 재량'을 stage + canEdit 권한으로 환원함 —
// 평가자(canEdit 권한자)면 누구든 작성 가능. SECTION_CHIEF/DIV_HEAD가 review stage에서
// DAILY_WORK 점수를 조정하는 운영 흐름을 보존하기 위해 role-specific 화이트리스트는
// 의도적으로 두지 않음. 운영상 '팀장 외 작성 불가' 강제가 필요해지면 여기 role
// allowlist를 추가해 확장.
//
// 패턴: 가감점(stage allowlist) + 가중치 cap(per-item severity 토글) 하이브리드.
// dailyWorkScoringRule.active=false인 동안 호출되어도 issue severity='warning' →
// diagnostic.canSubmit !== false. 라우트 wiring은 Phase 2 (cutover 전 lead time 두고).
// 그때까지 submit/draft 저장 경로에 81~100 DAILY_WORK 점수가 schema(0-100)로 통과해
// 그대로 저장되는 기존 갭 존재.

export type EvaluationStageForDailyWorkRule2026 =
  | 'SELF'
  | 'FIRST'
  | 'SECOND'
  | 'FINAL'
  | 'CEO_ADJUST'

export type DailyWorkScoringRuleOverride2026 = {
  active: boolean
  maxScore: number
  allowedStages: readonly EvaluationStageForDailyWorkRule2026[]
  cycleYear: number
}

function severityForDailyWorkRule2026(
  rule: { active: boolean }
): MboPolicySeverity2026 {
  return rule.active ? 'blocker' : 'warning'
}

function resolveDailyWorkRule(
  override?: DailyWorkScoringRuleOverride2026
): DailyWorkScoringRuleOverride2026 {
  if (override) return override
  // 정책 상수에서 default 가져오기 (테스트는 override로 active=true 주입).
  const policy = EVALUATION_POLICY_2026.dailyWorkScoringRule
  return {
    active: policy.active,
    maxScore: policy.maxScore,
    allowedStages: policy.allowedStages,
    cycleYear: policy.cycleYear,
  }
}

export function shouldApplyDailyWorkScoringRule2026(params: {
  cycleYear: number
  evalStage: EvaluationStageForDailyWorkRule2026
  rule?: DailyWorkScoringRuleOverride2026
}): boolean {
  const rule = resolveDailyWorkRule(params.rule)
  if (!rule.active) return false
  if (params.cycleYear !== rule.cycleYear) return false
  return rule.allowedStages.includes(params.evalStage)
}

export function validateDailyWorkScore2026(params: {
  category: EvaluationPolicyItemCategoryCode | 'UNKNOWN' | null
  score: number | null
  evalStage: EvaluationStageForDailyWorkRule2026
  cycleYear: number
  rule?: DailyWorkScoringRuleOverride2026
  itemTitle?: string | null
}): MboPolicyDiagnostic2026 {
  const rule = resolveDailyWorkRule(params.rule)

  // cycleYear !== 2026 → 검증 자체 skip (다른 연도 영향 0)
  if (params.cycleYear !== rule.cycleYear) {
    return diagnosticFromIssues([])
  }

  // category !== DAILY_WORK → skip (이 validator는 DAILY_WORK 전용)
  if (params.category !== 'DAILY_WORK') {
    return diagnosticFromIssues([])
  }

  const severity = severityForDailyWorkRule2026(rule)
  const issues: MboPolicyIssue2026[] = []

  // (a) 점수 상한 cap
  if (typeof params.score === 'number' && Number.isFinite(params.score) && params.score > rule.maxScore) {
    issues.push(
      issue({
        code: 'DAILY_WORK_SCORE_CAP_EXCEEDED',
        severity,
        message: `일상업무 점수는 ${rule.maxScore}점을 초과할 수 없습니다. (현재 ${params.score}점)`,
        targetField: 'score',
        suggestedAction: `일상업무 항목 점수를 ${rule.maxScore}점 이하로 조정해 주세요.`,
      })
    )
  }

  // (c) 자기평가 종료 후 단계만 허용 (allowedStages 미포함 → STAGE_NOT_ALLOWED)
  if (!rule.allowedStages.includes(params.evalStage)) {
    issues.push(
      issue({
        code: 'DAILY_WORK_STAGE_NOT_ALLOWED',
        severity,
        message: `일상업무 점수는 자기평가 종료 후 단계(${rule.allowedStages.join('/')})에서만 작성할 수 있습니다. (현재 단계: ${params.evalStage})`,
        targetField: 'evalStage',
        suggestedAction: '자기평가 단계가 완료된 뒤 평가자가 점수를 작성합니다.',
      })
    )
  }

  return diagnosticFromIssues(issues)
}
