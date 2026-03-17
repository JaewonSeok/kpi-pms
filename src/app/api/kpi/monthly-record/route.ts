import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { errorResponse, successResponse, AppError, calcAchievementRate } from '@/lib/utils'
import { MonthlyRecordSchema } from '@/lib/validations'

// GET /api/kpi/monthly-record
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '인증이 필요합니다.')

    const { searchParams } = new URL(request.url)
    const empId = searchParams.get('empId') || session.user.id
    const year = searchParams.get('year')

    // 본인 또는 상위자만 조회 가능
    if (empId !== session.user.id) {
      const allowedRoles = ['ROLE_TEAM_LEADER', 'ROLE_SECTION_CHIEF', 'ROLE_DIV_HEAD', 'ROLE_CEO', 'ROLE_ADMIN']
      if (!allowedRoles.includes(session.user.role)) {
        throw new AppError(403, 'FORBIDDEN', '권한이 없습니다.')
      }
    }

    const records = await prisma.monthlyRecord.findMany({
      where: {
        employeeId: empId,
        ...(year
          ? { yearMonth: { startsWith: year } }
          : {}),
      },
      include: {
        personalKpi: {
          select: { kpiName: true, kpiType: true, targetValue: true, unit: true, weight: true },
        },
      },
      orderBy: [{ yearMonth: 'asc' }, { createdAt: 'asc' }],
    })

    return successResponse(records)
  } catch (error) {
    return errorResponse(error)
  }
}

// POST /api/kpi/monthly-record
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '인증이 필요합니다.')

    const body = await request.json()
    const validated = MonthlyRecordSchema.safeParse(body)
    if (!validated.success) {
      throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0].message)
    }

    const data = validated.data

    // KPI 소유자 확인
    const kpi = await prisma.personalKpi.findUnique({
      where: { id: data.personalKpiId },
    })
    if (!kpi) throw new AppError(404, 'KPI_NOT_FOUND', 'KPI를 찾을 수 없습니다.')
    if (kpi.employeeId !== session.user.id) {
      throw new AppError(403, 'FORBIDDEN', '본인의 KPI만 입력할 수 있습니다.')
    }

    // 달성률 자동 계산 (계량 KPI)
    let achievementRate: number | undefined
    if (kpi.kpiType === 'QUANTITATIVE' && data.actualValue !== undefined && kpi.targetValue) {
      achievementRate = calcAchievementRate(data.actualValue, kpi.targetValue)
    }

    // Upsert (이미 입력된 연월이면 업데이트)
    const record = await prisma.monthlyRecord.upsert({
      where: {
        personalKpiId_yearMonth: {
          personalKpiId: data.personalKpiId,
          yearMonth: data.yearMonth,
        },
      },
      create: {
        personalKpiId: data.personalKpiId,
        employeeId: session.user.id,
        yearMonth: data.yearMonth,
        actualValue: data.actualValue,
        achievementRate,
        activities: data.activities,
        obstacles: data.obstacles,
        efforts: data.efforts,
        isDraft: data.isDraft,
        submittedAt: data.isDraft ? null : new Date(),
      },
      update: {
        actualValue: data.actualValue,
        achievementRate,
        activities: data.activities,
        obstacles: data.obstacles,
        efforts: data.efforts,
        isDraft: data.isDraft,
        submittedAt: data.isDraft ? undefined : new Date(),
      },
    })

    return successResponse(record)
  } catch (error) {
    return errorResponse(error)
  }
}
