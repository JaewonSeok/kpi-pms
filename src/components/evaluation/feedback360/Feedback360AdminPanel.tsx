'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { FolderPlus, Mail, Play, Plus, Settings2, Trash2, X } from 'lucide-react'
import type { Feedback360PageData } from '@/server/feedback-360'
import {
  DEFAULT_FEEDBACK_RESULT_PRESENTATION_SETTINGS,
  FEEDBACK_RESULT_PROFILE_LABELS,
  type FeedbackResultPresentationSettings,
  type FeedbackResultRecipientProfile,
} from '@/lib/feedback-result-presentation'
import {
  DEFAULT_FEEDBACK_REPORT_ANALYSIS_SETTINGS,
  FEEDBACK_ANALYSIS_STRENGTH_LABELS,
  FEEDBACK_REPORT_ANALYSIS_SECTIONS,
  type FeedbackReportAnalysisSettings,
  type FeedbackReportAnalysisStrength,
} from '@/lib/feedback-report-analysis'
import {
  DEFAULT_FEEDBACK_MANAGER_EFFECTIVENESS_SETTINGS,
  getManagerEffectivenessReviewerSummary,
} from '@/lib/feedback-manager-effectiveness'
import {
  DEFAULT_FEEDBACK_AI_COPILOT_SETTINGS,
  DEFAULT_FEEDBACK_SKILL_ARCHITECTURE_SETTINGS,
} from '@/lib/feedback-skill-architecture'
import { useImpersonationRiskAction } from '@/components/security/useImpersonationRiskAction'
import {
  FEEDBACK_ANYTIME_DOCUMENT_KIND_LABELS,
  type FeedbackAnytimeDocumentKind,
} from '@/lib/feedback-anytime-review'
import {
  DEFAULT_FEEDBACK_RATING_GUIDE_SETTINGS,
  annotateFeedbackRatingScaleEntries,
  buildFeedbackRatingScaleEntries,
  parseFeedbackRatingGuideSettings,
  type FeedbackRatingGuideRule,
  type FeedbackRatingGuideScaleEntry,
  type FeedbackRatingGuideSettings,
} from '@/lib/feedback-rating-guide'
import {
  ONBOARDING_REVIEW_DEFAULT_TEMPLATE,
  POSITION_LABELS_KO,
  buildOnboardingReviewNamePreview,
  formatScheduleHourLabel,
  sortOnboardingGeneratedReviews,
  type OnboardingGeneratedReviewSort,
} from '@/lib/onboarding-review-workflow'
import { reviewEmailHtmlToText } from '@/lib/review-email-editor'
import { MultiRaterTimeline } from './MultiRaterTimeline'
import { ResponseRateCard } from './ResponseRateCard'
import { RichTextEmailEditor } from './RichTextEmailEditor'
// Personal report and analysis settings

type Banner = {
  tone: 'success' | 'error' | 'info'
  message: string
}

type ReminderAction =
  | 'send-review-reminder'
  | 'send-peer-selection-reminder'
  | 'send-result-share'

type VisibilityLevel = 'FULL' | 'ANONYMOUS' | 'PRIVATE'

type ReminderTarget = NonNullable<Feedback360PageData['admin']>['reminderTargets'][number]
type ResultShareSummary = NonNullable<NonNullable<Feedback360PageData['admin']>['resultShare']>
type OnboardingAdmin = NonNullable<NonNullable<Feedback360PageData['admin']>['onboarding']>
type AnytimeReviewAdminState = NonNullable<NonNullable<Feedback360PageData['admin']>['anytimeReview']>
type AnytimeReviewDocument = AnytimeReviewAdminState['documents'][number]
type OnboardingWorkflow = OnboardingAdmin['workflows'][number]
type OnboardingCondition = OnboardingWorkflow['targetConditions'][number]
type ReviewAdminState = NonNullable<NonNullable<Feedback360PageData['admin']>['reviewAdmin']>
type ReviewAdminGroup = ReviewAdminState['groups'][number]
type ReviewAdminCandidate = ReviewAdminState['candidateMembers'][number]
type ReviewAdminScope = ReviewAdminGroup['reviewScope']
type ManagerEffectivenessAdminState = NonNullable<
  NonNullable<Feedback360PageData['admin']>['managerEffectiveness']
>
type RoundQuestion = Feedback360PageData['availableRounds'][number]['questions'][number]
type RatingGuideDisplayEntry = ReturnType<typeof annotateFeedbackRatingScaleEntries>[number]

type OnboardingWorkflowDraft = {
  id?: string
  evalCycleId: string
  workflowName: string
  isActive: boolean
  scheduleHourKst: number
  targetConditions: OnboardingCondition[]
  steps: Array<{
    id: string
    stepOrder: number
    stepName: string
    triggerDaysAfterJoin: number
    durationDays: number
    reviewNameTemplate: string
    includeEmployeeNameInName: boolean
    includeHireDateInName: boolean
  }>
}

const REVIEW_ADMIN_SCOPE_OPTIONS: Array<{
  value: ReviewAdminScope
  label: string
  description: string
}> = [
  {
    value: 'NONE',
    label: '해당 없음',
    description: '리뷰 관리자 권한을 부여하지 않습니다.',
  },
  {
    value: 'ALL_REVIEWS_MANAGE',
    label: '모든 리뷰 사이클/템플릿 관리',
    description: '조직 전체 리뷰 사이클과 템플릿을 관리할 수 있습니다.',
  },
  {
    value: 'ALL_REVIEWS_MANAGE_AND_CONTENT',
    label: '모든 리뷰 사이클/템플릿 관리 + 모든 리뷰 내용 열람 및 수정',
    description: '조직 전체 리뷰 설정과 리뷰 내용을 모두 열람하고 수정할 수 있습니다.',
  },
  {
    value: 'COLLABORATOR_REVIEWS_MANAGE',
    label: '공동 작업자인 리뷰 사이클/템플릿 관리',
    description: '공동 작업자로 지정된 리뷰 사이클과 템플릿만 관리할 수 있습니다.',
  },
  {
    value: 'COLLABORATOR_REVIEWS_MANAGE_AND_CONTENT',
    label: '공동 작업자인 리뷰 사이클/템플릿 관리 + 공동 작업자인 리뷰 내용 열람 및 수정',
    description: '공동 작업자로 지정된 리뷰만 관리하고 해당 리뷰 내용도 열람 및 수정할 수 있습니다.',
  },
]

const DEFAULT_SELECTION_SETTINGS = {
  requireLeaderApproval: false,
  allowPreferredPeers: false,
  excludeLeaderFromPeerSelection: false,
  excludeDirectReportsFromPeerSelection: false,
  managerEffectiveness: DEFAULT_FEEDBACK_MANAGER_EFFECTIVENESS_SETTINGS,
  skillArchitecture: DEFAULT_FEEDBACK_SKILL_ARCHITECTURE_SETTINGS,
  aiCopilot: DEFAULT_FEEDBACK_AI_COPILOT_SETTINGS,
}

const DEFAULT_VISIBILITY_SETTINGS: Record<string, VisibilityLevel> = {
  SELF: 'FULL',
  SUPERVISOR: 'FULL',
  PEER: 'ANONYMOUS',
  SUBORDINATE: 'ANONYMOUS',
  CROSS_TEAM_PEER: 'ANONYMOUS',
  CROSS_DEPT: 'ANONYMOUS',
}

const VISIBILITY_LABELS: Record<VisibilityLevel, string> = {
  FULL: '작성자 정보 포함',
  ANONYMOUS: '익명 공개',
  PRIVATE: '운영자만 조회',
}

const REVIEWER_TYPE_LABELS: Record<string, string> = {
  SELF: '셀프',
  SUPERVISOR: '상향 / 리더',
  PEER: '동료',
  SUBORDINATE: '하향',
  CROSS_TEAM_PEER: '타 팀 동료',
  CROSS_DEPT: '타 부서',
}

function createLocalId(prefix: string) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function createEmptyRatingGuideRule(): FeedbackRatingGuideRule {
  return {
    id: createLocalId('rating-guide-rule'),
    label: '새 등급 가이드',
    headline: '',
    guidance: '',
    filters: {},
    gradeDescriptions: {},
  }
}

function getRatingQuestionOptions(round?: Feedback360PageData['availableRounds'][number] | null) {
  return (round?.questions ?? [])
    .filter((question) => question.questionType === 'RATING_SCALE')
    .map((question) => ({
      id: question.id,
      questionText: question.questionText,
      scaleMin: question.scaleMin,
      scaleMax: question.scaleMax,
    }))
}

function hydrateRatingGuideSettings(params: {
  round?: Feedback360PageData['availableRounds'][number] | null
  settings?: FeedbackRatingGuideSettings
}) {
  return parseFeedbackRatingGuideSettings(params.settings ?? DEFAULT_FEEDBACK_RATING_GUIDE_SETTINGS, getRatingQuestionOptions(params.round))
}

const RESULT_PRESENTATION_FIELDS: Array<{
  key: keyof FeedbackResultPresentationSettings['REVIEWEE']
  label: string
  description: string
}> = [
  {
    key: 'showLeaderComment',
    label: '팀장 평가 코멘트 공개',
    description: '직속 리더의 코멘트 본문을 결과지에 포함합니다.',
  },
  {
    key: 'showLeaderScore',
    label: '팀장 평가 등급 / 총점 공개',
    description: '직속 리더가 남긴 등급 또는 총점을 결과지에 표시합니다.',
  },
  {
    key: 'showExecutiveComment',
    label: '상위 평가 코멘트 공개',
    description: '실장 / 본부장 / 경영진 관점의 코멘트를 결과지에 포함합니다.',
  },
  {
    key: 'showExecutiveScore',
    label: '상위 평가 등급 / 총점 공개',
    description: '상위 평가자가 남긴 등급 또는 총점을 결과지에 표시합니다.',
  },
  {
    key: 'showFinalScore',
    label: '최종 결과 등급 / 총점 공개',
    description: '최종 합산 결과의 등급과 총점을 결과지에 노출합니다.',
  },
  {
    key: 'showFinalComment',
    label: '최종 결과 코멘트 공개',
    description: '종합 결과와 익명 요약 코멘트를 결과지에 포함합니다.',
  },
]

const REPORT_ANALYSIS_WORDING_FIELDS: Array<{
  key: keyof FeedbackReportAnalysisSettings['wording']
  label: string
  description: string
}> = [
  {
    key: 'strengthLabel',
    label: '강점 라벨',
    description: '질문별 인사이트에서 강점으로 표시할 용어입니다.',
  },
  {
    key: 'improvementLabel',
    label: '보완점 라벨',
    description: '기본 약점 표현 대신 조직 언어에 맞는 보완점 용어를 사용할 수 있습니다.',
  },
  {
    key: 'selfAwarenessLabel',
    label: '자기객관화 라벨',
    description: '셀프 평가와 타인 평균 비교 섹션에 사용할 표현입니다.',
  },
  {
    key: 'selfHighLabel',
    label: '자기 인식 높음 라벨',
    description: '셀프 점수가 타인 평균보다 높을 때 표시할 표현입니다.',
  },
  {
    key: 'selfLowLabel',
    label: '자기 인식 낮음 라벨',
    description: '셀프 점수가 타인 평균보다 낮을 때 표시할 표현입니다.',
  },
  {
    key: 'balancedLabel',
    label: '균형 라벨',
    description: '큰 차이가 없을 때 표시할 표현입니다.',
  },
]

function createEmptyCondition(field: 'JOIN_DATE' | 'POSITION'): OnboardingCondition {
  if (field === 'POSITION') {
    return {
      id: createLocalId('position'),
      field: 'POSITION',
      operator: 'IN',
      values: ['MEMBER'],
    }
  }

  return {
    id: createLocalId('join-date'),
    field: 'JOIN_DATE',
    operator: 'ON_OR_AFTER',
    value: new Date().toISOString().slice(0, 10),
    valueTo: null,
  }
}

function createEmptyStep(stepOrder: number): OnboardingWorkflowDraft['steps'][number] {
  return {
    id: createLocalId(`step-${stepOrder}`),
    stepOrder,
    stepName: `${stepOrder}단계`,
    triggerDaysAfterJoin: stepOrder === 1 ? 7 : stepOrder * 30,
    durationDays: 14,
    reviewNameTemplate: ONBOARDING_REVIEW_DEFAULT_TEMPLATE,
    includeEmployeeNameInName: true,
    includeHireDateInName: false,
  }
}

function createEmptyWorkflowDraft(evalCycleId: string): OnboardingWorkflowDraft {
  return {
    evalCycleId,
    workflowName: '',
    isActive: true,
    scheduleHourKst: 8,
    targetConditions: [createEmptyCondition('JOIN_DATE')],
    steps: [createEmptyStep(1)],
  }
}

function hydrateWorkflowDraft(evalCycleId: string, workflow?: OnboardingWorkflow | null): OnboardingWorkflowDraft {
  if (!workflow) {
    return createEmptyWorkflowDraft(evalCycleId)
  }

  return {
    id: workflow.id,
    evalCycleId,
    workflowName: workflow.workflowName,
    isActive: workflow.isActive,
    scheduleHourKst: workflow.scheduleHourKst,
    targetConditions: workflow.targetConditions.map((condition) => ({ ...condition })),
    steps: workflow.steps.map((step) => ({
      id: step.id,
      stepOrder: step.stepOrder,
      stepName: step.stepName,
      triggerDaysAfterJoin: step.triggerDaysAfterJoin,
      durationDays: step.durationDays,
      reviewNameTemplate: step.reviewNameTemplate,
      includeEmployeeNameInName: step.includeEmployeeNameInName,
      includeHireDateInName: step.includeHireDateInName,
    })),
  }
}

function getReminderKind(action: ReminderAction) {
  if (action === 'send-peer-selection-reminder') return 'peer-selection-reminder'
  if (action === 'send-result-share') return 'result-share'
  return 'review-reminder'
}

function getReminderTemplate(roundName: string, action: ReminderAction) {
  if (action === 'send-peer-selection-reminder') {
    return {
      subject: `[360 리뷰] ${roundName} 동료 선택 / 승인 확인 요청`,
      body: `안녕하세요.\n\n${roundName}의 동료 선택 또는 승인 단계가 아직 완료되지 않았습니다.\n현재 구성을 확인하고 필요한 수정 또는 승인을 진행해 주세요.\n\n감사합니다.`,
    }
  }

  if (action === 'send-result-share') {
    return {
      subject: `[360 리뷰] ${roundName} 결과 공유 안내`,
      body: `안녕하세요.\n\n${roundName} 결과가 준비되었습니다.\n현재 공개 범위와 익명 기준을 확인한 뒤 결과를 열람해 주세요.\n\n감사합니다.`,
    }
  }

  return {
    subject: `[360 리뷰] ${roundName} 응답 리마인드`,
    body: `안녕하세요.\n\n${roundName}의 리뷰 응답이 아직 제출되지 않았습니다.\n마감 전에 응답을 완료해 주세요.\n\n감사합니다.`,
  }
}

