import { createAuditLog, getClientInfo } from '@/lib/audit'
import { AdminDepartmentRecordSchema } from '@/lib/validations'
import { AppError, errorResponse, successResponse } from '@/lib/utils'
import { authorizeMenu } from '@/server/auth/authorize'
import { upsertDepartmentRecord } from '@/server/admin/google-account-management'

export async function POST(request: Request) {
  try {
    const session = await authorizeMenu('SYSTEM_SETTING')
    const body = await request.json()
    const validated = AdminDepartmentRecordSchema.safeParse(body)

    if (!validated.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        validated.error.issues[0]?.message || '조직 입력값이 올바르지 않습니다.'
      )
    }

    const result = await upsertDepartmentRecord(validated.data)

    await createAuditLog({
      userId: session.user.id,
      action: 'DEPARTMENT_UPSERT',
      entityType: 'Department',
      entityId: result.department.id,
      newValue: result,
      ...getClientInfo(request),
    })

    return successResponse(result)
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PUT(request: Request) {
  return POST(request)
}
