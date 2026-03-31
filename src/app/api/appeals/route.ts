import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { AppealSchema } from '@/lib/validations'
import { AppError, errorResponse, successResponse } from '@/lib/utils'
import { prisma } from '@/lib/prisma'
import { createAuditLog, getClientInfo } from '@/lib/audit'

const APPEAL_DRAFT_ENTITY_TYPE = 'AppealDraft'

function normalizeAppealPayload(body: Record<string, unknown>) {
  return {
    reason: typeof body.reason === 'string' ? body.reason.trim() : '',
    category:
      typeof body.category === 'string' && body.category.trim().length > 0
        ? body.category.trim()
        : '점수 이의',
    requestedAction:
      typeof body.requestedAction === 'string' && body.requestedAction.trim().length > 0
        ? body.requestedAction.trim()
        : '재검토 요청',
    relatedTargets: Array.isArray(body.relatedTargets)
      ? body.relatedTargets.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      : ['최종 등급'],
    attachments: Array.isArray(body.attachments) ? body.attachments : [],
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')

    const body = (await request.json()) as Record<string, unknown>
    const action = String(body.action ?? '')
    const evaluationId = typeof body.evaluationId === 'string' ? body.evaluationId : ''
    const payload = normalizeAppealPayload(body)

    const evaluation = await prisma.evaluation.findUnique({
      where: { id: evaluationId },
      include: {
        evalCycle: true,
      },
    })

    if (!evaluation) {
      throw new AppError(404, 'EVALUATION_NOT_FOUND', '대상 평가 결과를 찾지 못했습니다.')
    }
    if (evaluation.targetId !== session.user.id) {
      throw new AppError(403, 'FORBIDDEN', '본인 평가 결과에 대해서만 이의 신청할 수 있습니다.')
    }

    const now = new Date()
    const cycleAllowsAppeal =
      ['RESULT_OPEN', 'APPEAL'].includes(evaluation.evalCycle.status) &&
      (!evaluation.evalCycle.appealDeadline || evaluation.evalCycle.appealDeadline >= now)

    if (!cycleAllowsAppeal) {
      throw new AppError(400, 'APPEAL_WINDOW_CLOSED', '현재는 이의 신청 가능 기간이 아닙니다.')
    }

    const existingAppeal = await prisma.appeal.findFirst({
      where: {
        evaluationId: evaluation.id,
        appealerId: session.user.id,
        status: {
          in: ['SUBMITTED', 'UNDER_REVIEW'],
        },
      },
    })

    if (existingAppeal) {
      throw new AppError(409, 'APPEAL_ALREADY_EXISTS', '이미 진행 중인 이의 신청이 있습니다.')
    }

    const client = getClientInfo(request)

    if (action === 'save_draft') {
      const previousDraft = await prisma.auditLog.findFirst({
        where: {
          entityType: APPEAL_DRAFT_ENTITY_TYPE,
          entityId: evaluation.id,
          userId: session.user.id,
          action: 'APPEAL_DRAFT_SAVED',
        },
        orderBy: {
          timestamp: 'desc',
        },
      })

      await createAuditLog({
        userId: session.user.id,
        action: 'APPEAL_DRAFT_SAVED',
        entityType: APPEAL_DRAFT_ENTITY_TYPE,
        entityId: evaluation.id,
        oldValue:
          previousDraft?.newValue && typeof previousDraft.newValue === 'object'
            ? (previousDraft.newValue as object)
            : { status: 'DRAFT' },
        newValue: {
          status: 'DRAFT',
          reason: payload.reason,
          category: payload.category,
          requestedAction: payload.requestedAction,
          relatedTargets: payload.relatedTargets,
          attachments: payload.attachments,
        },
        ...client,
      })

      return successResponse({
        saved: true,
        status: 'DRAFT',
      })
    }

    const parsed = AppealSchema.parse(body)

    const appeal = await prisma.appeal.create({
      data: {
        evaluationId: evaluation.id,
        appealerId: session.user.id,
        reason: parsed.reason,
        status: 'SUBMITTED',
      },
    })

    await createAuditLog({
      userId: session.user.id,
      action: 'APPEAL_CREATED',
      entityType: 'Appeal',
      entityId: appeal.id,
      oldValue: { status: 'DRAFT' },
      newValue: {
        status: 'SUBMITTED',
        reason: payload.reason,
        category: payload.category,
        requestedAction: payload.requestedAction,
        relatedTargets: payload.relatedTargets,
        attachments: payload.attachments,
      },
      ...client,
    })

    return successResponse({
      id: appeal.id,
      status: appeal.status,
    })
  } catch (error) {
    return errorResponse(error)
  }
}
