import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createAuditLog, getClientInfo } from '@/lib/audit'
import { prisma } from '@/lib/prisma'
import { AppError, errorResponse, successResponse } from '@/lib/utils'
import { FeedbackRoundSettingsSchema } from '@/lib/validations'
import {
  DEFAULT_FEEDBACK_RESULT_PRESENTATION_SETTINGS,
  parseFeedbackResultPresentationSettings,
} from '@/lib/feedback-result-presentation'
import { parseFeedbackReportAnalysisSettings } from '@/lib/feedback-report-analysis'
import { parseFeedbackRatingGuideSettings } from '@/lib/feedback-rating-guide'
import {
  DEFAULT_FEEDBACK_SELECTION_SETTINGS,
  DEFAULT_FEEDBACK_VISIBILITY_SETTINGS,
  parseFeedbackSelectionSettings,
  parseFeedbackVisibilitySettings,
} from '@/server/feedback-360-workflow'
import {
  buildFeedbackReviewAdminAccess,
  canManageFeedbackRoundByAccess,
  getFeedbackReviewAdminAccess,
} from '@/server/feedback-360-access'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')

    const employee = await prisma.employee.findUnique({
      where: { id: session.user.id },
      include: {
        department: true,
      },
    })

    if (!employee) {
      throw new AppError(404, 'EMPLOYEE_NOT_FOUND', '직원 정보를 찾을 수 없습니다.')
    }

    const { id } = await context.params
    const validated = FeedbackRoundSettingsSchema.safeParse(await request.json())
    if (!validated.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        validated.error.issues[0]?.message ?? '설정 값을 확인해 주세요.'
      )
    }

    const existing = await prisma.multiFeedbackRound.findUnique({
      where: { id },
      include: {
        questions: {
          select: {
            id: true,
            questionText: true,
            questionType: true,
            scaleMin: true,
            scaleMax: true,
          },
        },
        collaborators: {
          select: {
            employeeId: true,
          },
        },
        evalCycle: {
          select: {
            orgId: true,
          },
        },
      },
    })

    if (!existing) {
      throw new AppError(404, 'ROUND_NOT_FOUND', '360 리뷰 라운드를 찾을 수 없습니다.')
    }

    if (existing.evalCycle.orgId !== employee.department.orgId && session.user.role !== 'ROLE_ADMIN') {
      throw new AppError(403, 'FORBIDDEN', '현재 조직에서 관리할 수 없는 리뷰 라운드입니다.')
    }

    const reviewAdminAccess = await getFeedbackReviewAdminAccess({
      employeeId: employee.id,
      actorRole: employee.role,
      orgId: employee.department.orgId,
    })

    const canManageRound = await canManageFeedbackRoundByAccess({
      access: reviewAdminAccess,
      employeeId: employee.id,
      roundId: id,
    })

    if (!canManageRound) {
      throw new AppError(403, 'FORBIDDEN', '이 리뷰 라운드를 관리할 권한이 없습니다.')
    }

    const nextFolderId =
      validated.data.folderId === undefined ? existing.folderId : validated.data.folderId ?? null

    if (!reviewAdminAccess.canManageAllRounds && nextFolderId !== existing.folderId) {
      throw new AppError(
        403,
        'FORBIDDEN',
        '폴더 변경은 모든 리뷰 사이클/템플릿 관리 권한이 있는 관리자만 수행할 수 있습니다.'
      )
    }

    if (nextFolderId) {
      const folder = await prisma.feedbackFolder.findUnique({
        where: { id: nextFolderId },
        select: {
          id: true,
          orgId: true,
        },
      })

      if (!folder || folder.orgId !== existing.evalCycle.orgId) {
        throw new AppError(400, 'INVALID_FOLDER', '선택한 폴더를 현재 라운드에 연결할 수 없습니다.')
      }
    }

    const nextSelectionSettings = validated.data.selectionSettings
      ? {
          ...DEFAULT_FEEDBACK_SELECTION_SETTINGS,
          ...validated.data.selectionSettings,
        }
      : parseFeedbackSelectionSettings(existing.selectionSettings)

    const nextVisibilitySettings = validated.data.visibilitySettings
      ? {
          ...DEFAULT_FEEDBACK_VISIBILITY_SETTINGS,
          ...validated.data.visibilitySettings,
        }
      : parseFeedbackVisibilitySettings(existing.visibilitySettings)

    const nextResultPresentationSettings = validated.data.resultPresentationSettings
      ? {
          ...DEFAULT_FEEDBACK_RESULT_PRESENTATION_SETTINGS,
          ...validated.data.resultPresentationSettings,
        }
      : parseFeedbackResultPresentationSettings(existing.resultPresentationSettings)

    const nextReportAnalysisSettings =
      validated.data.reportAnalysisSettings !== undefined
        ? parseFeedbackReportAnalysisSettings(validated.data.reportAnalysisSettings)
        : parseFeedbackReportAnalysisSettings(existing.reportAnalysisSettings)
    const ratingQuestions = existing.questions
      .filter((question) => question.questionType === 'RATING_SCALE')
      .map((question) => ({
        id: question.id,
        questionText: question.questionText,
        scaleMin: question.scaleMin,
        scaleMax: question.scaleMax,
      }))
    const nextRatingGuideSettings =
      validated.data.ratingGuideSettings !== undefined
        ? parseFeedbackRatingGuideSettings(validated.data.ratingGuideSettings, ratingQuestions)
        : parseFeedbackRatingGuideSettings(existing.ratingGuideSettings, ratingQuestions)

    const currentQuestionMap = new Map(
      existing.questions.map((question) => [question.id, question.questionText] as const)
    )

    if (validated.data.questions) {
      for (const question of validated.data.questions) {
        if (!currentQuestionMap.has(question.id)) {
          throw new AppError(400, 'INVALID_QUESTION', '현재 라운드에 속하지 않는 문항은 수정할 수 없습니다.')
        }
      }
    }

    const nextCollaboratorIds =
      validated.data.collaboratorIds !== undefined
        ? Array.from(new Set(validated.data.collaboratorIds))
        : existing.collaborators.map((collaborator) => collaborator.employeeId)

    if (validated.data.collaboratorIds !== undefined) {
      const collaboratorEmployees = nextCollaboratorIds.length
        ? await prisma.employee.findMany({
            where: {
              id: { in: nextCollaboratorIds },
              status: 'ACTIVE',
              department: {
                orgId: existing.evalCycle.orgId,
              },
            },
            select: {
              id: true,
              role: true,
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
          })
        : []

      if (collaboratorEmployees.length !== nextCollaboratorIds.length) {
        throw new AppError(
          400,
          'INVALID_COLLABORATOR',
          '같은 조직의 재직 관리자만 공동 작업자로 지정할 수 있습니다.'
        )
      }

      for (const collaborator of collaboratorEmployees) {
        const collaboratorAccess = buildFeedbackReviewAdminAccess({
          actorRole: collaborator.role,
          groups: collaborator.feedbackAdminGroupMemberships.map((membership) => membership.group),
        })

        if (!collaboratorAccess.canManageCollaboratorRounds && !collaboratorAccess.canManageAllRounds) {
          throw new AppError(
            400,
            'INVALID_COLLABORATOR_SCOPE',
            '공동 작업자 권한이 있는 관리자만 리뷰 공동 작업자로 지정할 수 있습니다.'
          )
        }
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (validated.data.questions?.length) {
        for (const question of validated.data.questions) {
          const previousText = currentQuestionMap.get(question.id)
          if (previousText === undefined || previousText === question.questionText) continue

          await tx.feedbackQuestion.update({
            where: { id: question.id },
            data: {
              questionText: question.questionText,
            },
          })
        }
      }

      if (validated.data.collaboratorIds !== undefined) {
        await tx.feedbackRoundCollaborator.deleteMany({
          where: {
            roundId: existing.id,
          },
        })

        if (nextCollaboratorIds.length) {
          await tx.feedbackRoundCollaborator.createMany({
            data: nextCollaboratorIds.map((collaboratorId) => ({
              roundId: existing.id,
              employeeId: collaboratorId,
              createdById: session.user.id,
            })),
            skipDuplicates: true,
          })
        }
      }

      return tx.multiFeedbackRound.update({
        where: { id },
        data: {
          ...(validated.data.folderId !== undefined ? { folderId: nextFolderId } : {}),
          ...(validated.data.selectionSettings !== undefined
            ? { selectionSettings: nextSelectionSettings }
            : {}),
          ...(validated.data.visibilitySettings !== undefined
            ? { visibilitySettings: nextVisibilitySettings }
            : {}),
          ...(validated.data.resultPresentationSettings !== undefined
            ? { resultPresentationSettings: nextResultPresentationSettings }
            : {}),
          ...(validated.data.reportAnalysisSettings !== undefined
            ? { reportAnalysisSettings: nextReportAnalysisSettings }
            : {}),
          ...(validated.data.ratingGuideSettings !== undefined
            ? { ratingGuideSettings: nextRatingGuideSettings }
            : {}),
        },
        select: {
          id: true,
          folderId: true,
          selectionSettings: true,
          visibilitySettings: true,
          resultPresentationSettings: true,
          reportAnalysisSettings: true,
          ratingGuideSettings: true,
        },
      })
    })

    await createAuditLog({
      userId: session.user.id,
      action: 'FEEDBACK_ROUND_SETTINGS_UPDATED',
      entityType: 'MultiFeedbackRound',
      entityId: updated.id,
      oldValue: {
        folderId: existing.folderId,
        selectionSettings: parseFeedbackSelectionSettings(existing.selectionSettings),
        visibilitySettings: parseFeedbackVisibilitySettings(existing.visibilitySettings),
        resultPresentationSettings: parseFeedbackResultPresentationSettings(existing.resultPresentationSettings),
        reportAnalysisSettings: parseFeedbackReportAnalysisSettings(existing.reportAnalysisSettings),
        ratingGuideSettings: parseFeedbackRatingGuideSettings(existing.ratingGuideSettings, ratingQuestions),
        collaboratorIds: existing.collaborators.map((collaborator) => collaborator.employeeId),
        questions: existing.questions.map((question) => ({
          id: question.id,
          questionText: question.questionText,
        })),
      },
      newValue: {
        folderId: updated.folderId,
        selectionSettings: parseFeedbackSelectionSettings(updated.selectionSettings),
        visibilitySettings: parseFeedbackVisibilitySettings(updated.visibilitySettings),
        resultPresentationSettings: parseFeedbackResultPresentationSettings(updated.resultPresentationSettings),
        reportAnalysisSettings: parseFeedbackReportAnalysisSettings(updated.reportAnalysisSettings),
        ratingGuideSettings: parseFeedbackRatingGuideSettings(updated.ratingGuideSettings, ratingQuestions),
        collaboratorIds: nextCollaboratorIds,
        questions:
          validated.data.questions?.map((question) => ({
            id: question.id,
            questionText: question.questionText,
          })) ??
          existing.questions.map((question) => ({
            id: question.id,
            questionText: question.questionText,
          })),
      },
      ...getClientInfo(request),
    })

    return successResponse({
      roundId: updated.id,
      folderId: updated.folderId,
      collaboratorIds: nextCollaboratorIds,
      selectionSettings: parseFeedbackSelectionSettings(updated.selectionSettings),
      visibilitySettings: parseFeedbackVisibilitySettings(updated.visibilitySettings),
      resultPresentationSettings: parseFeedbackResultPresentationSettings(updated.resultPresentationSettings),
      reportAnalysisSettings: parseFeedbackReportAnalysisSettings(updated.reportAnalysisSettings),
      ratingGuideSettings: parseFeedbackRatingGuideSettings(updated.ratingGuideSettings, ratingQuestions),
    })
  } catch (error) {
    return errorResponse(error)
  }
}
