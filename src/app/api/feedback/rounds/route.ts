import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AppError, errorResponse, successResponse } from '@/lib/utils'
import { getCollaboratorRoundIds, getFeedbackReviewAdminAccess } from '@/server/feedback-360-access'

export async function GET() {
  try {
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

    const reviewAdminAccess = await getFeedbackReviewAdminAccess({
      employeeId: employee.id,
      actorRole: employee.role,
      orgId: employee.department.orgId,
    })

    const rounds = await prisma.multiFeedbackRound.findMany({
      where: {
        evalCycle: {
          orgId: employee.department.orgId,
        },
      },
      include: {
        evalCycle: {
          select: {
            id: true,
            cycleName: true,
            evalYear: true,
          },
        },
        _count: {
          select: {
            feedbacks: true,
            questions: true,
          },
        },
      },
      orderBy: [{ endDate: 'desc' }, { createdAt: 'desc' }],
    })

    const collaboratorRoundIds =
      reviewAdminAccess.canManageAllRounds || !reviewAdminAccess.canManageCollaboratorRounds
        ? new Set<string>()
        : await getCollaboratorRoundIds({
            employeeId: employee.id,
            roundIds: rounds.map((round) => round.id),
          })

    const visibleRounds = reviewAdminAccess.canManageAllRounds
      ? rounds
      : reviewAdminAccess.canManageCollaboratorRounds
        ? rounds.filter((round) => collaboratorRoundIds.has(round.id))
        : []

    return successResponse(
      visibleRounds.map((round) => ({
        id: round.id,
        roundName: round.roundName,
        roundType: round.roundType,
        status: round.status,
        isAnonymous: round.isAnonymous,
        minRaters: round.minRaters,
        maxRaters: round.maxRaters,
        evalCycleId: round.evalCycleId,
        cycleName: round.evalCycle.cycleName,
        evalYear: round.evalCycle.evalYear,
        questionCount: round._count.questions,
        feedbackCount: round._count.feedbacks,
        startDate: round.startDate,
        endDate: round.endDate,
      }))
    )
  } catch (error) {
    return errorResponse(error)
  }
}
