import {
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

export type MboPolicySeverity2026 = 'info' | 'warning' | 'blocker'

export type MboPolicyIssueCode2026 =
  | 'ORG_GOAL_REQUIRES_REFLECTED_KPI'
  | 'TEAM_KPI_NOT_REFLECTED_DEFAULT_DAILY_WORK'
  | 'DAILY_WORK_DUPLICATES_ORG_GOAL'
  | 'HR_EXCEPTION_REQUIRED'
  | 'MISSING_MBO_CATEGORY'
  | 'WEIGHT_POLICY_REVIEW_REQUIRED'

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
}

export type OrgKpiReflectionEligibility2026 = {
  status: KpiAlignmentReflectionStatus2026
  orgLevel: KpiAlignmentOrgLevel2026
  eligibleAsOrgGoal: boolean
  defaultPersonalMboCategory: EvaluationPolicyItemCategoryCode
  requiresHrException: boolean
  reasons: string[]
  issues: MboPolicyIssue2026[]
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

export function determineOrgKpiReflectionEligibility2026(
  orgKpi: OrgKpiAlignmentInput2026
): OrgKpiReflectionEligibility2026 {
  const orgLevel = resolveOrgKpiLevel2026(orgKpi)
  const reviewVerdict = normalizeReviewVerdict(orgKpi.latestReviewVerdict)
  const reasons: string[] = []
  const issues: MboPolicyIssue2026[] = []

  if (orgKpi.reflectionStatus && ORG_KPI_REFLECTION_STATUS_PRIORITY.includes(orgKpi.reflectionStatus)) {
    const eligible =
      orgKpi.reflectionStatus === 'REFLECTED' || orgKpi.reflectionStatus === 'EXCEPTION_APPROVED'
    return {
      status: orgKpi.reflectionStatus,
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
        reasons.push('HR 예외 승인 사유가 있어 팀 KPI를 조직목표 후보로 반영할 수 있습니다.')
        return {
          status: 'EXCEPTION_APPROVED',
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

    return {
      status: reviewVerdict === 'CAUTION' ? 'HR_REVIEWING' : orgKpi.status === 'DRAFT' ? 'DRAFT' : 'SUBMITTED_TO_HR',
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
