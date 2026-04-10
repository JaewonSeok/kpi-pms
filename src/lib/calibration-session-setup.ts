export const CALIBRATION_SESSION_TYPE_OPTIONS = [
  { value: 'SINGLE_TEAM', label: '단일 팀 세션' },
  { value: 'MULTI_TEAM', label: '복수 팀 세션' },
  { value: 'ROLLUP', label: '상위 롤업 세션' },
  { value: 'EXECUTIVE', label: '최종 임원 리뷰 세션' },
] as const

export const CALIBRATION_SCOPE_MODE_OPTIONS = [
  { value: 'ORGANIZATION', label: '조직 단위' },
  { value: 'REVIEW_CYCLE', label: '리뷰 사이클 단위' },
  { value: 'LEADER_GROUP', label: '리더 그룹 단위' },
] as const

export const CALIBRATION_DECISION_POLICY_OPTIONS = [
  { value: 'OWNER_DECIDES', label: '오너 최종 결정' },
  { value: 'CONSENSUS_PREFERRED', label: '합의 우선' },
  { value: 'ESCALATION_REQUIRED', label: '이견 시 상위 에스컬레이션' },
] as const

export const CALIBRATION_REFERENCE_DISTRIBUTION_USE_OPTIONS = [
  { value: 'OFF', label: '사용 안 함' },
  { value: 'GUIDELINE_ONLY', label: '가이드라인으로만 사용' },
] as const

export const CALIBRATION_REFERENCE_DISTRIBUTION_VISIBILITY_OPTIONS = [
  { value: 'VISIBLE_ONLY', label: '참고 패널만 노출' },
  { value: 'WARNING_ONLY', label: '편차 경고만 노출' },
] as const

export const CALIBRATION_MEMO_COMMENT_POLICY_OPTIONS = [
  {
    value: 'PRIVATE_MEMO_DEFAULT',
    label: '비공개 메모 우선',
    description: '논의 메모는 비공개로 남기고, 공개 코멘트는 세션 후 별도로 정리합니다.',
  },
  {
    value: 'OWNER_REVIEW_REQUIRED',
    label: '오너 검토 후 공개 코멘트 확정',
    description: '오너가 최종 문구를 검토한 뒤에만 공유 코멘트를 확정합니다.',
  },
  {
    value: 'STRICT_SEPARATION',
    label: '메모/코멘트 엄격 분리',
    description: '세션 메모와 결과 공유 코멘트를 완전히 분리 운영합니다.',
  },
] as const

export const CALIBRATION_GROUND_RULE_PRESETS = [
  {
    key: 'LAS_VEGAS_RULE',
    label: 'Las Vegas Rule',
    description: '세션에서 나온 개인 사례와 발언은 외부에 공유하지 않습니다.',
  },
  {
    key: 'WORKING_AS_A_TEAM',
    label: 'Working as a team',
    description: '내 조직이 아니라 회사 전체 최적화를 기준으로 함께 판단합니다.',
  },
  {
    key: 'INTELLECTUAL_HONESTY',
    label: 'Intellectual Honesty',
    description: '사실과 해석, 확실한 정보와 추정을 구분해서 말합니다.',
  },
  {
    key: 'PSYCHOLOGICAL_SAFETY',
    label: 'Psychological Safety',
    description: '사람을 공격하지 않고 근거를 안전하게 토론합니다.',
  },
] as const

export const CALIBRATION_VISIBLE_COLUMN_OPTIONS = [
  { key: 'name', label: '이름', description: '후보자 이름' },
  { key: 'role', label: '역할', description: '현재 역할 또는 직무 라벨' },
  { key: 'position', label: '직책', description: '조직 내 직책 정보' },
  { key: 'gradeLevel', label: '직급', description: '직급 또는 레벨 정보' },
  { key: 'department', label: '소속', description: '조직/부서 정보' },
  { key: 'jobFamily', label: '직군', description: '직군 또는 직무군 정보' },
  { key: 'threeYearHistory', label: '최근 3년 평가 이력', description: '최근 평가 추세와 등급 이력' },
  { key: 'peerReviewMean', label: 'Peer review 평균', description: '동료 리뷰 평균 점수' },
  { key: 'peerReviewVariance', label: 'Peer review 분산', description: '동료 리뷰 편차 정보' },
  { key: 'outlierBadge', label: 'Outlier badge', description: '부서/회사 대비 편차 경고' },
  { key: 'newlyJoined', label: '신규 입사', description: '입사 초기 구성원 표시' },
  { key: 'newlyPromoted', label: '최근 승진', description: '최근 승진 여부' },
  { key: 'promotionCandidate', label: '승진 후보', description: '승진 후보 플래그' },
  { key: 'seniorLevel', label: '시니어 레벨', description: '시니어 핵심 인력 표시' },
  { key: 'currentManagerRating', label: '현재 리더 평가', description: '직속 리더의 현재 평가값' },
  { key: 'priorTrendSummary', label: '직전 추세 요약', description: '최근 평가 추세 요약' },
] as const

