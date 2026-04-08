import { getClientInfo } from '@/lib/audit'
import { parseExportReason, createExportAuditLog } from '@/lib/export-audit'
import { AppError, errorResponse } from '@/lib/utils'
import { authorizeMenu } from '@/server/auth/authorize'
import {
  logImpersonationRiskExecution,
  validateImpersonationRiskRequest,
  type ValidatedImpersonationRiskContext,
} from '@/server/impersonation'
import { exportWordCloud360Results } from '@/server/word-cloud-360'

type RouteContext = {
  params: Promise<{
    cycleId: string
  }>
}

export async function GET(request: Request, context: RouteContext) {
  let session = null as Awaited<ReturnType<typeof authorizeMenu>> | null
  let riskContext: ValidatedImpersonationRiskContext | null = null

  try {
    session = await authorizeMenu('WORD_CLOUD_360')
    if (session.user.role !== 'ROLE_ADMIN') {
      throw new AppError(403, 'FORBIDDEN', '관리자만 서베이 결과를 다운로드할 수 있습니다.')
    }

    const { cycleId } = await context.params
    const url = new URL(request.url)
    const format = url.searchParams.get('format') === 'csv' ? 'csv' : 'xlsx'
    const reason = parseExportReason(url.searchParams.get('reason'))

    riskContext = await validateImpersonationRiskRequest({
      session,
      request,
      actionName: 'DOWNLOAD_EXPORT',
      targetResourceType: 'WordCloud360Cycle',
      targetResourceId: cycleId,
      confirmationText: '다운로드',
    })

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

    await logImpersonationRiskExecution({
      session,
      request,
      riskContext,
      success: true,
      metadata: {
        cycleId,
        format,
      },
    })

    return new Response(new Uint8Array(exported.body), {
      headers: {
        'Content-Type': exported.contentType,
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(exported.fileName)}`,
      },
    })
  } catch (error) {
    if (session && riskContext) {
      await logImpersonationRiskExecution({
        session,
        request,
        riskContext,
        success: false,
        metadata: {
          error: error instanceof Error ? error.message : 'unknown',
        },
      }).catch(() => undefined)
    }

    return errorResponse(error, '워드클라우드 서베이 결과를 내보내지 못했습니다.')
  }
}
