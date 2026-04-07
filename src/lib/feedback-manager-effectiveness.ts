type ReviewerCombination = {
  self: boolean
  supervisor: boolean
  peer: boolean
  subordinate: boolean
}

export type FeedbackManagerEffectivenessScope = 'ALL' | 'MANAGERS_ONLY'

export type FeedbackManagerEffectivenessSettings = {
  enabled: boolean
  targetScope: FeedbackManagerEffectivenessScope
  reviewerCombination: ReviewerCombination
  competencyLabels: string[]
}

export type ManagerEffectivenessRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH'

export type ManagerEffectivenessCoachingPack = {
  coachingPoints: string[]
  nextOneOnOneQuestions: string[]
  growthActions: string[]
  hrMemo: string
}

export const DEFAULT_FEEDBACK_MANAGER_EFFECTIVENESS_SETTINGS: FeedbackManagerEffectivenessSettings = {
  enabled: false,
  targetScope: 'MANAGERS_ONLY',
  reviewerCombination: {
    self: true,
    supervisor: true,
    peer: false,
    subordinate: true,
  },
  competencyLabels: ['코칭', '피드백', '기대치 설정', '의사결정', '팀 운영', '성장 지원'],
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function parseReviewerCombination(value: unknown): ReviewerCombination {
  const record = asRecord(value)
  if (!record) {
    return DEFAULT_FEEDBACK_MANAGER_EFFECTIVENESS_SETTINGS.reviewerCombination
  }

  return {
    self:
      typeof record.self === 'boolean'
        ? record.self
        : DEFAULT_FEEDBACK_MANAGER_EFFECTIVENESS_SETTINGS.reviewerCombination.self,
    supervisor:
      typeof record.supervisor === 'boolean'
        ? record.supervisor
        : DEFAULT_FEEDBACK_MANAGER_EFFECTIVENESS_SETTINGS.reviewerCombination.supervisor,
    peer:
      typeof record.peer === 'boolean'
        ? record.peer
        : DEFAULT_FEEDBACK_MANAGER_EFFECTIVENESS_SETTINGS.reviewerCombination.peer,
    subordinate:
      typeof record.subordinate === 'boolean'
        ? record.subordinate
        : DEFAULT_FEEDBACK_MANAGER_EFFECTIVENESS_SETTINGS.reviewerCombination.subordinate,
  }
}

export function parseFeedbackManagerEffectivenessSettings(
  value: unknown
): FeedbackManagerEffectivenessSettings {
  const record = asRecord(value)
  if (!record) {
    return DEFAULT_FEEDBACK_MANAGER_EFFECTIVENESS_SETTINGS
  }

  const competencyLabels = Array.isArray(record.competencyLabels)
    ? record.competencyLabels
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 10)
    : DEFAULT_FEEDBACK_MANAGER_EFFECTIVENESS_SETTINGS.competencyLabels

  return {
    enabled:
      typeof record.enabled === 'boolean'
        ? record.enabled
        : DEFAULT_FEEDBACK_MANAGER_EFFECTIVENESS_SETTINGS.enabled,
    targetScope:
      record.targetScope === 'ALL' || record.targetScope === 'MANAGERS_ONLY'
        ? record.targetScope
        : DEFAULT_FEEDBACK_MANAGER_EFFECTIVENESS_SETTINGS.targetScope,
    reviewerCombination: parseReviewerCombination(record.reviewerCombination),
    competencyLabels:
      competencyLabels.length > 0
        ? competencyLabels
        : DEFAULT_FEEDBACK_MANAGER_EFFECTIVENESS_SETTINGS.competencyLabels,
  }
}

export function isRelationshipEnabledForManagerEffectiveness(
  relationship: string,
  settings: FeedbackManagerEffectivenessSettings
) {
  switch (relationship) {
    case 'SELF':
      return settings.reviewerCombination.self
    case 'SUPERVISOR':
      return settings.reviewerCombination.supervisor
    case 'PEER':
      return settings.reviewerCombination.peer
    case 'SUBORDINATE':
      return settings.reviewerCombination.subordinate
    default:
      return false
  }
}

