import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { AppError, errorResponse } from '@/lib/utils'
import { GoalExportSchema } from '@/lib/validations'
import { buildGoalExportWorkbook } from '@/server/kpi-export'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')

    const { searchParams } = new URL(request.url)
    const validated = GoalExportSchema.safeParse({
      mode: searchParams.get('mode') ?? undefined,
      year: searchParams.get('year') ?? undefined,
      departmentId: searchParams.get('departmentId') ?? undefined,
    })

    if (!validated.success) {
      throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0].message)
    }

    const exported = await buildGoalExportWorkbook({
      session,
      ...validated.data,
    })

    return new Response(new Uint8Array(exported.body), {
      headers: {
        'Content-Type': exported.contentType,
        'Content-Disposition': `attachment; filename="${exported.fileName}"`,
      },
    })
  } catch (error) {
    return errorResponse(error, '목표 엑셀 다운로드 중 오류가 발생했습니다.')
  }
}
