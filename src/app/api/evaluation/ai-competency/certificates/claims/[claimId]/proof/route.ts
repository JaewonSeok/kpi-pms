import { errorResponse } from '@/lib/utils'
import { authorizeMenu } from '@/server/auth/authorize'
import { getAiCompetencyCertProofDownload } from '@/server/ai-competency'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ claimId: string }> }
) {
  try {
    const session = await authorizeMenu('AI_COMPETENCY')
    const { claimId } = await params
    const file = await getAiCompetencyCertProofDownload({
      session,
      claimId,
    })

    return new Response(new Uint8Array(file.body), {
      status: 200,
      headers: {
        'Content-Type': file.contentType,
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error) {
    return errorResponse(error)
  }
}
