import type { EvaluationPolicyItemCategoryCode } from './evaluation-policy-2026'

export type EvaluationPolicyClassification = EvaluationPolicyItemCategoryCode | 'UNKNOWN'

export type EvaluationPolicyClassificationInput = {
  kpiName?: string | null
  definition?: string | null
  formula?: string | null
  kpiType?: string | null
  linkedOrgKpiId?: string | null
  linkedOrgKpiCategory?: string | null
  linkedOrgKpiTitle?: string | null
  tags?: unknown
  reviewVerdicts?: string[]
}

export type EvaluationPolicyClassificationResult = {
  category: EvaluationPolicyClassification
  confidence: number
  reasons: string[]
  manualReviewRequired: boolean
  signals: string[]
}

const PROJECT_T_PATTERNS = [
  '프로젝트 t',
  'project t',
  'project_t',
  'project-t',
  '[t]',
  '#t',
  ' t/k',
]

const PROJECT_K_PATTERNS = [
  '프로젝트 k',
  'project k',
  'project_k',
  'project-k',
  '[k]',
  '#k',
]

const DAILY_WORK_PATTERNS = [
  '일상업무',
  '일상 업무',
  'routine',
  'daily',
  '운영',
  '유지',
  '정기',
  '반복',
]

function normalizeText(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase()
}

export function parsePolicyTags(value: unknown): string[] {
  if (!value) return []
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter((item) => item.length > 0)
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    if (Array.isArray(record.tags)) return parsePolicyTags(record.tags)
    if (Array.isArray(record.labels)) return parsePolicyTags(record.labels)
  }
  if (typeof value === 'string') {
    return value
      .split(/[,\s#]+/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
  }
  return []
}

function includesAny(text: string, patterns: string[]) {
  return patterns.some((pattern) => text.includes(pattern))
}

export function classifyEvaluationPolicyItem(
  input: EvaluationPolicyClassificationInput
): EvaluationPolicyClassificationResult {
  const tags = parsePolicyTags(input.tags)
  const searchableText = [
    input.kpiName,
    input.definition,
    input.formula,
    input.linkedOrgKpiCategory,
    input.linkedOrgKpiTitle,
    tags.join(' '),
  ]
    .map(normalizeText)
    .filter(Boolean)
    .join(' ')

  const signals: string[] = []
  const reasons: string[] = []
  const hasLinkedOrgKpi = Boolean(input.linkedOrgKpiId?.trim())
  const hasProjectTMarker = includesAny(searchableText, PROJECT_T_PATTERNS)
  const hasProjectKMarker = includesAny(searchableText, PROJECT_K_PATTERNS)
  const hasDailyMarker = includesAny(searchableText, DAILY_WORK_PATTERNS)
  const hasHrReviewSignal = (input.reviewVerdicts ?? []).some((verdict) => verdict.trim().length > 0)

  if (hasProjectTMarker) signals.push('PROJECT_T_MARKER')
  if (hasProjectKMarker) signals.push('PROJECT_K_MARKER')
  if (hasDailyMarker) signals.push('DAILY_WORK_MARKER')
  if (hasLinkedOrgKpi) signals.push('LINKED_ORG_KPI')
  if (hasHrReviewSignal) signals.push('HR_REVIEW_SIGNAL')

  if (hasProjectTMarker && hasProjectKMarker) {
    return {
      category: 'UNKNOWN',
      confidence: 0.2,
      reasons: ['프로젝트 T와 프로젝트 K 신호가 동시에 감지되어 수동 검토가 필요합니다.'],
      manualReviewRequired: true,
      signals,
    }
  }

  if (hasProjectTMarker) {
    reasons.push('KPI명/태그/설명에서 프로젝트 T 신호가 감지되었습니다.')
    return {
      category: 'PROJECT_T',
      confidence: hasLinkedOrgKpi ? 0.72 : 0.82,
      reasons,
      manualReviewRequired: hasLinkedOrgKpi,
      signals,
    }
  }

  if (hasProjectKMarker) {
    reasons.push('KPI명/태그/설명에서 프로젝트 K 신호가 감지되었습니다.')
    return {
      category: 'PROJECT_K',
      confidence: hasLinkedOrgKpi ? 0.72 : 0.82,
      reasons,
      manualReviewRequired: hasLinkedOrgKpi,
      signals,
    }
  }

  if (hasLinkedOrgKpi) {
    reasons.push('상위 조직 KPI와 연결되어 있어 조직목표 후보로 분류했습니다.')
    if (hasDailyMarker) {
      reasons.push('일상업무 신호도 있어 조직목표/일상업무 중복 여부 확인이 필요합니다.')
    }
    return {
      category: 'ORG_GOAL',
      confidence: hasDailyMarker ? 0.65 : 0.78,
      reasons,
      manualReviewRequired: hasDailyMarker,
      signals,
    }
  }

  if (hasDailyMarker) {
    reasons.push('KPI명/태그/설명에서 일상업무 신호가 감지되었습니다.')
    return {
      category: 'DAILY_WORK',
      confidence: 0.72,
      reasons,
      manualReviewRequired: false,
      signals,
    }
  }

  return {
    category: 'UNKNOWN',
    confidence: 0,
    reasons: ['조직 KPI 연결, 프로젝트 T/K, 일상업무를 구분할 충분한 신호가 없습니다.'],
    manualReviewRequired: true,
    signals,
  }
}
