import type { Prisma } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createAuditLog, getClientInfo } from '@/lib/audit'
import { prisma } from '@/lib/prisma'
import { errorResponse, successResponse, AppError } from '@/lib/utils'
import { UpdatePerformanceDesignSchema } from '@/lib/validations'

type RouteContext = {
  params: Promise<{ cycleId: string }>
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    if (session.user.role !== 'ROLE_ADMIN') {
      throw new AppError(403, 'FORBIDDEN', '관리자 권한이 필요합니다.')
    }

    const { cycleId } = await context.params
    const body = await request.json()
    const validated = UpdatePerformanceDesignSchema.safeParse(body)
    if (!validated.success) {
      throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0].message)
    }

    const existing = await prisma.evalCycle.findUnique({
      where: { id: cycleId },
      select: {
        id: true,
        cycleName: true,
        performanceDesignConfig: true,
      },
    })

    if (!existing) {
      throw new AppError(404, 'EVAL_CYCLE_NOT_FOUND', '평가 사이클을 찾을 수 없습니다.')
    }

    const updated = await prisma.evalCycle.update({
      where: { id: cycleId },
      data: {
        performanceDesignConfig: validated.data.config as Prisma.InputJsonValue,
      },
      select: {
        id: true,
        cycleName: true,
        performanceDesignConfig: true,
      },
    })

    const clientInfo = getClientInfo(request)
    await createAuditLog({
      userId: session.user.id,
      action: 'PERFORMANCE_DESIGN_UPDATED',
      entityType: 'EvalCycle',
      entityId: cycleId,
      oldValue: (existing.performanceDesignConfig as object | undefined) ?? undefined,
      newValue: validated.data.config as unknown as object,
      ipAddress: clientInfo.ipAddress,
      userAgent: clientInfo.userAgent,
    })

    return successResponse(updated)
  } catch (error) {
    return errorResponse(error)
  }
}

