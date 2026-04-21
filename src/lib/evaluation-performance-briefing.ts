import { z } from 'zod'

export const EvaluationPerformanceBriefingAlignmentStatusSchema = z.enum([
  'MATCHED',
  'MOSTLY_MATCHED',
  'REVIEW_NEEDED',
  'POSSIBLE_OVER_RATING',
  'POSSIBLE_UNDER_RATING',
  'INSUFFICIENT_EVIDENCE',
])

export const EvaluationPerformanceBriefingSourceSchema = z.enum(['ai', 'fallback', 'disabled'])
export const EvaluationPerformanceBriefingEvidenceLevelSchema = z.enum(['STRONG', 'PARTIAL', 'WEAK'])
export const EvaluationPerformanceBriefingEvidenceSourceTypeSchema = z.enum([
  'EVALUATION',
  'PERSONAL_KPI',
  'MONTHLY_RECORD',
  'CHECKIN',
  'FEEDBACK',
  'ORG_KPI',
  'EVALUATION_HISTORY',
])

export const EvaluationPerformanceBriefingEvidenceItemSchema = z.object({
  id: z.string().min(1),
  sourceType: EvaluationPerformanceBriefingEvidenceSourceTypeSchema,
  sourceId: z.string().min(1),
  title: z.string().min(1).max(200),
  snippet: z.string().min(1).max(600).optional(),
  href: z.string().min(1).max(500).optional(),
})

export const EvaluationPerformanceBriefingStatementSchema = z.object({
  text: z.string().min(1).max(500),
  evidenceIds: z.array(z.string().min(1)).min(1).max(6),
})

export const EvaluationPerformanceBriefingAlignmentSchema = z.object({
  status: EvaluationPerformanceBriefingAlignmentStatusSchema,
  reason: z.string().min(1).max(1000),
  evidenceIds: z.array(z.string().min(1)).min(1).max(8),
})

export const EvaluationPerformanceBriefingCoverageSchema = z.object({
  evidenceLevel: EvaluationPerformanceBriefingEvidenceLevelSchema,
  evidenceCount: z.number().int().min(0),
  kpiCount: z.number().int().min(0),
  monthlyRecordCount: z.number().int().min(0),
  checkinCount: z.number().int().min(0),
  feedbackRoundCount: z.number().int().min(0),
  evaluationHistoryCount: z.number().int().min(0),
})

export const EvaluationPerformanceBriefingSnapshotSchema = z.object({
  requestLogId: z.string().min(1).optional(),
  source: EvaluationPerformanceBriefingSourceSchema,
  generatedAt: z.string().datetime(),
  promptVersion: z.string().min(1).max(50),
  model: z.string().min(1).max(100).nullable().optional(),
  stale: z.boolean().default(false),
  disclaimer: z
    .string()
    .min(1)
    .max(200)
    .default('AI 브리핑은 최종 평가를 대체하지 않으며, 등록된 성과 근거를 요약해 검토를 지원합니다.'),
  headline: z.string().min(1).max(300),
  headlineEvidenceIds: z.array(z.string().min(1)).min(1).max(6),
  strengths: z.array(EvaluationPerformanceBriefingStatementSchema).min(1).max(5),
  kpiSummary: z.array(EvaluationPerformanceBriefingStatementSchema).min(1).max(5),
  contributionSummary: z.array(EvaluationPerformanceBriefingStatementSchema).min(1).max(5),
  risks: z.array(EvaluationPerformanceBriefingStatementSchema).min(1).max(5),
  alignment: EvaluationPerformanceBriefingAlignmentSchema,
  questions: z.array(z.string().min(1).max(300)).min(2).max(5),
  evidenceCoverage: EvaluationPerformanceBriefingCoverageSchema,
  evidence: z.array(EvaluationPerformanceBriefingEvidenceItemSchema).min(1).max(32),
})

export type EvaluationPerformanceBriefingAlignmentStatus = z.infer<
  typeof EvaluationPerformanceBriefingAlignmentStatusSchema
>
export type EvaluationPerformanceBriefingEvidenceLevel = z.infer<
  typeof EvaluationPerformanceBriefingEvidenceLevelSchema
>
export type EvaluationPerformanceBriefingEvidenceItem = z.infer<
  typeof EvaluationPerformanceBriefingEvidenceItemSchema
>
export type EvaluationPerformanceBriefingStatement = z.infer<
  typeof EvaluationPerformanceBriefingStatementSchema
>
export type EvaluationPerformanceBriefingSnapshot = z.infer<
  typeof EvaluationPerformanceBriefingSnapshotSchema
>

