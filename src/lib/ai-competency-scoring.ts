import type { AiCompetencyGrade, AiCompetencyQuestionType, Prisma } from '@prisma/client'

function roundScore(value: number) {
  return Math.round(value * 10) / 10
}

function clampScore(value: number, min = 0, max = 100) {
  return Math.min(Math.max(value, min), max)
}

function normalizeAnswerPayload(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item))
  }
  if (value && typeof value === 'object') {
    return value as Record<string, unknown>
  }
  if (value === null || value === undefined) return null
  return String(value)
}

export function calculateAiCompetencyFinalScore(params: {
  firstRoundScore?: number | null
  externalCertMappedScore?: number | null
  secondRoundBonus?: number | null
  cap?: number | null
  overrideScore?: number | null
}) {
  const cap = params.cap ?? 100
  if (typeof params.overrideScore === 'number') {
    return clampScore(roundScore(params.overrideScore), 0, cap)
  }
  const base = Math.max(params.firstRoundScore ?? 0, params.externalCertMappedScore ?? 0)
  return clampScore(roundScore(base + (params.secondRoundBonus ?? 0)), 0, cap)
}

export function calculateAiCompetencyGrade(params: {
  finalScore: number
  secondRoundPassed: boolean
}): AiCompetencyGrade {
  if (params.finalScore >= 95 && params.secondRoundPassed) return 'S'
  if (params.finalScore >= 85) return 'A'
  if (params.finalScore >= 75) return 'B'
  if (params.finalScore >= 65) return 'C'
  return 'D'
}

export function scoreObjectiveQuestion(params: {
  questionType: AiCompetencyQuestionType
  answerKey: Prisma.JsonValue | null | undefined
  answerPayload: Prisma.JsonValue | null | undefined
  maxScore: number
}) {
  const normalizedAnswer = normalizeAnswerPayload(params.answerPayload)
  const normalizedKey = normalizeAnswerPayload(params.answerKey)
  if (normalizedAnswer === null || normalizedAnswer === undefined) {
    return { isCorrect: false, score: 0 }
  }
  if (params.questionType === 'SHORT_ANSWER' || params.questionType === 'PRACTICAL') {
    return { isCorrect: undefined, score: null as number | null }
  }
  if (params.questionType === 'MULTIPLE_CHOICE') {
    const answerSet = Array.isArray(normalizedAnswer) ? [...normalizedAnswer].sort() : [String(normalizedAnswer)]
    const keySet = Array.isArray(normalizedKey) ? [...normalizedKey].sort() : [String(normalizedKey)]
    const isCorrect = JSON.stringify(answerSet) === JSON.stringify(keySet)
    return { isCorrect, score: isCorrect ? params.maxScore : 0 }
  }
  const isCorrect = String(normalizedAnswer) === String(normalizedKey)
  return { isCorrect, score: isCorrect ? params.maxScore : 0 }
}

export function canApplyForSecondRound(params: {
  firstRoundScore?: number | null
  passThreshold: number
  passStatus?: string | null
}) {
  if (params.passStatus === 'MANUAL_REVIEW_REQUIRED') return false
  return (params.firstRoundScore ?? 0) >= params.passThreshold && params.passStatus === 'PASSED'
}
