import type { Prisma } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { createAuditLog, getClientInfo } from '@/lib/audit'
import { prisma } from '@/lib/prisma'
import { AppError, errorResponse, successResponse } from '@/lib/utils'
import { CreateFeedbackRoundSchema } from '@/lib/validations'
import { getFeedbackReviewAdminAccess } from '@/server/feedback-360-access'

const Feedback360QuarterRoundCreateSchema = z.object({
  evalCycleId: z.string().min(1),
  quarter: z.enum(['Q1', 'Q2', 'Q3', 'Q4']),
})

const QUARTER_WINDOWS = {
  Q1: { label: '1분기', startMonth: 1, endMonth: 3, endDay: 31 },
  Q2: { label: '2분기', startMonth: 4, endMonth: 6, endDay: 30 },
  Q3: { label: '3분기', startMonth: 7, endMonth: 9, endDay: 30 },
  Q4: { label: '4분기', startMonth: 10, endMonth: 12, endDay: 31 },
} as const

const DEFAULT_FEEDBACK_360_QUESTIONS = [
  {
    category: '협업',
    questionText: '이 동료가 협업 과정에서 보여준 강점은 무엇인가요?',
    questionType: 'TEXT' as const,
    isRequired: true,
    sortOrder: 1,
  },
  {
    category: '업무 실행',
    questionText: '목표 달성과 실행력 측면에서 가장 인상적이었던 행동은 무엇인가요?',
    questionType: 'TEXT' as const,
    isRequired: true,
    sortOrder: 2,
  },
  {
    category: '성장 제안',
    questionText: '앞으로 더 성장하기 위해 보완하면 좋을 점은 무엇인가요?',
    questionType: 'TEXT' as const,
    isRequired: true,
    sortOrder: 3,
  },
  {
    category: '종합',
    questionText: '이번 분기 협업 경험을 기준으로 종합적으로 평가해 주세요.',
    questionType: 'RATING_SCALE' as const,
    scaleMin: 1,
    scaleMax: 5,
    isRequired: true,
    sortOrder: 4,
  },
]

async function getActor() {
  const session = await getServerSession(authOptions)
  if (!session) {
    throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
  }

  const employee = await prisma.employee.findUnique({
    where: { id: session.user.id },
    include: { department: true },
  })

  if (!employee) {
    throw new AppError(404, 'EMPLOYEE_NOT_FOUND', '직원 정보를 찾을 수 없습니다.')
  }

  return { session, employee }
}

function buildQuarterWindow(evalYear: number, quarter: keyof typeof QUARTER_WINDOWS) {
  const window = QUARTER_WINDOWS[quarter]
  return {
    label: window.label,
    startDate: new Date(`${evalYear}-${String(window.startMonth).padStart(2, '0')}-01T00:00:00+09:00`),
    endDate: new Date(`${evalYear}-${String(window.endMonth).padStart(2, '0')}-${window.endDay}T23:59:59+09:00`),
  }
}

