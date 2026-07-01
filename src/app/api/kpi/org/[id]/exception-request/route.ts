import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createAuditLog, getClientInfo } from '@/lib/audit'
import { prisma } from '@/lib/prisma'
import { resolveOrgKpiScopeFromDepartmentId } from '@/lib/org-kpi-scope'
import { queueNotification } from '@/lib/notification-service'
import { AppError, errorResponse, successResponse } from '@/lib/utils'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      throw new AppError(401, 'UNAUTHORIZED', '인증이 필요합니다.')
    }

    if (session.user.position !== 'TEAM_LEADER') {
      throw new AppError(403, 'FORBIDDEN', '팀장만 예외 승인을 신청할 수 있습니다.')
    }

    const { id } = await context.params
    const body = (await request.json()) as Record<string, unknown>
    const reason = typeof body.reason === 'string' ? body.reason.trim() : ''

    if (!reason || reason.length < 10) {
      throw new AppError(400, 'VALIDATION_ERROR', '신청 사유를 10자 이상 입력해 주세요.', {
        fieldErrors: { reason: '신청 사유를 10자 이상 입력해 주세요.' },
      })
    }

    const [departments, orgKpi] = await Promise.all([
      prisma.department.findMany({
        select: { id: true, deptName: true, parentDeptId: true },
      }),
      prisma.orgKpi.findUnique({
        where: { id },
        select: {
          id: true,
          deptId: true,
          kpiName: true,
          mboExceptionApproved: true,
        },
      }),
    ])

    if (!orgKpi) {
      throw new AppError(404, 'ORG_KPI_NOT_FOUND', '조직 KPI를 찾을 수 없습니다.')
    }

    const scope = resolveOrgKpiScopeFromDepartmentId(orgKpi.deptId, departments)
    if (scope !== 'team') {
      throw new AppError(400, 'ORG_KPI_EXCEPTION_TEAM_ONLY', '팀 KPI만 예외 승인 신청 대상입니다.')
    }

    if (orgKpi.deptId !== session.user.deptId) {
      throw new AppError(403, 'FORBIDDEN', '자기 팀의 KPI만 예외 승인을 신청할 수 있습니다.')
    }

    if (orgKpi.mboExceptionApproved) {
      throw new AppError(409, 'ALREADY_EXCEPTION_APPROVED', '이미 예외 승인이 완료된 KPI입니다.')
    }

    const existingPending = await prisma.orgKpiExceptionRequest.findFirst({
      where: { orgKpiId: id, status: 'PENDING' },
      select: { id: true },
    })
    if (existingPending) {
      throw new AppError(409, 'EXCEPTION_REQUEST_ALREADY_PENDING', '이미 검토 대기 중인 예외 승인 신청이 있습니다.')
    }

    const exceptionRequest = await prisma.orgKpiExceptionRequest.create({
      data: {
        orgKpiId: id,
        requesterId: session.user.id,
        reason,
        status: 'PENDING',
      },
      select: {
        id: true,
        status: true,
        reason: true,
        createdAt: true,
      },
    })

    await createAuditLog({
      userId: session.user.id,
      action: 'ORG_KPI_EXCEPTION_REQUEST_SUBMITTED',
      entityType: 'OrgKpiExceptionRequest',
      entityId: exceptionRequest.id,
      oldValue: { status: null },
      newValue: {
        status: 'PENDING',
        orgKpiId: id,
        kpiName: orgKpi.kpiName,
        reason,
      },
      ...getClientInfo(request),
    })

    // 주 로직(PENDING row 생성 + AuditLog) 완료 후 알림 — 실패해도 200 응답 유지
    try {
      const admins = await prisma.employee.findMany({
        where: { role: 'ROLE_ADMIN', status: 'ACTIVE' },
        select: { id: true },
      })
      const teamDept = departments.find((d) => d.id === orgKpi.deptId)
      const teamName = teamDept?.deptName ?? ''
      for (const admin of admins) {
        await queueNotification({
          recipientId: admin.id,
          type: 'SYSTEM',
          sourceType: 'OrgKpiExceptionRequest',
          sourceId: exceptionRequest.id,
          dedupeToken: `exception-request-submit:${exceptionRequest.id}`,
          payload: {
            title: '예외 승인 신청이 도착했습니다.',
            body: `${session.user.name ?? ''}님이 ${teamName} '${orgKpi.kpiName}' KPI 예외 승인을 신청했습니다.`,
            link: '/admin/kpi/exception-requests',
          },
          channels: ['IN_APP'],
        })
      }
    } catch (notifError) {
      console.error('[exception-request] 알림 큐 실패 (무시):', notifError)
    }

    return successResponse({
      id: exceptionRequest.id,
      status: exceptionRequest.status,
      reason: exceptionRequest.reason,
      createdAt: exceptionRequest.createdAt.toISOString(),
    })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      throw new AppError(401, 'UNAUTHORIZED', '인증이 필요합니다.')
    }

    const { id } = await context.params

    const orgKpi = await prisma.orgKpi.findUnique({
      where: { id },
      select: { id: true, deptId: true },
    })

    if (!orgKpi) {
      throw new AppError(404, 'ORG_KPI_NOT_FOUND', '조직 KPI를 찾을 수 없습니다.')
    }

    const isAdmin = session.user.role === 'ROLE_ADMIN'
    const isOwnTeam = orgKpi.deptId === session.user.deptId

    if (!isAdmin && !isOwnTeam) {
      throw new AppError(403, 'FORBIDDEN', '해당 KPI의 예외 승인 신청 내역을 조회할 권한이 없습니다.')
    }

    const latestRequest = await prisma.orgKpiExceptionRequest.findFirst({
      where: { orgKpiId: id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        reason: true,
        reviewNote: true,
        createdAt: true,
        resolvedAt: true,
        requester: { select: { id: true, empName: true } },
        reviewer: { select: { id: true, empName: true } },
      },
    })

    return successResponse({ request: latestRequest ?? null })
  } catch (error) {
    return errorResponse(error)
  }
}
