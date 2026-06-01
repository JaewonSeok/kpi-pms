export const EVALUATION_POLICY_2026_YEAR = 2026
export const EVALUATION_POLICY_2026_VERSION = '2026-PPT-PHASE0'

export const EVALUATION_POLICY_ITEM_CATEGORY_CODES = [
  'ORG_GOAL',
  'PROJECT_T',
  'PROJECT_K',
  'DAILY_WORK',
] as const

export type EvaluationPolicyItemCategoryCode =
  (typeof EVALUATION_POLICY_ITEM_CATEGORY_CODES)[number]

export type EvaluationPolicyGradeCode =
  | 'SUPER'
  | 'OUTSTANDING'
  | 'EXCELLENT'
  | 'GOOD'
  | 'NEED_IMPROVEMENT'
  | 'UNSATISFACTORY'

export type EvaluationPolicyThresholdGroupCode =
  | 'TEAM_MEMBER_NON_SALES'
  | 'TEAM_SECTION_LEADER_NON_SALES'
  | 'TEAM_MEMBER_SALES'
  | 'TEAM_SECTION_LEADER_SALES'
  | 'DIVISION_HEAD'

export type AiCapabilityRecognitionRouteCode =
  | 'AI_PROJECT_TK'
  | 'ORG_CONTRIBUTION_USE_CASE'
  | 'AI_PRACTICAL_CERTIFICATION'

export type ScoreBand = {
  minInclusive?: number
  maxExclusive?: number
  note?: string
  selectionOnly?: boolean
  requiresPolicyConfirmation?: boolean
}

export type GradeThresholdPolicy = {
  group: EvaluationPolicyThresholdGroupCode
  label: string
  salesGroup: 'SALES' | 'NON_SALES' | 'ALL'
  roleGroup: 'TEAM_MEMBER' | 'TEAM_SECTION_LEADER' | 'DIVISION_HEAD'
  thresholds: Partial<Record<EvaluationPolicyGradeCode, ScoreBand>>
  notes?: string[]
}

