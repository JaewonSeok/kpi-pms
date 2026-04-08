import { createAuditLog, getClientInfo } from '@/lib/audit'
import { canUseMasterLogin } from '@/lib/master-login'
import { AdminMasterLoginSchema } from '@/lib/validations'
import { AppError, errorResponse, successResponse } from '@/lib/utils'
import { authorizeMenu } from '@/server/auth/authorize'
import { loadMasterLoginTargetPreview } from '@/server/admin/google-account-management'

export async function POST(request: Request) {
  try {
    const session = await authorizeMenu('SYSTEM_SETTING')

    if (!canUseMasterLogin({ role: session.user.role, email: session.user.email })) {
      throw new AppError(
        403,
        'MASTER_LOGIN_FORBIDDEN',
        '마스터 로그인은 허용된 관리자만 사용할 수 있습니다.'
      )
    }

    const body = await request.json()
    const validated = AdminMasterLoginSchema.safeParse(body)

    if (!validated.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        validated.error.issues[0]?.message || '마스터 로그인 대상이 올바르지 않습니다.'
      )
    }

    const preview = await loadMasterLoginTargetPreview(validated.data.targetEmployeeId)

    if (preview.employee.id === session.user.id) {
      throw new AppError(
        400,
        'MASTER_LOGIN_SELF_TARGET',
        '현재 로그인한 관리자 계정은 마스터 로그인 대상으로 선택할 수 없습니다.'
      )
    }

    await createAuditLog({
      userId: session.user.id,
      action: 'MASTER_LOGIN_PREVIEW',
      entityType: 'Employee',
      entityId: preview.employee.id,
      newValue: {
        targetEmployeeId: preview.employee.id,
        targetEmployeeNumber: preview.employee.employeeNumber,
        reason: validated.data.reason,
      },
      ...getClientInfo(request),
    })

    return successResponse({
      employee: preview.employee,
      actor: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
      },
      reason: validated.data.reason,
    })
  } catch (error) {
    return errorResponse(error)
  }
}
