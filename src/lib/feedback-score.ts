import type { QuestionType } from '@prisma/client'

export function calculateFeedbackResponseTotalScore(params: {
  responses: Array<{
    ratingValue?: number | null
    question?: {
      questionType?: QuestionType | string | null
    }
  }>
}) {
  const numericRatings = params.responses
    .filter(
      (response) =>
        (response.question?.questionType === 'RATING_SCALE' || !response.question?.questionType) &&
        typeof response.ratingValue === 'number'
    )
    .map((response) => response.ratingValue as number)

  if (!numericRatings.length) return null

  const average = numericRatings.reduce((sum, value) => sum + value, 0) / numericRatings.length
  return Math.round(average * 20 * 10) / 10
}
