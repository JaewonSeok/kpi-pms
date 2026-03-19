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

function getReadinessFailures(cycle: {
  kpiSetupStart: Date | null
  kpiSetupEnd: Date | null
  selfEvalStart: Date | null
  selfEvalEnd: Date | null
  firstEvalStart: Date | null
  firstEvalEnd: Date | null
  finalEvalStart: Date | null
  finalEvalEnd: Date | null
  resultOpenStart: Date | null
  appealDeadline: Date | null
  _count: { evaluations: number }
}) {
  const failures: string[] = []

  if (!cycle.kpiSetupStart || !cycle.kpiSetupEnd) failures.push('KPI 설정 일정이 완성되지 않았습니다.')
  if (!cycle.selfEvalStart || !cycle.selfEvalEnd) failures.push('자기 평가 일정이 완성되지 않았습니다.')
  if (!cycle.firstEvalStart || !cycle.firstEvalEnd) failures.push('1차 평가 일정이 완성되지 않았습니다.')
  if (!cycle.finalEvalStart || !cycle.finalEvalEnd) failures.push('최종 평가 일정이 완성되지 않았습니다.')
  if (!cycle.resultOpenStart) failures.push('결과 공개 시작일이 설정되지 않았습니다.')
  if (!cycle.appealDeadline) failures.push('이의 신청 마감일이 설정되지 않았습니다.')
  if (cycle._count.evaluations === 0) failures.push('생성된 평가 데이터가 없습니다.')

  return failures
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
      select: {
        id: true,
        kpiSetupStart: true,
        kpiSetupEnd: true,
        selfEvalStart: true,
        selfEvalEnd: true,
        firstEvalStart: true,
        firstEvalEnd: true,
        finalEvalStart: true,
        finalEvalEnd: true,
        resultOpenStart: true,
        appealDeadline: true,
        _count: { select: { evaluations: true } },
      },
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

    const nextCycle = {
      ...existing,
      kpiSetupStart: data.kpiSetupStart !== undefined ? toDate(data.kpiSetupStart) ?? null : existing.kpiSetupStart,
      kpiSetupEnd: data.kpiSetupEnd !== undefined ? toDate(data.kpiSetupEnd) ?? null : existing.kpiSetupEnd,
      selfEvalStart: data.selfEvalStart !== undefined ? toDate(data.selfEvalStart) ?? null : existing.selfEvalStart,
      selfEvalEnd: data.selfEvalEnd !== undefined ? toDate(data.selfEvalEnd) ?? null : existing.selfEvalEnd,
      firstEvalStart: data.firstEvalStart !== undefined ? toDate(data.firstEvalStart) ?? null : existing.firstEvalStart,
      firstEvalEnd: data.firstEvalEnd !== undefined ? toDate(data.firstEvalEnd) ?? null : existing.firstEvalEnd,
      finalEvalStart: data.finalEvalStart !== undefined ? toDate(data.finalEvalStart) ?? null : existing.finalEvalStart,
      finalEvalEnd: data.finalEvalEnd !== undefined ? toDate(data.finalEvalEnd) ?? null : existing.finalEvalEnd,
      resultOpenStart: data.resultOpenStart !== undefined ? toDate(data.resultOpenStart) ?? null : existing.resultOpenStart,
      appealDeadline: data.appealDeadline !== undefined ? toDate(data.appealDeadline) ?? null : existing.appealDeadline,
    }

    if (data.status && ['RESULT_OPEN', 'APPEAL', 'CLOSED'].includes(data.status)) {
      const failures = getReadinessFailures(nextCycle)
      if (failures.length > 0) {
        throw new AppError(
          400,
          'CYCLE_NOT_READY',
          `공개 전 readiness 체크를 통과하지 못했습니다. ${failures.join(' ')}`
        )
      }
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
