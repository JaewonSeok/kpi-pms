import { readExecutivePerformanceBriefingEnv } from '@/lib/ai-env'
import {
  buildExecutivePerformanceBriefingPrompt,
  EXECUTIVE_PERFORMANCE_BRIEFING_RESPONSE_FORMAT,
  EXECUTIVE_PERFORMANCE_BRIEFING_SYSTEM_PROMPT,
  ExecutivePerformanceBriefingSchema,
  type ExecutivePerformanceBriefing,
  type ExecutivePerformanceBriefingInput,
} from '@/lib/ai/executive-performance-briefing-prompt'
import { AppError } from '@/lib/utils'

type JsonRecord = Record<string, unknown>

type ResponsesApiEnvelope = {
  output_text?: string | null
  output?: Array<{ content?: Array<{ text?: string | null }> | null } | null>
  usage?: {
    input_tokens?: number
    output_tokens?: number
  }
  model?: string
  status?: string
}

type FetchLike = typeof fetch

export type ExecutivePerformanceBriefingOpenAIResult = {
  result: ExecutivePerformanceBriefing
  model: string
  inputTokens: number
  outputTokens: number
  estimatedCostUsd: number
}

function estimateResponsesCostUsd(params: { inputTokens: number; outputTokens: number }) {
  const inputRate = Number(process.env.OPENAI_INPUT_COST_PER_1M ?? 0)
  const outputRate = Number(process.env.OPENAI_OUTPUT_COST_PER_1M ?? 0)
  const total =
    (Math.max(params.inputTokens, 0) / 1_000_000) * inputRate +
    (Math.max(params.outputTokens, 0) / 1_000_000) * outputRate

  return Math.round(total * 1_000_000) / 1_000_000
}

function extractResponseText(response: ResponsesApiEnvelope) {
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

export async function requestExecutivePerformanceBriefingFromOpenAI(
  input: ExecutivePerformanceBriefingInput,
  options?: {
    env?: Record<string, string | undefined>
    fetcher?: FetchLike
  }
): Promise<ExecutivePerformanceBriefingOpenAIResult> {
  const env = readExecutivePerformanceBriefingEnv(options?.env)
  if (!env.apiKey) {
    throw new AppError(503, 'AI_API_KEY_MISSING', 'OPENAI_API_KEY is not configured.')
  }

  const prompt = buildExecutivePerformanceBriefingPrompt(input)
  const fetcher = options?.fetcher ?? fetch

  const response = await fetcher(`${env.baseUrl}/responses`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: env.briefingModel,
      input: [
        {
          role: 'system',
          content: [{ type: 'input_text', text: EXECUTIVE_PERFORMANCE_BRIEFING_SYSTEM_PROMPT }],
        },
        {
          role: 'user',
          content: [{ type: 'input_text', text: prompt }],
        },
      ],
      text: {
        format: EXECUTIVE_PERFORMANCE_BRIEFING_RESPONSE_FORMAT,
      },
    }),
  })

  const json = (await response.json()) as JsonRecord
  if (!response.ok) {
    const errorMessage =
      typeof (json.error as JsonRecord | undefined)?.message === 'string'
        ? String((json.error as JsonRecord).message)
        : 'OpenAI Responses API request failed.'
    throw new AppError(response.status, 'AI_REQUEST_FAILED', errorMessage)
  }

  const responseEnvelope = json as ResponsesApiEnvelope
  const responseText = extractResponseText(responseEnvelope)
  if (!responseText) {
    if (responseEnvelope.status === 'incomplete') {
      throw new AppError(502, 'AI_INCOMPLETE_RESPONSE', 'OpenAI response was incomplete.')
    }
    throw new AppError(502, 'AI_EMPTY_RESPONSE', 'OpenAI response did not include structured output.')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(responseText)
  } catch {
    throw new AppError(502, 'AI_INVALID_JSON', 'OpenAI response JSON could not be parsed.')
  }

  const validated = ExecutivePerformanceBriefingSchema.safeParse(parsed)
  if (!validated.success) {
    throw new AppError(502, 'AI_INVALID_SHAPE', 'OpenAI response did not match the expected schema.')
  }

  const inputTokens = Number(responseEnvelope.usage?.input_tokens ?? 0)
  const outputTokens = Number(responseEnvelope.usage?.output_tokens ?? 0)

  return {
    result: validated.data,
    model: typeof responseEnvelope.model === 'string' ? responseEnvelope.model : env.briefingModel,
    inputTokens,
    outputTokens,
    estimatedCostUsd: estimateResponsesCostUsd({ inputTokens, outputTokens }),
  }
}
