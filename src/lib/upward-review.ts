import type {
  FeedbackRoundStatus,
  FeedbackStatus,
  QuestionType,
  RaterRelationship,
  SystemRole,
} from '@prisma/client'

export const UPWARD_TARGET_TYPE_VALUES = [
  'TEAM_LEADER',
  'SECTION_CHIEF',
  'DIVISION_HEAD',
  'PM',
  'CUSTOM',
] as const

export type UpwardTargetType = (typeof UPWARD_TARGET_TYPE_VALUES)[number]

export const UPWARD_RESULT_VIEWER_MODES = ['TARGET_ONLY', 'TARGET_AND_PRIMARY_MANAGER'] as const
export type UpwardResultViewerMode = (typeof UPWARD_RESULT_VIEWER_MODES)[number]

export const UPWARD_RAW_RESPONSE_POLICIES = ['ADMIN_ONLY', 'REVIEW_ADMIN_CONTENT'] as const
export type UpwardRawResponsePolicy = (typeof UPWARD_RAW_RESPONSE_POLICIES)[number]

export type UpwardReviewSettings = {
  templateId: string | null
  templateName: string | null
  targetTypes: UpwardTargetType[]
  assignmentMode: 'MANUAL' | 'AUTO_SUGGESTED'
  resultReleasedAt: string | null
  resultReleasedById: string | null
  resultViewerMode: UpwardResultViewerMode
  rawResponsePolicy: UpwardRawResponsePolicy
}

export const DEFAULT_UPWARD_REVIEW_SETTINGS: UpwardReviewSettings = {
  templateId: null,
  templateName: null,
  targetTypes: ['TEAM_LEADER'],
  assignmentMode: 'MANUAL',
  resultReleasedAt: null,
  resultReleasedById: null,
  resultViewerMode: 'TARGET_ONLY',
  rawResponsePolicy: 'ADMIN_ONLY',
}

export const UPWARD_TARGET_TYPE_LABELS: Record<UpwardTargetType, string> = {
  TEAM_LEADER: '팀장',
  SECTION_CHIEF: '실장',
  DIVISION_HEAD: '본부장/부문장',
  PM: 'PM',
  CUSTOM: '직접 지정',
}

export const UPWARD_ASSIGNMENT_STATUS_LABELS: Record<FeedbackStatus, string> = {
  PENDING: '예정',
  IN_PROGRESS: '진행중',
  SUBMITTED: '제출완료',
}

export const UPWARD_ROUND_STATUS_LABELS: Record<FeedbackRoundStatus, string> = {
  DRAFT: '초안',
  RATER_SELECTION: '준비중',
  IN_PROGRESS: '진행중',
  COMPLETED: '마감',
  CLOSED: '종료',
  CANCELLED: '취소',
}

export const UPWARD_RELATIONSHIP_OPTIONS: Array<{
  value: Extract<RaterRelationship, 'SUBORDINATE' | 'PEER' | 'CROSS_DEPT'>
  label: string
  description: string
}> = [
  {
    value: 'SUBORDINATE',
    label: '상향 평가',
    description: '구성원이 현재 리더를 평가하는 일반적인 상향 평가입니다.',
  },
  {
    value: 'PEER',
    label: '동료 리더 평가',
    description: '프로젝트성 리더십이나 PM 운영을 동료 관점에서 평가합니다.',
  },
  {
    value: 'CROSS_DEPT',
    label: '교차 조직 평가',
    description: '협업 부서 관점에서 리더십을 평가합니다.',
  },
]

type RecordLike = Record<string, unknown>

function asRecord(value: unknown): RecordLike | null {
  return value && typeof value === 'object' ? (value as RecordLike) : null
}

