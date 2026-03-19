import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAuditLog, getClientInfo } from '@/lib/audit'
import { AppError, errorResponse, successResponse } from '@/lib/utils'
import { MonthlyRecordWorkflowActionSchema } from '@/lib/validations'
import {
  canLockMonthlyRecord,
  canReviewMonthlyRecord,
  canSubmitMonthlyRecord,
  canUnlockMonthlyRecord,
  resolveMonthlyOperationalStatus,
} from '@/server/monthly-kpi-workflow'

type RouteContext = {
  params: Promise<{ id: string }>
}

function canReview(role: string) {
  return ['ROLE_ADMIN', 'ROLE_CEO', 'ROLE_DIV_HEAD', 'ROLE_SECTION_CHIEF', 'ROLE_TEAM_LEADER'].includes(role)
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')

    const { id } = await context.params
    const body = await request.json()
    const validated = MonthlyRecordWorkflowActionSchema.safeParse(body)
    if (!validated.success) {
      throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0]?.message || '잘못된 월간 실적 상태 요청입니다.')
    }

    const record = await prisma.monthlyRecord.findUnique({
      where: { id },
      include: {
        personalKpi: {
          include: {
            employee: true,
          },
        },
      },
    })

    if (!record) {
      throw new AppError(404, 'MONTHLY_RECORD_NOT_FOUND', '월간 실적을 찾을 수 없습니다.')
    }

    const logs = await prisma.auditLog.findMany({
      where: {
        entityType: 'MonthlyRecord',
        entityId: id,
      },
      orderBy: { timestamp: 'desc' },
      take: 20,
    })

    const operationalStatus = resolveMonthlyOperationalStatus({
      hasRecord: true,
      isDraft: record.isDraft,
      submittedAt: record.submittedAt,
      logs,
    })

    const clientInfo = getClientInfo(request)

    if (validated.data.action === 'SUBMIT') {
      if (record.employeeId !== session.user.id && session.user.role !== 'ROLE_ADMIN') {
        throw new AppError(403, 'FORBIDDEN', '월간 실적을 제출할 권한이 없습니다.')
      }

      if (!canSubmitMonthlyRecord(operationalStatus)) {
        throw new AppError(409, 'MONTHLY_RECORD_NOT_SUBMITTABLE', '현재 상태에서는 제출할 수 없습니다.')
      }

      const updated = await prisma.monthlyRecord.update({
        where: { id },
        data: {
          isDraft: false,
          submittedAt: new Date(),
        },
      })

      await createAuditLog({
        userId: session.user.id,
        action: 'MONTHLY_RECORD_SUBMITTED',
        entityType: 'MonthlyRecord',
        entityId: id,
        oldValue: { workflowStatus: operationalStatus },
        newValue: { workflowStatus: 'SUBMITTED', comment: validated.data.comment },
        ...clientInfo,
      })

      return successResponse(updated)
    }

    if (validated.data.action === 'REVIEW' || validated.data.action === 'REQUEST_UPDATE') {
      if (!canReview(session.user.role)) {
        throw new AppError(403, 'FORBIDDEN', '월간 실적을 리뷰할 권한이 없습니다.')
      }

      if (!canReviewMonthlyRecord(operationalStatus)) {
        throw new AppError(409, 'MONTHLY_RECORD_NOT_REVIEWABLE', '제출된 월간 실적만 리뷰할 수 있습니다.')
      }

      await createAuditLog({
        userId: session.user.id,
        action:
          validated.data.action === 'REQUEST_UPDATE'
            ? 'MONTHLY_RECORD_REVIEW_REQUESTED'
            : 'MONTHLY_RECORD_REVIEWED',
        entityType: 'MonthlyRecord',
        entityId: id,
        oldValue: { workflowStatus: operationalStatus },
        newValue: {
          workflowStatus: validated.data.action === 'REQUEST_UPDATE' ? 'SUBMITTED' : 'REVIEWED',
          comment: validated.data.comment,
        },
        ...clientInfo,
      })

      return successResponse({
        id,
        workflowStatus: validated.data.action === 'REQUEST_UPDATE' ? 'SUBMITTED' : 'REVIEWED',
      })
    }

    if (validated.data.action === 'LOCK') {
      if (session.user.role !== 'ROLE_ADMIN') {
        throw new AppError(403, 'FORBIDDEN', '잠금은 관리자만 수행할 수 있습니다.')
      }

      if (!canLockMonthlyRecord(operationalStatus)) {
        throw new AppError(409, 'MONTHLY_RECORD_NOT_LOCKABLE', '리뷰 완료 상태의 월간 실적만 잠글 수 있습니다.')
      }

      await createAuditLog({
        userId: session.user.id,
        action: 'MONTHLY_RECORD_LOCKED',
        entityType: 'MonthlyRecord',
        entityId: id,
        oldValue: { workflowStatus: operationalStatus },
        newValue: { workflowStatus: 'LOCKED', comment: validated.data.comment },
        ...clientInfo,
      })

      return successResponse({ id, workflowStatus: 'LOCKED' })
    }

    if (session.user.role !== 'ROLE_ADMIN') {
      throw new AppError(403, 'FORBIDDEN', 'unlock는 관리자만 수행할 수 있습니다.')
    }

    if (!canUnlockMonthlyRecord(operationalStatus)) {
      throw new AppError(409, 'MONTHLY_RECORD_NOT_UNLOCKABLE', '잠금 상태의 월간 실적만 unlock할 수 있습니다.')
    }

    await createAuditLog({
      userId: session.user.id,
      action: 'MONTHLY_RECORD_UNLOCKED',
      entityType: 'MonthlyRecord',
      entityId: id,
      oldValue: { workflowStatus: operationalStatus },
      newValue: { workflowStatus: 'DRAFT', comment: validated.data.comment },
      ...clientInfo,
    })

    return successResponse({ id, workflowStatus: 'DRAFT' })
  } catch (error) {
    return errorResponse(error)
  }
}
