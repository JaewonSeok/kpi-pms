import { AppError, errorResponse } from '@/lib/utils'
import { authorizeMenu } from '@/server/auth/authorize'
import { exportAiCompetencyBlueprint } from '@/server/ai-competency'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ blueprintId: string }> }
) {
  try {
    await authorizeMenu('AI_COMPETENCY')
    const { blueprintId } = await params
    const url = new URL(request.url)
    const format = url.searchParams.get('format') === 'csv' ? 'csv' : 'xlsx'
    const exported = await exportAiCompetencyBlueprint({ blueprintId, format })

    return new Response(new Uint8Array(exported.body), {
      status: 200,
      headers: {
        'Content-Type': exported.contentType,
        'Content-Disposition': `attachment; filename="${exported.fileName}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    const response = errorResponse(error)
    if (response.status !== 500) return response
    return errorResponse(
      error instanceof Error ? error : new AppError(500, 'AI_COMPETENCY_BLUEPRINT_EXPORT_FAILED', '문항 체계표를 내보내지 못했습니다.')
    )
  }
}
