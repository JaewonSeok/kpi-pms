import {
  EVALUATION_POLICY_2026,
  type AiCapabilityRecognitionRouteCode,
} from '../lib/evaluation-policy-2026'
import {
  EVALUATION_SCORING_2026_FORMULA_VERSION,
  calculateFinalPerformanceScore2026,
  is2026FormulaVersion,
} from './evaluation-scoring-2026'

export const EVALUATION_AI_POLICY_2026_VERSION = EVALUATION_POLICY_2026.version

export type AiPolicy2026Position =
  | 'MEMBER'
  | 'TEAM_LEADER'
  | 'SECTION_CHIEF'
  | 'DIV_HEAD'
  | 'CEO'
  | string

export type AiPolicy2026Role =
  | 'ROLE_MEMBER'
  | 'ROLE_TEAM_LEADER'
  | 'ROLE_SECTION_CHIEF'
  | 'ROLE_DIV_HEAD'
  | 'ROLE_CEO'
  | 'ROLE_ADMIN'
  | string

export type AiPolicy2026GateStatus =
  | 'NOT_ASSIGNED'
  | 'NOT_STARTED'
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'REVISION_REQUESTED'
  | 'RESUBMITTED'
  | 'PASSED'
  | 'FAILED'
  | 'CLOSED'

export type AiPolicy2026RequirementStatus =
  | 'NOT_REQUIRED'
  | 'EXCLUDED'
  | 'PASS'
  | 'PENDING'
  | 'FAIL'
  | 'INSUFFICIENT_DATA'

export type AiPolicy2026RecognitionStatus =
  | 'PASS'
  | 'PENDING'
  | 'FAIL'
  | 'INSUFFICIENT_DATA'

export type AiPolicy2026IssueCode =
  | 'AI_ANNUAL_SCORE_EXCLUDED'
  | 'AI_LEVEL_UP_NOT_STARTED'
  | 'AI_TARGET_EXCLUDED'
  | 'AI_TARGET_ROLE_UNKNOWN'
  | 'AI_RECOGNITION_ROUTE_UNKNOWN'
  | 'AI_PROJECT_TK_LINK_REQUIRED'
  | 'AI_CONTRIBUTION_DOCUMENTATION_REQUIRED'
  | 'TARGET_ACHIEVEMENT_REQUIRED'
  | 'CONTRIBUTION_ROLE_REQUIRED'
  | 'MEASURABLE_IMPROVEMENT_REQUIRED'
  | 'BEFORE_AFTER_COMPARISON_REQUIRED'
  | 'REAL_WORK_APPLICATION_REQUIRED'
  | 'TEAM_ORG_CONTRIBUTION_REQUIRED'
  | 'SHARING_EVIDENCE_REQUIRED'
  | 'SURVEY_AVERAGE_BELOW_REQUIRED'
  | 'CERTIFICATION_PROOF_REQUIRED'
  | 'CERTIFICATION_VALIDATION_REQUIRED'
  | 'NO_RECOGNITION_ROUTE_PASSED'

export type AiPolicy2026Issue = {
  code: AiPolicy2026IssueCode
  message: string
  route?: AiCapabilityRecognitionRouteCode
}

export type AiPolicy2026RecognitionRouteResult = {
  route: AiCapabilityRecognitionRouteCode
  status: AiPolicy2026RecognitionStatus
  passed: boolean
  issues: AiPolicy2026Issue[]
}

export type AiPolicy2026ApplicabilityResult = {
  evalYear: number
  startsFromYear: number
  targetIncluded: boolean
  required: boolean
  excluded: boolean
  reason: 'APPLICABLE_AND_REQUIRED' | 'APPLICABLE_NOT_STARTED' | 'EXCLUDED_TARGET' | 'UNKNOWN_TARGET'
}

export type AiPolicy2026AnnualScoreInput = {
  organizationPerformanceScore: number
  personalPerformanceScore: number
  aiCompetencyScore?: number | null
  aiGateStatus?: AiPolicy2026GateStatus | null
}

