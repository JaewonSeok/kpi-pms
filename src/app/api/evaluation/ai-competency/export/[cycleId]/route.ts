import { AppError, errorResponse } from '@/lib/utils'
import { authorizeMenu } from '@/server/auth/authorize'
import { exportAiCompetencyGateReport } from '@/server/ai-competency-gate'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ cycleId: string }> }
) {
  try {
    const session = await authorizeMenu('AI_COMPETENCY')
    if (session.user.role !== 'ROLE_ADMIN' && session.user.role !== 'ROLE_CEO') {
      throw new AppError(403, 'FORBIDDEN', '관리자 또는 경영진만 내보내기를 사용할 수 있습니다.')
    }

    const { cycleId } = await params
    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') === 'xlsx' ? 'xlsx' : 'csv'
    const exported = await exportAiCompetencyGateReport({ session, cycleId, format })

    return new Response(new Uint8Array(exported.body), {
      status: 200,
      headers: {
        'Content-Type': exported.contentType,
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(exported.fileName)}`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    return errorResponse(error)
  }
}
