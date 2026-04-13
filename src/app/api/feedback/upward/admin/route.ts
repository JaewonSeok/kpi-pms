import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createAuditLog, getClientInfo } from '@/lib/audit'
import { prisma } from '@/lib/prisma'
import {
  AppError,
  errorResponse,
  successResponse,
} from '@/lib/utils'
import {
  UpwardReviewAssignmentSchema,
  UpwardReviewResultReleaseSchema,
  UpwardReviewRoundSchema,
  UpwardReviewRoundWorkflowSchema,
  UpwardReviewSuggestionSchema,
  UpwardReviewTemplateQuestionSchema,
  UpwardReviewTemplateSchema,
} from '@/lib/validations'
import {
  buildUpwardSuggestions,
  parseUpwardReviewSettings,
  serializeUpwardReviewSettings,
  validateUpwardAssignment,
} from '@/lib/upward-review'
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

  const access = await getFeedbackReviewAdminAccess({
    employeeId: employee.id,
    actorRole: employee.role,
    orgId: employee.department.orgId,
  })

  return { session, employee, access }
}

async function ensureCanManageTemplates(actor: Awaited<ReturnType<typeof getActor>>) {
  if (!actor.access.canManageAllRounds) {
    throw new AppError(403, 'FORBIDDEN', '상향 평가 템플릿을 관리할 권한이 없습니다.')
  }
}

async function ensureCanManageRound(actor: Awaited<ReturnType<typeof getActor>>, roundId: string) {
  if (actor.access.canManageAllRounds) return
  if (!actor.access.canManageCollaboratorRounds) {
    throw new AppError(403, 'FORBIDDEN', '이 상향 평가 라운드를 관리할 권한이 없습니다.')
  }

  const collaboratorRoundIds = await getCollaboratorRoundIds({
    employeeId: actor.employee.id,
    roundIds: [roundId],
  })
  if (!collaboratorRoundIds.has(roundId)) {
    throw new AppError(403, 'FORBIDDEN', '공동 작업자로 지정된 라운드만 관리할 수 있습니다.')
  }
}

function cloneTemplateQuestions(
  questions: Array<{
    category: string | null
    questionText: string
    description: string | null
    questionType: 'TEXT' | 'RATING_SCALE' | 'MULTIPLE_CHOICE'
    scaleMin: number | null
    scaleMax: number | null
    isRequired: boolean
    isActive: boolean
    choiceOptions: unknown
    sortOrder: number
  }>
) {
  return questions.map((question) => ({
    category: question.category ?? '리더십',
    questionText: question.questionText,
    description: question.description,
    questionType: question.questionType,
    scaleMin: question.scaleMin,
    scaleMax: question.scaleMax,
    isRequired: question.isRequired,
    isActive: question.isActive,
    choiceOptions: question.choiceOptions as object | undefined,
    sortOrder: question.sortOrder,
  }))
}