export type AiPolicy2026AnnualScoreResult = {
  annualPerformanceScore: number
  organizationPerformanceScore: number
  personalPerformanceScore: number
  aiIncludedInAnnualScore: false
  aiReference: {
    score?: number
    gateStatus?: AiPolicy2026GateStatus
    annualScoreIncluded: false
    levelUpRequirementStartsFromYear: number
  }
  formulaVersion: typeof EVALUATION_SCORING_2026_FORMULA_VERSION
  issues: AiPolicy2026Issue[]
}

export type AiPolicy2026AnnualScorePreviewResult = {
  used2026AiPolicy: boolean
  annualPerformanceScore: number
  formulaVersion: string
  aiIncludedInAnnualScore: boolean
  result2026?: AiPolicy2026AnnualScoreResult
}

export type AiPolicy2026ProjectTkEvidence = {
  linkedProjectCategory?: 'PROJECT_T' | 'PROJECT_K' | 'ORG_GOAL' | 'DAILY_WORK' | 'UNKNOWN' | null
  aiContributionDocumented?: boolean | null
  achievementAtLeastTarget?: boolean | null
  contributionRoleDocumented?: boolean | null
}

export type AiPolicy2026OrgContributionEvidence = {
  improvement?: {
    time?: boolean | null
    cost?: boolean | null
    productivity?: boolean | null
  } | null
  beforeAfterComparison?: boolean | null
  realWorkApplication?: boolean | null
  teamOrgContribution?: boolean | null
  sharingTrainingReportEvidence?: boolean | null
  surveyAverage?: number | null
}

export type AiPolicy2026CertificationEvidence = {
  certificationProofProvided?: boolean | null
  practicalTaskProofProvided?: boolean | null
  validated?: boolean | null
}

export type AiPolicy2026RecognitionEvidence = {
  route?: AiCapabilityRecognitionRouteCode | 'UNKNOWN' | null
  gateTrack?: 'AI_PROJECT_EXECUTION' | 'AI_USE_CASE_EXPANSION' | string | null
  projectTk?: AiPolicy2026ProjectTkEvidence | null
  orgContribution?: AiPolicy2026OrgContributionEvidence | null
  certification?: AiPolicy2026CertificationEvidence | null
}

export type AiPolicy2026RequirementEvaluation = {
  applicability: AiPolicy2026ApplicabilityResult
  status: AiPolicy2026RequirementStatus
  pass: boolean
  recognitionRoute?: AiCapabilityRecognitionRouteCode
  routeResults: AiPolicy2026RecognitionRouteResult[]
  issues: AiPolicy2026Issue[]
  policyVersion: typeof EVALUATION_AI_POLICY_2026_VERSION
}

function issue(
  code: AiPolicy2026IssueCode,
  message: string,
  route?: AiCapabilityRecognitionRouteCode
): AiPolicy2026Issue {
  return {
    code,
    message,
    route,
  }
}

function hasText(value: string | null | undefined) {
  return typeof value === 'string' && value.trim().length > 0
}

function isPolicyRoute(value: unknown): value is AiCapabilityRecognitionRouteCode {
  return (
    typeof value === 'string' &&
    EVALUATION_POLICY_2026.aiCapability.recognitionRoutes.some((route) => route.code === value)
  )
}

function normalizePositionFromRole(role?: AiPolicy2026Role | null): AiPolicy2026Position | undefined {
  if (role === 'ROLE_MEMBER') return 'MEMBER'
  if (role === 'ROLE_TEAM_LEADER') return 'TEAM_LEADER'
  if (role === 'ROLE_SECTION_CHIEF') return 'SECTION_CHIEF'
  if (role === 'ROLE_DIV_HEAD') return 'DIV_HEAD'
  if (role === 'ROLE_CEO') return 'CEO'
  return undefined
}

