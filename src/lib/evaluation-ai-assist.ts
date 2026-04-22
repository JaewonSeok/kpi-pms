import { z } from 'zod'

export const EvaluationAssistModeSchema = z.enum(['draft', 'bias', 'growth'])
export const EvaluationAssistEvidenceLevelSchema = z.enum(['strong', 'partial', 'weak'])

export const EvaluationAssistResultSchema = z.object({
  draftText: z.string().min(1),
  strengths: z.array(z.string().min(1)).min(1),
  concerns: z.array(z.string().min(1)).min(1),
  coachingPoints: z.array(z.string().min(1)).min(1),
  nextStep: z.string().min(1),
})

export const EvaluationAssistEvidenceViewSchema = z.object({
  kpiSummaries: z.array(z.string().min(1)).default([]),
  monthlySummaries: z.array(z.string().min(1)).default([]),
  noteSummaries: z.array(z.string().min(1)).default([]),
  keyPoints: z.array(z.string().min(1)).default([]),
  warnings: z.array(z.string().min(1)).default([]),
  alerts: z.array(z.string().min(1)).default([]),
  sufficiency: EvaluationAssistEvidenceLevelSchema.default('weak'),
})

export type EvaluationAssistMode = z.infer<typeof EvaluationAssistModeSchema>
export type EvaluationAssistResult = z.infer<typeof EvaluationAssistResultSchema>
export type EvaluationAssistEvidenceLevel = z.infer<typeof EvaluationAssistEvidenceLevelSchema>
export type EvaluationAssistEvidenceView = z.infer<typeof EvaluationAssistEvidenceViewSchema>

export type EvaluationAssistPreview = {
  requestLogId: string
  source: 'ai' | 'disabled'
  fallbackReason?: string | null
  mode: EvaluationAssistMode
  result: EvaluationAssistResult
  evidence: EvaluationAssistEvidenceView
}

type EvaluationAssistEvidenceInput = {
  kpiSummaries?: string[]
  monthlySummaries?: string[]
  noteSummaries?: string[]
  keyPoints?: string[]
  warnings?: string[]
  alerts?: string[]
}

const PUBLIC_ERROR_MESSAGE =
  'AI 초안 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요. 문제가 계속되면 관리자에게 문의해 주세요.'

function normalizeStringList(values?: string[], limit = 6) {
  if (!Array.isArray(values)) return []

  return values
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, limit)
}

export function buildEvaluationAssistEvidenceView(
  input: EvaluationAssistEvidenceInput
): EvaluationAssistEvidenceView {
  const kpiSummaries = normalizeStringList(input.kpiSummaries)
  const monthlySummaries = normalizeStringList(input.monthlySummaries)
  const noteSummaries = normalizeStringList(input.noteSummaries)
  const keyPoints = normalizeStringList(input.keyPoints, 8)
  const alerts = normalizeStringList(input.alerts, 4)
  const warningSet = new Set(normalizeStringList(input.warnings, 6))

  const sourceBucketCount = [kpiSummaries.length > 0, monthlySummaries.length > 0, noteSummaries.length > 0].filter(
    Boolean
  ).length

  if (!kpiSummaries.length && !monthlySummaries.length) {
    warningSet.add('KPI 및 월간 실적 근거가 부족합니다. 평가 코멘트는 보수적으로 검토해 주세요.')
  }

  if (!noteSummaries.length) {
    warningSet.add('최근 피드백과 메모가 부족해 일반론 중심 문장이 나올 수 있습니다.')
  }

  if (sourceBucketCount <= 1 || keyPoints.length < 3) {
    warningSet.add('근거가 충분하지 않아 초안 품질이 제한될 수 있습니다.')
  }

  if (!monthlySummaries.length && noteSummaries.length <= 1) {
    warningSet.add('편향 가능성을 줄이기 위해 다른 근거와 함께 검토해 주세요.')
  }

  let sufficiency: EvaluationAssistEvidenceLevel = 'weak'
  if (sourceBucketCount >= 3 && keyPoints.length >= 4) {
    sufficiency = 'strong'
  } else if (sourceBucketCount >= 2 && keyPoints.length >= 2) {
    sufficiency = 'partial'
  }

  return EvaluationAssistEvidenceViewSchema.parse({
    kpiSummaries,
    monthlySummaries,
    noteSummaries,
    keyPoints,
    warnings: [...warningSet],
    alerts,
    sufficiency,
  })
}

export function normalizeEvaluationAssistResult(input: unknown): EvaluationAssistResult {
  const parsed = EvaluationAssistResultSchema.safeParse(input)
  if (parsed.success) {
    return parsed.data
  }

  return {
    draftText: 'AI 제안 형식을 다시 확인한 뒤 재요청해 주세요.',
    strengths: ['결과 형식이 올바르지 않아 강점 요약을 생성하지 못했습니다.'],
    concerns: ['응답 형식이 예상과 달라 초안 품질을 다시 확인해야 합니다.'],
    coachingPoints: ['잠시 후 다시 시도하거나 근거 내용을 더 구체적으로 정리해 주세요.'],
    nextStep: '미리보기 형식을 점검한 뒤 다시 요청',
  }
}

