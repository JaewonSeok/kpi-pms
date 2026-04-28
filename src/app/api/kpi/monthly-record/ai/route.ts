import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AppError, errorResponse, successResponse } from '@/lib/utils'
import { MonthlyRecordAiActionSchema } from '@/lib/validations'
import { canAccessManagedEmployeeContext } from '@/server/checkin-access'
import {
  explainRiskyKpi,
  generateManagerReviewDraft,
  generateMonthlyPerformanceSummary,
  generateMonthlyRetrospective,
  suggestMonthlyCheckinAgenda,
  summarizeMonthlyEvaluationEvidence,
  summarizeMonthlyEvidence,
} from '@/server/ai/monthly-kpi'

async function resolveMonthlyAiTargetEmployee(sourceId: string) {
  const monthlyRecord = await prisma.monthlyRecord.findUnique({
    where: { id: sourceId },
    include: {
      personalKpi: {
        include: {
          employee: {
            select: {
              id: true,
              teamLeaderId: true,
              sectionChiefId: true,
              divisionHeadId: true,
            },
          },
        },
      },
    },
  })

  if (monthlyRecord?.personalKpi.employee) {
    return monthlyRecord.personalKpi.employee
  }

  const personalKpi = await prisma.personalKpi.findUnique({
    where: { id: sourceId },
    include: {
      employee: {
        select: {
          id: true,
          teamLeaderId: true,
          sectionChiefId: true,
          divisionHeadId: true,
        },
      },
    },
  })

  return personalKpi?.employee ?? null
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    }

    const body = await request.json()
    const validated = MonthlyRecordAiActionSchema.safeParse(body)
    if (!validated.success) {
      throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0]?.message || '잘못된 AI 요청입니다.')
    }

    const commonParams = {
      requesterId: session.user.id,
      sourceId: validated.data.sourceId,
      payload: validated.data.payload,
    }

    if (validated.data.action === 'generate-summary') {
      const sourceId = validated.data.sourceId?.trim()
      if (!sourceId) {
        throw new AppError(400, 'MONTHLY_AI_TARGET_REQUIRED', '월간 실적 코멘트 초안 대상 KPI를 먼저 선택해 주세요.')
      }

      const targetEmployee = await resolveMonthlyAiTargetEmployee(sourceId)
      if (!targetEmployee) {
        throw new AppError(404, 'MONTHLY_AI_TARGET_NOT_FOUND', '월간 실적 코멘트 초안 대상을 찾을 수 없습니다.')
      }

      if (!canAccessManagedEmployeeContext(session.user.id, session.user.role, targetEmployee)) {
        throw new AppError(
          403,
          'FORBIDDEN',
          '팀장·실장·본부장 등 리뷰 권한이 있는 화면에서만 월간 실적 코멘트 초안을 사용할 수 있습니다.'
        )
      }
    }

    const result = await (async () => {
      switch (validated.data.action) {
        case 'generate-summary':
          return generateMonthlyPerformanceSummary(commonParams)
        case 'explain-risk':
          return explainRiskyKpi(commonParams)
        case 'generate-review':
          return generateManagerReviewDraft(commonParams)
        case 'summarize-evidence':
          return summarizeMonthlyEvidence(commonParams)
        case 'generate-retrospective':
          return generateMonthlyRetrospective(commonParams)
        case 'suggest-checkin-agenda':
          return suggestMonthlyCheckinAgenda(commonParams)
        case 'summarize-evaluation-evidence':
          return summarizeMonthlyEvaluationEvidence(commonParams)
        default:
          throw new AppError(400, 'UNSUPPORTED_AI_ACTION', '지원하지 않는 월간 실적 AI 작업입니다.')
      }
    })()

    return successResponse(result)
  } catch (error) {
    return errorResponse(error)
  }
}
