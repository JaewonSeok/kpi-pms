import { authorizeMenu } from '@/server/auth/authorize'
import { errorResponse } from '@/lib/utils'
import { exportWordCloud360Results } from '@/server/word-cloud-360'

type RouteContext = {
  params: Promise<{
    cycleId: string
  }>
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const session = await authorizeMenu('WORD_CLOUD_360')
    const { cycleId } = await context.params
    const url = new URL(request.url)
    const format = url.searchParams.get('format') === 'csv' ? 'csv' : 'xlsx'
    const exported = await exportWordCloud360Results({
      actorId: session.user.id,
      cycleId,
      format,
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
