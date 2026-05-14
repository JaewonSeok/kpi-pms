import {
  EVALUATION_POLICY_2026,
  isEvaluationPolicyItemCategory,
  type EvaluationPolicyItemCategoryCode,
  type EvaluationPolicyThresholdGroupCode,
} from '../lib/evaluation-policy-2026'
import {
  calculateEvaluationScore2026,
  type EvaluationScore2026AchievementLevel,
  type EvaluationScore2026ItemInput,
} from './evaluation-scoring-2026'
import {
  calculateAbsoluteGrade2026,
  type EvaluationGrade2026RoleGroup,
  type EvaluationGrade2026SalesGroup,
} from './evaluation-grade-2026'
import {
  calculateAnnualScoreWithoutAi2026,
  evaluateAiLevelUpRequirement2026,
  type AiPolicy2026GateStatus,
  type AiPolicy2026Position,
  type AiPolicy2026RecognitionEvidence,
  type AiPolicy2026RequirementStatus,
  type AiPolicy2026Role,
} from './evaluation-ai-policy-2026'

export const EVALUATION_PREVIEW_2026_FORMULA_VERSION = '2026-PPT-PREVIEW'

export type EvaluationPreview2026IssueSeverity = 'error' | 'warning'
export type EvaluationPreview2026IssueSource = 'readiness' | 'score' | 'grade' | 'ai'

export type EvaluationPreview2026Issue = {
  source: EvaluationPreview2026IssueSource
  code: string
  message: string
  severity: EvaluationPreview2026IssueSeverity
  itemId?: string
  itemTitle?: string
  groupKey?: string
}

export type EvaluationPreviewRawItem2026 = {
  id?: string
  title?: string
  policyCategory?: EvaluationPolicyItemCategoryCode | 'UNKNOWN' | string | null
  targetAchievementLevel?: EvaluationScore2026AchievementLevel | string | null
  score?: number | null
  basePolicyScore?: number | null
  finalScore?: number | null
  quantScore?: number | null
  qualScore?: number | null
  adjustmentScore?: number | null
  adjustmentGroupKey?: string | null
  weight?: number | null
}

export type EvaluationPreviewItemInput2026 = EvaluationScore2026ItemInput & {
  title?: string
}

export type EvaluationPreviewInput2026 = {
  evalYear: number
  items: EvaluationPreviewItemInput2026[]
  thresholdGroup?: EvaluationPolicyThresholdGroupCode | null
  salesGroup?: EvaluationGrade2026SalesGroup | null
  roleGroup?: EvaluationGrade2026RoleGroup | null
  employee?: {
    position?: AiPolicy2026Position | null
    role?: AiPolicy2026Role | null
  }
  ai?: {
    score?: number | null
    gateStatus?: AiPolicy2026GateStatus | null
    evidence?: AiPolicy2026RecognitionEvidence | null
  }
}

export type EvaluationPreviewItemResult2026 = {
  id?: string
  title?: string
  category?: string | null
  contributionType?: 'ORGANIZATION' | 'PERSONAL'
  baseScore?: number
  adjustmentScore?: number
  finalScore?: number
  weight?: number
  issues: EvaluationPreview2026Issue[]
}

