import { AppError, errorResponse } from '@/lib/utils'
import { authorizeMenu } from '@/server/auth/authorize'

export async function POST() {
  try {
    await authorizeMenu('SYSTEM_SETTING')
    throw new AppError(
      410,
      'LEGACY_EMPLOYEE_BULK_ROUTE',
      '기존 JSON 일괄 업로드 경로는 종료되었습니다. 새 일괄 업로드 화면을 사용해 주세요.'
    )
  } catch (error) {
    return errorResponse(error)
  }
}
