import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import {
  canReviewPersonalKpi,
  getPersonalKpiScopeDepartmentIds,
} from '@/lib/personal-kpi-access'
import { prisma } from '@/lib/prisma'
import { createAuditLog, getClientInfo } from '@/lib/audit'
import { AppError, errorResponse, successResponse } from '@/lib/utils'
import { PersonalKpiWorkflowActionSchema } from '@/lib/validations'
import {
  canApprovePersonalKpi,
  canLockPersonalKpi,
  canRejectPersonalKpi,
  canReopenPersonalKpi,
  canStartPersonalKpiReview,
  canSubmitPersonalKpi,
  resolvePersonalKpiOperationalStatus,
} from '@/server/personal-kpi-workflow'

type RouteContext = {
  params: Promise<{ id: string }>
}

async function isGoalEditLocked(employeeDeptId: string, evalYear: number) {
  const department = await prisma.department.findUnique({
    where: { id: employeeDeptId },
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
      throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    }

    const { id } = await context.params
    const body = await request.json()
    const validated = PersonalKpiWorkflowActionSchema.safeParse(body)
    if (!validated.success) {
      throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0]?.message || '잘못된 요청입니다.')
    }

    const kpi = await prisma.personalKpi.findUnique({
      where: { id },
      include: {
        employee: true,
      },
    })

    if (!kpi) {
      throw new AppError(404, 'PERSONAL_KPI_NOT_FOUND', '개인 KPI를 찾을 수 없습니다.')
    }

    const scopeDepartmentIds = getPersonalKpiScopeDepartmentIds({
      role: session.user.role,
      deptId: session.user.deptId,
      accessibleDepartmentIds: session.user.accessibleDepartmentIds,
    })
    const inScope =
      kpi.employeeId === session.user.id ||
      scopeDepartmentIds === null ||
      scopeDepartmentIds.includes(kpi.employee.deptId) ||
      session.user.deptId === kpi.employee.deptId

    if (!inScope) {
      throw new AppError(403, 'FORBIDDEN', '권한 범위를 벗어난 개인 KPI입니다.')
    }

    const goalEditLocked = await isGoalEditLocked(kpi.employee.deptId, kpi.evalYear)
    if (goalEditLocked && ['SAVE_DRAFT', 'SUBMIT', 'REOPEN'].includes(validated.data.action)) {
      throw new AppError(
        400,
        'GOAL_EDIT_LOCKED',
        '현재 주기는 목표 읽기 전용 모드입니다. 승인 요청 대신 체크인과 코멘트만 이어갈 수 있습니다.'
      )
    }

    const logs = await prisma.auditLog.findMany({
      where: {
        entityType: 'PersonalKpi',
        entityId: id,
      },
      orderBy: {
        timestamp: 'desc',
      },
      take: 30,
    })

    const operationalStatus = resolvePersonalKpiOperationalStatus({
      status: kpi.status,
      logs,
    })

    const clientInfo = getClientInfo(request)

    if (validated.data.action === 'SAVE_DRAFT') {
      if (kpi.employeeId !== session.user.id && !canReviewPersonalKpi(session.user.role)) {
        throw new AppError(403, 'FORBIDDEN', '임시저장 로그를 남길 권한이 없습니다.')
      }

      await createAuditLog({
        userId: session.user.id,
        action: 'PERSONAL_KPI_DRAFT_SAVED',
        entityType: 'PersonalKpi',
        entityId: id,
        oldValue: {
          workflowStatus: operationalStatus,
        },
        newValue: {
          workflowStatus: 'DRAFT',
          note: validated.data.note,
        },
        ...clientInfo,
      })

      return successResponse({ id, workflowStatus: 'DRAFT' })
    }

    if (validated.data.action === 'SUBMIT') {
      if (kpi.employeeId !== session.user.id && !canReviewPersonalKpi(session.user.role)) {
        throw new AppError(403, 'FORBIDDEN', '제출 처리 권한이 없습니다.')
      }

      if (!canSubmitPersonalKpi(operationalStatus)) {
        throw new AppError(409, 'PERSONAL_KPI_NOT_SUBMITTABLE', '초안 상태의 개인 KPI만 제출할 수 있습니다.')
      }

      await createAuditLog({
        userId: session.user.id,
        action: 'PERSONAL_KPI_SUBMITTED',
        entityType: 'PersonalKpi',
        entityId: id,
        oldValue: { workflowStatus: operationalStatus },
        newValue: { workflowStatus: 'SUBMITTED', note: validated.data.note },
        ...clientInfo,
      })

      return successResponse({ id, workflowStatus: 'SUBMITTED' })
    }

    if (validated.data.action === 'START_REVIEW') {
      if (!canReviewPersonalKpi(session.user.role)) {
        throw new AppError(403, 'FORBIDDEN', '검토 시작 권한이 없습니다.')
      }

      if (!canStartPersonalKpiReview(operationalStatus)) {
        throw new AppError(409, 'PERSONAL_KPI_NOT_REVIEWABLE', '제출된 개인 KPI만 검토 시작할 수 있습니다.')
      }

      await createAuditLog({
        userId: session.user.id,
        action: 'PERSONAL_KPI_REVIEW_STARTED',
        entityType: 'PersonalKpi',
        entityId: id,
        oldValue: { workflowStatus: operationalStatus },
        newValue: { workflowStatus: 'MANAGER_REVIEW', note: validated.data.note },
        ...clientInfo,
      })

      return successResponse({ id, workflowStatus: 'MANAGER_REVIEW' })
    }

    if (validated.data.action === 'REJECT') {
      if (!canReviewPersonalKpi(session.user.role)) {
        throw new AppError(403, 'FORBIDDEN', '반려 권한이 없습니다.')
      }

      if (!canRejectPersonalKpi(operationalStatus)) {
        throw new AppError(409, 'PERSONAL_KPI_NOT_REJECTABLE', '검토 가능한 개인 KPI만 반려할 수 있습니다.')
      }

      await prisma.personalKpi.update({
        where: { id },
        data: {
          status: 'DRAFT',
        },
      })

      await createAuditLog({
        userId: session.user.id,
        action: 'PERSONAL_KPI_REJECTED',
        entityType: 'PersonalKpi',
        entityId: id,
        oldValue: { workflowStatus: operationalStatus, status: kpi.status },
        newValue: { workflowStatus: 'DRAFT', status: 'DRAFT', note: validated.data.note },
        ...clientInfo,
      })

      return successResponse({ id, workflowStatus: 'DRAFT' })
    }

    if (validated.data.action === 'APPROVE') {
      if (!canReviewPersonalKpi(session.user.role)) {
        throw new AppError(403, 'FORBIDDEN', '승인 권한이 없습니다.')
      }

      if (!canApprovePersonalKpi(operationalStatus)) {
        throw new AppError(409, 'PERSONAL_KPI_NOT_APPROVABLE', '검토 가능한 개인 KPI만 승인할 수 있습니다.')
      }

      await prisma.personalKpi.update({
        where: { id },
        data: {
          status: 'CONFIRMED',
        },
      })

      await createAuditLog({
        userId: session.user.id,
        action: 'PERSONAL_KPI_APPROVED',
        entityType: 'PersonalKpi',
        entityId: id,
        oldValue: { workflowStatus: operationalStatus, status: kpi.status },
        newValue: { workflowStatus: 'CONFIRMED', status: 'CONFIRMED', note: validated.data.note },
        ...clientInfo,
      })

      return successResponse({ id, workflowStatus: 'CONFIRMED' })
    }

    if (validated.data.action === 'LOCK') {
      if (!canReviewPersonalKpi(session.user.role)) {
        throw new AppError(403, 'FORBIDDEN', '잠금 권한이 없습니다.')
      }

      if (!canLockPersonalKpi(operationalStatus)) {
        throw new AppError(409, 'PERSONAL_KPI_NOT_LOCKABLE', '확정 상태의 개인 KPI만 잠글 수 있습니다.')
      }

      await createAuditLog({
        userId: session.user.id,
        action: 'PERSONAL_KPI_LOCKED',
        entityType: 'PersonalKpi',
        entityId: id,
        oldValue: { workflowStatus: operationalStatus },
        newValue: { workflowStatus: 'LOCKED', note: validated.data.note },
        ...clientInfo,
      })

      return successResponse({ id, workflowStatus: 'LOCKED' })
    }

    if (!canReopenPersonalKpi(operationalStatus)) {
      throw new AppError(409, 'PERSONAL_KPI_NOT_REOPENABLE', '현재 상태에서는 재오픈할 수 없습니다.')
    }

    if (operationalStatus === 'LOCKED' || operationalStatus === 'CONFIRMED') {
      if (!['ROLE_ADMIN', 'ROLE_TEAM_LEADER', 'ROLE_SECTION_CHIEF', 'ROLE_DIV_HEAD', 'ROLE_CEO'].includes(session.user.role)) {
        throw new AppError(403, 'FORBIDDEN', '확정 또는 잠금 KPI 재오픈 권한이 없습니다.')
      }
      await prisma.personalKpi.update({
        where: { id },
        data: {
          status: 'DRAFT',
        },
      })
    }

    await createAuditLog({
      userId: session.user.id,
      action: 'PERSONAL_KPI_REOPENED',
      entityType: 'PersonalKpi',
      entityId: id,
      oldValue: { workflowStatus: operationalStatus, status: kpi.status },
      newValue: { workflowStatus: 'DRAFT', status: 'DRAFT', note: validated.data.note },
      ...clientInfo,
    })

    return successResponse({ id, workflowStatus: 'DRAFT' })
  } catch (error) {
    return errorResponse(error)
  }
}
