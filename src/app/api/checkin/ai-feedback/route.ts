import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { AppError, errorResponse, successResponse } from '@/lib/utils'
import { generateCheckinAiFeedback } from '@/server/ai/checkin-feedback'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    }

    const body = await request.json().catch(() => null)
    const result = await generateCheckinAiFeedback({
      session,
      input: body,
    })

    return successResponse(result)
  } catch (error) {
    return errorResponse(error, 'AI 피드백을 생성하지 못했습니다. 잠시 후 다시 시도해 주세요.')
  }
}
