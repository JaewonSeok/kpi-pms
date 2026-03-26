import { authorizeMenu } from '@/server/auth/authorize'
import { errorResponse } from '@/lib/utils'
import { buildWordCloudKeywordCsvTemplate } from '@/server/word-cloud-360'

export async function GET() {
  try {
    const session = await authorizeMenu('WORD_CLOUD_360')
    if (session.user.role !== 'ROLE_ADMIN') {
      return new Response('관리자만 템플릿을 내려받을 수 있습니다.', { status: 403 })
    }

    const template = buildWordCloudKeywordCsvTemplate()

    return new Response(new Uint8Array(template), {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="word-cloud-keyword-template.csv"',
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    return errorResponse(error)
  }
}