export async function POST(request: Request) {
  try {
    const actor = await getActor()
    const body = await request.json()
    const action = typeof body?.action === 'string' ? body.action : ''
    const payload = body?.payload
    const clientInfo = getClientInfo(request)

    if (action === 'createTemplate' || action === 'updateTemplate') {
      await ensureCanManageTemplates(actor)
      const parsed = UpwardReviewTemplateSchema.safeParse(payload)
      if (!parsed.success) {
        throw new AppError(400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? '템플릿 정보를 확인해 주세요.')
      }

      const data = parsed.data
      const nextSettings = serializeUpwardReviewSettings({
        targetTypes: data.defaultTargetTypes,
      })

      if (action === 'createTemplate') {
        const template = await prisma.upwardReviewTemplate.create({
          data: {
            orgId: actor.employee.department.orgId,
            name: data.name,
            description: data.description,
            isActive: data.isActive,
            defaultMinResponses: data.defaultMinResponses,
            defaultSettings: nextSettings,
            createdById: actor.employee.id,
            updatedById: actor.employee.id,
          },
        })

        await createAuditLog({
          userId: actor.employee.id,
          action: 'UPWARD_REVIEW_TEMPLATE_CREATED',
          entityType: 'UpwardReviewTemplate',
          entityId: template.id,
          newValue: data,
          ipAddress: clientInfo.ipAddress,
          userAgent: clientInfo.userAgent,
        })

        return successResponse({
          templateId: template.id,
          message: '상향 평가 템플릿이 생성되었습니다.',
        })
      }

      const templateId = typeof payload?.templateId === 'string' ? payload.templateId : ''
      const existingTemplate = await prisma.upwardReviewTemplate.findFirst({
        where: {
          id: templateId,
          orgId: actor.employee.department.orgId,
        },
      })

      if (!existingTemplate) {
        throw new AppError(404, 'TEMPLATE_NOT_FOUND', '수정할 템플릿을 찾을 수 없습니다.')
      }

      await prisma.upwardReviewTemplate.update({
        where: { id: existingTemplate.id },
        data: {
          name: data.name,
          description: data.description,
          isActive: data.isActive,
          defaultMinResponses: data.defaultMinResponses,
          defaultSettings: nextSettings,
          updatedById: actor.employee.id,
        },
      })

      await createAuditLog({
        userId: actor.employee.id,
        action: 'UPWARD_REVIEW_TEMPLATE_UPDATED',
        entityType: 'UpwardReviewTemplate',
        entityId: existingTemplate.id,
        oldValue: {
          name: existingTemplate.name,
          description: existingTemplate.description,
          isActive: existingTemplate.isActive,
          defaultMinResponses: existingTemplate.defaultMinResponses,
          defaultSettings: existingTemplate.defaultSettings,
        },
        newValue: data,
        ipAddress: clientInfo.ipAddress,
        userAgent: clientInfo.userAgent,
      })

      return successResponse({
        templateId: existingTemplate.id,
        message: '상향 평가 템플릿이 저장되었습니다.',
      })
    }

    if (action === 'duplicateTemplate') {
      await ensureCanManageTemplates(actor)
      const templateId = typeof payload?.templateId === 'string' ? payload.templateId : ''
      const template = await prisma.upwardReviewTemplate.findFirst({
        where: {
          id: templateId,
          orgId: actor.employee.department.orgId,
        },
        include: {
          questions: {
            orderBy: [{ sortOrder: 'asc' }],
          },
        },
      })

      if (!template) {
        throw new AppError(404, 'TEMPLATE_NOT_FOUND', '복사할 템플릿을 찾을 수 없습니다.')
      }

      const duplicated = await prisma.upwardReviewTemplate.create({
        data: {
          orgId: actor.employee.department.orgId,
          name: `${template.name} 사본`,
          description: template.description,
          isActive: template.isActive,
          defaultMinResponses: template.defaultMinResponses,
          defaultSettings: template.defaultSettings as object | undefined,
          createdById: actor.employee.id,
          updatedById: actor.employee.id,
          questions: {
            create: template.questions.map((question) => ({
              category: question.category,
              questionText: question.questionText,
              description: question.description,
              questionType: question.questionType,
              scaleMin: question.scaleMin,
              scaleMax: question.scaleMax,
              isRequired: question.isRequired,
              isActive: question.isActive,
              choiceOptions: question.choiceOptions as object | undefined,
              sortOrder: question.sortOrder,
            })),
          },
        },
      })

      await createAuditLog({
        userId: actor.employee.id,
        action: 'UPWARD_REVIEW_TEMPLATE_CREATED',
        entityType: 'UpwardReviewTemplate',
        entityId: duplicated.id,
        newValue: {
          sourceTemplateId: template.id,
          sourceTemplateName: template.name,
        },
        ipAddress: clientInfo.ipAddress,
        userAgent: clientInfo.userAgent,
      })

      return successResponse({
        templateId: duplicated.id,
        message: '상향 평가 템플릿이 복사되었습니다.',
      })
    }

    if (action === 'deleteTemplate') {
      await ensureCanManageTemplates(actor)
      const templateId = typeof payload?.templateId === 'string' ? payload.templateId : ''
      const template = await prisma.upwardReviewTemplate.findFirst({
        where: {
          id: templateId,
          orgId: actor.employee.department.orgId,
        },
      })

      if (!template) {
        throw new AppError(404, 'TEMPLATE_NOT_FOUND', '삭제할 템플릿을 찾을 수 없습니다.')
      }

      await prisma.upwardReviewTemplate.delete({
        where: { id: template.id },
      })

      await createAuditLog({
        userId: actor.employee.id,
        action: 'UPWARD_REVIEW_TEMPLATE_DELETED',
        entityType: 'UpwardReviewTemplate',
        entityId: template.id,
        oldValue: {
          name: template.name,
        },
        ipAddress: clientInfo.ipAddress,
        userAgent: clientInfo.userAgent,
      })

      return successResponse({
        templateId: template.id,
        message: '상향 평가 템플릿이 삭제되었습니다.',
      })
    }

    if (action === 'saveQuestion') {
      await ensureCanManageTemplates(actor)
      const parsed = UpwardReviewTemplateQuestionSchema.safeParse(payload)
      if (!parsed.success) {
        throw new AppError(400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? '문항 정보를 확인해 주세요.')
      }

      const data = parsed.data
      const template = await prisma.upwardReviewTemplate.findFirst({
        where: {
          id: data.templateId,
          orgId: actor.employee.department.orgId,
        },
        include: {
          questions: {
            orderBy: [{ sortOrder: 'asc' }],
          },
        },
      })

      if (!template) {
        throw new AppError(404, 'TEMPLATE_NOT_FOUND', '문항을 저장할 템플릿을 찾을 수 없습니다.')
      }

      if (data.questionId) {
        const existingQuestion = template.questions.find((question) => question.id === data.questionId)
        if (!existingQuestion) {
          throw new AppError(404, 'QUESTION_NOT_FOUND', '수정할 문항을 찾을 수 없습니다.')
        }

        await prisma.upwardReviewTemplateQuestion.update({
          where: { id: existingQuestion.id },
          data: {
            category: data.category,
            questionText: data.questionText,
            description: data.description,
            questionType: data.questionType,
            scaleMin: data.questionType === 'RATING_SCALE' ? data.scaleMin ?? 1 : null,
            scaleMax: data.questionType === 'RATING_SCALE' ? data.scaleMax ?? 5 : null,
            isRequired: data.isRequired,
            isActive: data.isActive,
            choiceOptions: data.questionType === 'MULTIPLE_CHOICE' ? data.choiceOptions : [],
          },
        })

        await createAuditLog({
          userId: actor.employee.id,
          action: 'UPWARD_REVIEW_QUESTION_UPDATED',
          entityType: 'UpwardReviewTemplateQuestion',
          entityId: existingQuestion.id,
          oldValue: {
            questionText: existingQuestion.questionText,
            questionType: existingQuestion.questionType,
          },
          newValue: data,
          ipAddress: clientInfo.ipAddress,
          userAgent: clientInfo.userAgent,
        })

        return successResponse({
          questionId: existingQuestion.id,
          message: '문항이 저장되었습니다.',
        })
      }

      const sortOrder = (template.questions.at(-1)?.sortOrder ?? -1) + 1
      const question = await prisma.upwardReviewTemplateQuestion.create({
        data: {
          templateId: template.id,
          category: data.category,
          questionText: data.questionText,
          description: data.description,
          questionType: data.questionType,
          scaleMin: data.questionType === 'RATING_SCALE' ? data.scaleMin ?? 1 : null,
          scaleMax: data.questionType === 'RATING_SCALE' ? data.scaleMax ?? 5 : null,
          isRequired: data.isRequired,
          isActive: data.isActive,
          choiceOptions: data.questionType === 'MULTIPLE_CHOICE' ? data.choiceOptions : [],
          sortOrder,
        },
      })

      await createAuditLog({
        userId: actor.employee.id,
        action: 'UPWARD_REVIEW_QUESTION_CREATED',
        entityType: 'UpwardReviewTemplateQuestion',
        entityId: question.id,
        newValue: data,
        ipAddress: clientInfo.ipAddress,
        userAgent: clientInfo.userAgent,
      })

      return successResponse({
        questionId: question.id,
        message: '문항이 추가되었습니다.',
      })
    }

    if (action === 'deleteQuestion') {
      await ensureCanManageTemplates(actor)
      const questionId = typeof payload?.questionId === 'string' ? payload.questionId : ''
      const question = await prisma.upwardReviewTemplateQuestion.findFirst({
        where: {
          id: questionId,
          template: {
            orgId: actor.employee.department.orgId,
          },
        },
      })

      if (!question) {
        throw new AppError(404, 'QUESTION_NOT_FOUND', '삭제할 문항을 찾을 수 없습니다.')
      }

      await prisma.upwardReviewTemplateQuestion.delete({
        where: { id: question.id },
      })

      await createAuditLog({
        userId: actor.employee.id,
        action: 'UPWARD_REVIEW_QUESTION_DELETED',
        entityType: 'UpwardReviewTemplateQuestion',
        entityId: question.id,
        oldValue: {
          questionText: question.questionText,
        },
        ipAddress: clientInfo.ipAddress,
        userAgent: clientInfo.userAgent,
      })

      return successResponse({
        questionId: question.id,
        message: '문항이 삭제되었습니다.',
      })
    }

    if (action === 'moveQuestion') {
      await ensureCanManageTemplates(actor)
      const templateId = typeof payload?.templateId === 'string' ? payload.templateId : ''
      const questionId = typeof payload?.questionId === 'string' ? payload.questionId : ''
      const direction = payload?.direction === 'up' ? 'up' : payload?.direction === 'down' ? 'down' : null
      if (!templateId || !questionId || !direction) {
        throw new AppError(400, 'VALIDATION_ERROR', '문항 이동 정보를 확인해 주세요.')
      }

      const template = await prisma.upwardReviewTemplate.findFirst({
        where: {
          id: templateId,
          orgId: actor.employee.department.orgId,
        },
        include: {
          questions: {
            orderBy: [{ sortOrder: 'asc' }],
          },
        },
      })

      if (!template) {
        throw new AppError(404, 'TEMPLATE_NOT_FOUND', '문항 순서를 변경할 템플릿을 찾을 수 없습니다.')
      }

      const currentIndex = template.questions.findIndex((question) => question.id === questionId)
      if (currentIndex === -1) {
        throw new AppError(404, 'QUESTION_NOT_FOUND', '순서를 변경할 문항을 찾을 수 없습니다.')
      }

      const nextIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
      if (nextIndex < 0 || nextIndex >= template.questions.length) {
        return successResponse({
          questionId,
          message: '문항 순서가 이미 끝에 있습니다.',
        })
      }

      const current = template.questions[currentIndex]
      const swap = template.questions[nextIndex]
      await prisma.$transaction([
        prisma.upwardReviewTemplateQuestion.update({
          where: { id: current.id },
          data: { sortOrder: swap.sortOrder },
        }),
        prisma.upwardReviewTemplateQuestion.update({
          where: { id: swap.id },
          data: { sortOrder: current.sortOrder },
        }),
      ])

      await createAuditLog({
        userId: actor.employee.id,
        action: 'UPWARD_REVIEW_QUESTION_REORDERED',
        entityType: 'UpwardReviewTemplateQuestion',
        entityId: current.id,
        newValue: {
          direction,
          swapQuestionId: swap.id,
        },
        ipAddress: clientInfo.ipAddress,
        userAgent: clientInfo.userAgent,
      })

      return successResponse({
        questionId: current.id,
        message: '문항 순서가 변경되었습니다.',
      })
    }

    if (action === 'saveRound') {
      const parsed = UpwardReviewRoundSchema.safeParse(payload)
      if (!parsed.success) {
        throw new AppError(400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? '라운드 설정을 확인해 주세요.')
      }

      const data = parsed.data
      const template = await prisma.upwardReviewTemplate.findFirst({
        where: {
          id: data.templateId,
          orgId: actor.employee.department.orgId,
        },
        include: {
          questions: {
            orderBy: [{ sortOrder: 'asc' }],
          },
        },
      })

      if (!template) {
        throw new AppError(404, 'TEMPLATE_NOT_FOUND', '선택한 템플릿을 찾을 수 없습니다.')
      }

      const evalCycle = await prisma.evalCycle.findFirst({
        where: {
          id: data.evalCycleId,
          orgId: actor.employee.department.orgId,
        },
      })

      if (!evalCycle) {
        throw new AppError(404, 'EVAL_CYCLE_NOT_FOUND', '평가 주기를 찾을 수 없습니다.')
      }

      if (data.roundId) {
        await ensureCanManageRound(actor, data.roundId)
        const existingRound = await prisma.multiFeedbackRound.findFirst({
          where: {
            id: data.roundId,
            roundType: 'UPWARD',
            evalCycle: {
              orgId: actor.employee.department.orgId,
            },
          },
        })

        if (!existingRound) {
          throw new AppError(404, 'ROUND_NOT_FOUND', '수정할 상향 평가 라운드를 찾을 수 없습니다.')
        }

        const currentSettings = parseUpwardReviewSettings(existingRound.documentSettings)
        const settings = serializeUpwardReviewSettings({
          ...currentSettings,
          templateId: template.id,
          templateName: template.name,
          targetTypes: data.targetTypes,
          resultViewerMode: data.resultViewerMode,
          rawResponsePolicy: data.rawResponsePolicy,
        })

        await prisma.multiFeedbackRound.update({
          where: { id: existingRound.id },
          data: {
            evalCycleId: data.evalCycleId,
            roundName: data.roundName,
            startDate: new Date(data.startDate),
            endDate: new Date(data.endDate),
            minRaters: data.minRaters,
            isAnonymous: true,
            maxRaters: 20,
            documentSettings: settings,
          },
        })

        await createAuditLog({
          userId: actor.employee.id,
          action: 'UPWARD_REVIEW_ROUND_UPDATED',
          entityType: 'MultiFeedbackRound',
          entityId: existingRound.id,
          newValue: data,
          ipAddress: clientInfo.ipAddress,
          userAgent: clientInfo.userAgent,
        })

        return successResponse({
          roundId: existingRound.id,
          message: '상향 평가 라운드가 저장되었습니다.',
        })
      }

      const settings = serializeUpwardReviewSettings({
        templateId: template.id,
        templateName: template.name,
        targetTypes: data.targetTypes,
        resultViewerMode: data.resultViewerMode,
        rawResponsePolicy: data.rawResponsePolicy,
      })

      const round = await prisma.multiFeedbackRound.create({
        data: {
          evalCycleId: data.evalCycleId,
          roundName: data.roundName,
          roundType: 'UPWARD',
          startDate: new Date(data.startDate),
          endDate: new Date(data.endDate),
          status: 'DRAFT',
          isAnonymous: true,
          minRaters: data.minRaters,
          maxRaters: 20,
          weightInFinal: 0,
          createdById: actor.employee.id,
          documentSettings: settings,
          questions: {
            create: cloneTemplateQuestions(template.questions),
          },
        },
      })

      await createAuditLog({
        userId: actor.employee.id,
        action: 'UPWARD_REVIEW_ROUND_CREATED',
        entityType: 'MultiFeedbackRound',
        entityId: round.id,
        newValue: data,
        ipAddress: clientInfo.ipAddress,
        userAgent: clientInfo.userAgent,
      })

      return successResponse({
        roundId: round.id,
        message: '상향 평가 라운드가 생성되었습니다.',
      })
    }

    if (action === 'syncRoundQuestions') {
      const roundId = typeof payload?.roundId === 'string' ? payload.roundId : ''
      await ensureCanManageRound(actor, roundId)

      const round = await prisma.multiFeedbackRound.findFirst({
        where: {
          id: roundId,
          roundType: 'UPWARD',
          evalCycle: {
            orgId: actor.employee.department.orgId,
          },
        },
        include: {
          feedbacks: true,
        },
      })

      if (!round) {
        throw new AppError(404, 'ROUND_NOT_FOUND', '동기화할 라운드를 찾을 수 없습니다.')
      }

      if (round.status !== 'DRAFT') {
        throw new AppError(400, 'ROUND_NOT_DRAFT', '문항 동기화는 초안 상태에서만 가능합니다.')
      }

      if (round.feedbacks.some((feedback) => feedback.status !== 'PENDING')) {
        throw new AppError(400, 'ROUND_ALREADY_STARTED', '응답이 시작된 라운드는 문항을 다시 동기화할 수 없습니다.')
      }

      const settings = parseUpwardReviewSettings(round.documentSettings)
      if (!settings.templateId) {
        throw new AppError(400, 'TEMPLATE_NOT_SELECTED', '라운드에 연결된 템플릿이 없습니다.')
      }

      const template = await prisma.upwardReviewTemplate.findFirst({
        where: {
          id: settings.templateId,
          orgId: actor.employee.department.orgId,
        },
        include: {
          questions: {
            orderBy: [{ sortOrder: 'asc' }],
          },
        },
      })

      if (!template) {
        throw new AppError(404, 'TEMPLATE_NOT_FOUND', '연결된 템플릿을 찾을 수 없습니다.')
      }

      await prisma.$transaction([
        prisma.feedbackQuestion.deleteMany({
          where: { roundId: round.id },
        }),
        prisma.multiFeedbackRound.update({
          where: { id: round.id },
          data: {
            documentSettings: serializeUpwardReviewSettings({
              ...settings,
              templateName: template.name,
            }),
            questions: {
              create: cloneTemplateQuestions(template.questions),
            },
          },
        }),
      ])

      return successResponse({
        roundId: round.id,
        message: '라운드 문항이 템플릿 기준으로 다시 동기화되었습니다.',
      })
    }

    if (action === 'updateRoundStatus') {
      const parsed = UpwardReviewRoundWorkflowSchema.safeParse(payload)
      if (!parsed.success) {
        throw new AppError(400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? '라운드 상태 변경 정보를 확인해 주세요.')
      }

      const data = parsed.data
      await ensureCanManageRound(actor, data.roundId)
      const round = await prisma.multiFeedbackRound.findFirst({
        where: {
          id: data.roundId,
          roundType: 'UPWARD',
          evalCycle: { orgId: actor.employee.department.orgId },
        },
      })

      if (!round) {
        throw new AppError(404, 'ROUND_NOT_FOUND', '상향 평가 라운드를 찾을 수 없습니다.')
      }

      const nextStatus =
        data.action === 'START' ? 'IN_PROGRESS' : data.action === 'CLOSE' ? 'COMPLETED' : 'IN_PROGRESS'

      await prisma.multiFeedbackRound.update({
        where: { id: round.id },
        data: {
          status: nextStatus,
        },
      })

      await createAuditLog({
        userId: actor.employee.id,
        action: 'UPWARD_REVIEW_ROUND_UPDATED',
        entityType: 'MultiFeedbackRound',
        entityId: round.id,
        oldValue: { status: round.status },
        newValue: { status: nextStatus, workflowAction: data.action },
        ipAddress: clientInfo.ipAddress,
        userAgent: clientInfo.userAgent,
      })

      return successResponse({
        roundId: round.id,
        message:
          data.action === 'START'
            ? '상향 평가 라운드가 시작되었습니다.'
            : data.action === 'CLOSE'
              ? '상향 평가 라운드가 마감되었습니다.'
              : '상향 평가 라운드가 다시 열렸습니다.',
      })
    }

    if (action === 'setRelease') {
      const parsed = UpwardReviewResultReleaseSchema.safeParse(payload)
      if (!parsed.success) {
        throw new AppError(400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? '공개 설정 정보를 확인해 주세요.')
      }

      const data = parsed.data
      await ensureCanManageRound(actor, data.roundId)
      const round = await prisma.multiFeedbackRound.findFirst({
        where: {
          id: data.roundId,
          roundType: 'UPWARD',
          evalCycle: { orgId: actor.employee.department.orgId },
        },
      })

      if (!round) {
        throw new AppError(404, 'ROUND_NOT_FOUND', '상향 평가 라운드를 찾을 수 없습니다.')
      }

      const settings = parseUpwardReviewSettings(round.documentSettings)
      const nextSettings = serializeUpwardReviewSettings({
        ...settings,
        resultReleasedAt: data.released ? new Date().toISOString() : null,
        resultReleasedById: data.released ? actor.employee.id : null,
      })

      await prisma.multiFeedbackRound.update({
        where: { id: round.id },
        data: {
          documentSettings: nextSettings,
        },
      })

      await createAuditLog({
        userId: actor.employee.id,
        action: data.released ? 'UPWARD_REVIEW_RESULT_RELEASED' : 'UPWARD_REVIEW_RESULT_UNRELEASED',
        entityType: 'MultiFeedbackRound',
        entityId: round.id,
        newValue: nextSettings,
        ipAddress: clientInfo.ipAddress,
        userAgent: clientInfo.userAgent,
      })

      return successResponse({
        roundId: round.id,
        message: data.released ? '상향 평가 결과가 공개되었습니다.' : '상향 평가 결과 공개가 해제되었습니다.',
      })
    }

    if (action === 'addAssignment') {
      const parsed = UpwardReviewAssignmentSchema.safeParse(payload)
      if (!parsed.success) {
        throw new AppError(400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? '매핑 정보를 확인해 주세요.')
      }

      const data = parsed.data
      await ensureCanManageRound(actor, data.roundId)

      const [round, evaluator, evaluatee, existingAssignment] = await Promise.all([
        prisma.multiFeedbackRound.findFirst({
          where: {
            id: data.roundId,
            roundType: 'UPWARD',
            evalCycle: { orgId: actor.employee.department.orgId },
          },
        }),
        prisma.employee.findFirst({
          where: {
            id: data.evaluatorId,
            department: { orgId: actor.employee.department.orgId },
            status: 'ACTIVE',
          },
          select: {
            id: true,
            empName: true,
            teamLeaderId: true,
            sectionChiefId: true,
            divisionHeadId: true,
          },
        }),
        prisma.employee.findFirst({
          where: {
            id: data.evaluateeId,
            department: { orgId: actor.employee.department.orgId },
            status: 'ACTIVE',
          },
          select: {
            id: true,
            empName: true,
          },
        }),
        prisma.multiFeedback.findUnique({
          where: {
            roundId_giverId_receiverId: {
              roundId: data.roundId,
              giverId: data.evaluatorId,
              receiverId: data.evaluateeId,
            },
          },
        }),
      ])

      if (!round) {
        throw new AppError(404, 'ROUND_NOT_FOUND', '라운드를 찾을 수 없습니다.')
      }
      if (!evaluator || !evaluatee) {
        throw new AppError(404, 'EMPLOYEE_NOT_FOUND', '평가자 또는 피평가자를 찾을 수 없습니다.')
      }
      if (existingAssignment) {
        throw new AppError(400, 'DUPLICATE_ASSIGNMENT', '이미 같은 평가자-피평가자 매핑이 존재합니다.')
      }

      const validationMessage = validateUpwardAssignment({
        evaluator,
        evaluatee,
        relationship: data.relationship,
      })
      if (validationMessage) {
        throw new AppError(400, 'INVALID_ASSIGNMENT', validationMessage)
      }

      const assignment = await prisma.multiFeedback.create({
        data: {
          roundId: data.roundId,
          giverId: data.evaluatorId,
          receiverId: data.evaluateeId,
          relationship: data.relationship,
          status: 'PENDING',
        },
      })

      await createAuditLog({
        userId: actor.employee.id,
        action: 'UPWARD_REVIEW_ASSIGNMENT_UPSERTED',
        entityType: 'MultiFeedback',
        entityId: assignment.id,
        newValue: data,
        ipAddress: clientInfo.ipAddress,
        userAgent: clientInfo.userAgent,
      })

      return successResponse({
        assignmentId: assignment.id,
        message: '평가자-피평가자 매핑이 추가되었습니다.',
      })
    }

    if (action === 'addSuggestedAssignments') {
      const parsed = UpwardReviewSuggestionSchema.safeParse(payload)
      if (!parsed.success) {
        throw new AppError(400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? '추천 매핑 정보를 확인해 주세요.')
      }

      const data = parsed.data
      await ensureCanManageRound(actor, data.roundId)
      const round = await prisma.multiFeedbackRound.findFirst({
        where: {
          id: data.roundId,
          roundType: 'UPWARD',
          evalCycle: { orgId: actor.employee.department.orgId },
        },
        include: {
          feedbacks: {
            select: {
              giverId: true,
              receiverId: true,
            },
          },
        },
      })

      if (!round) {
        throw new AppError(404, 'ROUND_NOT_FOUND', '라운드를 찾을 수 없습니다.')
      }

      const settings = parseUpwardReviewSettings(round.documentSettings)
      const employees = await prisma.employee.findMany({
        where: {
          department: { orgId: actor.employee.department.orgId },
          status: 'ACTIVE',
        },
        select: {
          id: true,
          empName: true,
          role: true,
          position: true,
          deptId: true,
          jobTitle: true,
          teamName: true,
          teamLeaderId: true,
          sectionChiefId: true,
          divisionHeadId: true,
          department: { select: { deptName: true } },
        },
      })

      const suggestions = buildUpwardSuggestions({
        employees: employees.map((item) => ({
          id: item.id,
          empName: item.empName,
          role: item.role,
          position: item.position,
          deptId: item.deptId,
          deptName: item.department.deptName,
          jobTitle: item.jobTitle,
          teamName: item.teamName,
          teamLeaderId: item.teamLeaderId,
          sectionChiefId: item.sectionChiefId,
          divisionHeadId: item.divisionHeadId,
        })),
        targetTypes: settings.targetTypes,
        evaluateeId: data.evaluateeId,
        existingPairs: round.feedbacks.map((feedback) => ({
          evaluatorId: feedback.giverId,
          evaluateeId: feedback.receiverId,
        })),
      })

      let createdCount = 0
      for (const suggestion of suggestions) {
        await prisma.multiFeedback.create({
          data: {
            roundId: round.id,
            giverId: suggestion.evaluatorId,
            receiverId: suggestion.evaluateeId,
            relationship: suggestion.relationship,
            status: 'PENDING',
          },
        })
        createdCount += 1
      }

      await createAuditLog({
        userId: actor.employee.id,
        action: 'UPWARD_REVIEW_ASSIGNMENT_UPSERTED',
        entityType: 'MultiFeedbackRound',
        entityId: round.id,
        newValue: {
          suggestedCount: createdCount,
          evaluateeId: data.evaluateeId ?? null,
        },
        ipAddress: clientInfo.ipAddress,
        userAgent: clientInfo.userAgent,
      })

      return successResponse({
        createdCount,
        message:
          createdCount > 0
            ? `${createdCount}건의 추천 매핑을 추가했습니다.`
            : '추가할 추천 매핑이 없습니다.',
      })
    }

    if (action === 'removeAssignment') {
      const assignmentId = typeof payload?.assignmentId === 'string' ? payload.assignmentId : ''
      const assignment = await prisma.multiFeedback.findFirst({
        where: {
          id: assignmentId,
          round: {
            roundType: 'UPWARD',
            evalCycle: { orgId: actor.employee.department.orgId },
          },
        },
      })

      if (!assignment) {
        throw new AppError(404, 'ASSIGNMENT_NOT_FOUND', '삭제할 매핑을 찾을 수 없습니다.')
      }

      await ensureCanManageRound(actor, assignment.roundId)

      if (assignment.status === 'SUBMITTED') {
        throw new AppError(400, 'ASSIGNMENT_ALREADY_SUBMITTED', '제출이 완료된 매핑은 삭제할 수 없습니다.')
      }

      await prisma.multiFeedback.delete({
        where: { id: assignment.id },
      })

      await createAuditLog({
        userId: actor.employee.id,
        action: 'UPWARD_REVIEW_ASSIGNMENT_DELETED',
        entityType: 'MultiFeedback',
        entityId: assignment.id,
        oldValue: {
          roundId: assignment.roundId,
          giverId: assignment.giverId,
          receiverId: assignment.receiverId,
        },
        ipAddress: clientInfo.ipAddress,
        userAgent: clientInfo.userAgent,
      })

      return successResponse({
        assignmentId: assignment.id,
        message: '매핑이 삭제되었습니다.',
      })
    }

    throw new AppError(400, 'UNKNOWN_ACTION', '지원하지 않는 관리자 작업입니다.')
  } catch (error) {
    return errorResponse(error)
  }
}
