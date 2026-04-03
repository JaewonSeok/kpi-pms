import { getServerSession } from 'next-auth'
import type { Prisma } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AppError, errorResponse, successResponse } from '@/lib/utils'
import { BulkPersonalKpiEditSchema } from '@/lib/validations'
import {
  canManagePersonalKpi,
  getPersonalKpiScopeDepartmentIds,
} from '@/lib/personal-kpi-access'
import { canAccessEmployee } from '@/server/auth/authorize'
import {
  canEditPersonalKpiByOperationalStatus,
  resolvePersonalKpiOperationalStatus,
} from '@/server/personal-kpi-workflow'
import { validatePersonalOrgLink } from '@/server/goal-alignment'
import { getClientInfo } from '@/lib/audit'

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')

    const body = await request.json()
    const validated = BulkPersonalKpiEditSchema.safeParse(body)
    if (!validated.success) {
      throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0].message)
    }

    const data = validated.data
    const scopeDepartmentIds = getPersonalKpiScopeDepartmentIds({
      role: session.user.role,
      deptId: session.user.deptId,
      accessibleDepartmentIds: session.user.accessibleDepartmentIds,
    })

    const selected = await prisma.personalKpi.findMany({
      where: {
        id: { in: data.ids },
      },
      include: {
        employee: {
          include: {
            department: true,
          },
        },
      },
    })

    if (selected.length !== data.ids.length) {
      throw new AppError(404, 'PERSONAL_KPI_NOT_FOUND', '일괄 수정 대상 KPI 일부를 찾을 수 없습니다.')
    }

    for (const item of selected) {
      const inScope =
        item.employeeId === session.user.id ||
        session.user.role === 'ROLE_ADMIN' ||
        session.user.role === 'ROLE_CEO' ||
        (scopeDepartmentIds?.includes(item.employee.deptId) ?? true)

      if (!inScope) {
        throw new AppError(403, 'FORBIDDEN', '권한 범위를 벗어난 KPI가 포함되어 있습니다.')
      }
    }

    const auditLogs = await prisma.auditLog.findMany({
      where: {
        entityType: 'PersonalKpi',
        entityId: { in: data.ids },
      },
      orderBy: {
        timestamp: 'desc',
      },
      take: data.ids.length * 12,
    })

    const logsById = new Map<string, typeof auditLogs>()
    auditLogs.forEach((log) => {
      if (!log.entityId) return
      const current = logsById.get(log.entityId) ?? []
      current.push(log)
      logsById.set(log.entityId, current)
    })

    for (const item of selected) {
      const status = resolvePersonalKpiOperationalStatus({
        status: item.status,
        logs: logsById.get(item.id) ?? [],
      })

      if (!canEditPersonalKpiByOperationalStatus(status)) {
        throw new AppError(400, 'PERSONAL_KPI_LOCKED', '초안 상태 KPI만 일괄 수정할 수 있습니다.')
      }
    }

    let targetEmployeeId: string | undefined
    let targetEmployeeDeptId: string | undefined

    if (data.employeeId !== undefined) {
      if (!canManagePersonalKpi(session.user.role)) {
        throw new AppError(403, 'FORBIDDEN', '담당자 일괄 변경은 리더 이상 권한이 필요합니다.')
      }

      const targetEmployee = await prisma.employee.findUnique({
        where: { id: data.employeeId },
        select: { id: true, deptId: true },
      })

      if (!targetEmployee || !canAccessEmployee(session, targetEmployee)) {
        throw new AppError(403, 'FORBIDDEN', '변경 대상 담당자에 접근할 수 없습니다.')
      }

      targetEmployeeId = targetEmployee.id
      targetEmployeeDeptId = targetEmployee.deptId
    }

    const targetYears = Array.from(new Set(selected.map((item) => item.evalYear)))
    const cycleOrgIdByYear = new Map<number, string | null>()

    if (targetEmployeeDeptId) {
      const targetDepartment = await prisma.department.findUnique({
        where: { id: targetEmployeeDeptId },
        select: { orgId: true },
      })

      for (const year of targetYears) {
        cycleOrgIdByYear.set(year, targetDepartment?.orgId ?? null)
      }
    }

    for (const year of targetYears) {
      const orgId =
        cycleOrgIdByYear.get(year) ??
        (await prisma.department.findUnique({
          where: { id: selected.find((item) => item.evalYear === year)?.employee.deptId ?? '' },
          select: { orgId: true },
        }))?.orgId ??
        null

      if (!orgId) continue

      const cycle = await prisma.evalCycle.findFirst({
        where: { orgId, evalYear: year },
        orderBy: { createdAt: 'desc' },
        select: { goalEditMode: true },
      })

      if (cycle?.goalEditMode === 'CHECKIN_ONLY') {
        throw new AppError(
          400,
          'GOAL_EDIT_LOCKED',
          '현재 주기는 체크인·코멘트 전용 모드라 목표 일괄 수정을 진행할 수 없습니다.'
        )
      }
    }

    if (targetEmployeeId) {
      const selectedWeightByYear = new Map<number, number>()
      selected.forEach((item) => {
        selectedWeightByYear.set(item.evalYear, (selectedWeightByYear.get(item.evalYear) ?? 0) + item.weight)
      })

      for (const [year, selectedWeight] of selectedWeightByYear.entries()) {
        const existing = await prisma.personalKpi.findMany({
          where: {
            employeeId: targetEmployeeId,
            evalYear: year,
            id: { notIn: data.ids },
            status: { not: 'ARCHIVED' },
          },
          select: { weight: true },
        })

        const totalWeight =
          existing.reduce((sum, item) => sum + item.weight, 0) + selectedWeight

        if (totalWeight > 100) {
          throw new AppError(
            400,
            'WEIGHT_EXCEEDED',
            `담당자 이동 후 ${year}년 가중치 합계가 100%를 초과합니다.`
          )
        }
      }
    }

    const clientInfo = getClientInfo(request)
    const updatedIds = await prisma.$transaction(async (tx) => {
      const nextIds: string[] = []

      for (const item of selected) {
        const nextEmployeeDeptId = targetEmployeeDeptId ?? item.employee.deptId
        const linkedOrgKpiId =
          data.linkedOrgKpiId !== undefined || targetEmployeeId !== undefined
            ? await validatePersonalOrgLink({
                linkedOrgKpiId:
                  data.linkedOrgKpiId !== undefined ? data.linkedOrgKpiId : item.linkedOrgKpiId,
                targetEvalYear: item.evalYear,
                targetEmployeeDeptId: nextEmployeeDeptId,
              })
            : item.linkedOrgKpiId

        const updated = await tx.personalKpi.update({
          where: { id: item.id },
          data: {
            ...(targetEmployeeId ? { employeeId: targetEmployeeId } : {}),
            ...(data.linkedOrgKpiId !== undefined || targetEmployeeId !== undefined
              ? { linkedOrgKpiId }
              : {}),
            ...(data.difficulty !== undefined ? { difficulty: data.difficulty } : {}),
            ...(data.tags !== undefined ? { tags: data.tags } : {}),
          },
        })

        await tx.auditLog.create({
          data: {
            userId: session.user.id,
            action: 'PERSONAL_KPI_BULK_UPDATED',
            entityType: 'PersonalKpi',
            entityId: item.id,
            oldValue: {
              employeeId: item.employeeId,
              linkedOrgKpiId: item.linkedOrgKpiId,
              difficulty: item.difficulty,
              tags: item.tags,
            } as PrismaJson,
            newValue: {
              employeeId: updated.employeeId,
              linkedOrgKpiId: updated.linkedOrgKpiId,
              difficulty: updated.difficulty,
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
    return errorResponse(error, '목표 일괄 수정 중 오류가 발생했습니다.')
  }
}

type PrismaJson = Prisma.InputJsonObject
