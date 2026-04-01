import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createAuditLog, getClientInfo } from '@/lib/audit'
import { prisma } from '@/lib/prisma'
import { AppError, errorResponse, successResponse } from '@/lib/utils'
import { FeedbackRoundSettingsSchema } from '@/lib/validations'
import {
  DEFAULT_FEEDBACK_SELECTION_SETTINGS,
  DEFAULT_FEEDBACK_VISIBILITY_SETTINGS,
  parseFeedbackSelectionSettings,
  parseFeedbackVisibilitySettings,
} from '@/server/feedback-360-workflow'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    if (session.user.role !== 'ROLE_ADMIN') {
      throw new AppError(403, 'FORBIDDEN', '리뷰 설정은 관리자만 수정할 수 있습니다.')
    }

    const { id } = await context.params
    const validated = FeedbackRoundSettingsSchema.safeParse(await request.json())
    if (!validated.success) {
      throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0]?.message ?? '설정 값을 확인해 주세요.')
    }

    const existing = await prisma.multiFeedbackRound.findUnique({
      where: { id },
      include: {
        evalCycle: {
          select: {
            orgId: true,
          },
        },
      },
    })

    if (!existing) {
      throw new AppError(404, 'ROUND_NOT_FOUND', '360 리뷰 라운드를 찾을 수 없습니다.')
    }

    if (validated.data.folderId) {
      const folder = await prisma.feedbackFolder.findUnique({
        where: { id: validated.data.folderId },
        select: {
          id: true,
          orgId: true,
        },
      })

      if (!folder || folder.orgId !== existing.evalCycle.orgId) {
        throw new AppError(400, 'INVALID_FOLDER', '선택한 폴더를 현재 라운드에 연결할 수 없습니다.')
      }
    }

    const nextSelectionSettings = validated.data.selectionSettings
      ? {
          ...DEFAULT_FEEDBACK_SELECTION_SETTINGS,
          ...validated.data.selectionSettings,
        }
      : parseFeedbackSelectionSettings(existing.selectionSettings)

    const nextVisibilitySettings = validated.data.visibilitySettings
      ? {
          ...DEFAULT_FEEDBACK_VISIBILITY_SETTINGS,
          ...validated.data.visibilitySettings,
        }
      : parseFeedbackVisibilitySettings(existing.visibilitySettings)

    const updated = await prisma.multiFeedbackRound.update({
      where: { id },
      data: {
        ...(validated.data.folderId !== undefined ? { folderId: validated.data.folderId } : {}),
        ...(validated.data.selectionSettings !== undefined
          ? { selectionSettings: nextSelectionSettings }
          : {}),
        ...(validated.data.visibilitySettings !== undefined
          ? { visibilitySettings: nextVisibilitySettings }
          : {}),
      },
      select: {
        id: true,
        folderId: true,
        selectionSettings: true,
        visibilitySettings: true,
      },
    })

    await createAuditLog({
      userId: session.user.id,
      action: 'FEEDBACK_ROUND_SETTINGS_UPDATED',
      entityType: 'MultiFeedbackRound',
      entityId: updated.id,
      oldValue: {
        folderId: existing.folderId,
        selectionSettings: parseFeedbackSelectionSettings(existing.selectionSettings),
        visibilitySettings: parseFeedbackVisibilitySettings(existing.visibilitySettings),
      },
      newValue: {
        folderId: updated.folderId,
        selectionSettings: parseFeedbackSelectionSettings(updated.selectionSettings),
        visibilitySettings: parseFeedbackVisibilitySettings(updated.visibilitySettings),
      },
      ...getClientInfo(request),
    })

    return successResponse({
      roundId: updated.id,
      folderId: updated.folderId,
      selectionSettings: parseFeedbackSelectionSettings(updated.selectionSettings),
      visibilitySettings: parseFeedbackVisibilitySettings(updated.visibilitySettings),
    })
  } catch (error) {
    return errorResponse(error)
  }
}
