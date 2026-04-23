import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AppError, errorResponse, successResponse } from '@/lib/utils'
import { canAccessDepartment, canAccessEmployee } from '@/server/auth/authorize'
import {
  getLatestEmployeeMidReviewSummary,
  getLatestOrgKpiMidReviewSummaries,
  getLatestPersonalKpiMidReviewSummaries,
} from '@/server/mid-review'

const SummaryQuerySchema = z.object({
  kind: z.enum(['org-kpi', 'personal-kpi', 'employee']),
  id: z.string().min(1),
})

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    }

    const url = new URL(request.url)
    const validated = SummaryQuerySchema.safeParse({
      kind: url.searchParams.get('kind'),
      id: url.searchParams.get('id'),
    })
    if (!validated.success) {
      throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0]?.message ?? '요청값을 확인해 주세요.')
    }

    if (validated.data.kind === 'personal-kpi') {
      const personalKpi = await prisma.personalKpi.findUnique({
        where: { id: validated.data.id },
        select: {
          id: true,
          employee: {
            select: {
              id: true,
              deptId: true,
            },
          },
        },
      })
      if (!personalKpi?.employee || !canAccessEmployee(session, personalKpi.employee)) {
        throw new AppError(403, 'FORBIDDEN', '중간 점검 요약을 볼 권한이 없습니다.')
      }

      const summary = (await getLatestPersonalKpiMidReviewSummaries([validated.data.id])).get(validated.data.id) ?? null
      return successResponse(summary)
    }

    if (validated.data.kind === 'org-kpi') {
      const orgKpi = await prisma.orgKpi.findUnique({
        where: { id: validated.data.id },
        select: {
          id: true,
          deptId: true,
        },
      })
      if (!orgKpi || !canAccessDepartment(session, orgKpi.deptId)) {
        throw new AppError(403, 'FORBIDDEN', '중간 점검 요약을 볼 권한이 없습니다.')
      }

      const summary = (await getLatestOrgKpiMidReviewSummaries([validated.data.id])).get(validated.data.id) ?? null
      return successResponse(summary)
    }

    const employee = await prisma.employee.findUnique({
      where: { id: validated.data.id },
      select: {
        id: true,
        deptId: true,
      },
    })
    if (!employee || !canAccessEmployee(session, employee)) {
      throw new AppError(403, 'FORBIDDEN', '중간 점검 요약을 볼 권한이 없습니다.')
    }

    const summary = await getLatestEmployeeMidReviewSummary(validated.data.id)
    return successResponse(summary)
  } catch (error) {
    return errorResponse(error)
  }
}
