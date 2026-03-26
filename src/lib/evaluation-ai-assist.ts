import { z } from 'zod'

export const EvaluationAssistModeSchema = z.enum(['draft', 'bias', 'growth'])

export const EvaluationAssistResultSchema = z.object({
  focusArea: z.string().min(1),
  recommendedActions: z.array(z.string().min(1)).min(1),
  supportNeeded: z.array(z.string().min(1)).min(1),
  milestone: z.string().min(1),
})

export type EvaluationAssistMode = z.infer<typeof EvaluationAssistModeSchema>
export type EvaluationAssistResult = z.infer<typeof EvaluationAssistResultSchema>

export type EvaluationAssistPreview = {
  requestLogId: string
  source: 'ai' | 'disabled'
  fallbackReason?: string | null
  mode: EvaluationAssistMode
  result: EvaluationAssistResult
}

export function normalizeEvaluationAssistResult(input: unknown): EvaluationAssistResult {
  const parsed = EvaluationAssistResultSchema.safeParse(input)
  if (parsed.success) {
    return parsed.data
  }

  return {
    focusArea: 'AI 제안 형식을 다시 확인해 주세요.',
    recommendedActions: ['결과 형식이 올바르지 않아 제안을 정리하지 못했습니다.'],
    supportNeeded: ['잠시 후 다시 시도하거나 입력 내용을 조금 더 구체적으로 작성해 주세요.'],
    milestone: '미리보기 형식을 확인한 뒤 다시 요청',
  }
}

export function getEvaluationAssistModeLabel(mode: EvaluationAssistMode) {
  switch (mode) {
    case 'draft':
      return '코멘트 초안'
    case 'bias':
      return '편향 점검'
    case 'growth':
      return '성장 제안'
  }
}

export function getEvaluationAssistActionLabel(mode: EvaluationAssistMode) {
  return mode === 'bias' ? '권장 수정 문장' : '권장 액션'
}

export function formatEvaluationAssistForDraft(result: EvaluationAssistResult) {
  return [result.focusArea, ...result.recommendedActions].filter(Boolean).join('\n')
}

export function formatEvaluationAssistForGrowthMemo(result: EvaluationAssistResult) {
  const actions = result.recommendedActions.map((item) => `- ${item}`).join('\n')
  const support = result.supportNeeded.map((item) => `- ${item}`).join('\n')

  return [
    `성장 초점: ${result.focusArea}`,
    '',
    '권장 액션',
    actions,
    '',
    '필요 지원',
    support,
    '',
    `마일스톤: ${result.milestone}`,
  ].join('\n')
}

export function applyEvaluationAssistResult(mode: EvaluationAssistMode, result: EvaluationAssistResult) {
  if (mode === 'growth') {
    return {
      draftComment: null,
      growthMemo: formatEvaluationAssistForGrowthMemo(result),
    }
  }

  return {
    draftComment: formatEvaluationAssistForDraft(result),
    growthMemo: null,
  }
}

export function getEvaluationAssistDisabledReason(reason?: string | null) {
  return reason || 'AI 보조 기능이 현재 비활성화되어 있습니다.'
}

export function getEvaluationAssistRequestErrorMessage() {
  return 'AI 제안을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'
}
