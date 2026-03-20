import type { Prisma } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AppError, errorResponse, successResponse } from '@/lib/utils'
import { DevelopmentPlanCreateSchema } from '@/lib/validations'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')

    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employeeId') || session.user.id

    if (employeeId !== session.user.id && session.user.role === 'ROLE_MEMBER') {
      throw new AppError(403, 'FORBIDDEN', '다른 구성원의 개발 계획을 볼 권한이 없습니다.')
    }

    const plans = await prisma.developmentPlan.findMany({
      where: { employeeId },
      orderBy: [{ updatedAt: 'desc' }],
      take: 10,
    })

    return successResponse({ plans })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')

    const body = await request.json()
    const validated = DevelopmentPlanCreateSchema.safeParse(body)
    if (!validated.success) {
      throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0]?.message || '개발 계획 입력값을 확인해 주세요.')
    }

    if (validated.data.employeeId !== session.user.id && session.user.role === 'ROLE_MEMBER') {
      throw new AppError(403, 'FORBIDDEN', '다른 구성원의 개발 계획을 생성할 권한이 없습니다.')
    }

    const plan = await prisma.developmentPlan.create({
      data: {
        employeeId: validated.data.employeeId,
        createdById: session.user.id,
        sourceType: validated.data.sourceType,
        sourceId: validated.data.sourceId,
        title: validated.data.title,
        focusArea: validated.data.focusArea,
        actions: validated.data.actions as Prisma.InputJsonValue,
        managerSupport: (validated.data.managerSupport ?? []) as Prisma.InputJsonValue,
        nextCheckinTopics: (validated.data.nextCheckinTopics ?? []) as Prisma.InputJsonValue,
        note: validated.data.note,
        dueDate: validated.data.dueDate ? new Date(validated.data.dueDate) : undefined,
      },
    })

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        entityType: 'DevelopmentPlan',
        entityId: plan.id,
        action: 'DEVELOPMENT_PLAN_CREATED',
        newValue: {
          employeeId: validated.data.employeeId,
          sourceType: validated.data.sourceType,
          sourceId: validated.data.sourceId,
          title: validated.data.title,
        } as Prisma.InputJsonValue,
      },
    })

    return successResponse({
      message: '개발 계획을 저장했습니다.',
      plan,
    })
  } catch (error) {
    return errorResponse(error)
  }
}