function statusFromIssues(issues: AiPolicy2026Issue[], explicitFail = false): AiPolicy2026RecognitionStatus {
  if (!issues.length) return 'PASS'
  if (explicitFail) return 'FAIL'
  return 'INSUFFICIENT_DATA'
}

export function shouldIncludeAiInAnnualScore2026() {
  return EVALUATION_POLICY_2026.aiCapability.annualEvaluationScoreIncluded
}

export function removeAiScoreFromAnnualTotal2026(input: AiPolicy2026AnnualScoreInput): AiPolicy2026AnnualScoreResult {
  const annualPerformanceScore = calculateFinalPerformanceScore2026({
    organizationPerformanceScore: input.organizationPerformanceScore,
    personalPerformanceScore: input.personalPerformanceScore,
  })

  return {
    annualPerformanceScore,
    organizationPerformanceScore: input.organizationPerformanceScore,
    personalPerformanceScore: input.personalPerformanceScore,
    aiIncludedInAnnualScore: false,
    aiReference: {
      score: typeof input.aiCompetencyScore === 'number' ? input.aiCompetencyScore : undefined,
      gateStatus: input.aiGateStatus ?? undefined,
      annualScoreIncluded: false,
      levelUpRequirementStartsFromYear: EVALUATION_POLICY_2026.aiCapability.levelUpRequirementStartsFromYear,
    },
    formulaVersion: EVALUATION_SCORING_2026_FORMULA_VERSION,
    issues: [issue('AI_ANNUAL_SCORE_EXCLUDED', '2026 정책에서는 AI 활용 평가를 연간 업적평가 점수에서 제외합니다.')],
  }
}

export function calculateAnnualScoreWithoutAi2026(input: AiPolicy2026AnnualScoreInput) {
  return removeAiScoreFromAnnualTotal2026(input)
}

export function separateAiCompetencyFromPerformanceResult2026(input: AiPolicy2026AnnualScoreInput) {
  return removeAiScoreFromAnnualTotal2026(input)
}

export function calculateAnnualScoreWithAiPolicyAdapter2026(params: {
  formulaVersion?: string | null
  legacyAnnualScore: number
  legacyAiIncludedInAnnualScore?: boolean
  organizationPerformanceScore: number
  personalPerformanceScore: number
  aiCompetencyScore?: number | null
  aiGateStatus?: AiPolicy2026GateStatus | null
}): AiPolicy2026AnnualScorePreviewResult {
  if (!is2026FormulaVersion(params.formulaVersion)) {
    return {
      used2026AiPolicy: false,
      annualPerformanceScore: params.legacyAnnualScore,
      formulaVersion: params.formulaVersion ?? 'LEGACY',
      aiIncludedInAnnualScore: params.legacyAiIncludedInAnnualScore ?? true,
    }
  }

  const result2026 = removeAiScoreFromAnnualTotal2026({
    organizationPerformanceScore: params.organizationPerformanceScore,
    personalPerformanceScore: params.personalPerformanceScore,
    aiCompetencyScore: params.aiCompetencyScore,
    aiGateStatus: params.aiGateStatus,
  })

  return {
    used2026AiPolicy: true,
    annualPerformanceScore: result2026.annualPerformanceScore,
    formulaVersion: result2026.formulaVersion,
    aiIncludedInAnnualScore: false,
    result2026,
  }
}