export const EVALUATION_POLICY_2026 = {
  year: EVALUATION_POLICY_2026_YEAR,
  version: EVALUATION_POLICY_2026_VERSION,
  source: '2026년 인사평가 제도 임직원 설명회',
  categories: {
    ORG_GOAL: {
      code: 'ORG_GOAL',
      labelKo: '조직목표',
      contributionType: 'ORGANIZATION',
      baselineScores: {
        target: 90,
        excellent: 100,
      },
      weightCap: { perItem: 10, sumMax: 50 },
    },
    PROJECT_T: {
      code: 'PROJECT_T',
      labelKo: '프로젝트 T',
      contributionType: 'PERSONAL',
      baselineScores: {
        target: 90,
        excellent: 100,
      },
      weightCap: { perItem: 10 },
    },
    PROJECT_K: {
      code: 'PROJECT_K',
      labelKo: '프로젝트 K',
      contributionType: 'PERSONAL',
      baselineScores: {
        target: 80,
        excellent: 90,
      },
      weightCap: { perItem: 5 },
    },
    DAILY_WORK: {
      code: 'DAILY_WORK',
      labelKo: '일상업무',
      contributionType: 'PERSONAL',
      maxScore: 80,
      // DAILY_WORK는 잔여 비중 = 100 - (ORG_GOAL + PROJECT_T + PROJECT_K). 별도 cap 없음.
      weightCap: { isRemainder: true },
    },
  } satisfies Record<
    EvaluationPolicyItemCategoryCode,
    {
      code: EvaluationPolicyItemCategoryCode
      labelKo: string
      contributionType: 'ORGANIZATION' | 'PERSONAL'
      baselineScores?: {
        target: number
        excellent: number
      }
      maxScore?: number
      weightCap?: {
        perItem?: number
        sumMax?: number
        isRemainder?: boolean
      }
    }
  >,
  // 2026 정책 가중치 제약 — cutover flag로 enforcement severity 제어.
  // enforced=false (cutover 전): 위반은 warning. H2 cutover(2026-07-01) 시 true로 flip하면
  // 라우트에서 400 blocker로 전환. 가감점 adjustmentRule.active와 동일 dormant 패턴.
  weightRule: {
    enforced: false,
    totalSum: 100,
    cycleYear: 2026,
  },
  finalScoreFormula: {
    organizationPerformanceWeight: 30,
    personalPerformanceWeight: 70,
    active: false,
  },
  adjustmentRule: {
    active: false,
    min: -5,
    max: 5,
    zeroSumRequired: true,
    applicableCategories: ['ORG_GOAL', 'PROJECT_T', 'PROJECT_K'],
    notApplicableBelowTarget: true,
  },
  aiCapability: {
    active: false,
    annualEvaluationScoreIncluded: false,
    levelUpRequirementStartsFromYear: 2028,
    evaluationMode: 'PASS_FAIL',
    applicableTargets: ['TEAM_LEADER', 'MEMBER'],
    excludedTargets: ['SECTION_CHIEF', 'DIV_HEAD'],
    recognitionRoutes: [
      {
        code: 'AI_PROJECT_TK',
        labelKo: 'AI 기반 프로젝트 T/K',
      },
      {
        code: 'ORG_CONTRIBUTION_USE_CASE',
        labelKo: '조직 기여 AI 활용 사례',
      },
      {
        code: 'AI_PRACTICAL_CERTIFICATION',
        labelKo: 'AI 실무 역량 인증',
      },
    ] satisfies Array<{
      code: AiCapabilityRecognitionRouteCode
      labelKo: string
    }>,
  },
  grades: [
    { code: 'SUPER', label: 'Super' },
    { code: 'OUTSTANDING', label: 'Outstanding' },
    { code: 'EXCELLENT', label: 'Excellent' },
    { code: 'GOOD', label: 'Good' },
    { code: 'NEED_IMPROVEMENT', label: 'Need Improvement' },
    { code: 'UNSATISFACTORY', label: 'Unsatisfactory' },
  ] satisfies Array<{ code: EvaluationPolicyGradeCode; label: string }>,
  gradeThresholdGroups: [
    {
      group: 'TEAM_MEMBER_NON_SALES',
      label: '팀원 비영업',
      salesGroup: 'NON_SALES',
      roleGroup: 'TEAM_MEMBER',
      thresholds: {
        OUTSTANDING: { note: 'Excellent 대상 중 일부 선발', selectionOnly: true },
        EXCELLENT: { minInclusive: 85 },
        GOOD: { minInclusive: 75, maxExclusive: 85 },
        NEED_IMPROVEMENT: { note: 'Unsatisfactory 대상 중 일부 선발', selectionOnly: true },
        UNSATISFACTORY: { maxExclusive: 75 },
      },
      notes: ['Super는 팀원 비영업 기준에서 별도 점수 구간으로 운영하지 않음'],
    },
    {
      group: 'TEAM_SECTION_LEADER_NON_SALES',
      label: '팀장/실장 비영업',
      salesGroup: 'NON_SALES',
      roleGroup: 'TEAM_SECTION_LEADER',
      thresholds: {
        SUPER: { minInclusive: 120 },
        OUTSTANDING: { minInclusive: 115, maxExclusive: 120 },
        EXCELLENT: { minInclusive: 105, maxExclusive: 115 },
        GOOD: { minInclusive: 90, maxExclusive: 105 },
        NEED_IMPROVEMENT: { minInclusive: 80, maxExclusive: 90 },
        UNSATISFACTORY: { maxExclusive: 80 },
      },
    },
    {
      group: 'TEAM_MEMBER_SALES',
      label: '팀원 영업',
      salesGroup: 'SALES',
      roleGroup: 'TEAM_MEMBER',
      thresholds: {
        SUPER: { minInclusive: 110 },
        OUTSTANDING: {
          minInclusive: 110,
          note: 'PPT 표기상 Super 구간과 중첩되어 Phase 1에서 HR 확정 필요',
          requiresPolicyConfirmation: true,
        },
        EXCELLENT: { minInclusive: 100, maxExclusive: 110 },
        GOOD: { minInclusive: 90, maxExclusive: 100 },
        NEED_IMPROVEMENT: { minInclusive: 80, maxExclusive: 90 },
        UNSATISFACTORY: { maxExclusive: 80 },
      },
      notes: ['Outstanding/Super 경계는 정책 담당자 확인 후 Phase 1에서 확정'],
    },
    {
      group: 'TEAM_SECTION_LEADER_SALES',
      label: '팀장/실장 영업',
      salesGroup: 'SALES',
      roleGroup: 'TEAM_SECTION_LEADER',
      thresholds: {
        SUPER: { minInclusive: 110 },
        OUTSTANDING: { minInclusive: 100, maxExclusive: 110 },
        EXCELLENT: { minInclusive: 90, maxExclusive: 100 },
        GOOD: { minInclusive: 80, maxExclusive: 90 },
        NEED_IMPROVEMENT: { minInclusive: 70, maxExclusive: 80 },
        UNSATISFACTORY: { maxExclusive: 70 },
      },
    },
    {
      group: 'DIVISION_HEAD',
      label: '본부장',
      salesGroup: 'ALL',
      roleGroup: 'DIVISION_HEAD',
      thresholds: {
        SUPER: { minInclusive: 120 },
        OUTSTANDING: { minInclusive: 115, maxExclusive: 120 },
        EXCELLENT: { minInclusive: 105, maxExclusive: 115 },
        GOOD: { minInclusive: 95, maxExclusive: 105 },
        NEED_IMPROVEMENT: { minInclusive: 85, maxExclusive: 95 },
        UNSATISFACTORY: { maxExclusive: 85 },
      },
    },
  ] satisfies GradeThresholdPolicy[],
} as const

export const EVALUATION_POLICIES_BY_YEAR = {
  [EVALUATION_POLICY_2026_YEAR]: EVALUATION_POLICY_2026,
} as const

export type EvaluationPolicyYear = keyof typeof EVALUATION_POLICIES_BY_YEAR

export function getEvaluationPolicy(year: number) {
  return EVALUATION_POLICIES_BY_YEAR[year as EvaluationPolicyYear]
}

export function isEvaluationPolicyItemCategory(value: unknown): value is EvaluationPolicyItemCategoryCode {
  return (
    typeof value === 'string' &&
    EVALUATION_POLICY_ITEM_CATEGORY_CODES.includes(value as EvaluationPolicyItemCategoryCode)
  )
}
