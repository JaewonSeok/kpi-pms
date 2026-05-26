export type Evaluation2026ScheduleWindowKey =
  | 'MBO_SETUP'
  | 'ORG_KPI_ADJUSTMENT'
  | 'TEAM_KPI_CONFIRMATION'
  | 'MBO_REVISION'
  | 'MID_CHECK'
  | 'GOAL_CHANGE_REQUEST'
  | 'RESULT_WRITING'
  | 'ORG_EVALUATION_CLOSE'
  | 'AI_EVIDENCE_SUBMISSION'
  | 'SECOND_360_REVIEW'
  | 'LEADERSHIP_DIAGNOSIS'

export type Evaluation2026ScheduleWindowStatus = 'UPCOMING' | 'ACTIVE' | 'CLOSED' | 'NEEDS_SETUP'

export type Evaluation2026ScheduleWindow = {
  key: Evaluation2026ScheduleWindowKey
  label: string
  plannedRangeLabel: string
  startDate: string | null
  endDate: string | null
  ownerRoleLabel: string
  recommendedAction: string
  href: string
  status: Evaluation2026ScheduleWindowStatus
  statusLabel: string
  relativeTimingLabel: string
}

type ScheduleWindowTemplate = Omit<
  Evaluation2026ScheduleWindow,
  'status' | 'statusLabel' | 'relativeTimingLabel'
>

export const EVALUATION_2026_SCHEDULE_TIMEZONE = 'Asia/Seoul'

export const EVALUATION_2026_SCHEDULE_STATUS_LABELS: Record<Evaluation2026ScheduleWindowStatus, string> = {
  UPCOMING: '예정',
  ACTIVE: '진행 중',
  CLOSED: '종료',
  NEEDS_SETUP: '일정 확정 필요',
}

const SCHEDULE_WINDOWS_2026: ScheduleWindowTemplate[] = [
  {
    key: 'MBO_SETUP',
    label: '팀원 업적목표 수립 및 확정',
    plannedRangeLabel: '2026.01.01 ~ 2026.06.30 readiness 기준',
    startDate: '2026-01-01',
    endDate: '2026-06-30',
    ownerRoleLabel: '직원 / 팀장 / HR',
    recommendedAction: 'MBO 작성 요청',
    href: '/kpi/personal',
  },
  {
    key: 'ORG_KPI_ADJUSTMENT',
    label: '2026 조직목표 KPI 조정',
    plannedRangeLabel: 'HR 일정 확정 필요',
    startDate: null,
    endDate: null,
    ownerRoleLabel: '본부장 / HR',
    recommendedAction: '조직 KPI 조정',
    href: '/kpi/org',
  },
  {
    key: 'TEAM_KPI_CONFIRMATION',
    label: '본부 KPI 외 팀 KPI 확정',
    plannedRangeLabel: 'HR 일정 확정 필요',
    startDate: null,
    endDate: null,
    ownerRoleLabel: 'HR / 팀장',
    recommendedAction: '팀 KPI 검토',
    href: '/evaluation/performance',
  },
  {
    key: 'MBO_REVISION',
    label: '팀원 개인업적목표관리카드 수정',
    plannedRangeLabel: '팀 KPI HR 결정 후 readiness 기준',
    startDate: null,
    endDate: null,
    ownerRoleLabel: '직원 / 팀장',
    recommendedAction: 'MBO 수정 안내',
    href: '/kpi/personal',
  },
  {
    key: 'MID_CHECK',
    label: '업무목표 중간 점검/피드백',
    plannedRangeLabel: '2026.07.27 ~ 2026.07.31',
    startDate: '2026-07-27',
    endDate: '2026-07-31',
    ownerRoleLabel: '팀장 / 직원',
    recommendedAction: '중간 점검 입력',
    href: '/kpi/monthly',
  },
  {
    key: 'GOAL_CHANGE_REQUEST',
    label: '업무목표 변경 신청 기간',
    plannedRangeLabel: '2026.07.01 ~ 2026.11.30',
    startDate: '2026-07-01',
    endDate: '2026-11-30',
    ownerRoleLabel: '직원 / 팀장 / HR',
    recommendedAction: '목표 변경 신청 가능',
    href: '/kpi/personal',
  },
  {
    key: 'RESULT_WRITING',
    label: '2026 업적목표 수행결과 작성',
    plannedRangeLabel: '2027.01.04 ~ 2027.01.08',
    startDate: '2027-01-04',
    endDate: '2027-01-08',
    ownerRoleLabel: '직원',
    recommendedAction: '수행결과 작성 준비',
    href: '/evaluation/performance',
  },
  {
    key: 'ORG_EVALUATION_CLOSE',
    label: '2026 조직평가 종료',
    plannedRangeLabel: '2027.01.11 ~ 2027.01.30',
    startDate: '2027-01-11',
    endDate: '2027-01-30',
    ownerRoleLabel: 'HR',
    recommendedAction: '조직평가 종료 전 blocker 확인',
    href: '/evaluation/performance',
  },
  {
    key: 'AI_EVIDENCE_SUBMISSION',
    label: 'AI 활용 평가 제출',
    plannedRangeLabel: 'HR 일정 확정 필요',
    startDate: null,
    endDate: null,
    ownerRoleLabel: '직원 / HR',
    recommendedAction: 'AI 활용평가 대상자 배정',
    href: '/evaluation/ai-competency',
  },
  {
    key: 'SECOND_360_REVIEW',
    label: '2차 다면평가',
    plannedRangeLabel: 'HR 일정 확정 필요',
    startDate: null,
    endDate: null,
    ownerRoleLabel: 'HR',
    recommendedAction: '2차 다면평가 일정 확인',
    href: '/evaluation/360/admin',
  },
  {
    key: 'LEADERSHIP_DIAGNOSIS',
    label: '리더십 진단',
    plannedRangeLabel: 'HR 일정 확정 필요',
    startDate: null,
    endDate: null,
    ownerRoleLabel: 'HR',
    recommendedAction: '리더십 진단 운영 일정 확정',
    href: '/solutions/leadership-diagnosis',
  },
]

