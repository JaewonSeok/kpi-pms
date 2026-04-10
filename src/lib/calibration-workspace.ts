import { normalizeTimeboxMinutes } from '@/lib/calibration-session-setup'

export const CALIBRATION_DISCUSSION_STATUS_OPTIONS = [
  { value: 'PENDING', label: '대기', tone: 'slate' },
  { value: 'IN_DISCUSSION', label: '논의 중', tone: 'blue' },
  { value: 'AGREED', label: 'Yes', tone: 'emerald' },
  { value: 'ANYWAY_YES', label: 'Anyway Yes', tone: 'violet' },
  { value: 'NO', label: 'No', tone: 'rose' },
  { value: 'ESCALATED', label: '상위 검토', tone: 'amber' },
  { value: 'PARKED', label: '파킹', tone: 'orange' },
] as const

export const CALIBRATION_DEFAULT_FACILITATOR_PROMPTS = [
  '해당 구성원은 직무 또는 팀 변경이 있었는가?',
  '기존 리더가 본 맥락은 어땠는가?',
  '성과 외에 조직과 팀에 미친 영향은 무엇인가?',
  '내년에 기대 초과를 받으려면 무엇이 필요한가?',
  '기대치가 적절했다는 근거는 무엇인가?',
] as const

export type CalibrationDiscussionStatus =
  (typeof CALIBRATION_DISCUSSION_STATUS_OPTIONS)[number]['value']

export type CalibrationWorkspaceCandidateState = {
  status: CalibrationDiscussionStatus
  shortReason: string
  discussionMemo: string
  privateNote: string
  publicComment: string
  updatedAt: string | null
  updatedBy: string | null
}

export type CalibrationWorkspaceTimer = {
  candidateId: string | null
  startedAt: string | null
  durationMinutes: number
  extendedMinutes: number
  startedById: string | null
}

export type CalibrationWorkspaceValue = {
  currentCandidateId: string | null
  candidateStates: Record<string, CalibrationWorkspaceCandidateState>
  timer: CalibrationWorkspaceTimer | null
  customPrompts: string[]
}

export function createDefaultCalibrationWorkspaceCandidateState(): CalibrationWorkspaceCandidateState {
  return {
    status: 'PENDING',
    shortReason: '',
    discussionMemo: '',
    privateNote: '',
    publicComment: '',
    updatedAt: null,
    updatedBy: null,
  }
}

export function normalizeCalibrationWorkspaceCandidateState(
  value: Partial<CalibrationWorkspaceCandidateState> | null | undefined
): CalibrationWorkspaceCandidateState {
  const defaults = createDefaultCalibrationWorkspaceCandidateState()
  const status =
    value?.status &&
    CALIBRATION_DISCUSSION_STATUS_OPTIONS.some((option) => option.value === value.status)
      ? value.status
      : defaults.status

  return {
    status,
    shortReason: value?.shortReason?.trim() ?? '',
    discussionMemo: value?.discussionMemo?.trim() ?? '',
    privateNote: value?.privateNote?.trim() ?? '',
    publicComment: value?.publicComment?.trim() ?? '',
    updatedAt: value?.updatedAt ?? null,
    updatedBy: value?.updatedBy ?? null,
  }
}

export function createEmptyCalibrationWorkspace(defaultMinutes = 5): CalibrationWorkspaceValue {
  return {
    currentCandidateId: null,
    candidateStates: {},
    timer: {
      candidateId: null,
      startedAt: null,
      durationMinutes: normalizeTimeboxMinutes(defaultMinutes),
      extendedMinutes: 0,
      startedById: null,
    },
    customPrompts: [],
  }
}

export function normalizeCalibrationWorkspace(
  value: Partial<CalibrationWorkspaceValue> | null | undefined,
  defaultMinutes = 5
): CalibrationWorkspaceValue {
  const defaults = createEmptyCalibrationWorkspace(defaultMinutes)
  const rawStates =
    value?.candidateStates && typeof value.candidateStates === 'object'
      ? value.candidateStates
      : {}

  const candidateStates = Object.fromEntries(
    Object.entries(rawStates).map(([candidateId, state]) => [
      candidateId,
      normalizeCalibrationWorkspaceCandidateState(state),
    ])
  ) as Record<string, CalibrationWorkspaceCandidateState>

  const rawTimer = value?.timer
  const timer = rawTimer
    ? {
        candidateId: rawTimer.candidateId ?? null,
        startedAt: rawTimer.startedAt ?? null,
        durationMinutes: normalizeTimeboxMinutes(rawTimer.durationMinutes ?? defaultMinutes),
        extendedMinutes:
          typeof rawTimer.extendedMinutes === 'number'
            ? Math.max(0, Math.min(15, Math.round(rawTimer.extendedMinutes)))
            : 0,
        startedById: rawTimer.startedById ?? null,
      }
    : defaults.timer

  const customPrompts = Array.isArray(value?.customPrompts)
    ? value.customPrompts
        .map((prompt) => prompt.trim())
        .filter((prompt, index, list) => prompt.length > 0 && list.indexOf(prompt) === index)
        .slice(0, 10)
    : defaults.customPrompts

  return {
    currentCandidateId: value?.currentCandidateId ?? null,
    candidateStates,
    timer,
    customPrompts,
  }
}

export function isResolvedCalibrationDiscussionStatus(status: CalibrationDiscussionStatus) {
  return ['AGREED', 'ANYWAY_YES', 'NO'].includes(status)
}

export function requiresDecisionReason(status: CalibrationDiscussionStatus) {
  return status === 'NO' || status === 'ESCALATED'
}

export function getCalibrationDiscussionStatusMeta(status: CalibrationDiscussionStatus) {
  return (
    CALIBRATION_DISCUSSION_STATUS_OPTIONS.find((option) => option.value === status) ??
    CALIBRATION_DISCUSSION_STATUS_OPTIONS[0]
  )
}
