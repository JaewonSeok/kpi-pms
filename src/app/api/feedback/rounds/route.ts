import type { FeedbackStatus, MultiFeedbackRound } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { buildAnytimeReviewDefaultQuestions, buildFeedbackAnytimeRoundName, parseFeedbackAnytimeDocumentSettings, resolveAnytimeFeedbackRelationship } from '@/lib/feedback-anytime-review'
import { authOptions } from '@/lib/auth'
import { createAuditLog, getClientInfo } from '@/lib/audit'
import { prisma } from '@/lib/prisma'
import { AppError, errorResponse, successResponse } from '@/lib/utils'
import { CreateFeedbackAnytimeReviewSchema, FeedbackAnytimeBulkActionSchema } from '@/lib/validations'
import { getCollaboratorRoundIds, getFeedbackReviewAdminAccess } from '@/server/feedback-360-access'

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

async function getReviewAdminAccess(employeeId: string, actorRole: Parameters<typeof getFeedbackReviewAdminAccess>[0]['actorRole'], orgId: string) {
  return getFeedbackReviewAdminAccess({
    employeeId,
    actorRole,
    orgId,
  })
}

function getRoundSummary(round: Pick<MultiFeedbackRound, 'id' | 'roundName' | 'roundType' | 'status' | 'isAnonymous' | 'minRaters' | 'maxRaters' | 'evalCycleId' | 'startDate' | 'endDate' | 'documentKind'> & {
  evalCycle: {
    cycleName: string
    evalYear: number
  }
  _count: {
    feedbacks: number
    questions: number
  }
}) {
  return {
    id: round.id,
    roundName: round.roundName,
    roundType: round.roundType,
    documentKind: round.documentKind,
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
  }
}

