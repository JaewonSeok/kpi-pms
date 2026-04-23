import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { resolvePersonalKpiAiAccess } from '@/lib/personal-kpi-access'
import { AppError, errorResponse, successResponse } from '@/lib/utils'
import { generatePersonalKpiMidcheckCoach } from '@/server/ai/personal-kpi-midcheck-coach'

export const runtime = 'nodejs'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    }

    const aiAccess = resolvePersonalKpiAiAccess({
      role: session.user.role,
    })

    if (aiAccess.reason === 'role') {
      throw new AppError(403, 'FORBIDDEN', aiAccess.message || '개인 KPI AI 코치를 사용할 권한이 없습니다.')
    }

    const { id } = await context.params
    const body = await request.json()
    const result = await generatePersonalKpiMidcheckCoach({
      session,
      personalKpiId: id,
      input: body,
    })

    return successResponse(result)
  } catch (error) {
    return errorResponse(error)
  }
}
