import { getServerSession, type Session } from 'next-auth'
import type { Prisma } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AppError, errorResponse, successResponse } from '@/lib/utils'
import { BulkOrgKpiEditSchema } from '@/lib/validations'
import { getClientInfo } from '@/lib/audit'
import {
  canEditOrgKpiByOperationalStatus,
  resolveOrgKpiOperationalStatus,
} from '@/server/org-kpi-workflow'
import { validateOrgParentLink } from '@/server/goal-alignment'

function canManage(role: string) {
  return ['ROLE_ADMIN', 'ROLE_CEO', 'ROLE_DIV_HEAD', 'ROLE_SECTION_CHIEF', 'ROLE_TEAM_LEADER'].includes(role)
}

function getScopeDepartmentIds(session: Session | null) {
  if (!session) return []
  if (session.user.role === 'ROLE_ADMIN' || session.user.role === 'ROLE_CEO') {
    return null
  }
  if (session.user.role === 'ROLE_MEMBER') {
    return [session.user.deptId]
  }
  return session.user.accessibleDepartmentIds.length
    ? session.user.accessibleDepartmentIds
    : [session.user.deptId]
}

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    if (!canManage(session.user.role)) {
      throw new AppError(403, 'FORBIDDEN', '목표 일괄 수정 권한이 없습니다.')
    }

    const body = await request.json()
    const validated = BulkOrgKpiEditSchema.safeParse(body)
    if (!validated.success) {
      throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0].message)
    }

    const data = validated.data
    const scopeDepartmentIds = getScopeDepartmentIds(session)

    if (data.deptId && scopeDepartmentIds && !scopeDepartmentIds.includes(data.deptId)) {
      throw new AppError(403, 'FORBIDDEN', '변경 대상 조직 범위에 접근할 수 없습니다.')
    }

    const selected = await prisma.orgKpi.findMany({
      where: {
        id: { in: data.ids },
      },
      select: {
        id: true,
        deptId: true,
        evalYear: true,
        weight: true,
        status: true,
        kpiCategory: true,
        parentOrgKpiId: true,
        tags: true,
      },
    })

    if (selected.length !== data.ids.length) {
      throw new AppError(404, 'ORG_KPI_NOT_FOUND', '일괄 수정 대상 KPI 일부를 찾을 수 없습니다.')
    }

    for (const item of selected) {
      if (scopeDepartmentIds && !scopeDepartmentIds.includes(item.deptId)) {
        throw new AppError(403, 'FORBIDDEN', '권한 범위를 벗어난 조직 KPI가 포함되어 있습니다.')
      }
    }

    const auditLogs = await prisma.auditLog.findMany({
      where: {
        entityType: 'OrgKpi',
        entityId: { in: data.ids },
      },
      orderBy: { timestamp: 'desc' },
      take: data.ids.length * 10,
    })
    const logsById = new Map<string, typeof auditLogs>()
    auditLogs.forEach((log) => {
      if (!log.entityId) return
      const current = logsById.get(log.entityId) ?? []
      current.push(log)
      logsById.set(log.entityId, current)
    })

    for (const item of selected) {
      const status = resolveOrgKpiOperationalStatus({
        status: item.status,
        logs: logsById.get(item.id) ?? [],
      })

      if (!canEditOrgKpiByOperationalStatus(status)) {
        throw new AppError(400, 'ORG_KPI_LOCKED', '초안 상태 조직 KPI만 일괄 수정할 수 있습니다.')
      }
    }

    const groupedByYear = new Map<string, number>()
    if (data.deptId) {
      selected.forEach((item) => {
        const key = `${data.deptId}:${item.evalYear}`
        groupedByYear.set(key, (groupedByYear.get(key) ?? 0) + item.weight)
      })

      for (const [key, selectedWeight] of groupedByYear.entries()) {
        const [deptId, evalYearText] = key.split(':')
        const evalYear = Number(evalYearText)
        const cycleDepartment = await prisma.department.findUnique({
          where: { id: deptId },
          select: { orgId: true },
        })
        const cycle = cycleDepartment
          ? await prisma.evalCycle.findFirst({
              where: { orgId: cycleDepartment.orgId, evalYear },
              orderBy: { createdAt: 'desc' },
              select: { goalEditMode: true },
            })
          : null

        if (cycle?.goalEditMode === 'CHECKIN_ONLY') {
          throw new AppError(
            400,
            'GOAL_EDIT_LOCKED',
            '현재 주기는 체크인·코멘트 전용 모드라 목표 일괄 수정을 진행할 수 없습니다.'
          )
        }

        const existing = await prisma.orgKpi.findMany({
          where: {
            deptId,
            evalYear,
            id: { notIn: data.ids },
          },
          select: { weight: true },
        })

        const totalWeight =
          existing.reduce((sum, item) => sum + item.weight, 0) + selectedWeight
        if (totalWeight > 100) {
          throw new AppError(
            400,
            'WEIGHT_EXCEEDED',
            `${evalYear}년 조직 가중치 합계가 100%를 초과합니다.`
          )
        }
      }
    }

    const clientInfo = getClientInfo(request)
    const updatedIds = await prisma.$transaction(async (tx) => {
      const nextIds: string[] = []

      for (const item of selected) {
        const targetDeptId = data.deptId ?? item.deptId
        const parentOrgKpiId =
          data.parentOrgKpiId !== undefined || data.deptId !== undefined
            ? await validateOrgParentLink({
                goalId: item.id,
                parentOrgKpiId:
                  data.parentOrgKpiId !== undefined ? data.parentOrgKpiId : item.parentOrgKpiId,
                targetDeptId,
                targetEvalYear: item.evalYear,
                editableDepartmentIds: scopeDepartmentIds,
              })
            : item.parentOrgKpiId

        const updated = await tx.orgKpi.update({
          where: { id: item.id },
          data: {
            ...(data.deptId !== undefined ? { deptId: data.deptId } : {}),
            ...(data.kpiCategory !== undefined ? { kpiCategory: data.kpiCategory } : {}),
            ...(data.parentOrgKpiId !== undefined || data.deptId !== undefined
              ? { parentOrgKpiId }
              : {}),
            ...(data.tags !== undefined ? { tags: data.tags } : {}),
          },
        })

        await tx.auditLog.create({
          data: {
            userId: session.user.id,
            action: 'ORG_KPI_BULK_UPDATED',
            entityType: 'OrgKpi',
            entityId: item.id,
            oldValue: {
              deptId: item.deptId,
              kpiCategory: item.kpiCategory,
              parentOrgKpiId: item.parentOrgKpiId,
              tags: item.tags,
            } as PrismaJson,
            newValue: {
              deptId: updated.deptId,
              kpiCategory: updated.kpiCategory,
              parentOrgKpiId: updated.parentOrgKpiId,
              tags: updated.tags,
            } as PrismaJson,
            ipAddress: clientInfo.ipAddress,
            userAgent: clientInfo.userAgent,
          },
        })

        nextIds.push(updated.id)
      }

      return nextIds
    })

    return successResponse({
      updatedCount: updatedIds.length,
      updatedIds,
    })
  } catch (error) {
    return errorResponse(error, '조직 KPI 일괄 수정 중 오류가 발생했습니다.')
  }
}

type PrismaJson = Prisma.InputJsonObject
