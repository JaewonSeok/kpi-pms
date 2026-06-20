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

export type UpwardRoundResponseGateReason =
  | 'OPEN'
  | 'ROUND_NOT_STARTED'
  | 'ROUND_ENDED'
  | 'ROUND_CLOSED'
  | 'ROUND_NOT_ACTIVE'

export function getUpwardRoundResponseGate(
  round: {
    status: FeedbackRoundStatus
    startDate: Date | string
    endDate: Date | string
  },
  now = new Date()
): { open: boolean; reason: UpwardRoundResponseGateReason } {
  const startDate = round.startDate instanceof Date ? round.startDate : new Date(round.startDate)
  const endDate = round.endDate instanceof Date ? round.endDate : new Date(round.endDate)

  if (['COMPLETED', 'CLOSED', 'CANCELLED'].includes(round.status)) {
    return { open: false, reason: 'ROUND_CLOSED' }
  }

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return { open: false, reason: 'ROUND_NOT_ACTIVE' }
  }

  if (now > endDate) {
    return { open: false, reason: 'ROUND_ENDED' }
  }

  if (round.status === 'IN_PROGRESS') {
    return { open: true, reason: 'OPEN' }
  }

  if (now < startDate) {
    return { open: false, reason: 'ROUND_NOT_STARTED' }
  }

  return { open: true, reason: 'OPEN' }
}

export const DEFAULT_LEADERSHIP_DIAGNOSIS_QUESTIONS = [
  {
    category: '바른생각 (커뮤니케이션)',
    questionText: '나의 리더는 목표와 요구사항에 대해 명확하고 구체적으로 설명한다.',
  },
  {
    category: '바른생각 (커뮤니케이션)',
    questionText: '나의 리더는 구성원이 자유롭게 의견을 제시할 수 있는 분위기를 조성한다.',
  },
  {
    category: '바른생각 (커뮤니케이션)',
    questionText: '나의 리더는 조직원으로부터 신뢰와 존중을 받고 있다.',
  },
  {
    category: '바른생각 (커뮤니케이션)',
    questionText: '나의 리더는 관심 있는 태도로 구성원의 이야기를 경청한다.',
  },
  {
    category: '바른생각 (커뮤니케이션)',
    questionText: '나의 리더는 필요한 정보를 적시에 공유한다.',
  },
  {
    category: '바른생각 (커뮤니케이션)',
    questionText: '나의 리더는 피드백을 구체적인 행동 기준으로 전달한다.',
  },
  {
    category: '창의도전 (변화주도)',
    questionText: '나의 리더는 새로운 시도를 장려하고 실패에서 학습하도록 돕는다.',
  },
  {
    category: '창의도전 (변화주도)',
    questionText: '나의 리더는 변화가 필요한 이유와 기대 효과를 설득력 있게 설명한다.',
  },
  {
    category: '창의도전 (변화주도)',
    questionText: '나의 리더는 기존 방식에 머무르지 않고 개선 기회를 찾는다.',
  },
  {
    category: '창의도전 (변화주도)',
    questionText: '나의 리더는 구성원이 주도적으로 문제를 해결하도록 권한을 부여한다.',
  },
  {
    category: '창의도전 (변화주도)',
    questionText: '나의 리더는 도전적인 목표를 현실적인 실행 계획으로 연결한다.',
  },
  {
    category: '창의도전 (변화주도)',
    questionText: '나의 리더는 변화 과정에서 발생하는 장애물을 빠르게 조정한다.',
  },
  {
    category: '비전공유 (조직관리)',
    questionText: '나의 리더는 팀의 방향성과 우선순위를 명확하게 제시한다.',
  },
  {
    category: '비전공유 (조직관리)',
    questionText: '나의 리더는 개인의 업무가 조직 목표와 어떻게 연결되는지 설명한다.',
  },
  {
    category: '비전공유 (조직관리)',
    questionText: '나의 리더는 구성원의 역할과 책임을 명확히 정리한다.',
  },
  {
    category: '비전공유 (조직관리)',
    questionText: '나의 리더는 업무 배분과 의사결정 기준을 공정하게 운영한다.',
  },
  {
    category: '비전공유 (조직관리)',
    questionText: '나의 리더는 팀의 협업 이슈를 방치하지 않고 조율한다.',
  },
  {
    category: '비전공유 (조직관리)',
    questionText: '나의 리더는 구성원의 성장과 역량 개발에 관심을 가진다.',
  },
  {
    category: '전략적 사고',
    questionText: '나의 리더는 중요한 의사결정에서 장기적 영향과 리스크를 함께 고려한다.',
  },
  {
    category: '전략적 사고',
    questionText: '나의 리더는 데이터를 근거로 문제를 분석하고 우선순위를 정한다.',
  },
  {
    category: '전략적 사고',
    questionText: '나의 리더는 복잡한 상황에서도 핵심 과제를 명확히 구분한다.',
  },
  {
    category: '혁신',
    questionText: '나의 리더는 더 나은 성과를 위해 새로운 방법을 탐색한다.',
  },
  {
    category: '혁신',
    questionText: '나의 리더는 구성원이 개선 아이디어를 제안하고 실험하도록 지원한다.',
  },
  {
    category: '혁신',
    questionText: '나의 리더는 실행 결과를 점검하고 다음 개선으로 연결한다.',
  },
] as const

