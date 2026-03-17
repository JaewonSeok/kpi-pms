import { getServerSession } from 'next-auth'
import { AIRequestType } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { generateAiAssist } from '@/lib/ai-assist'
import { AppError, errorResponse, successResponse } from '@/lib/utils'
import { AIAssistRequestSchema } from '@/lib/validations'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    }

    const body = await request.json()
    const validated = AIAssistRequestSchema.safeParse(body)
    if (!validated.success) {
      throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0]?.message || 'Invalid AI request.')
    }

    const result = await generateAiAssist({
      requesterId: session.user.id,
      requestType: validated.data.requestType as AIRequestType,
      sourceType: validated.data.sourceType,
      sourceId: validated.data.sourceId,
      payload: validated.data.payload,
    })

    return successResponse(result)
  } catch (error) {
    return errorResponse(error)
  }
}
