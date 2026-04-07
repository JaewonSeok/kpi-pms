import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { parseFeedbackRatingGuideSettings } from '@/lib/feedback-rating-guide'
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
      throw new AppError(403, 'FEEDBACK_ASSIGNMENT_NOT_FOUND', '발행된 리뷰 요청이 없어 응답을 제출할 수 없습니다.')
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
        throw new AppError(400, 'MISSING_REQUIRED', `필수 질문이 아직 통하지 않았습니다. ${question.questionText}`)
      }
    }

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

    if (ratingGuideSettings.distributionMode === 'HEADCOUNT' && ratingGuideSettings.distributionQuestionId) {
      const distributionQuestion = round.questions.find(
        (question) => question.id === ratingGuideSettings.distributionQuestionId
      )
      const selectedDistributionResponse = responses.find(
        (response) => response.questionId === ratingGuideSettings.distributionQuestionId
      )
      const selectedRatingValue = selectedDistributionResponse?.ratingValue ?? null
      const selectedScaleEntry =
        selectedRatingValue == null
          ? null
          : ratingGuideSettings.scaleEntries.find((entry) => entry.value === selectedRatingValue) ?? null

      if (
        distributionQuestion &&
        selectedRatingValue != null &&
        selectedScaleEntry &&
        !selectedScaleEntry.isNonEvaluative &&
        selectedScaleEntry.headcountLimit != null
      ) {
        const receiverDepartment = await prisma.employee.findUnique({
          where: { id: receiverId },
          select: { deptId: true },
        })

        const distributionScopeFilter =
          ratingGuideSettings.distributionScope === 'DEPARTMENT'
            ? receiverDepartment?.deptId
              ? {
                  receiver: {
                    deptId: receiverDepartment.deptId,
                  },
                }
              : null
            : {
                giverId: session.user.id,
              }

        if (!distributionScopeFilter) {
          throw new AppError(
            400,
            'RATING_GUIDE_SCOPE_UNAVAILABLE',
            '대상자의 조직 정보가 없어 등급 배분 가이드를 확인할 수 없습니다. 관리자에게 문의해 주세요.'
          )
        }

        const submittedDistributionCount = await prisma.multiFeedback.count({
          where: {
            roundId,
            relationship,
            status: 'SUBMITTED',
            id: { not: existingFeedback.id },
            ...distributionScopeFilter,
            responses: {
              some: {
                questionId: distributionQuestion.id,
                ratingValue: selectedRatingValue,
              },
            },
          },
        })

        if (submittedDistributionCount + 1 > selectedScaleEntry.headcountLimit) {
          throw new AppError(
            400,
            'RATING_GUIDE_HEADCOUNT_EXCEEDED',
            '등급 배분 가이드의 제한 인원을 초과했습니다. 가이드를 확인해 주세요.'
          )
        }
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

    if (round.roundType === 'ANYTIME') {
      const remainingOpenFeedbacks = await prisma.multiFeedback.count({
        where: {
          roundId,
          status: {
            not: 'SUBMITTED',
          },
        },
      })

      if (remainingOpenFeedbacks === 0) {
        await prisma.multiFeedbackRound.update({
          where: { id: roundId },
          data: {
            status: 'COMPLETED',
          },
        })
      }
    }

    return successResponse({ message: '다면평가 응답을 제출했습니다.' })
  } catch (error) {
    return errorResponse(error)
  }
}
