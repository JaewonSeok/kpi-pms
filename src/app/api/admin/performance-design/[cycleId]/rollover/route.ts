import type { Prisma } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createAuditLog, getClientInfo } from '@/lib/audit'
import {
  buildIndicatorDesignKey,
  parsePerformanceDesignConfig,
  type PerformanceIndicatorDesign,
} from '@/lib/performance-design'
import { prisma } from '@/lib/prisma'
import { errorResponse, successResponse, AppError } from '@/lib/utils'
import { PerformanceDesignRolloverSchema } from '@/lib/validations'

type RouteContext = {
  params: Promise<{ cycleId: string }>
}

function cloneIndicatorForNextCycle(
  indicator: PerformanceIndicatorDesign,
  currentCycleId: string,
  historyItem: PerformanceIndicatorDesign['rolloverHistory'][number]
): PerformanceIndicatorDesign | null {
  if (indicator.lifecycleAction === 'DELETE') return null

  return {
    ...indicator,
    key:
      indicator.source === 'MANUAL'
        ? buildIndicatorDesignKey('MANUAL', undefined, `${indicator.name}-${historyItem.targetCycleId ?? 'next'}`)
        : indicator.key,
    carriedFromCycleId: currentCycleId,
    selectionStatus: indicator.lifecycleAction,
    rolloverHistory: [historyItem],
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    if (session.user.role !== 'ROLE_ADMIN') {
      throw new AppError(403, 'FORBIDDEN', '관리자 권한이 필요합니다.')
    }

    const { cycleId } = await context.params
    const body = await request.json()
    const validated = PerformanceDesignRolloverSchema.safeParse(body)
    if (!validated.success) {
      throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0].message)
    }

    const currentCycle = await prisma.evalCycle.findUnique({
      where: { id: cycleId },
      select: {
        id: true,
        orgId: true,
        evalYear: true,
        cycleName: true,
        performanceDesignConfig: true,
      },
    })

    if (!currentCycle) {
      throw new AppError(404, 'EVAL_CYCLE_NOT_FOUND', '평가 사이클을 찾을 수 없습니다.')
    }

    const nextCycle = await prisma.evalCycle.findFirst({
      where: {
        orgId: currentCycle.orgId,
        evalYear: currentCycle.evalYear + 1,
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        cycleName: true,
        performanceDesignConfig: true,
      },
    })

    if (!nextCycle) {
      throw new AppError(400, 'NEXT_CYCLE_NOT_FOUND', '다음 연도 평가 사이클이 없어 환류를 반영할 수 없습니다.')
    }

    const now = new Date().toISOString()
    const currentConfig = parsePerformanceDesignConfig(currentCycle.performanceDesignConfig)
    const nextConfig = parsePerformanceDesignConfig(nextCycle.performanceDesignConfig)
    const selectedKeys = new Set(validated.data.indicatorKeys)

    const nextIndicators = [...nextConfig.indicatorDesigns]
    const updatedCurrentIndicators = currentConfig.indicatorDesigns.map((indicator) => {
      if (!selectedKeys.has(indicator.key)) return indicator

      const historyItem = {
        id: `rollover-${indicator.key}-${Date.now()}`,
        action: indicator.lifecycleAction,
        comment:
          indicator.managerComment || indicator.departmentComment || `${indicator.lifecycleAction} 상태로 환류`,
        decidedBy: session.user.name,
        decidedAt: now,
        targetCycleId: nextCycle.id,
        targetCycleName: nextCycle.cycleName,
      }

      const cloned = cloneIndicatorForNextCycle(indicator, currentCycle.id, historyItem)
      if (cloned) {
        const existingIndex = nextIndicators.findIndex((item) => item.key === cloned.key)
        if (existingIndex >= 0) nextIndicators[existingIndex] = cloned
        else nextIndicators.push(cloned)
      }

      return {
        ...indicator,
        rolloverHistory: [...indicator.rolloverHistory, historyItem],
      }
    })

    const updatedCurrentConfig = {
      ...currentConfig,
      indicatorDesigns: updatedCurrentIndicators,
    }
    const updatedNextConfig = {
      ...nextConfig,
      indicatorDesigns: nextIndicators,
    }

    await prisma.$transaction([
      prisma.evalCycle.update({
        where: { id: currentCycle.id },
        data: {
          performanceDesignConfig: updatedCurrentConfig as Prisma.InputJsonValue,
        },
      }),
      prisma.evalCycle.update({
        where: { id: nextCycle.id },
        data: {
          performanceDesignConfig: updatedNextConfig as Prisma.InputJsonValue,
        },
      }),
    ])

    const clientInfo = getClientInfo(request)
    await createAuditLog({
      userId: session.user.id,
      action: 'PERFORMANCE_INDICATOR_ROLLOVER',
      entityType: 'EvalCycle',
      entityId: currentCycle.id,
      oldValue: { indicatorKeys: validated.data.indicatorKeys },
      newValue: { nextCycleId: nextCycle.id, nextCycleName: nextCycle.cycleName },
      ipAddress: clientInfo.ipAddress,
      userAgent: clientInfo.userAgent,
    })

    return successResponse({
      cycleId: currentCycle.id,
      nextCycleId: nextCycle.id,
      rolledIndicatorCount: validated.data.indicatorKeys.length,
    })
  } catch (error) {
    return errorResponse(error)
  }
}

