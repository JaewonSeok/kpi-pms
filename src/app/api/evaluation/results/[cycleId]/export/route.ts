import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import {
  logImpersonationRiskExecution,
  validateImpersonationRiskRequest,
  type ValidatedImpersonationRiskContext,
} from '@/server/impersonation'
import { getEvaluationResultsPageData } from '@/server/evaluation-results'
import { buildEvaluationResultPdf, buildEvaluationResultPdfSections } from '@/server/evaluation-results-pdf'
import { AppError, errorResponse } from '@/lib/utils'
import type { AuthSession } from '@/types/auth'

export async function GET(
  request: Request,
  context: {
    params: Promise<{
      cycleId: string
    }>
  }
) {
  let session: AuthSession | null = null
  let riskContext: ValidatedImpersonationRiskContext | null = null

  try {
    session = (await getServerSession(authOptions)) as AuthSession | null
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')

    const { cycleId } = await context.params
    const { searchParams } = new URL(request.url)
    riskContext = await validateImpersonationRiskRequest({
      session,
      request,
      actionName: 'DOWNLOAD_EXPORT',
      targetResourceType: 'EvaluationResultExport',
      targetResourceId: cycleId,
      confirmationText: '다운로드',
    })

    const data = await getEvaluationResultsPageData({
      session,
      cycleId,
      employeeId: searchParams.get('employeeId') ?? undefined,
    })

    if (data.state !== 'ready' || !data.viewModel) {
      throw new AppError(404, 'RESULT_NOT_READY', '다운로드할 평가 결과를 찾지 못했습니다.')
    }

    const sections = buildEvaluationResultPdfSections(data.viewModel)
    const bytes = await buildEvaluationResultPdf(data.viewModel)
    const pdfBody = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer

    await logImpersonationRiskExecution({
      session,
      request,
      riskContext,
      success: true,
      metadata: {
        cycleId,
        employeeId: searchParams.get('employeeId') ?? null,
      },
    })

    return new Response(pdfBody, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(sections.fileName)}`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('[evaluation-results-export]', error)

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

    if (error instanceof AppError) {
      return errorResponse(error)
    }

    return errorResponse(
      new AppError(
        500,
        'EXPORT_FAILED',
        '평가 결과 PDF를 생성하지 못했습니다. 잠시 후 다시 시도해 주세요.'
      )
    )
  }
}
