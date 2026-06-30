import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AppError, errorResponse, successResponse } from '@/lib/utils'

const ALLOWED_STATUSES = new Set(['PENDING', 'APPROVED', 'REJECTED'])

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '인증이 필요합니다.')
    if (session.user.role !== 'ROLE_ADMIN') {
      throw new AppError(403, 'FORBIDDEN', '관리자만 조회할 수 있습니다.')
    }

    const { searchParams } = new URL(request.url)
    const statusParam = searchParams.get('status')
    const statusFilter =
      statusParam && ALLOWED_STATUSES.has(statusParam)
        ? (statusParam as 'PENDING' | 'APPROVED' | 'REJECTED')
        : undefined

    const rows = await prisma.orgKpiExceptionRequest.findMany({
      where: statusFilter ? { status: statusFilter } : undefined,
      orderBy: [{ createdAt: 'desc' }],
      select: {
        id: true,
        status: true,
        reason: true,
        reviewNote: true,
        createdAt: true,
        resolvedAt: true,
        orgKpi: {
          select: {
            id: true,
            kpiName: true,
            evalYear: true,
            department: { select: { id: true, deptName: true } },
          },
        },
        requester: { select: { id: true, empName: true } },
        reviewer: { select: { id: true, empName: true } },
      },
    })

    return successResponse({
      requests: rows.map((r) => ({
        id: r.id,
        status: r.status,
        reason: r.reason,
        reviewNote: r.reviewNote,
        createdAt: r.createdAt.toISOString(),
        resolvedAt: r.resolvedAt?.toISOString() ?? null,
        orgKpi: {
          id: r.orgKpi.id,
          kpiName: r.orgKpi.kpiName,
          evalYear: r.orgKpi.evalYear,
          deptId: r.orgKpi.department.id,
          deptName: r.orgKpi.department.deptName,
        },
        requester: r.requester,
        reviewer: r.reviewer ?? null,
      })),
    })
  } catch (error) {
    return errorResponse(error)
  }
}
