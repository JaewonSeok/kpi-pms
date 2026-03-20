import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createAuditLog, getClientInfo } from '@/lib/audit'
import { prisma } from '@/lib/prisma'
import { AppError, errorResponse, successResponse } from '@/lib/utils'
import { NotificationTemplateTestSendSchema } from '@/lib/validations'
import { ensureDefaultNotificationTemplates, sendNotificationTemplateTest } from '@/lib/notification-service'

function normalizePayload(payload: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(payload).map(([key, value]) => {
      if (value == null) return [key, null]
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return [key, value]
      }
      return [key, JSON.stringify(value)]
    })
  ) as Record<string, string | number | boolean | null | undefined>
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    if (session.user.role !== 'ROLE_ADMIN') {
      throw new AppError(403, 'FORBIDDEN', '관리자 권한이 필요합니다.')
    }

    const body = await request.json()
    const validated = NotificationTemplateTestSendSchema.safeParse(body)
    if (!validated.success) {
      throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0]?.message || '테스트 발송 요청이 올바르지 않습니다.')
    }

    await ensureDefaultNotificationTemplates(prisma)

    const result = await sendNotificationTemplateTest(
      {
        recipientId: session.user.id,
        code: validated.data.code,
        type: validated.data.type,
        channel: validated.data.channel,
        subjectTemplate: validated.data.subjectTemplate,
        bodyTemplate: validated.data.bodyTemplate,
        defaultLink: validated.data.defaultLink,
        payload: normalizePayload(validated.data.previewPayload),
      },
      prisma
    )

    await createAuditLog({
      userId: session.user.id,
      action: 'NOTIFICATION_TEMPLATE_TEST_SENT',
      entityType: 'NotificationTemplate',
      entityId: validated.data.code,
      newValue: {
        channel: validated.data.channel,
        type: validated.data.type,
        recipientId: session.user.id,
        jobId: result.jobId,
      },
      ...getClientInfo(request),
    })

    return successResponse(result)
  } catch (error) {
    return errorResponse(error)
  }
}