export function parseUpwardReviewSettings(value: unknown): UpwardReviewSettings {
  const record = asRecord(value)
  if (!record) return DEFAULT_UPWARD_REVIEW_SETTINGS

  const targetTypes = Array.isArray(record.targetTypes)
    ? record.targetTypes.filter(
        (item): item is UpwardTargetType =>
          typeof item === 'string' &&
          (UPWARD_TARGET_TYPE_VALUES as readonly string[]).includes(item)
      )
    : []

  const resultViewerMode =
    record.resultViewerMode === 'TARGET_AND_PRIMARY_MANAGER'
      ? 'TARGET_AND_PRIMARY_MANAGER'
      : DEFAULT_UPWARD_REVIEW_SETTINGS.resultViewerMode

  const rawResponsePolicy =
    record.rawResponsePolicy === 'REVIEW_ADMIN_CONTENT'
      ? 'REVIEW_ADMIN_CONTENT'
      : DEFAULT_UPWARD_REVIEW_SETTINGS.rawResponsePolicy

  return {
    templateId: typeof record.templateId === 'string' && record.templateId.trim() ? record.templateId : null,
    templateName:
      typeof record.templateName === 'string' && record.templateName.trim() ? record.templateName.trim() : null,
    targetTypes: targetTypes.length ? targetTypes : DEFAULT_UPWARD_REVIEW_SETTINGS.targetTypes,
    assignmentMode:
      record.assignmentMode === 'AUTO_SUGGESTED' ? 'AUTO_SUGGESTED' : DEFAULT_UPWARD_REVIEW_SETTINGS.assignmentMode,
    resultReleasedAt:
      typeof record.resultReleasedAt === 'string' && record.resultReleasedAt.trim()
        ? record.resultReleasedAt
        : null,
    resultReleasedById:
      typeof record.resultReleasedById === 'string' && record.resultReleasedById.trim()
        ? record.resultReleasedById
        : null,
    resultViewerMode,
    rawResponsePolicy,
  }
}

export function serializeUpwardReviewSettings(settings: Partial<UpwardReviewSettings>) {
  return {
    ...DEFAULT_UPWARD_REVIEW_SETTINGS,
    ...settings,
    targetTypes:
      settings.targetTypes?.length ? settings.targetTypes.filter(Boolean) : DEFAULT_UPWARD_REVIEW_SETTINGS.targetTypes,
  }
}

export function parseChoiceOptions(value: unknown) {
  if (!Array.isArray(value)) return [] as string[]
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
}

export type UpwardDirectoryEmployee = {
  id: string
  empName: string
  role: SystemRole
  position: string
  deptId: string
  deptName: string
  jobTitle?: string | null
  teamName?: string | null
  teamLeaderId?: string | null
  sectionChiefId?: string | null
  divisionHeadId?: string | null
}

export function getUpwardTargetType(employee: Pick<UpwardDirectoryEmployee, 'role' | 'jobTitle'>): UpwardTargetType | null {
  if (employee.role === 'ROLE_TEAM_LEADER') return 'TEAM_LEADER'
  if (employee.role === 'ROLE_SECTION_CHIEF') return 'SECTION_CHIEF'
  if (employee.role === 'ROLE_DIV_HEAD' || employee.role === 'ROLE_CEO') return 'DIVISION_HEAD'
  if (typeof employee.jobTitle === 'string' && /(^|\s)pm(\s|$)|프로덕트 매니저|프로젝트 매니저/i.test(employee.jobTitle)) {
    return 'PM'
  }
  return null
}

export function getPrimaryLeaderId(employee: Pick<UpwardDirectoryEmployee, 'teamLeaderId' | 'sectionChiefId' | 'divisionHeadId'>) {
  return employee.teamLeaderId ?? employee.sectionChiefId ?? employee.divisionHeadId ?? null
}

export function validateUpwardAssignment(params: {
  evaluator: Pick<UpwardDirectoryEmployee, 'id' | 'empName' | 'teamLeaderId' | 'sectionChiefId' | 'divisionHeadId'>
  evaluatee: Pick<UpwardDirectoryEmployee, 'id' | 'empName'>
  relationship: Extract<RaterRelationship, 'SUBORDINATE' | 'PEER' | 'CROSS_DEPT'>
}) {
  if (params.evaluator.id === params.evaluatee.id) {
    return '자기 자신을 상향 평가 대상으로 지정할 수 없습니다.'
  }

  if (params.relationship === 'SUBORDINATE') {
    const leaderIds = [
      params.evaluator.teamLeaderId,
      params.evaluator.sectionChiefId,
      params.evaluator.divisionHeadId,
    ].filter((item): item is string => Boolean(item))

    if (!leaderIds.includes(params.evaluatee.id)) {
      return '상향 평가 관계에서는 평가자의 현재 리더만 대상으로 지정할 수 있습니다. PM 또는 교차 조직 평가는 다른 관계 유형을 선택해 주세요.'
    }
  }

  return null
}

