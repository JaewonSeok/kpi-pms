import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AppError, errorResponse, successResponse } from '@/lib/utils'
import { NotificationOpsAiActionSchema } from '@/lib/validations'
import {
  generateOpsReportDraft,
  summarizeDeadLetterPatterns,
  summarizeNotificationOps,
  validateTemplateVariablesWithAi,
} from '@/server/ai/notification-ops'

const NOTIFICATION_AI_SOURCE_TYPES = [
  'NotificationOpsSummary',
  'NotificationDeadLetterPatterns',
  'NotificationTemplateValidation',
  'NotificationOpsReport',
] as const

function ensureAdminRole(role: string) {
  if (role !== 'ROLE_ADMIN') {
    throw new AppError(403, 'FORBIDDEN', '관리자 권한이 필요합니다.')
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    }
    ensureAdminRole(session.user.role)

    const logs = await prisma.aiRequestLog.findMany({
      where: {
        sourceType: { in: [...NOTIFICATION_AI_SOURCE_TYPES] },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        sourceType: true,
        sourceId: true,
        requestStatus: true,
        approvalStatus: true,
        responsePayload: true,
        errorMessage: true,
        createdAt: true,
      },
    })

    return successResponse(logs)
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    }
    ensureAdminRole(session.user.role)

    const body = await request.json()
    const validated = NotificationOpsAiActionSchema.safeParse(body)
    if (!validated.success) {
      throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0]?.message || '잘못된 AI 요청입니다.')
    }

    const commonParams = {
      requesterId: session.user.id,
      sourceId: validated.data.sourceId ?? 'notification-ops',
      payload: validated.data.payload,
    }

    const result = await (async () => {
      switch (validated.data.action) {
        case 'summarize-ops':
          return summarizeNotificationOps(commonParams)
        case 'summarize-dead-letters':
          return summarizeDeadLetterPatterns(commonParams)
        case 'validate-template-variables':
          return validateTemplateVariablesWithAi(commonParams)
        case 'generate-ops-report':
          return generateOpsReportDraft(commonParams)
        default:
          throw new AppError(400, 'UNSUPPORTED_AI_ACTION', '지원하지 않는 AI 작업입니다.')
      }
    })()

    return successResponse(result)
  } catch (error) {
    return errorResponse(error)
  }
}