export const UPWARD_RELATIONSHIP_OPTIONS: Array<{
  value: Extract<RaterRelationship, 'SUBORDINATE' | 'PEER' | 'CROSS_DEPT'>
  label: string
  description: string
}> = [
  {
    value: 'SUBORDINATE',
    label: '리더십 진단',
    description: '구성원이 현재 리더의 리더십을 진단하는 기본 관계입니다.',
  },
  {
    value: 'PEER',
    label: '동료 리더 진단',
    description: '프로젝트성 리더십이나 PM 운영을 동료 관점에서 평가합니다.',
  },
  {
    value: 'CROSS_DEPT',
    label: '교차 조직 진단',
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

export function isLeadershipPmLike(employee: Pick<UpwardDirectoryEmployee, 'jobTitle'>) {
  return typeof employee.jobTitle === 'string' && /(^|\s)pm(\s|$)|프로덕트 매니저|프로젝트 매니저/i.test(employee.jobTitle)
}

export function getLeadershipEvaluateeIdsForEvaluator(
  evaluator: Pick<
    UpwardDirectoryEmployee,
    'id' | 'role' | 'teamName' | 'teamLeaderId' | 'sectionChiefId' | 'divisionHeadId'
  >,
  employees: Array<Pick<UpwardDirectoryEmployee, 'id' | 'jobTitle' | 'teamName'>> = []
) {
  const evaluateeIds = new Set<string>()

  if (evaluator.role === 'ROLE_TEAM_LEADER') {
    const nextLeaderId = evaluator.sectionChiefId ?? evaluator.divisionHeadId
    if (nextLeaderId && nextLeaderId !== evaluator.id) evaluateeIds.add(nextLeaderId)
    return evaluateeIds
  }

  if (evaluator.role === 'ROLE_SECTION_CHIEF') {
    if (evaluator.divisionHeadId && evaluator.divisionHeadId !== evaluator.id) {
      evaluateeIds.add(evaluator.divisionHeadId)
    }
    return evaluateeIds
  }

  if (evaluator.teamLeaderId && evaluator.teamLeaderId !== evaluator.id) {
    evaluateeIds.add(evaluator.teamLeaderId)
  }

  if (evaluator.teamName) {
    for (const employee of employees) {
      if (employee.id === evaluator.id) continue
      if (employee.teamName !== evaluator.teamName) continue
      if (isLeadershipPmLike(employee)) evaluateeIds.add(employee.id)
    }
  }

  return evaluateeIds
}

export function getLeadershipResultViewerIds(
  target: Pick<UpwardDirectoryEmployee, 'id' | 'teamLeaderId' | 'sectionChiefId' | 'divisionHeadId'>
) {
  return Array.from(
    new Set(
      [target.teamLeaderId, target.sectionChiefId, target.divisionHeadId].filter(
        (item): item is string => Boolean(item) && item !== target.id
      )
    )
  )
}

export function validateUpwardAssignment(params: {
  evaluator: Pick<UpwardDirectoryEmployee, 'id' | 'empName' | 'teamLeaderId' | 'sectionChiefId' | 'divisionHeadId'> &
    Partial<Pick<UpwardDirectoryEmployee, 'role' | 'jobTitle' | 'teamName'>>
  evaluatee: Pick<UpwardDirectoryEmployee, 'id' | 'empName'> &
    Partial<Pick<UpwardDirectoryEmployee, 'role' | 'jobTitle' | 'teamName' | 'teamLeaderId' | 'sectionChiefId' | 'divisionHeadId'>>
  relationship: Extract<RaterRelationship, 'SUBORDINATE' | 'PEER' | 'CROSS_DEPT'>
}) {
  if (params.evaluator.id === params.evaluatee.id) {
    return '자기 자신을 리더십 진단 대상으로 지정할 수 없습니다.'
  }

  if (params.relationship === 'SUBORDINATE') {
    const leaderIds = params.evaluator.role
      ? Array.from(
          getLeadershipEvaluateeIdsForEvaluator(
            {
              id: params.evaluator.id,
              role: params.evaluator.role,
              teamName: params.evaluator.teamName,
              teamLeaderId: params.evaluator.teamLeaderId,
              sectionChiefId: params.evaluator.sectionChiefId,
              divisionHeadId: params.evaluator.divisionHeadId,
            },
            [
              {
                id: params.evaluatee.id,
                jobTitle: params.evaluatee.jobTitle,
                teamName: params.evaluatee.teamName,
              },
            ]
          )
        )
      : [
          params.evaluator.teamLeaderId,
          params.evaluator.sectionChiefId,
          params.evaluator.divisionHeadId,
        ].filter((item): item is string => Boolean(item))

    if (!leaderIds.includes(params.evaluatee.id)) {
      return '리더십 진단 관계에서는 조직도상 진단 가능한 리더만 대상으로 지정할 수 있습니다. PM 진단은 동료 리더 진단 관계를 선택해 주세요.'
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

      const leadershipEvaluateeIds = getLeadershipEvaluateeIdsForEvaluator(evaluator, params.employees)
      if (leadershipEvaluateeIds.has(evaluatee.id) && !existingPairKeys.has(`${evaluator.id}:${evaluatee.id}`)) {
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
  targetViewerIds?: string[]
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

  if (params.targetViewerIds?.includes(params.actorId)) {
    return true
  }

  return (
    params.settings.resultViewerMode === 'TARGET_AND_PRIMARY_MANAGER' &&
    params.targetPrimaryLeaderId === params.actorId
  )
}
