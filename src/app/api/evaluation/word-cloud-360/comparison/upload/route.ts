import { AppError, errorResponse, successResponse } from '@/lib/utils'
import { authorizeMenu } from '@/server/auth/authorize'
import {
  logImpersonationRiskExecution,
  validateImpersonationRiskRequest,
  type ValidatedImpersonationRiskContext,
} from '@/server/impersonation'
import {
  generateWordCloudComparisonReport,
  WORD_CLOUD_COMPARISON_UPLOAD_MAX_SIZE,
} from '@/server/word-cloud-360'

export async function POST(request: Request) {
  let session = null as Awaited<ReturnType<typeof authorizeMenu>> | null
  let riskContext: ValidatedImpersonationRiskContext | null = null

  try {
    session = await authorizeMenu('WORD_CLOUD_360')
    if (session.user.role !== 'ROLE_ADMIN') {
      throw new AppError(403, 'FORBIDDEN', '관리자만 비교 리포트를 생성할 수 있습니다.')
    }

    const formData = await request.formData()
    const cycleId = String(formData.get('cycleId') ?? '')
    const file = formData.get('file')

    if (!cycleId) {
      throw new AppError(400, 'VALIDATION_ERROR', '비교할 현재 서베이 주기를 선택해 주세요.')
    }
    if (!(file instanceof File)) {
      throw new AppError(400, 'UPLOAD_FILE_MISSING', '비교할 과거 결과 파일을 선택해 주세요.')
    }
    if (file.size <= 0) {
      throw new AppError(400, 'EMPTY_UPLOAD_FILE', '빈 파일은 업로드할 수 없습니다.')
    }
    if (file.size > WORD_CLOUD_COMPARISON_UPLOAD_MAX_SIZE) {
      throw new AppError(
        400,
        'UPLOAD_FILE_TOO_LARGE',
        `업로드 파일은 ${Math.round(WORD_CLOUD_COMPARISON_UPLOAD_MAX_SIZE / 1024 / 1024)}MB 이하여야 합니다.`
      )
    }

    riskContext = await validateImpersonationRiskRequest({
      session,
      request,
      actionName: 'UPLOAD_APPLY',
      targetResourceType: 'WordCloud360ComparisonReport',
      targetResourceId: cycleId,
      confirmationText: '업로드',
    })

    const result = await generateWordCloudComparisonReport({
      actorId: session.user.id,
      cycleId,
      fileName: file.name,
      buffer: Buffer.from(await file.arrayBuffer()),
    })

    await logImpersonationRiskExecution({
      session,
      request,
      riskContext,
      success: true,
      metadata: {
        cycleId,
        fileName: file.name,
      },
    })

    return successResponse(result)
  } catch (error) {
    if (session && riskContext) {
      await logImpersonationRiskExecution({
        session,
        request,
        riskContext,
        success: false,
        metadata: {
          error: error instanceof Error ? error.message : 'unknown',
        },
      }).catch(() => undefined)
    }

    return errorResponse(error, '서베이 비교 리포트를 생성하지 못했습니다.')
  }
}