export type EvaluationPerformanceBriefingAlignmentMetrics = {
  managerScore?: number | null
  evidenceScore?: number | null
  evidenceLevel: EvaluationPerformanceBriefingEvidenceLevel
  evidenceCount: number
  managerCommentSupported: boolean
}

const PUBLIC_ERROR_MESSAGE =
  'AI 성과 브리핑을 생성하지 못했습니다. 잠시 후 다시 시도해 주세요. 문제가 계속되면 관리자에게 문의해 주세요.'

export function normalizeEvaluationPerformanceBriefingSnapshot(
  input: unknown,
  overrides?: Partial<EvaluationPerformanceBriefingSnapshot>
) {
  const parsed = EvaluationPerformanceBriefingSnapshotSchema.safeParse(input)
  if (!parsed.success) {
    return null
  }

  return EvaluationPerformanceBriefingSnapshotSchema.parse({
    ...parsed.data,
    ...overrides,
  })
}

export function determineEvaluationPerformanceBriefingAlignmentStatus(
  metrics: EvaluationPerformanceBriefingAlignmentMetrics
): EvaluationPerformanceBriefingAlignmentStatus {
  if (metrics.evidenceLevel === 'WEAK' || metrics.evidenceCount < 4) {
    return 'INSUFFICIENT_EVIDENCE'
  }

  if (typeof metrics.managerScore !== 'number' || typeof metrics.evidenceScore !== 'number') {
    return metrics.managerCommentSupported ? 'REVIEW_NEEDED' : 'INSUFFICIENT_EVIDENCE'
  }

  const scoreGap = metrics.managerScore - metrics.evidenceScore
  if (scoreGap >= 15) {
    return 'POSSIBLE_OVER_RATING'
  }

  if (scoreGap <= -15) {
    return 'POSSIBLE_UNDER_RATING'
  }

  if (Math.abs(scoreGap) <= 7 && metrics.managerCommentSupported) {
    return 'MATCHED'
  }

  if (Math.abs(scoreGap) <= 12) {
    return 'MOSTLY_MATCHED'
  }

  return 'REVIEW_NEEDED'
}

export function getEvaluationPerformanceBriefingAlignmentLabel(
  status: EvaluationPerformanceBriefingAlignmentStatus
) {
  switch (status) {
    case 'MATCHED':
      return '정합'
    case 'MOSTLY_MATCHED':
      return '대체로 정합'
    case 'REVIEW_NEEDED':
      return '추가 확인 필요'
    case 'POSSIBLE_OVER_RATING':
      return '과대평가 가능성'
    case 'POSSIBLE_UNDER_RATING':
      return '과소평가 가능성'
    case 'INSUFFICIENT_EVIDENCE':
      return '근거 부족'
  }
}

export function getEvaluationPerformanceBriefingAlignmentTone(
  status: EvaluationPerformanceBriefingAlignmentStatus
) {
  switch (status) {
    case 'MATCHED':
      return 'success' as const
    case 'MOSTLY_MATCHED':
      return 'neutral' as const
    case 'REVIEW_NEEDED':
      return 'warn' as const
    case 'POSSIBLE_OVER_RATING':
    case 'POSSIBLE_UNDER_RATING':
      return 'error' as const
    case 'INSUFFICIENT_EVIDENCE':
      return 'warn' as const
  }
}

export function getEvaluationPerformanceBriefingEvidenceLevelLabel(
  level: EvaluationPerformanceBriefingEvidenceLevel
) {
  switch (level) {
    case 'STRONG':
      return '근거 충분'
    case 'PARTIAL':
      return '근거 보완 필요'
    case 'WEAK':
      return '근거 부족'
  }
}

export function getEvaluationPerformanceBriefingSourceLabel(
  source: EvaluationPerformanceBriefingSnapshot['source']
) {
  switch (source) {
    case 'ai':
      return 'AI 생성'
    case 'fallback':
      return '근거 기반 요약'
    case 'disabled':
      return 'AI 비활성화 대체 요약'
  }
}

export function getEvaluationPerformanceBriefingSourceTypeLabel(
  sourceType: EvaluationPerformanceBriefingEvidenceItem['sourceType']
) {
  switch (sourceType) {
    case 'EVALUATION':
      return '평가 의견'
    case 'PERSONAL_KPI':
      return '개인 KPI'
    case 'MONTHLY_RECORD':
      return '월간 실적'
    case 'CHECKIN':
      return '체크인'
    case 'FEEDBACK':
      return '다면 피드백'
    case 'ORG_KPI':
      return '조직 KPI 연결'
    case 'EVALUATION_HISTORY':
      return '이전 평가'
  }
}

export function getEvaluationPerformanceBriefingPublicErrorMessage() {
  return PUBLIC_ERROR_MESSAGE
}