export function isAiLevelUpRequirementApplicable2026(params: {
  evalYear: number
  position?: AiPolicy2026Position | null
  role?: AiPolicy2026Role | null
}): AiPolicy2026ApplicabilityResult {
  const startsFromYear = EVALUATION_POLICY_2026.aiCapability.levelUpRequirementStartsFromYear
  const position = params.position ?? normalizePositionFromRole(params.role)
  const targetIncluded = position === 'MEMBER' || position === 'TEAM_LEADER'
  const excluded = position === 'SECTION_CHIEF' || position === 'DIV_HEAD' || position === 'CEO'
  const required = targetIncluded && params.evalYear >= startsFromYear

  if (required) {
    return {
      evalYear: params.evalYear,
      startsFromYear,
      targetIncluded,
      required,
      excluded,
      reason: 'APPLICABLE_AND_REQUIRED',
    }
  }

  if (targetIncluded) {
    return {
      evalYear: params.evalYear,
      startsFromYear,
      targetIncluded,
      required,
      excluded,
      reason: 'APPLICABLE_NOT_STARTED',
    }
  }

  if (excluded) {
    return {
      evalYear: params.evalYear,
      startsFromYear,
      targetIncluded,
      required,
      excluded,
      reason: 'EXCLUDED_TARGET',
    }
  }

  return {
    evalYear: params.evalYear,
    startsFromYear,
    targetIncluded: false,
    required: false,
    excluded: false,
    reason: 'UNKNOWN_TARGET',
  }
}

export function resolveAiRecognitionRoute2026(
  input: Pick<AiPolicy2026RecognitionEvidence, 'route' | 'gateTrack'>
): AiCapabilityRecognitionRouteCode | 'UNKNOWN' {
  if (isPolicyRoute(input.route)) return input.route
  if (input.gateTrack === 'AI_PROJECT_EXECUTION') return 'AI_PROJECT_TK'
  if (input.gateTrack === 'AI_USE_CASE_EXPANSION') return 'ORG_CONTRIBUTION_USE_CASE'
  return 'UNKNOWN'
}

function validateProjectTkEvidence2026(
  evidence: AiPolicy2026ProjectTkEvidence | null | undefined
): AiPolicy2026RecognitionRouteResult {
  const route: AiCapabilityRecognitionRouteCode = 'AI_PROJECT_TK'
  const issues: AiPolicy2026Issue[] = []

  if (evidence?.linkedProjectCategory !== 'PROJECT_T' && evidence?.linkedProjectCategory !== 'PROJECT_K') {
    issues.push(issue('AI_PROJECT_TK_LINK_REQUIRED', 'AI 기반 프로젝트 T 또는 프로젝트 K 연결이 필요합니다.', route))
  }
  if (evidence?.aiContributionDocumented !== true) {
    issues.push(issue('AI_CONTRIBUTION_DOCUMENTATION_REQUIRED', 'AI 기여 내용이 문서화되어야 합니다.', route))
  }
  if (evidence?.achievementAtLeastTarget !== true) {
    issues.push(issue('TARGET_ACHIEVEMENT_REQUIRED', '현재 데이터로 Target 이상 달성이 확인되어야 합니다.', route))
  }
  if (evidence?.contributionRoleDocumented !== true) {
    issues.push(issue('CONTRIBUTION_ROLE_REQUIRED', '본인의 기여 역할이 문서화되어야 합니다.', route))
  }

  const status = statusFromIssues(issues, evidence?.achievementAtLeastTarget === false)
  return {
    route,
    status,
    passed: status === 'PASS',
    issues,
  }
}

