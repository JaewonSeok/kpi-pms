import { AppError } from '@/lib/utils'
import { ExportReasonSchema } from '@/lib/validations'
import { createAuditLog } from '@/lib/audit'

export function parseExportReason(reason: unknown) {
  const validated = ExportReasonSchema.safeParse({ reason })
  if (!validated.success) {
    throw new AppError(
      400,
      'EXPORT_REASON_REQUIRED',
      validated.error.issues[0]?.message ?? '다운로드 사유를 입력해 주세요.'
    )
  }

  return validated.data.reason
}

export async function createExportAuditLog(params: {
  userId: string
  entityType: string
  entityId?: string
  action: string
  reason: string
  format: string
  ipAddress?: string
  userAgent?: string
  extra?: Record<string, unknown>
}) {
  await createAuditLog({
    userId: params.userId,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    newValue: {
      reason: params.reason,
      format: params.format,
      ...(params.extra ?? {}),
    },
  })
}
