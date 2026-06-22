'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  CircleDotDashed,
  ClipboardCheck,
  Clock3,
  Hash,
  Info,
  Layers3,
  MessageSquareText,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Users,
} from 'lucide-react'
import type { Feedback360PageData } from '@/server/feedback-360'
import { useImpersonationRiskAction } from '@/components/security/useImpersonationRiskAction'
import { FEEDBACK_RESULT_PROFILE_LABELS } from '@/lib/feedback-result-presentation'
import { MultiRaterCycleHeader } from './MultiRaterCycleHeader'
import { ReviewerNominationPanel } from './ReviewerNominationPanel'
import { FeedbackThemesSection } from './FeedbackThemesSection'
import { DevelopmentPlanPreview } from './DevelopmentPlanPreview'
import { GrowthCopilotPanel } from './GrowthCopilotPanel'
import { Feedback360AdminPanel } from './Feedback360AdminPanel'
import { FeedbackReferencePanel } from './FeedbackReferencePanel'
import { FeedbackReportAnalysisView } from './FeedbackReportAnalysisView'
import { FeedbackRespondReferencePanel } from './FeedbackRespondReferencePanel'
import {
  FEEDBACK_360_OVERALL_COMMENT_MAX_LENGTH,
  FEEDBACK_360_RESPONSE_TAG_CATEGORIES,
  FEEDBACK_360_TAG_SUMMARY_HEADING,
  buildFeedback360OverallCommentForSubmit,
  getFeedback360ResponseTagPoolStats,
  getSelectedFeedback360ResponseTagLabels,
  isFeedback360ResponseTagSelected,
  parseFeedback360TagSummaryFromComment,
  type Feedback360ResponseTag,
  type Feedback360ResponseTagCategory,
  type Feedback360ResponseTagTone,
  type SelectedFeedback360ResponseTags,
} from './feedback360-response-tag-pool'
import {
  dedupeFeedback360ResponseTargets,
  type Feedback360MergedResponseTarget,
} from './feedback360-response-targets'
import { Feedback360PptShellTabs } from './ppt/Feedback360PptShell'
import {
  Feedback360PptResultReport,
  buildFeedback360ResultVisualModel,
} from './ppt/Feedback360ResultsPpt'
import { Feedback360HubResultsPpt } from './ppt/Feedback360HubResultsPpt'
import { Feedback360Avatar } from './ppt/Feedback360Avatar'
import { Feedback360MailReadinessPanel } from './ppt/Feedback360MailReadinessPanel'
import { buildFeedback360MailReadiness } from './ppt/feedback360MailReadiness'
import {
  Feedback360PptAppShell,
  type Feedback360PptControl,
  type Feedback360PptShellSection,
} from './ppt/Feedback360PptAppShell'
import { Feedback360PptSummaryCards } from './ppt/Feedback360PptPrimitives'

type RespondData = NonNullable<Feedback360PageData['respond']>
type RespondRatingGuide = NonNullable<RespondData['ratingGuide']>
type RespondPriorScoreSummary = NonNullable<RespondData['priorScoreSummary']>
type RespondRoleGuide = NonNullable<RespondData['roleGuide']>
type SelectedResponseTags = SelectedFeedback360ResponseTags
type Feedback360HubTab = 'overview' | 'respond' | 'operations' | 'mapping' | 'results'
type Feedback360Quarter = 'Q1' | 'Q2' | 'Q3' | 'Q4'

const DISTRIBUTION_LIMIT_EXCEEDED_MESSAGE =
  '등급 배분 가이드의 제한 인원을 초과했습니다. 가이드를 확인해 주세요.'

const FEEDBACK_360_RESPONSE_TAG_POOL_STATS = getFeedback360ResponseTagPoolStats()
const FEEDBACK_360_QUARTER_OPTIONS = [
  { value: 'Q1', label: '1분기', months: [1, 2, 3] },
  { value: 'Q2', label: '2분기', months: [4, 5, 6] },
  { value: 'Q3', label: '3분기', months: [7, 8, 9] },
  { value: 'Q4', label: '4분기', months: [10, 11, 12] },
] as const satisfies Array<{ value: Feedback360Quarter; label: string; months: readonly number[] }>
const FEEDBACK_360_QUARTER_VALUES = new Set<Feedback360Quarter>(
  FEEDBACK_360_QUARTER_OPTIONS.map((option) => option.value)
)

function isFeedback360Quarter(value: string | null): value is Feedback360Quarter {
  return value != null && FEEDBACK_360_QUARTER_VALUES.has(value as Feedback360Quarter)
}

function getFeedback360QuarterLabel(quarter: Feedback360Quarter) {
  return FEEDBACK_360_QUARTER_OPTIONS.find((option) => option.value === quarter)?.label ?? quarter
}

function getFeedback360RelationshipLabel(relationship?: string | null) {
  switch (relationship) {
    case 'SELF':
      return '본인'
    case 'SUPERVISOR':
      return '상사'
    case 'PEER':
      return '동료'
    case 'SUBORDINATE':
      return '팀원'
    case 'CROSS_TEAM_PEER':
      return '타팀 동료'
    case 'CROSS_DEPT':
      return '타부서'
    default:
      return '관계 확인 필요'
  }
}

function formatFeedback360RelationshipLabels(relationships: string[]) {
  const labels = relationships.length
    ? relationships.map(getFeedback360RelationshipLabel)
    : ['관계 확인 필요']

  return Array.from(new Set(labels)).join(', ')
}

function getFeedback360ResponseStatusLabel(status?: string | null) {
  switch (status) {
    case 'SUBMITTED':
      return '제출 완료'
    case 'IN_PROGRESS':
      return '작성 중'
    case 'PENDING':
      return '미응답'
    default:
      return '상태 확인 필요'
  }
}

function getFeedback360ResponseActionLabel(status?: string | null) {
  switch (status) {
    case 'SUBMITTED':
      return '결과 보기'
    case 'IN_PROGRESS':
      return '평가 계속하기'
    default:
      return '평가하기'
  }
}

function getWorkflowStatusLabel(status?: string | null) {
  switch (status) {
    case 'APPROVED':
      return '승인 완료'
    case 'SUBMITTED':
      return '승인 요청'
    case 'REJECTED':
      return '반려'
    case 'PUBLISHED':
      return '응답 시작'
    default:
      return '초안'
  }
}

function getFeedback360RoundStatusLabel(status?: string | null) {
  switch (status) {
    case 'DRAFT':
      return '초안'
    case 'RATER_SELECTION':
      return '평가자 매핑'
    case 'IN_PROGRESS':
      return '응답 진행'
    case 'CLOSED':
      return '종료'
    case 'ARCHIVED':
      return '보관'
    default:
      return '상태 확인 필요'
  }
}

function getFeedback360ResultShareStatusLabel(round?: Feedback360PageData['availableRounds'][number]) {
  if (!round) return '결과 공유 대기'
  return round.submittedCount >= round.minRaters ? '결과 공유 준비' : '익명 기준 확인 중'
}

function getFeedback360ResponseProgress(status?: string | null) {
  switch (status) {
    case 'SUBMITTED':
      return 100
    case 'IN_PROGRESS':
      return 55
    default:
      return 0
  }
}

function getFeedback360StatusClassName(status?: string | null) {
  switch (status) {
    case 'SUBMITTED':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700'
    case 'IN_PROGRESS':
      return 'border-blue-200 bg-blue-50 text-blue-700'
    default:
      return 'border-amber-200 bg-amber-50 text-amber-700'
  }
}

function getRoleLabel(role?: string | null) {
  switch (role) {
    case 'ROLE_ADMIN':
      return 'HR 관리자'
    case 'ROLE_CEO':
      return '대표'
    case 'ROLE_MANAGER':
      return '관리자'
    case 'ROLE_MEMBER':
      return '구성원'
    default:
      return '구성원'
  }
}

function normalizeFeedback360SearchText(value?: string | null) {
  return String(value ?? '').trim().toLowerCase()
}

function getFeedback360OrgLabel(target: {
  receiverDepartmentName?: string | null
  receiverTeamName?: string | null
}) {
  return [target.receiverDepartmentName, target.receiverTeamName].filter(Boolean).join(' / ') || '소속 확인 필요'
}

function getFeedback360RemainingDaysLabel(dueDate?: string | null) {
  const normalized = String(dueDate ?? '').trim()
  if (!normalized) return '마감일 확인 필요'

  const parsed = Date.parse(normalized.replace(/\.\s*/g, '-').replace(/-\s*$/, ''))
  if (Number.isNaN(parsed)) return normalized

  const today = new Date()
  const due = new Date(parsed)
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  const dueStart = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime()
  const diffDays = Math.ceil((dueStart - todayStart) / (1000 * 60 * 60 * 24))

  if (diffDays > 0) return `D-${diffDays}`
  if (diffDays === 0) return '오늘 마감'
  return `마감 ${Math.abs(diffDays)}일 지남`
}

function buildFeedback360ResponseRow(
  target: Feedback360MergedResponseTarget,
  rounds: Feedback360PageData['availableRounds']
) {
  const status = target.mergedStatus ?? target.status ?? 'PENDING'
  const progress = getFeedback360ResponseProgress(status)
  const organizationLabel = getFeedback360OrgLabel(target)
  const round = rounds.find((item) => item.id === target.roundId)

  return {
    ...target,
    status,
    statusLabel: getFeedback360ResponseStatusLabel(status),
    actionLabel: getFeedback360ResponseActionLabel(status),
    progress,
    organizationLabel,
    periodLabel: round ? `${round.startDate} ~ ${round.endDate}` : `${target.roundName} 기준`,
    remainingDaysLabel: getFeedback360RemainingDaysLabel(target.dueDate),
    searchText: normalizeFeedback360SearchText(
      [
        target.receiverName,
        target.receiverDepartmentName,
        target.receiverTeamName,
        formatFeedback360RelationshipLabels(target.relationships),
        target.roundName,
      ].join(' ')
    ),
  }
}

function getCurrentFeedback360Quarter(): Feedback360Quarter {
  const month = new Date().getMonth() + 1
  return getFeedback360QuarterFromMonth(month) ?? 'Q1'
}

function getFeedback360QuarterFromMonth(month: number): Feedback360Quarter | null {
  const matched = FEEDBACK_360_QUARTER_OPTIONS.find((option) =>
    (option.months as readonly number[]).includes(month)
  )
  return matched?.value ?? null
}

function getMonthFromFeedback360DateText(value?: string | null) {
  if (!value) return null

  const normalized = value.trim()
  const explicitMatch = normalized.match(/(?:\d{4})[.\-/년\s]+(\d{1,2})(?:[.\-/월\s]|$)/)
  if (explicitMatch) {
    const month = Number(explicitMatch[1])
    return month >= 1 && month <= 12 ? month : null
  }

  const parsed = Date.parse(normalized)
  if (Number.isNaN(parsed)) return null
  return new Date(parsed).getMonth() + 1
}

function getFeedback360RoundQuarter(round: Feedback360PageData['availableRounds'][number]) {
  const roundText = `${round.roundName} ${round.startDate} ${round.endDate}`.toUpperCase()
  const quarterMatch = roundText.match(/\bQ([1-4])\b|([1-4])\s*분기|([1-4])\s*Q/)
  const matchedQuarterNumber = quarterMatch?.[1] ?? quarterMatch?.[2] ?? quarterMatch?.[3]
  if (matchedQuarterNumber) return `Q${matchedQuarterNumber}` as Feedback360Quarter

  const startMonth = getMonthFromFeedback360DateText(round.startDate)
  if (startMonth) return getFeedback360QuarterFromMonth(startMonth)

  const endMonth = getMonthFromFeedback360DateText(round.endDate)
  if (endMonth) return getFeedback360QuarterFromMonth(endMonth)

  return null
}

function buildRespondQuestionState(
  questions: RespondData['questions'] | undefined
) {
  return Object.fromEntries(
    (questions ?? []).map((question) => [
      question.id,
      {
        ratingValue: question.ratingValue ?? null,
        textValue: question.textValue ?? null,
      },
    ])
  )
}

function isLeaderLikeTarget(targetProfile?: RespondData['targetProfile']) {
  const text = [
    targetProfile?.role,
    targetProfile?.position,
    targetProfile?.jobTitle,
    targetProfile?.teamName,
  ]
    .filter(Boolean)
    .join(' ')

  return /LEADER|MANAGER|HEAD|CHIEF|PM|팀장|실장|본부|리더|매니저|대표/.test(text)
}

function getVisibleFeedback360ResponseTagCategories(targetProfile?: RespondData['targetProfile']) {
  const showLeaderTags = isLeaderLikeTarget(targetProfile)

  return FEEDBACK_360_RESPONSE_TAG_CATEGORIES.filter(
    (category) => category.audience !== 'leader' || showLeaderTags
  )
}

function countAnsweredRespondQuestions(questionState: Record<string, { ratingValue?: number | null; textValue?: string | null }>) {
  return Object.values(questionState).filter((answer) => {
    if (typeof answer.ratingValue === 'number') return true
    return typeof answer.textValue === 'string' && answer.textValue.trim().length > 0
  }).length
}