export type UpwardSuggestion = {
  evaluatorId: string
  evaluateeId: string
  relationship: Extract<RaterRelationship, 'SUBORDINATE' | 'PEER' | 'CROSS_DEPT'>
  reason: string
}

export function buildUpwardSuggestions(params: {
  employees: UpwardDirectoryEmployee[]
  targetTypes: UpwardTargetType[]
  evaluateeId?: string | null
  existingPairs?: Array<{ evaluatorId: string; evaluateeId: string }>
}) {
  const existingPairKeys = new Set(
    (params.existingPairs ?? []).map((item) => `${item.evaluatorId}:${item.evaluateeId}`)
  )
  const selectedTargetIds = params.evaluateeId ? new Set([params.evaluateeId]) : null
  const suggestions: UpwardSuggestion[] = []

  for (const evaluatee of params.employees) {
    if (selectedTargetIds && !selectedTargetIds.has(evaluatee.id)) continue

    const targetType = getUpwardTargetType(evaluatee)
    if (!targetType || !params.targetTypes.includes(targetType)) continue

    for (const evaluator of params.employees) {
      if (evaluator.id === evaluatee.id) continue

      if (targetType === 'PM') {
        if (
          typeof evaluator.jobTitle === 'string' &&
          typeof evaluatee.teamName === 'string' &&
          evaluator.teamName === evaluatee.teamName &&
          !existingPairKeys.has(`${evaluator.id}:${evaluatee.id}`)
        ) {
          suggestions.push({
            evaluatorId: evaluator.id,
            evaluateeId: evaluatee.id,
            relationship: 'PEER',
            reason: `${evaluatee.empName} PM과 같은 팀에서 협업하는 구성원`,
          })
        }
        continue
      }

      const directLeaderIds = [evaluator.teamLeaderId, evaluator.sectionChiefId, evaluator.divisionHeadId]
      if (directLeaderIds.includes(evaluatee.id) && !existingPairKeys.has(`${evaluator.id}:${evaluatee.id}`)) {
        const relationshipLevel =
          evaluator.teamLeaderId === evaluatee.id
            ? '팀장'
            : evaluator.sectionChiefId === evaluatee.id
              ? '실장'
              : '본부장'
        suggestions.push({
          evaluatorId: evaluator.id,
          evaluateeId: evaluatee.id,
          relationship: 'SUBORDINATE',
          reason: `${evaluator.empName}의 현재 ${relationshipLevel} 리더`,
        })
      }
    }
  }

  return suggestions
}

export type UpwardQuestionSummary = {
  questionId: string
  category: string
  questionText: string
  questionType: QuestionType
  averageScore: number | null
  responseCount: number
  textResponses: string[]
  choiceCounts: Array<{ label: string; count: number }>
}

type SummarizeInput = {
  submittedFeedbacks: Array<{
    giverId: string
    giverName: string
    relationship: RaterRelationship
    overallComment?: string | null
    responses: Array<{
      questionId: string
      ratingValue?: number | null
      textValue?: string | null
      question: {
        questionText: string
        category: string
        questionType: QuestionType
        choiceOptions?: unknown
      }
    }>
  }>
  questions: Array<{
    id: string
    category: string
    questionText: string
    questionType: QuestionType
    choiceOptions?: unknown
  }>
}

