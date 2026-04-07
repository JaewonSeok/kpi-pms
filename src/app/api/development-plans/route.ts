import type { Prisma } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import {
  calculateDevelopmentPlanProgress,
  normalizeDevelopmentPlanActionItems,
  normalizeDevelopmentPlanLinkedEvidence,
  normalizeDevelopmentPlanStringArray,
} from '@/lib/development-plan'
import { prisma } from '@/lib/prisma'
import { AppError, errorResponse, successResponse } from '@/lib/utils'
import { DevelopmentPlanCreateSchema, DevelopmentPlanUpdateSchema } from '@/lib/validations'

type DevelopmentPlanSession = {
  user: {
    id: string
    role: string
  }
}

function canManageEmployeePlan(session: DevelopmentPlanSession, employeeId: string) {
  if (session.user.id === employeeId) return true
  return session.user.role !== 'ROLE_MEMBER'
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')

    const actor = session as DevelopmentPlanSession
    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employeeId') || actor.user.id

    if (!canManageEmployeePlan(actor, employeeId)) {
      throw new AppError(403, 'FORBIDDEN', '다른 구성원의 성장 계획을 조회할 권한이 없습니다.')
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

    const actor = session as DevelopmentPlanSession
    const body = await request.json()
    const validated = DevelopmentPlanCreateSchema.safeParse(body)
    if (!validated.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        validated.error.issues[0]?.message || '성장 계획 입력값을 확인해 주세요.'
      )
    }

    if (!canManageEmployeePlan(actor, validated.data.employeeId)) {
      throw new AppError(403, 'FORBIDDEN', '다른 구성원의 성장 계획을 생성할 권한이 없습니다.')
    }

    const actions = normalizeDevelopmentPlanActionItems(validated.data.actions)
    const recommendedCompetencies = normalizeDevelopmentPlanStringArray(validated.data.recommendedCompetencies)
    const managerSupport = normalizeDevelopmentPlanStringArray(validated.data.managerSupport)
    const nextCheckinTopics = normalizeDevelopmentPlanStringArray(validated.data.nextCheckinTopics)
    const linkedEvidence = normalizeDevelopmentPlanLinkedEvidence(validated.data.linkedEvidence)

    const plan = await prisma.developmentPlan.create({
      data: {
        employeeId: validated.data.employeeId,
        createdById: actor.user.id,
        sourceType: validated.data.sourceType,
        sourceId: validated.data.sourceId,
        title: validated.data.title,
        focusArea: validated.data.focusArea,
        actions: actions as Prisma.InputJsonValue,
        recommendedCompetencies: recommendedCompetencies as Prisma.InputJsonValue,
        managerSupport: managerSupport as Prisma.InputJsonValue,
        nextCheckinTopics: nextCheckinTopics as Prisma.InputJsonValue,
        linkedEvidence: linkedEvidence as Prisma.InputJsonValue,
        note: validated.data.note,
        dueDate: validated.data.dueDate ? new Date(validated.data.dueDate) : undefined,
      },
    })

    await prisma.auditLog.create({
      data: {
        userId: actor.user.id,
        entityType: 'DevelopmentPlan',
        entityId: plan.id,
        action: 'DEVELOPMENT_PLAN_CREATED',
        newValue: {
          employeeId: validated.data.employeeId,
          sourceType: validated.data.sourceType,
          sourceId: validated.data.sourceId,
          title: validated.data.title,
          focusArea: validated.data.focusArea,
          actions,
          recommendedCompetencies,
          managerSupport,
          nextCheckinTopics,
          linkedEvidence,
        } as Prisma.InputJsonValue,
      },
    })

    return successResponse({
      message: '성장 계획을 저장했습니다.',
      plan,
    })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')

    const actor = session as DevelopmentPlanSession
    const body = await request.json()
    const validated = DevelopmentPlanUpdateSchema.safeParse(body)
    if (!validated.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        validated.error.issues[0]?.message || '성장 계획 수정값을 확인해 주세요.'
      )
    }

    const plan = await prisma.developmentPlan.findUnique({
      where: { id: validated.data.id },
    })

    if (!plan) {
      throw new AppError(404, 'NOT_FOUND', '수정할 성장 계획을 찾을 수 없습니다.')
    }

    if (!canManageEmployeePlan(actor, plan.employeeId)) {
      throw new AppError(403, 'FORBIDDEN', '해당 성장 계획을 수정할 권한이 없습니다.')
    }

    const oldValue = {
      title: plan.title,
      focusArea: plan.focusArea,
      actions: plan.actions,
      recommendedCompetencies: plan.recommendedCompetencies,
      managerSupport: plan.managerSupport,
      nextCheckinTopics: plan.nextCheckinTopics,
      linkedEvidence: plan.linkedEvidence,
      note: plan.note,
      dueDate: plan.dueDate?.toISOString() ?? null,
      status: plan.status,
    }

    const updateData: Prisma.DevelopmentPlanUpdateInput = {}

    if (validated.data.title !== undefined) updateData.title = validated.data.title
    if (validated.data.focusArea !== undefined) updateData.focusArea = validated.data.focusArea
    if (validated.data.actions !== undefined) {
      updateData.actions = normalizeDevelopmentPlanActionItems(validated.data.actions) as Prisma.InputJsonValue
    }
    if (validated.data.recommendedCompetencies !== undefined) {
      updateData.recommendedCompetencies = normalizeDevelopmentPlanStringArray(
        validated.data.recommendedCompetencies
      ) as Prisma.InputJsonValue
    }
    if (validated.data.managerSupport !== undefined) {
      updateData.managerSupport = normalizeDevelopmentPlanStringArray(validated.data.managerSupport) as Prisma.InputJsonValue
    }
    if (validated.data.nextCheckinTopics !== undefined) {
      updateData.nextCheckinTopics = normalizeDevelopmentPlanStringArray(
        validated.data.nextCheckinTopics
      ) as Prisma.InputJsonValue
    }
    if (validated.data.linkedEvidence !== undefined) {
      updateData.linkedEvidence = normalizeDevelopmentPlanLinkedEvidence(
        validated.data.linkedEvidence
      ) as Prisma.InputJsonValue
    }
    if (validated.data.note !== undefined) updateData.note = validated.data.note
    if (validated.data.dueDate !== undefined) {
      updateData.dueDate = validated.data.dueDate ? new Date(validated.data.dueDate) : null
    }
    if (validated.data.status !== undefined) updateData.status = validated.data.status

    const updatedPlan = await prisma.developmentPlan.update({
      where: { id: plan.id },
      data: updateData,
    })

    const nextActions =
      validated.data.actions !== undefined
        ? normalizeDevelopmentPlanActionItems(validated.data.actions)
        : normalizeDevelopmentPlanActionItems(plan.actions)

    await prisma.auditLog.create({
      data: {
        userId: actor.user.id,
        entityType: 'DevelopmentPlan',
        entityId: updatedPlan.id,
        action: 'DEVELOPMENT_PLAN_UPDATED',
        oldValue: oldValue as Prisma.InputJsonValue,
        newValue: {
          title: updatedPlan.title,
          focusArea: updatedPlan.focusArea,
          actions: nextActions,
          recommendedCompetencies: normalizeDevelopmentPlanStringArray(updatedPlan.recommendedCompetencies),
          managerSupport: normalizeDevelopmentPlanStringArray(updatedPlan.managerSupport),
          nextCheckinTopics: normalizeDevelopmentPlanStringArray(updatedPlan.nextCheckinTopics),
          linkedEvidence: normalizeDevelopmentPlanLinkedEvidence(updatedPlan.linkedEvidence),
          note: updatedPlan.note,
          dueDate: updatedPlan.dueDate?.toISOString() ?? null,
          status: updatedPlan.status,
          progressRate: calculateDevelopmentPlanProgress(nextActions).progressRate,
        } as Prisma.InputJsonValue,
      },
    })

    return successResponse({
      message: '성장 계획을 업데이트했습니다.',
      plan: updatedPlan,
    })
  } catch (error) {
    return errorResponse(error)
  }
}
