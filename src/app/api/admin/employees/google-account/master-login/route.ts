import { createAuditLog, getClientInfo } from '@/lib/audit'
import { canUseMasterLoginForActor } from '@/lib/master-login'
import {
  AdminMasterLoginPermissionSchema,
  AdminMasterLoginSchema,
} from '@/lib/validations'
import { AppError, errorResponse, successResponse } from '@/lib/utils'
import { authorizeMenu } from '@/server/auth/authorize'
import { loadMasterLoginTargetPreview } from '@/server/admin/google-account-management'
import { updateMasterLoginPermission } from '@/server/master-login-permissions'

async function assertMasterLoginExecutionPermission(
  session: Awaited<ReturnType<typeof authorizeMenu>>
) {
  const allowed = await canUseMasterLoginForActor({
    employeeId: session.user.id,
    role: session.user.role,
    email: session.user.email,
  })

  if (!allowed) {
    throw new AppError(
      403,
      'MASTER_LOGIN_FORBIDDEN',
      '마스터 로그인 권한이 없습니다. 이 작업은 소유자 또는 권한이 부여된 HR 관리자만 수행할 수 있습니다.'
    )
  }
}

export async function POST(request: Request) {
  try {
    const session = await authorizeMenu('SYSTEM_SETTING')

    if (session.user.masterLogin?.active) {
      throw new AppError(
        400,
        'MASTER_LOGIN_ALREADY_ACTIVE',
        '이미 마스터 로그인 중입니다. 현재 세션을 먼저 종료해 주세요.'
      )
    }

    await assertMasterLoginExecutionPermission(session)

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

export async function PATCH(request: Request) {
  try {
    const session = await authorizeMenu('SYSTEM_SETTING')
    const body = await request.json()
    const validated = AdminMasterLoginPermissionSchema.safeParse(body)

    if (!validated.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        validated.error.issues[0]?.message || '권한 변경 요청이 올바르지 않습니다.'
      )
    }

    return successResponse(
      await updateMasterLoginPermission(
        {
          actor: {
            id: session.user.id,
            name: session.user.name,
            email: session.user.email,
            role: session.user.role,
            canManage: true,
            masterLoginActive: Boolean(session.user.masterLogin?.active),
          },
          targetEmployeeId: validated.data.targetEmployeeId,
          enabled: validated.data.enabled,
          auditContext: getClientInfo(request),
        }
      )
    )
  } catch (error) {
    return errorResponse(error)
  }
}