function parseReferenceDate(value?: Date | string | null) {
  if (value instanceof Date) return value
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T12:00:00+09:00`)
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed
  }
  return new Date()
}

export function getEvaluation2026KoreaDateKey(value?: Date | string | null) {
  return parseReferenceDate(value).toLocaleDateString('sv-SE', {
    timeZone: EVALUATION_2026_SCHEDULE_TIMEZONE,
  })
}

function resolveWindowStatus(
  window: Pick<ScheduleWindowTemplate, 'startDate' | 'endDate'>,
  referenceDateKey: string
): Evaluation2026ScheduleWindowStatus {
  if (!window.startDate || !window.endDate) return 'NEEDS_SETUP'
  if (referenceDateKey < window.startDate) return 'UPCOMING'
  if (referenceDateKey > window.endDate) return 'CLOSED'
  return 'ACTIVE'
}

function buildRelativeTimingLabel(
  window: Pick<ScheduleWindowTemplate, 'startDate' | 'endDate'>,
  referenceDateKey: string,
  status: Evaluation2026ScheduleWindowStatus
) {
  if (status === 'NEEDS_SETUP') return 'HR 일정 metadata 확정 필요'
  if (status === 'ACTIVE') return '현재 진행 기간'
  if (status === 'UPCOMING') return `${window.startDate} 시작 예정`
  if (status === 'CLOSED') return `${window.endDate} 종료`
  return referenceDateKey
}

export function getEvaluation2026ScheduleWindows(referenceDate?: Date | string | null): Evaluation2026ScheduleWindow[] {
  const referenceDateKey = getEvaluation2026KoreaDateKey(referenceDate)
  return SCHEDULE_WINDOWS_2026.map((window) => {
    const status = resolveWindowStatus(window, referenceDateKey)
    return {
      ...window,
      status,
      statusLabel: EVALUATION_2026_SCHEDULE_STATUS_LABELS[status],
      relativeTimingLabel: buildRelativeTimingLabel(window, referenceDateKey, status),
    }
  })
}

export function getEvaluation2026ScheduleWindowMap(referenceDate?: Date | string | null) {
  return Object.fromEntries(
    getEvaluation2026ScheduleWindows(referenceDate).map((window) => [window.key, window])
  ) as Record<Evaluation2026ScheduleWindowKey, Evaluation2026ScheduleWindow>
}

export function getPersonalKpiScheduleGuidance(referenceDate?: Date | string | null) {
  const windows = getEvaluation2026ScheduleWindowMap(referenceDate)
  const editableWindowActive = ['MBO_SETUP', 'MBO_REVISION', 'GOAL_CHANGE_REQUEST'].some(
    (key) => windows[key as Evaluation2026ScheduleWindowKey].status === 'ACTIVE'
  )

  return {
    editableWindowActive,
    warningMessage: editableWindowActive
      ? null
      : '현재는 공식 목표 수정 기간이 아닙니다. 수정이 필요한 경우 목표 변경 신청 절차를 확인해 주세요.',
    activeWindowLabels: Object.values(windows)
      .filter((window) => window.status === 'ACTIVE')
      .map((window) => window.label),
  }
}

export function getMonthlyMidCheckScheduleGuidance(referenceDate?: Date | string | null) {
  const window = getEvaluation2026ScheduleWindowMap(referenceDate).MID_CHECK
  return {
    window,
    isActive: window.status === 'ACTIVE',
    message:
      window.status === 'ACTIVE'
        ? '중간 점검/피드백 기간입니다. 목표 유효성, 기대 기준, 다음 액션을 정리해 주세요.'
        : '2026 중간 점검/피드백은 7/27~7/31 예정입니다. 현재 안내는 참고용이며 월간 실적 저장을 제한하지 않습니다.',
  }
}

export function getResultWritingScheduleGuidance(referenceDate?: Date | string | null) {
  const window = getEvaluation2026ScheduleWindowMap(referenceDate).RESULT_WRITING
  return {
    window,
    isActive: window.status === 'ACTIVE',
    message:
      '2026 업적목표 수행결과 작성 기간입니다. 수행 결과는 달성 여부가 아니라 본인 기여와 산출물 중심으로 작성해야 합니다.',
  }
}
