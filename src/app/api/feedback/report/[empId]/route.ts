import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { errorResponse, successResponse, AppError } from '@/lib/utils'

// GET /api/feedback/report/[empId]
// 다면평가 결과 리포트 (최소 3인 이상 응답 시에만 공개)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ empId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '인증이 필요합니다.')

    const { empId } = await params

    // 본인 또는 직속 매니저만 열람 가능
    const isOwn = empId === session.user.id
    if (!isOwn) {
      const employee = await prisma.employee.findUnique({
        where: { id: empId },
      })
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
      },
      include: {
        round: {
          select: { roundName: true, roundType: true, isAnonymous: true, minRaters: true },
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
          feedbackCount: 0,
          categoryScores: {} as Record<string, number[]>,
          textResponses: [] as { category: string; text: string }[],
          relationshipBreakdown: {} as Record<string, number[]>,
        }
      }

      roundMap[rid].feedbackCount++

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

    // 집계
    const reports = Object.values(roundMap).map((r: any) => {
      const hasSufficientResponses = r.feedbackCount >= r.minRaters

      return {
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
          ? Object.entries(r.relationshipBreakdown).map(([rel, scores]: [string, any]) => ({
              relationship: rel,
              average: Math.round((scores.reduce((a: number, b: number) => a + b, 0) / scores.length) * 10) / 10,
            }))
          : null,
        textResponses: hasSufficientResponses ? r.textResponses : null,
        message: !hasSufficientResponses ? `최소 ${r.minRaters}인 이상의 응답이 필요합니다. (현재: ${r.feedbackCount}인)` : null,
      }
    })

    return successResponse(reports)
  } catch (error) {
    return errorResponse(error)
  }
}
