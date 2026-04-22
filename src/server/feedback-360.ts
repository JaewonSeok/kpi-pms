import type {
  DevelopmentPlanStatus,
  FeedbackAdminReviewScope,
  FeedbackDocumentKind,
  FeedbackNominationStatus,
  FeedbackRoundStatus,
  FeedbackRoundType,
  FeedbackStatus,
  KpiStatus,
  Prisma,
  QuestionType,
  RaterRelationship,
  SystemRole,
} from '@prisma/client'
import type { Session } from 'next-auth'
import type { FeedbackAnytimeDocumentSettings } from '@/lib/feedback-anytime-review'
import { calculateFeedbackResponseTotalScore } from '@/lib/feedback-score'
import {
  getFeedbackAnytimeDocumentKindLabel,
  parseFeedbackAnytimeDocumentSettings,
} from '@/lib/feedback-anytime-review'
import type {
  FeedbackReportAnalysisPayload,
  FeedbackReportAnalysisSettings,
} from '@/lib/feedback-report-analysis'
import {
  buildFeedbackReportAnalysis,
  parseFeedbackReportAnalysisSettings,
} from '@/lib/feedback-report-analysis'
import type {
  FeedbackRatingDistributionMode,
  FeedbackRatingDistributionScope,
  FeedbackRatingGuideSettings,
} from '@/lib/feedback-rating-guide'
import {
  annotateFeedbackRatingScaleEntries,
  buildFeedbackRatingGuideDescriptionMap,
  calculateFeedbackRatingRecommendedCount,
  describeFeedbackRatingDistributionMode,
  describeFeedbackRatingDistributionScope,
  parseFeedbackRatingGuideSettings,
  resolveFeedbackRatingGuideRule,
} from '@/lib/feedback-rating-guide'
import {
  resolveFeedbackRoleGuide,
  type FeedbackAiCopilotSettings,
  type FeedbackSkillArchitectureSettings,
} from '@/lib/feedback-skill-architecture'
import type {
  FeedbackManagerEffectivenessSettings,
  ManagerEffectivenessCoachingPack,
  ManagerEffectivenessRiskLevel,
} from '@/lib/feedback-manager-effectiveness'
import {
  buildManagerEffectivenessCoachingPack,
  getManagerEffectivenessReviewerSummary,
  getManagerEffectivenessRiskLevel,
  isManagerEffectivenessTarget,
} from '@/lib/feedback-manager-effectiveness'
import type {
  FeedbackResultPresentationSettings,
  FeedbackResultRecipientProfile,
  FeedbackResultVersionConfig,
} from '@/lib/feedback-result-presentation'
import {
  FEEDBACK_RESULT_PROFILE_LABELS,
  parseFeedbackResultPresentationSettings,
  resolveFeedbackResultPresentationProfile,
} from '@/lib/feedback-result-presentation'
import {
  calculateDevelopmentPlanProgress,
  normalizeDevelopmentPlanActionItems,
  normalizeDevelopmentPlanLinkedEvidence,
  normalizeDevelopmentPlanStringArray,
  type DevelopmentPlanActionItem,
  type DevelopmentPlanLinkedEvidence,
} from '@/lib/development-plan'
import { formatGoalWeightLabel } from '@/lib/goal-display'
import { prisma } from '@/lib/prisma'
import { formatDate } from '@/lib/utils'
import {
  FEEDBACK_ADMIN_SCOPE_LABELS,
  buildFeedbackReviewAdminAccess,
  getCollaboratorRoundIds,
  getFeedbackReviewAdminAccess,
} from './feedback-360-access'
import {
  canApproveFeedbackTarget,
  getNominationAggregateStatus,
  parseFeedbackSelectionSettings,
  parseFeedbackVisibilitySettings,
  parsePersistedReportPayload,
} from './feedback-360-workflow'
import { resolveFeedbackResultPrimaryLeaderId } from './feedback-360-admin'
import { getOnboardingReviewAdminSnapshot } from './onboarding-review-workflow'

export type Feedback360RouteMode = 'overview' | 'nomination' | 'results' | 'admin' | 'respond'

export type Feedback360PageState = 'ready' | 'empty' | 'permission-denied' | 'error'

type FeedbackRoleGuideViewModel = {
  label: string
  jobFamily?: string
  level?: string
  guideText: string
  expectedCompetencies: string[]
  nextLevelExpectations: string[]
  goalLibrary: string[]
}

type FeedbackGrowthCopilotViewModel = {
  enabled: boolean
  canView: boolean
  disclaimer: string
  roleGuideLabel?: string
  recommendedCompetencies: string[]
  recentGoals: string[]
  recentCheckins: string[]
  feedbackSignals: string[]
  aiPayload?: Record<string, unknown>
}

export type Feedback360PageData = {
  mode: Feedback360RouteMode
  state: Feedback360PageState
  message?: string
  currentUser?: {
    id: string
    name: string
    role: SystemRole
    department: string
  }
  permissions?: {
    canManageRounds: boolean
    canSubmitNomination: boolean
    canViewAdmin: boolean
    canViewResults: boolean
    canRespond: boolean
  }
  availableCycles: Array<{
    id: string
    name: string
    year: number
    status: string
  }>
  selectedCycleId?: string
  availableRounds: Array<{
    id: string
    roundName: string
    roundType: FeedbackRoundType
    documentKind?: FeedbackDocumentKind | null
    documentKindLabel?: string | null
    createdById?: string | null
    documentSettings?: FeedbackAnytimeDocumentSettings
    status: FeedbackRoundStatus
    isAnonymous: boolean
    minRaters: number
    folderId?: string | null
    folderName?: string | null
    selectionSettings: {
      requireLeaderApproval: boolean
      allowPreferredPeers: boolean
      excludeLeaderFromPeerSelection: boolean
      excludeDirectReportsFromPeerSelection: boolean
      managerEffectiveness: FeedbackManagerEffectivenessSettings
      skillArchitecture: FeedbackSkillArchitectureSettings
      aiCopilot: FeedbackAiCopilotSettings
    }
    visibilitySettings: Record<string, 'FULL' | 'ANONYMOUS' | 'PRIVATE'>
    resultPresentationSettings: FeedbackResultPresentationSettings
    reportAnalysisSettings: FeedbackReportAnalysisSettings
    ratingGuideSettings: FeedbackRatingGuideSettings
    startDate: string
    endDate: string
    targetCount: number
    submittedCount: number
    responseRate: number
    questions: Array<{
      id: string
      category: string
      questionText: string
      questionType: QuestionType
      scaleMin?: number | null
      scaleMax?: number | null
    }>
    collaborators: Array<{
      employeeId: string
      name: string
      departmentName: string
      canReadContent: boolean
    }>
  }>
  selectedRoundId?: string
  summary: {
    activeRounds: number
    pendingResponses: number
    submittedResponses: number
    averageResponseRate: number
    anonymityReadyCount: number
  }
  pendingRequests?: Array<{
    feedbackId: string
    roundId: string
    roundName: string
    receiverId: string
    receiverName: string
    relationship: string
    dueDate: string
    href: string
  }>
  nomination?: {
    targetEmployee: {
      id: string
      name: string
      department: string
      position: string
    }
    savedDraftCount: number
    selectionSettings: {
      requireLeaderApproval: boolean
      allowPreferredPeers: boolean
      excludeLeaderFromPeerSelection: boolean
      excludeDirectReportsFromPeerSelection: boolean
      managerEffectiveness: FeedbackManagerEffectivenessSettings
      skillArchitecture: FeedbackSkillArchitectureSettings
      aiCopilot: FeedbackAiCopilotSettings
    }
    visibilitySettings: Record<string, 'FULL' | 'ANONYMOUS' | 'PRIVATE'>
    reviewerGroups: Array<{
      key: 'self' | 'supervisor' | 'peer' | 'subordinate'
      label: string
      description: string
      helpMessage?: string
      reviewers: Array<{
        employeeId: string
        name: string
        department: string
        relationship: RaterRelationship | 'SELF'
        selectable?: boolean
        disabledReason?: string | null
      }>
    }>
    guidance: string[]
    workflowStatus?: string
    counts?: {
      total: number
      approved: number
      published: number
    }
    canApprove?: boolean
    canPublish?: boolean
    savedDraft?: {
      updatedAt: string
      reviewers: Array<{
        employeeId: string
        name: string
        relationship: string
      }>
    }
  }
  results?: {
    roundName: string
    targetEmployee: {
      id: string
      name: string
      department: string
      position: string
    }
    recipientProfile: FeedbackResultRecipientProfile
    availableProfiles: Array<{
      value: FeedbackResultRecipientProfile
      label: string
    }>
    presentationSettings: FeedbackResultVersionConfig
    anonymityThreshold: number
    feedbackCount: number
    thresholdMet: boolean
    roundWeight: number
    summaryCards: Array<{
      id: 'LEADER_REVIEW' | 'EXECUTIVE_REVIEW' | 'FINAL_RESULT'
      title: string
      reviewerName?: string
      relationshipLabel: string
      totalScore?: number | null
      comment?: string | null
      showScore: boolean
      showComment: boolean
    }>
    categoryScores: Array<{
      category: string
      average: number
      count: number
    }>
    strengths: string[]
    improvements: string[]
    anonymousSummary: string
    textHighlights: string[]
    groupedResponses: Array<{
      questionId: string
      category: string
      questionText: string
      answers: Array<{
        feedbackId: string
        relationship: string
        authorLabel: string
        ratingValue?: number | null
        textValue?: string | null
      }>
    }>
    warnings: string[]
    developmentPlan: {
      focusArea: string
      actions: string[]
      managerSupport: string[]
      nextCheckinTopics: string[]
      recommendedCompetencies: string[]
      linkedEvidence: DevelopmentPlanLinkedEvidence[]
    }
    reportCache?: {
      id: string
      generatedAt: string
      source: 'persisted' | 'live'
    }
    developmentPlanRecord?: {
      id: string
      title: string
      status: DevelopmentPlanStatus
      updatedAt: string
      actions: DevelopmentPlanActionItem[]
      recommendedCompetencies: string[]
      managerSupport: string[]
      nextCheckinTopics: string[]
      linkedEvidence: DevelopmentPlanLinkedEvidence[]
      note?: string | null
      dueDate?: string | null
      progressRate: number
    }
    roleGuide?: FeedbackRoleGuideViewModel
    growthCopilot?: FeedbackGrowthCopilotViewModel
    linkage: Array<{
      label: string
      href: string
      description: string
    }>
    pdfHref: string
    analysis: FeedbackReportAnalysisPayload
    managerEffectiveness?: {
      enabled: boolean
      overallScore: number | null
      benchmarkAverage: number | null
      benchmarkDelta: number | null
      riskLevel: ManagerEffectivenessRiskLevel
      reviewerSummary: string[]
      competencyLabels: string[]
      strengths: string[]
      improvements: string[]
      coachingPack: ManagerEffectivenessCoachingPack
    }
  }
  admin?: {
    roundHealth: Array<{
      roundId: string
      roundName: string
      responseRate: number
      pendingCount: number
      submittedCount: number
      thresholdMet: boolean
      qualityRiskCount: number
    }>
    timeline: Array<{
      title: string
      description: string
      at: string
    }>
    alerts: string[]
    folders: Array<{
      id: string
      name: string
      description?: string | null
      color?: string | null
      roundCount: number
    }>
    reminderTargets: Array<{
      kind: 'review-reminder' | 'peer-selection-reminder' | 'result-share'
      recipientId: string
      recipientName: string
      departmentName?: string
      roundId: string
      roundName: string
      statusKey: string
      statusLabel: string
      statusTone: 'slate' | 'amber' | 'emerald' | 'rose' | 'blue'
      detail: string
    }>
    settings?: {
      selectionSettings: {
        requireLeaderApproval: boolean
        allowPreferredPeers: boolean
        excludeLeaderFromPeerSelection: boolean
        excludeDirectReportsFromPeerSelection: boolean
        managerEffectiveness: FeedbackManagerEffectivenessSettings
        skillArchitecture: FeedbackSkillArchitectureSettings
        aiCopilot: FeedbackAiCopilotSettings
      }
      visibilitySettings: Record<string, 'FULL' | 'ANONYMOUS' | 'PRIVATE'>
      resultPresentationSettings: FeedbackResultPresentationSettings
      reportAnalysisSettings: FeedbackReportAnalysisSettings
      ratingGuideSettings: FeedbackRatingGuideSettings
      collaboratorIds: string[]
    }
    managerEffectiveness?: {
      enabled: boolean
      targetScope: FeedbackManagerEffectivenessSettings['targetScope']
      reviewerSummary: string[]
      competencyLabels: string[]
      summary: {
        leaderCount: number
        averageScore: number | null
        highRiskCount: number
        coachingReadyCount: number
      }
      heatmap: Array<{
        departmentName: string
        leaderCount: number
        averageScore: number | null
        highRiskCount: number
      }>
      topImprovementThemes: Array<{
        label: string
        count: number
      }>
      leaders: Array<{
        employeeId: string
        name: string
        departmentName: string
        position: string
        overallScore: number | null
        benchmarkAverage: number | null
        benchmarkDelta: number | null
        riskLevel: ManagerEffectivenessRiskLevel
        strengths: string[]
        improvements: string[]
        coachingPack: ManagerEffectivenessCoachingPack
        resultHref: string
      }>
    }
    reviewAdmin?: {
      currentAccess: {
        summaryScope: FeedbackAdminReviewScope
        summaryLabel: string
        summaryDescription: string
        canManageAllRounds: boolean
        canManageCollaboratorRounds: boolean
        canReadAllContent: boolean
        canReadCollaboratorContent: boolean
      }
      groups: Array<{
        id: string
        groupName: string
        description?: string | null
        reviewScope: FeedbackAdminReviewScope
        reviewScopeLabel: string
        memberCount: number
        members: Array<{
          employeeId: string
          name: string
          departmentName: string
          position: string
          email: string
        }>
      }>
      candidateMembers: Array<{
        employeeId: string
        name: string
        departmentName: string
        position: string
        email: string
        summaryScope: FeedbackAdminReviewScope
        summaryLabel: string
        canManageCollaboratorRounds: boolean
        canReadCollaboratorContent: boolean
      }>
    }
    nominationQueue?: Array<{
      targetId: string
      targetName: string
      roundId: string
      roundName: string
      status: string
      totalCount: number
      approvedCount: number
      publishedCount: number
    }>
    resultShare?: {
      roundId: string
      roundName: string
      totalTargets: number
      leaderSharedCount: number
      leaderViewedCount: number
      revieweeSharedCount: number
      revieweeViewedCount: number
      rows: Array<{
        targetId: string
        targetName: string
        departmentName: string
        leaderName?: string
        leaderStatus: 'NOT_SHARED' | 'SHARED' | 'VIEWED' | 'NO_LEADER'
        leaderSharedAt?: string
        leaderViewedAt?: string
        revieweeStatus: 'NOT_SHARED' | 'SHARED' | 'VIEWED'
        revieweeSharedAt?: string
        revieweeViewedAt?: string
        resultHref: string
      }>
    }
    onboarding?: {
      scheduleInfo: string
      jobFamilyOptions: Array<{
        value: string
        label: string
      }>
      workflows: Array<{
        id: string
        workflowName: string
        isActive: boolean
        scheduleHourKst: number
        scheduleInfo: string
        targetConditions: Array<
          | {
              id: string
              field: 'JOIN_DATE'
              operator: 'ON_OR_AFTER' | 'ON_OR_BEFORE' | 'BETWEEN'
              value: string
              valueTo?: string | null
            }
          | {
              id: string
              field: 'POSITION'
              operator: 'IN'
              values: Array<'MEMBER' | 'TEAM_LEADER' | 'SECTION_CHIEF' | 'DIV_HEAD' | 'CEO'>
            }
        >
        targetConditionSummary: string[]
        steps: Array<{
          id: string
          stepOrder: number
          stepName: string
          triggerDaysAfterJoin: number
          durationDays: number
          reviewNameTemplate: string
          includeEmployeeNameInName: boolean
          includeHireDateInName: boolean
          reviewNamePreview: string
        }>
        eligibleTargetCount: number
        generatedCount: number
      }>
      generatedReviews: Array<{
        id: string
        workflowId: string
        workflowName: string
        stepId: string
        stepName: string
        roundId: string
        roundName: string
        targetId: string
        targetName: string
        targetDepartment: string
        status: string
        feedbackStatus: string
        createdAt: string
        createdDateLabel: string
        scheduledDateKey: string
      }>
    }
    anytimeReview?: {
      summary: {
        totalCount: number
        activeCount: number
        overdueCount: number
        pipCount: number
        projectCount: number
      }
      employeeOptions: Array<{
        employeeId: string
        name: string
        departmentName: string
        position: string
        email: string
      }>
      templateOptions: Array<{
        roundId: string
        roundName: string
        roundType: FeedbackRoundType
        documentKind?: FeedbackDocumentKind | null
        documentKindLabel?: string | null
        questionCount: number
      }>
      documents: Array<{
        roundId: string
        roundName: string
        documentKind: FeedbackDocumentKind | null
        documentKindLabel: string
        status: FeedbackRoundStatus
        lifecycleState: 'ACTIVE' | 'CLOSED' | 'CANCELLED'
        startDate: string
        endDate: string
        createdAt: string
        targetId?: string
        targetName: string
        targetDepartmentName: string
        reviewerId?: string
        reviewerName: string
        reviewerDepartmentName: string
        reason: string
        projectName?: string | null
        projectCode?: string | null
        templateRoundName?: string | null
        feedbackStatus?: FeedbackStatus
        collaboratorCount: number
        pip?: FeedbackAnytimeDocumentSettings['pip']
        history: Array<{
          action: string
          summary: string
          at: string
        }>
      }>
    }
  }
  respond?: {
    feedbackId: string
    roundId: string
    roundName: string
    receiverId: string
    receiverName: string
    relationship: string
    status: FeedbackStatus
    questionCount: number
    answeredCount: number
    overallComment?: string
    targetProfile: {
      departmentName: string
      role: string
      position?: string | null
      jobTitle?: string | null
      teamName?: string | null
    }
    priorScoreSummary?: {
      authorLabel: string
      totalScore: number
      submittedAt?: string
    }
    roleGuide?: FeedbackRoleGuideViewModel
    ratingGuide?: {
      questionId?: string
      questionText?: string
      distributionMode: FeedbackRatingDistributionMode
      distributionModeLabel: string
      distributionModeDescription: string
      distributionScope: FeedbackRatingDistributionScope
      distributionScopeLabel: string
      targetProfileLabel: string
      matchedRule?: {
        label: string
        headline: string
        guidance: string
      }
      scaleEntries: Array<{
        value: number
        label: string
        description: string
        targetRatio: number | null
        headcountLimit: number | null
        currentCount: number
        recommendedCount: number | null
        isNonEvaluative: boolean
        isHighest: boolean
        isLowest: boolean
      }>
    }
    questions: Array<{
      id: string
      category: string
      questionText: string
      questionType: QuestionType
      isRequired: boolean
      scaleMin?: number | null
      scaleMax?: number | null
      ratingValue?: number | null
      textValue?: string | null
    }>
    instructions: string[]
    reference: {
      groupedResponses: Array<{
        questionId: string
        category: string
        questionText: string
        answers: Array<{
          feedbackId: string
          relationship: string
          authorLabel: string
          ratingValue?: number | null
          textValue?: string | null
        }>
      }>
      warnings: string[]
      goals: Array<{
        id: string
        title: string
        linkedGoalLabel?: string | null
        hierarchy: string[]
        periodLabel: string
        collaborators: string[]
        achievementSummary?: string | null
        progressRate?: number | null
        progressLabel: string
        approvalStatusLabel: string
        weightLabel: string
        links: Array<{
          id: string
          label: string
          href: string
          uploadedBy?: string
        }>
        checkinNotes: string[]
      }>
      priorScores: Array<{
        feedbackId: string
        relationship: string
        authorLabel: string
        totalScore: number
        submittedAt?: string
      }>
      totalScoreEnabled: boolean
    }
  }
}

