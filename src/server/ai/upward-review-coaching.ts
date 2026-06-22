import type { Session } from 'next-auth'
import { readAiAssistEnv } from '@/lib/ai-env'
import { AppError } from '@/lib/utils'
import {
  type UpwardReviewAICoachingPreview,
  type UpwardReviewAICoachingResult,
  type UpwardReviewAICoachingRole,
} from '@/lib/upward-review-ai-coaching'
import {
  buildLeadershipDiagnosisAiCoachingPrompt,
  buildLeadershipDiagnosisAiCoachingPromptInput,
  LEADERSHIP_DIAGNOSIS_AI_COACHING_SCHEMA,
  validateLeadershipDiagnosisAiCoachingResult,
} from '@/components/evaluation/upward/leadershipDiagnosisAiCoachingPrompt'
import { getUpwardReviewPageData } from '@/server/upward-review'

type JsonRecord = Record<string, unknown>

type GenerateParams = {
  session: Session
  cycleId?: string
  roundId?: string
  empId?: string
  mode?: UpwardReviewAICoachingRole
}

function extractResponseText(response: {
  output_text?: string | null
  output?: Array<{ content?: Array<{ text?: string | null }> | null } | null>
}) {
  if (typeof response.output_text === 'string' && response.output_text.trim()) {
    return response.output_text.trim()
  }

  const chunks: string[] = []
  for (const item of response.output ?? []) {
    for (const part of item?.content ?? []) {
      if (typeof part?.text === 'string' && part.text.trim()) {
        chunks.push(part.text.trim())
      }
    }
  }

  return chunks.join('\n').trim()
}

async function callLeadershipDiagnosisAiCoachingModel(params: {
  system: string
  user: string
}): Promise<UpwardReviewAICoachingResult> {
  const env = readAiAssistEnv()

  if (!env.enabled || !env.apiKey) {
    throw new AppError(503, 'AI_PROVIDER_UNAVAILABLE', 'AI 코칭 설정이 완료되지 않았습니다.')
  }

  const response = await fetch(`${env.baseUrl}/responses`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: env.model,
      input: [
        {
          role: 'system',
          content: [{ type: 'input_text', text: params.system }],
        },
        {
          role: 'user',
          content: [{ type: 'input_text', text: params.user }],
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'leadership_diagnosis_ai_coaching',
          schema: LEADERSHIP_DIAGNOSIS_AI_COACHING_SCHEMA,
          strict: true,
        },
      },
    }),
  })

  if (!response.ok) {
    throw new AppError(response.status, 'AI_REQUEST_FAILED', 'AI 코칭 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.')
  }

  const json = (await response.json()) as JsonRecord
  const responseText = extractResponseText(json as never)
  if (!responseText) {
    throw new AppError(502, 'AI_EMPTY_RESPONSE', 'AI 코칭 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(responseText)
  } catch {
    throw new AppError(502, 'AI_INVALID_JSON', 'AI 코칭 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.')
  }

  try {
    return validateLeadershipDiagnosisAiCoachingResult(parsed)
  } catch {
    throw new AppError(502, 'AI_INVALID_SCHEMA', 'AI 코칭 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.')
  }
}

export async function generateUpwardReviewAiCoaching(
  params: GenerateParams
): Promise<UpwardReviewAICoachingPreview> {
  const pageData = await getUpwardReviewPageData({
    session: params.session,
    mode: 'results',
    cycleId: params.cycleId,
    roundId: params.roundId,
    empId: params.empId,
    skipResultsAuditLog: true,
  })

  if (pageData.state === 'permission-denied') {
    throw new AppError(403, 'FORBIDDEN', '리더십 진단 결과를 확인할 권한이 없습니다.')
  }

  if (pageData.state !== 'ready' || !pageData.results) {
    throw new AppError(404, 'UPWARD_RESULTS_NOT_FOUND', '리더십 진단 결과 데이터를 찾을 수 없습니다.')
  }

  const results = pageData.results
  if (!results.visible && !results.canViewRaw) {
    throw new AppError(403, 'UPWARD_RESULTS_HIDDEN', results.hiddenReason ?? '공개된 리더십 진단 결과만 AI 코칭을 생성할 수 있습니다.')
  }

  if (!results.thresholdMet || results.feedbackCount < results.minRaters) {
    throw new AppError(409, 'ANONYMITY_THRESHOLD_NOT_MET', '응답 수와 익명 기준이 충족되면 AI 코칭을 생성할 수 있습니다.')
  }

  if (!results.questionSummaries.length) {
    throw new AppError(422, 'UPWARD_RESULTS_EMPTY', '리더십 진단 결과 데이터가 더 쌓이면 AI 코칭을 생성할 수 있습니다.')
  }

  const input = buildLeadershipDiagnosisAiCoachingPromptInput(results)
  const prompt = buildLeadershipDiagnosisAiCoachingPrompt(input)
  const result = await callLeadershipDiagnosisAiCoachingModel(prompt)

  return {
    generatedAt: new Date().toISOString(),
    mode: params.mode ?? 'SELF',
    result,
    source: {
      responseCount: input.responseCount,
      anonymityThreshold: input.anonymityThreshold,
      anonymitySatisfied: input.anonymitySatisfied,
      categoryCount: input.categorySummary.length,
      commentSummaryCount: input.commentSummary.length,
    },
    disclaimer: 'AI 코칭은 참고용 성장 인사이트이며 공식 평가 점수나 등급을 자동 산정하지 않습니다.',
  }
}