export type CalibrationSessionType = (typeof CALIBRATION_SESSION_TYPE_OPTIONS)[number]['value']
export type CalibrationScopeMode = (typeof CALIBRATION_SCOPE_MODE_OPTIONS)[number]['value']
export type CalibrationDecisionPolicy = (typeof CALIBRATION_DECISION_POLICY_OPTIONS)[number]['value']
export type CalibrationReferenceDistributionUse =
  (typeof CALIBRATION_REFERENCE_DISTRIBUTION_USE_OPTIONS)[number]['value']
export type CalibrationReferenceDistributionVisibility =
  (typeof CALIBRATION_REFERENCE_DISTRIBUTION_VISIBILITY_OPTIONS)[number]['value']
export type CalibrationMemoCommentPolicyPreset =
  (typeof CALIBRATION_MEMO_COMMENT_POLICY_OPTIONS)[number]['value']
export type CalibrationGroundRuleKey = (typeof CALIBRATION_GROUND_RULE_PRESETS)[number]['key']
export type CalibrationVisibleColumnKey = (typeof CALIBRATION_VISIBLE_COLUMN_OPTIONS)[number]['key']

export type CalibrationGroundRulePolicy = 'NOT_SET' | 'REQUIRED' | 'OPTIONAL'

export type CalibrationGroundRuleItem = {
  key: CalibrationGroundRuleKey
  label: string
  description: string
  enabled: boolean
}

export type CalibrationRatingGuideLink = {
  id: string
  scopeType: 'POSITION' | 'JOB_GROUP' | 'LEVEL'
  scopeValue: string
  memo?: string
}

export type CalibrationReferenceDistributionRatio = {
  gradeId: string
  gradeLabel: string
  ratio: number
}

export type CalibrationSessionSetupValue = {
  sessionName: string
  sessionType: CalibrationSessionType
  scopeMode: CalibrationScopeMode
  scopeDepartmentIds: string[]
  scopeLeaderIds: string[]
  ownerId: string | null
  facilitatorId: string | null
  recorderId: string | null
  observerIds: string[]
  preReadDeadline: string | null
  scheduledStart: string | null
  scheduledEnd: string | null
  timeboxMinutes: number
  decisionPolicy: CalibrationDecisionPolicy
  referenceDistributionUse: CalibrationReferenceDistributionUse
  referenceDistributionVisibility: CalibrationReferenceDistributionVisibility
  referenceDistributionRatios: CalibrationReferenceDistributionRatio[]
  ratingGuideUse: boolean
  ratingGuideLinks: CalibrationRatingGuideLink[]
  expectationAlignmentMemo: string
  visibleDataColumns: CalibrationVisibleColumnKey[]
  memoCommentPolicyPreset: CalibrationMemoCommentPolicyPreset
  objectionWindowOpenAt: string | null
  objectionWindowCloseAt: string | null
  followUpOwnerId: string | null
  groundRules: CalibrationGroundRuleItem[]
  groundRuleAcknowledgementPolicy: CalibrationGroundRulePolicy
  facilitatorCanFinalize: boolean
}

export type CalibrationSetupReadiness = {
  readyToStart: boolean
  blockingItems: string[]
  warningItems: string[]
}

export function createDefaultCalibrationGroundRules(): CalibrationGroundRuleItem[] {
  return CALIBRATION_GROUND_RULE_PRESETS.map((rule) => ({
    key: rule.key,
    label: rule.label,
    description: rule.description,
    enabled: true,
  }))
}

export function createDefaultCalibrationSessionSetup(): CalibrationSessionSetupValue {
  return {
    sessionName: '',
    sessionType: 'SINGLE_TEAM',
    scopeMode: 'ORGANIZATION',
    scopeDepartmentIds: [],
    scopeLeaderIds: [],
    ownerId: null,
    facilitatorId: null,
    recorderId: null,
    observerIds: [],
    preReadDeadline: null,
    scheduledStart: null,
    scheduledEnd: null,
    timeboxMinutes: 5,
    decisionPolicy: 'OWNER_DECIDES',
    referenceDistributionUse: 'OFF',
    referenceDistributionVisibility: 'VISIBLE_ONLY',
    referenceDistributionRatios: [],
    ratingGuideUse: true,
    ratingGuideLinks: [],
    expectationAlignmentMemo: '',
    visibleDataColumns: ['name', 'role', 'department', 'threeYearHistory', 'outlierBadge', 'currentManagerRating'],
    memoCommentPolicyPreset: 'OWNER_REVIEW_REQUIRED',
    objectionWindowOpenAt: null,
    objectionWindowCloseAt: null,
    followUpOwnerId: null,
    groundRules: createDefaultCalibrationGroundRules(),
    groundRuleAcknowledgementPolicy: 'NOT_SET',
    facilitatorCanFinalize: false,
  }
}

