import type { FeedbackNominationStatus, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { AppError } from '@/lib/utils'

export type FeedbackSelectionSettings = {
  requireLeaderApproval: boolean
  allowPreferredPeers: boolean
  excludeLeaderFromPeerSelection: boolean
  excludeDirectReportsFromPeerSelection: boolean
}

export type FeedbackVisibilitySettings = Record<
  'SELF' | 'SUPERVISOR' | 'PEER' | 'SUBORDINATE' | 'CROSS_TEAM_PEER' | 'CROSS_DEPT',
  'FULL' | 'ANONYMOUS' | 'PRIVATE'
>

export const DEFAULT_FEEDBACK_SELECTION_SETTINGS: FeedbackSelectionSettings = {
  requireLeaderApproval: false,
  allowPreferredPeers: false,
  excludeLeaderFromPeerSelection: false,
  excludeDirectReportsFromPeerSelection: false,
}

export const DEFAULT_FEEDBACK_VISIBILITY_SETTINGS: FeedbackVisibilitySettings = {
  SELF: 'FULL',
  SUPERVISOR: 'FULL',
  PEER: 'ANONYMOUS',
  SUBORDINATE: 'ANONYMOUS',
  CROSS_TEAM_PEER: 'ANONYMOUS',
  CROSS_DEPT: 'ANONYMOUS',
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

export function parseFeedbackSelectionSettings(value: unknown): FeedbackSelectionSettings {
  const record = asRecord(value)
  if (!record) return DEFAULT_FEEDBACK_SELECTION_SETTINGS

  return {
    requireLeaderApproval:
      typeof record.requireLeaderApproval === 'boolean'
        ? record.requireLeaderApproval
        : DEFAULT_FEEDBACK_SELECTION_SETTINGS.requireLeaderApproval,
    allowPreferredPeers:
      typeof record.allowPreferredPeers === 'boolean'
        ? record.allowPreferredPeers
        : DEFAULT_FEEDBACK_SELECTION_SETTINGS.allowPreferredPeers,
    excludeLeaderFromPeerSelection:
      typeof record.excludeLeaderFromPeerSelection === 'boolean'
        ? record.excludeLeaderFromPeerSelection
        : DEFAULT_FEEDBACK_SELECTION_SETTINGS.excludeLeaderFromPeerSelection,
    excludeDirectReportsFromPeerSelection:
      typeof record.excludeDirectReportsFromPeerSelection === 'boolean'
        ? record.excludeDirectReportsFromPeerSelection
        : DEFAULT_FEEDBACK_SELECTION_SETTINGS.excludeDirectReportsFromPeerSelection,
  }
}

export function parseFeedbackVisibilitySettings(value: unknown): FeedbackVisibilitySettings {
  const record = asRecord(value)
  if (!record) return DEFAULT_FEEDBACK_VISIBILITY_SETTINGS

  const resolve = (key: keyof FeedbackVisibilitySettings) =>
    record[key] === 'FULL' || record[key] === 'ANONYMOUS' || record[key] === 'PRIVATE'
      ? record[key]
      : DEFAULT_FEEDBACK_VISIBILITY_SETTINGS[key]

  return {
    SELF: resolve('SELF'),
    SUPERVISOR: resolve('SUPERVISOR'),
    PEER: resolve('PEER'),
    SUBORDINATE: resolve('SUBORDINATE'),
    CROSS_TEAM_PEER: resolve('CROSS_TEAM_PEER'),
    CROSS_DEPT: resolve('CROSS_DEPT'),
  }
}

function average(values: number[]) {
  if (!values.length) return 0
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10
}

export function canManageFeedbackTarget(
  actorId: string,
  actorRole: string,
  target: {
    id: string
    teamLeaderId: string | null
    sectionChiefId: string | null
    divisionHeadId: string | null
  }
) {
  if (actorRole === 'ROLE_ADMIN') return true
  if (target.id === actorId) return true
  return (
    target.teamLeaderId === actorId ||
    target.sectionChiefId === actorId ||
    target.divisionHeadId === actorId
  )
}

export function canApproveFeedbackTarget(
  actorId: string,
  actorRole: string,
  target: {
    id: string
    teamLeaderId: string | null
    sectionChiefId: string | null
    divisionHeadId: string | null
  }
) {
  if (actorRole === 'ROLE_ADMIN') return true
  return (
    target.teamLeaderId === actorId ||
    target.sectionChiefId === actorId ||
    target.divisionHeadId === actorId
  )
}

export async function persistFeedback360Report(params: {
  roundId: string
  targetId: string
  generatedById: string
}) {
  const round = await prisma.multiFeedbackRound.findUnique({
    where: { id: params.roundId },
    include: {
      feedbacks: {
        where: {
          receiverId: params.targetId,
          status: 'SUBMITTED',
        },
        include: {
          responses: {
            include: {
              question: {
                select: {
                  category: true,
                  questionType: true,
                },
              },
            },
          },
        },
      },
    },
  })

  if (!round) {
    throw new AppError(404, 'ROUND_NOT_FOUND', '360 라운드를 찾을 수 없습니다.')
  }

  const submittedFeedbacks = round.feedbacks
  const thresholdMet = submittedFeedbacks.length >= round.minRaters
  const categoryMap = new Map<string, number[]>()
  const textHighlights: string[] = []

  for (const feedback of submittedFeedbacks) {
    for (const response of feedback.responses) {
      if (response.question.questionType === 'RATING_SCALE' && typeof response.ratingValue === 'number') {
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

  const categoryScores = [...categoryMap.entries()]
    .map(([category, values]) => ({
      category,
      average: average(values),
      count: values.length,
    }))
    .sort((a, b) => b.average - a.average)

  const strengths = categoryScores.slice(0, 3).map((item) => `${item.category} 영역이 상대적 강점입니다.`)
  const improvements = categoryScores
    .slice(-3)
    .reverse()
    .map((item) => `${item.category} 영역은 후속 코칭과 실행 계획이 필요합니다.`)

  const focusArea = improvements[0]?.split(' 영역')[0] ?? '협업 방식'
  const anonymousSummary = thresholdMet
    ? '응답 수가 anonymity threshold를 충족하여 익명 요약을 저장했습니다.'
    : `현재 응답 수는 ${submittedFeedbacks.length}건이며 anonymity threshold ${round.minRaters}건에 아직 미달입니다.`

  const reportPayload = {
    categoryScores,
    strengths,
    improvements,
    anonymousSummary,
    textHighlights,
    developmentPlan: {
      focusArea: `${focusArea} 개선`,
      actions: [
        '다음 체크인에서 blind spot과 최근 업무 사례를 함께 점검합니다.',
        '다음 분기 개인 KPI 중 하나를 행동 개선 목표와 연결합니다.',
        '2주 단위 실천 항목을 정의하고 리더와 진행 상황을 리뷰합니다.',
      ],
      managerSupport: [
        '리더가 실제 행동 사례 중심 피드백을 제공하고, 실행 점검 리듬을 만듭니다.',
        '강점과 개선 포인트를 분리해 코칭합니다.',
      ],
      nextCheckinTopics: [
        '360 강점이 현재 KPI 실행 방식에 어떻게 드러나는지',
        'blind spot이 실제 협업/리더십 상황에서 나타난 장면',
        '다음 달 실천 항목과 증빙 방식',
      ],
    },
  }

  const cache = await prisma.feedbackReportCache.upsert({
    where: {
      roundId_targetId: {
        roundId: params.roundId,
        targetId: params.targetId,
      },
    },
    create: {
      roundId: params.roundId,
      targetId: params.targetId,
      generatedById: params.generatedById,
      anonymityThreshold: round.minRaters,
      feedbackCount: submittedFeedbacks.length,
      thresholdMet,
      categoryScores: categoryScores as Prisma.InputJsonValue,
      strengths: strengths as Prisma.InputJsonValue,
      improvements: improvements as Prisma.InputJsonValue,
      anonymousSummary,
      textHighlights: textHighlights as Prisma.InputJsonValue,
      reportPayload: reportPayload as Prisma.InputJsonValue,
    },
    update: {
      generatedById: params.generatedById,
      anonymityThreshold: round.minRaters,
      feedbackCount: submittedFeedbacks.length,
      thresholdMet,
      categoryScores: categoryScores as Prisma.InputJsonValue,
      strengths: strengths as Prisma.InputJsonValue,
      improvements: improvements as Prisma.InputJsonValue,
      anonymousSummary,
      textHighlights: textHighlights as Prisma.InputJsonValue,
      reportPayload: reportPayload as Prisma.InputJsonValue,
      generatedAt: new Date(),
    },
  })

  return {
    cache,
    reportPayload,
  }
}

export function getNominationAggregateStatus(statuses: FeedbackNominationStatus[]) {
  if (!statuses.length) return 'DRAFT'
  if (statuses.every((status) => status === 'PUBLISHED')) return 'PUBLISHED'
  if (statuses.some((status) => status === 'REJECTED')) return 'REJECTED'
  if (statuses.every((status) => status === 'APPROVED')) return 'APPROVED'
  if (statuses.every((status) => status === 'SUBMITTED')) return 'SUBMITTED'
  return statuses[0] ?? 'DRAFT'
}

export function parsePersistedReportPayload(value: unknown) {
  return asRecord(value)
}

export function validatePeerReviewerSelection(params: {
  actorId: string
  actorRole: string
  target: {
    id: string
    teamLeaderId: string | null
    sectionChiefId: string | null
    divisionHeadId: string | null
  }
  reviewers: Array<{
    employeeId: string
    relationship: string
  }>
  teamMemberIds: string[]
  selectionSettings: FeedbackSelectionSettings
}) {
  const { actorId, actorRole, target, reviewers, teamMemberIds, selectionSettings } = params
  if (!reviewers.length) return

  const leaderIds = [target.teamLeaderId, target.sectionChiefId, target.divisionHeadId].filter(Boolean) as string[]
  const teamMemberIdSet = new Set(teamMemberIds)

  for (const reviewer of reviewers) {
    if (reviewer.relationship !== 'PEER') continue

    if (
      selectionSettings.excludeLeaderFromPeerSelection &&
      leaderIds.includes(reviewer.employeeId)
    ) {
      throw new AppError(
        400,
        'LEADER_PEER_EXCLUDED',
        '현재 설정에서는 리뷰 대상자가 자신의 리더를 동료 작성자로 선택할 수 없습니다.'
      )
    }

    if (
      selectionSettings.excludeDirectReportsFromPeerSelection &&
      teamMemberIdSet.has(reviewer.employeeId)
    ) {
      throw new AppError(
        400,
        'TEAM_MEMBER_PEER_EXCLUDED',
        '현재 설정에서는 리뷰 대상자가 자신의 팀원을 동료 작성자로 선택할 수 없습니다.'
      )
    }
  }

  if (
    selectionSettings.requireLeaderApproval &&
    actorRole !== 'ROLE_ADMIN' &&
    !leaderIds.includes(actorId) &&
    actorId !== target.id
  ) {
    throw new AppError(403, 'LEADER_APPROVAL_REQUIRED', '리더 승인 대상 nomination은 현재 권한으로 수정할 수 없습니다.')
  }
}
