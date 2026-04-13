import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createAuditLog, getClientInfo } from '@/lib/audit'
import { prisma } from '@/lib/prisma'
import { AppError, errorResponse, successResponse } from '@/lib/utils'
import { UpwardReviewResponseSchema } from '@/lib/validations'

async function getActor() {
  const session = await getServerSession(authOptions)
  if (!session) {
    throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
  }

  const employee = await prisma.employee.findUnique({
    where: { id: session.user.id },
    include: { department: true },
  })

  if (!employee) {
    throw new AppError(404, 'EMPLOYEE_NOT_FOUND', '직원 정보를 찾을 수 없습니다.')
  }

  return { session, employee }
}

async function loadFeedback(feedbackId: string, actorId: string, orgId: string) {
  const feedback = await prisma.multiFeedback.findFirst({
    where: {
      id: feedbackId,
      giverId: actorId,
      round: {
        roundType: 'UPWARD',
        evalCycle: {
          orgId,
        },
      },
    },
    include: {
      round: {
        include: {
          questions: {
            orderBy: [{ sortOrder: 'asc' }],
          },
        },
      },
      responses: true,
      receiver: {
        select: {
          id: true,
          empName: true,
        },
      },
    },
  })

  if (!feedback) {
    throw new AppError(404, 'FEEDBACK_NOT_FOUND', '상향 평가 응답을 찾을 수 없습니다.')
  }

  return feedback
}

async function persistResponses(params: {
  feedbackId: string
  responses: Array<{
    questionId: string
    ratingValue?: number | null
    textValue?: string | null
  }>
  questionsById: Map<string, { questionType: string }>
}) {
  for (const response of params.responses) {
    const hasRating = typeof response.ratingValue === 'number'
    const isMultipleChoice = params.questionsById.get(response.questionId)?.questionType === 'MULTIPLE_CHOICE'
    const hasText =
      typeof response.textValue === 'string' &&
      (isMultipleChoice
        ? (() => {
            try {
              const parsed = JSON.parse(response.textValue)
              return Array.isArray(parsed) && parsed.length > 0
            } catch {
              return response.textValue.trim().length > 0
            }
          })()
        : response.textValue.trim().length > 0)

    if (!hasRating && !hasText) {
      await prisma.feedbackResponse.deleteMany({
        where: {
          feedbackId: params.feedbackId,
          questionId: response.questionId,
        },
      })
      continue
    }

    await prisma.feedbackResponse.upsert({
      where: {
        feedbackId_questionId: {
          feedbackId: params.feedbackId,
          questionId: response.questionId,
        },
      },
      create: {
        feedbackId: params.feedbackId,
        questionId: response.questionId,
        ratingValue: hasRating ? response.ratingValue : null,
        textValue: hasText ? response.textValue?.trim() : null,
      },
      update: {
        ratingValue: hasRating ? response.ratingValue : null,
        textValue: hasText ? response.textValue?.trim() : null,
      },
    })
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ feedbackId: string }> }
) {
  try {
    const actor = await getActor()
    const { feedbackId } = await context.params
    const body = await request.json()
    const parsed = UpwardReviewResponseSchema.safeParse(body)
    if (!parsed.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        parsed.error.issues[0]?.message ?? '응답 내용을 확인해 주세요.'
      )
    }

    const feedback = await loadFeedback(feedbackId, actor.employee.id, actor.employee.department.orgId)
    if (feedback.status === 'SUBMITTED') {
      throw new AppError(400, 'READ_ONLY', '최종 제출된 상향 평가는 수정할 수 없습니다.')
    }
    if (feedback.round.status !== 'IN_PROGRESS') {
      throw new AppError(400, 'ROUND_NOT_ACTIVE', '현재 응답 가능한 상향 평가 라운드가 아닙니다.')
    }

    await persistResponses({
      feedbackId: feedback.id,
      responses: parsed.data.responses,
      questionsById: new Map(
        feedback.round.questions.map((question) => [question.id, { questionType: question.questionType }])
      ),
    })

    await prisma.multiFeedback.update({
      where: { id: feedback.id },
      data: {
        overallComment: parsed.data.overallComment?.trim() || null,
        status: 'IN_PROGRESS',
      },
    })

    await createAuditLog({
      userId: actor.employee.id,
      action: 'UPWARD_REVIEW_DRAFT_SAVED',
      entityType: 'MultiFeedback',
      entityId: feedback.id,
      newValue: {
        roundId: feedback.roundId,
        targetRevieweeId: feedback.receiverId,
      },
      ...getClientInfo(request),
    })

    return successResponse({
      message: '상향 평가 초안이 저장되었습니다.',
    })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ feedbackId: string }> }
) {
  try {
    const actor = await getActor()
    const { feedbackId } = await context.params
    const body = await request.json()
    const parsed = UpwardReviewResponseSchema.safeParse(body)
    if (!parsed.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        parsed.error.issues[0]?.message ?? '응답 내용을 확인해 주세요.'
      )
    }

    const feedback = await loadFeedback(feedbackId, actor.employee.id, actor.employee.department.orgId)
    if (feedback.status === 'SUBMITTED') {
      throw new AppError(400, 'READ_ONLY', '이미 제출이 완료된 상향 평가입니다.')
    }
    if (feedback.round.status !== 'IN_PROGRESS') {
      throw new AppError(400, 'ROUND_NOT_ACTIVE', '현재 응답 가능한 상향 평가 라운드가 아닙니다.')
    }

    for (const question of feedback.round.questions.filter((item) => item.isRequired && item.isActive)) {
      const answer = parsed.data.responses.find((item) => item.questionId === question.id)
      const hasRating = typeof answer?.ratingValue === 'number'
      const hasText =
        typeof answer?.textValue === 'string' &&
        (question.questionType === 'MULTIPLE_CHOICE'
          ? (() => {
              try {
                const parsedValue = JSON.parse(answer.textValue)
                return Array.isArray(parsedValue) && parsedValue.length > 0
              } catch {
                return answer.textValue.trim().length > 0
              }
            })()
          : answer.textValue.trim().length > 0)
      if (!hasRating && !hasText) {
        throw new AppError(400, 'MISSING_REQUIRED', `필수 문항에 응답해 주세요. ${question.questionText}`)
      }
    }

    await persistResponses({
      feedbackId: feedback.id,
      responses: parsed.data.responses,
      questionsById: new Map(
        feedback.round.questions.map((question) => [question.id, { questionType: question.questionType }])
      ),
    })

    await prisma.multiFeedback.update({
      where: { id: feedback.id },
      data: {
        overallComment: parsed.data.overallComment?.trim() || null,
        status: 'SUBMITTED',
        submittedAt: new Date(),
      },
    })

    await createAuditLog({
      userId: actor.employee.id,
      action: 'UPWARD_REVIEW_SUBMITTED',
      entityType: 'MultiFeedback',
      entityId: feedback.id,
      newValue: {
        roundId: feedback.roundId,
        targetRevieweeId: feedback.receiverId,
        revieweeName: feedback.receiver.empName,
      },
      ...getClientInfo(request),
    })

    return successResponse({
      message: '상향 평가가 최종 제출되었습니다.',
    })
  } catch (error) {
    return errorResponse(error)
  }
}
