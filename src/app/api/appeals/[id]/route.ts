import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createAuditLog, getClientInfo } from '@/lib/audit'
import { prisma } from '@/lib/prisma'
import { AppError, errorResponse, successResponse } from '@/lib/utils'

export async function PATCH(
  request: Request,
  context: {
    params: Promise<{
      id: string
    }>
  }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')

    const { id } = await context.params
    const body = await request.json()
    const action = String(body.action ?? '')

    const appeal = await prisma.appeal.findUnique({
      where: { id },
      include: {
        evaluation: {
          include: {
            evalCycle: true,
          },
        },
        appealer: true,
      },
    })

    if (!appeal) throw new AppError(404, 'APPEAL_NOT_FOUND', '이의 신청 케이스를 찾지 못했습니다.')

    const isOwner = appeal.appealerId === session.user.id
    const isAdmin = session.user.role === 'ROLE_ADMIN'

    if (!isOwner && !isAdmin) {
      throw new AppError(403, 'FORBIDDEN', '이 케이스를 수정할 권한이 없습니다.')
    }

    const oldValue = {
      status: appeal.status,
      adminResponse: appeal.adminResponse,
    }
    const client = getClientInfo(request)

    if (action === 'withdraw') {
      if (!isOwner) throw new AppError(403, 'FORBIDDEN', '신청자만 철회할 수 있습니다.')

      const updated = await prisma.appeal.update({
        where: { id },
        data: {
          status: 'CLOSED',
          resolvedAt: new Date(),
        },
      })

      await createAuditLog({
        userId: session.user.id,
        action: 'APPEAL_WITHDRAWN',
        entityType: 'Appeal',
        entityId: updated.id,
        oldValue,
        newValue: { status: 'WITHDRAWN' },
        ...client,
      })

      return successResponse(updated)
    }

    if (action === 'resubmit') {
      if (!isOwner) throw new AppError(403, 'FORBIDDEN', '신청자만 재제출할 수 있습니다.')

      const reason = String(body.reason ?? '').trim()
      if (reason.length < 20) {
        throw new AppError(400, 'INVALID_REASON', '이의 신청 사유는 20자 이상 입력해 주세요.')
      }

      const updated = await prisma.appeal.update({
        where: { id },
        data: {
          status: 'SUBMITTED',
          reason,
          adminResponse: null,
          resolvedAt: null,
        },
      })

      await createAuditLog({
        userId: session.user.id,
        action: 'APPEAL_RESUBMITTED',
        entityType: 'Appeal',
        entityId: updated.id,
        oldValue,
        newValue: {
          status: 'SUBMITTED',
          category: body.category,
          requestedAction: body.requestedAction,
          relatedTargets: Array.isArray(body.relatedTargets) ? body.relatedTargets : [],
          attachments: Array.isArray(body.attachments) ? body.attachments : [],
        },
        ...client,
      })

      return successResponse(updated)
    }

    if (!isAdmin) {
      throw new AppError(403, 'FORBIDDEN', '운영자만 처리 상태를 변경할 수 있습니다.')
    }

    if (action === 'start_review') {
      const updated = await prisma.appeal.update({
        where: { id },
        data: {
          status: 'UNDER_REVIEW',
        },
      })

      await createAuditLog({
        userId: session.user.id,
        action: 'APPEAL_REVIEW_STARTED',
        entityType: 'Appeal',
        entityId: updated.id,
        oldValue,
        newValue: {
          status: 'UNDER_REVIEW',
          assignedTo: { id: session.user.id, name: session.user.name },
        },
        ...client,
      })

      return successResponse(updated)
    }

    if (action === 'request_info') {
      const note = String(body.note ?? '').trim()
      if (!note) throw new AppError(400, 'MISSING_NOTE', '보완 요청 사유를 입력해 주세요.')

      const updated = await prisma.appeal.update({
        where: { id },
        data: {
          status: 'UNDER_REVIEW',
          adminResponse: note,
        },
      })

      await createAuditLog({
        userId: session.user.id,
        action: 'APPEAL_INFO_REQUESTED',
        entityType: 'Appeal',
        entityId: updated.id,
        oldValue,
        newValue: {
          status: 'INFO_REQUESTED',
          resolutionNote: note,
          assignedTo: { id: session.user.id, name: session.user.name },
        },
        ...client,
      })

      return successResponse(updated)
    }

    if (action === 'resolve' || action === 'reject') {
      const note = String(body.note ?? '').trim()
      if (!note) throw new AppError(400, 'MISSING_NOTE', '결정 사유를 입력해 주세요.')

      const nextStatus = action === 'resolve' ? 'ACCEPTED' : 'REJECTED'
      const updated = await prisma.appeal.update({
        where: { id },
        data: {
          status: nextStatus,
          adminResponse: note,
          resolvedAt: new Date(),
        },
      })

      await createAuditLog({
        userId: session.user.id,
        action: action === 'resolve' ? 'APPEAL_RESOLVED' : 'APPEAL_REJECTED',
        entityType: 'Appeal',
        entityId: updated.id,
        oldValue,
        newValue: {
          status: action === 'resolve' ? 'RESOLVED' : 'REJECTED',
          resolutionType: body.resolutionType ?? (action === 'resolve' ? '재검토 반영' : '기각'),
          resolutionNote: note,
          assignedTo: { id: session.user.id, name: session.user.name },
          beforeScore: body.beforeScore,
          afterScore: body.afterScore,
          beforeGrade: body.beforeGrade,
          afterGrade: body.afterGrade,
        },
        ...client,
      })

      return successResponse(updated)
    }

    throw new AppError(400, 'INVALID_ACTION', '지원하지 않는 액션입니다.')
  } catch (error) {
    return errorResponse(error)
  }
}