function validateOrgContributionEvidence2026(
  evidence: AiPolicy2026OrgContributionEvidence | null | undefined
): AiPolicy2026RecognitionRouteResult {
  const route: AiCapabilityRecognitionRouteCode = 'ORG_CONTRIBUTION_USE_CASE'
  const issues: AiPolicy2026Issue[] = []
  const hasImprovement = Boolean(
    evidence?.improvement?.time || evidence?.improvement?.cost || evidence?.improvement?.productivity
  )

  if (!hasImprovement) {
    issues.push(issue('MEASURABLE_IMPROVEMENT_REQUIRED', '시간/비용/생산성 중 하나 이상의 측정 가능한 개선이 필요합니다.', route))
  }
  if (evidence?.beforeAfterComparison !== true) {
    issues.push(issue('BEFORE_AFTER_COMPARISON_REQUIRED', 'Before/After 비교 근거가 필요합니다.', route))
  }
  if (evidence?.realWorkApplication !== true) {
    issues.push(issue('REAL_WORK_APPLICATION_REQUIRED', '실제 업무 적용 근거가 필요합니다.', route))
  }
  if (evidence?.teamOrgContribution !== true) {
    issues.push(issue('TEAM_ORG_CONTRIBUTION_REQUIRED', '팀/조직 기여 근거가 필요합니다.', route))
  }
  if (evidence?.sharingTrainingReportEvidence !== true) {
    issues.push(issue('SHARING_EVIDENCE_REQUIRED', '공유/교육/보고 증빙이 필요합니다.', route))
  }
  if (typeof evidence?.surveyAverage === 'number' && evidence.surveyAverage < 4.0) {
    issues.push(issue('SURVEY_AVERAGE_BELOW_REQUIRED', '설문 평균이 있는 경우 4.0 이상이어야 합니다.', route))
  }

  const status = statusFromIssues(issues, typeof evidence?.surveyAverage === 'number' && evidence.surveyAverage < 4.0)
  return {
    route,
    status,
    passed: status === 'PASS',
    issues,
  }
}

function validateCertificationEvidence2026(
  evidence: AiPolicy2026CertificationEvidence | null | undefined
): AiPolicy2026RecognitionRouteResult {
  const route: AiCapabilityRecognitionRouteCode = 'AI_PRACTICAL_CERTIFICATION'
  const issues: AiPolicy2026Issue[] = []
  const hasProof = evidence?.certificationProofProvided === true || evidence?.practicalTaskProofProvided === true

  if (!hasProof) {
    issues.push(issue('CERTIFICATION_PROOF_REQUIRED', '인증 또는 실무 과제 증빙이 필요합니다.', route))
  }
  if (evidence?.validated !== true) {
    issues.push(issue('CERTIFICATION_VALIDATION_REQUIRED', '제출 증빙의 검증 완료가 필요합니다.', route))
  }

  const status = statusFromIssues(issues, evidence?.validated === false)
  return {
    route,
    status,
    passed: status === 'PASS',
    issues,
  }
}

export function validateAiRecognitionEvidence2026(
  route: AiCapabilityRecognitionRouteCode | 'UNKNOWN',
  evidence: AiPolicy2026RecognitionEvidence
): AiPolicy2026RecognitionRouteResult {
  if (route === 'AI_PROJECT_TK') return validateProjectTkEvidence2026(evidence.projectTk)
  if (route === 'ORG_CONTRIBUTION_USE_CASE') return validateOrgContributionEvidence2026(evidence.orgContribution)
  if (route === 'AI_PRACTICAL_CERTIFICATION') return validateCertificationEvidence2026(evidence.certification)

  return {
    route: 'ORG_CONTRIBUTION_USE_CASE',
    status: 'INSUFFICIENT_DATA',
    passed: false,
    issues: [issue('AI_RECOGNITION_ROUTE_UNKNOWN', '2026 정책상 인정 경로를 확인할 수 없습니다.')],
  }
}

