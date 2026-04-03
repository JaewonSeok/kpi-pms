import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { CalibrationExportSchema } from '@/lib/validations'
import { AppError, errorResponse } from '@/lib/utils'
import { buildCalibrationExportWorkbook } from '@/server/evaluation-calibration-export'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    if (!['ROLE_ADMIN', 'ROLE_CEO'].includes(session.user.role)) {
      throw new AppError(403, 'FORBIDDEN', '캘리브레이션 엑셀 다운로드 권한이 없습니다.')
    }

    const { searchParams } = new URL(request.url)
    const disposition = searchParams.get('disposition') === 'inline' ? 'inline' : 'attachment'
    const validated = CalibrationExportSchema.safeParse({
      cycleId: searchParams.get('cycleId') ?? undefined,
      scopeId: searchParams.get('scopeId') ?? undefined,
      mode: searchParams.get('mode') ?? undefined,
    })

    if (!validated.success) {
      throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0]?.message ?? '내보내기 형식이 올바르지 않습니다.')
    }

    const exported = await buildCalibrationExportWorkbook({
      session,
      ...validated.data,
    })

    return new Response(new Uint8Array(exported.body), {
      headers: {
        'Content-Type': exported.contentType,
        'Content-Disposition': `${disposition}; filename="${exported.fileName}"`,
      },
    })
  } catch (error) {
    return errorResponse(error, '캘리브레이션 엑셀 다운로드 중 오류가 발생했습니다.')
  }
}