export function Feedback360WorkspaceClient(props: { data: Feedback360PageData }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()
  const { requestRiskConfirmation, riskDialog } = useImpersonationRiskAction()
  const [submitBusy, setSubmitBusy] = useState(false)
  const [reportBusy, setReportBusy] = useState(false)
  const [roundCreateBusy, setRoundCreateBusy] = useState(false)
  const [respondNotice, setRespondNotice] = useState('')
  const [respondError, setRespondError] = useState('')
  const [resultsNotice, setResultsNotice] = useState('')
  const [resultsError, setResultsError] = useState('')
  const [operationsNotice, setOperationsNotice] = useState('')
  const [operationsError, setOperationsError] = useState('')
  const [selectedTagSummaryExpanded, setSelectedTagSummaryExpanded] = useState(false)
  const [questionErrorMessages, setQuestionErrorMessages] = useState<Record<string, string>>({})
  const [recordedResultViewKey, setRecordedResultViewKey] = useState('')
  const [responseSearchQuery, setResponseSearchQuery] = useState('')
  const [responseStatusFilter, setResponseStatusFilter] = useState('ALL')
  const [responseOrgFilter, setResponseOrgFilter] = useState('ALL')
  const [responseSortMode, setResponseSortMode] = useState('DUE_ASC')
  const [operationsMailPreviewOpen, setOperationsMailPreviewOpen] = useState(false)
  const [operationsMailResultOpen, setOperationsMailResultOpen] = useState(false)
  const [mappingMailPreviewOpen, setMappingMailPreviewOpen] = useState(false)
  const [mappingMailResultOpen, setMappingMailResultOpen] = useState(false)
  const [resultsMailPreviewOpen, setResultsMailPreviewOpen] = useState(false)
  const [resultsMailResultOpen, setResultsMailResultOpen] = useState(false)
  const respondData = props.data.mode === 'respond' ? props.data.respond : undefined
  const respondFeedbackId = respondData?.feedbackId ?? ''
  const respondOverallComment = respondData?.overallComment ?? ''
  const respondQuestions = respondData?.questions
  const parsedRespondOverallComment = parseFeedback360TagSummaryFromComment(respondOverallComment)
  const [overallComment, setOverallComment] = useState(parsedRespondOverallComment.comment)
  const [questionState, setQuestionState] = useState<Record<string, { ratingValue?: number | null; textValue?: string | null }>>(
    buildRespondQuestionState(respondQuestions)
  )
  const [selectedResponseTags, setSelectedResponseTags] = useState<SelectedResponseTags>(
    parsedRespondOverallComment.selectedTags
  )
  const [activeResponseTagCategoryId, setActiveResponseTagCategoryId] = useState('')

  useEffect(() => {
    setResultsNotice('')
    setResultsError('')
    setRespondNotice('')
    setRespondError('')
    setOperationsNotice('')
    setOperationsError('')
  }, [props.data.mode, props.data.selectedCycleId, props.data.selectedRoundId])

  useEffect(() => {
    const parsedComment = parseFeedback360TagSummaryFromComment(respondOverallComment)
    setOverallComment(parsedComment.comment)
    setQuestionState(buildRespondQuestionState(respondQuestions))
    setSelectedResponseTags(parsedComment.selectedTags)
    setSelectedTagSummaryExpanded(false)
    setQuestionErrorMessages({})
  }, [respondFeedbackId, respondOverallComment, respondQuestions])

  const visibleResponseTagCategories = useMemo(
    () => getVisibleFeedback360ResponseTagCategories(respondData?.targetProfile),
    [respondData?.targetProfile]
  )
  useEffect(() => {
    if (!visibleResponseTagCategories.length) {
      setActiveResponseTagCategoryId('')
      return
    }

    setActiveResponseTagCategoryId((current) => {
      if (visibleResponseTagCategories.some((category) => category.id === current)) {
        return current
      }

      const firstUnselectedCategory =
        visibleResponseTagCategories.find((category) => {
          const selectedCategoryTags = selectedResponseTags[category.id]
          return !selectedCategoryTags?.positive?.length && !selectedCategoryTags?.improvement?.length
        }) ?? visibleResponseTagCategories[0]

      return firstUnselectedCategory.id
    })
  }, [respondFeedbackId, selectedResponseTags, visibleResponseTagCategories])
  const selectedResponseTagLabels = useMemo(
    () => getSelectedFeedback360ResponseTagLabels(selectedResponseTags, visibleResponseTagCategories),
    [selectedResponseTags, visibleResponseTagCategories]
  )
  const overallCommentForSubmit = useMemo(
    () => buildFeedback360OverallCommentForSubmit(overallComment, selectedResponseTagLabels),
    [overallComment, selectedResponseTagLabels]
  )
  const selectedPositiveTagCount = selectedResponseTagLabels.filter((tag) => tag.tone === 'positive').length
  const selectedImprovementTagCount = selectedResponseTagLabels.filter((tag) => tag.tone === 'improvement').length
  const selectedTagPreviewLimit = 10
  const hiddenSelectedTagCount = Math.max(selectedResponseTagLabels.length - selectedTagPreviewLimit, 0)
  const visibleSelectedResponseTagLabels = selectedTagSummaryExpanded
    ? selectedResponseTagLabels
    : selectedResponseTagLabels.slice(0, selectedTagPreviewLimit)
  const selectedTagCategorySummaries = visibleResponseTagCategories
    .map((category) => {
      const selectedCategoryTags = selectedResponseTags[category.id]
      return {
        id: category.id,
        label: category.category,
        positive: selectedCategoryTags?.positive?.length ?? 0,
        improvement: selectedCategoryTags?.improvement?.length ?? 0,
      }
    })
    .filter((category) => category.positive > 0 || category.improvement > 0)
  const completedResponseTagCategoryCount = visibleResponseTagCategories.filter((category) => {
    const selectedCategoryTags = selectedResponseTags[category.id]
    return Boolean(selectedCategoryTags?.positive?.length || selectedCategoryTags?.improvement?.length)
  }).length
  const activeResponseTagCategory =
    visibleResponseTagCategories.find((category) => category.id === activeResponseTagCategoryId) ??
    visibleResponseTagCategories[0]
  const answeredRespondQuestionCount = countAnsweredRespondQuestions(questionState)
  const respondProgressRate = respondData?.questionCount
    ? Math.min(100, Math.round((answeredRespondQuestionCount / respondData.questionCount) * 100))
    : 0

  const respondRatingGuide = respondData?.ratingGuide
  const selectedDistributionValue =
    respondRatingGuide?.questionId != null
      ? (questionState[respondRatingGuide.questionId]?.ratingValue ?? null)
      : null
  const respondRatingGuideEntries = useMemo(() => {
    if (!respondRatingGuide) return []

    return respondRatingGuide.scaleEntries.map((entry) => ({
      ...entry,
      displayCurrentCount: entry.currentCount + (selectedDistributionValue === entry.value ? 1 : 0),
    }))
  }, [respondRatingGuide, selectedDistributionValue])
  const selectedDistributionEntry = useMemo(() => {
    if (selectedDistributionValue == null) return null
    return respondRatingGuideEntries.find((entry) => entry.value === selectedDistributionValue) ?? null
  }, [respondRatingGuideEntries, selectedDistributionValue])
  const distributionLimitExceeded = Boolean(
    respondRatingGuide?.distributionMode === 'HEADCOUNT' &&
      selectedDistributionEntry &&
      !selectedDistributionEntry.isNonEvaluative &&
      selectedDistributionEntry.headcountLimit != null &&
      selectedDistributionEntry.displayCurrentCount > selectedDistributionEntry.headcountLimit
  )
  const canViewFeedback360Operations = props.data.permissions?.canViewAdmin === true
  const selectedHubCycle =
    props.data.availableCycles.find((cycle) => cycle.id === props.data.selectedCycleId) ??
    props.data.availableCycles[0]
  const selectedHubCycleId = props.data.selectedCycleId ?? selectedHubCycle?.id ?? ''
  const requestedHubTab = searchParams.get('tab')
  const normalizedRequestedHubTab = requestedHubTab === 'response' ? 'respond' : requestedHubTab
  const allowedHubTabs: Feedback360HubTab[] = canViewFeedback360Operations
    ? ['overview', 'respond', 'operations', 'mapping', 'results']
    : ['overview', 'respond', 'results']
  const activeHubTab = allowedHubTabs.includes(normalizedRequestedHubTab as Feedback360HubTab)
    ? (normalizedRequestedHubTab as Feedback360HubTab)
    : 'overview'
  const requestedQuarter = searchParams.get('quarter')
  const roundQuarters = props.data.availableRounds
    .map((round) => getFeedback360RoundQuarter(round))
    .filter(Boolean) as Feedback360Quarter[]
  const currentQuarter = getCurrentFeedback360Quarter()
  const defaultQuarter = roundQuarters.includes(currentQuarter)
    ? currentQuarter
    : (roundQuarters[0] ?? currentQuarter)
  const selectedQuarter = isFeedback360Quarter(requestedQuarter) ? requestedQuarter : defaultQuarter
  const selectedQuarterLabel = getFeedback360QuarterLabel(selectedQuarter)
  const quarterRounds = props.data.availableRounds.filter(
    (round) => getFeedback360RoundQuarter(round) === selectedQuarter
  )
  const quarterRoundIds = new Set(quarterRounds.map((round) => round.id))
  const quarterPendingRequests = (props.data.pendingRequests ?? []).filter((request) =>
    quarterRoundIds.has(request.roundId)
  )
  const quarterResponseTargets = dedupeFeedback360ResponseTargets(quarterPendingRequests, {
    groupByRound: false,
    scopeKey: selectedQuarter,
  })
  const allResponseTargets = dedupeFeedback360ResponseTargets(props.data.pendingRequests ?? [], {
    groupByRound: false,
    scopeKey: selectedHubCycleId || 'all',
  })
  const responseRows = quarterResponseTargets.map((target) => buildFeedback360ResponseRow(target, quarterRounds))
  const responseOrgOptions = Array.from(
    new Set(responseRows.map((target) => target.organizationLabel).filter(Boolean))
  )
  const filteredResponseRows = responseRows
    .filter((target) => {
      const matchesSearch =
        !responseSearchQuery.trim() ||
        target.searchText.includes(normalizeFeedback360SearchText(responseSearchQuery))
      const matchesStatus = responseStatusFilter === 'ALL' || target.status === responseStatusFilter
      const matchesOrg = responseOrgFilter === 'ALL' || target.organizationLabel === responseOrgFilter

      return matchesSearch && matchesStatus && matchesOrg
    })
    .sort((left, right) => {
      if (responseSortMode === 'NAME_ASC') {
        return left.receiverName.localeCompare(right.receiverName, 'ko-KR')
      }

      return left.dueDate.localeCompare(right.dueDate, 'ko-KR')
    })
  const finalFilteredResponseRows = dedupeFeedback360ResponseTargets(filteredResponseRows, {
    groupByRound: false,
    scopeKey: selectedQuarter,
  }).map((target) => buildFeedback360ResponseRow(target, quarterRounds))
  const responseCompletedCount = responseRows.filter((target) => target.status === 'SUBMITTED').length
  const responseInProgressCount = responseRows.filter((target) => target.status === 'IN_PROGRESS').length
  const responsePendingCount = responseRows.filter((target) => target.status !== 'SUBMITTED' && target.status !== 'IN_PROGRESS').length
  const nearestResponseDueDate = responseRows
    .map((target) => target.dueDate)
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right, 'ko-KR'))[0]
  const nextResponseTarget = respondData
    ? allResponseTargets.find(
        (target) =>
          target.canonicalFeedbackId !== respondData.feedbackId &&
          !target.sourceFeedbackIds.includes(respondData.feedbackId)
      )
    : undefined
  const selectedHubRound =
    quarterRounds.find((round) => round.id === props.data.selectedRoundId) ??
    quarterRounds[0]
  const buildNominationHref = (roundId: string, empId?: string | null) =>
    `/evaluation/360/nomination?${new URLSearchParams({
      ...(selectedHubCycleId ? { cycleId: selectedHubCycleId } : {}),
      roundId,
      ...(empId ? { empId } : {}),
    }).toString()}`
  const selectedHubNominationHref =
    selectedHubRound
      ? buildNominationHref(selectedHubRound.id)
      : ''
  const nominationQueueByTarget = new Map(
    (props.data.admin?.nominationQueue ?? []).map((item) => [`${item.roundId}:${item.targetId}`, item] as const)
  )
  const responseMappingTargetEntries = quarterResponseTargets.map((target) => {
    const nominationQueueItem = nominationQueueByTarget.get(`${target.roundId}:${target.receiverId}`)
    return {
      key: `${target.roundId}:${target.receiverId}`,
      href: buildNominationHref(target.roundId, target.receiverId),
      targetName: target.receiverName,
      roundName: target.roundName,
      organizationLabel: getFeedback360OrgLabel(target),
      candidateCountLabel: '상세 화면에서 계산',
      mappingCountLabel: nominationQueueItem ? `${nominationQueueItem.totalCount}명` : '0명',
      recommendationLabel: target.receiverId ? '대상자별 확인 가능' : '후보 데이터 확인',
      needsMapping: !nominationQueueItem || nominationQueueItem.totalCount === 0,
    }
  })
  const responseMappingEntryKeys = new Set(responseMappingTargetEntries.map((entry) => entry.key))
  const queueOnlyMappingTargetEntries = (props.data.admin?.nominationQueue ?? [])
    .filter((item) => quarterRoundIds.has(item.roundId) && !responseMappingEntryKeys.has(`${item.roundId}:${item.targetId}`))
    .map((item) => ({
      key: `${item.roundId}:${item.targetId}`,
      href: buildNominationHref(item.roundId, item.targetId),
      targetName: item.targetName,
      roundName: item.roundName,
      organizationLabel: '대상자별 상세 화면',
      candidateCountLabel: '상세 화면에서 계산',
      mappingCountLabel: `${item.totalCount}명`,
      recommendationLabel: item.totalCount ? '기존 매핑 확인 가능' : '후보 데이터 확인',
      needsMapping: item.totalCount === 0,
    }))
  const mappingTargetEntries = [...responseMappingTargetEntries, ...queueOnlyMappingTargetEntries].slice(0, 8)
  const primaryMappingEntry = mappingTargetEntries.find((entry) => !entry.needsMapping) ?? mappingTargetEntries[0]
  const primaryMappingHref = primaryMappingEntry?.href ?? selectedHubNominationHref
  const primaryMappingCtaLabel = primaryMappingEntry
    ? '대상자별 후보 확인'
    : selectedHubRound
      ? '후보 데이터 확인'
      : '매핑 데이터 없음'
  const hubRoundSearchParams = new URLSearchParams()
  if (selectedHubCycleId) {
    hubRoundSearchParams.set('cycleId', selectedHubCycleId)
  }
  hubRoundSearchParams.set('quarter', selectedQuarter)
  if (selectedHubRound) {
    hubRoundSearchParams.set('roundId', selectedHubRound.id)
  }
  const hubRoundSearchSuffix = hubRoundSearchParams.toString()
  const activeQuarterRoundCount = quarterRounds.filter((round) =>
    ['RATER_SELECTION', 'IN_PROGRESS'].includes(round.status)
  ).length
  const quarterAnonymityReadyCount = quarterRounds.filter((round) => round.submittedCount >= round.minRaters).length
  const totalHubTargetCount = quarterRounds.reduce((sum, round) => sum + round.targetCount, 0)
  const totalHubSubmittedCount = quarterRounds.reduce((sum, round) => sum + round.submittedCount, 0)
  const totalHubPendingTargetCount = Math.max(totalHubTargetCount - totalHubSubmittedCount, 0)
  const averageHubResponseRate = quarterRounds.length
    ? Math.round(quarterRounds.reduce((sum, round) => sum + round.responseRate, 0) / quarterRounds.length)
    : 0
  const selectedHubRoundStatusLabel = selectedHubRound
    ? getFeedback360RoundStatusLabel(selectedHubRound.status)
    : '진행 중 라운드 없음'
  const selectedHubResultShareStatusLabel = getFeedback360ResultShareStatusLabel(selectedHubRound)
  const selectedHubRoundMappingLabel = selectedHubRound
    ? selectedHubRound.status === 'DRAFT'
      ? '매핑 필요'
      : '상세 확인'
    : '대기'
  const selectedHubRoundTargetCount = selectedHubRound?.targetCount ?? totalHubTargetCount
  const selectedHubMailRequests = selectedHubRound
    ? quarterPendingRequests.filter((request) => request.roundId === selectedHubRound.id)
    : quarterPendingRequests
  const selectedHubEmailRecipientCount = new Set(
    selectedHubMailRequests
      .map((request) => request.receiverEmail?.trim().toLowerCase())
      .filter(Boolean)
  ).size
  const selectedHubAppRecipientCount = selectedHubRoundTargetCount
  const selectedHubMissingEmailCount = Math.max(selectedHubRoundTargetCount - selectedHubEmailRecipientCount, 0)
  const operationsMailReadiness = buildFeedback360MailReadiness({
    contextLabel: `${selectedQuarterLabel} 360 운영`,
    alertType: '미응답 리마인드',
    targetCount: selectedHubRoundTargetCount,
    emailRecipientCount: selectedHubEmailRecipientCount,
    appRecipientCount: selectedHubAppRecipientCount,
    missingEmailCount: selectedHubMissingEmailCount,
    canManage: canViewFeedback360Operations,
    providerConfigured: 'unknown',
    preferredChannel: 'EMAIL_AND_APP',
    previewSubject: `[360 다면평가] ${selectedQuarterLabel} 응답 요청 알림`,
    previewBody: `${selectedQuarterLabel} 다면평가 응답이 필요한 구성원에게 응답 요청과 마감일을 안내합니다.`,
  })
  const mappingMailReadiness = buildFeedback360MailReadiness({
    contextLabel: `${selectedQuarterLabel} 평가자 매핑`,
    alertType: '평가자 매핑 완료 안내',
    targetCount: selectedHubRoundTargetCount,
    emailRecipientCount: selectedHubEmailRecipientCount,
    appRecipientCount: selectedHubAppRecipientCount,
    missingEmailCount: selectedHubMissingEmailCount,
    canManage: canViewFeedback360Operations,
    providerConfigured: 'unknown',
    preferredChannel: 'EMAIL_AND_APP',
    previewSubject: `[360 다면평가] ${selectedQuarterLabel} 평가자 매핑 안내`,
    previewBody: `${selectedQuarterLabel} 평가자 매핑 완료 안내와 미응답 리마인드 준비 상태를 확인합니다.`,
  })
  const resultsMailReadiness = buildFeedback360MailReadiness({
    contextLabel: `${selectedQuarterLabel} 360 결과`,
    alertType: '결과 공유 메일 준비',
    targetCount: quarterAnonymityReadyCount ? selectedHubRoundTargetCount : 0,
    emailRecipientCount: quarterAnonymityReadyCount ? selectedHubEmailRecipientCount : 0,
    appRecipientCount: quarterAnonymityReadyCount ? selectedHubAppRecipientCount : 0,
    missingEmailCount: quarterAnonymityReadyCount ? selectedHubMissingEmailCount : 0,
    canManage: canViewFeedback360Operations,
    providerConfigured: 'unknown',
    preferredChannel: 'EMAIL_AND_APP',
    previewSubject: `[360 다면평가] ${selectedQuarterLabel} 결과 공유 안내`,
    previewBody: `${selectedQuarterLabel} 다면평가 결과 공개 안내와 공유 메일 준비 상태를 확인합니다.`,
  })
  const selectedHubRoundMailReadinessLabel = selectedHubRound ? operationsMailReadiness.statusLabel : '라운드 필요'
  const selectedHubRoundCacheStatusLabel =
    selectedHubRound && selectedHubRound.submittedCount >= selectedHubRound.minRaters
      ? '결과 탭에서 확인'
      : '응답 기준 대기'
  const operationsSummaryMetrics = [
    { label: '전체 대상자', value: `${totalHubTargetCount}명`, tone: undefined },
    { label: '평가자 매핑 완료', value: quarterRounds.length ? '상세 확인' : '대기', tone: undefined },
    { label: '매핑 필요', value: quarterRounds.length ? selectedHubRoundMappingLabel : '대기', tone: 'amber' as const },
    { label: '응답 완료', value: `${totalHubSubmittedCount}건`, tone: undefined },
    { label: '미응답', value: `${totalHubPendingTargetCount}건`, tone: 'amber' as const },
    { label: '익명 기준 충족', value: `${quarterAnonymityReadyCount}건`, tone: undefined },
    { label: '결과 공개 준비', value: quarterAnonymityReadyCount ? '준비' : '대기', tone: undefined },
  ]
  const visibleTagPreviewCategories = FEEDBACK_360_RESPONSE_TAG_CATEGORIES.filter(
    (category) => category.audience !== 'leader'
  )

  function buildHubHref(tab: Feedback360HubTab = activeHubTab, overrides?: { cycleId?: string; quarter?: Feedback360Quarter }) {
    const params = new URLSearchParams()
    const cycleId = overrides?.cycleId ?? selectedHubCycleId
    const quarter = overrides?.quarter ?? selectedQuarter
    if (cycleId) params.set('cycleId', cycleId)
    if (quarter) params.set('quarter', quarter)
    params.set('tab', tab)
    return `/evaluation/360${params.toString() ? `?${params.toString()}` : ''}`
  }
  const feedback360HubTabs = [
    { href: buildHubHref('overview'), label: '개요', active: activeHubTab === 'overview' },
    { href: buildHubHref('respond'), label: '응답하기', active: activeHubTab === 'respond' },
    { href: buildHubHref('operations'), label: '운영', active: activeHubTab === 'operations', visible: canViewFeedback360Operations },
    { href: buildHubHref('mapping'), label: '평가자 매핑', active: activeHubTab === 'mapping', visible: canViewFeedback360Operations },
    { href: buildHubHref('results'), label: '결과', active: activeHubTab === 'results' },
  ]
  const pptSectionHrefs: Partial<Record<Feedback360PptShellSection, string>> = {
    dashboard: buildHubHref('overview'),
    response: buildHubHref('respond'),
    operations: buildHubHref('operations'),
    mapping: buildHubHref('mapping'),
    results: buildHubHref('results'),
    settings: buildHubHref('operations'),
  }
  const pptUser = {
    id: props.data.currentUser?.id,
    name: props.data.currentUser?.name ?? '구성원',
    department: props.data.currentUser?.department ?? '소속 확인 필요',
    position: props.data.currentUser?.role ? getRoleLabel(props.data.currentUser.role) : '직책 확인 필요',
    profileImageUrl: props.data.currentUser?.profileImageUrl,
  }
  const pptControls: Feedback360PptControl[] = [
    {
      label: '평가 주기',
      value: selectedHubCycleId,
      options: props.data.availableCycles.length
        ? props.data.availableCycles.map((cycle) => ({
            value: cycle.id,
            label: `${cycle.year}년 · ${cycle.name}`,
          }))
        : [{ value: '', label: '평가 주기 없음' }],
      onChange: (value) => router.push(buildHubHref(activeHubTab, { cycleId: value })),
    },
    {
      label: '평가 분기',
      value: selectedQuarter,
      options: FEEDBACK_360_QUARTER_OPTIONS.map((quarter) => ({
        value: quarter.value,
        label: quarter.label,
      })),
      onChange: (value) => router.push(buildHubHref(activeHubTab, { quarter: value as Feedback360Quarter })),
    },
  ]
  const activePptSection: Feedback360PptShellSection =
    activeHubTab === 'respond'
      ? 'response'
      : activeHubTab === 'results'
        ? 'results'
        : activeHubTab === 'operations'
          ? 'operations'
          : activeHubTab === 'mapping'
            ? 'mapping'
            : 'dashboard'
  const nearestDueLabel = nearestResponseDueDate
    ? `${getFeedback360RemainingDaysLabel(nearestResponseDueDate)} · ${nearestResponseDueDate}`
    : selectedHubRound
      ? getFeedback360RemainingDaysLabel(selectedHubRound.endDate)
      : '일정 확인'

  async function handleCreateQuarterRound() {
    if (!selectedHubCycleId || !canViewFeedback360Operations || selectedHubRound) return

    setRoundCreateBusy(true)
    setOperationsNotice('')
    setOperationsError('')

    try {
      const response = await fetch('/api/feedback/rounds/quarterly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          evalCycleId: selectedHubCycleId,
          quarter: selectedQuarter,
        }),
      })
      const json = await response.json()
      if (!json.success) {
        throw new Error(json.error?.message || '라운드 생성에 실패했습니다.')
      }

      setOperationsNotice(json.data?.message ?? `${selectedQuarterLabel} 라운드를 생성했습니다.`)
      const nextParams = new URLSearchParams()
      nextParams.set('cycleId', selectedHubCycleId)
      nextParams.set('quarter', selectedQuarter)
      nextParams.set('tab', 'operations')
      if (json.data?.roundId) {
        nextParams.set('roundId', json.data.roundId)
      }
      router.replace(`/evaluation/360?${nextParams.toString()}`)
      startTransition(() => router.refresh())
    } catch (error) {
      setOperationsError(error instanceof Error ? error.message : '라운드 생성에 실패했습니다.')
    } finally {
      setRoundCreateBusy(false)
    }
  }

  useEffect(() => {
    if (!distributionLimitExceeded && respondError === DISTRIBUTION_LIMIT_EXCEEDED_MESSAGE) {
      setRespondError('')
    }
  }, [distributionLimitExceeded, respondError])

  const resultTargetId = props.data.mode === 'results' ? props.data.results?.targetEmployee.id ?? '' : ''
  const resultViewContextKey =
    resultTargetId && props.data.selectedRoundId
      ? `${props.data.selectedRoundId}:${resultTargetId}`
      : ''

  useEffect(() => {
    if (!resultViewContextKey || recordedResultViewKey === resultViewContextKey) {
      return
    }

    let cancelled = false

    void (async () => {
      try {
        const response = await fetch(
          `/api/feedback/rounds/${encodeURIComponent(props.data.selectedRoundId!)}/result-view`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              targetId: resultTargetId,
            }),
          }
        )

        if (!response.ok) {
          return
        }

        if (!cancelled) {
          setRecordedResultViewKey(resultViewContextKey)
        }
      } catch {
        // Result view receipt failures should not block the live results flow.
      }
    })()

    return () => {
      cancelled = true
    }
  }, [
    recordedResultViewKey,
    resultTargetId,
    resultViewContextKey,
    props.data.selectedRoundId,
  ])

  const resultsAiPayload = useMemo(() => {
    if (!props.data.results) return null
    return {
      targetEmployee: props.data.results.targetEmployee,
      anonymityThreshold: props.data.results.anonymityThreshold,
      feedbackCount: props.data.results.feedbackCount,
      categoryScores: props.data.results.categoryScores,
      textHighlights: props.data.results.textHighlights,
      strengths: props.data.results.strengths,
      improvements: props.data.results.improvements,
    }
  }, [props.data.results])

  async function handleGenerateReportCache() {
    if (!props.data.results || !props.data.selectedRoundId) return
    setReportBusy(true)
    setResultsNotice('')
    setResultsError('')

    try {
      const response = await fetch(`/api/feedback/rounds/${encodeURIComponent(props.data.selectedRoundId)}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetId: props.data.results.targetEmployee.id,
        }),
      })
      const json = await response.json()
      if (!json.success) {
        throw new Error(json.error?.message || '360 결과 리포트 준비에 실패했습니다.')
      }

      setResultsNotice(json.data?.message ?? '360 결과 리포트를 준비했습니다.')
      startTransition(() => router.refresh())
    } catch (error) {
      setResultsError(error instanceof Error ? error.message : '360 결과 리포트 준비에 실패했습니다.')
    } finally {
      setReportBusy(false)
    }
  }

  const developmentAiPayload = useMemo(() => {
    if (!props.data.results) return null
    return {
      targetEmployee: props.data.results.targetEmployee,
      strengths: props.data.results.strengths,
      improvements: props.data.results.improvements,
      anonymousSummary: props.data.results.anonymousSummary,
      categoryScores: props.data.results.categoryScores,
    }
  }, [props.data.results])

  const resultPresentationHighlights = useMemo(() => {
    if (!props.data.results) return []

    return [
      props.data.results.presentationSettings.showLeaderComment ? '팀장 평가 코멘트 공개' : '팀장 평가 코멘트 비공개',
      props.data.results.presentationSettings.showLeaderScore ? '팀장 평가 등급 공개' : '팀장 평가 등급 비공개',
      props.data.results.presentationSettings.showExecutiveComment ? '상위 평가 코멘트 공개' : '상위 평가 코멘트 비공개',
      props.data.results.presentationSettings.showExecutiveScore ? '상위 평가 등급 공개' : '상위 평가 등급 비공개',
      props.data.results.presentationSettings.showFinalScore ? '최종 결과 등급 공개' : '최종 결과 등급 비공개',
      props.data.results.presentationSettings.showFinalComment ? '최종 결과 코멘트 공개' : '최종 결과 코멘트 비공개',
    ]
  }, [props.data.results])
  const resultVisualModel = useMemo(
    () => (props.data.results ? buildFeedback360ResultVisualModel(props.data.results) : null),
    [props.data.results]
  )

  function buildResultVersionHref(version: NonNullable<Feedback360PageData['results']>['recipientProfile']) {
    const search = new URLSearchParams()
    if (props.data.selectedCycleId) search.set('cycleId', props.data.selectedCycleId)
    if (props.data.selectedRoundId) search.set('roundId', props.data.selectedRoundId)
    if (props.data.results?.targetEmployee.id) search.set('empId', props.data.results.targetEmployee.id)
    search.set('version', version)
    return `/evaluation/360/results?${search.toString()}`
  }

  async function handleSubmitResponse() {
    if (!respondData) return

    const nextQuestionErrors = respondData.questions.reduce<Record<string, string>>((errors, question) => {
      if (!question.isRequired) return errors

      const answer = questionState[question.id]
      const answered =
        question.questionType === 'RATING_SCALE'
          ? typeof answer?.ratingValue === 'number'
          : Boolean(answer?.textValue?.trim())

      if (!answered) {
        errors[question.id] = '필수 항목입니다. 이 항목을 입력해 주세요.'
      }

      return errors
    }, {})

    if (Object.keys(nextQuestionErrors).length) {
      setRespondNotice('')
      setRespondError('필수 항목을 확인해 주세요.')
      setQuestionErrorMessages(nextQuestionErrors)
      return
    }

    if (distributionLimitExceeded) {
      setRespondNotice('')
      setRespondError(DISTRIBUTION_LIMIT_EXCEEDED_MESSAGE)
      return
    }

    if (overallCommentForSubmit.length > FEEDBACK_360_OVERALL_COMMENT_MAX_LENGTH) {
      setRespondNotice('')
      setRespondError(
        `선택 태그 요약을 포함한 종합 의견은 ${FEEDBACK_360_OVERALL_COMMENT_MAX_LENGTH}자 이내로 작성해 주세요.`
      )
      return
    }

    setSubmitBusy(true)
    setRespondNotice('')
    setRespondError('')

    try {
      const riskHeaders = await requestRiskConfirmation({
        actionName: 'FINAL_SUBMIT',
        actionLabel: '다면 리뷰 최종 제출',
        targetLabel: respondData.receiverName,
        detail: '현재 마스터 로그인 상태에서 다면 리뷰 응답을 최종 제출합니다.',
        confirmationText: '제출',
      })
      if (riskHeaders === null) return

      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...riskHeaders },
        body: JSON.stringify({
          roundId: respondData.roundId,
          receiverId: respondData.receiverId,
          relationship: respondData.relationship,
          overallComment: overallCommentForSubmit || undefined,
          responses: respondData.questions.map((question) => ({
            questionId: question.id,
            ratingValue: questionState[question.id]?.ratingValue ?? undefined,
            textValue: questionState[question.id]?.textValue ?? undefined,
          })),
        }),
      })
      const json = await response.json()
      if (!json.success) {
        throw new Error(json.error?.message || '다면평가 응답 제출에 실패했습니다.')
      }
      setRespondNotice('응답이 제출되었습니다.')
      setQuestionErrorMessages({})
      startTransition(() => router.refresh())
    } catch (error) {
      setRespondError(error instanceof Error ? error.message : '다면평가 응답 제출에 실패했습니다.')
    } finally {
      setSubmitBusy(false)
    }
  }

  function updateQuestion(
    questionId: string,
    nextValue: Partial<{ ratingValue?: number | null; textValue?: string | null }>
  ) {
    setQuestionErrorMessages((current) => {
      if (!current[questionId]) return current

      const next = { ...current }
      delete next[questionId]
      return next
    })
    setQuestionState((current) => ({
      ...current,
      [questionId]: {
        ...current[questionId],
        ...nextValue,
      },
    }))
  }

  function toggleResponseTag(categoryId: string, tone: Feedback360ResponseTagTone, tagId: string) {
    setSelectedResponseTags((current) => {
      const currentCategory = current[categoryId] ?? { positive: [], improvement: [] }
      const currentToneTags = currentCategory[tone] ?? []
      const nextToneTags = currentToneTags.includes(tagId)
        ? currentToneTags.filter((id) => id !== tagId)
        : [...currentToneTags, tagId]

      return {
        ...current,
        [categoryId]: {
          ...currentCategory,
          [tone]: nextToneTags,
        },
      }
    })
  }

  if (props.data.state !== 'ready' && props.data.mode !== 'overview') {
    return (
      <div className="w-full max-w-full overflow-x-hidden space-y-6">
        <MultiRaterCycleHeader data={props.data} />
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-500">
            <Users className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-slate-900">
            {props.data.state === 'permission-denied'
              ? '이 화면을 볼 권한이 없습니다.'
              : props.data.state === 'empty'
                ? '현재 진행 중인 360 평가가 없습니다.'
                : '360 다면평가 데이터를 불러오지 못했습니다.'}
          </h2>
          <p className="mt-2 text-sm text-slate-500">{props.data.message ?? '평가 주기와 접근 권한을 확인해 주세요.'}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <ActionLink href="/evaluation/360" label="360 다면평가 허브" />
            <ActionLink href="/evaluation/360/results" label="360 결과" />
            {props.data.permissions?.canViewAdmin ? (
              <ActionLink href={buildHubHref('operations')} label="360 운영 관리" />
            ) : null}
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="w-full max-w-full overflow-x-hidden space-y-6">
      {props.data.mode === 'overview' ? (
        <Feedback360PptAppShell
          user={pptUser}
          activeSection={activePptSection}
          title={activeHubTab === 'respond' ? '다면평가 (360도)' : activeHubTab === 'operations' ? '360 다면평가 운영' : activeHubTab === 'mapping' ? '평가자 매핑 관리' : activeHubTab === 'results' ? '다면평가 리포트' : '360 다면평가'}
          subtitle={
            activeHubTab === 'respond'
              ? '내가 평가해야 하는 구성원 목록입니다.'
              : activeHubTab === 'operations'
                ? '라운드, 평가자 매핑, 응답 현황, 익명 기준, 결과 공유를 관리합니다.'
                : activeHubTab === 'mapping'
                  ? '평가자 매핑과 공개 범위, 관계 데이터 기반 추천 상태를 확인합니다.'
                  : activeHubTab === 'results'
                    ? '익명 기준 충족 후 태그 지표와 의견 요약을 확인합니다.'
                    : '함께 일한 동료의 협업 경험을 해시태그와 짧은 의견으로 남깁니다.'
          }
          breadcrumb={['다면평가(360도)', activeHubTab === 'respond' ? '내가 평가할 사람' : activeHubTab === 'results' ? '리포트 조회' : activeHubTab === 'operations' ? '운영 관리' : activeHubTab === 'mapping' ? '평가자 매핑' : '대시보드']}
          statusLabel={selectedHubRound ? '진행 중' : '준비 중'}
          dueLabel={nearestDueLabel}
          controls={pptControls}
          reportHref={buildHubHref('results')}
          sectionHrefs={pptSectionHrefs}
        >
          <div className="w-full max-w-full overflow-x-hidden space-y-6">
            <Feedback360PptShellTabs tabs={feedback360HubTabs} />

                {activeHubTab === 'overview' ? (
                <section id="feedback360-overview" className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
                    <Feedback360MetricPill label={`${selectedQuarterLabel} 진행`} value={`${activeQuarterRoundCount}건`} compact />
                    <Feedback360MetricPill label="내 미응답" value={`${quarterResponseTargets.length}건`} compact tone={quarterResponseTargets.length ? 'amber' : 'slate'} />
                    <Feedback360MetricPill label="응답 완료" value={`${totalHubSubmittedCount}건`} compact />
                    <Feedback360MetricPill label="평균 응답률" value={`${averageHubResponseRate}%`} compact />
                    <Feedback360MetricPill label="익명 기준 충족" value={`${quarterAnonymityReadyCount}건`} compact />
                  </div>

                  <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_300px]">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                        <CircleDotDashed className="h-4 w-4 text-blue-600" />
                        360 흐름
                      </div>
                      <div className="mt-4 grid gap-3 md:grid-cols-3 2xl:grid-cols-5">
                        {[
                          '대상자/평가자 매핑',
                          '해시태그 응답',
                          '정성 의견',
                          '익명 기준 확인',
                          '결과 리포트',
                        ].map((step, index) => (
                          <div key={step} className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-700">
                              {index + 1}
                            </div>
                            <div className="mt-3 text-sm font-semibold leading-5 text-slate-800">{step}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
                      <div className="flex items-start gap-3">
                        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                        <div>
                          <p className="font-semibold">다면평가는 동료 협업 경험을 보완적으로 참고하기 위한 자료입니다.</p>
                          <p className="mt-2 leading-6">
                            공식 평가 점수나 등급을 자동 산정하지 않으며, 공식 점수/등급 저장 흐름과 분리되어 있습니다.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                        <Hash className="h-4 w-4 text-blue-600" />
                        해시태그 방식 안내
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
                          긍정 태그: 반복적으로 관찰된 강점을 부드럽게 선택합니다.
                        </div>
                        <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-3 text-sm text-amber-800">
                          보완 태그: 개선하면 좋을 행동을 짧고 안전하게 남깁니다.
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {visibleTagPreviewCategories.map((category) => (
                          <span
                            key={category.id}
                            className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600"
                          >
                            {category.category}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                      <div className="font-semibold">비정기 다면평가</div>
                      <ul className="mt-3 space-y-2 leading-6">
                        <li>협업 이슈가 발생했을 때 수시로 기록할 수 있습니다.</li>
                        <li>1회성 사례보다 반복 발생 여부 중심으로 참고합니다.</li>
                        <li>정기 결과와 함께 종합 참고됩니다.</li>
                      </ul>
                    </div>
                  </div>
                </section>
                ) : null}

                {activeHubTab === 'respond' ? (
                <section id="feedback360-respond" className="space-y-4">
                  <Panel
                    title="내가 평가할 사람"
                    description="해시태그로 동료 협업 경험 남기기. 평가 대상자를 선택한 뒤 긍정 태그와 보완 태그를 골라 주세요."
                  >
                    <Feedback360PptSummaryCards
                      cards={[
                        {
                          label: '전체 평가 대상',
                          value: `${responseRows.length}명`,
                          helper: selectedQuarterLabel,
                          tone: 'blue',
                          icon: 'users',
                        },
                        {
                          label: '평가 완료',
                          value: `${responseCompletedCount}명`,
                          helper: '제출 완료',
                          tone: 'green',
                          icon: 'done',
                        },
                        {
                          label: '진행 중',
                          value: `${responseInProgressCount}명`,
                          helper: '작성 중',
                          tone: 'amber',
                          icon: 'progress',
                        },
                        {
                          label: '미평가',
                          value: `${responsePendingCount}명`,
                          helper: '미응답',
                          tone: responsePendingCount ? 'rose' : 'slate',
                          icon: 'pending',
                        },
                      ]}
                    />

                    <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_180px_180px_180px]">
                        <label className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3">
                          <Search className="h-4 w-4 text-slate-400" />
                          <input
                            value={responseSearchQuery}
                            onChange={(event) => setResponseSearchQuery(event.target.value)}
                            className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
                            placeholder="이름/부서 검색"
                          />
                        </label>
                        <label className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3">
                          <SlidersHorizontal className="h-4 w-4 text-slate-400" />
                          <select
                            value={responseStatusFilter}
                            onChange={(event) => setResponseStatusFilter(event.target.value)}
                            className="h-10 min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-700 outline-none"
                            aria-label="전체 상태"
                          >
                            <option value="ALL">전체 상태</option>
                            <option value="PENDING">미응답</option>
                            <option value="IN_PROGRESS">작성 중</option>
                            <option value="SUBMITTED">제출 완료</option>
                          </select>
                        </label>
                        <label className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3">
                          <Layers3 className="h-4 w-4 text-slate-400" />
                          <select
                            value={responseOrgFilter}
                            onChange={(event) => setResponseOrgFilter(event.target.value)}
                            className="h-10 min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-700 outline-none"
                            aria-label="전체 팀/본부"
                          >
                            <option value="ALL">전체 팀/본부</option>
                            {responseOrgOptions.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3">
                          <Clock3 className="h-4 w-4 text-slate-400" />
                          <select
                            value={responseSortMode}
                            onChange={(event) => setResponseSortMode(event.target.value)}
                            className="h-10 min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-700 outline-none"
                            aria-label="마감일 빠른순"
                          >
                            <option value="DUE_ASC">마감일 빠른순</option>
                            <option value="NAME_ASC">이름순</option>
                          </select>
                        </label>
                      </div>
                    </div>

                    <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                      <div className="overflow-hidden">
                        <div className="w-full">
                          <div className="hidden grid-cols-[minmax(180px,1.35fr)_minmax(0,0.8fr)_minmax(96px,0.8fr)_minmax(118px,0.95fr)_72px_98px_minmax(110px,0.85fr)_112px] gap-2 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-500 xl:grid">
                            <span>피평가자</span>
                            <span>소속</span>
                            <span>직급/관계</span>
                            <span>평가 기간</span>
                            <span>상태</span>
                            <span>마감일</span>
                            <span>진행률</span>
                            <span>평가하기</span>
                          </div>
                          <div className="divide-y divide-slate-100">
                        {finalFilteredResponseRows.length ? (
                          finalFilteredResponseRows.map((target) => (
                            <div
                              key={target.uniqueKey}
                              className="grid gap-2 px-4 py-4 transition hover:bg-blue-50/40 xl:grid-cols-[minmax(180px,1.35fr)_minmax(0,0.8fr)_minmax(96px,0.8fr)_minmax(118px,0.95fr)_72px_98px_minmax(110px,0.85fr)_112px] xl:items-center"
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-3">
                                  <Feedback360Avatar
                                    person={{
                                      name: target.receiverName,
                                      profileImageUrl: target.receiverProfileImageUrl,
                                    }}
                                    size="sm"
                                  />
                                  <div className="min-w-0 text-sm font-semibold leading-5 text-slate-950">
                                    <span className="block max-w-[240px] truncate whitespace-nowrap xl:max-w-none">
                                      {target.receiverName}
                                    </span>
                                  </div>
                                </div>
                                <div className="mt-1 max-w-[220px] truncate whitespace-nowrap text-xs text-slate-500 xl:max-w-none">
                                  {target.receiverEmail ?? `${selectedQuarterLabel} 평가 대상`}
                                </div>
                              </div>
                              <div className="min-w-0 max-w-[220px] truncate whitespace-nowrap text-sm text-slate-600 xl:max-w-none">{target.organizationLabel}</div>
                              <div className="flex min-w-0 flex-wrap gap-1.5">
                                {(target.relationships.length ? target.relationships : ['UNKNOWN']).map((relationship) => (
                                  <span
                                    key={`${target.uniqueKey}:${relationship}`}
                                    className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700"
                                  >
                                    {getFeedback360RelationshipLabel(relationship)}
                                  </span>
                                ))}
                              </div>
                              <div className="min-w-0 truncate whitespace-nowrap text-xs leading-5 text-slate-600">{target.periodLabel}</div>
                              <div>
                                <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getFeedback360StatusClassName(target.status)}`}>
                                  {target.statusLabel}
                                </span>
                              </div>
                              <div className="text-sm text-slate-600">
                                <div className="font-semibold text-slate-800">{target.remainingDaysLabel}</div>
                                <div className="text-xs text-slate-500">{target.dueDate}</div>
                              </div>
                              <div>
                                <ProgressBar value={target.progress} label={`${target.progress}%`} />
                              </div>
                              <Link
                                href={target.href}
                                className="inline-flex min-h-10 w-full min-w-0 items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-2 text-xs font-semibold text-white transition hover:bg-slate-800"
                              >
                                {target.actionLabel}
                                <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                              </Link>
                            </div>
                          ))
                        ) : responseRows.length ? (
                          <EmptyBlock message="검색/필터 조건에 맞는 응답 대상자가 없습니다. 전체 상태와 전체 팀/본부 필터를 다시 확인해 주세요." />
                        ) : (
                          <div className="p-5">
                            <EmptyBlock message="현재 배정된 응답 대상자가 없습니다. 평가 기간이 열리면 이곳에서 평가할 사람을 확인할 수 있습니다." />
                          </div>
                        )}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-slate-500">
                      <span>전체 {responseRows.length}명</span>
                      <span>평가하기를 눌러 해시태그 평가를 시작하세요.</span>
                    </div>
                  </Panel>
                </section>
                ) : null}

                {activeHubTab === 'operations' && canViewFeedback360Operations ? (
                  <section id="feedback360-operations" className="space-y-4">
                    <Panel
                      title="360 다면평가 운영"
                      description="대상자, 평가자 매핑, 응답률, 익명 기준 충족 상태를 선택한 분기 기준으로 관리합니다."
                    >
                      <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-4 shadow-sm">
                        <div className="space-y-4">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <GuideBadge tone="blue">선택한 분기: {selectedQuarterLabel}</GuideBadge>
                              <GuideBadge tone={selectedHubRound ? 'emerald' : 'slate'}>
                                {selectedHubRound ? `${selectedQuarterLabel} 라운드 진행 중` : '진행 중 라운드 없음'}
                              </GuideBadge>
                              <GuideBadge tone={selectedHubRound && selectedHubRound.submittedCount >= selectedHubRound.minRaters ? 'emerald' : 'slate'}>
                                {selectedHubResultShareStatusLabel}
                              </GuideBadge>
                            </div>
                            <h2 className="mt-3 text-lg font-semibold text-slate-950">
                              {selectedQuarterLabel} 운영 준비
                            </h2>
                            <p className="mt-1 text-sm leading-6 text-slate-700">
                              {selectedHubRound
                                ? `${selectedHubRound.roundName} 기준으로 평가자 매핑과 응답 진행 상태를 관리합니다.`
                                : '선택한 분기에 진행 중인 라운드가 없습니다.'}
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {['라운드 생성', '평가자 매핑', '응답 진행', '익명 기준 확인', '결과 확인'].map((step, index) => (
                                <span
                                  key={step}
                                  className="inline-flex min-h-8 items-center gap-2 rounded-full border border-blue-100 bg-white px-3 text-xs font-semibold text-slate-700"
                                >
                                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[11px] text-blue-700">
                                    {index + 1}
                                  </span>
                                  {step}
                                </span>
                              ))}
                            </div>
                            {selectedHubRound ? (
                              <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-5">
                                <SummaryRow label="라운드명" value={selectedHubRound.roundName} />
                                <SummaryRow label="기간" value={`${selectedHubRound.startDate} ~ ${selectedHubRound.endDate}`} />
                                <SummaryRow label="대상자" value={`${selectedHubRound.targetCount}명`} />
                                <SummaryRow label="응답률" value={`${selectedHubRound.responseRate}%`} />
                                <SummaryRow
                                  label="익명 기준"
                                  value={selectedHubRound.submittedCount >= selectedHubRound.minRaters ? '충족' : '미달'}
                                />
                              </div>
                            ) : (
                              <p className="mt-3 text-xs leading-5 text-slate-600">
                                라운드를 먼저 생성해야 평가자 매핑을 진행할 수 있습니다.
                              </p>
                            )}
                          </div>

                          <div className="rounded-2xl border border-slate-200 bg-white p-3">
                            <div className="text-sm font-semibold text-slate-900">{selectedQuarterLabel} 라운드 생성</div>
                            {!selectedHubRound ? (
                              <button
                                type="button"
                                disabled={roundCreateBusy}
                                onClick={handleCreateQuarterRound}
                                className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 disabled:cursor-wait disabled:bg-blue-300"
                              >
                                {roundCreateBusy ? '생성 중' : `${selectedQuarterLabel} 라운드 생성`}
                              </button>
                            ) : (
                              <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                                {selectedQuarterLabel} 라운드가 준비되었습니다.
                              </div>
                            )}
                            {!selectedHubRound ? (
                              <p className="mt-2 text-xs leading-5 text-slate-500">
                                라운드를 먼저 생성해야 평가자 매핑을 진행할 수 있습니다.
                              </p>
                            ) : null}
                            {operationsNotice ? (
                              <p className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                                {operationsNotice}
                              </p>
                            ) : null}
                            {operationsError ? (
                              <p className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                                {operationsError}
                              </p>
                            ) : null}
                          </div>
                        </div>
                        <div className="mt-4 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-3">
                          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                            <div className="text-sm font-semibold text-slate-900">평가자 검색</div>
                            <p className="mt-1 text-xs leading-5 text-slate-500">
                              이름, 부서, 팀, 직책 검색은 평가자 매핑 화면에서 사용합니다.
                            </p>
                            <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-semibold text-blue-700">
                              <span className="rounded-full bg-blue-50 px-2.5 py-1">같은 팀 1명</span>
                              <span className="rounded-full bg-blue-50 px-2.5 py-1">같은 본부 2명</span>
                              <span className="rounded-full bg-blue-50 px-2.5 py-1">타 본부 2명</span>
                            </div>
                          </div>
                          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                            <div className="text-sm font-semibold text-slate-900">공개 범위: 전체 익명</div>
                            <p className="mt-1 text-xs leading-5 text-slate-500">
                              평가자별 공개 범위 설정은 상세 화면에서 접힌 상태로 확인합니다.
                            </p>
                            <details className="mt-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                              <summary className="cursor-pointer text-xs font-semibold text-slate-700">
                                평가자별 공개 범위 설정
                              </summary>
                              <p className="mt-2 text-xs leading-5 text-slate-500">
                                기본 익명 운영 기준을 확인하고, 변경은 기존 승인된 운영 설정 화면에서 진행합니다.
                              </p>
                            </details>
                          </div>
                          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                            <div className="text-sm font-semibold text-slate-900">AI 평가자 추천</div>
                            <p className="mt-1 text-xs leading-5 text-slate-500">
                              실제 후보 데이터가 있을 때 평가자 매핑 화면에서 추천 후보와 추천 근거를 확인합니다.
                            </p>
                            <div className="mt-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800">
                              추천 근거
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-7">
                        {operationsSummaryMetrics.map((metric) => (
                          <Feedback360MetricPill
                            key={metric.label}
                            label={metric.label}
                            value={metric.value}
                            compact
                            tone={metric.tone}
                          />
                        ))}
                      </div>

                      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,65fr)_minmax(320px,35fr)]">
                        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                          <div className="grid bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-500 lg:grid-cols-[minmax(180px,1.4fr)_minmax(132px,0.9fr)_minmax(74px,0.5fr)_minmax(112px,0.75fr)_minmax(84px,0.55fr)_minmax(86px,0.6fr)_minmax(84px,0.6fr)_minmax(112px,0.75fr)]">
                            <span>운영 건</span>
                            <span>기간</span>
                            <span>대상자 수</span>
                            <span>평가자 매핑</span>
                            <span>응답 완료</span>
                            <span>익명 기준</span>
                            <span>상태</span>
                            <span>작업</span>
                          </div>
                          {quarterRounds.length ? (
                            quarterRounds.map((round) => {
                              const anonymityMet = round.submittedCount >= round.minRaters
                              const mappingHref = `/evaluation/360/nomination?${new URLSearchParams({
                                ...(selectedHubCycleId ? { cycleId: selectedHubCycleId } : {}),
                                roundId: round.id,
                              }).toString()}`

                              return (
                                <div
                                  key={round.id}
                                  className="grid gap-2 border-t border-slate-100 px-4 py-3 text-sm lg:grid-cols-[minmax(180px,1.4fr)_minmax(132px,0.9fr)_minmax(74px,0.5fr)_minmax(112px,0.75fr)_minmax(84px,0.55fr)_minmax(86px,0.6fr)_minmax(84px,0.6fr)_minmax(112px,0.75fr)] lg:items-center"
                                >
                                  <div className="min-w-0">
                                    <div className="truncate font-semibold text-slate-900">{selectedQuarterLabel} · {round.roundName}</div>
                                    <div className="mt-1 text-xs font-semibold text-slate-400">선택 분기 운영 건</div>
                                  </div>
                                  <span className="text-slate-600">{round.startDate} ~ {round.endDate}</span>
                                  <span className="text-slate-600">{round.targetCount}명</span>
                                  <span className="text-slate-600">평가자 매핑 화면에서 설정</span>
                                  <span className="text-slate-600">{round.submittedCount}건</span>
                                  <span className={anonymityMet ? 'font-semibold text-emerald-700' : 'font-semibold text-amber-700'}>
                                    {anonymityMet ? '충족' : '미달'}
                                  </span>
                                  <span className="font-semibold text-slate-700">{getFeedback360RoundStatusLabel(round.status)}</span>
                                  <Link
                                    href={mappingHref}
                                    className="inline-flex min-h-9 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 px-3 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
                                  >
                                    평가자 매핑
                                  </Link>
                                </div>
                              )
                            })
                          ) : (
                            <div className="p-4">
                              <EmptyBlock message="선택한 분기에 진행 중인 360 다면평가가 없습니다. HR 운영 탭에서 해당 분기 평가자 매핑 상태를 확인할 수 있습니다." />
                            </div>
                          )}
                        </div>

                        <aside className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h2 className="text-base font-semibold text-slate-900">선택 라운드 상세</h2>
                              <p className="mt-1 text-xs leading-5 text-slate-500">
                                선택된 분기의 운영 준비 상태를 한눈에 확인합니다.
                              </p>
                            </div>
                            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                              {selectedHubRoundStatusLabel}
                            </span>
                          </div>
                          <div className="mt-4 space-y-3 text-sm">
                            <SummaryRow label="라운드 생성 상태" value={selectedHubRound ? '생성 완료' : '생성 필요'} />
                            <SummaryRow label="평가자 매핑 현황" value={selectedHubRoundMappingLabel} />
                            <SummaryRow label="메일/알림 상태" value={selectedHubRoundMailReadinessLabel} />
                            <SummaryRow label="공개 범위" value="공개 범위: 전체 익명" />
                            <SummaryRow label="결과 공유" value={selectedHubResultShareStatusLabel} />
                            <SummaryRow label="리포트 캐시 상태" value={selectedHubRoundCacheStatusLabel} />
                          </div>
                          <div className="mt-4 space-y-2">
                            {!selectedHubRound ? (
                              <button
                                type="button"
                                disabled={roundCreateBusy}
                                onClick={handleCreateQuarterRound}
                                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 disabled:cursor-wait disabled:bg-blue-300"
                              >
                                {roundCreateBusy ? '생성 중' : '라운드 생성'}
                              </button>
                            ) : (
                              <Link
                                href={primaryMappingHref}
                                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800"
                              >
                                {primaryMappingCtaLabel}
                                <ArrowRight className="h-4 w-4" />
                              </Link>
                            )}
                            <button
                              type="button"
                              disabled
                              className="inline-flex min-h-11 w-full cursor-not-allowed items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-400"
                            >
                              리마인드 알림 준비
                            </button>
                            <button
                              type="button"
                              disabled
                              className="inline-flex min-h-11 w-full cursor-not-allowed items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-400"
                            >
                              결과 공유 준비
                            </button>
                          </div>
                        </aside>
                      </div>
                    </Panel>

                    <section className="space-y-4">
                      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <h2 className="text-base font-semibold text-slate-900">평가자 매핑 관리</h2>
                            <p className="mt-1 text-sm text-slate-500">
                              대상자별 평가자를 확인하고, 실제 매핑 설정은 평가자 매핑 화면에서 진행합니다.
                            </p>
                          </div>
                          {selectedHubRound ? (
                            <Link
                              href={primaryMappingHref}
                              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800"
                            >
                              {primaryMappingCtaLabel}
                              <ArrowRight className="h-4 w-4" />
                            </Link>
                          ) : (
                            <button
                              type="button"
                              disabled
                              className="inline-flex min-h-11 cursor-not-allowed items-center justify-center rounded-xl border border-slate-300 bg-slate-50 px-4 text-sm font-semibold text-slate-400"
                              title="라운드를 먼저 생성해야 평가자 매핑을 진행할 수 있습니다."
                            >
                              평가자 매핑 화면 열기
                            </button>
                          )}
                        </div>
                        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
                          <div className="hidden bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-500 xl:grid xl:grid-cols-[minmax(160px,1.3fr)_minmax(90px,0.7fr)_minmax(84px,0.6fr)_minmax(92px,0.7fr)_minmax(112px,0.8fr)_minmax(82px,0.6fr)_minmax(94px,0.7fr)_minmax(80px,0.6fr)]">
                            <span>대상자</span>
                            <span>소속/팀</span>
                            <span>필요 평가자 수</span>
                            <span>현재 매핑 수</span>
                            <span>평가자</span>
                            <span>관계</span>
                            <span>응답 상태</span>
                            <span>익명 기준</span>
                          </div>
                          <div className="overflow-hidden">
                            {quarterRounds.length ? (
                              quarterRounds.slice(0, 5).map((round) => (
                                <div
                                  key={round.id}
                                  className="grid gap-2 border-t border-slate-100 px-4 py-3 text-sm xl:grid-cols-[minmax(160px,1.3fr)_minmax(90px,0.7fr)_minmax(84px,0.6fr)_minmax(92px,0.7fr)_minmax(112px,0.8fr)_minmax(82px,0.6fr)_minmax(94px,0.7fr)_minmax(80px,0.6fr)] xl:items-center"
                                >
                                  <span className="font-semibold text-slate-900">{round.roundName}</span>
                                  <span className="text-slate-600">대상자별 확인</span>
                                  <span className="text-slate-600">최소 {round.minRaters}명</span>
                                  <span className="text-slate-600">매핑 화면에서 확인</span>
                                  <span className="text-slate-600">평가자 매핑 화면</span>
                                  <span className="text-slate-600">관계별</span>
                                  <span className="text-slate-600">응답 {round.submittedCount}건</span>
                                  <span className={round.submittedCount >= round.minRaters ? 'font-semibold text-emerald-700' : 'font-semibold text-amber-700'}>
                                    {round.submittedCount >= round.minRaters ? '충족' : '미달'}
                                  </span>
                                </div>
                              ))
                            ) : (
                              <EmptyBlock message="선택한 분기에 평가자 매핑 데이터가 없습니다. 라운드가 열리면 평가자 매핑을 진행할 수 있습니다." />
                            )}
                          </div>
                        </div>
                        <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
                          <div className="font-semibold">평가자 매핑 현황</div>
                          <p className="mt-1">
                            실제 매핑 설정은 평가자 매핑 화면의 승인된 저장 흐름을 사용합니다. 이 허브에서는 대상자별 현황을 확인하고,
                            직접 추가/삭제/저장은 제공하지 않습니다.
                          </p>
                        </div>
                        <div className="mt-3">
                          <Feedback360MailReadinessPanel
                            model={operationsMailReadiness}
                            previewOpen={operationsMailPreviewOpen}
                            resultOpen={operationsMailResultOpen}
                            onOpenPreview={() => setOperationsMailPreviewOpen(true)}
                            onClosePreview={() => setOperationsMailPreviewOpen(false)}
                            onOpenResult={() => setOperationsMailResultOpen(true)}
                            onCloseResult={() => setOperationsMailResultOpen(false)}
                          />
                        </div>
                        <div className="mt-3 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-900">
                          <div className="font-semibold">AI 평가자 추천</div>
                          <p className="mt-1">
                            평가자 추천 후보는 피평가자를 잘 아는 사람을 우선합니다. 같은 팀, 같은 부서, 동일 조직 KPI,
                            동일 프로젝트 KPI, 월간 실적/체크인/댓글/협업 기록, 직속 상사/관리 범위를 기준으로 확인합니다.
                          </p>
                          <div className="mt-2 rounded-xl border border-blue-100 bg-white px-3 py-2 text-sm text-slate-700">
                            <span className="font-semibold text-slate-900">추천 근거</span>
                            <span className="ml-2">라운드가 있으면 평가자 매핑 화면에서 대상자를 선택한 뒤 평가자 추천 버튼으로 후보 패널을 엽니다.</span>
                          </div>
                          {!selectedHubRound ? (
                            <div className="mt-2 rounded-xl border border-dashed border-blue-200 bg-white px-3 py-2 text-sm text-slate-500">
                              추천 가능한 평가자가 없습니다
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                          <h2 className="text-base font-semibold text-slate-900">단계별 현황</h2>
                          <div className="mt-4 space-y-3">
                            {[
                              ['매핑 필요', quarterRounds.length ? '대상자별 확인' : '없음'],
                              ['응답 진행 중', `${quarterResponseTargets.length}건`],
                              ['대상 기준 미완료', `${totalHubPendingTargetCount}건`],
                              ['익명 기준 미달', `${Math.max(quarterRounds.length - quarterAnonymityReadyCount, 0)}건`],
                              ['결과 준비 완료', `${quarterAnonymityReadyCount}건`],
                            ].map(([label, value]) => (
                              <SummaryRow key={label} label={label} value={value} />
                            ))}
                          </div>
                        </section>

                        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                          <h2 className="text-base font-semibold text-slate-900">해시태그 구성 범위</h2>
                          <div className="mt-4 space-y-3 text-sm">
                            <SummaryRow label="카테고리 수" value={`${FEEDBACK_360_RESPONSE_TAG_POOL_STATS.categoryCount}개`} />
                            <SummaryRow label="긍정 태그 수" value={`${FEEDBACK_360_RESPONSE_TAG_POOL_STATS.positiveTagCount}개`} />
                            <SummaryRow label="보완 태그 수" value={`${FEEDBACK_360_RESPONSE_TAG_POOL_STATS.improvementTagCount}개`} />
                            <SummaryRow label="리더/PM 전용" value="리더십/코칭 카테고리 포함" />
                          </div>
                        </section>
                      </div>
                    </section>
                  </section>
                ) : null}

                {activeHubTab === 'mapping' && canViewFeedback360Operations ? (
                  <section id="feedback360-mapping" className="space-y-4">
                    <Panel
                      title="평가자 매핑"
                      description="대상자별 평가자 구성, 공개 범위, AI/관계 점수 추천 흐름을 선택한 분기 기준으로 확인합니다."
                    >
                      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <div className="text-sm font-semibold text-blue-900">평가자 매핑 관리</div>
                            <h2 className="mt-2 text-lg font-semibold text-slate-950">
                              {selectedQuarterLabel} 평가자 매핑 현황
                            </h2>
                            <p className="mt-2 text-sm leading-6 text-blue-900">
                              실제 매핑 설정은 평가자 매핑 화면에서 진행합니다. 이 탭은 운영자가 라운드, 후보 기준,
                              공개 범위, 추천 데이터 준비 상태를 한 번에 찾도록 정리한 진입 화면입니다.
                            </p>
                          </div>
                          {primaryMappingHref ? (
                            <Link
                              href={primaryMappingHref}
                              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800"
                            >
                              {primaryMappingCtaLabel}
                              <ArrowRight className="h-4 w-4" />
                            </Link>
                          ) : (
                            <button
                              type="button"
                              disabled
                              className="inline-flex min-h-11 shrink-0 cursor-not-allowed items-center justify-center rounded-xl border border-blue-200 bg-white/70 px-4 text-sm font-semibold text-blue-300"
                            >
                              매핑 데이터 없음
                            </button>
                          )}
                        </div>
                        {!selectedHubRound ? (
                          <div className="mt-3 rounded-xl border border-dashed border-blue-200 bg-white px-3 py-2 text-sm text-slate-600">
                            라운드를 먼저 생성해야 평가자 매핑을 진행할 수 있습니다.
                          </div>
                        ) : null}
                      </div>

                      <div className="mt-4">
                        <Feedback360MailReadinessPanel
                          model={mappingMailReadiness}
                          previewOpen={mappingMailPreviewOpen}
                          resultOpen={mappingMailResultOpen}
                          onOpenPreview={() => setMappingMailPreviewOpen(true)}
                          onClosePreview={() => setMappingMailPreviewOpen(false)}
                          onOpenResult={() => setMappingMailResultOpen(true)}
                          onCloseResult={() => setMappingMailResultOpen(false)}
                        />
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-3">
                        <Feedback360MetricPill label="전체 대상자" value={`${totalHubTargetCount}명`} compact />
                        <Feedback360MetricPill label="평가자 매핑 완료" value={quarterRounds.length ? '상세 화면 확인' : '대기'} compact />
                        <Feedback360MetricPill label="익명 기준 충족" value={`${quarterAnonymityReadyCount}건`} compact />
                      </div>

                      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <div className="text-sm font-semibold text-slate-900">대상자별 진입</div>
                            <p className="mt-1 text-sm leading-6 text-slate-600">
                              후보 수와 추천 가능 여부는 대상자별 상세 화면에서 확인합니다. 후보가 있는 대상자를 우선 열고,
                              후보가 없으면 조직/관계 데이터 또는 CSV 미리보기를 확인합니다.
                            </p>
                          </div>
                          <span className="inline-flex min-h-8 shrink-0 items-center rounded-full border border-blue-100 bg-blue-50 px-3 text-xs font-semibold text-blue-700">
                            후보 수
                          </span>
                        </div>
                        <div className="mt-3 grid gap-3 lg:grid-cols-2">
                          {mappingTargetEntries.length ? (
                            mappingTargetEntries.map((entry) => (
                              <div
                                key={entry.key}
                                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                              >
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                  <div className="min-w-0">
                                    <div className="truncate text-sm font-semibold text-slate-950">{entry.targetName}</div>
                                    <div className="mt-1 text-xs font-semibold text-slate-500">{entry.organizationLabel}</div>
                                  </div>
                                  <span
                                    className={`inline-flex min-h-7 shrink-0 items-center rounded-full border px-2.5 text-xs font-semibold ${
                                      entry.needsMapping
                                        ? 'border-amber-200 bg-amber-50 text-amber-700'
                                        : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                    }`}
                                  >
                                    {entry.needsMapping ? '매핑 필요' : '매핑 확인'}
                                  </span>
                                </div>
                                <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                                  <SummaryRow label="라운드명" value={entry.roundName} />
                                  <SummaryRow label="평가 분기" value={selectedQuarterLabel} />
                                  <SummaryRow label="후보 수" value={entry.candidateCountLabel} />
                                  <SummaryRow label="현재 매핑" value={entry.mappingCountLabel} />
                                  <SummaryRow label="추천 가능 여부" value={entry.recommendationLabel} />
                                  <SummaryRow label="매핑 필요 여부" value={entry.needsMapping ? '후보 부족/검토 필요' : '확인 가능'} />
                                </div>
                                <Link
                                  href={entry.href}
                                  className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white px-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-50"
                                >
                                  {entry.needsMapping ? '후보 데이터 확인' : '대상자별 후보 확인'}
                                  <ArrowRight className="h-4 w-4" />
                                </Link>
                              </div>
                            ))
                          ) : (
                            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600 lg:col-span-2">
                              <div className="font-semibold text-slate-900">대상자별 매핑 데이터가 없습니다.</div>
                              <p className="mt-1">
                                선택한 분기에 연결된 대상자가 없어서 후보 수를 계산할 수 없습니다. 라운드와 대상자 배정이 준비되면
                                대상자별 후보 확인으로 이동할 수 있습니다.
                              </p>
                              <button
                                type="button"
                                disabled
                                className="mt-3 inline-flex min-h-10 cursor-not-allowed items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-400"
                              >
                                매핑 데이터 없음
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 grid gap-4 lg:grid-cols-2">
                        <section className="rounded-2xl border border-slate-200 bg-white p-4">
                          <div className="text-sm font-semibold text-slate-900">AI/관계 점수 추천</div>
                          <p className="mt-2 text-sm leading-6 text-slate-600">
                            같은 팀, 같은 본부, 타 본부 협업자와 프로젝트/KPI 접점, 최근 협업 기록을 함께 보며
                            관계 점수가 높은 평가자를 우선 검토합니다.
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-blue-700">
                            <span className="rounded-full bg-blue-50 px-3 py-1">같은 팀 1명</span>
                            <span className="rounded-full bg-blue-50 px-3 py-1">같은 본부 2명</span>
                            <span className="rounded-full bg-blue-50 px-3 py-1">타 본부 2명</span>
                          </div>
                          <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
                            관계 데이터 양식 다운로드와 관계 데이터 업로드 미리보기는 평가자 매핑 상세 화면에서 제공합니다.
                            후보별 관계 점수와 사용된 데이터를 확인할 수 있으며, 업로드 데이터는 현재 추천 미리보기에만 사용됩니다.
                          </div>
                        </section>

                        <section className="rounded-2xl border border-slate-200 bg-white p-4">
                          <div className="text-sm font-semibold text-slate-900">공개 범위 설정</div>
                          <p className="mt-2 text-sm leading-6 text-slate-600">
                            기본값은 공개 범위: 전체 익명입니다. 관리자는 상세 화면에서 관계별 익명/기명 기준을 확인하고,
                            기존 운영 설정 화면에서 저장 가능한 항목만 저장합니다.
                          </p>
                          <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            {['익명', '기명'].map((label) => (
                              <div
                                key={label}
                                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700"
                              >
                                {label}
                              </div>
                            ))}
                          </div>
                        </section>
                      </div>

                      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="text-sm font-semibold text-slate-900">관계 기준</div>
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          {[
                            ['본인', '본인 응답 또는 자기 인식 기준이며 후보 선택 영역에서는 자동/고정됩니다.'],
                            ['상사', '대상자의 상위 리더 또는 업무 방향을 조율한 관리자입니다.'],
                            ['동료', '같은 팀/본부 또는 협업 관계에서 상사와 팀원을 제외한 구성원입니다.'],
                            ['팀원', '대상자가 리더일 때 직접 구성원 또는 하위 조직 구성원입니다.'],
                            ['타 본부', '다른 본부 소속이면서 실제 협업 접점이 있는 구성원입니다.'],
                            ['타부서', '조직 구조에 따라 같은 본부 다른 부서 또는 다른 부서 협업자입니다.'],
                          ].map(([title, body]) => (
                            <div key={title} className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                              <div className="text-sm font-semibold text-slate-900">{title}</div>
                              <p className="mt-1 text-xs leading-5 text-slate-500">{body}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </Panel>

                    <aside className="space-y-4">
                      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <h2 className="text-base font-semibold text-slate-900">선택 분기</h2>
                        <div className="mt-4 space-y-3 text-sm">
                          <SummaryRow label="평가 분기" value={selectedQuarterLabel} />
                          <SummaryRow label="진행 라운드" value={selectedHubRound ? selectedHubRound.roundName : '없음'} />
                          <SummaryRow label="응답 진행" value={`${quarterResponseTargets.length}건`} />
                          <SummaryRow label="결과 준비" value={quarterAnonymityReadyCount ? '확인 가능' : '대기'} />
                        </div>
                      </section>

                      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">
                        <div className="font-semibold">저장 가능 여부</div>
                        <p className="mt-2">
                          이 허브 탭에는 inline 추가/삭제/저장 버튼을 만들지 않았습니다. 기존 승인된 평가자 매핑 화면에서만
                          초안 저장과 승인 요청을 진행합니다.
                        </p>
                      </section>
                    </aside>
                  </section>
                ) : null}

                {activeHubTab === 'results' ? (
                  <div className="space-y-5">
                    <Feedback360HubResultsPpt
                      profile={pptUser}
                      quarterLabel={selectedQuarterLabel}
                      roundName={selectedHubRound?.roundName ?? null}
                      detailHref={`/evaluation/360/results${hubRoundSearchSuffix ? `?${hubRoundSearchSuffix}` : ''}`}
                      targetCount={selectedHubRound?.targetCount ?? totalHubTargetCount}
                      submittedCount={selectedHubRound?.submittedCount ?? totalHubSubmittedCount}
                      responseRate={selectedHubRound?.responseRate ?? averageHubResponseRate}
                      minRaters={selectedHubRound?.minRaters ?? 0}
                      anonymityMet={Boolean(selectedHubRound && selectedHubRound.submittedCount >= selectedHubRound.minRaters)}
                      anonymityReadyCount={quarterAnonymityReadyCount}
                      categoryCount={FEEDBACK_360_RESPONSE_TAG_POOL_STATS.categoryCount}
                      positiveTagCount={FEEDBACK_360_RESPONSE_TAG_POOL_STATS.positiveTagCount}
                      improvementTagCount={FEEDBACK_360_RESPONSE_TAG_POOL_STATS.improvementTagCount}
                      categories={visibleTagPreviewCategories.map((category) => ({
                        id: category.id,
                        label: category.category,
                      }))}
                    />
                    <Feedback360MailReadinessPanel
                      model={resultsMailReadiness}
                      previewOpen={resultsMailPreviewOpen}
                      resultOpen={resultsMailResultOpen}
                      onOpenPreview={() => setResultsMailPreviewOpen(true)}
                      onClosePreview={() => setResultsMailPreviewOpen(false)}
                      onOpenResult={() => setResultsMailResultOpen(true)}
                      onCloseResult={() => setResultsMailResultOpen(false)}
                      compact
                    />
                  </div>
                ) : null}
          </div>
        </Feedback360PptAppShell>
      ) : null}

      {props.data.mode === 'nomination' && props.data.nomination && props.data.selectedRoundId ? (
        <Feedback360PptAppShell
          user={pptUser}
          activeSection="mapping"
          title="평가자 매핑 관리"
          subtitle="대상자별 평가자 후보, 공개 범위, 관계 데이터 추천 상태를 확인합니다."
          breadcrumb={['다면평가(360도)', '평가자 매핑']}
          statusLabel={props.data.nomination.workflowStatus ? getWorkflowStatusLabel(props.data.nomination.workflowStatus) : '준비 중'}
          dueLabel={selectedHubRound ? getFeedback360RemainingDaysLabel(selectedHubRound.endDate) : '일정 확인'}
          controls={pptControls}
          reportHref={buildHubHref('results')}
          sectionHrefs={pptSectionHrefs}
        >
          <ReviewerNominationPanel
            roundId={props.data.selectedRoundId}
            nomination={props.data.nomination}
            quarterLabel={selectedQuarterLabel}
            roundLabel={selectedHubRound?.roundName ?? null}
          />
        </Feedback360PptAppShell>
      ) : null}

      {props.data.mode === 'results' && props.data.results ? (
        <Feedback360PptAppShell
          user={{
            ...pptUser,
            name: props.data.results.targetEmployee.name,
            department: props.data.results.targetEmployee.department,
            position: props.data.results.targetEmployee.position,
            profileImageUrl: props.data.results.targetEmployee.profileImageUrl,
          }}
          activeSection="results"
          title="다면평가 리포트"
          subtitle="익명 기준을 충족한 실제 응답을 기준으로 태그 지표와 의견 요약을 확인합니다."
          breadcrumb={['다면평가(360도)', '리포트 조회']}
          statusLabel={props.data.results.thresholdMet ? '완료' : '준비 중'}
          dueLabel={selectedHubRound ? getFeedback360RemainingDaysLabel(selectedHubRound.endDate) : '일정 확인'}
          controls={pptControls}
          reportHref={buildHubHref('results')}
          sectionHrefs={pptSectionHrefs}
        >
        <div className="space-y-6">
          {resultVisualModel ? (
            <Feedback360PptResultReport
              results={props.data.results}
              visualModel={resultVisualModel}
              resultPresentationHighlights={resultPresentationHighlights}
              reportBusy={reportBusy}
              resultsNotice={resultsNotice}
              resultsError={resultsError}
              onGenerateReportCache={handleGenerateReportCache}
              canGenerateReport={Boolean(props.data.selectedRoundId)}
            />
          ) : null}

          <div className="hidden" aria-hidden="true">
          <Panel
            title="결과지 버전 / 공유 구성"
            description={`${props.data.results.roundName} 결과를 현재 수신자 기준으로 구성해 보여줍니다.`}
          >
            <div className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
                <div className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-3">
                    <StatCard
                      label="현재 결과지"
                      value={FEEDBACK_RESULT_PROFILE_LABELS[props.data.results.recipientProfile]}
                    />
                    <StatCard label="대상자" value={props.data.results.targetEmployee.name} />
                    <StatCard label="최종 반영 가중치" value={`${props.data.results.roundWeight}%`} />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {props.data.results.availableProfiles.map((profile) => {
                      const active = profile.value === props.data.results!.recipientProfile
                      return (
                        <Link
                          key={profile.value}
                          href={buildResultVersionHref(profile.value)}
                          className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                            active
                              ? 'border-slate-900 bg-slate-900 text-white'
                              : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {profile.label}
                        </Link>
                      )
                    })}
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    {props.data.results.summaryCards.length ? (
                      props.data.results.summaryCards.map((card) => (
                        <div key={card.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                            {card.relationshipLabel}
                          </div>
                          <div className="mt-2 text-base font-semibold text-slate-900">{card.title}</div>
                          <div className="mt-1 text-sm text-slate-500">{card.reviewerName ?? '평가자 정보 없음'}</div>
                          <div className="mt-3 space-y-2 text-sm text-slate-700">
                            <div>
                              총점:{' '}
                              <span className="font-semibold text-slate-900">
                                {card.showScore && typeof card.totalScore === 'number'
                                  ? `${card.totalScore.toFixed(1)}점`
                                  : '비공개'}
                              </span>
                            </div>
                            <div className="rounded-xl bg-white px-3 py-2 text-sm leading-6 text-slate-600">
                              {card.showComment
                                ? card.comment?.trim() || '등록된 코멘트가 없습니다.'
                                : '비공개 설정으로 코멘트를 표시하지 않습니다.'}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <EmptyBlock message="현재 결과지 버전에서 공개되는 요약 카드가 없습니다." />
                    )}
                  </div>
                </div>

                <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-semibold text-slate-900">공개 항목 요약</div>
                  <div className="space-y-2">
                    {resultPresentationHighlights.map((item, index) => (
                      <div key={`presentation:${index}:${item}`} className="rounded-xl bg-white px-3 py-2 text-sm text-slate-700">
                        {item}
                      </div>
                    ))}
                  </div>
                  <div className="pt-2">
                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm leading-6 text-slate-600">
                      결과 리포트는 화면에서 확인합니다. 별도 파일 내보내기는 제공하지 않습니다.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Panel>

          {props.data.results.managerEffectiveness?.enabled ? (
            <Panel
              title="Manager Effectiveness / 리더 코칭"
              description="리더 효과성 결과를 요약하고 다음 1:1, 성장 액션, HR 코칭 메모까지 한 화면에서 확인합니다."
            >
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-4">
                  <StatCard
                    label="종합 점수"
                    value={
                      props.data.results.managerEffectiveness.overallScore != null
                        ? props.data.results.managerEffectiveness.overallScore.toFixed(1)
                        : '미집계'
                    }
                  />
                  <StatCard
                    label="비교 평균"
                    value={
                      props.data.results.managerEffectiveness.benchmarkAverage != null
                        ? props.data.results.managerEffectiveness.benchmarkAverage.toFixed(1)
                        : '-'
                    }
                  />
                  <StatCard
                    label="평균 대비"
                    value={
                      props.data.results.managerEffectiveness.benchmarkDelta != null
                        ? `${props.data.results.managerEffectiveness.benchmarkDelta > 0 ? '+' : ''}${props.data.results.managerEffectiveness.benchmarkDelta.toFixed(1)}`
                        : '-'
                    }
                  />
                  <StatCard
                    label="리스크"
                    value={props.data.results.managerEffectiveness.riskLevel}
                  />
                </div>

                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-sm font-semibold text-slate-900">평가 조합 / 역량 축</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {props.data.results.managerEffectiveness.reviewerSummary.map((item, index) => (
                          <span
                            key={`reviewer-summary:${index}:${item}`}
                            className="inline-flex items-center rounded-full bg-white px-3 py-2 text-sm font-medium text-slate-700"
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {props.data.results.managerEffectiveness.competencyLabels.map((item, index) => (
                          <span
                            key={`competency-label:${index}:${item}`}
                            className="inline-flex items-center rounded-full border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600"
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                        <div className="text-sm font-semibold text-emerald-900">강점</div>
                        <div className="mt-3 space-y-2">
                          {props.data.results.managerEffectiveness.strengths.length ? (
                            props.data.results.managerEffectiveness.strengths.map((item, index) => (
                              <div key={`manager-strength:${index}:${item}`} className="rounded-xl bg-white px-3 py-2 text-sm text-slate-700">
                                {item}
                              </div>
                            ))
                          ) : (
                            <EmptyBlock message="아직 강점 인사이트가 충분하지 않습니다." />
                          )}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                        <div className="text-sm font-semibold text-amber-900">보완점</div>
                        <div className="mt-3 space-y-2">
                          {props.data.results.managerEffectiveness.improvements.length ? (
                            props.data.results.managerEffectiveness.improvements.map((item, index) => (
                              <div key={`manager-improvement:${index}:${item}`} className="rounded-xl bg-white px-3 py-2 text-sm text-slate-700">
                                {item}
                              </div>
                            ))
                          ) : (
                            <EmptyBlock message="아직 보완점 인사이트가 충분하지 않습니다." />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <Sparkles className="h-4 w-4 text-slate-500" />
                      코칭 팩
                    </div>

                    <div className="mt-4 space-y-4">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                          coaching points
                        </div>
                        <ul className="mt-2 space-y-2 text-sm text-slate-700">
                          {props.data.results.managerEffectiveness.coachingPack.coachingPoints.map((item, index) => (
                            <li key={`coaching-point:${index}:${item}`} className="rounded-xl bg-white px-3 py-2">
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                          next 1:1
                        </div>
                        <ul className="mt-2 space-y-2 text-sm text-slate-700">
                          {props.data.results.managerEffectiveness.coachingPack.nextOneOnOneQuestions.map((item, index) => (
                            <li key={`next-one-on-one:${index}:${item}`} className="rounded-xl bg-white px-3 py-2">
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                          growth actions
                        </div>
                        <ul className="mt-2 space-y-2 text-sm text-slate-700">
                          {props.data.results.managerEffectiveness.coachingPack.growthActions.map((item, index) => (
                            <li key={`growth-action:${index}:${item}`} className="rounded-xl bg-white px-3 py-2">
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="rounded-xl bg-white px-4 py-3 text-sm leading-6 text-slate-600">
                        {props.data.results.managerEffectiveness.coachingPack.hrMemo}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Panel>
          ) : null}

          <FeedbackReportAnalysisView
            key={`${props.data.selectedRoundId ?? 'round'}:${props.data.results.targetEmployee.id}:${props.data.results.recipientProfile}`}
            results={props.data.results}
          />

          <FeedbackThemesSection
            threshold={props.data.results.anonymityThreshold}
            feedbackCount={props.data.results.feedbackCount}
            thresholdMet={props.data.results.thresholdMet}
            anonymousSummary={props.data.results.anonymousSummary}
            strengths={props.data.results.strengths}
            improvements={props.data.results.improvements}
            textHighlights={props.data.results.textHighlights}
            aiPayload={resultsAiPayload ?? undefined}
          />

          <Panel
            title="결과 리포트 준비 / 저장 상태"
            description="리더나 운영자가 현재 집계 결과를 리포트로 준비하고, 개발 계획을 후속 체크인과 연결할 수 있습니다."
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-2 text-sm text-slate-600">
                <div>
                  결과 리포트: {props.data.results.reportCache ? `준비됨 · ${props.data.results.reportCache.generatedAt}` : '아직 준비되지 않음'}
                </div>
                <div>
                  개발 계획: {props.data.results.developmentPlanRecord ? `${props.data.results.developmentPlanRecord.title} · ${props.data.results.developmentPlanRecord.status}` : '아직 저장되지 않음'}
                </div>
              </div>
              <button
                type="button"
                onClick={handleGenerateReportCache}
                disabled={reportBusy || !props.data.selectedRoundId}
                className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
              >
                {reportBusy ? '결과 리포트 준비 중...' : props.data.results.reportCache ? '결과 리포트 다시 준비' : '결과 리포트 준비'}
              </button>
            </div>
            {resultsNotice ? (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                <div className="font-semibold">리포트 캐시가 준비되었습니다.</div>
                <div className="mt-1">{resultsNotice}</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <ActionLink href="#feedback360-results-report" label="리포트 보기" />
                  <ActionLink href={buildHubHref('results')} label="결과 탭으로 이동" />
                  {canViewFeedback360Operations ? (
                    <ActionLink href={buildHubHref('operations')} label="결과 공유 메일 준비" />
                  ) : null}
                </div>
              </div>
            ) : null}
            {resultsError ? (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                {resultsError}
              </div>
            ) : null}
          </Panel>

          <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <Panel
              title="카테고리별 응답 분포"
              description="성과/협업/리더십 등 영역별 평균 점수와 응답 수를 함께 봅니다."
            >
              <div className="space-y-3">
                {props.data.results.categoryScores.length ? (
                  props.data.results.categoryScores.map((item) => (
                    <div key={item.category} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-slate-900">{item.category}</div>
                        <div className="text-sm font-medium text-slate-700">
                          평균 {item.average} / 응답 {item.count}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyBlock message="익명 기준을 충족하면 카테고리별 응답 분포가 표시됩니다." />
                )}
              </div>
            </Panel>

            <Panel
              title="결과 연계"
              description="360 결과를 평가, 이의 신청, 체크인, 성장 계획 흐름과 연결합니다."
            >
              <div className="space-y-3">
                {props.data.results.linkage.map((item) => (
                  <div key={item.href} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-sm font-semibold text-slate-900">{item.label}</div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
                    <Link
                      href={item.href}
                      className="mt-3 inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-white"
                    >
                      이동
                    </Link>
                  </div>
                ))}
              </div>
            </Panel>
          </section>

          <FeedbackReferencePanel
            groupedResponses={props.data.results.groupedResponses}
            warnings={props.data.results.warnings}
          />

          {props.data.results.growthCopilot?.enabled && props.data.results.growthCopilot.canView ? (
            <GrowthCopilotPanel
              sourceId={`${props.data.selectedRoundId ?? 'unknown'}:${props.data.results.targetEmployee.id}:growth`}
              disclaimer={props.data.results.growthCopilot.disclaimer}
              recommendedCompetencies={props.data.results.growthCopilot.recommendedCompetencies}
              recentGoals={props.data.results.growthCopilot.recentGoals}
              recentCheckins={props.data.results.growthCopilot.recentCheckins}
              feedbackSignals={props.data.results.growthCopilot.feedbackSignals}
              aiPayload={props.data.results.growthCopilot.aiPayload}
            />
          ) : null}

          <DevelopmentPlanPreview
            employeeId={props.data.results.targetEmployee.id}
            sourceId={`${props.data.selectedRoundId ?? 'unknown'}:${props.data.results.targetEmployee.id}`}
            focusArea={props.data.results.developmentPlan.focusArea}
            actions={props.data.results.developmentPlan.actions}
            managerSupport={props.data.results.developmentPlan.managerSupport}
            nextCheckinTopics={props.data.results.developmentPlan.nextCheckinTopics}
            recommendedCompetencies={props.data.results.developmentPlan.recommendedCompetencies}
            linkedEvidence={props.data.results.developmentPlan.linkedEvidence}
            existingPlan={props.data.results.developmentPlanRecord}
            aiPayload={developmentAiPayload ?? undefined}
          />
          </div>
        </div>
        </Feedback360PptAppShell>
      ) : null}

      {props.data.mode === 'admin' ? (
        <Feedback360PptAppShell
          user={pptUser}
          activeSection="operations"
          title="360 다면평가 운영"
          subtitle="라운드, 평가자 매핑, 응답 현황, 익명 기준, 결과 공유를 관리합니다."
          breadcrumb={['다면평가(360도)', '운영 관리']}
          statusLabel="HR 운영"
          dueLabel={selectedHubRound ? getFeedback360RemainingDaysLabel(selectedHubRound.endDate) : '일정 확인'}
          controls={pptControls}
          reportHref={buildHubHref('results')}
          sectionHrefs={pptSectionHrefs}
        >
          <Feedback360AdminPanel data={props.data} />
        </Feedback360PptAppShell>
      ) : null}

      {props.data.mode === 'respond' && respondData ? (
        <Feedback360PptAppShell
          user={{
            ...pptUser,
            name: respondData.receiverName,
            department: respondData.targetProfile.departmentName,
            position: respondData.targetProfile.position ?? respondData.targetProfile.jobTitle ?? '직책 확인 필요',
            profileImageUrl: respondData.receiverProfileImageUrl,
          }}
          activeSection="response"
          title={`${respondData.receiverName} 평가하기`}
          subtitle="해시태그와 짧은 의견으로 함께 일한 경험을 남깁니다."
          breadcrumb={['다면평가(360도)', '내가 평가할 사람', respondData.receiverName]}
          statusLabel={getFeedback360ResponseStatusLabel(respondData.status)}
          dueLabel={nearestDueLabel}
          controls={pptControls}
          reportHref={buildHubHref('results')}
          sectionHrefs={pptSectionHrefs}
        >
        <div className="space-y-6">
          <section className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <GuideBadge tone="blue">함께 일한 동료</GuideBadge>
              <GuideBadge tone="emerald">해시태그 중심</GuideBadge>
              <GuideBadge tone="slate">공식 평가 점수나 등급을 자동 산정하지 않습니다</GuideBadge>
            </div>

            {respondNotice ? (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                {respondNotice}
              </div>
            ) : null}
            {respondError ? (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                {respondError}
              </div>
            ) : null}

            <div className="mt-5 grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)_340px]">
              <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
                <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="bg-slate-900 px-5 py-5 text-white">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-200">
                      평가 대상자
                    </div>
                    <div className="mt-4 flex items-center gap-4">
                      <Feedback360Avatar
                        person={{
                          name: respondData.receiverName,
                          profileImageUrl: respondData.receiverProfileImageUrl,
                        }}
                        size="xl"
                      />
                      <div className="min-w-0">
                        <div className="truncate text-2xl font-bold">{respondData.receiverName}</div>
                        <Link
                          href={`/evaluation/360/respond/${encodeURIComponent(respondData.feedbackId)}`}
                          className="mt-2 inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-blue-100"
                        >
                          프로필 보기
                        </Link>
                      </div>
                    </div>
                    <div className="mt-1 text-sm text-slate-200">
                      {respondData.targetProfile.departmentName || '소속 정보 없음'}
                      {respondData.targetProfile.position ? ` · ${respondData.targetProfile.position}` : ''}
                    </div>
                  </div>
                  <div className="space-y-4 p-5">
                    <div className="flex flex-wrap gap-2">
                      <GuideBadge tone="blue">{getFeedback360RelationshipLabel(respondData.relationship)}</GuideBadge>
                      <GuideBadge tone="slate">{getFeedback360ResponseStatusLabel(respondData.status)}</GuideBadge>
                    </div>
                    <div className="space-y-3 text-sm">
                      <SummaryRow label="함께 일한 기간" value={respondData.roundName} />
                      <SummaryRow label="협업 빈도" value="제공 데이터 없음" />
                      <SummaryRow label="주요 협업 내용" value="응답자가 사례 입력" />
                    </div>
                    <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                      <div className="text-sm font-semibold text-blue-900">평가 진행 현황</div>
                      <div className="mt-3 space-y-3 text-sm">
                        <SummaryRow label="전체 문항" value={`${respondData.questionCount}개`} />
                        <SummaryRow label="완료" value={`${answeredRespondQuestionCount}개`} />
                        <SummaryRow label="진행 중" value={respondProgressRate > 0 && respondProgressRate < 100 ? '1건' : '0건'} />
                        <SummaryRow label="미작성" value={`${Math.max(respondData.questionCount - answeredRespondQuestionCount, 0)}개`} />
                      </div>
                      <div className="mt-4">
                        <ProgressBar value={respondProgressRate} label={`${respondProgressRate}%`} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Link
                        href={buildHubHref('respond')}
                        className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-300 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        이전 사람
                      </Link>
                      {nextResponseTarget ? (
                        <Link
                          href={nextResponseTarget.href}
                          className="inline-flex min-h-10 items-center justify-center rounded-xl bg-blue-700 px-3 text-xs font-semibold text-white transition hover:bg-blue-800"
                        >
                          다음 사람
                        </Link>
                      ) : (
                        <Link
                          href={buildHubHref('respond')}
                          className="inline-flex min-h-10 items-center justify-center rounded-xl bg-slate-900 px-3 text-xs font-semibold text-white transition hover:bg-slate-800"
                        >
                          목록
                        </Link>
                      )}
                    </div>
                  </div>
                </section>
              </aside>

              <div className="space-y-5">
                <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                        평가 관리 &gt; 360 다면평가
                      </div>
                      <h2 className="mt-2 text-xl font-semibold text-slate-950">
                        {respondData.receiverName}님 평가하기
                      </h2>
                      <p className="mt-1 text-sm text-slate-600">
                        반복적으로 관찰된 행동과 구체적인 상황 중심으로 선택해 주세요.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <GuideBadge tone="blue">{getFeedback360RelationshipLabel(respondData.relationship)}</GuideBadge>
                      <GuideBadge tone="slate">{getFeedback360ResponseStatusLabel(respondData.status)}</GuideBadge>
                    </div>
                  </div>
                </section>

                <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <Feedback360MetricPill
                    icon={<Users className="h-4 w-4" />}
                    label="전체 대상자"
                    value="1명"
                    detail={respondData.receiverName}
                  />
                  <Feedback360MetricPill
                    icon={<ClipboardCheck className="h-4 w-4" />}
                    label="응답 완료"
                    value={respondData.status === 'SUBMITTED' ? '1명' : '0명'}
                    detail="기존 제출 상태 기준"
                  />
                  <Feedback360MetricPill
                    icon={<CircleDotDashed className="h-4 w-4" />}
                    label="작성 중"
                    value={respondData.status === 'IN_PROGRESS' ? '1명' : '0명'}
                    detail={`${respondProgressRate}% 입력`}
                  />
                  <Feedback360MetricPill
                    icon={<AlertTriangle className="h-4 w-4" />}
                    label="미작성"
                    value={respondData.status === 'PENDING' ? '1명' : '0명'}
                    detail="제출 전 확인"
                    tone="amber"
                  />
                </section>

                <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <div className="grid gap-0 md:grid-cols-[minmax(0,1fr)_160px_120px_120px]">
                    <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-500">
                      평가 대상자
                    </div>
                    <div className="hidden border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-500 md:block">
                      관계
                    </div>
                    <div className="hidden border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-500 md:block">
                      선택 태그
                    </div>
                    <div className="hidden border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-500 md:block">
                      제출 상태
                    </div>
                    <div className="bg-blue-50 px-4 py-3">
                      <div className="font-semibold text-slate-950">{respondData.receiverName}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {respondData.targetProfile.departmentName || '소속 정보 없음'}
                        {respondData.targetProfile.position ? ` · ${respondData.targetProfile.position}` : ''}
                      </div>
                    </div>
                    <div className="hidden bg-blue-50 px-4 py-3 text-sm text-slate-700 md:block">
                      {getFeedback360RelationshipLabel(respondData.relationship)}
                    </div>
                    <div className="hidden bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700 md:block">
                      {selectedResponseTagLabels.length}개
                    </div>
                    <div className="hidden bg-blue-50 px-4 py-3 text-sm font-semibold text-slate-700 md:block">
                      {getFeedback360ResponseStatusLabel(respondData.status)}
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4 text-sm text-blue-900">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                    <div className="space-y-1">
                      <p className="font-semibold">다면평가는 동료 협업 경험을 보완적으로 참고하기 위한 자료입니다.</p>
                      <p>공식 평가 점수나 등급을 자동 산정하지 않습니다. 1회성 사례보다 반복적으로 관찰된 행동을 중심으로 참고합니다.</p>
                    </div>
                  </div>
                </section>

                <section className="space-y-4">
                  <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-900">
                    <div className="font-semibold">해시태그를 선택하면 평가에 반영됩니다.</div>
                    <p className="mt-1">
                      긍정 태그는 최대 3개, 보완 태그는 최대 2개를 권장합니다. 강점은 파란색/초록색, 보완점은 노란색/붉은색으로 구분됩니다.
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                        <Hash className="h-4 w-4 text-blue-600" />
                        해시태그 평가 영역
                      </div>
                      <p className="mt-1 text-sm text-slate-500">
                        긍정 태그와 보완 태그를 여러 개 선택하고, 필요한 경우 짧은 의견만 남겨주세요.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                        {completedResponseTagCategoryCount}/{visibleResponseTagCategories.length}개 항목 선택
                      </div>
                      <div className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                        기본 해시태그 풀 {FEEDBACK_360_RESPONSE_TAG_POOL_STATS.categoryCount}개 항목
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                    <div className="mb-2 text-xs font-semibold text-slate-500">카테고리 선택</div>
                    <div className="flex flex-wrap gap-2" aria-label="해시태그 카테고리 선택">
                      {visibleResponseTagCategories.map((category) => {
                        const selectedCategoryTags = selectedResponseTags[category.id]
                        const positiveSelectedCount = selectedCategoryTags?.positive?.length ?? 0
                        const improvementSelectedCount = selectedCategoryTags?.improvement?.length ?? 0
                        const active = activeResponseTagCategory?.id === category.id

                        return (
                          <button
                            key={category.id}
                            type="button"
                            onClick={() => setActiveResponseTagCategoryId(category.id)}
                            className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-3 text-sm font-semibold transition ${
                              active
                                ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
                                : 'border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50'
                            }`}
                            aria-pressed={active}
                          >
                            <span>{category.category}</span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[11px] ${
                                active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                              }`}
                            >
                              긍정 {positiveSelectedCount} / 보완 {improvementSelectedCount}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {activeResponseTagCategory ? (
                    <Feedback360TagCategoryCard
                      key={activeResponseTagCategory.id}
                      category={activeResponseTagCategory}
                      selectedTags={selectedResponseTags}
                      onToggle={toggleResponseTag}
                    />
                  ) : null}
                </section>

                {respondData.priorScoreSummary || respondData.ratingGuide ? (
                  <RespondReferenceSummary
                    targetProfile={respondData.targetProfile}
                    priorScoreSummary={respondData.priorScoreSummary}
                  />
                ) : null}

                {respondData.roleGuide ? <RespondRoleGuideCard roleGuide={respondData.roleGuide} /> : null}

                <section className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                    <MessageSquareText className="h-4 w-4 text-blue-600" />
                    최소 점수/정성 평가
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    기존 라운드 문항은 그대로 유지하고, 긴 서술보다 필요한 점수와 구체적 사례만 짧게 남깁니다.
                  </p>

                  <div className="mt-4 space-y-4">
                    {respondData.questions.map((question) => (
                      <div key={question.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700">
                            {question.category}
                          </span>
                          {question.isRequired ? (
                            <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-medium text-rose-700">
                              필수
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-3 text-sm font-semibold text-slate-900">{question.questionText}</div>

                        {respondData.ratingGuide?.questionId === question.id ? (
                          <RespondRatingGuideCard
                            ratingGuide={respondData.ratingGuide}
                            priorScoreSummary={respondData.priorScoreSummary}
                            targetProfile={respondData.targetProfile}
                            scaleEntries={respondRatingGuideEntries}
                            limitExceeded={distributionLimitExceeded}
                          />
                        ) : null}

                        {question.questionType === 'RATING_SCALE' ? (
                          <div className="mt-4 grid grid-cols-5 gap-2">
                            {Array.from(
                              {
                                length:
                                  (question.scaleMax ?? 5) - (question.scaleMin ?? 1) + 1,
                              },
                              (_, index) => (question.scaleMin ?? 1) + index
                            ).map((value) => (
                              <button
                                key={value}
                                type="button"
                                onClick={() => updateQuestion(question.id, { ratingValue: value })}
                                className={`min-h-11 rounded-xl border text-sm font-semibold transition ${
                                  questionState[question.id]?.ratingValue === value
                                    ? 'border-slate-900 bg-slate-900 text-white'
                                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                                }`}
                              >
                                {value}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <textarea
                            value={questionState[question.id]?.textValue ?? ''}
                            onChange={(event) => updateQuestion(question.id, { textValue: event.target.value })}
                            className="mt-4 min-h-24 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400"
                            placeholder="구체적 사례와 반복적으로 관찰된 행동을 짧게 작성해 주세요."
                          />
                        )}
                        {questionErrorMessages[question.id] ? (
                          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                            {questionErrorMessages[question.id]}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </section>

                <label className="block rounded-2xl border border-slate-200 bg-white p-4">
                  <span className="text-sm font-semibold text-slate-900">구체적 사례 / 종합 의견 / 보완하면 좋을 점</span>
                  <p className="mt-1 text-sm text-slate-500">
                    선택한 태그를 뒷받침하는 상황, 반복적으로 관찰된 행동, 보완하면 좋을 점을 짧게 남겨주세요.
                    태그 요약은 제출 시 종합 의견의 {FEEDBACK_360_TAG_SUMMARY_HEADING} 섹션으로 함께 반영됩니다.
                  </p>
                  <div className="mt-3 grid gap-2 text-xs font-semibold sm:grid-cols-3">
                    <span className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-blue-700">구체적 사례</span>
                    <span className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-amber-700">보완하면 좋을 점</span>
                    <span className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700">종합 의견</span>
                  </div>
                  <textarea
                    value={overallComment}
                    onChange={(event) => setOverallComment(event.target.value)}
                    className="mt-3 min-h-28 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400"
                    placeholder="예: 프로젝트 일정 조율 과정에서 필요한 정보를 먼저 공유해 협업이 원활했어요."
                  />
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                    <span>태그 포함 제출 데이터 {overallCommentForSubmit.length}/{FEEDBACK_360_OVERALL_COMMENT_MAX_LENGTH}자</span>
                    <span>선택 태그는 공식 점수/등급 산정에 사용되지 않습니다.</span>
                  </div>
                </label>
              </div>

              <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-slate-950">선택한 태그</h3>
                      <p className="mt-1 text-sm text-slate-500">제출 전 선택 현황과 작성 상태를 확인합니다.</p>
                    </div>
                    <BadgeCheck className="h-5 w-5 text-blue-600" />
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <Feedback360MetricPill label="긍정 태그" value={`${selectedPositiveTagCount}개`} compact />
                    <Feedback360MetricPill label="보완 태그" value={`${selectedImprovementTagCount}개`} compact tone="amber" />
                    <Feedback360MetricPill label="전체 선택" value={`${selectedResponseTagLabels.length}개`} compact />
                    <Feedback360MetricPill label="코멘트" value={overallComment.trim() ? '작성' : '미작성'} compact />
                    <Feedback360MetricPill label="제출 상태" value={getFeedback360ResponseStatusLabel(respondData.status)} compact />
                  </div>

                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
                    선택 제한 없음. 선택 태그 요약은 처음 10개를 먼저 보여주고, 초과분은 외 N개 더보기로 확인합니다.
                  </div>

                  <div className="mt-4 space-y-2">
                    {selectedResponseTagLabels.length ? (
                      <>
                        <div className="max-h-44 overflow-y-auto pr-1">
                          {visibleSelectedResponseTagLabels.map((tag) => (
                            <span
                              key={`${tag.category}:${tag.id}`}
                              className={`mb-2 mr-2 inline-flex rounded-full border px-3 py-1.5 text-xs font-semibold ${
                                tag.tone === 'positive'
                                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                  : 'border-amber-200 bg-amber-50 text-amber-700'
                              }`}
                            >
                              {tag.label}
                            </span>
                          ))}
                        </div>
                        {hiddenSelectedTagCount > 0 ? (
                          <button
                            type="button"
                            onClick={() => setSelectedTagSummaryExpanded((current) => !current)}
                            className="inline-flex min-h-9 items-center justify-center rounded-xl border border-slate-300 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                            aria-label="외 N개 더보기"
                          >
                            {selectedTagSummaryExpanded ? '접기' : `외 ${hiddenSelectedTagCount}개 더보기`}
                          </button>
                        ) : null}
                      </>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                        아직 선택한 태그가 없습니다. 왼쪽에서 긍정 태그와 보완 태그를 골라주세요.
                      </div>
                    )}
                  </div>

                  <div className="mt-4 space-y-2">
                    <div className="text-xs font-semibold text-slate-500">카테고리별 선택 현황</div>
                    {selectedTagCategorySummaries.length ? (
                      selectedTagCategorySummaries.map((category) => (
                        <SummaryRow
                          key={category.id}
                          label={category.label}
                          value={`긍정 ${category.positive}개 · 보완 ${category.improvement}개`}
                        />
                      ))
                    ) : (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                        아직 선택된 카테고리가 없습니다.
                      </div>
                    )}
                  </div>

                  {respondNotice ? (
                    <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold">응답이 제출되었습니다.</div>
                          <p className="mt-1 leading-6">
                            {nextResponseTarget
                              ? '다음 미응답 대상자가 있습니다. 이어서 작성하거나 응답 목록으로 돌아갈 수 있습니다.'
                              : '이번 분기 다면평가 응답을 모두 완료했습니다. 결과는 익명 기준 충족 후 확인할 수 있습니다.'}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setRespondNotice('')}
                          className="rounded-lg px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                        >
                          닫기
                        </button>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {nextResponseTarget ? (
                          <Link
                            href={nextResponseTarget.href}
                            className="inline-flex min-h-10 items-center justify-center rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800"
                          >
                            다음 대상자 작성
                          </Link>
                        ) : null}
                        <Link
                          href={buildHubHref('respond')}
                          className="inline-flex min-h-10 items-center justify-center rounded-xl border border-emerald-300 bg-white px-4 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
                        >
                          응답 목록으로 돌아가기
                        </Link>
                        {selectedHubRound && selectedHubRound.submittedCount >= selectedHubRound.minRaters ? (
                          <Link
                            href={buildHubHref('results')}
                            className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                          >
                            360 결과 확인
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  {respondError ? (
                    <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold">입력 내용을 확인해 주세요.</div>
                          <p className="mt-1 leading-6">{respondError}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setRespondError('')}
                          className="rounded-lg px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                        >
                          닫기
                        </button>
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs leading-5 text-blue-800">
                    선택한 태그는 새 입력 항목이 아니라 기존 다면평가 제출 데이터의 종합 의견에
                    {' '}
                    <span className="font-semibold">{FEEDBACK_360_TAG_SUMMARY_HEADING}</span>
                    {' '}
                    섹션으로 함께 반영됩니다. 저장되는 척하는 장식 태그가 아니며, 점수/등급은 자동 산정하지 않습니다.
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="text-base font-semibold text-slate-950">제출 요약</h3>
                  <div className="mt-4 space-y-3 text-sm">
                    <SummaryRow label="평가 대상자" value={respondData.receiverName} />
                    <SummaryRow label="선택 완료 항목" value={`${completedResponseTagCategoryCount}/${visibleResponseTagCategories.length}`} />
                    <SummaryRow
                      label="태그 제출 반영"
                      value={selectedResponseTagLabels.length ? '종합 의견에 함께 반영' : '선택 태그 없음'}
                    />
                    <SummaryRow label="문항 입력" value={`${answeredRespondQuestionCount}/${respondData.questionCount}`} />
                    <SummaryRow label="진행률" value={`${respondProgressRate}%`} />
                    <SummaryRow label="공식 점수/등급" value="자동 산정 없음" />
                  </div>

                  <div className="mt-5 flex flex-col gap-3">
                    <button
                      type="button"
                      disabled
                      title="임시 저장 기능은 현재 응답 작성 중에만 사용할 수 있습니다."
                      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-slate-100 px-5 text-sm font-semibold text-slate-400"
                    >
                      임시 저장
                    </button>
                    <button
                      type="button"
                      onClick={handleSubmitResponse}
                      disabled={submitBusy || distributionLimitExceeded}
                      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {submitBusy ? '응답 제출 중...' : '응답 제출'}
                    </button>
                    <Link
                      href="/evaluation/360"
                      className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-slate-300 px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      360 개요로 돌아가기
                    </Link>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    기존 제출 흐름만 사용합니다. 이 화면은 공식 점수/등급 저장을 수행하지 않습니다.
                  </p>
                </section>

                <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  <div className="font-semibold">비정기 다면평가 안내</div>
                  <ul className="mt-2 space-y-1 leading-5">
                    <li>협업 이슈가 발생했을 때 수시로 기록할 수 있습니다.</li>
                    <li>1회성 사례보다 반복적으로 관찰된 행동을 중심으로 참고합니다.</li>
                    <li>정기 다면평가 결과와 함께 종합 참고됩니다.</li>
                  </ul>
                </section>

                <FeedbackRespondReferencePanel
                  key={`${respondData.feedbackId}:${props.data.selectedRoundId ?? ''}`}
                  reference={respondData.reference}
                />
              </aside>
            </div>
          </section>
        </div>
        </Feedback360PptAppShell>
      ) : null}
      {riskDialog}
    </div>
  )
}

function Panel(props: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-slate-900">{props.title}</h2>
        <p className="mt-1 text-sm text-slate-500">{props.description}</p>
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

function EmptyBlock(props: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
      {props.message}
    </div>
  )
}

function StatCard(props: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{props.label}</div>
      <div className="mt-2 text-lg font-semibold text-slate-900">{props.value}</div>
    </div>
  )
}

function ProgressBar(props: { value: number; label: string }) {
  const value = Math.max(0, Math.min(100, Math.round(props.value)))

  return (
    <div>
      <div className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-500">
        <span>진행률</span>
        <span className="text-slate-800">{props.label}</span>
      </div>
      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-blue-700 transition-all"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  )
}

function Feedback360MetricPill(props: {
  icon?: React.ReactNode
  label: string
  value: string
  detail?: string
  tone?: 'slate' | 'amber'
  compact?: boolean
}) {
  const toneClassName =
    props.tone === 'amber'
      ? 'border-amber-200 bg-amber-50 text-amber-800'
      : 'border-slate-200 bg-white text-slate-900'

  return (
    <div className={`rounded-2xl border px-4 py-3 ${toneClassName}`}>
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
        {props.icon}
        <span>{props.label}</span>
      </div>
      <div className={`${props.compact ? 'mt-1 text-lg' : 'mt-2 text-xl'} font-bold text-slate-950`}>
        {props.value}
      </div>
      {props.detail ? <div className="mt-1 truncate text-xs text-slate-500">{props.detail}</div> : null}
    </div>
  )
}

function Feedback360TagCategoryCard(props: {
  category: Feedback360ResponseTagCategory
  selectedTags: SelectedResponseTags
  onToggle: (categoryId: string, tone: Feedback360ResponseTagTone, tagId: string) => void
}) {
  const positiveSelectedCount = props.selectedTags[props.category.id]?.positive?.length ?? 0
  const improvementSelectedCount = props.selectedTags[props.category.id]?.improvement?.length ?? 0

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-slate-950">{props.category.category}</h3>
            {props.category.audience === 'leader' ? <GuideBadge tone="slate">리더/PM 전용</GuideBadge> : null}
          </div>
          <p className="mt-1 text-sm text-slate-500">{props.category.description}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-semibold">
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">
            긍정 최대 3개 선택 ({positiveSelectedCount})
          </span>
          <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700">
            보완 최대 2개 선택 ({improvementSelectedCount})
          </span>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        <Feedback360TagGroup
          title="긍정 태그"
          tone="positive"
          tags={props.category.positiveTags}
          categoryId={props.category.id}
          selectedTags={props.selectedTags}
          onToggle={props.onToggle}
        />
        <Feedback360TagGroup
          title="보완 태그"
          tone="improvement"
          tags={props.category.improvementTags}
          categoryId={props.category.id}
          selectedTags={props.selectedTags}
          onToggle={props.onToggle}
        />
      </div>
    </article>
  )
}

function Feedback360TagGroup(props: {
  title: string
  tone: Feedback360ResponseTagTone
  tags: Feedback360ResponseTag[]
  categoryId: string
  selectedTags: SelectedResponseTags
  onToggle: (categoryId: string, tone: Feedback360ResponseTagTone, tagId: string) => void
}) {
  return (
    <div>
      <div className="mb-2 text-sm font-semibold text-slate-800">{props.title}</div>
      <div className="flex flex-wrap gap-2">
        {props.tags.map((tag) => {
          const selected = isFeedback360ResponseTagSelected(
            props.selectedTags,
            props.categoryId,
            props.tone,
            tag.id
          )
          const selectedClassName =
            props.tone === 'positive'
              ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
              : 'border-amber-500 bg-amber-50 text-amber-800'
          const defaultClassName =
            props.tone === 'positive'
              ? 'border-emerald-100 bg-white text-slate-700 hover:bg-emerald-50'
              : 'border-amber-100 bg-white text-slate-700 hover:bg-amber-50'

          return (
            <button
              key={tag.id}
              type="button"
              onClick={() => props.onToggle(props.categoryId, props.tone, tag.id)}
              className={`min-h-10 rounded-full border px-3 py-2 text-sm font-medium transition ${
                selected ? selectedClassName : defaultClassName
              }`}
              aria-pressed={selected}
            >
              {tag.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function SummaryRow(props: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2 last:border-0 last:pb-0">
      <span className="text-slate-500">{props.label}</span>
      <span className="font-semibold text-slate-950">{props.value}</span>
    </div>
  )
}

function RespondReferenceSummary(props: {
  targetProfile: RespondData['targetProfile']
  priorScoreSummary?: RespondPriorScoreSummary
}) {
  const profileItems = [
    props.targetProfile.departmentName,
    props.targetProfile.role,
    props.targetProfile.position,
    props.targetProfile.jobTitle,
    props.targetProfile.teamName,
  ].filter(Boolean)

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Info className="h-4 w-4 text-blue-500" />
          대상자 인사 정보
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {profileItems.length ? (
            profileItems.map((item, index) => (
              <span
                key={`profile:${index}:${item}`}
                className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700"
              >
                {item}
              </span>
            ))
          ) : (
            <span className="text-sm text-slate-500">등급 가이드를 연결할 인사 정보가 아직 없습니다.</span>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Sparkles className="h-4 w-4 text-amber-500" />
          이전 차수 종합 점수 참고
        </div>
        {props.priorScoreSummary ? (
          <>
            <div className="mt-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                  {props.priorScoreSummary.authorLabel}
                </div>
                <div className="mt-2 text-2xl font-semibold text-slate-900">
                  {props.priorScoreSummary.totalScore.toFixed(1)}점
                </div>
              </div>
              {props.priorScoreSummary.submittedAt ? (
                <div className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
                  {props.priorScoreSummary.submittedAt}
                </div>
              ) : null}
            </div>
            <p className="mt-3 text-sm text-slate-600">
              앞선 차수 또는 선행 평가자의 종합 점수를 참고해 현재 등급과 코멘트를 더 일관되게 작성할 수 있습니다.
            </p>
          </>
        ) : (
          <p className="mt-3 text-sm text-slate-500">
            현재 라운드에서 참고할 이전 종합 점수가 아직 없습니다.
          </p>
        )}
      </div>
    </div>
  )
}

function RespondRoleGuideCard(props: { roleGuide: RespondRoleGuide }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-amber-50 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <Sparkles className="h-4 w-4 text-amber-500" />
        직무/직급 가이드
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="rounded-full border border-amber-200 bg-white px-3 py-1 text-xs font-medium text-amber-700">
          {props.roleGuide.label}
        </span>
        {props.roleGuide.jobFamily ? (
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700">
            {props.roleGuide.jobFamily}
          </span>
        ) : null}
        {props.roleGuide.level ? (
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700">
            {props.roleGuide.level}
          </span>
        ) : null}
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{props.roleGuide.guideText}</p>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <GuideListCard
          title="기대 역량"
          items={props.roleGuide.expectedCompetencies}
          emptyMessage="등록된 기대 역량이 없습니다."
        />
        <GuideListCard
          title="다음 레벨 기대"
          items={props.roleGuide.nextLevelExpectations}
          emptyMessage="다음 레벨 기대가 아직 없습니다."
        />
        <GuideListCard
          title="추천 목표 라이브러리"
          items={props.roleGuide.goalLibrary}
          emptyMessage="연결된 목표 라이브러리가 없습니다."
        />
      </div>
    </div>
  )
}

function GuideListCard(props: { title: string; items: string[]; emptyMessage: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="text-sm font-semibold text-slate-900">{props.title}</div>
      <div className="mt-3 space-y-2">
        {props.items.length ? (
          props.items.map((item, index) => (
            <div key={`guide:${index}:${item}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {item}
            </div>
          ))
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
            {props.emptyMessage}
          </div>
        )}
      </div>
    </div>
  )
}

function RespondRatingGuideCard(props: {
  ratingGuide: RespondRatingGuide
  priorScoreSummary?: RespondPriorScoreSummary
  targetProfile: RespondData['targetProfile']
  scaleEntries: Array<RespondRatingGuide['scaleEntries'][number] & { displayCurrentCount: number }>
  limitExceeded: boolean
}) {
  const profileSummary =
    props.ratingGuide.targetProfileLabel ||
    [
      props.targetProfile.departmentName,
      props.targetProfile.position,
      props.targetProfile.jobTitle,
      props.targetProfile.teamName,
    ]
      .filter(Boolean)
      .join(' · ')

  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Sparkles className="h-4 w-4 text-amber-500" />
            등급 가이드
          </div>
          <p className="mt-1 text-sm text-slate-500">{props.ratingGuide.distributionModeDescription}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <GuideBadge tone="blue">{props.ratingGuide.distributionModeLabel}</GuideBadge>
          <GuideBadge tone="slate">{props.ratingGuide.distributionScopeLabel}</GuideBadge>
        </div>
      </div>

      {props.ratingGuide.matchedRule ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="text-sm font-semibold text-amber-900">{props.ratingGuide.matchedRule.headline}</div>
          <p className="mt-2 whitespace-pre-line text-sm leading-6 text-amber-900/90">
            {props.ratingGuide.matchedRule.guidance}
          </p>
          <div className="mt-3 text-xs font-medium text-amber-700">
            적용 가이드: {props.ratingGuide.matchedRule.label}
            {profileSummary ? ` · ${profileSummary}` : ''}
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          대상자의 조직/역할 정보에 맞는 별도 가이드가 없어서 기본 등급 설명을 보여드립니다.
        </div>
      )}

      {props.priorScoreSummary ? (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">앞선 차수 종합 점수</div>
          <div className="mt-2 text-sm font-semibold text-slate-900">
            {props.priorScoreSummary.authorLabel} · {props.priorScoreSummary.totalScore.toFixed(1)}점
          </div>
        </div>
      ) : null}

      {props.limitExceeded ? (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4" />
            등급 배분 가이드의 제한 인원을 초과했습니다. 가이드를 확인해 주세요.
          </div>
        </div>
      ) : null}

      <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">등급명</th>
              {props.ratingGuide.distributionMode === 'RATIO' ? (
                <th className="px-4 py-3 text-left font-semibold">배분 비율</th>
              ) : null}
              {props.ratingGuide.distributionMode === 'RATIO' ? (
                <th className="px-4 py-3 text-left font-semibold">권장 인원</th>
              ) : null}
              {props.ratingGuide.distributionMode === 'HEADCOUNT' ? (
                <th className="px-4 py-3 text-left font-semibold">제한 인원</th>
              ) : null}
              <th className="px-4 py-3 text-left font-semibold">현재 인원</th>
            </tr>
          </thead>
          <tbody>
            {props.scaleEntries.map((entry) => {
              const exceedsLimit =
                props.ratingGuide.distributionMode === 'HEADCOUNT' &&
                entry.headcountLimit != null &&
                !entry.isNonEvaluative &&
                entry.displayCurrentCount > entry.headcountLimit

              return (
                <tr key={entry.value} className="border-t border-slate-200">
                  <td className="px-4 py-3 align-top">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-900">{entry.label}</span>
                      {entry.isHighest ? <GuideBadge tone="emerald">가장 높은 등급</GuideBadge> : null}
                      {entry.isLowest ? <GuideBadge tone="blue">가장 낮은 등급</GuideBadge> : null}
                      {entry.isNonEvaluative ? <GuideBadge tone="slate">비평가 등급</GuideBadge> : null}
                    </div>
                    {entry.description ? (
                      <div className="mt-2 whitespace-pre-line text-xs leading-5 text-slate-500">
                        {entry.description}
                      </div>
                    ) : null}
                  </td>
                  {props.ratingGuide.distributionMode === 'RATIO' ? (
                    <td className="px-4 py-3 text-slate-700">
                      {entry.targetRatio != null ? `${entry.targetRatio}%` : '-'}
                    </td>
                  ) : null}
                  {props.ratingGuide.distributionMode === 'RATIO' ? (
                    <td className="px-4 py-3 text-slate-700">
                      {entry.recommendedCount != null ? `${entry.recommendedCount}명` : '-'}
                    </td>
                  ) : null}
                  {props.ratingGuide.distributionMode === 'HEADCOUNT' ? (
                    <td className="px-4 py-3 text-slate-700">
                      {entry.isNonEvaluative ? '-' : entry.headcountLimit != null ? `${entry.headcountLimit}명` : '-'}
                    </td>
                  ) : null}
                  <td className={`px-4 py-3 font-semibold ${exceedsLimit ? 'text-rose-600' : 'text-slate-700'}`}>
                    {entry.displayCurrentCount}명
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function GuideBadge(props: { children: React.ReactNode; tone: 'slate' | 'blue' | 'emerald' }) {
  const toneClassName =
    props.tone === 'emerald'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : props.tone === 'blue'
        ? 'border-blue-200 bg-blue-50 text-blue-700'
        : 'border-slate-200 bg-slate-100 text-slate-700'

  return (
    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${toneClassName}`}>
      {props.children}
    </span>
  )
}