export async function GET() {
  try {
    const { employee } = await getActor()

    const reviewAdminAccess = await getReviewAdminAccess(employee.id, employee.role, employee.department.orgId)

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

    return successResponse(visibleRounds.map((round) => getRoundSummary(round)))
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const { employee } = await getActor()
    const reviewAdminAccess = await getReviewAdminAccess(employee.id, employee.role, employee.department.orgId)
    if (!reviewAdminAccess.canManageAllRounds && !reviewAdminAccess.canManageCollaboratorRounds) {
      throw new AppError(403, 'FORBIDDEN', '수시 리뷰 문서를 생성할 권한이 없습니다.')
    }

    const body = await request.json()
    const parsed = CreateFeedbackAnytimeReviewSchema.safeParse(body)
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? '수시 리뷰 문서 입력값이 올바르지 않습니다.')
    }

    const {
      evalCycleId,
      roundName,
      documentKind,
      dueDate,
      reviewerId,
      targetIds,
      reason,
      templateRoundId,
      collaboratorIds = [],
      folderId,
      projectName,
      projectCode,
      pip,
    } = parsed.data

    const evalCycle = await prisma.evalCycle.findFirst({
      where: {
        id: evalCycleId,
        orgId: employee.department.orgId,
      },
      select: {
        id: true,
        orgId: true,
      },
    })

    if (!evalCycle) {
      throw new AppError(404, 'EVAL_CYCLE_NOT_FOUND', '수시 리뷰 문서를 생성할 평가 주기를 찾을 수 없습니다.')
    }

    const [reviewer, targets, folder, templateRound, collaborators] = await Promise.all([
      prisma.employee.findFirst({
        where: {
          id: reviewerId,
          status: 'ACTIVE',
          department: {
            orgId: evalCycle.orgId,
          },
        },
        select: {
          id: true,
          empName: true,
          teamLeaderId: true,
          sectionChiefId: true,
          divisionHeadId: true,
        },
      }),
      prisma.employee.findMany({
        where: {
          id: { in: targetIds },
          status: 'ACTIVE',
          department: {
            orgId: evalCycle.orgId,
          },
        },
        select: {
          id: true,
          empName: true,
          teamLeaderId: true,
          sectionChiefId: true,
          divisionHeadId: true,
        },
        orderBy: [{ empName: 'asc' }],
      }),
      folderId
        ? prisma.feedbackFolder.findFirst({
            where: {
              id: folderId,
              orgId: evalCycle.orgId,
            },
            select: {
              id: true,
            },
          })
        : Promise.resolve(null),
      templateRoundId
        ? prisma.multiFeedbackRound.findFirst({
            where: {
              id: templateRoundId,
              evalCycle: {
                orgId: evalCycle.orgId,
              },
            },
            include: {
              questions: {
                orderBy: [{ sortOrder: 'asc' }],
              },
            },
          })
        : Promise.resolve(null),
      collaboratorIds.length
        ? prisma.employee.findMany({
            where: {
              id: { in: collaboratorIds },
              status: 'ACTIVE',
              department: {
                orgId: evalCycle.orgId,
              },
            },
            select: {
              id: true,
            },
          })
        : Promise.resolve([]),
    ])

    if (!reviewer) {
      throw new AppError(404, 'REVIEWER_NOT_FOUND', '지정한 리뷰어를 찾을 수 없습니다.')
    }

    if (targets.length !== targetIds.length) {
      throw new AppError(400, 'TARGET_NOT_FOUND', '리뷰 대상자 중 일부를 찾을 수 없습니다.')
    }

    if (folderId && !folder) {
      throw new AppError(404, 'FOLDER_NOT_FOUND', '선택한 폴더를 찾을 수 없습니다.')
    }

    if (templateRoundId && !templateRound) {
      throw new AppError(404, 'TEMPLATE_ROUND_NOT_FOUND', '선택한 템플릿 리뷰를 찾을 수 없습니다.')
    }

    if (collaboratorIds.length && collaborators.length !== collaboratorIds.length) {
      throw new AppError(400, 'COLLABORATOR_NOT_FOUND', '공동 작업자 중 일부를 찾을 수 없습니다.')
    }

    const baseQuestions =
      templateRound?.questions.length
        ? templateRound.questions.map((question) => ({
            category: question.category,
            questionText: question.questionText,
            questionType: question.questionType,
            scaleMin: question.scaleMin,
            scaleMax: question.scaleMax,
            isRequired: question.isRequired,
            sortOrder: question.sortOrder,
          }))
        : buildAnytimeReviewDefaultQuestions(documentKind)

    const endDate = new Date(dueDate)
    const startDate = new Date()
    const clientInfo = getClientInfo(request)

    const createdRounds = await prisma.$transaction(async (tx) => {
      const created: Array<{ id: string; roundName: string; targetName: string }> = []

      for (const target of targets) {
        const anytimeRoundName = buildFeedbackAnytimeRoundName({
          baseName: roundName,
          targetName: target.empName,
          isMassCreate: targets.length > 1,
        })

        const round = await tx.multiFeedbackRound.create({
          data: {
            evalCycleId,
            folderId: folder?.id ?? null,
            roundName: anytimeRoundName,
            roundType: 'ANYTIME',
            documentKind,
            startDate,
            endDate,
            status: 'IN_PROGRESS',
            isAnonymous: false,
            minRaters: 1,
            maxRaters: 1,
            createdById: employee.id,
            selectionSettings: templateRound?.selectionSettings ?? undefined,
            visibilitySettings: templateRound?.visibilitySettings ?? undefined,
            resultPresentationSettings: templateRound?.resultPresentationSettings ?? undefined,
            reportAnalysisSettings: templateRound?.reportAnalysisSettings ?? undefined,
            ratingGuideSettings: templateRound?.ratingGuideSettings ?? undefined,
            documentSettings: {
              reason,
              templateRoundId: templateRound?.id ?? null,
              templateRoundName: templateRound?.roundName ?? null,
              projectName: projectName ?? null,
              projectCode: projectCode ?? null,
              lifecycleState: 'ACTIVE',
              lifecycleReason: null,
              pip:
                documentKind === 'PIP'
                  ? {
                      goals: pip?.goals ?? [],
                      expectedBehaviors: pip?.expectedBehaviors ?? [],
                      checkpoints: pip?.checkpoints ?? [],
                      midReview: pip?.midReview ?? '',
                      endJudgement: pip?.endJudgement ?? '',
                    }
                  : null,
            },
            questions: {
              create: baseQuestions.map((question) => ({
                category: question.category,
                questionText: question.questionText,
                questionType: question.questionType,
                scaleMin: question.scaleMin ?? null,
                scaleMax: question.scaleMax ?? null,
                isRequired: question.isRequired ?? true,
                sortOrder: question.sortOrder,
              })),
            },
            feedbacks: {
              create: {
                giverId: reviewer.id,
                receiverId: target.id,
                relationship: resolveAnytimeFeedbackRelationship({
                  reviewerId: reviewer.id,
                  targetId: target.id,
                  teamLeaderId: target.teamLeaderId,
                  sectionChiefId: target.sectionChiefId,
                  divisionHeadId: target.divisionHeadId,
                }),
                status: 'PENDING',
              },
            },
            collaborators: collaboratorIds.length
              ? {
                  createMany: {
                    data: collaboratorIds.map((collaboratorId) => ({
                      employeeId: collaboratorId,
                    })),
                    skipDuplicates: true,
                  },
                }
              : undefined,
          },
          select: {
            id: true,
            roundName: true,
          },
        })

        await createAuditLog({
          userId: employee.id,
          action: 'FEEDBACK_ANYTIME_REVIEW_CREATED',
          entityType: 'MultiFeedbackRound',
          entityId: round.id,
          newValue: {
            reviewType: 'ANYTIME',
            documentKind,
            reason,
            reviewerId: reviewer.id,
            reviewerName: reviewer.empName,
            targetId: target.id,
            targetName: target.empName,
            dueDate,
            templateRoundId: templateRound?.id ?? null,
            collaboratorIds,
            projectName: projectName ?? null,
            projectCode: projectCode ?? null,
          },
          ipAddress: clientInfo.ipAddress,
          userAgent: clientInfo.userAgent,
        })

        created.push({
          id: round.id,
          roundName: round.roundName,
          targetName: target.empName,
        })
      }

      return created
    })

    return successResponse({
      createdCount: createdRounds.length,
      roundIds: createdRounds.map((round) => round.id),
      message:
        createdRounds.length > 1
          ? `${createdRounds.length}건의 수시 리뷰 문서를 생성했습니다.`
          : '수시 리뷰 문서를 생성했습니다.',
    })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PATCH(request: Request) {
  try {
    const { employee } = await getActor()
    const reviewAdminAccess = await getReviewAdminAccess(employee.id, employee.role, employee.department.orgId)
    if (!reviewAdminAccess.canManageAllRounds && !reviewAdminAccess.canManageCollaboratorRounds) {
      throw new AppError(403, 'FORBIDDEN', '수시 리뷰 문서를 운영할 권한이 없습니다.')
    }

    const body = await request.json()
    const parsed = FeedbackAnytimeBulkActionSchema.safeParse(body)
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? '수시 리뷰 문서 일괄 작업 입력값이 올바르지 않습니다.')
    }

    const { action, roundIds, reason } = parsed.data
    const rounds = await prisma.multiFeedbackRound.findMany({
      where: {
        id: { in: roundIds },
        roundType: 'ANYTIME',
        evalCycle: {
          orgId: employee.department.orgId,
        },
      },
      include: {
        feedbacks: {
          include: {
            receiver: {
              select: {
                id: true,
                empName: true,
                teamLeaderId: true,
                sectionChiefId: true,
                divisionHeadId: true,
              },
            },
            giver: {
              select: {
                id: true,
                empName: true,
              },
            },
          },
        },
      },
    })

    if (!rounds.length) {
      throw new AppError(404, 'ANYTIME_REVIEW_NOT_FOUND', '선택한 수시 리뷰 문서를 찾을 수 없습니다.')
    }

    if (rounds.length !== roundIds.length) {
      throw new AppError(400, 'ANYTIME_REVIEW_PARTIAL_NOT_FOUND', '선택한 수시 리뷰 문서 중 일부를 찾을 수 없습니다.')
    }

    if (!reviewAdminAccess.canManageAllRounds) {
      const collaboratorRoundIds = await getCollaboratorRoundIds({
        employeeId: employee.id,
        roundIds,
      })
      const unauthorized = rounds.find((round) => !collaboratorRoundIds.has(round.id))
      if (unauthorized) {
        throw new AppError(403, 'ROUND_ACCESS_DENIED', '공동 작업자로 지정되지 않은 수시 리뷰 문서는 운영할 수 없습니다.')
      }
    }

    const nextReviewer =
      action === 'transfer-reviewer'
        ? await prisma.employee.findFirst({
            where: {
              id: parsed.data.reviewerId,
              status: 'ACTIVE',
              department: {
                orgId: employee.department.orgId,
              },
            },
            select: {
              id: true,
              empName: true,
            },
          })
        : null

    if (action === 'transfer-reviewer' && !nextReviewer) {
      throw new AppError(404, 'REVIEWER_NOT_FOUND', '이관할 리뷰어를 찾을 수 없습니다.')
    }

    const nextDueDate = action === 'change-due-date' ? new Date(parsed.data.dueDate) : null
    const clientInfo = getClientInfo(request)
    const failures: Array<{ roundId: string; roundName: string; reason: string }> = []
    const successes: Array<{ roundId: string; roundName: string }> = []

    for (const round of rounds) {
      const settings = parseFeedbackAnytimeDocumentSettings(round.documentSettings)
      const feedback = round.feedbacks[0]

      if (!feedback) {
        failures.push({
          roundId: round.id,
          roundName: round.roundName,
          reason: '리뷰 문서에 연결된 평가 요청이 없어 작업할 수 없습니다.',
        })
        continue
      }

      try {
        if (action === 'change-due-date') {
          await prisma.multiFeedbackRound.update({
            where: { id: round.id },
            data: {
              endDate: nextDueDate ?? undefined,
              documentSettings: {
                ...settings,
                lifecycleReason: reason,
              },
            },
          })

          await createAuditLog({
            userId: employee.id,
            action: 'FEEDBACK_ANYTIME_DUE_DATE_CHANGED',
            entityType: 'MultiFeedbackRound',
            entityId: round.id,
            oldValue: {
              dueDate: round.endDate.toISOString(),
            },
            newValue: {
              dueDate: parsed.data.dueDate,
              reason,
            },
            ipAddress: clientInfo.ipAddress,
            userAgent: clientInfo.userAgent,
          })
        }

        if (action === 'transfer-reviewer') {
          if (feedback.status === 'SUBMITTED') {
            throw new AppError(400, 'REVIEW_ALREADY_SUBMITTED', '이미 제출된 수시 리뷰는 리뷰어를 이관할 수 없습니다.')
          }

          const nextRelationship = resolveAnytimeFeedbackRelationship({
            reviewerId: nextReviewer!.id,
            targetId: feedback.receiverId,
            teamLeaderId: feedback.receiver.teamLeaderId,
            sectionChiefId: feedback.receiver.sectionChiefId,
            divisionHeadId: feedback.receiver.divisionHeadId,
          })

          await prisma.multiFeedback.update({
            where: { id: feedback.id },
            data: {
              giverId: nextReviewer!.id,
              relationship: nextRelationship,
              status: 'PENDING',
              submittedAt: null,
            },
          })

          await createAuditLog({
            userId: employee.id,
            action: 'FEEDBACK_ANYTIME_REVIEWER_TRANSFERRED',
            entityType: 'MultiFeedbackRound',
            entityId: round.id,
            oldValue: {
              reviewerId: feedback.giver.id,
              reviewerName: feedback.giver.empName,
            },
            newValue: {
              reviewerId: nextReviewer!.id,
              reviewerName: nextReviewer!.empName,
              reason,
            },
            ipAddress: clientInfo.ipAddress,
            userAgent: clientInfo.userAgent,
          })
        }

        if (action === 'cancel') {
          if (feedback.status === 'SUBMITTED') {
            throw new AppError(400, 'REVIEW_ALREADY_SUBMITTED', '이미 제출된 수시 리뷰는 취소할 수 없습니다.')
          }

          await prisma.multiFeedbackRound.update({
            where: { id: round.id },
            data: {
              status: 'CANCELLED',
              documentSettings: {
                ...settings,
                lifecycleState: 'CANCELLED',
                lifecycleReason: reason,
              },
            },
          })

          await createAuditLog({
            userId: employee.id,
            action: 'FEEDBACK_ANYTIME_REVIEW_CANCELLED',
            entityType: 'MultiFeedbackRound',
            entityId: round.id,
            oldValue: {
              status: round.status,
            },
            newValue: {
              status: 'CANCELLED',
              reason,
            },
            ipAddress: clientInfo.ipAddress,
            userAgent: clientInfo.userAgent,
          })
        }

        if (action === 'close') {
          await prisma.multiFeedbackRound.update({
            where: { id: round.id },
            data: {
              status: 'CLOSED',
              documentSettings: {
                ...settings,
                lifecycleState: 'CLOSED',
                lifecycleReason: reason,
              },
            },
          })

          await createAuditLog({
            userId: employee.id,
            action: 'FEEDBACK_ANYTIME_REVIEW_CLOSED',
            entityType: 'MultiFeedbackRound',
            entityId: round.id,
            oldValue: {
              status: round.status,
            },
            newValue: {
              status: 'CLOSED',
              reason,
            },
            ipAddress: clientInfo.ipAddress,
            userAgent: clientInfo.userAgent,
          })
        }

        if (action === 'reopen') {
          const feedbackUpdate: { status: FeedbackStatus; submittedAt: Date | null } =
            feedback.status === 'SUBMITTED'
              ? {
                  status: 'IN_PROGRESS',
                  submittedAt: null,
                }
              : {
                  status: feedback.status,
                  submittedAt: feedback.submittedAt,
                }

          await prisma.$transaction([
            prisma.multiFeedbackRound.update({
              where: { id: round.id },
              data: {
                status: 'IN_PROGRESS',
                documentSettings: {
                  ...settings,
                  lifecycleState: 'ACTIVE',
                  lifecycleReason: reason,
                },
              },
            }),
            prisma.multiFeedback.update({
              where: { id: feedback.id },
              data: feedbackUpdate,
            }),
          ])

          await createAuditLog({
            userId: employee.id,
            action: 'FEEDBACK_ANYTIME_REVIEW_REOPENED',
            entityType: 'MultiFeedbackRound',
            entityId: round.id,
            oldValue: {
              status: round.status,
            },
            newValue: {
              status: 'IN_PROGRESS',
              reason,
            },
            ipAddress: clientInfo.ipAddress,
            userAgent: clientInfo.userAgent,
          })
        }

        successes.push({
          roundId: round.id,
          roundName: round.roundName,
        })
      } catch (error) {
        const message =
          error instanceof AppError ? error.message : '수시 리뷰 문서 일괄 작업 중 오류가 발생했습니다.'
        failures.push({
          roundId: round.id,
          roundName: round.roundName,
          reason: message,
        })
      }
    }

    return successResponse({
      successCount: successes.length,
      failureCount: failures.length,
      failures,
      message:
        failures.length > 0
          ? `${successes.length}건 처리, ${failures.length}건은 확인이 필요합니다.`
          : `${successes.length}건의 수시 리뷰 문서를 처리했습니다.`,
    })
  } catch (error) {
    return errorResponse(error)
  }
}
