import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { errorResponse, successResponse, AppError } from '@/lib/utils'
import { SubmitFeedbackSchema } from '@/lib/validations'

// GET /api/feedback/pending - 나에게 요청된 피드백
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '인증이 필요합니다.')

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'pending' // 'pending' | 'given'

    const feedbacks = await prisma.multiFeedback.findMany({
      where: {
        giverId: session.user.id,
        ...(type === 'pending' ? { status: { in: ['PENDING', 'IN_PROGRESS'] } } : {}),
      },
      include: {
        round: { select: { roundName: true, endDate: true, isAnonymous: true } },
        receiver: { select: { empName: true, position: true, profileImageUrl: true } },
      },
      orderBy: { round: { endDate: 'asc' } },
    })

    return successResponse(feedbacks)
  } catch (error) {
    return errorResponse(error)
  }
}

// POST /api/feedback - 피드백 제출
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '인증이 필요합니다.')

    const body = await request.json()
    const validated = SubmitFeedbackSchema.safeParse(body)
    if (!validated.success) {
      throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0].message)
    }

    const { roundId, receiverId, relationship, overallComment, responses } = validated.data

    // 라운드 확인
    const round = await prisma.multiFeedbackRound.findUnique({
      where: { id: roundId },
      include: { questions: true },
    })
    if (!round) throw new AppError(404, 'ROUND_NOT_FOUND', '다면평가 라운드를 찾을 수 없습니다.')
    if (round.status !== 'IN_PROGRESS') {
      throw new AppError(400, 'ROUND_NOT_ACTIVE', '현재 진행 중인 다면평가가 아닙니다.')
    }

    // 자기 자신에게 피드백 불가
    if (receiverId === session.user.id) {
      throw new AppError(400, 'SELF_FEEDBACK', '자기 자신에게는 피드백을 제출할 수 없습니다.')
    }

    // 필수 질문 체크
    const requiredQuestions = round.questions.filter(q => q.isRequired)
    for (const q of requiredQuestions) {
      const resp = responses.find(r => r.questionId === q.id)
      if (!resp || (!resp.ratingValue && !resp.textValue)) {
        throw new AppError(400, 'MISSING_REQUIRED', `필수 질문에 답변하지 않았습니다: ${q.questionText}`)
      }
    }

    // 피드백 upsert
    const feedback = await prisma.multiFeedback.upsert({
      where: { roundId_giverId_receiverId: { roundId, giverId: session.user.id, receiverId } },
      create: {
        roundId,
        giverId: session.user.id,
        receiverId,
        relationship,
        overallComment,
        status: 'SUBMITTED',
        submittedAt: new Date(),
        responses: {
          create: responses.map(r => ({
            questionId: r.questionId,
            ratingValue: r.ratingValue,
            textValue: r.textValue,
          })),
        },
      },
      update: {
        relationship,
        overallComment,
        status: 'SUBMITTED',
        submittedAt: new Date(),
      },
    })

    // 응답 업데이트 (이미 있는 경우)
    for (const resp of responses) {
      await prisma.feedbackResponse.upsert({
        where: { feedbackId_questionId: { feedbackId: feedback.id, questionId: resp.questionId } },
        create: {
          feedbackId: feedback.id,
          questionId: resp.questionId,
          ratingValue: resp.ratingValue,
          textValue: resp.textValue,
        },
        update: {
          ratingValue: resp.ratingValue,
          textValue: resp.textValue,
        },
      })
    }

    return successResponse({ message: '피드백이 제출되었습니다.' })
  } catch (error) {
    return errorResponse(error)
  }
}
