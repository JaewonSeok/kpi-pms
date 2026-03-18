import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { errorResponse, successResponse, AppError } from '@/lib/utils'
import { UpdateOrgKpiSchema } from '@/lib/validations'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '인증이 필요합니다.')

    const { id } = await context.params

    const kpi = await prisma.orgKpi.findUnique({
      where: { id },
      include: {
        department: {
          select: {
            deptName: true,
            deptCode: true,
          },
        },
        personalKpis: {
          select: {
            id: true,
            kpiName: true,
            status: true,
            employee: {
              select: {
                empId: true,
                empName: true,
              },
            },
          },
          orderBy: [{ employee: { empName: 'asc' } }],
        },
        _count: { select: { personalKpis: true } },
      },
    })

    if (!kpi) {
      throw new AppError(404, 'ORG_KPI_NOT_FOUND', '조직 KPI를 찾을 수 없습니다.')
    }

    return successResponse(kpi)
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '인증이 필요합니다.')
    if (!['ROLE_ADMIN', 'ROLE_TEAM_LEADER', 'ROLE_SECTION_CHIEF', 'ROLE_DIV_HEAD'].includes(session.user.role)) {
      throw new AppError(403, 'FORBIDDEN', '권한이 없습니다.')
    }

    const { id } = await context.params
    const body = await request.json()
    const validated = UpdateOrgKpiSchema.safeParse(body)

    if (!validated.success) {
      throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0].message)
    }

    const data = validated.data

    const current = await prisma.orgKpi.findUnique({
      where: { id },
      select: {
        id: true,
        deptId: true,
        evalYear: true,
        weight: true,
      },
    })

    if (!current) {
      throw new AppError(404, 'ORG_KPI_NOT_FOUND', '조직 KPI를 찾을 수 없습니다.')
    }

    const targetDeptId = data.deptId ?? current.deptId
    const targetEvalYear = data.evalYear ?? current.evalYear
    const targetWeight = data.weight ?? current.weight

    if (
      data.deptId !== undefined ||
      data.evalYear !== undefined ||
      data.weight !== undefined
    ) {
      const related = await prisma.orgKpi.findMany({
        where: {
          deptId: targetDeptId,
          evalYear: targetEvalYear,
          id: { not: id },
        },
        select: { weight: true },
      })

      const totalWeight = related.reduce((sum, item) => sum + item.weight, 0) + targetWeight
      if (totalWeight > 100) {
        throw new AppError(
          400,
          'WEIGHT_EXCEEDED',
          `가중치 합계가 100을 초과합니다. (변경 후: ${totalWeight})`
        )
      }
    }

    const kpi = await prisma.orgKpi.update({
      where: { id },
      data: {
        ...(data.deptId !== undefined ? { deptId: data.deptId } : {}),
        ...(data.evalYear !== undefined ? { evalYear: data.evalYear } : {}),
        ...(data.kpiType !== undefined ? { kpiType: data.kpiType } : {}),
        ...(data.kpiCategory !== undefined ? { kpiCategory: data.kpiCategory } : {}),
        ...(data.kpiName !== undefined ? { kpiName: data.kpiName } : {}),
        ...(data.definition !== undefined ? { definition: data.definition || null } : {}),
        ...(data.formula !== undefined ? { formula: data.formula || null } : {}),
        ...(data.targetValue !== undefined ? { targetValue: data.targetValue } : {}),
        ...(data.unit !== undefined ? { unit: data.unit || null } : {}),
        ...(data.weight !== undefined ? { weight: data.weight } : {}),
        ...(data.difficulty !== undefined ? { difficulty: data.difficulty } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
      },
      include: {
        department: {
          select: {
            deptName: true,
            deptCode: true,
          },
        },
        personalKpis: {
          select: {
            id: true,
            kpiName: true,
            status: true,
            employee: {
              select: {
                empId: true,
                empName: true,
              },
            },
          },
          orderBy: [{ employee: { empName: 'asc' } }],
        },
        _count: { select: { personalKpis: true } },
      },
    })

    return successResponse(kpi)
  } catch (error) {
    return errorResponse(error)
  }
}
