import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { errorResponse, successResponse, AppError } from '@/lib/utils'
import {
  canOpenFeedback360Result,
  isFeedback360ResultRuleRound,
  readFeedback360ResultReleasedAt,
  shouldWithholdFeedback360Content,
} from '@/lib/feedback-360-result-exposure'
import {
  parseFeedbackResultPresentationSettings,
  resolveFeedbackResultPresentationProfile,
} from '@/lib/feedback-result-presentation'
import { canManageFeedbackRoundByAccess, getFeedbackReviewAdminAccess } from '@/server/feedback-360-access'

// GET /api/feedback/report/[empId]
// 360 다면평가(FULL_360) 결과 리포트 (최소 3인 이상 응답 시에만 공개)
// 상향평가(UPWARD) 결과는 이 경로로 내보내지 않는다. 상향평가 화면의 규칙(결과 공개 · 열람자)으로만 본다.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ empId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '인증이 필요합니다.')

    const { empId } = await params

    // 본인 또는 직속 매니저만 열람 가능. 대상의 리더 슬롯은 결과지 유형(리더 점수 공개 설정)에도 쓴다.
    const employee = await prisma.employee.findUnique({
      where: { id: empId },
      select: { id: true, teamLeaderId: true, sectionChiefId: true, divisionHeadId: true },
    })
    const isOwn = empId === session.user.id
    if (!isOwn) {
      const isDirectManager =
        employee?.teamLeaderId === session.user.id ||
        employee?.sectionChiefId === session.user.id ||
        employee?.divisionHeadId === session.user.id

      if (!isDirectManager && session.user.role !== 'ROLE_ADMIN') {
        throw new AppError(403, 'FORBIDDEN', '권한이 없습니다.')
      }
    }

    const { searchParams } = new URL(request.url)
    const roundId = searchParams.get('roundId')

    const feedbacks = await prisma.multiFeedback.findMany({
      where: {
        receiverId: empId,
        status: 'SUBMITTED',
        ...(roundId ? { roundId } : {}),
        round: { roundType: 'FULL_360' },
      },
      include: {
        round: {
          select: {
            roundName: true,
            roundType: true,
            isAnonymous: true,
            minRaters: true,
            status: true,
            documentSettings: true,
            resultPresentationSettings: true,
            onboardingReviewGeneration: { select: { id: true } },
          },
        },
        responses: {
          include: {
            question: { select: { category: true, questionText: true, questionType: true } },
          },
        },
      },
    })

    // 라운드별로 그룹핑
    const roundMap: Record<string, any> = {}

    for (const fb of feedbacks) {
      const rid = fb.roundId
      if (!roundMap[rid]) {
        roundMap[rid] = {
          roundId: rid,
          roundName: fb.round.roundName,
          roundType: fb.round.roundType,
          minRaters: fb.round.minRaters,
          status: fb.round.status,
          isAnonymous: fb.round.isAnonymous,
          isOnboarding: Boolean(fb.round.onboardingReviewGeneration),
          resultReleasedAt: readFeedback360ResultReleasedAt(fb.round.documentSettings),
          resultPresentationSettings: fb.round.resultPresentationSettings,
          feedbackCount: 0,
          raterCount: 0,
          categoryScores: {} as Record<string, number[]>,
          textResponses: [] as { category: string; text: string }[],
          relationshipBreakdown: {} as Record<string, number[]>,
        }
      }

      roundMap[rid].feedbackCount++
      // 익명 기준 판정 인원: SELF 는 세지 않는다.
      if (fb.relationship !== 'SELF') roundMap[rid].raterCount++

      for (const resp of fb.responses) {
        const cat = resp.question.category
        if (resp.ratingValue) {
          if (!roundMap[rid].categoryScores[cat]) roundMap[rid].categoryScores[cat] = []
          roundMap[rid].categoryScores[cat].push(resp.ratingValue)

          // 관계유형별 점수
          const rel = fb.relationship
          if (!roundMap[rid].relationshipBreakdown[rel]) roundMap[rid].relationshipBreakdown[rel] = []
          roundMap[rid].relationshipBreakdown[rel].push(resp.ratingValue)
        }
        if (resp.textValue && !fb.round.isAnonymous) {
          roundMap[rid].textResponses.push({ category: cat, text: resp.textValue })
        } else if (resp.textValue && fb.round.isAnonymous && roundMap[rid].feedbackCount >= (fb.round.minRaters || 3)) {
          roundMap[rid].textResponses.push({ category: cat, text: resp.textValue })
        }
      }
    }

    // 결과 노출 규칙(feedback-360-result-exposure): 라운드 관리자 여부는 규칙 대상 라운드에서만 묻는다.
    let actorAccess: Awaited<ReturnType<typeof getFeedbackReviewAdminAccess>> | null = null
    const isRoundManager = async (roundId: string) => {
      if (!actorAccess) {
        const actor = await prisma.employee.findUnique({
          where: { id: session.user.id },
          select: { id: true, role: true, department: { select: { orgId: true } } },
        })
        if (!actor) return false
        actorAccess = await getFeedbackReviewAdminAccess({
          employeeId: actor.id,
          actorRole: actor.role,
          orgId: actor.department.orgId,
        })
      }
      const access = actorAccess
      return canManageFeedbackRoundByAccess({ access, employeeId: session.user.id, roundId })
    }

    // 결과지 유형(구성원 · 팀장 · 경영진): 결과 화면과 같은 판정이다.
    const recipientProfile = resolveFeedbackResultPresentationProfile({
      actorId: session.user.id,
      actorRole: session.user.role,
      target: employee ?? { id: empId, teamLeaderId: null, sectionChiefId: null, divisionHeadId: null },
    })

    // 집계
    const reports = []
    for (const r of Object.values(roundMap)) {
      const resultRound = {
        roundType: r.roundType,
        status: r.status,
        isAnonymous: r.isAnonymous,
        isOnboarding: r.isOnboarding,
        resultReleasedAt: r.resultReleasedAt,
      }
      const isRuleRound = isFeedback360ResultRuleRound(resultRound)
      const roundManager = isRuleRound ? await isRoundManager(r.roundId) : false
      // 관리자가 아니면 마감 · 공개 전 라운드는 리포트에 싣지 않는다.
      if (!canOpenFeedback360Result({ round: resultRound, isRoundManager: roundManager })) continue
      // 리더 점수 공개 설정이 꺼져 있으면 관계별 평균에서 SUPERVISOR 를 뺀다.
      const showLeaderScore = isRuleRound
        ? parseFeedbackResultPresentationSettings(r.resultPresentationSettings)[recipientProfile].showLeaderScore
        : true
      const withhold = shouldWithholdFeedback360Content({
        round: resultRound,
        isRoundManager: roundManager,
        thresholdMet: r.raterCount >= r.minRaters,
      })
      const hasSufficientResponses = !withhold && r.feedbackCount >= r.minRaters
      const shownCount = withhold ? r.raterCount : r.feedbackCount

      reports.push({
        roundId: r.roundId,
        roundName: r.roundName,
        roundType: r.roundType,
        feedbackCount: r.feedbackCount,
        hasSufficientResponses,
        categoryAverages: hasSufficientResponses
          ? Object.entries(r.categoryScores).map(([cat, scores]: [string, any]) => ({
              category: cat,
              average: Math.round((scores.reduce((a: number, b: number) => a + b, 0) / scores.length) * 10) / 10,
              count: scores.length,
            }))
          : null,
        relationshipAverages: hasSufficientResponses
          ? Object.entries(r.relationshipBreakdown)
              .filter(([rel]) => showLeaderScore || rel !== 'SUPERVISOR')
              .map(([rel, scores]: [string, any]) => ({
                relationship: rel,
                average: Math.round((scores.reduce((a: number, b: number) => a + b, 0) / scores.length) * 10) / 10,
              }))
          : null,
        textResponses: hasSufficientResponses ? r.textResponses : null,
        message: !hasSufficientResponses ? `최소 ${r.minRaters}인 이상의 응답이 필요합니다. (현재: ${shownCount}인)` : null,
      })
    }

    return successResponse(reports)
  } catch (error) {
    return errorResponse(error)
  }
}
