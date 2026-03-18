import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { errorResponse, successResponse, AppError } from '@/lib/utils'
import { UpdateEvalCycleSchema } from '@/lib/validations'

type RouteContext = {
  params: Promise<{ id: string }>
}

function toDate(value?: string) {
  return value ? new Date(value) : undefined
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '인증이 필요합니다.')
    if (session.user.role !== 'ROLE_ADMIN') {
      throw new AppError(403, 'FORBIDDEN', '관리자 권한이 필요합니다.')
    }

    const { id } = await context.params

    const cycle = await prisma.evalCycle.findUnique({
      where: { id },
      include: {
        organization: { select: { name: true } },
        _count: { select: { evaluations: true } },
      },
    })

    if (!cycle) {
      throw new AppError(404, 'CYCLE_NOT_FOUND', '평가 주기를 찾을 수 없습니다.')
    }

    return successResponse(cycle)
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '인증이 필요합니다.')
    if (session.user.role !== 'ROLE_ADMIN') {
      throw new AppError(403, 'FORBIDDEN', '관리자 권한이 필요합니다.')
    }

    const { id } = await context.params
    const body = await request.json()
    const validated = UpdateEvalCycleSchema.safeParse(body)

    if (!validated.success) {
      throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0].message)
    }

    const data = validated.data

    const existing = await prisma.evalCycle.findUnique({
      where: { id },
      select: { id: true },
    })

    if (!existing) {
      throw new AppError(404, 'CYCLE_NOT_FOUND', '평가 주기를 찾을 수 없습니다.')
    }

    const updateData = {
      ...(data.orgId ? { orgId: data.orgId } : {}),
      ...(data.evalYear !== undefined ? { evalYear: data.evalYear } : {}),
      ...(data.cycleName !== undefined ? { cycleName: data.cycleName } : {}),
      ...(data.status ? { status: data.status } : {}),
      ...(data.kpiSetupStart !== undefined ? { kpiSetupStart: toDate(data.kpiSetupStart) } : {}),
      ...(data.kpiSetupEnd !== undefined ? { kpiSetupEnd: toDate(data.kpiSetupEnd) } : {}),
      ...(data.selfEvalStart !== undefined ? { selfEvalStart: toDate(data.selfEvalStart) } : {}),
      ...(data.selfEvalEnd !== undefined ? { selfEvalEnd: toDate(data.selfEvalEnd) } : {}),
      ...(data.firstEvalStart !== undefined ? { firstEvalStart: toDate(data.firstEvalStart) } : {}),
      ...(data.firstEvalEnd !== undefined ? { firstEvalEnd: toDate(data.firstEvalEnd) } : {}),
      ...(data.secondEvalStart !== undefined ? { secondEvalStart: toDate(data.secondEvalStart) } : {}),
      ...(data.secondEvalEnd !== undefined ? { secondEvalEnd: toDate(data.secondEvalEnd) } : {}),
      ...(data.finalEvalStart !== undefined ? { finalEvalStart: toDate(data.finalEvalStart) } : {}),
      ...(data.finalEvalEnd !== undefined ? { finalEvalEnd: toDate(data.finalEvalEnd) } : {}),
      ...(data.ceoAdjustStart !== undefined ? { ceoAdjustStart: toDate(data.ceoAdjustStart) } : {}),
      ...(data.ceoAdjustEnd !== undefined ? { ceoAdjustEnd: toDate(data.ceoAdjustEnd) } : {}),
      ...(data.resultOpenStart !== undefined ? { resultOpenStart: toDate(data.resultOpenStart) } : {}),
      ...(data.resultOpenEnd !== undefined ? { resultOpenEnd: toDate(data.resultOpenEnd) } : {}),
      ...(data.appealDeadline !== undefined ? { appealDeadline: toDate(data.appealDeadline) } : {}),
    }

    const cycle = await prisma.evalCycle.update({
      where: { id },
      data: updateData,
      include: {
        organization: { select: { name: true } },
        _count: { select: { evaluations: true } },
      },
    })

    return successResponse(cycle)
  } catch (error) {
    return errorResponse(error)
  }
}
