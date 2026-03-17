import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { errorResponse, successResponse, AppError } from '@/lib/utils'
import { CreateOrgKpiSchema } from '@/lib/validations'

// GET /api/kpi/org
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '인증이 필요합니다.')

    const { searchParams } = new URL(request.url)
    const evalYear = searchParams.get('evalYear')
    const deptId = searchParams.get('deptId')

    const kpis = await prisma.orgKpi.findMany({
      where: {
        ...(evalYear ? { evalYear: parseInt(evalYear) } : {}),
        ...(deptId ? { deptId } : {}),
      },
      include: {
        department: { select: { deptName: true, deptCode: true } },
      },
      orderBy: [{ deptId: 'asc' }, { kpiName: 'asc' }],
    })

    return successResponse(kpis)
  } catch (error) {
    return errorResponse(error)
  }
}

// POST /api/kpi/org
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '인증이 필요합니다.')
    if (!['ROLE_ADMIN', 'ROLE_TEAM_LEADER', 'ROLE_SECTION_CHIEF', 'ROLE_DIV_HEAD'].includes(session.user.role)) {
      throw new AppError(403, 'FORBIDDEN', '권한이 없습니다.')
    }

    const body = await request.json()
    const validated = CreateOrgKpiSchema.safeParse(body)
    if (!validated.success) {
      throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0].message)
    }

    const data = validated.data

    // 가중치 합계 검증
    const existing = await prisma.orgKpi.findMany({
      where: { deptId: data.deptId, evalYear: data.evalYear },
    })
    const totalWeight = existing.reduce((sum, k) => sum + k.weight, 0) + data.weight
    if (totalWeight > 100) {
      throw new AppError(400, 'WEIGHT_EXCEEDED', `가중치 합계가 100을 초과합니다. (현재: ${totalWeight - data.weight}, 추가: ${data.weight})`)
    }

    const kpi = await prisma.orgKpi.create({ data })
    return successResponse(kpi)
  } catch (error) {
    return errorResponse(error)
  }
}
