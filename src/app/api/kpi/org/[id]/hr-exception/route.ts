import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createAuditLog, getClientInfo } from '@/lib/audit'
import { prisma } from '@/lib/prisma'
import { resolveOrgKpiScopeFromDepartmentId } from '@/lib/org-kpi-scope'
import { AppError, errorResponse, successResponse } from '@/lib/utils'
import { OrgKpiHrExceptionSchema } from '@/lib/validations'
import {
  buildOrgKpiHrExceptionUpdate2026,
  canManageOrgKpiHrException,
} from '@/server/org-kpi-hr-exception'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      throw new AppError(401, 'UNAUTHORIZED', '인증이 필요합니다.')
    }
    if (!canManageOrgKpiHrException(session.user.role)) {
      throw new AppError(403, 'FORBIDDEN', '팀 KPI 예외 승인은 HR/admin 권한에서만 가능합니다.')
    }

    const body = await request.json()
    const validated = OrgKpiHrExceptionSchema.safeParse(body)
    if (!validated.success) {
      throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0]?.message || '잘못된 요청입니다.', {
        fieldErrors: Object.fromEntries(
          Object.entries(validated.error.flatten().fieldErrors).flatMap(([field, messages]) =>
            Array.isArray(messages) && messages[0] ? [[field, messages[0]]] : []
          )
        ),
      })
    }

    const { id } = await context.params
    const departments = await prisma.department.findMany({
      select: {
        id: true,
        deptName: true,
        parentDeptId: true,
      },
    })

    const current = await prisma.orgKpi.findUnique({
      where: { id },
      select: {
        id: true,
        deptId: true,
        kpiName: true,
        mboExceptionApproved: true,
        mboExceptionReason: true,
        mboExceptionApprovedById: true,
        mboExceptionApprovedAt: true,
      },
    })

    if (!current) {
      throw new AppError(404, 'ORG_KPI_NOT_FOUND', '조직 KPI를 찾을 수 없습니다.')
    }

    const scope = resolveOrgKpiScopeFromDepartmentId(current.deptId, departments)
    const updatePlan = buildOrgKpiHrExceptionUpdate2026({
      current: {
        id: current.id,
        kpiName: current.kpiName,
        scope,
        mboExceptionApproved: current.mboExceptionApproved,
        mboExceptionReason: current.mboExceptionReason,
        mboExceptionApprovedById: current.mboExceptionApprovedById,
        mboExceptionApprovedAt: current.mboExceptionApprovedAt,
      },
      actor: {
        id: session.user.id,
        role: session.user.role,
      },
      input: validated.data,
    })

    const updated = await prisma.orgKpi.update({
      where: { id },
      data: updatePlan.data,
      select: {
        id: true,
        mboExceptionApproved: true,
        mboExceptionReason: true,
        mboExceptionApprovedById: true,
        mboExceptionApprovedAt: true,
      },
    })

    await createAuditLog({
      userId: session.user.id,
      action: validated.data.exceptionApproved
        ? 'ORG_KPI_MBO_EXCEPTION_APPROVED'
        : 'ORG_KPI_MBO_EXCEPTION_REVOKED',
      entityType: 'OrgKpi',
      entityId: id,
      oldValue: updatePlan.oldValue,
      newValue: updatePlan.newValue,
      ...getClientInfo(request),
    })

    return successResponse({
      id: updated.id,
      hrException: {
        approved: updated.mboExceptionApproved,
        reason: updated.mboExceptionReason,
        approvedById: updated.mboExceptionApprovedById,
        approvedAt: updated.mboExceptionApprovedAt?.toISOString() ?? null,
      },
    })
  } catch (error) {
    return errorResponse(error)
  }
}
