import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createAuditLog, getClientInfo } from '@/lib/audit'
import { prisma } from '@/lib/prisma'
import { AppError, errorResponse, successResponse } from '@/lib/utils'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '인증이 필요합니다.')
    if (session.user.role !== 'ROLE_ADMIN') {
      throw new AppError(403, 'FORBIDDEN', '관리자만 예외 승인 신청을 처리할 수 있습니다.')
    }

    const { id } = await context.params
    const body = (await request.json()) as Record<string, unknown>
    const action = typeof body.action === 'string' ? body.action : ''
    const reviewNote = typeof body.reviewNote === 'string' ? body.reviewNote.trim() : ''

    if (action !== 'approve' && action !== 'reject') {
      throw new AppError(400, 'INVALID_ACTION', "action은 'approve' 또는 'reject'여야 합니다.")
    }
    if (action === 'reject' && !reviewNote) {
      throw new AppError(400, 'MISSING_REVIEW_NOTE', '반려 사유를 입력해 주세요.')
    }

    const exceptionRequest = await prisma.orgKpiExceptionRequest.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        reason: true,
        orgKpiId: true,
        orgKpi: { select: { id: true, kpiName: true } },
        requester: { select: { id: true, empName: true } },
      },
    })

    if (!exceptionRequest) {
      throw new AppError(404, 'EXCEPTION_REQUEST_NOT_FOUND', '예외 승인 신청을 찾을 수 없습니다.')
    }
    if (exceptionRequest.status !== 'PENDING') {
      throw new AppError(409, 'ALREADY_RESOLVED', '이미 처리된 신청입니다.')
    }

    const now = new Date()
    const client = getClientInfo(request)

    if (action === 'approve') {
      // 트랜잭션: ExceptionRequest 상태 + OrgKpi mboException 동시 커밋
      await prisma.$transaction([
        prisma.orgKpiExceptionRequest.update({
          where: { id },
          data: {
            status: 'APPROVED',
            reviewerId: session.user.id,
            reviewNote: reviewNote || null,
            resolvedAt: now,
          },
        }),
        prisma.orgKpi.update({
          where: { id: exceptionRequest.orgKpiId },
          data: {
            mboExceptionApproved: true,
            mboExceptionReason: exceptionRequest.reason,
            mboExceptionApprovedById: session.user.id,
            mboExceptionApprovedAt: now,
          },
        }),
      ])

      await createAuditLog({
        userId: session.user.id,
        action: 'EXCEPTION_REQUEST_APPROVED',
        entityType: 'OrgKpiExceptionRequest',
        entityId: id,
        oldValue: { status: 'PENDING' },
        newValue: {
          status: 'APPROVED',
          orgKpiId: exceptionRequest.orgKpiId,
          kpiName: exceptionRequest.orgKpi.kpiName,
          reviewNote: reviewNote || null,
          requester: exceptionRequest.requester,
        },
        ...client,
      })

      return successResponse({ id, status: 'APPROVED', orgKpiId: exceptionRequest.orgKpiId })
    }

    // action === 'reject'
    await prisma.orgKpiExceptionRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        reviewerId: session.user.id,
        reviewNote,
        resolvedAt: now,
      },
    })

    await createAuditLog({
      userId: session.user.id,
      action: 'EXCEPTION_REQUEST_REJECTED',
      entityType: 'OrgKpiExceptionRequest',
      entityId: id,
      oldValue: { status: 'PENDING' },
      newValue: {
        status: 'REJECTED',
        orgKpiId: exceptionRequest.orgKpiId,
        kpiName: exceptionRequest.orgKpi.kpiName,
        reviewNote,
        requester: exceptionRequest.requester,
      },
      ...client,
    })

    return successResponse({ id, status: 'REJECTED', orgKpiId: exceptionRequest.orgKpiId })
  } catch (error) {
    return errorResponse(error)
  }
}