export function Feedback360AdminPanel(props: { data: Feedback360PageData }) {
  const router = useRouter()
  const { requestRiskConfirmation, riskDialog } = useImpersonationRiskAction()
  const rounds = props.data.availableRounds
  const admin = props.data.admin
  const onboarding = admin?.onboarding
  const selectedCycle =
    props.data.availableCycles.find((cycle) => cycle.id === props.data.selectedCycleId) ??
    props.data.availableCycles[0] ??
    null

  const [banner, setBanner] = useState<Banner | null>(null)
  const [folderFilter, setFolderFilter] = useState<'ALL' | 'UNCATEGORIZED' | string>('ALL')
  const [folderDialogOpen, setFolderDialogOpen] = useState(false)
  const [groupDialogOpen, setGroupDialogOpen] = useState(false)
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false)
  const [reminderDialogOpen, setReminderDialogOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [selectedRoundId, setSelectedRoundId] = useState(props.data.selectedRoundId ?? rounds[0]?.id ?? '')
  const [folderDraft, setFolderDraft] = useState({ id: '', name: '', description: '' })
  const [groupSearch, setGroupSearch] = useState('')
  const [collaboratorSearch, setCollaboratorSearch] = useState('')
  const [collaboratorIds, setCollaboratorIds] = useState<string[]>([])
  const [groupDraft, setGroupDraft] = useState<{
    id: string
    groupName: string
    description: string
    reviewScope: ReviewAdminScope
    memberIds: string[]
  }>({
    id: '',
    groupName: '',
    description: '',
    reviewScope: 'COLLABORATOR_REVIEWS_MANAGE',
    memberIds: [],
  })
  const [reminderAction, setReminderAction] = useState<ReminderAction>('send-review-reminder')
  const [shareAudience, setShareAudience] = useState<'REVIEWEE' | 'LEADER' | 'LEADER_AND_REVIEWEE'>('REVIEWEE')
  const [reminderStatusFilter, setReminderStatusFilter] = useState<'ALL' | string>('ALL')
  const [reminderSearch, setReminderSearch] = useState('')
  const [selectedTargetIds, setSelectedTargetIds] = useState<string[]>([])
  const [reminderSubject, setReminderSubject] = useState('')
  const [reminderBody, setReminderBody] = useState('')
  const [testEmail, setTestEmail] = useState('')
  const [selectionSettings, setSelectionSettings] = useState(DEFAULT_SELECTION_SETTINGS)
  const [visibilitySettings, setVisibilitySettings] = useState<Record<string, VisibilityLevel>>(DEFAULT_VISIBILITY_SETTINGS)
  const [resultPresentationSettings, setResultPresentationSettings] = useState<FeedbackResultPresentationSettings>(
    DEFAULT_FEEDBACK_RESULT_PRESENTATION_SETTINGS
  )
  const [reportAnalysisSettings, setReportAnalysisSettings] = useState<FeedbackReportAnalysisSettings>(
    DEFAULT_FEEDBACK_REPORT_ANALYSIS_SETTINGS
  )
  const [ratingGuideSettings, setRatingGuideSettings] = useState<FeedbackRatingGuideSettings>(
    DEFAULT_FEEDBACK_RATING_GUIDE_SETTINGS
  )
  const [selectedResultVersionProfile, setSelectedResultVersionProfile] =
    useState<FeedbackResultRecipientProfile>('REVIEWEE')
  const [selectedResultShareTargetIds, setSelectedResultShareTargetIds] = useState<string[]>([])
  const [pendingReminderPrefillIds, setPendingReminderPrefillIds] = useState<string[] | null>(null)
  const [questionDrafts, setQuestionDrafts] = useState<Array<{ id: string; category: string; questionText: string }>>([])
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>('new')
  const [workflowDraft, setWorkflowDraft] = useState<OnboardingWorkflowDraft>(
    createEmptyWorkflowDraft(props.data.selectedCycleId ?? '')
  )
  const [generatedReviewSearch, setGeneratedReviewSearch] = useState('')
  const [generatedReviewStatusFilter, setGeneratedReviewStatusFilter] = useState<'ALL' | string>('ALL')
  const [generatedReviewSort, setGeneratedReviewSort] =
    useState<OnboardingGeneratedReviewSort>('CREATED_DESC')
  const [anytimeDocumentKind, setAnytimeDocumentKind] = useState<FeedbackAnytimeDocumentKind>('ANYTIME')
  const [anytimeRoundName, setAnytimeRoundName] = useState('')
  const [anytimeReviewerId, setAnytimeReviewerId] = useState('')
  const [anytimeTargetIds, setAnytimeTargetIds] = useState<string[]>([])
  const [anytimeDueDate, setAnytimeDueDate] = useState('')
  const [anytimeReason, setAnytimeReason] = useState('')
  const [anytimeTemplateRoundId, setAnytimeTemplateRoundId] = useState('')
  const [anytimeCollaboratorIds, setAnytimeCollaboratorIds] = useState<string[]>([])
  const [anytimeFolderId, setAnytimeFolderId] = useState('')
  const [anytimeProjectName, setAnytimeProjectName] = useState('')
  const [anytimeProjectCode, setAnytimeProjectCode] = useState('')
  const [pipGoalsText, setPipGoalsText] = useState('')
  const [pipExpectedText, setPipExpectedText] = useState('')
  const [pipCheckpointsText, setPipCheckpointsText] = useState('')
  const [pipMidReview, setPipMidReview] = useState('')
  const [pipEndJudgement, setPipEndJudgement] = useState('')
  const [anytimeSearch, setAnytimeSearch] = useState('')
  const [selectedAnytimeRoundIds, setSelectedAnytimeRoundIds] = useState<string[]>([])
  const [anytimeBulkReviewerId, setAnytimeBulkReviewerId] = useState('')
  const [anytimeBulkDueDate, setAnytimeBulkDueDate] = useState('')
  const [anytimeBulkReason, setAnytimeBulkReason] = useState('')

  const selectedRound = rounds.find((round) => round.id === selectedRoundId) ?? rounds[0] ?? null
  const reviewAdmin = admin?.reviewAdmin
  const anytimeReview = admin?.anytimeReview
  const selectedReminderKind = getReminderKind(reminderAction)
  const hasReminderBodyContent = reviewEmailHtmlToText(reminderBody).trim().length > 0
  const selectedWorkflow =
    onboarding?.workflows.find((workflow) => workflow.id === selectedWorkflowId) ?? null
  const resultShare = admin?.resultShare
  const managerEffectivenessAdmin = admin?.managerEffectiveness
  const resultShareRows = resultShare?.rows ?? []
  const currentUserRole = props.data.currentUser?.role ?? 'ROLE_MEMBER'
  const canManageAllReviewRounds =
    reviewAdmin?.currentAccess.canManageAllRounds ?? currentUserRole === 'ROLE_ADMIN'
  const canManageCollaboratorReviewRounds =
    reviewAdmin?.currentAccess.canManageCollaboratorRounds ?? canManageAllReviewRounds
  const canEditReviewAdminGroups = currentUserRole === 'ROLE_ADMIN'
  const canManageFolders = canManageAllReviewRounds
  const ratingQuestionOptions = useMemo(() => getRatingQuestionOptions(selectedRound), [selectedRound])
  const ratingGuideScaleEntries = useMemo(
    () => annotateFeedbackRatingScaleEntries(ratingGuideSettings.scaleEntries),
    [ratingGuideSettings.scaleEntries]
  )
  const visibleResultShareTargetIds = useMemo(
    () => resultShareRows.map((row) => row.targetId),
    [resultShareRows]
  )
  const allResultShareSelected =
    visibleResultShareTargetIds.length > 0 &&
    visibleResultShareTargetIds.every((id) => selectedResultShareTargetIds.includes(id))

  const folderCards = useMemo(
    () => [
      { id: 'ALL', name: '전체 라운드', count: rounds.length },
      { id: 'UNCATEGORIZED', name: '미분류', count: rounds.filter((round) => !round.folderId).length },
      ...(admin?.folders ?? []).map((folder) => ({
        id: folder.id,
        name: folder.name,
        count: rounds.filter((round) => round.folderId === folder.id).length,
      })),
    ],
    [admin?.folders, rounds]
  )

  const reviewAdminCandidates = reviewAdmin?.candidateMembers ?? []
  const filteredReviewAdminCandidates = useMemo(() => {
    const keyword = groupSearch.trim()
    if (!keyword) return reviewAdminCandidates
    return reviewAdminCandidates.filter((candidate) =>
      [candidate.name, candidate.departmentName, candidate.position, candidate.email]
        .filter(Boolean)
        .some((value) => value.includes(keyword))
    )
  }, [groupSearch, reviewAdminCandidates])

  const eligibleCollaboratorCandidates = useMemo(
    () =>
      reviewAdminCandidates.filter(
        (candidate) => candidate.canManageCollaboratorRounds || currentUserRole === 'ROLE_ADMIN'
      ),
    [currentUserRole, reviewAdminCandidates]
  )

  const filteredCollaboratorCandidates = useMemo(() => {
    const keyword = collaboratorSearch.trim()
    if (!keyword) return eligibleCollaboratorCandidates
    return eligibleCollaboratorCandidates.filter((candidate) =>
      [candidate.name, candidate.departmentName, candidate.position, candidate.email]
        .filter(Boolean)
        .some((value) => value.includes(keyword))
    )
  }, [collaboratorSearch, eligibleCollaboratorCandidates])

  const selectedCollaborators = useMemo(() => {
    const candidateMap = new Map(reviewAdminCandidates.map((candidate) => [candidate.employeeId, candidate] as const))
    return collaboratorIds
      .map((employeeId) => candidateMap.get(employeeId))
      .filter((candidate): candidate is ReviewAdminCandidate => Boolean(candidate))
  }, [collaboratorIds, reviewAdminCandidates])

  const selectedGroupMembers = useMemo(() => {
    const candidateMap = new Map(reviewAdminCandidates.map((candidate) => [candidate.employeeId, candidate] as const))
    return groupDraft.memberIds
      .map((employeeId) => candidateMap.get(employeeId))
      .filter((candidate): candidate is ReviewAdminCandidate => Boolean(candidate))
  }, [groupDraft.memberIds, reviewAdminCandidates])

  const filteredRounds = useMemo(
    () =>
      rounds.filter((round) => {
        if (folderFilter === 'ALL') return true
        if (folderFilter === 'UNCATEGORIZED') return !round.folderId
        return round.folderId === folderFilter
      }),
    [folderFilter, rounds]
  )

  const filteredReminderTargets = useMemo(
    () =>
      (admin?.reminderTargets ?? []).filter((item) => {
        if (selectedRoundId && item.roundId !== selectedRoundId) return false
        if (item.kind !== selectedReminderKind) return false
        if (reminderStatusFilter !== 'ALL' && item.statusKey !== reminderStatusFilter) return false
        if (!reminderSearch.trim()) return true
        const keyword = reminderSearch.trim()
        return (
          item.recipientName.includes(keyword) ||
          item.roundName.includes(keyword) ||
          item.detail.includes(keyword) ||
          item.departmentName?.includes(keyword) ||
          item.statusLabel.includes(keyword)
        )
      }),
    [admin?.reminderTargets, reminderSearch, reminderStatusFilter, selectedReminderKind, selectedRoundId]
  )

  const reminderTargetsForScope = useMemo(
    () =>
      (admin?.reminderTargets ?? []).filter((item) => {
        if (selectedRoundId && item.roundId !== selectedRoundId) return false
        return item.kind === selectedReminderKind
      }),
    [admin?.reminderTargets, selectedReminderKind, selectedRoundId]
  )

  const reminderStatusOptions = useMemo(
    () =>
      Array.from(
        reminderTargetsForScope.reduce(
          (map, item) => map.set(item.statusKey, { key: item.statusKey, label: item.statusLabel }),
          new Map<string, { key: string; label: string }>()
        ).values()
      ),
    [reminderTargetsForScope]
  )

  const reminderStatusSummary = useMemo(
    () =>
      reminderTargetsForScope.reduce<Record<string, { label: string; tone: ReminderTarget['statusTone']; count: number }>>(
        (summary, item) => {
          summary[item.statusKey] = summary[item.statusKey]
            ? {
                ...summary[item.statusKey],
                count: summary[item.statusKey].count + 1,
              }
            : {
                label: item.statusLabel,
                tone: item.statusTone,
                count: 1,
              }
          return summary
        },
        {}
      ),
    [reminderTargetsForScope]
  )

  const visibleReminderRecipientIds = useMemo(
    () => Array.from(new Set(filteredReminderTargets.map((item) => item.recipientId))),
    [filteredReminderTargets]
  )

  const allMatchingSelected = visibleReminderRecipientIds.length > 0 && visibleReminderRecipientIds.every((id) => selectedTargetIds.includes(id))

  const healthSummary = useMemo(() => {
    const source = admin?.roundHealth ?? []
    return {
      lowResponseCount: source.filter((item) => item.responseRate < 60).length,
      riskCount: source.reduce((sum, item) => sum + item.qualityRiskCount, 0),
      pendingCount: source.reduce((sum, item) => sum + item.pendingCount, 0),
    }
  }, [admin?.roundHealth])

  const generatedReviewStatusOptions = useMemo(
    () =>
      Array.from(
        new Set((onboarding?.generatedReviews ?? []).map((review) => review.status))
      ).sort(),
    [onboarding?.generatedReviews]
  )

  const filteredGeneratedReviews = useMemo(() => {
    const filtered = (onboarding?.generatedReviews ?? []).filter((review) => {
      if (generatedReviewStatusFilter !== 'ALL' && review.status !== generatedReviewStatusFilter) {
        return false
      }

      if (!generatedReviewSearch.trim()) return true
      const keyword = generatedReviewSearch.trim()
      return (
        review.roundName.includes(keyword) ||
        review.targetName.includes(keyword) ||
        review.targetDepartment.includes(keyword) ||
        review.workflowName.includes(keyword) ||
        review.stepName.includes(keyword)
      )
    })

    return sortOnboardingGeneratedReviews(filtered, generatedReviewSort)
  }, [generatedReviewSearch, generatedReviewSort, generatedReviewStatusFilter, onboarding?.generatedReviews])

  const filteredAnytimeDocuments = useMemo(() => {
    const source = anytimeReview?.documents ?? []
    if (!anytimeSearch.trim()) return source
    const keyword = anytimeSearch.trim()
    return source.filter((document) =>
      [
        document.roundName,
        document.documentKindLabel,
        document.targetName,
        document.targetDepartmentName,
        document.reviewerName,
        document.reason,
        document.projectName ?? '',
        document.templateRoundName ?? '',
      ].some((value) => value.includes(keyword))
    )
  }, [anytimeReview?.documents, anytimeSearch])
  const anytimeEmployeeOptions = anytimeReview?.employeeOptions ?? []
  const anytimeTemplateOptions = anytimeReview?.templateOptions ?? []
  const anytimeFolderOptions = admin?.folders ?? []
  const allAnytimeRoundsSelected =
    filteredAnytimeDocuments.length > 0 &&
    filteredAnytimeDocuments.every((document) => selectedAnytimeRoundIds.includes(document.roundId))

  useEffect(() => {
    setBanner(null)
    setFolderDialogOpen(false)
    setGroupDialogOpen(false)
    setSettingsDialogOpen(false)
    setReminderDialogOpen(false)
    setGroupSearch('')
    setCollaboratorSearch('')
    setCollaboratorIds([])
    setGeneratedReviewSearch('')
    setGeneratedReviewStatusFilter('ALL')
    setGeneratedReviewSort('CREATED_DESC')
    setAnytimeDocumentKind('ANYTIME')
    setAnytimeRoundName('')
    setAnytimeReviewerId('')
    setAnytimeTargetIds([])
    setAnytimeDueDate('')
    setAnytimeReason('')
    setAnytimeTemplateRoundId('')
    setAnytimeCollaboratorIds([])
    setAnytimeFolderId('')
    setAnytimeProjectName('')
    setAnytimeProjectCode('')
    setPipGoalsText('')
    setPipExpectedText('')
    setPipCheckpointsText('')
    setPipMidReview('')
    setPipEndJudgement('')
    setAnytimeSearch('')
    setSelectedAnytimeRoundIds([])
    setAnytimeBulkReviewerId('')
    setAnytimeBulkDueDate('')
    setAnytimeBulkReason('')
    setSelectedRoundId(props.data.selectedRoundId ?? rounds[0]?.id ?? '')
  }, [props.data.selectedCycleId, props.data.selectedRoundId, rounds])

  useEffect(() => {
    const nextSelectionSource =
      selectedRound?.selectionSettings ?? admin?.settings?.selectionSettings ?? DEFAULT_SELECTION_SETTINGS
    const nextSelection = {
      ...DEFAULT_SELECTION_SETTINGS,
      ...nextSelectionSource,
      managerEffectiveness:
        nextSelectionSource.managerEffectiveness ?? DEFAULT_FEEDBACK_MANAGER_EFFECTIVENESS_SETTINGS,
      skillArchitecture:
        nextSelectionSource.skillArchitecture ?? DEFAULT_FEEDBACK_SKILL_ARCHITECTURE_SETTINGS,
      aiCopilot: nextSelectionSource.aiCopilot ?? DEFAULT_FEEDBACK_AI_COPILOT_SETTINGS,
    }
    const nextVisibility = selectedRound?.visibilitySettings ?? admin?.settings?.visibilitySettings ?? DEFAULT_VISIBILITY_SETTINGS
    const nextPresentation =
      selectedRound?.resultPresentationSettings ??
      admin?.settings?.resultPresentationSettings ??
      DEFAULT_FEEDBACK_RESULT_PRESENTATION_SETTINGS
    const nextReportAnalysis =
      selectedRound?.reportAnalysisSettings ??
      admin?.settings?.reportAnalysisSettings ??
      DEFAULT_FEEDBACK_REPORT_ANALYSIS_SETTINGS
    const nextRatingGuide = hydrateRatingGuideSettings({
      round: selectedRound,
      settings: selectedRound?.ratingGuideSettings ?? admin?.settings?.ratingGuideSettings,
    })
    const nextCollaboratorIds =
      selectedRound?.collaborators.map((collaborator) => collaborator.employeeId) ??
      admin?.settings?.collaboratorIds ??
      []
    setSelectionSettings(nextSelection)
    setVisibilitySettings(nextVisibility)
    setResultPresentationSettings(nextPresentation)
    setReportAnalysisSettings(nextReportAnalysis)
    setRatingGuideSettings(nextRatingGuide)
    setCollaboratorIds(nextCollaboratorIds)
    setQuestionDrafts(
      (selectedRound?.questions ?? []).map((question) => ({
        id: question.id,
        category: question.category,
        questionText: question.questionText,
      }))
    )
  }, [
    admin?.settings?.resultPresentationSettings,
    admin?.settings?.reportAnalysisSettings,
    admin?.settings?.ratingGuideSettings,
    admin?.settings?.selectionSettings,
    admin?.settings?.visibilitySettings,
    selectedRound,
  ])

  useEffect(() => {
    const availableIds = new Set(filteredReminderTargets.map((item) => item.recipientId))
    setSelectedTargetIds((current) => current.filter((item) => availableIds.has(item)))
  }, [filteredReminderTargets])

  useEffect(() => {
    const availableIds = new Set(visibleResultShareTargetIds)
    setSelectedResultShareTargetIds((current) => current.filter((item) => availableIds.has(item)))
  }, [visibleResultShareTargetIds])

  useEffect(() => {
    const availableIds = new Set(filteredAnytimeDocuments.map((document) => document.roundId))
    setSelectedAnytimeRoundIds((current) => current.filter((item) => availableIds.has(item)))
  }, [filteredAnytimeDocuments])

  useEffect(() => {
    const template = getReminderTemplate(selectedRound?.roundName ?? '360 리뷰', reminderAction)
    setReminderSubject(template.subject)
    setReminderBody(template.body)
  }, [reminderAction, selectedRound])

  useEffect(() => {
    setReminderSearch('')
    setReminderStatusFilter('ALL')
    setSelectedTargetIds([])
    setShareAudience('REVIEWEE')
  }, [selectedRoundId, reminderAction])

  useEffect(() => {
    setSelectedResultShareTargetIds([])
    setSelectedResultVersionProfile('REVIEWEE')
  }, [selectedRoundId])

  useEffect(() => {
    if (!reminderDialogOpen || reminderAction !== 'send-result-share' || !pendingReminderPrefillIds) {
      return
    }

    setSelectedTargetIds(pendingReminderPrefillIds)
    setPendingReminderPrefillIds(null)
  }, [pendingReminderPrefillIds, reminderAction, reminderDialogOpen])

  useEffect(() => {
    setSelectedWorkflowId('new')
    setWorkflowDraft(createEmptyWorkflowDraft(props.data.selectedCycleId ?? ''))
    setGeneratedReviewSearch('')
    setGeneratedReviewStatusFilter('ALL')
  }, [props.data.selectedCycleId])

  useEffect(() => {
    if (!selectedWorkflow) {
      setWorkflowDraft(createEmptyWorkflowDraft(props.data.selectedCycleId ?? ''))
      return
    }

    setWorkflowDraft(hydrateWorkflowDraft(props.data.selectedCycleId ?? '', selectedWorkflow))
  }, [props.data.selectedCycleId, selectedWorkflow])

  function selectAllMatchingTargets() {
    setSelectedTargetIds(visibleReminderRecipientIds)
  }

  function toggleAllMatchingTargets() {
    setSelectedTargetIds((current) =>
      allMatchingSelected ? current.filter((item) => !visibleReminderRecipientIds.includes(item)) : visibleReminderRecipientIds
    )
  }

  function toggleTarget(recipientId: string) {
    setSelectedTargetIds((current) =>
      current.includes(recipientId)
        ? current.filter((item) => item !== recipientId)
        : [...current, recipientId]
    )
  }

  function selectAllResultShareTargets() {
    setSelectedResultShareTargetIds(visibleResultShareTargetIds)
  }

  function toggleAllResultShareTargets() {
    setSelectedResultShareTargetIds((current) =>
      allResultShareSelected
        ? current.filter((item) => !visibleResultShareTargetIds.includes(item))
        : visibleResultShareTargetIds
    )
  }

  function toggleResultShareTarget(targetId: string) {
    setSelectedResultShareTargetIds((current) =>
      current.includes(targetId)
        ? current.filter((item) => item !== targetId)
        : [...current, targetId]
    )
  }

  function openResultShareReminder(targetIds: string[]) {
    setSelectedRoundId(resultShare?.roundId ?? selectedRoundId)
    setPendingReminderPrefillIds(targetIds)
    setReminderAction('send-result-share')
    setReminderDialogOpen(true)
  }

  function parseTextareaLines(text: string) {
    return text
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean)
  }

  function parsePipCheckpoints(text: string) {
    return parseTextareaLines(text).map((label) => ({ label }))
  }

  function toggleAnytimeTarget(targetId: string) {
    setAnytimeTargetIds((current) =>
      current.includes(targetId)
        ? current.filter((item) => item !== targetId)
        : [...current, targetId]
    )
  }

  function toggleAnytimeCollaborator(employeeId: string) {
    setAnytimeCollaboratorIds((current) =>
      current.includes(employeeId)
        ? current.filter((item) => item !== employeeId)
        : [...current, employeeId]
    )
  }

  function toggleAnytimeRoundSelection(roundId: string) {
    setSelectedAnytimeRoundIds((current) =>
      current.includes(roundId)
        ? current.filter((item) => item !== roundId)
        : [...current, roundId]
    )
  }

  function toggleAllAnytimeRounds() {
    const visibleIds = filteredAnytimeDocuments.map((document) => document.roundId)
    const allSelected =
      visibleIds.length > 0 && visibleIds.every((roundId) => selectedAnytimeRoundIds.includes(roundId))

    setSelectedAnytimeRoundIds((current) =>
      allSelected ? current.filter((item) => !visibleIds.includes(item)) : visibleIds
    )
  }

  async function handleCreateAnytimeReview() {
    if (!props.data.selectedCycleId) {
      setBanner({ tone: 'error', message: '먼저 평가 주기를 선택해 주세요.' })
      return
    }

    if (!anytimeRoundName.trim()) {
      setBanner({ tone: 'error', message: '수시 리뷰 문서 이름을 입력해 주세요.' })
      return
    }

    if (!anytimeReviewerId) {
      setBanner({ tone: 'error', message: '리뷰어를 선택해 주세요.' })
      return
    }

    if (!anytimeTargetIds.length) {
      setBanner({ tone: 'error', message: '리뷰 대상자를 한 명 이상 선택해 주세요.' })
      return
    }

    if (!anytimeDueDate) {
      setBanner({ tone: 'error', message: '마감 기한을 입력해 주세요.' })
      return
    }

    if (!anytimeReason.trim()) {
      setBanner({ tone: 'error', message: '문서 생성 사유를 입력해 주세요.' })
      return
    }

    setBusy(true)
    try {
      const response = await fetch('/api/feedback/rounds', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          evalCycleId: props.data.selectedCycleId,
          roundName: anytimeRoundName,
          documentKind: anytimeDocumentKind,
          dueDate: new Date(anytimeDueDate).toISOString(),
          reviewerId: anytimeReviewerId,
          targetIds: anytimeTargetIds,
          reason: anytimeReason,
          templateRoundId: anytimeTemplateRoundId || undefined,
          collaboratorIds: anytimeCollaboratorIds,
          folderId: anytimeFolderId || undefined,
          projectName: anytimeProjectName || undefined,
          projectCode: anytimeProjectCode || undefined,
          pip:
            anytimeDocumentKind === 'PIP'
              ? {
                  goals: parseTextareaLines(pipGoalsText),
                  expectedBehaviors: parseTextareaLines(pipExpectedText),
                  checkpoints: parsePipCheckpoints(pipCheckpointsText),
                  midReview: pipMidReview,
                  endJudgement: pipEndJudgement,
                }
              : undefined,
        }),
      })

      const payload = await response.json()
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error?.message || '수시 리뷰 문서를 생성하지 못했습니다.')
      }

      setBanner({ tone: 'success', message: payload.data.message || '수시 리뷰 문서를 생성했습니다.' })
      setAnytimeRoundName('')
      setAnytimeReviewerId('')
      setAnytimeTargetIds([])
      setAnytimeDueDate('')
      setAnytimeReason('')
      setAnytimeTemplateRoundId('')
      setAnytimeCollaboratorIds([])
      setAnytimeFolderId('')
      setAnytimeProjectName('')
      setAnytimeProjectCode('')
      setPipGoalsText('')
      setPipExpectedText('')
      setPipCheckpointsText('')
      setPipMidReview('')
      setPipEndJudgement('')
      router.refresh()
    } catch (error) {
      setBanner({
        tone: 'error',
        message: error instanceof Error ? error.message : '수시 리뷰 문서를 생성하지 못했습니다.',
      })
    } finally {
      setBusy(false)
    }
  }

  async function handleAnytimeBulkAction(
    action: 'change-due-date' | 'transfer-reviewer' | 'cancel' | 'close' | 'reopen'
  ) {
    if (!selectedAnytimeRoundIds.length) {
      setBanner({ tone: 'error', message: '처리할 수시 리뷰 문서를 먼저 선택해 주세요.' })
      return
    }

    if (action === 'change-due-date' && !anytimeBulkDueDate) {
      setBanner({ tone: 'error', message: '변경할 기한을 입력해 주세요.' })
      return
    }

    if (action === 'transfer-reviewer' && !anytimeBulkReviewerId) {
      setBanner({ tone: 'error', message: '이관할 리뷰어를 선택해 주세요.' })
      return
    }

    if (!anytimeBulkReason.trim()) {
      setBanner({ tone: 'error', message: '일괄 작업 사유를 입력해 주세요.' })
      return
    }

    setBusy(true)
    try {
      const response = await fetch('/api/feedback/rounds', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          roundIds: selectedAnytimeRoundIds,
          dueDate: anytimeBulkDueDate ? new Date(anytimeBulkDueDate).toISOString() : undefined,
          reviewerId: anytimeBulkReviewerId || undefined,
          reason: anytimeBulkReason,
        }),
      })

      const payload = await response.json()
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error?.message || '수시 리뷰 문서 일괄 작업을 완료하지 못했습니다.')
      }

      const failureCount = payload.data.failureCount ?? 0
      setBanner({
        tone: failureCount > 0 ? 'info' : 'success',
        message: payload.data.message || '수시 리뷰 문서 일괄 작업을 완료했습니다.',
      })
      if (failureCount === 0) {
        setSelectedAnytimeRoundIds([])
      }
      setAnytimeBulkReason('')
      router.refresh()
    } catch (error) {
      setBanner({
        tone: 'error',
        message: error instanceof Error ? error.message : '수시 리뷰 문서 일괄 작업을 완료하지 못했습니다.',
      })
    } finally {
      setBusy(false)
    }
  }

  function updateWorkflowCondition(conditionId: string, nextValue: Partial<OnboardingCondition>) {
    setWorkflowDraft((current) => ({
      ...current,
      targetConditions: current.targetConditions.map((condition) =>
        condition.id === conditionId ? ({ ...condition, ...nextValue } as OnboardingCondition) : condition
      ),
    }))
  }

  function updateWorkflowStep(
    stepId: string,
    nextValue: Partial<OnboardingWorkflowDraft['steps'][number]>
  ) {
    setWorkflowDraft((current) => ({
      ...current,
      steps: current.steps.map((step) =>
        step.id === stepId ? { ...step, ...nextValue } : step
      ),
    }))
  }

  function addWorkflowCondition(field: 'JOIN_DATE' | 'POSITION') {
    setWorkflowDraft((current) => ({
      ...current,
      targetConditions: [...current.targetConditions, createEmptyCondition(field)],
    }))
  }

  function removeWorkflowCondition(conditionId: string) {
    setWorkflowDraft((current) => ({
      ...current,
      targetConditions:
        current.targetConditions.length > 1
          ? current.targetConditions.filter((condition) => condition.id !== conditionId)
          : current.targetConditions,
    }))
  }

  function addWorkflowStep() {
    setWorkflowDraft((current) => ({
      ...current,
      steps: [
        ...current.steps,
        createEmptyStep(
          Math.max(
            0,
            ...current.steps.map((step) => step.stepOrder)
          ) + 1
        ),
      ],
    }))
  }

  function removeWorkflowStep(stepId: string) {
    setWorkflowDraft((current) => ({
      ...current,
      steps:
        current.steps.length > 1
          ? current.steps.filter((step) => step.id !== stepId)
          : current.steps,
    }))
  }

  async function refreshWithMessage(message: string) {
    setBanner({ tone: 'success', message })
    router.refresh()
  }

  async function handleSaveOnboardingWorkflow() {
    setBusy(true)
    try {
      const normalizedSteps = workflowDraft.steps
        .map((step, index) => ({
          ...step,
          stepOrder: index + 1,
          reviewNameTemplate: step.reviewNameTemplate.trim() || ONBOARDING_REVIEW_DEFAULT_TEMPLATE,
        }))
      const response = await fetch('/api/feedback/onboarding-workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...workflowDraft,
          steps: normalizedSteps,
        }),
      })
      const json = await response.json()
      if (!json.success) {
        throw new Error(json.error?.message || '온보딩 리뷰 워크플로우를 저장하지 못했습니다.')
      }
      if (json.data?.id) {
        setSelectedWorkflowId(json.data.id)
      }
      await refreshWithMessage(json.data?.message ?? '온보딩 리뷰 워크플로우를 저장했습니다.')
    } catch (error) {
      setBanner({
        tone: 'error',
        message: error instanceof Error ? error.message : '온보딩 리뷰 워크플로우를 저장하지 못했습니다.',
      })
    } finally {
      setBusy(false)
    }
  }

  async function handleRunOnboardingWorkflow() {
    if (!props.data.selectedCycleId) return

    setBusy(true)
    try {
      const response = await fetch('/api/feedback/onboarding-workflows/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cycleId: props.data.selectedCycleId,
          workflowId: workflowDraft.id,
        }),
      })
      const json = await response.json()
      if (!json.success) {
        throw new Error(json.error?.message || '온보딩 리뷰 자동 생성을 실행하지 못했습니다.')
      }
      await refreshWithMessage(json.data?.message ?? '온보딩 리뷰 자동 생성을 실행했습니다.')
    } catch (error) {
      setBanner({
        tone: 'error',
        message: error instanceof Error ? error.message : '온보딩 리뷰 자동 생성을 실행하지 못했습니다.',
      })
    } finally {
      setBusy(false)
    }
  }

  async function handleAssignFolder(roundId: string, folderId: string) {
    setBusy(true)
    try {
      const response = await fetch(`/api/feedback/rounds/${encodeURIComponent(roundId)}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId: folderId || null }),
      })
      const json = await response.json()
      if (!json.success) {
        throw new Error(json.error?.message || '폴더를 저장하지 못했습니다.')
      }
      await refreshWithMessage('라운드 폴더를 저장했습니다.')
    } catch (error) {
      setBanner({
        tone: 'error',
        message: error instanceof Error ? error.message : '폴더를 저장하지 못했습니다.',
      })
    } finally {
      setBusy(false)
    }
  }

  async function handleSaveFolder() {
    setBusy(true)
    try {
      const response = await fetch('/api/feedback/folders', {
        method: folderDraft.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(folderDraft.id ? { id: folderDraft.id } : {}),
          name: folderDraft.name,
          description: folderDraft.description,
          sortOrder: 0,
        }),
      })
      const json = await response.json()
      if (!json.success) {
        throw new Error(json.error?.message || '폴더를 저장하지 못했습니다.')
      }
      setFolderDialogOpen(false)
      setFolderDraft({ id: '', name: '', description: '' })
      await refreshWithMessage(folderDraft.id ? '폴더를 수정했습니다.' : '폴더를 만들었습니다.')
    } catch (error) {
      setBanner({
        tone: 'error',
        message: error instanceof Error ? error.message : '폴더를 저장하지 못했습니다.',
      })
    } finally {
      setBusy(false)
    }
  }

  async function handleDeleteFolder(folderId: string) {
    setBusy(true)
    try {
      const response = await fetch('/api/feedback/folders', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: folderId }),
      })
      const json = await response.json()
      if (!json.success) {
        throw new Error(json.error?.message || '폴더를 삭제하지 못했습니다.')
      }
      if (folderFilter === folderId) {
        setFolderFilter('ALL')
      }
      setFolderDraft({ id: '', name: '', description: '' })
      await refreshWithMessage('폴더를 삭제하고 라운드를 미분류로 되돌렸습니다.')
    } catch (error) {
      setBanner({
        tone: 'error',
        message: error instanceof Error ? error.message : '폴더를 삭제하지 못했습니다.',
      })
    } finally {
      setBusy(false)
    }
  }

  function openReviewAdminGroupDialog(group?: ReviewAdminGroup | null) {
    if (!group) {
      setGroupDraft({
        id: '',
        groupName: '',
        description: '',
        reviewScope: 'COLLABORATOR_REVIEWS_MANAGE',
        memberIds: [],
      })
    } else {
      setGroupDraft({
        id: group.id,
        groupName: group.groupName,
        description: group.description ?? '',
        reviewScope: group.reviewScope,
        memberIds: group.members.map((member) => member.employeeId),
      })
    }
    setGroupSearch('')
    setGroupDialogOpen(true)
  }

  function toggleGroupMember(employeeId: string) {
    setGroupDraft((current) => ({
      ...current,
      memberIds: current.memberIds.includes(employeeId)
        ? current.memberIds.filter((item) => item !== employeeId)
        : [...current.memberIds, employeeId],
    }))
  }

  function toggleCollaborator(employeeId: string) {
    setCollaboratorIds((current) =>
      current.includes(employeeId) ? current.filter((item) => item !== employeeId) : [...current, employeeId]
    )
  }

  async function handleSaveReviewAdminGroup() {
    if (!groupDraft.groupName.trim()) {
      setBanner({
        tone: 'error',
        message: '그룹 이름을 입력해 주세요.',
      })
      return
    }

    setBusy(true)
    try {
      const response = await fetch('/api/feedback/admin-groups', {
        method: groupDraft.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(groupDraft.id ? { id: groupDraft.id } : {}),
          groupName: groupDraft.groupName,
          description: groupDraft.description,
          reviewScope: groupDraft.reviewScope,
          memberIds: groupDraft.memberIds,
        }),
      })
      const json = await response.json()
      if (!json.success) {
        throw new Error(json.error?.message || '리뷰 권한 그룹을 저장하지 못했습니다.')
      }

      setGroupDialogOpen(false)
      await refreshWithMessage(
        groupDraft.id ? '리뷰 권한 그룹을 수정했습니다.' : '리뷰 권한 그룹을 만들었습니다.'
      )
    } catch (error) {
      setBanner({
        tone: 'error',
        message: error instanceof Error ? error.message : '리뷰 권한 그룹을 저장하지 못했습니다.',
      })
    } finally {
      setBusy(false)
    }
  }

  async function handleDeleteReviewAdminGroup(groupId: string) {
    setBusy(true)
    try {
      const response = await fetch('/api/feedback/admin-groups', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: groupId }),
      })
      const json = await response.json()
      if (!json.success) {
        throw new Error(json.error?.message || '리뷰 권한 그룹을 삭제하지 못했습니다.')
      }

      if (groupDraft.id === groupId) {
        setGroupDialogOpen(false)
      }
      await refreshWithMessage('리뷰 권한 그룹을 삭제했습니다.')
    } catch (error) {
      setBanner({
        tone: 'error',
        message: error instanceof Error ? error.message : '리뷰 권한 그룹을 삭제하지 못했습니다.',
      })
    } finally {
      setBusy(false)
    }
  }

  async function handleSaveSettings() {
    if (!selectedRound) return

    setBusy(true)
    try {
      const response = await fetch(`/api/feedback/rounds/${encodeURIComponent(selectedRound.id)}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            folderId: selectedRound.folderId ?? null,
            selectionSettings,
            visibilitySettings,
            resultPresentationSettings,
            reportAnalysisSettings,
            ratingGuideSettings,
            collaboratorIds,
            questions: questionDrafts.map(({ id, questionText }) => ({ id, questionText })),
          }),
        })
      const json = await response.json()
      if (!json.success) {
        throw new Error(json.error?.message || '라운드 설정을 저장하지 못했습니다.')
      }
      setSettingsDialogOpen(false)
      await refreshWithMessage('동료 선택 규칙, 익명 공개 범위, 결과지 버전 설정, 리뷰 문항 수정을 저장했습니다.')
    } catch (error) {
      setBanner({
        tone: 'error',
        message: error instanceof Error ? error.message : '라운드 설정을 저장하지 못했습니다.',
      })
    } finally {
      setBusy(false)
    }
  }

  async function handleReminder(mode: 'test' | 'send') {
    if (!selectedRound) return

    setBusy(true)
    try {
      let riskHeaders: HeadersInit | undefined
      if (mode === 'send' && reminderAction === 'send-result-share') {
        const confirmedHeaders = await requestRiskConfirmation({
          actionName: 'SHARE_RESULT',
          actionLabel: '다면 리뷰 결과 공유',
          targetLabel: selectedRound.roundName,
          detail: '현재 마스터 로그인 상태에서 다면 리뷰 결과를 실제 대상자에게 공유합니다.',
          confirmationText: '공유',
        })
        if (confirmedHeaders === null) {
          return
        }
        riskHeaders = confirmedHeaders
      }

      const response = await fetch(`/api/feedback/rounds/${encodeURIComponent(selectedRound.id)}/notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(riskHeaders ?? {}) },
        body: JSON.stringify({
          action: mode === 'test' ? 'test-send' : reminderAction,
          roundId: selectedRound.id,
          targetIds: selectedTargetIds.length
            ? selectedTargetIds
            : Array.from(new Set(filteredReminderTargets.map((item) => item.recipientId))),
          subject: reminderSubject,
          body: reminderBody,
          shareAudience,
          testEmail: mode === 'test' ? testEmail : undefined,
        }),
      })
      const json = await response.json()
      if (!json.success) {
        throw new Error(json.error?.message || '리마인드를 발송하지 못했습니다.')
      }
      if (mode === 'test') {
        setBanner({ tone: 'info', message: '테스트 발송을 완료했습니다.' })
      } else {
        if (reminderAction === 'send-result-share') {
          setSelectedResultShareTargetIds([])
        }
        setReminderDialogOpen(false)
        await refreshWithMessage(json.data?.message ?? '리마인드 발송을 예약했습니다.')
      }
    } catch (error) {
      setBanner({
        tone: 'error',
        message: error instanceof Error ? error.message : '리마인드를 발송하지 못했습니다.',
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      {banner ? <BannerBox banner={banner} onClose={() => setBanner(null)} /> : null}

      {/*
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ResponseRateCard
          title="운영 전체 상태"
          responseRate={props.data.summary.averageResponseRate}
          submittedCount={props.data.summary.submittedResponses}
          pendingCount={props.data.summary.pendingResponses}
          description={`활성 라운드 ${props.data.summary.activeRounds}개`}
        />
        <MetricCard label="응답률 주의 라운드" value={`${healthSummary.lowResponseCount}개`} tone="amber" />
        <MetricCard label="품질 위험 응답" value={`${healthSummary.riskCount}건`} tone="rose" />
        <MetricCard label="남은 미응답" value={`${healthSummary.pendingCount}건`} tone="slate" />
      </section>
      */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ResponseRateCard
          title="운영 전체 상태"
          responseRate={props.data.summary.averageResponseRate}
          submittedCount={props.data.summary.submittedResponses}
          pendingCount={props.data.summary.pendingResponses}
          description={`활성 라운드 ${props.data.summary.activeRounds}개`}
        />
        <MetricCard label="응답률 주의 라운드" value={`${healthSummary.lowResponseCount}개`} tone="amber" />
        <MetricCard label="익명성 위험 응답" value={`${healthSummary.riskCount}건`} tone="rose" />
        <MetricCard label="미응답 건수" value={`${healthSummary.pendingCount}건`} tone="slate" />
      </section>

      {reviewAdmin ? (
        <Panel
          title="리뷰 권한 범위"
          description="전역 리뷰 권한과 공동 작업자 권한을 분리해, 내가 접근 가능한 리뷰 범위를 확인하고 공동 작업자 권한 그룹을 관리합니다."
          action={
            canEditReviewAdminGroups ? (
              <button
                type="button"
                onClick={() => openReviewAdminGroupDialog(null)}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <Plus className="h-4 w-4" />
                권한 그룹 추가
              </button>
            ) : undefined
          }
        >
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
            <div className="text-sm font-semibold text-blue-900">{reviewAdmin.currentAccess.summaryLabel}</div>
            <p className="mt-1 text-sm leading-6 text-blue-800">{reviewAdmin.currentAccess.summaryDescription}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge tone={reviewAdmin.currentAccess.canManageAllRounds ? 'emerald' : 'slate'}>
                전체 리뷰 관리 {reviewAdmin.currentAccess.canManageAllRounds ? '가능' : '불가'}
              </Badge>
              <Badge tone={reviewAdmin.currentAccess.canManageCollaboratorRounds ? 'blue' : 'slate'}>
                공동 작업 리뷰 관리 {reviewAdmin.currentAccess.canManageCollaboratorRounds ? '가능' : '불가'}
              </Badge>
              <Badge tone={reviewAdmin.currentAccess.canReadAllContent ? 'emerald' : 'slate'}>
                전체 리뷰 내용 {reviewAdmin.currentAccess.canReadAllContent ? '열람 가능' : '열람 제한'}
              </Badge>
              <Badge tone={reviewAdmin.currentAccess.canReadCollaboratorContent ? 'blue' : 'slate'}>
                공동 작업 리뷰 내용 {reviewAdmin.currentAccess.canReadCollaboratorContent ? '열람 가능' : '열람 제한'}
              </Badge>
            </div>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            {reviewAdmin.groups.length ? (
              reviewAdmin.groups.map((group) => (
                <div key={group.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{group.groupName}</div>
                      <div className="mt-1 text-sm text-slate-500">{group.description || '설명 없음'}</div>
                    </div>
                    <Badge tone="blue">{group.memberCount}명</Badge>
                  </div>
                  <div className="mt-3 text-sm font-medium text-slate-700">{group.reviewScopeLabel}</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {group.members.slice(0, 4).map((member) => (
                      <Badge key={member.employeeId}>
                        {member.name} · {member.position}
                      </Badge>
                    ))}
                    {group.members.length > 4 ? <Badge>+{group.members.length - 4}명</Badge> : null}
                  </div>
                  {canEditReviewAdminGroups ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => openReviewAdminGroupDialog(group)}
                        className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-white"
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteReviewAdminGroup(group.id)}
                        className="inline-flex min-h-10 items-center justify-center rounded-xl border border-rose-200 px-4 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
                      >
                        삭제
                      </button>
                    </div>
                  ) : null}
                </div>
              ))
            ) : (
              <EmptyBlock message="아직 리뷰 권한 그룹이 없습니다. 공동 작업자형 권한을 부여하려면 권한 그룹을 먼저 만들어 주세요." />
            )}
          </div>
        </Panel>
      ) : null}

      {/* manager effectiveness dashboard v1
        <Panel
          title="Manager Effectiveness / 리더 코칭"
          description="리더별 강점, 보완 포인트, 조직별 리스크를 묶어서 보고 코칭과 1:1 후속 조치를 바로 연결합니다."
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="리더 수" value={`${managerEffectivenessAdmin.summary.leaderCount}명`} tone="slate" />
            <MetricCard
              label="평균 점수"
              value={
                managerEffectivenessAdmin.summary.averageScore != null
                  ? managerEffectivenessAdmin.summary.averageScore.toFixed(1)
                  : '-'
              }
              tone="blue"
            />
            <MetricCard label="고위험 리더" value={`${managerEffectivenessAdmin.summary.highRiskCount}명`} tone="rose" />
            <MetricCard
              label="코칭 팩 준비"
              value={`${managerEffectivenessAdmin.summary.coachingReadyCount}명`}
              tone="emerald"
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {managerEffectivenessAdmin.reviewerSummary.map((item) => (
              <Badge key={item} tone="blue">
                {item}
              </Badge>
            ))}
            {managerEffectivenessAdmin.competencyLabels.map((item) => (
              <Badge key={item} tone="slate">
                {item}
              </Badge>
            ))}
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-900">조직별 리더 heatmap</div>
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500">
                      <th className="px-3 py-2 font-medium">조직</th>
                      <th className="px-3 py-2 font-medium">리더 수</th>
                      <th className="px-3 py-2 font-medium">평균 점수</th>
                      <th className="px-3 py-2 font-medium">고위험</th>
                    </tr>
                  </thead>
                  <tbody>
                    {managerEffectivenessAdmin.heatmap.length ? (
                      managerEffectivenessAdmin.heatmap.map((row) => (
                        <tr key={row.departmentName} className="border-t border-slate-200 text-slate-700">
                          <td className="px-3 py-3 font-medium text-slate-900">{row.departmentName}</td>
                          <td className="px-3 py-3">{row.leaderCount}명</td>
                          <td className="px-3 py-3">{row.averageScore != null ? row.averageScore.toFixed(1) : '-'}</td>
                          <td className="px-3 py-3">{row.highRiskCount}명</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="px-3 py-4 text-slate-500">
                          아직 집계할 리더 결과가 없습니다.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-900">주요 개선 테마</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {managerEffectivenessAdmin.topImprovementThemes.length ? (
                  managerEffectivenessAdmin.topImprovementThemes.map((item) => (
                    <Badge key={item.label} tone="amber">
                      {item.label} · {item.count}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-slate-500">아직 집계된 개선 테마가 없습니다.</span>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 xl:grid-cols-2">
            {managerEffectivenessAdmin.leaders.length ? (
              managerEffectivenessAdmin.leaders.map((leader) => (
                <div key={leader.employeeId} className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold text-slate-900">{leader.name}</div>
                      <div className="mt-1 text-sm text-slate-500">
                        {leader.departmentName} · {leader.position}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge
                        tone={
                          leader.riskLevel === 'HIGH'
                            ? 'rose'
                            : leader.riskLevel === 'MEDIUM'
                              ? 'amber'
                              : 'emerald'
                        }
                      >
                        위험도 {leader.riskLevel}
                      </Badge>
                      <Badge tone="blue">
                        점수 {leader.overallScore != null ? leader.overallScore.toFixed(1) : '-'}
                      </Badge>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">강점</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {leader.strengths.length ? (
                          leader.strengths.map((item) => (
                            <Badge key={item} tone="emerald">
                              {item}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-sm text-slate-500">강점 태그가 아직 없습니다.</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">보완 포인트</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {leader.improvements.length ? (
                          leader.improvements.map((item) => (
                            <Badge key={item} tone="amber">
                              {item}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-sm text-slate-500">보완 포인트가 아직 없습니다.</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-sm font-semibold text-slate-900">코칭 포인트</div>
                      <ul className="mt-3 space-y-2 text-sm text-slate-600">
                        {leader.coachingPack.coachingPoints.map((item) => (
                          <li key={item}>• {item}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-sm font-semibold text-slate-900">다음 1:1 질문</div>
                      <ul className="mt-3 space-y-2 text-sm text-slate-600">
                        {leader.coachingPack.nextOneOnOneQuestions.map((item) => (
                          <li key={item}>• {item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-sm font-semibold text-slate-900">성장 액션</div>
                    <ul className="mt-3 space-y-2 text-sm text-slate-600">
                      {leader.coachingPack.growthActions.map((item) => (
                        <li key={item}>• {item}</li>
                      ))}
                    </ul>
                    <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                      {leader.coachingPack.hrMemo}
                    </div>
                  </div>

                  <div className="mt-4 flex justify-end">
                    <Link
                      href={leader.resultHref}
                      className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      결과 보기
                    </Link>
                  </div>
                </div>
              ))
            ) : (
              <div className="xl:col-span-2">
                <EmptyBlock message="리더 효과성 결과가 아직 집계되지 않았습니다." />
              </div>
            )}
          </div>
        </Panel>
      */}

      {anytimeReview ? (
        <Panel
          title="수시 리뷰 문서"
          description="연간·반기 리뷰와 별도로 프로젝트 종료 평가, 역할 변경 평가, 수습 평가, PIP 문서를 생성하고 기한 변경·리뷰어 이관·종료 처리를 한 화면에서 관리합니다."
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <MetricCard label="전체 문서" value={`${anytimeReview.summary.totalCount}건`} tone="slate" />
            <MetricCard label="진행 중" value={`${anytimeReview.summary.activeCount}건`} tone="blue" />
            <MetricCard label="기한 초과" value={`${anytimeReview.summary.overdueCount}건`} tone="rose" />
            <MetricCard label="PIP 문서" value={`${anytimeReview.summary.pipCount}건`} tone="amber" />
            <MetricCard label="프로젝트 리뷰" value={`${anytimeReview.summary.projectCount}건`} tone="emerald" />
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-base font-semibold text-slate-900">수시 리뷰 문서 생성</div>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  사유를 남기고 템플릿을 바인딩해 개별 또는 대량으로 문서를 생성합니다. 생성 즉시 리뷰어와 공동 작업자 권한이 반영됩니다.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleCreateAnytimeReview()}
                disabled={busy}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                <Plus className="h-4 w-4" />
                문서 생성
              </button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <label className="space-y-2 text-sm">
                <span className="font-medium text-slate-700">문서 유형</span>
                <select
                  value={anytimeDocumentKind}
                  onChange={(event) => setAnytimeDocumentKind(event.target.value as FeedbackAnytimeDocumentKind)}
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700"
                >
                  {Object.entries(FEEDBACK_ANYTIME_DOCUMENT_KIND_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm md:col-span-2">
                <span className="font-medium text-slate-700">문서 이름</span>
                <input
                  value={anytimeRoundName}
                  onChange={(event) => setAnytimeRoundName(event.target.value)}
                  placeholder="예: 2분기 프로젝트 종료 리뷰"
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700"
                />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium text-slate-700">마감 기한</span>
                <input
                  type="date"
                  value={anytimeDueDate}
                  onChange={(event) => setAnytimeDueDate(event.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700"
                />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium text-slate-700">리뷰어</span>
                <select
                  value={anytimeReviewerId}
                  onChange={(event) => setAnytimeReviewerId(event.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700"
                >
                  <option value="">리뷰어를 선택해 주세요</option>
                  {anytimeEmployeeOptions.map((employee) => (
                    <option key={employee.employeeId} value={employee.employeeId}>
                      {employee.name} · {employee.departmentName} · {employee.position}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium text-slate-700">템플릿 바인딩</span>
                <select
                  value={anytimeTemplateRoundId}
                  onChange={(event) => setAnytimeTemplateRoundId(event.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700"
                >
                  <option value="">기본 문항 사용</option>
                  {anytimeTemplateOptions.map((template) => (
                    <option key={template.roundId} value={template.roundId}>
                      {template.roundName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium text-slate-700">폴더</span>
                <select
                  value={anytimeFolderId}
                  onChange={(event) => setAnytimeFolderId(event.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700"
                >
                  <option value="">미분류</option>
                  {anytimeFolderOptions.map((folder) => (
                    <option key={folder.id} value={folder.id}>
                      {folder.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm xl:col-span-4">
                <span className="font-medium text-slate-700">생성 사유</span>
                <textarea
                  value={anytimeReason}
                  onChange={(event) => setAnytimeReason(event.target.value)}
                  rows={3}
                  placeholder="예: 프로젝트 종료 후 협업 피드백 수집, 수습 종료 판단, 역할 변경 후 60일 리뷰"
                  className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-700"
                />
              </label>
            </div>

            {anytimeDocumentKind === 'PROJECT' ? (
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm">
                  <span className="font-medium text-slate-700">프로젝트 이름</span>
                  <input
                    value={anytimeProjectName}
                    onChange={(event) => setAnytimeProjectName(event.target.value)}
                    placeholder="예: 검색 고도화 프로젝트"
                    className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700"
                  />
                </label>
                <label className="space-y-2 text-sm">
                  <span className="font-medium text-slate-700">프로젝트 코드</span>
                  <input
                    value={anytimeProjectCode}
                    onChange={(event) => setAnytimeProjectCode(event.target.value)}
                    placeholder="예: PJT-2026-04"
                    className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700"
                  />
                </label>
              </div>
            ) : null}

            {anytimeDocumentKind === 'PIP' ? (
              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                <label className="space-y-2 text-sm">
                  <span className="font-medium text-slate-700">PIP 목표</span>
                  <textarea
                    value={pipGoalsText}
                    onChange={(event) => setPipGoalsText(event.target.value)}
                    rows={4}
                    placeholder="한 줄에 하나씩 입력해 주세요."
                    className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-700"
                  />
                </label>
                <label className="space-y-2 text-sm">
                  <span className="font-medium text-slate-700">행동 기대치</span>
                  <textarea
                    value={pipExpectedText}
                    onChange={(event) => setPipExpectedText(event.target.value)}
                    rows={4}
                    placeholder="한 줄에 하나씩 입력해 주세요."
                    className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-700"
                  />
                </label>
                <label className="space-y-2 text-sm">
                  <span className="font-medium text-slate-700">체크포인트</span>
                  <textarea
                    value={pipCheckpointsText}
                    onChange={(event) => setPipCheckpointsText(event.target.value)}
                    rows={4}
                    placeholder={'예: 2주차 점검\n4주차 중간 리뷰\n8주차 종료 판단'}
                    className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-700"
                  />
                </label>
                <div className="grid gap-4">
                  <label className="space-y-2 text-sm">
                    <span className="font-medium text-slate-700">중간 점검 기준</span>
                    <textarea
                      value={pipMidReview}
                      onChange={(event) => setPipMidReview(event.target.value)}
                      rows={3}
                      className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-700"
                    />
                  </label>
                  <label className="space-y-2 text-sm">
                    <span className="font-medium text-slate-700">종료 판단 기준</span>
                    <textarea
                      value={pipEndJudgement}
                      onChange={(event) => setPipEndJudgement(event.target.value)}
                      rows={3}
                      className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-700"
                    />
                  </label>
                </div>
              </div>
            ) : null}

            <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">대상자 선택</div>
                    <p className="mt-1 text-sm text-slate-500">여러 명을 선택하면 같은 템플릿으로 개별 문서를 일괄 생성합니다.</p>
                  </div>
                  <Badge tone="blue">{anytimeTargetIds.length}명 선택</Badge>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {anytimeEmployeeOptions.map((employee) => {
                    const selected = anytimeTargetIds.includes(employee.employeeId)
                    return (
                      <button
                        key={employee.employeeId}
                        type="button"
                        onClick={() => toggleAnytimeTarget(employee.employeeId)}
                        className={`rounded-2xl border px-4 py-3 text-left transition ${
                          selected
                            ? 'border-slate-900 bg-slate-900 text-white'
                            : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-white'
                        }`}
                      >
                        <div className="text-sm font-semibold">{employee.name}</div>
                        <div className={`mt-1 text-xs ${selected ? 'text-white/80' : 'text-slate-500'}`}>
                          {employee.departmentName} · {employee.position}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">공동 작업자</div>
                    <p className="mt-1 text-sm text-slate-500">문서를 함께 관리할 리뷰 관리자 또는 공동 작업자를 지정합니다.</p>
                  </div>
                  <Badge>{anytimeCollaboratorIds.length}명</Badge>
                </div>
                <input
                  value={collaboratorSearch}
                  onChange={(event) => setCollaboratorSearch(event.target.value)}
                  placeholder="이름, 조직, 역할 검색"
                  className="mt-4 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700"
                />
                <div className="mt-4 max-h-72 space-y-2 overflow-y-auto">
                  {filteredCollaboratorCandidates.map((candidate) => {
                    const selected = anytimeCollaboratorIds.includes(candidate.employeeId)
                    return (
                      <label
                        key={candidate.employeeId}
                        className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition ${
                          selected ? 'border-blue-200 bg-blue-50' : 'border-slate-200 bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleAnytimeCollaborator(candidate.employeeId)}
                          className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900"
                        />
                        <div>
                          <div className="text-sm font-semibold text-slate-900">{candidate.name}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            {candidate.departmentName} · {candidate.position}
                          </div>
                        </div>
                      </label>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-base font-semibold text-slate-900">수시 리뷰 문서 목록</div>
                <p className="mt-1 text-sm text-slate-500">기한 변경, 리뷰어 이관, 취소, 종료, 재오픈을 안전하게 일괄 처리할 수 있습니다.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  value={anytimeSearch}
                  onChange={(event) => setAnytimeSearch(event.target.value)}
                  placeholder="문서명, 대상자, 리뷰어, 사유 검색"
                  className="h-11 min-w-[280px] rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700"
                />
                <button
                  type="button"
                  onClick={toggleAllAnytimeRounds}
                  className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  {allAnytimeRoundsSelected ? '전체 선택 해제' : '현재 목록 전체 선택'}
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-[1.1fr_1fr_auto_auto_auto]">
              <label className="space-y-2 text-sm">
                <span className="font-medium text-slate-700">리뷰어 이관</span>
                <select
                  value={anytimeBulkReviewerId}
                  onChange={(event) => setAnytimeBulkReviewerId(event.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700"
                >
                  <option value="">새 리뷰어 선택</option>
                  {anytimeEmployeeOptions.map((employee) => (
                    <option key={employee.employeeId} value={employee.employeeId}>
                      {employee.name} · {employee.departmentName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium text-slate-700">기한 변경</span>
                <input
                  type="date"
                  value={anytimeBulkDueDate}
                  onChange={(event) => setAnytimeBulkDueDate(event.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700"
                />
              </label>
              <label className="space-y-2 text-sm md:col-span-2 xl:col-span-1">
                <span className="font-medium text-slate-700">일괄 작업 사유</span>
                <input
                  value={anytimeBulkReason}
                  onChange={(event) => setAnytimeBulkReason(event.target.value)}
                  placeholder="사유를 입력해 주세요"
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700"
                />
              </label>
              <div className="flex flex-wrap items-end gap-2">
                <button
                  type="button"
                  onClick={() => void handleAnytimeBulkAction('transfer-reviewer')}
                  disabled={busy}
                  className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
                >
                  리뷰어 이관
                </button>
                <button
                  type="button"
                  onClick={() => void handleAnytimeBulkAction('change-due-date')}
                  disabled={busy}
                  className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
                >
                  기한 변경
                </button>
                <button
                  type="button"
                  onClick={() => void handleAnytimeBulkAction('close')}
                  disabled={busy}
                  className="inline-flex min-h-10 items-center justify-center rounded-xl border border-amber-200 px-4 text-sm font-semibold text-amber-700 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
                >
                  종료
                </button>
                <button
                  type="button"
                  onClick={() => void handleAnytimeBulkAction('reopen')}
                  disabled={busy}
                  className="inline-flex min-h-10 items-center justify-center rounded-xl border border-emerald-200 px-4 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
                >
                  재오픈
                </button>
                <button
                  type="button"
                  onClick={() => void handleAnytimeBulkAction('cancel')}
                  disabled={busy}
                  className="inline-flex min-h-10 items-center justify-center rounded-xl border border-rose-200 px-4 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
                >
                  취소
                </button>
              </div>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={allAnytimeRoundsSelected}
                        onChange={toggleAllAnytimeRounds}
                        className="h-4 w-4 rounded border-slate-300 text-slate-900"
                      />
                    </th>
                    <th className="px-3 py-3 font-medium">문서</th>
                    <th className="px-3 py-3 font-medium">대상자</th>
                    <th className="px-3 py-3 font-medium">리뷰어</th>
                    <th className="px-3 py-3 font-medium">상태</th>
                    <th className="px-3 py-3 font-medium">마감 기한</th>
                    <th className="px-3 py-3 font-medium">사유 / 이력</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAnytimeDocuments.length ? (
                    filteredAnytimeDocuments.map((document) => (
                      <tr key={document.roundId} className="border-b border-slate-100 align-top text-slate-700">
                        <td className="px-3 py-4">
                          <input
                            type="checkbox"
                            checked={selectedAnytimeRoundIds.includes(document.roundId)}
                            onChange={() => toggleAnytimeRoundSelection(document.roundId)}
                            className="h-4 w-4 rounded border-slate-300 text-slate-900"
                          />
                        </td>
                        <td className="px-3 py-4">
                          <div className="font-semibold text-slate-900">{document.roundName}</div>
                          <div className="mt-1 flex flex-wrap gap-2">
                            <Badge tone="blue">{document.documentKindLabel}</Badge>
                            {document.projectName ? <Badge>{document.projectName}</Badge> : null}
                            {document.templateRoundName ? <Badge tone="slate">{document.templateRoundName}</Badge> : null}
                          </div>
                        </td>
                        <td className="px-3 py-4">
                          <div className="font-medium text-slate-900">{document.targetName}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            {document.targetDepartmentName}
                          </div>
                        </td>
                        <td className="px-3 py-4">
                          <div className="font-medium text-slate-900">{document.reviewerName}</div>
                          <div className="mt-1 text-xs text-slate-500">{document.reviewerDepartmentName}</div>
                        </td>
                        <td className="px-3 py-4">
                          <div className="flex flex-wrap gap-2">
                            <Badge
                              tone={
                                document.lifecycleState === 'CANCELLED'
                                  ? 'rose'
                                  : document.lifecycleState === 'CLOSED'
                                    ? 'amber'
                                    : 'emerald'
                              }
                            >
                              {document.status}
                            </Badge>
                            <Badge tone="slate">{document.feedbackStatus}</Badge>
                          </div>
                        </td>
                        <td className="px-3 py-4">
                          <div>{document.endDate || '-'}</div>
                          <div className="mt-1 text-xs text-slate-500">생성일 {document.createdAt}</div>
                        </td>
                        <td className="px-3 py-4">
                          <div className="text-sm text-slate-700">{document.reason}</div>
                          {document.history.length ? (
                            <ul className="mt-2 space-y-1 text-xs text-slate-500">
                              {document.history.slice(0, 3).map((history) => (
                                <li key={`${document.roundId}-${history.at}-${history.action}`}>
                                  {history.at} · {history.summary}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <div className="mt-2 text-xs text-slate-400">이력이 아직 없습니다.</div>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-3 py-8">
                        <EmptyBlock message="조건에 맞는 수시 리뷰 문서가 없습니다." />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </Panel>
      ) : null}

      <ManagerEffectivenessDashboard managerEffectivenessAdmin={managerEffectivenessAdmin} />

      <Panel
        title="리뷰 폴더"
        description="상단 폴더 strip으로 라운드를 묶어 보고, 미분류 버킷과 새 폴더 생성을 함께 운영합니다."
        action={canManageFolders ? (
          <button
            type="button"
            onClick={() => {
              setFolderDraft({ id: '', name: '', description: '' })
              setFolderDialogOpen(true)
            }}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <FolderPlus className="h-4 w-4" />
            새 폴더
          </button>
        ) : null}
      >
        {/* manager effectiveness dashboard legacy block
          <Panel
            title="Manager Effectiveness / 리더 코칭"
            description="리더별 강점, 보완 포인트, 조직별 리스크를 묶어서 보고 코칭과 1:1 후속 조치를 바로 연결합니다."
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="리더 수" value={`${managerEffectivenessAdmin.summary.leaderCount}명`} tone="slate" />
              <MetricCard
                label="평균 점수"
                value={
                  managerEffectivenessAdmin.summary.averageScore != null
                    ? managerEffectivenessAdmin.summary.averageScore.toFixed(1)
                    : '-'
                }
                tone="blue"
              />
              <MetricCard label="고위험 리더" value={`${managerEffectivenessAdmin.summary.highRiskCount}명`} tone="rose" />
              <MetricCard
                label="코칭 팩 준비"
                value={`${managerEffectivenessAdmin.summary.coachingReadyCount}명`}
                tone="emerald"
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {managerEffectivenessAdmin.reviewerSummary.map((item) => (
                <Badge key={item} tone="blue">
                  {item}
                </Badge>
              ))}
              {managerEffectivenessAdmin.competencyLabels.map((item) => (
                <Badge key={item} tone="slate">
                  {item}
                </Badge>
              ))}
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-900">조직별 리더 heatmap</div>
                <div className="mt-3 overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-slate-500">
                        <th className="px-3 py-2 font-medium">조직</th>
                        <th className="px-3 py-2 font-medium">리더 수</th>
                        <th className="px-3 py-2 font-medium">평균 점수</th>
                        <th className="px-3 py-2 font-medium">고위험</th>
                      </tr>
                    </thead>
                    <tbody>
                      {managerEffectivenessAdmin.heatmap.length ? (
                        managerEffectivenessAdmin.heatmap.map((row) => (
                          <tr key={row.departmentName} className="border-t border-slate-200 text-slate-700">
                            <td className="px-3 py-3 font-medium text-slate-900">{row.departmentName}</td>
                            <td className="px-3 py-3">{row.leaderCount}명</td>
                            <td className="px-3 py-3">{row.averageScore != null ? row.averageScore.toFixed(1) : '-'}</td>
                            <td className="px-3 py-3">{row.highRiskCount}명</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="px-3 py-4 text-slate-500">
                            아직 집계할 리더 결과가 없습니다.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-900">주요 개선 테마</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {managerEffectivenessAdmin.topImprovementThemes.length ? (
                    managerEffectivenessAdmin.topImprovementThemes.map((item) => (
                      <Badge key={item.label} tone="amber">
                        {item.label} · {item.count}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-slate-500">아직 집계된 개선 테마가 없습니다.</span>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-4 xl:grid-cols-2">
              {managerEffectivenessAdmin.leaders.length ? (
                managerEffectivenessAdmin.leaders.map((leader) => (
                  <div key={leader.employeeId} className="rounded-2xl border border-slate-200 bg-white p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-base font-semibold text-slate-900">{leader.name}</div>
                        <div className="mt-1 text-sm text-slate-500">
                          {leader.departmentName} · {leader.position}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge tone={leader.riskLevel === 'HIGH' ? 'rose' : leader.riskLevel === 'MEDIUM' ? 'amber' : 'emerald'}>
                          위험도 {leader.riskLevel}
                        </Badge>
                        <Badge tone="blue">
                          점수 {leader.overallScore != null ? leader.overallScore.toFixed(1) : '-'}
                        </Badge>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">강점</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {leader.strengths.map((item) => (
                            <Badge key={item} tone="emerald">
                              {item}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">보완 포인트</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {leader.improvements.map((item) => (
                            <Badge key={item} tone="amber">
                              {item}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="text-sm font-semibold text-slate-900">코칭 포인트</div>
                        <ul className="mt-3 space-y-2 text-sm text-slate-600">
                          {leader.coachingPack.coachingPoints.map((item) => (
                            <li key={item}>• {item}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="text-sm font-semibold text-slate-900">다음 1:1 질문</div>
                        <ul className="mt-3 space-y-2 text-sm text-slate-600">
                          {leader.coachingPack.nextOneOnOneQuestions.map((item) => (
                            <li key={item}>• {item}</li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-sm font-semibold text-slate-900">성장 액션</div>
                      <ul className="mt-3 space-y-2 text-sm text-slate-600">
                        {leader.coachingPack.growthActions.map((item) => (
                          <li key={item}>• {item}</li>
                        ))}
                      </ul>
                      <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                        {leader.coachingPack.hrMemo}
                      </div>
                    </div>

                    <div className="mt-4 flex justify-end">
                      <Link
                        href={leader.resultHref}
                        className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        결과 보기
                      </Link>
                    </div>
                  </div>
                ))
              ) : (
                <div className="xl:col-span-2">
                  <EmptyBlock message="리더 효과성 결과가 아직 집계되지 않았습니다." />
                </div>
              )}
            </div>
          </Panel>
        */}

        <div className="flex gap-3 overflow-x-auto pb-2">
          {folderCards.map((folder) => (
            <button
              key={folder.id}
              type="button"
              onClick={() => setFolderFilter(folder.id)}
              className={`min-w-[180px] rounded-2xl border px-4 py-4 text-left transition ${
                folderFilter === folder.id
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-white'
              }`}
            >
              <div className="text-xs font-semibold uppercase tracking-[0.16em] opacity-70">Folder</div>
              <div className="mt-2 text-sm font-semibold">{folder.name}</div>
              <div className="mt-3 text-xs opacity-80">라운드 {folder.count}개</div>
            </button>
          ))}
        </div>
      </Panel>

      <Panel
        title="리뷰 라운드 관리"
        description="폴더 선택 후 라운드를 고르고, 폴더 이동, 동료 설정, 익명 범위 조정, 리마인드 발송을 한 화면에서 처리합니다."
      >
        {filteredRounds.length ? (
          <div className="space-y-4">
            {filteredRounds.map((round) => (
              <div
                key={round.id}
                className={`rounded-2xl border p-4 transition ${
                  selectedRoundId === round.id ? 'border-slate-900 bg-slate-50' : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedRoundId(round.id)}
                        className="text-left text-base font-semibold text-slate-900"
                      >
                        {round.roundName}
                      </button>
                      <Badge>{round.roundType}</Badge>
                      <Badge tone={round.status === 'IN_PROGRESS' ? 'emerald' : 'slate'}>{round.status}</Badge>
                      {round.collaborators.length ? <Badge tone="blue">공동 작업자 {round.collaborators.length}명</Badge> : null}
                      {round.folderName ? <Badge tone="blue">{round.folderName}</Badge> : <Badge>미분류</Badge>}
                    </div>
                    <div className="text-sm text-slate-500">
                      {round.startDate} ~ {round.endDate} · 대상 {round.targetCount}명 · 제출 {round.submittedCount}건
                    </div>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <MiniStat label="응답률" value={`${round.responseRate}%`} />
                      <MiniStat label="익명 기준" value={`${round.minRaters}명`} />
                      <MiniStat label="현재 폴더" value={round.folderName ?? '미분류'} />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row xl:flex-col">
                    {canManageFolders ? (
                    <select
                      value={round.folderId ?? ''}
                      onChange={(event) => void handleAssignFolder(round.id, event.target.value)}
                      className="min-h-10 rounded-xl border border-slate-300 px-3 text-sm text-slate-700"
                    >
                      <option value="">미분류</option>
                      {(admin?.folders ?? []).map((folder) => (
                        <option key={folder.id} value={folder.id}>
                          {folder.name}
                        </option>
                      ))}
                    </select>
                    ) : (
                      <div className="inline-flex min-h-10 items-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-500">
                        폴더 이동은 전체 리뷰 관리자만 가능합니다.
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedRoundId(round.id)
                        setSettingsDialogOpen(true)
                      }}
                      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      <Settings2 className="h-4 w-4" />
                      동료 / 익명 설정
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedRoundId(round.id)
                        setReminderDialogOpen(true)
                      }}
                      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      <Mail className="h-4 w-4" />
                      리마인드 발송
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyBlock message="현재 필터에 맞는 라운드가 없습니다. 폴더를 바꾸거나 새 폴더를 만들어 운영 분류를 다시 잡아 보세요." />
        )}
      </Panel>

      <Panel
        title="온보딩 리뷰 워크플로우"
        description="입사일과 직군 조건에 맞는 구성원에게 다단계 온보딩 리뷰를 자동 생성합니다. 실제 반영은 저장 후 수동 실행 또는 스케줄러 실행으로 처리됩니다."
        action={!canManageFolders ? null : (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelectedWorkflowId('new')}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <Plus className="h-4 w-4" />
              새 워크플로우
            </button>
            <button
              type="button"
              onClick={() => void handleRunOnboardingWorkflow()}
              disabled={busy || !props.data.selectedCycleId}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
            >
              <Play className="h-4 w-4" />
              지금 생성 실행
            </button>
            <button
              type="button"
              onClick={() => void handleSaveOnboardingWorkflow()}
              disabled={busy || !workflowDraft.workflowName.trim()}
              className="inline-flex min-h-10 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
            >
              워크플로우 저장
            </button>
          </div>
        )}
      >
        {selectedCycle ? (
          <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
            <div className="space-y-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                <div className="font-semibold text-slate-900">{onboarding?.scheduleInfo ?? formatScheduleHourLabel(workflowDraft.scheduleHourKst)}</div>
                <p className="mt-2">
                  현재 주기 기준으로 저장된 활성 워크플로우를 훑고, 이미 생성된 단계는 중복 없이 건너뜁니다.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedWorkflowId('new')}
                className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                  selectedWorkflowId === 'new'
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="text-sm font-semibold">새 워크플로우</div>
                <div className="mt-2 text-xs opacity-80">현재 주기 {selectedCycle.year} / {selectedCycle.name}</div>
              </button>
              {(onboarding?.workflows ?? []).map((workflow) => (
                <button
                  key={workflow.id}
                  type="button"
                  onClick={() => setSelectedWorkflowId(workflow.id)}
                  className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                    selectedWorkflowId === workflow.id
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold">{workflow.workflowName}</div>
                    <Badge tone={workflow.isActive ? 'emerald' : 'slate'}>
                      {workflow.isActive ? '활성' : '중지'}
                    </Badge>
                  </div>
                  <div className="mt-2 text-xs opacity-80">
                    대상 {workflow.eligibleTargetCount}명 · 생성 {workflow.generatedCount}건
                  </div>
                  <div className="mt-1 text-xs opacity-80">{workflow.scheduleInfo}</div>
                </button>
              ))}
            </div>

            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px_140px]">
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">워크플로우 이름</span>
                  <input
                    value={workflowDraft.workflowName}
                    onChange={(event) =>
                      setWorkflowDraft((current) => ({ ...current, workflowName: event.target.value }))
                    }
                    className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-900"
                    placeholder="예: 입사 30일 온보딩 리뷰"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">생성 시각</span>
                  <select
                    value={workflowDraft.scheduleHourKst}
                    onChange={(event) =>
                      setWorkflowDraft((current) => ({
                        ...current,
                        scheduleHourKst: Number(event.target.value),
                      }))
                    }
                    className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-900"
                  >
                    {Array.from({ length: 24 }, (_, hour) => (
                      <option key={hour} value={hour}>
                        {formatScheduleHourLabel(hour)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex min-h-11 items-end gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={workflowDraft.isActive}
                    onChange={(event) =>
                      setWorkflowDraft((current) => ({ ...current, isActive: event.target.checked }))
                    }
                    className="mt-0.5 h-4 w-4 rounded border-slate-300"
                  />
                  <span>활성 상태로 유지</span>
                </label>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">리뷰 대상자 조건</div>
                    <p className="mt-1 text-sm text-slate-500">입사일과 직군 조건을 조합해 자동 생성 대상을 정합니다.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => addWorkflowCondition('JOIN_DATE')}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-white"
                    >
                      입사일 조건 추가
                    </button>
                    <button
                      type="button"
                      onClick={() => addWorkflowCondition('POSITION')}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-white"
                    >
                      직군 조건 추가
                    </button>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {workflowDraft.targetConditions.map((condition) => (
                    <div key={condition.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="text-sm font-semibold text-slate-900">
                          {condition.field === 'JOIN_DATE' ? '입사일 조건' : '직군 조건'}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeWorkflowCondition(condition.id)}
                          className="text-xs font-semibold text-slate-500 transition hover:text-slate-700"
                        >
                          제거
                        </button>
                      </div>

                      {condition.field === 'JOIN_DATE' ? (
                        <div className="mt-3 grid gap-3 md:grid-cols-[220px_minmax(0,1fr)_minmax(0,1fr)]">
                          <select
                            value={condition.operator}
                            onChange={(event) =>
                              updateWorkflowCondition(condition.id, {
                                operator: event.target.value as Extract<typeof condition.operator, string>,
                              })
                            }
                            className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm text-slate-900"
                          >
                            <option value="ON_OR_AFTER">입사일 이후(당일 포함)</option>
                            <option value="ON_OR_BEFORE">입사일 이전(당일 포함)</option>
                            <option value="BETWEEN">입사일 기간 사이</option>
                          </select>
                          <input
                            type="date"
                            value={condition.value}
                            onChange={(event) => updateWorkflowCondition(condition.id, { value: event.target.value })}
                            className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm text-slate-900"
                          />
                          {condition.operator === 'BETWEEN' ? (
                            <input
                              type="date"
                              value={condition.valueTo ?? ''}
                              onChange={(event) => updateWorkflowCondition(condition.id, { valueTo: event.target.value })}
                              className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm text-slate-900"
                            />
                          ) : (
                            <div className="rounded-xl border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-400">
                              단일 기준일
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {(onboarding?.jobFamilyOptions ?? []).map((option) => {
                            const checked = condition.values.includes(option.value as keyof typeof POSITION_LABELS_KO)
                            return (
                              <label
                                key={option.value}
                                className={`flex items-center gap-3 rounded-xl border px-3 py-3 text-sm transition ${
                                  checked
                                    ? 'border-slate-900 bg-slate-900 text-white'
                                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(event) => {
                                    const nextValues = event.target.checked
                                      ? [...condition.values, option.value as keyof typeof POSITION_LABELS_KO]
                                      : condition.values.filter((value) => value !== option.value)
                                    updateWorkflowCondition(condition.id, { values: nextValues })
                                  }}
                                  className="h-4 w-4 rounded border-slate-300"
                                />
                                <span>{option.label}</span>
                              </label>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">단계별 리뷰 설정</div>
                    <p className="mt-1 text-sm text-slate-500">단계별 생성 시점과 리뷰 이름 규칙을 함께 관리합니다.</p>
                  </div>
                  <button
                    type="button"
                    onClick={addWorkflowStep}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    단계 추가
                  </button>
                </div>

                <div className="mt-4 space-y-4">
                  {workflowDraft.steps
                    .slice()
                    .sort((left, right) => left.stepOrder - right.stepOrder)
                    .map((step, index) => {
                      const previewName = buildOnboardingReviewNamePreview({
                        step,
                        evalYear: selectedCycle.year,
                        cycleName: selectedCycle.name,
                        employeeName: '입사자 이름',
                        hireDate: new Date('2026-01-02T00:00:00+09:00'),
                      })

                      return (
                        <div key={step.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="text-sm font-semibold text-slate-900">{index + 1}단계</div>
                            <button
                              type="button"
                              onClick={() => removeWorkflowStep(step.id)}
                              className="text-xs font-semibold text-slate-500 transition hover:text-slate-700"
                            >
                              단계 제거
                            </button>
                          </div>

                          <div className="mt-3 grid gap-3 md:grid-cols-[120px_minmax(0,1fr)_160px_160px]">
                            <input
                              type="number"
                              min={1}
                              value={step.stepOrder}
                              onChange={(event) =>
                                updateWorkflowStep(step.id, { stepOrder: Number(event.target.value) || index + 1 })
                              }
                              className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm text-slate-900"
                            />
                            <input
                              value={step.stepName}
                              onChange={(event) => updateWorkflowStep(step.id, { stepName: event.target.value })}
                              className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm text-slate-900"
                              placeholder="예: 1차 온보딩 리뷰"
                            />
                            <input
                              type="number"
                              min={0}
                              value={step.triggerDaysAfterJoin}
                              onChange={(event) =>
                                updateWorkflowStep(step.id, {
                                  triggerDaysAfterJoin: Number(event.target.value) || 0,
                                })
                              }
                              className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm text-slate-900"
                              placeholder="생성 시점"
                            />
                            <input
                              type="number"
                              min={1}
                              value={step.durationDays}
                              onChange={(event) =>
                                updateWorkflowStep(step.id, { durationDays: Number(event.target.value) || 1 })
                              }
                              className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm text-slate-900"
                              placeholder="마감 기간"
                            />
                          </div>

                          <label className="mt-3 block">
                            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">리뷰 이름 템플릿</span>
                            <input
                              value={step.reviewNameTemplate}
                              onChange={(event) =>
                                updateWorkflowStep(step.id, { reviewNameTemplate: event.target.value })
                              }
                              className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-900"
                              placeholder="{{evalYear}} {{cycleName}} {{stepName}}"
                            />
                          </label>

                          <div className="mt-3 flex flex-wrap gap-3">
                            <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                              <input
                                type="checkbox"
                                checked={step.includeHireDateInName}
                                onChange={(event) =>
                                  updateWorkflowStep(step.id, { includeHireDateInName: event.target.checked })
                                }
                                className="h-4 w-4 rounded border-slate-300"
                              />
                              입사일 포함
                            </label>
                            <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                              <input
                                type="checkbox"
                                checked={step.includeEmployeeNameInName}
                                onChange={(event) =>
                                  updateWorkflowStep(step.id, { includeEmployeeNameInName: event.target.checked })
                                }
                                className="h-4 w-4 rounded border-slate-300"
                              />
                              입사자 이름 추가
                            </label>
                          </div>

                          <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-white p-4">
                            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">리뷰 이름 preview</div>
                            <div className="mt-2 text-sm font-semibold text-slate-900">{previewName}</div>
                            <div className="mt-2 text-xs text-slate-500">
                              입사 후 {step.triggerDaysAfterJoin}일째 생성 · 생성 후 {step.durationDays}일 동안 응답 받기
                            </div>
                          </div>
                        </div>
                      )
                    })}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <EmptyBlock message="온보딩 리뷰 워크플로우를 설정할 평가 주기를 먼저 선택해 주세요." />
        )}
      </Panel>

      <Panel
        title="자동 생성된 온보딩 리뷰"
        description="자동으로 생성된 리뷰 이름, 대상자, 상태, 생성일을 바로 확인하고 필요한 경우 기존 360 관리 흐름으로 이어갈 수 있습니다."
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="text-sm text-slate-600">
            현재 표시 <span className="font-semibold text-slate-900">{filteredGeneratedReviews.length}</span>건 · 전체{' '}
            <span className="font-semibold text-slate-900">{onboarding?.generatedReviews.length ?? 0}</span>건
          </div>
          <div className="flex flex-col gap-3 md:flex-row">
            {/* legacy search input removed during RC recovery
            {/* normalized generated review search input
            <input
              value={generatedReviewSearch}
              onChange={(event) => setGeneratedReviewSearch(event.target.value)}
              className="min-h-11 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-900 md:w-72"
              placeholder="리뷰 이름, 대상자, 조직 검색"
            />
            */}
            {/* corrupted duplicate input removed during RC recovery
            <input
              value={generatedReviewSearch}
              onChange={(event) => setGeneratedReviewSearch(event.target.value)}
              className="min-h-11 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-900 md:w-72"
              placeholder="리뷰 이름, 대상자, 조직 검색"
            />
            */}
            <input
              value={generatedReviewSearch}
              onChange={(event) => setGeneratedReviewSearch(event.target.value)}
              className="min-h-11 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-900 md:w-72"
              placeholder={'\uB9AC\uBDF0 \uC774\uB984, \uB300\uC0C1\uC790, \uC870\uC9C1 \uAC80\uC0C9'}
            />
            <select
              value={generatedReviewStatusFilter}
              onChange={(event) => setGeneratedReviewStatusFilter(event.target.value)}
              className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm text-slate-900"
            >
              <option value="ALL">상태 전체</option>
              {generatedReviewStatusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-2 flex justify-end">
          <select
            value={generatedReviewSort}
            onChange={(event) => setGeneratedReviewSort(event.target.value as OnboardingGeneratedReviewSort)}
            className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm text-slate-900"
          >
            <option value="CREATED_DESC">생성일 최신순</option>
            <option value="CREATED_ASC">생성일 오래된순</option>
            <option value="TARGET_ASC">대상자 이름순</option>
            <option value="STATUS_ASC">상태순</option>
          </select>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-white">
          {filteredGeneratedReviews.length ? (
            <>
              <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)_140px_140px_140px] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                <span>리뷰 이름</span>
                <span>대상자</span>
                <span>라운드 상태</span>
                <span>응답 상태</span>
                <span>생성일</span>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {filteredGeneratedReviews.map((review) => (
                  <div
                    key={review.id}
                    className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)_140px_140px_140px] gap-3 border-b border-slate-100 px-4 py-3 text-sm text-slate-700 last:border-b-0"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-slate-900">{review.roundName}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {review.workflowName} · {review.stepName} · 기준일 {review.scheduledDateKey}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-slate-900">{review.targetName}</div>
                      <div className="mt-1 text-xs text-slate-500">{review.targetDepartment}</div>
                    </div>
                    <div>
                      <Badge tone={review.status === 'IN_PROGRESS' ? 'emerald' : 'slate'}>{review.status}</Badge>
                    </div>
                    <div>
                      <Badge tone={review.feedbackStatus === 'SUBMITTED' ? 'blue' : 'slate'}>{review.feedbackStatus}</Badge>
                    </div>
                    <div className="text-xs text-slate-500">{review.createdDateLabel}</div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="p-4">
              <EmptyBlock message="현재 조건에 맞는 자동 생성 리뷰가 없습니다. 워크플로우를 저장하고 수동 실행하거나, 스케줄러가 다음 실행 시점에 생성합니다." />
            </div>
          )}
        </div>
      </Panel>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Panel
          title="승인 대기 / 결과 공유 대기"
          description="동료 선택 승인, 결과 공유, 미응답 리마인드 대상을 같은 운영 패널 안에서 빠르게 확인합니다."
        >
          <div className="space-y-3">
            {admin?.nominationQueue?.length ? (
              admin.nominationQueue.map((item) => (
                <div key={`${item.roundId}:${item.targetId}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-semibold text-slate-900">{item.targetName}</div>
                    <Badge>{item.status}</Badge>
                  </div>
                  <div className="mt-2 text-sm text-slate-500">
                    {item.roundName} · 승인 {item.approvedCount}/{item.totalCount} · 발행 {item.publishedCount}
                  </div>
                </div>
              ))
            ) : (
              <EmptyBlock message="현재 별도로 확인할 nomination 대기 건이 없습니다." />
            )}
          </div>
        </Panel>

        <Panel
          title="운영 알림"
          description="응답률 저하, careless review 의심, 익명 기준 미달 같은 운영 경고를 모아 봅니다."
        >
          <div className="space-y-3">
            {admin?.alerts?.length ? (
              admin.alerts.map((alert) => (
                <div key={alert} className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  {alert}
                </div>
              ))
            ) : (
              <EmptyBlock message="현재 별도 경고 없이 운영 중입니다." />
            )}
            <div className="grid gap-3">
              <ActionLink href="/evaluation/results" label="평가 결과 확인" />
              <ActionLink href="/evaluation/workbench" label="평가 워크벤치로 이동" />
              <ActionLink href="/admin/notifications" label="알림 운영 화면" />
            </div>
          </div>
        </Panel>
      </section>

      <Panel title="운영 타임라인" description="라운드 상태, 응답률, 마감일 기준으로 운영 이력을 한 줄로 파악합니다.">
        <MultiRaterTimeline items={admin?.timeline ?? []} />
      </Panel>

      {resultShare ? (
        <Panel
          title="결과 공유 / 열람 확인"
          description={`${resultShare.roundName} 결과 공유 이후 리더와 리뷰 대상자의 열람 여부를 함께 추적합니다.`}
          action={
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  openResultShareReminder(
                    selectedResultShareTargetIds.length
                      ? selectedResultShareTargetIds
                      : visibleResultShareTargetIds
                  )
                }
                disabled={busy || !visibleResultShareTargetIds.length}
                className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
              >
                {selectedResultShareTargetIds.length ? '선택 대상 공유' : '전원 공유'}
              </button>
              <button
                type="button"
                onClick={() => openResultShareReminder(visibleResultShareTargetIds)}
                disabled={busy || !visibleResultShareTargetIds.length}
                className="inline-flex min-h-10 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                결과 공유 열기
              </button>
            </div>
          }
        >
          {resultShare.rows.length ? (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <MiniStat label="결과 대상자" value={`${resultShare.totalTargets}명`} />
                <MiniStat label="리더 공유 / 열람" value={`${resultShare.leaderSharedCount} / ${resultShare.leaderViewedCount}`} />
                <MiniStat label="대상자 공유 / 열람" value={`${resultShare.revieweeSharedCount} / ${resultShare.revieweeViewedCount}`} />
                <MiniStat label="리더 없음" value={`${resultShare.rows.filter((row) => row.leaderStatus === 'NO_LEADER').length}명`} />
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <ShareProgressCard
                  label="리더 공유 진행"
                  sharedCount={resultShare.leaderSharedCount}
                  viewedCount={resultShare.leaderViewedCount}
                  totalCount={Math.max(resultShare.rows.filter((row) => row.leaderStatus !== 'NO_LEADER').length, 1)}
                />
                <ShareProgressCard
                  label="리뷰 대상자 공유 진행"
                  sharedCount={resultShare.revieweeSharedCount}
                  viewedCount={resultShare.revieweeViewedCount}
                  totalCount={Math.max(resultShare.totalTargets, 1)}
                />
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="text-sm text-slate-700">
                    현재 선택 <span className="font-semibold text-slate-900">{selectedResultShareTargetIds.length}</span>명 · 표시{' '}
                    <span className="font-semibold text-slate-900">{visibleResultShareTargetIds.length}</span>명 · 전체{' '}
                    <span className="font-semibold text-slate-900">{resultShare.totalTargets}</span>명
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={selectAllResultShareTargets}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-white"
                    >
                      전체 {visibleResultShareTargetIds.length}명 선택
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedResultShareTargetIds([])}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-white"
                    >
                      선택 취소
                    </button>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <div className="grid min-w-[980px] grid-cols-[52px_minmax(0,1.2fr)_minmax(0,1fr)_190px_190px_120px] items-center gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  <label className="inline-flex items-center justify-center">
                    <input
                      type="checkbox"
                      checked={allResultShareSelected}
                      onChange={toggleAllResultShareTargets}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                  </label>
                  <span>대상자</span>
                  <span>리더</span>
                  <span>리더 공유 상태</span>
                  <span>대상자 공유 상태</span>
                  <span>결과 보기</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {resultShare.rows.map((row) => (
                    <div
                      key={row.targetId}
                      className="grid min-w-[980px] grid-cols-[52px_minmax(0,1.2fr)_minmax(0,1fr)_190px_190px_120px] items-start gap-3 px-4 py-3 text-sm text-slate-700"
                    >
                      <label className="inline-flex items-center justify-center pt-1">
                        <input
                          type="checkbox"
                          checked={selectedResultShareTargetIds.includes(row.targetId)}
                          onChange={() => toggleResultShareTarget(row.targetId)}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                      </label>
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-slate-900">{row.targetName}</div>
                        <div className="mt-1 text-xs text-slate-500">{row.departmentName}</div>
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-slate-900">{row.leaderName ?? '리더 없음'}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {row.leaderViewedAt
                            ? `열람 ${formatDateTimeLabel(row.leaderViewedAt)}`
                            : row.leaderSharedAt
                              ? `공유 ${formatDateTimeLabel(row.leaderSharedAt)}`
                              : '공유 이력 없음'}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getReceiptStatusChipClass(row.leaderStatus)}`}>
                          {getReceiptStatusLabel(row.leaderStatus)}
                        </span>
                        <div className="text-xs text-slate-500">
                          {row.leaderViewedAt
                            ? formatDateTimeLabel(row.leaderViewedAt)
                            : row.leaderSharedAt
                              ? formatDateTimeLabel(row.leaderSharedAt)
                              : '-'}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getReceiptStatusChipClass(row.revieweeStatus)}`}>
                          {getReceiptStatusLabel(row.revieweeStatus)}
                        </span>
                        <div className="text-xs text-slate-500">
                          {row.revieweeViewedAt
                            ? formatDateTimeLabel(row.revieweeViewedAt)
                            : row.revieweeSharedAt
                              ? formatDateTimeLabel(row.revieweeSharedAt)
                              : '-'}
                        </div>
                      </div>
                      <div>
                        <Link
                          href={row.resultHref}
                          className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-300 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          결과 보기
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <EmptyBlock message="현재 공유 가능한 결과 대상자가 없습니다. 제출된 리뷰가 쌓이면 이 영역에서 공유와 열람 상태를 함께 추적할 수 있습니다." />
          )}
        </Panel>
      ) : null}

      {folderDialogOpen ? (
        <ModalFrame title="리뷰 폴더 관리" onClose={() => setFolderDialogOpen(false)}>
          <div className="space-y-4">
            <div className="space-y-3">
              {(admin?.folders ?? []).length ? (
                admin?.folders.map((folder) => (
                  <div key={folder.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-slate-900">{folder.name}</div>
                        <div className="mt-1 text-sm text-slate-500">
                          {folder.description || '설명이 없습니다.'} · 라운드 {folder.roundCount}개
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setFolderDraft({
                              id: folder.id,
                              name: folder.name,
                              description: folder.description ?? '',
                            })
                          }
                          className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-white"
                        >
                          수정
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteFolder(folder.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          삭제
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyBlock message="아직 만든 폴더가 없습니다. 운영 목적에 맞게 라운드를 먼저 묶어 보세요." />
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-900">
                {folderDraft.id ? '폴더 수정' : '새 폴더 만들기'}
              </div>
              <div className="mt-4 space-y-3">
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">이름</span>
                  <input
                    value={folderDraft.name}
                    onChange={(event) => setFolderDraft((current) => ({ ...current, name: event.target.value }))}
                    className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-900"
                    placeholder="예: 2026 상반기 / 리더 후보군"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">설명</span>
                  <textarea
                    value={folderDraft.description}
                    onChange={(event) => setFolderDraft((current) => ({ ...current, description: event.target.value }))}
                    className="mt-2 min-h-24 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900"
                    placeholder="폴더를 어떤 운영 목적에 쓰는지 간단히 남겨두면 찾기 쉽습니다."
                  />
                </label>
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setFolderDialogOpen(false)}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                닫기
              </button>
              <button
                type="button"
                onClick={() => void handleSaveFolder()}
                disabled={busy || !folderDraft.name.trim()}
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                {folderDraft.id ? '폴더 수정' : '폴더 생성'}
              </button>
            </div>
          </div>
        </ModalFrame>
      ) : null}

      {groupDialogOpen ? (
        <ModalFrame
          title={groupDraft.id ? '리뷰 권한 그룹 수정' : '리뷰 권한 그룹 추가'}
          onClose={() => setGroupDialogOpen(false)}
        >
          <div className="space-y-6">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-4">
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">그룹 이름</span>
                  <input
                    value={groupDraft.groupName}
                    onChange={(event) =>
                      setGroupDraft((current) => ({ ...current, groupName: event.target.value }))
                    }
                    className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-900"
                    placeholder="예: 일부 리뷰 열람 및 수정"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">설명</span>
                  <textarea
                    value={groupDraft.description}
                    onChange={(event) =>
                      setGroupDraft((current) => ({ ...current, description: event.target.value }))
                    }
                    className="mt-2 min-h-24 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900"
                    placeholder="이 그룹이 어떤 리뷰 범위를 다루는지 설명을 남겨 주세요."
                  />
                </label>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-900">권한 범위</div>
                <div className="mt-3 space-y-3">
                  {REVIEW_ADMIN_SCOPE_OPTIONS.map((option) => (
                    <label
                      key={option.value}
                      className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${
                        groupDraft.reviewScope === option.value
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 bg-white text-slate-700'
                      }`}
                    >
                      <input
                        type="radio"
                        name="review-admin-scope"
                        checked={groupDraft.reviewScope === option.value}
                        onChange={() =>
                          setGroupDraft((current) => ({ ...current, reviewScope: option.value }))
                        }
                        className="mt-1 h-4 w-4 border-slate-300"
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold">{option.label}</div>
                        <p
                          className={`mt-1 text-sm leading-6 ${
                            groupDraft.reviewScope === option.value ? 'text-slate-200' : 'text-slate-500'
                          }`}
                        >
                          {option.description}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="space-y-3">
                {/*
                <div className="text-sm font-semibold text-slate-900">그룹 구성원</div>
                <input
                  value={groupSearch}
                  onChange={(event) => setGroupSearch(event.target.value)}
                  className="min-h-11 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-900"
                  placeholder="이름, 조직, 역할, 이메일로 검색"
                />
                */}
                <div className="text-sm font-semibold text-slate-900">{'\uADF8\uB8F9 \uAD6C\uC131\uC6D0'}</div>
                <input
                  value={groupSearch}
                  onChange={(event) => setGroupSearch(event.target.value)}
                  className="min-h-11 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-900"
                  placeholder={'\uC774\uB984, \uC870\uC9C1, \uC5ED\uD560, \uC774\uBA54\uC77C\uB85C \uAC80\uC0C9'}
                />
                <div className="max-h-80 space-y-2 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  {filteredReviewAdminCandidates.length ? (
                    filteredReviewAdminCandidates.map((candidate) => {
                      const checked = groupDraft.memberIds.includes(candidate.employeeId)
                      return (
                        <label
                          key={candidate.employeeId}
                          className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleGroupMember(candidate.employeeId)}
                            className="mt-1 h-4 w-4 rounded border-slate-300"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold text-slate-900">{candidate.name}</span>
                              <Badge tone={candidate.canReadCollaboratorContent ? 'emerald' : 'blue'}>
                                {candidate.summaryLabel}
                              </Badge>
                            </div>
                            <div className="mt-1 text-sm text-slate-500">
                              {candidate.departmentName} · {candidate.position}
                            </div>
                            <div className="mt-1 text-xs text-slate-400">{candidate.email}</div>
                          </div>
                        </label>
                      )
                    })
                  ) : (
                    <EmptyBlock message="추가할 수 있는 구성원이 없습니다." />
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-slate-900">선택된 구성원</div>
                  <Badge tone={selectedGroupMembers.length ? 'blue' : 'slate'}>{selectedGroupMembers.length}명</Badge>
                </div>
                <div className="mt-3 space-y-3">
                  {selectedGroupMembers.length ? (
                    selectedGroupMembers.map((candidate) => (
                      <div key={candidate.employeeId} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-slate-900">{candidate.name}</div>
                            <div className="mt-1 text-sm text-slate-500">
                              {candidate.departmentName} · {candidate.position}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleGroupMember(candidate.employeeId)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-white"
                            aria-label={`${candidate.name} 제거`}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="mt-3 text-xs text-slate-500">{candidate.summaryLabel}</div>
                      </div>
                    ))
                  ) : (
                    <EmptyBlock message="아직 그룹 구성원을 선택하지 않았습니다." />
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setGroupDialogOpen(false)}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                닫기
              </button>
              <button
                type="button"
                onClick={() => void handleSaveReviewAdminGroup()}
                disabled={busy || !groupDraft.groupName.trim()}
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                {groupDraft.id ? '권한 그룹 수정' : '권한 그룹 생성'}
              </button>
            </div>
          </div>
        </ModalFrame>
      ) : null}

      {settingsDialogOpen && selectedRound ? (
        <ModalFrame title={`${selectedRound.roundName} 설정`} onClose={() => setSettingsDialogOpen(false)}>
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-900">동료 선택 방식</div>
              <div className="mt-4 space-y-3">
                <ToggleLine
                  label="리더의 승인 필요"
                  description="동료 선정 초안을 제출한 뒤 리더가 승인해야 다음 단계로 넘어갑니다."
                  checked={selectionSettings.requireLeaderApproval}
                  onChange={(checked) =>
                    setSelectionSettings((current) => ({ ...current, requireLeaderApproval: checked }))
                  }
                />
                <ToggleLine
                  label="리뷰를 써주고 싶은 동료 선택 가능"
                  description="대상자가 협업 빈도가 높은 동료를 직접 추천할 수 있게 합니다."
                  checked={selectionSettings.allowPreferredPeers}
                  onChange={(checked) =>
                    setSelectionSettings((current) => ({ ...current, allowPreferredPeers: checked }))
                  }
                />
                <ToggleLine
                  label="리뷰 대상자는 본인의 리더 선택 불가"
                  description="리더 중복 지정을 막아 peer pool을 더 분명하게 유지합니다."
                  checked={selectionSettings.excludeLeaderFromPeerSelection}
                  onChange={(checked) =>
                    setSelectionSettings((current) => ({ ...current, excludeLeaderFromPeerSelection: checked }))
                  }
                />
                <ToggleLine
                  label="리뷰 대상자는 본인의 팀원 선택 불가"
                  description="리더가 peer reviewer를 고를 때 직접 팀원을 자동 제외합니다."
                  checked={selectionSettings.excludeDirectReportsFromPeerSelection}
                  onChange={(checked) =>
                    setSelectionSettings((current) => ({ ...current, excludeDirectReportsFromPeerSelection: checked }))
                  }
                />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">직무/직급 역할 아키텍처</div>
                  <p className="mt-1 text-sm text-slate-500">
                    리뷰 작성 시 직무군, 레벨, 기대 역량, 다음 레벨 기대를 함께 보여줄 기준을 설정합니다.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setSelectionSettings((current) => ({
                      ...current,
                      skillArchitecture: {
                        ...current.skillArchitecture,
                        enabled: true,
                        roleProfiles: [
                          ...current.skillArchitecture.roleProfiles,
                          {
                            id: `role-${Date.now()}`,
                            label: '새 역할 가이드',
                            jobFamily: '',
                            level: '',
                            guideText: '',
                            expectedCompetencies: [],
                            nextLevelExpectations: [],
                            goalLibrary: [],
                            filters: {
                              departmentKeyword: '',
                              roleKeyword: '',
                              position: '',
                              jobTitleKeyword: '',
                              teamNameKeyword: '',
                            },
                          },
                        ],
                      },
                    }))
                  }
                  className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  프로필 추가
                </button>
              </div>

              <div className="mt-4 space-y-4">
                <ToggleLine
                  label="역할 가이드 사용"
                  description="대상자의 조직/역할/직책/직무 키워드에 맞는 가이드를 작성 화면에 노출합니다."
                  checked={selectionSettings.skillArchitecture.enabled}
                  onChange={(checked) =>
                    setSelectionSettings((current) => ({
                      ...current,
                      skillArchitecture: {
                        ...current.skillArchitecture,
                        enabled: checked,
                      },
                    }))
                  }
                />

                {selectionSettings.skillArchitecture.roleProfiles.length ? (
                  <div className="space-y-4">
                    {selectionSettings.skillArchitecture.roleProfiles.map((profile, index) => (
                      <div key={profile.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-semibold text-slate-900">역할 프로필 {index + 1}</div>
                          <button
                            type="button"
                            onClick={() =>
                              setSelectionSettings((current) => ({
                                ...current,
                                skillArchitecture: {
                                  ...current.skillArchitecture,
                                  roleProfiles: current.skillArchitecture.roleProfiles.filter((item) => item.id !== profile.id),
                                },
                              }))
                            }
                            className="text-sm font-semibold text-rose-600 transition hover:text-rose-700"
                          >
                            제거
                          </button>
                        </div>

                        <div className="mt-4 grid gap-4 xl:grid-cols-2">
                          <label className="block">
                            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">프로필명</span>
                            <input
                              value={profile.label}
                              onChange={(event) =>
                                setSelectionSettings((current) => ({
                                  ...current,
                                  skillArchitecture: {
                                    ...current.skillArchitecture,
                                    roleProfiles: current.skillArchitecture.roleProfiles.map((item) =>
                                      item.id === profile.id ? { ...item, label: event.target.value } : item
                                    ),
                                  },
                                }))
                              }
                              className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900"
                            />
                          </label>
                          <label className="block">
                            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">직무군 / 레벨</span>
                            <div className="mt-2 grid gap-3 md:grid-cols-2">
                              <input
                                value={profile.jobFamily}
                                onChange={(event) =>
                                  setSelectionSettings((current) => ({
                                    ...current,
                                    skillArchitecture: {
                                      ...current.skillArchitecture,
                                      roleProfiles: current.skillArchitecture.roleProfiles.map((item) =>
                                        item.id === profile.id ? { ...item, jobFamily: event.target.value } : item
                                      ),
                                    },
                                  }))
                                }
                                placeholder="예: Sales / HRBP"
                                className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900"
                              />
                              <input
                                value={profile.level}
                                onChange={(event) =>
                                  setSelectionSettings((current) => ({
                                    ...current,
                                    skillArchitecture: {
                                      ...current.skillArchitecture,
                                      roleProfiles: current.skillArchitecture.roleProfiles.map((item) =>
                                        item.id === profile.id ? { ...item, level: event.target.value } : item
                                      ),
                                    },
                                  }))
                                }
                                placeholder="예: IC3 / 팀장"
                                className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900"
                              />
                            </div>
                          </label>
                        </div>

                        <div className="mt-4 grid gap-4 xl:grid-cols-3">
                          {[
                            ['departmentKeyword', '조직 키워드'],
                            ['roleKeyword', '역할 키워드'],
                            ['position', '직책'],
                            ['jobTitleKeyword', '직무명 키워드'],
                            ['teamNameKeyword', '팀명 키워드'],
                          ].map(([field, label]) => (
                            <label key={field} className="block">
                              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</span>
                              <input
                                value={String(profile.filters[field as keyof typeof profile.filters] ?? '')}
                                onChange={(event) =>
                                  setSelectionSettings((current) => ({
                                    ...current,
                                    skillArchitecture: {
                                      ...current.skillArchitecture,
                                      roleProfiles: current.skillArchitecture.roleProfiles.map((item) =>
                                        item.id === profile.id
                                          ? {
                                              ...item,
                                              filters: {
                                                ...item.filters,
                                                [field]: event.target.value,
                                              },
                                            }
                                          : item
                                      ),
                                    },
                                  }))
                                }
                                className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900"
                              />
                            </label>
                          ))}
                        </div>

                        <label className="mt-4 block">
                          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">가이드 본문</span>
                          <textarea
                            value={profile.guideText}
                            onChange={(event) =>
                              setSelectionSettings((current) => ({
                                ...current,
                                skillArchitecture: {
                                  ...current.skillArchitecture,
                                  roleProfiles: current.skillArchitecture.roleProfiles.map((item) =>
                                    item.id === profile.id ? { ...item, guideText: event.target.value } : item
                                  ),
                                },
                              }))
                            }
                            className="mt-2 min-h-28 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900"
                          />
                        </label>

                        <div className="mt-4 grid gap-4 xl:grid-cols-3">
                          {[
                            ['expectedCompetencies', '기대 역량'],
                            ['nextLevelExpectations', '다음 레벨 기대'],
                            ['goalLibrary', '추천 목표 라이브러리'],
                          ].map(([field, label]) => (
                            <label key={field} className="block">
                              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</span>
                              <textarea
                                value={(profile[field as keyof typeof profile] as string[]).join(', ')}
                                onChange={(event) =>
                                  setSelectionSettings((current) => ({
                                    ...current,
                                    skillArchitecture: {
                                      ...current.skillArchitecture,
                                      roleProfiles: current.skillArchitecture.roleProfiles.map((item) =>
                                        item.id === profile.id
                                          ? {
                                              ...item,
                                              [field]: event.target.value
                                                .split(',')
                                                .map((value) => value.trim())
                                                .filter(Boolean),
                                            }
                                          : item
                                      ),
                                    },
                                  }))
                                }
                                className="mt-2 min-h-24 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900"
                                placeholder="쉼표로 구분해 입력해 주세요."
                              />
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                    아직 등록된 역할 프로필이 없습니다. 프로필 추가 후 직무/직급별 가이드를 저장해 주세요.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-900">AI 코파일럿</div>
              <p className="mt-1 text-sm text-slate-500">
                최근 리뷰, 목표, 1:1 기록을 바탕으로 성장 포인트와 코칭 질문 초안을 제안합니다. AI는 초안과 권고 역할만 수행합니다.
              </p>

              <div className="mt-4 space-y-4">
                <ToggleLine
                  label="AI 코파일럿 사용"
                  description="결과 화면에서 성장 코파일럿 제안을 생성할 수 있습니다."
                  checked={selectionSettings.aiCopilot.enabled}
                  onChange={(checked) =>
                    setSelectionSettings((current) => ({
                      ...current,
                      aiCopilot: {
                        ...current.aiCopilot,
                        enabled: checked,
                      },
                    }))
                  }
                />

                <div className="grid gap-3 xl:grid-cols-2">
                  <ToggleLine
                    label="리더에게 노출"
                    description="리더가 결과 화면에서 성장 코파일럿을 볼 수 있습니다."
                    checked={selectionSettings.aiCopilot.allowManagerView}
                    onChange={(checked) =>
                      setSelectionSettings((current) => ({
                        ...current,
                        aiCopilot: {
                          ...current.aiCopilot,
                          allowManagerView: checked,
                        },
                      }))
                    }
                  />
                  <ToggleLine
                    label="본인에게 노출"
                    description="구성원 본인이 자기 결과 화면에서 성장 코파일럿을 볼 수 있습니다."
                    checked={selectionSettings.aiCopilot.allowSelfView}
                    onChange={(checked) =>
                      setSelectionSettings((current) => ({
                        ...current,
                        aiCopilot: {
                          ...current.aiCopilot,
                          allowSelfView: checked,
                        },
                      }))
                    }
                  />
                  <ToggleLine
                    label="목표 정보 포함"
                    description="개인 목표와 최근 진척 정보를 AI 제안에 포함합니다."
                    checked={selectionSettings.aiCopilot.includeGoals}
                    onChange={(checked) =>
                      setSelectionSettings((current) => ({
                        ...current,
                        aiCopilot: {
                          ...current.aiCopilot,
                          includeGoals: checked,
                        },
                      }))
                    }
                  />
                  <ToggleLine
                    label="1:1 / 체크인 포함"
                    description="최근 1:1 메모와 체크인 내용을 AI 제안에 포함합니다."
                    checked={selectionSettings.aiCopilot.includeCheckins}
                    onChange={(checked) =>
                      setSelectionSettings((current) => ({
                        ...current,
                        aiCopilot: {
                          ...current.aiCopilot,
                          includeCheckins: checked,
                        },
                      }))
                    }
                  />
                  <ToggleLine
                    label="리뷰 신호 포함"
                    description="강점/개선 포인트와 텍스트 하이라이트를 AI 제안에 포함합니다."
                    checked={selectionSettings.aiCopilot.includeFeedback}
                    onChange={(checked) =>
                      setSelectionSettings((current) => ({
                        ...current,
                        aiCopilot: {
                          ...current.aiCopilot,
                          includeFeedback: checked,
                        },
                      }))
                    }
                  />
                  <ToggleLine
                    label="결과 요약 포함"
                    description="카테고리 점수와 종합 요약을 AI 제안의 참고 근거로 사용합니다."
                    checked={selectionSettings.aiCopilot.includeResults}
                    onChange={(checked) =>
                      setSelectionSettings((current) => ({
                        ...current,
                        aiCopilot: {
                          ...current.aiCopilot,
                          includeResults: checked,
                        },
                      }))
                    }
                  />
                </div>

                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">화면 안내 문구</span>
                  <textarea
                    value={selectionSettings.aiCopilot.disclaimer}
                    onChange={(event) =>
                      setSelectionSettings((current) => ({
                        ...current,
                        aiCopilot: {
                          ...current.aiCopilot,
                          disclaimer: event.target.value,
                        },
                      }))
                    }
                    className="mt-2 min-h-24 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900"
                  />
                </label>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-900">리더 효과성 / 리더 코칭 리뷰</div>
              <p className="mt-1 text-sm text-slate-500">
                리더를 별도 평가 대상으로 설정하고, 자기/상사/동료/직속 부하 조합을 운영합니다.
              </p>

              <div className="mt-4 space-y-3">
                <ToggleLine
                  label="리더 효과성 리뷰 사용"
                  description="리더 대상 리뷰를 별도 트랙으로 운영하고, 결과를 코칭과 1:1 후속 조치에 연결합니다."
                  checked={selectionSettings.managerEffectiveness.enabled}
                  onChange={(checked) =>
                    setSelectionSettings((current) => ({
                      ...current,
                      managerEffectiveness: {
                        ...current.managerEffectiveness,
                        enabled: checked,
                      },
                    }))
                  }
                />

                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">대상 범위</span>
                  <select
                    value={selectionSettings.managerEffectiveness.targetScope}
                    onChange={(event) =>
                      setSelectionSettings((current) => ({
                        ...current,
                        managerEffectiveness: {
                          ...current.managerEffectiveness,
                          targetScope: event.target.value as typeof current.managerEffectiveness.targetScope,
                        },
                      }))
                    }
                    className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900"
                  >
                    <option value="MANAGERS_ONLY">리더만 대상자</option>
                    <option value="ALL">전체 대상자 허용</option>
                  </select>
                </label>

                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">핵심 역량 라벨</span>
                  <input
                    value={selectionSettings.managerEffectiveness.competencyLabels.join(', ')}
                    onChange={(event) =>
                      setSelectionSettings((current) => ({
                        ...current,
                        managerEffectiveness: {
                          ...current.managerEffectiveness,
                          competencyLabels: event.target.value
                            .split(',')
                            .map((item) => item.trim())
                            .filter(Boolean)
                            .slice(0, 10),
                        },
                      }))
                    }
                    className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-900"
                    placeholder="예: 코칭, 피드백, 기대치 설정, 의사결정"
                  />
                </label>

                <ToggleLine
                  label="자기 평가 포함"
                  description="리더 본인의 자기 인식 정보를 함께 수집합니다."
                  checked={selectionSettings.managerEffectiveness.reviewerCombination.self}
                  onChange={(checked) =>
                    setSelectionSettings((current) => ({
                      ...current,
                      managerEffectiveness: {
                        ...current.managerEffectiveness,
                        reviewerCombination: {
                          ...current.managerEffectiveness.reviewerCombination,
                          self: checked,
                        },
                      },
                    }))
                  }
                />
                <ToggleLine
                  label="상사 평가 포함"
                  description="리더의 상위 리더 또는 본부장의 관찰을 함께 수집합니다."
                  checked={selectionSettings.managerEffectiveness.reviewerCombination.supervisor}
                  onChange={(checked) =>
                    setSelectionSettings((current) => ({
                      ...current,
                      managerEffectiveness: {
                        ...current.managerEffectiveness,
                        reviewerCombination: {
                          ...current.managerEffectiveness.reviewerCombination,
                          supervisor: checked,
                        },
                      },
                    }))
                  }
                />
                <ToggleLine
                  label="동료 평가 포함"
                  description="협업 리더 관점의 피드백을 수집합니다."
                  checked={selectionSettings.managerEffectiveness.reviewerCombination.peer}
                  onChange={(checked) =>
                    setSelectionSettings((current) => ({
                      ...current,
                      managerEffectiveness: {
                        ...current.managerEffectiveness,
                        reviewerCombination: {
                          ...current.managerEffectiveness.reviewerCombination,
                          peer: checked,
                        },
                      },
                    }))
                  }
                />
                <ToggleLine
                  label="직속 부하 평가 포함"
                  description="직접 함께 일하는 팀원의 반응과 체감 품질을 수집합니다."
                  checked={selectionSettings.managerEffectiveness.reviewerCombination.subordinate}
                  onChange={(checked) =>
                    setSelectionSettings((current) => ({
                      ...current,
                      managerEffectiveness: {
                        ...current.managerEffectiveness,
                        reviewerCombination: {
                          ...current.managerEffectiveness.reviewerCombination,
                          subordinate: checked,
                        },
                      },
                    }))
                  }
                />
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">현재 수집 조합</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {getManagerEffectivenessReviewerSummary(selectionSettings.managerEffectiveness).map((item) => (
                    <Badge key={item} tone="blue">
                      {item}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-900">등급 가이드 / 상대평가 배분</div>
              <p className="mt-1 text-sm text-slate-500">
                등급형 질문을 기준으로 대상자 맞춤 가이드와 평가자·조직 기준 배분 정책을 함께 설정합니다.
              </p>

              {ratingQuestionOptions.length ? (
                <div className="mt-4 space-y-4">
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_220px_220px]">
                    <label className="block">
                      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                        등급 질문
                      </span>
                      <select
                        value={ratingGuideSettings.distributionQuestionId ?? ratingQuestionOptions[0]?.id ?? ''}
                        onChange={(event) => {
                          const nextQuestion = ratingQuestionOptions.find((question) => question.id === event.target.value)
                          setRatingGuideSettings((current) => ({
                            ...current,
                            distributionQuestionId: nextQuestion?.id,
                            scaleEntries: nextQuestion
                              ? buildFeedbackRatingScaleEntries({
                                  scaleMin: nextQuestion.scaleMin,
                                  scaleMax: nextQuestion.scaleMax,
                                  existingEntries: current.scaleEntries,
                                })
                              : [],
                          }))
                        }}
                        className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900"
                      >
                        {ratingQuestionOptions.map((question) => (
                          <option key={question.id} value={question.id}>
                            {question.questionText}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                        배분 방식
                      </span>
                      <select
                        value={ratingGuideSettings.distributionMode}
                        onChange={(event) =>
                          setRatingGuideSettings((current) => ({
                            ...current,
                            distributionMode: event.target.value as FeedbackRatingGuideSettings['distributionMode'],
                          }))
                        }
                        className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900"
                      >
                        <option value="NONE">가이드 없음</option>
                        <option value="RATIO">비율 기준</option>
                        <option value="HEADCOUNT">인원 기준</option>
                      </select>
                    </label>

                    <label className="block">
                      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                        적용 범위
                      </span>
                      <select
                        value={ratingGuideSettings.distributionScope}
                        onChange={(event) =>
                          setRatingGuideSettings((current) => ({
                            ...current,
                            distributionScope: event.target.value as FeedbackRatingGuideSettings['distributionScope'],
                          }))
                        }
                        disabled={ratingGuideSettings.distributionMode === 'NONE'}
                        className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 disabled:bg-slate-100"
                      >
                        <option value="EVALUATOR">평가자 기준</option>
                        <option value="DEPARTMENT">조직 기준</option>
                      </select>
                    </label>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap gap-2">
                      <Badge tone="emerald">가장 높은 등급 / 가장 낮은 등급은 자동 표시됩니다.</Badge>
                      <Badge tone="slate">비평가 등급은 배분 계산에서 제외됩니다.</Badge>
                    </div>
                    <div className="mt-4 space-y-3">
                      {ratingGuideScaleEntries.map((entry) => (
                        <div key={entry.value} className="rounded-2xl border border-slate-200 bg-white p-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-sm font-semibold text-slate-900">등급 값 {entry.value}</div>
                            {entry.isHighest ? <Badge tone="emerald">가장 높은 등급</Badge> : null}
                            {entry.isLowest ? <Badge tone="blue">가장 낮은 등급</Badge> : null}
                            {entry.isNonEvaluative ? <Badge tone="slate">비평가 등급</Badge> : null}
                          </div>

                          <div className="mt-3 grid gap-3 xl:grid-cols-[140px_minmax(0,1fr)_140px_140px]">
                            <label className="block">
                              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                                라벨
                              </span>
                              <input
                                value={entry.label}
                                onChange={(event) =>
                                  setRatingGuideSettings((current) => ({
                                    ...current,
                                    scaleEntries: current.scaleEntries.map((item) =>
                                      item.value === entry.value ? { ...item, label: event.target.value } : item
                                    ),
                                  }))
                                }
                                className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-900"
                              />
                            </label>
                            <label className="block">
                              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                                기본 설명
                              </span>
                              <textarea
                                value={entry.description}
                                onChange={(event) =>
                                  setRatingGuideSettings((current) => ({
                                    ...current,
                                    scaleEntries: current.scaleEntries.map((item) =>
                                      item.value === entry.value ? { ...item, description: event.target.value } : item
                                    ),
                                  }))
                                }
                                className="mt-2 min-h-24 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900"
                              />
                            </label>
                            <label className="block">
                              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                                비율(%)
                              </span>
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={entry.targetRatio ?? ''}
                                onChange={(event) =>
                                  setRatingGuideSettings((current) => ({
                                    ...current,
                                    scaleEntries: current.scaleEntries.map((item) =>
                                      item.value === entry.value
                                        ? {
                                            ...item,
                                            targetRatio: event.target.value === '' ? null : Number(event.target.value),
                                          }
                                        : item
                                    ),
                                  }))
                                }
                                disabled={ratingGuideSettings.distributionMode === 'NONE' || entry.isNonEvaluative}
                                className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-900 disabled:bg-slate-100"
                              />
                            </label>
                            <label className="block">
                              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                                제한 인원
                              </span>
                              <input
                                type="number"
                                min={0}
                                max={999}
                                value={entry.headcountLimit ?? ''}
                                onChange={(event) =>
                                  setRatingGuideSettings((current) => ({
                                    ...current,
                                    scaleEntries: current.scaleEntries.map((item) =>
                                      item.value === entry.value
                                        ? {
                                            ...item,
                                            headcountLimit:
                                              event.target.value === '' ? null : Number(event.target.value),
                                          }
                                        : item
                                    ),
                                  }))
                                }
                                disabled={ratingGuideSettings.distributionMode !== 'HEADCOUNT' || entry.isNonEvaluative}
                                className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-900 disabled:bg-slate-100"
                              />
                            </label>
                          </div>

                          <div className="mt-3">
                            <ToggleLine
                              label="비평가 등급으로 처리"
                              description="비평가 등급은 최고/최저 표시와 배분 계산에서 제외됩니다."
                              checked={entry.isNonEvaluative}
                              onChange={(checked) =>
                                setRatingGuideSettings((current) => ({
                                  ...current,
                                  scaleEntries: current.scaleEntries.map((item) =>
                                    item.value === entry.value
                                      ? {
                                          ...item,
                                          isNonEvaluative: checked,
                                          targetRatio: checked ? null : item.targetRatio,
                                          headcountLimit: checked ? null : item.headcountLimit,
                                        }
                                      : item
                                  ),
                                }))
                              }
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">대상자 인사정보별 가이드</div>
                        <p className="mt-1 text-sm text-slate-500">
                          조직 / 역할 / 직책 / 직급 / 팀 키워드에 따라 다른 가이드 문구를 보여줍니다.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setRatingGuideSettings((current) => ({
                            ...current,
                            guideRules: [...current.guideRules, createEmptyRatingGuideRule()],
                          }))
                        }
                        className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-white"
                      >
                        가이드 추가
                      </button>
                    </div>

                    <div className="mt-4 space-y-4">
                      {ratingGuideSettings.guideRules.length ? (
                        ratingGuideSettings.guideRules.map((rule) => (
                          <div key={rule.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-sm font-semibold text-slate-900">{rule.label}</div>
                                <div className="mt-1 text-xs text-slate-500">
                                  더 구체적인 조건을 가진 가이드가 우선 적용됩니다.
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  setRatingGuideSettings((current) => ({
                                    ...current,
                                    guideRules: current.guideRules.filter((item) => item.id !== rule.id),
                                  }))
                                }
                                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-50"
                                aria-label={`${rule.label} 삭제`}
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>

                            <div className="mt-4 grid gap-3 xl:grid-cols-2">
                              <label className="block">
                                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                                  가이드 이름
                                </span>
                                <input
                                  value={rule.label}
                                  onChange={(event) =>
                                    setRatingGuideSettings((current) => ({
                                      ...current,
                                      guideRules: current.guideRules.map((item) =>
                                        item.id === rule.id ? { ...item, label: event.target.value } : item
                                      ),
                                    }))
                                  }
                                  className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-900"
                                />
                              </label>
                              <label className="block">
                                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                                  헤드라인
                                </span>
                                <input
                                  value={rule.headline}
                                  onChange={(event) =>
                                    setRatingGuideSettings((current) => ({
                                      ...current,
                                      guideRules: current.guideRules.map((item) =>
                                        item.id === rule.id ? { ...item, headline: event.target.value } : item
                                      ),
                                    }))
                                  }
                                  className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-900"
                                />
                              </label>
                              <label className="block xl:col-span-2">
                                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                                  안내 문구
                                </span>
                                <textarea
                                  value={rule.guidance}
                                  onChange={(event) =>
                                    setRatingGuideSettings((current) => ({
                                      ...current,
                                      guideRules: current.guideRules.map((item) =>
                                        item.id === rule.id ? { ...item, guidance: event.target.value } : item
                                      ),
                                    }))
                                  }
                                  className="mt-2 min-h-24 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900"
                                />
                              </label>
                            </div>

                            <div className="mt-4 grid gap-3 xl:grid-cols-5">
                              {([
                                ['departmentKeyword', '조직 키워드'],
                                ['roleKeyword', '역할 키워드'],
                                ['position', '직책'],
                                ['jobTitleKeyword', '직급/직군'],
                                ['teamNameKeyword', '팀명 키워드'],
                              ] as const).map(([field, label]) => (
                                <label key={field} className="block">
                                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                                    {label}
                                  </span>
                                  <input
                                    value={rule.filters[field] ?? ''}
                                    onChange={(event) =>
                                      setRatingGuideSettings((current) => ({
                                        ...current,
                                        guideRules: current.guideRules.map((item) =>
                                          item.id === rule.id
                                            ? {
                                                ...item,
                                                filters: {
                                                  ...item.filters,
                                                  [field]: event.target.value,
                                                },
                                              }
                                            : item
                                        ),
                                      }))
                                    }
                                    className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-900"
                                  />
                                </label>
                              ))}
                            </div>

                            <div className="mt-4 grid gap-3 xl:grid-cols-2">
                              {ratingGuideScaleEntries.map((entry) => (
                                <label key={`${rule.id}-${entry.value}`} className="block rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                  <span className="text-sm font-semibold text-slate-900">{entry.label} 설명</span>
                                  <textarea
                                    value={rule.gradeDescriptions[String(entry.value)] ?? ''}
                                    onChange={(event) =>
                                      setRatingGuideSettings((current) => ({
                                        ...current,
                                        guideRules: current.guideRules.map((item) =>
                                          item.id === rule.id
                                            ? {
                                                ...item,
                                                gradeDescriptions: {
                                                  ...item.gradeDescriptions,
                                                  [String(entry.value)]: event.target.value,
                                                },
                                              }
                                            : item
                                        ),
                                      }))
                                    }
                                    className="mt-3 min-h-24 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900"
                                  />
                                </label>
                              ))}
                            </div>
                          </div>
                        ))
                      ) : (
                        <EmptyBlock message="아직 대상자 인사정보별 등급 가이드가 없습니다." />
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-4">
                  <EmptyBlock message="현재 라운드에는 등급형 질문이 없어 등급 가이드를 설정할 수 없습니다." />
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-900">공동 작업자</div>
                  <p className="mt-1 text-sm text-slate-500">
                    이 리뷰 사이클을 함께 관리할 어드민을 지정하세요. 공동 작업자 변경은 저장 즉시 반영되며,
                    지정된 리뷰에만 권한이 적용됩니다.
                  </p>
                </div>
                <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs font-medium leading-5 text-blue-800">
                  공동 작업자에게는 리뷰 관리 권한이 바로 반영되고, 내용 열람 범위는 권한 그룹 설정을 따릅니다.
                </div>
              </div>
              <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
                <div className="space-y-3">
                  <input
                    value={collaboratorSearch}
                    onChange={(event) => setCollaboratorSearch(event.target.value)}
                    className="min-h-11 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-900"
                    placeholder="이름, 조직, 역할, 이메일로 공동 작업자 검색"
                  />
                  <div className="max-h-72 space-y-2 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    {filteredCollaboratorCandidates.length ? (
                      filteredCollaboratorCandidates.map((candidate) => {
                        const checked = collaboratorIds.includes(candidate.employeeId)
                        return (
                          <label
                            key={candidate.employeeId}
                            className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleCollaborator(candidate.employeeId)}
                              className="mt-1 h-4 w-4 rounded border-slate-300"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-semibold text-slate-900">{candidate.name}</span>
                                <Badge tone={candidate.canReadCollaboratorContent ? 'emerald' : 'blue'}>
                                  {candidate.summaryLabel}
                                </Badge>
                              </div>
                              <div className="mt-1 text-sm text-slate-500">
                                {candidate.departmentName} · {candidate.position}
                              </div>
                              <div className="mt-1 text-xs text-slate-400">{candidate.email}</div>
                            </div>
                          </label>
                        )
                      })
                    ) : (
                      <EmptyBlock message="공동 작업자로 지정할 수 있는 어드민이 없습니다." />
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-slate-900">지정된 공동 작업자</div>
                    <Badge tone={selectedCollaborators.length ? 'blue' : 'slate'}>
                      {selectedCollaborators.length}명
                    </Badge>
                  </div>
                  <div className="mt-3 space-y-3">
                    {selectedCollaborators.length ? (
                      selectedCollaborators.map((candidate) => (
                        <div key={candidate.employeeId} className="rounded-2xl border border-slate-200 bg-white p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-slate-900">{candidate.name}</div>
                              <div className="mt-1 text-sm text-slate-500">
                                {candidate.departmentName} · {candidate.position}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => toggleCollaborator(candidate.employeeId)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-100"
                              aria-label={`${candidate.name} 제거`}
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2 text-xs">
                            <Badge tone={candidate.canManageCollaboratorRounds ? 'emerald' : 'slate'}>
                              리뷰 관리 {candidate.canManageCollaboratorRounds ? '가능' : '불가'}
                            </Badge>
                            <Badge tone={candidate.canReadCollaboratorContent ? 'blue' : 'slate'}>
                              내용 열람 {candidate.canReadCollaboratorContent ? '가능' : '불가'}
                            </Badge>
                          </div>
                        </div>
                      ))
                    ) : (
                      <EmptyBlock message="아직 공동 작업자를 지정하지 않았습니다." />
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-900">진행 중 익명 / 공개 범위</div>
              <p className="mt-1 text-sm text-slate-500">
                리뷰가 진행 중이어도 reviewer type별로 공개 범위를 즉시 조정할 수 있습니다.
              </p>
              <div className="mt-4 space-y-4">
                {Object.entries(visibilitySettings).map(([relationship, value]) => (
                  <div key={relationship} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-sm font-semibold text-slate-900">
                      {REVIEWER_TYPE_LABELS[relationship] ?? relationship}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(Object.keys(VISIBILITY_LABELS) as VisibilityLevel[]).map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() =>
                            setVisibilitySettings((current) => ({ ...current, [relationship]: option }))
                          }
                          className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
                            value === option
                              ? 'border-slate-900 bg-slate-900 text-white'
                              : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {VISIBILITY_LABELS[option]}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-900">결과지 버전 / 공개 항목</div>
              <p className="mt-1 text-sm text-slate-500">
                한 라운드 결과에서 공유 대상별 결과지 버전을 나누고, 공개/비공개 항목을 세밀하게 조정합니다.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {(Object.entries(FEEDBACK_RESULT_PROFILE_LABELS) as Array<
                  [FeedbackResultRecipientProfile, string]
                >).map(([profile, label]) => (
                  <button
                    key={profile}
                    type="button"
                    onClick={() => setSelectedResultVersionProfile(profile)}
                    className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                      selectedResultVersionProfile === profile
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                현재 편집 중: <span className="font-semibold text-slate-900">{FEEDBACK_RESULT_PROFILE_LABELS[selectedResultVersionProfile]}</span>
              </div>
              <div className="mt-4 space-y-3">
                {RESULT_PRESENTATION_FIELDS.map((field) => (
                  <ToggleLine
                    key={field.key}
                    label={field.label}
                    description={field.description}
                    checked={resultPresentationSettings[selectedResultVersionProfile][field.key]}
                    onChange={(checked) =>
                      setResultPresentationSettings((current) => ({
                        ...current,
                        [selectedResultVersionProfile]: {
                          ...current[selectedResultVersionProfile],
                          [field.key]: checked,
                        },
                      }))
                    }
                  />
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-900">개인별 리포트 / 분석 설정</div>
              <p className="mt-1 text-sm text-slate-500">
                개요 문구, 좌측 메뉴, 워딩, 분석 강도를 함께 조정해 개인별 리포트 화면을 조직 언어와 활용 방식에 맞게 구성할 수 있습니다.
              </p>

              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-semibold text-slate-900">리포트 개요 문구</div>
                  <div className="mt-4 space-y-3">
                    <label className="block">
                      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                        회사 / 조직 메시지
                      </span>
                      <textarea
                        value={reportAnalysisSettings.overview.companyMessage}
                        onChange={(event) =>
                          setReportAnalysisSettings((current) => ({
                            ...current,
                            overview: {
                              ...current.overview,
                              companyMessage: event.target.value,
                            },
                          }))
                        }
                        className="mt-2 min-h-24 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900"
                        placeholder="리포트 상단에 보여줄 조직 메시지를 입력해 주세요."
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                        리포트 활용 취지
                      </span>
                      <textarea
                        value={reportAnalysisSettings.overview.purposeMessage}
                        onChange={(event) =>
                          setReportAnalysisSettings((current) => ({
                            ...current,
                            overview: {
                              ...current.overview,
                              purposeMessage: event.target.value,
                            },
                          }))
                        }
                        className="mt-2 min-h-24 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900"
                        placeholder="리포트 활용 취지를 입력해 주세요."
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                        수용도 가이드
                      </span>
                      <textarea
                        value={reportAnalysisSettings.overview.acceptanceGuide}
                        onChange={(event) =>
                          setReportAnalysisSettings((current) => ({
                            ...current,
                            overview: {
                              ...current.overview,
                              acceptanceGuide: event.target.value,
                            },
                          }))
                        }
                        className="mt-2 min-h-24 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900"
                        placeholder="수신자에게 보여줄 안내 문구를 입력해 주세요."
                      />
                    </label>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-semibold text-slate-900">분석 강도 / 워딩</div>
                  <div className="mt-4 space-y-4">
                    <label className="block">
                      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                        분석 강도
                      </span>
                      <select
                        value={reportAnalysisSettings.strength}
                        onChange={(event) =>
                          setReportAnalysisSettings((current) => ({
                            ...current,
                            strength: event.target.value as FeedbackReportAnalysisStrength,
                          }))
                        }
                        className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900"
                      >
                        {(Object.entries(FEEDBACK_ANALYSIS_STRENGTH_LABELS) as Array<
                          [FeedbackReportAnalysisStrength, string]
                        >).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="grid gap-3">
                      {REPORT_ANALYSIS_WORDING_FIELDS.map((field) => (
                        <label key={field.key} className="block rounded-2xl border border-slate-200 bg-white p-4">
                          <span className="text-sm font-semibold text-slate-900">{field.label}</span>
                          <span className="mt-1 block text-sm leading-6 text-slate-500">{field.description}</span>
                          <input
                            value={reportAnalysisSettings.wording[field.key]}
                            onChange={(event) =>
                              setReportAnalysisSettings((current) => ({
                                ...current,
                                wording: {
                                  ...current.wording,
                                  [field.key]: event.target.value,
                                },
                              }))
                            }
                            className="mt-3 min-h-11 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-900"
                            placeholder={`${field.label}을 입력해 주세요.`}
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-900">메뉴 표시 / 이름 설정</div>
                <p className="mt-1 text-sm text-slate-500">
                  개요, 질문별 인사이트, 상대 비교, 자기객관화 등 리포트 메뉴를 숨기거나 메뉴명을 조직 용어에 맞게 바꿀 수 있습니다.
                </p>
                <div className="mt-4 space-y-3">
                  {FEEDBACK_REPORT_ANALYSIS_SECTIONS.map((sectionKey) => {
                    const config = reportAnalysisSettings.menu[sectionKey]
                    return (
                      <div key={sectionKey} className="rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="grid gap-3 lg:grid-cols-[160px_minmax(0,1fr)_120px] lg:items-center">
                          <div className="text-sm font-semibold text-slate-900">{sectionKey}</div>
                          <label className="block">
                            <span className="sr-only">{sectionKey} 메뉴 이름</span>
                            <input
                              value={config.label}
                              onChange={(event) =>
                                setReportAnalysisSettings((current) => ({
                                  ...current,
                                  menu: {
                                    ...current.menu,
                                    [sectionKey]: {
                                      ...current.menu[sectionKey],
                                      label: event.target.value,
                                    },
                                  },
                                }))
                              }
                              className="min-h-11 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-900"
                              placeholder="메뉴 이름"
                            />
                          </label>
                          <label className="inline-flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                            <span className="text-sm font-semibold text-slate-700">표시</span>
                            <input
                              type="checkbox"
                              checked={config.visible}
                              onChange={(event) =>
                                setReportAnalysisSettings((current) => ({
                                  ...current,
                                  menu: {
                                    ...current.menu,
                                    [sectionKey]: {
                                      ...current.menu[sectionKey],
                                      visible: event.target.checked,
                                    },
                                  },
                                }))
                              }
                              className="h-4 w-4 rounded border-slate-300"
                            />
                          </label>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-900">리뷰 문항 수정</div>
              <p className="mt-1 text-sm text-slate-500">
                업적 평가 템플릿을 포함한 현재 라운드 문항을 운영자가 바로 보정할 수 있습니다. 저장 시 기존 질문 텍스트와 변경 내용이 함께 기록됩니다.
              </p>
              <div className="mt-4 space-y-3">
                {questionDrafts.length ? (
                  questionDrafts.map((question, index) => (
                    <label key={question.id} className="block rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                          {index + 1}번 문항
                        </span>
                        <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                          {question.category}
                        </span>
                      </div>
                      <textarea
                        value={question.questionText}
                        onChange={(event) =>
                          setQuestionDrafts((current) =>
                            current.map((item) =>
                              item.id === question.id ? { ...item, questionText: event.target.value } : item
                            )
                          )
                        }
                        className="mt-3 min-h-24 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900"
                        placeholder="문항을 입력해 주세요."
                      />
                    </label>
                  ))
                ) : (
                  <EmptyBlock message="현재 라운드에 수정 가능한 문항이 없습니다." />
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setSettingsDialogOpen(false)}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                닫기
              </button>
              <button
                type="button"
                onClick={() => void handleSaveSettings()}
                disabled={busy}
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                설정 저장
              </button>
            </div>
          </div>
        </ModalFrame>
      ) : null}

      {reminderDialogOpen && selectedRound ? (
        <ModalFrame title={`${selectedRound.roundName} 리마인드 발송`} onClose={() => setReminderDialogOpen(false)}>
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              {([
                ['send-review-reminder', '미제출자 리마인드'],
                ['send-peer-selection-reminder', '동료 선택 / 승인 리마인드'],
                ['send-result-share', '결과 공유'],
              ] as Array<[ReminderAction, string]>).map(([action, label]) => (
                <button
                  key={action}
                  type="button"
                  onClick={() => setReminderAction(action)}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                    reminderAction === action
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {reminderAction === 'send-result-share' ? (
              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                <div className="text-sm font-semibold text-blue-900">공유 대상</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {([
                    ['REVIEWEE', '대상자만'],
                    ['LEADER', '리더만'],
                    ['LEADER_AND_REVIEWEE', '리더 + 대상자'],
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setShareAudience(value)}
                      className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                        shareAudience === value
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : 'border-blue-200 bg-white text-blue-800 hover:bg-blue-100'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-sm leading-6 text-blue-800">
                  선택한 결과 대상자 기준으로 공유 대상을 확장합니다. 열람 확인은 리더와 대상자를 구분해서 집계됩니다.
                </p>
              </div>
            ) : null}

            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">제목</span>
                <input
                  value={reminderSubject}
                  onChange={(event) => setReminderSubject(event.target.value)}
                  className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-900"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">테스트 발송</span>
                <input
                  value={testEmail}
                  onChange={(event) => setTestEmail(event.target.value)}
                  className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-900"
                  placeholder="example@company.com"
                />
              </label>
            </div>

            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">본문</span>
              <textarea
                value={reminderBody}
                onChange={(event) => setReminderBody(event.target.value)}
                className="hidden"
              />
              <div className="mt-2">
                <RichTextEmailEditor
                  value={reminderBody}
                  onChange={setReminderBody}
                  disabled={busy}
                  placeholder="수신자에게 전달할 안내 메시지를 작성해 주세요."
                />
              </div>
            </label>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-sm font-semibold text-slate-900">상태 분포</div>
                <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-slate-100">
                  {Object.entries(reminderStatusSummary).length ? (
                    Object.entries(reminderStatusSummary).map(([key, item]) => (
                      <div
                        key={key}
                        className={getStatusBarClass(item.tone)}
                        style={{ width: `${(item.count / Math.max(reminderTargetsForScope.length, 1)) * 100}%` }}
                      />
                    ))
                  ) : (
                    <div className="h-full w-full bg-slate-200" />
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-600">
                  {Object.entries(reminderStatusSummary).length ? (
                    Object.entries(reminderStatusSummary).map(([key, item]) => (
                      <span key={key} className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1">
                        <span className={`h-2.5 w-2.5 rounded-full ${getStatusDotClass(item.tone)}`} />
                        {item.label} {item.count}명
                      </span>
                    ))
                  ) : (
                    <span>현재 집계할 상태가 없습니다.</span>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="text-sm text-slate-700">
                  현재 선택 <span className="font-semibold text-slate-900">{selectedTargetIds.length}</span>명 · 표시{' '}
                  <span className="font-semibold text-slate-900">{visibleReminderRecipientIds.length}</span>명 · 전체{' '}
                  <span className="font-semibold text-slate-900">{Array.from(new Set(reminderTargetsForScope.map((item) => item.recipientId))).length}</span>명
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={selectAllMatchingTargets}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-white"
                  >
                    전체 {visibleReminderRecipientIds.length}명 모두 선택
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedTargetIds([])}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-white"
                  >
                    선택 해제
                  </button>
                </div>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
                <input
                  value={reminderSearch}
                  onChange={(event) => setReminderSearch(event.target.value)}
                  className="min-h-11 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-900"
                  placeholder="대상자, 라운드, 부서로 검색"
                />
                <select
                  value={reminderStatusFilter}
                  onChange={(event) => setReminderStatusFilter(event.target.value)}
                  className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm text-slate-900"
                >
                  <option value="ALL">상태 전체</option>
                  {reminderStatusOptions.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-4 rounded-2xl border border-slate-200 bg-white">
                {filteredReminderTargets.length ? (
                  <>
                    <div className="grid grid-cols-[52px_minmax(0,1.2fr)_minmax(0,1fr)_140px_minmax(0,1.3fr)] items-center gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      <label className="inline-flex items-center justify-center">
                        <input
                          type="checkbox"
                          checked={allMatchingSelected}
                          onChange={toggleAllMatchingTargets}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                      </label>
                      <span>대상자</span>
                      <span>조직</span>
                      <span>상태</span>
                      <span>세부 정보</span>
                    </div>
                    <div className="max-h-72 overflow-y-auto">
                      {filteredReminderTargets.map((target, index) => {
                        const checked = selectedTargetIds.includes(target.recipientId)
                        return (
                          <label
                            key={`${target.roundId}:${target.recipientId}:${index}`}
                            className="grid cursor-pointer grid-cols-[52px_minmax(0,1.2fr)_minmax(0,1fr)_140px_minmax(0,1.3fr)] items-start gap-3 border-b border-slate-100 px-4 py-3 text-sm text-slate-700 last:border-b-0"
                          >
                            <span className="inline-flex items-center justify-center pt-1">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleTarget(target.recipientId)}
                                className="h-4 w-4 rounded border-slate-300"
                              />
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate font-semibold text-slate-900">{target.recipientName}</span>
                              <span className="mt-1 block text-xs text-slate-500">{target.roundName}</span>
                            </span>
                            <span className="min-w-0 text-xs text-slate-500">
                              {target.departmentName || '-'}
                            </span>
                            <span>
                              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusChipClass(target.statusTone)}`}>
                                {target.statusLabel}
                              </span>
                            </span>
                            <span className="min-w-0 text-xs leading-5 text-slate-500">{target.detail}</span>
                          </label>
                        )
                      })}
                    </div>
                  </>
                ) : (
                  <div className="p-4">
                    <EmptyBlock message="현재 조건에 맞는 발송 대상자가 없습니다. 라운드, 상태 또는 발송 종류를 바꿔 보세요." />
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => void handleReminder('test')}
                disabled={busy || !testEmail.trim() || !reminderSubject.trim() || !hasReminderBodyContent}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
              >
                테스트 발송
              </button>
              <button
                type="button"
                onClick={() => void handleReminder('send')}
                disabled={
                  busy ||
                  (!selectedTargetIds.length && !visibleReminderRecipientIds.length) ||
                  !reminderSubject.trim() ||
                  !hasReminderBodyContent
                }
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                리마인드 발송
              </button>
            </div>
          </div>
        </ModalFrame>
      ) : null}
      {riskDialog}
    </div>
  )
}

function Panel(props: {
  title: string
  description: string
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">{props.title}</h2>
          <p className="mt-1 text-sm text-slate-500">{props.description}</p>
        </div>
        {props.action}
      </div>
      {props.children}
    </section>
  )
}

function ActionLink(props: { href: string; label: string }) {
  return (
    <Link
      href={props.href}
      className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
    >
      {props.label}
    </Link>
  )
}

function getStatusBarClass(tone: ReminderTarget['statusTone']) {
  if (tone === 'emerald') return 'bg-emerald-500'
  if (tone === 'amber') return 'bg-amber-400'
  if (tone === 'rose') return 'bg-rose-400'
  if (tone === 'blue') return 'bg-blue-500'
  return 'bg-slate-400'
}

function getStatusDotClass(tone: ReminderTarget['statusTone']) {
  return getStatusBarClass(tone)
}

function getStatusChipClass(tone: ReminderTarget['statusTone']) {
  if (tone === 'emerald') return 'bg-emerald-100 text-emerald-700'
  if (tone === 'amber') return 'bg-amber-100 text-amber-800'
  if (tone === 'rose') return 'bg-rose-100 text-rose-700'
  if (tone === 'blue') return 'bg-blue-100 text-blue-700'
  return 'bg-slate-100 text-slate-700'
}

function formatDateTimeLabel(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

function getReceiptStatusLabel(status: ResultShareSummary['rows'][number]['leaderStatus']) {
  if (status === 'VIEWED') return '열람 완료'
  if (status === 'SHARED') return '공유 완료'
  if (status === 'NO_LEADER') return '리더 없음'
  return '공유 전'
}

function getReceiptStatusChipClass(status: ResultShareSummary['rows'][number]['leaderStatus']) {
  if (status === 'VIEWED') return 'bg-emerald-100 text-emerald-700'
  if (status === 'SHARED') return 'bg-blue-100 text-blue-700'
  if (status === 'NO_LEADER') return 'bg-slate-100 text-slate-600'
  return 'bg-amber-100 text-amber-800'
}

function ShareProgressCard(props: {
  label: string
  sharedCount: number
  viewedCount: number
  totalCount: number
}) {
  const totalCount = Math.max(props.totalCount, 1)
  const sharedWidth = (props.sharedCount / totalCount) * 100
  const viewedWidth = (props.viewedCount / totalCount) * 100

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-slate-900">{props.label}</div>
        <div className="text-xs text-slate-500">
          공유 {props.sharedCount} / 열람 {props.viewedCount} / 전체 {props.totalCount}
        </div>
      </div>
      <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full bg-blue-300" style={{ width: `${sharedWidth}%` }} />
        <div className="-mt-3 h-full bg-emerald-500" style={{ width: `${viewedWidth}%` }} />
      </div>
    </div>
  )
}

function EmptyBlock(props: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
      {props.message}
    </div>
  )
}

function MetricCard(props: {
  label: string
  value: string
  tone: 'slate' | 'amber' | 'rose' | 'blue' | 'emerald'
}) {
  const toneClass =
    props.tone === 'amber'
      ? 'border-amber-200 bg-amber-50 text-amber-900'
      : props.tone === 'rose'
        ? 'border-rose-200 bg-rose-50 text-rose-900'
        : props.tone === 'blue'
          ? 'border-blue-200 bg-blue-50 text-blue-900'
          : props.tone === 'emerald'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
        : 'border-slate-200 bg-white text-slate-900'

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${toneClass}`}>
      <div className="text-xs font-semibold uppercase tracking-[0.16em] opacity-70">{props.label}</div>
      <div className="mt-3 text-2xl font-semibold">{props.value}</div>
    </div>
  )
}

function MiniStat(props: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{props.label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-900">{props.value}</div>
    </div>
  )
}

function Badge(props: { children: ReactNode; tone?: 'slate' | 'blue' | 'emerald' | 'amber' | 'rose' }) {
  const toneClass =
    props.tone === 'blue'
      ? 'bg-blue-100 text-blue-700'
      : props.tone === 'emerald'
        ? 'bg-emerald-100 text-emerald-700'
        : props.tone === 'amber'
          ? 'bg-amber-100 text-amber-700'
          : props.tone === 'rose'
            ? 'bg-rose-100 text-rose-700'
        : 'bg-slate-100 text-slate-700'

  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${toneClass}`}>{props.children}</span>
}

function ManagerEffectivenessDashboard(props: {
  managerEffectivenessAdmin?: ManagerEffectivenessAdminState
}) {
  const { managerEffectivenessAdmin } = props

  if (!managerEffectivenessAdmin?.enabled) {
    return null
  }

  const riskTone = (riskLevel: ManagerEffectivenessAdminState['leaders'][number]['riskLevel']) => {
    if (riskLevel === 'HIGH') return 'rose'
    if (riskLevel === 'MEDIUM') return 'amber'
    return 'emerald'
  }

  return (
    <Panel
      title={`Manager Effectiveness / ${'\uB9AC\uB354 \uCF54\uCE6D'}`}
      description={
        '\uB9AC\uB354\uBCC4 \uAC15\uC810, \uBCF4\uC644 \uD3EC\uC778\uD2B8, \uC870\uC9C1\uBCC4 \uB9AC\uC2A4\uD06C\uB97C \uBB36\uC5B4 \uBCF4\uACE0 \uCF54\uCE6D\uACFC 1:1 \uD6C4\uC18D \uC870\uCE58\uB97C \uBC14\uB85C \uC5F0\uACB0\uD569\uB2C8\uB2E4.'
      }
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label={'\uB9AC\uB354 \uC218'}
          value={`${managerEffectivenessAdmin.summary.leaderCount}\uBA85`}
          tone="slate"
        />
        <MetricCard
          label={'\uD3C9\uADE0 \uC810\uC218'}
          value={
            managerEffectivenessAdmin.summary.averageScore != null
              ? managerEffectivenessAdmin.summary.averageScore.toFixed(1)
              : '-'
          }
          tone="blue"
        />
        <MetricCard
          label={'\uACE0\uC704\uD5D8 \uB9AC\uB354'}
          value={`${managerEffectivenessAdmin.summary.highRiskCount}\uBA85`}
          tone="rose"
        />
        <MetricCard
          label={'\uCF54\uCE6D \uD329 \uC900\uBE44'}
          value={`${managerEffectivenessAdmin.summary.coachingReadyCount}\uBA85`}
          tone="emerald"
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {managerEffectivenessAdmin.reviewerSummary.map((item) => (
          <Badge key={item} tone="blue">
            {item}
          </Badge>
        ))}
        {managerEffectivenessAdmin.competencyLabels.map((item) => (
          <Badge key={item} tone="slate">
            {item}
          </Badge>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-sm font-semibold text-slate-900">
            {'\uC870\uC9C1\uBCC4 \uB9AC\uB354 heatmap'}
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="px-3 py-2 font-medium">{'\uC870\uC9C1'}</th>
                  <th className="px-3 py-2 font-medium">{'\uB9AC\uB354 \uC218'}</th>
                  <th className="px-3 py-2 font-medium">{'\uD3C9\uADE0 \uC810\uC218'}</th>
                  <th className="px-3 py-2 font-medium">{'\uACE0\uC704\uD5D8'}</th>
                </tr>
              </thead>
              <tbody>
                {managerEffectivenessAdmin.heatmap.length ? (
                  managerEffectivenessAdmin.heatmap.map((row) => (
                    <tr key={row.departmentName} className="border-t border-slate-200 text-slate-700">
                      <td className="px-3 py-3 font-medium text-slate-900">{row.departmentName}</td>
                      <td className="px-3 py-3">{`${row.leaderCount}\uBA85`}</td>
                      <td className="px-3 py-3">{row.averageScore != null ? row.averageScore.toFixed(1) : '-'}</td>
                      <td className="px-3 py-3">{`${row.highRiskCount}\uBA85`}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-slate-500">
                      {'\uC544\uC9C1 \uC9D1\uACC4\uD560 \uB9AC\uB354 \uACB0\uACFC\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-sm font-semibold text-slate-900">
            {'\uC8FC\uC694 \uAC1C\uC120 \uD14C\uB9C8'}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {managerEffectivenessAdmin.topImprovementThemes.length ? (
              managerEffectivenessAdmin.topImprovementThemes.map((item) => (
                <Badge key={item.label} tone="amber">
                  {item.label} {`\u00B7 ${item.count}`}
                </Badge>
              ))
            ) : (
              <span className="text-sm text-slate-500">
                {'\uC544\uC9C1 \uC9D1\uACC4\uB41C \uAC1C\uC120 \uD14C\uB9C8\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.'}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        {managerEffectivenessAdmin.leaders.length ? (
          managerEffectivenessAdmin.leaders.map((leader) => (
            <div key={leader.employeeId} className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-base font-semibold text-slate-900">{leader.name}</div>
                  <div className="mt-1 text-sm text-slate-500">
                    {leader.departmentName} {'\u00B7'} {leader.position}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge tone={riskTone(leader.riskLevel)}>
                    {'\uC704\uD5D8\uB3C4'} {leader.riskLevel}
                  </Badge>
                  <Badge tone="blue">
                    {'\uC810\uC218'} {leader.overallScore != null ? leader.overallScore.toFixed(1) : '-'}
                  </Badge>
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                    {'\uAC15\uC810'}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {leader.strengths.length ? (
                      leader.strengths.map((item) => (
                        <Badge key={item} tone="emerald">
                          {item}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-slate-500">
                        {'\uAC15\uC810 \uD0DC\uADF8\uAC00 \uC544\uC9C1 \uC5C6\uC2B5\uB2C8\uB2E4.'}
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                    {'\uBCF4\uC644 \uD3EC\uC778\uD2B8'}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {leader.improvements.length ? (
                      leader.improvements.map((item) => (
                        <Badge key={item} tone="amber">
                          {item}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-slate-500">
                        {'\uBCF4\uC644 \uD3EC\uC778\uD2B8\uAC00 \uC544\uC9C1 \uC5C6\uC2B5\uB2C8\uB2E4.'}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-semibold text-slate-900">
                    {'\uCF54\uCE6D \uD3EC\uC778\uD2B8'}
                  </div>
                  <ul className="mt-3 space-y-2 text-sm text-slate-600">
                    {leader.coachingPack.coachingPoints.map((item) => (
                      <li key={item}>{`\u2022 ${item}`}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-semibold text-slate-900">
                    {'\uB2E4\uC74C 1:1 \uC9C8\uBB38'}
                  </div>
                  <ul className="mt-3 space-y-2 text-sm text-slate-600">
                    {leader.coachingPack.nextOneOnOneQuestions.map((item) => (
                      <li key={item}>{`\u2022 ${item}`}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-900">
                  {'\uC131\uC7A5 \uC561\uC158'}
                </div>
                <ul className="mt-3 space-y-2 text-sm text-slate-600">
                  {leader.coachingPack.growthActions.map((item) => (
                    <li key={item}>{`\u2022 ${item}`}</li>
                  ))}
                </ul>
                <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                  {leader.coachingPack.hrMemo}
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                <Link
                  href={leader.resultHref}
                  className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  {'\uACB0\uACFC \uBCF4\uAE30'}
                </Link>
              </div>
            </div>
          ))
        ) : (
          <div className="xl:col-span-2">
            <EmptyBlock message={'\uB9AC\uB354 \uD6A8\uACFC\uC131 \uACB0\uACFC\uAC00 \uC544\uC9C1 \uC9D1\uACC4\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.'} />
          </div>
        )}
      </div>
    </Panel>
  )
}

function ToggleLine(props: {
  label: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <input
        type="checkbox"
        checked={props.checked}
        onChange={(event) => props.onChange(event.target.checked)}
        className="mt-1 h-4 w-4 rounded border-slate-300"
      />
      <div>
        <div className="text-sm font-semibold text-slate-900">{props.label}</div>
        <div className="mt-1 text-sm leading-6 text-slate-500">{props.description}</div>
      </div>
    </label>
  )
}

function BannerBox(props: { banner: Banner; onClose: () => void }) {
  const toneClass =
    props.banner.tone === 'error'
      ? 'border-rose-200 bg-rose-50 text-rose-800'
      : props.banner.tone === 'success'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
        : 'border-blue-200 bg-blue-50 text-blue-800'

  return (
    <div className={`flex items-start justify-between gap-3 rounded-2xl border px-4 py-3 text-sm ${toneClass}`}>
      <div>{props.banner.message}</div>
      <button type="button" onClick={props.onClose} className="shrink-0">
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

function ModalFrame(props: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 py-8">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-slate-900">{props.title}</h3>
          <button
            type="button"
            onClick={props.onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {props.children}
      </div>
    </div>
  )
}
