import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { errorResponse, successResponse, AppError } from '@/lib/utils'
import { EvalCycleSchema } from '@/lib/validations'

// GET /api/admin/eval-cycles
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '인증이 필요합니다.')

    const cycles = await prisma.evalCycle.findMany({
      include: {
        organization: { select: { name: true } },
        _count: { select: { evaluations: true } },
      },
      orderBy: { evalYear: 'desc' },
    })

    return successResponse(cycles)
  } catch (error) {
    return errorResponse(error)
  }
}

// POST /api/admin/eval-cycles
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '인증이 필요합니다.')
    if (session.user.role !== 'ROLE_ADMIN') throw new AppError(403, 'FORBIDDEN', '관리자 권한이 필요합니다.')

    const body = await request.json()
    const validated = EvalCycleSchema.safeParse(body)
    if (!validated.success) {
      throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0].message)
    }

    const data = validated.data
    const cycle = await prisma.evalCycle.create({
      data: {
        ...data,
        showQuestionWeight: data.showQuestionWeight,
        showScoreSummary: data.showScoreSummary,
        goalEditMode: data.goalEditMode,
        kpiSetupStart: data.kpiSetupStart ? new Date(data.kpiSetupStart) : undefined,
        kpiSetupEnd: data.kpiSetupEnd ? new Date(data.kpiSetupEnd) : undefined,
        selfEvalStart: data.selfEvalStart ? new Date(data.selfEvalStart) : undefined,
        selfEvalEnd: data.selfEvalEnd ? new Date(data.selfEvalEnd) : undefined,
        firstEvalStart: data.firstEvalStart ? new Date(data.firstEvalStart) : undefined,
        firstEvalEnd: data.firstEvalEnd ? new Date(data.firstEvalEnd) : undefined,
        secondEvalStart: data.secondEvalStart ? new Date(data.secondEvalStart) : undefined,
        secondEvalEnd: data.secondEvalEnd ? new Date(data.secondEvalEnd) : undefined,
        finalEvalStart: data.finalEvalStart ? new Date(data.finalEvalStart) : undefined,
        finalEvalEnd: data.finalEvalEnd ? new Date(data.finalEvalEnd) : undefined,
        ceoAdjustStart: data.ceoAdjustStart ? new Date(data.ceoAdjustStart) : undefined,
        ceoAdjustEnd: data.ceoAdjustEnd ? new Date(data.ceoAdjustEnd) : undefined,
        resultOpenStart: data.resultOpenStart ? new Date(data.resultOpenStart) : undefined,
        resultOpenEnd: data.resultOpenEnd ? new Date(data.resultOpenEnd) : undefined,
        appealDeadline: data.appealDeadline ? new Date(data.appealDeadline) : undefined,
      },
    })

    return successResponse(cycle)
  } catch (error) {
    return errorResponse(error)
  }
}