export function evaluateAiLevelUpRequirement2026(params: {
  evalYear: number
  position?: AiPolicy2026Position | null
  role?: AiPolicy2026Role | null
  gateStatus?: AiPolicy2026GateStatus | null
  evidence?: AiPolicy2026RecognitionEvidence | null
}): AiPolicy2026RequirementEvaluation {
  const applicability = isAiLevelUpRequirementApplicable2026({
    evalYear: params.evalYear,
    position: params.position,
    role: params.role,
  })

  if (applicability.excluded) {
    return {
      applicability,
      status: 'EXCLUDED',
      pass: true,
      routeResults: [],
      issues: [issue('AI_TARGET_EXCLUDED', '2026 AI 레벨업 요건 대상자가 아닙니다.')],
      policyVersion: EVALUATION_AI_POLICY_2026_VERSION,
    }
  }

  if (!applicability.targetIncluded) {
    return {
      applicability,
      status: 'INSUFFICIENT_DATA',
      pass: false,
      routeResults: [],
      issues: [issue('AI_TARGET_ROLE_UNKNOWN', 'AI 레벨업 요건 대상 여부를 판단할 직책 정보가 부족합니다.')],
      policyVersion: EVALUATION_AI_POLICY_2026_VERSION,
    }
  }

  if (!applicability.required) {
    return {
      applicability,
      status: 'NOT_REQUIRED',
      pass: true,
      routeResults: [],
      issues: [issue('AI_LEVEL_UP_NOT_STARTED', 'AI 레벨업 필수 요건은 2028년부터 적용됩니다.')],
      policyVersion: EVALUATION_AI_POLICY_2026_VERSION,
    }
  }

  if (params.gateStatus === 'PASSED') {
    return {
      applicability,
      status: 'PASS',
      pass: true,
      routeResults: [],
      issues: [],
      policyVersion: EVALUATION_AI_POLICY_2026_VERSION,
    }
  }

  if (params.gateStatus === 'FAILED') {
    return {
      applicability,
      status: 'FAIL',
      pass: false,
      routeResults: [],
      issues: [issue('NO_RECOGNITION_ROUTE_PASSED', 'AI 역량평가 gate가 미통과 상태입니다.')],
      policyVersion: EVALUATION_AI_POLICY_2026_VERSION,
    }
  }

  if (!params.evidence) {
    return {
      applicability,
      status: 'PENDING',
      pass: false,
      routeResults: [],
      issues: [issue('NO_RECOGNITION_ROUTE_PASSED', 'AI 인정 경로 증빙이 아직 충분하지 않습니다.')],
      policyVersion: EVALUATION_AI_POLICY_2026_VERSION,
    }
  }

  const evidence = params.evidence
  const route = resolveAiRecognitionRoute2026(evidence)
  const primaryResult = validateAiRecognitionEvidence2026(route, evidence)
  const alternateResults = EVALUATION_POLICY_2026.aiCapability.recognitionRoutes
    .map((item) => item.code)
    .filter((item) => item !== primaryResult.route)
    .map((item) => validateAiRecognitionEvidence2026(item, evidence))
  const routeResults = [primaryResult, ...alternateResults]
  const passed = routeResults.find((item) => item.passed)

  if (passed) {
    return {
      applicability,
      status: 'PASS',
      pass: true,
      recognitionRoute: passed.route,
      routeResults,
      issues: [],
      policyVersion: EVALUATION_AI_POLICY_2026_VERSION,
    }
  }

  const issues = routeResults.flatMap((item) => item.issues)
  const hasFail = routeResults.some((item) => item.status === 'FAIL')

  return {
    applicability,
    status: hasFail ? 'FAIL' : 'INSUFFICIENT_DATA',
    pass: false,
    routeResults,
    issues: issues.length
      ? issues
      : [issue('NO_RECOGNITION_ROUTE_PASSED', '통과한 2026 AI 인정 경로가 없습니다.')],
    policyVersion: EVALUATION_AI_POLICY_2026_VERSION,
  }
}

export function aiPolicyTextEvidenceToBooleans2026(input: {
  aiContribution?: string | null
  contributionRole?: string | null
  beforeAfter?: string | null
  realWorkApplication?: string | null
  teamOrgContribution?: string | null
  sharingEvidence?: string | null
  certificationProof?: string | null
}) {
  return {
    aiContributionDocumented: hasText(input.aiContribution),
    contributionRoleDocumented: hasText(input.contributionRole),
    beforeAfterComparison: hasText(input.beforeAfter),
    realWorkApplication: hasText(input.realWorkApplication),
    teamOrgContribution: hasText(input.teamOrgContribution),
    sharingTrainingReportEvidence: hasText(input.sharingEvidence),
    certificationProofProvided: hasText(input.certificationProof),
  }
}
