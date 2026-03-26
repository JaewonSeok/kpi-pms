import { errorResponse } from '@/lib/utils'
import { authorizeMenu } from '@/server/auth/authorize'
import { getAiCompetencyArtifactDownload } from '@/server/ai-competency'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ artifactId: string }> }
) {
  try {
    const session = await authorizeMenu('AI_COMPETENCY')
    const { artifactId } = await params
    const file = await getAiCompetencyArtifactDownload({
      session,
      artifactId,
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
