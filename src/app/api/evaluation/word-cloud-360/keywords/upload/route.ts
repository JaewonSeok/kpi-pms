import { authorizeMenu } from '@/server/auth/authorize'
import { AppError, errorResponse, successResponse } from '@/lib/utils'
import {
  applyWordCloudKeywordCsvImport,
  previewWordCloudKeywordCsvImport,
  WORD_CLOUD_KEYWORD_MAX_UPLOAD_SIZE,
} from '@/server/word-cloud-360'

export async function POST(request: Request) {
  try {
    const session = await authorizeMenu('WORD_CLOUD_360')
    if (session.user.role !== 'ROLE_ADMIN') {
      throw new AppError(403, 'FORBIDDEN', '관리자만 CSV 업로드를 처리할 수 있습니다.')
    }

    const formData = await request.formData()
    const mode = String(formData.get('mode') ?? 'preview').toLowerCase()
    const file = formData.get('file')

    if (!(file instanceof File)) {
      throw new AppError(400, 'UPLOAD_FILE_MISSING', '업로드할 CSV 파일을 선택하세요.')
    }

    if (file.size <= 0) {
      throw new AppError(400, 'EMPTY_UPLOAD_FILE', '빈 파일은 업로드할 수 없습니다.')
    }

    if (file.size > WORD_CLOUD_KEYWORD_MAX_UPLOAD_SIZE) {
      throw new AppError(
        400,
        'UPLOAD_FILE_TOO_LARGE',
        `업로드 파일은 ${Math.round(WORD_CLOUD_KEYWORD_MAX_UPLOAD_SIZE / 1024 / 1024)}MB 이하여야 합니다.`
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const result =
      mode === 'apply'
        ? await applyWordCloudKeywordCsvImport({
            actorId: session.user.id,
            fileName: file.name,
            buffer,
          })
        : await previewWordCloudKeywordCsvImport({
            actorId: session.user.id,
            fileName: file.name,
            buffer,
          })

    return successResponse(result)
  } catch (error) {
    return errorResponse(error, '키워드 CSV 업로드를 처리하지 못했습니다.')
  }
}
