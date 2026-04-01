import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getEvaluationResultsPageData } from '@/server/evaluation-results'
import { buildEvaluationResultPdf, buildEvaluationResultPdfSections } from '@/server/evaluation-results-pdf'
import { AppError, errorResponse } from '@/lib/utils'

export async function GET(
  request: Request,
  context: {
    params: Promise<{
      cycleId: string
    }>
  }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')

    const { cycleId } = await context.params
    const { searchParams } = new URL(request.url)
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

    return new Response(pdfBody, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(sections.fileName)}`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('[evaluation-results-export]', error)

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
