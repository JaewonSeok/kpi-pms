import type { AiCompetencyTrack } from '@prisma/client'

export type AiCompetencyRubricDefinition = {
  rubricName: string
  rubricVersion: number
  track?: AiCompetencyTrack | null
  totalScore: number
  passScore: number
  bonusScoreIfPassed: number
  certificationLabel?: string | null
}

export type AiCompetencyRubricBandDefinition = {
  id?: string
  score: number
  title: string
  description?: string
  guidance?: string
  displayOrder: number
}

export type AiCompetencyRubricCriterionDefinition = {
  id?: string
  criterionCode: string
  criterionName: string
  criterionDescription?: string
  maxScore: number
  displayOrder: number
  mandatory: boolean
  knockout: boolean
  bands: AiCompetencyRubricBandDefinition[]
}

export type AiCompetencyReviewCriterionInput = {
  criterionId: string
  score: number
  comment?: string
  knockoutTriggered?: boolean
}

function roundScore(value: number) {
  return Math.round(value * 10) / 10
}

export function validateRubricDefinition(params: {
  rubric: AiCompetencyRubricDefinition
  criteria: AiCompetencyRubricCriterionDefinition[]
}) {
  const errors: string[] = []
  if (!params.criteria.length) {
    errors.push('루브릭 기준을 최소 1개 이상 등록해 주세요.')
  }

  const totalScore = roundScore(params.criteria.reduce((sum, criterion) => sum + criterion.maxScore, 0))
  if (Math.abs(totalScore - roundScore(params.rubric.totalScore)) > 0.01) {
    errors.push('기준별 배점 합계가 루브릭 총점과 일치하지 않습니다.')
  }

  if (params.rubric.passScore > params.rubric.totalScore) {
    errors.push('합격 기준은 총점을 초과할 수 없습니다.')
  }

  const criterionCodes = new Set<string>()
  params.criteria.forEach((criterion, index) => {
    if (criterionCodes.has(criterion.criterionCode)) {
      errors.push(`${index + 1}행의 기준 코드가 중복되어 있습니다.`)
    }
    criterionCodes.add(criterion.criterionCode)

    if (criterion.maxScore <= 0) {
      errors.push(`${index + 1}행의 배점은 0보다 커야 합니다.`)
    }

    const bandScores = new Set<number>()
    criterion.bands.forEach((band, bandIndex) => {
      if (band.score < 0 || band.score > criterion.maxScore) {
        errors.push(`${criterion.criterionName}의 ${bandIndex + 1}번째 점수 밴드가 배점 범위를 벗어났습니다.`)
      }
      if (bandScores.has(band.score)) {
        errors.push(`${criterion.criterionName}의 점수 밴드 점수가 중복되어 있습니다.`)
      }
      bandScores.add(band.score)
    })
  })

  return {
    isValid: errors.length === 0,
    totalScore,
    errors,
  }
}

export function calculateRubricReview(params: {
  rubric: AiCompetencyRubricDefinition
  criteria: AiCompetencyRubricCriterionDefinition[]
  criterionScores: AiCompetencyReviewCriterionInput[]
  decision?: 'PASS' | 'FAIL' | 'REVISE'
  submitFinal: boolean
}) {
  const errors: string[] = []
  const criteriaById = new Map(
    params.criteria.map((criterion) => [criterion.id ?? criterion.criterionCode, criterion] as const)
  )
  const scoreByCriterion = new Map(params.criterionScores.map((row) => [row.criterionId, row]))

  if (params.submitFinal) {
    params.criteria.forEach((criterion) => {
      const criterionId = criterion.id ?? criterion.criterionCode
      if (criterion.mandatory && !scoreByCriterion.has(criterionId)) {
        errors.push(`${criterion.criterionName} 점수를 입력해 주세요.`)
      }
    })
  }

  let totalScore = 0
  let knockoutTriggered = false

  params.criterionScores.forEach((row) => {
    const criterion = criteriaById.get(row.criterionId)
    if (!criterion) {
      errors.push('알 수 없는 루브릭 기준 점수가 포함되어 있습니다.')
      return
    }
    if (row.score < 0 || row.score > criterion.maxScore) {
      errors.push(`${criterion.criterionName} 점수가 배점 범위를 벗어났습니다.`)
    }
    totalScore += row.score
    if (criterion.knockout && row.knockoutTriggered) {
      knockoutTriggered = true
    }
  })

  totalScore = roundScore(totalScore)

  if (params.submitFinal) {
    if (!params.decision) {
      errors.push('최종 제출 시 판정을 선택해 주세요.')
    }
    if (params.decision === 'PASS' && totalScore < params.rubric.passScore) {
      errors.push('합격 판정은 루브릭 합격 기준 이상일 때만 선택할 수 있습니다.')
    }
    if (params.decision === 'PASS' && knockoutTriggered) {
      errors.push('자동 탈락 조건이 체크된 경우 합격 판정을 할 수 없습니다.')
    }
    if (params.decision === 'REVISE' && knockoutTriggered) {
      errors.push('자동 탈락 조건이 체크된 경우 재검토 필요 대신 불합격으로 처리해 주세요.')
    }
  }

  const decision =
    knockoutTriggered ? 'FAIL' : params.decision ?? (totalScore >= params.rubric.passScore ? 'PASS' : 'REVISE')

  const bonusScore =
    params.submitFinal && decision === 'PASS' && totalScore >= params.rubric.passScore
      ? params.rubric.bonusScoreIfPassed
      : 0

  return {
    isValid: errors.length === 0,
    errors,
    totalScore,
    knockoutTriggered,
    decision,
    bonusScore,
    passed: decision === 'PASS' && totalScore >= params.rubric.passScore && !knockoutTriggered,
  }
}