export function getManagerEffectivenessReviewerSummary(
  settings: FeedbackManagerEffectivenessSettings
) {
  const summary: string[] = []
  if (settings.reviewerCombination.self) summary.push('자기평가')
  if (settings.reviewerCombination.supervisor) summary.push('상위 리더')
  if (settings.reviewerCombination.peer) summary.push('동료 리더')
  if (settings.reviewerCombination.subordinate) summary.push('직속부하')
  return summary
}

export function isManagerEffectivenessTarget(params: {
  position?: string | null
  directReportCount?: number
}) {
  if ((params.directReportCount ?? 0) > 0) return true
  const position = params.position?.trim()
  return ['TEAM_LEADER', 'SECTION_CHIEF', 'DIV_HEAD', 'CEO'].includes(position ?? '')
}

export function getManagerEffectivenessRiskLevel(params: {
  overallScore: number | null
  benchmarkDelta: number | null
  improvementCount: number
}): ManagerEffectivenessRiskLevel {
  if (params.overallScore == null) return 'HIGH'
  if ((params.benchmarkDelta ?? 0) <= -0.7) return 'HIGH'
  if ((params.benchmarkDelta ?? 0) <= -0.3 || params.improvementCount >= 3) return 'MEDIUM'
  return 'LOW'
}

export function buildManagerEffectivenessCoachingPack(params: {
  leaderName: string
  strengths: string[]
  improvements: string[]
  competencyLabels: string[]
  overallScore: number | null
  benchmarkDelta: number | null
}): ManagerEffectivenessCoachingPack {
  const primaryImprovement = params.improvements[0] ?? params.competencyLabels[0] ?? '코칭'
  const benchmarkPhrase =
    params.benchmarkDelta == null
      ? '비교 기준 데이터가 아직 충분하지 않습니다.'
      : params.benchmarkDelta >= 0
        ? `동일 집단 평균보다 ${params.benchmarkDelta.toFixed(1)}점 높습니다.`
        : `동일 집단 평균보다 ${Math.abs(params.benchmarkDelta).toFixed(1)}점 낮습니다.`

  const coachingPoints = [
    `${primaryImprovement} 관점에서 최근 리더 행동 사례를 2주 단위로 구체적으로 점검합니다.`,
    params.strengths.length
      ? `현재 강점인 ${params.strengths[0]}은 유지하되, 팀원이 체감하는 빈도와 일관성을 함께 확인합니다.`
      : '현재 잘하고 있는 리더 행동과 개선이 필요한 행동을 분리해 기록합니다.',
    '이번 피드백을 다음 1:1 아젠다로 연결하고, 실행 약속 1개를 반드시 합의합니다.',
  ]

  const nextOneOnOneQuestions = [
    '최근 2주 동안 내가 팀의 우선순위와 기대치를 얼마나 명확하게 전달했는지 체감이 어떤가요?',
    `${primaryImprovement}와 관련해 지금 가장 필요한 지원이나 변경은 무엇인가요?`,
    '현재 피드백 방식이 업무 몰입도와 실행 속도에 실제로 어떤 영향을 주고 있나요?',
  ]

  const growthActions = [
    '다음 4주 동안 팀원별 코칭 메모를 남기고, 반복 패턴을 리뷰합니다.',
    '1:1마다 기대치 확인 질문 1개와 피드백 확인 질문 1개를 고정 아젠다로 사용합니다.',
    '본부장 또는 HRBP와 함께 리더 행동 1개를 관찰하고 피드백을 받습니다.',
  ]

  return {
    coachingPoints,
    nextOneOnOneQuestions,
    growthActions,
    hrMemo: `${params.leaderName} 리더의 manager effectiveness 결과는 ${benchmarkPhrase} HR은 ${primaryImprovement}를 우선 코칭 주제로 설정하고 1개월 뒤 행동 변화를 다시 확인하는 운영을 권장합니다.`,
  }
}