export type EvaluationPreviewResult2026 = {
  formulaVersion: typeof EVALUATION_PREVIEW_2026_FORMULA_VERSION
  isPreview: true
  canCalculate: boolean
  score: {
    organizationScore: number | null
    personalScore: number | null
    finalScore: number | null
    organizationWeight: 0.3
    personalWeight: 0.7
  }
  grade: {
    calculatedGrade: string | null
    calculatedGradeCode: string | null
    thresholdGroup: string | null
    thresholdGroupLabel: string | null
    requiresPolicyConfirmation: boolean
    issues: EvaluationPreview2026Issue[]
  }
  ai: {
    includedInAnnualScore: false
    referenceScore: number | null
    levelUpRequirementStatus: 'not_applicable' | 'pending' | 'passed' | 'failed' | 'insufficient_data'
    recognitionRoute: string | null
    issues: EvaluationPreview2026Issue[]
  }
  items: EvaluationPreviewItemResult2026[]
  issues: EvaluationPreview2026Issue[]
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function normalizeAchievementLevel(value: EvaluationPreviewRawItem2026['targetAchievementLevel']) {
  return value === 'BELOW_TARGET' || value === 'TARGET' || value === 'EXCELLENT' || value === 'CUSTOM'
    ? value
    : undefined
}

function firstFiniteNumber(...values: Array<number | null | undefined>) {
  return values.find(isFiniteNumber)
}

function previewIssue(params: EvaluationPreview2026Issue): EvaluationPreview2026Issue {
  return params
}

function mapAiStatus(status: AiPolicy2026RequirementStatus): EvaluationPreviewResult2026['ai']['levelUpRequirementStatus'] {
  if (status === 'PASS') return 'passed'
  if (status === 'FAIL') return 'failed'
  if (status === 'PENDING') return 'pending'
  if (status === 'INSUFFICIENT_DATA') return 'insufficient_data'
  return 'not_applicable'
}

function scoreIssueToPreview(error: {
  code: string
  message: string
  itemId?: string
  groupKey?: string
  category?: string
}): EvaluationPreview2026Issue {
  return previewIssue({
    source: 'score',
    code: error.code,
    message: error.message,
    severity: 'error',
    itemId: error.itemId,
    groupKey: error.groupKey,
  })
}

function gradeIssueToPreview(
  issue: { code: string; message: string },
  severity: EvaluationPreview2026IssueSeverity
): EvaluationPreview2026Issue {
  return previewIssue({
    source: 'grade',
    code: issue.code,
    message: issue.message,
    severity,
  })
}

function aiIssueToPreview(issue: { code: string; message: string }): EvaluationPreview2026Issue {
  return previewIssue({
    source: 'ai',
    code: issue.code,
    message: issue.message,
    severity: 'warning',
  })
}

function itemTitleMap(items: EvaluationPreviewItemInput2026[]) {
  return new Map(items.map((item) => [item.id, item.title] as const))
}

export function buildEvaluationPreviewInput2026(params: {
  evalYear: number
  items: EvaluationPreviewRawItem2026[]
  thresholdGroup?: EvaluationPolicyThresholdGroupCode | null
  salesGroup?: EvaluationGrade2026SalesGroup | null
  roleGroup?: EvaluationGrade2026RoleGroup | null
  employee?: EvaluationPreviewInput2026['employee']
  ai?: EvaluationPreviewInput2026['ai']
}): EvaluationPreviewInput2026 {
  return {
    evalYear: params.evalYear,
    thresholdGroup: params.thresholdGroup,
    salesGroup: params.salesGroup,
    roleGroup: params.roleGroup,
    employee: params.employee,
    ai: params.ai,
    items: params.items.map((item) => ({
      id: item.id,
      title: item.title,
      category:
        typeof item.policyCategory === 'string' && isEvaluationPolicyItemCategory(item.policyCategory)
          ? item.policyCategory
          : item.policyCategory === 'UNKNOWN'
            ? 'UNKNOWN'
            : null,
      achievementLevel: normalizeAchievementLevel(item.targetAchievementLevel),
      score: firstFiniteNumber(item.score, item.basePolicyScore, item.finalScore, item.quantScore, item.qualScore) ?? null,
      adjustmentScore: item.adjustmentScore ?? null,
      adjustmentGroupKey: item.adjustmentGroupKey ?? null,
      weight: item.weight ?? null,
    })),
  }
}

export function validateEvaluationPreviewReadiness2026(
  input: EvaluationPreviewInput2026
): EvaluationPreview2026Issue[] {
  const issues: EvaluationPreview2026Issue[] = []

  if (!input.items.length) {
    issues.push(
      previewIssue({
        source: 'readiness',
        code: 'ITEMS_REQUIRED',
        message: '2026 preview 계산에는 평가 항목이 필요합니다.',
        severity: 'error',
      })
    )
  }

  for (const item of input.items) {
    if (!item.category) {
      issues.push(
        previewIssue({
          source: 'readiness',
          code: 'POLICY_CATEGORY_REQUIRED',
          message: '2026 preview 계산에는 각 항목의 policyCategory가 필요합니다.',
          severity: 'error',
          itemId: item.id,
          itemTitle: item.title,
        })
      )
    } else if (item.category === 'UNKNOWN') {
      issues.push(
        previewIssue({
          source: 'readiness',
          code: 'POLICY_CATEGORY_MANUAL_REVIEW_REQUIRED',
          message: 'UNKNOWN/manual-review 항목은 2026 preview에서 자동 계산하지 않습니다.',
          severity: 'error',
          itemId: item.id,
          itemTitle: item.title,
        })
      )
    }
  }

  if (!input.thresholdGroup && !input.roleGroup) {
    issues.push(
      previewIssue({
        source: 'readiness',
        code: 'GRADE_THRESHOLD_GROUP_REQUIRED',
        message: '2026 grade preview에는 thresholdGroup 또는 roleGroup/salesGroup 정보가 필요합니다.',
        severity: 'error',
      })
    )
  } else if (!input.thresholdGroup && input.roleGroup !== 'DIVISION_HEAD' && !input.salesGroup) {
    issues.push(
      previewIssue({
        source: 'readiness',
        code: 'SALES_GROUP_REQUIRED',
        message: '본부장이 아닌 대상은 영업/비영업 구분이 필요합니다.',
        severity: 'error',
      })
    )
  }

  if (!input.employee?.position && !input.employee?.role) {
    issues.push(
      previewIssue({
        source: 'readiness',
        code: 'AI_TARGET_ROLE_REQUIRED',
        message: 'AI 레벨업 요건 preview에는 대상자의 직책 또는 역할 정보가 필요합니다.',
        severity: 'warning',
      })
    )
  }

  return issues
}

export function summarizeEvaluationPreviewIssues2026(issues: EvaluationPreview2026Issue[]) {
  const errors = issues.filter((issue) => issue.severity === 'error')
  const warnings = issues.filter((issue) => issue.severity === 'warning')
  const bySource = new Map<EvaluationPreview2026IssueSource, number>()
  for (const issue of issues) {
    bySource.set(issue.source, (bySource.get(issue.source) ?? 0) + 1)
  }

  return {
    errorCount: errors.length,
    warningCount: warnings.length,
    bySource: Object.fromEntries(bySource) as Partial<Record<EvaluationPreview2026IssueSource, number>>,
    canCalculate: errors.length === 0,
  }
}

export function calculateEvaluationPreview2026(input: EvaluationPreviewInput2026): EvaluationPreviewResult2026 {
  const readinessIssues = validateEvaluationPreviewReadiness2026(input)
  const issues: EvaluationPreview2026Issue[] = [...readinessIssues]
  const titleById = itemTitleMap(input.items)
  const scoring = calculateEvaluationScore2026({ items: input.items })

  const itemIssuesById = new Map<string | undefined, EvaluationPreview2026Issue[]>()
  if (!scoring.ok) {
    for (const error of scoring.errors) {
      const mapped = scoreIssueToPreview(error)
      mapped.itemTitle = error.itemId ? titleById.get(error.itemId) : undefined
      issues.push(mapped)
      const itemIssues = itemIssuesById.get(error.itemId) ?? []
      itemIssues.push(mapped)
      itemIssuesById.set(error.itemId, itemIssues)
    }
  }

  const score = scoring.ok
    ? {
        organizationScore: scoring.value.organizationPerformanceScore,
        personalScore: scoring.value.personalPerformanceScore,
        finalScore: scoring.value.finalScore,
        organizationWeight: 0.3 as const,
        personalWeight: 0.7 as const,
      }
    : {
        organizationScore: null,
        personalScore: null,
        finalScore: null,
        organizationWeight: 0.3 as const,
        personalWeight: 0.7 as const,
      }

  const aiRequirement = evaluateAiLevelUpRequirement2026({
    evalYear: input.evalYear,
    position: input.employee?.position,
    role: input.employee?.role,
    gateStatus: input.ai?.gateStatus,
    evidence: input.ai?.evidence,
  })
  const aiIssues = aiRequirement.issues.map(aiIssueToPreview)
  issues.push(...aiIssues)

  const aiAnnual = scoring.ok
    ? calculateAnnualScoreWithoutAi2026({
        organizationPerformanceScore: scoring.value.organizationPerformanceScore,
        personalPerformanceScore: scoring.value.personalPerformanceScore,
        aiCompetencyScore: input.ai?.score,
        aiGateStatus: input.ai?.gateStatus,
      })
    : null

  if (aiAnnual) {
    issues.push(...aiAnnual.issues.map(aiIssueToPreview))
  }

  const gradeResult =
    scoring.ok && score.finalScore !== null
      ? calculateAbsoluteGrade2026({
          score: score.finalScore,
          thresholdGroup: input.thresholdGroup,
          salesGroup: input.salesGroup,
          roleGroup: input.roleGroup,
        })
      : null
  const gradeIssues = gradeResult
    ? [
        ...gradeResult.warnings.map((warning) => gradeIssueToPreview(warning, 'warning')),
        ...(!gradeResult.ok ? gradeResult.errors.map((error) => gradeIssueToPreview(error, 'error')) : []),
      ]
    : []
  issues.push(...gradeIssues)

  const items: EvaluationPreviewItemResult2026[] = input.items.map((inputItem) => {
    const calculated = scoring.ok ? scoring.value.itemScores.find((item) => item.id === inputItem.id) : undefined
    return {
      id: inputItem.id,
      title: inputItem.title,
      category: inputItem.category ?? null,
      contributionType: calculated?.contributionType,
      baseScore: calculated?.baseScore,
      adjustmentScore: calculated?.adjustmentScore,
      finalScore: calculated?.finalScore,
      weight: calculated?.weight,
      issues: itemIssuesById.get(inputItem.id) ?? [],
    }
  })

  const blockingIssues = issues.filter((issue) => issue.severity === 'error')

  return {
    formulaVersion: EVALUATION_PREVIEW_2026_FORMULA_VERSION,
    isPreview: true,
    canCalculate: blockingIssues.length === 0 && scoring.ok && Boolean(gradeResult?.ok),
    score: {
      ...score,
      finalScore: aiAnnual?.annualPerformanceScore ?? score.finalScore,
    },
    grade: {
      calculatedGrade: gradeResult?.ok ? gradeResult.value.calculatedGrade.label : null,
      calculatedGradeCode: gradeResult?.ok ? gradeResult.value.calculatedGrade.code : null,
      thresholdGroup: gradeResult?.ok ? gradeResult.value.thresholdGroup : (input.thresholdGroup ?? null),
      thresholdGroupLabel: gradeResult?.ok ? gradeResult.value.thresholdGroupLabel : null,
      requiresPolicyConfirmation:
        (gradeResult?.ok ? gradeResult.value.requiresPolicyConfirmation : false) ||
        gradeIssues.some((issue) => issue.code === 'AMBIGUOUS_THRESHOLD_MATCH' || issue.code === 'POLICY_CONFIRMATION_REQUIRED'),
      issues: gradeIssues,
    },
    ai: {
      includedInAnnualScore: false,
      referenceScore: typeof input.ai?.score === 'number' ? input.ai.score : null,
      levelUpRequirementStatus: mapAiStatus(aiRequirement.status),
      recognitionRoute: aiRequirement.recognitionRoute ?? null,
      issues: aiIssues,
    },
    items,
    issues,
  }
}
