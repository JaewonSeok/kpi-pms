import { createAuditLog, getClientInfo } from '@/lib/audit'
import { AdminEvaluatorAssignmentActionSchema } from '@/lib/validations'
import { AppError, errorResponse, successResponse } from '@/lib/utils'
import { authorizeMenu } from '@/server/auth/authorize'
import {
  applyEvaluatorAssignments,
  loadEvaluatorAssignmentPreview,
} from '@/server/admin/google-account-management'

export async function GET() {
  try {
    await authorizeMenu('SYSTEM_SETTING')
    return successResponse(await loadEvaluatorAssignmentPreview())
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const session = await authorizeMenu('SYSTEM_SETTING')
    const body = await request.json()
    const validated = AdminEvaluatorAssignmentActionSchema.safeParse(body)

    if (!validated.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        validated.error.issues[0]?.message || '평가권자 일괄 지정 요청이 올바르지 않습니다.'
      )
    }

    if (validated.data.action === 'preview') {
      return successResponse(await loadEvaluatorAssignmentPreview())
    }

    const result = await applyEvaluatorAssignments()

    await createAuditLog({
      userId: session.user.id,
      action: 'EVALUATOR_BULK_ASSIGN_APPLY',
      entityType: 'Employee',
      entityId: 'bulk-evaluator-assignment',
      newValue: result,
      ...getClientInfo(request),
    })

    return successResponse(result)
  } catch (error) {
    return errorResponse(error)
  }
}