export function summarizeUpwardResults(input: SummarizeInput) {
  const questionMap = new Map(
    input.questions.map((question) => [
      question.id,
      {
        questionId: question.id,
        category: question.category,
        questionText: question.questionText,
        questionType: question.questionType,
        ratingValues: [] as number[],
        textResponses: [] as string[],
        choiceCounts: new Map<string, number>(),
        choiceOptions: parseChoiceOptions(question.choiceOptions),
      },
    ])
  )

  const rawResponses = input.submittedFeedbacks.map((feedback) => ({
    giverId: feedback.giverId,
    giverName: feedback.giverName,
    relationship: feedback.relationship,
    overallComment: feedback.overallComment?.trim() ?? '',
    answers: feedback.responses.map((response) => ({
      questionId: response.questionId,
      questionText: response.question.questionText,
      ratingValue: response.ratingValue ?? null,
      textValue: response.textValue?.trim() ?? '',
    })),
  }))

  for (const feedback of input.submittedFeedbacks) {
    for (const response of feedback.responses) {
      const current = questionMap.get(response.questionId)
      if (!current) continue

      if (response.question.questionType === 'RATING_SCALE' && typeof response.ratingValue === 'number') {
        current.ratingValues.push(response.ratingValue)
      }

      if (typeof response.textValue === 'string' && response.textValue.trim()) {
        if (response.question.questionType === 'MULTIPLE_CHOICE') {
          const labels = parseChoiceOptions(
            (() => {
              try {
                return JSON.parse(response.textValue)
              } catch {
                return response.textValue.split(',').map((item) => item.trim())
              }
            })()
          )

          for (const label of labels) {
            current.choiceCounts.set(label, (current.choiceCounts.get(label) ?? 0) + 1)
          }
        } else {
          current.textResponses.push(response.textValue.trim())
        }
      }
    }
  }

  const questionSummaries: UpwardQuestionSummary[] = [...questionMap.values()].map((item) => ({
    questionId: item.questionId,
    category: item.category,
    questionText: item.questionText,
    questionType: item.questionType,
    averageScore: item.ratingValues.length
      ? Math.round((item.ratingValues.reduce((sum, value) => sum + value, 0) / item.ratingValues.length) * 10) / 10
      : null,
    responseCount:
      item.questionType === 'RATING_SCALE'
        ? item.ratingValues.length
        : item.questionType === 'MULTIPLE_CHOICE'
          ? [...item.choiceCounts.values()].reduce((sum, value) => sum + value, 0)
          : item.textResponses.length,
    textResponses: item.textResponses,
    choiceCounts: (item.choiceOptions.length ? item.choiceOptions : [...item.choiceCounts.keys()]).map((label) => ({
      label,
      count: item.choiceCounts.get(label) ?? 0,
    })),
  }))

  const categoryScores = Array.from(
    questionSummaries.reduce((map, question) => {
      if (question.averageScore == null) return map
      const current = map.get(question.category) ?? []
      current.push(question.averageScore)
      map.set(question.category, current)
      return map
    }, new Map<string, number[]>())
  )
    .map(([category, scores]) => ({
      category,
      averageScore: Math.round((scores.reduce((sum, value) => sum + value, 0) / scores.length) * 10) / 10,
    }))
    .sort((a, b) => b.averageScore - a.averageScore)

  const strengths = categoryScores.slice(0, 2).map((item) => `${item.category} 항목이 상대적 강점으로 나타났습니다.`)
  const improvements = categoryScores
    .slice(-2)
    .reverse()
    .map((item) => `${item.category} 항목은 추가 개선이 필요한 신호가 보입니다.`)

  return {
    questionSummaries,
    strengths,
    improvements,
    rawResponses,
  }
}

export function canViewUpwardResults(params: {
  actorId: string
  actorRole: SystemRole
  targetId: string
  targetPrimaryLeaderId?: string | null
  settings: UpwardReviewSettings
  thresholdMet: boolean
  canManage: boolean
  canReadRaw: boolean
}) {
  if (params.canManage || params.canReadRaw) {
    return true
  }

  if (!params.thresholdMet || !params.settings.resultReleasedAt) {
    return false
  }

  if (params.actorId === params.targetId) {
    return true
  }

  return (
    params.settings.resultViewerMode === 'TARGET_AND_PRIMARY_MANAGER' &&
    params.targetPrimaryLeaderId === params.actorId
  )
}
