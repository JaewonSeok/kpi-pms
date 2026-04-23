import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAuditLog, getClientInfo } from '@/lib/audit'
import { getMonthlyAttachmentAuditSummary } from '@/lib/monthly-attachments'
import { AppError, calcAchievementRate, errorResponse, successResponse } from '@/lib/utils'
import { MonthlyRecordSchema } from '@/lib/validations'
import { canAccessEmployee } from '@/server/auth/authorize'

function canManage(role: string) {
  return ['ROLE_ADMIN', 'ROLE_CEO', 'ROLE_DIV_HEAD', 'ROLE_SECTION_CHIEF', 'ROLE_TEAM_LEADER'].includes(role)
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')

    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employeeId') ?? session.user.id
    const year = searchParams.get('year')

    if (employeeId !== session.user.id) {
      if (!canManage(session.user.role)) {
        throw new AppError(403, 'FORBIDDEN', '다른 직원의 월간 실적을 조회할 권한이 없습니다.')
      }

      const targetEmployee = await prisma.employee.findUnique({
        where: { id: employeeId },
        select: { id: true, deptId: true },
      })

      if (!targetEmployee || !canAccessEmployee(session, targetEmployee)) {
        throw new AppError(403, 'FORBIDDEN', '권한 범위를 벗어난 직원입니다.')
      }
    }

    const records = await prisma.monthlyRecord.findMany({
      where: {
        employeeId,
        ...(year ? { yearMonth: { startsWith: `${year}` } } : {}),
      },
      include: {
        personalKpi: {
          include: {
            linkedOrgKpi: {
              select: {
                kpiName: true,
              },
            },
          },
        },
      },
      orderBy: [{ yearMonth: 'asc' }, { createdAt: 'asc' }],
    })

    return successResponse(records)
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')

    const body = await request.json()
    const validated = MonthlyRecordSchema.safeParse(body)
    if (!validated.success) {
      throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0]?.message || '잘못된 월간 실적 요청입니다.')
    }

    const data = validated.data
    const kpi = await prisma.personalKpi.findUnique({
      where: { id: data.personalKpiId },
      include: {
        employee: {
          select: {
            id: true,
            deptId: true,
          },
        },
      },
    })

    if (!kpi) {
      throw new AppError(404, 'KPI_NOT_FOUND', '개인 KPI를 찾을 수 없습니다.')
    }

    const canWrite =
      kpi.employeeId === session.user.id ||
      (session.user.role === 'ROLE_ADMIN' && canAccessEmployee(session, kpi.employee))

    if (!canWrite) {
      throw new AppError(403, 'FORBIDDEN', '해당 월간 실적을 입력할 권한이 없습니다.')
    }

    let achievementRate: number | undefined
    if (kpi.kpiType === 'QUANTITATIVE' && data.actualValue !== undefined && kpi.targetValue) {
      achievementRate = calcAchievementRate(data.actualValue, kpi.targetValue)
    }

    const existing = await prisma.monthlyRecord.findUnique({
      where: {
        personalKpiId_yearMonth: {
          personalKpiId: data.personalKpiId,
          yearMonth: data.yearMonth,
        },
      },
    })

    const record = await prisma.monthlyRecord.upsert({
      where: {
        personalKpiId_yearMonth: {
          personalKpiId: data.personalKpiId,
          yearMonth: data.yearMonth,
        },
      },
      create: {
        personalKpiId: data.personalKpiId,
        employeeId: kpi.employeeId,
        yearMonth: data.yearMonth,
        actualValue: data.actualValue,
        achievementRate,
        activities: data.activities,
        obstacles: data.obstacles,
        efforts: data.efforts,
        evidenceComment: data.evidenceComment,
        attachments: data.attachments as never,
        isDraft: data.isDraft,
        submittedAt: data.isDraft ? null : new Date(),
      },
      update: {
        actualValue: data.actualValue,
        achievementRate,
        activities: data.activities,
        obstacles: data.obstacles,
        efforts: data.efforts,
        evidenceComment: data.evidenceComment,
        attachments: data.attachments as never,
        isDraft: data.isDraft,
        submittedAt: data.isDraft ? existing?.submittedAt : new Date(),
      },
    })

    await createAuditLog({
      userId: session.user.id,
      action: existing ? 'MONTHLY_RECORD_UPDATED' : 'MONTHLY_RECORD_CREATED',
      entityType: 'MonthlyRecord',
      entityId: record.id,
      oldValue: existing
        ? {
            actualValue: existing.actualValue,
            achievementRate: existing.achievementRate,
            activities: existing.activities,
            obstacles: existing.obstacles,
            efforts: existing.efforts,
            evidenceComment: existing.evidenceComment,
            attachments: getMonthlyAttachmentAuditSummary(existing.attachments),
            isDraft: existing.isDraft,
          }
        : undefined,
      newValue: {
        actualValue: record.actualValue,
        achievementRate: record.achievementRate,
        activities: record.activities,
        obstacles: record.obstacles,
        efforts: record.efforts,
        evidenceComment: record.evidenceComment,
        attachments: getMonthlyAttachmentAuditSummary(record.attachments),
        isDraft: record.isDraft,
        workflowStatus: record.isDraft ? 'DRAFT' : 'SUBMITTED',
      },
      ...getClientInfo(request),
    })

    if (!data.isDraft) {
      await createAuditLog({
        userId: session.user.id,
        action: 'MONTHLY_RECORD_SUBMITTED',
        entityType: 'MonthlyRecord',
        entityId: record.id,
        oldValue: {
          workflowStatus: existing?.isDraft === false ? 'SUBMITTED' : 'DRAFT',
        },
        newValue: {
          workflowStatus: 'SUBMITTED',
        },
        ...getClientInfo(request),
      })
    }

    return successResponse(record)
  } catch (error) {
    return errorResponse(error)
  }
}