type GetFeedback360PageDataParams = {
  session: Session
  mode: Feedback360RouteMode
  cycleId?: string
  roundId?: string
  empId?: string
  resultVersion?: FeedbackResultRecipientProfile
  feedbackId?: string
}

function toResponseRate(submittedCount: number, totalCount: number) {
  if (!totalCount) return 0
  return Math.round((submittedCount / totalCount) * 100)
}

function isManagerOfTarget(target: {
  teamLeaderId: string | null
  sectionChiefId: string | null
  divisionHeadId: string | null
}, actorId: string) {
  return (
    target.teamLeaderId === actorId ||
    target.sectionChiefId === actorId ||
    target.divisionHeadId === actorId
  )
}

function canViewTarget({
  actorId,
  actorRole,
  target,
}: {
  actorId: string
  actorRole: string
  target: {
    id: string
    teamLeaderId: string | null
    sectionChiefId: string | null
    divisionHeadId: string | null
  }
}) {
  if (actorRole === 'ROLE_ADMIN') return true
  if (target.id === actorId) return true
  return isManagerOfTarget(target, actorId)
}

function getPositionLabel(position: string) {
  const labels: Record<string, string> = {
    MEMBER: '구성원',
    TEAM_LEADER: '팀장',
    SECTION_CHIEF: '실장',
    DIV_HEAD: '본부장',
    CEO: 'CEO',
  }

  return labels[position] ?? position
}

function describeReminderStatus(
  kind: 'review-reminder' | 'peer-selection-reminder' | 'result-share',
  status: string
): {
  key: string
  label: string
  tone: 'slate' | 'amber' | 'emerald' | 'rose' | 'blue'
} {
  if (kind === 'review-reminder') {
    if (status === 'IN_PROGRESS') {
      return { key: status, label: '작성 중', tone: 'blue' }
    }
    if (status === 'SUBMITTED') {
      return { key: status, label: '응답 제출 완료', tone: 'emerald' }
    }
    return { key: 'PENDING', label: '미제출', tone: 'amber' }
  }

  if (kind === 'peer-selection-reminder') {
    if (status === 'APPROVED') {
      return { key: status, label: '승인 완료', tone: 'emerald' }
    }
    if (status === 'SUBMITTED') {
      return { key: status, label: '승인 대기', tone: 'amber' }
    }
    if (status === 'REJECTED') {
      return { key: status, label: '반려됨', tone: 'rose' }
    }
    return { key: 'DRAFT', label: '승인 요청 전', tone: 'slate' }
  }

  return { key: 'RESULT_READY', label: '공유 대기', tone: 'blue' }
}

function buildGroupedResponses(params: {
  feedbacks: Array<{
    id: string
    relationship: string
    giver: { empName: string }
    responses: Array<{
      questionId: string
      ratingValue: number | null
      textValue: string | null
      question: {
        category: string
        questionText?: string | null
      }
    }>
  }>
  thresholdMet: boolean
  visibilitySettings: Record<string, 'FULL' | 'ANONYMOUS' | 'PRIVATE'>
}) {
  const questionMap = new Map<
    string,
    {
      questionId: string
      category: string
      questionText: string
      answers: Array<{
        feedbackId: string
        relationship: string
        authorLabel: string
        ratingValue?: number | null
        textValue?: string | null
      }>
    }
  >()

  for (const feedback of params.feedbacks) {
    const visibility = params.visibilitySettings[feedback.relationship] ?? 'ANONYMOUS'
    if (visibility === 'PRIVATE') continue

    for (const response of feedback.responses) {
      const current = questionMap.get(response.questionId) ?? {
        questionId: response.questionId,
        category: response.question.category,
        questionText: response.question.questionText ?? '문항 정보 없음',
        answers: [],
      }

      current.answers.push({
        feedbackId: feedback.id,
        relationship: feedback.relationship,
        authorLabel:
          visibility === 'FULL' || !params.thresholdMet
            ? `${feedback.relationship} · ${feedback.giver.empName}`
            : `${feedback.relationship} · 익명`,
        ratingValue: response.ratingValue,
        textValue: response.textValue,
      })

      questionMap.set(response.questionId, current)
    }
  }

  return [...questionMap.values()]
}

function buildResultWarnings(params: {
  thresholdMet: boolean
  feedbackCount: number
  strengths: string[]
  improvements: string[]
}) {
  const warnings: string[] = []
  if (!params.thresholdMet) {
    warnings.push('익명 기준을 아직 충족하지 못해 일부 문항은 제한적으로만 해석해야 합니다.')
  }
  if (params.feedbackCount < 3) {
    warnings.push('응답 수가 적어 해석 민감도가 높을 수 있습니다.')
  }
  if (!params.strengths.length || !params.improvements.length) {
    warnings.push('텍스트 근거가 충분하지 않아 자동 요약의 구체성이 낮을 수 있습니다.')
  }
  return warnings
}

function averageFeedbackTotalScores(
  feedbacks: Array<{
    responses: Array<{
      ratingValue?: number | null
      question?: {
        questionType?: QuestionType | string | null
      }
    }>
  }>
) {
  const scores = feedbacks
    .map((feedback) => calculateFeedbackResponseTotalScore({ responses: feedback.responses }))
    .filter((score): score is number => typeof score === 'number')

  if (!scores.length) return null

  return Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 10) / 10
}

function averageNumber(values: Array<number | null | undefined>) {
  const normalized = values.filter((value): value is number => typeof value === 'number')
  if (!normalized.length) return null
  return Math.round((normalized.reduce((sum, value) => sum + value, 0) / normalized.length) * 10) / 10
}

type ManagerEffectivenessRoundFeedback = {
  id: string
  roundId: string
  status: FeedbackStatus
  receiverId: string
  receiver: {
    id: string
    empName: string
    position: string
    department: {
      deptName: string
    }
  }
  responses: Array<{
    question: {
      category: string
      questionText: string
      questionType: QuestionType
    }
    ratingValue: number | null
    textValue: string | null
  }>
}

type ManagerEffectivenessLeaderSummary = {
  employeeId: string
  name: string
  departmentName: string
  position: string
  overallScore: number | null
  benchmarkAverage: number | null
  benchmarkDelta: number | null
  riskLevel: ManagerEffectivenessRiskLevel
  strengths: string[]
  improvements: string[]
  coachingPack: ManagerEffectivenessCoachingPack
  resultHref: string
}

function buildManagerEffectivenessLeaderSummaries(params: {
  feedbacks: ManagerEffectivenessRoundFeedback[]
  competencyLabels: string[]
  targetScope: FeedbackManagerEffectivenessSettings['targetScope']
}) {
  const grouped = params.feedbacks
    .filter((feedback) => feedback.status === 'SUBMITTED')
    .reduce((map, feedback) => {
      if (
        params.targetScope === 'MANAGERS_ONLY' &&
        !isManagerEffectivenessTarget({ position: feedback.receiver.position })
      ) {
        return map
      }

      const current = map.get(feedback.receiverId) ?? []
      current.push(feedback)
      map.set(feedback.receiverId, current)
      return map
    }, new Map<string, ManagerEffectivenessRoundFeedback[]>())

  const leaderSummaries = Array.from(grouped.entries()).map(([receiverId, feedbacks]) => {
    const receiver = feedbacks[0]?.receiver
    const scoreByFeedback = feedbacks.map((feedback) =>
      calculateFeedbackResponseTotalScore({ responses: feedback.responses })
    )
    const overallScore = averageNumber(scoreByFeedback)

    const categoryStats = feedbacks.reduce(
      (map, feedback) => {
        feedback.responses.forEach((response) => {
          if (typeof response.ratingValue !== 'number') return
          const key = response.question.category?.trim() || response.question.questionText?.trim() || '기타'
          const current = map.get(key) ?? { total: 0, count: 0 }
          current.total += response.ratingValue
          current.count += 1
          map.set(key, current)
        })
        return map
      },
      new Map<string, { total: number; count: number }>()
    )

    const rankedCategories = Array.from(categoryStats.entries())
      .map(([label, stats]) => ({
        label,
        average: stats.count ? stats.total / stats.count : 0,
      }))
      .sort((a, b) => b.average - a.average)

    const fallbackStrength = params.competencyLabels[0] ?? '코칭'
    const fallbackImprovement =
      params.competencyLabels[Math.min(1, Math.max(params.competencyLabels.length - 1, 0))] ?? '피드백'

    const strengths =
      rankedCategories.slice(0, 2).map((item) => item.label) ||
      (fallbackStrength ? [fallbackStrength] : [])
    const improvements =
      rankedCategories.slice(-2).reverse().map((item) => item.label) ||
      (fallbackImprovement ? [fallbackImprovement] : [])

    return {
      employeeId: receiverId,
      name: receiver?.empName ?? '이름 없음',
      departmentName: receiver?.department.deptName ?? '조직 없음',
      position: getPositionLabel(receiver?.position ?? 'MEMBER'),
      overallScore,
      benchmarkAverage: null,
      benchmarkDelta: null,
      riskLevel: 'LOW' as ManagerEffectivenessRiskLevel,
      strengths: strengths.length ? strengths : [fallbackStrength],
      improvements: improvements.length ? improvements : [fallbackImprovement],
      coachingPack: buildManagerEffectivenessCoachingPack({
        leaderName: receiver?.empName ?? '리더',
        strengths: strengths.length ? strengths : [fallbackStrength],
        improvements: improvements.length ? improvements : [fallbackImprovement],
        competencyLabels: params.competencyLabels,
        overallScore,
        benchmarkDelta: null,
      }),
      resultHref: `/evaluation/360/results?roundId=${encodeURIComponent(feedbacks[0]?.roundId ?? '')}&empId=${encodeURIComponent(receiverId)}`,
    }
  })

  return leaderSummaries.map((summary) => {
    const peerBenchmarks = leaderSummaries
      .filter((item) => item.employeeId !== summary.employeeId)
      .map((item) => item.overallScore)
    const benchmarkAverage = averageNumber(
      peerBenchmarks.length ? peerBenchmarks : leaderSummaries.map((item) => item.overallScore)
    )
    const benchmarkDelta =
      typeof summary.overallScore === 'number' && typeof benchmarkAverage === 'number'
        ? Math.round((summary.overallScore - benchmarkAverage) * 10) / 10
        : null
    const riskLevel = getManagerEffectivenessRiskLevel({
      overallScore: summary.overallScore,
      benchmarkDelta,
      improvementCount: summary.improvements.length,
    })

    return {
      ...summary,
      benchmarkAverage,
      benchmarkDelta,
      riskLevel,
      coachingPack: buildManagerEffectivenessCoachingPack({
        leaderName: summary.name,
        strengths: summary.strengths,
        improvements: summary.improvements,
        competencyLabels: params.competencyLabels,
        overallScore: summary.overallScore,
        benchmarkDelta,
      }),
    }
  })
}

