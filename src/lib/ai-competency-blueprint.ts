import type {
  AiCompetencyDifficulty,
  AiCompetencyDomain,
  AiCompetencyQuestionType,
  AiCompetencyTrack,
} from '@prisma/client'

export type AiCompetencyBlueprintScope = 'COMMON' | 'TRACK_SPECIFIC'

export type AiCompetencyBlueprintDefinition = {
  blueprintName: string
  blueprintVersion: number
  track?: AiCompetencyTrack | null
  totalQuestionCount: number
  totalPoints: number
  timeLimitMinutes: number
  passScore: number
  randomizationEnabled: boolean
}

export type AiCompetencyBlueprintRowDefinition = {
  id?: string
  competencyDomain: AiCompetencyDomain
  itemType: AiCompetencyQuestionType
  difficulty: AiCompetencyDifficulty
  requiredQuestionCount: number
  pointsPerQuestion: number
  scope: AiCompetencyBlueprintScope
  requiredTags?: string[]
  excludedTags?: string[]
  displayOrder: number
}

export type AiCompetencyBlueprintQuestion = {
  id: string
  competencyDomain: AiCompetencyDomain
  questionType: AiCompetencyQuestionType
  difficulty: AiCompetencyDifficulty
  track?: AiCompetencyTrack | null
  isCommon: boolean
  isActive: boolean
  maxScore: number
  sortOrder?: number
  tags?: string[]
}

export type AiCompetencyBlueprintValidation = {
  isValid: boolean
  totalQuestionCount: number
  totalPoints: number
  errors: string[]
}

export type AiCompetencyBlueprintGapRow = {
  rowIndex: number
  scope: AiCompetencyBlueprintScope
  competencyDomain: AiCompetencyDomain
  itemType: AiCompetencyQuestionType
  difficulty: AiCompetencyDifficulty
  requiredQuestionCount: number
  availableQuestionCount: number
  shortageCount: number
}

export type AiCompetencyBlueprintGapAnalysis = {
  canAssemble: boolean
  shortageCount: number
  rows: AiCompetencyBlueprintGapRow[]
}

function roundScore(value: number) {
  return Math.round(value * 10) / 10
}

function toSortedTags(tags?: string[]) {
  return (tags ?? [])
    .map((tag) => tag.trim())
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right))
}

function deterministicShuffle<T>(items: T[], seed: string) {
  const cloned = [...items]
  let state = seed.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) || 1
  const next = () => {
    state = (state * 48271) % 2147483647
    return state / 2147483647
  }
  for (let index = cloned.length - 1; index > 0; index -= 1) {
    const target = Math.floor(next() * (index + 1))
    ;[cloned[index], cloned[target]] = [cloned[target], cloned[index]]
  }
  return cloned
}

function buildRowSignature(row: AiCompetencyBlueprintRowDefinition) {
  return JSON.stringify({
    competencyDomain: row.competencyDomain,
    itemType: row.itemType,
    difficulty: row.difficulty,
    scope: row.scope,
    requiredTags: toSortedTags(row.requiredTags),
    excludedTags: toSortedTags(row.excludedTags),
    pointsPerQuestion: roundScore(row.pointsPerQuestion),
  })
}

function hasAllRequiredTags(questionTags: string[], requiredTags: string[]) {
  return requiredTags.every((tag) => questionTags.includes(tag))
}

function hasExcludedTag(questionTags: string[], excludedTags: string[]) {
  return excludedTags.some((tag) => questionTags.includes(tag))
}

export function matchBlueprintRowToQuestion(params: {
  row: AiCompetencyBlueprintRowDefinition
  question: AiCompetencyBlueprintQuestion
  track?: AiCompetencyTrack | null
}) {
  const { row, question } = params
  if (!question.isActive) return false
  if (question.competencyDomain !== row.competencyDomain) return false
  if (question.questionType !== row.itemType) return false
  if (question.difficulty !== row.difficulty) return false
  if (roundScore(question.maxScore) !== roundScore(row.pointsPerQuestion)) return false

  if (row.scope === 'COMMON') {
    if (!question.isCommon) return false
  } else if (question.track !== params.track) {
    return false
  }

  const questionTags = toSortedTags(question.tags)
  const requiredTags = toSortedTags(row.requiredTags)
  const excludedTags = toSortedTags(row.excludedTags)

  if (requiredTags.length && !hasAllRequiredTags(questionTags, requiredTags)) {
    return false
  }
  if (excludedTags.length && hasExcludedTag(questionTags, excludedTags)) {
    return false
  }

  return true
}