export function normalizeEvaluationAssistEvidenceView(input: unknown): EvaluationAssistEvidenceView {
  const parsed = EvaluationAssistEvidenceViewSchema.safeParse(input)
  if (parsed.success) {
    return parsed.data
  }

  return buildEvaluationAssistEvidenceView({})
}

export function getEvaluationAssistModeLabel(mode: EvaluationAssistMode) {
  switch (mode) {
    case 'draft':
      return '평가 코멘트 초안'
    case 'bias':
      return '코칭 대화 초안'
    case 'growth':
      return '성장/개선 과제 제안'
  }
}

export function getEvaluationAssistModeDescription(mode: EvaluationAssistMode) {
  switch (mode) {
    case 'draft':
      return '현재 근거를 바탕으로 제출 가능한 평가 코멘트 초안을 정리합니다.'
    case 'bias':
      return '강점과 우려 포인트를 균형 있게 다루는 1:1 코칭 대화 초안을 만듭니다.'
    case 'growth':
      return '다음 주기에 이어질 성장 과제와 지원 포인트를 정리합니다.'
  }
}

export function getEvaluationAssistActionLabel(mode: EvaluationAssistMode) {
  if (mode === 'draft') return '초안 코멘트'
  if (mode === 'bias') return '코칭 대화 포인트'
  return '성장 과제'
}

export function formatEvaluationAssistForDraft(result: EvaluationAssistResult) {
  return result.draftText
}

function joinAssistLines(values: string[]) {
  return values
    .map((value) => value.trim())
    .filter(Boolean)
    .join('\n')
}

function formatEvaluationAssistForMemo(mode: EvaluationAssistMode, result: EvaluationAssistResult) {
  const heading = mode === 'bias' ? '코칭 대화 초안' : '성장/개선 과제 초안'
  const strengths = result.strengths.map((item) => `- ${item}`).join('\n')
  const concerns = result.concerns.map((item) => `- ${item}`).join('\n')
  const coachingPoints = result.coachingPoints.map((item) => `- ${item}`).join('\n')

  return [
    heading,
    '',
    result.draftText,
    '',
    '강점 포인트',
    strengths,
    '',
    '우려 포인트',
    concerns,
    '',
    mode === 'bias' ? '코칭 포인트' : '개선 과제',
    coachingPoints,
    '',
    `다음 단계: ${result.nextStep}`,
  ].join('\n')
}

export function applyEvaluationAssistResult(mode: EvaluationAssistMode, result: EvaluationAssistResult) {
  const strengthComment = joinAssistLines(result.strengths)
  const improvementComment = joinAssistLines(result.concerns)
  const nextStepGuidance = joinAssistLines([...result.coachingPoints, result.nextStep])

  if (mode === 'draft') {
    return {
      draftComment: formatEvaluationAssistForDraft(result),
      strengthComment,
      improvementComment,
      nextStepGuidance,
      growthMemo: null,
    }
  }

  return {
    draftComment: null,
    strengthComment,
    improvementComment,
    nextStepGuidance,
    growthMemo: formatEvaluationAssistForMemo(mode, result),
  }
}

export function formatEvaluationAssistPreviewForClipboard(
  mode: EvaluationAssistMode,
  result: EvaluationAssistResult,
  evidence: EvaluationAssistEvidenceView
) {
  const evidenceText = evidence.keyPoints.map((item) => `- ${item}`).join('\n') || '- 확인 가능한 핵심 포인트가 아직 없습니다.'
  const warningsText =
    evidence.warnings.map((item) => `- ${item}`).join('\n') || '- 별도 경고 없음'

  return [
    `[${getEvaluationAssistModeLabel(mode)}]`,
    '',
    result.draftText,
    '',
    '강점 포인트',
    ...result.strengths.map((item) => `- ${item}`),
    '',
    '우려 포인트',
    ...result.concerns.map((item) => `- ${item}`),
    '',
    mode === 'draft' ? '보완/코칭 포인트' : '코칭/개선 포인트',
    ...result.coachingPoints.map((item) => `- ${item}`),
    '',
    `다음 단계: ${result.nextStep}`,
    '',
    '사용 근거 요약',
    evidenceText,
    '',
    '품질 경고',
    warningsText,
  ].join('\n')
}

export function getEvaluationAssistEvidenceLevelLabel(level: EvaluationAssistEvidenceLevel) {
  switch (level) {
    case 'strong':
      return '근거 충실'
    case 'partial':
      return '근거 보완 필요'
    case 'weak':
      return '근거 부족'
  }
}

export function getEvaluationAssistDisabledReason(reason?: string | null) {
  return reason || 'AI 보조 기능이 현재 비활성화되어 있습니다.'
}

export function getEvaluationAssistPublicErrorMessage() {
  return PUBLIC_ERROR_MESSAGE
}

export function getEvaluationAssistRequestErrorMessage() {
  return PUBLIC_ERROR_MESSAGE
}
