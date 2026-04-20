import { AppError, errorResponse } from '@/lib/utils'
import { authorizeMenu } from '@/server/auth/authorize'
import { getAiCompetencyGateEvidenceDownload } from '@/server/ai-competency-gate'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ evidenceId: string }> }
) {
  try {
    const session = await authorizeMenu('AI_COMPETENCY')
    const { evidenceId } = await params
    const downloaded = await getAiCompetencyGateEvidenceDownload({
      session,
      evidenceId,
    })

    return new Response(new Uint8Array(downloaded.body), {
      status: 200,
      headers: {
        'Content-Type': downloaded.contentType,
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(downloaded.fileName)}`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    return errorResponse(error, '증빙 파일을 불러오는 중 문제가 발생했습니다.')
  }
}