export async function POST(request: Request) {
  try {
    const { employee } = await getActor()
    const reviewAdminAccess = await getFeedbackReviewAdminAccess({
      employeeId: employee.id,
      actorRole: employee.role,
      orgId: employee.department.orgId,
    })

    if (!reviewAdminAccess.canManageAllRounds && !reviewAdminAccess.canManageCollaboratorRounds) {
      throw new AppError(403, 'FORBIDDEN', '360 다면평가 라운드를 생성할 권한이 없습니다.')
    }

    const parsed = Feedback360QuarterRoundCreateSchema.safeParse(await request.json())
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? '라운드 생성 입력값이 올바르지 않습니다.')
    }

    const evalCycle = await prisma.evalCycle.findFirst({
      where: {
        id: parsed.data.evalCycleId,
        orgId: employee.department.orgId,
      },
      select: {
        id: true,
        cycleName: true,
        evalYear: true,
        orgId: true,
      },
    })

    if (!evalCycle) {
      throw new AppError(404, 'EVAL_CYCLE_NOT_FOUND', '라운드를 생성할 평가 주기를 찾을 수 없습니다.')
    }

    const window = buildQuarterWindow(evalCycle.evalYear, parsed.data.quarter)
    const roundName = `${evalCycle.evalYear}년 ${window.label} 360 다면평가`
    const roundInput = CreateFeedbackRoundSchema.parse({
      evalCycleId: evalCycle.id,
      roundName,
      roundType: 'FULL_360',
      startDate: window.startDate.toISOString(),
      endDate: window.endDate.toISOString(),
      isAnonymous: true,
      minRaters: 3,
      maxRaters: 8,
      weightInFinal: 0,
      selectionSettings: {
        requireLeaderApproval: true,
        allowPreferredPeers: true,
        excludeLeaderFromPeerSelection: false,
        excludeDirectReportsFromPeerSelection: true,
      },
    })

    const existingRound = await prisma.multiFeedbackRound.findFirst({
      where: {
        evalCycleId: evalCycle.id,
        roundType: 'FULL_360',
        startDate: window.startDate,
        endDate: window.endDate,
      },
      select: {
        id: true,
        roundName: true,
      },
    })

    if (existingRound) {
      return successResponse({
        roundId: existingRound.id,
        roundName: existingRound.roundName,
        created: false,
        message: `${window.label} 라운드가 이미 준비되어 있습니다.`,
      })
    }

    const clientInfo = getClientInfo(request)
    const documentSettings = {
      quarter: parsed.data.quarter,
      quarterLabel: window.label,
      source: 'feedback360HubOperations',
    } satisfies Prisma.InputJsonObject

    const selectionSettings = roundInput.selectionSettings as Prisma.InputJsonValue
    const visibilitySettings = {
      SELF: 'ANONYMOUS',
      SUPERVISOR: 'ANONYMOUS',
      PEER: 'ANONYMOUS',
      SUBORDINATE: 'ANONYMOUS',
      CROSS_TEAM_PEER: 'ANONYMOUS',
      CROSS_DEPT: 'ANONYMOUS',
    } satisfies Prisma.InputJsonObject

    const round = await prisma.multiFeedbackRound.create({
      data: {
        evalCycleId: roundInput.evalCycleId,
        roundName: roundInput.roundName,
        roundType: 'FULL_360',
        startDate: new Date(roundInput.startDate),
        endDate: new Date(roundInput.endDate),
        status: 'DRAFT',
        isAnonymous: roundInput.isAnonymous,
        minRaters: roundInput.minRaters,
        maxRaters: roundInput.maxRaters,
        weightInFinal: roundInput.weightInFinal,
        createdById: employee.id,
        selectionSettings,
        visibilitySettings,
        documentSettings,
        collaborators: reviewAdminAccess.canManageAllRounds
          ? undefined
          : {
              create: {
                employeeId: employee.id,
              },
            },
        questions: {
          create: DEFAULT_FEEDBACK_360_QUESTIONS,
        },
      },
      select: {
        id: true,
        roundName: true,
      },
    })

    await createAuditLog({
      userId: employee.id,
      action: 'FEEDBACK_360_QUARTER_ROUND_CREATED',
      entityType: 'MultiFeedbackRound',
      entityId: round.id,
      newValue: {
        evalCycleId: evalCycle.id,
        quarter: parsed.data.quarter,
        quarterLabel: window.label,
        roundType: 'FULL_360',
        startDate: roundInput.startDate,
        endDate: roundInput.endDate,
      },
      ipAddress: clientInfo.ipAddress,
      userAgent: clientInfo.userAgent,
    })

    return successResponse({
      roundId: round.id,
      roundName: round.roundName,
      created: true,
      message: `${window.label} 라운드를 생성했습니다.`,
    })
  } catch (error) {
    return errorResponse(error)
  }
}
