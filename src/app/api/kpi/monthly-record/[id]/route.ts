import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAuditLog, getClientInfo } from '@/lib/audit'
import { getMonthlyAttachmentAuditSummary } from '@/lib/monthly-attachments'
import { AppError, calcAchievementRate, errorResponse, successResponse } from '@/lib/utils'
import { UpdateMonthlyRecordSchema } from '@/lib/validations'
import { canAccessEmployee } from '@/server/auth/authorize'
import { resolveMonthlyOperationalStatus } from '@/server/monthly-kpi-workflow'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')

    const { id } = await context.params
    const body = await request.json()
    const validated = UpdateMonthlyRecordSchema.safeParse(body)
    if (!validated.success) {
      throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0]?.message || '잘못된 월간 실적 수정 요청입니다.')
    }

    const current = await prisma.monthlyRecord.findUnique({
      where: { id },
      include: {
        personalKpi: {
          include: {
            employee: true,
          },
        },
      },
    })

    if (!current) {
      throw new AppError(404, 'MONTHLY_RECORD_NOT_FOUND', '월간 실적을 찾을 수 없습니다.')
    }

    const canWrite =
      current.employeeId === session.user.id ||
      (session.user.role === 'ROLE_ADMIN' && canAccessEmployee(session, current.personalKpi.employee))

    if (!canWrite) {
      throw new AppError(403, 'FORBIDDEN', '월간 실적을 수정할 권한이 없습니다.')
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
      isDraft: current.isDraft,
      submittedAt: current.submittedAt,
      logs,
    })

    if (!['NOT_STARTED', 'DRAFT'].includes(operationalStatus)) {
      throw new AppError(409, 'MONTHLY_RECORD_READ_ONLY', '제출 이후 월간 실적은 기본적으로 읽기 전용입니다. 관리자 unlock 후 수정해 주세요.')
    }

    let achievementRate = current.achievementRate ?? undefined
    const nextActualValue = validated.data.actualValue === undefined ? current.actualValue : validated.data.actualValue
    if (
      current.personalKpi.kpiType === 'QUANTITATIVE' &&
      typeof nextActualValue === 'number' &&
      current.personalKpi.targetValue
    ) {
      achievementRate = calcAchievementRate(nextActualValue, current.personalKpi.targetValue)
    }

    const updated = await prisma.monthlyRecord.update({
      where: { id },
      data: {
        ...(validated.data.actualValue !== undefined ? { actualValue: validated.data.actualValue } : {}),
        ...(validated.data.activities !== undefined ? { activities: validated.data.activities } : {}),
        ...(validated.data.obstacles !== undefined ? { obstacles: validated.data.obstacles } : {}),
        ...(validated.data.efforts !== undefined ? { efforts: validated.data.efforts } : {}),
        ...(validated.data.attachments !== undefined ? { attachments: validated.data.attachments as never } : {}),
        ...(validated.data.isDraft !== undefined ? { isDraft: validated.data.isDraft } : {}),
        ...(achievementRate !== undefined ? { achievementRate } : {}),
      },
    })

    await createAuditLog({
      userId: session.user.id,
      action: 'MONTHLY_RECORD_UPDATED',
      entityType: 'MonthlyRecord',
      entityId: id,
      oldValue: {
        actualValue: current.actualValue,
        achievementRate: current.achievementRate,
        activities: current.activities,
        obstacles: current.obstacles,
        efforts: current.efforts,
        attachments: getMonthlyAttachmentAuditSummary(current.attachments),
        isDraft: current.isDraft,
      },
      newValue: {
        actualValue: updated.actualValue,
        achievementRate: updated.achievementRate,
        activities: updated.activities,
        obstacles: updated.obstacles,
        efforts: updated.efforts,
        attachments: getMonthlyAttachmentAuditSummary(updated.attachments),
        isDraft: updated.isDraft,
      },
      ...getClientInfo(request),
    })

    return successResponse(updated)
  } catch (error) {
    return errorResponse(error)
  }
}
