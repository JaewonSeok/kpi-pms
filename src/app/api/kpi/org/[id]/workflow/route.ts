import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAuditLog, getClientInfo } from '@/lib/audit'
import { AppError, errorResponse, successResponse } from '@/lib/utils'
import { OrgKpiWorkflowActionSchema } from '@/lib/validations'
import {
  canLockOrgKpi,
  canReopenOrgKpi,
  canSubmitOrgKpi,
  resolveOrgKpiOperationalStatus,
} from '@/server/org-kpi-workflow'

type RouteContext = {
  params: Promise<{ id: string }>
}

function canManage(role: string) {
  return ['ROLE_ADMIN', 'ROLE_CEO', 'ROLE_DIV_HEAD', 'ROLE_SECTION_CHIEF', 'ROLE_TEAM_LEADER'].includes(role)
}

async function isGoalEditLocked(deptId: string, evalYear: number) {
  const department = await prisma.department.findUnique({
    where: { id: deptId },
    select: { orgId: true },
  })

  if (!department) {
    return false
  }

  const targetCycle = await prisma.evalCycle.findFirst({
    where: {
      orgId: department.orgId,
      evalYear,
    },
    orderBy: { createdAt: 'desc' },
    select: { goalEditMode: true },
  })

  return targetCycle?.goalEditMode === 'CHECKIN_ONLY'
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      throw new AppError(401, 'UNAUTHORIZED', '인증이 필요합니다.')
    }

    if (!canManage(session.user.role)) {
      throw new AppError(403, 'FORBIDDEN', '조직 KPI 워크플로를 변경할 권한이 없습니다.')
    }

    const { id } = await context.params
    const body = await request.json()
    const validated = OrgKpiWorkflowActionSchema.safeParse(body)
    if (!validated.success) {
      throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0]?.message || '잘못된 요청입니다.')
    }

    const kpi = await prisma.orgKpi.findUnique({
      where: { id },
      include: {
        personalKpis: {
          select: {
            status: true,
          },
        },
      },
    })

    if (!kpi) {
      throw new AppError(404, 'ORG_KPI_NOT_FOUND', '조직 KPI를 찾을 수 없습니다.')
    }

    const isInScope =
      session.user.role === 'ROLE_ADMIN' ||
      session.user.role === 'ROLE_CEO' ||
      session.user.accessibleDepartmentIds.includes(kpi.deptId) ||
      session.user.deptId === kpi.deptId

    if (!isInScope) {
      throw new AppError(403, 'FORBIDDEN', '권한 범위를 벗어난 조직 KPI입니다.')
    }

    const goalEditLocked = await isGoalEditLocked(kpi.deptId, kpi.evalYear)
    if (goalEditLocked && ['SUBMIT', 'REOPEN'].includes(validated.data.action)) {
      throw new AppError(
        400,
        'GOAL_EDIT_LOCKED',
        '현재 주기는 목표 읽기 전용 모드입니다. 승인 요청 대신 체크인과 코멘트만 이어갈 수 있습니다.'
      )
    }

    const logs = await prisma.auditLog.findMany({
      where: {
        entityType: 'OrgKpi',
        entityId: id,
      },
      orderBy: {
        timestamp: 'desc',
      },
      take: 30,
    })

    const operationalStatus = resolveOrgKpiOperationalStatus({
      status: kpi.status,
      logs,
    })

    const clientInfo = getClientInfo(request)

    if (validated.data.action === 'SUBMIT') {
      if (!canSubmitOrgKpi(operationalStatus)) {
        throw new AppError(409, 'ORG_KPI_NOT_DRAFT', '초안 상태 KPI만 제출할 수 있습니다.')
      }

      await createAuditLog({
        userId: session.user.id,
        action: 'ORG_KPI_SUBMITTED',
        entityType: 'OrgKpi',
        entityId: id,
        oldValue: {
          workflowStatus: operationalStatus,
        },
        newValue: {
          workflowStatus: 'SUBMITTED',
          note: validated.data.note,
        },
        ...clientInfo,
      })

      return successResponse({
        id,
        workflowStatus: 'SUBMITTED',
      })
    }

    if (validated.data.action === 'LOCK') {
      if (!['ROLE_ADMIN', 'ROLE_CEO'].includes(session.user.role)) {
        throw new AppError(403, 'FORBIDDEN', '잠금은 관리자 또는 CEO만 수행할 수 있습니다.')
      }

      if (!canLockOrgKpi(operationalStatus)) {
        throw new AppError(409, 'ORG_KPI_NOT_CONFIRMABLE', '확정 상태 KPI만 잠글 수 있습니다.')
      }

      await createAuditLog({
        userId: session.user.id,
        action: 'ORG_KPI_LOCKED',
        entityType: 'OrgKpi',
        entityId: id,
        oldValue: {
          workflowStatus: operationalStatus,
        },
        newValue: {
          workflowStatus: 'LOCKED',
          note: validated.data.note,
        },
        ...clientInfo,
      })

      return successResponse({
        id,
        workflowStatus: 'LOCKED',
      })
    }

    if (!canReopenOrgKpi(operationalStatus)) {
      throw new AppError(409, 'ORG_KPI_NOT_REOPENABLE', '현재 상태에서는 재오픈할 수 없습니다.')
    }

    if (operationalStatus === 'LOCKED' && !['ROLE_ADMIN', 'ROLE_CEO'].includes(session.user.role)) {
      throw new AppError(403, 'FORBIDDEN', '잠금된 KPI 재오픈은 관리자 또는 CEO만 수행할 수 있습니다.')
    }

    await createAuditLog({
      userId: session.user.id,
      action: 'ORG_KPI_REOPENED',
      entityType: 'OrgKpi',
      entityId: id,
      oldValue: {
        workflowStatus: operationalStatus,
      },
      newValue: {
        workflowStatus: kpi.status === 'CONFIRMED' ? 'CONFIRMED' : 'DRAFT',
        note: validated.data.note,
      },
      ...clientInfo,
    })

    return successResponse({
      id,
      workflowStatus: kpi.status === 'CONFIRMED' ? 'CONFIRMED' : 'DRAFT',
    })
  } catch (error) {
    return errorResponse(error)
  }
}