type FeedbackGoalReferenceLink = {
  id: string
  label: string
  href: string
  uploadedBy?: string
}

type FeedbackCheckinGoalContext = {
  scheduledDate: Date
  collaborators: string[]
  progress?: string
  concern?: string
  support?: string
}

type FeedbackKpiDiscussion = {
  kpiId: string
  progress?: string
  concern?: string
  support?: string
}

function asFeedbackRecord(value: unknown) {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function parseFeedbackGoalContextLinks(value: Prisma.JsonValue | null | undefined): FeedbackGoalReferenceLink[] {
  if (!Array.isArray(value)) return []

  return value.flatMap((item, index) => {
    const record = asFeedbackRecord(item)
    if (!record) return []

    const hrefCandidate =
      typeof record.url === 'string'
        ? record.url.trim()
        : typeof record.href === 'string'
          ? record.href.trim()
          : typeof record.link === 'string'
            ? record.link.trim()
            : typeof record.dataUrl === 'string'
              ? record.dataUrl.trim()
              : ''

    if (!hrefCandidate) return []

    const labelCandidate =
      typeof record.name === 'string'
        ? record.name.trim()
        : typeof record.fileName === 'string'
          ? record.fileName.trim()
          : typeof record.label === 'string'
            ? record.label.trim()
            : ''

    const uploadedBy =
      typeof record.uploadedBy === 'string' && record.uploadedBy.trim()
        ? record.uploadedBy.trim()
        : undefined

    return [
      {
        id: typeof record.id === 'string' && record.id.trim() ? record.id.trim() : `goal-link-${index + 1}`,
        label: labelCandidate || `관련 링크 ${index + 1}`,
        href: hrefCandidate,
        uploadedBy,
      },
    ]
  })
}

function parseFeedbackGoalContextActionAssignees(value: Prisma.JsonValue | null | undefined) {
  if (!Array.isArray(value)) return []

  const assignees: string[] = []

  for (const item of value) {
    const record = asFeedbackRecord(item)
    if (!record) continue

    const assignee = typeof record.assignee === 'string' ? record.assignee.trim() : ''
    if (assignee) {
      assignees.push(assignee)
    }
  }

  return assignees
}

function parseFeedbackGoalContextKpiDiscussions(value: Prisma.JsonValue | null | undefined): FeedbackKpiDiscussion[] {
  if (!Array.isArray(value)) return []

  const discussions: FeedbackKpiDiscussion[] = []

  for (const item of value) {
    const record = asFeedbackRecord(item)
    if (!record) continue

    const kpiId = typeof record.kpiId === 'string' ? record.kpiId.trim() : ''
    if (!kpiId) continue

    discussions.push({
      kpiId,
      progress: typeof record.progress === 'string' ? record.progress.trim() || undefined : undefined,
      concern: typeof record.concern === 'string' ? record.concern.trim() || undefined : undefined,
      support: typeof record.support === 'string' ? record.support.trim() || undefined : undefined,
    })
  }

  return discussions
}

function formatFeedbackGoalMonthLabel(yearMonth: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(yearMonth)
  if (!match) return yearMonth
  return `${match[1]}.${match[2]}`
}

function buildFeedbackGoalPeriodLabel(params: {
  cycleYear: number
  records: Array<{ yearMonth: string }>
  checkins: FeedbackCheckinGoalContext[]
}) {
  if (params.records.length) {
    const ordered = [...params.records].map((record) => record.yearMonth).sort((left, right) => left.localeCompare(right))
    const first = formatFeedbackGoalMonthLabel(ordered[0]!)
    const last = formatFeedbackGoalMonthLabel(ordered[ordered.length - 1]!)
    return first === last ? `${first} 기준` : `${first} ~ ${last}`
  }

  if (params.checkins.length) {
    const ordered = [...params.checkins].sort((left, right) => left.scheduledDate.getTime() - right.scheduledDate.getTime())
    const first = formatDate(ordered[0]!.scheduledDate)
    const last = formatDate(ordered[ordered.length - 1]!.scheduledDate)
    return first === last ? `${first} 체크인 기준` : `${first} ~ ${last}`
  }

  return `${params.cycleYear}년 평가 주기`
}

function getFeedbackGoalApprovalStatus(status: KpiStatus | null | undefined) {
  if (status === 'CONFIRMED') return '승인 완료'
  if (status === 'ARCHIVED') return '보관'
  if (status === 'DRAFT') return '승인 요청 전'
  return '미확정'
}

function buildFeedbackGoalAchievementSummary(params: {
  latestRecord?: {
    activities?: string | null
    efforts?: string | null
    obstacles?: string | null
  }
  latestCheckin?: FeedbackCheckinGoalContext
}) {
  const parts = [
    params.latestRecord?.activities?.trim(),
    params.latestRecord?.efforts?.trim() ? `주요 기여: ${params.latestRecord.efforts.trim()}` : '',
    params.latestCheckin?.progress?.trim(),
    params.latestCheckin?.support?.trim() ? `지원 필요: ${params.latestCheckin.support.trim()}` : '',
    params.latestCheckin?.concern?.trim()
      ? `주의 사항: ${params.latestCheckin.concern.trim()}`
      : params.latestRecord?.obstacles?.trim()
        ? `주의 사항: ${params.latestRecord.obstacles.trim()}`
        : '',
  ].filter(Boolean)

  return parts.length ? parts.join(' · ') : null
}

function buildFeedbackGoalProgressLabel(params: {
  latestRecord?: {
    achievementRate?: number | null
  }
  latestCheckin?: FeedbackCheckinGoalContext
}) {
  if (typeof params.latestRecord?.achievementRate === 'number') {
    return `진행률 ${params.latestRecord.achievementRate}%`
  }

  if (params.latestCheckin?.progress) {
    return '체크인 메모 참고'
  }

  return '진행률 미집계'
}

function buildFeedbackGoalHierarchyLabels(goal: {
  department?: { deptName: string } | null
  kpiName: string
  parentOrgKpi?: {
    department?: { deptName: string } | null
    kpiName: string
    parentOrgKpi?: {
      department?: { deptName: string } | null
      kpiName: string
    } | null
  } | null
} | null | undefined) {
  if (!goal) return []

  const labels: string[] = []
  let current = goal.parentOrgKpi ?? null

  while (current) {
    labels.unshift(current.department ? `${current.department.deptName} / ${current.kpiName}` : current.kpiName)
    current = current.parentOrgKpi ?? null
  }

  labels.push(goal.department ? `${goal.department.deptName} / ${goal.kpiName}` : goal.kpiName)
  return labels
}

function parseAuditRecord(value: unknown) {
  if (!value || typeof value !== 'object') {
    return null
  }

  return value as Record<string, unknown>
}

function getLatestAuditTimestamp(params: {
  logs: Array<{
    action: string
    timestamp: Date
    newValue: unknown
  }>
  targetId: string
  recipientRole: 'LEADER' | 'REVIEWEE'
  action: 'FEEDBACK_RESULT_SHARED' | 'FEEDBACK_RESULT_VIEWED'
}) {
  for (const log of params.logs) {
    if (log.action !== params.action) continue
    const record = parseAuditRecord(log.newValue)
    if (!record) continue
    if (record.targetId !== params.targetId) continue
    if (record.recipientRole !== params.recipientRole) continue
    return log.timestamp.toISOString()
  }

  return undefined
}

function resolveReceiptStatus(params: {
  sharedAt?: string
  viewedAt?: string
  unavailable: true
}): 'NO_LEADER'
function resolveReceiptStatus(params: {
  sharedAt?: string
  viewedAt?: string
  unavailable?: false | undefined
}): 'NOT_SHARED' | 'SHARED' | 'VIEWED'
function resolveReceiptStatus(params: {
  sharedAt?: string
  viewedAt?: string
  unavailable?: boolean
}): 'NOT_SHARED' | 'SHARED' | 'VIEWED' | 'NO_LEADER' {
  if (params.unavailable) return 'NO_LEADER'
  if (params.viewedAt) return 'VIEWED'
  if (params.sharedAt) return 'SHARED'
  return 'NOT_SHARED'
}

export async function getFeedback360PageData(
  params: GetFeedback360PageDataParams
): Promise<Feedback360PageData> {
  try {
    const sessionUser = params.session.user as Session['user'] & { id?: string }

    if (!sessionUser?.id) {
      return {
        mode: params.mode,
        state: 'permission-denied',
        message: '로그인 정보를 확인할 수 없습니다.',
        availableCycles: [],
        availableRounds: [],
        summary: {
          activeRounds: 0,
          pendingResponses: 0,
          submittedResponses: 0,
          averageResponseRate: 0,
          anonymityReadyCount: 0,
        },
      }
    }

    const employee = await prisma.employee.findUnique({
      where: { id: sessionUser.id },
      include: {
        department: true,
      },
    })

    if (!employee) {
      return {
        mode: params.mode,
        state: 'permission-denied',
        message: '직원 정보를 찾을 수 없습니다.',
        availableCycles: [],
        availableRounds: [],
        summary: {
          activeRounds: 0,
          pendingResponses: 0,
          submittedResponses: 0,
          averageResponseRate: 0,
          anonymityReadyCount: 0,
        },
      }
    }

    const reviewAdminAccess = await getFeedbackReviewAdminAccess({
      employeeId: employee.id,
      actorRole: employee.role,
      orgId: employee.department.orgId,
    })

    const availableCycles = await prisma.evalCycle.findMany({
      where: { orgId: employee.department.orgId },
      orderBy: [{ evalYear: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        orgId: true,
        cycleName: true,
        evalYear: true,
        status: true,
      },
    })

    const selectedCycle = availableCycles.find((cycle) => cycle.id === params.cycleId) ?? availableCycles[0] ?? null
    if (!selectedCycle) {
      return {
        mode: params.mode,
        state: 'empty',
        message: '360 다면평가를 볼 수 있는 평가 주기가 없습니다.',
        currentUser: {
          id: employee.id,
          name: employee.empName,
          role: employee.role,
          department: employee.department.deptName,
        },
        permissions: {
          canManageRounds:
            reviewAdminAccess.canManageAllRounds || reviewAdminAccess.canManageCollaboratorRounds,
          canSubmitNomination: true,
          canViewAdmin:
            reviewAdminAccess.canManageAllRounds || reviewAdminAccess.canManageCollaboratorRounds,
          canViewResults: true,
          canRespond: true,
        },
        availableCycles: [],
        availableRounds: [],
        summary: {
          activeRounds: 0,
          pendingResponses: 0,
          submittedResponses: 0,
          averageResponseRate: 0,
          anonymityReadyCount: 0,
        },
      }
    }

    const rounds = await prisma.multiFeedbackRound.findMany({
      where: {
        evalCycleId: selectedCycle.id,
        roundType: {
          not: 'UPWARD',
        },
      },
      include: {
        folder: {
          select: {
            id: true,
            name: true,
            description: true,
            color: true,
          },
        },
        feedbacks: {
          include: {
            receiver: {
              select: {
                id: true,
                empName: true,
                position: true,
                teamLeaderId: true,
                sectionChiefId: true,
                divisionHeadId: true,
                department: { select: { deptName: true } },
              },
            },
            giver: {
              select: {
                id: true,
                empName: true,
                department: { select: { deptName: true } },
              },
            },
            responses: {
              include: {
                question: {
                  select: {
                    category: true,
                    questionText: true,
                    questionType: true,
                  },
                },
              },
            },
          },
        },
        questions: {
          select: {
            id: true,
            category: true,
            questionText: true,
            questionType: true,
            scaleMin: true,
            scaleMax: true,
          },
        },
        nominations: {
          select: {
            targetId: true,
            reviewerId: true,
            status: true,
          },
        },
        reportCaches: {
          select: {
            targetId: true,
          },
        },
        collaborators: {
          select: {
            employeeId: true,
            employee: {
              select: {
                role: true,
                empName: true,
                position: true,
                gwsEmail: true,
                department: {
                  select: {
                    deptName: true,
                  },
                },
                feedbackAdminGroupMemberships: {
                  select: {
                    group: {
                      select: {
                        id: true,
                        groupName: true,
                        reviewScope: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [{ endDate: 'desc' }, { createdAt: 'desc' }],
    })

    const collaboratorRoundIds =
      reviewAdminAccess.canManageCollaboratorRounds && !reviewAdminAccess.canManageAllRounds
        ? await getCollaboratorRoundIds({
            employeeId: employee.id,
            roundIds: rounds.map((round) => round.id),
          })
        : new Set<string>()

    const scopedRounds =
      params.mode === 'admin'
        ? reviewAdminAccess.canManageAllRounds
          ? rounds
          : reviewAdminAccess.canManageCollaboratorRounds
            ? rounds.filter((round) => collaboratorRoundIds.has(round.id))
            : []
        : rounds

    const selectedRound = scopedRounds.find((round) => round.id === params.roundId) ?? scopedRounds[0] ?? null
    const hasCollaboratorRoundAccess = selectedRound ? collaboratorRoundIds.has(selectedRound.id) : false
    const canManageSelectedRound = selectedRound
      ? reviewAdminAccess.canManageAllRounds ||
        (reviewAdminAccess.canManageCollaboratorRounds && hasCollaboratorRoundAccess)
      : false
    const canReadSelectedRoundContent = selectedRound
      ? reviewAdminAccess.canReadAllContent ||
        (reviewAdminAccess.canReadCollaboratorContent && hasCollaboratorRoundAccess)
      : false
    const currentUser = {
      id: employee.id,
      name: employee.empName,
      role: employee.role,
      department: employee.department.deptName,
    }

    if (
      params.mode === 'admin' &&
      !reviewAdminAccess.canManageAllRounds &&
      !reviewAdminAccess.canManageCollaboratorRounds
    ) {
      return {
        mode: params.mode,
        state: 'permission-denied',
        message: '공동 작업자로 지정된 리뷰만 관리할 수 있습니다. 열람 가능한 리뷰가 없으면 관리자 화면은 열리지 않습니다.',
        currentUser,
        permissions: {
          canManageRounds: false,
          canSubmitNomination: true,
          canViewAdmin: false,
          canViewResults: true,
          canRespond: true,
        },
        availableCycles: availableCycles.map((cycle) => ({
          id: cycle.id,
          name: cycle.cycleName,
          year: cycle.evalYear,
          status: cycle.status,
        })),
        selectedCycleId: selectedCycle.id,
        availableRounds: [],
        summary: {
          activeRounds: 0,
          pendingResponses: 0,
          submittedResponses: 0,
          averageResponseRate: 0,
          anonymityReadyCount: 0,
        },
      }
    }

    const pendingResponses = scopedRounds.reduce(
      (sum, round) =>
        sum +
        round.feedbacks.filter(
          (feedback) =>
            feedback.giverId === employee.id &&
            feedback.status !== 'SUBMITTED'
        ).length,
      0
    )
    const submittedResponses = scopedRounds.reduce(
      (sum, round) =>
        sum +
        round.feedbacks.filter(
          (feedback) =>
            feedback.giverId === employee.id &&
            feedback.status === 'SUBMITTED'
        ).length,
      0
    )

    const availableRounds = scopedRounds.map((round) => {
      const totalCount = round.feedbacks.length
      const submittedCount = round.feedbacks.filter((feedback) => feedback.status === 'SUBMITTED').length
      const uniqueTargets = new Set(round.feedbacks.map((feedback) => feedback.receiverId))
      const documentSettings = parseFeedbackAnytimeDocumentSettings(round.documentSettings)
      const selectionSettings = parseFeedbackSelectionSettings(round.selectionSettings)
      const visibilitySettings = parseFeedbackVisibilitySettings(round.visibilitySettings)
      const resultPresentationSettings = parseFeedbackResultPresentationSettings(
        round.resultPresentationSettings
      )
      const reportAnalysisSettings = parseFeedbackReportAnalysisSettings(round.reportAnalysisSettings)
      const ratingGuideSettings = parseFeedbackRatingGuideSettings(
        round.ratingGuideSettings,
        round.questions
          .filter((question) => question.questionType === 'RATING_SCALE')
          .map((question) => ({
            id: question.id,
            questionText: question.questionText,
            scaleMin: question.scaleMin,
            scaleMax: question.scaleMax,
          }))
      )

      return {
        id: round.id,
        roundName: round.roundName,
        roundType: round.roundType,
        documentKind: round.documentKind,
        documentKindLabel: getFeedbackAnytimeDocumentKindLabel(round.documentKind),
        createdById: round.createdById,
        documentSettings,
        status: round.status,
        isAnonymous: round.isAnonymous,
        minRaters: round.minRaters,
        folderId: round.folderId,
        folderName: round.folder?.name ?? null,
        selectionSettings,
        visibilitySettings,
        resultPresentationSettings,
        reportAnalysisSettings,
        ratingGuideSettings,
        startDate: formatDate(round.startDate),
        endDate: formatDate(round.endDate),
        targetCount: uniqueTargets.size,
        submittedCount,
        responseRate: toResponseRate(submittedCount, totalCount),
        questions: round.questions.map((question) => ({
          id: question.id,
          category: question.category,
          questionText: question.questionText,
          questionType: question.questionType,
          scaleMin: question.scaleMin,
          scaleMax: question.scaleMax,
        })),
        collaborators: round.collaborators.map((collaborator) => {
          const collaboratorAccess = buildFeedbackReviewAdminAccess({
            actorRole: collaborator.employee.role,
            groups: collaborator.employee.feedbackAdminGroupMemberships.map((membership) => ({
              id: membership.group.id,
              groupName: membership.group.groupName,
              reviewScope: membership.group.reviewScope,
            })),
          })
          const canReadContent =
            collaboratorAccess.canReadAllContent || collaboratorAccess.canReadCollaboratorContent

          return {
            employeeId: collaborator.employeeId,
            name: collaborator.employee.empName,
            departmentName: collaborator.employee.department.deptName,
            canReadContent,
          }
        }),
      }
    })

    const averageResponseRate = availableRounds.length
      ? Math.round(
          availableRounds.reduce((sum, round) => sum + round.responseRate, 0) / availableRounds.length
        )
      : 0

    const folders =
      reviewAdminAccess.canManageAllRounds
        ? await prisma.feedbackFolder.findMany({
            where: { orgId: selectedCycle.orgId },
            include: {
              _count: {
                select: {
                  rounds: true,
                },
              },
            },
            orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          })
        : []

    async function buildReviewAdminState() {
      const [reviewAdminGroups, reviewAdminEmployees] = await Promise.all([
        prisma.feedbackAdminGroup.findMany({
          where: {
            orgId: selectedCycle.orgId,
          },
          include: {
            members: {
              include: {
                employee: {
                  select: {
                    id: true,
                    empName: true,
                    gwsEmail: true,
                    position: true,
                    department: {
                      select: {
                        deptName: true,
                      },
                    },
                  },
                },
              },
              orderBy: {
                employee: {
                  empName: 'asc',
                },
              },
            },
          },
          orderBy: [{ groupName: 'asc' }],
        }),
        prisma.employee.findMany({
          where: {
            status: 'ACTIVE',
            department: {
              orgId: selectedCycle.orgId,
            },
          },
          select: {
            id: true,
            role: true,
            empName: true,
            gwsEmail: true,
            position: true,
            department: {
              select: {
                deptName: true,
              },
            },
            feedbackAdminGroupMemberships: {
              select: {
                group: {
                  select: {
                    id: true,
                    groupName: true,
                    reviewScope: true,
                  },
                },
              },
            },
          },
          orderBy: [{ empName: 'asc' }],
        }),
      ])

      return {
        currentAccess: {
          summaryScope: reviewAdminAccess.summaryScope,
          summaryLabel: reviewAdminAccess.summaryLabel,
          summaryDescription: reviewAdminAccess.summaryDescription,
          canManageAllRounds: reviewAdminAccess.canManageAllRounds,
          canManageCollaboratorRounds: reviewAdminAccess.canManageCollaboratorRounds,
          canReadAllContent: reviewAdminAccess.canReadAllContent,
          canReadCollaboratorContent: reviewAdminAccess.canReadCollaboratorContent,
        },
        groups: reviewAdminGroups.map((group) => ({
          id: group.id,
          groupName: group.groupName,
          description: group.description,
          reviewScope: group.reviewScope,
          reviewScopeLabel: FEEDBACK_ADMIN_SCOPE_LABELS[group.reviewScope],
          memberCount: group.members.length,
          members: group.members.map((member) => ({
            employeeId: member.employee.id,
            name: member.employee.empName,
            departmentName: member.employee.department.deptName,
            position: getPositionLabel(member.employee.position),
            email: member.employee.gwsEmail,
          })),
        })),
        candidateMembers: reviewAdminEmployees.map((candidate) => {
          const candidateAccess = buildFeedbackReviewAdminAccess({
            actorRole: candidate.role,
            groups: candidate.feedbackAdminGroupMemberships.map((membership) => membership.group),
          })

          return {
            employeeId: candidate.id,
            name: candidate.empName,
            departmentName: candidate.department.deptName,
            position: getPositionLabel(candidate.position),
            email: candidate.gwsEmail,
            summaryScope: candidateAccess.summaryScope,
            summaryLabel: candidateAccess.summaryLabel,
            canManageCollaboratorRounds: candidateAccess.canManageCollaboratorRounds,
            canReadCollaboratorContent: candidateAccess.canReadCollaboratorContent,
          }
        }),
      }
    }

    async function buildAnytimeReviewAdminState(
      reviewAdminState: Awaited<ReturnType<typeof buildReviewAdminState>>
    ) {
      const anytimeRounds = scopedRounds.filter((round) => round.roundType === 'ANYTIME')
      const anytimeRoundIds = anytimeRounds.map((round) => round.id)
      const anytimeAuditLogs = anytimeRoundIds.length
        ? await prisma.auditLog.findMany({
            where: {
              entityType: 'MultiFeedbackRound',
              entityId: {
                in: anytimeRoundIds,
              },
              action: {
                in: [
                  'FEEDBACK_ANYTIME_REVIEW_CREATED',
                  'FEEDBACK_ANYTIME_DUE_DATE_CHANGED',
                  'FEEDBACK_ANYTIME_REVIEWER_TRANSFERRED',
                  'FEEDBACK_ANYTIME_REVIEW_CANCELLED',
                  'FEEDBACK_ANYTIME_REVIEW_CLOSED',
                  'FEEDBACK_ANYTIME_REVIEW_REOPENED',
                ],
              },
            },
            orderBy: [{ timestamp: 'desc' }],
            select: {
              entityId: true,
              action: true,
              timestamp: true,
              newValue: true,
            },
          })
        : []

      const historySummary = (action: string, record: Record<string, unknown> | null) => {
        if (action === 'FEEDBACK_ANYTIME_REVIEW_CREATED') {
          return `문서 생성 · ${String(record?.targetName ?? '')}`.trim()
        }
        if (action === 'FEEDBACK_ANYTIME_DUE_DATE_CHANGED') {
          return `기한 변경 · ${String(record?.dueDate ?? '')}`.trim()
        }
        if (action === 'FEEDBACK_ANYTIME_REVIEWER_TRANSFERRED') {
          return `리뷰어 이관 · ${String(record?.reviewerName ?? '')}`.trim()
        }
        if (action === 'FEEDBACK_ANYTIME_REVIEW_CANCELLED') {
          return '문서 취소'
        }
        if (action === 'FEEDBACK_ANYTIME_REVIEW_CLOSED') {
          return '문서 종료'
        }
        if (action === 'FEEDBACK_ANYTIME_REVIEW_REOPENED') {
          return '문서 재오픈'
        }
        return '문서 이력'
      }

      const historyByRoundId = anytimeAuditLogs.reduce(
        (map, log) => {
          if (!log.entityId) return map
          const list = map.get(log.entityId) ?? []
          const record = parseAuditRecord(log.newValue)
          list.push({
            action: log.action,
            summary: historySummary(log.action, record),
            at: formatDate(log.timestamp),
          })
          map.set(log.entityId, list.slice(0, 5))
          return map
        },
        new Map<string, Array<{ action: string; summary: string; at: string }>>()
      )

      const now = new Date()
      return {
        summary: {
          totalCount: anytimeRounds.length,
          activeCount: anytimeRounds.filter((round) => round.status === 'IN_PROGRESS').length,
          overdueCount: anytimeRounds.filter((round) => round.status === 'IN_PROGRESS' && round.endDate < now).length,
          pipCount: anytimeRounds.filter((round) => round.documentKind === 'PIP').length,
          projectCount: anytimeRounds.filter((round) => round.documentKind === 'PROJECT').length,
        },
        employeeOptions: reviewAdminState.candidateMembers.map((candidate) => ({
          employeeId: candidate.employeeId,
          name: candidate.name,
          departmentName: candidate.departmentName,
          position: candidate.position,
          email: candidate.email,
        })),
        templateOptions: scopedRounds
          .filter((round) => round.roundType !== 'ANYTIME')
          .map((round) => ({
            roundId: round.id,
            roundName: round.roundName,
            roundType: round.roundType,
            documentKind: round.documentKind,
            documentKindLabel: getFeedbackAnytimeDocumentKindLabel(round.documentKind),
            questionCount: round.questions.length,
          }))
          .sort((a, b) => a.roundName.localeCompare(b.roundName, 'ko-KR')),
        documents: anytimeRounds
          .slice()
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .map((round) => {
            const feedback = round.feedbacks[0]
            const settings = parseFeedbackAnytimeDocumentSettings(round.documentSettings)

            return {
              roundId: round.id,
              roundName: round.roundName,
              documentKind: round.documentKind,
              documentKindLabel: getFeedbackAnytimeDocumentKindLabel(round.documentKind),
              status: round.status,
              lifecycleState: settings.lifecycleState ?? 'ACTIVE',
              startDate: formatDate(round.startDate),
              endDate: formatDate(round.endDate),
              createdAt: formatDate(round.createdAt),
              targetId: feedback?.receiverId,
              targetName: feedback?.receiver.empName ?? '-',
              targetDepartmentName: feedback?.receiver.department.deptName ?? '-',
              reviewerId: feedback?.giverId,
              reviewerName: feedback?.giver.empName ?? '-',
              reviewerDepartmentName: feedback?.giver.department.deptName ?? '-',
              reason: settings.reason,
              projectName: settings.projectName ?? null,
              projectCode: settings.projectCode ?? null,
              templateRoundName: settings.templateRoundName ?? null,
              feedbackStatus: feedback?.status,
              collaboratorCount: round.collaborators.length,
              pip: settings.pip,
              history: historyByRoundId.get(round.id) ?? [],
            }
          }),
      }
    }

    const pendingRequests = scopedRounds
      .flatMap((round) =>
        round.feedbacks
          .filter(
            (feedback) =>
              feedback.giverId === employee.id &&
              feedback.status !== 'SUBMITTED'
          )
          .map((feedback) => ({
            feedbackId: feedback.id,
            roundId: round.id,
            roundName: round.roundName,
            receiverId: feedback.receiverId,
            receiverName: feedback.receiver.empName,
            relationship: feedback.relationship,
            dueDate: formatDate(round.endDate),
            href: `/evaluation/360/respond/${encodeURIComponent(feedback.id)}?cycleId=${encodeURIComponent(
              selectedCycle.id
            )}&roundId=${encodeURIComponent(round.id)}`,
          }))
      )
      .slice(0, 8)

    const baseData: Feedback360PageData = {
      mode: params.mode,
      state: scopedRounds.length ? 'ready' : 'empty',
      message: rounds.length ? undefined : '새로운 라운드를 생성하거나 기존 평가 워크벤치, 평가 결과, 체크인 일정을 확인해 주세요.',
      currentUser,
      ...(rounds.length && params.mode === 'admin' && !scopedRounds.length
        ? { message: '공동 작업자로 지정된 리뷰만 관리할 수 있습니다. 현재 열람 가능한 리뷰가 없습니다.' }
        : {}),
      permissions: {
        canManageRounds:
          reviewAdminAccess.canManageAllRounds || reviewAdminAccess.canManageCollaboratorRounds,
        canSubmitNomination: true,
        canViewAdmin:
          reviewAdminAccess.canManageAllRounds || reviewAdminAccess.canManageCollaboratorRounds,
        canViewResults: true,
        canRespond: true,
      },
      availableCycles: availableCycles.map((cycle) => ({
        id: cycle.id,
        name: cycle.cycleName,
        year: cycle.evalYear,
        status: cycle.status,
      })),
      selectedCycleId: selectedCycle.id,
      availableRounds,
      selectedRoundId: selectedRound?.id,
      summary: {
        activeRounds: scopedRounds.filter((round) => ['RATER_SELECTION', 'IN_PROGRESS'].includes(round.status)).length,
        pendingResponses,
        submittedResponses,
        averageResponseRate,
        anonymityReadyCount: scopedRounds.filter((round) => {
          const submittedCount = round.feedbacks.filter((feedback) => feedback.status === 'SUBMITTED').length
          return submittedCount >= round.minRaters
        }).length,
      },
      pendingRequests,
    }

    const reviewAdminState = params.mode === 'admin' ? await buildReviewAdminState() : undefined
    const anytimeReviewState =
      params.mode === 'admin' && reviewAdminState
        ? await buildAnytimeReviewAdminState(reviewAdminState)
        : undefined

    if (!selectedRound) {
      if (params.mode === 'admin') {
        return {
          ...baseData,
          admin: {
            roundHealth: [],
            timeline: [],
            alerts: [],
            folders: folders.map((folder) => ({
              id: folder.id,
              name: folder.name,
              description: folder.description,
              color: folder.color,
              roundCount: folder._count.rounds,
            })),
            reminderTargets: [],
            settings: undefined,
            reviewAdmin: reviewAdminState,
            nominationQueue: [],
            resultShare: undefined,
            anytimeReview: anytimeReviewState,
            onboarding: undefined,
          },
        }
      }

      return baseData
    }

    const requestedTargetId = params.empId || employee.id
    const explicitTarget =
      requestedTargetId === employee.id
        ? employee
        : await prisma.employee.findUnique({
            where: { id: requestedTargetId },
            include: { department: true },
          })

    const canViewExplicitTarget =
      explicitTarget &&
      (canViewTarget({
        actorId: employee.id,
        actorRole: employee.role,
        target: explicitTarget,
      }) ||
        (params.mode === 'results' && canReadSelectedRoundContent))

    const target = canViewExplicitTarget ? explicitTarget : employee

    const nominationEntityId = `${selectedRound.id}:${target.id}`
    const [persistedNominations, nominationDraftLog, reportCache, developmentPlanRecord] = await Promise.all([
      prisma.feedbackNomination.findMany({
        where: {
          roundId: selectedRound.id,
          targetId: target.id,
        },
        include: {
          reviewer: {
            select: {
              id: true,
              empName: true,
            },
          },
        },
        orderBy: [{ relationship: 'asc' }, { reviewer: { empName: 'asc' } }],
      }),
      prisma.auditLog.findFirst({
        where: {
          entityType: 'FeedbackNominationDraft',
          entityId: nominationEntityId,
        },
        orderBy: { timestamp: 'desc' },
      }),
      prisma.feedbackReportCache.findUnique({
        where: {
          roundId_targetId: {
            roundId: selectedRound.id,
            targetId: target.id,
          },
        },
      }),
      prisma.developmentPlan.findFirst({
        where: {
          employeeId: target.id,
          sourceType: 'FEEDBACK_360',
          sourceId: `${selectedRound.id}:${target.id}`,
        },
        orderBy: { updatedAt: 'desc' },
      }),
    ])

    const savedDraft = parseAuditRecord(nominationDraftLog?.newValue)
    const persistedReviewers = persistedNominations.map((item) => ({
      employeeId: item.reviewerId,
      name: item.reviewer.empName,
      relationship: item.relationship,
    }))
    const savedReviewers = Array.isArray(savedDraft?.reviewers)
      ? savedDraft.reviewers
          .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
          .map((item) => ({
            employeeId: String(item.employeeId ?? ''),
            name: String(item.name ?? '이름 없음'),
            relationship: String(item.relationship ?? 'PEER'),
          }))
      : []

    const nominationSavedReviewers = persistedReviewers.length ? persistedReviewers : savedReviewers
    const nominationWorkflowStatus = getNominationAggregateStatus(persistedNominations.map((item) => item.status))

    if (params.mode === 'nomination') {
      const selectionSettings = parseFeedbackSelectionSettings(selectedRound.selectionSettings)
      const visibilitySettings = parseFeedbackVisibilitySettings(selectedRound.visibilitySettings)
      const sameDepartmentEmployees = await prisma.employee.findMany({
        where: {
          deptId: target.deptId,
          status: 'ACTIVE',
          id: { not: target.id },
        },
        select: {
          id: true,
          empName: true,
          department: { select: { deptName: true } },
        },
        orderBy: { empName: 'asc' },
        take: 12,
      })

      const subordinateEmployees = await prisma.employee.findMany({
        where: {
          status: 'ACTIVE',
          OR: [
            { teamLeaderId: target.id },
            { sectionChiefId: target.id },
            { divisionHeadId: target.id },
          ],
        },
        select: {
          id: true,
          empName: true,
          department: { select: { deptName: true } },
        },
        orderBy: { empName: 'asc' },
        take: 12,
      })

      const supervisorIds = [target.teamLeaderId, target.sectionChiefId, target.divisionHeadId].filter(Boolean) as string[]
      const supervisors = supervisorIds.length
        ? await prisma.employee.findMany({
            where: { id: { in: supervisorIds } },
            select: {
              id: true,
              empName: true,
              department: { select: { deptName: true } },
            },
          })
        : []

      const directReportIds = new Set(subordinateEmployees.map((reviewer) => reviewer.id))
      const peerReviewerCandidates = sameDepartmentEmployees.map((reviewer) => {
        let disabledReason: string | null = null

        if (supervisorIds.includes(reviewer.id)) {
          disabledReason = '본인 평가권자 및 상위 평가권자는 동료 리뷰 작성자로 선택할 수 없습니다.'
        } else if (
          selectionSettings.excludeDirectReportsFromPeerSelection &&
          directReportIds.has(reviewer.id)
        ) {
          disabledReason = '현재 설정에서는 리뷰 대상자의 직속 구성원을 동료 리뷰 작성자로 선택할 수 없습니다.'
        }

        return {
          employeeId: reviewer.id,
          name: reviewer.empName,
          department: reviewer.department.deptName,
          relationship: 'PEER' as const,
          selectable: disabledReason == null,
          disabledReason,
        }
      })

      const peerGroupHelp = [
        '본인, 본인 평가권자, 상위 평가권자는 동료 후보에서 자동 제외됩니다.',
        selectionSettings.excludeDirectReportsFromPeerSelection
          ? '현재 설정에서는 본인의 직속 구성원도 후보에서 제외됩니다.'
          : null,
      ]
        .filter(Boolean)
        .join(' ')

      return {
        ...baseData,
        nomination: {
          targetEmployee: {
            id: target.id,
            name: target.empName,
            department: target.department.deptName,
            position: getPositionLabel(target.position),
          },
          savedDraftCount: nominationSavedReviewers.length,
          selectionSettings,
          visibilitySettings,
          reviewerGroups: [
            {
              key: 'self',
              label: '본인',
              description: '자기 인식 비교용으로 본인 응답도 함께 확인합니다.',
              reviewers: [
                {
                  employeeId: target.id,
                  name: target.empName,
                  department: target.department.deptName,
                  relationship: 'SELF',
                },
              ],
            },
            {
              key: 'supervisor',
              label: '상사',
              description: '직속 리더 또는 상위 리더를 포함합니다.',
              reviewers: supervisors.map((reviewer) => ({
                employeeId: reviewer.id,
                name: reviewer.empName,
                department: reviewer.department.deptName,
                relationship: 'SUPERVISOR',
              })),
            },
            {
              key: 'peer',
              label: '동료',
              description: '같은 조직 안에서 협업 맥락이 있는 동료를 추천합니다.',
              helpMessage: peerGroupHelp,
              reviewers: peerReviewerCandidates,
            },
            {
              key: 'subordinate',
              label: '부하',
              description: '리더 역할을 가진 대상자라면 하향 피드백을 포함합니다.',
              reviewers: subordinateEmployees.map((reviewer) => ({
                employeeId: reviewer.id,
                name: reviewer.empName,
                department: reviewer.department.deptName,
                relationship: 'SUBORDINATE',
              })),
            },
          ],
          guidance: [
            '기본 anonymity threshold가 3명이며, 기준 미달 시 익명 요약과 텍스트 응답은 비공개 처리됩니다.',
            '상사 1명, 동료 3명, 부하 3명 기준으로 균형을 맞추고 필요한 경우 HR 예외를 확인합니다.',
            '이번 1차 구성원 단계에서는 nomination draft를 저장해 운영 검토와 승인 흐름을 연결하는 기반까지 제공합니다.',
          ],
          workflowStatus: nominationWorkflowStatus,
          counts: {
            total: persistedNominations.length,
            approved: persistedNominations.filter((item) => item.status === 'APPROVED' || item.status === 'PUBLISHED').length,
            published: persistedNominations.filter((item) => item.status === 'PUBLISHED').length,
          },
          canApprove: canApproveFeedbackTarget(employee.id, employee.role, target),
          canPublish: canManageSelectedRound,
          savedDraft: nominationSavedReviewers.length
            ? {
                updatedAt: nominationDraftLog ? formatDate(nominationDraftLog.timestamp) : formatDate(new Date()),
                reviewers: nominationSavedReviewers,
              }
            : undefined,
        },
      }
    }

    const targetFeedbacks = selectedRound.feedbacks.filter((feedback) => feedback.receiverId === target.id)
    const submittedTargetFeedbacks = targetFeedbacks.filter((feedback) => feedback.status === 'SUBMITTED')
    const thresholdMet = submittedTargetFeedbacks.length >= selectedRound.minRaters
    const categoryMap = new Map<string, number[]>()
    const textHighlights: string[] = []

    for (const feedback of submittedTargetFeedbacks) {
      for (const response of feedback.responses) {
        if (
          response.question.questionType === ('RATING_SCALE' as QuestionType) &&
          typeof response.ratingValue === 'number'
        ) {
          const current = categoryMap.get(response.question.category) ?? []
          current.push(response.ratingValue)
          categoryMap.set(response.question.category, current)
        }

        if (
          thresholdMet &&
          typeof response.textValue === 'string' &&
          response.textValue.trim().length >= 10 &&
          textHighlights.length < 5
        ) {
          textHighlights.push(response.textValue.trim())
        }
      }
    }

    const categoryScores = [...categoryMap.entries()].map(([category, values]) => ({
      category,
      average: Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10,
      count: values.length,
    }))
      .sort((a, b) => b.average - a.average)

    const strengths = categoryScores
      .slice(0, 3)
      .map((item) => `${item.category} 영역에서 평균 ${item.average}점으로 상대적 강점이 보입니다.`)
    const improvements = categoryScores
      .slice(-3)
      .reverse()
      .map((item) => `${item.category} 영역은 평균 ${item.average}점으로 추가 코칭이 필요합니다.`)

    const developmentFocus = improvements[0]?.split(' 영역')[0] ?? '조직과 성장'

    const persistedPayload = parsePersistedReportPayload(reportCache?.reportPayload)
    const persistedCategoryScores = Array.isArray(persistedPayload?.categoryScores)
      ? (persistedPayload.categoryScores as Array<{ category: string; average: number; count: number }>)
      : categoryScores
    const persistedStrengths = Array.isArray(persistedPayload?.strengths)
      ? (persistedPayload.strengths as string[])
      : strengths
    const persistedImprovements = Array.isArray(persistedPayload?.improvements)
      ? (persistedPayload.improvements as string[])
      : improvements
    const persistedTextHighlights = Array.isArray(persistedPayload?.textHighlights)
      ? (persistedPayload.textHighlights as string[])
      : textHighlights
    const persistedDevelopmentPlan = parsePersistedReportPayload(persistedPayload?.developmentPlan)
    const resolvedStrengths = persistedStrengths.length
      ? persistedStrengths
      : ['아직 충분한 응답이 없어 강점 테마를 생성하지 못했습니다.']
    const resolvedImprovements = persistedImprovements.length
      ? persistedImprovements
      : ['익명 기준을 충족하면 개선 신호를 더 선명하게 볼 수 있습니다.']
    const resolvedDevelopmentPlan =
      persistedDevelopmentPlan &&
      typeof persistedDevelopmentPlan.focusArea === 'string' &&
      Array.isArray(persistedDevelopmentPlan.actions) &&
      Array.isArray(persistedDevelopmentPlan.managerSupport) &&
      Array.isArray(persistedDevelopmentPlan.nextCheckinTopics)
        ? {
            focusArea: persistedDevelopmentPlan.focusArea,
            actions: persistedDevelopmentPlan.actions.filter(
              (item): item is string => typeof item === 'string' && item.trim().length > 0
            ),
            managerSupport: persistedDevelopmentPlan.managerSupport.filter(
              (item): item is string => typeof item === 'string' && item.trim().length > 0
            ),
            nextCheckinTopics: persistedDevelopmentPlan.nextCheckinTopics.filter(
              (item): item is string => typeof item === 'string' && item.trim().length > 0
            ),
            recommendedCompetencies: Array.isArray(persistedDevelopmentPlan.recommendedCompetencies)
              ? persistedDevelopmentPlan.recommendedCompetencies.filter(
                  (item): item is string => typeof item === 'string' && item.trim().length > 0
                )
              : [],
            linkedEvidence: normalizeDevelopmentPlanLinkedEvidence(persistedDevelopmentPlan.linkedEvidence),
          }
        : null
    const groupedResponses = buildGroupedResponses({
      feedbacks: submittedTargetFeedbacks.map((feedback) => ({
        id: feedback.id,
        relationship: feedback.relationship,
        giver: { empName: feedback.giver.empName },
        responses: feedback.responses.map((response) => ({
          questionId: response.questionId,
          ratingValue: response.ratingValue,
          textValue: response.textValue,
          question: {
            category: response.question.category,
            questionText: response.question.questionText ?? null,
          },
        })),
      })),
      thresholdMet,
      visibilitySettings: parseFeedbackVisibilitySettings(selectedRound.visibilitySettings),
    })
    const warnings = buildResultWarnings({
      thresholdMet,
      feedbackCount: submittedTargetFeedbacks.length,
      strengths: resolvedStrengths,
      improvements: resolvedImprovements,
    })
    const resultSelectionSettings = parseFeedbackSelectionSettings(selectedRound.selectionSettings)
    const resultPresentationSettings = parseFeedbackResultPresentationSettings(
      selectedRound.resultPresentationSettings
    )
    const reportAnalysisSettings = parseFeedbackReportAnalysisSettings(
      selectedRound.reportAnalysisSettings
    )
    const resolvedRoleGuide = resolveFeedbackRoleGuide({
      settings: resultSelectionSettings.skillArchitecture,
      target: {
        departmentName: target.department.deptName,
        role: target.role,
        position: target.position,
        jobTitle: target.jobTitle ?? undefined,
        teamName: target.teamName ?? undefined,
      },
    })
    const recentGoalRecords = resultSelectionSettings.aiCopilot.enabled
      ? await prisma.personalKpi.findMany({
          where: {
            employeeId: target.id,
            evalYear: selectedCycle.evalYear,
          },
          orderBy: [{ weight: 'desc' }, { updatedAt: 'desc' }],
          take: 5,
          select: {
            id: true,
            kpiName: true,
            weight: true,
            status: true,
          },
        })
      : []
    const recentCheckinRecords = resultSelectionSettings.aiCopilot.enabled
      ? await prisma.checkIn.findMany({
          where: {
            ownerId: target.id,
            status: {
              in: ['IN_PROGRESS', 'COMPLETED', 'RESCHEDULED'],
            },
          },
          orderBy: [{ updatedAt: 'desc' }],
          take: 3,
          select: {
            scheduledDate: true,
            ownerNotes: true,
            managerNotes: true,
            actionItems: true,
          },
        })
      : []
    const roleGuideViewModel: FeedbackRoleGuideViewModel | undefined = resolvedRoleGuide
      ? {
          label: resolvedRoleGuide.label,
          jobFamily: resolvedRoleGuide.jobFamily,
          level: resolvedRoleGuide.level,
          guideText: resolvedRoleGuide.guideText,
          expectedCompetencies: resolvedRoleGuide.expectedCompetencies,
          nextLevelExpectations: resolvedRoleGuide.nextLevelExpectations,
          goalLibrary: resolvedRoleGuide.goalLibrary,
        }
      : undefined
    const recentGoals = recentGoalRecords.map(
      (goal) => `${goal.kpiName} · ${formatGoalWeightLabel(goal.weight)} · ${goal.status}`
    )
    const recentCheckins = recentCheckinRecords
      .flatMap((checkin) =>
        [checkin.ownerNotes, checkin.managerNotes]
          .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
          .map((item) => `${formatDate(checkin.scheduledDate)} · ${item}`)
      )
      .slice(0, 4)
    const feedbackSignals = [...resolvedStrengths, ...resolvedImprovements, ...persistedTextHighlights].slice(0, 6)
    const recipientProfile = resolveFeedbackResultPresentationProfile({
      actorId: employee.id,
      actorRole: employee.role,
      target,
      requestedProfile: params.resultVersion,
    })
    const presentationSettings = resultPresentationSettings[recipientProfile]
    const primaryLeaderId = resolveFeedbackResultPrimaryLeaderId(target)
    const executiveLeaderIds = [target.sectionChiefId, target.divisionHeadId].filter(
      (leaderId): leaderId is string => Boolean(leaderId) && leaderId !== primaryLeaderId
    )
    const leaderFeedback =
      primaryLeaderId
        ? submittedTargetFeedbacks.find((feedback) => feedback.giverId === primaryLeaderId) ?? null
        : null
    const executiveFeedback =
      executiveLeaderIds
        .map((leaderId) => submittedTargetFeedbacks.find((feedback) => feedback.giverId === leaderId) ?? null)
        .find((feedback): feedback is NonNullable<typeof leaderFeedback> => Boolean(feedback)) ?? null
    const finalTotalScore = averageFeedbackTotalScores(submittedTargetFeedbacks)
    const finalComment =
      typeof persistedPayload?.anonymousSummary === 'string'
        ? persistedPayload.anonymousSummary
        : persistedTextHighlights[0] ?? null
    const managerEffectivenessLeaderSummaries = resultSelectionSettings.managerEffectiveness.enabled
      ? buildManagerEffectivenessLeaderSummaries({
          feedbacks: selectedRound.feedbacks as ManagerEffectivenessRoundFeedback[],
          competencyLabels: resultSelectionSettings.managerEffectiveness.competencyLabels,
          targetScope: resultSelectionSettings.managerEffectiveness.targetScope,
        })
      : []
    const managerEffectivenessResult =
      resultSelectionSettings.managerEffectiveness.enabled &&
      (resultSelectionSettings.managerEffectiveness.targetScope !== 'MANAGERS_ONLY' ||
        isManagerEffectivenessTarget({ position: target.position }))
        ? managerEffectivenessLeaderSummaries.find((item) => item.employeeId === target.id)
            ? {
                enabled: true,
                overallScore:
                  managerEffectivenessLeaderSummaries.find((item) => item.employeeId === target.id)?.overallScore ??
                  null,
                benchmarkAverage:
                  managerEffectivenessLeaderSummaries.find((item) => item.employeeId === target.id)
                    ?.benchmarkAverage ?? null,
                benchmarkDelta:
                  managerEffectivenessLeaderSummaries.find((item) => item.employeeId === target.id)?.benchmarkDelta ??
                  null,
                riskLevel:
                  managerEffectivenessLeaderSummaries.find((item) => item.employeeId === target.id)?.riskLevel ??
                  'LOW',
                reviewerSummary: getManagerEffectivenessReviewerSummary(
                  resultSelectionSettings.managerEffectiveness
                ),
                competencyLabels: resultSelectionSettings.managerEffectiveness.competencyLabels,
                strengths:
                  managerEffectivenessLeaderSummaries.find((item) => item.employeeId === target.id)?.strengths ?? [],
                improvements:
                  managerEffectivenessLeaderSummaries.find((item) => item.employeeId === target.id)?.improvements ??
                  [],
                coachingPack:
                  managerEffectivenessLeaderSummaries.find((item) => item.employeeId === target.id)?.coachingPack ??
                  buildManagerEffectivenessCoachingPack({
                    leaderName: target.empName,
                    strengths: [],
                    improvements: [],
                    competencyLabels: resultSelectionSettings.managerEffectiveness.competencyLabels,
                    overallScore: null,
                    benchmarkDelta: null,
                  }),
              }
            : undefined
        : undefined
    const summaryCards = [
      {
        id: 'LEADER_REVIEW' as const,
        title: '팀장 평가',
        reviewerName: leaderFeedback?.giver.empName,
        relationshipLabel: '직속 리더',
        totalScore: leaderFeedback
          ? calculateFeedbackResponseTotalScore({ responses: leaderFeedback.responses })
          : null,
        comment: leaderFeedback?.overallComment ?? null,
        showScore: presentationSettings.showLeaderScore,
        showComment: presentationSettings.showLeaderComment,
      },
      {
        id: 'EXECUTIVE_REVIEW' as const,
        title: '상위 평가',
        reviewerName: executiveFeedback?.giver.empName,
        relationshipLabel: '상위 평가권자',
        totalScore: executiveFeedback
          ? calculateFeedbackResponseTotalScore({ responses: executiveFeedback.responses })
          : null,
        comment: executiveFeedback?.overallComment ?? null,
        showScore: presentationSettings.showExecutiveScore,
        showComment: presentationSettings.showExecutiveComment,
      },
      {
        id: 'FINAL_RESULT' as const,
        title: '최종 결과',
        relationshipLabel: '종합 결과',
        totalScore: finalTotalScore,
        comment: thresholdMet ? finalComment : null,
        showScore: presentationSettings.showFinalScore,
        showComment: presentationSettings.showFinalComment,
      },
    ].filter((card) => card.showScore || card.showComment)

    const reportAnalysis = buildFeedbackReportAnalysis({
      settings: reportAnalysisSettings,
      roundName: selectedRound.roundName,
      recipientProfile,
      pdfHref: `/api/feedback/rounds/${encodeURIComponent(selectedRound.id)}/results-export?targetId=${encodeURIComponent(target.id)}&profile=${encodeURIComponent(recipientProfile)}`,
      links: [
        {
          label: '평가 결과 화면',
          href: '/evaluation/results',
          description: '기존 평가 결과 화면과 연결해 결과 안내 흐름으로 이어갑니다.',
        },
        {
          label: '360 결과 PDF',
          href: `/api/feedback/rounds/${encodeURIComponent(selectedRound.id)}/results-export?targetId=${encodeURIComponent(target.id)}&profile=${encodeURIComponent(recipientProfile)}&download=1`,
          description: '현재 결과지 버전 기준 PDF를 바로 내려받을 수 있습니다.',
        },
      ],
      questions: selectedRound.questions.map((question) => ({
        id: question.id,
        category: question.category,
        questionText: question.questionText,
        questionType: question.questionType,
      })),
      targetFeedbacks: submittedTargetFeedbacks.map((feedback) => ({
        id: feedback.id,
        relationship: feedback.relationship,
        giverName: feedback.giver.empName,
        overallComment: feedback.overallComment,
        submittedAt: feedback.submittedAt ?? feedback.createdAt,
        responses: feedback.responses.map((response) => ({
          questionId: response.questionId,
          ratingValue: response.ratingValue,
          textValue: response.textValue,
          question: {
            category: response.question.category,
            questionText: response.question.questionText ?? '',
            questionType: response.question.questionType,
          },
        })),
      })),
      benchmarkFeedbacks: selectedRound.feedbacks
        .filter((feedback) => feedback.status === 'SUBMITTED')
        .map((feedback) => ({
          id: feedback.id,
          relationship: feedback.relationship,
          giverName: feedback.giver.empName,
          overallComment: feedback.overallComment,
          submittedAt: feedback.submittedAt ?? feedback.createdAt,
          responses: feedback.responses.map((response) => ({
            questionId: response.questionId,
            ratingValue: response.ratingValue,
            textValue: response.textValue,
            question: {
              category: response.question.category,
              questionText: response.question.questionText ?? '',
              questionType: response.question.questionType,
            },
          })),
        })),
    })

    if (params.mode === 'results') {
      return {
        ...baseData,
        results: {
          roundName: selectedRound.roundName,
          targetEmployee: {
            id: target.id,
            name: target.empName,
            department: target.department.deptName,
            position: getPositionLabel(target.position),
          },
          recipientProfile,
          availableProfiles:
            employee.role === 'ROLE_ADMIN' || canReadSelectedRoundContent
              ? Object.entries(FEEDBACK_RESULT_PROFILE_LABELS).map(([value, label]) => ({
                  value: value as FeedbackResultRecipientProfile,
                  label,
                }))
              : [
                  {
                    value: recipientProfile,
                    label: FEEDBACK_RESULT_PROFILE_LABELS[recipientProfile],
                  },
                ],
          presentationSettings,
          anonymityThreshold: selectedRound.minRaters,
          feedbackCount: reportCache?.feedbackCount ?? submittedTargetFeedbacks.length,
          thresholdMet: reportCache?.thresholdMet ?? thresholdMet,
          roundWeight: selectedRound.weightInFinal,
          summaryCards,
          categoryScores: persistedCategoryScores,
          strengths: strengths.length ? strengths : ['아직 충분한 응답이 없어 강점 테마를 생성하지 못했습니다.'],
          improvements: improvements.length ? improvements : ['익명 기준을 충족하면 개선 신호를 더 선명하게 볼 수 있습니다.'],
          anonymousSummary: thresholdMet
            ? '익명성을 유지한 상태로 강점, blind spot, 개발 시그널을 요약해 제공합니다.'
            : `현재 응답 수는 ${submittedTargetFeedbacks.length}건이며 익명 요약 공개 기준 ${selectedRound.minRaters}건에 아직 미달합니다.`,
          textHighlights: persistedTextHighlights,
          groupedResponses,
          warnings,
          developmentPlan: {
            focusArea: resolvedDevelopmentPlan?.focusArea ?? `${developmentFocus} 성장 강화`,
            actions:
              resolvedDevelopmentPlan?.actions ?? [
                '다음 체크인에서 blind spot 한 가지를 실제 사례와 함께 점검합니다.',
                '다음 분기 개인 목표 중 하나를 성장 과제와 직접 연결합니다.',
                '반복해서 나온 피드백 한 항목을 2주 단위 실험으로 관리합니다.',
              ],
            managerSupport:
              resolvedDevelopmentPlan?.managerSupport ?? [
                '리더는 행동 예시 기반 피드백을 최소 월 1회 제공합니다.',
                '다음 1:1에서 실행 결과와 체감 변화를 함께 점검합니다.',
              ],
            nextCheckinTopics:
              resolvedDevelopmentPlan?.nextCheckinTopics ?? [
                '최근 강점과 현재 목표 실행 방식을 어떻게 연결할지',
                'blind spot를 줄이기 위한 다음 행동 실험',
                '다음 달 확인할 구체적 증거와 점검 방식',
              ],
            recommendedCompetencies:
              resolvedDevelopmentPlan?.recommendedCompetencies ??
              roleGuideViewModel?.expectedCompetencies.slice(0, 4) ??
              [],
            linkedEvidence: resolvedDevelopmentPlan?.linkedEvidence.length
              ? resolvedDevelopmentPlan.linkedEvidence
              : normalizeDevelopmentPlanLinkedEvidence(developmentPlanRecord?.linkedEvidence).length
                ? normalizeDevelopmentPlanLinkedEvidence(developmentPlanRecord?.linkedEvidence)
                : [
                    ...recentGoalRecords.slice(0, 2).map((goal) => ({
                      type: 'GOAL' as const,
                      label: goal.kpiName,
                      description: `${formatGoalWeightLabel(goal.weight)} · ${goal.status}`,
                    })),
                    ...recentCheckinRecords.slice(0, 2).map((checkin) => ({
                      type: 'CHECKIN' as const,
                      label: `${formatDate(checkin.scheduledDate)} 1:1`,
                      description: checkin.managerNotes || checkin.ownerNotes || '최근 점검 기록',
                    })),
                    ...persistedTextHighlights.slice(0, 1).map((item) => ({
                      type: 'REVIEW' as const,
                      label: '최근 리뷰 핵심 문장',
                      description: item,
                    })),
                  ],
          },
          reportCache: reportCache
            ? {
                id: reportCache.id,
                generatedAt: formatDate(reportCache.generatedAt),
                source: 'persisted',
              }
            : undefined,
          developmentPlanRecord: developmentPlanRecord
            ? {
                id: developmentPlanRecord.id,
                title: developmentPlanRecord.title,
                status: developmentPlanRecord.status,
                updatedAt: formatDate(developmentPlanRecord.updatedAt),
                actions: normalizeDevelopmentPlanActionItems(developmentPlanRecord.actions),
                recommendedCompetencies: normalizeDevelopmentPlanStringArray(
                  developmentPlanRecord.recommendedCompetencies
                ),
                managerSupport: normalizeDevelopmentPlanStringArray(developmentPlanRecord.managerSupport),
                nextCheckinTopics: normalizeDevelopmentPlanStringArray(developmentPlanRecord.nextCheckinTopics),
                linkedEvidence: normalizeDevelopmentPlanLinkedEvidence(developmentPlanRecord.linkedEvidence),
                note: developmentPlanRecord.note,
                dueDate: developmentPlanRecord.dueDate ? formatDate(developmentPlanRecord.dueDate) : null,
                progressRate: calculateDevelopmentPlanProgress(
                  normalizeDevelopmentPlanActionItems(developmentPlanRecord.actions)
                ).progressRate,
              }
            : undefined,
          roleGuide: roleGuideViewModel,
          growthCopilot: resultSelectionSettings.aiCopilot.enabled
            ? {
                enabled: true,
                canView:
                  employee.role === 'ROLE_ADMIN' ||
                  (recipientProfile === 'LEADER' && resultSelectionSettings.aiCopilot.allowManagerView) ||
                  (recipientProfile === 'REVIEWEE' && resultSelectionSettings.aiCopilot.allowSelfView),
                disclaimer: resultSelectionSettings.aiCopilot.disclaimer,
                roleGuideLabel: roleGuideViewModel?.label,
                recommendedCompetencies:
                  roleGuideViewModel?.expectedCompetencies.length
                    ? roleGuideViewModel.expectedCompetencies.slice(0, 5)
                    : normalizeDevelopmentPlanStringArray(developmentPlanRecord?.recommendedCompetencies),
                recentGoals,
                recentCheckins,
                feedbackSignals,
                aiPayload: {
                  employeeId: target.id,
                  employeeName: target.empName,
                  roleGuide: roleGuideViewModel,
                  recentGoals,
                  recentCheckins,
                  feedbackSignals,
                  categoryScores: persistedCategoryScores,
                  strengths: resolvedStrengths,
                  improvements: resolvedImprovements,
                },
              }
            : undefined,
          linkage: [
            {
              label: '평가 워크벤치로 이동',
              href: `/evaluation/workbench?cycleId=${encodeURIComponent(selectedCycle.id)}`,
              description: '서면 피드백을 평가 근거로 다시 검토할 수 있습니다.',
            },
            {
              label: '평가 결과 보기',
              href: '/evaluation/results',
              description: '최종 결과 리포트와 성장 제안 화면으로 이동합니다.',
            },
            {
              label: '이의 신청 정책 확인',
              href: '/evaluation/appeal',
              description: '서면 피드백은 익명 기준을 지키며 결과 설명의 보조 근거로만 사용합니다.',
            },
            {
              label: '다음 체크인 준비',
              href: '/checkin',
              description: '개발 계획 초안을 체크인 액션으로 이어갑니다.',
            },
          ],
          pdfHref: `/api/feedback/rounds/${encodeURIComponent(selectedRound.id)}/results-export?targetId=${encodeURIComponent(target.id)}&profile=${encodeURIComponent(recipientProfile)}`,
          analysis: reportAnalysis,
          managerEffectiveness: managerEffectivenessResult,
        },
      }
    }

    if (params.mode === 'admin') {
      const roundHealth = scopedRounds.map((round) => {
        const roundSubmitted = round.feedbacks.filter((feedback) => feedback.status === 'SUBMITTED')
        const qualityRiskCount = roundSubmitted.filter((feedback) => {
          const ratingValues = feedback.responses
            .map((response) => response.ratingValue)
            .filter((value): value is number => typeof value === 'number')
          const textResponses = feedback.responses
            .map((response) => response.textValue)
            .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)

          const identicalScores = ratingValues.length >= 3 && new Set(ratingValues).size === 1
          const weakText = textResponses.length > 0 && textResponses.every((text) => text.trim().length < 12)
          return identicalScores || weakText
        }).length

        const submittedCount = roundSubmitted.length
        const totalCount = round.feedbacks.length

        return {
          roundId: round.id,
          roundName: round.roundName,
          responseRate: toResponseRate(submittedCount, totalCount),
          pendingCount: totalCount - submittedCount,
          submittedCount,
          thresholdMet: submittedCount >= round.minRaters,
          qualityRiskCount,
        }
      })

      const nominationRecords = await prisma.feedbackNomination.findMany({
        where: {
          roundId: { in: scopedRounds.map((round) => round.id) },
        },
        include: {
          target: {
            select: {
              id: true,
              empName: true,
            },
          },
          round: {
            select: {
              id: true,
              roundName: true,
            },
          },
        },
        orderBy: [{ updatedAt: 'desc' }],
      })

      const nominationQueue = Array.from(
        nominationRecords.reduce((map, item) => {
          const key = `${item.roundId}:${item.targetId}`
          const current = map.get(key) ?? {
            targetId: item.targetId,
            targetName: item.target.empName,
            roundId: item.roundId,
            roundName: item.round.roundName,
            statuses: [] as FeedbackNominationStatus[],
          }

          current.statuses.push(item.status)
          map.set(key, current)
          return map
        }, new Map<string, { targetId: string; targetName: string; roundId: string; roundName: string; statuses: FeedbackNominationStatus[] }>())
      )
        .map(([, item]) => ({
          targetId: item.targetId,
          targetName: item.targetName,
          roundId: item.roundId,
          roundName: item.roundName,
          status: getNominationAggregateStatus(item.statuses),
          totalCount: item.statuses.length,
          approvedCount: item.statuses.filter((status) => status === 'APPROVED' || status === 'PUBLISHED').length,
          publishedCount: item.statuses.filter((status) => status === 'PUBLISHED').length,
        }))
        .slice(0, 12)

      const resultShareAuditLogs = selectedRound
        ? await prisma.auditLog.findMany({
            where: {
              entityType: 'MultiFeedbackRound',
              entityId: selectedRound.id,
              action: {
                in: ['FEEDBACK_RESULT_SHARED', 'FEEDBACK_RESULT_VIEWED'],
              },
            },
            orderBy: [{ timestamp: 'desc' }],
            select: {
              action: true,
              timestamp: true,
              newValue: true,
            },
          })
        : []

      const resultShareTargets = selectedRound
        ? Array.from(
            selectedRound.feedbacks
              .filter((feedback) => feedback.status === 'SUBMITTED')
              .reduce((map, feedback) => {
                if (!map.has(feedback.receiverId)) {
                  map.set(feedback.receiverId, feedback.receiver)
                }
                return map
              }, new Map<string, (typeof selectedRound.feedbacks)[number]['receiver']>())
              .values()
          )
        : []

      const resultShareLeaderIds = Array.from(
        new Set(
          resultShareTargets
            .map((target) => resolveFeedbackResultPrimaryLeaderId(target))
            .filter((value): value is string => Boolean(value))
        )
      )

      const resultShareLeaders = resultShareLeaderIds.length
        ? await prisma.employee.findMany({
            where: {
              id: {
                in: resultShareLeaderIds,
              },
            },
            select: {
              id: true,
              empName: true,
            },
          })
        : []

      const resultShareLeadersById = new Map(
        resultShareLeaders.map((leader) => [leader.id, leader.empName] as const)
      )

      const resultShareRows = resultShareTargets.map((target) => {
        const leaderId = resolveFeedbackResultPrimaryLeaderId(target)
        const leaderSharedAt = leaderId
          ? getLatestAuditTimestamp({
              logs: resultShareAuditLogs,
              targetId: target.id,
              recipientRole: 'LEADER',
              action: 'FEEDBACK_RESULT_SHARED',
            })
          : undefined
        const leaderViewedAt = leaderId
          ? getLatestAuditTimestamp({
              logs: resultShareAuditLogs,
              targetId: target.id,
              recipientRole: 'LEADER',
              action: 'FEEDBACK_RESULT_VIEWED',
            })
          : undefined
        const revieweeSharedAt = getLatestAuditTimestamp({
          logs: resultShareAuditLogs,
          targetId: target.id,
          recipientRole: 'REVIEWEE',
          action: 'FEEDBACK_RESULT_SHARED',
        })
        const revieweeViewedAt = getLatestAuditTimestamp({
          logs: resultShareAuditLogs,
          targetId: target.id,
          recipientRole: 'REVIEWEE',
          action: 'FEEDBACK_RESULT_VIEWED',
        })

        const leaderStatus = leaderId
          ? resolveReceiptStatus({
              sharedAt: leaderSharedAt,
              viewedAt: leaderViewedAt,
            })
          : resolveReceiptStatus({
              sharedAt: leaderSharedAt,
              viewedAt: leaderViewedAt,
              unavailable: true,
            })

        return {
          targetId: target.id,
          targetName: target.empName,
          departmentName: target.department.deptName,
          leaderName: leaderId ? resultShareLeadersById.get(leaderId) ?? undefined : undefined,
          leaderStatus,
          leaderSharedAt,
          leaderViewedAt,
          revieweeStatus: resolveReceiptStatus({
            sharedAt: revieweeSharedAt,
            viewedAt: revieweeViewedAt,
          }),
          revieweeSharedAt,
          revieweeViewedAt,
          resultHref: `/evaluation/360/results?cycleId=${encodeURIComponent(selectedCycle.id)}&roundId=${encodeURIComponent(selectedRound?.id ?? '')}&empId=${encodeURIComponent(target.id)}`,
        }
      })

      const resultShareSummary = selectedRound
        ? {
            roundId: selectedRound.id,
            roundName: selectedRound.roundName,
            totalTargets: resultShareRows.length,
            leaderSharedCount: resultShareRows.filter((row) => row.leaderStatus === 'SHARED' || row.leaderStatus === 'VIEWED').length,
            leaderViewedCount: resultShareRows.filter((row) => row.leaderStatus === 'VIEWED').length,
            revieweeSharedCount: resultShareRows.filter((row) => row.revieweeStatus === 'SHARED' || row.revieweeStatus === 'VIEWED').length,
            revieweeViewedCount: resultShareRows.filter((row) => row.revieweeStatus === 'VIEWED').length,
            rows: resultShareRows,
          }
        : undefined

      const managerEffectivenessAdmin = resultSelectionSettings.managerEffectiveness.enabled
        ? {
            enabled: true,
            targetScope: resultSelectionSettings.managerEffectiveness.targetScope,
            reviewerSummary: getManagerEffectivenessReviewerSummary(
              resultSelectionSettings.managerEffectiveness
            ),
            competencyLabels: resultSelectionSettings.managerEffectiveness.competencyLabels,
            summary: {
              leaderCount: managerEffectivenessLeaderSummaries.length,
              averageScore: averageNumber(
                managerEffectivenessLeaderSummaries.map((leader) => leader.overallScore)
              ),
              highRiskCount: managerEffectivenessLeaderSummaries.filter(
                (leader) => leader.riskLevel === 'HIGH'
              ).length,
              coachingReadyCount: managerEffectivenessLeaderSummaries.filter(
                (leader) => leader.coachingPack.nextOneOnOneQuestions.length > 0
              ).length,
            },
            heatmap: Array.from(
              managerEffectivenessLeaderSummaries.reduce(
                (map, leader) => {
                  const current = map.get(leader.departmentName) ?? []
                  current.push(leader)
                  map.set(leader.departmentName, current)
                  return map
                },
                new Map<string, ManagerEffectivenessLeaderSummary[]>()
              )
            ).map(([departmentName, leaders]) => ({
              departmentName,
              leaderCount: leaders.length,
              averageScore: averageNumber(leaders.map((leader) => leader.overallScore)),
              highRiskCount: leaders.filter((leader) => leader.riskLevel === 'HIGH').length,
            })),
            topImprovementThemes: Array.from(
              managerEffectivenessLeaderSummaries.reduce(
                (map, leader) => {
                  leader.improvements.forEach((label) => {
                    map.set(label, (map.get(label) ?? 0) + 1)
                  })
                  return map
                },
                new Map<string, number>()
              )
            )
              .map(([label, count]) => ({ label, count }))
              .sort((a, b) => b.count - a.count)
              .slice(0, 6),
            leaders: managerEffectivenessLeaderSummaries,
          }
        : undefined

      const reminderTargets = [
        ...scopedRounds.flatMap((round) =>
          round.feedbacks
            .filter((feedback) => feedback.status !== 'SUBMITTED')
            .map((feedback) => {
              const status = describeReminderStatus('review-reminder', feedback.status)
              return {
                kind: 'review-reminder' as const,
                recipientId: feedback.giverId,
                recipientName: feedback.giver.empName,
                departmentName: feedback.giver.department.deptName,
                roundId: round.id,
                roundName: round.roundName,
                statusKey: status.key,
                statusLabel: status.label,
                statusTone: status.tone,
                detail: `${feedback.receiver.empName} · ${feedback.relationship} · 마감 ${formatDate(round.endDate)}`,
              }
            })
        ),
        ...nominationQueue
          .filter((item) => item.status !== 'PUBLISHED')
          .map((item) => {
            const status = describeReminderStatus('peer-selection-reminder', item.status)
            return {
              kind: 'peer-selection-reminder' as const,
              recipientId: item.targetId,
              recipientName: item.targetName,
              roundId: item.roundId,
              roundName: item.roundName,
              statusKey: status.key,
              statusLabel: status.label,
              statusTone: status.tone,
              detail: `현재 상태 ${item.status} · 승인 ${item.approvedCount}/${item.totalCount}`,
            }
          }),
        ...scopedRounds.flatMap((round) => {
          const uniqueReceivers = new Map<string, (typeof round.feedbacks)[number]>()
          for (const feedback of round.feedbacks.filter((item) => item.status === 'SUBMITTED')) {
            if (!uniqueReceivers.has(feedback.receiverId)) {
              uniqueReceivers.set(feedback.receiverId, feedback)
            }
          }

          return [...uniqueReceivers.values()].map((feedback) => {
            const status = describeReminderStatus('result-share', 'RESULT_READY')
            return {
              kind: 'result-share' as const,
              recipientId: feedback.receiverId,
              recipientName: feedback.receiver.empName,
              departmentName: feedback.receiver.department.deptName,
              roundId: round.id,
              roundName: round.roundName,
              statusKey: status.key,
              statusLabel: status.label,
              statusTone: status.tone,
              detail: `제출 ${round.feedbacks.filter((item) => item.receiverId === feedback.receiverId && item.status === 'SUBMITTED').length}건`,
            }
          })
        }),
      ]

      const onboardingSnapshotResult =
        reviewAdminAccess.canManageAllRounds
          ? await Promise.resolve()
              .then(() => getOnboardingReviewAdminSnapshot({ cycleId: selectedCycle.id }))
              .then((data) => ({ data, alert: null as string | null }))
              .catch((error) => ({
                data: null,
                alert:
                  error instanceof Error
                    ? `온보딩 리뷰 워크플로우 정보를 불러오지 못했습니다. ${error.message}`
                    : '온보딩 리뷰 워크플로우 정보를 불러오지 못했습니다.',
              }))
          : { data: null, alert: null as string | null }

      return {
        ...baseData,
        admin: {
          roundHealth,
          timeline: scopedRounds.slice(0, 6).map((round) => ({
              title: round.roundName,
              description: `${round.status} · 응답률 ${toResponseRate(round.feedbacks.filter((feedback) => feedback.status === 'SUBMITTED').length, round.feedbacks.length)}%`,
              at: formatDate(round.endDate),
            })),
          alerts: [
            ...roundHealth.flatMap((item) => {
            const alerts: string[] = []
            if (item.responseRate < 60) {
              alerts.push(`${item.roundName}의 응답률이 낮아 reminder cadence 조정이 필요합니다.`)
            }
            if (item.qualityRiskCount > 0) {
              alerts.push(`${item.roundName}에서 careless review로 보이는 응답 ${item.qualityRiskCount}건이 감지되었습니다.`)
               }
              return alerts
            }),
            ...(onboardingSnapshotResult.alert ? [onboardingSnapshotResult.alert] : []),
          ],
          folders: folders.map((folder) => ({
            id: folder.id,
            name: folder.name,
            description: folder.description,
            color: folder.color,
            roundCount: folder._count.rounds,
          })),
          reminderTargets,
          settings: selectedRound
              ? {
                  selectionSettings: parseFeedbackSelectionSettings(selectedRound.selectionSettings),
                  visibilitySettings: parseFeedbackVisibilitySettings(selectedRound.visibilitySettings),
                  resultPresentationSettings: parseFeedbackResultPresentationSettings(
                    selectedRound.resultPresentationSettings
                  ),
                  reportAnalysisSettings: parseFeedbackReportAnalysisSettings(
                    selectedRound.reportAnalysisSettings
                  ),
                  ratingGuideSettings: parseFeedbackRatingGuideSettings(
                    selectedRound.ratingGuideSettings,
                    selectedRound.questions
                      .filter((question) => question.questionType === 'RATING_SCALE')
                      .map((question) => ({
                        id: question.id,
                        questionText: question.questionText,
                        scaleMin: question.scaleMin,
                        scaleMax: question.scaleMax,
                      }))
                  ),
                  collaboratorIds: selectedRound.collaborators.map((collaborator) => collaborator.employeeId),
                }
              : undefined,
          reviewAdmin: reviewAdminState,
          nominationQueue,
          resultShare: resultShareSummary,
          managerEffectiveness: managerEffectivenessAdmin,
          anytimeReview: anytimeReviewState,
          onboarding: onboardingSnapshotResult.data ?? undefined,
        },
      }
    }

    if (params.mode === 'respond') {
      const feedback = params.feedbackId
        ? await prisma.multiFeedback.findUnique({
            where: { id: params.feedbackId },
            include: {
              round: {
                include: {
                  questions: true,
                  evalCycle: {
                    select: {
                      evalYear: true,
                    },
                  },
                },
              },
              receiver: {
                select: {
                  empName: true,
                  deptId: true,
                  role: true,
                  position: true,
                  jobTitle: true,
                  teamName: true,
                  department: {
                    select: {
                      deptName: true,
                    },
                  },
                },
              },
              responses: true,
            },
          })
        : null

      if (
        !feedback ||
        feedback.round.roundType === 'UPWARD' ||
        (feedback.giverId !== employee.id && employee.role !== 'ROLE_ADMIN')
      ) {
        return {
          ...baseData,
          state: 'permission-denied',
          message: '응답 화면에 접근할 권한이 없습니다.',
        }
      }

      const respondVisibilitySettings = parseFeedbackVisibilitySettings(feedback.round.visibilitySettings)
      const submittedReferenceFeedbacks = await prisma.multiFeedback.findMany({
        where: {
          roundId: feedback.roundId,
          receiverId: feedback.receiverId,
          status: 'SUBMITTED',
          id: { not: feedback.id },
        },
        include: {
          giver: {
            select: {
              empName: true,
            },
          },
          responses: {
            include: {
              question: {
                select: {
                  category: true,
                  questionText: true,
                  questionType: true,
                },
              },
            },
          },
        },
        orderBy: [{ submittedAt: 'desc' }, { createdAt: 'desc' }],
      })

      const personalGoals = await prisma.personalKpi.findMany({
        where: {
          employeeId: feedback.receiverId,
          evalYear: feedback.round.evalCycle.evalYear,
        },
        include: {
          linkedOrgKpi: {
            select: {
              kpiName: true,
              department: {
                select: {
                  deptName: true,
                },
              },
              parentOrgKpi: {
                select: {
                  kpiName: true,
                  department: {
                    select: {
                      deptName: true,
                    },
                  },
                  parentOrgKpi: {
                    select: {
                      kpiName: true,
                      department: {
                        select: {
                          deptName: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          monthlyRecords: {
            orderBy: [{ yearMonth: 'desc' }],
            take: 3,
            select: {
              yearMonth: true,
              achievementRate: true,
              activities: true,
              efforts: true,
              obstacles: true,
              attachments: true,
            },
          },
        },
        orderBy: [{ weight: 'desc' }, { kpiName: 'asc' }],
        take: 8,
      })

      const recentCheckins = await prisma.checkIn.findMany({
        where: {
          ownerId: feedback.receiverId,
          status: {
            in: ['IN_PROGRESS', 'COMPLETED', 'RESCHEDULED'],
          },
        },
        select: {
          scheduledDate: true,
          actionItems: true,
          kpiDiscussed: true,
        },
        orderBy: [{ scheduledDate: 'desc' }],
        take: 12,
      })

      const goals = personalGoals.map((goal) => {
        const relatedCheckins = recentCheckins.flatMap((checkin) => {
          const discussions = parseFeedbackGoalContextKpiDiscussions(checkin.kpiDiscussed)
          return discussions
            .filter((discussion) => discussion.kpiId === goal.id)
            .map((discussion) => ({
              scheduledDate: checkin.scheduledDate,
              collaborators: parseFeedbackGoalContextActionAssignees(checkin.actionItems),
              progress: discussion.progress,
              concern: discussion.concern,
              support: discussion.support,
            }))
        })

        const latestRecord = goal.monthlyRecords[0]
        const latestCheckin = relatedCheckins[0]
        const linkMap = new Map<string, FeedbackGoalReferenceLink>()

        for (const record of goal.monthlyRecords) {
          for (const link of parseFeedbackGoalContextLinks(record.attachments)) {
            if (!linkMap.has(link.href)) {
              linkMap.set(link.href, link)
            }
          }
        }

        const collaborators = Array.from(
          new Set(relatedCheckins.flatMap((checkin) => checkin.collaborators).filter(Boolean))
        )

        return {
          id: goal.id,
          title: goal.kpiName,
          linkedGoalLabel: goal.linkedOrgKpi?.kpiName ?? null,
          hierarchy: buildFeedbackGoalHierarchyLabels(goal.linkedOrgKpi),
          periodLabel: buildFeedbackGoalPeriodLabel({
            cycleYear: feedback.round.evalCycle.evalYear,
            records: goal.monthlyRecords.map((record) => ({ yearMonth: record.yearMonth })),
            checkins: relatedCheckins,
          }),
          collaborators,
          achievementSummary: buildFeedbackGoalAchievementSummary({
            latestRecord,
            latestCheckin,
          }),
          progressRate: latestRecord?.achievementRate ?? null,
          progressLabel: buildFeedbackGoalProgressLabel({
            latestRecord,
            latestCheckin,
          }),
          approvalStatusLabel: getFeedbackGoalApprovalStatus(goal.status),
          weightLabel: formatGoalWeightLabel(goal.weight),
          links: Array.from(linkMap.values()).slice(0, 4),
          checkinNotes: relatedCheckins
            .flatMap((checkin) =>
              [
                checkin.progress ? `${formatDate(checkin.scheduledDate)} 진행 메모: ${checkin.progress}` : '',
                checkin.support ? `${formatDate(checkin.scheduledDate)} 지원 요청: ${checkin.support}` : '',
                checkin.concern ? `${formatDate(checkin.scheduledDate)} 주의 사항: ${checkin.concern}` : '',
              ].filter(Boolean)
            )
            .slice(0, 4),
        }
      })

      const totalScoreEnabled = feedback.round.questions.some(
        (question) => question.questionType === 'RATING_SCALE'
      )
      const targetProfile = {
        departmentName: feedback.receiver.department?.deptName ?? '',
        role: feedback.receiver.role,
        position: feedback.receiver.position,
        jobTitle: feedback.receiver.jobTitle ?? undefined,
        teamName: feedback.receiver.teamName ?? undefined,
      }
      const respondSelectionSettings = parseFeedbackSelectionSettings(feedback.round.selectionSettings)
      const respondRoleGuide = resolveFeedbackRoleGuide({
        settings: respondSelectionSettings.skillArchitecture,
        target: targetProfile,
      })
      const ratingQuestions = feedback.round.questions
        .filter((question) => question.questionType === 'RATING_SCALE')
        .map((question) => ({
          id: question.id,
          questionText: question.questionText,
          scaleMin: question.scaleMin,
          scaleMax: question.scaleMax,
        }))
      const ratingGuideSettings = parseFeedbackRatingGuideSettings(
        feedback.round.ratingGuideSettings,
        ratingQuestions
      )
      const distributionQuestion =
        feedback.round.questions.find((question) => question.id === ratingGuideSettings.distributionQuestionId) ??
        feedback.round.questions.find((question) => question.questionType === 'RATING_SCALE') ??
        null
      const matchedRatingGuideRule = resolveFeedbackRatingGuideRule({
        rules: ratingGuideSettings.guideRules,
        target: targetProfile,
      })
      const distributionResponses =
        distributionQuestion && ratingGuideSettings.scaleEntries.length
          ? await prisma.multiFeedback.findMany({
              where: {
                roundId: feedback.roundId,
                relationship: feedback.relationship,
                status: 'SUBMITTED',
                id: { not: feedback.id },
                ...(ratingGuideSettings.distributionScope === 'DEPARTMENT'
                  ? {
                      receiver: {
                        deptId: feedback.receiver.deptId,
                      },
                    }
                  : {
                      giverId: feedback.giverId,
                    }),
              },
              select: {
                responses: {
                  where: {
                    questionId: distributionQuestion.id,
                  },
                  select: {
                    ratingValue: true,
                  },
                },
              },
            })
          : []
      const thresholdMet = submittedReferenceFeedbacks.length >= feedback.round.minRaters
      const groupedResponses = buildGroupedResponses({
        feedbacks: submittedReferenceFeedbacks.map((item) => ({
          id: item.id,
          relationship: item.relationship,
          giver: {
            empName: item.giver.empName,
          },
          responses: item.responses.map((response) => ({
            questionId: response.questionId,
            ratingValue: response.ratingValue,
            textValue: response.textValue,
            question: {
              category: response.question.category,
              questionText: response.question.questionText ?? null,
            },
          })),
        })),
        thresholdMet,
        visibilitySettings: respondVisibilitySettings,
      })

      const priorScores = totalScoreEnabled
        ? submittedReferenceFeedbacks.flatMap((item) => {
            const totalScore = calculateFeedbackResponseTotalScore({
              responses: item.responses.map((response) => ({
                ratingValue: response.ratingValue,
                question: {
                  questionType: response.question.questionType,
                },
              })),
            })

            if (totalScore == null) return []

            return [
              {
                feedbackId: item.id,
                relationship: item.relationship,
                authorLabel: `${item.relationship} · ${item.giver.empName}`,
                totalScore,
                submittedAt: item.submittedAt ? formatDate(item.submittedAt) : undefined,
              },
            ]
          })
        : []
      const priorScoreSummary = priorScores[0]
      const ratingGuideDescriptionMap = buildFeedbackRatingGuideDescriptionMap({
        entries: ratingGuideSettings.scaleEntries,
        rule: matchedRatingGuideRule,
      })
      const distributionScopeTargetCount =
        ratingGuideSettings.distributionScope === 'DEPARTMENT'
          ? await prisma.multiFeedback.count({
              where: {
                roundId: feedback.roundId,
                relationship: feedback.relationship,
                receiver: {
                  deptId: feedback.receiver.deptId,
                },
              },
            })
          : await prisma.multiFeedback.count({
              where: {
                roundId: feedback.roundId,
                relationship: feedback.relationship,
                giverId: feedback.giverId,
              },
            })
      const ratingGuideScaleEntries = annotateFeedbackRatingScaleEntries(ratingGuideSettings.scaleEntries).map(
        (entry) => {
          const currentCount = distributionResponses.reduce((sum, item) => {
            const selectedValue = item.responses[0]?.ratingValue
            return sum + (selectedValue === entry.value ? 1 : 0)
          }, 0)

          return {
            value: entry.value,
            label: entry.label,
            description: ratingGuideDescriptionMap[entry.value] || entry.description,
            targetRatio: entry.targetRatio,
            headcountLimit: entry.headcountLimit,
            currentCount,
            recommendedCount: calculateFeedbackRatingRecommendedCount(entry.targetRatio, distributionScopeTargetCount),
            isNonEvaluative: entry.isNonEvaluative,
            isHighest: entry.isHighest,
            isLowest: entry.isLowest,
          }
        }
      )

      const referenceWarnings = [
        goals.length
          ? null
          : '연결된 목표 정보가 아직 없어 리뷰 작성 시 참고 맥락이 제한됩니다.',
        submittedReferenceFeedbacks.length
          ? null
          : '이전에 제출된 리뷰가 없어 비교 참고 정보가 제한됩니다.',
        totalScoreEnabled && !priorScores.length
          ? '이전 차수 또는 선행 리뷰의 종합 점수가 아직 없습니다.'
          : null,
      ].filter((warning): warning is string => Boolean(warning))

      return {
        ...baseData,
        respond: {
          feedbackId: feedback.id,
          roundId: feedback.roundId,
          roundName: feedback.round.roundName,
          receiverId: feedback.receiverId,
          receiverName: feedback.receiver.empName,
          relationship: feedback.relationship,
          status: feedback.status,
          questionCount: feedback.round.questions.length,
          answeredCount: feedback.responses.length,
          overallComment: feedback.overallComment ?? undefined,
          targetProfile: {
            departmentName: targetProfile.departmentName,
            role: targetProfile.role,
            position: targetProfile.position,
            jobTitle: targetProfile.jobTitle,
            teamName: targetProfile.teamName,
          },
          priorScoreSummary,
          roleGuide: respondRoleGuide
            ? {
                label: respondRoleGuide.label,
                jobFamily: respondRoleGuide.jobFamily,
                level: respondRoleGuide.level,
                guideText: respondRoleGuide.guideText,
                expectedCompetencies: respondRoleGuide.expectedCompetencies,
                nextLevelExpectations: respondRoleGuide.nextLevelExpectations,
                goalLibrary: respondRoleGuide.goalLibrary,
              }
            : undefined,
          ratingGuide: {
            questionId: distributionQuestion?.id,
            questionText: distributionQuestion?.questionText,
            distributionMode: ratingGuideSettings.distributionMode,
            distributionModeLabel: describeFeedbackRatingDistributionMode(
              ratingGuideSettings.distributionMode
            ).label,
            distributionModeDescription: describeFeedbackRatingDistributionMode(
              ratingGuideSettings.distributionMode
            ).description,
            distributionScope: ratingGuideSettings.distributionScope,
            distributionScopeLabel: describeFeedbackRatingDistributionScope(
              ratingGuideSettings.distributionScope
            ),
            targetProfileLabel: [
              targetProfile.departmentName,
              targetProfile.position,
              targetProfile.jobTitle,
              targetProfile.teamName,
            ]
              .filter(Boolean)
              .join(' · '),
            matchedRule: matchedRatingGuideRule
              ? {
                  label: matchedRatingGuideRule.label,
                  headline: matchedRatingGuideRule.headline,
                  guidance: matchedRatingGuideRule.guidance,
                }
              : undefined,
            scaleEntries: ratingGuideScaleEntries,
          },
          questions: feedback.round.questions.map((question) => {
            const existing = feedback.responses.find((response) => response.questionId === question.id)

            return {
              id: question.id,
              category: question.category,
              questionText: question.questionText,
              questionType: question.questionType,
              isRequired: question.isRequired,
              scaleMin: question.scaleMin,
              scaleMax: question.scaleMax,
              ratingValue: existing?.ratingValue ?? null,
              textValue: existing?.textValue ?? null,
            }
          }),
          instructions: [
            '행동 기반으로 작성하고 개인 추정이나 감정 표현은 최소화합니다.',
            '익명 응답은 threshold 충족 전까지 텍스트 응답이 보고서에 공개되지 않습니다.',
            '참고 정보 패널에서 연결 목표, 이전 리뷰, 종합 점수를 함께 확인할 수 있습니다.',
          ],
          reference: {
            groupedResponses,
            warnings: referenceWarnings,
            goals,
            priorScores,
            totalScoreEnabled,
          },
        },
      }
    }

    return baseData
  } catch (error) {
    console.error(error)
    return {
      mode: params.mode,
      state: 'error',
      message: '360 서면평가 화면 데이터를 불러오지 못했습니다.',
      availableCycles: [],
      availableRounds: [],
      summary: {
        activeRounds: 0,
        pendingResponses: 0,
        submittedResponses: 0,
        averageResponseRate: 0,
        anonymityReadyCount: 0,
      },
    }
  }
}
