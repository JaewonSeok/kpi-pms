import { AppError, errorResponse } from '@/lib/utils'
import { authorizeMenu } from '@/server/auth/authorize'

export async function POST() {
  try {
    await authorizeMenu('SYSTEM_SETTING')
    throw new AppError(
      410,
      'LEGACY_EMPLOYEE_PREVIEW_ROUTE',
      '기존 미리보기 경로는 종료되었습니다. 새 일괄 업로드 화면의 검증 미리보기를 사용해 주세요.'
    )
  } catch (error) {
    return errorResponse(error)
  }
}
