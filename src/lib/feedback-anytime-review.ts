export type FeedbackAnytimeDocumentKind =
  | 'ANYTIME'
  | 'PROJECT'
  | 'PIP'
  | 'ROLE_CHANGE'
  | 'PROBATION'

export type FeedbackAnytimePipCheckpoint = {
  label: string
  dueDate?: string
  note?: string
}

export type FeedbackAnytimePipSettings = {
  goals: string[]
  expectedBehaviors: string[]
  checkpoints: FeedbackAnytimePipCheckpoint[]
  midReview?: string
  endJudgement?: string
}

export type FeedbackAnytimeDocumentSettings = {
  reason: string
  templateRoundId?: string | null
  templateRoundName?: string | null
  projectName?: string | null
  projectCode?: string | null
  lifecycleState?: 'ACTIVE' | 'CLOSED' | 'CANCELLED'
  lifecycleReason?: string | null
  pip?: FeedbackAnytimePipSettings | null
}

type AnytimeQuestionBlueprint = {
  category: string
  questionText: string
  questionType: 'RATING_SCALE' | 'TEXT'
  scaleMin?: number | null
  scaleMax?: number | null
  isRequired?: boolean
  sortOrder: number
}

const EMPTY_PIP_SETTINGS: FeedbackAnytimePipSettings = {
  goals: [],
  expectedBehaviors: [],
  checkpoints: [],
  midReview: '',
  endJudgement: '',
}

export const FEEDBACK_ANYTIME_DOCUMENT_KIND_LABELS: Record<FeedbackAnytimeDocumentKind, string> = {
  ANYTIME: '수시 리뷰',
  PROJECT: '프로젝트 종료 리뷰',
  PIP: '성과개선계획(PIP)',
  ROLE_CHANGE: '역할 변경 리뷰',
  PROBATION: '수습 리뷰',
}

export function getFeedbackAnytimeDocumentKindLabel(kind: FeedbackAnytimeDocumentKind | null | undefined) {
  if (!kind) return '기본 리뷰'
  return FEEDBACK_ANYTIME_DOCUMENT_KIND_LABELS[kind] ?? kind
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function asStringArray(value: unknown, maxItems: number, maxLength: number) {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, maxItems)
    .map((item) => item.slice(0, maxLength))
}

function parsePipCheckpoint(value: unknown): FeedbackAnytimePipCheckpoint | null {
  const record = asRecord(value)
  if (!record) return null

  const label = typeof record.label === 'string' ? record.label.trim().slice(0, 200) : ''
  if (!label) return null

  return {
    label,
    dueDate: typeof record.dueDate === 'string' ? record.dueDate.trim().slice(0, 40) : undefined,
    note: typeof record.note === 'string' ? record.note.trim().slice(0, 400) : undefined,
  }
}

function parsePipSettings(value: unknown): FeedbackAnytimePipSettings {
  const record = asRecord(value)
  if (!record) return EMPTY_PIP_SETTINGS

  return {
    goals: asStringArray(record.goals, 10, 300),
    expectedBehaviors: asStringArray(record.expectedBehaviors, 10, 300),
    checkpoints: Array.isArray(record.checkpoints)
      ? record.checkpoints
          .map((item) => parsePipCheckpoint(item))
          .filter((item): item is FeedbackAnytimePipCheckpoint => item != null)
          .slice(0, 10)
      : [],
    midReview: typeof record.midReview === 'string' ? record.midReview.trim().slice(0, 1000) : '',
    endJudgement:
      typeof record.endJudgement === 'string' ? record.endJudgement.trim().slice(0, 1000) : '',
  }
}

export function parseFeedbackAnytimeDocumentSettings(
  value: unknown
): FeedbackAnytimeDocumentSettings {
  const record = asRecord(value)
  if (!record) {
    return {
      reason: '',
      lifecycleState: 'ACTIVE',
      pip: EMPTY_PIP_SETTINGS,
    }
  }

  return {
    reason: typeof record.reason === 'string' ? record.reason.trim().slice(0, 1000) : '',
    templateRoundId:
      typeof record.templateRoundId === 'string' ? record.templateRoundId.trim().slice(0, 100) : null,
    templateRoundName:
      typeof record.templateRoundName === 'string'
        ? record.templateRoundName.trim().slice(0, 160)
        : null,
    projectName:
      typeof record.projectName === 'string' ? record.projectName.trim().slice(0, 120) : null,
    projectCode:
      typeof record.projectCode === 'string' ? record.projectCode.trim().slice(0, 80) : null,
    lifecycleState:
      record.lifecycleState === 'ACTIVE' ||
      record.lifecycleState === 'CLOSED' ||
      record.lifecycleState === 'CANCELLED'
        ? record.lifecycleState
        : 'ACTIVE',
    lifecycleReason:
      typeof record.lifecycleReason === 'string'
        ? record.lifecycleReason.trim().slice(0, 1000)
        : null,
    pip: parsePipSettings(record.pip),
  }
}