export function validateBlueprintDefinition(params: {
  blueprint: AiCompetencyBlueprintDefinition
  rows: AiCompetencyBlueprintRowDefinition[]
}) {
  const errors: string[] = []
  if (!params.rows.length) {
    errors.push('체계표 행을 최소 1개 이상 등록해 주세요.')
  }

  const totalQuestionCount = params.rows.reduce((sum, row) => sum + row.requiredQuestionCount, 0)
  const totalPoints = roundScore(
    params.rows.reduce((sum, row) => sum + row.requiredQuestionCount * row.pointsPerQuestion, 0)
  )

  if (totalQuestionCount !== params.blueprint.totalQuestionCount) {
    errors.push('행별 문항 수 합계가 체계표 총 문항 수와 일치하지 않습니다.')
  }

  if (Math.abs(totalPoints - roundScore(params.blueprint.totalPoints)) > 0.01) {
    errors.push('행별 배점 합계가 체계표 총점과 일치하지 않습니다.')
  }

  if (params.blueprint.passScore > params.blueprint.totalPoints) {
    errors.push('합격 기준은 총점을 초과할 수 없습니다.')
  }

  if (params.blueprint.track && params.rows.some((row) => row.scope === 'COMMON')) {
    errors.push('트랙 전용 체계표에는 공통 문항 행을 포함할 수 없습니다.')
  }

  if (!params.blueprint.track && params.rows.some((row) => row.scope === 'TRACK_SPECIFIC')) {
    errors.push('공통 체계표에는 트랙 전용 문항 행을 포함할 수 없습니다.')
  }

  const signatureSet = new Set<string>()
  params.rows.forEach((row, index) => {
    if (row.requiredQuestionCount <= 0) {
      errors.push(`${index + 1}행의 필요 문항 수는 1개 이상이어야 합니다.`)
    }
    if (row.pointsPerQuestion <= 0) {
      errors.push(`${index + 1}행의 문항당 배점은 0보다 커야 합니다.`)
    }
    const signature = buildRowSignature(row)
    if (signatureSet.has(signature)) {
      errors.push(`${index + 1}행과 동일한 문항 분포 조건이 중복되어 있습니다.`)
    }
    signatureSet.add(signature)
  })

  return {
    isValid: errors.length === 0,
    totalQuestionCount,
    totalPoints,
    errors,
  } satisfies AiCompetencyBlueprintValidation
}

export function analyzeBlueprintQuestionPool(params: {
  blueprint: AiCompetencyBlueprintDefinition
  rows: AiCompetencyBlueprintRowDefinition[]
  questions: AiCompetencyBlueprintQuestion[]
}) {
  const rows = params.rows.map((row, index) => {
    const availableQuestionCount = params.questions.filter((question) =>
      matchBlueprintRowToQuestion({
        row,
        question,
        track: params.blueprint.track,
      })
    ).length
    const shortageCount = Math.max(row.requiredQuestionCount - availableQuestionCount, 0)
    return {
      rowIndex: index,
      scope: row.scope,
      competencyDomain: row.competencyDomain,
      itemType: row.itemType,
      difficulty: row.difficulty,
      requiredQuestionCount: row.requiredQuestionCount,
      availableQuestionCount,
      shortageCount,
    }
  })

  return {
    canAssemble: rows.every((row) => row.shortageCount === 0),
    shortageCount: rows.reduce((sum, row) => sum + row.shortageCount, 0),
    rows,
  } satisfies AiCompetencyBlueprintGapAnalysis
}

export function assembleExamFromBlueprint(params: {
  blueprints: Array<{
    blueprint: AiCompetencyBlueprintDefinition & { id: string }
    rows: AiCompetencyBlueprintRowDefinition[]
  }>
  questions: AiCompetencyBlueprintQuestion[]
  seed: string
}) {
  const selectedQuestions: AiCompetencyBlueprintQuestion[] = []
  const selectedIds = new Set<string>()
  const blueprintSnapshot: Array<{
    blueprintId: string
    blueprintName: string
    track?: AiCompetencyTrack | null
    rowCount: number
  }> = []

  const orderedBlueprints = [...params.blueprints].sort((left, right) => {
    if (left.blueprint.track && !right.blueprint.track) return 1
    if (!left.blueprint.track && right.blueprint.track) return -1
    return left.blueprint.blueprintVersion - right.blueprint.blueprintVersion
  })

  for (const item of orderedBlueprints) {
    blueprintSnapshot.push({
      blueprintId: item.blueprint.id,
      blueprintName: item.blueprint.blueprintName,
      track: item.blueprint.track,
      rowCount: item.rows.length,
    })

    const rows = [...item.rows].sort((left, right) => left.displayOrder - right.displayOrder)
    for (const [rowIndex, row] of rows.entries()) {
      const candidates = params.questions
        .filter((question) => !selectedIds.has(question.id))
        .filter((question) =>
          matchBlueprintRowToQuestion({
            row,
            question,
            track: item.blueprint.track,
          })
        )

      const orderedCandidates = item.blueprint.randomizationEnabled
        ? deterministicShuffle(candidates, `${params.seed}:${item.blueprint.id}:${rowIndex}`)
        : [...candidates].sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0))

      if (orderedCandidates.length < row.requiredQuestionCount) {
        throw new Error(
          `${item.blueprint.blueprintName} ${rowIndex + 1}행의 문항 풀이 부족합니다. 필요 ${row.requiredQuestionCount}개, 확보 ${orderedCandidates.length}개`
        )
      }

      orderedCandidates.slice(0, row.requiredQuestionCount).forEach((question) => {
        selectedIds.add(question.id)
        selectedQuestions.push(question)
      })
    }
  }

  return {
    questionIds: selectedQuestions.map((question) => question.id),
    questions: selectedQuestions,
    totalQuestionCount: selectedQuestions.length,
    totalPoints: roundScore(selectedQuestions.reduce((sum, question) => sum + question.maxScore, 0)),
    blueprintSnapshot,
  }
}
