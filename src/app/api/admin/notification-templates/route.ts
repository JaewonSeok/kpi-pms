import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureDefaultNotificationTemplates } from '@/lib/notification-service'
import { UpdateNotificationTemplatesSchema } from '@/lib/validations'
import { AppError, errorResponse, successResponse } from '@/lib/utils'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '인증이 필요합니다.')
    if (session.user.role !== 'ROLE_ADMIN') {
      throw new AppError(403, 'FORBIDDEN', '관리자 권한이 필요합니다.')
    }

    await ensureDefaultNotificationTemplates(prisma)
    const templates = await prisma.notificationTemplate.findMany({
      orderBy: [{ type: 'asc' }, { channel: 'asc' }],
    })

    return successResponse(templates)
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '인증이 필요합니다.')
    if (session.user.role !== 'ROLE_ADMIN') {
      throw new AppError(403, 'FORBIDDEN', '관리자 권한이 필요합니다.')
    }

    const body = await request.json()
    const validated = UpdateNotificationTemplatesSchema.safeParse(body)
    if (!validated.success) {
      throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0].message)
    }

    await prisma.$transaction(async (tx) => {
      for (const template of validated.data.templates) {
        await tx.notificationTemplate.upsert({
          where: { code: template.code },
          update: {
            name: template.name,
            type: template.type,
            channel: template.channel,
            subjectTemplate: template.subjectTemplate,
            bodyTemplate: template.bodyTemplate,
            defaultLink: template.defaultLink,
            isActive: template.isActive,
            isDigestCompatible: template.isDigestCompatible,
          },
          create: template,
        })
      }
    })

    const templates = await prisma.notificationTemplate.findMany({
      orderBy: [{ type: 'asc' }, { channel: 'asc' }],
    })

    return successResponse(templates)
  } catch (error) {
    return errorResponse(error)
  }
}
