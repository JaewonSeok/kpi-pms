import type { PrismaClient } from '@prisma/client'
import {
  getSelectedFeedback360ResponseTagLabels,
  parseFeedback360TagSummaryFromComment,
} from '@/components/evaluation/feedback360/feedback360-response-tag-pool'
import {
  FEEDBACK_360_MIN_TAG_USES,
  canOpenFeedback360Result,
  isFeedback360ResultRuleRound,
  readFeedback360ResultReleasedAt,
} from '@/lib/feedback-360-result-exposure'
import {
  parseFeedbackResultPresentationSettings,
  resolveFeedbackResultPresentationProfile,
} from '@/lib/feedback-result-presentation'

// 업적평가 쪽(워크벤치 근거 패널 · 보정 화면 · 성과 브리핑 · 평가 초안 AI)이 쓰는 360 근거는 여기 하나에서 만든다.
// 360 결과 화면의 판정(feedback-360-result-exposure)을 그대로 쓴다.
// 1) FULL_360 라운드만(UPWARD · ANYTIME · 온보딩 제외)
// 2) 마감됐고 결과가 공개된 라운드만(관리자 예외 없음)
// 3) 대상별 기준(SELF 를 뺀 제출 수 ≥ minRaters)을 넘은 경우에만, 집계(평균 · 2회 이상 쓰인 태그)만 돌려준다.
//    평가자별 점수 · 원문(textValue · 종합 의견 본문)은 돌려주지 않는다
// 4) 결과지 유형의 showLeaderScore 가 꺼져 있으면 리더(SUPERVISOR) 점수를 빼고 평균을 낸다

export type Feedback360EvidenceTagCount = { label: string; count: number }

export type Feedback360EvidenceRound = {
  id: string
  roundName: string
  roundType: string
  endDate: Date
  minRaters: number
  // 기준 판정 인원(SELF 제외)
  raterCount: number
  averageRating: number | null
  positiveTags: Feedback360EvidenceTagCount[]
  improvementTags: Feedback360EvidenceTagCount[]
}

type EvidenceDb = Pick<PrismaClient, 'multiFeedbackRound' | 'employee'>

function sortTagCounts(counts: Map<string, number>) {
  return [...counts.entries()]
    .filter(([, count]) => count >= FEEDBACK_360_MIN_TAG_USES)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'ko'))
}

export async function loadFeedback360EvaluationEvidence(params: {
  db: EvidenceDb
  targetIds: string[]
  // 결과지 유형(리더 점수 공개 설정)을 정하는 열람자
  viewer: { id: string; role: string }
  evalCycleId?: string
  endedSince?: Date
}): Promise<Map<string, Feedback360EvidenceRound[]>> {
  const evidence = new Map<string, Feedback360EvidenceRound[]>()
  const targetIds = [...new Set(params.targetIds)]
  if (!targetIds.length) return evidence

  const [rounds, targets] = await Promise.all([
    params.db.multiFeedbackRound.findMany({
      where: {
        ...(params.evalCycleId ? { evalCycleId: params.evalCycleId } : {}),
        ...(params.endedSince ? { endDate: { gte: params.endedSince } } : {}),
        feedbacks: { some: { receiverId: { in: targetIds } } },
      },
      orderBy: { endDate: 'desc' },
      select: {
        id: true,
        roundName: true,
        roundType: true,
        status: true,
        isAnonymous: true,
        minRaters: true,
        endDate: true,
        documentSettings: true,
        resultPresentationSettings: true,
        onboardingReviewGeneration: { select: { id: true } },
        feedbacks: {
          where: { receiverId: { in: targetIds }, status: 'SUBMITTED' },
          select: {
            receiverId: true,
            relationship: true,
            overallComment: true,
            responses: {
              select: {
                ratingValue: true,
                question: { select: { questionType: true } },
              },
            },
          },
        },
      },
    }),
    params.db.employee.findMany({
      where: { id: { in: targetIds } },
      select: { id: true, teamLeaderId: true, sectionChiefId: true, divisionHeadId: true },
    }),
  ])
  const targetById = new Map(targets.map((target) => [target.id, target]))

  for (const round of rounds) {
    const resultRound = {
      roundType: round.roundType,
      status: round.status,
      isAnonymous: round.isAnonymous,
      isOnboarding: Boolean(round.onboardingReviewGeneration),
      resultReleasedAt: readFeedback360ResultReleasedAt(round.documentSettings),
    }
    if (!isFeedback360ResultRuleRound(resultRound)) continue
    if (!canOpenFeedback360Result({ round: resultRound, isRoundManager: false })) continue
    const presentation = parseFeedbackResultPresentationSettings(round.resultPresentationSettings)

    for (const targetId of targetIds) {
      const raterFeedbacks = round.feedbacks.filter(
        (feedback) => feedback.receiverId === targetId && feedback.relationship !== 'SELF'
      )
      if (raterFeedbacks.length < round.minRaters) continue

      const profile = resolveFeedbackResultPresentationProfile({
        actorId: params.viewer.id,
        actorRole: params.viewer.role,
        target: targetById.get(targetId) ?? { id: targetId, teamLeaderId: null, sectionChiefId: null, divisionHeadId: null },
      })
      const scoredFeedbacks = presentation[profile].showLeaderScore
        ? raterFeedbacks
        : raterFeedbacks.filter((feedback) => feedback.relationship !== 'SUPERVISOR')
      const ratings = scoredFeedbacks.flatMap((feedback) =>
        feedback.responses
          .filter((response) => response.question.questionType === 'RATING_SCALE' && typeof response.ratingValue === 'number')
          .map((response) => response.ratingValue as number)
      )

      const positiveCounts = new Map<string, number>()
      const improvementCounts = new Map<string, number>()
      for (const feedback of raterFeedbacks) {
        const { selectedTags } = parseFeedback360TagSummaryFromComment(feedback.overallComment)
        const seen = new Set<string>()
        for (const tag of getSelectedFeedback360ResponseTagLabels(selectedTags)) {
          const key = `${tag.tone}:${tag.label}`
          if (seen.has(key)) continue
          seen.add(key)
          const counts = tag.tone === 'positive' ? positiveCounts : improvementCounts
          counts.set(tag.label, (counts.get(tag.label) ?? 0) + 1)
        }
      }

      const list = evidence.get(targetId) ?? []
      list.push({
        id: round.id,
        roundName: round.roundName,
        roundType: round.roundType,
        endDate: round.endDate,
        minRaters: round.minRaters,
        raterCount: raterFeedbacks.length,
        averageRating: ratings.length
          ? Math.round((ratings.reduce((sum, value) => sum + value, 0) / ratings.length) * 10) / 10
          : null,
        positiveTags: sortTagCounts(positiveCounts),
        improvementTags: sortTagCounts(improvementCounts),
      })
      evidence.set(targetId, list)
    }
  }

  return evidence
}

// AI 입력 · 근거 문구용 한 줄 요약. 집계만 담는다(원문 없음).
export function describeFeedback360EvidenceRound(round: Feedback360EvidenceRound) {
  const average = typeof round.averageRating === 'number' ? `평균 ${round.averageRating.toFixed(1)}` : '평균 없음'
  const tags = [
    round.positiveTags.length ? `강점 태그 ${round.positiveTags.map((tag) => `${tag.label}(${tag.count})`).join(', ')}` : '',
    round.improvementTags.length
      ? `보완 태그 ${round.improvementTags.map((tag) => `${tag.label}(${tag.count})`).join(', ')}`
      : '',
  ].filter(Boolean)
  return [`응답 ${round.raterCount}건`, average, ...tags].join(' · ')
}