export function buildFeedbackAnytimeRoundName(params: {
  baseName: string
  targetName: string
  isMassCreate: boolean
}) {
  const baseName = params.baseName.trim()
  if (!params.isMassCreate) return baseName
  return `${baseName} · ${params.targetName}`.slice(0, 120)
}

export function resolveAnytimeFeedbackRelationship(params: {
  reviewerId: string
  targetId: string
  teamLeaderId?: string | null
  sectionChiefId?: string | null
  divisionHeadId?: string | null
}) {
  if (params.reviewerId === params.targetId) return 'SELF' as const
  if (
    params.reviewerId === params.teamLeaderId ||
    params.reviewerId === params.sectionChiefId ||
    params.reviewerId === params.divisionHeadId
  ) {
    return 'SUPERVISOR' as const
  }
  return 'PEER' as const
}

export function buildAnytimeReviewDefaultQuestions(kind: FeedbackAnytimeDocumentKind) {
  const commonRatingQuestion: AnytimeQuestionBlueprint = {
    category: '종합',
    questionText: '이번 리뷰 문서의 목적을 기준으로 종합적으로 평가해 주세요.',
    questionType: 'RATING_SCALE',
    scaleMin: 1,
    scaleMax: 5,
    isRequired: true,
    sortOrder: 1,
  }

  const kindSpecificQuestions: Record<FeedbackAnytimeDocumentKind, AnytimeQuestionBlueprint[]> = {
    ANYTIME: [
      commonRatingQuestion,
      {
        category: '관찰',
        questionText: '최근 업무 수행에서 확인한 강점과 유지했으면 하는 행동을 적어 주세요.',
        questionType: 'TEXT',
        isRequired: true,
        sortOrder: 2,
      },
      {
        category: '성장',
        questionText: '보완이 필요한 지점과 다음 실행 과제를 적어 주세요.',
        questionType: 'TEXT',
        isRequired: true,
        sortOrder: 3,
      },
    ],
    PROJECT: [
      {
        ...commonRatingQuestion,
        questionText: '프로젝트 종료 기준으로 이번 수행 수준을 종합 평가해 주세요.',
      },
      {
        category: '성과',
        questionText: '프로젝트에서 가장 큰 기여와 주요 산출물을 적어 주세요.',
        questionType: 'TEXT',
        isRequired: true,
        sortOrder: 2,
      },
      {
        category: '협업',
        questionText: '협업/의사소통 측면에서 유지하거나 개선해야 할 점을 적어 주세요.',
        questionType: 'TEXT',
        isRequired: true,
        sortOrder: 3,
      },
      {
        category: '회고',
        questionText: '다음 프로젝트에 바로 반영할 학습 포인트를 적어 주세요.',
        questionType: 'TEXT',
        isRequired: true,
        sortOrder: 4,
      },
    ],
    PIP: [
      {
        ...commonRatingQuestion,
        questionText: '현재 시점에서 PIP 목표 달성 수준을 종합 평가해 주세요.',
      },
      {
        category: '목표',
        questionText: 'PIP 목표별 진척 상황과 근거를 적어 주세요.',
        questionType: 'TEXT',
        isRequired: true,
        sortOrder: 2,
      },
      {
        category: '행동 기대치',
        questionText: '행동 기대치 충족 여부와 관찰 사실을 적어 주세요.',
        questionType: 'TEXT',
        isRequired: true,
        sortOrder: 3,
      },
      {
        category: '판단',
        questionText: '중간 점검 또는 종료 판단과 필요한 지원/조치를 적어 주세요.',
        questionType: 'TEXT',
        isRequired: true,
        sortOrder: 4,
      },
    ],
    ROLE_CHANGE: [
      {
        ...commonRatingQuestion,
        questionText: '역할 변경 이후 기대 역할 적응 수준을 종합 평가해 주세요.',
      },
      {
        category: '적응',
        questionText: '새 역할에서 확인한 강점과 빠르게 자리잡은 행동을 적어 주세요.',
        questionType: 'TEXT',
        isRequired: true,
        sortOrder: 2,
      },
      {
        category: '지원',
        questionText: '추가 지원이나 코칭이 필요한 부분을 적어 주세요.',
        questionType: 'TEXT',
        isRequired: true,
        sortOrder: 3,
      },
    ],
    PROBATION: [
      {
        ...commonRatingQuestion,
        questionText: '수습 기간 동안 기대 역할을 얼마나 안정적으로 수행했는지 평가해 주세요.',
      },
      {
        category: '적응',
        questionText: '수습 기간 중 확인한 강점과 긍정적 신호를 적어 주세요.',
        questionType: 'TEXT',
        isRequired: true,
        sortOrder: 2,
      },
      {
        category: '보완',
        questionText: '정규 전환 전 반드시 보완해야 할 부분과 지원 계획을 적어 주세요.',
        questionType: 'TEXT',
        isRequired: true,
        sortOrder: 3,
      },
    ],
  }

  return kindSpecificQuestions[kind]
}
