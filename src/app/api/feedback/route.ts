import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { errorResponse, successResponse, AppError } from '@/lib/utils'
import { SubmitFeedbackSchema } from '@/lib/validations'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '인증이 필요합니다.')

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'pending'

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

    const round = await prisma.multiFeedbackRound.findUnique({
      where: { id: roundId },
      include: { questions: true },
    })
    if (!round) throw new AppError(404, 'ROUND_NOT_FOUND', '다면평가 라운드를 찾을 수 없습니다.')
    if (round.status !== 'IN_PROGRESS') {
      throw new AppError(400, 'ROUND_NOT_ACTIVE', '현재 응답 가능한 다면평가 라운드가 아닙니다.')
    }

    const existingFeedback = await prisma.multiFeedback.findUnique({
      where: {
        roundId_giverId_receiverId: {
          roundId,
          giverId: session.user.id,
          receiverId,
        },
      },
      include: { responses: true },
    })

    if (!existingFeedback) {
      throw new AppError(403, 'FEEDBACK_ASSIGNMENT_NOT_FOUND', '발행된 리뷰 요청이 없어서 응답을 제출할 수 없습니다.')
    }

    if (relationship === 'SELF' && receiverId !== session.user.id) {
      throw new AppError(400, 'INVALID_SELF_FEEDBACK', 'SELF 관계는 자기 자신에게만 제출할 수 있습니다.')
    }

    if (receiverId === session.user.id && relationship !== 'SELF') {
      throw new AppError(400, 'SELF_FEEDBACK', '자기 자신에 대한 응답은 SELF 관계로만 제출할 수 있습니다.')
    }

    const requiredQuestions = round.questions.filter((question) => question.isRequired)
    for (const question of requiredQuestions) {
      const response = responses.find((item) => item.questionId === question.id)
      if (!response || (!response.ratingValue && !response.textValue)) {
        throw new AppError(400, 'MISSING_REQUIRED', `필수 질문에 아직 답하지 않았습니다: ${question.questionText}`)
      }
    }

    const feedback = await prisma.multiFeedback.update({
      where: { id: existingFeedback.id },
      data: {
        relationship,
        overallComment,
        status: 'SUBMITTED',
        submittedAt: new Date(),
      },
    })

    for (const response of responses) {
      await prisma.feedbackResponse.upsert({
        where: { feedbackId_questionId: { feedbackId: feedback.id, questionId: response.questionId } },
        create: {
          feedbackId: feedback.id,
          questionId: response.questionId,
          ratingValue: response.ratingValue,
          textValue: response.textValue,
        },
        update: {
          ratingValue: response.ratingValue,
          textValue: response.textValue,
        },
      })
    }

    return successResponse({ message: '다면평가 응답이 제출되었습니다.' })
  } catch (error) {
    return errorResponse(error)
  }
}
