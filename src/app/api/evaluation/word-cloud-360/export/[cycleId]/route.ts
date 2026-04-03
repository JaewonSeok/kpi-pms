import { authorizeMenu } from '@/server/auth/authorize'
import { AppError, errorResponse } from '@/lib/utils'
import { exportWordCloud360Results } from '@/server/word-cloud-360'
import { parseExportReason, createExportAuditLog } from '@/lib/export-audit'
import { getClientInfo } from '@/lib/audit'

type RouteContext = {
  params: Promise<{
    cycleId: string
  }>
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const session = await authorizeMenu('WORD_CLOUD_360')
    if (session.user.role !== 'ROLE_ADMIN') {
      throw new AppError(403, 'FORBIDDEN', '관리자만 서베이 결과를 다운로드할 수 있습니다.')
    }
    const { cycleId } = await context.params
    const url = new URL(request.url)
    const format = url.searchParams.get('format') === 'csv' ? 'csv' : 'xlsx'
    const reason = parseExportReason(url.searchParams.get('reason'))
    const clientInfo = getClientInfo(request)
    const exported = await exportWordCloud360Results({
      actorId: session.user.id,
      cycleId,
      format,
    })

    await createExportAuditLog({
      userId: session.user.id,
      entityType: 'WORD_CLOUD_360_CYCLE',
      entityId: cycleId,
      action: 'EXPORT_WORD_CLOUD_360_RESULTS',
      reason,
      format,
      ipAddress: clientInfo.ipAddress,
      userAgent: clientInfo.userAgent,
      extra: {
        menuKey: 'WORD_CLOUD_360',
      },
    })

    return new Response(new Uint8Array(exported.body), {
      headers: {
        'Content-Type': exported.contentType,
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(exported.fileName)}`,
      },
    })
  } catch (error) {
    return errorResponse(error, '워드클라우드형 다면평가 결과를 내보내지 못했습니다.')
  }
}