export function normalizeCalibrationSessionSetup(
  value: Partial<CalibrationSessionSetupValue> | null | undefined
): CalibrationSessionSetupValue {
  const defaults = createDefaultCalibrationSessionSetup()
  const groundRules =
    value?.groundRules?.length
      ? value.groundRules.map((rule) => ({
          key: rule.key,
          label: rule.label?.trim() || defaults.groundRules.find((item) => item.key === rule.key)?.label || rule.key,
          description:
            rule.description?.trim() ||
            defaults.groundRules.find((item) => item.key === rule.key)?.description ||
            '',
          enabled: rule.enabled !== false,
        }))
      : defaults.groundRules

  const normalizedVisibleColumns = (value?.visibleDataColumns ?? defaults.visibleDataColumns).filter((column) =>
    CALIBRATION_VISIBLE_COLUMN_OPTIONS.some((option) => option.key === column)
  )

  const normalizedRatios = (value?.referenceDistributionRatios ?? []).filter(
    (item) => item.gradeId?.trim() && item.gradeLabel?.trim() && typeof item.ratio === 'number'
  )

  const normalizedLinks = (value?.ratingGuideLinks ?? [])
    .map((link, index) => ({
      id: link.id?.trim() || `guide-link-${index + 1}`,
      scopeType: link.scopeType,
      scopeValue: link.scopeValue?.trim() ?? '',
      memo: link.memo?.trim() || undefined,
    }))
    .filter((link) => link.scopeValue.length > 0)

  return {
    ...defaults,
    ...value,
    sessionName: value?.sessionName?.trim() ?? '',
    scopeDepartmentIds: value?.scopeDepartmentIds ?? [],
    scopeLeaderIds: value?.scopeLeaderIds ?? [],
    observerIds: value?.observerIds ?? [],
    timeboxMinutes: normalizeTimeboxMinutes(value?.timeboxMinutes ?? defaults.timeboxMinutes),
    referenceDistributionRatios: normalizedRatios,
    ratingGuideLinks: normalizedLinks,
    expectationAlignmentMemo: value?.expectationAlignmentMemo?.trim() ?? '',
    visibleDataColumns: normalizedVisibleColumns.length ? normalizedVisibleColumns : defaults.visibleDataColumns,
    groundRules,
    facilitatorCanFinalize: value?.facilitatorCanFinalize === true,
    groundRuleAcknowledgementPolicy: value?.groundRuleAcknowledgementPolicy ?? defaults.groundRuleAcknowledgementPolicy,
  }
}

export function buildCalibrationSetupReadiness(params: {
  setup: CalibrationSessionSetupValue
  participantIds: string[]
}): CalibrationSetupReadiness {
  const { setup, participantIds } = params
  const blockingItems: string[] = []
  const warningItems: string[] = []

  if (!setup.ownerId) {
    blockingItems.push('세션 owner를 지정해 주세요.')
  }

  if (participantIds.length === 0) {
    blockingItems.push('세션 participant를 1명 이상 지정해 주세요.')
  }

  if (!setup.preReadDeadline) {
    blockingItems.push('사전 준비용 pre-read deadline을 입력해 주세요.')
  }

  if (!setup.scheduledStart || !setup.scheduledEnd) {
    blockingItems.push('세션 시작/종료 일정을 모두 입력해 주세요.')
  } else if (setup.scheduledStart >= setup.scheduledEnd) {
    blockingItems.push('세션 종료 시각은 시작 시각보다 뒤여야 합니다.')
  }

  if (setup.groundRuleAcknowledgementPolicy === 'NOT_SET') {
    blockingItems.push('그라운드 룰 acknowledgement 정책을 설정해 주세요.')
  }

  if (setup.objectionWindowOpenAt && setup.objectionWindowCloseAt && setup.objectionWindowOpenAt >= setup.objectionWindowCloseAt) {
    blockingItems.push('이의제기 종료 시각은 시작 시각보다 뒤여야 합니다.')
  }

  if (setup.ratingGuideUse && setup.ratingGuideLinks.length === 0) {
    warningItems.push('등급 가이드를 켠 상태지만 연결된 직책/직군/레벨 기준이 없습니다.')
  }

  if (setup.referenceDistributionUse === 'GUIDELINE_ONLY' && setup.referenceDistributionRatios.length === 0) {
    warningItems.push('참고 분포를 켰지만 비율 preset이 비어 있습니다.')
  }

  if (!setup.followUpOwnerId) {
    warningItems.push('팔로우업 owner가 아직 지정되지 않았습니다.')
  }

  if (setup.facilitatorId && setup.ownerId && setup.facilitatorId === setup.ownerId && !setup.facilitatorCanFinalize) {
    warningItems.push('owner와 facilitator가 동일합니다. HR은 facilitator/standard keeper 역할인지 다시 확인해 주세요.')
  }

  return {
    readyToStart: blockingItems.length === 0,
    blockingItems,
    warningItems,
  }
}

export function normalizeTimeboxMinutes(value: number) {
  if (!Number.isFinite(value)) return 5
  if (value < 5) return 5
  if (value > 10) return 10
  return Math.round(value)
}
